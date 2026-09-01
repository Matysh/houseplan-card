import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._openSpaceDialog('create');
  out.newSpaceUsesDaynight = c._spaceDialog?.bgMode === 'daynight';
  c._spaceDialog = null;
  c._importQueue = ['Imported floor'];
  c._openNextImport();
  out.floorImportUsesDaynight = c._spaceDialog?.bgMode === 'daynight';
  c._spaceDialog = null;
  // 1) диалог общих настроек: инвентарь строк и групп (обновлён фичей «Солнце»)
  c._openSettingsDialog(); await c.updateComplete;
  out.rows = sr().querySelectorAll('.gsrow').length;
  out.groups = [...sr().querySelectorAll('hp-dialog .dispsection')].map((l) => l.textContent.trim());
  const glowRadius = [...sr().querySelectorAll('hp-dialog .gsrow')]
    .find((row) => row.textContent.includes(c._t('gs.glow_radius')));
  const wallGroup = [...sr().querySelectorAll('hp-dialog .dispsection')]
    .find((row) => row.textContent.trim() === c._t('gs.wall_group'));
  out.glowRadiusInsideGlowGroup = !!glowRadius && !!wallGroup
    && !!(glowRadius.compareDocumentPosition(wallGroup) & Node.DOCUMENT_POSITION_FOLLOWING);
  // #43: About moved into the dedicated Help & Feedback dialog and must not
  // survive as a duplicate at the bottom of General Settings.
  out.aboutMovedOut = !sr().querySelector('hp-dialog .aboutver')
    && sr().querySelectorAll('hp-dialog a.aboutlink').length === 0;
  // 2) сменить цвет light_on и сохранить
  c._setFillColor('light_on', { c: '#ff00ff', a: 0.5 });
  await c._saveSettingsDialog(); await c.updateComplete;
  out.saved = c._serverCfg.settings.fill_colors?.light_on;
  // 3) заливка light использует кастомный цвет
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { ...(s.settings||{}), show_borders: true, fill_mode: 'light' } })) };
  c.requestUpdate(); await c.updateComplete;
  const styledRooms = [...sr().querySelectorAll('.room.styled')];
  out.customFillUsed = styledRooms.some((room) => (
    room.style.getPropertyValue('--room-fill').trim() === '#ff00ff'
    && Math.abs(Number(room.style.getPropertyValue('--room-fill-op')) - 0.5) < 1e-9
  ));
  // 4) show_lqi=false у пространства скрывает LQI-бейджи
  out.lqiBefore = sr().querySelectorAll('.dev .lqi').length;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { ...(s.settings||{}), show_lqi: false } })) };
  c.requestUpdate(); await c.updateComplete;
  out.lqiAfter = sr().querySelectorAll('.dev .lqi').length;
  // The space value is an explicit override, not another condition ANDed with
  // the card default. This is the projection shared by preview/static cards.
  c._config = { ...c._config, show_signal: false };
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { ...(s.settings||{}), show_lqi: true } })) };
  c.requestUpdate(); await c.updateComplete;
  out.spaceLqiOverridesCardDefault = sr().querySelectorAll('.dev .lqi').length > 0;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "rows": 15, // 11 цветов (включая wall_fill) + радиус свечения + фон
               // + «Оптимизировать планы» (docs/CANVAS.md §9)
  "groups": ["Fill: lights", "Fill: temperature", "Fill: zigbee signal", "Light-source glow", "Walls", "Stage background", "Sun", "Backup and transfer", "Plan maintenance"],
  "aboutMovedOut": true,
  "saved": {"c": "#ff00ff", "a": 0.5},
  "newSpaceUsesDaynight": true,
  "floorImportUsesDaynight": true,
  "lqiBefore": 7,
  "lqiAfter": 0,
});
await finish(browser, res);
