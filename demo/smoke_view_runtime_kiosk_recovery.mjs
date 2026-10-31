/** #848 AC5 + accepted #894: optional-code failure uses the existing camera,
 * safety and session claim through a real browser document reload.
 * Public fixture/options and native input only; no private recovery seeding.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

requirePinnedBrowser('848 terminal View failure enlarged kiosk recovery');
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const live = manifest.files.find((file) => /\/live-interaction-runtime-[^/]+\.js$/.test(file.path));
assert.ok(live, 'manifest identifies the actual optional live root');
const source = readFileSync('demo/srv/demo.html', 'utf8');
const storeAnchor = 'const server=createFixtureStore(CFG,LAYOUT,';
const optionsAnchor = "card.setConfig({type:'custom:houseplan-card', title:'House Plan', icon_size:3.4});";
for (const anchor of [storeAnchor, optionsAnchor]) assert.equal(source.split(anchor).length, 2);
// #896: each new document constructs its actual wire store from this seed.
const boot = source.replace(storeAnchor,
  "const server=createFixtureStore(JSON.parse(sessionStorage.getItem('hp848-server'))||CFG,LAYOUT,")
  .replace(optionsAnchor, "card.setConfig(JSON.parse(sessionStorage.getItem('hp848-options')));");
const ATTEMPT = 'houseplan-card:version-reload-target:v1';
const { page, browser } = await launchColdView({ width: 1000, height: 850 });
const cdp = await page.context().newCDPSession(page);
const out = {}, trace = [], documents = [], requests = [];
const retry = () => page.locator('houseplan-card [data-hp="view-runtime-retry"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const ready = () => page.waitForFunction(() => {
  const c = window.__card;
  return c?._loadOk && c._continuity.state === 'steady' && !c._loading && !c._booting;
});
const sample = async (phase) => {
  const state = await page.evaluate((key) => {
    const c = window.__card;
    return { timeOrigin: performance.timeOrigin,
      documentProbe: !!window.__hp848DocumentProbe,
      navigation: performance.getEntriesByType('navigation')[0]?.type,
      space: c._space, zoom: c._zoom, view: { ...c._view },
      pause: c._cyclePausedUntil, now: Date.now(), pointers: c._pointers.size,
      pan: !!c._panStart, touches: c._touchContacts.size,
      notice: !!c.renderRoot.querySelector('[data-hp="view-runtime-notice"]'),
      retry: !!c.renderRoot.querySelector('[data-hp="view-runtime-retry"]'),
      reload: !!c.renderRoot.querySelector('[data-hp="view-runtime-reload"]'),
      claim: sessionStorage.getItem(key),
      memos: Object.keys(sessionStorage).filter((name) => name.startsWith('houseplan_kiosk_recovery_v1:')),
      editor: !!c._editorRuntime, dialogs: c.renderRoot.querySelectorAll('hp-dialog').length,
    };
  }, ATTEMPT);
  trace.push({ phase, state, documents: [...documents], requests: [...requests] });
  return state;
};
const terminal = async () => {
  await retry().click();
  await page.waitForFunction(() => window.__card._viewRuntimes.live.terminalFailure);
  assert.equal(await retry().count(), 0);
};

try {
  await page.evaluate(async () => {
    const c = window.__card;
    await window.__hpTest.waitForWrites();
    await window.__hpTest.switchSpace('garden');
    sessionStorage.setItem('hp848-server', JSON.stringify(c._serverCfg));
    sessionStorage.setItem('hp848-options', JSON.stringify({ ...c._config, kiosk: true, cycle: 0 }));
  });
  await page.route('**/demo.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: boot }));
  await page.route(`**/${live.path.split('/').at(-1)}*`, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 404, contentType: 'text/javascript', body: 'controlled same-build optional root refusal' });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await installHpTestOnPage(page); await ready(); await retry().waitFor();
  await page.evaluate(() => window.__hpUiCapture?.('view-runtime-notice', '[data-hp="view-runtime-notice"]'));
  await settle();
  const stage = await page.locator('houseplan-card .stage').boundingBox();
  assert.ok(stage && stage.width > 0 && stage.height > 0);
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  for (let step = 0; step < 7; step++) {
    await page.mouse.wheel(0, -100); await page.waitForTimeout(180);
  }
  await page.mouse.move(stage.x + 20, stage.y + 20); await page.mouse.down();
  await page.mouse.move(stage.x + 75, stage.y + 60, { steps: 4 }); await page.mouse.up();
  await settle();
  const before = await sample('enlarged-native-camera');
  assert.equal(before.space, 'garden'); assert.ok(before.zoom > 2);
  assert.equal(before.claim, null, 'a retryable failure did not consume the existing reload quota');
  out.realCycleZeroKioskStartsEnlargedOnSelectedFloor = true;

  await page.clock.install();
  await page.evaluate(() => { window.__hp848DocumentProbe = 'before-automatic-reload'; });
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) documents.push(frame.url()); });
  await terminal();
  await page.clock.runFor(1000);
  assert.equal(documents.length, 0, 'the existing interaction pause blocks terminal failure recovery');
  const paused = await sample('terminal-pause');
  assert.equal(paused.claim, null); assert.equal(paused.notice, true);
  out.terminalFailureWaitsForExistingInteractionPause = true;

  // A genuine pan remains unsafe even after the whole pause expires. Move
  // beyond the ordinary pan threshold and return: an unmoved empty-stage
  // press legitimately opens the kiosk size popover after its hold deadline.
  await page.mouse.move(stage.x + 20, stage.y + 20); await page.mouse.down();
  await page.mouse.move(stage.x + 40, stage.y + 40, { steps: 3 });
  await page.mouse.move(stage.x + 20, stage.y + 20, { steps: 3 });
  await settle();
  const held = await sample('held-native-contact');
  assert.ok(held.pointers > 0 || held.pan || held.touches > 0, 'real input entered an existing gesture guard');
  await page.clock.runFor(61000);
  assert.equal(documents.length, 0);
  const elapsed = await sample('pause-elapsed-contact-still-held');
  assert.equal(elapsed.claim, null);
  assert.ok(elapsed.pointers > 0 && elapsed.pan, 'the actual pan owner is still held after 61 seconds');
  assert.equal(elapsed.dialogs, 0, 'no long-press dialog substitutes for the contact safety guard');
  out.realHeldContactBlocksReloadAfterPauseExpires = true;
  await page.mouse.up(); await settle();
  await Promise.all([
    page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()),
    page.clock.runFor(61000),
  ]);
  await page.waitForFunction(() => window.__card?._loadOk);
  await installHpTestOnPage(page); await ready(); await retry().waitFor(); await settle();
  const after = await sample('one-actual-document-reload');
  assert.equal(documents.length, 1);
  // Playwright's installed clock keeps one mocked timeOrigin across reloads.
  // The actual frame navigation and lost document-local sentinel prove a new
  // document without depending on that mocked value. The clock also replaces
  // performance entries; read the browser's native navigation history instead.
  assert.equal(elapsed.documentProbe, true);
  assert.equal(after.documentProbe, false);
  const history = await cdp.send('Page.getNavigationHistory');
  const transition = history.entries[history.currentIndex].transitionType;
  trace.push({ phase: 'browser-native-navigation', transition });
  assert.equal(transition, 'reload');
  assert.equal(after.space, before.space);
  assert.ok(Math.abs(after.zoom - before.zoom) < 1e-6);
  for (const key of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(after.view[key] - before.view[key]) < 1e-4,
    `real document recovery preserves camera ${key}`);
  assert.ok(after.claim, 'the existing build/session attempt was durably consumed');
  assert.equal(after.memos.length, 0, 'only this placement camera memo was consumed once');
  assert.equal(after.editor, false); assert.equal(after.dialogs, 0);
  out.terminalFailureUsesOneActualReloadAndPreservesExactCamera = true;

  await terminal(); await page.clock.runFor(61000);
  const again = await sample('same-build-second-terminal');
  assert.equal(documents.length, 1); assert.equal(again.claim, after.claim);
  assert.equal(again.notice, true); assert.equal(again.retry, false); assert.equal(again.reload, true);
  out.sameBuildSecondFailureKeepsReloadOnlyWithoutAnotherAttempt = true;

  await page.evaluate(() => {
    const old = window.__card, parent = old.parentNode, config = old._config, hass = old.hass;
    old.remove();
    const current = document.createElement('houseplan-card'); current.setConfig(config); current.hass = hass;
    window.__card = current; parent.appendChild(current);
  });
  await ready(); await retry().waitFor(); await terminal(); await page.clock.runFor(61000);
  const warm = await sample('same-session-warm-remount');
  assert.equal(documents.length, 1); assert.equal(warm.claim, after.claim);
  assert.equal(warm.notice, true); assert.equal(warm.reload, true); assert.equal(warm.retry, false);
  out.warmRemountCannotRenewTheSharedReloadClaim = true;
  checkAll(out);
  mkdirSync('artifacts/848-final', { recursive: true });
  writeFileSync('artifacts/848-final/kiosk-native.json', JSON.stringify({ fingerprint: manifest.fingerprint, out, trace }, null, 2));
  await finish(browser);
} catch (error) {
  await sample('failure').catch(() => {});
  mkdirSync('artifacts/848-final', { recursive: true });
  writeFileSync('artifacts/848-final/kiosk-native.json', JSON.stringify({ fingerprint: manifest.fingerprint,
    error: String(error), out, trace }, null, 2));
  console.log('diagnostic optional-kiosk-recovery', JSON.stringify({ error: String(error), out, trace }));
  await browser.close(); throw error;
}
