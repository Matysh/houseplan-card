// #291: the production bundle's ordinary config and point-wise layout writers
// must adopt and send the same exact lattice candidate without editor-specific
// snap calls.
import { launch, checkAll, finish } from './serve.mjs';
import { latticeProfile } from '../scripts/model-invariants.mjs';

const { page, browser } = await launch({ width: 920, height: 840 });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const result = {};
  const node = 83 / 240;
  const noise = Number(node.toFixed(9));
  const far = 0.0605;
  const unknown = 0.1234567896;
  const config = {
    model_version: 7,
    spaces: [{
      id: 'floor', title: 'Floor', cell_cm: 5, view_box: [0, 0, 1, 1],
      plan_x: unknown,
      rooms: [{ id: 'room', poly: [[noise, noise], [0.5, noise], [0.5, 0.5], [noise, 0.5]] }],
      walls: [{ key: '0.422917,0.345833@0.0000', cm: 20, a: [noise, noise], b: [0.5, noise] }],
      openings: [{ id: 'door', type: 'door', x: noise, y: noise,
        angle: 1.2345678906, length: 0.2, host: { kind: 'partition', id: 'p', t: 0.5 } }],
      decor: [
        { id: 'line', kind: 'line', x1: noise, y1: noise, x2: 0.5, y2: noise },
        { id: 'box', kind: 'rect', x: far, y: noise, w: noise, h: noise, angle: 0 },
        { id: 'label', kind: 'text', x: noise, y: noise, scale: 1, angle: 0 },
      ],
      room_drafts: [{ id: 'draft', points: [[noise, noise], [0.5, noise]] }],
      partitions: [{ id: 'p', a: [noise, noise], b: [noise, 0.5], cm: 10 }],
      wall_columns: [{ id: 'column', shape: 'circle', center: [noise, noise], cm: 20 }],
      open_spans: [{ a: [0.5, noise], b: [0.5, 0.5] }],
      future: { numeric: unknown },
    }],
    markers: [{ id: 'marker', angle: 1.2345678906, future: unknown }],
    settings: {},
  };
  const writes = [];
  let rev = 10;
  const baseCall = card.hass.callWS.bind(card.hass);
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      writes.push(structuredClone(message));
      return { ok: true, rev: ++rev };
    }
    if (message.type === 'houseplan/layout/update') {
      writes.push(structuredClone(message));
      return { ok: true, rev: ++rev };
    }
    return baseCall(message);
  } };

  card._serverCfg = structuredClone(config);
  card._cfgRev = 10;
  card._pendingPhysicalWrites.clear();
  await card._writeConfig();
  const configWrite = writes.find((write) => write.type === 'houseplan/config/set');
  const sent = configWrite?.config;
  const serialized = JSON.stringify(sent);
  result.configWriterAdoptsExactPayload = !!sent
    && JSON.stringify(card._serverCfg) === serialized;
  const floor = sent?.spaces[0];
  result.roomAndWallCoordinatesCanonical = floor?.rooms?.[0]?.poly?.[0]?.[0] === node
    && floor?.walls?.[0]?.a?.[0] === node;
  result.openingAndDecorCoordinatesCanonical = floor?.openings?.[0]?.x === node
    && floor?.decor?.[0]?.x1 === node && floor?.decor?.[1]?.w === node
    && floor?.decor?.[2]?.x === node;
  result.draftPartitionColumnSpanCoordinatesCanonical =
    floor?.room_drafts?.[0]?.points?.[0]?.[0] === node
    && floor?.partitions?.[0]?.a?.[0] === node
    && floor?.wall_columns?.[0]?.center?.[0] === node
    && floor?.open_spans?.[0]?.a?.[1] === node;
  result.authoredOffGridAndUnknownSurvive = floor?.decor?.[1]?.x === far
    && floor?.future?.numeric === unknown
    && sent?.markers?.[0]?.future === unknown;
  result.scalarFieldsKeepNineDecimalContract = floor?.plan_x === 0.12345679
    && floor?.openings?.[0]?.angle === 1.234567891
    && sent?.markers?.[0]?.angle === 1.234567891;

  card._serverStorage = true;
  card._layout = {
    marker: { s: 'floor', x: noise, y: noise, future: unknown },
    'rl:room': { s: 'floor', x: noise, y: noise },
  };
  card._dirtyPos = new Set(Object.keys(card._layout));
  card._persistLayout();
  card._persistLayout.flush();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const positionWrites = writes.filter((write) => write.type === 'houseplan/layout/update');
  result.layoutWritersAllCanonical = positionWrites.length === 2
    && positionWrites.every((write) => write.pos.x === node && write.pos.y === node)
    && Object.values(card._layout).every((position) => position.x === node && position.y === node);
  result.layoutMetadataSurvives = card._layout.marker.future === unknown;
  return {
    result,
    // Profile the exact candidates adopted by the production writers, not the
    // noisy objects injected above. This is the common-boundary half of AC4;
    // the controller half is exercised by the production smokes named in the
    // specification and docs/TESTING.md.
    committedPairs: [
      { config: structuredClone(sent), layout: {} },
      { config: structuredClone(sent), layout: structuredClone(card._layout) },
    ],
  };
});

out.result.latticeProfileNoiseZeroAfterEveryCommittedPair = out.committedPairs
  .every((model) => latticeProfile(model).noise === 0);
await finish(browser, checkAll(out.result));
