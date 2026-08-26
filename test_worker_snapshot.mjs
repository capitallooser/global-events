import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySnapshot, REFRESH_MS} from './worker/src/snapshot.mjs';

test('worker snapshot contract covers every dashboard dataset',()=>{
  assert.equal(REFRESH_MS,60000);
  assert.deepEqual(Object.keys(emptySnapshot('2026-08-27T00:00:00Z')).sort(),
    ['alerts','events','impact','market','news','niftyInNews','sourceStatus','surprises','updatedAt'].sort());
});
