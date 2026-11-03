// Issue #478 persists every accepted click as one crash-safe ordinary
// partition. Issue #477 adds the complementary finish boundary: once the
// chain ends, its compatible collinear click records collapse to fixed point.
//
// The unit tests own the rules; this smoke owns the wiring — that finishing a
// chain in the real editor rewrites only the completed compatible run.
import { launch, checkAll, finish } from './serve.mjs';
import { currentGraphFixture, editGraphFixture } from './helpers/graph-fixture.mjs';
import { encodePoint, readSourcePoint, decodePoint, pointToNumbers } from '../test-build/plan-exact.js';
const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
await page.exposeFunction('chainPartitionFixture', (source, partitions) => {
  const config = currentGraphFixture(source), id = config.spaces[0].id;
  const ids = [...new Set([...config.spaces[0].partitions || [], ...partitions].map(wall => wall.id))];
  // These records represent one already accepted chain, so name its intended
  // contacts explicitly; equal projected numbers alone do not confer identity.
  const endpointRefs = Object.fromEntries(partitions.map(wall => [wall.id, [wall.a, wall.b].map(p => {
    const old = config.spaces[0].plan_graph.nodes.find(node => {
      const value = pointToNumbers(decodePoint(node.p)); return value[0] === p[0] && value[1] === p[1];
    });
    return old ? { kind: 'existing-node', node: old.id }
      : { kind: 'independent', node: 'fixture-chain:' + JSON.stringify(p), p: encodePoint(readSourcePoint(p)) };
  })]));
  editGraphFixture(config, id, { kind: 'partitions', ids, endpointRefs }, draft => { draft.partitions = partitions; });
  return config;
});
const initialChain = currentGraphFixture({ spaces: [{ id: 'chain', title: 'Chain',
  view_box: [0, 0, 1, 1], rooms: [{ id: 'envelope',
    poly: [[.01, .01], [.99, .01], [.99, .99], [.01, .99]] }], partitions: [] }],
  markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } });
await page.evaluate(async config => {
  await window.__hpTest.setServerConfig(config); await window.__hpTest.setLayout({});
  await window.__hpTest.switchSpace('chain'); await window.__hpTest.setMode('plan');
}, initialChain);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const settle = async () => {
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    await c.updateComplete;
  };
  const space = () => c._serverCfg.spaces.find((s) => s.id === c._space);
  const partitionCount = () => (space().partitions || []).length;
  const seedAcceptedPartitions = async partitions => {
    c._serverCfg = await window.chainPartitionFixture(c._serverCfg, partitions);
    c._cfgEpoch++; c._modelCache = null; await settle();
  };

  c._mode = 'plan'; c.requestUpdate(); await settle();
  await new Promise((r) => setTimeout(r, 400));
  c._tool = 'draw'; c._drawWallCm = 15; c.requestUpdate(); await settle();

  const before = partitionCount();

  // Four clicks along one straight line, already persisted as three walls,
  // then finish the session.
  c._path = [[200, 500], [300, 500], [420, 500], [560, 500]];
  const straightIds = ['straight-a', 'straight-b', 'straight-c'];
  await seedAcceptedPartitions([...(space().partitions || []),
    { id: straightIds[0], a: [.2, .5], b: [.3, .5], cm: 15 },
    { id: straightIds[1], a: [.3, .5], b: [.42, .5], cm: 15 },
    { id: straightIds[2], a: [.42, .5], b: [.56, .5], cm: 15 }]);
  c._activeWallChainId = 'straight-chain';
  c._activeWallChainPartitionIds = straightIds;
  c._wallChainSegmentCms = [15, 15, 15];
  out.chainHasThreeSegments = c._path.length - 1 === 3;
  c._finishWallChain();
  await settle();

  const straight = (space().partitions || []).slice(before);
  out.straightRunMergedAtFinish = straight.length === 1
    && straight[0].id === straightIds[0];
  out.straightRunSpansTheChain = Math.abs(straight[0].a[0] * 1000 - 200) < 0.01
    && Math.abs(straight[0].b[0] * 1000 - 560) < 0.01;
  out.straightRunKeepsThickness = straight.every((item) => item.cm === 15);

  // A corner is not a straight run: two records, one node between them.
  const beforeCorner = partitionCount();
  c._path = [[200, 700], [400, 700], [400, 820]];
  const cornerIds = ['corner-a', 'corner-b'];
  await seedAcceptedPartitions([...(space().partitions || []),
    { id: cornerIds[0], a: [.2, .7], b: [.4, .7], cm: 15 },
    { id: cornerIds[1], a: [.4, .7], b: [.4, .82], cm: 15 },
  ]);
  c._activeWallChainId = 'corner-chain';
  c._activeWallChainPartitionIds = cornerIds;
  c._wallChainSegmentCms = [15, 15];
  c._finishWallChain();
  await settle();
  out.cornerKeepsBothRecords = partitionCount() - beforeCorner === 2;

  // A just-accepted extension already exists before Finish. It joins the
  // compatible saved run it touches; unrelated partitions remain untouched.
  const beforeTouch = partitionCount();
  const extensionId = 'extension-wall';
  await seedAcceptedPartitions([...(space().partitions || []), { id: extensionId, a: [.56, .5], b: [.7, .5], cm: 15 }]);
  c._activeWallChainId = 'extension-chain';
  c._activeWallChainPartitionIds = [extensionId];
  c._wallChainSegmentCms = [15];
  c._path = [[560, 500], [700, 500]];
  out.clickPersistsOrdinaryWall = partitionCount() === beforeTouch + 1
    && c._activeWallChainPartitionIds.length === 1;
  c._finishWallChain();
  await settle();
  out.finishMergesOnlyTheExtension = partitionCount() === beforeTouch;
  // Graph projection defines codepoint order, so merge preserves the first
  // canonical input identity rather than legacy array insertion order.
  const [retainedId, removedId] = [extensionId, straightIds[0]].sort();
  const removed = (space().partitions || []).find((p) => p.id === removedId);
  const joined = (space().partitions || []).find((p) => p.id === retainedId);
  out.extensionJoinedExistingRun = !removed && !!joined
    && Math.abs(joined.a[0] * 1000 - 200) < 0.01
    && Math.abs(joined.b[0] * 1000 - 700) < 0.01;
  out.sessionCleared = !c._activeWallChainId
    && c._activeWallChainPartitionIds.length === 0 && c._path.length === 0;


  return out;
});
checkAll(res);
await finish(browser, res);
