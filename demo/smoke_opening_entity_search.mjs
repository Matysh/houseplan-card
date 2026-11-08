// #301: contacts and locks in the real opening dialog are searchable by both
// friendly name and entity_id without losing the resolver's priority order.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const settle = async () => {
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  };
  const search = async (kind, query) => {
    const input = sr().querySelector(`[data-hp="field"][data-field="opening-${kind}-entity-filter"]`);
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await settle();
  };
  const rows = (kind) => [...sr().querySelectorAll(
    `[data-opening-panel="${kind}"] .opening-entity-candidate[data-opening-entity]:not([data-opening-entity=""])`,
  )];
  const typeSelect = () => sr().querySelector('select[data-field="optype"]');
  const chooseType = async value => {
    const control = typeSelect().closest('hp-settings-select');
    await control.updateComplete;
    control.shadowRoot.querySelector('[data-hp="select-trigger"]').click();
    await control.updateComplete;
    control.shadowRoot.querySelector(`[data-hp="select-option"][data-id="${value}"]`).click();
    await settle();
    await control.updateComplete;
  };

  c.hass = {
    ...c.hass,
    states: {
      ...c.hass.states,
      'binary_sensor.hp301_z_door': {
        entity_id: 'binary_sensor.hp301_z_door', state: 'off',
        attributes: { friendly_name: 'Prioritycheck Z door', device_class: 'door' },
      },
      'binary_sensor.hp301_a_motion': {
        entity_id: 'binary_sensor.hp301_a_motion', state: 'off',
        attributes: { friendly_name: 'Prioritycheck A motion', device_class: 'motion' },
      },
      'binary_sensor.hp301_window': {
        entity_id: 'binary_sensor.hp301_window', state: 'off',
        attributes: { friendly_name: 'Salon Contact', device_class: 'window' },
      },
      'lock.hp301_front': {
        entity_id: 'lock.hp301_front', state: 'locked',
        attributes: { friendly_name: 'HP301 Front Lock' },
      },
    },
  };
  const space = c._serverCfg.spaces.find((item) => item.id === 'f1');
  // This interaction is about entity selectors, not zero-wall hosting. Make
  // the synthetic room edges explicitly physical before adding the door;
  // under model v9 an omitted thickness is intentionally a zero wall.
  c._serverCfg.model_version = 7;
  delete space.wall_segments;
  delete space.open_spans;
  space.walls = (space.rooms || []).flatMap((room) => {
    delete room.wall_ids;
    return room.poly.map((a, index) => ({
      key: `${room.id}-${index}`,
      a, b: room.poly[(index + 1) % room.poly.length], cm: 15,
    }));
  });
  space.openings = [{
    id: 'hp301-door', type: 'door', x: 0.22, y: 0.14, angle: 0, length: 0.09,
  }];
  c._cfgEpoch++;
  c._setMode('plan');
  await settle();
  const opening = c._openingsR.find((item) => item.type === 'door');
  if (!opening) return { realDoorFixtureExists: false };
  c._editOpening(opening);
  await settle();

  const result = {
    realDoorFixtureExists: true,
    bothPickersShown: sr().querySelectorAll('.opening-entity-drop').length === 2,
    panelsInitiallyClosed: !sr().querySelector('.opening-entity-panel'),
    noUnrelatedLedFields: !sr().querySelector('hp-dialog[data-kind="opening"] [data-field^="led-"]'),
    openingLengthIdentity: sr().querySelector('[data-hp="field"][data-field="opening-length"]')?.value === String(c._openingDialog.lengthCm),
    typeOptionsHaveIdentity: [...typeSelect().options].map(option => option.value).join(',') === 'window,door,passage,gate',
    typeUsesSharedSelect: !!typeSelect().closest('hp-settings-select') && !sr().querySelector('input[type="radio"][name="optype"]'),
    typeInitiallyReflectsOpening: typeSelect().value === 'door',
  };

  const originalLength = c._openingDialog.lengthCm;
  for (const type of ['window', 'passage', 'gate', 'door']) {
    c._openingDialog = { ...c._openingDialog, contactOpen: true, lockOpen: true, flipH: true };
    await settle();
    await chooseType(type);
    const picker = typeSelect().closest('hp-settings-select');
    result[`${type}SelectedThroughSharedMenu`] = c._openingDialog.type === type && typeSelect().value === type
      && picker.shadowRoot.querySelector('[data-hp="select-trigger"]').textContent.includes(c._t(`opening.${type}`));
    result[`${type}PreservesExistingLength`] = c._openingDialog.lengthCm === originalLength;
    result[`${type}ClosesBindingPickers`] = !c._openingDialog.contactOpen && !c._openingDialog.lockOpen;
    result[`${type}ShowsExpectedFields`] = sr().querySelectorAll('.opening-entity-drop').length
      === (type === 'passage' ? 0 : type === 'window' ? 1 : 2);
    if (type === 'gate') result.gateResetsHinge = c._openingDialog.flipH === false;
  }

  sr().querySelector('[data-opening-picker="contact"]').click();
  await settle();
  result.openDoesNotForceFocus = !sr().querySelector('.opening-entity-search').matches(':focus');
  await search('contact', 'prioritycheck');
  const ordered = rows('contact');
  result.contactOrderPreserved = ordered.length === 2
    && ordered[0].dataset.openingEntity === 'binary_sensor.hp301_z_door'
    && ordered[1].dataset.openingEntity === 'binary_sensor.hp301_a_motion';
  result.rowsExplainEntityId = ordered.every((row) =>
    row.querySelector('.cs')?.textContent === row.dataset.openingEntity);

  await search('contact', 'binary_sensor.hp301_window');
  const byId = rows('contact');
  result.searchByEntityId = byId.length === 1
    && byId[0].querySelector('.cl')?.textContent === 'Salon Contact';
  byId[0].click();
  await settle();
  result.contactSelectedAndClosed = c._openingDialog.contact === 'binary_sensor.hp301_window'
    && !sr().querySelector('[data-opening-panel="contact"]');
  result.closedButtonExplainsEntityId = sr().querySelector('[data-opening-picker="contact"] .ref')
    ?.textContent === 'binary_sensor.hp301_window';
  for (const [field, key] of [['opening-contact-invert', 'invert'], ['opening-flip-horizontal', 'flipH'], ['opening-flip-vertical', 'flipV']]) {
    const selector = `[data-hp="field"][data-field="${field}"]`;
    const before = c._openingDialog[key];
    sr().querySelector(selector).click(); await settle();
    result[`${field}Binding`] = c._openingDialog[key] !== before;
    sr().querySelector(selector).click(); await settle();
    result[`${field}Restored`] = c._openingDialog[key] === before;
  }

  sr().querySelector('[data-opening-picker="contact"]').click();
  await settle();
  await search('contact', 'no such hp301 entity');
  const contactPanel = sr().querySelector('[data-opening-panel="contact"]');
  const firstChoice = contactPanel.querySelector('.candlist > .opening-entity-candidate');
  result.emptyStateKeepsNoneFirst = firstChoice?.dataset.openingEntity === ''
    && !!contactPanel.querySelector('.opening-entity-empty');
  firstChoice.click();
  await settle();
  result.noneClearsContact = c._openingDialog.contact === ''
    && !sr().querySelector('[data-opening-panel="contact"]');

  sr().querySelector('[data-opening-picker="contact"]').click();
  await settle();
  await search('contact', 'hp301_window');
  rows('contact')[0].click();
  await settle();
  sr().querySelector('[data-opening-picker="lock"]').click();
  await settle();
  await search('lock', 'front lock');
  const lockRows = rows('lock');
  result.lockSearchWorks = lockRows.length === 1
    && lockRows[0].dataset.openingEntity === 'lock.hp301_front';
  lockRows[0].click();
  await settle();
  result.lockSelectedAndClosed = c._openingDialog.lock === 'lock.hp301_front'
    && !sr().querySelector('[data-opening-panel="lock"]');

  sr().querySelector('.dialog-action-commit .btn.on').click();
  await settle();
  const saved = c._curSpaceCfg.openings.find((item) => item.id === opening.id);
  result.savedSameFields = saved?.contact === 'binary_sensor.hp301_window'
    && saved?.lock === 'lock.hp301_front';
  result.dialogClosedAfterSave = !c._openingDialog;

  c._editOpening(c._openingsR.find((item) => item.id === opening.id));
  c._openingDialog = { ...c._openingDialog, type: 'passage' };
  await settle();
  result.passageStillHasNoBindingPickers = !sr().querySelector('.opening-entity-drop');

  // New openings keep the established defaults; existing ones above retain their width.
  c._openingDialog = { ...c._openingDialog, id: undefined, lengthCm: 135 };
  await settle();
  for (const [type, length] of [['window', 120], ['door', 90], ['passage', 90], ['gate', 300]]) {
    await chooseType(type);
    result[`${type}NewOpeningDefault`] = c._openingDialog.lengthCm === length
      && sr().querySelector('[data-field="opening-length"]').value === String(length);
  }
  c._openingDialog = null;
  return result;
});

await finish(browser, checkAll(out));
