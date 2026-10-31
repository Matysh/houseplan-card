#!/usr/bin/env node
// #1146: rare-state comparison frames, not lifecycle acceptance or golden accept.
// Native input/public HA ports, with one declared recovery-controller fixture.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { launchColdView, launchPanelCold, captureUiKitSurface, finish } from './serve.mjs';
import { mountFirstSpace } from './helpers/first-space.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';

process.env.HP_UI_KIT_CAPTURE_DIR ||= resolve('artifacts/ui-kit-capture');
const { values } = parseArgs({ options: { width: { type: 'string' }, theme: { type: 'string' } } });
const themes = values.theme ? [values.theme] : ['light', 'dark'];
const widths = values.width ? [Number(values.width)] : [1280, 1024, 390];
assert.ok(themes.every(theme => ['light', 'dark'].includes(theme)) && widths.every(width => Number.isInteger(width) && width >= 320));
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtime = manifest.files.find(file => /houseplan-editor-runtime-[^/]+\.js$/.test(file.path));
assert.ok(runtime);
for (const theme of themes) for (const width of widths) {
  // waitForCard=false: observe cold entry before the ordinary launch helper
  // waits for the veil to leave. Every context starts without persisted data.
  const { page, browser } = await launchColdView({ width, height: 1000 }, 1, [], {}, undefined, undefined, undefined, false);
  try {
    await captureUiKitSurface(page, 'boot-loading-states', 'houseplan-card .bootveil');
    await assertFreshDemoBundle(page);
    await page.waitForFunction(() => window.__card?._loadOk && !window.__card._booting && window.__card._continuity.hasCompleteFrame);
    await page.evaluate(async theme => {
      const card = window.__card, events = new EventTarget();
      window.__uiKitEvents = events;
      card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: theme === 'dark' },
        connection: { ...card.hass.connection, addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events) } };
      await window.__hpTest.settled();
      const previous = card._continuity;
      previous.dispose();
      // private-ok: #1146 comparison-only fixture for the no-complete-frame
      // branch, unreachable from a settled smoke's cached plan. Replace the
      // owned controller with a fresh instance of the actual production class;
      // native HA disconnect/ready events still drive its timers and DOM. This
      // frame is not evidence of reachability, recovery or user acceptance.
      card._continuity = new previous.constructor(() => card.requestUpdate());
      events.dispatchEvent(new Event('disconnected'));
    }, theme);
    await captureUiKitSurface(page, 'continuity-recovery-overlay', 'houseplan-card .recoveryoverlay');
    await page.evaluate(() => window.__uiKitEvents.dispatchEvent(new Event('ready')));
    await page.locator('houseplan-card .recoveryoverlay').waitFor({ state: 'hidden' });
    let releaseChunk; const heldChunk = new Promise(resolve => { releaseChunk = resolve; });
    await page.route(`**/${runtime.path.split('/').at(-1)}*`, async route => { await heldChunk; await route.fallback(); });
    const card = page.locator('houseplan-card');
    if (await card.locator('[data-hp="mode-tab"][data-mode="plan"]').isVisible())
      await card.locator('[data-hp="mode-tab"][data-mode="plan"]').click();
    else {
      await card.locator('[data-hp="header-menu"]').click();
      await card.locator('[data-hp="header-menu-item"][data-id="mode-plan"]').click();
    }
    await captureUiKitSurface(page, 'editor-loading', 'houseplan-card .editorloading');
    releaseChunk();
    await card.locator('[data-hp="toolbar"][data-kind="plan"]').waitFor();
  } finally { await finish(browser); }

  const first = await launchPanelCold({ width, height: 1000 });
  try {
    await mountFirstSpace(first.page);
    await first.page.locator('houseplan-card').evaluate((card, theme) => {
      card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: theme === 'dark' } };
    }, theme);
    const floors = first.page.locator('hp-dialog[data-kind="import"]');
    await floors.locator('[data-action="import-manual"]').click();
    const onboarding = first.page.locator('hp-dialog[data-kind="onboarding"]'); await onboarding.waitFor();
    await captureUiKitSurface(first.page, 'onboarding-space-dialog', 'hp-dialog[data-kind="onboarding"]');
    await onboarding.locator('input[name="plansrc"][data-value="file"]').check();
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200002710000027100802000000000000000000000049454e4400000000', 'hex');
    await onboarding.locator('[data-hp="image-upload"]').setInputFiles({ name: 'large-synthetic.png', mimeType: 'image/png', buffer: png });
    await first.page.waitForFunction(() => !!window.__card._backdropGuard);
    const guard = first.page.locator('hp-dialog[data-kind="decor"]');
    if (await guard.count()) {
      await captureUiKitSurface(first.page, 'onboarding-backdrop-guard', 'hp-dialog[data-kind="decor"]');
      await guard.locator('[data-hp="dialog-cancel"]').click();
      assert.equal(await onboarding.isVisible(), true);
    } else {
      // #1147 owns the empty-plan render path. Preserve a visible baseline of
      // its existing omission; this is a missing-surface witness, never a pass
      // or a screenshot of the expected guard. After migration the branch
      // above must run, and #1147's regression smoke must require that dialog.
      const name = `onboarding-backdrop-guard-missing-before-${theme}-${width}`;
      await first.page.screenshot({ path: resolve(process.env.HP_UI_KIT_CAPTURE_DIR, name + '.png') });
      writeFileSync(resolve(process.env.HP_UI_KIT_CAPTURE_DIR, name + '.json'), JSON.stringify({
        surface: 'onboarding-backdrop-guard', status: 'missing-before-1147', theme, width,
        expected: 'hp-dialog[data-kind="decor"]', observed: 'guard state exists; guard dialog absent on empty-plan render path',
        frame: name + '.png', acceptance: false,
      }, null, 2) + '\n');
      console.log(`MISSING before #1147: onboarding backdrop guard ${theme}/${width}`);
    }
  } catch (error) {
    console.log('onboarding capture diagnostics', JSON.stringify(await first.page.evaluate(() => {
      const c=window.__card;
      return {source:c._spaceDialog?.source,guard:!!c._backdropGuard,toast:c._toast,
        onboarding:!!c._onboardingRuntime,editor:!!c._editorRuntime,
        dialogs:[...c.renderRoot.querySelectorAll('hp-dialog')].map(d=>({kind:d.dataset.kind,rects:d.getClientRects().length,title:d.title}))};
    })));
    throw error;
  } finally { await finish(first.browser); }
  console.log(`CAPTURE COMPLETE ${theme}/${width}`);
}
