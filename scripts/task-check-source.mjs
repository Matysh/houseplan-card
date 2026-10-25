// #1060: a registry address is only a hint; authenticate the exact Actions source.
import { readCiProofArtifact, githubApiBase, JOB_RULES } from './ci-proof.mjs';
import { snapshotEntries } from './ci-registry-equivalence.mjs';
import { spawnSync } from 'node:child_process';
import { registeredRuns, ciWorkflow, CI_WORKFLOWS } from './ci-workflows.mjs';
import { taskCheckSnapshot, taskCheckPlanFromSnapshot, verifyTaskCheckClaim, TASK_CHECK_JOB_NAMES } from './task-check-reuse.mjs';

const headers = token => ({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token,
  'User-Agent': 'houseplan-task-check', 'X-GitHub-Api-Version': '2022-11-28' });
const validSha = sha => /^[a-f0-9]{40}$/.test(sha || '');

export function taskCheckSource({ repo, token, candidateSha, candidateSnapshot = null, root = process.cwd(),
  fetchImpl = fetch, apiBase = githubApiBase(), signal = null } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw Error('invalid task-check repository');
  const requests = new Map(), snapshots = new Map();
  const requestSignal = () => signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
  const json = path => {
    if (!requests.has(path)) requests.set(path, (async () => {
      const response = await fetchImpl(`${apiBase.replace(/\/+$/, '')}/repos/${repo}/${path}`,
        { headers: headers(token), signal: requestSignal() });
      if (!response.ok) throw Error('task-check source API ' + response.status);
      return response.json();
    })());
    return requests.get(path);
  };
  const snapshot = sha => {
    if (!snapshots.has(sha)) snapshots.set(sha, (async () => {
      if (!validSha(sha)) throw Error('task-check needs an immutable Git SHA');
      // Local Git blobs are safe for review too: no candidate code is executed.
      try {
        const local = spawnSync('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' });
        if (local.status === 0) return taskCheckSnapshot(root, sha);
      } catch { /* bounded remote fallback */ }
      // /git/trees accepts commit aliases but may echo the commit SHA. Bind
      // the immutable commit to its real tree before authenticating that tree.
      const commit = await json(`git/commits/${sha}`);
      if (commit?.sha !== sha || !validSha(commit?.tree?.sha)) throw Error('task-check commit differs from immutable source');
      const treeSha = commit.tree.sha;
      const tree = await json(`git/trees/${treeSha}?recursive=1`);
      if (tree?.sha !== treeSha || tree.truncated !== false || !Array.isArray(tree.tree)) throw Error('incomplete/foreign task-check Git tree');
      const entries = snapshotEntries(tree.tree), reads = new Map();
      const read = path => {
        if (!reads.has(path)) reads.set(path, (async () => {
          const entry = entries.get(path);
          if (!entry || !['100644', '100755'].includes(entry.mode)) throw Error('missing/unsafe task-check input: ' + path);
          const blob = await json(`git/blobs/${entry.oid}`);
          if (blob.encoding !== 'base64' || blob.sha !== entry.oid || typeof blob.content !== 'string')
            throw Error('task-check blob differs from its immutable tree');
          return Buffer.from(blob.content, 'base64');
        })());
        return reads.get(path);
      };
      return { entries, read, tree: tree.sha, sha };
    })());
    return snapshots.get(sha);
  };
  const companionStatus = async (record, proof) => {
    if (record.workflow !== '.github/workflows/validate-product.yml') return true;
    const required = proof.requiredProfiles;
    if (!Array.isArray(required) || !required.includes('product') || new Set(required).size !== required.length
      || required.some(profile => !['product', 'docs', 'tooling'].includes(profile))) return false;
    const companionProfiles = required.filter(profile => profile !== 'product');
    if (!companionProfiles.length) return true;
    const list = await json(`actions/runs?head_sha=${record.sha}&per_page=100`);
    if (!Array.isArray(list.workflow_runs) || Number(list.total_count || 0) > list.workflow_runs.length) return false;
    const rows = registeredRuns(list, { sha: record.sha, repo });
    const green = await Promise.all(companionProfiles.map(async profile => {
      const row = rows.find(item => CI_WORKFLOWS[ciWorkflow(item)] === profile);
      if (!row || !Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.run_attempt)) return false;
      const [latest, body] = await Promise.all([json(`actions/runs/${row.id}`),
        json(`actions/runs/${row.id}/attempts/${row.run_attempt}/jobs?per_page=100`)]);
      if (latest.id !== row.id || latest.run_attempt !== row.run_attempt || latest.head_sha !== record.sha
        || latest.path !== `.github/workflows/validate-${profile}.yml`
        || latest.repository?.full_name !== repo || latest.head_repository?.full_name !== repo
        || !/^(?:dev|main|issue\/[1-9]\d+-[\w-]+)$/.test(latest.head_branch || '')
        || latest.status !== 'completed' || latest.conclusion !== 'success'
        || !Array.isArray(body.jobs) || Number(body.total_count || 0) > body.jobs.length) return false;
      return [JOB_RULES.preflight[0].name, ...(profile === 'tooling' ? [TASK_CHECK_JOB_NAMES.tooling] : [])].every(name => {
        const actual = body.jobs.filter(job => job.name === name);
        return actual.length === 1 && actual[0].status === 'completed' && actual[0].conclusion === 'success'
          && (actual[0].run_id === undefined || Number(actual[0].run_id) === row.id);
      });
    }));
    return green.every(Boolean);
  };
  return async record => {
    if (!Number.isSafeInteger(record?.run) || record.run < 1 || !Number.isSafeInteger(record.attempt) || record.attempt < 1)
      throw Error('invalid task-check source attempt');
    const id = record.run, attempt = record.attempt, name = `ci-proof-${id}-${attempt}`;
    const [run, latestRun, jobList, artifactList, current, previous] = await Promise.all([
      json(`actions/runs/${id}/attempts/${attempt}`), json(`actions/runs/${id}`),
      json(`actions/runs/${id}/attempts/${attempt}/jobs?per_page=100`),
      json(`actions/runs/${id}/artifacts?name=${encodeURIComponent(name)}&per_page=100`),
      candidateSnapshot || snapshot(candidateSha), snapshot(record.sha),
    ]);
    if (!Array.isArray(jobList.jobs) || Number(jobList.total_count || 0) > jobList.jobs.length)
      throw Error('incomplete task-check source job inventory');
    const matches = (artifactList.artifacts || []).filter(item => item.name === name && !item.expired);
    if (matches.length !== 1 || Number(artifactList.total_count || 0) > (artifactList.artifacts || []).length)
      throw Error('task-check immutable proof absent/ambiguous');
    const artifact = matches[0], downloadKey = 'artifact:' + artifact.id;
    if (!requests.has(downloadKey)) requests.set(downloadKey, (async () => {
      const response = await fetchImpl(artifact.archive_download_url, { headers: headers(token), signal: requestSignal() });
      if (!response.ok) throw Error('task-check artifact download failed');
      return readCiProofArtifact(Buffer.from(await response.arrayBuffer()));
    })());
    const proof = await requests.get(downloadKey);
    return { run, latestRun, jobs: jobList.jobs, artifact, proof,
      companionsGreen: await companionStatus(record, proof), candidateSnapshot: current, sourceSnapshot: previous };
  };
}

/** Used by review/merge proof readers; failures remain explicit refusal contexts. */
export async function loadTaskCheckContexts({ proof, repo, token, candidateSha = proof?.candidate?.sha,
  fetchImpl = fetch, apiBase = githubApiBase(), root = process.cwd(), source = null, now = Date.now() } = {}) {
  const out = new Map();
  const claims = Object.entries(proof?.taskChecks || {}).filter(([, claim]) => claim?.mode === 'reused');
  if (!claims.length) return out;
  source ||= taskCheckSource({ repo, token, candidateSha, fetchImpl, apiBase, root });
  await Promise.all(claims.map(async ([job, claim]) => {
    try {
      if (claim.record?.job !== job || claim.plan?.job !== job) throw Error('task-check claim job differs from its slot');
      const context = await source(claim.record);
      const plan = await taskCheckPlanFromSnapshot(context.candidateSnapshot, { job,
        browserPlan: proof.browserPlan?.planned, environment: claim.plan.toolchain });
      out.set(job, await verifyTaskCheckClaim(claim, { plan, repo, now, request: proof.request || {}, ...context }));
    } catch (error) { out.set(job, { accepted: false, reason: error.message }); }
  }));
  return out;
}
