import test from 'node:test';
import assert from 'node:assert/strict';
import {annotateNewsWithNifty,buildNiftyInNews,reasonForStory} from './worker/src/nifty.mjs';

const constituents=[
  {symbol:'RELIANCE',company:'Reliance Industries Ltd.',industry:'Energy',aliases:['RELIANCE','Reliance Industries Ltd.','Reliance Industries']},
  {symbol:'HDFCBANK',company:'HDFC Bank Limited',industry:'Financial Services',aliases:['HDFCBANK','HDFC Bank Limited','HDFC Bank']},
  {symbol:'ITC',company:'ITC Limited',industry:'Consumer',aliases:['ITC','ITC Limited']}
];

test('company-name matching finds Reliance and symbol matching respects token boundaries',()=>{
  const news=[
    {title:'Reliance Industries wins a major offshore contract',reason:'',publishedAt:'2026-08-27T09:00:00Z',source:'Example',url:'https://example.com/r',relevanceLevel:'high',relevanceScore:70},
    {title:'Critical semiconductor supply improves',reason:'',publishedAt:'2026-08-27T08:00:00Z',source:'Example',url:'https://example.com/x',relevanceLevel:'medium',relevanceScore:45}
  ];
  const out=annotateNewsWithNifty(news,constituents);
  assert.deepEqual(out[0].matchedStocks,['RELIANCE']);
  assert.deepEqual(out[1].matchedStocks,[]);
});

test('reason extraction is deterministic',()=>{
  assert.equal(reasonForStory({title:'Company reports quarterly profit and raises guidance'}),'Earnings / guidance');
  assert.equal(reasonForStory({title:'RBI imposes restrictions on HDFC Bank'}),'RBI / regulatory action');
  assert.equal(reasonForStory({title:'Reliance wins large contract order'}),'Contract / order win');
});

test('stocks-in-news groups stories and exposes the latest reason',()=>{
  const news=annotateNewsWithNifty([
    {title:'Reliance Industries wins large contract order',publishedAt:'2026-08-27T09:00:00Z',source:'Source A',url:'https://example.com/1',relevanceLevel:'high',relevanceScore:72,reason:'Corporate development'},
    {title:'Reliance Industries signs another major order',publishedAt:'2026-08-27T08:00:00Z',source:'Source B',url:'https://example.com/2',relevanceLevel:'medium',relevanceScore:50,reason:'Corporate development'}
  ],constituents);
  const rows=buildNiftyInNews(news,constituents);
  assert.equal(rows.length,1);
  assert.equal(rows[0].symbol,'RELIANCE');
  assert.equal(rows[0].relatedStoryCount,2);
  assert.equal(rows[0].reason,'Contract / order win');
});
