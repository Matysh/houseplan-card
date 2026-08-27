import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { resolveDevicePresentationPolicy } from '../test-build/device-presentation-policy.js';
import {
  activitySourceSignature, markerLqiBand, resolveDevicePresentation, resolvePresentationSources,
} from '../test-build/device-presentation.js';
import { buildDevices } from '../test-build/devices.js';
import { DEVICE_PRESENTATION_DECISIONS } from './fixtures/device-presentation-decisions.mjs';
import { MUTANTS } from '../scripts/mutation-gate.mjs';

const state = (entity_id, value, attributes = {}) => ({ entity_id, state: value, attributes });
const hass = (states = {}, entities = {}) => ({
  states, entities, devices: {}, config: { unit_system: { temperature: '°C' } },
  formatEntityState: (item) => item.state === 'on' ? 'On' : item.state,
});
const device = (overrides = {}) => ({
  id: 'd1', name: 'Device', model: '', area: 'room', space: 'floor',
  icon: 'mdi:toggle-switch', entities: ['switch.main'], primary: 'switch.main',
  bindingKind: 'device', bindingRef: 'd1',
  bindingStatus: { kind: 'active', enabledEntityIds: ['switch.main'], allEntityIds: ['switch.main'] },
  marker: { id: 'd1', binding: 'device:d1' },
  ...overrides,
});
const options = { liveStates: true, showTemperature: true, showSignal: true, now: 2_000 };
const neutral = { availability: 'available', status: 'neutral', activity: 'none' };

const basePolicy = (overrides = {}) => ({
  bindingLifecycle: 'active', userHidden: false, designPreview: false,
  display: 'badge', liveStates: true, sourceVisual: neutral,
  controllerFace: false, controllerAvailability: 'available', shortActivity: null,
  valueAvailable: false, valueFallback: null, vacuumLiveRequested: false,
  ...overrides,
});

function assertDecision(result, decision) {
  assert.ok(result.decisionIds.includes(decision),
    `${decision} missing from ${result.decisionIds.join(', ')}`);
}

const rowHass = () => hass({
  'binary_sensor.door': state('binary_sensor.door', 'on', { device_class: 'door' }),
  'binary_sensor.presence': state('binary_sensor.presence', 'on', { device_class: 'presence' }),
  'binary_sensor.smoke': state('binary_sensor.smoke', 'on', { device_class: 'smoke' }),
  'cover.main': state('cover.main', 'opening', { device_class: 'garage' }),
  'event.button': state('event.button', 'unknown'),
  'light.main': state('light.main', 'on', { rgb_color: [12, 140, 250] }),
  'light.offline': state('light.offline', 'unavailable'),
  'light.second': state('light.second', 'off'),
  'lock.front': state('lock.front', 'locked'),
  'sensor.battery': state('sensor.battery', '100'),
  'sensor.device_linkquality': state('sensor.device_linkquality', '40'),
  'sensor.temperature': state('sensor.temperature', '22.4', {
    device_class: 'temperature', unit_of_measurement: '°C',
  }),
  'switch.main': state('switch.main', 'on'),
  'switch.offline': state('switch.offline', 'unavailable'),
  'vacuum.robot': state('vacuum.robot', 'cleaning'),
}, Object.fromEntries([
  ['binary_sensor.door', 'd1'], ['binary_sensor.presence', 'presence'],
  ['binary_sensor.smoke', 'd1'], ['cover.main', 'd1'], ['event.button', 'd1'],
  ['light.main', null], ['light.offline', null], ['light.second', null],
  ['lock.front', 'd1'], ['sensor.battery', 'd1'], ['sensor.device_linkquality', 'd1'],
  ['sensor.temperature', 'd1'], ['switch.main', 'd1'], ['switch.offline', 'd1'],
  ['vacuum.robot', 'vacuum'],
].map(([entity_id, device_id]) => [entity_id, {
  entity_id, device_id, platform: 'demo',
  ...(entity_id === 'sensor.battery' || entity_id === 'sensor.device_linkquality'
    ? { entity_category: 'diagnostic' } : {}),
}])));

const policyRow = (overrides, verify) => () => {
  const result = resolveDevicePresentationPolicy(basePolicy(overrides));
  verify(result);
  return result;
};

const sourceRow = (overrides, verify) => () => {
  const result = resolvePresentationSources(rowHass(), device(overrides));
  verify(result);
  return result;
};

const presentationRow = (overrides, optionOverrides, verify) => () => {
  const result = resolveDevicePresentation(
    rowHass(), device(overrides), { ...options, ...optionOverrides },
  );
  verify(result);
  return result;
};

test('device presentation decision document, fixture and mutation registry stay exact', () => {
  const doc = readFileSync(new URL('../docs/DEVICE-PRESENTATION.md', import.meta.url), 'utf8');
  const docIds = [...doc.matchAll(/^\| ([LSFA]\d{2}) \|/gm)].map((match) => match[1]);
  const fixtureIds = DEVICE_PRESENTATION_DECISIONS.map((row) => row.id);
  assert.deepEqual(docIds, fixtureIds);
  assert.equal(new Set(fixtureIds).size, fixtureIds.length);
  assert.deepEqual(fixtureIds, [...fixtureIds].sort((a, b) =>
    'LSFA'.indexOf(a[0]) - 'LSFA'.indexOf(b[0]) || Number(a.slice(1)) - Number(b.slice(1))));

  const mutantIds = new Set(MUTANTS.map((mutant) => mutant.id));
  for (const row of DEVICE_PRESENTATION_DECISIONS) {
    assert.match(doc, new RegExp(`^\\| ${row.id} \\|.*\\b${row.expectedDecision.replace('.', '\\.')}`, 'm'));
    assert.ok(mutantIds.has(row.mutation), `${row.id}: unknown mutation ${row.mutation}`);
  }
});

const rowRunners = {
  L01: () => {
    const roster = buildDevices({
      hass: { states: {}, entities: {}, devices: {}, areas: {} },
      areaToSpace: {}, markers: [{ id: 'gone', binding: 'virtual', removed: true }],
      settings: { filter_seeded: true }, excluded: new Set(), showAll: true,
      firstSpaceId: 'floor', loc: (key) => key, iconRules: [],
    });
    assert.deepEqual(roster, []);
    return { decisionIds: ['pre.lifecycle.removed'] };
  },
  L02: policyRow({ bindingLifecycle: 'ha_disabled' }, (r) => {
    assert.equal(r.effectiveHidden, true);
    assert.equal(r.bindingUnavailable, true);
  }),
  L03: policyRow({ bindingLifecycle: 'ha_disabled', designPreview: true }, (r) => {
    assert.equal(r.effectiveHidden, true);
    assert.deepEqual(r.visual, neutral);
  }),
  L04: policyRow({ userHidden: true }, (r) => assert.equal(r.effectiveHidden, true)),
  L05: policyRow({
    userHidden: true, designPreview: true,
    sourceVisual: { availability: 'available', status: 'working', activity: 'running' },
  }, (r) => {
    assert.equal(r.effectiveHidden, false);
    assert.equal(r.visual.status, 'working');
  }),
  L06: () => {
    const orphaned = resolveDevicePresentationPolicy(basePolicy({ bindingLifecycle: 'orphaned' }));
    assert.equal(orphaned.bindingUnavailable, true);
    return orphaned;
  },
  S01: sourceRow({ entities: ['cover.main'], primary: 'cover.main', tapAction: 'info' },
    (r) => assert.equal(r.sourceKind, 'cover')),
  S02: sourceRow({
    entities: ['light.main', 'cover.main'], primary: 'light.main', tapAction: 'info',
  }, (r) => assert.equal(r.sourceKind, 'light')),
  S03: presentationRow({
    entities: ['switch.main'], primary: 'switch.main',
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.main'] },
  }, {}, (r) => {
    assert.equal(r.sourceKind, 'controls');
    assert.deepEqual([r.visual.availability, r.visual.status], ['available', 'working']);
  }),
  S04: presentationRow({
    entities: ['event.button', 'sensor.battery'], primary: 'event.button',
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.offline'] },
  }, {}, (r) => {
    assert.equal(r.sourceKind, 'controls');
    assert.deepEqual([r.visual.availability, r.visual.status], ['available', 'neutral']);
  }),
  S05: presentationRow({
    entities: ['switch.offline'], primary: 'switch.offline',
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.main'] },
  }, {}, (r) => {
    assert.deepEqual([r.visual.availability, r.visual.status], ['unavailable', 'working']);
    assert.equal(r.pulse.kind, 'none');
  }),
  S06: presentationRow({
    virtual: true, bindingKind: 'virtual', bindingRef: '', entities: [], primary: null,
    marker: { id: 'virtual', binding: 'virtual', controls: ['light.main'] },
  }, {}, (r) => {
    assert.equal(r.sourceKind, 'controls');
    assert.deepEqual([r.visual.availability, r.visual.status], ['available', 'working']);
  }),
  S07: presentationRow({
    entities: ['event.button', 'sensor.battery'], primary: 'event.button', controls: [],
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.missing'] },
  }, {}, (r) => {
    assert.equal(r.sourceKind, 'device_role');
    assert.equal(r.visual.availability, 'available');
  }),
  S08: sourceRow({
    id: 'manual', virtual: true, bindingKind: 'virtual', bindingRef: '',
    entities: [], primary: null,
    marker: {
      id: 'manual', binding: 'virtual', is_light: true, tap_action: 'toggle',
      controls: ['light.main'],
    },
  }, (r) => assert.equal(r.sourceKind, 'light')),
  S09: sourceRow({ entities: ['light.main'], primary: 'light.main' },
    (r) => assert.equal(r.sourceKind, 'light')),
  S10: sourceRow({}, (r) => assert.equal(r.sourceKind, 'device_role')),
  S11: sourceRow({ entities: [], primary: 'sensor.temperature' },
    (r) => assert.equal(r.sourceKind, 'primary')),
  S12: sourceRow({ entities: [], primary: null }, (r) => {
    assert.equal(r.sourceKind, 'none');
    assert.deepEqual(r.samples, []);
  }),
  S13: presentationRow({
    entities: ['switch.main', 'binary_sensor.smoke'], primary: 'switch.main',
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.main'] },
  }, {}, (r) => {
    assert.equal(r.visual.status, 'alarm');
    assert.equal(r.criticalSources[0].eid, 'binary_sensor.smoke');
  }),
  S14: presentationRow({
    marker: { id: 'd1', binding: 'device:d1', display: 'static_icon' },
  }, { sourceDetails: false }, (r) => {
    assert.equal(r.sourceKind, 'none');
    assert.deepEqual(r.visual, neutral);
  }),
  F01: policyRow({
    sourceVisual: { availability: 'available', status: 'alarm', activity: 'none' },
  }, (r) => assert.equal(r.visual.status, 'alarm')),
  F02: policyRow({
    sourceVisual: { availability: 'unavailable', status: 'neutral', activity: 'none' },
  }, (r) => {
    assert.equal(r.visual.availability, 'unavailable');
    assert.equal(r.pulseEligible, false);
  }),
  F03: () => {
    const h = rowHass();
    const lock = device({ icon: 'mdi:lock', entities: ['lock.front'], primary: 'lock.front' });
    const locked = resolveDevicePresentation(h, lock, options);
    h.states['lock.front'].state = 'unlocked';
    const unlocked = resolveDevicePresentation(h, lock, options);
    assert.equal(locked.lockState, 'locked');
    assert.ok(locked.classes.includes('lock-locked'));
    assert.equal(unlocked.lockState, 'unlocked');
    assert.ok(unlocked.classes.includes('lock-unlocked'));
    return locked;
  },
  F04: policyRow({
    sourceVisual: { availability: 'available', status: 'working', activity: 'running' },
  }, (r) => assert.equal(r.visual.status, 'working')),
  F05: policyRow({
    sourceVisual: { availability: 'available', status: 'open', activity: 'none' },
  }, (r) => assert.equal(r.visual.status, 'open')),
  F06: policyRow({}, (r) => assert.deepEqual(r.visual, neutral)),
  F07: policyRow({
    liveStates: false,
    sourceVisual: { availability: 'available', status: 'working', activity: 'running' },
  }, (r) => assert.deepEqual(r.visual, neutral)),
  F08: policyRow({
    display: 'static_icon', valueAvailable: true, vacuumLiveRequested: true,
    sourceVisual: { availability: 'available', status: 'alarm', activity: 'running' },
  }, (r) => {
    assert.deepEqual(r.visual, neutral);
    assert.deepEqual([r.face, r.metrics, r.vacuumLive], ['icon', false, false]);
  }),
  F09: presentationRow({
    marker: { id: 'd1', binding: 'device:d1', display: 'value' },
  }, {}, (r) => assert.equal(r.valueText, 'On')),
  F10: presentationRow({
    entities: ['switch.offline'], primary: 'switch.offline',
    marker: { id: 'd1', binding: 'device:d1', display: 'value' },
  }, {}, (r) => {
    assert.equal(r.valueText, null);
    assert.equal(r.fallbackReason, 'value_no_state');
  }),
  F11: presentationRow({
    controls: ['light.main', 'light.second'],
    marker: {
      id: 'd1', binding: 'device:d1', display: 'value',
      controls: ['light.main', 'light.second'],
    },
  }, {}, (r) => assert.equal(r.fallbackReason, 'value_ambiguous_sources')),
  F12: presentationRow({
    virtual: true, bindingKind: 'virtual', bindingRef: '', entities: [], primary: null,
    marker: { id: 'virtual', binding: 'virtual', display: 'value' },
  }, {}, (r) => assert.equal(r.fallbackReason, 'value_virtual')),
  F13: presentationRow({
    icon: 'mdi:garage', entities: ['cover.main'], primary: 'cover.main', tapAction: 'info',
  }, {}, (r) => {
    assert.equal(r.sourceKind, 'cover');
    assert.notEqual(r.icon, 'mdi:garage');
  }),
  F14: presentationRow({
    icon: 'mdi:thermometer',
    entities: ['sensor.temperature', 'sensor.device_linkquality'], primary: 'sensor.temperature',
    marker: {
      id: 'd1', binding: 'device:d1',
      value_badge: { enabled: true, source: { kind: 'derived_lqi' }, position: 'bottom' },
    },
  }, {}, (r) => {
    assert.equal(r.valueBadge?.text, '40');
    assert.equal(r.lqiText, null);
  }),
  F15: presentationRow({
    icon: 'mdi:thermometer', entities: ['sensor.temperature'], primary: 'sensor.temperature',
  }, {}, (r) => assert.equal(r.tempText, '22.4')),
  F16: () => {
    assert.deepEqual([0, 40, 41, 179, 180].map(markerLqiBand),
      ['low', 'low', 'mid', 'mid', 'high']);
    return { decisionIds: ['diagnostics.lqi_low'] };
  },
  F17: presentationRow({
    id: 'vacuum', icon: 'mdi:robot-vacuum', entities: ['vacuum.robot'], primary: 'vacuum.robot',
    marker: { id: 'vacuum', binding: 'device:vacuum', vacuum: { live: true } },
  }, {}, (r) => assert.equal(r.vacuumLive, true)),
  A01: presentationRow({
    icon: 'mdi:smoke-detector', entities: ['binary_sensor.smoke'], primary: 'binary_sensor.smoke',
  }, { liveStates: false }, (r) => assert.deepEqual([r.pulse.kind, r.pulse.reason], ['alarm', 'alarm'])),
  A02: presentationRow({
    id: 'presence', icon: 'mdi:motion-sensor', entities: ['binary_sensor.presence'],
    primary: 'binary_sensor.presence',
    marker: { id: 'presence', binding: 'device:presence', display: 'badge' },
  }, {}, (r) => {
    assert.equal(r.pulse.kind, 'none');
    assert.ok(r.explanation.notices.includes('activity_display_disabled'));
  }),
  A03: () => {
    const h = rowHass();
    const item = device({
      id: 'presence', entities: ['binary_sensor.presence'], primary: 'binary_sensor.presence',
      marker: { id: 'presence', binding: 'device:presence', display: 'icon_ripple' },
    });
    const sources = activitySourceSignature(h, item);
    const live = resolveDevicePresentation(h, item, {
      ...options, activityRuntime: { sources, flashTs: 1_000, flashKind: 'event', gen: 2 },
    });
    const expired = resolveDevicePresentation(h, item, {
      ...options, now: 5_000,
      activityRuntime: { sources, flashTs: 1_000, flashKind: 'event', gen: 2 },
    });
    assert.deepEqual([live.pulse.kind, live.pulse.reason], ['short', 'event']);
    assert.notEqual(expired.pulse.kind, 'short');
    return live;
  },
  A04: presentationRow({
    id: 'presence', entities: ['binary_sensor.presence'], primary: 'binary_sensor.presence',
    marker: { id: 'presence', binding: 'device:presence', display: 'icon_ripple' },
  }, {}, (r) => assert.deepEqual([r.pulse.kind, r.pulse.reason], ['continuous', 'presence'])),
  A05: presentationRow({
    icon: 'mdi:garage', entities: ['cover.main'], primary: 'cover.main', tapAction: 'info',
    marker: { id: 'd1', binding: 'device:d1', display: 'icon_ripple' },
  }, {}, (r) => assert.deepEqual([r.pulse.kind, r.pulse.reason], ['continuous', 'transition'])),
  A06: presentationRow({
    id: 'vacuum', entities: ['vacuum.robot'], primary: 'vacuum.robot',
    marker: { id: 'vacuum', binding: 'device:vacuum', display: 'icon_ripple' },
  }, {}, (r) => assert.deepEqual([r.pulse.kind, r.pulse.reason], ['continuous', 'running'])),
  A07: () => {
    const variants = [
      resolveDevicePresentation(rowHass(), device({
        entities: ['switch.offline'], primary: 'switch.offline',
        marker: { id: 'd1', binding: 'device:d1', display: 'icon_ripple' },
      }), options),
      resolveDevicePresentation(rowHass(), device({
        hidden: true, userHidden: true,
        marker: { id: 'd1', binding: 'device:d1', hidden: true, display: 'icon_ripple' },
      }), options),
      resolveDevicePresentation(rowHass(), device({
        bindingStatus: { kind: 'orphaned', enabledEntityIds: [], allEntityIds: [] },
        entities: [], primary: null,
        marker: { id: 'd1', binding: 'device:d1', display: 'icon_ripple' },
      }), options),
      resolveDevicePresentation(rowHass(), device({
        marker: { id: 'd1', binding: 'device:d1', display: 'static_icon' },
      }), options),
    ];
    assert.ok(variants.every((r) => r.pulse.kind === 'none'));
    return variants[0];
  },
  A08: presentationRow({
    id: 'presence', entities: ['binary_sensor.presence'], primary: 'binary_sensor.presence',
    marker: { id: 'presence', binding: 'device:presence', display: 'icon_ripple' },
  }, { reducedMotion: true }, (r) => {
    assert.equal(r.pulse.kind, 'continuous');
    assert.equal(r.pulse.reducedMotionIndicator, 'dot');
    assert.equal(r.pulse.animated, false);
  }),
};

test('every documented decision row executes production code and checks an observable', () => {
  assert.deepEqual(Object.keys(rowRunners), DEVICE_PRESENTATION_DECISIONS.map((row) => row.id));
  for (const row of DEVICE_PRESENTATION_DECISIONS) {
    const result = rowRunners[row.id]();
    assertDecision(result, row.expectedDecision);
  }
});

test('device presentation decision table rows exercise lifecycle and ordered policy output', () => {
  const active = resolveDevicePresentationPolicy(basePolicy());
  assertDecision(active, 'lifecycle.active');
  assertDecision(active, 'status.neutral');
  assert.equal(active.effectiveHidden, false);

  const disabled = resolveDevicePresentationPolicy(basePolicy({ bindingLifecycle: 'ha_disabled' }));
  assertDecision(disabled, 'lifecycle.ha_disabled_hidden');
  assert.equal(disabled.effectiveHidden, true);
  assert.equal(disabled.pulseEligible, false);

  const hidden = resolveDevicePresentationPolicy(basePolicy({ userHidden: true }));
  assertDecision(hidden, 'lifecycle.user_hidden');
  assert.equal(hidden.effectiveHidden, true);
  const hiddenPreview = resolveDevicePresentationPolicy(basePolicy({
    userHidden: true, designPreview: true,
    sourceVisual: { availability: 'available', status: 'working', activity: 'running' },
  }));
  assertDecision(hiddenPreview, 'lifecycle.user_hidden_preview');
  assert.equal(hiddenPreview.visual.status, 'working');

  const orphaned = resolveDevicePresentationPolicy(basePolicy({ bindingLifecycle: 'orphaned' }));
  assertDecision(orphaned, 'lifecycle.orphaned_diagnostic');
  assert.equal(orphaned.bindingUnavailable, true);
  const staticFace = resolveDevicePresentationPolicy(basePolicy({
    display: 'static_icon', valueAvailable: true, vacuumLiveRequested: true,
    sourceVisual: { availability: 'available', status: 'alarm', activity: 'running' },
  }));
  assertDecision(staticFace, 'face.static');
  assert.deepEqual(staticFace.visual, neutral);
  assert.equal(staticFace.face, 'icon');
  assert.equal(staticFace.metrics, false);
  assert.equal(staticFace.vacuumLive, false);

  const alarm = resolveDevicePresentationPolicy(basePolicy({
    liveStates: false,
    sourceVisual: { availability: 'available', status: 'alarm', activity: 'none' },
  }));
  assertDecision(alarm, 'status.alarm');
  assert.equal(alarm.visual.status, 'alarm');
  assert.equal(alarm.pulseEligible, true);

  const noLive = resolveDevicePresentationPolicy(basePolicy({
    liveStates: false,
    sourceVisual: { availability: 'available', status: 'working', activity: 'running' },
  }));
  assertDecision(noLive, 'face.live_states_disabled');
  assert.deepEqual(noLive.visual, neutral);

  for (const status of ['working', 'open', 'neutral']) {
    const result = resolveDevicePresentationPolicy(basePolicy({
      sourceVisual: { availability: 'available', status, activity: 'none' },
    }));
    assertDecision(result, `status.${status}`);
  }
  const unavailable = resolveDevicePresentationPolicy(basePolicy({
    sourceVisual: { availability: 'unavailable', status: 'neutral', activity: 'none' },
  }));
  assertDecision(unavailable, 'status.unavailable');
  assert.equal(unavailable.pulseEligible, false);

  const controllerUp = resolveDevicePresentationPolicy(basePolicy({
    controllerFace: true, controllerAvailability: 'available',
    sourceVisual: { availability: 'unavailable', status: 'neutral', activity: 'none' },
  }));
  assertDecision(controllerUp, 'availability.controller_available');
  assert.equal(controllerUp.visual.availability, 'available');
  const controllerDown = resolveDevicePresentationPolicy(basePolicy({
    controllerFace: true, controllerAvailability: 'unavailable',
    sourceVisual: { availability: 'available', status: 'working', activity: 'running' },
  }));
  assertDecision(controllerDown, 'availability.controller_unavailable');
  assert.equal(controllerDown.visual.availability, 'unavailable');
  assert.equal(controllerDown.visual.status, 'working');

  const value = resolveDevicePresentationPolicy(basePolicy({ display: 'value', valueAvailable: true }));
  assertDecision(value, 'content.value');
  assert.equal(value.face, 'value');
  for (const fallback of ['value_no_state', 'value_ambiguous_sources', 'value_non_scalar', 'value_virtual']) {
    const result = resolveDevicePresentationPolicy(basePolicy({
      display: 'value', valueAvailable: false, valueFallback: fallback,
    }));
    assert.equal(result.face, 'icon');
    assertDecision(result, `content.${fallback}`);
  }

  const diagnostics = resolveDevicePresentationPolicy(basePolicy({ vacuumLiveRequested: true }));
  assertDecision(diagnostics, 'diagnostics.dynamic_icon');
  assertDecision(diagnostics, 'diagnostics.metrics_enabled');
  assertDecision(diagnostics, 'diagnostics.vacuum_live');
});

test('source decision trace names every source winner and controller exception', () => {
  const h = hass({
    'cover.main': state('cover.main', 'opening', { device_class: 'curtain' }),
    'light.main': state('light.main', 'on'),
    'switch.main': state('switch.main', 'on'),
    'event.button': state('event.button', 'unknown'),
    'sensor.battery': state('sensor.battery', '100'),
    'binary_sensor.smoke': state('binary_sensor.smoke', 'on', { device_class: 'smoke' }),
  }, {
    'cover.main': { entity_id: 'cover.main', device_id: 'd1', platform: 'demo' },
    'light.main': { entity_id: 'light.main', device_id: 'd1', platform: 'demo' },
    'switch.main': { entity_id: 'switch.main', device_id: 'd1', platform: 'demo' },
    'event.button': { entity_id: 'event.button', device_id: 'd1', platform: 'demo' },
    'sensor.battery': { entity_id: 'sensor.battery', device_id: 'd1', platform: 'demo', entity_category: 'diagnostic' },
    'binary_sensor.smoke': { entity_id: 'binary_sensor.smoke', device_id: 'd1', platform: 'demo' },
  });

  const cover = resolvePresentationSources(h, device({
    entities: ['cover.main'], primary: 'cover.main', tapAction: 'info',
  }));
  assertDecision(cover, 'source.cover');
  assert.equal(cover.sourceKind, 'cover');

  const mixed = resolvePresentationSources(h, device({
    entities: ['light.main', 'cover.main'], primary: 'light.main', tapAction: 'info',
  }));
  assertDecision(mixed, 'source.cover_capability_bypassed');
  assertDecision(mixed, 'source.owned_light');
  assert.equal(mixed.sourceKind, 'light');

  const controlled = device({ marker: {
    id: 'd1', binding: 'device:d1', controls: ['light.main'],
  } });
  const controls = resolvePresentationSources(h, controlled);
  assertDecision(controls, 'source.controls');
  assert.equal(controls.sourceKind, 'controls');

  const virtual = resolvePresentationSources(h, device({
    virtual: true, bindingKind: 'virtual', entities: [], primary: null,
    marker: { id: 'virtual', binding: 'virtual', controls: ['light.main'] },
  }));
  assertDecision(virtual, 'source.virtual_controller');

  const manual = resolvePresentationSources(h, device({
    id: 'manual', virtual: true, bindingKind: 'virtual', entities: [], primary: null,
    marker: {
      id: 'manual', binding: 'virtual', is_light: true, tap_action: 'toggle',
      controls: ['light.main'],
    },
  }));
  assertDecision(manual, 'source.manual_virtual_light');

  const role = resolvePresentationSources(h, device());
  assertDecision(role, 'source.device_role');
  const primary = resolvePresentationSources(h, device({
    entities: [], primary: 'sensor.battery', marker: { id: 'd1', binding: 'device:d1' },
  }));
  assertDecision(primary, 'source.primary_fallback');
  const none = resolvePresentationSources(h, device({ entities: [], primary: null }));
  assertDecision(none, 'source.none');

  const filtered = resolvePresentationSources(h, device({
    entities: ['event.button', 'sensor.battery'], primary: 'event.button',
    controls: [],
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.missing'] },
  }));
  assertDecision(filtered, 'source.filtered_saved_controls');

  const critical = resolvePresentationSources(h, device({
    entities: ['switch.main', 'binary_sensor.smoke'], primary: 'switch.main',
    marker: { id: 'd1', binding: 'device:d1', controls: ['light.main'] },
  }));
  assertDecision(critical, 'source.critical_sibling');
  assert.equal(critical.criticalSources[0].eid, 'binary_sensor.smoke');
});

test('renderer-ready decision trace covers value, metrics, LQI, vacuum and pulse observables', () => {
  const h = hass({
    'sensor.temperature': state('sensor.temperature', '22.4', {
      device_class: 'temperature', unit_of_measurement: '°C',
    }),
    'sensor.device_linkquality': state('sensor.device_linkquality', '40'),
    'binary_sensor.presence': state('binary_sensor.presence', 'on', { device_class: 'presence' }),
    'vacuum.robot': state('vacuum.robot', 'cleaning'),
  }, {
    'sensor.temperature': { entity_id: 'sensor.temperature', device_id: 'd1', platform: 'demo' },
    'sensor.device_linkquality': { entity_id: 'sensor.device_linkquality', device_id: 'd1', platform: 'demo', entity_category: 'diagnostic' },
    'binary_sensor.presence': { entity_id: 'binary_sensor.presence', device_id: 'presence', platform: 'demo' },
    'vacuum.robot': { entity_id: 'vacuum.robot', device_id: 'vacuum', platform: 'demo' },
  });
  const temperature = resolveDevicePresentation(h, device({
    icon: 'mdi:thermometer', entities: ['sensor.temperature', 'sensor.device_linkquality'],
    primary: 'sensor.temperature',
    marker: {
      id: 'd1', binding: 'device:d1', display: 'value',
      value_badge: { enabled: true, source: { kind: 'derived_lqi' }, position: 'bottom' },
    },
  }), options);
  assert.equal(temperature.valueText, '22.4°');
  assert.equal(temperature.valueBadge?.text, '40');
  assertDecision(temperature, 'content.value');
  assertDecision(temperature, 'diagnostics.value_badge');
  assertDecision(temperature, 'diagnostics.lqi_low');

  const vacuum = resolveDevicePresentation(h, device({
    id: 'vacuum', icon: 'mdi:robot-vacuum', entities: ['vacuum.robot'], primary: 'vacuum.robot',
    marker: { id: 'vacuum', binding: 'device:vacuum', vacuum: { live: true } },
  }), options);
  assert.equal(vacuum.vacuumLive, true);
  assertDecision(vacuum, 'diagnostics.vacuum_live');

  const presenceDevice = device({
    id: 'presence', icon: 'mdi:motion-sensor', entities: ['binary_sensor.presence'],
    primary: 'binary_sensor.presence',
    marker: { id: 'presence', binding: 'device:presence', display: 'icon_ripple' },
  });
  const presence = resolveDevicePresentation(h, presenceDevice, options);
  assert.equal(presence.pulse.kind, 'continuous');
  assert.equal(presence.pulse.reason, 'presence');
  assertDecision(presence, 'pulse.continuous_presence');

  const reduced = resolveDevicePresentation(h, presenceDevice, { ...options, reducedMotion: true });
  assert.equal(reduced.pulse.reducedMotionIndicator, 'dot');

  const noRipple = resolveDevicePresentation(h, {
    ...presenceDevice, marker: { ...presenceDevice.marker, display: 'badge' },
  }, options);
  assert.equal(noRipple.pulse.kind, 'none');
  assertDecision(noRipple, 'activity.pulse_suppressed');

  const eventDevice = device({
    id: 'event', entities: ['binary_sensor.presence'], primary: 'binary_sensor.presence',
    marker: { id: 'event', binding: 'device:presence', display: 'icon_ripple' },
  });
  const signature = activitySourceSignature(h, eventDevice);
  const event = resolveDevicePresentation(h, eventDevice, {
    ...options,
    activityRuntime: { sources: signature, flashTs: 1_000, flashKind: 'event', gen: 2 },
  });
  assert.equal(event.pulse.kind, 'short');
  assertDecision(event, 'pulse.short_event');

  const expired = resolveDevicePresentation(h, eventDevice, {
    ...options, now: 5_000,
    activityRuntime: { sources: signature, flashTs: 1_000, flashKind: 'event', gen: 2 },
  });
  assert.notEqual(expired.pulse.kind, 'short');

  const sourceFiles = [
    '../src/devices.ts', '../src/houseplan-card.ts', '../src/hp-device-preview.ts',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));
  assert.match(sourceFiles[0], /if \(m\.removed\) continue/);
  assert.match(sourceFiles[1], /resolveDevicePresentation\(/);
  assert.match(sourceFiles[2], /renderDeviceFace\(shown/);
});
