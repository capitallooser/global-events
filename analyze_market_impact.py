#!/usr/bin/env python3
import bisect, csv, io, json, re, statistics, urllib.parse, urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/'market-impact.json'
OFFICIAL_DATES=ROOT/'historical-event-dates.json'
FED_URL='https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'
BLS_YEAR_URL='https://www.bls.gov/schedule/{year}/home.htm'

EVENT_TYPES={
 'fomc':{'label':'Federal Reserve FOMC','origin':'US','historySource':'Federal Reserve','reactionRule':'default'},
 'us_cpi':{'label':'US Consumer Price Index','origin':'US','historySource':'U.S. BLS','reactionRule':'default'},
 'us_nfp':{'label':'US Employment Situation (NFP)','origin':'US','historySource':'U.S. BLS','reactionRule':'default'},
 'us_ppi':{'label':'US Producer Price Index','origin':'US','historySource':'U.S. BLS','reactionRule':'default'},
 'us_jolts':{'label':'US JOLTS','origin':'US','historySource':'U.S. BLS','reactionRule':'default'},
 'us_eci':{'label':'US Employment Cost Index','origin':'US','historySource':'U.S. BLS','reactionRule':'default'},
 'rbi_mpc':{'label':'RBI Monetary Policy Committee','origin':'IN','historySource':'Reserve Bank of India','reactionRule':'event_day'},
 'india_cpi':{'label':'India Consumer Price Index (CPI)','origin':'IN','historySource':'MoSPI','reactionRule':'next_session'},
 'india_gdp':{'label':'India GDP','origin':'IN','historySource':'MoSPI','reactionRule':'next_session'},
 'india_iip':{'label':'India Index of Industrial Production (IIP)','origin':'IN','historySource':'MoSPI','reactionRule':'next_session'},
 'india_wpi':{'label':'India Wholesale Price Index (WPI)','origin':'IN','historySource':'Office of Economic Adviser','reactionRule':'event_day'},
 'ecb_mpc':{'label':'European Central Bank Monetary Policy Decision','origin':'GLOBAL','historySource':'European Central Bank','reactionRule':'global_decision'},
 'boe_mpc':{'label':'Bank of England Monetary Policy Committee','origin':'GLOBAL','historySource':'Bank of England','reactionRule':'global_decision'},
}

BENCHMARKS={
 'nifty':{'label':'NIFTY 50','market':'IN','yahoo':'^NSEI','stooq':'^nifty'},
 'banknifty':{'label':'Bank NIFTY','market':'IN','yahoo':'^NSEBANK','stooq':None},
 'sensex':{'label':'Sensex','market':'IN','yahoo':'^BSESN','stooq':None},
 'sp500':{'label':'S&P 500','market':'US','yahoo':'^GSPC','stooq':'^spx'},
 'nasdaq':{'label':'Nasdaq Composite','market':'US','yahoo':'^IXIC','stooq':'^ndq'},
 'gold':{'label':'Gold','market':'GLOBAL','yahoo':'GC=F','stooq':'xauusd'},
 'crude':{'label':'WTI Crude Oil','market':'GLOBAL','yahoo':'CL=F','stooq':None},
 'usdinr':{'label':'USD/INR','market':'GLOBAL','yahoo':'INR=X','stooq':'usdinr'},
 'bitcoin':{'label':'Bitcoin','market':'GLOBAL','yahoo':'BTC-USD','stooq':'btcusd'},
}

MONTH_MAP={'january':(1,1),'jan/feb':(1,2),'january/february':(1,2),'february':(2,2),'march':(3,3),'april':(4,4),'apr/may':(4,5),'april/may':(4,5),'may':(5,5),'june':(6,6),'july':(7,7),'august':(8,8),'september':(9,9),'october':(10,10),'oct/nov':(10,11),'october/november':(10,11),'november':(11,11),'december':(12,12)}

def fetch_text(url,timeout=35):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GlobalEventsMarketIntelligence/4.0','Accept':'*/*'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return r.read().decode('utf-8','replace')

class TextExtractor(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,data):
      t=' '.join(data.split())
      if t:self.parts.append(t)
    def text(self):return '\n'.join(self.parts)
class TableRowParser(HTMLParser):
    def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
    def handle_starttag(self,tag,attrs):
      if tag=='tr':self.row=[]
      elif tag in ('td','th') and self.row is not None:self.cell=[]
    def handle_data(self,data):
      if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
      if tag in ('td','th') and self.cell is not None and self.row is not None:self.row.append(' '.join(''.join(self.cell).replace('\xa0',' ').split()));self.cell=None
      elif tag=='tr' and self.row is not None:
        if self.row:self.rows.append(self.row)
        self.row=None

def html_text(html):p=TextExtractor();p.feed(html);return p.text()
def classify_bls_release(title):
    t=title.lower()
    if t.startswith('consumer price index'):return'us_cpi'
    if t.startswith('employment situation'):return'us_nfp'
    if t.startswith('producer price index'):return'us_ppi'
    if t.startswith('job openings and labor turnover'):return'us_jolts'
    if t.startswith('employment cost index'):return'us_eci'
    return None

def parse_bls_history(html):
    p=TableRowParser();p.feed(html);out=[]
    for row in p.rows:
      if len(row)<3:continue
      key=classify_bls_release(row[2])
      if not key:continue
      try:d=datetime.strptime(row[0],'%A, %B %d, %Y').date()
      except ValueError:continue
      out.append({'key':key,'date':d.isoformat()})
    return out

def parse_fomc_history(html):
    text=html_text(html);current_year=datetime.now(timezone.utc).year;out=[]
    for year in range(2021,current_year+1):
      marker=f'{year} FOMC Meetings';start=text.find(marker)
      if start<0:continue
      later=[text.find(f'{y} FOMC Meetings',start+len(marker)) for y in range(year-1,current_year+2) if y!=year];later=[p for p in later if p>start];end=min(later) if later else min(len(text),start+10000);section=text[start:end]
      month_pattern=r'(January/February|Jan/Feb|January|February|March|April/May|Apr/May|April|May|June|July|August|September|October/November|Oct/Nov|October|November|December)'
      for m in re.finditer(month_pattern+r'\s+(\d{1,2})-(\d{1,2})',section,re.I):
        end_month=MONTH_MAP[m.group(1).lower()][1]
        try:d=date(year,end_month,int(m.group(3)))
        except ValueError:continue
        out.append({'key':'fomc','date':d.isoformat()})
    return out

def fetch_yahoo_prices(symbol,start,end):
    start_dt=datetime.combine(start,datetime.min.time(),tzinfo=timezone.utc);end_dt=datetime.combine(end+timedelta(days=1),datetime.min.time(),tzinfo=timezone.utc);encoded=urllib.parse.quote(symbol,safe='')
    url=f'https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?period1={int(start_dt.timestamp())}&period2={int(end_dt.timestamp())}&interval=1d&events=history&includeAdjustedClose=true'
    payload=json.loads(fetch_text(url));result=((payload.get('chart') or {}).get('result') or [None])[0]
    if not result:raise RuntimeError(f'Yahoo returned no chart data for {symbol}')
    ts=result.get('timestamp') or [];ind=result.get('indicators') or {};adj=((ind.get('adjclose') or [{}])[0].get('adjclose') or []);close=((ind.get('quote') or [{}])[0].get('close') or []);prices={}
    for i,t in enumerate(ts):
      v=adj[i] if i<len(adj) and adj[i] is not None else(close[i] if i<len(close) else None)
      if v is not None:prices[datetime.fromtimestamp(t,timezone.utc).date().isoformat()]=float(v)
    if len(prices)<100:raise RuntimeError(f'Yahoo returned too few rows for {symbol}: {len(prices)}')
    return prices,'Yahoo Finance chart'

def fetch_stooq_prices(symbol,start,end):
    if not symbol:raise RuntimeError('No Stooq fallback configured')
    encoded=urllib.parse.quote(symbol,safe='');text=fetch_text(f'https://stooq.com/q/d/l/?s={encoded}&i=d&d1={start:%Y%m%d}&d2={end:%Y%m%d}');prices={}
    for row in csv.DictReader(io.StringIO(text)):
      d=(row.get('Date') or '').strip();v=(row.get('Close') or '').strip()
      if not d or not v or v=='-':continue
      try:prices[d]=float(v)
      except ValueError:pass
    if len(prices)<100:raise RuntimeError(f'Stooq returned too few rows for {symbol}: {len(prices)}')
    return prices,'Stooq'

def fetch_benchmark_prices(config,start,end):
    errors=[]
    try:return fetch_yahoo_prices(config['yahoo'],start,end)
    except Exception as exc:errors.append(f'Yahoo: {exc}')
    try:return fetch_stooq_prices(config.get('stooq'),start,end)
    except Exception as exc:errors.append(f'Stooq: {exc}')
    raise RuntimeError('; '.join(errors))

def reaction_return(prices,event_date,benchmark_market,event_origin,horizon,reaction_rule=None):
    dates=sorted(prices);event=event_date.isoformat();rule=reaction_rule or 'default'
    # Post-close releases and decisions occurring after India's cash close use the
    # event-date (or latest prior) close as the base, then the next trading session.
    use_next=(rule=='next_session') or (benchmark_market=='IN' and event_origin in {'US','GLOBAL'})
    if use_next:
      base_idx=bisect.bisect_right(dates,event)-1
      if base_idx<0:return None
      target_idx=base_idx+horizon
    else:
      reaction_idx=bisect.bisect_left(dates,event)
      if reaction_idx>=len(dates):return None
      base_idx=reaction_idx-1
      if base_idx<0:return None
      target_idx=reaction_idx+(horizon-1)
    if target_idx>=len(dates):return None
    base=prices[dates[base_idx]];target=prices[dates[target_idx]]
    return None if not base else(target/base-1)*100

def summarize(values):
    values=[v for v in values if v is not None]
    if not values:return None
    sample=len(values);up=sum(v>0 for v in values);down=sum(v<0 for v in values);flat=sample-up-down;absvals=[abs(v) for v in values];ready=sample>=8
    return{'sample':sample,'directionReady':ready,'upPct':round(up*100/sample,1) if ready else None,'downPct':round(down*100/sample,1) if ready else None,'flatPct':round(flat*100/sample,1) if ready else None,'avgReturnPct':round(statistics.mean(values),2),'avgAbsMovePct':round(statistics.mean(absvals),2),'medianAbsMovePct':round(statistics.median(absvals),2),'maxAbsMovePct':round(max(absvals),2)}
def bias_label(stats):
    if not stats or not stats.get('directionReady'):return'Insufficient sample'
    up=stats['upPct']
    if up>=65:return'Historically bullish'
    if up>=55:return'Mild bullish tendency'
    if up<=35:return'Historically bearish'
    if up<=45:return'Mild bearish tendency'
    return'Mixed / neutral'
def impact_level(score):
    if score is None:return'no_history'
    if score>=1.25:return'very_high'
    if score>=.80:return'high'
    if score>=.40:return'medium'
    return'low'

def load_official_event_dates(path=OFFICIAL_DATES):
    if not path.exists():return {},{}
    payload=json.loads(path.read_text());by={k:[] for k in EVENT_TYPES};provenance={k:[] for k in EVENT_TYPES}
    for row in payload.get('rows',[]):
      key=row.get('key');d=row.get('date')
      if key not in EVENT_TYPES or not re.fullmatch(r'20\d{2}-\d{2}-\d{2}',str(d or '')):continue
      by[key].append(d);provenance[key].append({'date':d,'sourceName':row.get('sourceName'),'sourceUrl':row.get('sourceUrl')})
    return by,provenance

def build_analysis(event_dates_by_key,benchmark_prices,benchmark_sources,now,provenance=None):
    event_types={};provenance=provenance or {}
    for key,meta in EVENT_TYPES.items():
      dates=[datetime.strptime(d,'%Y-%m-%d').date() for d in sorted(set(event_dates_by_key.get(key,[]))) if d<now.date().isoformat()]
      if not dates:continue
      markets={};one_day_abs=[]
      for bkey,cfg in BENCHMARKS.items():
        prices=benchmark_prices.get(bkey)
        if not prices:continue
        one_stats=summarize([reaction_return(prices,d,cfg['market'],meta['origin'],1,meta.get('reactionRule')) for d in dates]);three_stats=summarize([reaction_return(prices,d,cfg['market'],meta['origin'],3,meta.get('reactionRule')) for d in dates])
        if one_stats:one_day_abs.append(one_stats['avgAbsMovePct'])
        markets[bkey]={'label':cfg['label'],'oneDay':one_stats,'threeDay':three_stats,'bias':bias_label(one_stats)}
      score=max(one_day_abs) if one_day_abs else None
      event_types[key]={'label':meta['label'],'historySource':meta['historySource'],'reactionRule':meta.get('reactionRule'),'historicalEvents':len(dates),'impactScore':round(score,2) if score is not None else None,'impactLevel':impact_level(score),'markets':markets}
      if provenance.get(key):event_types[key]['dateProvenance']=provenance[key]
    return{'updatedAt':now.replace(microsecond=0).isoformat().replace('+00:00','Z'),'methodology':{'minimumDirectionalSample':8,'oneDayDefinition':'Close-to-close first reaction session','threeDayDefinition':'Close-to-close through third reaction session','indiaForUSEvents':'US and post-India-close global events are measured from the Indian event-day close to following Indian trading sessions. India post-close macro releases use the next Indian trading session.','disclaimer':'Historical frequency and movement are descriptive statistics, not a forecast or guarantee.'},'benchmarks':{k:{'label':v['label'],'priceSource':benchmark_sources.get(k),'points':len(benchmark_prices.get(k,{}))} for k,v in BENCHMARKS.items()},'eventTypes':event_types}

def main():
    now=datetime.now(timezone.utc);start_year=max(2018,now.year-8);by={k:[] for k in EVENT_TYPES};status={'history':{},'prices':{}};provenance={}
    for year in range(start_year,now.year+1):
      try:
        rows=parse_bls_history(fetch_text(BLS_YEAR_URL.format(year=year)))
        for r in rows:by.setdefault(r['key'],[]).append(r['date'])
        status['history'][f'bls_{year}']={'status':'ok','events':len(rows)}
      except Exception as exc:status['history'][f'bls_{year}']={'status':'error','error':str(exc)[:180]}
    try:
      rows=parse_fomc_history(fetch_text(FED_URL))
      for r in rows:by['fomc'].append(r['date'])
      status['history']['fomc']={'status':'ok','events':len(rows)}
    except Exception as exc:status['history']['fomc']={'status':'error','error':str(exc)[:180]}
    try:
      official,provenance=load_official_event_dates()
      for key,dates in official.items():by.setdefault(key,[]).extend(dates)
      status['history']['official_india_global']={'status':'ok','events':sum(len(v) for v in official.values())}
    except Exception as exc:status['history']['official_india_global']={'status':'error','error':str(exc)[:180]}
    prices={};sources={};start=date(start_year,1,1)
    for key,cfg in BENCHMARKS.items():
      try:
        p,s=fetch_benchmark_prices(cfg,start,now.date());prices[key]=p;sources[key]=s;status['prices'][key]={'status':'ok','source':s,'points':len(p)}
      except Exception as exc:status['prices'][key]={'status':'error','error':str(exc)[:220]}
    if not prices:
      print('No benchmark price source succeeded; keeping existing market-impact.json if present.');return
    result=build_analysis(by,prices,sources,now,provenance);result['status']=status;tmp=OUTPUT.with_suffix('.tmp');tmp.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n');tmp.replace(OUTPUT)
    print('Wrote',len(result['eventTypes']),'event-type analyses across',len(prices),'benchmarks')

if __name__=='__main__':main()
