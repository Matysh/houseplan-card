// ТЗ 2026-07-29: действие по нажатию «Запустить автоматизацию/скрипт/сцену»
// с пикером и поиском + чекбокс «Спрашивать подтверждение» для toggle/run.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  c.hass = { ...c.hass,
    entities: { ...c.hass.entities,
      'automation.evening': { entity_id: 'automation.evening', platform: 'automation', disabled_by: null },
      'script.curtains': { entity_id: 'script.curtains', platform: 'script', disabled_by: null },
      'scene.movie': { entity_id: 'scene.movie', platform: 'scene', disabled_by: null } },
    states: { ...c.hass.states,
      'automation.evening': { state: 'on', attributes: { friendly_name: 'Вечерний свет' } },
      'script.curtains': { state: 'off', attributes: { friendly_name: 'Шторы' } },
      'scene.movie': { state: '', attributes: { friendly_name: 'Кино' } } },
    callService: async (dom, svc, data) => { calls.push([dom, svc, data]); return {}; } };

  // --- диалог: выбор run + пикер с поиском --------------------------------
  const d = c._devices.find((x) => x.space === 'f1' && x.bindingKind === 'device');
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog(d); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, tapAction: 'run' }; await c.updateComplete;
  // ВИДИМОСТЬ, не просто наличие в DOM: список — flex-item со скроллом и
  // однажды схлопнулся в полоску 1px при 26 кандидатах внутри (репорт
  // пользователя 2026-07-30, поймано только замером высоты)
  const listEl = () => sr().querySelector('hp-dialog .candlist');
  o.pickerShown = !!listEl() && listEl().getBoundingClientRect().height > 30;
  c._markerDialog = { ...c._markerDialog, runFilter: 'штор' }; await c.updateComplete;
  const cands = [...sr().querySelectorAll('hp-dialog .cand')].map((x) => x.textContent);
  o.searchWorks = cands.length >= 1 && cands.some((t) => t.includes('Шторы'));
  // и найденная строка реально нарисована, а не сплющена
  const row = sr().querySelector('hp-dialog .cand');
  o.resultRowVisible = !!row && row.getBoundingClientRect().height > 10
    && row.getBoundingClientRect().bottom <= listEl().getBoundingClientRect().bottom + 1;
  // сохранение без цели блокируется
  await c._saveMarker(); await c.updateComplete;
  o.saveBlockedWithoutTarget = !!c._markerDialog;
  // выбираем цель + подтверждение, сохраняем
  c._markerDialog = { ...c._markerDialog, tapTarget: 'script.curtains', tapConfirm: true };
  await c.updateComplete;
  o.confirmCheckboxShown = [...sr().querySelectorAll('hp-dialog .srcrow')].length >= 2;
  await c._saveMarker(); await c.updateComplete;
  const saved = (c._serverCfg.markers || []).find((m) => m.binding === 'device:' + d.bindingRef);
  o.markerSaved = saved?.tap_action === 'run' && saved?.tap_target === 'script.curtains' && saved?.tap_confirm === true;

  // --- тап: подтверждение → отмена → вызова нет ---------------------------
  c._setMode('view'); c._regSignature = ''; c._maybeRebuildDevices();
  c.requestUpdate(); await c.updateComplete;
  const dev = c._devices.find((x) => x.id === (saved?.id ?? d.id)) || c._devices.find((x) => x.bindingRef === d.bindingRef);
  c._clickDevice({ stopPropagation() {} }, dev); await c.updateComplete;
  o.confirmDialogShown = !!c._tapConfirm && c._tapConfirm.text.includes('Шторы');
  c._tapConfirm = null; await c.updateComplete;
  o.cancelNoCall = calls.length === 0;

  // --- тап: подтвердили → script.turn_on ----------------------------------
  c._clickDevice({ stopPropagation() {} }, dev); await c.updateComplete;
  const conf = c._tapConfirm; c._tapConfirm = null; conf.exec();
  await new Promise((r) => setTimeout(r, 10));
  o.runCalled = calls.length === 1 && calls[0][0] === 'script' && calls[0][1] === 'turn_on'
    && calls[0][2].entity_id === 'script.curtains';

  // --- без подтверждения: сразу вызов; автоматизация → trigger ------------
  c._serverCfg.markers = c._serverCfg.markers.map((m) =>
    m.id === (saved?.id ?? d.id) ? { ...m, tap_target: 'automation.evening', tap_confirm: null } : m);
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  const dev2 = c._devices.find((x) => x.bindingRef === d.bindingRef);
  calls.length = 0;
  c._clickDevice({ stopPropagation() {} }, dev2); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 10));
  o.automationTriggered = calls.length === 1 && calls[0][0] === 'automation' && calls[0][1] === 'trigger';
  o.noConfirmWhenOff = !c._tapConfirm;

  // --- цель удалена → тост, вызова нет ------------------------------------
  const states2 = { ...c.hass.states }; delete states2['automation.evening'];
  c.hass = { ...c.hass, states: states2 };
  calls.length = 0;
  c._clickDevice({ stopPropagation() {} }, dev2); await c.updateComplete;
  o.missingTargetSafe = calls.length === 0 && !!c._toast;

  // очистка
  c._serverCfg.markers = c._serverCfg.markers.filter((m) => m.id !== (saved?.id ?? d.id));
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  return o;
});
await finish(browser, checkAll(out));
