// Browser contract for saved room drafts, independent partitions and columns.
// This deliberately exercises the card's editor transactions rather than
// injecting finished records: create, drag, edit and Delete must all pass
// through the same paths a pointer/keyboard gesture uses.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const PITCH = 1000 / 240;
  window.confirm = () => true;
  c._serverCfg = {
    spaces: [{ id: 'physical', title: 'Physical', cell_cm: 5,
      view_box: [0, 0, 1, 1], rooms: [] }],
    markers: [], settings: {},
  };
  c._space = 'physical';
  c._mode = 'plan';
  c._modelCache = null;
  // Keep the smoke local: editor transactions still mutate the real config,
  // invalidate derived models and history, but do not need a websocket write.
  c._saveConfig = () => { c._cfgEpoch++; c._modelCache = null; c.requestUpdate(); };
  await c.updateComplete;

  c._tool = 'partition';
  c._drawWallField = '15';
  c._partitionClick([100, 100], false);
  c._partitionClick([300, 100], false);
  let sp = c._serverCfg.spaces[0];
  o.partitionCreated = sp.partitions?.length === 1 && sp.partitions[0].cm === 15;

  c._tool = 'column';
  c._drawWallField = '30';
  c._columnClick([200, 200]);
  sp = c._serverCfg.spaces[0];
  o.columnCreatedSquare = sp.wall_columns?.length === 1
    && sp.wall_columns[0].shape === 'square' && sp.wall_columns[0].cm === 30;

  c._tool = 'draw';
  c._drawWallField = '12';
  c._path = [[100, 300], [200, 300]];
  c._activeDraftId = null;
  c._draftSegmentCms = [];
  c._persistActiveDraftSegment();
  sp = c._serverCfg.spaces[0];
  o.draftPersistedImmediately = sp.room_drafts?.length === 1
    && sp.room_drafts[0].segments[0].cm === 12;

  // Endpoint-to-endpoint join is one atomic record: the active id survives
  // and segment thickness follows geometric order.
  sp.room_drafts = [
    { id: 'join-a', points: [[0.1, 0.4], [0.3, 0.4]], segments: [{ cm: 10 }] },
    { id: 'join-b', points: [[0.3, 0.4], [0.5, 0.4]], segments: [{ cm: 20 }] },
  ];
  c._modelCache = null;
  c._activeDraftId = 'join-a';
  c._path = [[100, 400], [300, 400]];
  c._draftSegmentCms = [10];
  const join = c._draftEndAt([300, 400], 'join-a');
  if (join) c._mergeDraftEndpoint(join);
  sp = c._serverCfg.spaces[0];
  o.draftEndpointJoinIsAtomic = sp.room_drafts?.length === 1
    && sp.room_drafts[0].id === 'join-a'
    && JSON.stringify(sp.room_drafts[0].segments.map((segment) => segment.cm)) === '[10,20]';

  const part = c._spaceModel().partitions[0];
  c._physicalDrag = {
    pid: 71, kind: 'partition', id: part.id, start: [...part.a],
    startClient: [0, 0], before: c._geometrySnapshot(), moved: true,
    base: JSON.parse(JSON.stringify(part)), delta: [PITCH, PITCH],
  };
  c._physicalUp(new PointerEvent('pointerup', { pointerId: 71, bubbles: true }));
  sp = c._serverCfg.spaces[0];
  o.partitionDragIsRigidAndGridBound = Math.abs(sp.partitions[0].a[0] - (0.1 + PITCH / 1000)) < 1e-9
    && Math.abs((sp.partitions[0].b[0] - sp.partitions[0].a[0]) - 0.2) < 1e-9
    && Math.abs(sp.partitions[0].a[1] - sp.partitions[0].b[1]) < 1e-9;

  c._physicalSel = { kind: 'partition', id: sp.partitions[0].id };
  c._deletePhysicalSelection();
  o.deleteRemovesPartition = !c._serverCfg.spaces[0].partitions;

  const draftId = c._serverCfg.spaces[0].room_drafts[0].id;
  c._physicalSel = { kind: 'draft', id: draftId, segment: 0 };
  c._deletePhysicalSelection();
  o.deleteOnDraftRemovesWholeOutline = !c._serverCfg.spaces[0].room_drafts;

  c._tool = 'partition';
  c._drawWallField = '120';
  c._partitionClick([400, 100], false);
  c._partitionClick([500, 100], false);
  o.invalidThicknessCreatesNothing = !c._serverCfg.spaces[0].partitions;

  return o;
});

await finish(browser, checkAll(out));
