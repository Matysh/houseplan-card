import { checkedRef, GitAdapter, sha256 } from './github.mjs';
import { readFile } from 'node:fs/promises';
import { membershipIssueNumbers } from './release-data.mjs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const copy = value => structuredClone(value);
export const isDeliveryObserved = evidence => evidence?.hacsAvailable === true
  || evidence?.discoveryAvailable === true && evidence.source === 'github-release-feed';
export function initialReleaseState({ beta = null, stable = null } = {}) {
  return { schema: 1, revision: 0, active: null, candidates: {}, shipReviews: {}, published: { beta, stable }, events: {} };
}
export async function readRunnerReport(path) {
  const report = JSON.parse(await readFile(path, 'utf8'));
  return { ...report, reportPath: path };
}
export function normalizeMetricsDecision(value) {
  if (!value || !['chat', 'manual'].includes(value.source)
    || !['decisionId', 'sourceRef', 'decisionText'].every(key => typeof value[key] === 'string' && value[key].trim() && value[key].length <= 2048))
    throw Error('Explicit metrics decision requires decisionId, chat/manual source, sourceRef and decisionText; actor/login is not authority');
  return { decisionId: value.decisionId, source: value.source, sourceRef: value.sourceRef, decisionText: value.decisionText,
    ...(value.recordedBy ? { recordedBy: String(value.recordedBy).slice(0, 120) } : {}) };
}
function publicRunnerCheck(row) {
  const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
  const id = identifier(row.id) ? row.id : 'unknown';
  const counts = Object.fromEntries(['tests', 'passed', 'failed', 'skipped', 'cancelled', 'todo']
    .filter(key => Number.isSafeInteger(row.counts?.[key]) && row.counts[key] >= 0).map(key => [key, row.counts[key]]));
  // Publish only result facts. Commands, logs, paths, environment and errors stay
  // in the local runner report, which continues to decide release readiness.
  return { id, name: typeof row.name === 'string' && row.name.trim() ? row.name.replace(/[\x00-\x1f]/g, ' ').slice(0, 500) : id,
    status: ['passed', 'reused', 'not-required', 'failed', 'cancelled', 'timed-out', 'unavailable', 'invalidated', 'blocked', 'error'].includes(row.status) ? row.status : 'unknown',
    diagnostic: Boolean(row.diagnostic), ...(Object.keys(counts).length ? { counts } : {}),
    ...(identifier(row.sourceRun) ? { sourceRun: row.sourceRun } : {}) };
}
function runnerReceipt(report, candidate) {
  if (!report?.id || report.schema !== 1 || report.materialSha !== candidate.sha || typeof report.materialClean !== 'boolean' || report.event !== candidate.kind
    || !report.finishedAt || !report.reportPath || !Array.isArray(report.results) || report.status === 'running')
    throw Error('A completed runner report for this exact candidate and release profile is required');
  const required = report.results.filter(row => !row.diagnostic);
  const failed = required.filter(row => !['passed', 'reused', 'not-required'].includes(row.status)).map(row => row.id);
  // One report is the authority; no second per-case store or independently declared requirements.
  return { id: report.id, sha: report.materialSha, event: report.event, status: report.status,
    path: report.reportPath, digest: sha256(JSON.stringify(report)), finishedAt: report.finishedAt,
    materialClean: report.materialClean, ...(report.materialClean ? {} : { reason: 'dirty-material' }),
    ready: report.materialClean && report.status === 'passed' && required.length > 0 && failed.length === 0,
    required: required.length, failed, reused: required.filter(row => row.status === 'reused').length,
    checks: report.results.map(publicRunnerCheck) };
}
export function releaseReadiness(candidate) {
  // Resume an already-started publication without adding the ship review introduced later.
  // A fix returns to prepared and must meet the current beta requirements again.
  const reasons = [...(candidate.running ? ['run-in-progress'] : []),
    ...(candidate.runner?.materialClean === false ? ['dirty-material'] : []),
    ...(!candidate.runner?.ready || candidate.runner.sha !== candidate.sha || candidate.runner.event !== candidate.kind ? ['runner-report-required'] : []),
    ...(candidate.reviewRequired && candidate.review?.sha !== candidate.sha ? ['fix-review-required'] : []),
    ...(candidate.kind === 'beta' && !['publishing', 'publication-retry', 'published'].includes(candidate.status)
      && (candidate.shipReview?.sha !== candidate.sha
      || candidate.shipReview?.inventoryComplete !== true
      || !['accepted', 'not-required'].includes(candidate.shipReview?.status)) ? ['ship-review-required'] : []),
    ...(candidate.kind === 'beta' && (!candidate.metrics || candidate.metrics.sha !== candidate.sha) ? ['metrics-report-required'] : []),
    ...(candidate.kind === 'beta' && candidate.metrics?.requiresDecision && candidate.metricsAcceptedSha !== candidate.sha ? ['owner-metrics-decision'] : [])];
  return { ready: !reasons.length, reasons, report: candidate.runner ?? null };
}

/** Runner owns case selection, reuse and outcomes. State retains its receipt and public result summary. */
export function reduceRelease(previous, event) {
  if (previous.schema !== 1 || typeof event?.id !== 'string' || !event.id) throw Error('Invalid release event');
  const signature = sha256(JSON.stringify(event));
  if (previous.events[event.id]) {
    if (previous.events[event.id] !== signature) throw Error('Delivery ID reused with another payload');
    return copy(previous);
  }
  const state = copy(previous);
  state.shipReviews ??= {};
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
      const sourceReview = source?.shipReview ?? state.candidates[source?.id]?.shipReview;
      state.candidates[event.candidate] = { id: event.candidate, kind: event.kind, branch: event.branch,
        sourceSha: event.sourceSha, sha: event.sourceSha, runner: null, running: null, status: 'prepared',
        membership: event.membership ? copy(event.membership) : null,
        includedIssues: event.membership ? membershipIssueNumbers(event.membership, event.sourceSha) : [], reviewRequired: event.kind === 'hotfix', review: null,
        metrics: null, metricsAcceptedSha: null, portToDev: [], diagnostics: [],
        ...(event.kind === 'stable' && sourceReview ? { shipReview: copy(sourceReview) } : {}) };
      state.active = event.candidate; break;
    }
    case 'run-started': {
      const item = candidate(); editable(item);
      if (state.active !== item.id || event.sha !== item.sha) throw Error('Invalid immutable candidate run');
      item.running = { id: event.runId ?? null, sha: item.sha }; item.status = 'testing'; break;
    }
    case 'runner-report': {
      const item = candidate(), run = item.running;
      if (['publishing', 'published'].includes(item.status) || state.active !== item.id
        || run && (run.sha !== item.sha || run.id && run.id !== event.report?.id)) throw Error('Run result identity differs');
      item.runner = runnerReceipt(event.report, item);
      item.running = null; item.status = 'results'; break;
    }
    case 'fix': {
      const item = candidate(); editable(item);
      if (state.active !== item.id || !sha(event.sha) || event.sha === item.sha) throw Error('A fix needs a new immutable candidate');
      item.portToDev.push({ from: item.sha, to: event.sha, syncMode: 'merge', status: 'pending' });
      item.sha = event.sha; item.runner = null; item.reviewRequired = event.productChanged !== false;
      item.membership = event.membership ? copy(event.membership) : null;
      item.includedIssues = event.membership ? membershipIssueNumbers(event.membership, event.sha) : [];
      delete item.releaseData;
      if (item.kind === 'beta') delete item.shipReview;
      item.review = null; item.metrics = null; item.metricsAcceptedSha = null; item.status = 'prepared'; break;
    }
    case 'ship-review-prepared': {
      const packet = event.packet, item = state.candidates[packet?.candidateId];
      if (!item || item.kind !== 'beta' || state.active !== item.id) throw Error('Ship review belongs to an active beta candidate');
      // Freezing review metadata does not change the material being tested.
      if (['publishing', 'published'].includes(item.status)) throw Error('Candidate review is immutable during or after publication');
      if (packet.schema !== 1 || packet.head !== item.sha || packet.base !== null && !sha(packet.base)
        || typeof packet.requestId !== 'string' || !packet.requestId
        || typeof packet.selectionDigest !== 'string' || !packet.selectionDigest
        || !Array.isArray(packet.tasks) || !Array.isArray(packet.pending) || !Array.isArray(packet.reused))
        throw Error('Ship review packet must identify the current candidate and complete task selection');
      const saved = state.shipReviews[packet.requestId];
      if (saved && ['candidateId', 'base', 'head', 'selectionDigest', 'version'].some(key => saved.packet[key] !== packet[key]))
        throw Error('Ship review request ID reused for another selection');
      // The first packet freezes issue text and selection for retries of this review.
      state.shipReviews[packet.requestId] ??= { packet: copy(packet), result: null };
      item.shipReview = { sha: packet.head, requestId: packet.requestId, selectionDigest: packet.selectionDigest,
        status: saved?.result?.verdict ?? 'pending', inventoryComplete: true };
      break;
    }
    case 'ship-review-result': {
      const item = candidate(), record = state.shipReviews[event.requestId], result = event.result;
      const packet = record?.packet;
      if (!packet || packet.candidateId !== item.id || item.kind !== 'beta'
        || result?.kind !== 'ship-batch' || result.requestId !== event.requestId
        || result.candidateId !== packet.candidateId || result.materialSha !== packet.head
        || result.base !== packet.base || result.selectionDigest !== packet.selectionDigest
        || !(packet.pending.length ? ['accepted', 'incomplete', 'changes_requested'] : ['not-required']).includes(result.verdict))
        throw Error('Ship review result must identify its frozen packet and valid verdict');
      record.result = copy(result);
      // A late result remains reusable, but must not authorize a newer candidate.
      if (item.sha === packet.head && item.shipReview?.requestId === event.requestId
        && item.shipReview.selectionDigest === packet.selectionDigest) item.shipReview.status = result.verdict;
      break;
    }
    case 'release-prepared': {
      const item = candidate(), data = event.data;
      const included = membershipIssueNumbers(data?.membership, item.sha);
      if (event.sha !== item.sha || typeof data.body !== 'string' || !data.body.trim()) throw Error('Prepared release data must describe this candidate and contain authored notes');
      if (item.status === 'published' || item.status === 'publishing') {
        if (JSON.stringify(item.releaseData) !== JSON.stringify(data)) throw Error('Published release data is immutable');
        break;
      }
      if (item.running) throw Error('Do not change release data while its candidate is running');
      item.releaseData = copy(data); item.membership = copy(data.membership); item.includedIssues = included; break;
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
      if (event.sha !== item.sha || !item.metrics || !event.ownerDecision) throw Error('An explicit owner decision requires the report for this candidate');
      item.metricsDecision = normalizeMetricsDecision(event.ownerDecision); item.metricsAcceptedSha = item.sha; break;
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
      const record = { id: item.id, sha: item.sha, tag: item.tag, branch: item.branch, runner: copy(item.runner),
        ...(item.shipReview ? { shipReview: copy(item.shipReview) } : {}) };
      if (item.kind === 'beta') {
        item.retiredBeta = state.published.beta ? copy(state.published.beta) : null; state.published.beta = record;
      } else {
        state.published.stable = record;
        const port = item.portToDev.find(row => row.to === item.sha);
        if (port) Object.assign(port, { tag: item.tag, syncMode: 'merge' });
        else item.portToDev.push({ to: item.sha, tag: item.tag, syncMode: 'merge', status: 'pending' });
      }
      state.active = null; break;
    }
    case 'delivery-verified': {
      const item = candidate();
      if (item.status !== 'published' || !isDeliveryObserved(event.evidence)
        || event.evidence?.artifactDigest !== item.publication.artifactDigest || event.evidence?.tag !== item.tag) throw Error('Published release discovery and artifact observations required');
      item.delivery = copy(event.evidence); break;
    }
    case 'completion-step': {
      const item = candidate();
      if (item.status !== 'published' || !['issues', 'return-to-dev', 'retire-beta'].includes(event.name)
        || !event.result || !['running', 'completed', 'pending', 'not-required'].includes(event.result.status))
        throw Error('Completion records an actual published release side effect');
      if (event.name === 'return-to-dev' && event.result.status === 'completed') {
        if (!sha(event.result.devSha)) throw Error('Completed release return requires the actual dev commit');
        for (const port of item.portToDev ?? []) {
          if (port.status === 'ported') continue;
          if (port.to === item.sha) Object.assign(port, { status: 'ported', devSha: event.result.devSha });
          else Object.assign(port, { status: 'superseded', supersededBy: item.sha });
        }
      }
      item.completion ??= {}; item.completion[event.name] = copy(event.result); break;
    }
    case 'announcement': {
      const item = candidate();
      if (item.status !== 'published' || !event.receipt) throw Error('Announcement belongs to a published release');
      item.announcement = copy(event.receipt); break;
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
  const included = new Set(membershipIssueNumbers(candidate.membership, candidate.sha));
  return issues.filter(issue => included.has(issue.number) && issue.state !== 'closed'
    && issue.labels.some(label => (typeof label === 'string' ? label : label.name) === 'S8-merged'))
    .map(issue => ({ issue: issue.number, change: { state: 'closed', state_reason: 'completed' } }));
}

export class ReleaseGitAdapter extends GitAdapter {
  /** Reuse the published release's review only for its unmodified automatic return merge. */
  async publishedReturnReview({ task, expectedBase, materialSha, patchId }) {
    if (task?.syncMode !== 'merge' || !sha(task.mergeSourceSha) || !task.releaseTag
      || !sha(expectedBase) || !sha(materialSha) || typeof patchId !== 'string' || !patchId) return null;
    let tag;
    try { tag = checkedRef(task.releaseTag); } catch { return null; }
    const sourceSha = task.mergeSourceSha;
    const tags = (await this.git(['ls-remote', '--tags', this.remote, `refs/tags/${tag}`, `refs/tags/${tag}^{}`])).split('\n').filter(Boolean);
    const actualTag = (tags.find(row => row.endsWith('^{}')) ?? tags[0])?.split(/\s+/)[0];
    if (actualTag !== sourceSha) return null;
    for (const commit of [expectedBase, sourceSha, materialSha]) await this.ensureCommit(commit);
    try {
      await this.assertAncestor(sourceSha, materialSha); await this.assertAncestor(expectedBase, materialSha);
    } catch (error) {
      if (error.code === 1) return null;
      throw error;
    }
    let mergedTree;
    try {
      // This optional proof needs newer Git. Unsupported options, conflicts or any
      // merge-tree failure mean ordinary review, without blocking synchronization.
      mergedTree = (await this.git(['merge-tree', '--write-tree', expectedBase, sourceSha])).split('\n')[0];
    } catch { return null; }
    if (mergedTree !== await this.git(['rev-parse', `${materialSha}^{tree}`])) return null;
    return { source: 'published-release', sourceSha, tag, verdict: 'accepted', patchId, materialSha };
  }
  async resolveSource({ kind, published }) {
    const sourceSha = kind === 'beta' ? await this.remoteHead(this.dev)
      : kind === 'stable' ? published?.beta?.sha : kind === 'hotfix' ? published?.stable?.sha : null;
    if (!sha(sourceSha)) throw Error('Release source is not available');
    if (kind !== 'hotfix' && published?.stable?.sha) {
      await this.ensureCommit(sourceSha); await this.ensureCommit(published.stable.sha);
      try { await this.assertAncestor(published.stable.sha, sourceSha); }
      catch { throw Error('Return the published stable/hotfix tag to dev through the queue before preparing the next beta/stable'); }
    }
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
    return { planned: true, destination: this.dev, syncMode: 'merge', mergeSourceSha: to,
      commands: [['git', 'merge', '--no-ff', to]],
      note: 'Merge this exact release history into dev through the task queue; never rebase it or merge fresh dev into the release candidate' };
  }
  async prepareDevReturn({ candidate, issue, branch = `issue/${issue}-release-return-${candidate?.sha?.slice(0, 12)}`, worktree }) {
    if (candidate?.status !== 'published' || !sha(candidate.sha) || !candidate.tag || !Number.isSafeInteger(issue) || issue < 1)
      throw Error('Published candidate and a queue issue are required');
    checkedRef(branch); checkedRef(candidate.tag);
    if (!branch.startsWith('issue/')) throw Error('Use a separate issue/ return branch');
    const task = { issue, branch, layer: 'product', track: 'show', ownerAssigned: false,
      syncMode: 'merge', mergeSourceSha: candidate.sha, releaseTag: candidate.tag };
    if (!this.activated) return { planned: true, task, destination: this.dev, worktree,
      operations: ['verify immutable published tag', 'merge tag into an isolated branch from dev', 'push task branch',
        'enqueue S6 and merge; reuse published review for a clean automatic merge, review any new code or conflict resolution'] };
    const tags = (await this.git(['ls-remote', '--tags', this.remote, `refs/tags/${candidate.tag}`, `refs/tags/${candidate.tag}^{}`])).split('\n').filter(Boolean);
    const actualTag = (tags.find(row => row.endsWith('^{}')) ?? tags[0])?.split(/\s+/)[0];
    if (actualTag !== candidate.sha) throw Error('Published tag differs from the return material');
    const devSha = await this.remoteHead(this.dev);
    await this.ensureCommit(devSha); await this.ensureCommit(candidate.sha);
    let included = false;
    try { await this.assertAncestor(candidate.sha, devSha); included = true; } catch { /* merge below */ }
    if (included) return { alreadyIncluded: true, devSha, mergeSourceSha: candidate.sha };
    const remoteTask = await this.remoteHead(branch);
    if (remoteTask) {
      await this.ensureCommit(remoteTask); await this.assertAncestor(candidate.sha, remoteTask);
      return { prepared: true, reused: true, task: { ...task, materialSha: remoteTask } };
    }
    let head;
    try { head = await this.git(['rev-parse', '--verify', `refs/heads/${branch}`]); }
    catch { /* new worktree */ }
    if (head) await this.assertAncestor(candidate.sha, head);
    else {
      if (!worktree) throw Error('An isolated worktree path is required to prepare the return branch');
      await this.git(['worktree', 'add', '-b', branch, worktree, devSha]);
      await this.git(['-C', worktree, 'merge', '--no-ff', '-m', `Return published ${candidate.tag} to dev\n\nIssue: #${issue}\nRelease: ${candidate.tag}\nUser-Visible: no`, candidate.sha]);
      head = await this.git(['-C', worktree, 'rev-parse', 'HEAD']);
    }
    await this.assertAncestor(devSha, head); await this.assertAncestor(candidate.sha, head);
    // Creation only: an existing branch is never overwritten on a concurrent preparation.
    try { await this.git(['push', `--force-with-lease=refs/heads/${branch}:`, this.remote, `${head}:refs/heads/${branch}`]); }
    catch (error) { if (await this.remoteHead(branch) !== head) throw error; }
    return { prepared: true, task: { ...task, materialSha: head } };
  }
  async verifyDevReturn(sourceSha) {
    const devSha = await this.remoteHead(this.dev);
    await this.ensureCommit(sourceSha); await this.ensureCommit(devSha); await this.assertAncestor(sourceSha, devSha);
    return { sourceSha, devSha };
  }
}

/** Publication is separate from execution. Retrying it never invokes a test runner. */
export class ReleasePublisher {
  constructor({ github, git, activated = false, readArtifact = readFile } = {}) {
    Object.assign(this, { github, git, activated, readArtifact });
  }
  async publish({ candidate, tag = candidate?.tag, artifacts, body = '', expectedMain, measurementPath } = {}) {
    const ready = releaseReadiness(candidate);
    if (!ready.ready) throw Error(`Candidate is not ready: ${ready.reasons.join(', ')}`);
    checkedRef(tag);
    if (!sha(candidate.sha) || !Array.isArray(artifacts) || !artifacts.some(item => item.name === 'houseplan.zip')
      || new Set(artifacts.map(item => item.name)).size !== artifacts.length
      || artifacts.some(item => !/^[\w.-]+$/.test(item.name ?? '') || !/^[a-f0-9]{64}$/.test(item.expectedDigest ?? '') || !item.path))
      throw Error('Prepared named artifacts with expected digests are required');
    if (!this.activated) return { planned: true, candidate: candidate.id, sha: candidate.sha, tag, kind: candidate.kind,
      artifacts: artifacts.map(({ name, path, expectedDigest }) => ({ name, path, expectedDigest })),
      operations: ['create or reuse draft', 'upload missing identical prepared artifacts', 'publish exact refs (main fast-forward only)', 'publish draft', 'verify tag and downloads'],
      delivery: 'Verify the public release feed and downloaded ZIP; optional HACS instance observation is separate evidence' };
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
    // A previously created draft may still contain an older author's text. A lost
    // response is safe to retry: the next read observes the already-updated body.
    if (release.draft && (release.body ?? '') !== body)
      release = await this.github.updateRelease(release.id, { body });
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
    for (const artifact of prepared) evidence.push({ ...await this.github.verifyPublication({ tag, expectedSha: candidate.sha,
      assetName: artifact.name, expectedDigest: artifact.expectedDigest }), assetName: artifact.name });
    const warnings = []; let measurement = null;
    if (body && typeof release.body === 'string' && release.body !== body)
      warnings.push('Published release notes differ from the prepared text; the public text was preserved');
    if (candidate.kind === 'stable') {
      try {
        if (!measurementPath) throw Error('Diagnostic stable measurement is not available');
        const bytes = await this.readArtifact(measurementPath), record = JSON.parse(bytes.toString('utf8'));
        if (record.source_sha !== candidate.sha) throw Error('Diagnostic measurement belongs to another candidate');
        const actualRelease = await this.github.getRelease(tag), name = 'measurement.json';
        const matches = actualRelease.assets.filter(asset => asset.name === name);
        if (matches.length > 1) throw Error('Diagnostic measurement asset is ambiguous');
        const asset = matches[0] ?? await this.github.uploadReleaseAsset(actualRelease.id, { name, bytes, contentType: 'application/json' });
        const expectedDigest = sha256(bytes), downloaded = await this.github.downloadAsset(asset.id);
        if (sha256(downloaded) !== expectedDigest) throw Error('Diagnostic measurement asset differs');
        measurement = { name, assetId: asset.id, digest: expectedDigest, sourceSha: candidate.sha };
      } catch (error) { warnings.push(`Stable measurement: ${error.message}`); }
    }
    return { published: true, sha: candidate.sha, tag, evidence: evidence.find(item => item.assetName === 'houseplan.zip'), artifacts: evidence, deliveryPending: true, measurement, warnings };
  }
}

/** A missing measurement is diagnostic; callers decide how to display its absence. */
export async function readPublishedMeasurement(github, { tag, sha: sourceSha }) {
  const release = await github.getRelease(tag);
  if (release.draft || release.tag_name !== tag) throw Error('Stable release is not published');
  const assets = release.assets.filter(asset => asset.name === 'measurement.json');
  if (assets.length !== 1) throw Error('Stable measurement is missing or ambiguous');
  const record = JSON.parse((await github.downloadAsset(assets[0].id)).toString('utf8'));
  if (record.source_sha !== sourceSha) throw Error('Stable measurement belongs to another commit');
  return record;
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

export class DeliveryPending extends Error { constructor(message) { super(message); this.name = 'DeliveryPending'; } }
export class HacsDeliveryVerifier {
  constructor({ hacs, github, clock = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    Object.assign(this, { hacs, github, clock, sleep });
  }
  async verify({ repository, tag, assetName, expectedDigest }) {
    if (!/^[a-f0-9]{64}$/.test(expectedDigest ?? '')) throw Error('Expected artifact SHA-256 required');
    if (repository.toLowerCase() !== `${this.github.owner}/${this.github.repo}`.toLowerCase()) throw Error('HACS and GitHub repository identities differ');
    const rows = await this.hacs.repositories();
    const row = rows.find(item => item.full_name?.toLowerCase() === repository.toLowerCase());
    if (!row || row.available_version !== tag || row.can_download !== true) throw new DeliveryPending('This release is not observed as downloadable in HACS yet');
    const release = await this.github.getRelease(tag);
    if (release.draft || release.tag_name !== tag) throw Error('Published release unavailable');
    const assets = release.assets.filter(asset => asset.name === assetName);
    if (assets.length !== 1) throw Error('Expected release artifact missing or ambiguous');
    const bytes = await this.github.downloadAsset(assets[0].id), actual = sha256(bytes);
    if (actual !== expectedDigest) throw Error('Downloaded release artifact differs');
    return { hacsAvailable: true, tag, artifactDigest: actual, assetName, bytes: bytes.length,
      hacsRepositoryId: row.id, observedAt: new Date().toISOString() };
  }
  async wait({ timeoutMs = 10 * 60_000, intervalMs = 15_000, signal, onProgress = () => {}, ...request }) {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || !Number.isFinite(intervalMs) || intervalMs <= 0 || intervalMs > 60_000)
      throw Error('Use a finite delivery wait and polling intervals no longer than one minute');
    const started = this.clock(); let attempts = 0, reason = 'Release discovery pending';
    while (!signal?.aborted) {
      attempts++;
      try { return { status: 'verified', attempts, ...await this.verify(request) }; }
      catch (error) { if (!(error instanceof DeliveryPending)) throw error; reason = error.message; }
      const elapsedMs = this.clock() - started;
      onProgress({ status: 'waiting', attempts, elapsedMs, reason });
      if (elapsedMs >= timeoutMs) return { status: 'waiting', attempts, elapsedMs, reason };
      await this.sleep(Math.min(intervalMs, timeoutMs - elapsedMs));
    }
    return { status: 'waiting', interrupted: true, attempts, elapsedMs: this.clock() - started, reason };
  }
}

/** The original delivery check: public GitHub discovery used by HACS, plus exact
 * downloaded bytes. This does not claim an individual HA instance refreshed. */
export class ReleaseDiscoveryVerifier extends HacsDeliveryVerifier {
  async verify({ repository, tag, kind, assetName, expectedDigest }) {
    if (!/^[a-f0-9]{64}$/.test(expectedDigest ?? '')) throw Error('Expected artifact SHA-256 required');
    if (!['beta', 'stable', 'hotfix'].includes(kind)) throw Error('Release discovery requires beta/stable/hotfix kind');
    if (repository.toLowerCase() !== `${this.github.owner}/${this.github.repo}`.toLowerCase()) throw Error('Release repository identities differ');
    let discovered;
    if (kind === 'beta') {
      for (let page = 1; page <= 100; page++) {
        const rows = await this.github.request('GET', `${this.github.root}/releases?per_page=100&page=${page}`);
        discovered = rows.find(item => item.prerelease && !item.draft);
        if (discovered || rows.length < 100) break;
      }
    } else {
      try { discovered = await this.github.request('GET', `${this.github.root}/releases/latest`); }
      catch (error) { if (error.status !== 404) throw error; }
    }
    if (!discovered || discovered.draft || discovered.tag_name !== tag || discovered.prerelease !== (kind === 'beta'))
      throw new DeliveryPending(`Public release discovery has not exposed ${tag} as the current ${kind === 'beta' ? 'beta' : 'stable'} yet`);
    const release = await this.github.getRelease(tag);
    if (release.draft || release.tag_name !== tag) throw Error('Published release unavailable');
    const assets = release.assets.filter(asset => asset.name === assetName);
    if (assets.length !== 1) throw Error('Expected release artifact missing or ambiguous');
    const bytes = await this.github.downloadAsset(assets[0].id), actual = sha256(bytes);
    if (actual !== expectedDigest) throw Error('Downloaded release artifact differs');
    return { discoveryAvailable: true, source: 'github-release-feed', tag, artifactDigest: actual,
      assetName, bytes: bytes.length, observedAt: new Date().toISOString() };
  }
}
