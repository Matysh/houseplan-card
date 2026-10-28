/** #1099: real bundled commit barrier, seven samples per scenario at DPR1/2.
 * The independent host shell replaces only history, storage and gesture UI;
 * preflight, model identity, junction checks and adoption are production code.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {largeFixture} from '../test/helpers/geometry-commit-harness.mjs';
const arg=(key)=>process.argv.find(x=>x.startsWith('--'+key+'='))?.slice(key.length+3);
const root=resolve(arg('root')||process.cwd()),output=resolve(arg('output')||'artifacts/1099/geometry-commit.json');
const {launch,requirePinnedBrowser,reportPageErrors}=await import(pathToFileURL(resolve(root,'demo/serve.mjs')));
requirePinnedBrowser();
const config=largeFixture(),rows=[],browsers=[];
const manifest=JSON.parse(readFileSync(resolve(root,'dist/houseplan-assets.json'),'utf8'));
const editor=manifest.lazyEditorFiles.find(x=>/\/houseplan-editor-runtime-/.test(x));
assert.ok(editor,'bundled runtime is part of the measured source manifest');
for(const dpr of [1,2]){
 const {page,browser}=await launch({width:1440,height:1000},dpr);
 try{
  browsers.push(browser.version());
  const result=await page.evaluate(async({config,editor,dpr})=>{
   const {HouseplanEditorRuntime}=await import('/assets/'+editor),rows=[];
   for(const scenario of ['thickness','merge','split','column'])for(let sample=0;sample<7;sample++){
    const toasts=[],counts={preflight:0,junction:0};
    const host={_serverCfg:structuredClone(config),_space:'f',_path:[],_pendingPhysicalWrites:new Map(),_cfgEpoch:0,_cfgRev:1,
      requestUpdate(){},_t:key=>key,_showToast:m=>toasts.push(m)};
    const runtime=Object.assign(Object.create(HouseplanEditorRuntime.prototype),{host,_junctionBaselineCache:new Map(),
      _clearGeometryGesture(){},_recordGeometry(){},_saveConfig(){}});
    host._checkSpacePhysicalGeometry=(c,id,capture)=>{counts.preflight++;return runtime._checkSpacePhysicalGeometryImpl(c,id,capture);};
    host._junctionLimitViolations=(c,id,g,rooms)=>{if(!g)counts.junction++;return runtime._junctionLimitViolations(c,id,g,rooms);};
    const before=runtime._geometrySnapshot('f'),sp=host._serverCfg.spaces[0];
    if(scenario==='thickness'){for(const w of sp.wall_segments)w.cm=20;for(const w of sp.walls||[])w.cm=20;}
    if(scenario==='merge')sp.rooms.splice(0,2,{id:'merged',poly:[[0,0],[4,0],[4,2],[0,2]]});
    if(scenario==='split')sp.rooms.splice(0,1,{id:'split-a',poly:[[0,0],[1,0],[1,2],[0,2]]},{id:'split-b',poly:[[1,0],[2,0],[2,2],[1,2]]});
    if(scenario==='column')sp.wall_columns=[{id:'col',shape:'square',center:[1,1],cm:20,angle:0}];
    const started=performance.now(),ok=runtime._commitPhysicalGeometry(scenario,before),durationMs=performance.now()-started;
    rows.push({scenario,dpr,sample,durationMs,ok,toasts,unions:counts.preflight+counts.junction,...counts});
   }
   return rows;
  },{config,editor,dpr});
  rows.push(...result);assert.ok(result.every(row=>row.ok),JSON.stringify(result.filter(row=>!row.ok)));
  assert.equal(await reportPageErrors(),false);
 }finally{await browser.close();}
}
const statistics=[];
for(const dpr of [1,2])for(const scenario of ['thickness','merge','split','column']){
 const selected=rows.filter(row=>row.dpr===dpr&&row.scenario===scenario),times=selected.map(row=>row.durationMs).sort((a,b)=>a-b);
 statistics.push({dpr,scenario,n:selected.length,medianMs:times[3],maxMs:times.at(-1),unions:[...new Set(selected.map(row=>row.unions))]});
}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({schema:1,root,fingerprint:manifest.fingerprint,browserVersions:[...new Set(browsers)],node:process.version,benchmarkSha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),fixtureSha256:createHash('sha256').update(JSON.stringify(config)).digest('hex'),fixtureRooms:config.spaces[0].rooms.length,rows,statistics},null,2)+'\n');
console.log(JSON.stringify({output,statistics}));