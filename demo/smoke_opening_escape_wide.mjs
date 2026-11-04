/** #1278: visible Properties must not consume an active opening's Escape. */
import assert from 'node:assert/strict';
import { launch, finish } from './serve.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';

const config = currentGraphFixture({ spaces: [{ id: 'f1', title: 'Opening Escape',
  rooms: [{ id: 'room', name: 'Room', poly: [[.1,.1],[.9,.1],[.9,.8],[.1,.8]], wall_thickness_cm: 15 }],
  openings: [{ id: 'opening', type: 'window', x: .3, y: .1, angle: 0, length: .1 }],
}], markers: [], settings: { filter_seeded: true } });
const { page, browser } = await launch({ width: 2000, height: 1000 });
try {
  await prepareDesktopControls(page);
  await page.evaluate(async config => {
    const hp = window.__hpTest, card = window.__card;
    await hp.setServerConfig(config); await hp.switchSpace('f1');
    await hp.setMode('plan'); await hp.setTool('select'); await hp.waitForWrites();
    window.__openingEscapeWrites = [];
    const call = card.hass.callWS.bind(card.hass);
    card.hass = { ...card.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') window.__openingEscapeWrites.push(structuredClone(message));
      return call(message);
    } };
  }, config);
  const settle = async () => {
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._cameraTransition.active);
    await page.evaluate(() => window.__hpTest.settled());
  };
  await settle();
  const sample = () => page.evaluate(() => {
    const c = window.__card;
    return { config: c._serverCfg, writes: window.__openingEscapeWrites.length,
      history: c._geometryHistory.size, drag: !!c._opDrag, moved: !!c._opDrag?.moved,
      properties: c._editorRuntime.properties.identity?.kind };
  });
  const point = x => page.evaluate(x => {
    const m = window.__card.renderRoot.querySelector('.plan-svg').getScreenCTM();
    const p = new DOMPoint(x, 100).matrixTransform(m); return { x:p.x, y:p.y };
  }, x);
  const begin = async () => {
    const a = await point(300), b = await point(450);
    await page.mouse.move(a.x,a.y); await page.mouse.down();
    await page.mouse.move(b.x,b.y,{steps:5}); await settle();
    const held = await sample(); assert.equal(held.drag,true); assert.equal(held.moved,true);
    assert.equal(held.properties,'opening','the visible opening Properties owns selection');
  };
  const before = await sample();
  await begin();
  await page.keyboard.press('Escape'); await settle();
  const escaped = await sample();
  assert.equal(escaped.drag,false,'Escape retires the gesture before pointerup');
  for (const key of ['config','writes','history']) assert.deepEqual(escaped[key],before[key],key);
  await page.mouse.up(); await settle();
  const released = await sample();
  for (const key of ['config','writes','history']) assert.deepEqual(released[key],before[key],`late up ${key}`);
  await begin(); await page.mouse.up();
  await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
  const accepted = await sample();
  assert.equal(accepted.writes,before.writes+1); assert.equal(accepted.history,before.history+1);
  assert.notDeepEqual(accepted.config,before.config,'the next deliberate gesture can still commit');
} finally { await finish(browser,{}); }
