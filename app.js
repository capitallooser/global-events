import {filterEvents} from "./core.mjs";
let all=[], win="30d", view="list";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=e=>{const d=new Date(e.start);return {date:d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"}),time:d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}};
function render(){
 const f={window:win,country:$("country").value,category:$("category").value,importance:$("importance").value,query:$("q").value};
 let out=filterEvents(all,f,new Date());
 $("count").textContent=`${out.length} upcoming event${out.length===1?"":"s"}`;
 if(!out.length){$("events").innerHTML='<div class="empty">No matching upcoming events.</div>';return}
 let last="";
 $("events").innerHTML=out.map(e=>{const x=fmt(e);let head="";
   if(view==="calendar"&&x.date!==last){last=x.date;head=`<div class="dayhead">${esc(x.date)}</div>`}
   return `${head}<article class="card"><div><div class="date">${esc(x.date)}</div><div class="time">${esc(x.time)}</div></div><div><div class="meta"><span class="pill ${e.importance}">${esc(e.importance)}</span><span class="pill">${esc(e.region)}</span><span class="pill">${esc(e.category.replaceAll("_"," "))}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.summary)}</p></div><a class="source" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">Official source ↗</a></article>`}).join("");
}
document.querySelectorAll("[data-win]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-win]").forEach(x=>x.classList.remove("active"));b.classList.add("active");win=b.dataset.win;render()});
["q","country","category","importance"].forEach(id=>$(id).addEventListener(id==="q"?"input":"change",render));
$("listBtn").onclick=()=>{view="list";$("listBtn").classList.add("active");$("calBtn").classList.remove("active");render()};
$("calBtn").onclick=()=>{view="calendar";$("calBtn").classList.add("active");$("listBtn").classList.remove("active");render()};
try{const r=await fetch("./data/events.json");if(!r.ok)throw Error();const feed=await r.json();all=feed;render()}catch{$("status").innerHTML='<div class="empty">Unable to load events.</div>'}
