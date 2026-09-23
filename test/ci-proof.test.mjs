import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';

import { fileURLToPath } from 'node:url';

import {
  CI_PROOF_POLICIES, baselineReviewedRun, buildCiProof, evaluateCiProof, loadGithubProofContext, localEvidence,
  parseReuseMarker, productTreeId, readCiProofArtifact, requiredCheckIds, selectCiProofVerdict,
} from '../scripts/ci-proof.mjs';
import { REUSE_JOBS } from '../scripts/check-inputs.mjs';
import { reuseKey } from '../scripts/gate-reuse.mjs';

export const SHA = 'a'.repeat(40);
export const TREE = 'b'.repeat(40);

/** Минимальный ZIP с одним `proof.json` (stored), как читает readCiProofArtifact. */
function zipWith(proof) {
  const body = Buffer.from(JSON.stringify(proof));
  const name = Buffer.from('proof.json');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 10);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + name.length, 12);
  eocd.writeUInt32LE(local.length + name.length + body.length, 16);
  const bytes = Buffer.concat([local, name, body, central, name, eocd]);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

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
  assert.equal(selectCiProofVerdict([red, newerFull]).status, 'green',
    '#619: a failed duplicate cannot hide a complete green proof for the same candidate');
});

test('#601 AC3: release policy accepts a full proof without requested mutants; light stays stale; review/merge still demand them', () => {
  // Кандидат беты (`Release:` на dev, event=push) с #601 несёт тяжёлые гейты без
  // мутантов — proof без запрошенных mutant-jobs для релиза зелёный.
  const beta = proofFixture({ id: 30, mutants: false });
  beta.run.event = 'push';
  beta.proof.run.event = 'push';
  assert.equal(CI_PROOF_POLICIES.release.mutants, false);
  assert.equal(evaluateCiProof({ ...beta, policy: CI_PROOF_POLICIES.release }).status, 'green');
  assert.ok(!beta.proof.requiredChecks.includes('mutants'), 'мутанты не в списке обязательных — их никто не запрашивал');
  // Лёгкий proof релиз по-прежнему не принимает — тяжёлые гейты обязаны быть запрошены.
  const light = proofFixture({ id: 31, full: false, mutants: false, backend: false, integration: false });
  assert.equal(evaluateCiProof({ ...light, policy: CI_PROOF_POLICIES.release }).status, 'stale');
  // Ревью и слияние без запрошенных мутантов — stale (#541 не ослаблен).
  for (const policy of [CI_PROOF_POLICIES.review, CI_PROOF_POLICIES.merge]) {
    assert.equal(policy.mutants, true, policy.name);
    const verdict = evaluateCiProof({ ...proofFixture({ id: 32, full: false, mutants: false, backend: false, integration: false }), policy });
    assert.equal(verdict.status, 'stale', policy.name);
    assert.match(verdict.note, /no requested mutant jobs/);
  }
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

// #573 — составное evidence. Proof называет отдельно продуктовое дерево,
// overlay принятых эталонов и content-ключи реюзных job; потребитель с
// checkout кандидата сверяет их, а не верит. Сценарий beta.3: кандидат C
// красный только по golden, baseline-only коммит B переиспользует зелёные
// job C и перегоняет golden.
const KEYS = Object.fromEntries(REUSE_JOBS.map((job, index) => [job, String(index + 1).repeat(64)]));
const evidenceOf = (over = {}) => ({
  product: { tree: 'p'.repeat(64) },
  baselines: {
    tree: 'c'.repeat(40), manifestSha256: 'd'.repeat(64),
    reviewedRun: 34853080375, reviewedLocal: null,
  },
  keys: { ...KEYS },
  ...over,
});

/** B: smoke и performance_smoke reused из красного-по-golden C, golden исполнена. */
function baselineOnlyFixture() {
  const fixture = proofFixture({ id: 20, attempt: 1 });
  const evidence = evidenceOf();
  const reuseFrom = (id) => ({
    mode: 'reused', result: 'success',
    reuse: { key: evidence.keys[id], sourceRun: 10, sourceAttempt: 1, sourceSha: 'e'.repeat(40) },
  });
  fixture.proof.checks.smoke = reuseFrom('smoke');
  fixture.proof.checks.performance_smoke = reuseFrom('performance_smoke');
  fixture.proof.checks.golden.key = evidence.keys.golden;
  fixture.proof.checks.geometry_parity.key = evidence.keys.geometry_parity;
  fixture.proof.checks.backend.key = evidence.keys.backend;
  fixture.proof.executedChecks = fixture.proof.executedChecks.filter((id) => !['smoke', 'performance_smoke'].includes(id));
  fixture.proof.reusedChecks = ['performance_smoke', 'smoke'];
  fixture.proof.evidence = evidence;
  fixture.jobs = fixture.jobs.filter((job) => !/Смоки|Перф-смок/.test(job.name));
  // C: run красный (golden different), но smoke и perf — зелёные job
  fixture.reuseRuns.set('10:1', {
    run: { id: 10, run_attempt: 1, status: 'completed', conclusion: 'failure', head_sha: 'e'.repeat(40) },
    jobs: [...smokeJobs(), success(names.smokeDone), success(names.performance),
      { name: names.golden, conclusion: 'failure' }, ...mutantJobs()],
  });
  fixture.reviewedRun = { run: { id: 34853080375, path: '.github/workflows/validate.yml', status: 'completed', conclusion: 'failure' } };
  fixture.expected = evidenceOf();
  return fixture;
}

test('#573 AC1: baseline-only коммит — reused smoke/perf из красного-по-golden кандидата, golden исполнена, proof green', () => {
  const fixture = baselineOnlyFixture();
  const verdict = evaluateCiProof({ ...fixture, policy: CI_PROOF_POLICIES.release });
  assert.equal(verdict.status, 'green', verdict.note);
  assert.deepEqual(fixture.proof.reusedChecks, ['performance_smoke', 'smoke']);
  assert.ok(fixture.proof.executedChecks.includes('golden'), 'golden сравнивает с новыми эталонами и перегоняется всегда');
  // review/merge без ожиданий: reviewed run не спрашивается и не судится (ревью r1, M1) —
  // недоступный или пропавший старый run не закрывает merge по чужой причине
  for (const reviewedRun of [undefined, null, { run: null }]) {
    assert.equal(evaluateCiProof({ ...fixture, expected: null, reviewedRun, policy: CI_PROOF_POLICIES.merge }).status, 'green',
      `merge без ожиданий при reviewedRun=${JSON.stringify(reviewedRun)}`);
    assert.equal(evaluateCiProof({ ...fixture, expected: null, reviewedRun, policy: CI_PROOF_POLICIES.review }).status, 'green');
  }
});

test('#573 AC3: красный smoke кандидата не прячется за зелёной golden — источник reuse обязан быть зелёной job', () => {
  const fixture = baselineOnlyFixture();
  fixture.reuseRuns.get('10:1').jobs = fixture.reuseRuns.get('10:1').jobs
    .map((job) => (job.name.startsWith('Смоки в браузере (шард 2') ? { ...job, conclusion: 'failure' } : job));
  const verdict = evaluateCiProof({ ...fixture, policy: CI_PROOF_POLICIES.release });
  assert.equal(verdict.status, 'failed');
  assert.match(verdict.note, /smoke: source run does not verify/);
});

test('#573 AC4: подмена content-ключа, product tree, overlay, индекса или reviewed run — fail-closed', () => {
  const fixture = baselineOnlyFixture();
  const withExpected = (over) => evaluateCiProof({
    ...fixture, expected: evidenceOf(over), policy: CI_PROOF_POLICIES.release,
  });
  assert.equal(withExpected({}).status, 'green');
  assert.match(withExpected({ keys: { ...KEYS, smoke: 'f'.repeat(64) } }).note, /keys\.smoke/);
  assert.equal(withExpected({ keys: { ...KEYS, smoke: 'f'.repeat(64) } }).status, 'failed');
  assert.match(withExpected({ product: { tree: 'q'.repeat(64) } }).note, /product\.tree/);
  assert.match(withExpected({ baselines: { tree: 'x'.repeat(40), manifestSha256: 'd'.repeat(64), reviewedRun: 34853080375 } }).note, /baselines\.tree/);
  assert.match(withExpected({ baselines: { tree: 'c'.repeat(40), manifestSha256: 'y'.repeat(64), reviewedRun: 34853080375 } }).note, /manifestSha256/);
  assert.match(withExpected({ baselines: { tree: 'c'.repeat(40), manifestSha256: 'd'.repeat(64), reviewedRun: 1 } }).note, /reviewedRun/);
  assert.match(withExpected({ baselines: {
    tree: 'c'.repeat(40), manifestSha256: 'd'.repeat(64),
    reviewedRun: 34853080375, reviewedLocal: 'a'.repeat(64),
  } }).note, /reviewedLocal/);
  // маркер реюза ссылается на ключ, отличный от ключа кандидата — внутренняя несогласованность
  const tampered = structuredClone(fixture.proof);
  tampered.checks.smoke.reuse.key = 'a'.repeat(64);
  assert.match(evaluateCiProof({ ...fixture, proof: tampered, policy: CI_PROOF_POLICIES.release }).note, /smoke: reused marker key differs/);
  // объявленный run просмотра кадров не существует / отменён / не Validate
  assert.match(evaluateCiProof({ ...fixture, reviewedRun: null, policy: CI_PROOF_POLICIES.release }).note, /Baseline-Reviewed run 34853080375 is missing/);
  assert.equal(evaluateCiProof({
    ...fixture, reviewedRun: { run: { id: 34853080375, path: '.github/workflows/validate.yml', status: 'completed', conclusion: 'cancelled' } },
    policy: CI_PROOF_POLICIES.release,
  }).status, 'failed');
  assert.equal(evaluateCiProof({
    ...fixture, reviewedRun: { run: { id: 34853080375, path: '.github/workflows/nightly.yml', status: 'completed', conclusion: 'success' } },
    policy: CI_PROOF_POLICIES.release,
  }).status, 'failed');
  // proof без evidence при наличии ожиданий — устарел, а не «сойдёт»
  const legacy = structuredClone(fixture.proof);
  delete legacy.evidence;
  assert.equal(evaluateCiProof({ ...fixture, proof: legacy, policy: CI_PROOF_POLICIES.release }).status, 'stale');
});

test('#573 r1 M1: reviewed run спрашивается у GitHub только для release-потребителя с ожиданиями', async () => {
  const proof = { ...baselineOnlyFixture().proof };
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (/\/artifacts\?name=/.test(url)) return { ok: true, json: async () => ({ artifacts: [] }) };
    if (/\/jobs\?/.test(url)) return { ok: true, json: async () => ({ jobs: [] }) };
    return { ok: true, json: async () => ({ id: 34853080375, path: '.github/workflows/validate.yml', status: 'completed', conclusion: 'failure' }) };
  };
  const run = { id: 20, run_attempt: 1 };
  // артефакта нет → proof null → reviewed run неизвестен и не спрашивается ни в одном режиме
  const bare = await loadGithubProofContext({ repo: 'x/y', run, token: 't', fetchImpl });
  assert.ok(!('reviewedRun' in bare));
  assert.ok(!urls.some((url) => url.endsWith('/actions/runs/34853080375')), 'без proof спрашивать нечего');
  // с proof: merge/review (withReviewedRun по умолчанию false) — запроса нет
  const withProof = (withReviewedRun) => loadGithubProofContext({
    repo: 'x/y', run, token: 't', withReviewedRun,
    fetchImpl: async (url) => (/\/artifacts\?name=/.test(url)
      ? { ok: true, json: async () => ({ artifacts: [{ name: 'ci-proof-20-1', expired: false, archive_download_url: 'zip://proof' }] }) }
      : url === 'zip://proof'
        ? { ok: true, arrayBuffer: async () => zipWith(proof) }
        : fetchImpl(url)),
  });
  urls.length = 0;
  const merge = await withProof(false);
  assert.deepEqual(merge.proof.evidence.baselines.reviewedRun, 34853080375);
  assert.ok(!('reviewedRun' in merge), 'merge/review не судят reviewed run');
  assert.ok(!urls.some((url) => url.endsWith('/actions/runs/34853080375')));
  urls.length = 0;
  const release = await withProof(true);
  assert.equal(release.reviewedRun.run.id, 34853080375);
  assert.ok(urls.some((url) => url.endsWith('/actions/runs/34853080375')), 'release спрашивает объявленный run');
});

test('#573: identity продуктового дерева не видит overlay эталонов, но видит всё остальное', () => {
  const lines = [
    '100644 blob 1111\tsrc/logic.ts',
    '100644 blob 2222\tdemo/golden/matrix.mjs',
    '100644 blob 3333\tdemo/golden/baselines/scene.png',
    '100644 blob 4444\tdemo/golden/baselines/baselines-index.json',
  ];
  const before = productTreeId(lines.join('\n'));
  const accepted = productTreeId(lines.map((line) => line.replace('3333', '5555').replace('4444', '6666')).join('\n'));
  assert.equal(accepted, before, 'приёмка эталонов — то же продуктовое дерево');
  assert.notEqual(productTreeId(lines.map((line) => line.replace('1111', '9999')).join('\n')), before);
  assert.notEqual(productTreeId(lines.map((line) => line.replace('2222', '9999')).join('\n')), before, 'сцены — продукт');
  assert.throws(() => productTreeId(''), /empty/);
  assert.equal(baselineReviewedRun('Accept frames\n\nBaseline-Reviewed: https://github.com/x/y/actions/runs/777\n'), 777);
  assert.equal(baselineReviewedRun('no trailer'), null);
  assert.throws(() => baselineReviewedRun('Baseline-Reviewed: somewhere-else\n'), /does not name an actions run/);
});

test('#573: buildCiProof пишет ключ исполненной реюзной job и отвергает маркер с чужим ключом', () => {
  const evidence = evidenceOf();
  const { proof } = proofFixture({ id: 30 });
  const needs = { preflight: { result: 'success' }, changes: { result: 'success', outputs: { heavy: 'true', mutants_requested: 'true', frontend: 'true', backend: 'true', geometry_parity: 'true', integration: 'true' } },
    reuse: { result: 'success', outputs: { smoke: 'true', smoke_key: evidence.keys.smoke, smoke_source_run: '10', smoke_source_attempt: '1', smoke_source_sha: 'e'.repeat(40) } },
    frontend: { result: 'success' }, hacs: { result: 'success' }, hassfest: { result: 'success' }, changed_mutants: { result: 'success' },
    smoke: { result: 'skipped' }, smoke_done: { result: 'skipped' }, golden: { result: 'success' }, performance_smoke: { result: 'success' },
    geometry_parity: { result: 'success' }, backend: { result: 'success' } };
  const built = buildCiProof({ candidateSha: SHA, candidateTree: TREE, runId: 30, attempt: 1, event: 'push', needs, evidence });
  assert.equal(built.checks.golden.key, evidence.keys.golden, 'исполненная job несёт свой content-ключ');
  assert.equal(built.checks.smoke.mode, 'reused');
  assert.deepEqual(built.evidence, evidence);
  assert.ok(!proof.evidence, 'без evidence блока нет — обратная совместимость записи');
  const foreign = { ...needs, reuse: { ...needs.reuse, outputs: { ...needs.reuse.outputs, smoke_key: 'f'.repeat(64) } } };
  assert.throws(() => buildCiProof({ candidateSha: SHA, candidateTree: TREE, runId: 30, attempt: 1, event: 'push', needs: foreign, evidence }),
    /smoke: reuse marker key .* differs from the candidate key/);
});

test('#573: evidence живого дерева считается детерминированно и совпадает с ключами gate-reuse', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const first = localEvidence(root);
  const second = localEvidence(root, { keys: first.keys });
  assert.deepEqual(second, first);
  assert.match(first.product.tree, /^[0-9a-f]{64}$/);
  assert.match(first.baselines.tree, /^[0-9a-f]{40}$/);
  assert.match(first.baselines.manifestSha256, /^[0-9a-f]{64}$/);
  assert.equal(first.baselines.reviewedLocal, null);
  for (const job of REUSE_JOBS) assert.equal(first.keys[job], reuseKey(root, job));
  assert.throws(() => localEvidence(root, { keys: { ...first.keys, smoke: 'f'.repeat(64) } }), /smoke: reuse job key/);
});
