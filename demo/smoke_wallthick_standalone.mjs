/**
 * Issue #313: the Thickness tool serves independent masonry — standalone
 * partitions and saved-draft segments — not only room contours. Independent
 * masonry wins an exact overlap (the #308 duplicate), and zero thickness is
 * refused for it until #306 gives zero a meaning.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 800 }, 1);

const out = await page.evaluate(async () => {
  const NORM_W = 1000;
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  card._serverCfg = { spaces: [{ id: 'wt', title: 'WT', cell_cm: 5, view_box: [0, 0, 1, 0.8],
    rooms: [{ id: 'room', name: 'Room', area: null,
      poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]] }],
    partitions: [
      { id: 'standalone', a: [0.6, 0.2], b: [0.9, 0.2], cm: 20 },
      // exact duplicate over the room's top edge — the #308 layout
      { id: 'overlay', a: [0.1, 0.1], b: [0.5, 0.1], cm: 30 },
    ],
    room_drafts: [{ id: 'saved-draft', points: [[0.6, 0.5], [0.9, 0.5], [0.9, 0.7]],
      segments: [{ cm: 12 }, { cm: 0 }] }],
  }], markers: [], settings: {} };
  card._layout = {}; card._space = 'wt'; card._modelCache = null; card._frame = null;
  card._cfgEpoch++; card._setMode('plan'); card._tool = 'wallthick'; await update();

  const result = {};
  // 1) standalone partition: hit, dialog, write, undo
  const partitionHit = card._wallThickHit([0.75 * NORM_W, 0.2 * NORM_W]);
  result.partitionHit = partitionHit?.source?.kind === 'partition' && partitionHit.cm === 20;
  card._wallThickClick([0.75 * NORM_W, 0.2 * NORM_W]); await update();
  result.dialogOpen = !!card._wallDialog && card._wallDialog.source.kind === 'partition';
  const dlg = card.renderRoot.querySelector('.wallthick-dlg');
  result.noRoomButton = !!dlg && !dlg.textContent.includes(card._t('wallthick.apply_room'));
  card._wallDialog = { ...card._wallDialog, value: '35' };
  card._wallThickApply(false); await update();
  const sp = () => card._serverCfg.spaces[0];
  result.partitionWritten = sp().partitions[0].cm === 35;
  // Undo (server history is async-free here: geometry history object)
  // 2) zero refused for independent masonry
  card._wallThickClick([0.75 * NORM_W, 0.2 * NORM_W]); await update();
  card._wallDialog = { ...card._wallDialog, value: '' };
  card._wallThickApply(false); await update();
  // the refusal keeps both the value and the dialog (range toast shown)
  result.zeroRefused = sp().partitions[0].cm === 35 && !!card._wallDialog;
  card._wallDialog = null; await update();
  // 3) saved draft segment
  const draftHit = card._wallThickHit([0.75 * NORM_W, 0.5 * NORM_W]);
  result.draftHit = draftHit?.source?.kind === 'draft' && draftHit.cm === 12;
  card._wallThickClick([0.75 * NORM_W, 0.5 * NORM_W]); await update();
  card._wallDialog = { ...card._wallDialog, value: '18' };
  card._wallThickApply(false); await update();
  result.draftWritten = sp().room_drafts[0].segments[0].cm === 18;
  // CODE-REVIEW-313-r1 High: a STORED zero must surface as zero (empty field),
  // and Apply without editing must refuse — never silently turn 0 into 15.
  const zeroSegHit = card._wallThickHit([0.9 * NORM_W, 0.6 * NORM_W]);
  result.zeroSegmentSurvives = zeroSegHit?.source?.kind === 'draft' && zeroSegHit.cm === 0;
  card._wallThickClick([0.9 * NORM_W, 0.6 * NORM_W]); await update();
  result.zeroSegmentFieldEmpty = card._wallDialog?.value === '';
  card._wallThickApply(false); await update();
  result.zeroSegmentNotCorrupted = sp().room_drafts[0].segments[1].cm === 0;
  card._wallDialog = null; await update();
  // 4) #308 overlap: the independent wall owns the hit
  const overlapHit = card._wallThickHit([0.3 * NORM_W, 0.1 * NORM_W]);
  result.overlapPrefersIndependent = overlapHit?.source?.kind === 'partition'
    && overlapHit?.source?.id === 'overlay' && overlapHit.cm === 30;
  // 5) plain room wall still resolves to the room interval
  const roomHit = card._wallThickHit([0.3 * NORM_W, 0.4 * NORM_W]);
  result.roomWallStillWorks = roomHit?.source?.kind === 'room' && roomHit.roomId === 'room';
  // 6) hover strip follows the partition thickness
  card._cursorPt = [0.75 * NORM_W, 0.2 * NORM_W];
  const hover = card._wallThickHover;
  result.hoverPresent = !!hover && hover.d.length > 0;
  return result;
});

checkAll(out);
await finish(browser);
