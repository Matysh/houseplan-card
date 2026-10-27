/** #1092: actual full Flat/2.5D and static-card output, not renderer source text. */
import { mkdir } from 'node:fs/promises';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('#1092 removed decorative outline');
const { page, browser } = await launch({width:1291,height:952},2);
const out={};
const read=()=>page.evaluate(()=>{
  const root=window.__card.renderRoot,stage=root.querySelector('.stage');
  return {outline:root.querySelectorAll('.hp-paper-outline-svg').length,
    paper:[...root.querySelectorAll('.hp-paperg')].map(n=>getComputedStyle(n).filter),
    environment:!!root.querySelector('.hp-day-cycle-bg.active'),
    paperCount:root.querySelectorAll('.hp-paper').length,
    viewBox:root.querySelector('.plan-svg')?.getAttribute('viewBox'),
    iso:stage.classList.contains('projection-iso')};
});
try{
  await mkdir('demo/out/daycycle-outline-1092',{recursive:true});
  await page.evaluate(async()=>{
    await window.__hpTest.setServerConfig(cfg=>({...cfg,
      settings:{...cfg.settings,bg_mode:'daynight'},
      spaces:cfg.spaces.map(s=>({...s,settings:{...s.settings,bg_mode:'daynight'}}))}));
    const c=window.__card;
    c.hass={...c.hass,states:{...c.hass.states,'sun.sun':{entity_id:'sun.sun',state:'above_horizon',
      attributes:{azimuth:180,elevation:40,rising:false}}}};
    await window.__hpTest.setMode('view');
    await window.__hpTest.settled();
  });
  const flat=await read();
  out.flatHasEnvironmentAndOpaquePaper=flat.environment&&flat.paperCount>0&&flat.paper.every(v=>v==='none');
  out.flatHasNoDecorativeOutline=flat.outline===0;
  await page.locator('houseplan-card [data-hp="zoom-in"]').click();
  await page.waitForFunction(()=>!window.__card._cameraTransition.active);
  await page.evaluate(()=>window.__hpTest.settled());
  const zoomed=await read();
  out.cameraStillChangesViewBox=zoomed.viewBox!==flat.viewBox;
  out.cameraCreatesNoOutline=zoomed.outline===0&&zoomed.paper.every(v=>v==='none');
  await page.screenshot({path:'demo/out/daycycle-outline-1092/flat.png'});
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(true);await window.__hpTest.settled();});
  await page.waitForFunction(()=>{
    const root=window.__card.renderRoot;
    return !!root.querySelector('.iso-overlays-svg')&&!root.querySelector('.stage.hpiso-pending');
  },null,{timeout:9000});
  const iso=await read();
  out.isometricKeepsEnvironmentAndPaper=iso.iso&&iso.environment&&iso.paperCount>0;
  out.isometricHasNoDecorativeOutline=iso.outline===0&&iso.paper.every(v=>v==='none');
  await page.screenshot({path:'demo/out/daycycle-outline-1092/isometric.png'});
  const stat=await page.evaluate(async()=>{
    const full=window.__card,sc=document.createElement('houseplan-space-card');
    sc.setConfig({type:'custom:houseplan-space-card',space:full._space,title:'',show_button:false});
    sc.hass=full.hass;document.body.appendChild(sc);
    for(let n=0;n<120&&!sc.renderRoot?.querySelector('.hp-static-stage');n++)await new Promise(r=>setTimeout(r,50));
    await sc.updateComplete;
    const root=sc.renderRoot;
    return{outline:root.querySelectorAll('.hp-paper-outline-svg').length,
      environment:!!root.querySelector('.hp-day-cycle-bg.active'),paper:root.querySelectorAll('.hp-paper').length,
      filters:[...root.querySelectorAll('.hp-paperg')].map(n=>getComputedStyle(n).filter)};
  });
  out.staticKeepsEnvironmentAndPaper=stat.environment&&stat.paper>0;
  out.staticHasNoDecorativeOutline=stat.outline===0&&stat.filters.every(v=>v==='none');
  checkAll(out);await finish(browser,out);
}finally{await browser.close();}
