import type { FloorJob, FloorJobResult } from './floor-cache-job';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
interface Task { job: FloorJob; resolve(value: FloorJobResult | null): void; priority: 'navigation' | 'light' | 'summary' }
type Stage = 'worker' | 'fallback-load' | 'fallback-compute';
type Outcome = 'ready' | 'timeout' | 'error' | 'limited' | 'cancelled';
const WORKER_MS = 15_000;
const FALLBACK_MS = 3_000;

/** Main-thread work is admitted only for a small, bounded input. Never
 * decode a stored graph there; its expanded complexity isn't known here. */
function smallInput(root: unknown, limit: number): boolean {
  const queue = [root];
  for (let i = 0; i < queue.length; i++) {
    const value = queue[i];
    if (typeof value === 'string') {
      if (value.length > 2048) return false;
    } else if (value && typeof value === 'object') {
      if (Array.isArray(value) && value.length > 128) return false;
      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (queue.length >= limit) return false;
        queue.push((value as Record<string, unknown>)[key]);
      }
    }
  }
  return true;
}

type LoadFallback = () => Promise<Pick<typeof import('./floor-cache-compute'), 'computeFloorJob'>>;
interface Active extends Task {
  id: number; timer?: ReturnType<typeof setTimeout>; abort: AbortController; stage: Stage;
}
/** One active worker per mounted surface, one last navigation intent. Summary
 * jobs are demanded lazily by their owner, never an eager house-wide scan. */
export class FloorCacheScheduler {
  private worker: Worker | null = null;
  private active: Active | null = null;
  private pending: Task | null = null;
  private sequence = 0;
  private degraded = false;
  private disposed = false;
  readonly metrics = { workerJobs: 0, fallbackJobs: 0, cancelled: 0, workerErrors: 0,
    timeouts: 0, workerTimeouts: 0, last: null as { stage: Stage; outcome: Outcome } | null };
  get stage(): Stage | undefined { return this.active?.stage; }
  constructor(private readonly factory: () => Worker = () => new Worker(new URL('__FLOOR_WORKER_ASSET__', import.meta.url), { type: 'module', name: 'houseplan-floor' }),
    private readonly loadFallback: LoadFallback = () => import('./floor-cache-compute'),
    private readonly now: () => number = () => performance.now()) {}
  run(job: FloorJob, priority: Task['priority'] = 'navigation'): Promise<FloorJobResult | null> {
    if (this.disposed) return Promise.resolve(null);
    return new Promise(resolve => {
      const task: Task = { job, priority, resolve };
      if (priority === 'navigation') {
        if (this.pending) { this.pending.resolve(null); this.pending = null; this.metrics.cancelled++; }
        if (this.active) this.cancelActive();
      } else if (priority === 'light') {
        // Live refreshes wait behind an active job. Only real navigation may
        // terminate a worker; repeated light ticks are coalesced by runtime.
        if (this.pending) { this.pending.resolve(null); this.metrics.cancelled++; }
      } else if (this.active || this.pending) { resolve(null); return; }
      this.pending = task; this.drain();
    });
  }
  private cancelActive(): void {
    const old = this.active; if (!old) return;
    this.active = null; clearTimeout(old.timer); old.abort.abort();
    this.stopWorker();
    this.metrics.last = { stage: old.stage, outcome: 'cancelled' };
    old.resolve(null); this.metrics.cancelled++;
  }
  private stopWorker(): void { this.worker?.terminate(); this.worker = null; }
  /** Only a new user intent should retry an unavailable worker immediately. */
  retryWorker(): void { this.degraded = false; }
  private drain(): void {
    if (this.active || !this.pending || this.disposed) return;
    const task = this.pending; this.pending = null;
    const id = ++this.sequence;
    const active: Active = this.active = { ...task, id, abort: new AbortController(), stage: 'worker' };
    const started = this.now();
    const current = () => this.active === active;
    const finish = (outcome: Outcome, result: FloorJobResult | null = null) => {
      if (!current()) return;
      this.active = null; clearTimeout(active.timer); active.abort.abort();
      this.metrics.last = { stage: active.stage, outcome };
      if (outcome === 'timeout') this.metrics.timeouts++;
      task.resolve(result); this.drain();
    };
    const fallback = (workerFailed: boolean) => {
      if (!current() || active.stage !== 'worker') return;
      clearTimeout(active.timer);
      this.stopWorker(); this.degraded = true;
      if (workerFailed) {
        this.metrics.workerErrors++;
        if (this.now() - started >= WORKER_MS) this.metrics.workerTimeouts++;
      }
      active.stage = 'fallback-load';
      this.metrics.fallbackJobs++;
      const time = Math.min(FALLBACK_MS, started + WORKER_MS + FALLBACK_MS - this.now());
      if (time <= 0) { finish('timeout'); return; }
      const deadline = this.now() + time;
      active.timer = setTimeout(() => finish('timeout'), time);
      const raw = task.job.kind === 'area' ? task.job.raw : task.job.input.raw;
      const job = task.job.kind === 'geometry' ? { ...task.job, disk: undefined, memory: undefined } : task.job;
      if (!smallInput(raw, 2048) || !smallInput(job, 8192)) { finish('limited'); return; }
      const withinBudget = () => {
        if (!current()) return false;
        if (this.now() < deadline) return true;
        finish('timeout'); return false;
      };
      void Promise.resolve().then(() => withinBudget() ? this.loadFallback() : null)
        .then(module => {
          if (!module || !withinBudget()) return null;
          active.stage = 'fallback-compute';
          return module.computeFloorJob(job, active.abort.signal);
        }).then(result => {
          if (withinBudget()) finish(result ? 'ready' : 'error', result);
        }, () => { if (withinBudget()) finish('error'); });
    };
    if (this.degraded) {
      fallback(false);
      return;
    }
    active.timer = setTimeout(() => fallback(true), WORKER_MS);
    try {
      if (!this.worker) this.worker = this.factory();
      this.worker.onmessage = event => {
        if (!current() || active.stage !== 'worker' || event.data?.id !== id) return;
        if (this.now() - started >= WORKER_MS || event.data.fingerprint !== ENTRY_BUILD_FINGERPRINT
          || event.data.error || !event.data.result) fallback(true);
        else finish('ready', event.data.result);
      };
      const fault = (event: Event) => { event?.preventDefault(); fallback(true); };
      this.worker.onerror = fault; this.worker.onmessageerror = fault;
      this.metrics.workerJobs++; this.worker.postMessage({ id, job: task.job });
    } catch { fallback(true); }
  }
  cancel(): void { this.pending?.resolve(null); this.pending = null; this.cancelActive(); }
  dispose(): void { this.disposed = true; this.cancel(); this.stopWorker(); }
}
