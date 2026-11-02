import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { converterReport, converterMarkdown, makeConverterStep, publishConverterFailures } from '../lib/converters.mjs';
import { planProfile } from '../lib/catalog.mjs';
import { classifyRun } from '../lib/runner.mjs';
import { CONVERTER_CASES } from '../converters/cases.mjs';
import { prepareConverterSuite } from '../converters/prepare.mjs';
import { normalizeFallbackRequest } from '../templates/prepare-fallback.mjs';

function lab(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'hp-converters-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const put = (root, file, value) => { const target = path.join(root, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, JSON.stringify(value)); };
const row = (format, status = 'passed') => ({ format, status, phase: status === 'passed' ? 'complete' : 'conversion',
  published: { url: 'https://houseplan.tech/convert/', sha256: 'a'.repeat(64) }, error: status === 'failed' ? 'conversion error' : undefined });

test('three format results distinguish missing setup, converter failure and successful real journeys', t => {
  const workspace = lab(t);
  let report = converterReport(null, { workspace, error: 'Docker unavailable' });
  assert.equal(report.status, 'unavailable'); assert.equal(report.counts.skipped, 3);
  assert.match(converterMarkdown(report), /не выполнено/);
  put(workspace, 'artifacts/converters/sh3d.json', row('sh3d'));
  put(workspace, 'artifacts/converters/easy.json', row('easy', 'failed'));
  report = converterReport({ workspace, status: 'failed' });
  assert.equal(report.status, 'failed'); assert.deepEqual(report.counts, { tests: 3, passed: 1, failed: 1, skipped: 1 });
  for (const entry of CONVERTER_CASES) put(workspace, `artifacts/converters/${entry.id}.json`, row(entry.id));
  assert.equal(converterReport({ workspace, status: 'passed' }).status, 'passed');
  assert.equal(converterReport({ workspace, status: 'passed' }, { error: 'Owned container cleanup failed' }).status, 'unavailable');
});

test('public artifact/format failures reuse one bug; environment gaps never manufacture a converter bug', async () => {
  const issues = [], comments = [];
  const api = { root: '/repos/Matysh/houseplan-card', request: async (method, url, body) => {
    if (method === 'GET') return issues;
    const issue = { ...body, number: issues.length + 10, html_url: 'https://github.com/Matysh/houseplan-card/issues/10' };
    issues.push(issue); return issue;
  }, upsertComment: async (...args) => comments.push(args) };
  const report = { formats: [row('easy', 'failed')], targetRef: 'a'.repeat(40), expectedVersion: '1.84.0', haVersion: '2026.10.4' };
  assert.equal((await publishConverterFailures(api, report))[0].reused, false);
  assert.equal((await publishConverterFailures(api, report))[0].reused, true);
  assert.equal(issues.length, 1); assert.equal(comments.length, 1);
  assert.equal((await publishConverterFailures(null, report))[0].status, 'pending');
  assert.deepEqual(await publishConverterFailures(api, { formats: [{ ...row('easy'), status: 'unavailable' }] }), []);
});

test('converter adapter is diagnostic, requires pinned lab inputs, and never enlarges ordinary/beta/hotfix selections', async t => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  for (const event of ['task', 'beta', 'hotfix']) {
    const plan = await planProfile({ root, event, layer: event === 'task' ? 'infra' : 'product' });
    assert.ok(!plan.steps.some(step => step.id === 'converters-stable'));
  }
  const standalone = await planProfile({ root, event: 'converters' });
  assert.equal(standalone.steps.length, 1); assert.equal(standalone.steps[0].command, null);
  const e2eRoot = lab(t); put(e2eRoot, 'tests/test.mjs', { fixture: 1 });
  const options = { e2eRoot, workRoot: '/private/labs', haVersion: '2026.10.4', targetRef: 'b'.repeat(40) };
  const step = makeConverterStep(options);
  assert.ok(step.command.includes('--execute')); assert.equal(step.diagnostic, true);
  put(e2eRoot, 'tests/test.mjs', { fixture: 2 });
  assert.notDeepEqual(makeConverterStep(options).command, step.command, 'companion edits invalidate the saved diagnostic');
  assert.equal(classifyRun([{ status: 'passed', diagnostic: false }, { status: 'failed', diagnostic: true }]), 'passed');
});

test('reserve converters installs the precise candidate and companion without metrics/upgrade or user HA inputs', () => {
  const candidate = 'a'.repeat(40), e2eCommit = 'b'.repeat(40);
  const result = normalizeFallbackRequest({ event: 'converters', e2eCommit, haVersion: '2026.10.4' }, { workspace: '/ci', candidate });
  assert.equal(result.needsE2E, true); assert.equal(result.needsMetrics, false);
  assert.equal(result.request.targetRef, candidate); assert.equal(result.request.candidateRoot, undefined);
  assert.throws(() => normalizeFallbackRequest({ event: 'converters' }, { workspace: '/ci', candidate }), /e2eCommit/);
});

test('private suite copies only fixed synthetic inputs, not a local substitute for the published converter', t => {
  const workspace = lab(t); mkdirSync(path.join(workspace, 'tests'));
  const base = prepareConverterSuite(workspace);
  assert.match(readFileSync(path.join(workspace, base), 'utf8'), /dependencies: \['setup'\]/);
  for (const fixture of CONVERTER_CASES) assert.ok(readFileSync(path.join(workspace, 'fixtures/process-next-converters', fixture.file)).length > 0);
  assert.deepEqual(readdirSync(path.join(workspace, 'fixtures/process-next-converters')).sort(), CONVERTER_CASES.map(row => row.file).sort());
});
