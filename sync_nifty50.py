#!/usr/bin/env python3
import csv, io, json, re, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/'nifty50.json'
SOURCE='https://archives.nseindia.com/content/indices/ind_nifty50list.csv'

LEGAL_SUFFIX_RE=re.compile(r'\s+(?:limited|ltd\.?|ltd|plc)\.?$',re.I)

def _aliases(symbol,company):
    base=LEGAL_SUFFIX_RE.sub('',company).strip()
    values=[]
    for value in (symbol,company,base):
      if value and value.lower() not in {x.lower() for x in values}: values.append(value)
    return values

def parse_nifty50_csv(text):
    rows=[]; seen=set()
    for row in csv.DictReader(io.StringIO(text)):
      symbol=(row.get('Symbol') or row.get('SYMBOL') or '').strip().upper()
      company=(row.get('Company Name') or row.get('COMPANY NAME') or row.get('Company') or '').strip()
      industry=(row.get('Industry') or row.get('INDUSTRY') or '').strip()
      if not symbol or not company or symbol in seen: continue
      seen.add(symbol)
      rows.append({'symbol':symbol,'company':company,'industry':industry,'aliases':_aliases(symbol,company)})
    return rows

def fetch_text(url=SOURCE):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GlobalEventsMarketIntelligence/4.0','Accept':'text/csv,*/*'})
    with urllib.request.urlopen(req,timeout=30) as r:return r.read().decode('utf-8-sig','replace')

def main():
    now=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    text=fetch_text(); rows=parse_nifty50_csv(text)
    if len(rows)<40: raise RuntimeError(f'official NIFTY 50 source returned too few rows: {len(rows)}')
    payload={'updatedAt':now,'source':SOURCE,'constituents':rows}
    temp=OUTPUT.with_suffix('.tmp'); temp.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n'); temp.replace(OUTPUT)
    print('Wrote',len(rows),'NIFTY 50 constituents')

if __name__=='__main__':main()
