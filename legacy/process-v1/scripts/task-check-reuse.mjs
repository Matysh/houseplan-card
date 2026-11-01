// #1060: scoped task receipts share storage, never full-regression authority.
import { BUILD_OUTPUT, globToRegExp } from './check-inputs.mjs';
import { DOCS_PATHS } from './ci-profile-paths.mjs';
import { canonical, digest, executionHeader, registryReader } from './ci-registry-inputs.mjs';
import { sameRecord, REGISTRY_TTL_MS } from './ci-registry-verify.mjs';
import { browserPlanExecution, isTaskBrowserPlan } from './browser-plan-proof.mjs';
import { parseWorkflowJobs } from './workflow-jobs.mjs';
import { execFileSync } from 'node:child_process';

export const TASK_CHECK_SCHEMA = 'houseplan-task-check/v1';
export const TASK_CHECK_JOBS = Object.freeze(['tooling', 'browser_selected']);
export const TASK_CHECK_JOB_NAMES = Object.freeze({
  tooling: 'Инструменты: вычисляемый набор юнитов',
  browser_selected: 'Браузер: выбранные проверки push',
});
const workflows = job => ['.github/workflows/validate.yml',
  `.github/workflows/validate-${job === 'tooling' ? 'tooling' : 'product'}.yml`];
const excluded = [...DOCS_PATHS, ...BUILD_OUTPUT].map(globToRegExp);
const hex = (value, size) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
const sorted = values => [...values].sort();
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const validStrings = values => Array.isArray(values) && values.every(value => typeof value === 'string' && value.length > 0)
  && new Set(values).size === values.length;
const environmentError = value => !value || typeof value !== 'object' || Array.isArray(value)
  || ['node', 'platform', 'arch', 'locale', 'timezone'].some(key => typeof value[key] !== 'string' || !value[key])
  || value.nodeFlags !== undefined && (!Array.isArray(value.nodeFlags) || value.nodeFlags.some(flag => typeof flag !== 'string'));

export function normalizeTaskCheckScope(job, browserPlan, toolingTests = []) {
  if (job === 'tooling') {
    if (!validStrings(toolingTests) || toolingTests.some(path => !/^test\/[^/]+\.test\.mjs$/.test(path)))
      throw Error('invalid tooling test scope');
    return { suite: 'tooling', tests: sorted(toolingTests) };
  }
  if (job !== 'browser_selected' || !isTaskBrowserPlan(browserPlan)) throw Error('task receipt needs selected task coverage');
  browserPlanExecution(browserPlan, {});
  const scope = { schema: 1, scope: 'task' };
  for (const kind of ['smoke', 'golden']) {
    const item = browserPlan[kind];
    if (!['none', 'selected'].includes(item.mode) || !validStrings(item.ids)
      || item.mode === 'none' && item.ids.length) throw Error('invalid selected task IDs');
    scope[kind] = { mode: item.mode, ids: sorted(item.ids) };
    if (kind === 'golden') {
      const intent = (item.intent || []).map(({ id, issue, expectation, reason }) => ({ id, issue, expectation, reason }));
      if (new Set(intent.map(item => canonical(item))).size !== intent.length) throw Error('duplicate task visual intent');
      scope[kind].intent = intent.sort((a, b) => compare(canonical(a), canonical(b)));
    }
  }
  if (!['smoke', 'golden'].some(kind => scope[kind].mode === 'selected')) throw Error('empty selected task receipt');
  return scope;
}

export function taskCheckSnapshot(root, ref = 'HEAD') {
  const git = value => execFileSync('git', ['-C', root, 'rev-parse', '--verify', value], { encoding: 'utf8' }).trim();
  const sha = git(ref + '^{commit}'), reader = registryReader(root, sha);
  return { entries: new Map(reader.rows.map(({ path, oid, mode }) => [path, { oid, mode }])),
    read: reader.read, readMany: reader.readMany, sha, tree: git(sha + '^{tree}') };
}
function inputIdentity(snapshot) {
  const inputs = [];
  for (const [path, entry] of [...snapshot.entries].sort(([a], [b]) => compare(a, b))) {
    if (excluded.some(pattern => pattern.test(path))) continue;
    if (!['100644', '100755'].includes(entry.mode) || !hex(entry.oid, 40)) throw Error('missing/symbolic task input: ' + path);
    inputs.push([path, entry.mode, entry.oid]);
  }
  if (!inputs.length) throw Error('empty immutable task input tree');
  return digest(canonical(inputs));
}
async function readInput(snapshot, path) {
  const entry = snapshot.entries.get(path);
  if (!entry || !['100644', '100755'].includes(entry.mode) || !hex(entry.oid, 40)) throw Error('missing/symbolic task input: ' + path);
  return (await snapshot.read(path)).toString('utf8').replace(/\r\n?/g, '\n');
}
async function executionRecipe(snapshot, job) {
  const recipes = await Promise.all(workflows(job).map(async path => {
    const text = await readInput(snapshot, path), definition = parseWorkflowJobs(text, path).get(job);
    if (!definition || definition.name !== TASK_CHECK_JOB_NAMES[job] || definition.size !== 1)
      throw Error('task job name/shape differs from its execution contract');
    const marks = [...text.matchAll(/^  ([\w-]+):\s*$/gm)], index = marks.findIndex(mark => mark[1] === job);
    if (index < 0) throw Error('task job recipe is absent');
    const body = text.slice(marks[index].index, marks[index + 1]?.index).trimEnd();
    return digest(executionHeader(text) + '\0' + body);
  }));
  if (recipes[0] !== recipes[1]) throw Error('generated task job differs from the canonical recipe');
  return recipes[0];
}
const planKey = plan => digest(canonical({ schema: plan.schema, job: plan.job, scope: plan.scope,
  inputs: plan.inputs, recipe: plan.recipe, toolchain: plan.toolchain }));

export async function taskCheckPlanFromSnapshot(snapshot, { job, browserPlan, environment }) {
  if (!TASK_CHECK_JOBS.includes(job)) throw Error('unknown task receipt job');
  if (environmentError(environment)) throw Error('actual task execution environment is missing');
  const toolchain = JSON.parse(JSON.stringify(environment));
  if (!sameRecord(toolchain, environment)) throw Error('non-JSON task execution environment');
  let tests = [];
  if (job === 'tooling') {
    const paths = JSON.parse(await readInput(snapshot, 'scripts/ci-profile-paths.json'));
    if (!Array.isArray(paths.product) || !Array.isArray(paths.tooling)) throw Error('missing computed tooling policy');
    tests = paths.product.filter(path => /^!test\/[^/]+\.test\.mjs$/.test(path)).map(path => path.slice(1));
    if (tests.some(path => !paths.tooling.includes(path) || !snapshot.entries.has(path))) throw Error('missing computed tooling test');
  }
  const plan = { schema: TASK_CHECK_SCHEMA, job, scope: normalizeTaskCheckScope(job, browserPlan, tests),
    inputs: inputIdentity(snapshot), recipe: await executionRecipe(snapshot, job), toolchain };
  return { ...plan, key: planKey(plan) };
}
export async function taskCheckPlan(root, { ref = 'HEAD', snapshot, ...options }) {
  return taskCheckPlanFromSnapshot(snapshot || taskCheckSnapshot(root, ref), options);
}
export function taskCheckPlanFields(record) {
  const { schema, job, key, scope, inputs, recipe, toolchain } = record || {};
  return { schema, job, key, scope, inputs, recipe, toolchain };
}
export function taskCheckRecordError(record) {
  if (!record || record.schema !== TASK_CHECK_SCHEMA || !TASK_CHECK_JOBS.includes(record.job)) return 'unknown task receipt';
  if (!hex(record.key, 64) || !hex(record.inputs, 64) || !hex(record.recipe, 64) || environmentError(record.toolchain)) return 'invalid task input identity';
  try {
    const scope = normalizeTaskCheckScope(record.job, record.scope, record.scope?.tests);
    if (!sameRecord(scope, record.scope) || planKey(record) !== record.key) return 'inconsistent task scope/key';
  } catch { return 'invalid task receipt scope'; }
  if (typeof record.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(record.repo)
    || !positive(record.run) || !positive(record.attempt) || !hex(record.sha, 40)
    || record.workflow_revision !== record.sha || !workflows(record.job).includes(record.workflow)
    || record.jobName !== TASK_CHECK_JOB_NAMES[record.job] || record.outcome !== 'success' || record.reused !== false
    || !Number.isFinite(Date.parse(record.created))) return 'invalid task producer identity';
  return null;
}
export function makeTaskCheckRecord(plan, { repo, run, attempt, sha, workflow, created = new Date().toISOString() }) {
  const record = { ...taskCheckPlanFields(plan), repo, run, attempt, sha, workflow,
    workflow_revision: sha, jobName: TASK_CHECK_JOB_NAMES[plan.job], created, outcome: 'success', reused: false };
  const error = taskCheckRecordError(record);
  if (error) throw Error(error);
  return record;
}

/** A partial rerun may retain an execution, never rename its source attempt. */
export function retainedTaskCheck(proof, claim) {
  const record = claim?.record;
  return !!record && !!proof?.run && claim?.mode === 'executed' && record.run === proof.run.id
    && record.sha === proof?.candidate?.sha
    && record.workflow === '.github/workflows/' + proof?.run?.workflow
    && positive(record.attempt) && positive(proof.run?.attempt) && record.attempt < proof.run.attempt;
}

function retainedExecution(record, sourceJobs, currentJobs, sourceRun, currentRun) {
  const source = sourceJobs.filter(job => job.name === record.jobName);
  const current = currentJobs.filter(job => job.name === record.jobName);
  if (source.length !== 1 || current.length !== 1) throw Error('retained source/current job is absent or ambiguous');
  const projection = (job, attempt) => {
    const start = Date.parse(job.started_at), end = Date.parse(job.completed_at);
    if (!positive(job.id) || job.run_id !== record.run || job.run_attempt !== attempt || job.head_sha !== record.sha
      || job.status !== 'completed' || job.conclusion !== 'success'
      || !Number.isFinite(start) || !Number.isFinite(end) || end < start
      || !Array.isArray(job.steps) || !job.steps.length) throw Error('retained job execution is incomplete/red/foreign');
    const numbers = new Set();
    const steps = job.steps.map(step => {
      const a = Date.parse(step.started_at), b = Date.parse(step.completed_at);
      const skipped = step.conclusion === 'skipped' && step.started_at === null && step.completed_at === null;
      if (!positive(step.number) || numbers.has(step.number) || typeof step.name !== 'string' || !step.name
        || step.status !== 'completed' || !['success', 'skipped'].includes(step.conclusion)
        || !skipped && (!Number.isFinite(a) || !Number.isFinite(b) || b < a || a < start || b > end))
        throw Error('retained job steps are missing/incomplete/red');
      numbers.add(step.number);
      return { number: step.number, name: step.name, status: step.status, conclusion: step.conclusion,
        started_at: step.started_at, completed_at: step.completed_at };
    });
    return { name: job.name, status: job.status, conclusion: job.conclusion,
      started_at: job.started_at, completed_at: job.completed_at, steps };
  };
  const before = projection(source[0], record.attempt), after = projection(current[0], currentRun.run_attempt);
  const started = Date.parse(sourceRun.run_started_at || sourceRun.created_at);
  const next = Date.parse(currentRun.run_started_at), stamp = Date.parse(record.created);
  if (!sameRecord(before, after) || !Number.isFinite(next) || !Number.isFinite(started)
    || Date.parse(before.started_at) < started - 30000 || Date.parse(before.completed_at) >= next
    || stamp < Date.parse(before.started_at) || stamp > Date.parse(before.completed_at) + 1000)
    throw Error('current job is not the exact retained source execution');
  // GitHub creates new job IDs for retained jobs. Exact stamps/steps, not ID
  // equality or overall run colour, establish that it did not execute again.
  return { sourceAttempt: record.attempt, sourceJobId: source[0].id,
    currentAttempt: currentRun.run_attempt, currentJobId: current[0].id, execution: digest(canonical(before)) };
}

export async function verifyTaskCheckClaim(claim, { plan, repo, run, latestRun, jobs = [], artifact, proof,
  candidateSnapshot, sourceSnapshot, companionsGreen = false, now = Date.now(), request = {},
  consumerProof = null, retainedRun = null, retainedJobs = [], producing = false } = {}) {
  const fail = reason => ({ accepted: false, reason });
  if (!['executed', 'reused'].includes(claim?.mode)) return fail('unknown task claim mode');
  if (claim.mode === 'reused' && (request.full || request.fresh || request.night || request.stable || request.candidate))
    return fail('fresh/full policy forbids task reuse');
  const record = claim.record, malformed = taskCheckRecordError(record);
  if (malformed) return fail(malformed);
  const retained = retainedTaskCheck(consumerProof, claim);
  if (!sameRecord(taskCheckPlanFields(record), plan) || !sameRecord(claim.plan, plan)) return fail('task claim differs from the required scope/inputs');
  if (record.repo !== repo || run?.repository?.full_name !== repo || run?.head_repository?.full_name !== repo
    || run.path !== record.workflow || !/^(?:dev|main|issue\/[1-9]\d+-[\w-]+)$/.test(run.head_branch || ''))
    return fail('foreign task producer repository/workflow/branch');
  if (run.status !== 'completed' || !retained && run.conclusion !== 'success' || Number(run.id) !== record.run
    || Number(run.run_attempt) !== record.attempt || run.head_sha !== record.sha
    || !['push', 'workflow_dispatch', 'pull_request'].includes(run.event)
    || !retained && (latestRun?.status !== 'completed' || latestRun?.conclusion !== 'success'
      || Number(latestRun.id) !== record.run || Number(latestRun.run_attempt) !== record.attempt || latestRun.head_sha !== record.sha))
    return fail('task source attempt is incomplete/red/foreign');
  let retention;
  if (retained) {
    const target = consumerProof.run;
    const runIdentity = value => value && [value.id, value.run_attempt, value.head_sha, value.path, value.event,
      value.head_branch, value.repository?.full_name, value.head_repository?.full_name, value.status, value.conclusion];
    if (consumerProof.candidate.tree !== sourceSnapshot?.tree || !sameRecord(proof?.request || {}, consumerProof.request || {})
      || !sameRecord(proof?.requiredProfiles || [], consumerProof.requiredProfiles || [])
      || target.event !== run.event || retainedRun?.id !== record.run || retainedRun.run_attempt !== target.attempt
      || retainedRun.head_sha !== record.sha || retainedRun.path !== record.workflow || retainedRun.event !== run.event
      || retainedRun.repository?.full_name !== repo || retainedRun.head_repository?.full_name !== repo
      || retainedRun.head_branch !== run.head_branch || !sameRecord(runIdentity(retainedRun), runIdentity(latestRun))
      || !(producing && retainedRun.status === 'in_progress')
        && (retainedRun.status !== 'completed' || retainedRun.conclusion !== 'success'))
      return fail('retained source/current attempt, tree or full/fresh policy differs');
    try { retention = retainedExecution(record, jobs, retainedJobs, run, retainedRun); }
    catch (error) { return fail(error.message); }
    if (claim.retained !== undefined && !sameRecord(claim.retained, retention)) return fail('retained job passport differs from authenticated execution');
  } else if (claim.retained !== undefined) return fail('retained passport has no current-run source');
  const actual = jobs.filter(job => job.name === record.jobName);
  if (actual.length !== 1 || actual[0].status !== 'completed' || actual[0].conclusion !== 'success'
    || actual[0].run_id !== undefined && Number(actual[0].run_id) !== record.run) return fail('actual task execution is absent/incomplete/red');
  const created = Date.parse(record.created), produced = Date.parse(artifact?.created_at), started = Date.parse(run.run_started_at || run.created_at);
  if (!Number.isFinite(now) || !Number.isFinite(produced) || !Number.isFinite(started) || now < created || now < produced || now - created > REGISTRY_TTL_MS
    || now - produced > REGISTRY_TTL_MS || created < started - 30000
    || created > produced + 30000) return fail('task source expired or has impossible timestamps');
  if (artifact?.expired !== false || artifact.name !== `ci-proof-${record.run}-${record.attempt}`
    || artifact.workflow_run?.head_sha !== record.sha) return fail('immutable task artifact absent/foreign');
  if (retained && produced >= Date.parse(retainedRun.run_started_at)) return fail('retained source proof was not published before rerun');
  if (proof?.schema !== 'houseplan-ci-proof/v1' || proof.run?.id !== record.run || proof.run?.attempt !== record.attempt
    || '.github/workflows/' + proof.run?.workflow !== record.workflow || proof.run?.event !== run.event
    || proof.candidate?.sha !== record.sha || !hex(proof.candidate?.tree, 40)
    || !hex(sourceSnapshot?.tree, 40) || sourceSnapshot.tree !== proof.candidate.tree
    || sourceSnapshot.sha && sourceSnapshot.sha !== record.sha)
    return fail('task proof belongs to a different source');
  const direct = proof.taskChecks?.[record.job];
  if (direct?.mode !== 'executed' || direct.retained !== undefined
    || !sameRecord(direct.record, record) || !sameRecord(direct.plan, taskCheckPlanFields(record)))
    return fail('task source is inherited or differs from its immutable receipt');
  if (record.workflow === '.github/workflows/validate-product.yml') {
    const profiles = proof.requiredProfiles;
    if (!Array.isArray(profiles) || !profiles.includes('product') || new Set(profiles).size !== profiles.length
      || [...profiles].some(profile => !['product', 'tooling', 'docs'].includes(profile)) || companionsGreen !== true)
      return fail('task source product coverage/companions are incomplete');
  }
  if (record.job === 'browser_selected') {
    try {
      if (Object.keys(proof.browserPlan?.reused || {}).length) return fail('source browser execution was inherited');
      if (!sameRecord(normalizeTaskCheckScope(record.job, proof.browserPlan?.planned), record.scope))
        return fail('source browser scope differs from its receipt');
      for (const kind of ['smoke', 'golden']) if (record.scope[kind].mode === 'selected') {
        const executed = proof.browserPlan.executed?.[kind];
        if (executed?.mode !== 'selected' || executed.result !== 'success'
          || !validStrings(executed.ids) || !sameRecord(sorted(executed.ids), record.scope[kind].ids))
          return fail('source selected browser execution is partial/incomplete');
      }
    } catch { return fail('source browser plan is invalid'); }
  }
  if (!candidateSnapshot || !sourceSnapshot) return fail('independent immutable task snapshots are missing');
  try {
    const options = { job: record.job, browserPlan: record.scope, environment: plan.toolchain };
    const [current, previous] = await Promise.all([
      taskCheckPlanFromSnapshot(candidateSnapshot, options), taskCheckPlanFromSnapshot(sourceSnapshot, options),
    ]);
    if (!sameRecord(current, plan) || !sameRecord(previous, taskCheckPlanFields(record)))
      return fail('actual task inputs/environment/recipe differ');
  } catch (error) { return fail('task Git equivalence: ' + error.message); }
  return { accepted: true, reason: retained ? 'authenticated current-run retained execution verified'
    : 'direct immutable scoped task execution verified', record,
    ...(retained ? { retained: retention, target: structuredClone(consumerProof.run) } : {}) };
}
