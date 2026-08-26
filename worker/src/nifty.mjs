const OFFICIAL_URL='https://archives.nseindia.com/content/indices/ind_nifty50list.csv';
const FALLBACK_URL='https://capitallooser.github.io/global-events/nifty50.json';

const escRe=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const legalSuffix=s=>String(s||'').replace(/\s+(?:limited|ltd\.?)\.?$/i,'').trim();

export function parseNiftyCsv(text=''){
  const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if(lines.length<2)return [];
  const header=splitCsvLine(lines[0]);
  const idx=name=>header.findIndex(x=>x.trim().toLowerCase()===name.toLowerCase());
  const ci=idx('Company Name'), ii=idx('Industry'), si=idx('Symbol');
  const seen=new Set(), out=[];
  for(const line of lines.slice(1)){
    const cols=splitCsvLine(line), symbol=(cols[si]||'').trim().toUpperCase(), company=(cols[ci]||'').trim(), industry=(cols[ii]||'').trim();
    if(!symbol||!company||seen.has(symbol))continue; seen.add(symbol);
    const aliases=[symbol,company,legalSuffix(company)].filter((x,i,a)=>x&&a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i);
    out.push({symbol,company,industry,aliases});
  }
  return out;
}

function splitCsvLine(line){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;
    }else if(c===','&&!quoted){out.push(cur);cur='';}else cur+=c;
  }
  out.push(cur);return out;
}

export async function loadNiftyConstituents(fetchImpl=fetch){
  try{
    const r=await fetchImpl(OFFICIAL_URL,{headers:{'accept':'text/csv,*/*','user-agent':'GlobalEventsMarketIntelligence/4.0'}});
    if(!r.ok)throw new Error(`official ${r.status}`);
    const rows=parseNiftyCsv(await r.text());
    if(rows.length<40)throw new Error(`official source returned ${rows.length} rows`);
    return {constituents:rows,source:OFFICIAL_URL,status:'ok'};
  }catch(officialError){
    try{
      const r=await fetchImpl(FALLBACK_URL,{headers:{'accept':'application/json'}});
      if(!r.ok)throw new Error(`fallback ${r.status}`);
      const payload=await r.json();
      return {constituents:payload.constituents||[],source:FALLBACK_URL,status:(payload.constituents||[]).length?'fallback':'empty',error:String(officialError).slice(0,180)};
    }catch(fallbackError){
      return {constituents:[],source:null,status:'error',error:`${officialError}; ${fallbackError}`.slice(0,180)};
    }
  }
}

function aliasMatches(text,alias,symbol){
  if(!alias)return false;
  if(alias.toUpperCase()===symbol){
    return new RegExp(`(^|[^A-Z0-9])${escRe(symbol)}([^A-Z0-9]|$)`,'i').test(text);
  }
  return new RegExp(`\\b${escRe(alias).replace(/\\ /g,'\\s+')}\\b`,'i').test(text);
}

export function annotateNewsWithNifty(news,constituents){
  return (news||[]).map(story=>{
    const text=`${story.title||''} ${story.reason||''}`;
    const matched=(constituents||[]).filter(c=>(c.aliases||[c.symbol,c.company]).some(a=>aliasMatches(text,a,c.symbol))).map(c=>c.symbol);
    return {...story,matchedStocks:[...new Set(matched)]};
  });
}

export function reasonForStory(story){
  const t=`${story?.title||''} ${story?.reason||''}`.toLowerCase();
  if(/\b(quarter|quarterly|earnings|profit|revenue|guidance|results)\b/.test(t))return 'Earnings / guidance';
  if(/\b(rbi|reserve bank of india|sebi|regulator|regulatory|restriction|penalty)\b/.test(t))return 'RBI / regulatory action';
  if(/\b(contract|order win|wins? (?:a |an )?(?:large |major )?order|deal win|award(?:ed)? order)\b/.test(t))return 'Contract / order win';
  if(/\b(merger|acquisition|acquire|takeover|amalgamation)\b/.test(t))return 'M&A / corporate action';
  if(/\b(capex|capacity expansion|new plant|expansion plan|investment plan)\b/.test(t))return 'Capex / expansion';
  if(/\b(stake sale|stake purchase|buys stake|sells stake)\b/.test(t))return 'Stake transaction';
  if(/\b(fundrais|rights issue|bond issue|qip\b|capital raise)\b/.test(t))return 'Fundraising';
  if(/\b(rating upgrade|rating downgrade|credit rating|ratings action)\b/.test(t))return 'Rating action';
  if(/\b(ceo|cfo|chairman|management change|resigns?|appoints?|appointment)\b/.test(t))return 'Management change';
  if(/\b(court|lawsuit|litigation|tribunal|legal action)\b/.test(t))return 'Litigation / legal';
  if(/\b(crude|oil price|commodity|metal price)\b/.test(t))return 'Commodity exposure';
  return 'Company-specific development';
}

const LEVEL_RANK={very_high:4,high:3,medium:2,low:1};

export function buildNiftyInNews(news,constituents){
  const bySymbol=new Map();
  const cMap=new Map((constituents||[]).map(c=>[c.symbol,c]));
  for(const story of news||[]){
    for(const symbol of story.matchedStocks||[]){
      if(!cMap.has(symbol))continue;
      if(!bySymbol.has(symbol))bySymbol.set(symbol,[]);
      bySymbol.get(symbol).push(story);
    }
  }
  const rows=[];
  for(const [symbol,stories] of bySymbol){
    stories.sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
    const reasons=stories.map(reasonForStory);
    const counts=new Map(); for(const r of reasons)counts.set(r,(counts.get(r)||0)+1);
    const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
    const reason=ranked.length===1||ranked[0][1]>stories.length/2?ranked[0][0]:'Multiple related developments';
    const best=[...stories].sort((a,b)=>(LEVEL_RANK[b.relevanceLevel]||0)-(LEVEL_RANK[a.relevanceLevel]||0)||b.relevanceScore-a.relevanceScore)[0];
    const c=cMap.get(symbol);
    rows.push({
      symbol,company:c.company,industry:c.industry||'',relevanceLevel:best.relevanceLevel||'low',relevanceScore:best.relevanceScore||0,
      reason,latestHeadline:stories[0].title,relatedStoryCount:stories.length,publishedAt:stories[0].publishedAt,
      sources:[...new Set(stories.map(s=>s.source).filter(Boolean))],url:stories[0].url
    });
  }
  return rows.sort((a,b)=>b.relevanceScore-a.relevanceScore||new Date(b.publishedAt)-new Date(a.publishedAt));
}
