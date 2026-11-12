// #1381: native input through all four consumers; only fixture/wire setup is synthetic.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,reportPageErrors} from './serve.mjs';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {wallKey} from '../test-build/wall-thickness.js';
const rooms=[{id:'left',name:'Left',area:null,poly:[[.15,.15],[.5,.15],[.5,.65],[.15,.65]]},
  {id:'right',name:'Right',area:null,poly:[[.5,.15],[.85,.15],[.85,.65],[.5,.65]]}];
const walls=new Map();
const fixtureCm=Number(process.env.HP_DIMENSION_FIXTURE_CM||20);
assert.ok(fixtureCm>=1&&fixtureCm<=100);
const diagnosticCount=Number(process.env.HP_DIMENSION_DIAGNOSTIC_PARTITIONS||0);
assert.ok(Number.isInteger(diagnosticCount)&&diagnosticCount>=0&&diagnosticCount<=1000);
const extra=Array.from({length:diagnosticCount},(_,i)=>({id:`remote-${i}`,
  a:[1.5+(i%25)*.1,1.5+Math.floor(i/25)*.1],b:[1.55+(i%25)*.1,1.5+Math.floor(i/25)*.1],cm:20}));
for(const room of rooms)for(let i=0;i<room.poly.length;i++) {
  const a=room.poly[i],b=room.poly[(i+1)%room.poly.length],key=wallKey(a,b,1/240);
  walls.set(key,{key,a,b,cm:fixtureCm});
}
const initial=commitWallSegmentModel({spaces:[{id:'dimensions',title:'Dimensions',cell_cm:5,view_box:[0,0,1,1],rooms,
  walls:[...walls.values()],partitions:[{id:'free',a:[.22,.8],b:[.6,.8],cm:fixtureCm},...extra],openings:[]}],markers:[],
  settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}}).config;
const {page,browser}=await launch({width:1440,height:1050});
const output=`artifacts/1381-native${fixtureCm===20?'':`-cm-${fixtureCm}`}`;mkdirSync(output,{recursive:true});
const writes=[];
let server=structuredClone(initial),revision=1,refuseNext=false;
try {
  await page.exposeFunction('dimensionsWire',message=>{
    if(message.type==='houseplan/config/get')return{config:structuredClone(server),rev:revision,can_write:true,wall_node_move_api:1,plan_graph_api:1};
    if(message.type==='houseplan/layout/get')return{layout:{},rev:1};
    if(message.type==='houseplan/config/set') {
      assert.equal(message.expected_rev,revision);writes.push(structuredClone(message));
      if(refuseNext){refuseNext=false;throw Error('Synthetic write refusal for dimension lifecycle');}
      server=structuredClone(message.config);return{config:structuredClone(server),rev:++revision,ok:true};
    }
    if(/^houseplan\/(?:config|layout)\/(?:set|save|patch)$/.test(message.type)||message.type==='houseplan/wall/node_move') {
      writes.push(message);throw Error(`Unexpected write in cancelled/read-only scenario: ${message.type}`);
    }
    return null;
  });
  await page.evaluate(async()=>{
    const previous=window.__card,hass=window.__mkHass(),old=hass.callWS.bind(hass);
    hass.devices={};hass.entities={};hass.states={};
    hass.callWS=async message=>message.type.endsWith('registry/list')?[]:(await window.dimensionsWire(message))??old(message);
    const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'en'});
    previous.remove();const host=document.getElementById('host');host.style.width='1350px';host.style.maxWidth='none';
    host.append(card);window.__card=card;card.hass=hass;
  });
  await page.waitForFunction(()=>window.__card?._booting===false&&window.__card._space==='dimensions');
  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&window.__card.renderRoot.querySelector('.hp-node-handle'));
  // Camera fixture only: initialize a square-unit viewport that contains all
  // test objects, before any action under test. Pan/zoom assertions use UI.
  await page.evaluate(async()=>{
    const card=window.__card,[w,h]=card._lastValidStageSize;
    const vb=card._baseVb();card._zoom=Math.max(vb[3],vb[2]*h/w)/1000;
    card._view={x:(1000-1000*w/h)/2,y:0,w:1000*w/h,h:1000};card.requestUpdate();await card.updateComplete;
  });
  const settle=()=>page.evaluate(async()=>{await window.__card.updateComplete;
    await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));await window.__card.updateComplete;});
  const screen=point=>page.evaluate(p=>{
    const svg=window.__card.renderRoot.querySelector('svg.plan-svg'),frame=svg.querySelector('[data-hp-plan-rotation-frame]')||svg;
    const out=new DOMPoint(p[0]*1000,p[1]*1000).matrixTransform(frame.getScreenCTM());return{x:out.x,y:out.y};
  },point);
  const dimensions=()=>page.evaluate(()=>({
    context:window.__card.renderRoot.querySelector('[data-hp=wall-side-dimensions]')?.dataset.context,
    rows:[...window.__card.renderRoot.querySelectorAll('[data-hp=wall-side-dimension]')].map(row=>({
      id:row.dataset.interval,carrier:row.dataset.carrier,source:row.dataset.source,side:Number(row.dataset.side),
      cm:Number(row.dataset.lengthCm),from:JSON.parse(row.dataset.from),to:JSON.parse(row.dataset.to),
      text:row.querySelector('text').textContent,
    })),builds:window.__card._editorRuntime.wallDimensions.geometry.builds,
    retired:window.__card.renderRoot.querySelectorAll('.rszmeasurehalo,.rszmeasureink,[data-hp=resize-length-label]').length,
    areas:window.__card.renderRoot.querySelectorAll('[data-hp=resize-area-label]').length,
  }));
  const click=async point=>{const p=await screen(point);await page.mouse.click(p.x,p.y);await settle();};
  const report={diagnostic:{remotePartitions:diagnosticCount,timings:[]}};
  await click([.4,.8]);
  await page.waitForFunction(()=>window.__card.renderRoot.querySelectorAll('[data-hp=wall-side-dimension]').length===2);
  const selected=await dimensions();
  assert.equal(selected.context,'selection');assert.ok(selected.rows.every(row=>row.source==='physical'&&Math.abs(row.cm-456)<1e-6));
  assert.equal(new Set(selected.rows.map(row=>row.side)).size,2);
  assert.ok(selected.rows.every(row=>/^4\.560 m$/.test(row.text)));
  const configBefore=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
  report.selection=selected;await page.screenshot({path:`${output}/selection.png`});
  const initialHistory=await page.evaluate(()=>window.__card._geometryHistory.size);
  for(const language of ['ru','de','fr','en']) {
    await page.evaluate(language=>{const c=window.__card;c.setConfig({...c._config,language});},language);await settle();
    assert.equal((await dimensions()).rows.length,2);
    const hint=await page.locator('houseplan-card [data-hp="properties-panel"]').innerText();
    assert.ok(!/wall_dimensions_hint|wall_dimensions_axis_hint/.test(hint));
    await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,config:{...c.hass.config,unit_system:{...c.hass.config?.unit_system,length:'mi'}}};});await settle();
    assert.ok((await dimensions()).rows.every(row=>/′.*″/.test(row.text)&&row.cm===456));
    await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,config:{...c.hass.config,unit_system:{...c.hass.config.unit_system,length:'km'}}};});await settle();
    assert.ok((await dimensions()).rows.every(row=>row.text==='4.560 m'));
    assert.equal(await page.locator('houseplan-card [data-hp="properties-panel"]').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'translated hint does not create horizontal overflow');
  }
  await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,'sensor.unrelated':{state:'on',attributes:{}}}};});
  await settle();
  const beforeZoom=await page.evaluate(()=>window.__card._view.w);
  const zoomAnchor=await screen([.4,.75]);await page.mouse.move(zoomAnchor.x,zoomAnchor.y);await page.mouse.wheel(0,-120);
  await page.waitForFunction(before=>window.__card._view.w<before&&!window.__card._cameraTransition.active,beforeZoom);await settle();
  assert.equal((await dimensions()).builds,selected.builds,'camera, theme/language and unrelated HA state do not rebuild physical faces');
  assert.ok((await dimensions()).rows.every(row=>row.cm===456));
  await page.mouse.wheel(0,120);
  await page.waitForFunction(before=>Math.abs(window.__card._view.w-before)<1e-5&&!window.__card._cameraTransition.active,beforeZoom);await settle();
  assert.equal(await page.evaluate(()=>window.__card._geometryHistory.size),initialHistory);
  assert.equal(writes.length,0);

  const bodyStart=await screen([.4,.8]),bodyEnd=await screen([.4,.84]);
  await page.mouse.move(bodyStart.x,bodyStart.y);await page.mouse.down();await page.mouse.move(bodyEnd.x,bodyEnd.y,{steps:5});
  await page.waitForFunction(()=>window.__card._editorRuntime.physicalGesture.active);await settle();
  assert.equal((await dimensions()).rows.length,0,'the selected wall dimensions are hidden during a body drag');
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
  assert.equal((await dimensions()).context,'selection');
  assert.ok((await dimensions()).rows.every(row=>Math.abs(row.cm-456)<1e-6));
  assert.equal(writes.length,0,'cancelled body drag adds no dimension write');
  const joint=await screen([.5,.15]),jointEnd=await screen([.525,.15]);
  await page.mouse.move(joint.x,joint.y);await page.mouse.down();
  assert.equal(await page.evaluate(()=>window.__card._editorRuntime.nodeMove.dragging),true,'native connected node captured');
  await page.mouse.move(jointEnd.x,jointEnd.y,{steps:5});await settle();
  const connected=await dimensions();assert.equal(connected.context,'node');
  assert.ok(connected.rows.length>=4&&connected.rows.every(row=>row.source==='physical'));
  report.connectedNode=connected;
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
  assert.equal(writes.length,0);
  const start=await screen([.22,.8]),target=await screen([.3,.85]);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  const nodeBegin=performance.now();await page.mouse.move(target.x,target.y,{steps:6});await settle();
  report.diagnostic.timings.push({gesture:'six node-move frames',ms:performance.now()-nodeBegin});
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp=wall-side-dimensions]')?.dataset.context==='node');
  const node=await dimensions();assert.equal(node.rows.length,2);assert.ok(node.rows.every(row=>row.source==='physical'&&row.cm<456));
  report.node=node;await page.screenshot({path:`${output}/node.png`});
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
  await page.waitForFunction(()=>!window.__card._editorRuntime.nodeMove.dragging
    &&window.__card.renderRoot.querySelector('[data-hp=wall-side-dimensions]')?.dataset.context!=='node');
  const restored=await dimensions();
  const retained=await page.evaluate(()=>!!window.__card._editorRuntime.properties.dimensionTarget);
  assert.equal(retained,true,'Escape cancels the active node gesture before deselecting its wall');
  assert.equal(restored.context,'selection');assert.ok(restored.rows.every(row=>Math.abs(row.cm-456)<1e-6));

  await page.evaluate(()=>window.__hpTest.setTool('resize'));await settle();
  const resizeStart=await screen([.5,.4]),resizeEnd=await screen([.55,.4]);
  await page.mouse.move(resizeStart.x,resizeStart.y);await page.mouse.down();await page.mouse.move(resizeEnd.x,resizeEnd.y,{steps:5});
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp=wall-side-dimensions]')?.dataset.context==='resize');
  const resize=await dimensions();assert.equal(resize.retired,0);assert.equal(resize.areas,2);
  assert.equal(resize.rows.length,8,'four changed bounded side walls, both physical sides');
  assert.equal(new Set(resize.rows.map(row=>row.carrier)).size,4);
  assert.ok(resize.rows.every(row=>row.source==='physical'));
  const collisions=await page.evaluate(()=>{
    const root=window.__card.renderRoot,visible=el=>{
      for(let p=el;p instanceof Element;p=p.parentElement) {
        const s=getComputedStyle(p);if(s.visibility==='hidden'||s.display==='none'||Number(s.opacity)===0)return false;
      }
      return true;
    };
    const labels=[...root.querySelectorAll('[data-hp="wall-side-dimension"] rect')].filter(visible);
    const glyphs=[...root.querySelectorAll('.rszicon .rszink')].filter(visible);
    return labels.flatMap(label=>{const a=label.getBoundingClientRect();return glyphs.flatMap(glyph=>{
      const b=glyph.getBoundingClientRect();
      return a.left<b.right+1&&b.left-1<a.right&&a.top<b.bottom+1&&b.top-1<a.bottom
        ? [{label:label.parentElement.querySelector('text').textContent,glyph:glyph.parentElement.getAttribute('transform')}]:[];
    });});
  });
  assert.deepEqual(collisions,[],'dimension labels never cover visible Resize arrows, including 1cm walls');
  report.resize=resize;await page.screenshot({path:`${output}/resize.png`});
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
  assert.equal((await dimensions()).rows.length,0);
  assert.equal(writes.length,0);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__card._serverCfg)),configBefore);

  await page.evaluate(()=>window.__hpTest.setTool('draw'));await settle();
  await click([.1,.75]);
  const end=await screen([.1,.9]),drawBegin=performance.now();await page.mouse.move(end.x,end.y,{steps:4});await settle();
  report.diagnostic.timings.push({gesture:'four draw frames',ms:performance.now()-drawBegin});
  const draw=await dimensions();assert.equal(draw.context,'draw');assert.equal(draw.rows.length,2);
  assert.ok(draw.rows.every(row=>row.source==='physical'));
  report.draw=draw;await page.screenshot({path:`${output}/draw.png`});
  await click([.1,.9]);const turn=await screen([.2,.9]);await page.mouse.move(turn.x,turn.y,{steps:4});await settle();
  const chain=await dimensions();assert.equal(chain.rows.length,4,'one new segment and the already confirmed joined segment, without replaying the saved path');
  assert.equal(new Set(chain.rows.map(row=>row.carrier)).size,2);
  report.chain=chain;await page.screenshot({path:`${output}/chain.png`});
  // Rotate the actual rubber band through acute/diagonal corners. Each
  // physical support must lie on current native paint, not yesterday's path.
  const checkPaintedSupports=async()=>page.evaluate(()=>{
    const c=window.__card,paths=[...c.renderRoot.querySelectorAll('.drawwall-preview-fill')]
      .filter(el=>getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none');
    const edges=[];
    for(const path of paths) {
      const tokens=(path.getAttribute('d')||'').match(/[MLZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[];
      let first,last;
      for(let i=0;i<tokens.length;) {
        const command=tokens[i++].toUpperCase();
        if(command==='M'||command==='L') {const p=[Number(tokens[i++]),Number(tokens[i++])];if(command==='M')first=p;else if(last)edges.push([last,p]);last=p;}
        else if(command==='Z'&&first&&last){edges.push([last,first]);last=null;}
      }
    }
    const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
    return [...c.renderRoot.querySelectorAll('[data-hp="wall-side-dimension"][data-source="physical"]')]
      .flatMap(el=>[JSON.parse(el.dataset.from),JSON.parse(el.dataset.to)])
      .map(p=>({p,distance:Math.min(...edges.map(([a,b])=>distance(p,a,b)))}));
  });
  for(const point of [[.18,.86],[.14,.81],[.2,.9]]) {
    const p=await screen(point);await page.mouse.move(p.x,p.y,{steps:4});await settle();
    const supports=await checkPaintedSupports();assert.ok(supports.length>=4);
    assert.ok(supports.every(s=>s.distance<1e-5),JSON.stringify(supports));
  }
  await page.keyboard.press('Escape');await settle();
  // A chain may require an ordinary second Escape to leave the whole draft.
  await page.keyboard.press('Escape');await settle();
  assert.equal((await dimensions()).rows.length,0);
  await page.waitForFunction(()=>window.__card._cfgRev===2);
  assert.equal(writes.length,1,'Escape discards the rubber band, not the already confirmed wall');
  const originalIds=new Set(initial.spaces[0].partitions.map(w=>w.id));
  const added=server.spaces[0].partitions.filter(w=>!originalIds.has(w.id));assert.equal(added.length,1);
  assert.ok(Math.abs(Math.hypot(added[0].b[0]-added[0].a[0],added[0].b[1]-added[0].a[1])*1200-draw.rows[0].cm)<1e-6);

  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy);await settle();await click([.4,.8]);
  const historyBeforeBody=await page.evaluate(()=>window.__card._geometryHistory.size);
  const dragBody=async target=>{
    const from=server.spaces[0].partitions.find(w=>w.id==='free'),middle=[(from.a[0]+from.b[0])/2,(from.a[1]+from.b[1])/2];
    const a=await screen(middle),b=await screen(target);
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await settle();
    assert.equal(await page.evaluate(()=>window.__card._editorRuntime.physicalGesture.active),true);
    assert.equal((await dimensions()).rows.length,0);await page.mouse.up();
  };
  await dragBody([.41,.84]);
  await page.waitForFunction(()=>window.__card._cfgRev===3&&!window.__card._writesPending);await settle();
  assert.equal(await page.evaluate(()=>window.__card._geometryHistory.size),historyBeforeBody+1,'body move is still exactly one command');
  const moved=server.spaces[0].partitions.find(w=>w.id==='free');assert.ok(moved.a[1]>.8);
  await click([.41,moved.a[1]]);const afterBody=await dimensions();
  assert.equal(afterBody.context,'selection');
  assert.ok(afterBody.rows.every(row=>Math.abs(row.cm-456)<1e-6&&Math.abs(row.from[1]-800)>10));
  report.afterBodyCommit=afterBody;
  const movedBaseline=JSON.stringify(moved);
  refuseNext=true;await dragBody([.41,.88]);
  await page.waitForFunction(()=>!window.__card._writesPending&&!window.__card._saveConfigDebounced.pending());await settle();
  assert.equal(writes.length,3,'one confirmed draw, one accepted body move, one refused body move');
  assert.equal(JSON.stringify(server.spaces[0].partitions.find(w=>w.id==='free')),movedBaseline);
  await click([.41,moved.a[1]]);const afterRefusal=await dimensions();
  assert.equal(afterRefusal.context,'selection');
  assert.deepEqual(afterRefusal.rows.map(row=>[row.cm,row.from,row.to]),afterBody.rows.map(row=>[row.cm,row.from,row.to]),'refusal restores current saved supports, not the refused preview');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>window.__card._cfgRev===4&&!window.__card._writesPending);await settle();
  assert.equal(server.spaces[0].partitions.find(w=>w.id==='free').a[1],.8,'Undo restores the previous body position');
  await click([.4,.8]);assert.ok((await dimensions()).rows.every(row=>row.cm===456));
  const writesBeforeZero=writes.length;
  await page.evaluate(()=>window.__hpTest.setTool('draw'));await settle();
  const thickness=page.locator('houseplan-card .editor-secondary.kind-tool .drawwall input');
  await thickness.fill('0');await thickness.press('Tab');
  await page.waitForFunction(()=>window.__card._drawWallCm===0);
  await click([.1,.6]);const zeroEnd=await screen([.1,.7]);await page.mouse.move(zeroEnd.x,zeroEnd.y,{steps:4});
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-hp="properties-panel"]')?.textContent.includes('Some sections show their axis length.'));
  const zero=await dimensions();assert.equal(zero.rows.length,2);assert.ok(zero.rows.every(row=>row.source==='axis'));
  report.zeroAxis=zero;
  await page.keyboard.press('Escape');await settle();
  assert.equal((await dimensions()).rows.length,0);
  assert.equal(await page.locator('houseplan-card [data-hp="properties-panel"]').evaluate(el=>el.textContent.includes('Some sections show their axis length.')),false);
  assert.equal(writes.length,writesBeforeZero,'basis explanation adds neither a confirmed zero wall nor a config write');
  assert.equal(await reportPageErrors(),false);
  writeFileSync(`${output}/report.json`,JSON.stringify(report,null,2)+'\n');
  console.log('PASS #1381 native selection/connected-node/resize-both-rooms/draw/chain; cancelled/read-only frames write nothing; body commit/refusal/Undo retain current supports');
}catch(error){await page.screenshot({path:`${output}/failure.png`});throw error;}finally{await browser.close();}
