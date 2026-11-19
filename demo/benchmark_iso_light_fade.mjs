import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { page, browser } = await startIsoPaintScene({ width: 1920 });
const root = 'houseplan-card .iso-scene-surface';
const output = process.env.HP_ISO_LIGHT_OUTPUT;
const snap = async (label) => {
  if (!output) return;
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: output + '/' + label + '.png' });
};
const toggle = () => page.evaluate(async () => {
  const card = window.__isoPaint;
  const eid = Object.keys(card.hass.states).find(id => id.startsWith('light.'));
  const state = card.hass.states[eid];
  card.hass = { ...card.hass, states: { ...card.hass.states,
    [eid]: { ...state, state: state.state === 'on' ? 'off' : 'on' } } };
  await card.updateComplete;
  return eid;
});

try {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await zoomIsoPaint(page, 2.18);
  await snap('before');
  const eid = await toggle();
  await page.waitForFunction(() => {
    const pair = window.__isoPaint.renderRoot.querySelector('.iso-scene-surface');
    return pair?.hasAttribute('data-hp-light-mixing')
      && [...pair.children].every(svg => svg.getAnimations().length === 1);
  });
  const mid = await page.evaluate((eid) => {
    const shadow = window.__isoPaint.renderRoot;
    const pair = shadow.querySelector('.iso-scene-surface');
    const [front, old] = pair.children;
    const animations = [...pair.children].flatMap(svg => svg.getAnimations());
    for (const animation of animations) { animation.pause(); animation.currentTime = 250; }
    const active = svg => !!svg.querySelector(`.glow-spot[data-glow-source="${eid}"]`);
    const ids = [...pair.querySelectorAll('[id]')].map(node => node.id);
    return {
      frames: pair.children.length,
      oneOfEachState: active(old) !== active(front),
      ownIds: new Set(ids).size === ids.length,
      oldInert: old.hasAttribute('inert') && old.getAttribute('aria-hidden') === 'true',
      blend: [...pair.children].map(svg => getComputedStyle(svg).mixBlendMode),
      opacity: [...pair.children].map(svg => +getComputedStyle(svg).opacity),
      duration: animations.map(animation => animation.effect.getTiming().duration),
      architecture: [...pair.children].every(svg => svg.querySelector('.iso-wall-top')
        && svg.querySelector('.iso-tile-shadow') && !svg.querySelector('foreignObject')),
    };
  }, eid);
  assert.deepEqual(mid, {
    frames: 2, oneOfEachState: true, ownIds: true, oldInert: true,
    blend: ['plus-lighter', 'plus-lighter'], opacity: [.5, .5], duration: [500, 500], architecture: true,
  });
  await snap('midpoint');
  const stage = await page.locator('houseplan-card .stage').first().boundingBox();
  assert.ok(stage);
  await page.mouse.move(stage.x + 50, stage.y + 100);
  await page.mouse.down();
  await page.mouse.move(stage.x + 200, stage.y + 160, { steps: 6 });
  assert.ok(await page.locator(root).evaluate(pair => {
    const [front, old] = pair.children;
    return front.style.transform === old.style.transform
      && front.getAttribute('viewBox') === old.getAttribute('viewBox')
      && front.getAnimations()[0].currentTime === 250;
  }));
  await page.mouse.up();
  const beforeWheel = await page.locator(root + ' > svg').first().getAttribute('viewBox');
  await page.mouse.move(stage.x + stage.width * .88, stage.y + stage.height * .66);
  for (let step = 0; step < 8; step++) {
    await page.mouse.wheel(0, 80);
    assert.ok(await page.locator(root).evaluate(pair => {
      const [front, old] = pair.children;
      return front.getAttribute('viewBox') === old.getAttribute('viewBox')
        && front.getAnimations()[0].currentTime === 250 && old.getAnimations()[0].currentTime === 250
        && !!front.querySelector('.iso-wall-top') && !!old.querySelector('.iso-wall-top');
    }));
  }
  await page.waitForFunction(({ before }) => {
    const scene = window.__isoPaint.renderRoot.querySelector('.iso-scene-surface');
    return scene?.firstElementChild?.getAttribute('viewBox') !== before;
  }, { before: beforeWheel });
  await toggle();
  assert.ok(await page.locator(root).evaluate(pair => {
    return pair.children.length === 2 && [...pair.children].every(svg => svg.getAnimations()[0].currentTime === 250);
  }));
  await page.locator(root).evaluate(pair => {
    for (const svg of pair.children) svg.getAnimations()[0].play();
  });
  await page.waitForFunction(() => window.__isoPaint.renderRoot.querySelector('[data-hp-retained-light]'));
  await page.locator(root).locator('[data-hp-retained-light]').waitFor({ state: 'detached' });
  await snap('latest');
  assert.equal(await page.locator(root + ' > svg').count(), 1);
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  console.log(JSON.stringify(mid));
} finally {
  await browser.close();
}
