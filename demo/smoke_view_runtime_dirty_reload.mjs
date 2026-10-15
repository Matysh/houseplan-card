/** #848 AC4: reachable dirty-editor safety + actual browser recovery reload.
 * Native modality blocks the background Reload. Cancel/Discard belong to the
 * real form-close path, not a fabricated recovery-button/confirmation entry.
 * The defensive reload-resume callback is separately covered by pure units.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

requirePinnedBrowser('848-dirty-editor-runtime-reload');
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const live = manifest.files.find((file) => /\/live-interaction-runtime-[^/]+\.js$/.test(file.path));
assert.ok(live, 'real production live runtime exists in the manifest');
const { page, browser } = await launchColdView({ width: 1280, height: 960 });
const out = {}, trace = [], writes = [], documents = [];
const draftName = 'Unsaved Reload Guard 848';
const reloadSelector = 'houseplan-card [data-hp="view-runtime-reload"]';
const markerSelector = 'houseplan-card hp-dialog[data-kind="marker"]';
const confirmSelector = 'houseplan-card hp-confirm hp-dialog';
const settle = () => page.evaluate(() => window.__hpTest.settled());
const record = async (phase) => {
  const observed = await page.evaluate(() => {
    const c = window.__card, root = c.renderRoot;
    const button = root.querySelector('[data-hp="view-runtime-reload"]');
    const box = button?.getBoundingClientRect();
    const describe = (node) => ({ tag: node.tagName || node.nodeName, id: node.id || null,
      hp: node.getAttribute?.('data-hp'), kind: node.getAttribute?.('data-kind'),
      class: node.getAttribute?.('class') });
    const modals = [...root.querySelectorAll('hp-dialog')].map((dialog) => ({
      kind: dialog.getAttribute('data-kind'), connected: dialog.isConnected,
      nativeModal: !!dialog.shadowRoot?.querySelector('dialog:modal'),
      haShell: dialog.hasAttribute('ha-dialog-shell'),
    }));
    return {
      timeOrigin: performance.timeOrigin, url: location.href,
      navigationType: performance.getEntriesByType('navigation')[0]?.type,
      draft: root.querySelector('hp-dialog[data-kind="marker"] #marker-name')?.value ?? null,
      confirm: root.querySelector('hp-confirm')?.textContent?.trim() || null,
      modals, recovery: box && { x: box.x, y: box.y, width: box.width, height: box.height,
        visible: getComputedStyle(button).visibility, display: getComputedStyle(button).display,
        disabled: button.disabled,
        hitStack: root.elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2).map(describe) },
      inputs: [...(window.__dirtyRecoveryProof?.inputs || [])],
      savedMarkerNames: c._serverCfg.markers.map((marker) => marker.name),
    };
  });
  const item = { phase, observed, documents: [...documents], writes: [...writes] };
  trace.push(item);
  return observed;
};

try {
  await page.route(`**/${live.path.split('/').at(-1)}*`, (route) => route.fulfill({
    status: 404, contentType: 'text/javascript', body: 'controlled optional live root refusal',
  }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await installHpTestOnPage(page);
  await page.locator(reloadSelector).waitFor();
  await page.waitForFunction(() => window.__card._loadOk && !window.__card._booting);
  await settle();
  await page.exposeFunction('__recordDirtyRecoveryWrite', (message) => writes.push(message.type));
  await page.evaluate(() => {
    const c = window.__card;
    window.__dirtyRecoveryProof = { inputs: [] };
    c.renderRoot.addEventListener('click', (event) => {
      window.__dirtyRecoveryProof.inputs.push({ trusted: event.isTrusted,
        reload: event.composedPath().some((node) => node.getAttribute?.('data-hp') === 'view-runtime-reload'),
        path: event.composedPath().map((node) => ({ tag: node.tagName || node.nodeName,
          hp: node.getAttribute?.('data-hp'), kind: node.getAttribute?.('data-kind'),
          id: node.id || null, class: node.getAttribute?.('class') })) });
    }, { capture: true });
    const callWS = c.hass.callWS.bind(c.hass);
    c.hass = { ...c.hass, callWS: async (message) => {
      if (message.type === 'houseplan/config/set') await window.__recordDirtyRecoveryWrite(message);
      return callWS(message); // Preserve the original wire fixture and its actual persistence.
    } };
  });
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.locator('houseplan-card [data-hp="mode-tab"][data-mode="devices"]').click();
  await page.locator('houseplan-card [data-hp="tool"][data-tool="add-device"]').click();
  const name = page.locator(`${markerSelector} #marker-name`);
  await name.fill(draftName); await settle();
  const before = await record('real-dirty-marker-before-reload');
  assert.equal(before.draft, draftName);
  assert.equal(before.modals.filter((item) => item.kind === 'marker').length, 1);
  assert.equal(before.savedMarkerNames.includes(draftName), false);
  assert.equal(writes.length, 0);
  out.realEditorInputCreatesUnsavedDraft = true;

  const point = before.recovery;
  assert.ok(point && point.width > 0 && point.height > 0, 'recovery notice is actually laid out');
  // Deliberate real mouse input, no force/evaluate/synthetic click on an inert
  // element. The observed composedPath must prove which control received it.
  await page.mouse.click(point.x + point.width / 2, point.y + point.height / 2);
  await settle();
  const entered = await record('actual-reload-coordinate-input-path');
  assert.equal(entered.inputs.filter((input) => input.reload && input.trusted).length, 0,
    'native modality keeps the background recovery control inert');
  assert.equal(entered.draft, draftName);
  assert.equal(entered.timeOrigin, before.timeOrigin);
  assert.equal(documents.length, 0);
  assert.equal(writes.length, 0);
  assert.ok(entered.inputs.at(-1).trusted);
  assert.ok(entered.inputs.at(-1).path.some((node) => node.tag === 'DIALOG'),
    'the observed trusted click belongs to the real native modal, not a private recovery call');
  out.nativeModalBlocksBackgroundReloadWithoutLosingDraft = true;

  // Use the reachable user path: close the dirty form through its own ordinary
  // discard decision. This does not claim GUI execution of the defensive
  // guardedViewRuntimeReload resume branch while a modal is already open.
  await page.keyboard.press('Escape');
  await page.locator(confirmSelector).waitFor();
  assert.equal(documents.length, 0, 'no navigation before the real discard decision');
  await page.locator(`${confirmSelector} [data-hp="dialog-cancel"]`).last().click();
  await settle();
  const cancelled = await record('cancel-keeps-draft');
  assert.equal(cancelled.draft, draftName);
  assert.equal(documents.length, 0);
  assert.equal(writes.length, 0);
  assert.equal(cancelled.timeOrigin, before.timeOrigin);
  out.realFormCloseCancelPreservesDraftWithoutReloadOrWrite = true;

  await page.keyboard.press('Escape');
  await page.locator(confirmSelector).waitFor();
  await record('real-discard-before-choice');
  await page.locator(`${confirmSelector} [data-hp="dialog-confirm"]`).click();
  await page.locator(markerSelector).waitFor({ state: 'detached' });
  await settle();
  const closed = await record('explicit-form-discard-before-recovery');
  assert.equal(closed.draft, null);
  assert.equal(closed.savedMarkerNames.includes(draftName), false);
  assert.equal(documents.length, 0);
  assert.equal(writes.length, 0);
  assert.equal(closed.timeOrigin, before.timeOrigin);
  out.realFormDiscardClosesWithoutSavingOrReloading = true;

  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.locator(reloadSelector).click(),
  ]);
  await installHpTestOnPage(page);
  await page.waitForFunction(() => window.__card?._loadOk && !window.__card?._booting);
  await settle();
  const discarded = await record('discard-actual-document-reload');
  assert.equal(documents.length, 1, 'one real document reload from the now reachable recovery button');
  assert.equal(discarded.navigationType, 'reload', 'the browser confirms an actual reload, not a simulated callback');
  assert.notEqual(discarded.timeOrigin, before.timeOrigin);
  assert.equal(discarded.draft, null);
  assert.equal(discarded.savedMarkerNames.includes(draftName), false);
  assert.equal(writes.length, 0, 'Discard never saves the draft');
  out.realRecoveryReloadAfterDiscardNavigatesOnceWithoutPersistingDraft = true;
  checkAll(out);
  mkdirSync('artifacts/848-dirty-reload', { recursive: true });
  writeFileSync('artifacts/848-dirty-reload/reachable.json', JSON.stringify({ out, trace }, null, 2));
  await finish(browser);
} catch (error) {
  await record('failure').catch(() => {});
  const diagnostic = { error: String(error), out, trace };
  mkdirSync('artifacts/848-dirty-reload', { recursive: true });
  writeFileSync('artifacts/848-dirty-reload/reachable.json', JSON.stringify(diagnostic, null, 2));
  console.log('diagnostic real-dirty-runtime-reload', JSON.stringify(diagnostic));
  await browser.close(); throw error;
}
