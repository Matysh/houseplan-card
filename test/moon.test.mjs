// #661: the moon over the "Follow the Sun" background — astronomy (AC1),
// visibility rules (AC2), phase mask (AC3), fingerprint and ticker (AC4) and
// the designer pack gate. Pure: test-build modules, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { nothing } from 'lit';
import {
  MOON_ELEVATION_MIN, MOON_MIN_ILLUMINATION, MOON_R, MOON_SHARP_FROM,
  moonFingerprint, moonIllumination, moonPhasePath, moonPosition, moonShownAt, moonView,
} from '../test-build/moon.js';
import { MOON_TICK_MS, moonTick, renderMoon } from '../test-build/moon-runtime.js';
import { moonLayer } from '../test-build/moon-gate.js';
import { RAY_ELEVATION_MIN, RAY_FADE_MS, bgModeOf, resolveDayCycle } from '../test-build/sun.js';
import { renderDayCycleEnvironment } from '../test-build/day-cycle-render.js';
import { moonArtFromSvg, validateMoonPack } from '../scripts/generate-moon-assets.mjs';

const MOSCOW = { latitude: 55.75, longitude: 37.62 };
const SYDNEY = { latitude: -33.87, longitude: 151.21 };
const ON = { moon: true, bg_mode: 'daynight' };

/**
 * AC1 reference: JPL Horizons, observer table, `CENTER='coord@399'` with
 * `SITE_COORD='<lon>,<lat>,0'`, `QUANTITIES='4,10'` (apparent az/el and
 * illuminated fraction), `APPARENT='AIRLESS'`, `TIME_TYPE=UT`, one row per
 * epoch below. Moscow 55.75 N 37.62 E, Sydney 33.87 S 151.21 E, October 2026.
 */
const HORIZONS = [
  ['2026-10-01T18:00:00Z', MOSCOW, 9.052, 70.03],
  ['2026-10-02T18:00:00Z', MOSCOW, 3.018, 59.01],
  ['2026-10-03T18:00:00Z', MOSCOW, -3.347, 47.57],
  ['2026-10-10T18:00:00Z', MOSCOW, -32.212, 0.176],
  ['2026-10-18T18:00:00Z', MOSCOW, 4.050, 50.44],
  ['2026-10-21T18:00:00Z', MOSCOW, 23.279, 78.16],
  ['2026-10-25T18:00:00Z', MOSCOW, 37.066, 99.67],
  ['2026-10-26T20:00:00Z', MOSCOW, 48.978, 99.27],
  ['2026-10-31T18:00:00Z', MOSCOW, -0.096, 62.05],
  ['2026-10-12T09:00:00Z', SYDNEY, 8.150, 3.00],
  ['2026-10-14T09:00:00Z', SYDNEY, 30.692, 13.20],
  ['2026-10-20T09:00:00Z', SYDNEY, 72.716, 66.31],
];

test('#661 AC1: altitude within 1.5° and illumination within 2.5 pp of JPL Horizons', () => {
  for (const [utc, place, altitude, percent] of HORIZONS) {
    const date = new Date(utc);
    const position = moonPosition(date, place.latitude, place.longitude);
    const { fraction } = moonIllumination(date);
    assert.ok(Math.abs(position.altitude - altitude) <= 1.5,
      `${utc} ${place.latitude}: altitude ${position.altitude.toFixed(3)} vs ${altitude}`);
    assert.ok(Math.abs(fraction * 100 - percent) <= 2.5,
      `${utc} ${place.latitude}: illumination ${(fraction * 100).toFixed(2)} vs ${percent}`);
    assert.ok(position.azimuth >= 0 && position.azimuth < 360);
  }
});

test('#661 AC1: waxing follows the lunation (first quarter grows, last quarter shrinks)', () => {
  assert.equal(moonIllumination(new Date('2026-10-14T09:00:00Z')).waxing, true);
  assert.equal(moonIllumination(new Date('2026-10-21T18:00:00Z')).waxing, true);
  assert.equal(moonIllumination(new Date('2026-10-31T18:00:00Z')).waxing, false);
});

test('#661 C1: the moon keeps the rays’ horizon and a 3 % new-moon threshold', () => {
  assert.equal(MOON_ELEVATION_MIN, RAY_ELEVATION_MIN);
  assert.equal(MOON_ELEVATION_MIN, 3);
  assert.equal(MOON_MIN_ILLUMINATION, 0.03);
});

test('#661 AC2: visibility thresholds on both sides', () => {
  for (const phase of ['dawn', 'dusk', 'night']) {
    assert.equal(moonShownAt(phase, 2.9, 0.5), false, `${phase} 2.9°`);
    assert.equal(moonShownAt(phase, 3.0, 0.5), true, `${phase} 3.0°`);
    assert.equal(moonShownAt(phase, 30, 0.029), false, `${phase} k 0.029`);
    assert.equal(moonShownAt(phase, 30, 0.03), true, `${phase} k 0.03`);
  }
  assert.equal(moonShownAt('day', 45, 1), false);
});

test('#661 AC2: only an explicit true, finite home coordinates and an environment show the moon', () => {
  const at = new Date('2026-10-21T18:00:00Z');
  assert.equal(moonView(ON, 'night', MOSCOW, at).visible, true);
  for (const settings of [undefined, null, {}, { moon: false }, { moon: 'true' }, { moon: 1 }]) {
    assert.equal(moonView(settings, 'night', MOSCOW, at).visible, false, JSON.stringify(settings));
  }
  for (const config of [undefined, null, {}, { latitude: '55.75', longitude: 37.62 },
    { latitude: Number.NaN, longitude: 37.62 }, { latitude: 55.75, longitude: null }]) {
    assert.equal(moonView(ON, 'night', config, at).visible, false, JSON.stringify(config));
  }
  assert.equal(moonView(ON, 'day', MOSCOW, at).visible, false);
  // bg_mode static — global or per space — leaves no environment, so no moon.
  const host = fakeHost(MOSCOW);
  const night = { 'sun.sun': { attributes: { azimuth: 0, elevation: -12, rising: false } } };
  for (const [global, space] of [[{ ...ON, bg_mode: 'static' }, {}], [ON, { bg_mode: 'static' }]]) {
    const state = bgModeOf(global, space) === 'daynight' ? resolveDayCycle({ states: night }, at) : null;
    assert.equal(moonLayer(host, global, state), nothing);
  }
  assert.equal(moonLayer(host, { moon: false }, resolveDayCycle({ states: night }, at)), nothing);
  assert.equal(moonLayer(undefined, ON, resolveDayCycle({ states: night }, at)), nothing);
});

/** Decode `A rx ry rot large sweep x y` of the terminator from the mask path. */
function terminatorOf(path) {
  const arcs = [...path.matchAll(/A([\d.]+) ([\d.]+) 0 0 ([01]) ([\d.]+) ([\d.]+)/g)]
    .map((match) => match.slice(1).map(Number));
  return { outer: arcs[0], terminator: arcs[1] ?? null };
}

test('#661 AC3: the mask is the left half plus or minus the terminator half-ellipse', () => {
  for (const k of [0.03, 0.25, 0.5, 0.75, 0.97]) {
    const path = moonPhasePath(k);
    const { outer, terminator } = terminatorOf(path);
    // The lit half's outer arc runs along the box (r 256), counter-clockwise
    // from the top: through the LEFT edge, never along the limb.
    assert.deepEqual(outer, [256, 256, 0, 256, 512], `${k}: outer arc`);
    const rx = MOON_R * Math.abs(2 * k - 1);
    if (rx < 0.5) {
      assert.equal(terminator, null, `${k}: a half moon has a straight terminator`);
      assert.match(path, /L256 496L256 16L256 0Z$/);
      continue;
    }
    const [trx, try_, sweep, x, y] = terminator;
    assert.ok(Math.abs(trx - rx) < 0.01, `${k}: rx ${trx} vs ${rx}`);
    assert.equal(try_, MOON_R);
    assert.deepEqual([x, y], [256, 16], `${k}: the terminator ends at the north pole`);
    // sweep 0 bulges right, into the dark side: the lit area grows past half.
    const litShare = 0.5 + (sweep === 0 ? 1 : -1) * (trx / MOON_R) / 2;
    assert.ok(Math.abs(litShare - k) < 1e-3, `${k}: lit share ${litShare}`);
  }
});

test('#661 AC3 (owner 2026-09-29): one lit side in both hemispheres, waxing or waning', () => {
  // Sydney 2026-10-14 09:00Z: waxing crescent, 14 % — lit on the LEFT, like Moscow.
  const at = new Date('2026-10-14T09:00:00Z');
  const hosts = [fakeHost(SYDNEY), fakeHost(MOSCOW)];
  const sydney = renderMoon(hosts[0], ON, 'dusk', at);
  const moscow = renderMoon(hosts[1], ON, 'night', at);
  hosts.forEach(forgetHost);
  const pathOf = (result) => result.values.find((value) => typeof value === 'string' && value.startsWith('M256 0A256'));
  assert.equal(pathOf(sydney), pathOf(moscow));
  assert.equal(pathOf(sydney), moonPhasePath(0.14));
  // Waxing and waning at the same k draw the same state backwards.
  const waxing = new Date('2026-10-21T18:00:00Z');
  const waning = new Date('2026-10-29T12:00:00Z');
  assert.equal(moonIllumination(waxing).waxing, true);
  assert.equal(moonIllumination(waning).waxing, false);
  assert.equal(moonPhasePath(0.78), moonPhasePath(Math.round(0.78 * 100) / 100));
});

test('#661 C5: the feathered terminator stops only for a full disc', () => {
  assert.equal(MOON_SHARP_FROM, 0.995);
  const host = fakeHost(MOSCOW);
  const filterOf = (at) => renderMoon(host, ON, 'night', new Date(at)).values
    .find((value) => value === nothing || value === 'url(#hp-moon-soft)');
  assert.equal(filterOf('2026-10-21T18:00:00Z'), 'url(#hp-moon-soft)');
  forgetHost(host);
});

function fakeHost(config) {
  return {
    isConnected: true,
    updates: 0,
    updateComplete: Promise.resolve(true),
    hass: { config },
    requestUpdate() { this.updates++; },
  };
}

function forgetHost(host) {
  host.isConnected = false;
  moonTick(host);
}

test('#661 AC4: three ticks over an unchanged moon cost no render', () => {
  const host = fakeHost(MOSCOW);
  const start = new Date('2026-10-21T18:00:00Z');
  renderMoon(host, ON, 'night', start);
  for (let tick = 1; tick <= 3; tick++) moonTick(host, new Date(start.getTime() + tick * MOON_TICK_MS));
  assert.equal(host.updates, 0);
  assert.equal(
    moonFingerprint(moonView(ON, 'night', MOSCOW, start)),
    moonFingerprint(moonView(ON, 'night', MOSCOW, new Date(start.getTime() + 3 * MOON_TICK_MS))),
  );
  forgetHost(host);
});

test('#661 AC4: the tick asks for exactly one render when the moon sets below 3°', async () => {
  // Moscow 2026-10-21: 3.026° at 22:37Z, 2.902° at 22:38Z (the setting side).
  const host = fakeHost(MOSCOW);
  renderMoon(host, ON, 'night', new Date('2026-10-21T22:30:00Z'));
  moonTick(host, new Date('2026-10-21T22:45:00Z'));
  moonTick(host, new Date('2026-10-21T22:45:30Z'));
  assert.equal(host.updates, 1);
  // The host re-rendered without a moon (switched off): its ticker is dropped.
  await host.updateComplete;
  await Promise.resolve();
  moonTick(host, new Date('2026-10-22T12:00:00Z'));
  assert.equal(host.updates, 1);
});

test('#661 C4: the element fades on the background curve for two seconds', () => {
  const host = fakeHost(MOSCOW);
  const result = renderMoon(host, ON, 'night', new Date('2026-10-21T18:00:00Z'));
  forgetHost(host);
  const css = result.values[0];
  assert.match(css, new RegExp(`transition:opacity ${RAY_FADE_MS}ms cubic-bezier\\(\\.22,\\.61,\\.36,1\\)`));
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.hp-moon\{transition:none\}/);
  assert.match(css, /--hp-moon-box:min\(200px,25cqmin\)/);
  assert.match(css, /pointer-events:none/);
  assert.doesNotMatch(css, /filter|will-change|z-index/);
});

test('#661 C6: the moon is the environment’s last child — above the phases, below the plan', () => {
  const state = resolveDayCycle({ states: { 'sun.sun': { attributes: { azimuth: 0, elevation: -12, rising: false } } } });
  const moon = { moon: 'marker' };
  const env = renderDayCycleEnvironment(state, 1, moon);
  const at = env.values.indexOf(moon);
  assert.ok(at > 0, 'the environment carries the moon');
  assert.equal(env.strings[at + 1].trim(), '</div>', 'the environment closes right after the moon');
  assert.match(env.strings[0], /class="hp-day-cycle-env"/);
});

test('#661 pack: generated art is fresh, and the gate refuses what the brief forbids', () => {
  const run = spawnSync(process.execPath, ['scripts/generate-moon-assets.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const pack = JSON.parse(readFileSync(new URL('../assets/moon/houseplan-1.0.0/pack.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateMoonPack(pack));
  assert.throws(() => validateMoonPack({ ...pack, mirror: true }), /mirror/);
  assert.throws(() => validateMoonPack({ ...pack, disc: { cx: 256, cy: 256, r: 256 } }), /disc/);
  const svg = readFileSync(new URL('../assets/moon/houseplan-1.0.0/moon.svg', import.meta.url), 'utf8');
  const art = moonArtFromSvg(svg);
  assert.doesNotMatch(art, /<title|id="[abc]"/);
  assert.match(art, /url\(#hp-moon-a\)/);
  const root = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">';
  assert.throws(() => moonArtFromSvg(`${root}<filter id="f"><feGaussianBlur/></filter></svg>`), /<filter>/);
  assert.throws(() => moonArtFromSvg(`${root}<image href="x.png"/></svg>`), /outside itself|<image>/);
  assert.throws(() => moonArtFromSvg(`${root.replace('512 512', '512 400')}</svg>`), /viewBox/);
  assert.throws(() => moonArtFromSvg(`${root}<path d="${'M0 0'.repeat(9000)}"/></svg>`), /larger/);
});

test('#661 C7: the chunk is asked for at night only; until it arrives there is no moon', async () => {
  const at = new Date('2026-10-21T18:00:00Z');
  const sunAt = (elevation) => resolveDayCycle({ states: { 'sun.sun': { attributes: { azimuth: 0, elevation, rising: false } } } }, at);
  const host = fakeHost(MOSCOW);
  assert.equal(moonLayer(host, ON, sunAt(40)), nothing, 'daytime: nothing and no load');
  await new Promise((done) => setTimeout(done, 50));
  assert.equal(host.updates, 0, 'nothing was loaded by day');
  assert.equal(moonLayer(host, ON, sunAt(-12)), nothing, 'the first night render has no moon yet');
  await new Promise((done) => setTimeout(done, 200));
  assert.equal(host.updates, 1, 'the host that asked re-renders when the chunk arrives');
  const element = moonLayer(host, ON, sunAt(-12));
  assert.notEqual(element, nothing);
  forgetHost(host);
});
