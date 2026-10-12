import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findStep, runStep } from './helpers/workflow-step.mjs';
import { resumeDomainContinuation } from '../scripts/workflow-continuation.mjs';
const read = name => readFileSync(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
const sha = 'a'.repeat(40);
test('#856/#492 night queue is explicit pending, exact full verdict is consumed separately', () => {
  const wf = read('_nightly.yml');
  assert.match(wf, /workflow-pending\.mjs --kind=night/);
  assert.match(wf, /workflow-continuation-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(wf, /не PASS/);
  assert.doesNotMatch(wf, /gh run watch|sleep 10/);
  assert.match(read('_process-resume.yml'), /workflow-continuation\.mjs/);
  assert.match(read('_process-reconcile.yml'), /workflow-continuation\.mjs/);
});
test('#856 actual runner step dispatches once, seals pinned SHA and fails when dispatch refuses', t => {
  if (process.platform === 'win32') { t.skip('Linux workflow runner'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'hp-night-856-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = join(dir, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), [
    '#!/bin/sh', 'echo "$*" >> "$FAKE_LOG"',
    'if [ "$1" = api ]; then case "$2" in',
    '*/git/ref/heads/dev) printf \'%s\' \'{"object":{"sha":"' + sha + '"}}\' ;;',
    '*/git/commits/*) printf \'%s\' \'{"tree":{"sha":"' + 'b'.repeat(40) + '"}}\' ;;',
    '*) exit 1 ;; esac; else [ "$FAIL" != 1 ]; fi',
  ].join('\n'), { mode: 0o755 });
  const step = findStep(read('_nightly.yml'), { name: 'Закрепить SHA и поставить Validate(dev, full=true) в очередь — не PASS' });
  const execute = (out, fail) => runStep(step, step.run.replaceAll('${{ runner.temp }}/workflow-pending', out), {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8',
    env: { ...process.env, PATH: bin + ':' + process.env.PATH, REPO: 'o/r', FAIL: fail ? '1' : '0',
      FAKE_LOG: join(dir, 'calls'), GITHUB_RUN_ID: '20', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: sha,
      GITHUB_REF_NAME: 'main', GITHUB_OUTPUT: join(dir, 'outputs'), GITHUB_STEP_SUMMARY: join(dir, 'summary') },
  });
  const out = join(dir, 'intent'); const r = execute(out, false);
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(readFileSync(join(out, 'pending.json')));
  assert.equal(p.candidate, sha); assert.equal(p.kind, 'night'); assert.equal(p.producer.run, 20);
  assert.match(readFileSync(join(dir, 'calls'), 'utf8'), /workflow run validate.yml --repo o\/r --ref dev -f full=true/);
  assert.match(r.stdout, /not a green night/);
  assert.match(r.stdout, /"pending":true/);
  assert.notEqual(execute(join(dir, 'refused'), true).status, 0, 'failed producer cannot authenticate a continuation');
});
test('#856/#727/#736 night completion: red diagnoses and still reviews code once, cancelled/stale never dispatch', async () => {
  let claims = 0, dispatches = 0, diagnosed = 0, claimed = false;
  const p = { kind: 'night', candidate: sha };
  const ops = { state: () => ({ dev: sha }), proof: () => ({ status: 'failed' }),
    claim: () => { claims++; if (claimed) return false; claimed = true; return true; },
    dispatch: () => { dispatches++; }, diagnose: () => { diagnosed++; } };
  const red = await resumeDomainContinuation(p, ops);
  assert.equal(red.status, 'failed'); assert.equal(diagnosed, 1); assert.equal(dispatches, 1);
  assert.equal((await resumeDomainContinuation(p, ops)).action, 'already-claimed');
  assert.equal(dispatches, 1);
  for (const status of ['cancelled', 'pending', 'missing', 'stale']) {
    await resumeDomainContinuation(p, { ...ops, proof: () => ({ status }) });
  }
  assert.equal(claims, 2);
  assert.equal((await resumeDomainContinuation(p, { ...ops, state: () => ({ dev: 'b'.repeat(40) }) })).action, 'noop');
  let reads = 0;
  await resumeDomainContinuation(p, { ...ops, state: () => ({ dev: ++reads === 1 ? sha : 'b'.repeat(40) }) });
  assert.equal(dispatches, 1, 'second fresh state is mandatory before dispatch');
});
