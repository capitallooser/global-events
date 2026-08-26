import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKET_INSTRUMENTS,normalizeQuote,collectMarket} from './worker/src/market.mjs';

test('worker market contract includes WTI crude and excludes GIFT Nifty',()=>{
  assert.deepEqual(MARKET_INSTRUMENTS.crude,['WTI Crude Oil','CL=F']);
  assert.equal('gift_nifty' in MARKET_INSTRUMENTS,false);
});

test('worker normalizes a live crude quote',()=>{
  const now=new Date('2026-08-27T10:00:00Z');
  const sourceTs=new Date('2026-08-27T09:45:00Z').getTime()/1000;
  const q=normalizeQuote('crude','WTI Crude Oil',65,64,sourceTs,now);
  assert.equal(q.change,1);
  assert.equal(q.changePct,1.563);
  assert.equal(q.status,'Live');
  assert.equal(q.sourceTimestamp,'2026-08-27T09:45:00Z');
});

test('failed live fetch preserves fallback timestamp as Last available',async()=>{
  const fallback={
    instruments:[{key:'crude',label:'WTI Crude Oil',price:64.5,change:1,changePct:1.57,sourceTimestamp:'2026-08-26T10:00:00Z',sourceName:'Yahoo Finance',status:'Delayed'}]
  };
  const fetchImpl=async url=>{
    if(String(url).includes('market-prices.json')) return new Response(JSON.stringify(fallback),{status:200});
    return new Response('upstream unavailable',{status:503});
  };
  const out=await collectMarket(fetchImpl,new Date('2026-08-27T10:00:00Z'));
  const crude=out.instruments.find(x=>x.key==='crude');
  assert.equal(crude.price,64.5);
  assert.equal(crude.status,'Last available');
  assert.equal(crude.sourceTimestamp,'2026-08-26T10:00:00Z');
});
