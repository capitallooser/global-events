import test from 'node:test';
import assert from 'node:assert/strict';
import {answerMarketQuestion} from './market-assistant.mjs';

const context={
  now:'2026-08-27T00:00:00Z',
  events:[
    {id:'cpi',title:'US Consumer Price Index',start:'2026-08-28T12:30:00Z',country:'US',importance:'high',category:'economic'},
    {id:'rbi',title:'RBI Monetary Policy Committee Meeting',start:'2026-09-02T04:00:00Z',country:'IN',importance:'high',category:'central_bank'}
  ],
  impactByEventId:{
    cpi:{impactLevel:'high',impactScore:.91,markets:{nifty:{label:'NIFTY 50',oneDay:{directionReady:true,upPct:58,downPct:42,avgAbsMovePct:.91,sample:24}},sp500:{label:'S&P 500',oneDay:{directionReady:true,upPct:63,downPct:37,avgAbsMovePct:1.08,sample:24}}}}
  }
};

test('answers what can affect nifty tomorrow using upcoming evidence',()=>{
  const r=answerMarketQuestion('What can affect NIFTY tomorrow?',context);
  assert.match(r.answer,/Consumer Price Index/i);
  assert.match(r.disclaimer,/historical/i);
});

test('answers impact question with sample statistics',()=>{
  const r=answerMarketQuestion('How much can CPI impact NIFTY?',context);
  assert.match(r.answer,/0.91%/);
  assert.match(r.answer,/58%/);
  assert.ok(r.evidence.length>0);
});

test('does not promise future direction',()=>{
  const r=answerMarketQuestion('Will NIFTY definitely go up after CPI?',context);
  assert.doesNotMatch(r.answer,/definitely will rise|guaranteed/i);
  assert.match(r.disclaimer,/not a forecast/i);
});
