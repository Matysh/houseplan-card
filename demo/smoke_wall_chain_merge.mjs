// Issue #229: a straight wall drawn in several clicks is stored as one record.
//
// The unit tests own the rules; this smoke owns the wiring — that finishing a
// chain in the real editor actually calls the merge, that the seam disappears
// from the saved config, and that a chain drawn round a corner keeps its node.
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

  // Four clicks along one straight line, then finish the chain.
  c._path = [[200, 500], [300, 500], [420, 500], [560, 500]];
  c._draftSegmentCms = [];
  out.chainHasThreeSegments = c._path.length - 1 === 3;
  c._finishWallChain();
  await settle();

  const straight = (space().partitions || []).slice(before);
  out.straightRunIsOneRecord = straight.length === 1;
  out.straightRunSpansTheChain = !!straight[0]
    && Math.abs(straight[0].a[0] * 1000 - 200) < 0.01
    && Math.abs(straight[0].b[0] * 1000 - 560) < 0.01;
  out.straightRunKeepsThickness = !!straight[0] && straight[0].cm === 15;

  // A corner is not a straight run: two records, one node between them.
  const beforeCorner = partitionCount();
  c._path = [[200, 700], [400, 700], [400, 820]];
  c._draftSegmentCms = [];
  c._finishWallChain();
  await settle();
  out.cornerKeepsBothRecords = partitionCount() - beforeCorner === 2;

  // Drawing onto an existing wall merges with it — the seam belongs to the chain.
  const beforeTouch = partitionCount();
  c._path = [[560, 500], [700, 500]];
  c._draftSegmentCms = [];
  c._finishWallChain();
  await settle();
  out.chainMergesIntoTheWallItTouches = partitionCount() === beforeTouch;
  const extended = (space().partitions || []).find(
    (p) => Math.abs(p.a[1] * 1000 - 500) < 0.01 && Math.abs(p.b[1] * 1000 - 500) < 0.01,
  );
  out.touchedWallGrew = !!extended && Math.abs(extended.b[0] * 1000 - 700) < 0.01;

  return out;
});
checkAll(res);
await finish(browser, res);
