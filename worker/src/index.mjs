import {refreshSnapshot} from './snapshot.mjs';

const ALLOWED_ORIGIN='https://capitallooser.github.io';
const CACHE_KEY=new Request('https://global-events-live.cache/api/snapshot');

function jsonResponse(payload,status=200){
  return new Response(JSON.stringify(payload),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'access-control-allow-origin':ALLOWED_ORIGIN,
      'vary':'Origin'
    }
  });
}

async function buildAndCache(fetchImpl=fetch,now=new Date()){
  const payload=await refreshSnapshot(fetchImpl,now);
  const response=jsonResponse(payload);
  await caches.default.put(CACHE_KEY,response.clone());
  return response;
}

export default {
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname!='/api/snapshot') return jsonResponse({error:'Not found'},404);
    const cached=await caches.default.match(CACHE_KEY);
    if(cached) return cached;
    return buildAndCache(fetch,new Date());
  },
  async scheduled(controller,env,ctx){
    void controller; void env;
    ctx.waitUntil(buildAndCache(fetch,new Date()));
  }
};
