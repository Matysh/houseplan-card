/** #314: model-v8 draft identities survive writes/Undo; rejected writes fail closed. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeV8DraftRegressionFixture } from './fixtures/v8-draft-regression.mjs';
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 });
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const denseFixture = makeV8DraftRegressionFixture();

const result = await page.evaluate(async (denseFixture) => {
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

  const reset = async (initialConfig = emptyConfig()) => {
    card._saveConfigDebounced.cancel();
    await card._writeChain.catch(() => undefined);
    server = clone(initialConfig);
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
    card._space = server.spaces[0].id;
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

  // AC8: repeat the real click/close/reload path on an anonymised fixture with
  // the same population shape as the owner's report.  Existing independent
  // geometry and the one known unusable draft must survive byte-for-byte.
  await reset(denseFixture);
  const invariantBefore = clone(server);
  const originalPartitionIds = server.spaces[0].partitions.map((item) => item.id);
  const originalDraft = JSON.stringify(server.spaces[0].room_drafts[0]);
  for (const point of [[800, 100], [900, 100], [900, 200], [800, 200], [800, 100]]) {
    await clickPoint(point[0], point[1]);
    card._saveConfigDebounced.flush();
    await settleWrites();
  }
  card._nameSel = 'Invariant room';
  card._saveRoom();
  card._saveConfigDebounced.flush();
  await settleWrites();
  await card._reloadConfigOnly(true);
  const denseAfter = card._serverCfg.spaces[0];
  out.denseFixtureHasOwnerReportShape = invariantBefore.spaces[0].rooms.length === 13
    && invariantBefore.spaces[0].wall_segments.length === 44
    && originalPartitionIds.length === 24
    && invariantBefore.spaces[0].room_drafts.length === 1;
  out.denseFixtureRoomSurvivesReload = denseAfter.rooms.length === 14
    && denseAfter.rooms.some((room) => room.name === 'Invariant room');
  out.denseFixturePreservesIndependentGeometry = JSON.stringify(
    denseAfter.partitions.map((item) => item.id),
  ) === JSON.stringify(originalPartitionIds)
    && denseAfter.room_drafts.length === 1
    && JSON.stringify(denseAfter.room_drafts[0]) === originalDraft;

  return { checks: out, invariantBefore, invariantAfter: clone(card._serverCfg) };
}, denseFixture);

const runInvariants = (config, label) => {
  const dir = mkdtempSync(join(tmpdir(), `houseplan-314-${label}-`));
  const path = join(dir, 'config.json');
  try {
    writeFileSync(path, JSON.stringify(config));
    const run = spawnSync('npm', [
      'run', 'invariants', '--', '--config', path, '--json',
    ], { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' });
    const stdout = run.stdout || '';
    const jsonStart = stdout.indexOf('{');
    if (jsonStart < 0) {
      throw new Error(`invariant CLI produced no JSON (status ${run.status}):\n`
        + `${stdout}\n${run.stderr || run.error || ''}`);
    }
    const parsed = JSON.parse(stdout.slice(jsonStart));
    return { status: run.status, violations: parsed.violations, notes: parsed.notes };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const before = runInvariants(result.invariantBefore, 'before');
const after = runInvariants(result.invariantAfter, 'after');
const signature = (run) => run.violations.map((item) => [
  item.invariant, item.kind, item.owner,
]);
result.checks.denseFixtureKnownDebtIsExplicit = before.status === 1
  && before.violations.length === 1
  && before.violations[0].kind === 'unusable_draft'
  && before.violations[0].owner.endsWith(':draft-314-known-debt');
result.checks.denseFixtureAddsNoInvariantViolations = after.status === 1
  && JSON.stringify(signature(after)) === JSON.stringify(signature(before));

await finish(browser, checkAll(result.checks));
