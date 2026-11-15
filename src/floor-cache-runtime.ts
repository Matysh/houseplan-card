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
  changed(): void;
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
  private failed = new Set<string>();
  private disposed = false;
  private published = '';
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
  get pending(): boolean { return !!this.key && this.readyKey !== this.key && !this.failed.has(this.key); }
  get publicationNeeded(): boolean {
    return !!this.selected && !!this.selected.scope && !this.pending && this.published !== this.key
      && !!this.memory.get(this.selected.persistentKey)?.payload;
  }
  get fit() { return this.pending ? this.preview?.fit : undefined; }
  get diagnostic() { return { ...this.metrics, store: this.store.metrics, scheduler: this.scheduler.metrics }; }
  get paintToken(): string { return `${this.key}|${this.selected?.fitKey || ''}`; }
  markPreviewPaint(token: string): void {
    if (token === this.paintToken && this.preview && this.same(this.selected, this.selection()) && !this.metrics.firstPreview)
      this.metrics.firstPreview = performance.now();
  }
  markPaint(fresh: boolean): void {
    if (this.pending || !this.selected || !this.same(this.selected, this.selection())) return;
    if (!fresh && !this.metrics.firstCachedFullFrame) this.metrics.firstCachedFullFrame = performance.now();
    if (fresh && !this.metrics.readyCurrentFrame) this.metrics.readyCurrentFrame = performance.now();
    this.preview = null;
  }
  rehydrate(): void {
    const selection = this.selected, entry = selection && this.memory.get(selection.persistentKey);
    if (entry && !this.pending && this.same(selection, this.selection())) this.host.hydrate(entry.frame, entry.light);
  }
  private same(a: Selection | null, b: Selection | null): boolean {
    return !!a && !!b && a.authority === b.authority && a.connection === b.connection && a.scope === b.scope
      && a.input.raw.id === b.input.raw.id && a.persistentKey === b.persistentKey
      && a.light.fingerprint === b.light.fingerprint;
  }
  private address(selection: Selection): CacheAddress | null {
    return selection.scope ? { scope: selection.scope, floor: String(selection.input.raw.id), key: selection.persistentKey } : null;
  }
  private readPreview(selection: Selection, sequence: number): void {
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
    if (this.same(this.selected, selection)) {
      if (this.selected!.fitKey !== selection.fitKey) {
        this.selected = selection; this.published = '';
        if (this.preview?.fitKey !== selection.fitKey) this.preview = null;
        if (this.pending) this.readPreview(selection, this.sequence);
        if (!this.pending) this.metrics.memoryHits++;
      }
      const entry = this.memory.get(selection.persistentKey);
      if (!this.pending && entry && this.host.contains?.(entry.frame, entry.light) === false)
        this.host.hydrate(entry.frame, entry.light);
      return !this.pending;
    }
    const authorityChanged = this.memoryAuthority !== selection.authority
      || this.memoryConnection !== selection.connection || this.memoryScope !== selection.scope;
    if (authorityChanged) { this.memory.clear(); this.areaMemory.clear(); }
    this.memoryAuthority = selection.authority; this.memoryConnection = selection.connection; this.memoryScope = selection.scope;
    const sequence = ++this.sequence; this.scheduler.cancel(); this.selected = selection;
    this.key = `${sequence}|${selection.persistentKey}|${selection.light.fingerprint}`;
    this.failed.clear();
    this.preview = null;
    this.metrics.firstPreview = this.metrics.firstCachedFullFrame = this.metrics.readyCurrentFrame = 0;
    const isCurrent = () => !this.disposed && sequence === this.sequence && this.same(selection, this.selection());
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
        const result = await this.scheduler.run({ kind: 'geometry', input: selection.input,
          disk, memory: warm?.wire, light: selection.light });
        if (!isCurrent()) return;
        if (!result) {
          this.failed.add(this.key); this.metrics.familyFallbacks++; this.preview = null; this.host.changed(); return;
        }
        this.metrics.workerMs.push(result.ms);
        if (this.metrics.workerMs.length > 100) this.metrics.workerMs.shift();
        if (result.producer) this.metrics.producers.push(result.producer);
        if (this.metrics.producers.length > 50) this.metrics.producers.shift();
        const start = performance.now(), frame = decodeGeometryValue(result.wire);
        if (!isFloorGeometryFrame(frame, selection.input)) throw new Error('floor-cache:frame');
        const light = result.light ? decodeGeometryValue(result.light) : undefined;
        if (!isCurrent()) return;
        const entry: Entry = { frame, wire: result.wire!, payload: result.payload || warm?.payload,
          lightKey: selection.light.fingerprint, light };
        this.memory.set(memoryKey, entry);
        while (this.memory.size > 8) this.memory.delete(this.memory.keys().next().value!);
        if (result.hit) this.metrics.diskHits++; else if (warm) this.metrics.memoryHits++; else this.metrics.misses++;
        this.host.hydrate(frame, light); this.readyKey = this.key;
        this.metrics.hydrationMs.push(performance.now() - start);
        if (this.metrics.hydrationMs.length > 100) this.metrics.hydrationMs.shift();
        this.host.changed();
      } catch {
        if (!isCurrent()) return;
        // The shared canonical readers remain the last, bounded degraded
        // path. Never retry an unsupported family on every Lit pass.
        this.memory.delete(memoryKey); this.failed.add(this.key); this.metrics.familyFallbacks++;
        this.preview = null; this.host.changed();
      }
    })();
    return false;
  }
  /** Called only after the card's existing complete-frame paint/resource
   * barrier, with confirmed View source. Never from an editor/optimistic path. */
  publish(preview: FloorPreview, accepted: () => boolean): void {
    const selection = this.selected, key = this.key, sequence = this.sequence;
    if (!selection || this.pending || this.published === key || !accepted()) return;
    const address = this.address(selection), entry = this.memory.get(selection.persistentKey);
    if (!address || !entry?.payload || !validFloorPreview(preview, selection.fitKey)) return;
    this.published = key;
    const text = JSON.stringify(preview), bytes = new TextEncoder().encode(text).length;
    this.metrics.publicationAttempts++; this.metrics.previewBytes = bytes;
    const current = () => !this.disposed && sequence === this.sequence && this.same(selection, this.selection())
      && selection.fitKey === this.selected?.fitKey && accepted();
    // Small bounded preview conversion only; the large L2 text/checksum came
    // from the worker. No large stringify runs after the first live frame.
    void this.store.publish({ address, generation: cacheSha256([selection.persistentKey, selection.fitKey, entry.payload.checksum]),
      created: Date.now(), preview: { text, bytes, checksum: cacheTextChecksum(text) }, geometry: entry.payload }, current)
      .then(published => { if (!published) this.metrics.publicationFailures++; });
  }
  /** Demanded one-floor scalar; a pending navigation preempts this job. */
  private rememberArea(key: string, value: number | null): void {
    this.areaMemory.delete(key); this.areaMemory.set(key, value);
    while (this.areaMemory.size > 256) this.areaMemory.delete(this.areaMemory.keys().next().value!);
  }
  async area(raw: FloorGeometryInput['raw'], key: string, accepted: () => boolean): Promise<number | null | undefined> {
    const selection = this.selected, sequence = this.sequence;
    if (!selection || this.disposed || this.pending) return undefined;
    const current = () => !this.disposed && sequence === this.sequence && this.same(selection, this.selection()) && accepted();
    if (this.areaMemory.has(key)) { const value = this.areaMemory.get(key)!; this.rememberArea(key, value); return value; }
    const address = selection.scope ? { scope: selection.scope, floor: String(raw.id), key } : null;
    const disk = address ? await this.store.area(address) : undefined;
    if (!current()) return undefined;
    if (disk !== undefined) { this.rememberArea(key, disk); return disk; }
    const result = await this.scheduler.run({ kind: 'area', raw }, 'summary');
    if (!result || !current() || result.area === undefined) return undefined;
    if (result.producer) this.metrics.producers.push(result.producer);
    this.rememberArea(key, result.area);
    return result.area;
  }
  persistArea(raw: FloorGeometryInput['raw'], key: string, value: number | null, accepted: () => boolean): void {
    const selection = this.selected;
    if (!selection?.scope || this.pending) return;
    const current = () => !this.disposed && this.same(selection, this.selection()) && accepted();
    void this.store.publishArea({ scope: selection.scope, floor: String(raw.id), key }, value, current);
  }
  invalidate(): void { this.sequence++; this.scheduler.cancel(); this.selected = null;
    this.key = ''; this.readyKey = ''; this.preview = null; }
  dispose(): void { this.disposed = true; this.invalidate(); this.scheduler.dispose(); this.store.close(); }
}
