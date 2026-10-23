// #1036: the actual dialog/download, then a standalone file with no HA runtime.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { launchColdView, check, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { fixtureWallKey } from './fixtures/wall-key.mjs';

requirePinnedBrowser('SVG current-view visual export');
const { page, browser } = await launchColdView({ width: 1000, height: 800 }, 1, [], { reducedMotion: 'reduce' });
const downloads = []; page.on('download', item => downloads.push(item));
const output = process.env.HP_SVG_EVIDENCE_DIR;
if (output) mkdirSync(output, { recursive: true });
const poly = [[0.12, 0.12], [0.85, 0.12], [0.85, 0.82], [0.12, 0.82]];
const segments = poly.map((a, i) => ({ id: `svg-wall-${i}`, a, b: poly[(i + 1) % poly.length], cm: 18 }));
await page.evaluate(async ({ poly, segments, walls }) => {
  await window.__hpTest.setServerConfig(cfg => {
    const s = cfg.spaces[0];
    s.rooms = [{ id: 'svg-room', name: 'Гостиная <script> & café', area: 'living_room', poly,
      wall_ids: segments.map(w => w.id) }];
    s.wall_segments = segments; s.walls = walls; s.openings = [];
    s.settings = { ...s.settings, show_names: true, show_borders: true, fill_mode: 'custom', custom_fill: { c: '#87bfd0', a: 0.35 } };
    return cfg;
  });
}, { poly, segments, walls: segments.map(w => ({ key: fixtureWallKey(w.a, w.b), a: w.a, b: w.b, cm: w.cm })) });
// Real production overlays, driven by public HA/WS inputs rather than private render state.
await page.evaluate(async () => {
  window.__addRegistryEntity('vacuum.svg_robot', null, 'cleaning');
  window.__addRegistryEntity('camera.svg_map', null, 'idle');
  await window.__hpTest.setServerConfig(cfg => {
    const s = cfg.spaces[0];
    s.led_strips = [{ id: 'svg-led', marker: 'd_light1', points: [[.2, .2], [.75, .2], [.75, .7]] }];
    cfg.markers.push({ id: 'e_svg_robot', binding: 'entity:vacuum.svg_robot', space: s.id,
      vacuum: { source: 'camera.svg_map', trail_mode: 'always', map_routes: [{ id: 'svg-map', source: 'camera.svg_map',
        map_id: 'm1', space: s.id, calibration: [1, 0, 0, 0, 1, 0] }] } });
    cfg.markers.push({ id: 'e_svg_radar', binding: 'virtual', space: s.id, radar: {
      version: 1, enabled: true, profile: 'cartesian_v1', room_id: 'svg-room',
      sources: { slots: [{ id: 'target_1', x_entity: 'sensor.svg_x', y_entity: 'sensor.svg_y', unit: 'cm' }] },
      mount: { installation_id: 'svg', x: .5, y: .5, heading_deg: 0 },
      calibration: { method: 'manual', mirror: false, cell_cm: 5 },
    } });
    cfg.settings.radar = { version: 1 }; return cfg;
  });
  await window.__hpTest.setLayout(layout => ({ ...layout, e_svg_robot: { s: 'f1', x: .1, y: .1 }, e_svg_radar: { s: 'f1', x: .5, y: .5 } }));
  const old = window.__card, base = old.hass.callWS.bind(old.hass);
  const card = document.createElement('houseplan-card'); card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
  card.hass = { ...old.hass, states: { ...old.hass.states,
    'vacuum.svg_robot': { state: 'cleaning', attributes: {} },
    'camera.svg_map': { state: 'idle', attributes: { robot_position: { x: 600, y: 500 }, map_name: 'm1' } } },
    connection: { ...old.hass.connection, subscribeMessage: async (next, message) => {
      if (message.type !== 'houseplan/radar/subscribe') return old.hass.connection.subscribeMessage(next, message);
      const timer = setTimeout(() => next({ server_session_id: 'svg-session', marker_id: 'e_svg_radar', source_generation: 'svg',
        calibration_revision: 'svg', seq: 1, reported_at: Date.now() / 1000, expires_at: Date.now() / 1000 + 300,
        health: 'ok', reported_presence: true, complete: true, targets: [{ slot: 'target_1', x: .5, y: .5,
          reported_at: Date.now() / 1000, expires_at: Date.now() / 1000 + 300, pair_quality: 'bounded_latest', included: true }], ranges: [], zones: [] }), 0);
      return () => clearTimeout(timer);
    } },
    callWS: async message => {
      if (message.type === 'houseplan/trail/get') return { trail_format: 2, trails: { e_svg_robot: { current: {
        map_id: 'm1', route_id: 'svg-map', path_format: 2, paths: [[[200, 300], [400, 300], [400, 500], [600, 500]]],
        quality: { source: 'native', reason: 'ok', raw_points: 4 } } } } };
      const response = await base(message);
      return message.type === 'houseplan/config/get' ? { ...response, radar_stage1_api: 1 } : response;
    } };
  old.replaceWith(card); window.__card = card;
  await window.__hpTest.settled();
});
await page.locator('.vactrail path.core').waitFor({ state: 'attached' });
await page.locator('[data-led-strip="svg-led"]').waitFor({ state: 'attached' });
await page.locator('.radar-target').waitFor({ state: 'attached' });
const ready = () => page.waitForFunction(() => {
  const root = document.querySelector('houseplan-card')?.shadowRoot;
  const stage = root?.querySelector('.stage'), plan = root?.querySelector('.plan-svg');
  return stage && plan && !root.querySelector('.bootveil')
    && !stage.matches('.hpboot,.hpiso-pending,.mode-transition') && getComputedStyle(plan).visibility === 'visible';
});
await ready();
const dialog = page.locator('hp-pdf-dialog');
const field = (name) => dialog.locator(`[data-field="${name}"]`);
const open = async () => {
  const trigger = page.locator('[data-hp="pdf"]');
  if (await trigger.isVisible()) await trigger.click();
  else {
    await page.locator('[data-hp="header-menu"]').click();
    await page.locator('[data-hp="header-menu-item"][data-id="pdf"]').click();
  }
  await dialog.waitFor({ state: 'attached' });
};
const selectSvg = async () => { await field('export-format').selectOption('svg'); };
const download = async () => {
  const pending = page.waitForEvent('download');
  await dialog.locator('button[data-hp="dialog-confirm"]').click();
  const item = await pending;
  const xml = readFileSync(await item.path(), 'utf8');
  await dialog.waitFor({ state: 'detached' });
  return { xml, name: item.suggestedFilename() };
};
const facts = async (xml) => page.evaluate((text) => {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  return {
    xml: !doc.querySelector('parsererror'),
    paths: doc.querySelectorAll('path').length,
    devices: doc.querySelectorAll('.dev').length,
    vacuum: doc.querySelectorAll('.vactrail,.vacpuck').length,
    led: doc.querySelectorAll('.led-strips').length,
    ledCutouts: [...doc.querySelectorAll('.led-body[mask]')].filter(el => {
      const id = el.getAttribute('mask').match(/#([^)'"\s]+)/)?.[1];
      return id && doc.getElementById(id)?.localName === 'mask';
    }).length,
    radar: doc.querySelectorAll('.radar-target,.radar-ranges').length,
    labels: doc.querySelectorAll('.roomlabel').length,
    backdrop: doc.querySelectorAll('.hp-backdrop').length,
    native: doc.documentElement.querySelectorAll(':scope > svg').length,
    walls: doc.documentElement.querySelectorAll(':scope > svg .wallbody-fill,:scope > svg .iso-wall-top').length,
    safe: !doc.querySelector('script,ha-icon,ha-svg-icon,iframe,object'),
    private: !doc.querySelector('[data-entity],[data-id],[data-area]'),
    external: [...doc.querySelectorAll('*')].some(el => [...el.attributes].some(a => /^(href|src|xlink:href)$/.test(a.name) && !/^(data:|#)/.test(a.value))),
  };
}, xml);

await open();
await selectSvg();
check('svg-devices-default-off', !await field('svg-devices').isChecked());
check('svg-background-default-transparent', await field('export-background').inputValue(), 'transparent');
await field('svg-devices').check();
await field('export-format').selectOption('pdf');
check('pdf-dimensions-independent', await field('pdf-dimensions').isChecked());
await field('pdf-dimensions').uncheck();
await selectSvg();
check('svg-choice-restored', await field('svg-devices').isChecked());
await field('svg-devices').uncheck();
const noDevices = await download();
const noFacts = await facts(noDevices.xml);
checkAll({ 'valid-default-svg': noFacts.xml, 'default-no-devices': noFacts.devices === 0,
  'default-no-vacuum-led-radar': noFacts.vacuum + noFacts.led + noFacts.radar === 0,
  'native-vector-architecture': noFacts.native > 0 && noFacts.walls > 0,
  'no-external-refs': !noFacts.external, 'no-ha-elements': noFacts.safe, 'no-private-metadata': noFacts.private });

for (const iso of [false, true]) {
  if (iso) await page.evaluate(async () => {
    const card = window.__card;
    card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: true } };
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces[0].settings.bg_mode = 'daynight'; return cfg;
    });
    await window.__hpTest.setVolumetricView(true);
    card.hass = { ...card.hass, states: { ...card.hass.states,
      'light.ceiling': { ...card.hass.states['light.ceiling'], state: 'off' } } };
    await card.updateComplete;
  });
  await ready();
  await page.mouse.move(995, 5);
  const before = await page.evaluate(() => ({
    config: JSON.stringify(window.__card._serverCfg), layout: JSON.stringify(window.__card._layout),
    view: document.querySelector('houseplan-card').shadowRoot.querySelector('.plan-svg').getAttribute('viewBox'),
  }));
  const original = await page.locator('houseplan-card .stage').screenshot();
  await open(); await selectSvg(); await field('svg-devices').check();
  await field('export-background').selectOption('current');
  const saved = await download();
  const f = await facts(saved.xml);
  check(`devices-${iso ? 'iso' : 'flat'}`, f.devices > 0);
  check(`vacuum-led-radar-${iso}`, f.vacuum > 0 && f.led > 0 && f.radar > 0);
  check(`#1043 off LED cutout survives standalone SVG-${iso}`, f.ledCutouts, iso ? 1 : 0);
  check(`svg-extension-${iso}`, saved.name.endsWith('.svg'));
  const after = await page.evaluate(() => ({
    config: JSON.stringify(window.__card._serverCfg), layout: JSON.stringify(window.__card._layout),
    view: document.querySelector('houseplan-card').shadowRoot.querySelector('.plan-svg').getAttribute('viewBox'),
  }));
  check(`read-only-${iso}`, after, before);
  const standalone = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1 });
  const network = []; await standalone.route('**/*', route => { network.push(route.request().url()); return route.abort(); });
  await standalone.setContent(`<style>body{margin:0}img{display:block}</style><img src="data:image/svg+xml;base64,${Buffer.from(saved.xml).toString('base64')}">`);
  await standalone.locator('img').evaluate(img => img.decode());
  const rendered = await standalone.locator('img').screenshot();
  const difference = await standalone.evaluate(async ([a, b]) => {
    const pixels = async data => {
      const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { w: img.width, h: img.height, p: ctx.getImageData(0, 0, img.width, img.height).data };
    };
    const x = await pixels(a), y = await pixels(b);
    if (x.w !== y.w || x.h !== y.h) return { ratio: 1, dimensions: [x.w, x.h, y.w, y.h] };
    let bad = 0;
    for (let i = 0; i < x.p.length; i += 4) if (Math.max(...[0, 1, 2].map(k => Math.abs(x.p[i+k] - y.p[i+k]))) > 30) bad++;
    return { ratio: bad / (x.w * x.h) };
  }, [original.toString('base64'), rendered.toString('base64')]);
  console.log('SVG_VISUAL', { iso, ...difference });
  check(`offline-no-network-${iso}`, network.length, 0);
  check(`visual-current-view-${iso}`, difference.ratio < 0.003);
  if (output) {
    const name = iso ? 'iso' : 'flat'; writeFileSync(resolve(output, name + '.svg'), saved.xml);
    writeFileSync(resolve(output, name + '-view.png'), original); writeFileSync(resolve(output, name + '-svg.png'), rendered);
  }
  await standalone.close();
}

await open(); await selectSvg();
await field('export-background').selectOption('custom');
check('custom-picker-under-list', await dialog.locator('hp-color-opacity').isVisible());
const picker = dialog.locator('hp-color-opacity');
await picker.locator('[data-field="colour-open"]').click();
await picker.locator('[data-field="colour-hex"]').fill('#123456');
await picker.locator('[data-field="colour-opacity"][data-value="number"]').fill('30');
await picker.locator('[data-action="colour-confirm"]').click();
const custom = await download();
const customBackground = await page.evaluate(text => {
  const d = new DOMParser().parseFromString(text, 'image/svg+xml');
  const bg = d.documentElement.querySelector(':scope > rect');
  return { color: bg?.getAttribute('fill'), alpha: bg?.getAttribute('opacity') };
}, custom.xml);
check('custom-background-values', customBackground, { color: '#123456', alpha: '0.3' });
await open(); await selectSvg();
await field('export-background').selectOption('custom');
await picker.locator('[data-field="colour-open"]').click();
await picker.locator('[data-field="colour-hex"]').fill('#zzzzzz');
await dialog.locator('[data-hp="dialog-confirm"]').click();
check('invalid-hex-blocks-export', await dialog.count(), 1);
check('invalid-hex-shown', await picker.locator('[data-field="colour-hex"]').getAttribute('aria-invalid'), 'true');
await picker.locator('[data-field="colour-hex"]').fill('#ffffff');
await picker.locator('[data-action="colour-confirm"]').click();
await field('export-background').selectOption('transparent');
check('transparent-no-picker', await dialog.locator('hp-color-opacity').count(), 0);
await field('svg-roomNames').uncheck(); await field('svg-decor').uncheck();
if (await field('svg-backdrop').count()) await field('svg-backdrop').uncheck();
const minimal = await download(); const min = await facts(minimal.xml);
checkAll({ 'names-off': min.labels === 0, 'backdrop-off': min.backdrop === 0, 'still-vector': min.paths > 0 });
// An unavailable asset must leave the draft open, with no incomplete download.
const backdrop = await page.locator('houseplan-card [data-hp="backdrop"]').getAttribute('href');
const assetUrl = new URL(backdrop, page.url()).href;
await page.route(assetUrl, route => route.fulfill({ status: 503, body: 'unavailable' }));
await open(); await selectSvg();
await dialog.locator('[data-hp="dialog-confirm"]').click();
await page.waitForFunction(() => window.__hpTest.toast()?.getAttribute('data-id') === 'svg.asset_failed');
check('asset-error-keeps-dialog', await dialog.count(), 1);
check('asset-error-reenables-action', await dialog.locator('[data-hp="dialog-confirm"]').isEnabled());
await field('export-format').selectOption('pdf');
await field('pdf-dimensions').uncheck();
await dialog.locator('[data-hp="dialog-confirm"]').click();
await page.waitForFunction(() => window.__hpTest.toast()?.getAttribute('data-id') === 'pdf.asset_failed');
check('pdf-failed-attempt-retains-existing-browser-preference', await page.evaluate(() => JSON.parse(localStorage.getItem('hp.pdf.options')).dimensions), false);
await page.unroute(assetUrl);
await dialog.locator('.row > [data-hp="dialog-cancel"]').click();
await dialog.waitFor({ state: 'detached' });
let releaseAsset, requested;
const seenAsset = new Promise(resolve => { requested = resolve; });
await page.route(assetUrl, async route => {
  if (route.request().resourceType() !== 'fetch') { await route.fallback(); return; }
  requested(); await new Promise(resolve => { releaseAsset = resolve; }); await route.fallback();
});
await open(); await selectSvg();
const downloadCount = downloads.length;
await dialog.locator('[data-hp="dialog-confirm"]').click(); await seenAsset;
check('busy-action-disabled', await dialog.locator('[data-hp="dialog-confirm"]').isDisabled());
await page.evaluate(() => window.__hpTest.setServerConfig(cfg => { cfg.spaces[0].title += ' changed'; return cfg; }));
const retiredOutcome = Promise.race([
  page.waitForFunction(() => window.__hpTest.toast()?.getAttribute('data-id') === 'svg.cancelled').then(() => 'cancelled'),
  page.waitForEvent('download').then(() => 'download'),
]);
releaseAsset();
assert.equal(await retiredOutcome, 'cancelled', 'retired SVG operation must not download');
check('retired-context-no-download', downloads.length, downloadCount);
await page.unroute(assetUrl);
await dialog.locator('.row > [data-hp="dialog-cancel"]').click();
await dialog.waitFor({ state: 'detached' });
for (const mode of ['plan', 'devices', 'decor']) {
  await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
  await open(); await selectSvg();
  const count = downloads.length;
  const editorOutcome = Promise.race([
    page.waitForFunction(() => window.__hpTest.toast()?.getAttribute('data-id') === 'svg.view_required').then(() => 'refused'),
    page.waitForEvent('download').then(() => 'download'),
  ]);
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  assert.equal(await editorOutcome, 'refused', 'SVG must refuse an editor frame');
  check(`editor-svg-refused-${mode}`, downloads.length, count);
  check(`editor-stays-${mode}`, await page.locator('ha-card[data-hp-mode]').getAttribute('data-hp-mode'), mode);
  check(`editor-draft-dialog-retained-${mode}`, await dialog.count(), 1);
  await field('export-format').selectOption('pdf');
  if (await field('pdf-backdrop').count()) await field('pdf-backdrop').uncheck();
  const pdf = await download();
  check(`editor-pdf-works-${mode}`, pdf.name.endsWith('.pdf') && pdf.xml.startsWith('%PDF-'));
  await page.evaluate(() => window.__hpTest.setMode('view'));
}
await page.setViewportSize({ width: 320, height: 760 });
await page.locator('#host').evaluate(el => { el.style.width = '100%'; el.style.maxWidth = '100%'; el.style.margin = '0'; });
// Phone header keeps Print inside the common action menu.
await open(); await selectSvg();
const narrow = await dialog.locator('hp-dialog').evaluate(el => {
  const surface = el.shadowRoot.querySelector('.surface'); const r = surface.getBoundingClientRect();
  return r.width <= innerWidth && r.left >= -1 && r.right <= innerWidth + 1;
});
check('320px-dialog-fits', narrow);
check('shared-close-pointer', await dialog.locator('hp-dialog button.close').evaluate(el => getComputedStyle(el).cursor), 'pointer');
check('shared-select-pointer', await dialog.locator('hp-settings-select').first().locator('button').evaluate(el => getComputedStyle(el).cursor), 'pointer');
if (output) await page.screenshot({ path: resolve(output, 'dialog-mobile.png') });
await finish(browser, { default: noFacts, minimal: min });
