#!/usr/bin/env node
// Bounded reconciliation for the event-driven S4/S7 controller (#555).
//
// The label remains the state. This script never publishes a verdict and never
// merges anything; it only wakes the ordinary controller after a proven lost or
// transiently terminated request, or leaves one deduplicated diagnostic when
// recovery would require guessing. One invocation reads one snapshot and exits:
// it does not poll and therefore cannot turn a healthy wait into model usage.

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const REVIEW_LABELS = ['S4-spec-review', 'S7-code-review'];
export const ACTIVE_RUN_STATES = new Set(['queued', 'in_progress', 'pending', 'requested', 'waiting']);
export const RETRYABLE_CONCLUSIONS = new Set(['cancelled', 'timed_out', 'stale', 'startup_failure', 'skipped']);
export const DEFAULT_GRACE_MS = 5 * 60_000;
export const DEFAULT_ACTIVE_LIMIT_MS = 4 * 60 * 60_000;

const STAGE = { 'S4-spec-review': 'spec', 'S7-code-review': 'code' };
const RUN_TITLE = /^process #(\d+) · (S4-spec-review|S7-code-review)(?: ·|$)/;
const MARKER_PREFIX = 'houseplan-process-reconcile:v1';
const RETRY_COMMENT = /houseplan-process-reconcile:v1:[^\s]+[\s\S]*Автосверка процесса (?:пытается )?повторно/;

const at = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const labelsOf = (issue) => (issue?.labels || []).map((label) =>
  typeof label === 'string' ? label : label?.name).filter(Boolean);

export function parseProcessRun(run = {}) {
  const match = String(run.displayTitle || run.display_title || run.name || '').match(RUN_TITLE);
  if (!match) return null;
  return {
    id: Number(run.databaseId ?? run.id),
    attempt: Number(run.attempt ?? run.run_attempt ?? 1),
    issue: Number(match[1]),
    label: match[2],
    stage: STAGE[match[2]],
    status: String(run.status || ''),
    conclusion: run.conclusion == null ? '' : String(run.conclusion),
    createdAt: run.createdAt || run.created_at || run.run_started_at || null,
    updatedAt: run.updatedAt || run.updated_at || run.completedAt || null,
    url: run.url || run.html_url || null,
    prepared: run.prepared || null,
    preparedArtifact: Boolean(run.preparedArtifact),
    resultArtifact: Boolean(run.resultArtifact),
    evidenceError: run.evidenceError || null,
  };
}

export function latestReviewRequest(events = [], label = null) {
  const requests = events
    .filter((event) => event?.event === 'labeled' && REVIEW_LABELS.includes(event?.label?.name))
    .map((event) => ({
      id: String(event.id || event.node_id || event.createdAt || event.created_at || ''),
      at: event.createdAt || event.created_at || null,
      label: event.label.name,
      actor: event.actor?.login || null,
    }))
    .filter((request) => Number.isFinite(at(request.at)) && (!label || request.label === label));
  requests.sort((a, b) => at(a.at) - at(b.at) || a.id.localeCompare(b.id));
  return requests.at(-1) || null;
}

export function preparedEvidenceError(prepared, { issue, stage, run }) {
  if (!prepared) return null;
  const badIdentity = prepared.schema !== 1
    || String(prepared.run_id) !== String(run.id)
    || String(prepared.run_attempt) !== String(run.attempt)
    || String(prepared.issue) !== String(issue.number)
    || prepared.stage !== stage;
  if (badIdentity) return 'prepared artifact belongs to another issue/stage/run attempt';
  if (!/^[0-9a-f]{40}$/i.test(String(prepared.material_sha || ''))
    || !/^[0-9a-f]{40}$/i.test(String(prepared.material_tree || ''))
    || typeof prepared.material_specs !== 'string'
    || !/^[1-9][0-9]*$/.test(String(prepared.cycle || ''))) {
    return 'prepared artifact has incomplete material SHA/tree/spec hash or round';
  }
  return null;
}

function result(action, reason, context = {}) {
  return { action, reason, ...context };
}

/** Pure controller decision. It never interprets or applies a model verdict. */
export function decideReconciliation({
  issue, request = null, runs = [], now = Date.now(), graceMs = DEFAULT_GRACE_MS,
  activeLimitMs = DEFAULT_ACTIVE_LIMIT_MS,
}) {
  const labels = labelsOf(issue);
  const statuses = REVIEW_LABELS.filter((label) => labels.includes(label));
  if (statuses.length === 0) return result('noop', 'verdict already applied or issue is not awaiting review');
  if (statuses.length !== 1) return result('escalate', 'ambiguous review status labels', { label: null });
  const label = statuses[0];
  const stage = STAGE[label];
  if (labels.includes('blocked') || labels.includes('review-4')) {
    return result('noop', 'owner intentionally stopped review', { label, stage });
  }
  if (!request || request.label !== label || !Number.isFinite(at(request.at))) {
    return result('escalate', 'current review label has no unambiguous timeline request', { label, stage });
  }

  const requestAt = at(request.at);
  const matching = runs
    .map((run) => run.issue ? run : parseProcessRun(run))
    .filter(Boolean)
    .filter((run) => run.issue === Number(issue.number) && run.label === label
      && Number.isFinite(at(run.createdAt)) && at(run.createdAt) >= requestAt - 120_000)
    .sort((a, b) => at(b.createdAt) - at(a.createdAt) || Number(b.id) - Number(a.id));
  const run = matching[0] || null;

  if (!run) {
    if (now - requestAt < graceMs) return result('wait', 'label event is still within delivery grace', { label, stage });
    const retryAlreadyIssued = (issue?.comments || []).some((comment) =>
      RETRY_COMMENT.test(String(comment?.body || '')) && at(comment?.createdAt) >= requestAt);
    if (retryAlreadyIssued) {
      return result('escalate', 'one automatic retry was already issued but still has no matching run', { label, stage });
    }
    return result('retry', 'label event has no matching process run', { label, stage });
  }
  if (run.evidenceError) {
    return result('escalate', `run evidence is invalid: ${run.evidenceError}`, { label, stage, run });
  }
  const evidenceError = preparedEvidenceError(run.prepared, { issue, stage, run });
  if (evidenceError) return result('escalate', evidenceError, { label, stage, run });

  if (ACTIVE_RUN_STATES.has(run.status)) {
    const age = now - at(run.createdAt);
    if (age <= activeLimitMs) return result('wait', 'matching process run is healthy and active', { label, stage, run });
    return result('escalate', 'matching process run is active beyond the controller budget', { label, stage, run });
  }
  if (run.status !== 'completed') {
    return result('escalate', `unknown process run status: ${run.status || 'missing'}`, { label, stage, run });
  }
  const settledAt = at(run.updatedAt || run.createdAt);
  if (Number.isFinite(settledAt) && now - settledAt < graceMs) {
    return result('wait', 'completed run is still within label-application grace', { label, stage, run });
  }
  if (run.conclusion === 'success') {
    return result('escalate', 'successful run did not move the review label', { label, stage, run });
  }
  if (run.resultArtifact) {
    return result('escalate', 'sealed model result exists but was not integrated; automatic rerun would spend the model twice', { label, stage, run });
  }
  if (RETRYABLE_CONCLUSIONS.has(run.conclusion)) {
    return result('retry', `transient process run conclusion: ${run.conclusion}`, { label, stage, run });
  }
  return result('escalate', `non-transient process run conclusion: ${run.conclusion || 'missing'}`, { label, stage, run });
}

export function reconciliationKey(issue, request, decision) {
  const raw = [issue.number, request?.id || 'no-request', decision.label || 'ambiguous',
    decision.run?.id || 'no-run', decision.run?.attempt || '0', decision.action, decision.reason].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 20);
}

export function markerFor(key) {
  return `<!-- ${MARKER_PREFIX}:${key} -->`;
}

export function alreadyReported(issue, key) {
  const marker = markerFor(key);
  return (issue?.comments || []).some((comment) => String(comment?.body || '').includes(marker));
}

function gh(args, { allowFailure = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error(`gh ${args.join(' ')} → ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return result;
}

function ghJson(args) {
  const output = gh(args).stdout || 'null';
  return JSON.parse(output);
}

function issueView(repo, number) {
  return ghJson(['issue', 'view', String(number), '--repo', repo, '--json', 'number,title,labels,comments,updatedAt']);
}

function issueEvents(repo, number) {
  const pages = ghJson(['api', '--paginate', '--slurp', `repos/${repo}/issues/${number}/events?per_page=100`]);
  return Array.isArray(pages?.[0]) ? pages.flat() : (Array.isArray(pages) ? pages : []);
}

function openReviewIssues(repo) {
  const fields = 'number,title,labels,comments,updatedAt';
  const rows = REVIEW_LABELS.flatMap((label) => ghJson([
    'issue', 'list', '--repo', repo, '--state', 'open', '--label', label,
    '--limit', '500', '--json', fields,
  ]));
  return [...new Map(rows.map((issue) => [issue.number, issue])).values()]
    .sort((a, b) => a.number - b.number);
}

function processRuns(repo, issues = []) {
  const pages = [1, 2].flatMap((page) => {
    const response = ghJson(['api', `repos/${repo}/actions/workflows/process.yml/runs?event=issues&per_page=100&page=${page}`]);
    return response.workflow_runs || [];
  });
  return pages.map((raw) => {
    const stable = parseProcessRun(raw);
    if (stable) return stable;
    // Runs created before #555 used the issue title as display_title. Accept
    // that legacy identity only when it names exactly one current S4/S7 issue;
    // title ambiguity must never wake a potentially different task.
    const title = String(raw.display_title || raw.displayTitle || '');
    const matches = issues.filter((issue) => issue.title === title);
    if (matches.length !== 1) return null;
    const labels = labelsOf(matches[0]);
    const statuses = REVIEW_LABELS.filter((label) => labels.includes(label));
    if (statuses.length !== 1) return null;
    const label = statuses[0];
    return parseProcessRun({
      ...raw,
      display_title: `process #${matches[0].number} · ${label} · ${title}`,
    });
  }).filter(Boolean);
}

function artifactNames(repo, run) {
  const response = ghJson(['api', `repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`]);
  return response.artifacts || [];
}

function loadPreparedArtifact(repo, run, artifact) {
  const dir = mkdtempSync(join(tmpdir(), 'houseplan-process-reconcile-'));
  try {
    const downloaded = gh(['run', 'download', String(run.id), '--repo', repo,
      '--name', artifact.name, '--dir', dir], { allowFailure: true });
    if (downloaded.status !== 0) throw new Error(`artifact download failed: ${(downloaded.stderr || '').trim()}`);
    const file = join(dir, 'prepared.json');
    const manifest = join(dir, 'manifest.sha256');
    if (!existsSync(file) || !existsSync(manifest)) throw new Error('prepared artifact is incomplete');
    const body = readFileSync(file);
    const expected = readFileSync(manifest, 'utf8').trim().split(/\s+/)[0];
    const actual = createHash('sha256').update(body).digest('hex');
    if (expected !== actual) throw new Error('prepared artifact checksum mismatch');
    return JSON.parse(body.toString('utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function hydrateRunEvidence(repo, issue, run) {
  if (!run || run.status !== 'completed') return run;
  try {
    const artifacts = artifactNames(repo, run);
    const preparedName = `review-prepared-${issue.number}-${run.id}-${run.attempt}`;
    const resultName = `review-result-${issue.number}-${run.id}-${run.attempt}`;
    const preparedArtifacts = artifacts.filter((artifact) => artifact.name === preparedName && !artifact.expired);
    const resultArtifacts = artifacts.filter((artifact) => artifact.name === resultName && !artifact.expired);
    if (preparedArtifacts.length > 1 || resultArtifacts.length > 1) {
      return { ...run, evidenceError: 'duplicate prepared/result artifacts' };
    }
    return {
      ...run,
      preparedArtifact: preparedArtifacts.length === 1,
      resultArtifact: resultArtifacts.length === 1,
      prepared: preparedArtifacts.length === 1
        ? loadPreparedArtifact(repo, run, preparedArtifacts[0]) : null,
    };
  } catch (error) {
    return { ...run, evidenceError: error instanceof Error ? error.message : String(error) };
  }
}

function commentBody(issue, request, decision, key) {
  const run = decision.run;
  const evidence = run?.prepared
    ? ` Материал: \`${String(run.prepared.material_sha).slice(0, 12)}\`, tree \`${String(run.prepared.material_tree).slice(0, 12)}\`, ТЗ \`${run.prepared.material_specs || 'нет файлового ТЗ'}\`, раунд r${run.prepared.cycle}.`
    : '';
  const link = run?.url ? ` [Прогон](${run.url}).` : '';
  if (decision.action === 'retry') {
    return `${markerFor(key)}\nАвтосверка процесса пытается повторно разбудить \`${decision.label}\`: ${decision.reason}.${link}${evidence}\n\n`
      + 'Вердикт не применялся, цикл ревью не расходуется самой сверкой; после успешного восстановления новый запуск заново проверит актуальные метки и материал.';
  }
  return `${markerFor(key)}\n**Автосверка процесса не стала угадывать результат.** ${decision.reason}.${link}${evidence}\n\n`
    + `Запрос: \`${request?.id || 'не найден'}\`, текущая метка: \`${decision.label || labelsOf(issue).join(', ') || 'нет'}\`. `
    + 'Метка и вердикт не изменены; требуется разбор человеком.';
}

function addComment(repo, issue, body) {
  gh(['issue', 'comment', String(issue.number), '--repo', repo, '--body', body]);
}

export function relabel(repo, issue, label, execute = gh) {
  execute(['issue', 'edit', String(issue.number), '--repo', repo, '--remove-label', label]);
  const args = ['issue', 'edit', String(issue.number), '--repo', repo, '--add-label', label];
  const first = execute(args, { allowFailure: true });
  if (first.status === 0) return;
  // One bounded restore attempt. Its result is authoritative; unlike the old
  // best-effort call, a second failure is retained in summary.json.
  const restore = execute(args, { allowFailure: true });
  if (restore.status !== 0) throw new Error(`could not restore ${label}: ${(restore.stderr || first.stderr || '').trim()}`);
}

const DEFAULT_APPLY_OPS = {
  comment: (repo, issue, body) => addComment(repo, issue, body),
  relabel: (repo, issue, label) => relabel(repo, issue, label),
};

/** The write path is deliberately small and dependency-injected for failure fixtures. */
export async function applyReconciliationDecision({ repo, issue, request, decision, key, ops = DEFAULT_APPLY_OPS }) {
  // Persist the dedupe/diagnostic marker before touching the status. If comment
  // publication fails, no relabel happens; if relabel fails, the owner still
  // gets one durable explanation and the next schedule cannot loop silently.
  await ops.comment(repo, issue, commentBody(issue, request, decision, key));
  if (decision.action === 'retry') await ops.relabel(repo, issue, decision.label);
}

async function snapshot(repo, baseRuns, issue) {
  const fresh = issueView(repo, issue.number);
  const events = issueEvents(repo, issue.number);
  const labels = labelsOf(fresh);
  const label = REVIEW_LABELS.find((candidate) => labels.includes(candidate)) || null;
  const request = latestReviewRequest(events, label);
  const candidates = baseRuns.filter((run) => run.issue === issue.number && run.label === label)
    .sort((a, b) => at(b.createdAt) - at(a.createdAt));
  const hydrated = candidates.length ? [hydrateRunEvidence(repo, fresh, candidates[0]), ...candidates.slice(1)] : candidates;
  return { issue: fresh, request, runs: hydrated };
}

const DEFAULT_RUNTIME = {
  openReviewIssues,
  processRuns,
  snapshot,
  applyDecision: applyReconciliationDecision,
};

export async function reconcileAll({
  repo, apply = false, maxActions = 5, now = Date.now(), runtime = DEFAULT_RUNTIME,
}) {
  const issues = await runtime.openReviewIssues(repo);
  const runs = await runtime.processRuns(repo, issues);
  const records = [];
  let mutations = 0;
  let failures = 0;
  for (const listed of issues) {
    const first = await runtime.snapshot(repo, runs, listed);
    const decision = decideReconciliation({ ...first, now });
    const key = reconciliationKey(first.issue, first.request, decision);
    const record = {
      issue: first.issue.number,
      title: first.issue.title,
      request: first.request,
      action: decision.action,
      reason: decision.reason,
      run: decision.run ? {
        id: decision.run.id, attempt: decision.run.attempt, status: decision.run.status,
        conclusion: decision.run.conclusion, url: decision.run.url,
        materialSha: decision.run.prepared?.material_sha || null,
        materialTree: decision.run.prepared?.material_tree || null,
        materialSpecs: decision.run.prepared?.material_specs || null,
        round: decision.run.prepared?.cycle || null,
      } : null,
      key,
      applied: false,
    };
    if (apply && ['retry', 'escalate'].includes(decision.action) && mutations < maxActions
      && !alreadyReported(first.issue, key)) {
      // Re-read immediately before a write. A label/body/owner decision may have
      // changed while runs and artifacts were inspected.
      const freshRuns = await runtime.processRuns(repo, [first.issue]);
      const second = await runtime.snapshot(repo, freshRuns, first.issue);
      const confirmed = decideReconciliation({ ...second, now: Date.now() });
      const confirmedKey = reconciliationKey(second.issue, second.request, confirmed);
      if (confirmed.action === decision.action && confirmedKey === key && !alreadyReported(second.issue, key)) {
        try {
          await runtime.applyDecision({ repo, issue: second.issue, request: second.request, decision: confirmed, key });
          record.applied = true;
          mutations++;
        } catch (error) {
          record.error = error instanceof Error ? error.message : String(error);
          failures++;
        }
      } else {
        record.reason = `state changed before write: ${confirmed.action}/${confirmed.reason}`;
        record.action = 'noop';
      }
    }
    records.push(record);
  }
  return {
    schema: 'houseplan-process-reconcile/v1',
    generatedAt: new Date(now).toISOString(),
    repo,
    apply,
    counts: records.reduce((out, row) => ({ ...out, [row.action]: (out[row.action] || 0) + 1 }), {}),
    mutations,
    failures,
    records,
  };
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (name, fallback = '') => {
    const eq = args.find((arg) => arg.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? (args[index + 1] || 'true') : fallback;
  };
  const repo = value('repo', process.env.GITHUB_REPOSITORY || 'Matysh/houseplan-card');
  const apply = value('apply', 'false') === 'true';
  const maxActions = Number(value('max-actions', '5'));
  const output = value('output', '');
  reconcileAll({ repo, apply, maxActions }).then((summary) => {
    const body = `${JSON.stringify(summary, null, 2)}\n`;
    if (output) {
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, body);
    }
    process.stdout.write(`${JSON.stringify({ schema: summary.schema, counts: summary.counts, mutations: summary.mutations, failures: summary.failures })}\n`);
    if (summary.failures) process.exitCode = 1;
  }).catch((error) => {
    console.error(`process-reconcile: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exitCode = 2;
  });
}
