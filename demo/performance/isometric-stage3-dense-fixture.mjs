import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';

export const ISOMETRIC_STAGE3_DENSE_PROFILE = 'isometric-stage3-dense-v1';
export const ISOMETRIC_STAGE3_MATERIAL_DEFINITION_LIMIT = 16;

const CONTACT_ENTITY = 'binary_sensor.perf_stage3_opening';
const LOCK_ENTITY = 'lock.perf_stage3_opening';
const round = (value) => Number(value.toFixed(6));

const mergeMarker = (markers, deviceId, patch) => {
  const current = markers.get(deviceId) ?? {
    id: deviceId,
    binding: `device:${deviceId}`,
  };
  markers.set(deviceId, { ...current, ...patch });
};

/**
 * Performance-only Stage 3 stress fixture.
 *
 * Keep the historical large-house fixture immutable: its isometric profile is
 * the #124 regression witness. This derived fixture deliberately puts every
 * device close to a room wall (and every fourth one close to a corner), then
 * adds a bounded representative set of wide/value/LQI/new presentations and
 * live opening bindings. Both comparison bundles receive this exact object;
 * only the candidate is required to expose the Stage 3 DOM contract.
 */
export const makeIsometricStage3DenseFixture = () => {
  const fixture = makeLargeHouseFixture();
  const roomsByArea = new Map(fixture.config.spaces.flatMap((space) =>
    space.rooms.map((room) => [room.area, room])));
  const markers = new Map((fixture.config.markers ?? []).map((marker) => [marker.id, marker]));
  const deviceIds = Object.keys(fixture.devices).sort((a, b) => {
    const number = (id) => Number(id.slice(id.lastIndexOf('-') + 1));
    return number(a) - number(b);
  });
  const decoratedDeviceIds = [];
  const pulseDeviceIdsBySpace = {};

  for (const [index, deviceId] of deviceIds.entries()) {
    const room = roomsByArea.get(fixture.devices[deviceId]?.area_id);
    if (!room) throw new Error(`Stage 3 dense fixture has no room for ${deviceId}`);
    const [topLeft, , bottomRight] = room.poly;
    const epsilon = 0.002;
    const midX = (topLeft[0] + bottomRight[0]) / 2;
    const midY = (topLeft[1] + bottomRight[1]) / 2;
    const position = index % 4;
    fixture.layout[deviceId] = {
      ...fixture.layout[deviceId],
      x: round(position === 0 || position === 3 ? bottomRight[0] - epsilon : midX),
      y: round(position === 1 ? bottomRight[1] - epsilon
        : position === 2 || position === 3 ? topLeft[1] + epsilon : midY),
    };

    const entity = Object.values(fixture.entities)
      .find((candidate) => candidate.device_id === deviceId);
    const state = entity ? fixture.states[entity.entity_id] : null;
    const spaceId = fixture.layout[deviceId]?.s;
    if (state && spaceId && !pulseDeviceIdsBySpace[spaceId]
        && entity.entity_id.startsWith('fan.') && state.state === 'on') {
      pulseDeviceIdsBySpace[spaceId] = deviceId;
      mergeMarker(markers, deviceId, { display: 'icon_ripple' });
    }
    if (state && index % 3 === 0) {
      fixture.states[entity.entity_id] = {
        ...state,
        attributes: { ...state.attributes, lqi: 40 + (index * 17) % 141 },
      };
      decoratedDeviceIds.push(deviceId);
      mergeMarker(markers, deviceId, {
        value_badge: {
          enabled: true,
          source: { kind: 'entity_state', entity_id: entity.entity_id },
          position: ['right', 'bottom', 'left', 'top'][index % 4],
        },
      });
    } else if (state && index % 5 === 0) {
      decoratedDeviceIds.push(deviceId);
      mergeMarker(markers, deviceId, { display: 'value' });
    }
  }

  for (const space of fixture.config.spaces) {
    space.settings = {
      ...space.settings,
      show_lqi: true,
      label_temp: true,
      label_hum: true,
      label_lqi: true,
      label_light: true,
    };
    const windowOpening = space.openings.find((opening) => opening.type === 'window');
    const doorOpening = space.openings.find((opening) => opening.type === 'door');
    const gateOpening = space.openings.find((opening) => opening.type === 'gate');
    if (!windowOpening || !doorOpening || !gateOpening)
      throw new Error(`Stage 3 dense fixture lacks an opening kind on ${space.id}`);
    windowOpening.contact = CONTACT_ENTITY;
    doorOpening.contact = CONTACT_ENTITY;
    doorOpening.lock = LOCK_ENTITY;
    gateOpening.contact = CONTACT_ENTITY;
    gateOpening.lock = LOCK_ENTITY;
  }

  fixture.config.markers = [...markers.values()];
  const perSpaceNewDeviceIds = fixture.config.spaces.map((space) =>
    decoratedDeviceIds.find((id) => fixture.layout[id]?.s === space.id));
  if (perSpaceNewDeviceIds.some((id) => !id))
    throw new Error('Stage 3 dense fixture has no decorated new-device source on every floor');
  const newDeviceIds = [...new Set([...perSpaceNewDeviceIds, ...decoratedDeviceIds])].slice(0, 12);
  fixture.config.settings = {
    ...fixture.config.settings,
    filter_seeded: true,
    known_devices: deviceIds,
    new_device_ids: newDeviceIds,
  };
  fixture.states[CONTACT_ENTITY] = {
    entity_id: CONTACT_ENTITY,
    state: 'off',
    attributes: { device_class: 'door', friendly_name: 'Stage 3 opening contact' },
  };
  fixture.states[LOCK_ENTITY] = {
    entity_id: LOCK_ENTITY,
    state: 'locked',
    attributes: { friendly_name: 'Stage 3 opening lock' },
  };
  const stateEntityId = Object.values(fixture.entities).find((entity) =>
    fixture.layout[entity.device_id]?.s === 'perf-floor-2')?.entity_id;
  if (!stateEntityId) throw new Error('Stage 3 dense fixture has no floor-2 state source');
  const pulseDeviceIds = fixture.config.spaces.map((space) => pulseDeviceIdsBySpace[space.id]);
  if (pulseDeviceIds.some((id) => !id))
    throw new Error('Stage 3 dense fixture has no active pulse source on every floor');
  fixture.stage3Dense = {
    contactEntityId: CONTACT_ENTITY,
    lockEntityId: LOCK_ENTITY,
    stateEntityId,
    pulseDeviceId: pulseDeviceIds[0],
    pulseDeviceIdsBySpace,
    decoratedDeviceIds,
    expectedOverlayKinds: ['device', 'room-label', 'opening-lock'],
    expectedOpeningKinds: ['door', 'window', 'gate'],
    materialDefinitionLimit: ISOMETRIC_STAGE3_MATERIAL_DEFINITION_LIMIT,
  };
  fixture.counts = {
    ...fixture.counts,
    denseMarkers: deviceIds.length,
    decoratedMarkers: decoratedDeviceIds.length,
    boundOpenings: fixture.config.spaces.length * 3,
  };
  return fixture;
};
