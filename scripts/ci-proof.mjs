#!/usr/bin/env node
// #541: один проверяемый контракт «зелёного Validate» для review, merge и
// release. Общий conclusion workflow недостаточен: лёгкий dispatch тоже green,
// а skipped job без доказанного content-addressed reuse ничего не доказывает.

import { inflateRawSync } from 'node:zlib';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const CI_PROOF_SCHEMA = 'houseplan-ci-proof/v1';
export const CI_PROOF_ARTIFACT_PREFIX = 'ci-proof';
export const CI_PROOF_STATES = Object.freeze([
  'green', 'missing', 'pending', 'cancelled', 'stale', 'failed',
]);

export const CI_PROOF_POLICIES = Object.freeze({
  review: Object.freeze({ name: 'review', full: false, mutants: true }),
  merge: Object.freeze({ name: 'merge', full: false, mutants: true }),
  release: Object.freeze({ name: 'release', full: true, mutants: true }),
});

const JOB_RULES = Object.freeze({
  preflight: [{ exact: 'Предполёт: документация, провенанс, процесс', count: 1 }],
  changes: [{ exact: 'Классификация изменённых файлов', count: 1 }],
  reuse: [{ exact: 'Переиспользование: это дерево уже проверено', count: 1 }],
  frontend: [{ exact: 'Фронтенд: типы, юниты, мутанты, синхрон бандла', count: 1 }],
  integration: [
    { exact: 'HACS: валидация репозитория', count: 1 },
    { exact: 'Hassfest: манифест интеграции', count: 1 },
  ],
  mutants: [{ prefix: 'Мутанты по диффу (', count: 6 }],
  smoke: [
    { prefix: 'Смоки в браузере (шард ', count: 3 },
    { exact: 'Смоки: все шарды зелёные', count: 1 },
  ],
  golden: [{ exact: 'Golden-кадры против принятых эталонов', count: 1 }],
  performance_smoke: [{ exact: 'Перф-смок: бюджет времени кадра', count: 1 }],
  geometry_parity: [{ exact: 'Геометрия: TS/Python parity исполнена', count: 1 }],
  backend: [{ exact: 'Бэкенд: pytest в Home Assistant', count: 1 }],
});

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
  if (asBool(selection.geometry_parity)) ids.push('geometry_parity');
  if (asBool(selection.backend)) ids.push('backend');
  return ids;
}

const reuseClaim = (outputs, id) => ({
  key: outputs?.[`${id}_key`] || '',
  sourceRun: Number(outputs?.[`${id}_source_run`] || 0) || null,
  sourceAttempt: Number(outputs?.[`${id}_source_attempt`] || 0) || null,
  sourceSha: outputs?.[`${id}_source_sha`] || null,
});

/** Build the immutable JSON uploaded by the final Validate job. */
export function buildCiProof({
  candidateSha, candidateTree, runId, attempt, event, needs,
  requestedFull = false, requestedMutants = false,
}) {
  const changes = needs?.changes?.outputs || {};
  const reuse = needs?.reuse?.outputs || {};
  const request = {
    full: asBool(requestedFull) || asBool(changes.heavy),
    mutants: asBool(requestedMutants) || asBool(changes.mutants_requested),
  };
  const selection = {
    frontend: asBool(changes.frontend),
    geometry_parity: asBool(changes.geometry_parity),
    backend: asBool(changes.backend),
    integration: asBool(changes.integration),
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
  if (selection.frontend) executed('frontend');
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
  if (selection.geometry_parity) executedOrReused('geometry_parity');
  if (selection.backend) executedOrReused('backend');
  const requiredChecks = requiredCheckIds({ request, selection });
  return {
    schema: CI_PROOF_SCHEMA,
    candidate: { sha: candidateSha, tree: candidateTree },
    run: { id: Number(runId), attempt: Number(attempt), workflow: 'validate.yml', event },
    request,
    selection,
    requiredChecks,
    executedChecks: requiredChecks.filter((id) => checks[id]?.mode === 'executed'),
    reusedChecks: requiredChecks.filter((id) => checks[id]?.mode === 'reused'),
    checks,
  };
}

const sortedUnique = (values) => [...new Set(values)].sort();
const sameSet = (a, b) => JSON.stringify(sortedUnique(a)) === JSON.stringify(sortedUnique(b));
const jobsMatching = (jobs, rule) => (Array.isArray(jobs) ? jobs : []).filter((job) => (
  rule.exact ? job?.name === rule.exact : String(job?.name || '').startsWith(rule.prefix)
));

function executedCheckIsGreen(id, jobs) {
  return (JOB_RULES[id] || []).every((rule) => {
    const matches = jobsMatching(jobs, rule);
    return matches.length === rule.count && matches.every((job) => job.conclusion === 'success');
  });
}

/**
 * One state machine for all consumers. `reuseRuns` maps source run id to
 * `{run,jobs}` fetched independently from the marker claim.
 */
export function evaluateCiProof({ run, proof, jobs = [], reuseRuns = new Map(), candidate = {}, policy }) {
  const result = (status, note) => ({ status, note, url: runUrlOf(run) });
  if (!run) return result('missing', 'Validate run is missing');
  if (run.status !== 'completed') return result('pending', `Validate run ${runIdOf(run)} is ${run.status || 'pending'}`);
  if (run.conclusion === 'cancelled') return result('cancelled', `Validate run ${runIdOf(run)} was cancelled`);
  if (!proof) return result('missing', `Validate run ${runIdOf(run)} has no proof artifact`);
  if (proof.schema !== CI_PROOF_SCHEMA) return result('stale', `unsupported proof schema ${proof.schema || 'missing'}`);
  const expected = {
    runId: runIdOf(run), attempt: runAttemptOf(run), sha: candidate.sha || runShaOf(run), tree: candidate.tree,
  };
  if (proof.run?.id !== expected.runId || proof.run?.attempt !== expected.attempt
    || proof.run?.workflow !== 'validate.yml' || proof.candidate?.sha !== expected.sha
    || (expected.tree && proof.candidate?.tree !== expected.tree)) {
    return result('stale', 'proof does not belong to the candidate SHA/tree and run attempt');
  }
  if (runShaOf(run) && proof.candidate.sha !== runShaOf(run))
    return result('stale', 'run head SHA differs from proof candidate');
  if (run?.event && proof.run?.event !== run.event)
    return result('stale', 'run event differs from proof event');
  if (policy?.full && !asBool(proof.request?.full)) return result('stale', 'proof is light; full gates were not requested');
  if (policy?.mutants && !asBool(proof.request?.mutants)) return result('stale', 'proof has no requested mutant jobs');
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
  for (const id of derived) {
    const claim = proof.checks?.[id];
    if (!claim || claim.result !== 'success') return result('failed', `${id}: proof result is ${claim?.result || 'missing'}`);
    if (claim.mode === 'executed') {
      if (!executedCheckIsGreen(id, jobs)) return result('failed', `${id}: claimed execution is absent, incomplete or not green`);
      continue;
    }
    if (claim.mode !== 'reused' || !['smoke', 'golden', 'performance_smoke', 'backend'].includes(id))
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
      || !executedCheckIsGreen(id, source.jobs)) {
      return result('failed', `${id}: source run does not verify the reused successful job`);
    }
  }
  return result('green', `${policy?.name || 'consumer'} proof is complete`);
}

/** Newest relevant proof wins; cancelled and policy-inadequate stale runs do not. */
export function selectCiProofVerdict(evaluations) {
  for (const item of evaluations || []) {
    if (item?.status === 'cancelled' || item?.status === 'stale') continue;
    return item;
  }
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

async function githubJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, { headers: apiHeaders(token) });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function githubCandidateTree({ repo, sha, token, fetchImpl = fetch }) {
  const row = await githubJson(`https://api.github.com/repos/${repo}/git/commits/${sha}`, token, fetchImpl);
  return row?.tree?.sha || null;
}

export async function loadGithubProofContext({ repo, run, token, fetchImpl = fetch }) {
  const runId = runIdOf(run);
  const attempt = runAttemptOf(run);
  const name = ciProofArtifactName(runId, attempt);
  const list = await githubJson(
    `https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts?name=${encodeURIComponent(name)}`,
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
    `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`, token, fetchImpl,
  );
  const jobs = jobsBody?.jobs || [];
  const reuseRuns = new Map();
  for (const id of proof?.reusedChecks || []) {
    const sourceId = proof?.checks?.[id]?.reuse?.sourceRun;
    const sourceAttempt = proof?.checks?.[id]?.reuse?.sourceAttempt;
    const sourceKey = reuseSourceKey(sourceId, sourceAttempt);
    if (!sourceId || !sourceAttempt || reuseRuns.has(sourceKey)) continue;
    const sourceRun = await githubJson(
      `https://api.github.com/repos/${repo}/actions/runs/${sourceId}/attempts/${sourceAttempt}`, token, fetchImpl,
    );
    const sourceJobs = await githubJson(
      `https://api.github.com/repos/${repo}/actions/runs/${sourceId}/attempts/${sourceAttempt}/jobs?per_page=100`,
      token, fetchImpl,
    );
    reuseRuns.set(sourceKey, { run: sourceRun, jobs: sourceJobs?.jobs || [] });
  }
  return { proof, jobs, reuseRuns };
}

if (isMainModule(import.meta.url)) {
  const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const marker = value('marker');
  const emit = value('emit');
  if (marker) {
    const parsed = parseReuseMarker(readFileSync(resolve(marker), 'utf8'));
    const output = `source_run=${parsed.sourceRun}\nsource_attempt=${parsed.sourceAttempt}\nsource_sha=${parsed.sourceSha}\n`;
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
    process.stdout.write(output);
  } else if (emit) {
    const proof = buildCiProof({
      candidateSha: process.env.CANDIDATE_SHA,
      candidateTree: process.env.CANDIDATE_TREE,
      runId: process.env.CI_RUN_ID,
      attempt: process.env.CI_RUN_ATTEMPT,
      event: process.env.CI_EVENT,
      needs: JSON.parse(process.env.NEEDS_JSON || '{}'),
      requestedFull: process.env.REQUEST_FULL,
      requestedMutants: process.env.REQUEST_MUTANTS,
    });
    const target = resolve(emit);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(proof, null, 2)}\n`);
    console.log(`CI proof: ${target} (${proof.requiredChecks.join(', ')})`);
  } else {
    console.error('usage: ci-proof.mjs --emit=<proof.json> | --marker=<.reuse-marker>');
    process.exitCode = 2;
  }
}
