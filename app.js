import {filterEvents} from "./core.mjs";

let all = [];
let marketImpact = {eventTypes:{}};
let win = "30d";
let view = "list";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

const fmt = e => {
  const d = new Date(e.start);
  return {
    date:d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"}),
    time:d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})
  };
};

function eventImpactKey(e){
  const t = `${e.title} ${e.summary || ""}`.toLowerCase();
  if(t.includes("federal reserve fomc") || t.includes("federal open market committee")) return "fomc";
  if(t.includes("consumer price index")) return "us_cpi";
  if(t.includes("employment situation")) return "us_nfp";
  if(t.includes("producer price index")) return "us_ppi";
  if(t.includes("job openings and labor turnover")) return "us_jolts";
  if(t.includes("employment cost index")) return "us_eci";
  if(t.includes("rbi monetary policy") || t.includes("reserve bank of india monetary policy")) return "rbi_mpc";
  return null;
}

function impactRow(e){
  const key = eventImpactKey(e);
  return key ? marketImpact.eventTypes?.[key] : null;
}

function prettyImpact(level){
  return ({
    very_high:"Very high",
    high:"High",
    medium:"Medium",
    low:"Low",
    no_history:"No history"
  })[level] || "No history";
}

function marketStat(market, horizon="oneDay"){
  const row = market?.[horizon];
  if(!row) return "";
  if(!row.directionReady){
    return `<div class="marketstat">
      <strong>${esc(market.label)}</strong>
      <span>Sample ${row.sample} · avg move ±${row.avgAbsMovePct}%</span>
      <small>Directional sample is still too small.</small>
    </div>`;
  }
  return `<div class="marketstat">
    <strong>${esc(market.label)}</strong>
    <span><b class="uptext">▲ ${row.upPct}%</b> / <b class="downtext">▼ ${row.downPct}%</b></span>
    <span>Avg 1D move ±${row.avgAbsMovePct}% · max ${row.maxAbsMovePct}%</span>
    <small>${esc(market.bias)} · sample ${row.sample}</small>
  </div>`;
}

function impactPanel(row){
  if(!row) return "";
  const n = row.markets?.nifty;
  const s = row.markets?.sp500;
  if(!n && !s) return "";
  return `<div class="impactbox">
    <div class="impact-head">
      <span class="impact-badge impact-${esc(row.impactLevel)}">${esc(prettyImpact(row.impactLevel))} impact</span>
      <span>Historical tendency — not a forecast</span>
    </div>
    <div class="marketgrid">
      ${marketStat(n)}
      ${marketStat(s)}
    </div>
    <details>
      <summary>3-day historical reaction</summary>
      <div class="marketgrid three-day">
        ${marketStat3(n)}
        ${marketStat3(s)}
      </div>
    </details>
  </div>`;
}

function marketStat3(market){
  const row = market?.threeDay;
  if(!row) return "";
  const direction = row.directionReady
    ? `<b class="uptext">▲ ${row.upPct}%</b> / <b class="downtext">▼ ${row.downPct}%</b>`
    : `Sample ${row.sample}`;
  return `<div class="marketstat">
    <strong>${esc(market.label)} · 3D</strong>
    <span>${direction}</span>
    <span>Avg move ±${row.avgAbsMovePct}% · max ${row.maxAbsMovePct}%</span>
  </div>`;
}

function renderMovers(events){
  const unique = new Map();
  for(const e of events){
    const key = eventImpactKey(e);
    const row = impactRow(e);
    if(!key || !row || row.impactScore == null) continue;
    const existing = unique.get(key);
    if(!existing || new Date(e.start) < new Date(existing.event.start)){
      unique.set(key,{event:e,row});
    }
  }
  const movers = [...unique.values()]
    .sort((a,b)=>(b.row.impactScore||0)-(a.row.impactScore||0))
    .slice(0,3);

  $("moversSection").hidden = !movers.length;
  $("movers").innerHTML = movers.map(({event,row}) => {
    const f = fmt(event);
    const n = row.markets?.nifty?.oneDay;
    const s = row.markets?.sp500?.oneDay;
    return `<article class="mover">
      <div class="mover-top">
        <span class="impact-badge impact-${esc(row.impactLevel)}">${esc(prettyImpact(row.impactLevel))}</span>
        <span>${esc(f.date)}</span>
      </div>
      <h3>${esc(event.title)}</h3>
      <div class="mover-stats">
        ${n ? `<span>NIFTY avg ±${n.avgAbsMovePct}%</span>` : ""}
        ${s ? `<span>S&amp;P avg ±${s.avgAbsMovePct}%</span>` : ""}
      </div>
    </article>`;
  }).join("");
}

function render(){
  const f = {
    window:win,
    country:$("country").value,
    category:$("category").value,
    importance:$("importance").value,
    query:$("q").value
  };

  let out = filterEvents(all,f,new Date());

  const impactFilter = $("impact").value;
  if(impactFilter !== "all"){
    out = out.filter(e => {
      const row = impactRow(e);
      const level = row?.impactLevel || "no_history";
      return level === impactFilter;
    });
  }

  if($("sort").value === "impact"){
    out.sort((a,b)=>{
      const ai = impactRow(a)?.impactScore ?? -1;
      const bi = impactRow(b)?.impactScore ?? -1;
      return bi-ai || new Date(a.start)-new Date(b.start);
    });
  }

  $("count").textContent = `${out.length} upcoming event${out.length===1?"":"s"}`;
  renderMovers(out);

  if(!out.length){
    $("events").innerHTML='<div class="empty">No matching upcoming events.</div>';
    return;
  }

  let last="";
  $("events").innerHTML = out.map(e=>{
    const x=fmt(e);
    let head="";
    if(view==="calendar" && x.date!==last){
      last=x.date;
      head=`<div class="dayhead">${esc(x.date)}</div>`;
    }
    const impact = impactRow(e);
    return `${head}<article class="card">
      <div>
        <div class="date">${esc(x.date)}</div>
        <div class="time">${esc(x.time)}</div>
      </div>
      <div>
        <div class="meta">
          <span class="pill ${esc(e.importance)}">${esc(e.importance)}</span>
          <span class="pill">${esc(e.region)}</span>
          <span class="pill">${esc(e.category.replaceAll("_"," "))}</span>
          ${impact ? `<span class="pill impact-pill impact-${esc(impact.impactLevel)}">${esc(prettyImpact(impact.impactLevel))} market impact</span>` : ""}
        </div>
        <h2>${esc(e.title)}</h2>
        <p>${esc(e.summary)}</p>
        ${impactPanel(impact)}
      </div>
      <a class="source" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">Official source ↗</a>
    </article>`;
  }).join("");
}

const IST_SCHEDULE = [8,11,14,15,20,22];
function latestExpectedRun(now = new Date()){
  const parts = new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hour12:false
  }).formatToParts(now).reduce((a,p)=>(a[p.type]=p.value,a),{});
  const y=+parts.year,m=+parts.month,d=+parts.day,h=+parts.hour,min=+parts.minute;
  // Construct IST instants via +05:30 offset.
  const candidates=[];
  for(const hour of IST_SCHEDULE){
    candidates.push(new Date(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(hour).padStart(2,"0")}:00:00+05:30`));
  }
  // Include yesterday's 10 PM run.
  const todayMidnight = new Date(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T00:00:00+05:30`);
  const yesterday = new Date(todayMidnight.getTime()-86400000);
  const yp = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(yesterday).reduce((a,p)=>(a[p.type]=p.value,a),{});
  candidates.push(new Date(`${yp.year}-${yp.month}-${yp.day}T22:00:00+05:30`));
  const graceNow = new Date(now.getTime()-45*60000);
  return candidates.filter(c=>c<=graceNow).sort((a,b)=>b-a)[0] || candidates[candidates.length-1];
}

function renderUpdateStatus(status){
  if(!status?.updatedAt){
    $("updateState").textContent="Update status unavailable";
    $("updateBar").classList.add("delayed");
    return;
  }
  const updated = new Date(status.updatedAt);
  const expected = latestExpectedRun(new Date());
  const delayed = updated < new Date(expected.getTime()-10*60000);
  $("updateBar").classList.toggle("delayed",delayed);
  $("updateState").textContent = delayed ? "Update delayed" : "Data updated";
  $("lastUpdated").textContent = `Last run: ${updated.toLocaleString("en-IN",{
    timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric",
    hour:"2-digit",minute:"2-digit",hour12:true
  })} IST`;
  const sources = Object.values(status.sources || {});
  const ok = sources.filter(x=>x.status==="ok").length;
  $("sourceHealth").textContent = sources.length ? `${ok}/${sources.length} sources healthy` : "";
}

document.querySelectorAll("[data-win]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-win]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); win=b.dataset.win; render();
});

["q","country","category","importance","impact","sort"].forEach(id=>{
  $(id).addEventListener(id==="q"?"input":"change",render);
});

$("listBtn").onclick=()=>{view="list";$("listBtn").classList.add("active");$("calBtn").classList.remove("active");render()};
$("calBtn").onclick=()=>{view="calendar";$("calBtn").classList.add("active");$("listBtn").classList.remove("active");render()};

try{
  const [eventsResult,statusResult,impactResult] = await Promise.allSettled([
    fetch("./events.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()}),
    fetch("./source-status.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()}),
    fetch("./market-impact.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error();return r.json()})
  ]);

  if(eventsResult.status!=="fulfilled") throw Error("events");
  all=eventsResult.value;

  if(statusResult.status==="fulfilled") renderUpdateStatus(statusResult.value);
  else renderUpdateStatus(null);

  if(impactResult.status==="fulfilled") marketImpact=impactResult.value;
  render();
}catch{
  $("status").innerHTML='<div class="empty">Unable to load events.</div>';
}
