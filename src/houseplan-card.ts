/**
 * House Plan Card — an interactive house plan as a native Lovelace card.
 * Configuration sources:
 *  1) SERVER (the houseplan integration, WS houseplan/config/get) — spaces, plans,
 *     rooms, device overrides, virtual devices. Coordinates are NORMALIZED (0..1).
 *  2) LEGACY fallback — baked-in country-house data (src/data/*), coordinates in a 1489×1053 canvas.
 * The icon layout is stored on the server (houseplan/layout/*), fallback — localStorage.
 */
import { LitElement, html, svg, nothing, TemplateResult, PropertyValues } from 'lit';
import {
  EXCLUDED_DOMAINS, DEFAULT_ICON_RULES, compileIconRules, isValidPattern, iconFor,
  type IconRule, type CompiledIconRule,
} from './rules';
import {
  lqiColor, snapToGrid, samePoint, pointInPolygon, markerIdForBinding,
  segmentCm, formatLength, roomEdges, roomPoly, paperRoomShapes, pointStrictlyInside, roomsOverlap,
  pointOnBoundary, mergeRooms, splitRoomPath, polygonArea, closestPointOnBoundary, pointStrictlyInside as ptInside, islandsOf, sharedBoundary, openZoneOf, distToSegment, outlineWithout, cutSegments, alignGuides, segmentAngle, is45, type AlignGuide, swipeTarget, clampScale, migratePdfUrls, roomFillModeOf, contentUrl,
  snapToWall, snapPointAlongPoly, openingAmount, openingShoulders, interiorPoint,
  poleOfInaccessibility, subst,
  averageLqi, fitView, declump, safeUrl, resolveTapAction, floorsOf, type FloorInfo,
  stateIcon, lightColorOf, isAlarmState, parseRoomRef, diffNewDevices, glowColorOf, doorSector, hasRoomBehind, controlsAction, isControllable,
  spaceDisplayOf, roomFillStyle, fillColorsOf, DEFAULT_FILL_COLORS, type FillColors, runServiceFor, RUN_TARGET_DOMAINS,
  isActiveState, DEFAULT_ROOM_COLOR, DEFAULT_ROOM_OPACITY, stageBgOf,
  DEFAULT_TEMP_MIN, DEFAULT_TEMP_MAX, type SpaceDisplay,
  referencedContentUrls,
  DISPLAY_MODES, TAP_ACTIONS, SPACE_FILL_MODES, ROOM_FILL_MODES,
  coverService, coverMoving, coverEntityOf, COVER_GUARDED_CLASSES,
} from './logic';
import {
  planEdgeDrag, applyEdgeDrag, clampEdgeDrag, applyRoomScale, clampRoomScale,
  simplifyPoly, areaM2, formatArea, MIN_ROOM_CM, type EdgeDragPlan,
} from './resize';
import {
  computeSunRays, dayPhase, northDegOf, bgModeOf, sunRaysOn, weatherEntityOf,
  sunStateOf, cloudFactor, rayPeakAlpha, raysVisible, rayColor, RAY_FADE_MS, type SunRay,
  rayStops, skyElevation, skyNeedsSnap,
} from './sun';
import { ContentSigner } from './signing';
import { mdiHomeCityOutline } from '@mdi/js';
import {
  Affine, applyAffine, solveAffine, affineResidual, readVacTelemetry, isVacSourceState,
  autoCalibrate, pushTrailPoint, isVacMoving, vacTrailMode, vacMapIdWithFallback, VAC_TELEPORT_GAP_MS, VAC_STALE_MS,
  FitParams, fitMatrix, fitFromMatrix, initialFit, reanchorFit, VacRoom,
  VAC_TRAIL_LINGER_MS, Pt as VacPt,
} from './vacuum';
import { buildDevices, seedHiddenBindings, lqiFor, tempFor, humFor, climateTempFor, isHumEntity, areaLights, areaTemp, areaHum, areaLightStats, sourceValue, areaClimateMap, litLightEntity, type AreaClimate } from './devices';
import type {
  OpeningCfg,
  RoomCfg, SpaceModel, PdfRef, Marker, ServerConfig, DevItem, CardConfig,
} from './types';
import './editor';
import './space-card';
import { cardStyles } from './styles';
import {
  fitInSquare, planRect, contentBounds, spaceModels, contentFrame, contentItems, spaceFrame,
  spaceCenter, iconUnit, iconCqw, gridLevels, itemOf, snapPt,
  MIN_ZOOM, PAN_SLACK, CANVAS_LIMIT, GRID_N, GRID_PITCH, GRID_STEP_N,
  PLAN_SCALE_MIN, PLAN_SCALE_MAX,
  clampCanvasR, clampCanvasN, type ContentItem, type Rect,
} from './space-geometry';
import { alignAllToGrid, type AlignReport } from './align-grid';
import { langOf, t, type I18nKey } from './i18n';

const CARD_VERSION = '1.58.0-beta.1';
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
const warmBoot = new Map<string, { hdrH: number; stageH: number }>();
const warmBootKey = (config: unknown): string =>
  `${window.innerWidth}x${window.innerHeight}|${JSON.stringify(config ?? {})}`;
const LS_KEY = 'houseplan_card_layout_v1';
const LS_CFG = 'houseplan_card_cfg_v1'; // cache of the server config+layout for instant rendering
const LS_ZOOM = 'houseplan_card_zoom_v1';
const LS_NAV = 'houseplan_card_nav_v1'; // last space + editor mode (owner: restore where you were)
const LS_KIOSK = 'houseplan_card_kiosk_v1'; // per-SCREEN size multipliers (each wall tablet differs)
const NORM_W = 1000; // side of the render space — the canvas is square (v1.48.0)
/** motion flash window: 3 beats of the hp-sense ring (3 × 1.1s in styles.ts).
    Owner's rule (2026-08-01): «движение = разовая вспышка в момент
    обнаружения; cool-down не пульсирует». */
const SENSE_FLASH_MS = 3300;

/** Smallest rectangle holding both (docs/CANVAS.md §4). */
const unionRect = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

type MarkupTool = 'draw' | 'merge' | 'split' | 'resize' | 'opening' | 'openwall' | 'delroom';

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
  private _loading = false;
  private _loadTries = 0;
  private _serverCfg: ServerConfig | null = null;
  private _cfgRev = 0;
  private _unsubCfg: (() => void) | null = null;
  private _unsubLayout: (() => void) | null = null;
  private _layoutRev = 0;
  private _devices: DevItem[] = [];
  private _regSignature = '';
  private _defPos: Record<string, { x: number; y: number }> = {};
  private _newSyncKey = '';
  private _tip: { x: number; y: number; title: string; meta: string; lqi?: number | null; temp?: number | null } | null = null;
  private _selId: string | null = null;
  private _toast = '';
  private _toastTimer?: number;

  // --- room markup editor ---
  /** Interaction mode (docs/UX-MODES.md): view = display only, plan = geometry
   * editing, devices = marker placement/config. Never persisted — every load
   * starts in view. */
  private _mode: 'view' | 'plan' | 'devices' | 'decor' = 'view';
  // ---- decor (background) editor ----
  private _decorTool: 'select' | 'backdrop' | 'line' | 'rect' | 'ellipse' | 'text' | 'erase' = 'select';
  private _decorStyle: { color: string; width: number; fill: boolean } = { color: '#607d8b', width: 3, fill: false };
  private _decorDraft: { kind: 'line' | 'rect' | 'ellipse'; a: number[]; b: number[]; pid: number } | null = null;
  private _decorMove: { id: string; start: number[]; orig: any; pid: number; moved: boolean } | null = null;
  private _decorSel: string | null = null;
  private _decorTextDialog: { id?: string; x: number; y: number; text: string; size: 's' | 'm' | 'l'; color: string } | null = null;
  /**
   * The live backdrop gesture (docs/BACKDROP.md §2): moving the picture by its
   * body, or scaling it UNIFORMLY by a corner handle about the opposite corner.
   * `base` is the untransformed, centred rectangle the transform is measured
   * from, so a gesture never accumulates rounding of its own.
   */
  private _bdDrag: {
    kind: 'move' | 'scale';
    pid: number;
    /** pointer down, render units */
    sx: number; sy: number;
    /** the centred default rect (render units) — the transform's origin */
    base: Rect;
    /** transform at pointer down */
    p0: { dx: number; dy: number; k: number };
    /** the corner that STAYS PUT while scaling (render units) */
    fx: number; fy: number;
    /** which way the dragged corner points from the fixed one (±1) */
    sgx: number; sgy: number;
    moved: boolean;
  } | null = null;

  /** Edit tabs are offered to admins only (hass.user missing → assume admin). */
  private get _canEdit(): boolean {
    return this._norm && this.hass?.user?.is_admin !== false;
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
  /**
   * Which way the plan should fly out when the space changes. Empty means no
   * animation — a direct pick from the tabs should not slide anywhere.
   */
  private _slide: '' | 'left' | 'right' = '';
  private _slideTimer?: number;

  /** Change the space with the usual sideways transition. */
  private _slideTo(id: string, dir: 'left' | 'right'): void {
    if (id === this._space) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    this._space = id;
    this._selId = null;
    this._restoreZoom();
    if (reduce) return;
    this._slide = dir;
    clearTimeout(this._slideTimer);
    // long enough to be read as motion, short enough not to be in the way
    this._slideTimer = window.setTimeout(() => { this._slide = ''; this.requestUpdate(); }, 260);
    this.requestUpdate();
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
  // room resize tool (docs/RESIZE.md): selection, live drag, its own undo stack
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
  private _rszUndo: { space: string; snap: string }[] = [];
  /** HP-1550-01: the live resize preview, kept OUT of _serverCfg (see _rszApplyPreview). */
  private _rszPreview: { space: string; sp: any } | null = null;
  private _rszLive: { x: number; y: number; text: string; area?: boolean }[] | null = null;
  private _path: number[][] = []; // current outline (render units, vertices snapped to the grid)
  private _cursorPt: number[] | null = null;
  private _mergeSel: string | null = null;
  private _openingDialog: {
    id?: string;                 // editing an existing opening
    type: 'door' | 'window';
    lengthCm: number;
    contact: string;
    lock: string;
    invert: boolean;
    flipH: boolean;
    flipV: boolean;
    x: number; y: number; angle: number; // render units (from the wall snap)
  } | null = null;
  private _openingInfo: OpeningCfg | null = null;
  private _opDrag: { id: string; moved: boolean; sx: number; sy: number; dirty: boolean } | null = null;
  // live ruler badges + the "centered on the wall" tick while an opening is dragged
  private _opMeasure: OpMeasure | null = null;
  /** Shift during the PLACEMENT hover: opts out of the centre magnet, exactly
   *  as it does while dragging an existing opening. */
  private _opShift = false;
  private _mergeDialog: { aId: string; bId: string; poly: number[][]; pick: 'a' | 'b' } | null = null;
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
  /** «Выровнять всё по сетке»: the preview the confirmation shows, plus the
   *  already-computed result so the write cannot differ from the promise. */
  private _alignDialog: {
    report: AlignReport; spaces: any[]; layout: Record<string, any>;
    cm: number; busy: boolean;
  } | null = null;

  private _settingsDialog: {
    colors: FillColors; glowRadius: number; bgColor: string | null;
    /** sun on the plan (docs/SUN.md) */
    northDeg: number | null; bgMode: 'static' | 'daynight'; sunRays: boolean; weatherEntity: string;
    busy: boolean;
  } | null = null;
  /** Wedge memo: recomputed only when (azimuth, elevation, north, cfg rev) change (docs/SUN.md). */
  private _sunRaysCache: { key: string; rays: SunRay[] } | null = null;
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
    display: 'badge' | 'ripple' | 'icon_ripple' | 'value';
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
  private _hashApplied = false;
  private _navApplied = false; // the saved space was restored (or the user navigated)
  // ---- kiosk (wall device) mode ----
  private _kioskScale: { icon: number; font: number } = { icon: 1, font: 1 };
  private _kioskDialog = false;
  /** motion-sensor runtime per marker: the last seen primary state and the
      ts of the last off→on trip. Owner's rule (2026-08-01): «движение =
      разовая вспышка в момент обнаружения; cool-down не пульсирует» —
      the flash is keyed to the TRANSITION, not to the 'on' state. `timer`
      is the one setTimeout per entry that repaints the card when the flash
      window closes (cleared in disconnectedCallback). */
  private _senseRt = new Map<string, { last: string; flashTs: number; timer: number; gen: number }>();
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
    if (document.visibilityState === 'visible') {
      this._vacJumpOnce = true;
      // A hidden tab paints nothing, so the 45 s sky transition stood still
      // while the sun kept moving: come back on the RIGHT colour, then breathe
      // again (docs/SUN.md, owner 2026-08-04).
      this._skyElev = null;
      this.requestUpdate();
    }
  };
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
      this._space = id;
      this._selId = null;
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
    _selId: { state: true },
    _toast: { state: true },
    _serverCfg: { state: true },
    _mode: { state: true },
    _tool: { state: true },
    _rszSel: { state: true },
    _rszLive: { state: true },
    _opMeasure: { state: true },
    _path: { state: true },
    _cursorPt: { state: true },
    _mergeSel: { state: true },
    _openingDialog: { state: true },
    _openingInfo: { state: true },
    _mergeDialog: { state: true },
    _splitSel: { state: true },
    _decorTool: { state: true },
    _decorStyle: { state: true },
    _decorDraft: { state: true },
    _decorSel: { state: true },
    _decorTextDialog: { state: true },
    _bdDrag: { state: true },
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
  }

  public disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this._vacVisHandler);
    if (this._vacRaf) { cancelAnimationFrame(this._vacRaf); this._vacRaf = 0; }
    if (this._skySnapRaf) { cancelAnimationFrame(this._skySnapRaf); this._skySnapRaf = 0; }
    for (const rt of this._senseRt.values()) clearTimeout(rt.timer); // pending flash-window repaints
    window.removeEventListener('keydown', this._keyHandler);
    clearInterval(this._cycleTimer);
    clearTimeout(this._kioskDotsTimer);
    clearTimeout(this._kioskHoldTimer);
    clearTimeout(this._reloadRetry);
    clearTimeout(this._loadRetryTimer);
    this._loadRetryTimer = undefined; // a cleared id must not block a reschedule
    this._connHooked?.removeEventListener?.('ready', this._onConnReady);
    this._connHooked = null;
    this._signer.dispose();
    clearTimeout(this._toastTimer);
    clearTimeout(this._slideTimer);
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
      if (this._openingInfo) { this._openingInfo = null; return; }
      if (this._infoCard) { this._infoCard = null; return; }
      if (this._rulesDialog) { this._rulesDialog = null; return; }
      if (this._alignDialog) { this._alignDialog = null; return; }
      if (this._settingsDialog) { this._settingsDialog = null; return; }
      if (this._markerDialog) { this._markerDialog = null; return; }
      if (this._openingDialog) { this._openingDialog = null; return; }
      if (this._decorTextDialog) { this._decorTextDialog = null; return; }
      if (this._spaceDialog && !this._roomDialog) {
        // same semantics as the dialog's Cancel: an import queue is abandoned
        this._spaceDialog = null;
        this._importQueue = [];
        this._importTotal = 0;
        return;
      }
    }
    if (this._mode === 'decor') {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this._decorSel &&
          !(e.target as HTMLElement)?.closest?.('input, textarea, select')) {
        e.preventDefault();
        this._decorDeleteSel();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this._decorDraft) this._decorDraft = null;
        else if (this._decorSel) this._decorSel = null;
        else if (this._decorTool !== 'select') this._decorTool = 'select';
        else this._setMode('view');
      }
      return;
    }
    if (!this._markup) return;
    const undo = e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z');
    if (!undo) return;
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
    if (!undo) return;
    if (this._tool === 'resize') {
      e.preventDefault();
      if (this._rszDrag) {
        // Esc (or Ctrl+Z) mid-drag: the original geometry comes back
        this._rszCancelDrag();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        this._rszUndoPop();
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
    if (this._tool === 'openwall' || this._tool === 'opening' || this._tool === 'delroom') {
      e.preventDefault();
      this._tool = 'draw';
    }
  }

  /** Remove the last placed point. An unfinished outline is never persisted. */
  private _undoPoint(): void {
    if (!this._path.length) return;
    this._path = this._path.slice(0, -1);
  }

  public static getConfigElement() {
    return document.createElement('houseplan-card-editor');
  }

  public static getStubConfig(): Partial<CardConfig> {
    return { type: 'custom:houseplan-card' };
  }

  /** Test hook (smokes): forget the warm re-mount memo — a cold page again. */
  public static _warmBootReset(): void {
    warmBoot.clear();
  }

  public setConfig(config: CardConfig): void {
    this._config = { icon_size: 2.5, show_temperature: true, live_states: true, show_signal: true, ...config };
    if (this._config.kiosk) { this._booting = false; this._bootFading = false; } // kiosk: 100dvh, nothing to settle
    else {
      // DEV-B703-01: this page already booted an identical card at this
      // viewport — adopt its settled header height and skip the veil
      // entirely: the card reveals synchronously in the final geometry (the
      // saved zoom is armed below, HP-1551). _bootSoft covers any residual
      // chrome drift with a glide instead of a snap.
      const warm = warmBoot.get(warmBootKey(this._config));
      if (warm) {
        this._booting = false;
        this._bootFading = false;
        this._hdrH = warm.hdrH;
        this._bootSoft = true; // timer armed in connectedCallback...
        if (this.isConnected) { // ...unless setConfig re-runs while attached
          clearTimeout(this._bootSoftTimer);
          this._bootSoftTimer = window.setTimeout(() => { this._bootSoft = false; }, BOOT_SOFT_MS);
        }
      }
    }
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
        // kiosk screens always stay in View
        if (nav?.mode && nav.mode !== 'view' && this._canEdit && !config.kiosk) this._mode = nav.mode;
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
    if (changed?.has?.('hass')) { this._vacTick(); this._senseTick(); }
    this._skyPlan();
    if (changed.has('hass') && this.hass) {
      this._hookConnection();
      if (!this._loadOk && !this._loading && this._loadTries < 8) {
        this._loadFromServer();
      }
      this._maybeRebuildDevices();
    }
  }

  protected updated(): void {
    this._skyRelease();
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
        if (t >= 0 && Math.abs(t - this._hdrH) > 1) this._hdrH = t;
        // DEV-B703-01: chrome that lands after the settle (or a window
        // resize with a live card) must not poison the next warm mount —
        // the memo follows the live settled geometry.
        if (t >= 0 && !this._booting && !this._config?.kiosk && stage.clientHeight > 0) {
          warmBoot.set(warmBootKey(this._config), { hdrH: t, stageH: stage.clientHeight });
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
      const cfg = cfgResp?.config;
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
          if ((ev?.data?.rev ?? -1) !== this._cfgRev) this._reloadConfigOnly();
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
      this._restoreZoom();
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
    this.requestUpdate();
  }

  /**
   * Adopt the server config. Any pending local write is flushed first and, if a
   * write is still in flight, the reload is deferred — adopting a revision on
   * top of an unsent edit is exactly how edits disappeared (audit L2).
   * `force` skips the deferral (conflict path: the local edit already lost).
   */
  private async _reloadConfigOnly(force = false): Promise<void> {
    if (!force) {
      if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.flush();
      if (this._cfgWriting) {
        // retry once the in-flight write settles
        clearTimeout(this._reloadRetry);
        this._reloadRetry = window.setTimeout(() => this._reloadConfigOnly(), 400);
        return;
      }
    }
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/config/get' });
      const cfg = resp?.config;
      this._serverCfg = cfg && Array.isArray(cfg.spaces) ? cfg : null;
      this._cfgEpoch++;
      this._cfgRev = resp?.rev || 0;
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
  private _onConnReady = (): void => {
    this._loadTries = 0;
    clearTimeout(this._loadRetryTimer);
    this._loadRetryTimer = undefined;
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
    const sig =
      Object.keys(h.devices).length + ':' + Object.keys(h.entities).length + ':' +
      Object.keys(h.areas).length + ':' + (this._norm ? 'n' : 'l') + ':' + langOf(h, this._config?.language);
    if (sig === this._regSignature && this._devices.length) return;
    this._regSignature = sig;
    this._devices = buildDevices({
      hass: h,
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
    this._defPos = this._defaultPositions();
    this._syncNewDevices();
    this._seedHiddenDevices();
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

  private _savePos(d: DevItem, x: number, y: number, shift = false): void {
    if (this._norm) {
      // The icon center snaps to the nodes of the same grid as the room markup
      // (docs/CANVAS.md §9). Shift suspends the snap for this one gesture —
      // the same convention as the opening magnet and the compass.
      const g = this._gridPitch;
      const gx = shift ? x : Math.round(x / g) * g;
      const gy = shift ? y : Math.round(y / g) * g;

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

  private _stateClass(d: DevItem): string {
    if (!this._config?.live_states) return '';
    // FIRST of all: is this marker a CURTAIN? Choosing «Открыть/закрыть» in
    // the dialog is the strongest thing its owner can say about what the
    // marker IS (see _coverIndicator), so it outranks every other source of
    // indication — and the owner's contract for that answer is absolute: «у
    // штор не должно быть жёлтой подложки НИКОГДА». Deciding this after
    // `controls` / a lit light (as it was until 2026-08-04) meant a curtain on
    // a mixed device — a lamp that also ships a blind, a marker with a bound
    // wall switch — went yellow anyway and lost its breathing ring while it
    // travelled, so the tap, the icon and the plate each told a different
    // story. The plate class of a cover is only ever '' , 'covermove' or
    // 'unavail'; the open/closed state is the icon's job (COVER_ICONS).
    const cov = this._coverIndicator(d);
    if (cov) {
      const cs = this.hass.states[cov];
      if (!cs) return '';
      if (cs.state === 'unavailable') return 'unavail';
      return coverMoving(cs.state) ? 'covermove' : '';
    }
    // an icon with controlled targets mirrors THEM, not its own entity
    // (stateless remotes and virtual wall switches have nothing else to show)
    const controls = (d.marker?.controls || []).filter(isControllable);
    if (controls.length)
      return controls.some((e) => this.hass.states[e]?.state === 'on') ? 'on' : '';
    // A shining light yields 'on' here by the SAME condition that lights the
    // glow pool, so the pool and the state cannot disagree. Note the renderer
    // then STRIPS the class wherever the glow layer is actually visible —
    // there the spot is the one indicator (v1.52.0, owner's rule); the badge
    // stays yellow only where the spot is not drawn (other fills, the plan
    // editor).
    if (litLightEntity(this.hass, d)) return 'on';
    // The explicit cover was answered above; what is left here is the primary
    // entity — an «Open/close» marker only ever reaches this line when its
    // device carries no `cover.*` at all, and then it has nothing else to
    // speak for. (Before 2026-08-04 an Aqara curtain driver reported its
    // `switch.*_reverse_direction` from here: no breathing ring while it
    // travelled, no morph, and a yellow plate whenever the reverse-direction
    // option happened to be on.)
    const eid = this._actEntity(d);
    const p = eid ? this.hass.states[eid] : undefined;
    if (!p) return '';
    if (p.state === 'unavailable') return 'unavail';
    // derive the domain from the entity id we looked the state up by — state
    // objects are not guaranteed to carry entity_id (defensive; found by the
    // TESTING.md edge-case run)
    const dom = eid!.split('.')[0];
    if (['light', 'switch', 'fan', 'humidifier'].includes(dom)) return p.state === 'on' ? 'on' : '';
    if (dom === 'climate') {
      // yellow = actually working right now ("which radiators are heating"),
      // not "enabled for the winter": hvac_action when the integration
      // reports one, the coarser state only as a fallback
      const act = p.attributes?.hvac_action;
      if (act != null) return ['heating', 'cooling', 'drying', 'fan'].includes(act) ? 'on' : '';
      return ['off', 'unknown'].includes(p.state) ? '' : 'on';
    }
    // COVERS (owner's contract 2026-08-04): «у штор не должно быть жёлтой
    // подложки НИКОГДА, индикация открыто/закрыто за счёт морфинга иконки».
    // So a cover returns NO plate class in any state — not the yellow «on»
    // one, not the orange 'open' frame it used to wear while open/opening.
    // Its whole open/closed story is told by the icon (stateIcon/COVER_ICONS,
    // ajar counts as open because HA reports 'open' for it), and its motion by
    // the breathing ring alone (2026-08-03, the vacuum puck's language).
    if (dom === 'cover') return coverMoving(p.state) ? 'covermove' : '';
    // A VALVE is deliberately NOT swept along: no icon pair morphs for it, so
    // the frame is the only thing that says «открыт» — taking it away would
    // leave the marker mute. Owner's rule names the curtains, and the two
    // domains part ways here.
    if (dom === 'valve') return ['open', 'opening'].includes(p.state) ? 'open' : '';
    if (dom === 'lock') return ['unlocked', 'open'].includes(p.state) ? 'open' : '';
    if (dom === 'binary_sensor') {
      const dc = p.attributes?.device_class;
      if (['door', 'window', 'garage_door', 'opening', 'gas', 'smoke', 'moisture', 'problem'].includes(dc))
        return p.state === 'on' ? 'open' : '';
      // Owner's rule (2026-08-01, вариант «б»): «движение = разовая
      // вспышка в момент обнаружения; cool-down не пульсирует; присутствие =
      // статичное кольцо пока обитаемо». Neither takes the yellow 'on'
      // fill — that stays reserved for «включено».
      // MOTION flashes once per off→on trip: 'senseflash' lives only for
      // the ~3.3s window after the transition (stamped by _senseTick on
      // the hass tick) — a sensor still 'on' after that is in its
      // cool-down, not seeing motion, so the class goes away even though
      // the state has not changed. A new off→on trip re-arms the flash.
      if (dc === 'motion') {
        const rt = this._senseRt.get(d.id);
        if (!(rt && rt.flashTs && Date.now() - rt.flashTs < SENSE_FLASH_MS)) return '';
        // HP-1543-02: alternate the animation identity per trip (see
        // _senseTick) — odd generations ride the base hp-sense keyframes,
        // even ones the identical hp-sense-b twin, so a rapid re-trip
        // restarts the flash instead of silently inheriting the old timeline
        return rt.gen % 2 === 0 ? 'senseflash sf2' : 'senseflash';
      }
      // OCCUPANCY/PRESENCE while 'on': a calm STATIC ring ('sensehold',
      // no animation in styles.ts) — «комната обитаема» is a state, not
      // an event, so it must not blink.
      if (['occupancy', 'presence'].includes(dc))
        return p.state === 'on' ? 'sensehold' : '';
    }
    if (dom === 'media_player') return ['playing', 'on'].includes(p.state) ? 'on' : '';
    if (dom === 'vacuum') return ['cleaning', 'returning'].includes(p.state) ? 'on' : '';
    return '';
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

  /** Does the dialog's binding carry a climate entity? Gates the opt-in checkbox. */
  private _bindingHasClimate(binding: string): boolean {
    if (binding.startsWith('entity:')) return binding.slice(7).startsWith('climate.');
    if (binding.startsWith('device:')) {
      const ref = binding.slice(7);
      for (const [eid, reg] of Object.entries<any>(this.hass?.entities || {})) {
        if (reg?.device_id === ref && eid.startsWith('climate.')) return true;
      }
    }
    return false;
  }

  /** The cover entity behind the dialog's binding, or null. */
  private _bindingCoverEntity(binding: string): string | null {
    if (binding.startsWith('entity:')) return coverEntityOf([binding.slice(7)]);
    if (binding.startsWith('device:')) {
      const ref = binding.slice(7);
      const eids = Object.entries<any>(this.hass?.entities || {})
        .filter(([, reg]) => reg?.device_id === ref)
        .map(([eid]) => eid);
      return coverEntityOf(eids);
    }
    return null;
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

  private _openMoreInfo(entityId?: string): void {
    if (!entityId) {
      this._showToast(this._t('toast.no_entity'));
      return;
    }
    fireEvent(this, 'hass-more-info', { entityId });
  }

  /** Right click in VIEW mode always opens HA's more-info (owner's decision). */
  private _ctxDevice(ev: MouseEvent, d: DevItem): void {
    if (this._mode !== 'view') return; // editors keep the native context menu
    ev.preventDefault();
    ev.stopPropagation();
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
    const controls = (d.marker?.controls || []).filter(isControllable);
    if (d.tapAction === 'toggle' && controls.length) {
      const act = controlsAction(controls.map((e) => this.hass.states[e]?.state));
      guarded(this._t('confirm.tap_toggle', { name: d.name }), () => {
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
        this.hass
          .callService(svc.domain, svc.service, { entity_id: target })
          .then(() => this._showToast(this._t('toast.run_started', { name })))
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    if (action === 'cover' && coverEid) {
      // open / close / stop, decided by the CURRENT state (docs/PRODUCT.md);
      // a tap while the curtain travels stops it, the next one reverses
      const svc = coverService(this.hass.states[coverEid]?.state);
      guarded(this._t('confirm.tap_cover', { name: d.name }), () => {
        this.hass
          .callService('cover', svc, { entity_id: coverEid })
          .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      });
      return;
    }
    if (action === 'toggle' && d.primary) {
      guarded(this._t('confirm.tap_toggle', { name: d.name }), () => {
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
          : [[x.x * NORM_W, x.y * H], [(x.x + (x.w || 0)) * NORM_W, (x.y + (x.h || 0)) * H]];
        const it = itemOf(pts);
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
      warmBoot.set(warmBootKey(this._config), { hdrH: this._hdrH, stageH: settledH });
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

  /** Recompute the view for a new scene size, preserving zoom and center. */
  private _refitView(): void {
    if (!this._stageEl) return;
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
    if (this._bdDrag?.pid === ev.pointerId) {
      this._bdMove(ev);
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      this._decorDraft = { ...this._decorDraft, b: this._snap(this._svgPoint(ev), ev) };
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
    if (this._bdDrag?.pid === ev.pointerId) {
      this._bdUp();
      return;
    }
    if (this._decorDraft?.pid === ev.pointerId) {
      this._decorCommitDraft();
      return;
    }
    if (this._decorMove?.pid === ev.pointerId) {
      if (this._decorMove.moved) this._saveConfig();
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
    this._savePos(d, nx, ny, ev.shiftKey);
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
    this._bootSoftCancel(); // editor bars change the stage height DELIBERATELY — snap, no glide
    if ((mode === 'plan' || mode === 'decor') && !this._norm) {
      this._showToast(this._t('toast.markup_needs_server'));
      return;
    }
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
    this._mode = mode;
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
    this._tool = 'draw';
    this._mergeSel = null;
    this._mergeDialog = null;
    this._splitSel = null;
    this._pendingSplit = null;
    this._selId = null;
    this._rszSel = null;
    this._rszDrag = null;
    this._rszLive = null;
    this._rszPreview = null;
    this._rszUndo = [];
    this._tip = null;
    this._decorDraft = null;
    this._decorSel = null;
    this._decorTool = 'select';
    this._bdDrag = null;
    this._saveNav();
  }


  private _svgPoint(ev: MouseEvent): number[] {
    const stage = this.renderRoot.querySelector('.stage') as HTMLElement;
    const r = stage.getBoundingClientRect();
    return this._screenToVb(ev.clientX - r.left, ev.clientY - r.top);
  }

  /**
   * THE snap (docs/CANVAS.md §9). Every editor gesture that produces a plan
   * coordinate goes through here, so "strictly on the grid" is one function
   * and not a habit. `shift` (the event, or a bare flag) suspends it for the
   * duration of the gesture — the same escape hatch the opening magnet and the
   * compass already offered. The canvas clamp rides along: there are no edges
   * to bump into any more, only the ±5000 the backend refuses to store.
   */
  private _snap(p: number[], shift: boolean | { shiftKey?: boolean } = false): number[] {
    const off = typeof shift === 'boolean' ? shift : !!shift?.shiftKey;
    const g = this._gridPitch;
    return off
      ? [clampCanvasR(p[0]), clampCanvasR(p[1])]
      : [clampCanvasR(snapToGrid(p[0], g)), clampCanvasR(snapToGrid(p[1], g))];
  }

  private _samePt(a: number[], b: number[]): boolean {
    return samePoint(a, b);
  }

  /**
   * Walls are derived from rooms, so the legacy per-space `segments` array is dead
   * weight: drop it on every save. Configs written before v1.19.0 shed it on first write.
   */
  private _dropLegacySegments(): void {
    for (const sp of this._serverCfg?.spaces || []) delete (sp as any).segments;
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
    const raw = this._svgPoint(ev);
    if (this._tool === 'resize') {
      // a click picks the room for the scale frame; handle drags never get here
      if (this._rszDrag || path.some((n) => n?.classList?.contains?.('rszhandle'))) return;
      const room = [...this._spaceModel().rooms].reverse().find((r) => this._pointInRoom(raw, r));
      this._rszSel = room?.id || null;
      return;
    }
    if (this._tool === 'delroom') {
      const space = this._spaceModel();
      const room = [...space.rooms].reverse().find((r) => this._pointInRoom(raw, r));
      if (!room) return;
      if (!confirm(this._t('confirm.delete_room', { name: room.name }))) return;
      const sp = this._curSpaceCfg;
      sp.rooms = sp.rooms.filter((r: any) => r.id !== room.id);
      this._saveConfig();
      this._regSignature = '';
      this._maybeRebuildDevices();
      this.requestUpdate();
      return;
    }
    if (this._tool === 'opening') {
      this._openingClick(raw, ev.shiftKey);
      return;
    }
    if (this._tool === 'merge') {
      this._mergeClick(raw);
      return;
    }
    if (this._tool === 'openwall') {
      this._openWallClick(raw);
      return;
    }
    if (this._tool === 'split') {
      this._splitClick(raw, ev.shiftKey);
      return;
    }
    // draw: clicks on grid points build the outline. Nothing is written to the config
    // until the contour closes — an abandoned outline leaves no lines behind.
    const pt = this._snap(raw, ev);
    const closing = this._path.length >= 3 && this._samePt(pt, this._path[0]);
    // Island rooms (v1.34.0): drawing INSIDE an existing room is legal — the
    // contour may become a nested room (a column, an inner room). Partial
    // overlaps are still rejected, but only at closing time, when the whole
    // outline is known (roomsOverlap treats full nesting as legal).
    if (!this._path.length) {
      this._path = [pt];
      return;
    }
    const last = this._path[this._path.length - 1];
    if (this._samePt(pt, last)) return; // repeated click on the same point
    if (closing) {
      // a contour can enclose an existing room without any vertex inside it
      const clash = this._overlapRoom(this._path);
      if (clash) {
        this._showToast(this._t('toast.room_overlap', { name: clash.name || '' }));
        return; // leave the outline open so it can be corrected
      }
      this._path = [...this._path, pt];
      this._cursorPt = null;
      this._nameSel = '';
      this._areaSel = '';
      this._resetRoomDialogFields();
      this._roomDialog = true;
      return;
    }
    this._path = [...this._path, pt];
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
    const sp = this._curSpaceCfg;
    return JSON.stringify({ rooms: sp?.rooms || [], openings: sp?.openings || [] });
  }

  private _rszRestore(snap: string): void {
    // undo restores are commits: they target the REAL config, never the overlay
    const sp = this._serverCfg?.spaces.find((s: any) => s.id === this._space);
    if (!sp) return;
    const s = JSON.parse(snap);
    sp.rooms = s.rooms;
    sp.openings = s.openings;
    this._cfgEpoch++;
    this.requestUpdate();
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
    const sp = { ...real, rooms: s.rooms, openings: s.openings };
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
      const sn = this._snap([plan.a[0] + plan.n[0] * dRaw, plan.a[1] + plan.n[1] * dRaw], ev);
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
      const sn = this._snap(p, ev); // the dragged corner aims at grid nodes
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
    // commit: the preview moves into the REAL config in one step (the only point
    // where _writeConfig can see a resize), collinear T-insert leftovers cleaned,
    // then ONE undo step + ONE write
    const sp = this._curSpaceCfg;
    if (sp) {
      sp.rooms = preview.sp.rooms;
      sp.openings = preview.sp.openings;
      for (const id of g.changed) {
        const r = sp.rooms.find((x: any) => x.id === id);
        if (r?.poly) r.poly = simplifyPoly(r.poly, 1e-9);
      }
    }
    this._rszUndo.push({ space: this._space, snap: g.snap });
    if (this._rszUndo.length > 30) this._rszUndo.shift();
    // the click synthesized after the drag must not re-pick the selection
    this._suppressClick = true;
    setTimeout(() => (this._suppressClick = false), 0);
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

  /** Ctrl+Z in the resize tool: one handle release = one undo step (docs/RESIZE.md). */
  private _rszUndoPop(): void {
    for (let i = this._rszUndo.length - 1; i >= 0; i--) {
      if (this._rszUndo[i].space !== this._space) continue;
      const [entry] = this._rszUndo.splice(i, 1);
      this._rszRestore(entry.snap);
      this._saveConfig();
      return;
    }
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
    for (const id of ids) {
      const poly = res.polys[id] || g.rooms.find((r) => r.id === id)!.poly;
      const c = poleOfInaccessibility(poly);
      labels.push({ x: c[0], y: c[1], text: formatArea(areaM2(poly, this._gridPitch, this._cellCm), imperial), area: true });
    }
    return labels;
  }

  private _rszScaleLabels(poly: number[][]): { x: number; y: number; text: string; area?: boolean }[] {
    const imperial = this.hass?.config?.unit_system?.length === 'mi';
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const c = poleOfInaccessibility(poly);
    return [
      { x: Math.min(...xs), y: Math.min(...ys), text: `${this._fmtLen([0, 0], [w, 0])} × ${this._fmtLen([0, 0], [h, 0])}` },
      { x: c[0], y: c[1], text: formatArea(areaM2(poly, this._gridPitch, this._cellCm), imperial), area: true },
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

  private get _decorList(): any[] {
    const sp = this._curSpaceCfg;
    return Array.isArray(sp?.decor) ? sp.decor : [];
  }

  private get _decorH(): number {
    return NORM_W;
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
      const p = this._snap(this._svgPoint(ev), ev);
      this._decorDraft = { kind: t, a: p, b: p, pid: ev.pointerId };
      capturePointer(ev);
      return true;
    }
    if (t === 'text') {
      const p = this._snap(this._svgPoint(ev), ev);
      this._decorTextDialog = {
        x: clampCanvasN(p[0] / NORM_W), y: clampCanvasN(p[1] / this._decorH),
        text: '', size: 'm', color: this._decorStyle.color,
      };
      return true;
    }
    this._decorSel = null; // select/erase on empty space clears the selection
    // …and under its own tool the picture is grabbable by its body
    // (docs/BACKDROP.md §2). Only INSIDE the image rect: press beside the
    // picture and the plane still pans with one finger.
    if (this._bdMovable) {
      const r = this._bdRect!;
      const p = this._svgPoint(ev);
      if (p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h) {
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
    if (Math.hypot(d.b[0] - d.a[0], d.b[1] - d.a[1]) < min) return;
    const W = NORM_W, H = this._decorH;
    const st = this._decorStyle;
    const id = 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    // creation had no canvas guard at all while the MOVE did — a draft could be
    // born outside the range the mover then refused to leave. One limit, both
    // ends of the gesture (docs/CANVAS.md §9).
    const cn = clampCanvasN;
    let shape: any;
    if (d.kind === 'line') {
      shape = { id, kind: 'line', x1: cn(d.a[0] / W), y1: cn(d.a[1] / H),
        x2: cn(d.b[0] / W), y2: cn(d.b[1] / H), color: st.color, width: st.width };
    } else {
      const x = cn(Math.min(d.a[0], d.b[0]) / W), y = cn(Math.min(d.a[1], d.b[1]) / H);
      const w = Math.abs(d.b[0] - d.a[0]) / W, h = Math.abs(d.b[1] - d.a[1]) / H;
      shape = { id, kind: d.kind, x, y, w, h, color: st.color, width: st.width, fill: st.fill };
    }
    const sp = this._curSpaceCfg;
    sp.decor = [...this._decorList, shape];
    this._decorSel = id;
    this._saveConfig();
    this.requestUpdate();
  }

  /** Select tool: pointerdown on a shape starts moving it. */
  private _decorShapeDown(ev: PointerEvent, shape: any): void {
    if (this._mode !== 'decor') return;
    // Under any other tool the shape is not a target at all: the press has to
    // reach the stage, where the drawing tool starts a new figure (or the
    // backdrop tool grabs the picture). Swallowing it here was the bug — the
    // click on a line end did nothing but keep the old selection alive.
    const t = this._decorTool;
    if (t !== 'select' && t !== 'erase') return;
    ev.stopPropagation();
    ev.preventDefault();
    if (t === 'erase') {
      const sp = this._curSpaceCfg;
      sp.decor = this._decorList.filter((x) => x.id !== shape.id);
      if (this._decorSel === shape.id) this._decorSel = null;
      this._saveConfig();
      this.requestUpdate();
      return;
    }
    this._decorSel = shape.id;
    this._decorMove = {
      id: shape.id, start: this._svgPoint(ev), orig: JSON.parse(JSON.stringify(shape)),
      pid: ev.pointerId, moved: false,
    };
    capturePointer(ev);
  }

  private _decorMoveUpdate(ev: PointerEvent): void {
    const m = this._decorMove!;
    const p = this._svgPoint(ev);
    const o0 = m.orig;
    // The delta used to be what got snapped, which preserves whatever off-grid
    // offset the shape already had: a legacy shape at 0.3013 stayed at 0.3013
    // for ever, one step at a time. Snap the RESULTING ANCHOR instead, so one
    // drag is enough to put any shape on the grid (docs/CANVAS.md §9). Shift
    // suspends it, as everywhere else.
    const ax0 = (o0.kind === 'line' ? o0.x1 : o0.x) * NORM_W;
    const ay0 = (o0.kind === 'line' ? o0.y1 : o0.y) * this._decorH;
    const anchor = this._snap([ax0 + (p[0] - m.start[0]), ay0 + (p[1] - m.start[1])], ev);
    let dx = (anchor[0] - ax0) / NORM_W;
    let dy = (anchor[1] - ay0) / this._decorH;
    // audit follow-up L4 gave decor a bounds clamp of -0.25..1.25 — the plan
    // was a sheet with edges then. It is not any more (docs/CANVAS.md): the
    // clamp is now the same garbage limit the backend enforces, so decor can
    // follow a plan that lives at 2.7 and still cannot be flung to 1e100.
    const o = m.orig;
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
      const o = m.orig;
      if (x.kind === 'line') return { ...x, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
      return { ...x, x: o.x + dx, y: o.y + dy };
    });
    this.requestUpdate();
  }

  /** Double click on a text shape (select tool) re-opens its dialog. */
  private _decorShapeDbl(shape: any): void {
    if (this._mode !== 'decor' || this._decorTool !== 'select' || shape.kind !== 'text') return;
    this._decorTextDialog = { id: shape.id, x: shape.x, y: shape.y,
      text: shape.text, size: shape.size || 'm', color: shape.color };
  }

  private _decorSaveText(): void {
    const d = this._decorTextDialog;
    if (!d || !d.text.trim()) { this._decorTextDialog = null; return; }
    const sp = this._curSpaceCfg;
    if (d.id) {
      sp.decor = this._decorList.map((x) => x.id === d.id
        ? { ...x, text: d.text.trim(), size: d.size, color: d.color } : x);
    } else {
      const id = 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      sp.decor = [...this._decorList, { id, kind: 'text', x: d.x, y: d.y,
        text: d.text.trim(), size: d.size, color: d.color }];
    }
    this._decorTextDialog = null;
    this._saveConfig();
    this.requestUpdate();
  }

  private _decorDeleteSel(): void {
    if (!this._decorSel) return;
    const sp = this._curSpaceCfg;
    sp.decor = this._decorList.filter((x) => x.id !== this._decorSel);
    this._decorSel = null;
    this._saveConfig();
    this.requestUpdate();
  }

  // ============ backdrop transform frame (docs/BACKDROP.md) ============

  /** The centred, UNTRANSFORMED rectangle of the current backdrop image. */
  private get _bdBase(): Rect | null {
    const sp = this._curSpaceCfg;
    return sp?.plan_url ? { ...fitInSquare(sp.plan_aspect, NORM_W) } : null;
  }

  /** Where the backdrop image sits right now, render units (null: no image). */
  private get _bdRect(): Rect | null {
    const sp = this._curSpaceCfg;
    return sp?.plan_url ? planRect(sp, NORM_W) : null;
  }

  /** The stored transform of the current space (defaults = the old behaviour). */
  private get _bdParams(): { dx: number; dy: number; k: number } {
    const sp = this._curSpaceCfg;
    const dx = Number(sp?.plan_x), dy = Number(sp?.plan_y), k = Number(sp?.plan_scale);
    return {
      dx: Number.isFinite(dx) ? dx : 0,
      dy: Number.isFinite(dy) ? dy : 0,
      k: Number.isFinite(k) && k > 0 ? k : 1,
    };
  }

  /**
   * Is the transform frame on screen? Only in the BACKDROP editor, and only
   * under the two tools that are not busy drawing something — the frame's
   * handles must never swallow the first point of a line. Every other mode
   * (view, plan, devices, kiosk) leaves the picture alone entirely.
   */
  private get _bdActive(): boolean {
    return this._mode === 'decor' && !!this._bdRect
      && (this._decorTool === 'select' || this._decorTool === 'backdrop');
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
  private _bdApply(dx: number, dy: number, k: number): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    // 6 decimals: the same precision the rest of the normalised config keeps,
    // and enough for a 1000-unit canvas to be exact to a thousandth of a pixel
    sp.plan_x = Number(clampCanvasN(dx).toFixed(6));
    sp.plan_y = Number(clampCanvasN(dy).toFixed(6));
    sp.plan_scale = Number(Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, k)).toFixed(6));
    this._cfgEpoch++;
    this.requestUpdate();
  }

  /**
   * Begin a backdrop gesture. `corner` is the DRAGGED corner as a pair of
   * signs (-1 = the low side of the axis, +1 = the high one); absent = the
   * body, i.e. a move. Returns false when there is nothing to grab.
   */
  private _bdStart(ev: PointerEvent, corner?: number[]): boolean {
    const base = this._bdBase, r = this._bdRect;
    if (!base || !r) return false;
    const p = this._svgPoint(ev);
    const sgx = corner ? corner[0] : 0;
    const sgy = corner ? corner[1] : 0;
    // the corner that stays put is the OPPOSITE one
    const fx = sgx > 0 ? r.x : r.x + r.w;
    const fy = sgy > 0 ? r.y : r.y + r.h;
    this._bdDrag = {
      kind: corner ? 'scale' : 'move',
      pid: ev.pointerId,
      sx: p[0], sy: p[1],
      base, p0: this._bdParams,
      fx, fy, sgx, sgy,
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
   * SCALE — uniform about the fixed corner. The dragged corner is snapped
   * along the picture's LONGER side and the scale is read back off it, so the
   * fixed corner keeps its (on-grid) place and the picture's long side lands
   * on a node. The short side follows from the aspect ratio and generally does
   * not, which is what "uniform, no rotation, no stretch" costs.
   *
   * Shift suspends the snap, as everywhere (docs/CANVAS.md §9.4).
   */
  private _bdMove(ev: PointerEvent): void {
    const d = this._bdDrag;
    if (!d) return;
    const p = this._svgPoint(ev);
    const b = d.base;
    if (d.kind === 'move') {
      const x0 = b.x + d.p0.dx * NORM_W;
      const y0 = b.y + d.p0.dy * NORM_W;
      const at = this._snap([x0 + (p[0] - d.sx), y0 + (p[1] - d.sy)], ev);
      if (Math.abs(at[0] - x0) > 1e-9 || Math.abs(at[1] - y0) > 1e-9) d.moved = true;
      this._bdApply((at[0] - b.x) / NORM_W, (at[1] - b.y) / NORM_W, d.p0.k);
      return;
    }
    const w0 = b.w || 1, h0 = b.h || 1;
    let k = Math.max(Math.abs(p[0] - d.fx) / w0, Math.abs(p[1] - d.fy) / h0);
    if (!ev.shiftKey) {
      // snap the dragged corner along the dominant axis, then read k back
      const alongX = w0 >= h0;
      const raw = alongX ? d.fx + d.sgx * k * w0 : d.fy + d.sgy * k * h0;
      const snapped = snapToGrid(raw, this._gridPitch);
      const span = Math.abs(snapped - (alongX ? d.fx : d.fy));
      const kk = span / (alongX ? w0 : h0);
      if (kk > 0) k = kk;
    }
    k = Math.min(PLAN_SCALE_MAX, Math.max(PLAN_SCALE_MIN, k));
    if (Math.abs(k - d.p0.k) > 1e-9) d.moved = true;
    const x = d.sgx > 0 ? d.fx : d.fx - k * w0;
    const y = d.sgy > 0 ? d.fy : d.fy - k * h0;
    this._bdApply((x - b.x) / NORM_W, (y - b.y) / NORM_W, k);
  }

  /** Has this space's picture been moved or scaled at all? */
  private get _bdMoved(): boolean {
    if (this._mode !== 'decor' || !this._bdRect) return false;
    const p = this._bdParams;
    return p.dx !== 0 || p.dy !== 0 || p.k !== 1;
  }

  /** Put the picture back where an untouched plan has it: centred, own size. */
  private _bdReset(): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    delete sp.plan_x; delete sp.plan_y; delete sp.plan_scale;
    this._bdDrag = null;
    this._saveConfig();
    this._showToast(this._t('decor.backdrop_reset_done'));
    this.requestUpdate();
  }

  /** Release: persist only when something actually moved. */
  private _bdUp(): void {
    const d = this._bdDrag;
    this._bdDrag = null;
    if (d?.moved) this._saveConfig();
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
    // finger-sized in SCREEN terms: a fraction of the visible view, so the
    // handle stays grabbable at any zoom (the same rule the vacuum fit uses)
    const hr = Math.max(view.w, view.h) * 0.02;
    const corners: [number, number, string][] = [
      [-1, -1, 'nwse'], [1, -1, 'nesw'], [1, 1, 'nwse'], [-1, 1, 'nesw'],
    ];
    return svg`<g class="bdframe">
      <rect class="bdbox" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"></rect>
      ${corners.map(([sx, sy, cur]) => svg`<circle
        class="bdhandle bd-${cur}" data-corner="${sx + ',' + sy}"
        cx="${sx < 0 ? r.x : r.x + r.w}" cy="${sy < 0 ? r.y : r.y + r.h}" r="${hr.toFixed(1)}"
        @pointerdown=${(e: PointerEvent) => {
          e.stopPropagation(); e.preventDefault(); this._bdStart(e, [sx, sy]);
        }}></circle>`)}
    </g>` as unknown as TemplateResult;
  }

  private _renderDecorLayer(): TemplateResult {
    const W = NORM_W, H = this._decorH;
    const TXT = { s: 14, m: 20, l: 30 } as Record<string, number>;
    const editing = this._mode === 'decor';
    const shapes = this._decorList.map((sh) => {
      const cls = 'dshape' + (editing && this._decorSel === sh.id ? ' dsel' : '');
      const down = (e: PointerEvent) => this._decorShapeDown(e, sh);
      const dbl = () => this._decorShapeDbl(sh);
      if (sh.kind === 'line')
        // round caps: line ends read as circles of the stroke width, so two
        // lines meeting at an angle join without the notch (owner's screenshot)
        return svg`<line class="${cls}" x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
          stroke="${sh.color}" stroke-width="${sh.width}" stroke-linecap="round" stroke-linejoin="round" @pointerdown=${down}></line>`;
      if (sh.kind === 'rect')
        return svg`<rect class="${cls}" x="${sh.x * W}" y="${sh.y * H}" width="${sh.w * W}" height="${sh.h * H}"
          stroke="${sh.color}" stroke-width="${sh.width}"
          fill="${sh.fill ? sh.color : 'none'}" fill-opacity="${sh.fill ? 0.25 : 0}" @pointerdown=${down}></rect>`;
      if (sh.kind === 'ellipse')
        return svg`<ellipse class="${cls}" cx="${(sh.x + sh.w / 2) * W}" cy="${(sh.y + sh.h / 2) * H}"
          rx="${(sh.w / 2) * W}" ry="${(sh.h / 2) * H}" stroke="${sh.color}" stroke-width="${sh.width}"
          fill="${sh.fill ? sh.color : 'none'}" fill-opacity="${sh.fill ? 0.25 : 0}" @pointerdown=${down}></ellipse>`;
      if (sh.kind === 'text')
        return svg`<text class="${cls} dtext" x="${sh.x * W}" y="${sh.y * H}" fill="${sh.color}"
          font-size="${TXT[sh.size] || TXT.m}" @pointerdown=${down} @dblclick=${dbl}>${sh.text}</text>`;
      return nothing;
    });
    // живое превью рисуемой фигуры
    let draft: unknown = nothing;
    const d = this._decorDraft;
    if (d) {
      const st = this._decorStyle;
      if (d.kind === 'line')
        draft = svg`<line class="ddraft" x1="${d.a[0]}" y1="${d.a[1]}" x2="${d.b[0]}" y2="${d.b[1]}"
          stroke="${st.color}" stroke-width="${st.width}" stroke-linecap="round" stroke-linejoin="round"></line>`;
      else {
        const x = Math.min(d.a[0], d.b[0]), y = Math.min(d.a[1], d.b[1]);
        const w = Math.abs(d.b[0] - d.a[0]), h = Math.abs(d.b[1] - d.a[1]);
        draft = d.kind === 'rect'
          ? svg`<rect class="ddraft" x="${x}" y="${y}" width="${w}" height="${h}" stroke="${st.color}"
              stroke-width="${st.width}" fill="${st.fill ? st.color : 'none'}" fill-opacity="${st.fill ? 0.15 : 0}"></rect>`
          : svg`<ellipse class="ddraft" cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"
              stroke="${st.color}" stroke-width="${st.width}" fill="${st.fill ? st.color : 'none'}" fill-opacity="${st.fill ? 0.15 : 0}"></ellipse>`;
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
      ['erase', 'mdi:eraser', 'decor.erase'],
    ] as const;
    return html`<div class="editbar decorbar">
      <ha-icon icon="mdi:draw" class="warn"></ha-icon>
      ${tools.map(
        ([t, ic, k]) => html`<button class="btn dtool ${this._decorTool === t ? 'on' : ''}"
          @click=${() => { this._decorTool = t as typeof this._decorTool; this._decorDraft = null; }}
          title=${this._t(k)}>
          <ha-icon icon=${ic}></ha-icon><span class="ml">${this._t(k)}</span>
        </button>`,
      )}
      <input type="color" class="dcolor" .value=${this._decorStyle.color}
        title=${this._t('decor.color')}
        @input=${(e: Event) => (this._decorStyle = { ...this._decorStyle, color: (e.target as HTMLInputElement).value })} />
      <select class="dwidth" title=${this._t('decor.width')}
        @change=${(e: Event) => (this._decorStyle = { ...this._decorStyle, width: Number((e.target as HTMLSelectElement).value) })}>
        ${[[1.5, 'decor.w_thin'], [3, 'decor.w_mid'], [6, 'decor.w_thick']].map(
          ([v, k]) => html`<option value=${v} ?selected=${this._decorStyle.width === v}>${this._t(k as any)}</option>`,
        )}
      </select>
      <label class="dfill"><input type="checkbox" .checked=${this._decorStyle.fill}
        @change=${(e: Event) => (this._decorStyle = { ...this._decorStyle, fill: (e.target as HTMLInputElement).checked })} />
        ${this._t('decor.fill')}</label>
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

  private _renderDecorTextDialog(): TemplateResult {
    const d = this._decorTextDialog!;
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._decorTextDialog = null)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:format-text"></ha-icon>${this._t('decor.text_title')}</div>
        <div class="body">
          <label>${this._t('decor.text_label')}</label>
          <input class="namein" .value=${d.text} autofocus
            @input=${(e: Event) => (this._decorTextDialog = { ...d, text: (e.target as HTMLInputElement).value })}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._decorSaveText(); }} />
          <label>${this._t('decor.text_size')}</label>
          <div class="radiorow">
            ${(['s', 'm', 'l'] as const).map(
              (sz) => html`<label class="srcrow inline">
                <input type="radio" name="dtsize" .checked=${d.size === sz}
                  @change=${() => (this._decorTextDialog = { ...d, size: sz })} />
                <span>${this._t(('decor.size_' + sz) as any)}</span>
              </label>`,
            )}
          </div>
          <label>${this._t('decor.color')}</label>
          <input type="color" .value=${d.color}
            @input=${(e: Event) => (this._decorTextDialog = { ...d, color: (e.target as HTMLInputElement).value })} />
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._decorTextDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn primary" ?disabled=${!d.text.trim()} @click=${() => this._decorSaveText()}>${this._t('btn.save')}</button>
        </div>
      </div>
    </div>`;
  }

  /** Boundary under the cursor in the open-wall tool (hover preview). */
  private get _openWallHover(): { segs: number[][]; open: boolean } | null {
    if (!this._markup || this._tool !== 'openwall' || !this._cursorPt) return null;
    const hit = this._openWallHit(this._cursorPt);
    return hit ? { segs: hit.segs, open: hit.open } : null;
  }

  /** Dashed strokes over open (virtual) boundaries; highlighted in the tool. */
  private _renderOpenWalls(disp?: SpaceDisplay): TemplateResult {
    const pairs = this._openPairs();
    const hover = this._openWallHover;
    if (!pairs.length && !hover) return svg`` as unknown as TemplateResult;
    const hot = this._markup && this._tool === 'openwall';
    const stroke = disp?.color || 'var(--hp-muted)';
    return svg`<g class="openwalls ${hot ? 'hot' : ''}" style="--ow-stroke:${stroke}">
      ${pairs.flatMap((p) => p.segs.map((sg) => svg`<line class="openwall"
        x1="${sg[0]}" y1="${sg[1]}" x2="${sg[2]}" y2="${sg[3]}"></line>`))}
      ${hover
        ? hover.segs.map((sg) => svg`<line class="openwall-preview ${hover.open ? 'willclose' : ''}"
            x1="${sg[0]}" y1="${sg[1]}" x2="${sg[2]}" y2="${sg[3]}"></line>`)
        : nothing}
    </g>` as unknown as TemplateResult;
  }

  /** All open-boundary pairs of the current space with their shared segments. */
  private _openPairsCache: { model: SpaceModel; pairs: { a: RoomCfg; b: RoomCfg; segs: number[][] }[] } | null = null;

  private _openPairs(): { a: RoomCfg; b: RoomCfg; segs: number[][] }[] {
    // audit L1: this used to run once PER ROOM on every render (O(rooms^3)
    // collinear-overlap math on every HA state push), so it is memoized.
    //
    // The key is the SPACE MODEL OBJECT ITSELF (HP-1454-04). It used to be a
    // string of room ids and open_to links, which said nothing about geometry:
    // change the plan, or drag a vertex, and the shared segments were
    // recomputed for the outlines but the open boundaries — and the glow cuts
    // that follow them — kept their old coordinates until a full reload.
    // `_model` is already rebuilt whenever the epoch or the config fingerprint
    // moves, and everything below derives from it, so its identity is an exact
    // and cheaper key. One cache invalidation strategy, not two.
    const sp = this._spaceModel();
    if (this._openPairsCache && this._openPairsCache.model === sp) return this._openPairsCache.pairs;
    const pairs = this._computeOpenPairs();
    this._openPairsCache = { model: sp, pairs };
    return pairs;
  }

  private _computeOpenPairs(): { a: RoomCfg; b: RoomCfg; segs: number[][] }[] {
    const rooms = this._spaceModel().rooms.filter((r) => r.id);
    const res: { a: RoomCfg; b: RoomCfg; segs: number[][] }[] = [];
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) {
        const a = rooms[i], b = rooms[j];
        const linked = ((a as any).open_to || []).includes(b.id) || ((b as any).open_to || []).includes(a.id);
        if (!linked) continue;
        const pa = roomPoly(a), pb = roomPoly(b);
        if (!pa || !pb) continue;
        const segs = sharedBoundary(pa, pb, this._gridPitch * 0.02);
        if (segs.length) res.push({ a, b, segs });
      }
    return res;
  }

  /** The shared boundary nearest to the cursor (both the tool's click and hover). */
  private _openWallHit(raw: number[]): { a: RoomCfg; b: RoomCfg; segs: number[][]; open: boolean } | null {
    const rooms = this._spaceModel().rooms.filter((r) => r.id);
    const pull = this._gridPitch * 6;
    let best: { a: RoomCfg; b: RoomCfg; segs: number[][]; d: number } | null = null;
    for (let i = 0; i < rooms.length; i++)
      for (let j = i + 1; j < rooms.length; j++) {
        const pa = roomPoly(rooms[i]), pb = roomPoly(rooms[j]);
        if (!pa || !pb) continue;
        const segs = sharedBoundary(pa, pb, this._gridPitch * 0.02);
        for (const seg of segs) {
          const d = distToSegment(raw, seg);
          if (d <= pull && (!best || d < best.d)) best = { a: rooms[i], b: rooms[j], segs, d };
        }
      }
    if (!best) return null;
    const open = (((best.a as any).open_to || []).includes(best.b.id))
      || (((best.b as any).open_to || []).includes(best.a.id));
    return { a: best.a, b: best.b, segs: best.segs, open };
  }

  /** Open-boundary tool: a click on a shared wall toggles its "virtual" state. */
  private _openWallClick(raw: number[]): void {
    const best = this._openWallHit(raw);
    if (!best) {
      this._showToast(this._t('toast.openwall_pick'));
      return;
    }
    const sp = this._curSpaceCfg;
    const ra = sp.rooms.find((r: any) => r.id === best.a.id);
    const rb = sp.rooms.find((r: any) => r.id === best.b.id);
    if (!ra || !rb) return;
    const linked = (ra.open_to || []).includes(rb.id) || (rb.open_to || []).includes(ra.id);
    if (linked) {
      ra.open_to = (ra.open_to || []).filter((x: string) => x !== rb.id);
      rb.open_to = (rb.open_to || []).filter((x: string) => x !== ra.id);
      if (!ra.open_to.length) delete ra.open_to;
      if (!rb.open_to.length) delete rb.open_to;
      this._showToast(this._t('toast.openwall_closed', { a: ra.name || '', b: rb.name || '' }));
    } else {
      ra.open_to = [...(ra.open_to || []), rb.id];
      rb.open_to = [...(rb.open_to || []), ra.id];
      this._showToast(this._t('toast.openwall_opened', { a: ra.name || '', b: rb.name || '' }));
    }
    this._saveConfig();
    this.requestUpdate();
  }

  /** Opening tool: click an existing opening to edit it, or a wall to place one. */
  private _openingClick(raw: number[], shift = false): void {
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
    // the opening is born where the PREVIEW showed it — magnet included
    const place = this._opRuler(snap, this._cmToUnits(OPENING_DEFAULT_CM), shift);
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
    this._opDrag = { id: o.id, moved: false, sx: ev.clientX, sy: ev.clientY, dirty: false };
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
    const r = this._opRuler(snap, cfg.length * NORM_W, ev.shiftKey);
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
   * one. `tol` is half a grid step and Shift opts out of the magnet — the same
   * convention as the coarse-angle Shift elsewhere in the editor. The returned
   * x/y are ALREADY magnetised, so the caller just writes them.
   */
  private _opRuler(
    snap: { x: number; y: number; angle: number },
    rlen: number,
    shift: boolean,
  ): { x: number; y: number; angle: number; measure: OpMeasure | null } {
    const rooms = this._spaceModel().rooms;
    const tol = this._gridPitch / 2;
    let cx = snap.x, cy = snap.y;
    let sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol);
    if (sh && sh.centered && !shift && (cx !== sh.wallCenter[0] || cy !== sh.wallCenter[1])) {
      [cx, cy] = sh.wallCenter;
      sh = openingShoulders([cx, cy], snap.angle, rlen, rooms, tol);
    } else if (sh && !shift) {
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
        guide: sh.centered && !shift
          ? { x: sh.wallCenter[0], y: sh.wallCenter[1], angle: snap.angle }
          : null,
      },
    };
  }

  private _opPointerUp(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._opDrag || this._opDrag.id !== o.id) return;
    const moved = this._opDrag.moved;
    this._opMeasure = null; // badges and the center tick live only through the drag
    // only write when the geometry actually changed (audit L4)
    if (moved && this._opDrag.dirty) this._saveConfig();
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
    const H = this._spaceH;
    const o: OpeningCfg = {
      id: d.id || 'o' + Date.now().toString(36),
      type: d.type,
      x: d.x / NORM_W,
      y: d.y / H,
      angle: d.angle,
      length: this._cmToUnits(Math.max(20, d.lengthCm)) / NORM_W,
      contact: d.contact || null,
      lock: d.type === 'door' ? d.lock || null : null,
      invert: d.invert || undefined,
      flip_h: d.flipH || undefined,
      flip_v: d.flipV || undefined,
    };
    sp.openings = sp.openings || [];
    const i = sp.openings.findIndex((x: OpeningCfg) => x.id === o.id);
    if (i >= 0) sp.openings[i] = o;
    else sp.openings.push(o);
    this._saveConfig();
    this._openingDialog = null;
    this.requestUpdate();
  }

  private _deleteOpening(): void {
    const d = this._openingDialog;
    const sp = this._curSpaceCfg;
    if (!d?.id || !sp?.openings) return;
    sp.openings = sp.openings.filter((x: OpeningCfg) => x.id !== d.id);
    this._saveConfig();
    this._openingDialog = null;
    this.requestUpdate();
  }

  /** Contact-sensor candidates: door/window-like classes first, then the rest. */
  private _contactCandidates(): { value: string; label: string }[] {
    const out: [string, string, number][] = [];
    for (const eid of Object.keys(this.hass.states)) {
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
      .filter((eid) => eid.startsWith('lock.'))
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
    this._saveConfig();
    this._mergeDialog = null;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._showToast(this._t('toast.rooms_merged', { name: keep.name || '' }));
  }

  /** Split: click the room, then two points on its walls. */
  private _splitClick(raw: number[], shift = false): void {
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
    // editor itself makes IS a grid node. Shift opts out, as everywhere else.
    const eps = this._gridPitch * 0.02;
    const pull = this._gridPitch * 6; // ≈2.5% of the plan width — generous but intentional
    const raw0 = closestPointOnBoundary(raw, poly);
    const near = raw0 && !shift ? (snapPointAlongPoly(raw0, poly, this._gridPitch) || raw0) : raw0;
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
      const mid = this._snap(raw, shift);
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
    if (this._tool === 'opening' || this._tool === 'openwall') {
      // hover preview: raw cursor point; snapping happens in the preview getters
      this._opShift = !!ev.shiftKey; // Shift opts out of the centre magnet
      this._cursorPt = this._svgPoint(ev);
      return;
    }
    const drawing = this._tool === 'draw' && this._path.length && !this._contourClosed;
    const cutting = this._tool === 'split' && !!this._splitSel?.pts?.length;
    if (!drawing && !cutting) return;
    this._cursorPt = this._snap(this._svgPoint(ev), ev);
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
    const r = this._opRuler(snap, rlen, this._opShift);
    return { x: r.x, y: r.y, angle: r.angle, rlen, measure: r.measure };
  }

  /** The rulers to draw right now: from the DRAG of an existing opening, or
   *  from the PLACEMENT preview of a new one — identical badges either way. */
  private get _opMeasureView(): OpMeasure | null {
    return this._opMeasure || this._openingPreview?.measure || null;
  }

  /** Save a room with a mandatory binding to an HA area. */
  private _saveRoom(): void {
    if (!this._areaSel) return;
    this._commitRoom();
  }

  /** Save a decorative room without an area (only a name is required). */
  private _saveRoomNoArea(): void {
    if (!this._nameSel.trim()) return;
    this._areaSel = '';
    this._commitRoom();
  }

  private _commitRoom(): void {
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const H = this._spaceH;
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
    sp.rooms.push({
      id: 'r' + Date.now().toString(36),
      name: this._nameSel || areaName || this._t('room.default_name'),
      area: this._areaSel || null,
      poly: verts.map((p) => [p[0] / NORM_W, p[1] / H]),
      ...(this._roomSettingsFromDialog() ? { settings: this._roomSettingsFromDialog() } : {}),
    });
    this._saveConfig();
    this._path = [];
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
    this._path = [];
    this._cursorPt = null;
    this._roomDialog = false;
    this._pendingSplit = null;
    this._splitSel = null;
    this._mergeSel = null;
    this._mergeDialog = null;
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
        showEntities: d.bindingKind === 'entity' && !!this.hass.entities[d.bindingRef || '']?.device_id,
        bindingFilter: '',
        icon: d.marker?.icon || '',
        autoIcon: d.icon || '',
        display: d.marker?.display || 'badge',
        rippleColor: d.marker?.ripple_color || '',
        rippleSize: Number(d.marker?.ripple_size) > 0 ? Number(d.marker!.ripple_size) : 3,
        size: Number(d.marker?.size) > 0 ? Number(d.marker!.size) : 1,
        angle: Number(d.marker?.angle) || 0,
        tapAction: d.marker?.tap_action || '',
        tapTarget: d.marker?.tap_target || '',
        tapConfirm: d.marker?.tap_confirm === true,
        runFilter: '',
        defaultTap: d.primary?.split('.')[0] === 'light' ? 'toggle' : 'info',
        controls: [...(d.marker?.controls || [])],
        controlsFilter: '',
        isLight: d.marker?.is_light === true,
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
    const h = this.hass;
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
      if (v !== this._markerDialog?.binding && shownKeys.has(name + '|' + (dev.area_id || ''))) continue;
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
      const isHelper = helperPlatforms.has(reg.platform);
      const isGroupEntity = reg.platform === 'group';
      if (!isHelper && !isGroupEntity) continue;
      if (reg.hidden) continue;
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
        if (taken.has(v) || seen.has(v) || reg.hidden) continue;
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
        ripple_color: dlg.display !== 'badge' && dlg.rippleColor ? dlg.rippleColor : null,
        ripple_size: dlg.display !== 'badge' && dlg.rippleSize !== 3 ? dlg.rippleSize : null,
        size: dlg.size !== 1 ? dlg.size : null,
        angle: dlg.angle ? dlg.angle : null,
        tap_action: dlg.tapAction || null,
        tap_target: dlg.tapAction === 'run' ? dlg.tapTarget || null : null,
        tap_confirm: dlg.tapConfirm ? true : null,
        controls: dlg.controls.length ? dlg.controls : null,
        // pdfs may be rewritten below when rebinding changes the marker id
        is_light: dlg.isLight ? true : null,
        use_climate_temp: dlg.useClimateTemp ? true : null,
        glow_radius_cm: (() => {
          const v = parseFloat(dlg.glowRadius);
          if (!Number.isFinite(v) || v <= 0) return null;
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
      cfg.markers = cfg.markers.filter((m) => m.id !== id && m.id !== oldId);
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
      if (prevPos && prevPos.s === targetSpace) {
        // stays in place; pin it under the (possibly new) id
        if (id !== oldId || !this._layout[id] || roomChanged) {
          newPos = { s: prevPos.s, x: prevPos.x, y: prevPos.y };
          this._layout = { ...this._layout, [id]: newPos };
        }
      } else if (!this._layout[id] || roomChanged) {
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
      if (oldId && oldId !== id) {
        // rebinding changed the icon id — clean up the old position
        delete this._layout[oldId];
        await this.hass.callWS({ type: 'houseplan/layout/delete', device_id: oldId })
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
    if (!dlg) return;
    const d = dlg.devId ? this._devices.find((x) => x.id === dlg.devId) : null;
    const label = dlg.name || this._t('device.fallback');
    if (!confirm(this._t('confirm.remove_marker', { name: label }))) return;
    const cfg = this._serverCfg!;
    cfg.markers = cfg.markers || [];
    if (d && d.bindingKind === 'virtual') {
      cfg.markers = cfg.markers.filter((m) => m.id !== d.id);
    } else if (d && d.marker) {
      // there was an explicit marker → either hide or delete: we hide (the auto entry comes back if it is an auto device)
      cfg.markers = cfg.markers.filter((m) => m.id !== d.id);
      if (d.bindingKind === 'device' && d.bindingRef) {
        cfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, hidden: true });
      } else if (d.bindingKind === 'entity' && d.bindingRef) {
        cfg.markers.push({ id: d.id, binding: 'entity:' + d.bindingRef, hidden: true });
      }
    } else if (d && d.bindingKind === 'device' && d.bindingRef) {
      cfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, hidden: true });
    } else if (d && d.bindingKind === 'entity' && d.bindingRef) {
      cfg.markers.push({ id: d.id, binding: 'entity:' + d.bindingRef, hidden: true });
    }
    try {
      await this._saveConfigNow();
      if (d && d.bindingKind === 'virtual' && this._layout[d.id]) {
        // the virtual one is deleted for good → its position is no longer needed
        delete this._layout[d.id];
        await this.hass.callWS({ type: 'houseplan/layout/delete', device_id: d.id })
          .then((r: any) => this._noteLayoutRev(r)).catch(() => undefined);
      }
      this._markerDialog = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast(this._t('toast.marker_removed'));
    } catch (e: any) {
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
      }
      // per-space display settings; hand-drawn spaces get borders+names on by default
      const draw = d.source === 'draw';
      sp.settings = {
        ...(sp.settings || {}),
        show_borders: draw && d.mode === 'create' ? true : d.showBorders,
        show_names: draw && d.mode === 'create' ? true : d.showNames,
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
      sp.cell_cm = Number.isFinite(d.cellCm) && d.cellCm > 0 ? d.cellCm : 5;
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
        this._showToast(this._t(wasFirst && !this._importTotal ? 'toast.space_added_onboard' : 'import.done'));
      } else {
        this._showToast(d.mode === 'create' ? this._t('toast.space_added') : this._t('toast.space_saved'));
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
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:home-floor-1"></ha-icon>${this._t('import.title')}</div>
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
        <div class="row">
          <button class="btn ghost" @click=${() => { this._importDialog = null; this._openSpaceDialog('create'); }}>
            ${this._t('import.manual')}
          </button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => this._startImport()} ?disabled=${!n}>
            <ha-icon icon="mdi:import"></ha-icon>${this._t('import.start', { n })}
          </button>
        </div>
      </div>
    </div>`;
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
      weather_entity: (gd.weatherEntity || '').trim() || undefined,
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
    // with rays off, night, rain. Those never fade, they just are not there.
    if (this._editing || !this._effSunRays()) { this._sunFadeReset(); return empty; }
    const north = this._effNorth();
    const sun = north !== null ? sunStateOf(this.hass) : null;
    if (!sun || sun.elevation <= 0) { this._sunFadeReset(); return empty; }
    const weather = weatherEntityOf(this._sunGlobal());
    const cloud = cloudFactor(weather ? this.hass?.states?.[weather]?.state : null);
    const alpha = rayPeakAlpha(cloud);
    if (alpha <= 0) { this._sunFadeReset(); return empty; }
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
      this._sunRaysCache = { key, rays: computeSunRays(rooms, windows, sun.azimuth, sun.elevation, north!) };
    }
    const rays = this._sunRaysCache.rays;
    if (!rays.length) return empty;
    const color = rayColor(dayPhase(sun.elevation).warmth);
    const stops = rayStops();
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
    // window line inward, and is `r.depth` = `len·cos` long — NOT along the
    // ray. For parallel rays the distance travelled from the glass is an
    // affine function of the point, so its iso-alpha lines are parallel to the
    // wall; with this axis every point `source + dir·u` lands at offset
    // `u/len`. Whole pane at peak alpha, identical fade distance along every
    // ray, and the parallelogram's far edge exactly on the gradient's end.
    return svg`<defs>
        ${rays.map((r, i) => {
          const mx = (r.a[0] + r.b[0]) / 2;
          const my = (r.a[1] + r.b[1]) / 2;
          return svg`<linearGradient id="hp-sun-${i}" gradientUnits="userSpaceOnUse"
            x1="${mx}" y1="${my}"
            x2="${mx + r.normal[0] * r.depth}" y2="${my + r.normal[1] * r.depth}">
            ${stops.map(([off, k]) => svg`<stop offset="${(off * 100).toFixed(1)}%"
              stop-color="${color}" stop-opacity="${(alpha * k).toFixed(4)}"></stop>`)}
          </linearGradient>`;
        })}
      </defs>
      <g class="sunlayer ${this._sunOut ? 'out' : ''}">
        ${rays.map((r, i) => r.polys.map((p) => svg`<polygon
          points="${p.map((q) => q[0] + ',' + q[1]).join(' ')}" fill="url(#hp-sun-${i})"></polygon>`))}
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
      weatherEntity: weatherEntityOf(this._settings) || '',
      busy: false,
    };
  };

  /**
   * Preview the batch alignment (docs/CANVAS.md §9). Nothing is written here:
   * the run is pure, so the dialog can show the exact count and the exact
   * largest shift, and then commit the very object it measured.
   */
  private _openAlignDialog = (): void => {
    if (!this._norm || !this._serverCfg) return;
    const r = alignAllToGrid(this._serverCfg.spaces || [], this._layout || {});
    // the shift in the user's own units: normalised → cells → cm, using the
    // scale of the first space that has one (they rarely differ, and the
    // number is an ORDER of magnitude, not a measurement)
    const cellCm = Number((this._serverCfg.spaces || []).find((x: any) => Number(x?.cell_cm) > 0)?.cell_cm) || 5;
    const cm = r.report.maxShift * GRID_N * cellCm;
    this._alignDialog = { report: r.report, spaces: r.spaces, layout: r.layout, cm, busy: false };
  };

  /**
   * Commit it: ONE config write and ONE layout write, so a plan that ends up
   * wrong ends up wrong exactly once and the previous state is a single undo
   * away — by re-running nothing, because there is no undo. The dialog says so.
   */
  private async _runAlignToGrid(): Promise<void> {
    const d = this._alignDialog;
    if (!d || d.busy || !this._serverCfg) return;
    this._alignDialog = { ...d, busy: true };
    try {
      this._serverCfg = { ...this._serverCfg, spaces: d.spaces };
      this._layout = d.layout;
      for (const id of Object.keys(d.layout)) this._dirtyPos.add(id);
      this._modelCache = null;
      this._frame = null;
      await this._saveConfigNow();
      await this._persistLayoutNow();
      this._alignDialog = null;
      this.requestUpdate();
      this._showToast(this._t('gs.align_done', { n: String(d.report.moved) }));
    } catch (e: any) {
      if (this._alignDialog) this._alignDialog = { ...this._alignDialog, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  /** The debounced layout writer, awaited — the batch must not return before
   *  the positions it promised are actually on their way. */
  private async _persistLayoutNow(): Promise<void> {
    if (!this._serverStorage) {
      localStorage.setItem(LS_KEY, JSON.stringify(this._layout));
      this._dirtyPos.clear();
      return;
    }
    const ids = [...this._dirtyPos];
    this._dirtyPos.clear();
    await Promise.all(ids.map((id) => {
      const pos = this._layout[id];
      if (!pos) return Promise.resolve();
      this._sentPos.set(id, pos);
      return this.hass
        .callWS({ type: 'houseplan/layout/update', device_id: id, pos })
        .then((r: any) => this._noteLayoutRev(r))
        .finally(() => { if (this._sentPos.get(id) === pos) this._sentPos.delete(id); });
    }));
    this._cacheSnapshot();
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
      const we = (d.weatherEntity || '').trim();
      if (we) settings.weather_entity = we;
      else delete settings.weather_entity;
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
    const doors = this._openingsR.filter((o) => o.type === 'door');
    const spots: { pos: { x: number; y: number }; c: string; alpha: number; clip: string[] | null; r: number }[] = [];
    for (const d of this._devices) {
      if (d.space !== space.id) continue;
      if (d.hidden) continue; // an invisible device casts no visible light (docs/FILTERING.md)
      // A light source is normally a device with a lit light.* entity. With the
      // "is a light source" flag (field request: a smart SWITCH driving dumb
      // fixtures) any lit entity counts — the switch itself, or the lights it
      // controls when they are bound.
      // the SAME condition that turns the icon yellow (devices.ts)
      const lightEid = litLightEntity(this.hass, d);
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
      if (home) {
        // open (virtual) boundaries: light flows through the whole connected
        // zone of rooms, not just the source's own room (owner's spec)
        const zoneIds = home.r.id ? openZoneOf(home.r.id, space.rooms) : new Set([home.r.id]);
        const zone = polys.filter((x) => x.r.id && zoneIds.has(x.r.id));
        const zoneList = zone.length ? zone : [home];
        const shapes: string[] = zoneList.map(
          (z) => 'M ' + z.poly.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z',
        );
        // doorways on the ZONE's walls spill light into rooms outside the zone
        const others = polys.filter((x) => !zoneList.includes(x)).map((x) => x.poly);
        for (const o of doors) {
          const onZoneWall = zoneList.some((z) => {
            const near = closestPointOnBoundary([o.rx, o.ry], z.poly);
            return near && Math.hypot(near[0] - o.rx, near[1] - o.ry) <= g * 0.75;
          });
          if (!onZoneWall) continue;
          const rad = (o.angle * Math.PI) / 180;
          const dx = (Math.cos(rad) * o.rlen) / 2;
          const dy = (Math.sin(rad) * o.rlen) / 2;
          if (!hasRoomBehind([o.rx, o.ry], o.angle, [pos.x, pos.y], others, g * 0.6)) continue;
          const sector = doorSector([pos.x, pos.y], [o.rx - dx, o.ry - dy], [o.rx + dx, o.ry + dy], R);
          if (sector) shapes.push('M ' + sector.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z');
        }
        // IMPORTANT: separate <path> children — clipPath children always
        // UNION. Joining the room and a sector into ONE path made the default
        // nonzero fill-rule cancel their overlap when the windings opposed,
        // punching a dark wedge INSIDE the room (field report + screenshot).
        clip = shapes;
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
          ${sp.clip ? svg`<clipPath id="hp-glowclip-${i}">${sp.clip.map((d) => svg`<path d="${d}"></path>`)}</clipPath>` : nothing}`)}
      </defs>
      <g class="glowlayer">
        ${spots.map((sp, i) => svg`<circle cx="${sp.pos.x}" cy="${sp.pos.y}" r="${sp.r}"
          fill="url(#hp-glow-${i})" ${''}
          clip-path=${sp.clip ? `url(#hp-glowclip-${i})` : nothing}></circle>`)}
      </g>` as unknown as TemplateResult;
  }

  /**
   * The confirmation. It states the two numbers the user needs to decide —
   * HOW MANY elements move and by HOW MUCH at most — and it says plainly that
   * there is no undo, because there is not: the action is a single batch write
   * and the card keeps no snapshot of what the plan looked like before.
   */
  private _renderAlignDialog(): TemplateResult {
    const d = this._alignDialog!;
    const r = d.report;
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._alignDialog = null)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:grid"></ha-icon>${this._t('gs.align_title')}</div>
        <div class="body">
          ${r.moved === 0
            ? html`<p class="alignmsg">${this._t('gs.align_none')}</p>`
            : html`
              <p class="alignmsg">${this._t('gs.align_count', {
                n: String(r.moved), total: String(r.total),
                cm: (Math.round(d.cm * 10) / 10).toString(),
              })}</p>
              <div class="rhint">${this._t('gs.align_warn')}</div>`}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._alignDialog = null)}>${this._t('btn.cancel')}</button>
          ${r.moved === 0 ? nothing : html`
            <button class="btn on" @click=${this._runAlignToGrid} ?disabled=${d.busy}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('gs.align_run')}
            </button>`}
        </div>
      </div>
    </div>`;
  }

  private _renderSettingsDialog(): TemplateResult {
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog wide" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:cog-outline"></ha-icon>${this._t('gs.title')}</div>
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
          <div class="colorrow gsrow">
            <span class="gsl">${this._t('gs.glow_radius')}</span>
            <input type="number" class="tempin" min="0.5" step="0.5"
              .value=${String(this._settingsDialog!.glowRadius)}
              @input=${(e: Event) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                if (Number.isFinite(v) && v > 0)
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
          <div class="colorrow gsrow">
            <span class="gsl">${this._t('gs.weather')}</span>
            <input class="namein" type="text" list="hp-weather-list" placeholder=${this._t('gs.weather_ph')}
              .value=${this._settingsDialog!.weatherEntity}
              @input=${(e: Event) =>
                (this._settingsDialog = { ...this._settingsDialog!, weatherEntity: (e.target as HTMLInputElement).value })} />
            <datalist id="hp-weather-list">
              ${Object.keys(this.hass?.states || {}).filter((id) => id.startsWith('weather.')).map(
                (id) => html`<option value=${id}></option>`,
              )}
            </datalist>
          </div>
          <label class="dispsection">${this._t('gs.grid_group')}</label>
          <div class="rhint">${this._t('gs.grid_hint')}</div>
          <div class="colorrow gsrow">
            <button class="btn ghost alignall" @click=${this._openAlignDialog}>
              <ha-icon icon="mdi:grid"></ha-icon>${this._t('gs.align_all')}
            </button>
          </div>
          <label class="dispsection">${this._t('gs.about_group')}</label>
          <div class="aboutver">${this._t('gs.about_version', { v: CARD_VERSION })}</div>
          <a class="aboutlink" href="https://github.com/Matysh/houseplan-card" target="_blank" rel="noopener">
            <ha-icon icon="mdi:github"></ha-icon>${this._t('gs.about_github')}</a>
          <a class="aboutlink" href="https://t.me/ha_houseplan" target="_blank" rel="noopener">
            <ha-icon icon="mdi:send"></ha-icon>${this._t('gs.about_telegram')}</a>
        </div>
        <div class="row">
          <button class="btn ghost" @click=${() =>
            (this._settingsDialog = { ...this._settingsDialog!, colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: this._imperial ? 9.8 : 3, bgColor: null, northDeg: null, bgMode: 'static', sunRays: false, weatherEntity: '' })}>
            ${this._t('gs.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._settingsDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveSettingsDialog} ?disabled=${this._settingsDialog!.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this._settingsDialog!.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
      </div>
    </div>`;
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
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog wide" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this._t('rules.title')}</div>
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
        <div class="row">
          <button class="btn ghost" @click=${() => this._rulesSet(DEFAULT_ICON_RULES.map((r) => ({ ...r })))}>
            ${this._t('rules.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._rulesDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveRules} ?disabled=${d.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
      </div>
    </div>`;
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
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._kioskDialog = false)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:tablet"></ha-icon>${this._t('kiosk.title')}</div>
        <div class="body">
          <div class="rhint">${this._t('kiosk.hint')}</div>
          ${row('icon', this._t('kiosk.icon_scale'))}
          ${row('font', this._t('kiosk.font_scale'))}
        </div>
        <div class="row">
          <button class="btn ghost" @click=${() => this._saveKioskScale({ icon: 1, font: 1 })}>${this._t('gs.reset')}</button>
          <span class="spacer"></span>
          <button class="btn on" @click=${() => (this._kioskDialog = false)}>${this._t('btn.close')}</button>
        </div>
      </div>
    </div>`;
  }

  // ================= render =================

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const model = this._model;
    if (!model.length) {
      return html`<ha-card>
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
        ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
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

    return html`
      <ha-card>
        <div class="hdr ${this._kiosk ? 'kioskhide' : ''}">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title || this._t('card.title')}
          </div>
          <div class="tabs">
            ${model.map(
              (s) => html`<button
                class="tab ${this._space === s.id ? 'active' : ''}"
                @click=${() => {
                  this._space = s.id;
                  this._selId = null;
                  this._navApplied = true;
                  this._showFar = false; // the hint is per space (docs/CANVAS.md §4.1)
                  this._frame = null;
                  this._restoreZoom();
                  this._saveNav();
                }}
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
            ${this._norm && this._mode === 'plan'
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
        ${this._markup ? this._renderMarkupBar() : this._mode === 'devices' ? this._renderDevicesBar() : this._mode === 'decor' ? this._renderDecorBar() : nothing}
        </div>

        <div class="stage ${this._markup ? 'markup tool-' + this._tool + (this._tool === 'split' && !this._splitSel ? ' pickstage' : '') + (this._tool === 'openwall' && this._openWallHover ? ' wallhot' : '') : ''} ${this._mode === 'decor' ? 'dtool-' + this._decorTool : ''} ${space.bg ? '' : 'noplan'} mode-${this._mode}${this._bdMovable ? ' bdgrab' : ''}${this._bdDrag ? ' bdgrabbing' : ''}${dayNight ? ' daynight' : ''}${dayNight && this._skySnap ? ' skysnap' : ''}${this._booting ? ' hpboot' : ''}${this._bootSoft ? ' hpsettle' : ''}"
          style="height:${this._kiosk ? '100dvh' : `calc(100dvh - ${this._hdrH}px)`}${stageBg ? `;background:${stageBg}` : ''}"
          @click=${(e: MouseEvent) => this._markupClick(e)}
          @wheel=${(e: WheelEvent) => this._onWheel(e)}
          @pointerdown=${(e: PointerEvent) => { this._notePointer(e); this._stagePointerDown(e); }}
          @pointermove=${(e: PointerEvent) => this._stagePointerMove(e)}
          @pointerup=${(e: PointerEvent) => this._stagePointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._stagePointerUp(e)}>
          <div class="zoomwrap ${this._slide ? 'slide-' + this._slide : ''}"
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
            ${svg`<g class="hp-paperg">${paperRoomShapes(space.rooms).map((sh) =>
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
              ? svg`<image href="${this._display(space.bg.href)}" x="${space.bg.x}" y="${space.bg.y}" width="${space.bg.w}" height="${space.bg.h}" preserveAspectRatio="none" />`
              : nothing}
            ${this._renderDecorLayer()}
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
              return space.rooms.filter((r) => r.area || this._markup || disp.showBorders).map((r) => {
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
                  : r.area
                  ? roomFillStyle(
                      effFill,
                      effFill === 'lqi' ? this._roomLqi(r.area) : null,
                      effFill === 'light' ? areaLights(this.hass, this._devices, r.area) : 'none',
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
              const tip = (e: MouseEvent) =>
                this._showTip(e, r.name, '',
                  showLqi ? this._roomLqi(r.area) : null,
                  this._roomTemp(r));
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
              if (openCuts.length) cls += ' noedge';
              // island rooms punch holes in their parent's fill (evenodd)
              const myPoly = polyOf(r);
              const holes = myPoly ? islandsOf(myPoly, otherPolys(r)) : [];
              const pathD = (pts: number[][]) =>
                'M ' + pts.map((p) => p[0] + ' ' + p[1]).join(' L ') + ' Z';
              const shape = holes.length && myPoly
                ? svg`<path class="${cls}" style="${style}" fill-rule="evenodd"
                    d="${[myPoly, ...holes].map(pathD).join(' ')}"
                    @mousemove=${tip}
                    @mouseleave=${() => (this._tip = null)}></path>`
                : r.poly
                ? svg`<polygon class="${cls}" style="${style}" points="${r.poly.map((p) => p.join(',')).join(' ')}"
                    @mousemove=${tip}
                    @mouseleave=${() => (this._tip = null)}></polygon>`
                : svg`<rect class="${cls}" style="${style}"
                    x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w!, r.h!) * 0.03}"
                    @mousemove=${tip}
                    @mouseleave=${() => (this._tip = null)}></rect>`;
              const trimmed = openCuts.length && myPoly
                ? outlineWithout(myPoly, openCuts, this._gridPitch * 0.02)
                : null;
              const outline = trimmed
                ? svg`<path class="room-outline ${this._markup ? 'outlined' : ''}"
                    d="${trimmed.map((sg) => `M ${sg[0]} ${sg[1]} L ${sg[2]} ${sg[3]}`).join(' ')}"
                    style=${this._markup ? nothing : `stroke:${disp.color};stroke-opacity:${disp.showBorders ? disp.opacity : 0}`}></path>`
                : nothing;
              return svg`${shape}${outline}${label ? svg`<text class="rlabel" x="${c[0]}" y="${c[1]}">${r.name}</text>` : nothing}`;
              });
            })()}
            ${disp.fill === 'glow' && !this._markup ? this._renderGlowLayer(space) : nothing}
            ${this._renderSunRays(space)}
            ${this._renderOpenWalls(disp)}
            ${this._editing ? this._renderAlignGuides() : nothing}
            ${opMeasure?.guide ? this._renderOpeningCenterTick(opMeasure.guide) : nothing}
            ${this._markup ? this._renderMarkupLayer(vb) : nothing}
            ${this._renderOpenings(disp)}
            ${this._markup && this._tool === 'resize' ? this._renderResizeLayer(view) : nothing}
            ${''/* editor chrome, not plan content: the backdrop frame sits on
                   top of everything the plan draws so its handles stay
                   grabbable (docs/BACKDROP.md §2). It exists only in the
                   backdrop editor, where rooms and devices are pointer-inert. */}
            ${this._renderBackdropFrame(view)}
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
            ${devs.map((d) => this._renderDevice(d, view, showLqi, disp.fill === 'glow' && !this._markup))}
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
          ${decorMeasure
            ? html`<div class="measurelayer"><div
                class="measurelabel dmeasure ${decorMeasure.on45 ? 'on45' : ''}"
                style="left:${(((decorMeasure.x - view.x) / view.w) * 100).toFixed(2)}%;top:${(((decorMeasure.y - view.y) / view.h) * 100).toFixed(2)}%">${decorMeasure.text}</div></div>`
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
        ${this._openingInfo ? this._renderOpeningInfoCard() : nothing}
        ${this._decorTextDialog ? this._renderDecorTextDialog() : nothing}
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
          ? html`<div class="menuwrap dialogwrap" @click=${() => (this._tapConfirm = null)}>
              <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
                <div class="body"><p>${this._tapConfirm.text}</p></div>
                <div class="row">
                  <span class="spacer"></span>
                  <button class="btn ghost" @click=${() => (this._tapConfirm = null)}>${this._t('btn.cancel')}</button>
                  <button class="btn on" @click=${() => { const c = this._tapConfirm!; this._tapConfirm = null; c.exec(); }}>
                    <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.run')}
                  </button>
                </div>
              </div>
            </div>`
          : nothing}
        ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
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

  /**
   * Motion-flash bookkeeping, one pass per hass tick (the _vacTick pattern):
   * remembers each motion marker's last primary state and stamps flashTs on
   * an off→on transition. Only a WITNESSED 'off' → 'on' step counts — a
   * sensor first seen already 'on' (page load mid cool-down) or coming back
   * from 'unavailable' is a reconnect, not a fresh detection, and must not
   * flash. Each stamp (re)arms ONE setTimeout that calls requestUpdate when
   * the ~3.3s window closes, so _stateClass drops 'senseflash' even though
   * no new hass tick arrives; disconnectedCallback clears the timers.
   */
  private _senseTick(): void {
    if (!this.hass) return;
    for (const d of this._devices) {
      if (d.hidden || !d.primary || !d.primary.startsWith('binary_sensor.')) continue;
      const p = this.hass.states[d.primary];
      if (p?.attributes?.device_class !== 'motion') continue;
      const rt = this._senseRt.get(d.id);
      if (!rt) { this._senseRt.set(d.id, { last: p.state, flashTs: 0, timer: 0, gen: 0 }); continue; }
      if (p.state === 'on' && rt.last === 'off') {
        rt.flashTs = Date.now();
        // HP-1543-02: a retrip BEFORE the previous flash finished kept the
        // same 'senseflash' class and the same animation-name on the same
        // pseudo-element — browsers never restart such a CSS animation, so
        // the second detection played nothing once the first one-shot had
        // ended (base opacity 0). Every trip bumps the generation;
        // _stateClass maps its parity to alternating keyframe names
        // (hp-sense / hp-sense-b in styles.ts), which is a NEW animation
        // identity and forces a fresh timeline per detection. No class is
        // ever removed mid-flash, so a lone first flash still plays whole.
        rt.gen++;
        clearTimeout(rt.timer);
        rt.timer = window.setTimeout(() => this.requestUpdate(), SENSE_FLASH_MS + 60);
      }
      rt.last = p.state;
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
      const r = view.w * 0.022; // finger-sized: these are grabbed on tablets
      for (const [hx, hy, ox2, oy2] of [[x0, y0, x1, y1], [x1, y0, x0, y1], [x1, y1, x0, y0], [x0, y1, x1, y0]] as number[][]) {
        const fixed = inv(ox2, oy2);
        handles.push(svg`<circle class="vacfithandle" data-corner="${fixed[0] + ',' + fixed[1]}"
          cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}"></circle>`);
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

  private _renderDevice(d: DevItem, view: { x: number; y: number; w: number; h: number }, showLqi = true, glowFill = false): TemplateResult {
    const p = this._pos(d);
    const left = ((p.x - view.x) / view.w) * 100;
    const top = ((p.y - view.y) / view.h) * 100;
    // a ghost is configuration, not status: no yellow, no open, no unavail —
    // and no live numbers either (HP-1510-02): no value text, no temperature,
    // no humidity, no LQI badge, no state-morphed icon. The base icon and the
    // name stay — enough to recognise the device and open its dialog.
    // The owner's rule for LIGHT SOURCES (2026-07-29): where the glow layer
    // is VISIBLE, the indicator IS the glow spot — the badge stays standard,
    // on or off; wherever the spot is not drawn (other fills, the plan
    // editor) a lit source goes plain yellow like a heating TRV. The gate
    // must equal the layer's visibility, or a mode ends up with neither
    // indicator (HP-1520-01). "Source" is exactly the litLightEntity
    // condition that casts the spot, so a lit socket keeps its yellow.
    let cls = d.hidden ? '' : this._stateClass(d);
    if (glowFill && cls === 'on' && litLightEntity(this.hass, d)) cls = '';
    const temp = d.hidden ? null : this._liveTemp(d);
    const hum = d.hidden ? null : this._liveHum(d);
    const lqi = showLqi && !d.virtual && !d.hidden ? lqiFor(this.hass, d.entities) : null;
    const m = d.marker;
    const disp = m?.display || 'badge';
    // a ghost drops the ripple presentation entirely (HP-1511-02): an
    // icon-less pulse is unrecognisable, and the release contract says a
    // ghost keeps the base icon and name — display modes are status dressing
    const ripple = (disp === 'ripple' || disp === 'icon_ripple') && !d.hidden;
    // value-only display: the measurement IS the marker
    // The state the marker PRESENTS — the primary one, or the device's cover
    // when the marker is explicitly «Open/close» (_coverIndicator): the badge,
    // the icon morph and the ripple all read the same entity the tap drives.
    const actEid = this._actEntity(d);
    const primarySt = actEid ? this.hass.states[actEid] : undefined;
    const valText = disp === 'value' && !d.hidden
      ? (temp != null ? temp + '°'
        : hum != null ? hum + '%'
        : primarySt && !isNaN(parseFloat(primarySt.state))
          ? parseFloat(primarySt.state) + (primarySt.attributes?.unit_of_measurement ? ' ' + primarySt.attributes.unit_of_measurement : '')
          : null)
      : null;
    // live state variants of the auto icon (doors, locks, bulbs), like core HA
    const domain = actEid ? actEid.split('.')[0] : null;
    const icon = this._config?.live_states && !d.hidden
      ? stateIcon(d.icon, domain, primarySt?.attributes?.device_class, primarySt?.state, !!m?.icon)
      : d.icon;
    // v1.52.0: a lamp's colour lives in its GLOW and in the ripple fallback
    // only — the icon/border tint is gone. lightC is still computed (from the
    // marker's first lit RGB target, else the primary light) purely to feed
    // --ripple-color when no explicit ripple colour is set.
    const ctrl = (m?.controls || []).filter(isControllable);
    const lightC = this._config?.live_states && !d.hidden
      ? ctrl.length
        ? ctrl.map((e) => lightColorOf(this.hass.states[e])).find((v) => v) || null
        : domain === 'light' ? lightColorOf(primarySt) : null
      : null;
    // emergencies (leak/smoke/gas/CO/siren) pulse red regardless of display mode
    const alarm = this._config?.live_states && !d.hidden
      && isAlarmState(domain, primarySt?.attributes?.device_class, primarySt?.state);
    const active = ripple && !d.hidden && !!actEid && isActiveState(this.hass.states[actEid]?.state);
    const scale = Number(m?.size) > 0 ? Number(m!.size) : 1;
    const angle = Number(m?.angle) || 0;
    const rScale = Number(m?.ripple_size) > 0 ? Number(m!.ripple_size) : 3;
    const st = [`left:${left}%`, `top:${top}%`];
    if (scale !== 1) st.push(`--dev-scale:${scale}`);
    if (ripple) {
      st.push(`--ripple-scale:${rScale}`);
      if (m?.ripple_color) st.push(`--ripple-color:${m.ripple_color}`);
      else if (lightC) st.push(`--ripple-color:${lightC}`);
    }

    return html`<div
      class="dev ${cls} ${this._selId === d.id ? 'sel' : ''} ${d.virtual ? 'virtual' : ''} ${d.hidden ? 'ghost' : ''} ${disp === 'ripple' && !d.hidden ? 'noicon' : ''} ${valText != null ? 'valonly' : ''} ${alarm ? 'alarm' : ''}"
      style="${st.join(';')}"
      @click=${(e: MouseEvent) => this._clickDevice(e, d)}
      @contextmenu=${(e: MouseEvent) => this._ctxDevice(e, d)}
      @mousemove=${(e: MouseEvent) =>
        this._showTip(e, d.name,
          d.model + (temp != null ? ' · ' + temp + '°' : '') + (hum != null ? ' · ' + hum + '%' : '') + (lqi != null ? ' · LQI ' + lqi : ''))}
      @mouseleave=${() => (this._tip = null)}
      @pointerdown=${(e: PointerEvent) => this._pointerDown(e, d)}
      @pointermove=${(e: PointerEvent) => this._pointerMove(e, d)}
      @pointerup=${(e: PointerEvent) => this._pointerUp(e, d)}
      @pointercancel=${(e: PointerEvent) => this._pointerUp(e, d)}
    >
      ${ripple
        ? html`<span class="ripple ${active ? 'active' : ''}"><i></i><i></i><i></i></span>`
        : nothing}
      ${this._newIds.has(d.id) ? html`<span class="newdot" title=${this._t('device.new')}></span>` : nothing}
      ${valText != null
        ? html`<span class="valtext">${valText}</span>`
        : disp !== 'ripple' || d.hidden
          ? html`<ha-icon icon="${icon}" style=${angle ? `transform:rotate(${angle}deg)` : nothing}></ha-icon>`
          : nothing}
      ${temp != null && valText == null ? html`<span class="tval">${temp}°</span>` : nothing}
      ${hum != null && valText == null ? html`<span class="hval">${hum}%</span>` : nothing}
      ${lqi != null ? html`<span class="lqi" style="color:${lqiColor(lqi)}">${lqi}</span>` : nothing}
    </div>`;
  }

  /** Room temperature honouring the tier-3 source override. */
  private _roomTemp(r: RoomCfg): number | null {
    const src = r.settings?.temp_source;
    if (src) return sourceValue(this.hass, src, 'temp');
    // every sensor of the area, placed on the plan or not (field report)
    return r.area ? this._climate().get(r.area)?.temp ?? null : null;
  }

  /** Room humidity honouring the tier-3 source override. */
  private _roomHum(r: RoomCfg): number | null {
    const src = r.settings?.hum_source;
    if (src) return sourceValue(this.hass, src, 'hum');
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
    const c = this._climateCache;
    if (c && c.h === this.hass && c.r === this._iconRules && c.mk === mk) return c.m;
    const m = areaClimateMap(this.hass, this._iconRules, mk);
    this._climateCache = { h: this.hass, r: this._iconRules, mk, m };
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
    const h = this.hass;
    const q = this._roomSrcFilter.trim().toLowerCase();
    const list: { value: string; label: string; sub: string }[] = [];
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.entry_type === 'service') continue;
      const name = (dev.name_by_user || dev.name || dev.id).trim();
      if (q && !name.toLowerCase().includes(q)) continue;
      list.push({ value: 'device:' + dev.id, label: name, sub: dev.model || this._t('marker.sub_device') });
    }
    for (const [eid, reg] of Object.entries<any>(h.entities)) {
      if (!eid.startsWith('sensor.') || reg.hidden) continue;
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
    if (k === 'device') return this.hass.devices[ref]?.name_by_user || this.hass.devices[ref]?.name || ref;
    return this.hass.entities[ref]?.name || this.hass.states[ref]?.attributes?.friendly_name || ref;
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
    this._savePos({ id, space: spaceId } as DevItem, nx, ny, ev.shiftKey);
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
    // optional metrics row (needs an HA area; sub-area rooms show the name only)
    const rows: TemplateResult[] = [];
    if (r.area || r.settings?.temp_source || r.settings?.hum_source) {
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
      if (disp.labelLight && r.area) {
        const ls = areaLightStats(this.hass, this._devices, r.area);
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
    if (this._tool === 'draw' && this._path.length && !this._contourClosed)
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
   * Rectangles and ellipses have no "length", but they do have a size, and
   * the same two calls answer it: «W × H» of the bounding box. A draft that
   * has not moved yet (the pointerdown before the drag) shows nothing —
   * a «0» badge under the cursor is noise, not a measurement.
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
    return { x, y, on45: false,
      text: `${this._fmtLen([ax, ay], [bx, ay])} × ${this._fmtLen([bx, ay], [bx, by])}` };
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
        if (d.space !== this._space || d.id === this._drag?.id) continue;
        const p = this._pos(d);
        out.push([p.x, p.y]);
      }
      return out;
    }
    if (this._mode === 'decor') {
      const W = NORM_W, H = this._decorH;
      const movingId = this._decorMove?.id;
      for (const sh of this._decorList) {
        if (sh.id === movingId) continue;
        if (sh.kind === 'line') { out.push([sh.x1 * W, sh.y1 * H], [sh.x2 * W, sh.y2 * H]); }
        else if (sh.kind === 'text') out.push([sh.x * W, sh.y * H]);
        else {
          out.push([sh.x * W, sh.y * H], [(sh.x + sh.w) * W, sh.y * H],
            [sh.x * W, (sh.y + sh.h) * H], [(sh.x + sh.w) * W, (sh.y + sh.h) * H]);
        }
      }
      if (this._decorDraft) out.push(this._decorDraft.a);
      for (const r of spm.rooms) {
        const poly = roomPoly(r);
        if (poly) for (const p of poly) out.push(p);
      }
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
    const st = o.contact ? this.hass.states[o.contact]?.state : null;
    return openingAmount(o.type, st, !!o.invert);
  }

  /**
   * Doors and windows, drawn in plan (SVG) coordinates so they scale and pan with
   * the plan. Symbol geometry after easy-floorplan (MIT): jambs, a leaf that swings
   * around its hinge, and a quarter-circle arc that "draws on" via stroke-dashoffset.
   */
  private _renderOpenings(disp: SpaceDisplay): TemplateResult {
    const items = this._openingsR;
    if (!items.length) return svg``;
    const base = disp.color;
    return svg`${items.map((o) => {
      const half = o.rlen / 2;
      const amt = this._openingAmt(o);
      const active = amt > 0 && !!o.contact;
      const tone = active ? 'var(--hp-open)' : base;
      const jamb = 8;
      const sx = o.flip_h ? -1 : 1;
      const sy = o.flip_v ? -1 : 1;
      let body;
      if (o.type === 'window') {
        // two casement leaves hinged at the jambs, meeting in the middle
        const arcLen = (Math.PI / 2) * half;
        body = svg`
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
          </g>`;
      } else {
        // door leaf hinged at the left jamb, swinging up; arc from tip to tip
        const L = o.rlen;
        const arcLen = (Math.PI / 2) * L;
        body = svg`
          <path class="op-arc" d="M ${half} 0 A ${L} ${L} 0 0 0 ${-half} ${-L}" fill="none"
            stroke="${tone}" stroke-dasharray="${arcLen}" stroke-dashoffset="${arcLen * (1 - amt)}"></path>
          <g transform="translate(${-half} 0)">
            <g class="op-leaf" style="transform:rotate(${-90 * amt}deg)">
              <rect x="0" y="-1.75" width="${L}" height="3.5" fill="${tone}"></rect>
            </g>
          </g>`;
      }
      return svg`<g class="opening" transform="translate(${o.rx} ${o.ry}) rotate(${o.angle})">
        <g transform="scale(${sx} ${sy})">
          <line x1="${-half}" y1="${-jamb / 2}" x2="${-half}" y2="${jamb / 2}" stroke="${base}" stroke-width="2.5"></line>
          <line x1="${half}" y1="${-jamb / 2}" x2="${half}" y2="${jamb / 2}" stroke="${base}" stroke-width="2.5"></line>
          ${body}
        </g>
        <rect class="op-outline" x="${-half - 10}" y="-16" width="${o.rlen + 20}" height="32" rx="6"></rect>
        <rect class="op-hit" x="${-half - 12}" y="-20" width="${o.rlen + 24}" height="40"
          @click=${(e: MouseEvent) => this._opClick(e, o)}
          @pointerdown=${(e: PointerEvent) => this._opPointerDown(e, o)}
          @pointermove=${(e: PointerEvent) => this._opPointerMove(e, o)}
          @pointerup=${(e: PointerEvent) => this._opPointerUp(e, o)}
          @pointercancel=${(e: PointerEvent) => this._opPointerUp(e, o)}></rect>
      </g>`;
    })}`;
  }

  /** Padlock badges for doors with a lock entity (HTML, so ha-icon just works). */
  private _renderOpeningLocks(view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const items = this._openingsR.filter((o) => o.type === 'door' && o.lock);
    if (!items.length) return html``;
    return html`${items.map((o) => {
      const st = this.hass.states[o.lock!]?.state;
      const locked = st === 'locked';
      const known = locked || ['unlocked', 'open', 'opening', 'unlocking', 'locking'].includes(String(st));
      // perpendicular offset from the opening center, away from the swing side
      const rad = ((o.angle + 90) * Math.PI) / 180;
      const off = 16 * (o.flip_v ? -1 : 1);
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
    if (action === 'unlock') {
      const name = this.hass?.states?.[entityId]?.attributes?.friendly_name || entityId;
      if (!confirm(this._t('confirm.unlock', { name }))) return;
    }
    this.hass?.callService?.('lock', action, { entity_id: entityId });
  }

  private _renderOpeningInfoCard(): TemplateResult {
    const o = this._openingInfo!;
    const cSt = o.contact ? this.hass.states[o.contact]?.state : null;
    const amt = this._openingAmt(o);
    const lSt = o.lock ? this.hass.states[o.lock]?.state : null;
    const row = (icon: string, label: string, value: string, cls = '') =>
      html`<div class="oprow ${cls}"><ha-icon icon=${icon}></ha-icon><span>${label}</span><b>${value}</b></div>`;
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._openingInfo = null)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon=${o.type === 'door' ? 'mdi:door' : 'mdi:window-closed-variant'}></ha-icon>
          ${this._t(o.type === 'door' ? 'opening.door' : 'opening.window')}</div>
        <div class="body">
          ${o.contact
            ? row(amt > 0 ? 'mdi:door-open' : 'mdi:door-closed',
                this._t('opening.contact_label'),
                cSt === 'unavailable' || cSt == null
                  ? this._t('opening.state_unknown')
                  : this._t(amt > 0 ? 'opening.open' : 'opening.closed'),
                amt > 0 ? 'warn' : 'ok')
            : nothing}
          ${o.lock
            ? row(lSt === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant',
                this._t('opening.lock_label'),
                lSt === 'locked' ? this._t('opening.locked')
                  : ['unlocked', 'open'].includes(String(lSt)) ? this._t('opening.unlocked')
                  : this._t('opening.state_unknown'),
                lSt === 'locked' ? 'ok' : 'warn')
            : nothing}
          ${o.lock && (lSt === 'locked' || ['unlocked', 'open'].includes(String(lSt)))
            ? html`<button
                class="btn lockact ${lSt === 'locked' ? 'warn' : ''}"
                @click=${() => this._lockAction(o.lock!, lSt === 'locked' ? 'unlock' : 'lock')}>
                <ha-icon icon=${lSt === 'locked' ? 'mdi:lock-open-variant' : 'mdi:lock'}></ha-icon>
                ${this._t(lSt === 'locked' ? 'opening.unlock_action' : 'opening.lock_action')}
              </button>`
            : o.lock && ['locking', 'unlocking'].includes(String(lSt))
              ? html`<button class="btn lockact" disabled>
                  <ha-icon icon="mdi:timer-sand"></ha-icon>${this._t('opening.lock_pending')}
                </button>`
              : nothing}
          ${!o.contact && !o.lock ? html`<p class="muted">${this._t('opening.no_entities')}</p>` : nothing}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._openingInfo = null)}>${this._t('btn.close')}</button>
        </div>
      </div>
    </div>`;
  }

  private _renderOpeningDialog(): TemplateResult {
    const d = this._openingDialog!;
    const opt = (list: { value: string; label: string }[], cur: string, set: (v: string) => void) =>
      html`<select class="areasel" @change=${(e: Event) => set((e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!cur}>${this._t('opening.none')}</option>
        ${list.map((c) => html`<option value=${c.value} ?selected=${c.value === cur}>${c.label}</option>`)}
      </select>`;
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:door"></ha-icon>
          ${d.id ? this._t('opening.edit') : this._t('opening.new')}</div>
        <div class="body">
          <label>${this._t('opening.type_label')}</label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'door'}
            @change=${() => (this._openingDialog = { ...d, type: 'door', lengthCm: d.id ? d.lengthCm : 90 })} />
            <span>${this._t('opening.door')}</span></label>
          <label class="srcrow"><input type="radio" name="optype" .checked=${d.type === 'window'}
            @change=${() => (this._openingDialog = { ...d, type: 'window', lengthCm: d.id ? d.lengthCm : 120 })} />
            <span>${this._t('opening.window')}</span></label>

          <label>${this._t('opening.length_label')}</label>
          <input class="namein tempin" type="number" min="20" max="600" step="5" .value=${String(d.lengthCm)}
            @input=${(e: Event) => {
              const n = parseFloat((e.target as HTMLInputElement).value);
              if (Number.isFinite(n)) this._openingDialog = { ...d, lengthCm: n };
            }} />

          <label>${this._t('opening.contact_label')}</label>
          ${opt(this._contactCandidates(), d.contact, (v) => (this._openingDialog = { ...d, contact: v }))}
          ${d.contact
            ? html`<label class="srcrow">${this._boolInput(d.invert, (v) => (this._openingDialog = { ...d, invert: v }))}
                <span>${this._t('opening.invert')}</span></label>`
            : nothing}

          ${d.type === 'door'
            ? html`<label>${this._t('opening.lock_label')}</label>
                ${opt(this._lockCandidates(), d.lock, (v) => (this._openingDialog = { ...d, lock: v }))}`
            : nothing}

          <label class="srcrow">${this._boolInput(d.flipH, (v) => (this._openingDialog = { ...d, flipH: v }))}
            <span>${this._t('opening.flip_h')}</span></label>
          <label class="srcrow">${this._boolInput(d.flipV, (v) => (this._openingDialog = { ...d, flipV: v }))}
            <span>${this._t('opening.flip_v')}</span></label>
        </div>
        <div class="row">
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
      </div>
    </div>`;
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

  private _renderMarkupLayer(vb: number[]): TemplateResult {
    // derived walls minus the open stretches — those are drawn dashed on top
    const openCuts = this._openPairs().flatMap((p) => p.segs);
    const segs = openCuts.length
      ? cutSegments(this._segments, openCuts, this._gridPitch * 0.02)
      : this._segments;
    const path = this._path;
    const g = this._gridPitch;
    const view = this._viewOr(this._baseVb());
    return svg`
      ${this._gridLevels()
        ? svg`<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" fill="url(#hp-grid-major)" pointer-events="none"></rect>`
        : nothing}
      ${segs.map((s) => svg`<line class="seg" x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}"></line>`)}
      ${path.length > 1
        ? svg`<polyline class="pathline" points="${path.map((p) => p.join(',')).join(' ')}"></polyline>`
        : nothing}
      ${path.length && this._cursorPt && this._tool === 'draw' && !this._contourClosed
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

  private _renderMarkupBar(): TemplateResult {
    return html`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <button class="btn ${this._tool === 'draw' ? 'on' : ''}" @click=${() => (this._tool = 'draw')}
        title=${this._t('title.markup_add')}>
        <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>${this._t('markup.add')}
      </button>
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
      <button class="btn ${this._tool === 'openwall' ? 'on' : ''}"
        @click=${() => { this._cancelPath(); this._tool = 'openwall'; }}
        title=${this._t('title.markup_openwall')}>
        <ha-icon icon="mdi:border-none-variant"></ha-icon>${this._t('markup.openwall')}
      </button>
      <button class="btn ${this._tool === 'delroom' ? 'on' : ''}" @click=${() => (this._tool = 'delroom')}
        title=${this._t('title.markup_delroom')}>
        <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('markup.delete')}
      </button>
      <span class="spacer"></span>
      ${this._tool === 'draw'
        ? html`<span class="hint">${this._path.length
              ? this._t('markup.hint_points', { n: this._path.length })
              : this._t('markup.hint_start')}</span>
            ${this._path.length ? html`<button class="btn ghost" @click=${this._cancelPath}>${this._t('btn.reset')}</button>` : nothing}`
        : nothing}
      ${this._tool === 'resize' ? html`<span class="hint">${this._t('markup.hint_resize')}</span>` : nothing}
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
    const h = this.hass;
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
    for (const e of d.marker?.controls || []) push(e);
    if (d.primary) push(d.primary);
    for (const e of d.entities) push(e);
    return out.slice(0, 12);
  }

  /** Toggle straight from the device card (safe domains only). */
  private _cardToggle(eid: string): void {
    const dom = eid.split('.')[0];
    if (dom === 'lock' || dom === 'alarm_control_panel') return; // never from a card tap
    this.hass
      .callService('homeassistant', 'toggle', { entity_id: eid })
      .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
  }

  private _renderInfoCard(): TemplateResult {
    const d = this._infoCard!;
    const st = d.primary ? this.hass.states[d.primary] : undefined;
    const stateTxt = st ? this.hass.formatEntityState?.(st) ?? st.state : null;
    const controls = (d.marker?.controls || []).filter(isControllable);
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._infoCard = null)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="${d.icon}"></ha-icon>${d.name}</div>
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
                const val = est ? this.hass.formatEntityState?.(est) ?? est.state : '';
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
        <div class="row">
          <button class="btn" @click=${() => { const dd = d; this._infoCard = null; this._openMarkerDialog(dd); }}>
            <ha-icon icon="mdi:pencil"></ha-icon>${this._t('btn.edit')}
          </button>
          ${d.primary
            ? html`<button class="btn" @click=${() => { const p = d.primary; this._infoCard = null; this._openMoreInfo(p); }}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t('btn.open_in_ha')}
              </button>`
            : nothing}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._infoCard = null)}>${this._t('btn.close')}</button>
        </div>
      </div>
    </div>`;
  }

  private _renderMarkerDialog(): TemplateResult {
    const d = this._markerDialog!;
    const isVirtual = d.bindingMode === 'virtual';
    const cands = this._bindingCandidates();
    const curLabel = (() => {
      if (isVirtual) return null;
      const found = cands.find((c) => c.value === d.binding);
      if (found) return found.label;
      const [k, ref] = d.binding.split(':');
      if (k === 'device') return this.hass.devices[ref]?.name_by_user || this.hass.devices[ref]?.name || ref;
      return this.hass.states[ref]?.attributes?.friendly_name || ref;
    })();
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog wide" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:shape-plus"></ha-icon>
          ${d.devId ? this._t('info.device_header') : this._t('marker.new_device')}</div>
        <div class="body">
          <label>${this._t('marker.name_label')}</label>
          <input class="namein" type="text" placeholder=${this._t('marker.name_ph')}
            .value=${d.name}
            @input=${(e: Event) => (this._markerDialog = { ...d, name: (e.target as HTMLInputElement).value })} />

          <label>${this._t('marker.binding_label')}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${d.bindingMode === 'virtual'}
                @change=${() => (this._markerDialog = { ...d, bindingMode: 'virtual', binding: 'virtual', bindingOpen: false })} />
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
                      ? html`<b>${curLabel}</b><span class="ref">${d.binding}</span>`
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
                              @click=${() => (this._markerDialog = { ...d, binding: c.value, bindingOpen: false })}>
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
                  .filter((eid) => isControllable(eid) && !d.controls.includes(eid))
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
          <label class="srcrow" title=${this._t('marker.hide_tip')}>
            ${this._boolInput(d.hideFromPlan, (v) => (this._markerDialog = { ...d, hideFromPlan: v }))}
            <span>${this._t('marker.hide')}</span>
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
            ? html`<ha-icon-picker .hass=${this.hass} .value=${d.icon}
                .placeholder=${d.autoIcon || undefined}
                .fallbackPath=${undefined}
                @value-changed=${(e: any) => (this._markerDialog = { ...d, icon: e.detail.value || '' })}></ha-icon-picker>`
            : html`<input class="namein" type="text"
                placeholder=${d.autoIcon || this._t('marker.icon_ph')}
                .value=${d.icon}
                @input=${(e: Event) => (this._markerDialog = { ...d, icon: (e.target as HTMLInputElement).value })} />`}
          ${!d.icon && d.autoIcon
            ? html`<p class="muted iconauto"><ha-icon icon=${d.autoIcon}></ha-icon>
                ${this._t('marker.icon_auto', { icon: d.autoIcon })}</p>`
            : nothing}

          <label>${this._t('marker.display_label')}</label>
          <select class="areasel"
            @change=${(e: Event) => (this._markerDialog = { ...d, display: (e.target as HTMLSelectElement).value as any })}>
            ${DISPLAY_MODES.map((v) => [v, 'display.' + v] as const).map(
              ([v, k]) => html`<option value=${v} ?selected=${d.display === v}>${this._t(k as any)}</option>`,
            )}
          </select>
          ${d.display === 'ripple' || d.display === 'icon_ripple'
            ? html`<div class="colorrow">
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
        <div class="row">
          ${d.devId && d.binding === 'virtual'
            ? html`<button class="btn danger" @click=${this._deleteMarker}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.remove')}
              </button>`
            : nothing}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._markerDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveMarker}
            ?disabled=${d.busy || (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual'))}
            title=${d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual') ? this._t('marker.pick_ph') : ''}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
      </div>
    </div>`;
  }

  private _renderSpaceDialog(): TemplateResult {
    const d = this._spaceDialog!;
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog wide" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>
          ${d.mode === 'create' ? this._t('space.new') : this._t('space.header')}
          ${this._importTotal > 0 && d.mode === 'create'
            ? html`<span class="importprog">${this._t('import.progress', {
                i: this._importTotal - this._importQueue.length,
                n: this._importTotal,
              })}</span>`
            : nothing}</div>
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
            <input class="namein tempin" type="number" min="0.1" step="0.1" .value=${String(d.cellCm)}
              @input=${(e: Event) => {
                const n = parseFloat((e.target as HTMLInputElement).value);
                this._spaceDialog = { ...d, cellCm: Number.isFinite(n) && n > 0 ? n : d.cellCm };
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
                        const n = parseFloat((e.target as HTMLInputElement).value);
                        if (Number.isFinite(n)) this._spaceDialog = { ...d, tempMin: n };
                      }} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMax)}
                      @input=${(e: Event) => {
                        const n = parseFloat((e.target as HTMLInputElement).value);
                        if (Number.isFinite(n)) this._spaceDialog = { ...d, tempMax: n };
                      }} />
                    °C
                  </span>`
                : nothing}
            </label>`,
          )}
        </div>
        <div class="row">
          ${d.mode === 'edit'
            ? html`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>${this._t('btn.delete')}
              </button>`
            : nothing}
          <span class="spacer"></span>
          ${this._importTotal > 0 && d.mode === 'create'
            ? html`<button class="btn ghost" @click=${() => this._skipImport()}>${this._t('btn.skip')}</button>`
            : nothing}
          <button class="btn ghost" @click=${() => { this._spaceDialog = null; this._importQueue = []; this._importTotal = 0; }}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!d.title.trim() || (d.source === 'file' && !(d.planFile || d.planUrl)) || d.busy}
            title=${d.source === 'file' && !(d.planFile || d.planUrl) ? this._t('title.need_plan') : ''}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this._t('btn.save')}
          </button>
        </div>
      </div>
    </div>`;
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
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:vector-union"></ha-icon>${this._t('merge.header')}</div>
        <div class="body">
          <p class="muted">${this._t('merge.hint')}</p>
          <label>${this._t('merge.keep')}</label>
          ${opt(d.aId, 'a')}
          ${opt(d.bId, 'b')}
        </div>
        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._mergeDialog = null)}>${this._t('btn.cancel')}</button>
          <button class="btn on" @click=${this._commitMerge}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
          </button>
        </div>
      </div>
    </div>`;
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
    // the free-areas list must include the edited room's CURRENT area
    const areas = [...this._freeAreas];
    if (edit && this._areaSel && !areas.some((a) => a.area_id === this._areaSel)) {
      const cur = this.hass.areas[this._areaSel];
      if (cur) areas.unshift(cur);
    }
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon=${edit ? 'mdi:cog-outline' : 'mdi:floor-plan'}></ha-icon>
          ${edit ? this._t('room.settings_title') : this._t('room.new')}</div>
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
        <div class="row">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this._t('btn.cancel')}</button>
          <span class="spacer"></span>
          ${edit
            ? html`<button class="btn on" @click=${() => this._saveRoomEdit()} ?disabled=${!this._nameSel.trim()}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
              </button>`
            : html`<button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
                title=${this._t('title.no_area_room')}>
                ${this._t('btn.no_area')}
              </button>
              <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
                title=${!this._areaSel ? this._t('title.choose_area') : ''}>
                <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
              </button>`}
        </div>
      </div>
    </div>`;
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
