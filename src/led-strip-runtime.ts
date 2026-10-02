/**
 * LED strips on the plan (#780): the lazy View chunk.
 *
 * Loaded only when a shown space has an active strip (`led-strip-gate.ts`).
 * It owns the stripe (two strokes of one derived path), the linear light field
 * and the hit path; the card keeps the device model, the actions and the
 * light state, and passes them in. Nothing here writes configuration.
 *
 * The linear field is the exact distance field of the strip with the shared
 * falloff: every piece of the strip paints opaque grey bands of a luminance
 * mask (round caps and joins, so one piece never doubles itself), pieces meet
 * through `mix-blend-mode: lighten` — the maximum, i.e. the nearest piece —
 * and each piece is clipped to the floor its own emitters can see. A hidden
 * part therefore never lights through another part's visibility (ТЗ §6), a
 * closed strip has no seam and a corner no double brightness (ТЗ §3).
 */
import { nothing, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import {
  GLOW_FALLOFF, buildGlowClipGeometry, resolveGlowCandidates,
  type GlowCandidate, type LightBarrierScene, type LightRoomPolygon,
} from './glow-scene';
import { NORM_W, iconUnit } from './space-geometry';
import { roomGlowOf, roomPoly } from './logic';
import type { VirtualLightSnapshot } from './virtual-light-state';
import { geometryAllRings, pointInOpaquePlanBody } from './physical-geometry';
import {
  LED_DEFAULT_RADIUS_CM, LED_EPSILON_CM, LED_THICKNESS_OFF_D, LED_THICKNESS_ON_D,
  compactPoints, emitterSamples, isClosedStrip, pathD, stripAnchor, stripHitOwner,
  stripHitRadiusPx, validStripPoints, visibleStripPath,
  type BodyFace, type FaceContext, type Pt,
} from './led-strip-geometry';
import type { DevItem, LedStripModel, RoomCfg, SpaceModel } from './types';

export const LED_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

const pts = (points: readonly number[][]): Pt[] => points.map((p) => [p[0], p[1]] as Pt);

/** Bands of the luminance field: 16 steps keep a band under 7 % of the range. */
export const LED_FIELD_BANDS = 16;
const OUTLINE = '#383838';
const CORE_IDLE = '#FFFFFF';
const UNAVAILABLE = '#9e9e9e';

export type LedVisualState = 'on' | 'off' | 'unavailable';

/** One strip as the card resolved it for this frame. */
export interface LedStripView {
  strip: LedStripModel;
  device: DevItem;
  state: LedVisualState;
  /** Glow effectively on in the strip's room (space `glow_enabled`, room `glow`). */
  glow: boolean;
  /** Resolved light colour and per-stop alpha when on; null otherwise. */
  appearance: { c: string; alpha: number } | null;
  /** Field radius, plan units: the marker's own radius or 50 cm. */
  radius: number;
}

/** Faces and the inside test of the opaque bodies, from the shared light scene. */
export function faceContext(scene: LightBarrierScene | null, epsilon: number): FaceContext | null {
  if (!scene) return null;
  const rings = [
    ...geometryAllRings(scene.masonryGeometry),
    ...scene.opaqueBodies,
  ];
  const faces: BodyFace[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a && b) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]] });
    }
  }
  return {
    faces,
    inside: (point) => pointInOpaquePlanBody([point[0], point[1]], scene.masonryGeometry, scene.opaqueBodies),
    epsilon,
  };
}

/**
 * The state of one strip from the card's own light resolution (ТЗ §3, §5):
 * an unavailable source is a grey dashed stripe without a field — never an
 * unbinding; on with Glow is a white core and a field; on without Glow is a
 * core in the source colour; off is a white core.
 */
export function ledStripView(input: {
  strip: LedStripModel;
  device: DevItem;
  candidate: GlowCandidate | null;
  hass: { states: Record<string, { state?: unknown } | undefined> } | null | undefined;
  glow: boolean;
  defaultRadius: number;
  cellCm: number;
  gridPitch: number;
}): LedStripView {
  const eid = input.candidate?.sourceEid || input.device.primary || '';
  const raw = eid ? input.hass?.states?.[eid]?.state : undefined;
  const unavailable = raw === 'unavailable' || raw === 'unknown'
    || (!!eid && !!input.hass && !input.hass.states?.[eid] && !input.device.virtual);
  const own = Number(input.device.marker?.glow_radius_cm);
  const radius = Number.isFinite(own) && own > 0
    ? (own / input.cellCm) * input.gridPitch
    : input.defaultRadius;
  const appearance = unavailable ? null : input.candidate?.appearance ?? null;
  return {
    strip: input.strip,
    device: input.device,
    state: unavailable ? 'unavailable' : appearance ? 'on' : 'off',
    glow: input.glow,
    appearance,
    radius,
  };
}

// ---------------------------------------------------------------------------
// Stripe and hit path

export interface LedHandlers {
  click: (e: MouseEvent, d: DevItem) => void;
  keydown: (e: KeyboardEvent, d: DevItem) => void;
  contextmenu: (e: MouseEvent, d: DevItem) => void;
  pointerdown: (e: PointerEvent, d: DevItem) => void;
  pointermove: (e: PointerEvent, d: DevItem) => void;
  pointerup: (e: PointerEvent, d: DevItem) => void;
  pointercancel: (e: PointerEvent, d: DevItem) => void;
  pointerover: (e: PointerEvent, d: DevItem) => void;
  pointerleave: () => void;
  focus: (e: FocusEvent, d: DevItem) => void;
  blur: (d: DevItem) => void;
  label: (d: DevItem) => string;
}

export interface LedStripeInput {
  views: readonly LedStripView[];
  /** Base device diameter D in plan units (icon_size of this card × iconUnit). */
  d: number;
  faces: FaceContext | null;
  /** CSS px per plan unit of the current camera. */
  perUnit: number;
  handlers?: LedHandlers | null;
}

function stripeThickness(view: LedStripView, d: number): number {
  return (view.state === 'on' ? LED_THICKNESS_ON_D : LED_THICKNESS_OFF_D) * d;
}

function stripePath(view: LedStripView, input: LedStripeInput) {
  const t = stripeThickness(view, input.d);
  return { t, path: visibleStripPath(pts(view.strip.points), input.faces, t / 2) };
}

/**
 * The nearest stripe under a pointer (ТЗ §7): the visible derived path on
 * screen, hit radius max(22 px, t/2), ties to the stable id.
 */
function nearestOwner(e: Event & { clientX: number; clientY: number }, fallback: LedStripView,
  input: LedStripeInput): LedStripView {
  // Screen → plan through the hit path's own CTM: no card coordinate helper.
  const target = e.currentTarget as SVGGraphicsElement | null;
  const ctm = target?.getScreenCTM?.();
  if (!ctm || input.views.length < 2) return fallback;
  const inverse = ctm.inverse();
  const plan: Pt = [
    inverse.a * e.clientX + inverse.c * e.clientY + inverse.e,
    inverse.b * e.clientX + inverse.d * e.clientY + inverse.f,
  ];
  const strips = input.views.map((view) => {
    const { t, path } = stripePath(view, input);
    return {
      id: view.strip.id,
      points: path.points.map((p) => [p[0] * input.perUnit, p[1] * input.perUnit] as Pt),
      closed: path.closed,
      thicknessPx: t * input.perUnit,
    };
  });
  const owner = stripHitOwner([plan[0] * input.perUnit, plan[1] * input.perUnit], strips);
  return input.views.find((view) => view.strip.id === owner) || fallback;
}

export function renderLedStripes(input: LedStripeInput): TemplateResult {
  if (!input.views.length) return svg`` as unknown as TemplateResult;
  const h = input.handlers;
  // Smaller ids last: an exact overlap of hit paths resolves to the stable id.
  const ordered = [...input.views].sort((a, b) => (a.strip.id < b.strip.id ? 1 : a.strip.id > b.strip.id ? -1 : 0));
  return svg`<g class="led-strips" data-hp-led-strips="${ordered.length}">
    <style>
      .led-strip .led-focus { fill: none; stroke: transparent; }
      .led-strip:focus-within .led-focus { stroke: var(--primary-color, #03a9f4); }
      .led-strip .led-hit { fill: none; stroke: transparent; cursor: pointer; outline: none; }
    </style>
    ${repeat(ordered, (view) => view.strip.id, (view) => {
      const { t, path } = stripePath(view, input);
      const d = pathD(path);
      const unavailable = view.state === 'unavailable';
      const core = unavailable ? UNAVAILABLE
        : view.state === 'on' && !view.glow && view.appearance ? view.appearance.c : CORE_IDLE;
      const hitWidth = (2 * stripHitRadiusPx(t * input.perUnit)) / (input.perUnit || 1);
      const dev = view.device;
      const own = (e: MouseEvent) => nearestOwner(e, view, input).device;
      return svg`<g class="led-strip state-${view.state}" data-led-strip="${view.strip.id}"
          data-marker="${dev.id}" data-state="${view.state}" data-closed="${path.closed ? 'true' : 'false'}">
        <path class="led-outline" d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${t}"
          stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray=${unavailable ? `${t * 2} ${t * 1.5}` : nothing}></path>
        <path class="led-core" d="${d}" fill="none" stroke="${core}" stroke-width="${t / 2}"
          stroke-linecap="round" stroke-linejoin="round"
          stroke-dasharray=${unavailable ? `${t * 2} ${t * 1.5}` : nothing}></path>
        <path class="led-focus" d="${d}" stroke-width="${t * 1.6}" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true"></path>
        ${h ? svg`<path class="led-hit" d="${d}" stroke-width="${hitWidth}"
          stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke"
          role="button" tabindex="0" aria-label="${h.label(dev)}"
          data-hp="device" data-id="${dev.id}"
          @click=${(e: MouseEvent) => h.click(e, own(e))}
          @keydown=${(e: KeyboardEvent) => h.keydown(e, dev)}
          @contextmenu=${(e: MouseEvent) => h.contextmenu(e, own(e))}
          @pointerdown=${(e: PointerEvent) => h.pointerdown(e, own(e))}
          @pointermove=${(e: PointerEvent) => h.pointermove(e, own(e))}
          @pointerup=${(e: PointerEvent) => h.pointerup(e, own(e))}
          @pointercancel=${(e: PointerEvent) => h.pointercancel(e, dev)}
          @lostpointercapture=${(e: PointerEvent) => h.pointercancel(e, dev)}
          @pointerover=${(e: PointerEvent) => h.pointerover(e, own(e))}
          @pointerleave=${() => h.pointerleave()}
          @focus=${(e: FocusEvent) => h.focus(e, dev)}
          @blur=${() => h.blur(dev)}></path>` : nothing}
      </g>`;
    })}
  </g>` as unknown as TemplateResult;
}

// ---------------------------------------------------------------------------
// Linear light field

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

// ---------------------------------------------------------------------------
// One frame for the card: the views of the shown space, its faces and scene.

export interface LedFrameInput {
  space: SpaceModel;
  devices: readonly DevItem[];
  hass: { states: Record<string, { state?: unknown } | undefined> } & Record<string, unknown>;
  virtualLights?: VirtualLightSnapshot | null;
  defaultColor: string;
  paletteAlpha: number;
  cellCm: number;
  gridPitch: number;
  /** Card icon size, % of the space's icon unit (ТЗ §3: D = icon_size/100 × iconUnit). */
  iconPct: number;
  scene: LightBarrierScene | null;
  polygons: readonly LightRoomPolygon[];
  /** Effective Glow of a room: space `glow_enabled` and the room's `glow`. */
  glowFor: (room: RoomCfg) => boolean;
  inRoom: (point: number[], room: RoomCfg) => boolean;
  /** Include hidden/HA-disabled markers (Devices editor with "show hidden"). */
  showHidden: boolean;
}

export interface LedFrame {
  views: LedStripView[];
  faces: FaceContext | null;
  d: number;
  scene: LightBarrierScene | null;
  polygons: readonly LightRoomPolygon[];
}

export function ledFrame(input: LedFrameInput): LedFrame {
  const byId = new Map(input.devices.map((device) => [device.id, device]));
  const radius = (LED_DEFAULT_RADIUS_CM / input.cellCm) * input.gridPitch;
  const candidates = new Map(resolveGlowCandidates({
    hass: input.hass,
    devices: input.devices as DevItem[],
    virtualLights: input.virtualLights,
    spaceId: input.space.id,
    defaultColor: input.defaultColor,
    paletteAlpha: input.paletteAlpha,
    defaultRadiusUnits: radius,
    cellCm: input.cellCm,
    gridPitch: input.gridPitch,
    position: () => ({ x: 0, y: 0 }),
  }).map((candidate) => [candidate.key, candidate]));
  const views: LedStripView[] = [];
  for (const stored of input.space.led_strips || []) {
    if (stored?.active === false || !stored.marker || !validStripPoints(stored.points)) continue;
    // Stored strips are normalised like the layout; the plan draws render units.
    const strip: LedStripModel = {
      ...stored,
      points: stored.points.map((p) => [p[0] * NORM_W, p[1] * NORM_W]),
    };
    const device = byId.get(strip.marker as string);
    if (!device || device.space !== input.space.id) continue;
    if (device.hidden && !input.showHidden) continue;
    const anchor = stripAnchor(pts(strip.points));
    const room = anchor ? input.space.rooms.find((r) => input.inRoom(anchor, r)) : undefined;
    views.push(ledStripView({
      strip,
      device,
      candidate: candidates.get(`${input.space.id}|${device.id}`) ?? null,
      hass: input.hass,
      glow: room ? input.glowFor(room) : false,
      defaultRadius: radius,
      cellCm: input.cellCm,
      gridPitch: input.gridPitch,
    }));
  }
  const epsilon = (LED_EPSILON_CM / input.cellCm) * input.gridPitch;
  return {
    views,
    faces: faceContext(input.scene, epsilon),
    d: (input.iconPct / 100) * iconUnit(input.space),
    scene: input.scene,
    polygons: input.polygons,
  };
}

// ---------------------------------------------------------------------------
// The card side, kept here so the initial graph carries only two call sites
// (ТЗ §13.1). The host is the card itself, read structurally.

export interface LedCardHost {
  _renderDevices: readonly DevItem[];
  _renderPlanHass: any; // any-ok: the card's HA snapshot type is internal to the card
  _virtualLights: VirtualLightSnapshot;
  _fillColors: { glow_light: { c: string; a: number } };
  _cellCm: number;
  _gridPitch: number;
  _config?: { icon_size?: number } | null;
  _mode: string;
  _showAll: boolean;
  _stageEl: HTMLElement | null;
  _lightBarriers: (space: SpaceModel, polys: { r: RoomCfg; poly: number[][] }[]) => LightBarrierScene;
  _pointInRoom: (point: number[], room: RoomCfg) => boolean;
  _clickDevice: (e: MouseEvent, d: DevItem) => void;
  _keyDevice: (e: KeyboardEvent, d: DevItem) => void;
  _ctxDevice: (e: MouseEvent, d: DevItem) => void;
  _pointerDown: (e: PointerEvent, d: DevItem) => void;
  _pointerMove: (e: PointerEvent, d: DevItem) => DevItem | null | undefined;
  _pointerUp: (e: PointerEvent, d: DevItem) => void;
  _pointerCancel: (e: PointerEvent, d: DevItem) => void;
  _showDeviceTip: (e: PointerEvent, d: DevItem) => void;
  _clearPointerHover: () => void;
  _showDeviceFocusTip: (e: FocusEvent, d: DevItem) => void;
  _hideDeviceFocusTip: (id: string) => void;
}

const frames = new WeakMap<object, { key: unknown[]; frame: LedFrame }>();

/** The LED frame of a space for this card, rebuilt only when an input changed. */
export function ledFrameFor(host: LedCardHost, space: SpaceModel, spaceGlow: boolean): LedFrame {
  const polygons = space.rooms.flatMap((room) => {
    const poly = roomPoly(room);
    return poly ? [{ room, poly }] : [];
  });
  const scene = polygons.length
    ? host._lightBarriers(space, polygons.map(({ room, poly }) => ({ r: room, poly })))
    : null;
  const key = [space, host._renderDevices, host._renderPlanHass, spaceGlow, scene, host._mode, host._showAll];
  const hit = frames.get(host);
  if (hit && hit.key.every((value, i) => value === key[i])) return hit.frame;
  const size = host._config?.icon_size ?? 2.5;
  const frame = ledFrame({
    space,
    devices: host._renderDevices,
    hass: host._renderPlanHass,
    virtualLights: host._virtualLights,
    defaultColor: host._fillColors.glow_light.c,
    paletteAlpha: host._fillColors.glow_light.a,
    cellCm: host._cellCm,
    gridPitch: host._gridPitch,
    iconPct: size > 8 ? 2.5 : size,
    scene,
    polygons,
    glowFor: (room) => roomGlowOf(spaceGlow, room),
    inRoom: (point, room) => host._pointInRoom(point, room),
    showHidden: host._mode === 'devices' && host._showAll,
  });
  frames.set(host, { key, frame });
  return frame;
}

/** The stripes and hit paths; actions only in View (the Devices editor selects). */
export function renderLedLayerFor(
  host: LedCardHost, space: SpaceModel, spaceGlow: boolean, view: { w: number },
): TemplateResult {
  const frame = ledFrameFor(host, space, spaceGlow);
  const width = host._stageEl?.clientWidth;
  return renderLedStripes({
    views: frame.views,
    d: frame.d,
    faces: frame.faces,
    perUnit: width && view.w ? width / view.w : 1,
    handlers: host._mode === 'view' ? {
      click: (e, d) => host._clickDevice(e, d),
      keydown: (e, d) => host._keyDevice(e, d),
      contextmenu: (e, d) => host._ctxDevice(e, d),
      pointerdown: (e, d) => host._pointerDown(e, d),
      pointermove: (e, d) => {
        const owner = host._pointerMove(e, d);
        if (owner) host._showDeviceTip(e, owner);
      },
      pointerup: (e, d) => host._pointerUp(e, d),
      pointercancel: (e, d) => host._pointerCancel(e, d),
      pointerover: (e, d) => host._showDeviceTip(e, d),
      pointerleave: () => host._clearPointerHover(),
      focus: (e, d) => host._showDeviceFocusTip(e, d),
      blur: (d) => host._hideDeviceFocusTip(d.id),
      label: (d) => d.name,
    } : null,
  });
}

export function renderLedFieldFor(host: LedCardHost, space: SpaceModel, spaceGlow: boolean): TemplateResult {
  const frame = ledFrameFor(host, space, spaceGlow);
  return renderLedField({
    views: frame.views,
    scene: frame.scene,
    polygons: frame.polygons,
    faces: frame.faces,
    spaceId: space.id,
    owner: host,
  });
}
