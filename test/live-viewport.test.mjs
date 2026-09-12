import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isIdentityLiveLayerProjection,
  liveLayerProjection,
  liveViewBoxText,
  paintLiveViewport,
} from '../test-build/live-viewport.js';

test('live viewport projects pan and zoom from the last complete frame', () => {
  assert.deepEqual(
    liveLayerProjection(
      { x: 0, y: 0, w: 1000, h: 500 },
      { x: 100, y: 50, w: 500, h: 250 },
    ),
    { translateXPercent: -20, translateYPercent: -20, scaleX: 2, scaleY: 2 },
  );
});

test('live viewport serializes one exact SVG camera box', () => {
  assert.equal(liveViewBoxText({ x: -12.5, y: 4, w: 800, h: 450 }), '-12.5 4 800 450');
});

test('a settled live viewport removes its compositor transform', () => {
  const settled = { x: 17.25, y: -4, w: 800, h: 450 };
  assert.equal(isIdentityLiveLayerProjection(liveLayerProjection(settled, settled)), true);
  assert.equal(isIdentityLiveLayerProjection(liveLayerProjection(
    settled,
    { ...settled, x: settled.x + 0.001 },
  )), false);
});

// #531. Перезапись `viewBox` — это инвалидация растеризации всего плана: слой
// нельзя сдвинуть, его надо нарисовать заново. Профиль владельца на панораме
// (Firefox 155, 144 Гц): краска закончилась, а до композиции 94 мс медианы при
// незагруженном GPU, и драйвер пропускает 124–144 тика в секунду с пометкой
// «ждём краску». Поэтому кадр жеста двигает сцену трансформом, а содержимое
// подтягивается по бюджету — иначе на набегающем крае осталась бы пустая полоса.

/** Крошечный DOM: только то, что читает `paintLiveViewport`. */
const fakeRoot = () => {
  const node = (attrs) => {
    const el = {
      attrs: { ...attrs }, writes: 0, styleWrites: 0,
      getAttribute: (name) => (name in el.attrs ? el.attrs[name] : null),
      setAttribute: (name, value) => { el.attrs[name] = value; el.writes += 1; },
      style: new Proxy({ _v: {} }, {
        get: (target, key) => {
          if (key === 'removeProperty') return (name) => { delete target._v[name]; el.styleWrites += 1; };
          if (key === '_v') return target._v;
          return target._v[key];
        },
        set: (target, key, value) => { target._v[key] = value; el.styleWrites += 1; return true; },
      }),
    };
    return el;
  };
  const camera = node({ viewBox: '0 0 1000 500' });
  const cameraPeer = node({ viewBox: '0 0 1000 500' });
  const floor = node({ viewBox: '0 0 1000 500' });
  const layer = node({});
  return {
    camera, cameraPeer, floor, layer,
    querySelectorAll: (selector) => {
      if (selector.includes('viewbox="camera"')) return [camera, cameraPeer];
      if (selector.includes('viewbox="floor"')) return [floor];
      if (selector.includes('live-layer')) return [layer];
      return [];
    },
    querySelector: () => null,
  };
};

const frame = (x, y, w = 1000, h = 500) => ({
  view: { x, y, w, h }, floor: { x, y, w, h }, zoom: 1,
});

test('#531 AC1: кадр жеста двигает сцену трансформом и не трогает viewBox', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null, { now: 1000 });
  const writesAfterAnchor = root.camera.writes;
  for (let step = 1; step <= 5; step += 1) {
    anchor = paintLiveViewport(root, painted, frame(step * 10, 0), anchor, { now: 1000 + step * 10 });
  }
  assert.equal(root.camera.writes, writesAfterAnchor, 'viewBox переписывать не за что');
  assert.equal(root.camera.attrs.viewBox, '0 0 1000 500');
  assert.match(root.camera.style.transform, /^translate\(-5%,0%\) scale\(1,1\)$/);
  assert.equal(root.camera.style.overflow, 'visible', 'scene exposes the incoming edge');
  assert.equal(root.cameraPeer.style.overflow, 'visible', 'every camera scene exposes the edge');
  assert.equal(root.floor.style.overflow, 'visible', 'the floor scene exposes the edge');
  assert.equal(root.layer.style.transform, root.camera.style.transform, 'слой и сцена едут одинаково');
  assert.equal(root.layer.style.overflow, undefined, 'HTML layers do not inherit SVG overflow handling');
});

test('#531 AC2: по истечении бюджета viewBox пишется один раз, трансформ снимается', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null, { now: 0 });
  anchor = paintLiveViewport(root, painted, frame(10, 0), anchor, { now: 50 });
  const before = root.camera.writes;
  anchor = paintLiveViewport(root, painted, frame(20, 0), anchor, { now: 100 });
  assert.equal(root.camera.writes, before + 1, 'ровно одна перезапись');
  assert.equal(root.camera.attrs.viewBox, '20 0 1000 500');
  assert.equal(root.camera.style.transform, undefined, 'сцена вернулась в тождество');
  assert.equal(root.camera.style.overflow, undefined, 'refresh removes temporary scene overflow');
  assert.equal(root.cameraPeer.style.overflow, undefined, 'refresh cleans every camera scene');
  assert.equal(root.floor.style.overflow, undefined, 'refresh cleans the floor scene');
  assert.ok(root.layer.style.transform, 'слой по-прежнему спроецирован от осевшего кадра');
});

test('#531 AC2а: рывок переписывает viewBox сразу, не дожидаясь бюджета времени', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null, { now: 0 });
  const before = root.camera.writes;
  // 14 % видимой ширины — меньше порога: едем трансформом.
  anchor = paintLiveViewport(root, painted, frame(140, 0), anchor, { now: 5 });
  assert.equal(root.camera.writes, before, 'ниже порога сдвига — без перезаписи');
  // 15 % — порог достигнут, время не истекло.
  anchor = paintLiveViewport(root, painted, frame(150, 0), anchor, { now: 10 });
  assert.equal(root.camera.writes, before + 1);
  assert.equal(root.camera.attrs.viewBox, '150 0 1000 500');
});

test('#531 AC3: повторная покраска тем же кадром не пишет в DOM ничего', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, frame(10, 0), null, { now: 0 });
  const writes = root.camera.writes + root.floor.writes;
  const styles = root.camera.styleWrites + root.floor.styleWrites + root.layer.styleWrites;
  anchor = paintLiveViewport(root, painted, frame(10, 0), anchor, { now: 1 });
  assert.equal(root.camera.writes + root.floor.writes, writes, 'атрибуты не переписаны');
  assert.equal(
    root.camera.styleWrites + root.floor.styleWrites + root.layer.styleWrites, styles,
    'стили не переписаны',
  );
});

test('#531 AC4: терминальное примирение пишет окончательный viewBox и снимает трансформы', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, frame(30, 0), null, { now: 0 });
  anchor = paintLiveViewport(root, painted, frame(60, 0), anchor, { now: 10 });
  const settled = frame(60, 0);
  anchor = paintLiveViewport(root, settled, settled, anchor, { now: 20, force: true });
  assert.equal(root.camera.attrs.viewBox, '60 0 1000 500');
  assert.equal(root.camera.style.transform, undefined);
  assert.equal(root.camera.style.overflow, undefined);
  assert.equal(root.cameraPeer.style.overflow, undefined);
  assert.equal(root.floor.style.overflow, undefined);
  assert.equal(root.layer.style.transform, undefined);
  const writes = root.camera.writes;
  paintLiveViewport(root, settled, settled, anchor, { now: 21, force: true });
  assert.equal(root.camera.writes, writes, 'повторное примирение ничего не пишет');
});

// Наблюдение ревьюера r1: во всех кадрах выше `floor === view`, то есть
// изометрия, ради которой проекции и считаются раздельно, ни одним свидетелем
// не тронута. Здесь виды камеры и пола расходятся и по сдвигу, и по масштабу.
const isoFrame = (x, y, floorX, floorW) => ({
  view: { x, y, w: 1000, h: 500 },
  floor: { x: floorX, y: y / 2, w: floorW, h: 400 },
  zoom: 1,
});

test('#531 изометрия: камера и пол проецируются раздельно и оседают вместе', () => {
  const root = fakeRoot();
  const painted = isoFrame(0, 0, 0, 800);
  let anchor = paintLiveViewport(root, painted, painted, null, { now: 0 });
  anchor = paintLiveViewport(root, painted, isoFrame(100, 40, 60, 800), anchor, { now: 10 });
  assert.equal(root.camera.style.transform, 'translate(-10%,-8%) scale(1,1)');
  assert.equal(root.floor.style.transform, 'translate(-7.5%,-5%) scale(1,1)');
  assert.notEqual(root.camera.style.transform, root.floor.style.transform,
    'у пола свой вид, и подменять его видом камеры нельзя');
  anchor = paintLiveViewport(root, painted, isoFrame(200, 80, 120, 800), anchor, { now: 200 });
  assert.equal(root.camera.attrs.viewBox, '200 80 1000 500');
  assert.equal(root.floor.attrs.viewBox, '120 40 800 400');
  assert.equal(root.camera.style.transform, undefined);
  assert.equal(root.floor.style.transform, undefined);
});
