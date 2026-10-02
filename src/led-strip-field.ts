/**
 * The linear light field of LED strips (#780, ТЗ §3, §6): its own lazy chunk.
 *
 * Loaded by the LED runtime only when a strip is on in a Glow room and the
 * card has a light scene — the static card with `light_pools: false` never
 * loads it (ТЗ §13.1).
 *
 * The field is the exact distance field of the strip with the shared falloff:
 * every piece of the strip paints opaque grey bands of a luminance mask (round
 * caps and joins, so one piece never doubles itself), pieces meet through
 * `mix-blend-mode: lighten` — the maximum, i.e. the nearest piece — and each
 * piece is clipped to the floor its own emitters can see. A hidden part never
 * lights through another part's visibility, a closed strip has no seam and a
 * corner no double brightness.
 */
import { noChange, nothing, svg, type TemplateResult } from 'lit';
import { Directive, directive, type PartInfo } from 'lit/directive.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  GLOW_FALLOFF, type LightBarrierScene, type LightRoomPolygon,
} from './glow-scene';
import { visibilityPolygon } from './light-visibility';
import {
  compactPoints, emitterSamples, isClosedStrip, type FaceContext, type Pt,
} from './led-strip-geometry';
import type { LedStripView } from './led-strip-runtime';

/**
 * `guard` without its own shared chunk: an unchanged field (same cached
 * geometry, state and colour) is not diffed again on a camera move or an
 * unrelated HA tick.
 */
class Memo extends Directive {
  private deps: readonly unknown[] | null = null;
  constructor(part: PartInfo) { super(part); }
  render(_deps: readonly unknown[], build: () => unknown): unknown { return build(); }
  update(_part: unknown, [deps, build]: [readonly unknown[], () => unknown]): unknown {
    if (this.deps && this.deps.length === deps.length && deps.every((dep, i) => dep === this.deps![i])) return noChange;
    this.deps = deps;
    return build();
  }
}
const memo = directive(Memo);

export const LED_FIELD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

/**
 * Bands of the luminance field. Twelve keep the midpoint error at the r/2
 * visual acceptance point below 10%, without multiplying every visibility
 * piece into sixteen SVG paint nodes.
 */
export const LED_FIELD_BANDS = 12;

const pts = (points: readonly number[][]): Pt[] => points.map((p) => [p[0], p[1]] as Pt);

interface FieldPiece {
  d: string;
  /** Visibility fans of the piece's emitters; `null` = nothing blocks within the radius. */
  clip: string[] | null;
}

interface FieldGeometry {
  pieces: FieldPiece[];
  box: { x: number; y: number; w: number; h: number };
}

/** Bounded per-space cache: shape × radius × barrier revision (ТЗ §13.2). */
export class LedFieldCache {
  private entries = new Map<string, FieldGeometry | null>();
  private space = '';
  constructor(private readonly limit = 50) {}
  get size(): number { return this.entries.size; }
  /** Recompute counter for the performance witness: geometry, not paint. */
  recomputes = 0;
  /** Stable DOM ids per strip of the shown space: a re-render rebuilds no masks. */
  private ids = new Map<string, number>();
  id(stripId: string): number {
    let id = this.ids.get(stripId);
    if (id == null) { id = this.ids.size + 1; this.ids.set(stripId, id); }
    return id;
  }
  forSpace(spaceId: string): void {
    if (spaceId !== this.space) { this.entries.clear(); this.ids.clear(); this.space = spaceId; }
  }
  read(key: string, build: () => FieldGeometry | null): FieldGeometry | null {
    if (this.entries.has(key)) {
      const value = this.entries.get(key) ?? null;
      this.entries.delete(key);
      this.entries.set(key, value);
      return value;
    }
    this.recomputes += 1;
    const value = build();
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return value;
  }
  clear(): void { this.entries.clear(); this.ids.clear(); this.space = ''; }
  /** Retained visibility fans (the per-emitter source cache, ТЗ §13.2: ≤ 2500). */
  get sources(): number {
    let n = 0;
    for (const value of this.entries.values()) for (const piece of value?.pieces || []) n += piece.clip?.length ?? 0;
    return n;
  }
}

const pointsKey = (points: readonly number[][]): string =>
  points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');

/**
 * Fans of the field only bound the zero-alpha outer rim. A 16-gon keeps its
 * maximum radial error below 2%; every visible acceptance point at r/2 stays
 * well inside it, while the heavy 50×50 scene carries half as many clip
 * segments through every camera rasterization.
 */
const LED_ARC_STEPS = 16;

const segmentDistance = (p: Pt, s: readonly number[]): number => {
  const dx = s[2] - s[0], dy = s[3] - s[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - s[0]) * dx + (p[1] - s[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - s[0] - t * dx, p[1] - s[1] - t * dy);
};

/** SVG does not gain visible precision from JS's full decimal expansion. */
const coord = (value: number): string => {
  const rounded = Math.round(value * 10_000) / 10_000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const ringPath = (ring: readonly number[][]): string =>
  `${ring.map((p, k) => `${k ? 'L' : 'M'}${coord(p[0])} ${coord(p[1])}`).join(' ')} Z`;

/**
 * What a piece's emitters can see (ТЗ §6): the visibility fans of the shared
 * `visibilityPolygon` with the scene's occluders, kept as separate paths of
 * one clipPath (SVG unions the children) — no boolean pass per piece. `null`
 * means no occluder is within the radius of any emitter: every fan is a full
 * disc and the 2r-wide bands already bound the light. The floor itself is one
 * clip of the whole field layer (`fieldFloor`).
 */
function fans(emitters: readonly Pt[], radius: number, scene: LightBarrierScene): string[] | null {
  const reach = radius * 1.01;
  if (!scene.occluders.some((seg) => seg?.length >= 4
      && emitters.some((p) => segmentDistance(p, seg) < reach))) return null;
  return emitters
    .map((p) => visibilityPolygon([p[0], p[1]], radius, scene.occluders, LED_ARC_STEPS))
    .filter((fan) => fan.length >= 3)
    .map(ringPath);
}

/** The floor clip of the whole field layer, built once per scene. */
const floorPaths = new WeakMap<LightBarrierScene, string[]>();
function fieldFloor(scene: LightBarrierScene): string[] {
  let paths = floorPaths.get(scene);
  if (!paths) {
    paths = scene.floor.filter((ring) => ring.length >= 3).map(ringPath);
    floorPaths.set(scene, paths);
  }
  return paths;
}

/**
 * Pieces of a strip for the field (ТЗ §6, §13.2): the stored polyline is cut
 * into consecutive pieces no longer than the radius — short segments of a
 * dense strip share one piece, a long one is split — and every piece is
 * clipped to the union of what its own emitters see. Emitters keep every
 * vertex and the radius/4 spacing of `emitterSamples`, thinned to radius/4 on
 * dense strips; a piece whose emitters are all inside a body emits nothing; a
 * failed clip makes that piece dark, never an unclipped field.
 */
export function buildFieldGeometry(input: {
  points: readonly number[][];
  radius: number;
  scene: LightBarrierScene;
  polygons: readonly LightRoomPolygon[];
  faces: FaceContext | null;
  spaceId: string;
}): FieldGeometry | null {
  const path = compactPoints(pts(input.points));
  if (path.length < 2 || !(input.radius > 0)) return null;
  const r = input.radius;
  // Consecutive pieces of at most r along the polyline.
  const runs: Pt[][] = [];
  let run: Pt[] = [path[0]];
  let left = r;
  for (let i = 1; i < path.length; i++) {
    let a = path[i - 1];
    const b = path[i];
    let len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (len > left + 1e-12) {
      const t = left / len;
      const cut: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      run.push(cut);
      runs.push(run);
      run = [cut];
      a = cut;
      len -= left;
      left = r;
    }
    run.push(b);
    left -= len;
  }
  if (run.length > 1) runs.push(run);
  const pieces: FieldPiece[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const piece of runs) {
    const emitters: Pt[] = [];
    for (const p of emitterSamples(piece, input.faces, r / 4)) {
      const last = emitters[emitters.length - 1];
      if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= r / 4) emitters.push(p);
    }
    if (!emitters.length) continue;
    let clip: string[] | null;
    try { clip = fans(emitters, r, input.scene); } catch { continue; } // fail-dark for this piece
    if (clip && !clip.length) continue;
    pieces.push({ d: piece.map((p, k) => `${k ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' '), clip });
    for (const p of piece) {
      minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
    }
  }
  if (!pieces.length) return null;
  return { pieces, box: { x: minX - r, y: minY - r, w: maxX - minX + 2 * r, h: maxY - minY + 2 * r } };
}

/** The shared falloff at a relative distance 0…1 (GLOW_FALLOFF, linear between stops). */
export function falloffAt(fraction: number): number {
  const at = Math.max(0, Math.min(1, fraction)) * 100;
  for (let i = 1; i < GLOW_FALLOFF.length; i++) {
    const [o0, v0] = GLOW_FALLOFF[i - 1];
    const [o1, v1] = GLOW_FALLOFF[i];
    if (at <= o1) return v0 + ((v1 - v0) * (at - o0)) / Math.max(1e-9, o1 - o0);
  }
  return 0;
}

const grey = (value: number): string => {
  const level = Math.round(Math.max(0, Math.min(1, value)) * 255);
  return `rgb(${level},${level},${level})`;
};

export interface LedFieldInput {
  views: readonly LedStripView[];
  scene: LightBarrierScene | null;
  polygons: readonly LightRoomPolygon[];
  faces: FaceContext | null;
  spaceId: string;
  /** The card that owns the bounded cache (one per card, gone with it). */
  owner: object;
}

const fieldCaches = new WeakMap<object, LedFieldCache>();
/** Disconnect (ТЗ §13.2): no retained entry of this owner. */
export function releaseLedField(owner: object): void {
  fieldCaches.get(owner)?.clear();
  fieldCaches.delete(owner);
}
/** The performance witness: what this owner retains right now. */
export function ledFieldStats(owner: object): { visibility: number; sources: number; recomputes: number } {
  const cache = fieldCaches.get(owner);
  return { visibility: cache?.size ?? 0, sources: cache?.sources ?? 0, recomputes: cache?.recomputes ?? 0 };
}
export function ledFieldCache(owner: object): LedFieldCache {
  let cache = fieldCaches.get(owner);
  if (!cache) {
    cache = new LedFieldCache();
    fieldCaches.set(owner, cache);
  }
  return cache;
}

/**
 * The linear fields of the strips that are on in a Glow room. Fade uses the
 * shared spot transition (`.glow-spot`, GLOW_FADE_MS) — no animation system of
 * its own; an off strip keeps its node at opacity 0, so a fade-out completes
 * and leaves no residual light.
 */
export function renderLedField(input: LedFieldInput): TemplateResult {
  if (!input.scene) return svg`` as unknown as TemplateResult;
  const cache = ledFieldCache(input.owner);
  cache.forSpace(input.spaceId);
  const scene = input.scene;
  const fields = input.views.flatMap((view) => {
    if (!view.glow || view.state === 'unavailable') return [];
    const key = `${view.strip.id}|${pointsKey(view.strip.points)}|${view.radius.toFixed(5)}|${scene.fingerprint}`;
    const geometry = cache.read(key, () => buildFieldGeometry({
      points: view.strip.points,
      radius: view.radius,
      scene,
      polygons: input.polygons,
      faces: input.faces,
      spaceId: input.spaceId,
    }));
    return geometry ? [{ view, geometry }] : [];
  });
  if (!fields.length) return svg`` as unknown as TemplateResult;
  const bands = Array.from({ length: LED_FIELD_BANDS }, (_, k) => {
    const outer = 1 - k / LED_FIELD_BANDS;
    const inner = 1 - (k + 1) / LED_FIELD_BANDS;
    return { half: outer, value: falloffAt((outer + inner) / 2) };
  });
  // The performance witness (led-strips-v1) reads the bounded cache from the DOM.
  return svg`<g class="led-fields" pointer-events="none" aria-hidden="true"
      data-led-cache="${cache.size}" data-led-recomputes="${cache.recomputes}">
    <defs><clipPath id="hp-led-floor">${fieldFloor(scene).map((d) => svg`<path d="${d}"></path>`)}</clipPath></defs>
    <g clip-path="url(#hp-led-floor)">
    ${repeat(fields, ({ view }) => view.strip.id, ({ view, geometry }) => {
      const id = `${cache.id(view.strip.id)}`;
      const r = view.radius;
      const on = view.state === 'on' && !!view.appearance;
      const box = geometry.box;
      const closed = isClosedStrip(pts(view.strip.points));
      const clipped = geometry.pieces.flatMap((piece, k): Array<FieldPiece & { clip: string[]; clipId: number }> => piece.clip
        ? [{ ...piece, clip: piece.clip, clipId: k }] : []);
      const free = geometry.pieces.filter((piece) => !piece.clip).map((piece) => piece.d).join(' ');
      const paint = [...clipped, ...(free ? [{ d: free, clip: null, clipId: -1 }] : [])];
      return memo([geometry, on, view.appearance?.c, view.appearance?.alpha, r, id], () => svg`<g class="glow-spot led-field ${on ? '' : 'is-leaving'}" data-led-field="${view.strip.id}"
          data-pieces="${geometry.pieces.length}" data-closed="${closed ? 'true' : 'false'}">
        <defs>
          ${clipped.map((piece) => svg`<clipPath id="hp-led-clip-${id}-${piece.clipId}">
            ${''/* Subpaths of one path have the same union semantics in a clipPath,
                    without one DOM node per emitter. */}
            <path d="${piece.clip.join(' ')}"></path>
          </clipPath>`)}
          <mask id="hp-led-mask-${id}" maskUnits="userSpaceOnUse"
            x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
            color-interpolation="sRGB" style="mask-type:luminance">
            <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="black"></rect>
            <g style="isolation:isolate">
              ${paint.map((piece) => svg`<g style="mix-blend-mode:lighten"
                  clip-path=${piece.clip ? `url(#hp-led-clip-${id}-${piece.clipId})` : nothing}>
                ${bands.map((band) => svg`<path d="${piece.d}" fill="none" stroke="${grey(band.value)}"
                  stroke-width="${2 * band.half * r}" stroke-linecap="round" stroke-linejoin="round"></path>`)}
              </g>`)}
            </g>
          </mask>
        </defs>
        <rect class="glow-pool led-pool" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
          fill="${view.appearance?.c ?? 'transparent'}" fill-opacity="${(view.appearance?.alpha ?? 0).toFixed(4)}"
          mask="url(#hp-led-mask-${id})"></rect>
      </g>`);
    })}
    </g>
  </g>` as unknown as TemplateResult;
}
