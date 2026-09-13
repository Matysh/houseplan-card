// Браузерная половина геометрического корпуса #560.
//
// Числовые оракулы корпуса живут в test/geometry-corpus.test.mjs и карточку не
// поднимают. Здесь проверяется ровно то, что без карточки проверить нельзя:
//
//   1. штатный writer ресайза — перенос ЗАПИСЕЙ ТОЛЩИНЫ вслед за сдвинутым
//      ребром делает хост (`project()` в ResizeController), а не resize.ts;
//   2. хвост цепочки «→ View»: план корпуса действительно рисуется, и важные
//      участки (комнаты, проём, штриховка стен) присутствуют при DPR 1 и 2.
//
// Рендер здесь НЕ эталон: сравниваются не пиксели, а присутствие и число узлов
// плюс сохранность модели после жеста. Приёмка #560 прямо запрещает принимать
// текущий рендер за единственный источник истины.
import { readFileSync } from 'node:fs';
import { launch, check, finish } from './serve.mjs';

const corpus = (name) => JSON.parse(readFileSync(
  new URL(`../test/fixtures/560-corpus/${name}.json`, import.meta.url), 'utf8',
));

const { page, browser } = await launch();

/** Положить план корпуса в карточку как готовую модель v10. */
const loadCorpus = async (config) => {
  await page.evaluate((incoming) => {
    const card = window.__card;
    const space = incoming.spaces[0];
    card._serverCfg.model_version = incoming.model_version;
    const target = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
    for (const key of ['rooms', 'walls', 'wall_segments', 'openings', 'partitions']) {
      if (space[key]) target[key] = structuredClone(space[key]);
      else delete target[key];
    }
    target.cell_cm = space.cell_cm;
    for (const key of ['decor', 'wall_columns', 'room_drafts', 'open_spans']) delete target[key];
    card._geometryHistory.clear();
    card._resize.reset();
    card._cfgEpoch++;
    card.requestUpdate();
    return card.updateComplete;
  }, config);
  await page.waitForTimeout(60);
};

const enter = async (tool) => {
  await page.evaluate((next) => {
    const card = window.__card;
    if (!card._markup) card._setMode('plan');
    card._tool = next;
    card._resize.reset();
    card.requestUpdate();
    return card.updateComplete;
  }, tool);
  await page.waitForTimeout(40);
};

const settle = () => page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

const rendered = () => page.evaluate(() => {
  const card = window.__card;
  const root = card.renderRoot;
  const svg = root.querySelector('.stage svg');
  const rooms = [...root.querySelectorAll('[data-hp="room"]')];
  const box = svg?.viewBox?.baseVal;
  // Каждая комната обязана попадать в кадр: уехавшая за viewBox геометрия
  // «нарисована» и невидима одновременно — ровно тот случай, когда скриншот
  // зелёный, а пользователь видит пустой план.
  const inside = rooms.every((node) => {
    const bbox = node.getBBox();
    return box ? bbox.x + bbox.width > box.x - 1 && bbox.x < box.x + box.width + 1
      && bbox.y + bbox.height > box.y - 1 && bbox.y < box.y + box.height + 1 : false;
  });
  return {
    rooms: rooms.length,
    roomsInsideViewBox: inside,
    openings: root.querySelectorAll('[data-hp="opening"],[data-hp="opening-tunnel"]').length,
    wallFills: root.querySelectorAll('.wallfill,.wallhatch,[data-hp="wall"]').length,
    strokeWidths: [...new Set(rooms.map((node) => getComputedStyle(node).strokeWidth))].length,
  };
});

const thicknessMultiset = () => page.evaluate(() => {
  const card = window.__card;
  const space = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
  return (space.walls || []).map((wall) => wall.cm).sort((a, b) => a - b).join(',');
});

const roomPolys = () => page.evaluate(() => {
  const card = window.__card;
  const space = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
  return JSON.stringify(space.rooms.map((room) => [room.id, room.poly]));
});

const pointer = (type, planX, planY, { cx, cy, pointerId = 91 } = {}) =>
  page.evaluate((args) => {
    const card = window.__card;
    const stage = card.renderRoot.querySelector('.stage');
    const svg = stage.querySelector('svg');
    const point = new DOMPoint(args.planX, args.planY).matrixTransform(svg.getScreenCTM());
    const handles = [...card.renderRoot.querySelectorAll('.rszhandle')];
    const target = args.cx == null
      ? handles.find((handle) => handle.getAttribute('aria-disabled') === 'false')
      : handles.find((handle) => Math.abs(Number(handle.getAttribute('cx')) - args.cx) < 1
        && Math.abs(Number(handle.getAttribute('cy')) - args.cy) < 1);
    target?.dispatchEvent(new PointerEvent(args.type, {
      bubbles: true, cancelable: true, pointerId: args.pointerId,
      clientX: point.x, clientY: point.y, pointerType: 'mouse',
      buttons: args.type === 'pointerup' ? 0 : 1,
    }));
    return { sent: !!target, handle: target ? [Number(target.getAttribute('cx')), Number(target.getAttribute('cy'))] : null };
  }, { type, planX, planY, cx, cy, pointerId });

// --- 1. T-узел с тремя толщинами: рисуется и переживает штатный ресайз -------
await loadCorpus(corpus('c2-t-junction-thicknesses'));
await enter('plan');
await settle();
const c2view = await rendered();
check('corpus.c2.rooms_rendered', c2view.rooms, 3);
check('corpus.c2.rooms_inside_viewbox', c2view.roomsInsideViewBox, true);
check('corpus.c2.wall_fills_present', c2view.wallFills > 0, true);
const c2thickness = await thicknessMultiset();
// Ожидание берётся из самой фикстуры, а не вписывается числом: вписанное число
// разошлось бы с корпусом молча, и проверка стала бы декорацией.
const c2fixture = corpus('c2-t-junction-thicknesses').spaces[0].walls
  .map((wall) => wall.cm).sort((a, b) => a - b).join(',');
check('corpus.c2.thickness_multiset', c2thickness, c2fixture);
check('corpus.c2.thickness_variety', new Set(c2fixture.split(',')).size >= 3, true);

await enter('resize');
await settle();
const handles = await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('.rszhandle')]
  .filter((handle) => handle.getAttribute('aria-disabled') === 'false').length);
check('corpus.c2.enabled_handles', handles > 0, true);
const target = await page.evaluate(() => {
  const handle = [...window.__card.renderRoot.querySelectorAll('.rszhandle')]
    .find((candidate) => candidate.getAttribute('aria-disabled') === 'false');
  return handle ? [Number(handle.getAttribute('cx')), Number(handle.getAttribute('cy'))] : null;
});
const down = await pointer('pointerdown', target[0], target[1], { cx: target[0], cy: target[1] });
check('corpus.c2.resize_down_sent', down.sent, true);
check('corpus.c2.resize_dragging', await page.evaluate(() => window.__card._resize.dragging), true);
const step = 1000 / 240;                       // один шаг решётки в единицах плана
await pointer('pointermove', target[0] + step, target[1], { cx: target[0], cy: target[1] });
await settle();
await pointer('pointerup', target[0] + step, target[1], { cx: target[0], cy: target[1] });
await settle();
await page.waitForTimeout(80);
const c2after = await thicknessMultiset();
// Главный оракул браузерной половины: набор толщин после штатного ресайза тот
// же. Именно эту сохранность контроллер ресайза проверяет сам
// (checkWallRecordsPreserved с exactMultiplicity) и откатывает жест иначе.
check('corpus.c2.thickness_survives_resize', c2after, c2thickness);
const c2rendered = await rendered();
check('corpus.c2.rooms_after_resize', c2rendered.rooms, 3);
check('corpus.c2.inside_viewbox_after_resize', c2rendered.roomsInsideViewBox, true);

// --- 2. Проём у вершины: рисуется и переживает перечитывание -----------------
await loadCorpus(corpus('c4-opening-at-vertex'));
await enter('plan');
await settle();
const c4view = await rendered();
check('corpus.c4.rooms_rendered', c4view.rooms, 2);
check('corpus.c4.opening_rendered', c4view.openings > 0, true);
check('corpus.c4.rooms_inside_viewbox', c4view.roomsInsideViewBox, true);
const c4before = await roomPolys();

// save → reload: тот же конфиг приходит заново, как после перезагрузки вкладки.
await page.evaluate(() => {
  const card = window.__card;
  card._serverCfg = structuredClone(card._serverCfg);
  card._cfgEpoch++;
  card.requestUpdate();
  return card.updateComplete;
});
await settle();
check('corpus.c4.geometry_survives_reload', await roomPolys(), c4before);
const c4reloaded = await rendered();
check('corpus.c4.rooms_after_reload', c4reloaded.rooms, 2);
check('corpus.c4.opening_after_reload', c4reloaded.openings > 0, true);

await finish(browser, { c2view, c2thickness, c2after, c4view, c4reloaded });
