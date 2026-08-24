// #238: placement-preview dimensions point at physical inner faces. The smoke
// drives the production card in Plan mode and inspects both SVG construction
// lines and HTML labels; snap/click remain owned by the existing candidate.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.renderRoot;
  const space = () => card._serverCfg.spaces.find((item) => item.id === 'f1');
  const frame = () => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => {
    card.requestUpdate();
    await card.updateComplete;
    const started = performance.now();
    while (card._modeTransitionBusy && performance.now() - started < 1800) await frame();
    card.requestUpdate();
    await card.updateComplete;
    await frame();
  };
  const fixtureWallKey = (a, b) => {
    const pitch = 1 / 240;
    const quantize = (value) => Math.round(value / pitch) * pitch;
    const mx = quantize((a[0] + b[0]) / 2);
    const my = quantize((a[1] + b[1]) / 2);
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-12) { dx = 1; dy = 0; } else { dx /= length; dy /= length; }
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    const bucket = Math.round(angle * 1800) / 1800;
    return `${mx.toFixed(4)},${my.toFixed(4)}@${bucket.toFixed(4)}`;
  };
  const wall = (_id, a, b, cm) => ({ key: fixtureWallKey(a, b), a, b, cm });
  const roomWalls = (room, values = [20, 20, 20, 20]) => room.poly.map((a, index) =>
    wall(`${room.id}-${index}`, a, room.poly[(index + 1) % room.poly.length], values[index]));
  const snapshot = () => ({
    labels: [...root().querySelectorAll('.measurelabel.opdimension')].map((element) => ({
      text: element.textContent.trim(),
      source: element.getAttribute('data-dimension-source'),
      room: element.getAttribute('data-dimension-room'),
    })),
    groups: root().querySelectorAll('.opening-dimension').length,
    lines: root().querySelectorAll('.opening-dimension-line').length,
    ticks: root().querySelectorAll('.opening-dimension-tick').length,
    inert: root().querySelector('.opening-dimensions')?.getAttribute('pointer-events') === 'none'
      && root().querySelector('.opening-dimensions')?.getAttribute('aria-hidden') === 'true',
    geometry: card._opMeasureView?.labels.map((label) => label.dimension && ({
      distance: label.dimension.distance,
      from: label.dimension.from,
      to: label.dimension.to,
      roomId: label.dimension.roomId || null,
      source: label.dimension.source,
    })).filter(Boolean) || [],
  });
  const activate = async (point) => {
    card._setMode('plan');
    // Entering Plan owns an asynchronous editor-chrome transition which may
    // clear transient hover state at completion. Arm the placement tool only
    // after that transition settles so slower CI runners exercise the same
    // state sequence as a user and as fast local runs.
    await settle();
    card._activateOpeningPlacement('door');
    card._cursorPt = point;
    await settle();
    return snapshot();
  };

  // One room: axis 400u, opening 75u, adjacent 20 cm walls = half-depth
  // 8.333u. Each inner shoulder is 154.167u = 185 cm = 1.85 m.
  {
    const room = { id: 'single', name: 'Single', poly: [
      [0.1, 0.2], [0.5, 0.2], [0.5, 0.5], [0.1, 0.5],
    ] };
    const sp = space();
    sp.cell_cm = 5;
    sp.rooms = [room];
    sp.walls = roomWalls(room);
    sp.partitions = [];
    sp.openings = [];
    delete sp.open_spans;
    card._cfgEpoch++;
    const first = await activate([300, 200]);
    const staticContext = card._openingDimensionContextCache?.value;
    out.singleTwoLines = first.groups === 2 && first.lines === 2 && first.ticks === 4;
    out.singleLabels = first.labels.length === 2
      && first.labels.every((label) => label.text === '1.85 m'
        && label.source === 'room-face' && label.room === 'single');
    out.singleGeometry = first.geometry.length === 2
      && first.geometry.every((item) => Math.abs(item.distance - 154.1666666667) < 1e-5)
      && first.geometry.every((item) => Math.abs(item.from[1] - 208.3333333333) < 1e-5)
      && first.inert;

    card._cursorPt = [350, 200];
    await settle();
    const moved = snapshot();
    out.contextReused = card._openingDimensionContextCache?.value === staticContext;
    out.liveUpdate = moved.labels.map((item) => item.text).sort().join('|') === '1.25 m|2.45 m'
      && moved.geometry.some((item) => Math.abs(item.distance - 104.1666666667) < 1e-5)
      && moved.geometry.some((item) => Math.abs(item.distance - 204.1666666667) < 1e-5);

    // Center magnet is still the existing axial guide and Shift cannot opt out.
    card._cursorPt = [300.2, 200];
    await settle();
    const preview = root().querySelector('.opening-preview');
    const translate = /translate\(\s*([-+\d.eE]+)/.exec(preview?.getAttribute('transform') || '');
    out.centerMagnet = root().querySelectorAll('.opcentertick').length === 1
      && Math.abs(Number(translate?.[1]) - 300) < 1e-6;

    // Click consumes the same candidate and clears every transient guide.
    const expected = card._openingHoverCandidate;
    card._openingClick([300.2, 200]);
    await settle();
    out.clickKeepsCandidate = !!expected && !!card._openingDialog
      && Math.abs(card._openingDialog.x - expected.x) < 1e-6
      && Math.abs(card._openingDialog.y - expected.y) < 1e-6
      && root().querySelectorAll('.opening-dimension').length === 0
      && root().querySelectorAll('.measurelabel.opdimension').length === 0;
    card._openingDialog = null;
  }

  // Shared wall: room A has 20 cm adjacent walls; B has 40/60 cm at its two
  // ends. Four physical values are resolved and rendered on opposite faces.
  {
    const a = { id: 'a', name: 'A', poly: [
      [0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5],
    ] };
    const b = { id: 'b', name: 'B', poly: [
      [0.5, 0.1], [0.9, 0.1], [0.9, 0.5], [0.5, 0.5],
    ] };
    const sp = space();
    sp.rooms = [a, b];
    sp.walls = [...roomWalls(a), ...roomWalls(b, [40, 20, 60, 20])];
    sp.partitions = [];
    sp.openings = [];
    card._cfgEpoch++;
    const shared = await activate([500, 300]);
    out.sharedFourLines = shared.groups === 4 && shared.lines === 4 && shared.ticks === 8;
    out.sharedRoomOrder = shared.labels.map((item) => item.room).join('|') === 'a|b|a|b';
    out.sharedIndependentValues = shared.labels.map((item) => item.text).join('|')
      === '1.85 m|1.65 m|1.85 m|1.75 m';
    const roomYs = new Map(shared.geometry.map((item) => [
      `${item.roomId}:${item.distance.toFixed(3)}`, item.from[0],
    ]));
    out.sharedOppositeFaces = [...roomYs.keys()].some((key) => key.startsWith('a:'))
      && [...roomYs.keys()].some((key) => key.startsWith('b:'))
      && shared.geometry.some((item) => item.roomId === 'a' && item.from[0] < 500)
      && shared.geometry.some((item) => item.roomId === 'b' && item.from[0] > 500);
  }

  // Independent host: right T-wall centre is x=450, depth=40 cm = 33.333u,
  // so the physical near face is x=433.333 and the right value is 1.15 m.
  {
    const farRoom = { id: 'far', name: 'Far', poly: [
      [0.05, 0.05], [0.15, 0.05], [0.15, 0.15], [0.05, 0.15],
    ] };
    const sp = space();
    sp.rooms = [farRoom];
    sp.walls = roomWalls(farRoom);
    sp.partitions = [
      { id: 'host', a: [0.1, 0.7], b: [0.5, 0.7], cm: 20 },
      { id: 'cross', a: [0.45, 0.6], b: [0.45, 0.8], cm: 40 },
    ];
    sp.openings = [];
    card._cfgEpoch++;
    const independent = await activate([300, 700]);
    out.partitionTwoLines = independent.groups === 2 && independent.ticks === 4;
    out.partitionPhysicalAndFallback = independent.labels.map((item) => `${item.text}:${item.source}`).join('|')
      === '1.95 m:host-end|1.15 m:connected-face';
    out.partitionNearFace = independent.geometry.length === 2
      && Math.abs(independent.geometry[1].to[0] - 433.3333333333) < 1e-5;
  }

  card._cancelPath();
  await settle();
  out.cleanup = root().querySelectorAll('.opening-dimension,.measurelabel.opdimension').length === 0;
  return out;
});

checkAll(result);
await finish(browser, result);
