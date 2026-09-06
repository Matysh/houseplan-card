/** #477 production-bundle wall finish and room-reference transaction smoke. */
import { launch, checkAll, finish } from './serve.mjs';
import {
  installWallDrawClickHarness, resetWallDrawClickHarness, runWallDrawFinishProfile,
} from './wall-draw-click-harness.mjs';

const { page, browser } = await launch({ width: 1100, height: 850 }, 1);
await installWallDrawClickHarness(page);
await resetWallDrawClickHarness(page, false);
const chain = await runWallDrawFinishProfile(page);

const chainHistory = await page.evaluate(async (chainIds) => {
  const card = window.__card;
  const optimizeNoop = () => {
    card._previewAlignDialog(false);
    const changed = card._alignDialog?.changed;
    card._alignDialog = null;
    return changed === false;
  };
  card._undoGeometry();
  await card.updateComplete;
  const afterUndo = {
    optimizeNoop: optimizeNoop(),
    partitions: (card._curSpaceCfg.partitions || [])
      .filter((partition) => chainIds.includes(partition.id)).length,
  };
  card._redoGeometry();
  await card.updateComplete;
  const afterRedo = {
    optimizeNoop: optimizeNoop(),
    partitions: (card._curSpaceCfg.partitions || [])
      .filter((partition) => chainIds.includes(partition.id)).length,
  };
  return { afterUndo, afterRedo };
}, chain.chainIds);

await resetWallDrawClickHarness(page, false);
const references = await page.evaluate(async () => {
  const card = window.__card;
  card._serverCfg.markers = [
    { id: 'direct', binding: 'virtual', space: 'edited', room_id: 'base-0', future: { keep: 1 } },
    { id: 'vacuum-cross-space', binding: 'virtual', space: 'other-1', vacuum: {
      segment_map: { 1: 'base-0', 2: 'base-1' }, future: { keep: 2 },
    } },
  ];
  const state = () => ({
    room: card._curSpaceCfg.rooms.some((room) => room.id === 'base-0'),
    direct: card._serverCfg.markers[0].room_id,
    segments: { ...(card._serverCfg.markers[1].vacuum?.segment_map || {}) },
    directFuture: card._serverCfg.markers[0].future.keep,
    vacuumFuture: card._serverCfg.markers[1].vacuum.future.keep,
  });
  card._roomDeleteDialog = { roomId: 'base-0', name: 'base-0' };
  card._confirmRoomDelete(false);
  await card.updateComplete;
  const deleted = state();
  card._undoGeometry();
  await card.updateComplete;
  const undone = state();
  card._redoGeometry();
  await card.updateComplete;
  const redone = state();
  return { deleted, undone, redone };
});

const result = {
  finishedChainMerged: chain.chainIds.length === 3 && chain.surviving.length === 1,
  finishedChainOptimizeNoop: chain.optimizeChanged === false,
  finishUsesOneBoundedCheck: chain.terminal.fullSpacePhysicalChecks === 0
    && chain.terminal.localPhysicalChecks === 1,
  finishAddsNoHistory: chain.terminal.history === 0,
  finishedChainUndoOptimizeNoop: chainHistory.afterUndo.optimizeNoop,
  finishedChainUndoHasOnePartition: chainHistory.afterUndo.partitions === 1,
  finishedChainRedoOptimizeNoop: chainHistory.afterRedo.optimizeNoop,
  finishedChainRedoHasOnePartition: chainHistory.afterRedo.partitions === 1,
  deleteClearsExactReferences: references.deleted.room === false
    && references.deleted.direct === undefined
    && references.deleted.segments[1] === undefined
    && references.deleted.segments[2] === 'base-1',
  undoRestoresGeometryAndReferences: references.undone.room === true
    && references.undone.direct === 'base-0'
    && references.undone.segments[1] === 'base-0'
    && references.undone.segments[2] === 'base-1',
  redoReappliesGeometryAndReferences: references.redone.room === false
    && references.redone.direct === undefined
    && references.redone.segments[1] === undefined
    && references.redone.segments[2] === 'base-1',
  unrelatedMarkerFieldsSurvive: [references.deleted, references.undone, references.redone]
    .every((state) => state.directFuture === 1 && state.vacuumFuture === 2),
};

checkAll(result);
await finish(browser, result);
