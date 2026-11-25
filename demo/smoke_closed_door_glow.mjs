// #1421: real panel DOM, physical clipping and independently sampled PNG pixels.
// Synthetic HA transport only; this is not a real-HA backend acceptance.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
    // Isolate the receiver during the GPU optical test. Otherwise the pixel
    // over a covered floor point can be a lit wall or the door face itself.
    // The closed leaf's own mesh is checked separately below.
    const floorOnly = isolated => page.evaluate(async isolated => {
      const host = window.__card._plan3dHost;
      if (!host) return;
      for (const mesh of host.world.structure.children.slice(1)) mesh.visible = !isolated;
      host.world.openings.visible = !isolated;
      host.draw();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, isolated);
    await state('light.ceiling', 'off');
    await floorOnly(true);
    const off = await page.screenshot({ path: fileURLToPath(new URL(`${name}-off.png`, dir)) });
    await state('light.ceiling', 'on');
    const result = await prepareClosedDoorLight(page, fixture).catch(async error => {
      const diagnostic = await page.evaluate(() => {
        const card = window.__goldenCard || window.__card;
        return { space: card._space, selected: card._desiredProjection, shown: card._renderProjection,
          failure: card._plan3dFailure, settings: card._spaceDisplayForRender(),
          ready: !!card.renderRoot.querySelector('canvas[data-hp-plan-3d-ready]'),
          lamp: card._renderPlanHass.states['light.ceiling']?.state,
          sources: card._plan3dPresentation?.world.lights.map(({ id, intensity, visible }) => ({ id, intensity, paths: visible.length })) };
      });
      throw Error(`${name} light did not settle: ${JSON.stringify(diagnostic)}`, { cause: error });
    });
    await floorOnly(true);
    const on = await page.screenshot({ path: fileURLToPath(new URL(`${name}-closed.png`, dir)) });
    await floorOnly(false);
    const deltas = await page.evaluate(async ({ off, on, points }) => {
      const decode = async value => {
        const image = new Image(); image.src = 'data:image/png;base64,' + value; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      };
      const [a, b] = await Promise.all([decode(off), decode(on)]);
      // Keep the sampling windows on their respective sides of a thin leaf,
      // even when perspective compresses the opening to a few screen pixels.
      const radius = Math.max(0, Math.min(3, Math.floor(Math.hypot(points[0].x - points[1].x,
        points[0].y - points[1].y) / 4)));
      return points.map(p => {
        let delta = 0;
        for (let y = Math.round(p.y) - radius; y <= Math.round(p.y) + radius; y++)
          for (let x = Math.round(p.x) - radius; x <= Math.round(p.x) + radius; x++) {
            const i = (y * a.width + x) * 4;
            delta += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1])
              + Math.abs(a.data[i + 2] - b.data[i + 2]);
          }
        return delta / (3 * (radius * 2 + 1) ** 2);
      });
    }, { off: off.toString('base64'), on: on.toString('base64'),
      points: [result.targetScreen, result.shadowScreen] });
    assert.ok(deltas[0] > 5, `${name}: actual pixels before the closed leaf must brighten: ${deltas}`);
    assert.ok(deltas[1] < 1, `${name}: pixels beyond the leaf must remain dark: ${deltas}`);
    evidence.pixels.push({ name, deltas });
    return result;
  };
  const halfTurn = async () => {
    for (let n = 0; n < 4; n++) {
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
  await page.screenshot({ path: fileURLToPath(new URL('flat-open.png', dir)) });
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
        const host = card._plan3dHost;
        const face = card._plan3dPresentation.world.panels.find(item => item.id === 'closed-door')?.surfaces
          .find(item => item.kind === 'leaf-front');
        const painted = face?.points.every(({ point: [x, y], z }) => host.world.openings.children.some(mesh => {
          const positions = mesh.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) if (Math.hypot(positions.getX(i) - x,
            positions.getY(i) - z, positions.getZ(i) - y) < .001) return true;
          return false;
        }));
        return { plane: basis?.leaves[0]?.hinge[0], painted };
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
  assert.deepEqual((await prepareClosedDoorLight(page,fixture)).clip,iso.clip,'camera zoom/pan/rotation never changes ground transport');
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
    card._isoSceneRuntime={...runtime,preparePlan3dFrame:()=>{throw Error('controlled closed-leaf presentation refusal');}};
    card.requestUpdate();
  }); await settle();
  assert.equal(await page.locator('houseplan-card canvas[data-hp-plan-3d]').count(),0);
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
