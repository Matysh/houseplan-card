/** UI-062: shade trimmed masonry and ink only its physical floor/vertical edges. */
import { nothing, svg, type TemplateResult } from 'lit';
import { colorLuma, parseCssColor, type Rgb } from './iso-materials';
import { architecturalWallTone } from './iso-architectural-tone';
import { isoRotationBasis, projectPlanPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import type { IsoWallDepthQueueEntry } from './iso-scene-geometry';

type Face = { index:number; a:PlanPoint; b:PlanPoint; low:number; high:number; d:string; nx:number; ny:number; color:string };
type Paint = { fill:(index:number)=>string; edges:TemplateResult|typeof nothing;
  edge:(index:number,d:string,fragment:number)=>TemplateResult|typeof nothing };
const memo=new WeakMap<object,{key:string;paint:Paint}>();
const epsilon=1e-4;
const same=(a:PlanPoint,b:PlanPoint)=>Math.hypot(a[0]-b[0],a[1]-b[1])<epsilon;
function faceOf(entry:IsoWallDepthQueueEntry,index:number,camera:IsoCamera,color:Rgb):Face|null {
  let edge:readonly [PlanPoint,PlanPoint]|undefined, low=0, high=0, d='';
  if(entry.layer==='wall-side') {
    if(entry.face.roundColumn!==undefined)return null;
    edge=entry.face.planEdge; high=entry.face.height??0; d=entry.face.d;
  } else if(entry.layer==='opening' && entry.surface.material==='wall-side') {
    const points=entry.surface.points;
    if(!points?.length)return null;
    low=Math.min(...points.map(p=>p.z)); high=Math.max(...points.map(p=>p.z));
    const ends:PlanPoint[]=[];
    for(const p of points)if(!ends.some(q=>same(q,p.point)))ends.push(p.point);
    if(ends.length!==2)return null;
    edge=[ends[0],ends[1]]; d=entry.surface.d;
  }
  if(!edge || high-low<epsilon || !d)return null;
  const [a,b]=edge, length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<epsilon)return null;
  let nx=(b[1]-a[1])/length, ny=-(b[0]-a[0])/length;
  const [cos,sin]=isoRotationBasis(camera);
  if(nx*sin+ny*cos<0){nx=-nx;ny=-ny;}
  const sx=nx*cos-ny*sin, sy=nx*sin+ny*cos;
  const light=(1+(-.8*sx+.6*sy))/2;
  return {index,a,b,low,high,d,nx,ny,color:architecturalWallTone(color,light)};
}

export function architecturalPainter(queue:readonly IsoWallDepthQueueEntry[],camera:IsoCamera,color:string):Paint {
  const memoKey=JSON.stringify([camera,color]);
  const existing=memo.get(queue);
  if(existing?.key===memoKey)return existing.paint;
  const rgb=parseCssColor(color) ?? [255,255,255];
  const faces=queue.flatMap((entry,i)=>{const f=faceOf(entry,i,camera,rgb);return f?[f]:[];});
  const colors=new Map(faces.map(f=>[f.index,`--iso-face-fill:${f.color}`]));
  const byEnd=new Map<string,Face[]>();
  const key=(p:PlanPoint)=>p.map(v=>v.toFixed(3)).join(',');
  for(const face of faces)for(const point of [face.a,face.b]){
    const k=key(point), peers=byEnd.get(k);
    if(peers)peers.push(face);else byEnd.set(k,[face]);
  }
  const renderEdge = (face:Face,d:string,fragment:number) => {
    const segments:{a:PlanPoint;b:PlanPoint;z1:number;z2:number}[]=[];
    if(face.low<epsilon)segments.push({a:face.a,b:face.b,z1:0,z2:0});
    for(const point of [face.a,face.b]) {
      let intervals=[[face.low,face.high]];
      for(const other of byEnd.get(key(point))??[]) {
        if(other===face || Math.abs(face.nx*other.ny-face.ny*other.nx)>epsilon)continue;
        // Remove shared coplanar construction seams, including apron/lintel joins.
        intervals=intervals.flatMap(([a,b])=>other.high<=a+epsilon||other.low>=b-epsilon?[[a,b]]:
          [[a,Math.min(b,other.low)],[Math.max(a,other.high),b]].filter(([l,h])=>h-l>epsilon));
      }
      // Keep each owner's clipped half of a real corner. Deduplicating before
      // the visible clip can lose the surviving half behind a nearer wall.
      for(const [z1,z2] of intervals) segments.push({a:point,b:point,z1,z2});
    }
    if(!segments.length)return nothing;
    const id='hp-arch-edge-'+fragment;
    const ink=colorLuma(parseCssColor(face.color)??[255,255,255])<.35?'#e2eaf3':'#26313e';
    const linePath=segments.map(s=>`M ${projectPlanPoint(s.a,s.z1,camera).join(' ')} L ${projectPlanPoint(s.b,s.z2,camera).join(' ')}`).join(' ');
    return svg`<defs><clipPath id=${id}><path d=${d} fill-rule="evenodd" clip-rule="evenodd"></path></clipPath></defs>
      <path d=${linePath} clip-path=${'url(#'+id+')'} fill="none" stroke=${ink} stroke-opacity=".36"
        style="stroke-width:calc(1.2 * var(--hp-raster-outline-scale, 1))" vector-effect="non-scaling-stroke" stroke-linecap="butt"></path>`;
  };
  const edges=svg`<g class="iso-architectural-edges">${faces.map(face=>renderEdge(face,face.d,face.index))}</g>`;
  const byIndex = new Map(faces.map(face => [face.index, face]));
  const paint: Paint = { fill:index=>colors.get(index)??'', edges, edge:(index,d,fragment) => {
    const face = byIndex.get(index);
    return face ? renderEdge(face,d,fragment) : nothing;
  } };
  memo.set(queue,{key:memoKey,paint});
  return paint;
}
