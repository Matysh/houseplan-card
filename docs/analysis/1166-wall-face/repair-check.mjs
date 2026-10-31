import fs from 'node:fs';
import { planWallFaceRepair } from './wall-face-repair-release.ts';
const ps=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).payload.config.spaces[0].partitions;
const sources=ps.map(p=>({a:p.a.map(v=>v*1000),b:p.b.map(v=>v*1000),key:'static:partition|'+p.id}));
const gridStep = 1000 / 240;
const results=[5,2 * gridStep,25,50,83.3333333333].map(maxDistance=>({maxDistance,
  result:planWallFaceRepair(sources,{point:[350,400],epsilon:gridStep*.0002,gridStep,maxDistance})}));
fs.writeFileSync(new URL('./repair-results.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(x=>({maxDistance:x.maxDistance,kind:x.result.kind})),null,2));
