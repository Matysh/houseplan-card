import {readFileSync} from 'node:fs';
const producer=JSON.parse(readFileSync(new URL('../../test/fixtures/vacuum-history/dreame-tasshack-2.0.2.json',import.meta.url),'utf8'));
export const HISTORY_IDS={marker:'e_vacuum_history999',a:'a'.repeat(64),b:'b'.repeat(64)};
/** Synthetic transport; all product UI, owner, source resolver and SVG stay real. */
export async function prepareVacuumHistory(page,{peer=true,collision=false}={}){
 await page.evaluate(async({producer,ids,peer,collision})=>{
  const old=window.__card,base=old.hass.callWS.bind(old.hass),subscribe=old.hass.connection.subscribeEvents.bind(old.hass.connection);
  window.__addRegistryEntity('vacuum.history999',null,'cleaning');
  window.__addRegistryEntity('camera.history999',null,'idle');
  const route={id:'history999-route',source:'camera.history999',map_id:'floor',space:'f1',calibration:[.1,0,100,0,.1,100]};
  const marker={id:ids.marker,binding:'entity:vacuum.history999',space:'f1',vacuum:{source:route.source,trail_mode:'always',map_routes:[route]}};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers,marker]}));
  await window.__hpTest.setLayout(layout=>({...layout,[marker.id]:{s:'f1',x:.1,y:.1}}));
  const run={map_id:'floor',route_id:route.id,path_format:2,paths:[[[200,200],[1000,1000],[2000,1500]]],
    quality:{source:'native',reason:'ok',raw_points:3},revision:'live-first'};
  const w=window.__history999={marker,route,records:[{id:ids.a,timestamp:1792800000+(collision?10:0)},
    {id:ids.b,timestamp:collision?1792800040:1792796400}],revision:'f'.repeat(64),epoch:'c'.repeat(32),
    cap:1,canWrite:true,hold:false,listHold:false,getError:null,listError:null,pending:[],pendingLists:[],requests:[],writes:[],services:[],
    notify:new Set(),cards:[],book:{[ids.marker]:{current:run,previous:{...run,paths:[[[500,500],[1500,500]]],revision:'previous'}}}};
  w.material=id=>({version:1,...w.records.find(row=>row.id===id),revision:w.revision,epoch:w.epoch,route,
    completed:true,vacuum:'vacuum.history999',paths:id===ids.a?producer.payload.path.map(chunk=>Array.from({length:(chunk.length-1)/2},(_,i)=>[chunk[i*2+1],chunk[i*2+2]]))
      :[[[500,2000],[1800,2000]],[[2500,2000],[2500,3000]]]});
  const hass={...old.hass,config:{...old.hass.config,time_zone:'Europe/Moscow'},
    connection:{...old.hass.connection,subscribeEvents:async(handler,event)=>{
      if(event==='houseplan_trail_updated'){w.notify.add(handler);return()=>w.notify.delete(handler);}
      return subscribe(handler,event);
    }},states:{...old.hass.states,'vacuum.history999':{state:'cleaning',attributes:{}},
      'camera.history999':{state:'idle',attributes:{map_name:'floor',robot_position:{x:600,y:400}}}},
    callService:async(...args)=>{w.services.push(args);},
    callWS:async message=>{
      if(message.type==='houseplan/config/get')return {...await base(message),vacuum_history_api:w.cap,can_write:w.canWrite};
      if(message.type==='houseplan/trail/get')return {trail_format:2,trails:structuredClone(w.book),
        vacuum_history_epochs:{default:w.epoch,markers:{}}};
      if(message.type==='houseplan/vacuum/history/list'){
        w.requests.push(structuredClone(message));
        if(w.listError)throw {code:w.listError};
        const result={version:1,records:structuredClone(w.records),revision:w.revision,epoch:w.epoch,limited:false};
        if(w.listHold)await new Promise(resolve=>w.pendingLists.push(resolve));
        return result;
      }
      if(message.type==='houseplan/vacuum/history/get'){
        w.requests.push(structuredClone(message));
        if(w.getError)throw {code:w.getError};
        const result=w.material(message.record_id);
        if(w.hold)await new Promise(resolve=>w.pending.push({resolve,message:structuredClone(message)}));
        return result;
      }
      if(/^houseplan\/(config|layout)\//.test(message.type)&&!message.type.endsWith('/get'))w.writes.push(structuredClone(message));
      return base(message);
    }};
  const first=document.createElement('houseplan-card');first.hass=hass;first.setConfig({type:'custom:houseplan-card',language:'en',cycle:0});
  old.replaceWith(first);window.__card=first;w.cards.push(first);
  w.remount=async(options={})=>{
    const previous=w.cards[0],fresh=document.createElement('houseplan-card');
    fresh.hass=previous.hass;fresh.setConfig({type:'custom:houseplan-card',language:'en',cycle:0,...options});
    previous.replaceWith(fresh);window.__card=fresh;w.cards[0]=fresh;
    await window.__hpTest.settled();
  };
  if(peer){const second=document.createElement('houseplan-card');second.hass=hass;second.setConfig({type:'custom:houseplan-card',language:'en',cycle:0});
    second.style.cssText='display:block;width:1000px;height:700px';document.body.append(second);w.cards.push(second);}
  w.geometry=()=>w.cards.map(card=>({
    history:card.renderRoot.querySelector('[data-kind="history"]')?.getAttribute('d')??'',
    current:card.renderRoot.querySelector(`path[data-kind=current][data-vacuum-owner="${ids.marker}"]`)?.getAttribute('d')??'',
    previous:card.renderRoot.querySelector(`[data-kind=previous][data-vacuum-owner="${ids.marker}"] path`)?.getAttribute('d')??'',
    tips:card.renderRoot.querySelectorAll(`line.tip[data-mid="${ids.marker}"]`).length,
    puck:!!card.renderRoot.querySelector(`.vacpuck[data-mid="${ids.marker}"]`),
    banner:card.renderRoot.querySelector('[data-hp=vacuum-history-banner]')?.textContent??'',
  }));
  w.publish=async()=>{await Promise.all([...w.notify].map(callback=>callback({data:{}})));await Promise.all(w.cards.map(card=>card.updateComplete));await window.__hpTest.settled();};
 },{producer,ids:HISTORY_IDS,peer,collision});
 await page.waitForFunction(()=>window.__history999.cards.every(card=>card._loadOk&&card._vacSrvTrails.e_vacuum_history999));
 await page.evaluate(()=>window.__hpTest.settled());
}
export async function openVacuumHistory(page,markerId=HISTORY_IDS.marker){
 await page.evaluate(async id=>{await window.__hpTest.setMode('devices');await window.__hpTest.openMarkerDialog(id);},markerId);
 const dialog=page.locator('houseplan-card').first().locator('hp-dialog[data-kind=marker]');
 const tab=dialog.locator('[data-section-target=vacuum]');
 if(await tab.isVisible())await tab.click();
 else{
  const navigation=dialog.locator('.hpf-settings-mobile hp-settings-select');
  const label=await navigation.locator('option[value=vacuum]').textContent();
  await navigation.locator('button').click();await navigation.getByRole('option',{name:label.trim(),exact:true}).click();
 }
 const history=dialog.locator('[data-hp=vacuum-history]');await history.waitFor({state:'visible'});
 await page.waitForFunction(()=>!window.__card._vacHistory.loadingList);
 return {dialog,history,show:history.locator('[data-hp=vacuum-history-show]'),hide:history.locator('[data-hp=vacuum-history-hide]')};
}
export async function chooseVacuumHistory(page,history,id){
 const label=await page.evaluate(id=>window.__card._vacHistory.label(id),id);
 await history.locator('hp-settings-select button').click();
 await history.getByRole('option',{name:label,exact:true}).click();
}
