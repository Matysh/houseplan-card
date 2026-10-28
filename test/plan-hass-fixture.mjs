export function projectionFixture({ HouseplanCard, virtualLightSnapshot, data }) {
  const projection = Object.getOwnPropertyDescriptor(HouseplanCard.prototype, '_planHass').get;
  let processed = 0, reads = 0;
  const devices = data?.devices ?? Object.fromEntries(Array.from({ length: 214 }, (_, i) =>
    [`device_${i}`, { id: `device_${i}`, disabled_by: null }]));
  const entities = data?.entities ?? Object.fromEntries(Array.from({ length: 2890 }, (_, i) =>
    [`sensor.tick_${i}`, { entity_id: `sensor.tick_${i}`, device_id: `device_${i % 214}`, disabled_by: null }]));
  const snapshot = { revision: 1, authoritative: true, access: 'full', devices,
    entities: new Proxy(entities, { get(target, key) {
      if (typeof key === 'string' && key.startsWith('sensor.')) processed++;
      return Reflect.get(target, key);
    } }), lastSuccess: 1 };
  const states = data?.states ?? Object.fromEntries(Array.from({ length: 1673 }, (_, i) =>
    [`sensor.tick_${i}`, { entity_id: `sensor.tick_${i}`, state: '0', attributes: {} }]));
  const host = { hass: { connection: {}, user: {}, states, devices, entities }, _haRegistry: snapshot,
    _hassSequence: 0, _continuity: { note() {} }, _ensureHaRegistryAuthority() {},
    _hookConnection() {}, _loadOk: true, _maybeRebuildDevices() {}, _vacTick() {},
    _activityTick() {}, ownerDocument: { visibilityState: 'visible' },
    _config: {}, _space: 'f1', _displayDevices: [], _activityRt: new Map(),
    _virtualLights: virtualLightSnapshot(null) };
  Object.defineProperty(host, '_planHass', { get() { reads++; return projection.call(this); } });
  void host._planHass;
  return { host, reset() { processed = 0; reads = 0; }, count: () => processed, reads: () => reads };
}
