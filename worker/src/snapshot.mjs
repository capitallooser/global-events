import {collectMarket} from './market.mjs';
import {collectNews} from './news.mjs';
import {loadNiftyConstituents,annotateNewsWithNifty,buildNiftyInNews} from './nifty.mjs';

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

export async function refreshSnapshot(fetchImpl=fetch,now=new Date()){
  const base=emptySnapshot(now.toISOString());
  const [marketResult,newsResult,niftyResult]=await Promise.allSettled([
    collectMarket(fetchImpl,now),collectNews(fetchImpl,now),loadNiftyConstituents(fetchImpl)
  ]);
  if(marketResult.status==='fulfilled') base.market=marketResult.value;
  else base.market={instruments:[],sourceHealth:{market:{status:'error',error:String(marketResult.reason).slice(0,180)}}};

  let rawNews=[];
  if(newsResult.status==='fulfilled'){
    rawNews=newsResult.value.items;
    base.sourceStatus.sources={...base.sourceStatus.sources,...Object.fromEntries(Object.entries(newsResult.value.sourceHealth).map(([k,v])=>[`news:${k}`,v]))};
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
