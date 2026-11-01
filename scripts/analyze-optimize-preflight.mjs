/** #1172: explicit diagnostic research, never a task/release budget gate. */
import fs from 'node:fs';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {gzipSync} from 'node:zlib';
import {patchImports} from './fix-test-build.mjs';
import {isMainModule} from './spawn-portable.mjs';
const self=fileURLToPath(import.meta.url), hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>{fs.mkdirSync(dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');};
const deps=['typescript','polyclip-ts','bignumber.js','splaytree-ts','lit'];
const git=(repo,...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]).sort();}
const treeHash=root=>hash(files(root).map(p=>relative(root,p)+'\0'+hash(fs.readFileSync(p))).join('\n'));
export function summary(values){
 if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error('Incomplete/nonfinite latency series');
 const a=[...values].sort((x,y)=>x-y),q=p=>a[Math.min(a.length-1,Math.ceil(a.length*p)-1)];
 return {min:a[0],median:q(.5),p95:q(.95),max:a.at(-1)};
}
export function budgetResult(direct,full){
 const baseline=summary(direct),candidate=summary(full),relativeLimitP95Ms=baseline.p95*1.2+15;
 return {baseline,candidate,absoluteP95Ms:250,relativeLimitP95Ms,absolutePass:candidate.p95<=250,
  relativePass:candidate.p95<=relativeLimitP95Ms,pass:candidate.p95<=250&&candidate.p95<=relativeLimitP95Ms};
}
export function assertGeometry(geometry,name){
 if(!geometry||['degraded-extra','failed-core'].includes(geometry.status))throw Error(`Unsuccessful production geometry: ${name}`);
}
export function assertPreflight(result,count){
 if(!Number.isInteger(count)||count<1||result?.ok!==true||!Array.isArray(result.spaces)||result.spaces.length!==count||result.spaces.some(s=>s.status!=='ok'))throw Error('Unsuccessful or incomplete full preflight');
}
function environment(){return {node:process.version,platform:process.platform,arch:process.arch,kernel:os.release(),cpu:os.cpus()[0]?.model,
 logicalCpu:os.cpus().length,power:'unknown',loadAverage:os.loadavg()};}
async function prepare(r){
 const repo=resolve(r.repo),dir=resolve(r.directory),sha=git(repo,'rev-parse',`${r.ref}^{commit}`),manifest=join(dir,'material.json');
 if(fs.existsSync(manifest)){const old=read(manifest);if(old.sha!==sha||treeHash(join(dir,'test-build'))!==old.compiledSha256)throw Error('Existing material differs');return old;}
 if(fs.existsSync(dir)&&fs.readdirSync(dir).length)throw Error('Refuse to overwrite a nonempty material directory');
 fs.mkdirSync(dir,{recursive:true});
 const archive=execFileSync('git',['archive','--format=tar',sha,'src','package.json','package-lock.json','tsconfig.json'],{cwd:repo,maxBuffer:64*1024*1024});
 execFileSync('tar',['-xf','-','-C',dir],{input:archive});
 const modules=resolve(r.nodeModules??join(repo,'node_modules')),lock=read(join(dir,'package-lock.json')),versions={};
 for(const name of deps){const actual=read(join(modules,name,'package.json')).version,expected=lock.packages[`node_modules/${name}`]?.version;
  if(actual!==expected)throw Error(`Dependency differs: ${name}: ${actual} != ${expected}`);versions[name]=actual;}
 fs.symlinkSync(modules,join(dir,'node_modules'),'dir');
 // The unchanged old benchmark and its synthetic generator are one shared harness for all materials.
 for(const file of ['demo/benchmark_optimize_geometry_preflight.mjs','demo/fixtures/large-house.mjs','demo/fixtures/wall-key.mjs']){
  const to=join(dir,file);fs.mkdirSync(dirname(to),{recursive:true});
  fs.writeFileSync(to,execFileSync('git',['show',`${r.fixtureRef??'v1.83.0'}:${file}`],{cwd:repo,maxBuffer:8*1024*1024}));
 }
 write(join(dir,'tsconfig.research.json'),{extends:'./tsconfig.json',compilerOptions:{noEmit:false,incremental:false,rootDir:'src',outDir:'test-build'},
  include:['src/plan-geometry-preflight.ts','src/space-geometry.ts','src/wall-thickness.ts','src/visual-continuity.ts','src/plan-optimizer.ts']});
 execFileSync(process.execPath,[join(modules,'typescript/bin/tsc'),'-p',join(dir,'tsconfig.research.json')],{cwd:dir,stdio:'inherit'});
 patchImports(join(dir,'test-build'),{coverage:false});
 const value={schema:1,label:r.label,sha,sourceTree:git(repo,'rev-parse',`${sha}:src`),versions,
  lockSha256:hash(fs.readFileSync(join(dir,'package-lock.json'))),compiledSha256:treeHash(join(dir,'test-build')),
  archiveSha256:hash(archive),legacyBenchmarkSha256:hash(fs.readFileSync(join(dir,'demo/benchmark_optimize_geometry_preflight.mjs'))),environment:environment()};
 write(manifest,value);return value;
}
async function worker(r){
 const dir=resolve(r.directory),material=read(join(dir,'material.json'));
 if(r.harnessSha256&&hash(fs.readFileSync(self))!==r.harnessSha256)throw Error('Measurement harness changed');
 if(!['direct','full','decomposition'].includes(r.mode))throw Error('Unknown measurement mode');
 if(material.sha!==r.sha||treeHash(join(dir,'test-build'))!==material.compiledSha256)throw Error('Measured material is not the pinned compiled input');
 const fixture=read(r.fixture),config=fixture.config,fixtureSha256=hash(JSON.stringify(config));
 if(fixtureSha256!==r.fixtureSha256)throw Error('Fixture differs');
 const load=name=>import(pathToFileURL(join(dir,'test-build',`${name}.js`)).href);
 const [pre,space,wall,fingerprint]=await Promise.all(['plan-geometry-preflight','space-geometry','wall-thickness','visual-continuity'].map(load));
 let operation,phases,counts;
 const reset=()=>{phases={fingerprint:0,prepare:0,wall:0,floor:0};counts={fingerprint:0,prepare:0,wall:0,floor:0};};reset();
 const timed=(name,fn)=>(...args)=>{counts[name]++;const t=performance.now();try{return fn(...args);}finally{phases[name]+=performance.now()-t;}};
 const options=r.mode==='decomposition'?{fingerprint:timed('fingerprint',fingerprint.contentFingerprint),prepareSpace:timed('prepare',pre.prepareSpacePhysicalGeometryInputs),
  wallPass:timed('wall',wall.wallBodiesGeometry),floorPass:timed('floor',wall.floorFootprintGeometry)}:{};
 if(r.mode==='direct'){
  const models=space.spaceModels(config),prepared=config.spaces.map((s,i)=>pre.prepareSpacePhysicalGeometryInputs(s,models[i]));
  operation=()=>{for(const i of prepared){const has=i.walls.length||i.physicalBodies.length;
   const body=has?wall.wallBodiesGeometry(i.space.rooms,i.walls,i.openCuts,i.roomOpenings,i.wallKeyPitch,i.cellCm,i.gridPitch,i.coordScale,i.physicalBodies):null;
   if(has)assertGeometry(body,i.space.id);
   if(i.space.rooms.length&&body?.paperGeom==null)assertGeometry(wall.floorFootprintGeometry(i.space.rooms,i.walls,i.openCuts,i.wallKeyPitch,i.cellCm,i.gridPitch,i.coordScale),'floor');
  }};
 }else operation=()=>assertPreflight(pre.checkOptimizeGeometry(config,options),config.spaces.length);
 for(let i=0;i<(r.warmups??0);i++)operation();reset();
 const start=new Date().toISOString(),samples=[],phaseRows=[];
 for(let i=0;i<r.samples;i++){reset();const t=performance.now();operation();const total=performance.now()-t;samples.push(total);
  if(r.mode==='decomposition')phaseRows.push({total,...phases,residual:total-Object.values(phases).reduce((a,b)=>a+b,0),calls:{...counts}});
 }
 const result={mode:r.mode,warmups:r.warmups??0,count:r.samples,environment:environment(),startedAt:start,samplesMs:samples,summary:summary(samples),phaseRows};
 if(r.profile){
  const session=new Session();session.connect();const post=(method,params={})=>new Promise((yes,no)=>session.post(method,params,(e,v)=>e?no(e):yes(v)));
  await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:1000});await post('Profiler.start');
  try{for(let i=0;i<3;i++)operation();}finally{
   const {profile}=await post('Profiler.stop');session.disconnect();const totals=new Map();
   for(let i=0;i<(profile.samples?.length??0);i++)totals.set(profile.samples[i],(totals.get(profile.samples[i])??0)+(profile.timeDeltas?.[i]??0));
   result.profile={iterations:3,samplingIntervalUs:1000,exclusiveSamples:profile.nodes.map(n=>({function:n.callFrame.functionName,url:n.callFrame.url.replace(dir,'material'),line:n.callFrame.lineNumber+1,
    milliseconds:(totals.get(n.id)??0)/1000})).sort((a,b)=>b.milliseconds-a.milliseconds).slice(0,30)};
   if(r.profileFile){fs.writeFileSync(r.profileFile,gzipSync(JSON.stringify(profile)));result.profile.sha256=hash(fs.readFileSync(r.profileFile));}
  }
  const modelTimes=[];for(let i=0;i<5;i++){const t=performance.now();for(const s of config.spaces)space.spaceModels({...config,spaces:[s]});modelTimes.push(performance.now()-t);}
  result.modelProjection={samplesMs:modelTimes,summary:summary(modelTimes),callsPerSample:config.spaces.length,
   note:'Independent diagnostic, not subtracted from the full series; residual also includes names, guards and loops.'};
 }
 if(hash(JSON.stringify(config))!==fixtureSha256)throw Error('Production mutated the frozen measurement fixture');
 return result;
}
async function collect(r){
 const out=resolve(r.outDirectory);fs.mkdirSync(out,{recursive:true});
 const manifests=r.materials.map(m=>({...read(join(m.directory,'material.json')),directory:resolve(m.directory)}));
 if(!fs.existsSync(r.fixture)){
  const f=await import(pathToFileURL(join(manifests[0].directory,'demo/fixtures/large-house.mjs')).href),v=f.makeLargeHouseFixture();
  write(r.fixture,{config:v.config,layout:v.layout,counts:v.counts});
 }
 const fixtureSha256=hash(JSON.stringify(read(r.fixture).config)),harnessSha256=hash(fs.readFileSync(self));
 const report={schema:1,issue:1172,harnessSha256,fixtureSha256,fixtureCounts:read(r.fixture).counts,input:'Original unoptimized large-house config, not complete UI Optimize latency',
  environment:environment(),coldSamples:r.coldSamples??5,warmups:r.warmups??3,samples:r.samples??20,materials:[]};
 const run=(m,mode,samples,warmups,extra={})=>{
  const request={directory:m.directory,sha:m.sha,fixture:r.fixture,fixtureSha256,harnessSha256,mode,samples,warmups,...extra};
  const path=join(out,`request-${m.label}-${mode}.json`);write(path,request);
  return JSON.parse(execFileSync(process.execPath,[self,'--worker',path],{encoding:'utf8',maxBuffer:8*1024*1024}));
 };
 for(const m of manifests){
  const row={material:{...m,directory:undefined},cold:{direct:[],full:[]},warm:{}};
  for(let i=0;i<report.coldSamples;i++)for(const mode of i%2?['full','direct']:['direct','full'])row.cold[mode].push(run(m,mode,1,0));
  for(const mode of ['direct','full'])row.warm[mode]=run(m,mode,report.samples,report.warmups);
  row.decomposition=run(m,'decomposition',5,3,{profile:true,profileFile:join(out,`${m.label}.cpuprofile.gz`)});
  row.budget=budgetResult(row.warm.direct.samplesMs,row.warm.full.samplesMs);
  const old=spawnSync(process.execPath,['demo/benchmark_optimize_geometry_preflight.mjs'],{cwd:m.directory,encoding:'utf8',maxBuffer:8*1024*1024});
  if(old.error)throw old.error;if(![0,1].includes(old.status))throw Error(`Legacy benchmark failed to execute: ${old.stderr}`);
  row.legacy={exitCode:old.status,report:JSON.parse(old.stdout)};
  const profile=await import(pathToFileURL(join(m.directory,'test-build/plan-optimizer.js')).href),f=read(r.fixture);
  const audit=profile.optimizePlans(f.config,f.layout);
  row.inputAudit={optimizerChanged:audit.changed,optimizedConfigSha256:hash(JSON.stringify(audit.config)),note:'Audit outside timing workers; the main comparison deliberately retains the old raw benchmark input.'};
  report.materials.push(row);write(join(out,'measurement.json'),report);
  process.stderr.write(`Collected ${m.label}: full warm p95=${row.budget.candidate.p95.toFixed(2)}ms; legacy exit=${old.status}\n`);
 }
 return report;
}
if(isMainModule(import.meta.url)){
 const [mode,path]=process.argv.slice(2);if(!['--prepare','--worker','--collect'].includes(mode)||!path)throw Error('Use --prepare|--worker|--collect request.json');
 const result=await ({'--prepare':prepare,'--worker':worker,'--collect':collect}[mode])(read(path));
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}