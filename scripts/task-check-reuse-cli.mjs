#!/usr/bin/env node
// #1060: cold-job probe and actual-producer stamp; publication belongs to ci-proof.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { fetchRegistry } from './ci-proof-registry.mjs';
import { intentPolicy } from './ci-registry-cli.mjs';
import { taskCheckSource } from './task-check-source.mjs';
import { TASK_CHECK_SCHEMA, TASK_CHECK_JOBS, taskCheckPlan, taskCheckSnapshot,
  makeTaskCheckRecord, verifyTaskCheckClaim } from './task-check-reuse.mjs';

const bool = value => String(value) === 'true';
export function taskCheckEnvironment(env = process.env) {
  const format = new Intl.DateTimeFormat().resolvedOptions();
  return { node: process.versions.node, platform: process.platform, arch: process.arch,
    nodeFlags: process.execArgv, nodeOptions: env.NODE_OPTIONS || null, nodeEnv: env.NODE_ENV || null,
    locale: format.locale, timezone: format.timeZone, lang: env.LANG || null,
    lcAll: env.LC_ALL || null, tz: env.TZ || null, runnerOs: env.RUNNER_OS || null,
    imageOS: env.ImageOS || null, imageVersion: env.ImageVersion || null };
}
export function controllerSupportsTaskChecks(root = process.cwd(), run = execFileSync) {
  try {
    return run('git', ['-C', root, 'show', 'origin/dev:scripts/task-check-reuse.mjs'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).includes(TASK_CHECK_SCHEMA);
  } catch { return false; }
}
function workflowPath(env) {
  const prefix = env.GITHUB_REPOSITORY + '/';
  const reference = env.GITHUB_WORKFLOW_REF || '';
  if (!reference.startsWith(prefix)) throw Error('missing task-check producer workflow reference');
  const workflow = reference.slice(prefix.length).split('@')[0];
  if (!['.github/workflows/validate.yml', '.github/workflows/validate-product.yml', '.github/workflows/validate-tooling.yml'].includes(workflow))
    throw Error('foreign task-check workflow');
  return workflow;
}
export function taskCheckReusePolicy(env = process.env, supported = true, version = '0.0.0') {
  if (bool(env.TASK_CHECK_FRESH) || bool(env.FRESH_INPUT) || bool(env.NIGHT_INPUT) || bool(env.FULL_INPUT))
    return { allowed: false, reason: 'fresh/full/night policy' };
  if (!supported) return { allowed: false, reason: 'fresh bootstrap for the pre-task-check dev controller' };
  const policy = intentPolicy(env, version, { registrySupported: supported });
  if (!policy.allowed || bool(env.CANDIDATE_INPUT) || /^Release:\s*\S+\s*$/m.test(env.HEAD_MESSAGE || ''))
    return { allowed: false, reason: policy.reason || 'release candidate requires fresh task execution' };
  return { allowed: true };
}
const output = (values, env = process.env) => {
  const text = Object.entries(values).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`).join('\n') + '\n';
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, text);
  process.stdout.write(text);
};

export async function taskCheckCli({ job, stamp = false, root = process.cwd(), env = process.env,
  supported = controllerSupportsTaskChecks(root), registry = fetchRegistry, sourceFactory = taskCheckSource,
  planFor = taskCheckPlan, snapshotFor = taskCheckSnapshot, emit = output, now = Date.now() } = {}) {
  if (!TASK_CHECK_JOBS.includes(job)) throw Error('unknown task-check job');
  let headMessage = env.HEAD_MESSAGE || '';
  if (!headMessage && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '')) {
    try { headMessage = execFileSync('git', ['-C', root, 'show', '-s', '--format=%B', env.GITHUB_SHA],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { /* identity/plan checks below stay fail-closed */ }
  }
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const policy = taskCheckReusePolicy({ ...env, HEAD_MESSAGE: headMessage }, supported, version);
  // Bootstrap/fresh policy is checked before even fetching the advisory index.
  if (!stamp && !policy.allowed) { const result = { reused: false, reason: policy.reason }; emit(result, env); return result; }
  const repo = env.GITHUB_REPOSITORY, sha = env.GITHUB_SHA;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^[a-f0-9]{40}$/.test(sha || '')) throw Error('missing task-check producer identity');
  const workflow = workflowPath(env);
  const browserPlan = job === 'browser_selected' ? JSON.parse(env.BROWSER_PLAN || 'null') : undefined;
  const snapshot = await snapshotFor(root, sha);
  const plan = await planFor(root, { job, ref: sha, snapshot, browserPlan, environment: taskCheckEnvironment(env) });
  if (stamp) {
    if (env.GITHUB_WORKFLOW_SHA !== sha) throw Error('task-check workflow revision differs from source');
    const record = makeTaskCheckRecord(plan, { repo, sha, workflow, run: Number(env.GITHUB_RUN_ID),
      attempt: Number(env.GITHUB_RUN_ATTEMPT), created: new Date(now).toISOString() });
    const result = { claim: { mode: 'executed', plan, record } }; emit(result, env); return result;
  }
  const started = Date.now(), store = await registry(root), record = await store.read(job, plan.key);
  if (!record) { const result = { reused: false, reason: 'no indexed task-check producer' }; emit(result, env); return result; }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.max(1, 8000 - (Date.now() - started)));
  let result;
  try {
    if (!env.GH_TOKEN && !env.GITHUB_TOKEN) throw Error('missing task-check read token');
    const source = sourceFactory({ repo, token: env.GH_TOKEN || env.GITHUB_TOKEN, candidateSha: sha,
      candidateSnapshot: snapshot, root, signal: controller.signal, apiBase: env.GITHUB_API_URL });
    const claim = { mode: 'reused', plan, record };
    const checked = await verifyTaskCheckClaim(claim, { plan, repo, now, ...await source(record) });
    result = checked.accepted ? { reused: true, claim } : { reused: false, reason: checked.reason };
  } catch (error) { result = { reused: false, reason: error.message }; }
  finally { clearTimeout(timer); }
  emit(result, env); return result;
}

if (isMainModule(import.meta.url)) {
  const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const stamp = arg('stamp'), probe = arg('probe');
  try {
    if (Boolean(stamp) === Boolean(probe)) throw Error('use exactly one --probe or --stamp');
    await taskCheckCli({ job: stamp || probe, stamp: Boolean(stamp) });
  } catch (error) {
    if (probe) { output({ reused: false, reason: error.message }); }
    else { console.error(error.message); process.exitCode = 1; }
  }
}
