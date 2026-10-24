import { makeVisualMatrixFixture, fixtureWallKey } from '../fixtures/visual-matrix.mjs';

const SPACE = 'golden-zigbee-led';
export function makeZigbeeLedFixture() {
  const fixture = makeVisualMatrixFixture();
  const room = { id: 'led-room', name: 'LED network', poly: [[.07, .1], [.93, .1], [.93, .7], [.07, .7]] };
  fixture.config.spaces = [{ id: SPACE, title: 'LED links', plan_url: null, view_box: [0, 0, 1, .8], cell_cm: 5,
    rooms: [room], walls: room.poly.map((a, i) => {
      const b = room.poly[(i + 1) % room.poly.length]; return { a, b, key: fixtureWallKey(a, b), cm: 12 };
    }), wall_segments: [], partitions: [], wall_columns: [], openings: [], decor: [],
    settings: { fill_mode: 'none', show_names: false, show_borders: true, glow_enabled: false, sun_rays: false },
    led_strips: [
      { id: 'route-open', marker: 'led-router', points: [[.17, .23], [.40, .23], [.40, .5]] },
      { id: 'route-closed', marker: 'led-coordinator', points: [[.63, .2], [.84, .2], [.84, .47], [.63, .47], [.63, .2]] },
    ],
  }];
  const ids = ['led-router', 'led-coordinator', 'led-child'];
  fixture.devices = {}; fixture.entities = {}; fixture.states = {}; fixture.areas = {};
  for (const [i, id] of ids.entries()) {
    fixture.devices[id] = { id, name: id, area_id: null, identifiers: [['zha', `00124b000000000${i + 1}`]],
      config_entries: ['golden_entry'], manufacturer: 'Fixture', model: 'Zigbee light', disabled_by: null };
    const entity_id = `light.${id.replaceAll('-', '_')}`;
    fixture.entities[entity_id] = { entity_id, device_id: id, platform: 'zha', disabled_by: null };
    fixture.states[entity_id] = { entity_id, state: i === 1 ? 'off' : 'on', attributes: {
      friendly_name: id, supported_color_modes: ['rgb'], color_mode: 'rgb', brightness: 210, rgb_color: [80, 170, 240],
    } };
  }
  fixture.config.markers = ids.map(id => ({ id, binding: `device:${id}`, space: SPACE, room_id: room.id,
    tap_action: 'info', value_badge: { enabled: false, position: 'bottom' } }));
  fixture.config.settings = { ...fixture.config.settings, sun_rays: false, moon_enabled: false,
    zigbee_topology: { enabled: true }, marker_area_snapshot: Object.fromEntries(ids.map(id => [id, null])) };
  fixture.layout = Object.fromEntries(ids.map((id, i) => [id, { s: SPACE, x: [.2, .7, .6][i], y: [.2, .2, .65][i] }]));
  fixture.zhaDevices = [
    { ieee: '00124b0000000001', nwk: 1, device_reg_id: ids[0], device_type: 'Router',
      routes: [{ dest_nwk: 0, next_hop: 0, route_status: 'Active' }], neighbors: [] },
    { ieee: '00124b0000000002', nwk: 0, device_reg_id: ids[1], device_type: 'Coordinator', neighbors: [] },
    { ieee: '00124b0000000003', nwk: 3, device_reg_id: ids[2], device_type: 'EndDevice',
      neighbors: [{ ieee: '00124b0000000001', relationship: 'Parent', lqi: 150 }] },
  ];
  return fixture;
}

export async function prepareZigbeeLed(page) {
  // Same explicit settings action as the existing battery/topology golden;
  // golden remounts own a different card from the ordinary __hpTest facade.
  await page.evaluate(() => window.__goldenCard.renderRoot.querySelector('[data-hp="settings"]').click());
  await page.waitForFunction(() => window.__goldenCard.renderRoot.querySelector('[data-section-target="zigbee"]'));
  await page.evaluate(() => window.__goldenCard.renderRoot.querySelector('[data-section-target="zigbee"]').click());
  await page.waitForFunction(() => [...(window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-settings')
    ?.shadowRoot?.querySelectorAll('button') || [])].some(n => /Read ZHA/i.test(n.textContent) && !n.disabled));
  await page.evaluate(() => [...window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-settings')
    .shadowRoot.querySelectorAll('button')].find(n => /Read ZHA/i.test(n.textContent)).click());
  await page.waitForFunction(() => /Received/i.test(window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-settings')
    ?.shadowRoot?.textContent || ''));
  await page.evaluate(() => window.__goldenCard.renderRoot.querySelector('hp-dialog [data-hp="dialog-cancel"]').click());
  await page.waitForFunction(() => !window.__goldenCard.renderRoot.querySelector('hp-dialog'));
  const point = await page.evaluate(() => {
    const path = window.__goldenCard.renderRoot.querySelector('.led-hit[data-id="led-router"]');
    if (!path) throw new Error('golden LED hit path missing');
    const p = path.getPointAtLength(path.getTotalLength() * .25).matrixTransform(path.getScreenCTM());
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(() => window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-overlay')
    ?.shadowRoot?.querySelectorAll('[data-hp="zigbee-topology-led-anchor"]').length === 2);
  return page.evaluate(() => {
    const overlay = window.__goldenCard.renderRoot.querySelector('hp-zigbee-topology-overlay').shadowRoot;
    const anchors = [...overlay.querySelectorAll('[data-hp="zigbee-topology-led-anchor"]')].map(n => {
      const r = n.getBoundingClientRect(); return { id: n.dataset.id, width: r.width, height: r.height };
    });
    const lines = overlay.querySelectorAll('[data-hp="zigbee-topology-line"]').length;
    if (lines !== 2 || anchors.some(a => Math.abs(a.width - 14) > .3 || Math.abs(a.height - 14) > .3))
      throw new Error('golden LED scene lacks real fixed-size endpoints and routes');
    return { anchors, lines };
  });
}
