/**
 * Backup fixtures for the export and import journeys (houseplan-card#1010,
 * rows 21–22). Every fixture is built from code at test time — what is in it,
 * and what is broken in it, reads here, not in an opaque binary — and is
 * attached to the Playwright report, so the very file a journey imported can
 * be downloaded and opened. fixtures/backups/README.md describes each one.
 *
 * The base is the seed house as the product under test exports it (a full
 * export over the integration's websocket), so every fixture is a plan this
 * product could have written itself, plus the additions named below.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { repairsBackups } from './contract.mjs';
import { wsCall } from './ha-ws.mjs';
import { writeZip } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');
const copy = (value) => JSON.parse(JSON.stringify(value));
const json = (value) => Buffer.from(JSON.stringify(value), 'utf8');

export const CREATED_AT = '2026-10-22T00:00:00.000000Z';

/**
 * The first floor's backdrop, under its own file name so an import never
 * overwrites the seed's file the other journeys draw. A product that packs
 * backdrops under the backdrop rule (houseplan-card#1033) gets the seed SVG as
 * it ships, room labels included. An older one packed backdrops through the
 * decor-picture whitelist, which has no <text> (findings F125), and gets the
 * same SVG without its labels.
 */
const PLAN_URL = '/api/houseplan/content/plans/_/e2e-first-floor.svg';
const SEED_PLAN = readFileSync(resolve(ROOT, 'seed/houseplan/plans/first-floor.svg'), 'utf8');
export const PLAN = Buffer.from(repairsBackups() ? SEED_PLAN
  : SEED_PLAN.replace(/<text\b[^>]*>[\s\S]*?<\/text>\s*/g, ''), 'utf8');
export const TILE = readFileSync(resolve(ROOT, 'fixtures/images/e2e-tile.png'));

/** A PNG no Home Assistant has seen: its asset id names a picture that is not there. */
function uniquePng(seed) {
  const png = new PNG({ width: 16, height: 16 });
  const digest = createHash('sha256').update(seed).digest();
  for (let i = 0; i < png.data.length; i++) png.data[i] = i % 4 === 3 ? 255 : digest[i % digest.length];
  return PNG.sync.write(png);
}

/** A Zigbee2MQTT network map snapshot: a coordinator and one router. */
export const ZIGBEE_TOPICS = {
  zigbee2mqtt: {
    obtained_at: 1_792_627_200_000, // ms, as the integration stamps a scan
    map: {
      nodes: [
        { ieeeAddr: '0x00124b0000000001', type: 'Coordinator', networkAddress: 0, friendlyName: 'Coordinator' },
        { ieeeAddr: '0x00124b00000000e2', type: 'Router', networkAddress: 4660, friendlyName: 'E2E router' },
      ],
      links: [
        { source: { ieeeAddr: '0x00124b00000000e2', networkAddress: 4660 }, target: { ieeeAddr: '0x00124b0000000001', networkAddress: 0 }, linkquality: 120, depth: 1, routes: [] },
      ],
    },
  },
};

/** The seed house as the product under test exports it (model and ids as it writes them). */
export async function seedExport() {
  const { document } = await wsCall({ type: 'houseplan/export/create', kind: 'full', card_version: 'e2e' });
  return { ...document, created_at: CREATED_AT };
}

const spaceIn = (config, id) => config.spaces.find((space) => space.id === id);

function place(document, marker, x, y) {
  document.payload.config.markers.push(marker);
  document.payload.layout[marker.id] = { s: marker.space, x, y };
  document.placement_manifest.push({
    layout_id: marker.id, space_id: marker.space, owner: 'marker', owner_id: marker.id,
    binding: marker.binding, label: marker.name, icon: marker.icon,
  });
}

/**
 * «Сложный чистый план»: the seed's three spaces (the first floor on an SVG backdrop)
 * and its calibrated robot vacuum, plus stairs between the floors, a presence
 * radar in a room, a decor picture, a lamp that switches another lamp, and a
 * Zigbee network snapshot. Nothing in it is broken: its preview has nothing
 * to report and its export is complete.
 */
export function complexPlan(base) {
  const document = copy(base);
  const config = document.payload.config;
  const ground = spaceIn(config, 'f1');
  const first = spaceIn(config, 'f2');
  const kitchen = ground.rooms.find((room) => room.name === 'Kitchen & Living');
  ground.stairs = [{ id: 'e2e-stairs-up', kind: 'straight', x: 0.3, y: 0.45, angle: 0, direction: 'forward', length: 0.12, width: 0.05, target_space_id: 'f2' }];
  first.stairs = [{ id: 'e2e-stairs-spiral', kind: 'spiral', x: 0.3, y: 0.45, angle: 90, direction: 'clockwise', radius: 0.04, target_space_id: 'f1' }];
  ground.decor.push({ id: 'e2e-picture', kind: 'image', asset_id: sha256(TILE), x: 0.2, y: 0.3, w: 0.08, h: 0.053333 });
  first.plan_url = PLAN_URL;
  place(document, {
    id: 'e2e_radar_kitchen', binding: 'virtual', space: 'f1', area: kitchen.area, hidden: false,
    name: 'E2E presence radar', icon: 'mdi:radar',
    radar: {
      version: 1, enabled: true, profile: 'presence_v1', room_id: kitchen.id,
      sources: { occupancy_entity: 'binary_sensor.e2e_kitchen_presence' },
      mount: { installation_id: 'e2e-radar', x: 0.3, y: 0.3, heading_deg: 90 },
      calibration: { method: 'not_required', mirror: false, cell_cm: ground.cell_cm ?? 5 },
    },
  }, 0.3, 0.3);
  place(document, {
    id: 'e2e_lamp_target', binding: 'virtual', space: 'f1', area: kitchen.area, hidden: false,
    name: 'E2E target lamp', icon: 'mdi:lamp', is_light: true,
  }, 0.4, 0.3);
  place(document, {
    id: 'e2e_lamp_switch', binding: 'virtual', space: 'f1', area: kitchen.area, hidden: false,
    name: 'E2E switch lamp', icon: 'mdi:light-switch', controls: ['marker:e2e_lamp_target'],
  }, 0.45, 0.3);
  config.settings = { ...config.settings, zigbee_topology: { enabled: true } };
  return {
    document,
    files: new Map([[PLAN_URL, PLAN], [sha256(TILE), TILE]]),
    topics: ZIGBEE_TOPICS,
  };
}

/**
 * «Грязный план»: the complex plan with stale references and awkward
 * geometry. `expected` is what the import preview must name, what the import
 * must switch off but keep, and the geometry it must leave exactly as it is.
 */
export function dirtyPlan(base) {
  const plan = complexPlan(base);
  const { document } = plan;
  const config = document.payload.config;
  const ground = spaceIn(config, 'f1');
  const yard = spaceIn(config, 'smrwhw9la');
  const kitchen = ground.rooms.find((room) => room.name === 'Kitchen & Living');
  // bindings to things this Home Assistant does not have
  place(document, { id: 'e2e_gone_entity', binding: 'entity:light.e2e_gone_lamp', space: 'f1', hidden: false, name: 'Gone lamp', icon: 'mdi:lamp' }, 0.5, 0.35);
  place(document, { id: 'e2e_gone_device', binding: 'device:00000000000000000000000000e2e0ff', space: 'f1', hidden: false, name: 'Gone device', icon: 'mdi:chip' }, 0.55, 0.35);
  // a room tied to an area that was deleted
  const yardRoom = yard.rooms[0];
  yardRoom.area = 'e2e_gone_area';
  // a radar whose room no longer exists
  place(document, {
    id: 'e2e_radar_lost', binding: 'virtual', space: 'f1', hidden: false, name: 'Lost radar', icon: 'mdi:radar',
    radar: {
      version: 1, enabled: true, profile: 'presence_v1', room_id: 'e2e_gone_room',
      sources: { occupancy_entity: 'binary_sensor.e2e_lost_presence' },
      mount: { installation_id: 'e2e-radar-lost', x: 0.35, y: 0.35, heading_deg: 0 },
      calibration: { method: 'not_required', mirror: false, cell_cm: ground.cell_cm ?? 5 },
    },
  }, 0.35, 0.35);
  // a robot map routed to a floor that was deleted
  const robot = config.markers.find((marker) => marker.id === 'e_vacuum_demo_robot');
  robot.vacuum.map_routes = [
    { id: 'e2e-route-ground', source: 'sensor.demo_robot_map', map_id: '1', space: 'f1', calibration: [0.125, 0, 0, 0, -0.125, 1000] },
    { id: 'e2e-route-attic', source: 'sensor.demo_robot_map', map_id: '2', space: 'e2e_gone_space', calibration: [0.125, 0, 0, 0, -0.125, 1000] },
  ];
  // a control link and a value badge that point at a deleted marker
  config.markers.find((marker) => marker.id === 'e2e_lamp_switch').controls = ['marker:e2e_lamp_target', 'marker:e2e_gone_marker'];
  place(document, {
    id: 'e2e_badge_lost', binding: 'virtual', space: 'f1', hidden: false, name: 'Badge to nowhere', icon: 'mdi:tag',
    value_badge: { enabled: true, position: 'right', source: { kind: 'derived_marker_state', ref: 'marker:e2e_gone_marker' } },
  }, 0.6, 0.35);
  // a decor picture whose file is not in the archive, and a backdrop on the internet
  const lostPicture = sha256(uniquePng('e2e lost picture'));
  ground.decor.push({ id: 'e2e-picture-lost', kind: 'image', asset_id: lostPicture, x: 0.6, y: 0.3, w: 0.05, h: 0.05 });
  yard.plan_url = 'https://e2e-yard-backdrop.invalid/plan.png'; // never resolves: no real host is contacted
  // geometry the import has no business changing
  const partition = ground.partitions[0];
  ground.partitions.push({ ...copy(partition), id: 'e2e-partition-twin' }); // lies exactly on the first
  ground.partitions.push({ id: 'e2e-partition-offgrid', a: [0.701234, 0.30123], b: [0.749876, 0.30123], cm: 10 }); // off the 1/240 grid
  // a room whose outline crosses itself, with the walls it implies
  const bowTie = [[0.6, 0.1], [0.8, 0.3], [0.8, 0.1], [0.6, 0.3]];
  const bowTieWalls = bowTie.map((_, i) => `wall-e2ebowtie${i}`);
  yard.rooms.push({ id: 'e2e-bowtie', name: 'Bow tie', poly: bowTie, wall_ids: bowTieWalls });
  bowTie.forEach((point, i) => yard.wall_segments.push({ id: bowTieWalls[i], a: point, b: bowTie[(i + 1) % bowTie.length], cm: 0 }));
  // a door moved far off its wall (houseplan-card#1033): imported without a
  // wall, everything else about it kept; older products refuse such a file
  const offWall = repairsBackups()
    ? { ...copy(ground.openings[0]), id: 'e2e-off-wall', x: 0.95, y: 0.95 } : null;
  if (offWall) ground.openings.push(offWall);
  return {
    ...plan,
    expected: {
      missingBindings: 2,
      missingAreas: ['e2e_gone_area'],
      recovery: { radar: ['e2e_radar_lost'], vacuum: ['e_vacuum_demo_robot'], controls: ['e2e_lamp_switch'], value: ['e2e_badge_lost'] },
      missingPictures: ['e2e-picture-lost'],
      external: ['https://e2e-yard-backdrop.invalid/plan.png'],
      keptGeometry: { partitions: { f1: ['e2e-partition-twin', 'e2e-partition-offgrid'] }, rooms: { smrwhw9la: ['e2e-bowtie'] } },
      offWall,
      kitchen: kitchen.id,
    },
  };
}

/** Image references in the product's order (backup_archive.image_refs). */
function imageRefs(config) {
  const refs = [];
  for (const space of config.spaces ?? []) {
    const name = String(space.title || space.id).slice(0, 160);
    if (space.plan_url) refs.push({ ref: { kind: 'plan', owner: 'space', owner_id: String(space.id), field: 'plan_url', url: space.plan_url }, name });
    for (const shape of space.decor ?? []) {
      if (shape.kind === 'image' && shape.asset_id) {
        refs.push({ ref: { kind: 'decor_asset', owner: 'decor', owner_id: `${space.id}:${shape.id}`, field: 'asset_id', url: shape.asset_id }, name });
      }
    }
  }
  return refs;
}

const extOf = (raw) => (raw.subarray(0, 4).toString('latin1') === '\x89PNG' ? 'png' : raw.subarray(0, 3).toString('latin1') === '\xff\xd8\xff' ? 'jpg' : 'svg');

/**
 * The full-backup ZIP the product would write for `document`: images it has
 * bytes for are packed by content hash, the rest are named as missing or
 * external in the manifest, the Zigbee snapshot rides along when given.
 */
export function archive({ document, files = new Map(), topics = null }) {
  const entries = [];
  const blobs = {};
  const images = [];
  const entry = (name, raw) => { entries.push([name, raw]); return { entry: name, bytes: raw.length, sha256: sha256(raw) }; };
  for (const { ref, name } of imageRefs(document.payload.config)) {
    const raw = files.get(ref.url);
    if (!raw) {
      images.push({ ref, name, reason: /^https?:/i.test(ref.url) ? 'external' : 'missing' });
      continue;
    }
    const blob = `images/${sha256(raw)}.${extOf(raw)}`;
    if (!blobs[blob]) blobs[blob] = entry(blob, raw);
    images.push({ ref, name, blob });
  }
  const doc = entry('document.json', json(document));
  const snapshot = topics ? entry('zigbee.json', json({ topics })) : null;
  const manifest = { format: 'houseplan-full-backup', version: 1, complete: images.every((row) => row.blob), document: doc, snapshot, images, blobs };
  entry('manifest.json', json(manifest));
  return writeZip(entries);
}

/**
 * «Прежний JSON»: what House Plan 1.62 wrote — the first export format
 * (export_version 1), stamped with the stored model of the plan it exported —
 * around the seed exactly as it is stored on disk (data model 5, before the
 * wall-segment model), from another Home Assistant. Two references went
 * stale since: a lamp that is no longer in Home Assistant and a room whose
 * area was deleted. The import migrates it to the current model.
 */
export function oldJsonPlan() {
  const { config } = JSON.parse(readFileSync(resolve(ROOT, 'seed/.storage/houseplan.config'), 'utf8')).data;
  const { layout } = JSON.parse(readFileSync(resolve(ROOT, 'seed/.storage/houseplan.layout'), 'utf8')).data;
  const { model_version: model, ...rest } = copy(config);
  rest.markers.push({ id: 'e2e_old_gone', binding: 'entity:light.e2e_old_gone_lamp', space: 'f1', hidden: false, name: 'Old gone lamp', icon: 'mdi:lamp' });
  const placed = { ...copy(layout), e2e_old_gone: { s: 'f1', x: 0.5, y: 0.4 } };
  rest.spaces.find((space) => space.id === 'smrwhw9la').rooms[0].area = 'e2e_old_gone_area';
  const markers = new Map(rest.markers.map((marker) => [marker.id, marker]));
  return {
    document: {
      format: 'houseplan-export', export_version: 1, kind: 'full', created_at: '2026-08-11T12:00:00Z',
      source_fingerprint: `sha256:${sha256('e2e: another Home Assistant')}`,
      card_version: '1.62.0', integration_version: '1.62.0', model_version: model,
      payload: { config: rest, layout: placed },
      placement_manifest: Object.entries(placed).map(([key, at]) => ({
        layout_id: key, space_id: at.s, owner: 'marker', owner_id: key, binding: markers.get(key)?.binding ?? null,
      })),
      // 1.62 listed every backdrop and attachment URL with where it lived
      content_manifest: rest.spaces.filter((space) => space.plan_url).map((space) => ({
        kind: 'plan', owner: 'space', owner_id: space.id, field: 'plan_url', url: space.plan_url,
        storage: 'internal', exists_at_export: true,
      })),
      transfer: { dropped_marker_links: 0 },
    },
    expected: { model, missingBindings: 1, missingAreas: ['e2e_old_gone_area'] },
  };
}
