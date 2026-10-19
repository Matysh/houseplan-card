import { createFixtureStore } from '/fixture-state.js';
import { loadSession, saveSession, sessionIdentity, sessionKey } from './session.mjs';
export async function createMockHa(notify) {
  const provenance = await (await fetch('/provenance.json')).json();
  const fixture = await (await fetch('/fixture.json')).json();
  const identity = sessionIdentity(provenance);
  // Never overwrite sessions for other datasets, product builds or old labs.
  const KEY = sessionKey(identity);
  let saved;
  try { saved = loadSession(localStorage, identity); }
  catch (error) { notify(`Сессия не загружена: ${error.message}. Исходная запись сохранена.`); }
  const listeners = new Map();
  const emit = (type, rev) => queueMicrotask(() => {
    for (const fn of listeners.get(type) || []) fn({ event_type: type, data: { rev } });
  });
  const store = createFixtureStore(saved?.config || fixture.config, saved?.layout || fixture.layout, emit);
  const runtime = { ...fixture, states: saved?.states || fixture.states };
  const virtualOff = new Set(saved?.virtualLightsOff || fixture.virtualLightsOff || []);
  let virtualRev = 0;
  const recorder = window.__labSafety;
  const services = Object.fromEntries(['light', 'switch', 'homeassistant', 'fan', 'humidifier', 'input_boolean', 'automation', 'remote', 'climate', 'media_player', 'vacuum', 'siren', 'water_heater'].map(d => [d, { turn_on: {}, turn_off: {}, toggle: {} }]));
  services.cover = { open_cover: {}, close_cover: {}, stop_cover: {}, set_cover_position: {}, toggle: {} };
  services.lock = { lock: {}, unlock: {} };
  services.vacuum = { start: {}, pause: {}, stop: {}, return_to_base: {} };
  services.climate = { turn_on: {}, turn_off: {}, toggle: {}, set_hvac_mode: {}, set_temperature: {} };
  const snapshot = () => ({ config: store.handle({ type: 'houseplan/config/get' }).config, layout: store.handle({ type: 'houseplan/layout/get' }).layout, states: runtime.states, virtualLightsOff: [...virtualOff] });
  const persist = () => {
    try { saveSession(localStorage, identity, snapshot()); return true; }
    catch (error) { notify(`Не удалось сохранить локальную сессию: ${error.message}`); return false; }
  };
  const connection = {
    connected: true,
    subscribeEvents: async (fn, type) => {
      const set = listeners.get(type) || new Set(); listeners.set(type, set); set.add(fn); return () => set.delete(fn);
    },
    subscribeMessage: async (fn, message) => {
      if (message.type !== 'houseplan/zigbee/subscribe') throw Error(`UI Lab: unsupported local subscription ${message.type}`);
      let active = true;
      if (message.type === 'houseplan/zigbee/subscribe') queueMicrotask(() => {
        if (!active) return;
        const topics = Object.entries(runtime.zigbee?.topics || {});
        fn({ kind: 'reset', session_id: 'offline-ui-lab', revision: 0, topics: topics.map(([topic]) => topic) });
        topics.forEach(([topic, value], i) => fn({ kind: 'state', session_id: 'offline-ui-lab', revision: i + 1,
          provider: { topic, job_id: `snapshot-${i}`, phase: 'ready', elapsed_ms: 0, obtained_at: value.obtained_at, result: value.map, persistence: 'saved' } }));
      });
      return () => { active = false; };
    },
    addEventListener() {}, removeEventListener() {},
  };
  let panel;
  const hass = {
    language: window.__labLanguage || 'ru',
    locale: { language: window.__labLanguage || 'ru', number_format: 'comma_decimal', time_format: '24', first_weekday: 'monday' },
    user: { id: 'ui-lab-admin', name: 'UI Lab', is_admin: true, is_owner: true },
    config: { latitude: 52, longitude: 13, elevation: 0, time_zone: 'UTC', unit_system: { temperature: '°C', length: 'km', mass: 'kg' }, version: '2026.10.2', ...runtime.hostConfig, components: ['houseplan', 'demo'] },
    devices: runtime.devices, entities: runtime.entities, areas: runtime.areas, states: runtime.states,
    floors: runtime.floors || { ground: { floor_id: 'ground', name: 'Ground floor', level: 0 }, upper: { floor_id: 'upper', name: '2nd floor', level: 1 } },
    services, connection, themes: { darkMode: true, themes: {} },
    localize: key => ({ 'panel.houseplan': 'House Plan', 'ui.panel.custom.external_panel.trust': 'House Plan' }[key] || window.__labLocalize?.(key) || null),
    formatEntityState: st => {
      const states = { on: 'Включено', off: 'Выключено', open: 'Открыто', closed: 'Закрыто', unavailable: 'Недоступно', locked: 'Закрыт', docked: 'На базе' };
      return states[st.state] || st.state;
    },
    callApi: async (_method, path) => { throw Error(`UI Lab: live API disabled (${path})`); },
    hassUrl: path => new URL(path, location.origin).href,
    callWS: async message => {
      const type = message.type;
      recorder.ws.push(type); if (recorder.ws.length > 200) recorder.ws.shift();
      if (type === 'config/device_registry/list') return Object.values(runtime.devices);
      if (type === 'config/entity_registry/list') return Object.values(runtime.entities);
      if (type === 'config/area_registry/list') return Object.values(runtime.areas);
      if (type === 'config/floor_registry/list') return Object.values(hass.floors);
      if (type === 'config_entries/get') return runtime.integrations || [{ entry_id: 'lab_entry', domain: 'demo', title: 'Демонстрационные устройства' }, { entry_id: 'golden_entry', domain: 'houseplan_golden', title: 'Демо-данные' }];
      if (type === 'manifest/list') return runtime.manifests || [{ domain: 'demo', name: 'Demo devices' }, { domain: 'houseplan_golden', name: 'Synthetic home' }, { domain: 'dreame_vacuum', name: 'Dreame Vacuum' }];
      if (type === 'houseplan/assets/resolve') return { assets: (runtime.assets || []).filter(x => message.asset_ids.includes(x.asset_id)) };
      if (type === 'houseplan/assets/list') return { assets: runtime.assets || [] };
      if (type === 'houseplan/content/sign') return { urls: Object.fromEntries((message.paths || [])
        .filter(path => (runtime.assets || []).some(asset => asset.url === path)).map(path => [path, path])) };
      if (type === 'houseplan/virtual_light/toggle') {
        const marker = snapshot().config.markers.find(m => m.id === message.marker_id && m.binding === 'virtual' && m.is_light === true && m.tap_action === 'toggle' && !m.removed);
        if (!marker) throw Object.assign(Error('Marker is not a manual virtual light'), { code: 'not_toggleable' });
        if (virtualOff.has(marker.id)) virtualOff.delete(marker.id); else virtualOff.add(marker.id);
        const result = { marker_id: marker.id, on: !virtualOff.has(marker.id), rev: ++virtualRev };
        persist(); for (const fn of listeners.get('houseplan_virtual_light_updated') || []) fn({ event_type: 'houseplan_virtual_light_updated', data: result });
        return result;
      }
      const result = store.handle(message, Object.values(runtime.entities));
      if (result !== undefined) {
        if (type === 'houseplan/config/get') return { ...result, integration_version: provenance.productVersion, decor_assets_api: 1, summary_panel_api: 1, wall_node_move_api: 1, radar_stage1_api: 1, zigbee_scan_api: 1, zigbee_maps_api: 1, virtual_lights: { rev: virtualRev, config_rev: store.configRev, off: [...virtualOff] } };
        if (type !== 'houseplan/layout/get') persist();
        return result;
      }
      if (/houseplan\/(plans|assets)\/list$/.test(type)) return { plans: [], assets: [] };
      if (type === 'houseplan/trail/get') return { trails: {} };
      if (type === 'houseplan/radar/setup/inspect') return { sources: [], rooms: [], sessions: [], available: false };
      const error = new Error(`В локальном стенде это действие не подключено: ${type}`); error.code = 'lab_not_implemented';
      notify(error.message); throw error;
    },
    callService: async (domain, service, data) => {
      if (!Object.hasOwn(services[domain] || {}, service)) throw Error(`UI Lab: unsupported local service ${domain}.${service}`);
      const ids = Array.isArray(data?.entity_id) ? data.entity_id : [data?.entity_id];
      if (!ids.length || ids.some(id => typeof id !== 'string' || !runtime.states[id]
        || (domain !== 'homeassistant' && id.split('.')[0] !== domain))) throw Error('UI Lab: unknown local service target');
      recorder.services.push({ domain, service, data: structuredClone(data) });
      if (recorder.services.length > 200) recorder.services.shift();
      for (const id of ids) {
        const old = runtime.states[id]; if (!old) continue;
        const active = ['on', 'playing', 'open', 'unlocked', 'cleaning'].includes(old.state);
        const kind = id.split('.')[0], attributes = { ...old.attributes };
        let state = old.state;
        if (kind === 'cover') {
          if (service === 'set_cover_position') attributes.current_position = Math.max(0, Math.min(100, Number(data.position)));
          else if (service === 'open_cover') attributes.current_position = 100;
          else if (service === 'close_cover') attributes.current_position = 0;
          else if (service === 'toggle') attributes.current_position = old.state === 'closed' ? 100 : 0;
          if (service !== 'stop_cover') state = Number(attributes.current_position) > 0 ? 'open' : 'closed';
        } else if (kind === 'lock' && ['lock', 'unlock'].includes(service)) state = service === 'lock' ? 'locked' : 'unlocked';
        else if (kind === 'vacuum') state = ({ start: 'cleaning', pause: 'paused', stop: 'idle', return_to_base: 'docked' })[service] || state;
        else if (service === 'set_hvac_mode') state = data.hvac_mode;
        else if (service === 'turn_on') state = kind === 'climate' ? 'auto' : 'on';
        else if (service === 'turn_off') state = 'off';
        else if (service === 'toggle') state = active ? 'off' : kind === 'climate' ? 'auto' : 'on';
        for (const key of ['temperature', 'brightness', 'rgb_color', 'hs_color', 'color_temp_kelvin', 'percentage', 'preset_mode']) if (data[key] !== undefined) attributes[key] = data[key];
        runtime.states = { ...runtime.states, [id]: { ...old, state, attributes, last_updated: new Date().toISOString() } };
      }
      hass.states = runtime.states; if (panel) panel.hass = { ...hass };
      persist(); notify('Демо: изменено только локальное состояние');
      return { response: null };
    },
  };
  return { hass, snapshot, identity, sessionKey: KEY, datasetId: identity.datasetId, capturedAt: fixture.capturedAt,
    attach(p) { panel = p; },
    setDarkMode(value) { hass.themes = { ...hass.themes, darkMode: value }; if (panel) panel.hass = { ...hass }; }, persist };
}
