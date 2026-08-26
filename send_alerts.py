#!/usr/bin/env python3
import json, os, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT=Path(__file__).resolve().parent
EVENTS=ROOT/'events.json'; IMPACT=ROOT/'market-impact.json'; STATE=ROOT/'alert-state.json'
IST=timezone(timedelta(hours=5,minutes=30))

def parse_dt(value): return datetime.fromisoformat(value.replace('Z','+00:00'))
def format_ist(value): return parse_dt(value).astimezone(IST).strftime('%d %b %Y %I:%M %p IST')
def alert_key(event,kind): return f"{event['id']}|{kind}|{event['start']}"
def should_alert(event,impact,now=None,lead_hours=3):
    now=now or datetime.now(timezone.utc)
    if (impact or {}).get('impactLevel')!='very_high': return False
    try: delta=(parse_dt(event['start'])-now).total_seconds()/3600
    except Exception: return False
    return 0<=delta<=lead_hours

def market_line(impact,key):
    m=(impact or {}).get('markets',{}).get(key) or {}; s=m.get('oneDay') or {}
    if not s: return None
    direction=f"▲ {s.get('upPct')}% / ▼ {s.get('downPct')}%" if s.get('directionReady') else f"sample {s.get('sample')}"
    return f"{m.get('label',key)}: {direction}; avg 1D move ±{s.get('avgAbsMovePct')}%"

def build_message(event,impact):
    lines=['🔴 VERY HIGH IMPACT','',event['title'],format_ist(event['start'])]
    for key in ('nifty','sp500'):
      line=market_line(impact,key)
      if line: lines+=['',line]
    lines+=['','Historical tendency only — not a forecast.']
    return '\n'.join(lines)

def send_telegram(token,chat_id,text):
    data=urllib.parse.urlencode({'chat_id':chat_id,'text':text}).encode()
    req=urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage',data=data,method='POST')
    with urllib.request.urlopen(req,timeout=20) as r:
      payload=json.loads(r.read().decode())
    if not payload.get('ok'): raise RuntimeError('Telegram send failed')

def main():
    token=os.getenv('TELEGRAM_BOT_TOKEN'); chat=os.getenv('TELEGRAM_CHAT_ID')
    if not token or not chat:
      print('Telegram secrets are not configured; no alert sent.')
      return
    events=json.loads(EVENTS.read_text()) if EVENTS.exists() else []
    impact_payload=json.loads(IMPACT.read_text()) if IMPACT.exists() else {'eventTypes':{}}
    sent={}
    if STATE.exists():
      try: sent=json.loads(STATE.read_text()).get('sent',{})
      except Exception: sent={}
    def key_for(e):
      if e.get('eventKey'): return e.get('eventKey')
      t=(e.get('title','')+' '+e.get('summary','')).lower()
      if 'fomc' in t or 'federal open market committee' in t: return 'fomc'
      if 'consumer price index' in t and e.get('country')=='US': return 'us_cpi'
      if 'employment situation' in t: return 'us_nfp'
      if 'producer price index' in t and e.get('country')=='US': return 'us_ppi'
      if 'job openings and labor turnover' in t: return 'us_jolts'
      if 'employment cost index' in t: return 'us_eci'
      return None
    now=datetime.now(timezone.utc); changed=False
    for event in events:
      k=key_for(event); impact=(impact_payload.get('eventTypes') or {}).get(k) if k else None
      if not should_alert(event,impact,now,3): continue
      akey=alert_key(event,'lead-3h')
      if akey in sent: continue
      send_telegram(token,chat,build_message(event,impact))
      sent[akey]=now.replace(microsecond=0).isoformat().replace('+00:00','Z'); changed=True
    if changed:
      STATE.write_text(json.dumps({'updatedAt':now.replace(microsecond=0).isoformat().replace('+00:00','Z'),'sent':sent},indent=2)+'\n')

if __name__=='__main__': main()
