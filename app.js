import {filterEvents,LIVE_REFRESH_MS} from './core.mjs';
import {buildMonthModel,topMovers} from './calendar.mjs';
import {answerMarketQuestion} from './market-assistant.mjs';
import {calculateSurprise} from './surprises.mjs';

const TICKER_ORDER=['nifty','banknifty','sensex','sp500','nasdaq','gold','crude','usdinr','bitcoin'];
const TICKER_LABELS={nifty:'NIFTY 50',banknifty:'Bank NIFTY',sensex:'Sensex',sp500:'S&P 500',nasdaq:'Nasdaq',gold:'Gold',crude:'WTI Crude',usdinr:'USD/INR',bitcoin:'Bitcoin'};

let all=[],marketImpact={eventTypes:{}},marketPrices={instruments:[]},surprises={},sourceStatus=null,alertState=null;
let news=[],niftyInNews=[],liveDataBase='';
let currentTab='overview',filterWindow='30d';
const now=new Date();let calendarYear=now.getFullYear(),calendarMonth=now.getMonth();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https:\/\//i.test(String(u||''))?String(u):'#';
const prettyImpact=l=>({very_high:'Very high',high:'High',medium:'Medium',low:'Low',no_history:'No history'})[l]||'No history';
const fetchJSON=path=>fetch(path,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`${path}: ${r.status}`)));

function fmt(e){const d=new Date(e.start);return{date:d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}),time:d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})+' IST'};}
function fmtNewsTime(value){if(!value)return'Unknown time';return new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}

function eventImpactKey(e){
  if(e.eventKey)return e.eventKey;
  const t=`${e.title} ${e.summary||''}`.toLowerCase();
  if(t.includes('fomc')||t.includes('federal open market committee'))return'fomc';
  if(t.includes('consumer price index')&&e.country==='US')return'us_cpi';
  if(t.includes('employment situation'))return'us_nfp';
  if(t.includes('producer price index')&&e.country==='US')return'us_ppi';
  if(t.includes('job openings and labor turnover'))return'us_jolts';
  if(t.includes('employment cost index'))return'us_eci';
  if(e.country==='IN'&&(t.includes('rbi')||t.includes('monetary policy')))return'rbi_mpc';
  if(e.country==='IN'&&(t.includes('consumer price index')||/\bcpi\b/.test(t)))return'india_cpi';
  if(e.country==='IN'&&/\bgdp\b/.test(t))return'india_gdp';
  if(e.country==='IN'&&(t.includes('industrial production')||/\biip\b/.test(t)))return'india_iip';
  if(e.country==='IN'&&(t.includes('wholesale price index')||/\bwpi\b/.test(t)))return'india_wpi';
  if(t.includes('european central bank')||/\becb\b/.test(t))return'ecb_mpc';
  if(t.includes('bank of england'))return'boe_mpc';
  return null;
}
function impactRow(e){const k=eventImpactKey(e);return k?marketImpact.eventTypes?.[k]:null;}
function impactLookup(e){return impactRow(e);}
function eventImportanceLevel(e){const r=impactRow(e);return r?.impactLevel||(e.importance==='high'?'high':e.importance==='medium'?'medium':'low');}
function expectedHistory(e){const key=eventImpactKey(e);return ['fomc','us_cpi','us_nfp','us_ppi','us_jolts','us_eci','rbi_mpc','india_cpi','india_gdp','india_iip','india_wpi','ecb_mpc','boe_mpc'].includes(key);}
function allFutureEvents(){return filterEvents(all,{window:'all',country:'all',category:'all',importance:'all',query:''},new Date(),impactLookup);}
function forcedCountryForTab(tab){return({india:'IN',us:'US',global:'GLOBAL'})[tab]||'all';}
function activeFilters(tab=currentTab){return{window:filterWindow,country:$('country').value,forcedCountry:forcedCountryForTab(tab),category:$('category').value,importance:$('importance').value,query:$('q').value,impact:$('impact').value,sort:$('sort').value};}
function eventsForTab(tab=currentTab){return filterEvents(all,activeFilters(tab),new Date(),impactLookup);}

function marketStat(m){const s=m?.oneDay;if(!s)return'';const dir=s.directionReady?`<b class="uptext">▲ ${s.upPct}%</b> / <b class="downtext">▼ ${s.downPct}%</b>`:`Sample ${s.sample}`;return`<div class="marketstat"><strong>${esc(m.label)}</strong><span>${dir}</span><span>Avg 1D move ±${esc(s.avgAbsMovePct)}% · max ${esc(s.maxAbsMovePct)}%</span><small>${esc(m.bias||'')} · sample ${esc(s.sample)}</small></div>`;}
function impactPanel(row,e){
  if(!row){
    if(expectedHistory(e))return`<div class="impactbox impact-pending"><div class="impact-head"><span class="impact-badge impact-no_history">No history yet</span><span>Historical sample not available yet</span></div></div>`;
    return'';
  }
  const markets=Object.values(row.markets||{}).filter(Boolean);if(!markets.length)return'';
  return`<div class="impactbox"><div class="impact-head"><span class="impact-badge impact-${esc(row.impactLevel)}">${esc(prettyImpact(row.impactLevel))} impact</span><span>Historical tendency — not a forecast</span></div><div class="marketgrid">${markets.slice(0,4).map(marketStat).join('')}</div></div>`;
}
function surprisePanel(e){const s=surprises[e.id]||surprises[eventImpactKey(e)];if(!s)return'';const calc=calculateSurprise(s.actual,s.forecast);return`<div class="surprise"><span><small>Actual</small><b>${esc(s.actual??'—')} ${esc(s.unit||'')}</b></span><span><small>Forecast</small><b>${esc(s.forecast??'—')}</b></span><span><small>Previous</small><b>${esc(s.previous??'—')}</b></span>${calc?`<span><small>Surprise</small><b>${calc.pct>0?'+':''}${calc.pct}%</b></span>`:''}</div>`;}
function eventCard(e){const f=fmt(e),row=impactRow(e),level=eventImportanceLevel(e);return`<article class="card" data-event-id="${esc(e.id)}"><div><div class="date">${esc(f.date)}</div><div class="time">${esc(f.time)}</div></div><div><div class="meta"><span class="pill ${esc(e.importance)}">${esc(e.importance)}</span><span class="pill">${esc(e.region)}</span><span class="pill">${esc((e.category||'other').replaceAll('_',' '))}</span>${e.eventType==='election'?'<span class="pill election-pill">Election</span>':''}<span class="pill impact-pill impact-${esc(level)}">${esc(prettyImpact(level))}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.summary||'')}</p>${surprisePanel(e)}${impactPanel(row,e)}</div><button class="source ghost event-open" data-event-id="${esc(e.id)}">Details →</button></article>`;}
function renderEventList(target,events,limit=80){const node=$(target);if(!node)return;const rows=events.slice(0,limit);node.innerHTML=rows.length?rows.map(eventCard).join(''):'<div class="empty">No matching upcoming events.</div>';bindEventButtons();}
function renderOverview(){const upcoming=eventsForTab('overview');renderMovers(upcoming);renderEventList('overviewEvents',upcoming,80);}
function renderRegion(){renderEventList('indiaEvents',eventsForTab('india'),120);renderEventList('usEvents',eventsForTab('us'),120);renderEventList('globalEvents',eventsForTab('global'),120);}
function renderMovers(events){const node=$('movers');if(!node)return;const movers=topMovers(events,impactLookup,5);node.innerHTML=movers.length?movers.map(e=>{const f=fmt(e),r=impactRow(e),n=r?.markets?.nifty?.oneDay,s=r?.markets?.sp500?.oneDay;return`<article class="mover event-open" data-event-id="${esc(e.id)}"><div class="mover-top"><span class="impact-badge impact-${esc(eventImportanceLevel(e))}">${esc(prettyImpact(eventImportanceLevel(e)))}</span><span>${esc(f.date)}</span></div><h3>${esc(e.title)}</h3><div class="mover-stats">${n?`<span>NIFTY avg ±${n.avgAbsMovePct}%</span>`:''}${s?`<span>S&amp;P avg ±${s.avgAbsMovePct}%</span>`:''}${!n&&!s?'<span>High-importance scheduled event</span>':''}</div></article>`;}).join(''):'<div class="empty compact-empty">No matching market movers.</div>';bindEventButtons();}
function renderRanked(){renderEventList('rankedEvents',eventsForTab('movers'),250);}
function renderCount(){const browsing=['overview','india','us','global','movers'].includes(currentTab);const count=browsing?eventsForTab(currentTab).length:allFutureEvents().length;$('count').textContent=`${count} upcoming event${count===1?'':'s'}`;}

function ensureTickerShell(){
  const track=$('tickerTrack');if(!track||track.dataset.ready)return;
  const group=()=>TICKER_ORDER.map(key=>`<span class="ticker-item" data-ticker-key="${key}" title="Awaiting market data"><strong>${esc(TICKER_LABELS[key])}</strong><b class="ticker-price">—</b><span class="ticker-change">—</span></span>`).join('');
  track.innerHTML=`<span class="ticker-group">${group()}</span><span class="ticker-group" aria-hidden="true">${group()}</span>`;
  track.dataset.ready='1';
}
function renderTicker(){
  ensureTickerShell();
  const map=new Map((marketPrices.instruments||[]).map(x=>[x.key,x]));
  for(const key of TICKER_ORDER){
    const q=map.get(key);const price=q?.price==null?'Unavailable':new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(q.price);const change=q?.changePct;
    const changeText=change==null?'—':`${change>0?'+':''}${change}%`;const cls=change>0?'uptext':change<0?'downtext':'';
    const ts=q?.sourceTimestamp?fmtNewsTime(q.sourceTimestamp):'No timestamp';const title=`${q?.status||'Unavailable'} · ${q?.sourceName||'No free source'} · ${ts}`;
    document.querySelectorAll(`[data-ticker-key="${key}"]`).forEach(node=>{
      const p=node.querySelector('.ticker-price'),c=node.querySelector('.ticker-change');if(p)p.textContent=price;if(c){c.textContent=changeText;c.className=`ticker-change ${cls}`.trim();}node.title=title;
    });
  }
}

function filteredCalendarEvents(){return all.filter(e=>{const ym=e.start.slice(0,7),target=`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;if(ym!==target)return false;const region=$('calendarRegion').value;if(region!=='all'&&e.country!==region)return false;const mode=$('calendarMode').value;if(mode==='all')return true;if(mode==='elections')return e.eventType==='election'||e.category==='politics';if(mode==='economic')return e.category==='economic';if(mode==='central_bank')return e.category==='central_bank';const level=eventImportanceLevel(e);return['high','very_high'].includes(level)||e.importance==='high';});}
function renderCalendar(){const events=filteredCalendarEvents(),model=buildMonthModel(events,calendarYear,calendarMonth,impactLookup);$('calendarTitle').textContent=new Date(calendarYear,calendarMonth,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});$('calendarGrid').innerHTML=model.cells.map(c=>`<button class="day-cell heat-${c.heat} ${c.inMonth?'':'outside'}" data-day="${c.iso}"><span class="day-num">${c.day}</span><div class="day-events">${c.events.slice(0,3).map(e=>`<span class="event-chip impact-${eventImportanceLevel(e)}">${esc(e.title)}</span>`).join('')}${c.events.length>3?`<span class="more">+${c.events.length-3} more</span>`:''}</div></button>`).join('');const highDays=new Set(events.filter(e=>['high','very_high'].includes(eventImportanceLevel(e))).map(e=>e.start.slice(0,10))).size,electionCount=events.filter(e=>e.eventType==='election').length;$('monthSummary').innerHTML=`<span><b>${highDays}</b> high-impact days</span><span><b>${events.length}</b> visible events</span><span><b>${electionCount}</b> election events</span>`;document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>openDay(b.dataset.day,events));}
function openDay(iso,events){const rows=events.filter(e=>e.start.slice(0,10)===iso).sort((a,b)=>a.start.localeCompare(b.start));const dialog=$('detailDialog');dialog.dataset.eventId='';$('detailContent').innerHTML=`<p class="eyebrow">${esc(iso)}</p><h2>${rows.length} event${rows.length===1?'':'s'}</h2>${rows.map(eventCard).join('')||'<p>No events.</p>'}`;if(!dialog.open)dialog.showModal();bindEventButtons();}
function openEvent(id){const e=all.find(x=>x.id===id);if(!e)return;const f=fmt(e),r=impactRow(e),dialog=$('detailDialog');dialog.dataset.eventId=id;$('detailContent').innerHTML=`<p class="eyebrow">${esc(e.region)} · ${esc(f.date)} · ${esc(f.time)}</p><h2>${esc(e.title)}</h2><div class="meta"><span class="pill ${esc(e.importance)}">${esc(e.importance)}</span>${e.eventType==='election'?'<span class="pill election-pill">Election</span>':''}<span class="pill impact-${eventImportanceLevel(e)}">${esc(prettyImpact(eventImportanceLevel(e)))}</span></div><p class="detail-copy">${esc(e.summary||'')}</p>${surprisePanel(e)}${impactPanel(r,e)}<div class="detail-actions"><a class="primary-link" href="${esc(safeUrl(e.sourceUrl))}" target="_blank" rel="noopener">Official source ↗</a><button id="askThisEvent" class="secondary">Ask AI about this event</button></div>`;if(!dialog.open)dialog.showModal();setTimeout(()=>{const b=$('askThisEvent');if(b)b.onclick=()=>{switchTab('ai');dialog.close();$('aiQuestion').value=`How much can ${e.title} impact the market?`;askAI($('aiQuestion').value,e);}},0);}
function bindEventButtons(){document.querySelectorAll('.event-open').forEach(b=>b.onclick=()=>openEvent(b.dataset.eventId));}

function newsCard(item){return`<article class="news-card"><div class="news-meta"><span class="impact-badge impact-${esc(item.relevanceLevel||'low')}">${esc((item.relevanceLevel||'low').replace('_',' '))}</span><span>${esc(item.region||'GLOBAL')}</span><span>${esc((item.category||'other').replaceAll('_',' '))}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.reason||'Market-moving development')}</p><div class="news-foot"><span>${esc(item.source||'Source')} · ${esc(fmtNewsTime(item.publishedAt))}</span><a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener">Original source ↗</a></div></article>`;}
function niftyCard(row){return`<article class="nifty-news-card"><div class="nifty-news-head"><div><strong>${esc(row.symbol)}</strong><span>${esc(row.company||'')}</span></div><span class="impact-badge impact-${esc(row.relevanceLevel||'low')}">${esc((row.relevanceLevel||'low').replace('_',' '))}</span></div><h3>${esc(row.reason||'Company-specific development')}</h3><p>${esc(row.latestHeadline||'')}</p><div class="news-foot"><span>${esc(row.relatedStoryCount||1)} related · ${esc(fmtNewsTime(row.publishedAt))} · ${esc((row.sources||[]).join(', '))}</span><a href="${esc(safeUrl(row.url))}" target="_blank" rel="noopener">Source ↗</a></div></article>`;}
function updateNewsSources(){const select=$('newsSource');if(!select)return;const current=select.value;const sources=[...new Set(news.map(x=>x.source).filter(Boolean))].sort();select.innerHTML='<option value="all">All sources</option>'+sources.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');if(sources.includes(current))select.value=current;}
function filteredNews(){const region=$('newsRegion')?.value||'all',relevance=$('newsRelevance')?.value||'all',category=$('newsCategory')?.value||'all',source=$('newsSource')?.value||'all',q=($('newsQuery')?.value||'').toLowerCase(),niftyOnly=$('newsNiftyOnly')?.checked;return news.filter(x=>(region==='all'||x.region===region)&&(relevance==='all'||x.relevanceLevel===relevance)&&(category==='all'||x.category===category)&&(source==='all'||x.source===source)&&(!q||`${x.title} ${x.reason||''} ${x.source||''}`.toLowerCase().includes(q))&&(!niftyOnly||(x.matchedStocks||[]).length));}
function renderNewsViews(){
  updateNewsSources();
  const top=news.filter(x=>['very_high','high'].includes(x.relevanceLevel)).slice(0,8);const topNode=$('marketMovingNews');if(topNode)topNode.innerHTML=top.length?top.map(newsCard).join(''):'<div class="empty compact-empty">No High or Very High market-moving stories in the current feed.</div>';
  const nifty=niftyInNews.slice(0,12);for(const id of ['niftyInNews','indiaNiftyInNews']){const node=$(id);if(node)node.innerHTML=nifty.length?nifty.map(niftyCard).join(''):'<div class="empty compact-empty">No NIFTY 50 matches in the current news feed.</div>';}
  const allNode=$('allNews');if(allNode){const rows=filteredNews();allNode.innerHTML=rows.length?rows.slice(0,150).map(newsCard).join(''):'<div class="empty">No matching news.</div>';}
}

function impactContext(){const map={};for(const e of all){const r=impactRow(e);if(r)map[e.id]=r;}return{now:new Date().toISOString(),events:allFutureEvents(),impactByEventId:map,marketPrices,surprises};}
function askAI(question,event=null){let ctx=impactContext();if(event){const rest=ctx.events.filter(e=>e.id!==event.id);ctx.events=[event,...rest];}const r=answerMarketQuestion(question,ctx);$('aiAnswer').innerHTML=`<h3>Answer</h3><p>${esc(r.answer)}</p>${r.evidence.length?`<h4>Evidence used</h4><ul>${r.evidence.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p class="assistant-disclaimer">${esc(r.disclaimer)}</p>`;}
function renderUpdateStatus(status){sourceStatus=status;$('updateBar').classList.toggle('delayed',!status?.updatedAt);if(!status?.updatedAt){$('updateState').textContent='Update status unavailable';$('lastUpdated').textContent='';$('sourceHealth').textContent='';return;}const updated=new Date(status.updatedAt);$('updateState').textContent='Data updated';$('lastUpdated').textContent=`Latest event/source data: ${updated.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})} IST`;const sources=Object.values(status.sources||{}),ok=sources.filter(x=>['ok','Live'].includes(x.status)).length;$('sourceHealth').textContent=sources.length?`${ok}/${sources.length} sources healthy`:'';}
function renderAlertState(){if(!alertState){$('alertState').textContent='No qualifying alert has been recorded yet.';return;}const sent=Object.keys(alertState.sent||{}).length;$('alertState').textContent=`Recorded alerts: ${sent}${alertState.updatedAt?` · last state update ${new Date(alertState.updatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`:''}`;}
function updateFilterVisibility(){const eventTab=['overview','india','us','global','movers'].includes(currentTab);$('sharedFilters').hidden=!eventTab;const forced=forcedCountryForTab(currentTab);$('countryFilterLabel').hidden=forced!=='all';$('filterScope').textContent=forced==='IN'?'India only':forced==='US'?'United States only':forced==='GLOBAL'?'Global only':'All regions';}
function renderDataViews(){renderTicker();renderOverview();renderRegion();renderRanked();renderCalendar();renderAlertState();renderNewsViews();renderCount();}
function applyFilters(){renderOverview();renderRegion();renderRanked();renderCount();}
function switchTab(tab){currentTab=tab;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$(`${tab}Panel`)?.classList.add('active');updateFilterVisibility();if(tab==='calendar')renderCalendar();if(tab==='news')renderNewsViews();renderCount();}

async function loadLiveConfig(){try{const cfg=await fetchJSON('./live-config.json');liveDataBase=String(cfg.liveDataBase||'').replace(/\/$/,'');}catch{liveDataBase='';}}
async function fetchWorkerSnapshot(){if(!liveDataBase)return null;return fetchJSON(`${liveDataBase}/api/snapshot`);}
async function fetchStaticBundle(){
  const paths=['./events.json','./market-impact.json','./market-prices.json','./surprises.json','./source-status.json','./alert-state.json'];
  const results=await Promise.allSettled(paths.map(fetchJSON));
  return {events:results[0],impact:results[1],market:results[2],surprises:results[3],status:results[4],alerts:results[5]};
}
function applyStaticResult(bundle){
  if(bundle.events.status==='fulfilled')all=bundle.events.value;
  if(bundle.impact.status==='fulfilled')marketImpact=bundle.impact.value||{eventTypes:{}};
  if(bundle.market.status==='fulfilled')marketPrices=bundle.market.value||{instruments:[]};
  if(bundle.surprises.status==='fulfilled'){const p=bundle.surprises.value||{};surprises=p.events||p;}
  if(bundle.status.status==='fulfilled')sourceStatus=bundle.status.value;
  if(bundle.alerts.status==='fulfilled')alertState=bundle.alerts.value;
}
function applyWorkerSnapshot(s){
  if(!s)return;
  if(s.market?.instruments?.length)marketPrices=s.market;
  if(Array.isArray(s.news))news=s.news;
  if(Array.isArray(s.niftyInNews))niftyInNews=s.niftyInNews;
  if(Array.isArray(s.events)&&s.events.length)all=s.events;
  if(s.impact?.eventTypes&&Object.keys(s.impact.eventTypes).length)marketImpact=s.impact;
  if(s.surprises?.events)surprises=s.surprises.events;
  if(s.alerts)alertState=s.alerts;
  if(s.sourceStatus?.sources&&Object.keys(s.sourceStatus.sources).length){sourceStatus={...(sourceStatus||{}),...s.sourceStatus,sources:{...(sourceStatus?.sources||{}),...s.sourceStatus.sources}};}
}

async function refreshEverything(){
  const y=window.scrollY;
  const dialog=$('detailDialog'),openEventId=dialog?.open?dialog.dataset.eventId:'';
  const [staticResult,workerResult]=await Promise.allSettled([fetchStaticBundle(),fetchWorkerSnapshot()]);
  if(staticResult.status==='fulfilled')applyStaticResult(staticResult.value);
  if(workerResult.status==='fulfilled')applyWorkerSnapshot(workerResult.value);
  renderUpdateStatus(sourceStatus);
  renderDataViews();
  if(openEventId&&dialog?.open)dialog.dataset.eventId=openEventId;
  $('liveRefreshState').textContent=`Auto-refresh every 1 min · checked ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:'auto'}));
}

function bindControls(){
  document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  document.querySelectorAll('[data-win]').forEach(b=>b.onclick=()=>{filterWindow=b.dataset.win;document.querySelectorAll('[data-win]').forEach(x=>x.classList.toggle('active',x===b));applyFilters();});
  for(const id of ['q','country','category','importance','impact','sort']){$(id)?.addEventListener(id==='q'?'input':'change',applyFilters);}
  $('calendarRegion')?.addEventListener('change',renderCalendar);$('calendarMode')?.addEventListener('change',renderCalendar);
  $('prevMonth').onclick=()=>{calendarMonth--;if(calendarMonth<0){calendarMonth=11;calendarYear--;}renderCalendar();};
  $('nextMonth').onclick=()=>{calendarMonth++;if(calendarMonth>11){calendarMonth=0;calendarYear++;}renderCalendar();};
  $('todayMonth').onclick=()=>{const d=new Date();calendarYear=d.getFullYear();calendarMonth=d.getMonth();renderCalendar();};
  $('closeDialog').onclick=()=>$('detailDialog').close();
  $('aiForm').onsubmit=e=>{e.preventDefault();askAI($('aiQuestion').value);};
  document.querySelectorAll('#suggestedQuestions button').forEach(b=>b.onclick=()=>{$('aiQuestion').value=b.textContent;askAI(b.textContent);});
  for(const id of ['newsRegion','newsRelevance','newsCategory','newsSource','newsNiftyOnly'])$(id)?.addEventListener('change',renderNewsViews);
  $('newsQuery')?.addEventListener('input',renderNewsViews);
}

ensureTickerShell();
bindControls();
updateFilterVisibility();
await loadLiveConfig();
await refreshEverything();
setInterval(refreshEverything,LIVE_REFRESH_MS);
