import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERATIONS, generatedSequence, replay, shrink, SequencePrecondition, emptyPlan, editorStep,
  fixedPointPairInvariant } from './helpers/graph-editor-sequences.mjs';
import { harness } from './helpers/geometry-commit-harness.mjs';

// Imported/legacy/manual-JSON/stale-client inputs and positions with unverified
// owners are outside this editor contract. Layout deletion is covered below.
const witnesses = JSON.parse(readFileSync(new URL('./fixtures/1285-editor-sequences.json', import.meta.url)));
test('#1285 shrinking revisits setup after its former dependant has been removed', () => {
  const original = ['setup', 'dependent', 'failure'];
  const fails = candidate => candidate.includes('failure')
    && (!candidate.includes('dependent') || candidate.includes('setup'));
  assert.deepEqual(shrink(original, fails), ['failure']);
  assert.deepEqual(original, ['setup', 'dependent', 'failure']);
  assert.deepEqual(shrink(original, () => false), original);
});
for (const witness of witnesses) test('#1285 baseline counterexample: ' + witness.name,
  () => replay(witness.operations, { cellCm: witness.cellCm ?? 5 }));

test('#1285/#1287 baseline counterexample: deleting a room with a moved label leaves no layout debt', () => {
  const space = editorStep(emptyPlan(), { kind: 'face', id: 'labelled',
    poly: [[0, 0], [120, 0], [120, 120], [0, 120]] });
  const h = harness({ model_version: 11, spaces: [space], markers: [], settings: {} });
  h.host._space = space.id;
  h.host._layout = { rl_labelled: { x: 72 / 240, y: 48 / 240, s: space.id } };
  const before = h.runtime._geometrySnapshot(space.id);
  h.host._serverCfg.spaces[0].rooms = [];
  assert.equal(h.runtime._commitPhysicalGeometry('Delete room', before, [], true,
    { kind: 'delete-room', room: 'labelled', keepWalls: false }), true);
  assert.equal(h.host._layout.rl_labelled, undefined, 'the production paired writer removes the deleted room label');
  fixedPointPairInvariant(h.host._serverCfg, h.host._layout);
});

test('#1285 native editor sequences are valid, exact-projected Optimize fixed points', t => {
  const fixedSeeds = [0, 1, 5, 72, 95, 240, 1282, 1283, 1285, 0xffffffff];
  const randomSeed = process.env.HP_GRAPH_SEQUENCE_SEED === undefined
    ? randomBytes(4).readUInt32LE() : Number(process.env.HP_GRAPH_SEQUENCE_SEED);
  assert.ok(Number.isInteger(randomSeed) && randomSeed >= 0 && randomSeed <= 0xffffffff, '32-bit seed');
  t.diagnostic('HP_GRAPH_SEQUENCE_SEED=' + randomSeed);
  let state = randomSeed, count = 0;
  const coverage = new Set();
  for (let i = 0; i < 210; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const seed = i < fixedSeeds.length ? fixedSeeds[i] : state;
    const family = i % 7, sequence = generatedSequence(seed, family);
    assert.ok(sequence.length <= 12, 'at most twelve native operations');
    try {
      replay(sequence, { cellCm: [1, 5, 10, 100][i % 4] });
    } catch (error) {
      const signature = [error.code, error.message.split('\n')[0]].join(':');
      const minimal = shrink(sequence, candidate => {
        try { replay(candidate, { cellCm: [1, 5, 10, 100][i % 4] }); return false; }
        catch (e) { return !(e instanceof SequencePrecondition)
          && [e.code, e.message.split('\n')[0]].join(':') === signature; }
      });
      const dir = resolve('output/1285-sequence-failures');
      mkdirSync(dir, { recursive: true });
      const fixture = resolve(dir, `seed-${seed}-family-${family}.json`);
      writeFileSync(fixture, JSON.stringify({ name: `seed-${seed}-family-${family}`, seed, family, cellCm: [1, 5, 10, 100][i % 4],
        error: signature, operations: minimal }, null, 2) + '\n');
      throw new Error(`seed=${seed}, family=${family}, step=${error.step ?? 'Optimize'}, minimized=${fixture}`, { cause: error });
    }
    sequence.forEach(op => coverage.add(op.kind));
    count++;
  }
  assert.equal(count, 210);
  assert.deepEqual([...coverage].sort(), [...OPERATIONS].sort(), 'every required writer class was actually replayed');
});
