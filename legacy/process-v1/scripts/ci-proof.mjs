#!/usr/bin/env node
// #541: один проверяемый контракт «зелёного Validate» для review, merge и
// release. Общий conclusion workflow недостаточен: лёгкий dispatch тоже green,
// а skipped job без доказанного content-addressed reuse ничего не доказывает.

import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { BASELINE_OVERLAY, REUSE_JOBS, globToRegExp } from './check-inputs.mjs';
import { reuseKey } from './gate-reuse.mjs';
import { jobInstanceNames, staticNamePrefix, validateJobs } from './workflow-jobs.mjs';
import { producerEnvironments } from './ci-job-environment.mjs';
import { browserPlanExecution, isTaskBrowserPlan } from './browser-plan-proof.mjs';
import { verifyRegistryRecord, sameRecord } from './ci-registry-verify.mjs';
import { taskCheckRecordError, taskCheckPlanFields, normalizeTaskCheckScope } from './task-check-reuse.mjs';
import { registryInputs } from './ci-registry-inputs.mjs';
import { producedRegistryRecords } from './ci-registry-records.mjs';

import { ciWorkflow, CI_WORKFLOWS, ciRunsUrl, registeredRuns, productWorkflow } from './ci-workflows.mjs';

export const CI_PROOF_SCHEMA = 'houseplan-ci-proof/v1';
export const CI_PROOF_ARTIFACT_PREFIX = 'ci-proof';
export const CI_PROOF_STATES = Object.freeze([
  'green', 'missing', 'pending', 'cancelled', 'stale', 'failed',
]);

// Мутанты по диффу — доказательство для ревью и слияния (#510): без всех
// исполненных mutant-jobs (сколько их — говорит матрица validate.yml, #622)
// ни то ни другое не разрешается. Релиз их не
// требует (#601): к кандидату беты каждая задача прогнана ими на ревью и на
// слитом кандидате, а `Release:` мутантов больше не запрашивает — политика
// с `mutants: true` объявляла бы каждый кандидат беты `stale`.
//
// #696: треки `show` и `ship` (PROCESS §5) мутантов по диффу до слияния не
// запрашивают — их доказательство лёгкое, `reviewLight`/`mergeLight`. Мутанты
// у них остаются в ночном полном реестре. С #709 мутантов в разработке нет
// ни на одном треке: `review`/`merge` с мутантами конвейер больше не выбирает.
export const CI_PROOF_POLICIES = Object.freeze({
  review: Object.freeze({ name: 'review', full: false, mutants: true }),
  merge: Object.freeze({ name: 'merge', full: false, mutants: true }),
  reviewLight: Object.freeze({ name: 'review-light', full: false, mutants: false }),
  mergeLight: Object.freeze({ name: 'merge-light', full: false, mutants: false }),
  release: Object.freeze({ name: 'release', full: true, mutants: false }),
});

// #622: какие job `validate.yml` доказывают проверку. `name` — контракт имени
// (у матричной job — неизменная часть до `${{`); его сверяет с YAML
// test/workflow-jobs.test.mjs, а здесь — resolveJobRules на каждом вызове
// evaluateCiProof. Сколько экземпляров и как точно они названы, читается из
// самого validate.yml (`strategy.matrix`): константа `count: 6` жила отдельно
// от матрицы и при смене шардов молча давала «claimed execution is absent».
export const JOB_RULES = Object.freeze({
  preflight: [{ job: 'preflight', name: 'Предполёт: документация, провенанс, процесс' }],
  changes: [{ job: 'changes', name: 'Классификация изменённых файлов' }],
  reuse: [{ job: 'reuse', name: 'Переиспользование: это дерево уже проверено' }],
  bundle: [{ job: 'bundle', name: 'Упаковка: свежие артефакты кандидата' }],
  product_guards: [{ job: 'product_guards', name: 'Продукт: свежие проверки диапазона и упаковки' }],
  frontend: [{ job: 'frontend', name: 'Фронтенд: типы, юниты, мутанты, синхрон бандла' },
    { job: 'tooling', name: 'Инструменты: вычисляемый набор юнитов' }],
  integration: [
    { job: 'hacs', name: 'HACS: валидация репозитория' },
    { job: 'hassfest', name: 'Hassfest: манифест интеграции' },
  ],
  mutants: [{ job: 'changed_mutants', name: 'Мутанты по диффу (' }],
  smoke: [
    { job: 'smoke', name: 'Смоки в браузере (шард ' },
    { job: 'smoke_done', name: 'Смоки: все шарды зелёные' },
  ],
  golden: [{ job: 'golden', name: 'Golden-кадры против принятых эталонов' }],
  performance_smoke: [{ job: 'performance_smoke', name: 'Перф-смок: бюджет времени кадра' }],
  geometry_parity: [{ job: 'geometry_parity', name: 'Геометрия: TS/Python parity исполнена' }],
  backend: [{ job: 'backend', name: 'Бэкенд: pytest в Home Assistant' }],
});

/**
 * Job validate.yml, чьё имя ни одно правило не читает. Записаны с именем,
 * чтобы контрактный тест видел ВСЕ job в обе стороны (#622 AC1): новая job
 * или переименование любой — решение, а не тихое расхождение.
 */
export const UNCONSUMED_JOBS = Object.freeze({
  browser_selected: 'Браузер: выбранные проверки push',
  proof: 'Доказательство выполненных проверок',
  // #657: публикация бандла для стенда — не проверка кода и не вход proof.
  dev_build: 'Бандл головы dev для стенда',
});

/** Общий префикс имён mutant-jobs — единственный источник для validate-gate. */
export const MUTANT_JOB_PREFIX = JOB_RULES.mutants[0].name;

/**
 * Правила с точными именами экземпляров из validate.yml. Расхождение
 * контракта с файлом — ошибка с названной job, а не пустое совпадение:
 * иначе ревью, слияние и релиз узнали бы о переименовании как о
 * «claimed execution is absent» (#622).
 */
export function resolveJobRules(workflowJobs = validateJobs(), profile = 'full') {
  return Object.fromEntries(Object.entries(JOB_RULES).map(([id, rules]) => [id, rules.filter(rule => profile !== 'product' || rule.job !== 'tooling').map((rule) => {
    const job = workflowJobs.get(rule.job);
    if (!job) throw new Error(`${id}: validate.yml has no job ${rule.job}`);
    const actual = job.matrix ? staticNamePrefix(job.name) : job.name;
    if (actual !== rule.name) {
      throw new Error(`${id}: validate.yml job ${rule.job} is named ${JSON.stringify(job.name)}, ci-proof expects ${JSON.stringify(rule.name)}${job.matrix ? ' as its prefix' : ''}`);
    }
    return { job: rule.job, names: jobInstanceNames(job) };
  })]));
}

/**
 * Все расхождения контракта имён с validate.yml — в обе стороны (#622 AC1):
 * правило без job, job с другим именем, job без записи. Пустой список —
 * контракт цел. Рантайм сверяет только читаемые job (resolveJobRules), тест —
 * все.
 */
export function jobContractProblems(workflowJobs = validateJobs()) {
  const problems = [];
  const declared = new Map();
  const declare = (job, name, owner) => {
    if (declared.has(job)) problems.push(`${job}: declared twice (${declared.get(job).owner}, ${owner})`);
    declared.set(job, { name, owner });
  };
  for (const [id, rules] of Object.entries(JOB_RULES)) for (const rule of rules) declare(rule.job, rule.name, `JOB_RULES.${id}`);
  for (const [job, name] of Object.entries(UNCONSUMED_JOBS)) declare(job, name, 'UNCONSUMED_JOBS');
  for (const [job, { name, owner }] of declared) {
    const entry = workflowJobs.get(job);
    if (!entry) { problems.push(`${job}: ${owner} names a job that validate.yml does not have`); continue; }
    const actual = entry.matrix ? staticNamePrefix(entry.name) : entry.name;
    if (actual !== name) problems.push(`${job}: validate.yml names it ${JSON.stringify(entry.name)}, ${owner} expects ${JSON.stringify(name)}${entry.matrix ? ' as its prefix' : ''}`);
  }
  for (const job of workflowJobs.keys()) {
    if (!declared.has(job)) problems.push(`${job}: validate.yml job is in neither JOB_RULES nor UNCONSUMED_JOBS`);
  }
  return problems;
}

const asBool = (value) => value === true || String(value) === 'true';
const runIdOf = (run) => Number(run?.id ?? run?.databaseId ?? 0);
const runAttemptOf = (run) => Number(run?.run_attempt ?? run?.runAttempt ?? run?.attempt ?? 1);
const runShaOf = (run) => run?.head_sha ?? run?.headSha ?? '';
const runUrlOf = (run) => run?.html_url ?? run?.url ?? null;
const jobResult = (needs, id) => needs?.[id]?.result || 'missing';
const reuseSourceKey = (run, attempt) => `${Number(run)}:${Number(attempt)}`;

export function ciProofArtifactName(runId, attempt) {
  return `${CI_PROOF_ARTIFACT_PREFIX}-${Number(runId)}-${Number(attempt)}`;
}

// ---------------------------------------------------------------------------
// Составное evidence (#573): proof называет ОТДЕЛЬНО продуктовое дерево,
// overlay принятых эталонов и content-ключи реюзных job. Один `tree`
// кандидата отвечал только «то же ли это дерево»; после приёмки эталонов
// ответ всегда «нет», хотя продукт не менялся, — и потребитель не мог ни
// объяснить, ни проверить, почему smoke и perf законно переиспользованы, а
// golden перегнан. Теперь он сверяет каждую часть с тем, что сам считает на
// checkout кандидата (`expected` в evaluateCiProof).

const overlayMatchers = BASELINE_OVERLAY.map((glob) => globToRegExp(glob));
export const isBaselineOverlayPath = (path) => overlayMatchers.some((re) => re.test(path));

/**
 * Identity продуктового дерева: строки `git ls-tree -r <sha>` без overlay
 * эталонов. Два коммита с одним значением отличаются только принятыми
 * кадрами и их индексом — ровно случай baseline-only коммита.
 */
export function productTreeId(lsTreeText) {
  const lines = String(lsTreeText).split(/\r?\n/).filter(Boolean)
    .filter((line) => !isBaselineOverlayPath(line.split('\t').slice(1).join('\t')))
    .sort();
  if (!lines.length) throw new Error('product tree is empty — ls-tree output has no entries');
  const hash = createHash('sha256');
  for (const line of lines) { hash.update(line); hash.update('\0'); }
  return hash.digest('hex');
}

/** Run из трейлера `Baseline-Reviewed: …/actions/runs/<id>`; null, когда трейлера нет. */
export function baselineReviewedRun(commitMessage) {
  const trailer = String(commitMessage).match(/^Baseline-Reviewed:\s*(\S+)\s*$/mi)?.[1];
  if (!trailer) return null;
  const id = Number(trailer.match(/\/actions\/runs\/(\d+)/)?.[1] || 0);
  if (!id) throw new Error(`Baseline-Reviewed trailer does not name an actions run: ${trailer}`);
  return id;
}

const gitOut = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/**
 * Evidence по checkout: то, что пишет job `proof`, и то, что независимо
 * считает потребитель на том же SHA. Ключи — те же `reuseKey`, что у job
 * `reuse`; `keys` в аргументе (её outputs) обязаны совпасть — иначе
 * дерево, по которому приняли решение о реюзе, не то, по которому написан proof.
 */
export function localEvidence(root = process.cwd(), { keys = null, rev = 'HEAD' } = {}) {
  const computed = Object.fromEntries(REUSE_JOBS.map((job) => [job, reuseKey(root, job)]));
  if (keys) {
    for (const job of REUSE_JOBS) {
      if (keys[job] && keys[job] !== computed[job]) {
        throw new Error(`${job}: reuse job key ${keys[job]} differs from the proof checkout key ${computed[job]}`);
      }
    }
  }
  const overlayDir = BASELINE_OVERLAY[0].replace(/\/\*\*$/, '');
  let baselineTree = null;
  try { baselineTree = gitOut(root, ['rev-parse', `${rev}:${overlayDir}`]).trim() || null; } catch { baselineTree = null; }
  const manifestPath = resolve(root, overlayDir, 'baselines-index.json');
  const manifestBytes = existsSync(manifestPath) ? readFileSync(manifestPath) : null;
  const manifestSha256 = manifestBytes
    ? createHash('sha256').update(manifestBytes).digest('hex') : null;
  let reviewedLocal = null;
  if (manifestBytes) {
    try { reviewedLocal = JSON.parse(manifestBytes).localAttestation?.sha256 ?? null; }
    catch { reviewedLocal = null; }
  }
  return {
    product: { tree: productTreeId(gitOut(root, ['ls-tree', '-r', '--full-tree', rev])) },
    baselines: {
      tree: baselineTree,
      manifestSha256,
      reviewedRun: baselineReviewedRun(gitOut(root, ['log', '-1', '--format=%B', rev])),
      reviewedLocal,
    },
    keys: computed,
  };
}

const EVIDENCE_FIELDS = [
  ['product.tree', (e) => e?.product?.tree],
  ['baselines.tree', (e) => e?.baselines?.tree ?? null],
  ['baselines.manifestSha256', (e) => e?.baselines?.manifestSha256 ?? null],
  ['baselines.reviewedRun', (e) => e?.baselines?.reviewedRun ?? null],
  ['baselines.reviewedLocal', (e) => e?.baselines?.reviewedLocal ?? null],
  ...REUSE_JOBS.map((job) => [`keys.${job}`, (e) => e?.keys?.[job]]),
];

/** Первое расхождение evidence proof с ожиданием потребителя, либо null. */
export function evidenceMismatch(actual, expected) {
  for (const [name, read] of EVIDENCE_FIELDS) {
    const have = read(actual);
    const want = read(expected);
    if (want === undefined) continue;
    if (have !== want) return `${name}: proof says ${have ?? 'null'}, candidate checkout says ${want ?? 'null'}`;
  }
  return null;
}

export function parseReuseMarker(text) {
  const sha = String(text).match(/^SHA:\s*([0-9a-f]{40})\s*$/mi)?.[1] || null;
  const runId = Number(String(text).match(/\/actions\/runs\/(\d+)/)?.[1] || 0) || null;
  const attempt = Number(String(text).match(/^попытка:\s*(\d+)\s*$/mi)?.[1] || 0) || null;
  if (!sha || !runId || !attempt)
    throw new Error('reuse marker must contain a full SHA, an actions/runs/<id> URL and an attempt');
  return { sourceSha: sha, sourceRun: runId, sourceAttempt: attempt };
}

export function requiredCheckIds({ request = {}, selection = {} } = {}) {
  const ids = ['preflight', 'changes', 'reuse'];
  if (asBool(selection.frontend)) ids.push('frontend');
  if (asBool(selection.integration)) ids.push('integration');
  if (asBool(request.mutants)) ids.push('mutants');
  if (asBool(request.full)) ids.push('smoke', 'golden', 'performance_smoke');
  else if (asBool(request.golden)) ids.push('golden');
  if (asBool(selection.geometry_parity)) ids.push('geometry_parity');
  if (asBool(selection.backend)) ids.push('backend');
  return ids;
}

const registryRecord = text => { try { return JSON.parse(text); } catch { return null; } };
const reuseClaim = (outputs, id) => ({
  key: outputs?.[`${id}_key`] || '',
  sourceRun: Number(outputs?.[`${id}_source_run`] || 0) || null,
  sourceAttempt: Number(outputs?.[`${id}_source_attempt`] || 0) || null,
  sourceSha: outputs?.[`${id}_source_sha`] || null,
  ...(outputs?.[`${id}_record`] ? { registry: registryRecord(outputs[`${id}_record`]) } : {}),
});

export function taskChecksFromNeeds(needs) {
  return Object.fromEntries(['tooling', 'browser_selected'].flatMap(id => {
    const value = needs?.[id]?.outputs?.task_check;
    if (!value) return [];
    const claim = JSON.parse(value);
    if (!['executed', 'reused'].includes(claim?.mode) || claim.record?.job !== id)
      throw Error('invalid scoped task check: ' + id);
    return [[id, claim]];
  }));
}

function taskCheckProblem(proof, jobs, contexts, policy) {
  if (proof.taskChecks && (typeof proof.taskChecks !== 'object' || Array.isArray(proof.taskChecks)))
    return 'invalid scoped task receipt map';
  for (const [id, claim] of Object.entries(proof.taskChecks || {})) {
    const name = id === 'tooling' ? JOB_RULES.frontend.find(r => r.job === id).name
      : id === 'browser_selected' ? UNCONSUMED_JOBS.browser_selected : null;
    if (!name || taskCheckRecordError(claim?.record) || claim.record.job !== id
      || !['executed', 'reused'].includes(claim.mode)
      || !sameRecord(taskCheckPlanFields(claim.record), claim.plan)
      || !executedCheckIsGreen([{ names: [name] }], jobs)) return id + ': invalid scoped task receipt';
    if (id === 'browser_selected') {
      try {
        if (!sameRecord(normalizeTaskCheckScope(id, proof.browserPlan?.planned), claim.record.scope))
          return id + ': receipt differs from planned browser coverage';
      } catch { return id + ': invalid planned browser coverage'; }
    }
    if (claim.mode === 'executed') {
      if (claim.record.sha !== proof.candidate?.sha || claim.record.run !== proof.run?.id
        || claim.record.workflow !== '.github/workflows/' + proof.run?.workflow) return id + ': foreign direct task receipt';
      if (claim.record.attempt !== proof.run?.attempt) {
        const verified = contexts?.get(id);
        if (!verified?.accepted || !verified.retained || !sameRecord(verified.record, claim.record)
          || !sameRecord(verified.target, proof.run) || claim.record.attempt >= proof.run.attempt
          || claim.retained !== undefined && !sameRecord(claim.retained, verified.retained))
          return id + ': foreign direct task receipt (retained source was not independently verified)';
      } else if (claim.retained !== undefined) return id + ': retained passport has no earlier source attempt';
    } else {
      if (policy?.fresh || policy?.full || asBool(proof.request?.full) || asBool(proof.request?.fresh))
        return id + ': fresh/full policy forbids scoped reuse';
      const verified = contexts?.get(id);
      if (!verified?.accepted || !sameRecord(verified.record, claim.record))
        return id + ': scoped source was not independently verified';
    }
  }
  return null;
}

/** Build the immutable JSON uploaded by the final Validate job. */
export function buildCiProof({
  candidateSha, candidateTree, runId, attempt, event, needs,
  requestedFull = false, requestedMutants = false, evidence = null,
  workflow = 'validate.yml', requiredProfiles = [],
  registry = null,
}) {
  const changes = needs?.changes?.outputs || {};
  const reuse = needs?.reuse?.outputs || {};
  const request = {
    full: asBool(requestedFull) || asBool(changes.heavy),
    mutants: asBool(requestedMutants) || asBool(changes.mutants_requested),
    ...(asBool(changes.registry_fresh) ? { fresh: true } : {}),
  };
  if (asBool(changes.golden) && !request.full) request.golden = true;
  if (asBool(needs?.golden?.outputs?.pending_visual)) request.pendingVisual = true;
  const selection = {
    frontend: Boolean(registry?.plan) || workflow === 'validate-product.yml' || asBool(changes.frontend),
    geometry_parity: asBool(changes.geometry_parity),
    backend: asBool(changes.backend),
    integration: asBool(changes.integration),
    // An explicit false is the new task contract; absent means legacy full
    // frontend+tooling coverage. Full regressions always require both groups.
    ...(changes.tooling !== undefined ? { tooling: request.full || asBool(changes.tooling) } : {}),
  };
  const checks = {};
  const executed = (id, result = jobResult(needs, id)) => {
    checks[id] = { mode: 'executed', result };
  };
  const executedOrReused = (id, result = jobResult(needs, id)) => {
    if (asBool(reuse[id])) {
      checks[id] = { mode: 'reused', result: 'success', reuse: reuseClaim(reuse, id) };
    } else {
      executed(id, result);
    }
  };
  executed('preflight');
  executed('changes');
  executed('reuse');
  if (selection.frontend) {
    if (registry?.plan) executedOrReused('frontend');
    else executed('frontend');
  }
  if (registry?.plan) { executed('bundle'); executed('product_guards'); }
  if (selection.integration) {
    checks.integration = {
      mode: 'executed',
      result: jobResult(needs, 'hacs') === 'success' && jobResult(needs, 'hassfest') === 'success'
        ? 'success' : `${jobResult(needs, 'hacs')}/${jobResult(needs, 'hassfest')}`,
    };
  }
  if (request.mutants) executed('mutants', jobResult(needs, 'changed_mutants'));
  if (request.full) {
    executedOrReused('smoke', asBool(reuse.smoke)
      ? 'success'
      : (jobResult(needs, 'smoke') === 'success' && jobResult(needs, 'smoke_done') === 'success'
        ? 'success' : `${jobResult(needs, 'smoke')}/${jobResult(needs, 'smoke_done')}`));
    executedOrReused('golden');
    executedOrReused('performance_smoke');
  }
  else if (request.golden) executedOrReused('golden');
  if (selection.geometry_parity) executedOrReused('geometry_parity');
  if (selection.backend) executedOrReused('backend');
  const requiredChecks = requiredCheckIds({ request, selection });
  // #573: content-ключ записывается и у ИСПОЛНЕННОЙ реюзной job — иначе
  // следующий прогон не докажет, что его reuse ссылается на те же входы.
  if (evidence?.keys) {
    for (const id of REUSE_JOBS) {
      if (checks[id]?.mode === 'executed') checks[id].key = evidence.keys[id] || null;
      if (checks[id]?.mode === 'reused' && !checks[id].reuse?.registry && evidence.keys[id] && checks[id].reuse?.key !== evidence.keys[id]) {
        throw new Error(`${id}: reuse marker key ${checks[id].reuse?.key} differs from the candidate key ${evidence.keys[id]}`);
      }
    }
  }
  return {
    schema: CI_PROOF_SCHEMA,
    candidate: { sha: candidateSha, tree: candidateTree },
    run: { id: Number(runId), attempt: Number(attempt), workflow, event },
    ...(workflow === 'validate-product.yml' ? { profile: 'product', requiredProfiles } : {}),
    request,
    selection,
    requiredChecks,
    executedChecks: requiredChecks.filter((id) => checks[id]?.mode === 'executed'),
    reusedChecks: requiredChecks.filter((id) => checks[id]?.mode === 'reused'),
    checks,
    taskChecks: taskChecksFromNeeds(needs),
    ...(registry?.plan ? { registry: { schema: 1, plan: registry.plan, produced: [] } } : {}),
    ...(changes.browser_plan ? { browserPlan: browserPlanExecution(JSON.parse(changes.browser_plan), needs) } : {}),
    ...(evidence ? { evidence } : {}),
  };
}

const sortedUnique = (values) => [...new Set(values)].sort();
const sameSet = (a, b) => JSON.stringify(sortedUnique(a)) === JSON.stringify(sortedUnique(b));
// Каждый экземпляр — ровно одна job с этим именем, и она зелёная. Лишняя job
// с похожим именем (другой размер матрицы в чужом YAML) доказательством не
// считается, недостающая — проваливает проверку.
function executedCheckIsGreen(rules, jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  return (rules || []).every((rule) => rule.names.every((name) => {
    const matches = list.filter((job) => job?.name === name);
    return matches.length === 1 && matches[0].conclusion === 'success';
  }));
}

/**
 * One state machine for all consumers. `reuseRuns` maps source run id to
 * `{run,jobs}` fetched independently from the marker claim.
 */
export function evaluateCiProof({
  run, proof, jobs = [], reuseRuns = new Map(), candidate = {}, policy, expected = null, reviewedRun = undefined,
  workflowJobs = undefined, profileRuns = new Map(), registryRepo = null, taskCheckContexts = new Map(),
}) {
  const result = (status, note) => ({ status, note, url: runUrlOf(run) });
  if (!run) return result('missing', 'Validate run is missing');
  if (run.status !== 'completed') return result('pending', `Validate run ${runIdOf(run)} is ${run.status || 'pending'}`);
  if (run.conclusion === 'cancelled') return result('cancelled', `Validate run ${runIdOf(run)} was cancelled`);
  if (!proof) return result('missing', `Validate run ${runIdOf(run)} has no proof artifact`);
  if (proof.schema !== CI_PROOF_SCHEMA) return result('stale', `unsupported proof schema ${proof.schema || 'missing'}`);
  const workflow = ciWorkflow(proof.run?.workflow);
  if (!workflow || run.path && ciWorkflow(run) !== workflow) return result('failed', 'foreign workflow path or proof workflow identity');
  const profile = CI_WORKFLOWS[workflow];
  if (['docs', 'tooling'].includes(profile)) return result('stale', `${profile} progress has no product authority; canonical validation required`);
  const identity = {
    runId: runIdOf(run), attempt: runAttemptOf(run), sha: candidate.sha || runShaOf(run), tree: candidate.tree,
  };
  if (proof.run?.id !== identity.runId || proof.run?.attempt !== identity.attempt
    || proof.candidate?.sha !== identity.sha
    || (identity.tree && proof.candidate?.tree !== identity.tree)) {
    return result('stale', 'proof does not belong to the candidate SHA/tree and run attempt');
  }
  if (runShaOf(run) && proof.candidate.sha !== runShaOf(run))
    return result('stale', 'run head SHA differs from proof candidate');
  if (run?.event && proof.run?.event !== run.event)
    return result('stale', 'run event differs from proof event');
  if (policy?.full && !asBool(proof.request?.full)) return result('stale', 'proof is light; full gates were not requested');
  if (policy?.name === 'release' && proof.request?.pendingVisual)
    return result('stale', 'pending visual changes require baseline acceptance and strict candidate validation');
  if (policy?.fresh && !asBool(proof.request?.fresh)) return result('stale', 'proof has no explicit fresh execution policy');
  if (policy?.fresh && proof.reusedChecks?.length) return result('stale', 'fresh policy requires every requested check to execute');
  const taskGolden = policy?.task && isTaskBrowserPlan(proof.browserPlan?.planned)
    && proof.browserPlan.planned.golden?.mode === 'selected'
    && proof.browserPlan.planned.golden.ids?.length > 0;
  if (policy?.golden && !asBool(proof.request?.full) && !asBool(proof.request?.golden) && !taskGolden)
    return result('stale', 'proof has no requested golden check');
  if (policy?.mutants && !asBool(proof.request?.mutants)) return result('stale', 'proof has no requested mutant jobs');
  if (asBool(proof.request?.full) && proof.selection?.tooling === false)
    return result('failed', 'full regression cannot omit tooling tests');
  let canonicalRequired = false;
  if (profile === 'product') {
    if (!Array.isArray(proof.requiredProfiles) || !proof.requiredProfiles.length
      || [...proof.requiredProfiles].some(p => !['product', 'tooling', 'docs'].includes(p))
      || new Set(proof.requiredProfiles).size !== proof.requiredProfiles.length)
      return result('failed', 'product profile has no complete event coverage plan');
    // #1059: push-event and candidate ranges can differ after rebase. A valid
    // companion-only plan grants no product authority; verify this run below
    // before requesting canonical validation, without waiting for companions.
    canonicalRequired = !proof.requiredProfiles.includes('product');
    if (!canonicalRequired && asBool(proof.request?.full) && !proof.requiredProfiles.includes('tooling'))
      return result('stale', 'full product proof has no tooling coverage plan; canonical validation required');
    for (const required of canonicalRequired ? [] : proof.requiredProfiles.filter(p => p !== 'product')) {
      const companion = profileRuns.get(required);
      if (!companion) return { ...result('stale', `${required} profile for the event is missing; canonical validation required`),
        reason: 'missing-companion' };
      if (runShaOf(companion.run) !== identity.sha || CI_WORKFLOWS[ciWorkflow(companion.run)] !== required)
        return result('failed', `${required}: foreign companion identity`);
      if (companion.run.status !== 'completed') return { ...result('pending', `${required} profile is still running`),
        url: runUrlOf(companion.run), runId: runIdOf(companion.run) };
      const names = [JOB_RULES.preflight[0].name, ...(required === 'tooling' ? [JOB_RULES.frontend.find(r => r.job === 'tooling').name] : [])];
      if (companion.run.conclusion !== 'success' || !executedCheckIsGreen(names.map(name => ({ names: [name] })), companion.jobs))
        return result('failed', `${required}: companion checks absent or not green`);
      if (required === 'tooling') {
        const source = companion.proof;
        if (!source || source.schema !== CI_PROOF_SCHEMA || source.candidate?.sha !== identity.sha
          || source.candidate?.tree !== proof.candidate.tree || source.run?.id !== runIdOf(companion.run)
          || source.run?.attempt !== runAttemptOf(companion.run) || source.run?.event !== companion.run.event
          || ciWorkflow(source.run?.workflow) !== ciWorkflow(companion.run)
          || source.checks?.preflight?.mode !== 'executed' || source.checks.preflight.result !== 'success')
          return result('failed', 'tooling: immutable companion proof is missing or foreign');
      }
      const taskProblem = taskCheckProblem(companion.proof || {}, companion.jobs, companion.taskCheckContexts,
        { ...policy, full: policy?.full || asBool(proof.request?.full), fresh: policy?.fresh || asBool(proof.request?.fresh) });
      if (taskProblem) return result('failed', taskProblem);
    }
  }
  // #573: потребитель, у которого есть checkout кандидата (release), сверяет
  // составное evidence, а не верит ему. Proof без блока при наличии ожиданий
  // устарел. Объявленный run просмотра кадров проверяется ТОЛЬКО здесь же:
  // review и merge ожиданий не передают и лишнего запроса к API не делают
  // (ревью r1, M1) — их семантика #541 не меняется.
  if (expected) {
    if (!proof.evidence) return result('stale', 'proof predates composite evidence (#573)');
    const mismatch = evidenceMismatch(proof.evidence, expected);
    if (mismatch) return result('failed', `evidence does not match the candidate checkout — ${mismatch}`);
    const declared = proof.evidence.baselines?.reviewedRun ?? null;
    if (declared) {
      const source = reviewedRun?.run;
      if (!source || runIdOf(source) !== declared || !productWorkflow(source.path || source.workflow || 'validate.yml')
        || source.status !== 'completed' || source.conclusion === 'cancelled') {
        return result('failed', `Baseline-Reviewed run ${declared} is missing, cancelled or not a Validate run`);
      }
    }
  }
  if (proof.evidence) {
    for (const id of REUSE_JOBS) {
      const claim = proof.checks?.[id];
      if (claim?.mode === 'reused' && !claim.reuse?.registry && claim.reuse?.key !== proof.evidence.keys?.[id])
        return result('failed', `${id}: reused marker key differs from the candidate content key`);
    }
  }
  const derived = requiredCheckIds(proof);
  if (!sameSet(derived, proof.requiredChecks || []))
    return result('failed', 'proof required-check list is incomplete or inconsistent');
  const claimedExecuted = derived.filter((id) => proof.checks?.[id]?.mode === 'executed');
  const claimedReused = derived.filter((id) => proof.checks?.[id]?.mode === 'reused');
  if (!sameSet(claimedExecuted, proof.executedChecks || [])
    || !sameSet(claimedReused, proof.reusedChecks || [])) {
    return result('failed', 'proof executed/reused check lists are inconsistent');
  }
  if (run.conclusion !== 'success')
    return result('failed', `Validate run ${runIdOf(run)} concluded ${run.conclusion || 'without success'}`);
  const taskProblem = taskCheckProblem(proof, jobs, taskCheckContexts, policy);
  if (taskProblem) return result('failed', taskProblem);
  // Additive v1 extension: old controllers can judge a fresh migration run.
  // New controllers independently require these always-fresh jobs even though
  // they are outside the legacy required/executed/reused ID lists.
  if (proof.registry) {
    if (proof.registry.schema !== 1 || !proof.registry.plan) return result('failed', 'unknown registry extension');
    for (const id of ['bundle', 'product_guards']) {
      if (proof.checks[id]?.mode !== 'executed' || proof.checks[id].result !== 'success'
        || !executedCheckIsGreen(JOB_RULES[id].map(rule => ({ names: [rule.name] })), jobs))
        return result('failed', id + ': mandatory fresh execution missing');
    }
  }
  if (proof.browserPlan) {
    try {
      const plan = proof.browserPlan.planned;
      browserPlanExecution(plan, {});
      for (const kind of ['smoke', 'golden']) if (plan[kind].mode === 'selected') {
        const reused = proof.browserPlan.reused?.[kind], execution = reused || proof.browserPlan.executed?.[kind];
        if (execution?.result !== 'success' || execution.mode !== 'selected' || !Array.isArray(execution.ids)
          || !sameSet(execution.ids, plan[kind].ids)
          || !executedCheckIsGreen([{ names: [UNCONSUMED_JOBS.browser_selected] }], jobs))
          return result('failed', `${kind}: selected push execution is missing or not green`);
        if (reused && (proof.browserPlan.executed?.[kind] || proof.taskChecks?.browser_selected?.mode !== 'reused'
          || !taskCheckContexts.get('browser_selected')?.accepted
          || reused.sourceRun !== proof.taskChecks.browser_selected.record.run
          || reused.sourceAttempt !== proof.taskChecks.browser_selected.record.attempt))
          return result('failed', `${kind}: selected reuse has no verified scoped source`);
        if (!reused && proof.taskChecks?.browser_selected?.mode === 'reused')
          return result('failed', `${kind}: reused scope cannot claim fresh execution`);
      }
    } catch { return result('failed', 'invalid browser coverage metadata'); }
  }
  let rules;
  try {
    rules = resolveJobRules(workflowJobs, proof.selection?.tooling === false ? 'product' : profile);
  } catch (error) {
    return result('failed', `job-name contract with validate.yml is broken (#622): ${error.message}`);
  }
  for (const id of derived) {
    const claim = proof.checks?.[id];
    if (!claim || claim.result !== 'success') return result('failed', `${id}: proof result is ${claim?.result || 'missing'}`);
    if (claim.mode === 'executed') {
      if (!executedCheckIsGreen(rules[id], jobs)) return result('failed', `${id}: claimed execution is absent, incomplete or not green`);
      continue;
    }
    if (claim.mode === 'reused' && claim.reuse?.registry) {
      if (policy?.fresh) return result('stale', id + ': fresh policy forbids reused execution');
      const record = claim.reuse.registry, source = reuseRuns.get(reuseSourceKey(record.run, record.attempt));
      if (!source || !proof.registry?.plan) return result('failed', id + ': registry source context missing');
      const direct = resolveJobRules(workflowJobs, 'product')[id];
      const verified = verifyRegistryRecord(record, { plan: proof.registry.plan, job: id,
        repo: registryRepo || run.repository?.full_name, ...source, ...(source.registryEquivalence?.[id] || {}),
        jobNames: direct.flatMap(rule => rule.names) });
      if (!verified.accepted) return result('failed', id + ': ' + verified.reason);
      if (record.key !== claim.reuse.key || record.run !== claim.reuse.sourceRun || record.attempt !== claim.reuse.sourceAttempt
        || record.sha !== claim.reuse.sourceSha) return result('failed', id + ': registry claim identity mismatch');
      if (id === 'frontend' && profile === 'full' && proof.selection?.tooling !== false
        && !executedCheckIsGreen([{ names: [JOB_RULES.frontend.find(rule => rule.job === 'tooling').name] }], jobs))
        return result('failed', 'fresh tooling is missing beside reused frontend');
      continue;
    }
    if (claim.mode !== 'reused'
      || !['smoke', 'golden', 'performance_smoke', 'geometry_parity', 'backend'].includes(id))
      return result('failed', `${id}: unsupported proof mode ${claim.mode || 'missing'}`);
    const reuse = claim.reuse || {};
    if (!/^[0-9a-f]{64}$/.test(reuse.key || '') || !/^[0-9a-f]{40}$/.test(reuse.sourceSha || '')
      || !Number.isInteger(reuse.sourceRun) || reuse.sourceRun <= 0
      || !Number.isInteger(reuse.sourceAttempt) || reuse.sourceAttempt <= 0) {
      return result('failed', `${id}: content-addressed reuse evidence is incomplete`);
    }
    const sourceKey = reuseSourceKey(reuse.sourceRun, reuse.sourceAttempt);
    const source = reuseRuns instanceof Map ? reuseRuns.get(sourceKey) : reuseRuns?.[sourceKey];
    if (!source || runIdOf(source.run) !== reuse.sourceRun || runAttemptOf(source.run) !== reuse.sourceAttempt
      || runShaOf(source.run) !== reuse.sourceSha
      || !executedCheckIsGreen(rules[id], source.jobs)) {
      return result('failed', `${id}: source run does not verify the reused successful job`);
    }
  }
  if (canonicalRequired)
    return result('stale', 'product profile is outside the candidate coverage plan; canonical validation required');
  return result('green', `${policy?.name || 'consumer'} proof is complete`);
}

/**
 * Evaluations arrive newest first. Cancelled and stale runs do not describe
 * the requested policy; the newest remaining run is the verdict. In
 * particular, a later failed full run must not be hidden by an older green
 * proof for the same candidate (#656).
 */
export function selectCiProofVerdict(evaluations) {
  const relevant = (evaluations || []).filter(
    (item) => item?.status !== 'cancelled' && item?.status !== 'stale',
  );
  if (relevant.length) return relevant[0];
  return { status: 'missing', note: 'no run carries a proof for the requested policy', url: null };
}

export function readCiProofArtifact(bytes) {
  const signature = 0x06054b50;
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at -= 1) {
    if (bytes.readUInt32LE(at) === signature) { eocd = at; break; }
  }
  if (eocd < 0) throw new Error('proof artifact is not a ZIP archive');
  const count = bytes.readUInt16LE(eocd + 10);
  let cursor = bytes.readUInt32LE(eocd + 16);
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('proof artifact central directory is malformed');
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const local = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!/(^|\/)proof[.]json$/.test(name)) continue;
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('proof artifact local header is malformed');
    const localName = bytes.readUInt16LE(local + 26);
    const localExtra = bytes.readUInt16LE(local + 28);
    const start = local + 30 + localName + localExtra;
    const compressed = bytes.subarray(start, start + compressedSize);
    const body = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!body) throw new Error(`unsupported proof artifact compression ${method}`);
    return JSON.parse(body.toString('utf8'));
  }
  throw new Error('proof.json is missing from artifact');
}

const apiHeaders = (token) => ({
  Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
  'User-Agent': 'houseplan-ci-proof', 'X-GitHub-Api-Version': '2022-11-28',
});

/**
 * База REST API (#751): `GITHUB_API_URL`, как у раннера, без хвостового `/`.
 * На github.com это тот же `https://api.github.com`; на GHES — `…/api/v3`.
 * `archive_download_url` приходит из API абсолютным и базу не берёт.
 */
export const githubApiBase = (env = process.env) => String(env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '');
/** Сервер GitHub для ссылок (#766): `GITHUB_SERVER_URL`, как у раннера, без хвостового `/`. */
export const githubServerUrl = (env = process.env) => String(env.GITHUB_SERVER_URL || 'https://github.com').replace(/\/+$/, '');

async function githubJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, { headers: apiHeaders(token) });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function githubCandidateTree({ repo, sha, token, fetchImpl = fetch, apiBase = githubApiBase() }) {
  const row = await githubJson(`${apiBase}/repos/${repo}/git/commits/${sha}`, token, fetchImpl);
  return row?.tree?.sha || null;
}

export async function loadGithubProofContext({
  repo, run, token, fetchImpl = fetch, withReviewedRun = false, apiBase = githubApiBase(),
}) {
  const runId = runIdOf(run);
  const attempt = runAttemptOf(run);
  const name = ciProofArtifactName(runId, attempt);
  const list = await githubJson(
    `${apiBase}/repos/${repo}/actions/runs/${runId}/artifacts?name=${encodeURIComponent(name)}`,
    token, fetchImpl,
  );
  const artifact = (list?.artifacts || []).find((item) => item.name === name && !item.expired);
  let proof = null;
  if (artifact) {
    const response = await fetchImpl(artifact.archive_download_url, { headers: apiHeaders(token) });
    if (!response.ok) throw new Error(`proof artifact download ${response.status}: ${await response.text()}`);
    proof = readCiProofArtifact(Buffer.from(await response.arrayBuffer()));
  }
  const jobsBody = await githubJson(
    `${apiBase}/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`, token, fetchImpl,
  );
  const jobs = jobsBody?.jobs || [];
  const profileRuns = new Map();
  if (proof?.run?.workflow === 'validate-product.yml') {
    const rows = registeredRuns(await githubJson(`${apiBase}/${ciRunsUrl({ repo, sha: runShaOf(run) })}`, token, fetchImpl), { sha: runShaOf(run) });
    for (const required of proof.requiredProfiles || []) {
      if (!['docs', 'tooling'].includes(required)) continue;
      const companion = rows.find(row => CI_WORKFLOWS[ciWorkflow(row)] === required);
      if (companion) {
        if (required === 'tooling') {
          const context = await loadGithubProofContext({ repo, run: companion, token, fetchImpl, apiBase });
          profileRuns.set(required, { run: companion, ...context });
          continue;
        }
        const body = await githubJson(`${apiBase}/repos/${repo}/actions/runs/${runIdOf(companion)}/jobs?per_page=100`, token, fetchImpl);
        profileRuns.set(required, { run: companion, jobs: body.jobs || [] });
      }
    }
  }
  const reuseRuns = new Map();
  let registrySource = null;
  for (const id of proof?.reusedChecks || []) {
    const sourceId = proof?.checks?.[id]?.reuse?.sourceRun;
    const sourceAttempt = proof?.checks?.[id]?.reuse?.sourceAttempt;
    const sourceKey = reuseSourceKey(sourceId, sourceAttempt);
    const record = proof?.checks?.[id]?.reuse?.registry;
    if (!sourceId || !sourceAttempt) continue;
    const previous = reuseRuns.get(sourceKey);
    if (previous && (!record || previous.registryEquivalence?.[id])) continue;
    if (record) {
      try {
        if (!registrySource) {
          const { registryApi } = await import('./ci-proof-registry.mjs');
          registrySource = registryApi({ repo, token, fetchImpl, apiBase, candidateSha: runShaOf(run), mode: proof.registry?.plan?.mode });
        }
        const context = await registrySource(record);
        reuseRuns.set(sourceKey, { ...context, registryEquivalence: { ...previous?.registryEquivalence,
          [id]: { sourceEquivalent: context.sourceEquivalent, actualWorkflowRecipe: context.actualWorkflowRecipe } } });
      } catch {
        reuseRuns.set(sourceKey, { ...(previous || { run: null, jobs: [] }),
          registryEquivalence: { ...previous?.registryEquivalence, [id]: { sourceEquivalent: false, actualWorkflowRecipe: null } } });
      }
      continue;
    }
    const sourceRun = await githubJson(
      `${apiBase}/repos/${repo}/actions/runs/${sourceId}/attempts/${sourceAttempt}`, token, fetchImpl,
    );
    const sourceJobs = await githubJson(
      `${apiBase}/repos/${repo}/actions/runs/${sourceId}/attempts/${sourceAttempt}/jobs?per_page=100`,
      token, fetchImpl,
    );
    reuseRuns.set(sourceKey, { run: sourceRun, jobs: sourceJobs?.jobs || [] });
  }
  // #573: объявленный человеком run просмотра кадров обязан существовать —
  // спрашивает только release-потребитель (`withReviewedRun`); review и merge
  // этот запрос не делают и от доступности старого run не зависят.
  let reviewedRun;
  const declared = proof?.evidence?.baselines?.reviewedRun;
  if (withReviewedRun && declared) {
    try {
      reviewedRun = { run: await githubJson(`${apiBase}/repos/${repo}/actions/runs/${declared}`, token, fetchImpl) };
    } catch {
      reviewedRun = null;
    }
  }
  let taskCheckContexts = new Map();
  if (Object.values(proof?.taskChecks || {}).some(claim => claim?.mode === 'reused'
    || claim?.mode === 'executed' && claim.record?.attempt !== proof.run?.attempt)) {
    const { loadTaskCheckContexts } = await import('./task-check-source.mjs');
    taskCheckContexts = await loadTaskCheckContexts({ proof, repo, token,
      candidateSha: runShaOf(run), fetchImpl, apiBase });
  }
  return { proof, jobs, reuseRuns, profileRuns, taskCheckContexts, registryRepo: repo,
    ...(reviewedRun !== undefined ? { reviewedRun } : {}) };
}

/** Read the runner's temporary data file without executing or interpolating JSON. */
export function readNeedsInput(args = process.argv.slice(2), env = process.env) {
  const files = args.filter(arg => arg === '--needs-file' || arg.startsWith('--needs-file='));
  if (files.length > 1) throw Error('duplicate --needs-file source');
  if (!files.length) return JSON.parse(env.NEEDS_JSON || '{}');
  const file = files[0].slice('--needs-file='.length);
  if (!files[0].startsWith('--needs-file=') || !file.trim()) throw Error('--needs-file requires a nonempty path');
  if (Object.hasOwn(env, 'NEEDS_JSON')) throw Error('ambiguous needs sources: --needs-file and NEEDS_JSON');
  return JSON.parse(readFileSync(resolve(file), 'utf8'));
}

async function main() {
  const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const marker = value('marker');
  const emit = value('emit');
  if (marker) {
    const parsed = parseReuseMarker(readFileSync(resolve(marker), 'utf8'));
    const output = `source_run=${parsed.sourceRun}\nsource_attempt=${parsed.sourceAttempt}\nsource_sha=${parsed.sourceSha}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
    process.stdout.write(output);
  } else if (emit) {
    const needs = readNeedsInput();
    const registry = process.env.REGISTRY_PLAN ? JSON.parse(process.env.REGISTRY_PLAN) : null;
    const reuseOutputs = needs?.reuse?.outputs || {};
    const evidence = localEvidence(process.cwd(), {
      keys: registry?.plan ? null : Object.fromEntries(REUSE_JOBS.map((job) => [job, reuseOutputs[`${job}_key`] || null])),
    });
    const proof = buildCiProof({
      candidateSha: process.env.CANDIDATE_SHA,
      candidateTree: process.env.CANDIDATE_TREE,
      runId: process.env.CI_RUN_ID,
      attempt: process.env.CI_RUN_ATTEMPT,
      event: process.env.CI_EVENT,
      needs,
      requestedFull: process.env.REQUEST_FULL,
      workflow: process.env.CI_WORKFLOW || 'validate.yml',
      requiredProfiles: JSON.parse(process.env.CI_REQUIRED_PROFILES || '[]'),
      requestedMutants: process.env.REQUEST_MUTANTS,
      evidence,
      registry,
    });
    if (registry?.plan) {
      const plans = [registry.plan];
      try {
        plans.push(registryInputs(process.cwd(), { mode: registry.plan.mode === 'exact' ? 'candidate' : 'exact',
          toolchain: registry.plan.toolchain, perfSet: registry.plan.perfSet }));
      } catch { /* stable/unknown mirrors cannot receive a beta alias */ }
      proof.registry.produced = producedRegistryRecords({ plans, proof, needs,
        repo: process.env.GITHUB_REPOSITORY, workflowRevision: process.env.GITHUB_WORKFLOW_SHA });
    }
    // Each stamp belongs to its actual producer job (all three for smoke), not
    // this aggregation runner. Legacy same-branch proofs keep their contract.
    proof.environments = producerEnvironments(needs);
    proof.performanceSet = ['glow', asBool(needs?.changes?.outputs?.perf_iso) && 'iso',
      asBool(needs?.changes?.outputs?.perf_interaction) && 'interaction'].filter(Boolean).join('-');
    const { stampRetainedTaskChecks } = await import('./task-check-source.mjs');
    await stampRetainedTaskChecks(proof, { repo: process.env.GITHUB_REPOSITORY,
      token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN });
    const target = resolve(emit);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(proof, null, 2)}\n`);
    console.log(`CI proof: ${target} (${proof.requiredChecks.join(', ')})`);
    console.log(`product tree ${evidence.product.tree.slice(0, 12)} · baselines ${evidence.baselines.tree?.slice(0, 12) || 'none'}`
      + ` · reviewed run ${evidence.baselines.reviewedRun || 'none'}`
      + ` · reviewed local ${evidence.baselines.reviewedLocal?.slice(0, 12) || 'none'}`);
  } else {
    console.error('usage: ci-proof.mjs --emit=<proof.json> [--needs-file=<json>] | --marker=<.reuse-marker>');
    process.exitCode = 2;
  }
}

// Finish module evaluation before loading the source adapter, which imports
// this module's artifact reader. Awaiting it at module scope deadlocks the CLI.
if (isMainModule(import.meta.url)) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
