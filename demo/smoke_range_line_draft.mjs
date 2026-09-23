// #608: rangeLine keeps partial keyboard text local until commit, then writes
// one slider-representable value. This must exercise the shipped browser bundle:
// source-level tests cannot reproduce Lit's DOM/property synchronisation.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 760, height: 900 });

const settle = () => page.evaluate(async () => {
  const c = window.__card;
  c.requestUpdate();
  await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
});

await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('plan');
  await c.updateComplete;
  c._openRoomEdit(c._curSpaceCfg.rooms[0]);
  await c.updateComplete;
});
await settle();

const roomInput = page.locator('hp-dialog[data-kind="room"] #room-name-scale');
await roomInput.focus();
await roomInput.fill('');
await roomInput.pressSequentially('120');

const out = await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="room"]');
  const input = dialog.querySelector('#room-name-scale');
  const slider = input.closest('.hpf-range').querySelector('ha-slider, input[type="range"]');
  const save = dialog.querySelector('.dialog-action-commit [data-hp="dialog-confirm"]');
  return {
    roomPartialTextStaysVisible: input.value === '120',
    roomPartialDoesNotWriteDraft: c._roomNameScale === 1,
    roomPartialDoesNotMoveSlider: Number(slider.value) === 100,
    roomPartialDoesNotDirtyForm: save.disabled === true,
  };
});

await roomInput.dispatchEvent('change');
await settle();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="room"]');
  const input = dialog.querySelector('#room-name-scale');
  const slider = input.closest('.hpf-range').querySelector('ha-slider, input[type="range"]');
  return {
    roomCommitWrites120Once: c._roomNameScale === 1.2,
    roomCommitSynchronizesFieldAndSlider: input.value === '120' && Number(slider.value) === 120,
  };
}));

await roomInput.focus();
await roomInput.fill('');
await roomInput.dispatchEvent('change');
await settle();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="room"]');
  const input = dialog.querySelector('#room-name-scale');
  const save = dialog.querySelector('.dialog-action-commit [data-hp="dialog-confirm"]');
  return {
    emptyCommitRestoresConfirmedValue: input.value === '120',
    emptyCommitDoesNotChangeDraft: c._roomNameScale === 1.2,
    emptyCommitKeepsDirtyState: save.disabled === false,
  };
}));

await page.evaluate(async () => {
  const c = window.__card;
  c._roomDialog = false;
  c._openSpaceDialog('edit', c._space);
  c.requestUpdate();
  await c.updateComplete;
});
await settle();

const spaceInput = page.locator('hp-dialog[data-kind="space"] #space-card-font');
await spaceInput.focus();
await spaceInput.fill('');
await spaceInput.pressSequentially('123');
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="space"]');
  return {
    spacePartialDoesNotWriteDraft: c._spaceDialog.cardFontScale === 1,
    spacePartialTextStaysVisible: dialog.querySelector('#space-card-font').value === '123',
  };
}));
await spaceInput.dispatchEvent('change');
await settle();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="space"]');
  const input = dialog.querySelector('#space-card-font');
  const slider = input.closest('.hpf-range').querySelector('ha-slider, input[type="range"]');
  return {
    offStepCommitSnapsTo125: c._spaceDialog.cardFontScale === 1.25,
    offStepCommitSynchronizesFieldAndSlider: input.value === '125' && Number(slider.value) === 125,
  };
}));

await spaceInput.focus();
await spaceInput.fill('');
await spaceInput.pressSequentially('222');
await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="space"]');
  const input = dialog.querySelector('#space-card-font');
  const slider = input.closest('.hpf-range').querySelector('ha-slider, input[type="range"]');
  slider.value = 175;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
});
await settle();
Object.assign(out, await page.evaluate(() => {
  const c = window.__card;
  const dialog = (c.shadowRoot || c.renderRoot).querySelector('hp-dialog[data-kind="space"]');
  const input = dialog.querySelector('#space-card-font');
  const slider = input.closest('.hpf-range').querySelector('ha-slider, input[type="range"]');
  return {
    sliderWinsOverPartialText: c._spaceDialog.cardFontScale === 1.75,
    sliderSynchronizesField: input.value === '175' && Number(slider.value) === 175,
  };
}));

checkAll(out);
await finish(browser, out);
