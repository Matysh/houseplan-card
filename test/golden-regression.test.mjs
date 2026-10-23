import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingVisualAllowed, judgePendingGolden, runGoldenRegression } from '../scripts/golden-regression.mjs';
import { acceptanceExpectations } from '../scripts/task-visual-intent.mjs';

const result = (id, status = 'passed') => ({ id, status, actualSha256: 'a'.repeat(64), baselineSha256: 'b'.repeat(64) });
const report = results => ({ chromium: 'pinned', buildFingerprint: 'source',
  baselineManifest: { present: true, chromium: 'pinned', valid: false }, results });
const pending = { golden: [{ id: 'off', expectation: 'change', reason: '30% transparent', issue: 1044 }] };

test('#1044 full dev matrix tolerates only declared pending pixels, never incomplete/error/foreign frames', () => {
  const original = report([result('off', 'different'), result('on')]);
  assert.deepEqual(judgePendingGolden(original, pending, ['off', 'on']).pendingVisual, true);
  for (const results of [[result('off', 'different')], [result('off'), result('off')],
    [result('off', 'different'), result('on', 'different')],
    [result('off', 'error'), result('on')], [result('off', 'missing-baseline'), result('on')],
    [{ ...result('off', 'different'), error: 'semantic failure' }, result('on')]])
    assert.equal(judgePendingGolden(report(results), pending, ['off', 'on']).success, false);
  assert.equal(judgePendingGolden({ ...original, chromium: 'foreign' }, pending, ['off', 'on']).success, false);
  const matching = report([result('off'), result('on')]);
  assert.equal(judgePendingGolden(matching, pending, ['off', 'on']).pendingVisual, true,
    'matching pixels cannot validate an unaccepted global index in capture mode');
  matching.baselineManifest.valid = true;
  assert.equal(judgePendingGolden(matching, pending, ['off', 'on']).pendingVisual, false);
});

test('#1044 release/candidate/main stay strict and dev execution failures remain failures', () => {
  for (const env of [{ REF_NAME: 'main' }, { REF_NAME: 'issue/1044-check' },
    { REF_NAME: 'dev', CANDIDATE_INPUT: 'true' }, { REF_NAME: 'dev', HEAD_MESSAGE: 'Release: v1.83.0-beta.1' }]) {
    assert.equal(pendingVisualAllowed(env), false);
    let args;
    const outcome = runGoldenRegression({ env, pending: () => { throw Error('must not load pending intent'); },
      run: command => { args = command; return { status: 1 }; } });
    assert.equal(args.at(-1), '--mode=verify'); assert.equal(outcome.success, false);
  }
  let command;
  const run = status => runGoldenRegression({ env: { REF_NAME: 'dev' }, pending: () => pending,
    run: args => { command = args; return { status }; }, report: () => report([result('off', 'different')]), sceneIds: ['off'] });
  assert.equal(run(0).pendingVisual, true); assert.equal(command.at(-1), '--mode=capture');
  assert.equal(run(1).success, false);
});

test('#1044 beta aggregates task intent plus explicit review input and rejects conflicting/unsafe IDs', () => {
  const intent = { expectChange: ['off'], expectNew: ['new-scene'] };
  assert.deepEqual(acceptanceExpectations(intent, { change: 'off, hover', added: '' }),
    { expectChange: ['hover', 'off'], expectNew: ['new-scene'] });
  assert.throws(() => acceptanceExpectations(intent, { change: 'new-scene' }), /both/);
  assert.throws(() => acceptanceExpectations(intent, { change: 'bad\noutput=value' }), /Invalid/);
});
