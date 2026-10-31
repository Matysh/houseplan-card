import fs from 'node:fs';
import { buildWallFaceGraph, findWallFaceAtPoint } from './wall-face-graph-release.ts';
const file = process.argv[2];
const space = JSON.parse(fs.readFileSync(file, 'utf8')).payload.config.spaces[0];
const ps = space.partitions;
const query = (indices, scale = 1000) => {
  const sources = indices.map(i => ({ a: ps[i].a.map(v=>v*scale), b: ps[i].b.map(v=>v*scale), key: ps[i].id }));
  const epsilon = (scale / 240) * 0.0002;
  const graph = buildWallFaceGraph(sources, epsilon);
  const top = findWallFaceAtPoint(graph, [0.35*scale, 0.4*scale], epsilon);
  const bottom = findWallFaceAtPoint(graph, [-0.2*scale, 1.24*scale], epsilon);
  return { indices, scale, atoms:graph.atoms.length, faces: graph.faces.map(f=>({ area:f.area, ring:f.ring, sourceKeys:f.sourceKeys })), top:!!top, bottom:!!bottom };
};
const all = ps.map((_,i)=>i);
const results = { productionGraph:query(all), normalizedGraph:query(all,1),
  noBranches:query(all.filter(i=>i<4||i>7)),
  eachBranchAlone:[4,5,6,7].map(i=>({branch:i,result:query([...all.filter(j=>j<4||j>7),i])})),
  removeOneBranch:[4,5,6,7].map(i=>({removed:i,result:query(all.filter(j=>j!==i))})) };
fs.writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({partitionCount:ps.length,
  production:{top:results.productionGraph.top,bottom:results.productionGraph.bottom,faces:results.productionGraph.faces.length},
  normalized:{top:results.normalizedGraph.top,bottom:results.normalizedGraph.bottom},
  noBranches:{top:results.noBranches.top,bottom:results.noBranches.bottom,faces:results.noBranches.faces.length},
  eachBranchAlone:results.eachBranchAlone.map(x=>({branch:x.branch,id:ps[x.branch].id,top:x.result.top,bottom:x.result.bottom})),
  removeOneBranch:results.removeOneBranch.map(x=>({removed:x.removed,top:x.result.top,bottom:x.result.bottom}))},null,2));
