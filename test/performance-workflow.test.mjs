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
    'budgets-space-glow-smoke.json',
    'cancel-in-progress: true',
  ]) assert.ok(workflow.includes(contract), `missing fast-gate contract: ${contract}`);
  assert.ok(!workflow.includes('Capture base and candidate profiles'));
  assert.ok(!workflow.includes('schedule:'));
});

test('full performance is isolated to stable, scheduled and manual entry points', () => {
  const workflow = readWorkflow('performance.yml');
  for (const contract of [
    'name: Полные бенчмарки производительности',
    'branches:',
    '- main',
    'schedule:',
    'workflow_dispatch:',
    'Capture base and candidate profile',
    'profile:',
    '- large-house',
    '- isometric',
    '- plan-snap',
    '- blend',
    '- overlay',
    '- space-default',
    '- space-glow',
    'PROFILE: ${{ matrix.profile }}',
    'name: full-performance-${{ matrix.profile }}',
    '--samples=7 --warmups=1',
  ]) assert.ok(workflow.includes(contract), `missing full-gate contract: ${contract}`);

  assert.ok(workflow.includes('if [ -f baseline/scripts/bundle-sync.mjs ]; then'));
  assert.equal((workflow.match(/--samples=7 --warmups=1/g) || []).length, 14);

  const release = readWorkflow('release.yml');
  assert.ok(release.includes('if: ${{ !github.event.release.prerelease }}'));
  assert.ok(release.includes('--workflow=performance.yml --label="Полные бенчмарки производительности"'));
});

test('#347: a rewritten before forces the full run instead of guessing the range', () => {
  // Force-push kills github.event.before; the merge-base fallback then
  // guessed a range that hid a real custom_components/** diff behind two doc
  // files, and the heavy jobs silently skipped while the run stayed green —
  // the #171/#207 class of silent pass. The contract: a non-zero before that
  // no longer exists switches classification to an unconditional full run
  // with a loud step-summary note, and the merge-base fallback remains ONLY
  // for the genuinely new branch (zero before).
  const workflow = readWorkflow('validate.yml');
  const classify = workflow.slice(
    workflow.indexOf('Классификация изменённых файлов'),
    workflow.indexOf('reuse:'),
  );
  assert.ok(
    /force-push[\s\S]*?frontend=true[\s\S]*?backend=true[\s\S]*?integration=true/.test(classify),
    'мёртвый before обязан включать полный прогон, не merge-base-угадывание');
  assert.ok(classify.includes('GITHUB_STEP_SUMMARY'),
    'пропуск классификации обязан быть громким в summary');
  const fallback = classify.slice(classify.indexOf('Новая ветка'));
  assert.ok(!fallback.includes('cat-file'),
    'merge-base-фолбэк остаётся только для нулевого before — без повторной проверки существования');
});
