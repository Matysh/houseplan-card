import { FloorCacheStore, type CacheAddress, type CachePayload } from './floor-cache-store';
import { FloorCacheScheduler } from './floor-cache-scheduler';
import { cacheSha256 } from './floor-cache-key';
import { cacheTextChecksum } from './floor-cache-job';
import { decodeGeometryValue, type GeometryWire } from './floor-cache-codec';
import { isFloorGeometryFrame, type FloorGeometryFrame, type FloorGeometryInput } from './floor-geometry-frame';
import type { LightBarrierRevision } from './glow-scene';
import { validFloorPreview, type FloorPreview } from './floor-cache-preview';
interface Selection {
  authority: object; connection: number; scope?: string;
  input: FloorGeometryInput; persistentKey: string; fitKey: string; light: LightBarrierRevision;
}
export interface FloorRuntimeHost {
  selection(): Selection | null;
  hydrate(frame: FloorGeometryFrame, light: unknown): void;
  contains?(frame: FloorGeometryFrame, light: unknown): boolean;
  preview?(fitKey: string, scope: string | undefined, persistentKey: string): FloorPreview | null;
  changed(kind?: 'geometry' | 'light'): void;
}
interface Entry { frame: FloorGeometryFrame; wire: GeometryWire; payload?: CachePayload; lightKey: string; light: unknown }
/** One owner fences cache reads, work, hydration and publication. Authority
 * object and navigation sequence remain independent of persistent identity. */
export class FloorCacheRuntime {
  private scheduler = new FloorCacheScheduler();
  private readonly store = new FloorCacheStore();
  private memory = new Map<string, Entry>();
  private sequence = 0;
  private selected: Selection | null = null;
  private key = '';
  private readyKey = '';
  private failure: 'unavailable' | 'invalid' | null = null;
  private disposed = false;
  private published = new Map<string, string>();
  private publishing = new Map<string, { generation: string }>();
  private lightTask: { selection: Selection; sequence: number; frame: FloorGeometryFrame } | null = null;
  private failedLight = '';
  private areaMemory = new Map<string, number | null>();
  private memoryAuthority?: object;
  private memoryConnection = -1;
  private memoryScope?: string;
  preview: FloorPreview | null = null;
  readonly metrics = { firstPreview: 0, firstCachedFullFrame: 0, readyCurrentFrame: 0,
    diskHits: 0, memoryHits: 0, misses: 0, familyFallbacks: 0, publicationAttempts: 0, publicationFailures: 0, previewBytes: 0,
    hydrationMs: [] as number[], workerMs: [] as number[],
    producers: [] as NonNullable<import('./floor-cache-job').FloorJobResult['producer']>[] };
  constructor(private readonly host: FloorRuntimeHost) { this.store.preopen(); }
  private selection(): Selection | null { try { return this.host.selection(); } catch { return null; } }
  get pending(): boolean { return !!this.key && this.readyKey !== this.key && !this.failure; }
  get failed() { return this.failure; }
  get publicationNeeded(): boolean {
    const publication = this.publication();
    return !!publication && this.published.get(publication.bucket) !== publication.generation
      && this.publishing.get(publication.bucket)?.generation !== publication.generation;
  }
  /** A prior light table may paint briefly while the latest live revision is
   * computed. It never lends geometry/read authority to another navigation. */
  get retainedLight(): unknown {
    const task = this.lightTask;
    return task && this.lightCurrent(task) ? this.memory.get(task.selection.persistentKey)?.light : undefined;
  }
  get fit() { return this.pending ? this.preview?.fit : undefined; }
  get diagnostic() { return { ...this.metrics, store: this.store.metrics, scheduler: this.scheduler.metrics,
    stage: this.scheduler.stage, failure: this.failure }; }
  get supportFacts() {
    const last = this.scheduler.metrics.last;
    return {
      state: this.failure ? 'error' : this.pending ? 'pending' : this.selected ? 'ready' : 'idle',
      ...(this.scheduler.stage ? { active: this.scheduler.stage } : {}),
      ...(last ? { last_stage: last.stage, last_result: last.outcome } : {}),
      ...(this.failure ? { failure: this.failure } : {}),
    };
  }
  get paintToken(): string { return `${this.key}|${this.selected?.fitKey || ''}`; }
  markPreviewPaint(token: string): void {
    if (token === this.paintToken && this.preview && this.same(this.selected, this.selection()) && !this.metrics.firstPreview)
      this.metrics.firstPreview = performance.now();
  }
  markPaint(fresh: boolean): void {
    if (this.pending || this.failure || !this.selected || !this.same(this.selected, this.selection())) return;
    if (!fresh && !this.metrics.firstCachedFullFrame) this.metrics.firstCachedFullFrame = performance.now();
    if (fresh && !this.metrics.readyCurrentFrame) this.metrics.readyCurrentFrame = performance.now();
    this.preview = null;
  }
  rehydrate(): void {
    const selection = this.selected, entry = selection && this.memory.get(selection.persistentKey);
    if (entry && !this.pending && !this.failure && this.same(selection, this.selection())) this.host.hydrate(entry.frame, entry.light);
  }
  private same(a: Selection | null, b: Selection | null): boolean {
    return this.sameStructure(a, b) && a!.light.fingerprint === b!.light.fingerprint;
  }
  private sameStructure(a: Selection | null, b: Selection | null): boolean {
    return !!a && !!b && a.authority === b.authority && a.connection === b.connection && a.scope === b.scope
      && a.input.raw.id === b.input.raw.id && a.persistentKey === b.persistentKey;
  }
  private lightCurrent(task: NonNullable<FloorCacheRuntime['lightTask']>): boolean {
    return !this.disposed && task.sequence === this.sequence && !this.pending
      && this.sameStructure(task.selection, this.selection())
      && this.memory.get(task.selection.persistentKey)?.frame === task.frame;
  }
  private refreshLight(): void {
    const selection = this.selected, entry = selection && this.memory.get(selection.persistentKey);
    if (!selection || !entry || this.lightTask || this.pending || this.disposed
      || !this.sameStructure(selection, this.selection()) || entry.lightKey === selection.light.fingerprint
      || this.failedLight === `${this.sequence}|${selection.light.fingerprint}`) return;
    const task = this.lightTask = { selection, sequence: this.sequence, frame: entry.frame };
    void (async () => {
      try {
        const result = await this.scheduler.run({ kind: 'light', input: selection.input,
          memory: entry.wire, light: selection.light }, 'light');
        if (!this.lightCurrent(task)) return;
        if (result) {
          this.metrics.workerMs.push(result.ms);
          if (this.metrics.workerMs.length > 100) this.metrics.workerMs.shift();
          if (result.producer) this.metrics.producers.push(result.producer);
          if (this.metrics.producers.length > 50) this.metrics.producers.shift();
        }
        // A newer live revision supersedes only the result, never terminates
        // its worker. The finally block starts one latest coalesced request.
        if (!this.same(selection, this.selection())) return;
        if (!result?.light) throw new Error('floor-cache:light');
        const light = decodeGeometryValue(result.light), current = this.memory.get(selection.persistentKey)!;
        if (!light || typeof light !== 'object' || !('fingerprint' in light)
          || light.fingerprint !== selection.light.fingerprint) throw new Error('floor-cache:light-revision');
        this.memory.set(selection.persistentKey, { ...current, lightKey: selection.light.fingerprint, light });
        this.metrics.memoryHits++;
        this.host.hydrate(current.frame, light); this.host.changed('light');
      } catch {
        if (this.lightCurrent(task) && this.same(selection, this.selection())) {
          // Keep structural readiness. Let the ordinary light reader provide
          // its bounded canonical fallback instead of an endless retry loop.
          this.failedLight = `${this.sequence}|${selection.light.fingerprint}`;
          this.metrics.familyFallbacks++;
          this.host.changed('light');
        }
      } finally {
        if (this.lightTask === task) { this.lightTask = null; this.refreshLight(); }
      }
    })();
  }
  private publication() {
    const selection = this.selected;
    if (!selection?.scope || this.pending || this.failure) return null;
    const entry = this.memory.get(selection.persistentKey), address = this.address(selection);
    if (!entry?.payload || !address) return null;
    return { selection, entry, address, bucket: JSON.stringify([selection.scope, selection.input.raw.id]),
      generation: cacheSha256([selection.persistentKey, selection.fitKey, entry.payload.checksum]) };
  }
  private address(selection: Selection): CacheAddress | null {
    return selection.scope ? { scope: selection.scope, floor: String(selection.input.raw.id), key: selection.persistentKey } : null;
  }
  private readPreview(selection: Selection, sequence: number): void {
    const warm = this.host.preview?.(selection.fitKey, selection.scope, selection.persistentKey);
    if (warm && validFloorPreview(warm, selection.fitKey) && warm.fit.projection === selection.input.projection)
      this.preview = warm;
    const address = this.address(selection);
    if (!address) return;
    void this.store.read(address, 'preview').then(payload => {
      if (!payload || this.disposed || sequence !== this.sequence || !this.pending
        || !this.same(selection, this.selection()) || this.selected?.fitKey !== selection.fitKey) return;
      try {
        if (cacheTextChecksum(payload.text) !== payload.checksum) return;
        const preview = JSON.parse(payload.text);
        if (!validFloorPreview(preview, selection.fitKey) || preview.fit.projection !== selection.input.projection) return;
        this.preview = preview; this.host.changed();
      } catch { /* preview is optional */ }
    });
  }
  ensure(): boolean {
    const selection = this.selection();
    if (!selection || this.disposed) {
      if (this.selected) this.invalidate();
      return true;
    }
    const ready = this.memory.get(selection.persistentKey);
    if (ready && !this.pending && !this.failure && this.sameStructure(this.selected, selection)) {
      if (this.selected!.fitKey !== selection.fitKey) this.metrics.memoryHits++;
      this.selected = selection;
      if (this.host.contains?.(ready.frame, ready.light) === false) this.host.hydrate(ready.frame, ready.light);
      this.refreshLight();
      return true;
    }
    if (this.sameStructure(this.selected, selection) && (this.pending || this.failure)) {
      if (this.selected!.fitKey !== selection.fitKey) {
        this.selected = selection;
        if (this.preview?.fitKey !== selection.fitKey) this.preview = null;
        if (this.pending) this.readPreview(selection, this.sequence);
      }
      return false;
    }
    const authorityChanged = this.memoryAuthority !== selection.authority
      || this.memoryConnection !== selection.connection || this.memoryScope !== selection.scope;
    if (authorityChanged) { this.memory.clear(); this.areaMemory.clear(); this.published.clear(); this.publishing.clear(); }
    this.memoryAuthority = selection.authority; this.memoryConnection = selection.connection; this.memoryScope = selection.scope;
    this.lightTask = null; this.failedLight = '';
    const sequence = ++this.sequence; this.scheduler.cancel(); this.selected = selection;
    this.key = `${sequence}|${selection.persistentKey}|${selection.light.fingerprint}`;
    this.failure = null;
    this.preview = null;
    this.metrics.firstPreview = this.metrics.firstCachedFullFrame = this.metrics.readyCurrentFrame = 0;
    const isCurrent = () => !this.disposed && sequence === this.sequence && this.sameStructure(selection, this.selection());
    const memoryKey = selection.persistentKey;
    let warm = this.memory.get(memoryKey);
    if (warm?.lightKey === selection.light.fingerprint) {
      this.memory.delete(memoryKey); this.memory.set(memoryKey, warm);
      try {
        this.host.hydrate(warm.frame, warm.light); this.readyKey = this.key; this.metrics.memoryHits++;
        return true;
      } catch { this.memory.delete(memoryKey); warm = undefined; }
    }
    const address = this.address(selection);
    this.readPreview(selection, sequence);
    void (async () => {
      try {
        const disk = !warm && address ? await this.store.read(address, 'geometry') : null;
        if (!isCurrent()) return;
        // A live HA/light revision does not replace immutable geometry. The
        // worker returns only new light tables for an already accepted frame.
        const result = await this.scheduler.run(warm
          ? { kind: 'light', input: selection.input, memory: warm.wire, light: selection.light }
          : { kind: 'geometry', input: selection.input, disk, light: selection.light });
        if (!isCurrent()) return;
        if (!result) {
          this.failure = 'unavailable'; this.metrics.familyFallbacks++; this.preview = null; this.host.changed(); return;
        }
        this.metrics.workerMs.push(result.ms);
        if (this.metrics.workerMs.length > 100) this.metrics.workerMs.shift();
        if (result.producer) this.metrics.producers.push(result.producer);
        if (this.metrics.producers.length > 50) this.metrics.producers.shift();
        const start = performance.now(), frame = warm?.frame ?? decodeGeometryValue(result.wire);
        if (!isFloorGeometryFrame(frame, selection.input)) throw new Error('floor-cache:frame');
        // A fresher HA sample cannot restart structural preparation or use
        // the obsolete light tables. The ordinary light refresh follows it.
        const light = result.light && this.same(selection, this.selection()) ? decodeGeometryValue(result.light) : undefined;
        if (!isCurrent()) return;
        const entry: Entry = { frame, wire: warm?.wire ?? result.wire!, payload: warm?.payload ?? result.payload,
          lightKey: selection.light.fingerprint, light };
        this.memory.set(memoryKey, entry);
        while (this.memory.size > 8) this.memory.delete(this.memory.keys().next().value!);
        if (warm) this.metrics.memoryHits++; else if (result.hit) this.metrics.diskHits++; else this.metrics.misses++;
        this.host.hydrate(frame, light); this.readyKey = this.key;
        this.metrics.hydrationMs.push(performance.now() - start);
        if (this.metrics.hydrationMs.length > 100) this.metrics.hydrationMs.shift();
        this.host.changed();
      } catch {
        if (!isCurrent()) return;
        // Never start expensive canonical readers on every render or claim
        // the retained frame is current after preparation has failed.
        this.memory.delete(memoryKey); this.failure = 'invalid'; this.metrics.familyFallbacks++;
        this.preview = null; this.host.changed();
      }
    })();
    return false;
  }
  /** Called only after the card's existing complete-frame paint/resource
   * barrier, with confirmed View source. Never from an editor/optimistic path. */
  publish(preview: FloorPreview, accepted: () => boolean): void {
    const publication = this.publication(), sequence = this.sequence;
    if (!publication || !this.publicationNeeded || !accepted()) return;
    const { selection, address, entry, bucket, generation } = publication;
    if (!validFloorPreview(preview, selection.fitKey)) return;
    // A different generation can overwrite this floor after the final IDB
    // authority check. From scheduling onward the old disk claim is unsafe,
    // even if navigation returns to it before the new commit completes.
    this.published.delete(bucket);
    const ticket = { generation }; this.publishing.set(bucket, ticket);
    while (this.publishing.size > 8) this.publishing.delete(this.publishing.keys().next().value!);
    const text = JSON.stringify(preview), bytes = new TextEncoder().encode(text).length;
    this.metrics.publicationAttempts++; this.metrics.previewBytes = bytes;
    const current = () => {
      const live = this.selection();
      return !this.disposed && sequence === this.sequence && this.sameStructure(selection, live)
        && selection.fitKey === live?.fitKey && selection.fitKey === this.selected?.fitKey && accepted();
    };
    // Small bounded preview conversion only; the large L2 text/checksum came
    // from the worker. No large stringify runs after the first live frame.
    const complete = (published: boolean) => {
      if (!published) this.metrics.publicationFailures++;
      if (this.publishing.get(bucket) !== ticket) return;
      this.publishing.delete(bucket);
      if (published && current()) {
        this.published.delete(bucket); this.published.set(bucket, generation);
        while (this.published.size > 8) this.published.delete(this.published.keys().next().value!);
      }
    };
    void this.store.publish({ address, generation, created: Date.now(),
      preview: { text, bytes, checksum: cacheTextChecksum(text) }, geometry: entry.payload! }, current).then(complete, () => complete(false));
  }
  /** Demanded one-floor scalar; a pending navigation preempts this job. */
  private rememberArea(key: string, value: number | null): void {
    this.areaMemory.delete(key); this.areaMemory.set(key, value);
    while (this.areaMemory.size > 256) this.areaMemory.delete(this.areaMemory.keys().next().value!);
  }
  async area(raw: FloorGeometryInput['raw'], key: string, accepted: () => boolean): Promise<number | null | undefined> {
    const selection = this.selected, sequence = this.sequence;
    if (!selection || this.disposed || this.pending || this.failure) return undefined;
    const current = () => !this.disposed && sequence === this.sequence && this.same(selection, this.selection()) && accepted();
    if (this.areaMemory.has(key)) { const value = this.areaMemory.get(key)!; this.rememberArea(key, value); return value; }
    const address = selection.scope ? { scope: selection.scope, floor: String(raw.id), key } : null;
    const disk = address ? await this.store.area(address) : undefined;
    if (!current()) return undefined;
    if (disk !== undefined) { this.rememberArea(key, disk); return disk; }
    const result = await this.scheduler.run({ kind: 'area', raw }, 'summary');
    if (!result || !current() || result.area === undefined) return undefined;
    if (result.producer) this.metrics.producers.push(result.producer);
    if (this.metrics.producers.length > 50) this.metrics.producers.shift();
    this.rememberArea(key, result.area);
    return result.area;
  }
  persistArea(raw: FloorGeometryInput['raw'], key: string, value: number | null, accepted: () => boolean): void {
    const selection = this.selected;
    if (!selection?.scope || this.pending || this.failure) return;
    const current = () => !this.disposed && this.same(selection, this.selection()) && accepted();
    void this.store.publishArea({ scope: selection.scope, floor: String(raw.id), key }, value, current);
  }
  retry(): boolean {
    if (!this.failure || !this.sameStructure(this.selected, this.selection())) return false;
    this.invalidate(); this.scheduler.retryWorker(); return true;
  }
  invalidate(): void { this.sequence++; this.lightTask = null; this.failedLight = ''; this.scheduler.cancel(); this.selected = null;
    this.key = ''; this.readyKey = ''; this.preview = null; this.failure = null; }
  dispose(): void { this.disposed = true; this.invalidate(); this.scheduler.dispose(); this.store.close(); }
}
