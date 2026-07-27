import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  let pageError = null;
  window.addEventListener('error', (e) => { pageError = String(e.message); });
  // сохранение падает, а диалог закрыт до ответа — карточка не должна умереть
  c.hass = { ...c.hass, callWS: async (msg) => {
    if (String(msg.type).endsWith('/set')) { await new Promise((r) => setTimeout(r, 60)); throw new Error('boom'); }
    return { config: c._serverCfg, rev: c._cfgRev };
  } };
  await c.updateComplete;
  // 1) диалог общих настроек
  c._openSettingsDialog(); await c.updateComplete;
  const p = c._saveSettingsDialog();
  c._settingsDialog = null; // Esc во время сохранения
  await c.updateComplete;
  await p.catch(() => {});
  await new Promise((r) => setTimeout(r, 120));
  await c.updateComplete;
  out.settingsStaysClosed = c._settingsDialog === null;
  out.cardAliveAfterSettings = !!sr().querySelector('.stage');
  // 2) диалог правил
  c._openRulesDialog(); await c.updateComplete;
  const p2 = c._saveRules();
  c._rulesDialog = null; await c.updateComplete;
  await p2.catch(() => {});
  await new Promise((r) => setTimeout(r, 120));
  await c.updateComplete;
  out.rulesStaysClosed = c._rulesDialog === null;
  out.cardAliveAfterRules = !!sr().querySelector('.stage');
  // 3) диалог устройства
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog(c._devices[0]); await c.updateComplete;
  const p3 = c._saveMarker();
  c._markerDialog = null; await c.updateComplete;
  await p3.catch(() => {});
  await new Promise((r) => setTimeout(r, 120));
  await c.updateComplete;
  out.markerStaysClosed = c._markerDialog === null;
  out.cardAliveAfterMarker = !!sr().querySelector('.stage');
  out.noPageError = pageError === null;
  // 4) при ОТКРЫТОМ диалоге ошибка снимает busy (поведение сохранено)
  c._openSettingsDialog(); await c.updateComplete;
  const p4 = c._saveSettingsDialog();
  await p4.catch(() => {});
  await new Promise((r) => setTimeout(r, 120));
  out.busyClearedWhenOpen = c._settingsDialog !== null && c._settingsDialog.busy === false;
  c._settingsDialog = null;
  return out;
});
checkAll(res);
await finish(browser, res);
