// #104 pre-beta smoke: an opening owns exact contact/lock references
// independently of the standalone marker tombstone. This file is added during
// implementation but intentionally runs only in the pre-beta smoke gate.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const settle = async () => {
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const openingRefs = () => c._serverCfg.spaces
    .find((space) => space.id === 'f1').openings
    .map(({ id, contact, lock }) => ({ id, contact, lock }));

  const space = c._serverCfg.spaces.find((item) => item.id === 'f1');
  space.openings = [
    {
      id: 'hp104-a', type: 'door', x: 0.22, y: 0.14, angle: 0, length: 0.09,
      contact: 'binary_sensor.window', lock: 'lock.front_door',
    },
    {
      id: 'hp104-b', type: 'door', x: 0.40, y: 0.14, angle: 0, length: 0.09,
      contact: 'binary_sensor.window', lock: 'lock.front_door',
    },
  ];
  const refsBefore = JSON.stringify(openingRefs());
  c._serverCfg = {
    ...c._serverCfg,
    markers: [
      { id: 'window-gone', binding: 'entity:binary_sensor.window', removed: true, hidden: true },
      { id: 'lock-gone', binding: 'device:d_lock', removed: true, hidden: true },
    ],
  };
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.hass = { ...c.hass };
  await settle();

  const contactValues = c._contactCandidates().map((item) => item.value);
  const lockValues = c._lockCandidates().map((item) => item.value);
  const openings = c._openingsR;
  const result = {
    entityTombstoneCandidate: contactValues.includes('binary_sensor.window'),
    deviceTombstoneCandidate: lockValues.includes('lock.front_door'),
    markerContributionsStaySuppressed:
      !c._planEntityAvailable('binary_sensor.window')
      && !c._planEntityAvailable('lock.front_door'),
    exactOpeningReferencesStayActive:
      c._openingEntityAvailable('binary_sensor.window')
      && c._openingEntityAvailable('lock.front_door'),
    sharedContactDrivesBoth: openings.length === 2
      && openings.every((opening) => c._openingAmt(opening) === 1),
    sharedLockRendersTwice: sr().querySelectorAll('.oplock').length === 2,
    deletionKeepsOpeningFields: JSON.stringify(openingRefs()) === refsBefore,
  };

  // The opening info card remains the one deliberate lock surface.
  c._openingInfo = openings[0];
  await settle();
  result.infoHasContactAndLock = sr().querySelectorAll('.oprow').length === 2;
  result.infoHasOneLockAction = sr().querySelectorAll('.lockact').length === 1;
  const calls = [];
  c.hass = {
    ...c.hass,
    callService: async (domain, service, data) => calls.push({ domain, service, data }),
  };
  c._lockAction('lock.front_door', 'lock');
  result.tombstonedMarkerDoesNotBlockExplicitLock = calls.length === 1
    && calls[0].domain === 'lock' && calls[0].service === 'lock';

  // Re-adding replaces only the marker record; exact opening fields remain
  // byte-for-byte the same and therefore cannot be duplicated or retargeted.
  c._serverCfg = {
    ...c._serverCfg,
    markers: [
      { id: 'window-back', binding: 'entity:binary_sensor.window', hidden: false },
      { id: 'lock-back', binding: 'device:d_lock', hidden: false },
    ],
  };
  c._regSignature = '';
  c._maybeRebuildDevices();
  await settle();
  result.readdKeepsOpeningFields = JSON.stringify(openingRefs()) === refsBefore;

  // Active registry rows with unknown transport state keep the reference but
  // expose no lock action; disabled and orphaned exact rows fail closed.
  c.hass = {
    ...c.hass,
    devices: {
      ...c.hass.devices,
      hp104_disabled_parent: { id: 'hp104_disabled_parent', disabled_by: 'user' },
    },
    entities: {
      ...c.hass.entities,
      'lock.hp104_disabled': {
        entity_id: 'lock.hp104_disabled', device_id: null, disabled_by: 'user',
      },
      'lock.hp104_disabled_parent': {
        entity_id: 'lock.hp104_disabled_parent', device_id: 'hp104_disabled_parent', disabled_by: null,
      },
      'lock.hp104_orphan': {
        entity_id: 'lock.hp104_orphan', device_id: 'hp104_missing_parent', disabled_by: null,
      },
    },
    states: {
      ...c.hass.states,
      'lock.front_door': { ...c.hass.states['lock.front_door'], state: 'unavailable' },
      'lock.hp104_disabled': { entity_id: 'lock.hp104_disabled', state: 'locked', attributes: {} },
      'lock.hp104_disabled_parent': {
        entity_id: 'lock.hp104_disabled_parent', state: 'locked', attributes: {},
      },
      'lock.hp104_orphan': { entity_id: 'lock.hp104_orphan', state: 'locked', attributes: {} },
    },
    callService: async (domain, service, data) => calls.push({ domain, service, data }),
  };
  await settle();
  c._openingInfo = c._openingsR[0];
  await settle();
  const unavailableCandidates = c._lockCandidates().map((item) => item.value);
  result.unavailableRemainsCandidate = unavailableCandidates.includes('lock.front_door');
  result.unavailableShowsUnknownWithoutAction = sr().querySelector('.oplock.unknown') != null
    && sr().querySelector('.lockact') == null;
  result.disabledAndOrphanedAreRejected = !unavailableCandidates.includes('lock.hp104_disabled')
    && !unavailableCandidates.includes('lock.hp104_disabled_parent')
    && !unavailableCandidates.includes('lock.hp104_orphan');
  const callsBeforeRejected = calls.length;
  c._lockAction('lock.hp104_disabled', 'lock');
  c._lockAction('lock.hp104_disabled_parent', 'lock');
  c._lockAction('lock.hp104_orphan', 'lock');
  result.rejectedLocksNeverCallService = calls.length === callsBeforeRejected;

  return result;
});

checkAll(out);
await finish(browser, out);
