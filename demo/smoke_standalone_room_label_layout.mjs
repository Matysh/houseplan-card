/** #1563: real pointer gestures in the packed frontend, against the Python plan service. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { launchPanelCold, finish, requirePinnedBrowser } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
import { buildStandalone, standalonePath, verifyStandaloneManifest, MANIFEST } from '../scripts/standalone-build.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { PLAN_ONLY_CAPABILITIES } from '../test-build/plan-capabilities.js';
import { createCoreProcess } from './standalone/core-process.mjs';

requirePinnedBrowser('smoke_standalone_room_label_layout');
const rect = (left, right) => [[left,.12],[right,.12],[right,.78],[left,.78]];
const a = rect(.1,.56), b = rect(.65,1.05);
const config = currentGraphFixture({spaces:[{
  id:'floor',title:'Floor',cell_cm:5,view_box:[0,0,1.15,1],
  settings:{name_color:{c:'#253545',a:1},bg_mode:'static'},
  rooms:[{id:'first',name:'Shifted name',poly:a},{id:'second',name:'Ordinary room with default label position',poly:b}],
  walls:[a,b].flatMap(poly => poly.map((point,i)=>({a:point,b:poly[(i+1)%poly.length],cm:16}))),
  wall_segments:[],partitions:[],openings:[],decor:[],stairs:[],
}],markers:[{id:'hidden',binding:'entity:light.kept',space:'floor',room_id:'first'}],settings:{filter_seeded:true}});
const dist=resolve('dist-standalone');
const manifest=process.argv.includes('--reuse-verified-bundle')
  ? JSON.parse(readFileSync(resolve(dist,MANIFEST),'utf8')) : await buildStandalone();
verifyStandaloneManifest(dist,manifest);
assert.equal(manifest.source.commit,execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
assert.equal(manifest.source.fingerprint,sourceFingerprint(process.cwd()),'use the current frontend bytes');
const core=await createCoreProcess({config,fingerprint:manifest.source.fingerprint,version:manifest.version});
const get=async()=> (await core.rpc({op:'request',command:{type:'houseplan/layout/get'}})).result;
const write=async(room_id,before,position)=>(await core.rpc({op:'request',command:{
  type:'houseplan/layout/set',room_label:{room_id,space_id:'floor',before,position},
}})).result;
const first={s:'floor',x:.23,y:.26,k:1.2};
await write('first',null,first);

const {page,browser}=await launchPanelCold({width:1280,height:900});
page.setDefaultTimeout(12000);
const card=page.locator('houseplan-card');
const gates=[];
const pause=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});gates.push(release);return {promise,release};};
const reached=async gate=>{
  let timer;
  try{await Promise.race([gate.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Layout command did not reach the host')),8000);})]);}
  finally{clearTimeout(timer);}
};
let control;
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.route('**/standalone-test',route=>route.fulfill({contentType:'text/html',body:readFileSync('demo/standalone/index.html')}));
  await page.route('**/standalone-dist/**',route=>{
    const path=new URL(route.request().url()).pathname.slice('/standalone-dist/'.length);
    const contentType=path.endsWith('.css')?'text/css':path.endsWith('.ttf')?'font/ttf':'text/javascript';
    return route.fulfill({contentType,body:readFileSync(standalonePath(resolve('dist-standalone'),path))});
  });
  await page.route('**/standalone-host.js',route=>route.fulfill({contentType:'text/javascript',body:readFileSync('demo/standalone/host.js')}));
  await page.route('**/standalone-core-rpc',async route=>{
    const msg=route.request().postDataJSON(), label=msg.command?.room_label;
    const selected=label && control;
    if(selected)control=undefined;
    try{
      if(selected?.before){selected.seen.release();await selected.before.promise;}
      const result=await core.rpc(msg);
      if(selected?.after){selected.seen.release();await selected.after.promise;}
      if(selected?.lost)return await route.abort('failed');
      return await route.fulfill({json:result});
    }catch(error){return route.fulfill({json:{error:{code:error.code||'test_core_error'}}});}
  });
  await page.goto('http://demo.local/standalone-test');
  await page.evaluate(async caps=>{
    const api=window.labelApi=await import('/standalone-dist/houseplan-standalone.js');
    const {createCorePlanHost}=await import('/standalone-host.js');
    window.labelHost=createCorePlanHost(caps);
    window.labelStates=[];
    window.openLabels=async()=>{
      window.labelMount=api.mountHouseplan(document.querySelector('#host'),window.labelHost.host,{language:'en',darkMode:false});
      window.labelMount.subscribeSaveState(state=>window.labelStates.push(state));
      window.labelCard=await window.labelMount.ready;
    };
    await window.openLabels();
  },PLAN_ONLY_CAPABILITIES);
  const editor=async()=>{
    await page.waitForFunction(()=>window.labelCard?._loadOk&&!window.labelCard?._booting);
    await waitForUiKitPaint(page);
    await clickHeaderAction(card,'mode-plan');
    await card.locator('[data-hp="tool"][data-tool="select"]').click();
    await card.locator('[data-hp="zoom-fit"]').click();
    await waitForUiKitPaint(page);
  };
  const status=(room,status)=>page.waitForFunction(([room,status])=>
    window.labelMount.getSaveState().entries.some(entry=>entry.roomId===room&&entry.status===status),[room,status]);
  const shown=(room,x)=>page.waitForFunction(([room,x])=>window.labelCard._layout['rl_'+room]?.x===x,[room,x]);
  const gesture=async(room,dx,dy,resize=false)=>{
    const label=card.locator('[data-hp="room-label"][data-id="'+room+'"]');
    const target=resize?label.locator('.rlhandle.br'):label.locator('.rlfit');
    if(resize){
      const hit=await label.evaluate(element=>{
        const {left,top,width,height}=element.getBoundingClientRect(), root=element.getRootNode();
        for(const h of [.5,.22,.78])for(const w of [.85,.15,.7,.3,.5]){
          const x=left+w*width,y=top+h*height, target=root.elementFromPoint(x,y);
          if(target?.closest('.roomlabel')===element)return {x,y};
        }
        return null;
      });
      assert.ok(hit,'the room-settings button must not intercept the label hover');
      await page.mouse.move(hit.x,hit.y);
      await target.waitFor({state:'visible'});
    }
    const box=await target.boundingBox();
    assert.ok(box,'pointer target is drawn');
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+dx,y+dy,{steps:4});
    await page.mouse.up();
  };
  await editor();
  const hold={seen:pause(),before:pause()};
  control=hold;
  await gesture('first',72,38);
  await status('first','pending');
  assert.equal(await page.evaluate(()=>window.labelHost.commands.some(c=>c.room_label)),false,'pending starts before debounce sends');
  await reached(hold.seen);
  assert.deepEqual((await get()).layout.rl_first,first);
  assert.equal(await page.evaluate(()=>window.labelMount.getSaveState().pending),true);
  hold.before.release();
  await status('first','accepted');
  const moved=(await get()).layout.rl_first;
  assert.notEqual(moved.x,first.x);assert.equal(moved.k,first.k);

  await gesture('second',35,25,true);
  await status('second','accepted');
  const resized=(await get()).layout.rl_second;
  assert.ok(resized.k>1);assert.equal(resized.s,'floor');
  await page.evaluate(async()=>{window.labelMount.dispose();await window.openLabels();});
  await editor();
  assert.deepEqual(await page.evaluate(()=>[window.labelCard._layout.rl_first,window.labelCard._layout.rl_second]),[moved,resized]);

  const conflict={seen:pause(),before:pause()};
  control=conflict;
  await gesture('first',36,-20);
  await reached(conflict.seen);
  const remote={...moved,x:.27,y:.30};
  await write('first',moved,remote);
  conflict.before.release();
  await status('first','rejected');
  await shown('first',remote.x);
  await gesture('second',27,22,true);
  await status('second','accepted');
  assert.equal(await page.evaluate(()=>window.labelMount.getSaveState().unresolved),true);
  await gesture('first',-22,-36);
  await status('first','accepted');
  assert.equal(await page.evaluate(()=>window.labelMount.getSaveState().unresolved),false);

  control={lost:true};
  await gesture('first',-22,35);
  await status('first','unknown');
  const savedDespiteLoss=(await get()).layout.rl_first;
  await shown('first',savedDespiteLoss.x);
  await page.waitForFunction(()=>window.labelHost.pendingCount===0);
  assert.equal(await page.evaluate(()=>window.labelMount.getSaveState().unresolved),true,'read does not turn a missing receipt into acceptance');

  const late={seen:pause(),after:pause()};
  control=late;
  await gesture('first',23,26);
  await status('first','pending');
  await reached(late.seen);
  await page.evaluate(()=>window.labelHost.permissions({read:true,write:false,admin:false}));
  late.after.release();
  await page.waitForFunction(()=>!window.labelMount.getSaveState().pending);
  assert.equal(await page.evaluate(()=>window.labelMount.getSaveState().entries.some(e=>e.roomId==='first'&&e.status==='accepted')),false);
  const snapshot=(await core.rpc({op:'snapshot'})).result;
  assert.equal(snapshot.haImported,false);
  assert.equal(snapshot.config.markers[0].binding,'entity:light.kept');
  const wire=await page.evaluate(()=>window.labelHost.commands.map(c=>c.type));
  assert.equal(wire.includes('houseplan/layout/update'),false);
  assert.deepEqual(errors,[]);
  const mismatch=await page.evaluate(async()=>{
    window.labelMount.dispose();
    window.labelHost.handshake({room_label_layout_patch_api:undefined});
    try{await window.openLabels();return false;}
    catch(error){return error.code==='standalone_host_incompatible'&&!window.labelMount.element;}
    finally{window.labelMount.dispose();}
  });
  assert.equal(mismatch,true,'previous host API is rejected before a writable card is created');
  console.log('Standalone room labels: real drag/resize, remount, pending receipt, CAS conflict, lost reply, authority revocation passed');
}finally{
  for(const release of gates)release();
  await finish(browser);await core.close();
}
