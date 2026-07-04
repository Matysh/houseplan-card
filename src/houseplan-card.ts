/**
 * House Plan Card — интерактивный план дома как нативная Lovelace-карточка.
 * Источники конфигурации:
 *  1) СЕРВЕР (интеграция houseplan, WS houseplan/config/get) — пространства, планы,
 *     комнаты, оверрайды устройств, виртуальные устройства. Координаты НОРМИРОВАННЫЕ (0..1).
 *  2) LEGACY-фолбэк — вшитые данные дачи (src/data/*), координаты в холсте 1489×1053.
 * Раскладка иконок хранится на сервере (houseplan/layout/*), fallback — localStorage.
 */
import { LitElement, html, svg, css, nothing, TemplateResult, PropertyValues } from 'lit';
import { ROOMS, FLOOR_VB, FLOOR_TITLES, Room } from './data/house';
import { FLOOR_BG, FLOOR_BG_RECT } from './data/backgrounds';
import { EXCLUDED_DOMAINS, GROUP_TITLES, iconFor, DOMAIN_PRIORITY } from './rules';
import './editor';

const CARD_VERSION = '1.4.2';
const LS_KEY = 'houseplan_card_layout_v1';
const NORM_W = 1000; // ширина рендер-пространства для нормированных конфигов

// Натуральные размеры legacy-планов (для миграции): SVG viewBox РЕМПЛАННЕР
const LEGACY_PLAN_SIZE: Record<string, [number, number]> = {
  f1: [1196.6656, 1467.26],
  f2: [1170.0986, 1073],
};

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

interface VirtualDevice {
  id: string;
  space: string;
  name: string;
  icon: string;
  x: number; // normalized
  y: number;
  note?: string | null;
  entity_id?: string | null;
}

interface ServerConfig {
  spaces: any[];
  device_overrides: Record<string, { hidden?: boolean; icon?: string | null; name?: string | null }>;
  virtual_devices: VirtualDevice[];
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
  members?: { id: string; name: string; primary?: string }[];
  link?: string | null;
  linkPrimary?: string;
  virtual?: VirtualDevice;
}

interface CardConfig {
  type: string;
  title?: string;
  default_floor?: string;
  icon_size?: number;
  show_temperature?: boolean;
  live_states?: boolean;
  show_signal?: boolean;
  rooms?: Room[];
}

/** Цвет LQI: ≤40 — красный, ≥180 — зелёный, между — градиент. */
const lqiColor = (lqi: number): string => {
  const hue = Math.max(0, Math.min(120, ((lqi - 40) / 140) * 120));
  return `hsl(${Math.round(hue)}, 85%, 55%)`;
};

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
  private _loaded = false;
  private _serverCfg: ServerConfig | null = null;
  private _devices: DevItem[] = [];
  private _regSignature = '';
  private _defPos: Record<string, { x: number; y: number }> = {};
  private _menuDev: DevItem | null = null;
  private _menuXY = { x: 0, y: 0 };
  private _tip: { x: number; y: number; title: string; meta: string; lqi?: number | null } | null = null;
  private _selId: string | null = null;
  private _toast = '';
  private _toastTimer?: number;
  private _migrating = false;

  // --- редактор разметки комнат ---
  private _markup = false;
  private _tool: MarkupTool = 'draw';
  private _path: number[][] = []; // текущий контур (рендер-единицы, вершины по сетке)
  private _pathSegs: (string | null)[] = []; // ключи сегментов, добавленных шагами контура
  private _cursorPt: number[] | null = null;
  private _areaSel = '';
  private _nameSel = '';
  private _roomDialog = false;
  private _keyHandler = (e: KeyboardEvent) => this._onKey(e);

  private _drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _space: { state: true },
    _edit: { state: true },
    _layout: { state: true },
    _devices: { state: true },
    _menuDev: { state: true },
    _tip: { state: true },
    _selId: { state: true },
    _toast: { state: true },
    _serverCfg: { state: true },
    _migrating: { state: true },
    _markup: { state: true },
    _tool: { state: true },
    _path: { state: true },
    _cursorPt: { state: true },
    _areaSel: { state: true },
    _nameSel: { state: true },
    _roomDialog: { state: true },
  };

  public connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this._keyHandler);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('keydown', this._keyHandler);
    super.disconnectedCallback();
  }

  private _onKey(e: KeyboardEvent): void {
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
  }

  public getCardSize(): number {
    return 12;
  }

  // ================= РЕЗОЛВ МОДЕЛИ (сервер или legacy) =================

  private get _norm(): boolean {
    return !!(this._serverCfg && this._serverCfg.spaces.length);
  }

  /** Пространства в рендер-единицах: сервер → NORM_W×NORM_W/aspect; legacy → холст 1489×1053. */
  private get _model(): SpaceModel[] {
    if (this._norm) {
      return this._serverCfg!.spaces.map((s: any) => {
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
    // legacy: вшитые данные
    const legacyRooms = this._config?.rooms?.length ? this._config.rooms : ROOMS;
    return Object.keys(FLOOR_VB).map((fl) => {
      const rect = FLOOR_BG_RECT[fl];
      const bgHref = FLOOR_BG[fl];
      return {
        id: fl,
        title: FLOOR_TITLES[fl] || fl,
        vb: FLOOR_VB[fl],
        bg: bgHref && rect ? { href: bgHref, x: rect[0], y: rect[1], w: rect[2], h: rect[3] } : null,
        rooms: legacyRooms
          .filter((r) => r.floor === fl)
          .map((r) => ({ name: r.name, area: r.area || null, x: r.x, y: r.y, w: r.w, h: r.h })),
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
      if (!this._loaded) {
        this._loaded = true;
        this._loadFromServer();
      }
      this._maybeRebuildDevices();
    }
  }

  // ================= сервер: конфиг + раскладка =================

  private async _loadFromServer(): Promise<void> {
    try {
      const [cfgResp, layResp] = await Promise.all([
        this.hass.callWS({ type: 'houseplan/config/get' }),
        this.hass.callWS({ type: 'houseplan/layout/get' }),
      ]);
      this._serverStorage = true;
      const cfg = cfgResp?.config;
      this._serverCfg = cfg && Array.isArray(cfg.spaces) ? cfg : null;
      this._layout = layResp?.layout || {};
      if (this._norm && !this._model.find((s) => s.id === this._space)) {
        this._space = this._model[0]?.id || this._space;
      }
    } catch (e) {
      this._serverStorage = false;
      this._serverCfg = null;
      try {
        this._layout = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
      } catch {
        this._layout = {};
      }
      this._showToast('Интеграция houseplan не найдена — позиции сохраняются локально');
    }
    this._regSignature = '';
    this.requestUpdate();
  }

  private _persistLayout = debounce(() => {
    if (this._serverStorage) {
      this.hass
        .callWS({ type: 'houseplan/layout/set', layout: this._layout })
        .catch((e: any) => this._showToast('Не удалось сохранить на сервере: ' + (e?.message || e)));
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

  /** Курирование + группировка + оверрайды + виртуальные устройства. */
  private _buildDevices(): DevItem[] {
    const h = this.hass;
    const areaMap = this._areaToSpace;
    const overrides = this._serverCfg?.device_overrides || {};
    const groupLights = this._settings.group_lights !== false;
    const excluded = this._excluded;
    const entsBy = this._entitiesByDevice();
    const groupByArea: Record<string, any> = {};
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.model === 'Group' && dev.area_id) groupByArea[dev.area_id] = dev;
    }
    const seen: Record<string, 1> = {};
    const out: DevItem[] = [];
    for (const dev of Object.values<any>(h.devices)) {
      const area = dev.area_id;
      if (!area || !areaMap[area]) continue;
      if (dev.entry_type === 'service') continue;
      const ov = overrides[dev.id] || {};
      if (ov.hidden) continue;
      const entIds = entsBy[dev.id] || [];
      const dom = this._domainOfDevice(dev, entIds);
      if (excluded.has(dom)) continue;
      if (dev.model === 'Group') continue;
      if (/scene/i.test(dev.model || '')) continue;
      if (/bridge/i.test((dev.model || '') + (dev.name || ''))) continue;
      if (dom === 'myheat' && dev.via_device_id) continue;
      const name = (ov.name || dev.name_by_user || dev.name || 'без имени').trim();
      const key = name + '|' + area;
      if (seen[key]) continue;
      seen[key] = 1;
      let icon = iconFor(name, dev.model);
      if (entIds.some((e) => e.startsWith('lock.'))) icon = 'mdi:lock';
      if (ov.icon) icon = ov.icon;
      const item: DevItem = {
        id: dev.id,
        name,
        model: dev.model || '',
        area,
        space: areaMap[area].space,
        icon,
        entities: entIds,
      };
      item.primary = this._primaryEntity(entIds, icon);
      if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = this._tempFor(entIds);
      out.push(item);
    }
    // группировка ламп
    const rest: DevItem[] = [];
    if (groupLights) {
      const lamps: Record<string, DevItem[]> = {};
      for (const d of out) {
        if (d.icon === 'mdi:lightbulb') (lamps[d.area] = lamps[d.area] || []).push(d);
        else rest.push(d);
      }
      for (const area of Object.keys(lamps)) {
        const ms = lamps[area];
        if (ms.length < 2) {
          rest.push(...ms);
          continue;
        }
        const grpDev = groupByArea[area];
        const item: DevItem = {
          id: 'grp_' + area,
          name: GROUP_TITLES[area] || 'Лампы',
          model: 'группа · ' + ms.length + ' шт',
          area,
          space: areaMap[area].space,
          icon: 'mdi:lightbulb-group',
          entities: ms.flatMap((m) => m.entities),
          link: grpDev?.id || null,
          members: ms.map((m) => ({ id: m.id, name: m.name, primary: m.primary })),
        };
        if (grpDev) {
          const grpEnts = entsBy[grpDev.id] || [];
          item.linkPrimary = this._primaryEntity(grpEnts, 'mdi:lightbulb');
        }
        rest.push(item);
      }
    } else {
      rest.push(...out);
    }
    // виртуальные устройства
    for (const v of this._serverCfg?.virtual_devices || []) {
      rest.push({
        id: 'virt_' + v.id,
        name: v.name,
        model: v.note || 'виртуальное устройство',
        area: '',
        space: v.space,
        icon: v.icon,
        entities: v.entity_id ? [v.entity_id] : [],
        primary: v.entity_id || undefined,
        virtual: v,
      });
    }
    return rest;
  }

  // ================= позиции =================

  private _defaultPositions(): Record<string, { x: number; y: number }> {
    const map: Record<string, { x: number; y: number }> = {};
    for (const s of this._model) {
      for (const r of s.rooms) {
        if (!r.area) continue;
        const ds = this._devices.filter((d) => d.area === r.area && d.space === s.id);
        if (!ds.length) continue;
        const pad = Math.min(r.w, r.h) * 0.12;
        const iw = r.w - pad * 2;
        const ih = r.h - pad * 2;
        const cols = Math.max(1, Math.round(Math.sqrt((ds.length * iw) / Math.max(ih, 1))));
        const rows = Math.ceil(ds.length / cols);
        const cw = iw / cols;
        const ch = ih / Math.max(rows, 1);
        ds.forEach((d, i) => {
          const c = i % cols;
          const rw = Math.floor(i / cols);
          map[d.id] = { x: r.x + pad + cw * (c + 0.5), y: r.y + pad + ch * (rw + 0.5) };
        });
      }
    }
    return map;
  }

  /** Позиция устройства в рендер-единицах текущего пространства. */
  private _pos(d: DevItem): { x: number; y: number } {
    const s = this._spaceModel(d.space);
    const H = s.vb ? undefined : undefined;
    if (d.virtual) {
      const height = this._norm ? NORM_W / (this._serverCfg!.spaces.find((x: any) => x.id === d.space)?.aspect || 1) : 0;
      return { x: d.virtual.x * (this._norm ? NORM_W : 1), y: d.virtual.y * (this._norm ? height : 1) };
    }
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
      const aspect = this._serverCfg!.spaces.find((s: any) => s.id === d.space)?.aspect || 1;
      this._layout = {
        ...this._layout,
        [d.id]: { s: d.space, x: x / NORM_W, y: y / (NORM_W / aspect) },
      };
    } else {
      this._layout = { ...this._layout, [d.id]: { x: Math.round(x), y: Math.round(y) } };
    }
    this._persistLayout();
  }

  // ================= живые состояния =================

  private _stateClass(d: DevItem): string {
    if (!this._config?.live_states) return '';
    const st = (eid?: string) => (eid ? this.hass.states[eid] : undefined);
    const list = d.members
      ? (d.members.map((m) => st(m.primary)).filter(Boolean) as any[])
      : ([st(d.primary)].filter(Boolean) as any[]);
    if (!list.length) return '';
    if (list.every((s) => s.state === 'unavailable')) return 'unavail';
    const p = d.members ? list.find((s) => s.state === 'on') || list[0] : list[0];
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
    if (this._drag?.moved) return;
    if (this._edit) {
      this._selId = d.id;
      return;
    }
    if (d.virtual && !d.primary) {
      this._showToast(d.name + (d.virtual.note ? ' — ' + d.virtual.note : ''));
      return;
    }
    if (d.members) {
      this._menuDev = d;
      this._menuXY = { x: ev.clientX, y: ev.clientY };
      this._tip = null;
      return;
    }
    this._openMoreInfo(d.primary);
  }

  private _clickRoom(r: RoomCfg): void {
    if (this._edit || !r.area) return;
    navigate('/config/areas/area/' + r.area);
  }

  private _pointerDown(ev: PointerEvent, d: DevItem): void {
    if (!this._edit || d.virtual) return;
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
    const dx = ((ev.clientX - this._drag.sx) / rect.width) * vb[2];
    const dy = ((ev.clientY - this._drag.sy) / rect.height) * vb[3];
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
    const vb = this._spaceModel().vb;
    const r = stage.getBoundingClientRect();
    return [vb[0] + ((ev.clientX - r.left) / r.width) * vb[2], vb[1] + ((ev.clientY - r.top) / r.height) * vb[3]];
  }

  private _snap(p: number[]): number[] {
    const g = this._gridPitch;
    return [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g];
  }

  private _samePt(a: number[], b: number[]): boolean {
    return Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001;
  }

  private _segKey(a: number[], b: number[]): string {
    const [p, q] = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? [a, b] : [b, a];
    return `${p[0].toFixed(1)},${p[1].toFixed(1)}-${q[0].toFixed(1)},${q[1].toFixed(1)}`;
  }

  private _saveConfig = debounce(() => {
    if (!this._serverCfg) return;
    this.hass
      .callWS({ type: 'houseplan/config/set', config: this._serverCfg })
      .catch((e: any) => this._showToast('Не удалось сохранить конфиг: ' + (e?.message || e)));
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
    if (r.poly) {
      let inside = false;
      const poly = r.poly;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
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

  private _saveRoom(): void {
    if (!this._contourClosed || !this._areaSel && !this._nameSel) return;
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
    this._areaSel = '';
    this._nameSel = '';
    this._roomDialog = false;
    this._regSignature = '';
    this._maybeRebuildDevices();
    this._showToast('Комната сохранена');
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

  // ================= МИГРАЦИЯ legacy → сервер =================

  private async _migrateToServer(): Promise<void> {
    if (!this._serverStorage || this._norm || this._migrating) return;
    if (!confirm('Перенести текущую конфигурацию (планы, комнаты, раскладку) на сервер HA?')) return;
    this._migrating = true;
    try {
      const spaces: any[] = [];
      for (const fl of Object.keys(FLOOR_VB)) {
        const vb = FLOOR_VB[fl];
        const rect = FLOOR_BG_RECT[fl] || vb; // yard: нормируем относительно viewBox
        const [rx, ry, rw, rh] = rect;
        let planUrl: string | null = null;
        let aspect = rw / rh;
        const bg = FLOOR_BG[fl];
        if (bg && FLOOR_BG_RECT[fl]) {
          const nat = LEGACY_PLAN_SIZE[fl];
          if (nat) aspect = nat[0] / nat[1];
          const b64 = bg.split(',')[1];
          const resp = await this.hass.callWS({
            type: 'houseplan/plan/set',
            space_id: fl,
            ext: 'svg',
            data: b64,
          });
          planUrl = resp.url;
        }
        const rooms = ROOMS.filter((r) => r.floor === fl).map((r, i) => ({
          id: fl + '_r' + i,
          name: r.name,
          area: r.area || null,
          x: (r.x - rx) / rw,
          y: (r.y - ry) / rh,
          w: r.w / rw,
          h: r.h / rh,
        }));
        spaces.push({
          id: fl,
          title: FLOOR_TITLES[fl] || fl,
          plan_url: planUrl,
          aspect,
          view_box: [(vb[0] - rx) / rw, (vb[1] - ry) / rh, vb[2] / rw, vb[3] / rh],
          rooms,
        });
      }
      const config = {
        spaces,
        device_overrides: {},
        virtual_devices: [],
        settings: { exclude_integrations: [...EXCLUDED_DOMAINS], group_lights: true },
      };
      // раскладка: канвас → нормированные координаты пространства
      const layout: Record<string, any> = {};
      for (const d of this._devices) {
        if (d.virtual) continue;
        const saved = this._layout[d.id] || this._defPos[d.id];
        if (!saved) continue;
        const rect = FLOOR_BG_RECT[d.space] || FLOOR_VB[d.space];
        layout[d.id] = {
          s: d.space,
          x: (saved.x - rect[0]) / rect[2],
          y: (saved.y - rect[1]) / rect[3],
        };
      }
      await this.hass.callWS({ type: 'houseplan/config/set', config });
      await this.hass.callWS({ type: 'houseplan/layout/set', layout });
      this._serverCfg = config as any;
      this._layout = layout;
      this._regSignature = '';
      this._maybeRebuildDevices();
      this._showToast('Конфигурация перенесена на сервер — карта работает от server config');
    } catch (e: any) {
      this._showToast('Ошибка миграции: ' + (e?.message || e));
    } finally {
      this._migrating = false;
    }
  }

  // ================= рендер =================

  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const model = this._model;
    if (!model.length) return html`<ha-card><div class="empty">Нет настроенных пространств</div></ha-card>`;
    const space = this._spaceModel();
    const vb = space.vb;
    const devs = this._devices.filter((d) => d.space === space.id);
    const cfgSize = this._config.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;

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
                }}
              >
                ${s.title}
              </button>`,
            )}
          </div>
          <span class="count">${devs.length} устр.</span>
          <span class="spacer"></span>
          <button class="btn ${this._edit ? 'on' : ''}" @click=${() => {
            this._edit = !this._edit;
            this._markup = false;
            this._selId = null;
          }} title="Режим правки: перетаскивание иконок">
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
          style="aspect-ratio:${vb[2]}/${vb[3]}"
          @click=${(e: MouseEvent) => this._markupClick(e)}
          @mousemove=${(e: MouseEvent) => this._markupMove(e)}>
          <svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">
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
          <div class="devlayer" style="--icon-size:${iconPct}cqw">
            ${devs.map((d) => this._renderDevice(d, vb))}
          </div>
        </div>

        ${this._menuDev ? this._renderMenu() : nothing}
        ${this._roomDialog ? this._renderRoomDialog() : nothing}
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

  private _renderDevice(d: DevItem, vb: number[]): TemplateResult {
    const p = this._pos(d);
    const left = ((p.x - vb[0]) / vb[2]) * 100;
    const top = ((p.y - vb[1]) / vb[3]) * 100;
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

  private _renderRoomDialog(): TemplateResult {
    const areas = this._freeAreas;
    return html`<div class="menuwrap dialogwrap" @click=${this._roomDialogCancel}>
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
          <button class="btn on" @click=${this._saveRoom} ?disabled=${!this._areaSel && !this._nameSel}>
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
      ${this._serverStorage && !this._norm
        ? html`<button class="btn" ?disabled=${this._migrating} @click=${this._migrateToServer}
              title="Перенести планы, комнаты и раскладку в хранилище HA">
              <ha-icon icon="mdi:cloud-upload"></ha-icon>${this._migrating ? '…' : 'На сервер'}
            </button>`
        : nothing}
      <button class="btn ghost" @click=${this._resetLayout} title="Сбросить всё">
        <ha-icon icon="mdi:backup-restore"></ha-icon>
      </button>
    </div>`;
  }

  private _renderMenu(): TemplateResult {
    const d = this._menuDev!;
    return html`<div class="menuwrap" @click=${() => (this._menuDev = null)}>
      <div class="menu" style="left:${this._menuXY.x}px;top:${this._menuXY.y}px" @click=${(e: Event) =>
        e.stopPropagation()}>
        <div class="hd"><ha-icon icon="mdi:lightbulb-group"></ha-icon>${d.name} · ${d.members!.length}</div>
        ${d.linkPrimary
          ? html`<div class="it all" @click=${() => {
              this._menuDev = null;
              this._openMoreInfo(d.linkPrimary);
            }}>
              <ha-icon icon="mdi:lightbulb-group"></ha-icon>Открыть группу целиком
            </div>`
          : nothing}
        ${d.members!.map(
          (m) => html`<div class="it" @click=${() => {
            this._menuDev = null;
            this._openMoreInfo(m.primary);
          }}>
            <ha-icon icon="mdi:lightbulb"></ha-icon>${m.name}
          </div>`,
        )}
      </div>
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
      padding: 32px;
      color: var(--hp-muted);
      text-align: center;
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
