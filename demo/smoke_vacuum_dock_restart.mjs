// #940: real controls/ACK boundaries and current/previous SVG across clients.
import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
import {mkdirSync} from 'node:fs';
requirePinnedBrowser();
const {page,browser}=await launchColdView();
const out={};
const capture=process.argv.includes('--capture');
if(capture)mkdirSync('output/vacuum-940',{recursive:true});
try {
 await page.evaluate(async()=>{
  const old=window.__card,baseWS=old.hass.callWS.bind(old.hass),baseSubscribe=old.hass.connection.subscribeEvents.bind(old.hass.connection);
  window.__addRegistryEntity('vacuum.policy940',null,'cleaning');
  window.__addRegistryEntity('camera.policy940',null,'idle');
  const marker={id:'e_vacuum_policy940',binding:'entity:vacuum.policy940',space:'f1',vacuum:{source:'camera.policy940',trail_mode:'always',map_routes:[{id:'r940',source:'camera.policy940',map_id:'floor',space:'f1',calibration:[1,0,0,0,1,0]}]}};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers,marker]}));
  await window.__hpTest.setLayout(layout=>({...layout,[marker.id]:{s:'f1',x:.1,y:.1}}));
  const run={route_id:'r940',map_id:'floor',path_format:2,paths:[[[100,100],[300,100],[600,500]]],points:[[100,100],[300,100],[600,500]],quality:{source:'native',reason:'ok',raw_points:3},revision:'first'};
  const w=window.__vac940={capability:1,reject:false,hold:false,release:null,sent:[],notify:new Set(),cards:[],sequence:0,
    book:{[marker.id]:{current:run,previous:{...run,paths:[[[40,40],[80,40]]],points:[[40,40],[80,40]],revision:'previous'}}}};
  const hass={...old.hass,connection:{...old.hass.connection,subscribeEvents:async(handler,event)=>{
    if(event==='houseplan_trail_updated'){w.notify.add(handler);return()=>w.notify.delete(handler);}
    return baseSubscribe(handler,event);
  }},states:{...old.hass.states,
    'vacuum.policy940':{entity_id:'vacuum.policy940',state:'cleaning',attributes:{}},
    'camera.policy940':{entity_id:'camera.policy940',state:'idle',attributes:{map_name:'floor',robot_position:{x:900,y:900},path:[[888,888],[999,999]]}}},
    callWS:async message=>{
      if(message.type==='houseplan/trail/get')return {trail_format:2,trails:structuredClone(w.book)};
      if(message.type==='houseplan/config/get')return {...await baseWS(message),vacuum_dock_restart_api:w.capability};
      if(message.type==='houseplan/config/set'){
        w.sent.push(structuredClone(message));
        if(w.hold)await new Promise(resolve=>{w.release=resolve;});
        if(w.reject)throw new Error('synthetic policy refusal');
      }
      return baseWS(message);
    }};
  const first=document.createElement('houseplan-card');first.hass=hass;first.setConfig({type:'custom:houseplan-card',language:'en'});
  old.replaceWith(first);window.__card=first;w.cards.push(first);
  const second=document.createElement('houseplan-card');second.hass=hass;second.setConfig({type:'custom:houseplan-card',language:'en',kiosk:true});
  second.style.cssText='display:block;width:1000px;height:700px';document.body.append(second);w.cards.push(second);
  w.publish=async paths=>{
    const count=paths.reduce((n,p)=>n+p.length,0);
    w.book[marker.id].current={...run,paths,points:paths.at(-1)||[],revision:String(++w.sequence),quality:{source:'native',reason:paths.length?'ok':'empty_integration',raw_points:count,stored_points:count}};
    await Promise.all([...w.notify].map(notify=>notify({data:{}})));
    await Promise.all(w.cards.map(card=>card.updateComplete));await window.__hpTest.settled();
  };
  w.geometry=()=>w.cards.map(card=>{
    const root=card.renderRoot,current=root.querySelector('.vactrail > path.core'),previous=root.querySelector('.vactrail .prev path.core');
    const device=card._devices.find(d=>d.id===marker.id);
    return {current:current?.getAttribute('d')||'',previous:previous?.getAttribute('d')||'',tip:!!root.querySelector('.vactrail line.tip'),
      puck:!!root.querySelector('.vacpuck[data-mid="e_vacuum_policy940"]'),diagnostic:device?card._vacTrailDiagnostics(device):null};
  });
 });
 await page.waitForFunction(()=>window.__vac940.cards.every(c=>c._loadOk&&c._vacSrvTrails.e_vacuum_policy940?.current));
 await page.evaluate(()=>window.__hpTest.settled());
 for(const iso of [false,true]){
  await page.evaluate(on=>window.__hpTest.setVolumetricView(on),iso);
  await page.evaluate(()=>window.__vac940.publish([[[100,100],[300,100],[600,500]]]));
  let frames=await page.evaluate(()=>window.__vac940.geometry());
  out[`native_${iso?'iso':'flat'}_both_clients`]=frames.every(f=>f.current.endsWith('600 500')&&!f.tip&&f.puck&&f.previous);
  await page.evaluate(()=>window.__vac940.publish([]));
  frames=await page.evaluate(()=>window.__vac940.geometry());
  out[`empty_${iso?'iso':'flat'}_no_stale_current`]=frames.every(f=>!f.current&&!f.tip&&f.previous&&f.puck);
  out[`empty_${iso?'iso':'flat'}_honest_diagnostics`]=frames.every(f=>f.diagnostic.source==='native'&&f.diagnostic.reason==='empty_integration'&&f.diagnostic.raw===0&&f.diagnostic.stored===0&&f.diagnostic.rendered===0);
  await page.evaluate(()=>window.__vac940.publish([[[20,20]]]));
  frames=await page.evaluate(()=>window.__vac940.geometry());
  out[`singleton_${iso?'iso':'flat'}`]=frames.every(f=>f.diagnostic.raw===1&&f.diagnostic.stored===1&&!f.tip&&!f.current.includes('600 500'));
  await page.evaluate(()=>window.__vac940.publish([]));
  out[`second_empty_${iso?'iso':'flat'}`]=(await page.evaluate(()=>window.__vac940.geometry())).every(f=>!f.current&&f.diagnostic.raw===0);
 }
 await page.evaluate(async()=>{await window.__hpTest.setMode('devices');await window.__hpTest.openMarkerDialog('e_vacuum_policy940');});
 const dialog=page.locator('houseplan-card hp-dialog[data-kind="marker"]');
 await dialog.locator('[data-section-target="vacuum"]').click();
 const toggle=dialog.locator('#marker-vacuum-dock-restart');await toggle.waitFor({state:'visible'});
 out.label_explains_fallback=await toggle.getAttribute('aria-label')==='New path after docking when no integration path is available';
 out.default_off=!(await toggle.isChecked())&&!(await toggle.isDisabled());
 out.placement=await toggle.evaluate(input=>{const section=input.closest('.hpf-section'),colour=section.previousElementSibling;return !!colour?.querySelector('.vacuum-trail-color')&&!!colour.previousElementSibling?.querySelector('[data-help="vacuum-trail"]')&&!!section.nextElementSibling?.querySelector('.vacbtns');});
 await page.evaluate(()=>{window.__vac940.hold=true;});
 const before=await page.evaluate(()=>window.__vac940.sent.length);
 await toggle.focus();await page.keyboard.press('Space');
 await page.waitForFunction(n=>window.__vac940.sent.length>n,before);
 out.pending_no_early_policy=await page.evaluate(()=>window.__card._serverCfg.markers.find(m=>m.id==='e_vacuum_policy940').vacuum.new_run_after_dock===undefined);
 out.pending_disabled_old_value=await toggle.isDisabled()&&!(await toggle.isChecked());
 await page.evaluate(()=>{window.__vac940.hold=false;window.__vac940.release();});
 await page.evaluate(()=>window.__hpTest.waitForWrites());
 out.ack_persists=await toggle.isChecked()&&!(await toggle.isDisabled());
 await page.evaluate(()=>{window.__vac940.reject=true;});
 await toggle.focus();await page.keyboard.press('Space');
 await page.evaluate(async()=>{try{await window.__hpTest.waitForWrites();}catch(error){if(!String(error).includes('synthetic policy refusal'))throw error;}});
 out.refusal_retains_accepted=await toggle.isChecked()&&await page.evaluate(()=>window.__card._serverCfg.markers.find(m=>m.id==='e_vacuum_policy940').vacuum.new_run_after_dock===true&&String(window.__card._toast).includes('synthetic policy refusal'));
 await page.evaluate(()=>{window.__vac940.reject=false;});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>window.__hpTest.openMarkerDialog('e_vacuum_policy940'));
 await dialog.locator('[data-section-target="vacuum"]').click();
 out.reopen_keeps_choice=await toggle.isChecked();
 await toggle.scrollIntoViewIfNeeded();
 if(capture)await page.screenshot({path:'output/vacuum-940/desktop.png'});
 await page.setViewportSize({width:360,height:800});
 await page.evaluate(()=>window.__hpTest.settled());
 await toggle.scrollIntoViewIfNeeded();
 out.narrow_hint_wraps=await toggle.evaluate(input=>{const row=input.closest('.hpf-toggle'),r=row.getBoundingClientRect();return row.scrollWidth<=row.clientWidth+1&&r.width>0;});
 if(capture)await page.screenshot({path:'output/vacuum-940/narrow.png'});
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.setViewportSize({width:1200,height:900});
 await page.evaluate(async()=>{
  const card=window.__card,source=card.hass.states['camera.policy940'];
  const attributes={...source.attributes};delete attributes.robot_position;
  card.hass={...card.hass,states:{...card.hass.states,'camera.policy940':{...source,attributes}}};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:cfg.markers.map(m=>m.id==='e_vacuum_policy940'?{...m,vacuum:{...m.vacuum,live:false}}:m)}));
  await window.__hpTest.openMarkerDialog('e_vacuum_policy940');
 });
 await dialog.locator('[data-section-target="vacuum"]').click();
 out.policy_available_without_position_and_live_off=await toggle.isVisible()&&!(await toggle.isDisabled())&&await toggle.isChecked();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(async()=>{
  window.__vac940.capability=undefined;
  await window.__hpTest.setServerConfig(cfg=>({...cfg,settings:{...cfg.settings,show_room_tooltip:false}}));
  await window.__hpTest.openMarkerDialog('e_vacuum_policy940');
 });
 await dialog.locator('[data-section-target="vacuum"]').click();
 out.unsupported_keeps_true_disabled=await toggle.isChecked()&&await toggle.isDisabled();
 out.unsupported_explains_update=(await dialog.textContent()).includes('Update House Plan and restart Home Assistant');
 checkAll(out);
} catch(error) { checkAll({scenario_completed:false});throw error;
} finally { await finish(browser); }
