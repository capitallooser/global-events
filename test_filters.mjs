import test from 'node:test';
import assert from 'node:assert/strict';
import {filterEvents} from './core.mjs';

const NOW=new Date('2026-08-27T00:00:00Z');
const events=[
 {id:'in-cpi',title:'India CPI',summary:'inflation',start:'2026-08-28T12:00:00Z',country:'IN',region:'India',category:'economic',importance:'high'},
 {id:'us-fed',title:'FOMC Decision',summary:'rates',start:'2026-08-29T12:00:00Z',country:'US',region:'United States',category:'central_bank',importance:'high'},
 {id:'in-holiday',title:'India Holiday',summary:'market closed',start:'2026-09-01T00:00:00Z',country:'IN',region:'India',category:'holiday',importance:'medium'},
 {id:'us-old',title:'US old',summary:'old',start:'2026-08-26T12:00:00Z',country:'US',region:'United States',category:'economic',importance:'low'}
];
const impacts={
 'in-cpi':{impactLevel:'high',impactScore:0.8},
 'us-fed':{impactLevel:'very_high',impactScore:1.7}
};
const impactLookup=e=>impacts[e.id]||null;

test('forced country overrides free country selection for region tabs',()=>{
 const out=filterEvents(events,{window:'30d',country:'US',forcedCountry:'IN',category:'all',importance:'all',query:''},NOW,impactLookup);
 assert.deepEqual(out.map(x=>x.id),['in-cpi','in-holiday']);
});

test('historical impact filter includes no-history events correctly',()=>{
 const out=filterEvents(events,{window:'30d',country:'all',category:'all',importance:'all',query:'',impact:'no_history'},NOW,impactLookup);
 assert.deepEqual(out.map(x=>x.id),['in-holiday']);
});

test('impact sort ranks by impact score then date',()=>{
 const out=filterEvents(events,{window:'30d',country:'all',category:'all',importance:'all',query:'',impact:'all',sort:'impact'},NOW,impactLookup);
 assert.deepEqual(out.map(x=>x.id),['us-fed','in-cpi','in-holiday']);
});

test('legacy search, category and importance filters still combine',()=>{
 const out=filterEvents(events,{window:'7d',country:'all',category:'economic',importance:'high',query:'inflation',impact:'all',sort:'date'},NOW,impactLookup);
 assert.deepEqual(out.map(x=>x.id),['in-cpi']);
});

test('live refresh policy uses 2 minute market and 5 minute dashboard intervals',async()=>{
 const core=await import('./core.mjs');
 assert.deepEqual(core.LIVE_REFRESH_MS,{market:120000,data:300000});
});
