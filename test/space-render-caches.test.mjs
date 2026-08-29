import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvedLightSources } from '../test-build/devices.js';
import {
  cachedStaticLightBarriers, cachedStaticEnabledClip,
} from '../test-build/space-render.js';

// #375 AC1: the light-graph cache is keyed by the ARRAY IDENTITY. The glow
// scene must therefore pass the caller's array as-is; a fresh spread would
// guarantee a miss on every render — in the space card AND the full card.

test('#375 AC1: resolvedLightSources reuses the cached graph for a stable array', () => {
  const hass = {
    states: { 'light.l': { state: 'on', attributes: {} } },
    entities: {},
    devices: {},
  };
  const lamp = {
    id: 'lamp', name: 'Lamp', model: '', area: 'room', space: 'floor',
    icon: 'mdi:lightbulb', is_light: true, binding: 'entity:light.l',
    entity: 'light.l', entities: ['light.l'], x: 0.5, y: 0.5,
  };
  const devices = [lamp];
  const manual = { rev: 1, configRev: 1, off: new Set() };
  const first = resolvedLightSources(hass, devices, null, manual);
  const second = resolvedLightSources(hass, devices, null, manual);
  assert.equal(first, second,
    'same array + same state must return the SAME cached sources object');
  const spreadMiss = resolvedLightSources(hass, [...devices], null, manual);
  assert.notEqual(first, spreadMiss,
    'a spread copy is a different WeakMap key — full rebuild (the bug of #375)');
});

test('#375 AC1: the glow scene passes input.devices without a spread', () => {
  const source = readFileSync(new URL('../src/glow-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /resolvedLightSources\(\s*input\.hass, input\.devices,/,
    'resolveGlowCandidates must hand the stable array to the cache');
  assert.ok(!source.includes('[...input.devices]'),
    'no spread on the cache key (#375 V6a)');
});

// #375 AC2: the static path attaches the same sourceFingerprint tag the full
// card attaches, from the same triple buildLightBarrierRevision fingerprints —
// proven the same way the full card's recut wiring is proven
// (performance-contract.test.mjs): by pinning the source.

test('#375 AC2: static wall geometry carries the recut fingerprint tag', () => {
  const render = readFileSync(new URL('../src/space-render.ts', import.meta.url), 'utf8');
  assert.match(render,
    /Object\.defineProperty\(built, 'sourceFingerprint', \{\s*\n\s*value: contentFingerprint\(\[spCfg, cellCm, GRID_PITCH\]\),/,
    'the tag must be the exact revision triple (rawSpaceConfig=spCfg, cellCm, gridPitch=GRID_PITCH)');
  const scene = readFileSync(new URL('../src/glow-scene.ts', import.meta.url), 'utf8');
  assert.match(scene, /sharedFingerprint === revision\.geometryFingerprint/,
    'glow-scene honours the tag by comparing it with the revision fingerprint');
});

// #375 AC3: a door flipping open<->close alternates two scene fingerprints;
// the static cache must hold both (LRU 8, parity with the full card's pool).

test('#375 AC3: scene cache survives a fingerprint ping-pong', () => {
  const cfg = { marker: 'cfg-a' };
  let builds = 0;
  const build = () => ({ built: ++builds });
  const sequence = ['open', 'closed', 'open', 'closed', 'open', 'closed'];
  const seen = sequence.map((fp) => cachedStaticLightBarriers(cfg, 'space-1', fp, build));
  assert.equal(builds, 2,
    'six alternating lookups must build exactly twice — one per fingerprint');
  assert.equal(seen[0], seen[2], 'the "open" scene is reused by identity');
  assert.equal(seen[1], seen[3], 'the "closed" scene is reused by identity');
});

test('#375 AC3: scene cache evicts least-recently-used beyond 8 entries', () => {
  const cfg = { marker: 'cfg-b' };
  let builds = 0;
  const build = () => ({ built: ++builds });
  for (let i = 0; i < 9; i++) cachedStaticLightBarriers(cfg, 's', `fp-${i}`, build);
  assert.equal(builds, 9);
  cachedStaticLightBarriers(cfg, 's', 'fp-8', build);
  assert.equal(builds, 9, 'the newest entry is still cached');
  cachedStaticLightBarriers(cfg, 's', 'fp-0', build);
  assert.equal(builds, 10, 'the oldest entry was evicted at capacity 8');
});

test('#375 AC3: scene cache is namespaced by space and by config object', () => {
  let builds = 0;
  const build = () => ({ built: ++builds });
  const cfg = { marker: 'cfg-c' };
  cachedStaticLightBarriers(cfg, 'space-1', 'fp', build);
  cachedStaticLightBarriers(cfg, 'space-2', 'fp', build);
  cachedStaticLightBarriers({ marker: 'cfg-d' }, 'space-1', 'fp', build);
  assert.equal(builds, 3, 'no cross-talk between spaces or config revisions');
});

// #375 AC4: the enabled-rooms clip is pure in the geometry fingerprint and the
// disabled-room set — a repeated hass tick must not redo boolean geometry.

test('#375 AC4: enabledClip is reused by identity for an unchanged key', () => {
  const cfg = { marker: 'cfg-e' };
  let builds = 0;
  const build = () => { builds++; return ['M 0 0 L 1 0 L 1 1 Z']; };
  const key = 'geom-fp|kitchen';
  const first = cachedStaticEnabledClip(cfg, 'space-1', key, build);
  const second = cachedStaticEnabledClip(cfg, 'space-1', key, build);
  assert.equal(builds, 1, 'the second tick must be a cache hit');
  assert.equal(first, second, 'reuse is by identity — no fresh arrays per tick');
  cachedStaticEnabledClip(cfg, 'space-1', 'geom-fp|kitchen,porch', build);
  assert.equal(builds, 2, 'a different disabled set is a different clip');
});
