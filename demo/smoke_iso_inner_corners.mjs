/** #1560: actual corner paint across the production cameras and DPR2 wheel handoff. */
import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { check, finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const {config:lab}=JSON.parse(readFileSync(new URL('./ui-lab/default-plan/fixture.json',import.meta.url),'utf8'));
const reviewDir=process.env.HP_INNER_CORNERS_REVIEW_DIR;
if(reviewDir) await mkdir(reviewDir,{recursive:true});
const {page,browser}=await startIsoPaintScene({
  width:1160,height:840,dpr:2,reducedMotion:'no-preference',
  configureFixture(fixture) {
    fixture.config.model_version=lab.model_version;
    fixture.config.spaces=lab.spaces.map(space=>space.id!=='lab_ground'?space:{
      ...space,settings:{...space.settings,show_names:false,transparent_walls_3d:true,
        room_opacity:.38,wall_fill:{c:'#7d98a8',a:.36},glow_enabled:false},
    });
  },
});

const snapshot=()=>page.evaluate(()=>{
  const c=window.__isoPaint,root=c.renderRoot;
  const stage=root.querySelector('.stage'),scene=stage.querySelector('.iso-scene-surface');
  const groups=[...scene.querySelectorAll('[data-hp-inner-corner]')];
  const number='[-+]?(?:\\d*\\.\\d+|\\d+)(?:e[-+]?\\d+)?';
  const line=new RegExp('M ('+number+') ('+number+') L ('+number+') ('+number+')','gi');
  const signature=groups.map(group=>{
    const stroke=group.querySelector(':scope > path'), clip=group.querySelector('clipPath path');
    const points=[...stroke?.getAttribute('d')?.matchAll(line)??[]];
    return {d:stroke?.getAttribute('d'),clip:clip?.getAttribute('d'),
      vertical:points.length>0&&points.every(([,x,y,b,w])=>Math.abs(Number(x)-Number(b))<1e-5&&y!==w),
      style:stroke&&[getComputedStyle(stroke).strokeWidth.replace(/^calc\((.*)\)$/,'$1'),getComputedStyle(stroke).vectorEffect,
        getComputedStyle(stroke).strokeOpacity,getComputedStyle(stroke).fill,group.getAttribute('opacity')],
      lineOnly:group.querySelectorAll(':scope > path').length===1&&!group.querySelector('.iso-wall-side'),
    };
  });
  return {rotation:Number(stage.dataset.hpPlanRotation),signature,viewBox:stage.querySelector('.plan-svg').getAttribute('viewBox'),
    raster:scene.hasAttribute('data-hp-raster-display'),dpr:devicePixelRatio,writes:window.__isoPaintWrites.length};
});

try {
  const angles=[];
  for(let i=0;i<8;i++){
    const frame=await snapshot();
    angles.push({rotation:frame.rotation,count:frame.signature.length});
    check('inner corners at '+frame.rotation,frame.signature.length>0);
    const bad=frame.signature.find(item=>!item.clip||!item.vertical||!item.lineOnly
      ||JSON.stringify(item.style)!==JSON.stringify(['1.2px','non-scaling-stroke','0.36','none','0.36']));
    if(bad)console.log('unexpected corner paint',frame.rotation,JSON.stringify(bad));
    check('clipped adaptive vertical ink, without extra paint at '+frame.rotation,!bad);
    if(reviewDir) await page.locator('houseplan-card .stage').screenshot({
      path:join(reviewDir,'ground-'+frame.rotation+'.png'),animations:'disabled',
    });
    await page.locator('houseplan-card [data-hp="rotate-right"]').click();
    await page.waitForFunction(expected=>{
      const card=window.__isoPaint,stage=card.renderRoot.querySelector('.stage');
      return Number(stage.dataset.hpPlanRotation)===expected&&!card._rotationMotion.running;
    },(frame.rotation+45)%360);
    await settleIsoPaint(page);
  }
  check('eight distinct production orientations',new Set(angles.map(row=>row.rotation)).size,8);
  const readyMark='houseplan.iso.raster.ready';
  const prior=await page.evaluate(mark=>performance.getEntriesByName(mark).length,readyMark);
  await zoomIsoPaint(page,4);
  await page.waitForFunction(({mark,prior})=>performance.getEntriesByName(mark).length>prior,{mark:readyMark,prior});
  const before=await snapshot();
  const sawRaster=await page.evaluate(async()=>{
    const c=window.__isoPaint,root=c.renderRoot,stage=root.querySelector('.stage');
    const scene=root.querySelector('.iso-scene-surface'),box=stage.getBoundingClientRect();
    const target=stage.querySelector('.zoomwrap');
    let reached=false;
    for(let i=0;i<12;i++){
      target.dispatchEvent(new WheelEvent('wheel',{
        deltaY:100,clientX:box.left+box.width*.63,clientY:box.top+box.height*.60,
        bubbles:true,composed:true,cancelable:true,
      }));
      const next=performance.now()+140;
      do {
        await new Promise(resolve=>requestAnimationFrame(resolve));
        reached ||= scene.hasAttribute('data-hp-raster-display')&&!!root.querySelector('.hp-iso-gesture-image');
      } while(performance.now()<next);
    }
    return reached;
  });
  await settleIsoPaint(page);
  const after=await snapshot();
  check('DPR 2',after.dpr,2);
  check('wheel uses a real raster and returns to SVG',sawRaster&&!after.raster);
  check('corner paths and clips survive wheel at the same camera',after.signature,before.signature);
  const bounds=await page.locator('houseplan-card .stage').boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.52,bounds.y+bounds.height*.46);
  await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width*.58,bounds.y+bounds.height*.51,{steps:10});
  await page.mouse.up();
  await settleIsoPaint(page);
  const panned=await snapshot();
  check('real pan moves the active SVG viewport',panned.viewBox!==after.viewBox);
  check('pan leaves the world-space corner paths unchanged',panned.signature,after.signature);
  check('read-only browser fixture',panned.writes,0);
  await finish(browser,{angles,sawRaster});
} catch(error) {
  await browser.close();
  throw error;
}
