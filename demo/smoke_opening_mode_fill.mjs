// #1244: a dark floor's tunnel must not disappear ahead of the floor wash.
// Native header clicks; sample every presented rAF, not only the settled ends.
import { launch, check, finish } from './serve.mjs';
import { makeStaticWallOpeningsFixture } from './fixtures/static-wall-openings.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const { page, browser } = await launch({ width: 1440, height: 900 });
const fixture = makeStaticWallOpeningsFixture();
for (const [index, room] of fixture.spaces[0].rooms.entries()) {
  room.settings.custom_fill = { c: index ? '#222222' : '#111111', a: 1 };
}
fixture.spaces[0].openings[0].contact = 'binary_sensor.synthetic_opening';
const config = commitWallSegmentModel(fixture).config;
await page.evaluate(async config => {
  await window.__hpTest.setServerConfig(config);
  window.__openingModeSamples = [];
  window.__sampleOpeningMode = () => {
    const c = window.__card, root = c.renderRoot;
    const stage = root.querySelector('.stage');
    const tunnel = root.querySelector('.opening-tunnels [data-id="shared-passage"]');
    const group = tunnel?.closest('.opening-tunnels');
    return {
      busy: c._modeTransitionBusy, projection: c._renderProjection,
      // Projection crossing deliberately holds its source scene until the
      // common fade's midpoint. A settled Plan source has no live fill.
      source: c._modeProjectionSource,
      sceneOpacity: Number(getComputedStyle(root.querySelector('.zoomwrap')).opacity),
      weight: Number(getComputedStyle(stage).getPropertyValue('--hp-mode-plan-weight')) || 0,
      present: !!tunnel, opacity: group ? Number(getComputedStyle(group).opacity) : 0,
      architecture: Number(getComputedStyle(stage).getPropertyValue('--hp-mode-architecture-opacity')) || 1,
      floor: getComputedStyle(root.querySelector('[data-hp="room"][data-id="Alpha"]')).fill,
      phantomLeafMotion: [...root.querySelectorAll('.opening .op-leaf, .opening .op-arc')]
        .some(node => node.getAnimations().some(a => a instanceof CSSTransition && a.playState === 'running')),
    };
  };
  window.__recordOpeningMode = () => {
    window.__openingModeSamples = [];
    let remaining = 45;
    const tick = () => {
      window.__openingModeSamples.push(window.__sampleOpeningMode());
      if (--remaining) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
}, config);
const settle = () => page.evaluate(async () => {
  await window.__card.updateComplete;
  for (let i = 0; i < 45; i++) await new Promise(requestAnimationFrame);
});
const out = {};
for (const reduced of [false, true]) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  for (const iso of [false, true]) {
    await page.evaluate(async iso => {
      await window.__hpTest.setServerConfig(cfg => { cfg.settings.volumetric_view = iso; });
    }, iso);
    await settle();
    for (const editor of ['plan', 'devices', 'decor']) {
      for (const entering of [true, false]) {
        const name = `${reduced ? 'reduced' : 'motion'}-${iso ? 'iso' : 'flat'}-${editor}-${entering ? 'enter' : 'leave'}`;
        await page.evaluate(() => window.__recordOpeningMode());
        await page.locator(entering
          ? `houseplan-card [data-hp="mode-tab"][data-mode="${editor}"]`
          : 'houseplan-card .editor-close-slot [data-hp="editor-close"]').click();
        await settle();
        const samples = await page.evaluate(() => window.__openingModeSamples);
        const active = samples.filter(s => s.busy && !s.source && s.projection === 'flat' && s.weight < .995);
        const failures = active.filter(s => !s.present || Math.abs(s.opacity - s.architecture * (1 - s.weight)) > .015);
        out[name] = { frames: samples.length, active: active.length, failures: failures.slice(0, 3) };
        check(`${name}: floor continuation follows the common mode weight`, failures.length === 0);
        check(`${name}: no phantom contact animation`, !samples.some(s => s.phantomLeafMotion));
        if (!reduced && !iso && editor === 'plan') {
          check(`${name}: observes intermediate dark-floor frames`, active.some(s => s.weight > .05 && s.weight < .8));
        }
        if (!reduced && iso) {
          check(`${name}: preserves the common projection fade`, samples.some(s => s.sceneOpacity < .25));
        }
        if (editor === 'plan' && entering) {
          const present = await page.locator('houseplan-card .opening-tunnels [data-hp="opening-tunnel"]').count();
          check(`${name}: no stale tunnel in settled Plan`, present === 0);
        }
      }
    }
  }
}

// A genuine HA contact update still drives the opening's 600 ms motion.
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => { cfg.settings.volumetric_view = false; });
  const c = window.__card;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.synthetic_opening': { entity_id: 'binary_sensor.synthetic_opening', state: 'off', attributes: {} } } };
});
await settle();
// Reverse with real keyboard activation while the header is still moving.
// Pointer clicking the translating Close can hit its neighbouring mode tab.
await page.evaluate(() => window.__recordOpeningMode());
await page.locator('houseplan-card [data-hp="mode-tab"][data-mode="plan"]').press('Enter');
await page.evaluate(async () => {
  await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
});
await page.locator('houseplan-card .editor-close-slot [data-hp="editor-close"]').press('Enter');
await settle();
const reverse = await page.evaluate(() => ({ samples: window.__openingModeSamples,
  mode: window.__card.renderRoot.querySelector('ha-card').getAttribute('data-hp-mode') }));
const reversalFrames = reverse.samples.filter(s => s.busy && s.weight < .995);
check('rapid keyboard reversal really interrupts the Plan transition', reverse.mode === 'view'
  && reverse.samples.some(s => s.weight > .005 && s.weight < .95)
  && !reverse.samples.some(s => s.weight === 1));
check('rapid reversal keeps tunnel and floor synchronized', reversalFrames.length > 0
  && reversalFrames.every(s => s.present && Math.abs(s.opacity - (1 - s.weight)) <= .015));
const contact = await page.evaluate(async () => {
  const c = window.__card, root = c.renderRoot;
  const leaf = root.querySelector('[data-hp="opening"][data-id="wall-door"] .op-leaf');
  const before = getComputedStyle(leaf).transform;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.synthetic_opening': { entity_id: 'binary_sensor.synthetic_opening', state: 'on', attributes: {} } } };
  await c.updateComplete;
  await new Promise(requestAnimationFrame);
  const animations = leaf.getAnimations().filter(a => a instanceof CSSTransition);
  return { sameNode: leaf === root.querySelector('[data-hp="opening"][data-id="wall-door"] .op-leaf'),
    before, after: getComputedStyle(leaf).transform,
    durations: animations.map(a => a.effect.getTiming().duration) };
});
check('real contact keeps the same leaf and its 600ms transition', contact.sameNode && contact.durations.includes(600));
await finish(browser, { out, reversal: { mode: reverse.mode, maxWeight: Math.max(...reverse.samples.map(s => s.weight)),
  frames: reversalFrames.length }, contact });
