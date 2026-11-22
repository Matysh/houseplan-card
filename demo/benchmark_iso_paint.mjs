/** #1470 paired paint benchmark. All data is fictional and all I/O is local.
 * HP_ISO_PAINT_REFERENCE may point to a frozen source+bundle tree, checked by
 * the ordinary freshness guard. It never disables the guard or accepts PNGs.
 * HP_ISO_PAINT_CAPTURE=1 records paired-oracle inputs instead of timed drags. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const width=Number(process.env.HP_ISO_PAINT_WIDTH||3840),height=width===3840?2160:1080;
const directory=resolve(process.env.HP_ISO_PAINT_OUTPUT||'output/iso-paint');
mkdirSync(directory,{recursive:true});
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
const {page,browser,provenance}=await startIsoPaintScene({width,height,referenceRoot:process.env.HP_ISO_PAINT_REFERENCE});
writeFileSync(join(directory,'provenance.json'),JSON.stringify(provenance,null,2));
try {
  const records=[];
  const capture=async name=>{
    await page.screenshot({path:join(directory,name+'.png')});
    const labels=await page.evaluate(()=>[...window.__isoPaint.renderRoot.querySelectorAll('.roomlabel')].map(label=>{
      const boxes=[label,...label.querySelectorAll('.rlname,.rlmetrics')].map(node=>node.getBoundingClientRect());
      const x=Math.min(...boxes.map(r=>r.left)),y=Math.min(...boxes.map(r=>r.top));
      return{id:label.dataset.id,rect:[x,y,Math.max(...boxes.map(r=>r.right))-x,Math.max(...boxes.map(r=>r.bottom))-y],alpha:label.parentElement.style.opacity};
    }));
    writeFileSync(join(directory,name+'.json'),JSON.stringify(labels,null,2));
  };
  if(process.env.HP_ISO_PAINT_INTERACTIONS) {
    for(const zoom of [1,2.18]) for(const action of ['pan','wheel','hover','ha-change']) {
      const samples=[];
      for(let sample=-1;sample<3;sample++) {
        await zoomIsoPaint(page,zoom);await page.mouse.move(5,5);await page.waitForTimeout(200);
        const builds=await page.evaluate(()=>window.__isoPaint._isoStructuralBuildCount);
        let target;
        if(action==='hover')target=await page.evaluate(()=>{
          const nodes=[...window.__isoPaint.renderRoot.querySelectorAll('.dev:not(.iso-tile-shadow)')];
          const rect=nodes.map(node=>node.getBoundingClientRect()).find(r=>r.left>10&&r.top>80&&r.right<innerWidth-10&&r.bottom<innerHeight-10);
          if(!rect)throw Error('No visible native hover target');return{x:rect.x+rect.width/2,y:rect.y+rect.height/2};
        });
        const begin=performance.now();
        if(action==='pan'){await page.mouse.move(40,180);await page.mouse.down();await page.mouse.move(840,430,{steps:45});await page.mouse.up();}
        if(action==='wheel'){await page.mouse.move(width/2,height/2);await page.mouse.wheel(0,-160);}
        if(action==='hover')await page.mouse.move(target.x,target.y);
        if(action==='ha-change')await page.evaluate(async()=>{
          const card=window.__isoPaint,id=Object.keys(card.hass.states).find(id=>id.startsWith('light.'));
          const state=card.hass.states[id];
          card.hass={...card.hass,states:{...card.hass.states,[id]:{...state,state:state.state==='on'?'off':'on'}}};
          await card.updateComplete;
        });
        await settleIsoPaint(page);
        const duration=performance.now()-begin;
        const delta=await page.evaluate(before=>window.__isoPaint._isoStructuralBuildCount-before,builds);
        if(delta!==0)throw Error(`Unexpected structural rebuild for ${action}`);
        if(sample>=0)samples.push(duration);
      }
      records.push({zoom,action,samples,median:median(samples)});console.log(JSON.stringify(records.at(-1)));
    }
    const result={width,height,records,provenance,reference:process.env.HP_ISO_PAINT_REFERENCE||null};
    if(process.env.HP_ISO_PAINT_BASELINE) {
      const baseline=JSON.parse(readFileSync(process.env.HP_ISO_PAINT_BASELINE,'utf8'));
      result.comparison=records.map(record=>{
        const previous=baseline.records.find(item=>item.zoom===record.zoom&&item.action===record.action);
        if(!previous)return{zoom:record.zoom,action:record.action,unavailable:true};
        return{zoom:record.zoom,action:record.action,ratio:record.median/previous.median,
          pass:record.median<=previous.median+Math.max(50,previous.median*.1)};
      });
      if(result.comparison.some(item=>item.pass===false))process.exitCode=1;
    }
    writeFileSync(join(directory,'interactions.json'),JSON.stringify(result,null,2));
  } else if(process.env.HP_ISO_PAINT_CAPTURE) {
    for(const dark of [false,true]) for(const rotation of [0,45,90,135,180,225,270,315]) {
      await page.evaluate(async dark=>{const c=window.__isoPaint;c.hass={...c.hass,themes:{darkMode:dark}};await c.updateComplete;},dark);
      if (process.env.HP_ISO_PAINT_LIGHT_SWEEP) {
        await zoomIsoPaint(page,1);await page.mouse.move(5,5);
        for (const state of ['off','on']) {
          await page.evaluate(async state => {
            const card = window.__isoPaint;
            const states = Object.fromEntries(Object.entries(card.hass.states).map(([id, row]) =>
              [id, id.startsWith('light.') ? { ...row, state } : row]));
            card.hass = { ...card.hass, states };
            await card.updateComplete;
          }, state);
          await page.waitForTimeout(700);
          await capture(`${dark?'dark':'light'}-${rotation}-${state}`);
        }
      } else for(const zoom of [1,2.18]) {
        await zoomIsoPaint(page,zoom);await page.mouse.move(5,5);await page.waitForTimeout(700);
        const name=`${dark?'dark':'light'}-${rotation}-${zoom}`;
        await capture(name);
      }
      await page.locator('[data-hp="rotate-right"]').first().click();await settleIsoPaint(page);
    }
    if (!process.env.HP_ISO_PAINT_LIGHT_SWEEP) {
    await page.evaluate(async()=>{
      const c=window.__isoPaint,next=structuredClone(c._serverCfg),space=next.spaces[0];
      space.rooms[0].name='A long fictional room title overlapping its neighbour';
      c._serverCfg=next;c._layout={...c._layout,
        ['rl_'+space.rooms[0].id]:{s:space.id,x:.125,y:.16},
        ['rl_'+space.rooms[1].id]:{s:space.id,x:.125,y:.16}};
      await c.updateComplete;
    });
    await zoomIsoPaint(page,1);await page.mouse.move(5,5);await page.waitForTimeout(700);
    await capture('overlap-long-idle');
    const label=page.locator('.roomlabel').first(),box=await label.boundingBox();
    if(box){await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await capture('overlap-long-hover');}
    await page.mouse.move(5,5);await page.locator('.roomlabel .rlfit').first().focus();
    await capture('overlap-long-focus');
    }
  } else {
    for(const mode of (process.env.HP_ISO_PAINT_MODES||'iso,flat').split(',')) {
      await page.evaluate(async mode=>{const c=window.__isoPaint;c._serverCfg.settings.volumetric_view=mode!=='flat';c.requestUpdate();await c.updateComplete;},mode);
      await settleIsoPaint(page);
      const samples=[];
      const drag=async()=>{
        await zoomIsoPaint(page);await page.mouse.move(5,5);await page.waitForTimeout(200);
        if(mode==='no-mask')await page.evaluate(()=>{for(const plane of window.__isoPaint.renderRoot.querySelectorAll('.iso-room-label-plane'))plane.style.maskImage='none';});
        await page.evaluate(()=>{window.__isoPaintDeltas=[];window.__isoPaintActive=true;let previous;
          const tick=time=>{if(previous)window.__isoPaintDeltas.push(time-previous);previous=time;if(window.__isoPaintActive)requestAnimationFrame(tick);};requestAnimationFrame(tick);});
        const begin=performance.now();await page.mouse.move(40,180);await page.mouse.down();
        await page.mouse.move(840,430,{steps:45});await page.mouse.up();
        const duration=performance.now()-begin;
        const deltas=await page.evaluate(()=>{window.__isoPaintActive=false;return window.__isoPaintDeltas.sort((a,b)=>a-b);});
        return{duration,p95:deltas[Math.floor(deltas.length*.95)]||0,frames:deltas.length};
      };
      await drag(); // One excluded warmup, then retain every measured sample.
      for(let i=0;i<3;i++)samples.push(await drag());
      if((Math.max(...samples.map(s=>s.duration))-Math.min(...samples.map(s=>s.duration)))/median(samples.map(s=>s.duration))>.15)
        for(let i=0;i<2;i++)samples.push(await drag());
      const counts=await page.evaluate(()=>{const root=window.__isoPaint.renderRoot;return{
        labels:root.querySelectorAll('.roomlabel').length,markers:root.querySelectorAll('.dev:not(.iso-tile-shadow)').length,
        furniture:root.querySelectorAll('[data-hp-furniture-volume]').length};});
      const record={mode,samples,counts,median:median(samples.map(s=>s.duration)),p95:median(samples.map(s=>s.p95))};
      records.push(record);console.log(JSON.stringify(record));
    }
    const counts=await page.evaluate(()=>{const root=window.__isoPaint.renderRoot;return{
      labels:root.querySelectorAll('.roomlabel').length,markers:root.querySelectorAll('.dev:not(.iso-tile-shadow)').length,
      furniture:root.querySelectorAll('[data-hp-furniture-volume]').length,stage:[root.querySelector('.stage').clientWidth,root.querySelector('.stage').clientHeight]};});
    const result={width,height,counts,records,provenance,reference:process.env.HP_ISO_PAINT_REFERENCE||null};
    if(process.env.HP_ISO_PAINT_BASELINE) {
      const baseline=JSON.parse(readFileSync(process.env.HP_ISO_PAINT_BASELINE,'utf8'));
      if(baseline.width!==width||baseline.height!==height)throw Error('Paired viewport differs');
      result.comparison=records.map(record=>{
        const previous=baseline.records.find(item=>item.mode===record.mode);
        if(!previous)return{mode:record.mode,unavailable:true};
        const base=median(previous.samples.map(s=>s.duration)),p95=median(previous.samples.map(s=>s.p95));
        return{mode:record.mode,durationRatio:record.median/base,p95Ratio:record.p95/p95,
          pass:record.mode==='iso'?record.median<=base*.6&&record.p95<=p95*.75:record.median<=base+Math.max(50,base*.1)};
      });
      if(result.comparison.some(item=>item.pass===false))process.exitCode=1;
    }
    writeFileSync(join(directory,'result.json'),JSON.stringify(result,null,2));
  }
  if(await page.evaluate(()=>window.__isoPaintWrites.length))throw Error('A paint/navigation action attempted a write');
} finally {await browser.close();}
