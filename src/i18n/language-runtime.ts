import { html, type TemplateResult } from 'lit';

export type LocaleDictionary = Record<string, string>;

export interface LazyLanguageModule {
  dictionary: LocaleDictionary;
  fingerprint: string;
}

export interface RuntimeLanguageEntry {
  code: string;
  dictionary?: LocaleDictionary;
  loadDictionary?: (attempt: 0 | 1) => Promise<LazyLanguageModule>;
}

export type LanguageLoadState = 'ready' | 'pending' | 'fallback';

export interface LanguageRuntimeContract {
  state(code: string): LanguageLoadState;
  dictionary(code: string): LocaleDictionary | undefined;
  ensure(code: string): Promise<void>;
}

/**
 * Page-scoped dictionary cache shared by all House Plan cards and editors.
 *
 * `fallback` is a settled state: a failed optional locale must never leave a
 * card behind an endless loading surface. The synchronous translation helper
 * then uses English in the ordinary way.
 */
export class LanguageRuntime {
  private readonly dictionaries = new Map<string, LocaleDictionary>();
  private readonly pending = new Map<string, Promise<void>>();
  private readonly failed = new Set<string>();

  public constructor(
    private readonly entries: readonly RuntimeLanguageEntry[],
    private readonly expectedFingerprint: string,
    private readonly warn: (message: string, error: unknown) => void = console.warn,
  ) {
    for (const entry of entries) {
      if (entry.dictionary) this.dictionaries.set(entry.code, entry.dictionary);
    }
  }

  public state(code: string): LanguageLoadState {
    if (this.dictionaries.has(code)) return 'ready';
    if (this.failed.has(code)) return 'fallback';
    return 'pending';
  }

  public dictionary(code: string): LocaleDictionary | undefined {
    return this.dictionaries.get(code);
  }

  public ensure(code: string): Promise<void> {
    if (this.state(code) !== 'pending') return Promise.resolve();
    const existing = this.pending.get(code);
    if (existing) return existing;
    const entry = this.entries.find((candidate) => candidate.code === code);
    const task = this.load(entry).finally(() => this.pending.delete(code));
    this.pending.set(code, task);
    return task;
  }

  private async load(entry: RuntimeLanguageEntry | undefined): Promise<void> {
    if (!entry?.loadDictionary) {
      if (entry) this.failed.add(entry.code);
      return;
    }
    let lastError: unknown;
    for (const attempt of [0, 1] as const) {
      try {
        const loaded = await entry.loadDictionary(attempt);
        if (loaded.fingerprint !== this.expectedFingerprint) {
          throw new Error(`locale fingerprint mismatch for ${entry.code}`);
        }
        this.dictionaries.set(entry.code, loaded.dictionary);
        this.failed.delete(entry.code);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    this.failed.add(entry.code);
    this.warn(`[houseplan] unable to load ${entry.code} locale; using English`, lastError);
  }
}

interface LanguageHostElement {
  inert: boolean;
  isConnected: boolean;
  requestUpdate(): void;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

const committedHosts = new WeakSet<LanguageHostElement>();
const pendingHosts = new WeakSet<LanguageHostElement>();

/** Lightweight production render gate; generic controller below remains testable in isolation. */
export function languageRenderGate(
  host: LanguageHostElement,
  runtime: LanguageRuntimeContract,
  code: string | null,
): LanguageRenderGate {
  const state = code ? runtime.state(code) : 'ready';
  if (!code || state !== 'pending') {
    if (pendingHosts.delete(host)) {
      host.inert = false;
      host.removeAttribute('aria-busy');
    }
    if (code) {
      host.setAttribute('lang', state === 'fallback' ? 'en' : code);
      committedHosts.add(host);
    }
    return 'ready';
  }
  if (!pendingHosts.has(host)) {
    host.inert = true;
    host.setAttribute('aria-busy', 'true');
    pendingHosts.add(host);
  }
  void runtime.ensure(code).then(() => {
    if (host.isConnected) host.requestUpdate();
  });
  return committedHosts.has(host) ? 'warm' : 'cold';
}

export type LanguageRenderGate = 'ready' | 'cold' | 'warm';

/** Keep a root Lit surface inert and visually stable while its lazy locale loads. */
/** A language-neutral first frame: no fallback-language copy is allowed to flash. */
export function languageLoadingTemplate(): TemplateResult {
  return html`<ha-circular-progress active role="status" aria-busy="true"></ha-circular-progress>`;
}
