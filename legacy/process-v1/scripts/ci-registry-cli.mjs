#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { REGISTRY_JOBS, registryInputs, registryToolchain, registryReader, registryRemaining,
  cleanRegistryInputs, jobRecipe } from './ci-registry-inputs.mjs';
import { fetchRegistry, probeRegistry, publishRegistry, registryApi } from './ci-proof-registry.mjs';
import { registryPolicy } from './ci-registry-verify.mjs';
import { isMainModule } from './spawn-portable.mjs';

const bool = value => String(value) === 'true';
export const performanceSet = env => ['glow', bool(env.PERF_ISO) && 'iso',
  bool(env.PERF_INTERACTION) && 'interaction'].filter(Boolean).join('-');
const output = values => {
  const text = Object.entries(values).map(([key, value]) => key + '=' + (typeof value === 'object' ? JSON.stringify(value) : value)).join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text);
  process.stdout.write(text);
};
export function registryPublicationRecords(proof) {
  if (!proof.requiredChecks.every(id => proof.checks[id]?.result === 'success')) return [];
  return [...proof.registry?.produced || [], ...Object.values(proof.taskChecks || {})
    .filter(claim => claim.mode === 'executed' && claim.record?.schema === 'houseplan-task-check/v1'
      && claim.record.run === proof.run?.id && claim.record.attempt === proof.run?.attempt)
    .map(claim => claim.record)];
}
export function producerToolchain(root = process.cwd(), job = '') {
  const toolchain = registryToolchain({ text: path => readFileSync(resolve(root, path), 'utf8') },
    { python: process.env.CI_PYTHON_VERSION || null });
  if (['backend', 'geometry_parity'].includes(job)) {
    const actual = execFileSync('python', ['-c', 'import platform; print(platform.python_version())'], { encoding: 'utf8' }).trim();
    if (actual !== toolchain.python) throw Error('actual Python differs from the planned producer toolchain');
  }
  return toolchain;
}
export function producerRecipe(root, job, env = process.env) {
  const workflow = env.GITHUB_WORKFLOW_REF
    ? env.GITHUB_WORKFLOW_REF.slice((env.GITHUB_REPOSITORY || '').length + 1).split('@')[0]
    : '.github/workflows/validate.yml';
  if (!['.github/workflows/validate.yml', '.github/workflows/validate-product.yml'].includes(workflow)) throw Error('foreign producer workflow');
  return jobRecipe({ text: path => readFileSync(resolve(root, path), 'utf8') }, job, workflow);
}
export function controllerSupportsRegistry(root = process.cwd(), { deadline = Date.now() + 8000 } = {}) {
  try {
    return execFileSync('git', ['-C', root, 'show', 'origin/dev:scripts/ci-registry-verify.mjs'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: registryRemaining(deadline, 3000),
        killSignal: 'SIGKILL', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).includes('houseplan-job-proof/v1');
  } catch { return false; }
}
export function intentPolicy(env = process.env, version = JSON.parse(readFileSync('package.json', 'utf8')).version,
  { registrySupported = true } = {}) {
  const refName = String(env.REF_NAME || env.GITHUB_REF_NAME || env.GITHUB_REF || '').replace(/^refs\/(?:heads|tags)\//, '');
  const task = /^issue\//.test(refName);
  const releaseTag = /^Release:\s*(\S+)\s*$/m.exec(env.HEAD_MESSAGE || '')?.[1];
  const release = Boolean(releaseTag) && !task;
  const candidate = bool(env.CANDIDATE_INPUT);
  const stableVersion = value => /^v?\d+\.\d+\.\d+(?:\+[\w.-]+)?$/.test(value || '');
  const tag = env.GITHUB_REF_TYPE === 'tag' || /^refs\/tags\//.test(env.GITHUB_REF || '');
  // The development tree keeps the previous stable version until a candidate
  // is prepared. Only release intent, not that ordinary package version, asks
  // for fresh stable execution. Unknown/local refs retain exact-input reuse.
  const stable = !task && (release && stableVersion(releaseTag) || tag && stableVersion(refName)
    || stableVersion(version) && (refName === 'main' || candidate));
  const policy = registryPolicy({ fresh: bool(env.FRESH_INPUT), night: bool(env.NIGHT_INPUT),
    stable, candidate: candidate || release && version.includes('-beta.') });
  if (!registrySupported && (env.GITHUB_EVENT_NAME || env.EVENT_NAME) === 'workflow_dispatch' && !bool(env.CANDIDATE_INPUT))
    return { ...policy, allowed: false, reason: 'fresh bootstrap for the pre-registry dev controller' };
  return policy;
}
// The timer owns asynchronous requests; every synchronous subprocess must also
// receive the same deadline. Moving only the timer before Git cannot interrupt it.
export async function withinRegistryDeadline(deadline, action) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(Error('registry probe deadline exceeded'), { code: 'REGISTRY_TIMEOUT' });
      controller.abort(error); reject(error);
    }, registryRemaining(deadline));
  });
  try {
    const value = await Promise.race([expired, Promise.resolve().then(() => {
      registryRemaining(deadline);
      return action(controller.signal);
    })]);
    registryRemaining(deadline);
    return value;
  } finally { clearTimeout(timer); controller.abort(); }
}
export async function registryProbeCli({ root = process.cwd(), local = false, deadline = Date.now() + 8000 } = {}) {
  const repo = process.env.GITHUB_REPOSITORY || 'Matysh/houseplan-card';
  const mode = process.env.REGISTRY_MODE || 'exact', allowed = !bool(process.env.REGISTRY_FRESH);
  let plan, result;
  try { result = await withinRegistryDeadline(deadline, async signal => {
    const reader = registryReader(root, 'HEAD', { deadline });
    const toolchain = registryToolchain(reader, { deadline, python: process.env.CI_PYTHON_VERSION || null });
    plan = registryInputs(root, { mode, reader, toolchain, perfSet: performanceSet(process.env) });
    registryRemaining(deadline);
    const store = allowed ? fetchRegistry(root, { deadline }) : { tip: null, read: () => null };
    const token = allowed ? process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'],
      { encoding: 'utf8', timeout: registryRemaining(deadline), killSignal: 'SIGKILL' }).trim() : '';
    const source = registryApi({ root, repo, token, candidateSnapshot: plan._snapshot,
      mode: plan.mode, signal, deadline });
    const jobs = local ? ['frontend'] : REGISTRY_JOBS;
    return probeRegistry({ root, repo, plan, jobs,
      allowed: allowed && (!local || cleanRegistryInputs(root, plan, { deadline })), store, source });
  }); } catch (error) {
    if (!plan) throw error;
    // Retain a complete input plan for newly executed producers, but never
    // retain a partial/late accepted result from the expired lookup.
    result = { schema: 1, plan, registryTip: null, results: Object.fromEntries(REGISTRY_JOBS
      .map(job => [job, { accepted: false, reason: 'fresh: ' + error.message }])) };
  }
  // Large path inventories stay in the committed generator output, never in a
  // Linux environment variable / GHA job output. Identity alone travels.
  delete result.plan.inventories;
  const path = resolve(root, 'artifacts/ci-registry/plan.json');
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(result) + '\n');
  const values = { plan: JSON.stringify(result), python_version: plan.toolchain.python };
  for (const job of REGISTRY_JOBS) {
    const found = result.results[job];
    Object.assign(values, { [job]: found?.accepted === true, [job + '_key']: plan.keys[job],
      [job + '_record']: found?.accepted ? JSON.stringify(found.record) : '',
      [job + '_source_run']: found?.accepted ? found.record.run : '',
      [job + '_source_attempt']: found?.accepted ? found.record.attempt : '',
      [job + '_source_sha']: found?.accepted ? found.record.sha : '' });
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '- ' + job + ': ' + (found?.accepted ? 'reused from run ' + found.record.run : 'fresh: ' + (found?.reason || 'not selected')) + '\n');
  }
  output(values); return result;
}
if (isMainModule(import.meta.url)) {
  try {
    const arg = key => process.argv.find(a => a.startsWith('--' + key + '='))?.slice(key.length + 3);
    if (process.argv.includes('--policy')) {
      const policy = intentPolicy(process.env, undefined, { registrySupported: controllerSupportsRegistry() });
      output({ registry_mode: policy.mode, registry_fresh: !policy.allowed });
    } else if (arg('stamp-job')) {
      const key = arg('stamp-output') || 'toolchain';
      if (!/^toolchain(?:_[123])?$/.test(key)) throw Error('invalid stamp output');
      output({ [key]: producerToolchain(process.cwd(), arg('stamp-job')),
        [key.replace('toolchain', 'recipe')]: producerRecipe(process.cwd(), arg('stamp-job')) });
    }
    else if (arg('publish-proof')) {
      const proof = JSON.parse(readFileSync(arg('publish-proof'), 'utf8'));
      const records = registryPublicationRecords(proof);
      output(publishRegistry({ root: process.cwd(), records }));
    } else {
      try { await registryProbeCli({ local: process.argv.includes('--local') }); }
      catch (error) {
        // An unavailable index/toolchain/API is fresh, never an optimistic skip.
        output(Object.fromEntries(REGISTRY_JOBS.map(job => [job, false])));
        console.error('registry: fresh execution required: ' + error.message);
      }
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
