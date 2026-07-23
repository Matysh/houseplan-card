import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); c._tool = 'openwall'; await c.updateComplete;
  // r1|r2 делят стену x=0.55 → клик по ней открывает границу
  const H = 1000 / (c._curSpaceCfg.aspect || 1);
  c._openWallClick([550, 0.25 * H]);
  await c.updateComplete;
  const r1 = c._curSpaceCfg.rooms.find((r) => r.id === 'r1');
  const r2 = c._curSpaceCfg.rooms.find((r) => r.id === 'r2');
  out.linked = (r1.open_to || []).includes('r2') && (r2.open_to || []).includes('r1');
  // пунктир отрисован
  out.dashes = sr().querySelectorAll('.openwall').length > 0;
  out.hotClass = !!sr().querySelector('.openwalls.hot');
  // в Просмотре: сплошной штрих комнаты снят, контур без выреза + пунктир ПОВЕРХ glow
  c._setMode('view'); await c.updateComplete;
  out.noedge = sr().querySelectorAll('.room.noedge').length >= 2;
  out.trimmedOutline = sr().querySelectorAll('.room-outline').length >= 2;
  const svgEl = sr().querySelector('svg');
  const order = [...svgEl.children].map((el) => el.classList?.[0] || el.tagName);
  const gi = order.indexOf('glowlayer');
  const oi = order.indexOf('openwalls');
  out.dashAboveGlow = gi === -1 || oi > gi;
  // в редакторе плана: пунктир виден, штрих комнат вырезан, контур синий
  c._setMode('plan'); c._tool = 'draw'; await c.updateComplete;
  out.planDashes = sr().querySelectorAll('.openwall').length > 0;
  out.planNoedge = sr().querySelectorAll('.room.noedge').length >= 2;
  out.planBlueOutline = sr().querySelectorAll('.room-outline.outlined').length >= 2;
  c._tool = 'openwall'; await c.updateComplete;
  // повторный клик закрывает
  c._openWallClick([550, 0.25 * H]); await c.updateComplete;
  out.toggledOff = !(c._curSpaceCfg.rooms.find((r) => r.id === 'r1').open_to || []).includes('r2');
  out.dashesGone = sr().querySelectorAll('.openwall').length === 0;
  // клик мимо стен — тост, без изменений
  c._openWallClick([100, 100]);
  out.missToast = !!c._toast;
  // снова открыть для glow-теста
  c._openWallClick([550, 0.25 * H]); await c.updateComplete;
  // glow: свет из r1 заливает и r2 (clip содержит оба полигона)
  c._setMode('view'); await c.updateComplete;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })) };
  const litLight = c._devices.find((d) => d.space === c._space && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on'));
  const c1 = c._roomCenter(c._spaceModel().rooms.find((r) => r.id === 'r1'));
  const aspect = c._curSpaceCfg.aspect || 1;
  c._layout = { ...c._layout, [litLight.id]: { s: c._space, x: c1[0] / 1000, y: c1[1] / (1000 / aspect) } };
  c.requestUpdate(); await c.updateComplete;
  const clip = sr().querySelector('defs clipPath[id^="hp-glowclip"]');
  out.zoneClip = clip ? clip.querySelectorAll('path').length >= 2 : false;
  // транзитивность: r2↔r3 тоже открыть → clip получит 3 полигона
  const rr2 = c._curSpaceCfg.rooms.find((r) => r.id === 'r2');
  const rr3 = c._curSpaceCfg.rooms.find((r) => r.id === 'r3');
  if (rr3) {
    rr2.open_to = [...(rr2.open_to || []), 'r3'];
    rr3.open_to = [...(rr3.open_to || []), 'r2'];
    c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
    const clip2 = sr().querySelector('defs clipPath[id^="hp-glowclip"]');
    out.transitive = clip2 ? clip2.querySelectorAll('path').length >= 3 : false;
  } else out.transitive = 'no r3';
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
