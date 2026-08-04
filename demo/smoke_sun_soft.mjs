// Owner 2026-08-04, on the first attempt: «с лучами солнца ты сделал фигню —
// не надо размывать их боковые грани». A shaft of sunlight has HARD sides; it
// fades only with distance, along the ray, from the glass inward. So:
//   * the reach is still 70 % of the v1.56 curve;
//   * the gradient still spans the FULL wedge and is dead from RAY_FADE_END;
//   * the sides are SHARP — no blur filter on the wedge, none defined at all;
//   * and because the sides are sharp, the wedge must end ON an iso-alpha line
//     of that gradient: nothing is ever drawn past its end, so the old bright
//     kerb (a far edge parallel to the wall, cut while still lit) cannot come
//     back at an oblique sun.
// The "light never crosses a wall" clip is asserted in demo/smoke_sun.mjs
// (wedgeClippedToRoom) — the polygons arrive from computeSunRays() already
// intersected with the room, which is why no clip-path is needed here.
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

  // ---- 3) SHARP sides: no blur on the wedge, and none defined anywhere ----
  const wedges = () => [...sr().querySelectorAll('.sunlayer polygon')];
  // walk the polygon and its ancestors up to and including .sunlayer — the
  // day/night `brightness` filter lives further up, on the zoomwrap, and is
  // none of this test's business
  const blurredChain = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const attr = n.getAttribute && n.getAttribute('filter');
      if (attr && attr !== 'none') return true;
      const cs = getComputedStyle(n).filter;
      if (cs && cs !== 'none' && cs !== '') return true;
      if (n.classList && n.classList.contains('sunlayer')) break;
    }
    return false;
  };
  out.wedgesDrawn = wedges().length > 0;
  out.everyWedgeHasSharpSides = wedges().length > 0 && wedges().every((p) => !blurredChain(p));
  out.noSoftFilterDefined = sr().querySelectorAll('filter[id^=hp-sunsoft-]').length === 0;
  out.noGaussianBlurAtAll = sr().querySelectorAll('feGaussianBlur').length === 0;

  // ---- 4) an OBLIQUE sun: the shaft still dies of its gradient -----------
  // The sides are hard again, so the only thing that may end the wedge is the
  // gradient. That holds ONLY if the far edge is square to the RAY: with the
  // old wall-parallel edge one far corner sat at offset ~0.7 (low sun) or
  // ~0.11 (high sun) — i.e. still lit — which is exactly the bright kerb.
  const tOf = (r, p) => {
    const mx = (r.a[0] + r.b[0]) / 2, my = (r.a[1] + r.b[1]) / 2;
    return ((p[0] - mx) * r.dir[0] + (p[1] - my) * r.dir[1]) / r.len;
  };
  const skew = (r) => {
    const mx = (r.a[0] + r.b[0]) / 2, my = (r.a[1] + r.b[1]) / 2;
    return Math.abs((r.a[0] - mx) * r.dir[0] + (r.a[1] - my) * r.dir[1]) / r.len;
  };
  out.obliqueChecked = [];
  out.sunIsReallyOblique = true;
  out.nothingDrawnPastTheGradient = true;
  for (const [az, el] of [[230, 8], [225, 55]]) {
    await setSun(az, el);
    const rays = c._sunRaysCache.rays;
    out.obliqueChecked.push(rays.length);
    if (!rays.length) { out.sunIsReallyOblique = false; continue; }
    if (!rays.some((r) => skew(r) > 1e-3)) out.sunIsReallyOblique = false;
    for (const r of rays) {
      for (const poly of r.polys) {
        for (const p of poly) if (tOf(r, p) > 1 + 1e-6) out.nothingDrawnPastTheGradient = false;
      }
    }
  }
  out.obliqueSunHasWedges = out.obliqueChecked.every((n) => n > 0);
  delete out.obliqueChecked;
  return out;
});
await finish(browser, checkAll(res));
