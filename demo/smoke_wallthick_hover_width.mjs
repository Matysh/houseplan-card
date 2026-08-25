// #303: the Thickness-tool hover fill follows physical wall centimetres while
// its deliberately generous pointer hit radius remains unchanged.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 860 }, 1);
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const settle = async (structural = false) => {
    if (structural) {
      card._cfgEpoch++;
      card._modelCache = null;
      card._frame = null;
      card._wallUnionCache = null;
    }
    card.requestUpdate();
    await card.updateComplete;
    while (card._modeTransitionBusy) await frame();
    await frame();
  };
  const currentSpace = () => card._serverCfg.spaces.find((space) => space.id === card._space);
  const scanWidth = (path, y, fromX, toX, step = 0.01) => {
    if (!path?.isPointInFill) return NaN;
    let first = NaN;
    let last = NaN;
    for (let x = fromX; x <= toX; x += step) {
      if (!path.isPointInFill(new DOMPoint(x, y))) continue;
      if (!Number.isFinite(first)) first = x;
      last = x;
    }
    return Number.isFinite(first) && Number.isFinite(last) ? last - first + step : NaN;
  };
  const closeRelative = (actual, expected, tolerance = 0.02) =>
    Number.isFinite(actual) && Number.isFinite(expected) && expected > 0
      && Math.abs(actual - expected) / expected <= tolerance;

  const space = currentSpace();
  space.cell_cm = 30;
  space.settings = { ...(space.settings || {}), show_borders: true };
  delete space.walls;
  delete space.openings;
  delete space.open_spans;
  for (const room of space.rooms || []) delete room.open_to;

  card._setMode('plan');
  card._tool = 'wallthick';
  await settle(true);

  const wallAxis = [50, 250];
  card._wallThickClick(wallAxis);
  await settle();
  const dialogOpened = !!card._wallDialog;
  card._wallDialog = { ...card._wallDialog, value: '50' };
  card._wallThickApply(false);
  await settle(true);

  card._tool = 'wallthick';
  card._cursorPt = wallAxis;
  await settle();
  const body = root().querySelector('[data-hp="wall"]');
  const hover = root().querySelector('.wallthick-hover');
  const bodyWidth = scanWidth(body, wallAxis[1], 25, 75);
  const hoverWidth = scanWidth(hover, wallAxis[1], 25, 75);
  const expectedWidth = (50 / 30) * card._gridPitch;
  const axisHit = card._wallThickHit(wallAxis);
  const dx = axisHit ? axisHit.b[0] - axisHit.a[0] : 0;
  const dy = axisHit ? axisHit.b[1] - axisHit.a[1] : 0;
  const length = Math.hypot(dx, dy);
  const midpoint = axisHit
    ? [(axisHit.a[0] + axisHit.b[0]) / 2, (axisHit.a[1] + axisHit.b[1]) / 2]
    : wallAxis;
  const farHit = length > 0 && card._wallThickHit([
    midpoint[0] - (dy / length) * card._gridPitch * 5,
    midpoint[1] + (dx / length) * card._gridPitch * 5,
  ]);

  return {
    dialogOpened,
    bodyAndHoverRendered: !!body && !!hover,
    bodyIsPhysicalWidth: closeRelative(bodyWidth, expectedWidth),
    hoverMatchesWallWithinTwoPercent: closeRelative(hoverWidth, bodyWidth),
    generousHitAreaUnchanged: !!farHit,
  };
});

await finish(browser, checkAll(result));
