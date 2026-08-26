
export const categories=["economic","central_bank","politics","holiday","earnings","ipo","crypto","sports","geopolitical","other"];
export function validateEvent(e){
 return !!(e&&e.id&&e.title&&e.start&&e.country&&e.region&&categories.includes(e.category)&&
 ["high","medium","low"].includes(e.importance)&&e.sourceName&&/^https:\/\//.test(e.sourceUrl||"")&&e.updatedAt);
}
const key=e=>`${e.title.trim().toLowerCase()}|${e.start.slice(0,10)}|${e.category}|${e.sourceName.toLowerCase()}`;
export function dedupeEvents(events){return [...new Map(events.map(e=>[key(e),e])).values()]}
export function sortEvents(events){const r={high:0,medium:1,low:2};return [...events].sort((a,b)=>a.start.localeCompare(b.start)||r[a.importance]-r[b.importance])}
export function filterEvents(events,f,now=new Date()){
 const start=new Date(now); start.setHours(0,0,0,0);
 let end=null;
 if(f.window==="today") end=new Date(start.getTime()+86400000-1);
 if(f.window==="7d") end=new Date(start.getTime()+7*86400000);
 if(f.window==="30d") end=new Date(start.getTime()+30*86400000);
 if(f.from) start.setTime(new Date(f.from+"T00:00:00").getTime());
 if(f.to) end=new Date(f.to+"T23:59:59");
 const q=(f.query||"").toLowerCase();
 return sortEvents(events.filter(e=>{
  const d=new Date(e.start);
  return d>=start && (!end||d<=end) &&
   (!f.country||f.country==="all"||e.country===f.country) &&
   (!f.category||f.category==="all"||e.category===f.category) &&
   (!f.importance||f.importance==="all"||e.importance===f.importance) &&
   (!q||`${e.title} ${e.summary}`.toLowerCase().includes(q));
 }));
}
