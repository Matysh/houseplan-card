// #1409: native hover over time, current HA deliveries and hard lifecycle boundaries.
import {mkdirSync,writeFileSync} from 'node:fs';
import {launchColdView,check,checkAll,finish,requirePinnedBrowser} from './serve.mjs';
import {waitForUiKitPaint} from './helpers/ui-kit-paint.mjs';
import {devicePointerPoint} from './helpers/device-pointer-point.mjs';
requirePinnedBrowser('device tooltip dwell and motion');
const {page,browser}=await launchColdView({width:1200,height:900});
const out={}, evidence=[];
const marker=id=>page.locator(`[data-hp="device"][data-id="${id}"]`).first();
const point=id=>devicePointerPoint(page,marker(id));
const move=p=>page.mouse.move(p.x,p.y);
const outside=()=>page.mouse.move(2,2);
const visible=()=>page.waitForFunction(()=>{const tip=window.__card.renderRoot.querySelector('[data-hp-live-tip]');return tip&&!tip.hidden;});
const hidden=()=>page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp-live-tip]')?.hidden);
const sample=()=>page.evaluate(()=>{
 const tip=window.__card.renderRoot.querySelector('[data-hp-live-tip]'),r=tip.getBoundingClientRect();
 return {hidden:tip.hidden,text:tip.textContent,title:tip.querySelector('b')?.textContent,
  left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,
  opacity:Number(getComputedStyle(tip).opacity),motions:window.__hoverMotions.length,
  titleRetained:!window.__hoverTitle||tip.firstChild===window.__hoverTitle,
  animations:tip.getAnimations().filter(a=>a.playState==='running').map(a=>({duration:a.effect.getTiming().duration,
   frames:a.effect.getKeyframes().map(f=>({opacity:Number(f.opacity),translate:f.translate}))}))};
});
const sameAnchor=(a,b)=>Math.abs(a.left-b.left)<.5&&Math.abs(a.top-b.top)<.5;
const open=async id=>{await outside();await hidden();await move(await point(id));await visible();await waitForUiKitPaint(page);return sample();};
const deliver=async state=>page.evaluate(async state=>{
 const card=window.__card,old=card.hass.states['light.ceiling'];
 card.hass={...card.hass,states:{...card.hass.states,'light.ceiling':{...old,state,last_updated:new Date().toISOString()}}};
 await window.__hpTest.settled();
},state);
try {
 await page.evaluate(async()=>{
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers.filter(m=>!['d_light1','d_lamp'].includes(m.id)),
   {id:'d_light1',binding:'device:d_light1',space:'f1',name:'Hover A',model:'Very long model for the device tooltip resize witness'},
   {id:'d_lamp',binding:'device:d_lamp',space:'f1',name:'Hover B'}]}));
  await window.__hpTest.setLayout(layout=>({...layout,d_light1:{s:'f1',x:.45,y:.5},d_lamp:{s:'f1',x:.58,y:.5}}));
  await window.__hpTest.settled();
  window.__hoverMotions=[];
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,timing){
   if(this.matches('[data-hp-live-tip]'))window.__hoverMotions.push({frames,timing});
   return animate.call(this,frames,timing);
  };
 });
 await outside();const a=await point('d_light1');
 await move(a);await page.waitForTimeout(45);
 out.microdelay=(await sample()).hidden;
 await outside();await page.waitForTimeout(230);
 out.passThroughCancelled=(await sample()).hidden&&(await sample()).motions===0;

 await move(a);await visible();const entering=await sample();evidence.push({entering});
 out.fadeIn=entering.animations.some(a=>a.duration===180&&a.frames[0].opacity===0&&a.frames.at(-1).opacity===1
  &&a.frames.every(f=>!f.translate));
 await waitForUiKitPaint(page);const opened=await sample();
 await page.evaluate(()=>{window.__hoverTitle=window.__card.renderRoot.querySelector('[data-hp-live-tip]').firstChild;});
 await page.mouse.move(a.x+3,a.y+2);const moved=await sample();
 out.frozenPointerAnchor=sameAnchor(opened,moved)&&moved.titleRetained&&opened.motions===moved.motions;
 const held=[];
 for(let i=0;i<5;i++){await page.waitForTimeout(60);held.push(await sample());}
 out.stationaryHold=held.every(s=>!s.hidden&&sameAnchor(opened,s)&&s.motions===opened.motions);
 await deliver('off');const off=await sample();await deliver('on');const on=await sample();
 out.liveUpdateWithoutReopening=off.text.includes('Off')&&!on.text.endsWith('Off')
  &&[off,on].every(s=>!s.hidden&&sameAnchor(opened,s)&&s.motions===opened.motions);
 evidence.push({opened,moved,held,off,on});
 await outside();const leaving=await sample();evidence.push({leaving});
 out.fadeOut=!leaving.hidden&&leaving.animations.some(a=>a.duration===140&&a.frames.at(-1).opacity===0);
 await hidden();out.exitCompletes=(await sample()).hidden;

 // The old A lease expires during B's own dwell; it must not show either tip early.
 const b=await point('d_lamp');await move(a);await page.waitForTimeout(70);await move(b);
 await page.waitForTimeout(85);out.neighbourHasOwnDwell=(await sample()).hidden;
 await visible();await waitForUiKitPaint(page);out.neighbourLatestWins=(await sample()).title==='Hover B';
 await outside();await hidden();
 await move(a);await visible();await outside();await page.waitForTimeout(35);await move(a);
 await visible();await waitForUiKitPaint(page);await page.waitForTimeout(230);
 out.returnSurvivesOldExit=!(await sample()).hidden&&(await sample()).title==='Hover A';

 await outside();await hidden();
 await page.evaluate(async()=>{await window.__hpTest.setLayout(l=>({...l,d_light1:{s:'f1',x:.94,y:.88}}));await window.__hpTest.settled();});
 const edge=await open('d_light1'),edgePoint=await point('d_light1');
 await page.mouse.move(edgePoint.x-2,edgePoint.y-2);const edgeMove=await sample();
 out.edgeStable=sameAnchor(edge,edgeMove)&&edge.motions===edgeMove.motions;
 out.edgeClamped=edge.left>=7&&edge.top>=7&&edge.right<=edge.width-7&&edge.bottom<=edge.height-7;
 evidence.push({edge,edgeMove});
 // A small resize retains the actual hit target while requiring a new clamp.
 await page.setViewportSize({width:1190,height:900});await page.evaluate(()=>window.__hpTest.settled());
 const resized=await sample();evidence.push({resized});out.resizeReclamps=!resized.hidden&&resized.left>=7&&resized.top>=7
  &&resized.right<=resized.width-7&&resized.bottom<=resized.height-7&&resized.motions===edge.motions;
 await page.setViewportSize({width:1000,height:750});await hidden();
 out.resizeRetiresDepartedTarget=(await sample()).hidden;

 await outside();await hidden();await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await open('d_light1');out.reducedMotionImmediatePaint=reduced.opacity===1&&reduced.animations.length===0;
 await outside();await hidden();out.reducedMotionExit=(await sample()).hidden;
 await page.emulateMedia({reducedMotion:'no-preference'});

 // Genuine existing mode/space controls retire a pending lease and an open tooltip.
 await move(await point('d_light1'));await page.evaluate(()=>window.__hpTest.setMode('devices'));
 await page.waitForTimeout(230);out.modeCancelsPending=(await sample()).hidden;
 await page.evaluate(()=>window.__hpTest.setMode('view'));await outside();
 await open('d_light1');await page.evaluate(()=>window.__hpTest.setMode('devices'));
 out.modeClosesVisible=(await sample()).hidden;
 await page.evaluate(()=>window.__hpTest.setMode('view'));await outside();
 const other=await page.evaluate(()=>window.__card._serverCfg.spaces.find(s=>s.id!=='f1').id);
 await move(await point('d_light1'));await page.evaluate(id=>window.__hpTest.switchSpace(id),other);
 await page.waitForTimeout(230);out.spaceCancelsPending=(await sample()).hidden;
 await page.evaluate(()=>window.__hpTest.switchSpace('f1'));await outside();
 await open('d_light1');await page.evaluate(id=>window.__hpTest.switchSpace(id),other);
 out.spaceClosesVisible=(await sample()).hidden;
 await page.evaluate(()=>window.__hpTest.switchSpace('f1'));await outside();
 // Deliver page lifecycle signals to the actual shared visibility subscriber.
 // Hover itself remains native; no tooltip/card state is assigned by the witness.
 await move(await point('d_light1'));
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 await page.waitForTimeout(230);out.pageHideCancelsPending=(await sample()).hidden;
 await page.evaluate(async()=>{window.dispatchEvent(new PageTransitionEvent('pageshow'));await window.__hpTest.settled();});
 await open('d_light1');
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 out.pageHideClosesVisible=(await sample()).hidden;
 await page.evaluate(async()=>{window.dispatchEvent(new PageTransitionEvent('pageshow'));await window.__hpTest.settled();});
 await outside();
 await move(await point('d_light1'));
 await page.evaluate(()=>{const card=window.__card,parent=card.parentNode;card.remove();parent.append(card);});
 await page.waitForTimeout(260);out.remountCancelsPending=(await sample()).hidden;
 checkAll(out);
}catch(error){check('deviceTooltipHoverCompleted',false);out.error=String(error?.stack||error);}
const dir=new URL('../artifacts/device-tooltip-hover-1409/',import.meta.url);mkdirSync(dir,{recursive:true});
writeFileSync(new URL('evidence.json',dir),JSON.stringify({out,evidence},null,2));
await finish(browser,out);
