// #607: explicit authentic Home Assistant dialog diagnostic. This is not a
// regular smoke: it loads the pinned official HA frontend fixture (~124 MB),
// then exercises all four settings-dialog owners through HA's real close
// button and WebAwesome modal surface.
import assert from 'node:assert/strict';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { launchHaDialogFixture } from './helpers/ha-dialog-fixture.mjs';

const cases = [
  { kind: 'marker', input: '#marker-name', state: '_markerDialog' },
  { kind: 'room', input: '#room-name', state: '_roomDialog' },
  { kind: 'space', input: '#space-title', state: '_spaceDialog' },
  { kind: 'settings', input: '#gs-north', state: '_settingsDialog' },
];

const fixture = await launchHaDialogFixture({
  authentic: true,
  viewport: { width: 1280, height: 900 },
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
  await page.waitForFunction(() => window.__card?._model?.length > 0
    && window.__card?._devices?.length > 0 && window.__card?._booting === false);
  await assertFreshDemoBundle(page);

  for (const testCase of cases) {
    console.log(`Checking ${testCase.kind}`);
    await open(testCase);
    const firstDraft = await edit(testCase, ' first');
    await clickAuthenticClose(testCase);
    await waitConfirm(testCase);
    await decide(false);
    await waitOwnerOpen(testCase);
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
    results[`${testCase.kind}: one close before retry`] = continued.oneClose;
    results[`${testCase.kind}: retry emits exactly one more close`] = twoCloses;
    results[`${testCase.kind}: discard and clean close finish`] = true;
  }

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
