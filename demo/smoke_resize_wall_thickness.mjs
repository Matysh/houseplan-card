/**
 * #253: a thickness record may be longer than the room edge being resized.
 * The real pointer handlers must split that record, move only the covered
 * interval, keep its centimetres live and committed, move its opening, and
 * restore the exact source geometry with one Undo.
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
  const newY = 0.4625;
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
    pointer('pointerdown', handle, x, y);
    pointer('pointermove', handle, x, newY * 1000);
    await c.updateComplete;

    const liveWalls = c._curSpaceCfg?.walls || [];
    out.liveKeepsBothIntervals = liveWalls.length === 2
      && hasWall(liveWalls, [left, newY], [join, newY])
      && hasWall(liveWalls, [join, oldY], [right, oldY]);
    out.liveOpeningMoves = close(c._curSpaceCfg?.openings?.[0]?.y, newY);
    out.liveThicknessVisible = c._intervalCm(
      [left * 1000, newY * 1000, join * 1000, newY * 1000],
    ) === 33;

    pointer('pointerup', handle, x, newY * 1000);
    await upd();
    const committed = sp().walls || [];
    out.commitKeepsBothIntervals = committed.length === 2
      && hasWall(committed, [left, newY], [join, newY])
      && hasWall(committed, [join, oldY], [right, oldY]);
    out.commitOpeningMoves = close(sp().openings?.[0]?.y, newY);

    c._undoGeometry();
    await upd();
    out.undoRestoresExactSource = JSON.stringify({
      rooms: sp().rooms, walls: sp().walls, openings: sp().openings,
    }) === before;
  }
  return out;
});

checkAll(res);
await finish(browser, res);
