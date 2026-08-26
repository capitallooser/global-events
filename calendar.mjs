const IMPACT_RANK={very_high:4,high:3,medium:2,low:1,no_history:0};
const IMPORTANCE_RANK={high:3,medium:2,low:1};

export function scoreEvent(event, impactLookup=()=>null){
  const impact=impactLookup(event)||{};
  const numeric=Number.isFinite(impact.impactScore)?impact.impactScore:-1;
  const impactRank=IMPACT_RANK[impact.impactLevel]??0;
  const importance=IMPORTANCE_RANK[event.importance]??0;
  return {numeric,impactRank,importance};
}

export function rankEvents(events, impactLookup=()=>null){
  return [...events].sort((a,b)=>{
    const A=scoreEvent(a,impactLookup), B=scoreEvent(b,impactLookup);
    return (B.numeric-A.numeric)||(B.impactRank-A.impactRank)||(B.importance-A.importance)||(new Date(a.start)-new Date(b.start));
  });
}

export function topMovers(events, impactLookup=()=>null, count=5){
  return rankEvents(events,impactLookup).slice(0,count);
}

export function dayHeat(events, impactLookup=()=>null){
  if(!events.length) return 'none';
  const ranked=rankEvents(events,impactLookup);
  const top=scoreEvent(ranked[0],impactLookup);
  if(top.impactRank>=4) return 'very_high';
  if(top.impactRank>=3) return 'high';
  if(top.impactRank>=2) return 'medium';
  if(top.impactRank>=1) return 'low';
  if(top.importance>=3) return 'high';
  if(top.importance>=2) return 'medium';
  return 'low';
}

function isoLocal(y,m,d){
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export function buildMonthModel(events,year,month,impactLookup=()=>null){
  const first=new Date(Date.UTC(year,month,1));
  const firstDow=first.getUTCDay();
  const gridStart=new Date(Date.UTC(year,month,1-firstDow));
  const byDate=new Map();
  for(const event of events){
    const iso=String(event.start||'').slice(0,10);
    if(!iso) continue;
    if(!byDate.has(iso)) byDate.set(iso,[]);
    byDate.get(iso).push(event);
  }
  const cells=[];
  for(let i=0;i<42;i++){
    const d=new Date(gridStart.getTime()+i*86400000);
    const iso=isoLocal(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
    const dayEvents=rankEvents(byDate.get(iso)||[],impactLookup);
    cells.push({
      iso,
      day:d.getUTCDate(),
      inMonth:d.getUTCMonth()===month,
      events:dayEvents,
      heat:dayHeat(dayEvents,impactLookup)
    });
  }
  return {year,month,cells};
}
