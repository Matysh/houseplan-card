import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createGlowRuntimeState, disposeGlowRuntime, readGlowClip,
  resolveGlowCandidates, resolveLightBarrierRevision,
  transitionGlowSource, writeGlowClip,
} from '../test-build/glow-scene.js';

const square = (id, x0, x1) => ({
  id,
  poly: [[x0, 0], [x1, 0], [x1, 100], [x0, 100]],
});

test('shared light revision admits only floor-to-floor architectural passages', () => {
  const space = {
    id: 's', rooms: [square('left', 0, 100), square('right', 100, 200)],
    partitions: [], room_drafts: [], wall_columns: [],
  };
  const opening = (id, type, rx, amount) => ({
    id, type, rx, ry: 50, rlen: 40, angle: 90, amount,
    contact: type === 'door' ? `binary_sensor.${id}` : null,
  });
  const openings = [
    opening('inside-door', 'door', 100, 0.51),
    opening('outside-door', 'door', 0, 1),
    opening('window', 'window', 100, 1),
    opening('passage', 'passage', 100, 1),
  ];
  const revision = resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms },
    space,
    openings,
    cellCm: 5,
    gridPitch: 20,
    openingAmount: (candidate) => candidate.amount,
  });
  assert.deepEqual(
    revision.passageStates.map(({ opening: candidate }) => candidate.id),
    ['inside-door', 'passage'],
  );
  assert.equal(revision.passageStates[0].amount, 0.5);

  const sameBucket = resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms }, space,
    openings: openings.map((candidate) => candidate.id === 'inside-door'
      ? { ...candidate, amount: 0.52 } : candidate),
    cellCm: 5, gridPitch: 20,
    openingAmount: (candidate) => candidate.amount,
  });
  assert.equal(sameBucket.fingerprint, revision.fingerprint,
    'leaf animation inside one quantised aperture bucket must reuse barriers');

  const nextBucket = resolveLightBarrierRevision({
    rawSpaceConfig: { id: 's', rooms: space.rooms }, space,
    openings: openings.map((candidate) => candidate.id === 'inside-door'
      ? { ...candidate, amount: 0.8 } : candidate),
    cellCm: 5, gridPitch: 20,
    openingAmount: (candidate) => candidate.amount,
  });
  assert.notEqual(nextBucket.fingerprint, revision.fingerprint);
});

test('one shared source projection owns radius, colour and marker-stable identity', () => {
  const device = {
    id: 'lamp', name: 'Lamp', model: '', area: 'living', space: 's',
    icon: 'mdi:lightbulb', entities: [], virtual: true,
    marker: {
      id: 'lamp', binding: 'virtual', is_light: true,
      glow_radius_cm: 175, glow_color: { c: '#123456' },
    },
  };
  const [candidate] = resolveGlowCandidates({
    hass: { states: {} }, devices: [device], spaceId: 's',
    defaultColor: '#ffffff', paletteAlpha: 0.7,
    defaultRadiusUnits: 1200, cellCm: 5, gridPitch: 20,
    position: () => ({ x: 25, y: 75 }),
  });
  assert.equal(candidate.key, 's|lamp');
  assert.equal(candidate.sourceEid, '');
  assert.deepEqual(candidate.pos, { x: 25, y: 75 });
  assert.equal(candidate.radius, 700);
  assert.equal(candidate.appearance.c, '#123456');
  assert.ok(candidate.appearance.alpha > 0 && candidate.appearance.alpha <= 0.7);
});

test('shared Glow runtime is bounded and tears down every timer and source', () => {
  let seq = 0;
  const timers = new Set();
  const rafs = new Set();
  const fakeWindow = {
    setTimeout: () => { const id = ++seq; timers.add(id); return id; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: () => { const id = ++seq; rafs.add(id); return id; },
    cancelAnimationFrame: (id) => rafs.delete(id),
  };
  const host = {
    window: () => fakeWindow,
    isConnected: () => true,
    requestUpdate: () => undefined,
    reducedMotion: () => false,
  };
  const state = createGlowRuntimeState();
  const entering = transitionGlowSource(state, host, 's|lamp', true);
  assert.equal(entering.entering, true);
  assert.equal(state.renderedSources.has('s|lamp'), true);
  transitionGlowSource(state, host, 's|lamp', false);
  assert.equal(state.fadeTimers.has('s|lamp'), true);

  for (let index = 0; index < 300; index++) {
    writeGlowClip(state, `clip-${index}`, { lit: [`M ${index} 0 Z`] }, 256);
  }
  assert.equal(state.clipCache.size, 256);
  assert.equal(readGlowClip(state, 'clip-299').hit, true);
  assert.equal(readGlowClip(state, 'clip-0').hit, false);

  disposeGlowRuntime(state, host);
  assert.equal(state.renderedSources.size, 0);
  assert.equal(state.clipCache.size, 0);
  assert.equal(state.fadeTimers.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(rafs.size, 0);
});

test('space card exposes one explicit default-off visual-editor flag', () => {
  const card = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/space-editor.ts', import.meta.url), 'utf8');
  assert.match(card, /light_pools\?: boolean/);
  assert.match(card, /light_pools: false/);
  assert.match(card, /lightPools: this\._config\.light_pools === true/);
  assert.match(editor, /name: 'light_pools', selector: \{ boolean: \{\} \}/);
  assert.match(editor, /light_pools: t\(L, 'editor\.light_pools'\)/);
});
