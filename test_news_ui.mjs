import test from 'node:test';
import assert from 'node:assert/strict';
import {filterNews,groupNiftyNews} from './news-ui.mjs';

const items=[
 {id:'a',title:'RBI policy decision',reason:'Rates',region:'IN',category:'central_bank',source:'RBI',relevanceLevel:'very_high',matchedStocks:[]},
 {id:'b',title:'Reliance contract win',reason:'Order',region:'IN',category:'corporate_actions',source:'Example',relevanceLevel:'high',matchedStocks:['RELIANCE']},
 {id:'c',title:'US market wrap',reason:'Session recap',region:'US',category:'other_market_moving',source:'Example',relevanceLevel:'low',matchedStocks:[]}
];

test('overview mode keeps only high and very high relevance',()=>{
 const out=filterNews(items,{mode:'overview',region:'all',relevance:'all',category:'all',source:'all',niftyOnly:false,query:''});
 assert.deepEqual(out.map(x=>x.id),['a','b']);
});

test('News tab filters can show every relevance level',()=>{
 const out=filterNews(items,{mode:'all',region:'all',relevance:'all',category:'all',source:'all',niftyOnly:false,query:''});
 assert.deepEqual(out.map(x=>x.id),['a','b','c']);
});

test('NIFTY-only and text filters combine with region/category/source',()=>{
 const out=filterNews(items,{mode:'all',region:'IN',relevance:'high',category:'corporate_actions',source:'Example',niftyOnly:true,query:'contract'});
 assert.deepEqual(out.map(x=>x.id),['b']);
});

test('groupNiftyNews sorts highest relevance first without mutating input',()=>{
 const rows=[{symbol:'A',relevanceScore:40,publishedAt:'2026-08-27T09:00:00Z'},{symbol:'B',relevanceScore:80,publishedAt:'2026-08-27T08:00:00Z'}];
 const copy=[...rows];
 assert.deepEqual(groupNiftyNews(rows).map(x=>x.symbol),['B','A']);
 assert.deepEqual(rows,copy);
});
