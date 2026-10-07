import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { wallNodeFixture, NODE_CASES } from './performance/wall-node-fixture.mjs';
import { applyNodeMove, prepareNodeMove, resolveNodeMoveSnap, structuralWallNodes } from '../test-build/wall-node-move.js';
const config = wallNodeFixture(), space = config.spaces[0];
const began = performance.now(), nodes = structuralWallNodes(space), coldGraphMs = performance.now() - began;
const plans = NODE_CASES.map(c => {
  const node = nodes.find(n => Math.hypot(n.point[0] - c.point[0], n.point[1] - c.point[1]) < 1e-8);
  return prepareNodeMove(space, node, nodes, { 'partition:x-v': 'partition-00000000-0000-4000-8000-000000000001',
    'partition:x-h': 'partition-00000000-0000-4000-8000-000000000002' });
});
const samples = [], outcomes = new Set();
for (let series = -3; series < 20; series++) for (let i = 0; i < 120; i++) {
  const index = i % plans.length, plan = plans[index];
  const start = performance.now();
  const snap = resolveNodeMoveSnap(plan, NODE_CASES[index].raw(i + series + 3), 0.0002, null);
  const result = applyNodeMove(plan, snap.point, snap.axis);
  if (!result.ok) throw new Error(`${NODE_CASES[index].name} refused: ${result.reason}`);
  outcomes.add(JSON.stringify([index, snap.point]));
  if (series >= 0) samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const percentile = q => samples[Math.min(samples.length - 1, Math.ceil(q * samples.length) - 1)];
const out = { profile: 'wall-node-candidate-v1', roomCount: 200, warmups: 3, series: 20, movesPerSeries: 120,
  distinctTargets: outcomes.size, fixtureFingerprint: createHash('sha256').update(JSON.stringify(config)).digest('hex'),
  coldGraphMs, candidateMs: { p50: percentile(0.5), p95: percentile(0.95), max: samples.at(-1) } };
console.log(JSON.stringify(out, null, 2));
if (out.candidateMs.p95 > 16 || outcomes.size < 100) process.exitCode = 1;
