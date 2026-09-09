/**
 * Page-level cache of the summary runtime *code*; state stays per host (#506).
 *
 * The summary panel is a lazy chunk. Before #506 every card instance — even a
 * warm remount on a page whose chunk had loaded long ago — attached its
 * runtime through `import().then()`, i.e. after Lit's first render. The first
 * header measurement therefore saw a header without summary controls; the
 * controls arrived a beat later, the stage shrank, and the deferred refit
 * opened a `stage-resize` continuity candidate with three more render passes
 * on top of the first HA tick.
 *
 * The loader keeps exactly one thing across instances: the factory that
 * builds a runtime for a host. Once it is warm, `create()` hands a fresh
 * runtime to a new host synchronously — inside `connectedCallback`, before
 * the first render — so the first frame already carries the full header.
 * Nothing else is shared: every host gets its own runtime with its own
 * preferences, drafts, subscriptions, timers and DOM.
 *
 * A pending import is shared by concurrent cold mounts (one network round
 * trip) but never its result-instance. A failed import is forgotten, so the
 * next `attach` may try again; there are no background retries.
 */
export type SummaryRuntimeFactory<Host, Runtime> = (host: Host) => Runtime;

export interface SummaryRuntimeAttachment {
  /** Forget this attempt: a later resolution must not touch the host. */
  cancel(): void;
}

export class SummaryRuntimeLoader<Host, Runtime> {
  private factory: SummaryRuntimeFactory<Host, Runtime> | null = null;
  private pending: Promise<SummaryRuntimeFactory<Host, Runtime>> | null = null;

  public constructor(private readonly load: () => Promise<SummaryRuntimeFactory<Host, Runtime>>) {}

  /** The code is on the page: `create()` will succeed synchronously. */
  public get warm(): boolean {
    return this.factory !== null;
  }

  /** A fresh runtime for `host`, or null while the code is still cold. */
  public create(host: Host): Runtime | null {
    return this.factory ? this.factory(host) : null;
  }

  /**
   * Build the runtime for `host` as soon as the code is available. When it is
   * warm, `ready` runs before this returns. Otherwise the shared import is
   * awaited and `ready` runs once — unless the attachment was cancelled
   * meanwhile (host disconnected, or a newer attach superseded this one).
   */
  public attach(host: Host, ready: (runtime: Runtime) => void): SummaryRuntimeAttachment {
    let live = true;
    const attachment = { cancel: () => { live = false; } };
    const warm = this.create(host);
    if (warm) {
      ready(warm);
      return attachment;
    }
    void this.ensure().then((factory) => {
      if (live) ready(factory(host));
    }, () => undefined);
    return attachment;
  }

  /** Share one in-flight import; a rejection clears it so a retry is possible. */
  public ensure(): Promise<SummaryRuntimeFactory<Host, Runtime>> {
    if (this.factory) return Promise.resolve(this.factory);
    if (this.pending) return this.pending;
    this.pending = this.load().then((factory) => {
      this.factory = factory;
      this.pending = null;
      return factory;
    }, (error: unknown) => {
      this.pending = null;
      throw error;
    });
    return this.pending;
  }

  /** Test seam: a page that wants to model a cold chunk again. */
  public reset(): void {
    this.factory = null;
    this.pending = null;
  }
}

/** What one host's slot needs from its runtime. */
export interface SummaryRuntimeLike {
  connect(): void;
  disconnect(): void;
}

/**
 * One host's summary runtime and the pending attachment of its current
 * connection. `connect()` follows the host's `connectedCallback`, `disconnect()`
 * its `disconnectedCallback`; the runtime instance survives a same-node
 * reconnect, a pending cold attach does not survive a disconnect.
 */
export class SummaryRuntimeSlot<Host, Runtime extends SummaryRuntimeLike> {
  public runtime: Runtime | undefined;
  private attachment: SummaryRuntimeAttachment | null = null;

  public constructor(
    private readonly loader: SummaryRuntimeLoader<Host, Runtime>,
    private readonly host: Host,
    /** Runs once per instance, right after adoption; connects when the host is in the tree. */
    private readonly adopted: (runtime: Runtime) => void,
  ) {}

  public connect(): void {
    if (this.runtime) { this.runtime.connect(); return; }
    this.attachment?.cancel();
    const attachment = this.loader.attach(this.host, (runtime) => this.adopt(runtime));
    // Warm code has already run `adopt`; only a cold attach stays pending.
    if (!this.runtime) this.attachment = attachment;
  }

  public disconnect(): void {
    this.attachment?.cancel();
    this.attachment = null;
    this.runtime?.disconnect();
  }

  private adopt(runtime: Runtime): void {
    this.attachment = null;
    if (this.runtime) return;
    this.runtime = runtime;
    this.adopted(runtime);
  }
}

type LoadedSummaryPanelRuntime = import('./summary-panel-runtime-loaded').LoadedSummaryPanelRuntime;

/**
 * The page's one summary code cache. The chunk stays lazy: the first cold
 * mount pays the import; every later instance builds its runtime synchronously.
 */
export const summaryRuntimeLoader = new SummaryRuntimeLoader<unknown, LoadedSummaryPanelRuntime>(
  () => import('./summary-panel-runtime-loaded').then(
    ({ LoadedSummaryPanelRuntime }) => (host) => new LoadedSummaryPanelRuntime(host),
  ),
);
