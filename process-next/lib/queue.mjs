import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

const copy = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function ownerDecisionRecord(value) {
  if (!value || !['ship', 'show', 'ask'].includes(value.track) || !['chat', 'manual'].includes(value.source)
    || !['decisionId', 'sourceRef', 'decisionText'].every(key => typeof value[key] === 'string' && value[key].trim() && value[key].length <= 2048))
    throw Error('Explicit owner decision requires decisionId, chat/manual source, sourceRef and decisionText; actor/login is not authority');
  return { decisionId: value.decisionId, source: value.source, sourceRef: value.sourceRef, decisionText: value.decisionText,
    track: value.track, ...(value.recordedBy ? { recordedBy: String(value.recordedBy).slice(0, 120) } : {}) };
}
export const ownerShip = task => task?.track === 'ship' && task.ownerAssigned === true && !!task.ownerDecision?.sourceRef;
export function queueSummary(state) {
  const order = [...state.waiting].sort((a, b) => Number(ownerShip(state.tasks[b])) - Number(ownerShip(state.tasks[a])) || state.tasks[a].ticket - state.tasks[b].ticket);
  return { revision: state.revision, active: state.active ? { issue: state.active.issue, phase: state.active.phase, expiresAt: state.active.expiresAt,
    reason: state.tasks[state.active.issue]?.automationError ?? null } : null,
  waiting: order.map((issue, index) => ({ issue, position: index + 1, track: state.tasks[issue].track, ownerShip: ownerShip(state.tasks[issue]) })) };
}
export class StateConflict extends Error { constructor(message = 'State changed; read and retry') { super(message); this.name = 'StateConflict'; } }
export class LeaseLost extends Error { constructor() { super('Queue admission expired or belongs to another worker'); this.name = 'LeaseLost'; } }

export function initialQueueState() {
  return { schema: 1, revision: 0, nextTicket: 1, nextFence: 1, tasks: {}, ownerDecisions: {}, specReviews: {}, waiting: [], active: null, events: {} };
}

/** Pure transitions. event.id is a delivery ID, not an authorization credential. */
export function reduceQueue(previous, event, { now = Date.now(), leaseMs = 60 * 60_000 } = {}) {
  if (!event?.id || typeof event.id !== 'string' || !Number.isFinite(now) || !(leaseMs > 0)) throw Error('Invalid queue event');
  if (previous.schema !== 1) throw Error('Unsupported queue state');
  const eventDigest = digest(event), recorded = previous.events[event.id];
  if (recorded) {
    if ((typeof recorded === 'string' ? recorded : recorded.digest) !== eventDigest) throw Error('Delivery ID reused with another payload');
    return copy(previous);
  }
  const state = copy(previous);
  if (state.active && state.active.expiresAt <= now) {
    const task = state.tasks[state.active.issue];
    task.reason = 'admission-expired'; task.queued = true; task.ticket = state.nextTicket++;
    if (!state.waiting.includes(task.issue)) state.waiting.push(task.issue);
    // Evidence and stable review request live on the task, not the lease.
    state.active = null;
  }
  const admitted = () => {
    const active = state.active;
    if (!active || active.issue !== event.issue || active.token !== event.token) throw new LeaseLost();
    return active;
  };
  const material = active => {
    if (!sha(event.materialSha) || event.materialSha !== active.materialSha) throw Error('Result belongs to another material');
  };
  switch (event.type) {
    case 'owner-track': {
      if (!Number.isSafeInteger(event.issue) || event.issue < 1) throw Error('Invalid owner decision issue');
      const decision = ownerDecisionRecord(event);
      (state.ownerDecisions ??= {})[event.issue] = decision;
      const task = state.tasks[event.issue], wasOwnerShip = ownerShip(task);
      if (task) { task.track = event.track; task.ownerAssigned = true; task.ownerDecision = decision; }
      if (state.active?.issue === event.issue && Boolean(wasOwnerShip) !== (event.track === 'ship') && ['review', 'ready-to-merge'].includes(state.active.phase)) {
        state.active.phase = event.track === 'ship' ? 'ready-to-merge' : 'review';
        task.status = event.track === 'ship' ? 'S6-in-progress' : 'S7-code-review';
      }
      break;
    }
    case 'enqueue': {
      const task = event.task;
      if (!Number.isSafeInteger(task?.issue) || task.issue < 1 || !['ship', 'show', 'ask'].includes(task.track)
        || !['product', 'infra', 'docs'].includes(task.layer) || !sha(task.materialSha)
        || typeof task.branch !== 'string' || !task.branch.length) throw Error('Invalid queued task');
      const existing = state.tasks[task.issue];
      if (existing?.status === 'S8-merged') throw Error('Task is already merged');
      if (state.active?.issue === task.issue) throw Error('Admitted task cannot be replaced');
      if (!state.waiting.includes(task.issue)) state.waiting.push(task.issue);
      const decision = state.ownerDecisions?.[task.issue];
      const authority = decision ? { track: decision.track, ownerAssigned: true, ownerDecision: decision } : { ownerAssigned: false, ownerDecision: null };
      state.tasks[task.issue] = { ...existing, ...copy(task), ...authority, ticket: existing?.queued ? existing.ticket : state.nextTicket++, queued: true,
        status: 'S6-in-progress', readyAt: existing?.queued ? existing.readyAt : now };
      break;
    }
    case 'admit': {
      if (state.active) break; // a newly ready ship never interrupts the current task
      const order = [...state.waiting].sort((a, b) => {
        const first = state.tasks[a], second = state.tasks[b];
        return Number(ownerShip(second)) - Number(ownerShip(first)) || first.ticket - second.ticket;
      });
      if (!order.length) break;
      const task = state.tasks[order[0]], fence = state.nextFence++;
      state.waiting = state.waiting.filter(issue => issue !== task.issue);
      task.queued = false;
      state.active = { issue: task.issue, worker: event.worker ?? null, token: `${fence}:${event.id}`, fence,
        materialSha: task.materialSha, expectedBase: null, phase: 'sync', admittedAt: now, expiresAt: now + leaseMs };
      break;
    }
    case 'heartbeat': admitted().expiresAt = now + leaseMs; break;
    case 'synchronized': {
      const active = admitted();
      if (active.phase !== 'sync' || !sha(event.expectedBase) || !sha(event.materialSha)) throw Error('Invalid final synchronization');
      active.expectedBase = event.expectedBase; active.materialSha = event.materialSha; active.phase = 'testing';
      const task = state.tasks[active.issue];
      active.patchId = event.patchId ?? event.materialSha;
      if (task.patchId && task.patchId !== active.patchId) { delete task.review; delete task.reviewRequest; delete task.reviewMaterial; }
      task.patchId = active.patchId; task.materialSha = event.materialSha;
      if (event.layer) { if (!['docs', 'infra', 'product'].includes(event.layer)) throw Error('Invalid computed layer'); task.layer = event.layer; }
      if (event.changedFiles) task.changedFiles = copy(event.changedFiles);
      break;
    }
    case 's6-complete': {
      const active = admitted(), task = state.tasks[active.issue]; material(active);
      if (active.phase !== 'testing' || (task.layer === 'docs' ? event.outcome !== 'not-required' : event.outcome !== 'passed'))
        throw Error('S6 needs its successful selected set; documentation has no runs');
      task.s6 = copy(event.evidence ?? null);
      const ship = ownerShip(task);
      const retainedReview = task.review?.verdict === 'accepted' && task.review.patchId === active.patchId;
      if (task.reviewRequest) active.reviewRequest = task.reviewRequest;
      active.phase = ship || retainedReview ? 'ready-to-merge' : 'review'; task.status = ship ? 'S6-in-progress' : 'S7-code-review';
      break;
    }
    case 'review-complete': {
      const active = admitted(); material(active);
      if (active.phase !== 'review' || event.verdict !== 'accepted') throw Error('Independent accepted review required');
      state.tasks[active.issue].review = { ...copy(event.review ?? {}), materialSha: active.materialSha, expectedBase: active.expectedBase, patchId: active.patchId, verdict: 'accepted' };
      active.phase = 'ready-to-merge'; break;
    }
    case 'review-requested': {
      const active = admitted(); material(active);
      if (active.phase !== 'review' || !event.requestId) throw Error('Review request needs the admitted material');
      if (active.reviewRequest && active.reviewRequest !== event.requestId) throw Error('Another review is already requested');
      active.reviewRequest = event.requestId;
      const task = state.tasks[active.issue]; task.reviewRequest = event.requestId;
      task.reviewMaterial = { materialSha: active.materialSha, expectedBase: active.expectedBase, patchId: active.patchId };
      break;
    }
    case 'automation-pending': {
      const active = admitted(); active.expiresAt = now + leaseMs;
      state.tasks[active.issue].automationError = String(event.reason || 'retry-pending').slice(0, 1000); break;
    }
    case 'resynchronize': {
      const active = admitted(); active.phase = 'sync'; active.expectedBase = null; active.expiresAt = now + leaseMs; break;
    }
    case 'spec-requested': {
      if (!Number.isSafeInteger(event.issue) || !event.request?.requestId) throw Error('Specification review request required');
      (state.specReviews ??= {})[event.issue] = { ...copy(event.request), status: 'pending', updatedAt: now }; break;
    }
    case 'spec-complete': {
      const current = state.specReviews?.[event.issue];
      if (!current || current.requestId !== event.requestId) throw Error('Specification review identity differs');
      Object.assign(current, { status: event.verdict, reportUrl: event.reportUrl ?? null, updatedAt: now }); break;
    }
    case 'dev-build': {
      const task = state.tasks[event.issue];
      if (task?.status !== 'S8-merged' || task.mergedSha !== event.materialSha) throw Error('Dev publication must follow an actual merge');
      task.devBuild = { status: event.status, sourceSha: event.materialSha, ...(event.reason ? { reason: String(event.reason).slice(0, 1000) } : {}) }; break;
    }
    case 'return': {
      const active = admitted();
      state.tasks[active.issue] = { ...state.tasks[active.issue], status: 'S6-in-progress', reason: event.reason || 'returned' };
      state.active = null; break;
    }
    case 'merged': {
      const active = admitted(); material(active);
      if (active.phase !== 'ready-to-merge' || event.actualDevSha !== active.materialSha) throw Error('Actual merge is required for S8');
      const old = state.tasks[active.issue];
      state.tasks[active.issue] = { issue: old.issue, branch: old.branch, track: old.track, layer: old.layer,
        status: 'S8-merged', mergedSha: event.actualDevSha, mergedAt: now, devBuild: { status: old.layer === 'product' ? 'pending' : 'not-required' } };
      state.active = null; break;
    }
    case 'expire': break;
    default: throw Error(`Unknown queue event: ${event.type}`);
  }
  // Idle ticks do not create JSON history, revisions or remote commits.
  if (JSON.stringify(state) === JSON.stringify(previous)) return state;
  state.events[event.id] = { digest: eventDigest, issue: event.issue ?? event.task?.issue ?? state.active?.issue ?? null };
  const events = Object.entries(state.events).filter(([, record]) => typeof record !== 'string' && record.issue != null
    && state.tasks[record.issue]?.status !== 'S8-merged').slice(-256);
  state.events = Object.fromEntries(events);
  const completed = Object.values(state.tasks).filter(task => task.status === 'S8-merged' && task.devBuild?.status !== 'pending')
    .sort((a, b) => b.mergedAt - a.mergedAt);
  for (const task of completed.slice(64)) { delete state.tasks[task.issue]; delete state.ownerDecisions[task.issue]; }
  const specDone = Object.entries(state.specReviews ?? {}).filter(([, item]) => item.status !== 'pending').sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  for (const [issue] of specDone.slice(64)) delete state.specReviews[issue];
  state.revision++;
  return state;
}

export class MemoryQueueStore {
  constructor(state = initialQueueState()) { this.state = copy(state); this.version = 0; }
  async read() { return { state: copy(this.state), version: this.version }; }
  async compareAndSwap(version, state) {
    if (version !== this.version) throw new StateConflict();
    this.state = copy(state); return ++this.version;
  }
}

/** Local draft storage: one short exclusive filesystem transaction, no stale-lock stealing. */
export class LocalQueueStore {
  constructor(path, { initial = initialQueueState } = {}) { this.path = path; this.initial = initial; }
  async read() {
    try { const value = JSON.parse(await readFile(this.path, 'utf8')); return { state: value.state, version: value.version }; }
    catch (error) { if (error.code === 'ENOENT') return { state: this.initial(), version: 0 }; throw error; }
  }
  async compareAndSwap(version, state) {
    await mkdir(dirname(this.path), { recursive: true });
    const lockPath = this.path + '.lock'; let lock;
    try { lock = await open(lockPath, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw new StateConflict('Local state is being updated'); throw error; }
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      const current = await this.read();
      if (current.version !== version) throw new StateConflict();
      const output = await open(temporary, 'wx');
      try { await output.writeFile(JSON.stringify({ version: version + 1, state }, null, 2) + '\n'); await output.sync(); }
      finally { await output.close(); }
      await rename(temporary, this.path); return version + 1;
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await lock.close(); await unlink(lockPath);
    }
  }
}

export class QueueController {
  constructor(store, { clock = Date.now, leaseMs = 60 * 60_000, retries = 8 } = {}) {
    Object.assign(this, { store, clock, leaseMs, retries });
  }
  async dispatch(event) {
    for (let attempt = 0; attempt < this.retries; attempt++) {
      const { state, version } = await this.store.read();
      const next = reduceQueue(state, event, { now: this.clock(), leaseMs: this.leaseMs });
      if (next.revision === state.revision) return next;
      try { await this.store.compareAndSwap(version, next); return next; }
      catch (error) { if (!(error instanceof StateConflict)) throw error; }
    }
    throw new StateConflict('Queue remained busy; retry the same event ID');
  }
  async assertAdmission({ issue, token, materialSha, phase = 'ready-to-merge' }) {
    const snapshot = await this.store.read(), active = snapshot.state.active;
    if (!active || active.issue !== issue || active.token !== token || active.expiresAt <= this.clock()) throw new LeaseLost();
    if (active.materialSha !== materialSha || active.phase !== phase) throw Error('Queue material/phase differs');
    return snapshot;
  }
}
