/** #939: genuine image-only source, raster fit and server native path in View. */
import {createRequire} from 'node:module';
import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
requirePinnedBrowser();
const {page,browser}=await launchColdView({width:1200,height:900});
const out={};
try {
 const png=new PNG({width:2,height:2});
 for(let i=0;i<png.data.length;i+=4)png.data.set([30,80,240,255],i);
 const image='data:image/png;base64,'+PNG.sync.write(png).toString('base64');
 await page.evaluate(async image=>{
  const old=window.__card,baseWS=old.hass.callWS.bind(old.hass);
  window.__addRegistryDevice('robot939','Synthetic Ecovacs','X1 Omni',null);
  window.__addRegistryEntity('vacuum.ecovacs',null,'cleaning','ecovacs',{device_id:'robot939'});
  window.__addRegistryEntity('image.ecovacs_map',null,'ready','ecovacs',{device_id:'robot939'});
  const stamp='2026-10-19T10:00:00+00:00',source='image.ecovacs_map',id='e_vacuum_ecovacs';
  const frame={vacuum:'vacuum.ecovacs',map_id:'floor',state_revision:stamp,position:{x:50,y:40},
   bounds:[0,0,100,80],native_path:true,reason:null};
  const run={route_id:'ecovacs-route',map_id:'floor',path_format:2,paths:[[[10,10],[50,10],[50,40]],[[60,40],[80,50]]],
   points:[[60,40],[80,50]],quality:{source:'native',reason:'ok',raw_points:5},received_at:1700000000};
  window.__ecovacs={frame,run,image,writes:0,reject:false,hold:null,notify:null,oldBackend:false};
  const baseSubscribe=old.hass.connection.subscribeEvents.bind(old.hass.connection);
  const hass={...old.hass,connection:{...old.hass.connection,subscribeEvents:async(cb,event)=>{
   if(event==='houseplan_trail_updated'){window.__ecovacs.notify=cb;return()=>{};}
   return baseSubscribe(cb,event);
  }},states:{...old.hass.states,
   'vacuum.ecovacs':{entity_id:'vacuum.ecovacs',state:'cleaning',attributes:{}},
   [source]:{entity_id:source,state:'ready',last_updated:stamp,attributes:{map_name:'floor'}}},
   callWS:async m=>{
    const e=window.__ecovacs;
    if(m.type==='houseplan/trail/get')return{trail_format:2,trails:{[id]:{current:e.run}},
     ...(e.oldBackend?{}:{vacuum_source_format:1,vacuum_sources:{[source]:e.frame}})};
    if(m.type==='houseplan/vacuum/map_preview'){
     if(e.hold)await e.hold;
     return{source,map_id:'floor',bounds:[0,0,100,80],revision:'a'.repeat(64),image:e.image};
    }
    if(m.type==='houseplan/config/set'){e.writes++;if(e.reject)throw Error('synthetic ACK rejection');}
    return baseWS(m);
   }};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers,{id,binding:'entity:vacuum.ecovacs',space:'f1',
   vacuum:{source,trail_mode:'always',map_routes:[{id:'ecovacs-route',source,map_id:'floor',space:'f1',calibration:[5,0,100,0,5,100]}]}}]}));
  await window.__hpTest.setLayout(layout=>({...layout,[id]:{s:'f1',x:.1,y:.1}}));
  const card=document.createElement('houseplan-card');card.hass=hass;
  card.setConfig({type:'custom:houseplan-card',language:'en'});
  old.replaceWith(card);window.__card=card;
  await window.__hpTest.settled();
 },image);
 await page.waitForSelector('.vacpuck',{timeout:5000}).catch(async error=>{
  console.log(await page.evaluate(()=>{const c=window.__card,d=c._devices.find(d=>d.id==='e_vacuum_ecovacs');return{
   device:d,space:c._space,source:d&&c._vacSourceResolution(d),hass:c._planHass.states['image.ecovacs_map'],
   registry:c._planHass.entities['image.ecovacs_map'],format:c._vacTrailFormat};}));throw error;
 });
 out.nativeWithMoveGaps=await page.locator('.vactrail > [data-hp-plan-rotation-frame] > path.core').evaluate(p=>(p.getAttribute('d').match(/M /g)||[]).length===2);
 out.dockDoesNotMove=await page.locator('[data-hp="device"][data-id="e_vacuum_ecovacs"]').count()===1;
 const pose=await page.locator('.vacpuck').boundingBox();
 await page.evaluate(async()=>{window.__ecovacs.frame.position={x:70,y:45};
  await window.__ecovacs.notify({data:{}});await window.__hpTest.settled();});
 await page.waitForFunction(previous=>window.__card.renderRoot.querySelector('.vacpuck')?.getBoundingClientRect().x>previous.x+20,pose);
 out.imageEventMovesPuckWithoutHassTick=true;
 const start=async()=>{
  await page.evaluate(async()=>{await window.__hpTest.setMode('devices');await window.__hpTest.openMarkerDialog('e_vacuum_ecovacs');});
  await page.locator('[data-section-target="vacuum"]').click();
  await page.locator('.vacbtns button').filter({hasText:'Fit manually'}).first().click();
  await page.waitForSelector('[data-hp="vacuum-map-preview"]');
  // #1009: the fit exists before the accepted device-dialog exit has finished.
  // Its retained modal/backdrop darkens the raster in a locator screenshot on
  // Windows. Wait for that presentation to retire, not an arbitrary paint delay.
  await page.locator('hp-dialog[data-kind="marker"]').waitFor({state:'detached'});
 };
 await start();
 out.fourHandles=await page.locator('.vacfithandle').count()===4;
 out.noGuessedRooms=await page.locator('.vacfit polygon,.vacfit text').count()===0;
 const raster=page.locator('[data-hp="vacuum-map-preview"]');
 const bluePixels=async()=>{
  const shot=PNG.sync.read(await raster.screenshot());
  let blue=0;for(let i=0;i<shot.data.length;i+=4)if(shot.data[i+2]-shot.data[i]>50&&shot.data[i+2]-shot.data[i+1]>40)blue++;
  return blue;
 };
 const blue=await bluePixels();
 out.rasterReallyPainted=blue>1000;
 const before=await raster.getAttribute('transform');
 await page.locator('.vaccalbar button').nth(0).click();
 out.rotateChangesMatrix=before!==await raster.getAttribute('transform');
 await page.locator('.vaccalbar button').nth(1).click();
 out.mirrorKeepsRaster=await raster.isVisible();
 const box=await raster.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+20);await page.mouse.up();
 const writes=await page.evaluate(()=>window.__ecovacs.writes);
 await page.locator('.vaccalbar button').nth(3).click();
 out.cancelDoesNotSave=await page.evaluate(n=>window.__ecovacs.writes===n,writes);
 // Ordinary negative preview input: DOM bounds/handles still exist, but the
 // transparent PNG must fail the very same pixel predicate as the blue map.
 png.data.fill(0);
 await page.evaluate(image=>{window.__ecovacs.image=image;},
  'data:image/png;base64,'+PNG.sync.write(png).toString('base64'));
 await start();
 const transparentBlue=await bluePixels();
 out.transparentRasterNotPainted=await raster.isVisible()
  &&await page.locator('.vacfithandle').count()===4&&transparentBlue<=1000;
 console.log('Ecovacs preview pixels',JSON.stringify({blue,transparentBlue,threshold:1000}));
 await page.locator('.vaccalbar button').nth(3).click();
 await page.evaluate(image=>{window.__ecovacs.image=image;},image);
 await start();
 await page.evaluate(()=>{window.__ecovacs.reject=true;});
 await page.locator('.vaccalbar button').nth(2).click();
 await page.waitForFunction(()=>window.__ecovacs.writes>0&&!window.__card._vacFit?.busy);
 out.rejectedSaveKeepsRaster=await raster.isVisible();
 await page.evaluate(()=>{window.__ecovacs.reject=false;});
 await page.locator('.vaccalbar button').nth(2).click();
 await page.waitForSelector('.vacfit',{state:'detached'});
 out.retrySaved=true;
 // A context replacement while the preview is pending must not open a fit.
 await page.evaluate(async()=>{await window.__hpTest.openMarkerDialog('e_vacuum_ecovacs');
  window.__ecovacs.hold=new Promise(resolve=>{window.__ecovacs.release=resolve;});});
 await page.locator('[data-section-target="vacuum"]').click();
 await page.locator('.vacbtns button').filter({hasText:'Fit manually'}).first().click();
 await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
  'image.ecovacs_map':{...c.hass.states['image.ecovacs_map'],attributes:{map_name:'different'}}}};
  window.__ecovacs.release();window.__ecovacs.hold=null;});
 await page.waitForTimeout(100);
 out.lateOtherMapDoesNotOpen=await page.locator('.vacfit').count()===0;
 await page.evaluate(async()=>{await window.__hpTest.close(window.__card.renderRoot.querySelector('hp-dialog[data-kind="marker"]'),{via:'cancel'});const c=window.__card;
  c.hass={...c.hass,states:{...c.hass.states,'image.ecovacs_map':{...c.hass.states['image.ecovacs_map'],attributes:{map_name:'floor'}}}};
  await window.__hpTest.setMode('view');});
 for(const kiosk of [false,true])for(const iso of [false,true]){
  await page.evaluate(async({kiosk,iso})=>{const c=window.__card;
   c.setConfig({type:'custom:houseplan-card',language:'en',kiosk,cycle:0});
   await window.__hpTest.setVolumetricView(iso);await window.__hpTest.settled();},{kiosk,iso});
  const original=await page.locator('.vactrail > [data-hp-plan-rotation-frame] > path.core').getAttribute('d');
  const stage=await page.locator('.stage').boundingBox();
  await page.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.8);await page.mouse.down();
  await page.mouse.move(stage.x+stage.width*.8-60,stage.y+stage.height*.8-20);await page.mouse.up();
  await page.mouse.wheel(0,-120);await page.waitForTimeout(250);
  out[`${kiosk?'kiosk':'view'}-${iso?'iso':'flat'}-worldGeometry`]=original===await page.locator('.vactrail > [data-hp-plan-rotation-frame] > path.core').getAttribute('d')
   &&await page.locator('.vacpuck').isVisible();
 }
 out.noPngInConfig=await page.evaluate(()=>!JSON.stringify(window.__card._serverCfg).includes('data:image/png'));
 checkAll(out);
}finally{await finish(browser,out);}
