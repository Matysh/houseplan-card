/** #1216: actual model11 card, retained physical demand and scene switches. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launch,requirePinnedBrowser,reportPageErrors} from './serve.mjs';
import {makeSelectiveInvalidationFixture} from './fixtures/selective-invalidation.mjs';
import {installSelectiveInvalidationFixture} from './helpers/selective-invalidation-fixture.mjs';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
const out=resolve(process.argv.find(a=>a.startsWith('--output='))?.slice(9)||'artifacts/1216/browser');mkdirSync(out,{recursive:true});
requirePinnedBrowser();const{page,browser}=await launch({width:1280,height:900});
const fixture=makeSelectiveInvalidationFixture(false);fixture.config=commitWallSegmentModel(fixture.config).config;
const frame=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const counts=()=>page.evaluate(()=>({...window.__card._floorCacheBuilds}));
const same=(a,b,label)=>{for(const key of ['wallUnion','physicalBodies','cleanFloor'])assert.equal(b[key],a[key],label+': '+key);};
try{
 await installSelectiveInvalidationFixture(page,fixture);await frame();
 assert.equal(await page.evaluate(()=>window.__card._serverCfg.model_version),11);
 const before=await counts();
 await page.evaluate(()=>{const c=window.__card,old=c.hass.states['sensor.load_0'];c.hass={...c.hass,states:{...c.hass.states,'sensor.load_0':{...old,state:'42'}}};});
 await frame();same(before,await counts(),'HA tick');
 await page.evaluate(()=>window.__hpTest.setServerConfig(config=>{config.spaces[0].rooms[0].name='Synthetic renamed';config.spaces[0].settings.wall_fill={c:'#637b8c',a:1};return config;}));
 await frame();same(before,await counts(),'name/paint metadata');
 await page.screenshot({path:resolve(out,'view.png')});
 await page.evaluate(()=>window.__hpTest.switchSpace('f2'));await frame();const afterForeign=await counts();
 assert.equal(afterForeign.wallUnion-before.wallUnion,1,'one requested foreign floor');
 await page.evaluate(()=>window.__hpTest.switchSpace('f1'));await frame();same(afterForeign,await counts(),'warm return');
 await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});await frame();
 assert.ok(await page.locator('houseplan-card').locator('.hp-node-handle').count());
 await page.screenshot({path:resolve(out,'plan.png')});
 await page.evaluate(async()=>{await window.__hpTest.setMode('view');await window.__hpTest.setVolumetricView(true);});await frame();
 assert.ok(await page.locator('houseplan-card').locator('.projection-iso').count());
 await page.screenshot({path:resolve(out,'iso.png')});
 const room=(id,x,y,w,h)=>({id,name:id,poly:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]});
 const overlap=commitWallSegmentModel({...fixture.config,model_version:10,spaces:[{
  ...fixture.config.spaces[0],plan_graph:undefined,wall_segments:[],walls:[],wall_columns:[],openings:[],
  rooms:[room('z',.1,.1,.8,.8),room('a',.25,.25,.25,.25),room('m',.7,.2,.25,.4)],
 }]}).config;
 await page.evaluate(async config=>{await window.__hpTest.setVolumetricView(false);window.__hpTest.setServerConfig(()=>config);},overlap);await frame();
 assert.deepEqual(await page.locator('houseplan-card').locator('[data-hp="room"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-id'))),['a','m','z']);
 const first=await page.locator('houseplan-card').locator('[data-hp="room"]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-id'),n.getAttribute('d')||n.getAttribute('points')]));
 await page.evaluate(()=>window.__hpTest.setServerConfig(config=>{config.spaces[0].rooms.reverse();return config;}));await frame();
 assert.deepEqual(await page.locator('houseplan-card').locator('[data-hp="room"]').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('data-id'),n.getAttribute('d')||n.getAttribute('points')])),first);
 await page.screenshot({path:resolve(out,'room-order.png')});
 assert.equal(await reportPageErrors(),false);
 const report={issue:1216,model:11,before,afterForeign,after:await counts(),checks:['HA state no masonry rebuild','name/paint no masonry rebuild','foreign floor demand','warm floor reuse','View/plan/ISO real card','nested/overlapping room layer and ID-owned path stable under projection permutation']};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
