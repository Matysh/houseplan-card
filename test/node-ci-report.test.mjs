import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { writeNodeCiReport } from '../demo/helpers/node-ci-report.mjs';
import { calibrateNodeInputClock } from '../demo/helpers/node-input-ledger.mjs';

test('#834 CI failure artifact retains the complete raw report at the fixed smoke-log path', t => {
  const temporaryRoot = resolve(tmpdir()), taskDirectory = mkdtempSync(join(temporaryRoot, 'hp-node-ci-report-'));
  t.after(() => {
    assert.equal(dirname(taskDirectory), temporaryRoot, 'cleanup is confined to this test-created temporary directory');
    rmSync(taskDirectory, { recursive: true, force: true });
  });
  const report = { pass: false, failures: ['CPU budget'], raw: [{ index: 3,
    sourceInputs: [{ id: 59, eventTime: 1024 }], samples: [{ mainThreadMs: 50.8 }],
    clockCalibration: { offsetMs: .1 } }] };
  const destination = writeNodeCiReport(report, { githubActions: 'true', tempDirectory: taskDirectory });
  assert.equal(destination, join(taskDirectory, 'smoke-logs', 'smoke_wall_node_connected.raw.json'));
  assert.deepEqual(JSON.parse(readFileSync(destination, 'utf8')), report, 'the artifact is not only a metrics summary');
  const partial = { raw: [{ sourceInputs: [{ id: 59, eventTime: 1024 }] }] };
  writeNodeCiReport(partial, { githubActions: 'true', tempDirectory: taskDirectory });
  assert.deepEqual(JSON.parse(readFileSync(destination, 'utf8')), partial, 'early assertion failures need no pass field');
});

test('#952 unavailable calibration retains phase, partial probes and FAIL in the CI artifact', async t => {
  const temporaryRoot = resolve(tmpdir()), taskDirectory = mkdtempSync(join(temporaryRoot, 'hp-clock-ci-report-'));
  t.after(() => {
    assert.equal(dirname(taskDirectory), temporaryRoot);
    rmSync(taskDirectory, { recursive: true, force: true });
  });
  let tick = 0;
  const context = { gesture: 3, phase: 'after' };
  try {
    await calibrateNodeInputClock({ async send() { return { result: { type: 'undefined' } }; } },
      { now: () => tick++, context });
    assert.fail('an invalid clock reply must not pass');
  } catch (error) {
    assert.match(error.message, /finite browser number/);
    const report = { pass: false, error: { name: error.name, message: error.message, stage: 'clock-calibration' },
      clockFailure: { ...error.clockCalibration, message: error.message, probes: error.clockProbes },
      raw: [{ index: 3, sourceInputs: [{ id: 59, eventTime: 1024 }] }] };
    const saved = JSON.parse(readFileSync(writeNodeCiReport(report,
      { githubActions: 'true', tempDirectory: taskDirectory }), 'utf8'));
    assert.equal(saved.pass, false);
    assert.equal(saved.error.stage, 'clock-calibration');
    assert.deepEqual(saved.clockFailure.context, context);
    assert.equal(saved.clockFailure.status, 'unavailable');
    assert.equal(saved.clockFailure.receivedProbes, 1);
    assert.equal(saved.clockFailure.requiredProbes, 32);
    assert.equal(saved.clockFailure.bestUncertaintyMs, null);
    assert.equal(saved.clockFailure.probes.length, 1);
    assert.equal(saved.raw[0].sourceInputs[0].id, 59);
  }
});

test('#834 normal execution does not write the CI-only smoke-log artifact', t => {
  const temporaryRoot = resolve(tmpdir()), taskDirectory = mkdtempSync(join(temporaryRoot, 'hp-node-ci-report-'));
  t.after(() => {
    assert.equal(dirname(taskDirectory), temporaryRoot);
    rmSync(taskDirectory, { recursive: true, force: true });
  });
  for (const githubActions of ['', 'false', 'TRUE', true])
    assert.equal(writeNodeCiReport({ raw: [] }, { githubActions, tempDirectory: taskDirectory }), undefined);
  assert.equal(existsSync(join(taskDirectory, 'smoke-logs')), false);
});
