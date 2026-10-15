import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveShowLqi, globalSignalVisibleOf, signalVisibilityModeOf,
  signalVisibilityOverrideOf, writeGlobalSignalVisibility, writeSpaceSignalVisibility,
} from '../test-build/signal-visibility.js';
import { spaceDisplayOf } from '../test-build/logic.js';
import { rememberGeneralBaseline, generalDirty } from '../test-build/editors/general-form-state.js';
import { resolveDevicePresentation } from '../test-build/device-presentation.js';
import { createDeviceSignalContext } from '../test-build/device-signal.js';

test('#876 AC1: complete global × space × YAML matrix, including the old true default', () => {
  for (const global of [undefined, true, false]) for (const card of [undefined, true, false]) {
    for (const mode of ['inherit', 'on', 'off']) {
      const space = { show_lqi_mode: mode, show_lqi: mode === 'inherit' ? false : mode === 'on' };
      const expected = mode === 'on' ? true : mode === 'off' ? false : card === false ? false : global !== false;
      assert.equal(effectiveShowLqi({ show_lqi: global }, spaceDisplayOf({ settings: space }).showLqi, card),
        expected, JSON.stringify({ global, card, mode }));
    }
    for (const legacy of [undefined, true, false]) {
      const expected = legacy === false ? false : card === false ? false : global !== false;
      assert.equal(effectiveShowLqi({ show_lqi: global }, spaceDisplayOf({ settings: { show_lqi: legacy } }).showLqi, card),
        expected, JSON.stringify({ global, card, legacy }));
    }
  }
});

test('#876 AC1: invalid legacy values default on, exact false alone is an exception', () => {
  for (const bad of [null, 0, 1, '', 'false', [], {}]) {
    assert.equal(globalSignalVisibleOf({ show_lqi: bad }), true);
    assert.equal(signalVisibilityModeOf({ show_lqi: bad }), 'inherit');
    assert.equal(effectiveShowLqi({}, null, bad), true);
    assert.equal(effectiveShowLqi({ show_lqi: false }, null, bad), false);
  }
  assert.equal(effectiveShowLqi({ show_lqi: false }, true, false), true);
  assert.equal(effectiveShowLqi({}, null, false), false);
});

test('#876 AC2/4: form round-trip is idempotent, inherit removes a historical false without losing extensions', () => {
  const original = { show_lqi: false, future: { untouched: 1 }, label_lqi: true };
  for (const mode of ['inherit', 'on', 'off']) {
    const next = writeSpaceSignalVisibility(original, mode);
    assert.equal(signalVisibilityModeOf(JSON.parse(JSON.stringify(next))), mode);
    assert.deepEqual(writeSpaceSignalVisibility(next, mode), next);
    assert.deepEqual(next.future, original.future);
    assert.equal(next.label_lqi, true);
    assert.equal(original.show_lqi, false);
    if (mode === 'inherit') {
      assert.equal(Object.hasOwn(next, 'show_lqi'), false);
      assert.equal(Object.hasOwn(next, 'show_lqi_mode'), false);
    } else assert.equal(next.show_lqi, mode === 'on');
  }
  const historicalTrue = { show_lqi: true, future: 7 };
  assert.deepEqual(writeSpaceSignalVisibility(historicalTrue, signalVisibilityModeOf(historicalTrue)), { future: 7 });
});

test('#876 AC2: global draft dirty/cancel is independent of accepted settings', () => {
  const saved = Object.freeze({ show_lqi: false, future: 7 });
  const host = {}, draft = { showLqi: globalSignalVisibleOf(saved), busy: false };
  rememberGeneralBaseline(host, draft);
  assert.equal(generalDirty(host, draft), false);
  assert.equal(generalDirty(host, { ...draft, showLqi: true }), true);
  assert.equal(saved.show_lqi, false);
  const next = { ...saved };
  writeGlobalSignalVisibility(next, true);
  assert.deepEqual(next, { future: 7 });
  writeGlobalSignalVisibility(next, false);
  assert.deepEqual(next, { future: 7, show_lqi: false });
});

test('#876 AC7: room-card metric stays independent of effective system LQI', () => {
  for (const label of [false, true]) for (const global of [false, true]) {
    const display = spaceDisplayOf({ settings: { label_lqi: label } });
    assert.equal(display.labelLqi, label);
    assert.equal(effectiveShowLqi({ show_lqi: global }, display.showLqi, true), global);
  }
});

test('#876 AC7: bounded pure policy never touches unrelated metadata, fetch or geometry at any volume', () => {
  const forbidden = () => { throw new Error('visibility must not inspect HA/geometry'); };
  const settings = { show_lqi: false, get entities() { return forbidden(); }, get callWS() { return forbidden(); } };
  const spaces = Array.from({ length: 50 }, (_, i) => ({ show_lqi_mode: ['inherit', 'on', 'off'][i % 3] }));
  let shown = 0;
  for (let frame = 0; frame < 100; frame++) for (const space of spaces) {
    const local = signalVisibilityOverrideOf(signalVisibilityModeOf(space));
    for (let device = 0; device < 200; device++) shown += Number(effectiveShowLqi(settings, local, true));
  }
  assert.equal(shown, 17 * 200 * 100);
});

test('#876 AC3: effective off does not hide an explicit LQI value or a separate battery diagnostic', () => {
  const hass = {
    states: {
      'sensor.environment': { state: '20', attributes: {} },
      'sensor.linkquality': { state: '123', attributes: { unit_of_measurement: 'lqi' } },
      'sensor.battery': { state: '70', attributes: { device_class: 'battery', unit_of_measurement: '%' } },
    },
    entities: Object.fromEntries(['sensor.environment', 'sensor.linkquality', 'sensor.battery']
      .map(entity_id => [entity_id, { entity_id, device_id: 'radio', platform: 'demo' }])),
    devices: { radio: { id: 'radio' } },
  };
  const device = {
    id: 'radio', name: 'Radio', model: '', area: 'room', space: 'floor', icon: 'mdi:chip',
    entities: Object.keys(hass.entities), primary: 'sensor.environment', bindingKind: 'device', bindingRef: 'radio',
    bindingStatus: { kind: 'active', enabledEntityIds: Object.keys(hass.entities), allEntityIds: Object.keys(hass.entities) },
    marker: { id: 'radio', binding: 'device:radio', display: 'value', value_source: { kind: 'derived_lqi' } },
  };
  for (const global of [false, true]) {
    const presentation = resolveDevicePresentation(hass, device, {
      showSignal: effectiveShowLqi({ show_lqi: global }, null, true), showBattery: true,
      liveStates: true, showTemperature: true,
    });
    assert.equal(presentation.valueText, '123');
    assert.equal(presentation.battery?.state, 'normal');
    assert.equal(presentation.lqiText, null, 'the explicitly displayed value is never duplicated');
  }
});

test('#876/#867 AC3/7: shared/local/YAML policy composes with local hide for both binding kinds', () => {
  const h = { states: { 'switch.own': { state: 'off', attributes: {} },
    'sensor.own_linkquality': { state: '137', attributes: {} } },
  entities: { 'switch.own': { device_id: 'radio' }, 'sensor.own_linkquality': { device_id: 'radio' } },
  devices: { radio: {} } };
  const context = createDeviceSignalContext(h);
  for (const kind of ['device', 'entity']) for (const hide of [false, true])
    for (const global of [undefined, true, false]) for (const mode of ['inherit', 'on', 'off'])
      for (const yaml of [undefined, true, false]) {
        const id = `${kind}-marker`, ref = kind === 'entity' ? 'switch.own' : 'radio';
        const d = { id, name: id, model: '', icon: 'mdi:toggle-switch', area: 'room', space: 'floor',
          entities: kind === 'entity' ? ['switch.own'] : Object.keys(h.entities), primary: 'switch.own',
          bindingKind: kind, bindingRef: ref, bindingStatus: { kind: 'active' },
          marker: { id, binding: `${kind}:${ref}`, hide_signal: hide, display: 'badge' } };
        const local = signalVisibilityOverrideOf(mode), show = effectiveShowLqi({ show_lqi: global }, local, yaml);
        const expected = mode === 'on' || (mode === 'inherit' && yaml !== false && global !== false);
        const options = { showSignal: show, liveStates: true, showTemperature: true,
          showBattery: false, signalContext: context };
        const p = resolveDevicePresentation(h, d, options);
        const identity = JSON.stringify({ kind, hide, global, mode, yaml });
        assert.equal(p.lqiText, expected && !hide ? '137' : null, identity);
        assert.equal(p.lqiTipText, expected ? '137' : null, identity);
        assert.equal(p.battery, null, identity);
        const badge = resolveDevicePresentation(h, { ...d, marker: { ...d.marker,
          value_badge: { enabled: true, source: { kind: 'derived_lqi' } } } }, options);
        assert.equal(badge.valueBadge.text, '137', identity);
        assert.equal(badge.lqiText, null, 'the explicit badge is not duplicated');
        const value = resolveDevicePresentation(h, { ...d, marker: { ...d.marker,
          display: 'value', value_source: { kind: 'derived_lqi' } } }, options);
        assert.equal(value.valueText, '137', identity);
      }
});
