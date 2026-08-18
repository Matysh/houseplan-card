// #117: exact YAML contact/lock references without Entity Registry rows must
// survive the immutable render projection without weakening disabled/security rules.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const contactId = 'binary_sensor.hp117_yaml_contact';
  const lockId = 'lock.hp117_yaml_lock';
  const space = card._serverCfg.spaces.find((item) => item.id === 'f1');
  space.openings = [
    {
      id: 'hp117-window', type: 'window', x: 0.22, y: 0.14,
      angle: 0, length: 0.09, contact: contactId,
    },
    {
      id: 'hp117-door', type: 'door', x: 0.40, y: 0.14,
      angle: 0, length: 0.09, contact: contactId, lock: lockId,
    },
  ];
  card._serverCfg = {
    ...card._serverCfg,
    markers: [
      { id: 'hp117-contact-gone', binding: `entity:${contactId}`, removed: true, hidden: true },
      { id: 'hp117-lock-gone', binding: `entity:${lockId}`, removed: true, hidden: true },
    ],
  };
  card._cfgEpoch++;
  card._setMode('view');
  const serviceCalls = [];
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [contactId]: {
        entity_id: contactId, state: 'off',
        attributes: { friendly_name: 'YAML opening contact', device_class: 'window' },
      },
      [lockId]: {
        entity_id: lockId, state: 'locked',
        attributes: { friendly_name: 'YAML opening lock' },
      },
    },
    callService: async (domain, service, data) => {
      serviceCalls.push({ domain, service, entityId: data.entity_id });
    },
  };
  await settle();

  const rendered = () => card._openingsR;
  const yamlWindow = () => rendered().find((opening) => opening.id === 'hp117-window');
  const yamlDoor = () => rendered().find((opening) => opening.id === 'hp117-door');
  result.noRegistryRowsExist = card.hass.entities?.[contactId] == null
    && card.hass.entities?.[lockId] == null;
  result.pickerOffersExactYamlEntities = card._contactCandidates()
    .some((item) => item.value === contactId)
    && card._lockCandidates().some((item) => item.value === lockId);
  result.frozenProjectionKeepsYamlStates = card._renderPlanHass.entities?.[contactId] == null
    && card._renderPlanHass.entities?.[lockId] == null
    && card._renderPlanHass.states?.[contactId]?.state === 'off'
    && card._renderPlanHass.states?.[lockId]?.state === 'locked';
  result.markerTombstonesDoNotBlockOpening = card._renderOpeningEntityAvailable(contactId)
    && card._renderOpeningEntityAvailable(lockId)
    && !card._planEntityAvailable(contactId)
    && !card._planEntityAvailable(lockId);
  result.closedContactControlsPresentation = card._openingAmt(yamlWindow()) === 0
    && card._openingAmt(yamlDoor()) === 0;
  result.yamlLockBadgeRendersLocked = root().querySelectorAll('.oplock.locked').length === 1;

  const callsBeforePlanTap = serviceCalls.length;
  root().querySelector('[data-hp="opening"][data-id="hp117-door"] .op-hit')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  root().querySelector('.oplock')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  await settle();
  result.planOpeningAndBadgeNeverActuate = serviceCalls.length === callsBeforePlanTap;
  result.badgeOpensInfoWithBothRows = card._openingInfo?.id === 'hp117-door'
    && root().querySelectorAll('.oprow').length === 2
    && root().querySelectorAll('.lockact').length === 1;

  window.confirm = () => true;
  card._lockAction(lockId, 'unlock');
  result.explicitInfoActionStillWorks = serviceCalls.at(-1)?.domain === 'lock'
    && serviceCalls.at(-1)?.service === 'unlock'
    && serviceCalls.at(-1)?.entityId === lockId;
  card._openingInfo = null;
  await settle();

  card._physicalBodiesR();
  const frameBefore = card._renderPlanHass;
  const physicalBefore = card._physicalBodiesCache;
  const epochBefore = card._cfgEpoch;
  const configBefore = JSON.stringify(card._serverCfg);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [contactId]: { ...card.hass.states[contactId], state: 'on' },
      [lockId]: { ...card.hass.states[lockId], state: 'unlocked' },
    },
  };
  const oldFrameHeldUntilUpdate = card._renderPlanHass === frameBefore
    && card._openingAmt(yamlWindow()) === 0;
  await settle();
  result.stateTickSwapsOneAtomicFrame = oldFrameHeldUntilUpdate
    && card._renderPlanHass !== frameBefore
    && card._openingAmt(yamlWindow()) === 1
    && card._openingAmt(yamlDoor()) === 1
    && root().querySelectorAll('.oplock.unlocked').length === 1;
  result.stateTickDoesNotRebuildGeometryOrConfig = card._physicalBodiesCache === physicalBefore
    && card._cfgEpoch === epochBefore
    && JSON.stringify(card._serverCfg) === configBefore;

  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [contactId]: { ...card.hass.states[contactId], state: 'unknown' },
      [lockId]: { ...card.hass.states[lockId], state: 'unknown' },
    },
  };
  await settle();
  result.unknownKeepsExistingTypeSemantics = card._renderOpeningEntityAvailable(contactId)
    && card._openingAmt(yamlWindow()) === 0
    && card._openingAmt(yamlDoor()) === 1
    && root().querySelectorAll('.oplock.unknown').length === 1;

  space.openings = [
    {
      id: 'hp117-disabled-window', type: 'window', x: 0.22, y: 0.14,
      angle: 0, length: 0.09, contact: 'binary_sensor.window',
    },
    {
      id: 'hp117-disabled-lock', type: 'door', x: 0.40, y: 0.14,
      angle: 0, length: 0.09, lock: 'lock.front_door',
    },
  ];
  card._cfgEpoch++;
  window.__setRegistryDisabled('entity', 'binary_sensor.window', 'user');
  window.__setRegistryDisabled('entity', 'lock.front_door', 'user');
  await new Promise((resolve) => setTimeout(resolve, 220));
  await settle();
  const disabledWindow = card._openingsR.find((opening) => opening.id === 'hp117-disabled-window');
  result.explicitDisabledRowsRemoveStaleStates = card._renderPlanHass.states?.['binary_sensor.window'] == null
    && card._renderPlanHass.states?.['lock.front_door'] == null
    && !card._renderOpeningEntityAvailable('binary_sensor.window')
    && !card._renderOpeningEntityAvailable('lock.front_door')
    && card._openingAmt(disabledWindow) === 0
    && root().querySelectorAll('.oplock').length === 0;

  return result;
});

checkAll(out);
await finish(browser, out);
