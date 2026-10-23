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
    handle(m, registryEntities = []) {
      switch (m.type) {
        case 'houseplan/config/get': return { config: structuredClone(cfg), rev: configRev, can_write: true, device_contact_api: 1 };
        case 'houseplan/layout/get': return { layout: structuredClone(positions), rev: layoutRev };
        case 'houseplan/marker/copy': {
          cas({ expected_rev: m.expected_config_rev }, configRev);
          cas({ expected_rev: m.expected_layout_rev }, layoutRev);
          const target = structuredClone(cfg), marker = structuredClone(m.marker);
          const own = m.source_binding.startsWith('entity:') ? [m.source_binding.slice(7)]
            : registryEntities.filter(row => row.device_id === m.source_binding.slice(7) && !row.disabled_by).map(row => row.entity_id);
          target.markers ||= [];
          if (target.markers.some(row => row.id === marker.id) || positions[marker.id]) throw new Error('duplicate copy id');
          for (const controller of target.markers) if (controller.id !== m.source_id && !controller.removed
            && controller.controls?.some(id => id === `marker:${m.source_id}` || own.includes(id))) {
            controller.controls = [...controller.controls, `marker:${marker.id}`];
          }
          target.markers.push(marker);
          cfg = target; positions = { ...positions, [marker.id]: structuredClone(m.position) };
          configRev++; layoutRev++; changed('config'); changed('layout');
          return { config: structuredClone(cfg), layout: structuredClone(positions), config_rev: configRev, layout_rev: layoutRev };
        }
        case 'houseplan/config/set': {
          cas(m, configRev);
          if (m.contact_layout) cas({expected_rev:m.expected_layout_rev},layoutRev);
          const next = structuredClone(m.config);
          const nextPositions=m.contact_layout ? {...positions,...structuredClone(m.contact_layout)} : positions;
          const configChanged=!equal(next,cfg),layoutChanged=!equal(nextPositions,positions);
          // Publish neither half before both CAS checks and both candidates exist.
          cfg=next;positions=nextPositions;
          if(configChanged)configRev++;
          if(layoutChanged)layoutRev++;
          if(configChanged)changed('config');
          if(layoutChanged)changed('layout');
          return { ok: true, rev: configRev,...(m.contact_layout?{layout_rev:layoutRev,contact_layout:structuredClone(m.contact_layout)}:{}) };
        }
        case 'houseplan/layout/set': {
          cas(m, layoutRev);
          if(Object.hasOwn(m,'expected_config_rev'))cas({expected_rev:m.expected_config_rev},configRev);
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
