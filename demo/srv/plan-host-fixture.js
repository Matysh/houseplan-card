/** Synthetic wire storage for #1392. Not an HA emulator or backend validator. */
import { createFixtureStore } from './fixture-state.js';

export function createPlanHostFixture(config, { ready = true, capabilities, presentation: initialPresentation, api = {} } = {}) {
  const commands = [], listeners = new Set(), events = new Map(), forbiddenReads = [];
  const assets = new Map(), plans = [];
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const empty = Object.freeze({});
  let key = {}, writeRevision = 1, revision = 1, failRead = false, preview;
  const presentationBridge = value => new Proxy(Object.freeze(value || { language: 'en', locale: { language: 'en' }, themes: { darkMode: false } }), {
    get(target, name) {
      if (['states', 'registry', 'devices', 'entities', 'user', 'auth', 'connection', 'callWS', 'callService', 'fetchWithAuth'].includes(name)) {
        forbiddenReads.push(String(name)); throw Error(`forbidden presentation read: ${String(name)}`);
      }
      return Reflect.get(target, name);
    },
  });
  let environment = Object.freeze({ ready, connected: ready, userId: 'local-owner',
    permissions: { read: true, write: true, admin: true }, timeZone: 'Europe/Moscow', units: { length: 'km' },
    states: empty, registry: { revision: 0, authoritative: false, access: 'limited', devices: empty,
      entities: empty, areas: empty, lastSuccess: 0 }, presentation: presentationBridge(initialPresentation) });
  const store = createFixtureStore(config, {}, (event, rev) => {
    for (const receive of [...events.get(event) || []]) receive({ data: { rev } });
  });
  const error = code => Object.assign(new Error(code), { code });
  const current = (authority, epoch) => { if (key !== authority || writeRevision !== epoch) throw error('context-changed'); };
  const available = () => { if (!environment.ready || !environment.connected) throw error('not_ready'); };
  const publish = patch => {
    environment = Object.freeze({ ...environment, ...patch }); revision++;
    for (const receive of [...listeners]) receive();
  };
  const host = {
    capabilities: Object.freeze(capabilities || Object.fromEntries(['devices', 'virtualDevices', 'deviceServices', 'haAreas', 'zigbee', 'vacuum', 'radar', 'alarms', 'summary', 'externalScreens', 'installationBackup', 'planTransfer', 'printing', 'planImages', 'decorAssets', 'planMaintenance', 'supportDiagnostics'].map(name => [name, true]))),
    get authorityKey() { return key; }, get writeAuthorityRevision() { return writeRevision; },
    get environmentRevision() { return revision; }, get environment() { return environment; },
    async request(command) {
      available();
      if (!command.type.startsWith('houseplan/')) throw error('invalid_payload');
      commands.push(structuredClone(command));
      const authority = key, epoch = writeRevision;
      if (failRead && command.type === 'houseplan/config/get') { failRead = false; throw error('fixture_read_failed'); }
      let result;
      if (command.type === 'houseplan/export/create') {
        result = { document: { kind: command.kind, config: store.handle({ type: 'houseplan/config/get' }).config }, filename: 'local-plan.json' };
      } else if (command.type === 'houseplan/plans/list' || command.type === 'houseplan/assets/list') {
        result = { plans: [...plans], assets: [...assets.values()] };
      } else if (command.type === 'houseplan/assets/delete') {
        assets.delete(command.asset_id); result = { ok: true };
      } else if (command.type === 'houseplan/import/apply') {
        if (!preview || command.token !== preview.token) throw error('preview_expired');
        if (command.expected_config_rev !== store.configRev || command.expected_layout_rev !== store.layoutRev) throw error('conflict');
        store.pushConfig(preview.config); store.pushLayout({}); preview = undefined;
        result = { ok: true, kind: 'full' };
      } else if (command.type === 'houseplan/backup/cancel') { preview = undefined; result = { ok: true }; }
      else {
        result = store.handle(command);
        if (command.type === 'houseplan/config/get') result = { ...result, opening_features_api: 1, room_label_layout_api: 1,
          decor_assets_api: 1, graph_change_api: 2, ...api };
        if (result === undefined) throw error('fixture_unsupported');
      }
      await Promise.resolve(); current(authority, epoch); return result;
    },
    async subscribe(event, receive) {
      available();
      const set = events.get(event) ?? new Set(); events.set(event, set); set.add(receive);
      commands.push({ subscribe: event }); let live = true;
      return () => { if (live) { live = false; set.delete(receive); commands.push({ release: event }); } };
    },
    subscribeEnvironment(receive) { listeners.add(receive); return () => listeners.delete(receive); },
    content: { async resolve(paths) { available(); return Object.fromEntries(paths.map(path => [path, path.includes('fixture') || path.includes('/assets/_/') ? pixel : path])); },
      async resolveAssets(ids) { available(); return { assets: ids.flatMap(id => assets.has(id) ? [assets.get(id)] : []) }; } },
    http: {
      async request(path, init) {
        available(); const authority = key, epoch = writeRevision;
        commands.push({ http: path, method: init?.method });
        if (path === '/api/houseplan/plans/upload') {
          const url = '/local/houseplan/plans/_/fixture.png'; plans.push({ name: 'fixture.png', url });
          return Response.json({ url });
        }
        if (path === '/api/houseplan/assets/upload') {
          const asset_id = 'c'.repeat(64), asset = { asset_id, name: 'fixture.png', mime: 'image/png', width: 1, height: 1, bytes: 68,
            url: `/api/houseplan/content/assets/_/${asset_id}.png` };
          assets.set(asset_id, asset); return Response.json({ asset });
        }
        if (!path.startsWith('/api/houseplan/import/preview')) throw error('fixture_unsupported');
        const document = JSON.parse(await init.body.text()); current(authority, epoch);
        if (init.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        // Opaque preview/apply protocol fixture only. Production parsing/repair
        // stays in Python and is tested against real HA on the release route.
        preview = { token: `local-${revision}`, config: structuredClone(document.config) };
        return Response.json({ token: preview.token, expected_config_rev: store.configRev, expected_layout_rev: store.layoutRev,
          preview: { kind: document.kind || 'full', spaces: document.config.spaces.length, markers: document.config.markers.length,
            warnings: [], content: [], confirmation_required: false } });
      },
      async postJson() { throw error('fixture_unsupported'); },
    },
  };
  return { host, commands, forbiddenReads,
    presentation: value => publish({ presentation: presentationBridge(value) }),
    tick: () => publish({}), ready: () => publish({ ready: true, connected: true }),
    connected: value => publish({ connected: value }), failNextRead: () => { failRead = true; },
    permissions: value => { writeRevision++; publish({ permissions: { ...environment.permissions, ...value } }); },
    foreign: () => { key = {}; writeRevision++; publish({}); },
    get listenerCount() { return listeners.size; },
    get subscriptionCount() { return [...events.values()].reduce((count, set) => count + set.size, 0); },
    saved: () => structuredClone(store.handle({ type: 'houseplan/config/get' }).config),
  };
}
