/** #314/#478: legacy drafts migrate once; current wall writes keep stable IDs. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const clone = (value) => structuredClone(value);
  const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  let server;
  let rev = 1;
  let writes = [];
  let rejectNext = false;
  const fallback = card.hass.callWS.bind(card.hass);
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      writes.push(clone(message.config));
      if (rejectNext) {
        rejectNext = false;
        const error = new Error('server rejected wall'); error.code = 'invalid_format';
        throw error;
      }
      server = clone(message.config); rev += 1;
      return { ok: true, rev };
    }
    if (message.type === 'houseplan/config/get') return { config: clone(server), rev };
    return fallback(message);
  } };
  const current = () => ({
    model_version: 10,
    spaces: [{
      id: 'wall-write', title: 'Wall write', cell_cm: 5, view_box: [0, 0, 1, 0.7],
      rooms: [], wall_segments: [], partitions: [], openings: [], wall_columns: [],
    }],
    markers: [], settings: {},
  });
  const reset = async (config = current()) => {
    card._saveConfigDebounced.cancel();
    await card._writeChain.catch(() => undefined);
    server = clone(config); rev = 1; writes = []; rejectNext = false;
    card._serverCfg = clone(config); card._cfgRev = rev; card._cfgContentFingerprint = '';
    card._pendingPhysicalWrites.clear(); card._geometryHistory.clear();
    card._space = config.spaces[0].id; card._layout = {}; card._cfgEpoch++;
    card._modelCache = null; card._frame = null; card._path = [];
    card._activeWallChainId = null; card._activeWallChainPartitionIds = [];
    card._wallChainSegmentCms = []; card._wallChainRedo = [];
    card._setMode('plan'); card._tool = 'draw'; card._drawWallField = '15';
    card.requestUpdate(); await card.updateComplete;
  };
  const settle = async () => {
    card._saveConfigDebounced.flush();
    await card._writeChain.catch(() => undefined); await sleep(40);
    await card._writeChain.catch(() => undefined);
  };
  const click = async (x, y) => {
    const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    card._markupClick(new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true,
    }));
    await card.updateComplete;
  };

  const legacy = {
    model_version: 9,
    spaces: [{
      id: 'legacy', title: 'Legacy', cell_cm: 5, view_box: [0, 0, 1, 0.7],
      rooms: [], wall_segments: [], partitions: [],
      room_drafts: [{
        id: 'draft', points: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3]],
        segments: [{ id: 'legacy-edge-a', cm: 21 }, { id: 'legacy-edge-b', cm: 22 }],
      }],
    }],
    markers: [], settings: {},
  };
  await reset(legacy);
  await click(500, 500); await click(700, 500); await settle();
  const migrated = card._serverCfg.spaces[0];
  out.legacyDraftMigratesOnce = card._serverCfg.model_version === 10
    && !('room_drafts' in migrated)
    && migrated.partitions.some((item) => item.id === 'legacy-edge-a' && item.cm === 21)
    && migrated.partitions.some((item) => item.id === 'legacy-edge-b' && item.cm === 22)
    && migrated.partitions.length === 3;
  const once = JSON.stringify(card._serverCfg);
  card._editorRuntimeOrThrow()._prepareConfigCandidate(card._serverCfg);
  out.currentMigrationIsIdempotent = JSON.stringify(card._serverCfg) === once;

  await reset();
  await click(100, 100); await click(300, 100); await settle();
  const firstId = server.spaces[0].partitions[0]?.id;
  out.firstAcceptedWallReachesBackend = typeof firstId === 'string' && !!firstId;
  await click(300, 300); await settle();
  out.secondWriteKeepsFirstIdentity = server.spaces[0].partitions.length === 2
    && server.spaces[0].partitions[0].id === firstId;
  card._undoPoint(); await settle();
  out.undoRemovesOnlyTerminalWall = server.spaces[0].partitions.length === 1
    && server.spaces[0].partitions[0].id === firstId;

  await reset();
  for (const point of [[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]) {
    await click(...point); await settle();
  }
  out.closeOffersRoomAfterPersistedTerminalWall = !!card._roomDialog
    && card._curSpaceCfg.partitions.length === 4;
  card._nameSel = 'Persisted room'; card._saveRoom(); await settle();
  await card._reloadConfigOnly(true);
  out.roomSurvivesReloadWithoutCarrierDebris = card._serverCfg.spaces[0].rooms
    .some((room) => room.name === 'Persisted room')
    && !card._serverCfg.spaces[0].partitions?.length
    && !('room_drafts' in card._serverCfg.spaces[0]);

  await reset();
  await click(100, 100); rejectNext = true; await click(300, 100); await settle();
  out.rejectedWriteRollsBackOptimisticWall = !card._serverCfg.spaces[0].partitions.length
    && card._path.length === 0 && card._activeWallChainPartitionIds.length === 0
    && card._pendingPhysicalWrites.size === 0;
  return out;
});

await finish(browser, checkAll(result));
