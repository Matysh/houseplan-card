/**
 * #277 supersedes the permissive #253 resize path. A room edge that covers
 * only part of a neighbouring contour is an unequal/partial shared wall and
 * must now be disabled. Activating its handle must not split the thickness
 * record, move an opening, create history, or change persisted geometry.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sp = () => c._serverCfg.spaces.find((space) => space.id === c._space);
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  const close = (got, want) => Number.isFinite(got) && Math.abs(got - want) < 1e-7;
  const hasWall = (walls, a, b, cm = 33) => (walls || []).some((wall) =>
    wall.cm === cm && close(wall.a?.[0], a[0]) && close(wall.a?.[1], a[1])
      && close(wall.b?.[0], b[0]) && close(wall.b?.[1], b[1]));

  const left = 0.070833333;
  const join = 0.204166667;
  const right = 0.420833333;
  const oldY = 0.4375;
  sp().rooms = [
    {
      id: 'sauna', name: 'Sauna',
      poly: [[left, oldY], [join, oldY], [join, 0.645833333], [left, 0.645833333]],
    },
    {
      id: 'north', name: 'North',
      poly: [[left, 0.2], [right, 0.2], [right, oldY], [left, oldY]],
    },
  ];
  sp().walls = [{
    key: '0.245833,0.437500@0.0000', cm: 33,
    a: [left, oldY], b: [right, oldY],
  }];
  sp().openings = [{
    id: 'sauna-door', type: 'door', x: 0.13, y: oldY, angle: 0, length: 0.05,
  }];
  delete sp().open_spans;
  const before = JSON.stringify({
    rooms: sp().rooms, walls: sp().walls, openings: sp().openings,
  });
  const historyBefore = c._geometryHistory?.length || 0;

  c._setMode('plan');
  c._tool = 'resize';
  await upd();
  await settleMode();

  const stage = () => sr().querySelector('.stage');
  const toScreen = (x, y) => {
    const rect = stage().getBoundingClientRect();
    const view = c._viewOr(c._baseVb());
    return {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
    };
  };
  const pointer = (type, target, x, y) => {
    const { clientX, clientY } = toScreen(x, y);
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true,
      pointerId: 253, clientX, clientY, button: 0, isPrimary: true,
    }));
  };
  const targetX = (left + join) * 500;
  const targetY = oldY * 1000;
  const handle = [...sr().querySelectorAll('.rszhandle:not(.rszcorner)')].find((entry) =>
    Math.abs(+entry.getAttribute('cx') - targetX) < 0.2
      && Math.abs(+entry.getAttribute('cy') - targetY) < 0.2);
  out.resizeHandleFound = !!handle;

  if (handle) {
    const x = +handle.getAttribute('cx');
    const y = +handle.getAttribute('cy');
    out.partialSharedDisabled = handle.getAttribute('aria-disabled') === 'true';
    out.disabledReasonExposed = !!handle.getAttribute('aria-label')
      && !!handle.querySelector('title')?.textContent;
    pointer('pointerdown', handle, x, y);
    pointer('pointermove', handle, x, y + c._gridPitch);
    pointer('pointerup', handle, x, y + c._gridPitch);
    await c.updateComplete;
    out.noDragStarted = !c._rszDrag && !c._rszPreview;
    out.noHistoryCreated = (c._geometryHistory?.length || 0) === historyBefore;
    out.sourceUnchanged = JSON.stringify({
      rooms: sp().rooms, walls: sp().walls, openings: sp().openings,
    }) === before;
  }
  return out;
});

checkAll(res);
await finish(browser, res);
