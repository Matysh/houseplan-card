// #1070 AC7: the same real mouse gestures save the same canonical geometry at 0/90°.
import assert from 'node:assert/strict';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { createFixtureStore } from './srv/fixture-state.js';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';
requirePinnedBrowser();
const initial = commitWallSegmentModel({ spaces: [{ id: 'rotate-editor', title: 'Canonical editing', cell_cm: 5,
  view_box: [0,0,1,1], rooms: [{ id: 'room', name: 'Room', area: null,
    poly: [[.05,.05],[.95,.05],[.95,.95],[.05,.95]] }],
  partitions: [{ id: 'node-wall', a: [.2,.4], b: [.6,.4], cm: 25 }], decor: [] }],
  markers: [{ id: 'moving', binding: 'virtual', space: 'rotate-editor', name: 'Moving', icon: 'mdi:home' }],
  settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
let store, nodeWrites;
const { page, browser } = await launch({ width: 1200, height: 1050 });
const card = page.locator('houseplan-card');
await page.emulateMedia({ reducedMotion: 'reduce' });
// Wire-only fixture: retain real CAS and the canonical node transaction used by
// the existing #803 browser fixture; no gesture or coordinate method is replaced.
await page.exposeFunction('rotationEditorWire', message => {
  if (message.type === 'houseplan/config/get') return { ...store.handle(message), wall_node_move_api: 1 };
  if (message.type === 'houseplan/wall/node_move') {
    const saved = store.handle({ type: 'houseplan/config/get' });
    assert.equal(message.expected_rev, saved.rev);
    const source = saved.config.spaces[0], nodes = structuralWallNodes(source);
    const node = nodes.find(n => Math.hypot(n.point[0] - message.intent.point[0], n.point[1] - message.intent.point[1]) < 1e-8);
    const moved = applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids), message.intent.target, message.intent.axis);
    assert.equal(moved.ok, true);
    const config = commitWallSegmentModel({ ...saved.config, spaces: [moved.space] }).config;
    const rev = store.pushConfig(config); nodeWrites.push(structuredClone(message));
    return { config, rev, ok: true };
  }
  return store.handle(message) ?? null;
});
const wait = async () => {
  await page.waitForFunction(() => { const c = window.__card; return !c._booting && !c._bootSoft && !c._modeTransitionBusy && !c._cameraTransition.active && !c._refitRaf && !c._pendingRefitSize; });
  await page.evaluate(async () => { await window.__hpTest.waitForWrites(); await window.__hpTest.settled(); });
};
const point = (x, y) => card.locator('.decorlayer').evaluate((ink, p) => {
  const result = new DOMPoint(p[0], p[1]).matrixTransform(ink.getScreenCTM()); return { x: result.x, y: result.y };
}, [x,y]);
const click = async (x,y) => { const p = await point(x,y); await page.mouse.click(p.x,p.y); };
const drag = async (a,b) => { await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{steps:8}); await page.mouse.up(); await wait(); };
const center = async locator => { const r = await locator.boundingBox(); return {x:r.x+r.width/2,y:r.y+r.height/2}; };
const results = [];
try {
  for (const rotation of [0,90]) {
    store = createFixtureStore(initial, { moving: { s: 'rotate-editor', x:.4, y:.65 } }); nodeWrites = [];
    await page.evaluate(rotation => {
      const old = window.__card, hass = window.__mkHass(), original = hass.callWS;
      hass.devices = {}; hass.entities = {}; hass.states = {}; hass.connection = { ...hass.connection };
      hass.callWS = async message => message.type.endsWith('registry/list') ? []
        : await window.rotationEditorWire(message) ?? original(message);
      const c = document.createElement('houseplan-card'); c.setConfig({type:'custom:houseplan-card',rotation});
      old.remove(); document.getElementById('host').append(c); window.__card = c; c.hass = hass;
    }, rotation);
    await wait();
    await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('draw'); }); await wait();
    await click(650,750); await click(850,750); await page.keyboard.press('Escape'); await wait();
    const afterDraw = store.handle({ type:'houseplan/config/get' }).config.spaces[0];
    const drawn = afterDraw.partitions.find(wall => wall.id !== 'node-wall');
    check(`wall drawing at ${rotation} saves a real segment`, !!drawn && drawn.a[1] === .75 && drawn.b[1] === .75);
    await page.evaluate(() => window.__hpTest.setTool('select')); await wait();
    const node = card.locator('.hp-node-handle[cx="200"][cy="400"]');
    await drag(await center(node), await point(250,500));
    await page.waitForFunction(() => window.__card.renderRoot.querySelector('.hp-node-handle[cx="250"][cy="500"]'));
    check(`native node move at ${rotation} saves one canonical transaction`, nodeWrites.length === 1
      && Math.abs(nodeWrites[0].intent.target[0] - .25) < 1e-8 && Math.abs(nodeWrites[0].intent.target[1] - .5) < 1e-8);
    await page.evaluate(() => window.__hpTest.setMode('devices')); await wait();
    const device = card.locator('[data-hp="device"][data-id="moving"]');
    await drag(await center(device), await point(500,700));
    const layout = store.handle({type:'houseplan/layout/get'}).layout.moving;
    check(`device drag at ${rotation} saves the intended canonical point`, Math.abs(layout.x - .5) < .0002 && Math.abs(layout.y - .7) < .0002);
    const nudgeBefore = await center(device);
    await page.keyboard.press('ArrowRight'); await wait();
    const nudgeAfter = await center(device);
    check(`keyboard right at ${rotation} moves right on screen`, nudgeAfter.x > nudgeBefore.x + 1 && Math.abs(nudgeAfter.y - nudgeBefore.y) < 1);
    await page.evaluate(async () => { await window.__hpTest.setMode('decor'); await window.__hpTest.setTool('rect'); }); await wait();
    await drag(await point(500,650), await point(600,750));
    const saved = store.handle({type:'houseplan/config/get'}).config.spaces[0];
    const shape = saved.decor.find(shape => shape.kind === 'rect');
    check(`decor creation at ${rotation} saves a canonical rectangle`, !!shape && Math.abs(shape.x-.5)<1e-8 && Math.abs(shape.y-.65)<1e-8
      && Math.abs(shape.w-.1)<1e-8 && Math.abs(shape.h-.1)<1e-8);
    results.push({ wall: {a:drawn.a,b:drawn.b,cm:drawn.cm}, node: nodeWrites[0].intent.target, device: {x:layout.x,y:layout.y},
      decor: {x:shape.x,y:shape.y,w:shape.w,h:shape.h} });
  }
  check('wall/node/decor gestures store identical numbers with and without a quarter turn', JSON.stringify({...results[0],device:null}) === JSON.stringify({...results[1],device:null}));
  check('device drag differs by less than native subpixel precision', Math.abs(results[0].device.x-results[1].device.x)<.0002
    && Math.abs(results[0].device.y-results[1].device.y)<.0002);
} finally { await browser.close(); finish(); }
