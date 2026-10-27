/** #1000: genuine cold View requests, rights and temporary lifecycle. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launchPanelCold, finish, check, requirePinnedBrowser } from './serve.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
requirePinnedBrowser('optional threshold View graph and authority');
const sessions=[],out={};
async function start(options={}){
 const s=await launchPanelCold({width:1280,height:900});sessions.push(s);s.options=options;s.requests=[];s.page.on('request',r=>s.requests.push(r.url()));
 await s.page.evaluate(async options=>{
  const h=window.__mkHass(),original=h.callWS;
  h.user={id:'alert-viewer',name:'Viewer',is_admin:options.writer!==false};
  h.entities['sensor.hp1000_cold']={entity_id:'sensor.hp1000_cold',device_id:'d_light1',name:'CO₂',platform:'demo'};
  h.states={...h.states,'sensor.hp1000_cold':{entity_id:'sensor.hp1000_cold',state:'1500',attributes:{unit_of_measurement:'ppm',reading:800}}};
  const fixture={rules:options.rules===false?undefined:[{id:'cold',type:'threshold',level:'attention',entity_id:'sensor.hp1000_cold',...(options.attribute?{attribute:'reading'}:{}),operator:'gt',value:1000}],calls:[]};
  if(options.invalid)fixture.rules=[{type:'external',level:'alarm'}];
  h.callWS=async message=>{fixture.calls.push(structuredClone(message));const reply=await original(message);
   if(message.type==='houseplan/config/get'){reply.can_write=options.writer!==false;reply.config.markers=reply.config.markers.filter(m=>m.id!=='d_light1');reply.config.markers.push({id:'d_light1',binding:'device:d_light1',display:options.static?'static_icon':'badge',tap_action:'info',...(fixture.rules===undefined?{}:{alert_sources:structuredClone(fixture.rules)})});}
   return reply;};
  await import('/assets/houseplan-card.js');const c=document.createElement('houseplan-card');c.setConfig({type:'custom:houseplan-card',kiosk:!!options.kiosk});c.hass=h;
  document.querySelector('#host').replaceChildren(c);window.__card=c;window.alertViewFixture=fixture;
 },options);
 await assertFreshDemoBundle(s.page);
 await s.page.waitForFunction(()=>window.__card?._booting===false&&window.__card._devices.some(d=>d.id==='d_light1'));
 return s;
}
try{
 const ordinary=await start({rules:false,writer:false});await ordinary.page.waitForTimeout(250);
 assert.ok(!ordinary.requests.some(url=>url.includes('marker-alert-view-runtime')));out.ordinaryViewHasNoAlertRequest=true;
 for(const options of[{writer:false},{writer:false,kiosk:true}]){
  const {page,requests}=await start(options);const device=page.locator('[data-hp=device][data-id=d_light1]').first();
  assert.equal(await device.locator('.device-attention').count(),0);
  await device.locator('.device-attention').waitFor({timeout:6500});
  assert.ok(requests.some(url=>url.includes('marker-alert-view-runtime')));
  assert.ok(!requests.some(url=>/houseplan-editor-runtime|houseplan-onboarding-runtime|settings-dialogs|settings-styles/.test(url)),JSON.stringify(requests));
  // #997 uses this small common control in the View header, outside settings.
  if(requests.some(url=>url.includes('hp-settings-select')))assert.equal(await page.locator('[data-hp="space-select"]').count(),1);
  assert.equal(await page.locator('[data-hp=mode-tab]').count(),0);
  const writes=await page.evaluate(()=>window.alertViewFixture.calls.filter(m=>/houseplan\/(config\/set|layout\/(set|update|delete)|marker\/)/.test(m.type)));
  assert.deepEqual(writes,[]);
 }
 out.readonlyAndKioskConfirmWithoutEditorOrWrites=true;
 const attribute=await start({writer:false,attribute:true});
 const attributeDevice=attribute.page.locator('[data-hp=device][data-id=d_light1]').first();
 const before=await attribute.page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
 await attribute.page.waitForTimeout(3150);assert.equal(await attributeDevice.locator('.device-attention').count(),0);
 await attribute.page.evaluate(()=>{const c=window.__card,id='sensor.hp1000_cold',row=c.hass.states[id];c.hass={...c.hass,states:{...c.hass.states,[id]:{...row,attributes:{...row.attributes,reading:1500}}}};});
 await attributeDevice.locator('.device-attention').waitFor({timeout:6500});
 assert.equal(await attribute.page.evaluate(()=>window.__card.hass.states['sensor.hp1000_cold'].state),'1500');
 assert.equal(await attribute.page.evaluate(()=>JSON.stringify(window.__card._serverCfg)),before);
 await attributeDevice.click();
 await attribute.page.locator('.device-issue').filter({hasText:'reading > 1000'}).waitFor();
 assert.deepEqual(await attribute.page.evaluate(()=>window.alertViewFixture.calls.filter(m=>/houseplan\/(config\/set|layout\/(set|update|delete)|marker\/)/.test(m.type))),[]);
 out.attributeOnlyTickReachesConfirmedFrameWithoutWrite=true;
 const s=await start();const device=s.page.locator('[data-hp=device][data-id=d_light1]').first();await device.locator('.device-attention').waitFor({timeout:6500});
 await s.page.evaluate(()=>{const c=window.__card;const parent=c.parentElement;c.remove();parent.append(c);});
 await s.page.waitForTimeout(100);assert.equal(await device.locator('.device-attention').count(),0,'reattach has no inherited active cause');
 await device.locator('.device-attention').waitFor({timeout:6500});out.reattachConfirmsAfresh=true;
 await s.page.evaluate(()=>{window.alertViewFixture.rules=[];window.__pushServerConfig(structuredClone(window.__card._serverCfg));});
 await device.locator('.device-attention').waitFor({state:'detached'});await s.page.waitForTimeout(3150);
 assert.equal(await device.locator('.device-attention').count(),0);out.removedRuleDoesNotResurrect=true;
 for(const options of[{static:true},{invalid:true}]){const s=await start(options);await s.page.waitForTimeout(3150);assert.equal(await s.page.locator('.device-attention,.dev.alarm').count(),0);}
 out.staticAndUnsupportedInputHaveNoCause=true;
 for(const[key,value]of Object.entries(out))check(key,value);
}finally{
 mkdirSync('artifacts/marker-alert-cold',{recursive:true});
 writeFileSync('artifacts/marker-alert-cold/report.json',JSON.stringify({
  buildFingerprint:JSON.parse(readFileSync('demo/srv/assets/houseplan-assets.json')).fingerprint,
  observations:out,cases:sessions.map(s=>({options:s.options,requestedPaths:[...new Set(s.requests.map(url=>new URL(url).pathname))]})),
 },null,2)+'\n');
 for(const s of sessions)await finish(s.browser,out);
}
