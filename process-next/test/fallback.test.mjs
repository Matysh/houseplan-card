import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeFallbackRequest, materializeFallback, restoreFallbackResults } from '../templates/prepare-fallback.mjs';

const candidate = 'a'.repeat(40), e2eCommit = 'b'.repeat(40);
const baseRequest = { event: 'beta', e2eCommit, metricsRequest: 'measurements/request.json', haVersion: '2026.10.4', upgradeFrom: 'v1.83.1' };

test('fallback pins checkouts, treats labels as data and replaces local machine paths', () => {
  const workspace = path.resolve(os.tmpdir(), 'ci-fixture');
  const result = normalizeFallbackRequest({ ...baseRequest, version: 'beta $(not-a-command)', e2eRoot: 'C:\\user\\e2e', workRoot: '/home/user/labs', candidateRoot: '/user/homeassistant' }, { workspace, candidate });
  assert.equal(result.request.version, 'beta $(not-a-command)');
  assert.ok(result.request.e2eRoot.startsWith(workspace + path.sep));
  assert.ok(result.request.workRoot.startsWith(workspace + path.sep));
  assert.ok(result.request.candidateRoot.startsWith(workspace + path.sep));
  assert.equal(result.needsE2E, true);
  assert.equal(result.needsMetrics, true);
  assert.equal(normalizeFallbackRequest({ ...baseRequest, event: 'stable', metricsRequest: undefined }, { workspace, candidate }).needsMetrics, true);
  assert.equal(normalizeFallbackRequest({ ...baseRequest, event: 'stable' }, { workspace, candidate }).needsMetrics, true);
  assert.equal(normalizeFallbackRequest({ ...baseRequest, metricsRequest: undefined }, { workspace, candidate }).needsMetrics, true);
  assert.throws(() => normalizeFallbackRequest({ ...baseRequest, e2eCommit: 'main' }, { workspace, candidate }), /full pinned SHA/);
  assert.throws(() => normalizeFallbackRequest(baseRequest, { workspace, candidate: 'dev' }), /commit SHA/);
  assert.throws(() => normalizeFallbackRequest({ ...baseRequest, run: 'echo injected' }, { workspace, candidate }), /Unsupported/);
  assert.throws(() => normalizeFallbackRequest({ ...baseRequest, metricsRequest: '../secret.json' }, { workspace, candidate }), /relative file/);
});

test('docs have no execution; infrastructure preparation stays relevant', () => {
  const options = { workspace: path.resolve(os.tmpdir(), 'ci-fixture'), candidate };
  assert.throws(() => normalizeFallbackRequest({ event: 'task', layer: 'docs' }, options), /no fallback execution/);
  const infra = normalizeFallbackRequest({ event: 'task', layer: 'infra', changedFiles: ['scripts/example.mjs'] }, options);
  assert.equal(infra.needsE2E, false); assert.equal(infra.needsBrowser, false); assert.equal(infra.needsPython, false);
});

test('fallback restores only successful result JSON and named reports, never artifact programs', t => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'fallback-restore-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const prior = path.join(workspace, 'process-next/.state/fallback-prior');
  const put = (file, content) => { mkdirSync(path.dirname(path.join(prior, file)), { recursive: true }); writeFileSync(path.join(prior, file), content); };
  const fingerprint = 'a'.repeat(64);
  put(`process-next/.state/cache/${fingerprint}.json`, JSON.stringify({ status: 'passed', fingerprint }));
  put(`process-next/.state/cache/${'b'.repeat(64)}.json`, JSON.stringify({ status: 'failed', fingerprint: 'b'.repeat(64) }));
  put('artifacts/process-next/backend-coverage.xml', '<coverage/>');
  put('package.json', 'overwrite'); put('scripts/execute.mjs', 'overwrite');
  assert.deepEqual(restoreFallbackResults(workspace), [`process-next/.state/cache/${fingerprint}.json`, 'artifacts/process-next/backend-coverage.xml']);
  assert.equal(readFileSync(path.join(workspace,'artifacts/process-next/backend-coverage.xml'),'utf8'), '<coverage/>');
  assert.throws(() => readFileSync(path.join(workspace, 'package.json')));
});

test('supplied measurement files stay in their checkout; WSL timing cannot impersonate CI', t => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), 'fallback-inputs-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const put = (file, value) => { mkdirSync(path.dirname(path.join(workspace, file)), { recursive: true }); writeFileSync(path.join(workspace, file), JSON.stringify(value)); };
  put('package.json', { version: '1.84.0-beta.1' });
  const host = { cpu: 'actual CI CPU', linux: 'linux 6.11.0', power_scheme: 'github-hosted-unmanaged', execution_environment: 'github-actions' };
  const withoutMetrics = materializeFallback({ input: { ...baseRequest, event: 'stable', metricsRequest: undefined }, workspace, candidate, host });
  assert.ok(withoutMetrics.request.metricsRequest.endsWith('metrics-request.json'));
  assert.equal(withoutMetrics.request.expectedVersion, '1.84.0-beta.1');
  put('measurements/request.json', { latestStable: 'measurements/stable.json', host: { cpu: 'invented', power_scheme: 'Balanced', linux: 'WSL' } });
  const stable = { source_sha: 'c'.repeat(40), host: { cpu: 'actual CI CPU', linux: 'linux 6.11.0' }, timing_protocol: { runtime: { platform: 'linux' } } };
  put('measurements/stable.json', stable);
  const result = materializeFallback({ input: baseRequest, workspace, candidate, host });
  const stableWithMetrics = materializeFallback({ input: { ...baseRequest, event: 'stable' }, workspace, candidate, host });
  assert.ok(stableWithMetrics.request.metricsRequest.endsWith('fallback-inputs/metrics-request.json'));
  const metrics = JSON.parse(readFileSync(path.join(workspace, result.request.metricsRequest), 'utf8'));
  assert.deepEqual(metrics.host, host);
  assert.equal(result.request.expectedVersion, '1.84.0-beta.1');
  assert.equal(result.request.e2eCommit, undefined);
  put('measurements/stable.json', { ...stable, host: { ...stable.host, linux: 'Linux 6.18.33.2-microsoft-standard-WSL2' } });
  const wsl = materializeFallback({ input: baseRequest, workspace, candidate, host });
  const wslRequest = JSON.parse(readFileSync(path.join(workspace, wsl.request.metricsRequest), 'utf8'));
  assert.deepEqual(wslRequest.host, host);
  assert.match(JSON.parse(readFileSync(path.join(workspace, wslRequest.latestStable), 'utf8')).host.linux, /WSL2/);
  put('measurements/request.json', { latestStable: '../outside.json' });
  assert.throws(() => materializeFallback({ input: baseRequest, workspace, candidate, host }), /relative file/);
});
