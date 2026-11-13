/** #233/#1381/#1399: tape-measure spans through native selection and Resize,
 * not the retired private bubble producer. A 300x400cm axis rectangle with
 * 15cm walls has 285x385cm clear spans and 315x415cm outside spans. */
import assert from 'node:assert/strict';
import {launch,reportPageErrors} from './serve.mjs';
import {currentGraphFixture} from './helpers/graph-fixture.mjs';
import {wallKey} from '../test-build/wall-thickness.js';
const {page,browser}=await launch({width:1440,height:1050});
try {
  await page.exposeFunction('innerDimensionsFixture',config=>{
    config.model_version=10;
    for(const space of config.spaces)delete space.plan_graph;
    const space=config.spaces.find(s=>s.id==='f1');
    const poly=[[.2,.2],[.45,.2],[.45,.2+1/3],[.2,.2+1/3]];
    Object.assign(space,{cell_cm:5,view_box:[0,0,1,1],rooms:[{id:'r233',name:'Clear spans',poly}],
      walls:poly.map((a,i)=>{const b=poly[(i+1)%4];return{a,b,key:wallKey(a,b,1/240),cm:15};}),
      partitions:[],openings:[],decor:[],stairs:[],wall_columns:[]});
    delete space.wall_segments;delete space.open_spans;delete space.plan_url;delete space.plan_asset_id;
    return currentGraphFixture(config);
  });
  await page.evaluate(async()=>{
    const host=document.getElementById('host');host.style.width='1350px';host.style.maxWidth='none';
    await window.__hpTest.setServerConfig(await window.innerDimensionsFixture(structuredClone(window.__card._serverCfg)));
    await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');
  });
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
  await page.evaluate(async()=>{
    const c=window.__card,[w,h]=c._lastValidStageSize;
    c._view={x:(1000-1000*w/h)/2,y:0,w:1000*w/h,h:1000};c.requestUpdate();await c.updateComplete;
  });
  const screen=point=>page.evaluate(p=>{
    const svg=window.__card.renderRoot.querySelector('svg.plan-svg'),frame=svg.querySelector('[data-hp-plan-rotation-frame]')||svg;
    const q=new DOMPoint(...p).matrixTransform(frame.getScreenCTM());return{x:q.x,y:q.y};
  },point);
  const rows=()=>page.locator('houseplan-card [data-hp="wall-side-dimension"]').evaluateAll(elements=>elements.map(el=>({
    cm:Number(el.dataset.lengthCm),source:el.dataset.source,text:el.querySelector('text').textContent,
    painted:el.querySelector('rect').getBoundingClientRect().height>0,
  })));
  const select=async point=>{const p=await screen(point);await page.mouse.click(p.x,p.y);
    await page.waitForFunction(()=>window.__card.renderRoot.querySelectorAll('[data-hp="wall-side-dimension"]').length===2);};
  const spanPair=(actual,inner,outer)=>{
    assert.equal(actual.length,2);assert.ok(actual.every(r=>r.source==='physical'&&r.painted));
    const sorted=[...actual].sort((a,b)=>a.cm-b.cm);
    for(const [index,cm]of [inner,outer].entries()){
      assert.ok(Math.abs(sorted[index].cm-cm)<.01,JSON.stringify(actual));
      assert.ok(Math.abs(Number(sorted[index].text.match(/[\d.]+/)?.[0])-cm/100)<.001);
    }
  };
  await select([325,200]);spanPair(await rows(),285,315);
  await select([450,(.2+1/6)*1000]);spanPair(await rows(),385,415);
  const before=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
  await page.evaluate(()=>window.__hpTest.setTool('resize'));
  const start=await screen([450,(.2+1/6)*1000]),end=await screen([500,(.2+1/6)*1000]);
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:6});
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp="wall-side-dimensions"]')?.dataset.context==='resize');
  const held=await rows();assert.equal(held.length,4,'both faces of the two changing horizontal walls');
  assert.ok(held.every(r=>r.source==='physical'&&r.painted&&(Math.abs(r.cm-345)<.01||Math.abs(r.cm-375)<.01)),JSON.stringify(held));
  assert.equal(held.filter(r=>Math.abs(r.cm-345)<.01).length,2);
  const areas=await page.locator('houseplan-card [data-hp="resize-area-label"]').allTextContents();
  assert.equal(areas.length,1);assert.ok(Math.abs(Number(areas[0].match(/[\d.]+/)?.[0])-13.3)<.06,areas[0]);
  assert.equal(await page.locator('houseplan-card .rszcorner,.rszmeasurehalo,.rszmeasureink').count(),0);
  await page.keyboard.press('Escape');await page.mouse.up();await page.evaluate(()=>window.__hpTest.settled());
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__card._serverCfg)),before,'cancelled Resize does not save geometry');
  assert.equal(await reportPageErrors(),false);
  console.log('PASS: native 285/315 and 385/415cm selection; Resize 345/375cm faces and 13.3m² clear floor; Escape preserves geometry');
} finally {await browser.close();}
