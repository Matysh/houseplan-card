// #101: View/editor navigation has one controller for toolbar height, stage
// geometry and camera. This smoke deliberately observes real animation frames;
// it never asserts an exact wall-clock millisecond.
import { launch, checkAll, finish } from './serve.mjs';
import { collectModeTransitionSamples } from './performance/mode-transition.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });
page.on('console',message=>{if(message.text().startsWith('Hidden projection'))console.log(message.text());});
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const sleepFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const sampleUntilSettled = async () => {
    const samples = [];
    const started = performance.now();
    do {
      await sleepFrame();
      const stage = root().querySelector('.stage');
      const svg = stage?.querySelector(':scope .zoomwrap .plan-svg');
      if (stage && svg) {
        const vb = svg.viewBox.baseVal;
        samples.push({
          busy: card._modeTransitionBusy,
          inert: stage.inert,
          height: stage.getBoundingClientRect().height,
          aspect: vb.width / vb.height,
          stageAspect: stage.clientWidth / stage.clientHeight,
          ppu: svg.getBoundingClientRect().width / vb.width,
        });
      }
    } while (card._modeTransitionBusy && performance.now() - started < 1000);
    return samples;
  };

  await card.updateComplete;
  card._setMode('view');
  await card.updateComplete;
  const viewHeight = root().querySelector('.stage').clientHeight;
  const initialSvg = root().querySelector('.plan-svg');
  const initialPpu = initialSvg.getBoundingClientRect().width / initialSvg.viewBox.baseVal.width;

  card._setMode('plan');
  const enter = await sampleUntilSettled();
  const planHeight = root().querySelector('.stage').clientHeight;
  const distinctEnterHeights = new Set(enter.map((sample) => Math.round(sample.height))).size;

  card._setMode('devices');
  const swap = await sampleUntilSettled();
  const chromeInner = root().querySelector('.editorchrome-inner');

  card._setMode('view');
  const leave = await sampleUntilSettled();
  const restoredHeight = root().querySelector('.stage').clientHeight;
  const allFrames = [...enter, ...swap, ...leave];
  return {
    enterHadIntermediateGeometry: distinctEnterHeights >= 3,
    editorConsumesViewportHeight: planHeight < viewHeight,
    stageInertDuringMotion: allFrames.filter((sample) => sample.busy).every((sample) => sample.inert),
    // The scene raster now stays fixed while the stage clips it. Its physical
    // scale, rather than matching two different viewport boxes, is invariant.
    cameraKeepsScreenScale: allFrames.every((sample) =>
      Number.isFinite(sample.ppu) && Math.abs(sample.ppu - initialPpu) < 1e-5),
    editorSwapUsesSharedTimeline: swap.some((sample) => sample.busy) && !!chromeInner,
    viewHeightRestored: Math.abs(restoredHeight - viewHeight) <= 2,
    controllerSettled: card._modeTransitionBusy === false
      && !root().querySelector('.stage').classList.contains('mode-transition'),
  };
});

// Numeric timings are diagnostics only; the existing behavioral checks above
// remain the only smoke assertions.
let diagnostics;
try { diagnostics=await page.evaluate(collectModeTransitionSamples,{fixture:"demo-smoke",samples:1}); }
catch(error) { diagnostics={status:"unavailable",diagnostic:true,reason:error.message}; }
console.log(JSON.stringify({modeTransitionDiagnostics:diagnostics}));

// A first unvisited mode after explicit installation uses accepted chrome metrics.
result.warmChromeAvoidsSceneMeasurements = await page.evaluate(async () => {
 const c=window.__card,frame=()=>new Promise(r=>requestAnimationFrame(r));
 c._setMode('view');while(c._modeTransitionBusy)await frame();await c.updateComplete;
 await c._ensureEditorRuntime();const rt=c._editorRuntime;
 if(!rt.modeLayoutFor('decor'))return false;
 const width=Object.getOwnPropertyDescriptor(Element.prototype,'clientWidth');
 const height=Object.getOwnPropertyDescriptor(Element.prototype,'scrollHeight');
 const header=rt._modeHeaderHeight,flip=c._headerMotion.start;
 try{
  Object.defineProperty(Element.prototype,'clientWidth',{...width,get(){if(c._modeTransitionBusy&&this.localName==='ha-card')throw Error('mode read card width');return width.get.call(this)}});
  Object.defineProperty(Element.prototype,'scrollHeight',{...height,get(){if(c._modeTransitionBusy&&this.classList.contains('editorchrome-inner'))throw Error('mode measured toolbar');return height.get.call(this)}});
  rt._modeHeaderHeight=function(...args){if(c._modeTransitionBusy)throw Error('mode remeasured header');return header.apply(this,args)};
  c._headerMotion.start=function(head,before,reduced,positions){if(!positions)throw Error('mode measured control positions');return flip.call(this,head,before,reduced,positions)};
  c._setMode('decor');let attempts=0;while(c._modeTransitionBusy&&attempts++<180)await frame();await c.updateComplete;
  return !c._modeTransitionBusy&&!c._stageEl.inert&&c._mode==='decor';
 }finally{Object.defineProperty(Element.prototype,'clientWidth',width);Object.defineProperty(Element.prototype,'scrollHeight',height);rt._modeHeaderHeight=header;c._headerMotion.start=flip;}
});

// Ordinary View gestures keep one bounded scene promotion after editor install.
result.oneSceneGestureSurface = await page.evaluate(async () => {
 const c=window.__card,frame=()=>new Promise(r=>requestAnimationFrame(r));
 c._setMode('view');while(c._modeTransitionBusy)await frame();await c.updateComplete;
 const root=c.renderRoot,stage=c._stageEl,svg=root.querySelector('.plan-svg');
 const before=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;
 const rect=stage.getBoundingClientRect();
 stage.dispatchEvent(new WheelEvent('wheel',{deltaY:-120,clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,bubbles:true,cancelable:true}));
 await frame();await frame();
 const surfaces=()=>[...root.querySelectorAll('[data-hp-live-scene="floor"],[data-hp-live-viewbox="floor"]')];
 const promoted=surfaces().filter(n=>n.style.willChange.includes('transform')).length;
 await new Promise(r=>setTimeout(r,500));await c.updateComplete;
 const after=svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;
 return promoted===1&&after>before&&surfaces().every(n=>!n.style.transform&&!n.style.willChange);
});

// The projection crossing retains one real scene and switches it while faded;
// narrow and reduced-motion paths must leave neither a veil nor an inert stage.
for (const [name, width, reduced] of [['isoWide', 1440, false], ['isoNarrow', 380, false], ['isoRotated', 1440, false], ['isoReduced', 820, true]]) {
  await page.setViewportSize({width, height:760});
  await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); await window.__hpTest.settled(); });
  if(name==='isoRotated'){
    await page.locator('houseplan-card [data-hp=rotate-right]').click();
    await page.waitForTimeout(300);
  }
  result[name] = await page.evaluate(async () => {
    const c=window.__card, root=c.renderRoot, frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    const ready=async()=>{const start=performance.now();while(c._modeTransitionBusy){if(performance.now()-start>3000)throw Error('Mode did not settle');await frame();}await c.updateComplete;await frame();};
    await ready();
    const scale=()=>{const svg=root.querySelector('.plan-svg');return svg.getBoundingClientRect().width/svg.viewBox.baseVal.width;};
    const start=scale(), samples=[];
    for(const mode of ['plan','devices','decor','view']) {
      c._setMode(mode);
      do {await frame();samples.push(scale());}while(c._modeTransitionBusy);
      await ready();
      if(root.querySelectorAll('.zoomwrap').length!==1)return false;
    }
    c._setMode('plan');await frame();c._setMode('view');await frame();c._setMode('devices');await ready();
    c._setMode('view');await ready();
    const stage=root.querySelector('.stage'),scene=root.querySelector('.zoomwrap');
    return samples.every(value=>Number.isFinite(value)&&Math.abs(value-start)<1e-5)
      &&stage.classList.contains('projection-iso')&&!stage.inert&&!scene.style.width&&!scene.style.opacity;
  });
}

await page.emulateMedia({reducedMotion:'no-preference'});
await page.waitForFunction(()=>!window.__card._reducedMotion);
await page.setViewportSize({width:1440,height:760});
await page.evaluate(()=>window.__hpTest.settled());
result.hiddenProjectionRecovery=await page.evaluate(async()=>{
 const c=window.__card,frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const ready=async()=>{for(let n=0;n<120;n++){await frame();if(!c._modeTransitionBusy&&c._continuity.state==='steady')break;}await c.updateComplete;};
 for(const mode of ['plan','view']){
  await ready();c.style.display='none';
  // This is a genuinely unmeasurable stage, not a mocked visual snapshot.
  if(c._stageEl.clientWidth||c._currentModeVisual()!==null){console.log('Hidden projection not hidden',mode);return false;}
  c._setMode(mode);await c.updateComplete;await frame();
  c.style.removeProperty('display');dispatchEvent(new Event('resize'));await ready();
  if(c._modeProjectionSource!==null||c._modeProjectionCrossing||c._modeTransitionBusy){console.log('Hidden projection flags',mode);return false;}
  const title=`Recovered ${mode}`;
  await window.__hpTest.setServerConfig(cfg=>{const space=cfg.spaces.find(space=>space.id===c._space);
    space.rooms[0].name=title;space.settings={...space.settings,show_names:true};});
  await ready();
  const label=c.renderRoot.querySelector('[data-hp=room-label]')?.textContent||'';
  if(!label.includes(title)||c.renderRoot.querySelector('.zoomwrap').style.opacity){console.log('Hidden projection stale',JSON.stringify({mode,label,opacity:c.renderRoot.querySelector('.zoomwrap').style.opacity}));return false;}
 }
 return true;
});


// #1344: both owned hold phases remain busy/inert; host consumers can cancel them.
await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(false);await window.__card._viewRuntimes.live.ensure();await window.__hpTest.settled();});
for(const phase of [0,1])for(const action of ['ha','camera','reduced']){
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>!window.__card._reducedMotion);
  await page.evaluate(async()=>{const c=window.__card;c._setMode('view',false);await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const clock=c._modeTransition._clock,hold={clock,pending:null,sequence:0,calls:[],sync:c._liveRt.syncContacts};
    c._liveRt.syncContacts=function(...args){hold.calls.push({busy:c._modeTransitionBusy,state:c._renderPlanHass?.states?.['light.ceiling']?.state});return hold.sync.apply(this,args);};
    window.__modeHold=hold;c._modeTransition._clock={...clock,requestFrame(callback){
      if(c._modeTransition.state?.phase==='settling'){const id=--hold.sequence;hold.pending={callback,id};return id;}return clock.requestFrame(callback);
    },cancelFrame(id){if(id<0){if(hold.pending?.id===id)hold.pending=null;}else clock.cancelFrame(id);}};c._setMode('plan');});
  await page.waitForFunction(()=>!!window.__modeHold.pending);
  if(phase===1){await page.evaluate(()=>{const h=window.__modeHold,cb=h.pending.callback;h.pending=null;h.clock.requestFrame(cb);});await page.waitForFunction(()=>!!window.__modeHold.pending);}
  const held=await page.evaluate(()=>{const c=window.__card;return c._modeTransition.active&&c._modeTransitionBusy&&c._stageEl.inert&&c._modeTransition.state.phase==='settling';});
  await page.evaluate(()=>{window.__modeHold.stale=window.__modeHold.pending.callback;});
  if(action==='ha'){
    await page.evaluate(async()=>{const c=window.__card,state=c.hass.states['light.ceiling'];c.hass={...c.hass,states:{...c.hass.states,'light.ceiling':{...state,state:'unavailable'}}};await c.updateComplete;});
    result['hold'+phase+'-ha-keeps-presentation']=held&&await page.evaluate(()=>{const c=window.__card;return c._modeTransition.active&&c._modeTransitionBusy&&c._stageEl.inert&&!!c.renderRoot.querySelector('.stage.mode-transition');});
    await page.evaluate(()=>{const c=window.__card,h=window.__modeHold,cb=h.pending.callback;c._modeTransition._clock=h.clock;h.pending=null;h.clock.requestFrame(cb);});
  }else if(action==='camera')await page.evaluate(async()=>{window.__card._prepareCameraCommand();await window.__card.updateComplete;});
  else{await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!window.__card._modeTransitionBusy);}
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._stageEl.inert);
  if(action!=='ha'){
    result['hold'+phase+'-'+action+'-cancels']=held&&await page.evaluate(async()=>{const c=window.__card,h=window.__modeHold;c._modeTransition._clock=h.clock;c._setMode('devices');h.stale(performance.now());await c.updateComplete;while(c._modeTransitionBusy)await new Promise(r=>requestAnimationFrame(r));await c.updateComplete;return c._mode==='devices'&&!c._stageEl.inert;});
  }else result['hold'+phase+'-one-latest-contact-sync']=await page.evaluate(()=>{const h=window.__modeHold;return h.calls.length===1&&h.calls[0].busy===false&&h.calls[0].state==='unavailable';});
  await page.evaluate(()=>{const c=window.__card,h=window.__modeHold;c._modeTransition._clock=h.clock;c._liveRt.syncContacts=h.sync;delete window.__modeHold;});
}

checkAll(result);
await finish(browser, result);
