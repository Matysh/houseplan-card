import assert from 'node:assert/strict';
import { launchPanelCold, finish, check } from './serve.mjs';
import { mountFirstSpace } from './helpers/first-space.mjs';

const sessions = [], out = {};
const empty = page => page.locator('[data-hp=empty] hp-plan-converter-info');
const floors = page => page.locator('hp-dialog[data-kind=import]');
const writes = page => page.evaluate(() => window.firstSpaceFixture.calls.filter(m =>
  /houseplan\/(config\/set|layout\/(set|update|delete))/.test(m.type)).length);
async function start(options = {}) {
  const s = await launchPanelCold({ width: options.width || 1040, height: 900 }); sessions.push(s);
  s.requests = []; s.page.on('request', r => s.requests.push(r.url()));
  await mountFirstSpace(s.page, options); return s;
}
try {
  {
    const s = await launchPanelCold(); sessions.push(s);
    await s.page.route('**/hp-plan-converter-info-*.js', route => route.abort());
    await mountFirstSpace(s.page, { waitHint: false });
    await floors(s.page).waitFor();
    await floors(s.page).locator('input[type=checkbox]').first().uncheck();
    await floors(s.page).locator('input[type=checkbox]').last().uncheck();
    assert.ok(await floors(s.page).locator('[data-hp=dialog-confirm]').isDisabled());
    await floors(s.page).locator('[data-action=import-manual]').click();
    await s.page.locator('hp-dialog[data-kind=onboarding]').waitFor();
    assert.equal(await writes(s.page), 0);
    out.failedHintRetainsFloorWorkflow = true;
  }
  for (const options of [{ writer: false, admin: false }, { writer: false }, { storage: false }, { transport: false },
    { writer: false, kiosk: true }]) {
    const { page, requests } = await start(options);
    assert.equal(await page.locator('[data-hp=create-space], [data-hp=import-backup]').count(), 0);
    assert.equal(await floors(page).count(), 0);
    assert.equal(await empty(page).count(), 1);
    assert.ok(!requests.some(url => /houseplan-editor-runtime|houseplan-onboarding-runtime|settings-dialogs|hp-settings-select/.test(url)),
      'passive information must not load the editor/settings graph');
    assert.equal(await writes(page), 0);
  }
  out.rightsStorageAndKiosk = true;
  {
    // A registered custom element can upgrade even when its boundary never
    // becomes ready. Exercise the observable recovery path, not merely its
    // presence: informational retry must work without a writable HA context.
    const s = await launchPanelCold(); sessions.push(s);
    const attempts = [];
    await s.page.route('**/hp-plan-converter-info-*.js*', route => {
      const query = new URL(route.request().url()).search; attempts.push(query);
      return query ? route.fallback() : route.fulfill({ status: 404, body: 'ordinary unavailable information module' });
    });
    await mountFirstSpace(s.page, { transport: false, waitHint: false });
    const notice = s.page.locator('[data-hp="view-runtime-notice"]');
    await notice.locator('[data-hp="view-runtime-retry"]').click();
    await empty(s.page).locator('a').waitFor();
    await notice.waitFor({ state: 'detached' });
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0], ''); assert.ok(attempts[1]);
    assert.equal(await writes(s.page), 0);
    out.informationalRecoveryWithoutWriteTransport = true;
  }
  const { page, requests } = await start();
  await floors(page).waitFor();
  const selected = floors(page).locator('input[type=checkbox]');
  await selected.first().uncheck(); await selected.last().uncheck();
  assert.ok(await floors(page).locator('[data-hp=dialog-confirm]').isDisabled());
  await selected.last().check();
  assert.match(await floors(page).locator('[data-hp=dialog-confirm]').innerText(), /1/);
  const before = await writes(page);
  const anchor = floors(page).locator('hp-plan-converter-info a');
  assert.equal(await anchor.getAttribute('href'), 'https://houseplan.tech/convert/');
  assert.equal(await anchor.getAttribute('target'), '_blank');
  assert.equal(await anchor.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(!requests.some(url => url.startsWith('https://houseplan.tech/convert/')), 'no converter prefetch');
  await page.context().route('https://houseplan.tech/convert/**', route => route.fulfill({ body: 'Synthetic converter destination' }));
  const popupPromise = page.waitForEvent('popup'); await anchor.focus(); await page.keyboard.press('Enter');
  const popup = await popupPromise; await popup.waitForLoadState();
  assert.equal(popup.url(), 'https://houseplan.tech/convert/'); await popup.close();
  assert.ok(await selected.last().isChecked()); assert.ok(!await selected.first().isChecked());
  assert.equal(await writes(page), before);
  out.nativeLinkRetainsSelection = true;
  await page.locator('hp-plan-converter-info').evaluateAll(elements => {
    for (const element of elements) element.formats = [...element.formats, { name: 'Extra format', extensions: ['.extra'] }];
  });
  await page.waitForFunction(() => [...window.__card.renderRoot.querySelectorAll('hp-plan-converter-info')]
    .every(e => e.shadowRoot.querySelector('p').textContent.includes('Extra format (.extra)')));
  const texts = await page.locator('hp-plan-converter-info p').allTextContents();
  assert.equal(texts.length, 2); assert.equal(texts[0], texts[1]);
  out.bothPresentationsProjectFutureFormat = true;
  await floors(page).locator('button.close').click(); await floors(page).waitFor({ state: 'detached' });
  assert.ok(await empty(page).isVisible());
  await page.locator('[data-hp=create-space]').click();
  await page.locator('hp-dialog[data-kind=onboarding]').waitFor();
  await page.locator('hp-dialog[data-kind=onboarding] button.close').click();
  assert.ok(await empty(page).isVisible());
  out.cancelRetainsEmptyHint = true;
  // Ordinary backend subscription inputs: a restored/created plan hides the hint;
  // deletion of the last space restores it, with no first-visit storage flag.
  for (const spaces of [[{ id: 'restored', title: 'Restored', rooms: [] }], []]) {
    await page.evaluate(spaces => {
      const f = window.firstSpaceFixture; f.config.spaces = spaces;
      let rev; do { rev = window.__pushServerConfig(f.config); } while (rev <= window.__card._cfgRev);
    }, spaces);
    await page.waitForFunction(n => window.__card._model.length === n, spaces.length);
    assert.equal(await empty(page).count(), spaces.length ? 0 : 1);
  }
  out.currentEmptyLifecycle = true;
  for (const language of ['en', 'ru', 'de', 'fr']) {
    const s = await start({ writer: false, admin: false, language, width: 320 });
    const info = empty(s.page); await info.locator('a').waitFor();
    await s.page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await info.locator('a').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    const first = await info.locator('p').innerText();
    assert.ok(first.includes('Sweet Home 3D (.sh3d)') && first.includes('Easy Floorplan (YAML / JSON)'));
    await info.evaluate(e => { e.formats = [...e.formats, { name: 'Very long future format with a descriptive name', extensions: ['.extra', '.second'] }]; });
    await s.page.waitForFunction(() => window.__card.renderRoot.querySelector('hp-plan-converter-info').shadowRoot.textContent.includes('.extra'));
    const size = await info.evaluate(e => ({ w: e.clientWidth, content: e.scrollWidth, h: e.offsetHeight }));
    assert.ok(size.w <= 320 && size.content <= size.w && size.h > 42, JSON.stringify(size));
    assert.equal(await writes(s.page), 0);
  }
  out.fourLocalesAndFutureFormatsWrap = true;
  for (const [key, value] of Object.entries(out)) check(key, value);
} finally {
  for (const session of sessions) await finish(session.browser, out);
}

