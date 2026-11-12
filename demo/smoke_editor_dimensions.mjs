// #1398: real native selection/drag/camera/line gestures; no simulated renderer.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,reportPageErrors} from './serve.mjs';
import {currentGraphFixture} from './helpers/graph-fixture.mjs';
import {wallKey} from '../test-build/wall-thickness.js';
const output='artifacts/editor-dimensions';mkdirSync(output,{recursive:true});
const {page,browser}=await launch({width:1440,height:1050});
try {
  await page.exposeFunction('dimensionSeed',config=>{
    config.model_version=10;
    for(const floor of config.spaces)delete floor.plan_graph;
    const floor=config.spaces.find(s=>s.id==='f1');
    const poly=[[.15,.15],[.65,.15],[.65,.65],[.15,.65]];
    Object.assign(floor,{cell_cm:5,view_box:[0,0,1,1],rooms:[{id:'room',name:'Room',poly}],
      walls:poly.map((a,i)=>{const b=poly[(i+1)%4];return{a,b,key:wallKey(a,b,1/240),cm:20};}),
      openings:[{id:'dimension-door',type:'door',x:.3,y:.15,length:.075,angle:0}],partitions:[],decor:[]});
    delete floor.wall_segments;delete floor.open_spans;
    delete floor.plan_url;delete floor.plan_asset_id;
    return currentGraphFixture(config);
  });
  await page.evaluate(async()=>{
    const host=document.getElementById('host');host.style.width='1350px';host.style.maxWidth='none';
    await window.__hpTest.setServerConfig(await window.dimensionSeed(structuredClone(window.__card._serverCfg)));
    await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');
  });
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&window.__card._editorRuntime);
  const settle=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.evaluate(async()=>{const c=window.__card,[w,h]=c._lastValidStageSize;c._view={x:(1000-1000*w/h)/2,y:0,w:1000*w/h,h:1000};c.requestUpdate();await c.updateComplete;});
  const screen=point=>page.evaluate(p=>{const svg=window.__card.renderRoot.querySelector('svg.plan-svg');
    const frame=svg.querySelector('[data-hp-plan-rotation-frame]')||svg;
    const q=new DOMPoint(...p).matrixTransform(frame.getScreenCTM());return{x:q.x,y:q.y};},point);
  const rows=()=>page.evaluate(()=>[...window.__card.renderRoot.querySelectorAll('[data-hp="wall-side-dimension"]')]
    .map(g=>({role:g.dataset.role,cm:+g.dataset.lengthCm,from:JSON.parse(g.dataset.from),to:JSON.parse(g.dataset.to),
      text:g.querySelector('text').textContent,normal:g.querySelector('[data-hp="dimension-witnesses"] line')?.outerHTML,
      height:g.querySelector('rect').getBoundingClientRect().height})));
  const cameraCheck=()=>page.evaluate(()=>{
    const c=window.__card,svg=c.renderRoot.querySelector('svg.plan-svg'),frame=svg.querySelector('[data-hp-plan-rotation-frame]')||svg;
    return [...c.renderRoot.querySelectorAll('[data-hp="wall-side-dimension"]')].every(g=>{
      const p=JSON.parse(g.dataset.from),expected=new DOMPoint(...p).matrixTransform(frame.getScreenCTM());
      const line=g.querySelector('[data-hp="dimension-witnesses"] line');
      const actual=new DOMPoint(+line.getAttribute('x1'),+line.getAttribute('y1')).matrixTransform(line.getScreenCTM());
      return Math.hypot(actual.x-expected.x,actual.y-expected.y)<1&&Math.abs(g.querySelector('rect').getBoundingClientRect().height-16)<.1;
    });
  });
  const capture=async name=>{await settle();await page.screenshot({path:`${output}/${name}.png`});};
  const p=await screen([300,150]);await page.mouse.click(p.x,p.y);await settle();
  let before=await rows();assert.equal(before.length,1);assert.equal(before[0].role,'opening-gap');
  assert.equal(before[0].text,'1.250 m');await capture('opening-selected');
  const gap=page.locator('houseplan-card [data-property="gap"] input');
  await gap.fill('500');await settle();assert.equal((await rows())[0].cm,before[0].cm,'unfinished input must not move the dimension');
  await gap.press('Escape');await settle();assert.equal((await rows())[0].cm,before[0].cm);
  for(const cm of [250,0]) {
    await gap.fill(String(cm));await gap.press('Enter');
    await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
    assert.ok(Math.abs((await rows())[0].cm-cm)<1e-6);
    await capture(`opening-gap-${cm}`);
    await page.locator('houseplan-card [data-action="geometry-undo"]').click();
    await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
    assert.ok(Math.abs((await rows())[0].cm-before[0].cm)<1e-6);
  }
  const geometryBefore=await page.evaluate(()=>JSON.stringify(window.__card._curSpaceCfg));
  // Drag through the midpoint: reference/normal/row must not switch ends.
  await page.mouse.move(p.x,p.y);await page.mouse.down();
  for(const x of [325,350,400,450]) {
    const q=await screen([x,150]);await page.mouse.move(q.x,q.y);await settle();
    const held=await rows();assert.equal(held.length,1);assert.ok(held[0].to.every((n,i)=>Math.abs(n-before[0].to[i])<1e-7));
    assert.equal(JSON.stringify(await page.evaluate(()=>window.__card._curSpaceCfg)),geometryBefore);
  }
  await capture('opening-drag-held');await page.keyboard.press('Escape');await page.mouse.up();await settle();
  assert.equal((await rows())[0].cm,before[0].cm);
  const pan=await screen([800,750]);await page.mouse.move(pan.x,pan.y);await page.mouse.down();
  for(let i=1;i<=5;i++){await page.mouse.move(pan.x+i*10,pan.y+i*6);await settle();assert.ok(await cameraCheck());}
  await capture('opening-pan-held');await page.mouse.up();
  await page.mouse.wheel(0,-120);await settle();assert.ok(await cameraCheck());await capture('opening-zoom');
  await page.waitForFunction(()=>!window.__card._cameraTransition?.active);assert.ok(await cameraCheck());
  await page.evaluate(()=>window.__card._activateOpeningPlacement('window'));
  // After zoom the top wall may be above the visible stage. Use the bottom
  // physical wall, not a point which can land in the toolbar mid-animation.
  const hover=await screen([450,650]);await page.mouse.move(hover.x,hover.y);await settle();
  assert.equal((await rows()).length,2);await capture('opening-placement');
  assert.equal(await page.locator('houseplan-card .opshoulder,houseplan-card .opening-dimension').count(),0);
  await page.keyboard.press('Escape');
  await page.evaluate(async()=>{await window.__hpTest.setMode('decor');window.__card._editorRuntime._activateDecorTool('line');});await settle();
  const a=await screen([250,300]),b=await screen([550,450]);await page.mouse.click(a.x,a.y);await page.mouse.move(b.x,b.y);await settle();
  let line=await rows();assert.equal(line.length,1);assert.equal(line[0].role,'decor-line');
  const angle=await page.locator('houseplan-card .dmeasure').innerText();assert.match(angle,/°/);assert.ok(!angle.includes('m'));
  assert.ok(Math.abs(line[0].cm-Math.hypot(300,150)*1.2)<6);await capture('decor-line');
  await page.keyboard.down('Shift');await settle();line=await rows();assert.equal(line.length,1);
  assert.match(await page.locator('houseplan-card .dmeasure').innerText(),/45°/);
  await capture('decor-line-shift');await page.keyboard.up('Shift');await page.keyboard.press('Escape');await settle();
  assert.equal((await rows()).length,0);
  assert.equal(await reportPageErrors(),false);
  writeFileSync(`${output}/result.json`,JSON.stringify({selected:before,angle,passed:true},null,2));
  console.log('editor dimensions native gestures: PASS');
} finally {await browser.close();}
