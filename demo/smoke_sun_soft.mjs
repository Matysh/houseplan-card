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
// DEV-EB173-01 turned the last of those into a contract of its own: the fade
// runs along the wall's INWARD NORMAL, not along the ray. For parallel rays
// the distance travelled from the glass is an affine function of the point, so
// its iso-alpha lines are parallel to the WALL — which is where an honest
// parallelogram puts its far edge. All three invariants then hold at once:
// peak alpha across the whole pane, the same fade distance along every ray,
// and a far edge exactly on the gradient's end. The auditor's own grazing
// repro is re-run below with his numbers.
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
  // everything below is measured off the DOM gradient, exactly like the audit
  // probe: axis, the offset a point lands on, and the alpha there
  const axisOf = (g) => {
    const x1 = +g.getAttribute('x1'), y1 = +g.getAttribute('y1');
    const x2 = +g.getAttribute('x2'), y2 = +g.getAttribute('y2');
    const len = Math.hypot(x2 - x1, y2 - y1);
    return { x1, y1, dx: x2 - x1, dy: y2 - y1, len, ux: (x2 - x1) / len, uy: (y2 - y1) / len };
  };
  const offsetOf = (g, p) => {
    const a = axisOf(g);
    return ((p[0] - a.x1) * a.dx + (p[1] - a.y1) * a.dy) / (a.len * a.len);
  };
  // a bundle without the normal-axis fade must FAIL these by name, not blow up
  const nrm = (r) => r.normal || [NaN, NaN];
  const dep = (r) => (r.depth === undefined ? NaN : r.depth);
  const alphaAt = (g, off) => {
    const st = stopsOf(g).map(([o, a]) => [o / 100, a]);
    if (off <= st[0][0]) return st[0][1];
    for (let i = 1; i < st.length; i++) {
      if (off <= st[i][0]) {
        const t = (off - st[i - 1][0]) / (st[i][0] - st[i - 1][0] || 1);
        return st[i - 1][1] + t * (st[i][1] - st[i - 1][1]);
      }
    }
    return st[st.length - 1][1];
  };

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
  // the axis is the wall's inward normal, `len · cos(incidence)` long — the
  // perpendicular depth a ray reaches after running the FULL wedge length
  out.gradientRunsAlongTheWallNormal = gs.every((g, i) => {
    const r = c._sunRaysCache.rays[i];
    const a = axisOf(g);
    return Math.abs(a.ux - nrm(r)[0]) < 1e-6 && Math.abs(a.uy - nrm(r)[1]) < 1e-6;
  });
  out.gradientSpansWholeWedge = gs.every((g, i) => {
    const r = c._sunRaysCache.rays[i];
    const cos = r.dir[0] * nrm(r)[0] + r.dir[1] * nrm(r)[1];
    return Math.abs(axisOf(g).len - r.len * cos) < 1e-6
      && Math.abs(dep(r) - r.len * cos) < 1e-9
      && stopsOf(g).length > 2;
  });
  // the ONLY thing that matters about that axis: a point `source + dir·u`
  // lands on offset `u / len`, whichever ray it rode in on
  out.offsetIsDistanceAlongTheRay = gs.every((g, i) => {
    const r = c._sunRaysCache.rays[i];
    return [0, 0.3, 0.85, 1].every((u) => [r.a, r.b].every((src) => {
      const p = [src[0] + r.dir[0] * r.len * u, src[1] + r.dir[1] * r.len * u];
      return Math.abs(offsetOf(g, p) - u) < 1e-6;
    }));
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
  // offset ALONG THE GRADIENT, i.e. depth under the wall over `len · cos`
  const tOf = (r, p) => {
    const mx = (r.a[0] + r.b[0]) / 2, my = (r.a[1] + r.b[1]) / 2;
    return ((p[0] - mx) * nrm(r)[0] + (p[1] - my) * nrm(r)[1]) / dep(r);
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

  // ---- 5) DEV-EB173-01: the auditor's own grazing repro ------------------
  // West window 80 render units long, elevation 90 (nominal reach 0.56 · 80 =
  // 44.8, i.e. 70 % of the old 64), azimuth 190 — the light enters the glass
  // and travels 10° off the wall's own direction. The probe on the broken
  // build read sides 5.408 / 84.192 (ratio 15.57) and source offsets ±0.879
  // with opacity 0 at one end of the pane.
  sp.openings = [{ id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 }];
  c._cfgEpoch++;
  await setSun(190, 90);
  const gr = c._sunRaysCache.rays;
  out.grazingRayDrawn = gr.length === 1;
  if (gr.length === 1) {
    const r = gr[0];
    const g = grads()[0];
    out.grazingIsReallyGrazing = Math.abs(r.dir[0] * nrm(r)[0] + r.dir[1] * nrm(r)[1] - 0.17365) < 1e-4;
    out.grazingLengthIs70Percent = Math.abs(r.len - 0.7 * (0.8 * 80)) < 1e-6
      && Math.abs(r.len - 44.8) < 1e-6;
    // both sides of the shaft, measured off the DRAWN polygon: the depth of a
    // vertex divided by cos is how far its ray ran
    const cos = r.dir[0] * nrm(r)[0] + r.dir[1] * nrm(r)[1];
    const ran = (p) => ((p[0] - r.a[0]) * nrm(r)[0] + (p[1] - r.a[1]) * nrm(r)[1]) / cos;
    const far = r.polys[0].map(ran).filter((u) => u > 1e-6);
    out.grazingHasTwoFarCorners = far.length === 2;
    out.grazingSidesEqualWithin1Percent = far.length === 2
      && Math.abs(far[0] - far[1]) <= 0.01 * r.len;
    out.grazingBothSidesAreTheNominalLength = far.every((u) => Math.abs(u - r.len) <= 0.01 * r.len);
    // the whole pane of glass at peak alpha (was 0 at one end)
    const peak = stopsOf(g)[0][1];
    out.grazingGlassAtOffsetZero = [r.a, r.b].every((p) => Math.abs(offsetOf(g, p)) < 1e-6);
    out.grazingGlassAtPeakAlpha = [r.a, r.b].every((p) => Math.abs(alphaAt(g, offsetOf(g, p)) - peak) < 1e-9);
    out.grazingPeakIsTheRealPeak = peak > 0.2;
    // and nothing is drawn past the gradient
    out.grazingInsideTheGradient = r.polys.every((poly) =>
      poly.every((p) => offsetOf(g, p) >= -1e-6 && offsetOf(g, p) <= 1 + 1e-6));
  }
  // a sun 2° off the wall's plane (cos 0.035 < RAY_MIN_COS) casts nothing
  await setSun(182, 90);
  out.sunAlongTheWallCastsNothing = c._sunRaysCache.rays.length === 0;
  await setSun(186, 90);
  out.sunJustClearOfTheWallStillCasts = c._sunRaysCache.rays.length === 1;
  return out;
});
await finish(browser, checkAll(res));
