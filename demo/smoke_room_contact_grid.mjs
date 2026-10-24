/** #1061: synthetic off-grid faces through public Walls click/form and the HA boundary. */
import fs from 'node:fs';
import {launch,checkAll,finish,requirePinnedBrowser,watchPage,reportPageErrors} from './serve.mjs';

requirePinnedBrowser('room source-coordinate fidelity');
const source=JSON.parse(fs.readFileSync(new URL('../test/fixtures/1061-room-candidates.json',import.meta.url),'utf8'))[0].source;
const results={};
let lastBrowser;
for(const [name,clicks,action]of [
  ['first',[.375],'save'],['second',[.625],'save'],['sequential',[.375,.625],'save'],
  ['cancel',[.375],'cancel'],['stale',[.375],'stale'],
]){
  console.log(`SCENARIO ${name}`);
  const {page,browser}=await launch({width:1280,height:960});lastBrowser=browser;
  watchPage(page);
  try{
    await page.evaluate(async source=>{
      await window.__hpTest.setServerConfig(source);await window.__hpTest.setLayout({});
      await window.__hpTest.switchSpace('floor');await window.__hpTest.setMode('plan');
      await window.__hpTest.setTool('draw');await new Promise(r=>setTimeout(r,500));
      await window.__hpTest.settled();
      const card=window.__card,fallback=card.hass.callWS.bind(card.hass);
      const state={saved:structuredClone(card._serverCfg),revision:card._cfgRev,writes:0,reads:0};
      card.hass={...card.hass,callWS:async message=>{
        if(message.type==='houseplan/config/get'){
          state.reads++;return {config:structuredClone(state.saved),rev:state.revision,can_write:true};
        }
        if(message.type!=='houseplan/config/set')return fallback(message);
        if(message.expected_rev!==state.revision)throw Object.assign(new Error('conflict'),{code:'conflict'});
        state.saved=structuredClone(message.config);state.writes++;
        return {ok:true,rev:++state.revision};
      }};
      window.__roomContact=state;
    },source);
    const initial=await page.evaluate(()=>structuredClone(window.__card._serverCfg));
    for(const x of clicks){
      const target=await page.evaluate(x=>{
        const c=window.__card,rect=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb());
        return {x:rect.left+(x*1000-v.x)/v.w*rect.width,y:rect.top+(150-v.y)/v.h*rect.height};
      },x);
      await page.mouse.click(target.x,target.y);
      const dialog=page.locator('hp-dialog[data-kind="room"]');
      await dialog.waitFor({state:'visible'});
      if(action==='cancel')await dialog.locator('.dialog-action-commit [data-hp="dialog-cancel"]').click();
      else{
        await dialog.locator('#room-name').fill(`Synthetic ${x}`);
        if(action==='stale')await page.evaluate(()=>{
          // Ordinary foreign geometry change after the real dialog opened.
          window.__card._curSpaceCfg.partitions[0].cm=25;window.__card.requestUpdate();
        });
        await dialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
      }
      await page.waitForTimeout(850);
      await page.waitForFunction(()=>window.__card._writesPending===0);
    }
    const state=await page.evaluate(()=>({config:structuredClone(window.__card._serverCfg),
      history:window.__card._geometryHistory.size,server:structuredClone(window.__roomContact),toast:window.__card._toast}));
    const space=state.config.spaces[0];
    if(action==='save'){
      results[name]={roomCount:space.rooms.length===clicks.length+1,oneWritePerRoom:state.server.writes===clicks.length,
        oneHistoryPerRoom:state.history===clicks.length,
        exactInheritedScalar:space.rooms.every(r=>r.poly.every(p=>p[1]===0||p[1]===.312345678)),
        oldRoomUnchanged:JSON.stringify(space.rooms[0])===JSON.stringify(initial.spaces[0].rooms[0]),
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
    checkAll(Object.fromEntries(Object.entries(results[name]).map(([key,value])=>[`${name}:${key}`,value])));
  }finally{await browser.close();}
}
await reportPageErrors();
await finish(lastBrowser,results);
