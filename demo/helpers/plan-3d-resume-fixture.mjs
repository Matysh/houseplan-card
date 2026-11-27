import { makeLargeHouseFixture } from '../fixtures/large-house.mjs';
import { currentGraphFixture } from './graph-fixture.mjs';

export const fixture = makeLargeHouseFixture({
  floors: 2, roomsPerFloor: 4, devices: 16, openings: 8, partitions: 2, columns: 0, decor: 3, stairs: 1,
});
fixture.config = currentGraphFixture(fixture.config);
Object.assign(fixture.config.settings, {
  volumetric_view: true, bg_mode: 'static', filter_seeded: true,
  known_devices: Object.keys(fixture.devices).sort(), new_device_ids: [],
  marker_area_snapshot: Object.fromEntries(Object.values(fixture.devices).map(device =>
    [device.id, { binding: 'device:' + device.id, area: device.area_id }])),
});

// Also executed in an isolated Chromium page without a debugger attached.
export function mountResumeFixture({ data, deferGpu, Host }) {
  let openingGpu = deferGpu;
  const presentOutsideGate = Host?.prototype.present;
  if (deferGpu) {
    Host.prototype.present = function (...args) {
      if (!openingGpu) return presentOutsideGate.apply(this, args);
    };
  }
  const panel = document.createElement('houseplan-panel');
  panel.route = { prefix: '/houseplan', path: '' };
  panel.panel = { component_name: 'houseplan-panel' };
  const base = window.__mkHass();
  const writes = [], calls = [];
  const gate = {};
  const connection = Object.assign(new EventTarget(), {
    connected: true, subscribeEvents: async () => () => {}, subscribeMessage: async () => () => {},
  });
  panel.hass = {
    ...base,
    devices: data.devices, entities: data.entities, states: data.states, areas: data.areas,
    connection,
    user: { id: 'resume-fixture', is_admin: true },
    callService: (...args) => { writes.push(args[1]); },
    callWS: async request => {
      calls.push(request.type);
      if (request.type === 'houseplan/config/get' || request.type === 'houseplan/layout/get')
        await gate.reads;
      if (request.type === 'houseplan/config/get') return { config: structuredClone(data.config), rev: 1,
        can_write: true, device_contact_api: 1, plan_graph_api: 1 };
      if (request.type === 'houseplan/layout/get') return { layout: structuredClone(data.layout), rev: 1 };
      if (request.type === 'config/device_registry/list') return Object.values(data.devices);
      if (request.type === 'config/entity_registry/list') return Object.values(data.entities);
      return base.callWS(request);
    },
  };
  const host = document.getElementById('host');
  host.style.cssText = 'width:100%;max-width:none;margin:0;padding:0;';
  host.replaceChildren(panel);
  const card = () => panel.shadowRoot?.querySelector('houseplan-card');
  window.__tabResume = { panel, writes, calls, gate, connection, card,
    floors: data.config.spaces.map(space => space.id),
    releaseOpeningGpu: () => {
      if (openingGpu) Host.prototype.present = presentOutsideGate;
      openingGpu = false;
      card()?.requestUpdate();
    },
  };
}
