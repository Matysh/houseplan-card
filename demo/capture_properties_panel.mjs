// #931: capture the real product, never substitute the static demonstrator for it.
// Generated output is deliberately separate from the immutable approved pixels.
import { launch, finish, requirePinnedBrowser } from './serve.mjs';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

requirePinnedBrowser();
const reference = 'docs/design/931-properties-panel/approved-2026-10-18';
const out = process.env.HP_PROPERTIES_CAPTURE_DIR || 'output/properties-931/comparison';
mkdirSync(out, { recursive: true });
function verifyReferences() {
  const entries = readFileSync(join(reference,'MANIFEST-SHA256.txt'),'utf8').trim().split(/\r?\n/);
  for (const line of entries) {
    const [,hash,file] = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line) ?? [];
    if (!file || createHash('sha256').update(readFileSync(join(reference,file))).digest('hex') !== hash)
      throw Error(`Immutable reference mismatch: ${file || line}`);
  }
  console.log(`Approved manifest: ${entries.length}/${entries.length}`);
}
verifyReferences();
const { page, browser } = await launch({ width:1920, height:1080 });
const fonts = process.env.HP_QA_SEGOE_DIR || '/mnt/c/Windows/Fonts';
// Installed owner fonts are read only; not copied into the repository or bundle.
for (const file of ['segoeui.ttf','seguisb.ttf','segoeuib.ttf']) readFileSync(join(fonts,file));
await page.route('**/__properties_fonts/*',route=>route.fulfill({contentType:'font/ttf',body:readFileSync(join(fonts,new URL(route.request().url()).pathname.split('/').pop()))}));
const fontCss = `@font-face{font-family:'Segoe UI';src:url('/__properties_fonts/segoeui.ttf');font-weight:400}
@font-face{font-family:'Segoe UI';src:url('/__properties_fonts/seguisb.ttf');font-weight:600}
@font-face{font-family:'Segoe UI';src:url('/__properties_fonts/segoeuib.ttf');font-weight:700}`;
await page.addStyleTag({content:fontCss+`#host{width:100%;margin:0;padding:0}:root{
--primary-color:#078a9e;--primary-text-color:#28343c;--secondary-text-color:#74818a;--card-background-color:#fff;
--ha-card-background:#fff;--divider-color:#e1e6e9;--secondary-background-color:#f1f7f8;--text-primary-color:#fff;
}html,body{background:#fff;color:#28343c}`});
const card=page.locator('houseplan-card'), panel=card.locator('[data-hp="properties-panel"]');
const scenes=[
  ['01-plan-wall','plan','partition','wall'], ['02-plan-opening','plan','opening','door'],
  ['03-devices-light','devices','device','panel-light'], ['04-decor-rectangle','decor','rect','rect'],
  ['05-decor-text','decor','text','text'], ['06-decor-image','decor','image','image'],
  ['07-plan-contour','plan','contour',''], ['08-plan-backdrop','decor','backdrop','properties'],
  ['09-devices-led','devices','led','led'],
];
const measurements=[];
const featureFailures=[];
const referencePage=await page.context().newPage();
await referencePage.setViewportSize({width:1920,height:1080});
await referencePage.route('http://reference.local/**',route=>{
  const file=new URL(route.request().url()).pathname.split('/').pop();
  if(file==='screen.html'||file==='screen.js')return route.fulfill({contentType:file.endsWith('.html')?'text/html':'text/javascript',body:readFileSync(join(reference,file))});
  if(file?.endsWith('.ttf'))return route.fulfill({contentType:'font/ttf',body:readFileSync(join(fonts,file))});
  return route.abort();
});
const variant={ '01-plan-wall':'wall','02-plan-opening':'opening','03-devices-light':'device','04-decor-rectangle':'rectangle',
  '05-decor-text':'text','06-decor-image':'image','07-plan-contour':'contour','08-plan-backdrop':'backdrop','09-devices-led':'led'};
try {
  await page.evaluate(async()=>{
    const c=window.__card;
    await window.__hpTest.waitForWrites();
    window.__addRegistryEntity('sensor.kitchen_temperature','kitchen','22.4','demo',{},
      {friendly_name:'Температура на кухне',unit_of_measurement:'°C',device_class:'temperature'});
    c.setConfig({...c._config,language:'ru'});
    c.hass={...c.hass,themes:{...(c.hass.themes||{}),darkMode:false},states:{...c.hass.states,
      'sensor.kitchen_temperature':{entity_id:'sensor.kitchen_temperature',state:'22.4',attributes:{friendly_name:'Температура на кухне',unit_of_measurement:'°C'}}}};
    const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1350 800"><path fill="#eff3f1" d="M0 0h1350v800H0z"/></svg>');
    const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 230"><path fill="#cfc3aa" d="M0 0h170v230H0z"/><path fill="#e4dacc" stroke="#b7a98b" d="M10 10h150v210H10z"/></svg>');
    const id='5'.repeat(64),raw='/api/houseplan/content/assets/_/'+id+'.svg';
    const asset={asset_id:id,name:'Ковёр.png',mime:'image/svg+xml',width:170,height:230,bytes:150,url:raw,used_by:[]};
    const ws=c.hass.callWS.bind(c.hass);
    c.hass={...c.hass,callWS:async msg=>msg.type==='houseplan/assets/list'?{assets:[asset]}
      :msg.type==='houseplan/content/sign'?{urls:Object.fromEntries(msg.paths.map(p=>[p,p===raw?image:p==='/assets/План этажа.png'?svg:p]))}:ws(msg)};
    const n=cm=>cm/1200;
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.model_version=10;
      cfg.spaces=[{id:'properties',title:'Первый этаж',view_box:[-.1,-.1,1.3,1.1],cell_cm:5,
        plan_url:'/assets/План этажа.png',plan_aspect:1350/800,plan_scale_x:1.125,plan_scale_y:1.125,plan_y:-(1-800/1350)/2,plan_opacity:.8,
        rooms:[{id:'living',name:'Гостиная',poly:[[0,0],[n(700),0],[n(700),n(800)],[0,n(800)]]},
          {id:'kitchen',name:'Кухня',poly:[[n(700),0],[n(1350),0],[n(1350),n(800)],[n(700),n(800)]]}],
        wall_segments:[{id:'contour-top',a:[0,0],b:[n(700),0],cm:12},
          {id:'room-divider',a:[n(700),0],b:[n(700),n(800)],cm:12}],
        walls:[{key:'0.291667,0.000000@0.0000',a:[0,0],b:[n(700),0],cm:12},
          {key:'0.854167,0.000000@0.0000',a:[n(700),0],b:[n(1350),0],cm:12},
          {key:'1.125000,0.333333@1.5706',a:[n(1350),0],b:[n(1350),n(800)],cm:12},
          {key:'0.854167,0.666667@0.0000',a:[n(700),n(800)],b:[n(1350),n(800)],cm:12},
          {key:'0.291667,0.666667@0.0000',a:[0,n(800)],b:[n(700),n(800)],cm:12},
          {key:'0.000000,0.333333@1.5706',a:[0,0],b:[0,n(800)],cm:12},
          {key:'0.583333,0.333333@1.5706',a:[n(700),0],b:[n(700),n(800)],cm:12}],
        partitions:[{id:'wall',a:[n(200),n(350)],b:[n(500),n(350)],cm:12}],
        openings:[{id:'door',type:'door',x:n(700),y:n(300),angle:90,length:n(100),flip_v:true,host:{kind:'wall',id:'room-divider',t:.375}}],
        decor:[{id:'rect',kind:'rect',x:n(200),y:n(150),w:n(300),h:n(150),angle:15,color:'#718B82',opacity:1,fill:true,fill_color:'#C4D5CF',fill_opacity:.65,width_cm:2},
          {id:'text',kind:'text',x:n(575),y:n(662.5),text:'На кухне {sensor.kitchen_temperature}',size_cm:22.5,color:'#526871'},
          {id:'image',kind:'image',x:n(1090),y:n(497.5),w:n(170),h:n(230),angle:-12,asset_id:id,opacity:.8}],
        led_strips:[{id:'led',points:[[n(750),n(170)],[n(1250),n(170)],[n(1250),n(270)]],marker:'led-light',active:true}],
      }];
      cfg.markers=[{id:'panel-light',binding:'virtual',space:'properties',name:'Подсветка кухни',icon:'mdi:lightbulb',size:1,angle:0},
        {id:'led-light',binding:'virtual',space:'properties',name:'Подсветка кухни',icon:'mdi:lightbulb'}];
      return cfg;
    });
    c._commitSpace('properties');
    await window.__hpTest.setLayout(layout=>({...layout,'panel-light':{s:'properties',x:n(1000),y:n(200)}}));
    c._haDecorAssetsApi=1;c._decorAssets=new Map([[id,{...asset,url:image}]]);c._decorAssetCatalog=[asset];
    c._commitSpace('properties');
    await window.__hpTest.setMode('plan');
  });
  for (const [name,mode,kind,id] of scenes) {
    await page.evaluate(async mode=>{await window.__hpTest.setMode(mode);},mode);
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
    await page.evaluate(async({mode,kind,id})=>{
      const c=window.__card;
      // Fixture selection calls the production owner; no values or rendered DOM are substituted.
      if(kind==='backdrop') c._decorTool='backdrop';
      else if(mode==='decor') c._decorTool='select';
      const selected=kind==='contour'?c._curSpaceCfg.wall_segments.find(w=>w.a[1]===0&&w.b[1]===0)?.id:id;
      c._editorRuntime.properties.select(kind,selected,kind==='device'?'virtual':kind==='led'?'led-light':undefined);
      c.requestUpdate();await c.updateComplete;
      c._cancelCameraTransition(false);
      const rect=c.renderRoot.querySelector('.stage').getBoundingClientRect();
      // Same physical-to-screen scale as the approved synthetic scene; only a camera fixture.
      c._view={x:-250,y:-(160-rect.top)/.96,w:rect.width/.96,h:rect.height/.96};
      c.requestUpdate();await c.updateComplete;
    },{mode,kind,id});
    await panel.waitFor();await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    if(kind==='contour'||kind==='backdrop') await panel.locator('.delete').hover();
    else await page.mouse.move(0,0);
    const data=await panel.evaluate(el=>{
      const box=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      return {panel:box(el),groups:[...el.querySelectorAll('.hp-prop-group')].map(e=>({key:e.className,box:box(e)})),
        controls:[...el.querySelectorAll('.hp-prop-control,.hpf-unit,.hpf-colorfield')].map(e=>box(e)),
        featureControls:[...el.querySelectorAll('.features .hp-prop-choice,.features .hp-prop-settings,.features .hp-prop-text,.features .hp-prop-variable')].map(e=>box(e)),
        title:el.querySelector('.hp-prop-title').textContent,groupTitle:box(el.querySelector('.hp-prop-group-title')),overflow:el.scrollWidth>el.clientWidth+1};
    });
    measurements.push({name,...data});
    await referencePage.goto('http://reference.local/screen.html?variant='+variant[name]);
    await referencePage.addStyleTag({content:fontCss});await referencePage.evaluate(()=>document.fonts.ready);
    const referenceControls=await referencePage.locator('.panel .control').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
    const deltas=referenceControls.map((ref,i)=>Object.fromEntries(['x','y','w','h'].map(key=>[key,data.controls[i]?.[key]-ref[key]])));
    measurements.at(-1).controlDeltas=deltas;
    if(deltas.some(delta=>Object.values(delta).some(v=>!Number.isFinite(v)||Math.abs(v)>1)))
      throw Error(`Control geometry differs by more than 1 CSS px: ${name} ${JSON.stringify(deltas)} title ${JSON.stringify(data.groupTitle)} ref ${JSON.stringify(await referencePage.locator('.section-title').first().boundingBox())}`);
    const featureReference=await referencePage.locator('.features .choice,.features .action-button,.features .text-content,.features .variable-button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}));
    const featureDeltas=featureReference.map((ref,i)=>Object.fromEntries(['x','y','w','h'].map(key=>[key,data.featureControls[i]?.[key]-ref[key]])));
    measurements.at(-1).featureDeltas=featureDeltas;
    if(featureDeltas.some(delta=>Object.values(delta).some(v=>!Number.isFinite(v)||Math.abs(v)>1)))
      featureFailures.push({name,featureDeltas});
    if (data.overflow || ['x','y','w','h'].some(key=>Math.abs(data.panel[key]-({x:1560,y:64,w:360,h:1016})[key])>1))
      throw Error(`Panel geometry differs from approved bounds: ${name} ${JSON.stringify(data.panel)}`);
    const heights=name==='01-plan-wall'||name==='04-decor-rectangle'?[200,200,206]:[200,200,206,180];
    if(data.groups.length!==heights.length||data.groups.some((g,i)=>Math.abs(g.box.h-heights[i])>1))
      throw Error(`Group geometry differs from approved bounds: ${name}`);
    await page.screenshot({path:join(out,name+'.png')});
    await panel.screenshot({path:join(out,name+'-panel.png')});
    console.log(name,JSON.stringify({panel:data.panel,groups:data.groups.map(g=>g.box.h),title:data.title,overflow:data.overflow}));
  }
  await page.evaluate(async()=>{await window.__hpTest.setMode('decor');window.__card._editorRuntime.properties.select('text','text');});
  const text=panel.locator('textarea');await text.fill('На кухне ');
  await panel.locator('.hp-prop-variable').click();
  const dialog=card.locator('hp-dialog[data-kind="properties-variable"]');
  await dialog.locator('.hpf-pick').click();
  await dialog.locator('.hpf-cand').filter({hasText:'sensor.kitchen_temperature'}).click();
  await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:join(out,'10-text-variable-dialog.png')});
  // Public dialog surface, not the full-screen hp-dialog host.
  const surface=await dialog.locator('.surface').count()?dialog.locator('.surface'):dialog.locator('[role="dialog"]').first();
  await surface.screenshot({path:join(out,'11-text-variable-dialog-detail.png')});
  const box=await surface.boundingBox();
  measurements.push({name:'variable-dialog',box});
  if(['x','y','width','height'].some(key=>Math.abs(box[key]-({x:680,y:300,width:560,height:448})[key])>1))
    throw Error(`Variable dialog differs from approved bounds: ${JSON.stringify(box)}`);
  writeFileSync(join(out,'measurements.json'),JSON.stringify(measurements,null,2)+'\n');
  const manifest=JSON.parse(readFileSync('dist/houseplan-assets.json','utf8'));
  const hashes=Object.fromEntries(readdirSync(out).filter(file=>file.endsWith('.png')).sort()
    .map(file=>[file,createHash('sha256').update(readFileSync(join(out,file))).digest('hex')]));
  writeFileSync(join(out,'capture.json'),JSON.stringify({schema:1,viewport:{width:1920,height:1080,dpr:1},language:'ru',theme:'light',
    browser:browser.version(),sourceFingerprint:manifest.fingerprint,
    bundleManifestSha256:createHash('sha256').update(readFileSync('dist/houseplan-assets.json')).digest('hex'),
    approvedManifestSha256:createHash('sha256').update(readFileSync(join(reference,'MANIFEST-SHA256.txt'))).digest('hex'),
    screenshots:hashes,commonControlMaximumDelta:Math.max(...measurements.flatMap(m=>m.controlDeltas?.flatMap(d=>Object.values(d).map(Math.abs))??[])),
    featureControlMaximumDelta:Math.max(...measurements.flatMap(m=>m.featureDeltas?.flatMap(d=>Object.values(d).map(Math.abs))??[]))},null,2)+'\n');
  const names=[...scenes.map(s=>s[0]+'-panel'),'11-text-variable-dialog-detail'];
  writeFileSync(join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>#931 screenshot comparison</title><style>body{font:14px Arial;background:#eef2f4}section{display:flex;gap:16px;margin:24px}figure{margin:0}img{display:block;max-width:560px;border:1px solid #d6dfe4}figcaption{padding:8px}</style>'+names.map(name=>'<h2>'+name+'</h2><section><figure><figcaption>Approved reference</figcaption><img src="'+relative(out,reference).split('\\').join('/')+'/'+name+'.png"></figure><figure><figcaption>Actual product</figcaption><img src="'+name+'.png"></figure></section>').join(''));
  verifyReferences();
  if(featureFailures.length)throw Error(`Feature control geometry differs: ${JSON.stringify(featureFailures)}`);
} finally {await finish(browser);}
