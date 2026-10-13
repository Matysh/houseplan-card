// #607: explicit authentic Home Assistant dialog diagnostic. This is not a
// regular smoke: it loads the pinned official HA frontend fixture (~124 MB),
// then exercises all four settings-dialog owners through HA's real close
// button and WebAwesome modal surface.
import assert from 'node:assert/strict';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { launchHaDialogFixture } from './helpers/ha-dialog-fixture.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

const cases = [
  { kind: 'marker', input: '#marker-name', state: '_markerDialog' },
  { kind: 'room', input: '#room-name', state: '_roomDialog' },
  { kind: 'space', input: '#space-title', state: '_spaceDialog' },
  { kind: 'settings', input: '#gs-north', state: '_settingsDialog' },
];

const fixture = await launchHaDialogFixture({
  authentic: true,
  viewport: { width: 1280, height: 900 },
  cacheDir: process.env.HP_HA_DIALOG_CACHE,
});

const { page } = fixture;
const results = {};

const waitOwnerOpen = async (testCase) => page.waitForFunction(({ kind, state }) => {
  const card = window.__card;
  const dialog = card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"]`);
  const ha = dialog?.shadowRoot.querySelector('ha-dialog');
  const surface = ha?.shadowRoot.querySelector('wa-dialog')?.shadowRoot.querySelector('dialog');
  return Boolean(card[state]) && ha?.open === true && surface?.matches(':modal') === true;
}, testCase);

const waitOwnerClosed = async ({ kind, state }) => page.waitForFunction(({ kind, state }) => {
  const card = window.__card;
  return !card[state] && !card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"]`)
    && !card.shadowRoot.querySelector('hp-confirm');
}, { kind, state });

const open = async (testCase) => {
  await page.evaluate(async ({ kind }) => {
    const card = window.__card;
    if (card._ensureEditorRuntime && !await card._ensureEditorRuntime()) {
      throw new Error('Editor runtime failed to load');
    }
    if (kind === 'marker') {
      const device = card._devices.find((item) => item.id === 'd_light1') || card._devices[0];
      card._openMarkerDialog(device);
    } else if (kind === 'room') {
      card._openRoomEdit(card._curSpaceCfg.rooms[0]);
    } else if (kind === 'space') {
      card._openSpaceDialog('edit', card._space);
    } else {
      card._openSettingsDialog();
    }
    card.requestUpdate();
    await card.updateComplete;
  }, testCase);
  await waitOwnerOpen(testCase);
};

const edit = async (testCase, suffix) => page.evaluate(async ({ kind, input, suffix }) => {
  const card = window.__card;
  const field = card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"] ${input}`);
  if (!field) throw new Error(`${kind}: missing field ${input}`);
  field.focus();
  if (kind === 'settings') field.value = suffix === ' first' ? '47' : '48';
  else field.value = `${field.value}${suffix}`;
  field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await card.updateComplete;
  return field.value;
}, { ...testCase, suffix });

const clickAuthenticClose = async (testCase) => page.evaluate(({ kind }) => {
  const card = window.__card;
  const dialog = card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"]`);
  const ha = dialog?.shadowRoot.querySelector('ha-dialog');
  const button = ha?.shadowRoot.querySelector('ha-icon-button[data-dialog="close"]');
  if (!button) throw new Error(`${kind}: authentic HA close button not found`);
  dialog.__hp607CloseCount = dialog.__hp607CloseCount || 0;
  if (!dialog.__hp607Counting) {
    dialog.__hp607Counting = true;
    dialog.addEventListener('hp-close', () => { dialog.__hp607CloseCount += 1; });
  }
  button.click();
}, testCase);

const waitConfirm = async (testCase) => {
  try {
    await page.waitForFunction(({ kind }) => {
      const card = window.__card;
      const dialog = card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"]`);
      const ha = dialog?.shadowRoot.querySelector('ha-dialog');
      return ha?.open === false && Boolean(card.shadowRoot.querySelector('hp-confirm'));
    }, testCase);
  } catch (error) {
    const state = await page.evaluate(({ kind, state }) => {
      const card = window.__card;
      const dialog = card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"]`);
      const ha = dialog?.shadowRoot.querySelector('ha-dialog');
      return {
        owner: Boolean(card[state]), dialog: Boolean(dialog), haOpen: ha?.open,
        closeCount: dialog?.__hp607CloseCount,
        confirm: Boolean(card.shadowRoot.querySelector('hp-confirm')),
        buttons: [...(ha?.shadowRoot.querySelectorAll('ha-icon-button') || [])]
          .map((button) => ({ dataDialog: button.getAttribute('data-dialog'), label: button.getAttribute('aria-label') })),
      };
    }, testCase);
    throw new Error(`${testCase.kind}: confirmation did not open: ${JSON.stringify(state)}`, { cause: error });
  }
};

const decide = async (accept) => page.evaluate((accept) => {
  const card = window.__card;
  const selector = accept ? '[data-hp="dialog-confirm"]' : '[data-hp="dialog-cancel"]';
  const button = card.shadowRoot.querySelector(`hp-confirm ${selector}`);
  if (!button) throw new Error(`Confirmation button not found: ${selector}`);
  button.click();
}, accept);

try {
  await page.goto(`${fixture.url}/product.html`);
  try {
    await page.waitForFunction(() => window.__card?._model?.length > 0
      && window.__card?._devices?.length > 0 && window.__card?._booting === false);
  } catch (error) {
    const state = await page.evaluate(() => ({ card: !!window.__card, ready: window.__ha505Ready,
      rooms: window.__card?._model?.length, devices: window.__card?._devices?.length, booting: window.__card?._booting }));
    throw new Error(`HA diagnostic bootstrap failed: ${JSON.stringify({ state, errors: fixture.errors, externalRequests: fixture.externalRequests })}`, { cause: error });
  }
  await assertFreshDemoBundle(page);

  for (const testCase of cases) {
    console.log(`Checking ${testCase.kind}`);
    await open(testCase);
    const firstDraft = await edit(testCase, ' first');
    await clickAuthenticClose(testCase);
    await waitConfirm(testCase);
    await decide(false);
    await waitOwnerOpen(testCase);
    try {
      await page.waitForFunction(({ kind, input }) => {
        const root = window.__card.shadowRoot;
        return root.activeElement === root.querySelector(`hp-dialog[data-kind="${kind}"] ${input}`);
      }, testCase, { timeout: 5000 });
    } catch (error) {
      const focus = await page.evaluate(({ kind, input }) => {
        const root = window.__card.shadowRoot, owner = root.querySelector(`hp-dialog[data-kind="${kind}"]`);
        let active = document.activeElement; const path = [];
        while (active) { path.push(`${active.localName}#${active.id}`); active = active.shadowRoot?.activeElement; }
        const field = owner?.querySelector(input);
        field?.focus();
        return { path, remembered: owner?._lastInputFocus?.id, restore: owner?._restoreInputFocus,
          connected: owner?._lastInputFocus?.isConnected, expected: field?.id,
          afterManualFocus: root.activeElement?.localName, focused: root.activeElement === field,
          rects: field?.getClientRects().length, disabled: field?.disabled,
          html: field?.outerHTML, modalCount: [...document.querySelectorAll('*')].filter(e => e.matches(':modal')).length };
      }, testCase);
      throw new Error(`HA input focus did not recover: ${JSON.stringify(focus)}`, { cause: error });
    }
    const secondDraft = await edit(testCase, ' second');

    const continued = await page.evaluate(({ kind, state, input, firstDraft, secondDraft }) => {
      const card = window.__card;
      const dialog = card.shadowRoot.querySelector(`hp-dialog[data-kind="${kind}"]`);
      const field = dialog?.querySelector(input);
      return {
        sameDraft: Boolean(card[state]) && firstDraft !== secondDraft && field?.value === secondDraft,
        oneClose: dialog?.__hp607CloseCount === 1,
      };
    }, { ...testCase, firstDraft, secondDraft });

    await clickAuthenticClose(testCase);
    await waitConfirm(testCase);
    const twoCloses = await page.evaluate(({ kind }) => window.__card.shadowRoot
      .querySelector(`hp-dialog[data-kind="${kind}"]`)?.__hp607CloseCount === 2, testCase);
    await decide(true);
    await waitOwnerClosed(testCase);

    await open(testCase);
    await clickAuthenticClose(testCase);
    await waitOwnerClosed(testCase);

    results[`${testCase.kind}: continue restores modal`] = continued.sameDraft;
    results[`${testCase.kind}: continue restores input focus`] = true;
    results[`${testCase.kind}: one close before retry`] = continued.oneClose;
    results[`${testCase.kind}: retry emits exactly one more close`] = twoCloses;
    results[`${testCase.kind}: discard and clean close finish`] = true;
  }

  // #851 creation is opened through the actual toolbar, not a private field.
  await installHpTestOnPage(page);
  await page.evaluate(async () => {
    await window.__hpTest.setMode('devices');
    const owner = await window.__hpTest.openMarkerDialog();
    await window.__hpTest.input(owner.querySelector('#marker-name'), 'Unfinished new device');
  });
  const create = { kind: 'marker', input: '#marker-name', state: '_markerDialog' };
  await waitOwnerOpen(create);
  await clickAuthenticClose(create); await waitConfirm(create); await decide(false);
  await waitOwnerOpen(create);
  await page.waitForFunction(() => {
    const root = window.__card.shadowRoot;
    const input = root.querySelector('hp-dialog[data-kind="marker"] #marker-name');
    return root.activeElement === input && input.value === 'Unfinished new device';
  });
  results['851 new device: authentic HA Keep restores draft and focus'] = true;
  await clickAuthenticClose(create); await waitConfirm(create); await decide(true); await waitOwnerClosed(create);
  results['851 new device: authentic HA discard closes'] = true;

  await fixture.assertClean();
  for (const [name, value] of Object.entries(results)) assert.equal(value, true, name);
  console.log(JSON.stringify({
    issue: 607,
    authenticHaFrontend: fixture.provenance,
    results,
    pageErrors: fixture.errors,
    externalRequests: fixture.externalRequests,
    websocketAttempts: fixture.websocketAttempts,
  }, null, 2));
  console.log('OK');
} finally {
  await fixture.close();
}
