import {test,expect} from '@playwright/test';
import {planConfig,planLayout,wsCall} from './lib/ha-ws.mjs';
import {evidence,expectPlanDrawn,spaceEntries} from './lib/ha-page.mjs';
import {HP,hp} from './lib/hooks.mjs';
import {enterEditor,field,selectSpace} from './lib/plan.mjs';
import {holdConfigReply} from './lib/held-config-reply.mjs';
import {requirePanelBeta4,restorePanelPlan,orderedFixture,expectFloor,openKiosk,
  expectKiosk,camera,observeApplicationIo,writeConfig,card,stage,settle,navigateInApp,swipe,holdFirstConfigGet} from './lib/panel-kiosk-journeys.mjs';

test.beforeEach(()=>requirePanelBeta4(test));
restorePanelPlan(test);
test.setTimeout(180_000);

test('1103-1 cold path and query kiosk remove both headers and all editor entries',async({page},info)=>{
  const config=await orderedFixture();
  for(const url of ['/houseplan/kiosk','/houseplan?hpkiosk=1']){
    await page.goto('/houseplan');await expectPlanDrawn(page);const selected=await page.locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort());
    await page.goto(url);const host=card(page);await expectPlanDrawn(page,host);await expectKiosk(host);
    expect(await host.locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort())).toEqual(selected);
    expect(config.spaces.length).toBeGreaterThanOrEqual(3);
  }
  await evidence(info,page,'cold-kiosk-no-outer-header');
});

test('1103-2/3 position follows ordinary UI order and path keeps foreign query encoding and hash',async({page})=>{
  const config=await orderedFixture();await page.goto('/houseplan');const host=card(page);await expectPlanDrawn(page,host);
  expect(await spaceEntries(host).evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-space')??n.value))).toEqual(config.spaces.map(s=>s.id));
  await openKiosk(page,'/houseplan?foreign=keep&hpspace=2&hpkiosk=1',config.spaces[1]);
  await openKiosk(page,'/houseplan/kiosk/2?hpspace=3&hpkiosk=0&foreign=a%2Fb#keep-marker',config.spaces[1]);
  const url=new URL(page.url());expect(url.searchParams.get('foreign')).toBe('a/b');expect(url.search).toContain('foreign=a%2Fb');expect(url.hash).toBe('#keep-marker');
});

test('1103-4 malformed positions show all floors; fixed position resists hash and native swipe',async({page})=>{
  const config=await orderedFixture();await openKiosk(page,'/houseplan/kiosk/2',config.spaces[1]);
  const host=card(page);await page.evaluate(id=>{location.hash=`#space=${id}`;},config.spaces[2].id);
  await swipe(page,host);await expectFloor(host,config.spaces[1]);
  for(const value of ['0','text','1.5','99999999999999999999'])for(const url of [
    `/houseplan?hpkiosk=1&hpspace=${value}`,`/houseplan/kiosk/${value}`,
  ]){
    await navigateInApp(page,url);await expectKiosk(host);
    const before=await host.locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort());
    const target=await swipe(page,host);await expectFloor(host,target);
    expect(await host.locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort())).not.toEqual(before);
  }
});

test('1103-5 SPA, Back/Forward and foreign query preserve the mounted card, camera and actual IO',async({page})=>{
  const config=await orderedFixture(),io=observeApplicationIo(page);
  await openKiosk(page,'/houseplan/kiosk/2',config.spaces[1]);const host=card(page),node=await host.elementHandle();
  await stage(host).hover();await page.mouse.wheel(0,-200);await settle(host);const beforeCamera=await camera(host),before=io.snapshot();
  await navigateInApp(page,'/houseplan/kiosk/2?foreign=a%2Fb');await settle(host);
  expect(await camera(host)).toEqual(beforeCamera);expect(io.snapshot()).toEqual(before);expect(await node.evaluate(el=>el.isConnected)).toBe(true);
  await navigateInApp(page,'/houseplan?hpkiosk=1&hpspace=2');await expectFloor(host,config.spaces[1]);
  await page.goBack();await expect(page).toHaveURL(/\/kiosk\/2\?foreign=/);await expectFloor(host,config.spaces[1]);
  await page.goForward();await expect(page).toHaveURL(/hpspace=2/);await expectFloor(host,config.spaces[1]);
  await navigateInApp(page,'/houseplan');await expect(host.locator(HP.editorTabs)).toHaveCount(3);
  for(const editor of await host.locator(HP.editorTabs).all())await expect(editor).toBeVisible();
  const after=io.snapshot();expect(after.configGet).toBe(before.configGet);expect(after.layoutGet).toBe(before.layoutGet);expect(after.writes).toBe(before.writes);expect(after.navigations).toBe(before.navigations);
});

test('1103-7 true HA leave ends editor, remount does not retain old actions',async({page})=>{
  const config=await orderedFixture();await page.goto('/houseplan');const host=card(page);await expectPlanDrawn(page,host);
  await enterEditor(host,'plan');const old=await host.elementHandle();
  await page.locator('ha-sidebar a[href="/house-plan"]').first().click();await expect(page).toHaveURL(/\/house-plan/);
  expect(await old.evaluate(el=>el.isConnected)).toBe(false);
  await page.locator('ha-sidebar a[href="/houseplan"]').first().click();await expectPlanDrawn(page);
  await expect(card(page).locator(HP.mode('view'))).toBeVisible();
  await navigateInApp(page,'/houseplan/kiosk/2');await expectFloor(card(page),config.spaces[1]);await expectKiosk(card(page));
});

test('1103-8 another real client reorders floors; a genuinely stale cold cache waits for the authoritative roster',async({page,browser})=>{
  const config=await orderedFixture();await openKiosk(page,'/houseplan/kiosk/2',config.spaces[1]);
  let storageState;
  // Snapshot the authentic browser storage BEFORE the other client changes the roster.
  // Keep tokens only in memory; nothing from this object is logged or attached.
  await expect.poll(async()=>{storageState=await page.context().storageState();
    return storageState.origins.some(origin=>origin.localStorage.some(row=>row.value.includes('Zeta E2E')));
  },{message:'the real warm browser must have persisted its old roster'}).toBe(true);
  const reordered=await writeConfig(c=>{[c.spaces[0],c.spaces[1]]=[c.spaces[1],c.spaces[0]];});
  await expectFloor(card(page),reordered.spaces[1]);
  const coldContext=await browser.newContext({storageState,baseURL:new URL(page.url()).origin,
    viewport:{width:1280,height:800},locale:'en-US'});
  try{
    const cold=await coldContext.newPage(),hold=await holdFirstConfigGet(cold);
    await cold.addInitScript(()=>{
      window.__panelRoomSamples=[];window.__panelSampleFrames=0;
      const frame=()=>{
        window.__panelSampleFrames++;
        const visit=root=>{for(const node of root.querySelectorAll('*')){if(node.localName==='houseplan-card'){
          const rooms=[...(node.shadowRoot??node).querySelectorAll('[data-hp="room"]')].map(n=>n.dataset.id).sort();
          if(rooms.length)window.__panelRoomSamples.push(rooms);
        }if(node.shadowRoot)visit(node.shadowRoot);}};
        visit(document);requestAnimationFrame(frame);
      };requestAnimationFrame(frame);
    });
    await cold.goto('/houseplan/kiosk/2',{waitUntil:'domcontentloaded'});await hold.reached;
    await cold.waitForTimeout(250);
    const waiting=await cold.evaluate(()=>({frames:window.__panelSampleFrames,rooms:window.__panelRoomSamples}));
    expect(waiting.frames,'the cold-frame observer really ran').toBeGreaterThan(0);
    const expected=reordered.spaces[1].rooms.map(room=>room.id).sort();
    expect(waiting.rooms.every(ids=>JSON.stringify(ids)===JSON.stringify(expected)),
      'blank while awaiting authority is allowed; painting the stale old floor is not').toBe(true);
    hold.release();await expectFloor(card(cold),reordered.spaces[1]);
    expect((await planConfig()).config.spaces.map(space=>space.id)).toEqual(reordered.spaces.map(space=>space.id));
  }finally{await coldContext.close();}
});

test('1103-8 add/remove changes an out-of-range URL between all floors and a real fixed floor',async({page})=>{
  const config=await orderedFixture(),position=config.spaces.length+1;
  await page.goto(`/houseplan/kiosk/${position}`);await expectPlanDrawn(page);await expectKiosk(card(page));
  const added=await writeConfig(c=>{
    const space=structuredClone(c.spaces[0]);space.id='e2e-kiosk-added';space.title='Added E2E';space.rooms.forEach((room,i)=>{room.id=`e2e-added-room-${i}`;});c.spaces.push(space);
    c.markers.push({id:'e2e-kiosk-floor-witness',binding:'virtual',space:space.id,name:'Added floor witness',icon:'mdi:home'});
  });
  const layout=await planLayout(),room=added.spaces.at(-1).rooms[0],point=room.poly.reduce((p,q)=>[p[0]+q[0]/room.poly.length,p[1]+q[1]/room.poly.length],[0,0]);
  await wsCall({type:'houseplan/layout/set',expected_rev:layout.rev,layout:{...layout.layout,'e2e-kiosk-floor-witness':{s:'e2e-kiosk-added',x:point[0],y:point[1]}}});
  await expect(card(page).locator(hp('device',{id:'e2e-kiosk-floor-witness'}))).toBeVisible();
  await swipe(page,card(page));await expect(card(page).locator(hp('device',{id:'e2e-kiosk-floor-witness'}))).toBeVisible();
  await writeConfig(c=>{c.spaces=c.spaces.filter(s=>s.id!=='e2e-kiosk-added');c.markers=c.markers.filter(m=>m.id!=='e2e-kiosk-floor-witness');});
  await expect(card(page).locator(hp('device',{id:'e2e-kiosk-floor-witness'}))).toHaveCount(0);
  const before=await card(page).locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort());const target=await swipe(page,card(page));await expectFloor(card(page),target);
  await expect.poll(()=>card(page).locator(hp('room')).evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort())).not.toEqual(before);
});

test('1103-10 dirty device draft Keep retains input/URL; Discard enters exactly the requested kiosk without a write',async({page})=>{
  const config=await orderedFixture(),markerId='lg_sensor.ground_floor_temperature',before=config.markers.find(m=>m.id===markerId)?.name;
  const io=observeApplicationIo(page);await page.goto('/houseplan');const host=card(page);await expectPlanDrawn(page,host);await selectSpace(host,'f1');await enterEditor(host,'devices');
  await host.locator(hp('device',{id:markerId})).dblclick();const dialog=host.locator(HP.dialog('marker')).first();await field(dialog,'marker-name').fill('Unsaved kiosk draft');
  const previousUrl=page.url(),writes=io.snapshot().writes,target='/houseplan/kiosk/2?foreign=keep';
  await navigateInApp(page,target);const confirm=host.locator(HP.dialog('confirm')).first();await expect(confirm).toBeVisible();await confirm.locator(HP.dialogCancel).first().click();
  await expect(field(dialog,'marker-name')).toHaveValue('Unsaved kiosk draft');expect(page.url()).toBe(previousUrl);
  await navigateInApp(page,target);await expect(confirm).toBeVisible();await confirm.locator(HP.dialogConfirm).first().click();
  await expect(page).toHaveURL(new RegExp('/houseplan/kiosk/2\\?foreign=keep$'));await expectFloor(host,config.spaces[1]);await expectKiosk(host);
  expect((await planConfig()).config.markers.find(m=>m.id===markerId)?.name).toBe(before);expect(io.snapshot().writes).toBe(writes);
});

test('1103-10 late real Save reply cannot act on the replacement HA panel',async({page})=>{
  const config=await orderedFixture(),hold=await holdConfigReply(page),markerId='lg_sensor.ground_floor_temperature';
  // Establish real HA history before opening a busy modal. Its overlay
  // correctly blocks sidebar pointer input while the real ACK is held.
  await page.goto('/house-plan');await expectPlanDrawn(page);
  await page.locator('ha-sidebar a[href="/houseplan"]').first().click();
  const host=card(page);await expectPlanDrawn(page,host);const old=await host.elementHandle();await selectSpace(host,'f1');await enterEditor(host,'devices');
  await host.locator(hp('device',{id:markerId})).dblclick();const dialog=host.locator(HP.dialog('marker')).first();await field(dialog,'marker-name').fill('Stored before late ACK');
  const reached=hold.arm();await dialog.locator(HP.dialogConfirm).first().click();expect((await reached).reply.success).toBe(true);
  await page.goBack();await expect(page).toHaveURL(/\/house-plan/);
  await expect.poll(()=>old.evaluate(el=>el.isConnected)).toBe(false);
  await page.locator('ha-sidebar a[href="/houseplan"]').first().click();
  await expectPlanDrawn(page);await navigateInApp(page,'/houseplan/kiosk/2');await expectFloor(card(page),config.spaces[1]);const count=hold.writes.length;
  hold.release();await settle(card(page));await expectFloor(card(page),config.spaces[1]);await expectKiosk(card(page));expect(hold.writes.length).toBe(count);
  expect((await planConfig()).config.markers.find(m=>m.id===markerId)?.name).toBe('Stored before late ACK');
});
