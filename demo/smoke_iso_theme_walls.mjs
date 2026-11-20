// #649 п.3 (docs/ISOMETRIC.md, Stage 6): the 2.5D View paints walls in the
// user's wall colour, the theme never repaints walls, openings, the floor edge
// or room labels. #1451's accepted volumetric furniture keeps its own paint
// recipe across themes; Flat furniture retains its native non-scaling stroke.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { launch, checkAll, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });
const TOP = '#667788', WALL = '#d9c8b4';
await page.evaluate(({top,wall}) => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...space.settings, show_borders: true, show_names: true,
    room_color: top, room_opacity: .75, wall_fill: { c: wall, a: .5 } };
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
  return cfg;
}), {top:TOP,wall:WALL});

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
    topOpacity: top ? getComputedStyle(top.closest('.iso-wall-fill')).opacity : null,
    sideOpacity: root.querySelector('.iso-wall-side-fill')
      ? getComputedStyle(root.querySelector('.iso-wall-side-fill')).opacity : null,
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

const rgb = (hex, k = 1, tint = 1) => `rgb(${[1, 3, 5].map((i) =>
  Math.round(255 + (parseInt(hex.slice(i, i + 2), 16) * k - 255) * tint)).join(', ')})`;
const res = {};
res.isoOn = light.iso && dark.iso;
res.topColourBlendsWithWhite = light.stops[0] === rgb(TOP, 1, .75) && light.stops[1] === rgb(TOP, .93, .75);
res.sideDerivedFromUserColour = light.stops[2] === rgb(WALL, 1.12) && light.stops[3] === rgb(WALL)
  && light.stops[4] === rgb(WALL, 0.88);
res.wallFacesDrawn = light.faces > 0;
res.opaqueCutWithSeparateSideOpacity = Number(light.topOpacity) === 1 && Number(light.sideOpacity) === .5;
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
await browser.close();

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const rasterScene = await startIsoPaintScene({
  width: 1920, height: 1080, dpr: 2,
  // Exercise the CSSOM of Chromium versions that omit custom properties from enumeration.
  browserArgs: ['--disable-blink-features=CSSEnumeratedCustomProperties'],
  configureFixture({ config }) {
    const settings = config.spaces[0].settings;
    Object.assign(settings, {
      room_color: '#481477', room_opacity: .4,
      wall_fill: { c: '#246844', a: 1 },
      opening_accent_3d: { c: '#a32a59', a: 1 },
    });
  },
});

// Count solid pixels in each material, away from antialiased edges. The wall
// stops and the opening fills come from the live paint, including its tint.
function materialCounts(data, palette) {
  return palette.map((colours, index) => {
    const tolerance = index < 2 ? 9 : 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] !== 255) continue;
      if (colours.some(([r, g, b]) =>
        Math.abs(r - data[i]) <= tolerance && Math.abs(g - data[i + 1]) <= tolerance &&
        Math.abs(b - data[i + 2]) <= tolerance)) count++;
    }
    return count;
  });
}

try {
  const page = rasterScene.page;
  await zoomIsoPaint(page, 1.2);
  const stage = page.locator('houseplan-card .stage');
  assert(await stage.evaluate(el => {
    const style = getComputedStyle(el.querySelector('.iso-scene-surface svg'));
    return style.getPropertyValue('--iso-wall-side-op') === '1' && ![...style].includes('--iso-wall-side-op');
  }), 'The browser must support name-based CSS reads without enumerating custom properties');
  const palette = await stage.evaluate(el => {
    const rgb = value => value.match(/\d+/g).slice(0, 3).map(Number);
    const values = (selector, prop) => {
      const nodes = [...el.querySelectorAll(selector)];
      if (!nodes.length) throw Error('Missing visible paint for ' + selector);
      return nodes.slice(0, 3).map(node => rgb(getComputedStyle(node)[prop]));
    };
    return [
      values('.iso-top-hi, .iso-top-lo', 'stopColor'),
      values('.iso-side-hi, .iso-side-mid, .iso-side-lo', 'stopColor'),
      values('.iso-door.iso-material-matte-leaf', 'fill'),
      values('.iso-window.iso-material-light-frame', 'fill'),
    ];
  });
  const exact = async () => materialCounts(PNG.sync.read(await stage.screenshot()).data, palette);
  const cutProbe = await stage.evaluate(el => {
    const cut = el.querySelector('[data-hp="iso-wall-cut"]');
    const { x, y, width, height } = cut.getBBox();
    const matrix = cut.getScreenCTM();
    const inverse = matrix.inverse();
    const offsets = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    const bounds = el.getBoundingClientRect();
    const points = [];
    for (let row = 1; row < 32; row++) {
      for (let col = 1; col < 32; col++) {
        const point = new DOMPoint(x + width * col / 32, y + height * row / 32);
        if (!cut.isPointInFill(point)) continue;
        const screen = point.matrixTransform(matrix);
        if (!offsets.every(([dx, dy]) => cut.isPointInFill(
          new DOMPoint(screen.x + dx, screen.y + dy).matrixTransform(inverse)))) continue;
        if (screen.x <= bounds.left || screen.x >= bounds.right ||
            screen.y <= bounds.top || screen.y >= bounds.bottom) continue;
        points.push([(screen.x - bounds.left) / bounds.width, (screen.y - bounds.top) / bounds.height]);
      }
    }
    return points;
  });
  const withoutDecor = PNG.sync.read(await stage.screenshot());
  // Insert contrasting synthetic decor immediately below the cut, with the
  // same footprint. Test interior pixels so antialiasing is irrelevant.
  await stage.evaluate(el => {
    const cut = el.querySelector('[data-hp="iso-wall-cut"]');
    const decor = document.createElementNS(cut.namespaceURI, 'path');
    decor.setAttribute('d', cut.getAttribute('d'));
    decor.setAttribute('fill-rule', 'evenodd');
    decor.setAttribute('fill', '#02ff18');
    decor.setAttribute('data-test-cut-decor', '');
    cut.closest('.iso-wall-fill').before(decor);
  });
  const withDecor = PNG.sync.read(await stage.screenshot());
  await stage.evaluate(el => el.querySelector('[data-test-cut-decor]').remove());
  const topSamples = cutProbe.map(([x, y]) =>
    (Math.floor(y * withoutDecor.height) * withoutDecor.width + Math.floor(x * withoutDecor.width)) * 4
  ).filter(offset => palette[0].every(stop => stop.every((channel, i) =>
    Math.abs(withoutDecor.data[offset + i] - channel) <= 8)));
  assert(topSamples.length >= 3, 'The contrast fixture must sample the opaque cut material');
  for (const offset of topSamples) {
    assert.deepEqual(withDecor.data.subarray(offset, offset + 4), withoutDecor.data.subarray(offset, offset + 4),
      'A wall cut must cover the floor and contrasting decor with the same colour');
  }
  const before = materialCounts(withoutDecor.data, palette);
  const during = await stage.evaluate(async stage => {
    const until = performance.now() + 4500;
    const { x, y, width, height } = stage.getBoundingClientRect();
    // A short burst keeps the wheel animation running until a real bitmap is
    // presented. Alternate direction to keep all four materials in view.
    for (let step = 0; performance.now() < until; step++) {
      stage.dispatchEvent(new WheelEvent('wheel', {
        clientX: x + width / 2, clientY: y + height / 2,
        deltaY: step % 2 ? 80 : -80, bubbles: true, cancelable: true,
      }));
      await new Promise(resolve => setTimeout(resolve, 70));
      const canvas = stage.querySelector('.hp-iso-raster[data-hp-iso-raster="active"]');
      if (!canvas || !stage.querySelector('.iso-scene-surface[data-hp-raster-display]')) continue;
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const cpu = copy.getContext('2d');
      cpu.drawImage(canvas, 0, 0);
      return copy.toDataURL();
    }
    throw Error('2.5D wheel did not display a raster frame');
  });
  await stage.locator('.hp-iso-raster').waitFor({ state: 'detached' });
  await settleIsoPaint(page);
  const after = await exact();
  const cached = materialCounts(PNG.sync.read(Buffer.from(during.split(',')[1], 'base64')).data, palette);
  for (const [index, material] of ['wall tops', 'wall sides', 'door leaves', 'window frames'].entries()) {
    assert(before[index] > 30 && after[index] > 30, 'The live SVG must paint ' + material);
    assert(cached[index] > 30, 'The active raster must preserve solid pixels for ' + material +
      ' (before/during/after: ' + [before[index], cached[index], after[index]].join('/') + ')');
  }
  // Both directions keep the wheel session through a short pause. Verify
  // that the exact SVG still arrives within the final settle deadline.
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const wheel = deltaY => stage.evaluate((el, deltaY) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    el.dispatchEvent(new WheelEvent('wheel', {
      clientX: x + width * .88, clientY: y + height * .66,
      deltaY, bubbles: true, cancelable: true,
    }));
  }, deltaY);
  const moving = () => page.evaluate(() => window.__isoPaint._cameraTransition.active);
  for (const [delta, direction] of [[80, 'Zoom-out'], [-80, 'Zoom-in']]) {
    await wheel(delta);
    await page.clock.runFor(200);
    assert(await moving(), direction + ' must keep the session through a delayed wheel step');
    await wheel(delta);
    await page.clock.runFor(280);
    assert(!(await moving()), direction + ' must settle after wheel input stops');
    assert.equal(await stage.locator('.hp-iso-raster').count(), 0);
    assert(await stage.evaluate(el => {
      const card = window.__isoPaint;
      const { x, y, w, h } = card._viewOr(card._baseVb());
      const box = el.querySelector('.iso-scene-surface > svg').getAttribute('viewBox').split(/\s+/).map(Number);
      return box.length === 4 && [x, y, w, h].every((value, i) => Math.abs(value - box[i]) < 1e-5);
    }), direction + ' must restore the exact final camera in the live SVG');
  }
  await page.clock.resume();

  await finish(rasterScene.browser, {
    ...res, stops: light.stops, stroke: [flat.furnitureStroke, light.furnitureStroke],
    rasterMaterialPixels: { before, cached, after },
  });
} finally {
  await rasterScene.browser.close();
}