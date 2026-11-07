import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import fs from 'node:fs';import{pathToFileURL}from'node:url';
const root=process.argv[2],out=process.argv[3],label=process.argv[4]||'baseline';
if(!root||!out)throw Error('Usage: node view-layers.mjs CHECKOUT OUTPUT LABEL [--reader]');fs.mkdirSync(out,{recursive:true});
const{launch}=await import(pathToFileURL(root+'/demo/serve.mjs'));
const{makeLargeHouseFixture}=await import(pathToFileURL(root+'/demo/fixtures/large-house.mjs'));
const{page,browser}=await launch({width:1280,height:800},2,[],{},root+'/demo/srv',root);
await page.emulateMedia({reducedMotion:'no-preference'});const cdp=await page.context().newCDPSession(page);
const rows=[];
try{for(const[name,fixture]of[['large',makeLargeHouseFixture()]]){
 if(fixture) fixture.__reader=process.argv.includes('--reader');
 if(fixture)await page.evaluate(async f=>{const old=window.__card,host=old.parentElement;const c=document.createElement('houseplan-card');
 c.setConfig({type:'custom:houseplan-card',title:'Mode transition diagnostic',icon_size:3.4});
 const connection={subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}};
 c.hass={language:'en',locale:{language:'en'},user:{id:'perf',name:'Synthetic',is_admin:true},devices:f.devices,entities:f.entities,areas:f.areas,states:f.states,
 connection,config:{unit_system:{length:'km'}},localize:()=>null,formatEntityState:s=>s.state,callService:async()=>{},
 callWS:async m=>{if(m.type==='houseplan/config/get')return{config:structuredClone(f.config),rev:1,can_write:!f.__reader};if(m.type==='houseplan/layout/get')return{layout:structuredClone(f.layout),rev:1};
 if(m.type==='config/device_registry/list')return Object.values(f.devices);if(m.type==='config/entity_registry/list')return Object.values(f.entities);
 if(m.type==='config_entries/get')return[{entry_id:'perf_entry',domain:'houseplan_perf',title:'Synthetic'}];if(m.type==='manifest/list')return[{domain:'houseplan_perf',name:'Synthetic'}];return{ok:true}}};
 host.replaceChildren(c);window.__card=c;if(!f.__reader)await c._ensureEditorRuntime();const start=performance.now();while(!c._loadOk||c._booting||c._bootSoft){if(performance.now()-start>15000)throw Error('Fixture did not settle');await new Promise(r=>setTimeout(r,20));}await c.updateComplete;},fixture);
 await page.evaluate(async()=>{const c=window.__card;c._setMode('view',false);await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});

 let latest=[];cdp.on('LayerTree.layerTreeDidChange',e=>{latest=e.layers??[]});await cdp.send('LayerTree.enable');
 await cdp.send('Tracing.start',{categories:'-*,disabled-by-default-memory-infra,blink.user_timing',transferMode:'ReturnAsStream'});
 const take=async phase=>{await page.waitForTimeout(100);await page.evaluate(p=>performance.mark('hp-memory:'+p+':before'),phase);const dump=await cdp.send('Tracing.requestMemoryDump',{deterministic:true,levelOfDetail:'detailed'});await page.evaluate(p=>performance.mark('hp-memory:'+p+':after'),phase);const dom=await page.evaluate(()=>{const c=window.__card;return {mode:c._mode,runtimeInstalled:!!c._editorRuntime,canEdit:c._canEdit,kiosk:c._kiosk,sceneSvgs:c.renderRoot.querySelectorAll('[data-hp-live-viewbox="floor"]').length,promoted:[...c.renderRoot.querySelectorAll('*')].filter(n=>n.style?.willChange?.includes('transform')).map(n=>({name:n.localName,role:n.getAttribute('data-hp-mode-layer')||n.getAttribute('data-hp-live-scene')||n.classList[0]}))}});return {phase,dump,dom,layers:latest,contentLayerCount:latest.length?latest.filter(l=>l.drawsContent).length:null,boundsRGBABytesAtDpr2:latest.length?latest.filter(l=>l.drawsContent).reduce((s,l)=>s+l.width*l.height*4*4,0):null}};
 const snapshots=[await take('rest')];
 await page.evaluate(()=>{const c=window.__card,stage=c._stageEl;let sign=1;window.__wheelProbe=setInterval(()=>{const r=stage.getBoundingClientRect();stage.dispatchEvent(new WheelEvent('wheel',{deltaY:sign*5,clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true}));sign=-sign},40)});
 snapshots.push(await take('wheel-active'));await page.evaluate(()=>clearInterval(window.__wheelProbe));await page.waitForTimeout(500);snapshots.push(await take('rest-after'));
 const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const{stream}=await done;const chunks=[];for(;;){const q=await cdp.send('IO.read',{handle:stream});chunks.push(Buffer.from(q.data,q.base64Encoded?'base64':'utf8'));if(q.eof)break;}await cdp.send('IO.close',{handle:stream});
 const traces=JSON.parse(Buffer.concat(chunks));fs.writeFileSync(out+'/'+label+'-memory-trace.json',JSON.stringify(traces));
 const memory=traces.traceEvents.filter(e=>e.name==='periodic_interval');
 const phaseLinks=snapshots.map(s=>{const start=traces.traceEvents.find(e=>e.name==='hp-memory:'+s.phase+':before')?.ts,end=traces.traceEvents.find(e=>e.name==='hp-memory:'+s.phase+':after')?.ts;return {phase:s.phase,start,end,traceDumpIds:[...new Set(memory.filter(e=>e.ts>=start&&e.ts<=end).map(e=>e.id))]}});
 const processNames=traces.traceEvents.filter(e=>e.name==='process_name').map(e=>({pid:e.pid,name:e.args?.name}));
 fs.writeFileSync(out+'/'+label+'.json',JSON.stringify({root,sourceSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingDiffSha256:createHash('sha256').update(execFileSync('git',['diff','HEAD'],{cwd:root})).digest('hex'),buildFingerprint:JSON.parse(fs.readFileSync(root+'/dist/houseplan-assets.json')).fingerprint,viewport:{width:1280,height:800,dpr:2},chromium:await browser.version(),method:'LayerTree snapshots plus detailed Chromium memory dumps. boundsRGBABytesAtDpr2 is a geometric RGBA estimate, not GPU allocation. Raw memory-infra dump preserves actual allocator fields; missing GPU accounting is not zero.',snapshots,phaseLinks,processNames,memory},null,2));console.log(snapshots.map(s=>({phase:s.phase,contentLayers:s.contentLayerCount,promoted:s.dom.promoted,svgs:s.dom.sceneSvgs,boundsRGBA:s.boundsRGBABytesAtDpr2,dump:s.dump})));
 }}finally{await browser.close()}
