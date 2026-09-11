// Направляющие выравнивания — свидетель на НАСТОЯЩЕМ жесте (#521).
//
// Прежняя редакция этого смока была зелёной на сломанном коде и потому сама
// оказалась частью дефекта: она присваивала `_deviceDrag`/`_decorDraft`
// целиком и звала `requestUpdate()`. Присвоение с `oldValue == null`
// маршрутизацию живого пути не включает, поэтому проверялась обычная осевая
// отрисовка — состояние, которого при настоящем жесте не бывает. С #451 всё,
// что двигается пальцем, идёт в живого художника, а слой направляющих жил
// только в осевшей сцене; на пользователе это выглядело как «направляющих
// больше нет» в трёх редакторах сразу.
//
// Отсюда протокол каждого сценария:
//   1. дождаться тишины — сразу после входа в режим `_hdrH` сходится
//      ступеньками ~200 мс, и каждая ступенька даёт осевой кадр «в подарок»,
//      на котором сломанный код тоже показывает направляющую;
//   2. вести жест настоящими `PointerEvent`/`click` по элементу;
//   3. считать осевые циклы за движения — их обязано быть НОЛЬ, иначе смок
//      снова проверяет не тот путь;
//   4. требовать ровно одну группу `.alignguides`: осевая копия слоя на время
//      жеста подавлена, две линии (одна из них устаревшая) — дефект.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // Считается ВИДИМОЕ. Осевая копия слоя на время жеста гасится прозрачностью
  // и остаётся в DOM — если считать узлы, две направляющие подряд (живая и
  // осевая, отставшая на шаг) выглядят как одна.
  const visible = (selector) => [...sr().querySelectorAll(selector)].filter((node) => {
    const layer = node.closest('.hp-editor-only-layer');
    return !layer || layer.style.opacity !== '0';
  });
  const lines = () => visible('.alignline').length;
  const dots = () => visible('.aligndot').length;
  const groups = () => visible('.alignguides').length;
  /** Кто сейчас рисует видимую направляющую: живой художник или осевшая сцена. */
  const guideOwner = () => {
    const group = visible('.alignguides')[0];
    if (!group) return 'none';
    return group.closest('[data-hp-live-editor]') ? 'live' : 'settled';
  };
  const guideLineX = () => {
    const line = visible('.alignline')[0];
    return line ? Number(line.getAttribute('x1')) : NaN;
  };
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  /** Осевые кадры оседания редактора должны закончиться ДО жеста. */
  const quiet = async () => {
    for (let i = 0; i < 8; i++) await frame();
    await new Promise((resolve) => setTimeout(resolve, 350));
  };
  const pe = (type, id, extra) => new PointerEvent(type, {
    pointerId: id, isPrimary: true, bubbles: true, composed: true, cancelable: true, ...extra,
  });
  let settled = 0;
  const settledWillUpdate = c.willUpdate.bind(c);
  c.willUpdate = function (changed) { settled += 1; return settledWillUpdate(changed); };
  const g = c._gridPitch;
  const stage = () => c._stageEl || sr().querySelector('.stage');
  const toClient = (x, y) => {
    const rect = stage().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return {
      x: rect.left + ((x - v.x) / v.w) * rect.width,
      y: rect.top + ((y - v.y) / v.h) * rect.height,
    };
  };
  const pxPerUnit = () => {
    const rect = stage().getBoundingClientRect();
    return rect.width / c._viewOr(c._baseVb()).w;
  };

  // ---- 1) редактор устройств: настоящее перетаскивание значка -------------
  c._setMode('devices');
  await c.updateComplete;
  const devs = c._devices.filter((d) => d.space === c._space && !d.virtual
    && d.bindingStatus?.kind !== 'ha_disabled');
  const anchor = devs[0];
  const dragged = devs[1];
  // Обе позиции — на узлах сетки, иначе выравнивание жестом недостижимо.
  // Цель ведёт значок и по X (на ось якоря), и по Y — тогда конец
  // направляющей отличает живую точку от замороженного снимка.
  c._layout = {
    ...c._layout,
    [anchor.id]: { s: c._space, x: (53 * g) / 1000, y: (53 * g) / 1000 },
    [dragged.id]: { s: c._space, x: (61 * g) / 1000, y: (69 * g) / 1000 },
  };
  c.requestUpdate();
  await c.updateComplete;
  const anchorPos = c._pos(anchor);
  const marker = [...sr().querySelectorAll('[data-hp="device"]')]
    .find((element) => element.dataset.id === dragged.id);
  out.markerIsOnTheStage = !!marker;
  const live = () => c._livePos(c._devices.find((d) => d.id === dragged.id));
  await quiet();
  const box = marker.getBoundingClientRect();
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  marker.dispatchEvent(pe('pointerdown', 77, { clientX: sx, clientY: sy }));
  await c.updateComplete;
  out.pointerDownStartsTheDrag = !!c._deviceDrag && c._deviceDrag.moved === false;
  const settledAtDown = settled;
  let clientX = sx;
  let clientY = sy;
  let oneLayerEveryStep = true;
  const targetY = anchorPos.y + g * 8;
  for (let step = 0; step < 10; step++) {
    const at = live();
    const dx = anchorPos.x - at.x;
    const dy = targetY - at.y;
    if (Math.abs(dx) < g * 0.01 && Math.abs(dy) < g * 0.01) break;
    const share = step < 4 ? 1 / (4 - step) : 1;
    clientX += dx * share * pxPerUnit();
    clientY += dy * share * pxPerUnit();
    marker.dispatchEvent(pe('pointermove', 77, { clientX, clientY }));
    await frame();
    await frame();
    if (groups() > 1) oneLayerEveryStep = false;
  }
  const atGuide = live();
  out.dragReachedTheAnchorAxis = Math.abs(atGuide.x - anchorPos.x) < 1e-6;
  out.devGuideFollowsARealDrag = lines() >= 1 && dots() >= 1;
  out.devSingleGuideLayer = groups() === 1 && oneLayerEveryStep;
  out.devZeroSettledRendersDuringDrag = settled - settledAtDown === 0;
  // Конец направляющей считается от точки жеста: `pt[1] ± 1.5 шага`. Живая
  // точка и замороженный снимок здесь заведомо разные — это и есть проверка,
  // что направляющую нарисовали от маркера, а не от его прошлого места.
  const frozen = c._pos(c._devices.find((d) => d.id === dragged.id));
  const over = g * 1.5;
  const endFrom = (point) => point.y + Math.sign(point.y - anchorPos.y) * over;
  const guideLine = sr().querySelector('.alignline');
  const y2 = guideLine ? Number(guideLine.getAttribute('y2')) : NaN;
  out.snapshotIsStaleDuringTheDrag = Math.abs(endFrom(frozen) - endFrom(atGuide)) > 1;
  out.devGuideIsMeasuredFromTheLivePosition = Math.abs(y2 - endFrom(atGuide)) < 0.01;
  out.alignPointIsTheLivePosition = Math.abs(c._alignPoint[0] - atGuide.x) < 1e-6
    && Math.abs(c._alignPoint[1] - atGuide.y) < 1e-6;
  out.guideIsPaintedByTheLivePainter = guideOwner() === 'live';
  // #400: направляющая обязана идти ОТ ДРУГОГО значка. Проверяется без
  // подмены состояния жеста: перетаскиваемого маркера нет среди кандидатов.
  const candidates = c._editorRuntime._alignCandidates();
  const key = (x, y) => `${Math.round(x * 1000)}:${Math.round(y * 1000)}`;
  const candidateKeys = candidates.map((point) => key(point[0], point[1]));
  out.devCandidatesExcludeTheDraggedMarker = !candidateKeys.includes(key(atGuide.x, atGuide.y))
    && candidates.length === devs.length - 1;
  out.devGuideAnchorIsTheOtherMarker = candidateKeys.includes(key(anchorPos.x, anchorPos.y));
  // AC6: серия движений внутри одного кадра — один расчёт кандидатов.
  const runtime = c._editorRuntime;
  const realCandidates = runtime._alignCandidates.bind(runtime);
  let candidateCalls = 0;
  runtime._alignCandidates = function () { candidateCalls += 1; return realCandidates(); };
  const paintsBefore = c._liveEditorPaintCount;
  for (let i = 1; i <= 5; i++) {
    marker.dispatchEvent(pe('pointermove', 77, { clientX: clientX + i, clientY }));
  }
  await frame();
  await frame();
  const paints = c._liveEditorPaintCount - paintsBefore;
  out.candidatesAreComputedOncePerFrame = paints >= 1 && candidateCalls >= 1
    && candidateCalls <= paints;
  runtime._alignCandidates = realCandidates;

  // Передача слоя посреди жеста. Осевой кадр приходит не от жеста — у
  // владельца это делает наблюдатель высоты шапки (`_hdrH` сходится
  // ступеньками при любом изменении раскладки), и он же маскировал дефект на
  // замерах S2. Каждый осевой рендер заканчивается `_commitLiveEditor()`,
  // который гасит живой слой и возвращает владение сцене: двух групп не
  // бывает, но точка обязана остаться живой — иначе осевая копия нарисует
  // направляющую там, где маркер стоял до жеста.
  // Серия AC6 увела маркер с оси на пару шагов — возвращаем его, иначе
  // проверять передачу слоя не на чем: без совпадения направляющей нет.
  for (let step = 0; step < 8; step++) {
    const at = live();
    if (Math.abs(at.x - anchorPos.x) < g * 0.01) break;
    clientX += (anchorPos.x - at.x) * pxPerUnit();
    marker.dispatchEvent(pe('pointermove', 77, { clientX, clientY }));
    await frame();
    await frame();
  }
  const atHandover = live();
  out.markerIsBackOnTheAxis = Math.abs(atHandover.x - anchorPos.x) < 1e-6 && lines() === 1;
  const settledBeforeHandover = settled;
  c._hdrH = (c._hdrH || 0) + 0.01;
  await c.updateComplete;
  await frame();
  out.handoverHappened = settled - settledBeforeHandover >= 1;
  out.handoverGivesTheLayerBackToTheSettledScene = guideOwner() === 'settled'
    && sr().querySelector('[data-hp-live-editor]').childElementCount === 0;
  out.handoverKeepsExactlyOneGuide = groups() === 1 && lines() === 1;
  out.handoverGuideStaysOnTheLivePoint = Math.abs(guideLineX() - atHandover.x) < 1e-6;
  // Настоящее движение — и слой снова у живого художника. Шаг вниз по той же
  // оси: выравнивание сохраняется, а позиция меняется, иначе живой отрисовки
  // не будет вовсе — менять нечего, и это правильно.
  clientY += g * pxPerUnit();
  marker.dispatchEvent(pe('pointermove', 77, { clientX, clientY }));
  for (let i = 0; i < 10 && guideOwner() !== 'live'; i++) await frame();
  out.nextMoveTakesTheLayerBack = guideOwner() === 'live' && groups() === 1 && lines() === 1;

  // Съехали с оси — направляющей нет. Смещение выбирается так, чтобы не
  // попасть на ось ни одного из кандидатов: их девять, и «на глаз» выбранный
  // отступ однажды уже сел ровно на чужую ось.
  const away = (() => {
    const points = c._editorRuntime._alignCandidates();
    const here = live();
    for (let step = 3; step <= 24; step++) {
      const x = here.x + g * step;
      const y = here.y + g * step;
      const clear = points.every((point) => Math.abs(point[0] - x) > g * 0.5
        && Math.abs(point[1] - y) > g * 0.5);
      if (clear) return step;
    }
    return 0;
  })();
  out.foundAPlaceOffEveryAxis = away > 0;
  clientX += g * away * pxPerUnit();
  clientY += g * away * pxPerUnit();
  marker.dispatchEvent(pe('pointermove', 77, { clientX, clientY }));
  await frame();
  await frame();
  out.devNoGuideOffAxis = lines() === 0;
  marker.dispatchEvent(pe('pointerup', 77, { clientX, clientY }));
  await c.updateComplete;
  out.devGuideGoneAfterTheDrop = lines() === 0 && groups() === 0;

  // ---- 2) подложка: настоящее рисование прямоугольника -------------------
  c._setMode('decor');
  await c.updateComplete;
  c._curSpaceCfg.decor = [{
    id: 'd1', kind: 'rect', x: 0.2, y: 0.2, w: 0.1, h: 0.1, color: '#ff0000', width: 3,
  }];
  c._decorTool = 'rect';
  c._decorStyle = { color: '#00ff00', width: 3, fill: false };
  c.requestUpdate();
  await c.updateComplete;
  await quiet();
  {
    const start = toClient(500, 500);
    const element = stage();
    const settledAtStart = settled;
    element.dispatchEvent(pe('pointerdown', 91, { clientX: start.x, clientY: start.y }));
    await c.updateComplete;
    out.decorGestureStartsADraft = !!c._decorDraft;
    let x = start.x;
    const y = toClient(0, 600).y;
    let decorOneLayer = true;
    for (let step = 0; step < 10; step++) {
      const b = c._decorDraft?.b;
      if (!b) break;
      const remaining = 200 - b[0]; // левый край d1
      if (Math.abs(remaining) < 0.05) break;
      x += remaining * pxPerUnit() * (step < 3 ? 0.5 : 1);
      element.dispatchEvent(pe('pointermove', 91, { clientX: x, clientY: y }));
      await frame();
      await frame();
      if (groups() > 1) decorOneLayer = false;
    }
    out.decorDraftReachedTheShapeCorner = Math.abs((c._decorDraft?.b?.[0] ?? -1) - 200) < 0.05;
    out.decorGuideFollowsARealGesture = lines() >= 1 && dots() >= 1;
    out.decorSingleGuideLayer = groups() === 1 && decorOneLayer;
    out.decorZeroSettledRendersDuringGesture = settled - settledAtStart <= 1;
    element.dispatchEvent(pe('pointerup', 91, { clientX: x, clientY: y }));
    await c.updateComplete;
    c._curSpaceCfg.decor = [];
    c._decorTool = 'select';
    c.requestUpdate();
    await c.updateComplete;
  }

  // ---- 3) план: направляющая идёт за курсором БЕЗ клика ------------------
  c._setMode('plan');
  c._tool = 'draw';
  await c.updateComplete;
  await quiet();
  {
    const room = c._spaceModel().rooms[0];
    const poly = room.poly || [[room.x, room.y], [room.x + room.w, room.y],
      [room.x + room.w, room.y + room.h], [room.x, room.y + room.h]];
    const vertex = poly[0];
    const element = stage();
    const first = toClient(vertex[0] + g * 10, vertex[1] + g * 10);
    element.dispatchEvent(new MouseEvent('click', {
      clientX: first.x, clientY: first.y, bubbles: true, composed: true, cancelable: true,
    }));
    await c.updateComplete;
    out.planClickAddsTheFirstVertex = c._path.length === 1;
    await quiet();
    const settledAtHover = settled;
    let planOneLayer = true;
    for (let step = 1; step <= 4; step++) {
      const x = vertex[0] + g * 10 - (g * 10 * step) / 4;
      const point = toClient(x, vertex[1] + g * 20);
      element.dispatchEvent(pe('pointermove', 93, { clientX: point.x, clientY: point.y }));
      await frame();
      await frame();
      if (groups() > 1) planOneLayer = false;
    }
    out.planHoverReachedTheVertexAxis = Math.abs((c._cursorPt?.[0] ?? -1) - vertex[0]) < 1e-6;
    out.planGuideFollowsTheCursorWithoutAClick = lines() >= 1 && dots() >= 1;
    out.planSingleGuideLayer = groups() === 1 && planOneLayer;
    out.planZeroSettledRendersDuringHover = settled - settledAtHover === 0;
    // Бейдж угла живёт тем же жестом: 45° красит, иначе — обычный градус.
    const at45 = toClient(c._path[0][0] + g * 5, c._path[0][1] + g * 5);
    element.dispatchEvent(pe('pointermove', 93, { clientX: at45.x, clientY: at45.y }));
    await frame();
    await frame();
    const label45 = sr().querySelector('.measurelabel');
    out.badge45 = !!label45 && label45.classList.contains('on45') && label45.textContent.includes('45');
    const off45 = toClient(c._path[0][0] + g * 5, c._path[0][1] + g * 2);
    element.dispatchEvent(pe('pointermove', 93, { clientX: off45.x, clientY: off45.y }));
    await frame();
    await frame();
    const labelOff = sr().querySelector('.measurelabel');
    out.badgeOff45 = !!labelOff && !labelOff.classList.contains('on45')
      && labelOff.textContent.includes('°');
    c._path = [];
    c._cursorPt = null;
    c.requestUpdate();
    await c.updateComplete;
  }

  // ---- 4) в Просмотре направляющих не бывает ----------------------------
  c._setMode('view');
  await c.updateComplete;
  out.noneInView = lines() === 0 && groups() === 0;
  return out;
});
checkAll(res);
await finish(browser, res);
