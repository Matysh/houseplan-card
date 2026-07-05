/**
 * House Plan Card — интерактивный план дома как нативная Lovelace-карточка.
 * Источники конфигурации:
 *  1) СЕРВЕР (интеграция houseplan, WS houseplan/config/get) — пространства, планы,
 *     комнаты, оверрайды устройств, виртуальные устройства. Координаты НОРМИРОВАННЫЕ (0..1).
 *  2) LEGACY-фолбэк — вшитые данные дачи (src/data/*), координаты в холсте 1489×1053.
 * Раскладка иконок хранится на сервере (houseplan/layout/*), fallback — localStorage.
 */
import { LitElement, html, svg, css, nothing, TemplateResult, PropertyValues } from 'lit';
import { EXCLUDED_DOMAINS, iconFor, DOMAIN_PRIORITY } from './rules';
import {
  lqiColor, snapToGrid, segKey as segKeyOf, samePoint, pointInPolygon, markerIdForBinding,
} from './logic';
import './editor';

const CARD_VERSION = '1.8.4';
const LS_KEY = 'houseplan_card_layout_v1';
const LS_CFG = 'houseplan_card_cfg_v1'; // кэш серверного конфига+раскладки для мгновенного рендера
const LS_ZOOM = 'houseplan_card_zoom_v1';
const NORM_W = 1000; // ширина рендер-пространства для нормированных конфигов

interface RoomCfg {
  id?: string;
  name: string;
  area: string | null;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  poly?: number[][]; // полигон в рендер-единицах (модель) / нормированный (конфиг)
}

const GRID_N = 120; // точек сетки по ширине плана
type MarkupTool = 'draw' | 'erase' | 'delroom';

interface SpaceModel {
  id: string;
  title: string;
  vb: number[]; // render units
  bg: { href: string; x: number; y: number; w: number; h: number } | null;
  rooms: RoomCfg[]; // render units
}

interface PdfRef {
  name: string;
  url: string;
}

/** Маркер конфига: правит/дополняет авто-устройство ИЛИ описывает ручной/виртуальный значок. */
interface Marker {
  id: string;
  binding: string; // 'device:<id>' | 'entity:<eid>' | 'virtual'
  space?: string | null;
  area?: string | null;
  hidden?: boolean;
  name?: string | null;
  icon?: string | null;
  model?: string | null;
  link?: string | null;
  description?: string | null;
  pdfs?: PdfRef[];
}

interface ServerConfig {
  spaces: any[];
  markers: Marker[];
  settings: { exclude_integrations?: string[]; group_lights?: boolean };
}

interface DevItem {
  id: string;
  name: string;
  model: string;
  area: string;
  space: string;
  icon: string;
  entities: string[];
  primary?: string;
  temp?: number | null;
  virtual?: boolean;
  marker?: Marker; // связанный маркер конфига (метаданные, оверрайды)
  bindingKind?: 'device' | 'entity' | 'virtual';
  bindingRef?: string; // device_id / entity_id
  link?: string | null;
  description?: string | null;
  pdfs?: PdfRef[];
}

interface CardConfig {
  type: string;
  title?: string;
  default_floor?: string;
  icon_size?: number;
  show_temperature?: boolean;
  live_states?: boolean;
  show_signal?: boolean;
}

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
  private _edit = false;
  private _layout: Record<string, { x: number; y: number; s?: string }> = {};
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
  private _tip: { x: number; y: number; title: string; meta: string; lqi?: number | null } | null = null;
  private _selId: string | null = null;
  private _toast = '';
  private _toastTimer?: number;

  // --- редактор разметки комнат ---
  private _markup = false;
  private _tool: MarkupTool = 'draw';
  private _path: number[][] = []; // текущий контур (рендер-единицы, вершины по сетке)
  private _pathSegs: (string | null)[] = []; // ключи сегментов, добавленных шагами контура
  private _cursorPt: number[] | null = null;
  private _areaSel = '';
  private _nameSel = '';
  private _roomDialog = false;
  // зум/панорама плана (зум сохраняется по пространству локально)
  private _zoom = 1;
  private _view: { x: number; y: number; w: number; h: number } | null = null; // текущий viewBox SVG (vb-координаты)
  private _zoomBySpace: Record<string, number> = {};
  private _pointers = new Map<number, { x: number; y: number }>();
  private _panStart: { sx: number; sy: number; vx: number; vy: number } | null = null;
  private _pinchStart: { dist: number; zoom: number } | null = null;
  private _suppressClick = false;
  private _roViewport?: ResizeObserver;
  private _onboardingShown = false; // авто-диалог пространства показан один раз за сессию

  private _infoCard: DevItem | null = null;
  private _markerDialog: {
    devId?: string;      // редактируемый значок (если есть)
    name: string;
    binding: string;     // 'device:<id>' | 'entity:<eid>' | 'virtual'
    bindingFilter: string;
    icon: string;        // '' = авто
    model: string;
    link: string;
    description: string;
    pdfs: PdfRef[];
    room: string;        // 'space#area' для виртуального
    busy: boolean;
  } | null = null;
  private _spaceDialog: {
    mode: 'edit' | 'create';
    spaceId?: string;
    title: string;
    planUrl: string | null;
    planFile: { ext: string; b64: string; aspect: number; name: string } | null;
    busy: boolean;
  } | null = null;
  private _keyHandler = (e: KeyboardEvent) => this._onKey(e);

  private _drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _space: { state: true },
    _edit: { state: true },
    _layout: { state: true },
    _devices: { state: true },
    _tip: { state: true },
    _selId: { state: true },
    _toast: { state: true },
    _serverCfg: { state: true },
    _markup: { state: true },
    _tool: { state: true },
    _path: { state: true },
    _cursorPt: { state: true },
    _areaSel: { state: true },
    _nameSel: { state: true },
    _roomDialog: { state: true },
    _spaceDialog: { state: true },
    _infoCard: { state: true },
    _markerDialog: { state: true },
    _zoom: { state: true },
    _view: { state: true },
  };

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._keyHandler);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('keydown', this._keyHandler);
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
      if (this._infoCard) { this._infoCard = null; return; }
      if (this._markerDialog) { this._markerDialog = null; return; }
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
    }
  }

  /** Убрать последнюю поставленную точку (и её линию, если она была добавлена этим шагом). */
  private _undoPoint(): void {
    if (!this._path.length) return;
    if (this._path.length === 1) {
      this._path = [];
      this._pathSegs = [];
      return;
    }
    const segKey = this._pathSegs[this._pathSegs.length - 1];
    this._pathSegs = this._pathSegs.slice(0, -1);
    if (segKey) this._removeSegmentByKey(segKey);
    this._path = this._path.slice(0, -1);
  }

  private _removeSegmentByKey(key: string): void {
    const sp = this._curSpaceCfg;
    if (!sp?.segments) return;
    const idx = this._segments.findIndex(
      (s) => this._segKey([s[0], s[1]], [s[2], s[3]]) === key,
    );
    if (idx >= 0) {
      sp.segments.splice(idx, 1);
      this._saveConfig();
    }
  }

  public static getConfigElement() {
    return document.createElement('houseplan-card-editor');
  }

  public static getStubConfig(): Partial<CardConfig> {
    return { type: 'custom:houseplan-card', title: 'План дома' };
  }

  public setConfig(config: CardConfig): void {
    this._config = { icon_size: 2.5, show_temperature: true, live_states: true, show_signal: true, ...config };
    if (config.default_floor) this._space = config.default_floor;
    try {
      this._zoomBySpace = JSON.parse(localStorage.getItem(LS_ZOOM) || '{}') || {};
    } catch {
      this._zoomBySpace = {};
    }
    // мгновенный рендер из кэша (stale-while-revalidate): показать план и значки
    // сразу, не дожидаясь ответа сервера — свежие данные догрузятся в фоне.
    try {
      const c = JSON.parse(localStorage.getItem(LS_CFG) || 'null');
      if (c && c.config && Array.isArray(c.config.spaces)) {
        this._serverCfg = c.config;
        this._cfgRev = c.rev || 0;
        this._layout = c.layout || {};
        this._serverStorage = true;
        if (config.default_floor) this._space = config.default_floor;
        else if (!this._model.find((sp) => sp.id === this._space)) this._space = this._model[0]?.id || this._space;
      }
    } catch {
      /* ignore */
    }
  }

  /** Сохранить снимок конфига+раскладки в localStorage для мгновенного старта. */
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

  // ================= РЕЗОЛВ МОДЕЛИ (серверная конфигурация) =================

  /** Есть ли серверная конфигурация с пространствами (иначе — онбординг). */
  private get _norm(): boolean {
    return !!(this._serverCfg && this._serverCfg.spaces.length);
  }

  /** Пространства в рендер-единицах (NORM_W × NORM_W/aspect). */
  private get _model(): SpaceModel[] {
    if (!this._serverCfg) return [];
    return this._serverCfg.spaces.map((s: any) => {
      const H = NORM_W / s.aspect;
      const scale = (r: any) => ({
        id: r.id,
        name: r.name,
        area: r.area ?? null,
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
    // онбординг: на пустом серверном конфиге сразу открываем диалог пространства
    if (
      this._serverStorage &&
      this._loadOk &&
      this._model.length === 0 &&
      !this._spaceDialog &&
      !this._onboardingShown
    ) {
      this._onboardingShown = true;
      this._openSpaceDialog('create');
    }
  }

  // ================= сервер: конфиг + раскладка =================

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
      // live-синхронизация: конфиг изменён в другом окне → перечитать
      if (!this._unsubCfg) {
        this._unsubCfg = await this.hass.connection.subscribeEvents((ev: any) => {
          if ((ev?.data?.rev ?? -1) !== this._cfgRev) this._reloadConfigOnly();
        }, 'houseplan_config_updated');
      }
      if (this._norm && !this._model.find((s) => s.id === this._space)) {
        this._space = this._model[0]?.id || this._space;
      }
      this._cacheSnapshot();
      this._restoreZoom();
    } catch (e) {
      // не последняя попытка — молча ждём следующего обновления hass (прогрев WS)
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
      // точечные обновления: не затираем позиции, изменённые в других окнах
      const ids = [...this._dirtyPos];
      this._dirtyPos.clear();
      for (const id of ids) {
        const pos = this._layout[id];
        if (!pos) continue;
        this.hass
          .callWS({ type: 'houseplan/layout/update', device_id: id, pos })
          .catch((e: any) => this._showToast('Не удалось сохранить позицию: ' + (e?.message || e)));
      }
      this._cacheSnapshot();
    } else {
      localStorage.setItem(LS_KEY, JSON.stringify(this._layout));
    }
  }, 600);

  // ================= устройства из реестров =================

  private _maybeRebuildDevices(): void {
    const h = this.hass;
    if (!h?.devices || !h?.entities || !h?.areas) return;
    const sig =
      Object.keys(h.devices).length + ':' + Object.keys(h.entities).length + ':' +
      Object.keys(h.areas).length + ':' + (this._norm ? 'n' : 'l');
    if (sig === this._regSignature && this._devices.length) return;
    this._regSignature = sig;
    this._devices = this._buildDevices();
    this._defPos = this._defaultPositions();
  }

  private _entitiesByDevice(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const [eid, ent] of Object.entries<any>(this.hass.entities)) {
      if (ent?.device_id) (map[ent.device_id] = map[ent.device_id] || []).push(eid);
    }
    return map;
  }

  private _domainOfDevice(dev: any, entIds: string[]): string {
    if (dev.identifiers?.[0]?.[0]) return dev.identifiers[0][0];
    for (const eid of entIds) {
      const p = this.hass.entities[eid]?.platform;
      if (p) return p;
    }
    return '';
  }

  private _primaryEntity(entIds: string[], icon: string): string | undefined {
    const ents = entIds
      .map((eid) => ({ eid, reg: this.hass.entities[eid], st: this.hass.states[eid] }))
      .filter((e) => e.reg && !e.reg.hidden);
    const usable = ents.filter((e) => !e.reg.entity_category);
    const pool = usable.length ? usable : ents;
    if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') {
      const t = pool.find((e) => this._isTempEntity(e.eid));
      if (t) return t.eid;
    }
    for (const dom of DOMAIN_PRIORITY) {
      const found = pool.find((e) => e.eid.split('.')[0] === dom);
      if (found) return found.eid;
    }
    return pool[0]?.eid;
  }

  private _isTempEntity(eid: string): boolean {
    const st = this.hass.states[eid];
    if (!st) return /_temperature$/.test(eid);
    const a = st.attributes || {};
    return (
      a.device_class === 'temperature' || /°C|°F/.test(a.unit_of_measurement || '') || /_temperature$/.test(eid)
    );
  }

  private _lqiFor(entIds: string[]): number | null {
    const vals: number[] = [];
    for (const eid of entIds) {
      const st = this.hass.states[eid];
      const isLqi = /_linkquality$/.test(eid) || (st?.attributes?.unit_of_measurement || '') === 'lqi';
      if (!isLqi || !st) continue;
      const v = parseFloat(st.state);
      if (!isNaN(v)) vals.push(v);
    }
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  private _roomLqi(area: string | null): number | null {
    if (!area) return null;
    const vals: number[] = [];
    for (const d of this._devices) {
      if (d.area !== area || d.virtual) continue;
      const l = this._lqiFor(d.entities);
      if (l != null) vals.push(l);
    }
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  private _tempFor(entIds: string[]): number | null {
    for (const eid of entIds) {
      if (!this._isTempEntity(eid)) continue;
      const st = this.hass.states[eid];
      if (!st) continue;
      const v = parseFloat(st.state);
      if (!isNaN(v)) return Math.round(v * 10) / 10;
    }
    return null;
  }

  /** Групповые световые сущности: HA light-group (platform=group) и Z2M-группы (device model=Group). */
  private _lightGroups(): { eid: string; name: string; area: string }[] {
    if (this._settings.group_lights === false) return [];
    const h = this.hass;
    const res: { eid: string; name: string; area: string }[] = [];
    for (const [eid, reg] of Object.entries<any>(h.entities)) {
      if (!eid.startsWith('light.') || reg.hidden) continue;
      let area: string | null = null;
      if (reg.platform === 'group') {
        area = reg.area_id || null;
      } else if (reg.device_id) {
        const dev = h.devices[reg.device_id];
        if (dev?.model === 'Group') area = dev.area_id || reg.area_id || null;
        else continue;
      } else {
        continue;
      }
      if (!area) continue;
      const st = h.states[eid];
      res.push({ eid, name: reg.name || st?.attributes?.friendly_name || eid, area });
    }
    return res;
  }

  /** Зоны, в которых есть группа света (одиночные лампы там скрываются). */
  private _groupedLightAreas(): Set<string> {
    return new Set(this._lightGroups().map((g) => g.area));
  }

  /** Курирование + группы света + оверрайды + виртуальные устройства. */
  private get _markers(): Marker[] {
    return this._serverCfg?.markers || [];
  }

  /** Маркер по «claim key»: device:<id> / entity:<eid>. */
  private _markerFor(kind: 'device' | 'entity', ref: string): Marker | undefined {
    return this._markers.find((m) => m.binding === kind + ':' + ref);
  }

  /** Множество HA-ссылок (device_id/entity_id), «занятых» маркерами. */
  private get _claimed(): Set<string> {
    const set = new Set<string>();
    for (const m of this._markers) {
      const [kind, ref] = m.binding.split(':');
      if ((kind === 'device' || kind === 'entity') && ref) set.add(m.binding);
    }
    return set;
  }

  private _applyMarker(item: DevItem, m: Marker): void {
    item.marker = m;
    if (m.name) item.name = m.name;
    if (m.icon) item.icon = m.icon;
    if (m.model != null) item.model = m.model;
    item.link = m.link ?? null;
    item.description = m.description ?? null;
    item.pdfs = m.pdfs || [];
  }

  /** Курирование + группы света + маркеры (метаданные/перепривязка) + виртуальные. Гибрид. */
  private _buildDevices(): DevItem[] {
    const h = this.hass;
    const areaMap = this._areaToSpace;
    const groupLights = this._settings.group_lights !== false;
    const groupedAreas = this._groupedLightAreas();
    const excluded = this._excluded;
    const entsBy = this._entitiesByDevice();
    const claimed = this._claimed;
    const seen: Record<string, 1> = {};
    const rest: DevItem[] = [];

    // 1) авто-устройства HA (не занятые маркером, не скрытые)
    for (const dev of Object.values<any>(h.devices)) {
      const area = dev.area_id;
      if (!area || !areaMap[area]) continue;
      if (dev.entry_type === 'service') continue;
      if (claimed.has('device:' + dev.id)) continue; // маркер перекроет ниже
      const marker = this._markerFor('device', dev.id);
      if (marker && marker.hidden) continue;
      const entIds = entsBy[dev.id] || [];
      const dom = this._domainOfDevice(dev, entIds);
      if (excluded.has(dom)) continue;
      if (dev.model === 'Group') continue;
      if (/scene/i.test(dev.model || '')) continue;
      if (/bridge/i.test((dev.model || '') + (dev.name || ''))) continue;
      if (dom === 'myheat' && dev.via_device_id) continue;
      const name = (dev.name_by_user || dev.name || 'без имени').trim();
      const key = name + '|' + area;
      if (seen[key]) continue;
      seen[key] = 1;
      let icon = iconFor(name, dev.model);
      if (entIds.some((e) => e.startsWith('lock.'))) icon = 'mdi:lock';
      if (groupLights && icon === 'mdi:lightbulb' && groupedAreas.has(area)) continue;
      const item: DevItem = {
        id: dev.id,
        name,
        model: dev.model || '',
        area,
        space: areaMap[area].space,
        icon,
        entities: entIds,
        bindingKind: 'device',
        bindingRef: dev.id,
        pdfs: [],
      };
      item.primary = this._primaryEntity(entIds, icon);
      if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = this._tempFor(entIds);
      rest.push(item);
    }

    // 2) группы света (не занятые маркером)
    for (const g of this._lightGroups()) {
      if (!areaMap[g.area]) continue;
      if (claimed.has('entity:' + g.eid)) continue;
      rest.push({
        id: 'lg_' + g.eid,
        name: g.name,
        model: 'группа света',
        area: g.area,
        space: areaMap[g.area].space,
        icon: 'mdi:lightbulb-group',
        entities: [g.eid],
        primary: g.eid,
        bindingKind: 'entity',
        bindingRef: g.eid,
        pdfs: [],
      });
    }

    // 3) явные маркеры (перепривязка/метаданные/виртуальные)
    for (const m of this._markers) {
      if (m.hidden) continue;
      const [kind, ref] = m.binding.split(':');
      if (kind === 'device') {
        const dev = h.devices[ref];
        const area = m.area || dev?.area_id || '';
        const space = (area && areaMap[area]?.space) || m.space || this._model[0]?.id || '';
        const entIds = dev ? entsBy[dev.id] || [] : [];
        let icon = dev ? iconFor(dev.name_by_user || dev.name || '', dev.model) : 'mdi:help-circle';
        if (entIds.some((e) => e.startsWith('lock.'))) icon = 'mdi:lock';
        const item: DevItem = {
          id: m.id,
          name: dev?.name_by_user || dev?.name || 'устройство',
          model: dev?.model || '',
          area,
          space,
          icon,
          entities: entIds,
          bindingKind: 'device',
          bindingRef: ref,
        };
        item.primary = this._primaryEntity(entIds, icon);
        if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = this._tempFor(entIds);
        this._applyMarker(item, m);
        rest.push(item);
      } else if (kind === 'entity') {
        const reg = h.entities[ref];
        const area = m.area || reg?.area_id || (reg?.device_id && h.devices[reg.device_id]?.area_id) || '';
        const space = (area && areaMap[area]?.space) || m.space || this._model[0]?.id || '';
        const st = h.states[ref];
        const item: DevItem = {
          id: m.id,
          name: reg?.name || st?.attributes?.friendly_name || ref,
          model: '',
          area,
          space,
          icon: 'mdi:shape-outline',
          entities: [ref],
          primary: ref,
          bindingKind: 'entity',
          bindingRef: ref,
        };
        this._applyMarker(item, m);
        rest.push(item);
      } else {
        // виртуальный
        const area = m.area || '';
        const space = m.space || (area && areaMap[area]?.space) || this._model[0]?.id || '';
        const item: DevItem = {
          id: m.id,
          name: m.name || 'виртуальное устройство',
          model: m.model || '',
          area,
          space,
          icon: m.icon || 'mdi:map-marker',
          entities: [],
          bindingKind: 'virtual',
          virtual: true,
        };
        this._applyMarker(item, m);
        rest.push(item);
      }
    }
    return rest;
  }

  // ================= позиции =================

  /** Ограничивающий прямоугольник комнаты (rect или полигон) в рендер-единицах. */
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
    for (const s of this._model) {
      for (const r of s.rooms) {
        if (!r.area) continue;
        const ds = this._devices.filter((d) => d.area === r.area && d.space === s.id);
        if (!ds.length) continue;
        const b = this._roomBounds(r);
        const pad = Math.min(b.w, b.h) * 0.12;
        const iw = b.w - pad * 2;
        const ih = b.h - pad * 2;
        const cols = Math.max(1, Math.round(Math.sqrt((ds.length * iw) / Math.max(ih, 1))));
        const rows = Math.ceil(ds.length / cols);
        const cw = iw / cols;
        const ch = ih / Math.max(rows, 1);
        ds.forEach((d, i) => {
          const c = i % cols;
          const rw = Math.floor(i / cols);
          map[d.id] = { x: b.x + pad + cw * (c + 0.5), y: b.y + pad + ch * (rw + 0.5) };
        });
      }
    }
    return map;
  }

  /** Позиция устройства в рендер-единицах текущего пространства. */
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
      // центр иконки привязывается к узлам той же сетки, что и разметка комнат
      const g = this._gridPitch;
      const gx = Math.round(x / g) * g;
      const gy = Math.round(y / g) * g;
      const aspect = this._serverCfg!.spaces.find((s: any) => s.id === d.space)?.aspect || 1;
      this._layout = {
        ...this._layout,
        [d.id]: { s: d.space, x: gx / NORM_W, y: gy / (NORM_W / aspect) },
      };
    } else {
      this._layout = { ...this._layout, [d.id]: { x: Math.round(x), y: Math.round(y) } };
    }
    this._dirtyPos.add(d.id);
    this._persistLayout();
  }

  // ================= живые состояния =================

  private _stateClass(d: DevItem): string {
    if (!this._config?.live_states) return '';
    const p = d.primary ? this.hass.states[d.primary] : undefined;
    if (!p) return '';
    if (p.state === 'unavailable') return 'unavail';
    const dom = p.entity_id.split('.')[0];
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
    return this._tempFor(d.entities);
  }

  // ================= взаимодействие =================

  private _openMoreInfo(entityId?: string): void {
    if (!entityId) {
      this._showToast('У устройства нет подходящей сущности');
      return;
    }
    fireEvent(this, 'hass-more-info', { entityId });
  }

  private _clickDevice(ev: MouseEvent, d: DevItem): void {
    ev.stopPropagation();
    if (this._drag?.moved || this._suppressClick) return;
    if (this._markup) return;
    if (this._edit) {
      this._selId = d.id;
      this._openMarkerDialog(d);
      return;
    }
    this._infoCard = d;
  }

  private get _stageEl(): HTMLElement | null {
    return this.renderRoot.querySelector('.stage') as HTMLElement | null;
  }

  /** Соотношение сторон сцены (ширина/высота, px). */
  private _stageAspect(): number {
    const s = this._stageEl;
    const vb = this._spaceModel().vb;
    return s && s.clientHeight ? s.clientWidth / s.clientHeight : vb[2] / vb[3];
  }

  /** Прямоугольник «contain» с аспектом сцены, вмещающий весь план (vb). */
  private _fitView(vb: number[], aspect: number): { x: number; y: number; w: number; h: number } {
    const planA = vb[2] / vb[3];
    if (aspect > planA) {
      const h = vb[3], w = vb[3] * aspect;
      return { x: vb[0] - (w - vb[2]) / 2, y: vb[1], w, h };
    }
    const w = vb[2], h = vb[2] / aspect;
    return { x: vb[0], y: vb[1] - (h - vb[3]) / 2, w, h };
  }

  /** Текущий view с фолбэком на полный fit. */
  private _viewOr(vb: number[]): { x: number; y: number; w: number; h: number } {
    return this._view && this._view.w ? this._view : this._fitView(vb, this._stageAspect());
  }

  /** Экран (sx,sy относительно сцены, px) → координаты vb по текущему view. */
  private _screenToVb(sx: number, sy: number): number[] {
    const s = this._stageEl;
    const v = this._viewOr(this._spaceModel().vb);
    const w = s?.clientWidth || 1, h = s?.clientHeight || 1;
    return [v.x + (sx / w) * v.w, v.y + (sy / h) * v.h];
  }

  /** Ограничить view пределами fit (контент всегда покрывает сцену). */
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

  /** Установить зум (центр — точка vb cx,cy либо центр текущего view). */
  private _applyView(zoom: number, cx?: number, cy?: number): void {
    const vb = this._spaceModel().vb;
    const fit = this._fitView(vb, this._stageAspect());
    const z = Math.min(8, Math.max(1, zoom));
    const w = fit.w / z, h = fit.h / z;
    const cur = this._viewOr(vb);
    const ccx = cx ?? cur.x + cur.w / 2;
    const ccy = cy ?? cur.y + cur.h / 2;
    this._zoom = z;
    this._view = this._clampView({ x: ccx - w / 2, y: ccy - h / 2, w, h }, fit);
  }

  /** Пересчитать view под новый размер сцены, сохранив зум и центр. */
  private _refitView(): void {
    if (!this._stageEl) return;
    const cur = this._view;
    this._applyView(this._zoom, cur ? cur.x + cur.w / 2 : undefined, cur ? cur.y + cur.h / 2 : undefined);
    this.requestUpdate();
  }

  /** Изменить зум, удерживая точку (sx,sy относительно сцены) на месте. */
  private _zoomAt(sx: number, sy: number, newZoom: number): void {
    const stage = this._stageEl;
    if (!stage) return;
    const vb = this._spaceModel().vb;
    const fit = this._fitView(vb, this._stageAspect());
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
    this._view = this._fitView(vb, this._stageAspect());
    this._saveZoom();
  }

  /** Сохранить текущий зум пространства в localStorage. */
  private _saveZoom(): void {
    this._zoomBySpace = { ...this._zoomBySpace, [this._space]: this._zoom };
    try {
      localStorage.setItem(LS_ZOOM, JSON.stringify(this._zoomBySpace));
    } catch {
      /* ignore */
    }
  }

  /** Восстановить сохранённый зум пространства и центрировать план. */
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
    // не мешать перетаскиванию иконок и рисованию разметки
    if (this._drag || this._markup) return;
    if ((ev.target as HTMLElement).closest('.dev')) return;
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
      if (Math.abs(ddx) + Math.abs(ddy) > 4) this._suppressClick = true;
      if (this._zoom > 1 && this._view) {
        const stage = this._stageEl!;
        const v = this._view;
        const fit = this._fitView(this._spaceModel().vb, this._stageAspect());
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
    this._pointers.delete(ev.pointerId);
    if (this._pointers.size < 2) this._pinchStart = null;
    if (this._pointers.size === 0) {
      this._panStart = null;
      // сбросить подавление клика на следующий тик (чтобы click после pan не сработал)
      setTimeout(() => (this._suppressClick = false), 0);
    }
  }

  private _clickRoom(r: RoomCfg): void {
    if (this._suppressClick || this._edit || !r.area) return;
    navigate('/config/areas/area/' + r.area);
  }

  private _pointerDown(ev: PointerEvent, d: DevItem): void {
    if (!this._edit) return;
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
    if (Math.abs(ev.clientX - this._drag.sx) + Math.abs(ev.clientY - this._drag.sy) > 3) this._drag.moved = true;
    const m = Math.min(vb[2], vb[3]) * 0.008;
    const nx = Math.max(vb[0] + m, Math.min(vb[0] + vb[2] - m, this._drag.ox + dx));
    const ny = Math.max(vb[1] + m, Math.min(vb[1] + vb[3] - m, this._drag.oy + dy));
    this._savePos(d, nx, ny);
  }

  private _pointerUp(_ev: PointerEvent, d: DevItem): void {
    if (!this._drag || this._drag.id !== d.id) return;
    const moved = this._drag.moved;
    this._drag = moved ? this._drag : null;
    if (moved) {
      this._selId = d.id;
      window.setTimeout(() => (this._drag = null), 0);
    }
  }

  private _applyXY(axis: 'x' | 'y', val: string): void {
    if (!this._selId) return;
    const n = parseFloat(val);
    if (isNaN(n)) return;
    const d = this._devices.find((x) => x.id === this._selId);
    if (!d || d.virtual) return;
    const p = { ...this._pos(d) };
    p[axis] = n;
    this._savePos(d, p.x, p.y);
  }

  private _resetLayout(): void {
    if (!confirm('Сбросить позиции всех иконок к авто-раскладке?')) return;
    this._layout = {};
    this._persistLayout();
  }

  private _showToast(msg: string): void {
    this._toast = msg;
    clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => {
      this._toast = '';
    }, 3500);
  }

  private _showTip(ev: MouseEvent, title: string, meta: string, lqi?: number | null): void {
    if (this._drag) return;
    this._tip = { x: ev.clientX, y: ev.clientY, title, meta, lqi };
  }

  // ================= РЕДАКТОР РАЗМЕТКИ КОМНАТ =================

  private get _gridPitch(): number {
    return NORM_W / GRID_N;
  }

  private get _curSpaceCfg(): any {
    return this._serverCfg?.spaces.find((s: any) => s.id === this._space);
  }

  private get _spaceH(): number {
    const sp = this._curSpaceCfg;
    return sp ? NORM_W / sp.aspect : NORM_W;
  }

  /** Сегменты текущего пространства в рендер-единицах. */
  private get _segments(): number[][] {
    const sp = this._curSpaceCfg;
    const H = this._spaceH;
    return (sp?.segments || []).map((s: number[]) => [s[0] * NORM_W, s[1] * H, s[2] * NORM_W, s[3] * H]);
  }

  private _toggleMarkup(): void {
    if (!this._norm) {
      this._showToast('Разметка доступна после переноса конфига на сервер (режим правки → «На сервер»)');
      return;
    }
    this._markup = !this._markup;
    this._edit = false;
    this._path = [];
    this._cursorPt = null;
    this._tool = 'draw';
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

  private _segKey(a: number[], b: number[]): string {
    return segKeyOf(a, b);
  }

  private _saveConfig = debounce(() => {
    if (!this._serverCfg) return;
    this.hass
      .callWS({ type: 'houseplan/config/set', config: this._serverCfg, expected_rev: this._cfgRev })
      .then((r: any) => {
        this._cfgRev = r?.rev ?? this._cfgRev + 1;
      })
      .catch((e: any) => {
        if (e?.code === 'conflict') {
          this._showToast('Конфиг изменён в другом окне — данные обновлены, повторите последнее действие');
          this._cancelPath();
          this._reloadConfigOnly();
        } else {
          this._showToast('Не удалось сохранить конфиг: ' + (e?.message || e));
        }
      });
  }, 500);

  /** Добавить сегмент (рендер-единицы) в каркас пространства (без дублей). true = новый. */
  private _addSegment(a: number[], b: number[]): boolean {
    const sp = this._curSpaceCfg;
    if (!sp) return false;
    const H = this._spaceH;
    const key = this._segKey(a, b);
    const exists = this._segments.some((s) => this._segKey([s[0], s[1]], [s[2], s[3]]) === key);
    if (exists) return false;
    sp.segments = sp.segments || [];
    sp.segments.push([a[0] / NORM_W, a[1] / H, b[0] / NORM_W, b[1] / H]);
    this._saveConfig();
    return true;
  }

  private _distToSeg(p: number[], s: number[]): number {
    const [x, y] = p;
    const [x1, y1, x2, y2] = s;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - x1) * dx + (y - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    return Math.hypot(x - px, y - py);
  }

  private _pointInRoom(p: number[], r: RoomCfg): boolean {
    if (r.poly) return pointInPolygon(p, r.poly);
    return (
      r.x != null && p[0] >= r.x! && p[0] <= r.x! + r.w! && p[1] >= r.y! && p[1] <= r.y! + r.h!
    );
  }

  private _markupClick(ev: MouseEvent): void {
    if (!this._markup) return;
    const raw = this._svgPoint(ev);
    if (this._tool === 'erase') {
      const sp = this._curSpaceCfg;
      if (!sp?.segments?.length) return;
      const segs = this._segments;
      let best = -1;
      let bestD = this._gridPitch * 0.5;
      segs.forEach((s, i) => {
        const d = this._distToSeg(raw, s);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        sp.segments.splice(best, 1);
        this._saveConfig();
        this.requestUpdate();
      }
      return;
    }
    if (this._tool === 'delroom') {
      const space = this._spaceModel();
      const room = [...space.rooms].reverse().find((r) => this._pointInRoom(raw, r));
      if (!room) return;
      if (!confirm(`Удалить комнату «${room.name}»?`)) return;
      const sp = this._curSpaceCfg;
      sp.rooms = sp.rooms.filter((r: any) => r.id !== room.id);
      this._saveConfig();
      this._regSignature = '';
      this._maybeRebuildDevices();
      this.requestUpdate();
      return;
    }
    // draw: клики по точкам сетки, пары точек соединяются линией
    const pt = this._snap(raw);
    if (!this._path.length) {
      this._path = [pt];
      this._pathSegs = [];
      return;
    }
    const last = this._path[this._path.length - 1];
    if (this._samePt(pt, last)) return; // повторный клик по той же точке
    const added = this._addSegment(last, pt);
    this._pathSegs = [...this._pathSegs, added ? this._segKey(last, pt) : null];
    this._path = [...this._path, pt];
    // замыкание: клик по первой вершине → диалог сохранения
    if (this._path.length >= 4 && this._samePt(pt, this._path[0])) {
      this._cursorPt = null;
      this._nameSel = '';
      this._areaSel = '';
      this._roomDialog = true;
    }
  }

  private get _contourClosed(): boolean {
    return this._path.length >= 4 && this._samePt(this._path[0], this._path[this._path.length - 1]);
  }

  private _markupMove(ev: MouseEvent): void {
    if (!this._markup || this._tool !== 'draw' || !this._path.length || this._contourClosed) {
      return;
    }
    this._cursorPt = this._snap(this._svgPoint(ev));
  }

  /** Сохранить комнату с обязательной привязкой к зоне HA. */
  private _saveRoom(): void {
    if (!this._areaSel) return;
    this._commitRoom();
  }

  /** Сохранить декоративную комнату без зоны (нужно только имя). */
  private _saveRoomNoArea(): void {
    if (!this._nameSel.trim()) return;
    this._areaSel = '';
    this._commitRoom();
  }

  private _commitRoom(): void {
    if (!this._contourClosed) return;
    const sp = this._curSpaceCfg;
    if (!sp) return;
    const H = this._spaceH;
    const verts = this._path.slice(0, -1); // без дублированной замыкающей
    const areaName = this._areaSel ? this.hass.areas[this._areaSel]?.name : '';
    sp.rooms.push({
      id: 'r' + Date.now().toString(36),
      name: this._nameSel || areaName || 'Комната',
      area: this._areaSel || null,
      poly: verts.map((p) => [p[0] / NORM_W, p[1] / H]),
    });
    this._saveConfig();
    this._path = [];
    this._pathSegs = [];
    const boundArea = this._areaSel;
    this._areaSel = '';
    this._nameSel = '';
    this._roomDialog = false;
    this._regSignature = '';
    this._maybeRebuildDevices();
    // авто-добавление значков устройств зоны — через _defaultPositions (сетка внутри контура)
    const added = boundArea ? this._devices.filter((d) => d.area === boundArea).length : 0;
    this._showToast(
      boundArea
        ? `Комната сохранена — добавлено устройств: ${added}`
        : 'Комната сохранена (без зоны)',
    );
  }

  private _cancelPath(): void {
    this._path = [];
    this._pathSegs = [];
    this._cursorPt = null;
    this._roomDialog = false;
  }

  /** Отмена в диалоге: контур снова открыт (замыкающая точка снимается). */
  private _roomDialogCancel(): void {
    this._roomDialog = false;
    this._undoPoint();
  }

  /** Зоны HA, ещё не назначенные ни одной комнате конфига. */
  private get _freeAreas(): any[] {
    const used = new Set<string>();
    for (const sp of this._serverCfg?.spaces || [])
      for (const r of sp.rooms || []) if (r.area) used.add(r.area);
    return Object.values<any>(this.hass?.areas || {})
      .filter((a) => !used.has(a.area_id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  // ================= РЕДАКТОР УСТРОЙСТВ (маркеры) =================

  private _openMarkerDialog(d?: DevItem): void {
    if (!this._norm) {
      this._showToast('Редактирование устройств доступно после переноса конфига на сервер');
      return;
    }
    if (d) {
      this._markerDialog = {
        devId: d.id,
        name: d.name,
        binding: d.bindingKind === 'virtual' ? 'virtual' : d.bindingKind + ':' + d.bindingRef,
        bindingFilter: '',
        icon: d.marker?.icon || '',
        model: d.model || '',
        link: d.link || '',
        description: d.description || '',
        pdfs: [...(d.pdfs || [])],
        room: d.space && d.area ? d.space + '#' + d.area : '',
        busy: false,
      };
    } else {
      this._markerDialog = {
        name: '', binding: 'virtual', bindingFilter: '', icon: '', model: '',
        link: '', description: '', pdfs: [], room: '', busy: false,
      };
    }
  }

  /** Кандидаты привязки: устройства HA + группы/хелпер-сущности, минус уже размещённые. */
  private _bindingCandidates(): { value: string; label: string; sub: string }[] {
    const h = this.hass;
    const taken = new Set<string>();
    for (const dev of this._devices) {
      if (dev.id === this._markerDialog?.devId) continue;
      if (dev.bindingKind === 'device' && dev.bindingRef) taken.add('device:' + dev.bindingRef);
      if (dev.bindingKind === 'entity' && dev.bindingRef) taken.add('entity:' + dev.bindingRef);
    }
    // дедуп как на плане: скрыть устройства с тем же «имя|area», что уже показаны (дубли Tuya)
    const shownKeys = new Set<string>();
    for (const dev of this._devices) {
      if (dev.bindingKind === 'device' && dev.name) shownKeys.add(dev.name.trim() + '|' + (dev.area || ''));
    }
    const list: { value: string; label: string; sub: string }[] = [];
    // устройства (в т.ч. Z2M-группы model=Group)
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.entry_type === 'service') continue;
      const v = 'device:' + dev.id;
      if (taken.has(v)) continue;
      const name = (dev.name_by_user || dev.name || dev.id).trim();
      if (v !== this._markerDialog?.binding && shownKeys.has(name + '|' + (dev.area_id || ''))) continue;
      list.push({ value: v, label: name, sub: (dev.model || 'устройство') + (dev.model === 'Group' ? ' · Z2M-группа' : '') });
    }
    // group/helper-сущности без «своего» физического устройства
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
        sub: eid.split('.')[0] + ' · ' + (reg.platform === 'group' ? 'группа' : 'хелпер'),
      });
    }
    const f = (this._markerDialog?.bindingFilter || '').toLowerCase().trim();
    const filtered = f
      ? list.filter((o) => (o.label + ' ' + o.sub + ' ' + o.value).toLowerCase().includes(f))
      : list;
    filtered.sort((a, b) => a.label.localeCompare(b.label));
    return filtered.slice(0, 200);
  }

  /** Список комнат всех пространств для виртуального устройства. */
  private _allRoomsFlat(): { value: string; label: string }[] {
    const res: { value: string; label: string }[] = [];
    for (const sp of this._serverCfg?.spaces || []) {
      for (const r of sp.rooms || []) {
        if (!r.area) continue;
        res.push({ value: sp.id + '#' + r.area, label: (sp.title || sp.id) + ' · ' + r.name });
      }
    }
    return res;
  }

  /** Читаемый текст ошибки (никогда не «[object Object]»). */
  private _errText(e: any): string {
    if (!e) return 'неизвестная ошибка';
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    if (e.error) return e.error;
    if (e.code != null) return 'код ' + e.code;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }

  /**
   * Загрузка файлов-инструкций через HTTP (multipart) — не через WebSocket, у которого лимит
   * размера сообщения рвёт соединение на больших PDF.
   */
  private async _pickMarkerFiles(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = input.files ? [...input.files] : [];
    input.value = '';
    if (!files.length || !this._markerDialog) return;
    const mid = this._markerDialog.devId || 'new';
    const token = this.hass?.auth?.data?.access_token;
    const uploaded: PdfRef[] = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append('marker_id', mid);
        fd.append('file', file, file.name);
        const resp = await fetch('/api/houseplan/upload', {
          method: 'POST',
          body: fd,
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.error) {
          const map: Record<string, string> = {
            too_large: 'файл больше ' + (json.max_mb || 25) + ' МБ',
            bad_ext: 'недопустимый тип (нужен PDF/изображение)',
            unauthorized: 'нужны права администратора',
          };
          throw new Error(map[json.error] || json.error || 'HTTP ' + resp.status);
        }
        uploaded.push({ name: json.name || file.name, url: json.url });
      } catch (e: any) {
        this._showToast('Файл «' + file.name + '» не загружен: ' + this._errText(e));
      }
    }
    // диалог мог закрыться за время загрузки — добавляем, только если он ещё открыт
    if (uploaded.length && this._markerDialog) {
      this._markerDialog = { ...this._markerDialog, pdfs: [...this._markerDialog.pdfs, ...uploaded] };
      this._showToast('Прикреплено файлов: ' + uploaded.length);
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
    if (dlg.binding === 'virtual' && !dlg.name.trim()) {
      this._showToast('Укажите имя виртуального устройства');
      return;
    }
    this._markerDialog = { ...dlg, busy: true };
    try {
      const cfg = this._serverCfg!;
      cfg.markers = cfg.markers || [];
      // определить id маркера
      let id: string;
      // комната (выбранная вручную) переопределяет пространство/зону для любого значка
      const [roomSp, roomAr] = dlg.room ? dlg.room.split('#') : ['', ''];
      let space: string | null = roomSp || null;
      let area: string | null = roomAr || null;
      if (dlg.binding === 'virtual' && !space) space = this._space;
      id = markerIdForBinding(dlg.binding, dlg.devId, () => 'v_' + Date.now().toString(36));
      const oldId = dlg.devId;
      const marker: Marker = {
        id,
        binding: dlg.binding,
        name: dlg.name.trim() || null,
        icon: dlg.icon || null,
        model: dlg.model.trim() || null,
        link: dlg.link.trim() || null,
        description: dlg.description.trim() || null,
        pdfs: dlg.pdfs,
      };
      // сохраняем выбор комнаты (для виртуальных всегда; для привязанных — если выбрана)
      if (dlg.binding === 'virtual' || dlg.room) {
        marker.space = space;
        marker.area = area;
      }
      // сменилась комната → переставить значок в её центр
      const prevDev = oldId ? this._devices.find((x) => x.id === oldId) : null;
      const roomChanged = !!dlg.room && prevDev != null && (prevDev.space !== space || prevDev.area !== area);
      // удалить прежний маркер (по старому id и по новому id)
      cfg.markers = cfg.markers.filter((m) => m.id !== id && m.id !== oldId);
      cfg.markers.push(marker);
      // позиция: новый значок ИЛИ сменилась комната → поставить в центр комнаты/пространства
      if (!this._layout[id] || roomChanged) {
        const spm = this._spaceModel(space || undefined);
        let cx = spm.vb[0] + spm.vb[2] / 2;
        let cy = spm.vb[1] + spm.vb[3] / 2;
        if (area) {
          const room = spm.rooms.find((r) => r.area === area);
          if (room) [cx, cy] = this._roomCenter(room);
        }
        this._layout[id] = this._normPos(space || this._space, cx, cy);
      }
      await this._saveConfigNow();
      await this.hass.callWS({ type: 'houseplan/layout/set', layout: this._layout });
      this._markerDialog = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast('Устройство сохранено');
    } catch (e: any) {
      this._markerDialog = { ...this._markerDialog!, busy: false };
      this._showToast('Ошибка: ' + (e?.message || e));
    }
  }

  private async _deleteMarker(): Promise<void> {
    const dlg = this._markerDialog;
    if (!dlg) return;
    const d = dlg.devId ? this._devices.find((x) => x.id === dlg.devId) : null;
    const label = dlg.name || 'устройство';
    if (!confirm(`Убрать «${label}» с плана?`)) return;
    const cfg = this._serverCfg!;
    cfg.markers = cfg.markers || [];
    if (d && d.bindingKind === 'virtual') {
      cfg.markers = cfg.markers.filter((m) => m.id !== d.id);
    } else if (d && d.marker) {
      // был явный маркер → просто скрыть либо удалить: скрываем (авто вернётся если это авто-устройство)
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
      this._markerDialog = null;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast('Устройство убрано с плана');
    } catch (e: any) {
      this._showToast('Ошибка: ' + (e?.message || e));
    }
  }

  private _normPos(space: string, x: number, y: number): { s: string; x: number; y: number } {
    const aspect = this._serverCfg!.spaces.find((s: any) => s.id === space)?.aspect || 1;
    return { s: space, x: x / NORM_W, y: y / (NORM_W / aspect) };
  }

  // ================= УПРАВЛЕНИЕ ПРОСТРАНСТВАМИ =================

  private _openSpaceDialog(mode: 'edit' | 'create', spaceId?: string): void {
    if (!this._serverStorage || !this._serverCfg) {
      this._showToast('Интеграция House Plan не установлена — управление недоступно');
      return;
    }
    if (mode === 'edit') {
      const sp = this._serverCfg!.spaces.find((x: any) => x.id === spaceId);
      if (!sp) return;
      this._spaceDialog = { mode, spaceId, title: sp.title, planUrl: sp.plan_url || null, planFile: null, busy: false };
    } else {
      this._spaceDialog = { mode, title: '', planUrl: null, planFile: null, busy: false };
    }
  }

  /** Выбор файла подложки: читаем base64 и определяем пропорции. */
  private async _pickPlanFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this._spaceDialog) return;
    const extMap: Record<string, string> = {
      'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    };
    const ext = extMap[file.type] || (file.name.toLowerCase().endsWith('.svg') ? 'svg' : '');
    if (!ext) {
      this._showToast('Поддерживаются SVG, PNG, JPG, WebP');
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
    const b64 = btoa(bin);
    // пропорции: рендерим в Image
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
    if (!d.planFile && !d.planUrl) {
      this._showToast('Загрузите подложку — план этажа обязателен');
      return;
    }
    const wasFirst = d.mode === 'create' && (this._serverCfg?.spaces.length || 0) === 0;
    this._spaceDialog = { ...d, busy: true };
    try {
      const cfg = this._serverCfg!;
      let sp: any;
      if (d.mode === 'create') {
        sp = {
          id: 's' + Date.now().toString(36),
          title: d.title.trim(),
          plan_url: null,
          aspect: 1.414,
          view_box: [0, 0, 1, 1],
          rooms: [],
          segments: [],
        };
        cfg.spaces.push(sp);
      } else {
        sp = cfg.spaces.find((x: any) => x.id === d.spaceId);
        sp.title = d.title.trim();
      }
      if (d.planFile) {
        const resp = await this.hass.callWS({
          type: 'houseplan/plan/set', space_id: sp.id, ext: d.planFile.ext, data: d.planFile.b64,
        });
        sp.plan_url = resp.url;
        sp.aspect = d.planFile.aspect;
      }
      await this._saveConfigNow();
      this._spaceDialog = null;
      if (d.mode === 'create') this._space = sp.id;
      this._regSignature = '';
      this._maybeRebuildDevices();
      if (wasFirst) {
        // ведём пользователя дальше: сразу в режим разметки комнат
        this._edit = false;
        this._markup = true;
        this._tool = 'draw';
        this._path = [];
        this._cursorPt = null;
        this._showToast('Пространство добавлено. Обведите комнаты: кликайте по точкам сетки и замкните контур.');
      } else {
        this._showToast(d.mode === 'create' ? 'Пространство добавлено' : 'Пространство сохранено');
      }
    } catch (e: any) {
      this._spaceDialog = { ...this._spaceDialog!, busy: false };
      this._showToast('Ошибка: ' + (e?.message || e));
    }
  }

  private async _deleteSpace(): Promise<void> {
    const d = this._spaceDialog;
    if (!d || d.mode !== 'edit') return;
    const sp = this._serverCfg!.spaces.find((x: any) => x.id === d.spaceId);
    if (!confirm(`Удалить пространство «${sp.title}» со всеми комнатами и разметкой?`)) return;
    this._serverCfg!.spaces = this._serverCfg!.spaces.filter((x: any) => x.id !== d.spaceId);
    try {
      await this._saveConfigNow();
      this._spaceDialog = null;
      if (this._space === d.spaceId) this._space = this._serverCfg!.spaces[0]?.id || '';
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast('Пространство удалено');
    } catch (e: any) {
      this._showToast('Ошибка удаления: ' + (e?.message || e));
    }
  }

  /** Немедленное сохранение конфига с ревизией (без дебаунса). */
  private async _saveConfigNow(): Promise<void> {
    const r = await this.hass.callWS({
      type: 'houseplan/config/set', config: this._serverCfg, expected_rev: this._cfgRev,
    });
    this._cfgRev = r?.rev ?? this._cfgRev + 1;
  }


  // ================= рендер =================

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const model = this._model;
    if (!model.length) {
      return html`<ha-card>
        <div class="head">
          <div class="title"><ha-icon icon="mdi:home-city"></ha-icon>${this._config.title || 'План дома'}</div>
        </div>
        <div class="empty">
          <ha-icon icon="mdi:floor-plan" class="big"></ha-icon>
          <p>Пространств пока нет.</p>
          ${this._serverStorage
            ? html`<p class="muted">Добавьте первое пространство и загрузите план этажа.</p>
                <button class="btn on" @click=${() => this._openSpaceDialog('create')}>
                  <ha-icon icon="mdi:plus"></ha-icon>Добавить пространство
                </button>`
            : html`<p class="muted">Установите интеграцию House Plan и добавьте запись в «Устройства и службы».</p>`}
        </div>
        ${this._spaceDialog ? this._renderSpaceDialog() : nothing}
        ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
      </ha-card>`;
    }
    const space = this._spaceModel();
    const vb = space.vb;
    const devs = this._devices.filter((d) => d.space === space.id);
    const cfgSize = this._config.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;
    const view = this._viewOr(vb);

    return html`
      <ha-card>
        <div class="hdr">
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title || 'План дома'}
          </div>
          <div class="tabs">
            ${model.map(
              (s) => html`<button
                class="tab ${this._space === s.id ? 'active' : ''}"
                @click=${() => {
                  this._space = s.id;
                  this._selId = null;
                  this._restoreZoom();
                }}
              >
                ${s.title}${this._norm
                  ? html`<ha-icon class="tabedit" icon="mdi:pencil"
                      title="Настроить пространство"
                      @click=${(e: Event) => {
                        e.stopPropagation();
                        this._openSpaceDialog('edit', s.id);
                      }}></ha-icon>`
                  : nothing}
              </button>`,
            )}
            ${this._norm
              ? html`<button class="tab tabadd" title="Добавить пространство"
                  @click=${() => this._openSpaceDialog('create')}>
                  <ha-icon icon="mdi:plus"></ha-icon>
                </button>`
              : nothing}
          </div>
          <span class="count">${devs.length} устр.</span>
          <span class="spacer"></span>
          <div class="zoomctl">
            <button class="btn zb" @click=${() => this._stepZoom(-1)} title="Отдалить"><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="btn zb" @click=${() => this._resetZoom()} ?disabled=${this._zoom === 1}
              title="Сбросить масштаб"><ha-icon icon="mdi:fit-to-page-outline"></ha-icon></button>
            <button class="btn zb" @click=${() => this._stepZoom(1)} title="Приблизить"><ha-icon icon="mdi:plus"></ha-icon></button>
          </div>
          ${this._norm
            ? html`<button class="btn" @click=${() => this._openMarkerDialog()}
                title="Добавить устройство на план">
                <ha-icon icon="mdi:plus-box-outline"></ha-icon>
              </button>`
            : nothing}
          <button class="btn ${this._edit ? 'on' : ''}" @click=${() => {
            this._edit = !this._edit;
            this._markup = false;
            this._selId = null;
          }} title="Режим правки: клик по значку — карточка, перетаскивание — двигать">
            <ha-icon icon="mdi:cursor-move"></ha-icon>
          </button>
          <button class="btn ${this._markup ? 'on' : ''}" @click=${this._toggleMarkup}
            title="Разметка комнат: сетка, линии, контуры">
            <ha-icon icon="mdi:vector-square-edit"></ha-icon>
          </button>
        </div>
        ${this._edit ? this._renderEditbar() : nothing}
        ${this._markup ? this._renderMarkupBar() : nothing}
        </div>

        <div class="stage ${this._edit ? 'edit' : ''} ${this._markup ? 'markup' : ''}"
          style="height:calc(100dvh - 118px)"
          @click=${(e: MouseEvent) => this._markupClick(e)}
          @wheel=${(e: WheelEvent) => this._onWheel(e)}
          @pointerdown=${(e: PointerEvent) => this._stagePointerDown(e)}
          @pointermove=${(e: PointerEvent) => this._stagePointerMove(e)}
          @pointerup=${(e: PointerEvent) => this._stagePointerUp(e)}
          @pointercancel=${(e: PointerEvent) => this._stagePointerUp(e)}>
          <div class="zoomwrap">
          <svg viewBox="${view.x} ${view.y} ${view.w} ${view.h}" preserveAspectRatio="xMidYMid meet">
            ${this._markup ? this._renderMarkupDefs(vb) : nothing}
            ${space.bg
              ? svg`<image href="${space.bg.href}" x="${space.bg.x}" y="${space.bg.y}" width="${space.bg.w}" height="${space.bg.h}" preserveAspectRatio="none" />`
              : nothing}
            ${space.rooms.filter((r) => r.area || this._markup).map((r) => {
              const cls = 'room ' + (space.bg ? 'overlay' : 'yard') + (this._markup ? ' outlined' : '');
              const tip = (e: MouseEvent) =>
                this._showTip(e, r.name, 'комната — открыть зону',
                  this._config?.show_signal ? this._roomLqi(r.area) : null);
              const label = !space.bg || this._markup;
              const c = this._roomCenter(r);
              const shape = r.poly
                ? svg`<polygon class="${cls}" points="${r.poly.map((p) => p.join(',')).join(' ')}"
                    @click=${() => this._clickRoom(r)} @mousemove=${tip}
                    @mouseleave=${() => (this._tip = null)}></polygon>`
                : svg`<rect class="${cls}"
                    x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.w!, r.h!) * 0.03}"
                    @click=${() => this._clickRoom(r)} @mousemove=${tip}
                    @mouseleave=${() => (this._tip = null)}></rect>`;
              return svg`${shape}${label ? svg`<text class="rlabel" x="${c[0]}" y="${c[1]}">${r.name}</text>` : nothing}`;
            })}
            ${this._markup ? this._renderMarkupLayer(vb) : nothing}
          </svg>
          <div class="devlayer" style="--icon-size:${((iconPct * vb[2]) / view.w).toFixed(3)}cqw">
            ${devs.map((d) => this._renderDevice(d, view))}
          </div>
          </div>
          ${this._zoom > 1
            ? html`<div class="zoombadge">${Math.round(this._zoom * 100)}%</div>`
            : nothing}
        </div>

        ${this._roomDialog ? this._renderRoomDialog() : nothing}
        ${this._spaceDialog ? this._renderSpaceDialog() : nothing}
        ${this._markerDialog ? this._renderMarkerDialog() : nothing}
        ${this._infoCard ? this._renderInfoCard() : nothing}
        ${this._tip
          ? html`<div class="tip" style="left:${this._tip.x + 12}px;top:${this._tip.y + 12}px">
              <b>${this._tip.title}</b>${this._tip.meta ? html`<span class="m">${this._tip.meta}</span>` : nothing}
              ${this._tip.lqi != null
                ? html`<span class="m">средний сигнал zigbee:
                    <b style="color:${lqiColor(this._tip.lqi)}">${this._tip.lqi}</b></span>`
                : nothing}
            </div>`
          : nothing}
        ${this._toast ? html`<div class="toast">${this._toast}</div>` : nothing}
      </ha-card>
    `;
  }

  private _renderDevice(d: DevItem, view: { x: number; y: number; w: number; h: number }): TemplateResult {
    const p = this._pos(d);
    const left = ((p.x - view.x) / view.w) * 100;
    const top = ((p.y - view.y) / view.h) * 100;
    const cls = this._stateClass(d);
    const temp = this._liveTemp(d);
    const lqi = this._config?.show_signal && !d.virtual ? this._lqiFor(d.entities) : null;
    return html`<div
      class="dev ${cls} ${this._selId === d.id ? 'sel' : ''} ${d.virtual ? 'virtual' : ''}"
      style="left:${left}%;top:${top}%"
      @click=${(e: MouseEvent) => this._clickDevice(e, d)}
      @mousemove=${(e: MouseEvent) =>
        this._showTip(e, d.name,
          d.model + (temp != null ? ' · ' + temp + '°' : '') + (lqi != null ? ' · LQI ' + lqi : ''))}
      @mouseleave=${() => (this._tip = null)}
      @pointerdown=${(e: PointerEvent) => this._pointerDown(e, d)}
      @pointermove=${(e: PointerEvent) => this._pointerMove(e, d)}
      @pointerup=${(e: PointerEvent) => this._pointerUp(e, d)}
    >
      <ha-icon icon="${d.icon}"></ha-icon>
      ${temp != null ? html`<span class="tval">${temp}°</span>` : nothing}
      ${lqi != null ? html`<span class="lqi" style="color:${lqiColor(lqi)}">${lqi}</span>` : nothing}
    </div>`;
  }

  private _roomCenter(r: RoomCfg): number[] {
    if (r.poly) {
      const n = r.poly.length;
      return [r.poly.reduce((a, p) => a + p[0], 0) / n, r.poly.reduce((a, p) => a + p[1], 0) / n];
    }
    return [r.x! + r.w! / 2, r.y! + Math.min(r.w!, r.h!) * 0.1];
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
    const segs = this._segments;
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
    `;
  }

  private _renderMarkupBar(): TemplateResult {
    return html`<div class="editbar">
      <ha-icon icon="mdi:vector-square-edit" class="warn"></ha-icon>
      <button class="btn ${this._tool === 'draw' ? 'on' : ''}" @click=${() => (this._tool = 'draw')}
        title="Добавить комнату: соединяйте точки сетки линиями до замкнутого контура">
        <ha-icon icon="mdi:vector-polyline-plus"></ha-icon>Добавить
      </button>
      <button class="btn ${this._tool === 'erase' ? 'on' : ''}" @click=${() => (this._tool = 'erase')}
        title="Стереть линию: клик по линии">
        <ha-icon icon="mdi:eraser"></ha-icon>Стереть
      </button>
      <button class="btn ${this._tool === 'delroom' ? 'on' : ''}" @click=${() => (this._tool = 'delroom')}
        title="Удалить комнату: клик внутри комнаты">
        <ha-icon icon="mdi:delete-outline"></ha-icon>Удалить
      </button>
      <span class="spacer"></span>
      ${this._tool === 'draw'
        ? html`<span class="hint">${this._path.length
              ? 'точек: ' + this._path.length + ' · Esc/Ctrl+Z — убрать точку · замкните контур кликом по первой'
              : 'кликните точку сетки, чтобы начать контур'}</span>
            ${this._path.length ? html`<button class="btn ghost" @click=${this._cancelPath}>Сброс</button>` : nothing}`
        : nothing}
    </div>`;
  }

  private _renderInfoCard(): TemplateResult {
    const d = this._infoCard!;
    const st = d.primary ? this.hass.states[d.primary] : undefined;
    const stateTxt = st ? this.hass.formatEntityState?.(st) ?? st.state : null;
    return html`<div class="menuwrap dialogwrap" @click=${() => (this._infoCard = null)}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="${d.icon}"></ha-icon>${d.name}</div>
        <div class="body">
          ${d.model ? html`<div class="inforow"><span class="k">Модель</span><span>${d.model}</span></div>` : nothing}
          ${stateTxt ? html`<div class="inforow"><span class="k">Состояние</span><span>${stateTxt}</span></div>` : nothing}
          ${d.link
            ? html`<div class="inforow"><span class="k">Ссылка</span>
                <a href="${d.link}" target="_blank" rel="noreferrer noopener">${d.link}</a></div>`
            : nothing}
          ${d.description ? html`<div class="infodesc">${d.description}</div>` : nothing}
          ${d.pdfs && d.pdfs.length
            ? html`<div class="inforow"><span class="k">Инструкции</span><span class="pdflist">
                ${d.pdfs.map(
                  (p) => html`<a class="pdf" href="${p.url}" target="_blank" rel="noreferrer noopener">
                    <ha-icon icon="mdi:file-pdf-box"></ha-icon>${p.name}</a>`,
                )}</span></div>`
            : nothing}
          ${!d.model && !stateTxt && !d.link && !d.description && !(d.pdfs && d.pdfs.length)
            ? html`<div class="infodesc muted">Нет дополнительной информации</div>`
            : nothing}
        </div>
        <div class="row">
          <button class="btn" @click=${() => { const dd = d; this._infoCard = null; this._openMarkerDialog(dd); }}>
            <ha-icon icon="mdi:pencil"></ha-icon>Редактировать
          </button>
          ${d.primary
            ? html`<button class="btn" @click=${() => { const p = d.primary; this._infoCard = null; this._openMoreInfo(p); }}>
                <ha-icon icon="mdi:open-in-new"></ha-icon>Открыть в HA
              </button>`
            : nothing}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._infoCard = null)}>Закрыть</button>
        </div>
      </div>
    </div>`;
  }

  private _renderMarkerDialog(): TemplateResult {
    const d = this._markerDialog!;
    const isVirtual = d.binding === 'virtual';
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
          ${d.devId ? 'Устройство на плане' : 'Новое устройство'}</div>
        <div class="body">
          <label>Имя (отображается на плане)</label>
          <input class="namein" type="text" placeholder="Название"
            .value=${d.name}
            @input=${(e: Event) => (this._markerDialog = { ...d, name: (e.target as HTMLInputElement).value })} />

          <label>Привязка к устройству HA</label>
          <div class="bindsel ${isVirtual ? 'virt' : ''}">
            <button class="opt ${isVirtual ? 'on' : ''}"
              @click=${() => (this._markerDialog = { ...d, binding: 'virtual' })}>
              <ha-icon icon="mdi:map-marker-outline"></ha-icon>Виртуальное устройство (без привязки)
            </button>
            ${!isVirtual
              ? html`<div class="curbind"><ha-icon icon="mdi:link-variant"></ha-icon>
                  <b>${curLabel}</b><span class="ref">${d.binding}</span></div>`
              : nothing}
            <input class="namein" type="text" placeholder="Поиск устройства / группы…"
              .value=${d.bindingFilter}
              @input=${(e: Event) => (this._markerDialog = { ...d, bindingFilter: (e.target as HTMLInputElement).value })} />
            <div class="candlist">
              ${cands.map(
                (c) => html`<div class="cand ${c.value === d.binding ? 'sel' : ''}"
                  @click=${() => (this._markerDialog = { ...d, binding: c.value })}>
                  <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                </div>`,
              )}
              ${!cands.length ? html`<div class="cand muted">ничего не найдено</div>` : nothing}
            </div>
          </div>

          <label>Комната${isVirtual ? '' : ' (переопределить размещение)'}</label>
          <select class="areasel"
            @change=${(e: Event) => (this._markerDialog = { ...d, room: (e.target as HTMLSelectElement).value })}>
            <option value="">${isVirtual ? '— выберите комнату —' : '— по зоне устройства (авто) —'}</option>
            ${this._allRoomsFlat().map(
              (r) => html`<option value=${r.value} ?selected=${r.value === d.room}>${r.label}</option>`,
            )}
          </select>

          <label>Иконка</label>
          ${customElements.get('ha-icon-picker')
            ? html`<ha-icon-picker .hass=${this.hass} .value=${d.icon}
                @value-changed=${(e: any) => (this._markerDialog = { ...d, icon: e.detail.value || '' })}></ha-icon-picker>`
            : html`<input class="namein" type="text" placeholder="mdi:… (пусто = авто)"
                .value=${d.icon}
                @input=${(e: Event) => (this._markerDialog = { ...d, icon: (e.target as HTMLInputElement).value })} />`}

          <label>Модель</label>
          <input class="namein" type="text" placeholder="напр. Aqara T&amp;H"
            .value=${d.model}
            @input=${(e: Event) => (this._markerDialog = { ...d, model: (e.target as HTMLInputElement).value })} />

          <label>Ссылка</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${d.link}
            @input=${(e: Event) => (this._markerDialog = { ...d, link: (e.target as HTMLInputElement).value })} />

          <label>Описание</label>
          <textarea class="descin" rows="3" placeholder="Заметки, характеристики…"
            .value=${d.description}
            @input=${(e: Event) => (this._markerDialog = { ...d, description: (e.target as HTMLTextAreaElement).value })}></textarea>

          <label>Инструкции (PDF и т.п.)</label>
          <div class="pdfedit">
            ${d.pdfs.map(
              (p) => html`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${p.url}" target="_blank" rel="noreferrer noopener">${p.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${() => this._removeMarkerPdf(p.url)}></ha-icon></span>`,
            )}
            <label class="btn filebtn">
              <ha-icon icon="mdi:paperclip"></ha-icon>Прикрепить…
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${(e: Event) => this._pickMarkerFiles(e)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${d.devId
            ? html`<button class="btn danger" @click=${this._deleteMarker}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>Убрать
              </button>`
            : nothing}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._markerDialog = null)}>Отмена</button>
          <button class="btn on" @click=${this._saveMarker} ?disabled=${d.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>`;
  }

  private _renderSpaceDialog(): TemplateResult {
    const d = this._spaceDialog!;
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>
          ${d.mode === 'create' ? 'Новое пространство' : 'Пространство'}</div>
        <div class="body">
          <label>Название</label>
          <input class="namein" type="text" placeholder="Например: Гараж"
            .value=${d.title}
            @input=${(e: Event) => (this._spaceDialog = { ...d, title: (e.target as HTMLInputElement).value })} />
          <label>Подложка (план)</label>
          <div class="planrow">
            ${d.planFile
              ? html`<span class="planname">${d.planFile.name}</span>`
              : d.planUrl
                ? html`<img class="planprev" src=${d.planUrl} alt="план" />`
                : html`<span class="planname muted">нет подложки</span>`}
            <label class="btn filebtn">
              <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? 'Заменить…' : 'Загрузить…'}
              <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                @change=${(e: Event) => this._pickPlanFile(e)} />
            </label>
          </div>
        </div>
        <div class="row">
          ${d.mode === 'edit'
            ? html`<button class="btn danger" @click=${this._deleteSpace}>
                <ha-icon icon="mdi:delete-outline"></ha-icon>Удалить
              </button>`
            : nothing}
          <span class="spacer"></span>
          <button class="btn ghost" @click=${() => (this._spaceDialog = null)}>Отмена</button>
          <button class="btn on" @click=${this._saveSpaceDialog}
            ?disabled=${!d.title.trim() || !(d.planFile || d.planUrl) || d.busy}
            title=${!(d.planFile || d.planUrl) ? 'Загрузите подложку (план этажа)' : ''}>
            <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>`;
  }

  private _renderRoomDialog(): TemplateResult {
    const areas = this._freeAreas;
    return html`<div class="menuwrap dialogwrap" @click=${(e: Event) => e.stopPropagation()}>
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:floor-plan"></ha-icon>Новая комната</div>
        <div class="body">
          <label>Отображаемое имя</label>
          <input class="namein" type="text" placeholder="Например: Терраса"
            .value=${this._nameSel}
            @input=${(e: Event) => (this._nameSel = (e.target as HTMLInputElement).value)} />
          <label>Зона Home Assistant (свободные)</label>
          <select class="areasel"
            @change=${(e: Event) => {
              this._areaSel = (e.target as HTMLSelectElement).value;
              if (!this._nameSel && this._areaSel)
                this._nameSel = this.hass.areas[this._areaSel]?.name || '';
              this.requestUpdate();
            }}>
            <option value="">— без зоны —</option>
            ${areas.map(
              (a) => html`<option value=${a.area_id} ?selected=${a.area_id === this._areaSel}>${a.name}</option>`,
            )}
          </select>
        </div>
        <div class="row">
          <button class="btn ghost" @click=${this._roomDialogCancel}>Отмена</button>
          <span class="spacer"></span>
          <button class="btn ghost" @click=${this._saveRoomNoArea} ?disabled=${!this._nameSel.trim()}
            title="Декоративная комната без привязки к зоне (например, холл)">
            Без зоны
          </button>
          <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel}
            title=${!this._areaSel ? 'Выберите зону Home Assistant' : ''}>
            <ha-icon icon="mdi:check"></ha-icon>Сохранить
          </button>
        </div>
      </div>
    </div>`;
  }

  private _renderEditbar(): TemplateResult {
    const sel = this._selId ? this._devices.find((d) => d.id === this._selId) : null;
    const p = sel ? this._pos(sel) : null;
    return html`<div class="editbar">
      <ha-icon icon="mdi:cursor-move" class="warn"></ha-icon>
      <span class="sname">${sel ? sel.name : 'Режим правки — тащите иконки мышью'}</span>
      ${sel && p
        ? html`<label>X</label><input type="number" .value=${String(Math.round(p.x))}
              @change=${(e: Event) => this._applyXY('x', (e.target as HTMLInputElement).value)} />
            <label>Y</label><input type="number" .value=${String(Math.round(p.y))}
              @change=${(e: Event) => this._applyXY('y', (e.target as HTMLInputElement).value)} />`
        : nothing}
      <span class="spacer"></span>
      <span class="hint">
        ${this._serverStorage
          ? this._norm
            ? 'конфиг и раскладка: сервер'
            : 'раскладка: сервер · конфиг: встроенный'
          : 'сохранение: этот браузер'}
      </span>
      <button class="btn ghost" @click=${this._resetLayout} title="Сбросить всё">
        <ha-icon icon="mdi:backup-restore"></ha-icon>
      </button>
    </div>`;
  }

  static styles = css`
    :host {
      --hp-bg: var(--card-background-color, #16212e);
      --hp-line: var(--divider-color, #2b3d4f);
      --hp-txt: var(--primary-text-color, #e6edf3);
      --hp-muted: var(--secondary-text-color, #8aa0b3);
      --hp-accent: var(--primary-color, #3ea6ff);
      --hp-on: #ffd45c;
      --hp-open: #ff9f43;
    }
    ha-card {
      overflow: visible; /* overflow:hidden ломает position:sticky у шапки */
    }
    .empty {
      padding: 40px 24px;
      color: var(--hp-txt);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .empty .big {
      --mdc-icon-size: 56px;
      color: var(--hp-accent);
      opacity: 0.7;
    }
    .empty .muted {
      color: var(--hp-muted);
      font-size: 13px;
      margin: 0;
    }
    .empty .btn {
      margin-top: 8px;
    }
    .hdr {
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
      background: var(--card-background-color, var(--hp-bg));
      border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--hp-line);
      flex-wrap: wrap;
    }
    .title {
      font-size: 15px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .title ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 18px;
    }
    .tabs {
      display: flex;
      gap: 4px;
      background: rgba(127, 127, 127, 0.12);
      padding: 3px;
      border-radius: 10px;
    }
    .tab {
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      padding: 6px 13px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
    }
    .tab:hover {
      color: var(--hp-txt);
    }
    .tab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .count {
      font-size: 12px;
      color: var(--hp-muted);
    }
    .spacer {
      flex: 1;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
      font-size: 12.5px;
    }
    .btn ha-icon {
      --mdc-icon-size: 17px;
    }
    .btn:hover {
      border-color: var(--hp-accent);
    }
    .btn.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .btn.ghost {
      border: none;
    }
    .btn[disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
    .stage {
      position: relative;
      width: 100%;
      container-type: inline-size;
      overflow: hidden;
      touch-action: none; /* свои жесты pinch/pan */
      background: var(--ha-card-background, var(--card-background-color, #111));
    }
    .zoomwrap {
      position: absolute;
      inset: 0;
    }
    .zoomctl {
      display: inline-flex;
      gap: 2px;
      background: rgba(127, 127, 127, 0.12);
      border-radius: 8px;
      padding: 2px;
    }
    .zoomctl .zb {
      border: none;
      padding: 5px 7px;
    }
    .zoomctl .zb[disabled] {
      opacity: 0.4;
      pointer-events: none;
    }
    .zoombadge {
      position: absolute;
      left: 8px;
      bottom: 8px;
      background: rgba(4, 18, 31, 0.8);
      color: #dff1ff;
      border: 1px solid var(--hp-accent);
      border-radius: 8px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      pointer-events: none;
    }
    .stage svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .room {
      transition: 0.12s;
      cursor: pointer;
    }
    .room.overlay {
      fill: transparent;
      stroke: transparent;
      stroke-width: 2;
    }
    .room.overlay:hover {
      fill: rgba(62, 166, 255, 0.18);
      stroke: var(--hp-accent);
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: 2;
    }
    .room.yard:hover {
      fill: rgba(75, 140, 90, 0.24);
      stroke: #6fbf86;
    }
    .rlabel {
      fill: var(--hp-muted);
      font-size: 15px;
      font-weight: 600;
      pointer-events: none;
      text-anchor: middle;
    }
    .stage.edit .room {
      pointer-events: none;
    }
    .stage.markup {
      cursor: crosshair;
    }
    .stage.markup .room {
      pointer-events: none;
    }
    .stage.markup .devlayer {
      display: none; /* в разметке иконки не мешают */
    }
    .room.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      fill: rgba(62, 166, 255, 0.06);
    }
    .griddot {
      fill: var(--hp-accent);
      opacity: 0.75;
      stroke: rgba(0, 0, 0, 0.35);
      stroke-width: 0.4;
    }
    .seg {
      stroke: var(--hp-accent);
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .pathline {
      stroke: #ffc14d;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .preview {
      stroke: #ffc14d;
      stroke-width: 2;
      stroke-dasharray: 6 5;
      opacity: 0.7;
    }
    .vertex {
      fill: #ffc14d;
      stroke: #4a2800;
      stroke-width: 1;
    }
    .vertex.first {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .areasel,
    .namein {
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 13px;
      font-family: inherit;
    }
    .namein {
      width: 130px;
    }
    .devlayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .dev {
      position: absolute;
      width: var(--icon-size, 2.5cqw);
      height: var(--icon-size, 2.5cqw);
      margin: calc(var(--icon-size, 2.5cqw) / -2) 0 0 calc(var(--icon-size, 2.5cqw) / -2);
      border-radius: 22%;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--hp-txt);
      cursor: pointer;
      pointer-events: auto;
      transition: background 0.15s, border-color 0.15s, opacity 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      z-index: 2;
    }
    .dev ha-icon {
      --mdc-icon-size: calc(var(--icon-size, 2.5cqw) * 0.62);
    }
    .dev:hover {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      z-index: 5;
    }
    .dev.on {
      background: var(--hp-on);
      border-color: var(--hp-on);
      color: #503c00;
      box-shadow: 0 0 8px rgba(255, 212, 92, 0.7);
    }
    .dev.open {
      background: var(--hp-open);
      border-color: var(--hp-open);
      color: #4a2800;
    }
    .dev.unavail {
      opacity: 0.35;
    }
    .dev.virtual {
      border-style: dashed;
    }
    .dev.sel {
      border-color: #ffc14d;
      box-shadow: 0 0 0 3px rgba(255, 193, 77, 0.35);
    }
    .stage.edit .dev {
      cursor: grab;
    }
    .dev .tval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--icon-size, 2.5cqw) * 0.1);
      background: rgba(4, 18, 31, 0.9);
      border: 1px solid var(--hp-accent);
      border-radius: calc(var(--icon-size, 2.5cqw) * 0.18);
      padding: 0 calc(var(--icon-size, 2.5cqw) * 0.14);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.45);
      font-weight: 700;
      line-height: calc(var(--icon-size, 2.5cqw) * 0.68);
      color: #dff1ff;
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .lqi {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: calc(var(--icon-size, 2.5cqw) * 0.05);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.38);
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
      pointer-events: none;
    }
    .editbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      border-bottom: 1px solid var(--hp-line);
      font-size: 13px;
      flex-wrap: wrap;
    }
    .tab .tabedit {
      --mdc-icon-size: 13px;
      margin-left: 6px;
      opacity: 0.4;
      vertical-align: middle;
    }
    .tab:hover .tabedit {
      opacity: 0.9;
    }
    .tab.tabadd {
      padding: 6px 8px;
    }
    .tab.tabadd ha-icon {
      --mdc-icon-size: 15px;
    }
    .planrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .planprev {
      max-width: 120px;
      max-height: 70px;
      border: 1px solid var(--hp-line);
      border-radius: 6px;
      background: #fff;
    }
    .planname {
      font-size: 12.5px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .planname.muted {
      color: var(--hp-muted);
    }
    .filebtn {
      cursor: pointer;
    }
    .btn.danger {
      border-color: #b3402a;
      color: #ff7a5c;
    }
    .dialog .row .spacer {
      flex: 1;
    }
    .dialog.wide {
      width: min(440px, 94vw);
    }
    .dialog .body {
      max-height: 66vh;
      overflow-y: auto;
    }
    .descin {
      width: 100%;
      box-sizing: border-box;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
    }
    .bindsel {
      display: flex;
      flex-direction: column;
      gap: 6px;
      border: 1px solid var(--hp-line);
      border-radius: 8px;
      padding: 8px;
    }
    .bindsel .opt {
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      font-size: 12.5px;
      font-family: inherit;
    }
    .bindsel .opt.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .curbind {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: var(--hp-txt);
      flex-wrap: wrap;
    }
    .curbind .ref {
      color: var(--hp-muted);
      font-size: 11px;
    }
    .candlist {
      max-height: 160px;
      overflow-y: auto;
      border-top: 1px solid var(--hp-line);
    }
    .cand {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      cursor: pointer;
      border-radius: 6px;
      font-size: 12.5px;
    }
    .cand:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .cand.sel {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .cand .cs {
      color: var(--hp-muted);
      font-size: 11px;
      white-space: nowrap;
    }
    .cand.sel .cs {
      color: var(--text-primary-color, #fff);
      opacity: 0.85;
    }
    .cand.muted {
      color: var(--hp-muted);
      cursor: default;
    }
    .pdfedit {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .pdftag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid var(--hp-line);
      border-radius: 6px;
      padding: 3px 6px;
      font-size: 12px;
    }
    .pdftag a {
      color: var(--hp-txt);
      text-decoration: none;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pdftag .x {
      --mdc-icon-size: 15px;
      cursor: pointer;
      color: var(--hp-muted);
    }
    .pdftag .x:hover {
      color: #ff7a5c;
    }
    .inforow {
      display: flex;
      gap: 10px;
      font-size: 13px;
      margin: 3px 0;
    }
    .inforow .k {
      color: var(--hp-muted);
      min-width: 84px;
    }
    .inforow a {
      color: var(--hp-accent);
      word-break: break-all;
    }
    .infodesc {
      font-size: 13px;
      white-space: pre-wrap;
      margin-top: 6px;
    }
    .infodesc.muted {
      color: var(--hp-muted);
    }
    .pdflist {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .pdf {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--hp-accent);
      text-decoration: none;
    }
    ha-icon-picker {
      display: block;
    }
    .dialogwrap {
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 90;
    }
    .dialog {
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid var(--hp-accent);
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
      width: min(360px, 92vw);
      overflow: hidden;
    }
    .dialog .hd {
      padding: 12px 16px;
      font-weight: 600;
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dialog .hd ha-icon {
      color: var(--hp-accent);
    }
    .dialog .body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dialog .body label {
      font-size: 12px;
      color: var(--hp-muted);
      margin-top: 6px;
    }
    .dialog .body .namein,
    .dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    .dialog .row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--hp-line);
    }
    .editbar .warn {
      color: #ffc14d;
    }
    .editbar .sname {
      font-weight: 600;
    }
    .editbar input {
      width: 74px;
      background: transparent;
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: 6px;
      padding: 5px 7px;
      font-size: 13px;
    }
    .editbar label,
    .editbar .hint {
      color: var(--hp-muted);
      font-size: 12px;
    }
    .menuwrap {
      position: fixed;
      inset: 0;
      z-index: 80;
    }
    .menu {
      position: fixed;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      border-radius: 10px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
      min-width: 210px;
      max-width: 300px;
      overflow: hidden;
      transform: translate(0, 8px);
    }
    .menu .hd {
      padding: 8px 12px;
      font-weight: 600;
      font-size: 12.5px;
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .menu .hd ha-icon,
    .menu .it.all ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 16px;
    }
    .menu .it {
      padding: 8px 12px;
      font-size: 12.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .menu .it ha-icon {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
    }
    .menu .it:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .menu .it.all {
      color: var(--hp-accent);
      font-weight: 600;
    }
    .tip {
      position: fixed;
      pointer-events: none;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12.5px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
      z-index: 99;
      max-width: 260px;
    }
    .tip .m {
      color: var(--hp-muted);
      font-size: 11px;
      display: block;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13px;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
      z-index: 120;
      max-width: 90vw;
    }
  `;
}

if (!customElements.get('houseplan-card')) {
  customElements.define('houseplan-card', HouseplanCard);
}

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.find((c: any) => c.type === 'houseplan-card')) {
  (window as any).customCards.push({
    type: 'houseplan-card',
    name: 'House Plan Card',
    description: 'Интерактивный план дома: пространства, комнаты, устройства с живыми состояниями и drag-раскладкой.',
  });
}

// eslint-disable-next-line no-console
console.info(`%c HOUSEPLAN-CARD %c v${CARD_VERSION} `, 'background:#3ea6ff;color:#04121f;font-weight:700', '');
