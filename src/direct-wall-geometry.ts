/** ADR #282 stage 4: accepted graph -> finite material domains -> one boundary.
 * No room-ring offsets, topology reconstruction by epsilon, or polygon booleans.
 */
import type { PlanGraph, GraphEdge } from './plan-graph';
import type { WallGraphSource } from './wall-graph-source';
import type { MultiWallNodeMap, MultiWallNode, WallBodiesGeometryResult } from './wall-thickness';
import type { PartitionOpeningCut } from './physical-geometry';
import * as Q from './plan-exact';
import * as R from './render-exact';
import * as A from './wall-arrangement';
import { compareCodePoints } from './codepoint-order';
import { graphOpeningRun, annotateGraphOpeningRuns } from './graph-opening-run';
interface Material {poly:A.Polygon;owners:string[];room:boolean}
interface Ray {d:Q.ExactPoint;u:[number,number];h:number;length:number;thickLength:number;owners:string[];left:number[];right:number[];materials:number[]}
interface Structure {materials:Material[];paper:A.Polygon[];paperMaterials:A.Polygon[];nodes:MultiWallNodeMap;depth:number;runs:Map<string,readonly string[]>;segments:Array<{kind:string;id:string;a:number[];b:number[]}>;roomGeom?:any;paperGeom?:any;geometryCache:Map<string,any>}
interface ExtraInput {columns:number[][][];partitionCuts:readonly PartitionOpeningCut[]}
export interface DirectOpening {x:number;y:number;angle:number;length:number;host?:{kind:string;id:string};hostIds?:readonly string[]}
const extras=new WeakMap<object,ExtraInput>();
const retained=new WeakMap<object,{structure:Structure;openings:DirectOpening[];extra:ExtraInput}>();
const cache=new WeakMap<PlanGraph,Map<string,Structure>>();
const edgeKey=(e:{kind:string;id:string})=>e.kind+':'+e.id;
const xy=(p:Q.ExactPoint,scale:number):number[]=>p.map(q=>Q.toNumber(q)*scale);
const between=(t:Q.Exact)=>Q.cmp(t,Q.ZERO)>=0&&Q.cmp(t,Q.ONE)<=0;
const numericCross=(a:number[],b:number[])=>a[0]*b[1]-a[1]*b[0];
const dot=(a:number[],b:number[])=>a[0]*b[0]+a[1]*b[1];
function unit(d:Q.ExactPoint):[number,number]{
  const ax=d[0].n<0n?R.neg(d[0]):d[0],ay=d[1].n<0n?R.neg(d[1]):d[1],magnitude=R.cmp(ax,ay)>0?ax:ay;
  const x=R.toNumber(R.div(d[0],magnitude)),y=R.toNumber(R.div(d[1],magnitude)),length=Math.hypot(x,y);
  return[x/length,y/length];
}
function chamfer(p:number[],ea:number[],apex:number[],eb:number[],limit:number):number[][] {
  const delta=[apex[0]-p[0],apex[1]-p[1]],length=Math.hypot(...delta);
  if(length<=limit)return[p,ea,apex,eb];
  const n=delta.map(x=>x/length),cut=(from:number[])=>{
    const f=dot([from[0]-p[0],from[1]-p[1]],n),t=(limit-f)/(length-f);
    return[from[0]+(apex[0]-from[0])*t,from[1]+(apex[1]-from[1])*t];
  };
  return[p,ea,cut(ea),cut(eb),eb];
}
/** #329/#339: an inherited degenerate room apex ends at the plan vertex.
 * Derive the addressed exterior half-planes from oriented room runs. Shared
 * internal half-edges never become a facade; splitting a straight run cannot
 * change its taper. These planes constrain only their own material owners.
 */
function facadeTapers(graph:PlanGraph,points:Map<string,Q.ExactPoint>,scale:number,cellCm:number,gridPitch:number){
  const edges=new Map(graph.edges.map(e=>[edgeKey(e),e]));
  const owned=new Set(graph.rooms.flatMap(room=>room.edges.map(edgeKey)));
  const scaled=(p:Q.ExactPoint):A.Point=>[R.mul(p[0],A.binary64(scale)),R.mul(p[1],A.binary64(scale))];
  const segments=graph.edges.filter(e=>owned.has(edgeKey(e))).map(edge=>({edge,a:scaled(points.get(edge.from)!),b:scaled(points.get(edge.to)!)}));
  const index=A.tree(segments,s=>A.bounds([s.a,s.b]));
  const at=(p:A.Point)=>A.query(index,A.bounds([p])).filter(s=>!R.orientation(s.a,s.b,p).n
    &&R.pointCmp(p,R.pointCmp(s.a,s.b)<=0?s.a:s.b)>=0&&R.pointCmp(p,R.pointCmp(s.a,s.b)<=0?s.b:s.a)<=0);
  const centres=graph.rooms.map(room=>room.edges.map(ref=>{const e=edges.get(edgeKey(ref))!;return scaled(points.get(ref.reverse?e.to:e.from)!);}));
  // Trace the actual room-union facade, including holes, nested/overlapping
  // rooms and cross-room exterior corners. This is exact centre topology,
  // not a union/difference of offset polygons or a room-local wedge clip.
  const boundaries=A.arrangeExact(centres).flat();
  const planes:Array<{owners:Set<string>;a:A.Point;b:A.Point;inside:boolean}>=[];
  for(const vertices of boundaries){
    const n=vertices.length;
    const refs=vertices.map((p,i)=>at(R.pointAt(p,vertices[(i+1)%n],R.exact(1n,2n))).map(s=>edgeKey(s.edge)));
    const h=refs.map(ids=>Math.max(0,...ids.map(id=>edges.get(id)!.cm))/cellCm*gridPitch/2);
    const kept=vertices.map((_,i)=>i).filter(i=>R.orientation(vertices[(i+n-1)%n],vertices[i],vertices[(i+1)%n]).n!==0n||h[(i+n-1)%n]!==h[i]);
    if(kept.length<3)continue;
    const runs=kept.map((start,i)=>{
      const end=kept[(i+1)%kept.length],owners:string[]=[];
      for(let j=start;j!==end;j=(j+1)%n)owners.push(...refs[j]);
      return{a:vertices[start],b:vertices[end],h:h[start],owners};
    });
    const orientation=1; // arrangement boundaries always keep room material left
    const corners=runs.map((next,i)=>{
      const previous=runs[(i+runs.length-1)%runs.length],p=A.pointNumbers(next.a);
      const da=R.pointSub(previous.b,previous.a),db=R.pointSub(next.b,next.a),ua=unit(da),ub=unit(db);
      const pa=[p[0]+orientation*ua[1]*previous.h,p[1]-orientation*ua[0]*previous.h];
      const pb=[p[0]+orientation*ub[1]*next.h,p[1]-orientation*ub[0]*next.h];
      const den=numericCross(ua,ub),limit=4*Math.max(previous.h,next.h);
      let hit:number[]|undefined;
      if(den!==0){const t=numericCross([pb[0]-pa[0],pb[1]-pa[1]],ub)/den;
        if(Number.isFinite(t)&&Math.abs(t)<=limit+previous.h){const q=[pa[0]+ua[0]*t,pa[1]+ua[1]*t];if(Math.hypot(q[0]-p[0],q[1]-p[1])<=limit)hit=q;}}
      if(hit)return{before:hit,after:hit,degenerate:false};
      const cos=-dot(ua,ub),sin=Math.abs(den),la=Math.hypot(...A.pointNumbers(da)),lb=Math.hypot(...A.pointNumbers(db));
      const alongA=(next.h+previous.h*cos)/sin,alongB=(previous.h+next.h*cos)/sin;
      const degenerate=previous.h>0&&next.h>0&&den*orientation>0&&cos>Math.cos(15*Math.PI/180)
        &&alongA>0&&alongB>0&&alongA<la&&alongB<lb;
      return degenerate?{before:p,after:p,degenerate:true}:{before:pa,after:pb,degenerate:false};
    });
    for(let i=0;i<runs.length;i++){
      const a=corners[i],b=corners[(i+1)%runs.length];if(!a.degenerate&&!b.degenerate)continue;
      const owners=new Set(runs[i].owners);
      if(a.degenerate)for(const s of at(runs[i].a))owners.add(edgeKey(s.edge));
      if(b.degenerate)for(const s of at(runs[i].b))owners.add(edgeKey(s.edge));
      planes.push({owners,a:A.numericPoint(a.after),b:A.numericPoint(b.before),inside:true});
    }
  }
  return planes;
}
function buildStructure(source:WallGraphSource,cellCm:number,gridPitch:number):Structure {
  const graph=source.graph,points=new Map(graph.nodes.map(n=>[n.id,Q.decodePoint(n.p)]));
  const records=graph.edges.filter(e=>e.cm>0).map(edge=>({edge,a:points.get(edge.from)!,b:points.get(edge.to)!,cuts:new Map<string,Q.ExactPoint>()}));
  const edgeTree=A.tree(records,r=>A.bounds([r.a,r.b]));
  // Exact-coordinate contact groups and unsplit endpoint-on-edge T nodes.
  for(const record of records){record.cuts.set(A.pointKey(record.a),record.a);record.cuts.set(A.pointKey(record.b),record.b);}
  for(const point of points.values())for(const record of A.query(edgeTree,A.bounds([point]))){
    if(!Q.orientation(record.a,record.b,point).n&&between(Q.projectParameter(point,record.a,record.b)))record.cuts.set(A.pointKey(point),point);
  }
  const nodes=new Map<string,{point:Q.ExactPoint;rays:Ray[]}>(),materials:Material[]=[];
  const ownedWalls=new Set(graph.rooms.flatMap(r=>r.edges.map(edgeKey)));
  let depth=0;
  const ray=(p:Q.ExactPoint,q:Q.ExactPoint,edge:GraphEdge,material:number):Ray=>{
    const d=Q.pointSub(q,p),u=unit(d),h=edge.cm/cellCm*gridPitch/2,length=Math.hypot(...xy(d,source.scale));
    const pos=xy(p,source.scale),normal=[-u[1]*h,u[0]*h];
    const key=A.pointKey(p),node=nodes.get(key)||{point:p,rays:[]};nodes.set(key,node);
    const old=node.rays.find(r=>!Q.cross(r.d,d).n&&Q.dot(r.d,d).n>0n);
    const left=[pos[0]+normal[0],pos[1]+normal[1]],right=[pos[0]-normal[0],pos[1]-normal[1]];
    const out={d,u,h,length,thickLength:length,owners:[edgeKey(edge)],left,right,materials:[material]};
    if(old){
      old.owners.push(...out.owners);old.materials.push(material);old.length=Math.max(old.length,length);
      if(h>old.h){old.h=h;old.thickLength=length;old.left=left;old.right=right;}
      else if(h===old.h)old.thickLength=Math.max(old.thickLength,length);
    }else node.rays.push(out);
    return out;
  };
  for(const record of records){
    const cuts=[...record.cuts.values()].sort((a,b)=>Q.cmp(Q.projectParameter(a,record.a,record.b),Q.projectParameter(b,record.a,record.b)));
    depth=Math.max(depth,record.edge.cm/cellCm*gridPitch);
    for(let i=0;i+1<cuts.length;i++){
      const at=materials.length,a=ray(cuts[i],cuts[i+1],record.edge,at),b=ray(cuts[i+1],cuts[i],record.edge,at);
      materials.push({poly:A.polygon([a.left,b.right,b.left,a.right]),owners:[edgeKey(record.edge)],room:ownedWalls.has(edgeKey(record.edge))});
    }
  }
  const cutsByMaterial=new Map<number,A.Polygon[]>(),nodeMetadata:MultiWallNode[]=[];
  for(const node of nodes.values()){
    const rays=node.rays.sort((a,b)=>A.angleCompare(a.d,b.d)),p=xy(node.point,source.scale);
    if(rays.length<2)continue;
    if(rays.length>=3)nodeMetadata.push({point:p as[number,number],rays:rays.map(r=>({u:r.u,halfDepth:r.h,length:r.length,supports:[{halfDepth:r.h,length:r.thickLength}],continuations:[]})),halfDepth:Math.max(...rays.map(r=>r.h)),limit:4*Math.max(...rays.map(r=>r.h))});
    const independentPair=rays.length===2&&rays.every(r=>r.owners.every(id=>!ownedWalls.has(id)));
    // Degree-2 butt caps obey the partner's outside face, bounded to their own
    // real support. This is a local half-plane formula, not a boolean repair.
    if(rays.length===2){
      const[a,b]=rays,cross=numericCross(a.u,b.u);
      if(cross!==0){
        const sign=cross<0?1:-1,nA=[-a.u[1],a.u[0]],nB=[-b.u[1],b.u[0]];
        const pA=[p[0]+nA[0]*a.h*sign,p[1]+nA[1]*a.h*sign],pB=[p[0]-nB[0]*b.h*sign,p[1]-nB[1]*b.h*sign];
        const numerator=numericCross([pB[0]-pA[0],pB[1]-pA[1]],b.u),limit=4*Math.max(a.h,b.h);
        // An almost straight thickness step has no local outer mitre. Never
        // remove a finite cap for an intersection tending to infinity.
        if(independentPair&&dot(a.u,b.u)>0||Math.abs(numerator)<=Math.abs(cross)*(limit+a.h)){
        for(const[self,face,normal]of [[a,pB,nB.map(x=>-sign*x)],[b,pA,nA.map(x=>sign*x)]] as const){
          const reach=Math.min(2*self.h,self.thickLength),ex=[-self.u[1]*self.h,self.u[0]*self.h];
          const rect=A.polygon([[p[0]+ex[0],p[1]+ex[1]],[p[0]+self.u[0]*reach+ex[0],p[1]+self.u[1]*reach+ex[1]],[p[0]+self.u[0]*reach-ex[0],p[1]+self.u[1]*reach-ex[1]],[p[0]-ex[0],p[1]-ex[1]]]);
          const origin=A.numericPoint(face),line=Q.pointAdd(origin,[A.binary64(normal[1]),Q.neg(A.binary64(normal[0]))]);
          const wedge=A.clip(rect,origin,line,true);
          if(wedge.length)for(const id of self.materials){const list=cutsByMaterial.get(id)||[];list.push(wedge);cutsByMaterial.set(id,list);}
        }
        }
      }
    }
    for(let i=0;i<rays.length;i++){
      const a=rays[i],b=rays[(i+1)%rays.length],cross=Q.cross(a.d,b.d),reflex=cross.n<0n;
      if(!cross.n&&Q.dot(a.d,b.d).n>0n)continue;
      const ea=a.left,eb=b.right,maxH=Math.max(a.h,b.h),limit=4*maxH,den=numericCross(a.u,b.u);
      let fan:number[][]|null=null;
      if(den!==0){
        const delta=[eb[0]-ea[0],eb[1]-ea[1]],ta=numericCross(delta,b.u)/den,tb=numericCross(delta,a.u)/den;
        // Check the bounded ray parameters BEFORE constructing a remote apex.
        if(Number.isFinite(ta)&&Number.isFinite(tb)&&(independentPair&&reflex||Math.abs(ta)<=limit+a.h&&Math.abs(tb)<=limit+b.h)
            &&(reflex?ta<=0&&tb<=0:ta>0&&ta<=a.thickLength&&tb<=b.thickLength)){
          const apex=[ea[0]+a.u[0]*ta,ea[1]+a.u[1]*ta],v=[apex[0]-p[0],apex[1]-p[1]];
          const inSector=reflex?numericCross(a.u,v)>=0||numericCross(v,b.u)>=0:numericCross(a.u,v)>=0&&numericCross(v,b.u)>=0;
          if(inSector&&(independentPair&&reflex||Math.hypot(...v)<=limit))fan=rays.length>=3?chamfer(p,ea,apex,eb,1.5*maxH):[p,ea,apex,eb];
        }
      }
      if(!fan){
        // An obtuse, almost straight thickness step closes at the offset
        // origins. Forward bevel reaches would create a finite horn as the
        // exact angle tends to pi, and disappear discontinuously at pi.
        if(reflex||!cross.n||dot(a.u,b.u)<0)fan=[p,ea,eb];
        else{
          const reach=(r:Ray)=>Math.min(r.thickLength,Math.sqrt(Math.max(0,limit*limit-r.h*r.h)),2*maxH);
          const ra=reach(a),rb=reach(b);
          fan=[p,ea,[ea[0]+a.u[0]*ra,ea[1]+a.u[1]*ra],[eb[0]+b.u[0]*rb,eb[1]+b.u[1]*rb],eb];
        }
      }
      const poly=A.polygon(fan),owners=[...new Set([...a.owners,...b.owners])];
      if(poly.length)materials.push({poly,owners,room:owners.some(id=>ownedWalls.has(id))});
    }
  }
  const tapers=facadeTapers(graph,points,source.scale,cellCm,gridPitch);
  const trimmed=materials.flatMap((m,i)=>{
    let pieces=[m.poly];for(const cut of cutsByMaterial.get(i)||[])pieces=pieces.flatMap(p=>A.subtractConvex(p,cut));
    for(const plane of tapers)if(m.owners.some(id=>plane.owners.has(id)))pieces=pieces.map(p=>A.clip(p,plane.a,plane.b,plane.inside)).filter(p=>p.length);
    return pieces.map(poly=>({...m,poly}));
  });
  const maxCoordinate=graph.nodes.reduce((maximum,n)=>Math.max(maximum,...xy(Q.decodePoint(n.p),1).map(Math.abs)),1);
  const epsilon=Math.max(1e-12,Number.EPSILON*64*Math.max(maxCoordinate,depth/(2*source.scale)))*source.scale;
  const index=new Map<string,MultiWallNode[]>();
  for(const node of nodeMetadata){const key=Math.floor(node.point[0]/epsilon)+','+Math.floor(node.point[1]/epsilon);const list=index.get(key)||[];list.push(node);index.set(key,list);}
  const byKey=new Map(graph.edges.map(e=>[edgeKey(e),e]));
  const paper=graph.rooms.map(room=>A.polygon(room.edges.map(ref=>{const edge=byKey.get(edgeKey(ref))!;return xy(points.get(ref.reverse?edge.to:edge.from)!,source.scale);}))).filter(p=>p.length);
  const carriers=graph.edges.map(e=>({id:e.id,a:xy(points.get(e.from)!,source.scale),b:xy(points.get(e.to)!,source.scale),cm:e.cm,kind:e.kind}));
  for(const kind of ['wall','partition'] as const)annotateGraphOpeningRuns(graph,carriers.filter(e=>e.kind===kind),kind,source.scale);
  const runs=new Map(carriers.map(e=>[edgeKey(e),graphOpeningRun(e)?.members||[e.id]]));
  // The slab belongs to room masonry. Independent rays may complete a shared
  // visual junction, but may never enlarge the slab perimeter (#302).
  const paperMaterials=records.some(r=>!ownedWalls.has(edgeKey(r.edge)))
    ? buildStructure({...source,graph:{...graph,edges:graph.edges.filter(e=>ownedWalls.has(edgeKey(e)))}},cellCm,gridPitch).materials.map(m=>m.poly)
    : trimmed.filter(m=>m.room).map(m=>m.poly);
  return{materials:trimmed,paper,paperMaterials,nodes:{epsilon,coordinateScale:source.scale,nodes:nodeMetadata,index},depth,runs,segments:carriers,geometryCache:new Map()};
}
export function directStructure(source:WallGraphSource,cellCm:number,gridPitch:number):Structure {
  let entries=cache.get(source.graph);if(!entries){entries=new Map();cache.set(source.graph,entries);}
  const key=[source.scale,cellCm,gridPitch].join('|');let result=entries.get(key);
  if(!result){result=buildStructure(source,cellCm,gridPitch);entries.set(key,result);if(entries.size>4)entries.delete(entries.keys().next().value!);}
  return result;
}
function slot(a:number[],b:number[],pad:number):A.Polygon {
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len)return[];
  const n=[-dy/len*pad,dx/len*pad];
  return A.polygon([[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]]);
}
function materialPieces(structure:Structure,openings:DirectOpening[],extra:ExtraInput,filter:(m:Material)=>boolean=()=>true):A.Polygon[]{
  const masks=new Map<string,A.Polygon[]>();
  const add=(id:string,poly:A.Polygon)=>{if(!poly.length)return;const list=masks.get(id)||[];list.push(poly);masks.set(id,list);};
  for(const opening of openings){
    if(!(opening.length>0))continue;
    const rad=opening.angle*Math.PI/180,dx=Math.cos(rad)*opening.length/2,dy=Math.sin(rad)*opening.length/2;
    const poly=slot([opening.x-dx,opening.y-dy],[opening.x+dx,opening.y+dy],Math.max(structure.depth,structure.nodes.epsilon)*1.25);
    if(opening.host)for(const id of opening.hostIds||structure.runs.get(edgeKey(opening.host))||[opening.host.id])add(opening.host.kind+':'+id,poly);
    else{
      // Compatibility openings may be intentionally unbound. Associate only
      // this render cut to the nearest collinear wall; never write a host or
      // let a room opening punch an independent partition/column.
      const u=[Math.cos(rad),Math.sin(rad)],tau=structure.nodes.epsilon;
      const candidates=structure.segments.filter(s=>s.kind==='wall').map(s=>{
        const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],length=Math.hypot(dx,dy),v=[dx/length,dy/length];
        const along=(opening.x-s.a[0])*v[0]+(opening.y-s.a[1])*v[1];
        return{s,distance:Math.abs((opening.x-s.a[0])*v[1]-(opening.y-s.a[1])*v[0]),parallel:Math.abs(numericCross(v,u))<=Number.EPSILON*64,overlap:along+opening.length/2>=0&&along-opening.length/2<=length};
      }).filter(c=>c.parallel&&c.overlap&&c.distance<=tau).sort((a,b)=>a.distance-b.distance||compareCodePoints(a.s.id,b.s.id));
      const host=candidates[0]?.s;
      if(host)for(const id of structure.runs.get(edgeKey(host))||[host.id])add('wall:'+id,poly);
    }
  }
  for(const cut of extra.partitionCuts){const run=graphOpeningRun(cut);for(const id of run?.kind==='partition'?run.members:[cut.hostId])add('partition:'+id,slot(cut.a,cut.b,Math.max(cut.depth,1e-12)*1.25));}
  return structure.materials.filter(filter).flatMap(m=>{
    let pieces=[m.poly];for(const cut of new Set(m.owners.flatMap(id=>masks.get(id)||[])))pieces=pieces.flatMap(p=>A.subtractConvex(p,cut));return pieces;
  });
}
export function directIndependentParts(source:WallGraphSource,cellCm:number,gridPitch:number,columns:number[][][],partitionCuts:readonly PartitionOpeningCut[],rawPartitions:number[][][]){
  const extra={columns,partitionCuts};
  if(!source.graph.edges.some(e=>e.kind==='partition'&&e.cm>0)){
    const all=columns.slice();extras.set(all,extra);
    return Object.defineProperty({partitions:[],columns,patches:[],all},'rawPatches',{value:[]});
  }
  const structure=directStructure(source,cellCm,gridPitch);
  const partitionPolys=materialPieces(structure,[],extra,m=>m.owners.some(id=>id.startsWith('partition:')));
  const pieces=partitionPolys.map(p=>p.map(A.pointNumbers)),all=[...pieces,...columns];extras.set(all,extra);
  return Object.defineProperty({partitions:rawPartitions,columns,patches:[],all},'rawPatches',{value:[]});
}
export function directWallGeometry(source:WallGraphSource,cellCm:number,gridPitch:number,openings:DirectOpening[],extraBodies:number[][][]):WallBodiesGeometryResult {
  const structure=directStructure(source,cellCm,gridPitch),extra=extras.get(extraBodies)||{columns:extraBodies,partitionCuts:[]};
  const key=JSON.stringify([openings.map(o=>[o.x,o.y,o.angle,o.length,o.host,o.hostIds]),extra.columns,
    extra.partitionCuts.map(c=>[c.hostId,c.a,c.b,c.depth,graphOpeningRun(c)?.members])]);
  let failedExtras=0,failedComponents=0;
  const columns=extra.columns.flatMap(body=>{try{const p=A.polygon(body);if(p.length)return[p];}catch{}failedExtras++;return[];});
  let geom=structure.geometryCache.get(key);
  if(!geom){
    const arranged=A.arrangeComponents([...materialPieces(structure,openings,extra),...columns]);
    geom=arranged.geom;failedComponents+=arranged.failures;
    if(!failedComponents&&!failedExtras)structure.geometryCache.set(key,geom);
    if(structure.geometryCache.size>8)structure.geometryCache.delete(structure.geometryCache.keys().next().value!);
  }
  const roomPolys=structure.materials.filter(m=>m.room).map(m=>m.poly);
  const roomResult=structure.roomGeom?{geom:structure.roomGeom,failures:0}:A.arrangeComponents(roomPolys);
  const paperResult=structure.paperGeom?{geom:structure.paperGeom,failures:0}:A.arrangeComponents([...structure.paper,...structure.paperMaterials]);
  const roomGeom=roomResult.geom,paperGeom=paperResult.geom;
  if(!roomResult.failures)structure.roomGeom=roomGeom;if(!paperResult.failures)structure.paperGeom=paperGeom;
  failedComponents+=roomResult.failures+paperResult.failures;
  retained.set(roomGeom,{structure,openings,extra});
  const failures=failedExtras+failedComponents;
  return{status:failures?'degraded-extra':'ok',...(failures?{failurePhase:failedComponents?'direct-arrangement' as const:'direct-extra' as const}:{}),coordinateScale:source.scale,geom,components:geom.length?[{id:'primary',geom}]:[],roomGeom,roomComponents:roomGeom.length?[{id:'room-primary',geom:roomGeom}]:[],paperGeom,depthUnits:structure.depth,openingIndex:null,multiWallNodes:structure.nodes,degradedExtraCount:failures};
}
export function directRecut(roomGeom:object,openings:DirectOpening[],extraBodies:number[][][]):{status:'ok'|'degraded-extra';geom:any;components:any[]}|null {
  const base=retained.get(roomGeom);if(!base)return null;
  const extra=extras.get(extraBodies)||{columns:extraBodies,partitionCuts:[]};
  try{
    let invalid=0;
    const columns=extra.columns.flatMap(body=>{try{const p=A.polygon(body);if(p.length)return[p];}catch{}invalid++;return[];});
    const result=A.arrangeComponents([...materialPieces(base.structure,openings,extra),...columns]);
    return{status:result.failures||invalid?'degraded-extra':'ok',geom:result.geom,components:result.geom.length?[{id:'primary',geom:result.geom}]:[]};
  }catch{return{status:'degraded-extra',geom:[],components:[]};}
}
