// #1421: real panel DOM, physical clipping and independently sampled PNG pixels.
// Synthetic HA transport only; this is not a real-HA backend acceptance.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchPanelCold, finish, requirePinnedBrowser } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
import { makeClosedDoorFixture } from './fixtures/closed-door-light.mjs';
import { inspectClosedDoorLight, prepareClosedDoorLight } from './golden/closed-door-light.mjs';

requirePinnedBrowser('smoke_closed_door_glow');
const dir = new URL('../artifacts/closed-door-glow/', import.meta.url);
mkdirSync(dir, { recursive: true });
const { page, browser } = await launchPanelCold({ width: 2000, height: 1000 });
const evidence = { checks: [], pixels: [] };
try {
  await page.evaluate(async () => {
    await import('/assets/houseplan-panel.js');
    const panel = document.createElement('houseplan-panel');
    panel.hass = window.__mkHass();
    document.querySelector('#host').append(panel);
    window.__card = panel.shadowRoot.querySelector('houseplan-card');
  });
  await page.waitForFunction(() => window.__card?._loadOk && !window.__card._booting);
  await assertFreshDemoBundle(page);
  await prepareDesktopControls(page);
  const settle = async () => { await page.evaluate(() => window.__hpTest.settled()); await page.waitForTimeout(650); };
  const seed = async options => {
    const fixture = makeClosedDoorFixture(options);
    await page.evaluate(async fixture => {
      const card = window.__card;
      const off = Object.fromEntries(Object.entries(card.hass.states).map(([id, state]) =>
        [id, id.startsWith('light.') ? { ...state, state: 'off' } : state]));
      card.hass = { ...card.hass, states: { ...off, ...fixture.states } };
      await window.__hpTest.setServerConfig(() => fixture.config);
      await window.__hpTest.setLayout(() => fixture.layout);
      await window.__hpTest.setMode('view');
    }, fixture);
    await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
    await settle();
    return fixture;
  };
  const state = async (id, state) => {
    await page.evaluate(({ id, state }) => {
      const c = window.__card, s = c.hass.states[id];
      c.hass = { ...c.hass, states: { ...c.hass.states, [id]: { ...s, state } } };
    }, { id, state });
    await settle();
  };
  const pixelProof = async (fixture, name) => {
    await state('light.ceiling', 'off');
    const off = await page.screenshot({ path: new URL(`${name}-off.png`, dir).pathname });
    await state('light.ceiling', 'on');
    const result = await prepareClosedDoorLight(page, fixture);
    const on = await page.screenshot({ path: new URL(`${name}-closed.png`, dir).pathname });
    const deltas = await page.evaluate(async ({ off, on, points }) => {
      const decode = async value => {
        const image = new Image(); image.src = 'data:image/png;base64,' + value; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      };
      const [a, b] = await Promise.all([decode(off), decode(on)]);
      return points.map(p => {
        let delta = 0;
        for (let y = Math.round(p.y) - 3; y <= Math.round(p.y) + 3; y++)
          for (let x = Math.round(p.x) - 3; x <= Math.round(p.x) + 3; x++) {
            const i = (y * a.width + x) * 4;
            delta += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1])
              + Math.abs(a.data[i + 2] - b.data[i + 2]);
          }
        return delta / 147;
      });
    }, { off: off.toString('base64'), on: on.toString('base64'),
      points: [result.targetScreen, result.shadowScreen] });
    assert.ok(deltas[0] > 5, `${name}: actual pixels before the closed leaf must brighten: ${deltas}`);
    assert.ok(deltas[1] < 1, `${name}: pixels beyond the leaf must remain dark: ${deltas}`);
    evidence.pixels.push({ name, deltas });
    return result;
  };
  const fixture = await seed();
  const stored = () => page.evaluate(() => JSON.stringify([window.__card._serverCfg, window.__card._layout,
    window.__card._cfgRev, window.__card._layoutRev]));
  const before = await stored();
  const flat = await pixelProof(fixture, 'flat');
  await state('binary_sensor.window', 'on');
  assert.ok((await inspectClosedDoorLight(page, fixture.doorLightProbes)).shadow, 'opening the door lights its other side');
  await page.screenshot({ path: new URL('flat-open.png', dir).pathname });
  await state('binary_sensor.window', 'off');
  assert.deepEqual((await prepareClosedDoorLight(page, fixture)).clip, flat.clip, 'closing restores the exact closed mask');
  assert.equal(await stored(), before, 'contact and light updates never write the plan');
  // Changing the view preference intentionally persists that preference, unlike
  // live contact/light updates; it is not a read-only camera operation.
  await page.evaluate(() => window.__hpTest.setVolumetricView(true)); await settle();
  const iso = await pixelProof(fixture, 'iso');
  assert.deepEqual(iso.clip, flat.clip, '2.5D transports light through the same physical slot');
  await page.evaluate(() => window.__hpTest.setVolumetricView(false)); await settle();
  evidence.checks.push('panel-flat-pixels', 'panel-iso-pixels', 'closed-open-closed', 'no-writes');
  for (const options of [{ right: true }, { slide: true }, { slide: true, flipV: true },
    { partition: true }, { partition: true, slide: true }, { exterior: true }, { exterior: true, slide: true, flipV: true }]) {
    const f = await seed(options);
    await prepareClosedDoorLight(page, f, options);
    evidence.checks.push(options);
  }
  const ledFixture = await seed({ led: true });
  await prepareClosedDoorLight(page, ledFixture, { led: true });
  await page.evaluate(() => window.__hpTest.setVolumetricView(true)); await settle();
  await prepareClosedDoorLight(page, ledFixture, { led: true });
  await page.evaluate(() => window.__hpTest.setVolumetricView(false)); await settle();
  evidence.checks.push('led-flat', 'led-iso');
  await seed();
  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const host = document.createElement('div'); host.style.width = '800px'; document.body.append(host);
    const c = document.createElement('houseplan-space-card');
    c.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: true, live_states: true });
    c.hass = window.__card.hass; host.append(c);
  });
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot
    ?.querySelector('[data-glow-source="light.ceiling"] .glow-pool'));
  await settle();
  await prepareClosedDoorLight(page, fixture, { staticCard: true });
  evidence.checks.push('static-card');
  evidence.completed = true;
  console.log(JSON.stringify(evidence));
} finally {
  writeFileSync(new URL('evidence.json', dir), JSON.stringify(evidence, null, 2));
  await finish(browser);
}
