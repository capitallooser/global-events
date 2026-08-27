const BASE='https://capitallooser.github.io/global-events/';

export const STATIC_DATASETS={
  events:{file:'events.json',fallback:[]},
  impact:{file:'market-impact.json',fallback:{eventTypes:{}}},
  surprises:{file:'surprises.json',fallback:{events:{}}},
  sourceStatus:{file:'source-status.json',fallback:{sources:{}}},
  alerts:{file:'alert-state.json',fallback:{sent:{}}}
};

async function fetchJson(fetchImpl,url){
  const response=await fetchImpl(url,{headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`${response.status} ${response.statusText||'fetch failed'}`);
  return response.json();
}

function clone(value){return JSON.parse(JSON.stringify(value));}

export async function collectStaticData(fetchImpl=fetch){
  const entries=Object.entries(STATIC_DATASETS);
  const settled=await Promise.allSettled(entries.map(([,cfg])=>fetchJson(fetchImpl,`${BASE}${cfg.file}`)));
  const out={sourceHealth:{}};
  entries.forEach(([key,cfg],index)=>{
    const result=settled[index];
    if(result.status==='fulfilled'){
      out[key]=result.value;
      out.sourceHealth[key]={status:'ok',file:cfg.file};
    }else{
      out[key]=clone(cfg.fallback);
      out.sourceHealth[key]={status:'error',file:cfg.file,error:String(result.reason).slice(0,180)};
    }
  });
  if(!out.surprises||typeof out.surprises!=='object')out.surprises={events:{}};
  if(!out.surprises.events)out.surprises={...out.surprises,events:{}};
  if(!out.sourceStatus||typeof out.sourceStatus!=='object')out.sourceStatus={sources:{}};
  if(!out.sourceStatus.sources)out.sourceStatus={...out.sourceStatus,sources:{}};
  if(!out.alerts||typeof out.alerts!=='object')out.alerts={sent:{}};
  if(!out.alerts.sent)out.alerts={...out.alerts,sent:{}};
  return out;
}
