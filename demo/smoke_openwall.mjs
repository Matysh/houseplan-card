import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); c._tool = 'openwall'; await c.updateComplete;
  // Shared wall r1|r2 at x=550, y from 140..460. Two-click open full shared stretch.
  c._openWallClick([550, 140]);
  c._openWallClick([550, 460]);
  await c.updateComplete;
  const r1 = c._curSpaceCfg.rooms.find((r) => r.id === 'r1');
  const r2 = c._curSpaceCfg.rooms.find((r) => r.id === 'r2');
  out.linked = (r1.open_to || []).includes('r2') && (r2.open_to || []).includes('r1');
  out.hasSpans = Array.isArray(c._curSpaceCfg.open_spans) && c._curSpaceCfg.open_spans.length > 0;
  out.dashes = sr().querySelectorAll('.openwall').length > 0;
  out.hotClass = !!sr().querySelector('.openwalls.hot');
  // View: trimmed outlines + dash
  c._setMode('view'); await c.updateComplete;
  out.noedge = sr().querySelectorAll('.room.noedge').length >= 2;
  out.trimmedOutline = sr().querySelectorAll('.room-outline').length >= 2;
  const svgEl = sr().querySelector('svg');
  const order = [...svgEl.children].map((el) => el.classList?.[0] || el.tagName);
  const gi = order.indexOf('glowlayer');
  const oi = order.indexOf('openwalls');
  out.dashAboveGlow = gi === -1 || oi > gi;
  c._setMode('plan'); c._tool = 'draw'; await c.updateComplete;
  out.planDashes = sr().querySelectorAll('.openwall').length > 0;
  out.planNoedge = sr().querySelectorAll('.room.noedge').length >= 2;
  out.planBlueOutline = sr().querySelectorAll('.room-outline.outlined').length >= 2;
  const midY = 300;
  out.planSegCut = ![...sr().querySelectorAll('line.seg')].some((l) => {
    const x1 = +l.getAttribute('x1'), x2 = +l.getAttribute('x2');
    const y1 = +l.getAttribute('y1'), y2 = +l.getAttribute('y2');
    return Math.abs(x1 - 550) < 0.5 && Math.abs(x2 - 550) < 0.5
      && Math.min(y1, y2) < midY && Math.max(y1, y2) > midY;
  });
  c._tool = 'openwall'; await c.updateComplete;
  // click the virtual span to close
  c._openWallClick([550, 300]); await c.updateComplete;
  out.toggledOff = !(c._curSpaceCfg.rooms.find((r) => r.id === 'r1').open_to || []).includes('r2');
  out.dashesGone = sr().querySelectorAll('.openwall').length === 0;
  c._openWallClick([100, 100]);
  out.missToast = !!c._toast;
  // reopen for glow
  c._openWallClick([550, 140]);
  c._openWallClick([550, 460]);
  await c.updateComplete;
  c._setMode('view'); await c.updateComplete;
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })) };
  const litLight = c._devices.find((d) => d.space === c._space && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on'));
  const c1 = c._roomCenter(c._spaceModel().rooms.find((r) => r.id === 'r1'));
  c._layout = { ...c._layout, [litLight.id]: { s: c._space, x: c1[0] / 1000, y: c1[1] / 1000 } };
  c.requestUpdate(); await c.updateComplete;
  const clip = sr().querySelector('defs clipPath[id^="hp-glowclip"]');
  out.zoneClip = clip ? clip.querySelectorAll('path').length >= 2 : false;
  const rr2 = c._curSpaceCfg.rooms.find((r) => r.id === 'r2');
  const rr3 = c._curSpaceCfg.rooms.find((r) => r.id === 'r3');
  if (rr3) {
    rr2.open_to = [...(rr2.open_to || []), 'r3'];
    rr3.open_to = [...(rr3.open_to || []), 'r2'];
    // legacy open_to without spans still expands on read for cuts — force spans for r2-r3
    c._openWallClick = c._openWallClick.bind(c);
    c._setMode('plan'); c._tool = 'openwall';
    // shared r2|r3 at y=460, x 550..960
    c._openWallClick([700, 460]);
    c._openWallClick([900, 460]);
    await c.updateComplete;
    c._setMode('view'); await c.updateComplete;
    const clip2 = sr().querySelector('defs clipPath[id^="hp-glowclip"]');
    out.transitive = clip2 ? clip2.querySelectorAll('path').length >= 3 : false;
  } else out.transitive = 'no r3';
  // outer wall refuses open
  c._setMode('plan'); c._tool = 'openwall';
  c._toast = null;
  c._openWallClick([40, 300]);
  out.outerToast = !!(c._toast && String(c._toast).length);
  return out;
});
checkAll(res, { outerToast: true });
await finish(browser, res);
