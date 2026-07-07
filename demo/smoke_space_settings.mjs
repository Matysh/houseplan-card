import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) дефолт (план есть): границ и лейблов нет
  out.defaultStyled = sr().querySelectorAll('.room.styled').length;
  out.defaultLabels = sr().querySelectorAll('.roomlabel').length;
  // 2) включаем границы+имена+заливку по свету
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : {
    ...s, settings: { show_borders: true, show_names: true, room_color: '#ff8800', room_opacity: 0.8, fill_mode: 'light' },
  })};
  c.requestUpdate(); await c.updateComplete;
  out.styled = sr().querySelectorAll('.room.styled').length;
  out.labels = [...sr().querySelectorAll('.roomlabel')].map((l) => l.textContent.trim());
  const liv = [...sr().querySelectorAll('.room.styled')][0];
  out.livingStyle = liv.getAttribute('style');
  // living: ceiling on → жёлтая; kitchen: нет light-сущностей → без заливки; bedroom light off → серая
  const styles = [...sr().querySelectorAll('.room.styled')].map((r) => r.getAttribute('style'));
  out.hasYellow = styles.some((s) => s.includes('#ffd45c'));
  out.hasGrey = styles.some((s) => s.includes('#9aa0a6'));
  out.kitchenNoFill = styles.some((s) => s.includes('--room-fill:transparent'));
  // 3) lqi-заливка
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : {
    ...s, settings: { ...s.settings, fill_mode: 'lqi' },
  })};
  c.requestUpdate(); await c.updateComplete;
  out.lqiFills = [...sr().querySelectorAll('.room.styled')].filter((r) => (r.getAttribute('style') || '').includes('hsl(')).length;
  // 4) drag лейбла → layout rl_
  const lbl = sr().querySelector('.roomlabel');
  c._labelDown({ preventDefault(){}, stopPropagation(){}, clientX: 100, clientY: 100, target: { setPointerCapture(){} }, pointerId: 5 },
    c._spaceModel().rooms[0], 'f1');
  c._labelMove({ clientX: 160, clientY: 140 }, c._spaceModel().rooms[0], 'f1');
  c._labelUp(c._spaceModel().rooms[0]);
  out.labelSaved = !!c._layout['rl_r1'];
  // 5) диалог: create + draw
  c._openSpaceDialog('create'); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'Attic', source: 'draw', orientation: 'square' };
  await c.updateComplete;
  out.saveEnabled = !sr().querySelector('.dialog .btn.on[disabled]');
  await c._saveSpaceDialog(); await c.updateComplete;
  const attic = c._serverCfg.spaces.find((s) => s.title === 'Attic');
  out.atticAspect = attic?.aspect;
  out.atticSettings = attic?.settings;
  out.atticNoPlan = attic ? attic.plan_url === null : null;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
