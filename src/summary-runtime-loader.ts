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
 * next `ensure` may try again; there are no background retries. Per-host
 * installation and cancellation belong to the current ViewRuntimeBoundary.
 */
import { ViewRuntimeCode, assertViewRuntimeFingerprint } from './view-runtime-boundary';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { viewRuntimeRetryUrl } from './view-runtime-retry';

export class SummaryRuntimeLoader<Host, Runtime> extends ViewRuntimeCode<Host, Runtime> {}

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
