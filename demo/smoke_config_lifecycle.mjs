// #1015: actual card config/get adoption, SVG text/geometry and native action.
// Real HA Store/import tests independently prove this exact shared response;
// the browser transport is synthetic, not a private HA/GPU environment.
import { readFileSync, mkdirSync } from 'node:fs';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const fixture = JSON.parse(readFileSync('test/fixtures/config-lifecycle/migration-v1.json', 'utf8'));
const { page, browser } = await launch({ width: 1200, height: 900 }, 1);
await page.evaluate(() => {
  const card = window.__card, original = card.hass.callWS;
  window.__lifecycleReads = [];
  card.hass = { ...card.hass, callWS: async request => {
    const result = await original(request);
    if (request.type === 'houseplan/config/get') window.__lifecycleReads.push(structuredClone(result.config));
    return result;
  } };
});
await page.evaluate(async expected => {
  await window.__hpTest.setServerConfig(expected.config);
  await window.__hpTest.setLayout(expected.layout);
}, fixture.expected);
const card = page.locator('houseplan-card');
await card.locator('[data-hp="zoom-fit"]').click();
await card.locator('[data-hp="decor"][data-id="life-label"]').waitFor();
const observed = await page.evaluate(() => {
  const card = window.__card, root = card.renderRoot;
  const line = root.querySelector('[data-hp="decor"][data-id="life-line"]');
  const text = root.querySelector('[data-hp="decor"][data-id="life-label"]');
  return {
    loaded: card._loadOk,
    space: card._space,
    line: { y: Number(line?.getAttribute('y1')), width: Number(line?.getAttribute('stroke-width')) },
    text: { value: text?.textContent.trim(), size: Number(text?.getAttribute('font-size')) },
    marker: card._serverCfg.markers.find(marker => marker.id === 'd_lamp'),
    layout: card._layout.d_lamp,
    unknown: card._serverCfg.future_root,
    weatherAbsent: !Object.hasOwn(card._serverCfg.settings, 'weather_entity'),
    served: window.__lifecycleReads.some(config => config.markers?.some(marker => marker.id === 'd_lamp' && marker.display === 'icon_ripple')),
  };
});
check('actual-config-get-loaded', observed.loaded && observed.served, true);
check('loaded-space', observed.space, 'f1');
check('square-frame-line-coordinate', observed.line.y, 450);
check('pixel-identical-legacy-stroke', observed.line.width, 2);
check('visible-legacy-label', observed.text.value, 'Legacy label');
check('pixel-identical-legacy-font', Math.abs(observed.text.size - 30) < 1e-9, true);
check('canonical-marker-presentation', observed.marker.display, 'icon_ripple');
check('canonical-vacuum-trail', observed.marker.vacuum.trail_mode, 'never');
check('canonical-paired-position', observed.layout, fixture.expected.layout.d_lamp);
check('unknown-root-retained', observed.unknown, fixture.expected.config.future_root);
check('retired-inert-weather-key-is-canonical', observed.weatherAbsent, true);
await page.evaluate(() => { window.__serviceCalls.length = 0; });
await card.locator('[data-hp="device"][data-id="d_lamp"]').click();
const calls = await page.evaluate(() => window.__serviceCalls);
check('native-toggle-preserves-target', calls.some(call => call[0] === 'light'
  && call[1] === 'turn_on' && JSON.stringify(call[2]).includes('light.floor_lamp')), true);
const before = await page.evaluate(() => ({
  line: window.__card.renderRoot.querySelector('[data-hp="decor"][data-id="life-line"]').outerHTML,
  text: window.__card.renderRoot.querySelector('[data-hp="decor"][data-id="life-label"]').outerHTML,
}));
await page.evaluate(async config => window.__hpTest.setServerConfig(config), fixture.expected.config);
const after = await page.evaluate(() => ({
  line: window.__card.renderRoot.querySelector('[data-hp="decor"][data-id="life-line"]').outerHTML,
  text: window.__card.renderRoot.querySelector('[data-hp="decor"][data-id="life-label"]').outerHTML,
}));
check('current-reread-keeps-observed-geometry-and-text', after, before);
mkdirSync('artifacts/1015', { recursive: true });
await page.screenshot({ path: 'artifacts/1015/legacy-load-native.png' });
await finish(browser, observed);
