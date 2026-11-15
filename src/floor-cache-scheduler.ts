import type { FloorJob, FloorJobResult } from './floor-cache-job';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
interface Task { job: FloorJob; resolve(value: FloorJobResult | null): void; priority: 'navigation' | 'light' | 'summary' }
/** One active worker per mounted surface, one last navigation intent. Summary
 * jobs are demanded lazily by their owner, never an eager house-wide scan. */
export class FloorCacheScheduler {
  private worker: Worker | null = null;
  private active: (Task & { id: number; timer: ReturnType<typeof setTimeout> }) | null = null;
  private pending: Task | null = null;
  private sequence = 0;
  private degraded = false;
  private disposed = false;
  readonly metrics = { workerJobs: 0, fallbackJobs: 0, cancelled: 0, workerErrors: 0 };
  constructor(private readonly factory: () => Worker = () => new Worker(new URL('__FLOOR_WORKER_ASSET__', import.meta.url), { type: 'module', name: 'houseplan-floor' })) {}
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
    clearTimeout(old.timer); this.active = null; this.worker?.terminate(); this.worker = null;
    old.resolve(null); this.metrics.cancelled++;
  }
  private drain(): void {
    if (this.active || !this.pending || this.disposed) return;
    const task = this.pending; this.pending = null;
    const id = ++this.sequence;
    const finish = (result: FloorJobResult | null) => {
      if (this.active?.id !== id) return;
      clearTimeout(this.active.timer); this.active = null; task.resolve(result); this.drain();
    };
    const computeFallback = () => void import('./floor-cache-compute')
      .then(module => this.active?.id === id && !this.disposed ? module.computeFloorJob(task.job) : null)
      .then(finish, () => finish(null));
    let fallbackStarted = false;
    const fallback = () => {
      if (this.active?.id !== id || fallbackStarted) return;
      fallbackStarted = true;
      clearTimeout(this.active.timer);
      this.worker?.terminate(); this.worker = null; this.degraded = true; this.metrics.workerErrors++;
      this.metrics.fallbackJobs++;
      computeFallback();
    };
    this.active = { ...task, id, timer: setTimeout(() => {
      // A hung worker is terminated before the single canonical fallback.
      fallback();
    }, 15_000) };
    if (this.degraded) {
      clearTimeout(this.active.timer);
      this.metrics.fallbackJobs++;
      computeFallback();
      return;
    }
    try {
      if (!this.worker) this.worker = this.factory();
      this.worker.onmessage = event => { if (event.data?.id === id)
        event.data.fingerprint !== ENTRY_BUILD_FINGERPRINT || event.data.error ? fallback() : finish(event.data.result); };
      const fault = (event: Event) => { event?.preventDefault(); fallback(); };
      this.worker.onerror = fault; this.worker.onmessageerror = fault;
      this.metrics.workerJobs++; this.worker.postMessage({ id, job: task.job });
    } catch { fallback(); }
  }
  cancel(): void { this.pending?.resolve(null); this.pending = null; this.cancelActive(); }
  dispose(): void { this.disposed = true; this.cancel(); this.worker?.terminate(); this.worker = null; }
}
