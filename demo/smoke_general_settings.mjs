import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) диалог общих настроек: 7 цветовых строк, 3 группы
  c._openSettingsDialog(); await c.updateComplete;
  out.rows = sr().querySelectorAll('.gsrow').length;
  out.groups = [...sr().querySelectorAll('.dialog .dispsection')].map((l) => l.textContent.trim());
  // 2) сменить цвет light_on и сохранить
  c._setFillColor('light_on', { c: '#ff00ff', a: 0.5 });
  await c._saveSettingsDialog(); await c.updateComplete;
  out.saved = c._serverCfg.settings.fill_colors?.light_on;
  // 3) заливка light использует кастомный цвет
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { ...(s.settings||{}), show_borders: true, fill_mode: 'light' } })) };
  c.requestUpdate(); await c.updateComplete;
  const styles = [...sr().querySelectorAll('.room.styled')].map((r) => r.getAttribute('style') || '');
  out.customFillUsed = styles.some((st) => st.includes('#ff00ff') && st.includes('0.500'));
  // 4) show_lqi=false у пространства скрывает LQI-бейджи
  out.lqiBefore = sr().querySelectorAll('.dev .lqi').length;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({ ...s,
    settings: { ...(s.settings||{}), show_lqi: false } })) };
  c.requestUpdate(); await c.updateComplete;
  out.lqiAfter = sr().querySelectorAll('.dev .lqi').length;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
