const fmtDate=d=>new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});

function eventWords(e){return `${e.title||''} ${e.summary||''}`.toLowerCase()}
function relevantEvent(question,events){
  const q=question.toLowerCase();
  const aliases=[
    ['cpi',['consumer price index','cpi']],['fomc',['fomc','fed','federal reserve']],['nfp',['employment situation','nfp','jobs']],
    ['rbi',['rbi','monetary policy']],['election',['election','midterm','poll']]
  ];
  for(const [,terms] of aliases){
    if(terms.some(t=>q.includes(t))){
      const hit=events.find(e=>terms.some(t=>eventWords(e).includes(t))); if(hit) return hit;
    }
  }
  return events[0]||null;
}

function marketLine(impact, key, fallbackLabel){
  const m=impact?.markets?.[key]; const s=m?.oneDay;
  if(!s) return null;
  const direction=s.directionReady?`▲ ${s.upPct}% / ▼ ${s.downPct}%`:`sample ${s.sample}`;
  return `${m.label||fallbackLabel}: ${direction}; avg absolute 1-day move ±${s.avgAbsMovePct}%${s.sample?`; sample ${s.sample}`:''}.`;
}

function tomorrowEvents(context){
  const now=new Date(context.now||Date.now());
  const y=new Date(now.getTime()+86400000);
  const iso=y.toISOString().slice(0,10);
  return (context.events||[]).filter(e=>String(e.start).slice(0,10)===iso);
}

export function answerMarketQuestion(question,context={}){
  const q=(question||'').trim();
  const lower=q.toLowerCase();
  const disclaimer='Historical tendencies are descriptive statistics, not a forecast or guarantee of future market direction.';
  const evidence=[];

  if(/tomorrow/.test(lower)){
    const rows=tomorrowEvents(context);
    if(!rows.length) return {answer:'I do not see a scheduled high-impact event in the site data for tomorrow. Check the Calendar tab because newly announced events can still be added.',evidence,disclaimer};
    const ranked=[...rows].sort((a,b)=>((context.impactByEventId?.[b.id]?.impactScore)||0)-((context.impactByEventId?.[a.id]?.impactScore)||0));
    const e=ranked[0], impact=context.impactByEventId?.[e.id];
    evidence.push(`${e.title} · ${fmtDate(e.start)}`);
    const n=marketLine(impact,'nifty','NIFTY 50'); if(n) evidence.push(n);
    return {answer:`The main scheduled risk I can see for tomorrow is ${e.title}. ${n||'There is not enough mapped historical NIFTY data yet for this event.'}`,evidence,disclaimer};
  }

  if(/this week|week/.test(lower)){
    const now=new Date(context.now||Date.now()), end=new Date(now.getTime()+7*86400000);
    const rows=(context.events||[]).filter(e=>new Date(e.start)>=now&&new Date(e.start)<=end)
      .sort((a,b)=>((context.impactByEventId?.[b.id]?.impactScore)||0)-((context.impactByEventId?.[a.id]?.impactScore)||0)).slice(0,5);
    if(!rows.length) return {answer:'I do not see any upcoming events in the next seven days in the loaded site data.',evidence,disclaimer};
    rows.forEach(e=>evidence.push(`${e.title} · ${fmtDate(e.start)}`));
    return {answer:`The biggest scheduled risks in the next seven days are ${rows.map(e=>e.title).join(', ')}. Open Market Movers for their historical impact ranking.`,evidence,disclaimer};
  }

  const e=relevantEvent(lower,context.events||[]);
  if(e){
    const impact=context.impactByEventId?.[e.id];
    evidence.push(`${e.title} · ${fmtDate(e.start)}`);
    const n=marketLine(impact,'nifty','NIFTY 50');
    const s=marketLine(impact,'sp500','S&P 500');
    if(n) evidence.push(n); if(s) evidence.push(s);
    if(n||s){
      return {answer:`For ${e.title}, the site’s historical data shows ${[n,s].filter(Boolean).join(' ')}`,evidence,disclaimer};
    }
    return {answer:`${e.title} is in the calendar, but I do not have enough mapped historical reaction data to quantify its likely market move responsibly.`,evidence,disclaimer};
  }

  return {answer:'Ask me about upcoming risks, CPI, FOMC, RBI, elections, NIFTY, S&P 500, or which events matter most this week. I answer from the data already loaded on this site.',evidence,disclaimer};
}
