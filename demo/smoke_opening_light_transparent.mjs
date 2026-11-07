// #1348: real dialog/property controls and a fresh card reading the saved door.
import assert from 'node:assert/strict';
import { launch, checkAll, finish } from './serve.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
import { makeStaticWallOpeningsFixture } from './fixtures/static-wall-openings.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
const authored=makeStaticWallOpeningsFixture();
Object.assign(authored.spaces[0].openings.find(o=>o.id==='wall-door'),
  {contact:'binary_sensor.window',lock:'lock.front_door'});
const fixture=currentGraphFixture(authored);
const {page,browser}=await launch({width:1280,height:900});
const results={};
try {
  await prepareDesktopControls(page);
  await page.evaluate(async config=>{await window.__hpTest.setServerConfig(config);await window.__hpTest.switchSpace('f1');
    const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
      'binary_sensor.window':{...c.hass.states['binary_sensor.window'],state:'off'}}};await c.updateComplete;},fixture);
  const id=await page.evaluate(async()=>{const c=window.__card;await c._ensureEditorRuntime();
    c._setMode('plan');const start=performance.now();while(c._modeTransitionBusy){
      if(performance.now()-start>5000)throw Error('mode did not settle');
      await new Promise(r=>requestAnimationFrame(r));}
    await c.updateComplete;const door=c._openingsR.find(o=>o.type==='door');
    if(!door)throw Error('fixture has no door');c._editorRuntime._editOpening(door);await c.updateComplete;return door.id;});
  const toggle=page.locator('[data-field="opening-light-transparent"]');
  await toggle.waitFor();assert.equal(await toggle.isChecked(),false);results.defaultOff=true;
  const before=await page.evaluate(id=>structuredClone(window.__card._curSpaceCfg.openings.find(o=>o.id===id)),id);
  await toggle.check();await page.locator('hp-dialog[data-kind="opening"] [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(id=>!window.__card._openingDialog&&window.__card._curSpaceCfg.openings.find(o=>o.id===id)?.light_transparent===true,id);
  const saved=await page.evaluate(id=>structuredClone(window.__card._curSpaceCfg.openings.find(o=>o.id===id)),id);
  assert.equal(saved.light_transparent,true);const {light_transparent,...rest}=saved;
  assert.deepEqual(rest,before);results.savePreservesDoor=true;
  assert.equal(await page.evaluate(id=>{const c=window.__card;return c._openingAmt(c._openingsR.find(o=>o.id===id));},id),0);results.glassDoesNotOpenSymbol=true;
  await page.evaluate(async id=>{const c=window.__card;c._editorRuntime._editOpening(c._openingsR.find(o=>o.id===id));await c.updateComplete;},id);
  assert.equal(await toggle.isChecked(),true);results.reopenRetainsFlag=true;
  await toggle.uncheck();await page.locator('hp-dialog[data-kind="opening"] [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(id=>!window.__card._openingDialog&&!('light_transparent'in window.__card._curSpaceCfg.openings.find(o=>o.id===id)),id);
  results.turnOffRestoresAbsence=true;
  const property=page.locator('[data-field="properties-light_transparent"]');
  await property.waitFor();await property.click();
  await page.waitForFunction(id=>window.__card._curSpaceCfg.openings.find(o=>o.id===id)?.light_transparent===true,id);
  results.propertiesCanEnable=true;
  const fresh=await page.evaluate(async id=>{const old=window.__card,snapshot=structuredClone(old._serverCfg),inherited=old.hass.callWS.bind(old.hass);
    const c=document.createElement('houseplan-card');c.setConfig({type:'custom:houseplan-card'});
    c.hass={...old.hass,callWS:async msg=>msg.type==='houseplan/config/get'?{config:snapshot,rev:1,can_write:true}:inherited(msg)};
    old.replaceWith(c);window.__card=c;await c._ensureEditorRuntime();
    const start=performance.now();while(!c._loadOk||c._booting||c._bootSoft){if(performance.now()-start>10000)throw Error('fresh card did not load');await new Promise(r=>setTimeout(r,20));}
    c._setMode('plan');while(c._modeTransitionBusy)await new Promise(r=>requestAnimationFrame(r));await c.updateComplete;
    const door=c._openingsR.find(o=>o.id===id);c._editorRuntime._editOpening(door);await c.updateComplete;return c._openingDialog?.lightTransparent===true;},id);
  assert.equal(fresh,true);assert.equal(await toggle.isChecked(),true);results.freshCardRetainsFlag=true;
} catch (error) {results.completed=false;console.log(await page.evaluate(()=>{const c=window.__card;return {dialog:c._openingDialog,space:c._curSpaceCfg,toast:c._toast};}));throw error;} finally {checkAll(results);await finish(browser,results);}
