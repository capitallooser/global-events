import {collectMarket} from './market.mjs';

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
  try{base.market=await collectMarket(fetchImpl,now);}catch(error){
    base.market={instruments:[],sourceHealth:{market:{status:'error',error:String(error).slice(0,180)}}};
  }
  return base;
}
