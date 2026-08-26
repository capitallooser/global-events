import {collectMarket} from './market.mjs';
import {collectNews} from './news.mjs';

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
  const [marketResult,newsResult]=await Promise.allSettled([
    collectMarket(fetchImpl,now),collectNews(fetchImpl,now)
  ]);
  if(marketResult.status==='fulfilled') base.market=marketResult.value;
  else base.market={instruments:[],sourceHealth:{market:{status:'error',error:String(marketResult.reason).slice(0,180)}}};
  if(newsResult.status==='fulfilled'){
    base.news=newsResult.value.items;
    base.sourceStatus.sources={...base.sourceStatus.sources,...Object.fromEntries(Object.entries(newsResult.value.sourceHealth).map(([k,v])=>[`news:${k}`,v]))};
  }else{
    base.sourceStatus.sources.news={status:'error',error:String(newsResult.reason).slice(0,180)};
  }
  return base;
}
