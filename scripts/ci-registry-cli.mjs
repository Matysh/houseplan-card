#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { REGISTRY_JOBS, registryInputs, registryToolchain, cleanRegistryInputs, jobRecipe } from './ci-registry-inputs.mjs';
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
export function controllerSupportsRegistry(root = process.cwd()) {
  try {
    return execFileSync('git', ['-C', root, 'show', 'origin/dev:scripts/ci-registry-verify.mjs'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).includes('houseplan-job-proof/v1');
  } catch { return false; }
}
export function intentPolicy(env = process.env, version = JSON.parse(readFileSync('package.json', 'utf8')).version,
  { registrySupported = true } = {}) {
  const release = /^Release:\s*\S+/m.test(env.HEAD_MESSAGE || '') && !/^issue\//.test(env.REF_NAME || '');
  const policy = registryPolicy({ fresh: bool(env.FRESH_INPUT), night: bool(env.NIGHT_INPUT),
    stable: !version.includes('-'), candidate: bool(env.CANDIDATE_INPUT) || release && version.includes('-beta.') });
  if (!registrySupported && (env.GITHUB_EVENT_NAME || env.EVENT_NAME) === 'workflow_dispatch' && !bool(env.CANDIDATE_INPUT))
    return { ...policy, allowed: false, reason: 'fresh bootstrap for the pre-registry dev controller' };
  return policy;
}
export async function registryProbeCli({ root = process.cwd(), local = false } = {}) {
  const started = Date.now();
  const repo = process.env.GITHUB_REPOSITORY || 'Matysh/houseplan-card';
  const mode = process.env.REGISTRY_MODE || 'exact', allowed = !bool(process.env.REGISTRY_FRESH);
  const plan = registryInputs(root, { mode, perfSet: performanceSet(process.env) });
  const store = allowed ? fetchRegistry(root) : { tip: null, read: () => null };
  const token = allowed ? process.env.GH_TOKEN || execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim() : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, 8000 - (Date.now() - started)));
  const source = registryApi({ repo, token, candidateSnapshot: plan._snapshot, mode: plan.mode, signal: controller.signal });
  const jobs = local ? ['frontend'] : REGISTRY_JOBS;
  let result;
  try { result = await probeRegistry({ root, repo, plan, jobs, allowed: allowed && (!local || cleanRegistryInputs(root, plan)), store, source }); }
  finally { clearTimeout(timer); }
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
      const records = proof.requiredChecks.every(id => proof.checks[id]?.result === 'success') ? proof.registry?.produced || [] : [];
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
