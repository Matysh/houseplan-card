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

export async function verifyTaskCheckClaim(claim, { plan, repo, run, latestRun, jobs = [], artifact, proof,
  candidateSnapshot, sourceSnapshot, companionsGreen = false, now = Date.now(), request = {} } = {}) {
  const fail = reason => ({ accepted: false, reason });
  if (!['executed', 'reused'].includes(claim?.mode)) return fail('unknown task claim mode');
  if (claim.mode === 'reused' && (request.full || request.fresh || request.night || request.stable || request.candidate))
    return fail('fresh/full policy forbids task reuse');
  const record = claim.record, malformed = taskCheckRecordError(record);
  if (malformed) return fail(malformed);
  if (!sameRecord(taskCheckPlanFields(record), plan) || !sameRecord(claim.plan, plan)) return fail('task claim differs from the required scope/inputs');
  if (record.repo !== repo || run?.repository?.full_name !== repo || run?.head_repository?.full_name !== repo
    || run.path !== record.workflow || !/^(?:dev|main|issue\/[1-9]\d+-[\w-]+)$/.test(run.head_branch || ''))
    return fail('foreign task producer repository/workflow/branch');
  if (run.status !== 'completed' || run.conclusion !== 'success' || Number(run.id) !== record.run
    || Number(run.run_attempt) !== record.attempt || run.head_sha !== record.sha
    || !['push', 'workflow_dispatch', 'pull_request'].includes(run.event)
    || latestRun?.status !== 'completed' || latestRun?.conclusion !== 'success'
    || Number(latestRun.id) !== record.run || Number(latestRun.run_attempt) !== record.attempt || latestRun.head_sha !== record.sha)
    return fail('task source attempt is incomplete/red/foreign');
  const actual = jobs.filter(job => job.name === record.jobName);
  if (actual.length !== 1 || actual[0].status !== 'completed' || actual[0].conclusion !== 'success'
    || actual[0].run_id !== undefined && Number(actual[0].run_id) !== record.run) return fail('actual task execution is absent/incomplete/red');
  const created = Date.parse(record.created), produced = Date.parse(artifact?.created_at), started = Date.parse(run.run_started_at || run.created_at);
  if (!Number.isFinite(now) || !Number.isFinite(produced) || !Number.isFinite(started) || now < created || now < produced || now - created > REGISTRY_TTL_MS
    || now - produced > REGISTRY_TTL_MS || created < started - 30000
    || created > produced + 30000) return fail('task source expired or has impossible timestamps');
  if (artifact?.expired !== false || artifact.name !== `ci-proof-${record.run}-${record.attempt}`
    || artifact.workflow_run?.head_sha !== record.sha) return fail('immutable task artifact absent/foreign');
  if (proof?.schema !== 'houseplan-ci-proof/v1' || proof.run?.id !== record.run || proof.run?.attempt !== record.attempt
    || '.github/workflows/' + proof.run?.workflow !== record.workflow || proof.run?.event !== run.event
    || proof.candidate?.sha !== record.sha || !hex(proof.candidate?.tree, 40)
    || !hex(sourceSnapshot?.tree, 40) || sourceSnapshot.tree !== proof.candidate.tree
    || sourceSnapshot.sha && sourceSnapshot.sha !== record.sha)
    return fail('task proof belongs to a different source');
  const direct = proof.taskChecks?.[record.job];
  if (direct?.mode !== 'executed' || !sameRecord(direct.record, record) || !sameRecord(direct.plan, taskCheckPlanFields(record)))
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
  return { accepted: true, reason: 'direct immutable scoped task execution verified', record };
}
