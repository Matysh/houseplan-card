/** Exact metadata reads of buildDevices. Numeric state values are live inputs,
 * already refreshed by presentation; they do not choose roster membership. */
type StateRow = { attributes?: Record<string, unknown>; [key: string]: unknown };
type HassRows = { states?: Record<string, StateRow | undefined> };
type Dependency = { exists: boolean; fields: Map<string, string>; presence: Map<string, boolean>; attributes?: string };
const encoded = (value: unknown): string => JSON.stringify([value === undefined, value]);

export class DeviceRosterStateKey {
  private dependencies = new Map<string, Dependency>();
  private complete = false;

  matches(hass: HassRows): boolean {
    if (!this.complete) return false;
    for (const [id, dependency] of this.dependencies) {
      const row = hass.states?.[id];
      if (!!row !== dependency.exists) return false;
      if (!row) continue;
      if (dependency.attributes !== undefined && encoded(row.attributes) !== dependency.attributes) return false;
      for (const [key, present] of dependency.presence) {
        if (!!row.attributes && Reflect.has(row.attributes, key) !== present) return false;
        if (!row.attributes && present) return false;
      }
      for (const [key, value] of dependency.fields) {
        if (encoded(key === '*' ? row.attributes : row.attributes?.[key]) !== value) return false;
      }
    }
    return true;
  }

  capture<T extends HassRows, R>(hass: T, build: (observed: T) => R): R {
    const dependencies = new Map<string, Dependency>();
    const states = new Proxy(hass.states || {}, {
      get: (rows, key) => {
        const row = Reflect.get(rows, key);
        if (typeof key !== 'string') return row;
        let dependency = dependencies.get(key);
        if (!dependency) dependencies.set(key, dependency = { exists: !!row, fields: new Map(), presence: new Map() });
        if (!row || typeof row !== 'object') return row;
        return new Proxy(row, { get: (state, field) => {
          const value = Reflect.get(state, field);
          if (field !== 'attributes') return value;
          if (!value || typeof value !== 'object') {
            dependency!.attributes = encoded(value);
            return value;
          }
          return new Proxy(value, {
            get: (attributes, name) => {
              const result = Reflect.get(attributes, name);
              if (typeof name === 'string') dependency!.fields.set(name, encoded(result));
              return result;
            },
            ownKeys: attributes => {
              dependency!.fields.set('*', encoded(attributes));
              return Reflect.ownKeys(attributes);
            },
            has: (attributes, name) => {
              if (typeof name === 'string') dependency!.presence.set(name, Reflect.has(attributes, name));
              return Reflect.has(attributes, name);
            },
          });
        } });
      },
    });
    const result = build({ ...hass, states });
    this.dependencies = dependencies; this.complete = true;
    return result;
  }

  clear(): void { this.dependencies.clear(); this.complete = false; }
}
