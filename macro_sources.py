#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
EVENTS=ROOT/'events.json'; STATUS=ROOT/'source-status.json'
MOSPI_ARC='https://www.mospi.gov.in/uploads/documents/releaseCalender/1779709510470-ADVANCE%20RELEASE%20CALENDAR%202026-27%20Updated%2025.05.2026.pdf'
OEA='https://eaindustry.nic.in/'

def event(event_key,title,date_iso,source_url,source_name,updated_at,summary,importance='high'):
    return {
      'id':f'{event_key}-{date_iso}','title':title,'start':f'{date_iso}T06:30:00Z','end':None,
      'country':'IN','region':'India','category':'economic','importance':importance,
      'eventKey':event_key,'summary':summary,'sourceName':source_name,'sourceUrl':source_url,'updatedAt':updated_at
    }

def india_macro_events(updated_at):
    rows=[]
    cpi=['2026-09-12','2026-10-12','2026-11-12','2026-12-12','2027-01-12','2027-02-12']
    iip=['2026-08-28','2026-09-28','2026-10-28','2026-11-28','2026-12-28','2027-01-28']
    gdp=[('2026-08-31','Quarterly Estimates of GDP for Q1, FY 2026-27'),('2026-11-30','Quarterly Estimates of GDP for Q2, FY 2026-27'),('2027-01-07','First Advance Estimates of GDP for FY 2026-27'),('2027-02-26','Second Advance / Q3 GDP Estimates')]
    for d in cpi:
      rows.append(event('india_cpi','India Consumer Price Index (CPI)',d,MOSPI_ARC,'Ministry of Statistics and Programme Implementation',updated_at,'Scheduled All India CPI release from the official Advance Release Calendar.'))
    for d in iip:
      rows.append(event('india_iip','India Index of Industrial Production (IIP)',d,MOSPI_ARC,'Ministry of Statistics and Programme Implementation',updated_at,'Scheduled All India IIP release from the official Advance Release Calendar.'))
    for d,title in gdp:
      rows.append(event('india_gdp',f'India GDP — {title}',d,MOSPI_ARC,'Ministry of Statistics and Programme Implementation',updated_at,'Scheduled GDP release from the official Advance Release Calendar.'))
    for d in ['2026-09-15','2026-10-15','2026-11-15','2026-12-15','2027-01-15','2027-02-15']:
      rows.append(event('india_wpi','India Wholesale Price Index (WPI)',d,OEA,'Office of the Economic Adviser',updated_at,'Scheduled monthly Wholesale Price Index release.',importance='high'))
    return rows

def merge(existing,new):
    by={e.get('id'):e for e in existing if e.get('id')}
    for e in new: by[e['id']]=e
    return sorted(by.values(),key=lambda e:(e.get('start',''),e.get('title','')))

def main():
    now=datetime.now(timezone.utc); updated=now.replace(microsecond=0).isoformat().replace('+00:00','Z')
    rows=[e for e in india_macro_events(updated) if e['start'][:10]>=now.date().isoformat()]
    existing=json.loads(EVENTS.read_text()) if EVENTS.exists() else []
    merged=merge(existing,rows); EVENTS.write_text(json.dumps(merged,indent=2,ensure_ascii=False)+'\n')
    status=json.loads(STATUS.read_text()) if STATUS.exists() else {'updatedAt':updated,'sources':{}}
    status.setdefault('sources',{})['india_macro_calendar']={'status':'ok','events':len(rows),'source':'MoSPI/OEA official schedules'}
    status['eventCount']=len(merged); STATUS.write_text(json.dumps(status,indent=2,ensure_ascii=False)+'\n')
    print('Merged India macro events:',len(rows))

if __name__=='__main__': main()
