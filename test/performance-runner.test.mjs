import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import {
  assertCardContract, installEpochDiagnostics, LARGE_HOUSE_CARD_CONTRACT, planLargeHouseIterations,
} from '../demo/performance/card-contract.mjs';

test('#812 AC7: zero warmups remove the discarded iteration from the executed plan', () => {
  const plan = planLargeHouseIterations({ samples: '3', warmups: '0' });
  const executed = [];
  for (const sample of plan.iterations) executed.push(sample);
  assert.deepEqual(executed, [0, 1, 2]);
  assert.deepEqual([plan.samples, plan.warmups], [3, 0]);
});

test('#812 AC7: other CLI defaults, bounds and fractional iteration semantics remain compatible', () => {
  for (const value of [undefined, '', ' ', 'nope', '-0', '0.0', '0x0', '-1', '1', '2.5', '20', 'Infinity', '-Infinity']) {
    const plan = planLargeHouseIterations({ samples: value, warmups: value });
    const samples = Math.max(1, Math.min(20, Number(value) || 7));
    const warmups = Math.max(0, Math.min(5, Number(value) || 1));
    const expected = [];
    for (let i = 0; i < warmups + samples; i++) expected.push(i - warmups);
    assert.deepEqual(plan, { samples, warmups, iterations: expected }, String(value));
  }
  assert.equal(planLargeHouseIterations({ samples: '0' }).samples, 7, 'samples=0 keeps its existing default');
});

test('#812 AC7: common card contract failure names the actual measured profile', () => {
  for (const profile of ['large-house-v1', 'large-house-interaction-v1',
    'large-house-isometric-v1', 'large-house-isometric-backdrop-v1', 'isometric-stage3-dense-v1']) {
    assert.throws(() => assertCardContract({}, LARGE_HOUSE_CARD_CONTRACT, profile),
      (error) => error.message.startsWith(`${profile} harness is incompatible`), profile);
  }
});

test('#812 AC9: only the first eight epoch changes capture stacks; counters and value continue', () => {
  const diag = { updates: 17, updateMs: 9, models: 4, adopts: 3, epochs: [] };
  const card = { __diag: diag };
  let captures = 0;
  // Independent of the diagnostic's own counter: catches an unbounded Error.stack.
  const capture = () => { captures += 1; return `Error\n at bump${captures} (fixture:1)\n at caller\n at host`; };
  // The runner injects the exact function this way, without its module scope.
  const install = runInNewContext(`(${installEpochDiagnostics.toString()})`);
  install(card, capture);
  for (let epoch = 1; epoch <= 10_000; epoch++) {
    card._cfgEpoch = epoch;
    card._cfgEpoch = epoch; // An unchanged assignment is not a bump.
  }
  assert.equal(card._cfgEpoch, 10_000);
  assert.equal(captures, 8, 'stack capture must stop, not merely truncate the output array');
  assert.equal(diag.epochs.length, 8);
  assert.equal(diag.epochs[0], '0->1@bump1<caller<host');
  assert.equal(diag.epochs[7], '7->8@bump8<caller<host');
  assert.deepEqual([diag.epochChanges, diag.epochStackCaptures, diag.epochTracesDropped], [10_000, 8, 9992]);
  assert.deepEqual([diag.updates, diag.updateMs, diag.models, diag.adopts], [17, 9, 4, 3]);
});
