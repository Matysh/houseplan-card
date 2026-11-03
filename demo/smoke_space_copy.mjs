// #1227: Copy preserves the saved plan, with one guarded config write and no Optimize.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 780 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const clone = (value) => structuredClone(value);
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const waitFor = async (predicate, label) => {
    for (let attempt = 0; attempt < 120; attempt++) {
      await settle();
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`space-copy smoke timed out: ${label}`);
  };
  const currentDialog = () => root().querySelector('hp-dialog');
  const buttonWithIcon = (dialog, icon) => [...(dialog?.querySelectorAll('button') || [])]
    .find((button) => button.querySelector(`ha-icon[icon="${icon}"]`));
  const openCopy = async () => {
    card._openSpaceDialog('edit', 'f1');
    await settle();
    const settingsDialog = currentDialog();
    const button = buttonWithIcon(settingsDialog, 'mdi:content-copy');
    const outsideDanger = !!button && !button.closest('.dialog-action-danger');
    button?.click();
    await waitFor(() => !!card._spaceDialog?.copy, 'copy name dialog');
    const copyDialog = currentDialog();
    return { outsideDanger, copyDialog };
  };
  const nameCopy = async (dialog, title) => {
    const input = dialog?.querySelector('#space-copy-name');
    if (input) {
      input.value = title;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
    await settle();
    return input;
  };
  const submitCopy = (dialog) => buttonWithIcon(dialog, 'mdi:content-copy')?.click();
  const confirmUi = () => {
    const component = root().querySelector('hp-confirm');
    const dialog = component?.querySelector('hp-dialog');
    return {
      component,
      dialog,
      buttons: [...(dialog?.querySelectorAll('.danger-confirm-footer button') || [])],
    };
  };

  const baseCall = card.hass.callWS.bind(card.hass);
  const calls = [];
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      calls.push(clone(message));
      return baseCall(message);
    },
  };
  await settle();

  // Cancel is read-only and returns to the existing settings dialog.
  const cancelStart = calls.length;
  const cancel = await openCopy();
  const proposedName = cancel.copyDialog?.querySelector('#space-copy-name')?.value || '';
  await nameCopy(cancel.copyDialog, 'Cancelled copy');
  cancel.copyDialog.querySelector('[data-hp="dialog-cancel"]').click();
  await settle();
  result.copyButtonIsNeutralAndDefaultNameIsNumbered = cancel.outsideDanger && proposedName.endsWith(' (2)');
  result.cancelMakesZeroWrites = !calls.slice(cancelStart).some(call =>
    ['houseplan/config/set', 'houseplan/plan/optimize'].includes(call.type));

  const source = clone(card._serverCfg.spaces.find(space => space.id === 'f1'));
  const acceptStart = calls.length;
  const accepted = await openCopy();
  await nameCopy(accepted.copyDialog, 'Unchanged copy');
  submitCopy(accepted.copyDialog);
  await waitFor(() => card._spaceDialog === null && card._space !== 'f1', 'accepted copy transition');
  const acceptedCalls = calls.slice(acceptStart).filter(call =>
    ['houseplan/plan/optimize', 'houseplan/config/set'].includes(call.type));
  const copied = card._serverCfg.spaces.find(space => space.title === 'Unchanged copy');
  result.copyHasOneWriteWithoutOptimizeOrConfirmation = acceptedCalls.length === 1
    && acceptedCalls[0].type === 'houseplan/config/set' && !confirmUi().component;
  result.sourceGeometryUnchanged = JSON.stringify(card._serverCfg.spaces.find(space => space.id === 'f1')) === JSON.stringify(source);
  result.createsAndEntersRoomlessCopy = !!copied && copied.id === card._space
    && copied.rooms?.length === 0 && copied.wall_segments?.length === 0
    && copied.partitions?.length > 0 && card._mode === 'plan' && card._tool === 'draw';
  result.insertedAfterSource = !!copied && card._serverCfg.spaces[1]?.id === copied.id;

  // #1154: the genuine HA diagnostic proves this late removal event occurs.
  // Keep the full UI transition in ordinary CI too, without the large HA wheel.
  class RemovalHaDialog extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = '<slot name="headerTitle"></slot><slot></slot><slot name="footer"></slot>';
    }
    disconnectedCallback() {
      queueMicrotask(() => {
        this.dispatchEvent(new Event('wa-hide', { bubbles: true, composed: true, cancelable: true }));
        this.dispatchEvent(new Event('closed'));
      });
    }
  }
  if (!customElements.get('ha-dialog')) customElements.define('ha-dialog', RemovalHaDialog);
  const haStart = calls.length;
  const haCopy = await openCopy();
  await nameCopy(haCopy.copyDialog, 'Retained HA copy');
  await settle();
  result.haCopySurvivesRetiredSettings = !!card._spaceDialog?.copy
    && currentDialog() === haCopy.copyDialog
    && haCopy.copyDialog.hasAttribute('ha-dialog-shell')
    && haCopy.copyDialog.querySelector('#space-copy-name')?.value === 'Retained HA copy';
  haCopy.copyDialog.querySelector('[data-hp="dialog-cancel"]').click();
  await settle();
  result.haCopyCancelRestoresSettingsWithoutWrites = !!card._spaceDialog && !card._spaceDialog.copy
    && !!currentDialog()?.querySelector('#space-title')
    && !calls.slice(haStart).some(call => ['houseplan/config/set', 'houseplan/plan/optimize'].includes(call.type));
  return result;
});

checkAll(out);
await finish(browser, out);
