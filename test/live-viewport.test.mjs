import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isIdentityLiveLayerProjection,
  liveLayerProjection,
  liveViewBoxText,
  authoredHouseplanViewport,
  liveGridBounds,
  paintLiveViewport, scheduleHouseplanViewport, commitHouseplanViewport, paintedHouseplanViewBox, disposeHouseplanViewport,
} from '../test-build/live-viewport.js';
import { exposureClip, forecastExposure, viewportExposure, viewportNeedsAnchor } from '../test-build/viewport-exposure.js';
import { rasterCovers, rasterSize } from '../test-build/iso-camera-raster.js';

test('#1478 each raster buffer has a fixed pixel ceiling, even at 4K/DPR 2', () => {
  assert.deepEqual(rasterSize({ stageSize: [1280, 720], dpr: 1 }), [1280, 720]);
  const [width, height] = rasterSize({ stageSize: [3840, 2160], dpr: 2 });
  assert.ok(width * height <= 1_200_000);
  assert.ok(Math.abs(width / height - 3840 / 2160) < .01);
});

test('#1478 a pending raster may hide the SVG only when it covers all visible plan content', () => {
  const bounds = { x: 5, y: 5, w: 50, h: 50 };
  const content = { x: 0, y: 0, w: 55, h: 55 };
  assert.equal(rasterCovers(bounds, { x: 20, y: 20, w: 60, h: 60 }, content), true);
  assert.equal(rasterCovers(bounds, { x: 4, y: 4, w: 60, h: 60 }, content), false);
  assert.equal(rasterCovers(bounds, { x: 60, y: 60, w: 60, h: 60 }, content), true);
});

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
      attrs: { ...attrs }, writes: 0, styleWrites: 0, styleRemovals: [],
      getAttribute: (name) => (name in el.attrs ? el.attrs[name] : null),
      setAttribute: (name, value) => { el.attrs[name] = value; el.writes += 1; },
      style: new Proxy({ _v: {} }, {
        get: (target, key) => {
          if (key === 'removeProperty') return (name) => {
            const camel = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
            delete target._v[camel];
            el.styleRemovals.push(name);
            el.styleWrites += 1;
          };
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
  const inherited = node({ viewBox: '0 0 1000 500' });
  const grid = node({});
  return {
    camera, cameraPeer, floor, layer, inherited, grid,
    querySelectorAll: (selector) => {
      if (selector.includes('data-hp-live-grid')) return [grid];
      if (selector.includes('live-inherited-scene')) return [inherited];
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

test('#1397 screen-space dimensions paint after the same immediate/coalesced camera frame',t=>{
  const oldRaf=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  const queued=new Map();let id=0;
  globalThis.requestAnimationFrame=callback=>{queued.set(++id,callback);return id;};
  globalThis.cancelAnimationFrame=key=>queued.delete(key);
  const root=fakeRoot(),seen=[],host={renderRoot:root,_zoom:1,view:frame(0,0).view,
    _baseVb:()=>[0,0,1000,500],_viewOr:()=>host.view,_floorView:view=>view,
    _editorRuntime:{wallDimensions:{paintCamera:view=>seen.push({view:{...view},projection:root.layer.style.transform})}}};
  t.after(()=>{disposeHouseplanViewport(host);globalThis.requestAnimationFrame=oldRaf;globalThis.cancelAnimationFrame=oldCancel;});
  commitHouseplanViewport(host);
  host.view=frame(30,20).view;scheduleHouseplanViewport(host,true);
  assert.deepEqual(seen,[{view:host.view,projection:'translate(-3%,-4%) scale(1,1)'}]);
  host.view=frame(40,30).view;scheduleHouseplanViewport(host);
  host.view=frame(60,40).view;scheduleHouseplanViewport(host);
  assert.equal(queued.size,1);assert.equal(seen.length,1,'no independent measurement timer');
  const [key,paint]=[...queued][0];queued.delete(key);paint();
  assert.deepEqual(seen.at(-1),{view:host.view,projection:'translate(-6%,-8%) scale(1,1)'});
  assert.equal(seen.length,2,'only the latest coalesced camera is projected');
  host.view=frame(70,45).view;scheduleHouseplanViewport(host);disposeHouseplanViewport(host);
  assert.equal(queued.size,0,'a retired camera cannot repaint dimensions later');
});

test('#1081 grid exposure covers incoming edges and changes with its anchor', () => {
  const root = fakeRoot(), painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null);
  assert.deepEqual(liveGridBounds(painted.view), { x: -500, y: -250, w: 2000, h: 1000 });
  const writes = root.grid.writes;
  anchor = paintLiveViewport(root, painted, frame(100, 40), anchor);
  assert.equal(root.grid.writes, writes, 'no grid mutation on each lightweight camera move');
  const bounds = root.grid.attrs;
  assert.ok(Number(bounds.x) <= 100 && Number(bounds.x) + Number(bounds.width) >= 1100);
  anchor = paintLiveViewport(root, painted, frame(-700, 150, 500, 250), anchor);
  assert.equal(root.grid.attrs.x, '-950'); assert.equal(root.grid.attrs.width, '1000');
  const refreshed = root.grid.writes;
  paintLiveViewport(root, painted, frame(-700, 150, 500, 250), anchor);
  assert.equal(root.grid.writes, refreshed, 'quiet grid writes nothing');
});

test('#1070 rotated viewport refresh keeps the SVG in display coordinates and grid coverage in plan coordinates', () => {
  const root = fakeRoot();
  const rotated = { view: { x:500,y:100,w:300,h:600 }, floor: { x:500,y:100,w:300,h:600 },
    grid: { x:100,y:200,w:600,h:300 }, zoom:1 };
  paintLiveViewport(root, rotated, rotated, null, {  force:true });
  assert.equal(root.floor.attrs.viewBox, '500 100 300 600');
  assert.deepEqual(root.grid.attrs, { x:'-200',y:'50',width:'1200',height:'600' });
});

test('#871 passive nested scene inherits one camera and rebases only a bounded paint window', () => {
  const root=fakeRoot(); const painted=frame(0,0);
  let anchor=paintLiveViewport(root,painted,painted,null);
  anchor=paintLiveViewport(root,painted,frame(35,0),anchor,{ keepSceneLayer:true});
  assert.equal(root.inherited.attrs.viewBox,'0 0 1000 500');
  assert.equal(root.inherited.style.transform,undefined,'not a second camera');
  assert.equal(root.inherited.style.clipPath,'inset(-50% -50% -50% -50%)');
  const writes=root.inherited.styleWrites;
  anchor=paintLiveViewport(root,painted,frame(70,10),anchor,{ keepSceneLayer:true});
  assert.equal(root.inherited.styleWrites,writes,'clip stays on the current anchor');
  anchor=paintLiveViewport(root,painted,frame(350,60,500,250),anchor,{ keepSceneLayer:true});
  assert.equal(root.inherited.attrs.viewBox,'0 0 1000 500','HTML Lit basis is immutable');
  assert.equal(root.inherited.style.clipPath,exposureClip(painted.view,anchor.coverage));
  paintLiveViewport(root,frame(350,60,500,250),frame(350,60,500,250),anchor,{ force:true});
  assert.equal(root.inherited.style.clipPath,undefined,'terminal paint restores idle DOM');
});

test('#531 AC1: кадр жеста двигает сцену трансформом и не трогает viewBox', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null);
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

test('#1478 incoming plan content moves the anchor and the exact frame removes the transform', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null);
  anchor = paintLiveViewport(root, painted, frame(10, 0), anchor);
  const before = root.camera.writes;
  anchor = paintLiveViewport(root, painted, frame(415, 0), anchor);
  assert.equal(root.camera.writes, before + 1, 'ровно одна перезапись');
  assert.equal(root.camera.attrs.viewBox, '415 0 1000 500');
  assert.equal(root.camera.style.transform, undefined, 'сцена вернулась в тождество');
  assert.equal(root.camera.style.overflow, undefined, 'refresh removes temporary scene overflow');
  assert.equal(root.cameraPeer.style.overflow, undefined, 'refresh cleans every camera scene');
  assert.equal(root.floor.style.overflow, undefined, 'refresh cleans the floor scene');
  assert.ok(root.layer.style.transform, 'слой по-прежнему спроецирован от осевшего кадра');
});

test('#579 a live session keeps one promoted scene layer across budget refreshes', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null, {  keepSceneLayer: true,
  });
  const scenes = [root.camera, root.cameraPeer, root.floor];
  for (const scene of scenes) {
    assert.equal(scene.style.transform, 'translate(0%,0%) scale(1,1)');
    assert.equal(scene.style.transformOrigin, '0 0');
    assert.equal(scene.style.willChange, 'transform');
    assert.equal(scene.style.overflow, 'visible');
  }

  anchor = paintLiveViewport(root, painted, frame(10, 0), anchor, {  keepSceneLayer: true,
  });
  const removalsBeforeRefresh = scenes.map((scene) => scene.styleRemovals.length);
  const viewBoxWritesBeforeRefresh = root.camera.writes;
  anchor = paintLiveViewport(root, painted, frame(415, 0), anchor, {  keepSceneLayer: true,
  });
  assert.equal(root.camera.writes, viewBoxWritesBeforeRefresh + 1, 'one reserve-boundary refresh lands');
  for (const [index, scene] of scenes.entries()) {
    assert.equal(scene.style.transform, 'translate(0%,0%) scale(1,1)');
    assert.equal(scene.style.transformOrigin, '0 0');
    assert.equal(scene.style.willChange, 'transform');
    assert.equal(scene.style.overflow, 'visible');
    assert.equal(scene.styleRemovals.length, removalsBeforeRefresh[index],
      'refresh may not demote and re-promote the SVG');
  }

  const styleWrites = scenes.reduce((sum, scene) => sum + scene.styleWrites, 0);
  anchor = paintLiveViewport(root, painted, frame(415, 0), anchor, {  keepSceneLayer: true,
  });
  assert.equal(scenes.reduce((sum, scene) => sum + scene.styleWrites, 0), styleWrites,
    'an unchanged promoted frame writes no style');

  const settled = frame(415, 0);
  paintLiveViewport(root, settled, settled, anchor, {  force: true });
  for (const scene of scenes) {
    assert.equal(scene.style.transform, undefined);
    assert.equal(scene.style.transformOrigin, undefined);
    assert.equal(scene.style.willChange, undefined);
    assert.equal(scene.style.overflow, undefined);
  }
});

test('#1478 a quiet or small pan keeps the authored viewBox across frames', () => {
  const root = fakeRoot(), painted = frame(0, 0);
  const anchor = paintLiveViewport(root, painted, painted);
  const before = root.camera.writes;
  for (let position = 1; position <= 250; position++) {
    assert.equal(paintLiveViewport(root, painted, frame(position, 0), anchor), anchor);
  }
  assert.equal(root.camera.writes, before);
});

test('#531 AC3: повторная покраска тем же кадром не пишет в DOM ничего', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, frame(10, 0), null);
  const writes = root.camera.writes + root.floor.writes;
  const styles = root.camera.styleWrites + root.floor.styleWrites + root.layer.styleWrites;
  anchor = paintLiveViewport(root, painted, frame(10, 0), anchor);
  assert.equal(root.camera.writes + root.floor.writes, writes, 'атрибуты не переписаны');
  assert.equal(
    root.camera.styleWrites + root.floor.styleWrites + root.layer.styleWrites, styles,
    'стили не переписаны',
  );
});

test('#531 AC4: терминальное примирение пишет окончательный viewBox и снимает трансформы', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, frame(30, 0), null);
  anchor = paintLiveViewport(root, painted, frame(60, 0), anchor);
  const settled = frame(60, 0);
  anchor = paintLiveViewport(root, settled, settled, anchor, {  force: true });
  assert.equal(root.camera.attrs.viewBox, '60 0 1000 500');
  assert.equal(root.camera.style.transform, undefined);
  assert.equal(root.camera.style.overflow, undefined);
  assert.equal(root.cameraPeer.style.overflow, undefined);
  assert.equal(root.floor.style.overflow, undefined);
  assert.equal(root.layer.style.transform, undefined);
  const writes = root.camera.writes;
  paintLiveViewport(root, settled, settled, anchor, {  force: true });
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
  let anchor = paintLiveViewport(root, painted, painted, null);
  anchor = paintLiveViewport(root, painted, isoFrame(100, 40, 60, 800), anchor);
  assert.equal(root.camera.style.transform, 'translate(-10%,-8%) scale(1,1)');
  assert.equal(root.floor.style.transform, 'translate(-7.5%,-5%) scale(1,1)');
  assert.notEqual(root.camera.style.transform, root.floor.style.transform,
    'у пола свой вид, и подменять его видом камеры нельзя');
  anchor = paintLiveViewport(root, painted, isoFrame(450, 80, 270, 800), anchor);
  assert.equal(root.camera.attrs.viewBox, '450 80 1000 500');
  assert.equal(root.floor.attrs.viewBox, '270 40 800 400');
  assert.equal(root.camera.style.transform, undefined);
  assert.equal(root.floor.style.transform, undefined);
});

// #689. Unbounded `overflow: visible` let a projected scene layer grow with
// zoom² (CDP LayerTree, ~460 %: plan-svg 15.9× and the day-cycle outline
// 13.2× the stage); at 800 % × DPR 2 that is hundreds of MB of GPU memory
// and the page flashed white. The exposure is bounded and leaves with it.
test('#689 AC3: exposure is bounded by a clip that leaves together with it', () => {
  const root = fakeRoot();
  const painted = frame(0, 0);
  let anchor = paintLiveViewport(root, painted, painted, null);
  anchor = paintLiveViewport(root, painted, frame(10, 0), anchor);
  for (const scene of [root.camera, root.cameraPeer, root.floor]) {
    assert.equal(scene.style.overflow, 'visible', 'the incoming edge is still exposed (#544)');
    assert.equal(scene.style.clipPath, 'inset(-50% -50% -50% -50%)', 'but only within the bound');
  }
  assert.equal(root.layer.style.clipPath, undefined, 'HTML layers get no scene clip');
  paintLiveViewport(root, painted, painted, anchor, {  force: true });
  for (const scene of [root.camera, root.cameraPeer, root.floor]) {
    assert.equal(scene.style.overflow, undefined, 'idle DOM keeps no exposure (#531)');
    assert.equal(scene.style.clipPath, undefined, 'idle DOM keeps no clip (#531)');
    assert.equal(scene.style.transform, undefined);
    assert.ok(scene.styleRemovals.includes('clip-path'));
  }
});

test('#1344 camera frames preserve the opacity owner promotion until terminal cleanup', () => {
  const root = fakeRoot(), painted = frame(0, 0);
  for (const svg of [root.camera, root.cameraPeer, root.floor]) svg.style.willChange = 'transform, opacity';
  let anchor = paintLiveViewport(root, painted, painted, null, { keepSceneLayer:true});
  const writes = root.camera.styleWrites;
  anchor = paintLiveViewport(root, painted, painted, anchor, { keepSceneLayer:true});
  assert.equal(root.camera.style.willChange, 'transform, opacity');
  assert.equal(root.camera.styleWrites, writes, 'no promotion ping-pong on an unchanged frame');
  paintLiveViewport(root, painted, painted, anchor, { force:true});
  assert.equal(root.camera.style.willChange, undefined);
  assert.equal(root.camera.style.transform, undefined);
});

test('#1344 bounded mode exposure stays quiet and is removed at the terminal commit', () => {
  const root=fakeRoot(),painted=frame(0,0),clip='inset(-25% -34%)';
  let anchor=paintLiveViewport(root,painted,painted,null,{ keepSceneLayer:true,sceneExposureClip:clip});
  assert.equal(root.camera.style.clipPath,clip);
  const writes=root.camera.styleWrites;
  anchor=paintLiveViewport(root,painted,painted,anchor,{ keepSceneLayer:true,sceneExposureClip:clip});
  assert.equal(root.camera.styleWrites,writes);
  paintLiveViewport(root,painted,painted,anchor,{ force:true});
  assert.equal(root.camera.style.clipPath,undefined);
});

test('#1344 mode completion reads the actual HTML baseline after a mid-motion commit', () => {
  const root=fakeRoot();
  let view={x:0,y:0,w:1000,h:500};
  const host={renderRoot:root,_zoom:1,_baseVb:()=>[],_viewOr:()=>view,_floorView:v=>v};
  commitHouseplanViewport(host);
  assert.deepEqual(paintedHouseplanViewBox(host),view);
  view={x:0,y:.5,w:1000,h:500};
  commitHouseplanViewport(host,true);
  const captured=paintedHouseplanViewBox(host);
  assert.deepEqual(captured,view);
  captured.y=999;
  assert.equal(paintedHouseplanViewBox(host).y,.5,'reader cannot change the owner baseline');
  disposeHouseplanViewport(host);
  assert.equal(paintedHouseplanViewBox(host),null);
});

test('#1344 mode raster retains its own clip and locks the anchor against a large move', () => {
  const root=fakeRoot(),painted=frame(0,0);
  let anchor=paintLiveViewport(root,painted,painted,null,{ force:true,keepSceneLayer:true});
  const writes=root.camera.writes;
  const moved=frame(0,220);
  anchor=paintLiveViewport(root,painted,moved,anchor,{ keepSceneLayer:true,lockSceneAnchor:true,sceneExposureClip:'inset(-25%)'});
  assert.equal(root.camera.writes,writes,'mode uses its precomputed bounded exposure without repainting SVG');
  assert.notEqual(root.camera.style.transform,undefined);
  anchor=paintLiveViewport(root,painted,moved,anchor,{ force:true});
  assert.equal(root.camera.attrs.viewBox,'0 220 1000 500','terminal commit still publishes exact coordinates');
  assert.equal(root.camera.style.transform,undefined);
  assert.equal(root.camera.style.clipPath,undefined);
  paintLiveViewport(root,moved,frame(0,450),anchor);
  assert.equal(root.camera.attrs.viewBox,'0 450 1000 500','an ordinary gesture renews coverage when needed');
});

test('#1478 coverage includes the camera and fits the device-pixel budget', () => {
  const view = frame(0, 0).view;
  const coverage = viewportExposure(view, { pixelArea: 16_000_000 });
  assert.ok(coverage.w >= view.w && coverage.h >= view.h);
  assert.ok(16_000_000 * coverage.w * coverage.h / view.w / view.h <= 32_000_001);
  assert.deepEqual(viewportExposure(view, { pixelArea: 40_000_000 }), view);
});

test('#1478 a vacant edge never forces a repaint, but an expanding camera anticipates ink', () => {
  const view = frame(0, 0).view;
  const limits = { content: { x: -420, y: 40, w: 1320, h: 400 } };
  const coverage = viewportExposure(view, limits);
  const emptySide = frame(190, 0).view;
  assert.equal(viewportNeedsAnchor(view, coverage, emptySide, limits), false);
  const horizon = viewportExposure(view, {});
  const target = frame(-320, -15, 1400, 700).view;
  assert.equal(viewportNeedsAnchor(view, horizon, view, {}), false);
  assert.equal(viewportNeedsAnchor(view, horizon, view, {}, forecastExposure(view, target)), true);
});

test('#1478 Lit updates during camera motion retain the published basis', () => {
  const root = fakeRoot();
  const initial = frame(0, 0).view;
  let view = initial;
  const host = { renderRoot: root, _zoom: 1, _baseVb: () => [], _viewOr: () => view, _floorView: v => v };
  authoredHouseplanViewport(host, view, 'floor', false);
  commitHouseplanViewport(host);
  const writes = root.camera.writes;
  view = frame(100, 10).view;
  assert.deepEqual(authoredHouseplanViewport(host, view, 'floor', true), initial);
  commitHouseplanViewport(host, true);
  assert.equal(root.camera.writes, writes);
  assert.equal(root.layer.style.transform, 'translate(-10%,-2%) scale(1,1)');
  assert.deepEqual(authoredHouseplanViewport(host, view, 'floor', false), view);
  commitHouseplanViewport(host);
  assert.equal(root.camera.attrs.viewBox, '100 10 1000 500');
  disposeHouseplanViewport(host);
});

test('#1478 an exact mode endpoint does not promote HTML from an earlier authored viewport', () => {
  const root = fakeRoot();
  let view = frame(0, 0).view;
  const host = { renderRoot: root, _zoom: 1, _baseVb: () => [], _viewOr: () => view, _floorView: v => v,
    _modeSceneClip: 'inset(0)' };
  authoredHouseplanViewport(host, view, 'floor', false);
  commitHouseplanViewport(host);
  view = frame(100, 10, 800, 400).view;
  commitHouseplanViewport(host);
  assert.equal(root.camera.attrs.viewBox, '100 10 800 400');
  assert.ok(!root.layer.style.transform);
  assert.ok(!root.layer.style.willChange);
  disposeHouseplanViewport(host);
});

test('#1478 scene and marker anchors rebase together without restarting their visual layers', () => {
  const root = fakeRoot(), initial = frame(0, 0);
  const marker = { style: { left: '40%', top: '25%' } };
  root.layer.querySelectorAll = selector => selector.includes('roomlabel') ? [marker] : [];
  root.layer.style['--icon-size'] = '2.5cqw';
  root.layer.style.getPropertyValue = name => root.layer.style[name] || '';
  root.layer.style.setProperty = (name, value) => { root.layer.style[name] = value; };
  const options = { keepSceneLayer: true, keepMarkerLayer: true };
  let anchor = paintLiveViewport(root, initial, initial, null, options);
  const closer = frame(200, 100, 500, 250);
  anchor = paintLiveViewport(root, initial, closer, anchor, options);
  assert.deepEqual(anchor.markerView, closer.view);
  assert.equal(root.camera.attrs.viewBox, '200 100 500 250');
  assert.equal(root.inherited.attrs.viewBox, root.camera.attrs.viewBox);
  assert.deepEqual(marker.style, { left: '40%', top: '10%' });
  assert.equal(root.layer.style['--icon-size'], '5cqw');
  assert.equal(root.layer.style.willChange, 'transform');

  const nearby = frame(205, 100, 500, 250);
  paintLiveViewport(root, initial, nearby, anchor, options);
  assert.deepEqual(marker.style, { left: '40%', top: '10%' });
  assert.equal(root.layer.style.transform, root.camera.style.transform);
  assert.equal(root.camera.attrs.viewBox, '200 100 500 250');
});

test('#1478 prepares a reachable zoom-out target without changing the visible camera', () => {
  const root = fakeRoot(), initial = frame(0, 0);
  root.layer.style.getPropertyValue = () => '';
  const options = { keepSceneLayer: true, keepMarkerLayer: true };
  const first = paintLiveViewport(root, initial, initial, null, options);
  const target = frame(-465, -50, 1150, 575).view;
  const current = { ...frame(-350, 0), target };
  const next = paintLiveViewport(root, initial, current, first, options);
  assert.deepEqual(next.frame.view, target);
  assert.equal(root.camera.attrs.viewBox, '-465 -50 1150 575');
  assert.equal(root.camera.style.transform, 'translate(-11.5%,-10%) scale(1.15,1.15)');
  assert.equal(root.layer.style.transform, root.camera.style.transform);
  const writes = root.camera.writes;
  paintLiveViewport(root, initial, { ...frame(-465, -50, 1150, 575), target }, next, options);
  assert.equal(root.camera.writes, writes);
});
