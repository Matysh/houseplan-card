export type EditorRuntimeLoaderState = 'idle' | 'loading' | 'ready' | 'failed';

export interface EditorRuntimeModule<Runtime> {
  readonly fingerprint: string;
  create(): Runtime;
}

export interface EditorRuntimeLoaderOptions<Runtime> {
  readonly expectedFingerprint: string;
  readonly load: (attempt: 0 | 1) => Promise<EditorRuntimeModule<Runtime>>;
  readonly install: (runtime: Runtime) => void;
  readonly stateChanged?: (state: EditorRuntimeLoaderState) => void;
  readonly failed?: (error: unknown) => void;
}

/**
 * One atomic lazy-runtime boundary shared by all editor entry points.
 *
 * A failed module is retried exactly once. Construction happens before
 * `install`, so a parse, fingerprint or constructor failure cannot leave a
 * half-installed editor attached to the View card.
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
    for (const attempt of [0, 1] as const) {
      try {
        const module = await this.options.load(attempt);
        if (module.fingerprint !== this.options.expectedFingerprint) {
          throw new Error(
            `Editor runtime fingerprint mismatch: expected ${this.options.expectedFingerprint}, got ${module.fingerprint}`,
          );
        }
        const runtime = module.create();
        this.options.install(runtime);
        this._setState('ready');
        return true;
      } catch (error: unknown) {
        lastError = error;
      }
    }
    this._setState('failed');
    this.options.failed?.(lastError);
    return false;
  }

  private _setState(state: EditorRuntimeLoaderState): void {
    if (state === this._state) return;
    this._state = state;
    this.options.stateChanged?.(state);
  }
}
