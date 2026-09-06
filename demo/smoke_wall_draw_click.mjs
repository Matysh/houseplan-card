/** #461 rejection rollback and history on the production-bundle fast path. */
import { launch, checkAll, finish } from './serve.mjs';
import { installWallDrawClickHarness, resetWallDrawClickHarness } from './wall-draw-click-harness.mjs';

const { page, browser } = await launch({ width: 1100, height: 850 }, 1);
await installWallDrawClickHarness(page);
await resetWallDrawClickHarness(page, false);
const result = await page.evaluate(async () => {
  const card = window.__card;
  const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
  const click = (xCells, yCells) => {
    const point = [xCells / 240 * 1000, yCells / 240 * 1000];
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    card._markupClick(new MouseEvent('click', {
      clientX: rect.left + ((point[0] - view.x) / view.w) * rect.width,
      clientY: rect.top + ((point[1] - view.y) / view.h) * rect.height,
      bubbles: true,
    }));
  };
  const savedPartitions = () => card._curSpaceCfg.partitions.filter(
    (item) => item.id.startsWith('saved-partition-'),
  ).length;

  click(152, 144);
  const chainIdBeforeReject = card._activeWallChainId;
  const beforeReject = JSON.stringify(card._serverCfg);
  click(154, 144); // 10 cm: rejected by the existing 20 cm junction rule.
  const rejected = {
    restored: JSON.stringify(card._serverCfg) === beforeReject,
    sessionRestored: card._path.length === 1 && card._activeWallChainId === chainIdBeforeReject
      && card._activeWallChainPartitionIds.length === 0,
    noHistory: card._geometryHistory.size === 0,
    noWrite: window.__wallDrawMetrics.configWrites === 0,
    existingPartitionsIntact: savedPartitions() === 8,
    namesRule: String(card._toast).includes('20'),
  };

  click(152, 144); click(176, 144); click(176, 168);
  const completeIds = [...card._activeWallChainPartitionIds];
  card._undoPoint(); await card.updateComplete;
  const undoneIds = [...card._activeWallChainPartitionIds];
  const undonePathLength = card._path.length;
  card._redoGeometry(); await card.updateComplete;
  const redoneIds = [...card._activeWallChainPartitionIds];
  return {
    rejectedStateRestored: rejected.restored,
    rejectedSessionRestored: rejected.sessionRestored,
    rejectedAddsNoHistory: rejected.noHistory,
    rejectedQueuesNoWrite: rejected.noWrite,
    rejectedPreservesOldPartitions: rejected.existingPartitionsIntact,
    rejectedToastNamesRule: rejected.namesRule,
    undoRemovesOnlyLastPoint: undoneIds.length === completeIds.length - 1
      && undonePathLength === undoneIds.length + 1,
    redoRestoresStableIds: JSON.stringify(redoneIds) === JSON.stringify(completeIds),
  };
});

checkAll(result);
await finish(browser, result);
