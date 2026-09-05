// #456: Copy is a real two-write workflow when the plan needs Optimize and a
// one-write workflow when it does not. Exercise the production bundle through
// the visible dialogs while delegating every request to the demo backend.
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

  // The demo's original f1 needs Optimize. Cancel must leave the name dialog
  // intact and must not make either durable write.
  const cancelStart = calls.length;
  const cancel = await openCopy();
  const proposedName = cancel.copyDialog?.querySelector('#space-copy-name')?.value || '';
  await nameCopy(cancel.copyDialog, 'Cancelled copy');
  submitCopy(cancel.copyDialog);
  await waitFor(() => confirmUi().buttons.length === 2, 'Optimize warning for Cancel');
  const cancelWarning = confirmUi();
  const warningText = cancelWarning.dialog?.textContent || '';
  cancelWarning.buttons[0].click();
  await waitFor(() => !confirmUi().component && card._spaceDialog?.copy?.busy === false,
    'Cancel returns to name');
  const cancelWrites = calls.slice(cancelStart)
    .filter((call) => call.type === 'houseplan/plan/optimize'
      || call.type === 'houseplan/config/set');
  result.copyButtonIsNeutralAndDefaultNameIsNumbered = cancel.outsideDanger
    && proposedName.endsWith(' (2)');
  result.optimizeWarningNamesTheWholePlan = warningText.includes('entire plan')
    && warningText.includes('including other spaces');
  result.optimizeCancelMakesZeroWritesAndKeepsName = cancelWrites.length === 0
    && card._spaceDialog?.copy?.title === 'Cancelled copy';
  card._spaceDialog = null;
  await settle();

  // Accept uses the real demo backend in the promised order and enters the
  // roomless copy after both writes succeed.
  const acceptStart = calls.length;
  const accepted = await openCopy();
  await nameCopy(accepted.copyDialog, 'Optimized copy');
  submitCopy(accepted.copyDialog);
  await waitFor(() => confirmUi().buttons.length === 2, 'Optimize warning for Accept');
  confirmUi().buttons[1].click();
  await waitFor(() => card._spaceDialog === null && card._space !== 'f1',
    'accepted copy transition');
  const acceptedCalls = calls.slice(acceptStart)
    .filter((call) => call.type === 'houseplan/plan/optimize'
      || call.type === 'houseplan/config/set');
  const optimizedCopy = card._serverCfg.spaces.find((space) => space.title === 'Optimized copy');
  result.optimizeAcceptWritesInOrder = acceptedCalls.length === 2
    && acceptedCalls[0].type === 'houseplan/plan/optimize'
    && acceptedCalls[1].type === 'houseplan/config/set';
  result.acceptCreatesAndEntersRoomlessCopy = !!optimizedCopy
    && optimizedCopy.id === card._space
    && optimizedCopy.rooms?.length === 0
    && optimizedCopy.wall_segments?.length === 0
    && optimizedCopy.partitions?.length > 0
    && card._mode === 'plan' && card._tool === 'draw';

  // The accepted config is now optimized. Submitting a second name is itself
  // the only confirmation and produces exactly one config write.
  card._commitSpace('f1', true);
  await settle();
  const cleanStart = calls.length;
  const clean = await openCopy();
  await nameCopy(clean.copyDialog, 'Clean copy');
  submitCopy(clean.copyDialog);
  await waitFor(() => card._spaceDialog === null && card._space !== 'f1',
    'clean copy transition');
  const cleanCalls = calls.slice(cleanStart)
    .filter((call) => call.type === 'houseplan/plan/optimize'
      || call.type === 'houseplan/config/set');
  const cleanCopy = card._serverCfg.spaces.find((space) => space.title === 'Clean copy');
  result.cleanCopyNeedsNoExtraConfirmation = !confirmUi().component
    && cleanCalls.length === 1 && cleanCalls[0].type === 'houseplan/config/set';
  result.cleanCopyIsInsertedAfterSourceAndSelected = !!cleanCopy
    && card._serverCfg.spaces[1]?.id === cleanCopy.id
    && card._space === cleanCopy.id;
  return result;
});

checkAll(out);
await finish(browser, out);
