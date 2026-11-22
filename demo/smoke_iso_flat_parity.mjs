// #1451 replaces #713's identity floor with the accepted orthographic profile.
// Real controls and DOM matrices prove one camera: saved plan coordinates never
// change, editors/no-borders use Flat, and a late error restores every Flat
// object in its FIRST failed frame, not merely after a compensating update.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, check, finish } from './serve.mjs';
import { fingerprintCorpus, sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { fixtureWallKey } from './fixtures/wall-key.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..',import.meta.url)));
const roundtripOnly = process.argv.includes('--roundtrip-only');
const hiddenOnly = process.argv.includes('--hidden-only');
const screenOnly = process.argv.includes('--screen-only');
const screen90Only = process.argv.includes('--screen-90-only');
// Freeze already built sources/assets in an owned artifact, so another author
// cannot replace a chunk between browser requests. The ordinary freshness
// guard still verifies the complete copied tree; no stale bypass/rebuild.
mkdirSync(join(repoRoot,'output'),{recursive:true});
const pinnedRoot = mkdtempSync(join(repoRoot,'output','1451-native-pinned-'));
for(const name of [...fingerprintCorpus(repoRoot),'demo/srv/demo.html',
  'demo/srv/fixture-state.js','demo/srv/plan-host-fixture.js']) {
  const target = join(pinnedRoot,name);mkdirSync(dirname(target),{recursive:true});
  cpSync(join(repoRoot,name),target);
}
const assets = join(pinnedRoot,'demo/srv/assets');
mkdirSync(assets,{recursive:true});
for(const name of ['icons.js','f1.svg','garden.svg']) {
  const file = join(repoRoot,'demo/srv/assets',name);
  if(existsSync(file)) cpSync(file,join(assets,name));
}
cpSync(join(repoRoot,'dist'),assets,{recursive:true});
const manifest = JSON.parse(readFileSync(join(assets,'houseplan-assets.json'),'utf8'));
assert.equal(sourceFingerprint(pinnedRoot),manifest.fingerprint,'dist must match the frozen source tree');
console.log(JSON.stringify({baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:repoRoot,encoding:'utf8'}).trim(),
  dirtySources:execFileSync('git',['diff','--name-only','HEAD','--','src'],{cwd:repoRoot,encoding:'utf8'}).trim().split('\n').filter(Boolean),
  artifact:pinnedRoot,fingerprint:manifest.fingerprint}));

const start = async () => {
  const args = [{width:1480,height:1080},1,[],{reducedMotion:'reduce'}];
  args.push(join(pinnedRoot,'demo/srv'),pinnedRoot);
  const env = await launch(...args);
  const {page} = env;
  try {
  await page.evaluate(()=>{document.getElementById('host').style.width='1440px';});
  const source = await page.evaluate(()=>structuredClone(window.__card._serverCfg));
  const target = source.spaces.find(space=>space.id==='f1');
  const walls = new Map();
  for(const room of target.rooms) for(let i=0;i<room.poly.length;i++) {
    const key = fixtureWallKey(room.poly[i],room.poly[(i+1)%room.poly.length]);
    walls.set(key,{key,cm:15});
  }
  await page.evaluate(async walls=>{
    await window.__hpTest.setServerConfig(cfg=>{
      const space = cfg.spaces.find(item=>item.id==='f1');
      space.walls = walls;
      space.settings = {...space.settings,show_borders:true,show_names:true};
      space.decor = [
        {id:'native-sofa',kind:'furniture',symbol:'sofa',x:.12,y:.2,w:.16,h:.08,width_cm:1},
        {id:'native-bed',kind:'furniture',symbol:'bed_double',x:.68,y:.53,w:.14,h:.18,width_cm:1},
        {id:'native-desk',kind:'furniture',symbol:'desk',x:.65,y:.2,w:.16,h:.08,width_cm:1},
        {id:'native-chair',kind:'furniture',symbol:'chair',x:.69,y:.31,w:.05,h:.06,width_cm:1},
        {id:'native-table',kind:'furniture',symbol:'coffee_table',x:.31,y:.29,w:.1,h:.06,width_cm:1},
      ];
      cfg.settings = {...cfg.settings,volumetric_view:true};
      return cfg;
    });
    await window.__hpTest.setVolumetricView(true);
  },[...walls.values()]);
  await page.waitForFunction(()=>window.__card.renderRoot.querySelectorAll('[data-hp-furniture-volume] [data-furniture-part]').length>0);
  await settled(page);
  return env;
  } catch(error) { await env.browser.close(); throw error; }
};

const settled = async page => {
  await page.evaluate(async()=>{
    await window.__hpTest.settled();
    const card = window.__card, deadline = performance.now()+7000;
    while(card._modeTransitionBusy || card._floorPreparation?.pending || card._floorPendingMode
      || card._cameraTransition?.active || card._rotationTransition?.active) {
      if(performance.now()>deadline)throw Error('native camera did not settle');
      await new Promise(done=>requestAnimationFrame(done));
    }
    await window.__hpTest.settled();
  });
};
const iso = async(page,on) => { await page.evaluate(value=>window.__hpTest.setVolumetricView(value),on); await settled(page); };
const snapshot = page => page.evaluate(()=>{
  const card = window.__card, root = card.renderRoot;
  const stage = root.querySelector('.stage:not([inert])') || root.querySelector('.stage');
  const svg = stage.querySelector('svg.plan-svg');
  const floor = svg.querySelector(':scope > .iso-floor-scene') ?? svg.querySelector(':scope > g');
  const bounds = svg.getBoundingClientRect(), matrix = floor.getScreenCTM();
  // _view is canonical; quarterturn display-fit may have a different width.
  // The root SVG matrix measures actual scene-units-to-pixels, independently
  // of the card's converter and without counting floor depth compression.
  const sceneMatrix = svg.getScreenCTM();
  const point = new DOMPoint(bounds.left+bounds.width/2,bounds.top+bounds.height/2).matrixTransform(matrix.inverse());
  const local = floor.transform.baseVal.consolidate()?.matrix || new DOMMatrix();
  const camera = card._renderIsoScene?.camera;
  const ids = selector=>[...new Set([...stage.querySelectorAll(selector)].map(node=>node.dataset.id))].sort();
  const anchors = selector=>Object.fromEntries([...stage.querySelectorAll(selector)]
    .filter(node=>node.dataset.id).map(node=>[node.dataset.id,[node.style.left,node.style.top]]));
  const hitPoint = new DOMPoint(320,320).matrixTransform(matrix);
  const stageBounds = stage.getBoundingClientRect();
  const inverseHit = card._screenToVb(hitPoint.x-stageBounds.left-stage.clientLeft,
    hitPoint.y-stageBounds.top-stage.clientTop);
  return {rotation:card._rotation,projection:card._renderProjection,mode:card._mode,
    camera:camera?{yaw:camera.rotDeg,depth:camera.floorScaleY,tilt:camera.tiltDeg}:null,
    worldCenter:[point.x,point.y],view:{...card._view},zoom:card._zoom,
    stageSize:[stage.clientWidth,stage.clientHeight],pixelsPerSceneUnit:Math.hypot(sceneMatrix.a,sceneMatrix.b),
    matrix:[local.a,local.b,local.c,local.d,local.e,local.f],inverseHit,
    volumeIds:ids('[data-hp-furniture-volume]'),flatIds:ids('.dfurn[data-id]'),
    walls:stage.querySelectorAll('.iso-wall-top,.iso-wall-side').length,
    devices:anchors('[data-hp="device"]:not(.iso-tile-shadow)'),labels:anchors('.roomlabel'),
    hasLabFlag:document.documentElement.hasAttribute('data-ui-lab-camera1451'),
    query:location.search,
    stored:{config:structuredClone(card._serverCfg),layout:structuredClone(card._layout)}};
});
const close = (a,b,eps=.02)=>a.length===b.length && a.every((value,index)=>Math.abs(value-b[index])<=eps);
const equal = (a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fit = async page => { await page.locator('[data-hp="zoom-fit"]').first().click(); await settled(page); };
const rotate = async page => { await page.locator('[data-hp="rotate-right"]').first().click(); await settled(page); };
const out = {}, detail = {};

if(!screenOnly) {
  const {page,browser} = await start();
  try {
    const original = await snapshot(page);
    out.nativeEntry = !original.hasLabFlag && !original.query && original.camera?.yaw===35
      && Math.abs(original.camera.depth-Math.sin(40*Math.PI/180))<1e-12 && original.volumeIds.length===5;
    const turns = [];
    const yaw = new Map([[0,35],[45,90],[90,125],[135,180],[180,215],[225,270],[270,305],[315,0]]);
    for(const rotation of hiddenOnly ? [] : [...yaw.keys()]) {
      if((await snapshot(page)).rotation!==rotation)await rotate(page);
      await fit(page);
      const home = await snapshot(page);
      await page.locator('[data-hp="zoom-in"]').first().click(); await settled(page);
      const stage = await page.locator('.stage:not([inert])').first().boundingBox();
      await page.mouse.move(stage.x+24,stage.y+24);await page.mouse.down();
      await page.mouse.move(stage.x+111,stage.y+66,{steps:6});await page.mouse.up();await settled(page);
      const before = await snapshot(page);
      assert.equal(before.rotation,rotation);
      const moved = !close(before.worldCenter,home.worldCenter,1);
      await iso(page,false);const flat = await snapshot(page);
      await iso(page,true);const restored = await snapshot(page);
      await page.evaluate(()=>window.__hpTest.setMode('plan'));await settled(page);
      const editor = await snapshot(page);
      await page.evaluate(()=>window.__hpTest.setMode('view'));await settled(page);
      const back = await snapshot(page);
      const result = {rotation,moved,centrePreserved:[flat,restored,editor,back]
        .every(state=>close(state.worldCenter,before.worldCenter)),
        scalePreserved:[flat,restored,editor,back].every(state=>Math.abs(state.pixelsPerSceneUnit-before.pixelsPerSceneUnit)<.002),
        editorFlat:editor.projection==='flat' && editor.volumeIds.length===0 && editor.flatIds.length===5,
        dataPreserved:equal(before.stored,back.stored),
        hitCorrect:close(before.inverseHit,[320,320]) && close(flat.inverseHit,[320,320]),
        profile:before.camera?.yaw===yaw.get(rotation) && restored.camera?.yaw===yaw.get((Math.round(rotation/90)*90)%360)};
      out['roundtrip'+rotation] = Object.entries(result).filter(([key])=>key!=='rotation').every(([,value])=>value);
      turns.push({...result,centres:[before,flat,restored,editor,back].map(state=>state.worldCenter),
        widths:[before,flat,restored,editor,back].map(state=>state.view.w),
        stageSizes:[before,flat,restored,editor,back].map(state=>state.stageSize),
        scales:[before,flat,restored,editor,back].map(state=>state.pixelsPerSceneUnit)});
    }
    detail.roundtrips = turns;
    if(!roundtripOnly) {
    await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{
      const space = cfg.spaces.find(space=>space.id==='f1');space.settings={...space.settings,show_borders:false};return cfg;
    }));await settled(page);
    const borderless = [];
    for(const rotation of [0,90,180,270]) {
      await iso(page,false);await fit(page);const flat = await snapshot(page);
      await iso(page,true);await fit(page);const hidden = await snapshot(page);
      const valid = hidden.walls===0 && hidden.volumeIds.length===0 && hidden.flatIds.length===5
        && equal(flat.matrix,hidden.matrix) && equal(flat.devices,hidden.devices) && equal(flat.labels,hidden.labels)
        && close(flat.worldCenter,hidden.worldCenter) && close(hidden.inverseHit,[320,320])
        && Math.abs(flat.view.w-hidden.view.w)<.02 && Math.abs(flat.zoom-hidden.zoom)<1e-8;
      out['hiddenBorders'+rotation] = valid;
      borderless.push({rotation,valid,matrix:[flat.matrix,hidden.matrix],views:[flat.view,hidden.view]});
      await rotate(page);
    }
    detail.borderless = borderless;
    }
  } finally { await finish(browser); }
}

if(screenOnly || (!roundtripOnly && !hiddenOnly)) {
  const {page,browser} = await start();
  try {
    await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{
      cfg.settings={...cfg.settings,center_summary:true,summary_panel:{version:1,title:'Synthetic summary',
        show_on_mobile:true,blocks:[{id:'native-screen',title:'State',visible:true,scope:{type:'all'},
          values:[{id:'v',label:'Value',source:{type:'entity',entity_id:'sensor.profile_value'}}]}]}};
      return cfg;
    }));
    await settled(page);
    await page.waitForFunction(()=>window.__card._summary && window.__card._screenReference);
    if(!await page.locator('.summary-overlay:not([inert])').count())
      await page.locator('[data-hp="summary-toggle"]').first().click();
    await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('.summary-overlay:not([inert])'));
    await settled(page);
    const rows=[];
    for(const rotation of screen90Only?[90]:[90,270]) {
      while((await snapshot(page)).rotation!==rotation)await rotate(page);
      await fit(page);
      const offset=await page.evaluate(()=>{
        const c=window.__card,stage=c._stageEl,svg=stage.querySelector('svg.plan-svg');
        const geometry=c._summary.screenGeometry(true),display=c._displayBase(c._baseVb());
        const panel=geometry?.panel;
        if(!panel)return {present:false};
        const free=panel.side==='right'?{w:panel.rect.x,h:stage.clientHeight}
          :{w:stage.clientWidth,h:panel.rect.y};
        const p=new DOMPoint(display.x+display.w/2,display.y+display.h/2).matrixTransform(svg.getScreenCTM());
        const bounds=stage.getBoundingClientRect();
        return {present:true,actual:[p.x-bounds.left-stage.clientLeft,p.y-bounds.top-stage.clientTop],
          expected:[free.w/2,free.h/2]};
      });
      await page.locator('[data-hp="zoom-in"]').first().click();await settled(page);
      const bounds=await page.locator('.stage:not([inert])').first().boundingBox();
      await page.mouse.move(bounds.x+24,bounds.y+24);await page.mouse.down();
      await page.mouse.move(bounds.x+111,bounds.y+66,{steps:6});await page.mouse.up();await settled(page);
      const before=await snapshot(page);
      await iso(page,false);const flat=await snapshot(page);
      await iso(page,true);const back=await snapshot(page);
      const result={rotation,offset,offsetCorrect:offset.present&&close(offset.actual,offset.expected,1),
        centrePreserved:[flat,back].every(state=>close(state.worldCenter,before.worldCenter)),
        scalePreserved:[flat,back].every(state=>Math.abs(state.pixelsPerSceneUnit-before.pixelsPerSceneUnit)<.002),
        centres:[before,flat,back].map(state=>state.worldCenter),
        scales:[before,flat,back].map(state=>state.pixelsPerSceneUnit)};
      out['screenProfile'+rotation]=result.offsetCorrect&&result.centrePreserved&&result.scalePreserved;
      rows.push(result);
    }
    detail.screenProfiles=rows;
  } finally {await finish(browser);}
}

for(const kind of roundtripOnly || hiddenOnly || screenOnly ? [] : ['structure','furniture']) {
  const {page,browser} = await start();
  try {
    const result = await page.evaluate(async kind=>{
      const card = window.__card;
      const read = ()=>({projection:card._renderProjection,
        flat:[...new Set([...card.renderRoot.querySelectorAll('.dfurn[data-id]')].map(node=>node.dataset.id))].sort(),
        walls:card.renderRoot.querySelectorAll('.iso-wall-top,.iso-wall-side').length,
        volumes:card.renderRoot.querySelectorAll('[data-hp-furniture-volume]').length});
      let calls = 0;
      const fail = ()=>{calls++;throw Error('synthetic first-frame fault');};
      if(kind==='structure') {
        const original = card._isoSceneRuntime.resolveIsoFramePresentation;
        card._isoSceneRuntime={...card._isoSceneRuntime,resolveIsoFramePresentation(input){
          if(input.projection==='iso')return fail();return original(input);
        }};
      } else {
        const original = card._decorResolvedStyle.bind(card);
        card._decorResolvedStyle = item=>card._renderProjection==='iso' && item.kind==='furniture' ? fail() : original(item);
      }
      // Capture the first DOM commit before updated() may request any repair.
      const updated = card.updated.bind(card), frames = [];
      card.updated = changed=>{frames.push(read());return updated(changed);};
      let escaped = false;
      card.requestUpdate();try {await card.updateComplete;}catch{escaped=true;}
      const first = frames[0] || null;
      card.requestUpdate();try {await card.updateComplete;}catch{escaped=true;}
      return {escaped,calls,first,next:read()};
    },kind);
    const complete = frame=>frame?.projection==='flat' && frame.flat.length===5 && frame.walls===0 && frame.volumes===0;
    out[kind+'FaultFirstFrame'] = !result.escaped && result.calls===1 && complete(result.first);
    out[kind+'FaultNextUpdate'] = !result.escaped && complete(result.next);
    detail[kind+'Fault'] = result;
  } finally { await finish(browser); }
}
for(const [name,value] of Object.entries(out)) check(name,value,true);
console.log(JSON.stringify({checks:out,detail},null,2));
await finish(null);
