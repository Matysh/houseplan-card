/** #1175: delayed telemetry and native ACK cannot strand an animated puck in the real panel. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {launchPanelCold,requirePinnedBrowser,check,finish} from './serve.mjs';
import {assertFreshDemoBundleUnlessAllowed} from './bundle-freshness.mjs';
requirePinnedBrowser('#1175 continuous native/live vacuum path');
const folder='artifacts/1175-vacuum-tail';mkdirSync(folder,{recursive:true});
const {page,browser}=await launchPanelCold({width:1200,height:900});
const evidence={modes:[]};let controlWrites=0;
try{
 await page.evaluate(async()=>{
  const base=window.__mkHass(),ws=base.callWS.bind(base),subscribe=base.connection.subscribeEvents.bind(base.connection);
  window.__addRegistryEntity('vacuum.tail1175',null,'cleaning');
  window.__addRegistryEntity('camera.tail1175',null,'idle');
  const marker={id:'e_tail1175',binding:'entity:vacuum.tail1175',space:'f1',vacuum:{source:'camera.tail1175',
   trail_mode:'always',trail_color:'#FF00FF',trail_opacity:1,map_routes:[{id:'route1175',source:'camera.tail1175',
    map_id:'floor',space:'f1',calibration:[1,0,0,0,1,0]}]}};
  const {config}=await ws({type:'houseplan/config/get'}),{layout}=await ws({type:'houseplan/layout/get'});
  window.__pushServerConfig({...config,markers:[...config.markers,marker],
   spaces:config.spaces.map(s=>s.id==='f1'?{...s,cell_cm:1}:s)});
  window.__pushServerLayout({...layout,[marker.id]:{s:'f1',x:.1,y:.1}});
  const now=Date.now(),stamp=now-11000;
  const f=window.__tail1175={listeners:new Set(),writes:0,reads:0,stamp,run:{map_id:'floor',route_id:'route1175',path_format:2,
   paths:[[[100,100],[200,100]]],quality:{source:'native',reason:'ok',raw_points:2,stored_points:2},revision:'initial',
   live_tail:{version:1,epoch:'task1175',waiting:false,limited:false,
    paths:[[[200,100,stamp-6000],[200,240,stamp-3000],[350,240,stamp]]]}}};
  const panel=document.createElement('houseplan-panel');f.panel=panel;
  panel.panel={component_name:'houseplan-panel'};panel.route={prefix:'/houseplan',path:''};panel.narrow=false;
  panel.hass={...base,states:{...base.states,
   'vacuum.tail1175':{entity_id:'vacuum.tail1175',state:'cleaning',attributes:{}},
   'camera.tail1175':{entity_id:'camera.tail1175',state:'idle',last_updated:new Date(stamp).toISOString(),
    attributes:{map_name:'floor',robot_position:{x:350,y:240}}}},
   connection:{...base.connection,subscribeEvents:async(cb,event)=>{
    if(event==='houseplan_trail_updated'){f.listeners.add(cb);return()=>f.listeners.delete(cb);}return subscribe(cb,event);
   }},callWS:async message=>{
    if(message.type==='houseplan/trail/get'){f.reads++;return {trail_format:2,live_tail_format:1,trails:{[marker.id]:{current:structuredClone(f.run)}}};}
    if(/\/(set|save|delete|update)$/.test(message.type))f.writes++;return ws(message);
   }};
  history.replaceState(null,'','/houseplan');const host=document.getElementById('host');
  host.style.cssText='width:100%;height:100vh;margin:0;padding:0';host.replaceChildren(panel);
  await import('/assets/houseplan-panel.js');
  f.move=async(x,y,state='cleaning',map='floor')=>{
   f.stamp=Date.now();panel.hass={...panel.hass,states:{...panel.hass.states,
    'vacuum.tail1175':{entity_id:'vacuum.tail1175',state,attributes:{}},
    'camera.tail1175':{entity_id:'camera.tail1175',state:'idle',last_updated:new Date(f.stamp).toISOString(),
     attributes:{map_name:map,robot_position:{x,y}}}}};await panel.updateComplete;await window.__card.updateComplete;
  };
  f.publish=()=>{for(const cb of f.listeners)cb({data:{}});};
  f.measure=()=>{
   const c=window.__card,root=c.renderRoot,line=root.querySelector('line.tip[data-mid="e_tail1175"]');
   const puck=root.querySelector('.vacpuck[data-mid="e_tail1175"]'),box=puck?.getBoundingClientRect();
   const matrix=line?.getScreenCTM(),end=matrix?new DOMPoint(+line.getAttribute('x2'),+line.getAttribute('y2')).matrixTransform(matrix):null;
   return {gap:end&&box?Math.hypot(end.x-box.left-box.width/2,end.y-box.top-box.height/2):null,
    puck:box?[box.left+box.width/2,box.top+box.height/2]:null,
    d:root.querySelector('.vactrail path.core')?.getAttribute('d')||'',
    pending:structuredClone(c._vacRt.get('e_tail1175')?.livePending?.paths),
    native:structuredClone(c._vacSrvTrails.e_tail1175?.current?.paths)};
  };
 });
 await page.waitForFunction(()=>{
  const c=window.__tail1175.panel.shadowRoot?.querySelector('houseplan-card');
  if(!c?._loadOk||c._booting||!c._vacSrvTrails.e_tail1175)return false;window.__card=c;return true;
 });
 await assertFreshDemoBundleUnlessAllowed(page);
 const samples=async()=>page.evaluate(()=>new Promise(resolve=>{
  const rows=[],start=performance.now();const tick=()=>{rows.push(window.__tail1175.measure());
   if(performance.now()-start>=350)resolve(rows);else requestAnimationFrame(tick);};requestAnimationFrame(tick);
 }));
 for(const iso of [false,true]){
  await page.evaluate(value=>window.__hpTest.setVolumetricView(value),iso);
  controlWrites=await page.evaluate(()=>window.__tail1175.writes);
  await page.waitForFunction(iso=>window.__card.renderRoot.querySelector('.stage:not(.hpboot):not(.hpiso-pending)')?.classList.contains('projection-iso')===iso,iso);
  await page.evaluate(()=>{const c=window.__card,f=window.__tail1175;f.run.revision=`reset-${Date.now()}`;
   f.run.paths=[[[100,100],[200,100]]];const stamp=Date.now()-11000;
   f.run.live_tail={version:1,epoch:`epoch-${Date.now()}`,waiting:false,limited:false,
    paths:[[[200,100,stamp-6000],[200,240,stamp-3000],[350,240,stamp]]]};
   f.panel.hass={...f.panel.hass,states:{...f.panel.hass.states,
    'camera.tail1175':{entity_id:'camera.tail1175',state:'idle',last_updated:new Date(stamp).toISOString(),attributes:{map_name:'floor',robot_position:{x:350,y:240}}}}};
   f.publish();
  });
  await page.waitForFunction(()=>window.__card._vacSrvTrails.e_tail1175.current.revision===window.__tail1175.run.revision);
  await page.waitForTimeout(1250);
  await page.evaluate(()=>{window.__card._vacRt.get('e_tail1175').lastTs=Date.now()-11000;});
  await page.evaluate(()=>window.__tail1175.move(400,240));
  await page.waitForTimeout(100);
  let rows=await samples();
  check(`delay-${iso}: continuous tip after an ordinary eleven-second telemetry gap`,rows.every(r=>r.gap!==null&&r.gap<1));
  await page.evaluate(()=>window.__tail1175.move(400,310));await page.waitForTimeout(150);
  await page.evaluate(()=>window.__tail1175.move(500,310));await page.waitForTimeout(100);
  await page.evaluate(()=>{const f=window.__tail1175;f.run.paths=[[[100,100],[200,100],[200,240],[400,240],[400,310]]];
   f.run.live_tail.paths=[[[400,310,f.stamp-100],[500,310,f.stamp]]];f.run.revision=`partial-${Date.now()}`;f.publish();});
  await page.waitForFunction(()=>window.__card._vacSrvTrails.e_tail1175.current.revision===window.__tail1175.run.revision);
  const partial=await samples();check(`partial-${iso}: unacknowledged suffix stays at the puck`,partial.every(r=>r.gap!==null&&r.gap<1));
  // A full ACK may arrive while a real CSS position tween is still running.
  await page.evaluate(()=>window.__tail1175.move(600,310));await page.waitForTimeout(80);
  await page.evaluate(()=>{const f=window.__tail1175;
   f.run.paths=[[[100,100],[200,100],[200,240],[400,240],[400,310],[500,310],[600,310]]];
   f.run.live_tail.paths=[[[600,310,f.stamp]]];f.run.revision=`full-${Date.now()}`;f.publish();});
  await page.waitForFunction(()=>window.__card._vacSrvTrails.e_tail1175.current.revision===window.__tail1175.run.revision);
  const full=await samples();check(`full-${iso}: full ACK retains live endpoint in intermediate frames`,full.every(r=>r.gap!==null&&r.gap<1));
  check(`full-${iso}: static path stops before the future target`,full.every(r=>!r.d.endsWith('600 310')));
  await page.evaluate(()=>window.__tail1175.publish());await page.waitForTimeout(80);
  const repeated=await samples();check(`repeat-${iso}: same native snapshot keeps the tip`,repeated.every(r=>r.gap!==null&&r.gap<1));
  await page.screenshot({path:`${folder}/${iso?'iso':'flat'}-full-ack.png`});
  evidence.modes.push({iso,delay:rows,partial,full,repeated});
 }
 await page.evaluate(()=>window.__tail1175.move(9900,9900));await page.waitForTimeout(100);
 const teleport=await page.evaluate(()=>window.__tail1175.measure());
 check('teleport does not invent a connector',teleport.gap===null&&teleport.pending?.at(-1)?.length===1);
 await page.evaluate(()=>window.__tail1175.move(9900,9900,'unavailable'));await page.waitForFunction(()=>!window.__card._vacRt.get('e_tail1175')?.moving);
 check('unknown state retires the active puck',await page.evaluate(()=>!window.__card.renderRoot.querySelector('.vacpuck[data-mid="e_tail1175"]')));
 const counts=await page.evaluate(()=>({reads:window.__tail1175.reads,writes:window.__tail1175.writes}));
 check('rendering never writes or polls the provider',counts.writes===controlWrites&&counts.reads<=10);
 evidence.counts=counts;evidence.teleport=teleport;
 writeFileSync(`${folder}/observations.json`,JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({modes:evidence.modes.map(m=>({iso:m.iso,frames:m.full.length,maxGap:Math.max(...m.full.map(r=>r.gap??Infinity))})),counts}));
}catch(error){await page.screenshot({path:`${folder}/failure.png`}).catch(()=>{});throw error;}
finally{await finish(browser);}
