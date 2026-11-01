import fs from 'node:fs';import path from 'node:path';
import ts from '../../../node_modules/typescript/lib/typescript.js';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),dir=path.join(root,process.argv[2]??'artifacts/save-long-tasks-1153');
const record=JSON.parse(fs.readFileSync(path.join(dir,'samples.json'))),profile=JSON.parse(fs.readFileSync(path.join(dir,'profile.cpuprofile'))),trace=JSON.parse(fs.readFileSync(path.join(dir,'trace.json'))).traceEvents;
const anchor=trace.find(e=>e.name==='diag-1145-anchor'&&e.ph==='R')??trace.find(e=>e.name==='diag-1145-anchor');if(!anchor)throw Error('Anchor missing');
const offset=anchor.ts-record.anchor*1000,windows=record.samples.map(s=>({...s,a:offset+s.input*1000,b:offset+s.paint*1000}));
const files=new Map(),ranges=[];
for(const node of profile.nodes){const url=node.callFrame.url;if(!url.startsWith('http://demo.local/assets/')||files.has(url))continue;
 const file=path.join(root,'demo/srv',new URL(url).pathname),text=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);files.set(url,{text,ast});
 const visit=n=>{
  if((ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n)||ts.isMethodDeclaration(n))&&n.body){
   const code=n.body.getText(ast);
   if(code.length<4000&&code.includes('WeakSet')&&/2166136261|0x811c9dc5/.test(code)&&/2654435769|0x9e3779b9/.test(code))ranges.push({url,kind:'contentFingerprint',a:n.getStart(ast),b:n.end});
   if(ts.isMethodDeclaration(n)&&n.name?.getText(ast)==='sync'&&code.includes('devlayer')&&code.includes('frameKey'))ranges.push({url,kind:'contactSync',a:n.getStart(ast),b:n.end});
  }
  ts.forEachChild(n,visit);
 };visit(ast);
}
if(!ranges.some(r=>r.kind==='contentFingerprint')||!ranges.some(r=>r.kind==='contactSync'))throw Error('Hot path source ranges not found: '+JSON.stringify(ranges));
const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of profile.nodes)for(const child of n.children??[])parents.set(child,n.id);
const tags=new Map();
for(const n of profile.nodes){const f=n.callFrame,data=files.get(f.url);if(!data||f.lineNumber<0||f.columnNumber<0)continue;
 const pos=data.ast.getPositionOfLineAndCharacter(f.lineNumber,f.columnNumber);tags.set(n.id,ranges.filter(r=>r.url===f.url&&pos>=r.a&&pos<r.b).map(r=>r.kind));}
const summaries=windows.map(w=>({case:w.case,iteration:w.iteration,input:w.input,paint:w.paint,client:w.client,ackToPaint:w.ackToPaint,cpu:{contentFingerprint:0,contactSync:0,structuredClone:0,json:0,other:0},cloneCallers:{}}));
const otherFrames=new Map(); let time=profile.startTime;
for(let i=0;i<profile.samples.length;i++){const dt=profile.timeDeltas[i];time+=dt;const index=windows.findIndex(w=>time>=w.a&&time<=w.b);if(index<0)continue;
 const id=profile.samples[i],chain=[];for(let n=id;n!==undefined;n=parents.get(n))chain.push(n);
 let group=chain.some(n=>tags.get(n)?.includes('contentFingerprint'))?'contentFingerprint':chain.some(n=>nodes.get(n)?.callFrame.functionName==='structuredClone')?'structuredClone':chain.some(n=>tags.get(n)?.includes('contactSync'))?'contactSync':/^(?:stringify|parse)$/.test(nodes.get(id)?.callFrame.functionName??'')?'json':'other';
 summaries[index].cpu[group]+=dt/1000; if(group==='other'){const f=nodes.get(id).callFrame,key=`${f.functionName||'(anonymous)'} @ ${f.url.split('/').at(-1)}:${f.lineNumber+1}:${f.columnNumber+1}`;otherFrames.set(key,(otherFrames.get(key)??0)+dt/1000);}
 if(group==='structuredClone'){const name=chain.map(n=>nodes.get(n)?.callFrame.functionName).filter(Boolean).slice(0,4).join(' <- ');summaries[index].cloneCallers[name]=(summaries[index].cloneCallers[name]??0)+dt/1000;}
}
const totals={};for(const s of summaries)for(const[k,v]of Object.entries(s.cpu))totals[k]=(totals[k]??0)+v;
const result={diagnosticOnly:true,instrumented:true,source:record.source,browser:record.browser,windows:summaries,totals,otherSelfTime:[...otherFrames].sort((a,b)=>b[1]-a[1]).slice(0,25),sourceRanges:ranges,method:'CPU samples assigned only inside trace-anchor matched input→paint windows; disjoint attribution: fingerprint descendants, structuredClone descendants, remaining contactSync descendants, leaf JSON builtin, other. Sampling is not wall-time or causal CI proof.'};
fs.writeFileSync(path.join(dir,'bounded-costs.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({source:result.source,browser:result.browser,totals,windows:summaries.map(s=>({case:s.case,iteration:s.iteration,client:s.client,cpu:s.cpu})),sourceRanges:ranges},null,2));