// #1093: real native saves, physical work and hidden/latest data, no timing retries.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,requirePinnedBrowser,reportPageErrors} from './serve.mjs';
import {makeSelectiveInvalidationFixture} from './fixtures/selective-invalidation.mjs';
import {installSelectiveInvalidationFixture} from './helpers/selective-invalidation-fixture.mjs';
import {runLiveInvalidationWitnesses} from './helpers/selective-invalidation-live.mjs';
import {runAlertDemandWitnesses} from './helpers/selective-invalidation-alerts.mjs';
import {runConsumerDemandWitnesses} from './helpers/selective-invalidation-consumers.mjs';
requirePinnedBrowser();
const dpr=Number(process.argv.find(a=>a.startsWith('--dpr='))?.slice(6)||1);
const {page,browser}=await launch({width:1440,height:1000},dpr,[],{},undefined,undefined,'/demo.html?device-history=1');
const results={},card=page.locator('houseplan-card');
const tick=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const counters=()=>page.evaluate(()=>({floor:{...window.__card._floorCacheBuilds},contacts:{...window.__card._deviceContacts.work},
  snapshot:window.__card._liveRt.work(),models:window.__card._spaceModels.work.builds,space:window.__card._space}));
const unchangedPhysics=(before,after,label,contacts=true)=>{
  for(const key of ['wallUnion','physicalBodies','cleanFloor','openingWallIndex'])assert.equal(after.floor[key],before.floor[key],`${label}: ${key}`);
  if(contacts)assert.equal(after.contacts.rebuilds,before.contacts.rebuilds,`${label}: contact graph`);
  assert.equal(after.models,before.models,`${label}: scaled floor model`);
};
const saved=()=>page.evaluate(async()=>structuredClone((await window.__card.hass.callWS({type:'houseplan/config/get'})).config));
const pick=async id=>{
  const tab=card.locator(`[data-hp="space-tab"][data-id="${id}"]`);
  if(await tab.count())await tab.click();else await card.locator('[data-hp="space-select-value"]').selectOption(id);
};
const open=async id=>{
  const gear=card.locator(`[data-hp="space-settings"][data-id="${id}"]`);
  await gear.waitFor({state:'visible'});
  await gear.click();
  return card.locator('hp-dialog[data-kind="space"]');
};
try {
  await page.locator('#host').evaluate(host=>host.style.width='1200px');
  const fixture=makeSelectiveInvalidationFixture();
  // Created stored spaces already carry these canonical source-policy fields.
  // Timing keeps its original fixture; this sibling isolates paint dependency.
  for(const s of fixture.config.spaces)Object.assign(s,{plan_url:null,plan_aspect:null,zero_wall_style:'dashed'});
  results.load=await installSelectiveInvalidationFixture(page,fixture);
  assert.ok(results.load.visible>=100&&results.load.contacts>=30);
  // Fixture loading uses a real HA authority replacement and can replace the
  // stage in the still-mounted card. Both resize consumers must own the new DOM.
  for(const width of [900,1200]) {
    await page.locator('#host').evaluate((host,width)=>host.style.width=`${width}px`,width);
    await page.waitForFunction(width=>window.__card._compactSpaces===(width<=1024)
      && Math.abs(window.__card.renderRoot.querySelector('.hdr').getBoundingClientRect().width-width)<1,width);
    await tick();
  }
  results.replacedStageResizes=true;
  let before=await counters();
  let dialog=await open('f1');await dialog.locator('#space-title').fill('Visible paint 1093');
  await dialog.locator('[data-hp="dialog-confirm"]').click();await dialog.waitFor({state:'hidden'});await tick();
  unchangedPhysics(before,await counters(),'native current-floor paint');
  assert.equal((await saved()).spaces[0].title,'Visible paint 1093');results.visiblePaint=true;

  await page.evaluate(()=>{
    const c=window.__card,original=c.hass.callWS;window.__writes1093=[];window.__paired1093=[];
    c.hass={...c.hass,callWS:async message=>{
      if(['houseplan/marker/copy','houseplan/marker/history'].includes(message.type))window.__paired1093.push(structuredClone(message));
      if(message.type==='houseplan/config/set'){
        window.__writes1093.push(structuredClone(message));
        if(window.__hold1093)await new Promise(resolve=>window.__release1093=resolve);
        if(window.__reject1093){window.__reject1093=false;throw Object.assign(new Error('controlled refusal'),{code:'forbidden'});}
      }
      return original(message);
    }};
  });
  before=await counters();results.paintBefore=await page.evaluate(()=>({key:window.__card._floorKey('f1'),space:structuredClone(window.__card._curSpaceCfg)}));dialog=await open('f2');await dialog.locator('#space-title').fill('Hidden floor paint 1093');
  await page.evaluate(()=>window.__hold1093=true);
  await dialog.locator('[data-hp="dialog-confirm"]').click();await page.waitForFunction(()=>!!window.__release1093);
  assert.equal(await dialog.isVisible(),true,'ACK held: form remains open');
  assert.equal(await dialog.locator('[data-hp="dialog-confirm"]').isDisabled(),true);
  assert.equal((await saved()).spaces[1].title,'Floor 2','server has not accepted the held write');
  assert.equal(await page.evaluate(()=>window.__writes1093.length),1);
  await page.evaluate(()=>{window.__hold1093=false;window.__release1093();});await dialog.waitFor({state:'hidden'});await tick();
  results.inactiveWitness={before,after:await counters()};
  results.paintAfter=await page.evaluate(()=>({key:window.__card._floorKey('f1'),space:structuredClone(window.__card._curSpaceCfg)}));
  unchangedPhysics(before,results.inactiveWitness.after,'native inactive-floor paint');
  assert.equal((await counters()).space,'f1');assert.equal((await saved()).spaces[1].title,'Hidden floor paint 1093');
  results.delayedAck=true;results.inactivePaint=true;

  dialog=await open('f1');await dialog.locator('#space-title').fill('Refused title');
  await page.evaluate(()=>window.__reject1093=true);
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(()=>window.__card._spaceDialog?.busy===false);
  assert.equal(await dialog.isVisible(),true,'refused save retains the editable form');
  assert.equal((await saved()).spaces[0].title,'Visible paint 1093');
  await dialog.locator('#space-title').fill('Visible paint 1093');
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await tick();
  results.refusedSave=true;

  before=await counters();await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>structuredClone(cfg)));await tick();
  unchangedPhysics(before,await counters(),'equivalent external clone');results.equivalentClone=true;
  // Three valid externally authored revisions of B; A stays mounted throughout.
  for(let i=0;i<3;i++)await page.evaluate(({id,delta})=>window.__hpTest.setServerConfig(cfg=>{
    const s=cfg.spaces.find(s=>s.id===id);
    for(const room of s.rooms)room.poly=room.poly.map(p=>[p[0]+delta,p[1]]);
    for(const wall of s.wall_segments){wall.a=[wall.a[0]+delta,wall.a[1]];wall.b=[wall.b[0]+delta,wall.b[1]];}
    for(const column of s.wall_columns)column.center=[column.center[0]+delta,column.center[1]];
    for(const opening of s.openings)opening.x+=delta;
    return cfg;
  }),{id:'f2',delta:.001});
  await tick();unchangedPhysics(before,await counters(),'inactive structural revisions');
  // Separate structural first-show profile: observe browser paint directly,
  // including the existing continuity slide, rather than timing a driver call.
  await page.evaluate(()=>{
    window.__show1093={};
    const capture=event=>{
      if(!event.composedPath().some(node=>node?.dataset?.hp==='space-tab'&&node.dataset.id==='f2'))return;
      document.removeEventListener('pointerdown',capture,true);
      const start=performance.now(),trusted=event.isTrusted;
      let frames=0;
      const observe=()=>{
        frames++;
        const c=window.__card,root=c.renderRoot;
        if(c._space==='f2'&&!c._slide&&root.querySelector('[data-hp="wall"]')?.getBoundingClientRect().width>0
            &&root.querySelectorAll('[data-hp="device"]').length>=40) {
          window.__show1093={trusted,frames,inputToSettledPaint:performance.now()-start};return;
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    };
    document.addEventListener('pointerdown',capture,true);
  });
  await pick('f2');await tick();
  await page.waitForFunction(()=>Number.isFinite(window.__show1093?.inputToSettledPaint));
  results.firstShowProfile=await page.evaluate(()=>window.__show1093);
  assert.equal(results.firstShowProfile.trusted,true);
  const shown=await page.evaluate(()=>({x:window.__card._spaceModel().rooms[0].poly[0][0],
    walls:window.__card.renderRoot.querySelector('[data-hp="wall"]')?.getBoundingClientRect().width,
    markers:window.__card.renderRoot.querySelectorAll('[data-hp="device"]').length}));
  results.shown=shown;
  assert.ok(Math.abs(shown.x-43)<.001&&shown.walls>0&&shown.markers>=40,'first B frame uses latest geometry');results.latestFloor=true;

  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  before=await counters();
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{cfg.spaces[1].title='Latest hidden document';return cfg;}));
  unchangedPhysics(before,await counters(),'hidden document');
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});await tick();
  assert.ok((await card.locator('nav.tabs').innerText()).includes('Latest hidden document'));
  results.hiddenDocument=true;

  await pick('f1');await page.evaluate(()=>window.__hpTest.setMode('devices'));await tick();
  before=await counters();const oldIds=(await saved()).markers.map(m=>m.id);
  await card.locator('[data-hp="device"][data-id="load-0"]').click({button:'right'});
  await card.locator('[data-hp="device-copy"]').click();
  await page.waitForFunction(ids=>window.__card._serverCfg.markers.some(m=>!ids.includes(m.id)),oldIds);
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);await tick();
  const copy=(await saved()).markers.find(m=>!oldIds.includes(m.id));assert.ok(copy,'native copy creates one new marker');
  await card.locator('[data-device-position-history="undo"]').click();await page.waitForFunction(()=>!window.__card._devicePositionBusy);await tick();
  assert.equal((await saved()).markers.some(m=>m.id===copy.id),false);
  await card.locator('[data-device-position-history="redo"]').click();await page.waitForFunction(()=>!window.__card._devicePositionBusy);await tick();
  assert.deepEqual((await saved()).markers.find(m=>m.id===copy.id),copy,'redo preserves exact copied identity/settings');
  await card.locator(`[data-hp="device"][data-id="${copy.id}"]`).click();
  await card.locator('[data-action="marker-delete"]:visible,[data-action="properties-delete"]:visible').click();
  await card.locator('hp-confirm [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(id=>!window.__card._serverCfg.markers.some(m=>m.id===id),copy.id);
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);await tick();
  assert.equal((await saved()).markers.some(m=>m.id===copy.id),false,'Delete after refused save remains usable');
  assert.equal(await page.evaluate(async id=>Object.hasOwn((await window.__card.hass.callWS({type:'houseplan/layout/get'})).layout,id),copy.id),false);
  unchangedPhysics(before,await counters(),'copy/structural undo/redo/delete',false);results.copyHistory=true;

  // A refusal that is still pending when Copy starts is a different boundary:
  // keep the old fail-closed behavior, then allow a new intent after rollback.
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  const panel=card.locator('[data-hp="properties-panel"]');await panel.waitFor({state:'visible'});
  await card.locator('[data-hp="device"][data-id="load-0"]').click();
  const size=panel.locator('[data-property="size"] input');
  await size.fill('110');await size.press('Enter');
  await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);await tick();
  assert.equal((await saved()).markers.find(m=>m.id==='load-0').size,1.1,'Properties accepts a new edit after historical refusal');
  results.propertiesAfterRefusal=true;
  const originalMarker=(await saved()).markers.find(m=>m.id==='load-0');
  await page.evaluate(()=>{window.__release1093=null;window.__hold1093=true;window.__reject1093=true;});
  await size.fill('120');await size.press('Enter');
  await page.waitForFunction(()=>typeof window.__release1093==='function'&&window.__card._writesPending>0,null,{timeout:6000});
  const pairedBefore=await page.evaluate(()=>window.__paired1093.length);
  await card.locator('[data-hp="device"][data-id="load-0"]').click({button:'right'});
  await card.locator('[data-hp="device-copy"]').click();
  await page.waitForFunction(()=>window.__card._devicePositionBusy);
  await page.evaluate(()=>{window.__hold1093=false;window.__release1093();});
  await page.waitForFunction(()=>!window.__card._devicePositionBusy&&window.__card._writesPending===0);await tick();
  assert.equal(await page.evaluate(()=>window.__paired1093.length),pairedBefore,'pending refusal sends no paired request');
  assert.deepEqual((await saved()).markers.find(m=>m.id==='load-0'),originalMarker,'refused size does not persist');
  assert.equal(await page.evaluate(()=>window.__card._editorRuntime.deviceCopy.lastProfile.outcome),'refused-or-unknown');
  await size.press('Escape');await tick();
  await card.locator('[data-hp="device"][data-id="load-0"]').click({button:'right'});
  await card.locator('[data-hp="device-copy"]').click();
  await page.waitForFunction(ids=>window.__card._serverCfg.markers.some(m=>!ids.includes(m.id)),oldIds);
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);await tick();
  const fresh=(await saved()).markers.find(m=>!oldIds.includes(m.id));assert.ok(fresh,'fresh intent succeeds after pending refusal settles');
  await card.locator(`[data-hp="device"][data-id="${fresh.id}"]`).click();
  await panel.locator('[data-action="properties-delete"]').click();
  await card.locator('hp-confirm [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(id=>!window.__card._serverCfg.markers.some(m=>m.id===id),fresh.id);
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);await tick();
  assert.equal((await saved()).markers.some(m=>m.id===fresh.id),false);results.pendingRefusal=true;
  results.consumers=await runConsumerDemandWitnesses({page,card});
  results.alertDemand=await runAlertDemandWitnesses({page,card});
  results.live=await runLiveInvalidationWitnesses({page,card});
  results.final=await counters();
  if (await reportPageErrors()) throw new Error('Browser page errors');
} catch(error){results.diagnostic=await page.evaluate(()=>({pending:window.__card._writesPending,copy:window.__card._editorRuntime?.deviceCopy.lastProfile,props:window.__card._editorRuntime?.properties.fields.draft,writes:window.__writes1093?.length,held:window.__hold1093,releaser:typeof window.__release1093,alerts:[...window.__card.renderRoot.querySelectorAll('[role="alert"]')].map(n=>n.textContent)}));results.error=error.stack||String(error);process.exitCode=1;}
finally {mkdirSync('artifacts/1093',{recursive:true});writeFileSync(`artifacts/1093/native-dpr${dpr}.json`,JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify(results));
