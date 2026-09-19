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
  // #598: форма собрана в карточки. Заголовок группы теперь либо заголовок
  // карточки (`.hpf-head h3`), либо подзаголовок внутри неё (`.dispsection`).
  // Снимаются ОБА списка: проверка стала строже, а не мягче — прежняя не видела
  // карточек вовсе.
  out.cards = [...sr().querySelectorAll('hp-dialog .hpf-card > .hpf-head h3')]
    .map((l) => l.textContent.trim());
  out.groups = [...sr().querySelectorAll('hp-dialog .dispsection')].map((l) => l.textContent.trim());
  // Каждая карточка обязана быть непустой: пустая — это забытый перенос поля.
  out.everyCardHasContent = [...sr().querySelectorAll('hp-dialog .hpf-card')]
    .every((card) => card.querySelector('.hpf-head + *'));
  const glowRadius = [...sr().querySelectorAll('hp-dialog .gsrow')]
    .find((row) => row.textContent.includes(c._t('gs.glow_radius')));
  const glowCard = [...sr().querySelectorAll('hp-dialog .hpf-card')]
    .find((card) => card.querySelector('.hpf-head h3')?.textContent.trim() === c._t('gs.glow_group'));
  // Радиус свечения обязан лежать ВНУТРИ карточки свечения, а не просто раньше
  // следующего заголовка: карточка — настоящая граница, подпись ею не была.
  out.glowRadiusInsideGlowGroup = !!glowRadius && !!glowCard && glowCard.contains(glowRadius);
  // Сообщение о состоянии остаётся абзацем на виду, а не уезжает под «?» (#598 К5).
  out.sunMissingStaysVisible = !sr().querySelector('hp-dialog hp-help[data-help-key="gs.sun_missing.help"]');
  // Пояснения, которые переехали под «?», обязаны быть доступны кнопкой.
  out.movedHintsHaveHelp = ['gs.radar_show_live.help', 'gs.card_fills.help',
    'gs.backup_group.help', 'gs.grid_group.help']
    .every((key) => !!sr().querySelector(`hp-dialog hp-help[data-help-key="${key}"]`));
  // И ни одного абзаца-пояснения из тех, что переехали, в форме не осталось.
  out.noMovedHintParagraphs = ![...sr().querySelectorAll('hp-dialog .rhint')]
    .some((node) => node.textContent.trim() === c._t('gs.radar_show_live.help')
      || node.textContent.trim() === c._t('gs.backup_group.help')
      || node.textContent.trim() === c._t('gs.grid_group.help'));
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
  "rows": 16, // 11 цветов (включая wall_fill) + радиус свечения + фон
               // + грань окна #577 + «Оптимизировать планы» (docs/CANVAS.md §9)
  "cards": ["Display", "Zigbee links", "Room fill colors", "Light-source glow", "Plan", "Sun", "Data"],
  "groups": ["Fill: lights", "Fill: temperature", "Fill: zigbee signal", "Walls", "Stage background", "Backup and transfer", "Plan maintenance"],
  "everyCardHasContent": true,
  "sunMissingStaysVisible": true,
  "movedHintsHaveHelp": true,
  "noMovedHintParagraphs": true,
  "aboutMovedOut": true,
  "saved": {"c": "#ff00ff", "a": 0.5},
  "newSpaceUsesDaynight": true,
  "floorImportUsesDaynight": true,
  "lqiBefore": 7,
  "lqiAfter": 0,
});
await finish(browser, res);
