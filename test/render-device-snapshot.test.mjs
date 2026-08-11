import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createRenderDeviceSnapshot, presentationSnapshotKey,
} from '../test-build/render-device-snapshot.js';

test('RenderDeviceSnapshot keeps immutable facts and excludes live HA capabilities', () => {
  const state = { entity_id: 'light.one', state: 'on', attributes: { brightness: 120 } };
  const device = { id: 'one', space: 'floor', entities: ['light.one'], icon: 'mdi:lightbulb' };
  const presentation = { icon: 'mdi:lightbulb', valueText: null, visual: { status: 'working' } };
  const snapshot = createRenderDeviceSnapshot({
    sourceSequence: 7,
    hass: {
      states: { 'light.one': state }, entities: {}, devices: {},
      connection: { live: true }, callService: () => undefined,
    },
    devices: [device],
    positions: new Map([['one', { x: 12, y: 34 }]]),
    presentations: new Map([[presentationSnapshotKey('one', true), presentation]]),
    facts: new Map([['vacuum:one', { moving: true }]]),
  });

  state.attributes.brightness = 1;
  device.entities.push('switch.other');
  presentation.visual.status = 'neutral';

  assert.equal(snapshot.sourceSequence, 7);
  assert.equal(snapshot.hass.connection, undefined);
  assert.equal(snapshot.hass.callService, undefined);
  assert.equal(snapshot.hass.states['light.one'].attributes.brightness, 120);
  assert.deepEqual(snapshot.devices[0].entities, ['light.one']);
  assert.deepEqual(snapshot.positions.get('one'), { x: 12, y: 34 });
  assert.equal(snapshot.presentations.get(presentationSnapshotKey('one', true)).visual.status, 'working');
  assert.equal(snapshot.facts.get('vacuum:one').moving, true);
  assert.equal('set' in snapshot.positions, false);
  assert.equal('set' in snapshot.presentations, false);
  assert.equal('set' in snapshot.facts, false);
});

const methodBody = (source, name) => {
  const start = source.indexOf(`private ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const tail = source.slice(start + 1);
  const next = tail.search(/\n  (?:private|protected|public)\s/);
  return source.slice(start, next < 0 ? source.length : start + 1 + next);
};

test('atomic plan render paths do not bypass RenderDeviceSnapshot with this.hass', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  for (const name of [
    '_roomLqi', '_resolvedRoomFills', '_sunNow', '_renderSunRays', '_renderGlowLayer',
    '_renderVacuums', '_renderVacFit', '_renderDevice', '_roomTemp', '_roomHum', '_openingAmt',
    '_renderOpeningLocks', '_renderDecorLayer',
  ]) {
    assert.doesNotMatch(methodBody(source, name), /this\.hass\b/, name);
  }
});
