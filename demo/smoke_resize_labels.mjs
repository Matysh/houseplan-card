// #300: the production Resize gesture renders two side-wall measurements,
// matching highlights and one area badge per owner beside the moving wall.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();

const result = await page.evaluate(async () => {
  const card = window.__card;
  const out = {};
  const update = async () => {
    card._cfgEpoch++;
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const rectRoom = (id, x0, y0, x1, y1) => ({
    id, name: id, area: null,
    poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
      .map(([x, y]) => [x / 1000, y / 1000]),
  });

  card._setMode('plan');
  card._tool = 'resize';
  const space = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
  space.rooms = [
    rectRoom('label-left', 200, 100, 300, 500),
    rectRoom('label-right', 300, 100, 400, 500),
  ];
  space.openings = [];
  delete space.walls;
  delete space.open_spans;
  delete space.partitions;
  delete space.room_drafts;
  delete space.wall_columns;
  card._resize.reset();
  await update();

  const handle = [...card.renderRoot.querySelectorAll('.rszhandle')]
    .find((node) => Math.abs(Number(node.getAttribute('cx')) - 300) < 1
      && Math.abs(Number(node.getAttribute('cy')) - 300) < 1
      && node.getAttribute('aria-disabled') === 'false');
  const stage = card.renderRoot.querySelector('.stage');
  const stageRect = stage.getBoundingClientRect();
  const svg = stage.querySelector('svg');
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
  const screen = (x, y) => [
    stageRect.left + ((x - vx) / vw) * stageRect.width,
    stageRect.top + ((y - vy) / vh) * stageRect.height,
  ];
  const [sx, sy] = screen(300, 300);
  const [tx] = screen(325, 300);
  const dispatch = (type, x, y) => handle?.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 300, pointerType: 'mouse',
    clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1,
  }));
  dispatch('pointerdown', sx, sy);
  dispatch('pointermove', tx, sy);
  await update();

  const live = card._resize?.liveLabels || [];
  const lengths = live.filter((label) => label.kind === 'length');
  const areas = live.filter((label) => label.kind === 'area');
  out.dragStarted = card._resize?.dragging === true;
  out.twoLengths = lengths.length === 2;
  out.movingWallLengthAbsent = lengths.every((label) =>
    Math.abs(label.edge.a[0] - label.edge.b[0]) > 1);
  out.twoMeasuredEdges = card.renderRoot.querySelectorAll(
    '[data-hp="resize-measured-edge"]',
  ).length === 2;
  out.twoAreas = card.renderRoot.querySelectorAll('[data-hp="resize-area-label"]').length === 2;
  out.twoLeaders = card.renderRoot.querySelectorAll('[data-hp="resize-area-leader"]').length === 2;
  out.oppositeSides = new Set(areas.map((label) => label.placement.side)).size === 2;
  out.gearVisible = card.renderRoot.querySelectorAll('[data-hp="room-settings"]').length === 2;
  const areaRects = [...card.renderRoot.querySelectorAll('[data-hp="resize-area-label"]')]
    .map((label) => label.getBoundingClientRect());
  out.areasDoNotOverlap = areaRects.length === 2 && (
    areaRects[0].right <= areaRects[1].left || areaRects[0].left >= areaRects[1].right
      || areaRects[0].bottom <= areaRects[1].top || areaRects[0].top >= areaRects[1].bottom
  );
  out.gearAvoided = areas.every((area) => {
    const label = card.renderRoot.querySelector(
      `[data-hp="resize-area-label"][data-room="${area.roomId}"]`,
    );
    const gear = card.renderRoot.querySelector(
      `[data-hp="room-settings"][data-room="${area.roomId}"]`,
    );
    if (!label || !gear) return false;
    const a = label.getBoundingClientRect();
    const b = gear.getBoundingClientRect();
    return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
  });
  out.tangentAvoidanceUsed = areas.some((label) => Math.abs(label.placement.tangentOffsetPx) > 0);

  dispatch('pointerup', tx, sy);
  await update();
  out.cleanedAfterCommit = card._resize?.liveLabels === null
    && card.renderRoot.querySelectorAll('[data-hp^="resize-"]').length === 0;

  // Repeat the actual browser gesture at a non-default zoom. The footprint is
  // recomputed from current view.w/iconCqw rather than reusing the first frame.
  space.rooms = [
    rectRoom('label-left', 200, 100, 300, 500),
    rectRoom('label-right', 300, 100, 400, 500),
  ];
  card._resize.reset();
  card._zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 2);
  await update();
  const zoomHandle = [...card.renderRoot.querySelectorAll('.rszhandle')]
    .find((node) => Math.abs(Number(node.getAttribute('cx')) - 300) < 1
      && Math.abs(Number(node.getAttribute('cy')) - 300) < 1
      && node.getAttribute('aria-disabled') === 'false');
  const zoomStageRect = stage.getBoundingClientRect();
  const zoomSvg = stage.querySelector('svg');
  const [zvx, zvy, zvw, zvh] = zoomSvg.getAttribute('viewBox').split(' ').map(Number);
  const zoomScreen = (x, y) => [
    zoomStageRect.left + ((x - zvx) / zvw) * zoomStageRect.width,
    zoomStageRect.top + ((y - zvy) / zvh) * zoomStageRect.height,
  ];
  const [zsx, zsy] = zoomScreen(300, 300);
  const [ztx] = zoomScreen(325, 300);
  const zoomDispatch = (type, x, y) => zoomHandle?.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 301, pointerType: 'mouse',
    clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1,
  }));
  zoomDispatch('pointerdown', zsx, zsy);
  zoomDispatch('pointermove', ztx, zsy);
  await update();
  const zoomAreas = [...card.renderRoot.querySelectorAll('[data-hp="resize-area-label"]')];
  out.nonDefaultZoomActive = card._zoom > 1 && zoomAreas.length === 2;
  out.gearAvoidedAtNonDefaultZoom = zoomAreas.every((label) => {
    const gear = card.renderRoot.querySelector(
      `[data-hp="room-settings"][data-room="${label.getAttribute('data-room')}"]`,
    );
    if (!gear) return false;
    const a = label.getBoundingClientRect();
    const b = gear.getBoundingClientRect();
    return a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom;
  });
  zoomDispatch('pointercancel', ztx, zsy);
  await update();
  out.cleanedAfterZoomCancel = card._resize?.liveLabels === null;
  return out;
});

checkAll(result);
await finish(browser);
