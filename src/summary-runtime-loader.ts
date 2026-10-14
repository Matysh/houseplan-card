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
import { ViewRuntimeCode, assertViewRuntimeFingerprint } from './view-runtime-boundary';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { viewRuntimeRetryUrl } from './view-runtime-retry';

export type SummaryRuntimeFactory<Host, Runtime> = (host: Host) => Runtime;

export interface SummaryRuntimeAttachment {
  /** Forget this attempt: a later resolution must not touch the host. */
  cancel(): void;
}

export class SummaryRuntimeLoader<Host, Runtime> extends ViewRuntimeCode<Host, Runtime> {

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
  async attempt => {
    const module = attempt === 0 ? await import('./summary-panel-runtime-entry')
      : await import(/* @vite-ignore */ viewRuntimeRetryUrl('__HOUSEPLAN_SUMMARY_RETRY_ASSET__', import.meta.url)) as typeof import('./summary-panel-runtime-entry');
    assertViewRuntimeFingerprint(module.SUMMARY_RUNTIME_FINGERPRINT, ENTRY_BUILD_FINGERPRINT);
    return host => new module.LoadedSummaryPanelRuntime(host);
  },
);
