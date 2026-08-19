// Хуки для card-mod (docs/STYLING-HOOKS.md): на каждом значимом объекте плана
// есть стабильные data-атрибуты, и по документированным селекторам элементы
// НАХОДЯТСЯ через querySelector — ровно так, как их будет искать чужой CSS.
//   1) устройство: data-hp="device" + data-id + data-entity + data-area;
//   2) комната: data-hp="room" + data-id + data-area;
//   3) видимая подпись комнаты: data-hp="room-label" + data-id на HTML-карточке;
//   4) проём: data-hp="opening" + data-id + data-kind (door/window/gate);
//   5) декор: data-hp="decor" + data-id + data-kind (line/rect/ellipse/text);
//   6) вкладка пространства: data-hp="space-tab" + data-id;
//   7) «нет значения — нет атрибута»: у виртуального маркера нет data-entity,
//      у комнаты без area нет data-area (никаких "undefined" в DOM);
//   8) те же хуки в статичной карточке houseplan-space-card.
// ПАДАЕТ на сборке до этих правок: data-hp нет вообще, а data-id есть только
// у текстовой надписи декора.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const q = (sel) => sr().querySelector(sel);
  const qa = (sel) => [...sr().querySelectorAll(sel)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ============ 1. устройства ============
  const devs = qa('[data-hp="device"]');
  out.deviceHookFindsEveryMarker = devs.length > 0 && devs.length === qa('.dev').length;
  out.deviceKeepsItsClass = devs.every((e) => e.classList.contains('dev'));
  out.deviceHasId = devs.every((e) => !!e.getAttribute('data-id'));
  // id — тот же, что у устройства в модели карточки, а не порядковый номер в DOM
  const modelIds = new Set(c._devices.filter((d) => d.space === c._space && !d.hidden).map((d) => d.id));
  out.deviceIdIsTheConfigId = devs.every((e) => modelIds.has(e.getAttribute('data-id')));
  // селектор из документации находит конкретное устройство по СУЩНОСТИ
  const lock = q('[data-hp="device"][data-entity="lock.front_door"]');
  out.deviceFoundByEntity = !!lock;
  out.deviceEntityMatchesPrimary = !!lock
    && c._devices.find((d) => d.id === lock.getAttribute('data-id'))?.primary === 'lock.front_door';
  out.deviceHasArea = lock?.getAttribute('data-area') === 'hallway';
  // и по ЗОНЕ: все маркеры кухни разом
  out.devicesFoundByArea = qa('[data-hp="device"][data-area="kitchen"]').length > 0;
  out.noUndefinedAnywhere = !sr().innerHTML.includes('="undefined"');

  // ============ 2. комнаты ============
  const rooms = qa('[data-hp="room"]');
  out.roomHookFindsEveryRoom = rooms.length === c._curSpaceCfg.rooms.length;
  out.roomKeepsItsClass = rooms.every((e) => e.classList.contains('room'));
  const kitchen = q('[data-hp="room"][data-area="kitchen"]');
  out.roomFoundByArea = !!kitchen && kitchen.getAttribute('data-id') === 'r2';
  out.roomFoundById = !!q('[data-hp="room"][data-id="r3"]');
  out.roomIsAnSvgShape = !!kitchen && ['polygon', 'rect', 'path'].includes(kitchen.tagName.toLowerCase());

  // ============ 3. подписи комнат ============
  // #203: false означает отсутствие подписи, а не вторую SVG-реализацию.
  // При true единственный публичный hook живёт на HTML-карточке.
  const disp = c._curSpaceCfg.settings || (c._curSpaceCfg.settings = {});
  const wasNames = disp.show_names;
  const planUrl = c._curSpaceCfg.plan_url;
  const redraw = async () => {
    c._cfgEpoch++; c._regSignature = ''; c.requestUpdate();
    await c.updateComplete; await sleep(60); await c.updateComplete;
  };
  delete c._curSpaceCfg.plan_url; disp.show_names = false; await redraw();
  out.hiddenRoomLabelsAreAbsent = qa('[data-hp="room-label"]').length === 0
    && qa('text.rlabel').length === 0;
  c._curSpaceCfg.plan_url = planUrl; disp.show_names = true; await redraw();
  const htmlLabel = q('div.roomlabel[data-hp="room-label"][data-id="r2"]');
  out.htmlRoomLabelHooked = !!htmlLabel;
  out.htmlRoomLabelHasArea = htmlLabel?.getAttribute('data-area') === 'kitchen';
  disp.show_names = wasNames; await redraw();

  // ============ 4. проёмы ============
  c._curSpaceCfg.openings = [
    { id: 'op_d', type: 'door', x: 0.55, y: 0.3, angle: 90, length: 0.09 },
    { id: 'op_w', type: 'window', x: 0.3, y: 0.14, angle: 0, length: 0.12 },
    // bottom wall of r1: the room is above it, so an exterior gate must open
    // toward +Y. The two compact leaves therefore rotate +10° / -10°.
    { id: 'op_g', type: 'gate', x: 0.3, y: 0.58, angle: 0, length: 0.3 },
  ];
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  out.openingHookFindsEveryType = qa('[data-hp="opening"]').length === 3;
  const door = q('[data-hp="opening"][data-kind="door"]');
  const win = q('[data-hp="opening"][data-kind="window"]');
  const gate = q('[data-hp="opening"][data-kind="gate"]');
  out.openingKindDoor = door?.getAttribute('data-id') === 'op_d';
  out.openingKindWindow = win?.getAttribute('data-id') === 'op_w';
  out.openingKindGate = gate?.getAttribute('data-id') === 'op_g';
  out.openingKeepsItsClass = !!door && door.classList.contains('opening');
  const gateLeaves = [...(gate?.querySelectorAll('.op-leaf') || [])];
  out.gateHasTwoLeaves = gateLeaves.length === 2;
  out.gateOpensOnlyTenDegreesOutward = gateLeaves[0]?.getAttribute('style')?.includes('rotate(10deg)')
    && gateLeaves[1]?.getAttribute('style')?.includes('rotate(-10deg)')
    && !gate?.querySelector('.op-arc');

  // ============ 5. декор ============
  c._curSpaceCfg.decor = [
    { id: 'dc_l', kind: 'line', x1: 0.1, y1: 0.9, x2: 0.4, y2: 0.9, color: '#123456', width: 3 },
    { id: 'dc_r', kind: 'rect', x: 0.1, y: 0.2, w: 0.1, h: 0.08, color: '#123456', width: 2 },
    { id: 'dc_e', kind: 'ellipse', x: 0.3, y: 0.2, w: 0.1, h: 0.08, color: '#123456', width: 2 },
    { id: 'dc_t', kind: 'text', x: 0.5, y: 0.92, text: 'Подпись', color: '#123456' },
  ];
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  out.decorHookFindsEveryShape = qa('[data-hp="decor"]').length === 4;
  out.decorKindLine = q('[data-hp="decor"][data-kind="line"]')?.getAttribute('data-id') === 'dc_l';
  out.decorKindRect = q('[data-hp="decor"][data-kind="rect"]')?.getAttribute('data-id') === 'dc_r';
  out.decorKindEllipse = q('[data-hp="decor"][data-kind="ellipse"]')?.getAttribute('data-id') === 'dc_e';
  out.decorKindText = q('[data-hp="decor"][data-kind="text"]')?.getAttribute('data-id') === 'dc_t';
  out.decorKeepsItsClasses = qa('[data-hp="decor"]').length === 4
    && qa('[data-hp="decor"]').every((e) => e.classList.contains('dshape'))
    && !!q('[data-hp="decor"][data-kind="text"]')?.classList.contains('dtext');
  // старый селектор текстовой надписи (его уже использует smoke_decor_text) цел
  out.legacyDtextSelectorStillWorks = !!q('text.dtext[data-id="dc_t"]');

  // ============ 6. вкладки пространств ============
  const tabs = qa('[data-hp="space-tab"]');
  out.spaceTabHookFindsEveryFloor = tabs.length === c._model.length;
  out.spaceTabHasId = tabs.map((e) => e.getAttribute('data-id')).join(',') === c._model.map((s) => s.id).join(',');
  out.spaceTabKeepsItsClass = tabs.every((e) => e.classList.contains('tab'));
  // кнопка «＋» вкладкой пространства не является
  out.addButtonIsNotASpaceTab = !q('.tabadd[data-hp]');

  // ============ 7. «нет значения — нет атрибута» ============
  c._serverCfg = { ...c._serverCfg, markers: [
    { id: 'm_virt', binding: 'virtual', space: c._space, name: 'Вентиль' },
  ] };
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const virt = q('[data-hp="device"][data-id="m_virt"]');
  out.virtualMarkerRendered = !!virt;
  out.virtualHasNoEntityAttr = !!virt && !virt.hasAttribute('data-entity');
  out.virtualHasNoUndefinedText = !!virt && virt.getAttribute('data-entity') === null;
  // комната без HA-области (подкомната): data-hp есть, data-area нет.
  // Она рисуется только когда включены границы — это её обычное условие показа.
  c._curSpaceCfg.rooms = [...c._curSpaceCfg.rooms,
    { id: 'r_sub', name: 'Кладовка', area: null, poly: [[0.06, 0.6], [0.2, 0.6], [0.2, 0.7], [0.06, 0.7]] }];
  disp.show_borders = true;
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  const sub = q('[data-hp="room"][data-id="r_sub"]');
  out.roomWithoutAreaRendered = !!sub;
  out.roomWithoutAreaHasNoAreaAttr = !!sub && !sub.hasAttribute('data-area');
  out.stillNoUndefinedAnywhere = !sr().innerHTML.includes('="undefined"');

  // ============ 8. ограничение shadow DOM (docs/STYLING-HOOKS.md §5) =========
  // хост ha-icon доступен селектору, его внутренности — нет: именно поэтому
  // хуки висят на НАШИХ обёртках
  const anyIcon = q('[data-hp="device"] ha-icon');
  out.iconHostReachable = !!anyIcon;
  out.iconInternalsAreBehindItsOwnRoot = !!anyIcon && !!anyIcon.shadowRoot
    && !sr().querySelector('[data-hp="device"] ha-icon svg');
  return out;
});
checkAll(res, { iconInternalsAreBehindItsOwnRoot: !!res.iconInternalsAreBehindItsOwnRoot });

// ============ 9. те же хуки в статичной карточке ============
const stat = await page.evaluate(async () => {
  const out = {};
  await customElements.whenDefined('houseplan-space-card');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const el = document.createElement('houseplan-space-card');
  el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  // своя копия конфига с включёнными именами: у статичной карточки подпись
  // комнаты — это HTML-плашка, и она должна нести тот же хук
  const base = window.__card.hass;
  const cfg = JSON.parse(JSON.stringify(window.__card._serverCfg));
  cfg.spaces[0].settings = { ...(cfg.spaces[0].settings || {}), show_names: true };
  el.hass = { ...base, callWS: async (m) => (m.type === 'houseplan/config/get'
    ? { config: cfg, rev: 9 } : base.callWS(m)) };
  host.appendChild(el);
  const t0 = Date.now();
  while (!el.renderRoot?.querySelector('.hp-static-stage') && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 80));
  }
  await el.updateComplete;
  const rr = el.renderRoot;
  out.staticRoomsHooked = rr.querySelectorAll('[data-hp="room"]').length > 0;
  out.staticRoomFoundByArea = !!rr.querySelector('[data-hp="room"][data-area="kitchen"]');
  out.staticRoomFoundById = !!rr.querySelector('[data-hp="room"][data-id="r1"]');
  out.staticDevicesHooked = rr.querySelectorAll('[data-hp="device"]').length > 0;
  out.staticDeviceFoundByEntity = !!rr.querySelector('[data-hp="device"][data-entity="lock.front_door"]');
  out.staticNoUndefined = !rr.innerHTML.includes('="undefined"');
  out.staticRoomLabelHooked = rr.querySelectorAll('div.roomlabel[data-hp="room-label"]').length > 0;
  out.staticRoomLabelFoundByArea = !!rr.querySelector('[data-hp="room-label"][data-area="bedroom"]');
  // а вот проёмов и декора она не рисует вовсе (§5) — и это не регрессия
  out.staticDrawsNoOpenings = rr.querySelectorAll('[data-hp="opening"]').length === 0;
  out.staticDrawsNoDecor = rr.querySelectorAll('[data-hp="decor"]').length === 0;
  return out;
});
checkAll(stat);
await finish(browser, { ...res, ...stat });
