/** Field drafts are session state, never a second plan/configuration model. */
export interface PropertiesIdentity {
  spaceId: string;
  editor: 'plan' | 'devices' | 'decor';
  kind: string;
  objectId: string;
  /** Binding/lifecycle identity, not the changing object's whole snapshot. */
  binding?: string;
  /** Volatile multi-selection, in native paint order; never part of configuration. */
  objectIds?: readonly string[];
}

export interface PropertiesError {
  key: string;
  values?: Record<string, string | number>;
}
export type PropertiesParse = { ok: true; value: unknown }
  | { ok: false; error: PropertiesError };
export type PropertiesCommit = { ok: true }
  | { ok: false; error: PropertiesError };

export const propertiesIdentityKey = (value: PropertiesIdentity | null): string =>
  value ? JSON.stringify([value.spaceId, value.editor, value.kind, value.objectId, value.binding ?? null,
    ...(value.objectIds ? [value.objectIds] : [])]) : '';

/** Preserve presence/null and compare only the field's declared value. */
export function samePropertiesValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const a = Object.keys(left), b = Object.keys(right);
  return a.length === b.length && a.every(key => Object.prototype.hasOwnProperty.call(right, key)
    && samePropertiesValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}

/** Validate the complete token before invoking an existing physical-unit adapter. */
export function parsePropertiesNumber(raw: string, options: {
  min?: number; max?: number; unit?: string; convert?: (value: number) => number;
} = {}): PropertiesParse {
  const token = raw.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(token)) {
    return { ok: false, error: { key: 'invalid_number' } };
  }
  const input = Number(token.replace(',', '.'));
  if (!Number.isFinite(input)) return { ok: false, error: { key: 'invalid_number' } };
  if ((options.min !== undefined && input < options.min) || (options.max !== undefined && input > options.max)) {
    return { ok: false, error: { key: 'range', values: {
      min: options.min ?? '—', max: options.max ?? '—', unit: options.unit ?? '',
    } } };
  }
  const value = options.convert ? options.convert(input) : input;
  return Number.isFinite(value) ? { ok: true, value }
    : { ok: false, error: { key: 'invalid_number' } };
}

/** Shared commit order, including commands whose transports differ. */
export class PropertiesCommandLane {
  private state = { pending: 0, tail: Promise.resolve() as Promise<unknown> };
  run<T>(command: () => Promise<T> | T): Promise<T> {
    const state = this.state;
    const start = (): Promise<T> => { try { return Promise.resolve(command()); } catch (error) { return Promise.reject(error); } };
    // Keep the existing immediate first-write receipt; only followers wait.
    const result = state.pending++ ? state.tail.then(start) : start();
    state.tail = result.catch(() => undefined).then(() => { state.pending--; });
    return result;
  }
  settled(): Promise<unknown> { return this.state.tail; }
  /** Old callbacks still run their authority guards, but cannot hold a new HA/user hostage. */
  retire(): void { this.state = { pending: 0, tail: Promise.resolve() }; }
}

export interface PropertiesFieldPort {
  identity(): PropertiesIdentity | null;
  /** Stable context owner: changes on HA/user/permission retirement. */
  authority(): unknown;
  read(identity: PropertiesIdentity, field: string): unknown;
  parse(field: string, raw: string): PropertiesParse;
  commit(identity: PropertiesIdentity, field: string, value: unknown, before: unknown,
    current: () => boolean): Promise<PropertiesCommit>;
  changed(): void;
  focus(field: string): void;
  beforeFinish?(field: string): PropertiesError | null;
}

export interface PropertiesDraft {
  readonly field: string;
  raw: string;
  readonly identity: PropertiesIdentity;
  readonly authority: unknown;
  readonly before: unknown;
  error: PropertiesError | null;
  pending: boolean;
}

/** Enter + blur join one promise; old replies never clear a newer field draft. */
export class PropertiesFieldController {
  draft: PropertiesDraft | null = null;
  private attempt: Promise<boolean> | null = null;
  constructor(private readonly port: PropertiesFieldPort, readonly lane = new PropertiesCommandLane()) {}

  private owns(draft: PropertiesDraft): boolean {
    return this.draft === draft && draft.authority === this.port.authority()
      && propertiesIdentityKey(draft.identity) === propertiesIdentityKey(this.port.identity());
  }

  /** Render-only previews cannot borrow an obsolete object or authority. */
  get previewDraft(): PropertiesDraft | null {
    const draft = this.draft;
    return draft && this.owns(draft) && draft.error?.key !== 'external_change'
      && (draft.pending || samePropertiesValue(draft.before, this.port.read(draft.identity, draft.field))) ? draft : null;
  }

  edit(field: string, raw: string): boolean {
    const identity = this.port.identity();
    if (!identity || (this.draft && (this.draft.pending || this.draft.field !== field))) return false;
    if (!this.draft || !this.owns(this.draft)) {
      this.draft = { field, raw, identity: { ...identity }, authority: this.port.authority(),
        before: structuredClone(this.port.read(identity, field)), error: null, pending: false };
    } else this.draft.raw = raw;
    this.port.changed();
    return true;
  }

  /** Read-side refresh accepts sibling changes but never silently rebases this field. */
  sync(): void {
    const draft = this.draft;
    if (!draft) return;
    if (!this.owns(draft)) { this.draft = null; return; }
    if (!draft.pending && !samePropertiesValue(draft.before, this.port.read(draft.identity, draft.field))) {
      draft.error = { key: 'external_change' };
    }
  }

  cancel(): boolean {
    if (!this.draft || this.draft.pending) return false;
    this.draft = null;
    this.port.changed();
    return true;
  }

  /** Context retirement revokes queued callbacks even if the next object has the same ID. */
  invalidate(): void { this.draft = null; this.port.changed(); }

  finish(): Promise<boolean> {
    const draft = this.draft;
    if (!draft) return Promise.resolve(true);
    if (draft.pending && this.attempt) return this.attempt;
    if (!this.owns(draft)) { this.draft = null; return Promise.resolve(false); }
    const reject = (error: PropertiesError): false => {
      if (this.owns(draft)) {
        draft.pending = false; draft.error = error;
        this.port.changed(); this.port.focus(draft.field);
      }
      return false;
    };
    if (draft.error?.key === 'external_change'
      || !samePropertiesValue(draft.before, this.port.read(draft.identity, draft.field))) {
      return Promise.resolve(reject({ key: 'external_change' }));
    }
    const completionError = this.port.beforeFinish?.(draft.field);
    if (completionError) return Promise.resolve(reject(completionError));
    const parsed = this.port.parse(draft.field, draft.raw);
    if (!parsed.ok) return Promise.resolve(reject(parsed.error));
    if (samePropertiesValue(parsed.value, draft.before)) {
      this.draft = null; this.port.changed(); return Promise.resolve(true);
    }
    draft.pending = true; draft.error = null; this.port.changed();
    const current = (): boolean => this.owns(draft)
      && samePropertiesValue(draft.before, this.port.read(draft.identity, draft.field));
    this.attempt = this.lane.run(async () => {
      if (!current()) return reject({ key: 'external_change' });
      try {
        const result = await this.port.commit(draft.identity, draft.field, parsed.value, draft.before, current);
        if (!this.owns(draft)) return false;
        if (!result.ok) return reject(result.error);
        this.draft = null; this.port.changed(); return true;
      } catch {
        return reject({ key: 'save_error' });
      }
    });
    return this.attempt;
  }

  /** Modal/actions/navigation finish the current input before touching another owner. */
  async finishThen(action: () => void | Promise<void>): Promise<boolean> {
    const authority = this.port.authority(), identity = propertiesIdentityKey(this.port.identity());
    if (!await this.finish() || authority !== this.port.authority()
      || identity !== propertiesIdentityKey(this.port.identity())) return false;
    await action();
    return true;
  }
}
