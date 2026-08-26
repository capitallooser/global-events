#!/usr/bin/env python3
import json, re, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/'market-prices.json'
IST=timezone(timedelta(hours=5,minutes=30))
NSEIX_HOMES=('https://www.nseix.com/','https://www1.nseix.com/')

def _nseix_source_time(compact,now):
    as_on=re.search(
        r'As\s+on\s+([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*IST',
        compact,re.I
    )
    if as_on:
        month,day,year,hour,minute,second=as_on.groups()
        return datetime.strptime(
            f'{day}-{month}-{year} {hour}:{minute}:{second or "00"}',
            '%d-%b-%Y %H:%M:%S'
        ).replace(tzinfo=IST).astimezone(timezone.utc)
    day_only=re.search(r'Date\s*:\s*(\d{1,2}-[A-Za-z]{3}-\d{4})',compact,re.I)
    if day_only:
        # The page exposes a trading date even when its near-month tile has no quote time.
        # Represent that date conservatively at midnight IST and never label it Live.
        return datetime.strptime(day_only.group(1),'%d-%b-%Y').replace(tzinfo=IST).astimezone(timezone.utc)
    return now

def _nseix_status(source_time,now,force_delayed=False):
    age=max(0,(now-source_time).total_seconds())
    if age>24*3600:return 'Last available'
    if force_delayed:return 'Delayed'
    return 'Live' if age<=45*60 else 'Delayed'

def parse_nseix_gift(text,now=None):
    now=now or datetime.now(timezone.utc)
    compact=' '.join(text.split())

    # Primary official tile: "Intra Day Price – Near month GIFT NIFTY Future".
    near_month=re.search(
        r'Intra\s+Day\s+Price\s*[-–—]\s*Near\s+month\s+GIFT\s+NIFTY\s+Future\s+'
        r'([0-9][0-9,]*(?:\.\d+)?)\s+([+-]?[0-9][0-9,]*(?:\.\d+)?)\s*'
        r'\(([+-]?\d+(?:\.\d+)?)%\)',
        compact,re.I
    )
    if near_month:
        price=float(near_month.group(1).replace(',',''))
        change=float(near_month.group(2).replace(',',''))
        pct=float(near_month.group(3))
        source_time=_nseix_source_time(compact,now)
        return {
            'key':'gift_nifty','label':'GIFT Nifty','price':round(price,4),
            'change':round(change,4),'changePct':round(pct,3),
            'sourceTimestamp':source_time.replace(microsecond=0).isoformat().replace('+00:00','Z'),
            'sourceName':'NSE IX','status':_nseix_status(source_time,now,force_delayed=True)
        }

    # Fallback for the headline GIFT Nifty block used by some NSE IX page variants.
    headline=re.search(
        r'(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*'
        r'\(([+-]?\d+(?:\.\d+)?)%\).*?Current Day.*?Date\s*:\s*'
        r'(\d{1,2}-[A-Za-z]{3}-\d{4})',
        compact,re.I
    )
    if not headline:raise RuntimeError('unable to parse GIFT Nifty from NSE IX')
    price=float(headline.group(1).replace(',',''));change=float(headline.group(2));pct=float(headline.group(3))
    source_time=_nseix_source_time(compact,now)
    return {
        'key':'gift_nifty','label':'GIFT Nifty','price':round(price,4),
        'change':round(change,4),'changePct':round(pct,3),
        'sourceTimestamp':source_time.replace(microsecond=0).isoformat().replace('+00:00','Z'),
        'sourceName':'NSE IX','status':_nseix_status(source_time,now,force_delayed=True)
    }

INSTRUMENTS={
 'nifty':('NIFTY 50',['^NSEI']),'banknifty':('Bank NIFTY',['^NSEBANK']),'sensex':('Sensex',['^BSESN']),
 'gift_nifty':('GIFT Nifty',['^NSEIFSC','NIFTY50-USD.NS']),'sp500':('S&P 500',['^GSPC']),
 'nasdaq':('Nasdaq Composite',['^IXIC']),'gold':('Gold',['GC=F']),'usdinr':('USD/INR',['INR=X']),'bitcoin':('Bitcoin',['BTC-USD'])}

def iso_from_ts(ts):return datetime.fromtimestamp(float(ts),timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
def normalize_quote(key,label,price,previous_close,source_ts,source_name,now=None):
    now=now or datetime.now(timezone.utc);price=float(price);previous=float(previous_close) if previous_close not in (None,0) else None
    change=price-previous if previous is not None else None;pct=(change/previous*100) if previous else None;age=max(0,now.timestamp()-float(source_ts))
    status='Live' if age<=45*60 else ('Delayed' if age<=24*3600 else 'Last available')
    return {'key':key,'label':label,'price':round(price,4),'change':round(change,4) if change is not None else None,'changePct':round(pct,3) if pct is not None else None,'sourceTimestamp':iso_from_ts(source_ts),'sourceName':source_name,'status':status}
def unavailable_or_cached(key,label,cached,error):
    if cached and cached.get('price') is not None:
      row=dict(cached);row.update({'key':key,'label':label,'status':'Last available','error':str(error)[:180]});return row
    return {'key':key,'label':label,'price':None,'change':None,'changePct':None,'sourceTimestamp':None,'sourceName':None,'status':'Unavailable','error':str(error)[:180]}
def fetch_text(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GlobalEventsDashboard/3.0','Accept':'text/html,application/json,*/*'})
    with urllib.request.urlopen(req,timeout=20) as r:return r.read().decode('utf-8','replace')
def fetch_yahoo(symbol,key,label,now):
    encoded=urllib.parse.quote(symbol,safe='');url=f'https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=5m&range=1d&includePrePost=true'
    payload=json.loads(fetch_text(url));result=((payload.get('chart') or {}).get('result') or [None])[0]
    if not result:raise RuntimeError(f'no data for {symbol}')
    meta=result.get('meta') or {};timestamps=result.get('timestamp') or [];quote=((result.get('indicators') or {}).get('quote') or [{}])[0];closes=quote.get('close') or [];pairs=[(t,c) for t,c in zip(timestamps,closes) if c is not None]
    if pairs:ts,price=pairs[-1]
    else:price=meta.get('regularMarketPrice');ts=meta.get('regularMarketTime')
    prev=meta.get('chartPreviousClose') or meta.get('previousClose')
    if price is None or ts is None:raise RuntimeError(f'incomplete quote for {symbol}')
    return normalize_quote(key,label,price,prev,ts,'Yahoo Finance',now)
def main():
    now=datetime.now(timezone.utc);cached={}
    if OUTPUT.exists():
      try:cached={r.get('key'):r for r in json.loads(OUTPUT.read_text()).get('instruments',[])}
      except Exception:cached={}
    rows=[];health={}
    for key,(label,symbols) in INSTRUMENTS.items():
      errors=[];row=None
      for symbol in symbols:
        try:row=fetch_yahoo(symbol,key,label,now);health[key]={'status':'ok','symbol':symbol};break
        except Exception as exc:errors.append(str(exc))
      if row is None and key=='gift_nifty':
        for home in NSEIX_HOMES:
          try:
            raw=fetch_text(home);plain=re.sub(r'<[^>]+>',' ',raw);row=parse_nseix_gift(plain,now);health[key]={'status':'ok','symbol':home};break
          except Exception as exc:errors.append(f'NSE IX {home}: {exc}')
      if row is None:
        row=unavailable_or_cached(key,label,cached.get(key),'; '.join(errors));health[key]={'status':'error','error':row.get('error')}
      rows.append(row)
    payload={'updatedAt':now.replace(microsecond=0).isoformat().replace('+00:00','Z'),'instruments':rows,'sourceHealth':health,'disclaimer':'Free/public market data may be delayed. This feed is not exchange-grade tick data.'}
    temp=OUTPUT.with_suffix('.tmp');temp.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n');temp.replace(OUTPUT);print('Wrote',len(rows),'market instruments')
if __name__=='__main__':main()
