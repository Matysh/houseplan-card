/** Deterministic fictional scenes for HP-QA-01 golden-image coverage. */

const round = (value) => Number(value.toFixed(6));

// Golden fixtures must use the same persisted wall-key contract as real plan
// data. Arbitrary labels make every configured wall look virtual to the
// renderer, which lets a visually ineffective baseline pass unnoticed.
const WALL_KEY_PITCH = 1 / 240;
export const fixtureWallKey = (a, b) => {
  const quantize = (value) => Math.round(value / WALL_KEY_PITCH) * WALL_KEY_PITCH;
  const mx = quantize((a[0] + b[0]) / 2);
  const my = quantize((a[1] + b[1]) / 2);
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-12) { dx = 1; dy = 0; }
  else { dx /= length; dy /= length; }
  if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI;
  const bucket = Math.round(angle * 1800) / 1800;
  return `${mx.toFixed(4)},${my.toFixed(4)}@${bucket.toFixed(4)}`;
};

const uniqueEdges = (rooms) => {
  const edges = new Map();
  for (const room of rooms) {
    room.poly.forEach((a, index) => {
      const b = room.poly[(index + 1) % room.poly.length];
      const forward = `${a.join(',')}/${b.join(',')}`;
      const reverse = `${b.join(',')}/${a.join(',')}`;
      if (!edges.has(reverse) && !edges.has(forward)) edges.set(forward, { a, b });
    });
  }
  return [...edges.values()];
};

const wallsFor = (prefix, rooms, thickness) => uniqueEdges(rooms).map((edge, index) => ({
  key: fixtureWallKey(edge.a, edge.b),
  a: edge.a,
  b: edge.b,
  cm: typeof thickness === 'function' ? thickness(edge, index) : thickness,
}));

const geometryRooms = [
  { id: 'geo-nw', name: 'NW', area: 'golden_geo_nw', poly: [[0.06, 0.08], [0.48, 0.08], [0.48, 0.48], [0.06, 0.48]] },
  { id: 'geo-ne', name: 'NE', area: 'golden_geo_ne', poly: [[0.48, 0.08], [0.94, 0.08], [0.94, 0.48], [0.48, 0.48]] },
  { id: 'geo-sw', name: 'SW', area: 'golden_geo_sw', poly: [[0.06, 0.48], [0.48, 0.48], [0.48, 0.92], [0.06, 0.92]] },
  { id: 'geo-se', name: 'SE', area: 'golden_geo_se', poly: [[0.48, 0.48], [0.94, 0.48], [0.94, 0.92], [0.48, 0.92]] },
  { id: 'geo-nested', name: 'Nested', area: 'golden_geo_nested',
    poly: [[0.72, 0.14], [0.84, 0.26], [0.72, 0.38], [0.60, 0.26]] },
];

const lightingRooms = [
  { id: 'light-left', name: 'Light source room', area: 'golden_light_left',
    poly: [[0.07, 0.10], [0.50, 0.10], [0.50, 0.88], [0.07, 0.88]] },
  { id: 'light-right', name: 'Receiving room', area: 'golden_light_right',
    poly: [[0.50, 0.10], [0.93, 0.10], [0.93, 0.88], [0.50, 0.88]] },
];

const applianceRooms = [
  { id: 'appliance-room', name: 'Laundry', area: 'golden_appliance',
    poly: [[0.08, 0.10], [0.92, 0.10], [0.92, 0.90], [0.08, 0.90]] },
];

const geometrySpace = {
  id: 'golden-geometry',
  title: 'Geometry matrix',
  plan_url: null,
  view_box: [0, 0, 1, 1],
  cell_cm: 5,
  settings: {
    fill_mode: 'none', show_borders: true, show_names: true,
    room_color: '#2d8fce', room_opacity: 0.16,
  },
  rooms: geometryRooms,
  walls: wallsFor('geo', geometryRooms, (edge, index) => {
    const vertical = Math.abs(edge.a[0] - edge.b[0]) < 1e-9;
    if (vertical && Math.abs(edge.a[0] - 0.48) < 1e-9) return 25;
    return index % 4 === 0 ? 10 : 15;
  }),
  open_spans: [{ a: [0.48, 0.15], b: [0.48, 0.27] }],
  openings: [
    { id: 'geo-window', type: 'window', x: 0.26, y: 0.08, angle: 0, length: 0.12 },
    { id: 'geo-door', type: 'door', x: 0.48, y: 0.37, angle: 90, length: 0.12 },
    { id: 'geo-gate', type: 'gate', x: 0.72, y: 0.92, angle: 0, length: 0.2 },
    { id: 'geo-diagonal-window', type: 'window', x: 0.78, y: 0.20, angle: 45, length: 0.08 },
  ],
  partitions: [
    { id: 'geo-partition-h', a: [0.14, 0.68], b: [0.40, 0.68], cm: 12 },
    { id: 'geo-partition-v', a: [0.75, 0.56], b: [0.75, 0.82], cm: 20 },
  ],
  wall_columns: [
    { id: 'geo-column-square', shape: 'square', center: [0.63, 0.67], cm: 35, angle: 30 },
    { id: 'geo-column-circle', shape: 'circle', center: [0.86, 0.72], cm: 40 },
  ],
  decor: [
    { id: 'geo-axis-h', kind: 'line', x1: 0.04, y1: 0.5, x2: 0.96, y2: 0.5,
      color: '#5d6a73', opacity: 0.35, width_cm: 0.8, line_style: 'dashed' },
  ],
};

const lightingSpace = {
  id: 'golden-lighting',
  title: 'Lighting matrix',
  plan_url: null,
  view_box: [0, 0, 1, 1],
  cell_cm: 5,
  settings: {
    fill_mode: 'none', glow_enabled: true, show_borders: true, show_names: true,
    north_deg: 0, sun_rays: true, bg_mode: 'static',
  },
  rooms: lightingRooms,
  walls: wallsFor('light', lightingRooms, (edge) => (
    Math.abs(edge.a[0] - 0.5) < 1e-9 && Math.abs(edge.b[0] - 0.5) < 1e-9 ? 25 : 15
  )),
  openings: [
    { id: 'light-window', type: 'window', x: 0.27, y: 0.10, angle: 0, length: 0.14 },
    { id: 'light-door', type: 'door', x: 0.50, y: 0.54, angle: 90, length: 0.15 },
    { id: 'light-gate', type: 'gate', x: 0.74, y: 0.88, angle: 0, length: 0.22 },
  ],
  partitions: [
    { id: 'light-partition', a: [0.70, 0.22], b: [0.70, 0.70], cm: 18 },
  ],
  wall_columns: [
    { id: 'light-column', shape: 'circle', center: [0.38, 0.64], cm: 45 },
  ],
  decor: [],
};

const applianceSpace = {
  id: 'golden-appliance',
  title: 'Appliance lifecycle',
  plan_url: null,
  view_box: [0, 0, 1, 1],
  cell_cm: 5,
  settings: {
    fill_mode: 'none', glow_enabled: false, show_borders: true, show_names: true,
    sun_rays: false, bg_mode: 'static',
  },
  rooms: applianceRooms,
  walls: wallsFor('appliance', applianceRooms, 15),
  openings: [],
  partitions: [],
  wall_columns: [],
  decor: [],
};

const runtime = (includeAppliance = false) => {
  const devices = {};
  const entities = {};
  const states = {
    'sun.sun': {
      entity_id: 'sun.sun', state: 'above_horizon',
      attributes: { azimuth: 180, elevation: 24 },
    },
  };
  // Keep sun.sun state-only on purpose. Core/runtime entities and YAML
  // entities without unique_id may have a live state without a registry row.
  // The production projection must preserve them.
  const layout = {};
  const areas = Object.fromEntries(
    [...geometryRooms, ...lightingRooms, ...(includeAppliance ? applianceRooms : [])]
      .map((room) => [room.area, { area_id: room.area, name: room.name }]),
  );
  const add = (id, domain, area, x, y, state, attributes = {}) => {
    const entityId = `${domain}.${id.replaceAll('-', '_')}`;
    devices[id] = {
      id, name: `Golden ${id}`, model: `GOLDEN-${id.toUpperCase()}`, area_id: area,
      identifiers: [['houseplan_golden', id]], config_entries: ['golden_entry'],
      entry_type: null, via_device_id: null, disabled_by: null,
    };
    entities[entityId] = {
      entity_id: entityId, device_id: id, platform: 'houseplan_golden',
      config_entry_id: 'golden_entry', disabled_by: null,
    };
    states[entityId] = { entity_id: entityId, state, attributes: { friendly_name: devices[id].name, ...attributes } };
    layout[id] = { s: 'golden-lighting', x: round(x), y: round(y) };
  };
  add('golden-light-one', 'light', 'golden_light_left', 0.20, 0.34, 'on', { rgb_color: [255, 196, 112] });
  add('golden-light-two', 'light', 'golden_light_left', 0.35, 0.72, 'on', { color_temp_kelvin: 2700 });
  add('golden-light-three', 'light', 'golden_light_right', 0.82, 0.30, 'off');
  add('golden-presence', 'binary_sensor', 'golden_light_right', 0.82, 0.62, 'on', { device_class: 'occupancy' });
  add('golden-climate', 'climate', 'golden_light_right', 0.60, 0.28, 'heat', {
    current_temperature: 22.4, temperature: 23, hvac_action: 'heating',
  });
  add('golden-left-temperature', 'sensor', 'golden_light_left', 0.19, 0.54, '17', {
    device_class: 'temperature', unit_of_measurement: '°C',
  });
  add('golden-right-temperature', 'sensor', 'golden_light_right', 0.81, 0.48, '29', {
    device_class: 'temperature', unit_of_measurement: '°C',
  });
  add('golden-left-linkquality', 'sensor', 'golden_light_left', 0.34, 0.54, '35', {
    unit_of_measurement: 'lqi',
  });
  add('golden-right-linkquality', 'sensor', 'golden_light_right', 0.66, 0.70, '190', {
    unit_of_measurement: 'lqi',
  });

  if (includeAppliance) {
    const washerId = 'golden-washer';
    devices[washerId] = {
      id: washerId,
      name: 'Golden washing machine',
      model: 'GOLDEN-WASHER-COMPOSITE',
      area_id: 'golden_appliance',
      identifiers: [['houseplan_golden', washerId]],
      config_entries: ['golden_entry'],
      entry_type: null,
      via_device_id: null,
      disabled_by: null,
    };
    const addWasherEntity = (entityId, state, attributes = {}, registry = {}) => {
      entities[entityId] = {
        entity_id: entityId,
        device_id: washerId,
        platform: 'houseplan_golden',
        config_entry_id: 'golden_entry',
        disabled_by: null,
        ...registry,
      };
      states[entityId] = {
        entity_id: entityId,
        state,
        attributes: { friendly_name: registry.original_name || entityId, ...attributes },
      };
    };
    addWasherEntity('switch.golden_washer_power', 'on', {}, { original_name: 'Power' });
    addWasherEntity('switch.golden_washer_child_lock', 'off', {}, { original_name: 'Child lock' });
    addWasherEntity('sensor.golden_washer_status', 'done', {}, {
      original_name: 'Status', translation_key: 'status',
    });
    addWasherEntity('sensor.golden_washer_stage', 'Rinse', {}, { original_name: 'Stage' });
    addWasherEntity('sensor.golden_washer_program', 'mixed_wash', {}, { original_name: 'Program' });
    layout[washerId] = { s: 'golden-appliance', x: 0.5, y: 0.5 };
  }
  return { devices, entities, states, layout, areas };
};

export const VISUAL_MATRIX_COUNTS = Object.freeze({
  spaces: 2,
  rooms: geometryRooms.length + lightingRooms.length,
  openings: geometrySpace.openings.length + lightingSpace.openings.length,
  partitions: geometrySpace.partitions.length + lightingSpace.partitions.length,
  columns: geometrySpace.wall_columns.length + lightingSpace.wall_columns.length,
});

export const makeVisualMatrixFixture = ({ applianceLifecycle = false } = {}) => ({
  config: {
    spaces: [
      structuredClone(geometrySpace), structuredClone(lightingSpace),
      ...(applianceLifecycle ? [structuredClone(applianceSpace)] : []),
    ],
    // A persisted marker is part of the fixture contract for scenarios that
    // override per-source Glow controls. The device/layout alone are not a
    // saved marker configuration and must not be silently treated as one.
    markers: [{ id: 'golden-light-two', binding: 'device:golden-light-two' }],
    settings: {
      glow_radius_cm: 360,
      north_deg: 0,
      sun_rays: true,
      bg_mode: 'static',
      fill_colors: {
        glow_base: { c: '#1b2530', a: 0.78 },
        glow_light: { c: '#ffd27b', a: 0.70 },
        wall_fill: { c: '#d7d9dc', a: 1 },
      },
    },
  },
  ...runtime(applianceLifecycle),
  counts: applianceLifecycle ? {
    ...VISUAL_MATRIX_COUNTS,
    spaces: VISUAL_MATRIX_COUNTS.spaces + 1,
    rooms: VISUAL_MATRIX_COUNTS.rooms + applianceRooms.length,
  } : VISUAL_MATRIX_COUNTS,
});
