const FALLBACK_URL='https://capitallooser.github.io/global-events/market-prices.json';

export const MARKET_INSTRUMENTS={
  nifty:['NIFTY 50','^NSEI'],
  banknifty:['Bank NIFTY','^NSEBANK'],
  sensex:['Sensex','^BSESN'],
  sp500:['S&P 500','^GSPC'],
  nasdaq:['Nasdaq Composite','^IXIC'],
  gold:['Gold','GC=F'],
  crude:['WTI Crude Oil','CL=F'],
  usdinr:['USD/INR','INR=X'],
  bitcoin:['Bitcoin','BTC-USD']
};

const isoFromTs=ts=>new Date(Number(ts)*1000).toISOString().replace('.000Z','Z');

export function normalizeQuote(key,label,price,previousClose,sourceTs,now=new Date()){
  const p=Number(price), prev=previousClose==null?null:Number(previousClose);
  const change=prev&&Number.isFinite(prev)?p-prev:null;
  const pct=change==null?null:(change/prev*100);
  const age=Math.max(0,now.getTime()/1000-Number(sourceTs));
  const status=age<=45*60?'Live':age<=24*3600?'Delayed':'Last available';
  return {
    key,label,price:Number(p.toFixed(4)),
    change:change==null?null:Number(change.toFixed(4)),
    changePct:pct==null?null:Number(pct.toFixed(3)),
    sourceTimestamp:isoFromTs(sourceTs),sourceName:'Yahoo Finance',status
  };
}

function unavailable(key,label,error){
  return {key,label,price:null,change:null,changePct:null,sourceTimestamp:null,sourceName:null,status:'Unavailable',error:String(error||'unavailable').slice(0,180)};
}

function fallbackRow(key,label,row,error){
  if(!row||row.price==null) return unavailable(key,label,error);
  return {...row,key,label,status:'Last available',error:String(error||'live source unavailable').slice(0,180)};
}

async function fetchJson(fetchImpl,url){
  const res=await fetchImpl(url,{headers:{'accept':'application/json'}});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText||'fetch failed'}`);
  return res.json();
}

async function fetchYahoo(fetchImpl,key,label,symbol,now){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d&includePrePost=true`;
  const payload=await fetchJson(fetchImpl,url);
  const result=payload?.chart?.result?.[0];
  if(!result) throw new Error(`no data for ${symbol}`);
  const meta=result.meta||{};
  const ts=result.timestamp||[];
  const closes=result.indicators?.quote?.[0]?.close||[];
  let sourceTs=meta.regularMarketTime, price=meta.regularMarketPrice;
  for(let i=ts.length-1;i>=0;i--){
    if(closes[i]!=null){sourceTs=ts[i];price=closes[i];break;}
  }
  const prev=meta.chartPreviousClose??meta.previousClose;
  if(price==null||sourceTs==null) throw new Error(`incomplete quote for ${symbol}`);
  return normalizeQuote(key,label,price,prev,sourceTs,now);
}

export async function collectMarket(fetchImpl=fetch,now=new Date()){
  let fallback={instruments:[]};
  try{fallback=await fetchJson(fetchImpl,FALLBACK_URL);}catch{}
  const cached=new Map((fallback.instruments||[]).map(x=>[x.key,x]));
  const rows=[]; const sourceHealth={};
  for(const [key,[label,symbol]] of Object.entries(MARKET_INSTRUMENTS)){
    try{
      const row=await fetchYahoo(fetchImpl,key,label,symbol,now);
      rows.push(row); sourceHealth[key]={status:'ok',symbol};
    }catch(error){
      const row=fallbackRow(key,label,cached.get(key),error);
      rows.push(row); sourceHealth[key]={status:'error',error:row.error};
    }
  }
  return {updatedAt:now.toISOString(),instruments:rows,sourceHealth};
}
