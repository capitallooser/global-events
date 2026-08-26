import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMonthModel, rankEvents, topMovers} from './calendar.mjs';

const events = [
  {id:'a', title:'Low', start:'2026-11-01T10:00:00Z', importance:'low', country:'US', category:'economic'},
  {id:'b', title:'Election', start:'2026-11-03T10:00:00Z', importance:'high', country:'US', category:'politics'},
  {id:'c', title:'CPI', start:'2026-11-12T10:00:00Z', importance:'high', country:'US', category:'economic'},
];
const impacts = {a:{impactScore:.2, impactLevel:'low'}, b:{impactScore:1.5, impactLevel:'very_high'}, c:{impactScore:.9, impactLevel:'high'}};
const lookup = e => impacts[e.id] || null;

test('rankEvents sorts by market impact before date', () => {
  assert.deepEqual(rankEvents(events, lookup).map(e=>e.id), ['b','c','a']);
});

test('topMovers returns requested count', () => {
  assert.deepEqual(topMovers(events, lookup, 2).map(e=>e.id), ['b','c']);
});

test('month model contains 42 cells and marks strongest heat', () => {
  const model = buildMonthModel(events, 2026, 10, lookup);
  assert.equal(model.cells.length, 42);
  const nov3 = model.cells.find(c=>c.iso==='2026-11-03');
  assert.equal(nov3.heat, 'very_high');
  assert.equal(nov3.events[0].id, 'b');
});
