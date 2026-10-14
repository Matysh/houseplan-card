/** Optional View code is page-warm; failures, retries and ownership are per card. */
export type ViewRuntimeState = 'idle' | 'loading' | 'ready' | 'error';
export type ViewRuntimeFactory<Host, Runtime> = (host: Host) => Runtime;

export class ViewRuntimeFingerprintMismatch extends Error {}

export function assertViewRuntimeFingerprint(actual: unknown, expected: string): void {
  if (actual !== expected) throw new ViewRuntimeFingerprintMismatch('view runtime build mismatch');
}

/** Existing editor discard policy owns the decision; a late decision keeps its owner. */
export function guardedViewRuntimeReload(input: {
  current(): boolean;
  guard?: (resume: () => void) => boolean;
  reload(): void;
}): void {
  if (!input.current()) return;
  const resume = () => { if (input.current()) input.reload(); };
  if (input.guard && !input.guard(resume)) return;
  resume();
}

export interface ViewRuntimeCodePort<Host, Runtime> {
  create(host: Host): Runtime | null;
  ensure(attempt?: 0 | 1): Promise<ViewRuntimeFactory<Host, Runtime>>;
}

/** Only the immutable factory and its pending import are shared. Rejections are not. */
export class ViewRuntimeCode<Host, Runtime> implements ViewRuntimeCodePort<Host, Runtime> {
  private factory: ViewRuntimeFactory<Host, Runtime> | null = null;
  private pending: Promise<ViewRuntimeFactory<Host, Runtime>> | null = null;

  constructor(private readonly load: (attempt: 0 | 1) => Promise<ViewRuntimeFactory<Host, Runtime>>) {}
  get warm(): boolean { return this.factory !== null; }
  create(host: Host): Runtime | null { return this.factory ? this.factory(host) : null; }
  ensure(attempt: 0 | 1 = 0): Promise<ViewRuntimeFactory<Host, Runtime>> {
    if (this.factory) return Promise.resolve(this.factory);
    if (this.pending) return this.pending;
    const pending = this.load(attempt).then(factory => {
      if (this.pending === pending) { this.factory = factory; this.pending = null; }
      return factory;
    }, (error: unknown) => {
      if (this.pending === pending) this.pending = null;
      throw error;
    });
    this.pending = pending;
    return pending;
  }
  reset(): void { this.factory = null; this.pending = null; }
}

export interface ViewRuntimeBoundaryPort<Runtime> {
  owner(): object;
  current(owner: object): boolean;
  install(runtime: Runtime): void;
  changed(): void;
}

/** First load is automatic. An error allows exactly one explicit nonce retry. */
export class ViewRuntimeBoundary<Host, Runtime> {
  private active = false;
  private generation = 0;
  private owner: object | null = null;
  private pending: Promise<boolean> | null = null;
  private value: ViewRuntimeState = 'idle';
  private retried = false;
  private terminal = false;

  constructor(
    private readonly host: Host,
    private readonly code: ViewRuntimeCodePort<Host, Runtime>,
    private readonly port: ViewRuntimeBoundaryPort<Runtime>,
  ) {}
  get state(): ViewRuntimeState { return this.value; }
  get unavailable(): boolean { return this.value === 'error' || this.value === 'loading' && this.retried; }
  get canRetry(): boolean { return this.value === 'error' && !this.retried && !this.terminal; }
  get terminalFailure(): boolean { return this.value === 'error' && !this.canRetry; }

  connect(load = true): void { this.active = true; if (load) void this.ensure(); }
  disconnect(): void {
    this.active = false; this.generation++; this.pending = null;
    if (this.value === 'loading') this.value = 'idle';
  }
  ensure(): Promise<boolean> {
    const owner = this.port.owner();
    if (!this.active || !this.port.current(owner)) return Promise.resolve(false);
    if (this.owner && this.owner !== owner && this.value !== 'ready') {
      this.generation++; this.pending = null; this.value = 'idle';
      this.retried = false; this.terminal = false;
    }
    if (this.value === 'ready') return Promise.resolve(true);
    if (this.pending) return this.pending;
    if (this.value === 'error') return Promise.resolve(false);
    return this.load(owner, 0);
  }
  retry(): Promise<boolean> {
    const owner = this.port.owner();
    if (!this.active || !this.port.current(owner) || !this.canRetry) return Promise.resolve(false);
    this.retried = true;
    return this.load(owner, 1);
  }

  private load(owner: object, attempt: 0 | 1): Promise<boolean> {
    const generation = ++this.generation;
    this.owner = owner;
    const current = () => this.active && this.generation === generation && this.port.current(owner);
    const failed = (error: unknown): false => {
      if (current()) {
        this.terminal = error instanceof ViewRuntimeFingerprintMismatch;
        this.value = 'error'; this.pending = null; this.port.changed();
      }
      return false;
    };
    try {
      const warm = this.code.create(this.host);
      if (warm !== null) {
        if (!current()) return Promise.resolve(false);
        this.port.install(warm); this.value = 'ready'; this.port.changed();
        return Promise.resolve(true);
      }
      this.value = 'loading'; this.port.changed();
      this.pending = this.code.ensure(attempt).then(factory => {
        if (!current()) return false;
        this.port.install(factory(this.host));
        this.value = 'ready'; this.pending = null; this.port.changed();
        return true;
      }).catch(failed);
      return this.pending;
    } catch (error) { return Promise.resolve(failed(error)); }
  }
}
