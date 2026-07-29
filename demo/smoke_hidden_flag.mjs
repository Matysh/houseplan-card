// docs/FILTERING.md: скрытие — явная галка. Конфиг материализуется сеятелем
// (filter_seeded), галка в диалоге у всех устройств, «Показать скрытые» —
// локальный режим редактора, скрытые рисуются призраками и только там.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

// --- сеятель материализует конфиг при загрузке ---------------------------
out.configSeeded = await page.evaluate(async () => {
  const c = window.__card;
  const t0 = Date.now();
  while (!c._serverCfg?.settings?.filter_seeded && Date.now() - t0 < 3000) {
    await new Promise((r) => setTimeout(r, 60));
  }
  return c._serverCfg?.settings?.filter_seeded === true;
});

// --- галка прячет, счётчик не считает, призрак только в редакторе --------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const visibleIds = () => [...sr().querySelectorAll('.dev')].length;
  const before = visibleIds();

  const d = c._devices.find((x) => x.space === 'f1' && x.bindingKind === 'device');
  c._serverCfg.markers = c._serverCfg.markers || [];
  c._serverCfg.markers.push({ id: d.id, binding: 'device:' + d.bindingRef, hidden: true });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;

  o.hiddenNotRendered = visibleIds() === before - 1;
  const built = c._devices.find((x) => x.id === d.id);
  o.stillBuilt = !!built && built.hidden === true;
  o.countExcludesHidden = (sr().querySelector('.count')?.textContent || '').includes(String(before - 1));

  // в просмотре тумблера нет эффекта — призраки только в редакторе устройств
  c._showHidden = true; c.requestUpdate(); await c.updateComplete;
  o.noGhostsInView = !sr().querySelector('.dev.ghost');
  c._setMode('devices'); c.requestUpdate(); await c.updateComplete;
  o.ghostInEditor = !!sr().querySelector('.dev.ghost');
  // призрак — конфигурация, не статус: ни жёлтого, ни unavail, ни тревоги
  const g = sr().querySelector('.dev.ghost');
  o.ghostHasNoState = !!g && !g.classList.contains('on') && !g.classList.contains('open')
    && !g.classList.contains('unavail') && !g.classList.contains('alarm');
  // и он синий, а не тёмный — отличим от недоступного устройства
  o.ghostIsBlue = !!g && getComputedStyle(g).borderStyle.includes('dashed')
    && getComputedStyle(g).borderColor !== 'rgb(255, 255, 255)';
  // тумблер локальный: конфиг не трогается
  o.toggleIsLocal = c._serverCfg.settings.show_all === undefined;

  // --- галка в диалоге у авто-устройства, кнопки «Удалить» нет -----------
  const ghost = c._devices.find((x) => x.id === d.id);
  c._openMarkerDialog(ghost); await c.updateComplete;
  o.checkboxOn = c._markerDialog?.hideFromPlan === true;
  o.noDeleteForAuto = !sr().querySelector('.dialog .btn.danger');
  // снимаем галку и сохраняем — маркер остаётся с hidden:false (анти-повтор)
  c._markerDialog = { ...c._markerDialog, hideFromPlan: false };
  await c._saveMarker(); await c.updateComplete;
  const m = (c._serverCfg.markers || []).find((x) => x.binding === 'device:' + d.bindingRef);
  o.untickKeepsMarker = !!m && m.hidden === false;
  const back = c._devices.find((x) => x.id === d.id) || c._devices.find((x) => x.bindingRef === d.bindingRef);
  o.deviceVisibleAgain = !!back && !back.hidden;

  // --- у виртуального кнопка «Удалить» есть -------------------------------
  c._openMarkerDialog(); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, name: 'Тест', binding: 'virtual' };
  await c._saveMarker(); await c.updateComplete;
  const virt = c._devices.find((x) => x.virtual);
  c._openMarkerDialog(virt); await c.updateComplete;
  o.deleteForVirtual = !!sr().querySelector('.dialog .btn.danger');
  c._markerDialog = null; c._setMode('view');
  return o;
}));

// --- HP-1510-02: призрак не показывает live-значения ----------------------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // датчик с числом + display:value, скрыт
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'sensor.power_meter': { state: '42', attributes: { unit_of_measurement: 'kW' } } } };
  c._serverCfg.markers = c._serverCfg.markers || [];
  c._serverCfg.markers.push({ id: 'pm', binding: 'entity:sensor.power_meter',
    display: 'value', hidden: true, space: 'f1' });
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices();
  c._setMode('devices'); c._showHidden = true;
  c.requestUpdate(); await c.updateComplete;
  const ghosts = [...sr().querySelectorAll('.dev.ghost')];
  const pm = ghosts.find((g) => g.textContent.includes('42')) || null;
  o.ghostHidesValue = pm === null; // «42 kW» не отрисован
  o.ghostNoLiveBadges = ghosts.every((g) =>
    !g.querySelector('.valtext') && !g.querySelector('.tval') && !g.querySelector('.hval') && !g.querySelector('.lqi'));
  o.ghostKeepsIcon = ghosts.every((g) => !!g.querySelector('ha-icon') || g.classList.contains('noicon'));
  c._setMode('view'); c._showHidden = false;
  return o;
}));

// --- HP-1510-01: LQI комнаты одинаков на полной и статичной карточке ------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  await customElements.whenDefined('houseplan-space-card');
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  const f1 = cfg.spaces.find((s) => s.id === 'f1');
  f1.settings = { ...(f1.settings || {}), fill_mode: 'lqi', show_borders: true };
  // прячем ВСЕ устройства зоны living_room: комнату красит только скрытое
  for (const d of c._devices.filter((x) => x.area === 'living_room' && !x.virtual)) {
    if (!cfg.markers.some((m) => m.id === d.id)) {
      cfg.markers.push({ id: d.id, binding: d.bindingKind + ':' + d.bindingRef, hidden: true });
    } else {
      cfg.markers = cfg.markers.map((m) => (m.id === d.id ? { ...m, hidden: true } : m));
    }
  }
  c._serverCfg = cfg; c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const fullRoom = [...(c.shadowRoot || c.renderRoot).querySelectorAll('.room')]
    .find((r) => (r.getAttribute('style') || '').includes('--room-fill'));
  const fullFill = fullRoom ? (fullRoom.getAttribute('style').match(/--room-fill:([^;]+)/) || [])[1] : null;

  const hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    return { ok: true };
  } };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = hass;
  host.appendChild(card);
  const t0 = Date.now();
  while (!card.renderRoot?.querySelector('.room') && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 60));
  }
  await card.updateComplete;
  const stRoom = [...card.renderRoot.querySelectorAll('.room')]
    .find((r) => (r.getAttribute('style') || '').includes('--room-fill'));
  const stFill = stRoom ? (stRoom.getAttribute('style').match(/--room-fill:([^;]+)/) || [])[1] : null;
  o.fullPaintsHiddenLqi = !!fullFill;
  o.staticPaintsHiddenLqi = !!stFill;
  o.lqiParity = !!fullFill && fullFill === stFill;
  host.remove();
  return o;
}));

await finish(browser, checkAll(out));
