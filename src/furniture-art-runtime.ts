/**
 * Lazy designer artwork for furniture (#474).
 *
 * The 44 designer symbols carry ~10 KB gzip of SVG paths that every plan used
 * to pay for, including plans without a single piece of furniture. The
 * catalogue (ids, groups, default sizes) stays in the initial View graph;
 * the artwork lives in its own chunk behind this page-scoped runtime.
 *
 * Contract mirrors `LanguageRuntime` and `EditorRuntimeLoader`:
 *
 * - `pending` until the first `ensure()` and while a load is in flight;
 * - `ready` once the artwork is installed — either loaded here or handed over
 *   synchronously by the editor chunk, which imports the artwork statically
 *   (`adopt`), so the palette and the placement ghost never see `pending`;
 * - `fallback` is a SETTLED state: two failed attempts (the second through a
 *   nonce URL, because Chromium caches a failed module forever, #352–#355) or
 *   a fingerprint from another build. A card must never stay behind the boot
 *   veil because of artwork; pieces render as unknown symbols — nothing —
 *   exactly as a plan written by a newer card does in an older one.
 *
 * Hosts that rendered while `pending` register through `art(id, host)` and
 * get one `requestUpdate()` when the runtime settles.
 */
import type { FurnitureGraphic } from './furniture';

export type FurnitureArtState = 'ready' | 'pending' | 'fallback';

export interface FurnitureArtModule {
  readonly GENERATED_FURNITURE_ART: Readonly<Record<string, FurnitureGraphic>>;
  readonly FURNITURE_ART_FINGERPRINT: string;
}

export interface FurnitureArtHost {
  requestUpdate(): void;
  readonly isConnected: boolean;
}

export interface FurnitureArtRuntimeOptions {
  /** Build id embedded in the entry; artwork from another build is rejected. */
  expectedFingerprint: string;
  /** Attempt 0 — ordinary dynamic import; attempt 1 — nonce URL. */
  load: (attempt: 0 | 1) => Promise<FurnitureArtModule>;
  warn?: (message: string, error: unknown) => void;
  /** Settled into `fallback`: the host shows one toast per page. */
  loadFailed?: (terminal: boolean) => void;
}

/** Minimal shape of a card config for `configNeedsFurnitureArt`. */
export interface FurnitureArtConfigLike {
  spaces?: ReadonlyArray<{ decor?: ReadonlyArray<{ kind?: string; symbol?: string }> | null } | null> | null;
}

export class FurnitureArtRuntime {
  private _art: Readonly<Record<string, FurnitureGraphic>> | null = null;
  private _failed = false;
  private _terminal = false;
  private _inFlight: Promise<void> | null = null;
  private readonly _hosts = new Set<FurnitureArtHost>();
  private readonly _settled: Array<() => void> = [];

  public constructor(private readonly options: FurnitureArtRuntimeOptions) {}

  public state(): FurnitureArtState {
    if (this._art) return 'ready';
    if (this._failed) return 'fallback';
    return 'pending';
  }

  /** Terminal fallback: the tab holds another build; only a refresh helps. */
  public get terminal(): boolean {
    return this._terminal;
  }

  /**
   * Synchronous artwork lookup. A host passed while `pending` is remembered
   * and re-rendered once when the runtime settles; the lookup itself never
   * starts a load — that is `ensure()`'s job, so a plan without furniture
   * never requests the chunk.
   */
  public art(id: string, host?: FurnitureArtHost): FurnitureGraphic | undefined {
    if (this._art) return this._art[id];
    if (host && !this._failed) this._hosts.add(host);
    return undefined;
  }

  /**
   * Hand over artwork that another chunk already loaded (the editor imports
   * it statically). Synchronous: the palette renders `ready` on its first
   * frame. A foreign fingerprint is ignored — the editor loader would have
   * rejected such a chunk anyway — and a repeated adopt is a no-op.
   */
  public adopt(art: Readonly<Record<string, FurnitureGraphic>>, fingerprint: string): boolean {
    if (this._art) return true;
    if (fingerprint !== this.options.expectedFingerprint) {
      (this.options.warn ?? console.warn)(
        '[houseplan] furniture artwork from another build ignored', { fingerprint },
      );
      return false;
    }
    this._install(art);
    return true;
  }

  /** Idempotent: one in-flight load, settled states resolve immediately. */
  public ensure(): Promise<void> {
    if (this.state() !== 'pending') return Promise.resolve();
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._loadWithRetry().finally(() => {
      this._inFlight = null;
    });
    return this._inFlight;
  }

  /** Resolves when the runtime leaves `pending` (already settled → next tick). */
  public onSettled(callback: () => void): void {
    if (this.state() !== 'pending') {
      void Promise.resolve().then(callback);
      return;
    }
    this._settled.push(callback);
  }

  private async _loadWithRetry(): Promise<void> {
    let lastError: unknown = new Error('furniture artwork did not load');
    for (const attempt of [0, 1] as const) {
      try {
        const module = await this.options.load(attempt);
        if (module.FURNITURE_ART_FINGERPRINT !== this.options.expectedFingerprint) {
          this._terminal = true;
          lastError = new Error(`furniture artwork fingerprint mismatch: expected ${this.options.expectedFingerprint}, got ${module.FURNITURE_ART_FINGERPRINT}`);
          break;
        }
        if (this._art) return; // adopted by the editor while we were loading
        this._install(module.GENERATED_FURNITURE_ART);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (this._art) return;
    this._failed = true;
    (this.options.warn ?? console.warn)('[houseplan] furniture artwork unavailable', lastError);
    this.options.loadFailed?.(this._terminal);
    this._flush();
  }

  private _install(art: Readonly<Record<string, FurnitureGraphic>>): void {
    this._art = art;
    this._failed = false;
    this._flush();
  }

  private _flush(): void {
    const hosts = [...this._hosts];
    this._hosts.clear();
    for (const host of hosts) if (host.isConnected) host.requestUpdate();
    const callbacks = this._settled.splice(0);
    for (const callback of callbacks) callback();
  }
}

/** Does this config draw at least one piece whose artwork is lazy? */
export function configNeedsFurnitureArt(
  config: FurnitureArtConfigLike | null | undefined,
  isDesigner: (symbol: string) => boolean,
): boolean {
  for (const space of config?.spaces ?? []) {
    for (const shape of space?.decor ?? []) {
      if (shape?.kind === 'furniture' && typeof shape.symbol === 'string' && isDesigner(shape.symbol)) return true;
    }
  }
  return false;
}

/**
 * Boot veil gate: `true` while the veil must stay down because the plan
 * draws lazy artwork that has not settled yet. Plans without furniture never
 * wait; `fallback` counts as settled. The card's BOOT_MAX_MS hard cap still
 * applies on top — the veil can never get stuck on artwork.
 */
export function furnitureArtBootPending(
  runtime: Pick<FurnitureArtRuntime, 'state'>,
  config: FurnitureArtConfigLike | null | undefined,
  isDesigner: (symbol: string) => boolean,
): boolean {
  return runtime.state() === 'pending' && configNeedsFurnitureArt(config, isDesigner);
}

/**
 * Config intake: start the load before the first frame when the plan needs
 * it; register the host for the settle re-render. One call from the core.
 */
export function ensureFurnitureArtFor(
  runtime: FurnitureArtRuntime,
  config: FurnitureArtConfigLike | null | undefined,
  isDesigner: (symbol: string) => boolean,
  host: FurnitureArtHost,
): void {
  if (!configNeedsFurnitureArt(config, isDesigner)) return;
  if (runtime.state() === 'pending') {
    runtime.art('', host);
    void runtime.ensure();
  }
}

/* Page-scoped runtime wired to the real chunk. The retry token is replaced
 * at build time with the exact content-hashed asset (bundle-manifest.mjs). */
const ENTRY_BUILD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const FURNITURE_ART_RETRY_ASSET = '__HOUSEPLAN_FURNITURE_ART_RETRY_ASSET__';
let retrySeq = 0;

const loadFailures = new Set<(terminal: boolean) => void>();
/** Chain unsubscribe handles into one (keeps the host's bookkeeping flat). */
export function composeUnsub(...unsubs: Array<() => void>): () => void {
  return () => { for (const unsub of unsubs) unsub(); };
}
/** #354-style hook: the host shows one toast per page when artwork settles into fallback. */
export function subscribeFurnitureArtLoadFailures(listener: (terminal: boolean) => void): () => void {
  loadFailures.add(listener);
  return () => { loadFailures.delete(listener); };
}

export const FURNITURE_ART_RUNTIME = new FurnitureArtRuntime({
  expectedFingerprint: ENTRY_BUILD_FINGERPRINT,
  load: async (attempt) => (attempt === 0
    ? await import('./furniture-plan-art.generated')
    : await import(/* @vite-ignore */ (() => {
        const url = new URL(FURNITURE_ART_RETRY_ASSET, import.meta.url);
        url.searchParams.set('hp_retry', `art-${++retrySeq}`);
        return url.href;
      })())) as FurnitureArtModule,
  loadFailed: (terminal) => {
    for (const listener of loadFailures) listener(terminal);
  },
});
