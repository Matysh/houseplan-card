// THE RIM (owner 2026-08-04): «тонкая (1px) чёрная граница по бокам
// светящегося сектора, которая также плавно уходит в ноль вместе с самим
// градиентом». The owner rejected the «shade instead of light» model of
// legacy/docs/SUN-CONTRAST.md and asked for this one line instead — because a wedge
// of added luminance simply cannot read on white paper, while its BOUNDARY
// can (docs/SUN.md, «The rim»).
//
// Everything this smoke pins down:
//   * exactly TWO rim lines per wedge, on the two SIDE edges — the ones that
//     run from the ends of the glass along the ray. Never the glass edge,
//     never the far edge; the coordinates are checked against the wedge's own
//     vertices, so a rim drawn around the whole polygon fails here;
//   * the stroke is `url(#hp-sunrim-N)`, a gradient with BLACK stops on the
//     SAME axis and the SAME offsets as the fill's `hp-sun-N`, monotone,
//     dead from 85 % on — the rim cannot outlive the light it outlines;
//   * `vector-effect: non-scaling-stroke` at width 1 — one screen pixel at
//     any zoom;
//   * no rim below the 3° threshold (after the 2 s layer fade) and none in an
//     editor;
//   * and the point of the whole change: on WHITE paper the pixels along the
//     wedge's side are measurably darker than the paper on either hand.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 2);
await page.emulateMedia({ reducedMotion: 'reduce' }); // no 2 s layer fade in the way

const RAY_FADE_MS = 2000;

const res = await page.evaluate(async (fadeMs) => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const cfg = c._serverCfg;
  const sp = cfg.spaces.find((s) => s.id === 'f1');
  // r1 is [[0.04,0.14],[0.55,0.14],[0.55,0.58],[0.04,0.58]] — a west window
  // at y = 0.30 casts a wedge that stays well inside it, so the unclipped
  // side edges are the whole story; the second window is deliberately on a
  // wall the same sun cannot reach, to prove no rim appears without a wedge.
  sp.openings = [
    { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
    { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 },
  ];
  sp.plan_url = null;              // plain white paper under the wedge
  cfg.settings = { ...(cfg.settings || {}), north_deg: 0, bg_mode: 'static', sun_rays: true };
  c._cfgEpoch++;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; };
  const setSun = async (az, el) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth: az, elevation: el } } } };
    await upd();
  };
  const rimsOf = () => [...sr().querySelectorAll('.sunlayer line.sunrim')];
  const gradOf = (id) => sr().querySelector('linearGradient[id="' + id + '"]');
  const stopsOf = (g) => [...g.querySelectorAll('stop')].map((s) => ({
    off: parseFloat(s.getAttribute('offset')),
    color: s.getAttribute('stop-color'),
    a: Number(s.getAttribute('stop-opacity')),
  }));
  const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;

  await setSun(270, 60);            // a western sun, square into the west window
  const rays = c._sunRaysCache.rays;
  out.oneWedgeDrawn = rays.length === 1;
  out.wedgeIsUnclipped = rays.length === 1 && rays[0].polys.length === 1
    && rays[0].polys[0].length === 4;

  // ---- 1) exactly two rim lines, on the two SIDE edges -------------------
  const rims = rimsOf();
  out.rimDrawn = rims.length > 0;
  out.twoRimsPerWedge = rims.length === rays.length * 2;
  out.rimStrokeIsAGradient = rims.length > 0
    && rims.every((l) => /^url\(#hp-sunrim-\d+\)$/.test(l.getAttribute('stroke') || ''));
  out.rimIsOnePixelAtAnyZoom = rims.length > 0 && rims.every((l) =>
    l.getAttribute('vector-effect') === 'non-scaling-stroke'
    && Number(l.getAttribute('stroke-width')) === 1);

  // every rim line must BE a side edge: its two ends are vertices of the
  // wedge polygon, it runs along `dir`, and it starts at an end of the glass
  out.rimSidesMatchTheWedge = true;
  out.rimIsNeverTheGlassOrTheFarEdge = true;
  for (let i = 0; i < rays.length; i++) {
    const r = rays[i];
    const mine = rims.filter((l) => l.getAttribute('stroke') === `url(#hp-sunrim-${i})`);
    if (mine.length !== 2) { out.rimSidesMatchTheWedge = false; continue; }
    const verts = r.polys.flat();
    const isVertex = (p) => verts.some((v) => near(v[0], p[0], 1e-3) && near(v[1], p[1], 1e-3));
    const ends = mine.map((l) => [
      [+l.getAttribute('x1'), +l.getAttribute('y1')],
      [+l.getAttribute('x2'), +l.getAttribute('y2')],
    ]);
    // the four expected corners: the glass ends and where their rays stop
    const far = (s) => [s[0] + r.dir[0] * r.len, s[1] + r.dir[1] * r.len];
    const want = [[r.a, far(r.a)], [r.b, far(r.b)]];
    for (const [src, tip] of want) {
      const hit = ends.some(([p, q]) =>
        (near(p[0], src[0], 1e-3) && near(p[1], src[1], 1e-3)
          && near(q[0], tip[0], 1e-3) && near(q[1], tip[1], 1e-3))
        || (near(q[0], src[0], 1e-3) && near(q[1], src[1], 1e-3)
          && near(p[0], tip[0], 1e-3) && near(p[1], tip[1], 1e-3)));
      if (!hit) out.rimSidesMatchTheWedge = false;
    }
    for (const [p, q] of ends) {
      if (!isVertex(p) || !isVertex(q)) out.rimSidesMatchTheWedge = false;
      // parallel to the ray (the glass edge and the far edge are not)
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const L = Math.hypot(dx, dy) || 1;
      if (Math.abs((dx / L) * r.dir[1] - (dy / L) * r.dir[0]) > 1e-6)
        out.rimIsNeverTheGlassOrTheFarEdge = false;
      // and it must not be the glass: both ends on the a-b line would mean it
      const onGlass = (z) => Math.abs((z[0] - r.a[0]) * r.dir[0] + (z[1] - r.a[1]) * r.dir[1]) < 1e-6;
      if (onGlass(p) && onGlass(q)) out.rimIsNeverTheGlassOrTheFarEdge = false;
    }
  }

  // ---- 2) the rim gradient: same axis, same curve, black ------------------
  const fills = [...sr().querySelectorAll('linearGradient[id^=hp-sun-]')];
  out.rimGradientBlack = true;
  out.rimGradientSharesTheAxis = true;
  out.rimGradientSharesTheCurve = true;
  out.rimGradientMonotone = true;
  out.rimGradientDeadAt85 = true;
  out.rimGradientBrightAtTheGlass = true;
  for (let i = 0; i < rays.length; i++) {
    const rim = gradOf(`hp-sunrim-${i}`);
    const fill = fills[i];
    if (!rim || !fill) { out.rimGradientBlack = false; continue; }
    for (const k of ['x1', 'y1', 'x2', 'y2']) {
      if (!near(+rim.getAttribute(k), +fill.getAttribute(k), 1e-9)) out.rimGradientSharesTheAxis = false;
    }
    const rs = stopsOf(rim);
    const fs = stopsOf(fill);
    if (rs.length !== fs.length) out.rimGradientSharesTheCurve = false;
    const peak = rs[0].a;
    rs.forEach((s, j) => {
      const black = /^#0{3,8}$/i.test(s.color || '') || /rgb\(0,\s*0,\s*0\)/.test(s.color || '');
      if (!black) out.rimGradientBlack = false;
      if (!fs[j] || !near(s.off, fs[j].off, 1e-9)) out.rimGradientSharesTheCurve = false;
      // the same normalised curve as the fill, only scaled to its own peak
      if (fs[j] && !near(s.a / (peak || 1), fs[j].a / (fs[0].a || 1), 1e-3))
        out.rimGradientSharesTheCurve = false;
      if (j > 0 && s.a > rs[j - 1].a + 1e-9) out.rimGradientMonotone = false;
      if (s.off >= 85 - 1e-9 && s.a !== 0) out.rimGradientDeadAt85 = false;
      if (s.off < 85 - 1e-9 && !(s.a > 0)) out.rimGradientDeadAt85 = false;
    });
    if (!(peak >= 0.3 && peak <= 0.55)) out.rimGradientBrightAtTheGlass = false;
  }

  // ---- 3) screen coords for the pixel probe, off the real geometry --------
  // sample ACROSS the a-side edge at 22 % of the reach, where both the fill
  // and the rim are still strong
  const svgEl = sr().querySelector('.sunlayer')?.ownerSVGElement || sr().querySelector('.stage svg');
  const ctm = svgEl.getScreenCTM();
  const toScr = (x, y) => {
    const q = svgEl.createSVGPoint(); q.x = x; q.y = y;
    const p = q.matrixTransform(ctm); return [p.x, p.y];
  };
  if (rays.length) {
    const r = rays[0];
    const u = 0.22 * r.len;
    const on = toScr(r.a[0] + r.dir[0] * u, r.a[1] + r.dir[1] * u);
    // one render unit INTO the wedge (toward b) → the screen-space normal
    const inw = [r.b[0] - r.a[0], r.b[1] - r.a[1]];
    const iL = Math.hypot(inw[0], inw[1]) || 1;
    const q = toScr(r.a[0] + r.dir[0] * u + (inw[0] / iL) * 10, r.a[1] + r.dir[1] * u + (inw[1] / iL) * 10);
    const vx = q[0] - on[0], vy = q[1] - on[1];
    const vL = Math.hypot(vx, vy) || 1;
    out.probe = { on, perp: [vx / vL, vy / vL], dpr: window.devicePixelRatio };
  }

  // ---- 4) below the threshold and in an editor there is no rim -----------
  await setSun(270, 2);                                  // under RAY_ELEVATION_MIN
  await new Promise((rs) => setTimeout(rs, fadeMs + 300)); // let the layer leave
  await upd();
  out.noRimBelowThreshold = rimsOf().length === 0;
  out.noWedgeBelowThreshold = sr().querySelectorAll('.sunlayer polygon').length === 0;

  await setSun(270, 60);
  out.rimIsBackAboveThreshold = rimsOf().length === 2;
  c._mode = 'plan';
  await upd();
  out.noRimInTheEditor = rimsOf().length === 0;
  c._mode = 'view';
  await upd();
  out.rimIsBackInViewMode = rimsOf().length === 2;

  // ---- 5) a legacy weather setting cannot hide the rim -------------------
  cfg.settings = { ...cfg.settings, weather_entity: 'weather.home' };
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'weather.home': { entity_id: 'weather.home', state: 'pouring', attributes: {} } } };
  c._cfgEpoch++;
  await upd();
  out.rimIgnoresRain = rimsOf().length === 2;
  delete cfg.settings.weather_entity;
  c._cfgEpoch++;
  await upd();
  out.rimStaysAfterLegacyCleanup = rimsOf().length === 2;
  return out;
}, RAY_FADE_MS);

// ---- 6) the whole point: on WHITE paper the side of the wedge is DARK ----
const probe = res.probe;
delete res.probe;
if (probe) {
  const shot = (await page.screenshot()).toString('base64');
  const px = await page.evaluate(async ({ shot, probe }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + shot;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = probe.dpr || 1;
    const lum = (t) => {
      const x = Math.round((probe.on[0] + probe.perp[0] * t) * d);
      const y = Math.round((probe.on[1] + probe.perp[1] * t) * d);
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    // t > 0 goes INTO the wedge, t < 0 onto the untouched paper beside it
    const band = [];
    for (let t = -2.5; t <= 2.5; t += 0.25) band.push(lum(t));
    const darkest = Math.min(...band);
    const inside = Math.min(lum(7), lum(9), lum(11));   // lit floor, still bright
    const outside = Math.min(lum(-7), lum(-9), lum(-11)); // plain white paper
    return {
      paperIsLight: outside > 200,
      wedgeInteriorIsLight: inside > 200,
      rimIsDarkOnTheEdge: darkest < Math.min(inside, outside) - 25,
      rimProfile: [Math.round(darkest), Math.round(inside), Math.round(outside)],
    };
  }, { shot, probe });
  res.rimProfile = px.rimProfile;
  delete px.rimProfile;
  Object.assign(res, px);
} else {
  res.paperIsLight = false;
  res.wedgeInteriorIsLight = false;
  res.rimIsDarkOnTheEdge = false;
}
const profile = res.rimProfile;
delete res.rimProfile;
console.log('rim/inside/outside luminance:', JSON.stringify(profile));
await finish(browser, checkAll(res));
