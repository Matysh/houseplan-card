import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildWallFaceGraph, findWallFaceAtPoint } from './wall-face-graph-release.ts';
const bytes = fs.readFileSync(process.argv[2]);
const original = JSON.parse(bytes).payload.config.spaces[0].partitions;
const ps = structuredClone(original);
const projection = (point, carrier) => {
  const [x,y] = carrier.a, dx = carrier.b[0]-x, dy=carrier.b[1]-y;
  const t=((point[0]-x)*dx+(point[1]-y)*dy)/(dx*dx+dy*dy);
  return [x+t*dx,y+t*dy];
};
const comparisons = [[5,2],[6,1],[7,0]].map(([branch,carrier])=>{
  const originalPoint = ps[branch].b;
  const projected = projection(originalPoint,ps[carrier]);
  ps[branch].b=projected;
  return { branch:branch+1,carrier:carrier+1,originalPoint,projected,
    distanceNormalized:Math.hypot(...originalPoint.map((v,i)=>v-projected[i])),
    roundoffThresholdNormalized:Number.EPSILON*16*Math.max(1,...originalPoint.map(Math.abs),...projected.map(Math.abs)) };
});
const sources=ps.map(p=>({a:p.a.map(v=>v*1000),b:p.b.map(v=>v*1000),key:p.id}));
const epsilon = (1000 / 240) * .0002;
const graph=buildWallFaceGraph(sources,epsilon);
const result={ sourceVersion:'1.83.0', sourceCommit:'cb2c71ab7b5943e607b83a4f052a734eb36b22f7',
  originalFileSha256:createHash('sha256').update(bytes).digest('hex'),
  moduleSha256:createHash('sha256').update(fs.readFileSync(new URL('./wall-face-graph-release.ts',import.meta.url))).digest('hex'),
  comparisons,
  exactProjectionInMemoryOnly:{faceCount:graph.faces.length,
    top:!!findWallFaceAtPoint(graph,[350,400],epsilon),
    bottom:!!findWallFaceAtPoint(graph,[-200,1240],epsilon)},
  originalFileUnchanged:createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex')===createHash('sha256').update(bytes).digest('hex') };
fs.writeFileSync(new URL('./precision-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
