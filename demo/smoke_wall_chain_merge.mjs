// Issue #478 supersedes #229's deferred chain merge: every accepted click is
// immediately stored as one ordinary partition and finishing only clears the
// session state.
//
// The unit tests own the rules; this smoke owns the wiring — that finishing a
// chain in the real editor never rewrites already accepted wall records.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const settle = async () => {
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    await c.updateComplete;
  };
  const space = () => c._serverCfg.spaces.find((s) => s.id === c._space);
  const partitionCount = () => (space().partitions || []).length;

  c._mode = 'plan'; c.requestUpdate(); await settle();
  await new Promise((r) => setTimeout(r, 400));
  c._tool = 'draw'; c._drawWallCm = 15; c.requestUpdate(); await settle();

  const before = partitionCount();

  // Four clicks along one straight line, already persisted as three walls,
  // then finish the session.
  c._path = [[200, 500], [300, 500], [420, 500], [560, 500]];
  const straightIds = ['straight-a', 'straight-b', 'straight-c'];
  space().partitions = [...(space().partitions || []),
    { id: straightIds[0], a: [.2, .5], b: [.3, .5], cm: 15 },
    { id: straightIds[1], a: [.3, .5], b: [.42, .5], cm: 15 },
    { id: straightIds[2], a: [.42, .5], b: [.56, .5], cm: 15 }];
  c._activeWallChainId = 'straight-chain';
  c._activeWallChainPartitionIds = straightIds;
  c._wallChainSegmentCms = [15, 15, 15];
  out.chainHasThreeSegments = c._path.length - 1 === 3;
  c._finishWallChain();
  await settle();

  const straight = (space().partitions || []).slice(before);
  out.straightRunKeepsClickRecords = straight.length === 3
    && straight.map((item) => item.id).join(',') === straightIds.join(',');
  out.straightRunSpansTheChain = Math.abs(straight[0].a[0] * 1000 - 200) < 0.01
    && Math.abs(straight[2].b[0] * 1000 - 560) < 0.01;
  out.straightRunKeepsThickness = straight.every((item) => item.cm === 15);

  // A corner is not a straight run: two records, one node between them.
  const beforeCorner = partitionCount();
  c._path = [[200, 700], [400, 700], [400, 820]];
  const cornerIds = ['corner-a', 'corner-b'];
  space().partitions.push(
    { id: cornerIds[0], a: [.2, .7], b: [.4, .7], cm: 15 },
    { id: cornerIds[1], a: [.4, .7], b: [.4, .82], cm: 15 },
  );
  c._activeWallChainId = 'corner-chain';
  c._activeWallChainPartitionIds = cornerIds;
  c._wallChainSegmentCms = [15, 15];
  c._finishWallChain();
  await settle();
  out.cornerKeepsBothRecords = partitionCount() - beforeCorner === 2;

  // A just-accepted extension already exists before Finish. Finishing keeps
  // both records; collinear normalization is explicitly outside #478.
  const beforeTouch = partitionCount();
  const extensionId = 'extension-wall';
  space().partitions.push({ id: extensionId, a: [.56, .5], b: [.7, .5], cm: 15 });
  c._activeWallChainId = 'extension-chain';
  c._activeWallChainPartitionIds = [extensionId];
  c._wallChainSegmentCms = [15];
  c._path = [[560, 500], [700, 500]];
  out.clickPersistsOrdinaryWall = partitionCount() === beforeTouch + 1
    && c._activeWallChainPartitionIds.length === 1;
  c._finishWallChain();
  await settle();
  out.finishDoesNotRewriteWalls = partitionCount() === beforeTouch + 1;
  const extended = (space().partitions || []).find((p) => p.id === extensionId);
  out.extensionKeptOwnIdentity = !!extended;
  out.sessionCleared = !c._activeWallChainId
    && c._activeWallChainPartitionIds.length === 0 && c._path.length === 0;


  return out;
});
checkAll(res);
await finish(browser, res);
