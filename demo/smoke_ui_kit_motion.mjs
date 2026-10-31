// #1147: read real painted animation frames; no suppression or API patching.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchHaDialogFixture, applyHaDialogTypography } from './helpers/ha-dialog-fixture.mjs';
import { ensureHarnessEditorRuntime } from './editor-runtime-compat.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { finish, watchPage } from './serve.mjs';

const native = process.argv.includes('--native'), results = [];
// CSS puts the timing function on its keyframes; WAAPI puts it on the effect.
const easingOf = frame => frame.timing.easing === 'linear' ? frame.keyframes[0]?.easing : frame.timing.easing;
const fixture = await launchHaDialogFixture({ authentic: !native, viewport: { width: 1280, height: 900 }, extraModules: ['16213'] });
const { page, browser } = fixture; watchPage(page);
const probe = async () => page.evaluate(() => {
  const data = window.__uiMotionProbe = { phase: 'open', frames: [], frame: 0 };
  const seen = new WeakSet();
  const sample = root => {
    for (const element of root.querySelectorAll('*')) {
      const owner = element.getRootNode().host?.localName;
      if ((owner === 'wa-dialog' && element.matches('[part~="dialog"]'))
        || (owner === 'hp-dialog' && element.matches('.surface'))) {
        for (const animation of element.getAnimations()) {
          if (seen.has(animation)) continue; seen.add(animation);
          data.frames.push({ phase: data.phase, owner, name: animation.animationName || 'WAAPI',
            timing: animation.effect.getTiming(), keyframes: animation.effect.getKeyframes() });
        }
      }
      if (element.shadowRoot) sample(element.shadowRoot);
    }
  };
  const tick = () => { sample(document); data.frame = requestAnimationFrame(tick); };
  data.frame = requestAnimationFrame(tick);
});
const stop = async () => page.evaluate(() => {
  const data = window.__uiMotionProbe; cancelAnimationFrame(data.frame); return data.frames;
});
try {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture.url + '/product.html');
    if (!native) await applyHaDialogTypography(page);
    await page.waitForFunction(() => window.__card?._booting === false && window.__card._devices?.length > 0);
    await assertFreshDemoBundle(page, fileURLToPath(new URL('..', import.meta.url)));
    await page.evaluate(ensureHarnessEditorRuntime); await installHpTestOnPage(page);
    const open = async () => {
      const settings = page.locator('houseplan-card [data-hp="settings"]');
      if (await settings.isVisible()) await settings.click();
      else {
        await page.locator('houseplan-card [data-hp="header-menu"]').click();
        await page.locator('[data-hp="header-menu-item"][data-id="settings"]').click();
      }
    };
    for (const reduced of [false, true]) {
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await probe(); await open();
      const dialog = page.locator('hp-dialog[data-kind="settings"]');
      await dialog.locator('dialog').waitFor({ state: 'visible' });
      await dialog.locator('dialog').evaluate(async element => {
        await Promise.allSettled(element.getAnimations({ subtree: true })
          .filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished));
      });
      await page.evaluate(() => { window.__uiMotionProbe.phase = 'close'; });
      await dialog.locator('button.close').click(); await dialog.waitFor({ state: 'detached' });
      const frames = await stop();
      const visible = frames.filter(frame => frame.name === 'hp-ui-appear');
      const leave = frames.filter(frame => frame.phase === 'close' && frame.timing.direction !== 'reverse');
      if (reduced) assert.equal(frames.filter(frame => frame.timing.duration > 0).length, 0, JSON.stringify(frames));
      else {
        assert.ok(visible.length, 'first visible native/fallback modal frame must use the Kit entry');
        assert.ok(visible.every(frame => frame.timing.duration === 180 && easingOf(frame) === 'ease-out'
          && /-10px/.test(frame.keyframes[0].translate)), JSON.stringify(visible));
        assert.ok(!frames.some(frame => frame.keyframes.some(keyframe => keyframe.scale && keyframe.scale !== '1')), 'native scale must not paint before Kit motion');
        assert.ok(leave.some(frame => frame.timing.duration === 140 && easingOf(frame) === 'ease'
          && String(frame.keyframes.at(-1).opacity) === '0'), JSON.stringify(leave));
        assert.ok(leave.every(frame => frame.keyframes.every(keyframe => keyframe.translate === frame.keyframes[0].translate)), 'close changes opacity only: ' + JSON.stringify(leave));
      }
      results.push({ width, native, reduced, frames });
    }
  }
  await fixture.assertClean();
  mkdirSync('artifacts/ui-kit-view-1147', { recursive: true });
  writeFileSync(`artifacts/ui-kit-view-1147/motion-${native ? 'native' : 'ha'}.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ profiles: results.length, native, motion: 'PASS' }));
} finally { await finish(browser); await fixture.close(); }
