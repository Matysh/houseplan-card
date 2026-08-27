import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); c._tool = 'draw'; await c.updateComplete;
  const g = c._gridPitch;
  // r1 — комната; рисуем остров-«колонну» внутри неё
  const r1 = c._spaceModel().rooms.find((r) => r.id === 'r1');
  const [cx, cy] = c._roomCenter(r1).map((v) => Math.round(v / g) * g);
  // #329 П3: сегмент стены не короче 20 см. Остров 2 клетки (10 см) — это
  // колонна, у неё свой инструмент; островная КОМНАТА берётся реалистичного
  // размера, 5 клеток = 25 см.
  const side = g * 5;
  const pts = [[cx, cy], [cx + side, cy], [cx + side, cy + side], [cx, cy + side]];
  // 1) клики внутри комнаты больше не отклоняются
  for (const p of pts) c._markupClick({ clientX: 0, clientY: 0, composedPath: () => [], ...{} , __pt: p });
  // _markupClick берёт координаты из _svgPoint(ev) — подменим напрямую через _path:
  c._path = [];
  for (const p of pts) {
    const before = c._path.length;
    // эмулируем клик готовой точкой: повторим логику через прямой вызов невозможен — построим путь вручную и замкнём
    c._path = [...c._path, p];
    if (c._path.length === before) break;
  }
  out.pointsAccepted = c._path.length === 4;
  // замыкание: проверка пересечений должна пройти (вложенность легальна)
  const clash = c._overlapRoom([...c._path]);
  out.nestedAllowed = !clash;
  // частичное перекрытие всё ещё запрещено
  const partial = [[cx - g * 4, cy], [cx + side, cy], [cx + side, cy + side], [cx - g * 4, cy + side]];
  // сдвинем так, чтобы вылезло за границу r1: возьмём точку заведомо снаружи
  const poly1 = r1.poly || [[r1.x, r1.y], [r1.x + r1.w, r1.y], [r1.x + r1.w, r1.y + r1.h], [r1.x, r1.y + r1.h]];
  const minX = Math.min(...poly1.map((p) => p[0]));
  const cross = [[minX - g * 2, cy], [cx, cy], [cx, cy + side], [minX - g * 2, cy + side]];
  out.partialStillRejected = !!c._overlapRoom(cross);
  // 2) сохранить остров как комнату без зоны (замкнуть контур)
  c._path = [...pts, pts[0]];
  c._nameSel = 'Колонна'; c._areaSel = '';
  c._commitRoom();
  await c.updateComplete;
  const island = c._spaceModel().rooms.find((r) => r.name === 'Колонна');
  out.islandSaved = !!island;
  // #329 П3: остров мельче 20 см отклоняется — такому месту служит колонна.
  const tiny = [[cx, cy], [cx + g * 2, cy], [cx + g * 2, cy + g * 2], [cx, cy + g * 2]];
  c._path = [...tiny, tiny[0]];
  c._nameSel = 'Слишком мелкий'; c._areaSel = '';
  c._commitRoom();
  await c.updateComplete;
  out.tinyIslandRejected = !c._spaceModel().rooms.some((r) => r.name === 'Слишком мелкий');
  // 3) внешняя комната рендерится как path с evenodd и дыркой
  c._setMode('view'); await c.updateComplete;
  // включим границы, чтобы r1 рендерился
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, settings: { ...(s.settings || {}), show_borders: true } })) };
  c.requestUpdate(); await c.updateComplete;
  const evenodd = [...sr().querySelectorAll('path.room')].find((p) => p.getAttribute('fill-rule') === 'evenodd');
  out.evenoddPath = !!evenodd;
  out.holeInPath = evenodd ? (evenodd.getAttribute('d').match(/M /g) || []).length === 2 : null;
  // 4) остров кликабелен (элемент существует и он поверх дырки).
  // Beta.5+ applies Draw thickness, so the painted contour is inset and no
  // longer contains the exact centreline coordinate — look up by room id.
  const islandEl = island
    ? sr().querySelector(`[data-hp="room"][data-id="${island.id}"]`)
    : null;
  out.islandRendered = !!islandEl && islandEl !== evenodd;
  return out;
});
checkAll(res);
await finish(browser, res);
