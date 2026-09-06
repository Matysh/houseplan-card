/** Issue #313/#478: Thickness serves canonical room masonry and partitions. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 800 }, 1);

const out = await page.evaluate(async () => {
  const NORM_W = 1000;
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const roomPoly = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]];
  card._serverCfg = {
    spaces: [{
      id: 'wt', title: 'WT', cell_cm: 5, view_box: [0, 0, 1, 0.8],
      rooms: [{ id: 'room', name: 'Room', area: null, poly: roomPoly }],
      walls: roomPoly.map((a, index) => ({
        key: '', a, b: roomPoly[(index + 1) % roomPoly.length], cm: 15,
      })),
      partitions: [
        { id: 'standalone', a: [0.6, 0.2], b: [0.9, 0.2], cm: 20 },
        { id: 'former-draft-a', a: [0.6, 0.5], b: [0.9, 0.5], cm: 12 },
        { id: 'former-draft-b', a: [0.9, 0.5], b: [0.9, 0.7], cm: 0 },
      ],
      openings: [], wall_columns: [],
    }],
    markers: [], settings: {},
  };
  card._layout = {}; card._space = 'wt'; card._modelCache = null; card._frame = null;
  card._cfgEpoch++; card._setMode('plan'); card._tool = 'wallthick'; await update();

  const result = {};
  const sp = () => card._serverCfg.spaces[0];
  const hit = (x, y) => card._wallThickHit([x * NORM_W, y * NORM_W]);

  const partitionHit = hit(0.75, 0.2);
  result.partitionHit = partitionHit?.source?.kind === 'partition' && partitionHit.cm === 20;
  card._wallThickClick([0.75 * NORM_W, 0.2 * NORM_W]); await update();
  result.dialogOpen = !!card._wallDialog && card._wallDialog.source.kind === 'partition';
  const dlg = card.renderRoot.querySelector('.wallthick-dlg');
  result.noRoomButton = !!dlg && !dlg.textContent.includes(card._t('wallthick.apply_room'));
  card._wallDialog = { ...card._wallDialog, value: '35' };
  card._wallThickApply(false); await update();
  result.partitionWritten = sp().partitions.find((item) => item.id === 'standalone')?.cm === 35;

  const formerDraftHit = hit(0.75, 0.5);
  result.migratedWallIsOrdinaryPartition = formerDraftHit?.source?.kind === 'partition'
    && formerDraftHit?.source?.id === 'former-draft-a' && formerDraftHit.cm === 12;

  const zeroHit = hit(0.9, 0.6);
  result.zeroSegmentSurvives = zeroHit?.source?.kind === 'partition' && zeroHit.cm === 0;
  card._wallThickClick([0.9 * NORM_W, 0.6 * NORM_W]); await update();
  result.zeroSegmentFieldShowsZero = card._wallDialog?.value === '0';
  result.zeroSegmentNotCorrupted = sp().partitions.find((item) => item.id === 'former-draft-b')?.cm === 0;
  card._wallDialog = null;

  sp().partitions.push({ id: 'overlay', a: [0.1, 0.1], b: [0.5, 0.1], cm: 30 });
  card._cfgEpoch++; card._modelCache = null;
  const overlapHit = hit(0.3, 0.1);
  result.overlapPrefersIndependent = overlapHit?.source?.kind === 'partition'
    && overlapHit?.source?.id === 'overlay' && overlapHit.cm === 30;
  card._cursorPt = [0.3 * NORM_W, 0.1 * NORM_W];
  result.hoverPresent = !!card._wallThickHover?.d;
  return result;
});

checkAll(out);
await finish(browser);
