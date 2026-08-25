import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); c._tool = 'boundary'; await c.updateComplete;
  // Shared wall r1|r2 at x=550, y from 140..460. Two-click open full shared stretch.
  c._boundaryClick([550, 140]);
  c._boundaryClick([550, 460]);
  await c.updateComplete;
  const r1 = c._curSpaceCfg.rooms.find((r) => r.id === 'r1');
  const r2 = c._curSpaceCfg.rooms.find((r) => r.id === 'r2');
  out.linked = (r1.open_to || []).includes('r2') && (r2.open_to || []).includes('r1');
  out.hasSpans = Array.isArray(c._curSpaceCfg.open_spans) && c._curSpaceCfg.open_spans.length > 0;
  out.dashes = sr().querySelectorAll('.openwall').length > 0;
  const boundaryButtons = [...sr().querySelectorAll('.editbar button')]
    .filter((b) => /Boundary|Граница/.test(b.textContent || ''));
  out.oneBoundaryTool = boundaryButtons.length === 1;
  out.boundaryToolUsesReviewedIcon = boundaryButtons[0]?.querySelector('ha-icon')
    ?.getAttribute('icon') === 'mdi:border-style';
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
  c._tool = 'boundary';
  c._boundaryClick([550, 300]); await c.updateComplete;
  out.restoredBySameTool = !(c._curSpaceCfg.open_spans || []).length;
  out.toggledOff = !(c._curSpaceCfg.rooms.find((r) => r.id === 'r1').open_to || []).includes('r2');
  out.dashesGone = sr().querySelectorAll('.openwall').length === 0;
  c._boundaryClick([100, 100]);
  out.missToast = !!c._toast;
  // reopen for glow
  c._boundaryClick([550, 140]);
  c._boundaryClick([550, 460]);
  await c.updateComplete;
  c._setMode('view'); await c.updateComplete;
  // 9 m of reach: the question here is whether light CROSSES the virtual
  // boundary, so the lamp must have enough radius to arrive at the far room.
  c._serverCfg = {
    ...c._serverCfg,
    settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 900 },
    spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
      ...s, settings: { ...(s.settings || {}), fill_mode: 'glow' } })),
  };
  const litLight = c._devices.find((d) => d.space === c._space && d.entities.some((e) => e.startsWith('light.') && c.hass.states[e]?.state === 'on'));
  const c1 = c._roomCenter(c._spaceModel().rooms.find((r) => r.id === 'r1'));
  c._layout = { ...c._layout, [litLight.id]: { s: c._space, x: c1[0] / 1000, y: c1[1] / 1000 } };
  c.requestUpdate(); await c.updateComplete;
  // A virtual boundary is simply not a wall: light crosses it, so the lit
  // region of a lamp in r1 must reach past r1's own outline into r2. Counting
  // clip children no longer says anything — there is one region, not one path
  // per room.
  // Every vertex of a visibility region sits ON a wall, so "is this floor
  // lit?" has to be asked as a point-in-region test, not by looking at
  // coordinates.
  const litRings = () => [...sr().querySelectorAll('defs clipPath[id^="hp-glowclip"] path.glow-lit')]
    .flatMap((p) => p.getAttribute('d').split('M').filter(Boolean).map((sub) => {
      const numbers = (sub.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const ring = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) ring.push([numbers[i], numbers[i + 1]]);
      return ring;
    }));
  const isLit = (point) => litRings().some((ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
      if ((yi > point[1]) !== (yj > point[1])
        && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-12) + xi) inside = !inside;
    }
    return inside;
  });
  out.zoneClip = isLit(c._roomCenter(c._spaceModel().rooms.find((r) => r.id === 'r2')));
  const rr2 = c._curSpaceCfg.rooms.find((r) => r.id === 'r2');
  const rr3 = c._curSpaceCfg.rooms.find((r) => r.id === 'r3');
  // Just inside r3, in line with the gap that is about to be opened.
  const probeR3 = [802, 480];
  const beforeReachesR3 = isLit(probeR3);
  if (rr3) {
    // Create the second span through the same production boundary tool. Direct
    // legacy open_to injection would make the first click close that already
    // open wall instead of anchoring a new partial span.
    c._setMode('plan'); c._tool = 'boundary';
    // shared r2|r3 at y=460, x 550..960
    c._boundaryClick([700, 460]);
    c._boundaryClick([900, 460]);
    await c.updateComplete;
    c._setMode('view'); await c.updateComplete;
    // Two hops: through the r1|r2 boundary, then through the r2|r3 one. Only
    // the part of r3 that the lamp can actually see through both gaps lights
    // up — but that part must, and none of it did before.
    out.transitive = !beforeReachesR3 && isLit(probeR3);
  } else out.transitive = 'no r3';
  // outer wall refuses open
  c._setMode('plan'); c._tool = 'boundary';
  c._toast = null;
  c._boundaryClick([40, 300]);
  out.outerToast = !!(c._toast && String(c._toast).length);
  return out;
});
checkAll(res, { outerToast: true });
await finish(browser, res);
