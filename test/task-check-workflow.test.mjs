import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { registryPublicationRecords } from '../scripts/ci-registry-cli.mjs';

const workflow = file => parse(readFileSync(`.github/workflows/${file}`, 'utf8'));

test('#1060 scoped reuse gates the expensive steps while the verifier job still executes', () => {
  for (const [file, ids] of [['validate.yml', ['tooling', 'browser_selected']],
    ['validate-tooling.yml', ['tooling']], ['validate-product.yml', ['browser_selected']]]) {
    const jobs = workflow(file).jobs;
    for (const id of ids) {
      const job = jobs[id], probe = job.steps.findIndex(s => s.id === 'task_reuse');
      const stamp = job.steps.findIndex(s => s.id === 'receipt');
      const execution = job.steps.findIndex(s => id === 'tooling'
        ? s.run === 'npm run test:tooling' : s.run === 'node scripts/browser-selected.mjs');
      assert.ok(probe >= 0 && probe < execution && execution < stamp, `${file}/${id}: verify, execute, stamp`);
      assert.equal(job.steps[probe].if, undefined, 'verifier itself must always run');
      assert.equal(job.permissions.actions, 'read');
      assert.equal(job.outputs.task_check, '${{ steps.receipt.outputs.claim || steps.task_reuse.outputs.claim }}');
      assert.match(job.env.TASK_CHECK_FRESH, /registry_fresh.*heavy/);
      for (const step of job.steps.slice(probe + 1)) {
        assert.match(step.if || '', /steps\.task_reuse\.outputs\.reused != 'true'/,
          `${file}/${id}: costly/stamping step must not execute on reuse: ${step.name || step.run || step.uses}`);
      }
    }
    if (file !== 'validate-tooling.yml') {
      for (const id of ['preflight', 'changes', 'bundle', 'product_guards']) {
        assert.doesNotMatch(JSON.stringify(jobs[id]), /task_reuse|task-check-reuse-cli/,
          `${id}: range, process and packaging remain fresh`);
      }
    }
  }
});

test('#1060 scoped receipts use the existing immutable index and cannot publish a reused chain', () => {
  const direct = { schema: 'houseplan-task-check/v1', job: 'tooling', key: 'a'.repeat(64) };
  const reused = { schema: 'houseplan-task-check/v1', job: 'browser_selected', key: 'b'.repeat(64) };
  const proof = { requiredChecks: ['preflight'], checks: { preflight: { result: 'success' } },
    taskChecks: { tooling: { mode: 'executed', record: direct }, browser_selected: { mode: 'reused', record: reused } } };
  assert.deepEqual(registryPublicationRecords(proof), [direct]);
  proof.checks.preflight.result = 'failure';
  assert.deepEqual(registryPublicationRecords(proof), []);
  const tooling = workflow('validate-tooling.yml').jobs.proof;
  assert.equal(tooling.permissions.contents, 'write');
  const publish = tooling.steps.find(s => /--publish-proof=/.test(s.run || ''));
  assert.ok(publish);
  assert.match(publish.if, /head\.repo\.full_name == github\.repository/);
  assert.equal(workflow('validate-docs.yml').jobs.proof, undefined, 'docs do not gain publishing authority');
});
