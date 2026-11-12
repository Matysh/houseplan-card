/** #1024: native parent/nested forms, persisted writer and current live state. */
import assert from 'node:assert/strict';
import { launch, finish } from './serve.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
import { wallKey } from '../test-build/wall-thickness.js';

const poly = [[.1,.1],[.9,.1],[.9,.8],[.1,.8]];
const config = currentGraphFixture({ spaces: [{ id: 'f1', title: 'Opening features', cell_cm: 5,
  rooms: [{ id: 'room', name: 'Room', poly }],
  walls: poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; return { a, b, cm:20, key:wallKey(a,b,1/240) }; }),
  openings: [{ id: 'window', type: 'window', x: .4, y: .1, angle: 0, length: .2 },
    { id: 'door', type: 'door', x: .4, y: .8, angle: 0, length: .1 }],
}], markers: [], settings: { filter_seeded: true } });
const { page, browser } = await launch({ width: 1600, height: 1100 });
page.setDefaultTimeout(10000);
try {
  await prepareDesktopControls(page);
  await page.evaluate(async config => {
    const c = window.__card, call = c.hass.callWS.bind(c.hass);
    window.__featureWrites = [];
    window.__featureApi = 1;
    c.hass = { ...c.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') window.__featureWrites.push(structuredClone(message));
      const response = await call(message);
      return message.type === 'houseplan/config/get' ? { ...response, opening_features_api: window.__featureApi } : response;
    } };
    await window.__hpTest.setServerConfig(config);
    await window.__hpTest.switchSpace('f1');
    await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select');
    await window.__hpTest.waitForWrites();
    window.__featureWrites = [];
  }, config);
  const card = page.locator('houseplan-card');
  const dialog = () => card.locator('hp-dialog[data-kind="opening"]');
  const settle = () => page.evaluate(() => window.__hpTest.settled());
  const writes = () => page.evaluate(() => window.__featureWrites.length);
  const saved = () => page.evaluate(() => structuredClone(window.__card._serverCfg.spaces.find(s => s.id === 'f1').openings));
  const open = async y => {
    const point = await page.evaluate(y => {
      const svg = window.__card.renderRoot.querySelector('svg.plan-svg');
      const frame = svg.querySelector('[data-hp-plan-rotation-frame]') || svg;
      const p = new DOMPoint(400, y).matrixTransform(frame.getScreenCTM()); return { x:p.x, y:p.y };
    }, y);
    await page.mouse.dblclick(point.x, point.y); await dialog().waitFor(); await settle();
  };
  const choose = async (field, text) => {
    const control = dialog().locator(`hp-settings-select:has(select[name="${field}"])`);
    await control.locator('button').click();
    await control.getByRole('option', { name:text, exact:true }).click(); await settle();
  };
  const baseline = await saved();
  await open(100);
  assert.equal(await dialog().locator('[data-action="opening-leaf-edit"]').count(), 2);
  await dialog().locator('[data-action="opening-leaf-edit"]').first().click(); await settle();
  await choose('opening-leaf-hinge', 'Opens upward');
  await choose('opening-leaf-position', 'Open');
  await dialog().locator('[data-hp="dialog-confirm"]').click(); await settle();
  assert.equal(await writes(), 0, 'nested Done does not write');
  await dialog().locator('[data-action="opening-leaf-edit"]').first().click(); await settle();
  await choose('opening-leaf-hinge', 'Right');
  await page.keyboard.press('Escape'); await settle();
  assert.equal(await dialog().count(), 1, 'Escape cancels only the nested form');
  await dialog().locator('[data-action="opening-leaf-edit"]').first().click(); await settle();
  assert.equal(await dialog().locator('select[name="opening-leaf-hinge"]').inputValue(), 'top');
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click(); await settle();
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
  const accepted = await saved();
  if (await writes() !== 1) console.log('save diagnostics', await page.evaluate(() => ({
    draft: window.__card._openingDialog, toast: window.__card._toast,
    spaceH: window.__card._spaceH, saved: JSON.stringify(window.__card._curSpaceCfg),
    text: window.__card.renderRoot.textContent.slice(-1800),
  })));
  assert.equal(await writes(), 1);
  assert.equal(accepted[0].opening_features.leaves[0].hinge, 'top');
  assert.equal(accepted[0].opening_features.leaves[0].manual, 'open');
  assert.equal('contact' in accepted[0], false);
  assert.equal(await page.evaluate(() => window.__featureWrites[0].opening_features_api), 1);
  await page.keyboard.press('Control+z'); await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
  assert.deepEqual(await saved(), baseline, 'Undo restores implicit old form');
  await page.keyboard.press('Control+y'); await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
  assert.deepEqual(await saved(), accepted, 'Redo restores the whole nested configuration');
  await open(100);
  await dialog().locator('[data-action="opening-leaf-add"]').click(); await settle();
  await dialog().getByRole('button', { name: 'Cancel', exact: true }).click(); await settle();
  assert.deepEqual(await saved(), accepted, 'parent Cancel discards leaf count changes');
  await open(100);
  await dialog().locator('[data-action="opening-leaf-add"]').click(); await settle();
  await dialog().locator('[data-action="opening-leaf-add"]').click(); await settle();
  assert.equal(await dialog().locator('[data-action="opening-leaf-edit"]').count(), 4);
  assert.equal(await dialog().locator('[data-action="opening-leaf-add"]').isDisabled(), true);
  await dialog().locator('[data-action="opening-leaf-edit"]').last().click(); await settle();
  const contact = await dialog().locator('select[name="opening-leaf-contact"] option').evaluateAll(options =>
    options.filter(option => option.value).map(option => ({value:option.value,label:option.textContent}))[0]);
  assert.ok(contact, 'fixture exposes a real compatible sensor');
  await choose('opening-leaf-contact', contact.label);
  assert.equal(await dialog().locator('select[name="opening-leaf-position"]').isDisabled(), true);
  const beforeState = await writes();
  await page.evaluate(id => {
    const card=window.__card, source=card.hass.states[id];
    card.hass={...card.hass,states:{...card.hass.states,[id]:{...source,state:'unavailable'}}};
  },contact.value); await settle();
  assert.equal(await dialog().locator('select[name="opening-leaf-position"]').inputValue(),'unknown');
  assert.equal(await dialog().locator('.op-leaf-unknown').count(),1);
  assert.equal(await writes(),beforeState,'a live source change is not a config write');
  await page.keyboard.press('Escape'); await settle();
  await dialog().getByRole('button',{name:'Cancel',exact:true}).click();await settle();
  // A new authoritative read revokes capabilities; UI must not retain an old
  // permission merely because this card previously saw a compatible backend.
  await page.evaluate(async()=>{
    window.__featureApi = undefined;
    await window.__hpTest.setServerConfig(structuredClone(window.__card._serverCfg));
  });
  await open(100);
  assert.equal(await dialog().locator('[data-hp="dialog-confirm"]').isDisabled(),true);
  assert.equal(await dialog().locator('[data-action="opening-leaf-add"]').isDisabled(),true);
  await dialog().getByRole('button',{name:'Cancel',exact:true}).click();await settle();
  await open(800);
  await dialog().locator('[data-hp="dialog-confirm"]').click();
  await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
  assert.equal('opening_features' in (await saved()).find(opening=>opening.id==='door'),false,
    'ordinary legacy Save does not materialize a feature namespace');
  await page.evaluate(async()=>{
    window.__featureApi=1;
    await window.__hpTest.setServerConfig(structuredClone(window.__card._serverCfg));
  });
  await open(100);await dialog().locator('[data-action="opening-leaf-edit"]').first().click();await settle();
  const beforeDelete=await writes();
  await page.evaluate(()=>window.__hpTest.setServerConfig(config=>{
    const space=config.spaces.find(space=>space.id==='f1');
    space.openings=space.openings.filter(opening=>opening.id!=='window');return config;
  }));await settle();
  assert.equal(await dialog().count(),0,'remote parent deletion retires the nested draft');
  assert.equal((await saved()).some(opening=>opening.id==='window'),false);
  assert.equal(await writes(),beforeDelete,'retiring a remote-deleted draft cannot recreate its parent');
  // These sources deliberately have no marker, HA Area or device sibling.
  // They must enter the same immutable frame as the opening, not just dialogs.
  await page.evaluate(async config=>{
    const c=window.__card;
    c.hass={...c.hass,states:{...c.hass.states,
      'binary_sensor.only_opening':{state:'off',attributes:{}},
      'cover.only_shade':{state:'closed',attributes:{}},
    }};
    const next=structuredClone(config);
    next.spaces[0].openings[0].opening_features={version:1,side:'negative',leaves:[
      {id:'off-plan-leaf',hinge:'start',contact:'binary_sensor.only_opening',
        shade:{enabled:true,contact:'cover.only_shade'}},
    ]};
    await window.__hpTest.setServerConfig(next);await window.__hpTest.setMode('view');
  },config);
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy);await settle();
  const painted=()=>card.locator('[data-hp="opening"][data-id="window"]');
  assert.equal(await painted().locator('.op-leaf-unknown').count(),0,'unplaced source is known on the actual plan');
  const closed=await painted().locator('.op-leaf').first().getAttribute('style');
  assert.equal(await painted().locator('.op-shade-indicator path').getAttribute('data-icon'),'mdi:weather-sunny-off');
  const beforeForeign=await writes();
  await page.evaluate(()=>{
    const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
      'binary_sensor.only_opening':{state:'on',attributes:{}},
      'cover.only_shade':{state:'open',attributes:{}},
    }};
  });await settle();
  assert.notEqual(await painted().locator('.op-leaf').first().getAttribute('style'),closed);
  assert.equal(await painted().locator('.op-shade-indicator path').getAttribute('data-icon'),'mdi:weather-sunny');
  assert.equal(await writes(),beforeForeign,'external source updates are read-only');
  assert.equal(await page.evaluate(() => window.__serviceCalls.length), 0, 'editing never commands a real entity');
} finally { await finish(browser, {}); }
