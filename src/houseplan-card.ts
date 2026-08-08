/**
 * House Plan Card — an interactive house plan as a native Lovelace card.
 * Configuration sources:
 *  1) SERVER (the houseplan integration, WS houseplan/config/get) — spaces, plans,
 *     rooms, device overrides, virtual devices. Coordinates are NORMALIZED (0..1).
 *  2) LEGACY fallback — baked-in country-house data (src/data/*), coordinates in a 1489×1053 canvas.
 * The icon layout is stored on the server (houseplan/layout/*), fallback — localStorage.
 */
import { LitElement, html, svg, nothing, TemplateResult, PropertyValues } from 'lit';
import './hp-dialog';
import './hp-color-opacity';
import './hp-device-preview';
import {
  EXCLUDED_DOMAINS, DEFAULT_ICON_RULES, compileIconRules, isValidPattern, iconFor,
  type IconRule, type CompiledIconRule,
} from './rules';
import {
  lqiColor, snapToGrid, snapSegment45, samePoint, pointInPolygon, markerIdForBinding,
  segmentCm, formatLength, roomEdges, roomPoly, paperRoomShapes, pointStrictlyInside, roomsOverlap,
  pointOnBoundary, mergeRooms, splitRoomPath, polygonArea, closestPointOnBoundary, pointStrictlyInside as ptInside, islandsOf, sharedBoundary, openZoneOf, distToSegment, outlineWithout, cutSegments, alignGuides, segmentAngle, is45, type AlignGuide, swipeTarget, clampScale, migratePdfUrls, roomFillModeOf, contentUrl,
  snapToWall, snapPointAlongPoly, openingAmount, openingShoulders, interiorPoint,
  poleOfInaccessibility, subst,
  averageLqi, fitView, declump, safeUrl, resolveTapAction, floorsOf, type FloorInfo,
  stateIcon, lightColorOf, parseRoomRef, diffNewDevices, glowColorOf, doorSector, hasRoomBehind, controlsAction, isControllable,
  spaceDisplayOf, roomFillStyle, fillColorsOf, DEFAULT_FILL_COLORS, type FillColors, runServiceFor, RUN_TARGET_DOMAINS,
  DEFAULT_ROOM_COLOR, DEFAULT_ROOM_OPACITY, stageBgOf,
  DEFAULT_TEMP_MIN, DEFAULT_TEMP_MAX, type SpaceDisplay,
  referencedContentUrls,
  DISPLAY_MODES, TAP_ACTIONS, SPACE_FILL_MODES, ROOM_FILL_MODES,
  coverService, coverEntityOf, COVER_GUARDED_CLASSES,
  liveText, liveTextReference, liveTextToken, hassValue, valueWithUnit, decorTextScale, decorTextLines,
  DECOR_TEXT_BASE,
} from './logic';
import {
  planEdgeDrag, applyEdgeDrag, clampEdgeDrag, applyRoomScale, clampRoomScale,
  simplifyPoly, polyIsSimple, areaM2, formatArea, MIN_ROOM_CM, type EdgeDragPlan,
} from './resize';
import {
  computeSunRays, dayPhase, northDegOf, bgModeOf, sunRaysOn,
  sunStateOf, rayPeakAlpha, raysVisible, rayColor, RAY_FADE_MS, type SunRay,
  rayStops, skyElevation, skyNeedsSnap,
  rayRimEdges, rimStops, rimPeakAlpha, RIM_COLOR,
} from './sun';
import {
  FURNITURE_GROUPS, furnitureOfGroup, furnitureSymbol, furnitureDefaultCm,
  furniturePathD, furnitureCorners, snapFurnitureToWall,
  cmToNorm, clampFurnSize, clampFurnCm, FURN_WALL_CELLS, type FurnitureGroup,
} from './furniture';
import {
  degradeWalls, rekeyWallsAfterMove,
  setWallThickness, setWallThicknessForRoom, cmToField, wallCmToUnits,
  wallEdgeBodies, wallBodiesUnionPath, paperRoomShapesWithWalls,
  innerContourForRoom, roomWallProfile, outsetContour,
  openingInnerFaceOffset, applyWallThicknessToNewRoom,
  drawWallPreviewD, DRAW_WALL_DEFAULT_CM, wallIntervals, normalizeWallIntervals,
  intervalCmAt, wallBodyNeedsSolid, type WallEntry,
} from './wall-thickness';
import {
  resolveOpenCuts, resolveBoundaryTarget, snapOpenPoint,
  clampToEdgeEnds, jointsOnEdge, cutsToSpanEntries, syncOpenToFromCuts,
  applyThicknessOnClose, purgeOpeningsOnSpan,
  pointOnOpenCut, removeCut, rekeyOpenSpansAfterMove, clipOpenSpansToShared,
  sanitizeOpenSpans, entryToSeg,
  type OpenSpanEntry, type BoundaryTarget,
} from './open-spans';
import { ContentSigner } from './signing';
import { mdiHomeCityOutline } from '@mdi/js';
import {
  Affine, applyAffine, solveAffine, affineResidual, readVacTelemetry, isVacSourceState,
  autoCalibrate, pushTrailPoint, isVacMoving, vacTrailMode, vacMapIdWithFallback, VAC_TELEPORT_GAP_MS, VAC_STALE_MS,
  FitParams, fitMatrix, fitFromMatrix, initialFit, reanchorFit, VacRoom,
  VAC_TRAIL_LINGER_MS, Pt as VacPt,
} from './vacuum';
import {
  buildDevices, deviceFromMarkerDraft, seedHiddenBindings, lqiFor, tempFor, humFor, climateTempFor, isHumEntity,
  areaTemp, areaHum, sourceValue, areaClimateMap,
  resolvedLightSources, resolvedLightState, resolvedLightStats,
  resolvedDeviceStateEntities, removedPlanBindings, isRemovedPlanEntity,
  deletePlanMarkerRecords, effectiveMarkerControls, persistedExternalControls,
  hasLegacySelfLightIntent, resolveIcon,
  type AreaClimate,
} from './devices';
import type {
  OpeningCfg,
  RoomCfg, RoomDraftCfg, PartitionCfg, WallColumnCfg,
  SpaceModel, PdfRef, Marker, ServerConfig, DevItem, CardConfig,
} from './types';
import {
  COLUMN_MAX_CM, canonicalColumnAngle, clampColumnCm, columnBody,
  directionalOccluders, draftBodies, floorMinusBodies, geometryArea, geometryOuterRings,
  partitionBody, polyclipPathD, radialOccluders,
  pointInPhysicalBody, sameColumnPlacement,
} from './physical-geometry';
import './editor';
import './space-card';
import { cardStyles } from './styles';
import {
  fitInSquare, planRect, contentBounds, spaceModels, contentFrame, contentItems, spaceFrame,
  spaceCenter, iconUnit, iconCqw, gridLevels, itemOf, snapPt,
  MIN_ZOOM, PAN_SLACK, CANVAS_LIMIT, SANE_LIMIT, GRID_PITCH, GRID_STEP_N,
  PLAN_SCALE_MIN, PLAN_SCALE_MAX,
  clampCanvasR, clampCanvasN, type ContentItem, type Rect,
} from './space-geometry';
import { optimizePlans, type OptimizeReport } from './plan-optimizer';
import { langOf, t, type I18nKey } from './i18n';
import { CommandStack } from './command-stack';
import {
  combineVisualSamples, edgeActivity, entityVisualSample, entityVisualSamplesForDevice,
  type DeviceActivity, type DeviceVisualState, type EntityVisualSample,
} from './device-visual';
import {
  presentationClasses, presentationSourceSignature, resolveDevicePresentation,
  resolvePresentationSources, type ResolvedDevicePresentation,
} from './device-presentation';
import { deviceFaceStyle, renderDeviceFace } from './device-face';
import {
  acquireHaRegistries, activeRegistryHass, cacheHaBindingStatuses,
  fullRegistryHass, haRegistryBuildSignature, haRegistryDiagnostics, haRegistrySnapshot,
  refreshHaRegistries, resolveHaBindingStatus,
  type HaBindingStatus, type HaRegistrySnapshot,
} from './ha-binding-status';
import type { DecorShape, DecorStyle } from './editors/decor/types';
import {
  DEFAULT_DECOR_STYLE, boxAnchors, boxCorners, clamp01, decorCmToUnits,
  decorStrokeUnits, decorStyleOf, decorStylePatch,
  decorUnitsToCm, mergeSnapGeometry, normalizeAngle, resizeDecorBox,
  resizedBoxTopLeft, snapDecorPoint, validDecorDraft,
  type DecorBox, type SnapGeometry,
} from './editors/decor/geometry';

const CARD_VERSION = '1.60.2-beta.3';
/** Keeps every previously valid scale at the maximum 20 cm grid scale lossless. */
const DECOR_TEXT_CM_MAX = 2000;
const CELL_CM_MIN = 0.1;
const CELL_CM_MAX = 1000;
/** HP-1552 boot-veil timing (AUD-1552-02). The veil holds for at least
 *  BOOT_MIN_MS; every stage-height change restarts a BOOT_QUIET_MS
 *  trailing-quiescence requirement (chrome still settling near the cap
 *  extends the wait); BOOT_MAX_MS lifts the veil unconditionally.
 *  BOOT_MIN_MS exceeds the old 600 ms window by a frame-latency margin: a
 *  panel applied right at the window's edge (~590 ms) only materializes in
 *  the stage height a couple of rAF/render frames later. */
const BOOT_MIN_MS = 700;
const BOOT_QUIET_MS = 250;
const BOOT_MAX_MS = 1200;
/** AUD-1552-02: post-reveal grace during which late chrome shifts glide
 *  (CSS height transition on the stage) instead of snapping. */
const BOOT_SOFT_MS = 1500;
/** A long-backgrounded browser tab may resume through several stale/partial
 *  layout frames (HA chrome, dynamic viewport and a websocket warm re-mount
 *  do not necessarily wake in the same frame). In normal View we keep those
 *  frames behind the stage background and reveal one viewport computed from
 *  a quiet, measurable stage. Quick tab switches stay instant; kiosk and all
 *  editors deliberately bypass this path. */
const RESUME_LONG_HIDDEN_MS = 15000;
const RESUME_RECENT_MS = 15000;
const RESUME_MIN_MS = 220;
const RESUME_QUIET_MS = 80;
const RESUME_MAX_MS = 750;

/** Numeric editor fields must consume the whole value: `50abc` is invalid,
 * not a surprisingly accepted 50. Decimal comma remains supported. */
const strictNumber = (value: string): number | null => {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

type LruRead<V> = { hit: true; value: V } | { hit: false };
const lruRead = <K, V>(cache: Map<K, V>, key: K): LruRead<V> => {
  if (!cache.has(key)) return { hit: false };
  const value = cache.get(key)!;
  cache.delete(key);
  cache.set(key, value);
  return { hit: true, value };
};
const lruWrite = <K, V>(cache: Map<K, V>, key: K, value: V, limit: number): void => {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > limit) {
    const oldest = cache.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};
let pageHiddenAt = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? Date.now() : 0;
let pageResumedAt = 0;
/** DEV-B703-01: warm re-mount memo — MODULE scope, so it lives with the loaded
 *  PAGE, not with any card instance. Lovelace re-creates card elements when
 *  the websocket reconnects after a long-backgrounded tab; the fresh instance
 *  used to run the whole first-open boot (veil + BOOT_MIN_MS + quiescence),
 *  which reads as «план перезагрузился», even though the page (and HA's
 *  chrome) never went anywhere. Within one loaded page the chrome IS already
 *  settled, so the geometry the previous instance settled at is still valid:
 *  remember it per (viewport size × card config) and let the next instance
 *  open instantly in the final geometry, no veil at all. A window resize
 *  between instances changes the key → miss → the full protective boot (the
 *  only case where the chrome may genuinely re-settle). The config part of
 *  the key keeps two DIFFERENT cards on one page from adopting each other's
 *  header height (same config twice on one view is indistinguishable — and
 *  then the heights match anyway). */
/** DEV-B703-03 — what the dead instance was LOOKING at. The header height
 *  alone was not enough: `_view` (the pan) never left the instance, and the
 *  EDITOR zoom is deliberately not persisted (`_saveZoom` is view-only) while
 *  the editor MODE is (LS_NAV). So a re-mount inside an editor came back at
 *  the view-mode zoom, and a panned view came back re-centred on the plan —
 *  the owner's «чуть-чуть дёргается масштаб». The memo now carries the whole
 *  viewport, so the restore is the same rect, not the same zoom number. */
type WarmViewport = {
  space: string;
  mode: 'view' | 'plan' | 'devices' | 'decor';
  zoom: number;
  view: { x: number; y: number; w: number; h: number } | null;
  /** the view-mode viewport an editor was entered from (_viewModeSnap) */
  snap: { space: string; zoom: number; cx?: number; cy?: number } | null;
  tool: MarkupTool;
  decorTool: DecorTool;
  showHidden: boolean;
  /** «показать дальние» changes _baseVb, so the restored view rect is only
   *  the same rect if the frame it was clamped against is the same one */
  showFar: boolean;
  selId: string | null;
  rszSel: string | null;
  decorSel: string | null;
};
/** Which dialog was open and its draft (docs/WARM-REMOUNT.md §3). `data` is
 *  the live draft OBJECT — the memo is module state, never serialised, so a
 *  half-filled device dialog with its uploaded pdfs survives for free. */
type WarmDialogKind = 'space' | 'marker' | 'settings' | 'opening' | 'decorText' | 'decorShape' | 'backdrop' | 'rules' | 'room' | 'info' | 'openingInfo';
type WarmDialog = { kind: WarmDialogKind; space: string; mode: string; data: any };
/** AUD-159B1-01: one entry per CARD PLACEMENT, not per key. Two cards with an
 *  identical config on one view share the key, so the key alone cannot say
 *  whose viewport this is; `place`/`idx` (the parent element the card was
 *  mounted in, and its position among that parent's children) identify the
 *  DOM slot, and `owner` the live instance sitting in it. A re-mount into the
 *  same slot inherits the entry; a different card never does. */
type WarmEntry = {
  /** generation id of the instance that currently owns the slot */
  owner: number;
  /** the parent element the owner was mounted in (weak — never keep DOM alive) */
  place: WeakRef<Node> | null;
  /** the owner's index among that parent's children */
  idx: number;
  /** the owner is attached; a dead slot is a tombstone waiting for a successor */
  live: boolean;
  hdrH: number;
  stageH: number;
  vp: WarmViewport | null;
  dlg: WarmDialog | null;
  /** when the instance that wrote `dlg` detached; 0 = it is still alive */
  freed: number;
  /** the TTL timer that frees `dlg` once it can no longer be revived */
  evict: number;
};
const warmBoot = new Map<string, WarmEntry[]>();
let warmGen = 0;
/** `location.pathname` is the dashboard AND the view path: two Lovelace views
 *  never share a key, so a card that comes back on another view boots cold
 *  instead of inheriting a stranger's viewport (AUD-159B1-01). The hash is
 *  deliberately out — `#space=` is OUR deep link, not another placement. */
const warmBootKey = (config: unknown): string =>
  `${window.innerWidth}x${window.innerHeight}|${location.pathname}|${JSON.stringify(config ?? {})}`;
/** A dialog is revived only if the instance that owned it died THIS long ago.
 *  A Lovelace rebuild detaches and re-attaches within one task; a user who
 *  walked off to another dashboard view and came back later must not be met
 *  by a dialog they have long forgotten opening. */
let WARM_REVIVE_MS = 10000;
/** The memo gains a key on every window RESIZE and never loses one; the
 *  values used to be two numbers, and now they can hold a dialog draft (a
 *  plan pdf among it). Keep the last few viewports — a stale entry only
 *  costs the next card at that size a cold boot. */
const WARM_MAX_KEYS = 8;
/** How many placements of ONE key are remembered. More identical cards than
 *  this on one view and the oldest dead slot is dropped — it only costs that
 *  placement a cold boot. */
const WARM_MAX_SLOTS = 4;

/** Which slot of `list` belongs to the instance now claiming it, and may we
 *  trust it with the viewport/dialog (`sure`) or only with the settled height?
 *  Ranked, best first (AUD-159B1-01):
 *    4 — same parent, same index: literally the DOM slot we are standing in,
 *        which is how Lovelace replaces a card (the predecessor may still be
 *        attached for another task — that is the case the audit reproduced);
 *    0 — some OTHER placement whose owner is still attached: a neighbouring
 *        card with an identical config, never ours to inherit;
 *    3 — same parent, shifted index, owner gone: still our placement;
 *    2 — a tombstone whose placement is gone with its subtree — the ordinary
 *        Lovelace rebuild, where the container is rebuilt too.
 *  A tie means two candidates are equally plausible: then only the settled
 *  height is adopted, and it is the same for all of them anyway. */
const warmMatch = (
  list: WarmEntry[],
  gen: number,
  place: Node | null,
  idx: number,
): { slot: WarmEntry | null; sure: boolean } => {
  const score = (s: WarmEntry): number => {
    const same = !!place && s.place?.deref() === place;
    if (same && s.idx === idx) return 4;
    if (s.live) return 0;
    return same ? 3 : 2;
  };
  let best: WarmEntry | null = null;
  let bestScore = 0;
  let ties = 0;
  let newest: WarmEntry | null = null;
  for (const s of list) {
    if (s.owner === gen) continue;
    newest = s;
    const sc = score(s);
    if (sc <= 0) continue;
    if (sc > bestScore) { best = s; bestScore = sc; ties = 1; }
    else if (sc === bestScore) ties++;
  }
  if (!best || ties > 1) return { slot: best || newest, sure: false };
  return { slot: best, sure: true };
};
/** Rotation step of a decor text block — the same 5° a device icon turns in
 *  (marker dialog). Shift affects angle precision only, never position. */
const DT_ANGLE_STEP = 5;
/** Line spacing of a multi-line label, in font sizes. */
const DT_LINE = 1.2;
const LS_KEY = 'houseplan_card_layout_v1';
const LS_CFG = 'houseplan_card_cfg_v1'; // cache of the server config+layout for instant rendering
const LS_ZOOM = 'houseplan_card_zoom_v1';
const LS_NAV = 'houseplan_card_nav_v1'; // last space + editor mode (owner: restore where you were)
const LS_KIOSK = 'houseplan_card_kiosk_v1'; // per-SCREEN size multipliers (each wall tablet differs)
const NORM_W = 1000; // side of the render space — the canvas is square (v1.48.0)
/** Short semantic-event / direct-terminal-transition window. Event uses
    three sequential 1.1 s waves; motion cool-down itself never animates. */
const ACTIVITY_WINDOW_MS = 3300;

/** Smallest rectangle holding both (docs/CANVAS.md §4). */
const unionRect = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

type MarkupTool = 'select' | 'draw' | 'partition' | 'column' | 'merge' | 'split' | 'resize' | 'opening' | 'boundary' | 'wallthick' | 'delroom';
const MARKUP_TOOLS = new Set<MarkupTool>([
  'select', 'draw', 'partition', 'column', 'merge', 'split', 'resize',
  'opening', 'boundary', 'wallthick', 'delroom',
]);
/** Warm viewport is page-memory, so it may contain a tool name from the old bundle. */
const normalizeMarkupTool = (value: unknown): MarkupTool => {
  if (value === 'openwall' || value === 'closewall') return 'boundary';
  return typeof value === 'string' && MARKUP_TOOLS.has(value as MarkupTool)
    ? value as MarkupTool
    : 'draw';
};
type BoundaryUiTarget = BoundaryTarget | { kind: 'blocked' };
type BoundaryPreview =
  | { kind: 'anchor'; point: number[] }
  | { kind: 'range'; seg: number[]; invalid: boolean }
  | { kind: 'restore'; seg: number[]; body: number[][] | null }
  | { kind: 'invalid'; point: number[] };
const MAX_ROOM_DRAFTS = 200;
const MAX_DRAFT_POINTS = 500;
const MAX_DRAFT_SEGMENTS = 2000;
const MAX_PARTITIONS = 2000;
const MAX_WALL_COLUMNS = 500;
/** Everything whose topology or wall association changes in the plan editor. */
interface SpaceGeometryState {
  spaceId: string;
  rooms: any[];
  openings?: OpeningCfg[];
  walls?: WallEntry[];
  open_spans?: OpenSpanEntry[];
  room_drafts?: RoomDraftCfg[];
  partitions?: PartitionCfg[];
  wall_columns?: WallColumnCfg[];
  decor?: DecorShape[];
  plan_transform: {
    plan_x?: number; plan_y?: number; plan_scale?: number;
    plan_scale_x?: number; plan_scale_y?: number; plan_angle?: number;
  };
}
/** Tools of the decor (background) editor. `furniture` is the library
 *  (docs/FURNITURE.md): it opens a palette and places a symbol at real size. */
type DecorTool = 'select' | 'backdrop' | 'line' | 'rect' | 'ellipse' | 'text' | 'furniture' | 'erase';

const fireEvent = (node: EventTarget, type: string, detail?: unknown) => {
  const ev = new Event(type, { bubbles: true, composed: true }) as any;
  ev.detail = detail ?? {};
  node.dispatchEvent(ev);
};

const navigate = (path: string) => {
  history.pushState(null, '', path);
  fireEvent(window, 'location-changed', { replace: false });
};

/**
 * Debounce with `flush()` and `pending`. Both are load-bearing: a pending
 * config write MUST be flushed before the card adopts a server revision,
 * otherwise the edit is silently dropped (audit L2, 2026-07-27).
 */
interface Debounced<T extends (...a: any[]) => void> {
  (...a: Parameters<T>): void;
  flush(): void;
  pending(): boolean;
}

const debounce = <T extends (...a: any[]) => void>(fn: T, ms: number): Debounced<T> => {
  let t: number | undefined;
  let last: Parameters<T> | null = null;
  const wrapped = ((...a: Parameters<T>) => {
    clearTimeout(t);
    last = a;
    t = window.setTimeout(() => {
      t = undefined;
      const args = last;
      last = null;
      if (args) fn(...args);
    }, ms);
  }) as Debounced<T>;
  wrapped.flush = () => {
    if (t === undefined) return;
    clearTimeout(t);
    t = undefined;
    const args = last;
    last = null;
    if (args) fn(...args);
  };
  wrapped.pending = () => t !== undefined;
  return wrapped;
};

/**
 * Capture the pointer for a drag, tolerating an inactive pointerId.
 *
 * `setPointerCapture` throws for synthetic events and for pointers some
 * browsers consider gone; that killed a drag outright. The opening pipeline
 * was hardened for this, the device/label/resize ones were not (audit
 * follow-up L4 sub-item) — now they all go through here.
 */
const capturePointer = (ev: PointerEvent): void => {
  try {
    (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId);
  } catch {
    /* an inactive pointerId must never kill the drag */
  }
};

/** Ruler badges on both shoulders of an opening + the centre-magnet tick.
 *  The same shape serves the DRAG of an existing opening and the PLACEMENT
 *  preview of a new one (owner 2026-08-03). */
/** Default length of a freshly placed opening, cm (the dialog's door preset). */
const OPENING_DEFAULT_CM = 90;

interface OpMeasure {
  labels: { x: number; y: number; text: string }[];
  guide: { x: number; y: number; angle: number } | null;
}

class HouseplanCard extends LitElement {
  public hass?: any;
  private _config?: CardConfig;

  private _space = 'f1';
  private _layout: Record<string, { x: number; y: number; s?: string; k?: number }> = {};
  private _serverStorage = false;
  private _loadOk = false;
  /** null until config/get answers; then mirrors auth.may_write for this user. */
  private _serverCanWrite: boolean | null = null;
  private _loading = false;
  private _loadTries = 0;
  private _serverCfg: ServerConfig | null = null;
  private _cfgRev = 0;
  private _unsubCfg: (() => void) | null = null;
  private _unsubLayout: (() => void) | null = null;
  private _layoutRev = 0;
  /** One-deep server snapshot; invalidated by the first later plan edit. */
  private _canOptimizeUndo = false;
  private _devices: DevItem[] = [];
  private _regSignature = '';
  private _defPos: Record<string, { x: number; y: number }> = {};
  private _newSyncKey = '';
  private _tip: { x: number; y: number; title: string; meta: string; lqi?: number | null; temp?: number | null } | null = null;
  /** Room whose physical perimeter is highlighted in View. The explicit
   *  overlay is needed because thick wall bodies paint above room shapes. */
  private _hoverRoom: { space: string; room: RoomCfg } | null = null;
  private _selId: string | null = null;
  private _toast = '';
  private _toastTimer?: number;

  // --- room markup editor ---
  /** Interaction mode (docs/UX-MODES.md): view = display only, plan = geometry
   * editing, devices = marker placement/config. Never persisted — every load
   * starts in view. */
  private _mode: 'view' | 'plan' | 'devices' | 'decor' = 'view';
  /** Editor mode from nav/hash when can_write was still unknown (AUD-159B4-05). */
  private _pendingNavMode: 'plan' | 'devices' | 'decor' | null = null;
  // ---- decor (background) editor ----
  private _decorTool: DecorTool = 'select';
  private _decorStyle: DecorStyle = { ...DEFAULT_DECOR_STYLE };
  private _decorDraft: { kind: 'line' | 'rect' | 'ellipse'; a: number[]; b: number[]; pid: number } | null = null;
  private _decorMove: {
    id: string; start: number[]; orig: DecorShape; pid: number; moved: boolean;
    before: SpaceGeometryState | null;
  } | null = null;
  private _decorSel: string | null = null;
  /** Pending eraser-tool confirmation. Delete/Backspace remains the direct
   *  command for an explicitly selected object. */
  private _decorEraseConfirm: { id: string; kind: DecorShape['kind'] } | null = null;
  /** The text dialog. Live references are part of `text`; `pickerEntity` is
   *  only transient UI state and is never persisted (docs/LIVE-TEXT.md). */
  private _decorTextDialog: {
    id?: string; x: number; y: number; text: string; color: string;
    opacity: number; angle: string; sizeCm: number;
    pickerEntity?: string;
    /** Keep an old link when inline syntax cannot represent its attr/unit losslessly. */
    preserveLegacy?: boolean;
  } | null = null;
  /** Style editor opened by double-clicking a non-text decor object. */
  private _decorShapeDialog: {
    id: string; kind: 'line' | 'rect' | 'ellipse' | 'furniture';
    color: string; opacity: number; widthCm: number;
    lineStyle?: 'solid' | 'dashed';
    fill?: boolean; fillColor?: string; fillOpacity?: number;
    lengthCm?: number; sizeWCm?: number; sizeHCm?: number; angle: string;
    symbol?: string;
  } | null = null;
  private _backdropDialog: { widthCm: number; heightCm: number; angle: string } | null = null;
  /** Last textarea selection survives moving focus to the HA pickers. */
  private _decorTextSelection: { start: number; end: number } = { start: 0, end: 0 };
  /**
   * The furniture palette (docs/FURNITURE.md §3): which symbol is armed and at
   * what REAL size it will be placed. `w`/`h` are centimetres — the fields show
   * them in metres or feet, but the config's one true scale is `cell_cm`, and
   * a unit system is a display setting, never a stored one.
   */
  private _furnPalette: { symbol: string; w: number; h: number } | null = null;
  /** The selected shape's own unrotated frame (text is measured from SVG). */
  private _dtBox: { id: string; x: number; y: number; w: number; h: number } | null = null;
  /**
   * One live transform gesture for every selected decor kind. Lines use two
   * endpoint handles; text uses one physical font size; box kinds use the
   * same oriented resize/rotate controller.
   */
  private _dtDrag: {
    id: string; kind: 'scale' | 'rotate'; pid: number;
    /** the pivot the block is scaled and rotated about (render units) */
    ax: number; ay: number;
    /** distance / bearing of the pointer at the start, and the stored values */
    r0: number; a0: number; textSizeCm0: number; angle0: number;
    /** box shapes: the dragged corner signs and the oriented box at drag start */
    sgx?: number; sgy?: number;
    orig?: DecorBox;
    origShape: DecorShape;
    before: SpaceGeometryState | null;
    lineEnd?: 0 | 1;
    moved: boolean;
  } | null = null;
  /**
   * The live backdrop gesture (docs/BACKDROP.md §2): moving the picture by its
   * body, scaling it by a corner handle or rotating it by the upper handle.
   * `base` is the untransformed, centred rectangle the transform is measured
   * from, so a gesture never accumulates rounding of its own.
   */
  private _bdDrag: {
    kind: 'move' | 'scale' | 'rotate';
    pid: number;
    /** pointer down, render units */
    sx: number; sy: number;
    /** the centred default rect (render units) — the transform's origin */
    base: Rect;
    /** transform at pointer down */
    p0: { dx: number; dy: number; sx: number; sy: number; angle: number };
    /** the corner that STAYS PUT while scaling (render units) */
    fx: number; fy: number;
    /** which way the dragged corner points from the fixed one (±1) */
    sgx: number; sgy: number;
    rect0: DecorBox;
    before: SpaceGeometryState | null;
    moved: boolean;
  } | null = null;

  /** Edit tabs are offered to admins only (hass.user missing → assume admin). */
  /**
   * Editor chrome (Plan/Devices/Background tabs, space +/gear).
   * Driven by the server `can_write` flag from `houseplan/config/get` so the
   * UI matches `auth.may_write` / the `admin_only` option (audit P0-4).
   * Until the server answers, fail CLOSED: missing `hass.user` must never
   * open the editors (`=== true`, not `!== false`).
   */
  private get _canEdit(): boolean {
    if (!this._norm) return false;
    if (this._serverCanWrite === true) return true;
    if (this._serverCanWrite === false) return false;
    return this.hass?.user?.is_admin === true;
  }

  /** Legacy alias: markup machinery is active exactly in plan mode. */
  private get _kiosk(): boolean {
    return !!this._config?.kiosk;
  }

  private _showKioskDots(): void {
    this._kioskDots = true;
    clearTimeout(this._kioskDotsTimer);
    this._kioskDotsTimer = window.setTimeout(() => (this._kioskDots = false), 2500);
  }

  /** Kiosk auto-carousel: advance to the next space every `cycle` seconds. */
  /** Which way the incoming plan moves when the active space changes. */
  private _slide: '' | 'left' | 'right' = '';
  private _slideTimer?: number;

  /** Short shared transition for View ↔ editor and editor ↔ editor changes. */
  private _navMotion: '' | 'enter' | 'exit' | 'swap' = '';
  private _navMotionTimer?: number;
  /** WAAPI owns editor↔editor content and auto-height interpolation. */
  private _editorSwapAnimations: Animation[] = [];
  /** Last editor kept in the collapsing chrome so leaving it can animate out. */
  private _editorChromeMode: 'plan' | 'devices' | 'decor' = 'plan';

  private _startNavMotion(kind: 'enter' | 'exit' | 'swap'): void {
    clearTimeout(this._navMotionTimer);
    this._navMotionTimer = undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      this._cancelEditorSwapAnimations();
      this._navMotion = '';
      return;
    }
    this._navMotion = kind;
    this._navMotionTimer = window.setTimeout(() => {
      this._navMotionTimer = undefined;
      this._navMotion = '';
      this.requestUpdate();
    }, 190);
  }

  private _cancelEditorSwapAnimations(): void {
    for (const animation of this._editorSwapAnimations) animation.cancel();
    this._editorSwapAnimations = [];
    (this.renderRoot.querySelector('.editorchrome') as HTMLElement | null)
      ?.classList.remove('resizing');
  }

  /** Fade in a newly selected editor and interpolate the toolbar's real
   * content height. CSS cannot transition height:auto, and the three editors
   * wrap to different row counts at different card widths. Measuring both
   * ends keeps the stage/header ResizeObservers following one smooth change. */
  private _animateEditorSwap(fromHeight: number): void {
    void this.updateComplete.then(() => {
      if (!this.isConnected || this._navMotion !== 'swap'
        || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
      const chrome = this.renderRoot.querySelector('.editorchrome') as HTMLElement | null;
      const inner = chrome?.querySelector('.editorchrome-inner') as HTMLElement | null;
      if (!chrome || !inner) return;
      // A rapid second switch may arrive while the previous WAAPI transform is
      // still scaling this same inner node. Cancel it before measuring the new
      // natural height; `fromHeight` already captured the presented midpoint.
      this._cancelEditorSwapAnimations();
      const toHeight = inner.getBoundingClientRect().height;
      chrome.classList.add('resizing');
      const timing: KeyframeAnimationOptions = {
        duration: 190,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
      };
      const animations: Animation[] = [];
      if (fromHeight > 0 && toHeight > 0 && Math.abs(fromHeight - toHeight) > 0.5) {
        const height = chrome.animate([
          { height: `${fromHeight}px` },
          { height: `${toHeight}px` },
        ], timing);
        height.id = 'hp-editor-height-swap';
        animations.push(height);
      }
      const content = inner.animate([
        { opacity: 0.42, transform: 'translateY(5px) scale(0.995)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], timing);
      content.id = 'hp-editor-content-swap';
      animations.push(content);
      this._editorSwapAnimations = animations;
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (this._editorSwapAnimations !== animations) return;
        this._editorSwapAnimations = [];
        chrome.classList.remove('resizing');
      });
    });
  }

  /** Change the space with the usual sideways transition. */
  private _slideTo(id: string, dir: 'left' | 'right'): void {
    if (id === this._space) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (this._activeDraftId) this._resumeDraftBySpace[this._space] = this._activeDraftId;
    this._space = id;
    this._path = [];
    this._cursorPt = null;
    this._openWallAnchor = null;
    this._boundaryRestoreGuard = null;
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._selId = null;
    this._physicalSel = null;
    this._physicalDialog = null;
    this._physicalDrag = null;
    if (this._mode === 'plan' && this._tool === 'draw') this._resumeLastDraft();
    this._restoreZoom();
    if (reduce) return;
    this._slide = dir;
    clearTimeout(this._slideTimer);
    this._slideTimer = window.setTimeout(() => {
      this._slideTimer = undefined;
      this._slide = '';
      this.requestUpdate();
    }, 190);
    this.requestUpdate();
  }

  /** Direct space tabs use the same motion as swipe/carousel navigation. */
  private _pickSpace(id: string): void {
    if (id === this._space) return;
    const ids = this._model.map((sp) => sp.id);
    const from = ids.indexOf(this._space);
    const to = ids.indexOf(id);
    this._navApplied = true;
    this._showFar = false; // the hint is per space (docs/CANVAS.md §4.1)
    this._frame = null;
    this._slideTo(id, from >= 0 && to < from ? 'right' : 'left');
    this._saveNav();
  }

  private _cycleTick(): void {
    if (!this._kiosk || !(Number(this._config?.cycle) > 0)) return;
    if (Date.now() >= this._cyclePausedUntil && this._model.length > 1 && this._zoom <= 1.001) {
      const ids = this._model.map((m) => m.id);
      const i = ids.indexOf(this._space);
      this._slideTo(ids[(i + 1) % ids.length], 'left');
      this._showKioskDots();
    }
  }

  /** Any edit mode is active (plan / devices / decor). */
  private get _editing(): boolean {
    return this._mode === 'plan' || this._mode === 'devices' || this._mode === 'decor';
  }

  private get _markup(): boolean {
    return this._mode === 'plan';
  }
  private _tool: MarkupTool = 'draw';
  /** UX-04: one named, 50-step command history for every plan-geometry tool. */
  private _geometryHistory = new CommandStack<SpaceGeometryState>(50);
  /** Wall-thickness tool dialog (docs/WALL-THICKNESS.md). */
  private _wallDialog: {
    a: number[]; b: number[];
    value: string; roomId: string | null;
    sx: number; sy: number;
  } | null = null;
  /**
   * Draw-toolbar thickness field (session). `null` until Plan is entered —
   * then primed to DRAW_WALL_DEFAULT_CM. Empty string = no thickness on commit.
   */
  private _drawWallField: string | null = null;
  /** The saved draft currently continued by the Draw tool. */
  private _activeDraftId: string | null = null;
  private _resumeDraftBySpace: Record<string, string> = {};
  /** One-click/two-click physical-object selection in the Plan editor. */
  private _physicalSel: {
    kind: 'partition' | 'column' | 'draft'; id: string; segment?: number;
  } | null = null;
  private _physicalDialog: {
    kind: 'partition' | 'column' | 'draft'; id: string; cm: string;
    segment?: number; shape?: 'square' | 'circle'; angle?: string; length?: string;
  } | null = null;
  /** Drag preview is render-only; config is committed once on pointerup. */
  private _physicalDrag: {
    pid: number; kind: 'partition' | 'column'; id: string;
    start: number[]; startClient: number[]; before: SpaceGeometryState | null; moved: boolean;
    base: PartitionCfg | WallColumnCfg; delta: number[];
  } | null = null;
  private _physicalRotate: {
    pid: number; id: string; center: number[]; startAngle: number;
    baseAngle: number; angle: number; before: SpaceGeometryState | null; moved: boolean;
  } | null = null;
  private _physicalLastTap: {
    kind: 'partition' | 'column' | 'draft'; id: string; segment?: number; at: number;
  } | null = null;
  private _physicalPickCycle: {
    signature: string; index: number; x: number; y: number; at: number;
  } | null = null;
  private _wallUnionCache: {
    key: string;
    value: ReturnType<typeof wallBodiesUnionPath>;
  } | null = null;
  private _physicalBodiesCache: {
    key: string; drafts: number[][][]; partitions: number[][][];
    columns: number[][][]; all: number[][][];
  } | null = null;
  private _cleanFloorCache = new Map<string, {
    floor: number[][]; geom: any; path: string; area: number;
  }>();
  private _glowClipCache = new Map<string, string[] | null>();
  private _duplicateColumnId: string | null = null;
  private _duplicateColumnTimer = 0;
  // room resize tool (docs/RESIZE.md): selection and an immutable live preview
  private _rszSel: string | null = null;
  private _rszDrag: {
    kind: 'edge' | 'scale';
    pid: number;
    roomId: string;
    plan?: EdgeDragPlan;
    fixed?: [number, number];
    span0?: number;
    rooms: { id: string; poly: number[][] }[];
    openings: { id: string; x: number; y: number; length: number }[];
    snap: string;
    moved: boolean;
    d: number;
    k: number;
    changed: string[];
  } | null = null;
  /** HP-1550-01: the live resize preview, kept OUT of _serverCfg (see _rszApplyPreview). */
  private _rszPreview: { space: string; sp: any } | null = null;
  private _rszLive: { x: number; y: number; text: string; area?: boolean }[] | null = null;
  private _path: number[][] = []; // current outline (render units, vertices snapped to the grid)
  private _cursorPt: number[] | null = null;
  private _mergeSel: string | null = null;
  private _openingDialog: {
    id?: string;                 // editing an existing opening
    type: 'door' | 'window' | 'gate';
    lengthCm: number;
    contact: string;
    lock: string;
    invert: boolean;
    flipH: boolean;
    flipV: boolean;
    x: number; y: number; angle: number; // render units (from the wall snap)
  } | null = null;
  private _openingInfo: OpeningCfg | null = null;
  private _opDrag: {
    id: string; moved: boolean; sx: number; sy: number; dirty: boolean;
    before: SpaceGeometryState | null;
  } | null = null;
  // live ruler badges + the "centered on the wall" tick while an opening is dragged
  private _opMeasure: OpMeasure | null = null;
  private _mergeDialog: { aId: string; bId: string; poly: number[][]; pick: 'a' | 'b' } | null = null;
  /** Open-boundary tool: first click anchor on a shared wall (render units). */
  private _openWallAnchor: { p: number[]; edge: number[]; aId: string; bId: string } | null = null;
  /** Pointer-specific hit widths must follow the gesture, not a global media query. */
  private _boundaryPointerType = 'mouse';
  private _boundaryRestoreGuard: { until: number; point: number[] } | null = null;
  private _boundaryTargetMemo: { key: string; value: BoundaryUiTarget } | null = null;
  private _boundaryPreviewMemo: { key: string; value: BoundaryPreview | null } | null = null;
  private _splitSel: { roomId: string; pts: number[][] } | null = null; // room being cut + the cut path so far
  // a split is applied only when the new room's dialog is confirmed — cancel leaves the room intact
  private _pendingSplit: { roomId: string; mainPoly: number[][]; newPoly: number[][] } | null = null;
  private _areaSel = '';
  private _nameSel = '';
  private _roomDialog = false;
  private _roomEditId: string | null = null; // gear on a room card (edit mode)
  private _roomFill: '' | 'none' | 'lqi' | 'light' | 'temp' = ''; // '' = inherit
  private _roomTempSrc = ''; // '' = average
  private _roomHumSrc = '';
  private _roomSrcOpen: 'temp' | 'hum' | null = null;
  private _roomSrcFilter = '';
  private _roomNameScale = 1;
  private _roomLabelScale = 1;
  // plan zoom/pan (zoom is saved per space, locally)
  private _zoom = 1;
  private _view: { x: number; y: number; w: number; h: number } | null = null; // current SVG viewBox (vb coordinates)
  private _zoomBySpace: Record<string, number> = {};
  /**
   * View-mode viewport remembered on entering an editor. Editor zoom is a
   * working tool (zoom in to grab a vertex), not the user's intention for
   * viewing — leaving any editor brings the view-mode viewport back.
   */
  private _viewModeSnap: { space: string; zoom: number; cx?: number; cy?: number } | null = null;
  private _pointers = new Map<number, { x: number; y: number }>();
  private _panStart: { sx: number; sy: number; vx: number; vy: number } | null = null;
  /**
   * What the current one-finger drag turned out to be, decided ONCE on the
   * first real movement and held until the finger lifts (see
   * `_stagePointerMove`). Only the kiosk has two candidates — a horizontal
   * drag there is the floor swipe; everywhere else a drag always pans.
   */
  private _panLock: 'pan' | 'swipe' | null = null;
  private _pinchStart: { dist: number; zoom: number } | null = null;
  private _suppressClick = false;
  private _roViewport?: ResizeObserver;
  private _roHdr?: ResizeObserver;
  private _onWinResize?: () => void;
  private _hdrH = 118; // measured px above the stage (see the observer in updated())
  /** HP-1552: first-open boot veil. In normal (non-kiosk) mode the stage is
   *  calc(100dvh - _hdrH), and _hdrH is measured from HA's chrome — which
   *  finishes loading AFTER the card's first paint, so every late panel
   *  nudged the height and the plan visibly jumped. The plan hides behind a
   *  pulsing-house veil for a full protective window (AUD-1552-02: the old
   *  early reveal on "two equal reads" let a panel landing at 400-600 ms
   *  jump on a VISIBLE plan); the whole lifecycle restarts from
   *  connectedCallback (AUD-1552-01: timers die on disconnect — a Lovelace
   *  DOM rebuild mid-boot used to leave the plan hidden forever).
   *  First open only; kiosk is 100dvh and never jumps. */
  private _booting = true;
  private _bootFading = false; // veil kept one beat for the opacity-out
  private _bootTimer?: number;
  private _bootLastH = -1;
  private _bootStart = 0;
  private _bootLastChange = 0; // when the stage height last moved (quiescence clock)
  private _bootSoft = false; // post-reveal grace: late chrome shifts glide, not jump
  private _bootSoftTimer?: number;
  /** The accidental-tap guard: pending confirmation for a toggle/run tap. */
  private _tapConfirm: { text: string; exec: () => void } | null = null;
  private _onboardingShown = false; // the auto space dialog is shown once per session

  private _rulesDialog: { rules: IconRule[]; test: string; busy: boolean } | null = null;
  /** Optimization preview plus the exact pair, so commit cannot differ from it. */
  private _alignDialog: {
    report: OptimizeReport; config: any; layout: Record<string, any>;
    /** the promised maximum, in centimetres, ALREADY rounded up (AUD-158B1-01) */
    cm: number;
    /** the space that maximum belongs to, named only when there are several */
    where: string;
    changed: boolean;
    busy: boolean;
  } | null = null;

  private _settingsDialog: {
    colors: FillColors; glowRadius: number; bgColor: string | null;
    /** sun on the plan (docs/SUN.md) */
    northDeg: number | null; bgMode: 'static' | 'daynight'; sunRays: boolean;
    busy: boolean;
  } | null = null;
  /** Wedge memo: recomputed only when (azimuth, elevation, north, cfg rev) change (docs/SUN.md). */
  private _sunRaysCache: { key: string; rays: SunRay[]; rims: number[][][][] } | null = null;
  /** Sun elevation (0.1°) the day/night sky is currently PAINTED with, and
   *  whether the next paint must jump to it instead of gliding (docs/SUN.md). */
  private _skyElev: number | null = null;
  private _skySnap = false;
  private _skySnapRaf = 0;
  private _compassDrag = false;
  private _importDialog: { floors: (FloorInfo & { checked: boolean })[] } | null = null;
  private _importQueue: string[] = []; // floor titles still to create
  private _importTotal = 0;
  private _rulesCompiledSrc = '';
  private _rulesCompiled: CompiledIconRule[] | undefined;

  private _infoCard: DevItem | null = null;
  /** Native HA more-info last opened by this card, for disabled mid-dialog cleanup. */
  private _nativeMoreInfoEntity: string | null = null;
  private _markerDialog: {
    devId?: string;      // the icon being edited (if any)
    /**
     * Folder attachments are uploaded into while this dialog is open. For a NEW
     * icon there is no marker id yet; every one of them used to upload into a
     * shared `files/new/`, so two markers attaching `manual.pdf` ended up
     * pointing at the same bytes (HP-1454-02). A per-dialog id keeps them
     * apart, and the files are moved to the real marker id once the config
     * write is accepted — the same copy→save→cleanup order as a rebind.
     */
    uploadId?: string;
    name: string;
    binding: string;     // 'device:<id>' | 'entity:<eid>' | 'virtual' | '' (not chosen yet)
    bindingMode: 'virtual' | 'ha';
    bindingOpen: boolean;   // the HA-list dropdown is expanded
    showEntities: boolean;  // list entities of devices too
    bindingFilter: string;
    icon: string;        // '' = auto
    autoIcon: string;    // the icon the rules would give — picker placeholder
    display: 'badge' | 'icon_ripple' | 'value';
    rippleColor: string; // '' = accent
    rippleSize: number;  // in icon diameters
    size: number;        // icon size multiplier
    angle: number;       // icon rotation, degrees
    tapAction: string;
    tapTarget: string;    // 'run': automation./script./scene. entity id
    tapConfirm: boolean;  // ask before toggle/run
    runFilter: string;   // '' = the effective default (defaultTap)
    defaultTap: 'info' | 'toggle';
    controls: string[];  // entities this icon toggles as a group
    controlsFilter: string;
    glowRadius: string;  // per-device glow radius in display units; '' = global default
    isLight: boolean;    // force this marker to glow (dumb fixtures behind a switch)
    useClimateTemp: boolean; // badge + room-average vote from climate current_temperature
    model: string;
    link: string;
    description: string;
    pdfs: PdfRef[];
    room: string;
    hideFromPlan: boolean;        // 'space#area' for a virtual one
    busy: boolean;
  } | null = null;
  private _spaceDialog: {
    mode: 'edit' | 'create';
    spaceId?: string;
    title: string;
    planUrl: string | null;
    planFile: { ext: string; b64: string; aspect: number; name: string } | null;
    /**
     * The "already uploaded" list, its contents, and the aspect of whatever was
     * picked from it. Plans are never deleted for being unreferenced, which is
     * only a sane policy if they can be found again (docs/SCOPE.md).
     */
    pickSaved?: boolean;
    saved?: { name: string; url: string; size: number; modified: number; used_by: string[] }[] | null;
    savedBusy?: boolean;
    savedAspect?: number;
    source: 'file' | 'draw';       // draw = no background image, hand-drawn rooms
    showBorders: boolean;
    showNames: boolean;
    hideDecor: boolean;            // the decorative layer is not drawn outside its editor
    hideOpenings: boolean;         // opening symbols are not drawn outside the plan editor
    roomColor: string;
    roomOpacity: number;           // 0..1
    bgColor: string | null;        // background around the plan; null = inherit general
    bgMode: 'static' | 'daynight' | null; // plan background mode; null = inherit (docs/SUN.md)
    northDeg: number | null;       // per-space compass override; null = inherit
    sunRays: boolean | null;       // per-space wedges override; null = inherit
    fillMode: 'none' | 'lqi' | 'light' | 'temp' | 'glow';
    tempMin: number;
    tempMax: number;
    showLqi: boolean;
    cardFontScale: number;
    labelTemp: boolean;
    labelHum: boolean;
    labelLqi: boolean;
    labelLight: boolean;
    cellCm: number;                // real-world cm represented by one grid cell
    busy: boolean;
  } | null = null;
  private _keyHandler = (e: KeyboardEvent) => this._onKey(e);
  /** DEV-B703-03 warm re-mount: the dead instance's viewport, and the two
   *  flags that keep the restore from being undone (the server load's centred
   *  _restoreZoom) or applied twice (the dialog revival). */
  private _warmVp: WarmViewport | null = null;
  private _warmVpArmed = false;
  private _warmLongReturn = false;
  private _warmRevivePending = false;
  private _warmReviveTimer?: number;
  /** AUD-159B1-01: this instance's identity in the memo — its generation, the
   *  key it settled under and the slot (card placement) it owns. */
  private _warmGen = ++warmGen;
  private _warmKey: string | null = null;
  private _warmSlot: WarmEntry | null = null;
  private _hashApplied = false;
  private _navApplied = false; // the saved space was restored (or the user navigated)
  // ---- kiosk (wall device) mode ----
  private _kioskScale: { icon: number; font: number } = { icon: 1, font: 1 };
  private _kioskDialog = false;
  /**
   * Previous entity states + the short event/terminal-transition window for
   * every marker. The map lives outside Lit state: hass ticks update it, one
   * timer repaints when the 3.3 s window closes, and the generation bit forces
   * a CSS event animation to restart on a rapid retrigger.
   */
  private _activityRt = new Map<string, {
    sources: string;
    last: Record<string, string>;
    flashTs: number;
    flashKind: 'event' | 'transition' | null;
    timer: number;
    gen: number;
  }>();
  /** live-vacuum runtime per marker: RAW robot coords (matrix applied at render) */
  private _vacRt = new Map<string, { trail: VacPt[]; lastKey: string; lastTs: number;
    moving: boolean; jump: boolean; endedTs: number; lastPos: VacPt | null }>();
  /** view signature of the previous vacuum render: a changed view (zoom, pan,
      space switch) or a tab return must TELEPORT the puck — animating left/top
      through a viewport change reads as «едет через весь план» (owner). */
  private _vacViewKey = '';
  private _vacLastView: { x: number; y: number; w: number; h: number } | null = null;
  private _vacRaf = 0;
  /** server-recorded runs per marker: {current, previous} in raw robot coords */
  private _vacSrvTrails: Record<string, any> = {};
  private _unsubTrail?: () => void;
  private _vacJumpOnce = false;
  private _vacVisHandler = () => {
    if (document.visibilityState === 'hidden') {
      if (!pageHiddenAt) pageHiddenAt = Date.now();
      return;
    }
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (pageHiddenAt && now - pageHiddenAt >= RESUME_LONG_HIDDEN_MS) pageResumedAt = now;
      pageHiddenAt = 0;
      this._vacJumpOnce = true;
      // A hidden tab paints nothing, so the 45 s sky transition stood still
      // while the sun kept moving: come back on the RIGHT colour, then breathe
      // again (docs/SUN.md, owner 2026-08-04).
      this._skyElev = null;
      this._tip = null;
      this._hoverRoom = null;
      if (now - pageResumedAt <= RESUME_RECENT_MS) this._beginResumeSettle();
      this.requestUpdate();
    }
  };
  private _resumeSettling = false;
  private _resumeRaf = 0;
  private _resumeStarted = 0;
  private _resumeLastSize = '';
  private _resumeLastChange = 0;
  private _viewportInvalidAt = 0;
  private _vacFit: { markerId: string; source: string; mapId: string; p: FitParams;
    drag: null | { kind: 'move' | 'scale'; sx: number; sy: number; p0: FitParams;
      fx: number; fy: number } } | null = null;
  private _kioskDots = false;
  private _kioskDotsTimer?: number;
  private _kioskHoldTimer?: number;
  private _cycleTimer?: number;
  private _cyclePausedUntil = 0;
  private _swipeStart: { x: number; y: number; id: number } | null = null;
  private _lastTap = 0;
  /** Deep-link: read `#space=<id>` from the URL (used by embedded houseplan-space-card). */
  private _hashSpace(): string {
    const m = /(?:^|[#&])space=([^&]+)/.exec(window.location.hash || '');
    return m ? decodeURIComponent(m[1]) : '';
  }
  private _onHashChange = (): void => {
    const id = this._hashSpace();
    if (id && this._model.find((sp) => sp.id === id) && id !== this._space) {
      if (this._activeDraftId) this._resumeDraftBySpace[this._space] = this._activeDraftId;
      this._space = id;
      this._selId = null;
      this._path = [];
      this._cursorPt = null;
      this._openWallAnchor = null;
      this._boundaryRestoreGuard = null;
      this._activeDraftId = null;
      this._draftSegmentCms = [];
      this._closingWallCm = null;
      if (this._mode === 'plan' && this._tool === 'draw') this._resumeLastDraft();
      this._restoreZoom();
      this.requestUpdate();
    }
  };

  private _drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  private _rlResize: { id: string; space: string; k0: number; cx: number; cy: number; d0: number } | null = null;
  private _holdTimer?: number;
  private _holdFired = false;

  static properties = {
    _hdrH: { state: true },
    _booting: { state: true },
    _bootFading: { state: true },
    _bootSoft: { state: true },
    _tapConfirm: { state: true },
    hass: { attribute: false },
    _config: { state: true },
    _space: { state: true },
    _layout: { state: true },
    _devices: { state: true },
    _tip: { state: true },
    _hoverRoom: { state: true },
    _selId: { state: true },
    _toast: { state: true },
    _serverCfg: { state: true },
    _mode: { state: true },
    _tool: { state: true },
    _wallDialog: { state: true },
    _drawWallField: { state: true },
    _activeDraftId: { state: true },
    _physicalSel: { state: true },
    _physicalDialog: { state: true },
    _physicalDrag: { state: true },
    _physicalRotate: { state: true },
    _duplicateColumnId: { state: true },
    _rszSel: { state: true },
    _rszLive: { state: true },
    _opMeasure: { state: true },
    _path: { state: true },
    _cursorPt: { state: true },
    _mergeSel: { state: true },
    _openingDialog: { state: true },
    _openingInfo: { state: true },
    _mergeDialog: { state: true },
    _openWallAnchor: { state: true },
    _splitSel: { state: true },
    _decorTool: { state: true },
    _decorStyle: { state: true },
    _decorDraft: { state: true },
    _decorSel: { state: true },
    _decorEraseConfirm: { state: true },
    _decorTextDialog: { state: true },
    _decorShapeDialog: { state: true },
    _backdropDialog: { state: true },
    _furnPalette: { state: true },
    _bdDrag: { state: true },
    _dtBox: { state: true },
    _dtDrag: { state: true },
    _kioskDialog: { state: true },
    _vacFit: { state: true },
    _kioskDots: { state: true },
    _areaSel: { state: true },
    _nameSel: { state: true },
    _roomDialog: { state: true },
    _roomEditId: { state: true },
    _roomFill: { state: true },
    _roomTempSrc: { state: true },
    _roomHumSrc: { state: true },
    _roomSrcOpen: { state: true },
    _roomSrcFilter: { state: true },
    _roomNameScale: { state: true },
    _roomLabelScale: { state: true },
    _spaceDialog: { state: true },
    _infoCard: { state: true },
    _rulesDialog: { state: true },
    _settingsDialog: { state: true },
    _alignDialog: { state: true },
    _importDialog: { state: true },
    _markerDialog: { state: true },
    _zoom: { state: true },
    _view: { state: true },
  };

  public connectedCallback(): void {
    document.addEventListener('visibilitychange', this._vacVisHandler);
    super.connectedCallback();
    if (this.hass) this._ensureHaRegistryAuthority();
    window.addEventListener('keydown', this._keyHandler);
    // signatures expire (24 h); refresh well before that on long-lived screens
    this._signer.start(() => this.hass, () => referencedContentUrls(this._serverCfg));
    if (this._config?.kiosk && Number(this._config?.cycle) > 0) {
      clearInterval(this._cycleTimer);
      this._cycleTimer = window.setInterval(() => this._cycleTick(), Number(this._config.cycle) * 1000);
    }
    window.addEventListener('hashchange', this._onHashChange);
    // AUD-1552-01: the boot-veil timers die in disconnectedCallback, so a
    // disconnect/reconnect while booting (Lovelace rebuilds its DOM, a view
    // switch remounts the card) used to strand _booting=true with no watcher
    // — the plan stayed hidden forever. Restart the veil lifecycle from every
    // connect: a fresh watch (fresh clock, so the hard cap counts from the
    // reconnect) while booting, or the tail timers if we detached mid-fade.
    if (this._booting) this._bootWatch();
    else if (this._bootFading) {
      clearTimeout(this._bootTimer);
      this._bootTimer = window.setTimeout(() => { this._bootFading = false; }, 220);
    }
    if (this._bootSoft) {
      clearTimeout(this._bootSoftTimer);
      this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
    }
    // DEV-B703-02: a reattach mid-outage must keep revalidating — the retry
    // timer died in disconnectedCallback
    if (!this._loadOk && this._serverCfg && this.hass) this._scheduleLoadRetry();
    // AUD-159B1-01: the placement is only knowable once we are IN the DOM.
    if (!this._warmSlot && this._config) this._warmAdopt();
    // DEV-B703-03: one task later the element Lovelace replaced has detached
    // — only then is its open dialog ours to take over.
    if (this._warmVp && !this._warmRevivePending && this._warmReviveTimer === undefined) {
      this._warmRevivePending = true;
      this._warmReviveTimer = window.setTimeout(() => this._warmReviveDialog(), 0);
    }
    // A successor created by Lovelace after the visibility event did not see
    // that event itself. Module time bridges that small reconnect gap; if no
    // card instance survived to hear `visible`, consume the pending hidden
    // timestamp here instead.
    const now = Date.now();
    if (document.visibilityState === 'visible' && pageHiddenAt) {
      if (now - pageHiddenAt >= RESUME_LONG_HIDDEN_MS) pageResumedAt = now;
      pageHiddenAt = 0;
    }
    if (this._warmLongReturn || now - pageResumedAt <= RESUME_RECENT_MS) this._beginResumeSettle();
    this._warmLongReturn = false;
    // Transient navigation/resume fields are intentionally not reactive. A
    // same-element reconnect keeps Lit's previous DOM, so explicitly repaint
    // after clearing those fields in disconnectedCallback.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this._vacVisHandler);
    if (this._vacRaf) { cancelAnimationFrame(this._vacRaf); this._vacRaf = 0; }
    if (this._resumeRaf) { cancelAnimationFrame(this._resumeRaf); this._resumeRaf = 0; }
    if (this._skySnapRaf) { cancelAnimationFrame(this._skySnapRaf); this._skySnapRaf = 0; }
    for (const rt of this._activityRt.values()) clearTimeout(rt.timer); // pending activity-window repaints
    window.removeEventListener('keydown', this._keyHandler);
    clearInterval(this._cycleTimer);
    clearTimeout(this._kioskDotsTimer);
    clearTimeout(this._kioskHoldTimer);
    clearTimeout(this._reloadRetry);
    clearTimeout(this._loadRetryTimer);
    this._loadRetryTimer = undefined; // a cleared id must not block a reschedule
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    this._connHooked = null;
    this._haRegistryRelease?.();
    this._haRegistryRelease = undefined;
    this._haRegistryConnection = null;
    this._signer.dispose();
    clearTimeout(this._toastTimer);
    clearTimeout(this._slideTimer);
    clearTimeout(this._navMotionTimer);
    this._cancelEditorSwapAnimations();
    this._slideTimer = undefined;
    this._navMotionTimer = undefined;
    // The timers are the normal owners of these transient classes. Once the
    // timers are cleared on detach, reset their state too or a same-element
    // reattach keeps nav-enter overflow clipping / hpnav transitions forever.
    this._slide = '';
    this._navMotion = '';
    clearTimeout(this._bootTimer);
    this._bootTimer = undefined; // AUD-1552-01: a cleared id must not block the reconnect watcher
    clearTimeout(this._bootSoftTimer);
    this._saveConfigDebounced.flush(); // never leave an edit unsent on teardown
    window.removeEventListener('hashchange', this._onHashChange);
    clearTimeout(this._holdTimer);
    this._roViewport?.disconnect();
    this._roViewport = undefined;
    this._roHdr?.disconnect();
    this._roHdr = undefined;
    if (this._onWinResize) {
      window.removeEventListener('resize', this._onWinResize);
      this._onWinResize = undefined;
    }
    if (this._unsubCfg) {
      this._unsubCfg();
      this._unsubCfg = null;
    }
    if (this._unsubLayout) {
      this._unsubLayout();
      this._unsubLayout = null;
    }
    clearTimeout(this._layoutSyncTimer);
    clearTimeout(this._duplicateColumnTimer);
    // DEV-B703-03: the last thing this instance was showing, then the
    // tombstone that lets exactly one successor adopt the open dialog.
    // AUD-159B1-02: the snapshot runs while `_warmRevivePending` is still
    // TRUE. An instance that never got to consume its predecessor's dialog
    // has nothing of its own to record there, and the old order (clear the
    // flag, then snapshot) had it write `dlg: null` over somebody else's
    // unsaved draft — a second Lovelace rebuild inside one task destroyed
    // the draft before the first successor could restore it. Now the draft
    // simply travels down the chain until one of them lives long enough.
    this._warmSnapshot();
    this._warmRevivePending = false;
    clearTimeout(this._warmReviveTimer);
    this._warmReviveTimer = undefined;
    this._warmRelease();
    // A Boundary P1 is a local pointer gesture, not persisted editor state.
    // Never let it survive a card replacement/reconnect and unexpectedly turn
    // the user's first click after returning into P2.
    this._openWallAnchor = null;
    this._boundaryRestoreGuard = null;
    this._cursorPt = null;
    // R1: the rAF is the only normal owner that clears this flag. Reset only
    // after the disconnect snapshot (which must still skip unstable geometry),
    // so a same-element reattach can start fresh instead of keeping the veil.
    this._resumeSettling = false;
    super.disconnectedCallback();
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this._vacFit) {
      this._vacFit = null;
      this._showToast(this._t('vac.cal_cancelled'));
      e.stopPropagation();
      return;
    }
    if (e.key === 'Escape') {
      // close the topmost open dialog; info popups first, then editors
      if (this._tapConfirm) { this._tapConfirm = null; return; }
      if (this._decorEraseConfirm) { this._decorEraseConfirm = null; return; }
      if (this._openingInfo) { this._openingInfo = null; return; }
      if (this._infoCard) { this._infoCard = null; return; }
      if (this._rulesDialog) { this._rulesDialog = null; return; }
      if (this._alignDialog) { this._alignDialog = null; return; }
      if (this._settingsDialog) { this._settingsDialog = null; return; }
      if (this._markerDialog) { this._markerDialog = null; return; }
      if (this._openingDialog) { this._openingDialog = null; return; }
      if (this._physicalDialog) { this._physicalDialog = null; return; }
      if (this._backdropDialog) { this._backdropDialog = null; return; }
      if (this._decorShapeDialog) { this._decorShapeDialog = null; return; }
      if (this._decorTextDialog) { this._decorTextDialog = null; return; }
      if (this._spaceDialog && !this._roomDialog) {
        // same semantics as the dialog's Cancel: an import queue is abandoned
        this._spaceDialog = null;
        this._importQueue = [];
        this._importTotal = 0;
        return;
      }
    }
    // At the window listener `target` may be retargeted to the card host by
    // Shadow DOM. The composed path still contains the actual focused field.
    const inField = (e.composedPath?.() || [e.target]).some((node: any) =>
      node?.matches?.('input, textarea, select, [contenteditable="true"]'),
    );
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // A Latin `key` names the shortcut the user actually pressed (including
    // QWERTZ/AZERTY). For a non-Latin layout use the physical code fallback,
    // so Russian «я» at KeyZ still works without making QWERTZ Ctrl+Z both
    // Undo (`key=z`) and Redo (`code=KeyY`) at the same time.
    const latinLetter = /^[a-z]$/.test(key);
    const isZ = key === 'z' || (!latinLetter && e.code === 'KeyZ');
    const isY = key === 'y' || (!latinLetter && e.code === 'KeyY');
    const redo = mod && ((isZ && e.shiftKey) || isY);
    const undo = mod && isZ && !e.shiftKey;
    if (this._mode === 'decor') {
      if ((undo || redo) && inField) return;
      if (redo) { e.preventDefault(); this._redoGeometry(); return; }
      if (undo) {
        e.preventDefault();
        if (this._decorDraft) { this._decorDraft = null; return; }
        if (this._decorMove || this._dtDrag || this._bdDrag) {
          this._cancelDecorGesture();
          return;
        }
        this._undoGeometry();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._decorSel &&
          !inField) {
        e.preventDefault();
        this._decorDeleteSel();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this._decorDraft) this._decorDraft = null;
        else if (this._decorMove || this._dtDrag || this._bdDrag) this._cancelDecorGesture();
        // an armed symbol is the same kind of "half-done thing" a draft is:
        // Escape disarms it before it lets go of the selection or the tool
        else if (this._furnPalette) this._furnPalette = null;
        else if (this._decorSel) this._decorSel = null;
        else if (this._decorTool !== 'select') this._decorTool = 'select';
        else this._setMode('view');
      }
      return;
    }
    if (!this._markup) return;
    if ((undo || redo) && inField) return; // keep native text-field history
    if ((e.key === 'Delete' || e.key === 'Backspace') && this._physicalSel && !inField) {
      e.preventDefault();
      this._deletePhysicalSelection();
      return;
    }
    if (redo) {
      e.preventDefault();
      this._redoGeometry();
      return;
    }
    if (undo) {
      e.preventDefault();
      if (this._rszDrag) {
        this._rszCancelDrag();
        return;
      }
      // Draft points are not committed commands. Walk them back before the
      // shared stack, just like an unfinished word before document Undo.
      if ((this._tool === 'draw' || this._tool === 'partition') && this._path.length) {
        if (this._activeDraftId && this._path.length > 1) this._undoGeometry();
        else this._undoPoint();
        return;
      }
      if (this._tool === 'split' && this._splitSel?.pts?.length) {
        this._splitSel = { ...this._splitSel, pts: this._splitSel.pts.slice(0, -1) };
        if (!this._splitSel.pts.length) this._cursorPt = null;
        return;
      }
      this._undoGeometry();
      return;
    }
    if (e.key !== 'Escape') return;
    if (this._physicalDrag || this._physicalRotate) {
      e.preventDefault();
      this._cancelPhysicalGesture();
      return;
    }
    if (this._roomDialog) {
      e.preventDefault();
      this._roomDialogCancel();
      return;
    }
    if (this._tool === 'draw' && this._path.length) {
      e.preventDefault();
      this._undoPoint();
      return;
    }
    if (this._tool === 'partition' && this._path.length) {
      e.preventDefault();
      this._undoPoint();
      return;
    }
    if (this._physicalSel) {
      e.preventDefault();
      this._physicalSel = null;
      return;
    }
    if (this._tool === 'resize') {
      e.preventDefault();
      if (this._rszDrag) {
        // Esc mid-drag: the immutable preview is simply discarded
        this._rszCancelDrag();
        return;
      }
      if (this._rszSel) this._rszSel = null;
      else this._tool = 'draw';
      return;
    }
    // Esc walks back out of merge/split: point by point, then the room pick,
    // then the tool itself (back to the neutral draw tool)
    if (this._tool === 'split') {
      e.preventDefault();
      if (this._splitSel?.pts?.length) {
        this._splitSel = { ...this._splitSel, pts: this._splitSel.pts.slice(0, -1) };
        if (!this._splitSel.pts.length) this._cursorPt = null;
      } else if (this._splitSel) {
        this._splitSel = null;
      } else {
        this._tool = 'draw';
      }
      return;
    }
    if (this._tool === 'merge') {
      e.preventDefault();
      if (this._mergeSel) this._mergeSel = null;
      else this._tool = 'draw';
      return;
    }
    if (this._wallDialog) {
      e.preventDefault();
      this._wallDialog = null;
      return;
    }
    if (this._tool === 'boundary') {
      e.preventDefault();
      if (this._openWallAnchor) this._cancelBoundaryAnchor();
      else this._tool = 'draw';
      return;
    }
    if (this._tool === 'opening' || this._tool === 'wallthick' || this._tool === 'delroom'
        || this._tool === 'partition' || this._tool === 'column') {
      e.preventDefault();
      this._tool = 'draw';
    }
  }

  /** Remove the last placed point; saved drafts stay structurally valid. */
  private _undoPoint(): void {
    if (!this._path.length) return;
    if (this._contourClosed) {
      this._path = this._path.slice(0, -1);
      this._closingWallCm = null;
      return;
    }
    if (this._activeDraftId && this._path.length > 1 && this._curSpaceCfg) {
      const before = this._geometrySnapshot();
      this._path = this._path.slice(0, -1);
      this._draftSegmentCms = this._draftSegmentCms.slice(0, -1);
      const sp = this._curSpaceCfg as any;
      const i = (sp.room_drafts || []).findIndex((d: any) => d.id === this._activeDraftId);
      if (i >= 0) {
        if (this._path.length < 2) {
          sp.room_drafts.splice(i, 1);
          if (!sp.room_drafts.length) delete sp.room_drafts;
          this._activeDraftId = null;
        } else {
          sp.room_drafts[i] = {
            id: this._activeDraftId,
            points: this._path.map((p) => [p[0] / NORM_W, p[1] / NORM_W]),
            segments: this._draftSegmentCms.map((cm) => ({ cm })),
          };
        }
        this._recordGeometry(this._t('history.draft_segment_delete'), before);
        this._saveConfig();
      }
      return;
    }
    this._path = this._path.slice(0, -1);
  }

  public static getConfigElement() {
    return document.createElement('houseplan-card-editor');
  }

  public static getStubConfig(): Partial<CardConfig> {
    return { type: 'custom:houseplan-card' };
  }

  /** Test hook (smokes): forget the warm re-mount memo — a cold page again.
   *  `ttl` retunes WARM_REVIVE_MS so a smoke can watch the TTL expire without
   *  standing still for ten seconds (AUD-159B1-03); omitted = back to 10 s. */
  public static _warmBootReset(ttl?: number): void {
    for (const list of warmBoot.values()) for (const s of list) clearTimeout(s.evict);
    warmBoot.clear();
    WARM_REVIVE_MS = ttl && ttl > 0 ? ttl : 10000;
  }

  /** Test hook (smokes): what the memo is holding — slots per key, and how
   *  many of them still keep a dialog payload alive. */
  public static _warmBootStats(): { keys: number; slots: number; dlgs: number; drafts: string[] } {
    let slots = 0, dlgs = 0;
    const drafts: string[] = [];
    for (const list of warmBoot.values()) {
      for (const s of list) {
        slots++;
        if (s.dlg) { dlgs++; drafts.push(s.dlg.kind); }
      }
    }
    return { keys: warmBoot.size, slots, dlgs, drafts };
  }

  public setConfig(config: CardConfig): void {
    this._config = { icon_size: 2.5, show_temperature: true, live_states: true, show_signal: true, ...config };
    if (this._config.kiosk) { this._booting = false; this._bootFading = false; } // kiosk: 100dvh, nothing to settle
    if (config.default_floor) this._space = config.default_floor;
    try {
      this._zoomBySpace = JSON.parse(localStorage.getItem(LS_ZOOM) || '{}') || {};
    } catch {
      this._zoomBySpace = {};
    }
    try {
      const ks = JSON.parse(localStorage.getItem(LS_KIOSK) || 'null');
      this._kioskScale = { icon: clampScale(ks?.icon), font: clampScale(ks?.font) };
    } catch {
      /* defaults */
    }
    // instant render from cache (stale-while-revalidate): show the plan and icons
    // right away, without waiting for the server response — fresh data will load in the background.
    try {
      const c = JSON.parse(localStorage.getItem(LS_CFG) || 'null');
      if (c && c.config && Array.isArray(c.config.spaces)) {
        this._serverCfg = c.config;
        this._cfgEpoch++;
        this._cfgRev = c.rev || 0;
        this._layout = c.layout || {};
        this._serverStorage = true;
        const hs = this._hashSpace();
        const nav = this._savedNav();
        if (hs && this._model.find((sp) => sp.id === hs)) { this._space = hs; this._hashApplied = true; }
        else if (nav?.space && this._model.find((sp) => sp.id === nav.space)) { this._space = nav.space; this._navApplied = true; }
        else if (config.default_floor) this._space = config.default_floor;
        else if (!this._model.find((sp) => sp.id === this._space)) this._space = this._model[0]?.id || this._space;
        // reopenning the tab lands you in the same editor you left (admins only);
        // kiosk screens always stay in View. If can_write is still unknown /
        // false-closed, remember the mode and apply once the server answers.
        if (nav?.mode && nav.mode !== 'view' && !config.kiosk) {
          if (this._canEdit) this._mode = nav.mode;
          else this._pendingNavMode = nav.mode;
        }
      }
    } catch {
      /* ignore */
    }
    // HP-1551: the saved per-space zoom used to be applied only by
    // _restoreZoom()'s rAF after the server round-trip, so the cached config
    // painted its first frames at the default fit and the plan visibly
    // jumped to the saved zoom. The zoom store is already in hand here —
    // arm it BEFORE the first view computation, so the very first paint is
    // already at the user's zoom.
    if (this._mode === 'view' && !this._view) this._zoom = this._zoomBySpace[this._space] || 1;
    // AUD-159B1-01: the memo is claimed by DOM slot, and Lovelace calls
    // setConfig BEFORE it inserts the element — so the claim waits for
    // connectedCallback (still before the first render, so nothing flashes).
    // A setConfig on a card that is already attached (the editor's live
    // preview) re-claims right here, because the config is part of the key.
    if (this.isConnected) {
      this._warmAdopt();
      if (this._warmLongReturn) this._beginResumeSettle();
      this._warmLongReturn = false;
    }
  }

  /**
   * DEV-B703-01/03 + AUD-159B1-01: find the memo of the card that used to sit
   * in THIS placement and step into it — the settled header height (no veil,
   * synchronous reveal in the final geometry) and, when the slot is provably
   * ours, the whole viewport. `_bootSoft` covers residual chrome drift with a
   * glide instead of a snap.
   */
  private _warmAdopt(): void {
    if (this._config?.kiosk) return;
    const key = warmBootKey(this._config);
    if (this._warmKey === key && this._warmSlot) return; // already sitting in it
    if (this._warmSlot) this._warmRelease(); // the config (or the window) changed under us
    const place = this.parentNode;
    const idx = this._warmIdx(place);
    const list = warmBoot.get(key);
    if (!list || !list.length) return; // cold page — the full protective boot
    // the same element re-attached (Lovelace moves cards around): our own slot
    // is waiting for us, and our live state is newer than anything in it
    const mine = list.find((s) => s.owner === this._warmGen);
    if (mine) {
      this._warmLongReturn = !!mine.freed && Date.now() - mine.freed >= RESUME_LONG_HIDDEN_MS;
      clearTimeout(mine.evict); mine.evict = 0; mine.freed = 0; mine.live = true;
      this._warmSlot = mine;
      this._warmKey = key;
      return;
    }
    const { slot, sure } = warmMatch(list, this._warmGen, place, idx);
    if (!slot) return;
    this._warmLongReturn = !!slot.freed && Date.now() - slot.freed >= RESUME_LONG_HIDDEN_MS;
    this._booting = false;
    this._bootFading = false;
    this._hdrH = slot.hdrH;
    this._bootSoft = true; // timer armed in connectedCallback...
    if (this.isConnected) { // ...unless we are claiming while already attached
      clearTimeout(this._bootSoftTimer);
      this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
    }
    this._warmKey = key;
    if (sure) {
      clearTimeout(slot.evict); // the dialog is ours now, not the TTL's
      slot.evict = 0;
      slot.owner = this._warmGen;
      slot.place = place ? new WeakRef(place) : null;
      slot.idx = idx;
      slot.live = true;
      this._warmSlot = slot;
      this._warmVp = slot.vp; // adopted below, once the model is in hand
      this._warmAdoptViewport(this._config!);
    } else {
      // Two identical cards on one view and no way to tell which slot is ours:
      // the height is interchangeable (they settle at the same chrome), the
      // viewport and the dialog belong to somebody and must not be guessed.
      this._warmSlot = {
        owner: this._warmGen, place: place ? new WeakRef(place) : null, idx, live: true,
        hdrH: slot.hdrH, stageH: slot.stageH, vp: null, dlg: null, freed: 0, evict: 0,
      };
      list.push(this._warmSlot);
      this._warmTrim(list);
    }
  }

  /** This element's position among its parent's children (-1 if unmounted). */
  private _warmIdx(place: Node | null): number {
    const kids = (place as Element | null)?.children;
    if (!kids) return -1;
    for (let i = 0; i < kids.length; i++) if (kids[i] === this) return i;
    return -1;
  }

  /** Let go of the slot: the placement is still there, this instance is not. */
  private _warmRelease(): void {
    const s = this._warmSlot;
    const key = this._warmKey;
    this._warmSlot = null;
    this._warmKey = null;
    if (!s || !key) return;
    s.freed = Date.now();
    if (s.owner === this._warmGen) s.live = false;
    this._warmScheduleEvict(s, key);
  }

  /** Drop the oldest slot that nobody is sitting in. */
  private _warmTrim(list: WarmEntry[]): void {
    while (list.length > WARM_MAX_SLOTS) {
      const i = list.findIndex((s) => !s.live);
      if (i < 0) break;
      clearTimeout(list[i].evict);
      list.splice(i, 1);
    }
  }

  /**
   * AUD-159B1-03: the TTL used to be a rule checked at revive time only, so a
   * draft nobody came back for stayed reachable from module scope until the
   * page reloaded — with the space dialog that means a whole plan file held as
   * base64 (8 MiB allowed by the backend). Free the payload the moment it
   * stops being revivable; the height and the viewport are bytes, they stay.
   */
  private _warmScheduleEvict(s: WarmEntry, key: string): void {
    clearTimeout(s.evict);
    if (!s.dlg) return;
    const freed = s.freed;
    const gen = s.owner;
    s.evict = window.setTimeout(() => {
      s.evict = 0;
      if (s.freed !== freed || s.owner !== gen) return; // a successor took over
      // the dialog is unrevivable now, whoever is sitting in the slot
      s.dlg = null;
      // a slot nobody re-claimed is also what makes the NEXT claim ambiguous
      const list = warmBoot.get(key);
      if (!s.live && list && list.length > 1) {
        const i = list.indexOf(s);
        if (i >= 0) list.splice(i, 1);
      }
    }, WARM_REVIVE_MS + 250);
  }

  /**
   * DEV-B703-03: put back the EXACT viewport of the instance Lovelace threw
   * away — same space, same editor, same zoom and the same pan rect, so the
   * re-mount is bit-for-bit the view that was on screen. Runs after the LS
   * snapshot has restored the model (the space must exist) and after the
   * LS_NAV/default_floor guesses, which it supersedes: the memo is the newer,
   * finer-grained record of the very same intent. A `#space=` deep link is an
   * EXPLICIT navigation and still wins.
   */
  private _warmAdoptViewport(config: CardConfig): void {
    const vp = this._warmVp;
    if (!vp) return;
    if (this._hashApplied || !this._model.find((sp) => sp.id === vp.space)) {
      this._warmVp = null; // another space is on screen — the memo is not about it
      return;
    }
    this._space = vp.space;
    this._navApplied = true;
    // the editor comes back only where an editor is allowed at all
    this._mode = vp.mode !== 'view' && this._canEdit && !config.kiosk ? vp.mode : 'view';
    // AUD-159B6-04: the memo is the NEWER and MORE SPECIFIC record than the
    // global LS nav — a neighbour card writing `mode=devices` into localStorage
    // must not be replayed over this owner's viewport once can_write answers
    // (it also broke the draft revival, whose guard compares the mode). So the
    // pending intent is REPLACED here, never merely added to.
    this._pendingNavMode = vp.mode !== 'view' && !this._canEdit && !config.kiosk ? vp.mode : null;
    this._zoom = vp.zoom;
    this._view = vp.view ? { ...vp.view } : null;
    this._viewModeSnap = vp.snap ? { ...vp.snap } : null;
    this._tool = normalizeMarkupTool(vp.tool);
    this._decorTool = vp.decorTool;
    this._showHidden = vp.showHidden;
    if (this._showFar !== vp.showFar) { this._showFar = vp.showFar; this._frame = null; }
    this._selId = vp.selId;
    this._rszSel = vp.rszSel;
    this._decorSel = vp.decorSel;
    this._warmVpArmed = true; // _loadFromServer must not re-centre this
  }

  /** Merge a patch into this card's warm entry. `create` is false everywhere
   *  but the boot settle: a memo may only be BORN from a settled geometry. */
  private _warmPatch(patch: Partial<WarmEntry>, create = false): void {
    if (this._config?.kiosk) return;
    const k = warmBootKey(this._config);
    // The key carries the window size and the view path: once either changes
    // under a LIVE card, its slot describes a geometry that is no longer on
    // screen, and the next mount at the new size must boot cold (documented
    // in docs/WARM-REMOUNT.md §1) — so write nothing rather than lie.
    if (this._warmSlot && this._warmKey !== k) return;
    if (!this._warmSlot) {
      if (!create) return;
      const place = this.parentNode;
      this._warmKey = k;
      this._warmSlot = {
        owner: this._warmGen, place: place ? new WeakRef(place) : null, idx: this._warmIdx(place), live: true,
        hdrH: this._hdrH, stageH: 0, vp: null, dlg: null, freed: 0, evict: 0,
      };
      const list = warmBoot.get(k) || [];
      list.push(this._warmSlot);
      warmBoot.set(k, list);
      this._warmTrim(list);
      while (warmBoot.size > WARM_MAX_KEYS) {
        const oldest = warmBoot.keys().next().value; // Map keeps insertion order
        if (oldest === undefined || oldest === k) break;
        for (const s of warmBoot.get(oldest) || []) clearTimeout(s.evict);
        warmBoot.delete(oldest);
      }
    }
    Object.assign(this._warmSlot, patch);
  }

  private _warmViewportState(): WarmViewport {
    return {
      space: this._space,
      mode: this._mode,
      zoom: this._zoom,
      view: this._view ? { ...this._view } : null,
      snap: this._viewModeSnap ? { ...this._viewModeSnap } : null,
      tool: this._tool,
      decorTool: this._decorTool,
      showHidden: this._showHidden,
      showFar: this._showFar,
      selId: this._selId,
      rszSel: this._rszSel,
      decorSel: this._decorSel,
    };
  }

  /**
   * The open dialog, or null. Deliberately null (docs/WARM-REMOUNT.md §4) for:
   *  • «Выровнять всё по сетке» and the room MERGE confirmation — a modal whose
   *    only content is "press OK to rewrite your plan". Resurrecting a
   *    confirmation next to a user who has just come back to the tab is how a
   *    destructive write gets a blind click; both are one click to reopen.
   *  • a tap confirmation — it carries a closure over the DEAD instance.
   *  • the floor-import wizard — `updated()` reopens it by itself while the
   *    config is still empty; reviving it too would double the queue.
   *  • ANY dialog with a save/upload in flight (`busy`) — the new instance
   *    cannot know whether the write landed, and offering Save again invites a
   *    second one. The config reload shows the truth instead.
   * Precedence follows the Esc stack: the topmost dialog is the one that is
   * "open" as far as the user is concerned.
   */
  private _warmDialogState(): WarmDialog | null {
    const at = (kind: WarmDialogKind, data: any): WarmDialog =>
      ({ kind, space: this._space, mode: this._mode, data });
    if (this._tapConfirm || this._alignDialog || this._mergeDialog || this._importDialog) return null;
    if (this._openingInfo) return at('openingInfo', (this._openingInfo as any).id);
    if (this._infoCard) return at('info', this._infoCard.id);
    if (this._rulesDialog) return this._rulesDialog.busy ? null : at('rules', this._rulesDialog);
    if (this._settingsDialog) return this._settingsDialog.busy ? null : at('settings', this._settingsDialog);
    if (this._markerDialog) return this._markerDialog.busy ? null : at('marker', this._markerDialog);
    if (this._openingDialog) return at('opening', this._openingDialog);
    if (this._backdropDialog) return at('backdrop', this._backdropDialog);
    if (this._decorShapeDialog) return at('decorShape', this._decorShapeDialog);
    if (this._decorTextDialog) return at('decorText', this._decorTextDialog);
    if (this._roomDialog) {
      return at('room', {
        editId: this._roomEditId, fill: this._roomFill, tempSrc: this._roomTempSrc,
        humSrc: this._roomHumSrc, srcOpen: this._roomSrcOpen, srcFilter: this._roomSrcFilter,
        nameScale: this._roomNameScale, labelScale: this._roomLabelScale,
        areaSel: this._areaSel, nameSel: this._nameSel,
        pendingSplit: this._pendingSplit, path: this._path,
      });
    }
    if (this._spaceDialog) return this._spaceDialog.busy ? null : at('space', this._spaceDialog);
    return null;
  }

  /** Mirror the live viewport (and the open dialog) into the memo. Called from
   *  every `updated()`: whatever the previous instance last PAINTED is what the
   *  next one must open at — and a dialog closed with Esc/Cancel/Save writes
   *  `dlg: null` here on the very next render, so it can never come back. */
  private _warmSnapshot(): void {
    // The hidden resume frame still carries the pre-suspension viewport. Do
    // not replace the warm memo with it; the settled frame writes the truth.
    if (this._booting || this._resumeSettling || this._config?.kiosk) return;
    const patch: Partial<WarmEntry> = { vp: this._warmViewportState() };
    // do not overwrite the snapshot we are about to revive FROM
    if (!this._warmRevivePending) patch.dlg = this._warmDialogState();
    // AUD-159B1-01: the placement is re-measured from the live DOM, so a card
    // that was moved (a sibling added above it) still names its own slot.
    if (this.isConnected && this._warmSlot?.owner === this._warmGen) {
      const place = this.parentNode;
      patch.place = place ? new WeakRef(place) : null;
      patch.idx = this._warmIdx(place);
    }
    this._warmPatch(patch);
  }

  /**
   * Re-open the dialog the dead instance had open. Not done in setConfig:
   * Lovelace may still be holding the old element there, and a live owner's
   * dialog must not be stolen. One task later the previous instance has
   * detached (`freed`) and the snapshot is ours to consume — exactly once.
   */
  private _warmReviveDialog(): void {
    this._warmRevivePending = false;
    const e = this._warmSlot; // AUD-159B1-01: OUR slot, never a neighbour's
    this._warmReviveTimer = undefined;
    if (!e || !e.dlg) return;
    const d = e.dlg;
    const freed = e.freed;
    e.dlg = null; e.freed = 0; // consume-once: no zombie on the third mount
    clearTimeout(e.evict); e.evict = 0;
    if (!freed || Date.now() - freed > WARM_REVIVE_MS) return; // owner alive, or gone long ago
    if (d.space !== this._space || d.mode !== this._mode) return;  // never in another space/editor
    switch (d.kind) {
      case 'space': this._spaceDialog = { ...d.data, busy: false, savedBusy: false }; break;
      case 'marker': this._markerDialog = { ...d.data, busy: false }; break;
      case 'settings': this._settingsDialog = { ...d.data, busy: false }; break;
      case 'rules': this._rulesDialog = { ...d.data, busy: false }; break;
      case 'opening': this._openingDialog = { ...d.data }; break;
      case 'backdrop': this._backdropDialog = { ...d.data }; break;
      case 'decorShape': this._decorShapeDialog = { ...d.data }; break;
      case 'decorText': {
        this._decorTextDialog = { ...d.data };
        const end = String(this._decorTextDialog?.text ?? '').length;
        this._decorTextSelection = { start: end, end };
        break;
      }
      case 'room': {
        const r = d.data;
        this._roomEditId = r.editId; this._roomFill = r.fill; this._roomTempSrc = r.tempSrc;
        this._roomHumSrc = r.humSrc; this._roomSrcOpen = r.srcOpen; this._roomSrcFilter = r.srcFilter;
        this._roomNameScale = r.nameScale; this._roomLabelScale = r.labelScale;
        this._areaSel = r.areaSel; this._nameSel = r.nameSel;
        this._pendingSplit = r.pendingSplit; this._path = r.path;
        this._roomDialog = true;
        break;
      }
      // info popups are re-resolved by id: the config may have been reloaded
      // under us, and a card rendered from a stale object is a lie
      case 'info': {
        const dev = this._devices.find((x) => x.id === d.data);
        if (dev) this._infoCard = dev;
        break;
      }
      case 'openingInfo': {
        const op = (this._curSpaceCfg?.openings || []).find((x: any) => x.id === d.data);
        if (op) this._openingInfo = op;
        break;
      }
    }
    this.requestUpdate();
  }

  /** Save a snapshot of the config+layout to localStorage for an instant start. */
  private _cacheSnapshot(): void {
    if (!this._serverCfg) return;
    try {
      localStorage.setItem(LS_CFG, JSON.stringify({ config: this._serverCfg, rev: this._cfgRev, layout: this._layout }));
    } catch {
      /* ignore */
    }
  }

  public getCardSize(): number {
    return 12;
  }

  // ================= MODEL RESOLUTION (server configuration) =================

  /** Whether a server configuration with spaces exists (otherwise — onboarding). */
  private get _norm(): boolean {
    return !!(this._serverCfg && this._serverCfg.spaces.length);
  }

  /** Spaces in render units (NORM_W × NORM_W — the canvas is square). */
  /** Bumped by every config mutation — the model/geometry cache key (audit L1). */
  private _cfgEpoch = 0;
  private _modelCache: { key: string; model: SpaceModel[] } | null = null;
  private _decorSnapCache: {
    epoch: number; space: string; height: number; exclude: string; geometry: SnapGeometry;
  } | null = null;
  /** Last unsaved marker projection; invalidated by the complete dialog draft. */
  private _markerPreviewMemo: { key: string; device: DevItem | null } | null = null;

  /** Cheap structural fingerprint of the config (audit L1 cache key). */
  private _cfgFingerprint(): string {
    const sp = this._serverCfg?.spaces || [];
    let s = sp.length + ':';
    for (const x of sp as any[]) {
      s += (x.id || '') + ',' + (x.plan_aspect || '') + ',' + (x.plan_url || '').length + ','
        // the backdrop transform is geometry: without it in the key a drag of
        // the picture would leave the memoized model (and the content frame
        // built from it) showing the old rectangle (docs/BACKDROP.md §5)
        + (x.plan_x ?? '') + ',' + (x.plan_y ?? '') + ',' + (x.plan_scale ?? '') + ','
        + (x.plan_scale_x ?? '') + ',' + (x.plan_scale_y ?? '') + ',' + (x.plan_angle ?? '') + ','
        + (x.rooms?.length || 0) + ',' + (x.openings?.length || 0) + ',' + (x.decor?.length || 0) + ';';
      for (const r of x.rooms || []) {
        // O(1) geometry roll-up per room: the count alone said nothing about
        // where the room actually is, so a moved rectangle or a dragged first/
        // last vertex looked identical (HP-1454-04). The epoch remains the
        // primary signal — this is the belt for a mutation that forgot to bump it.
        const p0 = r.poly?.[0], pn = r.poly?.[r.poly.length - 1];
        s += (r.poly?.length || 0) + '.' + (r.id || '') + '.' + (r.open_to || []).join('+') + '.'
          + (r.area || '') + '.' + JSON.stringify(r.settings || 0) + '.'
          + (r.x ?? '') + ',' + (r.y ?? '') + ',' + (r.w ?? '') + ',' + (r.h ?? '') + ','
          + (p0 ? p0[0] + '/' + p0[1] : '') + ',' + (pn ? pn[0] + '/' + pn[1] : '') + ';';
      }
    }
    return s;
  }

  private get _model(): SpaceModel[] {
    if (!this._serverCfg) return [];
    // same reasoning as _openPairs: mutations in place mean the epoch can lag,
    // so the key also carries the config's structural fingerprint
    const key = this._cfgEpoch + '|' + this._cfgFingerprint();
    if (this._modelCache && this._modelCache.key === key) return this._modelCache.model;
    const built = this._buildModel();
    this._modelCache = { key, model: built };
    return built;
  }

  private _buildModel(): SpaceModel[] {
    if (!this._serverCfg) return [];
    // HP-1550-01: the model renders the preview overlay, not the raw config
    // ONE model builder for both cards. This used to be a hand-copied twin of
    // spaceModels(), and the twin missed the legacy-store fallbacks the shared
    // one gained (safeViewBox, normRect) — the same broken store rendered fine
    // in the static card and as viewBox="0 0 0 0" here (HP-1503-01). The only
    // difference this card needs is the url: raw on purpose, because the model
    // is memoized on the config fingerprint, so a signed url baked in here
    // would freeze BEFORE the signature arrives and the plan would never load
    // (bug found 2026-07-27). _display() is called at render time instead.
    const cfg = this._renderCfg!;
    return spaceModels(cfg).map((m, i) => {
      const raw = (cfg.spaces[i] as any)?.plan_url;
      return m.bg && raw ? { ...m, bg: { ...m.bg, href: raw } } : m;
    });
  }

  private _spaceModel(id?: string): SpaceModel {
    const m = this._model;
    return m.find((s) => s.id === (id ?? this._space)) || m[0];
  }

  private get _areaToSpace(): Record<string, { space: string; room: RoomCfg }> {
    const map: Record<string, { space: string; room: RoomCfg }> = {};
    for (const s of this._model) for (const r of s.rooms) if (r.area) map[r.area] = { space: s.id, room: r };
    return map;
  }

  private get _settings(): ServerConfig['settings'] {
    return this._serverCfg?.settings || {};
  }

  /** LOCAL editor tool (docs/FILTERING.md): show the hidden devices ghosted.
   *  The old toggle wrote settings.show_all — shared state that flipped the
   *  plan for every wall tablet at once. Legacy configs still honour it
   *  through buildDevices until they are seeded. */
  private _showHidden = false;

  private get _showAll(): boolean {
    return this._settings.filter_seeded ? this._showHidden : !!this._settings.show_all;
  }

  private _toggleShowAll(): void {
    if (!this._serverCfg) return;
    if (this._settings.filter_seeded) {
      this._showHidden = !this._showHidden;
      this.requestUpdate();
      return;
    }
    // legacy config: the old shared behaviour until an editor materialises it
    this._serverCfg = { ...this._serverCfg, settings: { ...this._serverCfg.settings, show_all: !this._settings.show_all } };
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._saveConfig();
    this.requestUpdate();
  }

  /**
   * The seeder (docs/FILTERING.md): materialise the filter into explicit
   * hidden flags. Runs after every device rebuild on a client that may write;
   * idempotent — a device with ANY marker is never revisited, so an unticked
   * checkbox (a marker with hidden: false) is re-seed protection. Also
   * removes freshly hidden ids from the red-dot list: a dot on an invisible
   * device would wait forever.
   */
  private _seedHiddenDevices(): void {
    if (!this._serverCfg || !this._norm || !this._canEdit) return;
    const cfg = this._serverCfg;
    const bindings = seedHiddenBindings({
      hass: this.hass,
      registry: this._haRegistry,
      areaToSpace: Object.fromEntries(
        Object.entries(this._areaToSpace).map(([a, v]) => [a, v.space]),
      ),
      markers: this._markers,
      settings: this._settings,
      excluded: this._excluded,
      firstSpaceId: this._model[0]?.id || '',
      iconRules: this._iconRules,
    });
    if (!bindings.length && cfg.settings?.filter_seeded) return;
    cfg.markers = cfg.markers || [];
    const hiddenIds: string[] = [];
    for (const b of bindings) {
      const id = 'h' + b.slice(b.indexOf(':') + 1);
      cfg.markers.push({ id, binding: b, hidden: true });
      hiddenIds.push(b.slice(b.indexOf(':') + 1));
    }
    const st = { ...(cfg.settings || {}), filter_seeded: true } as any;
    delete st.show_all; // the shared toggle retires with the runtime filter
    if (hiddenIds.length && Array.isArray(st.new_device_ids)) {
      st.new_device_ids = st.new_device_ids.filter((x: string) => !hiddenIds.includes(x));
    }
    cfg.settings = st;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._saveConfig();
    this.requestUpdate();
  }

  /** Compiled icon rules: instance settings override the built-in defaults. */
  private get _iconRules(): CompiledIconRule[] | undefined {
    const custom = this._settings.icon_rules;
    if (!custom || !Array.isArray(custom) || !custom.length) return undefined;
    const src = JSON.stringify(custom);
    if (src !== this._rulesCompiledSrc) {
      this._rulesCompiledSrc = src;
      this._rulesCompiled = compileIconRules(custom);
    }
    return this._rulesCompiled;
  }

  /** Global fill palette (config.settings.fill_colors over the defaults). */
  private get _fillColors(): FillColors {
    return fillColorsOf(this._settings);
  }

  private get _excluded(): Set<string> {
    const list = this._settings.exclude_integrations;
    return list ? new Set(list) : EXCLUDED_DOMAINS;
  }

  protected willUpdate(changed: PropertyValues): void {
    // `_serverCfg` is the root of every geometry cache. Keep the epoch
    // invariant local to that reactive assignment so imports, reconnects and
    // demo harnesses cannot accidentally reuse an older config object's data.
    if (changed.has('_serverCfg')) this._cfgEpoch++;
    this._skyPlan();
    if (changed.has('hass') && this.hass) {
      this._ensureHaRegistryAuthority();
      this._planHassMemo = null;
      this._hookConnection();
      if (!this._loadOk && !this._loading && this._loadTries < 8) {
        this._loadFromServer();
      }
      // Devices must exist before their first state snapshot is classified.
      // Otherwise the first real off->on edge after mount becomes the baseline.
      this._maybeRebuildDevices();
      this._vacTick();
      this._activityTick();
    }
  }

  protected updated(): void {
    this._skyRelease();
    this._warmSnapshot(); // DEV-B703-03: the memo follows what is on screen
    this._dtMeasure();    // the selected label's frame follows the glyphs
    const stage = this._stageEl;
    if (stage && !this._roViewport) {
      this._roViewport = new ResizeObserver(() => this._refitView());
      this._roViewport.observe(stage);
    }
    if (stage && this._booting && !this._bootTimer) this._bootWatch();
    // The stage fills the rest of the viewport. What sits above it inside the
    // CARD depends on the mode — the editor bars used to be billed against a
    // hard-coded 118px, so entering an editor pushed the plan down by the
    // difference. Measure our own chrome (stage top relative to the card) and
    // allow a BOUNDED amount for what the dashboard puts above us (HA's
    // toolbar). The first version used the absolute document coordinate here:
    // put anything tall before the card and the "header budget" swallowed the
    // whole viewport, leaving a 0px stage (HP-1500-02). Content above the card
    // is the dashboard's business — it scrolls; it is not header.
    const hdr = this.renderRoot.querySelector('.hdr') as HTMLElement | null;
    if (hdr && stage && !this._roHdr) {
      const measure = () => {
        const card = this.renderRoot.querySelector('ha-card');
        if (!card) return;
        const own = stage.getBoundingClientRect().top - card.getBoundingClientRect().top;
        const above = Math.min(Math.max(card.getBoundingClientRect().top, 0), 120);
        const t = Math.round(own + above);
        // `t` is already an integer. Ignoring a one-pixel delta left the View
        // stage one pixel shorter after an editor collapse and made the fitted
        // viewport drift; changing stage height cannot feed back into its top.
        if (t >= 0 && t !== this._hdrH) this._hdrH = t;
        // DEV-B703-01: chrome that lands after the settle (or a window
        // resize with a live card) must not poison the next warm mount —
        // the memo follows the live settled geometry.
        if (t >= 0 && !this._booting && !this._config?.kiosk && stage.clientHeight > 0) {
          this._warmPatch({ hdrH: t, stageH: stage.clientHeight });
        }
      };
      // a frame later: setting state straight from the observer callback makes
      // the browser report "ResizeObserver loop completed with undelivered
      // notifications" — the render it triggers resizes the stage again
      this._roHdr = new ResizeObserver(() => requestAnimationFrame(measure));
      this._roHdr.observe(hdr);
      this._onWinResize = () => requestAnimationFrame(measure);
      window.addEventListener('resize', this._onWinResize);
      measure();
    }
    if (stage && !this._view) this._refitView();
    // onboarding: on an empty server config, open the space dialog right away
    if (
      this._serverStorage &&
      this._loadOk &&
      this._model.length === 0 &&
      !this._spaceDialog &&
      !this._importDialog &&
      !this._onboardingShown
    ) {
      this._onboardingShown = true;
      const floors = floorsOf(this.hass);
      if (floors.length) {
        this._importDialog = { floors: floors.map((f) => ({ ...f, checked: true })) };
      } else {
        this._openSpaceDialog('create');
      }
    }
  }

  // ================= server: config + layout =================

  private async _loadFromServer(): Promise<void> {
    this._loading = true;
    this._loadTries++;
    try {
      const [cfgResp, layResp] = await Promise.all([
        this.hass.callWS({ type: 'houseplan/config/get' }),
        this.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      this._loadOk = true;
      this._serverStorage = true;
      // absent can_write = older backend / demo stub → keep null (legacy admin fallback)
      if (typeof cfgResp?.can_write === 'boolean') this._serverCanWrite = cfgResp.can_write;
      this._canOptimizeUndo = !!(cfgResp?.can_optimize_undo || layResp?.can_optimize_undo);
      if (this._pendingNavMode && this._canEdit && !this._config?.kiosk) {
        this._mode = this._pendingNavMode;
        this._pendingNavMode = null;
      }
      const cfg = cfgResp?.config;
      // A server reload is a new history baseline. Replaying snapshots made
      // against an older revision would overwrite somebody else's geometry.
      this._geometryHistory.clear();
      if (this._serverCfg) this._clearGeometryGesture();
      this._serverCfg = cfg && Array.isArray(cfg.spaces) ? cfg : null;
      this._cfgEpoch++;
      this._cfgRev = cfgResp?.rev || 0;
      this._layout = layResp?.layout || {};
      this._layoutRev = layResp?.rev ?? 0;
      // live sync: the config was changed in another window → re-read it
      if (!this._unsubCfg) {
        this._unsubCfg = await this.hass.connection.subscribeEvents((ev: any) => {
          // Flush a pending local edit BEFORE adopting a remote revision:
          // otherwise the debounced write reads a config that this reload has
          // already replaced, and the user's edit vanishes (audit L2).
          const observedRev = Number(ev?.data?.rev ?? -1);
          if (observedRev !== this._cfgRev) this._reloadConfigOnly(false, observedRev);
        }, 'houseplan_config_updated');
      }
      // server-side trails are additive: an older backend without the WS
      // command just leaves the map empty and the card shows live-only trails
      this.hass.callWS({ type: 'houseplan/trail/get' })
        .then((r: any) => { this._vacSrvTrails = r?.trails || {}; this.requestUpdate(); })
        .catch(() => undefined);
      if (!this._unsubTrail) {
        this._unsubTrail = await this.hass.connection.subscribeEvents(async () => {
          try {
            const r: any = await this.hass.callWS({ type: 'houseplan/trail/get' });
            this._vacSrvTrails = r?.trails || {};
            this.requestUpdate();
          } catch { /* transient WS hiccup — the next event retries */ }
        }, 'houseplan_trail_updated');
      }
      if (!this._unsubLayout) {
        // Positions are separate state. The static card learned to follow them
        // in v1.46.0 and the full one did not, so two full cards side by side
        // stayed out of sync until a reload (HP-1460-03).
        this._unsubLayout = await this.hass.connection.subscribeEvents(
          (ev: any) => this._onLayoutEvent(Number(ev?.data?.rev ?? -1)),
          'houseplan_layout_updated',
        );
      }
      const hs = this._hashSpace();
      const nav = this._savedNav();
      if (!this._hashApplied && hs && this._model.find((s) => s.id === hs)) {
        this._space = hs;
        this._hashApplied = true;
      } else if (nav?.space && !this._navApplied && !this._hashApplied
          && this._model.find((s) => s.id === nav.space)) {
        // the cached config might have been stale (no such space) — retry once
        // the live config is in
        this._space = nav.space;
        this._navApplied = true;
      } else if (this._norm && !this._model.find((s) => s.id === this._space)) {
        this._space = this._model[0]?.id || this._space;
      }
      this._cacheSnapshot();
      // DEV-B703-03: a warm re-mount already holds the exact viewport of the
      // instance that was thrown away; the centred restore here IS the
      // reported jerk. Only a genuine navigation (the hash/nav landed us on
      // another space) still needs it.
      if (this._warmVpArmed && this._space === this._warmVp?.space) this._warmVpArmed = false;
      else this._restoreZoom();
    } catch (e) {
      if (this._serverCfg) {
        // DEV-B703-02: this instance already RENDERS a valid config (the LS
        // snapshot, or an earlier successful load). A failing socket is a
        // transient condition — nulling _serverCfg here blanked the plan on
        // every reconnect that took more than 8 hass ticks. Stale-while-
        // revalidate: the last valid config stays on screen until a
        // successful reload replaces it, and revalidation keeps running on
        // our own clock (willUpdate stops driving loads after 8 tries).
        this._scheduleLoadRetry();
      } else if (this._loadTries >= 8) {
        // nothing was ever shown — genuine no-backend: local-only fallback
        this._serverStorage = false;
        try {
          this._layout = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
        } catch {
          this._layout = {};
        }
      }
      // fewer than 8 tries with nothing shown yet: silently wait for the
      // next hass update (WS warm-up)
    } finally {
      this._loading = false;
    }
    this._regSignature = '';
    this._maybeRebuildDevices();
    this.requestUpdate();
  }

  /**
   * Adopt the server config. Any pending local write is flushed first and, if a
   * write is still in flight, the reload is deferred — adopting a revision on
   * top of an unsent edit is exactly how edits disappeared (audit L2).
   * `force` skips the deferral (conflict path: the local edit already lost).
   */
  private async _reloadConfigOnly(force = false, observedRev?: number): Promise<void> {
    if (!force) {
      // The event can arrive before the response to our own config/set. By the
      // time a pending write settles, its returned revision is current and the
      // queued event is merely an echo. Reloading it would erase the valid
      // session Undo stack after every local command. Revisions are monotonic,
      // so an equal or older observation is safe to ignore.
      if (observedRev !== undefined && observedRev <= this._cfgRev) return;
      if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.flush();
      if (this._cfgWriting) {
        // retry once the in-flight write settles
        clearTimeout(this._reloadRetry);
        this._reloadRetry = window.setTimeout(() => this._reloadConfigOnly(false, observedRev), 400);
        return;
      }
    }
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/config/get' });
      const cfg = resp?.config;
      this._geometryHistory.clear();
      this._clearGeometryGesture();
      this._serverCfg = cfg && Array.isArray(cfg.spaces) ? cfg : null;
      this._cfgEpoch++;
      this._cfgRev = resp?.rev || 0;
      this._canOptimizeUndo = !!resp?.can_optimize_undo;
      if (typeof resp?.can_write === 'boolean') this._serverCanWrite = resp.can_write;
      if (this._pendingNavMode && this._canEdit && !this._config?.kiosk) {
        this._mode = this._pendingNavMode;
        this._pendingNavMode = null;
      }
      this._cacheSnapshot();
      this._regSignature = '';
      this._maybeRebuildDevices();
      this.requestUpdate();
    } catch (e: any) {
      // a failed reload leaves the card on its last known config; tell the user
      // rather than silently diverging from the server (audit L2 note)
      this._showToast(this._t('toast.cfg_reload_failed', { err: this._errText(e) }));
    }
  }

  private _reloadRetry?: number;
  /** DEV-B703-02: self-driven revalidation once willUpdate's 8-try budget is
   *  spent — without it a card whose socket died at mount would show the
   *  cached plan forever and never revalidate (hass ticks stop driving loads
   *  after 8 tries). Exponential backoff capped at 8 s; single timer;
   *  cleared on disconnect and on a connection 'ready'. */
  private _loadRetryTimer?: number;
  private _scheduleLoadRetry(): void {
    if (this._loadRetryTimer !== undefined) return;
    const delay = Math.min(8000, 500 * 2 ** Math.min(4, Math.max(1, this._loadTries - 7)));
    this._loadRetryTimer = window.setTimeout(() => {
      this._loadRetryTimer = undefined;
      if (!this._loadOk && !this._loading && this.hass) this._loadFromServer();
    }, delay);
  }

  /** DEV-B703-02: revalidate the moment the socket comes back. The event
   *  subscriptions (houseplan_config_updated / layout / trail) survive a
   *  reconnect on their own — home-assistant-js-websocket keeps the
   *  Connection object alive and replays its subscription commands on
   *  'ready' — but a LOAD that burned its retry budget while the socket was
   *  down would never run again. 'ready' fires on every (re)connect: reset
   *  the budget and quietly re-read the config. */
  private _connHooked: { removeEventListener?: (t: string, cb: () => void) => void } | null = null;
  /** Shared, page-level full HA registry authority (one fetch/subscription per connection). */
  private _haRegistryRelease?: () => void;
  private _haRegistryConnection: any = null;
  private _haRegistryRev = -1;
  private _haBindingCacheKey = '';
  private _planHassMemo: { hass: any; sig: string; active: any; full: any } | null = null;
  private _onHaRegistryUpdate = (): void => {
    const snapshot = haRegistrySnapshot(this.hass);
    if (snapshot.revision === this._haRegistryRev && this._devices.length) return;
    this._haRegistryRev = snapshot.revision;
    this._planHassMemo = null;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this.requestUpdate();
  };

  private _ensureHaRegistryAuthority(): void {
    const connection = this.hass?.connection || null;
    if (!connection || connection === this._haRegistryConnection) return;
    this._haRegistryRelease?.();
    this._haRegistryConnection = connection;
    this._haRegistryRev = -1;
    this._haBindingCacheKey = '';
    this._planHassMemo = null;
    this._haRegistryRelease = acquireHaRegistries(this.hass, this._onHaRegistryUpdate);
    this._onHaRegistryUpdate();
  }

  private get _haRegistry(): HaRegistrySnapshot {
    return haRegistrySnapshot(this.hass);
  }

  /** Active-only projection for every plan-level state/data/action consumer. */
  private get _planHass(): any {
    const snapshot = this._haRegistry;
    const sig = haRegistryBuildSignature(this.hass, snapshot);
    const memo = this._planHassMemo;
    if (memo && memo.hass === this.hass && memo.sig === sig) {
      return memo.active;
    }
    const active = activeRegistryHass(this.hass, snapshot);
    const full = fullRegistryHass(this.hass, snapshot);
    this._planHassMemo = { hass: this.hass, sig, active, full };
    return active;
  }

  /** Full registry metadata for dialogs/ghost labels; never use for actions. */
  private get _fullRegistryHass(): any {
    void this._planHass;
    return this._planHassMemo?.full || this.hass;
  }

  private _bindingStatus(binding: string): HaBindingStatus {
    return resolveHaBindingStatus(this.hass, binding, this._haRegistry);
  }

  /** Redacted client-side support data; no states, names or marker metadata. */
  public houseplanDiagnostics(): {
    registry: ReturnType<typeof haRegistryDiagnostics> & { lastSuccessAgeMs: number | null };
    bindings: Record<HaBindingStatus['kind'], number>;
  } {
    const registry = haRegistryDiagnostics(this.hass);
    const bindings: Record<HaBindingStatus['kind'], number> = {
      active: 0,
      ha_disabled: 0,
      orphaned: 0,
      unverified: 0,
    };
    for (const marker of this._markers) {
      if (marker.removed || marker.binding === 'virtual') continue;
      bindings[this._bindingStatus(marker.binding).kind]++;
    }
    return {
      registry: {
        ...registry,
        lastSuccessAgeMs: registry.lastSuccess
          ? Math.max(0, Date.now() - registry.lastSuccess) : null,
      },
      bindings,
    };
  }

  private _openBindingInHa(binding: string): void {
    const [kind, ref] = binding.split(':');
    if (!ref) return;
    if (kind === 'device') {
      navigate('/config/devices/device/' + encodeURIComponent(ref));
      return;
    }
    if (kind === 'entity') {
      const reg = this._fullRegistryHass.entities?.[ref];
      if (reg?.device_id) {
        navigate('/config/devices/device/' + encodeURIComponent(reg.device_id));
      }
    }
  }

  /** Only device-backed bindings have a stable HA configuration route. */
  private _bindingHasHaPage(binding: string): boolean {
    const [kind, ref] = binding.split(':');
    if (!ref) return false;
    return kind === 'device'
      || (kind === 'entity' && !!this._fullRegistryHass.entities?.[ref]?.device_id);
  }

  private _toggleMarkerDialogVisibility(): void {
    const d = this._markerDialog;
    if (!d) return;
    const status = d.bindingMode === 'ha' ? this._bindingStatus(d.binding) : null;
    const effectivelyHidden = d.hideFromPlan || status?.kind === 'ha_disabled';
    if (effectivelyHidden && status?.kind === 'ha_disabled') {
      this._showToast(this._t(status.reason === 'entity'
        ? 'toast.ha_disabled_show_entity' : 'toast.ha_disabled_show_device'));
      return;
    }
    if (effectivelyHidden && status?.kind === 'unverified') {
      this._showToast(this._t('toast.ha_binding_unverified'));
      return;
    }
    this._markerDialog = { ...d, hideFromPlan: !effectivelyHidden };
  }
  private _onConnReady = (): void => {
    this._loadTries = 0;
    clearTimeout(this._loadRetryTimer);
    this._loadRetryTimer = undefined;
    refreshHaRegistries(this.hass);
    if (this._loading) return;
    // a subscribe lost mid-load leaves _loadOk=true without _unsubCfg — the
    // full load path repairs both (every subscribe in it is guarded)
    if (!this._loadOk || !this._unsubCfg) this._loadFromServer();
    else this._reloadConfigOnly();
  };
  private _hookConnection(): void {
    const conn = (this.hass as any)?.connection;
    if (!conn || conn === this._connHooked) return;
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    conn.addEventListener?.('ready', this._onConnReady);
    this._connHooked = conn;
  }
  /**
   * Signed urls for the content endpoint (audit follow-up B1 regression).
   * A browser cannot authenticate an <image href> or an <a href>: HA takes a
   * Bearer header or an `authSig` signed path, and an element sends neither.
   * So the card asks the backend to sign what it is about to display.
   */
  private _signer = new ContentSigner(() => this.requestUpdate());

  /** Display url: a signature we hold and still trust, else nothing. */
  private _display(url: string | null | undefined): string {
    return this._signer.display(this.hass, url);
  }

  /** Re-sign what the live config still references (wall tablets outlive one). */
  private _resign(): void {
    this._signer.resign(this.hass, referencedContentUrls(this._serverCfg));
  }

  private _layoutSyncTimer?: number;

  /**
   * A layout revision appeared. It may well be ours: the event travels over the
   * same socket as the reply to our own write and can arrive first, so
   * reacting immediately means re-reading what we just sent — and, worse,
   * racing a drag that has not been flushed yet. Wait a beat; if our own reply
   * lands in the meantime, `_layoutRev` catches up and there is nothing to do.
   */
  private _onLayoutEvent(rev: number): void {
    if (rev <= this._layoutRev) return;
    clearTimeout(this._layoutSyncTimer);
    this._layoutSyncTimer = window.setTimeout(() => {
      if (rev <= this._layoutRev) return; // it was ours after all
      this._reloadLayoutOnly();
    }, 200);
  }

  /**
   * Remember a revision this card produced, so its own `layout_updated` event
   * is not mistaken for someone else's and does not trigger a pointless
   * re-read of what we just wrote.
   */
  private _noteLayoutRev(r: any): void {
    const rev = r?.rev;
    if (typeof rev === 'number' && rev > this._layoutRev) this._layoutRev = rev;
  }

  /**
   * Adopt positions written elsewhere, without dropping our own (HP-1460-03).
   *
   * Only the layout is re-read — the config is untouched, so this cannot
   * disturb an edit in progress. Positions this card has moved but not yet
   * sent are flushed first and then kept on top of the server's answer: a fix
   * for a stale UI must not turn into a lost drag.
   */
  private async _reloadLayoutOnly(): Promise<void> {
    if (!this._serverStorage || !this.hass?.callWS) return;
    // Snapshot BEFORE flushing. `flush()` runs the debounced writer
    // synchronously, and the first thing that does is empty `_dirtyPos` — so
    // reading the dirty set afterwards found nothing to protect and the server's
    // older position was painted over the drag the user had just made
    // (HP-1461-02). Positions are captured by value for the same reason.
    const mine = new Map<string, any>();
    for (const id of this._dirtyPos) if (this._layout[id]) mine.set(id, this._layout[id]);
    if (this._persistLayout.pending()) this._persistLayout.flush();
    // …and again after the flush: what was dirty is now in flight, and a write
    // sent before this reload was even scheduled is in there too. Until the
    // server acknowledges a position, this card is the authority on it.
    for (const [id, pos] of this._sentPos) mine.set(id, pos);
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/layout/get' });
      const remote = resp?.layout || {};
      const merged: Record<string, any> = { ...remote };
      for (const [id, pos] of mine) merged[id] = pos;
      this._layout = merged;
      this._layoutRev = resp?.rev ?? this._layoutRev;
      this._canOptimizeUndo = !!resp?.can_optimize_undo;
      this._cacheSnapshot();
      this.requestUpdate();
    } catch {
      /* a failed refresh just leaves the positions we already had */
    }
  }

  private _dirtyPos = new Set<string>();
  /** Positions sent to the server and not acknowledged yet (HP-1461-02). */
  private _sentPos = new Map<string, { s?: string; x: number; y: number }>();

  private _persistLayout = debounce(() => {
    if (this._serverStorage) {
      // point-wise updates: do not overwrite positions changed in other windows
      const ids = [...this._dirtyPos];
      this._dirtyPos.clear();
      for (const id of ids) {
        const pos = this._layout[id];
        if (!pos) continue;
        // in flight until the server answers: a layout reload triggered in the
        // meantime must keep this position, not the one the server still has
        this._sentPos.set(id, pos);
        this.hass
          .callWS({ type: 'houseplan/layout/update', device_id: id, pos })
          .then((r: any) => this._noteLayoutRev(r))
          .catch((e: any) => this._showToast(this._t('toast.pos_save_failed', { err: this._errText(e) })))
          .finally(() => { if (this._sentPos.get(id) === pos) this._sentPos.delete(id); });
      }
      this._cacheSnapshot();
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(this._layout));
    }
  }, 600);

  // ================= devices from the registries =================

  private _maybeRebuildDevices(): void {
    const h = this.hass;
    if (!h?.devices || !h?.entities || !h?.areas) return;
    const registry = this._haRegistry;
    const sig =
      haRegistryBuildSignature(h, registry) + ':' + Object.keys(h.areas).length + ':' +
      (this._norm ? 'n' : 'l') + ':' + langOf(h, this._config?.language);
    if (sig === this._regSignature && this._devices.length) return;
    this._regSignature = sig;
    const before = new Map(this._devices.map((d) => [d.id, d.bindingStatus?.kind || 'active']));
    this._devices = buildDevices({
      hass: h,
      registry,
      areaToSpace: Object.fromEntries(
        Object.entries(this._areaToSpace).map(([a, v]) => [a, v.space]),
      ),
      markers: this._markers,
      settings: this._settings,
      excluded: this._excluded,
      showAll: this._showAll,
      firstSpaceId: this._model[0]?.id || '',
      loc: (k) => this._t(k),
      iconRules: this._iconRules,
    });
    const savedBindings = this._markers
      .filter((marker) => !marker.removed && marker.binding !== 'virtual')
      .map((marker) => marker.binding).sort();
    const bindingCacheKey = registry.revision + ':' + savedBindings.join('|');
    if (registry.authoritative && bindingCacheKey !== this._haBindingCacheKey) {
      const statuses = new Map<string, HaBindingStatus>();
      for (const binding of savedBindings) {
        statuses.set(binding, resolveHaBindingStatus(h, binding, registry));
      }
      cacheHaBindingStatuses(statuses);
      this._haBindingCacheKey = bindingCacheKey;
    }
    this._defPos = this._defaultPositions();
    this._syncNewDevices();
    this._seedHiddenDevices();
    // Rebuilds also happen without a hass update (marker save/rebind). Establish
    // new baselines and clear old flashes synchronously, before the next paint.
    this._syncActivityRuntime();
    const liveVac = new Set(this._devices.filter((d) => !d.hidden).map((d) => d.id));
    for (const id of this._vacRt.keys()) if (!liveVac.has(id)) this._vacRt.delete(id);
    if (this._infoCard) {
      const current = this._devices.find((d) => d.id === this._infoCard!.id);
      this._infoCard = current && current.bindingStatus?.kind !== 'ha_disabled'
        ? current : null;
    }
    const disabledNow = this._devices.some(
      (d) => d.bindingStatus?.kind === 'ha_disabled' && before.get(d.id) !== 'ha_disabled',
    );
    if (disabledNow) {
      if (this._infoCard?.bindingStatus?.kind === 'ha_disabled'
          || this._devices.find((d) => d.id === this._infoCard?.id)?.bindingStatus?.kind === 'ha_disabled') {
        this._infoCard = null;
      }
      if (this._drag && this._devices.find((d) => d.id === this._drag!.id)?.bindingStatus?.kind === 'ha_disabled') {
        this._drag = null;
      }
      clearTimeout(this._holdTimer);
      this._holdFired = false;
      this._tip = null;
      this._tapConfirm = null;
    }
    if (this._nativeMoreInfoEntity && !this._planEntityAvailable(this._nativeMoreInfoEntity)) {
      fireEvent(this, 'hass-more-info', { entityId: null });
      this._nativeMoreInfoEntity = null;
    }
  }

  /**
   * "New device" flag (server-side, shared by every client): an auto device
   * that appears after the known baseline was recorded gets a red dot until
   * someone opens its editor. The baseline is seeded silently on first run,
   * so an upgrade never floods the plan with dots.
   */
  private _syncNewDevices(): void {
    if (!this._norm || !this._loadOk || !this._serverCfg) return;
    // only auto-appearing icons: area devices and light groups; markers are user-made
    const autoIds = this._devices.filter((d) => !d.marker && !d.virtual).map((d) => d.id).sort();
    const key = autoIds.join(',');
    if (key === this._newSyncKey) return; // same registry picture — nothing to do
    this._newSyncKey = key;
    const st: any = this._settings;
    const { fresh, known } = diffNewDevices(autoIds, st.known_devices);
    if (!Array.isArray(st.known_devices) || fresh.length) {
      const newIds = [...new Set([...(st.new_device_ids || []), ...fresh])];
      this._serverCfg = {
        ...this._serverCfg,
        settings: { ...st, known_devices: known, new_device_ids: newIds },
      };
      // best-effort persist: non-admins under admin_only just keep the local view
      this._saveConfig();
    }
  }

  /** Ids currently flagged as new (drawn with the red dot). */
  private get _newIds(): Set<string> {
    const list = (this._settings as any).new_device_ids;
    return new Set(Array.isArray(list) ? list : []);
  }

  /** First visit to the device's editor acknowledges its "new" flag. */
  private _ackNewDevice(id: string): void {
    if (!this._newIds.has(id) || !this._serverCfg) return;
    const st: any = this._settings;
    this._serverCfg = {
      ...this._serverCfg,
      settings: { ...st, new_device_ids: (st.new_device_ids || []).filter((x: string) => x !== id) },
    };
    this._saveConfig();
    this.requestUpdate();
  }

  /** Filtering + light groups + overrides + virtual devices. */
  private get _markers(): Marker[] {
    return this._serverCfg?.markers || [];
  }

  private _roomLqi(area: string | null): number | null {
    if (!area) return null;
    const vals: number[] = [];
    for (const d of this._devices) {
      if (d.area !== area || d.virtual) continue;
      const l = lqiFor(this.hass, d.entities);
      if (l != null) vals.push(l);
    }
    return averageLqi(vals);
  }

  // ================= positions =================

  /** Bounding rectangle of a room (rect or polygon) in render units. */
  private _roomBounds(r: RoomCfg): { x: number; y: number; w: number; h: number } {
    if (r.poly && r.poly.length) {
      const xs = r.poly.map((p) => p[0]);
      const ys = r.poly.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    return { x: r.x ?? 0, y: r.y ?? 0, w: r.w ?? 0, h: r.h ?? 0 };
  }

  private _defaultPositions(): Record<string, { x: number; y: number }> {
    const map: Record<string, { x: number; y: number }> = {};
    const iconPct = this._config?.icon_size ?? 2.5;
    for (const s of this._model) {
      // docs/CANVAS.md §6: the icon's RENDER-unit footprint follows the plan's
      // own size — NORM_W for anything inside the old square (identical to
      // before), proportionally more for a plan several canvases wide.
      const minDist = (iconPct / 100) * iconUnit(s) * 1.3;
      for (const r of s.rooms) {
        if (!r.area) continue;
        // HA-disabled saved markers stay in the roster: they render nowhere
        // outside the service ghost, but reserve their old auto-grid slot so
        // temporary deactivation cannot shuffle visible neighbours.
        const ds = this._devices.filter((d) => d.area === r.area && d.space === s.id);
        if (!ds.length) continue;
        const b = this._roomBounds(r);
        const pad = Math.min(b.w, b.h) * 0.1;
        const iw = b.w - pad * 2;
        const ih = b.h - pad * 2;
        const cols = Math.max(1, Math.round(Math.sqrt((ds.length * iw) / Math.max(ih, 1))));
        const rows = Math.ceil(ds.length / cols);
        const cw = iw / cols;
        const ch = ih / Math.max(rows, 1);
        const pts = ds.map((_, i) => ({
          x: b.x + pad + cw * ((i % cols) + 0.5),
          y: b.y + pad + ch * (Math.floor(i / cols) + 0.5),
        }));
        declump(pts, b, minDist, pad * 0.5);
        // an auto-placed icon lands on a node too (docs/CANVAS.md §9) — the
        // owner's "everything on the grid" covers what the card places itself
        ds.forEach((d, i) => (map[d.id] = snapPt(pts[i])));
      }
    }
    return map;
  }

  /** Device position in render units of the current space. */
  private _pos(d: DevItem): { x: number; y: number } {
    const s = this._spaceModel(d.space);
    const saved = this._layout[d.id];
    if (saved) {
      if (this._norm) {
        if (saved.s === d.space) {
          return { x: saved.x * NORM_W, y: saved.y * NORM_W };
        }
      } else if (saved.s === undefined) {
        return { x: saved.x, y: saved.y };
      }
    }
    if (this._defPos[d.id]) return this._defPos[d.id];
    // the middle of what IS drawn, not of a canvas that has no edges any more
    return snapPt(spaceCenter(s));
  }

  private _savePos(d: DevItem, x: number, y: number): void {
    if (this._norm) {
      // The icon center snaps to the nodes of the same grid as the room markup
      // (docs/CANVAS.md §9). UX-05 has no free-position escape hatch.
      const g = this._gridPitch;
      const gx = Math.round(x / g) * g;
      const gy = Math.round(y / g) * g;

      const prevK = (this._layout[d.id] as any)?.k;
      this._layout = {
        ...this._layout,
        [d.id]: { s: d.space, x: clampCanvasN(gx / NORM_W), y: clampCanvasN(gy / NORM_W),
          ...(prevK ? { k: prevK } : {}) },
      };
    } else {
      this._layout = { ...this._layout, [d.id]: { x: Math.round(x), y: Math.round(y) } };
    }
    this._dirtyPos.add(d.id);
    this._persistLayout();
  }

  // ================= live states =================

  /**
   * The device's own cover, when the marker is EXPLICITLY «Open/close»
   * (`tap_action: 'cover'`) — otherwise null. One helper, one answer: the tap
   * acts on it, the badge speaks for it, the icon morphs with it.
   *
   * The rule and why it is the least surprising one (owner, 2026-08-04 —
   * docs/FILTERING.md «What a marker SHOWS»): a marker keeps indicating its
   * PRIMARY entity, unless its owner has said, in the marker dialog, that
   * this thing is a curtain. Saying so is the only statement the card has
   * that means «the cover is what this device does»; a mixed marker (a lamp
   * with a sensor, a TRV with a service switch) is never touched behind the
   * user's back, and there is no third notion of «what this marker is»
   * besides the option the dialog offers and the entity the tap drives.
   */
  private _coverIndicator(d: DevItem): string | null {
    return d.tapAction === 'cover' ? coverEntityOf(d.entities) : null;
  }

  /** The entity a marker's tap acts on and its indication speaks for. */
  private _actEntity(d: DevItem): string | undefined {
    return this._coverIndicator(d) || d.primary;
  }

  /** Legacy `ripple` is read as the surviving icon+activity presentation. */
  private _displayOf(d: DevItem): 'badge' | 'icon_ripple' | 'value' {
    const display = d.marker?.display;
    return display === 'ripple' ? 'icon_ripple' : display || 'badge';
  }

  /**
   * Entities that jointly describe the marker. Explicit cover intent wins;
   * otherwise the same resolved light set used by Glow/fill/controls wins;
   * a non-light marker uses its resolved device-state role. Critical secondary
   * entities are appended so an alarm cannot hide behind a less important
   * functional source.
   */
  private _visualSamples(d: DevItem): EntityVisualSample[] {
    return resolvePresentationSources(this._planHass, d).samples;
  }

  /** One semantic projection consumed by the plan, preview and static card. */
  private _devicePresentation(
    d: DevItem, showLqi = true, designPreview = false,
  ): ResolvedDevicePresentation {
    return resolveDevicePresentation(this._planHass, d, {
      liveStates: this._config?.live_states !== false,
      showTemperature: this._config?.show_temperature !== false,
      showSignal: showLqi && this._config?.show_signal !== false,
      designPreview,
      activityRuntime: this._activityRt.get(d.id),
    });
  }

  /** One semantic result feeds the plate and every non-critical activity effect. */
  private _deviceVisual(d: DevItem): DeviceVisualState {
    return this._devicePresentation(d).visual;
  }

  /** CSS classes retained behind the old helper name for smoke/debug callers. */
  private _stateClass(d: DevItem, visual = this._deviceVisual(d)): string {
    const presentation = this._devicePresentation(d);
    if (presentation.effectiveHidden) return '';
    const activity = presentation.display === 'icon_ripple'
      && this._config?.live_states !== false && visual.status !== 'alarm'
      ? visual.activity : 'none';
    return presentationClasses({ ...presentation, visual, activity }).join(' ');
  }

  private _liveTemp(d: DevItem): number | null {
    if (!this._config?.show_temperature) return null;
    // Opt-in climate source (marker.use_climate_temp): the AC/thermostat's
    // current_temperature gets the same badge a thermometer has. No valid
    // reading (missing attribute, unavailable) -> no badge at all.
    if (d.marker?.use_climate_temp === true) {
      const t = climateTempFor(this.hass, d.entities);
      if (t != null) return t;
    }
    if (d.icon !== 'mdi:thermometer' && d.icon !== 'mdi:air-filter') return null;
    return tempFor(this.hass, d.entities);
  }

  /** Every HA entity owned by a dialog binding. */
  private _bindingEntities(binding: string): string[] {
    if (binding === 'virtual' || !binding) return [];
    const status = this._bindingStatus(binding);
    return status.kind === 'active' ? status.enabledEntityIds : status.allEntityIds;
  }

  /** Does the dialog's binding carry a climate entity? Gates the opt-in checkbox. */
  private _bindingHasClimate(binding: string): boolean {
    return this._bindingEntities(binding).some((eid) => eid.startsWith('climate.'));
  }

  /** The cover entity behind the dialog's binding, or null. */
  private _bindingCoverEntity(binding: string): string | null {
    return coverEntityOf(this._bindingEntities(binding));
  }

  /**
   * Does the dialog's binding deserve the «Open/close» tap option? Gates it
   * exactly like the climate checkbox above: only a device that HAS a cover
   * entity sees it — and never a garage door, a gate or a driveway door
   * (COVER_GUARDED_CLASSES; owner 2026-08-03: «нет, только шторы/жалюзи»).
   */
  private _bindingCoverTap(binding: string): boolean {
    const eid = this._bindingCoverEntity(binding);
    if (!eid) return false;
    const dc = String(this.hass?.states?.[eid]?.attributes?.device_class || '');
    return !COVER_GUARDED_CLASSES.has(dc);
  }

  private _liveHum(d: DevItem): number | null {
    if (!this._config?.show_temperature) return null; // same "sensor values" toggle as temperature
    if (!d.primary || !isHumEntity(this.hass, d.primary)) return null;
    return humFor(this.hass, d.entities);
  }

  // ================= interaction =================

  private _deviceBindingActive(d: DevItem, notify = true): boolean {
    if (d.virtual || d.bindingKind === 'virtual') return true;
    if (!d.bindingKind || !d.bindingRef) return false;
    const status = this._bindingStatus(`${d.bindingKind}:${d.bindingRef}`);
    if (status.kind === 'active') return true;
    if (notify) {
      this._showToast(this._t(status.kind === 'ha_disabled'
        ? 'toast.ha_disabled_action' : 'toast.ha_binding_unverified'));
    }
    return false;
  }

  private _openMoreInfo(entityId?: string): void {
    if (!entityId) {
      this._showToast(this._t('toast.no_entity'));
      return;
    }
    if (!this._planEntityAvailable(entityId)) {
      this._showToast(this._t('toast.ha_disabled_action'));
      return;
    }
    this._nativeMoreInfoEntity = entityId;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  /** Right click in VIEW mode always opens HA's more-info (owner's decision). */
  private _ctxDevice(ev: MouseEvent, d: DevItem): void {
    if (this._mode !== 'view') return; // editors keep the native context menu
    ev.preventDefault();
    ev.stopPropagation();
    if (!this._deviceBindingActive(d)) return;
    if (d.primary) this._openMoreInfo(d.primary);
    else this._infoCard = d;
  }

  private _clickDevice(ev: MouseEvent, d: DevItem): void {
    ev.stopPropagation();
    if (this._drag?.moved || this._suppressClick || this._holdFired) return;
    if (this._mode === 'plan') return;
    if (this._mode === 'devices') {
      this._openMarkerDialog(d);
      return;
    }
    if (!this._deviceBindingActive(d)) return;
    // The entity a tap ACTS ON. Normally the primary one — but the explicit
    // «Open/close» drives the device's cover wherever it sits in the entity
    // list (coverEntityOf): a curtain driver whose primary is a service
    // switch used to resolve on the domain `switch` and fall back to the info
    // card, which is exactly what the owner saw (2026-08-04). The guarded
    // class is read off that same cover, so a garage still degrades.
    const coverEid = this._coverIndicator(d);
    const actEid = this._actEntity(d);
    const domain = actEid ? actEid.split('.')[0] : null;
    // the accidental-tap guard (owner's spec 2026-07-29): any state-changing
    // action — toggle or run — may ask first. The dialog is ours, not the
    // browser confirm(), so it works and looks right on a wall tablet.
    const guarded = (text: string, exec: () => void): void => {
      if (d.marker?.tap_confirm) this._tapConfirm = { text, exec };
      else exec();
    };
    // a switch with bound targets: the EXPLICIT per-marker toggle flips them
    // all with HA-group semantics (any on -> all off). Owner's decision:
    // controls never fire on the card-wide default action.
    const controls = resolvedLightSources(this._planHass, [d])
      .filter((source) => source.via === 'controls')
      .map((source) => source.eid);
    if (d.tapAction === 'toggle' && controls.length) {
      const act = controlsAction(controls.map((e) => this.hass.states[e]?.state));
      guarded(this._t('confirm.tap_toggle', { name: d.name }), () => {
        if (!this._deviceBindingActive(d)
            || controls.some((eid) => !this._planEntityAvailable(eid))) return;
        this.hass
          .callService('homeassistant', act, { entity_id: controls })
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    const action = resolveTapAction(
      d.tapAction, undefined, domain,
      actEid ? this.hass.states[actEid]?.attributes?.device_class : null,
    );
    if (action === 'run') {
      const target = d.marker?.tap_target || '';
      const svc = runServiceFor(target);
      const st = this.hass.states[target];
      if (!svc || !st) {
        this._showToast(this._t('toast.run_target_missing'));
        return;
      }
      const name = st.attributes?.friendly_name || target;
      guarded(this._t('confirm.tap_run', { name }), () => {
        if (!this._deviceBindingActive(d) || !this._planEntityAvailable(target)) return;
        this.hass
          .callService(svc.domain, svc.service, { entity_id: target })
          .then(() => {
            this._stampActivity(d.id, 'event', this._activitySourceKey(d));
            this.requestUpdate();
            this._showToast(this._t('toast.run_started', { name }));
          })
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    if (action === 'cover' && coverEid) {
      // open / close / stop, decided by the CURRENT state
      // (legacy/docs/PRODUCT-2026-07-05.md — original interaction decision);
      // a tap while the curtain travels stops it, the next one reverses
      const svc = coverService(this.hass.states[coverEid]?.state);
      guarded(this._t('confirm.tap_cover', { name: d.name }), () => {
        if (!this._deviceBindingActive(d) || !this._planEntityAvailable(coverEid)) return;
        this.hass
          .callService('cover', svc, { entity_id: coverEid })
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    if (action === 'toggle' && d.primary) {
      guarded(this._t('confirm.tap_toggle', { name: d.name }), () => {
        if (!this._deviceBindingActive(d) || !this._planEntityAvailable(d.primary)) return;
        this.hass
          .callService('homeassistant', 'toggle', { entity_id: d.primary })
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    if (action === 'more-info' && d.primary) {
      this._openMoreInfo(d.primary);
      return;
    }
    this._infoCard = d;
  }

  /** Translate a key in the card's current language. */
  private _t(key: I18nKey, vars?: Record<string, string | number>): string {
    return t(langOf(this.hass, this._config?.language), key, vars);
  }

  private get _stageEl(): HTMLElement | null {
    return this.renderRoot.querySelector('.stage') as HTMLElement | null;
  }

  /**
   * Everything of the current space that counts as CONTENT, one item per
   * object (docs/CANVAS.md §4): rooms and the backdrop image come from the
   * model, openings/decor/devices are added here because the model does not
   * carry them. Devices use their RESOLVED position, so a marker parked in
   * the far corner of the yard frames with the rest.
   *
   * HIDDEN devices are NOT content (DEV-2C947-01): the frame is presentation,
   * and a device the plan does not draw must not decide what the plan opens
   * on — hiding a marker that once wandered into the yard used to leave the
   * house a dot in the corner of an empty frame. They keep counting for room
   * LQI/climate and they keep their auto-grid cell (docs/FILTERING.md); only
   * the frame stops seeing them, including the ghosts of the device editor,
   * whose reach is the pan slack's job, not the opening view's.
   */
  private _contentItems(m: SpaceModel): ContentItem[] {
    const extra: ContentItem[] = [];
    for (const d of this._devices) {
      if (d.space !== m.id || d.hidden) continue;
      const p = this._pos(d);
      extra.push({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y });
    }
    if (m.id === this._space) {
      for (const o of this._openingsR) {
        const rad = (Number(o.angle) * Math.PI) / 180;
        const dx = (Math.cos(rad) * o.rlen) / 2, dy = (Math.sin(rad) * o.rlen) / 2;
        const it = itemOf([[o.rx - dx, o.ry - dy], [o.rx + dx, o.ry + dy]]);
        if (it) extra.push(it);
      }
      const H = this._decorH;
      for (const x of this._decorList) {
        const pts = x.kind === 'line'
          ? [[x.x1 * NORM_W, x.y1 * H], [x.x2 * NORM_W, x.y2 * H]]
          : x.kind === 'text'
            ? [[x.x * NORM_W, x.y * H]]
            : boxCorners({ x: x.x * NORM_W, y: x.y * H, w: x.w * NORM_W,
                h: x.h * H, angle: x.angle });
        const it = itemOf(pts);
        if (it) extra.push(it);
      }
      // Independent physical geometry participates in content bounds even
      // outside room paper. Each body is one bounded object, never a vote made
      // only by its centre point.
      for (const body of this._physicalBodiesR(m)) {
        const it = itemOf(body);
        if (it) extra.push(it);
      }
    }
    return contentItems(m, extra);
  }

  /**
   * The content frame of the current space, memoised (docs/CANVAS.md §4).
   *
   * In VIEW mode it follows the config: adding a device out in the yard
   * widens what "fit" means. Inside an EDITOR it only ever GROWS — the frame
   * bounds pan and the meaning of zoom 1, and a frame that shrank the moment
   * you deleted a room would move the ground under a drag. It never bounds
   * where you may DRAW: §5 pan slack plus 3x zoom-out is far more room than
   * the old square ever gave (that is what HP-1490-03 needed).
   */
  private _frame:
    | { id: string; model: SpaceModel; layout: unknown; devs: unknown; far: boolean;
        grow: boolean; rect: Rect; all: Rect; outliers: number }
    | null = null;
  /** The outlier hint's «Показать» is on: the frame takes in the far strays
   *  too, so zoom, pan and the fit button all agree about what "everything"
   *  is. Reset when the space changes (docs/CANVAS.md §4.1). */
  private _showFar = false;

  private _frameOf(): { rect: Rect; all: Rect; outliers: number } {
    const m = this._spaceModel();
    // Memo by IDENTITY, not by an epoch counter: `_model`, `_layout` and
    // `_devices` are all replaced (never mutated in place) whenever their
    // content changes, so this catches a marker drag and a server push alike —
    // an epoch would have to be bumped at every one of those call sites.
    const f = this._frame;
    // `grow` is part of the KEY, not just of the computation (DEV-2C947-02):
    // the union an editor accumulated is an editor's frame, and leaving for
    // View has to recompute rather than inherit it — otherwise a room moved
    // far away in the Plan editor kept View framing the empty ground it left
    // behind, until some unrelated model change happened to invalidate memo.
    const grow = this._mode !== 'view';
    // A LIVE BACKDROP GESTURE FREEZES THE FRAME (docs/BACKDROP.md §2). The
    // picture is a content item, so dragging it grows the frame — which
    // rescales the view, which changes how many plan units a screen pixel is
    // worth, mid-gesture: the picture then runs away from the finger and no
    // drag lands where it was aimed. The frame catches up on release.
    if (f && f.id === m.id && this._bdDrag) return f;
    if (f && f.id === m.id && f.model === m && f.layout === this._layout
        && f.devs === this._devices && f.far === this._showFar && f.grow === grow) return f;
    const cf = contentFrame(this._contentItems(m));
    let all = cf.all || spaceFrame(m);
    let rect = this._showFar ? all : (cf.core || spaceFrame(m));
    if (f && f.id === m.id && grow && f.grow) {
      // Inside an editor the frame only GROWS: it bounds pan and defines what
      // zoom 1 means, and a frame that shrank the instant a room was deleted
      // would move the ground under the pointer mid-gesture. Only ever unions
      // with a frame the SAME editor session produced (f.grow).
      rect = unionRect(f.rect, rect);
      all = unionRect(f.all, all);
    }
    this._frame = {
      id: m.id, model: m, layout: this._layout, devs: this._devices,
      far: this._showFar, grow, rect, all, outliers: cf.outliers,
    };
    return this._frame;
  }

  /** The rectangle "fit to screen" fits — always the content (docs/CANVAS.md). */
  private _baseVb(): number[] {
    const r = this._frameOf().rect;
    return [r.x, r.y, r.w, r.h];
  }

  /** How many objects the opening view deliberately leaves out (§4.1). */
  private get _outliers(): number {
    return this._showFar ? 0 : this._frameOf().outliers;
  }

  /** The outlier hint's action: take the far objects into the frame, then fit. */
  private _fitFar(): void {
    this._showFar = true;
    this._frame = null;
    this._resetZoom();
  }

  /** «Вписать всё» (docs/CANVAS.md §8) — the toolbar button and the "home is
   *  that way" arrow share it. It fits whatever the frame currently means:
   *  the main mass, or everything once the far-objects hint has been used. */
  private _fitAll(): void {
    this._showFar = true;
    this._frame = null;
    this._resetZoom();
  }

  /** Unobtrusive inline hint: some objects stand an order of magnitude away
   *  from the plan and are deliberately outside the opening view. No modal —
   *  a chip with one action (docs/CANVAS.md §4.1). */
  private _renderFarHint(): TemplateResult | typeof nothing {
    if (this._kiosk || this._mode !== 'view' || this._booting || !this._outliers) return nothing;
    return html`<div class="farhint">
      <ha-icon icon="mdi:map-marker-alert-outline"></ha-icon>
      <span>${this._t('canvas.far_objects', { n: this._outliers })}</span>
      <button class="btn ghostbtn" @click=${() => this._fitFar()}>${this._t('canvas.show_far')}</button>
    </div>`;
  }

  /** "Home is that way" (docs/CANVAS.md §5): the plane has no edges, so it is
   *  possible to pan until nothing is on screen. One small pointer towards the
   *  content, one click back to it. */
  private _renderHomeArrow(): TemplateResult | typeof nothing {
    if (this._booting) return nothing;
    const v = this._view;
    if (!v || !v.w || !v.h) return nothing;
    const f = this._frameOf().rect;
    const gone = f.x + f.w <= v.x || f.x >= v.x + v.w || f.y + f.h <= v.y || f.y >= v.y + v.h;
    if (!gone) return nothing;
    const ang = Math.atan2((f.y + f.h / 2) - (v.y + v.h / 2), (f.x + f.w / 2) - (v.x + v.w / 2));
    const left = 50 + Math.cos(ang) * 38;
    const top = 50 + Math.sin(ang) * 38;
    return html`<button class="homearrow" title=${this._t('canvas.home_tip')}
      style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%"
      @click=${(e: Event) => { e.stopPropagation(); this._fitAll(); }}>
      <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${((ang * 180) / Math.PI).toFixed(1)}deg)"></ha-icon>
    </button>`;
  }

  /** Aspect ratio of the scene (width/height, px). */
  private _stageAspect(): number {
    const s = this._stageEl;
    const vb = this._baseVb();
    return s && s.clientHeight ? s.clientWidth / s.clientHeight : vb[2] / vb[3];
  }

  /** Current view with a fallback to the full fit. */
  private _viewOr(vb: number[]): { x: number; y: number; w: number; h: number } {
    return this._view && this._view.w ? this._view : fitView(vb, this._stageAspect());
  }

  /** Screen (sx,sy relative to the scene, px) → vb coordinates per the current view. */
  private _screenToVb(sx: number, sy: number): number[] {
    const s = this._stageEl;
    const v = this._viewOr(this._baseVb());
    const w = s?.clientWidth || 1, h = s?.clientHeight || 1;
    return [v.x + (sx / w) * v.w, v.y + (sy / h) * v.h];
  }

  /** Zoom limits (docs/CANVAS.md §5): 8x in as before, 3x out — beyond that
   *  the screen is empty plane, which is not information. */
  private static readonly ZOOM_MAX = 8;
  private static readonly ZOOM_MIN = MIN_ZOOM;

  /**
   * Keep the view within reach of the content (docs/CANVAS.md §5).
   *
   * There is no edge any more, so this is NOT "the content must cover the
   * scene" — that was the rule that made it impossible to draw or place
   * anything past the plan. Panning may walk a whole screen off the content
   * in every direction (PAN_SLACK), which is what an editor needs to extend a
   * plan outwards; further than that you would only be lost, and the "home is
   * that way" arrow already covers the walk back.
   */
  private _clampView(
    v: { x: number; y: number; w: number; h: number },
    fit: { x: number; y: number; w: number; h: number },
  ): { x: number; y: number; w: number; h: number } {
    const axis = (vp: number, vs: number, fp: number, fs: number): number => {
      const slack = Math.max(vs, fs) * PAN_SLACK;
      const a = fp - slack, b = fp + fs - vs + slack;
      return Math.max(Math.min(a, b), Math.min(Math.max(a, b), vp));
    };
    return { w: v.w, h: v.h, x: axis(v.x, v.w, fit.x, fit.w), y: axis(v.y, v.h, fit.y, fit.h) };
  }

  /** Set the zoom (centered on vb point cx,cy, or on the center of the current view). */
  private _applyView(zoom: number, cx?: number, cy?: number): void {
    const vb = this._baseVb();
    const fit = fitView(vb, this._stageAspect());
    const z = Math.min(HouseplanCard.ZOOM_MAX, Math.max(HouseplanCard.ZOOM_MIN, zoom));
    const w = fit.w / z, h = fit.h / z;
    const cur = this._viewOr(vb);
    const ccx = cx ?? cur.x + cur.w / 2;
    const ccy = cy ?? cur.y + cur.h / 2;
    this._zoom = z;
    this._view = this._clampView({ x: ccx - w / 2, y: ccy - h / 2, w, h }, fit);
  }

  /**
   * HP-1552: hold the boot veil until the stage height settles. AUD-1552-02:
   * the old "two equal reads at a 200 ms cadence" revealed the plan at
   * ~400 ms, so an HA panel landing right after (450+ ms is realistic on a
   * slow device) still jumped on a VISIBLE plan. The veil now holds for the
   * full protective window (BOOT_MIN_MS); the height is sampled every 100 ms
   * and any change restarts a trailing-quiescence requirement
   * (BOOT_QUIET_MS), so chrome still settling near the cap extends the wait.
   * BOOT_MAX_MS lifts the veil unconditionally — it can never get stuck.
   */
  private _bootWatch(): void {
    clearTimeout(this._bootTimer); // never two concurrent watchers (connect + updated)
    this._bootStart = Date.now();
    this._bootLastH = -1; // the first read only arms the comparison
    this._bootLastChange = this._bootStart;
    const tick = () => {
      if (!this._booting) return;
      const now = Date.now();
      const h = this._stageEl ? this._stageEl.clientHeight : 0;
      if (h !== this._bootLastH) { this._bootLastH = h; this._bootLastChange = now; }
      const elapsed = now - this._bootStart;
      if (elapsed >= BOOT_MAX_MS || (elapsed >= BOOT_MIN_MS && h > 0 && now - this._bootLastChange >= BOOT_QUIET_MS)) {
        this._bootSettled();
        return;
      }
      this._bootTimer = window.setTimeout(tick, 100);
    };
    this._bootTimer = window.setTimeout(tick, 100);
  }

  private _bootSettled(): void {
    if (!this._booting) return;
    this._refitView(); // reveal in the final geometry, never mid-jump
    this._booting = false;
    // DEV-B703-01: the page has settled once — the next instance with the
    // same config at the same viewport opens warm (no veil, no wait).
    const settledH = this._stageEl?.clientHeight ?? 0;
    if (!this._config?.kiosk && settledH > 0) {
      this._warmPatch({ hdrH: this._hdrH, stageH: settledH, vp: this._warmViewportState() }, true);
    }
    this._bootFading = true; // one soft opacity-out, then out of the DOM
    this._bootTimer = window.setTimeout(() => { this._bootFading = false; }, 220);
    // AUD-1552-02: chrome that lands after the cap (device slower than
    // BOOT_MAX_MS) must not snap — for a short grace the stage height
    // transitions and the viewport ResizeObserver refits the plan each frame.
    this._bootSoft = true;
    clearTimeout(this._bootSoftTimer);
    this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
  }

  /** The soft grace only covers PASSIVE late chrome. A user action that
   *  changes the stage height (entering/leaving an editor) must apply
   *  instantly — the plan may not drift under the pointer mid-drag. */
  private _bootSoftCancel(): void {
    if (!this._bootSoft) return;
    clearTimeout(this._bootSoftTimer);
    this._bootSoft = false;
  }

  /** Hide only the unstable plan frames after a genuinely long tab sleep.
   *  The header remains usable and the existing stage background stays put;
   *  once its measured size has been quiet, viewport + reveal land in the
   *  same Lit update. */
  private _beginResumeSettle(): void {
    if (this._kiosk || this._mode !== 'view' || this._booting || this._resumeSettling) return;
    this._resumeSettling = true;
    this._resumeStarted = performance.now();
    this._resumeLastSize = '';
    this._resumeLastChange = this._resumeStarted;
    this._viewportInvalidAt = 0;
    this.requestUpdate();
    if (this._resumeRaf) cancelAnimationFrame(this._resumeRaf);
    this._resumeRaf = requestAnimationFrame(() => this._resumeSettleTick());
  }

  private _resumeSettleTick(): void {
    this._resumeRaf = 0;
    if (!this._resumeSettling || !this.isConnected) return;
    if (this._kiosk || this._mode !== 'view') {
      this._resumeSettling = false;
      this.requestUpdate();
      return;
    }
    const now = performance.now();
    const stage = this._stageEl;
    const measurable = !!stage && stage.clientWidth > 0 && stage.clientHeight > 0;
    if (measurable) {
      const size = `${stage!.clientWidth}x${stage!.clientHeight}`;
      if (size !== this._resumeLastSize) {
        this._resumeLastSize = size;
        this._resumeLastChange = now;
      }
    }
    const elapsed = now - this._resumeStarted;
    const settled = measurable && elapsed >= RESUME_MIN_MS && now - this._resumeLastChange >= RESUME_QUIET_MS;
    if (settled || elapsed >= RESUME_MAX_MS) {
      const cur = this._view;
      this._resumeSettling = false;
      if (measurable) {
        this._applyView(
          this._zoom,
          cur ? cur.x + cur.w / 2 : undefined,
          cur ? cur.y + cur.h / 2 : undefined,
        );
      }
      this.requestUpdate();
      return;
    }
    this._resumeRaf = requestAnimationFrame(() => this._resumeSettleTick());
  }

  /** Recompute the view for a new scene size, preserving zoom and center. */
  private _refitView(): void {
    const stage = this._stageEl;
    // ResizeObserver may deliver a zero/transitional box while a browser tab
    // is frozen or while Lovelace replaces the card. Mutating `_view` from
    // that box is the scale jump observed on return.
    if (!stage || document.visibilityState !== 'visible' || stage.clientWidth <= 0 || stage.clientHeight <= 0) {
      if (!this._viewportInvalidAt) this._viewportInvalidAt = Date.now();
      return;
    }
    if (this._viewportInvalidAt) {
      const invalidFor = Date.now() - this._viewportInvalidAt;
      this._viewportInvalidAt = 0;
      // Lovelace's own view tabs can hide a card without hiding `document`.
      // A long zero-box interval is the equivalent suspension signal.
      if (invalidFor >= RESUME_LONG_HIDDEN_MS && !this._resumeSettling) {
        this._beginResumeSettle();
        if (this._resumeSettling) return;
      }
    }
    if (this._resumeSettling) return;
    const cur = this._view;
    this._applyView(this._zoom, cur ? cur.x + cur.w / 2 : undefined, cur ? cur.y + cur.h / 2 : undefined);
    this.requestUpdate();
  }

  /** Change the zoom while keeping the point (sx,sy relative to the scene) in place. */
  private _zoomAt(sx: number, sy: number, newZoom: number): void {
    const stage = this._stageEl;
    if (!stage) return;
    const vb = this._baseVb();
    const fit = fitView(vb, this._stageAspect());
    const z = Math.min(HouseplanCard.ZOOM_MAX, Math.max(HouseplanCard.ZOOM_MIN, newZoom));
    const w = stage.clientWidth, h = stage.clientHeight;
    const pt = this._screenToVb(sx, sy);
    const nw = fit.w / z, nh = fit.h / z;
    this._zoom = z;
    this._view = this._clampView({ x: pt[0] - (sx / w) * nw, y: pt[1] - (sy / h) * nh, w: nw, h: nh }, fit);
  }

  private _onWheel(ev: WheelEvent): void {
    const stage = this._stageEl;
    if (!stage) return;
    ev.preventDefault();
    const r = stage.getBoundingClientRect();
    const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
    this._zoomAt(ev.clientX - r.left, ev.clientY - r.top, this._zoom * factor);
    this._saveZoom();
  }

  private _stepZoom(delta: number): void {
    const stage = this._stageEl;
    if (!stage) return;
    this._zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, this._zoom * (delta > 0 ? 1.4 : 1 / 1.4));
    this._saveZoom();
  }

  /** «Вписать всё» (docs/CANVAS.md §8) — the toolbar's middle button and the
   *  old "reset zoom" in one: frame the content at zoom 1, centred. With
   *  `all` it also takes in the far strays the opening view leaves out. */
  private _resetZoom(): void {
    const vb = this._baseVb();
    this._zoom = 1;
    this._view = fitView(vb, this._stageAspect());
    this._saveZoom();
  }

  /** Save the current space zoom to localStorage (view mode only). */
  private _saveZoom(): void {
    // Editor zoom is a working tool, never the viewing intent: while an editor
    // is open the wheel/pinch keep calling _saveZoom, but the per-space VIEW
    // zoom must not learn about it. The exit-editor restore used to re-save the
    // view zoom from a rAF — on a slow tablet the floor-tab click lands BEFORE
    // that rAF (input runs first in the frame), the space guard skipped the
    // fix-up and the editor 500% stayed in _zoomBySpace/LS_ZOOM for the next
    // visit to that floor. Editors do not need zoom persistence at all.
    if (this._mode !== 'view') return;
    this._zoomBySpace = { ...this._zoomBySpace, [this._space]: this._zoom };
    try {
      localStorage.setItem(LS_ZOOM, JSON.stringify(this._zoomBySpace));
    } catch {
      /* ignore */
    }
  }

  /** Restore the saved space zoom and center the plan. */
  private _restoreZoom(): void {
    const z = this._zoomBySpace[this._space] || 1;
    this._zoom = z;
    const stage = this._stageEl;
    if (stage && stage.clientHeight) {
      // HP-1551: the stage is already measured — apply the view NOW, before
      // the next paint. The unconditional rAF here used to let one frame
      // (or a whole server round-trip worth of frames, via the updated()
      // refit running with the stale zoom before this method was called at
      // all) paint at the default fit — the visible "flash" on opening.
      const vb = this._baseVb();
      this._applyView(z, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
      this.requestUpdate();
      return;
    }
    // stage not measurable yet: let updated() fit it with the (already
    // correct) _zoom on the first layout, then center on the plan
    this._view = null;
    requestAnimationFrame(() => {
      if (!this._stageEl) return;
      const vb = this._baseVb();
      this._applyView(z, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
      this.requestUpdate();
    });
  }

  private _stagePointerDown(ev: PointerEvent): void {
    if (this._vacFit) return; // no pan/swipe while fitting the robot map
    if (this._kiosk) {
      this._cyclePausedUntil = Date.now() + 60000;
      if (this._pointers.size === 0) {
        this._swipeStart = { x: ev.clientX, y: ev.clientY, id: ev.pointerId };
        // long-press on EMPTY stage opens the per-screen size popover
        if (!(ev.target as HTMLElement).closest?.('.dev, .roomlabel, .oplock')) {
          clearTimeout(this._kioskHoldTimer);
          this._kioskHoldTimer = window.setTimeout(() => {
            this._kioskDialog = true;
            this._swipeStart = null;
          }, 3000);
        }
      } else {
        this._swipeStart = null; // second finger = pinch, not a swipe
        clearTimeout(this._kioskHoldTimer);
      }
    }
    // do not interfere with icon and label dragging
    if (this._drag) return;
    if (this._markup) {
      // Drawing is CLICK-based, so gestures coexist with it: a finger that
      // MOVES pans, two fingers pinch, and _suppressClick keeps the release
      // from feeding the active tool. The editor used to opt out of gestures
      // entirely, which left a phone with no way to zoom or pan the plan
      // (owner's report). Pointers that begin on interactive children still
      // stay out — labels and handles run their own drags.
      if ((ev.target as HTMLElement).closest?.('.roomlabel, .rlhandle, .rszhandle, .dev, .oplock, .op-hit, button')) return;
    }
    if (this._mode === 'devices' && (ev.target as HTMLElement).closest('.dev')) return;
    if (this._mode === 'decor' && this._decorPointerDown(ev)) return;
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const v = this._viewOr(this._baseVb());
    if (this._pointers.size === 1) {
      this._panStart = { sx: ev.clientX, sy: ev.clientY, vx: v.x, vy: v.y };
      this._panLock = null; // undecided until the finger moves
      this._suppressClick = false;
    } else if (this._pointers.size === 2) {
      // A second pointer turns the gesture into navigation. An unfinished
      // two-click Boundary edit must never survive underneath that pinch.
      this._cancelBoundaryAnchor();
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this._pinchStart = { dist, zoom: this._zoom };
      this._panStart = null;
      this._panLock = null;
    }
  }

  /**
   * Is a horizontal drag reserved for the floor swipe right now? Only on a
   * kiosk screen, only at the zoom `swipeTarget` accepts, and only when there
   * is more than one space to swipe between — everywhere else nothing
   * competes with panning.
   */
  private get _swipeZone(): boolean {
    return this._kiosk && this._zoom <= 1.001 && this._model.length > 1;
  }

  private _stagePointerMove(ev: PointerEvent): void {
    if (this._physicalRotate?.pid === ev.pointerId) {
      this._physicalRotateMove(ev);
      return;
    }
    if (this._physicalDrag?.pid === ev.pointerId) {
      this._physicalMove(ev);
      return;
    }
    if (this._dtDrag?.pid === ev.pointerId) {
      this._dtMove(ev);
      return;
    }
    if (this._bdDrag?.pid === ev.pointerId) {
      this._bdMove(ev);
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      const draft = this._decorDraft;
      let b = this._decorSnap(this._svgPoint(ev), ev.pointerType);
      if (ev.shiftKey && (draft.kind === 'rect' || draft.kind === 'ellipse')) {
        const dx = b[0] - draft.a[0], dy = b[1] - draft.a[1];
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        b = this._snap([
          draft.a[0] + (dx < 0 ? -side : side),
          draft.a[1] + (dy < 0 ? -side : side),
        ]);
      }
      this._decorDraft = { ...draft, b };
      return;
    }
    if (this._decorMove?.pid === ev.pointerId) {
      this._decorMoveUpdate(ev);
      return;
    }
    if (!this._pointers.has(ev.pointerId)) {
      this._markupMove(ev);
      return;
    }
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    // the tool preview (snap dot, measure label) keeps following the finger
    if (this._markup && this._pointers.size === 1) this._markupMove(ev);
    if (this._pinchStart && this._pointers.size >= 2) {
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = dist / (this._pinchStart.dist || 1);
      const r = this._stageEl!.getBoundingClientRect();
      const cx = (pts[0].x + pts[1].x) / 2 - r.left;
      const cy = (pts[0].y + pts[1].y) / 2 - r.top;
      this._zoomAt(cx, cy, this._pinchStart.zoom * scale);
      this._suppressClick = true;
      this._saveZoom();
    } else if (this._panStart) {
      const ddx = ev.clientX - this._panStart.sx;
      const ddy = ev.clientY - this._panStart.sy;
      if (Math.abs(ddx) + Math.abs(ddy) > 4) {
        this._suppressClick = true;
        clearTimeout(this._holdTimer);
      }
      // Which gesture is this? Decided once, on the first movement worth the
      // name, and kept for the rest of the drag so the plan cannot flip-flop
      // under the finger. Panning is NOT gated on the zoom any more (owner,
      // 2026-08-04: «таскать план при любом масштабе»): on an infinite canvas
      // there is no "the content already covers the scene" state that would
      // make a drag meaningless — `_clampView` alone decides how far you may
      // walk, at 400% and at 33% alike.
      if (this._panLock === null && Math.abs(ddx) + Math.abs(ddy) > 8) {
        this._panLock = this._swipeZone && Math.abs(ddx) > Math.abs(ddy) * 1.5 ? 'swipe' : 'pan';
      }
      const stage = this._stageEl;
      if (this._panLock === 'pan' && stage) {
        const vb = this._baseVb();
        const v = this._viewOr(vb);
        const fit = fitView(vb, this._stageAspect());
        this._view = this._clampView(
          {
            x: this._panStart.vx - (ddx / (stage.clientWidth || 1)) * v.w,
            y: this._panStart.vy - (ddy / (stage.clientHeight || 1)) * v.h,
            w: v.w,
            h: v.h,
          },
          fit,
        );
      }
    }
  }

  private _stagePointerUp(ev: PointerEvent): void {
    if (this._kiosk) {
      clearTimeout(this._kioskHoldTimer);
      const ss = this._swipeStart;
      this._swipeStart = null;
      if (ss && ss.id === ev.pointerId) {
        const dx = ev.clientX - ss.x;
        const dy = ev.clientY - ss.y;
        // double tap (no movement) resets the zoom to 1:1
        if (Math.abs(dx) + Math.abs(dy) < 8) {
          const now = Date.now();
          if (now - this._lastTap < 350) this._resetZoom();
          this._lastTap = now;
        }
        // The lock is FINAL (audit DEV-1DA1-02). `_stagePointerMove` decided
        // once, on the first movement worth the name, whether this gesture is
        // a swipe or a pan — and the release may not overturn it. Until this
        // the release asked `swipeTarget()` again from the raw start→end
        // vector, so a CURVED gesture (a small vertical lead-in that locks
        // 'pan', then a long horizontal sweep) dragged the plan under the
        // finger and still landed on another storey when it lifted. A pan is
        // a pan to the end: no floor change, whatever the overall vector
        // happens to look like. A motionless tap never locks anything, so the
        // double-tap zoom reset above is untouched.
        const target = this._panLock === 'pan'
          ? null
          : swipeTarget(dx, dy, this._zoom, this._model.map((m) => m.id), this._space);
        if (target) {
          // the plan follows the finger: swiping left brings the next one in
          // from the right, so the current one leaves to the left
          this._slideTo(target, dx < 0 ? 'left' : 'right');
          this._saveNav();
          this._suppressClick = true;
          setTimeout(() => (this._suppressClick = false), 0);
          this._showKioskDots();
        }
      }
    }
    if (this._physicalDrag?.pid === ev.pointerId) {
      this._physicalUp(ev);
      return;
    }
    if (this._physicalRotate?.pid === ev.pointerId) {
      this._physicalRotateUp(ev);
      return;
    }
    if (this._dtDrag?.pid === ev.pointerId) {
      this._dtUp();
      return;
    }
    if (this._bdDrag?.pid === ev.pointerId) {
      this._bdUp();
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      this._decorCommitDraft();
      return;
    }
    if (this._decorMove?.pid === ev.pointerId) {
      if (this._decorMove.moved) {
        this._recordGeometry(this._t('history.decor_move'), this._decorMove.before);
        this._saveConfig();
      }
      this._decorMove = null;
      return;
    }
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinchStart = null;
    if (this._pointers.size === 0) {
      this._panStart = null;
      this._panLock = null;
      // reset click suppression on the next tick (so that a click right after a pan does not fire)
      setTimeout(() => (this._suppressClick = false), 0);
    }
  }

  private _clickRoom(r: RoomCfg): void {
    if (this._suppressClick || !r.area) return;
    navigate('/config/areas/area/' + r.area);
  }

  private _pointerDown(ev: PointerEvent, d: DevItem): void {
    if (this._mode === 'plan') return; // icons are hidden in plan mode anyway
    if (this._mode === 'view') {
      // view: no drag, no capture — panning may start on an icon; only the
      // long-press timer runs (cancelled by stage movement)
      this._holdFired = false;
      clearTimeout(this._holdTimer);
      this._holdTimer = window.setTimeout(() => {
        this._holdFired = true;
        this._infoCard = d;
      }, 600);
      return;
    }
    // A disabled ghost is a service entry point, not a movable plan object.
    // Leave the click intact so the settings dialog still opens.
    if (d.bindingStatus?.kind === 'ha_disabled') return;
    ev.preventDefault();
    const p = this._pos(d);
    this._drag = { id: d.id, sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y, moved: false };
    capturePointer(ev);
    this._tip = null;
  }

  private _pointerMove(ev: PointerEvent, d: DevItem): void {
    if (!this._drag || this._drag.id !== d.id) return;
    const stage = this.renderRoot.querySelector('.stage') as HTMLElement;
    if (!stage) return;
    const vb = this._baseVb();
    const rect = stage.getBoundingClientRect();
    const v = this._viewOr(vb);
    const dx = ((ev.clientX - this._drag.sx) / rect.width) * v.w;
    const dy = ((ev.clientY - this._drag.sy) / rect.height) * v.h;
    if (Math.abs(ev.clientX - this._drag.sx) + Math.abs(ev.clientY - this._drag.sy) > 3) {
      this._drag.moved = true;
      clearTimeout(this._holdTimer);
    }
    // DEV-B58-01. This used to be clamped into `vb` — the CONTENT FRAME — with
    // a 0.8 % margin, which is exactly the "old canvas border" the owner ran
    // into: a marker could never be dragged past the outline of whatever was
    // already drawn, so a plan could not be extended by moving a device out to
    // where the new room was going to be. The plan has no edges any more
    // (docs/CANVAS.md §9); the only bound is the garbage limit the backend
    // enforces, and it is the SAME ±5000 on both sides of the wire.
    const nx = clampCanvasR(this._drag.ox + dx);
    const ny = clampCanvasR(this._drag.oy + dy);
    this._savePos(d, nx, ny);
  }

  private _pointerUp(_ev: PointerEvent, d: DevItem): void {
    clearTimeout(this._holdTimer);
    if (!this._drag || this._drag.id !== d.id) return;
    const moved = this._drag.moved;
    this._drag = moved ? this._drag : null;
    if (moved) {
      this._selId = d.id;
      window.setTimeout(() => (this._drag = null), 0);
    }
  }

  private _showToast(msg: string): void {
    this._toast = msg;
    clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => {
      this._toast = '';
    }, 3500);
  }

  /**
   * Touch-first surface: no hover tooltips.
   *
   * The media query alone was not enough (field report, 2026-07-27: tooltips
   * still stuck on a OnePlus). Some devices/skins report `hover: hover`, and a
   * stylus or a paired mouse flips it too. So this also latches on the FIRST
   * touch pointer event and never unlatches for that session — a device that
   * has been touched once is a touch device.
   */
  private static _touchSeen = false;
  private static readonly _noHoverMq =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: none)').matches;

  private get _noHover(): boolean {
    return HouseplanCard._noHoverMq || HouseplanCard._touchSeen;
  }

  /** Any touch anywhere marks the session as touch-first and kills open tips. */
  private _notePointer(ev: PointerEvent): void {
    this._boundaryPointerType = ev.pointerType || 'mouse';
    if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
      HouseplanCard._touchSeen = true;
      if (this._tip) this._tip = null;
    }
  }

  private _showTip(ev: MouseEvent, title: string, meta: string, lqi?: number | null, temp?: number | null): void {
    if (this._noHover) return;
    if (this._drag) return;
    this._tip = { x: ev.clientX, y: ev.clientY, title, meta, lqi, temp };
  }

  // ================= ROOM MARKUP EDITOR =================

  private get _gridPitch(): number {
    // NORM_W / GRID_N and nothing else. The infinite canvas did NOT touch this
    // (docs/CANVAS.md §9): the step is the same for every plan, at every zoom,
    // whatever the content frame happens to be — so no existing plan's nodes
    // ever moved out from under it.
    return GRID_PITCH;
  }

  /** cm represented by one grid cell for the current space (default 5). */
  private get _cellCm(): number {
    const v = Number(this._curSpaceCfg?.cell_cm);
    return Number.isFinite(v) && v > 0 ? v : 5;
  }

  /** Human-readable length of a segment (render units) using the HA unit system. */
  private _fmtLen(a: number[], b: number[]): string {
    const cm = segmentCm(a, b, this._gridPitch, this._cellCm);
    return formatLength(cm, this.hass?.config?.unit_system?.length === 'mi');
  }

  private get _curSpaceCfg(): any {
    // HP-1550-01: while a resize drag is live, every render-path reader sees
    // the preview overlay; _writeConfig deliberately reads _serverCfg instead,
    // so a queued write can never pick the preview up.
    const pv = this._rszPreview;
    if (pv && pv.space === this._space) return pv.sp;
    return this._serverCfg?.spaces.find((s: any) => s.id === this._space);
  }

  /** The config AS RENDERED: _serverCfg with the live resize preview substituted in. */
  private get _renderCfg(): ServerConfig | null {
    const pv = this._rszPreview;
    if (!pv || !this._serverCfg) return this._serverCfg;
    return {
      ...this._serverCfg,
      spaces: this._serverCfg.spaces.map((s: any) => (s.id === pv.space ? pv.sp : s)),
    };
  }

  private get _spaceH(): number {
    const sp = this._curSpaceCfg;
    return NORM_W; // square canvas
  }

  /**
   * Walls of the current space in render units — DERIVED from the room outlines.
   * There is no standalone "line" entity: every wall belongs to a closed room, and a
   * wall shared with a neighbour survives deleting either room (the other still yields it).
   */
  private get _segments(): number[][] {
    const sp = this._curSpaceCfg;
    const H = this._spaceH;
    return roomEdges(sp?.rooms || []).map((s) => [s[0] * NORM_W, s[1] * H, s[2] * NORM_W, s[3] * H]);
  }

  private _savedNav(): { space?: string; mode?: 'view' | 'plan' | 'devices' | 'decor' } | null {
    try {
      return JSON.parse(localStorage.getItem(LS_NAV) || 'null');
    } catch {
      return null;
    }
  }

  private _saveNav(): void {
    try {
      localStorage.setItem(LS_NAV, JSON.stringify({ space: this._space, mode: this._mode }));
    } catch {
      /* private mode etc. */
    }
  }

  private _setMode(mode: 'view' | 'plan' | 'devices' | 'decor'): void {
    if (this._kiosk && mode !== 'view') return; // wall devices never edit
    if (this._mode === mode) return;
    this._bootSoftCancel(); // navigation owns its own short, bounded transition
    if ((mode === 'plan' || mode === 'decor') && !this._norm) {
      this._showToast(this._t('toast.markup_needs_server'));
      return;
    }
    const previousMode = this._mode;
    const editorSwap = previousMode !== 'view' && mode !== 'view';
    const editorFromHeight = editorSwap
      ? (this.renderRoot.querySelector('.editorchrome-inner') as HTMLElement | null)
        ?.getBoundingClientRect().height || 0
      : 0;
    if (!editorSwap) this._cancelEditorSwapAnimations();
    // A live decor transform is a transaction. Switching tabs must cancel and
    // restore it, not merely forget its pointer record after the config has
    // already been mutated by move/resize.
    if (this._decorMove || this._dtDrag || this._bdDrag) this._cancelDecorGesture();
    const baseChanges = !this._spaceModel().bg && (mode === 'view') !== (this._mode === 'view');
    if (this._mode === 'view' && mode !== 'view') {
      // remember the view-mode viewport: whatever zooming happens inside the
      // editors is a working tool, not what the user wants to see afterwards
      const v = this._view;
      this._viewModeSnap = {
        space: this._space,
        zoom: this._zoom,
        cx: v ? v.x + v.w / 2 : undefined,
        cy: v ? v.y + v.h / 2 : undefined,
      };
    }
    if (previousMode === 'plan' && this._activeDraftId)
      this._resumeDraftBySpace[this._space] = this._activeDraftId;
    this._mode = mode;
    this._editorChromeMode = mode === 'view' ? previousMode as 'plan' | 'devices' | 'decor' : mode;
    this._startNavMotion(previousMode === 'view' ? 'enter' : mode === 'view' ? 'exit' : 'swap');
    if (editorSwap) this._animateEditorSwap(editorFromHeight);
    if (baseChanges) {
      // refit against the new base: the editors measure from the full square,
      // the view from the content frame — a view clamped to one is nonsense
      // against the other (HP-1490-03)
      this._zoom = 1;
      this._view = null; // updated() refits on the next frame
    }
    if (mode === 'view') {
      const snap = this._viewModeSnap;
      this._viewModeSnap = null;
      // restore the snapshot only for the space it was taken in
      if (snap && snap.space === this._space) {
        this._zoom = snap.zoom;
        this._view = null;
        requestAnimationFrame(() => {
          if (!this._stageEl || this._mode !== 'view' || this._space !== snap.space) return;
          this._applyView(snap.zoom, snap.cx, snap.cy);
          this._saveZoom(); // editor wheel zoom wrote itself to LS_ZOOM — put the view zoom back
          this.requestUpdate();
        });
      } else if (snap) {
        // HP-1543-01: the floor CHANGED inside the editor — the snapshot
        // belongs to the floor the editor was entered from, while _zoom still
        // carries the editor's working zoom for the floor we are exiting on.
        // Dropping the snapshot alone left that editor zoom (say 500%) on
        // screen in view mode. The per-space store was never polluted
        // (_saveZoom is view-only), so the standard centred
        // _restoreZoom() puts back this floor's saved VIEW viewport. Its rAF
        // reads _zoomBySpace, not the snapshot, so the same-tick floor-tab
        // race the view-only guard protects against stays closed.
        this._restoreZoom();
      }
    }
    this._path = [];
    this._cursorPt = null;
    this._openWallAnchor = null;
    this._boundaryRestoreGuard = null;
    this._tool = 'draw';
    this._mergeSel = null;
    this._mergeDialog = null;
    this._splitSel = null;
    this._pendingSplit = null;
    this._selId = null;
    this._physicalSel = null;
    this._physicalDialog = null;
    this._physicalDrag = null;
    this._rszSel = null;
    this._rszDrag = null;
    this._rszLive = null;
    this._rszPreview = null;
    this._tip = null;
    this._hoverRoom = null;
    this._decorDraft = null;
    this._decorSel = null;
    this._decorMove = null;
    this._backdropDialog = null;
    // Every Background session starts predictably on Select. The image has an
    // explicit tool of its own; only that tool may claim its body or frame.
    this._decorTool = 'select';
    this._bdDrag = null;
    this._dtDrag = null;
    this._dtBox = null;
    if (mode === 'plan') {
      this._primeDrawWallField();
      this._resumeLastDraft();
    }
    this._saveNav();
  }

  /** Prime the Draw thickness field to 15 cm once per Plan session. */
  private _primeDrawWallField(): void {
    if (this._drawWallField === null) {
      this._drawWallField = cmToField(DRAW_WALL_DEFAULT_CM, this._imperial);
    }
  }

  private get _drawWallFieldValue(): string {
    if (this._drawWallField === null) {
      return cmToField(DRAW_WALL_DEFAULT_CM, this._imperial);
    }
    return this._drawWallField;
  }

  private get _drawWallCm(): number | null {
    const raw = strictNumber(this._drawWallFieldValue);
    if (raw == null || raw <= 0) return null;
    const cm = this._imperial ? raw * 2.54 : raw;
    const max = this._tool === 'column' ? COLUMN_MAX_CM : 100;
    return cm >= 1 && cm <= max ? cm : null;
  }

  private get _drawWallMaxCm(): number {
    return this._tool === 'column' ? COLUMN_MAX_CM : 100;
  }

  private _showPhysicalRange(max = this._drawWallMaxCm): void {
    this._showToast(this._t('toast.physical_range', {
      max: cmToField(max, this._imperial),
      unit: this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm'),
    }));
  }

  private _draftSegmentCount(sp = this._curSpaceCfg as any): number {
    return (sp?.room_drafts || []).reduce(
      (sum: number, d: any) => sum + (Array.isArray(d.segments) ? d.segments.length : 0), 0,
    );
  }

  private _limitReached(kind: 'draft' | 'partition' | 'column'): boolean {
    const sp = this._curSpaceCfg as any;
    if (!sp) return true;
    const reached = kind === 'draft'
      ? (sp.room_drafts || []).length >= MAX_ROOM_DRAFTS
      : kind === 'partition'
        ? (sp.partitions || []).length >= MAX_PARTITIONS
        : (sp.wall_columns || []).length >= MAX_WALL_COLUMNS;
    if (reached) this._showToast(this._t('toast.physical_limit'));
    return reached;
  }


  private _svgPoint(ev: MouseEvent): number[] {
    const stage = this.renderRoot.querySelector('.stage') as HTMLElement;
    const r = stage.getBoundingClientRect();
    return this._screenToVb(ev.clientX - r.left, ev.clientY - r.top);
  }

  /**
   * THE snap (docs/CANVAS.md §9). Every editor gesture that produces a plan
   * coordinate goes through here, so "strictly on the grid" is one function
   * and not a habit. No modifier bypasses it. The canvas clamp rides along: there are no edges
   * to bump into any more, only the ±5000 the backend refuses to store.
   */
  private _snap(p: number[]): number[] {
    const g = this._gridPitch;
    return [clampCanvasR(snapToGrid(p[0], g)), clampCanvasR(snapToGrid(p[1], g))];
  }

  /** Grid snap for the free end of the wall currently being drawn. */
  private _snapDrawPoint(p: number[], lock45 = false): number[] {
    const anchor = this._path[this._path.length - 1];
    const candidate = lock45 && anchor
      ? snapSegment45(anchor, p, this._gridPitch, SANE_LIMIT)
      : p;
    return this._snap(candidate);
  }

  private _samePt(a: number[], b: number[]): boolean {
    return samePoint(a, b);
  }

  /**
   * Room-boundary walls are derived from rooms, so the legacy per-space
   * `segments` array is dead weight. Independent walls live in the typed
   * `partitions` collection and must never be confused with that legacy field.
   */
  private _dropLegacySegments(): void {
    // «Ripple only» was removed from the UI: keep old configs readable, then
    // materialise the recognisable icon+activity presentation on any write.
    for (const marker of this._serverCfg?.markers || []) {
      if (marker.display === 'ripple') marker.display = 'icon_ripple';
    }
    for (const sp of this._serverCfg?.spaces || []) {
      delete (sp as any).segments;
      const physicalIds = new Set<string>();
      const validId = (id: any): id is string => typeof id === 'string'
        && id.length >= 1 && id.length <= 64 && !physicalIds.has(id);
      const keepId = (id: string): boolean => { physicalIds.add(id); return true; };
      const point = (p: any): p is number[] => Array.isArray(p) && p.length === 2
        && p.every((v: any) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= CANVAS_LIMIT);
      if (Array.isArray((sp as any).partitions)) {
        (sp as any).partitions = (sp as any).partitions.filter((p: any) =>
          p && validId(p.id) && point(p.a) && point(p.b)
          && Math.hypot(p.a[0] - p.b[0], p.a[1] - p.b[1]) > 1e-9
          && keepId(p.id))
          .map((p: any) => ({ ...p, cm: Math.max(1, Math.min(100, Number(p.cm) || 15)) }));
        if (!(sp as any).partitions.length) delete (sp as any).partitions;
      }
      if (Array.isArray((sp as any).wall_columns)) {
        (sp as any).wall_columns = (sp as any).wall_columns.filter((c: any) =>
          c && validId(c.id) && point(c.center) && keepId(c.id))
          .map((c: any) => ({
            id: c.id, shape: c.shape === 'circle' ? 'circle' : 'square',
            center: [Number(c.center[0]), Number(c.center[1])],
            cm: clampColumnCm(Number(c.cm) || 15),
            ...(c.shape === 'circle' ? {} : { angle: canonicalColumnAngle(c.angle) }),
          }));
        if (!(sp as any).wall_columns.length) delete (sp as any).wall_columns;
      }
      if (Array.isArray((sp as any).room_drafts)) {
        (sp as any).room_drafts = (sp as any).room_drafts.filter((d: any) =>
          d && validId(d.id) && Array.isArray(d.points)
          && d.points.length >= 2 && d.points.every(point) && keepId(d.id))
          .map((d: any) => {
            const points: number[][] = [[Number(d.points[0][0]), Number(d.points[0][1])]];
            const segments: Array<{ cm: number }> = [];
            for (let i = 1; i < d.points.length; i++) {
              const next = [Number(d.points[i][0]), Number(d.points[i][1])];
              if (this._samePt(points[points.length - 1], next)) continue;
              points.push(next);
              segments.push({
                cm: Math.max(1, Math.min(100, Number(d.segments?.[i - 1]?.cm) || 15)),
              });
            }
            return { id: d.id, points, segments };
          })
          .filter((d: any) => d.points.length >= 2);
        if (!(sp as any).room_drafts.length) delete (sp as any).room_drafts;
      }
      if (Array.isArray(sp.walls)) {
        const cuts = sanitizeOpenSpans((sp as any).open_spans)
          .map((e) => [e.a[0], e.a[1], e.b[0], e.b[1]]);
        sp.walls = degradeWalls(sp.walls, sp.rooms || [], GRID_STEP_N, 1, cuts);
        if (!sp.walls.length) delete sp.walls;
      }
    }
  }

  /**
   * Config writes are serialized (HP-1454-03).
   *
   * The debounce only spaced out the *starts*. If a write took longer than
   * 500 ms — a busy instance, a slow link — the next edit went out with the
   * same `expected_rev`, the server accepted the first and rejected the second
   * as a conflict, and the conflict handler reloaded the server copy over the
   * local one. The user's second edit was gone, with a toast that blamed
   * another window when there was none.
   *
   * One chain, one write in flight. A write always reads `_serverCfg` at the
   * moment it runs, so edits made while another write was out are carried by
   * the next one, with the revision that write returned.
   */
  private _writesPending = 0;
  private _writeChain: Promise<void> = Promise.resolve();

  /** A config write is in flight — the card must not adopt a server revision. */
  private get _cfgWriting(): boolean {
    return this._writesPending > 0;
  }

  private _writeConfig(): Promise<void> {
    this._writesPending++;
    this._writeChain = this._writeChain
      .catch(() => undefined) // a failed write must not poison the queue
      .then(async () => {
        if (!this._serverCfg) return;
        this._dropLegacySegments();
        const r = await this.hass.callWS({
          type: 'houseplan/config/set', config: this._serverCfg, expected_rev: this._cfgRev,
        });
        this._cfgRev = r?.rev ?? this._cfgRev + 1;
      });
    const mine = this._writeChain.finally(() => { this._writesPending--; });
    // keep the chain itself unadorned so the next link waits for the write only
    return mine;
  }

  /**
   * Every mutation path ends here, so this is the one place that can invalidate
   * the geometry caches synchronously. The WRITE stays debounced; the epoch bump
   * must not be (audit L1: a bump inside the debounce arrives 500 ms after the
   * render that needed it, and the plan renders stale geometry).
   */
  private _saveConfig(): void {
    this._cfgEpoch++;
    this._saveConfigDebounced();
  }

  /** Deep, immutable geometry state from the real config (never Resize preview). */
  private _geometrySnapshot(spaceId = this._space): SpaceGeometryState | null {
    const sp = this._serverCfg?.spaces.find((s: any) => s.id === spaceId);
    if (!sp) return null;
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const plan_transform: SpaceGeometryState['plan_transform'] = {};
    for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const) {
      if (sp[key] !== undefined) plan_transform[key] = sp[key];
    }
    return {
      spaceId,
      rooms: copy(sp.rooms || []),
      ...(Array.isArray(sp.openings) ? { openings: copy(sp.openings) } : {}),
      ...(Array.isArray(sp.walls) ? { walls: copy(sp.walls) } : {}),
      ...(Array.isArray((sp as any).open_spans)
        ? { open_spans: copy((sp as any).open_spans) }
        : {}),
      ...(Array.isArray((sp as any).room_drafts)
        ? { room_drafts: copy((sp as any).room_drafts) }
        : {}),
      ...(Array.isArray((sp as any).partitions)
        ? { partitions: copy((sp as any).partitions) }
        : {}),
      ...(Array.isArray((sp as any).wall_columns)
        ? { wall_columns: copy((sp as any).wall_columns) }
        : {}),
      ...(Array.isArray(sp.decor) ? { decor: copy(sp.decor) } : {}),
      plan_transform,
    };
  }

  /** Finish one geometry transaction and invalidate the redo branch. */
  private _recordGeometry(name: string, before: SpaceGeometryState | null): void {
    if (!before) return;
    const after = this._geometrySnapshot(before.spaceId);
    if (!after || JSON.stringify(before) === JSON.stringify(after)) return;
    this._geometryHistory.push({ name, before, after });
    this.requestUpdate();
  }

  /** Drop every transient gesture before replacing committed geometry. */
  private _clearGeometryGesture(): void {
    this._path = [];
    this._cursorPt = null;
    this._mergeSel = null;
    this._mergeDialog = null;
    this._splitSel = null;
    this._pendingSplit = null;
    this._openWallAnchor = null;
    this._boundaryRestoreGuard = null;
    this._wallDialog = null;
    this._physicalDialog = null;
    this._physicalSel = null;
    this._physicalDrag = null;
    this._physicalRotate = null;
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._openingDialog = null;
    this._rszSel = null;
    this._rszDrag = null;
    this._rszPreview = null;
    this._rszLive = null;
    this._decorDraft = null;
    this._decorMove = null;
    this._dtDrag = null;
    this._bdDrag = null;
  }

  /** Cancel only the uncommitted first click of the Boundary tool. */
  private _cancelBoundaryAnchor(): boolean {
    if (this._tool !== 'boundary' || !this._openWallAnchor) return false;
    this._openWallAnchor = null;
    this._boundaryRestoreGuard = null;
    this._cursorPt = null;
    this.requestUpdate();
    return true;
  }

  /** Browser/OS cancellation is an aborted transaction, never a commit. */
  private _stagePointerCancel(ev: PointerEvent): void {
    clearTimeout(this._kioskHoldTimer);
    if (this._swipeStart?.id === ev.pointerId) this._swipeStart = null;
    if (this._physicalDrag?.pid === ev.pointerId || this._physicalRotate?.pid === ev.pointerId) {
      this._cancelPhysicalGesture();
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      this._decorDraft = null;
      this.requestUpdate();
      return;
    }
    if (this._decorMove?.pid === ev.pointerId || this._dtDrag?.pid === ev.pointerId
        || this._bdDrag?.pid === ev.pointerId) {
      this._cancelDecorGesture();
      return;
    }
    this._cancelBoundaryAnchor();
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinchStart = null;
    if (this._pointers.size === 0) {
      this._panStart = null;
      this._panLock = null;
    }
  }

  private _applyGeometryState(state: SpaceGeometryState): boolean {
    const sp = this._serverCfg?.spaces.find((s: any) => s.id === state.spaceId);
    if (!sp) return false;
    const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    sp.rooms = copy(state.rooms);
    if (state.openings !== undefined) sp.openings = copy(state.openings);
    else delete sp.openings;
    if (state.walls !== undefined) sp.walls = copy(state.walls);
    else delete sp.walls;
    if (state.open_spans !== undefined) (sp as any).open_spans = copy(state.open_spans);
    else delete (sp as any).open_spans;
    if (state.room_drafts !== undefined) (sp as any).room_drafts = copy(state.room_drafts);
    else delete (sp as any).room_drafts;
    if (state.partitions !== undefined) (sp as any).partitions = copy(state.partitions);
    else delete (sp as any).partitions;
    if (state.wall_columns !== undefined) (sp as any).wall_columns = copy(state.wall_columns);
    else delete (sp as any).wall_columns;
    if (state.decor !== undefined) sp.decor = copy(state.decor);
    else delete sp.decor;
    for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const)
      delete sp[key];
    Object.assign(sp, copy(state.plan_transform || {}));
    this._clearGeometryGesture();
    if (this._space !== state.spaceId) {
      this._space = state.spaceId;
      this._saveNav();
      this._restoreZoom();
    }
    this._modelCache = null;
    this._frame = null;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._saveConfig();
    this.requestUpdate();
    return true;
  }

  private _undoGeometry = (): void => {
    if (this._cancelBoundaryAnchor()) return;
    if (this._physicalDrag || this._physicalRotate) {
      this._cancelPhysicalGesture();
      return;
    }
    if (this._decorDraft) { this._decorDraft = null; this.requestUpdate(); return; }
    if (this._decorMove || this._dtDrag || this._bdDrag) {
      this._cancelDecorGesture();
      return;
    }
    if (this._rszDrag) { this._rszCancelDrag(); return; }
    const command = this._geometryHistory.undo();
    if (!command) return;
    if (!this._applyGeometryState(command.before)) {
      this._geometryHistory.clear();
      return;
    }
    this._showToast(this._t('history.undone', { name: command.name }));
  };

  private _redoGeometry = (): void => {
    // Redo and Undo share the same transaction boundary. The first invocation
    // cancels an in-progress transform; only the next one navigates history.
    if (this._cancelBoundaryAnchor()) return;
    if (this._physicalDrag || this._physicalRotate) {
      this._cancelPhysicalGesture();
      return;
    }
    if (this._decorDraft) { this._decorDraft = null; this.requestUpdate(); return; }
    if (this._decorMove || this._dtDrag || this._bdDrag) {
      this._cancelDecorGesture();
      return;
    }
    if (this._rszDrag) { this._rszCancelDrag(); return; }
    const command = this._geometryHistory.redo();
    if (!command) return;
    if (!this._applyGeometryState(command.after)) {
      this._geometryHistory.clear();
      return;
    }
    this._showToast(this._t('history.redone', { name: command.name }));
  };

  private _saveConfigDebounced = debounce(() => {
    if (!this._serverCfg) return;
    this._writeConfig().catch((e: any) => {
      if (e?.code === 'conflict') {
        // a real one now: another window wrote between our read and our write
        this._showToast(this._t('toast.conflict'));
        this._cancelPath();
        this._reloadConfigOnly(true);
      } else {
        this._showToast(this._t('toast.cfg_save_failed', { err: this._errText(e) }));
      }
    });
  }, 500);

  /**
   * The room that strictly contains p. Being ON a wall does not count: neighbouring
   * rooms share walls, so new vertices legitimately land on existing outlines.
   */
  private _roomAt(p: number[]): RoomCfg | undefined {
    return this._spaceModel().rooms.find((r) => {
      const poly = roomPoly(r);
      return !!poly && pointStrictlyInside(p, poly);
    });
  }

  /** The first existing room the outline would overlap (rooms must not overlap). */
  private _overlapRoom(verts: number[][]): RoomCfg | undefined {
    return this._spaceModel().rooms.find((r) => {
      const poly = roomPoly(r);
      return !!poly && roomsOverlap(verts, poly);
    });
  }

  private _pointInRoom(p: number[], r: RoomCfg): boolean {
    if (r.poly) return pointInPolygon(p, r.poly);
    return (
      r.x != null && p[0] >= r.x! && p[0] <= r.x! + r.w! && p[1] >= r.y! && p[1] <= r.y! + r.h!
    );
  }

  /** A room ring may meet only at the endpoints of neighbouring edges. */
  private _contourSelfIntersects(poly: number[][]): boolean {
    if (!polyIsSimple(poly)) return true; // transverse crossings
    const n = poly.length;
    const eps = 0.001;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        // Neighbours deliberately share one endpoint, including first ↔ last.
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        const c = poly[j], d = poly[(j + 1) % n];
        const cd = [c[0], c[1], d[0], d[1]];
        const ab = [a[0], a[1], b[0], b[1]];
        // This also catches a closing edge passing through an older vertex and
        // collinear overlap, which a proper-crossing test intentionally omits.
        if (distToSegment(a, cd) <= eps || distToSegment(b, cd) <= eps ||
            distToSegment(c, ab) <= eps || distToSegment(d, ab) <= eps) return true;
      }
    }
    return false;
  }

  /** Validate and close the draft without using the closing click as a vertex. */
  private _closeRoomContour(showMinimumError = false): void {
    // Three placed vertices mean two existing edges; the closing edge becomes
    // the third one. Anything shorter cannot enclose a room.
    if (this._path.length < 3) {
      if (showMinimumError) this._showToast(this._t('toast.contour_min_edges'));
      return;
    }
    const closingCm = this._drawWallCm;
    if (closingCm == null) { this._showPhysicalRange(100); return; }
    if (this._contourSelfIntersects(this._path) || polygonArea(this._path) <= 1e-6) {
      this._showToast(this._t('toast.contour_cannot_close'));
      return; // keep the draft editable
    }
    // A contour can enclose an existing room without any vertex inside it.
    const clash = this._overlapRoom(this._path);
    if (clash) {
      this._showToast(this._t('toast.room_overlap', { name: clash.name || '' }));
      return;
    }
    this._path = [...this._path, [...this._path[0]]];
    this._closingWallCm = closingCm;
    this._cursorPt = null;
    this._nameSel = '';
    this._areaSel = '';
    this._resetRoomDialogFields();
    this._roomDialog = true;
  }

  private _markupClick(ev: MouseEvent): void {
    if (this._vacFit) return; // the fit overlay owns all pointer input
    if (!this._markup) return;
    // a pan or pinch just happened — the synthesized click is not a draw
    if (this._suppressClick) return;
    // Room cards swallow markup clicks: dragging, resizing or just clicking a
    // card must not feed the active tool (draw point, delete room, merge/split
    // pick, opening placement). The drag itself already stops pointer events,
    // but the synthesized `click` afterwards still bubbles to the stage.
    if (this._drag || this._rlResize) return;
    const path = (ev.composedPath?.() || []) as any[];
    if (path.some((n) => n?.classList?.contains?.('roomlabel') || n?.classList?.contains?.('rlhandle'))) return;
    if (path.some((n) => n?.classList?.contains?.('physical-hit'))) {
      if (this._tool === 'boundary') this._showToast(this._t('toast.boundary_blocked'));
      return;
    }
    const raw = this._svgPoint(ev);
    if (this._tool === 'select') {
      this._physicalSel = null;
      return;
    }
    if (this._tool === 'resize') {
      // a click picks the room for the scale frame; handle drags never get here
      if (this._rszDrag || path.some((n) => n?.classList?.contains?.('rszhandle'))) return;
      const room = [...this._spaceModel().rooms].reverse().find((r) => this._pointInRoom(raw, r));
      this._rszSel = room?.id || null;
      return;
    }
    if (this._tool === 'delroom') {
      this._deleteRoomClick(raw);
      return;
    }
    if (this._tool === 'opening') {
      this._openingClick(raw);
      return;
    }
    if (this._tool === 'merge') {
      this._mergeClick(raw);
      return;
    }
    if (this._tool === 'wallthick') {
      this._wallThickClick(raw);
      return;
    }
    if (this._tool === 'boundary') {
      this._boundaryClick(raw);
      return;
    }
    if (this._tool === 'split') {
      this._splitClick(raw);
      return;
    }
    if (this._tool === 'partition') {
      this._partitionClick(raw, ev.shiftKey);
      return;
    }
    if (this._tool === 'column') {
      this._columnClick(raw);
      return;
    }
    // draw: clicks on grid points build the outline. Nothing is written to the config
    // until the contour closes — an abandoned outline leaves no lines behind.
    const pt = this._snapDrawPoint(raw, ev.shiftKey);
    if (ev.ctrlKey || ev.metaKey) {
      ev.preventDefault();
      this._closeRoomContour(true);
      return;
    }
    const closing = this._path.length >= 3 && this._samePt(pt, this._path[0]);
    // Island rooms (v1.34.0): drawing INSIDE an existing room is legal — the
    // contour may become a nested room (a column, an inner room). Partial
    // overlaps are still rejected, but only at closing time, when the whole
    // outline is known (roomsOverlap treats full nesting as legal).
    if (!this._path.length) {
      // After reload a saved open contour is resumed explicitly by clicking
      // either free end. Mid-segment branching is deliberately unsupported.
      const endHit = this._draftEndAt(pt);
      if (endHit) {
        this._activeDraftId = endHit.draft.id;
        this._resumeDraftBySpace[this._space] = endHit.draft.id;
        this._path = endHit.reverse
          ? [...endHit.draft.points].reverse().map((p) => [...p])
          : endHit.draft.points.map((p) => [...p]);
        this._draftSegmentCms = endHit.reverse
          ? [...endHit.draft.segments].reverse().map((s) => s.cm)
          : endHit.draft.segments.map((s) => s.cm);
        return;
      }
      this._activeDraftId = null;
      this._draftSegmentCms = [];
      this._path = [pt];
      return;
    }
    const last = this._path[this._path.length - 1];
    if (this._samePt(pt, last)) return; // repeated click on the same point
    // A saved outline may be continued into another saved outline, but only
    // endpoint-to-endpoint. The two records become one atomic history step;
    // mid-segment branching remains deliberately unsupported.
    if (closing) {
      this._closeRoomContour();
      return;
    }
    const join = this._draftEndAt(pt, this._activeDraftId || undefined);
    if (join) {
      this._mergeDraftEndpoint(join);
      return;
    }
    if (this._drawWallCm == null) { this._showPhysicalRange(100); return; }
    if (this._path.length >= MAX_DRAFT_POINTS) {
      this._showToast(this._t('toast.physical_limit'));
      return;
    }
    const spCfg = this._curSpaceCfg as any;
    const newDraft = !this._activeDraftId;
    if ((newDraft && (spCfg?.room_drafts || []).length >= MAX_ROOM_DRAFTS)
        || this._draftSegmentCount(spCfg) >= MAX_DRAFT_SEGMENTS) {
      this._showToast(this._t('toast.physical_limit'));
      return;
    }
    this._path = [...this._path, pt];
    this._persistActiveDraftSegment();
  }

  private _draftSegmentCms: number[] = [];
  private _closingWallCm: number | null = null;

  private _draftEndAt(
    pt: number[], excludeId?: string,
  ): { draft: RoomDraftCfg; reverse: boolean } | null {
    const view = this._viewOr(this._baseVb());
    const eps = Math.max(this._gridPitch * 0.15,
      this._stageEl?.clientWidth ? (view.w / this._stageEl.clientWidth) * 12 : 0);
    for (const draft of this._spaceModel().room_drafts || []) {
      if (draft.id === excludeId) continue;
      if (draft.points.length < 2) continue;
      const first = draft.points[0], last = draft.points[draft.points.length - 1];
      if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) <= eps) return { draft, reverse: false };
      if (Math.hypot(pt[0] - first[0], pt[1] - first[1]) <= eps) return { draft, reverse: true };
    }
    return null;
  }

  private _mergeDraftEndpoint(
    hit: { draft: RoomDraftCfg; reverse: boolean },
  ): void {
    const sp = this._curSpaceCfg as any;
    if (!sp || !this._path.length) return;
    const drafts = Array.isArray(sp.room_drafts) ? sp.room_drafts : [];
    const activeRaw = this._activeDraftId
      ? drafts.find((d: any) => d.id === this._activeDraftId) : null;
    const otherRaw = drafts.find((d: any) => d.id === hit.draft.id);
    if (!otherRaw) return;

    // `_draftEndAt.reverse` describes how to resume WITH the clicked end at
    // the tail. A merge needs that end at the head, hence the opposite order.
    const otherPoints = hit.reverse
      ? hit.draft.points.map((p) => [...p])
      : [...hit.draft.points].reverse().map((p) => [...p]);
    const otherSegments = hit.reverse
      ? (otherRaw.segments || []).map((s: any) => ({ ...s }))
      : [...(otherRaw.segments || [])].reverse().map((s: any) => ({ ...s }));
    const last = this._path[this._path.length - 1];
    const touching = this._samePt(last, otherPoints[0]);
    const connectorCm = touching ? null : this._drawWallCm;
    if (!touching && connectorCm == null) { this._showPhysicalRange(100); return; }

    const activeSegments = this._draftSegmentCms.map((cm, i) => ({
      ...(activeRaw?.segments?.[i] || {}), cm,
    }));
    const mergedPoints = [
      ...this._path.map((p) => [...p]),
      ...(touching ? otherPoints.slice(1) : otherPoints),
    ];
    const mergedSegments = [
      ...activeSegments,
      ...(connectorCm == null ? [] : [{ cm: connectorCm }]),
      ...otherSegments,
    ];
    const closed = mergedPoints.length >= 4
      && this._samePt(mergedPoints[0], mergedPoints[mergedPoints.length - 1]);
    const persistedPoints = closed ? mergedPoints.slice(0, -1) : mergedPoints;
    const persistedSegments = closed ? mergedSegments.slice(0, -1) : mergedSegments;
    if (persistedPoints.length > MAX_DRAFT_POINTS) {
      this._showToast(this._t('toast.physical_limit'));
      return;
    }
    const oldSegments = (activeRaw?.segments?.length || 0) + (otherRaw.segments?.length || 0);
    if (this._draftSegmentCount(sp) - oldSegments + persistedSegments.length > MAX_DRAFT_SEGMENTS) {
      this._showToast(this._t('toast.physical_limit'));
      return;
    }
    if (closed) {
      if (this._contourSelfIntersects(persistedPoints) || polygonArea(persistedPoints) <= 1e-6) {
        this._showToast(this._t('toast.contour_cannot_close'));
        return;
      }
      const clash = this._overlapRoom(persistedPoints);
      if (clash) {
        this._showToast(this._t('toast.room_overlap', { name: clash.name || '' }));
        return;
      }
    }

    const before = this._geometrySnapshot();
    const id = this._activeDraftId || hit.draft.id;
    const base = activeRaw || otherRaw;
    const saved = {
      ...base, id,
      points: persistedPoints.map((p) => [p[0] / NORM_W, p[1] / NORM_W]),
      segments: persistedSegments,
    };
    sp.room_drafts = drafts.filter((d: any) => d.id !== hit.draft.id
      && (!this._activeDraftId || d.id !== this._activeDraftId));
    sp.room_drafts.push(saved);
    this._activeDraftId = id;
    this._resumeDraftBySpace[this._space] = id;
    this._draftSegmentCms = persistedSegments.map((s: any) => Number(s.cm));
    this._path = persistedPoints;
    this._physicalSel = null;
    this._recordGeometry(this._t('history.draft_merge'), before);
    this._saveConfig();

    if (closed) {
      this._closingWallCm = Number(mergedSegments[mergedSegments.length - 1]?.cm)
        || DRAW_WALL_DEFAULT_CM;
      this._path = [...persistedPoints, [...persistedPoints[0]]];
      this._cursorPt = null;
      this._nameSel = '';
      this._areaSel = '';
      this._resetRoomDialogFields();
      this._roomDialog = true;
    }
  }

  /** Persist every completed draft segment immediately. */
  private _persistActiveDraftSegment(): void {
    if (this._path.length < 2 || !this._curSpaceCfg) return;
    const cm = this._drawWallCm;
    if (cm == null) return;
    this._draftSegmentCms = [...this._draftSegmentCms, cm];
    const before = this._geometrySnapshot();
    const sp = this._curSpaceCfg as any;
    sp.room_drafts ||= [];
    if (!this._activeDraftId) this._activeDraftId = 'draft-' + Date.now().toString(36);
    this._resumeDraftBySpace[this._space] = this._activeDraftId;
    const i = sp.room_drafts.findIndex((d: any) => d.id === this._activeDraftId);
    const saved = {
      ...(i >= 0 ? sp.room_drafts[i] : {}),
      id: this._activeDraftId,
      points: this._path.map((p) => [p[0] / NORM_W, p[1] / NORM_W]),
      segments: this._draftSegmentCms.map((v, j) => ({
        ...(i >= 0 ? sp.room_drafts[i]?.segments?.[j] : {}), cm: v,
      })),
    };
    if (i >= 0) sp.room_drafts[i] = saved;
    else sp.room_drafts.push(saved);
    this._recordGeometry(this._t('history.draft_segment'), before);
    this._saveConfig();
  }

  private _partitionClick(raw: number[], lock45: boolean): void {
    const pt = this._snapDrawPoint(raw, lock45);
    if (!this._path.length) { this._path = [pt]; return; }
    const a = this._path[0];
    if (this._samePt(a, pt)) return;
    const cm = this._drawWallCm;
    if (cm == null) { this._showPhysicalRange(100); return; }
    if (!this._curSpaceCfg || this._limitReached('partition')) return;
    const before = this._geometrySnapshot();
    const sp = this._curSpaceCfg as any;
    sp.partitions ||= [];
    const id = 'partition-' + Date.now().toString(36);
    sp.partitions.push({ id, a: [a[0] / NORM_W, a[1] / NORM_W],
      b: [pt[0] / NORM_W, pt[1] / NORM_W], cm });
    this._path = [];
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._cursorPt = null;
    this._recordGeometry(this._t('history.partition_add'), before);
    this._saveConfig();
  }

  private _columnClick(raw: number[]): void {
    const center = this._snap(raw);
    const cm = this._drawWallCm;
    if (cm == null) { this._showPhysicalRange(COLUMN_MAX_CM); return; }
    if (!this._curSpaceCfg || this._limitReached('column')) return;
    const candidate: WallColumnCfg = {
      id: 'column-' + Date.now().toString(36), shape: 'square', center, cm: clampColumnCm(cm), angle: 0,
    };
    const duplicate = (this._spaceModel().wall_columns || []).find((c) =>
      sameColumnPlacement(c, candidate, this._gridPitch * 0.02));
    if (duplicate) {
      clearTimeout(this._duplicateColumnTimer);
      this._duplicateColumnId = duplicate.id;
      this._duplicateColumnTimer = window.setTimeout(() => {
        this._duplicateColumnId = null;
      }, 900);
      this._showToast(this._t('toast.column_duplicate'));
      return;
    }
    const before = this._geometrySnapshot();
    const sp = this._curSpaceCfg as any;
    sp.wall_columns ||= [];
    sp.wall_columns.push({ ...candidate, center: [center[0] / NORM_W, center[1] / NORM_W] });
    this._recordGeometry(this._t('history.column_add'), before);
    this._saveConfig();
  }

  private _openPhysicalDialog(
    kind: 'partition' | 'column' | 'draft', id: string, segment?: number,
  ): void {
    const model = this._spaceModel();
    if (kind === 'partition') {
      const p = model.partitions.find((x) => x.id === id);
      if (p) this._physicalDialog = {
        kind, id, cm: cmToField(p.cm, this._imperial), length: this._fmtLen(p.a, p.b),
      };
    } else if (kind === 'column') {
      const c = model.wall_columns.find((x) => x.id === id);
      if (c) this._physicalDialog = {
        kind, id, cm: cmToField(c.cm, this._imperial), shape: c.shape,
        angle: this._angleField(c.shape === 'square' ? canonicalColumnAngle(c.angle) : 0),
      };
    } else {
      const d = model.room_drafts.find((x) => x.id === id);
      const i = Math.max(0, Math.min(d?.segments.length ? d.segments.length - 1 : 0, segment || 0));
      if (d?.segments[i]) this._physicalDialog = {
        kind, id, segment: i, cm: cmToField(d.segments[i].cm, this._imperial),
        length: this._fmtLen(d.points[i], d.points[i + 1]),
      };
    }
  }

  private _savePhysicalDialog = (): void => {
    const d = this._physicalDialog;
    const sp = this._curSpaceCfg as any;
    if (!d || !sp) return;
    const raw = strictNumber(d.cm);
    if (raw == null) {
      this._showPhysicalRange(d.kind === 'column' ? COLUMN_MAX_CM : 100);
      return;
    }
    const cmRaw = this._imperial ? raw * 2.54 : raw;
    const max = d.kind === 'column' ? COLUMN_MAX_CM : 100;
    if (!Number.isFinite(cmRaw) || cmRaw < 1 || cmRaw > max) {
      this._showPhysicalRange(max);
      return;
    }
    if (d.kind === 'column') {
      const current = this._spaceModel().wall_columns.find((x) => x.id === d.id);
      if (!current) return;
      const rawAngle = strictNumber(d.angle || '0');
      if (d.shape !== 'circle'
          && (rawAngle == null || rawAngle < 0 || rawAngle >= 90)) {
        this._showToast(this._t('toast.physical_angle'));
        return;
      }
      const candidate: WallColumnCfg = d.shape === 'circle'
        ? { id: d.id, shape: 'circle', center: current.center, cm: cmRaw }
        : { id: d.id, shape: 'square', center: current.center, cm: cmRaw,
            angle: rawAngle! };
      if (this._spaceModel().wall_columns.some((c) => c.id !== d.id
          && sameColumnPlacement(c, candidate, this._gridPitch * 0.02))) {
        this._showToast(this._t('toast.column_duplicate'));
        return;
      }
    }
    const before = this._geometrySnapshot();
    if (d.kind === 'partition') {
      const p = (sp.partitions || []).find((x: any) => x.id === d.id);
      if (p) p.cm = cmRaw;
    } else if (d.kind === 'column') {
      const c = (sp.wall_columns || []).find((x: any) => x.id === d.id);
      if (c) {
        c.cm = clampColumnCm(cmRaw);
        c.shape = d.shape === 'circle' ? 'circle' : 'square';
        if (c.shape === 'square') c.angle = strictNumber(d.angle || '0')!;
        else delete c.angle;
      }
    } else {
      const draft = (sp.room_drafts || []).find((x: any) => x.id === d.id);
      if (draft?.segments?.[d.segment || 0]) draft.segments[d.segment || 0].cm = cmRaw;
    }
    this._recordGeometry(this._t('history.physical_edit'), before);
    this._physicalDialog = null;
    this._saveConfig();
  };

  private _deletePhysicalSelection = (): void => {
    const sel = this._physicalSel;
    const sp = this._curSpaceCfg as any;
    if (!sel || !sp) return;
    if (sel.kind === 'draft') { this._deleteDraftWhole(); return; }
    const before = this._geometrySnapshot();
    const key = sel.kind === 'partition' ? 'partitions'
      : sel.kind === 'column' ? 'wall_columns' : 'room_drafts';
    sp[key] = (sp[key] || []).filter((x: any) => x.id !== sel.id);
    if (!sp[key].length) delete sp[key];
    if (this._activeDraftId === sel.id) this._cancelPath();
    this._physicalSel = null;
    this._physicalDialog = null;
    this._recordGeometry(this._t('history.physical_delete'), before);
    this._saveConfig();
  };

  private _deleteDraftWhole = (): void => {
    const id = this._physicalDialog?.kind === 'draft'
      ? this._physicalDialog.id
      : this._physicalSel?.kind === 'draft' ? this._physicalSel.id : null;
    const sp = this._curSpaceCfg as any;
    if (!id || !sp || !confirm(this._t('confirm.delete_draft'))) return;
    const before = this._geometrySnapshot();
    sp.room_drafts = (sp.room_drafts || []).filter((x: any) => x.id !== id);
    if (!sp.room_drafts.length) delete sp.room_drafts;
    if (this._activeDraftId === id) this._cancelPath();
    this._physicalSel = null;
    this._physicalDialog = null;
    this._recordGeometry(this._t('history.physical_delete'), before);
    this._saveConfig();
  };

  private _deleteDraftSegment = (): void => {
    const dlg = this._physicalDialog;
    const sp = this._curSpaceCfg as any;
    if (!dlg || dlg.kind !== 'draft' || !sp) return;
    if (!confirm(this._t('confirm.delete_draft_segment'))) return;
    const index = (sp.room_drafts || []).findIndex((x: any) => x.id === dlg.id);
    if (index < 0) return;
    const draft = sp.room_drafts[index];
    const cut = Math.max(0, Math.min(draft.segments.length - 1, dlg.segment || 0));
    const pieces: any[] = [];
    const leftPoints = draft.points.slice(0, cut + 1);
    const rightPoints = draft.points.slice(cut + 1);
    if (leftPoints.length >= 2) pieces.push({
      id: draft.id, points: leftPoints, segments: draft.segments.slice(0, cut),
    });
    if (rightPoints.length >= 2) pieces.push({
      id: pieces.length ? `${draft.id}-${Date.now().toString(36)}` : draft.id,
      points: rightPoints, segments: draft.segments.slice(cut + 1),
    });
    if (pieces.length === 2 && sp.room_drafts.length >= MAX_ROOM_DRAFTS) {
      this._showToast(this._t('toast.physical_limit'));
      return;
    }
    const before = this._geometrySnapshot();
    sp.room_drafts.splice(index, 1, ...pieces);
    if (!sp.room_drafts.length) delete sp.room_drafts;
    if (this._activeDraftId === draft.id) this._cancelPath();
    this._physicalDialog = null;
    this._physicalSel = pieces.length ? { kind: 'draft', id: pieces[0].id } : null;
    this._recordGeometry(this._t('history.draft_segment_delete'), before);
    this._saveConfig();
  };

  private _physicalDown(ev: PointerEvent, kind: 'partition' | 'column', id: string): void {
    ev.stopPropagation();
    capturePointer(ev);
    const model = this._spaceModel();
    const point = this._svgPoint(ev);
    const candidates: Array<{ kind: 'partition' | 'column'; id: string }> = [];
    for (const c of [...model.wall_columns].reverse()) {
      if (pointInPhysicalBody(point, columnBody(c, this._cellCm, this._gridPitch)))
        candidates.push({ kind: 'column', id: c.id });
    }
    for (const p of [...model.partitions].reverse()) {
      const body = partitionBody(p.a, p.b, p.cm, this._cellCm, this._gridPitch);
      if (body && pointInPhysicalBody(point, body)) candidates.push({ kind: 'partition', id: p.id });
    }
    if (!candidates.some((x) => x.kind === kind && x.id === id)) candidates.unshift({ kind, id });
    const signature = candidates.map((x) => `${x.kind}:${x.id}`).sort().join('|');
    const now = performance.now();
    const cycle = this._physicalPickCycle;
    const repeat = candidates.length > 1 && cycle?.signature === signature
      && now - cycle.at > 380 && now - cycle.at <= 1200
      && Math.hypot(ev.clientX - cycle.x, ev.clientY - cycle.y) <= 10;
    const index = repeat ? (cycle.index + 1) % candidates.length
      : Math.max(0, candidates.findIndex((x) => x.kind === kind && x.id === id));
    this._physicalPickCycle = { signature, index, x: ev.clientX, y: ev.clientY, at: now };
    kind = candidates[index].kind;
    id = candidates[index].id;
    const base = kind === 'partition'
      ? model.partitions.find((x) => x.id === id)
      : model.wall_columns.find((x) => x.id === id);
    if (!base) return;
    this._physicalSel = { kind, id };
    this._physicalDrag = {
      pid: ev.pointerId, kind, id, start: this._svgPoint(ev),
      startClient: [ev.clientX, ev.clientY],
      before: this._geometrySnapshot(), moved: false,
      base: JSON.parse(JSON.stringify(base)), delta: [0, 0],
    };
  }

  private _clampPhysicalDelta(
    kind: 'partition' | 'column', base: PartitionCfg | WallColumnCfg, delta: number[],
  ): number[] {
    const points = kind === 'partition'
      ? [(base as PartitionCfg).a, (base as PartitionCfg).b]
      : [(base as WallColumnCfg).center];
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    return [
      Math.max(-CANVAS_LIMIT * NORM_W - Math.min(...xs),
        Math.min(CANVAS_LIMIT * NORM_W - Math.max(...xs), delta[0])),
      Math.max(-CANVAS_LIMIT * NORM_W - Math.min(...ys),
        Math.min(CANVAS_LIMIT * NORM_W - Math.max(...ys), delta[1])),
    ];
  }

  private _physicalMove(ev: PointerEvent): void {
    const drag = this._physicalDrag;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.stopPropagation();
    const raw = this._svgPoint(ev);
    const anchor = drag.kind === 'partition'
      ? (drag.base as PartitionCfg).a : (drag.base as WallColumnCfg).center;
    const target = this._snap([
      anchor[0] + raw[0] - drag.start[0], anchor[1] + raw[1] - drag.start[1],
    ]);
    const delta = this._clampPhysicalDelta(
      drag.kind, drag.base, [target[0] - anchor[0], target[1] - anchor[1]],
    );
    this._physicalDrag = {
      ...drag, delta,
      moved: drag.moved || Math.hypot(
        ev.clientX - drag.startClient[0], ev.clientY - drag.startClient[1],
      ) >= 5,
    };
  }

  private _physicalUp(ev: PointerEvent): void {
    const drag = this._physicalDrag;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.stopPropagation();
    this._physicalDrag = null;
    if (!drag.moved) {
      this._registerPhysicalTap(drag.kind, drag.id);
      return;
    }
    if (!this._curSpaceCfg) return;
    const sp = this._curSpaceCfg as any;
    if (drag.kind === 'partition') {
      const p = (sp.partitions || []).find((x: any) => x.id === drag.id);
      const base = drag.base as PartitionCfg;
      if (p) {
        p.a = [(base.a[0] + drag.delta[0]) / NORM_W, (base.a[1] + drag.delta[1]) / NORM_W];
        p.b = [(base.b[0] + drag.delta[0]) / NORM_W, (base.b[1] + drag.delta[1]) / NORM_W];
      }
    } else {
      const c = (sp.wall_columns || []).find((x: any) => x.id === drag.id);
      const base = drag.base as WallColumnCfg;
      const candidate: WallColumnCfg = {
        ...base,
        center: [base.center[0] + drag.delta[0], base.center[1] + drag.delta[1]],
      } as WallColumnCfg;
      if (this._spaceModel().wall_columns.some((x) => x.id !== drag.id
          && sameColumnPlacement(x, candidate, this._gridPitch * 0.02))) {
        this._showToast(this._t('toast.column_duplicate'));
        return;
      }
      if (c) c.center = [
        (base.center[0] + drag.delta[0]) / NORM_W,
        (base.center[1] + drag.delta[1]) / NORM_W,
      ];
    }
    this._recordGeometry(this._t('history.physical_move'), drag.before);
    this._saveConfig();
  }

  private _registerPhysicalTap(
    kind: 'partition' | 'column' | 'draft', id: string, segment?: number,
  ): void {
    const now = performance.now();
    const twice = this._physicalLastTap?.kind === kind
      && this._physicalLastTap.id === id
      && this._physicalLastTap.segment === segment
      && now - this._physicalLastTap.at <= 360;
    this._physicalLastTap = { kind, id, segment, at: now };
    if (twice) {
      this._physicalLastTap = null;
      this._openPhysicalDialog(kind, id, segment);
    }
  }

  private _cancelPhysicalGesture(): void {
    this._physicalDrag = null;
    this._physicalRotate = null;
    this.requestUpdate();
  }

  private _physicalRotateDown(ev: PointerEvent, c: WallColumnCfg): void {
    if (c.shape !== 'square') return;
    ev.preventDefault();
    ev.stopPropagation();
    capturePointer(ev);
    const p = this._svgPoint(ev);
    this._physicalSel = { kind: 'column', id: c.id };
    this._physicalRotate = {
      pid: ev.pointerId, id: c.id, center: [...c.center],
      startAngle: Math.atan2(p[1] - c.center[1], p[0] - c.center[0]) * 180 / Math.PI,
      baseAngle: canonicalColumnAngle(c.angle), angle: canonicalColumnAngle(c.angle),
      before: this._geometrySnapshot(), moved: false,
    };
  }

  private _physicalRotateMove(ev: PointerEvent): void {
    const drag = this._physicalRotate;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.preventDefault();
    ev.stopPropagation();
    const p = this._svgPoint(ev);
    const pointerAngle = Math.atan2(p[1] - drag.center[1], p[0] - drag.center[0]) * 180 / Math.PI;
    const raw = drag.baseAngle + pointerAngle - drag.startAngle;
    const angle = canonicalColumnAngle(ev.shiftKey ? raw : Math.round(raw / 5) * 5);
    this._physicalRotate = { ...drag, angle, moved: drag.moved || Math.abs(raw - drag.baseAngle) >= 0.5 };
  }

  private _physicalRotateUp(ev: PointerEvent): void {
    const drag = this._physicalRotate;
    if (!drag || drag.pid !== ev.pointerId) return;
    ev.preventDefault();
    ev.stopPropagation();
    this._physicalRotate = null;
    if (!drag.moved || !this._curSpaceCfg) return;
    const current = this._spaceModel().wall_columns.find((c) => c.id === drag.id);
    if (!current || current.shape !== 'square') return;
    const candidate: WallColumnCfg = { ...current, angle: drag.angle };
    if (this._spaceModel().wall_columns.some((c) => c.id !== drag.id
        && sameColumnPlacement(c, candidate, this._gridPitch * 0.02))) {
      this._showToast(this._t('toast.column_duplicate'));
      return;
    }
    const stored = (this._curSpaceCfg as any).wall_columns?.find((c: any) => c.id === drag.id);
    if (!stored) return;
    stored.angle = drag.angle;
    this._recordGeometry(this._t('history.physical_edit'), drag.before);
    this._saveConfig();
  }


  // ================= room resize tool (docs/RESIZE.md) =================

  /** Rooms of the current space as render-unit polygons (legacy rects converted). */
  private _rszRooms(): { id: string; poly: number[][] }[] {
    const out: { id: string; poly: number[][] }[] = [];
    for (const r of this._spaceModel().rooms) {
      const poly = r.id ? roomPoly(r) : null;
      if (poly) out.push({ id: r.id!, poly });
    }
    return out;
  }

  private _rszOpenings(): { id: string; x: number; y: number; length: number }[] {
    return this._openingsR.map((o) => ({ id: o.id, x: o.rx, y: o.ry, length: o.rlen }));
  }

  private _rszOpts(): { minDim: number; eps: number } {
    return { minDim: this._cmToUnits(MIN_ROOM_CM), eps: this._gridPitch * 0.05 };
  }

  private _rszSnapshot(): string {
    return JSON.stringify(this._geometrySnapshot() || {
      spaceId: this._space, rooms: [], openings: [], walls: [], open_spans: [],
    });
  }

  /** Live preview of the candidate geometry, based on the immutable pre-drag snapshot —
   *  walls, fills, labels and openings all follow in the same render.
   *
   *  HP-1550-01: the preview must NEVER touch _serverCfg. It used to be written
   *  into the shared mutable space config, and the serialized write chain
   *  (HP-1454-03) reads `_serverCfg` AT THE MOMENT a write runs — so a debounced
   *  write still queued from a previous edit carried the mid-drag preview to the
   *  server before pointerup, and an Esc after that left the abandoned geometry
   *  persisted (reload resurrected it). Flushing the queue before the drag would
   *  not close it: the queued write reads the mutable config later anyway. The
   *  live geometry therefore lives in the `_rszPreview` overlay; _curSpaceCfg /
   *  _renderCfg feed it to every render, and only _rszUp moves it into the real
   *  config — the single point where a resize becomes visible to _writeConfig. */
  private _rszApplyPreview(polys: Record<string, number[][]>, ops: Record<string, [number, number]>): void {
    const g = this._rszDrag;
    const real = this._serverCfg?.spaces.find((s: any) => s.id === this._space);
    if (!g || !real) return;
    const s = JSON.parse(g.snap); // fresh deep copies every move — free to mutate
    const sp = {
      ...real,
      rooms: s.rooms,
      openings: s.openings,
      walls: s.walls,
      open_spans: s.open_spans,
    };
    if (!Array.isArray(s.open_spans) || !s.open_spans.length) delete (sp as any).open_spans;
    const H = this._spaceH;
    for (const [id, poly] of Object.entries(polys)) {
      const r = sp.rooms.find((x: any) => x.id === id);
      if (!r) continue;
      r.poly = poly.map((p) => [p[0] / NORM_W, p[1] / H]);
      delete r.x; delete r.y; delete r.w; delete r.h; // a resized room is saved as a polygon
    }
    for (const [id, c] of Object.entries(ops)) {
      const o = (sp.openings || []).find((x: any) => x.id === id);
      if (!o) continue;
      o.x = c[0] / NORM_W;
      o.y = c[1] / H;
    }
    // Geometry that belongs to a wall must ride in the SAME live overlay as
    // its room polygons. Map from the immutable snapshot on every move (never
    // from the previous preview), so partial virtual stretches and the atomic
    // thickness keys on their solid remainders cannot lag behind or accumulate
    // rounding error during a long drag.
    const oldSpans: [number[], number[]][] = [];
    const newSpans: [number[], number[]][] = [];
    for (const id of g.changed) {
      const oldR = g.rooms.find((r) => r.id === id);
      const nr = sp.rooms.find((x: any) => x.id === id);
      if (!oldR || !nr?.poly) continue;
      const newPoly = nr.poly.map((p: number[]) => [p[0] * NORM_W, p[1] * H] as number[]);
      if (oldR.poly.length !== newPoly.length) continue;
      for (let i = 0; i < oldR.poly.length; i++) {
        oldSpans.push([oldR.poly[i], oldR.poly[(i + 1) % oldR.poly.length]]);
        newSpans.push([newPoly[i], newPoly[(i + 1) % newPoly.length]]);
      }
    }
    if (oldSpans.length) {
      const movedOpen = rekeyOpenSpansAfterMove(
        sanitizeOpenSpans((sp as any).open_spans), oldSpans, newSpans, NORM_W,
      );
      if (movedOpen.length) (sp as any).open_spans = movedOpen;
      else delete (sp as any).open_spans;
      if (Array.isArray(sp.walls) && sp.walls.length) {
        sp.walls = rekeyWallsAfterMove(
          sp.walls, oldSpans, newSpans, this._wallKeyPitch, NORM_W,
        );
      }
    }
    this._rszPreview = { space: this._space, sp };
    this._cfgEpoch++;
  }

  private _rszEdgeDown(ev: PointerEvent, roomId: string, edge: number): void {
    if (this._tool !== 'resize' || this._rszDrag) return;
    ev.stopPropagation();
    ev.preventDefault();
    capturePointer(ev);
    const rooms = this._rszRooms();
    const plan = planEdgeDrag(rooms, roomId, edge);
    if (!plan) return;
    this._rszDrag = {
      kind: 'edge', pid: ev.pointerId, roomId, plan,
      rooms, openings: this._rszOpenings(), snap: this._rszSnapshot(),
      moved: false, d: 0, k: 1, changed: [],
    };
  }

  private _rszCornerDown(ev: PointerEvent, roomId: string, corner: number[], fixed: [number, number]): void {
    if (this._tool !== 'resize' || this._rszDrag) return;
    ev.stopPropagation();
    ev.preventDefault();
    capturePointer(ev);
    this._rszDrag = {
      kind: 'scale', pid: ev.pointerId, roomId, fixed,
      span0: Math.hypot(corner[0] - fixed[0], corner[1] - fixed[1]) || 1,
      rooms: this._rszRooms(), openings: this._rszOpenings(), snap: this._rszSnapshot(),
      moved: false, d: 0, k: 1, changed: [],
    };
  }

  private _rszMove(ev: PointerEvent): void {
    const g = this._rszDrag;
    if (!g || g.pid !== ev.pointerId) return;
    ev.stopPropagation();
    const p = this._svgPoint(ev);
    if (g.kind === 'edge') {
      const plan = g.plan!;
      const dRaw = (p[0] - plan.a[0]) * plan.n[0] + (p[1] - plan.a[1]) * plan.n[1];
      // the moved wall LINE lands on the grid, like every drawn wall
      const sn = this._snap([plan.a[0] + plan.n[0] * dRaw, plan.a[1] + plan.n[1] * dRaw]);
      let d = (sn[0] - plan.a[0]) * plan.n[0] + (sn[1] - plan.a[1]) * plan.n[1];
      d = clampEdgeDrag(g.rooms, g.openings, plan, d, this._gridPitch, this._rszOpts());
      if (d === g.d && g.moved) return;
      g.d = d;
      g.moved = true;
      const res = applyEdgeDrag(g.rooms, g.openings, plan, d, this._rszOpts().eps);
      g.changed = Object.keys(res.polys);
      this._rszApplyPreview(res.polys, res.openings);
      this._rszLive = this._rszEdgeLabels(res, plan);
    } else {
      const fixed = g.fixed!;
      const sn = this._snap(p); // the dragged corner aims at grid nodes
      let k = Math.hypot(sn[0] - fixed[0], sn[1] - fixed[1]) / (g.span0 || 1);
      k = Math.max(0.05, Math.min(20, k));
      k = clampRoomScale(g.rooms, g.openings, g.roomId, fixed, k, this._rszOpts());
      if (k === g.k && g.moved) return;
      g.k = k;
      g.moved = true;
      const room = g.rooms.find((r) => r.id === g.roomId)!;
      const others = g.rooms.filter((r) => r.id !== g.roomId).map((r) => r.poly);
      const res = applyRoomScale(room, g.openings, others, fixed, k, this._rszOpts().eps * 2);
      g.changed = [g.roomId];
      this._rszApplyPreview({ [g.roomId]: res.poly }, res.openings);
      this._rszLive = this._rszScaleLabels(res.poly);
    }
    this.requestUpdate();
  }

  private _rszUp(ev: PointerEvent): void {
    const g = this._rszDrag;
    if (!g || g.pid !== ev.pointerId) return;
    ev.stopPropagation();
    const preview = this._rszPreview;
    this._rszDrag = null;
    this._rszLive = null;
    this._rszPreview = null; // the overlay is gone either way; renders read the real config again
    const changed = g.moved && (g.kind === 'edge' ? Math.abs(g.d) > 1e-9 : Math.abs(g.k - 1) > 1e-9);
    if (!changed || !preview) {
      // HP-1550-01: nothing to restore — the preview never touched the config
      this._cfgEpoch++;
      this.requestUpdate();
      return;
    }
    const before = JSON.parse(g.snap) as SpaceGeometryState;
    // commit: the preview moves into the REAL config in one step (the only point
    // where _writeConfig can see a resize), collinear T-insert leftovers cleaned,
    // then ONE undo step + ONE write
    const sp = this._curSpaceCfg;
    if (sp) {
      sp.rooms = preview.sp.rooms;
      sp.openings = preview.sp.openings;
      if (Array.isArray(preview.sp.walls)) {
        if (preview.sp.walls.length) sp.walls = preview.sp.walls;
        else delete sp.walls;
      }
      if (Array.isArray(preview.sp.open_spans) && preview.sp.open_spans.length) {
        (sp as any).open_spans = preview.sp.open_spans;
      } else {
        delete (sp as any).open_spans;
      }
      for (const id of g.changed) {
        const r = sp.rooms.find((x: any) => x.id === id);
        if (r?.poly) r.poly = simplifyPoly(r.poly, 1e-9);
      }
      // The preview was derived from the immutable snapshot and already moved
      // both explicit spans and every whole/atomic thickness key. Commit only
      // clips that geometry to the simplified final rooms, rebuilds open_to,
      // and drops keys that genuinely no longer name a live interval.
      this._commitOpenSpans();
      if (Array.isArray(sp.walls) && sp.walls.length) {
        sp.walls = degradeWalls(sp.walls, sp.rooms || [], GRID_STEP_N, 1, this._cfgOpenCuts());
        if (!sp.walls.length) delete sp.walls;
      }
    }
    // the click synthesized after the drag must not re-pick the selection
    this._suppressClick = true;
    setTimeout(() => (this._suppressClick = false), 0);
    this._recordGeometry(this._t('history.resize_room'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  private _rszCancelDrag(): void {
    const g = this._rszDrag;
    if (!g) return;
    this._rszDrag = null;
    this._rszLive = null;
    // HP-1550-01/-03: a cancel just drops the overlay — the real config was
    // never touched, so there is nothing to restore, no undo step and no write
    this._rszPreview = null;
    this._cfgEpoch++;
    this.requestUpdate();
  }

  /** HP-1550-03: pointercancel / lostpointercapture is an ABORT, not a release —
   *  the system interrupted the stream (app switch, palm rejection), so the drag
   *  takes the cancel path: snapshot geometry, no undo step, no write. The pid
   *  guard also absorbs the lostpointercapture that follows a normal pointerup
   *  or a pointercancel (the drag is already gone — no double cancel/commit). */
  private _rszPointerCancel(ev: PointerEvent): void {
    const g = this._rszDrag;
    if (!g || g.pid !== ev.pointerId) return;
    ev.stopPropagation();
    this._rszCancelDrag();
  }

  private _rszEdgeLabels(
    res: { polys: Record<string, number[][]> }, plan: EdgeDragPlan,
  ): { x: number; y: number; text: string; area?: boolean }[] {
    const g = this._rszDrag!;
    const labels: { x: number; y: number; text: string; area?: boolean }[] = [];
    const own = res.polys[plan.roomId] || g.rooms.find((r) => r.id === plan.roomId)!.poly;
    const n = own.length;
    const i = plan.edge, j = (i + 1) % n;
    // the dragged wall and its two adjacent walls
    for (const [a, b] of [[own[(i - 1 + n) % n], own[i]], [own[i], own[j]], [own[j], own[(j + 1) % n]]]) {
      labels.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, text: this._fmtLen(a, b) });
    }
    // live areas of EVERY room the drag reshapes (both sides of a shared wall)
    const imperial = this.hass?.config?.unit_system?.length === 'mi';
    const ids = Object.keys(res.polys).length ? Object.keys(res.polys) : [plan.roomId];
    const walls = this._spaceWalls;
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    const physical = this._physicalBodiesR();
    for (const id of ids) {
      const poly = res.polys[id] || g.rooms.find((r) => r.id === id)!.poly;
      const floor = walls.length
        ? (innerContourForRoom(
            Object.entries(res.polys).map(([rid, p]) => ({ id: rid, poly: p })),
            id, walls, openCuts, this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
          ) || poly)
        : poly;
      const c = poleOfInaccessibility(floor);
      const m2 = physical.length
        ? geometryArea(floorMinusBodies(floor, physical))
            * Math.pow(this._cellCm / this._gridPitch, 2) / 1e4
        : areaM2(floor, this._gridPitch, this._cellCm);
      labels.push({ x: c[0], y: c[1], text: formatArea(m2, imperial), area: true });
    }
    return labels;
  }

  private _rszScaleLabels(poly: number[][]): { x: number; y: number; text: string; area?: boolean }[] {
    const imperial = this.hass?.config?.unit_system?.length === 'mi';
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const walls = this._spaceWalls;
    const floor = walls.length && this._rszSel
      ? (innerContourForRoom(
          [{ id: this._rszSel, poly }], this._rszSel, walls, [],
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        ) || poly)
      : poly;
    const c = poleOfInaccessibility(floor);
    const physical = this._physicalBodiesR();
    const area = physical.length
      ? geometryArea(floorMinusBodies(floor, physical))
          * Math.pow(this._cellCm / this._gridPitch, 2) / 1e4
      : areaM2(floor, this._gridPitch, this._cellCm);
    return [
      { x: Math.min(...xs), y: Math.min(...ys), text: `${this._fmtLen([0, 0], [w, 0])} × ${this._fmtLen([0, 0], [h, 0])}` },
      { x: c[0], y: c[1], text: formatArea(area, imperial), area: true },
    ];
  }

  /** Handles of the resize tool: wall midpoints + the scale frame of the selected room. */
  private _renderResizeLayer(view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const hr = Math.max(view.w * 0.013, 5); // finger-sized HIT radius on touch, like .vacfithandle
    // Wall-handle glyph: half the old circle — a wall segment with two arrows
    // pointing perpendicular to it (the directions the wall can be dragged).
    // Drawn in local coords (wall along X), rotated per edge at render time.
    // The invisible circle above keeps the full finger-sized hit area and the
    // HP-1550-04 hit-test priority over openings.
    const s = hr / 2, f = (v: number) => v.toFixed(1);
    const iconD =
      `M ${f(-0.7 * s)} 0 H ${f(0.7 * s)}` +
      ` M 0 ${f(-0.22 * s)} V ${f(-s)} M ${f(-0.32 * s)} ${f(-0.6 * s)} L 0 ${f(-s)} L ${f(0.32 * s)} ${f(-0.6 * s)}` +
      ` M 0 ${f(0.22 * s)} V ${f(s)} M ${f(-0.32 * s)} ${f(0.6 * s)} L 0 ${f(s)} L ${f(0.32 * s)} ${f(0.6 * s)}`;
    const parts: TemplateResult[] = [];
    const rooms = this._rszRooms();
    for (const r of rooms) {
      for (let i = 0; i < r.poly.length; i++) {
        const a = r.poly[i], b = r.poly[(i + 1) % r.poly.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < this._gridPitch) continue;
        const mx = f((a[0] + b[0]) / 2), my = f((a[1] + b[1]) / 2);
        const ang = f(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI);
        parts.push(svg`<circle class="rszhandle" cx="${mx}" cy="${my}" r="${f(hr)}"
          @pointerdown=${(e: PointerEvent) => this._rszEdgeDown(e, r.id, i)}
          @pointermove=${(e: PointerEvent) => this._rszMove(e)}
          @pointerup=${(e: PointerEvent) => this._rszUp(e)}
          @pointercancel=${(e: PointerEvent) => this._rszPointerCancel(e)}
          @lostpointercapture=${(e: PointerEvent) => this._rszPointerCancel(e)}></circle>`);
        parts.push(svg`<g class="rszicon" transform="translate(${mx} ${my}) rotate(${ang})"><path class="rszhalo" d="${iconD}"></path><path class="rszink" d="${iconD}"></path></g>`);
      }
    }
    const sel = this._rszSel ? rooms.find((r) => r.id === this._rszSel) : null;
    if (sel) {
      const xs = sel.poly.map((p) => p[0]), ys = sel.poly.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      parts.push(svg`<rect class="rszframe" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"></rect>`);
      for (const [cx, cy, fx, fy] of [[x0, y0, x1, y1], [x1, y0, x0, y1], [x1, y1, x0, y0], [x0, y1, x1, y0]]) {
        parts.push(svg`<circle class="rszhandle rszcorner" cx="${cx}" cy="${cy}" r="${(hr * 1.15).toFixed(1)}"
          @pointerdown=${(e: PointerEvent) => this._rszCornerDown(e, sel.id, [cx, cy], [fx, fy] as [number, number])}
          @pointermove=${(e: PointerEvent) => this._rszMove(e)}
          @pointerup=${(e: PointerEvent) => this._rszUp(e)}
          @pointercancel=${(e: PointerEvent) => this._rszPointerCancel(e)}
          @lostpointercapture=${(e: PointerEvent) => this._rszPointerCancel(e)}></circle>`);
        // the bead: a quarter of the hit radius, painted, pointer-inert
        parts.push(svg`<circle class="rszknob" cx="${cx}" cy="${cy}" r="${(hr * 1.15 / 4).toFixed(2)}"></circle>`);
      }
    }
    return svg`${parts}`;
  }

  /** Openings of the current space in render units. */
  private get _openingsR(): (OpeningCfg & { rx: number; ry: number; rlen: number })[] {
    const sp = this._curSpaceCfg;
    const H = this._spaceH;
    return (sp?.openings || []).map((o: OpeningCfg) => ({
      ...o, rx: o.x * NORM_W, ry: o.y * H, rlen: o.length * NORM_W,
    }));
  }

  /** cm → render units via the space scale (cm per grid cell). */
  private _cmToUnits(cm: number): number {
    return (cm / this._cellCm) * this._gridPitch;
  }

  // ================= decor (background) layer =================

  private get _decorList(): DecorShape[] {
    const sp = this._curSpaceCfg;
    return (Array.isArray(sp?.decor) ? sp.decor : []) as DecorShape[];
  }

  private get _decorH(): number {
    return NORM_W;
  }

  private _decorResolvedStyle(shape?: DecorShape | null): DecorStyle {
    return decorStyleOf(shape, this._cellCm, this._gridPitch, DEFAULT_DECOR_STYLE);
  }

  private _decorWidthUnits(shape?: DecorShape | null): number {
    return decorStrokeUnits(shape, this._cellCm, this._gridPitch, DEFAULT_DECOR_STYLE.widthCm);
  }

  /** Canonical text size is physical; old size/scale values stay pixel-exact. */
  private _decorTextSizeCm(shape?: DecorShape | null): number {
    if (shape?.kind === 'text') {
      const canonical = Number(shape.size_cm);
      if (Number.isFinite(canonical) && canonical > 0) return canonical;
      return decorUnitsToCm(
        DECOR_TEXT_BASE * decorTextScale(shape), this._cellCm, this._gridPitch,
      );
    }
    return decorUnitsToCm(DECOR_TEXT_BASE, this._cellCm, this._gridPitch);
  }

  private _decorTextUnits(shape: DecorShape): number {
    if (shape.kind !== 'text') return DECOR_TEXT_BASE;
    const canonical = Number(shape.size_cm);
    return Number.isFinite(canonical) && canonical > 0
      ? decorCmToUnits(canonical, this._cellCm, this._gridPitch)
      : DECOR_TEXT_BASE * decorTextScale(shape);
  }

  /** Small physical fields are centimetres in metric plans and inches in imperial plans. */
  private _decorSmallField(cm: number): number {
    return Math.round((this._imperial ? cm / 2.54 : cm) * 100) / 100;
  }

  private _decorSmallCm(value: number): number {
    const cm = this._imperial ? value * 2.54 : value;
    return Number.isFinite(cm) ? Math.max(0.1, Math.min(100, cm)) : 0.1;
  }

  private _decorTextCm(value: number): number {
    const cm = this._imperial ? value * 2.54 : value;
    return Number.isFinite(cm) ? Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, cm)) : 0.1;
  }

  private _decorLargeField(cm: number): number {
    return Math.round((this._imperial ? cm / 30.48 : cm / 100) * 100) / 100;
  }

  private _decorLargeCm(value: number): number {
    const cm = this._imperial ? value * 30.48 : value * 100;
    return Number.isFinite(cm) ? Math.max(0.1, Math.min(CANVAS_LIMIT * this._cellCm, cm)) : 0.1;
  }

  /** Keep full geometry precision while presenting human-sized angle fields. */
  private _angleField(value: unknown): string {
    const angle = Number(value);
    return Number.isFinite(angle) ? String(Number(angle.toFixed(3))) : '0';
  }

  private _decorBoxOf(shape: DecorShape): DecorBox | null {
    if (shape.kind !== 'rect' && shape.kind !== 'ellipse' && shape.kind !== 'furniture') return null;
    return {
      x: shape.x * NORM_W, y: shape.y * this._decorH,
      w: shape.w * NORM_W, h: shape.h * this._decorH,
      angle: normalizeAngle(shape.angle) || undefined,
    };
  }

  /** Magnet candidates are intentionally limited to decor and room contours. */
  private _decorSnapGeometry(excludeId?: string): SnapGeometry {
    const cacheKey = excludeId || '';
    const cached = this._decorSnapCache;
    if (cached && cached.epoch === this._cfgEpoch && cached.space === this._space
        && cached.height === this._decorH && cached.exclude === cacheKey) {
      return cached.geometry;
    }
    const parts: SnapGeometry[] = [];
    for (const shape of this._decorList) {
      if (shape.id === excludeId) continue;
      if (shape.kind === 'line') {
        const a = [shape.x1 * NORM_W, shape.y1 * this._decorH];
        const b = [shape.x2 * NORM_W, shape.y2 * this._decorH];
        parts.push({
          points: [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]],
          segments: [{ a, b }],
        });
      } else if (shape.kind === 'text') {
        parts.push({ points: [[shape.x * NORM_W, shape.y * this._decorH]], segments: [] });
      } else {
        const box = this._decorBoxOf(shape);
        if (box) parts.push(boxAnchors(box));
      }
    }
    for (const room of this._spaceModel().rooms) {
      const poly = roomPoly(room);
      if (!poly?.length) continue;
      parts.push({
        points: poly.flatMap((p, i) => {
          const q = poly[(i + 1) % poly.length];
          return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]];
        }),
        segments: poly.map((p, i) => ({ a: p, b: poly[(i + 1) % poly.length] })),
      });
    }
    const geometry = mergeSnapGeometry(parts);
    this._decorSnapCache = {
      epoch: this._cfgEpoch, space: this._space, height: this._decorH,
      exclude: cacheKey, geometry,
    };
    return geometry;
  }

  private _decorSnap(raw: number[], pointerType = 'mouse', excludeId?: string): number[] {
    const stage = this._stageEl;
    const view = this._viewOr(this._baseVb());
    const px = pointerType === 'touch' || pointerType === 'pen' ? 14 : 8;
    const tolerance = stage ? (view.w / Math.max(1, stage.clientWidth)) * px : this._gridPitch;
    return snapDecorPoint(
      raw, this._decorSnapGeometry(excludeId), tolerance,
      (point) => this._snap(point),
    ).point;
  }

  private _replaceDecor(id: string, patch: Partial<DecorShape>): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    sp.decor = this._decorList.map((shape) => shape.id === id ? { ...shape, ...patch } : shape);
    // The edited shape is excluded from the gesture's magnet candidates, so
    // keep the cached geometry of every *other* object across pointermoves.
    // A different exclude id/cache key rebuilds it when the next gesture starts.
    this.requestUpdate();
  }

  /** Esc/Ctrl+Z during a live gesture restores its transaction start without creating history. */
  private _cancelDecorGesture(): void {
    const before = this._decorMove?.before || this._dtDrag?.before || this._bdDrag?.before;
    const sp = before && this._serverCfg?.spaces.find((space: any) => space.id === before.spaceId);
    if (before && sp) {
      const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
      if (before.decor !== undefined) sp.decor = copy(before.decor);
      else delete sp.decor;
      for (const key of ['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle'] as const)
        delete sp[key];
      Object.assign(sp, copy(before.plan_transform || {}));
      this._cfgEpoch++;
    }
    this._decorMove = null;
    this._dtDrag = null;
    this._bdDrag = null;
    this.requestUpdate();
  }

  /** Begin a decor gesture. Returns true when the event is consumed (no pan). */
  private _decorPointerDown(ev: PointerEvent): boolean {
    const t = this._decorTool;
    // A DRAWING tool owns the whole canvas. Pressing on top of an existing
    // shape must start a NEW figure at that very point — otherwise a line can
    // never begin at the end of another line, because the old line grabs the
    // press first (owner, 2026-08-04). Only select/erase talk to shapes, and
    // only for them does the shape's own handler get to deal with the event.
    const onShape = (t === 'select' || t === 'erase')
      ? ((ev.target as HTMLElement).closest?.('.dshape') as SVGElement | null)
      : null;
    if (onShape) return true; // the shape's own handler deals with it
    if (t === 'line' || t === 'rect' || t === 'ellipse') {
      ev.preventDefault();
      const p = this._decorSnap(this._svgPoint(ev), ev.pointerType);
      this._decorDraft = { kind: t, a: p, b: p, pid: ev.pointerId };
      capturePointer(ev);
      return true;
    }
    if (t === 'text') {
      // …and the press did NOT land on an existing label: those are the one
      // exception to the inertness above (see _decorShapeDown).
      const p = this._decorSnap(this._svgPoint(ev), ev.pointerType);
      this._decorTextDialog = {
        x: clampCanvasN(p[0] / NORM_W), y: clampCanvasN(p[1] / this._decorH),
        text: '', color: this._decorStyle.color, opacity: this._decorStyle.opacity,
        angle: '0', sizeCm: decorUnitsToCm(DECOR_TEXT_BASE, this._cellCm, this._gridPitch),
      };
      this._decorTextSelection = { start: 0, end: 0 };
      return true;
    }
    if (t === 'furniture') {
      // The furniture tool is a STAMP: the palette arms a symbol, the press
      // puts it down at its real size and the editor goes back to `select`
      // with the new piece selected (owner: «сразу выделен»). Without an armed
      // symbol the press does nothing but keep the pan — pressing the canvas
      // must not silently place whatever was chosen last week.
      if (!this._furnPalette) return false;
      ev.preventDefault();
      this._furnPlace(this._svgPoint(ev), ev.shiftKey);
      return true;
    }
    // Empty-space selection belongs only to Select. Erase is an object
    // command: a miss must be a true no-op. With SVG text its painted glyphs
    // do not cover the whole logical label box, so clearing here made a click
    // between letters appear to erase only the selection outline.
    if (t === 'select') this._decorSel = null;
    // …and under its own tool the picture is grabbable by its body
    // (docs/BACKDROP.md §2). Only INSIDE the image rect: press beside the
    // picture and the plane still pans with one finger.
    if (this._bdMovable) {
      const r = this._bdRect!;
      const p = this._svgPoint(ev);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const a = (-normalizeAngle(r.angle) * Math.PI) / 180;
      const dx = p[0] - cx, dy = p[1] - cy;
      const local = [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
      if (local[0] >= r.x && local[0] <= r.x + r.w && local[1] >= r.y && local[1] <= r.y + r.h) {
        ev.preventDefault();
        return this._bdStart(ev);
      }
    }
    return false; // pan is allowed
  }

  /** Commit the dragged shape (ignore degenerate ones) and persist. */
  private _decorCommitDraft(): void {
    const d = this._decorDraft;
    this._decorDraft = null;
    if (!d) return;
    const min = this._gridPitch * 0.5;
    if (!validDecorDraft(d.kind, d.a, d.b, min)) return;
    const W = NORM_W, H = this._decorH;
    const st = this._decorStyle;
    const before = this._geometrySnapshot();
    const id = 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    // creation had no canvas guard at all while the MOVE did — a draft could be
    // born outside the range the mover then refused to leave. One limit, both
    // ends of the gesture (docs/CANVAS.md §9).
    const cn = clampCanvasN;
    let shape: DecorShape;
    if (d.kind === 'line') {
      shape = { id, kind: 'line', x1: cn(d.a[0] / W), y1: cn(d.a[1] / H),
        x2: cn(d.b[0] / W), y2: cn(d.b[1] / H), ...decorStylePatch(st, false) } as DecorShape;
    } else {
      const x = cn(Math.min(d.a[0], d.b[0]) / W), y = cn(Math.min(d.a[1], d.b[1]) / H);
      const w = Math.abs(d.b[0] - d.a[0]) / W, h = Math.abs(d.b[1] - d.a[1]) / H;
      shape = { id, kind: d.kind, x, y, w, h, ...decorStylePatch(st, true) } as DecorShape;
    }
    const sp = this._curSpaceCfg;
    sp.decor = [...this._decorList, shape];
    this._decorSel = id;
    this._recordGeometry(this._t('history.decor_add'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  /** Select tool: pointerdown on a shape starts moving it. */
  private _decorShapeDown(ev: PointerEvent, shape: DecorShape): void {
    if (this._mode !== 'decor') return;
    // Under any other tool the shape is not a target at all: the press has to
    // reach the stage, where the drawing tool starts a new figure (or the
    // backdrop tool grabs the picture). Swallowing it here was the bug — the
    // click on a line end did nothing but keep the old selection alive.
    const t = this._decorTool;
    // ONE exception (owner, 2026-08-04): under the TEXT tool an existing LABEL
    // is a target again, and pressing it opens its editor instead of starting
    // a new label on top of it. Everything else stays inert — a press on a
    // line or a rectangle under the text tool still reaches the stage and
    // creates a new label there (the CSS keeps them pointer-inert, this is
    // the belt to that pair of braces).
    if (t === 'text') {
      if (shape.kind !== 'text') return;
      ev.stopPropagation();
      ev.preventDefault();
      this._decorOpenText(shape);
      return;
    }
    if (t !== 'select' && t !== 'erase') return;
    ev.stopPropagation();
    ev.preventDefault();
    if (t === 'erase') {
      this._decorEraseConfirm = { id: shape.id, kind: shape.kind };
      return;
    }
    this._decorSel = shape.id;
    this._decorMove = {
      id: shape.id, start: this._svgPoint(ev), orig: JSON.parse(JSON.stringify(shape)),
      pid: ev.pointerId, moved: false, before: this._geometrySnapshot(),
    };
    capturePointer(ev);
  }

  private _decorMoveUpdate(ev: PointerEvent): void {
    const m = this._decorMove!;
    // Furniture is dragged by its CENTRE and has a magnet of its own
    // (docs/FURNITURE.md §5) — a different rule, not a different gesture.
    if (m.orig?.kind === 'furniture') { this._furnMoveUpdate(ev); return; }
    const p = this._svgPoint(ev);
    const o0: any = m.orig;
    // The delta used to be what got snapped, which preserves whatever off-grid
    // offset the shape already had: a legacy shape at 0.3013 stayed at 0.3013
    // for ever, one step at a time. Snap the RESULTING ANCHOR instead, so one
    // drag is enough to put any shape on the grid (docs/CANVAS.md §9).
    const ax0 = (o0.kind === 'line' ? o0.x1 : o0.x) * NORM_W;
    const ay0 = (o0.kind === 'line' ? o0.y1 : o0.y) * this._decorH;
    const anchor = this._decorSnap(
      [ax0 + (p[0] - m.start[0]), ay0 + (p[1] - m.start[1])],
      ev.pointerType, m.id,
    );
    let dx = (anchor[0] - ax0) / NORM_W;
    let dy = (anchor[1] - ay0) / this._decorH;
    // audit follow-up L4 gave decor a bounds clamp of -0.25..1.25 — the plan
    // was a sheet with edges then. It is not any more (docs/CANVAS.md): the
    // clamp is now the same garbage limit the backend enforces, so decor can
    // follow a plan that lives at 2.7 and still cannot be flung to 1e100.
    const o: any = m.orig;
    const curX = o.kind === 'line' ? Math.min(o.x1, o.x2) : o.x;
    const curY = o.kind === 'line' ? Math.min(o.y1, o.y2) : o.y;
    const w = o.kind === 'line' ? Math.abs(o.x2 - o.x1) : (o.w || 0);
    const h = o.kind === 'line' ? Math.abs(o.y2 - o.y1) : (o.h || 0);
    const lim = CANVAS_LIMIT;
    dx = Math.max(-lim - curX, Math.min(lim - curX - w, dx));
    dy = Math.max(-lim - curY, Math.min(lim - curY - h, dy));
    if (dx || dy) m.moved = true;
    const sp = this._curSpaceCfg;
    sp.decor = this._decorList.map((x) => {
      if (x.id !== m.id) return x;
      const o: any = m.orig;
      if (x.kind === 'line') return { ...x, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
      return { ...x, x: o.x + dx, y: o.y + dy };
    });
    this.requestUpdate();
  }

  /** Select tool: every decor object has a double-click properties dialog. */
  private _decorShapeDbl(ev: MouseEvent, shape: DecorShape): void {
    if (this._mode !== 'decor' || this._decorTool !== 'select') return;
    ev.preventDefault();
    ev.stopPropagation();
    this._decorMove = null;
    this._decorSel = shape.id;
    if (shape.kind === 'text') {
      this._decorOpenText(shape);
      return;
    }
    if (!['line', 'rect', 'ellipse', 'furniture'].includes(shape.kind)) return;
    const style = this._decorResolvedStyle(shape);
    const line = shape.kind === 'line' ? shape : null;
    const box = this._decorBoxOf(shape);
    this._decorShapeDialog = {
      id: shape.id,
      kind: shape.kind as 'line' | 'rect' | 'ellipse' | 'furniture',
      color: style.color, opacity: style.opacity, widthCm: style.widthCm,
      angle: this._angleField(line
        ? normalizeAngle(segmentAngle(
            [line.x1 * NORM_W, line.y1 * this._decorH],
            [line.x2 * NORM_W, line.y2 * this._decorH],
          ))
        : normalizeAngle((shape as any).angle)),
      ...(line ? {
        lengthCm: decorUnitsToCm(
          Math.hypot((line.x2 - line.x1) * NORM_W, (line.y2 - line.y1) * this._decorH),
          this._cellCm, this._gridPitch,
        ),
        lineStyle: line.line_style === 'dashed' ? 'dashed' : 'solid',
      } : {}),
      ...(box ? {
        sizeWCm: decorUnitsToCm(box.w, this._cellCm, this._gridPitch),
        sizeHCm: decorUnitsToCm(box.h, this._cellCm, this._gridPitch),
      } : {}),
      ...(shape.kind === 'furniture' ? { symbol: shape.symbol } : {}),
      ...(shape.kind === 'rect' || shape.kind === 'ellipse' ? {
        fill: style.fill, fillColor: style.fillColor, fillOpacity: style.fillOpacity,
      } : {}),
    };
  }

  /** Open the editor of an existing label (double click, or the text tool). */
  private _decorOpenText(shape: DecorShape): void {
    if (shape.kind !== 'text') return;
    let text = String(shape.text ?? '');
    const hasInline = [...text.matchAll(/\{([^{}\r\n]+)\}/g)]
      .some((m) => !!liveTextReference(m[1]));
    const explicitUnit = String(shape.unit ?? '').trim();
    // Old dialogs represented the entity state as attr="state"; inline text
    // represents that same value with a bare `{entity}` token.
    const legacyAttr = String(shape.attr ?? '').trim().toLowerCase() === 'state'
      ? null
      : shape.attr;
    const legacyToken = !hasInline && !explicitUnit
      ? liveTextToken(shape.entity, legacyAttr)
      : '';
    const preserveLegacy = !!String(shape.entity ?? '').trim() && !hasInline
      && (!legacyToken || !!explicitUnit);
    if (legacyToken && !preserveLegacy) {
      const slot = text.indexOf('{}');
      text = slot >= 0
        ? text.slice(0, slot) + legacyToken + text.slice(slot + 2)
        : `${text}${text ? ' ' : ''}${legacyToken}`;
    }
    this._decorTextDialog = {
      id: shape.id, x: shape.x, y: shape.y, text, color: shape.color || this._decorStyle.color,
      opacity: clamp01(shape.opacity, this._decorStyle.opacity),
      angle: this._angleField(shape.angle),
      sizeCm: this._decorTextSizeCm(shape),
      pickerEntity: shape.entity || '',
      preserveLegacy: preserveLegacy || undefined,
    };
    this._decorTextSelection = { start: text.length, end: text.length };
  }

  private _decorRememberTextSelection(el: HTMLTextAreaElement): void {
    this._decorTextSelection = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  }

  /** Insert a complete reference without ever truncating it into broken text. */
  private _decorInsertLiveVariable(attr: string | null): void {
    const d = this._decorTextDialog;
    if (!d) return;
    const token = liveTextToken(d.pickerEntity, attr);
    if (!token) return;
    const old = d.text;
    const start = Math.max(0, Math.min(old.length, this._decorTextSelection.start));
    const end = Math.max(start, Math.min(old.length, this._decorTextSelection.end));
    if (old.length - (end - start) + token.length > 200) return;
    const text = old.slice(0, start) + token + old.slice(end);
    const caret = start + token.length;
    this._decorTextSelection = { start: caret, end: caret };
    // Inserting a new inline reference is the explicit replacement of any
    // unrepresentable legacy link; the stale side fields can now be dropped.
    this._decorTextDialog = { ...d, text, preserveLegacy: undefined };
    this.updateComplete.then(() => {
      const el = this.renderRoot.querySelector<HTMLTextAreaElement>('textarea.dtarea');
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  private _decorSaveText(): void {
    const d = this._decorTextDialog;
    // The user's own line breaks are kept; the surrounding whitespace is not.
    const text = String(d?.text ?? '').replace(/\r\n?/g, '\n').trim();
    if (!d || !text) { this._decorTextDialog = null; return; }
    const before = this._geometrySnapshot();
    const sp = this._curSpaceCfg;
    const textStyle = {
      color: d.color, opacity: clamp01(d.opacity),
      size_cm: Number(Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, d.sizeCm)).toFixed(4)),
      ...(normalizeAngle(d.angle) ? { angle: normalizeAngle(d.angle) } : {}),
    };
    if (d.id) {
      sp.decor = this._decorList.map((x) => {
        if (x.id !== d.id) return x;
        if (x.kind !== 'text') return x;
        // A legacy unit or non-canonical attribute cannot be represented by
        // the inline grammar. Keep those fields until the user explicitly
        // replaces the binding; ordinary representable links still migrate.
        if (d.preserveLegacy) {
          const { angle: _angle, size: _size, scale: _scale, ...straight } = x;
          return { ...straight, text, ...textStyle };
        }
        // beta.9 and earlier stored one live link beside the text. Saving in
        // the new editor migrates it to inline tokens and drops the old fields.
        const { entity, attr, unit, ...rest } = x;
        const { angle: _angle, size: _size, scale: _scale, ...straight } = rest;
        return { ...straight, text, ...textStyle };
      });
    } else {
      const id = 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      sp.decor = [...this._decorList, { id, kind: 'text', x: d.x, y: d.y,
        text, ...textStyle }];
      this._decorSel = id;
    }
    this._decorTextDialog = null;
    this._recordGeometry(this._t(d.id ? 'history.decor_edit' : 'history.decor_add'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  private _decorSaveShape(): void {
    const d = this._decorShapeDialog;
    if (!d) return;
    const before = this._geometrySnapshot();
    const style: DecorStyle = {
      color: d.color, opacity: clamp01(d.opacity),
      widthCm: Math.max(0.1, Math.min(100, Number(d.widthCm) || 0.1)),
      fill: !!d.fill, fillColor: d.fillColor || d.color,
      fillOpacity: clamp01(d.fillOpacity, 0.25),
    };
    const sp = this._curSpaceCfg;
    sp.decor = this._decorList.map((shape) => {
      if (shape.id !== d.id) return shape;
      const fillable = d.kind === 'rect' || d.kind === 'ellipse';
      const visual = decorStylePatch(style, fillable);
      if (shape.kind === 'line') {
        const cx = ((shape.x1 + shape.x2) / 2) * NORM_W;
        const cy = ((shape.y1 + shape.y2) / 2) * this._decorH;
        const length = decorCmToUnits(Math.max(0.1, Number(d.lengthCm) || 0.1), this._cellCm, this._gridPitch);
        const rad = (normalizeAngle(d.angle) * Math.PI) / 180;
        const dx = Math.cos(rad) * length / 2, dy = Math.sin(rad) * length / 2;
        const a = this._snap([cx - dx, cy - dy]);
        const b = this._snap([cx + dx, cy + dy]);
        const { width: _legacyWidth, line_style: _oldLineStyle, ...rest } = shape;
        return { ...rest, ...visual,
          x1: clampCanvasN(a[0] / NORM_W), y1: clampCanvasN(a[1] / this._decorH),
          x2: clampCanvasN(b[0] / NORM_W), y2: clampCanvasN(b[1] / this._decorH),
          ...(d.lineStyle === 'dashed' ? { line_style: 'dashed' as const } : {}),
        } as DecorShape;
      }
      if (shape.kind === 'rect' || shape.kind === 'ellipse' || shape.kind === 'furniture') {
        const oldW = shape.w * NORM_W, oldH = shape.h * this._decorH;
        const w = Math.max(this._gridPitch, snapToGrid(
          decorCmToUnits(Number(d.sizeWCm), this._cellCm, this._gridPitch), this._gridPitch,
        ));
        const h = Math.max(this._gridPitch, snapToGrid(
          decorCmToUnits(Number(d.sizeHCm), this._cellCm, this._gridPitch), this._gridPitch,
        ));
        const cx = shape.x * NORM_W + oldW / 2, cy = shape.y * this._decorH + oldH / 2;
        const angle = normalizeAngle(d.angle);
        const topLeft = resizedBoxTopLeft(
          { x: cx - w / 2, y: cy - h / 2 }, angle,
          (point) => this._snap(point),
        );
        const { width: _legacyWidth, angle: _oldAngle, ...rest } = shape;
        return { ...rest, ...visual,
          x: clampCanvasN(topLeft[0] / NORM_W), y: clampCanvasN(topLeft[1] / this._decorH),
          w: w / NORM_W, h: h / this._decorH,
          ...(shape.kind === 'furniture' && d.symbol ? { symbol: d.symbol } : {}),
          ...(angle ? { angle } : {}),
        } as DecorShape;
      }
      return shape;
    });
    this._decorStyle = { ...style,
      fill: d.kind === 'rect' || d.kind === 'ellipse' ? style.fill : this._decorStyle.fill,
      fillColor: d.kind === 'rect' || d.kind === 'ellipse' ? style.fillColor : this._decorStyle.fillColor,
      fillOpacity: d.kind === 'rect' || d.kind === 'ellipse' ? style.fillOpacity : this._decorStyle.fillOpacity,
    };
    this._decorShapeDialog = null;
    this._recordGeometry(this._t('history.decor_edit'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  // ---- common decor transform controller ----
  // The mechanics are the backdrop frame's (docs/BACKDROP.md), reused
  // rather than reinvented: chrome that never takes a pointer, finger-sized
  // handles that always do, the gesture written live into the config and
  // PERSISTED only if something actually moved. What differs is the pivot —
  // a label has an anchor (its x/y), not a box, so both gestures are about
  // that anchor and the text never walks away from the point it was placed at.

  /** The selected shape under Select. Every decor kind uses this controller. */
  private get _dtSel(): DecorShape | null {
    if (this._mode !== 'decor' || this._decorTool !== 'select' || !this._decorSel) return null;
    return this._decorList.find((x) => x.id === this._decorSel) || null;
  }

  /**
   * What the object turns about. A label has an ANCHOR (its x/y is the point it
   * was placed at, and it must never walk away from it); boxes and lines use
   * their geometric centres.
   */
  private _dtPivot(sh: DecorShape): number[] {
    if (sh.kind === 'line') return [
      ((sh.x1 + sh.x2) / 2) * NORM_W,
      ((sh.y1 + sh.y2) / 2) * this._decorH,
    ];
    if (sh.kind === 'furniture' || sh.kind === 'rect' || sh.kind === 'ellipse')
      return [(sh.x + sh.w / 2) * NORM_W, (sh.y + sh.h / 2) * this._decorH];
    return [sh.x * NORM_W, sh.y * this._decorH];
  }

  /** Write physical text size/angle into the shape — live, without saving. */
  private _dtApply(id: string, patch: { textSizeCm?: number; angle?: number }): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    sp.decor = this._decorList.map((x) => {
      if (x.id !== id) return x;
      const rest: any = { ...x };
      if (x.kind === 'text' && patch.textSizeCm !== undefined) {
        delete rest.size;
        delete rest.scale;
      }
      const out: any = { ...rest };
      if (patch.textSizeCm !== undefined)
        out.size_cm = Number(Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, patch.textSizeCm)).toFixed(4));
      if (patch.angle !== undefined) {
        if (patch.angle) out.angle = Number(patch.angle.toFixed(2));
        else delete out.angle; // straight again = the field goes away
      }
      return out;
    });
    this._cfgEpoch++;
    this.requestUpdate();
  }

  private _dtStart(
    ev: PointerEvent, kind: 'scale' | 'rotate', corner?: number[], lineEnd?: 0 | 1,
  ): void {
    const sh = this._dtSel;
    if (!sh) return;
    ev.stopPropagation();
    ev.preventDefault();
    const [ax, ay] = this._dtPivot(sh);
    const p = this._svgPoint(ev);
    const box = this._decorBoxOf(sh);
    this._dtDrag = {
      id: sh.id, kind, pid: ev.pointerId, ax, ay,
      r0: Math.hypot(p[0] - ax, p[1] - ay),
      a0: (Math.atan2(p[1] - ay, p[0] - ax) * 180) / Math.PI,
      textSizeCm0: sh.kind === 'text' ? this._decorTextSizeCm(sh) : 1,
      angle0: sh.kind === 'line' ? 0 : Number(sh.angle) || 0,
      // which corner is being pulled, and the box it started from: a piece of
      // furniture is resized about the OPPOSITE corner, so both have to be
      // remembered — a label, scaled about its anchor, needs neither
      sgx: corner?.[0], sgy: corner?.[1],
      orig: box || undefined,
      origShape: JSON.parse(JSON.stringify(sh)),
      before: this._geometrySnapshot(),
      lineEnd,
      moved: false,
    };
    capturePointer(ev);
  }

  private _dtMove(ev: PointerEvent): void {
    const d = this._dtDrag;
    if (!d) return;
    const p = this._svgPoint(ev);
    if (d.lineEnd !== undefined && d.origShape.kind === 'line') {
      const at = this._decorSnap(p, ev.pointerType, d.id);
      const nx = clampCanvasN(at[0] / NORM_W), ny = clampCanvasN(at[1] / this._decorH);
      const old = d.origShape;
      const ox = d.lineEnd === 0 ? old.x1 : old.x2;
      const oy = d.lineEnd === 0 ? old.y1 : old.y2;
      if (Math.abs(nx - ox) > 1e-9 || Math.abs(ny - oy) > 1e-9) d.moved = true;
      this._replaceDecor(d.id, d.lineEnd === 0 ? { x1: nx, y1: ny } : { x2: nx, y2: ny });
      return;
    }
    if (d.kind === 'scale' && d.orig) {
      // Box geometry preserves ratio by default and separates axes with Shift.
      // Each dimension lands on a whole cell.
      const box = resizeDecorBox(
        d.orig, d.sgx ?? 1, d.sgy ?? 1, p[0], p[1],
        !ev.shiftKey, this._gridPitch, this._gridPitch,
      );
      const changed = Math.abs(box.x - d.orig.x) > 1e-6 || Math.abs(box.y - d.orig.y) > 1e-6
        || Math.abs(box.w - d.orig.w) > 1e-6 || Math.abs(box.h - d.orig.h) > 1e-6;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._decorApplyBox(d.id, box);
      return;
    }
    if (d.kind === 'scale') {
      // uniform, about the anchor: the distance from the anchor is invariant
      // under the block's own rotation, so a rotated block scales the same way
      const r = Math.hypot(p[0] - d.ax, p[1] - d.ay);
      if (d.r0 < 1e-6) return;
      const sizeCm = Math.max(0.1, Math.min(DECOR_TEXT_CM_MAX, d.textSizeCm0 * (r / d.r0)));
      const changed = Math.abs(sizeCm - d.textSizeCm0) > 1e-6;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._dtApply(d.id, { textSizeCm: sizeCm });
      return;
    }
    const a = (Math.atan2(p[1] - d.ay, p[0] - d.ax) * 180) / Math.PI;
    let ang = d.angle0 + (a - d.a0);
    // 5° rotation steps; Shift remains an angle-only precision modifier.
    if (!ev.shiftKey) ang = Math.round(ang / DT_ANGLE_STEP) * DT_ANGLE_STEP;
    ang = ((ang % 360) + 360) % 360;
    if (ang > 180) ang -= 360;
    const changed = Math.abs(ang - d.angle0) > 1e-6;
    if (!changed && !d.moved) return;
    d.moved ||= changed;
    this._dtApply(d.id, { angle: ang });
  }

  private _dtUp(): void {
    const d = this._dtDrag;
    this._dtDrag = null;
    if (d?.moved) {
      this._recordGeometry(this._t('history.decor_transform'), d.before);
      this._saveConfig();
    }
    this.requestUpdate();
  }

  /**
   * Measure the selected label's own box. SVG can only tell us how big a text
   * actually came out once it is in the DOM, so the frame is one render
   * behind — and it is re-measured whenever the text, its scale or the
   * selection changes. Guarded against the render→measure→render loop by
   * comparing the numbers before asking for another update.
   */
  private _dtMeasure(): void {
    const sh = this._dtSel;
    if (!sh) {
      if (this._dtBox) { this._dtBox = null; this.requestUpdate(); }
      return;
    }
    let box: { id: string; x: number; y: number; w: number; h: number };
    if (sh.kind === 'line') {
      const x1 = sh.x1 * NORM_W, y1 = sh.y1 * this._decorH;
      const x2 = sh.x2 * NORM_W, y2 = sh.y2 * this._decorH;
      box = { id: sh.id, x: Math.min(x1, x2), y: Math.min(y1, y2),
        w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
    } else if (sh.kind === 'furniture' || sh.kind === 'rect' || sh.kind === 'ellipse') {
      // …and furniture needs no measuring at all: its box IS the config. The
      // frame therefore appears in the SAME frame as the selection, not one
      // after it, and a resize can never be a render behind the shape.
      box = { id: sh.id, x: sh.x * NORM_W, y: sh.y * this._decorH,
        w: sh.w * NORM_W, h: sh.h * this._decorH };
    } else {
      const el = this.renderRoot.querySelector(`text.dtext[data-id="${sh.id}"]`) as SVGGraphicsElement | null;
      if (!el || typeof (el as any).getBBox !== 'function') return;
      let b: DOMRect;
      try { b = el.getBBox(); } catch { return; } // not rendered yet (hidden card)
      if (!b || (!b.width && !b.height)) return;
      box = { id: sh.id, x: b.x, y: b.y, w: b.width, h: b.height };
    }
    const cur = this._dtBox;
    const same = cur && cur.id === box.id && Math.abs(cur.x - box.x) < 0.01
      && Math.abs(cur.y - box.y) < 0.01 && Math.abs(cur.w - box.w) < 0.01
      && Math.abs(cur.h - box.h) < 0.01;
    if (same) return;
    this._dtBox = box;
    this.requestUpdate();
  }

  private _deleteDecor(id: string): void {
    if (!this._decorList.some((shape) => shape.id === id)) return;
    const before = this._geometrySnapshot();
    const sp = this._curSpaceCfg;
    sp.decor = this._decorList.filter((shape) => shape.id !== id);
    if (this._decorSel === id) this._decorSel = null;
    this._recordGeometry(this._t('history.decor_delete'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  private _decorDeleteSel(): void {
    if (this._decorSel) this._deleteDecor(this._decorSel);
  }

  private _confirmDecorErase(): void {
    const pending = this._decorEraseConfirm;
    this._decorEraseConfirm = null;
    if (pending) this._deleteDecor(pending.id);
  }

  // ================= the furniture library (docs/FURNITURE.md) =================

  /** Furniture sees room centrelines plus the physical faces of independent
   * partitions/drafts/columns. Openings intentionally still use room walls
   * only; furniture is allowed to lean against every real obstacle. */
  private get _furnWalls(): number[][] {
    const faces = this._physicalBodiesR().flatMap((body) =>
      body.map((a, i) => {
        const b = body[(i + 1) % body.length];
        return [a[0], a[1], b[0], b[1]];
      }));
    return [...this._segments, ...faces];
  }

  /** How far the wall magnet reaches, render units. */
  private get _furnWallReach(): number {
    return this._gridPitch * FURN_WALL_CELLS;
  }

  /** cm → the number the size fields SHOW (metres, or decimal feet). The
   *  `_imperial` it asks is the card's one answer to "feet or metres?", the
   *  same the glow radius reads. */
  private _furnFieldValue(cm: number): number {
    return Math.round((this._imperial ? cm / 30.48 : cm / 100) * 100) / 100;
  }

  /** …and back. The config never stores feet: a unit system is how a user
   *  reads a plan, not what the plan is (docs/STYLING-HOOKS.md §6). */
  private _furnFieldToCm(v: number): number {
    return clampFurnCm(this._imperial ? v * 30.48 : v * 100);
  }

  /** Arm a symbol: the palette remembers it with ITS default real size, which
   *  the two fields then let the user overrule before the click. */
  private _furnPick(symbol: string): void {
    const d = furnitureDefaultCm(symbol);
    this._furnPalette = { symbol, w: d.w, h: d.h };
  }

  /**
   * Put the armed symbol down.
   *
   * The press is the CENTRE of the piece, not its corner: a user points at the
   * place the sofa goes. The size comes from the palette in CENTIMETRES and is
   * turned into the canvas's normalised units through the space's `cell_cm` —
   * the one scale this card has — so a 2.2 m sofa is 2.2 m of THIS plan, and a
   * plan drawn at 10 cm per cell gets a sofa half the cells of one drawn at 5.
   *
   * A wall within reach claims it immediately, with its angle, so the common
   * case (put the bed against that wall) is one click and no dragging.
   */
  private _furnPlace(raw: number[], free = false): void {
    const pal = this._furnPalette;
    const sp = this._curSpaceCfg;
    if (!pal || !sp) return;
    const W = NORM_W, H = this._decorH;
    const wN = clampFurnSize(cmToNorm(pal.w, this._cellCm, this._gridPitch, W));
    const hN = clampFurnSize(cmToNorm(pal.h, this._cellCm, this._gridPitch, W));
    const before = this._geometrySnapshot();
    const c = this._decorSnap(raw);
    let cx = c[0], cy = c[1];
    let angle = 0;
    const snap = free ? null : snapFurnitureToWall(cx, cy, hN * H, this._furnWalls,
      this._furnWallReach, this._gridPitch);
    if (snap) { cx = snap.cx; cy = snap.cy; angle = snap.angle; }
    const id = 'df' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const shape: any = {
      id, kind: 'furniture', symbol: pal.symbol,
      x: clampCanvasN(cx / W - wN / 2), y: clampCanvasN(cy / H - hN / 2),
      w: wN, h: hN,
      ...decorStylePatch(this._decorStyle, false),
    };
    // a straight piece stores no angle at all, exactly as a straight label
    // stores none (docs/LIVE-TEXT.md §3)
    if (angle) shape.angle = Number(angle.toFixed(2));
    sp.decor = [...this._decorList, shape];
    this._decorSel = id;
    // …and the editor goes back to the tool that can move what was just placed
    this._decorTool = 'select';
    this._furnPalette = null;
    this._recordGeometry(this._t('history.decor_add'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  /**
   * Drag a placed piece. The magnet wins over the grid while a wall is within
   * reach — it decides the position AND the rotation, which is the whole point
   * of it: a sofa pushed at a wall is parallel to that wall or it is wrong.
   * Out of reach it is the ordinary grid snap on the piece's own anchor, and
   * the angle it already had is kept.
   */
  private _furnMoveUpdate(ev: PointerEvent): void {
    const m = this._decorMove!;
    if (m.orig.kind !== 'furniture') return;
    const o: any = m.orig;
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const W = NORM_W, H = this._decorH;
    const p = this._svgPoint(ev);
    const rawCx = (o.x + o.w / 2) * W + (p[0] - m.start[0]);
    const rawCy = (o.y + o.h / 2) * H + (p[1] - m.start[1]);
    let x: number, y: number;
    let angle = Number(o.angle) || 0;
    const snap = ev.shiftKey ? null : snapFurnitureToWall(
      rawCx, rawCy, o.h * H, this._furnWalls, this._furnWallReach, this._gridPitch);
    if (snap) {
      x = snap.cx / W - o.w / 2;
      y = snap.cy / H - o.h / 2;
      angle = snap.angle;
    } else {
      const a = this._decorSnap(
        [rawCx - (o.w / 2) * W, rawCy - (o.h / 2) * H], ev.pointerType, m.id,
      );
      x = a[0] / W;
      y = a[1] / H;
    }
    x = clampCanvasN(x); y = clampCanvasN(y);
    if (Math.abs(x - o.x) > 1e-9 || Math.abs(y - o.y) > 1e-9
        || Math.abs(angle - (Number(o.angle) || 0)) > 1e-9) m.moved = true;
    sp.decor = this._decorList.map((s) => {
      if (s.id !== m.id) return s;
      const out: any = { ...s, x, y };
      if (angle) out.angle = Number(angle.toFixed(2));
      else delete out.angle;
      return out;
    });
    this.requestUpdate();
  }

  /** Write a resized box into the shape — live, without saving. */
  private _decorApplyBox(id: string, box: { x: number; y: number; w: number; h: number }): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const W = NORM_W, H = this._decorH;
    sp.decor = this._decorList.map((s) => {
      if (s.id !== id) return s;
      const topLeft = resizedBoxTopLeft(
        box, (s as any).angle, (point) => this._snap(point),
      );
      return {
        ...s,
        x: clampCanvasN(topLeft[0] / W), y: clampCanvasN(topLeft[1] / H),
        w: Math.max(this._gridPitch / W, Math.min(CANVAS_LIMIT * 2, box.w / W)),
        h: Math.max(this._gridPitch / H, Math.min(CANVAS_LIMIT * 2, box.h / H)),
      } as DecorShape;
    });
    this._cfgEpoch++;
    this.requestUpdate();
  }

  /**
   * The two live badges of a corner drag: the piece's real WIDTH along its own
   * top edge and its real DEPTH along its left one — in the HA unit system,
   * through the same `_fmtLen` (`segmentCm` over `cell_cm`) and the same
   * `.measurelabel` the wall ruler, the room resize and the backdrop use.
   * There is one way this card ever states a length.
   */
  private get _furnLive(): { x: number; y: number; text: string }[] | null {
    const d = this._dtDrag;
    if (!d || d.kind !== 'scale' || !d.orig) return null;
    const sh = this._decorList.find((s) => s.id === d.id);
    if (!sh || sh.kind !== 'furniture') return null;
    const W = NORM_W, H = this._decorH;
    const w = sh.w * W, h = sh.h * H;
    const c = furnitureCorners(sh.x * W, sh.y * H, w, h, Number(sh.angle) || 0);
    const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const top = mid(c[0], c[1]);
    const left = mid(c[0], c[3]);
    return [
      { x: top[0], y: top[1], text: this._fmtLen([0, 0], [w, 0]) },
      { x: left[0], y: left[1], text: this._fmtLen([0, 0], [0, h]) },
    ];
  }

  /**
   * The palette: every symbol of the library, grouped, each drawn with the
   * very same `furniturePathD` the plan uses — so what the user picks is what
   * the user gets, at any size, and there is no second set of preview assets
   * to keep in step. Under it the two size fields, prefilled with the chosen
   * symbol's real size and shown in metres or feet by the HA unit system.
   */
  private _renderFurnPalette(): TemplateResult {
    const pal = this._furnPalette;
    // the unit the fields are read in — the same two words the glow radius
    // already uses, because a plan has one unit system, not one per control
    const unit = this._t(this._imperial ? 'gs.unit_ft' : 'gs.unit_m');
    const preview = (id: string): TemplateResult => {
      const s = furnitureSymbol(id)!;
      // fit the symbol into a 40×40 box keeping its real proportions, so a
      // sofa reads as a sofa and a toilet does not become a square
      const k = 36 / Math.max(s.w, s.h);
      const w = s.w * k, h = s.h * k;
      return svg`<svg class="furnprev" viewBox="0 0 40 40" aria-hidden="true"><g
        transform="translate(${(40 - w) / 2} ${(40 - h) / 2})"><path
        d=${furniturePathD(id, w, h)} fill="none" stroke="currentColor"
        stroke-width="1.2" stroke-linejoin="round"></path></g></svg>` as unknown as TemplateResult;
    };
    return html`<div class="furnpalette" @pointerdown=${(e: Event) => e.stopPropagation()}>
      <div class="furnhd">
        <ha-icon icon="mdi:sofa-outline"></ha-icon>${this._t('furn.title')}
        <span class="spacer"></span>
        <button class="btn furnclose" title=${this._t('btn.close')}
          @click=${() => { this._furnPalette = null; this._decorTool = 'select'; }}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <div class="furnbody">
        ${FURNITURE_GROUPS.map((g) => html`
          <div class="furngroup" data-group=${g}>${this._t(`furn.group_${g}` as any)}</div>
          <div class="furnrow">
            ${furnitureOfGroup(g as FurnitureGroup).map((s) => html`<button
              class="furnitem ${pal?.symbol === s.id ? 'on' : ''}" data-symbol=${s.id}
              title=${this._t(`furn.sym_${s.id}` as any)}
              @click=${() => this._furnPick(s.id)}>
              ${preview(s.id)}<span>${this._t(`furn.sym_${s.id}` as any)}</span>
            </button>`)}
          </div>`)}
      </div>
      ${pal ? html`<div class="furnsize">
        <label>${this._t('furn.width')}<span class="furnunit">${unit}</span></label>
        <input class="namein furnw" type="number" min="0.01" step="0.05"
          .value=${String(this._furnFieldValue(pal.w))}
          @input=${(e: Event) => (this._furnPalette = {
            ...pal, w: this._furnFieldToCm(Number((e.target as HTMLInputElement).value)) })} />
        <label>${this._t('furn.depth')}<span class="furnunit">${unit}</span></label>
        <input class="namein furnh" type="number" min="0.01" step="0.05"
          .value=${String(this._furnFieldValue(pal.h))}
          @input=${(e: Event) => (this._furnPalette = {
            ...pal, h: this._furnFieldToCm(Number((e.target as HTMLInputElement).value)) })} />
        <span class="furnhint">${this._t('furn.place_hint')}</span>
      </div>` : html`<div class="furnsize"><span class="furnhint">${this._t('furn.pick_hint')}</span></div>`}
    </div>`;
  }

  // ============ backdrop transform frame (docs/BACKDROP.md) ============

  /** The centred, UNTRANSFORMED rectangle of the current backdrop image. */
  private get _bdBase(): Rect | null {
    const sp = this._curSpaceCfg;
    return sp?.plan_url ? { ...fitInSquare(sp.plan_aspect, NORM_W) } : null;
  }

  /** Where the backdrop image sits right now, render units (null: no image). */
  private get _bdRect(): (Rect & { angle?: number }) | null {
    const sp = this._curSpaceCfg;
    return sp?.plan_url ? planRect(sp, NORM_W) : null;
  }

  /** The stored transform of the current space (defaults = the old behaviour). */
  private get _bdParams(): { dx: number; dy: number; sx: number; sy: number; angle: number } {
    const sp = this._curSpaceCfg;
    const dx = Number(sp?.plan_x), dy = Number(sp?.plan_y);
    const legacy = Number(sp?.plan_scale);
    const sxRaw = Number(sp?.plan_scale_x), syRaw = Number(sp?.plan_scale_y);
    const baseScale = Number.isFinite(legacy) && legacy > 0 ? legacy : 1;
    return {
      dx: Number.isFinite(dx) ? dx : 0,
      dy: Number.isFinite(dy) ? dy : 0,
      sx: Number.isFinite(sxRaw) && sxRaw > 0 ? sxRaw : baseScale,
      sy: Number.isFinite(syRaw) && syRaw > 0 ? syRaw : baseScale,
      angle: normalizeAngle(sp?.plan_angle),
    };
  }

  private _openBackdropDialog(ev?: Event): void {
    if (!this._bdMovable || !this._bdRect) return;
    ev?.preventDefault();
    ev?.stopPropagation();
    this._bdDrag = null;
    const r = this._bdRect;
    this._backdropDialog = {
      widthCm: decorUnitsToCm(r.w, this._cellCm, this._gridPitch),
      heightCm: decorUnitsToCm(r.h, this._cellCm, this._gridPitch),
      angle: this._angleField(r.angle),
    };
  }

  private _saveBackdropDialog(): void {
    const d = this._backdropDialog;
    const base = this._bdBase, current = this._bdRect;
    if (!d || !base || !current) return;
    const angle = normalizeAngle(d.angle);
    const before = this._geometrySnapshot();
    const w = Math.min(base.w * PLAN_SCALE_MAX, Math.max(
      base.w * PLAN_SCALE_MIN, snapToGrid(
        decorCmToUnits(d.widthCm, this._cellCm, this._gridPitch), this._gridPitch,
      ),
    ));
    const h = Math.min(base.h * PLAN_SCALE_MAX, Math.max(
      base.h * PLAN_SCALE_MIN, snapToGrid(
        decorCmToUnits(d.heightCm, this._cellCm, this._gridPitch), this._gridPitch,
      ),
    ));
    const cx = current.x + current.w / 2, cy = current.y + current.h / 2;
    const topLeft = resizedBoxTopLeft(
      { x: cx - w / 2, y: cy - h / 2 }, angle,
      (point) => this._snap(point),
    );
    this._bdApply((topLeft[0] - base.x) / NORM_W, (topLeft[1] - base.y) / NORM_W,
      w / base.w, h / base.h, angle);
    this._backdropDialog = null;
    this._recordGeometry(this._t('history.backdrop_transform'), before);
    this._saveConfig();
  }

  /**
   * The transform frame belongs exclusively to the backdrop tool. It is never
   * active in Select and can never swallow a decor gesture.
   */
  private get _bdActive(): boolean {
    return this._mode === 'decor' && !!this._bdRect && this._decorTool === 'backdrop';
  }

  /**
   * …and may the picture be dragged by its BODY? Only under its own tool.
   *
   * The corner handles are precise targets and are live as soon as the frame
   * is, but the body is the whole picture, i.e. most of the screen — claiming
   * it under the select tool would take away the one-finger pan the owner
   * asked for on 2026-08-04 («таскать план при любом масштабе»), which
   * smoke_pan_any_zoom guards. So moving the picture is a tool, exactly like
   * drawing a line is.
   */
  private get _bdMovable(): boolean {
    return this._mode === 'decor' && this._decorTool === 'backdrop' && !!this._bdRect;
  }

  /** Write a transform into the space config — live, without saving. */
  private _bdApply(dx: number, dy: number, sx: number, sy: number, angle: number): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    // 6 decimals: the same precision the rest of the normalised config keeps,
    // and enough for a 1000-unit canvas to be exact to a thousandth of a pixel
    sp.plan_x = Number(clampCanvasN(dx).toFixed(6));
    sp.plan_y = Number(clampCanvasN(dy).toFixed(6));
    delete sp.plan_scale;
    sp.plan_scale_x = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, sx)).toFixed(6));
    sp.plan_scale_y = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, sy)).toFixed(6));
    const a = normalizeAngle(angle);
    if (a) sp.plan_angle = Number(a.toFixed(2));
    else delete sp.plan_angle;
    this._cfgEpoch++;
    this.requestUpdate();
  }

  /**
   * Begin a backdrop gesture. `corner` is the DRAGGED corner as a pair of
   * signs (-1 = the low side of the axis, +1 = the high one); absent = the
   * body, i.e. a move. Returns false when there is nothing to grab.
   */
  private _bdStart(ev: PointerEvent, corner?: number[], rotate = false): boolean {
    const base = this._bdBase, r = this._bdRect;
    if (!base || !r) return false;
    const p = this._svgPoint(ev);
    const sgx = corner ? corner[0] : 0;
    const sgy = corner ? corner[1] : 0;
    // the corner that stays put is the OPPOSITE one
    const fx = sgx > 0 ? r.x : r.x + r.w;
    const fy = sgy > 0 ? r.y : r.y + r.h;
    this._bdDrag = {
      kind: rotate ? 'rotate' : corner ? 'scale' : 'move',
      pid: ev.pointerId,
      sx: p[0], sy: p[1],
      base, p0: this._bdParams,
      fx, fy, sgx, sgy,
      rect0: { x: r.x, y: r.y, w: r.w, h: r.h, angle: r.angle },
      before: this._geometrySnapshot(),
      moved: false,
    };
    capturePointer(ev);
    return true;
  }

  /**
   * One step of the gesture.
   *
   * MOVE — the resulting TOP-LEFT CORNER is snapped, not the delta, so one
   * drag is enough to put a legacy off-grid picture on the lattice
   * (docs/CANVAS.md §9.3, the same rule decor already follows).
   *
   * SCALE — proportional about the fixed corner by default; Shift allows the
   * two axes to diverge. ROTATE — 5° by default, free with Shift.
   *
   * Positional snapping is mandatory (UX-05).
   */
  private _bdMove(ev: PointerEvent): void {
    const d = this._bdDrag;
    if (!d) return;
    const p = this._svgPoint(ev);
    const b = d.base;
    if (d.kind === 'move') {
      const x0 = d.rect0.x, y0 = d.rect0.y;
      const at = this._snap([x0 + (p[0] - d.sx), y0 + (p[1] - d.sy)]);
      const changed = Math.abs(at[0] - x0) > 1e-9 || Math.abs(at[1] - y0) > 1e-9;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._bdApply((at[0] - b.x) / NORM_W, (at[1] - b.y) / NORM_W,
        d.p0.sx, d.p0.sy, d.p0.angle);
      return;
    }
    if (d.kind === 'rotate') {
      const cx = d.rect0.x + d.rect0.w / 2, cy = d.rect0.y + d.rect0.h / 2;
      const a0 = Math.atan2(d.sy - cy, d.sx - cx) * 180 / Math.PI;
      let angle = d.p0.angle + (Math.atan2(p[1] - cy, p[0] - cx) * 180 / Math.PI - a0);
      if (!ev.shiftKey) angle = Math.round(angle / DT_ANGLE_STEP) * DT_ANGLE_STEP;
      angle = normalizeAngle(angle);
      const changed = Math.abs(angle - d.p0.angle) > 1e-9;
      if (!changed && !d.moved) return;
      d.moved ||= changed;
      this._bdApply(d.p0.dx, d.p0.dy, d.p0.sx, d.p0.sy, angle);
      return;
    }
    const box = resizeDecorBox(
      d.rect0, d.sgx, d.sgy, p[0], p[1], !ev.shiftKey,
      this._gridPitch, Math.min(b.w, b.h) * PLAN_SCALE_MIN,
    );
    const sx = box.w / Math.max(1e-9, b.w), sy = box.h / Math.max(1e-9, b.h);
    const changed = Math.abs(sx - d.p0.sx) > 1e-9 || Math.abs(sy - d.p0.sy) > 1e-9
      || Math.abs(box.x - d.rect0.x) > 1e-9 || Math.abs(box.y - d.rect0.y) > 1e-9;
    if (!changed && !d.moved) return;
    d.moved ||= changed;
    const topLeft = resizedBoxTopLeft(
      box, d.p0.angle, (point) => this._snap(point),
    );
    this._bdApply((topLeft[0] - b.x) / NORM_W, (topLeft[1] - b.y) / NORM_W,
      sx, sy, d.p0.angle);
  }

  /** Has this space's picture been moved or scaled at all? */
  private get _bdMoved(): boolean {
    if (this._mode !== 'decor' || !this._bdRect) return false;
    const p = this._bdParams;
    return p.dx !== 0 || p.dy !== 0 || p.sx !== 1 || p.sy !== 1 || p.angle !== 0;
  }

  /** Put the picture back where an untouched plan has it: centred, own size. */
  private _bdReset(): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const before = this._geometrySnapshot();
    delete sp.plan_x; delete sp.plan_y; delete sp.plan_scale;
    delete sp.plan_scale_x; delete sp.plan_scale_y; delete sp.plan_angle;
    this._bdDrag = null;
    this._recordGeometry(this._t('history.backdrop_transform'), before);
    this._saveConfig();
    this._showToast(this._t('decor.backdrop_reset_done'));
    this.requestUpdate();
  }

  /** Release: persist only when something actually moved. */
  private _bdUp(): void {
    const d = this._bdDrag;
    this._bdDrag = null;
    if (d?.moved) {
      this._recordGeometry(this._t('history.backdrop_transform'), d.before);
      this._saveConfig();
    }
    this.requestUpdate();
  }

  /**
   * Live size badge while the picture is dragged or scaled (owner 2026-08-04):
   * its REAL width × height through `cell_cm`, in the HA unit system — the
   * same `_fmtLen` (`segmentCm`/`formatLength`) and the same `.measurelabel`
   * the wall ruler and the room resize use, so there is one way the card ever
   * states a length.
   */
  private get _bdLive(): { x: number; y: number; text: string } | null {
    if (!this._bdDrag) return null;
    const r = this._bdRect;
    if (!r) return null;
    return {
      x: r.x + r.w / 2,
      y: r.y + r.h / 2,
      text: `${this._fmtLen([0, 0], [r.w, 0])} × ${this._fmtLen([0, 0], [0, r.h])}`,
    };
  }

  /** The transform frame itself: a dashed outline and four corner handles. */
  private _renderBackdropFrame(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const r = this._bdRect;
    if (!this._bdActive || !r) return nothing;
    // Two radii, one gesture — the split the text frame uses (docs/LIVE-TEXT.md
    // §3) and, since 2026-08-05, every corner handle in the card. `hr` is the
    // HIT radius: a fraction of the visible view, so the target stays
    // finger-sized at any zoom. `kr` is what you SEE — a quarter of it, because
    // a blob the size of a room is not a handle, it is an occlusion (owner:
    // «уменьшить в 4 раза… они постоянно гигантские»). The clickable area is
    // unchanged; only the ink shrank.
    const hr = Math.max(view.w, view.h) * 0.02;
    const kr = hr / 4;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const angle = normalizeAngle(r.angle);
    const arm = hr * 2.2;
    const corners: [number, number, string][] = [
      [-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw'],
    ];
    return svg`<g class="bdframe" transform=${angle ? `rotate(${angle} ${cx} ${cy})` : nothing}>
      <rect class="bdbox" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"></rect>
      <line class="dtstem" x1="${cx}" y1="${r.y}" x2="${cx}" y2="${r.y - arm}"></line>
      <circle class="bdhandle dtrot" cx="${cx}" cy="${r.y - arm}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => {
          e.stopPropagation(); e.preventDefault(); this._bdStart(e, undefined, true);
        }}></circle>
      <circle class="bdknob" cx="${cx}" cy="${r.y - arm}" r="${kr.toFixed(2)}"></circle>
      ${corners.map(([sx, sy, cur]) => {
        const cx = sx < 0 ? r.x : r.x + r.w;
        const cy = sy < 0 ? r.y : r.y + r.h;
        return svg`<circle
          class="bdhandle bd-${cur}" data-corner="${sx + ',' + sy}"
          cx="${cx}" cy="${cy}" r="${hr.toFixed(1)}"
          @pointerdown=${(e: PointerEvent) => {
            e.stopPropagation(); e.preventDefault(); this._bdStart(e, [sx, sy]);
          }}></circle><circle class="bdknob" cx="${cx}" cy="${cy}" r="${kr.toFixed(2)}"></circle>`;
      })}
    </g>` as unknown as TemplateResult;
  }

  /**
   * The common selected-object frame: line endpoints, or a dashed outline,
   * four corner handles and one rotation handle. Same
   * mechanics and same handle size as the backdrop frame (docs/BACKDROP.md
   * §2) — finger-sized in SCREEN terms, so it stays grabbable at any zoom —
   * and it rides the block's own rotation, so the corners stay at the corners.
   */
  private _renderTextFrame(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const sh = this._dtSel;
    const b = this._dtBox;
    if (!sh || !b || b.id !== sh.id) return nothing;
    // Two radii, one gesture (owner 2026-08-05: «уменьшить в 4 раза»). `hr`
    // is the HIT radius — unchanged, still 1.8 % of the visible view, still
    // finger-sized at any zoom — carried by an invisible circle. `kr` is what
    // you SEE: a quarter of it, a bead instead of a button, so the frame stops
    // covering the very words it is framing. Same split the wall-resize
    // handles use (.rszhandle + .rszicon, docs/RESIZE.md).
    const hr = Math.max(view.w, view.h) * 0.018;
    const kr = hr / 4;
    if (sh.kind === 'line') {
      const a = [sh.x1 * NORM_W, sh.y1 * this._decorH];
      const c = [sh.x2 * NORM_W, sh.y2 * this._decorH];
      return svg`<g class="dtframe dtlineframe">
        <line class="dtbox" x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}"></line>
        ${[a, c].map((p, i) => svg`<circle class="dthandle dtendpoint" cx="${p[0]}" cy="${p[1]}"
          r="${hr.toFixed(1)}" @pointerdown=${(e: PointerEvent) => this._dtStart(e, 'scale', undefined, i as 0 | 1)}></circle>
          <circle class="dtknob" cx="${p[0]}" cy="${p[1]}" r="${kr.toFixed(2)}"></circle>`)}
      </g>` as unknown as TemplateResult;
    }
    const [ax, ay] = this._dtPivot(sh);
    const ang = Number(sh.angle) || 0;
    const corners: [number, number, string][] = [
      [-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw'],
    ];
    const arm = hr * 2.2;
    return svg`<g class="dtframe" transform=${ang ? `rotate(${ang} ${ax} ${ay})` : nothing}>
      <rect class="dtbox" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"></rect>
      <line class="dtstem" x1="${b.x + b.w / 2}" y1="${b.y}" x2="${b.x + b.w / 2}" y2="${b.y - arm}"></line>
      <circle class="dthandle dtrot" cx="${b.x + b.w / 2}" cy="${b.y - arm}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => this._dtStart(e, 'rotate')}></circle>
      <circle class="dtknob" cx="${b.x + b.w / 2}" cy="${b.y - arm}" r="${kr.toFixed(2)}"></circle>
      ${corners.map(([sx, sy, cur]) => svg`<circle class="dthandle dt-${cur}"
        cx="${sx < 0 ? b.x : b.x + b.w}" cy="${sy < 0 ? b.y : b.y + b.h}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => this._dtStart(e, 'scale', [sx, sy])}></circle><circle class="dtknob"
        cx="${sx < 0 ? b.x : b.x + b.w}" cy="${sy < 0 ? b.y : b.y + b.h}" r="${kr.toFixed(2)}"></circle>`)}
    </g>` as unknown as TemplateResult;
  }

  private _renderDecorLayer(): TemplateResult {
    const W = NORM_W, H = this._decorH;
    const editing = this._mode === 'decor';
    const erasing = editing && this._decorTool === 'erase';
    const shapes = this._decorList.map((sh) => {
      const cls = 'dshape' + (editing && this._decorSel === sh.id ? ' dsel' : '');
      const style = this._decorResolvedStyle(sh);
      const strokeWidth = this._decorWidthUnits(sh);
      const down = (e: PointerEvent) => this._decorShapeDown(e, sh);
      const dbl = (e: MouseEvent) => this._decorShapeDbl(e, sh);
      // docs/STYLING-HOOKS.md §3: every shape carries its kind and its id
      if (sh.kind === 'line')
        // round caps: line ends read as circles of the stroke width, so two
        // lines meeting at an angle join without the notch (owner's screenshot)
        return svg`<line class="${cls}" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
          stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}"
          stroke-dasharray=${sh.line_style === 'dashed' ? `${strokeWidth * 4} ${strokeWidth * 3}` : nothing}
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${down} @dblclick=${dbl}></line>
          ${editing && this._decorTool === 'select' ? svg`<line class="dshape dselecthit"
            data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
            @pointerdown=${down} @dblclick=${dbl}></line>` : nothing}
          ${erasing ? svg`<line class="dshape derasehit" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
            @pointerdown=${down}></line>` : nothing}`;
      if (sh.kind === 'rect') {
        const cx = (sh.x + sh.w / 2) * W, cy = (sh.y + sh.h / 2) * H;
        const ang = normalizeAngle(sh.angle);
        return svg`<rect class="${cls}" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          x="${sh.x * W}" y="${sh.y * H}" width="${sh.w * W}" height="${sh.h * H}"
          stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}"
          fill="${style.fill ? style.fillColor : 'none'}" fill-opacity="${style.fill ? style.fillOpacity : 0}"
          transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing}
          @pointerdown=${down} @dblclick=${dbl}></rect>
          ${erasing ? svg`<rect class="dshape derasehit" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            x="${sh.x * W}" y="${sh.y * H}" width="${sh.w * W}" height="${sh.h * H}"
            transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing} @pointerdown=${down}></rect>` : nothing}`;
      }
      if (sh.kind === 'ellipse') {
        const cx = (sh.x + sh.w / 2) * W, cy = (sh.y + sh.h / 2) * H;
        const ang = normalizeAngle(sh.angle);
        return svg`<ellipse class="${cls}" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          cx="${cx}" cy="${cy}"
          rx="${(sh.w / 2) * W}" ry="${(sh.h / 2) * H}" stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}"
          fill="${style.fill ? style.fillColor : 'none'}" fill-opacity="${style.fill ? style.fillOpacity : 0}"
          transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing}
          @pointerdown=${down} @dblclick=${dbl}></ellipse>
          ${erasing ? svg`<ellipse class="dshape derasehit" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
            cx="${cx}" cy="${cy}" rx="${(sh.w / 2) * W}" ry="${(sh.h / 2) * H}"
            transform=${ang ? `rotate(${ang} ${cx} ${cy})` : nothing} @pointerdown=${down}></ellipse>` : nothing}`;
      }
      if (sh.kind === 'furniture') {
        // One path per piece, generated at the shape's REAL size, so the
        // stroke is an ordinary stroke-width in render units like every other
        // decor shape — no non-uniform scale to fight (docs/FURNITURE.md §2).
        // An unknown symbol renders as nothing: a plan from a newer card must
        // open in an older one, not break it.
        const W2 = sh.w * W, H2 = sh.h * H;
        const d = furniturePathD(sh.symbol, W2, H2);
        if (!d) return nothing;
        const ang = Number(sh.angle) || 0;
        const cx = sh.x * W + W2 / 2, cy = sh.y * H + H2 / 2;
        const tr = `${ang ? `rotate(${ang} ${cx} ${cy}) ` : ''}translate(${sh.x * W} ${sh.y * H})`;
        return svg`<path class="${cls} dfurn" data-hp="decor" data-id="${sh.id}"
          data-kind="${sh.kind}" data-symbol="${sh.symbol}" d="${d}" transform=${tr}
          stroke="${style.color}" stroke-opacity="${style.opacity}" stroke-width="${strokeWidth}" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
          @pointerdown=${down} @dblclick=${dbl}></path>
          ${erasing ? svg`<path class="dshape derasehit" data-hp="decor" data-id="${sh.id}"
            data-kind="${sh.kind}" data-symbol="${sh.symbol}" d="${d}" transform=${tr}
            @pointerdown=${down}></path>` : nothing}`;
      }
      if (sh.kind === 'text') {
        // The label is painted from the LIVE value on every render — the same
        // `hass` the rest of the card reads, no polling of its own. Without an
        // entity `liveText` gives the stored text back byte-for-byte, so a
        // plain label is the plain label it always was (docs/LIVE-TEXT.md).
        const fs = this._decorTextUnits(sh);
        const lines = decorTextLines(liveText(
          sh.text, sh, this.hass, (eid) => this._planEntityAvailable(eid),
        ));
        const ax = sh.x * W, ay = sh.y * H;
        const ang = Number(sh.angle) || 0;
        // the block is centred on its anchor, horizontally (the layer's
        // text-anchor) and vertically — so adding a second line grows the
        // label in both directions instead of pushing the first one up
        const y0 = ay - ((lines.length - 1) * fs * DT_LINE) / 2;
        return svg`<text class="${cls} dtext" data-hp="decor" data-id="${sh.id}" data-kind="${sh.kind}"
          x="${ax}" y="${ay}" fill="${style.color}" fill-opacity="${style.opacity}"
          font-size="${fs}" transform=${ang ? `rotate(${ang} ${ax} ${ay})` : nothing}
          @pointerdown=${down} @dblclick=${dbl}>${lines.map(
            (ln, i) => svg`<tspan x="${ax}" y="${y0 + i * fs * DT_LINE}">${ln}</tspan>`,
          )}</text>`;
      }
      return nothing;
    });
    // живое превью рисуемой фигуры
    let draft: unknown = nothing;
    const d = this._decorDraft;
    if (d) {
      const st = this._decorStyle;
      const sw = decorCmToUnits(st.widthCm, this._cellCm, this._gridPitch);
      if (d.kind === 'line')
        draft = svg`<line class="ddraft" x1="${d.a[0]}" y1="${d.a[1]}" x2="${d.b[0]}" y2="${d.b[1]}"
          stroke="${st.color}" stroke-opacity="${st.opacity}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"></line>`;
      else {
        const x = Math.min(d.a[0], d.b[0]), y = Math.min(d.a[1], d.b[1]);
        const w = Math.abs(d.b[0] - d.a[0]), h = Math.abs(d.b[1] - d.a[1]);
        draft = d.kind === 'rect'
          ? svg`<rect class="ddraft" x="${x}" y="${y}" width="${w}" height="${h}" stroke="${st.color}"
              stroke-opacity="${st.opacity}" stroke-width="${sw}" fill="${st.fill ? st.fillColor : 'none'}" fill-opacity="${st.fill ? st.fillOpacity : 0}"></rect>`
          : svg`<ellipse class="ddraft" cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"
              stroke="${st.color}" stroke-opacity="${st.opacity}" stroke-width="${sw}" fill="${st.fill ? st.fillColor : 'none'}" fill-opacity="${st.fill ? st.fillOpacity : 0}"></ellipse>`;
      }
    }
    return svg`<g class="decorlayer">${shapes}${draft}</g>` as unknown as TemplateResult;
  }

  private _renderDecorBar(): TemplateResult {
    const tools = [
      ['select', 'mdi:cursor-default-outline', 'decor.select'],
      // moving the picture is a TOOL (docs/BACKDROP.md §2) — offered only when
      // there IS a picture, so a hand-drawn space's bar is unchanged
      ...(this._bdRect ? [['backdrop', 'mdi:image-move', 'decor.backdrop'] as const] : []),
      ['line', 'mdi:vector-line', 'decor.line'],
      ['rect', 'mdi:rectangle-outline', 'decor.rect'],
      ['ellipse', 'mdi:ellipse-outline', 'decor.ellipse'],
      ['text', 'mdi:format-text', 'decor.text'],
      // the library sits next to the shapes it belongs with (docs/FURNITURE.md)
      ['furniture', 'mdi:sofa-outline', 'decor.furniture'],
      ['erase', 'mdi:eraser', 'decor.erase'],
    ] as const;
    const selected = this._decorSel ? this._decorList.find((shape) => shape.id === this._decorSel) : null;
    const canFill = this._decorTool === 'rect' || this._decorTool === 'ellipse'
      || selected?.kind === 'rect' || selected?.kind === 'ellipse';
    const undoName = this._geometryHistory.undoName;
    const redoName = this._geometryHistory.redoName;
    return html`<div class="editbar decorbar">
      ${tools.map(
        ([t, ic, k]) => html`<button class="btn dtool ${this._decorTool === t ? 'on' : ''}"
          @click=${() => {
            this._decorTool = t as typeof this._decorTool;
            this._decorDraft = null;
            // the palette belongs to its tool and to nothing else: leaving the
            // tool disarms whatever was chosen, so no later click can stamp it
            if (t !== 'furniture') this._furnPalette = null;
          }}
          title=${this._t(k)}>
          <ha-icon icon=${ic}></ha-icon><span class="ml">${this._t(k)}</span>
        </button>`,
      )}
      <hp-color-opacity .label=${this._t('decor.color')} .color=${this._decorStyle.color}
        .opacity=${this._decorStyle.opacity} .opacityLabel=${this._t('space.opacity')}
        @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
          (this._decorStyle = { ...this._decorStyle, ...e.detail })}></hp-color-opacity>
      <label class="drawwall">${this._t('decor.width')}
        <input type="number" min=${this._decorSmallField(0.1)}
          max=${this._decorSmallField(100)} step="0.1"
          .value=${String(this._decorSmallField(this._decorStyle.widthCm))}
          @input=${(e: Event) => (this._decorStyle = { ...this._decorStyle,
            widthCm: this._decorSmallCm(Number((e.target as HTMLInputElement).value)) })} />
        <span class="opl">${this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span>
      </label>
      ${canFill ? html`<label class="dfill"><input type="checkbox" .checked=${this._decorStyle.fill}
          @change=${(e: Event) => (this._decorStyle = { ...this._decorStyle, fill: (e.target as HTMLInputElement).checked })} />
          ${this._t('decor.fill')}</label>
        <hp-color-opacity .label=${this._t('decor.fill_color')} .color=${this._decorStyle.fillColor}
          .opacity=${this._decorStyle.fillOpacity} .opacityLabel=${this._t('space.opacity')}
          .disabled=${!this._decorStyle.fill}
          @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
            (this._decorStyle = { ...this._decorStyle,
              fillColor: e.detail.color, fillOpacity: e.detail.opacity })}></hp-color-opacity>` : nothing}
      <button class="btn ghost" @click=${this._undoGeometry} ?disabled=${!undoName}
        title=${undoName ? this._t('history.undo_named', { name: undoName }) : this._t('history.undo_empty')}>
        <ha-icon icon="mdi:undo-variant"></ha-icon>${this._t('history.undo')}
      </button>
      <button class="btn ghost" @click=${this._redoGeometry} ?disabled=${!redoName}
        title=${redoName ? this._t('history.redo_named', { name: redoName }) : this._t('history.redo_empty')}>
        <ha-icon icon="mdi:redo-variant"></ha-icon>${this._t('history.redo')}
      </button>
      ${''/* the picture's own affordance: only offered once it HAS been moved,
             so an untouched plan gains no button and no explaining to do.
             NOT while a gesture is live — this bar sits above the stage, and a
             button appearing mid-drag changes the stage's height, i.e. how
             many plan units a screen pixel is worth, under the finger. */}
      ${this._bdMoved && !this._bdDrag
        ? html`<button class="btn bdreset" title=${this._t('decor.backdrop_reset')}
            @click=${() => this._bdReset()}>
            <ha-icon icon="mdi:image-refresh-outline"></ha-icon><span class="ml">${this._t('decor.backdrop_reset')}</span>
          </button>`
        : nothing}
      <span class="spacer"></span>
      ${this._bdMovable
        ? html`<span class="bdhint">${this._t('decor.backdrop_hint')}</span>`
        : nothing}
      <button class="btn barclose" title=${this._t('title.close_editor')}
        @click=${() => this._setMode('view')}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`;
  }

  private _renderDecorEraseConfirm(): TemplateResult {
    const pending = this._decorEraseConfirm!;
    const kind = this._t(`decor.${pending.kind}` as any);
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('decor.erase_confirm_title')}
      icon="mdi:eraser" dismiss-on-scrim @hp-close=${() => (this._decorEraseConfirm = null)}>
        <div class="body"><p>${this._t('confirm.erase_decor', { kind })}</p></div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._decorEraseConfirm = null)}>
            ${this._t('btn.cancel')}
          </button>
          <button class="btn danger" @click=${this._confirmDecorErase}>
            <ha-icon icon="mdi:eraser"></ha-icon>${this._t('decor.erase')}
          </button>
        </div>
    </hp-dialog>`;
  }

  private _renderDecorTextDialog(): TemplateResult {
    const d = this._decorTextDialog!;
    const ent = (d.pickerEntity || '').trim();
    const st = ent ? this.hass?.states?.[ent] : null;
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('decor.text_title')}
      icon="mdi:format-text" dismiss-on-scrim @hp-close=${() => (this._decorTextDialog = null)}>
        <div class="body">
          <label>${this._t('decor.text_label')}</label>
          ${''/* a textarea, not an input: the user's own line breaks are kept
                 and rendered (centred). Enter is a NEW LINE here, so saving
                 moved to Ctrl/Cmd+Enter and the button. */}
          <textarea class="namein dtarea" rows="3" maxlength="200" .value=${d.text} autofocus
            @input=${(e: Event) => {
              const el = e.target as HTMLTextAreaElement;
              this._decorRememberTextSelection(el);
              this._decorTextDialog = { ...d, text: el.value };
            }}
            @click=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @keyup=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @select=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @blur=${(e: Event) => this._decorRememberTextSelection(e.target as HTMLTextAreaElement)}
            @keydown=${(e: KeyboardEvent) => {
              e.stopPropagation();
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this._decorSaveText();
            }}></textarea>
          <hp-color-opacity .label=${this._t('decor.color')} .color=${d.color} .opacity=${d.opacity}
            .opacityLabel=${this._t('space.opacity')}
            @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
              (this._decorTextDialog = { ...d, ...e.detail })}></hp-color-opacity>
          <label>${this._t('decor.text_size')}</label>
          <div class="colorrow"><input class="namein" type="number" min="0.1"
            max=${this._decorSmallField(DECOR_TEXT_CM_MAX)} step="0.1"
            .value=${String(this._decorSmallField(d.sizeCm))}
            @input=${(e: Event) => (this._decorTextDialog = { ...d,
              sizeCm: this._decorTextCm(Number((e.target as HTMLInputElement).value)) })} />
            <span class="opl">${this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span></div>
          <label>${this._t('decor.angle')}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${d.angle}
            @input=${(e: Event) => (this._decorTextDialog = { ...d,
              angle: (e.target as HTMLInputElement).value })} />
          <label class="dispsection">${this._t('decor.live_group')}</label>
          <label>${this._t('decor.live_entity')}</label>
          <input class="namein" type="text" list="hp-dtext-ents" placeholder=${this._t('decor.live_entity_ph')}
            .value=${d.pickerEntity || ''}
            @input=${(e: Event) => (this._decorTextDialog = {
              ...d, pickerEntity: (e.target as HTMLInputElement).value,
            })} />
          <datalist id="hp-dtext-ents">
            ${Object.keys(this.hass?.states || {}).map((id) => html`<option value=${id}></option>`)}
          </datalist>
          ${ent ? html`
            <label>${this._t('decor.live_attr')}</label>
            <select class="namein" .value=${''}
              @change=${(e: Event) => {
                const value = (e.target as HTMLSelectElement).value;
                if (value) this._decorInsertLiveVariable(value === '__state__' ? null : value);
              }}>
              <option value="">${this._t('decor.live_attr_ph')}</option>
              <option value="__state__">${this._t('decor.live_state')}</option>
              ${Object.keys(st?.attributes || {})
                .filter((a) => !!liveTextToken(ent, a))
                .map((a) => html`<option value=${a}>${a}</option>`)}
            </select>
          ` : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._decorTextDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn primary" ?disabled=${!d.text.trim()} @click=${() => this._decorSaveText()}>${this._t('btn.save')}</button>
        </div>
    </hp-dialog>`;
  }

  private _renderDecorShapeDialog(): TemplateResult {
    const d = this._decorShapeDialog!;
    const canFill = d.kind === 'rect' || d.kind === 'ellipse';
    const kindLabel = this._t(('decor.' + d.kind) as any);
    const unit = this._t(this._imperial ? 'gs.unit_ft' : 'gs.unit_m');
    return html`<hp-dialog .hass=${this.hass}
      .title=${this._t('decor.object_title', { kind: kindLabel })} icon="mdi:pencil-outline"
      dismiss-on-scrim @hp-close=${() => (this._decorShapeDialog = null)}>
        <div class="body">
          ${d.kind === 'furniture' ? html`
            <label>${this._t('furn.symbol')}</label>
            <select class="namein"
              @change=${(e: Event) => (this._decorShapeDialog = {
                ...d, symbol: (e.target as HTMLSelectElement).value,
              })}>
              ${FURNITURE_GROUPS.map((group) => html`<optgroup label=${this._t(`furn.group_${group}` as any)}>
                ${furnitureOfGroup(group).map((symbol) => html`<option value=${symbol.id}
                  ?selected=${symbol.id === d.symbol}>
                  ${this._t(`furn.sym_${symbol.id}` as any)}
                </option>`)}
              </optgroup>`)}
            </select>` : nothing}
          <hp-color-opacity .label=${this._t('decor.color')} .color=${d.color} .opacity=${d.opacity}
            .opacityLabel=${this._t('space.opacity')}
            @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
              (this._decorShapeDialog = { ...d, ...e.detail })}></hp-color-opacity>
          <label>${this._t('decor.width')}</label>
          <div class="colorrow"><input class="namein" type="number"
            min=${this._decorSmallField(0.1)} max=${this._decorSmallField(100)} step="0.1"
            .value=${String(this._decorSmallField(d.widthCm))}
            @input=${(e: Event) => (this._decorShapeDialog = {
              ...d, widthCm: this._decorSmallCm(Number((e.target as HTMLInputElement).value)),
            })} /><span class="opl">${this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span></div>
          ${d.kind === 'line' ? html`
            <label>${this._t('decor.line_style')}</label>
            <div role="radiogroup" aria-label=${this._t('decor.line_style')}>
              <label class="srcrow"><input type="radio" name="decor-line-style"
                .checked=${d.lineStyle !== 'dashed'}
                @change=${() => (this._decorShapeDialog = { ...d, lineStyle: 'solid' })} />
                <span>${this._t('decor.line_style_solid')}</span></label>
              <label class="srcrow"><input type="radio" name="decor-line-style"
                .checked=${d.lineStyle === 'dashed'}
                @change=${() => (this._decorShapeDialog = { ...d, lineStyle: 'dashed' })} />
                <span>${this._t('decor.line_style_dashed')}</span></label>
            </div>
            <label>${this._t('decor.length')}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this._decorLargeField(d.lengthCm || 0))}
              @input=${(e: Event) => (this._decorShapeDialog = { ...d,
                lengthCm: this._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
              <span class="opl">${unit}</span></div>` : html`
            <label>${this._t('decor.size')}</label>
            <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this._decorLargeField(d.sizeWCm || 0))}
              @input=${(e: Event) => (this._decorShapeDialog = { ...d,
                sizeWCm: this._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
              <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
              .value=${String(this._decorLargeField(d.sizeHCm || 0))}
              @input=${(e: Event) => (this._decorShapeDialog = { ...d,
                sizeHCm: this._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
              <span class="opl">${unit}</span></div>`}
          <label>${this._t('decor.angle')}</label>
          <input class="namein" type="number" min="-180" max="180" step="1" .value=${d.angle}
            @input=${(e: Event) => (this._decorShapeDialog = { ...d,
              angle: (e.target as HTMLInputElement).value })} />
          ${canFill ? html`<label class="dfill"><input type="checkbox" .checked=${!!d.fill}
            @change=${(e: Event) => (this._decorShapeDialog = {
              ...d, fill: (e.target as HTMLInputElement).checked,
            })} />${this._t('decor.fill')}</label>
            <hp-color-opacity .label=${this._t('decor.fill_color')}
              .color=${d.fillColor || d.color} .opacity=${d.fillOpacity ?? 0.25}
              .opacityLabel=${this._t('space.opacity')} .disabled=${!d.fill}
              @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
                (this._decorShapeDialog = { ...d,
                  fillColor: e.detail.color, fillOpacity: e.detail.opacity })}></hp-color-opacity>` : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._decorShapeDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn primary" @click=${() => this._decorSaveShape()}>${this._t('btn.save')}</button>
        </div>
    </hp-dialog>`;
  }

  private _renderBackdropDialog(): TemplateResult {
    const d = this._backdropDialog!;
    const unit = this._t(this._imperial ? 'gs.unit_ft' : 'gs.unit_m');
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('decor.backdrop_properties')}
      icon="mdi:image-edit-outline" dismiss-on-scrim @hp-close=${() => (this._backdropDialog = null)}>
      <div class="body">
        <label>${this._t('decor.size')}</label>
        <div class="colorrow"><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this._decorLargeField(d.widthCm))}
          @input=${(e: Event) => (this._backdropDialog = { ...d,
            widthCm: this._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
          <span>×</span><input class="namein" type="number" min="0.01" step="0.01"
          .value=${String(this._decorLargeField(d.heightCm))}
          @input=${(e: Event) => (this._backdropDialog = { ...d,
            heightCm: this._decorLargeCm(Number((e.target as HTMLInputElement).value)) })} />
          <span class="opl">${unit}</span></div>
        <label>${this._t('decor.angle')}</label>
        <input class="namein" type="number" min="-180" max="180" step="1" .value=${d.angle}
          @input=${(e: Event) => (this._backdropDialog = { ...d,
            angle: (e.target as HTMLInputElement).value })} />
      </div>
      <div class="row" slot="footer"><span class="spacer"></span>
        <button class="btn ghost" @click=${() => (this._backdropDialog = null)}>${this._t('btn.cancel')}</button>
        <button class="btn primary" @click=${() => this._saveBackdropDialog()}>${this._t('btn.save')}</button>
      </div>
    </hp-dialog>`;
  }

  /** CSS-pixel interaction constants stay stable at every plan zoom. */
  private _cssPxToRender(px: number): number {
    const stage = this._stageEl;
    const view = this._viewOr(this._baseVb());
    if (!stage?.clientWidth || !stage.clientHeight) return (this._gridPitch / 8) * px;
    return Math.max(view.w / stage.clientWidth, view.h / stage.clientHeight) * px;
  }

  private get _boundaryCoarse(): boolean {
    return this._boundaryPointerType === 'touch' || this._boundaryPointerType === 'pen';
  }

  private _boundaryTolerances(): { hit: number; cap: number; ambiguity: number } {
    return {
      hit: this._cssPxToRender(this._boundaryCoarse ? 22 : 12),
      cap: this._cssPxToRender(this._boundaryCoarse ? 10 : 6),
      ambiguity: this._cssPxToRender(6),
    };
  }

  /** Independent masonry owns its hit zone and blocks a room boundary below. */
  private _boundaryBlocked(raw: number[], hit: number): boolean {
    const space = this._spaceModel();
    const nearBody = (body: number[][]): boolean => pointInPhysicalBody(raw, body)
      || body.some((a, i) => {
        const b = body[(i + 1) % body.length];
        return distToSegment(raw, [a[0], a[1], b[0], b[1]]) <= hit;
      });
    for (const c of space.wall_columns || []) {
      if (nearBody(columnBody(c, this._cellCm, this._gridPitch))) return true;
    }
    for (const p of space.partitions || []) {
      const half = wallCmToUnits(p.cm, this._cellCm, this._gridPitch) / 2;
      if (distToSegment(raw, [p.a[0], p.a[1], p.b[0], p.b[1]]) <= Math.max(hit, half)) return true;
    }
    for (const draft of space.room_drafts || []) {
      for (let i = 0; i + 1 < draft.points.length; i++) {
        const a = draft.points[i], b = draft.points[i + 1];
        const half = wallCmToUnits(draft.segments[i]?.cm || 15, this._cellCm, this._gridPitch) / 2;
        if (distToSegment(raw, [a[0], a[1], b[0], b[1]]) <= Math.max(hit, half)) return true;
      }
    }
    return false;
  }

  private _solidBoundaryPull(seg: number[], cuts = this._openCuts()): number {
    const tol = this._boundaryTolerances();
    const cm = intervalCmAt(
      this._spaceModel().rooms, this._spaceWalls, cuts, seg,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
    return Math.max(
      tol.hit,
      cm > 0 ? wallCmToUnits(cm, this._cellCm, this._gridPitch) / 2 : 0,
    );
  }

  /** One resolver drives cursor, preview, hint and click semantics. */
  private _boundaryTargetAt(raw: number[]): BoundaryUiTarget {
    const view = this._viewOr(this._baseVb());
    const stage = this._stageEl;
    const key = [
      this._space, this._cfgEpoch, raw[0], raw[1], this._boundaryPointerType,
      view.x, view.y, view.w, view.h, stage?.clientWidth || 0, stage?.clientHeight || 0,
    ].join('|');
    if (this._boundaryTargetMemo?.key === key) return this._boundaryTargetMemo.value;
    const tol = this._boundaryTolerances();
    const cuts = this._openCuts();
    let value: BoundaryUiTarget = resolveBoundaryTarget(raw, this._spaceModel().rooms, cuts, {
      openPull: tol.hit,
      openEndCap: tol.cap,
      ambiguity: tol.ambiguity,
      eps: this._gridPitch * 0.02,
      solidPull: (seg) => this._solidBoundaryPull(seg, cuts),
    });
    // Independent masonry blocks only a real room boundary underneath it. A
    // bare click on a partition/column/draft elsewhere remains a neutral miss.
    if ((value.kind === 'shared' || value.kind === 'open') && this._boundaryBlocked(raw, tol.hit)) {
      value = { kind: 'blocked' };
    }
    this._boundaryTargetMemo = { key, value };
    return value;
  }

  private get _boundaryTarget(): BoundaryUiTarget | null {
    if (!this._markup || this._tool !== 'boundary' || !this._cursorPt) return null;
    return this._boundaryTargetAt(this._cursorPt);
  }

  /** Exact predicted action under the pointer, including restored wall body. */
  private get _boundaryPreview(): BoundaryPreview | null {
    const view = this._viewOr(this._baseVb());
    const stage = this._stageEl;
    const raw = this._cursorPt;
    const anchor = this._openWallAnchor;
    const key = [
      this._markup, this._tool, this._space, this._cfgEpoch, this._boundaryPointerType,
      raw?.[0] ?? 'none', raw?.[1] ?? 'none',
      anchor?.p?.[0] ?? 'none', anchor?.p?.[1] ?? 'none',
      anchor?.edge?.join(',') ?? 'none', anchor?.aId ?? 'none', anchor?.bId ?? 'none',
      view.x, view.y, view.w, view.h, stage?.clientWidth || 0, stage?.clientHeight || 0,
    ].join('|');
    if (this._boundaryPreviewMemo?.key === key) return this._boundaryPreviewMemo.value;
    const remember = (value: BoundaryPreview | null): BoundaryPreview | null => {
      this._boundaryPreviewMemo = { key, value };
      return value;
    };
    if (!this._markup || this._tool !== 'boundary') return remember(null);
    // A touch tap need not emit pointermove. The committed P1 marker therefore
    // comes from the anchor itself and never depends on a hover-only cursor.
    if (anchor && !raw) return remember({ kind: 'anchor', point: [...anchor.p] });
    if (!raw) return remember(null);
    const cuts = this._openCuts();
    const eps = this._gridPitch * 0.02;
    if (anchor) {
      const { p, edge } = anchor;
      const joints = jointsOnEdge(edge, cuts, eps);
      const p2 = snapOpenPoint(raw, edge, joints, this._gridPitch, this._gridPitch * 1.5);
      const q = clampToEdgeEnds(p2, edge);
      const invalid = this._boundaryBlocked(raw, this._boundaryTolerances().hit)
        || distToSegment(raw, edge) > this._solidBoundaryPull(edge, cuts);
      return remember({ kind: 'range', seg: [p[0], p[1], q[0], q[1]], invalid });
    }
    const target = this._boundaryTargetAt(raw);
    if (target.kind === 'shared') {
      const point = snapOpenPoint(
        raw, target.edge, jointsOnEdge(target.edge, cuts, eps),
        this._gridPitch, this._gridPitch * 1.5,
      );
      return remember({ kind: 'anchor', point });
    }
    if (target.kind === 'open') {
      const plan = this._planClosedOpenSpan(target.seg);
      const body = plan
        ? partitionBody(
            [target.seg[0], target.seg[1]], [target.seg[2], target.seg[3]],
            plan.cm, this._cellCm, this._gridPitch,
          )
        : null;
      return remember({ kind: 'restore', seg: target.seg, body });
    }
    if (target.kind === 'blocked' || target.kind === 'ambiguous' || target.kind === 'outer') {
      return remember({ kind: 'invalid', point: raw });
    }
    return remember(null);
  }

  private get _boundaryHintKey(): I18nKey {
    if (this._openWallAnchor) {
      const preview = this._boundaryPreview;
      return preview?.kind === 'range' && preview.invalid
        ? 'markup.boundary_hint_retry'
        : 'markup.boundary_hint_second';
    }
    const target = this._boundaryTarget;
    if (!target || target.kind === 'none') return 'markup.boundary_hint';
    if (target.kind === 'open') return 'markup.boundary_hint_restore';
    if (target.kind === 'shared') return 'markup.boundary_hint_open';
    if (target.kind === 'outer') return 'markup.boundary_hint_outer';
    if (target.kind === 'blocked') return 'markup.boundary_hint_blocked';
    return 'markup.boundary_hint_ambiguous';
  }

  private get _boundaryStageClass(): string {
    if (!this._markup || this._tool !== 'boundary') return '';
    if (this._openWallAnchor) {
      const preview = this._boundaryPreview;
      return preview?.kind === 'range' && preview.invalid ? ' boundary-invalid' : ' boundary-solid';
    }
    const target = this._boundaryTarget;
    if (target?.kind === 'open') return ' boundary-open';
    if (target?.kind === 'shared') return ' boundary-solid';
    if (target && target.kind !== 'none') return ' boundary-invalid';
    return '';
  }

  /** Dashed virtual boundaries plus the unified tool's local action preview. */
  private _renderOpenWalls(disp?: SpaceDisplay): TemplateResult {
    if (disp && !disp.showBorders && !this._editing) return svg`` as unknown as TemplateResult;
    const cuts = this._openCuts();
    const preview = this._boundaryPreview;
    if (!cuts.length && !preview) return svg`` as unknown as TemplateResult;
    const stroke = disp?.color || 'var(--hp-muted)';
    const bodyPath = (body: number[][]) => `M ${body.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
    const marker = (point: number[], invalid = false) => invalid
      ? svg`<g class="boundary-point invalid">
          <circle cx=${point[0]} cy=${point[1]} r=${this._cssPxToRender(5)}></circle>
          <path d="M ${point[0] - this._cssPxToRender(4)} ${point[1] - this._cssPxToRender(4)}
            L ${point[0] + this._cssPxToRender(4)} ${point[1] + this._cssPxToRender(4)}
            M ${point[0] + this._cssPxToRender(4)} ${point[1] - this._cssPxToRender(4)}
            L ${point[0] - this._cssPxToRender(4)} ${point[1] + this._cssPxToRender(4)}"></path>
        </g>`
      : svg`<circle class="boundary-point" cx=${point[0]} cy=${point[1]}
          r=${this._cssPxToRender(5)}></circle>`;
    return svg`<g class="openwalls" style="--ow-stroke:${stroke}">
      ${cuts.map((sg) => svg`<line class="openwall"
        x1="${sg[0]}" y1="${sg[1]}" x2="${sg[2]}" y2="${sg[3]}"></line>`)}
      ${preview?.kind === 'range'
        ? svg`<line class="openwall-preview boundary-range ${preview.invalid ? 'invalid' : ''}"
            x1="${preview.seg[0]}" y1="${preview.seg[1]}"
            x2="${preview.seg[2]}" y2="${preview.seg[3]}"></line>
            ${marker([preview.seg[0], preview.seg[1]])}
            ${marker([preview.seg[2], preview.seg[3]], preview.invalid)}`
        : nothing}
      ${preview?.kind === 'restore' && preview.body
        ? svg`<path class="openwall-preview boundary-restore"
            d=${bodyPath(preview.body)}></path>`
        : nothing}
      ${preview?.kind === 'anchor'
        ? marker(preview.point)
        : preview?.kind === 'invalid'
          ? marker(preview.point, true)
        : nothing}
    </g>` as unknown as TemplateResult;
  }

  /** Open cuts in render units (from open_spans or legacy open_to). */
  private _openCuts(): number[][] {
    const sp = this._curSpaceCfg;
    return resolveOpenCuts(
      this._spaceModel().rooms,
      (sp as any)?.open_spans as OpenSpanEntry[] | undefined,
      NORM_W,
      this._gridPitch * 0.02,
    );
  }

  /** Open cuts grouped by room pair (for per-room outline trimming). */
  private _openPairs(): { a: RoomCfg; b: RoomCfg; segs: number[][] }[] {
    const cuts = this._openCuts();
    if (!cuts.length) return [];
    const rooms = this._spaceModel().rooms.filter((r) => r.id);
    const eps = this._gridPitch * 0.02;
    const res: { a: RoomCfg; b: RoomCfg; segs: number[][] }[] = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const pa = roomPoly(rooms[i]), pb = roomPoly(rooms[j]);
        if (!pa || !pb) continue;
        const shared = sharedBoundary(pa, pb, eps);
        if (!shared.length) continue;
        const segs = cuts.filter((cut) => {
          const mid = [(cut[0] + cut[2]) / 2, (cut[1] + cut[3]) / 2];
          return shared.some((sg) => distToSegment(mid, sg) < eps * 4);
        });
        if (segs.length) res.push({ a: rooms[i], b: rooms[j], segs });
      }
    }
    return res;
  }

  /**
   * One geometry transaction for open spans (AUD-159B6-02). Called by EVERY
   * operation that rewrites the room set — resize/scale commit, Undo-adjacent
   * commits, Split, Merge, Delete: rekey explicit spans onto the moved edges,
   * drop/clip them against the NEW rooms, then derive `open_to` from what is
   * left. The order matters: the legacy `open_to` index is never read in the
   * middle, or a removed explicit span resurrects a different stretch.
   */
  private _commitOpenSpans(
    rekey?: { old: [number[], number[]][]; next: [number[], number[]][] },
  ): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const eps = this._gridPitch * 0.02;
    this._cfgEpoch++; // the room set changed under the model memo
    const rooms = this._spaceModel().rooms;
    let spans = sanitizeOpenSpans((sp as any).open_spans);
    if (spans.length && rekey?.old.length) {
      spans = rekeyOpenSpansAfterMove(spans, rekey.old, rekey.next, NORM_W);
    } else if (!spans.length) {
      // A legacy `open_to`-only space: its truth is connectivity, so the
      // stretches are re-derived on the new geometry and persisted here (the
      // first-save migration the spec asks for).
      spans = cutsToSpanEntries(resolveOpenCuts(rooms, null, NORM_W, eps), NORM_W);
    }
    spans = clipOpenSpansToShared(spans, rooms, NORM_W, eps);
    this._persistOpenCuts(spans.map((e) => entryToSeg(e, NORM_W)));
  }

  /** Write cuts into space.open_spans and sync open_to. */
  private _persistOpenCuts(cuts: number[][]): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const eps = this._gridPitch * 0.02;
    const entries = clipOpenSpansToShared(
      cutsToSpanEntries(cuts, NORM_W), this._spaceModel().rooms, NORM_W, eps,
    );
    const canonicalCuts = entries.map((e) => entryToSeg(e, NORM_W));
    if (entries.length) (sp as any).open_spans = entries;
    else delete (sp as any).open_spans;
    syncOpenToFromCuts(sp.rooms || [], this._spaceModel().rooms, canonicalCuts, eps);
  }

  /** Pure close plan shared by the body preview and the actual mutation. */
  private _planClosedOpenSpan(sg: number[]): { cuts: number[][]; walls: WallEntry[]; cm: number } | null {
    const sp = this._curSpaceCfg;
    if (!sp) return null;
    const eps = this._gridPitch * 0.02;
    const oldCuts = this._openCuts();
    // Materialise exact endpoints of every real remainder before removing the
    // cut. Older entries carry only midpoint+angle; without this one cut can be
    // the sole record of the boundary between (for example) 20 and 30 cm.
    let seededWalls = Array.isArray(sp.walls) ? sp.walls.slice() : [];
    for (const iv of wallIntervals(
      this._spaceModel().rooms, seededWalls, oldCuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    )) {
      if (iv.open || !(iv.cm > 0)) continue;
      seededWalls = setWallThickness(
        seededWalls, iv.a, iv.b, iv.cm, this._wallKeyPitch, NORM_W,
      );
    }
    const cuts = removeCut(oldCuts, sg, eps);
    // The stretch is solid again: rekey thickness onto the merged intervals
    // first — a partially opened wall keeps the cm of the part that stayed
    // closed. Only a wall that was open end to end has nothing to inherit and
    // takes the default (owner 2026-08-05).
    let walls = this._normalizeWalls(seededWalls, cuts);
    let cm = intervalCmAt(
      this._spaceModel().rooms, walls, cuts, sg,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
    if (!(cm > 0)) {
      const solid: number[][] = [];
      for (const iv of wallIntervals(
        this._spaceModel().rooms, walls, cuts,
        this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
      )) {
        if (iv.open) continue;
        solid.push([iv.a[0], iv.a[1], iv.b[0], iv.b[1]]);
      }
      walls = applyThicknessOnClose(
        walls, sg, solid, this._wallKeyPitch, NORM_W, DRAW_WALL_DEFAULT_CM,
      );
      walls = this._normalizeWalls(walls, cuts);
      cm = intervalCmAt(
        this._spaceModel().rooms, walls, cuts, sg,
        this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
      );
    }
    return { cuts, walls, cm: cm > 0 ? cm : DRAW_WALL_DEFAULT_CM };
  }

  private _closeOpenSpan(sg: number[]): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const before = this._geometrySnapshot();
    const plan = this._planClosedOpenSpan(sg);
    if (!plan) return;
    if (plan.walls.length) sp.walls = plan.walls;
    else delete sp.walls;
    this._persistOpenCuts(plan.cuts);
    this._showToast(this._t('toast.boundary_restored'));
    this._recordGeometry(this._t('history.close_boundary'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  /** Unified Boundary tool: restore a dash, or choose two points on one shared wall. */
  private _boundaryClick(raw: number[]): void {
    // Ignore a same-place follow-up after restoring a span. Some touch browsers
    // report both taps with detail=0/1, so time and position are the stable guard.
    const guard = this._boundaryRestoreGuard;
    if (guard && Date.now() > guard.until) this._boundaryRestoreGuard = null;
    if (guard && Date.now() <= guard.until
        && Math.hypot(raw[0] - guard.point[0], raw[1] - guard.point[1]) <= this._boundaryTolerances().hit) return;
    const eps = this._gridPitch * 0.02;
    const cuts = this._openCuts();

    if (this._openWallAnchor) {
      const { p, edge } = this._openWallAnchor;
      if (distToSegment(raw, edge) > this._solidBoundaryPull(edge, cuts)) {
        this._showToast(this._t('toast.boundary_same_edge'));
        return; // keep P1 for a retry
      }
      if (this._boundaryBlocked(raw, this._boundaryTolerances().hit)) {
        this._showToast(this._t('toast.boundary_blocked'));
        return;
      }
      const joints = jointsOnEdge(edge, cuts, eps);
      const p2 = snapOpenPoint(raw, edge, joints, this._gridPitch, this._gridPitch * 1.5);
      const clamped = clampToEdgeEnds(p2, edge);
      const len = Math.hypot(clamped[0] - p[0], clamped[1] - p[1]);
      this._openWallAnchor = null;
      this._cursorPt = null;
      if (len < this._gridPitch * 0.5) {
        this._showToast(this._t('toast.openwall_short'));
        return;
      }
      const sg = [p[0], p[1], clamped[0], clamped[1]];
      const next = [...cuts, sg];
      const sp = this._curSpaceCfg;
      if (!sp) return;
      const before = this._geometrySnapshot();
      // A virtual stretch carries no thickness: the key of the wall it cuts is
      // SPLIT here — the covered piece is dropped, the solid remainder keeps
      // the cm under its own atomic key (spec invariant, AUD-159B6-01). Simply
      // deleting every key that touches the span, as this used to do, threw the
      // remainder away with it.
      const walls = this._normalizeWalls(sp.walls, next);
      if (walls.length) sp.walls = walls;
      else delete sp.walls;
      const beforeOp = (sp.openings || []).length;
      sp.openings = purgeOpeningsOnSpan(sp.openings, sg, NORM_W, this._gridPitch * 6);
      if ((sp.openings || []).length < beforeOp) {
        this._showToast(this._t('toast.openwall_openings_removed'));
      }
      this._persistOpenCuts(next);
      this._showToast(this._t('toast.boundary_opened'));
      this._recordGeometry(this._t('history.open_boundary'), before);
      this._saveConfig();
      this.requestUpdate();
      return;
    }

    const target = this._boundaryTargetAt(raw);
    if (target.kind === 'open') {
      this._boundaryRestoreGuard = { until: Date.now() + 450, point: [...raw] };
      this._cursorPt = null;
      this._closeOpenSpan(target.seg);
      return;
    }
    if (target.kind === 'ambiguous') {
      this._showToast(this._t('toast.boundary_ambiguous'));
      return;
    }
    if (target.kind === 'blocked') {
      this._showToast(this._t('toast.boundary_blocked'));
      return;
    }
    if (target.kind === 'outer') {
      this._showToast(this._t('toast.openwall_shared_only'));
      return;
    }
    if (target.kind !== 'shared') {
      this._showToast(this._t('toast.openwall_pick'));
      return;
    }
    const joints = jointsOnEdge(target.edge, cuts, eps);
    const p1 = snapOpenPoint(raw, target.edge, joints, this._gridPitch, this._gridPitch * 1.5);
    this._openWallAnchor = {
      p: p1,
      edge: target.edge,
      aId: target.a.id!,
      bId: target.b.id!,
    };
    this.requestUpdate();
  }

  /** Delete tool: only the explicitly clicked room, never wall semantics. */
  private _deleteRoomClick(raw: number[]): void {
    const room = [...this._spaceModel().rooms].reverse().find((r) => this._pointInRoom(raw, r));
    if (!room) {
      this._showToast(this._t('toast.delete_room_pick'));
      return;
    }
    if (!confirm(this._t('confirm.delete_room', { name: room.name }))) return;
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const before = this._geometrySnapshot();
    sp.rooms = sp.rooms.filter((r: any) => r.id !== room.id);
    this._commitOpenSpans();
    this._recordGeometry(this._t('history.delete_room'), before);
    this._saveConfig();
    this._regSignature = '';
    this._maybeRebuildDevices();
    this.requestUpdate();
  }


  // ================= WALL THICKNESS (docs/WALL-THICKNESS.md) =================

  /** Keys are always stored in normalised space (GRID_STEP_N). */
  private get _wallKeyPitch(): number {
    return GRID_STEP_N;
  }

  private get _spaceWalls(): WallEntry[] {
    const w = this._curSpaceCfg?.walls;
    return Array.isArray(w) ? (w as WallEntry[]) : [];
  }

  /**
   * Open cuts in CONFIG space (normalised), for key work that runs on
   * `sp.rooms` rather than on the render model. The canvas is square, so both
   * axes divide by NORM_W and a stored span IS a config-space segment.
   * `degradeWalls` needs them: a wall split by an open span keeps its solid
   * remainder under an atomic key that is only "live" when the cut is known.
   */
  private _cfgOpenCuts(): number[][] {
    return sanitizeOpenSpans((this._curSpaceCfg as any)?.open_spans)
      .map((e) => [e.a[0], e.a[1], e.b[0], e.b[1]]);
  }

  /** Thickness of the atomic stretch under a segment (docs/WALL-THICKNESS.md). */
  private _intervalCm(seg: number[]): number {
    return intervalCmAt(
      this._spaceModel().rooms, this._spaceWalls, this._openCuts(), seg,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
  }

  /** Rewrite thickness keys onto the current atomic intervals and drop dead ones. */
  private _normalizeWalls(walls: WallEntry[] | null | undefined, cuts: number[][]): WallEntry[] {
    const next = normalizeWallIntervals(
      this._spaceModel().rooms, walls, cuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
    return degradeWalls(next, this._curSpaceCfg?.rooms || [], GRID_STEP_N, 1,
      cuts.map((c) => [c[0] / NORM_W, c[1] / NORM_W, c[2] / NORM_W, c[3] / NORM_W]));
  }

  /** Paper under rooms, grown by shared-wall half-thickness when set. */
  private _paperShapes(rooms: any[]): Array<{ poly: string } | { rect: { x: number; y: number; w: number; h: number; rx: number } }> {
    const walls = this._spaceWalls;
    if (!walls.length) return paperRoomShapes(rooms);
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    return paperRoomShapesWithWalls(
      rooms, walls, openCuts, this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    );
  }

  /** Thick-wall spans in render units — suppress centreline stroke under bodies. */
  private _thickWallCuts(): number[][] {
    const walls = this._spaceWalls;
    if (!walls.length) return [];
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    return wallEdgeBodies(
      this._spaceModel().rooms, walls, openCuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    ).map((b) => [b.a[0], b.a[1], b.b[0], b.b[1]]);
  }

  /**
   * The ATOMIC wall stretch under the cursor for the wall-thickness tool.
   *
   * AUD-159B6-01: it used to return the whole polygon edge (only preferring a
   * shared overlap), so a click on the outer remainder of a partially shared
   * wall wrote a key that the renderer then spread over the shared part as
   * well. The unit of the tool is now the same interval the renderer draws.
   */
  private _wallThickHit(raw: number[]): {
    a: number[]; b: number[]; roomId: string; segs: number[][]; open: boolean; cm: number;
  } | null {
    const pull = this._gridPitch * 6;
    const cuts = this._openCuts();
    let best: { iv: ReturnType<typeof wallIntervals>[number]; d: number } | null = null;
    for (const iv of wallIntervals(
      this._spaceModel().rooms, this._spaceWalls, cuts,
      this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
    )) {
      const d = distToSegment(raw, [iv.a[0], iv.a[1], iv.b[0], iv.b[1]]);
      if (d <= pull && (!best || d < best.d)) best = { iv, d };
    }
    if (!best) return null;
    const iv = best.iv;
    return {
      a: iv.a, b: iv.b, roomId: iv.roomId,
      segs: [[iv.a[0], iv.a[1], iv.b[0], iv.b[1]]],
      open: iv.open, cm: iv.cm,
    };
  }

  private get _wallThickHover(): { segs: number[][]; open: boolean; d: string } | null {
    if (!this._markup || this._tool !== 'wallthick' || !this._cursorPt || this._wallDialog) return null;
    const hit = this._wallThickHit(this._cursorPt);
    if (!hit) return null;
    // Whole-wall strip: real half-depth when thickness is set, else a visible
    // minimum so thin centreline walls still light up under the cursor.
    const cm = hit.cm;
    const depth = cm > 0
      ? wallCmToUnits(cm, this._cellCm, this._gridPitch)
      : this._gridPitch * 3;
    const half = Math.max(depth / 2, this._gridPitch * 1.25);
    let d = '';
    for (const sg of hit.segs) {
      d += (d ? ' ' : '') + drawWallPreviewD(
        [[sg[0], sg[1]], [sg[2], sg[3]]], half, false,
      );
    }
    return { segs: hit.segs, open: hit.open, d };
  }

  private _wallThickClick(raw: number[]): void {
    const hit = this._wallThickHit(raw);
    if (!hit) {
      this._showToast(this._t('toast.wallthick_pick'));
      return;
    }
    if (hit.open) {
      this._showToast(this._t('toast.wallthick_open'));
      return;
    }
    const cm = hit.cm;
    const view = this._viewOr(this._baseVb());
    const mx = (hit.a[0] + hit.b[0]) / 2, my = (hit.a[1] + hit.b[1]) / 2;
    this._wallDialog = {
      a: hit.a, b: hit.b,
      value: cmToField(cm, this._imperial),
      roomId: hit.roomId,
      sx: ((mx - view.x) / view.w) * 100,
      sy: ((my - view.y) / view.h) * 100,
    };
  }

  private _wallThickApply(allRoom: boolean): void {
    const d = this._wallDialog;
    if (!d) return;
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const text = d.value.trim();
    const raw = text ? strictNumber(text) : 0;
    if (raw == null) { this._showPhysicalRange(100); return; }
    const cmRaw = this._imperial ? raw * 2.54 : raw;
    if (text && (!Number.isFinite(cmRaw) || cmRaw < 0 || (cmRaw > 0 && cmRaw < 1)
        || cmRaw > 100)) {
      this._showPhysicalRange(100);
      return;
    }
    const before = this._geometrySnapshot();
    const cm = text && cmRaw > 0 ? cmRaw : null;
    const openCuts = this._openCuts();
    let next: WallEntry[];
    if (allRoom && d.roomId) {
      next = setWallThicknessForRoom(
        sp.walls, this._spaceModel().rooms, d.roomId, cm, this._wallKeyPitch, openCuts, NORM_W,
      );
    } else {
      next = setWallThickness(sp.walls, d.a, d.b, cm, this._wallKeyPitch, NORM_W);
    }
    next = this._normalizeWalls(next, openCuts);
    if (next.length) sp.walls = next;
    else delete sp.walls;
    this._wallDialog = null;
    this._showToast(this._t(cm == null ? 'toast.wallthick_cleared' : 'toast.wallthick_set'));
    this._recordGeometry(this._t('history.wall_thickness'), before);
    this._saveConfig();
    this.requestUpdate();
  }

  private _wallHatchDefs(color: string): TemplateResult {
    if (!this._spaceWalls.length && !this._physicalBodiesR().length && !this._markup)
      return svg`` as unknown as TemplateResult;
    const inv = Math.max(0.4, 1 / Math.max(this._zoom, 0.4));
    // Bake the wall colour into the pattern — CSS vars on <pattern> content
    // do not inherit from the filled path, so var(--room-stroke) fell back
    // to grey while the wall outline used the real border colour.
    const stroke = color || '#607d8b';
    return svg`<defs>
      <pattern id="hp-wall-hatch" patternUnits="userSpaceOnUse" width="8" height="8"
        patternTransform="rotate(45) scale(${inv.toFixed(3)})">
        <path d="M0 0 L0 8" stroke="${stroke}" stroke-width="2"></path>
      </pattern>
    </defs>` as unknown as TemplateResult;
  }

  private _renderWallBodies(disp: SpaceDisplay): TemplateResult {
    if (disp && !disp.showBorders && (this._mode === 'view' || this._mode === 'devices'))
      return svg`` as unknown as TemplateResult;
    const walls = this._spaceWalls;
    const extras = this._physicalBodiesR();
    if (!walls.length && !extras.length) return svg`` as unknown as TemplateResult;
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    const openings = (this._curSpaceCfg?.openings || []).map((o: any) => ({
      x: Number(o.x) * NORM_W, y: Number(o.y) * NORM_W,
      angle: Number(o.angle) || 0,
      length: (Number(o.length) > 0 ? Number(o.length) : 0.9) * NORM_W,
    }));
    const unionKey = `${this._space}|${this._cfgEpoch}|${this._spaceModel().rooms.length}`;
    if (!this._wallUnionCache || this._wallUnionCache.key !== unionKey) {
      this._wallUnionCache = {
        key: unionKey,
        value: wallBodiesUnionPath(
          this._spaceModel().rooms, walls, openCuts, openings,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W, extras,
        ),
      };
    }
    const united = this._wallUnionCache.value;
    if (!united) return svg`` as unknown as TemplateResult;
    const stage = this._stageEl;
    const v = this._viewOr(this._baseVb());
    const px = stage && stage.clientWidth && v.w ? stage.clientWidth / v.w : 1;
    const stroke = disp?.color || '#607d8b';
    const solid = wallBodyNeedsSolid(united.depthUnits, px);
    const wf = this._fillColors.wall_fill;
    // Fill colour UNDER the hatch (owner 2026-08-05): both, never one instead
    // of the other. When the body is thinner than ~3px on screen the hatch
    // collapses into noise — keep the solid fill alone.
    return svg`<g class="wallbodies" style="--room-stroke:${stroke};--wall-fill:${wf.c};--wall-fill-op:${wf.a}">
      <path class="wallbody-fill" d="${united.d}"
        fill="${wf.c}" fill-opacity="${wf.a}" fill-rule=${united.fillRule}
        stroke="none" pointer-events="none"></path>
      <path class="wallbody ${solid ? 'solid' : ''}"
        data-hp="wall" data-id="union" data-kind="union"
        d="${united.d}" fill="${solid ? 'none' : 'url(#hp-wall-hatch)'}" fill-rule=${united.fillRule}
        stroke="${stroke}" stroke-width="0.6" pointer-events="none"></path>
    </g>` as unknown as TemplateResult;
  }

  /**
   * View-only clean-floor perimeter above real wall bodies.
   *
   * The hover follows the same inner face that defines the displayed room
   * area. A nested room is a hole in the hovered room, so its boundary uses the
   * opposite (outward) wall face. Open spans stay dashed in their own layer;
   * doors, windows and gates remain gaps instead of being bridged by a solid accent.
   */
  private _renderRoomHover(space: SpaceModel): TemplateResult {
    const hover = this._hoverRoom;
    if (this._mode !== 'view' || !hover || hover.space !== space.id) {
      return svg`` as unknown as TemplateResult;
    }
    const room = space.rooms.find((r) => r === hover.room || (!!r.id && r.id === hover.room.id));
    if (!room) return svg`` as unknown as TemplateResult;
    const poly = roomPoly(room);
    if (!poly) return svg`` as unknown as TemplateResult;

    // A parent room also owns the floor-facing side of walls around rooms
    // nested inside it. Keep the room together with its cached polygon so a
    // hole can use the OUTER face of that nested room's wall.
    const others = space.rooms
      .filter((r) => r !== room)
      .map((r) => ({ room: r, poly: roomPoly(r) }))
      .filter((v): v is { room: RoomCfg; poly: number[][] } => !!v.poly);
    const islandPolys = islandsOf(poly, others.map((v) => v.poly));
    const pairs = this._openPairs();
    const allOpenCuts = pairs.flatMap((p) => p.segs);
    const openCuts = room.id
      ? pairs.filter((p) => p.a.id === room.id || p.b.id === room.id).flatMap((p) => p.segs)
      : pairs.flatMap((p) => p.segs);
    const walls = this._spaceWalls;
    const floor = walls.length && room.id
      ? (innerContourForRoom(
          space.rooms, room.id, walls, allOpenCuts,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        ) || poly)
      : poly;
    const contours: { axis: number[][]; face: number[][] }[] = [{ axis: poly, face: floor }];
    for (const island of islandPolys) {
      const owner = others.find((v) => v.poly === island)?.room;
      let face = island;
      if (walls.length && owner?.id) {
        const profile = roomWallProfile(
          space.rooms, owner.id, walls, allOpenCuts,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        );
        if (profile) face = outsetContour(profile.poly, profile.offsets) || island;
      }
      contours.push({ axis: island, face });
    }
    // A hidden opening symbol is still a physical opening: never bridge a
    // doorway/window with the hover stroke merely because its symbol is off.
    const openingCuts = this._openingsR.map((o) => {
      const rad = (o.angle * Math.PI) / 180;
      const dx = (Math.cos(rad) * o.rlen) / 2;
      const dy = (Math.sin(rad) * o.rlen) / 2;
      return [o.rx - dx, o.ry - dy, o.rx + dx, o.ry + dy];
    });
    const eps = this._gridPitch * 0.02;

    // Cuts are stored on wall centrelines. Project each relevant cut onto the
    // clean-floor face before trimming; otherwise a door on a thick wall would
    // no longer intersect the inset hover contour.
    const cutOnFace = (cut: number[], axis: number[][], face: number[][]): number[] | null => {
      const cx = cut[2] - cut[0], cy = cut[3] - cut[1];
      const cLen = Math.hypot(cx, cy);
      if (cLen < eps) return null;
      const cux = cx / cLen, cuy = cy / cLen;
      const mx = (cut[0] + cut[2]) / 2, my = (cut[1] + cut[3]) / 2;
      let belongs = false;
      for (let i = 0; i < axis.length; i++) {
        const a = axis[i], b = axis[(i + 1) % axis.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const eLen = Math.hypot(ex, ey);
        if (eLen < eps || Math.abs(cux * (ey / eLen) - cuy * (ex / eLen)) > 0.05) continue;
        if (distToSegment([mx, my], [a[0], a[1], b[0], b[1]]) <= eps * 4) {
          belongs = true;
          break;
        }
      }
      if (!belongs) return null;

      let best: { a: number[]; b: number[]; d: number } | null = null;
      for (let i = 0; i < face.length; i++) {
        const a = face[i], b = face[(i + 1) % face.length];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const eLen = Math.hypot(ex, ey);
        if (eLen < eps || Math.abs(cux * (ey / eLen) - cuy * (ex / eLen)) > 0.05) continue;
        const d = distToSegment([mx, my], [a[0], a[1], b[0], b[1]]);
        if (!best || d < best.d) best = { a, b, d };
      }
      if (!best) return null;
      const fx = best.b[0] - best.a[0], fy = best.b[1] - best.a[1];
      const fLen = Math.hypot(fx, fy) || 1;
      const nx = -fy / fLen, ny = fx / fLen;
      const shift = (best.a[0] - mx) * nx + (best.a[1] - my) * ny;
      return [
        cut[0] + nx * shift, cut[1] + ny * shift,
        cut[2] + nx * shift, cut[3] + ny * shift,
      ];
    };

    const rawCuts = openCuts.concat(openingCuts);
    const d = contours.map(({ axis, face }) => {
      const cuts = rawCuts
        .map((cut) => cutOnFace(cut, axis, face))
        .filter((cut): cut is number[] => !!cut);
      if (!cuts.length) {
        return `M ${face.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
      }
      return outlineWithout(face, cuts, eps)
        .map((sg) => `M ${sg[0]} ${sg[1]} L ${sg[2]} ${sg[3]}`)
        .join(' ');
    }).filter(Boolean).join(' ');
    if (!d) return svg`` as unknown as TemplateResult;
    return svg`<path class="room-hover-outline" d="${d}"></path>` as unknown as TemplateResult;
  }

  /** Hover highlight for the wall-thickness tool (SVG). */
  private _renderWallThickUi(): TemplateResult {
    const hover = this._wallThickHover;
    if (!hover || !hover.d) return svg`` as unknown as TemplateResult;
    return svg`<path class="wallthick-hover ${hover.open ? 'isopen' : ''}"
      d="${hover.d}"></path>` as unknown as TemplateResult;
  }

  /** Thickness input popover, anchored in stage % like measure labels. */
  private _renderWallThickDialog(): TemplateResult {
    const d = this._wallDialog;
    if (!d) return html``;
    return html`<div class="wallthick-dlg" style="left:${d.sx.toFixed(2)}%;top:${d.sy.toFixed(2)}%"
      @click=${(e: Event) => e.stopPropagation()}>
      <div class="row">
        <label>${this._t('wallthick.field')}</label>
        <input type="number" min="0" max="100" step="any" .value=${d.value}
          @input=${(e: Event) => {
            this._wallDialog = { ...d, value: (e.target as HTMLInputElement).value };
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); this._wallThickApply(false); }
          }} />
        <span class="opl">${this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span>
      </div>
      <div class="row">
        <button class="btn ghost" @click=${() => this._wallThickApply(true)}>
          ${this._t('wallthick.apply_room')}
        </button>
        <span class="spacer"></span>
        <button class="btn on" @click=${() => this._wallThickApply(false)}>
          <ha-icon icon="mdi:check"></ha-icon>
        </button>
      </div>
    </div>`;
  }


  /** Opening tool: click an existing opening to edit it, or a wall to place one. */
  private _openingClick(raw: number[]): void {
    const eps = this._gridPitch * 1.5;
    const hit = this._openingsR.find(
      (o) => Math.hypot(raw[0] - o.rx, raw[1] - o.ry) <= Math.max(o.rlen / 2, eps),
    );
    if (hit) {
      this._editOpening(hit);
      return;
    }
    const snap = snapToWall(raw, this._spaceModel().rooms, eps);
    if (!snap) {
      this._showToast(this._t('toast.opening_no_wall'));
      return;
    }
    if (pointOnOpenCut(snap.x, snap.y, snap.angle, this._openCuts(), eps)) {
      this._showToast(this._t('toast.opening_on_virtual'));
      return;
    }
    // the opening is born where the PREVIEW showed it — magnet included
    const place = this._opRuler(snap, this._cmToUnits(OPENING_DEFAULT_CM));
    this._openingDialog = {
      type: 'door', lengthCm: OPENING_DEFAULT_CM, contact: '', lock: '',
      invert: false, flipH: false, flipV: false,
      x: place.x, y: place.y, angle: place.angle,
    };
    // rulers, tick and ghost live only through the placement gesture
    this._cursorPt = null;
  }

  /** Open the properties dialog for an existing opening. */
  private _editOpening(o: OpeningCfg & { rx: number; ry: number; rlen: number }): void {
    this._openingDialog = {
      id: o.id,
      type: o.type,
      lengthCm: Math.round((o.rlen / this._gridPitch) * this._cellCm),
      contact: o.contact || '',
      lock: o.lock || '',
      invert: !!o.invert,
      flipH: !!o.flip_h,
      flipV: !!o.flip_v,
      x: o.rx, y: o.ry, angle: o.angle,
    };
  }

  /** Drag an opening along the walls (view mode): it re-snaps continuously. */
  private _opPointerDown(ev: PointerEvent, o: OpeningCfg): void {
    if (this._mode !== 'plan') return;
    // HP-1550-04: in the resize tool the wall handles own the geometry — a door
    // in the middle of a wall must neither swallow the handle nor start its own
    // drag (it travels with the wall through the resize pipeline instead)
    if (this._tool === 'resize') return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      capturePointer(ev);
    } catch {
      /* an inactive pointerId (synthetic events, some browsers) must not kill the drag */
    }
    this._opDrag = {
      id: o.id, moved: false, sx: ev.clientX, sy: ev.clientY, dirty: false,
      before: this._geometrySnapshot(),
    };
  }

  private _opPointerMove(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._opDrag || this._opDrag.id !== o.id) return;
    // audit L4: the other drag pipelines require 3 px before calling it a drag.
    // Without it every tap counted as a drag: the properties dialog never
    // opened and an unchanged config was written (which then broadcast the
    // event behind the L2 data loss).
    if (Math.abs(ev.clientX - this._opDrag.sx) + Math.abs(ev.clientY - this._opDrag.sy) <= 3) return;
    const raw = this._svgPoint(ev);
    const snap = snapToWall(raw, this._spaceModel().rooms, this._gridPitch * 4);
    if (!snap) return; // too far from any wall: the opening stays where it was
    this._opDrag.moved = true;
    const sp = this._curSpaceCfg;
    const cfg = sp?.openings?.find((x: OpeningCfg) => x.id === o.id);
    if (!cfg) return;
    // ruler badges on both shoulders + soft magnet to the wall's center
    // (owner 2026-08-03) — the very same helper the PLACEMENT preview uses
    const r = this._opRuler(snap, cfg.length * NORM_W);
    this._opMeasure = r.measure;
    const nx = r.x / NORM_W;
    const ny = r.y / this._spaceH;
    if (cfg.x !== nx || cfg.y !== ny || cfg.angle !== snap.angle) this._opDrag.dirty = true;
    cfg.x = nx;
    cfg.y = ny;
    cfg.angle = snap.angle;
    this.requestUpdate();
  }

  /**
   * Shoulder rulers + the soft centre magnet for an opening of `rlen` sitting
   * at a wall snap. ONE implementation for both gestures the owner asked to
   * behave alike (2026-08-03): dragging an existing opening and placing a new
   * one. `tol` is half a grid step; the centre magnet and along-wall grid step
   * are mandatory. The returned
   * x/y are ALREADY magnetised, so the caller just writes them.
   */
  private _opRuler(
    snap: { x: number; y: number; angle: number },
    rlen: number,
  ): { x: number; y: number; angle: number; measure: OpMeasure | null } {
    const rooms = this._spaceModel().rooms;
    const tol = this._gridPitch / 2;
    let cx = snap.x, cy = snap.y;
    let sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol);
    if (sh && sh.centered && (cx !== sh.wallCenter[0] || cy !== sh.wallCenter[1])) {
      [cx, cy] = sh.wallCenter;
      sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol);
    } else if (sh) {
      // Not centred: quantise the offset ALONG the wall to the grid step
      // (docs/CANVAS.md §9.3). Grid-BOUND would lift the opening off a diagonal
      // wall, so the wall stays the master and the grid only says WHERE on it.
      // The magnet is consulted first on purpose — a wall whose middle is not a
      // node must still be able to hold a centred window.
      const [ax, ay] = sh.wallA, [bx, by] = sh.wallB;
      const wx = bx - ax, wy = by - ay;
      const len = Math.hypot(wx, wy);
      if (len > 0) {
        const g = this._gridPitch;
        const half = Math.min(rlen / 2, len / 2);
        let along = Math.round((((cx - ax) * wx + (cy - ay) * wy) / len) / g) * g;
        along = Math.max(half, Math.min(len - half, along));
        cx = ax + (along / len) * wx;
        cy = ay + (along / len) * wy;
        sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol) || sh;
      }
    }
    if (!sh) return { x: cx, y: cy, angle: snap.angle, measure: null };
    const imperial = this.hass?.config?.unit_system?.length === 'mi';
    const lbl = (d: number, m: number[]) =>
      ({ x: m[0], y: m[1], text: formatLength((d / this._gridPitch) * this._cellCm, imperial) });
    return {
      x: cx, y: cy, angle: snap.angle,
      measure: {
        labels: [lbl(sh.sideA, sh.midA), lbl(sh.sideB, sh.midB)],
        guide: sh.centered
          ? { x: sh.wallCenter[0], y: sh.wallCenter[1], angle: snap.angle }
          : null,
      },
    };
  }

  private _opPointerUp(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._opDrag || this._opDrag.id !== o.id) return;
    const drag = this._opDrag;
    const moved = drag.moved;
    this._opMeasure = null; // badges and the center tick live only through the drag
    // only write when the geometry actually changed (audit L4)
    if (moved && drag.dirty) {
      this._recordGeometry(this._t('history.move_opening'), drag.before);
      this._saveConfig();
    }
    // keep the flag until the click event that follows pointerup, then let it go
    if (moved) window.setTimeout(() => (this._opDrag = null), 0);
    else this._opDrag = null;
  }

  /** Click: the status card (delayed so a double click can cancel it). */
  private _opClick(ev: MouseEvent, o: OpeningCfg & { rx: number; ry: number; rlen: number }): void {
    // HP-1550-04: in the resize tool a click over an opening falls through to
    // the stage (room picking) instead of opening the editor dialog
    if (this._mode === 'plan' && this._tool === 'resize') return;
    ev.stopPropagation();
    if (this._opDrag?.moved) return; // that click was the tail of a drag
    // openings are inert outside Plan mode (owner's decision: View must not
    // interact with them at all); in Plan any click on an opening edits it
    if (this._mode === 'plan') this._editOpening(o);
  }

  private _saveOpening(): void {
    const d = this._openingDialog;
    const sp = this._curSpaceCfg;
    if (!d || !sp) return;
    const before = this._geometrySnapshot();
    const H = this._spaceH;
    const o: OpeningCfg = {
      id: d.id || 'o' + Date.now().toString(36),
      type: d.type,
      x: d.x / NORM_W,
      y: d.y / H,
      angle: d.angle,
      length: this._cmToUnits(Math.max(20, d.lengthCm)) / NORM_W,
      contact: d.contact || null,
      lock: d.type !== 'window' ? d.lock || null : null,
      invert: d.invert || undefined,
      flip_h: d.type !== 'gate' && d.flipH || undefined,
      flip_v: d.flipV || undefined,
    };
    sp.openings = sp.openings || [];
    const i = sp.openings.findIndex((x: OpeningCfg) => x.id === o.id);
    if (i >= 0) sp.openings[i] = o;
    else sp.openings.push(o);
    this._recordGeometry(this._t(d.id ? 'history.edit_opening' : 'history.add_opening'), before);
    this._saveConfig();
    this._openingDialog = null;
    this.requestUpdate();
  }

  private _deleteOpening(): void {
    const d = this._openingDialog;
    const sp = this._curSpaceCfg;
    if (!d?.id || !sp?.openings) return;
    const before = this._geometrySnapshot();
    sp.openings = sp.openings.filter((x: OpeningCfg) => x.id !== d.id);
    this._recordGeometry(this._t('history.delete_opening'), before);
    this._saveConfig();
    this._openingDialog = null;
    this.requestUpdate();
  }

  /** Contact-sensor candidates: door/window/gate-like classes first, then the rest. */
  private _contactCandidates(): { value: string; label: string }[] {
    const out: [string, string, number][] = [];
    for (const eid of Object.keys(this.hass.states)) {
      if (!this._planEntityAvailable(eid)) continue;
      const dom = eid.split('.')[0];
      if (dom !== 'binary_sensor' && dom !== 'cover') continue;
      const st = this.hass.states[eid];
      const dc = st?.attributes?.device_class || '';
      const doorish = ['door', 'window', 'opening', 'garage_door', 'garage'].includes(dc);
      if (dom === 'cover' && !doorish) continue;
      out.push([eid, st?.attributes?.friendly_name || eid, doorish ? 0 : 1]);
    }
    return out
      .sort((a, b) => a[2] - b[2] || a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }

  private _lockCandidates(): { value: string; label: string }[] {
    return Object.keys(this.hass.states)
      .filter((eid) => eid.startsWith('lock.') && this._planEntityAvailable(eid))
      .map((eid) => ({ value: eid, label: this.hass.states[eid]?.attributes?.friendly_name || eid }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Merge: first click picks a room, second picks the room to merge it with. */
  private _mergeClick(raw: number[]): void {
    const rooms = this._spaceModel().rooms;
    const hit = [...rooms].reverse().find((r) => this._pointInRoom(raw, r));
    if (!hit?.id) return;
    const hitId = hit.id;
    if (!this._mergeSel || this._mergeSel === hitId) {
      this._mergeSel = this._mergeSel === hitId ? null : hitId; // click again = deselect
      return;
    }
    const a = rooms.find((r) => r.id === this._mergeSel);
    const pa = a ? roomPoly(a) : null;
    const pb = roomPoly(hit);
    const merged = pa && pb ? mergeRooms(pa, pb) : null;
    if (!merged) {
      // only rooms sharing a wall collapse into one outline (see mergeRooms)
      this._showToast(this._t('toast.merge_not_adjacent'));
      this._mergeSel = null;
      return;
    }
    this._mergeDialog = { aId: this._mergeSel, bId: hitId, poly: merged, pick: 'a' };
    this._mergeSel = null;
  }

  private _commitMerge(): void {
    const d = this._mergeDialog;
    const sp = this._curSpaceCfg;
    if (!d || !sp) return;
    const before = this._geometrySnapshot();
    const H = this._spaceH;
    const keepId = d.pick === 'a' ? d.aId : d.bId;
    const dropId = d.pick === 'a' ? d.bId : d.aId;
    const keep = sp.rooms.find((r: any) => r.id === keepId);
    if (!keep) {
      this._mergeDialog = null;
      return;
    }
    // the kept room keeps its id, so its label position and devices stay put
    keep.poly = d.poly.map((p) => [p[0] / NORM_W, p[1] / H]);
    delete keep.x; delete keep.y; delete keep.w; delete keep.h; // a merged room is never a rect
    sp.rooms = sp.rooms.filter((r: any) => r.id !== dropId);
    this._commitOpenSpans();
    this._recordGeometry(this._t('history.merge_rooms'), before);
    this._saveConfig();
    this._mergeDialog = null;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._showToast(this._t('toast.rooms_merged', { name: keep.name || '' }));
  }

  /** Split: click the room, then two points on its walls. */
  private _splitClick(raw: number[]): void {
    const rooms = this._spaceModel().rooms;
    if (!this._splitSel) {
      const hit = [...rooms].reverse().find((r) => this._pointInRoom(raw, r));
      if (!hit?.id) return;
      this._splitSel = { roomId: hit.id, pts: [] };
      return;
    }
    const room = rooms.find((r) => r.id === this._splitSel!.roomId);
    const poly = room ? roomPoly(room) : null;
    if (!room || !poly) {
      this._splitSel = null;
      return;
    }
    // A split point lands on the room's nearest wall — the user aims at a wall,
    // and rooms need not be grid-aligned (imported/legacy polygons), so snapping
    // to the grid would miss the outline. The pull is capped: a click far from
    // any wall (e.g. an accidental one in the middle of the room) is a miss and
    // gets the toast, not a wall the user never meant. splitRoom() still rejects
    // any cut that is not a clean wall-to-wall chord.
    // …and it is still QUANTISED: the offset ALONG the wall moves in whole grid
    // steps (docs/CANVAS.md §9), which on the axis-aligned, grid-drawn walls the
    // editor itself makes IS a grid node. There is no free-position bypass.
    const eps = this._gridPitch * 0.02;
    const pull = this._gridPitch * 6; // ≈2.5% of the plan width — generous but intentional
    const raw0 = closestPointOnBoundary(raw, poly);
    const near = raw0 ? (snapPointAlongPoly(raw0, poly, this._gridPitch) || raw0) : raw0;
    const wallPt = raw0 && near && Math.hypot(raw0[0] - raw[0], raw0[1] - raw[1]) <= pull ? near : null;
    const onWall = !!wallPt && pointOnBoundary(wallPt, poly, eps);
    const cur = this._splitSel.pts;
    if (!cur.length) {
      // the cut starts on a wall
      if (!onWall) {
        this._showToast(this._t('toast.split_pick_wall'));
        return;
      }
      this._splitSel = { ...this._splitSel, pts: [wallPt!] };
      return;
    }
    if (!onWall) {
      // an interior click adds an intermediate vertex of the cut path
      const mid = this._snap(raw);
      if (!ptInside(mid, poly, eps)) {
        this._showToast(this._t('toast.split_pick_inside'));
        return;
      }
      this._splitSel = { ...this._splitSel, pts: [...cur, mid] };
      return;
    }
    // a wall point finishes the cut
    const parts = splitRoomPath(poly, [...cur, wallPt!], eps);
    if (!parts) {
      this._showToast(this._t('toast.split_bad_cut'));
      return;
    }
    this._resetRoomDialogFields();
    // the bigger part stays the room it was — name, area and devices go with it
    const [p1, p2] = parts;
    const main = polygonArea(p1) >= polygonArea(p2) ? p1 : p2;
    const fresh = main === p1 ? p2 : p1;
    this._pendingSplit = { roomId: room.id!, mainPoly: main, newPoly: fresh };
    this._cursorPt = null;
    this._nameSel = '';
    this._areaSel = '';
    this._roomDialog = true;
  }

  private get _contourClosed(): boolean {
    return this._path.length >= 4 && this._samePt(this._path[0], this._path[this._path.length - 1]);
  }

  private _markupMove(ev: MouseEvent): void {
    if (!this._markup) return;
    const pointerType = (ev as PointerEvent).pointerType;
    if (pointerType) this._boundaryPointerType = pointerType;
    if (this._tool === 'column') {
      this._cursorPt = this._snap(this._svgPoint(ev));
      return;
    }
    if (this._tool === 'opening' || this._tool === 'boundary' || this._tool === 'wallthick') {
      // hover preview: raw cursor point; snapping happens in the preview getters
      this._cursorPt = this._svgPoint(ev);
      return;
    }
    const drawing = (this._tool === 'draw' || this._tool === 'partition')
      && this._path.length && !this._contourClosed;
    const cutting = this._tool === 'split' && !!this._splitSel?.pts?.length;
    if (!drawing && !cutting) return;
    const raw = this._svgPoint(ev);
    this._cursorPt = drawing
      ? this._snapDrawPoint(raw, ev.shiftKey)
      : this._snap(raw);
  }

  /**
   * Dashed hover preview of an opening: same snap, same default length and —
   * since 2026-08-03 — the same shoulder rulers and centre magnet as a drag.
   * Pure: it writes nothing, the render just reads it.
   */
  private get _openingPreview():
    { x: number; y: number; angle: number; rlen: number; measure: OpMeasure | null } | null {
    if (this._tool !== 'opening' || !this._cursorPt) return null;
    const raw = this._cursorPt;
    // an existing opening under the cursor will be edited, not added — no preview
    const eps = this._gridPitch * 1.5;
    const hit = this._openingsR.find(
      (o) => Math.hypot(raw[0] - o.rx, raw[1] - o.ry) <= Math.max(o.rlen / 2, eps),
    );
    if (hit) return null;
    const rlen = this._cmToUnits(OPENING_DEFAULT_CM);
    const snap = snapToWall(raw, this._spaceModel().rooms, eps);
    if (!snap) return null;
    const r = this._opRuler(snap, rlen);
    return { x: r.x, y: r.y, angle: r.angle, rlen, measure: r.measure };
  }

  /** The rulers to draw right now: from the DRAG of an existing opening, or
   *  from the PLACEMENT preview of a new one — identical badges either way. */
  private get _opMeasureView(): OpMeasure | null {
    return this._opMeasure || this._openingPreview?.measure || null;
  }

  /** Save a room with an optional HA-area binding.
   *  An area supplies the fallback name; a room without one needs a name. */
  private _saveRoom(): void {
    if (!this._areaSel && !this._nameSel.trim()) return;
    this._commitRoom();
  }

  private _commitRoom(): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const before = this._geometrySnapshot();
    const H = this._spaceH;
    const wasSplit = !!this._pendingSplit;
    let verts: number[][];
    if (this._pendingSplit) {
      // apply the cut now: the bigger part keeps the original room, this dialog names the rest
      const main = sp.rooms.find((r: any) => r.id === this._pendingSplit!.roomId);
      if (!main) {
        this._pendingSplit = null;
        this._splitSel = null;
        this._roomDialog = false;
        return;
      }
      main.poly = this._pendingSplit.mainPoly.map((p) => [p[0] / NORM_W, p[1] / H]);
      delete main.x; delete main.y; delete main.w; delete main.h;
      verts = this._pendingSplit.newPoly;
    } else {
      if (!this._contourClosed) return;
      verts = this._path.slice(0, -1); // without the duplicated closing vertex
    }
    const areaName = this._areaSel ? this.hass.areas[this._areaSel]?.name : '';
    const newRoom = {
      id: 'r' + Date.now().toString(36),
      name: this._nameSel || areaName || this._t('room.default_name'),
      area: this._areaSel || null,
      poly: verts.map((p) => [p[0] / NORM_W, p[1] / H]),
      ...(this._roomSettingsFromDialog() ? { settings: this._roomSettingsFromDialog() } : {}),
    };
    sp.rooms.push(newRoom);
    // Closing a saved draft promotes it into a room in the same transaction.
    if (!wasSplit && this._activeDraftId && Array.isArray((sp as any).room_drafts)) {
      (sp as any).room_drafts = (sp as any).room_drafts.filter((d: any) => d.id !== this._activeDraftId);
      if (!(sp as any).room_drafts.length) delete (sp as any).room_drafts;
    }
    // A Split rewrites the parent outline and adds a child, so a span that used
    // to sit between the parent and a neighbour may now belong to the child.
    // Geometry first, then spans and the derived open_to — otherwise border
    // trimming reads the new geometry while glow reads the old connectivity
    // (AUD-159B6-02).
    if (wasSplit) this._commitOpenSpans();
    // Draw-session wall thickness: apply to new edges only; keep neighbour cm
    // on shared stretches. Split naming does not use the Draw field.
    if (!wasSplit) {
      const edgeCms = [...this._draftSegmentCms, this._closingWallCm || this._drawWallCm || DRAW_WALL_DEFAULT_CM];
      const cm = edgeCms[0] || this._drawWallCm;
      if (cm != null) {
        this._cfgEpoch++; // the new room must be in the model before keying
        const openCuts = this._openCuts();
        let next = applyWallThicknessToNewRoom(
          sp.walls, this._spaceModel().rooms, newRoom.id, cm,
          this._wallKeyPitch, openCuts, NORM_W,
        );
        // The room may have been drawn while the toolbar thickness changed.
        // Shared stretches keep the already-existing physical wall; every
        // outer atomic stretch receives the value of its source draft edge.
        for (const iv of wallIntervals(
          this._spaceModel().rooms, next, openCuts,
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        )) {
          if (iv.roomId !== newRoom.id || iv.kind !== 'outer') continue;
          const mid = [(iv.a[0] + iv.b[0]) / 2, (iv.a[1] + iv.b[1]) / 2];
          const source = verts.findIndex((a, i) => {
            const b = verts[(i + 1) % verts.length];
            return distToSegment(mid, [a[0], a[1], b[0], b[1]]) <= this._gridPitch * 0.02;
          });
          if (source >= 0) next = setWallThickness(
            next, iv.a, iv.b, edgeCms[source] || cm,
            this._wallKeyPitch, NORM_W,
          );
        }
        next = this._normalizeWalls(next, openCuts);
        if (next.length) sp.walls = next;
        else delete sp.walls;
      }
    }
    this._recordGeometry(this._t(wasSplit ? 'history.split_room' : 'history.add_room'), before);
    this._saveConfig();
    this._path = [];
    delete this._resumeDraftBySpace[this._space];
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._pendingSplit = null;
    this._splitSel = null;
    const boundArea = this._areaSel;
    this._areaSel = '';
    this._nameSel = '';
    this._roomDialog = false;
    this._regSignature = '';
    this._maybeRebuildDevices();
    // auto-add the area's device icons + PIN their positions in the layout,
    // so that icons do not get reshuffled when the order in the HA registry changes.
    let added = 0;
    if (boundArea) {
      const H2 = NORM_W;
      const next = { ...this._layout };
      for (const d of this._devices) {
        if (d.area !== boundArea || d.space !== this._space) continue;
        added++;
        if (this._layout[d.id]) continue; // placed manually — leave it alone
        const dp = this._defPos[d.id];
        if (!dp) continue;
        next[d.id] = { s: this._space, x: dp.x / NORM_W, y: dp.y / H2 };
        this._dirtyPos.add(d.id);
      }
      this._layout = next;
      this._persistLayout();
    }
    const roomsN = this._model.find((s) => s.id === this._space)?.rooms.length || 0;
    this._showToast(
      boundArea
        ? this._t('toast.room_saved', { n: roomsN, added })
        : this._t('toast.room_saved_no_area', { n: roomsN }),
    );
  }

  private _cancelPath(): void {
    if (this._activeDraftId) this._resumeDraftBySpace[this._space] = this._activeDraftId;
    this._path = [];
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
    this._cursorPt = null;
    this._roomDialog = false;
    this._pendingSplit = null;
    this._splitSel = null;
    this._mergeSel = null;
    this._mergeDialog = null;
    this._openWallAnchor = null;
    this._boundaryRestoreGuard = null;
    this._physicalSel = null;
    this._physicalDrag = null;
    this._physicalRotate = null;
  }

  private _resumeLastDraft(): void {
    const id = this._resumeDraftBySpace[this._space];
    if (!id) return;
    const draft = this._spaceModel().room_drafts.find((d) => d.id === id);
    if (!draft) { delete this._resumeDraftBySpace[this._space]; return; }
    this._activeDraftId = id;
    this._path = draft.points.map((p) => [...p]);
    this._draftSegmentCms = draft.segments.map((s) => s.cm);
    this._cursorPt = null;
  }

  /** Cancel in the dialog: the outline is open again (the closing point is removed). */
  private _roomDialogCancel(): void {
    this._roomDialog = false;
    if (this._roomEditId) {
      this._roomEditId = null;
      this._nameSel = '';
      this._areaSel = '';
      return;
    }
    if (this._pendingSplit) {
      // nothing was applied yet — drop the cut entirely, the room stays whole
      this._pendingSplit = null;
      this._splitSel = null;
      return;
    }
    this._undoPoint();
  }

  /** HA areas not yet assigned to any room in the config. */
  private get _freeAreas(): any[] {
    const used = new Set<string>();
    for (const sp of this._serverCfg?.spaces || [])
      for (const r of sp.rooms || []) if (r.area) used.add(r.area);
    return Object.values<any>(this.hass?.areas || {})
      .filter((a) => !used.has(a.area_id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  // ================= DEVICE EDITOR (markers) =================

  private _openMarkerDialog(d?: DevItem): void {
    if (d) this._ackNewDevice(d.id);
    if (!this._norm) {
      this._showToast(this._t('toast.marker_needs_server'));
      return;
    }
    if (d) {
      this._markerDialog = {
        devId: d.id,
        name: d.name,
        binding: d.bindingKind === 'virtual' ? 'virtual' : d.bindingKind + ':' + d.bindingRef,
        bindingMode: d.bindingKind === 'virtual' ? 'virtual' : 'ha',
        bindingOpen: false,
        // a marker bound to an ENTITY of a device only shows up with the box on
        showEntities: d.bindingKind === 'entity' && !!this._fullRegistryHass.entities[d.bindingRef || '']?.device_id,
        bindingFilter: '',
        icon: d.marker?.icon || '',
        autoIcon: d.icon || '',
        display: d.marker?.display === 'ripple' ? 'icon_ripple' : d.marker?.display || 'badge',
        rippleColor: d.marker?.ripple_color || '',
        rippleSize: Number(d.marker?.ripple_size) > 0 ? Number(d.marker!.ripple_size) : 3,
        size: Number(d.marker?.size) > 0 ? Number(d.marker!.size) : 1,
        angle: Number(d.marker?.angle) || 0,
        tapAction: d.marker?.tap_action || '',
        tapTarget: d.marker?.tap_target || '',
        tapConfirm: d.marker?.tap_confirm === true,
        runFilter: '',
        defaultTap: d.primary?.split('.')[0] === 'light' ? 'toggle' : 'info',
        // Keep unknown, temporarily inactive and duplicate external targets
        // byte-for-byte across Open → Save. Runtime uses the filtered
        // effective projection; a legacy self-reference becomes isLight.
        controls: persistedExternalControls(d.marker?.binding, d.marker?.controls, d.entities),
        controlsFilter: '',
        isLight: d.marker?.is_light === true || hasLegacySelfLightIntent(
          d.marker?.binding, d.marker?.controls, d.entities,
        ),
        useClimateTemp: d.marker?.use_climate_temp === true,
        glowRadius: Number(d.marker?.glow_radius_cm) > 0
          ? String(this._imperial
              ? Math.round((Number(d.marker!.glow_radius_cm) / 30.48) * 10) / 10
              : Math.round(Number(d.marker!.glow_radius_cm)) / 100)
          : '',
        model: d.model || '',
        link: d.link || '',
        description: d.description || '',
        pdfs: [...(d.pdfs || [])],
        room: d.marker?.room_id
          ? d.space + '#@' + d.marker.room_id
          : d.space && d.area ? d.space + '#' + d.area : '',
        hideFromPlan: d.marker?.hidden === true,
        busy: false,
      };
    } else {
      this._markerDialog = {
        name: '', binding: 'virtual', bindingMode: 'virtual', bindingOpen: false,
        showEntities: false, bindingFilter: '', icon: '', autoIcon: '',
        display: 'badge', rippleColor: '', rippleSize: 3, size: 1, angle: 0,
        tapAction: '', tapTarget: '', tapConfirm: false, runFilter: '',
        defaultTap: 'info', controls: [], controlsFilter: '', isLight: false,
        useClimateTemp: false, glowRadius: '', model: '',
        link: '', description: '', pdfs: [], room: '', hideFromPlan: false, busy: false,
        uploadId: 'up_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      };
    }
  }

  /** Runnable targets for the 'run' tap action: automations, scripts, scenes. */
  private _runCandidates(): { value: string; label: string; sub: string }[] {
    const out: { value: string; label: string; sub: string }[] = [];
    for (const dom of RUN_TARGET_DOMAINS) {
      for (const [eid, st] of Object.entries<any>(this.hass.states)) {
        if (!eid.startsWith(dom + '.')) continue;
        if (!this._planEntityAvailable(eid)) continue;
        out.push({
          value: eid,
          label: st?.attributes?.friendly_name || eid,
          sub: this._t(('run.' + dom) as any),
        });
      }
    }
    return out.sort((a, b) => a.sub.localeCompare(b.sub) || a.label.localeCompare(b.label));
  }

  /** Binding candidates: HA devices + group/helper entities, minus the ones already placed. */
  private _bindingCandidates(): { value: string; label: string; sub: string }[] {
    const h = this._planHass;
    const removed = removedPlanBindings(this._markers);
    const removedBindings = new Set(
      this._markers.filter((m) => m.removed).map((m) => m.binding),
    );
    const taken = new Set<string>();
    for (const dev of this._devices) {
      if (dev.id === this._markerDialog?.devId) continue;
      if (dev.bindingKind === 'device' && dev.bindingRef) taken.add('device:' + dev.bindingRef);
      if (dev.bindingKind === 'entity' && dev.bindingRef) taken.add('entity:' + dev.bindingRef);
    }
    // dedup as on the plan: hide devices with the same “name|area” as already shown ones (Tuya duplicates)
    const shownKeys = new Set<string>();
    for (const dev of this._devices) {
      if (dev.bindingKind === 'device' && dev.name) shownKeys.add(dev.name.trim() + '|' + (dev.area || ''));
    }
    const list: { value: string; label: string; sub: string }[] = [];
    // devices (incl. Z2M groups with model=Group)
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.entry_type === 'service') continue;
      const v = 'device:' + dev.id;
      if (taken.has(v)) continue;
      const name = (dev.name_by_user || dev.name || dev.id).trim();
      if (v !== this._markerDialog?.binding && !removedBindings.has(v)
          && shownKeys.has(name + '|' + (dev.area_id || ''))) continue;
      list.push({ value: v, label: name, sub: (dev.model || this._t('marker.sub_device')) + (dev.model === 'Group' ? this._t('marker.sub_z2m_group') : '') });
    }
    // group/helper entities without a physical device of their own
    const helperPlatforms = new Set([
      'group', 'template', 'derivative', 'min_max', 'threshold', 'integration',
      'statistics', 'trend', 'utility_meter', 'tod', 'switch_as_x', 'schedule',
    ]);
    for (const [eid, reg] of Object.entries<any>(h.entities)) {
      const v = 'entity:' + eid;
      if (taken.has(v)) continue;
      if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(v)) continue;
      const isHelper = helperPlatforms.has(reg.platform);
      const isGroupEntity = reg.platform === 'group';
      if (!isHelper && !isGroupEntity) continue;
      if (reg.hidden && !removedBindings.has(v)) continue;
      const st = h.states[eid];
      list.push({
        value: v,
        label: reg.name || st?.attributes?.friendly_name || eid,
        sub: eid.split('.')[0] + ' · ' + (reg.platform === 'group' ? this._t('marker.sub_group') : this._t('marker.sub_helper')),
      });
    }
    // Individual entities of devices — behind the "show entities" checkbox
    // (groups/helpers above are ALWAYS listed: they are standalone objects).
    if (this._markerDialog?.showEntities) {
      const seen = new Set(list.map((o) => o.value));
      for (const [eid, reg] of Object.entries<any>(h.entities)) {
        const v = 'entity:' + eid;
        if (taken.has(v) || seen.has(v) || (reg.hidden && !removedBindings.has(v))) continue;
        if (isRemovedPlanEntity(h, eid, removed) && !removedBindings.has(v)) continue;
        const stt = h.states[eid];
        const label = reg.name || stt?.attributes?.friendly_name || eid;
        const dev = reg.device_id ? h.devices[reg.device_id] : null;
        const devName = dev ? (dev.name_by_user || dev.name || '') : '';
        list.push({ value: v, label, sub: eid.split('.')[0] + ' · ' + this._t('marker.sub_entity') + (devName ? ' · ' + devName : '') });
      }
    }
    const f = (this._markerDialog?.bindingFilter || '').toLowerCase().trim();
    const filtered = f
      ? list.filter((o) => (o.label + ' ' + o.sub + ' ' + o.value).toLowerCase().includes(f))
      : list;
    filtered.sort((a, b) => a.label.localeCompare(b.label));
    return filtered.slice(0, 200);
  }

  /** A closed outline may intentionally remain a set of independent walls. */
  private _keepClosedAsPartitions = (): void => {
    if (!this._contourClosed || this._pendingSplit || !this._curSpaceCfg) return;
    const sp = this._curSpaceCfg as any;
    const verts = this._path.slice(0, -1);
    if ((sp.partitions || []).length + verts.length > MAX_PARTITIONS) {
      this._showToast(this._t('toast.physical_limit'));
      return;
    }
    const before = this._geometrySnapshot();
    const cms = [...this._draftSegmentCms,
      this._closingWallCm || this._drawWallCm || DRAW_WALL_DEFAULT_CM];
    sp.partitions ||= [];
    const seed = Date.now().toString(36);
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      sp.partitions.push({
        id: `partition-${seed}-${i}`,
        a: [a[0] / NORM_W, a[1] / NORM_W],
        b: [b[0] / NORM_W, b[1] / NORM_W],
        cm: cms[i] || DRAW_WALL_DEFAULT_CM,
      });
    }
    if (this._activeDraftId && Array.isArray(sp.room_drafts)) {
      sp.room_drafts = sp.room_drafts.filter((d: any) => d.id !== this._activeDraftId);
      if (!sp.room_drafts.length) delete sp.room_drafts;
    }
    this._recordGeometry(this._t('history.contour_to_partitions'), before);
    this._saveConfig();
    this._roomDialog = false;
    this._path = [];
    delete this._resumeDraftBySpace[this._space];
    this._activeDraftId = null;
    this._draftSegmentCms = [];
    this._closingWallCm = null;
  };

  /** All independent physical bodies in render units. Physics intentionally
   * does not depend on show_borders. */
  private _physicalBodiesR(space = this._spaceModel()): number[][][] {
    const key = `${space.id}|${this._cfgEpoch}|${this._cellCm}|${this._gridPitch}`;
    if (this._physicalBodiesCache?.key === key) return this._physicalBodiesCache.all;
    const drafts = (space.room_drafts || []).flatMap((d) =>
      draftBodies(d, this._cellCm, this._gridPitch));
    const partitions = (space.partitions || []).flatMap((p) => {
      const body = partitionBody(p.a, p.b, p.cm, this._cellCm, this._gridPitch);
      return body ? [body] : [];
    });
    const columns = (space.wall_columns || []).map((c) =>
      columnBody(c, this._cellCm, this._gridPitch));
    const all = [...drafts, ...partitions, ...columns];
    this._physicalBodiesCache = { key, drafts, partitions, columns, all };
    return all;
  }

  /** Cached clean floor. A cheap bbox pass is the spatial index needed for
   * rooms which touch only a small subset of independent bodies. */
  private _cleanFloor(
    room: RoomCfg, floor: number[][], space = this._spaceModel(),
  ): { floor: number[][]; geom: any; path: string; area: number } {
    const roomKey = room.id || `#${space.rooms.indexOf(room)}`;
    const key = `${space.id}|${this._cfgEpoch}|${roomKey}`;
    if (!this._rszPreview) {
      const cached = lruRead(this._cleanFloorCache, key);
      if (cached.hit) return cached.value;
    }
    const xs = floor.map((p) => p[0]), ys = floor.map((p) => p[1]);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const candidates = this._physicalBodiesR(space).filter((body) => {
      const bx = body.map((p) => p[0]), by = body.map((p) => p[1]);
      return Math.max(...bx) >= box[0] && Math.min(...bx) <= box[2]
        && Math.max(...by) >= box[1] && Math.min(...by) <= box[3];
    });
    const geom = candidates.length ? floorMinusBodies(floor, candidates) : null;
    const result = {
      floor,
      geom,
      path: geom ? polyclipPathD(geom) : '',
      area: geom ? geometryArea(geom) : geometryArea([[[...floor, floor[0]]]]),
    };
    if (!this._rszPreview) {
      lruWrite(this._cleanFloorCache, key, result, 600);
    }
    return result;
  }

  /** Effective auto icon for a binding selected but not saved yet. */
  private _autoIconForBinding(binding: string): string {
    if (binding === 'virtual') return 'mdi:map-marker';
    const [kind, ref] = binding.split(':');
    if (!ref) return '';
    const h = this._fullRegistryHass;
    const status = this._bindingStatus(binding);
    const activeEntities = status.kind === 'active' ? status.enabledEntityIds : status.allEntityIds;
    if (kind === 'device') {
      const dev = h.devices?.[ref];
      if (!dev) return 'mdi:help-circle';
      const entities = activeEntities;
      if (entities.some((eid) => eid.startsWith('lock.'))) return 'mdi:lock';
      return resolveIcon(
        h, dev.name_by_user || dev.name || '', dev.model, entities, this._iconRules,
      );
    }
    if (kind === 'entity') {
      const reg = h.entities?.[ref];
      const state = this.hass.states?.[ref];
      const name = reg?.name || state?.attributes?.friendly_name || ref;
      return ref.startsWith('lock.')
        ? 'mdi:lock'
        : resolveIcon(h, name, '', [ref], this._iconRules);
    }
    return '';
  }

  /** List of rooms across all spaces for a virtual device. */
  private _allRoomsFlat(): { value: string; label: string }[] {
    const res: { value: string; label: string }[] = [];
    for (const sp of this._serverCfg?.spaces || []) {
      for (const r of sp.rooms || []) {
        if (r.area) {
          res.push({ value: sp.id + '#' + r.area, label: (sp.title || sp.id) + ' · ' + r.name });
        } else if (r.id) {
          // sub-area room (no HA area): manual placement by room id — issue #3
          res.push({
            value: sp.id + '#@' + r.id,
            label: (sp.title || sp.id) + ' · ' + r.name + ' · ' + this._t('marker.subarea'),
          });
        }
      }
    }
    return res;
  }

  /** Readable error text (never “[object Object]”). */
  private _errText(e: any): string {
    if (!e) return this._t('err.unknown');
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    if (e.error) return e.error;
    if (e.code != null) return this._t('err.code', { code: e.code });
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  /**
   * Manual files are uploaded via HTTP (multipart) — not via WebSocket, whose message size
   * limit breaks the connection on large PDFs.
   */
  private async _pickMarkerFiles(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = input.files ? [...input.files] : [];
    input.value = '';
    if (!files.length || !this._markerDialog) return;
    const mid = this._markerDialog.uploadId || this._markerDialog.devId || 'new';
    const uploaded: PdfRef[] = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('marker_id', mid);
        fd.append('file', file, file.name);
        // fetchWithAuth refreshes a stale access_token itself; the fallback is the raw token
        const resp: Response = this.hass?.fetchWithAuth
          ? await this.hass.fetchWithAuth('/api/houseplan/upload', { method: 'POST', body: fd })
          : await fetch('/api/houseplan/upload', {
              method: 'POST',
              body: fd,
              headers: this.hass?.auth?.data?.access_token
                ? { authorization: `Bearer ${this.hass.auth.data.access_token}` }
                : {},
            });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.error) {
          const map: Record<string, string> = {
            too_large: this._t('err.too_large', { mb: json.max_mb || 50 }),
            bad_ext: this._t('err.bad_ext'),
            unauthorized: this._t('err.unauthorized'),
          };
          throw new Error(map[json.error] || json.error || 'HTTP ' + resp.status);
        }
        uploaded.push({ name: json.name || file.name, url: json.url });
      } catch (e: any) {
        this._showToast(this._t('toast.file_failed', { name: file.name, err: this._errText(e) }));
      }
    }
    // the dialog might have closed during the upload — add only if it is still open
    if (uploaded.length && this._markerDialog) {
      this._markerDialog = { ...this._markerDialog, pdfs: [...this._markerDialog.pdfs, ...uploaded] };
      this._showToast(this._t('toast.files_attached', { n: uploaded.length }));
    }
  }

  private _removeMarkerPdf(url: string): void {
    if (!this._markerDialog) return;
    this._markerDialog = {
      ...this._markerDialog,
      pdfs: this._markerDialog.pdfs.filter((p) => p.url !== url),
    };
  }

  private async _saveMarker(): Promise<void> {
    const dlg = this._markerDialog;
    if (!dlg || dlg.busy) return;
    if (dlg.bindingMode === 'ha' && (!dlg.binding || dlg.binding === 'virtual')) return;
    if (dlg.binding === 'virtual' && !dlg.name.trim()) {
      this._showToast(this._t('toast.virtual_name_required'));
      return;
    }
    if (dlg.tapAction === 'run' && !dlg.tapTarget) {
      this._showToast(this._t('toast.run_target_required'));
      return;
    }
    if (dlg.bindingMode === 'ha') {
      const status = this._bindingStatus(dlg.binding);
      const previous = dlg.devId
        ? this._markers.find((marker) => marker.id === dlg.devId) : null;
      const replacingWithInactive = !previous || previous.binding !== dlg.binding;
      if (status.kind !== 'active' && replacingWithInactive) {
        this._showToast(this._t(status.kind === 'ha_disabled'
          ? 'toast.ha_disabled_add' : 'toast.ha_binding_unverified'));
        return;
      }
      // Saving metadata for an already-disabled binding is allowed, but a
      // blocked Show attempt may never erase an older explicit user hidden.
      if (status.kind === 'ha_disabled' && previous?.hidden === true && !dlg.hideFromPlan) {
        this._markerDialog = { ...dlg, hideFromPlan: true };
        this._showToast(this._t(status.reason === 'entity'
          ? 'toast.ha_disabled_show_entity' : 'toast.ha_disabled_show_device'));
        return;
      }
    }
    this._markerDialog = { ...dlg, busy: true };
    try {
      const cfg = this._serverCfg!;
      cfg.markers = cfg.markers || [];
      // determine the marker id
      let id: string;
      // a manually chosen room overrides the space/area for any icon
      const roomRef = parseRoomRef(dlg.room);
      let space: string | null = roomRef?.space || null;
      let area: string | null = roomRef?.area || null;
      const roomId: string | null = roomRef?.roomId || null;
      if (dlg.binding === 'virtual' && !space) space = this._space;
      id = markerIdForBinding(dlg.binding, dlg.devId, () => 'v_' + Date.now().toString(36));
      const oldId = dlg.devId;
      const replacedRemovedIds = dlg.binding === 'virtual'
        ? []
        : cfg.markers
          .filter((m) => m.removed && m.binding === dlg.binding)
          .map((m) => m.id);
      const replacingRemoved = replacedRemovedIds.length > 0;
      const controls = persistedExternalControls(
        dlg.binding, dlg.controls, this._bindingEntities(dlg.binding),
      );
      // the vacuum block is edited live outside the dialog transaction —
      // the rebuild below must carry it over, not erase it
      const prevVac = cfg.markers.find((m0: Marker) => m0.id === id || m0.id === oldId)?.vacuum || null;
      const marker: Marker = {
        id,
        vacuum: prevVac,
        binding: dlg.binding,
        name: dlg.name.trim() || null,
        icon: dlg.icon || null,
        display: dlg.display !== 'badge' ? dlg.display : null,
        ripple_color: dlg.display === 'icon_ripple' && dlg.rippleColor ? dlg.rippleColor : null,
        ripple_size: dlg.display === 'icon_ripple' && dlg.rippleSize !== 3 ? dlg.rippleSize : null,
        size: dlg.size !== 1 ? dlg.size : null,
        angle: dlg.angle ? dlg.angle : null,
        tap_action: dlg.tapAction || null,
        tap_target: dlg.tapAction === 'run' ? dlg.tapTarget || null : null,
        tap_confirm: dlg.tapConfirm ? true : null,
        controls: controls.length ? controls : null,
        // pdfs may be rewritten below when rebinding changes the marker id
        is_light: dlg.isLight ? true : null,
        use_climate_temp: dlg.useClimateTemp ? true : null,
        glow_radius_cm: (() => {
          const v = strictNumber(dlg.glowRadius);
          if (v == null || v <= 0) return null;
          return Math.round(this._imperial ? v * 30.48 : v * 100);
        })(),
        model: dlg.model.trim() || null,
        link: dlg.link.trim() || null,
        description: dlg.description.trim() || null,
        pdfs: dlg.pdfs,
        // Explicit false, not absence: a marker of any kind is what tells the
        // seeder "the user decided" — unticking must not invite a re-hide
        // (docs/FILTERING.md).
        hidden: dlg.hideFromPlan ? true : false,
      };
      // save the room choice (always for virtual ones; for bound ones — if chosen)
      if (dlg.binding === 'virtual' || dlg.room) {
        marker.space = space;
        marker.area = area;
        marker.room_id = roomId;
      }
      // the room changed → move the icon to its center
      const prevDev = oldId ? this._devices.find((x) => x.id === oldId) : null;
      const prevRoomId = prevDev?.marker?.room_id ?? null;
      const roomChanged = !!dlg.room && prevDev != null
        && (prevDev.space !== space || prevDev.area !== area || prevRoomId !== roomId);
      // Rebinding changes the marker id, so the uploaded files must follow.
      // Order matters (review CR-2): COPY first, save the config, and only then
      // delete the old folder. If the save is rejected, the old urls in the
      // stored config still resolve — the files never left. A failed copy
      // leaves the urls untouched and tells the user (review CR-3).
      let cleanupOldFiles = false;
      // a new icon uploaded into its own staging folder; an edited one into its
      // own id. Either way the files move to the final id here.
      const fileSrc = dlg.uploadId || oldId;
      if (fileSrc && fileSrc !== id && marker.pdfs?.length) {
        try {
          const res: any = await this.hass.callWS({
            type: 'houseplan/files/migrate', from_id: fileSrc, to_id: id,
          });
          const mapping = res?.mapping || {};
          marker.pdfs = migratePdfUrls(marker.pdfs, fileSrc, id, mapping);
          cleanupOldFiles = Object.keys(mapping).length > 0;
        } catch (e: any) {
          this._showToast(this._t('toast.files_migrate_failed', { err: this._errText(e) }));
        }
      }
      // remove the previous marker (by the old id and by the new id)
      cfg.markers = cfg.markers.filter(
        (m) => m.id !== id && m.id !== oldId
          && (marker.binding === 'virtual' || m.binding !== marker.binding),
      );
      cfg.markers.push(marker);
      // Position rule (owner's decision, v1.33.4): editing an existing icon —
      // rebinding it to another HA device/entity or to another room — must NOT
      // move it. Its current position (saved or the ephemeral auto one) is
      // migrated to the new marker id. Only two cases still center the icon:
      // a truly NEW icon, and a move to a room in a DIFFERENT space (keeping
      // the old coordinates there would be meaningless).
      // Write POINT-WISE (layout/update), not the whole layout — a full layout/set
      // overwrites positions changed in other windows (the v1.4.4 incident).
      let newPos: { s: string; x: number; y: number } | null = null;
      const targetSpace = space || prevDev?.space || this._space;
      const prevRec = oldId ? this._layout[oldId] : null;
      const prevPos = prevRec
        ? { s: prevRec.s || prevDev?.space || this._space, x: prevRec.x, y: prevRec.y }
        : oldId && prevDev && this._defPos[oldId]
          ? this._normPos(prevDev.space, this._defPos[oldId].x, this._defPos[oldId].y)
          : null;
      if (!replacingRemoved && prevPos && prevPos.s === targetSpace) {
        // stays in place; pin it under the (possibly new) id
        if (id !== oldId || !this._layout[id] || roomChanged) {
          newPos = { s: prevPos.s, x: prevPos.x, y: prevPos.y };
          this._layout = { ...this._layout, [id]: newPos };
        }
      } else if (replacingRemoved || !this._layout[id] || roomChanged) {
        const spm = this._spaceModel(space || undefined);
        let cx = spm.vb[0] + spm.vb[2] / 2;
        let cy = spm.vb[1] + spm.vb[3] / 2;
        const room = roomId
          ? spm.rooms.find((r) => r.id === roomId)
          : area
            ? spm.rooms.find((r) => r.area === area)
            : undefined;
        if (room) [cx, cy] = this._roomCenter(room);
        newPos = this._normPos(space || this._space, cx, cy);
        this._layout = { ...this._layout, [id]: newPos };
      }
      await this._saveConfigNow();
      if (newPos) this._noteLayoutRev(await this.hass.callWS({ type: 'houseplan/layout/update', device_id: id, pos: newPos }));
      const obsoleteIds = new Set(replacedRemovedIds);
      if (oldId && oldId !== id) obsoleteIds.add(oldId);
      obsoleteIds.delete(id);
      for (const obsoleteId of obsoleteIds) {
        // Rebinding or replacing a legacy tombstone changed the icon id.
        delete this._layout[obsoleteId];
        await this.hass.callWS({ type: 'houseplan/layout/delete', device_id: obsoleteId })
          .then((r: any) => this._noteLayoutRev(r)).catch(() => undefined);
      }
      // the config is committed — now it is safe to drop the old folder
      if (cleanupOldFiles && fileSrc) {
        await this.hass
          .callWS({ type: 'houseplan/files/cleanup', marker_id: fileSrc })
          .catch(() => undefined); // leftovers are harmless; broken links are not
      }
      this._markerDialog = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast(this._t('toast.marker_saved'));
    } catch (e: any) {
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (this._markerDialog) this._markerDialog = { ...this._markerDialog, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  private async _deleteMarker(): Promise<void> {
    const dlg = this._markerDialog;
    if (!dlg || dlg.busy || !dlg.devId) return;
    const d = dlg.devId ? this._devices.find((x) => x.id === dlg.devId) : null;
    if (!d) return;
    const label = dlg.name || this._t('device.fallback');
    if (!confirm(this._t('confirm.remove_marker', { name: label }))) return;
    const cfg = this._serverCfg!;
    cfg.markers = cfg.markers || [];
    const previousMarkers = cfg.markers;
    const binding = d.bindingKind === 'virtual'
      ? 'virtual'
      : d.bindingKind && d.bindingRef ? `${d.bindingKind}:${d.bindingRef}` : '';
    if (!binding) return;
    const deletion = deletePlanMarkerRecords(
      cfg.markers, d.id, binding, d.bindingKind === 'virtual',
    );
    cfg.markers = deletion.markers;
    const cleanupIds = deletion.cleanupIds;
    this._markerDialog = { ...dlg, busy: true };
    try {
      await this._saveConfigNow();
      // Housekeeping follows the durable config write. Every call is
      // idempotent and best-effort: the device is already deleted even if an
      // old integration cannot yet serve one of the cleanup commands.
      for (const id of cleanupIds) {
        delete this._layout[id];
        delete this._defPos[id];
        this._dirtyPos.delete(id);
        this._sentPos.delete(id);
        const activity = this._activityRt.get(id);
        if (activity) clearTimeout(activity.timer);
        this._activityRt.delete(id);
        this._vacRt.delete(id);
        delete this._vacSrvTrails[id];
        await this.hass.callWS({ type: 'houseplan/layout/delete', device_id: id })
          .then((r: any) => this._noteLayoutRev(r)).catch(() => undefined);
        await this.hass.callWS({ type: 'houseplan/files/cleanup', marker_id: id })
          .catch(() => undefined);
        await this.hass.callWS({ type: 'houseplan/trail/delete', marker_id: id })
          .catch(() => undefined);
      }
      this._markerDialog = null;
      if (this._infoCard?.id === d.id) this._infoCard = null;
      if (this._selId === d.id) this._selId = null;
      if (this._drag?.id === d.id) this._drag = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast(this._t('toast.marker_removed'));
    } catch (e: any) {
      if (this._serverCfg === cfg) cfg.markers = previousMarkers;
      if (this._markerDialog) this._markerDialog = { ...this._markerDialog, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  private _normPos(space: string, x: number, y: number): { s: string; x: number; y: number } {
    return { s: space, x: x / NORM_W, y: y / NORM_W };
  }

  // ================= SPACE MANAGEMENT =================

  private _openSpaceDialog(mode: 'edit' | 'create', spaceId?: string): void {
    if (!this._serverStorage || !this._serverCfg) {
      this._showToast(this._t('toast.integration_missing'));
      return;
    }
    if (mode === 'edit') {
      const sp = this._serverCfg!.spaces.find((x: any) => x.id === spaceId);
      if (!sp) return;
      const disp = spaceDisplayOf(sp);
      this._spaceDialog = {
        mode, spaceId, title: sp.title, planUrl: sp.plan_url || null, planFile: null,
        source: sp.plan_url ? 'file' : 'draw',
        showBorders: disp.showBorders, showNames: disp.showNames,
        hideDecor: disp.hideDecor, hideOpenings: disp.hideOpenings,
        roomColor: disp.color, roomOpacity: disp.opacity, fillMode: disp.fill,
        bgColor: disp.bgColor,
        bgMode: sp.settings?.bg_mode === 'static' || sp.settings?.bg_mode === 'daynight' ? sp.settings.bg_mode : null,
        northDeg: northDegOf({}, sp.settings),
        sunRays: typeof sp.settings?.sun_rays === 'boolean' ? sp.settings.sun_rays : null,
        tempMin: disp.tempMin, tempMax: disp.tempMax,
        showLqi: disp.showLqi ?? this._config?.show_signal ?? true,
        cardFontScale: disp.cardFontScale,
        labelTemp: disp.labelTemp, labelHum: disp.labelHum,
        labelLqi: disp.labelLqi, labelLight: disp.labelLight,
        cellCm: Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5,
        busy: false,
      };
    } else {
      this._spaceDialog = {
        mode, title: '', planUrl: null, planFile: null,
        source: 'file',
        showBorders: false, showNames: false,
        hideDecor: false, hideOpenings: false,
        roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'glow',
        bgColor: null,
        bgMode: null, northDeg: null, sunRays: null,
        tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
        showLqi: this._config?.show_signal ?? true,
        cardFontScale: 1,
        labelTemp: false, labelHum: false, labelLqi: false, labelLight: false,
        cellCm: 5,
        busy: false,
      };
    }
  }

  /** Background file selection: read base64 and determine the aspect ratio. */
  private async _pickPlanFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this._spaceDialog) return;
    const extMap: Record<string, string> = {
      'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    };
    const ext = extMap[file.type] || (file.name.toLowerCase().endsWith('.svg') ? 'svg' : '');
    if (!ext) {
      this._showToast(this._t('toast.plan_formats'));
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
    const b64 = btoa(bin);
    // aspect ratio: render into an Image
    const url = URL.createObjectURL(file);
    const aspect = await new Promise<number>((res) => {
      const img = new Image();
      img.onload = () => res(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.414);
      img.onerror = () => res(1.414);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    this._spaceDialog = { ...this._spaceDialog, planFile: { ext, b64, aspect, name: file.name } };
  }

  /**
   * Plans that are on the server but not attached anywhere are not garbage —
   * the component never deletes them (docs/SCOPE.md), which only makes sense if
   * they can be found again. This is that: detach a plan, come back later, pick
   * it out of the list. It is also the only way one is ever deleted.
   */
  private _toggleServerPlans = async (): Promise<void> => {
    const d = this._spaceDialog;
    if (!d) return;
    if (d.pickSaved) {
      this._spaceDialog = { ...d, pickSaved: false };
      return;
    }
    this._spaceDialog = { ...d, pickSaved: true, savedBusy: true };
    try {
      const r: any = await this.hass.callWS({ type: 'houseplan/plans/list' });
      const cur = this._spaceDialog;
      if (cur) this._spaceDialog = { ...cur, saved: r?.plans || [], savedBusy: false };
    } catch (e: any) {
      const cur = this._spaceDialog;
      if (cur) this._spaceDialog = { ...cur, saved: [], savedBusy: false };
      this._showToast(this._t('toast.plans_list_failed', { err: this._errText(e) }));
    }
  };

  /** The in-flight proportions read for the last picked saved plan. Save
   *  awaits it rather than shipping whatever was there before (HP-1490-04). */
  private _aspectJob: Promise<number> | null = null;

  private _useServerPlan(url: string): void {
    const d = this._spaceDialog;
    if (!d) return;
    // Attach immediately — the click should not wait for anything. The OLD
    // file's proportions go right away: they describe the previous image, and
    // a Save racing the read must get "unknown", never "the wrong shape".
    this._spaceDialog = { ...d, planUrl: url, planFile: null, pickSaved: false, savedAspect: undefined };
    this._aspectJob = this._readPlanAspect(url);
  }

  /**
   * Read a stored plan's proportions from the image itself.
   *
   * The content endpoint needs a signature, and `_display()` deliberately
   * returns nothing until one arrives. Loading too early therefore failed and
   * an earlier version treated that as "unknown ratio" and saved a fallback of
   * 1.414 — a square plan came out stretched (HP-1470-03). So wait for the
   * signature, and bind the result to THIS dialog and THIS url, or a late
   * answer would reshape whatever the user opened next.
   */
  private async _readPlanAspect(url: string): Promise<number> {
    for (let i = 0; i < 40; i++) {           // ~6 s, then give up quietly
      const src = this._display(url);
      if (src) {
        const ratio = await new Promise<number>((res) => {
          const img = new Image();
          img.onload = () => res(img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight : 0);
          img.onerror = () => res(0);
          img.src = src;
        });
        const cur = this._spaceDialog;
        if (cur && cur.planUrl === url && Number.isFinite(ratio) && ratio > 0) {
          this._spaceDialog = { ...cur, savedAspect: ratio };
          return ratio;
        }
        return 0;
      }
      await new Promise((r) => setTimeout(r, 150));
      if (this._spaceDialog?.planUrl !== url) return 0;   // the user moved on
    }
    return 0;
  }

  private async _deleteServerPlan(name: string): Promise<void> {
    if (!confirm(this._t('confirm.delete_plan', { name }))) return;
    try {
      await this.hass.callWS({ type: 'houseplan/plans/delete', name });
      const d = this._spaceDialog;
      if (d?.saved) this._spaceDialog = { ...d, saved: d.saved.filter((p) => p.name !== name) };
    } catch (e: any) {
      this._showToast(this._t('toast.plan_delete_failed', { err: this._errText(e) }));
    }
  }

  private _renderServerPlans(d: NonNullable<typeof this._spaceDialog>): TemplateResult {
    if (d.savedBusy) return html`<div class="savedplans muted">${this._t('space.loading')}</div>`;
    const list = d.saved || [];
    if (!list.length) return html`<div class="savedplans muted">${this._t('space.no_saved')}</div>`;
    const kb = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
    return html`<div class="savedplans">
      ${list.map((p) => html`
        <div class="savedplan ${p.url === d.planUrl ? 'cur' : ''}">
          <img src=${this._display(p.url)} alt="" loading="lazy" decoding="async" />
          <div class="savedmeta">
            <b>${p.name}</b>
            <span class="muted">${kb(p.size)}${p.used_by.length
              ? ' · ' + this._t('space.used_by', { list: p.used_by.join(', ') })
              : ''}</span>
          </div>
          <button class="btn ghost" @click=${() => this._useServerPlan(p.url)}
            ?disabled=${p.url === d.planUrl}>${this._t('btn.use')}</button>
          <button class="btn ghost danger"
            title=${p.used_by.length || p.url === d.planUrl ? this._t('space.in_use') : this._t('btn.delete')}
            ?disabled=${p.used_by.length > 0 || p.url === d.planUrl}
            @click=${() => this._deleteServerPlan(p.name)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>`)}
    </div>`;
  }

  private async _saveSpaceDialog(): Promise<void> {
    const d = this._spaceDialog;
    if (!d || d.busy || !d.title.trim()) return;
    if (d.source === 'file' && !d.planFile && !d.planUrl) {
      this._showToast(this._t('toast.plan_required'));
      return;
    }
    const wasFirst = d.mode === 'create' && (this._serverCfg?.spaces.length || 0) === 0;
    this._spaceDialog = { ...d, busy: true };
    try {
      const spaceId = d.mode === 'create' ? 's' + Date.now().toString(36) : d.spaceId!;

      /* Upload BEFORE touching the config, and never hold a reference to a
         config object across an await. `houseplan/config/get` runs on every
         `houseplan_config_updated` event and REPLACES `_serverCfg`; a space
         object captured before the upload is then detached, so plan_url,
         aspect and settings were written into an orphan and the save shipped
         the untouched config. Symptom: the file lands on disk, the plan never
         appears, and re-saving does not help (owner's install, 2026-07-27). */
      let uploaded: { url: string; aspect: number } | null = null;
      if (d.source === 'file' && d.planFile) {
        const resp = await this.hass.callWS({
          type: 'houseplan/plan/set', space_id: spaceId, ext: d.planFile.ext, data: d.planFile.b64,
        });
        uploaded = { url: resp.url, aspect: d.planFile.aspect };
      }

      // A plan picked from the server list reads its proportions from the
      // image, and Save used to outrun that read: the snapshot still carried
      // the PREVIOUS file's ratio and a wide plan came out at the old shape
      // for good (HP-1490-04). Wait for the read — it is bounded (~6 s) and
      // the dialog is already busy. Unknown stays unknown, never the old
      // value: a square fallback is honest, an inherited ratio is not.
      let pickedAspect: number | null = d.savedAspect || null;
      if (!uploaded && d.source === 'file' && d.planUrl && !pickedAspect && this._aspectJob) {
        pickedAspect = (await this._aspectJob) || null;
      }

      // from here on: no awaits until the save, so `sp` cannot be orphaned
      const cfg = this._serverCfg!;
      let sp: any;
      if (d.mode === 'create') {
        sp = {
          id: spaceId,
          title: d.title.trim(),
          plan_url: null,

          view_box: [0, 0, 1, 1],
          rooms: [],
        };
        cfg.spaces.push(sp);
      } else {
        sp = cfg.spaces.find((x: any) => x.id === spaceId);
        if (!sp) throw new Error('space ' + spaceId + ' is gone from the config');
        sp.title = d.title.trim();
      }
      if (uploaded) {
        sp.plan_url = uploaded.url;
        // the image's own proportions, so it can be centred before it loads
        sp.plan_aspect = uploaded.aspect;
      } else if (d.source === 'file' && d.planUrl && d.planUrl !== sp.plan_url) {
        // picked from the server list: no upload, just a reference — and the
        // previous image's proportions never survive the switch
        sp.plan_url = d.planUrl;
        sp.plan_aspect = pickedAspect;
      }
      // switching an existing space to "draw" detaches its background image
      // (the uploaded file stays on disk; only the reference is cleared).
      // Its transform goes with it — there is nothing left for plan_x/plan_y/
      // plan_scale to describe, and a stale one would silently apply to the
      // NEXT picture uploaded here (docs/BACKDROP.md §1).
      if (d.source === 'draw') {
        sp.plan_url = null; sp.plan_aspect = null;
        delete sp.plan_x; delete sp.plan_y; delete sp.plan_scale;
        delete sp.plan_scale_x; delete sp.plan_scale_y; delete sp.plan_angle;
      }
      // per-space display settings; hand-drawn spaces get borders+names on by default
      const draw = d.source === 'draw';
      sp.settings = {
        ...(sp.settings || {}),
        show_borders: draw && d.mode === 'create' ? true : d.showBorders,
        show_names: draw && d.mode === 'create' ? true : d.showNames,
        // written only when ON: a plan that never hid anything stores nothing
        hide_decor: d.hideDecor || undefined,
        hide_openings: d.hideOpenings || undefined,
        room_color: d.roomColor,
        room_opacity: d.roomOpacity,
        bg_color: d.bgColor || undefined, // empty = inherit the general setting
        bg_mode: d.bgMode || undefined,    // sun on the plan (docs/SUN.md); empty = inherit
        north_deg: d.northDeg ?? undefined,
        sun_rays: d.sunRays ?? undefined,
        fill_mode: d.fillMode,
        temp_min: Number.isFinite(d.tempMin) ? Math.min(d.tempMin, d.tempMax) : DEFAULT_TEMP_MIN,
        temp_max: Number.isFinite(d.tempMax) ? Math.max(d.tempMin, d.tempMax) : DEFAULT_TEMP_MAX,
        show_lqi: d.showLqi,
        card_font_scale: d.cardFontScale !== 1 ? d.cardFontScale : undefined,
        label_temp: d.labelTemp,
        label_hum: d.labelHum,
        label_lqi: d.labelLqi,
        label_light: d.labelLight,
      };
      sp.cell_cm = Number.isFinite(d.cellCm) && d.cellCm > 0
        ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, d.cellCm)) : 5;
      // Nothing to clean up from here: the backend collects the superseded
      // file inside the same locked transaction that accepted this config
      // (review R3-1). A cleanup driven from the client could not be ordered
      // against another client's commit and deleted its freshly saved plan.
      await this._saveConfigNow();
      this._spaceDialog = null;
      if (d.mode === 'create') this._space = sp.id;
      this._regSignature = '';
      this._maybeRebuildDevices();
      if (this._importQueue.length) {
        // floors-import wizard: proceed to the next floor
        this._openNextImport();
      } else if (wasFirst || this._importTotal > 0) {
        // guide the user onward: straight into room markup mode
        this._importTotal = 0;
        this._space = this._serverCfg!.spaces[0]?.id || this._space;
        this._mode = 'plan';
        this._tool = 'draw';
        this._path = [];
        this._cursorPt = null;
        this._primeDrawWallField();
        this._showToast(this._t(wasFirst && !this._importTotal ? 'toast.space_added_onboard' : 'import.done'));
      } else {
        this._showToast(d.mode === 'create' ? this._t('toast.space_added') : this._t('toast.space_saved'));
        // A freshly created space is empty — View has nothing to show. Open
        // the plan editor (draw tool) so the user can mark rooms immediately,
        // same as the first-space onboard path above.
        if (d.mode === 'create') {
          if (this._mode !== 'plan') this._setMode('plan');
          else {
            this._tool = 'draw';
            this._path = [];
            this._cursorPt = null;
            this._primeDrawWallField();
            this._saveNav();
          }
        }
      }
    } catch (e: any) {
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (this._spaceDialog) this._spaceDialog = { ...this._spaceDialog, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  private async _deleteSpace(): Promise<void> {
    const d = this._spaceDialog;
    if (!d || d.mode !== 'edit') return;
    const sp = this._serverCfg!.spaces.find((x: any) => x.id === d.spaceId);
    if (!confirm(this._t('confirm.delete_space', { title: sp.title }))) return;
    this._serverCfg!.spaces = this._serverCfg!.spaces.filter((x: any) => x.id !== d.spaceId);
    try {
      await this._saveConfigNow();
      this._spaceDialog = null;
      if (this._space === d.spaceId) this._space = this._serverCfg!.spaces[0]?.id || '';
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast(this._t('toast.space_deleted'));
    } catch (e: any) {
      this._showToast(this._t('toast.delete_failed', { err: this._errText(e) }));
    }
  }

  /** Immediate config save with a revision bump (no debounce).

  On a rev conflict the local copy is refreshed before rethrowing, so the
  user's retry starts from the fresh config instead of hitting the same
  conflict again. */
  private async _saveConfigNow(): Promise<void> {
    this._cfgEpoch++;
    try {
      // same queue as the debounced writer: a dialog saving while a background
      // write is still out must not race it into a self-inflicted conflict
      await this._writeConfig();
    } catch (e: any) {
      if (e?.code === 'conflict') await this._reloadConfigOnly();
      throw e;
    }
  }


  // ================= FLOORS IMPORT WIZARD =================

  private _startImport(): void {
    const dlg = this._importDialog;
    if (!dlg) return;
    const titles = dlg.floors.filter((f) => f.checked).map((f) => f.name);
    this._importDialog = null;
    if (!titles.length) {
      this._openSpaceDialog('create');
      return;
    }
    this._importQueue = titles;
    this._importTotal = titles.length;
    this._openNextImport();
  }

  /** Open the space dialog for the next queued floor (title prefilled, plan required). */
  private _openNextImport(): void {
    const title = this._importQueue.shift();
    if (title === undefined) return;
    this._spaceDialog = {
      mode: 'create', title, planUrl: null, planFile: null,
      source: 'file',
      showBorders: false, showNames: false,
      hideDecor: false, hideOpenings: false,
      roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'glow',
      bgColor: null,
      bgMode: null, northDeg: null, sunRays: null,
      tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
      showLqi: this._config?.show_signal ?? true,
      cardFontScale: 1,
      labelTemp: false, labelHum: false, labelLqi: false, labelLight: false,
      cellCm: 5,
      busy: false,
    };
  }

  /** Skip the current floor of the wizard without creating a space. */
  private _skipImport(): void {
    this._spaceDialog = null;
    if (this._importQueue.length) this._openNextImport();
    else if (this._importTotal > 0 && this._model.length) {
      this._importTotal = 0;
      this._space = this._serverCfg!.spaces[0]?.id || this._space;
      this._mode = 'plan';
      this._showToast(this._t('import.done'));
    }
  }

  private _renderImportDialog(): TemplateResult {
    const d = this._importDialog!;
    const n = d.floors.filter((f) => f.checked).length;
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('import.title')} icon="mdi:home-floor-1"
      @hp-close=${() => (this._importDialog = null)}>
        <div class="body">
          <div class="rhint">${this._t('import.hint')}</div>
          ${d.floors.map(
            (f, i) => html`<label class="floorrow">
              <input type="checkbox" .checked=${f.checked}
                @change=${(e: Event) => {
                  const floors = [...d.floors];
                  floors[i] = { ...f, checked: (e.target as HTMLInputElement).checked };
                  this._importDialog = { floors };
                }} />
              <span>${f.name}</span>
              ${f.level != null ? html`<span class="floorlvl">L${f.level}</span>` : nothing}
            </label>`,
          )}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => { this._importDialog = null; this._openSpaceDialog('create'); }}>
            ${this._t('import.manual')}
          </button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => this._startImport()} ?disabled=${!n}>
            <ha-icon icon="mdi:import"></ha-icon>${this._t('import.start', { n })}
          </button>
        </div>
    </hp-dialog>`;
  }

  // ================= SUN ON THE PLAN (docs/SUN.md) =================

  /** Global settings with the general-settings dialog's pending values. */
  private _sunGlobal(): any {
    const gd = this._settingsDialog;
    if (!gd) return this._settings;
    return {
      ...this._settings,
      north_deg: gd.northDeg ?? undefined,
      bg_mode: gd.bgMode,
      sun_rays: gd.sunRays,
    };
  }

  /** Current space settings with the space dialog's pending values. */
  private _sunSpace(): any {
    const sd = this._spaceDialog;
    const saved = this._curSpaceCfg?.settings || {};
    if (!sd || sd.mode !== 'edit' || sd.spaceId !== this._space) return saved;
    return {
      ...saved,
      north_deg: sd.northDeg ?? undefined,
      bg_mode: sd.bgMode ?? undefined,
      sun_rays: sd.sunRays ?? undefined,
    };
  }

  /** Effective compass; null = the whole sun feature is inert (docs/SUN.md). */
  private _effNorth(): number | null {
    return northDegOf(this._sunGlobal(), this._sunSpace());
  }

  private _effBgMode(): 'static' | 'daynight' {
    return bgModeOf(this._sunGlobal(), this._sunSpace());
  }

  private _effSunRays(): boolean {
    return sunRaysOn(this._sunGlobal(), this._sunSpace());
  }

  /** sun.sun, but only when the feature is armed (north_deg set somewhere). */
  private _sunNow(): { azimuth: number; elevation: number } | null {
    return this._effNorth() !== null ? sunStateOf(this.hass) : null;
  }

  /**
   * Window light wedges (docs/SUN.md): view/kiosk only. Geometry recomputes
   * ONLY when the memo key changes — sun attributes tick every ~30-120 s and
   * everything else in `hass` must not trigger the polygon clipping.
   */
  private _renderSunRays(space: SpaceModel): TemplateResult {
    const empty = svg`` as unknown as TemplateResult;
    // HARD gates — the feature is simply not on: leaving an editor, a space
    // with rays off, or night. Those never fade, they just are not there.
    if (this._editing || !this._effSunRays()) { this._sunFadeReset(); return empty; }
    const north = this._effNorth();
    const sun = north !== null ? sunStateOf(this.hass) : null;
    if (!sun || sun.elevation <= 0) { this._sunFadeReset(); return empty; }
    const alpha = rayPeakAlpha();
    // The ONE thing that fades (owner 2026-08-03): the 3° threshold. Above it
    // the layer is there at full strength, below it gone — with a 2 s CSS
    // fade either way. The keep-alive below is what lets the fade-OUT play at
    // all: without it the layer would leave the DOM in the same frame.
    if (raysVisible(sun.elevation)) {
      if (this._sunOutTimer) { clearTimeout(this._sunOutTimer); this._sunOutTimer = 0; }
      this._sunOut = false;
      this._sunShown = true;
    } else {
      if (!this._sunShown) return empty; // never lit: nothing to dissolve
      if (!this._sunOut) {
        this._sunOut = true;
        this._sunOutTimer = window.setTimeout(() => {
          this._sunOutTimer = 0;
          this._sunShown = false;
          this._sunOut = false;
          this.requestUpdate();
        }, RAY_FADE_MS);
      }
    }
    // DEV-B701-01: the geometry signal must be _cfgEpoch, not _cfgRev.
    // Every local mutation ends in _saveConfig(), which bumps the epoch
    // SYNCHRONOUSLY; _cfgRev only moves after the debounced WS write is
    // acked, so a rev-keyed memo served wedges for the OLD window position
    // during the whole write window (and forever if the write failed).
    const key = `${space.id}|${sun.azimuth}|${sun.elevation}|${north}|${this._cfgEpoch}`;
    if (!this._sunRaysCache || this._sunRaysCache.key !== key) {
      const rooms = space.rooms
        .map((r) => ({ id: r.id || '', poly: roomPoly(r) }))
        .filter((r): r is { id: string; poly: number[][] } => !!r.id && !!r.poly);
      const windows = this._openingsR
        .filter((o) => o.type === 'window')
        .map((o) => ({ id: o.id, x: o.rx, y: o.ry, angle: o.angle, length: o.rlen }));
      const walls = this._spaceWalls;
      const openCuts = this._openPairs().flatMap((p) => p.segs);
      const innerByRoom: Record<string, number[][]> = {};
      const wallDepthByOpening: Record<string, number> = {};
      if (walls.length) {
        for (const r of rooms) {
          const inn = innerContourForRoom(
            space.rooms, r.id, walls, openCuts,
            this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
          );
          if (inn) innerByRoom[r.id] = inn;
        }
        for (const o of windows) {
          const face = openingInnerFaceOffset(
            space.rooms, { x: o.x, y: o.y, angle: o.angle, length: o.length },
            walls, this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
          );
          if (face.cm > 0) {
            wallDepthByOpening[o.id] = wallCmToUnits(face.cm, this._cellCm, this._gridPitch);
          }
        }
      }
      let rays = computeSunRays(
        rooms, windows, sun.azimuth, sun.elevation, north!,
        walls.length ? innerByRoom : undefined,
        walls.length ? wallDepthByOpening : undefined,
      );
      const physical = this._physicalBodiesR(space);
      if (physical.length) {
        rays = rays.map((ray) => {
          const shadows = directionalOccluders(physical, ray.dir, ray.len);
          const clipped = ray.polys.map((poly) => floorMinusBodies(poly, shadows));
          return {
            ...ray,
            paths: clipped.map(polyclipPathD).filter(Boolean),
            polys: clipped.flatMap(geometryOuterRings),
          };
        }).filter((ray) => ray.paths?.length || ray.polys.length);
      }
      // the rim is pure geometry off the same wedges — memoised on the same key
      this._sunRaysCache = { key, rays, rims: rays.map((r) => rayRimEdges(r)) };
    }
    const rays = this._sunRaysCache.rays;
    const rims = this._sunRaysCache.rims;
    if (!rays.length) return empty;
    const color = rayColor(dayPhase(sun.elevation).warmth);
    const stops = rayStops();
    const rimAlpha = rimPeakAlpha();
    const rimStopList = rimStops();
    // NO filter here, and none in <defs>. Owner 2026-08-04: «не надо размывать
    // их боковые грани» — the shaft keeps the crisp sides real light has, and
    // the only falloff is the gradient. The tip needs no blur either:
    // `rayStops()` is already at zero from RAY_FADE_END on, and the wedge's far
    // edge IS the gradient's last iso-alpha line, so it has nothing left to
    // draw. The polygons come out of `computeSunRays()` already intersected
    // with the room, so no clip-path is needed to keep the light off the far
    // side of a wall.
    //
    // DEV-EB173-01: the axis runs along the wall's INWARD NORMAL, from the
    // room-side opening face inward, and is `r.depth` = `len·cos` long — NOT
    // along the ray. For parallel rays, distance from the source span is an
    // affine function of the point, so its iso-alpha lines are parallel to the
    // wall; with this axis every point `source + dir·u` lands at offset
    // `u/len`. Whole inner opening at peak alpha, identical fade distance along every
    // ray, and the parallelogram's far edge exactly on the gradient's end.
    //
    // THE RIM (owner 2026-08-04, docs/SUN.md «The rim»): a 1 px black hairline
    // along the two SIDE edges only, so the shaft stays legible on white paper
    // where added luminance cannot read. It gets a gradient of its own —
    // `hp-sunrim-i` — deliberately built on the SAME x1/y1/x2/y2 and the same
    // `rayStops()` curve as `hp-sun-i`, only black and with its own peak: the
    // line must die on the very stop the fill dies on, never outlive it.
    // `non-scaling-stroke` keeps it one screen pixel at any zoom, and the
    // segments come out of the ALREADY clipped polygons, so a wall still stops
    // the light by geometry alone and no clip-path enters this layer.
    return svg`<defs>
        ${rays.map((r, i) => {
          const mx = (r.a[0] + r.b[0]) / 2;
          const my = (r.a[1] + r.b[1]) / 2;
          const ax = mx + r.normal[0] * r.depth;
          const ay = my + r.normal[1] * r.depth;
          return svg`<linearGradient id="hp-sun-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}" x2="${ax}" y2="${ay}">
            ${stops.map(([off, k]) => svg`<stop offset="${(off * 100).toFixed(1)}%"
              stop-color="${color}" stop-opacity="${(alpha * k).toFixed(4)}"></stop>`)}
          </linearGradient>
          <linearGradient id="hp-sunrim-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}" x2="${ax}" y2="${ay}">
            ${rimStopList.map(([off, k]) => svg`<stop offset="${(off * 100).toFixed(1)}%"
              stop-color="${RIM_COLOR}" stop-opacity="${(rimAlpha * k).toFixed(4)}"></stop>`)}
          </linearGradient>`;
        })}
      </defs>
      <g class="sunlayer ${this._sunOut ? 'out' : ''}">
        ${rays.map((r, i) => r.paths?.length
          ? r.paths.map((d) => svg`<path d=${d} fill-rule="evenodd" fill="url(#hp-sun-${i})"></path>`)
          : r.polys.map((p) => svg`<polygon
              points="${p.map((q) => q[0] + ',' + q[1]).join(' ')}" fill="url(#hp-sun-${i})"></polygon>`))}
        ${rays.map((r, i) => (rims[i] || []).map((e) => svg`<line class="sunrim"
          x1="${e[0][0]}" y1="${e[0][1]}" x2="${e[1][0]}" y2="${e[1][1]}"
          stroke="url(#hp-sunrim-${i})" stroke-width="1"
          vector-effect="non-scaling-stroke"></line>`))}
      </g>` as unknown as TemplateResult;
  }

  /** Sun-ray layer keep-alive: `shown` = in the DOM, `out` = playing the
   *  2 s dissolve before it leaves (plain fields — the timer requests the
   *  update, render just reads them). */
  private _sunShown = false;
  private _sunOut = false;
  private _sunOutTimer = 0;

  /**
   * Day/night sky bookkeeping, once per update (docs/SUN.md).
   *
   * The sky colour and the plan dimming are delivered by a 45 s CSS transition
   * — and a transition only advances while the card is being PAINTED. Whenever
   * it was not (a background tab, another dashboard view, an editor session, a
   * fresh mount), the sun moved on without it, and the transition then crawls
   * toward the truth instead of showing it: the owner's «фон не меняется сам,
   * только после обновления страницы» (2026-08-04). So: glide while we are
   * keeping up (the sun moves ≲1° between two `sun.sun` updates), JUMP once
   * when the gap says we were not watching.
   */
  private _skyPlan(): void {
    const sun = !this._editing && this._effBgMode() === 'daynight' ? this._sunNow() : null;
    if (!sun) { this._skyElev = null; this._skySnap = false; return; }
    const e = skyElevation(sun.elevation);
    if (skyNeedsSnap(this._skyElev, e)) this._skySnap = true;
    this._skyElev = e;
  }

  /** Hand the 45 s transition back once the jumped-to colour is on screen. */
  private _skyRelease(): void {
    if (!this._skySnap || this._skySnapRaf) return;
    this._skySnapRaf = requestAnimationFrame(() => {
      this._skySnapRaf = requestAnimationFrame(() => {
        this._skySnapRaf = 0;
        this._skySnap = false;
        this.requestUpdate();
      });
    });
  }

  /** Drop the layer at once: used by every gate that is NOT the 3° threshold. */
  private _sunFadeReset(): void {
    if (this._sunOutTimer) { clearTimeout(this._sunOutTimer); this._sunOutTimer = 0; }
    this._sunShown = false;
    this._sunOut = false;
  }

  /** One drag/click sample on the compass dial → dialog north_deg. */
  private _compassPoint(ev: PointerEvent): void {
    const el = ev.currentTarget as SVGSVGElement;
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 5) return; // the dead centre says nothing about angle
    let a = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
    if (ev.shiftKey) a = Math.round(a / 15) * 15; // coarse 15° steps with Shift
    a = ((a % 360) + 360) % 360;
    this._settingsDialog = { ...this._settingsDialog!, northDeg: a };
  }

  /** The compass dial: drag the «N» arrow around the ring (docs/SUN.md). */
  private _renderCompass(): TemplateResult {
    const d = this._settingsDialog!;
    const deg = d.northDeg;
    return html`<svg class="compass ${deg === null ? 'unset' : ''}" viewBox="-60 -60 120 120"
      @pointerdown=${(e: PointerEvent) => {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        this._compassDrag = true;
        this._compassPoint(e);
      }}
      @pointermove=${(e: PointerEvent) => { if (this._compassDrag) this._compassPoint(e); }}
      @pointerup=${() => (this._compassDrag = false)}
      @pointercancel=${() => (this._compassDrag = false)}>
      <circle class="cring" r="50"></circle>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map(
        (t) => svg`<line class="ctick ${t % 90 ? 'minor' : ''}" x1="0" y1="-50" x2="0" y2="${t % 90 ? -46 : -43}"
          transform="rotate(${t})"></line>`,
      )}
      <g class="cneedle" transform="rotate(${deg ?? 0})">
        <line x1="0" y1="34" x2="0" y2="-28"></line>
        <path d="M -7 -24 L 0 -42 L 7 -24 Z"></path>
        <text x="0" y="-12" text-anchor="middle">${this._t('gs.north_letter')}</text>
      </g>
      <text class="cdeg" x="0" y="26" text-anchor="middle">${deg === null ? '—' : deg + '°'}</text>
    </svg>`;
  }

  /**
   * Effective stage background: per-space override → global setting → '' (the
   * theme default from the stylesheet). An open dialog previews its pending
   * value, so the color can be picked against the live plan. In 'daynight'
   * mode (docs/SUN.md) the sun's elevation paints the stage instead.
   */
  private _stageBg(disp: SpaceDisplay): string {
    if (this._effBgMode() === 'daynight') {
      const sun = this._sunNow();
      if (sun) return dayPhase(skyElevation(sun.elevation)).bg;
    }
    const gd = this._settingsDialog;
    const sd = this._spaceDialog;
    const globalBg = gd ? gd.bgColor || '' : stageBgOf(this._settings, { bgColor: null });
    const spaceBg = sd && sd.mode === 'edit' && sd.spaceId === this._space
      ? sd.bgColor || ''
      : disp.bgColor || '';
    return spaceBg || globalBg;
  }

  /** Current computed stage background as #rrggbb — the color input's default. */
  private _stageBgHex(): string {
    const st = this._stageEl;
    if (st) {
      const m = getComputedStyle(st).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) return '#' + m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('');
    }
    return '#111111';
  }

  // ================= GENERAL SETTINGS =================

  private _openSettingsDialog = (): void => {
    if (!this._norm) return;
    // deep copy so the dialog edits do not leak into the live palette
    const cm = this._glowRadiusCm;
    const glowRadius = this._imperial
      ? Math.round((cm / 30.48) * 10) / 10
      : Math.round(cm) / 100;
    this._settingsDialog = {
      colors: JSON.parse(JSON.stringify(this._fillColors)),
      glowRadius,
      bgColor: stageBgOf(this._settings, { bgColor: null }) || null,
      northDeg: northDegOf(this._settings, {}),
      bgMode: bgModeOf(this._settings, {}),
      sunRays: sunRaysOn(this._settings, {}),
      busy: false,
    };
  };

  /**
   * Preview whole-plan maintenance. Nothing is written here: the pure run
   * produces both the report and the exact config/layout pair to commit.
   */
  private _openAlignDialog = (): void => {
    if (!this._norm || !this._serverCfg) return;
    const spaces = this._serverCfg.spaces || [];
    const r = optimizePlans(this._serverCfg, this._layout || {});
    // The maximum geometry shift is an UPPER BOUND, not a sample. The run
    // measured every element in the centimetres of ITS OWN space — converting
    // one normalised maximum through the first space's `cell_cm` understated
    // a two-scale plan twentyfold (AUD-158B1-01) — and the last tenth is
    // rounded UP, so the promise can never be smaller than the deed.
    const cm = Math.ceil(r.report.maxShiftCm * 10) / 10;
    const sp = spaces.find((x: any) => x?.id != null && String(x.id) === r.report.maxSpace);
    const where = spaces.length > 1 && sp ? String(sp.title || sp.id) : '';
    this._alignDialog = {
      report: r.report, config: r.config, layout: r.layout, cm, where,
      changed: r.changed, busy: false,
    };
  };

  /**
   * The backend persists an intent before either store changes, then keeps a
   * one-deep snapshot that remains undoable until the next plan edit.
   */
  private async _runAlignToGrid(): Promise<void> {
    const d = this._alignDialog;
    if (!d || d.busy || !this._serverCfg) return;
    this._clearGeometryGesture();
    this._alignDialog = { ...d, busy: true };
    try {
      if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.flush();
      await this._writeChain;
      const resp = await this.hass.callWS({
        type: 'houseplan/plan/optimize',
        config: d.config,
        layout: d.layout,
        expected_config_rev: this._cfgRev,
        expected_layout_rev: this._layoutRev,
      });
      this._serverCfg = d.config;
      this._layout = d.layout;
      this._geometryHistory.clear();
      this._cfgRev = resp?.config_rev ?? this._cfgRev + 1;
      this._layoutRev = resp?.layout_rev ?? this._layoutRev + 1;
      this._canOptimizeUndo = !!resp?.can_undo;
      this._dirtyPos.clear();
      this._sentPos.clear();
      this._cfgEpoch++;
      this._modelCache = null;
      this._frame = null;
      this._cacheSnapshot();
      this._alignDialog = null;
      this.requestUpdate();
      this._showToast(this._t('gs.align_done', {
        n: String(d.report.moved),
        m: String(d.report.migrated + d.report.canonicalized
          + d.report.wallsMerged + d.report.spansMerged),
      }));
    } catch (e: any) {
      if (this._alignDialog) this._alignDialog = { ...this._alignDialog, busy: false };
      if (e?.code === 'conflict') {
        await Promise.all([this._reloadConfigOnly(true), this._reloadLayoutOnly()]);
      }
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  /** Prevent a double click from sending two restores of the same snapshot. */
  private _optimizeUndoBusy = false;

  /** Restore the one-deep snapshot, provided no later plan edit exists. */
  private async _undoPlanOptimization(): Promise<void> {
    if (!this._canOptimizeUndo || this._optimizeUndoBusy) return;
    this._clearGeometryGesture();
    this._optimizeUndoBusy = true;
    this.requestUpdate();
    try {
      await this.hass.callWS({
        type: 'houseplan/plan/optimize_undo',
        expected_config_rev: this._cfgRev,
        expected_layout_rev: this._layoutRev,
      });
      const [cfgResp, layResp] = await Promise.all([
        this.hass.callWS({ type: 'houseplan/config/get' }),
        this.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      this._serverCfg = cfgResp?.config || this._serverCfg;
      this._cfgRev = cfgResp?.rev ?? this._cfgRev;
      this._layout = layResp?.layout || this._layout;
      this._geometryHistory.clear();
      this._layoutRev = layResp?.rev ?? this._layoutRev;
      this._canOptimizeUndo = false;
      this._cfgEpoch++;
      this._modelCache = null;
      this._frame = null;
      this._cacheSnapshot();
      this.requestUpdate();
      this._showToast(this._t('gs.optimize_undone'));
    } catch (e: any) {
      this._canOptimizeUndo = false;
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    } finally {
      this._optimizeUndoBusy = false;
      this.requestUpdate();
    }
  }

  private _setFillColor(key: keyof FillColors, patch: Partial<{ c: string; a: number }>): void {
    const d = this._settingsDialog!;
    this._settingsDialog = { ...d, colors: { ...d.colors, [key]: { ...d.colors[key], ...patch } } };
  }

  private async _saveSettingsDialog(): Promise<void> {
    const d = this._settingsDialog;
    if (!d || d.busy) return;
    this._settingsDialog = { ...d, busy: true };
    try {
      const cfg = this._serverCfg!;
      const isDefault = JSON.stringify(d.colors) === JSON.stringify(DEFAULT_FILL_COLORS);
      const settings: any = { ...cfg.settings };
      if (isDefault) delete settings.fill_colors;
      else settings.fill_colors = d.colors;
      const cm = this._imperial ? d.glowRadius * 30.48 : d.glowRadius * 100;
      if (Number.isFinite(cm) && cm > 0 && Math.round(cm) !== 300) settings.glow_radius_cm = Math.round(cm);
      else delete settings.glow_radius_cm;
      if (d.bgColor) settings.bg_color = d.bgColor;
      else delete settings.bg_color;
      // sun on the plan (docs/SUN.md): defaults are never stored
      if (d.northDeg !== null && Number.isInteger(d.northDeg) && d.northDeg >= 0 && d.northDeg <= 359)
        settings.north_deg = d.northDeg;
      else delete settings.north_deg;
      if (d.bgMode === 'daynight') settings.bg_mode = 'daynight';
      else delete settings.bg_mode;
      if (d.sunRays) settings.sun_rays = true;
      else delete settings.sun_rays;
      // Legacy compatibility: old configs may still contain this accepted
      // field, but weather no longer affects sunlight and the UI no longer
      // exposes it. Saving general settings cleans the obsolete value up.
      delete settings.weather_entity;
      this._serverCfg = { ...cfg, settings };
      await this._saveConfigNow();
      this._settingsDialog = null;
      this.requestUpdate();
      this._showToast(this._t('gs.saved'));
    } catch (e: any) {
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (this._settingsDialog) this._settingsDialog = { ...this._settingsDialog, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  /** Boolean toggle for dialog rows: the native ha-switch when the HA
   *  frontend provides it, the classic checkbox otherwise (older HA, the
   *  smoke env). The ha-* API is undocumented and shifts between HA
   *  releases, so the presence check is the ONLY coupling: both branches
   *  fire `change` and both are read back via `.checked` off the event
   *  target - one handler, two renderers. */
  private _boolInput(checked: boolean, onChange: (v: boolean) => void, disabled = false): TemplateResult {
    const h = (e: Event) => onChange(!!(e.target as HTMLInputElement).checked);
    return customElements.get('ha-switch')
      ? html`<ha-switch .checked=${checked} .disabled=${disabled} @change=${h}></ha-switch>`
      : html`<input type="checkbox" .checked=${checked} ?disabled=${disabled} @change=${h} />`;
  }

  /** Range slider for dialog rows: ha-slider when available, plain
   *  input[type=range] otherwise. Same fallback contract as _boolInput;
   *  ha-slider emits `input` while dragging and `change` on release
   *  (which of the two carries the final value differs between HA
   *  versions - listen to both, the handler is idempotent). */
  private _rangeInput(min: number, max: number, step: number, value: number, onInput: (v: number) => void): TemplateResult {
    const h = (e: Event) => {
      const n = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(n)) onInput(n);
    };
    return customElements.get('ha-slider')
      ? html`<ha-slider .min=${min} .max=${max} .step=${step} .value=${value} @input=${h} @change=${h}></ha-slider>`
      : html`<input type="range" min=${min} max=${max} step=${step} .value=${String(value)} @input=${h} />`;
  }

  private _renderColorRow(key: keyof FillColors, labelKey: string): TemplateResult {
    const d = this._settingsDialog!;
    const v = d.colors[key];
    return html`<div class="colorrow gsrow">
      <span class="gsl">${this._t(labelKey as any)}</span>
      <input type="color" .value=${v.c}
        @input=${(e: Event) => this._setFillColor(key, { c: (e.target as HTMLInputElement).value })} />
      ${this._rangeInput(0, 100, 1, Math.round(v.a * 100), (n) => this._setFillColor(key, { a: n / 100 }))}
      <span class="opv">${Math.round(v.a * 100)}%</span>
    </div>`;
  }

  /** Glow radius: stored in cm (config.settings.glow_radius_cm), default 3 m. */
  private get _glowRadiusCm(): number {
    const v = Number((this._settings as any).glow_radius_cm);
    return Number.isFinite(v) && v > 0 ? v : 300;
  }

  private get _imperial(): boolean {
    return this.hass?.config?.unit_system?.length === 'mi';
  }

  private get _glowRadiusPlaceholder(): string {
    const cm = this._glowRadiusCm;
    return this._imperial ? String(Math.round((cm / 30.48) * 10) / 10) : String(cm / 100);
  }

  /** Light pools of the current space: dark house, glowing sources. */
  private _renderGlowLayer(space: SpaceModel): TemplateResult {
    const colors = this._fillColors;
    const defaultR = (this._glowRadiusCm / this._cellCm) * this._gridPitch;
    const g = this._gridPitch;
    const polys = space.rooms
      .map((r) => ({ r, poly: roomPoly(r) }))
      .filter((x): x is { r: RoomCfg; poly: number[][] } => !!x.poly);
    // Gates are door-like openings: their different symbol must not change
    // how light crosses the clear wall tunnel.
    const passages = this._openingsR.filter((o) => o.type !== 'window');
    const walls = this._spaceWalls;
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    const physical = this._physicalBodiesR(space);
    const passageTunnelDepth = new Map<string, number>();
    if (walls.length) {
      for (const o of passages) {
        const rad = (o.angle * Math.PI) / 180;
        const dx = (Math.cos(rad) * o.rlen) / 2;
        const dy = (Math.sin(rad) * o.rlen) / 2;
        const cm = intervalCmAt(
          space.rooms, walls, openCuts,
          [o.rx - dx, o.ry - dy, o.rx + dx, o.ry + dy],
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        );
        if (cm > 0) passageTunnelDepth.set(o.id, wallCmToUnits(cm, this._cellCm, this._gridPitch));
      }
    }
    const litByDevice = new Map<string, string>();
    for (const source of resolvedLightSources(
      this._planHass,
      this._devices.filter((d) => d.space === space.id),
    )) {
      if (source.on && source.device.id && !litByDevice.has(source.device.id))
        litByDevice.set(source.device.id, source.eid);
    }
    const spots: { pos: { x: number; y: number }; c: string; alpha: number; clip: string[] | null; r: number }[] = [];
    for (const d of this._devices) {
      if (d.space !== space.id) continue;
      const lightEid = litByDevice.get(d.id);
      if (!lightEid) continue;
      const glow = glowColorOf(this.hass.states[lightEid], colors.glow_light.c);
      if (!glow) continue;
      // per-source radius (owner's decision v1.36.2): marker override, else global
      const ownCm = Number(d.marker?.glow_radius_cm);
      const R = Number.isFinite(ownCm) && ownCm > 0 ? (ownCm / this._cellCm) * this._gridPitch : defaultR;
      const pos = this._pos(d);
      // innermost room under the source (islands win — reverse order)
      const home = [...polys].reverse().find((x) => this._pointInRoom([pos.x, pos.y], x.r));
      let clip: string[] | null = null;
      const clipKey = home
        ? `${space.id}|${this._cfgEpoch}|${pos.x.toFixed(4)},${pos.y.toFixed(4)}|${R.toFixed(4)}`
        : '';
      const cachedClip = home ? lruRead(this._glowClipCache, clipKey) : { hit: false as const };
      if (cachedClip.hit) {
        clip = cachedClip.value;
      } else if (home) {
        const occluders = physical.length
          ? radialOccluders(physical, [pos.x, pos.y], R)
          : [];
        // open (virtual) boundaries: light flows through the whole connected
        // zone of rooms, not just the source's own room (owner's spec)
        const zoneIds = home.r.id ? openZoneOf(home.r.id, space.rooms) : new Set([home.r.id]);
        const zone = polys.filter((x) => x.r.id && zoneIds.has(x.r.id));
        const zoneList = zone.length ? zone : [home];
        const shapes: string[] = zoneList.map((z) => {
          const poly = (walls.length && z.r.id)
            ? (innerContourForRoom(
                space.rooms, z.r.id!, walls, openCuts,
                this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
              ) || z.poly)
            : z.poly;
          return occluders.length
            ? polyclipPathD(floorMinusBodies(poly, occluders))
            : 'M ' + poly.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z';
        });
        // doorways on the ZONE's walls spill light into rooms outside the zone
        const others = polys.filter((x) => !zoneList.includes(x)).map((x) => x.poly);
        for (const o of passages) {
          const onZoneWall = zoneList.some((z) => {
            const near = closestPointOnBoundary([o.rx, o.ry], z.poly);
            return near && Math.hypot(near[0] - o.rx, near[1] - o.ry) <= g * 0.75;
          });
          if (!onZoneWall) continue;
          const rad = (o.angle * Math.PI) / 180;
          const dx = (Math.cos(rad) * o.rlen) / 2;
          const dy = (Math.sin(rad) * o.rlen) / 2;
          if (!hasRoomBehind([o.rx, o.ry], o.angle, [pos.x, pos.y], others, g * 0.6)) continue;
          const sector = doorSector(
            [pos.x, pos.y], [o.rx - dx, o.ry - dy], [o.rx + dx, o.ry + dy],
            R, 170, passageTunnelDepth.get(o.id) || 0,
          );
          if (sector) shapes.push(occluders.length
            ? polyclipPathD(floorMinusBodies(sector, occluders))
            : 'M ' + sector.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z');
        }
        // IMPORTANT: separate <path> children — clipPath children always
        // UNION. Joining the room and a sector into ONE path made the default
        // nonzero fill-rule cancel their overlap when the windings opposed,
        // punching a dark wedge INSIDE the room (field report + screenshot).
        clip = shapes;
        lruWrite(this._glowClipCache, clipKey, clip, 256);
      }
      spots.push({ pos, c: glow.c, alpha: colors.glow_light.a * glow.bri, clip, r: R });
    }
    if (!spots.length) return svg`` as unknown as TemplateResult;
    return svg`<defs>
        ${spots.map((sp, i) => svg`
          <radialGradient id="hp-glow-${i}">
            <stop offset="0%" stop-color="${sp.c}" stop-opacity="${sp.alpha.toFixed(3)}"></stop>
            <stop offset="70%" stop-color="${sp.c}" stop-opacity="${sp.alpha.toFixed(3)}"></stop>
            <stop offset="100%" stop-color="${sp.c}" stop-opacity="0"></stop>
          </radialGradient>
          ${sp.clip ? svg`<clipPath id="hp-glowclip-${i}">${sp.clip.map((d) => svg`<path d="${d}" clip-rule="evenodd" fill-rule="evenodd"></path>`)}</clipPath>` : nothing}`)}
      </defs>
      ${''/* Glow is presentation only. It is painted above room fills, but must
             not become the pointer target: room hover and its tooltip still
             belong to the room underneath the light pool. */}
      <g class="glowlayer" pointer-events="none" opacity="0.7">
        ${spots.map((sp, i) => svg`<circle cx="${sp.pos.x}" cy="${sp.pos.y}" r="${sp.r}"
          fill="url(#hp-glow-${i})" ${''}
          clip-path=${sp.clip ? `url(#hp-glowclip-${i})` : nothing}></circle>`)}
      </g>` as unknown as TemplateResult;
  }

  /**
   * The confirmation separates geometry movement from lossless maintenance,
   * and promises the one-deep undo before either store is changed.
   */
  private _renderAlignDialog(): TemplateResult {
    const d = this._alignDialog!;
    const r = d.report;
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('gs.align_title')} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${() => (this._alignDialog = null)}>
        <div class="body">
          ${!d.changed
            ? html`<p class="alignmsg">${this._t('gs.align_none')}</p>`
            : html`
              ${r.moved ? html`<p class="alignmsg">${this._t('gs.align_count', {
                  n: String(r.moved), total: String(r.total), cm: String(d.cm),
                })}</p>` : nothing}
              ${d.where
                ? html`<p class="alignmsg">${this._t('gs.align_where', { s: d.where })}</p>`
                : nothing}
              ${r.rotated
                ? html`<p class="alignmsg">${this._t('gs.align_turned', { n: String(r.rotated) })}</p>`
                : nothing}
              ${r.removedDrafts
                ? html`<p class="alignmsg">${this._t('gs.align_removed_drafts', {
                    n: String(r.removedDrafts),
                  })}</p>`
                : nothing}
              <p class="alignmsg">${this._t('gs.optimize_changes', {
                m: String(r.migrated), c: String(r.canonicalized),
                w: String(r.wallsMerged), s: String(r.spansMerged),
              })}</p>
              <div class="rhint">${this._t('gs.align_warn')}</div>`}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._alignDialog = null)}>${this._t('btn.cancel')}</button>
          ${!d.changed ? nothing : html`
            <button class="btn on" @click=${this._runAlignToGrid} ?disabled=${d.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('gs.align_run')}
            </button>`}
        </div>
    </hp-dialog>`;
  }

  private _renderSettingsDialog(): TemplateResult {
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('gs.title')} icon="mdi:cog-outline" wide
      @hp-close=${() => (this._settingsDialog = null)}>
        <div class="body">
          <div class="rhint">${this._t('gs.hint')}</div>
          <label class="dispsection">${this._t('gs.light_group')}</label>
          ${this._renderColorRow('light_on', 'gs.light_on')}
          ${this._renderColorRow('light_off', 'gs.light_off')}
          ${this._renderColorRow('light_none', 'gs.light_none')}
          <label class="dispsection">${this._t('gs.temp_group')}</label>
          ${this._renderColorRow('temp_cold', 'gs.temp_cold')}
          ${this._renderColorRow('temp_ok', 'gs.temp_ok')}
          ${this._renderColorRow('temp_hot', 'gs.temp_hot')}
          <label class="dispsection">${this._t('gs.lqi_group')}</label>
          ${this._renderColorRow('lqi_low', 'gs.lqi_low')}
          ${this._renderColorRow('lqi_high', 'gs.lqi_high')}
          <label class="dispsection">${this._t('gs.glow_group')}</label>
          ${this._renderColorRow('glow_base', 'gs.glow_base')}
          ${this._renderColorRow('glow_light', 'gs.glow_light')}
          <label class="dispsection">${this._t('gs.wall_group')}</label>
          ${this._renderColorRow('wall_fill', 'gs.wall_fill')}
          <div class="colorrow gsrow">
            <span class="gsl">${this._t('gs.glow_radius')}</span>
            <input type="number" class="tempin" min="0.5" step="0.5"
              .value=${String(this._settingsDialog!.glowRadius)}
              @input=${(e: Event) => {
                const v = strictNumber((e.target as HTMLInputElement).value);
                if (v != null && v > 0)
                  this._settingsDialog = { ...this._settingsDialog!, glowRadius: v };
              }} />
            <span class="opl">${this._imperial ? this._t('gs.unit_ft') : this._t('gs.unit_m')}</span>
          </div>
          <label class="dispsection">${this._t('gs.bg_group')}</label>
          <div class="colorrow gsrow">
            <span class="gsl">${this._t('gs.bg_mode')}</span>
            <select class="areasel"
              @change=${(e: Event) =>
                (this._settingsDialog = { ...this._settingsDialog!, bgMode: (e.target as HTMLSelectElement).value === 'daynight' ? 'daynight' : 'static' })}>
              <option value="static" ?selected=${this._settingsDialog!.bgMode === 'static'}>${this._t('gs.bg_static')}</option>
              <option value="daynight" ?selected=${this._settingsDialog!.bgMode === 'daynight'}>${this._t('gs.bg_daynight')}</option>
            </select>
          </div>
          ${this._settingsDialog!.bgMode === 'static'
            ? html`<div class="colorrow gsrow">
                <span class="gsl">${this._t('gs.bg_color')}</span>
                <input type="color" .value=${this._settingsDialog!.bgColor || this._stageBgHex()}
                  @input=${(e: Event) =>
                    (this._settingsDialog = { ...this._settingsDialog!, bgColor: (e.target as HTMLInputElement).value })} />
                ${this._settingsDialog!.bgColor
                  ? html`<button class="btn ghost" @click=${() =>
                      (this._settingsDialog = { ...this._settingsDialog!, bgColor: null })}>${this._t('gs.bg_default')}</button>`
                  : html`<span class="opl">${this._t('gs.bg_theme')}</span>`}
              </div>`
            : html`<div class="rhint">${this._t('gs.bg_daynight_hint')}</div>`}
          <label class="dispsection">${this._t('gs.sun_group')}</label>
          ${!sunStateOf(this.hass)
            ? html`<div class="rhint">${this._t('gs.sun_missing')}</div>`
            : nothing}
          <div class="sunrow">
            ${this._renderCompass()}
            <div class="suncol">
              <span class="gsl">${this._t('gs.north')}</span>
              <div class="colorrow">
                <input class="namein tempin" type="number" min="0" max="359" step="1"
                  placeholder=${this._t('gs.north_ph')}
                  .value=${this._settingsDialog!.northDeg === null ? '' : String(this._settingsDialog!.northDeg)}
                  @input=${(e: Event) => {
                    const raw = (e.target as HTMLInputElement).value.trim();
                    const n = raw === '' ? null : Math.round(Number(raw));
                    this._settingsDialog = {
                      ...this._settingsDialog!,
                      northDeg: n !== null && Number.isFinite(n) ? Math.min(359, Math.max(0, n)) : null,
                    };
                  }} />
                ${this._settingsDialog!.northDeg !== null
                  ? html`<button class="btn ghost" @click=${() =>
                      (this._settingsDialog = { ...this._settingsDialog!, northDeg: null })}>${this._t('gs.north_clear')}</button>`
                  : nothing}
              </div>
              ${this._settingsDialog!.northDeg === null
                ? html`<div class="rhint">${this._t('gs.north_hint')}</div>`
                : nothing}
            </div>
          </div>
          <label class="srcrow">
            ${this._boolInput(this._settingsDialog!.sunRays, (v) =>
              (this._settingsDialog = { ...this._settingsDialog!, sunRays: v }))}
            <span>${this._t('gs.sun_rays')}</span>
          </label>
          <label class="dispsection">${this._t('gs.grid_group')}</label>
          <div class="rhint">${this._t('gs.grid_hint')}</div>
          <div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._openAlignDialog}>
              <ha-icon icon="mdi:broom"></ha-icon>${this._t('gs.align_all')}
            </button>
          </div>
          ${this._canOptimizeUndo ? html`<div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._undoPlanOptimization}
              ?disabled=${this._optimizeUndoBusy}>
              <ha-icon icon="mdi:undo-variant"></ha-icon>${this._t('gs.optimize_undo')}
            </button>
          </div>` : nothing}
          <label class="dispsection">${this._t('gs.about_group')}</label>
          <div class="aboutver">${this._t('gs.about_version', { v: CARD_VERSION })}</div>
          <a class="aboutlink" href="https://github.com/Matysh/houseplan-card" target="_blank" rel="noopener">
            <ha-icon icon="mdi:github"></ha-icon>${this._t('gs.about_github')}</a>
          <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener">
            <ha-icon icon="mdi:send"></ha-icon>${this._t('gs.about_telegram')}</a>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() =>
            (this._settingsDialog = { ...this._settingsDialog!, colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: this._imperial ? 9.8 : 3, bgColor: null, northDeg: null, bgMode: 'static', sunRays: false })}>
            ${this._t('gs.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._settingsDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveSettingsDialog} ?disabled=${this._settingsDialog!.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this._settingsDialog!.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

  // ================= ICON RULES EDITOR =================

  private _openRulesDialog = (): void => {
    if (!this._norm) return;
    const custom = this._settings.icon_rules;
    const rules = (custom && custom.length ? custom : DEFAULT_ICON_RULES).map((r) => ({ ...r }));
    this._rulesDialog = { rules, test: '', busy: false };
  };

  private _rulesSet(rules: IconRule[]): void {
    this._rulesDialog = { ...this._rulesDialog!, rules };
  }

  private async _saveRules(): Promise<void> {
    const dlg = this._rulesDialog;
    if (!dlg || dlg.busy) return;
    const cleaned = dlg.rules.filter((r) => r.pattern.trim() && r.icon.trim());
    this._rulesDialog = { ...dlg, busy: true };
    try {
      const cfg = this._serverCfg!;
      const isDefault = JSON.stringify(cleaned) === JSON.stringify(DEFAULT_ICON_RULES);
      const settings: any = { ...cfg.settings };
      if (isDefault) delete settings.icon_rules;
      else settings.icon_rules = cleaned;
      this._serverCfg = { ...cfg, settings };
      await this._saveConfigNow();
      this._rulesDialog = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast(this._t('rules.saved'));
    } catch (e: any) {
      // audit L3: the dialog may have been closed (Esc) while the save was
      // in flight — spreading null yields a truthy husk and the renderer
      // then crashes, blanking the whole card. The toast below is the
      // only remaining signal, so it must still fire.
      if (this._rulesDialog) this._rulesDialog = { ...this._rulesDialog, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  private _renderRulesDialog(): TemplateResult {
    const d = this._rulesDialog!;
    const compiled = compileIconRules(d.rules);
    const testIcon = d.test.trim() ? iconFor(d.test, '', compiled) : null;
    const move = (i: number, delta: number) => {
      const r = [...d.rules];
      const j = i + delta;
      if (j < 0 || j >= r.length) return;
      [r[i], r[j]] = [r[j], r[i]];
      this._rulesSet(r);
    };
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('rules.title')}
      icon="mdi:shape-plus-outline" wide @hp-close=${() => (this._rulesDialog = null)}>
        <div class="body">
          <div class="rhint">${this._t('rules.hint')}</div>
          <div class="rtest">
            <input class="namein" type="text" placeholder=${this._t('rules.test_ph')}
              .value=${d.test}
              @input=${(e: Event) => (this._rulesDialog = { ...d, test: (e.target as HTMLInputElement).value })} />
            ${testIcon ? html`<ha-icon icon=${testIcon}></ha-icon><span class="rtesticon">${testIcon}</span>` : nothing}
          </div>
          ${d.rules.map((r, i) => {
            const bad = r.pattern.trim() !== '' && !isValidPattern(r.pattern);
            return html`<div class="rrow">
              <input class="namein rpat ${bad ? 'bad' : ''}" type="text"
                placeholder=${this._t('rules.pattern_ph')}
                title=${bad ? this._t('rules.invalid') : ''}
                .value=${r.pattern}
                @input=${(e: Event) => {
                  const rules = [...d.rules];
                  rules[i] = { ...r, pattern: (e.target as HTMLInputElement).value };
                  this._rulesSet(rules);
                }} />
              <input class="namein ricon" type="text" placeholder=${this._t('rules.icon_ph')}
                .value=${r.icon}
                @input=${(e: Event) => {
                  const rules = [...d.rules];
                  rules[i] = { ...r, icon: (e.target as HTMLInputElement).value };
                  this._rulesSet(rules);
                }} />
              <ha-icon class="rprev" icon=${r.icon || 'mdi:chip'}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-up" title=${this._t('btn.up')}
                @click=${() => move(i, -1)}></ha-icon>
              <ha-icon class="ract" icon="mdi:arrow-down" title=${this._t('btn.down')}
                @click=${() => move(i, 1)}></ha-icon>
              <ha-icon class="ract del" icon="mdi:close" title=${this._t('btn.delete')}
                @click=${() => this._rulesSet(d.rules.filter((_, j) => j !== i))}></ha-icon>
            </div>`;
          })}
          <button class="btn ghost" @click=${() => this._rulesSet([...d.rules, { pattern: '', icon: '' }])}>
            <ha-icon icon="mdi:plus"></ha-icon>${this._t('rules.add')}
          </button>
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => this._rulesSet(DEFAULT_ICON_RULES.map((r) => ({ ...r })))}>
            ${this._t('rules.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._rulesDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveRules} ?disabled=${d.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

  private _saveKioskScale(patch: Partial<{ icon: number; font: number }>): void {
    this._kioskScale = { ...this._kioskScale, ...patch };
    try {
      localStorage.setItem(LS_KIOSK, JSON.stringify(this._kioskScale));
    } catch {
      /* ignore */
    }
    this.requestUpdate();
  }

  /** Per-SCREEN size settings (wall tablets differ) — stored locally. */
  private _renderKioskDialog(): TemplateResult {
    const k = this._kioskScale;
    const row = (key: 'icon' | 'font', label: string) => html`<label>${label}</label>
      <div class="colorrow">
        ${this._rangeInput(50, 300, 5, Math.round(k[key] * 100), (n) => this._saveKioskScale({ [key]: n / 100 }))}
        <span class="opv">${Math.round(k[key] * 100)}%</span>
      </div>`;
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('kiosk.title')} icon="mdi:tablet"
      dismiss-on-scrim @hp-close=${() => (this._kioskDialog = false)}>
        <div class="body">
          <div class="rhint">${this._t('kiosk.hint')}</div>
          ${row('icon', this._t('kiosk.icon_scale'))}
          ${row('font', this._t('kiosk.font_scale'))}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() => this._saveKioskScale({ icon: 1, font: 1 })}>${this._t('gs.reset')}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => (this._kioskDialog = false)}>${this._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

  // ================= render =================

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const model = this._model;
    const diagnostics = this.houseplanDiagnostics();
    if (!model.length) {
      return html`<ha-card
        data-ha-registry-access=${diagnostics.registry.access}
        data-ha-disabled-bindings=${diagnostics.bindings.ha_disabled}
        data-ha-unverified-bindings=${diagnostics.bindings.unverified}>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title || this._t('card.title')}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>${this._t('empty.no_spaces')}</p>
          ${this._serverStorage
            ? html`<p class="muted">${this._t('empty.add_first')}</p>
                <button class="btn on" @click=${() => this._openSpaceDialog('create')}>
                  <ha-icon icon="mdi:plus"></ha-icon>${this._t('btn.add_space')}
                </button>`
            : html`<p class="muted">${this._t('empty.install')}</p>`}
        </div>
        ${this._spaceDialog ? this._renderSpaceDialog() : nothing}
        ${this._importDialog ? this._renderImportDialog() : nothing}
        ${this._toast ? html`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>` : nothing}
      </ha-card>`;
    }
    const space = this._spaceModel();
    const vb = space.vb;
    // hidden devices render ONLY in the device editor with "show hidden" on
    // (ghosted); everywhere else the flag removes them from sight — but not
    // from the build, so room LQI still counts them (docs/FILTERING.md)
    const showGhosts = this._mode === 'devices' && this._showAll;
    const devs = this._devices.filter((d) => d.space === space.id && (!d.hidden || showGhosts));
    const disp = spaceDisplayOf(this._curSpaceCfg);
    const showLqi = disp.showLqi ?? this._config.show_signal ?? true;
    const cfgSize = this._config.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;
    const view = this._viewOr(vb);
    // Background around the plan (view/kiosk; editors keep their own canvas).
    // Both settings dialogs preview their pending value live.
    const stageBg = this._editing ? '' : this._stageBg(disp);
    // day/night breathing: armed only with a compass AND sun.sun (docs/SUN.md)
    const dayNight = !this._editing && this._effBgMode() === 'daynight' ? this._sunNow() : null;
    const planDim = dayNight ? dayPhase(skyElevation(dayNight.elevation)).planDim : 0;
    // opening rulers: the drag of an existing one OR the placement preview
    const opMeasure = this._opMeasureView;
    const decorMeasure = this._decorMeasure;
    const bdLive = this._bdLive;
    const furnLive = this._furnLive;
    const editorChromeMode = this._mode === 'view' ? this._editorChromeMode : this._mode;

    return html`
      <ha-card
        data-ha-registry-access=${diagnostics.registry.access}
        data-ha-disabled-bindings=${diagnostics.bindings.ha_disabled}
        data-ha-unverified-bindings=${diagnostics.bindings.unverified}>
        <div class="hdr ${this._kiosk ? 'kioskhide' : ''}">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title || this._t('card.title')}
          </div>
          <div class="tabs">
            ${model.map(
              (s) => html`<button
                data-hp="space-tab" data-id="${s.id}"
                class="tab ${this._space === s.id ? 'active' : ''}"
                @click=${() => this._pickSpace(s.id)}
              >
                ${s.title}${this._norm && this._canEdit
                  ? html`<ha-icon class="tabedit" icon="mdi:cog-outline"
                      title=${this._t('title.configure_space')}
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        this._openSpaceDialog('edit', s.id);
                      }}></ha-icon>`
                  : nothing}
              </button>`,
            )}
            ${''/* «Добавить пространство» is a NAVIGATION action, not a plan-editor
                   tool (owner 2026-08-04): it lives next to the floor names in every
                   mode, exactly where the per-space gear does. Kiosk is a shop
                   window — the whole .hdr is display:none there, but the button is
                   also not RENDERED, so nothing invisible is clickable. */}
            ${this._canEdit && !this._kiosk
              ? html`<button class="tab tabadd" title=${this._t('title.add_space')}
                  @click=${() => this._openSpaceDialog('create')}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`
              : nothing}
          </div>
          ${this._canEdit
            ? html`<div class="modes">
                ${([['plan', 'mdi:floor-plan'], ['devices', 'mdi:tune-variant'], ['decor', 'mdi:draw']] as const).map(
                  ([m, ic]) => html`<button class="modetab ${this._mode === m ? 'active' : ''}"
                    title=${this._t(('mode.' + m + '_tip') as any)}
                    @click=${() => { if (this._mode !== m) this._setMode(m); }}>
                    <ha-icon icon=${ic}></ha-icon><span class="ml">${this._t(('mode.' + m) as any)}</span>
                    ${this._mode === m
                      ? html`<ha-icon class="closex" icon="mdi:close" title=${this._t('title.close_editor')}
                          @click=${(e: Event) => { e.stopPropagation(); this._setMode('view'); }}></ha-icon>`
                      : nothing}
                  </button>`,
                )}
              </div>`
            : nothing}
          <span class="count">${this._t('count.devices', { n: devs.filter((d) => !d.hidden).length })}</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${() => this._stepZoom(-1)} title=${this._t('title.zoom_out')}><ha-icon icon="mdi:minus"></ha-icon></button>
            ${''/* docs/CANVAS.md §8: this IS «вписать всё» — the old "reset
                   zoom" renamed rather than duplicated. No longer disabled at
                   zoom 1: at zoom 1 panned off to the side it still has work. */}
            <button class="btn zb" @click=${() => this._fitAll()}
              title=${this._t('title.zoom_fit')}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${() => this._stepZoom(1)} title=${this._t('title.zoom_in')}><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm && this._canEdit
            ? html`<button class="btn" @click=${this._openSettingsDialog} title=${this._t('title.general_settings')}>
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>`
            : nothing}
        </div>
        ${this._canEdit && !this._kiosk
          ? html`<div class="editorchrome ${this._editing ? 'open' : ''}${this._navMotion ? ' nav-' + this._navMotion : ''}"
              aria-hidden=${this._editing ? 'false' : 'true'} ?inert=${!this._editing}>
              <div class="editorchrome-inner ${this._navMotion ? 'nav-' + this._navMotion : ''}">
                ${editorChromeMode === 'plan'
                  ? this._renderMarkupBar()
                  : editorChromeMode === 'devices'
                    ? this._renderDevicesBar()
                    : this._renderDecorBar()}
                ${''/* the palette lives UNDER the bar, above the stage: it is part of
                       the tool, not a modal — the plan stays visible while a symbol is
                       chosen, because where a sofa goes is a question about the plan */}
                ${editorChromeMode === 'decor' && this._decorTool === 'furniture'
                  ? this._renderFurnPalette()
                  : nothing}
              </div>
            </div>`
          : nothing}
        </div>

        <div class="stage ${this._markup ? 'markup tool-' + this._tool + (this._tool === 'split' && !this._splitSel ? ' pickstage' : '') + (this._tool === 'boundary' ? this._boundaryStageClass : '') + (this._tool === 'wallthick' && this._wallThickHover ? ' wallhot' : '') : ''} ${this._mode === 'decor' ? 'dtool-' + this._decorTool : ''} ${space.bg ? '' : 'noplan'} mode-${this._mode}${this._bdMovable ? ' bdgrab' : ''}${this._bdDrag ? ' bdgrabbing' : ''}${dayNight ? ' daynight' : ''}${dayNight && this._skySnap ? ' skysnap' : ''}${this._booting ? ' hpboot' : ''}${this._bootSoft ? ' hpsettle' : ''}${this._navMotion ? ' hpnav' : ''}${this._resumeSettling && this._mode === 'view' && !this._kiosk ? ' hpresume' : ''}"
          style="height:${this._kiosk ? '100dvh' : `calc(100dvh - ${this._hdrH}px)`}${stageBg ? `;background:${stageBg}` : ''};--wall-fill:${this._fillColors.wall_fill.c};--wall-fill-op:${this._fillColors.wall_fill.a}"
          @click=${(e: MouseEvent) => this._markupClick(e)}
          @wheel=${(e: WheelEvent) => this._onWheel(e)}
          @pointerdown=${(e: PointerEvent) => { this._notePointer(e); this._stagePointerDown(e); }}
          @pointermove=${(e: PointerEvent) => this._stagePointerMove(e)}
          @pointerup=${(e: PointerEvent) => this._stagePointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._stagePointerCancel(e)}>
          <div class="zoomwrap ${this._slide ? 'slide-' + this._slide : ''}${this._navMotion ? ' nav-' + this._navMotion : ''}"
            style="${dayNight ? `filter:brightness(${(1 - planDim).toFixed(3)})` : ''}">
          <svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMid meet">
            ${''/* THE PAPER IS THE ROOMS (docs/BACKDROP.md §3, owner
                   2026-08-04). Opaque shapes stop the scene background —
                   bg_color or the 'daynight' sky — from bleeding through the
                   plan. They follow the ROOM CONTOURS and nothing else: one
                   shape per room in exactly the room's own geometry, so an
                   L-shaped house or a pair of detached buildings never grows a
                   white bounding rectangle, and an empty space has no paper at
                   all. A backdrop image no longer makes paper of its own — it
                   is drawn ON this sheet, one layer below the geometry, so a
                   picture with transparency and no rooms under it shows the
                   scene through, which is the deliberate consequence.
                   `space` comes from _renderCfg, so a live resize preview
                   (_rszPreview) moves the paper together with the rooms.
                   One <g> around ALL paper shapes: the daynight drop shadow
                   (styles.ts) is composited once for the whole sheet, so
                   adjacent rooms never cast seams onto each other's paper. */}
            ${this._wallHatchDefs(disp.color)}${svg`<g class="hp-paperg">${this._paperShapes(space.rooms).map((sh) =>
              'poly' in sh
                ? svg`<polygon class="hp-paper" points="${sh.poly}" pointer-events="none"></polygon>`
                : svg`<rect class="hp-paper" x="${sh.rect.x}" y="${sh.rect.y}" width="${sh.rect.w}" height="${sh.rect.h}" rx="${sh.rect.rx}" pointer-events="none"></rect>`,
              )}</g>`}
            ${this._editing ? this._renderMarkupDefs(vb) : nothing}
            ${''/* the grid is a property of the plane, not of a box: it follows
                   the VIEW so it is there wherever you pan (docs/CANVAS.md §7) */}
            ${this._editing && !this._markup && this._gridLevels()
              ? svg`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`
              : nothing}
            ${space.bg && this._display(space.bg.href)
              ? svg`<image href="${this._display(space.bg.href)}" x="${space.bg.x}" y="${space.bg.y}" width="${space.bg.w}" height="${space.bg.h}"
                  opacity="${this._mode === 'decor' && this._decorTool !== 'backdrop' ? 0.5 : 1}"
                  transform=${space.bg.angle
                    ? `rotate(${space.bg.angle} ${space.bg.x + space.bg.w / 2} ${space.bg.y + space.bg.h / 2})`
                    : nothing}
                  @dblclick=${(e: Event) => this._openBackdropDialog(e)}
                  preserveAspectRatio="none" />`
              : nothing}
            ${''/* «Скрыть декоративный слой» (space.hide_decor). The layer is
                   still THERE — the shapes are in the config and the decor
                   editor draws them as always, because a layer you cannot see
                   is a layer you cannot edit. Every other mode simply stops
                   painting it. */}
            ${disp.hideDecor && this._mode !== 'decor' ? nothing : this._renderDecorLayer()}
            ${(() => {
              // audit L1: hoisted out of the per-room map — these depend on the
              // config, not on entity state, and were recomputed per room.
              const allPairs = this._openPairs();
              const polyCache = new Map<any, number[][] | null>();
              const polyOf = (rr: any) => {
                if (!polyCache.has(rr)) polyCache.set(rr, roomPoly(rr));
                return polyCache.get(rr)!;
              };
              const otherPolys = (rr: any) =>
                space.rooms.filter((o) => o !== rr).map(polyOf).filter(Boolean) as number[][][];
              return space.rooms.filter((r) => r.area || this._mode === 'view' || this._markup || disp.showBorders).map((r) => {
              let cls = 'room ' + (space.bg ? 'overlay' : 'yard') + (this._markup ? ' outlined' : '');
              if (this._markup && (r.id === this._mergeSel || r.id === this._splitSel?.roomId))
                cls += ' picked';
              let style = '';
              const effFill = roomFillModeOf(disp.fill, r);
              if (!this._markup && (disp.showBorders || effFill !== 'none')) {
                cls += ' styled';
                const st: string[] = [];
                // keep the stroke colour even when borders are hidden, so hover can reveal it
                st.push(`--room-stroke:${disp.color}`, `--room-stroke-op:${disp.showBorders ? disp.opacity : 0}`);
                const fillC = effFill === 'glow'
                  // glow: uniform darkness (a room override may opt OUT of it)
                  ? this._fillColors.glow_base
                  : effFill === 'temp'
                  // temp works without an HA area when a tier-3 source is set
                  ? roomFillStyle('temp', null, 'none', this._roomTemp(r),
                      disp.tempMin, disp.tempMax, this._fillColors)
                  : effFill === 'light'
                  // marker.room_id also supports rooms without an HA area
                  ? roomFillStyle(
                      'light', null,
                      resolvedLightState(resolvedLightSources(this._planHass, this._devices, r)),
                      null, disp.tempMin, disp.tempMax, this._fillColors,
                    )
                  : r.area
                  ? roomFillStyle(
                      effFill,
                      effFill === 'lqi' ? this._roomLqi(r.area) : null,
                      'none',
                      null,
                      disp.tempMin,
                      disp.tempMax,
                      this._fillColors,
                    )
                  : null;
                if (fillC) {
                  cls += ' filled';
                  st.push(`--room-fill:${fillC.c}`, `--room-fill-op:${fillC.a.toFixed(3)}`);
                } else st.push('--room-fill:transparent', '--room-fill-op:0');
                style = st.join(';');
              }
              let areaText: string | null | undefined;
              const tip = (e: MouseEvent) => {
                if (this._mode !== 'view') return;
                if (areaText === undefined) areaText = this._roomArea(r);
                this._showTip(
                  e,
                  r.name || this._t('room.unnamed'),
                  areaText ? this._t('tip.area', { value: areaText }) : '',
                  showLqi ? this._roomLqi(r.area) : null,
                  this._roomTemp(r),
                );
              };
              const label = !space.bg && !disp.showNames && !this._markup;
              const c = this._roomCenter(r);
              // open boundaries: this room's solid stroke must not run beneath
              // the dashed stretches — suppress it and draw a trimmed outline.
              // Applies in the Plan editor too (picked rooms keep their full
              // amber highlight — the merge/split selection must stay visible).
              const isPicked = this._markup && (r.id === this._mergeSel || r.id === this._splitSel?.roomId);
              const openCuts = r.id && !isPicked
                ? allPairs.filter((pp) => pp.a.id === r.id || pp.b.id === r.id).flatMap((pp) => pp.segs)
                : [];
              const thickCuts = !isPicked ? this._thickWallCuts() : [];
              const edgeCuts = openCuts.concat(thickCuts);
              if (edgeCuts.length) cls += ' noedge';
              // island rooms punch holes in their parent's fill (evenodd)
              const myPoly = polyOf(r);
              const walls = this._spaceWalls;
              const fillPoly = (walls.length && r.id && myPoly)
                ? (innerContourForRoom(
                    space.rooms, r.id, walls,
                    this._openPairs().flatMap((p) => p.segs),
                    this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
                  ) || myPoly)
                : myPoly;
              const holes = fillPoly ? islandsOf(fillPoly, otherPolys(r)) : [];
              const pathD = (pts: number[][]) =>
                'M ' + pts.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z';
              const obstaclePath = fillPoly ? this._cleanFloor(r, fillPoly, space).path : '';
              // docs/STYLING-HOOKS.md §3 — the same three hooks whichever SVG
              // element this room happens to be drawn as today
              const hpId = r.id || nothing;
              const hpArea = r.area || nothing;
              const shape = obstaclePath && fillPoly
                ? svg`<path class="${cls}" style="${style}" fill-rule="evenodd"
                    data-hp="room" data-id=${hpId} data-area=${hpArea}
                    d="${[obstaclePath, ...holes.map(pathD)].join(' ')}"
                    @mouseenter=${() => (this._hoverRoom = { space: space.id, room: r })}
                    @mousemove=${tip}
                    @mouseleave=${() => { this._tip = null; this._hoverRoom = null; }}></path>`
                : holes.length && fillPoly
                ? svg`<path class="${cls}" style="${style}" fill-rule="evenodd"
                    data-hp="room" data-id=${hpId} data-area=${hpArea}
                    d="${[fillPoly, ...holes].map(pathD).join(' ')}"
                    @mouseenter=${() => (this._hoverRoom = { space: space.id, room: r })}
                    @mousemove=${tip}
                    @mouseleave=${() => { this._tip = null; this._hoverRoom = null; }}></path>`
                 : fillPoly && fillPoly !== myPoly
                 ? svg`<polygon class="${cls}" style="${style}" points="${fillPoly.map((p) => p.join(',')).join(' ')}"
                     data-hp="room" data-id=${hpId} data-area=${hpArea}
                    @mouseenter=${() => (this._hoverRoom = { space: space.id, room: r })}
                    @mousemove=${tip}
                    @mouseleave=${() => { this._tip = null; this._hoverRoom = null; }}></polygon>`
                 : r.poly
                 ? svg`<polygon class="${cls}" style="${style}" points="${r.poly.map((p) => p.join(',')).join(' ')}"
                     data-hp="room" data-id=${hpId} data-area=${hpArea}
                    @mouseenter=${() => (this._hoverRoom = { space: space.id, room: r })}
                    @mousemove=${tip}
                    @mouseleave=${() => { this._tip = null; this._hoverRoom = null; }}></polygon>`
                 : svg`<rect class="${cls}" style="${style}"
                     data-hp="room" data-id=${hpId} data-area=${hpArea}
                     x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w!, r.h!) * 0.03}"
                    @mouseenter=${() => (this._hoverRoom = { space: space.id, room: r })}
                    @mousemove=${tip}
                    @mouseleave=${() => { this._tip = null; this._hoverRoom = null; }}></rect>`;
              const trimmed = edgeCuts.length && myPoly
                ? outlineWithout(myPoly, edgeCuts, this._gridPitch * 0.02)
                : null;
              const outline = trimmed
                ? svg`<path class="room-outline ${this._markup ? 'outlined' : ''}"
                    d="${trimmed.map((sg) => `M ${sg[0]} ${sg[1]} L ${sg[2]} ${sg[3]}`).join(' ')}"
                    style=${this._markup ? nothing : `stroke:${disp.color};stroke-opacity:${disp.showBorders ? disp.opacity : 0}`}></path>`
                : nothing;
              return svg`${shape}${outline}${label ? svg`<text class="rlabel"
                data-hp="room-label" data-id=${hpId} data-area=${hpArea}
                x="${c[0]}" y="${c[1]}">${r.name}</text>` : nothing}`;
              });
            })()}
            ${disp.fill === 'glow' && !this._markup ? this._renderGlowLayer(space) : nothing}
            ${this._renderSunRays(space)}
            ${this._editing ? this._renderAlignGuides() : nothing}
            ${opMeasure?.guide ? this._renderOpeningCenterTick(opMeasure.guide) : nothing}
            ${this._markup ? this._renderMarkupLayer(vb) : nothing}
            ${''/* «Скрыть проёмы» (space.hide_openings) — same deal: the plan
                   editor keeps drawing doors, windows and gates so they stay
                   editable, and only the symbols are hidden elsewhere. What
                   an opening MEANS is untouched: light still spills through
                   it, the sun still comes in at its window, and the contact
                   sensor still opens it. */}
            ${''/* View: virtual geometry still meets real walls on their
                   centreline, but paints BELOW the physical wall body. The
                   hatch therefore masks the visually awkward half-dashes
                   inside thick jambs without changing the stored span. */}
            ${!this._editing ? this._renderOpenWalls(disp) : nothing}
            ${this._renderWallBodies(disp)}
            ${this._renderRoomHover(space)}
            ${''/* Editors: saved virtual boundaries and the live two-click
                   preview deliberately paint AFTER real wall bodies. Their
                   full centreline geometry remains visible for editing. */}
            ${this._editing ? this._renderOpenWalls(disp) : nothing}
            ${disp.hideOpenings && !this._markup ? nothing : this._renderOpenings(disp)}
            ${this._renderWallThickUi()}
            ${this._markup && this._tool === 'resize' ? this._renderResizeLayer(view) : nothing}
            ${''/* editor chrome, not plan content: the backdrop frame sits on
                   top of everything the plan draws so its handles stay
                   grabbable (docs/BACKDROP.md §2). It exists only in the
                   backdrop editor, where rooms and devices are pointer-inert. */}
            ${this._renderBackdropFrame(view)}
            ${this._renderTextFrame(view)}
          </svg>
          ${''/* docs/CANVAS.md §6: an icon is a percentage of the PLAN and
                 scales with it when you zoom — the behaviour the card always
                 had, restored by the owner. `iconCqw` is `iconPct * iconUnit
                 / view.w`: the old expression with the stored `vb.w` replaced
                 by the plan's own base unit, which is the same NORM_W for an
                 ordinary plan (pixel-identical) but grows with a plan drawn
                 past the old square, where a fixed 1000 would have shrunk
                 every marker to a dot. Same expression as the static
                 space-card, so the two renderers agree. The per-device
                 multiplier and the kiosk scales still feed --dev-size. */}
          <div class="devlayer" style="--icon-size:${iconCqw(iconPct, space, view.w, this._kiosk ? this._kioskScale.icon : 1).toFixed(3)}cqw;--rl-font:${this._kiosk ? this._kioskScale.font : 1}">
            ${devs.map((d) => this._renderDevice(d, view, showLqi))}
            ${this._renderVacuums(devs, view)}
            ${this._renderVacFit(view)}
            ${this._renderOpeningLocks(view)}
            ${disp.showNames || this._markup
              ? space.rooms.map((r) => this._renderRoomLabel(r, space, view, disp))
              : nothing}
            ${this._markup ? space.rooms.map((r) => this._renderRoomGear(r, space, view)) : nothing}
          </div>
          ${this._measureAnchor
            ? html`<div class="measurelayer">${this._renderMeasureLabel(view)}</div>`
            : nothing}
          ${this._rszLive
            ? html`<div class="measurelayer">${this._rszLive.map((l) => html`<div
                class="measurelabel ${l.area ? 'rszarea' : ''}"
                style="left:${(((l.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((l.y - view.y) / view.h) * 100).toFixed(2)}%">${l.text}</div>`)}</div>`
            : nothing}
          ${opMeasure
            ? html`<div class="measurelayer">${opMeasure.labels.map((l) => html`<div
                class="measurelabel opshoulder"
                style="left:${(((l.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((l.y - view.y) / view.h) * 100).toFixed(2)}%">${l.text}</div>`)}</div>`
            : nothing}
          ${this._wallDialog
            ? html`<div class="measurelayer">${this._renderWallThickDialog()}</div>`
            : nothing}
          ${decorMeasure
            ? html`<div class="measurelayer"><div
                class="measurelabel dmeasure ${decorMeasure.on45 ? 'on45' : ''}"
                style="left:${(((decorMeasure.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((decorMeasure.y - view.y) / view.h) * 100).toFixed(2)}%">${decorMeasure.text}</div></div>`
            : nothing}
          ${furnLive
            ? html`<div class="measurelayer">${furnLive.map((l) => html`<div
                class="measurelabel furnmeasure"
                style="left:${(((l.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((l.y - view.y) / view.h) * 100).toFixed(2)}%">${l.text}</div>`)}</div>`
            : nothing}
          ${bdLive
            ? html`<div class="measurelayer"><div
                class="measurelabel bdmeasure"
                style="left:${(((bdLive.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((bdLive.y - view.y) / view.h) * 100).toFixed(2)}%">${bdLive.text}</div></div>`
            : nothing}
          </div>
          ${this._zoom > 1
            ? html`<div class="zoombadge">${Math.round(this._zoom * 100)}%</div>`
            : nothing}
          ${this._renderFarHint()}
          ${this._renderHomeArrow()}
          ${this._booting || this._bootFading
            ? html`<div class="bootveil ${this._booting ? '' : 'off'}" aria-hidden="true">
                <svg class="boothouse" viewBox="0 0 24 24"><path d="${mdiHomeCityOutline}"></path></svg>
              </div>`
            : nothing}
        </div>

        ${this._roomDialog ? this._renderRoomDialog() : nothing}
        ${this._mergeDialog ? this._renderMergeDialog() : nothing}
        ${this._openingDialog ? this._renderOpeningDialog() : nothing}
        ${this._physicalDialog ? this._renderPhysicalDialog() : nothing}
        ${this._openingInfo ? this._renderOpeningInfoCard() : nothing}
        ${this._decorTextDialog ? this._renderDecorTextDialog() : nothing}
        ${this._decorShapeDialog ? this._renderDecorShapeDialog() : nothing}
        ${this._backdropDialog ? this._renderBackdropDialog() : nothing}
        ${this._decorEraseConfirm ? this._renderDecorEraseConfirm() : nothing}
        ${this._spaceDialog ? this._renderSpaceDialog() : nothing}
        ${this._markerDialog ? this._renderMarkerDialog() : nothing}
        ${this._infoCard ? this._renderInfoCard() : nothing}
        ${this._rulesDialog ? this._renderRulesDialog() : nothing}
        ${this._settingsDialog ? this._renderSettingsDialog() : nothing}
        ${this._alignDialog ? this._renderAlignDialog() : nothing}
        ${this._importDialog ? this._renderImportDialog() : nothing}
        ${this._tip
          ? html`<div class="tip" style="left:${this._tip.x + 12}px;top:${this._tip.y + 12}px">
              <b>${this._tip.title}</b>${this._tip.meta ? html`<span class="m">${this._tip.meta}</span>` : nothing}
              ${this._tip.temp != null
                ? html`<span class="m">${this._t('tip.temp_avg')} <b>${this._tip.temp}°</b></span>`
                : nothing}
              ${this._tip.lqi != null
                ? html`<span class="m">${this._t('tip.lqi')}
                    <b style="color:${lqiColor(this._tip.lqi)}">${this._tip.lqi}</b></span>`
                : nothing}
            </div>`
          : nothing}
        ${this._kiosk && this._kioskDots && this._model.length > 1
          ? html`<div class="kioskdots">
              ${this._model.map((m) => html`<span class="kdot ${m.id === this._space ? 'on' : ''}"></span>`)}
            </div>`
          : nothing}
        ${this._kioskDialog ? this._renderKioskDialog() : nothing}
        ${this._vacFit ? html`<div class="vaccalbar">
          <span>${this._t('vac.fit_hint')}</span>
          <button class="btn ghostbtn" @click=${() => this._vacFitTurn({ rot: ((this._vacFit!.p.rot + 90) % 360) as any })}>${this._t('vac.fit_rotate')}</button>
          <button class="btn ghostbtn" @click=${() => this._vacFitTurn({ mir: !this._vacFit!.p.mir })}>${this._t('vac.fit_mirror')}</button>
          <button class="btn" @click=${() => this._vacFitSave()}>${this._t('btn.save')}</button>
          <button class="btn ghostbtn" @click=${() => { this._vacFit = null; }}>${this._t('btn.cancel')}</button>
        </div>` : nothing}
        ${this._tapConfirm
          ? html`<hp-dialog .hass=${this.hass} .title=${this._t('btn.run')} icon="mdi:alert-outline"
              dismiss-on-scrim @hp-close=${() => (this._tapConfirm = null)}>
                <div class="body"><p>${this._tapConfirm.text}</p></div>
                <div class="row" slot="footer">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${() => (this._tapConfirm = null)}>${this._t('btn.cancel')}</button>
                  <button class="btn on" @click=${() => { const c = this._tapConfirm!; this._tapConfirm = null; c.exec(); }}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.run')}
                  </button>
                </div>
            </hp-dialog>`
          : nothing}
        ${this._toast ? html`<div class="toast" role="alert" aria-live="assertive">${this._toast}</div>` : nothing}
      </ha-card>
    `;
  }


  // ---------------- live robot vacuums (docs/VACUUM.md) ----------------

  /** The live-position source entity for a vacuum device, or null. */
  private _vacSource(d: DevItem): string | null {
    const v = d.marker?.vacuum;
    if (v?.live === false) return null;
    if (v?.source && this.hass?.states[v.source]) return v.source;
    for (const eid of d.entities || []) {
      if (isVacSourceState(this.hass?.states[eid])) return eid;
    }
    return null;
  }

  private _vacEntity(d: DevItem): string | null {
    if (d.primary?.startsWith('vacuum.')) return d.primary;
    return (d.entities || []).find((e) => e.startsWith('vacuum.')) || null;
  }

  private _isVacDev(d: DevItem): boolean {
    return !!this._vacEntity(d);
  }

  /** Start/restart a short semantic event or direct-terminal transition. */
  private _activitySourceKey(d: DevItem): string {
    return presentationSourceSignature(
      this._planHass, d, this._config?.show_temperature !== false,
    );
  }

  private _activitySnapshot(d: DevItem): { samples: EntityVisualSample[]; sourceKey: string } {
    const sources = resolvePresentationSources(this._planHass, d);
    return {
      samples: sources.samples,
      sourceKey: presentationSourceSignature(
        this._planHass, d, this._config?.show_temperature !== false, sources,
      ),
    };
  }

  private _stampActivity(id: string, kind: 'event' | 'transition', sources?: string): void {
    let rt = this._activityRt.get(id);
    if (!rt) {
      rt = { sources: sources || '', last: {}, flashTs: 0, flashKind: null, timer: 0, gen: 0 };
      this._activityRt.set(id, rt);
    }
    if (sources != null) rt.sources = sources;
    // Event outranks a transition when two sources change in the same hass tick.
    if (rt.flashTs && Date.now() - rt.flashTs < ACTIVITY_WINDOW_MS && rt.flashKind === 'event' && kind === 'transition') return;
    rt.flashTs = Date.now();
    rt.flashKind = kind;
    rt.gen++;
    clearTimeout(rt.timer);
    rt.timer = window.setTimeout(() => this.requestUpdate(), ACTIVITY_WINDOW_MS + 60);
  }

  /**
   * Bring activity runtime in sync with the marker/source graph without
   * classifying an edge. Called after every device rebuild as well as before a
   * hass tick: new sources get a baseline, rebound sources lose the old flash,
   * and removed markers cannot leave timers behind.
   */
  private _syncActivityRuntime(): Map<string, { samples: EntityVisualSample[]; sourceKey: string }> {
    const snapshots = new Map<string, { samples: EntityVisualSample[]; sourceKey: string }>();
    if (!this.hass) return snapshots;
    const live = new Set<string>();
    for (const d of this._devices) {
      if (d.hidden) continue;
      live.add(d.id);
      const snapshot = this._activitySnapshot(d);
      snapshots.set(d.id, snapshot);
      const { samples, sourceKey } = snapshot;
      let rt = this._activityRt.get(d.id);
      if (!rt) {
        rt = { sources: sourceKey, last: {}, flashTs: 0, flashKind: null, timer: 0, gen: 0 };
        for (const sample of samples) rt.last[sample.eid] = sample.state;
        this._activityRt.set(d.id, rt);
        continue;
      }
      if (rt.sources === sourceKey) continue;
      // A brief unknown/unavailable state can change the effective role graph.
      // Resetting here prevents recovery from becoming a false fresh event.
      clearTimeout(rt.timer);
      rt.sources = sourceKey;
      rt.last = {};
      rt.flashTs = 0;
      rt.flashKind = null;
      for (const sample of samples) rt.last[sample.eid] = sample.state;
    }
    for (const [id, rt] of this._activityRt) {
      if (live.has(id)) continue;
      clearTimeout(rt.timer);
      this._activityRt.delete(id);
    }
    return snapshots;
  }

  /**
   * One pass per hass tick records every effective source. Only a witnessed,
   * meaningful edge starts a short effect: first load and recovery from
   * unknown/unavailable establish a baseline and never fake a detection.
   */
  private _activityTick(): void {
    if (!this.hass) return;
    const snapshots = this._syncActivityRuntime();
    for (const d of this._devices) {
      if (d.hidden) continue;
      const snapshot = snapshots.get(d.id) || this._activitySnapshot(d);
      const { samples, sourceKey } = snapshot;
      const rt = this._activityRt.get(d.id);
      if (!rt || rt.sources !== sourceKey) continue;
      // A direct closed↔open fallback is only a substitute for integrations
      // that omit opening/closing. Once a real travelling state is observed,
      // it owns the ring and the old 3.3 s fallback is discarded.
      if (rt.flashKind === 'transition' && samples.some((sample) => sample.activity === 'transition')) {
        clearTimeout(rt.timer);
        rt.flashTs = 0;
        rt.flashKind = null;
      }
      let edge: 'event' | 'transition' | null = null;
      for (const sample of samples) {
        const found = edgeActivity(rt.last[sample.eid], sample);
        if (found === 'event' || (!edge && found)) edge = found;
        rt.last[sample.eid] = sample.state;
      }
      if (edge) this._stampActivity(d.id, edge, sourceKey);
    }
  }

  /**
   * Trail buffers live OUTSIDE render: every hass tick appends the raw robot
   * position, so the trail survives view switches and zoom without ever being
   * part of reactive state (600 points re-rendering the world would hurt).
   */
  private _vacTick(): void {
    if (!this.hass) return;
    for (const d of this._devices) {
      if (d.hidden || !this._isVacDev(d)) continue;
      const src = this._vacSource(d);
      if (!src) continue;
      const vacEnt = this._vacEntity(d);
      const moving = isVacMoving(this.hass.states[vacEnt || '']?.state);
      const tele = readVacTelemetry(this.hass.states[src]?.attributes);
      let rt = this._vacRt.get(d.id);
      if (!rt) {
        rt = { trail: [], lastKey: '', lastTs: 0, moving: false, jump: false, endedTs: 0, lastPos: null };
        this._vacRt.set(d.id, rt);
      }
      if (moving && !rt.moving) { rt.trail = []; rt.lastPos = null; } // a fresh run
      const wantTrail = vacTrailMode(d.marker?.vacuum) !== 'never' && !tele?.path;
      if (!moving && rt.moving) {
        rt.endedTs = Date.now();
        // the run is over: the puck has arrived everywhere it was going
        if (wantTrail && rt.lastPos) rt.trail = pushTrailPoint(rt.trail, rt.lastPos, 40);
        rt.lastPos = null;
      }
      rt.moving = moving;
      const pos = tele?.pos;
      if (moving && pos) {
        const key = pos.x + ':' + pos.y;
        if (key !== rt.lastKey) {
          const now = Date.now();
          // a long silence then a far point = sparse cloud data: teleport, no glide
          rt.jump = rt.lastTs > 0 && now - rt.lastTs > VAC_TELEPORT_GAP_MS;
          rt.lastKey = key;
          rt.lastTs = now;
          // the trail lags ONE point behind: when a new target arrives the puck
          // has just (visually) reached the previous one — a segment must never
          // outrun the icon (owner report 2026-07-31)
          if (wantTrail && rt.lastPos) rt.trail = pushTrailPoint(rt.trail, rt.lastPos, 40);
          rt.lastPos = [pos.x, pos.y];
        }
      }
    }
  }



  /**
   * HP-1540-01: an auto-discovered vacuum has NO config marker until the first
   * general Save of its dialog, yet the «Живая позиция» section is already
   * interactive. Every vacuum handler used to `cfg.markers.find(...)` and
   * silently no-op without one — auto-calibration even toasted success while
   * saving nothing. Materialise a minimal marker (same id/binding the dialog
   * Save would produce — see _saveMarker/markerIdForBinding) before any
   * vacuum write, so the write has somewhere real to land.
   */
  private _vacEnsureMarker(d: DevItem): Marker | null {
    const cfg = this._serverCfg;
    if (!cfg) return null;
    cfg.markers = cfg.markers || [];
    const existing = cfg.markers.find((x: Marker) => x.id === d.id);
    if (existing) return existing;
    if ((d.bindingKind !== 'device' && d.bindingKind !== 'entity') || !d.bindingRef) return null;
    const m: Marker = {
      id: d.id,
      binding: d.bindingKind + ':' + d.bindingRef,
      space: d.space || null,
      area: d.area || null,
      // explicit like _saveMarker: a marker of any kind tells the seeder
      // "the user decided" (docs/FILTERING.md)
      hidden: d.hidden ? true : false,
    };
    cfg.markers.push(m);
    return m;
  }

  /** «Живая позиция» in the device dialog — vacuum markers only. */
  private _renderVacSection(dlg: any): TemplateResult | typeof nothing {
    const dev = this._devices.find((x) => x.id === dlg.devId);
    if (!dev || !this._isVacDev(dev)) return nothing;
    const v = dev.marker?.vacuum || {};
    const src = this._vacSource(dev);
    const tele = src ? readVacTelemetry(this.hass?.states[src]?.attributes) : null;
    const tierA = !!(tele && tele.rooms.length >= 3);
    const status = tele?.pos
      ? subst(this._t('vac.status_found'), { name: src || '' })
      : this._t('vac.status_none');
    const cals = Object.keys(v.calibration || {});
    const setVac = (patch: Record<string, unknown>) => {
      // HP-1540-01: materialise the marker first — find() alone silently
      // dropped every edit for a vacuum that had never been saved
      const m = this._vacEnsureMarker(dev);
      if (!m) return;
      m.vacuum = { ...(m.vacuum || {}), ...patch };
      this._regSignature = '';
      this._saveConfig();
      this.requestUpdate();
    };
    return html`
      <label>${this._t('vac.section')}</label>
      <div class="bindbox vacbox">
        <div class="rhint">${status}</div>
        ${tele ? html`
          <div class="vacbtns">
            ${tierA ? html`<button class="btn" @click=${() => this._vacAutoCalibrate(dev)}>${this._t('vac.autocal')}</button>` : nothing}
            <button class="btn ghostbtn" @click=${() => this._vacStartFit(dev)}>${this._t('vac.fit')}</button>
          </div>
          <label class="srcrow">
            ${this._boolInput(v.live !== false, (on) => setVac({ live: on ? null : false }))}
            <span>${this._t('vac.live')}</span>
          </label>
          <label>${this._t('vac.trail')}</label>
          <select class="areasel"
            @change=${(e: Event) => setVac({ trail_mode: (e.target as HTMLSelectElement).value, trail: null })}>
            ${(['never', 'cleaning', 'always'] as const).map((mv) => html`
              <option value=${mv} ?selected=${vacTrailMode(v) === mv}>${this._t(('vac.trail_' + mv) as any)}</option>`)}
          </select>
          ${cals.length ? html`<div class="rhint">${subst(this._t('vac.cal_maps'), { maps: cals.join(', ') })}</div>` : nothing}
        ` : nothing}
      </div>`;
  }

  /**
   * The active-map id. The camera rarely names its map; Dreame keeps the
   * human-readable one on the vacuum entity (selected_map, verified against a
   * live X50 Master) — without this both floors would share one matrix.
   */
  private _vacMapId(d: DevItem, tele: { mapId: string }): string {
    // HP-1541-01: nullish, not truthy — selected_map: 0 is a real map id and
    // must equal what trails.py resolve_map_id stores server-side.
    const ve = this._vacEntity(d);
    const sel = ve ? this.hass?.states[ve]?.attributes?.selected_map : null;
    return vacMapIdWithFallback(tele.mapId, sel);
  }

  /** Persist a solved matrix into marker.vacuum.calibration[mapId].
   *  Returns whether the write actually landed — callers must not toast
   *  success otherwise (HP-1540-01). */
  private _vacSaveMatrix(markerId: string, source: string, mapId: string, matrix: Affine): boolean {
    // HP-1540-01: a first-use vacuum has no marker yet — materialise it
    const dev = this._devices.find((x) => x.id === markerId);
    const m = dev ? this._vacEnsureMarker(dev)
      : this._serverCfg?.markers?.find((x: Marker) => x.id === markerId);
    if (!m) return false;
    const v = { ...(m.vacuum || {}) };
    v.source = source;
    v.calibration = { ...(v.calibration || {}), [mapId]: matrix.map((n) => Number(n.toFixed(6))) };
    m.vacuum = v;
    this._regSignature = '';
    this._saveConfig();
    this.requestUpdate();
    return true;
  }

  /** «Настроить автоматически»: robot rooms ↔ plan rooms by name. */
  private _vacAutoCalibrate(d: DevItem): void {
    const src = this._vacSource(d);
    const tele = src ? readVacTelemetry(this.hass?.states[src]?.attributes) : null;
    if (!src || !tele || tele.rooms.length < 3) {
      this._showToast(this._t('vac.autocal_no_rooms'));
      return;
    }
    const sp = this._spaceModel(d.space);
    const planRooms = (sp?.rooms || [])
      // HP-1540-04: legacy rectangle rooms (x/y/w/h) are still first-class
      // everywhere else — roomPoly() gives the same 4-corner outline the
      // renderer uses, so they must count for name-matching too. The old
      // r.poly?.length filter dropped them and then blamed the room names.
      .map((r: any) => ({ r, poly: roomPoly(r) }))
      .filter(({ r, poly }: any) => r.name && poly)
      .map(({ r, poly }: any) => {
        const c = poleOfInaccessibility(poly);
        return { name: r.name, cx: c[0], cy: c[1] };
      });
    const res = autoCalibrate(tele.rooms, planRooms);
    if (!res) {
      this._showToast(this._t('vac.autocal_no_match'));
      return;
    }
    // residual gate: 5% of the canvas ≈ 40 cm in a typical house
    // HP-1540-01: toast success ONLY after the matrix verifiably landed in
    // the config — the old code always claimed victory, even as a no-op
    if (!this._vacSaveMatrix(d.id, src, this._vacMapId(d, tele), res.matrix)) return;
    if (res.residual > NORM_W * 0.05) {
      this._showToast(subst(this._t('vac.autocal_res_warn'), { rooms: String(res.matched.length) }));
    }
    this._showToast(subst(this._t('vac.autocal_done'), { rooms: String(res.matched.length) }));
  }

  /** «Подогнать вручную»: open the fit overlay and leave the dialog. */
  private _vacStartFit(d: DevItem): void {
    const src = this._vacSource(d);
    const tele = src ? readVacTelemetry(this.hass?.states[src]?.attributes) : null;
    if (!src || !tele) {
      this._showToast(this._t('vac.cal_need_pos'));
      return;
    }
    const mapId = this._vacMapId(d, tele);
    const existing = d.marker?.vacuum?.calibration?.[mapId] as Affine | undefined;
    const sp = this._spaceModel(d.space);
    const vb = (sp?.vb || [0, 0, NORM_W, NORM_W]) as [number, number, number, number];
    const p = (existing && existing.length === 6 && fitFromMatrix(existing))
      || initialFit(tele.rooms, vb);
    this._markerDialog = null;
    if (d.space !== this._space) this._space = d.space;
    this._vacFit = { markerId: d.id, source: src, mapId, p, drag: null };
  }

  private _vacFitSave(): void {
    const f = this._vacFit;
    if (!f) return;
    // HP-1540-01: no success toast for a save that did not happen
    const ok = this._vacSaveMatrix(f.markerId, f.source, f.mapId, fitMatrix(f.p));
    this._vacFit = null;
    if (ok) this._showToast(this._t('vac.cal_done'));
  }

  /** Rotate/mirror around the ghost centre so the map does not fly away. */
  private _vacFitTurn(patch: Partial<FitParams>): void {
    const f = this._vacFit;
    if (!f) return;
    const tele = readVacTelemetry(this.hass?.states[f.source]?.attributes);
    const c = this._vacGhostCentre(tele?.rooms || []);
    const next = { ...f.p, ...patch } as FitParams;
    this._vacFit = { ...f, p: reanchorFit(next, f.p, c[0], c[1]) };
  }

  private _vacGhostCentre(rooms: VacRoom[]): VacPt {
    const xs: number[] = [], ys: number[] = [];
    for (const r of rooms) {
      xs.push(r.x0 ?? r.cx, r.x1 ?? r.cx);
      ys.push(r.y0 ?? r.cy, r.y1 ?? r.cy);
    }
    if (!xs.length) return [0, 0];
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }

  /** px→canvas-units for a pointer delta, via the current stage size. */
  private _vacDelta(view: { w: number; h: number }, dxPx: number, dyPx: number): VacPt {
    const st = this._stageEl;
    const w = st?.clientWidth || 1, h = st?.clientHeight || 1;
    return [(dxPx / w) * view.w, (dyPx / h) * view.h];
  }

  private _vacFitPointer(ev: PointerEvent, view: { x: number; y: number; w: number; h: number }): void {
    const f = this._vacFit;
    if (!f) return;
    ev.stopPropagation();
    if (ev.type === 'pointerdown') {
      const t = ev.target as HTMLElement;
      const corner = t.getAttribute?.('data-corner');
      try {
        (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
      } catch { /* synthetic pointers (tests) have no active id — capture is a nicety */ }
      this._vacFit = { ...f, drag: corner
        ? { kind: 'scale', sx: ev.clientX, sy: ev.clientY, p0: { ...f.p },
            fx: Number(corner.split(',')[0]), fy: Number(corner.split(',')[1]) }
        : { kind: 'move', sx: ev.clientX, sy: ev.clientY, p0: { ...f.p }, fx: 0, fy: 0 } };
      return;
    }
    const d = f.drag;
    if (!d) return;
    if (ev.type === 'pointermove') {
      const [dx, dy] = this._vacDelta(view, ev.clientX - d.sx, ev.clientY - d.sy);
      if (d.kind === 'move') {
        this._vacFit = { ...f, p: { ...d.p0, ox: d.p0.ox + dx, oy: d.p0.oy + dy } };
      } else {
        // corner-stretch: uniform scale about the OPPOSITE corner (fx, fy —
        // the fixed corner in robot coords), like a graphics-editor frame
        const tele = readVacTelemetry(this.hass?.states[f.source]?.attributes);
        const c = this._vacGhostCentre(tele?.rooms || []);
        const m0 = fitMatrix(d.p0);
        const [gx, gy] = applyAffine(m0, c[0], c[1]);
        const [px0, py0] = applyAffine(m0, d.fx, d.fy);
        const span0 = Math.hypot(gx - px0, gy - py0) || 1;
        // distance change of the dragged corner (opposite of fixed) from centre
        const [cx0, cy0] = [2 * gx - px0, 2 * gy - py0];
        const span1 = Math.hypot(cx0 + dx * 2 - px0, cy0 + dy * 2 - py0) / 2;
        const k = Math.max(0.05, span1 / span0);
        const next = { ...d.p0, s: d.p0.s * k } as FitParams;
        this._vacFit = { ...f, p: reanchorFit(next, d.p0, d.fx, d.fy) };
      }
      return;
    }
    if (ev.type === 'pointerup' || ev.type === 'pointercancel') {
      this._vacFit = { ...f, drag: null };
    }
  }

  /** The translucent robot map over the plan while fitting. */
  private _renderVacFit(view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    const f = this._vacFit;
    if (!f) return nothing;
    const tele = readVacTelemetry(this.hass?.states[f.source]?.attributes);
    if (!tele) return nothing;
    const m = fitMatrix(f.p);
    const rects: TemplateResult[] = [];
    const xs: number[] = [], ys: number[] = [];
    for (const r of tele.rooms) {
      if (r.x0 == null) continue;
      const cs = [[r.x0!, r.y0!], [r.x1!, r.y0!], [r.x1!, r.y1!], [r.x0!, r.y1!]]
        .map(([x, y]) => applyAffine(m, x, y));
      cs.forEach(([x, y]) => { xs.push(x); ys.push(y); });
      const [lx, ly] = applyAffine(m, r.cx, r.cy);
      rects.push(svg`<polygon points="${cs.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"></polygon>
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}">${r.name}</text>`);
    }
    let dot: TemplateResult | typeof nothing = nothing;
    if (tele.pos) {
      const [dx2, dy2] = applyAffine(m, tele.pos.x, tele.pos.y);
      dot = svg`<circle class="vacfitdot" cx="${dx2.toFixed(1)}" cy="${dy2.toFixed(1)}" r="${(view.w * 0.012).toFixed(1)}"></circle>`;
    }
    // corner handles on the ghost bbox; data-corner carries the FIXED corner
    // (the opposite one) in robot coordinates
    const handles: TemplateResult[] = [];
    if (xs.length) {
      const inv = ((): ((x: number, y: number) => VacPt) => {
        const det = m[0] * m[4] - m[1] * m[3];
        return (x, y) => [
          (m[4] * (x - m[2]) - m[1] * (y - m[5])) / det,
          (-m[3] * (x - m[2]) + m[0] * (y - m[5])) / det,
        ];
      })();
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      // hit radius (finger-sized: these are grabbed on tablets) and the bead
      // you actually see, a quarter of it — same split as .bdhandle/.bdknob
      const r = view.w * 0.022;
      const kr = r / 4;
      for (const [hx, hy, ox2, oy2] of [[x0, y0, x1, y1], [x1, y0, x0, y1], [x1, y1, x0, y0], [x0, y1, x1, y0]] as number[][]) {
        const fixed = inv(ox2, oy2);
        handles.push(svg`<circle class="vacfithandle" data-corner="${fixed[0] + ',' + fixed[1]}"
          cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}"></circle>
          <circle class="vacfitknob" cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${kr.toFixed(2)}"></circle>`);
      }
    }
    return html`<svg class="vacfit" viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
        preserveAspectRatio="none"
        @pointerdown=${(e: PointerEvent) => this._vacFitPointer(e, view)}
        @pointermove=${(e: PointerEvent) => this._vacFitPointer(e, view)}
        @pointerup=${(e: PointerEvent) => this._vacFitPointer(e, view)}
        @pointercancel=${(e: PointerEvent) => this._vacFitPointer(e, view)}>${rects}${dot}${handles}</svg>`;
  }

  /** Every frame: glue the growing tip segment to the animated puck centre. */
  private _vacRafLoop(): void {
    this._vacRaf = requestAnimationFrame(() => {
      const sr = this.renderRoot as ShadowRoot;
      const stage = this._stageEl;
      const view = this._vacLastView;
      const pucks = sr?.querySelectorAll?.('.vacpuck') || [];
      if (!stage || !view || !pucks.length) { this._vacRaf = 0; return; }
      const sb = stage.getBoundingClientRect();
      for (const puck of pucks as any) {
        const mid = puck.getAttribute('data-mid');
        const pb = puck.getBoundingClientRect();
        const cx = view.x + ((pb.left + pb.width / 2 - sb.left) / sb.width) * view.w;
        const cy = view.y + ((pb.top + pb.height / 2 - sb.top) / sb.height) * view.h;
        for (const line of sr.querySelectorAll(`line.tip[data-mid="${mid}"]`)) {
          line.setAttribute('x2', cx.toFixed(1));
          line.setAttribute('y2', cy.toFixed(1));
        }
      }
      this._vacRafLoop();
    });
  }

  /** Puck + trail for every live vacuum of the space. */
  private _renderVacuums(devs: DevItem[], view: { x: number; y: number; w: number; h: number }): TemplateResult | typeof nothing {
    if (this._markup || this._mode === 'decor') return nothing;
    const viewKey = this._space + '|' + view.x + '|' + view.y + '|' + view.w + '|' + view.h;
    const jumpAll = this._vacJumpOnce || viewKey !== this._vacViewKey;
    this._vacViewKey = viewKey;
    this._vacJumpOnce = false;
    const pucks: TemplateResult[] = [];
    const trails: TemplateResult[] = [];
    for (const d of devs) {
      if (d.hidden || !this._isVacDev(d)) continue;
      const src = this._vacSource(d);
      if (!src) continue;
      const tele = readVacTelemetry(this.hass?.states[src]?.attributes);
      if (!tele) continue;
      const matrix = d.marker?.vacuum?.calibration?.[this._vacMapId(d, tele)] as Affine | undefined;
      if (!matrix || matrix.length !== 6) continue;
      const rt = this._vacRt.get(d.id);
      const moving = rt?.moving ?? false;
      const tmode = vacTrailMode(d.marker?.vacuum);
      // owner 2026-07-31: hide when the cleanup is over (default), unless the
      // mode says always; the previous run only ever shows in 'always'
      const showCur = tmode === 'always' || (tmode === 'cleaning' && moving);
      const srv = this._vacSrvTrails[d.id];
      const mapNow = this._vacMapId(d, tele);
      const srvCur = srv?.current?.map_id === mapNow && Array.isArray(srv.current.points) ? srv.current : null;
      const srvPrev = srv?.previous?.map_id === mapNow && Array.isArray(srv.previous.points) ? srv.previous : null;
      // the PREVIOUS run stays visible even at rest: users compare where the
      // robot has been against where it has not (owner call 2026-07-31)
      if (tmode === 'always' && srvPrev && srvPrev.points.length > 1) {
        const pts = srvPrev.points.map(([x, y]: number[]) => {
          const [cx2, cy2] = applyAffine(matrix, x, y);
          return cx2.toFixed(1) + ',' + cy2.toFixed(1);
        }).join(' ');
        trails.push(svg`<g class="prev"><polyline class="case" points="${pts}"></polyline><polyline class="core" points="${pts}"></polyline></g>`);
      }
      // trail source order: server current run (survives reloads, shared by
      // every screen) → integration path → the local live buffer
      if (showCur && (moving || srvCur)) {
        // any server/integration path ends at the CURRENT target — trim the
        // live tail while moving so the line never runs ahead of the puck
        const full: VacPt[] = (srvCur?.points as VacPt[]) || tele.path || rt?.trail || [];
        const trim = moving && (srvCur || tele.path) && full.length > 1;
        const raw: VacPt[] = trim ? full.slice(0, -1) : full;
        if (raw.length > 1) {
          const ptsStr = raw.map(([x, y]) => {
            const [cx, cy] = applyAffine(matrix, x, y);
            return cx.toFixed(1) + ',' + cy.toFixed(1);
          }).join(' ');
          // cartography casing: a dark halo under a light core. Neutral and
          // visible over ANY room fill — blend modes all have a blind
          // luminance where the line vanishes (owner request 2026-07-31).
          trails.push(svg`<polyline class="case" points="${ptsStr}"></polyline><polyline class="core" points="${ptsStr}"></polyline>`);
          // the LAST segment grows glued to the icon (owner: «след появлялся
          // строго за иконкой»): a rAF sampler drags x2/y2 to the puck centre
          if (moving) {
            const [ax, ay] = applyAffine(matrix, raw[raw.length - 1][0], raw[raw.length - 1][1]);
            const a1 = ax.toFixed(1), a2 = ay.toFixed(1);
            trails.push(svg`<line class="case tip" data-mid="${d.id}" x1="${a1}" y1="${a2}" x2="${a1}" y2="${a2}"></line><line class="core tip" data-mid="${d.id}" x1="${a1}" y1="${a2}" x2="${a1}" y2="${a2}"></line>`);
          }
        }
      }
      if (!moving || !tele.pos) continue;
      const [cx, cy] = applyAffine(matrix, tele.pos.x, tele.pos.y);
      const left = ((cx - view.x) / view.w) * 100;
      const top = ((cy - view.y) / view.h) * 100;
      const stale = rt && rt.lastTs > 0 && Date.now() - rt.lastTs > VAC_STALE_MS;
      const icon = d.marker?.icon || d.icon || 'mdi:robot-vacuum';
      pucks.push(html`<div
        data-mid="${d.id}"
        class="vacpuck ${rt?.jump || jumpAll ? 'jump' : ''} ${stale ? 'stale' : ''}"
        style="left:${left}%;top:${top}%"
        title=${d.name}
        @click=${(e: Event) => { e.stopPropagation(); const ve = this._vacEntity(d); if (ve) this._openMoreInfo(ve); }}>
        <ha-icon .icon=${icon}></ha-icon>
      </div>`);
    }
    this._vacLastView = view;
    if (pucks.length && !this._vacRaf) this._vacRafLoop();
    if (!pucks.length && !trails.length) return nothing;
    return html`
      ${trails.length ? svg`<svg class="vactrail" viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="none">${trails}</svg>` : nothing}
      ${pucks}`;
  }

  private _renderDevice(d: DevItem, view: { x: number; y: number; w: number; h: number }, showLqi = true): TemplateResult {
    const pos = this._pos(d);
    const left = ((pos.x - view.x) / view.w) * 100;
    const top = ((pos.y - view.y) / view.h) * 100;
    const presentation = this._devicePresentation(d, showLqi);
    const st = [`left:${left}%`, `top:${top}%`, ...deviceFaceStyle(presentation)];
    const disabledReason = presentation.disabledReason;
    const ghostLabel = presentation.haDisabled
      ? this._t((`marker.ha_disabled_${disabledReason}`) as any)
      : d.userHidden ? this._t('marker.hidden_ghost') : d.name;
    const metrics = [
      d.model,
      presentation.tempText != null ? presentation.tempText + '°' : '',
      presentation.humText != null ? presentation.humText + '%' : '',
      presentation.lqiText != null ? 'LQI ' + presentation.lqiText : '',
    ].filter(Boolean).join(' · ');

    return html`<div
      ${''/* docs/STYLING-HOOKS.md §3: the styling contract. `nothing` on an
             attribute binding REMOVES the attribute, so a virtual marker has
             no data-entity at all rather than "undefined". */}
      data-hp="device"
      data-id="${d.id}"
      data-entity=${d.primary || nothing}
      data-area=${d.area || nothing}
      data-binding-status=${presentation.haDisabled ? 'ha-disabled' : d.bindingStatus?.kind || 'active'}
      data-disabled-reason=${disabledReason ? disabledReason.replace('_', '-') : nothing}
      aria-label=${ghostLabel}
      class="dev ${presentation.classes.join(' ')} ${this._selId === d.id ? 'sel' : ''} ${d.virtual ? 'virtual' : ''} ${d.hidden ? 'ghost' : ''} ${presentation.haDisabled ? 'ha-disabled' : ''} ${presentation.valueText != null ? 'valonly' : ''}"
      style="${st.join(';')}"
      @click=${(e: MouseEvent) => this._clickDevice(e, d)}
      @contextmenu=${(e: MouseEvent) => this._ctxDevice(e, d)}
      @mousemove=${(e: MouseEvent) =>
        this._showTip(e, d.name, presentation.haDisabled ? ghostLabel : metrics)}
      @mouseleave=${() => (this._tip = null)}
      @pointerdown=${(e: PointerEvent) => this._pointerDown(e, d)}
      @pointermove=${(e: PointerEvent) => this._pointerMove(e, d)}
      @pointerup=${(e: PointerEvent) => this._pointerUp(e, d)}
      @pointercancel=${(e: PointerEvent) => this._pointerUp(e, d)}
    >
      ${renderDeviceFace(presentation, {
        surface: 'interactive-plan',
        newDevice: this._newIds.has(d.id),
        newDeviceTitle: this._t('device.new'),
        disabledTitle: presentation.haDisabled ? ghostLabel : '',
      })}
    </div>`;
  }

  /** Clean-floor area shown in the room tooltip (same rule as resize labels). */
  private _roomArea(r: RoomCfg): string | null {
    const poly = roomPoly(r);
    if (!poly) return null;
    const walls = this._spaceWalls;
    const floor = walls.length && r.id
      ? (innerContourForRoom(
          this._spaceModel().rooms, r.id, walls,
          this._openPairs().flatMap((p) => p.segs),
          this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
        ) || poly)
      : poly;
    const clean = this._cleanFloor(r, floor);
    const cmPerUnit = this._cellCm / this._gridPitch;
    return formatArea(
      (clean.area * cmPerUnit * cmPerUnit) / 1e4,
      this.hass?.config?.unit_system?.length === 'mi',
    );
  }

  /** Room temperature honouring the tier-3 source override. */
  private _roomTemp(r: RoomCfg): number | null {
    const src = r.settings?.temp_source;
    if (src) return sourceValue(this._planHass, src, 'temp', this._markers);
    // every sensor of the area, placed on the plan or not (field report)
    return r.area ? this._climate().get(r.area)?.temp ?? null : null;
  }

  /** Room humidity honouring the tier-3 source override. */
  private _roomHum(r: RoomCfg): number | null {
    const src = r.settings?.hum_source;
    if (src) return sourceValue(this._planHass, src, 'hum', this._markers);
    return r.area ? this._climate().get(r.area)?.hum ?? null : null;
  }

  private _climateCache: { h: any; r: any; mk: any; m: Map<string, AreaClimate> } | null = null;

  /**
   * Climate for every area, computed ONCE per hass snapshot (review R2-3).
   * Home Assistant hands out a new `hass` object on every state change, so
   * identity is exactly the right cache key: fresh states always recompute,
   * and the 60 rooms of one render share a single registry pass instead of
   * triggering one each (two, with humidity on).
   */
  private _climate(): Map<string, AreaClimate> {
    // markers are part of the key: ticking "use the device's temperature
    // sensor" replaces the markers array, so the average recomputes at once
    const mk = this._serverCfg?.markers;
    const planHass = this._planHass;
    const c = this._climateCache;
    if (c && c.h === planHass && c.r === this._iconRules && c.mk === mk) return c.m;
    const m = areaClimateMap(planHass, this._iconRules, mk);
    this._climateCache = { h: planHass, r: this._iconRules, mk, m };
    return m;
  }

  private _resetRoomDialogFields(): void {
    this._roomEditId = null;
    this._roomFill = '';
    this._roomTempSrc = '';
    this._roomHumSrc = '';
    this._roomSrcOpen = null;
    this._roomSrcFilter = '';
    this._roomNameScale = 1;
    this._roomLabelScale = 1;
  }

  /** Open the room dialog for an EXISTING room (the gear on its card). */
  private _openRoomEdit(r: RoomCfg): void {
    if (!r.id) return;
    this._roomEditId = r.id;
    this._nameSel = r.name || '';
    this._areaSel = r.area || '';
    this._roomFill = (r.settings?.fill_mode as any) || '';
    this._roomTempSrc = r.settings?.temp_source || '';
    this._roomHumSrc = r.settings?.hum_source || '';
    this._roomNameScale = clampScale(r.settings?.name_scale);
    this._roomLabelScale = clampScale(r.settings?.label_scale);
    this._roomSrcOpen = null;
    this._roomSrcFilter = '';
    this._roomDialog = true;
  }

  /** Collect the room settings object from the dialog state (null = all inherited). */
  private _roomSettingsFromDialog(): RoomCfg['settings'] {
    const st: any = {};
    if (this._roomFill) st.fill_mode = this._roomFill;
    if (this._roomTempSrc) st.temp_source = this._roomTempSrc;
    if (this._roomHumSrc) st.hum_source = this._roomHumSrc;
    if (this._roomNameScale !== 1) st.name_scale = this._roomNameScale;
    if (this._roomLabelScale !== 1) st.label_scale = this._roomLabelScale;
    return Object.keys(st).length ? st : null;
  }

  /** Save the room edited via the gear (name, area, tier-3 settings). */
  private _saveRoomEdit(): void {
    const sp = this._curSpaceCfg;
    const room = sp?.rooms.find((x: any) => x.id === this._roomEditId);
    if (!room) {
      this._roomDialog = false;
      this._roomEditId = null;
      return;
    }
    room.name = this._nameSel.trim() || room.name;
    room.area = this._areaSel || null;
    const st = this._roomSettingsFromDialog();
    if (st) room.settings = st;
    else delete room.settings;
    this._saveConfig();
    this._roomDialog = false;
    this._roomEditId = null;
    this._nameSel = '';
    this._areaSel = '';
    this._regSignature = '';
    this._maybeRebuildDevices();
    this.requestUpdate();
    this._showToast(this._t('toast.room_updated'));
  }

  /** Devices + sensor entities for the measurement-source picker. */
  private _roomSrcCandidates(): { value: string; label: string; sub: string }[] {
    const h = this._planHass;
    const removed = removedPlanBindings(this._markers);
    const q = this._roomSrcFilter.trim().toLowerCase();
    const list: { value: string; label: string; sub: string }[] = [];
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.entry_type === 'service') continue;
      if (removed.devices.has(dev.id)) continue;
      const name = (dev.name_by_user || dev.name || dev.id).trim();
      if (q && !name.toLowerCase().includes(q)) continue;
      list.push({ value: 'device:' + dev.id, label: name, sub: dev.model || this._t('marker.sub_device') });
    }
    for (const [eid, reg] of Object.entries<any>(h.entities)) {
      if (!eid.startsWith('sensor.') || reg.hidden) continue;
      if (isRemovedPlanEntity(h, eid, removed)) continue;
      const label = reg.name || h.states[eid]?.attributes?.friendly_name || eid;
      if (q && !(label + ' ' + eid).toLowerCase().includes(q)) continue;
      list.push({ value: 'entity:' + eid, label, sub: eid });
    }
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list.slice(0, 200);
  }

  /** Human label of a picked measurement source. */
  private _roomSrcLabel(src: string): string {
    const i = src.indexOf(':');
    const k = src.slice(0, i);
    const ref = src.slice(i + 1);
    if (k === 'device') {
      return this._fullRegistryHass.devices[ref]?.name_by_user
        || this._fullRegistryHass.devices[ref]?.name || ref;
    }
    return this._fullRegistryHass.entities[ref]?.name
      || this.hass.states[ref]?.attributes?.friendly_name || ref;
  }

  /** Saved label position (layout key rl_<roomId>) or the room center. */
  private _labelPos(r: RoomCfg, spaceId: string): { x: number; y: number } {
    const saved = this._layout['rl_' + (r.id || '')];
    if (saved && saved.s === spaceId) {
      return { x: saved.x * NORM_W, y: saved.y * NORM_W };
    }
    // a label nobody has dragged sits at the room's CENTROID, which is not a
    // node for an odd-sized or polygonal room — put it on the nearest one
    const c = this._snap(this._roomCenter(r));
    return { x: c[0], y: c[1] };
  }

  /** Room-name labels are dragged exactly like device icons (same layout store). */
  private _labelDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (this._mode !== 'plan') return;
    ev.preventDefault();
    ev.stopPropagation();
    const p = this._labelPos(r, spaceId);
    this._drag = { id: 'rl_' + (r.id || ''), sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y, moved: false };
    capturePointer(ev);
    this._tip = null;
  }

  private _labelMove(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    const id = 'rl_' + (r.id || '');
    if (!this._drag || this._drag.id !== id) return;
    const stage = this._stageEl;
    if (!stage) return;
    const vb = this._spaceModel(spaceId).vb;
    const rect = stage.getBoundingClientRect();
    const v = this._viewOr(vb);
    const dx = ((ev.clientX - this._drag.sx) / rect.width) * v.w;
    const dy = ((ev.clientY - this._drag.sy) / rect.height) * v.h;
    if (Math.abs(ev.clientX - this._drag.sx) + Math.abs(ev.clientY - this._drag.sy) > 3) this._drag.moved = true;
    // DEV-B58-01, and worse than the marker's: this clamped to the space's
    // STORED view_box, which for every existing plan is the old unit square.
    // A room drawn at 2.5 had a name that could not be dragged to its own room.
    const nx = clampCanvasR(this._drag.ox + dx);
    const ny = clampCanvasR(this._drag.oy + dy);
    this._savePos({ id, space: spaceId } as DevItem, nx, ny);
  }

  private _labelUp(r: RoomCfg): void {
    const id = 'rl_' + (r.id || '');
    if (!this._drag || this._drag.id !== id) return;
    const moved = this._drag.moved;
    this._drag = moved ? this._drag : null;
    if (moved) window.setTimeout(() => (this._drag = null), 0);
  }

  /** Saved room-card scale (layout key rl_<roomId>, field k), clamped 0.5..3. */
  private _labelScale(r: RoomCfg): number {
    const k = (this._layout['rl_' + (r.id || '')] as any)?.k;
    return typeof k === 'number' && Number.isFinite(k) ? Math.min(3, Math.max(0.5, k)) : 1;
  }

  private _rlResizeDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (this._mode !== 'plan') return;
    ev.preventDefault();
    ev.stopPropagation();
    const card = (ev.target as HTMLElement).closest('.roomlabel') as HTMLElement | null;
    if (!card) return;
    const b = card.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const d0 = Math.max(8, Math.hypot(ev.clientX - cx, ev.clientY - cy));
    this._rlResize = { id: 'rl_' + (r.id || ''), space: spaceId, k0: this._labelScale(r), cx, cy, d0 };
    capturePointer(ev);
  }

  private _rlResizeMove(ev: PointerEvent): void {
    const rs = this._rlResize;
    if (!rs) return;
    ev.stopPropagation();
    const dist = Math.max(8, Math.hypot(ev.clientX - rs.cx, ev.clientY - rs.cy));
    const k = Math.min(3, Math.max(0.5, rs.k0 * (dist / rs.d0)));
    const rec: any = this._layout[rs.id];
    if (!rec) {
      // the card was never dragged: pin its current default position first
      const roomId = rs.id.slice(3);
      const sp = this._spaceModel(rs.space);
      const room = sp.rooms.find((x) => x.id === roomId);
      if (!room) return;
      const p = this._labelPos(room, rs.space);

      this._layout = {
        ...this._layout,
        [rs.id]: { s: rs.space, x: p.x / NORM_W, y: p.y / NORM_W, k },
      };
    } else {
      this._layout = { ...this._layout, [rs.id]: { ...rec, k } };
    }
    this._dirtyPos.add(rs.id);
  }

  private _rlResizeUp(): void {
    if (!this._rlResize) return;
    this._rlResize = null;
    this._persistLayout();
  }

  /** The room-settings button: detached from the (movable) label, always at
   *  the geometric CENTRE of the room, sized at 70% of a device icon and
   *  therefore zooming with the plan (owner's spec, 2026-07-29). */
  private _gearPtCache = new WeakMap<number[][], number[]>();

  private _renderRoomGear(
    r: RoomCfg, space: SpaceModel, view: { x: number; y: number; w: number; h: number },
  ): TemplateResult | typeof nothing {
    if (!r.id) return nothing;
    let c: number[] | null = null;
    if (r.poly) {
      // the VISUAL centre (largest inscribed circle) — interiorPoint only
      // promises "inside", which sat visibly off-centre on an L-shaped room.
      // The model is memoized, so the poly array is a stable cache key.
      c = this._gearPtCache.get(r.poly) || null;
      if (!c) { c = poleOfInaccessibility(r.poly); this._gearPtCache.set(r.poly, c); }
    } else if (r.x != null && r.y != null) {
      c = [r.x + (r.w || 0) / 2, r.y + (r.h || 0) / 2];
    }
    if (!c) return nothing;
    const left = ((c[0] - view.x) / view.w) * 100;
    const top = ((c[1] - view.y) / view.h) * 100;
    return html`<button class="rlgearbtn" style="left:${left}%;top:${top}%"
      title=${this._t('room.settings_title')}
      @pointerdown=${(e: Event) => e.stopPropagation()}
      @click=${(e: Event) => { e.stopPropagation(); this._openRoomEdit(r); }}>
      <ha-icon icon="mdi:cog-outline"></ha-icon>
      <span class="rlgeartext">${this._t('room.settings_short')}</span>
    </button>`;
  }

  private _renderRoomLabel(
    r: RoomCfg, space: SpaceModel, view: { x: number; y: number; w: number; h: number }, disp: SpaceDisplay,
  ): TemplateResult | typeof nothing {
    // audit/feedback: rooms without a name still need their gear in the Plan
    // editor — that is where you name them (field report, 2026-07-27)
    if (!r.name && !this._markup) return nothing;
    const p = this._labelPos(r, space.id);
    const left = ((p.x - view.x) / view.w) * 100;
    const top = ((p.y - view.y) / view.h) * 100;
    const op = Math.min(1, disp.opacity + 0.25);
    const k = this._labelScale(r);
    // Optional metrics row. Light sources may use an explicit room_id even
    // when this room has no HA area; the other aggregate metrics still need it.
    const rows: TemplateResult[] = [];
    if (r.area || r.settings?.temp_source || r.settings?.hum_source || disp.labelLight) {
      if (disp.labelTemp) {
        const t = this._roomTemp(r);
        if (t != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${t}°</span>`);
      }
      if (disp.labelHum) {
        const hm = this._roomHum(r);
        if (hm != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${hm}%</span>`);
      }
      if (disp.labelLqi && r.area) {
        const l = this._roomLqi(r.area);
        if (l != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${l}</span>`);
      }
      if (disp.labelLight) {
        const ls = resolvedLightStats(resolvedLightSources(this._planHass, this._devices, r));
        if (ls) {
          const txt = ls.on === 0
            ? this._t('roomcard.light_off')
            : ls.on === ls.total
              ? this._t('roomcard.light_on')
              : this._t('roomcard.light_partial', { on: ls.on, total: ls.total });
          rows.push(html`<span class="rlm ${ls.on ? 'lit' : ''}"><ha-icon icon=${ls.on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}></ha-icon>${txt}</span>`);
        }
      }
    }
    return html`<div class="roomlabel ${rows.length ? 'card' : ''}"
      data-hp="room-label" data-id=${r.id || nothing} data-area=${r.area || nothing}
      style="left:${left}%;top:${top}%;color:${disp.color};opacity:${op};--rl-scale:${k};--rl-space:${disp.cardFontScale};--rl-name:${clampScale(r.settings?.name_scale)};--rl-meta:${clampScale(r.settings?.label_scale)}"
      @pointerdown=${(e: PointerEvent) => this._labelDown(e, r, space.id)}
      @pointermove=${(e: PointerEvent) => this._labelMove(e, r, space.id)}
      @pointerup=${() => this._labelUp(r)}
      @pointercancel=${() => this._labelUp(r)}
    ><span class="rlname">${r.name || (this._markup ? this._t('room.unnamed') : '')}${!this._markup && r.area
        ? html`<ha-icon class="rlgo" icon="mdi:open-in-new"
            title=${this._t('room.open_area')}
            @click=${(e: Event) => { e.stopPropagation(); this._clickRoom(r); }}
            @pointerdown=${(e: Event) => e.stopPropagation()}></ha-icon>`
        : nothing}</span>
      ${rows.length ? html`<span class="rlmetrics">${rows}</span>` : nothing}
      ${this._mode === 'plan'
        ? ['tl', 'tr', 'bl', 'br'].map(
            (c) => html`<span class="rlhandle ${c}"
              @pointerdown=${(e: PointerEvent) => this._rlResizeDown(e, r, space.id)}
              @pointermove=${(e: PointerEvent) => this._rlResizeMove(e)}
              @pointerup=${() => this._rlResizeUp()}
              @pointercancel=${() => this._rlResizeUp()}></span>`,
          )
        : nothing}
    </div>`;
  }

  /** Where the live measurement starts: the last outline point, or the first split point. */
  private get _measureAnchor(): number[] | null {
    if (!this._markup || !this._cursorPt) return null;
    if ((this._tool === 'draw' || this._tool === 'partition')
        && this._path.length && !this._contourClosed)
      return this._path[this._path.length - 1];
    if (this._tool === 'split' && this._splitSel?.pts?.length)
      return this._splitSel.pts[this._splitSel.pts.length - 1];
    return null;
  }

  /** Length badge that follows the cursor while drawing a segment or a cut. */
  private _renderMeasureLabel(view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const a = this._measureAnchor!;
    const b = this._cursorPt!;
    const left = ((b[0] - view.x) / view.w) * 100;
    const top = ((b[1] - view.y) / view.h) * 100;
    // angle badge: length · angle, both green when the angle is a 45° multiple
    const deg = segmentAngle(a, b);
    const shown = Math.round(deg * 10) / 10;
    const on45 = is45(deg);
    return html`<div class="measurelabel ${on45 ? 'on45' : ''}" style="left:${left}%;top:${top}%">
      ${this._fmtLen(a, b)} · ${shown}°</div>`;
  }

  /**
   * Live size badge for the shape being drawn in the BACKGROUND (decor)
   * editor — owner 2026-08-04: «в редакторе подложки у линий писать длину,
   * как при рисовании комнат в редакторе плана».
   *
   * A line gets exactly what a wall gets while a plan is drawn: length ·
   * angle in the HA unit system, green on a 45° multiple — the same
   * `_fmtLen` (`segmentCm` over `cell_cm`), the same `.measurelabel`. The
   * only difference is WHERE it sits: a wall badge follows the cursor
   * because the cursor is the wall's free end, while a decor line is pulled
   * out by both ends at once, so its badge rides the MIDDLE of the segment
   * (owner: «плашка на середине линии»).
   *
   * Rectangles report «W × H» plus area; ellipses report one radius for a
   * circle or both radii otherwise. A draft that has not moved yet (the
   * pointerdown before the drag) shows nothing — a «0» badge under the cursor
   * is noise, not a measurement.
   */
  private get _decorMeasure(): { x: number; y: number; text: string; on45: boolean } | null {
    const d = this._decorDraft;
    if (!d || this._mode !== 'decor') return null;
    const [ax, ay] = d.a;
    const [bx, by] = d.b;
    if (Math.abs(ax - bx) < 1e-6 && Math.abs(ay - by) < 1e-6) return null;
    const x = (ax + bx) / 2;
    const y = (ay + by) / 2;
    if (d.kind === 'line') {
      const deg = segmentAngle(d.a, d.b);
      return { x, y, on45: is45(deg),
        text: `${this._fmtLen(d.a, d.b)} · ${Math.round(deg * 10) / 10}°` };
    }
    const wText = this._fmtLen([ax, ay], [bx, ay]);
    const hText = this._fmtLen([bx, ay], [bx, by]);
    if (d.kind === 'ellipse') {
      const rx = this._fmtLen([0, 0], [Math.abs(bx - ax) / 2, 0]);
      const ry = this._fmtLen([0, 0], [0, Math.abs(by - ay) / 2]);
      const circle = Math.abs(Math.abs(bx - ax) - Math.abs(by - ay)) < 1e-6;
      return { x, y, on45: false, text: circle ? `R ${rx}` : `Rx ${rx} × Ry ${ry}` };
    }
    const area = (decorUnitsToCm(Math.abs(bx - ax), this._cellCm, this._gridPitch)
      * decorUnitsToCm(Math.abs(by - ay), this._cellCm, this._gridPitch)) / 10000;
    return { x, y, on45: false,
      text: `${wText} × ${hText} · ${formatArea(area, this._imperial)}` };
  }

  // ================= alignment guides (smart guides) =================

  /** The point being drawn/dragged right now, or null (per editor context). */
  private get _alignPoint(): number[] | null {
    if (this._markup) {
      if (this._tool === 'draw' && this._path.length && !this._contourClosed && this._cursorPt)
        return this._cursorPt;
      if (this._tool === 'split' && this._splitSel?.pts?.length && this._cursorPt)
        return this._cursorPt;
      if (this._drag?.id.startsWith('rl_') && this._drag.moved) {
        const roomId = this._drag.id.slice(3);
        const room = this._spaceModel().rooms.find((r) => r.id === roomId);
        return room ? (() => { const p = this._labelPos(room, this._space); return [p.x, p.y]; })() : null;
      }
      return null;
    }
    if (this._mode === 'devices' && this._drag?.moved) {
      const d = this._devices.find((x) => x.id === this._drag!.id);
      return d ? (() => { const p = this._pos(d); return [p.x, p.y]; })() : null;
    }
    if (this._mode === 'decor') {
      if (this._decorDraft) return this._decorDraft.b;
      if (this._decorMove) {
        const sh = this._decorList.find((x) => x.id === this._decorMove!.id);
        if (!sh) return null;
        const W = NORM_W, H = this._decorH;
        if (sh.kind === 'line') return [sh.x1 * W, sh.y1 * H];
        return [sh.x * W, sh.y * H];
      }
      return null;
    }
    return null;
  }

  /** Alignment candidates for the current context (owner's matrix). */
  private _alignCandidates(): number[][] {
    const out: number[][] = [];
    const spm = this._spaceModel();
    if (this._markup) {
      if (this._drag?.id.startsWith('rl_')) {
        // room-card drag: centers of the OTHER room cards
        const dragged = this._drag.id.slice(3);
        for (const r of spm.rooms) {
          if (!r.name || r.id === dragged) continue;
          const p = this._labelPos(r, this._space);
          out.push([p.x, p.y]);
        }
        return out;
      }
      // drawing: room vertices + current path/split points
      for (const r of spm.rooms) {
        const poly = roomPoly(r);
        if (poly) for (const p of poly) out.push(p);
      }
      if (this._tool === 'draw') for (const p of this._path) out.push(p);
      if (this._tool === 'split' && this._splitSel?.pts) for (const p of this._splitSel.pts) out.push(p);
      return out;
    }
    if (this._mode === 'devices') {
      // other icons of this space only (owner's decision)
      for (const d of this._devices) {
        if (d.space !== this._space || d.id === this._drag?.id
            || d.bindingStatus?.kind === 'ha_disabled') continue;
        const p = this._pos(d);
        out.push([p.x, p.y]);
      }
      return out;
    }
    if (this._mode === 'decor') {
      const movingId = this._decorMove?.id;
      out.push(...this._decorSnapGeometry(movingId).points);
      if (this._decorDraft) out.push(this._decorDraft.a);
      return out;
    }
    return out;
  }

  private _renderAlignGuides(): TemplateResult {
    const pt = this._alignPoint;
    if (!pt) return svg`` as unknown as TemplateResult;
    // exact node match for grid-snapped things; half a cell for free-moving cards
    const tol = this._drag?.id.startsWith('rl_') ? this._gridPitch * 0.5 : this._gridPitch * 0.05;
    const guides = alignGuides(pt, this._alignCandidates(), tol);
    if (!guides.length) return svg`` as unknown as TemplateResult;
    const g = this._gridPitch;
    const over = g * 1.5; // extend a little past the point
    return svg`<g class="alignguides">
      ${guides.map((gd: AlignGuide) => {
        const [x1, y1, x2, y2] = gd.axis === 'x'
          ? [gd.at, gd.from[1], gd.at, pt[1] + Math.sign(pt[1] - gd.from[1]) * over]
          : [gd.from[0], gd.at, pt[0] + Math.sign(pt[0] - gd.from[0]) * over, gd.at];
        return svg`<line class="alignline" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>
          <circle class="aligndot" cx="${gd.from[0]}" cy="${gd.from[1]}" r="${g * 0.18}"></circle>`;
      })}
    </g>` as unknown as TemplateResult;
  }

  /** Perpendicular dashed tick through the wall's center while a dragged opening
   * sits exactly in the middle — same look as the alignment guides. Length is
   * about the wall stroke (2.5) × 6 to each side. */
  private _renderOpeningCenterTick(gd: { x: number; y: number; angle: number }): TemplateResult {
    const rad = ((gd.angle + 90) * Math.PI) / 180;
    const half = 2.5 * 6;
    return svg`<line class="alignline opcentertick"
      x1="${gd.x - Math.cos(rad) * half}" y1="${gd.y - Math.sin(rad) * half}"
      x2="${gd.x + Math.cos(rad) * half}" y2="${gd.y + Math.sin(rad) * half}"></line>` as unknown as TemplateResult;
  }

  private _roomCenter(r: RoomCfg): number[] {
    if (r.poly) {
      const n = r.poly.length;
      return [r.poly.reduce((a, p) => a + p[0], 0) / n, r.poly.reduce((a, p) => a + p[1], 0) / n];
    }
    return [r.x! + r.w! / 2, r.y! + Math.min(r.w!, r.h!) * 0.1];
  }

  /** Live state of an opening's contact, 0..1 drawn amount. */
  private _openingAmt(o: OpeningCfg): number {
    const st = o.contact && this._planEntityAvailable(o.contact)
      ? this.hass.states[o.contact]?.state
      : null;
    return openingAmount(o.type, st, !!o.invert);
  }

  /** Deleted bindings are unavailable to every plan-level consumer. */
  private _planEntityAvailable(eid: string | null | undefined): boolean {
    if (!eid) return false;
    if (isRemovedPlanEntity(this._fullRegistryHass, eid, removedPlanBindings(this._markers))) return false;
    return this._bindingStatus('entity:' + eid).kind === 'active';
  }

  /**
   * Doors, windows and gates, drawn in plan (SVG) coordinates so they scale and
   * pan with the plan. Doors/windows follow the easy-floorplan (MIT) symbol
   * language; a gate is a compact pair of leaves opening only 10° outwards.
   */
  private _renderOpenings(disp: SpaceDisplay): TemplateResult {
    const items = this._openingsR;
    if (!items.length) return svg``;
    const base = disp.color;
    const walls = this._spaceWalls;
    const rooms = this._spaceModel().rooms;
    return svg`${items.map((o) => {
      const half = o.rlen / 2;
      const amt = this._openingAmt(o);
      const active = amt > 0 && !!o.contact && this._planEntityAvailable(o.contact);
      const tone = active ? 'var(--hp-open)' : base;
      // A normal door/window uses the selected room-side face. A gate's
      // architectural symbol sits and opens on the opposite (exterior) face;
      // flip_v still lets the user reverse that side where a shared wall makes
      // "outside" inherently ambiguous.
      const faceFlipV = o.type === 'gate' ? !o.flip_v : o.flip_v;
      // Resolve the side even with zero-thickness walls for gates, while
      // preserving the cheap classic path for ordinary line-plan openings.
      const face = walls.length || o.type === 'gate'
        ? openingInnerFaceOffset(
            rooms,
            { x: o.rx, y: o.ry, angle: o.angle, length: o.rlen, flip_v: faceFlipV },
            walls, this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
          )
        : { ox: 0, oy: 0, cm: 0, side: -1 as -1 | 1 };
      // jambs span the full wall depth, centred on the centreline
      const jambHalf = face.cm > 0
        ? ((face.cm / this._cellCm) * this._gridPitch) / 2
        : 4;
      const sx = o.flip_h ? -1 : 1;
      const sy = o.flip_v ? -1 : 1;
      // Shift swing geometry to its selected face (plan space → local via
      // inverse rotate): room-side for door/window, exterior for a gate.
      let swingTx = 0, swingTy = 0;
      if (face.cm > 0 && (face.ox || face.oy)) {
        const rad = (-o.angle * Math.PI) / 180;
        const c = Math.cos(rad), s = Math.sin(rad);
        swingTx = face.ox * c - face.oy * s;
        swingTy = face.ox * s + face.oy * c;
        // undo flip_v on the offset — scale(sy) will re-apply it
        swingTy *= sy;
        swingTx *= sx;
      }
      let body;
      if (o.type === 'window') {
        const arcLen = (Math.PI / 2) * half;
        const glass = face.cm > 0
          ? svg`<line class="op-glass" x1="0" y1="${-jambHalf}" x2="0" y2="${jambHalf}"
              stroke="${tone}" stroke-width="1.5"></line>`
          : nothing;
        body = svg`
          <g transform="translate(${swingTx} ${swingTy})">
          <path class="op-arc" d="M 0 0 A ${half} ${half} 0 0 0 ${-half} ${-half}" fill="none"
            stroke="${tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amt)}"></path>
          <path class="op-arc" d="M 0 0 A ${half} ${half} 0 0 1 ${half} ${-half}" fill="none"
            stroke="${tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amt)}"></path>
          <g transform="translate(${-half} 0)">
            <g class="op-leaf" style="transform:rotate(${-90 * amt}deg)">
              <rect x="0" y="-1.5" width="${half}" height="3" fill="${tone}"></rect>
            </g>
          </g>
          <g transform="translate(${half} 0)">
            <g class="op-leaf" style="transform:rotate(${90 * amt}deg)">
              <rect x="${-half}" y="-1.5" width="${half}" height="3" fill="${tone}"></rect>
            </g>
          </g>
          ${glass}
          </g>`;
      } else if (o.type === 'gate') {
        // The leaf endpoint must land on face.side AFTER the outer flip_v
        // scale is applied. Conjugating a rotation through scaleY(-1) reverses
        // its sign, hence the extra `sy` here. No swing arc: at 3–4 m it would
        // recreate exactly the huge, plan-obscuring graphic gates avoid.
        const gateAngle = face.side * sy * 10 * amt;
        body = svg`
          <g transform="translate(${swingTx} ${swingTy})">
          <g transform="translate(${-half} 0)">
            <g class="op-leaf" style="transform:rotate(${gateAngle}deg)">
              <rect x="0" y="-1.75" width="${half}" height="3.5" fill="${tone}"></rect>
            </g>
          </g>
          <g transform="translate(${half} 0)">
            <g class="op-leaf" style="transform:rotate(${-gateAngle}deg)">
              <rect x="${-half}" y="-1.75" width="${half}" height="3.5" fill="${tone}"></rect>
            </g>
          </g>
          </g>`;
      } else {
        const L = o.rlen;
        const arcLen = (Math.PI / 2) * L;
        body = svg`
          <g transform="translate(${swingTx} ${swingTy})">
          <path class="op-arc" d="M ${half} 0 A ${L} ${L} 0 0 0 ${-half} ${-L}" fill="none"
            stroke="${tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amt)}"></path>
          <g transform="translate(${-half} 0)">
            <g class="op-leaf" style="transform:rotate(${-90 * amt}deg)">
              <rect x="0" y="-1.75" width="${L}" height="3.5" fill="${tone}"></rect>
            </g>
          </g>
          </g>`;
      }
      const gateDepth = o.type === 'gate' ? Math.sin((10 * Math.PI) / 180) * half : 0;
      const outlineHalf = Math.max(16, jambHalf + 8, gateDepth + 8);
      const hitHalf = Math.max(20, jambHalf + 10, gateDepth + 12);
      return svg`<g class="opening" data-hp="opening" data-id="${o.id}" data-kind="${o.type}"
        transform="translate(${o.rx} ${o.ry}) rotate(${o.angle})">
        <g transform="scale(${sx} ${sy})">
          <line x1="${-half}" y1="${-jambHalf}" x2="${-half}" y2="${jambHalf}" stroke="${base}" stroke-width="2.5"></line>
          <line x1="${half}" y1="${-jambHalf}" x2="${half}" y2="${jambHalf}" stroke="${base}" stroke-width="2.5"></line>
          ${body}
        </g>
        <rect class="op-outline" x="${-half - 10}" y="${-outlineHalf}" width="${o.rlen + 20}" height="${outlineHalf * 2}" rx="6"></rect>
        <rect class="op-hit" x="${-half - 12}" y="${-hitHalf}" width="${o.rlen + 24}" height="${hitHalf * 2}"
          @click=${(e: MouseEvent) => this._opClick(e, o)}
          @pointerdown=${(e: PointerEvent) => this._opPointerDown(e, o)}
          @pointermove=${(e: PointerEvent) => this._opPointerMove(e, o)}
          @pointerup=${(e: PointerEvent) => this._opPointerUp(e, o)}
          @pointercancel=${(e: PointerEvent) => this._opPointerUp(e, o)}></rect>
      </g>`;
    })}`;
  }

  /** Padlock badges for door-like openings with a lock entity. */
  private _renderOpeningLocks(view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const items = this._openingsR.filter(
      (o) => o.type !== 'window' && o.lock && this._planEntityAvailable(o.lock),
    );
    if (!items.length) return html``;
    return html`${items.map((o) => {
      const st = this.hass.states[o.lock!]?.state;
      const locked = st === 'locked';
      const known = locked || ['unlocked', 'open', 'opening', 'unlocking', 'locking'].includes(String(st));
      // Perpendicular offset from the opening center, away from the swing side.
      // Gate exterior depends on the room edge, not merely on normalized wall
      // angle, so resolve that face explicitly.
      const rad = ((o.angle + 90) * Math.PI) / 180;
      const gateFace = o.type === 'gate'
        ? openingInnerFaceOffset(
            this._spaceModel().rooms,
            { x: o.rx, y: o.ry, angle: o.angle, length: o.rlen, flip_v: !o.flip_v },
            this._spaceWalls, this._wallKeyPitch, this._cellCm, this._gridPitch, NORM_W,
          )
        : null;
      const off = gateFace ? -16 * gateFace.side : 16 * (o.flip_v ? -1 : 1);
      const px = o.rx + Math.cos(rad) * off;
      const py = o.ry + Math.sin(rad) * off;
      const left = ((px - view.x) / view.w) * 100;
      const top = ((py - view.y) / view.h) * 100;
      return html`<div class="oplock ${locked ? 'locked' : known ? 'unlocked' : 'unknown'}"
        style="left:${left}%;top:${top}%"
        @click=${(e: MouseEvent) => { e.stopPropagation(); if (this._mode === 'view') this._openingInfo = o; }}>
        <ha-icon icon="${locked ? 'mdi:lock' : known ? 'mdi:lock-open-variant' : 'mdi:lock-question'}"></ha-icon>
      </div>`;
    })}`;
  }

  /**
   * Explicit lock/unlock from the opening info card. This does NOT violate the
   * "locks never toggle from the plan" rule: that rule guards against ACCIDENTAL
   * taps on plan icons; here the user has opened the info card and pressed a
   * clearly labeled action button — same interaction contract as HA's more-info.
   */
  private _lockAction(entityId: string, action: 'lock' | 'unlock'): void {
    // THE ONLY sanctioned lock actuation surface (review CR-1, 2026-07-27).
    // The invariant is "no lock or alarm panel is ever actuated by a TAP on the
    // plan" — icons, badges, controls[] and the device card all refuse. This
    // button is a deliberate, labeled control inside an opened card, the same
    // contract as Home Assistant's own more-info dialog. Unlocking additionally
    // asks for confirmation; locking does not (locking is never destructive).
    if (!this._planEntityAvailable(entityId)) return;
    if (action === 'unlock') {
      const name = this.hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
      if (!confirm(this._t('confirm.unlock', { name }))) return;
    }
    this.hass?.callService?.('lock', action, { entity_id: entityId });
  }

  private _renderOpeningInfoCard(): TemplateResult {
    const o = this._openingInfo!;
    const contact = o.contact && this._planEntityAvailable(o.contact) ? o.contact : null;
    const lock = o.lock && this._planEntityAvailable(o.lock) ? o.lock : null;
    const cSt = contact ? this.hass.states[contact]?.state : null;
    const amt = this._openingAmt(o);
    const lSt = lock ? this.hass.states[lock]?.state : null;
    const titleKey = o.type === 'door' ? 'opening.door'
      : o.type === 'gate' ? 'opening.gate' : 'opening.window';
    const openingIcon = o.type === 'door' ? 'mdi:door'
      : o.type === 'gate' ? 'mdi:gate' : 'mdi:window-closed-variant';
    const contactIcon = o.type === 'gate'
      ? (amt > 0 ? 'mdi:gate-open' : 'mdi:gate')
      : (amt > 0 ? 'mdi:door-open' : 'mdi:door-closed');
    const row = (icon: string, label: string, value: string, cls = '') =>
      html`<div class="oprow ${cls}"><ha-icon icon=${icon}></ha-icon><span>${label}</span><b>${value}</b></div>`;
    return html`<hp-dialog .hass=${this.hass}
      .title=${this._t(titleKey)} icon=${openingIcon} dismiss-on-scrim
      @hp-close=${() => (this._openingInfo = null)}>
        <div class="body">
          ${contact
            ? row(contactIcon,
                this._t('opening.contact_label'),
                cSt === 'unavailable' || cSt == null
                  ? this._t('opening.state_unknown')
                  : this._t(amt > 0 ? 'opening.open' : 'opening.closed'),
                amt > 0 ? 'warn' : 'ok')
            : nothing}
          ${lock
            ? row(lSt === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant',
                this._t('opening.lock_label'),
                lSt === 'locked' ? this._t('opening.locked')
                  : ['unlocked', 'open'].includes(String(lSt)) ? this._t('opening.unlocked')
                  : this._t('opening.state_unknown'),
                lSt === 'locked' ? 'ok' : 'warn')
            : nothing}
          ${lock && (lSt === 'locked' || ['unlocked', 'open'].includes(String(lSt)))
            ? html`<button
                class="btn lockact ${lSt === 'locked' ? 'warn' : ''}"
                @click=${() => this._lockAction(lock, lSt === 'locked' ? 'unlock' : 'lock')}>
                <ha-icon icon=${lSt === 'locked' ? 'mdi:lock-open-variant' : 'mdi:lock'}></ha-icon>
                ${this._t(lSt === 'locked' ? 'opening.unlock_action' : 'opening.lock_action')}
              </button>`
            : lock && ['locking', 'unlocking'].includes(String(lSt))
              ? html`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t('opening.lock_pending')}
                </button>`
              : nothing}
          ${!contact && !lock ? html`<p class="muted">${this._t('opening.no_entities')}</p>` : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._openingInfo = null)}>${this._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

  private _renderOpeningDialog(): TemplateResult {
    const d = this._openingDialog!;
    const icon = d.type === 'gate' ? 'mdi:gate'
      : d.type === 'window' ? 'mdi:window-closed-variant' : 'mdi:door';
    const opt = (list: { value: string; label: string }[], cur: string, set: (v: string) => void) =>
      html`<select class="areasel" @change=${(e: Event) => set((e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!cur}>${this._t('opening.none')}</option>
        ${list.map((c) => html`<option value=${c.value} ?selected=${c.value === cur}>${c.label}</option>`)}
      </select>`;
    return html`<hp-dialog .hass=${this.hass}
      .title=${d.id ? this._t('opening.edit') : this._t('opening.new')} icon=${icon}
      @hp-close=${() => (this._openingDialog = null)}>
        <div class="body">
          <label>${this._t('opening.type_label')}</label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'door'}
            @change=${() => (this._openingDialog = { ...d, type: 'door', lengthCm: d.id ? d.lengthCm : 90 })} />
            <span>${this._t('opening.door')}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'window'}
            @change=${() => (this._openingDialog = { ...d, type: 'window', lengthCm: d.id ? d.lengthCm : 120 })} />
            <span>${this._t('opening.window')}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'gate'}
            @change=${() => (this._openingDialog = {
              ...d, type: 'gate', lengthCm: d.id ? d.lengthCm : 300, flipH: false,
            })} />
            <span>${this._t('opening.gate')}</span></label>

          <label>${this._t('opening.length_label')}</label>
          <input class="namein tempin" type="number" min="20" max="600" step="5" .value=${String(d.lengthCm)}
            @input=${(e: Event) => {
              const n = strictNumber((e.target as HTMLInputElement).value);
              if (n != null) this._openingDialog = { ...d, lengthCm: n };
            }} />

          <label>${this._t('opening.contact_label')}</label>
          ${opt(this._contactCandidates(), d.contact, (v) => (this._openingDialog = { ...d, contact: v }))}
          ${d.contact
            ? html`<label class="srcrow">${this._boolInput(d.invert, (v) => (this._openingDialog = { ...d, invert: v }))}
                <span>${this._t('opening.invert')}</span></label>`
            : nothing}

          ${d.type !== 'window'
            ? html`<label>${this._t('opening.lock_label')}</label>
                ${opt(this._lockCandidates(), d.lock, (v) => (this._openingDialog = { ...d, lock: v }))}`
            : nothing}

          ${d.type !== 'gate'
            ? html`<label class="srcrow">${this._boolInput(d.flipH, (v) => (this._openingDialog = { ...d, flipH: v }))}
                <span>${this._t('opening.flip_h')}</span></label>`
            : nothing}
          <label class="srcrow">${this._boolInput(d.flipV, (v) => (this._openingDialog = { ...d, flipV: v }))}
            <span>${this._t('opening.flip_v')}</span></label>
        </div>
        <div class="row" slot="footer">
          ${d.id
            ? html`<button class="btn danger" @click=${this._deleteOpening}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.delete')}
              </button>`
            : nothing}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._openingDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveOpening}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

  /** Adaptive grid density for the current view (docs/CANVAS.md §7):
   *  which multiple of the drawing pitch is still legible on screen, and
   *  which coarser one carries the accent dots. */
  private _gridLevels(): { fine: number; coarse: number } | null {
    const stage = this._stageEl;
    const v = this._viewOr(this._baseVb());
    const px = stage && stage.clientWidth && v.w ? stage.clientWidth / v.w : 1;
    return gridLevels(this._gridPitch, px);
  }

  private _renderMarkupDefs(_vb: number[]): TemplateResult {
    const lv = this._gridLevels();
    if (!lv) return svg`<defs></defs>` as unknown as TemplateResult;
    const g = this._gridPitch * lv.fine;
    const G = this._gridPitch * lv.coarse;
    const dotR = this._gridPitch * lv.fine * 0.14;
    // Two patterns, CAD-style: the fine dots thin out as you zoom away
    // (gridLevels drops whole decades of them) while every coarse node keeps
    // a bigger, darker dot, so the eye never loses the scale reference.
    return svg`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${g}" height="${g}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${dotR}" class="griddot"></circle>
          <circle cx="${g}" cy="0" r="${dotR}" class="griddot"></circle>
          <circle cx="0" cy="${g}" r="${dotR}" class="griddot"></circle>
          <circle cx="${g}" cy="${g}" r="${dotR}" class="griddot"></circle>
        </pattern>
        <pattern id="hp-grid-major" x="0" y="0" width="${G}" height="${G}" patternUnits="userSpaceOnUse">
          <rect width="${G}" height="${G}" fill="url(#hp-grid)"></rect>
          <circle cx="0" cy="0" r="${dotR * 2.1}" class="griddot major"></circle>
          <circle cx="${G}" cy="0" r="${dotR * 2.1}" class="griddot major"></circle>
          <circle cx="0" cy="${G}" r="${dotR * 2.1}" class="griddot major"></circle>
          <circle cx="${G}" cy="${G}" r="${dotR * 2.1}" class="griddot major"></circle>
        </pattern>
      </defs>`;
  }

  private _renderPhysicalEditorLayer(): TemplateResult {
    const space = this._spaceModel();
    const g = this._gridPitch;
    const view = this._viewOr(this._baseVb());
    const stage = this._stageEl;
    const unitsPerPx = stage?.clientWidth ? view.w / stage.clientWidth : g / 8;
    const touchStroke = 24;
    const handleR = Math.max(g * 0.22, unitsPerPx * 8);
    const rotateHandleR = Math.max(handleR, unitsPerPx * 12);
    const path = (poly: number[][]) => `M ${poly.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
    const selected = (kind: string, id: string) =>
      (this._physicalSel?.kind === kind && this._physicalSel.id === id)
      || (kind === 'column' && this._duplicateColumnId === id);
    const draftSegs = (space.room_drafts || []).flatMap((d) => d.points.slice(0, -1).map((a, i) => {
      const b = d.points[i + 1];
      const depth = wallCmToUnits(d.segments[i]?.cm || 15, this._cellCm, this._gridPitch);
      return svg`<line class="physical-hit ${selected('draft', d.id) ? 'selected' : ''}"
        data-hp="room-draft" data-kind="segment" data-id=${d.id} data-segment=${i}
        x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]}
        stroke-width=${Math.max(touchStroke, depth / Math.max(unitsPerPx, 1e-9))}
        vector-effect="non-scaling-stroke"
        @pointerdown=${(e: PointerEvent) => {
          this._physicalSel = { kind: 'draft', id: d.id, segment: i };
          this._registerPhysicalTap('draft', d.id, i);
        }}></line>`;
    }));
    const partitions = (space.partitions || []).map((p) => {
      const body = partitionBody(p.a, p.b, p.cm, this._cellCm, this._gridPitch);
      if (!body) return nothing;
      return svg`<path class="physical-hit ${selected('partition', p.id) ? 'selected' : ''}"
        data-hp="partition" data-kind="partition" data-id=${p.id} d=${path(body)}
        stroke-width=${touchStroke} vector-effect="non-scaling-stroke"
        @pointerdown=${(e: PointerEvent) => this._physicalDown(e, 'partition', p.id)}
        @pointermove=${(e: PointerEvent) => this._physicalMove(e)}
        @pointerup=${(e: PointerEvent) => this._physicalUp(e)}></path>`;
    });
    const columns = (space.wall_columns || []).map((c) => {
      const shown = this._physicalRotate?.id === c.id
        ? { ...c, angle: this._physicalRotate.angle } as WallColumnCfg : c;
      const body = columnBody(shown, this._cellCm, this._gridPitch);
      return svg`<path class="physical-hit ${selected('column', c.id) ? 'selected' : ''}"
        data-hp="wall-column" data-kind=${c.shape} data-id=${c.id} d=${path(body)}
        stroke-width=${touchStroke} vector-effect="non-scaling-stroke"
        @pointerdown=${(e: PointerEvent) => this._physicalDown(e, 'column', c.id)}
        @pointermove=${(e: PointerEvent) => this._physicalMove(e)}
        @pointerup=${(e: PointerEvent) => this._physicalUp(e)}></path>`;
    });
    const drag = this._physicalDrag;
    const ghost = (() => {
      if (!drag?.moved) return nothing;
      const poly = drag.kind === 'partition'
        ? partitionBody((drag.base as PartitionCfg).a, (drag.base as PartitionCfg).b,
            (drag.base as PartitionCfg).cm, this._cellCm, this._gridPitch)
        : columnBody(drag.base as WallColumnCfg, this._cellCm, this._gridPitch);
      return poly ? svg`<path class="physical-drag" d=${path(poly)}
        transform="translate(${drag.delta[0]} ${drag.delta[1]})"></path>` : nothing;
    })();
    const chrome = (() => {
      const sel = this._physicalSel;
      if (!sel) return nothing;
      if (sel.kind === 'draft') {
        const d = space.room_drafts.find((x) => x.id === sel.id);
        if (!d) return nothing;
        return svg`<g class="physical-chrome" data-kind="draft-selection">
          <polyline class="frame" points=${d.points.map((p) => p.join(',')).join(' ')}></polyline>
          ${d.points.map((p) => svg`<circle class="move-dot" cx=${p[0]} cy=${p[1]} r=${handleR * 0.55}></circle>`)}
        </g>`;
      }
      if (sel.kind === 'partition') {
        const p = space.partitions.find((x) => x.id === sel.id);
        if (!p) return nothing;
        const body = partitionBody(p.a, p.b, p.cm, this._cellCm, this._gridPitch);
        if (!body) return nothing;
        const mx = (p.a[0] + p.b[0]) / 2, my = (p.a[1] + p.b[1]) / 2;
        return svg`<g class="physical-chrome" data-kind="partition-selection">
          <path class="frame" d=${path(body)}></path>
          <circle class="move-dot" cx=${p.a[0]} cy=${p.a[1]} r=${handleR * 0.55}></circle>
          <circle class="move-dot" cx=${p.b[0]} cy=${p.b[1]} r=${handleR * 0.55}></circle>
          <circle class="move-dot" cx=${mx} cy=${my} r=${handleR}></circle>
        </g>`;
      }
      const base = space.wall_columns.find((x) => x.id === sel.id);
      if (!base) return nothing;
      const c = this._physicalRotate?.id === base.id
        ? { ...base, angle: this._physicalRotate.angle } as WallColumnCfg : base;
      const body = columnBody(c, this._cellCm, this._gridPitch);
      if (c.shape !== 'square') return svg`<g class="physical-chrome" data-kind="circle-selection">
        <path class="frame" d=${path(body)}></path>
        <circle class="move-dot" cx=${c.center[0]} cy=${c.center[1]} r=${handleR}></circle>
      </g>`;
      const size = wallCmToUnits(c.cm, this._cellCm, this._gridPitch);
      const angle = canonicalColumnAngle(c.angle) * Math.PI / 180;
      const ux = Math.sin(angle), uy = -Math.cos(angle);
      const edge = [c.center[0] + ux * size / 2, c.center[1] + uy * size / 2];
      const handle = [edge[0] + ux * Math.max(g, unitsPerPx * 24),
        edge[1] + uy * Math.max(g, unitsPerPx * 24)];
      return svg`<g class="physical-chrome" data-kind="square-selection">
        <path class="frame" d=${path(body)}></path>
        <circle class="move-dot" cx=${c.center[0]} cy=${c.center[1]} r=${handleR}></circle>
        <line class="stem" x1=${edge[0]} y1=${edge[1]} x2=${handle[0]} y2=${handle[1]}></line>
        <circle class="rotate-handle" cx=${handle[0]} cy=${handle[1]} r=${rotateHandleR}
          data-kind="rotate" @pointerdown=${(e: PointerEvent) => this._physicalRotateDown(e, base)}
          @pointermove=${(e: PointerEvent) => this._physicalRotateMove(e)}
          @pointerup=${(e: PointerEvent) => this._physicalRotateUp(e)}></circle>
      </g>`;
    })();
    return svg`<g class="physical-editor">${draftSegs}${partitions}${columns}${ghost}${chrome}</g>`;
  }

  private _renderMarkupLayer(vb: number[]): TemplateResult {
    // derived walls minus the open stretches — those are drawn dashed on top
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    const thickCuts = this._thickWallCuts();
    const allCuts = openCuts.concat(thickCuts);
    const segs = allCuts.length
      ? cutSegments(this._segments, allCuts, this._gridPitch * 0.02)
      : this._segments;
    const path = this._path;
    const g = this._gridPitch;
    const view = this._viewOr(this._baseVb());
    const drawCm = this._tool === 'draw' || this._tool === 'partition' ? this._drawWallCm : null;
    const previewPts = (() => {
      if ((this._tool !== 'draw' && this._tool !== 'partition') || !path.length || !(drawCm != null && drawCm > 0)) return null;
      if (this._contourClosed) return path;
      if (this._cursorPt) return [...path, this._cursorPt];
      return path.length >= 2 ? path : null;
    })();
    const previewD = previewPts
      ? drawWallPreviewD(
          previewPts,
          wallCmToUnits(drawCm!, this._cellCm, this._gridPitch) / 2,
          this._contourClosed,
        )
      : '';
    return svg`
      ${this._gridLevels()
        ? svg`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`
        : nothing}
      ${segs.map((s) => svg`<line class="seg" x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}"></line>`)}
      ${this._renderPhysicalEditorLayer()}
      ${this._tool === 'column' && this._cursorPt && this._drawWallCm
        ? svg`<path class="physical-drag" d=${(() => {
            const c: WallColumnCfg = { id: 'preview', shape: 'square', center: this._cursorPt!, cm: this._drawWallCm! };
            const body = columnBody(c, this._cellCm, this._gridPitch);
            return `M ${body.map((p) => `${p[0]} ${p[1]}`).join(' L ')} Z`;
          })()}></path>`
        : nothing}
      ${previewD
        ? svg`<path class="drawwall-preview-fill" d="${previewD}"></path>
             <path class="drawwall-preview" d="${previewD}"></path>`
        : nothing}
      ${path.length > 1
        ? svg`<polyline class="pathline" points="${path.map((p) => p.join(',')).join(' ')}"></polyline>`
        : nothing}
      ${path.length && this._cursorPt && (this._tool === 'draw' || this._tool === 'partition') && !this._contourClosed
        ? svg`<line class="preview" x1="${path[path.length - 1][0]}" y1="${path[path.length - 1][1]}"
            x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`
        : nothing}
      ${path.map((p, i) => svg`<circle class="vertex ${i === 0 ? 'first' : ''}" cx="${p[0]}" cy="${p[1]}" r="${g * 0.22}"></circle>`)}
      ${(() => {
        const op = this._openingPreview;
        if (!op) return nothing;
        const rad = (op.angle * Math.PI) / 180;
        const dx = (Math.cos(rad) * op.rlen) / 2;
        const dy = (Math.sin(rad) * op.rlen) / 2;
        return svg`<line class="opghost" x1="${op.x - dx}" y1="${op.y - dy}"
          x2="${op.x + dx}" y2="${op.y + dy}"></line>
          <circle class="opghost-dot" cx="${op.x}" cy="${op.y}" r="${g * 0.18}"></circle>`;
      })()}
      ${this._tool === 'split' && this._splitSel?.pts?.length
        ? svg`${this._splitSel.pts.length > 1
              ? svg`<polyline class="pathline" points="${this._splitSel.pts.map((p) => p.join(',')).join(' ')}"></polyline>`
              : nothing}
            ${this._splitSel.pts.map((p, i) => svg`<circle class="vertex ${i === 0 ? 'first' : ''}" cx="${p[0]}" cy="${p[1]}" r="${g * 0.22}"></circle>`)}
            ${this._cursorPt
              ? svg`<line class="preview" x1="${this._splitSel.pts[this._splitSel.pts.length - 1][0]}" y1="${this._splitSel.pts[this._splitSel.pts.length - 1][1]}"
                  x2="${this._cursorPt[0]}" y2="${this._cursorPt[1]}"></line>`
              : nothing}`
        : nothing}
    `;
  }

  private _renderPhysicalDialog(): TemplateResult {
    const d = this._physicalDialog!;
    const column = d.kind === 'column';
    return html`<hp-dialog .hass=${this.hass}
      .title=${this._t(column ? 'physical.column_properties' : d.kind === 'partition'
        ? 'physical.partition_properties' : 'physical.draft_properties')}
      icon=${column ? 'mdi:vector-square' : 'mdi:wall'}
      @hp-close=${() => (this._physicalDialog = null)}>
        <div class="body">
          ${column ? html`<label>${this._t('physical.shape')}</label>
            <select class="areasel" @change=${(e: Event) => {
              const shape = (e.target as HTMLSelectElement).value as 'square' | 'circle';
              this._physicalDialog = { ...d, shape };
            }}>
              <option value="square" ?selected=${d.shape === 'square'}>${this._t('physical.square')}</option>
              <option value="circle" ?selected=${d.shape === 'circle'}>${this._t('physical.circle')}</option>
            </select>` : nothing}
          <label>${this._t(column
            ? d.shape === 'circle' ? 'physical.diameter' : 'physical.side'
            : 'wallthick.field')}</label>
          <div class="row"><input class="namein tempin" type="number"
            min=${cmToField(1, this._imperial)}
            max=${cmToField(column ? 150 : 100, this._imperial)} step="any" .value=${d.cm}
            @input=${(e: Event) => (this._physicalDialog = {
              ...d, cm: (e.target as HTMLInputElement).value,
            })} />
            <span class="opl">${this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span></div>
          ${column && d.shape === 'square' ? html`
            <label>${this._t('physical.rotation')}</label>
            <input class="namein tempin" type="number" min="0" max="89.999" step="5"
              .value=${d.angle || '0'}
              @input=${(e: Event) => (this._physicalDialog = {
                ...d, angle: (e.target as HTMLInputElement).value,
              })} />` : nothing}
          ${d.length ? html`<div class="muted">${this._t('physical.length')}: ${d.length}</div>` : nothing}
        </div>
        <div class="row" slot="footer">
          ${d.kind === 'draft' ? html`
            <button class="btn danger" @click=${this._deleteDraftSegment}>
              <ha-icon icon="mdi:vector-line"></ha-icon>${this._t('physical.delete_segment')}
            </button>
            <button class="btn danger" @click=${this._deleteDraftWhole}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('physical.delete_draft')}
            </button>` : html`
            <button class="btn danger" @click=${this._deletePhysicalSelection}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.delete')}
            </button>`}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._physicalDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._savePhysicalDialog}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

  private _renderMarkupBar(): TemplateResult {
    const undoName = this._geometryHistory.undoName;
    const redoName = this._geometryHistory.redoName;
    const boundaryPending = this._tool === 'boundary' && !!this._openWallAnchor;
    const undoTitle = boundaryPending
      ? this._t('markup.boundary_cancel')
      : undoName
      ? this._t('history.undo_named', { name: undoName })
      : this._t('history.undo_empty');
    const redoTitle = boundaryPending
      ? this._t('markup.boundary_cancel')
      : redoName
      ? this._t('history.redo_named', { name: redoName })
      : this._t('history.redo_empty');
    return html`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <span class="wallsgroup">
        <button class="btn ${this._tool === 'select' ? 'on' : ''}"
          @click=${() => { this._cancelPath(); this._tool = 'select'; }}
          title=${this._t('title.markup_select')}>
          <ha-icon icon="mdi:cursor-default-outline"></ha-icon>${this._t('markup.select')}
        </button>
        <button class="btn ${this._tool === 'draw' ? 'on' : ''}"
          @click=${() => { if (this._tool !== 'draw') {
            this._cancelPath(); this._tool = 'draw'; this._resumeLastDraft();
          } }}
          title=${this._t('title.markup_add')}>
          <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this._t('markup.add')}
        </button>
        ${this._tool === 'draw' || this._tool === 'partition' || this._tool === 'column'
          ? html`<label class="drawwall ${this._drawWallCm == null ? 'invalid' : ''}">${this._t('wallthick.field')}
              <input type="number" min=${cmToField(1, this._imperial)}
                max=${cmToField(150, this._imperial)} step="any"
                .value=${this._drawWallFieldValue}
                @input=${(e: Event) => {
                  this._drawWallField = (e.target as HTMLInputElement).value;
                }}
                title=${this._t(this._tool === 'draw' ? 'markup.draw_wall_title'
                  : this._tool === 'partition' ? 'physical.partition_size_title'
                  : 'physical.column_size_title')} />
              <span class="opl">${this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm')}</span>
              <span class="rangehint">${this._t('physical.allowed_range', {
                max: cmToField(this._drawWallMaxCm, this._imperial),
                unit: this._t(this._imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm'),
              })}</span>
            </label>`
          : nothing}
        <button class="btn ${this._tool === 'partition' ? 'on' : ''}"
          @click=${() => { this._cancelPath(); this._tool = 'partition'; }}
          title=${this._t('title.markup_partition')}>
          <ha-icon icon="mdi:wall"></ha-icon>${this._t('markup.partition')}
        </button>
        <button class="btn ${this._tool === 'column' ? 'on' : ''}"
          @click=${() => { this._cancelPath(); this._tool = 'column'; }}
          title=${this._t('title.markup_column')}>
          <ha-icon icon="mdi:vector-square"></ha-icon>${this._t('markup.column')}
        </button>
      </span>
      <button class="btn ${this._tool === 'merge' ? 'on' : ''}"
        @click=${() => { this._tool = 'merge'; this._cancelPath(); this._tool = 'merge'; }}
        title=${this._t('title.markup_merge')}>
        <ha-icon icon="mdi:vector-union"></ha-icon>${this._t('markup.merge')}
      </button>
      <button class="btn ${this._tool === 'split' ? 'on' : ''}"
        @click=${() => { this._tool = 'split'; this._cancelPath(); this._tool = 'split'; }}
        title=${this._t('title.markup_split')}>
        <ha-icon icon="mdi:vector-polyline-remove"></ha-icon>${this._t('markup.split')}
      </button>
      <button class="btn ${this._tool === 'resize' ? 'on' : ''}"
        @click=${() => { this._cancelPath(); this._tool = 'resize'; this._rszSel = null; }}
        title=${this._t('title.markup_resize')}>
        <ha-icon icon="mdi:arrow-expand-all"></ha-icon>${this._t('markup.resize')}
      </button>
      <button class="btn ${this._tool === 'opening' ? 'on' : ''}"
        @click=${() => { this._cancelPath(); this._tool = 'opening'; }}
        title=${this._t('title.markup_opening')}>
        <ha-icon icon="mdi:door"></ha-icon>${this._t('markup.opening')}
      </button>
      <button class="btn ${this._tool === 'boundary' ? 'on' : ''}"
        @click=${() => { this._cancelPath(); this._tool = 'boundary'; this._wallDialog = null; }}
        aria-pressed=${this._tool === 'boundary' ? 'true' : 'false'}
        title=${this._t('title.markup_boundary')}>
        <ha-icon icon="mdi:border-style"></ha-icon>${this._t('markup.boundary')}
      </button>
      <button class="btn ${this._tool === 'wallthick' ? 'on' : ''}"
        @click=${() => { this._cancelPath(); this._tool = 'wallthick'; this._wallDialog = null; }}
        title=${this._t('title.markup_wallthick')}>
        <ha-icon icon="mdi:wall"></ha-icon>${this._t('markup.wallthick')}
      </button>
      <button class="btn ${this._tool === 'delroom' ? 'on' : ''}"
        @click=${() => { this._cancelPath(); this._tool = 'delroom'; }}
        title=${this._t('title.markup_delroom')}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('markup.delete_room')}
      </button>
      <button class="btn ghost" @click=${this._undoGeometry}
        ?disabled=${!undoName && !boundaryPending}
        title=${undoTitle} aria-label=${undoTitle}>
        <ha-icon icon="mdi:undo-variant" aria-hidden="true"></ha-icon>
      </button>
      <button class="btn ghost" @click=${this._redoGeometry}
        ?disabled=${!redoName && !boundaryPending}
        title=${redoTitle} aria-label=${redoTitle}>
        <ha-icon icon="mdi:redo-variant" aria-hidden="true"></ha-icon>
      </button>
      <span class="spacer"></span>
      ${this._tool === 'draw'
        ? html`<span class="hint">${this._path.length
              ? this._t('markup.hint_points', { n: this._path.length })
              : this._t('markup.hint_start')}</span>
            ${this._path.length ? html`<button class="btn ghost" @click=${this._cancelPath}>${this._t('btn.reset')}</button>` : nothing}`
        : nothing}
      ${this._tool === 'partition' ? html`<span class="hint">${this._t('markup.hint_partition')}</span>` : nothing}
      ${this._tool === 'column' ? html`<span class="hint">${this._t('markup.hint_column')}</span>` : nothing}
      ${this._tool === 'resize' ? html`<span class="hint">${this._t('markup.hint_resize')}</span>` : nothing}
      ${this._tool === 'boundary'
        ? html`<span class="hint" role="status" aria-live="polite">${this._t(this._boundaryHintKey)}</span>`
        : nothing}
      ${this._tool === 'wallthick' ? html`<span class="hint">${this._t('markup.hint_wallthick')}</span>` : nothing}
      ${this._physicalSel
        ? html`<button class="btn ghost" @click=${() => {
              const s = this._physicalSel!;
              this._openPhysicalDialog(s.kind, s.id, s.segment);
            }}><ha-icon icon="mdi:tune"></ha-icon>${this._t('btn.properties')}</button>
            <button class="btn danger" @click=${this._deletePhysicalSelection}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.delete')}
            </button>`
        : nothing}
      <button class="btn barclose" title=${this._t('title.close_editor')}
        @click=${() => this._setMode('view')}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`;
  }

  private _renderDevicesBar(): TemplateResult {
    return html`<div class="editbar devbar">
      <ha-icon icon="mdi:tune-variant" class="warn"></ha-icon>
      <button class="btn" @click=${() => this._openMarkerDialog()} title=${this._t('title.add_device')}>
        <ha-icon icon="mdi:plus-box-outline"></ha-icon>${this._t('devbar.add')}
      </button>
      <button class="btn ${this._showAll ? 'on' : ''}" @click=${this._toggleShowAll}
        title=${this._t('title.show_all')}>
        <ha-icon icon="${this._showAll ? 'mdi:eye' : 'mdi:eye-off-outline'}"></ha-icon>${this._t('devbar.show_all')}
      </button>
      <button class="btn" @click=${this._openRulesDialog} title=${this._t('title.icon_rules')}>
        <ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t('devbar.rules')}
      </button>
      <span class="spacer"></span>
      <button class="btn barclose" title=${this._t('title.close_editor')}
        @click=${() => this._setMode('view')}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    </div>`;
  }

  /** Entities of a device worth CONTROLLING or reading, in a sensible order. */
  private _cardEntities(d: DevItem): { eid: string; kind: 'toggle' | 'value' | 'open' }[] {
    const h = this._planHass;
    const out: { eid: string; kind: 'toggle' | 'value' | 'open' }[] = [];
    const seen = new Set<string>();
    const push = (eid: string) => {
      if (!eid || seen.has(eid) || !h.states[eid]) return;
      const reg = h.entities[eid];
      if (reg?.entity_category === 'config' || reg?.entity_category === 'diagnostic') return;
      seen.add(eid);
      const dom = eid.split('.')[0];
      if (['light', 'switch', 'fan', 'humidifier', 'siren', 'input_boolean'].includes(dom))
        out.push({ eid, kind: 'toggle' });
      else if (['cover', 'valve', 'lock', 'climate', 'media_player', 'vacuum', 'water_heater'].includes(dom))
        out.push({ eid, kind: 'open' }); // needs the full more-info UI
      else if (['sensor', 'binary_sensor', 'number', 'select'].includes(dom))
        out.push({ eid, kind: 'value' });
    };
    for (const source of resolvedLightSources(h, [d])) push(source.eid);
    if (d.primary) push(d.primary);
    for (const e of d.entities) push(e);
    return out.slice(0, 12);
  }

  /** Toggle straight from the device card (safe domains only). */
  private _cardToggle(eid: string): void {
    const dom = eid.split('.')[0];
    if (dom === 'lock' || dom === 'alarm_control_panel' || !this._planEntityAvailable(eid)) return;
    this.hass
      .callService('homeassistant', 'toggle', { entity_id: eid })
      .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
  }

  private _renderInfoCard(): TemplateResult {
    const d = this._infoCard!;
    const st = d.primary ? this.hass.states[d.primary] : undefined;
    const stateTxt = st ? hassValue(this.hass, d.primary)?.text ?? st.state : null;
    const controls = (d.controls ?? d.marker?.controls ?? [])
      .filter(isControllable).filter((eid) => this._planEntityAvailable(eid));
    return html`<hp-dialog .hass=${this.hass} .title=${d.name} .icon=${d.icon} wide
      dismiss-on-scrim @hp-close=${() => (this._infoCard = null)}>
        <div class="body">
          ${(() => {
            // Field feedback: on a wall tablet this card is for CONTROLLING the
            // home; model/links/manuals are reference material and belong below.
            const ents = this._cardEntities(d);
            if (!ents.length) return nothing;
            return html`<div class="entlist">
              ${ents.map(({ eid, kind }) => {
                const est = this.hass.states[eid];
                const name = this.hass.entities[eid]?.name
                  || est?.attributes?.friendly_name || eid;
                const val = est ? hassValue(this.hass, eid)?.text ?? est.state : '';
                const on = est?.state === 'on' || ['open', 'unlocked', 'playing', 'cleaning'].includes(est?.state);
                return html`<div class="entrow ${on ? 'on' : ''}">
                  <ha-icon icon=${stateIcon(
                    iconFor(name, '', this._iconRules), eid.split('.')[0],
                    est?.attributes?.device_class, est?.state, false,
                  )}></ha-icon>
                  <span class="en">${name}</span>
                  ${kind === 'toggle'
                    ? html`<button class="entbtn ${on ? 'on' : ''}"
                        @click=${() => this._cardToggle(eid)}>${val}</button>`
                    : kind === 'open'
                      ? html`<button class="entbtn"
                          @click=${() => { this._infoCard = null; this._openMoreInfo(eid); }}>${val}</button>`
                      : html`<span class="ev">${val}</span>`}
                </div>`;
              })}
            </div>`;
          })()}
          ${d.model ? html`<div class="inforow"><span class="k">${this._t('info.model')}</span><span>${d.model}</span></div>` : nothing}
          ${stateTxt && !this._cardEntities(d).length
            ? html`<div class="inforow"><span class="k">${this._t('info.state')}</span><span>${stateTxt}</span></div>` : nothing}
          ${safeUrl(d.link)
            ? html`<div class="inforow"><span class="k">${this._t('info.link')}</span>
                <a href="${safeUrl(d.link)}" target="_blank" rel="noreferrer noopener">${d.link}</a></div>`
            : nothing}
          ${d.description ? html`<div class="infodesc">${d.description}</div>` : nothing}
          ${d.pdfs && d.pdfs.length
            ? html`<div class="inforow"><span class="k">${this._t('info.manuals')}</span><span class="pdflist">
                ${d.pdfs.map(
                  (p) => html`<a class="pdf" href="${safeUrl(this._display(p.url)) || '#'}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${p.name}</a>`,
                )}</span></div>`
            : nothing}
          ${controls.length
            ? html`<div class="inforow"><span class="k">${this._t('info.controls')}</span>
                <span class="ctrlstates">
                  ${controls.map((eid) => {
                    const cs = this.hass.states[eid];
                    const on = cs?.state === 'on';
                    return html`<span class="ctrlstate ${on ? 'on' : ''}">
                      <ha-icon icon=${on ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}></ha-icon>
                      ${cs?.attributes?.friendly_name || eid}</span>`;
                  })}
                </span></div>`
            : nothing}
          ${!d.model && !stateTxt && !d.link && !d.description && !(d.pdfs && d.pdfs.length) && !controls.length
            ? html`<div class="infodesc muted">${this._t('info.none')}</div>`
            : nothing}
        </div>
        <div class="row infofooter" slot="footer">
          <button class="btn" @click=${() => { const dd = d; this._infoCard = null; this._openMarkerDialog(dd); }}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t('btn.edit')}
          </button>
          ${d.primary
            ? html`<button class="btn" @click=${() => { const p = d.primary; this._infoCard = null; this._openMoreInfo(p); }}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t('btn.open_in_ha')}
              </button>`
            : nothing}
          <button class="btn ghost infofooter-close" @click=${() => (this._infoCard = null)}>${this._t('btn.close')}</button>
        </div>
    </hp-dialog>`;
  }

  /** Convert the transactional dialog state into the marker that Save would write. */
  private _markerDraft(d: NonNullable<HouseplanCard['_markerDialog']>): Marker | null {
    if (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual')) return null;
    const roomRef = parseRoomRef(d.room);
    const id = markerIdForBinding(d.binding, d.devId, () => '__hp_device_preview__');
    const previous = this._markers.find((marker) => marker.id === id || marker.id === d.devId);
    const controls = persistedExternalControls(
      d.binding, d.controls, this._bindingEntities(d.binding),
    );
    const marker: Marker = {
      id,
      binding: d.binding,
      name: d.name.trim() || null,
      icon: d.icon || null,
      display: d.display !== 'badge' ? d.display : null,
      ripple_color: d.display === 'icon_ripple' && d.rippleColor ? d.rippleColor : null,
      ripple_size: d.display === 'icon_ripple' && d.rippleSize !== 3 ? d.rippleSize : null,
      size: d.size !== 1 ? d.size : null,
      angle: d.angle || null,
      tap_action: d.tapAction || null,
      tap_target: d.tapAction === 'run' ? d.tapTarget || null : null,
      tap_confirm: d.tapConfirm ? true : null,
      controls: controls.length ? controls : null,
      is_light: d.isLight ? true : null,
      use_climate_temp: d.useClimateTemp ? true : null,
      glow_radius_cm: (() => {
        const value = strictNumber(d.glowRadius);
        if (value == null || value <= 0) return null;
        return Math.round(this._imperial ? value * 30.48 : value * 100);
      })(),
      model: d.model.trim() || null,
      link: d.link.trim() || null,
      description: d.description.trim() || null,
      pdfs: d.pdfs,
      hidden: d.hideFromPlan,
      vacuum: previous?.vacuum || null,
    };
    if (d.binding === 'virtual' || d.room) {
      marker.space = roomRef?.space || (d.binding === 'virtual' ? this._space : null);
      marker.area = roomRef?.area || null;
      marker.room_id = roomRef?.roomId || null;
    }
    return marker;
  }

  /** Runtime device for the unsaved marker, built by the production pipeline. */
  private _markerPreviewDevice(d: NonNullable<HouseplanCard['_markerDialog']>): DevItem | null {
    const marker = this._markerDraft(d);
    if (!marker) return null;
    const key = `${this._haRegistry.revision}\n${JSON.stringify(marker)}`;
    if (this._markerPreviewMemo?.key === key) return this._markerPreviewMemo.device;
    const device = deviceFromMarkerDraft({
      hass: this.hass,
      registry: this._haRegistry,
      areaToSpace: Object.fromEntries(
        Object.entries(this._areaToSpace).map(([area, value]) => [area, value.space]),
      ),
      marker,
      settings: this._settings,
      excluded: this._excluded,
      showAll: this._showAll,
      firstSpaceId: this._model[0]?.id || this._space,
      loc: (key) => this._t(key),
      iconRules: this._iconRules,
    });
    this._markerPreviewMemo = { key, device };
    return device;
  }

  private _renderMarkerDialog(): TemplateResult {
    const d = this._markerDialog!;
    const isVirtual = d.bindingMode === 'virtual';
    const cands = this._bindingCandidates();
    const ownEntities = this._bindingEntities(d.binding);
    const bindingStatus = isVirtual ? null : this._bindingStatus(d.binding);
    const canOpenBindingInHa = !isVirtual && this._bindingHasHaPage(d.binding);
    const previewDevice = this._markerPreviewDevice(d);
    const previewSpaceDisplay = previewDevice
      ? spaceDisplayOf(this._serverCfg?.spaces.find((space: any) => space.id === previewDevice.space))
      : null;
    const previewPresentation = previewDevice
      ? resolveDevicePresentation(this._planHass, previewDevice, {
          liveStates: this._config?.live_states !== false,
          showTemperature: this._config?.show_temperature !== false,
          showSignal: previewSpaceDisplay?.showLqi ?? (this._config?.show_signal !== false),
          designPreview: true,
          activityRuntime: this._activityRt.get(previewDevice.id),
        })
      : null;
    const curLabel = (() => {
      if (isVirtual) return null;
      const found = cands.find((c) => c.value === d.binding);
      if (found) return found.label;
      const [k, ref] = d.binding.split(':');
      if (k === 'device') return this._fullRegistryHass.devices[ref]?.name_by_user || this._fullRegistryHass.devices[ref]?.name || ref;
      return this._fullRegistryHass.entities[ref]?.name || this.hass.states[ref]?.attributes?.friendly_name || ref;
    })();
    return html`<hp-dialog .hass=${this.hass}
      .title=${d.devId ? this._t('info.device_header') : this._t('marker.new_device')}
      icon="mdi:shape-plus" wide @hp-close=${() => (this._markerDialog = null)}>
        <div class="body">
          ${bindingStatus?.kind === 'ha_disabled'
            ? html`<div class="habindingbanner" role="status">
                <ha-icon icon="mdi:power-plug-off-outline"></ha-icon>
                <span>${this._t((`marker.ha_disabled_${bindingStatus.reason}`) as any)}</span>
                ${canOpenBindingInHa
                  ? html`<button class="btn ghost" type="button" @click=${() => this._openBindingInHa(d.binding)}>
                      <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t('btn.open_in_ha')}
                    </button>`
                  : nothing}
              </div>`
            : bindingStatus?.kind === 'unverified' && !!d.binding
              ? html`<div class="habindingbanner limited" role="status">
                  <ha-icon icon="mdi:shield-alert-outline"></ha-icon>
                  <span>${this._t('marker.ha_registry_limited')}</span>
                </div>`
              : nothing}
          <label>${this._t('marker.name_label')}</label>
          <input class="namein" type="text" placeholder=${this._t('marker.name_ph')}
            .value=${d.name}
            @input=${(e: Event) => (this._markerDialog = { ...d, name: (e.target as HTMLInputElement).value })} />

          <label>${this._t('marker.binding_label')}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${d.bindingMode === 'virtual'}
                @change=${() => (this._markerDialog = {
                  ...d, bindingMode: 'virtual', binding: 'virtual', bindingOpen: false,
                  controls: effectiveMarkerControls('virtual', d.controls),
                  autoIcon: this._autoIconForBinding('virtual'),
                })} />
              <span>${this._t('marker.virtual_option')}</span>
            </label>
            <div class="bindharow">
              <label class="srcrow">
                <input type="radio" name="bmode" .checked=${d.bindingMode === 'ha'}
                  @change=${() => (this._markerDialog = {
                    ...d, bindingMode: 'ha',
                    binding: d.binding === 'virtual' ? '' : d.binding,
                    bindingOpen: d.binding === 'virtual' || !d.binding,
                  })} />
                <span>${this._t('marker.from_ha_option')}</span>
              </label>
              <label class="srcrow inline entcheck" title=${this._t('marker.show_entities_tip')}>
                ${this._boolInput(d.showEntities, (v) => (this._markerDialog = { ...d, showEntities: v }),
                  d.bindingMode !== 'ha')}
                <span>${this._t('marker.show_entities')}</span>
              </label>
            </div>
            ${d.bindingMode === 'ha'
              ? html`<button class="dropbtn ${d.bindingOpen ? 'open' : ''}"
                    @click=${() => (this._markerDialog = { ...d, bindingOpen: !d.bindingOpen })}>
                    ${curLabel
                      ? html`<b>${curLabel}</b><span class="ref">${d.binding}${bindingStatus?.kind === 'ha_disabled'
                          ? ` · ${this._t('marker.binding_disabled')}` : ''}</span>`
                      : html`<span class="muted">${this._t('marker.pick_ph')}</span>`}
                    <ha-icon icon=${d.bindingOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
                  </button>
                  ${d.bindingOpen
                    ? html`<div class="droppanel">
                        <input class="namein" type="text" placeholder=${this._t('marker.search_ph')}
                          .value=${d.bindingFilter}
                          @input=${(e: Event) => (this._markerDialog = { ...d, bindingFilter: (e.target as HTMLInputElement).value })} />
                        <div class="candlist">
                          ${cands.map(
                            (c) => html`<div class="cand ${c.value === d.binding ? 'sel' : ''}"
                              @click=${() => (this._markerDialog = {
                                ...d, binding: c.value, bindingOpen: false,
                                controls: effectiveMarkerControls(
                                  c.value, d.controls, this._bindingEntities(c.value),
                                ),
                                autoIcon: this._autoIconForBinding(c.value),
                              })}>
                              <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                            </div>`,
                          )}
                          ${!cands.length ? html`<div class="cand muted">${this._t('marker.nothing_found')}</div>` : nothing}
                        </div>
                      </div>`
                    : nothing}`
              : nothing}
          </div>

          <label>${this._t('marker.room_label')}${isVirtual ? '' : this._t('marker.room_override')}</label>
          <select class="areasel"
            @change=${(e: Event) => (this._markerDialog = { ...d, room: (e.target as HTMLSelectElement).value })}>
            <option value="">${isVirtual ? this._t('marker.room_choose') : this._t('marker.room_auto')}</option>
            ${this._allRoomsFlat().map(
              (r) => html`<option value=${r.value} ?selected=${r.value === d.room}>${r.label}</option>`,
            )}
          </select>

          ${this._renderVacSection(d)}

          <label>${this._t('marker.tap_label')}</label>
          <select class="areasel"
            @change=${(e: Event) => (this._markerDialog = { ...d, tapAction: (e.target as HTMLSelectElement).value })}>
            ${TAP_ACTIONS.filter((v) => v !== 'cover' || this._bindingCoverTap(d.binding))
              .map((v) => [v, 'tap.' + v.replace('-', '_')] as const).map(
              ([v, k]) => html`<option value=${v} ?selected=${(d.tapAction || d.defaultTap) === v}>${this._t(k as any)}</option>`,
            )}
          </select>
          ${d.tapAction === 'run'
            ? (() => {
                const q = d.runFilter.trim().toLowerCase();
                const cands = this._runCandidates().filter(
                  (c) => !q || c.label.toLowerCase().includes(q) || c.value.includes(q),
                );
                const cur = d.tapTarget ? this._runCandidates().find((c) => c.value === d.tapTarget) : null;
                return html`
                  <label>${this._t('marker.run_target_label')}</label>
                  ${d.tapTarget && !cur
                    ? html`<div class="rhint">${this._t('marker.run_target_gone', { id: d.tapTarget })}</div>`
                    : nothing}
                  <input class="namein" type="text" placeholder=${this._t('marker.run_search_ph')}
                    .value=${cur ? cur.label : d.runFilter}
                    @focus=${(e: Event) => { (e.target as HTMLInputElement).select(); }}
                    @input=${(e: Event) => (this._markerDialog = { ...d, runFilter: (e.target as HTMLInputElement).value, tapTarget: '' })} />
                  ${!cur
                    ? html`<div class="candlist">
                        ${cands.slice(0, 40).map(
                          (c) => html`<div class="cand ${c.value === d.tapTarget ? 'sel' : ''}"
                            @click=${() => (this._markerDialog = { ...d, tapTarget: c.value, runFilter: '' })}>
                            <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                          </div>`,
                        )}
                        ${!cands.length ? html`<div class="cand muted">${this._t('marker.nothing_found')}</div>` : nothing}
                      </div>`
                    : nothing}`;
              })()
            : nothing}
          ${d.tapAction === 'run' || d.tapAction === 'toggle' || d.tapAction === 'cover' || (!d.tapAction && d.defaultTap === 'toggle')
            ? html`<label class="srcrow" title=${this._t('marker.tap_confirm_tip')}>
                ${this._boolInput(d.tapConfirm, (v) => (this._markerDialog = { ...d, tapConfirm: v }))}
                <span>${this._t('marker.tap_confirm')}</span>
              </label>`
            : nothing}

          <label>${this._t('marker.controls_label')}</label>
          <div class="rhint">${this._t('marker.controls_hint')}</div>
          ${d.controls.length
            ? html`<div class="ctrlchips">
                ${d.controls.map((eid) => html`<span class="ctrlchip">
                  ${this.hass.states[eid]?.attributes?.friendly_name || eid}
                  <ha-icon icon="mdi:close" @click=${() =>
                    (this._markerDialog = { ...d, controls: d.controls.filter((x) => x !== eid) })}></ha-icon>
                </span>`)}
              </div>`
            : nothing}
          <input class="namein" type="text" placeholder=${this._t('marker.controls_filter')}
            .value=${d.controlsFilter}
            @input=${(e: Event) => (this._markerDialog = { ...d, controlsFilter: (e.target as HTMLInputElement).value })} />
          ${d.controlsFilter.trim()
            ? html`<div class="ctrllist">
                ${Object.keys(this.hass.states)
                  .filter((eid) => effectiveMarkerControls(d.binding, [eid], ownEntities).length > 0
                    && !d.controls.includes(eid) && this._planEntityAvailable(eid))
                  .filter((eid) => {
                    const q = d.controlsFilter.trim().toLowerCase();
                    const name = String(this.hass.states[eid]?.attributes?.friendly_name || '');
                    return eid.toLowerCase().includes(q) || name.toLowerCase().includes(q);
                  })
                  .slice(0, 8)
                  .map((eid) => html`<button class="ctrlopt"
                    @click=${() => (this._markerDialog = { ...d, controls: [...d.controls, eid], controlsFilter: '' })}>
                    <ha-icon icon=${eid.startsWith('light.') ? 'mdi:lightbulb' : 'mdi:toggle-switch'}></ha-icon>
                    ${this.hass.states[eid]?.attributes?.friendly_name || eid}
                    <span class="sub">${eid}</span>
                  </button>`)}
              </div>`
            : nothing}

          ${this._bindingHasClimate(d.binding)
            ? html`<label class="srcrow climrow" title=${this._t('marker.use_climate_temp_tip')}>
                ${this._boolInput(d.useClimateTemp, (v) => (this._markerDialog = { ...d, useClimateTemp: v }))}
                <span>${this._t('marker.use_climate_temp')}</span>
              </label>`
            : nothing}
          <label class="srcrow" title=${this._t('marker.is_light_tip')}>
            ${this._boolInput(d.isLight, (v) => (this._markerDialog = { ...d, isLight: v }))}
            <span>${this._t('marker.is_light')}</span>
          </label>
          <label>${this._t('marker.glow_radius_label')}</label>
          <div class="colorrow">
            <input class="tempin" type="number" min="0.5" step="0.5"
              placeholder=${this._glowRadiusPlaceholder}
              .value=${d.glowRadius}
              @input=${(e: Event) => (this._markerDialog = { ...d, glowRadius: (e.target as HTMLInputElement).value })} />
            <span class="opl">${this._imperial ? this._t('gs.unit_ft') : this._t('gs.unit_m')}</span>
            <span class="opl muted">${this._t('marker.glow_radius_hint')}</span>
          </div>

          <label>${this._t('marker.icon_label')}</label>
          ${customElements.get('ha-icon-picker')
            // Feed the effective icon to HA's picker so its field renders both
            // the glyph and the mdi:* label. autoIcon is presentation-only:
            // untouched dialogs still save d.icon as an empty auto override.
            ? html`<ha-icon-picker .hass=${this.hass} .value=${d.icon || d.autoIcon}
                .placeholder=${d.autoIcon || undefined}
                .fallbackPath=${undefined}
                @value-changed=${(e: any) => {
                  const icon = e.detail.value || '';
                  // Some picker versions announce an assigned value. Do not
                  // let that turn the display-only auto icon into an override.
                  if (!d.icon && icon === d.autoIcon) return;
                  this._markerDialog = { ...d, icon };
                }}></ha-icon-picker>`
            : html`<input class="namein" type="text"
                placeholder=${d.autoIcon || this._t('marker.icon_ph')}
                .value=${d.icon}
                @input=${(e: Event) => (this._markerDialog = { ...d, icon: (e.target as HTMLInputElement).value })} />`}
          ${!d.icon && d.autoIcon
            ? html`<p class="muted iconauto"><ha-icon icon=${d.autoIcon}></ha-icon>
                <span>${this._t('marker.icon_auto', { icon: d.autoIcon })}</span>
                <button class="btn ghost" type="button"
                  @click=${() => (this._markerDialog = { ...d, icon: d.autoIcon })}>
                  ${this._t('marker.icon_pin_auto')}
                </button></p>`
            : nothing}

          <label>${this._t('marker.display_label')}</label>
          <select class="areasel"
            @change=${(e: Event) => (this._markerDialog = { ...d, display: (e.target as HTMLSelectElement).value as any })}>
            ${DISPLAY_MODES.map((v) => [v, 'display.' + v] as const).map(
              ([v, k]) => html`<option value=${v} ?selected=${d.display === v}>${this._t(k as any)}</option>`,
            )}
          </select>
          <p class="muted">${this._t('marker.display_hint')}</p>
          ${previewPresentation
            ? html`<hp-device-preview
                .hass=${this.hass}
                .presentation=${previewPresentation}
                .registry=${this._haRegistry}
                .deviceName=${d.name.trim() || previewDevice?.name || curLabel || ''}>
              </hp-device-preview>`
            : html`<div class="devicepreview-empty">
                <ha-icon icon="mdi:eye-outline"></ha-icon>
                <span>${this._t('marker.preview.select_source')}</span>
              </div>`}
          ${d.display === 'icon_ripple'
            ? html`<div class="colorrow">
                <span class="opl">${this._t('marker.activity_color')}</span>
                <input type="color" .value=${d.rippleColor || '#3ea6ff'}
                  @input=${(e: Event) => (this._markerDialog = { ...d, rippleColor: (e.target as HTMLInputElement).value })} />
                <span class="opl">${this._t('marker.ripple_size')}</span>
                ${this._rangeInput(2, 8, 0.5, d.rippleSize, (n) => (this._markerDialog = { ...d, rippleSize: n }))}
                <span class="opv">×${d.rippleSize}</span>
              </div>`
            : nothing}

          <label>${this._t('marker.size_label')}</label>
          <div class="colorrow">
            ${this._rangeInput(0.5, 3, 0.1, d.size, (n) => (this._markerDialog = { ...d, size: n }))}
            <span class="opv">×${d.size.toFixed(1)}</span>
            <span class="opl">${this._t('marker.angle_label')}</span>
            ${''/* 5 degrees, not 10 (owner 2026-08-03): a marker often has to
                   line up with a wall that is not on a 10-degree grid. */}
            ${this._rangeInput(0, 355, 5, d.angle, (n) => (this._markerDialog = { ...d, angle: n }))}
            <span class="opv">${d.angle}°</span>
          </div>

          <label>${this._t('marker.model_label')}</label>
          <input class="namein" type="text" placeholder=${this._t('marker.model_ph')}
            .value=${d.model}
            @input=${(e: Event) => (this._markerDialog = { ...d, model: (e.target as HTMLInputElement).value })} />

          <label>${this._t('marker.link_label')}</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${d.link}
            @input=${(e: Event) => (this._markerDialog = { ...d, link: (e.target as HTMLInputElement).value })} />

          <label>${this._t('marker.desc_label')}</label>
          <textarea class="descin" rows="4" placeholder=${this._t('marker.desc_ph')}
            .value=${d.description}
            @input=${(e: Event) => (this._markerDialog = { ...d, description: (e.target as HTMLTextAreaElement).value })}></textarea>

          <label>${this._t('marker.manuals_label')}</label>
          <div class="pdfedit">
            ${d.pdfs.map(
              (p) => html`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${safeUrl(this._display(p.url)) || '#'}" target="_blank" rel="noreferrer noopener">${p.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${() => this._removeMarkerPdf(p.url)}></ha-icon></span>`,
            )}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>${this._t('btn.attach')}
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${(e: Event) => this._pickMarkerFiles(e)} />
            </label>
          </div>
        </div>
        <div class="row markerfooter" slot="footer">
          <div class="markeractions">
            ${d.devId
              ? html`<button class="btn" type="button"
                  ?disabled=${d.busy}
                  aria-pressed=${d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'true' : 'false'}
                  title=${this._t(d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'marker.show_tip' : 'marker.hide_tip')}
                  @click=${this._toggleMarkerDialogVisibility}>
                  <ha-icon icon=${d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}></ha-icon>
                  ${this._t(d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'marker.show' : 'marker.hide')}
                </button>`
              : nothing}
            ${d.devId
              ? html`<button class="btn danger" type="button" ?disabled=${d.busy}
                  title=${this._t('marker.delete_tip')} @click=${this._deleteMarker}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.delete')}
                </button>`
              : nothing}
          </div>
          <div class="markersaveactions">
            <button class="btn ghost" ?disabled=${d.busy}
              @click=${() => (this._markerDialog = null)}>${this._t('btn.cancel')}</button>
            <button class="btn on" @click=${this._saveMarker}
              ?disabled=${d.busy || (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual'
                || (!d.devId && bindingStatus?.kind !== 'active')))}
              title=${d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual') ? this._t('marker.pick_ph') : ''}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }

  private _renderSpaceDialog(): TemplateResult {
    const d = this._spaceDialog!;
    const progress = this._importTotal > 0 && d.mode === 'create'
      ? this._t('import.progress', {
          i: this._importTotal - this._importQueue.length,
          n: this._importTotal,
        })
      : '';
    const close = () => {
      this._spaceDialog = null;
      this._importQueue = [];
      this._importTotal = 0;
    };
    return html`<hp-dialog .hass=${this.hass}
      .title=${`${d.mode === 'create' ? this._t('space.new') : this._t('space.header')}${progress ? ` · ${progress}` : ''}`}
      icon="mdi:floor-plan" wide @hp-close=${close}>
        <div class="body">
          <label>${this._t('space.title_label')}</label>
          <input class="namein" type="text" placeholder=${this._t('space.title_ph')}
            .value=${d.title}
            @input=${(e: Event) => (this._spaceDialog = { ...d, title: (e.target as HTMLInputElement).value })} />
          <label>${this._t('space.plan_label')}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'file'}
              @change=${() => (this._spaceDialog = { ...d, source: 'file' })} />
            <span>${this._t('space.source_file')}</span>
          </label>
          ${d.source === 'file'
            ? html`<div class="planrow">
                ${d.planFile
                  ? html`<span class="planname">${d.planFile.name}</span>`
                  : d.planUrl
                    ? html`<img class="planprev" src=${this._display(d.planUrl)} alt=${this._t('space.plan_alt')} />`
                    : html`<span class="planname muted">${this._t('space.no_plan')}</span>`}
                <label class="btn filebtn">
                  <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? this._t('btn.replace') : this._t('btn.upload')}
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${(e: Event) => this._pickPlanFile(e)} />
                </label>
                <button class="btn ghost" @click=${this._toggleServerPlans}
                  title=${this._t('space.pick_saved_hint')}>
                  <ha-icon icon="mdi:folder-image"></ha-icon>${this._t('space.pick_saved')}
                </button>
              </div>
              ${d.pickSaved ? this._renderServerPlans(d) : nothing}`
            : nothing}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'draw'}
              @change=${() => (this._spaceDialog = { ...d, source: 'draw' })} />
            <span>${this._t('space.source_draw')}</span>
          </label>

          <label>${this._t('space.scale_label')}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min=${CELL_CM_MIN} max=${CELL_CM_MAX}
              step="0.1" .value=${String(d.cellCm)}
              @input=${(e: Event) => {
                const n = strictNumber((e.target as HTMLInputElement).value);
                this._spaceDialog = {
                  ...d, cellCm: n != null && n > 0
                    ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, n)) : d.cellCm,
                };
              }} />
            <span class="opl">${this._t('space.scale_unit')}</span>
          </div>

          <label class="dispsection">${this._t('space.display_section')}</label>
          <label class="srcrow">
            ${this._boolInput(d.showBorders, (v) => (this._spaceDialog = { ...d, showBorders: v }))}
            <span>${this._t('space.show_borders')}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(d.showNames, (v) => (this._spaceDialog = { ...d, showNames: v }))}
            <span>${this._t('space.show_names')}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(d.showLqi, (v) => (this._spaceDialog = { ...d, showLqi: v }))}
            <span>${this._t('space.show_lqi')}</span>
          </label>
          ${''/* the two "draw less" switches (owner 2026-08-05). They only
                 hide: the shapes and the openings stay in the config and
                 stay visible in the editor that owns them, so nothing is
                 lost and nothing becomes uneditable. */}
          <label class="srcrow">
            ${this._boolInput(d.hideDecor, (v) => (this._spaceDialog = { ...d, hideDecor: v }))}
            <span>${this._t('space.hide_decor')}</span>
          </label>
          <div class="rhint">${this._t('space.hide_decor_tip')}</div>
          <label class="srcrow">
            ${this._boolInput(d.hideOpenings, (v) => (this._spaceDialog = { ...d, hideOpenings: v }))}
            <span>${this._t('space.hide_openings')}</span>
          </label>
          <div class="rhint">${this._t('space.hide_openings_tip')}</div>
          <label class="dispsection">${this._t('space.roomcard_section')}</label>
          ${([['labelTemp', 'space.label_temp'], ['labelHum', 'space.label_hum'],
              ['labelLqi', 'space.label_lqi'], ['labelLight', 'space.label_light']] as const).map(
            ([f, k]) => html`<label class="srcrow">
              ${this._boolInput(d[f], (v) => (this._spaceDialog = { ...d, [f]: v }))}
              <span>${this._t(k)}</span>
            </label>`,
          )}
          <label>${this._t('space.card_font')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(d.cardFontScale * 100), (n) => (this._spaceDialog = { ...d, cardFontScale: n / 100 }))}
            <span class="opv">${Math.round(d.cardFontScale * 100)}%</span>
          </div>
          ${this._renderCardPreview(d.cardFontScale, 1, 1)}
          <label>${this._t('space.room_color')}</label>
          <div class="colorrow">
            <input type="color" .value=${d.roomColor}
              @input=${(e: Event) => (this._spaceDialog = { ...d, roomColor: (e.target as HTMLInputElement).value })} />
            <span class="opl">${this._t('space.opacity')}</span>
            ${this._rangeInput(0, 100, 1, Math.round(d.roomOpacity * 100), (n) => (this._spaceDialog = { ...d, roomOpacity: n / 100 }))}
            <span class="opv">${Math.round(d.roomOpacity * 100)}%</span>
          </div>
          <label>${this._t('space.bg_mode')}</label>
          <select class="areasel"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this._spaceDialog = { ...d, bgMode: v === 'static' || v === 'daynight' ? (v as any) : null };
            }}>
            <option value="" ?selected=${d.bgMode === null}>${this._t('space.sun_inherit')}</option>
            <option value="static" ?selected=${d.bgMode === 'static'}>${this._t('gs.bg_static')}</option>
            <option value="daynight" ?selected=${d.bgMode === 'daynight'}>${this._t('gs.bg_daynight')}</option>
          </select>
          ${(d.bgMode ?? bgModeOf(this._settings, {})) === 'static'
            ? html`<label>${this._t('space.bg_color')}</label>
              <div class="colorrow">
                <input type="color" .value=${d.bgColor || stageBgOf(this._settings, { bgColor: null }) || this._stageBgHex()}
                  @input=${(e: Event) => (this._spaceDialog = { ...d, bgColor: (e.target as HTMLInputElement).value })} />
                ${d.bgColor
                  ? html`<button class="btn ghost" @click=${() => (this._spaceDialog = { ...d, bgColor: null })}>
                      ${this._t('space.bg_inherit')}</button>`
                  : html`<span class="opl">${this._t('space.bg_inherited')}</span>`}
              </div>`
            : nothing}
          <label>${this._t('space.north')}</label>
          <div class="colorrow">
            <input class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this._t('space.sun_inherit')}
              .value=${d.northDeg === null ? '' : String(d.northDeg)}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const n = raw === '' ? null : Math.round(Number(raw));
                this._spaceDialog = { ...d, northDeg: n !== null && Number.isFinite(n) ? Math.min(359, Math.max(0, n)) : null };
              }} />
            <span class="opl">${d.northDeg === null
              ? this._t('space.north_inherited', {
                  v: northDegOf(this._settings, {}) === null ? '—' : String(northDegOf(this._settings, {})) + '°',
                })
              : '°'}</span>
          </div>
          <label>${this._t('space.sun_rays')}</label>
          <select class="areasel"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this._spaceDialog = { ...d, sunRays: v === '' ? null : v === '1' };
            }}>
            <option value="" ?selected=${d.sunRays === null}>${this._t('space.sun_inherit')}</option>
            <option value="1" ?selected=${d.sunRays === true}>${this._t('space.sun_on')}</option>
            <option value="0" ?selected=${d.sunRays === false}>${this._t('space.sun_off')}</option>
          </select>
          <label>${this._t('space.fill_label')}</label>
          ${SPACE_FILL_MODES.map((v) => [v, 'fill.' + v] as const).map(
            ([v, k]) => html`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${d.fillMode === v}
                @change=${() => (this._spaceDialog = { ...d, fillMode: v as any })} />
              <span>${this._t(k as any)}</span>
              ${v === 'temp' && d.fillMode === 'temp'
                ? html`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMin)}
                      @input=${(e: Event) => {
                        const n = strictNumber((e.target as HTMLInputElement).value);
                        if (n != null) this._spaceDialog = { ...d, tempMin: n };
                      }} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMax)}
                      @input=${(e: Event) => {
                        const n = strictNumber((e.target as HTMLInputElement).value);
                        if (n != null) this._spaceDialog = { ...d, tempMax: n };
                      }} />
                    °C
                  </span>`
                : nothing}
            </label>`,
          )}
        </div>
        <div class="row" slot="footer">
          ${d.mode === 'edit'
            ? html`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.delete')}
              </button>`
            : nothing}
          <span class="spacer"></span>
          ${this._importTotal > 0 && d.mode === 'create'
            ? html`<button class="btn ghost" @click=${() => this._skipImport()}>${this._t('btn.skip')}</button>`
            : nothing}
          <button class="btn ghost" @click=${close}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!d.title.trim() || (d.source === 'file' && !(d.planFile || d.planUrl)) || d.busy}
            title=${d.source === 'file' && !(d.planFile || d.planUrl) ? this._t('title.need_plan') : ''}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

  private _renderMergeDialog(): TemplateResult {
    const d = this._mergeDialog!;
    const rooms = this._spaceModel().rooms;
    const opt = (id: string, key: 'a' | 'b') => {
      const r = rooms.find((x) => x.id === id);
      const area = r?.area ? this.hass.areas[r.area]?.name : null;
      return html`<label class="srcrow">
        <input type="radio" name="mergekeep" .checked=${d.pick === key}
          @change=${() => (this._mergeDialog = { ...d, pick: key })} />
        <span>${r?.name || ''} <span class="muted">· ${area || this._t('merge.no_area')}</span></span>
      </label>`;
    };
    return html`<hp-dialog .hass=${this.hass} .title=${this._t('merge.header')} icon="mdi:vector-union"
      @hp-close=${() => (this._mergeDialog = null)}>
        <div class="body">
          <p class="muted">${this._t('merge.hint')}</p>
          <label>${this._t('merge.keep')}</label>
          ${opt(d.aId, 'a')}
          ${opt(d.bId, 'b')}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._mergeDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._commitMerge}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }

  /** Live sample of a room card at the given multipliers (dialog preview). */
  private _renderCardPreview(spaceScale: number, nameScale: number, labelScale: number): TemplateResult {
    const base = 18 * spaceScale;
    return html`<div class="cardpreview">
      <span class="cpname" style="font-size:${(base * nameScale).toFixed(1)}px">
        ${this._t('preview.room_name')}</span>
      <span class="cpmeta" style="font-size:${(base * 0.62 * labelScale).toFixed(1)}px">
        <ha-icon icon="mdi:thermometer"></ha-icon>22.4° ·
        <ha-icon icon="mdi:water-percent"></ha-icon>45% ·
        <ha-icon icon="mdi:lightbulb-on"></ha-icon>${this._t('roomcard.light_partial', { on: 1, total: 3 })}
      </span>
    </div>`;
  }

  /** One measurement-source control (average vs an explicit device/entity). */
  private _renderRoomSource(kind: 'temp' | 'hum'): TemplateResult {
    const val = kind === 'temp' ? this._roomTempSrc : this._roomHumSrc;
    const setVal = (v: string) => {
      if (kind === 'temp') this._roomTempSrc = v;
      else this._roomHumSrc = v;
      this.requestUpdate();
    };
    const open = this._roomSrcOpen === kind;
    return html`
      <label>${this._t(kind === 'temp' ? 'room.temp_src_label' : 'room.hum_src_label')}</label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${kind}" .checked=${!val}
          @change=${() => { setVal(''); this._roomSrcOpen = null; }} />
        <span>${this._t('room.src_average')}</span>
      </label>
      <label class="srcrow">
        <input type="radio" name="rsrc-${kind}" .checked=${!!val}
          @change=${() => { this._roomSrcOpen = kind; this._roomSrcFilter = ''; this.requestUpdate(); }} />
        <span>${this._t('room.src_pick')}</span>
      </label>
      ${val || open
        ? html`<button class="dropbtn ${open ? 'open' : ''}"
              @click=${() => { this._roomSrcOpen = open ? null : kind; this._roomSrcFilter = ''; }}>
              ${val
                ? html`<b>${this._roomSrcLabel(val)}</b><span class="ref">${val}</span>`
                : html`<span class="muted">${this._t('room.src_ph')}</span>`}
              <ha-icon icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
            </button>
            ${open
              ? html`<div class="droppanel">
                  <input class="namein" type="text" placeholder=${this._t('marker.search_ph')}
                    .value=${this._roomSrcFilter}
                    @input=${(e: Event) => { this._roomSrcFilter = (e.target as HTMLInputElement).value; this.requestUpdate(); }} />
                  <div class="candlist">
                    ${this._roomSrcCandidates().map(
                      (c) => html`<div class="cand ${c.value === val ? 'sel' : ''}"
                        @click=${() => { setVal(c.value); this._roomSrcOpen = null; }}>
                        <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                      </div>`,
                    )}
                  </div>
                </div>`
              : nothing}`
        : nothing}`;
  }

  private _renderRoomDialog(): TemplateResult {
    const edit = !!this._roomEditId;
    const canSaveNew = !!this._areaSel || !!this._nameSel.trim();
    // the free-areas list must include the edited room's CURRENT area
    const areas = [...this._freeAreas];
    if (edit && this._areaSel && !areas.some((a) => a.area_id === this._areaSel)) {
      const cur = this.hass.areas[this._areaSel];
      if (cur) areas.unshift(cur);
    }
    return html`<hp-dialog class="roomdialog" .hass=${this.hass} wide
      .title=${edit ? this._t('room.settings_title') : this._t('room.new')}
      icon=${edit ? 'mdi:cog-outline' : 'mdi:floor-plan'} @hp-close=${this._roomDialogCancel}>
        <div class="body">
          <label>${this._t('room.name_label')}</label>
          <input class="namein" type="text" placeholder=${this._t('room.name_ph')}
            .value=${this._nameSel}
            @input=${(e: Event) => (this._nameSel = (e.target as HTMLInputElement).value)} />
          <label>${this._t('room.area_label')}</label>
          <select class="areasel"
            @change=${(e: Event) => {
              this._areaSel = (e.target as HTMLSelectElement).value;
              if (!this._nameSel && this._areaSel)
                this._nameSel = this.hass.areas[this._areaSel]?.name || '';
              this.requestUpdate();
            }}>
            <option value="">${this._t('room.no_area_option')}</option>
            ${areas.map(
              (a) => html`<option value=${a.area_id} ?selected=${a.area_id === this._areaSel}>${a.name}</option>`,
            )}
          </select>

          <label class="dispsection">${this._t('room.settings_section')}</label>
          <label>${this._t('room.fill_label')}</label>
          ${([['', 'fill.inherit'], ...ROOM_FILL_MODES.map((v) => [v, 'fill.' + v])] as const).map(
            ([v, k]) => html`<label class="srcrow inline">
              <input type="radio" name="rfill" .checked=${this._roomFill === v}
                @change=${() => { this._roomFill = v as any; this.requestUpdate(); }} />
              <span>${this._t(k as any)}</span>
            </label>`,
          )}
          ${this._renderRoomSource('temp')}
          ${this._renderRoomSource('hum')}

          <label class="dispsection">${this._t('room.sizes_section')}</label>
          <label>${this._t('room.name_scale')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(this._roomNameScale * 100), (n) => { this._roomNameScale = n / 100; this.requestUpdate(); })}
            <span class="opv">${Math.round(this._roomNameScale * 100)}%</span>
          </div>
          <label>${this._t('room.label_scale')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(this._roomLabelScale * 100), (n) => { this._roomLabelScale = n / 100; this.requestUpdate(); })}
            <span class="opv">${Math.round(this._roomLabelScale * 100)}%</span>
          </div>
          ${this._renderCardPreview(
            spaceDisplayOf(this._curSpaceCfg).cardFontScale,
            this._roomNameScale,
            this._roomLabelScale,
          )}
        </div>
        <div class="row roomfooter" slot="footer">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this._t('btn.cancel')}</button>
          <span class="spacer"></span>
          ${edit
            ? html`<button class="btn on" @click=${() => this._saveRoomEdit()} ?disabled=${!this._nameSel.trim()}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
              </button>`
            : html`${!this._pendingSplit ? html`<button class="btn ghost" @click=${this._keepClosedAsPartitions}>
                <ha-icon icon="mdi:wall"></ha-icon>${this._t('btn.keep_as_walls')}
              </button>` : nothing}
              <button class="btn on room-save" @click=${this._saveRoom} ?disabled=${!canSaveNew}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
              </button>`}
        </div>
    </hp-dialog>`;
  }

  static styles = cardStyles;
}

if (!customElements.get('houseplan-card')) {
  customElements.define('houseplan-card', HouseplanCard);
}

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.find((c: any) => c.type === 'houseplan-card')) {
  (window as any).customCards.push({
    type: 'houseplan-card',
    name: 'House Plan Card',
    description: 'Interactive house plan: spaces, rooms and devices with live states and drag layout.',
  });
}

// eslint-disable-next-line no-console
console.info(`%c HOUSEPLAN-CARD %c v${CARD_VERSION} `, 'background:#3ea6ff;color:#04121f;font-weight:700', '');
