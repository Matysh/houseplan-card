import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';

import {
  CI_PROOF_POLICIES, buildCiProof, evaluateCiProof, parseReuseMarker, readCiProofArtifact,
  requiredCheckIds, selectCiProofVerdict,
} from '../scripts/ci-proof.mjs';

export const SHA = 'a'.repeat(40);
export const TREE = 'b'.repeat(40);

const names = {
  preflight: 'Предполёт: документация, провенанс, процесс',
  changes: 'Классификация изменённых файлов',
  reuse: 'Переиспользование: это дерево уже проверено',
  frontend: 'Фронтенд: типы, юниты, мутанты, синхрон бандла',
  hacs: 'HACS: валидация репозитория',
  hassfest: 'Hassfest: манифест интеграции',
  smokeDone: 'Смоки: все шарды зелёные',
  golden: 'Golden-кадры против принятых эталонов',
  performance: 'Перф-смок: бюджет времени кадра',
  geometryParity: 'Геометрия: TS/Python parity исполнена',
  backend: 'Бэкенд: pytest в Home Assistant',
};

const success = (name) => ({ name, conclusion: 'success' });
const mutantJobs = () => Array.from({ length: 6 }, (_, index) => (
  success(`Мутанты по диффу (${index + 1}/6): затронутые свидетели краснеют`)
));
const smokeJobs = () => Array.from({ length: 3 }, (_, index) => (
  success(`Смоки в браузере (шард ${index + 1} из 3)`)
));

export function proofFixture({
  id = 10, attempt = 2, full = true, mutants = true,
  frontend = true, geometryParity = true, backend = true, integration = true, conclusion = 'success',
} = {}) {
  const needs = {
    preflight: { result: 'success' },
    changes: {
      result: 'success',
      outputs: {
        heavy: String(full), mutants_requested: String(mutants),
        frontend: String(frontend), geometry_parity: String(geometryParity),
        backend: String(backend), integration: String(integration),
      },
    },
    reuse: { result: 'success', outputs: {} },
    frontend: { result: frontend ? 'success' : 'skipped' },
    hacs: { result: integration ? 'success' : 'skipped' },
    hassfest: { result: integration ? 'success' : 'skipped' },
    changed_mutants: { result: mutants ? 'success' : 'skipped' },
    smoke: { result: full ? 'success' : 'skipped' },
    smoke_done: { result: full ? 'success' : 'skipped' },
    golden: { result: full ? 'success' : 'skipped' },
    performance_smoke: { result: full ? 'success' : 'skipped' },
    geometry_parity: { result: geometryParity ? 'success' : 'skipped' },
    backend: { result: backend ? 'success' : 'skipped' },
  };
  const proof = buildCiProof({
    candidateSha: SHA, candidateTree: TREE, runId: id, attempt,
    event: 'workflow_dispatch', needs,
  });
  const jobs = [success(names.preflight), success(names.changes), success(names.reuse)];
  if (frontend) jobs.push(success(names.frontend));
  if (integration) jobs.push(success(names.hacs), success(names.hassfest));
  if (mutants) jobs.push(...mutantJobs());
  if (full) jobs.push(...smokeJobs(), success(names.smokeDone), success(names.golden), success(names.performance));
  if (geometryParity) jobs.push(success(names.geometryParity));
  if (backend) jobs.push(success(names.backend));
  const run = {
    databaseId: id, attempt, status: 'completed', conclusion,
    event: 'workflow_dispatch', headSha: SHA, url: `https://run/${id}`,
  };
  return { run, proof, jobs, reuseRuns: new Map(), candidate: { sha: SHA, tree: TREE } };
}

test('#541: proof records candidate identity, request and exact required check set', () => {
  const fixture = proofFixture();
  assert.deepEqual(fixture.proof.candidate, { sha: SHA, tree: TREE });
  assert.deepEqual(fixture.proof.run, {
    id: 10, attempt: 2, workflow: 'validate.yml', event: 'workflow_dispatch',
  });
  assert.deepEqual(fixture.proof.requiredChecks, [
    'preflight', 'changes', 'reuse', 'frontend', 'integration', 'mutants',
    'smoke', 'golden', 'performance_smoke', 'geometry_parity', 'backend',
  ]);
  assert.deepEqual(fixture.proof.requiredChecks, requiredCheckIds(fixture.proof));
});

test('#541 AC: one state machine gives review, merge and release the same terminal semantics', () => {
  const full = proofFixture();
  for (const policy of Object.values(CI_PROOF_POLICIES)) {
    assert.equal(evaluateCiProof({ ...full, policy }).status, 'green', policy.name);
    assert.equal(evaluateCiProof({ ...full, run: null, policy }).status, 'missing', policy.name);
    assert.equal(evaluateCiProof({ ...full, run: { ...full.run, status: 'in_progress' }, policy }).status, 'pending', policy.name);
    assert.equal(evaluateCiProof({ ...full, run: { ...full.run, conclusion: 'cancelled' }, policy }).status, 'cancelled', policy.name);
    assert.equal(evaluateCiProof({ ...full, run: { ...full.run, conclusion: 'failure' }, policy }).status, 'failed', policy.name);
    assert.equal(evaluateCiProof({ ...full, candidate: { sha: SHA, tree: 'c'.repeat(40) }, policy }).status, 'stale', policy.name);
  }
});

test('#541 AC: full red followed by light green still blocks release; a later full green refreshes it', () => {
  const redFull = proofFixture({ id: 20, conclusion: 'failure' });
  const lightGreen = proofFixture({ id: 21, full: false, backend: false, integration: false });
  const red = evaluateCiProof({ ...redFull, policy: CI_PROOF_POLICIES.release });
  const light = evaluateCiProof({ ...lightGreen, policy: CI_PROOF_POLICIES.release });
  assert.equal(light.status, 'stale');
  assert.equal(selectCiProofVerdict([light, red]).status, 'failed');
  const newerFull = evaluateCiProof({ ...proofFixture({ id: 22 }), policy: CI_PROOF_POLICIES.release });
  assert.equal(selectCiProofVerdict([newerFull, light, red]).status, 'green');
});

test('#541 AC: green dispatch without six executed mutant jobs proves neither review nor merge', () => {
  const fixture = proofFixture({ full: false, backend: false, integration: false });
  fixture.jobs = fixture.jobs.filter((job) => !job.name.startsWith('Мутанты по диффу'));
  for (const policy of [CI_PROOF_POLICIES.review, CI_PROOF_POLICIES.merge]) {
    const verdict = evaluateCiProof({ ...fixture, policy });
    assert.equal(verdict.status, 'failed', policy.name);
    assert.match(verdict.note, /mutants: claimed execution/);
  }
});

test('#541 AC: SHA, tree, run attempt, event and proof inventories cannot drift', () => {
  const fixture = proofFixture();
  assert.equal(evaluateCiProof({ ...fixture, run: { ...fixture.run, attempt: 3 }, policy: CI_PROOF_POLICIES.release }).status, 'stale');
  assert.equal(evaluateCiProof({ ...fixture, run: { ...fixture.run, headSha: 'd'.repeat(40) }, policy: CI_PROOF_POLICIES.release }).status, 'stale');
  assert.equal(evaluateCiProof({ ...fixture, run: { ...fixture.run, event: 'push' }, policy: CI_PROOF_POLICIES.release }).status, 'stale');
  const forged = structuredClone(fixture.proof);
  forged.executedChecks = forged.executedChecks.filter((id) => id !== 'backend');
  assert.equal(evaluateCiProof({ ...fixture, proof: forged, policy: CI_PROOF_POLICIES.release }).status, 'failed');
});

test('#541 AC: reuse needs a content key, marker source SHA/run and the successful source job', () => {
  const fixture = proofFixture();
  fixture.proof.checks.golden = {
    mode: 'reused', result: 'success',
    reuse: { key: 'e'.repeat(64), sourceRun: 77, sourceAttempt: 3, sourceSha: 'f'.repeat(40) },
  };
  fixture.proof.executedChecks = fixture.proof.executedChecks.filter((id) => id !== 'golden');
  fixture.proof.reusedChecks = ['golden'];
  fixture.jobs = fixture.jobs.filter((job) => job.name !== names.golden);
  fixture.reuseRuns.set('77:3', {
    run: { id: 77, run_attempt: 3, status: 'completed', conclusion: 'failure', head_sha: 'f'.repeat(40) },
    jobs: [success(names.golden)],
  });
  assert.equal(evaluateCiProof({ ...fixture, policy: CI_PROOF_POLICIES.release }).status, 'green',
    'individual green job remains lawful even when an unrelated source job made its run red');
  const noSource = new Map();
  assert.equal(evaluateCiProof({ ...fixture, reuseRuns: noSource, policy: CI_PROOF_POLICIES.release }).status, 'failed');
  const badKey = structuredClone(fixture.proof);
  badKey.checks.golden.reuse.key = 'short';
  assert.equal(evaluateCiProof({ ...fixture, proof: badKey, policy: CI_PROOF_POLICIES.release }).status, 'failed');
});

test('#548: geometry parity reuse is accepted only with a verified source job', () => {
  const fixture = proofFixture();
  fixture.proof.checks.geometry_parity = {
    mode: 'reused', result: 'success',
    reuse: { key: 'e'.repeat(64), sourceRun: 78, sourceAttempt: 2, sourceSha: 'f'.repeat(40) },
  };
  fixture.proof.executedChecks = fixture.proof.executedChecks.filter((id) => id !== 'geometry_parity');
  fixture.proof.reusedChecks = ['geometry_parity'];
  fixture.jobs = fixture.jobs.filter((job) => job.name !== names.geometryParity);
  fixture.reuseRuns.set('78:2', {
    run: { id: 78, run_attempt: 2, status: 'completed', conclusion: 'success', head_sha: 'f'.repeat(40) },
    jobs: [success(names.geometryParity)],
  });

  assert.equal(evaluateCiProof({ ...fixture, policy: CI_PROOF_POLICIES.release }).status, 'green');
  assert.equal(evaluateCiProof({ ...fixture, reuseRuns: new Map(), policy: CI_PROOF_POLICIES.release }).status, 'failed');
});

test('#541: reuse marker parser fails closed', () => {
  assert.deepEqual(parseReuseMarker(
    `golden прогнана успешно\nSHA: ${SHA}\nпрогон: https://github.com/x/y/actions/runs/123\nпопытка: 4\n`,
  ), { sourceSha: SHA, sourceRun: 123, sourceAttempt: 4 });
  assert.throws(() => parseReuseMarker('SHA: short\nпрогон: https://github.com/x/y/actions/runs/123\nпопытка: 1\n'), /must contain/);
  assert.throws(() => parseReuseMarker(`SHA: ${SHA}\n`), /must contain/);
});

test('#541: uploaded deflated artifact is read without an external ZIP dependency', () => {
  const body = Buffer.from(JSON.stringify({ schema: 'test', ok: true }));
  const compressed = deflateRawSync(body);
  const name = Buffer.from('nested/proof.json');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(body.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const directoryAt = local.length + name.length + compressed.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + name.length, 12);
  eocd.writeUInt32LE(directoryAt, 16);
  const zip = Buffer.concat([local, name, compressed, central, name, eocd]);
  assert.deepEqual(readCiProofArtifact(zip), { schema: 'test', ok: true });
});
