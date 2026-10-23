/** Incremental spatial/contact index; no DOM and no pairwise pointer-move scan. */
import {
  CONTACT_EPS, contactCoresOverlap, contactRotate, deriveContactShape, joinedContactSide,
  validContactMarker, type ContactMarker, type ContactPoint, type ContactRect, type ContactShape, type ContactWall,
} from './device-contact-geometry';
import type { ContactMasonry } from './device-contact-walls';

export function contactBounds(shape: ContactShape): ContactRect {
  const b = shape.box;
  const points = [[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom]]
    .map((p) => contactRotate(p as ContactPoint, shape.angle));
  return { left: shape.marker.x + Math.min(...points.map((p) => p[0])),
    right: shape.marker.x + Math.max(...points.map((p) => p[0])),
    top: shape.marker.y + Math.min(...points.map((p) => p[1])),
    bottom: shape.marker.y + Math.max(...points.map((p) => p[1])) };
}

export class DeviceContactScene {
  public readonly shapes = new Map<string, ContactShape>();
  public readonly edges = new Map<string, Set<string>>();
  /** Ordinary work counters, useful in performance witnesses; never persisted. */
  public readonly work = { builds: 1, queries: 0, pairs: 0, moves: 0 };
  private readonly buckets = new Map<string, Set<string>>();
  private readonly cells = new Map<string, string[]>();
  private readonly size: number;
  public constructor(markers: readonly ContactMarker[], public readonly walls: readonly ContactWall[],
    public readonly masonry: ContactMasonry = [], private readonly legacy = false) {
    const valid = markers.filter(validContactMarker);
    this.size = Math.max(1, ...valid.map((m) => m.diameter * 2));
    for (const m of valid) {
      const s = deriveContactShape(m, walls);
      this.shapes.set(m.id, s); this.edges.set(m.id, new Set()); this.insert(s);
    }
    for (const s of this.shapes.values()) this.connect(s);
  }
  private keys(b: ContactRect): string[] {
    const out: string[] = [];
    for (let x = Math.floor(b.left / this.size); x <= Math.floor(b.right / this.size); x++) {
      for (let y = Math.floor(b.top / this.size); y <= Math.floor(b.bottom / this.size); y++) out.push(`${x}:${y}`);
    }
    return out;
  }
  private insert(s: ContactShape): void {
    const keys = this.keys(contactBounds(s)); this.cells.set(s.marker.id, keys);
    for (const key of keys) {
      let bucket = this.buckets.get(key);
      if (!bucket) this.buckets.set(key, bucket = new Set());
      bucket.add(s.marker.id);
    }
  }
  public query(box: ContactRect, padding = 0): ContactShape[] {
    this.work.queries++;
    const ids = new Set<string>();
    for (const key of this.keys({ left: box.left - padding, right: box.right + padding,
      top: box.top - padding, bottom: box.bottom + padding })) {
      for (const id of this.buckets.get(key) || []) ids.add(id);
    }
    return [...ids].sort().map((id) => this.shapes.get(id)!);
  }
  private connect(s: ContactShape): void {
    for (const n of this.query(contactBounds(s), CONTACT_EPS)) {
      if (n.marker.id === s.marker.id) continue;
      this.work.pairs++;
      if (joinedContactSide(s, n, !this.legacy||s.marker.precise===true||n.marker.precise===true) && !contactCoresOverlap(s.marker, n.marker)) {
        this.edges.get(s.marker.id)!.add(n.marker.id);
        this.edges.get(n.marker.id)!.add(s.marker.id);
      }
    }
  }
  public component(id: string): string[] {
    const seen = new Set<string>(), queue = [id];
    while (queue.length) {
      const next = queue.pop()!;
      if (seen.has(next) || !this.shapes.has(next)) continue;
      seen.add(next);
      queue.push(...(this.edges.get(next) || []));
    }
    return [...seen].sort();
  }
  /** Return exactly the old/new components whose contour may have changed. */
  public move(id: string, x: number, y: number): Set<string> {
    const old = this.shapes.get(id);
    if (!old || !Number.isFinite(x) || !Number.isFinite(y)) return new Set();
    if (old.marker.x === x && old.marker.y === y) return new Set();
    return this.replace({...old.marker,x,y});
  }
  /** Replace one measured face without rebuilding unrelated spatial buckets. */
  public replace(marker: ContactMarker): Set<string> {
    const id=marker.id, old=this.shapes.get(id);
    if(!old || !validContactMarker(marker)) return new Set();
    const affected = new Set(this.component(id));
    for (const key of this.cells.get(id) || []) {
      const bucket = this.buckets.get(key); bucket?.delete(id);
      if (!bucket?.size) this.buckets.delete(key);
    }
    for (const neighbor of this.edges.get(id) || []) this.edges.get(neighbor)?.delete(id);
    this.edges.set(id, new Set());
    const s = deriveContactShape(marker, this.walls);
    this.shapes.set(id, s); this.insert(s); this.connect(s); this.work.moves++;
    for (const next of this.component(id)) affected.add(next);
    return affected;
  }
  public components(ids: Iterable<string> = this.shapes.keys()): ContactShape[][] {
    const seen = new Set<string>(), out: ContactShape[][] = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const group = this.component(id); group.forEach((key) => seen.add(key));
      if (group.length) out.push(group.map((key) => this.shapes.get(key)!));
    }
    return out;
  }
  public contactedIds(): Set<string> {
    return new Set([...this.shapes].filter(([id, shape]) => this.edges.get(id)?.size || Object.keys(shape.walls).length).map(([id]) => id));
  }
}
