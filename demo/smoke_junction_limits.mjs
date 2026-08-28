/**
 * Issue #329: the owner's junction limits refuse the WRITE, each surface
 * through its own channel (spec §2), and a legacy plan that already violates
 * them still accepts unrelated edits (spec §3).
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 900 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const toasts = [];
  card._showToast = (text) => { toasts.push(String(text)); };
  const CELL = 5;
  // NORM_W units per centimetre for a 5 cm grid cell.
  const cm = (value) => (value / CELL) * (1000 / 240);

  const reset = async () => {
    card._serverCfg = { spaces: [{
      id: 'limits', title: 'Limits', cell_cm: CELL, view_box: [0, 0, 1, 1],
      rooms: [], openings: [], room_drafts: [], partitions: [], wall_columns: [],
    }], markers: [], settings: {} };
    card._space = 'limits'; card._layout = {};
    card._cfgEpoch++; card._modelCache = null; card._frame = null;
    card._path = []; card._activeDraftId = null;
    card._nameSel = ''; card._areaSel = '';
    card._setMode('plan'); card._tool = 'draw'; card._drawWallField = '15';
    await update();
    toasts.length = 0;
  };
  const drawRoom = async (points, name) => {
    card._path = [...points, points[0]];
    card._nameSel = name; card._areaSel = '';
    card._commitRoom();
    await update();
    return (card._spaceModel().rooms || []).some((room) => room.name === name);
  };
  const wedge = (degrees, originX = 400, originY = 600) => {
    const radians = (degrees * Math.PI) / 180;
    const reach = cm(400);
    return [
      [originX, originY],
      [originX + reach, originY],
      [originX + reach * Math.cos(radians), originY - reach * Math.sin(radians)],
    ];
  };

  // AC1: 14° отклоняется и называет правило; 16° проходит.
  await reset();
  result.angle14Refused = !(await drawRoom(wedge(14), 'narrow14'));
  result.angle14NamesRule = toasts.some((text) => text.includes('15'));
  await reset();
  result.angle16Accepted = await drawRoom(wedge(16), 'wide16');

  // AC3: сегмент 19 см отклоняется, 20 см проходит.
  await reset();
  result.short19Refused = !(await drawRoom([
    [400, 600], [400 + cm(19), 600], [400 + cm(19), 600 - cm(300)],
    [400, 600 - cm(300)],
  ], 'short19'));
  result.short19NamesRule = toasts.some((text) => text.includes('20'));
  await reset();
  result.side20Accepted = await drawRoom([
    [400, 600], [400 + cm(300), 600], [400 + cm(300), 600 - cm(300)],
    [400, 600 - cm(300)],
  ], 'square300');

  // AC5a: «шпиль» фикстуры issue (≈9.9°) не нарисовать заново.
  await reset();
  result.spikeRefused = !(await drawRoom(wedge(9.9), 'spike'));
  result.spikeNamesRule = toasts.some((text) => text.includes('15'));

  // AC7b: «Толщина» отказывает через тост с названием правила: 100 см на
  // стенах комнаты 100x100 съедает весь просвет (П5).
  await reset();
  await drawRoom([
    [400, 600], [400 + cm(100), 600], [400 + cm(100), 600 - cm(100)],
    [400, 600 - cm(100)],
  ], 'forThickness');
  toasts.length = 0;
  const room = (card._curSpaceCfg.rooms || []).find((item) => item.name === 'forThickness');
  // Диалог «Толщины» открывается по реальной записи стены — так же, как из UI.
  const wall = (card._curSpaceCfg.walls || [])[0];
  card._tool = 'wallthick';
  card._wallDialog = {
    a: wall.a, b: wall.b, value: '100', roomId: room.id,
    source: { kind: 'room' }, sx: 50, sy: 50,
  };
  card._wallThickApply(true);
  await update();
  const catalogue = (card._curSpaceCfg.wall_segments || []).map((item) => item.cm);
  const legacy = (card._curSpaceCfg.walls || []).map((item) => item.cm);
  result.thicknessRefusedByLimit = ![...catalogue, ...legacy].includes(100);
  result.thicknessToastShown = toasts.some((text) => text.includes('25'));

  // §3: унаследованное нарушение не блокирует несвязанную запись.
  card._serverCfg = { spaces: [{
    id: 'limits', title: 'Limits', cell_cm: CELL, view_box: [0, 0, 1, 1],
    rooms: [{ id: 'legacy', name: 'legacy', area: null, poly: [
      [0.30, 0.70], [0.3167, 0.24], [0.36, 0.68],
    ] }],
    walls: [
      { key: 'l0', a: [0.30, 0.70], b: [0.3167, 0.24], cm: 15 },
      { key: 'l1', a: [0.3167, 0.24], b: [0.36, 0.68], cm: 15 },
      { key: 'l2', a: [0.36, 0.68], b: [0.30, 0.70], cm: 15 },
    ],
    openings: [], room_drafts: [], partitions: [], wall_columns: [],
  }], markers: [], settings: {} };
  card._cfgEpoch++; card._modelCache = null; card._frame = null;
  card._path = []; card._tool = 'draw'; await update();
  toasts.length = 0;
  result.legacyKeepsAcceptingEdits = await drawRoom([
    [700, 700], [700 + cm(300), 700], [700 + cm(300), 700 - cm(300)],
    [700, 700 - cm(300)],
  ], 'unrelated');

  return result;
});

// AC7a (канал Resize): стена упирается в последнюю ДОПУСТИМУЮ позицию, а не
// проезжает нарушение. Сетка 2 см: две комнаты в 10 см друг от друга, тяга
// на 6 см вправо оставила бы 4 см между чужими узлами (П4 — минимум 5 см).
// Жест настоящий: pointer по ручке, без вызовов внутренних методов Resize.
const settle = () => page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

await page.evaluate(async () => {
  const card = window.__card;
  window.__toasts = [];
  card._showToast = (text) => { window.__toasts.push(String(text)); };
  const cm = (value) => (value / 2) * (1000 / 240);
  card._serverCfg = { spaces: [{
    id: 'limits', title: 'Limits', cell_cm: 2, view_box: [0, 0, 1, 1],
    rooms: [], openings: [], room_drafts: [], partitions: [], wall_columns: [],
  }], markers: [], settings: {} };
  card._space = 'limits'; card._layout = {};
  card._cfgEpoch++; card._modelCache = null; card._frame = null;
  card._setMode('plan'); card._tool = 'draw'; card._drawWallField = '15';
  card.requestUpdate(); await card.updateComplete;
  const draw = (points, name) => {
    card._path = [...points, points[0]];
    card._nameSel = name; card._areaSel = '';
    card._commitRoom();
    card._path = [];
  };
  draw([[200, 700], [200 + cm(200), 700], [200 + cm(200), 700 - cm(200)],
    [200, 700 - cm(200)]], 'A');
  draw([[200 + cm(210), 700], [200 + cm(400), 700],
    [200 + cm(400), 700 - cm(200)], [200 + cm(210), 700 - cm(200)]], 'B');
  card._tool = 'resize';
  card.requestUpdate(); await card.updateComplete;
  window.__toasts.length = 0;
});
await settle();
await page.waitForTimeout(700);
await page.evaluate(() => { window.__toasts.length = 0; });

// Просвет между правой гранью A и левой гранью B, в сантиметрах.
const gapCm = () => page.evaluate(() => {
  const rooms = window.__card._curSpaceCfg.rooms;
  const a = Math.max(...rooms.find((room) => room.name === 'A').poly.map((p) => p[0]));
  const b = Math.min(...rooms.find((room) => room.name === 'B').poly.map((p) => p[0]));
  return Math.round(((b - a) * 1000) / (1000 / 240) * 2);
});
const handle = await page.evaluate(() => {
  const card = window.__card;
  const handles = [...card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')];
  const rooms = card._curSpaceCfg.rooms;
  const aRight = Math.max(...rooms.find((room) => room.name === 'A').poly.map((p) => p[0])) * 1000;
  const found = handles.find((entry) => Math.abs(Number(entry.getAttribute('cx')) - aRight) < 1.5);
  if (!found) return null;
  const svg = found.ownerSVGElement;
  const map = (x, y) => {
    const point = svg.createSVGPoint();
    point.x = x; point.y = y;
    const mapped = point.matrixTransform(found.getScreenCTM());
    return [mapped.x, mapped.y];
  };
  const cx = Number(found.getAttribute('cx'));
  const cy = Number(found.getAttribute('cy'));
  return { start: map(cx, cy), end: map(cx + (6 / 2) * (1000 / 240), cy) };
});

// #330 AC4 (код-ревью r2-M1: общий счётчик не различал кэш — 11 против 12
// вызовов тонули в шуме). Считаем ОТДЕЛЬНО вычисления baseline: вызовы
// _junctionLimitViolations с документом === _serverCfg. С кэшем их ровно
// один на жест; без кэша — по одному на каждый pointermove.
await page.evaluate(() => {
  const card = window.__card;
  window.__jlBaselineCalls = 0;
  const original = card._junctionLimitViolations.bind(card);
  card._junctionLimitViolations = (...args) => {
    if (args[0] === card._serverCfg) window.__jlBaselineCalls += 1;
    return original(...args);
  };
});

const resize = { resizeHandleFound: !!handle, resizeGapBefore: await gapCm() };
if (handle) {
  await page.mouse.move(...handle.start);
  await page.mouse.down();
  await page.mouse.move(...handle.end, { steps: 10 });
  await settle();
  await page.mouse.up();
  await settle();
  await page.waitForTimeout(700);
  const toasts = await page.evaluate(() => window.__toasts.slice());
  // 6 см дало бы 4 см — отказ; стена стоит на 6 см, последней допустимой.
  resize.resizeStoppedAtLastAllowed = await gapCm();
  resize.resizeRefusalNamesRule = toasts.some((text) => text.includes('5'));
  resize.resizeRefusalOnce = toasts.length;
  const baselineCalls = await page.evaluate(() => window.__jlBaselineCalls);
  // Ровно одно вычисление baseline на жест: второй и дальнейшие move обязаны
  // попадать в кэш (#330 §4.4). Без кэша здесь было бы ~10 — порог различает
  // рабочий кэш от отключённого без права на шум.
  resize.resizeBaselineComputedOncePerGesture = baselineCalls === 1;

  // Обратная сторона (r2-M1): кэш обязан ЧЕСТНО инвалидироваться. Первый
  // жест закоммитил план — геометрия baseline изменилась, и второй жест
  // обязан пересчитать его ровно один раз. Вечный кэш оставил бы счётчик на
  // 1, отключённый — унёс к ~20; ожидание строго 2 различает все три мира.
  const second = await page.evaluate(() => {
    const card = window.__card;
    const handles = [...card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')];
    const rooms = card._curSpaceCfg.rooms;
    const aRight = Math.max(...rooms.find((room) => room.name === 'A').poly.map((p) => p[0])) * 1000;
    const found = handles.find((entry) => Math.abs(Number(entry.getAttribute('cx')) - aRight) < 1.5);
    if (!found) return null;
    const svg = found.ownerSVGElement;
    const map = (x, y) => {
      const point = svg.createSVGPoint();
      point.x = x; point.y = y;
      const mapped = point.matrixTransform(found.getScreenCTM());
      return [mapped.x, mapped.y];
    };
    const cx = Number(found.getAttribute('cx'));
    const cy = Number(found.getAttribute('cy'));
    // Один шаг назад: законное движение, границы П4 не задевает.
    return { start: map(cx, cy), end: map(cx - (2 / 2) * (1000 / 240), cy) };
  });
  resize.resizeSecondHandleFound = !!second;
  if (second) {
    await page.mouse.move(...second.start);
    await page.mouse.down();
    await page.mouse.move(...second.end, { steps: 6 });
    await settle();
    await page.mouse.up();
    await settle();
    await page.waitForTimeout(700);
    const afterSecond = await page.evaluate(() => window.__jlBaselineCalls);
    resize.resizeBaselineRecomputedAfterCommit = afterSecond === 2;
  }
}

checkAll({ ...out, ...resize }, {
  resizeGapBefore: 10,
  resizeStoppedAtLastAllowed: 6,
  resizeRefusalOnce: 1,
});
await finish(browser);
