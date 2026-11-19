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
      const transport=window.__mkHass();
      card.hass = { ...card.hass, devices:fixture.devices, entities:fixture.entities, areas:fixture.areas,
        states: { ...off, ...fixture.states }, callWS: message => {
          if(message.type==='config/device_registry/list') return Promise.resolve(Object.values(fixture.devices));
          if(message.type==='config/entity_registry/list') return Promise.resolve(Object.values(fixture.entities));
          return transport.callWS(message);
        } };
      await window.__hpTest.setServerConfig(() => fixture.config);
      await window.__hpTest.waitForWrites();
      await window.__hpTest.setLayout(() => fixture.layout);
      await window.__hpTest.waitForWrites();
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
  const halfTurn = async () => {
    for (let n = 0; n < 2; n++) {
      await page.locator('houseplan-card [data-hp="rotate-right"]').click();
      await settle();
    }
  };
  const isoPixelProof = async (fixture, name, sourceOnRight = false) => {
    // The default camera looks through the leaf from the right-hand room,
    // which hides the lamp-side floor pocket when the source is on the left.
    // Observe the same physical probe from the lamp side in that case.
    if (!sourceOnRight) await halfTurn();
    try {
      return await pixelProof(fixture, name);
    } finally {
      if (!sourceOnRight) await halfTurn();
    }
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
  const iso = await isoPixelProof(fixture, 'iso');
  assert.notDeepEqual(iso.clip, flat.clip, 'Iso closes at its selected face, Flat at the saved axis');
  const renderedLeaf = async (f, flipV = false) => {
    if (flipV) await halfTurn();
    try {
      const leaf = await page.evaluate(() => {
        const card = window.__card;
        const basis = card._isoSource().build().openings.find(item => item.id === 'closed-door');
        const face = card.shadowRoot.querySelector(
          '[data-id="closed-door"][data-surface="leaf-front"], [data-id="closed-door"][data-surface="leaf-back"]');
        return { plane: basis?.leaves[0]?.hinge[0], painted: !!face?.getAttribute('d') };
      });
      assert.ok(leaf.painted, 'the camera facing the selected wall face must paint the closed leaf');
      assert.ok(Math.abs(leaf.plane - f.doorLightIsoPanelX * 1000) < .001,
        `light probe plane must match the door mesh at the selected face: ${JSON.stringify(leaf)}`);
    } finally {
      if (flipV) await halfTurn();
    }
  };
  await renderedLeaf(fixture);
  const isoStored=await stored();
  await page.locator('houseplan-card [data-hp="zoom-in"]').click(); await settle();
  const stage=await page.locator('houseplan-card .stage').boundingBox();
  await page.mouse.move(stage.x+stage.width*.25,stage.y+stage.height*.5); await page.mouse.down();
  await page.mouse.move(stage.x+stage.width*.25+30,stage.y+stage.height*.5+20,{steps:3}); await page.mouse.up(); await settle();
  await page.locator('houseplan-card [data-hp="rotate-right"]').click(); await settle();
  assert.deepEqual((await prepareClosedDoorLight(page,fixture)).clip,iso.clip,'camera zoom/pan/quarter-turn never changes ground transport');
  assert.equal(await stored(),isoStored,'camera-only actions write no plan');
  await page.evaluate(() => window.__hpTest.setVolumetricView(false)); await settle();
  assert.deepEqual((await prepareClosedDoorLight(page,fixture)).clip,flat.clip,'switching back cannot retain Iso placement');
  // Restore the camera before checking actual leaf ground vertices again.
  await page.locator('houseplan-card [data-hp="rotate-left"]').click();
  await settle();
  for(const wallCm of [30,96]) for(const right of [false,true]) for(const flipV of [false,true]) for(const flipH of [false,true]) {
    const f=await seed({wallCm,right,flipV,flipH});
    const expectedFlat=(await prepareClosedDoorLight(page,f)).clip;
    await page.evaluate(()=>window.__hpTest.setVolumetricView(true)); await settle();
    await isoPixelProof(f,`iso-${wallCm}-${right}-${flipV}-${flipH}`,right); await renderedLeaf(f, flipV);
    const retained=(await prepareClosedDoorLight(page,f)).clip;
    await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{cfg.spaces[0].settings.hide_openings=true;})); await settle();
    assert.deepEqual((await prepareClosedDoorLight(page,f)).clip,retained,'hiding opening paint never changes Glow');
    await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{cfg.spaces[0].settings.show_borders=false;})); await settle();
    assert.deepEqual((await prepareClosedDoorLight(page,f)).clip,expectedFlat,'no-volume branch restores Flat clipping');
    await page.evaluate(()=>window.__hpTest.setVolumetricView(false)); await settle();
  }
  const fallbackFixture=await seed();
  const fallbackFlat=(await prepareClosedDoorLight(page,fallbackFixture)).clip;
  await page.evaluate(()=>window.__hpTest.setVolumetricView(true)); await settle();
  await page.evaluate(()=>window.__hpTest.setMode('devices')); await settle();
  assert.deepEqual((await prepareClosedDoorLight(page,fallbackFixture)).clip,fallbackFlat,'editor uses Flat placement despite saved Iso preference');
  await page.evaluate(()=>window.__hpTest.setMode('view')); await settle();
  await prepareClosedDoorLight(page,fallbackFixture);
  await page.evaluate(()=>{
    const card=window.__card, runtime=card._isoSceneRuntime;
    window.__door1449Runtime=runtime;
    // Controlled optional-render failure through the real existing boundary.
    card._isoSceneRuntime={...runtime,resolveIsoFramePresentation:()=>{throw Error('controlled closed-leaf presentation refusal');}};
    card.requestUpdate();
  }); await settle();
  assert.equal(await page.locator('houseplan-card [data-hp="iso-walls"]').count(),0);
  assert.deepEqual((await prepareClosedDoorLight(page,fallbackFixture)).clip,fallbackFlat,'latched fallback must not retain Iso optical cache');
  await page.evaluate(async()=>{
    window.__card._isoSceneRuntime=window.__door1449Runtime; delete window.__door1449Runtime;
    await window.__hpTest.setVolumetricView(false);
  }); await settle();
  evidence.checks.push('iso-rendered-leaf-ground-vertices', 'iso-ordinary-thick-both-sides-flips',
    'camera-world-invariance', 'hidden-no-borders-editor-fallback');
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
