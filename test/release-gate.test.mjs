import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyValidateProofs, classifyValidateRuns, latestRelevantRun, workflowRunsUrl,
} from '../scripts/release-gate.mjs';
import { buildCiProof } from '../scripts/ci-proof.mjs';

const SHA = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const greenJob = (name) => ({ name, conclusion: 'success' });
const proofContext = ({ id, full = true, conclusion = 'success' }) => {
  const needs = {
    preflight: { result: 'success' }, changes: { result: 'success', outputs: {
      heavy: String(full), mutants_requested: 'true', frontend: 'true',
      backend: String(full), integration: String(full),
    } },
    reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' },
    changed_mutants: { result: 'success' }, hacs: { result: full ? 'success' : 'skipped' },
    hassfest: { result: full ? 'success' : 'skipped' }, smoke: { result: full ? 'success' : 'skipped' },
    smoke_done: { result: full ? 'success' : 'skipped' }, golden: { result: full ? 'success' : 'skipped' },
    performance_smoke: { result: full ? 'success' : 'skipped' }, backend: { result: full ? 'success' : 'skipped' },
  };
  const proof = buildCiProof({ candidateSha: SHA, candidateTree: TREE, runId: id, attempt: 1, event: 'workflow_dispatch', needs });
  const jobs = [
    greenJob('Предполёт: документация, провенанс, процесс'),
    greenJob('Классификация изменённых файлов'), greenJob('Переиспользование: это дерево уже проверено'),
    greenJob('Фронтенд: типы, юниты, мутанты, синхрон бандла'),
    ...Array.from({ length: 6 }, (_, i) => greenJob(`Мутанты по диффу (${i + 1}/6): затронутые свидетели краснеют`)),
  ];
  if (full) jobs.push(
    greenJob('HACS: валидация репозитория'), greenJob('Hassfest: манифест интеграции'),
    ...Array.from({ length: 3 }, (_, i) => greenJob(`Смоки в браузере (шард ${i + 1} из 3)`)),
    greenJob('Смоки: все шарды зелёные'), greenJob('Golden-кадры против принятых эталонов'),
    greenJob('Перф-смок: бюджет времени кадра'), greenJob('Бэкенд: pytest в Home Assistant'),
  );
  const run = {
    databaseId: id, attempt: 1, status: 'completed', conclusion, event: 'workflow_dispatch',
    headSha: SHA, url: `https://run/${id}`, startedAt: `2026-09-13T10:${id}:00Z`,
  };
  return { run, context: { proof, jobs, reuseRuns: new Map() } };
};

test('release gate waits until an exact-SHA Validate exists and completes', () => {
  assert.equal(classifyValidateRuns([]), 'wait');
  assert.equal(classifyValidateRuns([{ status: 'queued', conclusion: null }]), 'wait');
  assert.equal(classifyValidateRuns([
    { id: 1, run_started_at: '2026-09-09T13:01:00Z', status: 'completed', conclusion: 'success' },
    { id: 2, run_started_at: '2026-09-09T13:02:00Z', status: 'in_progress', conclusion: null },
  ]), 'wait');
});

test('release gate accepts only completed success runs', () => {
  assert.equal(classifyValidateRuns([
    { status: 'completed', conclusion: 'success' },
    { status: 'completed', conclusion: 'success' },
  ]), 'success');
});

test('release gate fails closed for red, timed-out and skipped runs (cancelled ones are not verdicts, #511)', () => {
  for (const conclusion of ['failure', 'timed_out', 'action_required', 'skipped', null]) {
    assert.equal(
      classifyValidateRuns([{ status: 'completed', conclusion }]),
      'fail',
      `completed/${conclusion} must withhold the asset`,
    );
  }
});

test('#511: the latest non-cancelled run is the verdict; cancelled runs prove nothing', () => {
  const at = (minute, over) => ({ id: minute, run_started_at: `2026-09-09T13:${String(minute).padStart(2, '0')}:00Z`, status: 'completed', ...over });
  // an older green does not outrank a newer red …
  assert.equal(classifyValidateRuns([at(1, { conclusion: 'success' }), at(2, { conclusion: 'failure' })]), 'fail');
  // … and a newer green (re-run, dispatch with another baseline) refreshes an older red
  assert.equal(classifyValidateRuns([at(1, { conclusion: 'failure' }), at(2, { conclusion: 'success' })]), 'success');
  // order in the payload is irrelevant: the timestamp decides
  assert.equal(classifyValidateRuns([at(2, { conclusion: 'success' }), at(1, { conclusion: 'failure' })]), 'success');
  // cancelled twins are invisible
  assert.equal(classifyValidateRuns([at(1, { conclusion: 'cancelled' })]), 'wait');
  assert.equal(classifyValidateRuns([at(2, { conclusion: 'cancelled' }), at(1, { conclusion: 'success' })]), 'success');
  assert.equal(classifyValidateRuns([at(2, { conclusion: 'cancelled' }), at(1, { conclusion: 'failure' })]), 'fail');
  // a newer run still going means wait, even with an older green behind it
  assert.equal(classifyValidateRuns([at(1, { conclusion: 'success' }), at(2, { status: 'in_progress', conclusion: null })]), 'wait');
  assert.equal(latestRelevantRun([at(2, { conclusion: 'cancelled' }), at(1, { conclusion: 'success' })]).id, 1);
  assert.equal(latestRelevantRun([]), null);
});

test('#541: release skips a newer light proof but does not let it hide an older full failure', async () => {
  const older = proofContext({ id: 10, conclusion: 'failure' });
  const newer = proofContext({ id: 11, full: false });
  const contexts = new Map([[10, older.context], [11, newer.context]]);
  const verdict = await classifyValidateProofs({
    runs: [older.run, newer.run], repo: 'x/y', sha: SHA, tree: TREE, token: 'x',
    loadContext: async (run) => contexts.get(run.databaseId),
  });
  assert.equal(verdict.status, 'failed');
  assert.equal(verdict.url, 'https://run/10');
});

test('#541: a later complete full proof refreshes an older red release candidate', async () => {
  const older = proofContext({ id: 10, conclusion: 'failure' });
  const newer = proofContext({ id: 12 });
  const contexts = new Map([[10, older.context], [12, newer.context]]);
  const verdict = await classifyValidateProofs({
    runs: [older.run, newer.run], repo: 'x/y', sha: SHA, tree: TREE, token: 'x',
    loadContext: async (run) => contexts.get(run.databaseId),
  });
  assert.equal(verdict.status, 'green');
  assert.equal(verdict.url, 'https://run/12');
});

test('release gate can target the dedicated exact-SHA performance workflow', () => {
  assert.equal(
    workflowRunsUrl({ repo: 'Matysh/houseplan-card', workflow: 'performance.yml', sha: 'abc/123' }),
    'https://api.github.com/repos/Matysh/houseplan-card/actions/workflows/performance.yml/runs?head_sha=abc%2F123&per_page=100',
  );
});

test('#541: the release documents describe proof semantics', () => {
  const development = readFileSync(new URL('../docs/DEVELOPMENT.md', import.meta.url), 'utf8');
  assert.match(development, /requires a complete Validate proof for its SHA and\nGit tree/);
  assert.match(development, /cancelled or light run is not a release verdict and cannot hide an older full\nfailure/);
  assert.match(development, /Review, merge and release use the\nsame `missing` \/ `pending` \/ `cancelled` \/ `stale` \/ `failed` state machine/);
  const performance = readFileSync(new URL('../demo/performance/README.md', import.meta.url), 'utf8');
  assert.match(performance, /latest\nnon-cancelled run on the SHA/);
});
