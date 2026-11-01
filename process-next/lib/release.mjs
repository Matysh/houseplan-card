import { checkedRef, GitAdapter, sha256 } from './github.mjs';
import { readFile } from 'node:fs/promises';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const copy = value => structuredClone(value);
export function initialReleaseState({ beta = null, stable = null } = {}) {
  return { schema: 1, revision: 0, active: null, candidates: {}, published: { beta, stable }, events: {} };
}
function requirements(value) {
  if (!Array.isArray(value) || !value.length || value.some(item => !item?.id || !item.inputsDigest)
    || new Set(value.map(item => item.id)).size !== value.length) throw Error('Explicit unique test requirements are needed');
  return copy(value);
}
export function releaseReadiness(candidate) {
  const missing = candidate.requirements.filter(item => item.blocking !== false
    && (candidate.results[item.id]?.status !== 'passed' || candidate.results[item.id]?.inputsDigest !== item.inputsDigest)).map(item => item.id);
  const reasons = [...(candidate.running ? ['run-in-progress'] : []), ...(missing.length ? ['required-cases-incomplete'] : []),
    ...(candidate.reviewRequired && candidate.review?.sha !== candidate.sha ? ['fix-review-required'] : []),
    ...(candidate.kind === 'beta' && (!candidate.metrics || candidate.metrics.sha !== candidate.sha || candidate.metrics.needsMeasurement === true) ? ['metrics-report-required'] : []),
    ...(candidate.kind === 'beta' && candidate.metrics?.requiresDecision && candidate.metricsAcceptedSha !== candidate.sha ? ['owner-metrics-decision'] : [])];
  return { ready: !reasons.length, reasons, missing };
}

/** Results are carried only when their declared relevant-input identity still matches.
 * The runner supplies identities/results; this lifecycle never fabricates test outcomes.
 */
export function reduceRelease(previous, event) {
  if (previous.schema !== 1 || typeof event?.id !== 'string' || !event.id) throw Error('Invalid release event');
  const signature = sha256(JSON.stringify(event));
  if (previous.events[event.id]) {
    if (previous.events[event.id] !== signature) throw Error('Delivery ID reused with another payload');
    return copy(previous);
  }
  const state = copy(previous);
  const candidate = () => {
    const item = state.candidates[event.candidate];
    if (!item) throw Error('Unknown candidate');
    return item;
  };
  const editable = item => {
    if (item.running || ['publishing', 'published'].includes(item.status)) throw Error('Candidate is immutable while running/publishing or after publication');
  };
  switch (event.type) {
    case 'create': {
      if (state.active) throw Error(event.kind === 'hotfix' ? 'Stop the current release run and put the fix into that release' : 'A release is already being prepared');
      if (!['beta', 'stable', 'hotfix'].includes(event.kind) || !event.candidate || state.candidates[event.candidate]
        || !sha(event.sourceSha)) throw Error('Invalid candidate');
      checkedRef(event.branch);
      const source = event.kind === 'stable' ? state.published.beta : event.kind === 'hotfix' ? state.published.stable : null;
      if (event.kind !== 'beta' && (!source || source.sha !== event.sourceSha)) throw Error('Stable starts at the published beta; hotfix starts at the published stable');
      const needed = requirements(event.requirements), sourceResults = event.kind === 'stable' ? source.results ?? {} : {};
      const results = Object.fromEntries(needed.filter(item => sourceResults[item.id]?.status === 'passed'
        && sourceResults[item.id].inputsDigest === item.inputsDigest).map(item => [item.id, { ...copy(sourceResults[item.id]), reused: true }]));
      state.candidates[event.candidate] = { id: event.candidate, kind: event.kind, branch: event.branch,
        sourceSha: event.sourceSha, sha: event.sourceSha, requirements: needed, results, running: null, status: 'prepared',
        includedIssues: copy(event.includedIssues ?? []), reviewRequired: event.kind === 'hotfix', review: null,
        metrics: null, metricsAcceptedSha: null, portToDev: [], diagnostics: [] };
      state.active = event.candidate; break;
    }
    case 'run-started': {
      const item = candidate(); editable(item);
      if (state.active !== item.id || event.sha !== item.sha || !event.runId || !Array.isArray(event.cases) || !event.cases.length
        || new Set(event.cases).size !== event.cases.length || event.cases.some(id => !item.requirements.some(req => req.id === id))) throw Error('Invalid immutable candidate run');
      item.running = { id: event.runId, sha: item.sha, cases: [...event.cases] }; item.status = 'testing'; break;
    }
    case 'run-finished': {
      const item = candidate(), run = item.running;
      if (!run || run.id !== event.runId || run.sha !== event.sha || event.sha !== item.sha || !Array.isArray(event.results)
        || new Set(event.results.map(row => row.id)).size !== event.results.length) throw Error('Run result identity differs');
      if (event.results.some(row => !run.cases.includes(row.id) || !['passed', 'failed', 'cancelled', 'not-started', 'environment-error'].includes(row.status))) throw Error('Invalid case result');
      for (const id of run.cases) {
        const req = item.requirements.find(row => row.id === id), result = event.results.find(row => row.id === id);
        if (result && result.inputsDigest !== req.inputsDigest) throw Error('Test inputs differ');
        item.results[id] = { ...(result ?? { id, inputsDigest: req.inputsDigest, status: 'not-started' }), sha: item.sha, runId: run.id, reused: false };
      }
      item.running = null; item.status = 'results'; break;
    }
    case 'fix': {
      const item = candidate(); editable(item);
      if (state.active !== item.id || !sha(event.sha) || event.sha === item.sha) throw Error('A fix needs a new immutable candidate');
      const needed = requirements(event.requirements);
      item.results = Object.fromEntries(needed.filter(req => item.results[req.id]?.status === 'passed'
        && item.results[req.id].inputsDigest === req.inputsDigest).map(req => [req.id, { ...item.results[req.id], reused: true }]));
      item.portToDev.push({ from: item.sha, to: event.sha, status: 'pending' });
      item.sha = event.sha; item.requirements = needed; item.reviewRequired = event.productChanged !== false;
      item.review = null; item.metrics = null; item.metricsAcceptedSha = null; item.status = 'prepared'; break;
    }
    case 'review-accepted': {
      const item = candidate(); editable(item);
      if (event.sha !== item.sha || !event.report) throw Error('Review must identify this candidate');
      item.review = { sha: item.sha, report: event.report }; break;
    }
    case 'metrics': {
      const item = candidate(); editable(item);
      if (event.sha !== item.sha || typeof event.report?.requiresDecision !== 'boolean') throw Error('Metrics report must identify this candidate');
      item.metrics = { ...copy(event.report), sha: item.sha }; break;
    }
    case 'accept-metrics': {
      const item = candidate(); editable(item);
      if (event.sha !== item.sha || !item.metrics || item.metrics.needsMeasurement === true || !event.ownerDecision) throw Error('An explicit owner decision requires measurements for this candidate');
      item.metricsAcceptedSha = item.sha; item.metricsDecision = copy(event.ownerDecision); break;
    }
    case 'diagnostic': {
      const item = candidate();
      item.diagnostics.push(copy(event.result)); break; // converter failures never become main-product blockers
    }
    case 'publication-started': {
      const item = candidate(); editable(item);
      const ready = releaseReadiness(item);
      if (!ready.ready) throw Error(`Candidate is not ready: ${ready.reasons.join(', ')}`);
      if (event.sha !== item.sha || typeof event.tag !== 'string' || !event.tag) throw Error('Publish the checked candidate');
      item.tag = event.tag; item.status = 'publishing'; break;
    }
    case 'publication-failed': {
      const item = candidate();
      if (item.status !== 'publishing' || event.sha !== item.sha) throw Error('No matching publication');
      item.status = 'publication-retry'; item.publicationError = event.reason ?? 'publication failed'; break;
    }
    case 'published': {
      const item = candidate();
      if (item.status !== 'publishing' || event.sha !== item.sha || event.evidence?.tag !== item.tag
        || event.evidence?.sha !== item.sha || !/^[a-f0-9]{64}$/.test(event.evidence?.artifactDigest ?? '')) throw Error('Actual publication evidence required');
      item.status = 'published'; item.publication = copy(event.evidence);
      const record = { id: item.id, sha: item.sha, tag: item.tag, branch: item.branch, results: copy(item.results) };
      if (item.kind === 'beta') {
        item.retiredBeta = state.published.beta?.branch ?? null; state.published.beta = record;
      } else state.published.stable = record;
      state.active = null; break;
    }
    case 'delivery-verified': {
      const item = candidate();
      if (item.status !== 'published' || event.evidence?.hacsAvailable !== true
        || event.evidence?.artifactDigest !== item.publication.artifactDigest || event.evidence?.tag !== item.tag) throw Error('Separate HACS and artifact observations required');
      item.delivery = copy(event.evidence); break;
    }
    case 'port-completed': {
      const item = candidate(), port = item.portToDev.find(row => row.to === event.fixSha);
      if (!port || !sha(event.devSha)) throw Error('Unknown addressed fix');
      port.status = 'ported'; port.devSha = event.devSha; break;
    }
    case 'abandon': {
      const item = candidate(); editable(item);
      item.status = 'abandoned'; if (state.active === item.id) state.active = null; break;
    }
    default: throw Error(`Unknown release event: ${event.type}`);
  }
  state.events[event.id] = signature; state.revision++; return state;
}

/** A plan only: status must come from current issue state, never from inclusion alone. */
export function releaseClosePlan(candidate, issues) {
  if (candidate.status !== 'published' || !candidate.delivery) return [];
  const included = new Set(candidate.includedIssues);
  return issues.filter(issue => included.has(issue.number) && issue.state !== 'closed'
    && issue.labels.some(label => (typeof label === 'string' ? label : label.name) === 'S8-merged'))
    .map(issue => ({ issue: issue.number, change: { state: 'closed', state_reason: 'completed' } }));
}

export class ReleaseGitAdapter extends GitAdapter {
  async resolveSource({ kind, published }) {
    const sourceSha = kind === 'beta' ? await this.remoteHead(this.dev)
      : kind === 'stable' ? published?.beta?.sha : kind === 'hotfix' ? published?.stable?.sha : null;
    if (!sha(sourceSha)) throw Error('Release source is not available');
    return { kind, sourceSha, reference: kind === 'beta' ? this.dev : kind === 'stable' ? published.beta.tag : published.stable.tag };
  }
  async prepareCandidate({ sourceSha, branch, worktree }) {
    if (!sha(sourceSha)) throw Error('Candidate requires a resolved immutable source'); checkedRef(branch);
    if (!branch.startsWith('release/')) throw Error('Use an isolated release/ branch');
    const args = ['worktree', 'add', '-b', branch, worktree, sourceSha];
    if (!this.activated) return { planned: true, command: ['git', ...args], sourceSha };
    await this.ensureCommit(sourceSha);
    await this.git(args); return { created: true, branch, sha: sourceSha, worktree };
  }
  async fixPortPlan({ from, to }) {
    await this.assertAncestor(from, to);
    const commits = (await this.git(['rev-list', '--reverse', `${from}..${to}`])).split('\n').filter(Boolean);
    return { planned: true, destination: this.dev, commits, commands: commits.map(commit => ['git', 'cherry-pick', commit]),
      note: 'Apply only these fixes through the task queue; never merge current dev into the release candidate' };
  }
}

/** Publication is separate from execution. Retrying it never invokes a test runner. */
export class ReleasePublisher {
  constructor({ github, git, activated = false, readArtifact = readFile } = {}) {
    Object.assign(this, { github, git, activated, readArtifact });
  }
  async publish({ candidate, tag = candidate?.tag, artifacts, body = '', expectedMain } = {}) {
    const ready = releaseReadiness(candidate);
    if (!ready.ready) throw Error(`Candidate is not ready: ${ready.reasons.join(', ')}`);
    checkedRef(tag);
    if (!sha(candidate.sha) || !Array.isArray(artifacts) || !artifacts.length
      || new Set(artifacts.map(item => item.name)).size !== artifacts.length
      || artifacts.some(item => !/^[\w.-]+$/.test(item.name ?? '') || !/^[a-f0-9]{64}$/.test(item.expectedDigest ?? '') || !item.path))
      throw Error('Prepared named artifacts with expected digests are required');
    if (!this.activated) return { planned: true, candidate: candidate.id, sha: candidate.sha, tag, kind: candidate.kind,
      artifacts: artifacts.map(({ name, path, expectedDigest }) => ({ name, path, expectedDigest })),
      operations: ['create or reuse draft', 'upload missing identical prepared artifacts', 'publish exact refs (main fast-forward only)', 'publish draft', 'verify tag and downloads'],
      delivery: 'HACS observation is a separate required observation; GitHub publication does not prove it' };
    if (!this.github.activated || !this.git.activated) throw Error('Both publishing adapters must be explicitly activated');
    await this.git.publishCandidateRefs({ materialSha: candidate.sha, tag, kind: candidate.kind, expectedMain, checkOnly: true });
    const prepared = [];
    for (const artifact of artifacts) {
      const bytes = await this.readArtifact(artifact.path);
      if (sha256(bytes) !== artifact.expectedDigest) throw Error(`Prepared artifact changed: ${artifact.name}`);
      prepared.push({ ...artifact, bytes });
    }
    let release = await this.github.findRelease(tag);
    if (!release) release = await this.github.createDraftRelease({ tag, sourceSha: candidate.sha, prerelease: candidate.kind === 'beta', body });
    if (!release?.id || release.tag_name !== tag) throw Error('Release identity differs');
    for (const artifact of prepared) {
      const matches = (release.assets ?? []).filter(item => item.name === artifact.name);
      if (matches.length > 1) throw Error('Ambiguous release artifact');
      if (matches.length) {
        if (sha256(await this.github.downloadAsset(matches[0].id)) !== artifact.expectedDigest) throw Error(`Existing release artifact differs: ${artifact.name}`);
      } else {
        if (!release.draft) throw Error('Published release is incomplete; do not silently replace its assets');
        await this.github.uploadReleaseAsset(release.id, artifact);
      }
    }
    await this.git.publishCandidateRefs({ materialSha: candidate.sha, tag, kind: candidate.kind, expectedMain });
    if (release.draft) release = await this.github.updateRelease(release.id, { draft: false, prerelease: candidate.kind === 'beta' });
    const evidence = [];
    for (const artifact of prepared) evidence.push(await this.github.verifyPublication({ tag, expectedSha: candidate.sha,
      assetName: artifact.name, expectedDigest: artifact.expectedDigest }));
    return { published: true, sha: candidate.sha, tag, evidence: evidence[0], artifacts: evidence, deliveryPending: true };
  }
}

/** Actual HACS read API, not a GitHub release masquerading as HACS evidence.
 * Source: hacs/integration custom_components/hacs/websocket/repositories.py.
 * Requires an explicitly configured HA admin token; does not refresh/install/change HACS settings.
 */
export class HacsClient {
  constructor({ url, token, WebSocketImpl = globalThis.WebSocket, timeoutMs = 15_000 } = {}) {
    const endpoint = new URL(url);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || !token) throw Error('Explicit HA URL/token required');
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:'; endpoint.pathname = '/api/websocket'; endpoint.search = ''; endpoint.hash = '';
    Object.assign(this, { endpoint: endpoint.href, token, WebSocketImpl, timeoutMs });
  }
  async repositories() {
    return new Promise((resolve, reject) => {
      const socket = new this.WebSocketImpl(this.endpoint); let done = false;
      const finish = (error, result) => { if (done) return; done = true; clearTimeout(timer); socket.close(); error ? reject(error) : resolve(result); };
      const timer = setTimeout(() => finish(Error('HACS observation timed out')), this.timeoutMs);
      socket.addEventListener('error', () => finish(Error('HACS connection failed')));
      socket.addEventListener('close', () => { if (!done) finish(Error('HACS connection closed before its result')); });
      socket.addEventListener('message', event => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'auth_required') socket.send(JSON.stringify({ type: 'auth', access_token: this.token }));
          else if (message.type === 'auth_ok') socket.send(JSON.stringify({ id: 1, type: 'hacs/repositories/list', categories: ['integration'] }));
          else if (message.type === 'auth_invalid') finish(Error('HACS authentication refused'));
          else if (message.type === 'result' && message.id === 1) {
            if (!message.success || !Array.isArray(message.result)) finish(Error('HACS repository observation failed'));
            else finish(null, message.result);
          }
        } catch { finish(Error('Invalid HACS response')); }
      });
    });
  }
}

export class HacsDeliveryVerifier {
  constructor({ hacs, github }) { Object.assign(this, { hacs, github }); }
  async verify({ repository, tag, assetName, expectedDigest }) {
    if (!/^[a-f0-9]{64}$/.test(expectedDigest ?? '')) throw Error('Expected artifact SHA-256 required');
    if (repository.toLowerCase() !== `${this.github.owner}/${this.github.repo}`.toLowerCase()) throw Error('HACS and GitHub repository identities differ');
    const rows = await this.hacs.repositories();
    const row = rows.find(item => item.full_name?.toLowerCase() === repository.toLowerCase());
    if (!row || row.available_version !== tag || row.can_download !== true) throw Error('This release is not observed as downloadable in HACS');
    const release = await this.github.getRelease(tag);
    if (release.draft || release.tag_name !== tag) throw Error('Published release unavailable');
    const assets = release.assets.filter(asset => asset.name === assetName);
    if (assets.length !== 1) throw Error('Expected release artifact missing or ambiguous');
    const bytes = await this.github.downloadAsset(assets[0].id), actual = sha256(bytes);
    if (actual !== expectedDigest) throw Error('Downloaded release artifact differs');
    return { hacsAvailable: true, tag, artifactDigest: actual, assetName, bytes: bytes.length,
      hacsRepositoryId: row.id, observedAt: new Date().toISOString() };
  }
}
