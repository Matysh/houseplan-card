// #1006: real production surfaces + read-only SVG raster, compared with immutable designer art.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { moonPhasePath } from '../src/moon.ts';
import { launch, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
import { evaluateRetainedAction } from './helpers/retained-page-action.mjs';

requirePinnedBrowser('1006 moon direction and fixed surface landmarks');
const art = readFileSync(new URL('../assets/moon/houseplan-1.0.0/moon.svg', import.meta.url), 'utf8');
const output = 'artifacts/moon-phase-direction';
mkdirSync(output, { recursive: true });
const checks = {}, report = [];
const dates = [['waxing', '2026-10-21T17:54:54Z'], ['waning', '2026-10-30T07:00:00Z']];
const { browser, page } = await launch({ width: 1000, height: 760 });

// Executed in the browser against the SVG actually emitted by the product.
async function rasterSample(moon, reference) {
  if (!(moon instanceof Element)) {
    reference = moon.reference;
    moon = new DOMParser().parseFromString(moon.shape, 'image/svg+xml').documentElement;
  }
  async function pixels(svg) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 512, 512);
      return { rgba: ctx.getImageData(0, 0, 512, 512).data, png: canvas.toDataURL().split(',')[1] };
    } finally { URL.revokeObjectURL(url); }
  }
  const clone = moon.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '512'); clone.setAttribute('height', '512');
  const actual = await pixels(new XMLSerializer().serializeToString(clone));
  const expected = await pixels(reference);
  let left = 0, right = 0, lit = 0, mismatches = 0, edgeMismatch = 0, edges = 0, total = 0;
  const palette = new Set();
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4;
    const a = actual.rgba[i + 3], e = expected.rgba[i + 3];
    if (e > 250) {
      total++;
      const light = Math.max(0, (a - 20) / 235);
      if (x < 256) left += light; else right += light;
      if (a > 250) {
        lit++;
        palette.add(`${expected.rgba[i]},${expected.rgba[i + 1]},${expected.rgba[i + 2]}`);
        if ([0, 1, 2].some(c => Math.abs(actual.rgba[i + c] - expected.rgba[i + c]) > 1)) mismatches++;
      }
    } else if (e > 0 && e < 250) {
      edges++;
      if ([0, 1, 2, 3].some(c => Math.abs(actual.rgba[i + c] - expected.rgba[i + c]) > 1)) edgeMismatch++;
    }
  }
  // The pack's own scale(2.56) is part of its immutable drawing, not a phase transform.
  const transformNodes = [moon, ...moon.querySelectorAll('#hp-moon-art,:scope > use')];
  const transformed = transformNodes.some(el => {
    const style = getComputedStyle(el);
    return (style.transform !== 'none') || !!el.getAttribute('transform');
  });
  const box = moon.getBoundingClientRect();
  return { k: moon.dataset.moonK, left, right, share: (left + right) / total,
    lit, mismatches, palette: palette.size, edges, edgeMismatch, transformed,
    pointer: getComputedStyle(moon).pointerEvents, aria: moon.getAttribute('aria-hidden'),
    box: { width: box.width, height: box.height, x: box.x, y: box.y }, png: actual.png };
}

try {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date(dates[0][1]) });
  for (const bg of ['daynight', 'static']) {
    await page.evaluate(async bg => {
      const card = window.__card;
      card.hass = { ...card.hass, config: { ...card.hass.config, latitude: 55.75, longitude: 37.62 },
        themes: { ...card.hass.themes, darkMode: bg === 'daynight' },
        states: { ...card.hass.states, 'sun.sun': { entity_id: 'sun.sun', state: 'below_horizon',
          attributes: { azimuth: 0, elevation: -12, rising: false } } } };
      await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
        settings: { ...cfg.settings, bg_mode: bg, moon: true },
        spaces: cfg.spaces.map(s => ({ ...s, settings: { ...s.settings, bg_mode: bg } })) }));
    }, bg);
    for (const surface of ['view', 'panel', 'kiosk', 'static-space']) {
      await page.clock.setSystemTime(new Date(dates[0][1]));
      // #1012: historical GC at :82 crossed the pending dynamic import here.
      // Hold that action explicitly (#967); mounting itself is synchronous.
      if (surface === 'panel') await evaluateRetainedAction(page, async () => {
        await import('/assets/houseplan-panel.js');
      }, 'moon phase panel module');
      await page.evaluate(surface => {
        window.__phaseHost?.remove(); window.__card.style.display = surface === 'view' ? '' : 'none';
        let host, card;
        if (surface === 'view') card = window.__card;
        else if (surface === 'panel') {
          host = document.createElement('houseplan-panel');
          host.panel = { component_name: 'houseplan-panel' }; host.narrow = false;
          host.route = { path: '/houseplan' }; host.hass = window.__card.hass;
        } else {
          host = card = document.createElement(surface === 'kiosk' ? 'houseplan-card' : 'houseplan-space-card');
          card.setConfig(surface === 'kiosk' ? { type: 'custom:houseplan-card', kiosk: true, cycle: 0 }
            : { type: 'custom:houseplan-space-card', space: 'f1', title: '', show_button: false });
          card.hass = window.__card.hass;
        }
        if (host) {
          host.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:760px';
          document.body.append(host); window.__phaseHost = host;
        }
        window.__phaseCard = card;
      }, surface);
      await page.waitForFunction(() => {
        if (!window.__phaseCard) window.__phaseCard = window.__phaseHost?.shadowRoot?.querySelector('houseplan-card');
        return !!window.__phaseCard?.renderRoot?.querySelector('.hp-moon.on');
      });
      const samples = [];
      for (const [direction, utc] of dates) {
        await page.clock.setSystemTime(new Date(utc));
        await page.evaluate(async () => {
          const c = window.__phaseCard;
          c.hass = { ...window.__card.hass, states: { ...window.__card.hass.states } };
          await c.updateComplete;
        });
        // The normal 30 s ticker owns changes in astronomy; hass alone may reuse View's memo.
        await page.clock.runFor(30_000);
        const moon = page.locator(surface === 'view' ? 'houseplan-card' : surface === 'panel'
          ? 'houseplan-panel houseplan-card' : surface === 'kiosk' ? 'houseplan-card' : 'houseplan-space-card')
          .filter({ visible: true }).locator('.hp-moon.on');
        await moon.waitFor();
        const sample = await moon.evaluate(rasterSample, art);
        const name = `${surface}-${bg}-${direction}`;
        writeFileSync(`${output}/${name}.png`, Buffer.from(sample.png, 'base64')); delete sample.png;
        checks[`${name}-side`] = direction === 'waxing' ? sample.right > sample.left : sample.left > sample.right;
        checks[`${name}-fixed-art`] = sample.lit > 30_000 && sample.palette > 30 && sample.mismatches === 0
          && !sample.transformed;
        checks[`${name}-host`] = sample.pointer === 'none' && sample.aria === 'true'
          && sample.box.width > 0 && sample.box.width <= 200 && sample.box.width === sample.box.height;
        report.push({ name, ...sample }); samples.push(sample);
      }
      checks[`${surface}-${bg}-equal-share-distinct-mask`] = samples.every(s => s.k === '0.79')
        && Math.abs(samples[0].share - samples[1].share) < 0.01;
      checks[`${surface}-${bg}-stable-place`] = JSON.stringify(samples[0].box) === JSON.stringify(samples[1].box);
    }
  }
  // Ordinary geometry fixtures through the pure public function, using the original designer SVG.
  // These do not patch the product's DOM/mask or its bundle. Actual production rendering is above.
  const body = art.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // Independent pre-fix full-disc reference: keep its actual edge raster, not an idealized new design.
  const fullMask = 'M256 0A256 256 0 0 0 256 512L256 496A240.00 240 0 0 0 256 16L256 0Z';
  const fullDefs = `<mask id="old-full" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
    <path d="${fullMask}" fill="white"/></mask>`;
  const fullReference = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><g id="ref">${body}</g>${fullDefs}</defs><use href="#ref" opacity=".08"/>
    <use href="#ref" mask="url(#old-full)"/></svg>`;
  await page.clock.setSystemTime(new Date('2026-10-25T18:00:00Z'));
  await page.clock.runFor(30_000);
  const full = await page.locator('houseplan-space-card .hp-moon.on').evaluate(rasterSample, fullReference);
  checks.fullProductionArtAndEdge = full.k === '1.00' && full.edges > 100 && full.edgeMismatch === 0
    && full.mismatches === 0 && !full.transformed;
  delete full.png; report.push({ full });
  const hemispheres = [];
  await page.clock.setSystemTime(new Date('2026-10-14T09:00:00Z'));
  for (const config of [{ latitude: 55.75, longitude: 37.62 }, { latitude: -33.87, longitude: 151.21 }]) {
    await page.evaluate(async config => {
      const c = window.__phaseCard; c.hass = { ...c.hass, config: { ...c.hass.config, ...config } };
      await c.updateComplete;
    }, config);
    await page.clock.runFor(30_000);
    const moon = page.locator('houseplan-space-card .hp-moon');
    const sample = await moon.evaluate(rasterSample, art);
    const path = await moon.locator('mask path').getAttribute('d');
    const shown = await moon.getAttribute('data-moon-visible');
    delete sample.png; hemispheres.push({ ...sample, path, shown });
  }
  checks.hemispheresKeepNorthUpCrescent = hemispheres.every(s => s.k === '0.14' && s.right > s.left
    && s.lit > 5000 && s.palette > 30 && s.mismatches === 0 && !s.transformed)
    && hemispheres[0].path === hemispheres[1].path && hemispheres[1].shown === 'true';
  report.push({ hemispheres });
  // Area uses the mathematical R=240 disc, independent of the designer's translucent rim.
  const disc = '<circle cx="256" cy="256" r="240" fill="white"/>';
  const discReference = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>${fullDefs}<g id="disc">${disc}</g></defs>
    <use href="#disc" opacity=".08"/><use href="#disc" mask="url(#old-full)"/></svg>`;
  const shapes = [];
  for (const side of [false, true]) for (const k of [0, 0.03, 0.25, 0.5, 0.75, 0.97, 1]) {
    const shape = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" data-moon-k="${k}">
      <defs><g id="reference-art">${disc}</g>
      <filter id="soft"><feGaussianBlur stdDeviation="5"/></filter>
      <mask id="phase" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <path d="${moonPhasePath(k, side)}" fill="white" ${k < .995 ? 'filter="url(#soft)"' : ''}/></mask></defs>
      <use href="#reference-art" opacity=".08"/><use href="#reference-art" mask="url(#phase)"/></svg>`;
    const sample = await page.evaluate(rasterSample, { shape, reference: discReference });
    delete sample.png; shapes.push({ side, k, ...sample });
    checks[`geometry-${side}-${k}-area`] = Math.abs(sample.share - k) < 0.022;
    if (k > 0 && k < 1) checks[`geometry-${side}-${k}-side`] = side
      ? sample.right > sample.left : sample.left > sample.right;
    if (k === 1) checks[`geometry-${side}-full-edge`] = sample.edges > 100 && sample.edgeMismatch === 0;
  }
  checks.geometryMonotone = [false, true].every(side => shapes.filter(s => s.side === side)
    .every((s, i, rows) => i === 0 || s.share > rows[i - 1].share));
  report.push({ geometry: shapes });
} finally {
  writeFileSync(`${output}/report.json`, JSON.stringify({ checks, report }, null, 2));
  checkAll(checks); await finish(browser, checks);
}
