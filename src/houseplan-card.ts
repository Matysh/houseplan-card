/**
 * House Plan Card — интерактивный план дома (дача, Кирилловское) как нативная Lovelace-карточка.
 * Работает от объекта `hass` (без токена). Раскладка иконок хранится на сервере
 * через WS-команды интеграции `houseplan` (fallback — localStorage).
 */
import { LitElement, html, svg, css, nothing, TemplateResult, PropertyValues } from 'lit';
import { ROOMS, FLOOR_VB, FLOOR_TITLES, AREA_NAMES, Room } from './data/house';
import { FLOOR_BG, FLOOR_BG_RECT } from './data/backgrounds';
import { EXCLUDED_DOMAINS, GROUP_TITLES, iconFor, DOMAIN_PRIORITY } from './rules';
import './editor';

const CARD_VERSION = '1.2.0';
const LS_KEY = 'houseplan_card_layout_v1';

interface DevItem {
  id: string;
  name: string;
  model: string;
  area: string;
  floor: string;
  icon: string;
  entities: string[];
  primary?: string;
  temp?: number | null;
  members?: { id: string; name: string; primary?: string }[];
  link?: string | null;
  linkPrimary?: string;
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

  private _floor = 'f1';
  private _edit = false;
  private _layout: Record<string, { x: number; y: number }> = {};
  private _serverStorage = false;
  private _layoutLoaded = false;
  private _devices: DevItem[] = [];
  private _regSignature = '';
  private _defPos: Record<string, { x: number; y: number }> = {};
  private _menuDev: DevItem | null = null;
  private _menuXY = { x: 0, y: 0 };
  private _tip: { x: number; y: number; title: string; meta: string; lqi?: number | null } | null = null;
  private _selId: string | null = null;
  private _toast = '';
  private _toastTimer?: number;

  // drag state
  private _drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _floor: { state: true },
    _edit: { state: true },
    _layout: { state: true },
    _devices: { state: true },
    _menuDev: { state: true },
    _tip: { state: true },
    _selId: { state: true },
    _toast: { state: true },
  };

  public static getConfigElement() {
    return document.createElement('houseplan-card-editor');
  }

  public static getStubConfig(): Partial<CardConfig> {
    return { type: 'custom:houseplan-card', title: 'План дома · Кирилловское' };
  }

  public setConfig(config: CardConfig): void {
    this._config = { icon_size: 2.5, show_temperature: true, live_states: true, show_signal: true, ...config };
    if (config.default_floor) this._floor = config.default_floor;
  }

  public getCardSize(): number {
    return 12;
  }

  private get _rooms(): Room[] {
    return this._config?.rooms?.length ? this._config.rooms : ROOMS;
  }

  private get _areaSet(): Set<string> {
    return new Set(this._rooms.filter((r) => r.area).map((r) => r.area));
  }

  private _areaRoom(area: string): Room | undefined {
    return this._rooms.find((r) => r.area === area);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hass') && this.hass) {
      if (!this._layoutLoaded) {
        this._layoutLoaded = true;
        this._loadLayout();
      }
      this._maybeRebuildDevices();
    }
  }

  // ---------- раскладка: сервер (интеграция houseplan) или localStorage ----------
  private async _loadLayout(): Promise<void> {
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/layout/get' });
      this._layout = (resp && resp.layout) || {};
      this._serverStorage = true;
    } catch (e) {
      this._serverStorage = false;
      try {
        this._layout = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
      } catch {
        this._layout = {};
      }
      this._showToast('Интеграция houseplan не найдена — позиции сохраняются локально');
    }
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

  // ---------- построение списка устройств из реестров hass ----------
  private _maybeRebuildDevices(): void {
    const h = this.hass;
    if (!h?.devices || !h?.entities || !h?.areas) return;
    const sig =
      Object.keys(h.devices).length + ':' + Object.keys(h.entities).length + ':' + Object.keys(h.areas).length;
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
    const usable = ents.filter((e) => !e.reg.entity_category); // без diagnostic/config
    const pool = usable.length ? usable : ents;
    // датчик температуры — сразу температурная сущность
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

  /** LQI zigbee-устройства: среднее по всем *_linkquality сущностям (для группы — по участникам). */
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

  /** Средний LQI zigbee-устройств комнаты. */
  private _roomLqi(area: string): number | null {
    const vals: number[] = [];
    for (const d of this._devices) {
      if (d.area !== area) continue;
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

  /** Курирование + группировка — перенос buildDevices() из прототипа. */
  private _buildDevices(): DevItem[] {
    const h = this.hass;
    const areaSet = this._areaSet;
    const entsBy = this._entitiesByDevice();
    const groupByArea: Record<string, any> = {};
    for (const dev of Object.values<any>(h.devices)) {
      if (dev.model === 'Group' && dev.area_id) groupByArea[dev.area_id] = dev;
    }
    const seen: Record<string, 1> = {};
    const out: DevItem[] = [];
    for (const dev of Object.values<any>(h.devices)) {
      const area = dev.area_id;
      if (!area || !areaSet.has(area)) continue;
      if (dev.entry_type === 'service') continue;
      const entIds = entsBy[dev.id] || [];
      const dom = this._domainOfDevice(dev, entIds);
      if (EXCLUDED_DOMAINS.has(dom)) continue;
      if (dev.model === 'Group') continue;
      if (/scene/i.test(dev.model || '')) continue;
      if (/bridge/i.test((dev.model || '') + (dev.name || ''))) continue;
      if (dom === 'myheat' && dev.via_device_id) continue;
      const name = (dev.name_by_user || dev.name || 'без имени').trim();
      const key = name + '|' + area;
      if (seen[key]) continue;
      seen[key] = 1;
      let icon = iconFor(name, dev.model);
      // устройство с сущностью lock.* — всегда «замочек», как бы оно ни называлось
      if (entIds.some((e) => e.startsWith('lock.'))) icon = 'mdi:lock';
      const room = this._areaRoom(area)!;
      const item: DevItem = {
        id: dev.id,
        name,
        model: dev.model || '',
        area,
        floor: room.floor,
        icon,
        entities: entIds,
      };
      item.primary = this._primaryEntity(entIds, icon);
      if (icon === 'mdi:thermometer' || icon === 'mdi:air-filter') item.temp = this._tempFor(entIds);
      out.push(item);
    }
    // группировка ламп: ≥2 ламп в комнате → одна групповая иконка
    const lamps: Record<string, DevItem[]> = {};
    const rest: DevItem[] = [];
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
        floor: this._areaRoom(area)!.floor,
        icon: 'mdi:lightbulb-group',
        entities: ms.flatMap((m) => m.entities),
        link: grpDev?.id || null,
        members: ms.map((m) => ({ id: m.id, name: m.name, primary: m.primary })),
      };
      if (grpDev) {
        const grpEnts = this._entitiesByDevice()[grpDev.id] || [];
        item.linkPrimary = this._primaryEntity(grpEnts, 'mdi:lightbulb');
      }
      rest.push(item);
    }
    return rest;
  }

  // ---------- позиции ----------
  private _defaultPositions(): Record<string, { x: number; y: number }> {
    const map: Record<string, { x: number; y: number }> = {};
    for (const r of this._rooms) {
      const ds = this._devices.filter((d) => d.area === r.area && d.floor === r.floor && r.area);
      if (!ds.length) continue;
      const pad = 20;
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
    return map;
  }

  private _pos(d: DevItem): { x: number; y: number } {
    const vb = FLOOR_VB[this._floor];
    return this._layout[d.id] || this._defPos[d.id] || { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 };
  }

  // ---------- живые состояния ----------
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

  // ---------- взаимодействие ----------
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
    if (d.members) {
      this._menuDev = d;
      this._menuXY = { x: ev.clientX, y: ev.clientY };
      this._tip = null;
      return;
    }
    this._openMoreInfo(d.primary);
  }

  private _clickRoom(r: Room): void {
    if (this._edit) return;
    navigate('/config/areas/area/' + r.area);
  }

  // drag
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
    const vb = FLOOR_VB[this._floor];
    const rect = stage.getBoundingClientRect();
    const dx = ((ev.clientX - this._drag.sx) / rect.width) * vb[2];
    const dy = ((ev.clientY - this._drag.sy) / rect.height) * vb[3];
    if (Math.abs(ev.clientX - this._drag.sx) + Math.abs(ev.clientY - this._drag.sy) > 3) this._drag.moved = true;
    let nx = Math.round(this._drag.ox + dx);
    let ny = Math.round(this._drag.oy + dy);
    nx = Math.max(vb[0] + 6, Math.min(vb[0] + vb[2] - 6, nx));
    ny = Math.max(vb[1] + 6, Math.min(vb[1] + vb[3] - 6, ny));
    this._layout = { ...this._layout, [d.id]: { x: nx, y: ny } };
  }

  private _pointerUp(_ev: PointerEvent, d: DevItem): void {
    if (!this._drag || this._drag.id !== d.id) return;
    const moved = this._drag.moved;
    this._drag = moved ? this._drag : null; // click-обработчик проверит moved
    if (moved) {
      this._persistLayout();
      this._selId = d.id;
      window.setTimeout(() => (this._drag = null), 0);
    }
  }

  private _applyXY(axis: 'x' | 'y', val: string): void {
    if (!this._selId) return;
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    const d = this._devices.find((x) => x.id === this._selId);
    if (!d) return;
    const vb = FLOOR_VB[this._floor];
    const p = { ...this._pos(d) };
    p[axis] = axis === 'x'
      ? Math.max(vb[0] + 6, Math.min(vb[0] + vb[2] - 6, n))
      : Math.max(vb[1] + 6, Math.min(vb[1] + vb[3] - 6, n));
    this._layout = { ...this._layout, [d.id]: p };
    this._persistLayout();
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

  // ---------- рендер ----------
  protected render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const vb = FLOOR_VB[this._floor];
    const bg = FLOOR_BG[this._floor];
    const bgRect = FLOOR_BG_RECT[this._floor];
    const rooms = this._rooms.filter((r) => r.floor === this._floor && r.area);
    const devs = this._devices.filter((d) => d.floor === this._floor);
    // размер иконки в % от ширины видимой области плана (legacy px-значения > 8 игнорируются)
    const cfgSize = this._config.icon_size ?? 2.5;
    const iconPct = cfgSize > 8 ? 2.5 : cfgSize;

    return html`
      <ha-card>
        <div class="head">
          <div class="title">
            <ha-icon icon="mdi:home-city"></ha-icon>
            ${this._config.title || 'План дома'}
          </div>
          <div class="tabs">
            ${Object.keys(FLOOR_VB).map(
              (f) => html`<button
                class="tab ${this._floor === f ? 'active' : ''}"
                @click=${() => {
                  this._floor = f;
                  this._selId = null;
                }}
              >
                ${FLOOR_TITLES[f] || f}
              </button>`,
            )}
          </div>
          <span class="count">${devs.length} устр.</span>
          <span class="spacer"></span>
          <button class="btn ${this._edit ? 'on' : ''}" @click=${() => {
            this._edit = !this._edit;
            this._selId = null;
          }} title="Режим правки: перетаскивание иконок">
            <ha-icon icon="mdi:cursor-move"></ha-icon>
          </button>
        </div>

        <div class="stage ${this._edit ? 'edit' : ''}" style="aspect-ratio:${vb[2]}/${vb[3]}">
          <svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">
            ${bg && bgRect
              ? svg`<image href="${bg}" x="${bgRect[0]}" y="${bgRect[1]}" width="${bgRect[2]}" height="${bgRect[3]}" preserveAspectRatio="none" />`
              : nothing}
            ${rooms.map(
              (r) => svg`<rect
                  class="room ${bg ? 'overlay' : 'yard'}"
                  x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8"
                  @click=${() => this._clickRoom(r)}
                  @mousemove=${(e: MouseEvent) =>
                    this._showTip(e, r.name, 'комната — открыть зону',
                      this._config?.show_signal ? this._roomLqi(r.area) : null)}
                  @mouseleave=${() => (this._tip = null)}
                ></rect>
                ${!bg ? svg`<text class="rlabel" x="${r.x + r.w / 2}" y="${r.y + 26}">${r.name}</text>` : nothing}`,
            )}
          </svg>
          <div class="devlayer" style="--icon-size:${iconPct}cqw">
            ${devs.map((d) => this._renderDevice(d, vb))}
          </div>
        </div>

        ${this._edit ? this._renderEditbar() : nothing}
        ${this._menuDev ? this._renderMenu() : nothing}
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
    const lqi = this._config?.show_signal ? this._lqiFor(d.entities) : null;
    return html`<div
      class="dev ${cls} ${this._selId === d.id ? 'sel' : ''}"
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
      <span class="hint">${this._serverStorage ? 'сохранение: сервер (для всех)' : 'сохранение: этот браузер'}</span>
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
      overflow: hidden;
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
    .stage {
      position: relative;
      width: 100%;
      container-type: inline-size; /* cqw = % ширины плана для размеров иконок */
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
      transition: transform 0.08s, background 0.15s, border-color 0.15s, opacity 0.2s;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      z-index: 2;
    }
    .dev ha-icon {
      --mdc-icon-size: calc(var(--icon-size, 2.5cqw) * 0.62);
    }
    .dev:hover {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      transform: scale(1.35);
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
      border-top: 1px solid var(--hp-line);
      font-size: 13px;
      flex-wrap: wrap;
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

(wi