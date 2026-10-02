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
import { svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import {
  GLOW_FALLOFF, buildGlowClipGeometry, type LightBarrierScene, type LightRoomPolygon,
} from './glow-scene';
import {
  compactPoints, emitterSamples, isClosedStrip, type FaceContext, type Pt,
} from './led-strip-geometry';
import type { LedStripView } from './led-strip-runtime';

export const LED_FIELD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

/** Bands of the luminance field: 16 steps keep a band under 7 % of the range. */
export const LED_FIELD_BANDS = 16;

const pts = (points: readonly number[][]): Pt[] => points.map((p) => [p[0], p[1]] as Pt);

interface FieldPiece {
  d: string;
  clip: string[];
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
  forSpace(spaceId: string): void {
    if (spaceId !== this.space) { this.entries.clear(); this.space = spaceId; }
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
  clear(): void { this.entries.clear(); this.space = ''; }
}

const pointsKey = (points: readonly number[][]): string =>
  points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');

/**
 * Pieces of a strip for the field: stored segments cut to at most the radius,
 * each with the union of what its own emitters see (ТЗ §6). A piece whose
 * emitters are all inside a body emits nothing; a failed clip makes that piece
 * dark (fail-dark), never an unclipped field.
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
  const pieces: FieldPiece[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.ceil(len / r));
    for (let k = 0; k < count; k++) {
      const p0: Pt = [a[0] + ((b[0] - a[0]) * k) / count, a[1] + ((b[1] - a[1]) * k) / count];
      const p1: Pt = [a[0] + ((b[0] - a[0]) * (k + 1)) / count, a[1] + ((b[1] - a[1]) * (k + 1)) / count];
      const samples = emitterSamples([p0, p1], input.faces, r / 4);
      if (!samples.length) continue;
      const clip: string[] = [];
      let failed = false;
      for (const source of samples) {
        try {
          const lit = buildGlowClipGeometry({
            spaceId: input.spaceId,
            source: { x: source[0], y: source[1] },
            radius: r,
            scene: input.scene,
            polygons: input.polygons,
            onBoundsFailure: () => { failed = true; },
          }).lit;
          clip.push(...lit);
        } catch {
          failed = true;
        }
      }
      if (failed || !clip.length) continue;
      pieces.push({ d: `M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]}`, clip });
      minX = Math.min(minX, p0[0], p1[0]); minY = Math.min(minY, p0[1], p1[1]);
      maxX = Math.max(maxX, p0[0], p1[0]); maxY = Math.max(maxY, p0[1], p1[1]);
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

/** Stable DOM ids per strip: a re-render must not rebuild masks and clips. */
const fieldIds = new Map<string, number>();
const fieldId = (spaceId: string, stripId: string): number => {
  const key = `${spaceId}|${stripId}`;
  let id = fieldIds.get(key);
  if (id == null) {
    id = fieldIds.size + 1;
    fieldIds.set(key, id);
  }
  return id;
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
  return svg`<g class="led-fields" pointer-events="none" aria-hidden="true">
    ${repeat(fields, ({ view }) => view.strip.id, ({ view, geometry }) => {
      const id = `${fieldId(input.spaceId, view.strip.id)}`;
      const r = view.radius;
      const on = view.state === 'on' && !!view.appearance;
      const box = geometry.box;
      const closed = isClosedStrip(pts(view.strip.points));
      return svg`<g class="glow-spot led-field ${on ? '' : 'is-leaving'}" data-led-field="${view.strip.id}"
          data-pieces="${geometry.pieces.length}" data-closed="${closed ? 'true' : 'false'}">
        <defs>
          ${geometry.pieces.map((piece, k) => svg`<clipPath id="hp-led-clip-${id}-${k}">
            ${piece.clip.map((d) => svg`<path d="${d}" clip-rule="evenodd"></path>`)}
          </clipPath>`)}
          <mask id="hp-led-mask-${id}" maskUnits="userSpaceOnUse"
            x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
            color-interpolation="sRGB" style="mask-type:luminance">
            <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="black"></rect>
            <g style="isolation:isolate">
              ${geometry.pieces.map((piece, k) => svg`<g clip-path="url(#hp-led-clip-${id}-${k})"
                  style="mix-blend-mode:lighten">
                ${bands.map((band) => svg`<path d="${piece.d}" fill="none" stroke="${grey(band.value)}"
                  stroke-width="${2 * band.half * r}" stroke-linecap="round" stroke-linejoin="round"></path>`)}
              </g>`)}
            </g>
          </mask>
        </defs>
        <rect class="glow-pool led-pool" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
          fill="${view.appearance?.c ?? 'transparent'}" fill-opacity="${(view.appearance?.alpha ?? 0).toFixed(4)}"
          mask="url(#hp-led-mask-${id})"></rect>
      </g>`;
    })}
  </g>` as unknown as TemplateResult;
}

