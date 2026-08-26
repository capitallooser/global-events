#!/usr/bin/env python3
import json, re, urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT/'historical-event-dates.json'

RBI_SOURCE_2024='https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=57540'
RBI_SOURCE_2025='https://www.rbi.org.in/scripts/PublicationsView.aspx?id=23139'
ECB_SOURCE='https://www.ecb.europa.eu/press/govcdec/mopo/html/index.en.html'
BOE_2024='https://www.bankofengland.co.uk/news/2022/december/mpc-dates-for-2024'
BOE_2025='https://www.bankofengland.co.uk/news/2024/september/monetary-policy-committee-dates-for-2025'
MOSPI_2024='https://mospi.gov.in/sites/default/files/Advance_Release_Calendar_16082024.pdf'
MOSPI_2025='https://new.mospi.gov.in/uploads/documents/documents/1763622194822-ARC%20updated%20till%20October%202025.pdf'
OEA_WPI='https://eaindustry.nic.in/wpi_press_release_archive.asp'

MONTHS={m.lower():i for i,m in enumerate(['January','February','March','April','May','June','July','August','September','October','November','December'],1)}
MONTHS.update({m[:3].lower():i for m,i in MONTHS.copy().items() if len(m)>3})

def fetch_text(url,timeout=30):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 GlobalEventsMarketIntelligence/4.0','Accept':'text/html,text/plain,*/*'})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read().decode('utf-8','replace')

def _row(key,d,source_name,source_url):
    return {'key':key,'date':d,'sourceName':source_name,'sourceUrl':source_url}

def _parse_date(day,month,year):
    return date(int(year),MONTHS[str(month).lower()[:3]],int(day)).isoformat()

def parse_rbi_schedule(text,source_url=RBI_SOURCE_2025):
    clean=' '.join(str(text).replace('\xa0',' ').split())
    rows=[]
    # Cross-month form: September 29-30 and October 1, 2025
    occupied=[]
    cross=re.compile(r'([A-Za-z]+)\s+(\d{1,2})-(\d{1,2})\s+and\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})',re.I)
    for m in cross.finditer(clean):
        try:d=_parse_date(m.group(5),m.group(4),m.group(6))
        except Exception:continue
        rows.append(_row('rbi_mpc',d,'Reserve Bank of India',source_url));occupied.append(m.span())
    simple=re.compile(r'([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})',re.I)
    for m in simple.finditer(clean):
        if any(a<=m.start()<b for a,b in occupied):continue
        if m.group(1).lower()[:3] not in MONTHS:continue
        try:d=_parse_date(m.group(3),m.group(1),m.group(4))
        except Exception:continue
        rows.append(_row('rbi_mpc',d,'Reserve Bank of India',source_url))
    return sorted({(r['key'],r['date']):r for r in rows}.values(),key=lambda r:r['date'])

def parse_ecb_archive(text,source_url=ECB_SOURCE):
    clean=' '.join(re.sub(r'<[^>]+>',' ',str(text)).replace('\xa0',' ').split())
    rows=[]
    # Require the date to be directly associated with the phrase Monetary policy decisions.
    pattern=re.compile(r'(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+Monetary policy decisions\b',re.I)
    for m in pattern.finditer(clean):
        try:d=_parse_date(m.group(1),m.group(2),m.group(3))
        except Exception:continue
        rows.append(_row('ecb_mpc',d,'European Central Bank',source_url))
    return sorted({r['date']:r for r in rows}.values(),key=lambda r:r['date'],reverse=True)

def parse_boe_calendar(text,year,source_url=BOE_2025):
    clean=' '.join(re.sub(r'<[^>]+>',' ',str(text)).replace('\xa0',' ').split())
    rows=[]
    # Announcement pages use e.g. Thursday 6 February ... MPC Summary and minutes.
    pattern=re.compile(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday)?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b(?=[^\d]{0,100}(?:MPC|Monetary Policy))',re.I)
    for m in pattern.finditer(clean):
        try:d=date(int(year),MONTHS[m.group(2).lower()],int(m.group(1))).isoformat()
        except Exception:continue
        rows.append(_row('boe_mpc',d,'Bank of England',source_url))
    return sorted({r['date']:r for r in rows}.values(),key=lambda r:r['date'])

def _classify_mospi(label):
    t=label.lower()
    if 'consumer price index' in t or re.search(r'\bcpi\b',t):return'india_cpi'
    if 'industrial production' in t or re.search(r'\biip\b',t):return'india_iip'
    if 'gross domestic product' in t or re.search(r'\bgdp\b',t):return'india_gdp'
    return None

def parse_mospi_calendar(text,source_url=MOSPI_2025):
    clean=' '.join(str(text).replace('\xa0',' ').split())
    month_marks=list(re.finditer(r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b',clean,re.I))
    rows=[]
    date_pat=re.compile(r'(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)?\b',re.I)
    for i,mark in enumerate(month_marks):
        month=MONTHS[mark.group(1).lower()];year=int(mark.group(2));start=mark.end();end=month_marks[i+1].start() if i+1<len(month_marks) else len(clean);section=clean[start:end]
        dates=list(date_pat.finditer(section))
        for j,dm in enumerate(dates):
            label=section[dm.end():(dates[j+1].start() if j+1<len(dates) else len(section))]
            key=_classify_mospi(label)
            if not key:continue
            try:d=date(year,month,int(dm.group(1))).isoformat()
            except ValueError:continue
            rows.append(_row(key,d,'Ministry of Statistics and Programme Implementation',source_url))
    return sorted({(r['key'],r['date']):r for r in rows}.values(),key=lambda r:(r['date'],r['key']))

# Curated dates below are copied from the cited official release calendars/schedules.
# They are intentionally narrow: no date is inferred from a generic monthly cadence.
RBI_OFFICIAL_TEXT={
 RBI_SOURCE_2024:'April 3-5, 2024 June 5-7, 2024 August 6-8, 2024 October 7-9, 2024 December 4-6, 2024 February 5-7, 2025',
 RBI_SOURCE_2025:'April 7-9, 2025 June 4-6, 2025 August 5-7, 2025 September 29-30 and October 1, 2025 December 3-5, 2025 February 4-6, 2026'
}

MOSPI_CURATED=[
 # 2024-25 official ARC
 ('india_gdp','2024-08-30',MOSPI_2024),('india_cpi','2024-09-12',MOSPI_2024),('india_cpi','2024-10-14',MOSPI_2024),
 ('india_cpi','2024-11-12',MOSPI_2024),('india_gdp','2024-11-29',MOSPI_2024),('india_cpi','2024-12-12',MOSPI_2024),
 ('india_gdp','2025-01-07',MOSPI_2024),('india_cpi','2025-01-13',MOSPI_2024),('india_iip','2025-01-10',MOSPI_2024),
 ('india_cpi','2025-02-12',MOSPI_2024),('india_iip','2025-02-12',MOSPI_2024),('india_gdp','2025-02-28',MOSPI_2024),
 # 2025-26 official ARC; use the recorded release date where the ARC states one.
 ('india_cpi','2025-04-15',MOSPI_2025),('india_iip','2025-04-28',MOSPI_2025),
 ('india_cpi','2025-05-13',MOSPI_2025),('india_iip','2025-05-28',MOSPI_2025),('india_gdp','2025-05-30',MOSPI_2025),
 ('india_cpi','2025-06-12',MOSPI_2025),('india_iip','2025-06-30',MOSPI_2025),
 ('india_cpi','2025-07-14',MOSPI_2025),('india_iip','2025-07-28',MOSPI_2025),
 ('india_cpi','2025-08-12',MOSPI_2025),('india_iip','2025-08-28',MOSPI_2025),('india_gdp','2025-08-29',MOSPI_2025),
 ('india_cpi','2025-09-12',MOSPI_2025),('india_iip','2025-09-29',MOSPI_2025),
 ('india_cpi','2025-10-13',MOSPI_2025),('india_iip','2025-10-28',MOSPI_2025),
 ('india_cpi','2025-11-12',MOSPI_2025),('india_gdp','2025-11-28',MOSPI_2025),('india_iip','2025-12-01',MOSPI_2025),
 ('india_cpi','2025-12-12',MOSPI_2025),('india_iip','2025-12-29',MOSPI_2025),
 ('india_gdp','2026-01-07',MOSPI_2025),('india_cpi','2026-01-12',MOSPI_2025),('india_iip','2026-01-28',MOSPI_2025),
 ('india_cpi','2026-02-12',MOSPI_2025),('india_gdp','2026-02-27',MOSPI_2025)
]

BOE_CURATED={
 BOE_2024:'Thursday 1 February MPC Summary and minutes Thursday 21 March MPC Summary and minutes Thursday 9 May MPC Summary and minutes Thursday 20 June MPC Summary and minutes Thursday 1 August MPC Summary and minutes Thursday 19 September MPC Summary and minutes Thursday 7 November MPC Summary and minutes Thursday 19 December MPC Summary and minutes',
 BOE_2025:'Thursday 6 February MPC Summary and minutes Thursday 20 March MPC Summary and minutes Thursday 8 May MPC Summary and minutes Thursday 19 June MPC Summary and minutes Thursday 7 August MPC Summary and minutes Thursday 18 September MPC Summary and minutes Thursday 6 November MPC Summary and minutes Thursday 18 December MPC Summary and minutes'
}

def curated_rows():
    rows=[]
    for url,text in RBI_OFFICIAL_TEXT.items():rows.extend(parse_rbi_schedule(text,url))
    for key,d,url in MOSPI_CURATED:rows.append(_row(key,d,'Ministry of Statistics and Programme Implementation',url))
    rows.extend(parse_boe_calendar(BOE_CURATED[BOE_2024],2024,BOE_2024))
    rows.extend(parse_boe_calendar(BOE_CURATED[BOE_2025],2025,BOE_2025))
    return rows

def main():
    now=datetime.now(timezone.utc).replace(microsecond=0);rows=curated_rows();health={
      'rbi':{'status':'ok','events':sum(r['key']=='rbi_mpc' for r in rows),'source':'Reserve Bank of India official schedules'},
      'mospi':{'status':'ok','events':sum(r['key'].startswith('india_') for r in rows),'source':'MoSPI official Advance Release Calendars'},
      'boe':{'status':'ok','events':sum(r['key']=='boe_mpc' for r in rows),'source':'Bank of England official MPC calendars'},
      'india_wpi':{'status':'unavailable','events':0,'source':OEA_WPI,'note':'No historical WPI dates are added until exact release dates are harvested from the official archive.'}
    }
    try:
        ecb=parse_ecb_archive(fetch_text(ECB_SOURCE),ECB_SOURCE)
        if not ecb:raise RuntimeError('no monetary-policy decision dates parsed')
        rows.extend(ecb);health['ecb']={'status':'ok','events':len(ecb),'source':'European Central Bank'}
    except Exception as exc:
        cached=[]
        if OUTPUT.exists():
            try:cached=[r for r in json.loads(OUTPUT.read_text()).get('rows',[]) if r.get('key')=='ecb_mpc']
            except Exception:cached=[]
        rows.extend(cached);health['ecb']={'status':'cached' if cached else 'error','events':len(cached),'error':str(exc)[:180]}
    unique={(r['key'],r['date']):r for r in rows if re.fullmatch(r'20\d{2}-\d{2}-\d{2}',r.get('date',''))}
    final=sorted(unique.values(),key=lambda r:(r['date'],r['key']))
    payload={'updatedAt':now.isoformat().replace('+00:00','Z'),'rows':final,'sourceHealth':health,
      'methodology':'Dates are included only when tied to an official central-bank or government release calendar/archive. Curated rows preserve the official source URL; uncertain dates are omitted.'}
    temp=OUTPUT.with_suffix('.tmp');temp.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n');temp.replace(OUTPUT)
    print('Wrote',len(final),'official historical event dates')

if __name__=='__main__':main()
