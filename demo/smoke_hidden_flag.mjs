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

await finish(browser, checkAll(out));
