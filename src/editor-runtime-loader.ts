export type EditorRuntimeLoaderState = 'idle' | 'loading' | 'ready' | 'failed';

export interface EditorRuntimeModule<Runtime> {
  readonly fingerprint: string;
  create(): Runtime;
}

export interface EditorRuntimeLoaderFailure {
  /** Terminal failures need a page refresh; the rest retry on the next intent. */
  readonly terminal: boolean;
}

export type SafeRuntimeDiagnostic = Readonly<{
  kind: 'runtime-load' | 'structural';
  fingerprint: string;
  terminal: boolean;
}>;

/** Allow only an internal short content hash or a fixed non-secret sentinel. */
export function safeRuntimeDiagnostic(
  kind: SafeRuntimeDiagnostic['kind'], fingerprint: unknown, terminal: boolean,
): SafeRuntimeDiagnostic {
  const value = typeof fingerprint === 'string' && (
    fingerprint === 'invalid' || fingerprint === 'no-borders' || fingerprint === 'unverified'
      || /^[a-z0-9]{1,8}$/i.test(fingerprint)
  ) ? fingerprint : 'redacted';
  return Object.freeze({ kind, fingerprint: value, terminal: !!terminal });
}

export interface EditorRuntimeLoaderOptions<Runtime> {
  readonly expectedFingerprint: string;
  readonly load: (attempt: 0 | 1) => Promise<EditorRuntimeModule<Runtime>>;
  readonly install: (runtime: Runtime) => void;
  readonly stateChanged?: (state: EditorRuntimeLoaderState) => void;
  readonly failed?: (error: unknown, info: EditorRuntimeLoaderFailure) => void;
}

/**
 * One toast wording for every lazy-runtime failure (#353 AC5). A terminal
 * failure means this tab runs code from another build — only a refresh helps.
 * A network failure heals on the next explicit press, so the advice differs.
 */
export type LazyLoadFailureKey =
  | 'editor.load_failed' | 'editor.refresh_advice' | 'editor.retry_advice';

export function lazyLoadFailureMessage(
  t: (key: LazyLoadFailureKey) => string,
  info: EditorRuntimeLoaderFailure,
): string {
  return `${t('editor.load_failed')} ${t(info.terminal ? 'editor.refresh_advice' : 'editor.retry_advice')}`;
}

/** Loader-owned marker: the served module belongs to a different build. */
class FingerprintMismatchError extends Error {}

/**
 * One atomic lazy-runtime boundary shared by all editor entry points.
 *
 * A failed module is retried exactly once per load cycle. Construction happens
 * before `install`, so a parse, fingerprint or constructor failure cannot
 * leave a half-installed editor attached to the View card.
 *
 * Failure outcomes differ (#353): a fingerprint mismatch on either attempt is
 * terminal — the tab holds another build and only a refresh helps, so `ensure`
 * keeps returning `false` without importing again. Any other failure (network,
 * parse) reports via `failed` and returns the loader to `idle`, so the NEXT
 * explicit user intent starts a fresh cycle. There are no background retries.
 */
export class EditorRuntimeLoader<Runtime> {
  private _state: EditorRuntimeLoaderState = 'idle';
  private _inFlight: Promise<boolean> | null = null;

  public constructor(private readonly options: EditorRuntimeLoaderOptions<Runtime>) {}

  public get state(): EditorRuntimeLoaderState {
    return this._state;
  }

  public ensure(): Promise<boolean> {
    if (this._state === 'ready') return Promise.resolve(true);
    if (this._state === 'failed') return Promise.resolve(false);
    if (this._inFlight) return this._inFlight;
    this._setState('loading');
    this._inFlight = this._loadWithRetry().finally(() => {
      this._inFlight = null;
    });
    return this._inFlight;
  }

  private async _loadWithRetry(): Promise<boolean> {
    let lastError: unknown = new Error('Editor runtime did not load');
    let sawMismatch = false;
    for (const attempt of [0, 1] as const) {
      try {
        const module = await this.options.load(attempt);
        if (module.fingerprint !== this.options.expectedFingerprint) {
          throw new FingerprintMismatchError(
            `Editor runtime fingerprint mismatch: expected ${this.options.expectedFingerprint}, got ${module.fingerprint}`,
          );
        }
        const runtime = module.create();
        this.options.install(runtime);
        this._setState('ready');
        return true;
      } catch (error: unknown) {
        lastError = error;
        if (error instanceof FingerprintMismatchError) sawMismatch = true;
      }
    }
    this._setState(sawMismatch ? 'failed' : 'idle');
    this.options.failed?.(lastError, { terminal: sawMismatch });
    return false;
  }

  private _setState(state: EditorRuntimeLoaderState): void {
    if (state === this._state) return;
    this._state = state;
    this.options.stateChanged?.(state);
  }
}
