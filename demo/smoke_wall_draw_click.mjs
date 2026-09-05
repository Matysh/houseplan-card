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
  const savedDrafts = () => card._curSpaceCfg.room_drafts.filter(
    (item) => item.id.startsWith('saved-draft-'),
  ).length;

  click(152, 144);
  const beforeReject = JSON.stringify(card._serverCfg);
  click(154, 144); // 10 cm: rejected by the existing 20 cm junction rule.
  const rejected = {
    restored: JSON.stringify(card._serverCfg) === beforeReject,
    noGesture: card._path.length === 0 && !card._activeDraftId,
    noHistory: card._geometryHistory.size === 0,
    noWrite: window.__wallDrawMetrics.configWrites === 0,
    existingDraftsIntact: savedDrafts() === 4,
    namesRule: String(card._toast).includes('20'),
  };

  click(152, 144); click(176, 144); click(176, 168);
  const active = card._activeDraftId;
  const complete = card._curSpaceCfg.room_drafts.find((item) => item.id === active);
  const completeIds = complete.segments.map((item) => item.id);
  card._undoGeometry(); await card.updateComplete;
  const undone = card._curSpaceCfg.room_drafts.find((item) => item.id === active);
  card._redoGeometry(); await card.updateComplete;
  const redone = card._curSpaceCfg.room_drafts.find((item) => item.id === active);
  return {
    rejectedStateRestored: rejected.restored,
    rejectedGestureCleared: rejected.noGesture,
    rejectedAddsNoHistory: rejected.noHistory,
    rejectedQueuesNoWrite: rejected.noWrite,
    rejectedPreservesOldDrafts: rejected.existingDraftsIntact,
    rejectedToastNamesRule: rejected.namesRule,
    undoRemovesOnlyLastPoint: undone?.points?.length === 2 && undone?.segments?.length === 1,
    redoRestoresStableIds: JSON.stringify(redone?.segments?.map((item) => item.id))
      === JSON.stringify(completeIds),
  };
});

checkAll(result);
await finish(browser, result);
