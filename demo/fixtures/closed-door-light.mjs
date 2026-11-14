import { makeInteriorWindowFixture } from './interior-window-light.mjs';
import { fixtureWallKey } from './visual-matrix.mjs';

/** Fictional thick wall; probes are independently specified in plan coordinates,
 * not derived from the product's barrier, symbol bounds or clip path. */
export function makeClosedDoorFixture({ partition = false, exterior = false, led = false,
  slide = false, flipV = false, flipH = false, right = false, open = false, wallCm = 96 } = {}) {
  const fixture = makeInteriorWindowFixture({ partition, led });
  const space = fixture.config.spaces[0];
  // The production plan has 240 grid cells per normalized unit, 5 cm each.
  // Deliberately thick synthetic masonry leaves a clearly visible 40-unit
  // pocket on either side of the axis, independent of zoom and pixel samples.
  for (const wall of space.walls) wall.cm = wallCm;
  for (const wall of space.partitions) wall.cm = wallCm;
  space.title = 'Closed door — light reaches the leaf';
  space.wall_columns = [];
  if (exterior) {
    space.rooms = space.rooms.filter(room => room.id === 'left');
    space.walls = [...new Map(space.rooms.flatMap(room => room.poly.map((a, i) => {
      const b = room.poly[(i + 1) % room.poly.length], key = fixtureWallKey(a, b);
      return [key, { key, a, b, cm: 96 }];
    }))).values()];
  }
  space.openings = [{ ...space.openings[0], id: 'closed-door', type: 'door', flip_v: flipV, flip_h: flipH,
    ...(slide ? { opening_features: { version: 1, mechanism: 'slide', slide_direction: 'start', manual: 'closed' } } : {}) }];
  space.settings = { ...space.settings, fill_mode: 'custom', custom_fill: { c: '#26313d', a: 1 }, show_names: false };
  fixture.states['binary_sensor.window'].attributes.device_class = 'door';
  fixture.states['binary_sensor.window'].state = open ? 'on' : 'off';
  const sourceX = right ? .72 : .28;
  fixture.layout.d_light1.x = sourceX;
  fixture.config.markers[0].room_id = right ? 'right' : 'left';
  fixture.devices.d_light1.area_id = right ? 'kitchen' : 'living_room';
  if (led) space.led_strips[0].points = [[sourceX, .44], [sourceX, .56]];
  const halfDepth = wallCm / (2 * 240 * 5);
  // Shared vertical wall: natural inner face is right; exterior left room: left.
  const face = (exterior ? -1 : 1) * (flipV ? -1 : 1);
  const panelX = slide ? .5 + face * halfDepth : .5, side = right ? 1 : -1;
  const distance = halfDepth / 2;
  const probes = x => ({ target: [x + side * distance, .5],
    shadow: [x - side * distance, .5], outdoor: [.64, .5] });
  fixture.doorLightProbes = probes(panelX);
  fixture.doorLightIsoPanelX = .5 + face * halfDepth;
  fixture.doorLightIsoProbes = probes(fixture.doorLightIsoPanelX);
  return fixture;
}
