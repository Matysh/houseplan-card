import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { generatedProfiles } from '../scripts/ci-profiles.mjs';
import { profilesForFiles, matchesPaths, readProfilePaths } from '../scripts/ci-profile-paths.mjs';
import { eventFiles, eventProfilePlan } from '../scripts/ci-profile-event.mjs';
import { ciWorkflow, registeredRuns, listCiRuns } from '../scripts/ci-workflows.mjs';
import { greenShas, judgedShas } from '../scripts/classify-base.mjs';
import { buildCiProof, evaluateCiProof, JOB_RULES, CI_PROOF_POLICIES } from '../scripts/ci-proof.mjs';
import { validateJobs, jobInstanceNames } from '../scripts/workflow-jobs.mjs';
import { importClosure } from './helpers/import-closure.mjs';

const cases = JSON.parse(readFileSync(new URL('./data/ci-profile-pushes.json', import.meta.url), 'utf8'));
const SHA = 'a'.repeat(40), TREE = 'b'.repeat(40), ROOT = process.cwd();

test('#980 generated paths and job recipes are current; canonical full dispatch retains both partitions', () => {
  for (const [file, expected] of generatedProfiles()) assert.equal(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), expected, file);
  const full = parse(readFileSync('.github/workflows/validate.yml', 'utf8'));
  assert.ok(full.on.workflow_dispatch); assert.equal(full.on.push, undefined);
  assert.ok(full.jobs.frontend && full.jobs.tooling && full.jobs.golden && full.jobs.smoke);
  const product = parse(readFileSync('.github/workflows/validate-product.yml', 'utf8'));
  assert.ok(product.jobs.frontend); assert.equal(product.jobs.tooling, undefined);
  assert.ok(product.jobs.proof.steps.some(s => /--candidate/.test(s.run || '')));
});

test('#980 a complete multi-commit/merge push routes by all changed paths, not its final docs commit', t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-profile-push-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
  mkdirSync(join(root, 'src')); mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'src/logic.ts'), 'export const value=1;'); git('init', '-q'); git('add', '.'); git('commit', '-qm', 'base');
  const before = git('rev-parse', 'HEAD');
  writeFileSync(join(root, 'src/logic.ts'), 'export const value=2;'); git('commit', '-qam', 'product');
  writeFileSync(join(root, 'docs/change.md'), 'review'); git('add', '.'); git('commit', '-qm', 'docs final');
  const run = (cmd, args) => execFileSync(cmd, ['-C', root, ...args], { encoding: 'utf8' });
  assert.deepEqual(profilesForFiles(eventFiles({ before }, run)), ['product', 'docs']);
  const productBranch = git('symbolic-ref', '--short', 'HEAD');
  git('checkout', '-qb', 'side', before); mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'docs/index.md'), 'index'); git('add', '.'); git('commit', '-qm', 'index');
  const mergeBase = git('rev-parse', 'HEAD'); git('merge', '-q', '--no-ff', '-m', 'merge product and review', productBranch);
  assert.deepEqual(profilesForFiles(eventFiles({ before: mergeBase }, run)), ['product', 'docs']);
  const renameBase = git('rev-parse', 'HEAD'); git('mv', 'src/logic.ts', 'docs/logic.ts'); git('commit', '-qm', 'move source');
  assert.deepEqual(profilesForFiles(eventFiles({ before: renameBase }, run)), ['product', 'docs']);
  assert.equal(eventProfilePlan({ before: '0'.repeat(40) }, run).proven, false);
  assert.deepEqual(eventProfilePlan({ before: 'f'.repeat(40) }, run).profiles, ['product', 'tooling', 'docs']);
});

test('#980 path filter fixtures and computed tooling tests exclude product; unknown paths remain conservative', () => {
  for (const c of cases) assert.deepEqual(profilesForFiles(c.files), c.profiles, c.name);
  assert.deepEqual(profilesForFiles(['test/ci-proof.test.mjs']), ['tooling']);
  assert.deepEqual(profilesForFiles(['test/device-issues.test.mjs']), ['product']);
  const paths = readProfilePaths();
  for (const profile of Object.keys(paths)) {
    const document = parse(readFileSync(`.github/workflows/validate-${profile}.yml`, 'utf8'));
    assert.deepEqual(document.on.push.paths, paths[profile]);
    for (const c of cases) assert.equal(c.files.some(f => matchesPaths(f, document.on.push.paths)), c.profiles.includes(profile), `${profile}: ${c.name}`);
  }
});

test('#980 docs and tooling have no product producer and no compiled-test setup', () => {
  for (const profile of ['docs', 'tooling']) {
    const text = readFileSync(`.github/workflows/validate-${profile}.yml`, 'utf8');
    assert.doesNotMatch(text, /npm run (?:build|test:product)|frontend-proof\.mjs|test-build/);
    const jobs = parse(text).jobs;
    assert.equal(jobs.frontend, undefined);
    if (profile === 'docs') assert.doesNotMatch(text, /npm ci|npm test|test:tooling/);
    else { assert.match(text, /npm run test:tooling/); assert.match(jobs.hacs.if, /integration/); }
  }
});

test('#980 the actual fast-proof CLI works in a cold scripts-only checkout without npm or a build', t => {
  const root = mkdtempSync(join(tmpdir(), 'hp-profile-cold-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const source of importClosure(join(ROOT, 'scripts/ci-profile-proof.mjs'))) {
    const target = join(root, relative(ROOT, source)); mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source));
  }
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'cold metadata fixture');
  const sha = git('rev-parse', 'HEAD');
  for (const profile of ['docs', 'tooling']) {
    execFileSync(process.execPath, ['scripts/ci-profile-proof.mjs'], { cwd: root, encoding: 'utf8', env: {
      ...process.env, CI_WORKFLOW: `validate-${profile}.yml`, CI_RESULT: 'success', GITHUB_SHA: sha,
      GITHUB_RUN_ID: '9', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'push',
    } });
    const proof = JSON.parse(readFileSync(join(root, 'artifacts/ci-proof/proof.json'), 'utf8'));
    assert.equal(proof.profile, profile); assert.equal(proof.checks.preflight.result, 'success');
    assert.equal(evaluateCiProof({ run: { id: 9, head_sha: sha, status: 'completed', conclusion: 'success', path: `.github/workflows/validate-${profile}.yml` }, proof,
      candidate: { sha }, policy: CI_PROOF_POLICIES.mergeLight }).status, 'stale');
  }
});

test('#980 same display name is not workflow authority; list readers return the registered family only', () => {
  const rows = ['validate.yml', 'validate-product.yml', 'validate-tooling.yml', 'validate-docs.yml', 'evil.yml'].map((file, i) => ({ id: i + 1,
    path: `.github/workflows/${file}`, name: 'Проверка (CI)', head_sha: SHA, status: 'completed', conclusion: 'success' }));
  assert.equal(ciWorkflow(rows.at(-1)), null);
  assert.equal(registeredRuns({ workflow_runs: rows }, { sha: SHA }).length, 4);
  assert.equal(registeredRuns({ workflow_runs: rows }, { sha: SHA, productOnly: true }).length, 2);
  const listed = listCiRuns({ repo: 'x/y', sha: SHA }, (cmd, args) => { assert.equal(cmd, 'gh'); assert.match(args[1], /actions\/runs\?/); return JSON.stringify({ workflow_runs: rows }); });
  assert.deepEqual(listed.map(r => r.path), rows.slice(0, 4).reverse().map(r => r.path));
  const payload = { workflow_runs: rows };
  assert.deepEqual([...greenShas(payload)], [SHA]);
  for (const file of ['validate-docs.yml', 'validate-tooling.yml', 'validate-product.yml', 'evil.yml']) {
    const data = { workflow_runs: [{ path: `.github/workflows/${file}`, head_sha: SHA, conclusion: 'success', status: 'completed' }] };
    assert.equal(greenShas(data).size, 0); assert.equal(judgedShas(data).size, 0);
  }
});

test('#980 product proof cannot hide a missing/red tooling profile or spoof workflow identity', () => {
  const needs = { preflight: { result: 'success' }, changes: { result: 'success', outputs: { frontend: 'true' } },
    reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' } };
  const proof = buildCiProof({ candidateSha: SHA, candidateTree: TREE, runId: 9, attempt: 1, event: 'push', needs,
    workflow: 'validate-product.yml', requiredProfiles: ['product', 'tooling'] });
  const workflow = validateJobs();
  const jobs = ['preflight', 'changes', 'reuse', 'frontend'].flatMap(id => jobInstanceNames(workflow.get(id)).map(name => ({ name, conclusion: 'success' })));
  const run = { id: 9, run_attempt: 1, path: '.github/workflows/validate-product.yml', head_sha: SHA, event: 'push', status: 'completed', conclusion: 'success' };
  const evaluate = (options = {}) => evaluateCiProof({ run, proof, jobs, candidate: { sha: SHA, tree: TREE }, policy: CI_PROOF_POLICIES.mergeLight, ...options });
  assert.notEqual(evaluate().status, 'green');
  const companion = { run: { ...run, id: 10, path: '.github/workflows/validate-tooling.yml' }, jobs: [
    { name: JOB_RULES.preflight[0].name, conclusion: 'success' }, { name: JOB_RULES.frontend.find(r => r.job === 'tooling').name, conclusion: 'success' }] };
  const profileRuns = new Map([['tooling', companion]]);
  assert.equal(evaluate({ profileRuns }).status, 'green');
  companion.jobs.pop(); assert.notEqual(evaluate({ profileRuns }).status, 'green');
  companion.run.conclusion = 'failure'; assert.notEqual(evaluate({ profileRuns }).status, 'green');
  assert.notEqual(evaluate({ run: { ...run, path: '.github/workflows/evil.yml', name: 'Проверка (CI)' } }).status, 'green');
  for (const profile of ['docs', 'tooling']) assert.notEqual(evaluate({ proof: { ...proof, run: { ...proof.run, workflow: `validate-${profile}.yml` } }, run: { ...run, path: `.github/workflows/validate-${profile}.yml` } }).status, 'green');
});
