// #1154: the original HA shell's asynchronous removal must not close its successor.
// Uses the pinned genuine HA component, synthetic data and no HA server.
import assert from 'node:assert/strict';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { launchHaDialogFixture } from './helpers/ha-dialog-fixture.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

const fixture = await launchHaDialogFixture({ authentic: true, viewport: { width: 1280, height: 900 } });
const { page } = fixture;
const space = 'hp-dialog[data-kind="space"]';
const results = {};
try {
  await page.goto(`${fixture.url}/product.html`);
  await page.waitForFunction(() => window.__card?._serverCfg?.spaces?.length > 0);
  await assertFreshDemoBundle(page);
  await installHpTestOnPage(page);
  await page.evaluate(() => {
    const card = window.__card;
    const callWS = card.hass.callWS.bind(card.hass);
    window.__copy1154 = { writes: [], retiredCloses: 0 };
    card.hass = { ...card.hass, callWS: async (message) => {
      if (['houseplan/config/set', 'houseplan/plan/optimize'].includes(message.type)) {
        window.__copy1154.writes.push(message.type);
      }
      return callWS(message);
    } };
  });
  await page.evaluate(() => window.__hpTest.openSpaceDialog('edit', window.__card._space));
  for (const cancel of ['Escape', 'Cancel']) {
    await page.locator(`${space} [data-action="space-copy"]`).waitFor();
    await page.evaluate(() => {
      const old = window.__card.shadowRoot.querySelector('hp-dialog[data-kind="space"]');
      window.__copy1154.old = old;
      old.addEventListener('hp-close', () => { if (!old.isConnected) window.__copy1154.retiredCloses++; });
    });
    await page.locator(`${space} [data-action="space-copy"]`).click();
    await page.evaluate(async () => {
      const old = window.__copy1154.old;
      await old.updateComplete;
      await old.shadowRoot.querySelector('ha-dialog').updateComplete;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const state = await page.evaluate(() => {
      const card = window.__card;
      const shell = card.shadowRoot.querySelector('hp-dialog[data-kind="space"]');
      return { copy: Boolean(card._spaceDialog?.copy), input: Boolean(shell?.querySelector('#space-copy-name')),
        modal: Boolean(shell?.shadowRoot.querySelector('ha-dialog')?.shadowRoot
          .querySelector('wa-dialog')?.shadowRoot.querySelector('dialog')?.matches(':modal')),
        retiredCloses: window.__copy1154.retiredCloses, writes: window.__copy1154.writes };
    });
    assert.deepEqual(state, { copy: true, input: true, modal: true, retiredCloses: 0, writes: [] },
      '#1154: replacing settings must retain the copy-name modal without an orphan close or write');
    await page.locator('#space-copy-name').fill(`Kept copy name ${cancel}`);
    assert.equal(await page.locator('#space-copy-name').inputValue(), `Kept copy name ${cancel}`);
    if (cancel === 'Escape') await page.locator('#space-copy-name').press('Escape');
    else await page.locator(`${space} [data-hp="dialog-cancel"]`).click();
    await page.waitForFunction(() => Boolean(window.__card._spaceDialog)
      && !window.__card._spaceDialog.copy && Boolean(window.__card.shadowRoot.querySelector('#space-title')));
    results[`copy name survives removal; ${cancel} returns to settings`] = true;
  }
  assert.deepEqual(await page.evaluate(() => window.__copy1154.writes), []);
  results.noWritesBeforeConfirmation = true;

  // Real connected close must still honour the dirty-draft decision and reopen.
  const originalName = await page.locator('#space-title').inputValue();
  await page.locator('#space-title').fill(`${originalName} changed`);
  const close = page.locator(`${space} .header button.close`);
  await close.click();
  await page.locator('hp-confirm .danger-confirm-footer [data-hp="dialog-cancel"]').click();
  assert.equal(await page.locator('#space-title').inputValue(), `${originalName} changed`);
  results.dirtyDraftSurvivesRejectedClose = true;
  await close.click();
  await page.locator('hp-confirm .danger-confirm-footer [data-hp="dialog-confirm"]').click();
  await page.locator(space).waitFor({ state: 'detached' });
  results.acceptedCloseFinishes = true;
  await fixture.assertClean();
  console.log(JSON.stringify({ issue: 1154, authenticHaFrontend: fixture.provenance, results,
    pageErrors: fixture.errors, externalRequests: fixture.externalRequests,
    websocketAttempts: fixture.websocketAttempts }, null, 2));
  console.log('OK');
} finally { await fixture.close(); }
