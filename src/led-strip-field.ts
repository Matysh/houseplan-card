/**
 * The linear light field of LED strips (#780, ТЗ §3, §6): its own lazy chunk.
 *
 * Loaded by the LED runtime only when a strip is on in a Glow room and the
 * card has a light scene — the static card with `light_pools: false` never
 * loads it (ТЗ §13.1).
 *
 * The field is the distance field of one continuous strip path with the shared
 * falloff. Visibility remains sampled in bounded pieces, but their visible
 * regions are unioned into one clip before the continuous path is painted.
 * That separation keeps walls opaque without exposing piece boundaries in the
 * gradient at straight cuts or corners.
 */
import { noChange, svg, type TemplateResult } from 'lit';
import { Directive, directive, type PartInfo } from 'lit/directive.js';
import { repeat } from 'lit/directives/repeat.js';
import {
  createGlowRuntimeState, disposeGlowRuntime, forgetGlowSpace, GLOW_FALLOFF,
  pruneGlowSources, transitionGlowSource, type GlowRuntimeHost,
  type GlowRuntimeState, type LightBarrierScene, type LightRoomPolygon,
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
 * Bands of the luminance field. The field is painted once per strip rather
 * than once per visibility piece, so 48 steps remain bounded while keeping
 * neighbouring alpha levels below the threshold that showed as rings.
 */
export const LED_FIELD_BANDS = 48;

const pts = (points: readonly number[][]): Pt[] => points.map((p) => [p[0], p[1]] as Pt);

interface FieldPiece {
  d: string;
  /** Visibility fans of the piece's emitters, including full discs when nothing blocks them. */
  clip: string[];
}

interface FieldGeometry {
  /** One continuous path; never split at visibility/cache boundaries. */
  d: string;
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
 * Barrier visibility still needs angular samples, but an unobstructed emitter
 * is represented by SVG arcs rather than by that polygon. This keeps a free
 * end truly round at every zoom without increasing the retained fan count.
 */
const LED_ARC_STEPS = 12;

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

/** Exact disc in one path: two half-circle arcs avoid a polygonal free end. */
const discPath = (center: Pt, radius: number): string => {
  const left = coord(center[0] - radius), right = coord(center[0] + radius);
  const cy = coord(center[1]), r = coord(radius);
  return `M${left} ${cy} A${r} ${r} 0 1 0 ${right} ${cy} A${r} ${r} 0 1 0 ${left} ${cy} Z`;
};

/**
 * Preserve hard obstacle edges, but join consecutive points on the radius by
 * exact circular arcs. The visibility sweep is angle-sorted, so sweep=1 also
 * covers the final 2π → 0 seam without a chord.
 */
const visibilityPath = (center: Pt, radius: number, ring: readonly number[][]): string => {
  if (ring.length < 3) return '';
  const tolerance = Math.max(1e-9, radius * 1e-7);
  const onRadius = (p: readonly number[]): boolean =>
    Math.abs(Math.hypot(p[0] - center[0], p[1] - center[1]) - radius) <= tolerance;
  let d = `M${coord(ring[0][0])} ${coord(ring[0][1])}`;
  for (let i = 1; i <= ring.length; i++) {
    const previous = ring[i - 1], point = ring[i % ring.length];
    d += onRadius(previous) && onRadius(point)
      ? ` A${coord(radius)} ${coord(radius)} 0 0 1 ${coord(point[0])} ${coord(point[1])}`
      : ` L${coord(point[0])} ${coord(point[1])}`;
  }
  return `${d} Z`;
};

/**
 * What a piece's emitters can see (ТЗ §6): the visibility fans of the shared
 * `visibilityPolygon` with the scene's occluders. When no occluder is close,
 * explicit full-disc fans still enter the shared clip. SVG clip paths ignore
 * strokes, so an open stroked path cannot stand in for that free-space region:
 * doing so dropped every free part as soon as one wall-following part made the
 * clip active (#785). The floor itself is one clip of the whole field layer
 * (`fieldFloor`).
 */
function fans(emitters: readonly Pt[], radius: number, scene: LightBarrierScene): string[] {
  const reach = radius * 1.01;
  return emitters.flatMap((p) => {
    const blocked = scene.occluders.some((seg) => seg?.length >= 4
      && segmentDistance(p, seg) < reach);
    if (!blocked) return [discPath(p, radius)];
    const fan = visibilityPolygon([p[0], p[1]], radius, scene.occluders, LED_ARC_STEPS);
    const path = visibilityPath(p, radius, fan);
    return path ? [path] : [];
  });
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
  const closed = isClosedStrip(path);
  const visiblePath = closed ? path.slice(0, -1) : path;
  const d = `${visiblePath.map((p, k) => `${k ? 'L' : 'M'}${coord(p[0])} ${coord(p[1])}`).join(' ')}${closed ? ' Z' : ''}`;
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
    let clip: string[];
    try { clip = fans(emitters, r, input.scene); } catch { continue; } // fail-dark for this piece
    if (!clip.length) continue;
    pieces.push({ d: piece.map((p, k) => `${k ? 'L' : 'M'}${coord(p[0])} ${coord(p[1])}`).join(' '), clip });
    for (const p of piece) {
      minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]);
      maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]);
    }
  }
  if (!pieces.length) return null;
  return { d, pieces, box: { x: minX - r, y: minY - r, w: maxX - minX + 2 * r, h: maxY - minY + 2 * r } };
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
  requestUpdate: () => void;
  isConnected: () => boolean;
  reducedMotion?: () => boolean;
}

const fieldCaches = new WeakMap<object, LedFieldCache>();
interface FieldLifecycle {
  state: GlowRuntimeState;
  host: GlowRuntimeHost;
  callbacks: Pick<LedFieldInput, 'requestUpdate' | 'isConnected' | 'reducedMotion'>;
  spaceId: string;
}
const fieldLifecycles = new WeakMap<object, FieldLifecycle>();

function fieldLifecycle(input: LedFieldInput): FieldLifecycle {
  let lifecycle = fieldLifecycles.get(input.owner);
  if (!lifecycle) {
    const callbacks = {
      requestUpdate: input.requestUpdate,
      isConnected: input.isConnected,
      reducedMotion: input.reducedMotion,
    };
    const host: GlowRuntimeHost = {
      window: () => window,
      isConnected: () => callbacks.isConnected(),
      requestUpdate: () => callbacks.requestUpdate(),
      reducedMotion: () => callbacks.reducedMotion?.()
        ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ?? false,
    };
    lifecycle = { state: createGlowRuntimeState(), host, callbacks, spaceId: '' };
    fieldLifecycles.set(input.owner, lifecycle);
  } else {
    lifecycle.callbacks.requestUpdate = input.requestUpdate;
    lifecycle.callbacks.isConnected = input.isConnected;
    lifecycle.callbacks.reducedMotion = input.reducedMotion;
  }
  if (lifecycle.spaceId && lifecycle.spaceId !== input.spaceId) {
    forgetGlowSpace(lifecycle.state, lifecycle.host, lifecycle.spaceId);
  }
  lifecycle.spaceId = input.spaceId;
  return lifecycle;
}

/** Disconnect (ТЗ §13.2): no retained entry of this owner. */
export function releaseLedField(owner: object): void {
  fieldCaches.get(owner)?.clear();
  fieldCaches.delete(owner);
  const lifecycle = fieldLifecycles.get(owner);
  if (lifecycle) disposeGlowRuntime(lifecycle.state, lifecycle.host);
  fieldLifecycles.delete(owner);
}
/** Keep rendering while an off transition still owns a DOM node. */
export function hasLedField(owner: object): boolean {
  return !!fieldLifecycles.get(owner)?.state.renderedSources.size;
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
  const lifecycle = fieldLifecycle(input);
  const scene = input.scene;
  const seen = new Set<string>();
  const fields = input.views.flatMap((view) => {
    const lifecycleKey = `${input.spaceId}|${view.strip.id}`;
    seen.add(lifecycleKey);
    const active = view.glow && view.state === 'on' && !!view.appearance;
    const transition = transitionGlowSource(lifecycle.state, lifecycle.host, lifecycleKey, active);
    if (!transition) return [];
    if (active && view.appearance) lifecycle.state.lastAppearance.set(lifecycleKey, view.appearance);
    const appearance = active ? view.appearance : lifecycle.state.lastAppearance.get(lifecycleKey) ?? null;
    if (!appearance) return [];
    const key = `${view.strip.id}|${pointsKey(view.strip.points)}|${view.radius.toFixed(5)}|${scene.fingerprint}`;
    const geometry = cache.read(key, () => buildFieldGeometry({
      points: view.strip.points,
      radius: view.radius,
      scene,
      polygons: input.polygons,
      faces: input.faces,
      spaceId: input.spaceId,
    }));
    return geometry ? [{ view: { ...view, appearance }, geometry, transition }] : [];
  });
  pruneGlowSources(lifecycle.state, lifecycle.host, input.spaceId, seen);
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
    ${repeat(fields, ({ view }) => view.strip.id, ({ view, geometry, transition }) => {
      const id = `${cache.id(view.strip.id)}`;
      const r = view.radius;
      const box = geometry.box;
      const closed = isClosedStrip(pts(view.strip.points));
      return memo([geometry, transition.entering, transition.leaving, view.appearance.c,
        view.appearance.alpha, r, id], () => svg`<g
          class="glow-spot led-field ${transition.entering ? 'is-entering' : ''} ${transition.leaving ? 'is-leaving' : ''}"
          data-led-field="${view.strip.id}" data-led-phase="${transition.entering ? 'entering' : transition.leaving ? 'leaving' : 'visible'}"
          data-pieces="${geometry.pieces.length}" data-bands="${LED_FIELD_BANDS}"
          data-closed="${closed ? 'true' : 'false'}">
        <defs>
          <clipPath id="hp-led-visible-${id}">
            ${geometry.pieces.map((piece) => svg`<path d="${piece.clip.join(' ')}"></path>`)}
          </clipPath>
          <mask id="hp-led-mask-${id}" maskUnits="userSpaceOnUse"
            x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
            color-interpolation="sRGB" style="mask-type:luminance">
            <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="black"></rect>
            <g clip-path="url(#hp-led-visible-${id})">
              ${bands.map((band) => svg`<path d="${geometry.d}" fill="none" stroke="${grey(band.value)}"
                stroke-width="${2 * band.half * r}" stroke-linecap="round" stroke-linejoin="round"></path>`)}
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
