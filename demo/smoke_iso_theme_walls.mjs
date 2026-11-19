// #649 п.3 (docs/ISOMETRIC.md, Stage 6): the 2.5D View paints walls in the
// user's wall colour, the theme never repaints walls, openings, the floor edge
// or room labels. #1451's accepted volumetric furniture keeps its own paint
// recipe across themes; Flat furniture retains its native non-scaling stroke.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const WALL = '#d9c8b4';
await page.evaluate((wall) => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...(space.settings || {}), show_borders: true, show_names: true };
  // A wall body of the plan model (room outlines alone raise no 2.5D wall here).
  space.partitions = [{ id: 'tw-wall', a: [0.15, 0.12], b: [0.85, 0.12], cm: 15 }];
  space.openings = [
    { id: 'tw-door', type: 'door', x: 0.325, y: 0.12, angle: 0, length: 0.08,
      host: { kind: 'partition', id: 'tw-wall', t: 0.25 } },
    { id: 'tw-window', type: 'window', x: 0.5, y: 0.12, angle: 0, length: 0.08,
      host: { kind: 'partition', id: 'tw-wall', t: 0.5 } },
  ];
  space.decor = [
    { id: 'tw-sofa', kind: 'furniture', symbol: 'sofa', x: 0.62, y: 0.55,
      w: 0.2, h: 0.12, color: '#667788', opacity: 0.7, width_cm: 2 },
  ];
  // Half-transparent on purpose: Flat keeps the opacity, the 2.5D prism is opaque.
  cfg.settings = { ...(cfg.settings || {}), fill_colors: { ...(cfg.settings?.fill_colors || {}), wall_fill: { c: wall, a: 0.5 } } };
  return cfg;
}), WALL);

const snapshot = () => page.evaluate(() => {
  const root = window.__card.renderRoot;
  const style = (el) => {
    const cs = getComputedStyle(el);
    return [cs.fill, cs.stroke, cs.opacity, cs.fillOpacity, cs.stopColor, cs.color].join('|');
  };
  const sig = [...root.querySelectorAll(
    '.iso-walls *, .iso-openings *, .iso-underlay *, [class^="iso-side"], [class^="iso-top"]',
  )].filter((el) => !el.classList.contains('iso-ambient-shadow')).map((el) => `${el.tagName}.${el.getAttribute('class') || ''}:${style(el)}`);
  const stop = (cls) => {
    const el = root.querySelector(`stop.${cls}`);
    return el ? getComputedStyle(el).stopColor : null;
  };
  const top = root.querySelector('.iso-wall-top');
  const furn = root.querySelector('.dfurn[data-id="tw-sofa"]');
  const volume = root.querySelector('[data-hp-furniture-volume][data-id="tw-sofa"]');
  const volumeStrokes = volume ? [...volume.querySelectorAll('path')]
    .filter(path => !path.closest('defs') && getComputedStyle(path).stroke !== 'none')
    .map(path => [path.getAttribute('d'),Number(path.getAttribute('stroke-width')),getComputedStyle(path).stroke]) : [];
  const label = root.querySelector('.roomlabel');
  return {
    iso: root.querySelector('.stage')?.classList.contains('projection-iso') ?? false,
    sig,
    stops: ['iso-top-hi', 'iso-top-lo', 'iso-side-hi', 'iso-side-mid', 'iso-side-lo'].map(stop),
    faces: root.querySelectorAll('.iso-wall-top, .iso-wall-side').length,
    topOpacity: top ? [getComputedStyle(top).opacity, getComputedStyle(top).fillOpacity] : null,
    label: label ? [getComputedStyle(label).color, getComputedStyle(label).textShadow] : null,
    furnitureStroke: furn ? Number(furn.getAttribute('stroke-width')) : NaN,
    furnitureVector: furn?.getAttribute('vector-effect') ?? null,
    volumeStrokes,
    stageSize: (() => { const s = root.querySelector('.stage'); return [s.clientWidth, s.clientHeight]; })(),
  };
});
const setTheme = (dark) => page.evaluate(async (isDark) => {
  const c = window.__card;
  c.hass = { ...c.hass, themes: { ...(c.hass.themes || {}), darkMode: isDark } };
  await window.__hpTest.settled();
  await new Promise((done) => setTimeout(done, 450));
}, dark);

await setTheme(false);
const flat = await snapshot();
await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
await page.waitForTimeout(250);
const light = await snapshot();
await setTheme(true);
const dark = await snapshot();
// No theme from Home Assistant: the browser's dark scheme must not repaint either.
await page.evaluate(async () => {
  const c = window.__card;
  const { darkMode, ...themes } = c.hass.themes || {};
  c.hass = { ...c.hass, themes };
  await window.__hpTest.settled();
});
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(450);
const scheme = await snapshot();
await page.emulateMedia({ colorScheme: 'light' });

const rgb = (hex, k = 1) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).join(', ')})`;
const res = {};
res.isoOn = light.iso && dark.iso;
res.topIsUserColour = light.stops[0] === rgb(WALL) && light.stops[1] === rgb(WALL, 0.93);
res.sideDerivedFromUserColour = light.stops[2] === rgb(WALL, 0.77) && light.stops[3] === rgb(WALL, 0.68)
  && light.stops[4] === rgb(WALL, 0.6);
res.wallFacesDrawn = light.faces > 0;
res.prismOpaque = !!light.topOpacity && light.topOpacity.every((v) => Number(v) === 1);
res.themeKeepsWalls = light.sig.length > 10 && JSON.stringify(light.sig) === JSON.stringify(dark.sig);
res.colourSchemeKeepsWalls = JSON.stringify(light.sig) === JSON.stringify(scheme.sig);
res.themeKeepsStops = JSON.stringify(light.stops) === JSON.stringify(dark.stops);
// Labels: the Flat label colour of the theme, not a 2.5D override.
res.labelsLikeFlat = !!light.label && light.label[0] === flat.label?.[0];
// Flat glyphs are not the accepted #1451 volume model. Check the actual painted
// volume paths, excluding clip definitions, without reinstating the old oracle.
res.furnitureUsesAcceptedVolume = Number.isFinite(flat.furnitureStroke)
  && light.volumeStrokes.length > 0 && light.volumeStrokes.every(([,width]) => Number.isFinite(width) && width > 0)
  && JSON.stringify(light.stageSize) === JSON.stringify(flat.stageSize);
res.furnitureThemeStable = JSON.stringify(light.volumeStrokes) === JSON.stringify(dark.volumeStrokes)
  && JSON.stringify(light.volumeStrokes) === JSON.stringify(scheme.volumeStrokes);
res.flatFurnitureNonScaling = flat.furnitureVector === 'non-scaling-stroke';

// Flat is untouched: back to Flat, the same wall opacity var and label.
await setTheme(false);
await page.evaluate(async () => { await window.__hpTest.setVolumetricView(false); });
const back = await snapshot();
res.flatBack = !back.iso && back.furnitureStroke === flat.furnitureStroke
  && JSON.stringify(back.label) === JSON.stringify(flat.label);
checkAll(res);
await finish(browser, { ...res, stops: light.stops, stroke: [flat.furnitureStroke, light.furnitureStroke] });
