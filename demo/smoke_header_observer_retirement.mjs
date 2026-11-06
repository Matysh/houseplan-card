// #1331: a delayed ResizeObserver callback must not measure a retired header.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {launch,finish} from './serve.mjs';
const {page,browser}=await launch({width:1280,height:850});
try{
 await page.evaluate(()=>{
  const Native=window.ResizeObserver;window.__headerObserverRecords=[];
  window.ResizeObserver=class extends Native{
   constructor(callback){
    super(callback);this.record={observer:this,targets:[],fire:entries=>callback(entries,this)};
    window.__headerObserverRecords.push(this.record);
   }
   observe(target,options){this.record.targets.push(target);return super.observe(target,options);}
  };
 });
 const configure=async kiosk=>{
  await page.evaluate(async kiosk=>{
   const c=window.__card;c.setConfig({type:'custom:houseplan-card',language:'en',kiosk});
   await c.updateComplete;await window.__hpTest.settled();
  },kiosk);
  await page.waitForFunction(()=>!window.__card._booting&&!window.__card._cameraTransition.active);
 };
 await configure(true);await configure(false);
 await page.evaluate(()=>{
  const c=window.__card,record=window.__headerObserverRecords.find(r=>r.observer===c._roHdr);
  if(!record)throw Error('Current native header observer not captured');
  record.header=c.renderRoot.querySelector('.hdr');record.head=record.header.querySelector(':scope > .head');
  window.__retiredHeaderObserver=record;
 });
 await configure(true);await configure(false);
 const evidence=await page.evaluate(async()=>{
  const c=window.__card,old=window.__retiredHeaderObserver;
  const before={revision:c._cfgRev,layoutRevision:c._layoutRev,phase:c._panelHeaderChoice.phase,compact:c._compactSpaces};
  const retired=old.observer!==c._roHdr;
  if(!retired)throw Error('Fixture did not retire the captured header lease');
  const getStyle=window.getComputedStyle,raf=window.requestAnimationFrame;let retiredReads=0,staleScheduledFrames=0;
  window.getComputedStyle=function(element,...args){if(element===old.head||element===old.header)retiredReads++;return getStyle.call(this,element,...args);};
  try{
   window.requestAnimationFrame=function(callback){staleScheduledFrames++;return raf.call(this,callback);};
   try{old.fire([{target:old.header,contentRect:{width:1}}]);}finally{window.requestAnimationFrame=raf;}
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   await c.updateComplete;
   return{retired,headerReused:old.header.isConnected,retiredReads,staleScheduledFrames,before,after:{revision:c._cfgRev,layoutRevision:c._layoutRev,phase:c._panelHeaderChoice.phase,compact:c._compactSpaces}};
  }finally{window.getComputedStyle=getStyle;}
 });
 mkdirSync('artifacts/header-observer-retirement',{recursive:true});
 writeFileSync('artifacts/header-observer-retirement/evidence.json',JSON.stringify(evidence,null,2));
 assert.equal(evidence.retired,true);
 assert.equal(evidence.staleScheduledFrames,0,'a retired observer must not schedule header work, including when Lit reuses the header DOM');
 if(!evidence.headerReused)assert.equal(evidence.retiredReads,0,'a stale observer may not measure its retired header');
 assert.deepEqual(evidence.after,evidence.before,'stale delivery leaves the current header and data revisions intact');
 console.log('OK header observer retirement');
}finally{await finish(browser);}