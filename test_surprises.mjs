import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSurprise} from './surprises.mjs';

test('calculates absolute and percentage surprise',()=>{
  assert.deepEqual(calculateSurprise(3.2,3.0),{absolute:0.2,pct:6.67});
});
test('returns null for unavailable forecast',()=>{assert.equal(calculateSurprise(3.2,null),null)});
test('returns null for non numeric values',()=>{assert.equal(calculateSurprise('x',3),null)});
