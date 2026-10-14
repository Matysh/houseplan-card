// Магнит равных интервалов редактора устройств (#873) — на НАСТОЯЩЕМ жесте.
//
// Протокол — как у smoke_align_guides (#521): тишина перед жестом, настоящие
// PointerEvent по значку, ноль осевых циклов на движениях, ровно одна видимая
// группа подсказки, передача слоя при осевой отрисовке посреди жеста.
// Раскладка и скрытие задаются только через `__hpTest.setLayout` /
// `setServerConfig` (#629): `_deviceDrag` и `_layout` не присваиваются.
// Поддельный транспорт записи — по образцу smoke_device_position_history:
// число и содержимое `houseplan/layout/update`, отказ записи.
//
// Координаты — единицы плана (1000 на исходный квадрат), все точки — узлы
// сетки. Ряд A=(100,200), B=(150,200): C у (200,200), D у (250,200), новый
// значок на автоматическом месте — у (50,200); вертикаль (700,300),(700,350)
// продолжается в (700,400). Указатель отпускается в 4 px от точки.
import { launch, checkAll, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const out = {};
{
  const { page, browser } = await launch();
  Object.assign(out, await page.evaluate(async () => {
    const res = {};
    const c = window.__card;
    const sr = () => c.shadowRoot || c.renderRoot;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const quiet = async () => {
      for (let i = 0; i < 8; i++) await frame();
      await wait(350);
    };
    const idle = async () => {
      const started = performance.now();
      while (c._devicePositionBusy && performance.now() - started < 2000) await wait(10);
      await c.updateComplete;
      await frame();
    };
    let settled = 0;
    const settledWillUpdate = c.willUpdate.bind(c);
    c.willUpdate = function (changed) { settled += 1; return settledWillUpdate(changed); };

    // Поддельный транспорт: запись видна, отказ — по флагу; остальное — фикстуре.
    const originalCallWs = c.hass.callWS;
    const writes = [];
    let refuseNext = false;
    c.hass = { ...c.hass, callWS: async (message) => {
      if (message.type === 'houseplan/layout/update') {
        if (refuseNext) { refuseNext = false; throw new Error('update refused'); }
        writes.push({ id: message.device_id, pos: structuredClone(message.pos) });
      }
      return originalCallWs(message);
    } };

    await window.__hpTest.setMode('devices');
    const space = c._space;
    const N = (x, y) => ({ s: space, x: x / 1000, y: y / 1000 });
    // A, B — ряд; C, D — сохранённые; E — новый на автоматическом месте;
    // V1, V2 — вертикаль, F тянется к ней; X — якорь направляющей по другой
    // оси; K — тянется в остальных сценариях. Стоянки — на диагонали: ни одна
    // пара не делит x или y, посторонних рядов нет.
    const A = 'd_light1', B = 'd_lamp', C = 'd_tv', D = 'd_temp', E = 'd_kettle';
    const V1 = 'd_leak', V2 = 'd_bedlight', F = 'd_window', X = 'd_lock', K = 'd_motion';
    await window.__hpTest.setLayout((layout) => {
      const next = { ...layout };
      Object.assign(next, {
        [A]: N(100, 200), [B]: N(150, 200), [C]: N(325, 425), [D]: N(375, 475),
        [V1]: N(700, 300), [V2]: N(700, 350), [F]: N(575, 625), [X]: N(200, 700), [K]: N(475, 825),
      });
      delete next[E];
      return next;
    });
    await quiet();
    const dev = (id) => c._devices.find((d) => d.id === id);
    const marker = (id) => [...sr().querySelectorAll('[data-hp="device"]')].find((el) => el.dataset.id === id);
    const autoE = c._pos(dev(E));
    res.fixtureReady = [A, B, C, D, E, V1, V2, F, X, K].every((id) => dev(id)?.space === space && !!marker(id))
      && c._layout[E] === undefined && c._norm === true;
    // Новый значок стоит на узле, но не на проверяемых линиях.
    res.fixtureAutoMarkerOffTheTestLines = Math.abs(autoE.y - 200) > 1 && Math.abs(autoE.x - 700) > 1
      && Math.abs(autoE.x - 200) > 1 && Math.abs(autoE.y - 800) > 1;

    const stage = () => sr().querySelector('.stage');
    const toClient = (x, y) => {
      const rect = stage().getBoundingClientRect();
      const v = c._viewOr(c._baseVb());
      return { x: rect.left + ((x - v.x) / v.w) * rect.width, y: rect.top + ((y - v.y) / v.h) * rect.height };
    };
    const fire = (el, type, x, y, pointerId, pointerType = 'mouse') => el.dispatchEvent(new PointerEvent(type, {
      pointerId, pointerType, isPrimary: true, button: 0,
      buttons: ['pointerup', 'pointercancel', 'lostpointercapture'].includes(type) ? 0 : 1,
      clientX: x, clientY: y, bubbles: true, composed: true, cancelable: true,
    }));
    const stored = (id) => {
      const p = c._layout[id];
      return p ? { x: p.x * 1000, y: p.y * 1000 } : null;
    };
    const live = (id) => c._livePos(dev(id));
    const at = (p, x, y) => !!p && Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6;
    // Видимое: осевая копия слоя на время жеста гасится прозрачностью (#521).
    const visible = (selector) => [...sr().querySelectorAll(selector)].filter((node) => {
      const layer = node.closest('.hp-editor-only-layer');
      return !layer || layer.style.opacity !== '0';
    });
    const hint = () => visible('.spacingguides').map((group) => ({
      axis: group.classList.contains('v') ? 'v' : 'h',
      owner: group.closest('[data-hp-live-editor]') ? 'live' : 'settled',
      ariaHidden: group.getAttribute('aria-hidden'),
      gaps: [...group.querySelectorAll('.spacingline')].map((path) => {
        // кадр ряда: x вдоль ряда, y поперёк — `M a y0-k V y0+k M a y0 H b M b …`
        const n = path.getAttribute('d').match(/-?[\d.]+(?:e[-+]?\d+)?/g).map(Number);
        const style = getComputedStyle(path);
        return { a: n[3], b: n[5], across: n[4], cls: path.getAttribute('class'),
          paint: `${style.stroke} ${style.strokeWidth} ${style.vectorEffect} ${style.fill}` };
      }),
      labels: [...group.querySelectorAll('.spacinglabel')].map((text) => text.textContent),
    }));
    const guideAxes = () => visible('.alignline')
      .map((line) => (line.getAttribute('x1') === line.getAttribute('x2') ? 'x' : 'y'));
    const span = (gap) => [Math.min(gap.a, gap.b), Math.max(gap.a, gap.b)];
    const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps;
    const gapsAre = (seen, axis, expected) => seen.length === 1 && seen[0].axis === axis
      && seen[0].gaps.length === 2 && seen[0].gaps.every((gap, i) => {
        const [lo, hi] = span(gap);
        return near(lo, expected[i][0]) && near(hi, expected[i][1]);
      });

    let pointerId = 8730;
    /** Настоящий жест: pointerdown в центре значка, 8 движений по кадрам, конец `end`. */
    const gesture = async (id, to, offPx, { end = 'pointerup', inspect, before } = {}) => {
      await quiet();
      const el = marker(id);
      const from = toClient(c._pos(dev(id)).x, c._pos(dev(id)).y);
      const t = toClient(to.x, to.y);
      const ex = t.x + offPx[0];
      const ey = t.y + offPx[1];
      const p = ++pointerId;
      const writesBefore = writes.length;
      const historyBefore = c._devicePositionHistory.size;
      fire(el, 'pointerdown', from.x, from.y, p);
      await c.updateComplete;
      const settledAtDown = settled;
      for (let i = 1; i <= 8; i++) {
        fire(el, 'pointermove', from.x + ((ex - from.x) * i) / 8, from.y + ((ey - from.y) * i) / 8, p);
        await frame();
      }
      await frame();
      await frame();
      const result = {
        settledDuringMoves: settled - settledAtDown, preview: live(id), hint: hint(), guides: guideAxes(),
        writesDuringGesture: writes.length - writesBefore,
      };
      if (before) result.extra = await before({ el, p, ex, ey });
      if (inspect) result.inspected = inspect();
      if (end === 'escape') {
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', bubbles: true, composed: true, cancelable: true,
        }));
      } else if (end) fire(el, end, ex, ey, p);
      await idle();
      result.writes = writes.slice(writesBefore);
      result.history = c._devicePositionHistory.size - historyBefore;
      result.after = hint();
      result.dragGone = c._deviceDrag === null;
      result.end = { el, p, ex, ey };
      return result;
    };

    // ---- AC1 + AC4: C в продолжение ряда, сохранённый значок -------------------
    const gC = await gesture(C, { x: 200, y: 200 }, [4, 0]);
    res.ac1CPreviewIsTheTarget = at(gC.preview, 200, 200);
    res.ac1CStoredExactly = at(stored(C), 200, 200);
    res.ac1CEqualGaps = Math.abs((stored(C).x - stored(B).x) - (stored(B).x - stored(A).x)) <= 1e-6;
    res.ac1COneWriteOneUndoStep = gC.writes.length === 1 && gC.writes[0].id === C && gC.history === 1
      && gC.writesDuringGesture === 0;
    res.ac1CWireIsTheShownPoint = at({ x: gC.writes[0]?.pos.x * 1000, y: gC.writes[0]?.pos.y * 1000 }, 200, 200);
    res.ac4CZeroSettledRendersDuringMoves = gC.settledDuringMoves === 0;
    res.ac4COneGroupTwoGapsABandBC = gapsAre(gC.hint, 'h', [[100, 150], [150, 200]]);
    res.ac4CPaintedLiveAndHidden = gC.hint[0]?.owner === 'live' && gC.hint[0]?.ariaHidden === 'true';
    res.ac4CGapsLookTheSame = gC.hint.length === 1 && gC.hint[0].gaps.length === 2
      && gC.hint[0].gaps[0].cls === gC.hint[0].gaps[1].cls
      && gC.hint[0].gaps[0].paint === gC.hint[0].gaps[1].paint
      && gC.hint[0].gaps[0].across === gC.hint[0].gaps[1].across;
    // 50 единиц при масштабе 1 — около 30 px: подпись не влезает ни в один промежуток.
    res.ac4CLabelsHiddenOnBothWhenTheyDoNotFit = gC.hint[0]?.labels.length === 0;
    res.ac4RowAxisGuideReplacedOtherAxisKept = !gC.guides.includes('y') && gC.guides.includes('x');
    res.ac4CNoHintAfterTheDrop = gC.after.length === 0 && gC.dragGone;

    // ---- AC1 + AC4: четвёртый — шаг A–B, эталон A–B, новый C–D ----------------
    const gD = await gesture(D, { x: 250, y: 200 }, [4, 0]);
    res.ac1DStoredExactly = at(stored(D), 250, 200)
      && Math.abs((stored(D).x - stored(C).x) - (stored(B).x - stored(A).x)) <= 1e-6;
    res.ac1DOneWriteOneUndoStep = gD.writes.length === 1 && gD.history === 1;
    res.ac4DReferenceIsABNotBC = gapsAre(gD.hint, 'h', [[100, 150], [200, 250]]);

    // ---- AC1: другой конец, новый значок на автоматическом месте ----------------
    const gE = await gesture(E, { x: 50, y: 200 }, [-4, 0]);
    res.ac1NewMarkerStoredAtTheOtherEnd = at(stored(E), 50, 200)
      && Math.abs((stored(A).x - stored(E).x) - (stored(B).x - stored(A).x)) <= 1e-6;
    res.ac1NewMarkerOneWriteOneUndoStep = gE.writes.length === 1 && gE.writes[0].id === E && gE.history === 1;
    res.ac4OtherEndReferenceIsTheFarGap = gapsAre(gE.hint, 'h', [[200, 250], [50, 100]]);

    // ---- AC1: вертикаль ------------------------------------------------------
    const gF = await gesture(F, { x: 700, y: 400 }, [0, 4]);
    res.ac1VerticalStoredExactly = at(stored(F), 700, 400)
      && Math.abs((stored(F).y - stored(V2).y) - (stored(V2).y - stored(V1).y)) <= 1e-6;
    res.ac1VerticalOneWriteOneUndoStep = gF.writes.length === 1 && gF.history === 1;
    res.ac4VerticalHint = gapsAre(gF.hint, 'v', [[300, 350], [350, 400]]);
    res.ac4VerticalLineIsLeftOfTheRow = gF.hint[0]?.gaps.every((gap) => gap.across < 700) ?? false;

    // ---- AC4 / #521: осевая отрисовка посреди жеста не даёт второй копии --------
    const T = { x: 300, y: 200 }; // правая цель ряда E,A,B,C,D (50…250)
    const handover = await gesture(K, T, [3, 0], {
      end: 'escape',
      before: async ({ el, p, ex, ey }) => {
        const before = settled;
        // Осевой кадр не от жеста: хост стал на пиксель уже — наблюдатели
        // размеров карточки отрисовывают сцену обычным путём.
        const host = document.getElementById('host');
        host.style.width = `${host.getBoundingClientRect().width - 1}px`;
        for (let i = 0; i < 6 && settled === before; i++) await frame();
        await c.updateComplete;
        const atSettled = hint(); // сразу после осевого рендера
        const liveRootEmpty = sr().querySelector('[data-hp-live-editor]').childElementCount === 0;
        await frame();
        const nextFrame = hint();
        fire(el, 'pointermove', ex + 1, ey, p);
        for (let i = 0; i < 10 && hint()[0]?.owner !== 'live'; i++) await frame();
        return { rendered: settled - before, atSettled, liveRootEmpty, nextFrame, afterMove: hint() };
      },
    });
    const h = handover.extra;
    res.ac4HandoverHappened = h.rendered >= 1;
    // Владение чередуется: осевой рендер отдаёт слой сцене (живой корень пуст),
    // следующий живой кадр забирает его обратно — видимая группа всегда одна.
    res.ac4HandoverKeepsExactlyOneGroup = h.atSettled.length === 1 && h.atSettled[0].owner === 'settled'
      && h.liveRootEmpty && h.nextFrame.length === 1;
    res.ac4NextMoveTakesTheLayerBack = h.afterMove.length === 1 && h.afterMove[0].owner === 'live';

    // ---- AC6: отмены во время захвата ---------------------------------------
    const kBefore = structuredClone(c._layout[K]);
    const unchanged = () => JSON.stringify(c._layout[K]) === JSON.stringify(kBefore);
    res.ac6EscapeDuringCapture = handover.hint.length === 1 && at(handover.preview, T.x, T.y)
      && handover.after.length === 0 && handover.writes.length === 0 && handover.dragGone && unchanged();
    // Удерживаемая цель живёт в жесте: новый жест в 8 px (между r_in и r_out) её не наследует.
    const fresh = await gesture(K, T, [8, 0], { end: 'escape' });
    res.ac6HeldTargetDoesNotOutliveTheGesture = !at(fresh.preview, T.x, T.y) && fresh.hint.length === 0
      && unchanged();
    for (const end of ['pointercancel', 'lostpointercapture']) {
      const g = await gesture(K, T, [3, 0], { end });
      res[`ac6${end}DuringCapture`] = g.hint.length === 1 && g.after.length === 0 && g.writes.length === 0
        && g.dragGone && unchanged();
    }
    {
      const g = await gesture(K, T, [3, 0], {
        end: null,
        before: async () => {
          await window.__hpTest.setMode('view');
          return { hint: hint(), drag: c._deviceDrag };
        },
      });
      res.ac6ModeChangeDuringCapture = g.hint.length === 1 && g.extra.hint.length === 0 && g.extra.drag === null
        && g.writes.length === 0 && unchanged();
      await window.__hpTest.setMode('devices');
    }
    {
      const g = await gesture(K, T, [3, 0], {
        end: null,
        before: async () => {
          await window.__hpTest.setLayout((layout) => ({ ...layout, [K]: kBefore, [X]: N(225, 725) }));
          return { hint: hint(), drag: c._deviceDrag };
        },
      });
      res.ac6ExternalLayoutDuringCapture = g.hint.length === 1 && g.extra.hint.length === 0
        && g.extra.drag === null && g.writes.length === 0 && unchanged();
    }
    {
      refuseNext = true;
      const g = await gesture(K, T, [3, 0]);
      res.ac6RefusedWriteRollsBack = g.writes.length === 0 && g.history === 0 && unchanged()
        && typeof c._toast === 'string' && c._toast.includes('update refused');
    }
    {
      const g = await gesture(K, T, [3, 0]);
      const wrote = g.writes[0]?.pos;
      res.ac6MagnetGestureWritesTheShownTarget = g.writes.length === 1 && g.history === 1
        && at({ x: wrote.x * 1000, y: wrote.y * 1000 }, T.x, T.y) && at(stored(K), T.x, T.y);
      const afterDrop = structuredClone(c._layout[K]);
      const writesBefore = writes.length;
      sr().querySelector('[data-device-position-history="undo"]').click();
      await idle();
      const undone = structuredClone(c._layout[K]);
      sr().querySelector('[data-device-position-history="redo"]').click();
      await idle();
      res.ac6UndoRestoresTheExactStoredPoint = undone.x === kBefore.x && undone.y === kBefore.y
        && undone.s === kBefore.s;
      res.ac6RedoRestoresTheExactStoredPoint = JSON.stringify(c._layout[K]) === JSON.stringify(afterDrop);
      res.ac6HistoryRunsWithoutTheMagnet = writes.length === writesBefore + 2 && c._deviceDrag === null;
      sr().querySelector('[data-device-position-history="undo"]').click();
      await idle();
    }

    // ---- AC5: сила магнита в CSS px — масштабы 1 и 8 ---------------------------
    {
      const g = await gesture(K, T, [12, 0], { end: 'escape' });
      res.ac5Zoom1TwelvePxIsNotCaptured = !at(g.preview, T.x, T.y) && g.hint.length === 0;
    }
    c._applyView(8, T.x, T.y);
    await c.updateComplete;
    await quiet();
    const fmt50 = c._fmtLen([0, 0], [50, 0]);
    {
      const g = await gesture(K, T, [4, 0]);
      res.ac5Zoom8FourPxCapturedAndStored = at(stored(K), T.x, T.y) && g.writes.length === 1
        && Math.abs((stored(K).x - stored(D).x) - (stored(B).x - stored(A).x)) <= 1e-6;
      res.ac4Zoom8LabelsEqualAndFmtLen = g.hint.length === 1 && g.hint[0].labels.length === 2
        && g.hint[0].labels.every((text) => text === fmt50);
      sr().querySelector('[data-device-position-history="undo"]').click();
      await idle();
    }
    {
      const g = await gesture(K, T, [12, 0], { end: 'escape' });
      res.ac5Zoom8TwelvePxIsNotCaptured = !at(g.preview, T.x, T.y) && g.hint.length === 0;
    }
    {
      // 8 px: вне r_in, но в полуузле 19.5-px сетки — итог равен цели, подсказка есть.
      const g = await gesture(K, T, [8, 0], { end: 'escape' });
      res.ac5Zoom8GridBringsItThereAndTheHintShows = at(g.preview, T.x, T.y) && g.hint.length === 1;
    }
    c._applyView(1);
    await c.updateComplete;

    // ---- AC2: скрытый значок при выключенном «Показывать скрытые» -------------
    await window.__hpTest.setLayout((layout) => ({ ...layout, [V1]: N(100, 800), [V2]: N(150, 800) }));
    await window.__hpTest.setServerConfig((cfg) => {
      const d = dev(V1);
      cfg.markers = [...(cfg.markers || []), { id: d.id, binding: `device:${d.bindingRef}`, hidden: true }];
      return cfg;
    });
    res.ac2HiddenMarkerIsNotDrawn = dev(V1)?.hidden === true && !marker(V1) && c._showAll === false;
    {
      const g = await gesture(K, { x: 200, y: 800 }, [4, 0], { end: 'escape' });
      res.ac2HiddenMarkerGivesNoTarget = !at(g.preview, 200, 800) && g.hint.length === 0;
    }

    // ---- AC8: в Просмотре мышь и касание по значку его не двигают -----------
    await window.__hpTest.setMode('view');
    await quiet();
    for (const pointerType of ['mouse', 'touch']) {
      const before = structuredClone(c._layout[K]);
      const el = marker(K);
      const from = toClient(c._pos(dev(K)).x, c._pos(dev(K)).y);
      const t = toClient(T.x, T.y);
      const p = ++pointerId;
      fire(el, 'pointerdown', from.x, from.y, p, pointerType);
      let moved = false;
      let anyHint = false;
      for (let i = 1; i <= 8; i++) {
        fire(el, 'pointermove', from.x + ((t.x - from.x) * i) / 8, from.y + ((t.y - from.y) * i) / 8, p, pointerType);
        await frame();
        if (JSON.stringify(c._layout[K]) !== JSON.stringify(before)) moved = true;
        if (sr().querySelector('.spacingguides')) anyHint = true;
      }
      fire(el, 'pointerup', t.x, t.y, p, pointerType);
      await idle();
      res[`ac8View${pointerType}DoesNotMoveOrHint`] = !moved && !anyHint && c._deviceDrag === null
        && JSON.stringify(c._layout[K]) === JSON.stringify(before);
    }
    return res;
  }));
  await finish(browser);
}

// ---- AC7: на фикстуре large-house — одно построение за жест, расчётов не больше кадров ----
{
  const { page, browser } = await launch({ width: 1280, height: 900 });
  const fixture = makeLargeHouseFixture();
  // Позиции фикстуры — вне узлов сетки; на узлах линии и ряды появляются,
  // и у движения есть что просматривать.
  for (const pos of Object.values(fixture.layout)) {
    pos.x = Math.round(pos.x * 240) / 240;
    pos.y = Math.round(pos.y * 240) / 240;
  }
  // и в каждом пространстве — заведомый ряд из двух значков на узлах
  const seen = new Map();
  for (const pos of Object.values(fixture.layout)) {
    const n = seen.get(pos.s) ?? 0;
    if (n < 2) Object.assign(pos, { x: 0.5 + n * 0.05, y: 0.5 });
    seen.set(pos.s, n + 1);
  }
  Object.assign(out, await page.evaluate(async (fixture) => {
    const res = {};
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    window.__card?.remove?.();
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'p873', icon_size: 3.4 });
    const hass = { language: 'en', locale: { language: 'en' }, user: { id: 'p', name: 'p', is_admin: true },
      devices: fixture.devices, entities: fixture.entities, areas: fixture.areas, states: fixture.states,
      floors: { one: { floor_id: 'one', name: 'One', level: 0 } },
      callWS: async (m) => (m.type === 'houseplan/config/get' ? { config: structuredClone(fixture.config), rev: 1, can_write: true }
        : m.type === 'houseplan/layout/get' ? { layout: structuredClone(fixture.layout), rev: 1 }
          : m.type === 'config/device_registry/list' ? Object.values(fixture.devices)
            : m.type === 'config/entity_registry/list' ? Object.values(fixture.entities) : { ok: true }),
      callService: async () => undefined,
      connection: { subscribeEvents: async () => () => undefined, subscribeMessage: async () => () => undefined },
      localize: () => null, formatEntityState: (s) => s.state, config: { unit_system: { length: 'km' } } };
    document.getElementById('host').replaceChildren(card);
    window.__card = card;
    card.hass = hass;
    const started = performance.now();
    while (!(card._loadOk && card._model?.length && card._devices?.length) && performance.now() - started < 15000) await wait(30);
    await window.__hpTest.setMode('devices');
    for (let i = 0; i < 8; i++) await frame();
    await wait(350);
    const sr = card.renderRoot;
    const inSpace = card._devices.filter((d) => d.space === card._space && !d.hidden);
    // не из заведомого ряда: его первые два значка — участники
    const el = [...sr.querySelectorAll('[data-hp="device"]')].find((node) => node.dataset.id === inSpace.at(-1)?.id);
    res.ac7LargeHouseReady = inSpace.length >= 60 && !!el;
    if (!el) return res;
    const box = el.getBoundingClientRect();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const fire = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, {
      pointerId: 8790, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
      clientX: cx, clientY: cy, bubbles: true, composed: true, cancelable: true,
    }));
    fire('pointerdown', x, y);
    await card.updateComplete;
    const magnet = card._deviceDrag?.spacing;
    for (let i = 1; i <= 30; i++) {
      fire('pointermove', x + i * 7, y + i * 3);
      await frame();
    }
    res.ac7OneIndexBuildPerGesture = !!magnet && magnet.builds === 1 && magnet.queries >= 20;
    res.ac7AMoveVisitsTheReadyTargetsOnce = !!magnet && magnet.visited > 0
      && magnet.visited <= magnet.queries * 2 * inSpace.length && magnet.visited % magnet.queries === 0;
    // Серия движений внутри одного кадра — один расчёт (как candidatesAreComputedOncePerFrame).
    const queriesBefore = magnet?.queries ?? 0;
    const paintsBefore = card._liveEditorPaintCount;
    for (let i = 1; i <= 5; i++) fire('pointermove', x + 210 + i, y + 90);
    await frame();
    await frame();
    const paints = card._liveEditorPaintCount - paintsBefore;
    const queries = (magnet?.queries ?? 0) - queriesBefore;
    res.ac7HintIsComputedNoMoreOftenThanFrames = paints >= 1 && queries >= 1 && queries <= paints;
    res.ac7Detail = `devices ${inSpace.length}, builds ${magnet?.builds}, queries ${magnet?.queries}, visited ${magnet?.visited}, burst ${queries}/${paints}`;
    fire('pointerup', x + 215, y + 90);
    return res;
  }, fixture));
  await finish(browser);
}

console.log('ac7:', out.ac7Detail);
delete out.ac7Detail;
checkAll(out);
await finish(null, out);
