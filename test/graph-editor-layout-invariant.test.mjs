import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shrink, SequencePrecondition } from './helpers/graph-editor-sequences.mjs';
import { LAYOUT_OPERATIONS, layoutSequence, replayLayout } from './helpers/graph-editor-layout-sequences.mjs';

test('#1285/#1287 paired editor deletions leave no geometry or layout maintenance', t => {
  const runSeed = process.env.HP_GRAPH_LAYOUT_SEQUENCE_SEED === undefined
    ? randomBytes(4).readUInt32LE() : Number(process.env.HP_GRAPH_LAYOUT_SEQUENCE_SEED);
  assert.ok(Number.isInteger(runSeed) && runSeed >= 0 && runSeed <= 0xffffffff, '32-bit seed');
  t.diagnostic('HP_GRAPH_LAYOUT_SEQUENCE_SEED=' + runSeed);
  const fixed = [0, 1, 5, 72, 95, 240, 1285, 1287, 0x7fffffff, 0xffffffff];
  const coverage = new Set();
  let state = runSeed;
  for (let i = 0; i < 210; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const seed = i < fixed.length ? fixed[i] : state;
    const family = i % 7, sequence = layoutSequence(seed, family), cellCm = [1, 5, 10, 100][i % 4];
    assert.ok(sequence.length <= 12);
    try { replayLayout(sequence, { cellCm }); }
    catch (error) {
      const signature = [error.code, error.message.split('\n')[0]].join(':');
      const minimal = shrink(sequence, candidate => {
        try { replayLayout(candidate, { cellCm }); return false; }
        catch (e) { return !(e instanceof SequencePrecondition)
          && [e.code, e.message.split('\n')[0]].join(':') === signature; }
      });
      const dir = resolve('output/1285-sequence-failures'); mkdirSync(dir, { recursive: true });
      const fixture = resolve(dir, `layout-seed-${seed}-family-${family}.json`);
      writeFileSync(fixture, JSON.stringify({ name: `layout-seed-${seed}-family-${family}`,
        seed, family, cellCm, error: signature, operations: minimal }, null, 2) + '\n');
      throw new Error(`layout seed=${seed}, family=${family}, step=${error.step}, minimized=${fixture}`, { cause: error });
    }
    sequence.forEach(op => coverage.add(op.kind));
  }
  for (const kind of LAYOUT_OPERATIONS) assert.ok(coverage.has(kind), 'replayed ' + kind);
});
