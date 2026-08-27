import {collectMarket} from './market.mjs';
import {collectNews} from './news.mjs';
import {loadNiftyConstituents,annotateNewsWithNifty,buildNiftyInNews} from './nifty.mjs';
import {collectStaticData} from './static-data.mjs';

export const REFRESH_MS=60000;

export function emptySnapshot(updatedAt=new Date().toISOString()){
  return {
    updatedAt,
    market:{instruments:[],sourceHealth:{}},
    news:[],
    niftyInNews:[],
    events:[],
    impact:{eventTypes:{}},
    surprises:{events:{}},
    alerts:{sent:{}},
    sourceStatus:{sources:{}}
  };
}

function mergeSourceHealth(target,prefix,health={}){
  for(const [key,value] of Object.entries(health||{}))target[`${prefix}:${key}`]=value;
}

export async function refreshSnapshot(fetchImpl=fetch,now=new Date()){
  const base=emptySnapshot(now.toISOString());
  const [marketResult,newsResult,niftyResult,staticResult]=await Promise.allSettled([
    collectMarket(fetchImpl,now),collectNews(fetchImpl,now),loadNiftyConstituents(fetchImpl),collectStaticData(fetchImpl)
  ]);

  if(staticResult.status==='fulfilled'){
    const s=staticResult.value;
    base.events=Array.isArray(s.events)?s.events:[];
    base.impact=s.impact||{eventTypes:{}};
    base.surprises=s.surprises||{events:{}};
    base.alerts=s.alerts||{sent:{}};
    base.sourceStatus=s.sourceStatus||{sources:{}};
    base.sourceStatus.sources={...(base.sourceStatus.sources||{})};
    mergeSourceHealth(base.sourceStatus.sources,'static',s.sourceHealth);
  }else{
    base.sourceStatus.sources.static={status:'error',error:String(staticResult.reason).slice(0,180)};
  }

  if(marketResult.status==='fulfilled'){
    base.market=marketResult.value;
    mergeSourceHealth(base.sourceStatus.sources,'market',marketResult.value.sourceHealth);
  }else{
    base.market={instruments:[],sourceHealth:{market:{status:'error',error:String(marketResult.reason).slice(0,180)}}};
    base.sourceStatus.sources.market={status:'error',error:String(marketResult.reason).slice(0,180)};
  }

  let rawNews=[];
  if(newsResult.status==='fulfilled'){
    rawNews=newsResult.value.items;
    mergeSourceHealth(base.sourceStatus.sources,'news',newsResult.value.sourceHealth);
  }else base.sourceStatus.sources.news={status:'error',error:String(newsResult.reason).slice(0,180)};

  let constituents=[];
  if(niftyResult.status==='fulfilled'){
    constituents=niftyResult.value.constituents||[];
    base.sourceStatus.sources.nifty50={status:niftyResult.value.status==='ok'?'ok':niftyResult.value.status,source:niftyResult.value.source,error:niftyResult.value.error};
  }else base.sourceStatus.sources.nifty50={status:'error',error:String(niftyResult.reason).slice(0,180)};

  base.news=annotateNewsWithNifty(rawNews,constituents);
  base.niftyInNews=buildNiftyInNews(base.news,constituents);
  return base;
}
