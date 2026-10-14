// A small wire fixture, not a second backend validator. Payloads are cloned at
// the boundary so an optimistic client cannot mutate the saved server document.
export function createFixtureStore(config, layout, emit = () => {}) {
  let cfg = structuredClone(config), positions = structuredClone(layout);
  let configRev = 1, layoutRev = 1;
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const changed = (kind) => emit(`houseplan_${kind}_updated`, kind === 'config' ? configRev : layoutRev);
  const cas = (message, rev) => {
    if ((rev && !Object.hasOwn(message, 'expected_rev'))
      || (Object.hasOwn(message, 'expected_rev') && message.expected_rev !== rev)) {
      const error = new Error('changed on the server; reload the saved revision');
      error.code = 'conflict'; throw error;
    }
  };
  return {
    get configRev() { return configRev; },
    get layoutRev() { return layoutRev; },
    pushConfig(value) { cfg = structuredClone(value); configRev++; changed('config'); return configRev; },
    pushLayout(value) { positions = structuredClone(value); layoutRev++; changed('layout'); return layoutRev; },
    // The old optimizer stub is deliberately not a geometry implementation.
    advanceOptimizer() { return { config_rev: ++configRev, layout_rev: ++layoutRev }; },
    handle(m) {
      switch (m.type) {
        case 'houseplan/config/get': return { config: structuredClone(cfg), rev: configRev, can_write: true };
        case 'houseplan/layout/get': return { layout: structuredClone(positions), rev: layoutRev };
        case 'houseplan/config/set': {
          cas(m, configRev);
          const next = structuredClone(m.config);
          if (!equal(next, cfg)) { cfg = next; configRev++; changed('config'); }
          return { ok: true, rev: configRev };
        }
        case 'houseplan/layout/set': {
          cas(m, layoutRev);
          const next = structuredClone(m.layout);
          if (!equal(next, positions)) { positions = next; layoutRev++; changed('layout'); }
          return { ok: true, rev: layoutRev };
        }
        case 'houseplan/layout/update': {
          const next = structuredClone(m.pos);
          if (!equal(next, positions[m.device_id])) {
            positions = { ...positions, [m.device_id]: next }; layoutRev++; changed('layout');
          }
          return { ok: true, rev: layoutRev };
        }
        case 'houseplan/layout/delete': {
          let rev = null;
          if (Object.hasOwn(positions, m.device_id)) {
            const next = { ...positions }; delete next[m.device_id]; positions = next;
            rev = ++layoutRev; changed('layout');
          }
          return { ok: true, rev };
        }
        default: return undefined;
      }
    },
  };
}

export function createServiceRecorder(perform) {
  const calls = [];
  const callService = async (...args) => {
    calls.push(structuredClone(args));
    return perform(...args);
  };
  return { calls, callService };
}
