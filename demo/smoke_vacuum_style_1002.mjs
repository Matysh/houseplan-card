// #1002: actual rendered ink survives View/kiosk, Flat/2.5D and camera changes.
import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
requirePinnedBrowser();
const {page,browser}=await launchColdView();
const out={};
try {
  await page.evaluate(async()=>{
    const old=window.__card,base=old.hass.callWS.bind(old.hass);
    window.__addRegistryEntity('vacuum.ink',null,'cleaning');
    window.__addRegistryEntity('camera.ink_map',null,'idle');
    const marker={id:'e_vacuum_ink',binding:'entity:vacuum.ink',space:'f1',vacuum:{source:'camera.ink_map',trail_mode:'always',map_routes:[{
      id:'ink',source:'camera.ink_map',map_id:'m1',space:'f1',calibration:[1,0,0,0,1,0]}]}};
    await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers,marker]}));
    await window.__hpTest.setLayout(layout=>({...layout,e_vacuum_ink:{s:'f1',x:.1,y:.1}}));
    const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card'});
    card.hass={...old.hass,states:{...old.hass.states,'vacuum.ink':{state:'cleaning',attributes:{}},'camera.ink_map':{state:'idle',attributes:{robot_position:{x:600,y:500},map_name:'m1'}}},
      callWS:msg=>msg.type==='houseplan/trail/get'?Promise.resolve({trail_format:2,trails:{e_vacuum_ink:{current:{map_id:'m1',route_id:'ink',path_format:2,
        paths:[[[100,100],[400,100],[400,400]],[[500,500],[600,500]]],quality:{source:'native',reason:'ok',raw_points:5}}}}}):base(msg)};
    old.replaceWith(card);window.__card=card;await window.__hpTest.settled();await window.__hpTest.setMode('view');
  });
  await page.waitForSelector('.vactrail > [data-hp-plan-rotation-frame] > path.core');
  const geometry=await page.locator('.vactrail > [data-hp-plan-rotation-frame] > path.core').getAttribute('d');
  for(const kiosk of [false,true]) for(const iso of [false,true]) {
    await page.evaluate(async({kiosk,iso})=>{
      window.__card.setConfig({type:'custom:houseplan-card',language:'en',kiosk,cycle:0});
      await window.__hpTest.setVolumetricView(iso);await window.__hpTest.settled();
    },{kiosk,iso});
    const stage=await page.locator('.stage').boundingBox();
    await page.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.8);
    await page.mouse.down();await page.mouse.move(stage.x+stage.width*.8-45,stage.y+stage.height*.8-15);await page.mouse.up();
    await page.mouse.wheel(0,-180);await page.waitForTimeout(250);
    const ink=await page.locator('.vactrail > [data-hp-plan-rotation-frame] > path.core').evaluate(p=>{
      const s=getComputedStyle(p);return {d:p.getAttribute('d'),width:s.strokeWidth,color:s.stroke,alpha:s.strokeOpacity,vector:s.vectorEffect};
    });
    out[`${kiosk?'kiosk':'view'}-${iso?'iso':'flat'}-unchangedGeometry`]=ink.d===geometry;
    out[`${kiosk?'kiosk':'view'}-${iso?'iso':'flat'}-acceptedInk`]=ink.width==='0.9px'&&ink.alpha==='0.7'&&ink.color==='rgb(100, 181, 246)'&&ink.vector==='non-scaling-stroke';
    out[`${kiosk?'kiosk':'view'}-${iso?'iso':'flat'}-noCasing`]=await page.locator('.vactrail .case').count()===0;
  }
  await page.evaluate(async()=>{
    window.__card.setConfig({type:'custom:houseplan-card',language:'en',kiosk:false});
    await window.__hpTest.setVolumetricView(false);
    await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:cfg.markers.map(m=>m.id==='e_vacuum_ink'
      ? {...m,vacuum:{...m.vacuum,map_routes:null,calibration:{m1:[1,0,0,0,1,0],m2:[1,0,0,0,1,0]}}}:m)}));
    await window.__hpTest.setMode('devices');
    await window.__hpTest.openMarkerDialog('e_vacuum_ink');
  });
  await page.locator('[data-section-target=vacuum]').click();
  await page.locator('.hpf-profile-diagnostics > summary').click();
  out.legacyMapIdsInDiagnostics=(await page.locator('.hpf-profile-diagnostics').textContent()).includes('m2');
  checkAll(out);
} finally {await finish(browser,out);}
