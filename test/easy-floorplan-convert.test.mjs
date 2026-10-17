import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { convertEasy } from '../scripts/sh3d-convert/easy.mjs';
import { EASY_FURNITURE } from '../scripts/sh3d-convert/easy-catalog.mjs';
import { FURNITURE } from '../scripts/sh3d-convert/geometry-runtime.generated.mjs';
const card = (extra = {}) => JSON.stringify({ type: 'custom:easy-floorplan-card', ...extra });
const wall = { id: 'wall', x1: 0, y1: 0, x2: 400, y2: 0 };
const fixed = { now: '2026-10-17T00:00:00Z' };
test('#937 every mapped furniture ID exists in the actual canonical HP catalogue', () => {
  const known = new Set(FURNITURE.map(symbol => symbol.id));
  for (const [source, target] of Object.entries(EASY_FURNITURE)) assert(known.has(target), `${source} -> ${target}`);
});
test('#937 full Easy conversion carries bindings, area, values, decor, background, openings and LED geometry', () => {
  const { documents: [document], report } = convertEasy(card({
    width: 600, height: 400, north: -90, sunlight: true,
    palette: [{ name: 'warm', color: '#abc' }],
    floors: [{ id: 'ground', name: 'Home', image: '/local/home.png', walls: [wall],
      areas: [{ id: 'room', name: 'Living', haArea: 'living', color: 'var(--fp-color-warm)', opacity: 0.4,
        points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }] }],
      openings: [{ id: 'door', type: 'door', x: 200, y: 0, length: 80, entity: 'binary_sensor.door', flipV: true }],
      items: [{ id: 'light', entity: 'light.living', x: 200, y: 100, glow: true, glowRadius: 120,
        glowColor: '#fedcba', stripLength: 80, stripAngle: 30, stripSide: 'left', showState: true },
      { id: 'sensor', entity: 'sensor.temp', x: 150, y: 150, badgeContent: 'value', badgeEntity: 'primary',
        readings: [{ entity: 'sensor.hum' }, { entity: 'sensor.co2' }], labelPosition: 'left', tap_action: { action: 'none' } }],
      furniture: [{ id: 'sofa', type: 'sofa', x: 300, y: 200, w: 100, h: 40, angle: 90 },
        { id: 'unknown', type: 'custom-table', x: 100, y: 250, w: 60, h: 30 }],
      texts: [{ id: 'label', x: 100, y: 100, entity: 'sensor.power', attribute: 'current', text: 'Power' }],
    }],
  }), fixed);
  assert.equal(document.model_version, 10); assert.equal(document.transfer, undefined);
  const { config, layout } = document.payload, space = config.spaces[0];
  assert.equal(config.markers.length, 2); assert.equal(Object.keys(layout).length, 2);
  assert.equal(config.markers[0].binding, 'entity:light.living'); assert.equal(config.markers[0].area, 'living');
  assert.equal(config.markers[0].tap_action, 'toggle'); assert.equal(config.markers[0].is_light, true);
  assert.equal(config.markers[0].glow_radius_cm, 135); // 90/80 cm per unit
  assert.deepEqual(config.markers[0].glow_color, { c: '#fedcba' });
  assert.equal(config.markers[1].display, 'value'); assert.equal(config.markers[1].tap_action, 'none');
  assert.equal(config.markers[1].is_light, false);
  assert.deepEqual(config.markers[1].value_source, { kind: 'entity_state', entity_id: 'sensor.temp' });
  assert.equal(config.markers[1].value_badge.position, 'left');
  assert.equal(config.markers[1].value_badge.source.entity_id, 'sensor.hum');
  assert.equal(space.led_strips[0].marker, config.markers[0].id);
  assert.equal(space.led_strips[0].points.length, 2);
  assert.equal(space.rooms[0].area, 'living'); assert.equal(space.rooms[0].source, undefined);
  assert.deepEqual(space.rooms[0].settings.custom_fill, { c: '#aabbcc', a: 0.4 });
  assert.equal(space.settings.north_deg, 270); assert.equal(space.settings.sun_rays, true);
  assert.equal(space.display, undefined, 'no inert forward-compatible field pretending to be effective settings');
  assert.equal(space.openings[0].contact, 'binary_sensor.door'); assert.equal(space.openings[0].flip_v, true);
  assert.equal(space.openings[0].host.kind, 'wall');
  const sofa = space.decor.find(d => d.symbol === 'sofa');
  assert(sofa); assert.equal(sofa.angle, 90);
  const framePoint = layout[config.markers[0].id];
  const sourceScale = 1.125 / (space.cell_cm * 240);
  assert(Math.abs((sofa.x + sofa.w / 2) - framePoint.x - 100 * sourceScale) < 1e-8);
  assert(space.decor.some(d => d.kind === 'rect'));
  assert(space.decor.some(d => d.text === 'Power {sensor.power:current}'));
  assert(space.decor.some(d => d.text === '{sensor.co2}'));
  assert.equal(document.content_manifest[0].url, '/local/home.png');
  assert.equal(document.placement_manifest.length, 2);
  assert(report.levels[0].notes.some(n => n.code === 'furniture_placeholder'));
  assert(report.levels[0].notes.some(n => n.code === 'led_side_skipped'));
});

test('#937 multiple floors share one automatic scale and frame; bad floor cannot produce a corrupt download', () => {
  const result = convertEasy(card({ floors: [
    { id: 'first', walls: [wall] }, { id: 'second', walls: [{ ...wall, y1: 500, y2: 500 }] },
    { id: 'bad', areas: [{ id: 'bad', points: [{ x: 0, y: 0 }] }] },
  ] }), fixed);
  assert.equal(result.documents.length, 2); assert(result.report.levels[2].skipped);
  const [a, b] = result.documents.map(doc => doc.payload.config.spaces[0]);
  assert.equal(a.cell_cm, b.cell_cm); assert.deepEqual(a.view_box, b.view_box);
  assert(Math.abs(b.partitions[0].a[1] - a.partitions[0].a[1] - 500 / (a.cell_cm * 240)) < 1e-8);
  assert.equal(result.report.items[0].code, 'scale_default');
  assert.deepEqual(result, convertEasy(card({ floors: [
    { id: 'first', walls: [wall] }, { id: 'second', walls: [{ ...wall, y1: 500, y2: 500 }] },
    { id: 'bad', areas: [{ id: 'bad', points: [{ x: 0, y: 0 }] }] },
  ] }), fixed));
});

test('#937 unsafe images, unsupported actions and literal templates never acquire privileges', () => {
  const { documents: [doc], report } = convertEasy(card({ floors: [{ walls: [wall], image: 'https://host/img?token=secret',
    items: [{ id: 'a', entity: 'switch.a', x: 100, y: 100, tap_action: { action: 'call-service', service: 'lock.unlock' } }],
    texts: [{ x: 0, y: 50, text: '{lock.front}' }],
    openings: [{ id: 'pass', type: 'passage', x: 200, y: 0, length: 60, entity: 'lock.front', flipH: true, invert: true }],
  }] }), fixed);
  assert.equal(doc.payload.config.spaces[0].plan_url, undefined);
  assert.equal(doc.payload.config.markers[0].tap_action, 'info');
  assert.equal(doc.payload.config.spaces[0].decor[0].text, '❴lock.front❵');
  const opening = doc.payload.config.spaces[0].openings[0];
  assert(opening); for (const key of ['lock', 'contact', 'invert', 'flip_h', 'flip_v']) assert.equal(opening[key], undefined);
  assert(report.levels[0].notes.some(n => n.code === 'image_reference_skipped'));
});

test('#937 legacy reading indexes include the hidden legacy secondary row without renumbering', () => {
  const { documents: [doc] } = convertEasy(card({ walls: [wall], items: [{ entity: 'sensor.primary', x: 10, y: 20,
    secondaryEntity: 'sensor.legacy', readings: [{ entity: 'sensor.hidden', showState: false }, { entity: 'sensor.visible' }],
    badgeContent: 'value', badgeEntity: 2,
  }] }), fixed);
  assert.equal(doc.payload.config.markers[0].value_source.entity_id, 'sensor.visible');
});

test('#941 signed image credentials never appear in the document or loss report', () => {
  for (const query of ['sig=synthetic-private', 'X-Amz-Credential=synthetic-private&X-Amz-Signature=synthetic-private']) {
    const result = convertEasy(card({ floors: [{ id: 'home', walls: [wall], image: `https://host/img?${query}` }] }), fixed);
    assert.equal(result.documents[0].payload.config.spaces[0].plan_url, undefined);
    assert.equal(result.documents[0].content_manifest.length, 0);
    assert.equal(JSON.stringify(result).includes('synthetic-private'), false);
    assert(result.report.levels[0].notes.some(note => note.code === 'image_reference_skipped'));
  }
});

test('#937 point-only floor remains transferable without inventing a room, long LED participates in frame', () => {
  const single = convertEasy(card({ items: [{ entity: 'sensor.only', x: 20, y: 30 }] }), fixed).documents[0];
  assert.equal(single.payload.config.spaces[0].rooms.length, 0);
  assert.equal(single.payload.config.markers.length, 1);
  const strip = convertEasy(card({ items: [{ entity: 'light.strip', x: 20, y: 30, glow: true, stripLength: 2000 }] }), fixed).documents[0];
  const space = strip.payload.config.spaces[0];
  assert(space.led_strips[0].points.every(p => p.every(value => value > 0 && value < 1)));
});

test('#937 public-source and full-content goldens are actual converter/CLI output, including the loss reports', () => {
  for (const stem of ['easy-public-demo', 'easy-content']) {
    const base = new URL('../scripts/sh3d-convert/', import.meta.url);
    const source = readFileSync(new URL(`fixtures/${stem}.json`, base), 'utf8');
    const result = convertEasy(source, { now: '1970-01-01T00:00:00Z', toolVersion: 'plan-convert 0.2' });
    result.documents.forEach((document, index) => assert.deepEqual(document,
      JSON.parse(readFileSync(new URL(`golden/${stem}.space-${index + 1}.json`, base)))));
    assert.deepEqual(result.report, JSON.parse(readFileSync(new URL(`golden/${stem}.report.json`, base))));
    const cli = spawnSync(process.execPath, ['scripts/sh3d-convert/cli.mjs', '--format', 'easy',
      `scripts/sh3d-convert/fixtures/${stem}.json`], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr); assert.deepEqual(JSON.parse(cli.stdout), result.documents);
  }
});

test('#937 all refused floors retain actionable reasons, not a false successful download', () => {
  assert.throws(() => convertEasy(card({ walls: [{ ...wall, x2: 0 }] }), fixed), error => {
    assert.equal(error.code, 'easy_nothing_to_convert');
    assert.equal(error.report.levels[0].skipped, 'easy_zero_wall');
    return true;
  });
});

test('#937 a missing explicit badge source never silently becomes another entity; boolean strings refuse', () => {
  const { documents: [doc], report } = convertEasy(card({ walls: [wall], items: [{ entity: 'sensor.primary', x: 10, y: 20,
    readings: [{ entity: 'sensor.other' }], badgeContent: 'value', badgeEntity: 8,
  }] }), fixed);
  assert.equal(doc.payload.config.markers[0].display, 'badge');
  assert.equal(doc.payload.config.markers[0].value_source, undefined);
  assert(report.levels[0].notes.some(note => note.code === 'badge_source_missing'));
  assert.throws(() => convertEasy(card({ walls: [{ ...wall, divider: 'false' }] }), fixed),
    error => error.report.levels[0].skipped === 'easy_invalid_boolean');
  assert.throws(() => convertEasy(card({ walls: [wall], items: [{ entity: 'light.a', x: 10, y: 20, glow: 'true' }] }), fixed),
    error => error.report.levels[0].skipped === 'easy_invalid_boolean');
});
