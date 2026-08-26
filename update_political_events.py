#!/usr/bin/env python3
import json, re, urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parent
EVENTS=ROOT/'events.json'
STATUS=ROOT/'source-status.json'
POLITICAL=ROOT/'political_events.json'
FEC_INFO='https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/'
ECI_BYE='https://www.eci.gov.in/bye-elections'

class TextExtractor(HTMLParser):
    def __init__(self): super().__init__(); self.parts=[]
    def handle_data(self,data):
        t=' '.join(data.split())
        if t: self.parts.append(t)
    def text(self): return '\n'.join(self.parts)

def fetch_text(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GlobalEventsDashboard/3.0','Accept':'text/html,*/*'})
    with urllib.request.urlopen(req,timeout=30) as r: return r.read().decode('utf-8','replace')

def html_text(html):
    p=TextExtractor(); p.feed(html); return p.text()

def slug(value):
    return re.sub(r'-+','-',''.join(c.lower() if c.isalnum() else '-' for c in value)).strip('-')

def make_election(title,date_iso,country,region,election_type,source_url,source_name,updated_at,importance='high',summary=None,event_id=None):
    return {
      'id':event_id or f'election-{country.lower()}-{date_iso}-{slug(title)[:60]}',
      'title':title,
      'start':f'{date_iso}T00:00:00Z','end':None,
      'country':country,'region':region,'category':'politics','importance':importance,
      'eventType':'election','electionType':election_type,
      'summary':summary or f'Scheduled {election_type.replace("_"," ")} election event in {region}.',
      'sourceName':source_name,'sourceUrl':source_url,'updatedAt':updated_at
    }

def seed_events(updated_at):
    return [
      make_election(
        'U.S. Federal General Election / Midterm Election','2026-11-03','US','United States','federal_general',
        FEC_INFO,'Federal Election Commission',updated_at,'high',
        'The next regularly scheduled U.S. federal General Election date. Congressional elections on this date determine the composition of the 120th Congress.',
        'us-federal-general-election-2026'
      )
    ]

def merge_by_id(existing,new):
    out={e.get('id'):e for e in existing if e.get('id')}
    for e in new:
        if e.get('id'): out[e['id']]=e
    return sorted(out.values(),key=lambda e:(e.get('start',''),e.get('title','')))

MONTHS={m.lower():i for i,m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'],1)}
def parse_date_phrase(day,month,year):
    return f'{int(year):04d}-{MONTHS[month.lower()]:02d}-{int(day):02d}'

def extract_eci_bye_elections(text,updated_at):
    blocks=re.split(r'(?=Schedule for (?:B|b)ye-?elections?[^\n]*)',text)
    rows=[]
    for block in blocks:
        if not re.search(r'bye-?election',block,re.I): continue
        title_match=re.search(r'(Schedule for (?:B|b)ye-?elections?[^\n]{0,220})',block)
        title=(title_match.group(1).strip() if title_match else 'India Assembly Bye-elections')
        def extract_date(label):
            named=re.search(rf'{label}\s*:?\s*(\d{{1,2}})[-\s]+([A-Za-z]+)[-\s,]+(\d{{4}})',block,re.I)
            if named:
                try: return parse_date_phrase(*named.groups())
                except Exception: return None
            numeric=re.search(rf'{label}\s*:?\s*(\d{{1,2}})[-/.](\d{{1,2}})[-/.](\d{{4}})',block,re.I)
            if numeric:
                day,month,year=numeric.groups()
                try: return f'{int(year):04d}-{int(month):02d}-{int(day):02d}'
                except Exception: return None
            return None
        for kind,iso in [('bye_election',extract_date('Date of Poll')),('counting',extract_date('Date of Counting'))]:
            if not iso: continue
            label='India Bye-election Poll' if kind=='bye_election' else 'India Bye-election Counting / Results'
            rows.append(make_election(label,iso,'IN','India',kind,ECI_BYE,'Election Commission of India',updated_at,'high',title))
    return rows

def extract_fec_special_elections(text,updated_at):
    rows=[]
    date_re=re.compile(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})',re.I)
    lines=[x.strip() for x in text.splitlines() if x.strip()]
    for i,line in enumerate(lines):
        context=' '.join(lines[max(0,i-2):min(len(lines),i+3)])
        if 'special election' not in context.lower(): continue
        for m in date_re.finditer(context):
            month,day,year=m.groups(); iso=f'{year}-{MONTHS[month.lower()]:02d}-{int(day):02d}'
            rows.append(make_election('U.S. Special Election',iso,'US','United States','special',FEC_INFO,'Federal Election Commission',updated_at,'high',context[:280]))
    return rows

def main():
    now=datetime.now(timezone.utc); updated_at=now.replace(microsecond=0).isoformat().replace('+00:00','Z')
    rows=seed_events(updated_at); source_status={}
    try:
        eci=extract_eci_bye_elections(html_text(fetch_text(ECI_BYE)),updated_at)
        rows.extend(eci); source_status['india_elections']={'status':'ok','events':len(eci),'source':'Election Commission of India'}
    except Exception as exc:
        source_status['india_elections']={'status':'error','events':0,'error':str(exc)[:200]}
    try:
        fec_text=html_text(fetch_text(FEC_INFO)); fec=extract_fec_special_elections(fec_text,updated_at)
        rows.extend(fec); source_status['us_elections']={'status':'ok','events':len(fec)+1,'source':'Federal Election Commission'}
    except Exception as exc:
        source_status['us_elections']={'status':'error','events':1,'error':str(exc)[:200]}
    rows=merge_by_id([],rows)
    POLITICAL.write_text(json.dumps({'updatedAt':updated_at,'events':rows,'sources':source_status},indent=2,ensure_ascii=False)+'\n')
    existing=json.loads(EVENTS.read_text()) if EVENTS.exists() else []
    future=[e for e in rows if e['start'][:10]>=now.date().isoformat()]
    EVENTS.write_text(json.dumps(merge_by_id(existing,future),indent=2,ensure_ascii=False)+'\n')
    status=json.loads(STATUS.read_text()) if STATUS.exists() else {'updatedAt':updated_at,'eventCount':len(existing),'sources':{}}
    status.setdefault('sources',{}).update(source_status)
    status['eventCount']=len(json.loads(EVENTS.read_text()))
    STATUS.write_text(json.dumps(status,indent=2,ensure_ascii=False)+'\n')
    print(f'Political events: {len(rows)}; future merged: {len(future)}')

if __name__=='__main__': main()
