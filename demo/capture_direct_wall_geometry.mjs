/** Reproducible mathematical coverage gallery; not a golden acceptance. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {difference,union} from 'polyclip-ts';
import {chromium} from 'playwright';
import {enforcePinnedBrowser,requirePinnedBrowser} from '../scripts/browser-attestation.mjs';
import {directWallScenes} from './fixtures/direct-wall-geometry.mjs';
const arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const baseline=resolve(arg('baseline')),out=resolve(arg('output')||'artifacts/1216/gallery');mkdirSync(out,{recursive:true});
const load=async root=>{
 const moduleAt=name=>import(pathToFileURL(resolve(root,'test-build',name+'.js')).href);
 const [model,preflight,wall,graph]=await Promise.all(['space-geometry','plan-geometry-preflight','wall-thickness','wall-segment-model'].map(moduleAt));
 return{...model,...preflight,...wall,...graph};
};
const old=await load(baseline),current=await load(process.cwd()),records=[],rows=[];
const polygonArea=ring=>{const o=ring[0];let area=0;for(let i=1;i+1<ring.length;i++)area+=(ring[i][0]-o[0])*(ring[i+1][1]-o[1])-(ring[i+1][0]-o[0])*(ring[i][1]-o[1]);return Math.abs(area)/2;};
const area=geometry=>geometry.reduce((sum,p)=>sum+p.reduce((s,r,i)=>s+(i?-1:1)*polygonArea(r),0),0);
function build(api,config){const raw=config.spaces[0],space=api.spaceModels(config)[0],input=api.prepareSpacePhysicalGeometryInputs(raw,space);return api.wallBodiesGeometry(space.rooms,input.walls,input.openCuts,input.roomOpenings,input.wallKeyPitch,input.cellCm,input.gridPitch,input.coordScale,input.physicalBodies);}
for(const raw of directWallScenes()){
 const legacy={model_version:10,spaces:[raw],markers:[],settings:{}};
 let normalized,migrationBaselineError;
 try{normalized=old.commitWallSegmentModel(legacy).config;}catch(error){migrationBaselineError=error.message;normalized=current.commitWallSegmentModel(legacy).config;}
 const before=build(old,legacy),oldCurrent=build(old,normalized),after=build(current,normalized);
 assert.equal(after.status,'ok',raw.id+' current core');
 const symmetric=area(union(difference(oldCurrent.geom,after.geom),difference(after.geom,oldCurrent.geom)));
 const migration=area(union(difference(before.geom,after.geom),difference(after.geom,before.geom)));
 const perimeter=geometry=>geometry.flatMap(p=>p).reduce((sum,r)=>sum+r.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-r[i][0],p[1]-r[i][1]),0),0);
 const vertices=oldCurrent.geom.concat(after.geom).flatMap(p=>p).reduce((n,r)=>n+r.length,0);
 const coordinates=[...raw.rooms.flatMap(r=>r.poly).flat(),...(raw.partitions||[]).flatMap(e=>[...e.a,...e.b])];
 const maxHalfDepth=Math.max(0,...normalized.spaces[0].plan_graph.edges.map(e=>e.cm))/(raw.cell_cm||5)/240/2;
 const maxCoordinate=Math.max(1,maxHalfDepth,...coordinates.map(Math.abs));
 const tau=1000*Math.max(1e-12,64*Number.EPSILON*maxCoordinate);
 const areaBound=tau*(perimeter(oldCurrent.geom)+perimeter(after.geom))+4*tau*tau*vertices;
 assert.ok(symmetric<=areaBound,raw.id+' masonry coverage tolerance');
 records.push({id:raw.id,migrationBaselineError,beforeStatus:before.status,model11OldStatus:oldCurrent.status,afterStatus:after.status,beforeArea:area(before.geom),afterArea:area(after.geom),beforePaperArea:area(before.paperGeom),afterPaperArea:area(after.paperGeom),addedArea:area(difference(after.geom,oldCurrent.geom)),removedArea:area(difference(oldCurrent.geom,after.geom)),model11SymmetricArea:symmetric,legacyToCurrentSymmetricArea:migration});
 // Keep both paper and masonry differences reviewable; this is evidence, not
 // an implicit acceptance of a changed visual baseline.
 records.at(-1).model11PaperBeforeArea=area(oldCurrent.paperGeom);
 records.at(-1).paperSymmetricArea=area(union(difference(oldCurrent.paperGeom,after.paperGeom),difference(after.paperGeom,oldCurrent.paperGeom)));
 records.at(-1).masonryAreaBound=areaBound;
 const geometry=[before,oldCurrent,after];
 rows.push(`<section><h2>${raw.id}</h2><div>${geometry.map((g,i)=>`<figure><figcaption>${['legacy reader','model11 old renderer','model11 direct'][i]}</figcaption><svg viewBox="60 60 880 880"><path d="${current.polyclipToPathD(g.paperGeom)}" fill="#fff"/><path d="${current.polyclipToPathD(g.geom)}" fill="#6e7d86" fill-rule="evenodd" stroke="#12242e" stroke-width="1"/></svg></figure>`).join('')}</div></section>`);
}
const html=`<!doctype html><meta charset="utf-8"><title>#1216 coverage comparison</title><style>body{font:16px system-ui;background:#e9edf0;margin:24px;color:#19303d}h1{font-size:24px}h2{font-size:18px;margin-bottom:4px}section{break-inside:avoid}section>div{display:flex;gap:12px}figure{margin:0;flex:1}figcaption{font-size:14px}svg{width:100%;height:310px;background:#f5f7f9;border:1px solid #bcc7cf}</style><h1>#1216 · synthetic physical coverage · no golden acceptance</h1>${rows.join('')}`;
writeFileSync(resolve(out,'index.html'),html);writeFileSync(resolve(out,'coverage.json'),JSON.stringify(records,null,2));
requirePinnedBrowser();const browser=await chromium.launch({args:['--no-sandbox']});
try{await enforcePinnedBrowser(browser);const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});await page.setContent(html);await page.screenshot({path:resolve(out,'comparison.png'),fullPage:true});}finally{await browser.close();}
console.log(JSON.stringify({out,records},null,2));
