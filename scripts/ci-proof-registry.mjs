// #981: portable one-fetch orphan index, independently authenticated via Actions.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCiProofArtifact } from './ci-proof.mjs';
import { registryPath, verifyRegistryRecord } from './ci-registry-verify.mjs';
import { jobInstanceNames, validateJobs } from './workflow-jobs.mjs';
import { snapshotEntries, sourceEquivalenceCommon, sourceEquivalenceJob } from './ci-registry-equivalence.mjs';

const git = (root, args, options = {}) => execFileSync('git', ['-C', root, ...args],
  { maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options }).toString('utf8').trim();
export function fetchRegistry(root) {
  try {
    git(root, ['fetch', '--quiet', '--no-tags', '--depth=1', 'origin', '+refs/heads/ci-proofs:refs/remotes/origin/ci-proofs']);
    const tip = git(root, ['rev-parse', 'refs/remotes/origin/ci-proofs']);
    return { tip, read(job, key) {
      try { return JSON.parse(git(root, ['show', tip + ':' + registryPath(job, key)])); }
      catch { return null; }
    } };
  } catch { return { tip: null, read: () => null }; }
}

const namesOf = job => {
  const definitions = validateJobs(), ids = [job, ...(job === 'smoke' ? ['smoke_done'] : [])];
  return ids.flatMap(id => jobInstanceNames(definitions.get(id)));
};
const headers = token => ({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
  'User-Agent': 'houseplan-ci-registry', 'X-GitHub-Api-Version': '2022-11-28' });
export function registryApi({ repo, token, candidateSha = null, candidateSnapshot = null, mode = 'exact',
  fetchImpl = fetch, apiBase = process.env.GITHUB_API_URL || 'https://api.github.com' }) {
  const pending = new Map();
  const request = path => {
    if (!pending.has(path)) pending.set(path, (async () => {
      const response = await fetchImpl(apiBase.replace(/\/+$/, '') + '/repos/' + repo + '/' + path,
        { headers: headers(token), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('registry source API ' + response.status);
      return response.json();
    })());
    return pending.get(path);
  };
  const snapshots = new Map(), commonChecks = new Map();
  const snapshot = sha => {
    if (!snapshots.has(sha)) snapshots.set(sha, (async () => {
      if (!/^[a-f0-9]{40}$/.test(sha || '')) throw Error('missing exact candidate/source Git SHA');
      const body = await request('git/trees/' + sha + '?recursive=1');
      if (body.truncated || !Array.isArray(body.tree)) throw Error('incomplete source Git tree');
      const entries = snapshotEntries(body.tree), reads = new Map();
      const read = path => {
        if (!reads.has(path)) reads.set(path, (async () => {
          const file = await request('contents/' + path.split('/').map(encodeURIComponent).join('/') + '?ref=' + sha);
          if (file.type !== 'file' || file.encoding !== 'base64' || file.sha !== entries.get(path)?.oid)
            throw Error('source file does not belong to the immutable Git tree');
          return Buffer.from(file.content, 'base64');
        })());
        return reads.get(path);
      };
      return { entries, read };
    })());
    return snapshots.get(sha);
  };
  const candidate = async () => {
    if (candidateSnapshot) return candidateSnapshot;
    const current = await snapshot(candidateSha);
    if (!current.inventory) [current.inventory, current.domains] = await Promise.all(
      ['scripts/ci-registry-inventory.json', 'scripts/ci-profile-paths.json'].map(async path => JSON.parse((await current.read(path)).toString('utf8'))));
    return current;
  };
  const equivalence = async record => {
    const [current, previous] = await Promise.all([candidate(), snapshot(record.sha)]);
    const key = record.sha + ':' + mode;
    if (!commonChecks.has(key)) commonChecks.set(key, sourceEquivalenceCommon(current, previous, mode));
    return sourceEquivalenceJob(current, previous, record, await commonChecks.get(key));
  };
  return async record => {
    const id = record.run, attempt = record.attempt, artifactName = 'ci-proof-' + id + '-' + attempt;
    const [run, latest, body, artifacts, equivalent] = await Promise.all([
      request('actions/runs/' + id + '/attempts/' + attempt), request('actions/runs/' + id),
      request('actions/runs/' + id + '/attempts/' + attempt + '/jobs?per_page=100'),
      request('actions/runs/' + id + '/artifacts?per_page=100'),
      equivalence(record),
    ]);
    if (Number(latest.run_attempt) !== attempt || latest.status !== 'completed' || latest.conclusion !== 'success')
      throw Error('source rerun is incomplete/red');
    const matches = (artifacts.artifacts || []).filter(a => a.name === artifactName && !a.expired);
    if (matches.length !== 1) throw Error('source immutable proof absent/ambiguous');
    const artifact = matches[0];
    const downloadKey = 'artifact:' + artifact.id;
    if (!pending.has(downloadKey)) pending.set(downloadKey, (async () => {
      const response = await fetchImpl(artifact.archive_download_url,
        { headers: headers(token), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('source artifact download failed');
      return readCiProofArtifact(Buffer.from(await response.arrayBuffer()));
    })());
    const proof = await pending.get(downloadKey);
    if (record.job === 'frontend') {
      for (const name of ['producer-card-bundle', 'producer-test-build']) {
        const rows = (artifacts.artifacts || []).filter(a => a.name === name && !a.expired
          && a.workflow_run?.head_sha === record.sha);
        if (rows.length !== 1) throw Error('source frontend inventory artifact missing/expired');
      }
    }
    let companionsGreen = true;
    if (record.workflow === '.github/workflows/validate-product.yml') {
      const rows = await request('actions/runs?head_sha=' + record.sha + '&per_page=100');
      for (const profile of proof.requiredProfiles || []) {
        if (profile === 'product') continue;
        if (!['docs', 'tooling'].includes(profile)) { companionsGreen = false; continue; }
        const companion = (rows.workflow_runs || []).find(r => r.head_sha === record.sha
          && r.path === '.github/workflows/validate-' + profile + '.yml');
        if (!companion || companion.status !== 'completed' || companion.conclusion !== 'success') companionsGreen = false;
      }
      if (!proof.requiredProfiles?.includes('product')) companionsGreen = false;
    }
    return { run, jobs: body.jobs || [], proof, artifact, companionsGreen, ...equivalent };
  };
}

export async function probeRegistry({ root, repo, plan, jobs, allowed = true, store = fetchRegistry(root), source,
  now = Date.now(), nameOf = namesOf }) {
  const results = {};
  await Promise.all(jobs.map(async job => {
    results[job] = { accepted: false, reason: allowed ? 'no indexed producer' : 'fresh policy' };
    if (!allowed) return;
    const record = store.read(job, plan.keys[job]);
    if (!record) return;
    try {
      const context = await source(record);
      results[job] = verifyRegistryRecord(record, { plan, job, repo, ...context, now, jobNames: nameOf(job) });
    } catch (error) { results[job] = { accepted: false, reason: 'fresh: ' + error.message }; }
  }));
  return { schema: 1, plan, results, registryTip: store.tip };
}

/**
 * Tree writes use a private temporary index, never checkout/reset the user's
 * branch. A rejected CAS fetches the winning tip and merges addresses again.
 */
export function publishRegistry({ root, records, attempts = 4, gitOp = git }) {
  if (!records.length) return { published: 0 };
  const tempIndex = resolve(root, gitOp(root, ['rev-parse', '--git-path', 'hp-registry-index-' + process.pid]));
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex, GIT_AUTHOR_NAME: 'houseplan-ci-proofs',
    GIT_AUTHOR_EMAIL: 'houseplan-ci-proofs@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'houseplan-ci-proofs', GIT_COMMITTER_EMAIL: 'houseplan-ci-proofs@users.noreply.github.com' };
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      let tip = null;
      try {
        gitOp(root, ['fetch', '--quiet', '--no-tags', '--depth=1', 'origin', '+refs/heads/ci-proofs:refs/remotes/origin/ci-proofs']);
        tip = gitOp(root, ['rev-parse', 'refs/remotes/origin/ci-proofs']);
      } catch { /* creating the orphan branch is a normal first use */ }
      gitOp(root, tip ? ['read-tree', tip] : ['read-tree', '--empty'], { env });
      for (const record of records) {
        const path = registryPath(record.job, record.key), bytes = JSON.stringify(record) + '\n';
        const oid = gitOp(root, ['hash-object', '-w', '--stdin'], { input: bytes, env });
        gitOp(root, ['update-index', '--add', '--cacheinfo', '100644,' + oid + ',' + path], { env });
      }
      const tree = gitOp(root, ['write-tree'], { env });
      const commit = gitOp(root, ['commit-tree', tree, ...(tip ? ['-p', tip] : [])],
        { input: 'ci-proofs: retain immutable successful job sources\n', env });
      try {
        gitOp(root, ['push', '--quiet', '--force-with-lease=refs/heads/ci-proofs:' + (tip || ''), 'origin', commit + ':refs/heads/ci-proofs']);
        return { published: records.length, commit };
      } catch (error) { if (attempt === attempts - 1) throw error; }
    }
  } finally {
    rmSync(tempIndex, { force: true });
  }
}
