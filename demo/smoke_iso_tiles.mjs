// #649 п.1 (docs/ISOMETRIC.md, Stage 6): device markers are raised tiles in the
// 2.5D View — no ring, rounded body, solid edge below, 1.12 × Flat, the whole
// marker lifted, one floor-shadow layer under every marker (theme × floor
// table of the ТЗ), a frame that hugs tile and edge with the icon-package
// colours and priority, forced colours without edge and shadow. Flat keeps its
// circles; editors stay Flat.
import { launch, check, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const WHITE = 'd_lamp';
const TINTED = 'd_light1'; // state on → #F0A00C

// Two markers one above the other: the upper shadow falls where the lower tile is.
await page.evaluate(() => window.__hpTest.setLayout((layout) => {
  layout.d_lamp = { s: 'f1', x: 0.22, y: 0.175 };
  return layout;
}));

const read = (ids) => page.evaluate(([white, tinted]) => {
  const c = window.__card;
  const root = c.renderRoot;
  const px = (v) => Number.parseFloat(v) || 0;
  const marker = (id) => root.querySelector(`.devlayer .dev:not(.iso-tile-shadow)[data-id="${id}"]`);
  const twin = (id) => root.querySelector(`.iso-tile-shadows .iso-tile-shadow[data-shadow-of="${id}"]`);
  const shadow = (id) => {
    const s = twin(id);
    const m = s && getComputedStyle(s).boxShadow
      .match(/rgba?\(28, 32, 28(?:, ([\d.]+))?\) (-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px (-?[\d.]+)px/);
    return m ? { a: Number(m[1] ?? 1), dx: +m[2], dy: +m[3], blur: +m[4], spread: +m[5] } : null;
  };
  const tile = (id) => {
    const dev = marker(id);
    const core = dev?.querySelector('.device-core');
    if (!core) return null;
    const cs = getComputedStyle(core);
    const edge = cs.boxShadow.match(/^(rgba?\([^)]*\)) 0px ([\d.]+)px 0px/);
    const frame = dev.querySelector('.device-shell-frame');
    const rect = core.getBoundingClientRect();
    const twinCore = twin(id)?.getBoundingClientRect();
    return {
      w: rect.width, h: rect.height, top: rect.top,
      radius: px(cs.borderTopLeftRadius), bg: cs.backgroundColor,
      edgeColor: edge?.[1] ?? null, edgeDepth: edge ? +edge[2] : 0,
      ring: frame ? getComputedStyle(frame).borderTopColor : null,
      lift: twinCore ? twinCore.top - rect.top : null,
      floorLight: dev.classList.contains('iso-floor-light'),
      shadow: shadow(id),
      frameColor: getComputedStyle(core, '::after').borderTopColor,
      hit: (() => { const b = getComputedStyle(dev, '::before'); return [px(b.width), px(b.height)]; })(),
    };
  };
  const shadows = root.querySelector('.iso-tile-shadows');
  return {
    iso: root.querySelector('.stage')?.classList.contains('projection-iso') ?? false,
    white: tile(white), tinted: tile(tinted),
    layer: !!shadows,
    layerDisplay: shadows ? getComputedStyle(shadows).display : 'none',
    twinsInLayerOnly: [...root.querySelectorAll('.iso-tile-shadow')].every((s) => s.parentElement === shadows),
    twinsInert: [...root.querySelectorAll('.iso-tile-shadow')].every((s) => getComputedStyle(s).pointerEvents === 'none'
      && s.getAttribute('aria-hidden') === 'true' && !s.hasAttribute('tabindex')),
    twinsGeometryOnly: [...root.querySelectorAll('.iso-tile-shadows .dev.iso-tile-shadow')]
      .every((s) => !s.querySelector('ha-icon, .device-pulse, .activity-dot, .newdot, .habadge, .lqi')
        && (s.querySelector('.value-badge') || s.childElementCount === 0)),
    badgeGap: (() => {
      const dev = marker('d_temp');
      const core = dev?.querySelector('.device-core')?.getBoundingClientRect();
      const badge = dev?.querySelector('.value-badge')?.getBoundingClientRect();
      if (!core || !badge) return null;
      return badge.left >= core.right ? badge.left - core.right
        : badge.top >= core.bottom ? badge.top - core.bottom : core.left - badge.right;
    })(),
    badgeEdge: (() => {
      const b = marker('d_temp')?.querySelector('.value-badge');
      return b ? getComputedStyle(b).boxShadow.match(/0px ([\d.]+)px 0px/)?.[1] ?? null : null;
    })(),
    markerCount: root.querySelectorAll('.devlayer .dev:not(.iso-tile-shadow)').length,
    twinCount: root.querySelectorAll('.iso-tile-shadows .dev.iso-tile-shadow').length,
  };
}, ids);
const setTheme = (dark) => page.evaluate(async (isDark) => {
  const c = window.__card;
  c.hass = { ...c.hass, themes: { ...(c.hass.themes || {}), darkMode: isDark } };
  await window.__hpTest.settled();
  await new Promise((done) => setTimeout(done, 450)); // colour transitions settle
}, dark);
// Floor colour = the space's custom room fill over the paper (ТЗ «Светлый пол»).
const setFloor = (color) => page.evaluate((c) => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...(space.settings || {}), fill_mode: 'custom', custom_fill: { c, a: 1 } };
  return cfg;
}), color);
const near = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol;

await setTheme(false);
await setFloor('#737777');
const flat = await read([WHITE, TINTED]);
const flatCircle = !flat.iso && !!flat.white && flat.white.radius >= flat.white.w / 2 - 0.5
  && !/rgba\(0, 0, 0, 0\)/.test(flat.white.ring) && !flat.layer;

await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
await page.waitForTimeout(250);

// ---- AC2/AC3: tile geometry, light theme · dark floor ----------------------
const iso = await read([WHITE, TINTED]);
const D = iso.white?.w ?? NaN;
const res = { flatStaysCircleWithRing: flatCircle };
res.isoOn = iso.iso;
res.scale112 = near(D / flat.white.w, 1.12, 0.01);
res.noRing = /rgba\(0, 0, 0, 0\)/.test(iso.white.ring) && /rgba\(0, 0, 0, 0\)/.test(iso.tinted.ring);
res.radiusFormula = near(iso.white.radius, Math.min(0.275 * D, 0.3 * iso.white.h), 0.05);
res.edgeDepth = near(iso.white.edgeDepth, 0.1 * D, 0.05) && near(iso.tinted.edgeDepth, 0.1 * D, 0.05);
// brightness(.7) saturate(.85): white → #b3b3b3, #F0A00C → rgb(160, 113, 25).
res.edgeColourWhite = iso.white.edgeColor === 'rgb(179, 179, 179)';
res.edgeColourTinted = iso.tinted.edgeColor === 'rgb(160, 113, 25)';
res.lifted = near(iso.white.lift, 0.075 * D, 0.1);
res.badgeGap = near(iso.badgeGap, 0.075 * D, 0.3);
res.badgeOwnEdge = near(Number(iso.badgeEdge), 0.1 * D, 0.05);
res.hitTarget44 = iso.white.hit[0] >= 44 && iso.white.hit[1] >= 44;

// ---- AC4: one shadow layer, table per theme × floor -------------------------
res.oneShadowLayer = iso.layer && iso.twinsInLayerOnly && iso.twinCount === iso.markerCount;
res.shadowsInert = iso.twinsInert;
res.shadowTwinsAreGeometryOnly = iso.twinsGeometryOnly;
const TABLE = {
  'light-dark': { dy: 0.375, sigma: 0.275, white: 0.34, tinted: 0.5 },
  'light-light': { dy: 0.425, sigma: 0.1375, white: 0.3, tinted: 0.42 },
  'dark-dark': { dy: 0.375, sigma: 0.275, white: 0.4, tinted: 0.4 },
  'dark-light': { dy: 0.425, sigma: 0.1375, white: 0.4, tinted: 0.4 },
};
const shadowMatches = (s, row, a) => !!s && near(s.a, a, 0.005) && near(s.dx, 0.1 * D, 0.05)
  && near(s.dy, (row.dy + 0.1) * D, 0.05) && near(s.blur, 2 * row.sigma * D, 0.05)
  && near(s.spread, -0.0375 * D, 0.05);
const combos = {};
for (const [key, row] of Object.entries(TABLE)) {
  const [theme, floor] = key.split('-');
  await setTheme(theme === 'dark');
  await setFloor(floor === 'light' ? '#eee8de' : '#737777');
  const now = await read([WHITE, TINTED]);
  combos[key] = now;
  res[`shadow_${key}`] = now.white.floorLight === (floor === 'light')
    && shadowMatches(now.white.shadow, row, row.white) && shadowMatches(now.tinted.shadow, row, row.tinted);
}
// Light floor: lighter edge brightness(.82) saturate(.8) → #d1d1d1; dark theme → #4a4a4a.
res.edgeLightFloor = combos['light-light'].white.edgeColor === 'rgb(209, 209, 209)';
res.edgeDarkTheme = combos['dark-dark'].white.edgeColor === 'rgb(74, 74, 74)'
  && combos['dark-light'].white.edgeColor === 'rgb(74, 74, 74)';
res.tintedBodyThemeFree = combos['dark-dark'].tinted.bg === 'rgb(240, 160, 12)';

// No shadow ever lands on a neighbour's tile: the lower tile's inside is the
// same with and without the shadow layer (the upper marker casts onto it).
await setTheme(false);
await setFloor('#737777');
const lowerClip = await page.evaluate((id) => {
  const r = window.__card.renderRoot.querySelector(`.devlayer .dev:not(.iso-tile-shadow)[data-id="${id}"] .device-core`)
    .getBoundingClientRect();
  const inset = r.width * 0.3;
  return { x: r.left + inset, y: r.top + inset, width: r.width - 2 * inset, height: r.height - 2 * inset };
}, TINTED);
const withShadows = await page.screenshot({ clip: lowerClip });
await page.evaluate(() => { window.__card.renderRoot.querySelector('.iso-tile-shadows').style.display = 'none'; });
const withoutShadows = await page.screenshot({ clip: lowerClip });
await page.evaluate(() => { window.__card.renderRoot.querySelector('.iso-tile-shadows').style.display = ''; });
res.shadowNeverOnNeighbourTile = Buffer.compare(withShadows, withoutShadows) === 0;

// ---- AC5: frames — hover, focus, selected, alert; the body is not repainted --
const centre = await page.evaluate((id) => {
  const r = window.__card.renderRoot.querySelector(`.devlayer .dev:not(.iso-tile-shadow)[data-id="${id}"] .device-core`)
    .getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}, WHITE);
const before = (await read([WHITE, TINTED])).white;
await page.mouse.move(centre[0], centre[1]);
await page.waitForTimeout(80);
const hovered = (await read([WHITE, TINTED])).white;
res.hoverFrameBlue = hovered.frameColor === 'rgb(12, 130, 240)';
res.hoverBodyUnchanged = hovered.bg === before.bg;
res.frameIdleInvisible = /rgba\(0, 0, 0, 0\)/.test(before.frameColor);
await page.mouse.move(5, 5);
const frames = await page.evaluate(async (id) => {
  const dev = window.__card.renderRoot.querySelector(`.devlayer .dev:not(.iso-tile-shadow)[data-id="${id}"]`);
  const core = dev.querySelector('.device-core');
  const colour = () => getComputedStyle(core, '::after').borderTopColor;
  const frame = () => {
    const a = getComputedStyle(core, '::after');
    const r = core.getBoundingClientRect();
    return { w: Number.parseFloat(a.width), h: Number.parseFloat(a.height), coreW: r.width, coreH: r.height,
      radius: Number.parseFloat(a.borderTopLeftRadius), coreRadius: Number.parseFloat(getComputedStyle(core).borderTopLeftRadius) };
  };
  const out = {};
  dev.classList.add('sel');
  out.selected = colour();
  out.geometry = frame();
  dev.focus({ focusVisible: true });
  out.focusVisible = dev.matches(':focus-visible');
  out.focusOverSelected = colour();
  dev.classList.add('alarm');
  out.alarmOverFocus = colour();
  dev.classList.remove('alarm', 'sel');
  out.focusOnly = colour();
  dev.blur();
  // CODE-REVIEW-649-r1 L4: Alert also beats a plain Selected.
  dev.classList.add('sel', 'alarm');
  out.alarmOverSelected = colour();
  dev.classList.remove('sel', 'alarm');
  // L5 (Q1): a virtual marker has no dashed contour in 2.5D either.
  dev.classList.add('virtual');
  const shell = dev.querySelector('.device-shell-frame');
  out.virtualRing = shell ? getComputedStyle(shell).borderTopColor : null;
  dev.classList.remove('virtual');
  return out;
}, WHITE);
// L4: Alert beats a plain Hover.
await page.evaluate((id) => window.__card.renderRoot
  .querySelector(`.devlayer .dev:not(.iso-tile-shadow)[data-id="${id}"]`).classList.add('alarm'), WHITE);
await page.mouse.move(centre[0], centre[1]);
await page.waitForTimeout(80);
const alarmHover = await page.evaluate((id) => {
  const dev = window.__card.renderRoot.querySelector(`.devlayer .dev:not(.iso-tile-shadow)[data-id="${id}"]`);
  const hovered = dev.hasAttribute('data-hp-device-hover');
  const colour = getComputedStyle(dev.querySelector('.device-core'), '::after').borderTopColor;
  dev.classList.remove('alarm');
  return { hovered, colour };
}, WHITE);
await page.mouse.move(5, 5);
res.alarmBeatsHover = alarmHover.hovered && alarmHover.colour === 'rgb(240, 65, 12)';
res.alarmBeatsSelected = frames.alarmOverSelected === 'rgb(240, 65, 12)';
res.virtualNoDashedRing = /rgba\(0, 0, 0, 0\)/.test(frames.virtualRing || '');
res.selectedAmber = frames.selected === 'rgb(240, 160, 12)';
res.focusBeatsSelected = !frames.focusVisible || frames.focusOverSelected === 'rgb(12, 130, 240)';
res.alarmBeatsFocus = frames.alarmOverFocus === 'rgb(240, 65, 12)';
res.focusBlue = !frames.focusVisible || frames.focusOnly === 'rgb(12, 130, 240)';
// Frame: tile bbox + 0.075 D per side (outset 6 + half stroke 2.5 lab units), height + edge.
const g = frames.geometry;
res.frameHugsTileAndEdge = near(g.w - g.coreW, 2 * (6 + 2.5) / 80 * D, 0.1)
  && near(g.h - g.coreH, 2 * (6 + 2.5) / 80 * D + 0.1 * D, 0.1)
  && near(g.radius - g.coreRadius, (6 + 2.5) / 80 * D, 0.1);

// ---- AC6: forced colours — no edge, no shadow; size and frames stay ---------
await page.emulateMedia({ forcedColors: 'active' });
const forced = await read([WHITE, TINTED]);
res.forcedNoShadow = forced.layerDisplay === 'none';
res.forcedNoEdge = forced.white.edgeColor === null;
res.forcedKeepsSize = near(forced.white.w, D, 0.05);
await page.emulateMedia({ forcedColors: 'none' });

// ---- L6: without walls (show_borders off) tiles and shadows stay -----------
await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...(space.settings || {}), show_borders: false };
  return cfg;
}));
await page.waitForTimeout(250);
const noBorders = await read([WHITE, TINTED]);
res.noBordersKeepsTiles = noBorders.iso && near(noBorders.white.radius, Math.min(0.275 * D, 0.3 * noBorders.white.h), 0.05)
  && near(noBorders.white.edgeDepth, 0.1 * D, 0.05);
res.noBordersKeepsShadows = noBorders.layer && noBorders.twinCount === noBorders.markerCount
  && !!noBorders.white.shadow;
await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...(space.settings || {}), show_borders: true };
  return cfg;
}));

// ---- editors are Flat; switching off restores Flat --------------------------
await page.evaluate(() => window.__hpTest.setMode('plan'));
const editor = await read([WHITE, TINTED]);
res.editorFlat = !editor.iso && !editor.layer;
await page.evaluate(() => window.__hpTest.setMode('view'));
await page.evaluate(async () => { await window.__hpTest.setVolumetricView(false); });
const back = await read([WHITE, TINTED]);
res.offRestoresFlat = !back.iso && !back.layer && near(back.white.w, flat.white.w, 0.05)
  && back.white.radius >= back.white.w / 2 - 0.5;

checkAll(res);
await finish(browser, { ...res, D, gap: iso.badgeGap, badgeEdge: iso.badgeEdge });
