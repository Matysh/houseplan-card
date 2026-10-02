/**
 * #780 `led-strips-v1`: the `large-house-v1` fixture with N existing devices
 * of every floor shown as LED strips of K points that are on. No device is
 * added: a converted device keeps its id and layout; its entity becomes a
 * light (`light.perf_led_<floor>_<k>`) and its marker gets the strip's space.
 */
import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';

const round = (value) => Number(value.toFixed(6));

export function makeLedStripsFixture(strips, points) {
  const fixture = makeLargeHouseFixture();
  if (!strips) return fixture;
  const floors = fixture.config.spaces;
  for (const [floorIndex, space] of floors.entries()) {
    const deviceIds = Object.keys(fixture.layout).filter((id) => fixture.layout[id].s === space.id).slice(0, strips);
    if (deviceIds.length < strips) throw new Error(`${space.id} has only ${deviceIds.length} devices`);
    space.led_strips = deviceIds.map((deviceId, k) => {
      const at = fixture.layout[deviceId];
      const w = 0.05, h = 0.016;
      const pts = Array.from({ length: points }, (_, i) => [
        round(Math.min(0.995, Math.max(0.005, at.x - w / 2 + (w * i) / (points - 1)))),
        round(Math.min(0.995, Math.max(0.005, at.y + (i % 2 ? h : -h) / 2 + (k % 3) * 0.004))),
      ]);
      return { id: `perf-led-${floorIndex}-${k}`, points: pts, marker: deviceId };
    });
    for (const [k, deviceId] of deviceIds.entries()) {
      for (const [entityId, entity] of Object.entries(fixture.entities)) {
        if (entity.device_id !== deviceId) continue;
        delete fixture.entities[entityId];
        delete fixture.states[entityId];
      }
      const entityId = `light.perf_led_${floorIndex}_${k}`;
      fixture.entities[entityId] = { entity_id: entityId, device_id: deviceId, platform: 'houseplan_perf',
        config_entry_id: 'perf_entry', disabled_by: null };
      fixture.states[entityId] = { entity_id: entityId, state: 'on',
        attributes: { friendly_name: `LED ${floorIndex}.${k}`, rgb_color: [128, 213, 255], brightness: 255 } };
      fixture.config.markers = fixture.config.markers.filter((marker) => marker.id !== deviceId);
      fixture.config.markers.push({ id: deviceId, binding: `device:${deviceId}`, space: space.id, is_light: true });
    }
  }
  return fixture;
}

