#!/usr/bin/env node
// #856: complete producer artifacts, not cache hits. Range guards always run fresh.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inputsOf } from './check-inputs.mjs';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { isMainModule } from './spawn-portable.mjs';
import { contentInputKey } from './content-inputs.mjs';
import { reusableFrontendInputs } from './frontend-units.mjs';

const hash = v => createHash('sha256').update(v).digest('hex');
const hex = (v, n) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(v);
export function producerEnvironment(env = process.env) {
  return { node: process.versions.node, platform: process.platform, arch: process.arch,
    imageOS: env.ImageOS || null, imageVersion: env.ImageVersion || null };
}
export function frontendKey(root = process.cwd(), environment = producerEnvironment()) {
  const files = [...new Set([...inputsOf('frontend', root), '.nvmrc', '.python-version',
    'scripts/frontend-proof.mjs', 'scripts/check-inputs.mjs', ...inputsOf('smoke', root)
      .filter(f => f.startsWith('demo/fixtures/') || f.startsWith('demo/golden/') && f.endsWith('.mjs'))])].sort();
  const h = createHash('sha256').update('frontend-complete-v1\0').update(JSON.stringify(environment));
  // Unit fixtures inspect git HEAD/archive as well as files. V1 deliberately
  // refuses cross-commit reuse instead of claiming unproved semantic equivalence.
  const identity = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  h.update(identity + '\0');
  for (const p of files) {
    const raw = readFileSync(join(root, p));
    h.update(p + '\0').update(raw.includes(0) ? raw : Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'))).update('\0');
  }
  return h.digest('hex');
}
export const frontendContentKey = (root = process.cwd(), environment = producerEnvironment(), ref = null) =>
  contentInputKey(root, 'frontend', { environment, ref, select: reader => reusableFrontendInputs(root, reader) });
export function artifactTree(directory) {
  if (!existsSync(directory) || lstatSync(directory).isSymbolicLink()) throw Error('missing/unsafe artifact tree');
  const rows = [];
  const walk = (dir, prefix = '') => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name), rel = prefix + name, stat = lstatSync(p);
      if (stat.isSymbolicLink()) throw Error('artifact symlink refused');
      if (stat.isDirectory()) walk(p, rel + '/');
      else if (stat.isFile()) rows.push([rel, stat.size, hash(readFileSync(p))]);
      else throw Error('non-file artifact refused');
      if (rows.length > 10000) throw Error('artifact inventory oversized');
    }
  };
  walk(directory);
  if (!rows.length) throw Error('empty producer artifact');
  return hash(JSON.stringify(rows));
}
export function admissibleFrontendProof(proof, { key, fingerprint, environment, run, jobs, artifact, tree, now = Date.now(), repo, promotedSha = null, sourceCompatible = false }) {
  return [1, 2].includes(proof?.schema) && proof.outcome === 'success' && proof.reused === false
    && (proof.schema === 1 || sourceCompatible)
    && hex(proof.key, 64) && proof.key === key && proof.fingerprint === fingerprint
    && JSON.stringify(proof.environment) === JSON.stringify(environment)
    && Boolean(environment.imageOS && environment.imageVersion)
    && run?.status === 'completed' && run.conclusion === 'success'
    && run.repository?.full_name === repo && run.head_repository?.full_name === repo
    && (['dev', 'main'].includes(run.head_branch) || /^issue\/[1-9]\d+-[\w-]+$/.test(run.head_branch || '')
      && (promotedSha === run.head_sha || proof.schema === 2 && sourceCompatible))
    && run.path === '.github/workflows/validate.yml' && proof.sha === run.head_sha && proof.tree === tree
    && hex(proof.sha, 40) && hex(proof.tree, 40) && String(proof.run) === String(run.id)
    && Number(proof.attempt) === Number(run.run_attempt)
    && artifact?.name === `frontend-proof-${run.id}-${run.run_attempt}` && artifact.expired === false
    && now >= Date.parse(artifact.created_at) && now - Date.parse(artifact.created_at) < 24 * 60 * 60 * 1000
    && jobs?.filter(j => j.name === 'Фронтенд: типы, юниты, мутанты, синхрон бандла').length === 1
    && jobs.some(j => j.name === 'Фронтенд: типы, юниты, мутанты, синхрон бандла' && j.status === 'completed' && j.conclusion === 'success')
    && hex(proof.dist, 64) && hex(proof.testBuild, 64);
}
export function verifyProducerTrees(proof, directory) {
  if (artifactTree(join(directory, 'dist')) !== proof.dist || artifactTree(join(directory, 'test-build')) !== proof.testBuild)
    throw Error('producer byte inventory mismatch');
}
const gh = args => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function restoreFrontend({ root = process.cwd(), repo, environment = producerEnvironment(), api = gh,
  consumerBranch = process.env.GITHUB_REF_NAME,
  download = (id, name, dir) => execFileSync('gh', ['run', 'download', String(id), '--repo', repo, '--name', name, '--dir', dir], { stdio: 'pipe' }) } = {}) {
  const key = frontendKey(root, environment), fingerprint = sourceFingerprint(root);
  if (!environment.imageOS || !environment.imageVersion) return { reused: false, key, reason: 'unknown runner environment' };
  // Legacy v1 needs exact promotion. V2 uses independently proven inputs and
  // accepted ancestry; an issue may also reuse its own pre-rebase producer.
  const localSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const promotedSha = ['dev', 'main'].includes(consumerBranch)
    && api(['api', `repos/${repo}/git/ref/heads/${consumerBranch}`]).object?.sha === localSha ? localSha : null;
  const list = api(['api', `repos/${repo}/actions/workflows/validate.yml/runs?status=success&per_page=30`]);
  for (const candidate of list.workflow_runs || []) {
    if (String(candidate.id) === String(process.env.GITHUB_RUN_ID)) continue;
    if (candidate.head_sha !== localSha) {
      try {
        if (candidate.head_branch === consumerBranch && /^issue\/[1-9]\d+-[\w-]+$/.test(consumerBranch || '')
          && hex(candidate.head_sha, 40)) {
          try { execFileSync('git', ['-C', root, 'cat-file', '-e', `${candidate.head_sha}^{commit}`], { stdio: 'pipe' }); }
          catch { execFileSync('git', ['-C', root, 'fetch', '--no-tags', '--filter=blob:none', 'origin', candidate.head_sha], { stdio: 'pipe' }); }
        }
        const source = execFileSync('git', ['-C', root, 'show', `${candidate.head_sha}:scripts/frontend-proof.mjs`], { encoding: 'utf8' });
        if (source.replace(/\r\n?/g, '\n') !== readFileSync(join(root, 'scripts/frontend-proof.mjs'), 'utf8').replace(/\r\n?/g, '\n')) continue;
      } catch { continue; }
    }
    const dir = mkdtempSync(join(tmpdir(), 'hp-frontend-proof-'));
    try {
      const run = api(['api', `repos/${repo}/actions/runs/${candidate.id}`]);
      const name = `frontend-proof-${run.id}-${run.run_attempt}`;
      const artifacts = api(['api', `repos/${repo}/actions/runs/${run.id}/artifacts?name=${name}`]).artifacts || [];
      if (artifacts.length !== 1 || artifacts[0].expired) continue;
      download(run.id, name, dir);
      const proof = JSON.parse(readFileSync(join(dir, 'proof.json'), 'utf8'));
      const jobs = api(['api', `repos/${repo}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`]).jobs;
      const tree = api(['api', `repos/${repo}/git/commits/${run.head_sha}`]).tree?.sha;
      let sourceCompatible = false;
      const expectedKey = proof.schema === 1 ? key : frontendContentKey(root, environment);
      if (proof.schema === 2) {
        // Read source objects as data, never execute code from another branch.
        const sameIssue = /^issue\/[1-9]\d+-[\w-]+$/.test(consumerBranch || '') && run.head_branch === consumerBranch;
        if (!sameIssue) execFileSync('git', ['-C', root, 'merge-base', '--is-ancestor', run.head_sha, localSha], { stdio: 'pipe' });
        sourceCompatible = frontendContentKey(root, environment, run.head_sha) === expectedKey;
      }
      if (proof.schema === 1 && run.head_sha !== localSha) continue;
      if (!admissibleFrontendProof(proof, { key: expectedKey, fingerprint, environment, run, jobs, artifact: artifacts[0], tree, repo, promotedSha, sourceCompatible })) continue;
      verifyProducerTrees(proof, dir);
      for (const name of ['dist', 'test-build']) {
        const target = resolve(root, name);
        if (target !== join(resolve(root), name)) throw Error('unsafe artifact target');
        rmSync(target, { recursive: true, force: true });
        cpSync(join(dir, name), target, { recursive: true });
      }
      return { reused: true, key: expectedKey, sourceRun: run.id, sourceAttempt: run.run_attempt, sourceSha: run.head_sha };
    } catch { /* Missing/invalid/red/expired proof: normal fresh producer, no partial PASS. */ }
    finally { rmSync(dir, { recursive: true, force: true }); }
  }
  return { reused: false, key, reason: 'no complete compatible producer proof' };
}
if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const root = process.cwd();
  if (process.argv.includes('--store')) {
    const environment = producerEnvironment();
    const proof = { schema: 2, outcome: 'success', reused: false, key: frontendContentKey(root, environment),
      environment, fingerprint: sourceFingerprint(root), sha: git(['rev-parse', 'HEAD']), tree: git(['rev-parse', 'HEAD^{tree}']),
      run: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT,
      dist: artifactTree(join(root, 'dist')), testBuild: artifactTree(join(root, 'test-build')) };
    const out = resolve(arg('out'));
    // This separate temp artifact never changes repository source or publishes anything.
    cpSync(join(root, 'dist'), join(out, 'dist'), { recursive: true });
    cpSync(join(root, 'test-build'), join(out, 'test-build'), { recursive: true });
    writeFileSync(join(out, 'proof.json'), JSON.stringify(proof) + '\n', { flag: 'wx' });
  } else {
    let result;
    try { result = restoreFrontend({ repo: arg('repo') || process.env.GITHUB_REPOSITORY }); }
    catch { result = { reused: false, reason: 'proof discovery unavailable; fresh producer required' }; }
    const lines = [`reused=${result.reused}`, `source_run=${result.sourceRun || ''}`];
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join('\n') + '\n');
    console.log(JSON.stringify(result));
  }
}
