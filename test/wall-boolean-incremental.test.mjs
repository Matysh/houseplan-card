import test from 'node:test';
import assert from 'node:assert/strict';
import * as canonical from 'polyclip-ts';
import { WallBooleanBaseline } from '../test-build/wall-boolean-baseline.js';
import { withWallBooleanBaseline, union, difference, intersection } from '../test-build/wall-boolean-cache.js';

const rect = (x, y, width, height) => [[[x, y], [x + width, y],
  [x + width, y + height], [x, y + height], [x, y]]];
const run = (cache, record, work) => withWallBooleanBaseline(cache, record, work);
function equivalent(actual, expected, label) {
  assert.deepEqual(canonical.difference(actual, expected), [], `${label}: no extra material`);
  assert.deepEqual(canonical.difference(expected, actual), [], `${label}: no missing material`);
}
function setup(cuts = [rect(1, 1, 2, 2)], operation = difference) {
  const cache = new WallBooleanBaseline();
  let baseline;
  run(cache, true, () => {
    const subject = union(rect(0, 0, 10, 10));
    baseline = operation(subject, ...cuts);
  });
  return { cache, cuts, baseline };
}

test('834 incremental wrapper reuses a certified local extension and preserves the exact hole', () => {
  const { cache, cuts } = setup();
  const stored = cache.counts.stored, incrementalStored = cache.reuseCounts.stored;
  const subject = run(cache, false, () => union(rect(0, 0, 12, 10)));
  const before = structuredClone(subject);
  const result = run(cache, false, () => difference(subject, ...cuts));
  equivalent(result, canonical.difference(subject, ...cuts), 'incremental difference');
  assert.equal(result[0].length, 2, 'the unchanged cut remains a hole of its original outer');
  assert.equal(cache.reuseCounts.hits, 1, 'the shortcut, not just the ordinary boolean, was exercised');
  assert.deepEqual(subject, before, 'the candidate is not rewritten');
  assert.equal(cache.counts.stored, stored);
  assert.equal(cache.reuseCounts.stored, incrementalStored);
});

test('834 incremental union retains its fixed external arm while extending the remote boundary', () => {
  const fixed = [rect(-2, 1, 3, 2)], { cache } = setup(fixed, union);
  const subject = run(cache, false, () => union(rect(0, 0, 12, 10)));
  const actual = run(cache, false, () => union(subject, ...fixed));
  equivalent(actual, canonical.union(subject, ...fixed), 'incremental union');
  assert.equal(cache.reuseCounts.hits, 1);
  assert.equal(actual.length, 1, 'the joined arm is not an overlapping independent component');
});

test('834 complete canonical value certificates recognize exact deep clones, not array identity', () => {
  const { cache, cuts } = setup();
  const known = run(cache, false, () => union(rect(0, 0, 12, 10)));
  const clone = structuredClone(known);
  assert.notStrictEqual(clone, known);
  const result = run(cache, false, () => difference(clone, ...structuredClone(cuts)));
  equivalent(result, canonical.difference(clone, ...cuts), 'a cloned known value');
  assert.equal(cache.reuseCounts.hits, 1);

  const attempts = cache.reuseCounts.attempts;
  // This is still the same certified object, but its complete value is now a
  // different (valid) polygon. A WeakSet-only certificate would be stale.
  known[0][0][1][0] += .25;
  const modified = run(cache, false, () => difference(known, ...cuts));
  equivalent(modified, canonical.difference(known, ...cuts), 'mutated formerly known input');
  assert.equal(cache.reuseCounts.attempts, attempts, 'changed coordinates require an ordinary canonical operation');
  assert.equal(cache.reuseCounts.hits, 1);
});

test('834 uncertified canonical-looking input cannot enter boundary reuse', () => {
  const { cache, cuts } = setup();
  const outsideScope = canonical.union(rect(0, 0, 12, 10));
  const attempts = cache.reuseCounts.attempts;
  const actual = run(cache, false, () => difference(outsideScope, ...cuts));
  equivalent(actual, canonical.difference(outsideScope, ...cuts), 'unknown provenance');
  assert.equal(cache.reuseCounts.attempts, attempts);
  assert.equal(cache.reuseCounts.hits, 0);
});

test('834 caller mutation of an incremental result cannot poison the frozen baseline', () => {
  const { cache, cuts, baseline } = setup(), savedBaseline = structuredClone(baseline);
  const subject = run(cache, false, () => union(rect(0, 0, 12, 10)));
  const expected = canonical.difference(subject, ...cuts);
  const first = run(cache, false, () => difference(subject, ...cuts));
  assert.equal(cache.reuseCounts.hits, 1);
  first[0][0][0][0] = 999;
  first[0][1][0][0] = 777;
  const second = run(cache, false, () => difference(structuredClone(subject), ...cuts));
  equivalent(second, expected, 'next candidate after output mutation');
  assert.equal(cache.reuseCounts.hits, 2, 'reuse remains valid without lending mutable cached rings');
  assert.deepEqual(baseline, savedBaseline);
  const capturedAgain = run(cache, false, () => difference(canonical.union(rect(0, 0, 10, 10)), ...cuts));
  assert.deepEqual(capturedAgain, savedBaseline, 'the ordinary full-key baseline is also isolated');
});

test('834 operation, ordered fixed operands, exact coordinates and arity are separate reuse groups', () => {
  const cuts = [rect(1, 1, 2, 2), rect(5, 1, 1, 1)];
  const { cache } = setup(cuts);
  const subject = run(cache, false, () => union(rect(0, 0, 12, 10)));
  const changed = structuredClone(cuts);
  changed[1][0][1][0] += Number.EPSILON * 8;
  assert.notDeepEqual(changed, cuts, 'the test changes an exactly representable coordinate');
  const cases = [
    ['union', union, cuts],
    ['difference', difference, [...cuts].reverse()],
    ['difference', difference, cuts.slice(0, 1)],
    ['difference', difference, changed],
    ['intersection', intersection, cuts],
  ];
  for (const [name, operation, operands] of cases) {
    const hits = cache.reuseCounts.hits, attempts = cache.reuseCounts.attempts;
    const actual = run(cache, false, () => operation(subject, ...operands));
    equivalent(actual, canonical[name](subject, ...operands), `${name}: distinct fixed inputs`);
    assert.equal(cache.reuseCounts.hits, hits);
    assert.equal(cache.reuseCounts.attempts, attempts, 'not even an attempted cross-group shortcut');
  }
  const exactGroup = run(cache, false, () => difference(subject, ...cuts));
  equivalent(exactGroup, canonical.difference(subject, ...cuts), 'the unchanged ordered group');
  assert.equal(cache.reuseCounts.hits, 1);
});

test('834 failed baseline booleans record neither reusable results nor canonical certificates', () => {
  const cache = new WallBooleanBaseline();
  const subject = run(cache, true, () => union(rect(0, 0, 10, 10)));
  const malformed = [[[0, 0], [1, 0], ['not-a-coordinate', 1], [0, 0]]];
  assert.throws(() => canonical.difference(subject, malformed), /not a valid Polygon or MultiPolygon/,
    'the witness is a genuine library failure, not a valid empty result');
  const stored = cache.counts.stored, incremental = structuredClone(cache.reuseCounts);
  assert.throws(() => run(cache, true, () => difference(subject, malformed)));
  assert.equal(cache.counts.stored, stored);
  assert.deepEqual(cache.reuseCounts, incremental, 'a throwing boolean creates no remembered geometry');
  assert.throws(() => run(cache, false, () => difference(subject, malformed)),
    'an unsuccessful baseline can never turn a later failure into a shortcut result');
  assert.equal(cache.reuseCounts.hits, 0);
});

test('834 pointer streams keep the frozen tables fixed and evict bounded canonical certificates', () => {
  const { cache, cuts } = setup();
  const stored = cache.counts.stored, incrementalStored = cache.reuseCounts.stored;
  for (let index = 1; index <= 300; index++) {
    const subject = run(cache, false, () => union(rect(0, 0, 10 + index / 10, 10)));
    const result = run(cache, false, () => difference(subject, ...cuts));
    if (index === 1 || index === 150 || index === 300)
      equivalent(result, canonical.difference(subject, ...cuts), `pointer ${index}`);
    assert.equal(cache.counts.stored, stored, 'no ordinary candidate history');
    assert.equal(cache.reuseCounts.stored, incrementalStored, 'no incremental candidate history');
    assert.ok(cache.reuseCounts.known <= 256, 'canonical certificates have a fixed entry bound');
    assert.ok(cache.reuseCounts.characters <= 1_000_000, 'combined certificate/baseline text has a fixed byte-character bound');
  }
  assert.equal(cache.reuseCounts.hits, 300, 'the bound does not disable the actual proven workload');
  assert.equal(cache.reuseCounts.known, 256, 'the stream exercised eviction, not just a small cache');
});

test('834 baseline incremental table is bounded independently of the ordinary full-key cache', () => {
  const cache = new WallBooleanBaseline();
  run(cache, true, () => {
    for (let index = 0; index < 280; index++) {
      const x = index * 20, subject = union(rect(x, 0, 10, 10));
      difference(subject, rect(x + 1, 1, 2, 2));
    }
  });
  assert.equal(cache.counts.stored, 512);
  assert.equal(cache.reuseCounts.stored, 256);
  assert.ok(cache.reuseCounts.known <= 256);
  assert.ok(cache.reuseCounts.characters <= 1_000_000);
});

test('834 character limits bound large canonical values before the entry limits are reached', () => {
  const cache = new WallBooleanBaseline();
  let offeredCharacters = 0;
  for (let index = 0; index < 24; index++) run(cache, true, () => {
    const base = index * 1000 + .123456789012345;
    const pieces = Array.from({ length: 150 }, (_, n) => rect(base + n * 2, .123456789012345, .75, .5));
    const subject = union(pieces);
    const result = difference(subject, rect(base + .125, .25, .25, .125));
    offeredCharacters += JSON.stringify(subject).length + JSON.stringify(result).length;
    assert.ok(cache.reuseCounts.known <= 256);
    assert.ok(cache.reuseCounts.characters <= 1_000_000);
  });
  assert.ok(offeredCharacters > 1_000_000, 'real canonical operands exceeded the available certificate/baseline storage');
  assert.ok(cache.reuseCounts.stored < 24, 'the baseline character cap was reached before its entry cap');
  assert.ok(cache.reuseCounts.known < 48, 'the canonical character cap actually evicted remembered values');
});

function setupIntersection(pieces = [rect(0, 0, 10, 10)]) {
  const cache = new WallBooleanBaseline(), subject = rect(1, 1, 3, 3);
  let clipping, baseline;
  run(cache, true, () => {
    clipping = union(...pieces);
    baseline = intersection(subject, clipping);
  });
  return { cache, subject, clipping, baseline };
}

test('834 scoped intersections reuse only the unchanged local ray-edge signature', () => {
  const pieces = [rect(0, 0, 10, 10), rect(2, 20, 2, 2), rect(2, -20, 2, 2), rect(-20, 2, 2, 2)];
  const { cache, subject, baseline } = setupIntersection(pieces);
  const stored = cache.counts.stored, frozen = cache.reuseCounts.stored;
  const candidates = [
    [pieces[0], rect(2, 21, 2, 2), pieces[2], pieces[3]],
    [pieces[0], pieces[1], rect(2, -21, 2, 2), pieces[3]],
    [rect(-2, 0, 12, 10), pieces[1], pieces[2], rect(-21, 2, 2, 2)],
  ];
  for (const [index, operands] of candidates.entries()) {
    const clipping = run(cache, false, () => union(...operands));
    const snapshot = structuredClone(clipping), hits = cache.reuseCounts.hits;
    const actual = run(cache, false, () => intersection(subject, clipping));
    equivalent(actual, canonical.intersection(subject, clipping), `remote boundary change ${index}`);
    assert.deepEqual(actual, baseline, 'the previously proved local result is unchanged');
    assert.notStrictEqual(actual, baseline, 'the frozen result is copied');
    assert.equal(cache.reuseCounts.hits, hits + 1, 'this case exercises the signature shortcut');
    assert.deepEqual(clipping, snapshot, 'canonical clipping input remains untouched');
    assert.equal(cache.counts.stored, stored);
    assert.equal(cache.reuseCounts.stored, frozen);
  }
});

test('834 scoped intersections retain local holes, exact coordinates and far-right enclosure edges', () => {
  const { cache, subject, clipping } = setupIntersection();
  const oneUlp = 10 + Number.EPSILON * 8;
  assert.notEqual(oneUlp, 10);
  const candidates = [
    ['local hole', () => difference(clipping, rect(2, 2, 1, 1))],
    ['one ULP on the right edge', () => union(rect(0, 0, oneUlp, 10))],
    ['far-right enclosure edge', () => union(rect(0, 0, 1_000_000, 10))],
    ['enclosure disappears', () => union(rect(0, 0, .5, 10))],
    ['changed endpoints of a retained edge', () => union(rect(0, -2, 10, 14))],
  ];
  for (const [label, create] of candidates) {
    const nextClipping = run(cache, false, create), hits = cache.reuseCounts.hits;
    const actual = run(cache, false, () => intersection(subject, nextClipping));
    equivalent(actual, canonical.intersection(subject, nextClipping), label);
    assert.equal(cache.reuseCounts.hits, hits, `${label}: no stale local result`);
    if (label === 'local hole') assert.equal(actual[0].length, 2);
    if (label === 'enclosure disappears') assert.deepEqual(actual, []);
  }
});

test('834 scoped intersection provenance uses complete values and isolates returned copies', () => {
  const { cache, subject, baseline } = setupIntersection();
  const known = run(cache, false, () => union(rect(-2, 0, 12, 10)));
  const first = run(cache, false, () => intersection(structuredClone(subject), structuredClone(known)));
  assert.equal(cache.reuseCounts.hits, 1, 'exact deep clones keep their value certificate');
  first[0][0][0][0] = 999;
  const second = run(cache, false, () => intersection(subject, known));
  assert.equal(cache.reuseCounts.hits, 2);
  assert.deepEqual(second, baseline, 'a prior caller cannot mutate the frozen intersection result');

  const attempts = cache.reuseCounts.attempts;
  // The very same outer array now contains a valid but uncertified geometry
  // that changes the intersection. Identity-only provenance would be stale.
  known[0][0] = rect(2, 0, 8, 10)[0];
  const changed = run(cache, false, () => intersection(subject, known));
  equivalent(changed, canonical.intersection(subject, known), 'mutated clipping object');
  assert.notDeepEqual(changed, baseline);
  assert.equal(cache.reuseCounts.attempts, attempts, 'unknown complete values never enter signature reuse');
  assert.equal(cache.reuseCounts.hits, 2);

  const outsideScope = canonical.union(rect(-3, 0, 13, 10));
  const unknown = run(cache, false, () => intersection(subject, outsideScope));
  equivalent(unknown, canonical.intersection(subject, outsideScope), 'uncertified canonical-looking clipping');
  assert.equal(cache.reuseCounts.attempts, attempts);
  assert.equal(cache.reuseCounts.hits, 2);
});

test('834 scoped intersection keys preserve the entire subject, operand order and exactly two operands', () => {
  const { cache, subject } = setupIntersection();
  const clipping = run(cache, false, () => union(rect(-2, 0, 12, 10)));
  const altered = structuredClone(subject);
  altered[0][0][0] += Number.EPSILON;
  altered[0][altered[0].length - 1][0] += Number.EPSILON;
  assert.notDeepEqual(altered, subject);
  const reversed = structuredClone(subject).map(ring => ring.reverse());
  const cases = [
    [[altered, clipping], 1],
    [[reversed, clipping], 1],
    [[clipping, subject], 0],
    [[subject, clipping, rect(2, 2, 1, 1)], 0],
    [[clipping], 0],
  ];
  for (const [operands, lookups] of cases) {
    const attempts = cache.reuseCounts.attempts, hits = cache.reuseCounts.hits;
    const actual = run(cache, false, () => intersection(...operands));
    equivalent(actual, canonical.intersection(...operands), 'distinct intersection key');
    assert.equal(cache.reuseCounts.hits, hits);
    assert.equal(cache.reuseCounts.attempts, attempts + lookups,
      'changed subjects miss by full key; unsupported arity/order cannot enter the shortcut');
  }
  const exact = run(cache, false, () => intersection(structuredClone(subject), clipping));
  equivalent(exact, canonical.intersection(subject, clipping), 'exact two-operand key');
  assert.equal(cache.reuseCounts.hits, 1);
});

test('834 intersection candidate streams share the same frozen storage and bounded certificates', () => {
  const { cache, subject } = setupIntersection();
  const stored = cache.counts.stored, frozen = cache.reuseCounts.stored;
  for (let index = 1; index <= 300; index++) {
    // Dyadic steps keep x + width EXACTLY 10: decimal cancellation would
    // legitimately alter the retained right edge and force ordinary clipping.
    const left = -index / 8;
    const clipping = run(cache, false, () => union(rect(left, 0, 10 - left, 10)));
    const result = run(cache, false, () => intersection(subject, clipping));
    if (index === 1 || index === 150 || index === 300)
      equivalent(result, canonical.intersection(subject, clipping), `intersection pointer ${index}`);
    assert.equal(cache.counts.stored, stored);
    assert.equal(cache.reuseCounts.stored, frozen, 'intersection candidates cannot add a second history');
    assert.ok(cache.reuseCounts.known <= 256);
    assert.ok(cache.reuseCounts.characters <= 1_000_000);
  }
  assert.equal(cache.reuseCounts.hits, 300);
  assert.equal(cache.reuseCounts.known, 256, 'the intersection stream also exercises eviction');
});

test('834 mixed intersection and boundary baselines share the 256-record limit', () => {
  const cache = new WallBooleanBaseline();
  run(cache, true, () => {
    for (let index = 0; index < 280; index++) {
      const x = index * 20, clipping = union(rect(x, 0, 10, 10));
      const raw = rect(x + 1, 1, 2, 2);
      if (index % 2) intersection(raw, clipping);
      else difference(clipping, raw);
    }
  });
  assert.equal(cache.reuseCounts.stored, 256, 'the two shortcut families do not each allocate 256 records');
  assert.ok(cache.reuseCounts.known <= 256);
  assert.ok(cache.reuseCounts.characters <= 1_000_000);
});
