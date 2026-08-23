/**
 * Issue #177: пересечения при закрытии контура инструментом «Стены» (#173).
 *
 * AC8 задачи #173 обещал доказательство «unit + smoke» для трёх исходов, но
 * доказан был только сам примитив `_overlapRoom` — вызовом напрямую в
 * `smoke_island_rooms`, минуя предложение грани. Здесь проверяется та связка,
 * которую видит пользователь: `_offerWallFaces` (предлагать ли грань) и
 * `_applyWallFaceBatch` (вторая проверка при создании), обе из #173 §10.3.
 *
 * Три исхода контракта:
 *   1. точный дубль существующей комнаты не предлагается;
 *   2. частичное пересечение не предлагается и ничего не меняет в конфиге;
 *   3. полная вложенность в обе стороны предлагается и создаёт island room.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 820 }, 1);

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const space = () => card._serverCfg.spaces[0];
  const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const closed = (r) => [...r, [...r[0]]];

  const resetGeometry = async (rooms = []) => {
    const current = space();
    current.rooms = JSON.parse(JSON.stringify(rooms));
    delete current.room_drafts;
    delete current.partitions;
    delete current.walls;
    delete current.open_spans;
    card._cfgEpoch++;
    card._modelCache = null;
    card._path = [];
    card._activeDraftId = null;
    card._draftSegmentCms = [];
    card._wallFaceBatch = null;
    card._roomDialog = false;
    card._tool = 'draw';
    await update();
  };
  // Та же цепочка вызовов, что у настоящего клика по плану: точка, запись
  // отрезка, предложение граней. Подставлять `_path` целиком нельзя — тогда
  // проверялся бы не тот путь, по которому ходит пользователь.
  const draw = async (points) => {
    card._tool = 'draw';
    card._path = [[...points[0]]];
    card._activeDraftId = null;
    card._draftSegmentCms = [];
    for (let i = 1; i < points.length; i++) {
      const before = card._path.map((point) => [...point]);
      card._path = [...card._path, [...points[i]]];
      card._draftSegmentCms = [...card._draftSegmentCms, card._drawWallCm];
      card._persistActiveDraftSegment();
      card._offerWallFaces(before);
      await update();
    }
  };
  const roomAt = (name, r) => ({ id: 'r-' + name, name, poly: r.map((p) => [p[0] / 1000, p[1] / 1000]) });

  card._serverCfg = {
    spaces: [{
      id: 'overlap', title: 'Overlap', cell_cm: 5, view_box: [0, 0, 1, 0.7],
      rooms: [], openings: [], room_drafts: [], partitions: [], wall_columns: [],
    }],
    markers: [], settings: {},
  };
  card._space = 'overlap';
  card._layout = {};
  card._cfgEpoch++;
  card._modelCache = null;
  card._setMode('plan');
  card._tool = 'draw';
  await update();

  const base = ring(200, 200, 400, 400);

  // 1) Точный дубль: контур повторяет существующую комнату вершина в вершину.
  await resetGeometry([roomAt('base', base)]);
  await draw(closed(base));
  out.duplicateOffersNothing = !card._wallFaceBatch && !card._roomDialog;
  out.duplicateKeepsOneRoom = space().rooms.length === 1;

  // 2) Частичное пересечение. Контракт оказался сильнее, чем «отклонить»:
  // пересекающее кольцо целиком инструменту недоступно вовсе — планарный граф
  // отдаёт куски разреза, каждый из которых либо вложен в комнату, либо лежит
  // снаружи. Частично перекрывающейся комнаты из этого жеста не построить.
  await resetGeometry([roomAt('base', base)]);
  const configBefore = JSON.stringify(space().rooms);
  const drawnRing = ring(300, 300, 500, 500);
  const drawnArea = 200 * 200;
  await draw(closed(drawnRing));
  const offered = card._wallFaceBatch?.candidates || [];
  out.partialOverlapDecomposesIntoFaces = offered.length === 3;
  // Ни одна предложенная грань не равна нарисованному кольцу: 10000 + 30000 +
  // 30000 = 40000, то есть пересечение и две «буквы Г», а не наложение.
  out.partialOverlapNeverOffersTheDrawnRing =
    offered.length > 0 && offered.every((candidate) => candidate.area < drawnArea - 1);
  out.partialOverlapFacesSumToTheUnion =
    Math.abs(offered.reduce((sum, candidate) => sum + candidate.area, 0) - drawnArea * 1.75) < 1;
  out.partialOverlapKeepsRoomsUntilDecision =
    JSON.stringify(space().rooms) === configBefore;

  // 3a) Вложенность внутрь: контур целиком внутри существующей комнаты.
  await resetGeometry([roomAt('outer', ring(100, 100, 600, 600))]);
  await draw(closed(ring(200, 200, 300, 300)));
  out.innerNestingIsOffered = !!card._wallFaceBatch
    && card._wallFaceBatch.candidates.length === 1;
  card._nameSel = 'Island';
  card._saveRoom();
  await update();
  out.innerNestingCreatesIslandRoom = space().rooms.length === 2
    && space().rooms.some((room) => room.name === 'Island');

  // 3b) Вложенность наружу: контур охватывает существующую комнату целиком.
  await resetGeometry([roomAt('inner', ring(300, 300, 400, 400))]);
  await draw(closed(ring(150, 150, 600, 600)));
  out.outerNestingIsOffered = !!card._wallFaceBatch
    && card._wallFaceBatch.candidates.length === 1;
  card._nameSel = 'Around';
  card._saveRoom();
  await update();
  out.outerNestingCreatesRoom = space().rooms.length === 2
    && space().rooms.some((room) => room.name === 'Around');

  // 4) Вторая линия обороны (#173 §10.3): даже если решение о грани дошло до
  // создания, `_applyWallFaceBatch` обязан отказать на пересечении. Батч
  // собирается вручную — единственный способ пройти мимо первой проверки.
  await resetGeometry([roomAt('base', base)]);
  const clashRing = ring(300, 300, 500, 500).map((p) => [p[0], p[1]]);
  card._wallFaceBatch = {
    candidates: [{ key: 'manual', area: 1, ring: clashRing }],
    index: 0,
    decisions: [{ candidate: { key: 'manual', area: 1, ring: clashRing }, create: true }],
    activePath: closed(clashRing),
    activeCms: [15, 15, 15, 15],
    activeDraftId: null,
  };
  const roomsBeforeGuard = space().rooms.length;
  card._applyWallFaceBatch();
  await update();
  out.applyGuardRejectsOverlap = space().rooms.length === roomsBeforeGuard;
  out.applyGuardClosesBatch = !card._wallFaceBatch;

  return out;
});

checkAll(result);
await finish(browser, result);
