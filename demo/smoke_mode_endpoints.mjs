// #1344: observe frame(to) before its terminal RAF, rather than capture rest twice.
import fs from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 800 }, 2);
const results = {}, diagnostics = [];
// Same stage policy as demo/golden/matrix.mjs, without accepting any new baseline.
const threshold = { maxChannelDelta: 10, maxDiffRatio: .0005 };
const routes = [['view','plan'], ['plan','view'], ['view','devices'],
  ['devices','view'], ['view','decor'], ['decor','view'], ['plan','devices']];
const ready = () => page.evaluate(async () => {
  const card = window.__card;
  for (let n = 0; n < 180; n++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (!card._modeTransitionBusy) {
      await card.updateComplete;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return;
    }
  }
  throw Error('Mode did not settle');
});
async function compare(a, b) {
  return page.evaluate(async ({ a, b, threshold }) => {
    async function decode(data) {
      const image = new Image();
      image.src = 'data:image/png;base64,' + data;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return { w:image.width, h:image.height, rgba:context.getImageData(0,0,image.width,image.height).data };
    }
    const x = await decode(a), y = await decode(b);
    if (x.w !== y.w || x.h !== y.h) return { ok:false, size:[x.w,x.h,y.w,y.h] };
    let differing = 0, max = 0;
    for (let i = 0; i < x.rgba.length; i += 4) {
      let delta = 0;
      for (let channel = 0; channel < 4; channel++)
        delta = Math.max(delta, Math.abs(x.rgba[i+channel] - y.rgba[i+channel]));
      max = Math.max(max, delta);
      if (delta > threshold.maxChannelDelta) differing++;
    }
    const ratio = differing / (x.w*x.h);
    return { ok:ratio <= threshold.maxDiffRatio, ratio, max };
  }, { a:a.toString('base64'), b:b.toString('base64'), threshold });
}

try {
  await page.clock.setFixedTime(new Date('2026-11-07T12:00:00Z'));
  await page.emulateMedia({ reducedMotion:'no-preference' });
  results.exactTerminalGeometry=await page.evaluate(()=>{
    const card=window.__card, owner=card._modePresentation, probe=document.createElement('div');
    probe.style.cssText='position:absolute;visibility:hidden;height:1px;left:0;top:0';
    card.renderRoot.append(probe);
    owner.set(probe,'width','1279.9999999998px');
    owner.set(probe,'width','1280px');
    const exact=probe.getBoundingClientRect().width===1280;
    owner.clear();probe.remove();return exact;
  });
  results.latestAuthoredStyleSurvives=await page.evaluate(()=>{
    const owner=window.__card._modePresentation, probe=document.createElement('div');
    probe.setAttribute('style','position:absolute;opacity:.4');
    owner.set(probe,'opacity','0.2');
    const next='position:absolute;left:50%;opacity:.6';
    probe.setAttribute('style',next);owner.adoptRenderedStyles();
    owner.set(probe,'opacity','0.1');owner.clear();
    return probe.getAttribute('style')===next;
  });
  results.quietInertOwnership=await page.evaluate(()=>{
    const owner=window.__card._modePresentation,probe=document.createElement('div');
    const observer=new MutationObserver(()=>{});observer.observe(probe,{attributes:true,attributeFilter:['inert']});
    for(let n=0;n<20;n++)owner.setInert(probe,true);
    owner.clear();const records=observer.takeRecords();observer.disconnect();
    return records.length===2 && !probe.inert;
  });
  results.sampledOpacityHasOneOwner=await page.evaluate(()=>{
    const owner=window.__card._modePresentation,probe=document.createElement('div');
    probe.style.cssText='position:absolute;opacity:.7';window.__card.renderRoot.append(probe);
    const original=probe.getAttribute('style');owner.opacity(probe,'.7');
    const observer=new MutationObserver(()=>{});observer.observe(probe,{attributes:true,attributeFilter:['style']});
    owner.opacity(probe,'.2',true);const first=Number(getComputedStyle(probe).opacity);
    const effects=probe.getAnimations();owner.opacity(probe,'.8',true);
    const second=Number(getComputedStyle(probe).opacity);
    const sampled=effects.length===1&&effects[0].playState==='paused'
      &&probe.getAnimations()[0]===effects[0]&&observer.takeRecords().length===0;
    owner.clear();observer.disconnect();
    const cleaned=probe.getAnimations().length===0&&probe.getAttribute('style')===original;
    owner.opacity(probe,'.7');owner.opacity(probe,'.35',true);
    const reused=probe.getAnimations()[0]===effects[0] && effects[0].playState==='paused'
      && Math.abs(Number(getComputedStyle(probe).opacity)-.35)<.00001;
    owner.dispose();
    const disposed=probe.getAnimations().length===0&&probe.getAttribute('style')===original;
    probe.remove();return sampled&&Math.abs(first-.2)<.00001&&Math.abs(second-.8)<.00001&&cleaned&&reused&&disposed;
  });
  results.sampledFilterKeepsAuthoredBase=await page.evaluate(()=>{
    const owner=window.__card._modePresentation,probe=document.createElement('div');
    probe.style.cssText='position:absolute;opacity:.7;filter:opacity(.35)';window.__card.renderRoot.append(probe);
    const original=probe.getAttribute('style'),observer=new MutationObserver(()=>{});
    observer.observe(probe,{attributes:true,attributeFilter:['style']});
    owner.filterOpacity(probe,.2,true);const effect=probe.getAnimations()[0];
    const sampled=effect?.playState==='paused'&&getComputedStyle(probe).opacity==='0.7'
      &&getComputedStyle(probe).filter==='opacity(0.2)';
    owner.filterOpacity(probe,1,false);
    const ordinary=getComputedStyle(probe).filter==='opacity(0.35)'&&probe.getAnimations().length===0;
    owner.filterOpacity(probe,.6,true);const reused=probe.getAnimations()[0]===effect;
    owner.dispose();const quiet=observer.takeRecords().length===0;observer.disconnect();
    const clean=probe.getAnimations().length===0&&probe.getAttribute('style')===original;
    probe.remove();return sampled&&ordinary&&reused&&quiet&&clean;
  });
  for (const overlap of [false, true]) {
    if (overlap) await page.evaluate(async () => {
      await window.__hpTest.setLayout(layout => {
        const devices=window.__card._renderDevices.filter(d=>d.space===window.__card._space);
        if(devices.length<2)throw Error('Overlap fixture markers missing');
        const a=window.__card._pos(devices[0],false);
        layout[devices[0].id]={x:a.x/1000,y:a.y/1000,s:window.__card._space};
        layout[devices[1].id]={...layout[devices[0].id]};
      });
    });
    for (const width of [1280, 390]) {
      await page.setViewportSize({width,height:width===390?844:800});
      await page.evaluate(async width => {
        const card = window.__card;
        // The demo host carries its own margins/width. Use a neutral outer
        // container so locator screenshots never scroll between the two frames.
        card.style.margin='0'; card.style.width='100%'; card.style.maxWidth='none';
        for(let host=card.parentElement;host;host=host.parentElement){
          host.style.margin='0'; host.style.padding='0'; host.style.maxWidth='none';
          host.style.width=width+'px'; host.style.minWidth='0';
        }
        document.documentElement.style.overflow='hidden';
        scrollTo(0,0);
        dispatchEvent(new Event('resize'));
        await window.__hpTest.setVolumetricView(false);
        await window.__hpTest.settled();
      }, width);
      await ready();
      results['actualWidth-'+width+'-'+overlap] = await page.evaluate(width =>
        Math.abs(window.__card.getBoundingClientRect().width - width) < 1, width);
      for (const [from, to] of routes) {
        await page.evaluate(from => window.__card._setMode(from, false), from);
        await ready();
        await page.evaluate(to => {
          const card = window.__card, controller = card._modeTransition, clock = controller._clock;
          window.__hpEndpoint = { clock, callback:null };
          // Retain the actual controller frame and its token. Only the next,
          // settling RAF is held; rendering and the terminal tick stay real.
          controller._clock = {
            ...clock,
            requestFrame(callback) {
              if (controller.state?.phase === 'settling') {
                window.__hpEndpoint.callback = callback;
                return -1344;
              }
              return clock.requestFrame(callback);
            },
            cancelFrame(id) {
              if (id === -1344) window.__hpEndpoint.callback = null;
              else clock.cancelFrame(id);
            },
          };
          card._setMode(to);
        }, to);
        if (!overlap && width === 390 && from === 'view' && to === 'plan') {
          await page.evaluate(async () => {
            const card=window.__card;
            while (!card._modeTransition.state) await new Promise(resolve=>requestAnimationFrame(resolve));
            await new Promise(resolve=>requestAnimationFrame(resolve));
            const state=card.hass.states['light.ceiling'];
            card.hass={...card.hass,states:{...card.hass.states,'light.ceiling':{...state,state:'unavailable'}}};
            await card.updateComplete;
          });
        }
        await page.waitForFunction(() => !!window.__hpEndpoint.callback);
        const before=await page.evaluate(()=>{const c=window.__card,head=c.renderRoot.querySelector('.hdr > .head');return {visual:c._modeTransitionVisual,hdrH:c._hdrH,headHeight:head.getBoundingClientRect().height,card:c.renderRoot.querySelector('ha-card').getBoundingClientRect().toJSON(),stage:c._stageEl.getBoundingClientRect().toJSON(),view:c._view,layer:(()=>{const n=c.renderRoot.querySelector('.devlayer');return {style:n.getAttribute('style'),rect:n.getBoundingClientRect().toJSON()};})(),gear:[...c.renderRoot.querySelectorAll('.rlgearbtn')].map(n=>({room:n.dataset.room,style:n.getAttribute('style'),rect:n.getBoundingClientRect().toJSON()}))};});
        const endpoint = await page.locator('houseplan-card .stage').screenshot({animations:'allow'});
        const held = await page.evaluate(() => {
          const card = window.__card;
          return card._modeTransition.state?.phase === 'settling'
            && card._modeTransitionBusy && card._stageEl.inert;
        });
        await page.evaluate(() => {
          const card = window.__card, endpoint = window.__hpEndpoint;
          card._modeTransition._clock = endpoint.clock;
          endpoint.clock.requestFrame(endpoint.callback);
        });
        await ready();
        const rest = await page.locator('houseplan-card .stage').screenshot({animations:'allow'});
        const diff = await compare(endpoint, rest);
        if (!overlap && width === 390 && from === 'view' && to === 'plan')
          results.latestHAAvailability=await page.evaluate(()=>window.__card.renderRoot.querySelector('[data-hp="device"][data-id="d_light1"]')?.classList.contains('unavail')===true);
        const cleaned = await page.evaluate(() => {
          const card = window.__card, root = card.renderRoot;
          return !card._stageEl.inert && card._modePresentation.styles.size === 0
            && card._modePresentation.inert.size === 0 && card._modePresentation.opacityAnimations.size === 0 && card._modePresentation.filterAnimations.size === 0 && root.querySelectorAll('.plan-svg').length === 1
            && [...root.querySelectorAll('.hp-mode-scene-svg')].every(node =>
              !node.style.willChange && !node.style.transform && !node.style.opacity);
        });
        const id = width+'-'+(overlap?'overlap':'normal')+'-'+from+'-'+to;
        const markerInput = await page.evaluate(() => {
          const c=window.__card, interactive=c._mode==='view'||c._mode==='devices';
          return [...c.renderRoot.querySelectorAll('[data-hp="device"]')].every(n=>
            n.inert===!interactive && (interactive ? n.getAttribute('role')==='button' && n.tabIndex===0
              : !n.hasAttribute('role') && !n.hasAttribute('tabindex')));
        });
        results[id] = held && cleaned && diff.ok && markerInput;
        diagnostics.push({id,held,cleaned,...diff});
        if (!results[id]) {
          console.log('endpointFailure',JSON.stringify({id,before,after:await page.evaluate(()=>{const c=window.__card;return {hdrH:c._hdrH,headHeight:c.renderRoot.querySelector('.hdr > .head').getBoundingClientRect().height,card:c.renderRoot.querySelector('ha-card').getBoundingClientRect().toJSON(),stage:c._stageEl.getBoundingClientRect().toJSON(),view:c._view,layer:(()=>{const n=c.renderRoot.querySelector('.devlayer');return {style:n.getAttribute('style'),rect:n.getBoundingClientRect().toJSON()};})(),gear:[...c.renderRoot.querySelectorAll('.rlgearbtn')].map(n=>({room:n.dataset.room,style:n.getAttribute('style'),rect:n.getBoundingClientRect().toJSON()}))};})}));
          const directory = 'artifacts/process-next/mode-endpoints';
          fs.mkdirSync(directory,{recursive:true});
          fs.writeFileSync(directory+'/'+id+'-to.png',endpoint);
          fs.writeFileSync(directory+'/'+id+'-rest.png',rest);
        }
      }
    }
  }
  console.log(JSON.stringify({endpointPixels:diagnostics}));
  checkAll(results);
  await finish(browser,results);
} catch (error) {
  await browser.close();
  throw error;
}
