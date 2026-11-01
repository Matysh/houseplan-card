import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listZipEntries, readZipEntries } from './zip.mjs';
import { normalizeFallbackRequest } from '../templates/prepare-fallback.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const terminal = reason => ({ outcome: 'unavailable', terminal: true, reason });
const transient = error => error.status === undefined || error.status === 429 || error.status >= 500;
const sleep = (ms, signal) => new Promise(resolve => {
  if (signal?.aborted) return resolve();
  const timer = setTimeout(done, ms);
  function done() { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); }
  signal?.addEventListener('abort', done, { once: true });
});

export function fallbackRequest({ active, task, request = {} }) {
  if (!Number.isSafeInteger(active?.issue) || active.issue < 1 || !/^[a-f0-9]{40}$/.test(active.materialSha ?? '')) throw Error('Hosted S6 requires the admitted issue and immutable SHA');
  const profile = { ...request, event: 'task', issue: active.issue, track: task.track ?? 'show', layer: task.layer,
    changedFiles: task.changedFiles ?? [], areaTests: request.areaTests ?? [] };
  // The same profile is materialized in CI; local roots and authority flags never cross over.
  for (const field of ['root', 'ownerAssigned', 'e2eRoot', 'e2eWorkRoot', 'workRoot', 'candidateRoot', 'targetRef', 'port']) delete profile[field];
  normalizeFallbackRequest(profile, { workspace: '/github/workspace', candidate: active.materialSha });
  const requestId = `s6:${active.issue}:${createHash('sha256').update(JSON.stringify(canonical({ sha: active.materialSha, profile }))).digest('hex').slice(0, 32)}`;
  const phase = profile.phase === 'after-review' ? 'правки после ревью' : profile.phase === 'before-merge' || profile.track === 'ship' ? 'перед слиянием' : 'перед ревью';
  return { requestId, profile, title: `Тесты для задачи #${active.issue} (${phase})` };
}

/** Hosted execution uses the ordinary runner's report. No local test, extra result store
 * or arbitrary remote command is introduced; Actions retains retry/run identity.
 */
export class WorkflowFallbackAdapter {
  constructor({ api, workflow = 'process-next-fallback.yml', ref = 'dev', pollMs = 60000,
    maxWaitMs = 60 * 60_000, maxPages = 5, clock = Date.now, sleep: wait = sleep, readArtifact } = {}) {
    if (!/^[\w.-]+\.ya?ml$/.test(workflow) || typeof ref !== 'string' || !ref) throw Error('Fallback workflow/ref required');
    if (!Number.isFinite(pollMs) || pollMs < 30000 || pollMs > 60000 || !Number.isFinite(maxWaitMs) || maxWaitMs <= 0) throw Error('Use a finite hosted wait with a 30–60 second polling interval');
    Object.assign(this, { api, workflow, ref, pollMs, maxWaitMs, maxPages, clock, sleep: wait, readArtifact });
  }
  async findRun(requestId) {
    const created = encodeURIComponent(`>=${new Date(this.clock() - 14 * 24 * 60 * 60_000).toISOString()}`);
    for (let page = 1; page <= this.maxPages; page++) {
      const data = await this.api.request('GET', `${this.api.root}/actions/workflows/${encodeURIComponent(this.workflow)}/runs?event=workflow_dispatch&branch=${encodeURIComponent(this.ref)}&created=${created}&per_page=100&page=${page}`);
      if (!Array.isArray(data.workflow_runs)) throw Error('Invalid hosted run inventory');
      const runs = data.workflow_runs.filter(run => (run.display_title ?? '').endsWith(` · ${requestId}`));
      if (runs.length > 1) throw Error('Several hosted runs claim the same S6 request');
      if (runs.length) return runs[0];
      if (data.workflow_runs.length < 100) return null;
    }
    throw Error('Hosted run inventory incomplete; do not dispatch an uncertain duplicate');
  }
  async readReport(run) {
    const response = await this.api.request('GET', `${this.api.root}/actions/runs/${run.id}/artifacts?per_page=100`);
    if (!Array.isArray(response.artifacts) || response.total_count > 100) throw Error('Incomplete hosted artifact inventory');
    const artifacts = response.artifacts.filter(row => row.name === 'process-next-result' && !row.expired);
    if (artifacts.length > 1) throw Error('Ambiguous hosted result artifacts');
    if (!artifacts.length) return null;
    const artifact = artifacts[0];
    if (this.readArtifact) return this.readArtifact(artifact, run);
    const directory = await mkdtemp(join(tmpdir(), 'hp-fallback-result-'));
    try {
      const archive = join(directory, 'result.zip');
      await writeFile(archive, await this.api.request('GET', `${this.api.root}/actions/artifacts/${artifact.id}/zip`, undefined, { binary: true }));
      const names = listZipEntries(archive).filter(name => /^process-next\/\.state\/runs\/[^/]+\/report\.json$/.test(name));
      if (names.length !== 1) throw Error('Expected exactly one completed runner report in hosted result');
      return JSON.parse(readZipEntries(archive, names).get(names[0]).toString('utf8'));
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  result(report, run, active, requestId) {
    if (report.schema !== 1 || !report.id || report.materialSha !== active.materialSha || report.materialClean !== true
      || report.issue !== active.issue || report.event !== 'task' || !report.finishedAt || !Array.isArray(report.results))
      return terminal('Hosted report does not identify this completed, clean S6 candidate');
    const required = report.results.filter(row => !row.diagnostic);
    const passed = report.status === 'passed' && required.length > 0 && required.every(row => ['passed', 'reused', 'not-required'].includes(row.status));
    const receipt = { id: report.id, requestId, runId: run.id, materialSha: report.materialSha, status: report.status,
      finishedAt: report.finishedAt, reportUrl: run.html_url, execution: 'github' };
    return { outcome: passed ? 'passed' : 'failed', receipt, evidence: receipt };
  }
  async runS6({ active, task, request, signal, onProgress = () => {} }) {
    if (['docs', 'documentation'].includes(task.layer)) return { outcome: 'not-required' };
    let selected;
    try { selected = fallbackRequest({ active, task, request }); }
    catch (error) { return terminal(`Hosted S6 request is invalid: ${error.message}`); }
    const { requestId, title, profile } = selected, started = this.clock();
    let run, dispatched = false, dispatchUncertain = false, failures = 0, retryRequested = false, retryRequestedAt;
    while (!signal?.aborted && this.clock() - started < this.maxWaitMs) {
      try {
        run = run ? await this.api.request('GET', `${this.api.root}/actions/runs/${run.id}`) : await this.findRun(requestId);
        if (!run && !dispatched) {
          dispatched = true;
          try {
            const sent = await this.api.request('POST', `${this.api.root}/actions/workflows/${encodeURIComponent(this.workflow)}/dispatches`,
              { ref: this.ref, inputs: { candidate: active.materialSha, title, requestId, request: JSON.stringify(profile) } });
            if (sent?.planned) return terminal('Hosted workflow dispatch is disabled');
          } catch (error) {
            if (!transient(error)) throw error;
            dispatchUncertain = true; // Observe first: dispatch has no idempotency key.
          }
        } else if (!run && dispatchUncertain) return terminal('Hosted dispatch response was lost and no matching run appeared; inspect Actions before retrying');
        if (run?.status === 'completed') {
          const report = await this.readReport(run);
          if (report) return this.result(report, run, active, requestId); // A failed test is never retried as transport.
          if (['success', 'skipped', 'cancelled'].includes(run.conclusion)) return terminal('Hosted run completed or was cancelled without a runner report');
          // The rerun can be accepted while the API still exposes the completed first attempt.
          const awaitingVisibility = retryRequested && Number(run.run_attempt ?? 1) < 2 && this.clock() - retryRequestedAt < 120000;
          if (!awaitingVisibility) {
            if (retryRequested || Number(run.run_attempt ?? 1) >= 2) return terminal('Hosted preparation failed after its one automatic retry; inspect the linked Actions run');
            retryRequested = true; retryRequestedAt = this.clock();
            await this.api.request('POST', `${this.api.root}/actions/runs/${run.id}/rerun-failed-jobs`);
          }
        }
        failures = 0;
        onProgress({ kind: 'checks', run: title, status: run?.status ?? 'dispatching', requestId,
          reportUrl: run?.html_url, elapsedMs: this.clock() - started });
      } catch (error) {
        if (!transient(error) || ++failures > 1) return terminal(`Hosted S6 unavailable: ${error.message}${[401,403,404].includes(error.status) ? '; check Actions write permission and workflow activation' : ''}`);
        onProgress({ kind: 'checks', run: title, status: 'transport-retry', reason: error.message, requestId });
      }
      await this.sleep(Math.min(this.pollMs, this.maxWaitMs - (this.clock() - started)), signal);
    }
    return { ...terminal(signal?.aborted ? 'Hosted S6 wait interrupted; its existing run remains discoverable' : 'Hosted S6 wait limit reached; inspect the existing run before continuing'), requestId, reportUrl: run?.html_url };
  }
}
