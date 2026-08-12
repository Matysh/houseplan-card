import { launch, check, checkAll, finish } from './serve.mjs';
import { readFileSync } from 'node:fs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
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
  // 1b) блок About: версия + две внешние ссылки (target=_blank rel=noopener)
  out.aboutVersion = sr().querySelector('hp-dialog .aboutver')?.textContent.trim() ?? null;
  out.aboutLinks = [...sr().querySelectorAll('hp-dialog a.aboutlink')].map((a) => ({
    href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') }));
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
// CARD_VERSION из собранного бандла (тот же текст уходит в console-баннер).
// terser либо инлайнит строку (v1.56.0), либо оставляет переменную (v${xx}) —
// во втором случае доразрешаем её по присваиванию xx="1.56.0".
// Версия — SemVer, у пре-релиза есть суффикс (1.58.0-beta.1), он тоже часть строки.
const bundle = readFileSync(new URL('./srv/assets/houseplan-card.js', import.meta.url), 'utf8');
const SEMVER = '\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?';
const m = bundle.match(new RegExp(`HOUSEPLAN-CARD %c v(?:(${SEMVER})|\\$\\{(\\w+)\\})`));
const BUNDLE_VERSION = m?.[1] ?? (m?.[2] && bundle.match(new RegExp(`[^\\w$]${m[2]}="(${SEMVER})"`))?.[1]);
check('bundleVersionFound', typeof BUNDLE_VERSION === 'string' && BUNDLE_VERSION.length > 0);
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "rows": 15, // 11 цветов (включая wall_fill) + радиус свечения + фон
               // + «Оптимизировать планы» (docs/CANVAS.md §9)
  "groups": ["Fill: lights", "Fill: temperature", "Fill: zigbee signal", "Light-source glow", "Walls", "Stage background", "Sun", "Backup and transfer", "Plan maintenance", "About"],
  "aboutVersion": `Houseplan Card v${BUNDLE_VERSION}`, // та же константа, что в баннере
  "aboutLinks": [
    { "href": "https://github.com/Matysh/houseplan-card", "target": "_blank", "rel": "noopener" },
    { "href": "https://t.me/ha_houseplan", "target": "_blank", "rel": "noopener" },
  ],
  "saved": {"c": "#ff00ff", "a": 0.5},
  "lqiBefore": 7,
  "lqiAfter": 0,
});
await finish(browser, res);
