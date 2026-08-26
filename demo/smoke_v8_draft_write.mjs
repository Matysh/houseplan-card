/** #314: model-v8 draft identities survive writes/Undo; rejected writes fail closed. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const emptyConfig = () => ({
    model_version: 8,
    spaces: [{
      id: 'v8-draft', title: 'v8 draft', cell_cm: 5,
      view_box: [0, 0, 1, 0.7], rooms: [], wall_segments: [],
    }],
    markers: [], settings: {},
  });
  let server;
  let rev;
  let writes;
  let writeBehavior;

  const installWs = () => {
    const fallback = card.hass.callWS.bind(card.hass);
    card.hass = { ...card.hass, callWS: async (message) => {
      if (message.type === 'houseplan/config/set') {
        const candidate = clone(message.config);
        writes.push(candidate);
        if (writeBehavior) await writeBehavior(candidate, message);
        const missingDraftId = candidate.spaces.some((space) =>
          (space.room_drafts || []).some((draft) =>
            (draft.segments || []).some((segment) =>
              typeof segment.id !== 'string' || !segment.id)));
        if (missingDraftId) {
          const error = new Error('v8 draft wall segments require ids');
          error.code = 'invalid_format';
          throw error;
        }
        server = candidate;
        rev += 1;
        return { ok: true, rev };
      }
      if (message.type === 'houseplan/config/get') {
        return { config: clone(server), rev };
      }
      return fallback(message);
    } };
  };

  const reset = async () => {
    card._saveConfigDebounced.cancel();
    await card._writeChain.catch(() => undefined);
    server = emptyConfig();
    rev = 1;
    writes = [];
    writeBehavior = null;
    card._serverCfg = clone(server);
    card._cfgRev = rev;
    card._cfgContentFingerprint = '';
    card._pendingPhysicalWrites.clear();
    card._geometryHistory.clear();
    card._clearGeometryGesture();
    card._toast = '';
    card._space = 'v8-draft';
    card._layout = {};
    card._modelCache = null;
    card._wallUnionCache = null;
    card._physicalBodiesCache = null;
    card._frame = null;
    card._cfgEpoch += 1;
    card._drawWallField = '15';
    card._setMode('plan');
    card._tool = 'draw';
    await card.updateComplete;
  };

  const persistPath = async (points) => {
    card._path = points.map((point) => [...point]);
    card._draftSegmentCms = points.slice(1).map(() => 15);
    card._persistActiveDraftSegment();
    card._saveConfigDebounced.flush();
    await sleep(0);
  };

  const settleWrites = async () => {
    await card._writeChain.catch(() => undefined);
    await sleep(40);
    await card._writeChain.catch(() => undefined);
  };

  const clickPoint = async (x, y, extra = {}) => {
    const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    card._markupClick(new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true, ...extra,
    }));
    await card.updateComplete;
  };

  installWs();

  // Write-time sanitation must keep the segment corresponding to each
  // surviving edge, rather than positional-copying the skipped zero edge.
  await reset();
  card._serverCfg.spaces[0].room_drafts = [{
    id: 'draft-sanitize',
    points: [[0.1, 0.1], [0.1, 0.1], [0.3, 0.1], [0.3, 0.1], [0.3, 0.3]],
    segments: [
      { id: 'zero-a', cm: 11 }, { id: 'edge-a', cm: 21 },
      { id: 'zero-b', cm: 12 }, { id: 'edge-b', cm: 22 },
    ],
  }, {
    id: 'draft-intentional', points: [[0.6, 0.1], [0.7, 0.1]],
    segments: [{ id: 'draft-intentional-edge', cm: 18 }],
  }];
  card._serverCfg.spaces[0].partitions = [{
    id: 'partition-intentional', a: [0.6, 0.3], b: [0.7, 0.3], cm: 20,
  }];
  card._dropLegacySegments();
  const sanitized = card._serverCfg.spaces[0].room_drafts[0];
  out.sanitationKeepsCarrierIds = JSON.stringify(
    sanitized.segments.map((segment) => [segment.id, segment.cm]),
  ) === JSON.stringify([['edge-a', 21], ['edge-b', 22]]);
  out.sanitationPreservesExistingIndependentObjects =
    card._serverCfg.spaces[0].partitions?.[0]?.id === 'partition-intentional'
    && card._serverCfg.spaces[0].room_drafts?.[1]?.id === 'draft-intentional'
    && card._serverCfg.spaces[0].room_drafts[1].segments[0].id === 'draft-intentional-edge';

  // Successful physical writes carry model-v8 IDs all the way to the fake
  // backend, and Undo keeps the identity of every surviving edge.
  await reset();
  await persistPath([[100, 100], [300, 100], [300, 300]]);
  await settleWrites();
  const initialIds = server.spaces[0].room_drafts[0].segments.map((segment) => segment.id);
  card._undoPoint();
  card._saveConfigDebounced.flush();
  await settleWrites();
  const undone = server.spaces[0].room_drafts[0];
  out.successfulWriteHasStableIds = initialIds.length === 2
    && initialIds.every((id) => typeof id === 'string' && !!id)
    && undone.segments.length === 1 && undone.segments[0].id === initialIds[0];

  // Exercise the real Walls click/close/promote path, not only its persistence
  // primitive.  Every completed edge crosses fake config/set independently.
  await reset();
  await clickPoint(100, 100);
  for (const point of [[300, 100], [300, 300], [100, 300], [100, 100]]) {
    await clickPoint(point[0], point[1]);
    card._saveConfigDebounced.flush();
    await settleWrites();
  }
  const openedRoomDialog = !!card._roomDialog;
  card._nameSel = 'Persisted room';
  card._saveRoom();
  card._saveConfigDebounced.flush();
  await settleWrites();
  await card._reloadConfigOnly(true);
  const savedSpace = card._serverCfg.spaces[0];
  out.roomCloseOpensDialog = openedRoomDialog;
  out.roomSurvivesCloseAndReload = savedSpace.rooms.some((room) => room.name === 'Persisted room');
  out.roomCloseLeavesNoDebris = !savedSpace.room_drafts?.length && !savedSpace.partitions?.length;
  out.roomCloseHasOnlySuccessToast = card._toast
    === card._t('toast.wall_rooms_saved', { n: 1 });

  // Two edits made while F1 is in flight are serialized.  If F1 succeeds, F2
  // retains both accepted edges and their identities.
  await reset();
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  let writeNumber = 0;
  writeBehavior = async () => {
    writeNumber += 1;
    if (writeNumber === 1) await firstGate;
  };
  await persistPath([[100, 100], [300, 100]]);
  await sleep(20);
  await persistPath([[100, 100], [300, 100], [300, 300]]);
  await sleep(20);
  out.successQueueIsSerialized = writes.length === 1;
  releaseFirst();
  await settleWrites();
  const queuedDraft = server.spaces[0].room_drafts[0];
  out.successQueueRetainsF2 = writes.length === 2
    && queuedDraft.segments.length === 2
    && queuedDraft.segments.every((segment) => typeof segment.id === 'string' && !!segment.id);

  // A rejected F1 invalidates the whole optimistic transaction, including F2
  // authored on the same unaccepted baseline.  The plan is safe before the
  // best-effort config/get finishes and cannot later create a ghost partition.
  await reset();
  let rejectFirst;
  const rejectGate = new Promise((resolve) => { rejectFirst = resolve; });
  writeNumber = 0;
  writeBehavior = async () => {
    writeNumber += 1;
    if (writeNumber === 1) {
      await rejectGate;
      const error = new Error('server rejected draft');
      error.code = 'invalid_format';
      throw error;
    }
  };
  await persistPath([[100, 100], [300, 100]]);
  await sleep(20);
  await persistPath([[100, 100], [300, 100], [300, 300]]);
  await sleep(20);
  rejectFirst();
  await sleep(20);
  out.rejectionRollsBackSynchronously = !card._serverCfg.spaces[0].room_drafts?.length
    && card._path.length === 0
    && card._pendingPhysicalWrites.size === 0
    && !card._geometryHistory.undoName && !card._geometryHistory.redoName;
  await settleWrites();
  card._finishWallChain();
  out.rejectionCannotCreateGhostPartition = !card._serverCfg.spaces[0].room_drafts?.length
    && !card._serverCfg.spaces[0].partitions?.length
    && !server.spaces[0].room_drafts?.length
    && !server.spaces[0].partitions?.length;

  return out;
});

await finish(browser, checkAll(result));
