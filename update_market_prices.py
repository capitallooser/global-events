#!/usr/bin/env python3
import json, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/'market-prices.json'

INSTRUMENTS={
 'nifty':('NIFTY 50',['^NSEI']),
 'banknifty':('Bank NIFTY',['^NSEBANK']),
 'sensex':('Sensex',['^BSESN']),
 'gift_nifty':('GIFT Nifty',['^NSEIFSC','NIFTY50-USD.NS']),
 'sp500':('S&P 500',['^GSPC']),
 'nasdaq':('Nasdaq Composite',['^IXIC']),
 'gold':('Gold',['GC=F']),
 'usdinr':('USD/INR',['INR=X']),
 'bitcoin':('Bitcoin',['BTC-USD']),
}

def iso_from_ts(ts):
    return datetime.fromtimestamp(float(ts),timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')

def normalize_quote(key,label,price,previous_close,source_ts,source_name,now=None):
    now=now or datetime.now(timezone.utc)
    price=float(price); previous=float(previous_close) if previous_close not in (None,0) else None
    change=price-previous if previous is not None else None
    pct=(change/previous*100) if previous else None
    age=max(0,now.timestamp()-float(source_ts))
    status='Live' if age<=45*60 else ('Delayed' if age<=24*3600 else 'Last available')
    return {
      'key':key,'label':label,'price':round(price,4),
      'change':round(change,4) if change is not None else None,
      'changePct':round(pct,3) if pct is not None else None,
      'sourceTimestamp':iso_from_ts(source_ts),'sourceName':source_name,'status':status
    }

def unavailable_or_cached(key,label,cached,error):
    if cached and cached.get('price') is not None:
      row=dict(cached); row.update({'key':key,'label':label,'status':'Last available','error':str(error)[:180]}); return row
    return {'key':key,'label':label,'price':None,'change':None,'changePct':None,'sourceTimestamp':None,'sourceName':None,'status':'Unavailable','error':str(error)[:180]}

def fetch_text(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GlobalEventsDashboard/3.0'})
    with urllib.request.urlopen(req,timeout=20) as r: return r.read().decode('utf-8','replace')

def fetch_yahoo(symbol,key,label,now):
    encoded=urllib.parse.quote(symbol,safe='')
    url=f'https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?interval=5m&range=1d&includePrePost=true'
    payload=json.loads(fetch_text(url)); result=((payload.get('chart') or {}).get('result') or [None])[0]
    if not result: raise RuntimeError(f'no data for {symbol}')
    meta=result.get('meta') or {}; timestamps=result.get('timestamp') or []
    quote=((result.get('indicators') or {}).get('quote') or [{}])[0]
    closes=quote.get('close') or []
    pairs=[(t,c) for t,c in zip(timestamps,closes) if c is not None]
    if pairs: ts,price=pairs[-1]
    else:
      price=meta.get('regularMarketPrice'); ts=meta.get('regularMarketTime')
    prev=meta.get('chartPreviousClose') or meta.get('previousClose')
    if price is None or ts is None: raise RuntimeError(f'incomplete quote for {symbol}')
    return normalize_quote(key,label,price,prev,ts,'Yahoo Finance',now)

def main():
    now=datetime.now(timezone.utc)
    cached={}
    if OUTPUT.exists():
      try: cached={r.get('key'):r for r in json.loads(OUTPUT.read_text()).get('instruments',[])}
      except Exception: cached={}
    rows=[]; health={}
    for key,(label,symbols) in INSTRUMENTS.items():
      errors=[]; row=None
      for symbol in symbols:
        try:
          row=fetch_yahoo(symbol,key,label,now); health[key]={'status':'ok','symbol':symbol}; break
        except Exception as exc: errors.append(str(exc))
      if row is None:
        row=unavailable_or_cached(key,label,cached.get(key),'; '.join(errors)); health[key]={'status':'error','error':row.get('error')}
      rows.append(row)
    payload={'updatedAt':now.replace(microsecond=0).isoformat().replace('+00:00','Z'),'instruments':rows,'sourceHealth':health,
             'disclaimer':'Free/public market data may be delayed. This feed is not exchange-grade tick data.'}
    temp=OUTPUT.with_suffix('.tmp'); temp.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n'); temp.replace(OUTPUT)
    print('Wrote',len(rows),'market instruments')

if __name__=='__main__': main()
