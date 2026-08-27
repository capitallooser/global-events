import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {collectNews} from './worker/src/news.mjs';
import {loadNiftyConstituents,annotateNewsWithNifty,buildNiftyInNews} from './worker/src/nifty.mjs';

export function buildNewsOutputs(newsResult,niftyResult,now=new Date()){
  const raw=Array.isArray(newsResult?.items)?newsResult.items:[];
  const constituents=Array.isArray(niftyResult?.constituents)?niftyResult.constituents:[];
  const items=annotateNewsWithNifty(raw,constituents);
  const niftyItems=buildNiftyInNews(items,constituents);
  const updatedAt=now.toISOString();
  return {
    news:{updatedAt,sourceHealth:newsResult?.sourceHealth||{},items},
    nifty:{updatedAt,source:niftyResult?.source||null,status:niftyResult?.status||'error',error:niftyResult?.error||null,items:niftyItems}
  };
}

export async function refreshNewsFiles(fetchImpl=fetch,now=new Date()){
  const [newsResult,niftyResult]=await Promise.all([
    collectNews(fetchImpl,now),
    loadNiftyConstituents(fetchImpl)
  ]);
  const out=buildNewsOutputs(newsResult,niftyResult,now);
  await Promise.all([
    fs.writeFile('news.json',JSON.stringify(out.news,null,2)+'\n'),
    fs.writeFile('nifty-in-news.json',JSON.stringify(out.nifty,null,2)+'\n')
  ]);
  console.log(`Wrote ${out.news.items.length} news stories and ${out.nifty.items.length} NIFTY 50 stock rows.`);
  return out;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  refreshNewsFiles().catch(error=>{console.error(error);process.exitCode=1;});
}
