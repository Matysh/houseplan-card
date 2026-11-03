import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundledProducers, callsFor } from '../demo/performance/opening-drag-coverage.mjs';

test('opening coverage observes both graph and legacy material producers', t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-opening-producers-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'legacy.js'), 'function oldBody(){return {partitions:[],columns:[],patches:[],all:[]};}');
  writeFileSync(join(root, 'graph.js'), 'function graphBody(){return Object.defineProperty({partitions:[],columns:[],patches:[],all:[]},"rawPatches",{value:[]});}');
  const targets = bundledProducers(root).physical;
  assert.equal(targets.length, 2);
  const coverage = targets.map((target, index) => ({ url: `http://demo.local/assets/${target.relative}`,
    functions: [{ functionName: target.name, ranges: [{ startOffset: target.start, endOffset: target.end, count: index + 1 }] }] }));
  assert.equal(callsFor(coverage, targets), 3, 'work from either source is counted, not an arbitrary selected function');
  assert.equal(callsFor([], targets), 0);
  rmSync(join(root, 'legacy.js')); rmSync(join(root, 'graph.js'));
  assert.throws(() => bundledProducers(root), /missing physical body producers/);
});
