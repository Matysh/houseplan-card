// #1071: native sidebar edits must not rebuild unrelated physical walls.
import { launch, check as checkValue, finish, requirePinnedBrowser } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { isDeepStrictEqual } from 'node:util';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const check=(name,actual,expected=true)=> {
  if(typeof actual!=='object'&&typeof expected!=='object')return checkValue(name,actual,expected);
  if(!isDeepStrictEqual(actual,expected)) {
    const diffs=[];const walk=(a,b,path)=>{if(diffs.length>=8||isDeepStrictEqual(a,b))return;
      if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],`${path}.${key}`);
      else diffs.push({path,actual:a,expected:b});};walk(actual,expected,'');console.log(name,JSON.stringify(diffs));
  }
  return checkValue(name,isDeepStrictEqual(actual,expected),true);
};

requirePinnedBrowser();
const {page,browser}=await launch({width:1600,height:1100});
const card=()=>page.locator('houseplan-card');
const panel=()=>card().locator('[data-hp="properties-panel"]');
const picker=()=>panel().locator('[data-property="stroke"] hp-color-opacity');
const settle=()=>page.evaluate(async()=>{
  await window.__hpTest.waitForWrites();await window.__card.updateComplete;
  await window.__card._editorRuntime.properties.lane.settled();await window.__card.updateComplete;
});
const state=()=>page.evaluate(async()=>{
  const c=window.__card;
  return {config:(await c.hass.callWS({type:'houseplan/config/get'})).config,
    builds:{...c._floorCacheBuilds},history:c._geometryHistory.size,writes:window.__1071Writes,
    defaults:structuredClone(c._decorStyle),ids:[...c._editorRuntime.properties.decorSelectionIds],
    walls:[...c.renderRoot.querySelectorAll('.wallbodies path')].map(el=>el.getAttribute('d')),
    paint:[...c.renderRoot.querySelectorAll('.decorlayer path.dshape[data-kind="furniture"][stroke]')]
      .map(el=>({stroke:el.getAttribute('stroke'),opacity:Number(el.getAttribute('stroke-opacity'))}))};
});
const checkWarm=(name,before,after)=>{
  for(const key of ['wallUnion','physicalBodies','innerContour','lightBarrier','lightPhysicalBodies'])
    check(`${name}.${key}.no_rebuild`,after.builds[key],before.builds[key]);
  check(`${name}.walls_identical`,after.walls,before.walls);
};
try {
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  // Arrange a current persisted plan before measuring, not a migration inside Undo.
  const fixture=commitWallSegmentModel(makeLargeHouseFixture({includeStairs:false}).config).config;
  fixture.spaces[0].decor=[
    {id:'a',kind:'furniture',x:.2,y:.3,w:.1,h:.1,symbol:'sofa',color:'#ff0000',opacity:.3},
    {id:'b',kind:'furniture',x:.4,y:.3,w:.1,h:.1,symbol:'armchair',color:'#0000ff',opacity:.8},
    {id:'foreign',kind:'rect',x:.6,y:.3,w:.1,h:.1,color:'#123456'},
  ];
  await page.evaluate(async config=>{
    await window.__hpTest.setServerConfig(()=>config);
    const c=window.__card;await window.__hpTest.switchSpace(config.spaces[0].id);
    await window.__hpTest.setMode('decor');await window.__hpTest.setTool('select');
    const call=c.hass.callWS.bind(c.hass);window.__1071Writes=0;
    c.hass={...c.hass,callWS:async message=>{if(message.type==='houseplan/config/set')window.__1071Writes++;return call(message);}};
  },fixture);
  await card().locator('[data-hp="zoom-fit"]').click();await card().locator('[data-hp="zoom-fit"]').focus();
  await page.keyboard.press('Control+m');await settle();
  const before=await state();check('sidebar.two_furniture_selected',before.ids,['a','b']);
  check('sidebar.physical_fixture_is_warm',before.builds.wallUnion>0&&before.walls.length>0,true);
  check('sidebar.light_fixture_is_warm',before.builds.lightBarrier>0&&before.builds.lightPhysicalBodies>0,true);
  await picker().locator('.trigger').click();await picker().locator('[data-field="colour-hex"]').fill('#CA24EF');
  await page.waitForFunction(()=>[...window.__card.renderRoot.querySelectorAll('.decorlayer path.dshape[data-kind="furniture"][stroke]')]
    .every(el=>el.getAttribute('stroke')==='#ca24ef'));
  const preview=await state();check('sidebar.preview_not_saved',preview.config,before.config);checkWarm('sidebar.preview',before,preview);
  await picker().locator('.confirm').click();await settle();const saved=await state();
  const expected=structuredClone(before.config);
  expected.spaces[0].decor[0].color=expected.spaces[0].decor[1].color='#ca24ef';
  check('sidebar.popup.complete_saved_config',saved.config,expected);
  check('sidebar.popup.actual_svg',saved.paint,[{stroke:'#ca24ef',opacity:.3},{stroke:'#ca24ef',opacity:.8}]);
  check('sidebar.popup.one_write',saved.writes,before.writes+1);check('sidebar.popup.one_history',saved.history,before.history+1);
  check('sidebar.popup.defaults_untouched',saved.defaults,before.defaults);checkWarm('sidebar.popup',before,saved);
  await card().locator('[data-hp="zoom-fit"]').focus();await page.keyboard.press('Control+z');await settle();
  const undo=await state();check('sidebar.undo',undo.config,before.config);check('sidebar.undo.same_walls',undo.walls,before.walls);
  await page.keyboard.press('Control+Shift+z');await settle();const redo=await state();
  check('sidebar.redo',redo.config,expected);check('sidebar.redo.same_walls',redo.walls,before.walls);
  const alpha=panel().locator('[data-field="stroke-opacity"]');await alpha.fill('45');await alpha.press('Enter');await settle();
  expected.spaces[0].decor[0].opacity=expected.spaces[0].decor[1].opacity=.45;
  const inline=await state();check('sidebar.inline.complete_saved_config',inline.config,expected);
  check('sidebar.inline.actual_svg',inline.paint,[{stroke:'#ca24ef',opacity:.45},{stroke:'#ca24ef',opacity:.45}]);
  check('sidebar.inline.one_write',inline.writes,redo.writes+1);check('sidebar.inline.one_history',inline.history,redo.history+1);
  checkWarm('sidebar.inline',redo,inline);
  await picker().locator('.trigger').click();await picker().locator('[data-field="colour-hex"]').fill('#123456');await page.keyboard.press('Escape');await settle();
  const cancel=await state();check('sidebar.cancel.no_write',cancel.writes,inline.writes);check('sidebar.cancel.original_paint',cancel.paint,inline.paint);
  checkWarm('sidebar.cancel',inline,cancel);
  // Toolbar remains creation defaults even while the furniture group is selected.
  const toolbar=card().locator('.decorbar hp-color-opacity');await toolbar.locator('.trigger').click();
  await toolbar.locator('[data-field="colour-hex"]').fill('#ABCDEF');await toolbar.locator('.confirm').click();
  await page.waitForFunction(async()=>{const c=window.__card;const r=await c.hass.callWS({type:'houseplan/config/get'});return r.config.settings?.decor_default_style?.color==='#abcdef';});
  await settle();const defaults=await state();
  check('toolbar.group_members_untouched',defaults.config.spaces,expected.spaces);check('toolbar.defaults_only',defaults.defaults.color,'#abcdef');
  check('toolbar.no_group_history',defaults.history,inline.history);checkWarm('toolbar.defaults',cancel,defaults);
  // A new public card reads stored bytes, with neither warm caches nor selection copied.
  await page.evaluate(()=>{const old=window.__card,next=document.createElement('houseplan-card');
    next.setConfig({type:'custom:houseplan-card'});next.hass=old.hass;old.replaceWith(next);window.__card=next;});
  await page.waitForFunction(()=>window.__card._loadOk&&window.__card._decorList.length===3);
  await page.evaluate(()=>window.__hpTest.setMode('decor'));await settle();const cold=await state();
  check('sidebar.cold.saved_config',cold.config,defaults.config);check('sidebar.cold.actual_svg',cold.paint,inline.paint);
  check('sidebar.cold.same_walls',cold.walls,before.walls);check('sidebar.cold.no_selection',cold.ids,[]);
  check('sidebar.cold.no_write',cold.writes,defaults.writes);
}finally{await finish(browser);}
