const LEVEL_RANK={very_high:4,high:3,medium:2,low:1};

export function filterNews(items,filters={}){
  const mode=filters.mode||'all';
  const region=filters.region||'all';
  const relevance=filters.relevance||'all';
  const category=filters.category||'all';
  const source=filters.source||'all';
  const niftyOnly=!!filters.niftyOnly;
  const query=String(filters.query||'').trim().toLowerCase();
  return (items||[]).filter(item=>{
    if(mode==='overview'&&!['very_high','high'].includes(item.relevanceLevel))return false;
    if(region!=='all'&&item.region!==region)return false;
    if(relevance!=='all'&&item.relevanceLevel!==relevance)return false;
    if(category!=='all'&&item.category!==category)return false;
    if(source!=='all'&&item.source!==source)return false;
    if(niftyOnly&&!(item.matchedStocks||[]).length)return false;
    if(query&&!`${item.title||''} ${item.reason||''} ${item.source||''}`.toLowerCase().includes(query))return false;
    return true;
  });
}

export function groupNiftyNews(rows){
  return [...(rows||[])].sort((a,b)=>
    (Number(b.relevanceScore)||0)-(Number(a.relevanceScore)||0)||
    (LEVEL_RANK[b.relevanceLevel]||0)-(LEVEL_RANK[a.relevanceLevel]||0)||
    new Date(b.publishedAt||0)-new Date(a.publishedAt||0)
  );
}
