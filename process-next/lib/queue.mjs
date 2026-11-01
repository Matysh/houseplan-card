import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

const copy = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export class StateConflict extends Error { constructor(message = 'State changed; read and retry') { super(message); this.name = 'StateConflict'; } }
export class LeaseLost extends Error { constructor() { super('Queue admission expired or belongs to another worker'); this.name = 'LeaseLost'; } }

export function initialQueueState() {
  return { schema: 1, revision: 0, nextTicket: 1, nextFence: 1, tasks: {}, ownerDecisions: {}, waiting: [], active: null, events: {} };
}

/** Pure transitions. event.id is a delivery ID, not an authorization credential. */
export function reduceQueue(previous, event, { now = Date.now(), leaseMs = 60 * 60_000 } = {}) {
  if (!event?.id || typeof event.id !== 'string' || !Number.isFinite(now) || !(leaseMs > 0)) throw Error('Invalid queue event');
  if (previous.schema !== 1) throw Error('Unsupported queue state');
  const eventDigest = digest(event), recorded = previous.events[event.id];
  if (recorded) {
    if (recorded !== eventDigest) throw Error('Delivery ID reused with another payload');
    return copy(previous);
  }
  const state = copy(previous);
  if (state.active && state.active.expiresAt <= now) {
    state.tasks[state.active.issue] = { ...state.tasks[state.active.issue], status: 'S6-in-progress', reason: 'admission-expired' };
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
      if (!Number.isSafeInteger(event.issue) || event.issue < 1 || !['ship', 'show', 'ask'].includes(event.track)
        || !event.actor || !['label', 'chat'].includes(event.source)) throw Error('Invalid attributed owner decision');
      const decision = { actor: event.actor, source: event.source, track: event.track };
      (state.ownerDecisions ??= {})[event.issue] = decision;
      const task = state.tasks[event.issue], wasOwnerShip = task?.track === 'ship' && task.ownerAssigned;
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
      const authority = decision ? { track: decision.track, ownerAssigned: true, ownerDecision: decision }
        : existing?.ownerAssigned && task.ownerAssigned !== true ? { track: existing.track, ownerAssigned: true } : {};
      state.tasks[task.issue] = { ...existing, ...copy(task), ...authority, ticket: existing?.queued ? existing.ticket : state.nextTicket++, queued: true,
        status: 'S6-in-progress', readyAt: existing?.queued ? existing.readyAt : now };
      break;
    }
    case 'admit': {
      if (state.active) break; // a newly ready ship never interrupts the current task
      const order = [...state.waiting].sort((a, b) => {
        const first = state.tasks[a], second = state.tasks[b];
        return Number(second.track === 'ship' && second.ownerAssigned === true)
          - Number(first.track === 'ship' && first.ownerAssigned === true) || first.ticket - second.ticket;
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
      state.tasks[active.issue].materialSha = event.materialSha;
      break;
    }
    case 's6-complete': {
      const active = admitted(), task = state.tasks[active.issue]; material(active);
      if (active.phase !== 'testing' || (task.layer === 'docs' ? event.outcome !== 'not-required' : event.outcome !== 'passed'))
        throw Error('S6 needs its successful selected set; documentation has no runs');
      task.s6 = copy(event.evidence ?? null);
      const ship = task.track === 'ship' && task.ownerAssigned === true;
      const retainedReview = task.review?.verdict === 'accepted' && task.review.materialSha === active.materialSha
        && task.review.expectedBase === active.expectedBase;
      active.phase = ship || retainedReview ? 'ready-to-merge' : 'review'; task.status = ship ? 'S6-in-progress' : 'S7-code-review';
      break;
    }
    case 'review-complete': {
      const active = admitted(); material(active);
      if (active.phase !== 'review' || event.verdict !== 'accepted') throw Error('Independent accepted review required');
      state.tasks[active.issue].review = { ...copy(event.review ?? {}), materialSha: active.materialSha, expectedBase: active.expectedBase, verdict: 'accepted' };
      active.phase = 'ready-to-merge'; break;
    }
    case 'review-requested': {
      const active = admitted(); material(active);
      if (active.phase !== 'review' || !event.requestId) throw Error('Review request needs the admitted material');
      if (active.reviewRequest && active.reviewRequest !== event.requestId) throw Error('Another review is already requested');
      active.reviewRequest = event.requestId; break;
    }
    case 'return': {
      const active = admitted();
      state.tasks[active.issue] = { ...state.tasks[active.issue], status: 'S6-in-progress', reason: event.reason || 'returned' };
      state.active = null; break;
    }
    case 'merged': {
      const active = admitted(); material(active);
      if (active.phase !== 'ready-to-merge' || event.actualDevSha !== active.materialSha) throw Error('Actual merge is required for S8');
      state.tasks[active.issue] = { ...state.tasks[active.issue], status: 'S8-merged', mergedSha: event.actualDevSha, mergedAt: now };
      state.active = null; break;
    }
    case 'expire': break;
    default: throw Error(`Unknown queue event: ${event.type}`);
  }
  state.events[event.id] = eventDigest; state.revision++;
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
