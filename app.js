import {filterEvents} from './core.mjs';
import {buildMonthModel,rankEvents,topMovers} from './calendar.mjs';
import {answerMarketQuestion} from './market-assistant.mjs';
import {calculateSurprise} from './surprises.mjs';

let all=[],marketImpact={eventTypes:{}},marketPrices={instruments:[]},surprises={},sourceStatus=null,alertState=null;
let currentTab='overview';
const now=new Date();let calendarYear=now.getFullYear(),calendarMonth=now.getMonth();
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=u=>/^https:\/\//i.test(String(u||''))?String(u):'#';
const prettyImpact=l=>({very_high:'Very high',high:'High',medium:'Medium',low:'Low',no_history:'No history'})[l]||'No history';

function fmt(e){const d=new Date(e.start);return{date:d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}),time:d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})+' IST'};}
function eventImpactKey(e){
  if(e.eventKey&&marketImpact.eventTypes?.[e.eventKey])return e.eventKey;
  const t=`${e.title} ${e.summary||''}`.toLowerCase();
  if(t.includes('fomc')||t.includes('federal open market committee'))return'fomc';
  if(t.includes('consumer price index')&&e.country==='US')return'us_cpi';
  if(t.includes('employment situation'))return'us_nfp';
  if(t.includes('producer price index')&&e.country==='US')return'us_ppi';
  if(t.includes('job openings and labor turnover'))return'us_jolts';
  if(t.includes('employment cost index'))return'us_eci';
  return e.eventKey||null;
}
function impactRow(e){const k=eventImpactKey(e);return k?marketImpact.eventTypes?.[k]:null;}
function impactLookup(e){return impactRow(e);}
function eventImportanceLevel(e){const r=impactRow(e);return r?.impactLevel||(e.importance==='high'?'high':e.importance==='medium'?'medium':'low');}

function marketStat(m){const s=m?.oneDay;if(!s)return'';const dir=s.directionReady?`<b class="uptext">▲ ${s.upPct}%</b> / <b class="downtext">▼ ${s.downPct}%</b>`:`Sample ${s.sample}`;return`<div class="marketstat"><strong>${esc(m.label)}</strong><span>${dir}</span><span>Avg 1D move ±${esc(s.avgAbsMovePct)}% · max ${esc(s.maxAbsMovePct)}%</span><small>${esc(m.bias||'')} · sample ${esc(s.sample)}</small></div>`;}
function impactPanel(row){if(!row)return'';const markets=Object.values(row.markets||{}).filter(Boolean);if(!markets.length)return'';return`<div class="impactbox"><div class="impact-head"><span class="impact-badge impact-${esc(row.impactLevel)}">${esc(prettyImpact(row.impactLevel))} impact</span><span>Historical tendency — not a forecast</span></div><div class="marketgrid">${markets.slice(0,4).map(marketStat).join('')}</div></div>`;}
function surprisePanel(e){const s=surprises[e.id]||surprises[eventImpactKey(e)];if(!s)return'';const calc=calculateSurprise(s.actual,s.forecast);return`<div class="surprise"><span><small>Actual</small><b>${esc(s.actual??'—')} ${esc(s.unit||'')}</b></span><span><small>Forecast</small><b>${esc(s.forecast??'—')}</b></span><span><small>Previous</small><b>${esc(s.previous??'—')}</b></span>${calc?`<span><small>Surprise</small><b>${calc.pct>0?'+':''}${calc.pct}%</b></span>`:''}</div>`;}

function eventCard(e){const f=fmt(e),row=impactRow(e),level=eventImportanceLevel(e);return`<article class="card" data-event-id="${esc(e.id)}"><div><div class="date">${esc(f.date)}</div><div class="time">${esc(f.time)}</div></div><div><div class="meta"><span class="pill ${esc(e.importance)}">${esc(e.importance)}</span><span class="pill">${esc(e.region)}</span><span class="pill">${esc((e.category||'other').replaceAll('_',' '))}</span>${e.eventType==='election'?'<span class="pill election-pill">Election</span>':''}<span class="pill impact-pill impact-${esc(level)}">${esc(prettyImpact(level))}</span></div><h2>${esc(e.title)}</h2><p>${esc(e.summary||'')}</p>${surprisePanel(e)}${impactPanel(row)}</div><button class="source ghost event-open" data-event-id="${esc(e.id)}">Details →</button></article>`;}
function renderEventList(target,events,limit=80){const rows=rankEvents(events,impactLookup).slice(0,limit);$(target).innerHTML=rows.length?rows.map(eventCard).join(''):'<div class="empty">No matching upcoming events.</div>';bindEventButtons();}
function futureEvents(country='all'){return filterEvents(all,{window:'all',country,category:'all',importance:'all',query:''},new Date());}
function renderOverview(){const upcoming=futureEvents();renderMovers(upcoming);renderEventList('overviewEvents',upcoming,35);}
function renderRegion(){renderEventList('indiaEvents',futureEvents('IN'),80);renderEventList('usEvents',futureEvents('US'),80);renderEventList('globalEvents',futureEvents('GLOBAL'),80);}
function renderMovers(events){const movers=topMovers(events,impactLookup,5);$('movers').innerHTML=movers.map(e=>{const f=fmt(e),r=impactRow(e),n=r?.markets?.nifty?.oneDay,s=r?.markets?.sp500?.oneDay;return`<article class="mover event-open" data-event-id="${esc(e.id)}"><div class="mover-top"><span class="impact-badge impact-${esc(eventImportanceLevel(e))}">${esc(prettyImpact(eventImportanceLevel(e)))}</span><span>${esc(f.date)}</span></div><h3>${esc(e.title)}</h3><div class="mover-stats">${n?`<span>NIFTY avg ±${n.avgAbsMovePct}%</span>`:''}${s?`<span>S&amp;P avg ±${s.avgAbsMovePct}%</span>`:''}${!n&&!s?'<span>High-importance scheduled event</span>':''}</div></article>`;}).join('');bindEventButtons();}
function renderRanked(){let rows=futureEvents($('country').value);const q=$('q').value.toLowerCase(),cat=$('category').value,imp=$('impact').value;rows=rows.filter(e=>(!q||`${e.title} ${e.summary||''}`.toLowerCase().includes(q))&&(cat==='all'||e.category===cat)&&(imp==='all'||(impactRow(e)?.impactLevel||'no_history')===imp));renderEventList('rankedEvents',rows,200);}

function quoteCard(q){const change=q.changePct,cls=change>0?'uptext':change<0?'downtext':'';const price=q.price==null?'Unavailable':new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(q.price);const ts=q.sourceTimestamp?new Date(q.sourceTimestamp).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'No timestamp';return`<article class="quote"><div><strong>${esc(q.label)}</strong><small>${esc(q.status||'Unavailable')}</small></div><b>${esc(price)}</b><span class="${cls}">${change==null?'—':`${change>0?'+':''}${change}%`}</span><small>${esc(ts)} · ${esc(q.sourceName||'No free source')}</small></article>`;}
function renderMarketStrip(){let keys=['nifty','banknifty','sensex','gift_nifty','usdinr','sp500','nasdaq','gold','bitcoin'];if(currentTab==='india')keys=['nifty','banknifty','sensex','gift_nifty','usdinr'];if(currentTab==='us')keys=['sp500','nasdaq','gold','bitcoin'];const rows=keys.map(k=>(marketPrices.instruments||[]).find(x=>x.key===k)).filter(Boolean);$('marketStrip').innerHTML=rows.length?rows.map(quoteCard).join(''):'<div class="empty compact-empty">Market snapshot will appear after the market-price workflow runs.</div>';$('marketUpdated').textContent=marketPrices.updatedAt?`Updated ${new Date(marketPrices.updatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})} IST`:'Awaiting first price refresh';$('marketStripSection').hidden=['calendar','ai','alerts','movers'].includes(currentTab);}

function filteredCalendarEvents(){return all.filter(e=>{const ym=e.start.slice(0,7),target=`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}`;if(ym!==target)return false;const region=$('calendarRegion').value;if(region!=='all'&&e.country!==region)return false;const mode=$('calendarMode').value;if(mode==='all')return true;if(mode==='elections')return e.eventType==='election'||e.category==='politics';if(mode==='economic')return e.category==='economic';if(mode==='central_bank')return e.category==='central_bank';const level=eventImportanceLevel(e);return['high','very_high'].includes(level)||e.importance==='high';});}
function renderCalendar(){const events=filteredCalendarEvents(),model=buildMonthModel(events,calendarYear,calendarMonth,impactLookup);$('calendarTitle').textContent=new Date(calendarYear,calendarMonth,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});$('calendarGrid').innerHTML=model.cells.map(c=>`<button class="day-cell heat-${c.heat} ${c.inMonth?'':'outside'}" data-day="${c.iso}"><span class="day-num">${c.day}</span><div class="day-events">${c.events.slice(0,3).map(e=>`<span class="event-chip impact-${eventImportanceLevel(e)}">${esc(e.title)}</span>`).join('')}${c.events.length>3?`<span class="more">+${c.events.length-3} more</span>`:''}</div></button>`).join('');const highDays=new Set(events.filter(e=>['high','very_high'].includes(eventImportanceLevel(e))).map(e=>e.start.slice(0,10))).size,electionCount=events.filter(e=>e.eventType==='election').length;$('monthSummary').innerHTML=`<span><b>${highDays}</b> high-impact days</span><span><b>${events.length}</b> visible events</span><span><b>${electionCount}</b> election events</span>`;document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>openDay(b.dataset.day,events));}
function openDay(iso,events){const rows=rankEvents(events.filter(e=>e.start.slice(0,10)===iso),impactLookup);$('detailContent').innerHTML=`<p class="eyebrow">${esc(iso)}</p><h2>${rows.length} event${rows.length===1?'':'s'}</h2>${rows.map(eventCard).join('')||'<p>No events.</p>'}`;$('detailDialog').showModal();bindEventButtons();}
function openEvent(id){const e=all.find(x=>x.id===id);if(!e)return;const f=fmt(e),r=impactRow(e);$('detailContent').innerHTML=`<p class="eyebrow">${esc(e.region)} · ${esc(f.date)} · ${esc(f.time)}</p><h2>${esc(e.title)}</h2><div class="meta"><span class="pill ${esc(e.importance)}">${esc(e.importance)}</span>${e.eventType==='election'?'<span class="pill election-pill">Election</span>':''}<span class="pill impact-${eventImportanceLevel(e)}">${esc(prettyImpact(eventImportanceLevel(e)))}</span></div><p class="detail-copy">${esc(e.summary||'')}</p>${surprisePanel(e)}${impactPanel(r)}<div class="detail-actions"><a class="primary-link" href="${esc(safeUrl(e.sourceUrl))}" target="_blank" rel="noopener">Official source ↗</a><button id="askThisEvent" class="secondary">Ask AI about this event</button></div>`;$('detailDialog').showModal();setTimeout(()=>{const b=$('askThisEvent');if(b)b.onclick=()=>{switchTab('ai');$('detailDialog').close();$('aiQuestion').value=`How much can ${e.title} impact the market?`;askAI($('aiQuestion').value,e);}},0);}
function bindEventButtons(){document.querySelectorAll('.event-open').forEach(b=>b.onclick=()=>openEvent(b.dataset.eventId));}

function impactContext(){const map={};for(const e of all){const r=impactRow(e);if(r)map[e.id]=r;}return{now:new Date().toISOString(),events:futureEvents(),impactByEventId:map,marketPrices,surprises};}
function askAI(question,event=null){let ctx=impactContext();if(event){const rest=ctx.events.filter(e=>e.id!==event.id);ctx.events=[event,...rest];}const r=answerMarketQuestion(question,ctx);$('aiAnswer').innerHTML=`<h3>Answer</h3><p>${esc(r.answer)}</p>${r.evidence.length?`<h4>Evidence used</h4><ul>${r.evidence.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p class="assistant-disclaimer">${esc(r.disclaimer)}</p>`;}
function renderUpdateStatus(status){sourceStatus=status;if(!status?.updatedAt){$('updateState').textContent='Update status unavailable';$('updateBar').classList.add('delayed');return;}const updated=new Date(status.updatedAt);$('updateState').textContent='Data updated';$('lastUpdated').textContent=`Last event run: ${updated.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})} IST`;const sources=Object.values(status.sources||{}),ok=sources.filter(x=>x.status==='ok').length;$('sourceHealth').textContent=sources.length?`${ok}/${sources.length} sources healthy`:'';}
function renderAlertState(){if(!alertState){$('alertState').textContent='No alert has been recorded yet. Configure GitHub Secrets, then run the Telegram Alerts workflow.';return;}const sent=Object.keys(alertState.sent||{}).length;$('alertState').textContent=`Recorded alerts: ${sent}${alertState.updatedAt?` · last state update ${new Date(alertState.updatedAt).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}`:''}`;}
function switchTab(tab){currentTab=tab;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$(`${tab}Panel`)?.classList.add('active');renderMarketStrip();if(tab==='calendar')renderCalendar();if(tab==='movers')renderRanked();window.scrollTo({top:0,behavior:'smooth'});}

$('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('prevMonth').onclick=()=>{calendarMonth--;if(calendarMonth<0){calendarMonth=11;calendarYear--;}renderCalendar();};
$('nextMonth').onclick=()=>{calendarMonth++;if(calendarMonth>11){calendarMonth=0;calendarYear++;}renderCalendar();};
$('todayMonth').onclick=()=>{const d=new Date();calendarYear=d.getFullYear();calendarMonth=d.getMonth();renderCalendar();};
['calendarRegion','calendarMode'].forEach(id=>$(id).onchange=renderCalendar);
['q','country','category','impact'].forEach(id=>$(id).addEventListener(id==='q'?'input':'change',renderRanked));
$('closeDialog').onclick=()=>$('detailDialog').close();
$('aiForm').onsubmit=e=>{e.preventDefault();const q=$('aiQuestion').value.trim();if(q)askAI(q);};
$('suggestedQuestions').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('aiQuestion').value=b.textContent;askAI(b.textContent);});

try{
  const fetchJSON=path=>fetch(path,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(path)));
  const results=await Promise.allSettled([fetchJSON('./events.json'),fetchJSON('./source-status.json'),fetchJSON('./market-impact.json'),fetchJSON('./market-prices.json'),fetchJSON('./surprises.json'),fetchJSON('./alert-state.json')]);
  if(results[0].status!=='fulfilled')throw new Error('events');all=results[0].value;
  if(results[1].status==='fulfilled')renderUpdateStatus(results[1].value);else renderUpdateStatus(null);
  if(results[2].status==='fulfilled')marketImpact=results[2].value;
  if(results[3].status==='fulfilled')marketPrices=results[3].value;
  if(results[4].status==='fulfilled')surprises=results[4].value.events||results[4].value||{};
  if(results[5].status==='fulfilled')alertState=results[5].value;
  $('count').textContent=`${futureEvents().length} upcoming events`;
  renderOverview();renderRegion();renderRanked();renderCalendar();renderMarketStrip();renderAlertState();
}catch(err){$('overviewEvents').innerHTML='<div class="empty">Unable to load events.</div>';console.error(err);}
