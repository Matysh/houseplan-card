// #1078: canonical room chains, public room settings, real Save/Cancel and both sunlight renderers.
import {launch,checkAll,finish} from './serve.mjs';
import {sunTransparentConfig as fixture} from './fixtures/sun-transparent.mjs';
import {mkdirSync} from 'node:fs';

const {page,browser}=await launch({width:1200,height:900});
const out={};mkdirSync('artifacts/sun-transparent-1078',{recursive:true});
const capture=async name=>{
  await page.mouse.move(10,10);
  await page.waitForTimeout(3600); // real sun fade and ordinary toast deadline, no private resets
  await page.screenshot({path:`artifacts/sun-transparent-1078/${name}.png`});
};
try {
  await page.evaluate(async config=>{
    const c=window.__card;c.setConfig({...c._config,language:'ru'});
    await window.__hpTest.setServerConfig(config);
    c.hass={...c.hass,states:{...c.hass.states,'sun.sun':{entity_id:'sun.sun',state:'above_horizon',
      attributes:{azimuth:270,elevation:30,rising:false}}}};
    await window.__hpTest.settled();
  },fixture());
  const inspect=()=>page.evaluate(()=>{
    const c=window.__card;
    return {flat:(c._sunRaysCache?.rays||[]).map(r=>[r.openingId,r.roomId]),
      iso:(c._isoSunCache?.beams||[]).map(r=>[r.openingId,r.roomId]),
      polygons:c.renderRoot.querySelectorAll('.sunlayer polygon').length,
      builds:{...c._floorCacheBuilds}};
  });
  const expected='[["W","R"]]';
  let state=await inspect();out.chainFlat=JSON.stringify(state.flat)===expected&&state.polygons>0;
  await capture('flat-chain');
  const before=state.builds;
  await page.evaluate(async()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states}};await window.__hpTest.settled();});
  state=await inspect();out.unrelatedTickWarm=state.builds.sunRays===before.sunRays;
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{cfg.spaces.find(s=>s.id==='f2').title='Other floor changed';}));
  state=await inspect();out.otherFloorKeepsSunWarm=state.builds.sunRays===before.sunRays;
  const geometry=()=>page.evaluate(()=>{const s=window.__card._serverCfg.spaces.find(s=>s.id==='f1');
    return JSON.stringify({rooms:s.rooms.map(({settings,...r})=>r),walls:s.walls,wall_segments:s.wall_segments,openings:s.openings});});
  const geometryBefore=await geometry();
  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.openRoomEdit('T1');});
  const dialog=page.locator('houseplan-card hp-dialog[data-kind="room"]');
  const toggle=dialog.locator('#room-sun-transparent');
  out.currentFlagLoaded=await toggle.isChecked();
  await toggle.uncheck();
  out.dirty=await dialog.locator('[data-hp="dialog-confirm"]').isEnabled();
  await dialog.locator('.hpf-footer [data-hp="dialog-cancel"]').click();
  await page.locator('houseplan-card hp-confirm').locator('[data-hp="dialog-confirm"]').click();
  await page.evaluate(async()=>{await window.__hpTest.settled();await window.__hpTest.setMode('view');});
  state=await inspect();out.cancelRetainsChain=JSON.stringify(state.flat)===expected;
  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.openRoomEdit('T1');});
  await toggle.uncheck();
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.evaluate(async()=>{await window.__hpTest.waitForWrites();await window.__hpTest.settled();await window.__hpTest.setMode('view');});
  state=await inspect();out.savedBreakDark=state.flat.length===0&&state.polygons===0;
  out.canonicalGeometryUnchanged=await geometry()===geometryBefore;
  out.sparseSave=await page.evaluate(()=>!('sun_transparent' in (window.__card._serverCfg.spaces[0].rooms.find(r=>r.id==='T1').settings||{})));
  const beforeForeign=state.builds;
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{
    const room=cfg.spaces[0].rooms.find(r=>r.id==='T1');
    room.settings={...room.settings,sun_transparent:true};
  }));
  state=await inspect();out.foreignFlagUpdateInvalidates=JSON.stringify(state.flat)===expected;
  out.solarOnlyInvalidation=state.builds.sunRays>beforeForeign.sunRays&&
    Object.keys(beforeForeign).filter(key=>!['sunRays','isoSun'].includes(key)).every(
      key=>state.builds[key]===beforeForeign[key]);
  await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,kiosk:true,cycle:0});await window.__hpTest.settled();});
  state=await inspect();out.kioskSameWindows=JSON.stringify(state.flat)===expected&&state.polygons>0;
  await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,kiosk:false});await window.__hpTest.settled();});
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(true);});
  state=await inspect();out.chainIso=JSON.stringify(state.iso)===expected&&state.polygons>0;
  await capture('iso-chain');
  await page.evaluate(async config=>{config.settings.volumetric_view=true;await window.__hpTest.setServerConfig(config);},fixture(true));
  state=await inspect();out.isolatedIsoDark=state.iso.length===0&&state.polygons===0;
  await page.evaluate(()=>window.__hpTest.setVolumetricView(false));
  state=await inspect();out.isolatedFlatDark=state.flat.length===0&&state.polygons===0;
  await capture('isolated');
  await page.evaluate(config=>window.__hpTest.setServerConfig(config),fixture());
  for(const [key,sunRays,north] of [['sunDisabled',false,0],['northMissing',true,null]]) {
    await page.evaluate(({sunRays,north})=>window.__hpTest.setServerConfig(cfg=>{
      cfg.settings.sun_rays=sunRays;
      if(north===null)delete cfg.settings.north_deg;else cfg.settings.north_deg=north;
    }),{sunRays,north});
    out[key]=await page.evaluate(()=>!window.__card.renderRoot.querySelectorAll('.sunlayer polygon,.sunlayer path').length);
  }
  await page.evaluate(async()=>{
    await window.__hpTest.setServerConfig(cfg=>{cfg.settings.north_deg=0;});
    const c=window.__card;
    c.hass={...c.hass,states:{...c.hass.states,'sun.sun':{entity_id:'sun.sun',state:'unavailable',attributes:{}}}};
    await window.__hpTest.settled();
  });
  out.invalidSun=await page.evaluate(()=>!window.__card.renderRoot.querySelectorAll('.sunlayer polygon,.sunlayer path').length);
  checkAll(out);
} finally {await finish(browser,out);}
