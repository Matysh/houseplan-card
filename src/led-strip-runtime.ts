/**
 * LED strips on the plan (#780): the lazy View chunk.
 *
 * Loaded only when a shown space has an active strip (`led-strip-gate.ts`).
 * It owns the stripe (two strokes of one derived path), the linear light field
 * and the hit path; the card keeps the device model, the actions and the
 * light state, and passes them in. Nothing here writes configuration.
 *
 * The linear field paints one continuous path through a union of bounded
 * visibility regions. Cache boundaries therefore never become visible seams,
 * while the same wall/door scene still clips the light.
 */
import { nothing, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import {
  resolveGlowCandidates,
  type GlowCandidate, type LightBarrierScene, type LightRoomPolygon,
} from './glow-scene';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { NORM_W, iconUnit } from './space-geometry';
import { roomGlowOf, roomPoly } from './logic';
import { ISO_ICON_SCALE, ISO_TILE, isoEdgeColor, isoTileShadow } from './iso-tiles';
import { deviceThemeClass } from './device-face';
import type { VirtualLightSnapshot } from './virtual-light-state';
import { geometryAllRings, pointInPhysicalBody, pointInPhysicalGeometry } from './physical-geometry';
import {
  LED_DEFAULT_RADIUS_CM, LED_EPSILON_CM, LED_THICKNESS_D,
  pathD, stripAnchor, stripHitOwner,
  stripHitRadiusPx, validStripPoints, visibleStripPath,
  type BodyFace, type FaceContext, type Pt,
} from './led-strip-geometry';
import type { DevItem, LedStripModel, RoomCfg, SpaceModel } from './types';

export const LED_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

type LedField = typeof import('./led-strip-field');
let field: LedField | null = null;
let fieldLoading: Promise<unknown> | null = null;
let fieldFailed: string | undefined;

/**
 * The field chunk (ТЗ §13.1): loaded only when a strip is on in a Glow room
 * with a light scene. Same contract as the gate: one load, fingerprint
 * handshake, a hashed-URL retry on the next entry, never in a loop.
 */
export function ledField(entry: string, ready: () => void): LedField | null {
  if (!field && !fieldLoading && fieldFailed !== entry && fieldFailed !== '') {
    fieldLoading = (fieldFailed === undefined
      ? import('./led-strip-field')
      : import(/* @vite-ignore */ new URL(`__HOUSEPLAN_LED_FIELD_RETRY_ASSET__?${Date.now()}`, import.meta.url).href) as Promise<LedField>
    ).then((module) => {
      if (module.LED_FIELD_FINGERPRINT === ENTRY_BUILD_FINGERPRINT) field = module;
      else fieldFailed = '';
    }, () => { fieldFailed = entry; }).finally(() => { fieldLoading = null; });
  }
  if (!field) void fieldLoading?.then(() => field && ready());
  return field;
}

const fieldWanted = (views: readonly LedStripView[]): boolean =>
  views.some((view) => view.glow && view.state === 'on');

const pts = (points: readonly number[][]): Pt[] => points.map((p) => [p[0], p[1]] as Pt);

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
  /** Field radius, plan units: the marker's own radius or 30 cm. */
  radius: number;
}

/** Faces and the inside test of the opaque bodies, from the shared light scene. */
export function faceContext(scene: LightBarrierScene | null, epsilon: number): FaceContext | null {
  if (!scene) return null;
  const masonry: number[][][][] = Array.isArray(scene.masonryGeometry) ? scene.masonryGeometry as number[][][][] : [];
  const rings = [...geometryAllRings(scene.masonryGeometry), ...scene.opaqueBodies];
  const faces: BodyFace[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a && b) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]] });
    }
  }
  // A uniform grid over the faces and boxes of the bodies (ТЗ §13.2): a strip
  // or an emitter only ever looks at what is near it, never at the whole space.
  const CELL = 25;
  const grid = new Map<string, number[]>();
  faces.forEach((face, index) => {
    const x0 = Math.floor(Math.min(face.a[0], face.b[0]) / CELL), x1 = Math.floor(Math.max(face.a[0], face.b[0]) / CELL);
    const y0 = Math.floor(Math.min(face.a[1], face.b[1]) / CELL), y1 = Math.floor(Math.max(face.a[1], face.b[1]) / CELL);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`;
        const list = grid.get(key);
        if (list) list.push(index); else grid.set(key, [index]);
      }
    }
  });
  const boxOf = (ring: readonly number[][]) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of ring) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }
    return [minX, minY, maxX, maxY];
  };
  const inBox = (p: Pt, box: number[]) => p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3];
  const polygons = masonry.filter((poly) => poly?.[0]?.length).map((poly) => ({ box: boxOf(poly[0]), poly }));
  const bodies = scene.opaqueBodies.map((body) => ({ box: boxOf(body), body }));
  return {
    faces,
    inside: (point) => polygons.some(({ box, poly }) => inBox(point, box) && pointInPhysicalGeometry([point[0], point[1]], [poly]))
      || bodies.some(({ box, body }) => inBox(point, box) && pointInPhysicalBody([point[0], point[1]], body)),
    epsilon,
    near: (box) => {
      const seen = new Set<number>();
      for (let x = Math.floor(box[0] / CELL); x <= Math.floor(box[2] / CELL); x++) {
        for (let y = Math.floor(box[1] / CELL); y <= Math.floor(box[3] / CELL); y++) {
          for (const index of grid.get(`${x},${y}`) || []) seen.add(index);
        }
      }
      return [...seen].map((index) => faces[index]);
    },
  };
}

/**
 * The state of one strip from the card's own light resolution (ТЗ §3, §5):
 * an unavailable source is a grey dashed stripe without a field — never an
 * unbinding; on uses the source colour for the core, with a field when Glow
 * is enabled; off is a white core.
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

/** 2.5D View (ТЗ §7): the stripe raised like a tile, its edge and floor shadow. */
export interface LedIsoStyle {
  /** Raise of the stripe, plan units: ISO_TILE.lift × D (0.075 D). */
  lift: number;
  /** Visible edge below the raised stripe: ISO_TILE.depth × D (0.1 D). */
  depth: number;
  edge: string;
  shadow: { dx: number; dy: number; sigma: number; opacity: number };
}

export interface LedStripeInput {
  views: readonly LedStripView[];
  iso?: LedIsoStyle | null;
  /** Base device diameter D in plan units (icon_size of this card × iconUnit). */
  d: number;
  faces: FaceContext | null;
  /** CSS px per plan unit of the current camera. */
  perUnit: number;
  handlers?: LedHandlers | null;
}

function stripeThickness(d: number): number {
  return LED_THICKNESS_D * d;
}

interface StripePath {
  t: number;
  path: ReturnType<typeof visibleStripPath>;
  d: string;
}

// The derived strip objects belong to the current frame, never a global id.
// Weak keys cannot retain old cards/spaces; the frame lifecycle also evicts
// its entries explicitly. Face contexts are immutable scene derivations.
const stripePaths = new WeakMap<LedStripModel, {
  faces: FaceContext | null;
  epsilon: number | undefined;
  points: Pt[];
  value: StripePath;
}>();

/** Camera changes affect hit width, not the physical stripe or its SVG path. */
export function ledStripePath(strip: LedStripModel, faces: FaceContext | null, diameter: number): StripePath {
  const t = stripeThickness(diameter);
  const hit = stripePaths.get(strip);
  if (hit && hit.faces === faces && hit.epsilon === faces?.epsilon && hit.value.t === t
    && hit.points.length === strip.points.length
    && hit.points.every((point, i) => point[0] === strip.points[i][0] && point[1] === strip.points[i][1])) {
    return hit.value;
  }
  // An exact snapshot also catches an in-place point edit; identity alone
  // would leave the tube and hit path stale until the next frame replacement.
  const points = pts(strip.points);
  const path = visibleStripPath(points, faces, t / 2);
  const value = { t, path, d: pathD(path) };
  stripePaths.set(strip, { faces, epsilon: faces?.epsilon, points, value });
  return value;
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
    const { t, path } = ledStripePath(view.strip, input.faces, input.d);
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
  const iso = input.iso;
  return svg`<g class="led-strips" data-hp-led-strips="${ordered.length}"
      data-hp-iso=${iso ? 'raised' : nothing}>
    ${iso ? svg`<defs><filter id="hp-led-iso-shadow" filterUnits="userSpaceOnUse"
      x="-100000" y="-100000" width="200000" height="200000">
      <feGaussianBlur stdDeviation="${iso.shadow.sigma}"></feGaussianBlur></filter></defs>` : nothing}
    <style>
      .led-strip .led-focus { fill: none; stroke: transparent; }
      .led-strip:has(.led-hit:focus-visible) .led-focus { stroke: var(--primary-color, #03a9f4); }
      .led-strip .led-hit { fill: none; stroke: transparent; cursor: pointer; outline: none; }
    </style>
    ${repeat(ordered, (view) => view.strip.id, (view) => {
      const { t, path, d } = ledStripePath(view.strip, input.faces, input.d);
      const unavailable = view.state === 'unavailable';
      const core = unavailable ? UNAVAILABLE
        : view.state === 'on' && view.appearance ? view.appearance.c : CORE_IDLE;
      const hitWidth = (2 * stripHitRadiusPx(t * input.perUnit)) / (input.perUnit || 1);
      const dev = view.device;
      const own = (e: MouseEvent) => nearestOwner(e, view, input).device;
      // 2.5D: an inert floor shadow, the edge swept below the raised body,
      // then the body itself; the field below stays on the floor plane.
      const lifted = iso ? `translate(0 ${-iso.lift})` : nothing;
      return svg`<g class="led-strip state-${view.state}" data-led-strip="${view.strip.id}"
          data-marker="${dev.id}" data-state="${view.state}" data-closed="${path.closed ? 'true' : 'false'}">
        ${iso ? svg`<path class="led-iso-shadow" d="${d}" fill="none" stroke="black"
          stroke-opacity="${iso.shadow.opacity}" stroke-width="${t}" stroke-linecap="round"
          stroke-linejoin="round" filter="url(#hp-led-iso-shadow)" pointer-events="none"
          transform="translate(${iso.shadow.dx} ${iso.shadow.dy - iso.lift})"></path>
          ${[1, 0.5].map((k) => svg`<path class="led-iso-edge" d="${d}" fill="none" stroke="${iso.edge}"
          stroke-width="${t}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"
          transform="translate(0 ${-iso.lift + iso.depth * k})"></path>`)}` : nothing}
        <g transform=${lifted}>
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
        </g>
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

/**
 * The room of a strip (ТЗ §5, r1 M2): an explicit valid `room_id` of its
 * marker wins; otherwise the room containing the half-length anchor. A stale
 * `room_id` (no such room in the space) falls back to the geometry.
 */
export function stripRoom(
  rooms: readonly RoomCfg[], roomId: string | null | undefined, anchor: number[] | null,
  inRoom: (point: number[], room: RoomCfg) => boolean,
): RoomCfg | undefined {
  return (roomId ? rooms.find((r) => r.id === roomId) : undefined)
    ?? (anchor ? rooms.find((r) => inRoom(anchor, r)) : undefined);
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
    const room = stripRoom(input.space.rooms, device.marker?.room_id, stripAnchor(pts(strip.points)), input.inRoom);
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
  /** A late chunk never re-renders (and re-fills caches of) a disconnected card. */
  isConnected?: boolean;
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
  _renderProjection: string;
  _isoLightFloors: ReadonlySet<string> | null;
  requestUpdate(): void;
}

const frames = new WeakMap<object, { key: unknown[]; frame: LedFrame }>();

/** Disconnect (ТЗ §13.2, r1 M5): the frame and the field caches of this card are released. */
export function releaseLed(owner: object): void {
  for (const view of frames.get(owner)?.frame.views ?? []) stripePaths.delete(view.strip);
  frames.delete(owner);
  field?.releaseLedField(owner);
}

/** The performance witness: shapes (frame), visibility entries and retained fans of this card. */
export function ledStats(owner: object): {
  shapes: number; visibility: number; sources: number; visibilityPaths: number; pathChars: number; recomputes: number;
} {
  return { shapes: frames.get(owner)?.frame.views.length ?? 0,
    ...(field?.ledFieldStats(owner) ?? { visibility: 0, sources: 0, visibilityPaths: 0, pathChars: 0, recomputes: 0 }) };
}

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
  for (const view of hit?.frame.views ?? []) stripePaths.delete(view.strip);
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
  // A disconnected card keeps nothing (a pending update after disconnect, r1 M5).
  if (host.isConnected !== false) frames.set(host, { key, frame });
  return frame;
}

/** The stripes and hit paths; actions only in View (the Devices editor selects). */
export function renderLedLayerFor(
  host: LedCardHost, space: SpaceModel, spaceGlow: boolean, view: { w: number },
): TemplateResult {
  const frame = ledFrameFor(host, space, spaceGlow);
  const width = host._stageEl?.clientWidth;
  // ТЗ §7: 2.5D only in View; editors keep Flat. D takes the shared tile scale.
  const iso = host._renderProjection === 'iso' && host._mode === 'view';
  const d = iso ? frame.d * ISO_ICON_SCALE : frame.d;
  const theme = deviceThemeClass(host._renderPlanHass) === 'theme-dark' ? 'dark' : 'light';
  const lightFloor = !!host._isoLightFloors?.size;
  const shadow = isoTileShadow(theme, lightFloor);
  const stripes = renderLedStripes({
    views: frame.views,
    d,
    iso: iso ? {
      lift: ISO_TILE.lift * d,
      depth: ISO_TILE.depth * d,
      edge: isoEdgeColor(OUTLINE, theme, lightFloor),
      shadow: { dx: shadow.dx * d, dy: shadow.dy * d, sigma: shadow.sigma * d, opacity: shadow.opacityWhite },
    } : null,
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
  // ТЗ §4 п.10: Plan/Background show a passive translucent mark, never a target.
  return host._mode === 'plan' || host._mode === 'decor'
    ? svg`<g class="led-passive" opacity="0.45" pointer-events="none">${stripes}</g>` as unknown as TemplateResult
    : stripes;
}

export function renderLedFieldFor(host: LedCardHost, space: SpaceModel, spaceGlow: boolean): TemplateResult {
  if (host.isConnected === false) return svg`` as unknown as TemplateResult;
  const frame = ledFrameFor(host, space, spaceGlow);
  const module = frame.scene && (fieldWanted(frame.views) || field?.hasLedField(host))
    ? field || ledField(space.id, () => host.isConnected !== false && host.requestUpdate()) : null;
  if (!module) return svg`` as unknown as TemplateResult;
  return module.renderLedField({
    views: frame.views,
    scene: frame.scene,
    polygons: frame.polygons,
    faces: frame.faces,
    spaceId: space.id,
    owner: host,
    requestUpdate: () => host.requestUpdate(),
    isConnected: () => host.isConnected !== false,
  });
}

// ---------------------------------------------------------------------------
// The static card (ТЗ §8): passive geometry through the same projection, no
// hover, no focus, no actions. The field only with `light_pools: true` and
// Glow; without it no barriers, visibility or timers are created — the faces
// come from the wall geometry the card already drew.

export interface StaticLedInput {
  space: SpaceModel;
  devices: readonly DevItem[];
  hass: LedFrameInput['hass'];
  virtualLights?: VirtualLightSnapshot | null;
  defaultColor: string;
  paletteAlpha: number;
  cellCm: number;
  gridPitch: number;
  iconPct: number;
  /** Effective Glow of a room; the card passes false for all when `light_pools` is off. */
  glowFor: (room: RoomCfg) => boolean;
  inRoom: (point: number[], room: RoomCfg) => boolean;
  /** `live_states: false` — a neutral stripe, no state is read for it. */
  live: boolean;
  /** The light scene with `light_pools: true`; null otherwise. */
  scene: LightBarrierScene | null;
  /** The drawn masonry and independent bodies, for the face offset only. */
  bodies: { masonryGeometry: unknown; opaqueBodies: number[][][] };
  perUnit: number;
  owner: object;
  /** Re-render when the field chunk lands. */
  ready: () => void;
}

export function renderStaticLed(input: StaticLedInput): TemplateResult {
  const polygons = input.space.rooms.flatMap((room) => {
    const poly = roomPoly(room);
    return poly ? [{ room, poly }] : [];
  });
  const frame = ledFrame({
    space: input.space,
    devices: input.devices,
    hass: input.hass,
    virtualLights: input.virtualLights,
    defaultColor: input.defaultColor,
    paletteAlpha: input.paletteAlpha,
    cellCm: input.cellCm,
    gridPitch: input.gridPitch,
    iconPct: input.iconPct,
    scene: input.scene,
    polygons,
    glowFor: input.glowFor,
    inRoom: input.inRoom,
    showHidden: false,
  });
  const views = input.live ? frame.views
    : frame.views.map((view) => ({ ...view, state: 'off' as const, appearance: null, glow: false }));
  const faces = faceContext({
    occluders: [], floor: [], fingerprint: '',
    masonryGeometry: input.bodies.masonryGeometry, opaqueBodies: input.bodies.opaqueBodies,
  }, (LED_EPSILON_CM / input.cellCm) * input.gridPitch);
  const module = input.scene && input.live && (fieldWanted(views) || field?.hasLedField(input.owner))
    ? ledField(input.space.id, input.ready) : null;
  return svg`${module ? module.renderLedField({
    views, scene: input.scene as LightBarrierScene, polygons, faces, spaceId: input.space.id, owner: input.owner,
    requestUpdate: input.ready, isConnected: () => true,
  }) : nothing}${renderLedStripes({ views, d: frame.d, faces, perUnit: input.perUnit, handlers: null })}` as unknown as TemplateResult;
}
