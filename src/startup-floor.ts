import { StartupFloorStore, type StartupAddress, type StartupFloorView } from './startup-floor-store';
import { loadStartupFloorImage } from './startup-floor-svg';
import type { StartupGeometry, StartupRemoteAddress } from './startup-floor-wire';

export interface StartupSelection extends StartupAddress {
  authority: object;
  connection: number;
  size: readonly [number, number] | null;
  zoomHint: number | null;
  remote?: StartupRemoteAddress;
}
interface Ready extends StartupFloorView { url: string; remote: boolean }
export interface StartupCapture extends Omit<StartupFloorView, 'image'> { image: Blob | null; geometry?: StartupGeometry }
export interface StartupRemoteSource {
  read(selection: StartupSelection, signal: AbortSignal): Promise<StartupFloorView | null>;
  publish(selection: StartupSelection, packet: StartupGeometry, signal: AbortSignal): Promise<boolean>;
}
const key = (s: StartupSelection) => JSON.stringify([s.scope, s.floor, s.variant, s.revision]);
const portableKey = (scope: string, floor: string, projection: string, rotation: number, source: readonly string[]) =>
  JSON.stringify([scope, floor, projection, rotation, source[0], source[1]]);
const same = (a: StartupSelection, b: StartupSelection) =>
  a.authority === b.authority && a.connection === b.connection && a.zoomHint === b.zoomHint && key(a) === key(b)
  && a.remote?.variant === b.remote?.variant && a.remote?.source[0] === b.remote?.source[0]
  && a.remote?.source[1] === b.remote?.source[1];
const sameSize = (a: readonly [number, number], b: readonly [number, number]) =>
  Math.abs(a[0] - b[0]) <= .5 && Math.abs(a[1] - b[1]) <= .5;

export class StartupFloor {
  private readonly store = new StartupFloorStore();
  private reading?: { selection: StartupSelection; abort: AbortController };
  private writing?: { selection: StartupSelection; abort: AbortController };
  private image?: Ready;
  private tried?: StartupSelection;
  private readonly written = new Set<string>();
  private readonly published = new Set<string>();
  private remoteId(s: StartupSelection) {
    const remote = s.remote;
    return remote ? portableKey(s.scope, s.floor, remote.projection, remote.rotation, remote.source) : '';
  }
  /** Revalidate volatile fit while cold or capturing, not on every state tick
   * after this accepted content has been considered for a background write. */
  wantsPortable(scope: string, floor: string, projection: string, rotation: number, source: readonly string[]): boolean {
    return this.awaitsLive || !this.published.has(portableKey(scope, floor, projection, rotation, source));
  }
  finishPortable(scope: string, floor: string, projection: string, rotation: number, source: readonly string[]): void {
    this.rememberPortable(portableKey(scope, floor, projection, rotation, source));
  }
  private rememberPortable(id: string): void {
    if (!id) return;
    this.published.add(id);
    if (this.published.size > 32) this.published.delete(this.published.values().next().value!);
  }
  private ready = false;
  private disposed = false;
  readonly facts = { status: 'idle', capture: 'idle', bytes: 0, shown: 0, live: 0, remote: 'idle' };

  // Opening the image database is part of the authorized read/write. Do not
  // compete with the worker geometry cache while a local hint is only provisional.
  constructor(private readonly current: () => StartupSelection | null, private readonly changed: () => void,
    private readonly remote?: StartupRemoteSource) {}
  prepare(): void { if (!this.disposed) this.store.preopen(); }
  get awaitsLive(): boolean { return !this.ready && !this.disposed; }
  canCapture(selection: StartupSelection): boolean {
    return !this.disposed && !this.writing && (!this.written.has(key(selection))
      || !!selection.remote && !!this.remote && !this.published.has(this.remoteId(selection)));
  }
  skipImage(): void { this.ready = true; this.revoke(); }
  private matches(selection: StartupSelection, size = false): boolean {
    const current = !this.disposed && this.current();
    return !!current && same(current, selection)
      && (!size || !!current.size && !!selection.size && sameSize(current.size, selection.size));
  }
  /** Only cold presentation can display a recalled image. Cache reads never
   * own readiness, block the ordinary frame, or restart after a miss. */
  observe(selection: StartupSelection | null): Ready | undefined {
    if (this.writing && (!selection || !same(this.writing.selection, selection)
      || !selection.size || !this.writing.selection.size || !sameSize(this.writing.selection.size, selection.size))) {
      this.writing.abort.abort(); this.writing = undefined;
    }
    if (this.disposed || this.ready) return;
    if (this.tried && (!selection || !same(this.tried, selection))) this.revoke();
    if (!selection || this.tried) return this.image && selection?.size && sameSize(selection.size, this.image.size) ? this.image : undefined;
    this.tried = selection;
    this.facts.status = 'reading';
    const owner = this.reading = { selection, abort: new AbortController() };
    const current = () => this.reading === owner && !this.ready && this.matches(selection);
    void (async () => {
      try {
        let packet = await this.store.read(selection);
        let remote = false;
        if (!current()) return;
        if (packet?.zoomHint !== selection.zoomHint || packet && selection.size && !sameSize(packet.size, selection.size)) {
          if (packet) this.facts.status = 'camera-miss';
          packet = null;
        }
        if (!packet && selection.remote && this.remote) {
          this.facts.remote = 'reading';
          packet = await this.remote.read(selection, owner.abort.signal);
          if (!current()) return;
          this.facts.remote = packet ? 'decoded' : 'miss';
          remote = !!packet;
        }
        if (!packet) {
          if (this.facts.status !== 'camera-miss') this.facts.status = this.store.readStatus;
          return;
        }
        const url = await loadStartupFloorImage(packet.image, owner.abort.signal, remote);
        if (!current()) { if (url) URL.revokeObjectURL(url); return; }
        if (!url) { this.facts.status = 'invalid'; return; }
        this.image = { ...packet, url, remote };
        this.facts.status = 'decoded';
        this.changed();
      } catch { if (current()) { this.facts.status = 'invalid'; if (this.facts.remote === 'reading') this.facts.remote = 'invalid'; } }
      finally { if (this.reading === owner) this.reading = undefined; }
    })();
    return undefined;
  }
  shown(): void {
    if (!this.image || this.facts.shown) return;
    this.facts.shown = performance.now(); this.facts.status = 'shown';
    if (this.image.remote) this.facts.remote = 'shown';
  }
  publishedLive(): boolean {
    if (this.ready) { if (!this.facts.live) this.facts.live = performance.now(); return false; }
    const shown = !!this.facts.shown;
    this.ready = true; this.facts.live = performance.now();
    this.revoke();
    return shown;
  }
  private revoke(): void {
    this.reading?.abort.abort(); this.reading = undefined;
    if (this.image) URL.revokeObjectURL(this.image.url);
    this.image = this.tried = undefined;
    if (!this.ready) this.facts.shown = 0;
  }

  capture(selection: StartupSelection, work: (signal: AbortSignal, portable: boolean) => Promise<StartupCapture>, confirmed: () => boolean): void {
    const id = key(selection);
    if (!this.canCapture(selection)) return;
    const owner = this.writing = { selection, abort: new AbortController() };
    const current = () => this.writing === owner && this.matches(selection, true) && confirmed();
    const remember = () => {
      this.written.add(id);
      if (this.written.size > 32) this.written.delete(this.written.values().next().value!);
    };
    // Schedule after the interactive frame/editor transition is settled.
    this.facts.capture = 'queued';
    const capture = () => { void (async () => {
      try {
        if (!current()) return;
        const existing = await this.store.read(selection);
        const cached = existing && existing.zoomHint === selection.zoomHint && selection.size
          && sameSize(existing.size, selection.size) && this.facts.status !== 'invalid';
        const remoteId = this.remoteId(selection);
        const portable = !!selection.remote && !!this.remote && !this.published.has(remoteId);
        if (cached && !portable) {
          if (current()) { remember(); this.facts.capture = 'cached'; } return;
        }
        if (!current()) return;
        this.facts.capture = 'working';
        const { geometry, image, ...packet } = await work(owner.abort.signal, portable);
        if (!current()) return;
        this.facts.bytes = image?.size ?? 0;
        const stored = cached || !!image && await this.store.write(selection, { ...packet, image }, current);
        if (current()) { remember(); this.facts.capture = stored ? 'stored' : 'storage'; }
        if (portable && current()) {
          // Record this attempt separately: an old IDB hit must still be
          // allowed to seed the server once without a canonical plan save.
          if (geometry) {
            this.facts.remote = this.facts.remote === 'shown' ? 'shown' : 'publishing';
            const ok = await this.remote!.publish(selection, geometry, owner.abort.signal);
            if (current() && this.facts.remote !== 'shown') this.facts.remote = ok ? 'stored' : 'unavailable';
          } else if (this.facts.remote !== 'shown') this.facts.remote = 'unsupported-vector';
          if (current()) this.rememberPortable(remoteId);
        }
      } catch (error) {
        if (current()) {
          const message = error instanceof Error ? error.message : '';
          this.facts.capture = ['vector-size','asset-size','asset-format','asset-unavailable','asset-bounds','unsupported-vector'].includes(message)
            ? message : 'unavailable';
          remember();
          this.rememberPortable(this.remoteId(selection));
        }
      } finally {
        if (this.writing === owner) this.writing = undefined;
      }
    })(); };
    setTimeout(() => {
      if (!current()) { if (this.writing === owner) this.writing = undefined; return; }
      // Give the accepted frame and the canonical geometry cache their own
      // turn before starting optional SVG work; the canvas never waits.
      if (typeof globalThis.requestIdleCallback === 'function') globalThis.requestIdleCallback(capture, { timeout: 1_000 });
      else capture();
    }, 150);
  }
  retire(): void {
    this.revoke();
    this.writing?.abort.abort(); this.writing = undefined;
  }
  dispose(): void { this.disposed = true; this.retire(); this.store.close(); }
}
