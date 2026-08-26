export const NEWS_FEEDS=[
  {name:'India Market News',region:'IN',url:'https://news.google.com/rss/search?q=India%20stock%20market%20OR%20RBI%20OR%20Nifty&hl=en-IN&gl=IN&ceid=IN:en'},
  {name:'US Market News',region:'US',url:'https://news.google.com/rss/search?q=Federal%20Reserve%20OR%20US%20stocks%20OR%20S%26P%20500&hl=en-US&gl=US&ceid=US:en'},
  {name:'Global Market News',region:'GLOBAL',url:'https://news.google.com/rss/search?q=global%20markets%20OR%20oil%20OR%20ECB%20OR%20Bank%20of%20England&hl=en-US&gl=US&ceid=US:en'},
  {name:'Federal Reserve',region:'US',official:true,url:'https://www.federalreserve.gov/feeds/press_all.xml'}
];

const CATEGORY_RULES=[
  ['central_bank',/\b(federal reserve|fomc|fed\b|rbi\b|reserve bank of india|ecb\b|bank of england|interest rate|repo rate|policy rate|monetary policy)\b/i],
  ['inflation_macro',/\b(cpi\b|inflation|gdp\b|jobs report|nonfarm|nfp\b|ppi\b|iip\b|wpi\b|industrial production|unemployment)\b/i],
  ['geopolitics',/\b(war|missile|sanction|ceasefire|border conflict|geopolit|military strike|invasion)\b/i],
  ['government_regulation',/\b(regulator|regulation|government|ministry|sec\b|sebi\b|antitrust|tariff|tax policy|ban\b|approval)\b/i],
  ['oil_commodities',/\b(opec|crude|oil price|brent|wti\b|gold price|commodity|commodities)\b/i],
  ['earnings_guidance',/\b(earnings|profit|revenue|guidance|quarterly results|results beat|results miss)\b/i],
  ['corporate_actions',/\b(merger|acquisition|acquire|buyback|stake sale|stake purchase|fundraising|rights issue|dividend|split\b)\b/i],
  ['banking_credit',/\b(bank|credit|loan|liquidity|deposit|rating action|downgrade|upgrade)\b/i],
  ['technology',/\b(ai\b|artificial intelligence|semiconductor|chip|technology|software|cloud)\b/i],
  ['crypto',/\b(bitcoin|ethereum|crypto|cryptocurrency|stablecoin)\b/i]
];

const SOURCE_WEIGHT={
  'Federal Reserve':25,'Reserve Bank of India':25,'European Central Bank':25,'Bank of England':25,
  'Reuters':16,'Bloomberg':16,'CNBC':12,'Financial Times':15,'Moneycontrol':10,'Economic Times':10
};

const REASON_BY_CATEGORY={
  central_bank:'Central-bank / rates development',inflation_macro:'Inflation / macro data',geopolitics:'Geopolitical development',
  government_regulation:'Government / regulatory development',oil_commodities:'Oil / commodities development',
  earnings_guidance:'Earnings / guidance update',corporate_actions:'Corporate action / M&A development',
  banking_credit:'Banking / credit development',technology:'Technology-sector development',crypto:'Crypto-market development',
  other_market_moving:'Broader market-moving development'
};

function decodeXml(value=''){
  return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
function tagValue(block,tag){
  const m=String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'i'));
  return m?decodeXml(m[1]):'';
}
function atomLink(block){
  const m=String(block).match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return m?m[1]:'';
}
function normalizeUrl(raw=''){
  try{
    const u=new URL(raw);
    for(const k of [...u.searchParams.keys()]) if(/^utm_|^(gclid|fbclid)$/i.test(k)) u.searchParams.delete(k);
    u.hash='';
    const qs=u.searchParams.toString();
    return `${u.origin}${u.pathname}${qs?`?${qs}`:''}`;
  }catch{return raw.trim();}
}
function headlineKey(value=''){return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function hashText(value=''){
  let h=2166136261;
  for(const ch of value){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return (h>>>0).toString(36);
}

export function classifyCategory(text=''){
  for(const [name,re] of CATEGORY_RULES) if(re.test(text)) return name;
  return 'other_market_moving';
}

export function classifyRegion(text='',hint='GLOBAL'){
  const t=text.toLowerCase();
  if(/\b(rbi|reserve bank of india|nifty|sensex|sebi|india|indian)\b/.test(t)) return 'IN';
  if(/\b(federal reserve|fomc|s&p|nasdaq|united states|u\.s\.|wall street)\b/.test(t)) return 'US';
  return hint||'GLOBAL';
}

export function relevanceLevel(score){
  if(score>=85)return 'very_high';
  if(score>=65)return 'high';
  if(score>=40)return 'medium';
  return 'low';
}

export function scoreNewsItem(item,now=new Date()){
  let score=15;
  score+=SOURCE_WEIGHT[item.source]||0;
  if(item.official) score+=20;
  const ageHours=Math.max(0,(now-new Date(item.publishedAt))/3600000);
  score+=ageHours<=1?22:ageHours<=6?16:ageHours<=24?10:ageHours<=48?4:0;
  if(['central_bank','geopolitics','government_regulation'].includes(item.category)) score+=18;
  else if(['inflation_macro','oil_commodities','earnings_guidance','corporate_actions'].includes(item.category)) score+=13;
  if(/\b(emergency|surprise|unexpected|crisis|war|sanction|rate cut|rate hike|default|bankruptcy|record high|record low)\b/i.test(item.title||'')) score+=12;
  if(/\b(nifty|sensex|s&p|nasdaq|bitcoin|gold|wti|crude|usd\/inr|rupee|federal reserve|rbi|ecb|bank of england)\b/i.test(item.title||'')) score+=8;
  score+=Math.min(10,(item.matchedStocks||[]).length*4);
  score+=Math.min(10,Math.max(0,(item.corroboration||1)-1)*3);
  return Math.max(0,Math.min(100,Math.round(score)));
}

export function dedupeNews(items){
  const out=[];
  for(const row of [...items].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt))){
    const urlKey=normalizeUrl(row.url||'');
    const hKey=headlineKey(row.title||'');
    const published=new Date(row.publishedAt).getTime();
    const match=out.find(x=>{
      if(urlKey&&normalizeUrl(x.url||'')===urlKey) return true;
      return headlineKey(x.title||'')===hKey&&Math.abs(new Date(x.publishedAt).getTime()-published)<=6*3600000;
    });
    if(match){
      match.corroboration=(match.corroboration||1)+1;
      const sources=new Set([...(match.corroboratingSources||[match.source]),row.source].filter(Boolean));
      match.corroboratingSources=[...sources];
      continue;
    }
    out.push({...row,url:urlKey||row.url,corroboration:row.corroboration||1,corroboratingSources:[row.source].filter(Boolean)});
  }
  return out;
}

export function parseFeed(xml,feed){
  const blocks=[...String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(x=>x[1]);
  if(!blocks.length) blocks.push(...[...String(xml).matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map(x=>x[1]));
  return blocks.map(block=>{
    const title=tagValue(block,'title');
    const url=tagValue(block,'link')||atomLink(block)||tagValue(block,'guid');
    const publishedRaw=tagValue(block,'pubDate')||tagValue(block,'published')||tagValue(block,'updated');
    const description=tagValue(block,'description')||tagValue(block,'summary');
    const embeddedSource=tagValue(block,'source');
    const source=embeddedSource||feed.name;
    const text=`${title} ${description}`;
    const category=classifyCategory(text);
    const region=classifyRegion(text,feed.region);
    const published=new Date(publishedRaw||Date.now());
    return {
      id:`news-${hashText(`${title}|${url}|${published.toISOString()}`)}`,
      title,url,source,publishedAt:published.toISOString(),region,category,
      relevanceScore:0,relevanceLevel:'low',reason:REASON_BY_CATEGORY[category]||REASON_BY_CATEGORY.other_market_moving,
      matchedStocks:[],corroboration:1,official:!!feed.official
    };
  }).filter(x=>x.title&&x.url);
}

export async function collectNews(fetchImpl=fetch,now=new Date()){
  const all=[]; const sourceHealth={};
  for(const feed of NEWS_FEEDS){
    try{
      const res=await fetchImpl(feed.url,{headers:{'accept':'application/rss+xml, application/atom+xml, text/xml, */*','user-agent':'GlobalEventsMarketIntelligence/4.0'}});
      if(!res.ok) throw new Error(`${res.status} ${res.statusText||'feed failed'}`);
      const rows=parseFeed(await res.text(),feed);
      all.push(...rows);
      sourceHealth[feed.name]={status:'ok',items:rows.length};
    }catch(error){sourceHealth[feed.name]={status:'error',error:String(error).slice(0,180)};}
  }
  const items=dedupeNews(all).map(row=>{
    const relevanceScore=scoreNewsItem(row,now);
    return {...row,relevanceScore,relevanceLevel:relevanceLevel(relevanceScore)};
  }).sort((a,b)=>b.relevanceScore-a.relevanceScore||new Date(b.publishedAt)-new Date(a.publishedAt));
  return {items,sourceHealth};
}
