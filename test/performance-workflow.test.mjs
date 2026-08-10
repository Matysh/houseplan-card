import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readWorkflow = (name) => readFileSync(
  new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8',
);

test('ordinary Validate keeps only the bounded candidate performance smoke', () => {
  const workflow = readWorkflow('validate.yml');
  for (const contract of [
    'performance_smoke:',
    '--variants=60 --samples=3 --warmups=1',
    '--absolute-only',
    'budgets-glow-smoke.json',
    'cancel-in-progress: true',
  ]) assert.ok(workflow.includes(contract), `missing fast-gate contract: ${contract}`);
  assert.ok(!workflow.includes('Capture base and candidate profiles'));
  assert.ok(!workflow.includes('schedule:'));
});

test('full performance is isolated to stable, scheduled and manual entry points', () => {
  const workflow = readWorkflow('performance.yml');
  for (const contract of [
    'name: Full Performance',
    'branches:',
    '- main',
    'schedule:',
    'workflow_dispatch:',
    'Capture base and candidate profiles',
    '--samples=7 --warmups=1',
  ]) assert.ok(workflow.includes(contract), `missing full-gate contract: ${contract}`);

  const release = readWorkflow('release.yml');
  assert.ok(release.includes('if: ${{ !github.event.release.prerelease }}'));
  assert.ok(release.includes('--workflow=performance.yml --label="Full Performance"'));
});
