import assert from 'node:assert/strict';
import { finish } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { browser, page } = await startIsoPaintScene({ reducedMotion: 'no-preference' });
const card = page.locator('houseplan-card');
const surface = card.locator('.iso-scene-surface');
const retained = surface.locator(':scope > [data-hp-retained-light]');

async function toggle(expectedPerspective, reducedMotion = false) {
  const observation = await page.evaluate(async ({ expectedPerspective, reducedMotion }) => {
    const card = window.__isoPaint;
    const scene = card.renderRoot.querySelector('.iso-scene-surface');
    const perspective = !!scene.querySelector('[data-hp-iso-perspective-floor]');
    const live = () => scene.firstElementChild;
    const old = () => scene.querySelector(':scope > [data-hp-retained-light]');
    const eid = Object.keys(card.hass.states).find(id => id.startsWith('light.'));
    const hasLight = layer => !!layer?.querySelector(`.glow-spot[data-glow-source="${eid}"]`);
    const before = hasLight(live());
    const previous = card.hass.states[eid];
    const state = previous.state === 'on' ? 'off' : 'on';
    card.hass = { ...card.hass, states: { ...card.hass.states, [eid]: { ...previous, state } } };
    const layers = () => [live(), old()];
    const animations = () => layers().flatMap(layer => layer?.getAnimations() ?? []);
    const started = performance.now();
    while (hasLight(live()) === before || (!reducedMotion && animations().length < 2)) {
      if (performance.now() - started > 2000)
        throw new Error(`light ${state}, perspective=${expectedPerspective}: missing crossfade or live light update`);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const effects = animations();
    for (const animation of effects) {
      animation.pause();
      animation.currentTime = 250;
    }
    return {
      perspective,
      before,
      after: hasLight(live()),
      state,
      retained: !!old(),
      previousPaint: hasLight(old()),
      duration: effects.map(animation => animation.effect.getTiming().duration),
      opacity: effects.length ? layers().map(layer => +getComputedStyle(layer).opacity) : [],
      floorAndWalls: !expectedPerspective || layers().filter(Boolean).every(layer =>
        layer.querySelector('[data-hp-iso-perspective-floor] .iso-floor-scene')
          && layer.querySelector('.iso-wall-top')),
      inert: !old() || old().hasAttribute('inert'),
    };
  }, { expectedPerspective, reducedMotion });
  assert.equal(observation.perspective, expectedPerspective);
  assert.equal(observation.after, observation.state === 'on');
  assert.notEqual(observation.after, observation.before);
  assert.equal(observation.retained, !reducedMotion);
  assert.equal(observation.floorAndWalls, true);
  assert.equal(observation.inert, true);
  if (!reducedMotion) {
    assert.equal(observation.previousPaint, observation.before);
    assert.deepEqual(observation.duration, [500, 500]);
    assert.deepEqual(observation.opacity, [.5, .5]);
    if (expectedPerspective) {
      await zoomIsoPaint(page, 2);
      const aligned = await surface.evaluate(scene => {
        const viewBoxes = layer => [...layer.querySelectorAll('[data-hp-live-viewbox="camera"]')]
          .map(svg => svg.getAttribute('viewBox'));
        return JSON.stringify(viewBoxes(scene.firstElementChild))
          === JSON.stringify(viewBoxes(scene.querySelector('[data-hp-retained-light]')));
      });
      assert.equal(aligned, true, 'the retained floor and walls follow the live camera during the fade');
    }
    await surface.evaluate(scene => {
      for (const layer of scene.children) for (const animation of layer.getAnimations()) animation.play();
    });
    await retained.waitFor({ state: 'detached' });
    assert.equal(await surface.evaluate(scene => getComputedStyle(scene.firstElementChild).opacity), '1');
  }
  console.log(`${expectedPerspective ? 'straight' : 'diagonal'} lamp ${observation.state}: ${reducedMotion ? 'reduced motion' : '500 ms fade'}`);
}

try {
  await toggle(false);
  await toggle(false);
  await clickHeaderAction(card, 'rotate-right');
  await page.waitForFunction(() =>
    window.__isoPaint.renderRoot.querySelector('.iso-scene-surface [data-hp-iso-perspective-floor]'));
  await settleIsoPaint(page);
  await toggle(true);
  await toggle(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__isoPaint._reducedMotion);
  await toggle(true, true);
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  await finish(browser);
} catch (error) {
  await browser.close();
  throw error;
}
