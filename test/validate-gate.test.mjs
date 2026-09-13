// #510 §5: the review pipeline proves mutants on the material before spending a review cycle.
import assert from 'node:assert/strict';
import test from 'node:test';

import { validateGate, isMutantRun, provesMutants } from '../scripts/validate-gate.mjs';
import { buildCiProof } from '../scripts/ci-proof.mjs';

const SHA = 'a'.repeat(40);
const TREE = 'b'.repeat(40);

/** Fake gh: a scripted list of run snapshots per call, a virtual clock. */
const MUTANT_JOBS = [1, 2, 3, 4, 5, 6].map((n) => ({ name: `Мутанты по диффу (${n}/6): затронутые свидетели краснеют`, conclusion: 'success' }));
const OTHER_JOBS = [{ name: 'Фронтенд: типы, юниты, мутанты, синхрон бандла', conclusion: 'success' }];
const BASE_JOBS = [
  { name: 'Предполётные проверки: документация, провенанс, процесс', conclusion: 'success' },
  { name: 'Классификация изменённых файлов', conclusion: 'success' },
  { name: 'Переиспользование: это дерево уже проверено', conclusion: 'success' },
];

function fakeOps({ snapshots, onRef = [], jobsById = {} }) {
  let clock = 0;
  let calls = 0;
  const dispatched = [];
  return {
    ops: {
      listRuns: async () => { const s = snapshots[Math.min(calls, snapshots.length - 1)]; calls += 1; return s; },
      listRunsOnRef: async () => onRef,
      jobs: async (id) => jobsById[id] ?? [...OTHER_JOBS, ...MUTANT_JOBS],
      candidateTree: async () => TREE,
      proof: async (row) => {
        const selected = jobsById[row.databaseId] ?? [...OTHER_JOBS, ...MUTANT_JOBS];
        const mutants = provesMutants(selected);
        const proof = buildCiProof({
          candidateSha: SHA, candidateTree: TREE, runId: row.databaseId,
          attempt: row.attempt ?? 1, event: row.event,
          needs: {
            preflight: { result: 'success' },
            changes: { result: 'success', outputs: {
              heavy: 'false', mutants_requested: String(mutants),
              frontend: 'true', backend: 'false', integration: 'false',
            } },
            reuse: { result: 'success', outputs: {} },
            frontend: { result: 'success' },
            changed_mutants: { result: mutants ? 'success' : 'skipped' },
          },
        });
        return { proof, jobs: [...BASE_JOBS, ...selected], reuseRuns: new Map() };
      },
      dispatch: async (ref) => { dispatched.push(ref); },
      sleep: async (ms) => { clock += ms; },
      now: () => clock,
    },
    dispatched,
    calls: () => calls,
  };
}

const run = (over) => ({ databaseId: 1, status: 'completed', conclusion: 'success', url: 'https://run/1', event: 'workflow_dispatch', headSha: SHA, ...over });

test('#510: only a dispatch run proves mutants; a push run on the same SHA does not', () => {
  assert.equal(isMutantRun(run()), true);
  assert.equal(isMutantRun(run({ event: 'push' })), false);
});

test('#510 (ревью ТЗ r1): proof needs the mutant jobs executed and green, not just a green run', () => {
  assert.equal(provesMutants([...OTHER_JOBS, ...MUTANT_JOBS]), true);
  assert.equal(provesMutants(OTHER_JOBS), false, 'no mutant job at all — mutants were not requested');
  assert.equal(provesMutants([...OTHER_JOBS, ...MUTANT_JOBS.map((job) => ({ ...job, conclusion: 'skipped' }))]), false, 'skipped is not executed');
  assert.equal(provesMutants([...MUTANT_JOBS.slice(0, 2), { ...MUTANT_JOBS[2], conclusion: 'failure' }]), false);
  assert.equal(provesMutants([]), false);
});

test('#510 (ревью ТЗ r1): a green foreign dispatch whose mutant jobs were skipped is ignored — the gate dispatches its own', async () => {
  const foreign = run({ databaseId: 5, url: 'https://run/foreign' });
  const own = run({ databaseId: 6, url: 'https://run/own' });
  const fake = fakeOps({
    snapshots: [[foreign], [foreign], [own, foreign], [own, foreign]],
    jobsById: { 5: [...OTHER_JOBS, ...MUTANT_JOBS.map((job) => ({ ...job, conclusion: 'skipped' }))] },
  });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://run/own');
  assert.deepEqual(fake.dispatched, ['issue/1']);
});

test('#510 AC2: a completed green dispatch run on the material is accepted without a new dispatch', async () => {
  const fake = fakeOps({ snapshots: [[run({ event: 'push', databaseId: 7 }), run()]] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://run/1');
  assert.deepEqual(fake.dispatched, []);
});

test('#510 AC2: a completed red dispatch run returns the task without review', async () => {
  const fake = fakeOps({ snapshots: [[run({ conclusion: 'failure', url: 'https://run/red' })]] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops });
  assert.equal(outcome.result, 'failed');
  assert.equal(outcome.url, 'https://run/red');
});

test('#510 AC2: a green push run alone is not proof — the gate dispatches and waits', async () => {
  const pushOnly = [run({ event: 'push', databaseId: 7 })];
  const fake = fakeOps({ snapshots: [pushOnly, pushOnly, [...pushOnly, run({ status: 'in_progress', conclusion: null })], [...pushOnly, run()]] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.deepEqual(fake.dispatched, ['issue/1'], 'exactly one dispatch on the branch');
});

test('#510 AC2: the dispatch that never appears is reported as missing, naming a moved material', async () => {
  const fake = fakeOps({ snapshots: [[]], onRef: [run({ headSha: 'b'.repeat(40), url: 'https://run/other' })] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, appearMs: 5000, pollMs: 1000 });
  assert.equal(outcome.result, 'missing');
  assert.equal(outcome.url, 'https://run/other');
  assert.match(outcome.note, /ссылка ветки не указывает на материал/);
  assert.match(outcome.note, /bbbbbbbb/);
  // #539: прежде чем обвинять автора, гейт пробует ещё раз — своя гонка
  // закрывается, чужой коммит переживает и вторую попытку.
  assert.deepEqual(fake.dispatched, ['issue/1', 'issue/1']);
});

// #539: `workflow_dispatch` принимает только ref, а имя ветки резолвится на
// стороне GitHub. Конвейер сам переписывает ветку ребейзом, и 12.09 на #536
// диспатч встал на ДОпушевый SHA — задача вернулась автору, которому чинить
// было нечего. Вторая попытка обязана попасть на материал.
test('#539: диспатч, промахнувшийся по устаревшей ссылке, повторяется и принимается', async () => {
  const landed = run({ databaseId: 7, url: 'https://run/7' });
  const fake = fakeOps({
    // пусто → пусто (промах, повтор) → прогон на материале
    snapshots: [[], [], [landed]],
    onRef: [run({ headSha: 'b'.repeat(40), url: 'https://run/other' })],
  });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, appearMs: 5000, pollMs: 6000 });
  assert.equal(outcome.result, 'green', 'повторный диспатч попал на материал');
  assert.equal(outcome.url, 'https://run/7');
  assert.deepEqual(fake.dispatched, ['issue/1', 'issue/1'], 'ровно две попытки, не бесконечно');
});

test('#510 AC2: a dispatch that never finishes is red after the total window', async () => {
  const running = [run({ status: 'in_progress', conclusion: null })];
  const fake = fakeOps({ snapshots: [running] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, totalMs: 10_000, pollMs: 4000 });
  assert.equal(outcome.result, 'failed');
  assert.match(outcome.note, /не завершился/);
  assert.deepEqual(fake.dispatched, []);
});

test('#510: the tracked dispatch run is followed even when a newer dispatch appears first in the list', async () => {
  const first = run({ databaseId: 1, status: 'in_progress', conclusion: null });
  const newer = run({ databaseId: 2, status: 'in_progress', conclusion: null, url: 'https://run/2' });
  const fake = fakeOps({ snapshots: [[first], [newer, first], [newer, run({ databaseId: 1, url: 'https://run/1' })]] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://run/1');
});

test('#510 r1 M1: a cancelled dispatch proves nothing — the gate waits for its replacement instead of returning the task', async () => {
  const cancelled = run({ databaseId: 1, conclusion: 'cancelled', url: 'https://run/cancelled' });
  const replacement = run({ databaseId: 2, url: 'https://run/2' });
  const fake = fakeOps({ snapshots: [[cancelled], [replacement, cancelled]] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.equal(outcome.url, 'https://run/2');
  assert.deepEqual(fake.dispatched, [], 'the replacement was already there — no extra dispatch');
});

test('#510 r1 M1: a cancelled dispatch with no replacement gets one dispatch, not a red verdict', async () => {
  const cancelled = run({ databaseId: 1, conclusion: 'cancelled' });
  const fake = fakeOps({ snapshots: [[cancelled], [cancelled], [run({ databaseId: 3, url: 'https://run/3' }), cancelled]] });
  const outcome = await validateGate({ ref: 'issue/1', sha: SHA, ops: fake.ops, pollMs: 1000 });
  assert.equal(outcome.result, 'green');
  assert.deepEqual(fake.dispatched, ['issue/1']);
});
