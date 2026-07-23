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
  segmentCm, formatLength, roomEdges, roomPoly, pointStrictlyInside, roomsOverlap,
  pointOnBoundary, mergeRooms, splitRoomPath, polygonArea, closestPointOnBoundary, pointStrictlyInside as ptInside, islandsOf, sharedBoundary, openZoneOf, distToSegment, outlineWithout, cutSegments, alignGuides, segmentAngle, is45, type AlignGuide,
  snapToWall, openingAmount,
  averageLqi, fitView, declump, safeUrl, resolveTapAction, floorsOf, type FloorInfo,
  stateIcon, lightColorOf, isAlarmState, parseRoomRef, diffNewDevices, glowColorOf, doorSector, hasRoomBehind, controlsAction, isControllable,
  spaceDisplayOf, roomFillStyle, fillColorsOf, DEFAULT_FILL_COLORS, type FillColors,
  isActiveState, DEFAULT_ROOM_COLOR, DEFAULT_ROOM_OPACITY,
  DEFAULT_TEMP_MIN, DEFAULT_TEMP_MAX, type SpaceDisplay,
} from './logic';
import { buildDevices, lqiFor, tempFor, humFor, isHumEntity, areaLights, areaTemp, areaHum, areaLightStats } from './devices';
import type {
  OpeningCfg,
  RoomCfg, SpaceModel, PdfRef, Marker, ServerConfig, DevItem, CardConfig,
} from './types';
import './editor';
import './space-card';
import { cardStyles } from './styles';
import { langOf, t, type I18nKey } from './i18n';

const CARD_VERSION = '1.40.2';
const LS_KEY = 'houseplan_card_layout_v1';
const LS_CFG = 'houseplan_card_cfg_v1'; // cache of the server config+layout for instant rendering
const LS_ZOOM = 'houseplan_card_zoom_v1';
const LS_NAV = 'houseplan_card_nav_v1'; // last space + editor mode (owner: restore where you were)
const NORM_W = 1000; // width of the render space for normalized configs

const GRID_N = 240; // grid points across the plan width (half the previous step; old nodes are a subset of the new ones, positions are preserved)
type MarkupTool = 'draw' | 'merge' | 'split' | 'opening' | 'openwall' | 'delroom';

const fireEvent = (node: EventTarget, type: string, detail?: unknown) => {
  const ev = new Event(type, { bubbles: true, composed: true }) as any;
  ev.detail = detail ?? {};
  node.dispatchEvent(ev);
};

const navigate = (path: string) => {
  history.pushState(null, '', path);
  fireEvent(window, 'location-changed', { replace: false });
};

const debounce = <T extends (...a: any[]) => void>(fn: T, ms: number) => {
  let t: number | undefined;
  return (...a: Parameters<T>) => {
    clearTimeout(t);
    t = window.setTimeout(() => fn(...a), ms);
  };
};

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
  private _decorTool: 'select' | 'line' | 'rect' | 'ellipse' | 'text' | 'erase' = 'select';
  private _decorStyle: { color: string; width: number; fill: boolean } = { color: '#607d8b', width: 3, fill: false };
  private _decorDraft: { kind: 'line' | 'rect' | 'ellipse'; a: number[]; b: number[]; pid: number } | null = null;
  private _decorMove: { id: string; start: number[]; orig: any; pid: number; moved: boolean } | null = null;
  private _decorSel: string | null = null;
  private _decorTextDialog: { id?: string; x: number; y: number; text: string; size: 's' | 'm' | 'l'; color: string } | null = null;

  /** Edit tabs are offered to admins only (hass.user missing → assume admin). */
  private get _canEdit(): boolean {
    return this._norm && this.hass?.user?.is_admin !== false;
  }

  /** Legacy alias: markup machinery is active exactly in plan mode. */
  /** Any edit mode is active (plan / devices / decor). */
  private get _editing(): boolean {
    return this._mode === 'plan' || this._mode === 'devices' || this._mode === 'decor';
  }

  private get _markup(): boolean {
    return this._mode === 'plan';
  }
  private _tool: MarkupTool = 'draw';
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
  private _opDrag: { id: string; moved: boolean } | null = null;
  private _mergeDialog: { aId: string; bId: string; poly: number[][]; pick: 'a' | 'b' } | null = null;
  private _splitSel: { roomId: string; pts: number[][] } | null = null; // room being cut + the cut path so far
  // a split is applied only when the new room's dialog is confirmed — cancel leaves the room intact
  private _pendingSplit: { roomId: string; mainPoly: number[][]; newPoly: number[][] } | null = null;
  private _areaSel = '';
  private _nameSel = '';
  private _roomDialog = false;
  // plan zoom/pan (zoom is saved per space, locally)
  private _zoom = 1;
  private _view: { x: number; y: number; w: number; h: number } | null = null; // current SVG viewBox (vb coordinates)
  private _zoomBySpace: Record<string, number> = {};
  private _pointers = new Map<number, { x: number; y: number }>();
  private _panStart: { sx: number; sy: number; vx: number; vy: number } | null = null;
  private _pinchStart: { dist: number; zoom: number } | null = null;
  private _suppressClick = false;
  private _roViewport?: ResizeObserver;
  private _onboardingShown = false; // the auto space dialog is shown once per session

  private _rulesDialog: { rules: IconRule[]; test: string; busy: boolean } | null = null;
  private _settingsDialog: { colors: FillColors; glowRadius: number; busy: boolean } | null = null;
  private _importDialog: { floors: (FloorInfo & { checked: boolean })[] } | null = null;
  private _importQueue: string[] = []; // floor titles still to create
  private _importTotal = 0;
  private _rulesCompiledSrc = '';
  private _rulesCompiled: CompiledIconRule[] | undefined;

  private _infoCard: DevItem | null = null;
  private _markerDialog: {
    devId?: string;      // the icon being edited (if any)
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
    tapAction: string;   // '' = the effective default (defaultTap)
    defaultTap: 'info' | 'toggle';
    controls: string[];  // entities this icon toggles as a group
    controlsFilter: string;
    glowRadius: string;  // per-device glow radius in display units; '' = global default
    model: string;
    link: string;
    description: string;
    pdfs: PdfRef[];
    room: string;        // 'space#area' for a virtual one
    busy: boolean;
  } | null = null;
  private _spaceDialog: {
    mode: 'edit' | 'create';
    spaceId?: string;
    title: string;
    planUrl: string | null;
    planFile: { ext: string; b64: string; aspect: number; name: string } | null;
    source: 'file' | 'draw';       // draw = no background image, hand-drawn rooms
    orientation: 'landscape' | 'portrait' | 'square';
    showBorders: boolean;
    showNames: boolean;
    roomColor: string;
    roomOpacity: number;           // 0..1
    fillMode: 'none' | 'lqi' | 'light' | 'temp' | 'glow';
    tempMin: number;
    tempMax: number;
    showLqi: boolean;
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
    _areaSel: { state: true },
    _nameSel: { state: true },
    _roomDialog: { state: true },
    _spaceDialog: { state: true },
    _infoCard: { state: true },
    _rulesDialog: { state: true },
    _settingsDialog: { state: true },
    _importDialog: { state: true },
    _markerDialog: { state: true },
    _zoom: { state: true },
    _view: { state: true },
  };

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._keyHandler);
    window.addEventListener('hashchange', this._onHashChange);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('hashchange', this._onHashChange);
    clearTimeout(this._holdTimer);
    this._roViewport?.disconnect();
    this._roViewport = undefined;
    if (this._unsubCfg) {
      this._unsubCfg();
      this._unsubCfg = null;
    }
    super.disconnectedCallback();
  }

  private _onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      // close the topmost open dialog; info popups first, then editors
      if (this._openingInfo) { this._openingInfo = null; return; }
      if (this._infoCard) { this._infoCard = null; return; }
      if (this._rulesDialog) { this._rulesDialog = null; return; }
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

  public setConfig(config: CardConfig): void {
    this._config = { icon_size: 2.5, show_temperature: true, live_states: true, show_signal: true, ...config };
    if (config.default_floor) this._space = config.default_floor;
    try {
      this._zoomBySpace = JSON.parse(localStorage.getItem(LS_ZOOM) || '{}') || {};
    } catch {
      this._zoomBySpace = {};
    }
    // instant render from cache (stale-while-revalidate): show the plan and icons
    // right away, without waiting for the server response — fresh data will load in the background.
    try {
      const c = JSON.parse(localStorage.getItem(LS_CFG) || 'null');
      if (c && c.config && Array.isArray(c.config.spaces)) {
        this._serverCfg = c.config;
        this._cfgRev = c.rev || 0;
        this._layout = c.layout || {};
        this._serverStorage = true;
        const hs = this._hashSpace();
        const nav = this._savedNav();
        if (hs && this._model.find((sp) => sp.id === hs)) { this._space = hs; this._hashApplied = true; }
        else if (nav?.space && this._model.find((sp) => sp.id === nav.space)) { this._space = nav.space; this._navApplied = true; }
        else if (config.default_floor) this._space = config.default_floor;
        else if (!this._model.find((sp) => sp.id === this._space)) this._space = this._model[0]?.id || this._space;
        // reopenning the tab lands you in the same editor you left (admins only)
        if (nav?.mode && nav.mode !== 'view' && this._canEdit) this._mode = nav.mode;
      }
    } catch {
      /* ignore */
    }
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

  /** Spaces in render units (NORM_W × NORM_W/aspect). */
  private get _model(): SpaceModel[] {
    if (!this._serverCfg) return [];
    return this._serverCfg.spaces.map((s: any) => {
      const H = NORM_W / s.aspect;
      const scale = (r: any) => ({
        id: r.id,
        name: r.name,
        area: r.area ?? null,
        open_to: r.open_to || undefined,
        x: r.x != null ? r.x * NORM_W : undefined,
        y: r.y != null ? r.y * H : undefined,
        w: r.w != null ? r.w * NORM_W : undefined,
        h: r.h != null ? r.h * H : undefined,
        poly: r.poly ? r.poly.map((p: number[]) => [p[0] * NORM_W, p[1] * H]) : undefined,
      });
      return {
        id: s.id,
        title: s.title,
        vb: [s.view_box[0] * NORM_W, s.view_box[1] * H, s.view_box[2] * NORM_W, s.view_box[3] * H],
        bg: s.plan_url ? { href: s.plan_url, x: 0, y: 0, w: NORM_W, h: H } : null,
        rooms: s.rooms.map(scale),
      };
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

  private get _showAll(): boolean {
    return !!this._settings.show_all;
  }

  private _toggleShowAll(): void {
    if (!this._serverCfg) return;
    this._serverCfg = { ...this._serverCfg, settings: { ...this._serverCfg.settings, show_all: !this._showAll } };
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
    if (changed.has('hass') && this.hass) {
      if (!this._loadOk && !this._loading && this._loadTries < 8) {
        this._loadFromServer();
      }
      this._maybeRebuildDevices();
    }
  }

  protected updated(): void {
    const stage = this._stageEl;
    if (stage && !this._roViewport) {
      this._roViewport = new ResizeObserver(() => this._refitView());
      this._roViewport.observe(stage);
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
      this._cfgRev = cfgResp?.rev || 0;
      this._layout = layResp?.layout || {};
      // live sync: the config was changed in another window → re-read it
      if (!this._unsubCfg) {
        this._unsubCfg = await this.hass.connection.subscribeEvents((ev: any) => {
          if ((ev?.data?.rev ?? -1) !== this._cfgRev) this._reloadConfigOnly();
        }, 'houseplan_config_updated');
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
      // not the last attempt — silently wait for the next hass update (WS warm-up)
      if (this._loadTries >= 8) {
        this._serverStorage = false;
        this._serverCfg = null;
        try {
          this._layout = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
        } catch {
          this._layout = {};
        }
      }
    } finally {
      this._loading = false;
    }
    this._regSignature = '';
    this.requestUpdate();
  }

  private async _reloadConfigOnly(): Promise<void> {
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/config/get' });
      const cfg = resp?.config;
      this._serverCfg = cfg && Array.isArray(cfg.spaces) ? cfg : null;
      this._cfgRev = resp?.rev || 0;
      this._cacheSnapshot();
      this._regSignature = '';
      this._maybeRebuildDevices();
      this.requestUpdate();
    } catch {
      /* ignore */
    }
  }

  private _dirtyPos = new Set<string>();

  private _persistLayout = debounce(() => {
    if (this._serverStorage) {
      // point-wise updates: do not overwrite positions changed in other windows
      const ids = [...this._dirtyPos];
      this._dirtyPos.clear();
      for (const id of ids) {
        const pos = this._layout[id];
        if (!pos) continue;
        this.hass
          .callWS({ type: 'houseplan/layout/update', device_id: id, pos })
          .catch((e: any) => this._showToast(this._t('toast.pos_save_failed', { err: this._errText(e) })));
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

  /** Curation + light groups + overrides + virtual devices. */
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
    const minDist = (iconPct / 100) * NORM_W * 1.3; // no closer than the icon diameter + a margin
    for (const s of this._model) {
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
        ds.forEach((d, i) => (map[d.id] = pts[i]));
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
          const aspect = this._serverCfg!.spaces.find((x: any) => x.id === d.space)?.aspect || 1;
          return { x: saved.x * NORM_W, y: saved.y * (NORM_W / aspect) };
        }
      } else if (saved.s === undefined) {
        return { x: saved.x, y: saved.y };
      }
    }
    if (this._defPos[d.id]) return this._defPos[d.id];
    const vb = s.vb;
    return { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 };
  }

  private _savePos(d: DevItem, x: number, y: number): void {
    if (this._norm) {
      // the icon center snaps to the nodes of the same grid as the room markup
      const g = this._gridPitch;
      const gx = Math.round(x / g) * g;
      const gy = Math.round(y / g) * g;
      const aspect = this._serverCfg!.spaces.find((s: any) => s.id === d.space)?.aspect || 1;
      const prevK = (this._layout[d.id] as any)?.k;
      this._layout = {
        ...this._layout,
        [d.id]: { s: d.space, x: gx / NORM_W, y: gy / (NORM_W / aspect), ...(prevK ? { k: prevK } : {}) },
      };
    } else {
      this._layout = { ...this._layout, [d.id]: { x: Math.round(x), y: Math.round(y) } };
    }
    this._dirtyPos.add(d.id);
    this._persistLayout();
  }

  // ================= live states =================

  private _stateClass(d: DevItem): string {
    if (!this._config?.live_states) return '';
    // an icon with controlled targets mirrors THEM, not its own entity
    // (stateless remotes and virtual wall switches have nothing else to show)
    const controls = (d.marker?.controls || []).filter(isControllable);
    if (controls.length)
      return controls.some((e) => this.hass.states[e]?.state === 'on') ? 'on' : '';
    const p = d.primary ? this.hass.states[d.primary] : undefined;
    if (!p) return '';
    if (p.state === 'unavailable') return 'unavail';
    // derive the domain from the entity id we looked the state up by — state
    // objects are not guaranteed to carry entity_id (defensive; found by the
    // TESTING.md edge-case run)
    const dom = d.primary!.split('.')[0];
    if (['light', 'switch', 'fan', 'humidifier'].includes(dom)) return p.state === 'on' ? 'on' : '';
    if (dom === 'cover' || dom === 'valve') return ['open', 'opening'].includes(p.state) ? 'open' : '';
    if (dom === 'lock') return ['unlocked', 'open'].includes(p.state) ? 'open' : '';
    if (dom === 'binary_sensor') {
      const dc = p.attributes?.device_class;
      if (['door', 'window', 'garage_door', 'opening', 'gas', 'smoke', 'moisture', 'problem'].includes(dc))
        return p.state === 'on' ? 'open' : '';
    }
    if (dom === 'media_player') return ['playing', 'on'].includes(p.state) ? 'on' : '';
    if (dom === 'vacuum') return ['cleaning', 'returning'].includes(p.state) ? 'on' : '';
    return '';
  }

  private _liveTemp(d: DevItem): number | null {
    if (!this._config?.show_temperature) return null;
    if (d.icon !== 'mdi:thermometer' && d.icon !== 'mdi:air-filter') return null;
    return tempFor(this.hass, d.entities);
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
    const domain = d.primary ? d.primary.split('.')[0] : null;
    // a switch with bound targets: the EXPLICIT per-marker toggle flips them
    // all with HA-group semantics (any on -> all off). Owner's decision:
    // controls never fire on the card-wide default action.
    const controls = (d.marker?.controls || []).filter(isControllable);
    if (d.tapAction === 'toggle' && controls.length) {
      const act = controlsAction(controls.map((e) => this.hass.states[e]?.state));
      this.hass
        .callService('homeassistant', act, { entity_id: controls })
        .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
      return;
    }
    const action = resolveTapAction(d.tapAction, undefined, domain);
    if (action === 'toggle' && d.primary) {
      this.hass
        .callService('homeassistant', 'toggle', { entity_id: d.primary })
        .catch((e: any) => this._showToast(this._t('toast.error', { err: this._errText(e) })));
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

  /** Aspect ratio of the scene (width/height, px). */
  private _stageAspect(): number {
    const s = this._stageEl;
    const vb = this._spaceModel().vb;
    return s && s.clientHeight ? s.clientWidth / s.clientHeight : vb[2] / vb[3];
  }

  /** Current view with a fallback to the full fit. */
  private _viewOr(vb: number[]): { x: number; y: number; w: number; h: number } {
    return this._view && this._view.w ? this._view : fitView(vb, this._stageAspect());
  }

  /** Screen (sx,sy relative to the scene, px) → vb coordinates per the current view. */
  private _screenToVb(sx: number, sy: number): number[] {
    const s = this._stageEl;
    const v = this._viewOr(this._spaceModel().vb);
    const w = s?.clientWidth || 1, h = s?.clientHeight || 1;
    return [v.x + (sx / w) * v.w, v.y + (sy / h) * v.h];
  }

  /** Clamp the view to the fit bounds (the content always covers the scene). */
  private _clampView(
    v: { x: number; y: number; w: number; h: number },
    fit: { x: number; y: number; w: number; h: number },
  ): { x: number; y: number; w: number; h: number } {
    return {
      w: v.w,
      h: v.h,
      x: Math.max(fit.x, Math.min(fit.x + fit.w - v.w, v.x)),
      y: Math.max(fit.y, Math.min(fit.y + fit.h - v.h, v.y)),
    };
  }

  /** Set the zoom (centered on vb point cx,cy, or on the center of the current view). */
  private _applyView(zoom: number, cx?: number, cy?: number): void {
    const vb = this._spaceModel().vb;
    const fit = fitView(vb, this._stageAspect());
    const z = Math.min(8, Math.max(1, zoom));
    const w = fit.w / z, h = fit.h / z;
    const cur = this._viewOr(vb);
    const ccx = cx ?? cur.x + cur.w / 2;
    const ccy = cy ?? cur.y + cur.h / 2;
    this._zoom = z;
    this._view = this._clampView({ x: ccx - w / 2, y: ccy - h / 2, w, h }, fit);
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
    const vb = this._spaceModel().vb;
    const fit = fitView(vb, this._stageAspect());
    const z = Math.min(8, Math.max(1, newZoom));
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

  private _resetZoom(): void {
    const vb = this._spaceModel().vb;
    this._zoom = 1;
    this._view = fitView(vb, this._stageAspect());
    this._saveZoom();
  }

  /** Save the current space zoom to localStorage. */
  private _saveZoom(): void {
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
    this._view = null;
    requestAnimationFrame(() => {
      if (!this._stageEl) return;
      const vb = this._spaceModel().vb;
      this._applyView(z, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
      this.requestUpdate();
    });
  }

  private _stagePointerDown(ev: PointerEvent): void {
    // do not interfere with icon dragging and markup drawing
    if (this._drag || this._markup) return;
    if (this._mode === 'devices' && (ev.target as HTMLElement).closest('.dev')) return;
    if (this._mode === 'decor' && this._decorPointerDown(ev)) return;
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const v = this._viewOr(this._spaceModel().vb);
    if (this._pointers.size === 1) {
      this._panStart = { sx: ev.clientX, sy: ev.clientY, vx: v.x, vy: v.y };
      this._suppressClick = false;
    } else if (this._pointers.size === 2) {
      const pts = [...this._pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this._pinchStart = { dist, zoom: this._zoom };
      this._panStart = null;
    }
  }

  private _stagePointerMove(ev: PointerEvent): void {
    if (this._decorDraft?.pid === ev.pointerId) {
      this._decorDraft = { ...this._decorDraft, b: this._snap(this._svgPoint(ev)) };
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
      if (this._zoom > 1 && this._view) {
        const stage = this._stageEl!;
        const v = this._view;
        const fit = fitView(this._spaceModel().vb, this._stageAspect());
        this._view = this._clampView(
          {
            x: this._panStart.vx - (ddx / stage.clientWidth) * v.w,
            y: this._panStart.vy - (ddy / stage.clientHeight) * v.h,
            w: v.w,
            h: v.h,
          },
          fit,
        );
      }
    }
  }

  private _stagePointerUp(ev: PointerEvent): void {
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
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    this._tip = null;
  }

  private _pointerMove(ev: PointerEvent, d: DevItem): void {
    if (!this._drag || this._drag.id !== d.id) return;
    const stage = this.renderRoot.querySelector('.stage') as HTMLElement;
    if (!stage) return;
    const vb = this._spaceModel().vb;
    const rect = stage.getBoundingClientRect();
    const v = this._viewOr(vb);
    const dx = ((ev.clientX - this._drag.sx) / rect.width) * v.w;
    const dy = ((ev.clientY - this._drag.sy) / rect.height) * v.h;
    if (Math.abs(ev.clientX - this._drag.sx) + Math.abs(ev.clientY - this._drag.sy) > 3) {
      this._drag.moved = true;
      clearTimeout(this._holdTimer);
    }
    const m = Math.min(vb[2], vb[3]) * 0.008;
    const nx = Math.max(vb[0] + m, Math.min(vb[0] + vb[2] - m, this._drag.ox + dx));
    const ny = Math.max(vb[1] + m, Math.min(vb[1] + vb[3] - m, this._drag.oy + dy));
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

  private _showTip(ev: MouseEvent, title: string, meta: string, lqi?: number | null, temp?: number | null): void {
    if (this._drag) return;
    this._tip = { x: ev.clientX, y: ev.clientY, title, meta, lqi, temp };
  }

  // ================= ROOM MARKUP EDITOR =================

  private get _gridPitch(): number {
    return NORM_W / GRID_N;
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
    return this._serverCfg?.spaces.find((s: any) => s.id === this._space);
  }

  private get _spaceH(): number {
    const sp = this._curSpaceCfg;
    return sp ? NORM_W / sp.aspect : NORM_W;
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
    if (this._mode === mode) return;
    if ((mode === 'plan' || mode === 'decor') && !this._norm) {
      this._showToast(this._t('toast.markup_needs_server'));
      return;
    }
    this._mode = mode;
    this._path = [];
    this._cursorPt = null;
    this._tool = 'draw';
    this._mergeSel = null;
    this._mergeDialog = null;
    this._splitSel = null;
    this._pendingSplit = null;
    this._selId = null;
    this._tip = null;
    this._decorDraft = null;
    this._decorSel = null;
    this._decorTool = 'select';
    this._saveNav();
  }


  private _svgPoint(ev: MouseEvent): number[] {
    const stage = this.renderRoot.querySelector('.stage') as HTMLElement;
    const r = stage.getBoundingClientRect();
    return this._screenToVb(ev.clientX - r.left, ev.clientY - r.top);
  }

  private _snap(p: number[]): number[] {
    const g = this._gridPitch;
    return [snapToGrid(p[0], g), snapToGrid(p[1], g)];
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

  private _saveConfig = debounce(() => {
    if (!this._serverCfg) return;
    this._dropLegacySegments();
    this.hass
      .callWS({ type: 'houseplan/config/set', config: this._serverCfg, expected_rev: this._cfgRev })
      .then((r: any) => {
        this._cfgRev = r?.rev ?? this._cfgRev + 1;
      })
      .catch((e: any) => {
        if (e?.code === 'conflict') {
          this._showToast(this._t('toast.conflict'));
          this._cancelPath();
          this._reloadConfigOnly();
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
    if (!this._markup) return;
    // Room cards swallow markup clicks: dragging, resizing or just clicking a
    // card must not feed the active tool (draw point, delete room, merge/split
    // pick, opening placement). The drag itself already stops pointer events,
    // but the synthesized `click` afterwards still bubbles to the stage.
    if (this._drag || this._rlResize) return;
    const path = (ev.composedPath?.() || []) as any[];
    if (path.some((n) => n?.classList?.contains?.('roomlabel') || n?.classList?.contains?.('rlhandle'))) return;
    const raw = this._svgPoint(ev);
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
      this._openingClick(raw);
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
      this._splitClick(raw);
      return;
    }
    // draw: clicks on grid points build the outline. Nothing is written to the config
    // until the contour closes — an abandoned outline leaves no lines behind.
    const pt = this._snap(raw);
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
      this._roomDialog = true;
      return;
    }
    this._path = [...this._path, pt];
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
    return NORM_W / (this._curSpaceCfg?.aspect || 1);
  }

  /** Begin a decor gesture. Returns true when the event is consumed (no pan). */
  private _decorPointerDown(ev: PointerEvent): boolean {
    const t = this._decorTool;
    const onShape = (ev.target as HTMLElement).closest?.('.dshape') as SVGElement | null;
    if (onShape) return true; // the shape's own handler deals with it
    if (t === 'line' || t === 'rect' || t === 'ellipse') {
      ev.preventDefault();
      const p = this._snap(this._svgPoint(ev));
      this._decorDraft = { kind: t, a: p, b: p, pid: ev.pointerId };
      (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
      return true;
    }
    if (t === 'text') {
      const p = this._snap(this._svgPoint(ev));
      this._decorTextDialog = {
        x: p[0] / NORM_W, y: p[1] / this._decorH,
        text: '', size: 'm', color: this._decorStyle.color,
      };
      return true;
    }
    this._decorSel = null; // select/erase on empty space clears the selection
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
    let shape: any;
    if (d.kind === 'line') {
      shape = { id, kind: 'line', x1: d.a[0] / W, y1: d.a[1] / H, x2: d.b[0] / W, y2: d.b[1] / H,
        color: st.color, width: st.width };
    } else {
      const x = Math.min(d.a[0], d.b[0]) / W, y = Math.min(d.a[1], d.b[1]) / H;
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
    ev.stopPropagation();
    ev.preventDefault();
    if (this._decorTool === 'erase') {
      const sp = this._curSpaceCfg;
      sp.decor = this._decorList.filter((x) => x.id !== shape.id);
      if (this._decorSel === shape.id) this._decorSel = null;
      this._saveConfig();
      this.requestUpdate();
      return;
    }
    if (this._decorTool !== 'select') return;
    this._decorSel = shape.id;
    this._decorMove = {
      id: shape.id, start: this._svgPoint(ev), orig: JSON.parse(JSON.stringify(shape)),
      pid: ev.pointerId, moved: false,
    };
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  private _decorMoveUpdate(ev: PointerEvent): void {
    const m = this._decorMove!;
    const p = this._svgPoint(ev);
    const g = this._gridPitch;
    const dx = snapToGrid(p[0] - m.start[0], g) / NORM_W;
    const dy = snapToGrid(p[1] - m.start[1], g) / this._decorH;
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
    if (this._mode !== 'decor' || shape.kind !== 'text') return;
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

  private _renderDecorLayer(): TemplateResult {
    const W = NORM_W, H = this._decorH;
    const TXT = { s: 14, m: 20, l: 30 } as Record<string, number>;
    const editing = this._mode === 'decor';
    const shapes = this._decorList.map((sh) => {
      const cls = 'dshape' + (editing && this._decorSel === sh.id ? ' dsel' : '');
      const down = (e: PointerEvent) => this._decorShapeDown(e, sh);
      const dbl = () => this._decorShapeDbl(sh);
      if (sh.kind === 'line')
        return svg`<line class="${cls}" x1="${sh.x1 * W}" y1="${sh.y1 * H}" x2="${sh.x2 * W}" y2="${sh.y2 * H}"
          stroke="${sh.color}" stroke-width="${sh.width}" @pointerdown=${down}></line>`;
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
          stroke="${st.color}" stroke-width="${st.width}"></line>`;
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
      ['line', 'mdi:vector-line', 'decor.line'],
      ['rect', 'mdi:rectangle-outline', 'decor.rect'],
      ['ellipse', 'mdi:ellipse-outline', 'decor.ellipse'],
      ['text', 'mdi:format-text', 'decor.text'],
      ['erase', 'mdi:eraser', 'decor.erase'],
    ] as const;
    return html`<div class="editbar decorbar">
      <ha-icon icon="mdi:draw" class="warn"></ha-icon>
      ${tools.map(
        ([t, ic, k]) => html`<button class="btn ${this._decorTool === t ? 'on' : ''}"
          @click=${() => { this._decorTool = t; this._decorDraft = null; }}
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
      <span class="spacer"></span>
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
  private _openPairs(): { a: RoomCfg; b: RoomCfg; segs: number[][] }[] {
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
    this._openingDialog = {
      type: 'door', lengthCm: 90, contact: '', lock: '',
      invert: false, flipH: false, flipV: false,
      x: snap.x, y: snap.y, angle: snap.angle,
    };
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
    ev.preventDefault();
    ev.stopPropagation();
    try {
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* an inactive pointerId (synthetic events, some browsers) must not kill the drag */
    }
    this._opDrag = { id: o.id, moved: false };
  }

  private _opPointerMove(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._opDrag || this._opDrag.id !== o.id) return;
    const raw = this._svgPoint(ev);
    const snap = snapToWall(raw, this._spaceModel().rooms, this._gridPitch * 4);
    if (!snap) return; // too far from any wall: the opening stays where it was
    this._opDrag.moved = true;
    const sp = this._curSpaceCfg;
    const cfg = sp?.openings?.find((x: OpeningCfg) => x.id === o.id);
    if (!cfg) return;
    cfg.x = snap.x / NORM_W;
    cfg.y = snap.y / this._spaceH;
    cfg.angle = snap.angle;
    this.requestUpdate();
  }

  private _opPointerUp(ev: PointerEvent, o: OpeningCfg): void {
    if (!this._opDrag || this._opDrag.id !== o.id) return;
    const moved = this._opDrag.moved;
    if (moved) this._saveConfig();
    // keep the flag until the click event that follows pointerup, then let it go
    if (moved) window.setTimeout(() => (this._opDrag = null), 0);
    else this._opDrag = null;
  }

  /** Click: the status card (delayed so a double click can cancel it). */
  private _opClick(ev: MouseEvent, o: OpeningCfg & { rx: number; ry: number; rlen: number }): void {
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
    const eps = this._gridPitch * 0.02;
    const pull = this._gridPitch * 6; // ≈2.5% of the plan width — generous but intentional
    const near = closestPointOnBoundary(raw, poly);
    const wallPt = near && Math.hypot(near[0] - raw[0], near[1] - raw[1]) <= pull ? near : null;
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
      this._cursorPt = this._svgPoint(ev);
      return;
    }
    const drawing = this._tool === 'draw' && this._path.length && !this._contourClosed;
    const cutting = this._tool === 'split' && !!this._splitSel?.pts?.length;
    if (!drawing && !cutting) return;
    this._cursorPt = this._snap(this._svgPoint(ev));
  }

  /** Dashed hover preview of an opening: same snap and default length as the click. */
  private get _openingPreview(): { x: number; y: number; angle: number; rlen: number } | null {
    if (this._tool !== 'opening' || !this._cursorPt) return null;
    const raw = this._cursorPt;
    // an existing opening under the cursor will be edited, not added — no preview
    const eps = this._gridPitch * 1.5;
    const hit = this._openingsR.find(
      (o) => Math.hypot(raw[0] - o.rx, raw[1] - o.ry) <= Math.max(o.rlen / 2, eps),
    );
    if (hit) return null;
    const snap = snapToWall(raw, this._spaceModel().rooms, eps);
    if (!snap) return null;
    return { ...snap, rlen: this._cmToUnits(90) };
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
      const aspect = this._serverCfg?.spaces.find((x: any) => x.id === this._space)?.aspect || 1;
      const H2 = NORM_W / aspect;
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
        defaultTap: d.primary?.split('.')[0] === 'light' ? 'toggle' : 'info',
        controls: [...(d.marker?.controls || [])],
        controlsFilter: '',
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
        busy: false,
      };
    } else {
      this._markerDialog = {
        name: '', binding: 'virtual', bindingMode: 'virtual', bindingOpen: false,
        showEntities: false, bindingFilter: '', icon: '', autoIcon: '',
        display: 'badge', rippleColor: '', rippleSize: 3, size: 1, angle: 0,
        tapAction: '', defaultTap: 'info', controls: [], controlsFilter: '', glowRadius: '', model: '',
        link: '', description: '', pdfs: [], room: '', busy: false,
      };
    }
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
    const mid = this._markerDialog.devId || 'new';
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
      const marker: Marker = {
        id,
        binding: dlg.binding,
        name: dlg.name.trim() || null,
        icon: dlg.icon || null,
        display: dlg.display !== 'badge' ? dlg.display : null,
        ripple_color: dlg.display !== 'badge' && dlg.rippleColor ? dlg.rippleColor : null,
        ripple_size: dlg.display !== 'badge' && dlg.rippleSize !== 3 ? dlg.rippleSize : null,
        size: dlg.size !== 1 ? dlg.size : null,
        angle: dlg.angle ? dlg.angle : null,
        tap_action: dlg.tapAction || null,
        controls: dlg.controls.length ? dlg.controls : null,
        glow_radius_cm: (() => {
          const v = parseFloat(dlg.glowRadius);
          if (!Number.isFinite(v) || v <= 0) return null;
          return Math.round(this._imperial ? v * 30.48 : v * 100);
        })(),
        model: dlg.model.trim() || null,
        link: dlg.link.trim() || null,
        description: dlg.description.trim() || null,
        pdfs: dlg.pdfs,
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
      if (newPos) await this.hass.callWS({ type: 'houseplan/layout/update', device_id: id, pos: newPos });
      if (oldId && oldId !== id) {
        // rebinding changed the icon id — clean up the old position
        delete this._layout[oldId];
        await this.hass.callWS({ type: 'houseplan/layout/delete', device_id: oldId }).catch(() => undefined);
      }
      this._markerDialog = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast(this._t('toast.marker_saved'));
    } catch (e: any) {
      this._markerDialog = { ...this._markerDialog!, busy: false };
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
        await this.hass.callWS({ type: 'houseplan/layout/delete', device_id: d.id }).catch(() => undefined);
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
    const aspect = this._serverCfg!.spaces.find((s: any) => s.id === space)?.aspect || 1;
    return { s: space, x: x / NORM_W, y: y / (NORM_W / aspect) };
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
        source: sp.plan_url ? 'file' : 'draw', orientation: 'landscape',
        showBorders: disp.showBorders, showNames: disp.showNames,
        roomColor: disp.color, roomOpacity: disp.opacity, fillMode: disp.fill,
        tempMin: disp.tempMin, tempMax: disp.tempMax,
        showLqi: disp.showLqi ?? this._config?.show_signal ?? true,
        labelTemp: disp.labelTemp, labelHum: disp.labelHum,
        labelLqi: disp.labelLqi, labelLight: disp.labelLight,
        cellCm: Number(sp.cell_cm) > 0 ? Number(sp.cell_cm) : 5,
        busy: false,
      };
    } else {
      this._spaceDialog = {
        mode, title: '', planUrl: null, planFile: null,
        source: 'file', orientation: 'landscape',
        showBorders: false, showNames: false,
        roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'none',
        tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
        showLqi: this._config?.show_signal ?? true,
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
      const cfg = this._serverCfg!;
      let sp: any;
      const drawAspect = d.orientation === 'portrait' ? 0.707 : d.orientation === 'square' ? 1 : 1.414;
      if (d.mode === 'create') {
        sp = {
          id: 's' + Date.now().toString(36),
          title: d.title.trim(),
          plan_url: null,
          aspect: d.source === 'draw' ? drawAspect : 1.414,
          view_box: [0, 0, 1, 1],
          rooms: [],
        };
        cfg.spaces.push(sp);
      } else {
        sp = cfg.spaces.find((x: any) => x.id === d.spaceId);
        sp.title = d.title.trim();
      }
      if (d.source === 'file' && d.planFile) {
        const resp = await this.hass.callWS({
          type: 'houseplan/plan/set', space_id: sp.id, ext: d.planFile.ext, data: d.planFile.b64,
        });
        sp.plan_url = resp.url;
        sp.aspect = d.planFile.aspect;
      }
      // switching an existing space to "draw" detaches its background image
      // (the uploaded file stays on disk; only the reference is cleared)
      if (d.source === 'draw') sp.plan_url = null;
      // per-space display settings; hand-drawn spaces get borders+names on by default
      const draw = d.source === 'draw';
      sp.settings = {
        ...(sp.settings || {}),
        show_borders: draw && d.mode === 'create' ? true : d.showBorders,
        show_names: draw && d.mode === 'create' ? true : d.showNames,
        room_color: d.roomColor,
        room_opacity: d.roomOpacity,
        fill_mode: d.fillMode,
        temp_min: Number.isFinite(d.tempMin) ? Math.min(d.tempMin, d.tempMax) : DEFAULT_TEMP_MIN,
        temp_max: Number.isFinite(d.tempMax) ? Math.max(d.tempMin, d.tempMax) : DEFAULT_TEMP_MAX,
        show_lqi: d.showLqi,
        label_temp: d.labelTemp,
        label_hum: d.labelHum,
        label_lqi: d.labelLqi,
        label_light: d.labelLight,
      };
      sp.cell_cm = Number.isFinite(d.cellCm) && d.cellCm > 0 ? d.cellCm : 5;
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
      this._spaceDialog = { ...this._spaceDialog!, busy: false };
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
    this._dropLegacySegments();
    try {
      const r = await this.hass.callWS({
        type: 'houseplan/config/set', config: this._serverCfg, expected_rev: this._cfgRev,
      });
      this._cfgRev = r?.rev ?? this._cfgRev + 1;
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
      source: 'file', orientation: 'landscape',
      showBorders: false, showNames: false,
      roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY, fillMode: 'none',
      tempMin: DEFAULT_TEMP_MIN, tempMax: DEFAULT_TEMP_MAX,
      showLqi: this._config?.show_signal ?? true,
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

  // ================= GENERAL SETTINGS =================

  private _openSettingsDialog = (): void => {
    if (!this._norm) return;
    // deep copy so the dialog edits do not leak into the live palette
    const cm = this._glowRadiusCm;
    const glowRadius = this._imperial
      ? Math.round((cm / 30.48) * 10) / 10
      : Math.round(cm) / 100;
    this._settingsDialog = { colors: JSON.parse(JSON.stringify(this._fillColors)), glowRadius, busy: false };
  };

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
      this._serverCfg = { ...cfg, settings };
      await this._saveConfigNow();
      this._settingsDialog = null;
      this.requestUpdate();
      this._showToast(this._t('gs.saved'));
    } catch (e: any) {
      this._settingsDialog = { ...this._settingsDialog!, busy: false };
      this._showToast(this._t('toast.error', { err: this._errText(e) }));
    }
  }

  private _renderColorRow(key: keyof FillColors, labelKey: string): TemplateResult {
    const d = this._settingsDialog!;
    const v = d.colors[key];
    return html`<div class="colorrow gsrow">
      <span class="gsl">${this._t(labelKey as any)}</span>
      <input type="color" .value=${v.c}
        @input=${(e: Event) => this._setFillColor(key, { c: (e.target as HTMLInputElement).value })} />
      <input type="range" min="0" max="100" .value=${String(Math.round(v.a * 100))}
        @input=${(e: Event) => this._setFillColor(key, { a: Number((e.target as HTMLInputElement).value) / 100 })} />
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
      const lightEid = d.entities.find(
        (e) => e.startsWith('light.') && this.hass.states[e]?.state === 'on',
      );
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
        </div>
        <div class="row">
          <button class="btn ghost" @click=${() =>
            (this._settingsDialog = { ...this._settingsDialog!, colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: this._imperial ? 9.8 : 3 })}>
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
      this._rulesDialog = { ...this._rulesDialog!, busy: false };
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
    const devs = this._devices.filter((d) => d.space === space.id);
    const disp = spaceDisplayOf(this._curSpaceCfg);
    const showLqi = disp.showLqi ?? this._config.show_signal ?? true;
    const cfgSize = this._config.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;
    const view = this._viewOr(vb);

    return html`
      <ha-card>
        <div class="hdr">
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
          <span class="count">${this._t('count.devices', { n: devs.length })}</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${() => this._stepZoom(-1)} title=${this._t('title.zoom_out')}><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="btn zb" @click=${() => this._resetZoom()} ?disabled=${this._zoom === 1}
              title=${this._t('title.zoom_reset')}><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
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

        <div class="stage ${this._markup ? 'markup tool-' + this._tool + (this._tool === 'split' && !this._splitSel ? ' pickstage' : '') + (this._tool === 'openwall' && this._openWallHover ? ' wallhot' : '') : ''} ${this._mode === 'decor' ? 'dtool-' + this._decorTool : ''} ${space.bg ? '' : 'noplan'} mode-${this._mode}"
          style="height:calc(100dvh - 118px)"
          @click=${(e: MouseEvent) => this._markupClick(e)}
          @wheel=${(e: WheelEvent) => this._onWheel(e)}
          @pointerdown=${(e: PointerEvent) => this._stagePointerDown(e)}
          @pointermove=${(e: PointerEvent) => this._stagePointerMove(e)}
          @pointerup=${(e: PointerEvent) => this._stagePointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._stagePointerUp(e)}>
          <div class="zoomwrap">
          <svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMid meet">
            ${this._editing ? this._renderMarkupDefs(vb) : nothing}
            ${this._editing && !this._markup
              ? svg`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#hp-grid)" pointer-events="none"></rect>`
              : nothing}
            ${space.bg
              ? svg`<image href="${space.bg.href}" x="${space.bg.x}" y="${space.bg.y}" width="${space.bg.w}" height="${space.bg.h}" preserveAspectRatio="none" />`
              : nothing}
            ${this._renderDecorLayer()}
            ${space.rooms.filter((r) => r.area || this._markup || disp.showBorders).map((r) => {
              let cls = 'room ' + (space.bg ? 'overlay' : 'yard') + (this._markup ? ' outlined' : '');
              if (this._markup && (r.id === this._mergeSel || r.id === this._splitSel?.roomId))
                cls += ' picked';
              let style = '';
              if (!this._markup && (disp.showBorders || disp.fill !== 'none')) {
                cls += ' styled';
                const st: string[] = [];
                // keep the stroke colour even when borders are hidden, so hover can reveal it
                st.push(`--room-stroke:${disp.color}`, `--room-stroke-op:${disp.showBorders ? disp.opacity : 0}`);
                const fillC = disp.fill === 'glow'
                  // glow: uniform darkness over EVERY room (area or not, lit or not)
                  ? this._fillColors.glow_base
                  : r.area
                  ? roomFillStyle(
                      disp.fill,
                      disp.fill === 'lqi' ? this._roomLqi(r.area) : null,
                      disp.fill === 'light' ? areaLights(this.hass, this._devices, r.area) : 'none',
                      disp.fill === 'temp' ? areaTemp(this.hass, this._devices, r.area) : null,
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
                this._showTip(e, r.name, this._t('tip.room'),
                  showLqi ? this._roomLqi(r.area) : null,
                  r.area ? areaTemp(this.hass, this._devices, r.area) : null);
              const label = !space.bg && !disp.showNames && !this._markup;
              const c = this._roomCenter(r);
              // open boundaries: this room's solid stroke must not run beneath
              // the dashed stretches — suppress it and draw a trimmed outline.
              // Applies in the Plan editor too (picked rooms keep their full
              // amber highlight — the merge/split selection must stay visible).
              const isPicked = this._markup && (r.id === this._mergeSel || r.id === this._splitSel?.roomId);
              const openCuts = r.id && !isPicked
                ? this._openPairs()
                    .filter((pp) => pp.a.id === r.id || pp.b.id === r.id)
                    .flatMap((pp) => pp.segs)
                : [];
              if (openCuts.length) cls += ' noedge';
              // island rooms punch holes in their parent's fill (evenodd)
              const myPoly = roomPoly(r);
              const holes = myPoly
                ? islandsOf(myPoly, space.rooms.filter((o) => o !== r).map((o) => roomPoly(o)!).filter(Boolean))
                : [];
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
            })}
            ${disp.fill === 'glow' && !this._markup ? this._renderGlowLayer(space) : nothing}
            ${this._renderOpenWalls(disp)}
            ${this._editing ? this._renderAlignGuides() : nothing}
            ${this._markup ? this._renderMarkupLayer(vb) : nothing}
            ${this._renderOpenings(disp)}
          </svg>
          <div class="devlayer" style="--icon-size:${((iconPct * vb[2]) / view.w).toFixed(3)}cqw">
            ${devs.map((d) => this._renderDevice(d, view, showLqi))}
            ${this._renderOpeningLocks(view)}
            ${disp.showNames || this._markup
              ? space.rooms.map((r) => this._renderRoomLabel(r, space, view, disp))
              : nothing}
          </div>
          ${this._measureAnchor
            ? html`<div class="measurelayer">${this._renderMeasureLabel(view)}</div>`
            : nothing}
          </div>
          ${this._zoom > 1
            ? html`<div class="zoombadge">${Math.round(this._zoom * 100)}%</div>`
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
        ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
      </ha-card>
    `;
  }

  private _renderDevice(d: DevItem, view: { x: number; y: number; w: number; h: number }, showLqi = true): TemplateResult {
    const p = this._pos(d);
    const left = ((p.x - view.x) / view.w) * 100;
    const top = ((p.y - view.y) / view.h) * 100;
    const cls = this._stateClass(d);
    const temp = this._liveTemp(d);
    const hum = this._liveHum(d);
    const lqi = showLqi && !d.virtual ? lqiFor(this.hass, d.entities) : null;
    const m = d.marker;
    const disp = m?.display || 'badge';
    const ripple = disp === 'ripple' || disp === 'icon_ripple';
    // value-only display: the measurement IS the marker
    const primarySt = d.primary ? this.hass.states[d.primary] : undefined;
    const valText = disp === 'value'
      ? (temp != null ? temp + '°'
        : hum != null ? hum + '%'
        : primarySt && !isNaN(parseFloat(primarySt.state))
          ? parseFloat(primarySt.state) + (primarySt.attributes?.unit_of_measurement ? ' ' + primarySt.attributes.unit_of_measurement : '')
          : null)
      : null;
    // live state variants of the auto icon (doors, locks, bulbs), like core HA
    const domain = d.primary ? d.primary.split('.')[0] : null;
    const icon = this._config?.live_states
      ? stateIcon(d.icon, domain, primarySt?.attributes?.device_class, primarySt?.state, !!m?.icon)
      : d.icon;
    // RGB lights color the icon (and the ripple, unless a custom ripple color is set);
    // an icon with controlled targets takes the color of its first lit RGB target
    const ctrl = (m?.controls || []).filter(isControllable);
    const lightC = this._config?.live_states
      ? ctrl.length
        ? ctrl.map((e) => lightColorOf(this.hass.states[e])).find((v) => v) || null
        : domain === 'light' ? lightColorOf(primarySt) : null
      : null;
    // emergencies (leak/smoke/gas/CO/siren) pulse red regardless of display mode
    const alarm = this._config?.live_states
      && isAlarmState(domain, primarySt?.attributes?.device_class, primarySt?.state);
    const active = ripple && !!d.primary && isActiveState(this.hass.states[d.primary]?.state);
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
    if (lightC) st.push(`--light-color:${lightC}`);
    return html`<div
      class="dev ${cls} ${this._selId === d.id ? 'sel' : ''} ${d.virtual ? 'virtual' : ''} ${disp === 'ripple' ? 'noicon' : ''} ${valText != null ? 'valonly' : ''} ${lightC ? 'rgb' : ''} ${alarm ? 'alarm' : ''}"
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
        : disp !== 'ripple'
          ? html`<ha-icon icon="${icon}" style=${angle ? `transform:rotate(${angle}deg)` : nothing}></ha-icon>`
          : nothing}
      ${temp != null && valText == null ? html`<span class="tval">${temp}°</span>` : nothing}
      ${hum != null && valText == null ? html`<span class="hval">${hum}%</span>` : nothing}
      ${lqi != null ? html`<span class="lqi" style="color:${lqiColor(lqi)}">${lqi}</span>` : nothing}
    </div>`;
  }

  /** Saved label position (layout key rl_<roomId>) or the room center. */
  private _labelPos(r: RoomCfg, spaceId: string): { x: number; y: number } {
    const saved = this._layout['rl_' + (r.id || '')];
    if (saved && saved.s === spaceId) {
      const aspect = this._serverCfg!.spaces.find((x: any) => x.id === spaceId)?.aspect || 1;
      return { x: saved.x * NORM_W, y: saved.y * (NORM_W / aspect) };
    }
    const c = this._roomCenter(r);
    return { x: c[0], y: c[1] };
  }

  /** Room-name labels are dragged exactly like device icons (same layout store). */
  private _labelDown(ev: PointerEvent, r: RoomCfg, spaceId: string): void {
    if (this._mode !== 'plan') return;
    ev.preventDefault();
    ev.stopPropagation();
    const p = this._labelPos(r, spaceId);
    this._drag = { id: 'rl_' + (r.id || ''), sx: ev.clientX, sy: ev.clientY, ox: p.x, oy: p.y, moved: false };
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
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
    const m = Math.min(vb[2], vb[3]) * 0.008;
    const nx = Math.max(vb[0] + m, Math.min(vb[0] + vb[2] - m, this._drag.ox + dx));
    const ny = Math.max(vb[1] + m, Math.min(vb[1] + vb[3] - m, this._drag.oy + dy));
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
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
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
      const aspect = this._serverCfg!.spaces.find((x: any) => x.id === rs.space)?.aspect || 1;
      this._layout = {
        ...this._layout,
        [rs.id]: { s: rs.space, x: p.x / NORM_W, y: p.y / (NORM_W / aspect), k },
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

  private _renderRoomLabel(
    r: RoomCfg, space: SpaceModel, view: { x: number; y: number; w: number; h: number }, disp: SpaceDisplay,
  ): TemplateResult | typeof nothing {
    if (!r.name) return nothing;
    const p = this._labelPos(r, space.id);
    const left = ((p.x - view.x) / view.w) * 100;
    const top = ((p.y - view.y) / view.h) * 100;
    const op = Math.min(1, disp.opacity + 0.25);
    const k = this._labelScale(r);
    // optional metrics row (needs an HA area; sub-area rooms show the name only)
    const rows: TemplateResult[] = [];
    if (r.area && !this._markup) {
      if (disp.labelTemp) {
        const t = areaTemp(this.hass, this._devices, r.area);
        if (t != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:thermometer"></ha-icon>${t}°</span>`);
      }
      if (disp.labelHum) {
        const hm = areaHum(this.hass, this._devices, r.area);
        if (hm != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:water-percent"></ha-icon>${hm}%</span>`);
      }
      if (disp.labelLqi) {
        const l = this._roomLqi(r.area);
        if (l != null) rows.push(html`<span class="rlm"><ha-icon icon="mdi:zigbee"></ha-icon>${l}</span>`);
      }
      if (disp.labelLight) {
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
      style="left:${left}%;top:${top}%;color:${disp.color};opacity:${op};--rl-scale:${k}"
      @pointerdown=${(e: PointerEvent) => this._labelDown(e, r, space.id)}
      @pointermove=${(e: PointerEvent) => this._labelMove(e, r, space.id)}
      @pointerup=${() => this._labelUp(r)}
      @pointercancel=${() => this._labelUp(r)}
    ><span class="rlname">${r.name}${!this._markup && r.area
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
            ? html`<label class="srcrow"><input type="checkbox" .checked=${d.invert}
                @change=${(e: Event) => (this._openingDialog = { ...d, invert: (e.target as HTMLInputElement).checked })} />
                <span>${this._t('opening.invert')}</span></label>`
            : nothing}

          ${d.type === 'door'
            ? html`<label>${this._t('opening.lock_label')}</label>
                ${opt(this._lockCandidates(), d.lock, (v) => (this._openingDialog = { ...d, lock: v }))}`
            : nothing}

          <label class="srcrow"><input type="checkbox" .checked=${d.flipH}
            @change=${(e: Event) => (this._openingDialog = { ...d, flipH: (e.target as HTMLInputElement).checked })} />
            <span>${this._t('opening.flip_h')}</span></label>
          <label class="srcrow"><input type="checkbox" .checked=${d.flipV}
            @change=${(e: Event) => (this._openingDialog = { ...d, flipV: (e.target as HTMLInputElement).checked })} />
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

  private _renderMarkupDefs(_vb: number[]): TemplateResult {
    const g = this._gridPitch;
    const dotR = g * 0.14;
    return svg`<defs>
        <pattern id="hp-grid" x="0" y="0" width="${g}" height="${g}" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="${dotR}" class="griddot"></circle>
          <circle cx="${g}" cy="0" r="${dotR}" class="griddot"></circle>
          <circle cx="0" cy="${g}" r="${dotR}" class="griddot"></circle>
          <circle cx="${g}" cy="${g}" r="${dotR}" class="griddot"></circle>
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
    return svg`
      <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#hp-grid)" pointer-events="none"></rect>
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

  private _renderInfoCard(): TemplateResult {
    const d = this._infoCard!;
    const st = d.primary ? this.hass.states[d.primary] : undefined;
    const stateTxt = st ? this.hass.formatEntityState?.(st) ?? st.state : null;
    const controls = (d.marker?.controls || []).filter(isControllable);
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._infoCard = null)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="${d.icon}"></ha-icon>${d.name}</div>
        <div class="body">
          ${d.model ? html`<div class="inforow"><span class="k">${this._t('info.model')}</span><span>${d.model}</span></div>` : nothing}
          ${stateTxt ? html`<div class="inforow"><span class="k">${this._t('info.state')}</span><span>${stateTxt}</span></div>` : nothing}
          ${safeUrl(d.link)
            ? html`<div class="inforow"><span class="k">${this._t('info.link')}</span>
                <a href="${safeUrl(d.link)}" target="_blank" rel="noreferrer noopener">${d.link}</a></div>`
            : nothing}
          ${d.description ? html`<div class="infodesc">${d.description}</div>` : nothing}
          ${d.pdfs && d.pdfs.length
            ? html`<div class="inforow"><span class="k">${this._t('info.manuals')}</span><span class="pdflist">
                ${d.pdfs.map(
                  (p) => html`<a class="pdf" href="${safeUrl(p.url) || '#'}" target="_blank" rel="noreferrer noopener">
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
                <input type="checkbox" .checked=${d.showEntities}
                  ?disabled=${d.bindingMode !== 'ha'}
                  @change=${(e: Event) => (this._markerDialog = { ...d, showEntities: (e.target as HTMLInputElement).checked })} />
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

          <label>${this._t('marker.tap_label')}</label>
          <select class="areasel"
            @change=${(e: Event) => (this._markerDialog = { ...d, tapAction: (e.target as HTMLSelectElement).value })}>
            ${[['info', 'tap.info'], ['more-info', 'tap.more_info'], ['toggle', 'tap.toggle']].map(
              ([v, k]) => html`<option value=${v} ?selected=${(d.tapAction || d.defaultTap) === v}>${this._t(k as any)}</option>`,
            )}
          </select>

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
            ${[['badge', 'display.badge'], ['ripple', 'display.ripple'], ['icon_ripple', 'display.icon_ripple'], ['value', 'display.value']].map(
              ([v, k]) => html`<option value=${v} ?selected=${d.display === v}>${this._t(k as any)}</option>`,
            )}
          </select>
          ${d.display === 'ripple' || d.display === 'icon_ripple'
            ? html`<div class="colorrow">
                <input type="color" .value=${d.rippleColor || '#3ea6ff'}
                  @input=${(e: Event) => (this._markerDialog = { ...d, rippleColor: (e.target as HTMLInputElement).value })} />
                <span class="opl">${this._t('marker.ripple_size')}</span>
                <input type="range" min="2" max="8" step="0.5" .value=${String(d.rippleSize)}
                  @input=${(e: Event) => (this._markerDialog = { ...d, rippleSize: Number((e.target as HTMLInputElement).value) })} />
                <span class="opv">×${d.rippleSize}</span>
              </div>`
            : nothing}

          <label>${this._t('marker.size_label')}</label>
          <div class="colorrow">
            <input type="range" min="0.5" max="3" step="0.1" .value=${String(d.size)}
              @input=${(e: Event) => (this._markerDialog = { ...d, size: Number((e.target as HTMLInputElement).value) })} />
            <span class="opv">×${d.size.toFixed(1)}</span>
            <span class="opl">${this._t('marker.angle_label')}</span>
            <input type="range" min="0" max="350" step="10" .value=${String(d.angle)}
              @input=${(e: Event) => (this._markerDialog = { ...d, angle: Number((e.target as HTMLInputElement).value) })} />
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
                <a href="${safeUrl(p.url) || '#'}" target="_blank" rel="noreferrer noopener">${p.name}</a>
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
          ${d.devId
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
                    ? html`<img class="planprev" src=${d.planUrl} alt=${this._t('space.plan_alt')} />`
                    : html`<span class="planname muted">${this._t('space.no_plan')}</span>`}
                <label class="btn filebtn">
                  <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? this._t('btn.replace') : this._t('btn.upload')}
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${(e: Event) => this._pickPlanFile(e)} />
                </label>
              </div>`
            : nothing}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'draw'}
              @change=${() => (this._spaceDialog = { ...d, source: 'draw' })} />
            <span>${this._t('space.source_draw')}</span>
          </label>
          ${d.source === 'draw' && d.mode === 'create'
            ? html`<label>${this._t('space.orientation')}</label>
              <select class="areasel"
                @change=${(e: Event) => (this._spaceDialog = { ...d, orientation: (e.target as HTMLSelectElement).value as any })}>
                ${[['landscape', 'orient.landscape'], ['portrait', 'orient.portrait'], ['square', 'orient.square']].map(
                  ([v, k]) => html`<option value=${v} ?selected=${d.orientation === v}>${this._t(k as any)}</option>`,
                )}
              </select>`
            : nothing}

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
            <input type="checkbox" .checked=${d.showBorders}
              @change=${(e: Event) => (this._spaceDialog = { ...d, showBorders: (e.target as HTMLInputElement).checked })} />
            <span>${this._t('space.show_borders')}</span>
          </label>
          <label class="srcrow">
            <input type="checkbox" .checked=${d.showNames}
              @change=${(e: Event) => (this._spaceDialog = { ...d, showNames: (e.target as HTMLInputElement).checked })} />
            <span>${this._t('space.show_names')}</span>
          </label>
          <label class="srcrow">
            <input type="checkbox" .checked=${d.showLqi}
              @change=${(e: Event) => (this._spaceDialog = { ...d, showLqi: (e.target as HTMLInputElement).checked })} />
            <span>${this._t('space.show_lqi')}</span>
          </label>
          <label class="dispsection">${this._t('space.roomcard_section')}</label>
          ${([['labelTemp', 'space.label_temp'], ['labelHum', 'space.label_hum'],
              ['labelLqi', 'space.label_lqi'], ['labelLight', 'space.label_light']] as const).map(
            ([f, k]) => html`<label class="srcrow">
              <input type="checkbox" .checked=${d[f]}
                @change=${(e: Event) => (this._spaceDialog = { ...d, [f]: (e.target as HTMLInputElement).checked })} />
              <span>${this._t(k)}</span>
            </label>`,
          )}
          <label>${this._t('space.room_color')}</label>
          <div class="colorrow">
            <input type="color" .value=${d.roomColor}
              @input=${(e: Event) => (this._spaceDialog = { ...d, roomColor: (e.target as HTMLInputElement).value })} />
            <span class="opl">${this._t('space.opacity')}</span>
            <input type="range" min="0" max="100" .value=${String(Math.round(d.roomOpacity * 100))}
              @input=${(e: Event) => (this._spaceDialog = { ...d, roomOpacity: Number((e.target as HTMLInputElement).value) / 100 })} />
            <span class="opv">${Math.round(d.roomOpacity * 100)}%</span>
          </div>
          <label>${this._t('space.fill_label')}</label>
          ${[['none', 'fill.none'], ['lqi', 'fill.lqi'], ['light', 'fill.light'], ['temp', 'fill.temp'], ['glow', 'fill.glow']].map(
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

  private _renderRoomDialog(): TemplateResult {
    const areas = this._freeAreas;
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>${this._t('room.new')}</div>
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
        </div>
        <div class="row">
          <button class="btn ghost" @click=${this._roomDialogCancel}>${this._t('btn.cancel')}</button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
            title=${this._t('title.no_area_room')}>
            ${this._t('btn.no_area')}
          </button>
          <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
            title=${!this._areaSel ? this._t('title.choose_area') : ''}>
            <ha-icon icon="mdi:check"></ha-icon>${this._t('btn.save')}
          </button>
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
