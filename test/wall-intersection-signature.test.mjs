import test from 'node:test';
import assert from 'node:assert/strict';
import { difference, intersection, union } from 'polyclip-ts';
import { wallIntersectionSignature as signature, wallIntersectionSignatureFromKey } from '../test-build/wall-intersection-signature.js';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';
import { withWallBooleanBaseline, union as scopedUnion,
  intersection as scopedIntersection } from '../test-build/wall-boolean-cache.js';

const rect = (x0,y0,x1,y1) => [[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]];
const equalMaterial = (a,b) => {
  assert.deepEqual(difference(a,b), []);
  assert.deepEqual(difference(b,a), []);
};
test('#834 internal signature key reuse matches fresh public serialization and never remembers mutable input identity', () => {
  const subject = rect(0,0,2,2), clipping = union(rect(-1,-1,3,3));
  const first = signature(subject,clipping);
  assert.equal(wallIntersectionSignatureFromKey(subject,clipping,JSON.stringify(subject)),first);
  subject[0][1][0] += .25;
  assert.notEqual(signature(subject,clipping),first);
  assert.equal(wallIntersectionSignatureFromKey(subject,clipping,JSON.stringify(subject)),signature(subject,clipping));
});
test('#834 local intersection signature reuses remote changes with exact material and holes', () => {
  const subject = difference(rect(0,0,2,2),rect(.25,.25,.5,.5));
  const before = union(rect(-2,-2,3,3),rect(20,20,21,21));
  const after = union(rect(-4,-2,3,3),rect(30,30,31,31));
  const snapshot = JSON.stringify([subject,before,after]);
  assert.ok(signature(subject,before));
  assert.equal(signature(subject,before),signature(subject,after));
  equalMaterial(intersection(subject,before),intersection(subject,after));
  assert.equal(intersection(subject,after)[0].length,2);
  assert.equal(JSON.stringify([subject,before,after]),snapshot);
  const cut = difference(after,rect(1,1,1.5,1.5));
  assert.notEqual(signature(subject,after),signature(subject,cut));
  assert.equal(intersection(subject,cut)[0].length,3);
});
test('#834 rightward signature retains far-right enclosure and inclusive contacts', () => {
  const subject = rect(0,0,2,2), enclosing = union(rect(-2,-2,100,100)), remote = union(rect(-2,3,100,100));
  assert.notEqual(signature(subject,enclosing),signature(subject,remote));
  equalMaterial(intersection(subject,enclosing),subject);
  assert.deepEqual(intersection(subject,remote),[]);
  assert.notEqual(signature(subject,union(rect(3,2,4,3))),signature(subject,union(rect(3,2+Number.EPSILON*2,4,3))));
  assert.notEqual(signature(subject,union(rect(-1,-1,2,3))),signature(subject,union(rect(-1,-1,2+Number.EPSILON*2,3))));
});
test('#834 signature is full-subject identity and directed edge multiset, never only bbox', () => {
  const subject = rect(0,0,2,2), clip = union(rect(-1,-1,3,3));
  const changed = [[[0,0],[2,0],[1,1],[2,2],[0,2],[0,0]]];
  assert.notEqual(signature(subject,clip),signature(changed,clip));
  // Raw duplicates/reversed rings are not canonical certificates: these checks
  // ensure the pure key cannot erase their multiplicity or directedness.
  assert.notEqual(signature(subject,clip),signature(subject,[...clip,...clip]));
  assert.notEqual(signature(subject,clip),signature(subject,clip.map(p=>p.map(r=>[...r].reverse()))));
  const rawWithRemoteRing = [rect(0,0,1,1)[0],rect(10,10,11,11)[0].reverse()];
  assert.notEqual(signature(rawWithRemoteRing,union(rect(9,9,12,12))),signature(rawWithRemoteRing,union(rect(9,9,13,12))));
  const twoComponents = union(rect(0,0,1,1),rect(10,10,11,11));
  assert.notEqual(signature(twoComponents,union(rect(9,9,12,12))),signature(twoComponents,union(rect(9,9,13,12))));
});
test('#834 signature rejects malformed/nonfinite/unclosed/oversized input and handles empty clipping', () => {
  const valid = union(rect(0,0,2,2));
  for (const malformed of [null,[[]],[[[]]],[[[[0,0],[1,0],[1,1],[0,1]]]],[[[[0,0],[1,0],[1,Infinity],[0,0]]]],[[[[0,0],[1,0],[NaN,1],[0,0]]]],[[[[0,0,0],[1,0],[1,1],[0,0,0]]]]]) {
    assert.equal(signature(malformed,valid),null);
    assert.equal(signature(valid,malformed),null);
  }
  assert.equal(signature([],valid),null);
  assert.ok(signature(valid,[]));
  assert.equal(signature([[Array.from({length:30_000},()=>[123456789,123456789])]],valid),null);
});

test('#834 intersection reuse preserves the nonzero-rule material of an unchanged self-crossing raw subject', () => {
  const subject = [[[0,0],[4,4],[0,4],[4,0],[0,0]]], cache = new WallBooleanBaseline();
  const snapshot = structuredClone(subject);
  let before, baseline;
  withWallBooleanBaseline(cache, true, () => {
    before = scopedUnion(rect(-1,-1,5,5));
    baseline = scopedIntersection(subject, before);
  });
  assert.equal(baseline.length, 2, 'the real boolean resolves the bow tie into two filled triangles');
  assert.notDeepEqual(baseline, [subject], 'raw A is not silently assumed to be canonical');
  const after = withWallBooleanBaseline(cache, false, () => scopedUnion(rect(-2,-1,5,5)));
  assert.notDeepEqual(after, before, 'the ordinary full-operands key cannot supply this result');
  assert.equal(signature(subject, before), signature(subject, after));
  const hits = cache.reuseCounts.hits;
  const actual = withWallBooleanBaseline(cache, false, () => scopedIntersection(subject, after));
  assert.equal(cache.reuseCounts.hits, hits + 1, 'the wrapper actually uses the local signature');
  equalMaterial(actual, intersection(subject, after));
  assert.deepEqual(actual, baseline);
  assert.deepEqual(subject, snapshot, 'the raw self-crossing input is never rewritten');
});

test('#834 a successful empty intersection is a real copied hit after a remote certified clipping change', () => {
  const subject = rect(0,0,2,2), cache = new WallBooleanBaseline();
  let before, baseline;
  withWallBooleanBaseline(cache, true, () => {
    before = scopedUnion(rect(-4,-1,-2,3));
    baseline = scopedIntersection(subject, before);
  });
  assert.deepEqual(baseline, [], 'the original operation succeeds with an empty set');
  const after = withWallBooleanBaseline(cache, false, () => scopedUnion(rect(-6,-1,-3,3)));
  assert.notDeepEqual(after, before);
  assert.equal(signature(subject, before), signature(subject, after));
  const hits = cache.reuseCounts.hits, stored = cache.reuseCounts.stored;
  const first = withWallBooleanBaseline(cache, false, () => scopedIntersection(subject, after));
  assert.equal(cache.reuseCounts.hits, hits + 1, 'empty does not mean cache miss');
  assert.deepEqual(first, []);
  assert.notStrictEqual(first, baseline, 'the empty baseline is not lent to its caller');
  first.push(rect(100,100,101,101));
  const second = withWallBooleanBaseline(cache, false, () => scopedIntersection(subject, after));
  assert.equal(cache.reuseCounts.hits, hits + 2);
  assert.deepEqual(second, [], 'mutating the first returned array cannot add cached material');
  assert.deepEqual(baseline, []);
  equalMaterial(second, intersection(subject, after));
  assert.equal(cache.reuseCounts.stored, stored, 'candidate reuse cannot grow the frozen table');
});
