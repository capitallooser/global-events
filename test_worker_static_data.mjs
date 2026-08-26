import test from 'node:test';
import assert from 'node:assert/strict';
import {collectStaticData,STATIC_DATASETS} from './worker/src/static-data.mjs';

test('static dataset contract includes all non-live dashboard data',()=>{
  assert.deepEqual(Object.keys(STATIC_DATASETS).sort(),['alerts','events','impact','sourceStatus','surprises'].sort());
});

test('one failed static dataset does not blank successful datasets',async()=>{
  const payloads={
    'events.json':[ {id:'x',title:'Event'} ],
    'market-impact.json':{eventTypes:{fomc:{impactLevel:'very_high'}}},
    'source-status.json':{updatedAt:'2026-08-27T00:00:00Z',sources:{fed:{status:'ok'}}},
    'alert-state.json':{sent:{a:'2026-08-27T00:00:00Z'}}
  };
  const fetchImpl=async url=>{
    const name=String(url).split('/').pop();
    if(name==='surprises.json')return new Response('down',{status:503});
    return new Response(JSON.stringify(payloads[name]),{status:200,headers:{'content-type':'application/json'}});
  };
  const out=await collectStaticData(fetchImpl);
  assert.equal(out.events.length,1);
  assert.equal(out.impact.eventTypes.fomc.impactLevel,'very_high');
  assert.equal(out.surprises.events instanceof Object,true);
  assert.equal(out.sourceHealth.surprises.status,'error');
  assert.equal(out.sourceHealth.events.status,'ok');
});

test('successful empty event array remains a valid result',async()=>{
  const fetchImpl=async url=>new Response(JSON.stringify(String(url).endsWith('events.json')?[]:{}),{status:200});
  const out=await collectStaticData(fetchImpl);
  assert.deepEqual(out.events,[]);
  assert.equal(out.sourceHealth.events.status,'ok');
});
