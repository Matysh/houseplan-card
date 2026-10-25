/** #1061: synthetic off-grid faces through public Walls click/form and the HA boundary. */
import fs from 'node:fs';
import {launch,checkAll,finish,requirePinnedBrowser,watchPage,reportPageErrors} from './serve.mjs';

requirePinnedBrowser('room source-coordinate fidelity');
const inputs=JSON.parse(fs.readFileSync(new URL('../test/fixtures/1061-room-candidates.json',import.meta.url),'utf8'));
const results={};
let lastBrowser;
for(const [name,clicks,action]of [
  ['first',[.375],'save'],['second',[.625],'save'],['sequential',[.375,.625],'save'],
  ['on-grid',[.375],'save'],['cancel',[.375],'cancel'],['stale',[.375],'stale'],
  ['view',[.375],'view'],['shift',[.375],'shift'],
]){
  console.log(`SCENARIO ${name}`);
  const {page,browser}=await launch({width:1280,height:960});lastBrowser=browser;
  watchPage(page);
  try{
    const source=inputs[name==='on-grid'?3:0].source;
    await page.evaluate(async ({source,action})=>{
      await window.__hpTest.setServerConfig(source);await window.__hpTest.setLayout({});
      await window.__hpTest.switchSpace('floor');await window.__hpTest.setMode(action==='view'?'view':'plan');
      if(action!=='view')await window.__hpTest.setTool('draw');
      await new Promise(r=>setTimeout(r,500));
      await window.__hpTest.settled();
      const card=window.__card,fallback=card.hass.callWS.bind(card.hass);
      const state={saved:structuredClone(card._serverCfg),revision:card._cfgRev,writes:0,reads:0};
      card.hass={...card.hass,callWS:async message=>{
        if(message.type==='houseplan/config/get'){
          state.reads++;
          if(state.external){
            const response=await fallback(message);
            state.saved=structuredClone(response.config);state.revision=response.rev;
            return response;
          }
          return {config:structuredClone(state.saved),rev:state.revision,can_write:true};
        }
        if(message.type!=='houseplan/config/set')return fallback(message);
        if(message.expected_rev!==state.revision)throw Object.assign(new Error('conflict'),{code:'conflict'});
        state.saved=structuredClone(message.config);state.writes++;
        return {ok:true,rev:++state.revision};
      }};
      window.__roomContact=state;
    },{source,action});
    const initial=await page.evaluate(()=>structuredClone(window.__card._serverCfg));
    for(const x of clicks){
      const target=await page.evaluate(x=>{
        const c=window.__card,rect=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb());
        return {x:rect.left+(x*1000-v.x)/v.w*rect.width,y:rect.top+(150-v.y)/v.h*rect.height};
      },x);
      if(action==='shift')await page.keyboard.down('Shift');
      try{await page.mouse.click(target.x,target.y);}finally{
        if(action==='shift')await page.keyboard.up('Shift');
      }
      if(action==='view'||action==='shift')continue;
      const dialog=page.locator('hp-dialog[data-kind="room"]');
      await dialog.waitFor({state:'visible'});
      if(action==='cancel')await dialog.locator('.dialog-action-commit [data-hp="dialog-cancel"]').click();
      else{
        await dialog.locator('#room-name').fill(`Synthetic ${x}`);
        if(action==='stale')await page.evaluate(async()=>{
          const state=window.__roomContact,next=structuredClone(state.saved);
          next.spaces[0].partitions[0].cm=25;state.external=true;
          // Existing public fixture server event, followed by real authoritative adoption.
          await window.__hpTest.setServerConfig(next);
        });
        const confirm=dialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]');
        if(action!=='stale'||await confirm.isVisible())await confirm.click();
      }
      await page.waitForTimeout(850);
      await page.waitForFunction(()=>window.__card._writesPending===0);
    }
    const state=await page.evaluate(()=>({config:structuredClone(window.__card._serverCfg),
      history:window.__card._geometryHistory.size,server:structuredClone(window.__roomContact),
      roomDialog:!!window.__card._roomDialog,pathLength:window.__card._path.length,toast:window.__card._toast}));
    const space=state.config.spaces[0];
    if(action==='save'){
      results[name]={roomCount:space.rooms.length===clicks.length+1,oneWritePerRoom:state.server.writes===clicks.length,
        oneHistoryPerRoom:state.history===clicks.length,
        exactInheritedScalar:space.rooms.every(r=>r.poly.every(p=>p[1]===0||p[1]===(name==='on-grid'?0.3125:0.312345678))),
        oldRoomUnchanged:JSON.stringify(space.rooms[0])===JSON.stringify(initial.spaces[0].rooms[0]),
        openingUnchanged:JSON.stringify(space.openings)===JSON.stringify(initial.spaces[0].openings),
        unrelatedFloorUnchanged:JSON.stringify(state.config.spaces[1])===JSON.stringify(initial.spaces[1]),
        markersUnchanged:JSON.stringify(state.config.markers)===JSON.stringify(initial.markers),
        durablePair:JSON.stringify(state.server.saved)===JSON.stringify(state.config)};
      const button=icon=>page.locator('[data-hp="toolbar"][data-kind="plan"] button')
        .filter({has:page.locator(`ha-icon[icon="mdi:${icon}-variant"]`)});
      await button('undo').click();await page.waitForTimeout(850);
      results[name].undo=await page.evaluate(count=>window.__card._curSpaceCfg.rooms.length===count,clicks.length);
      await button('redo').click();await page.waitForTimeout(850);
      results[name].redo=await page.evaluate(before=>JSON.stringify(window.__card._serverCfg)===before,JSON.stringify(state.config));
      await page.evaluate(()=>{const old=window.__card,next=document.createElement('houseplan-card');
        next.setConfig({type:'custom:houseplan-card'});next.hass=old.hass;old.replaceWith(next);window.__card=next;});
      await page.waitForFunction(count=>window.__card._serverCfg?.spaces?.[0]?.rooms?.length===count,clicks.length+1);
      results[name].reload=await page.evaluate(before=>JSON.stringify(window.__card._serverCfg)===before,JSON.stringify(state.config));
    }else results[name]={noWrite:state.server.writes===0,noHistory:state.history===0,noRoom:space.rooms.length===1};
    if(action==='view')results[name].noEditorDialog=!state.roomDialog;
    if(action==='shift')results[name].startsOrdinaryChain=state.pathLength===1&&!state.roomDialog;
    if(action==='stale')results[name].foreignGeometryAdopted=space.partitions[0].cm===25&&state.server.reads>0;
    checkAll(Object.fromEntries(Object.entries(results[name]).map(([key,value])=>[`${name}:${key}`,value])));
  }finally{await browser.close();}
}
if (await reportPageErrors()) throw new Error('Uncaught card exception during room source-coordinate smoke');
await finish(lastBrowser,results);
