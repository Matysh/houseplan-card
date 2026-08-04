// Owner 2026-08-04: «лучи от солнца сделать короче на 30%, проверить, чтобы они
// всегда плавно рассеивались (сейчас есть ощущение, что они упираются во что-то
// невидимое)». The wedge must be 70 % of the old reach AND must never show a
// straight kerb: the gradient dies before the far edge, the shaft is feathered
// and only then clipped by the room (docs/SUN.md).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const cfg = c._serverCfg;
  const sp = cfg.spaces.find((s) => s.id === 'f1');
  sp.openings = [
    { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
    { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },
  ];
  cfg.settings = { ...(cfg.settings || {}), north_deg: 0, bg_mode: 'static', sun_rays: true };
  c._cfgEpoch++;
  const setSun = async (az, el) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth: az, elevation: el } } } };
    c.requestUpdate(); await c.updateComplete;
  };
  const grads = () => [...sr().querySelectorAll('linearGradient[id^=hp-sun-]')];
  const stopsOf = (g) => [...g.querySelectorAll('stop')].map((s) => [
    parseFloat(s.getAttribute('offset')), Number(s.getAttribute('stop-opacity'))]);

  // ---- 1) 30 % shorter: the wedge reach in window lengths ----------------
  await setSun(270, 5);              // low western sun into the west window
  const oldK = (e) => 0.8 + 1.7 * Math.pow(1 - e / 90, 1.6);
  const winLen = 0.08 * 1000;
  const low = c._sunRaysCache.rays[0].len;
  out.lowSunIs70Percent = Math.abs(low - oldK(5) * 0.7 * winLen) < 1e-6;
  await setSun(180, 60);
  const high = c._sunRaysCache.rays[0].len;
  out.highSunIs70Percent = Math.abs(high - oldK(60) * 0.7 * winLen) < 1e-6;
  out.lowStillReachesFurther = low > high;

  // ---- 2) the shaft always dissolves BEFORE its own far edge -------------
  await setSun(270, 5);
  const gs = grads();
  out.gradientsDrawn = gs.length > 0;
  out.gradientSpansWholeWedge = gs.every((g) => {
    const st = stopsOf(g);
    // the gradient axis is the FULL wedge length (x1,y1 → x2,y2 = len away)
    const dx = +g.getAttribute('x2') - +g.getAttribute('x1');
    const dy = +g.getAttribute('y2') - +g.getAttribute('y1');
    return Math.abs(Math.hypot(dx, dy) - c._sunRaysCache.rays[0].len) < 1e-6 && st.length > 2;
  });
  out.deadWellBeforeTheEnd = gs.every((g) => {
    const st = stopsOf(g);
    const firstZero = st.find(([, a]) => a === 0);
    return !!firstZero && firstZero[0] <= 85.001;   // %
  });
  out.lastStopIsZero = gs.every((g) => stopsOf(g).slice(-1)[0][1] === 0);
  out.brightAtTheGlass = gs.every((g) => stopsOf(g)[0][1] > 0.2);
  out.neverBrightensInward = gs.every((g) => {
    const st = stopsOf(g);
    return st.every(([, a], i) => i === 0 || a <= st[i - 1][1] + 1e-9);
  });

  // ---- 3) feathered edges, and still no light through a wall -------------
  const wraps = [...sr().querySelectorAll('.sunlayer > g')];
  out.everyWedgeFeathered = wraps.length > 0
    && wraps.every((g) => /hp-sunsoft-/.test(g.getAttribute('filter') || ''));
  out.everyWedgeClippedToItsRoom = wraps.every((g) => /hp-sunclip-/.test(g.getAttribute('clip-path') || ''));
  out.blurIsProportional = [...sr().querySelectorAll('filter[id^=hp-sunsoft-] feGaussianBlur')]
    .every((b) => { const s = Number(b.getAttribute('stdDeviation')); return s >= 3 && s <= 18; });
  // the clip really is the room outline, so a wall still stops the light
  out.clipIsTheRoomOutline = [...sr().querySelectorAll('clipPath[id^=hp-sunclip-] polygon')]
    .every((p) => (p.getAttribute('points') || '').split(' ').length >= 3);
  return out;
});
await finish(browser, checkAll(res));
