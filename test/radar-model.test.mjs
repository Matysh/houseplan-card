import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMarkerRadarV1, radarHealthI18nKey, radarMarkerLiveInSpace,
  normalizeRadarFrame, radarArcPath, radarFrameAccepts, radarFrameExpired,
  radarFrameLeaseMs,
} from '../test-build/radar-model.js';

const frame = (overrides = {}) => ({
  server_session_id: 'session-a', marker_id: 'radar-1', seq: 1,
  source_generation: 'sources-a', calibration_revision: 'cal-a',
  reported_at: 100, expires_at: 103, health: 'ok', complete: true,
  reported_presence: true,
  targets: [{ slot: 'target_1', x: 12, y: 20, reported_at: 100,
    expires_at: 103, pair_quality: 'bounded_latest', included: true }],
  ranges: [], zones: [], ...overrides,
});

test('radar frames reject malformed geometry and cap nested payloads', () => {
  const normalized = normalizeRadarFrame(frame({
    targets: [
      ...frame().targets,
      { slot: 'bad', x: Number.NaN, y: 0, reported_at: 1, expires_at: 2,
        pair_quality: 'bounded_latest', included: true },
    ],
    ranges: [{ id: 'r', x: 10, y: 20, radius: 3, reported_at: 100, expires_at: 103,
      segments: [[[1, 2], [3, 4]], [[Number.NaN, 2], [3, 4]]] }],
    zones: [{ id: 'desk', state: true, polygon: [[.1, .1], [.3, .1], [.3, .3]] },
      { id: 'broken', state: true, polygon: [[.1, Number.NaN], [.2, .2], [.3, .3]] }],
  }));
  assert.ok(normalized);
  assert.equal(normalized.targets.length, 1);
  assert.deepEqual(normalized.ranges[0].segments, [[[1, 2], [3, 4]]]);
  assert.deepEqual(normalized.zones[0].polygon, [[.1, .1], [.3, .1], [.3, .3]]);
  assert.equal(normalized.zones[1].polygon, undefined);
  assert.equal(normalizeRadarFrame({ marker_id: 'x' }), null);
});

test('session, source and calibration epochs reset sequence ordering', () => {
  const old = normalizeRadarFrame(frame());
  assert.ok(old);
  assert.equal(radarFrameAccepts(old, normalizeRadarFrame(frame({ seq: 1 }))), false);
  assert.equal(radarFrameAccepts(old, normalizeRadarFrame(frame({ seq: 2 }))), true);
  assert.equal(radarFrameAccepts(old, normalizeRadarFrame(frame({
    seq: 0, server_session_id: 'session-b',
  }))), true);
  assert.equal(radarFrameAccepts(old, normalizeRadarFrame(frame({
    seq: 0, source_generation: 'sources-b',
  }))), true);
});

test('finite coordinate leases expire while binary-only frames do not', () => {
  assert.equal(radarFrameExpired(normalizeRadarFrame(frame()), 102_999), false);
  assert.equal(radarFrameExpired(normalizeRadarFrame(frame()), 103_000), true);
  assert.equal(radarFrameExpired(normalizeRadarFrame(frame({ expires_at: null })), 999_999), false);
});

test('receipt lease deducts transport age and never exceeds the server lease', () => {
  const current = normalizeRadarFrame(frame());
  assert.equal(radarFrameLeaseMs(current, 100_500), 2_500);
  assert.equal(radarFrameLeaseMs(current, 99_000), 3_000);
  assert.equal(radarFrameLeaseMs(current, 104_000), 0);
  assert.equal(radarFrameLeaseMs(normalizeRadarFrame(frame({ expires_at: null }))), null);
});

test('range arcs are honest arcs, including a full circle', () => {
  assert.match(radarArcPath({ x: 0, y: 0, radius: 5, fov_deg: 90 }), /^M /);
  assert.equal((radarArcPath({ x: 0, y: 0, radius: 5, fov_deg: 360 })
    .match(/ A /g) || []).length, 2);
  assert.equal(radarArcPath({ x: 0, y: 0, radius: 5 }), null);
});

test('live marker filtering is space-, visibility- and opt-in-safe', () => {
  const marker = { id: 'radar-1', space: 'ground', radar: {
    version: 1, enabled: true, show_live: true,
  } };
  assert.equal(isMarkerRadarV1(marker.radar), true);
  assert.equal(radarMarkerLiveInSpace(marker, 'ground'), true);
  assert.equal(radarMarkerLiveInSpace({ ...marker, hidden: true }, 'ground'), false);
  assert.equal(radarMarkerLiveInSpace(marker, 'upper'), false);
  assert.equal(radarMarkerLiveInSpace({ ...marker, radar: {
    ...marker.radar, enabled: false,
  } }, 'ground'), false);
});

test('radar health respects disabled config before runtime state', () => {
  const radar = { version: 1, enabled: false, show_live: true };
  assert.equal(radarHealthI18nKey(radar, 'ok'), 'radar.health_disabled');
  assert.equal(radarHealthI18nKey({ ...radar, enabled: true }, 'ok'), 'radar.health_ok');
  assert.equal(radarHealthI18nKey({ ...radar, enabled: true }, 'partial'), 'radar.health_partial');
  assert.equal(radarHealthI18nKey({ ...radar, enabled: true }, 'restricted'), 'radar.health_restricted');
  assert.equal(radarHealthI18nKey({ ...radar, enabled: true }, 'incomplete'), 'radar.health_incomplete');
  assert.equal(radarHealthI18nKey({ ...radar, enabled: true }, 'future_status'),
    'radar.health_unknown');
});
