/**
 * Deterministic, fictional high-load fixture shared by performance and future
 * visual-regression tooling. Nothing here depends on a real HA installation.
 */

const FLOOR_COUNT = 3;
const ROOMS_PER_FLOOR = 20;
const DEVICE_COUNT = 200;
const OPENING_COUNT = 100;
const PARTITION_COUNT = 60;
const COLUMN_COUNT = 40;
const DECOR_COUNT = 500;

const round = (value) => Number(value.toFixed(6));

const roomGrid = (floor) => {
  const rooms = [];
  const left = 0.04;
  const top = 0.04;
  const width = 0.92 / 5;
  const height = 0.92 / 4;
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 5; column++) {
      const index = row * 5 + column;
      const x1 = round(left + column * width);
      const y1 = round(top + row * height);
      const x2 = round(x1 + width);
      const y2 = round(y1 + height);
      rooms.push({
        id: `perf-room-${floor}-${index}`,
        name: `Room ${floor + 1}.${index + 1}`,
        area: `perf_area_${floor}_${index}`,
        poly: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]],
      });
    }
  }
  return rooms;
};

const wallSegments = (rooms) => {
  const unique = new Map();
  for (const room of rooms) {
    room.poly.forEach((a, index) => {
      const b = room.poly[(index + 1) % room.poly.length];
      const forward = `${a.join(',')}/${b.join(',')}`;
      const reverse = `${b.join(',')}/${a.join(',')}`;
      if (!unique.has(reverse)) unique.set(forward, { a, b });
    });
  }
  return [...unique.values()];
};

const makeOpenings = (floor, walls, count) => walls.slice(0, count).map((wall, index) => {
  const horizontal = Math.abs(wall.b[0] - wall.a[0]) >= Math.abs(wall.b[1] - wall.a[1]);
  return {
    id: `perf-opening-${floor}-${index}`,
    type: index % 7 === 0 ? 'window' : index % 11 === 0 ? 'gate' : 'door',
    x: round((wall.a[0] + wall.b[0]) / 2),
    y: round((wall.a[1] + wall.b[1]) / 2),
    angle: horizontal ? 0 : 90,
    length: horizontal ? 0.045 : 0.055,
  };
});

const makePartitions = (floor, rooms, count) => Array.from({ length: count }, (_, index) => {
  const room = rooms[index % rooms.length];
  const [a, , c] = room.poly;
  const y = round(a[1] + (c[1] - a[1]) * (0.35 + (index % 3) * 0.12));
  return {
    id: `perf-partition-${floor}-${index}`,
    a: [round(a[0] + 0.035), y],
    b: [round(c[0] - 0.035), y],
    cm: 10 + (index % 3) * 5,
  };
});

const makeColumns = (floor, rooms, count) => Array.from({ length: count }, (_, index) => {
  const room = rooms[(index * 3) % rooms.length];
  const [a, , c] = room.poly;
  return {
    id: `perf-column-${floor}-${index}`,
    shape: index % 3 === 0 ? 'circle' : 'square',
    center: [
      round(a[0] + (c[0] - a[0]) * (0.28 + (index % 2) * 0.44)),
      round(a[1] + (c[1] - a[1]) * (0.28 + ((index >> 1) % 2) * 0.44)),
    ],
    cm: 25 + (index % 4) * 5,
    ...(index % 3 === 0 ? {} : { angle: (index % 6) * 15 }),
  };
});

const makeDecor = (floor, count) => Array.from({ length: count }, (_, index) => {
  const column = index % 25;
  const row = Math.floor(index / 25);
  const x = round(0.02 + column * 0.039);
  const y = round(0.018 + (row % 20) * 0.048);
  if (index % 10 === 0) {
    return {
      id: `perf-decor-${floor}-${index}`,
      kind: 'text', x, y, text: `F${floor + 1}-${index}`, size_cm: 14,
      color: '#59636e', opacity: 0.75,
    };
  }
  if (index % 3 === 0) {
    return {
      id: `perf-decor-${floor}-${index}`,
      kind: 'rect', x, y, w: 0.022, h: 0.018, angle: (index % 12) * 5,
      color: '#687681', opacity: 0.55, width_cm: 1.5,
      fill: index % 2 === 0, fill_color: '#75838e', fill_opacity: 0.12,
    };
  }
  return {
    id: `perf-decor-${floor}-${index}`,
    kind: 'line', x1: x, y1: y, x2: round(x + 0.025), y2: round(y + (index % 2 ? 0.012 : 0)),
    color: '#687681', opacity: 0.6, width_cm: 1.2,
    ...(index % 9 === 0 ? { line_style: 'dashed' } : {}),
  };
});

const entityKinds = [
  ['light', 'on'],
  ['switch', 'off'],
  ['sensor', '21.5'],
  ['binary_sensor', 'off'],
  ['climate', 'heat'],
  ['media_player', 'playing'],
  ['cover', 'closed'],
  ['fan', 'on'],
  ['lock', 'locked'],
  ['vacuum', 'docked'],
];

const makeRuntime = (spaces) => {
  const devices = {};
  const entities = {};
  const states = {};
  const areas = {};
  const layout = {};
  const roomRefs = spaces.flatMap((space) => space.rooms.map((room) => ({ space, room })));
  for (const { room } of roomRefs) areas[room.area] = { area_id: room.area, name: room.name };
  for (let index = 0; index < DEVICE_COUNT; index++) {
    const { space, room } = roomRefs[index % roomRefs.length];
    const [domain, baseState] = entityKinds[index % entityKinds.length];
    const deviceId = `perf-device-${index}`;
    const entityId = `${domain}.perf_${index}`;
    devices[deviceId] = {
      id: deviceId,
      name: `Synthetic ${domain} ${index + 1}`,
      model: `PERF-${String(index + 1).padStart(3, '0')}`,
      area_id: room.area,
      identifiers: [['houseplan_perf', deviceId]],
      config_entries: ['perf_entry'],
      entry_type: null,
      via_device_id: null,
      disabled_by: null,
    };
    entities[entityId] = {
      entity_id: entityId,
      device_id: deviceId,
      platform: 'houseplan_perf',
      config_entry_id: 'perf_entry',
      disabled_by: null,
    };
    const attributes = { friendly_name: devices[deviceId].name };
    if (domain === 'sensor') Object.assign(attributes, {
      device_class: 'temperature', unit_of_measurement: '°C', state_class: 'measurement',
    });
    if (domain === 'binary_sensor') attributes.device_class = index % 2 ? 'motion' : 'occupancy';
    if (domain === 'climate') Object.assign(attributes, { current_temperature: 21.5, temperature: 22 });
    states[entityId] = { entity_id: entityId, state: index % 4 === 0 && domain === 'light' ? 'off' : baseState, attributes };
    const [a, , c] = room.poly;
    layout[deviceId] = {
      s: space.id,
      x: round(a[0] + (c[0] - a[0]) * (0.2 + (index % 4) * 0.2)),
      y: round(a[1] + (c[1] - a[1]) * (0.28 + ((index >> 2) % 3) * 0.22)),
    };
  }
  return { devices, entities, states, areas, layout };
};

export const LARGE_HOUSE_COUNTS = Object.freeze({
  floors: FLOOR_COUNT,
  rooms: FLOOR_COUNT * ROOMS_PER_FLOOR,
  devices: DEVICE_COUNT,
  openings: OPENING_COUNT,
  partitions: PARTITION_COUNT,
  columns: COLUMN_COUNT,
  decor: DECOR_COUNT,
});

export const makeLargeHouseFixture = () => {
  let openingsLeft = OPENING_COUNT;
  let partitionsLeft = PARTITION_COUNT;
  let columnsLeft = COLUMN_COUNT;
  let decorLeft = DECOR_COUNT;
  const spaces = Array.from({ length: FLOOR_COUNT }, (_, floor) => {
    const rooms = roomGrid(floor);
    const segments = wallSegments(rooms);
    const floorsRemaining = FLOOR_COUNT - floor;
    const openingCount = Math.ceil(openingsLeft / floorsRemaining);
    const partitionCount = Math.ceil(partitionsLeft / floorsRemaining);
    const columnCount = Math.ceil(columnsLeft / floorsRemaining);
    const decorCount = Math.ceil(decorLeft / floorsRemaining);
    openingsLeft -= openingCount;
    partitionsLeft -= partitionCount;
    columnsLeft -= columnCount;
    decorLeft -= decorCount;
    return {
      id: `perf-floor-${floor + 1}`,
      title: `Performance floor ${floor + 1}`,
      plan_url: null,
      view_box: [0, 0, 1, 1],
      cell_cm: 5,
      settings: { fill_mode: 'glow', show_borders: true, show_names: true },
      rooms,
      walls: segments.map((wall, index) => ({
        key: `perf-wall-${floor}-${index}`, cm: 15, a: wall.a, b: wall.b,
      })),
      openings: makeOpenings(floor, segments, openingCount),
      partitions: makePartitions(floor, rooms, partitionCount),
      wall_columns: makeColumns(floor, rooms, columnCount),
      decor: makeDecor(floor, decorCount),
    };
  });
  const runtime = makeRuntime(spaces);
  return {
    config: { spaces, markers: [], settings: { glow_radius_cm: 300 } },
    ...runtime,
    counts: LARGE_HOUSE_COUNTS,
  };
};
