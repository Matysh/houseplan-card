/** Client-only bridge from an explicitly named editor intent to exact graph commands. */
import {
  type PlanGraph, type GraphEdgeRef, type GraphEdge, type GraphOperation, type GraphMapping,
  type TargetPointRef, type GraphPoint, graphIndex, edgeKey, validateGraph, prepareGraph,
  applyGraphOperation, projectGraphSpace, PlanGraphError,
} from './plan-graph';
import * as Q from './plan-exact';
import { jsonValueEqual } from './json-value-equal';
import { wallKey, thicknessCmAt } from './wall-thickness';
import { compareCodePoints } from './codepoint-order';
import { contentFingerprint } from './visual-continuity';
import { assertFiniteColumnInputs } from './column-input';
import { graphSeamCrossedByOpening } from './graph-seam-opening';
import type { GraphWallRecordProof } from './wall-record-preservation';
export type GraphEditIntent =
  | { kind: 'metadata' }
  | { kind: 'openings'; ids: readonly string[] }
  | { kind: 'partitions'; ids: readonly string[];
      endpointRefs?: Record<string, readonly [TargetPointRef?, TargetPointRef?]> }
  | { kind: 'segments'; edges: readonly GraphEdgeRef[]; endpointRefs?: Record<string, readonly [TargetPointRef?, TargetPointRef?]> }
  | { kind: 'resize'; rooms: readonly string[]; shared?: boolean }
  | { kind: 'thickness'; edges?: readonly GraphEdgeRef[]; rooms?: readonly string[]; cm: number;
      selection?: { room: string; a: readonly number[]; b: readonly number[] } }
  | { kind: 'faces'; rooms: readonly string[]; removeRooms?: readonly string[];
      consumedPartitionIds?: readonly string[]; sourceEdges?: readonly GraphEdgeRef[] }
  | { kind: 'delete-room'; room: string; keepWalls: boolean }
  | { kind: 'merge-rooms'; keep: string; drop: string | readonly string[]; sourceEdges?: readonly GraphEdgeRef[] };
export interface GraphEditResult<T> { space: T; graph: PlanGraph; mapping: GraphMapping; operations: GraphOperation[];
  resizeWallRecords?: GraphWallRecordProof }
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const ref=(edge:GraphEdgeRef):GraphEdgeRef=>({kind:edge.kind,id:edge.id});
const sameNumbers=(a:readonly number[]|undefined,b:readonly number[]|undefined):boolean=>
  !!a&&!!b&&a.length===2&&b.length===2&&a[0]===b[0]&&a[1]===b[1];
function failure(code:string,subject=''):never{throw new PlanGraphError('edit-'+code,subject);}
const codepoint=compareCodePoints;
const rational=(host:any):Q.Exact=>host.tq?Q.decodeRational(host.tq):Q.parseDecimal(host.t);
const canonicalHost=(host:any,t:Q.Exact):any=>({...host,tq:Q.encodeRational(t),t:Q.toNumber(t)});
const emptyMapping=():GraphMapping=>({nodes:Object.create(null),edges:Object.create(null),hosts:Object.create(null)});
const authoredPoint=Q.readAuthoredPoint;
function opaque(entry:any,skip:string[]):Record<string,unknown>|undefined{
  const entries=Object.entries(entry||{}).filter(([key,value])=>!skip.includes(key)&&value!==undefined);
  return entries.length?Object.fromEntries(entries.map(([key,value])=>[key,clone(value)])):undefined;
}
function sourcePoly(room:any):number[][]{
  if(Array.isArray(room?.poly))return room.poly;
  return room&&['x','y','w','h'].every(key=>Number.isFinite(room[key]))?
    [[room.x,room.y],[room.x+room.w,room.y],[room.x+room.w,room.y+room.h],[room.x,room.y+room.h]]:[];
}
function numericNear(a:readonly number[],b:readonly number[]):boolean{
  // An association proof for already named sources / old derived carriers only.
  // This is not a node merge radius and is never used by the graph normalizer.
  const quantum=0.5000001e-9+Number.EPSILON*32*Math.max(1,...a.map(Math.abs),...b.map(Math.abs));
  return Math.abs(a[0]-b[0])<=quantum&&Math.abs(a[1]-b[1])<=quantum;
}
class Allocation {
  private usedNodes:Set<string>;private usedEdges:Set<string>;
  private assigned=new Map<string,string>();
  constructor(graph:PlanGraph){this.usedNodes=new Set(graph.nodes.map(n=>n.id));this.usedEdges=new Set(graph.edges.map(edgeKey));}
  id(kind:'node'|'wall'|'partition',seed:unknown):string{
    const key=kind+':'+JSON.stringify(seed),prior=this.assigned.get(key);if(prior)return prior;
    let hash=0xcbf29ce484222325n;
    for(const byte of new TextEncoder().encode(key))hash=BigInt.asUintN(64,(hash^BigInt(byte))*0x100000001b3n);
    const base='ge-'+hash.toString(16).padStart(16,'0'),used=kind==='node'?this.usedNodes:this.usedEdges;
    let id=base;
    for(let suffix=2;used.has(kind==='node'?id:kind+':'+id);suffix++)id=base+'-'+suffix;
    used.add(kind==='node'?id:kind+':'+id);this.assigned.set(key,id);return id;
  }
}
interface Plan {
  operations:GraphOperation[]; variants:Map<string,GraphEdgeRef[]>;
  nodePoints:Map<string,Q.ExactPoint>; newEdges:Map<string,GraphEdge>; removedRooms:Set<string>;
}
function newPlan(graph:PlanGraph):Plan{return{
  operations:[],variants:new Map(),nodePoints:new Map(graph.nodes.map(n=>[n.id,Q.decodePoint(n.p)])),
  newEdges:new Map(graph.edges.map(e=>[edgeKey(e),clone(e)])),removedRooms:new Set(),
};}
function addNode(plan:Plan,id:string,p:Q.ExactPoint):void{
  const old=plan.nodePoints.get(id);
  if(old){if(!Q.pointEq(old,p))failure('node-target',id);return;}
  plan.nodePoints.set(id,p);plan.operations.push({kind:'create-node',node:{id,p:Q.encodePoint(p)}});
}
function unchanged(raw:readonly number[],exact:Q.ExactPoint,original?:readonly number[]):boolean{
  return sameNumbers(raw,Q.pointToNumbers(exact))||sameNumbers(raw,original);
}
/** Resize authors only the changed ordinates. Recovering a near-lattice but
 * unchanged legacy ordinate would bend its fixed outside wall by a few ULPs.
 * The projection-identity tolerance also absorbs preview's *NORM /NORM noise. */
function resizeTarget(raw:readonly number[],point:Q.ExactPoint,original?:readonly number[]):Q.ExactPoint {
  const authored=authoredPoint(raw),before=Q.pointToNumbers(point);
  const same=(a:number,b:number|undefined):boolean=>b!==undefined
    &&Math.abs(a-b)<=0.5000001e-9+Number.EPSILON*32*Math.max(1,Math.abs(a),Math.abs(b));
  return [
    same(raw[0],before[0])||same(raw[0],original?.[0])?point[0]:authored[0],
    same(raw[1],before[1])||same(raw[1],original?.[1])?point[1]:authored[1],
  ];
}
function roomTargets(before:any,draft:any,raw:any,index:ReturnType<typeof graphIndex>,room:string):Map<string,Q.ExactPoint>{
  const cycle=before.plan_graph.rooms.find((r:any)=>r.room===room);if(!cycle)failure('room',room);
  const old=cycle.edges.map((r:any)=>{const e=index.edges.get(edgeKey(r))!;return r.reverse?e.to:e.from;});
  const points=old.map((id:string)=>index.points.get(id)!);
  const target=sourcePoly((draft.rooms||[]).find((r:any)=>r.id===room));
  if(target.length<3)failure('resize-target',room);
  const source=sourcePoly((raw?.rooms||[]).find((r:any)=>r.id===room));
  const result=new Map<string,Q.ExactPoint>();
  if(target.length===old.length){
    old.forEach((id:string,i:number)=>result.set(id,resizeTarget(target[i],points[i],source.length===old.length?source[i]:undefined)));
    return result;
  }
  // Fixed-topology Resize can expose only its real corners; stored run atoms
  // still belong to their exact node IDs and are expanded through this binding.
  const corners=points.flatMap((p:Q.ExactPoint,i:number)=>Q.orientation(points[(i+points.length-1)%points.length],p,points[(i+1)%points.length]).n?[i]:[]);
  const targetExact=target.map(authoredPoint);
  const targetCorners=targetExact.flatMap((p,i)=>Q.orientation(targetExact[(i+target.length-1)%target.length],p,targetExact[(i+1)%target.length]).n?[i]:[]);
  if(corners.length!==targetCorners.length)failure('resize-topology',room);
  for(let run=0;run<corners.length;run++){
    const start=corners[run],end=corners[(run+1)%corners.length];
    const a=resizeTarget(target[targetCorners[run]],points[start],source.length===old.length?source[start]:undefined);
    const b=resizeTarget(target[targetCorners[(run+1)%corners.length]],points[end],source.length===old.length?source[end]:undefined);
    const da=Q.pointSub(a,points[start]),db=Q.pointSub(b,points[end]);
    result.set(old[start],a);
    for(let i=(start+1)%old.length;i!==end;i=(i+1)%old.length)
      result.set(old[i],Q.pointEq(da,db)?Q.pointAdd(points[i],da):points[i]);
  }
  return result;
}
function resizePlan(before:any,draft:any,intent:Extract<GraphEditIntent,{kind:'resize'}>,raw:any,
  graph:PlanGraph,index:ReturnType<typeof graphIndex>,allocation:Allocation,plan:Plan):void{
  const selected=new Set(intent.rooms),targets=new Map<string,Map<string,Q.ExactPoint>>();
  for(const room of selected)for(const[id,p]of roomTargets(before,draft,raw,index,room)){
    const list=targets.get(id)||new Map();list.set(room,p);targets.set(id,list);
  }
  const roomNodes=new Map<string,Map<string,string>>(),groupsByNode=new Map<string,Array<{p:Q.ExactPoint;rooms:string[];id:string}>>();
  for(const[id,uses]of targets){
    const old=index.points.get(id)!,groups:Array<{p:Q.ExactPoint;rooms:string[];id:string}>=[];
    for(const[room,p]of uses){
      let group=groups.find(g=>Q.pointEq(g.p,p));if(!group){group={p,rooms:[],id:''};groups.push(group);}group.rooms.push(room);
    }
    groups.sort((a,b)=>codepoint(a.rooms.slice().sort(codepoint).join('|'),b.rooms.slice().sort(codepoint).join('|')));
    const incident=index.incident.get(id)||[];
    const outside=incident.some(e=>(index.owners.get(edgeKey(e))||[]).length===0
      ||(index.owners.get(edgeKey(e))||[]).some(room=>!selected.has(room)));
    const moveShared=intent.shared===true;
    // A derived T seam may slide on an unchanged, uniform outside run. Keep
    // its identity instead of leaving a second seam a few centimetres behind.
    // An authored corner, independent body or material breakpoint cannot move
    // this way; those still use the explicit incidence settlement below.
    const outsideEdges=incident.filter(e=>(index.owners.get(edgeKey(e))||[]).length===0
      ||(index.owners.get(edgeKey(e))||[]).some(room=>!selected.has(room)));
    const seamMaySlide=(point:Q.ExactPoint):boolean=>{
      if(groups.length!==1||outsideEdges.length!==2)return false;
      if(graph.dependencies.some(d=>d.node!==id&&d.refs.some(r=>r.from===id||r.to===id)))return false;
      const dep=graph.dependencies.find(d=>d.node===id),[a,b]=outsideEdges;
      if(dep?.kind!=='on-edge'||dep.refs.length!==1||a.kind!=='wall'||b.kind!=='wall'
        ||!(index.owners.get(edgeKey(a))||[]).length||!(index.owners.get(edgeKey(b))||[]).length
        ||a.cm!==b.cm||!jsonValueEqual(a.props||null,b.props||null))return false;
      const ends=outsideEdges.map(e=>e.from===id?e.to:e.from);
      if(ends.some(n=>[...(targets.get(n)?.values()||[])].some(p=>!Q.pointEq(p,index.points.get(n)!))))return false;
      const start=index.points.get(ends[0])!,end=index.points.get(ends[1])!;
      if(Q.pointEq(start,end)||Q.orientation(start,end,old).n||Q.orientation(start,end,point).n)return false;
      const t=Q.projectParameter(point,start,end);
      return Q.cmp(t,Q.ZERO)>0&&Q.cmp(t,Q.ONE)<0;
    };
    for(const group of groups){
      const keep=Q.pointEq(group.p,old)||groups.length===1&&(!outside||moveShared)||seamMaySlide(group.p);
      // Meeting the stationary endpoint of our own incident run restores one
      // junction (two T's -> X), not two coincident identities and a zero atom.
      // Never weld an unrelated body merely because its coordinates match.
      const meeting=!Q.pointEq(group.p,old)&&incident.filter(e=>e.kind==='wall').map(e=>e.from===id?e.to:e.from).find(node=>
        Q.pointEq(index.points.get(node)!,group.p)
        &&[...(targets.get(node)?.values()||[])].every(p=>Q.pointEq(p,index.points.get(node)!)));
      group.id=meeting||(keep?id:allocation.id('node',['resize',id,group.rooms.slice().sort(codepoint)]));
      if(group.id!==id)addNode(plan,group.id,group.p);
      for(const room of group.rooms){const map=roomNodes.get(room)||new Map();map.set(id,group.id);roomNodes.set(room,map);}
    }
    groupsByNode.set(id,groups);
    for(const group of groups)if(group.id===id)plan.nodePoints.set(id,group.p);
  }
  const cloneDeps=new Map<string,GraphOperation>();
  for(const[id,groups]of groupsByNode)if(groups.some(g=>g.id!==id)){
    const dep=graph.dependencies.find(d=>d.node===id);
    if(dep&&dep.refs.some(r=>[r.from,r.to].some(node=>!Q.pointEq(index.points.get(node)!,plan.nodePoints.get(node)!))))
      plan.operations.push({kind:'retire-dependency',node:id});
  }
  for(const[id,groups]of groupsByNode)for(const group of groups){
    const old=index.points.get(id)!;
    const dep=graph.dependencies.find(d=>d.node===id);
    if(group.id!==id&&index.nodes.has(group.id))continue; // The meeting endpoint keeps its own dependency.
    if(dep){
      const refs=dep.refs.map(ref=>{
        const map=(node:string)=>group.rooms.map(room=>roomNodes.get(room)?.get(node)).find(Boolean)||node;
        return{from:map(ref.from)!,to:map(ref.to)!};
      });
      const params=refs.map(ref=>Q.projectParameter(group.p,plan.nodePoints.get(ref.from)!,plan.nodePoints.get(ref.to)!));
      if(refs.every((ref,i)=>Q.cmp(params[i],Q.ZERO)>=0&&Q.cmp(params[i],Q.ONE)<=0
          &&Q.pointEq(Q.pointAt(plan.nodePoints.get(ref.from)!,plan.nodePoints.get(ref.to)!,params[i]),group.p))){
        cloneDeps.set(group.id,{kind:'set-dependency',dependency:{node:group.id,kind:dep.kind,refs,parameters:params.map(Q.encodeRational)}});
      }else if(group.id===id)plan.operations.push({kind:'retire-dependency',node:id});
    }
    if(group.id===id&&!Q.pointEq(group.p,old)){
      plan.nodePoints.set(id,group.p);
      if(!cloneDeps.has(id))plan.operations.push({kind:'move-node',node:id,target:Q.encodePoint(group.p),detachDependency:!!dep});
    }
  }
  const roomCycles=new Map<string,Array<GraphEdgeRef&{reverse:boolean}>>();
  const edgeUses=new Map<string,Array<{room:string;from:string;to:string;reverse:boolean}>>();
  for(const cycle of graph.rooms)if(selected.has(cycle.room)){
    for(const reference of cycle.edges){
      const edge=index.edges.get(edgeKey(reference))!,mapping=roomNodes.get(cycle.room)!;
      const list=edgeUses.get(edgeKey(edge))||[];
      list.push({room:cycle.room,from:mapping.get(edge.from)||edge.from,to:mapping.get(edge.to)||edge.to,reverse:reference.reverse});edgeUses.set(edgeKey(edge),list);
    }
    roomCycles.set(cycle.room,[]);
  }
  const refByRoomEdge=new Map<string,GraphEdgeRef>(),vanishing:GraphEdge[]=[];
  for(const[key,uses]of edgeUses){
    const old=index.edges.get(key)!,outside=(index.owners.get(key)||[]).some(room=>!selected.has(room));
    const groups:Array<{from:string;to:string;uses:typeof uses}>=[];
    for(const use of uses){let group=groups.find(g=>g.from===use.from&&g.to===use.to);if(!group){group={from:use.from,to:use.to,uses:[]};groups.push(group);}group.uses.push(use);}
    for(const group of groups){
      // Only the selected owner's vanishing slice disappears; the outside
      // owner still retains the source run until the abandoned seam compacts.
      if(group.from===group.to){if(!outside)vanishing.push(old);continue;}
      const unchanged=group.from===old.from&&group.to===old.to;
      const keep=unchanged||!outside&&groups.length===1;
      const edge:GraphEdge={...clone(old),id:keep?old.id:allocation.id(old.kind,['resize-edge',key,group.uses.map(u=>u.room).sort(codepoint)]),from:group.from,to:group.to};
      if(keep&&!unchanged)plan.operations.push({kind:'retarget-edge',edge:ref(old),from:edge.from,to:edge.to});
      else if(!keep)plan.operations.push({kind:'create-edge',edge});
      plan.newEdges.set(edgeKey(edge),edge);
      const variants=plan.variants.get(key)||[ref(old)];if(!variants.some(v=>edgeKey(v)===edgeKey(edge)))variants.push(ref(edge));plan.variants.set(key,variants);
      for(const use of group.uses)refByRoomEdge.set(JSON.stringify([use.room,key]),ref(edge));
    }
  }
  for(const cycle of graph.rooms)if(selected.has(cycle.room))plan.operations.push({kind:'replace-room-cycle',room:cycle.room,
    edges:cycle.edges.flatMap(e=>{const target=refByRoomEdge.get(JSON.stringify([cycle.room,edgeKey(e)]));
      return target?[{...target,reverse:e.reverse}]:[];})});
  plan.operations.push(...cloneDeps.values());
  for(const removed of vanishing){
    // A disappearing slice between the two meeting T's is absorbed by its
    // continuing source run. Keep the old seam until collapse-node executes,
    // so host lineage and the kernel's dependency checks remain authoritative.
    const moved=[removed.from,removed.to].find(node=>
      [...(roomNodes.values())].some(map=>map.has(node)&&map.get(node)!==node));
    const target=moved&&[...roomNodes.values()].map(map=>map.get(moved)).find(node=>node&&node!==moved);
    const retained=moved&&target&&(index.incident.get(moved)||[]).find(edge=>{
      // Only this zero-length slice disappears. Its material has no extent
      // in the result; the continuing edge retains its own cm/props. Requiring
      // equal material here would block a valid return to a mixed T junction.
      if(edgeKey(edge)===edgeKey(removed)||edge.kind!==removed.kind)return false;
      const next=plan.newEdges.get(edgeKey(edge));
      return next&&[next.from,next.to].includes(target)
        &&!Q.pointEq(plan.nodePoints.get(next.from)!,plan.nodePoints.get(next.to)!)
        &&!Q.orientation(index.points.get(removed.from)!,index.points.get(removed.to)!,
          index.points.get(edge.from===moved?edge.to:edge.from)!).n;
    });
    if(!moved||!target||!retained)failure('resize-collapsed-edge',edgeKey(removed));
    const retarget=plan.operations.find(op=>op.kind==='retarget-edge'&&edgeKey(op.edge)===edgeKey(retained));
    if(!retarget||retarget.kind!=='retarget-edge')failure('resize-collapsed-edge',edgeKey(removed));
    // Keep the continuing edge incident to the abandoned seam until the
    // kernel collapse below. This deliberately restores its original endpoint
    // in the preceding retarget; host lineage still runs through collapse.
    if(retarget.from===target)retarget.from=moved;
    else if(retarget.to===target)retarget.to=moved;
    else failure('resize-collapsed-edge',edgeKey(removed));
    plan.operations.push({kind:'collapse-node',node:moved,retained:ref(retained),removed:ref(removed)});
    plan.newEdges.delete(edgeKey(removed));plan.variants.set(edgeKey(removed),[ref(retained)]);
  }
}
/** Node only the selected Resize's original room-wall incidence/run cohort.
 * A foreign run with no original incidence remains an independent body. */
function settleResizePlan(graph:PlanGraph,index:ReturnType<typeof graphIndex>,rooms:readonly string[],
  allocation:Allocation,plan:Plan):void{
  const selectedRooms=new Set(rooms),origins=new Map<string,Set<string>>();
  for(const edge of graph.edges)origins.set(edgeKey(edge),new Set([edgeKey(edge)]));
  for(const[key,variants]of plan.variants)for(const variant of variants){
    const values=origins.get(edgeKey(variant))||new Set<string>();values.add(key);origins.set(edgeKey(variant),values);
  }
  const owned=graph.edges.filter(e=>e.kind==='wall'&&(index.owners.get(edgeKey(e))||[]).length);
  const roots=new Map(owned.map(e=>[edgeKey(e),edgeKey(e)]));
  const root=(key:string):string=>{const p=roots.get(key);if(!p)return key;if(p===key)return key;const r=root(p);roots.set(key,r);return r;};
  const sameMaterial=(a:GraphEdge,b:GraphEdge)=>a.cm===b.cm&&jsonValueEqual(a.props||null,b.props||null);
  for(const incident of index.incident.values()){
    const walls=incident.filter(e=>roots.has(edgeKey(e)));
    for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
      const a=walls[i],b=walls[j],pa=index.points.get(a.from)!,pb=index.points.get(a.to)!;
      if(!Q.orientation(pa,pb,index.points.get(b.from)!).n&&!Q.orientation(pa,pb,index.points.get(b.to)!).n)
        roots.set(root(edgeKey(b)),root(edgeKey(a)));
    }
  }
  const sourcePairs=(a:string,b:string,predicate:(a:GraphEdge,b:GraphEdge)=>boolean):boolean=>{
    for(const x of origins.get(a)||[])for(const y of origins.get(b)||[]){
      const left=index.edges.get(x),right=index.edges.get(y);
      if(left&&right&&predicate(left,right))return true;
    }
    return false;
  };
  const sameRun=(a:string,b:string)=>sourcePairs(a,b,(x,y)=>roots.has(edgeKey(x))&&roots.has(edgeKey(y))
    &&root(edgeKey(x))===root(edgeKey(y)));
  const incidentBefore=(a:string,b:string)=>sourcePairs(a,b,(x,y)=>[x.from,x.to].some(n=>n===y.from||n===y.to));
  const changed=new Set<string>();
  // An external branch participates in its proved junction. A separate body
  // laid over an existing room wall remains independent (#1264), even if its
  // endpoint happens to share that junction's identity. This also covers
  // unowned contour walls retained by delete-room/keepWalls.
  const branches=new Set(graph.edges.filter(e=>!roots.has(edgeKey(e))&&![e.from,e.to]
    .flatMap(node=>index.incident.get(node)||[]).filter(w=>roots.has(edgeKey(w))).some(w=>{
    const a=index.points.get(e.from)!,b=index.points.get(e.to)!,c=index.points.get(w.from)!,d=index.points.get(w.to)!;
    if(Q.orientation(a,b,c).n||Q.orientation(a,b,d).n)return false;
    const tc=Q.projectParameter(c,a,b),td=Q.projectParameter(d,a,b);
    return Q.cmp(Q.min(Q.ONE,Q.max(tc,td)),Q.max(Q.ZERO,Q.min(tc,td)))>0;
  })).map(edgeKey));
  const edges=[...plan.newEdges.values()].filter(e=>branches.has(edgeKey(e))
    ||[...(origins.get(edgeKey(e))||[])].some(source=>roots.has(source)))
    .sort((a,b)=>codepoint(edgeKey(a),edgeKey(b)));
  for(const edge of edges){
    const key=edgeKey(edge),old=index.edges.get(key);
    const selected=[...(origins.get(key)||[])].some(source=>(index.owners.get(source)||[]).some(room=>selectedRooms.has(room)));
    if(selected&&(!old||old.from!==edge.from||old.to!==edge.to
      ||!Q.pointEq(index.points.get(old.from)!,plan.nodePoints.get(edge.from)!)
      ||!Q.pointEq(index.points.get(old.to)!,plan.nodePoints.get(edge.to)!)))changed.add(key);
  }
  if(!changed.size)return;
  type Cut={t:Q.Exact;node:string};
  const tables=new Map<string,Cut[]>();
  const put=(edge:GraphEdge,node:string):void=>{
    const a=plan.nodePoints.get(edge.from)!,b=plan.nodePoints.get(edge.to)!,point=plan.nodePoints.get(node)!;
    if(Q.orientation(a,b,point).n)return;
    const t=Q.projectParameter(point,a,b);if(Q.cmp(t,Q.ZERO)<=0||Q.cmp(t,Q.ONE)>=0)return;
    const key=edgeKey(edge),cuts=tables.get(key)||[{t:Q.ZERO,node:edge.from},{t:Q.ONE,node:edge.to}];
    const old=cuts.find(c=>Q.eq(c.t,t));if(old&&old.node!==node)failure('resize-incidence-node',node);
    if(!old)cuts.push({t,node});tables.set(key,cuts);
  };
  const selectedIndices=edges.flatMap((edge,i)=>changed.has(edgeKey(edge))?[i]:[]);
  const pairs=function*():Generator<readonly[number,number]>{
    for(let i=0;i<edges.length;i++){
      if(changed.has(edgeKey(edges[i])))for(let j=i+1;j<edges.length;j++)yield[i,j];
      else for(const j of selectedIndices)if(j>i)yield[i,j];
    }
  };
  for(const[i,j]of pairs()){
    const a=edges[i],b=edges[j],ka=edgeKey(a),kb=edgeKey(b);
    if(!sameRun(ka,kb)&&!incidentBefore(ka,kb))continue;
    for(const node of[a.from,a.to])put(b,node);
    for(const node of[b.from,b.to])put(a,node);
  }
  const dependencies=new Map(graph.dependencies.map(d=>[d.node,d]));
  for(const op of plan.operations){
    if(op.kind==='set-dependency')dependencies.set(op.dependency.node,op.dependency);
    else if(op.kind==='retire-dependency'||op.kind==='move-node'&&op.detachDependency)dependencies.delete(op.node);
  }
  const pieces:Array<{edge:GraphEdge;source:string}>=[],bySource=new Map<string,GraphEdge[]>();
  for(const edge of edges){
    const key=edgeKey(edge),cuts=(tables.get(key)||[{t:Q.ZERO,node:edge.from},{t:Q.ONE,node:edge.to}]).sort((a,b)=>Q.cmp(a.t,b.t));
    const children:GraphEdge[]=cuts.slice(0,-1).map((cut,i)=>({...clone(edge),from:cut.node,to:cuts[i+1].node,
      id:i===0?edge.id:allocation.id(edge.kind,['resize-incidence',key,Q.encodeRational(cut.t)])}));
    for(let i=cuts.length-2;i>0;i--){
      plan.operations.push({kind:'insert-on-edge',edge:ref(edge),node:cuts[i].node,
        t:Q.encodeRational(Q.div(cuts[i].t,cuts[i+1].t)),newEdgeId:children[i].id});
      const dependency=dependencies.get(cuts[i].node);
      plan.operations.push(dependency?{kind:'set-dependency',dependency:clone(dependency)}:{kind:'retire-dependency',node:cuts[i].node});
    }
    bySource.set(key,children);
    for(const child of children){plan.newEdges.set(edgeKey(child),child);pieces.push({edge:child,source:key});}
  }
  const outside=(source:string)=>Number((index.owners.get(source)||[]).some(room=>!selectedRooms.has(room)));
  pieces.sort((a,b)=>outside(b.source)-outside(a.source)||Number(index.edges.has(b.source))-Number(index.edges.has(a.source))
    ||codepoint(edgeKey(a.edge),edgeKey(b.edge)));
  const aliases=new Map<string,GraphEdgeRef>(),kept:typeof pieces=[];
  for(const piece of pieces){
    const a=piece.edge,matches=kept.filter(p=>{
      if(!changed.has(piece.source)&&!changed.has(p.source)||!sameRun(piece.source,p.source))return false;
      const b=p.edge;
      return Q.pointEq(plan.nodePoints.get(a.from)!,plan.nodePoints.get(b.from)!)&&Q.pointEq(plan.nodePoints.get(a.to)!,plan.nodePoints.get(b.to)!)
        ||Q.pointEq(plan.nodePoints.get(a.from)!,plan.nodePoints.get(b.to)!)&&Q.pointEq(plan.nodePoints.get(a.to)!,plan.nodePoints.get(b.from)!);
    });
    const target=matches.find(p=>sameMaterial(a,p.edge));
    if(!target&&matches.length)failure('resize-incidence-material',edgeKey(a));
    if(!target){kept.push(piece);continue;}
    plan.operations.push({kind:'convert-edge',edge:ref(a),target:ref(target.edge)});
    aliases.set(edgeKey(a),ref(target.edge));plan.newEdges.delete(edgeKey(a));
  }
  for(const[key,variants]of plan.variants){
    const refs=variants.flatMap(r=>(bySource.get(edgeKey(r))||[r]).map(e=>aliases.get(edgeKey(e))||ref(e)));
    plan.variants.set(key,[...new Map(refs.map(r=>[edgeKey(r),r])).values()]);
  }
}

function legacyPartitionTargets(before:any,draft:any,intent:Extract<GraphEditIntent,{kind:'partitions'}>,source:any,namespace:'wall'|'partition'='partition'):
 {draft:any;intent:Extract<GraphEditIntent,{kind:'partitions'}>}{
  if(!source?.graphMapping)return{draft,intent};
  const index=graphIndex(before.plan_graph),adapted=clone(draft),ids:string[]=[],endpointRefs:Record<string,readonly[TargetPointRef?,TargetPointRef?]>={};
  const field=namespace==='wall'?'wall_segments':'partitions';
  adapted[field]=clone(before[field]||[]);
  for(const id of intent.ids){
    const original=(source[field]||[]).find((p:any)=>p.id===id),ranges=source.graphMapping.edges?.[namespace+':'+id];
    const target=(draft[field]||[]).find((p:any)=>p.id===id);
    if(!original||!ranges?.length){
      ids.push(id);adapted[field]=adapted[field].filter((p:any)=>p.id!==id);
      if(target)adapted[field].push(clone(target));if(intent.endpointRefs?.[id])endpointRefs[id]=intent.endpointRefs[id];continue;
    }
    const reversed=Q.pointCmp(Q.readSourcePoint(original.a),Q.readSourcePoint(original.b))>0;
    const ordered=ranges.slice().sort((a:any,b:any)=>Q.cmp(Q.decodeRational(a.sourceInterval[0]),Q.decodeRational(b.sourceInterval[0])));
    const first=ordered[0],last=ordered[ordered.length-1],fromEdge=index.edges.get(edgeKey(first.ref))!,toEdge=index.edges.get(edgeKey(last.ref))!;
    const from=first.reverse?fromEdge.to:fromEdge.from,to=last.reverse?toEdge.from:toEdge.to;
    const targetA=target&&(reversed?target.b:target.a),targetB=target&&(reversed?target.a:target.b);
    const rawA=reversed?original.b:original.a,rawB=reversed?original.a:original.b;
    const oldA=index.points.get(from)!,oldB=index.points.get(to)!;
    const newA=target&&(sameNumbers(targetA,rawA)?oldA:authoredPoint(targetA));
    const newB=target&&(sameNumbers(targetB,rawB)?oldB:authoredPoint(targetB));
    const da=target&&Q.pointSub(newA!,oldA),db=target&&Q.pointSub(newB!,oldB);
    for(const range of ordered){
      const edge=index.edges.get(edgeKey(range.ref))!;if(!edge||edge.kind!==namespace)failure('legacy-partition-map',id);
      ids.push(edge.id);adapted[field]=adapted[field].filter((p:any)=>p.id!==edge.id);
      if(!target)continue;
      const lo=Q.decodeRational(range.sourceInterval[0]),hi=Q.decodeRational(range.sourceInterval[1]);
      const point=(node:string,t:Q.Exact)=>Q.pointEq(da!,db!)?Q.pointAdd(index.points.get(node)!,da!):Q.pointAt(newA!,newB!,t);
      const a=point(edge.from,range.reverse?hi:lo),b=point(edge.to,range.reverse?lo:hi);
      const meta=(before[field]||[]).find((p:any)=>p.id===edge.id)||{};
      adapted[field].push({...meta,...opaque(target,['id','a','b','cm']),id:edge.id,cm:target.cm,a:Q.pointToNumbers(a),b:Q.pointToNumbers(b)});
      const refs=intent.endpointRefs?.[id];
      if(refs){
        const selected:(TargetPointRef|undefined)[]=[undefined,undefined];
        if(Q.eq(lo,Q.ZERO))selected[range.reverse?1:0]=refs[reversed?1:0];
        if(Q.eq(hi,Q.ONE))selected[range.reverse?0:1]=refs[reversed?0:1];
        endpointRefs[edge.id]=selected as[TargetPointRef?,TargetPointRef?];
      }
    }
  }
  return{draft:adapted,intent:{...intent,ids,endpointRefs}};
}
function partitionPlan(before:any,draft:any,intent:Extract<GraphEditIntent,{kind:'partitions'}>,raw:any,
 graph:PlanGraph,index:ReturnType<typeof graphIndex>,allocation:Allocation,plan:Plan,namespace:'wall'|'partition'='partition'):void{
  const field=namespace==='wall'?'wall_segments':'partitions',selected=new Set(intent.ids.map(id=>namespace+':'+id));
  const desired=new Map<string,Q.ExactPoint[]>(),cohorts=new Map<string,Array<{p:Q.ExactPoint;id:string}>>(),moved=new Set<string>();
  for(const id of intent.ids){
    const edge=index.edges.get(namespace+':'+id),target=(draft[field]||[]).find((p:any)=>p.id===id);if(!edge||!target)continue;
    for(const side of[0,1]as const){
      const node=side?edge.to:edge.from,input=side?target.b:target.a,old=index.points.get(node)!;
      const p=sameNumbers(input,Q.pointToNumbers(old))?old:authoredPoint(input),list=desired.get(node)||[];list.push(p);desired.set(node,list);
    }
  }
  for(const id of [...intent.ids].sort(codepoint)){
    const key=edgeKey({kind:namespace,id}),old=index.edges.get(key),target=(draft[field]||[]).find((p:any)=>p.id===id);
    if(!target){
      if(old){plan.operations.push({kind:'delete-edge',edge:ref(old),removeHosts:(before.openings||[]).filter((o:any)=>o.host&&edgeKey(o.host)===key).map((o:any)=>o.id)});plan.newEdges.delete(key);}
      continue;
    }
    const oldRaw=(raw?.[field]||[]).find((p:any)=>p.id===id),ids:string[]=[];
    for(const side of [0,1]as const){
      const input=side?target.b:target.a,oldNode=old&&(side?old.to:old.from),oldPoint=oldNode&&index.points.get(oldNode);
      const explicit=intent.endpointRefs?.[id]?.[side];
      if(!explicit&&oldNode&&oldPoint&&unchanged(input,oldPoint,oldRaw&&(side?oldRaw.b:oldRaw.a))){ids.push(oldNode);continue;}
      if(explicit){
        if(explicit.kind==='existing-node'){if(!index.nodes.has(explicit.node))failure('node-ref');ids.push(explicit.node);continue;}
        if(explicit.kind==='independent'){addNode(plan,explicit.node,Q.decodePoint(explicit.p));ids.push(explicit.node);continue;}
        if(explicit.kind==='on-edge'){
          plan.operations.push({kind:'insert-on-edge',edge:explicit.edge,t:explicit.t,node:explicit.node,
            newEdgeId:explicit.splitIds[0]||allocation.id(explicit.edge.kind,['partition-split',id,side])});ids.push(explicit.node);continue;
        }
        plan.operations.push({kind:'insert-intersection',refs:explicit.refs,node:explicit.node,
          newEdgeIds:[explicit.splitIds[0][0]||allocation.id(explicit.refs[0].kind,['partition-cross',id,side,0]),
            explicit.splitIds[1][0]||allocation.id(explicit.refs[1].kind,['partition-cross',id,side,1])]});ids.push(explicit.node);continue;
      }
      const p=authoredPoint(input);
      const outside=oldNode&&(index.incident.get(oldNode)||[]).some(e=>!selected.has(edgeKey(e)));
      const sameCohort=oldNode&&(desired.get(oldNode)||[]).every(other=>Q.pointEq(other,p));
      if(oldNode&&!outside&&sameCohort){
        if(!moved.has(oldNode)){plan.operations.push({kind:'move-node',node:oldNode,target:Q.encodePoint(p),detachDependency:true});moved.add(oldNode);}
        plan.nodePoints.set(oldNode,p);ids.push(oldNode);
      }else{
        const groups=oldNode?(cohorts.get(oldNode)||[]):[],existing=groups.find(g=>Q.pointEq(g.p,p));
        const node=existing?.id||allocation.id('node',['segment-cohort',namespace,intent.ids.slice().sort(codepoint),oldNode||id,side,groups.length]);
        if(!existing){groups.push({p,id:node});if(oldNode)cohorts.set(oldNode,groups);addNode(plan,node,p);}ids.push(node);
      }
    }
    const props=opaque(target,['id','a','b','cm']),edge:GraphEdge={id,kind:namespace,from:ids[0],to:ids[1],cm:Number(target.cm),...(props?{props}:{})};
    if(old){
      plan.operations.push({kind:'retarget-edge',edge:ref(old),from:edge.from,to:edge.to},{kind:'set-thickness',edges:[ref(old)],cm:edge.cm});
      // Metadata is deliberately handled by a record replacement after commands.
      if(JSON.stringify(old.props)!==JSON.stringify(props))failure('partition-props-intent',id);
    }else plan.operations.push({kind:'create-edge',edge});
    plan.newEdges.set(key,edge);plan.variants.set(key,[ref(edge)]);
  }
}

function planarizeSegmentTargets(graph:PlanGraph,allocation:Allocation,plan:Plan):void{
  const selected=new Set(plan.operations.flatMap(op=>op.kind==='create-edge'?[edgeKey(op.edge)]:op.kind==='retarget-edge'?[edgeKey(op.edge)]:[]));
  if(!selected.size)return;
  const pending=plan.operations.filter((op):op is Extract<GraphOperation,{kind:'insert-on-edge'}>=>op.kind==='insert-on-edge');
  const pendingCross=plan.operations.filter((op):op is Extract<GraphOperation,{kind:'insert-intersection'}>=>op.kind==='insert-intersection');
  const nodesBefore=new Set(graph.nodes.map(n=>n.id)),created=new Set(plan.operations.flatMap(op=>op.kind==='create-node'?[op.node.id]:[]));
  const prefix:GraphOperation[]=[],tables=new Map<string,Array<{t:Q.Exact;p:Q.ExactPoint;node:string;child?:string}>>();
  const addPoint=(node:string,p:Q.ExactPoint)=>{
    const known=plan.nodePoints.get(node);if(known&&!Q.pointEq(known,p))failure('endpoint-ref-target',node);
    plan.nodePoints.set(node,p);
    if(!nodesBefore.has(node)&&!created.has(node)){prefix.push({kind:'create-node',node:{id:node,p:Q.encodePoint(p)}});created.add(node);}
  };
  const table=(r:GraphEdgeRef):Array<{t:Q.Exact;p:Q.ExactPoint;node:string;child?:string}>=>{
    const key=edgeKey(r),old=tables.get(key);if(old)return old;
    const e=plan.newEdges.get(key)||failure('edge-ref',key),a=plan.nodePoints.get(e.from),b=plan.nodePoints.get(e.to);
    if(!a||!b)failure('unbound-endpoint',key);
    const value=[{t:Q.ZERO,p:a,node:e.from},{t:Q.ONE,p:b,node:e.to}];tables.set(key,value);return value;
  };
  const put=(r:GraphEdgeRef,t:Q.Exact,p:Q.ExactPoint,node:string,child?:string)=>{
    if(Q.cmp(t,Q.ZERO)<=0||Q.cmp(t,Q.ONE)>=0)return;
    addPoint(node,p);const list=table(r),old=list.find(c=>Q.eq(c.t,t));
    if(old){if(old.node!==node)failure('ambiguous-explicit-node');return;}
    list.push({t,p,node,child});
  };
  for(const op of pending){
    const edge=plan.newEdges.get(edgeKey(op.edge))||failure('edge-ref'),t=Q.decodeRational(op.t);
    const p=Q.pointAt(plan.nodePoints.get(edge.from)!,plan.nodePoints.get(edge.to)!,t);
    put(op.edge,t,p,op.node,op.newEdgeId);
  }
  for(const op of pendingCross){
    const[a,b]=op.refs.map(r=>plan.newEdges.get(edgeKey(r))||failure('edge-ref'));
    const hit=Q.intersection(plan.nodePoints.get(a.from)!,plan.nodePoints.get(a.to)!,plan.nodePoints.get(b.from)!,plan.nodePoints.get(b.to)!);
    if(!hit)failure('intersection');put(op.refs[0],hit.t,hit.p,op.node,op.newEdgeIds[0]);put(op.refs[1],hit.u,hit.p,op.node,op.newEdgeIds[1]);
  }
  const pointIds=new Map([...plan.nodePoints].map(([id,p])=>[JSON.stringify(Q.encodePoint(p)),id]));
  const edges=[...plan.newEdges.values()].sort((a,b)=>codepoint(edgeKey(a),edgeKey(b)));
  // Enumerate selected x all, once per unordered pair, in the original
  // lexical (i,j) order. Unrelated pairs are never visited. Rounded exact
  // endpoints give a conservative AABB: monotone nearest rounding cannot
  // separate two exact intervals that overlap.
  const selectedIndices=edges.flatMap((edge,i)=>selected.has(edgeKey(edge))?[i]:[]);
  const boxes=edges.map(edge=>{
    const a=plan.nodePoints.get(edge.from),b=plan.nodePoints.get(edge.to);
    if(!a||!b)failure('unbound-endpoint');
    const pa=Q.pointToNumbers(a),pb=Q.pointToNumbers(b);
    return[Math.min(pa[0],pb[0]),Math.min(pa[1],pb[1]),Math.max(pa[0],pb[0]),Math.max(pa[1],pb[1])];
  });
  const pairs=function*():Generator<readonly[number,number]>{
    for(let i=0;i<edges.length;i++){
      if(selected.has(edgeKey(edges[i])))for(let j=i+1;j<edges.length;j++)yield[i,j];
      else for(const j of selectedIndices)if(j>i)yield[i,j];
    }
  };
  for(const[i,j]of pairs()){
    const ba=boxes[i],bb=boxes[j];
    if(ba[2]<bb[0]||bb[2]<ba[0]||ba[3]<bb[1]||bb[3]<ba[1])continue;
    const a=edges[i],b=edges[j];
    const pa=plan.nodePoints.get(a.from),pb=plan.nodePoints.get(a.to),pc=plan.nodePoints.get(b.from),pd=plan.nodePoints.get(b.to);
    if(!pa||!pb||!pc||!pd)failure('unbound-endpoint');
    const hit=Q.intersection(pa,pb,pc,pd);if(!hit||Q.cmp(hit.t,Q.ZERO)<0||Q.cmp(hit.t,Q.ONE)>0||Q.cmp(hit.u,Q.ZERO)<0||Q.cmp(hit.u,Q.ONE)>0)continue;
    const ai=Q.cmp(hit.t,Q.ZERO)>0&&Q.cmp(hit.t,Q.ONE)<0,bi=Q.cmp(hit.u,Q.ZERO)>0&&Q.cmp(hit.u,Q.ONE)<0;
    if(!ai&&!bi)continue; // Deliberate detached endpoints keep their identities.
    if(!ai&&!selected.has(edgeKey(b))||!bi&&!selected.has(edgeKey(a)))continue;
    const key=JSON.stringify(Q.encodePoint(hit.p));
    const endpoint=!ai?(Q.eq(hit.t,Q.ZERO)?a.from:a.to):!bi?(Q.eq(hit.u,Q.ZERO)?b.from:b.to):undefined;
    const node=endpoint||pointIds.get(key)||allocation.id('node',['segment-intersection',edgeKey(a),edgeKey(b)]);
    pointIds.set(key,node);
    if(ai)put(a,hit.t,hit.p,node);if(bi)put(b,hit.u,hit.p,node);
  }
  const splits:GraphOperation[]=[];
  for(const[key,list]of tables){
    const edge=plan.newEdges.get(key)!,cuts=list.sort((a,b)=>Q.cmp(a.t,b.t));
    for(let i=cuts.length-2;i>0;i--)splits.push({kind:'insert-on-edge',edge:ref(edge),node:cuts[i].node,
      t:Q.encodeRational(Q.div(cuts[i].t,cuts[i+1].t)),newEdgeId:cuts[i].child||allocation.id(edge.kind,['segment-piece',key,i])});
  }
    const selectedNodes=new Set([...selected].flatMap(key=>{const e=plan.newEdges.get(key)!;return[e.from,e.to];}));
  const retired=new Set(plan.operations.flatMap(op=>op.kind==='retire-dependency'?[op.node]:[]));
  for(const dep of graph.dependencies){
    if(selectedNodes.has(dep.node)||retired.has(dep.node))continue;
    const changedSupport=dep.refs.some(r=>[r.from,r.to].some(node=>!Q.pointEq(Q.decodePoint(graph.nodes.find(n=>n.id===node)!.p),plan.nodePoints.get(node)!)));
    if(changedSupport){prefix.push({kind:'retire-dependency',node:dep.node});retired.add(dep.node);}
  }
  plan.operations=[...prefix,...plan.operations.filter(op=>op.kind!=='insert-on-edge'&&op.kind!=='insert-intersection'),...splits];
}
function deleteRoomsPlan(graph:PlanGraph,index:ReturnType<typeof graphIndex>,rooms:readonly string[],keepWalls:boolean,
  retained:Set<string>,allocation:Allocation,plan:Plan,before:any):void{
  const removed=new Set(rooms);
  for(const room of removed){plan.operations.push({kind:'delete-face',room});plan.removedRooms.add(room);}
  const candidates=new Map(graph.rooms.filter(r=>removed.has(r.room)).flatMap(r=>r.edges).map(e=>[edgeKey(e),index.edges.get(edgeKey(e))!]));
  for(const[key,e]of candidates){
    if(retained.has(key)||(index.owners.get(key)||[]).some(owner=>!removed.has(owner)))continue;
    if(keepWalls&&e.cm>0){
      const target:GraphEdgeRef={kind:'partition',id:!plan.newEdges.has('partition:'+e.id)?e.id:allocation.id('partition',['keep-wall',key,rooms])};
      plan.operations.push({kind:'convert-edge',edge:ref(e),target});
      plan.newEdges.delete(key);plan.newEdges.set(edgeKey(target),{...e,...target});plan.variants.set(key,[target]);
    }else{
      plan.operations.push({kind:'delete-edge',edge:ref(e),removeHosts:(before.openings||[]).filter((o:any)=>o.host&&edgeKey(o.host)===key).map((o:any)=>o.id)});
      plan.newEdges.delete(key);
    }
  }
}
interface FaceSupport { edge?:GraphEdge; a:Q.ExactPoint;b:Q.ExactPoint;rawA:number[];rawB:number[];room?:string;slot?:number }
interface FaceLine { room:string;slot:number;a:Q.ExactPoint;b:Q.ExactPoint;support?:FaceSupport;
  cuts:Array<{t:Q.Exact;p:Q.ExactPoint;id?:string}> }
function facePlan(before:any,draft:any,rooms:readonly string[],removeRooms:readonly string[],consumed:readonly string[],
  named:readonly GraphEdgeRef[]|undefined,sourceBefore:any,graph:PlanGraph,index:ReturnType<typeof graphIndex>,
  allocation:Allocation,plan:Plan):Set<string>{
  const authorized=(named||graph.edges.map(ref)).map(r=>index.edges.get(edgeKey(r))||failure('source-edge',edgeKey(r)));
  const consumedSet=new Set(consumed);
  const supports:FaceSupport[]=authorized.flatMap(edge=>{
    const variants:FaceSupport[]=[];
    for(const[sourceKey,ranges]of Object.entries(sourceBefore?.graphMapping?.edges||{})as[string,any[]][]){
      const split=sourceKey.indexOf(':'),kind=sourceKey.slice(0,split),id=sourceKey.slice(split+1);
      const source=(kind==='partition'?sourceBefore?.partitions:sourceBefore?.wall_segments)?.find((e:any)=>e.id===id);
      if(!source)continue;
      let a=Q.readSourcePoint(source.a),b=Q.readSourcePoint(source.b);if(Q.pointCmp(a,b)>0)[a,b]=[b,a];
      for(const range of ranges)if(edgeKey(range.ref)===edgeKey(edge)){
        const lo=Q.pointAt(a,b,Q.decodeRational(range.sourceInterval[0])),hi=Q.pointAt(a,b,Q.decodeRational(range.sourceInterval[1]));
        variants.push({edge,a:index.points.get(edge.from)!,b:index.points.get(edge.to)!,
          rawA:Q.pointToNumbers(range.reverse?hi:lo),rawB:Q.pointToNumbers(range.reverse?lo:hi)});
      }
    }
    if(variants.length)return variants;
    const rawList=edge.kind==='partition'?sourceBefore?.partitions:sourceBefore?.wall_segments;
    const original=(rawList||[]).find((e:any)=>e.id===edge.id);
    return[{edge,a:index.points.get(edge.from)!,b:index.points.get(edge.to)!,
      rawA:original?.a||Q.pointToNumbers(index.points.get(edge.from)!),
      rawB:original?.b||Q.pointToNumbers(index.points.get(edge.to)!)}];
  });
  const numericOn=(p:number[],s:Pick<FaceSupport,'rawA'|'rawB'>):boolean=>{
    const a=s.rawA,b=s.rawB,dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy;
    if(!n)return false;
    const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n;
    return t>=-1e-9&&t<=1+1e-9&&numericNear(p,[a[0]+dx*t,a[1]+dy*t]);
  };
  const supportedSide=(p:number[],q:number[],a:Q.ExactPoint,b:Q.ExactPoint):FaceSupport[]|undefined=>{
    const dx=q[0]-p[0],dy=q[1]-p[1],length2=dx*dx+dy*dy;
    const parameter=(point:number[])=>((point[0]-p[0])*dx+(point[1]-p[1])*dy)/length2;
    const starts=new Set<string>(),ends=new Set<string>();
    for(const[id,point]of index.points){if(Q.pointEq(point,a))starts.add(id);if(Q.pointEq(point,b))ends.add(id);}
    const adjacency=new Map<string,Array<{next:string;support:FaceSupport}>>();
    for(const s of supports){
      if(!numericOn(s.rawA,{rawA:p,rawB:q})||!numericOn(s.rawB,{rawA:p,rawB:q}))continue;
      const forward=parameter(s.rawB)>parameter(s.rawA),backward=parameter(s.rawA)>parameter(s.rawB);
      if(!forward&&!backward)continue;
      const edge=s.edge!,from=forward?edge.from:edge.to,next=forward?edge.to:edge.from;
      const list=adjacency.get(from)||[];
      list.push({next,support:forward?s:{...s,a:s.b,b:s.a,rawA:s.rawB,rawB:s.rawA}});adjacency.set(from,list);
    }
    const dead=new Set<string>(),active=new Set<string>();
    const walk=(node:string):FaceSupport[]|undefined=>{
      if(ends.has(node))return[];
      if(dead.has(node)||active.has(node))return;
      active.add(node);
      const choices=(adjacency.get(node)||[]).sort((a,b)=>Number(a.support.edge!.kind==='partition')-Number(b.support.edge!.kind==='partition')
        ||Number(consumedSet.has(b.support.edge!.id))-Number(consumedSet.has(a.support.edge!.id))
        ||codepoint(edgeKey(a.support.edge!),edgeKey(b.support.edge!)));
      for(const choice of choices){const tail=walk(choice.next);if(tail){active.delete(node);return[choice.support,...tail];}}
      active.delete(node);dead.add(node);return;
    };
    for(const start of starts){const path=walk(start);if(path?.length)return path;}
  };
  const lines:FaceLine[]=[],roomLines=new Map<string,FaceLine[]>();
  for(const id of rooms){
    const room=(draft.rooms||[]).find((r:any)=>r.id===id)||failure('face-room',id),poly=sourcePoly(room);
    if(poly.length<3)failure('face-cycle',id);
    const oldCycle=graph.rooms.find(r=>r.room===id),rawRoom=(sourceBefore?.rooms||[]).find((r:any)=>r.id===id);
    const candidates=poly.map((p:number[],i:number)=>{
      const next=poly[(i+1)%poly.length];
      const list=supports.filter(s=>numericOn(p,s)&&numericOn(next,s));
      const preferredId=room.wall_ids?.[i];
      return list.sort((a,b)=>Number(b.edge?.id===preferredId)-Number(a.edge?.id===preferredId)
        ||Number(a.edge?.kind==='partition')-Number(b.edge?.kind==='partition')
        ||codepoint(a.edge?edgeKey(a.edge):'',b.edge?edgeKey(b.edge):''))[0];
    });
    const exactVertices=poly.map((p:number[],i:number):Q.ExactPoint=>{
      if(oldCycle&&poly.length===oldCycle.edges.length){
        const oldRef=oldCycle.edges[i],e=index.edges.get(edgeKey(oldRef))!,node=oldRef.reverse?e.to:e.from;
        const point=index.points.get(node)!;
        if(unchanged(p,point,sourcePoly(rawRoom)[i]))return point;
      }
      const left=candidates[(i+poly.length-1)%poly.length],right=candidates[i];
      if(left&&right){
        const common=[left.edge!.from,left.edge!.to].find(n=>[right.edge!.from,right.edge!.to].includes(n));
        if(common&&numericNear(p,left.edge!.from===common?left.rawA:left.rawB))return index.points.get(common)!;
        const hit=Q.intersection(left.a,left.b,right.a,right.b);
        if(hit)return hit.p;
      }
      const support=right||left;
      if(support){
        if(numericNear(p,support.rawA))return support.a;
        if(numericNear(p,support.rawB))return support.b;
        const t=Q.projectParameter(authoredPoint(p),Q.readSourcePoint(support.rawA),Q.readSourcePoint(support.rawB));
        if(Q.cmp(t,Q.ZERO)>=0&&Q.cmp(t,Q.ONE)<=0)return Q.pointAt(support.a,support.b,t);
      }
      return authoredPoint(p);
    });
    const own:FaceLine[]=[];
    for(let i=0;i<poly.length;i++){
      // A numeric room face can omit collinear atoms whose exact source points
      // differ below double precision. Follow the connected named source path
      // instead of replacing it with a straight chord through foreign walls.
      const path=supportedSide(poly[i],poly[(i+1)%poly.length],exactVertices[i],exactVertices[(i+1)%poly.length]);
      if(path){
        for(const support of path){
          const line:FaceLine={room:id,slot:i,a:support.a,b:support.b,support,
            cuts:[{t:Q.ZERO,p:support.a},{t:Q.ONE,p:support.b}]};
          own.push(line);lines.push(line);
        }
        continue;
      }
      const line:FaceLine={room:id,slot:i,a:exactVertices[i],b:exactVertices[(i+1)%poly.length],support:candidates[i],
        cuts:[{t:Q.ZERO,p:exactVertices[i]},{t:Q.ONE,p:exactVertices[(i+1)%poly.length]}]};
      if(Q.pointEq(line.a,line.b))failure('face-zero',id);
      own.push(line);lines.push(line);
    }
    roomLines.set(id,own);
  }
  const uniqueSupports=[...new Map(supports.map(s=>[edgeKey(s.edge!),s])).values()];
  const sourceCuts=new Map<string,Array<{t:Q.Exact;p:Q.ExactPoint;id?:string}>>();
  const cutsFor=(s:FaceSupport)=>{
    const key=edgeKey(s.edge!),old=sourceCuts.get(key);
    if(old)return old;
    const cuts=[{t:Q.ZERO,p:s.a,id:s.edge!.from},{t:Q.ONE,p:s.b,id:s.edge!.to}];
    sourceCuts.set(key,cuts);return cuts;
  };
  const add=(list:Array<{t:Q.Exact;p:Q.ExactPoint;id?:string}>,t:Q.Exact,p:Q.ExactPoint,id?:string)=>{
    if(Q.cmp(t,Q.ZERO)<0||Q.cmp(t,Q.ONE)>0)return;
    const existing=list.find(c=>Q.eq(c.t,t));if(existing){if(id)existing.id=id;return;}list.push({t,p,id});
  };
  for(const line of lines)for(const support of uniqueSupports){
    const hit=Q.intersection(line.a,line.b,support.a,support.b);
    if(hit&&Q.cmp(hit.t,Q.ZERO)>=0&&Q.cmp(hit.t,Q.ONE)<=0&&Q.cmp(hit.u,Q.ZERO)>=0&&Q.cmp(hit.u,Q.ONE)<=0){
      const id=Q.eq(hit.u,Q.ZERO)?support.edge!.from:Q.eq(hit.u,Q.ONE)?support.edge!.to:undefined;
      add(line.cuts,hit.t,hit.p,id);add(cutsFor(support),hit.u,hit.p,id);
    }else if(!Q.orientation(support.a,support.b,line.a).n&&!Q.orientation(support.a,support.b,line.b).n){
      for(const[p,id]of [[support.a,support.edge!.from],[support.b,support.edge!.to]]as const)add(line.cuts,Q.projectParameter(p,line.a,line.b),p,id);
      for(const p of [line.a,line.b])add(cutsFor(support),Q.projectParameter(p,support.a,support.b),p);
    }
  }
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const a=lines[i],b=lines[j],hit=Q.intersection(a.a,a.b,b.a,b.b);
    if(hit&&Q.cmp(hit.t,Q.ZERO)>=0&&Q.cmp(hit.t,Q.ONE)<=0
      &&Q.cmp(hit.u,Q.ZERO)>=0&&Q.cmp(hit.u,Q.ONE)<=0){
      add(a.cuts,hit.t,hit.p);add(b.cuts,hit.u,hit.p);
    }
  }
  // All coincident sources need the same atomic cuts. A shorter foreign
  // support can divide the room side even when it does not cross its longer
  // drawn support; otherwise the longer source cannot represent either atom.
  for(const line of lines)for(const support of uniqueSupports)
    if(!Q.orientation(support.a,support.b,line.a).n&&!Q.orientation(support.a,support.b,line.b).n)
      for(const cut of line.cuts)add(cutsFor(support),Q.projectParameter(cut.p,support.a,support.b),cut.p,cut.id);
  const pointIds=new Map<string,string>();
  for(const s of uniqueSupports){pointIds.set(JSON.stringify(Q.encodePoint(s.a)),s.edge!.from);pointIds.set(JSON.stringify(Q.encodePoint(s.b)),s.edge!.to);}
  const nodeFor=(point:Q.ExactPoint,seed:unknown,preferred?:string):string=>{
    const key=JSON.stringify(Q.encodePoint(point)),old=pointIds.get(key);
    const id=preferred||old||allocation.id('node',seed);
    pointIds.set(key,id);addNode(plan,id,point);return id;
  };
  const pieces=new Map<string,Array<{edge:GraphEdge;lo:Q.Exact;hi:Q.Exact}>>();
  for(const support of uniqueSupports){
    const cuts=(sourceCuts.get(edgeKey(support.edge!))||[{t:Q.ZERO,p:support.a,id:support.edge!.from},{t:Q.ONE,p:support.b,id:support.edge!.to}])
      .sort((a,b)=>Q.cmp(a.t,b.t));
    for(const cut of cuts)cut.id=nodeFor(cut.p,['face-source',edgeKey(support.edge!),Q.encodeRational(cut.t)],cut.id);
    const refs:GraphEdge[]=[];
    for(let i=0;i+1<cuts.length;i++){
      const edge:GraphEdge={...clone(support.edge!),id:i===0?support.edge!.id:allocation.id(support.edge!.kind,['face-split',edgeKey(support.edge!),i]),
        from:cuts[i].id!,to:cuts[i+1].id!};
      refs.push(edge);plan.newEdges.set(edgeKey(edge),edge);
    }
    for(let i=cuts.length-2;i>0;i--){
      const node=cuts[i].id!;
      plan.operations.push({kind:'insert-on-edge',edge:ref(support.edge!),node,
        t:Q.encodeRational(Q.div(cuts[i].t,cuts[i+1].t)),newEdgeId:refs[i].id});
      // Reusing a proved source node introduces incidence, not a new position
      // dependency. In particular, an existing endpoint may already support
      // the new edge's start: reversing that relation would create a cycle.
      if(index.nodes.has(node)){
        const dependency=graph.dependencies.find(d=>d.node===node);
        plan.operations.push(dependency?{kind:'set-dependency',dependency:clone(dependency)}
          :{kind:'retire-dependency',node});
      }
    }
    pieces.set(edgeKey(support.edge!),refs.map((edge,i)=>({edge,lo:cuts[i].t,hi:cuts[i+1].t})));
    plan.variants.set(edgeKey(support.edge!),refs.map(ref));
  }
  const retained=new Set<string>(),promoted=new Map<string,GraphEdgeRef>();
  for(const[room,own]of roomLines){
    const cycle:Array<GraphEdgeRef&{reverse:boolean}>=[];
    for(const line of own){
      const cuts=line.cuts.sort((a,b)=>Q.cmp(a.t,b.t));
      for(let i=0;i+1<cuts.length;i++){
        const a=cuts[i],b=cuts[i+1];if(Q.eq(a.t,b.t))continue;
        const from=nodeFor(a.p,['face',room,line.slot,i],a.id),to=nodeFor(b.p,['face',room,line.slot,i+1],b.id);
        // A new divider can be shared by two faces even when it had no source
        // partition. The second cycle must reuse the first cycle's exact wall.
        const available=new Map([...pieces.values()].flat().map(p=>[edgeKey(p.edge),p.edge]as const));
        for(const key of retained){const edge=plan.newEdges.get(key);if(edge)available.set(key,edge);}
        const candidates=[...available.values()].filter(e=>
          Q.pointEq(plan.nodePoints.get(e.from)!,a.p)&&Q.pointEq(plan.nodePoints.get(e.to)!,b.p)
          ||Q.pointEq(plan.nodePoints.get(e.from)!,b.p)&&Q.pointEq(plan.nodePoints.get(e.to)!,a.p))
          .sort((a,b)=>Number(a.kind==='partition')-Number(b.kind==='partition')
            ||Number(b.id===line.support?.edge?.id)-Number(a.id===line.support?.edge?.id)
            ||Number(consumedSet.has(b.id))-Number(consumedSet.has(a.id))||codepoint(edgeKey(a),edgeKey(b)));
        let edge=candidates[0],target:GraphEdgeRef;
        if(edge){
          if(edge.kind==='partition'){
            target=promoted.get(edgeKey(edge))!;
            if(!target){
              target={kind:'wall',id:!plan.newEdges.has('wall:'+edge.id)?edge.id:allocation.id('wall',['face-promote',edgeKey(edge)])};
              plan.operations.push({kind:'convert-edge',edge:ref(edge),target});
              promoted.set(edgeKey(edge),target);plan.newEdges.set(edgeKey(target),{...edge,...target});plan.newEdges.delete(edgeKey(edge));
            }
          }else target=ref(edge);
          cycle.push({...target,reverse:!Q.pointEq(plan.nodePoints.get(edge.from)!,a.p)});retained.add(edgeKey(target));
        }else{
          const id=allocation.id('wall',['face-edge',room,line.slot,i]),points=[Q.pointToNumbers(a.p),Q.pointToNumbers(b.p)];
          const metadata=(draft.wall_segments||[]).find((entry:any)=>entry.id===(draft.rooms||[]).find((r:any)=>r.id===room)?.wall_ids?.[line.slot]);
          const cm=Number(metadata?.cm??thicknessCmAt(draft.walls||[],points[0],points[1],1/240,1));
          const props=opaque(metadata,['id','a','b','cm']);
          edge={kind:'wall',id,from,to,cm,...(props?{props}:{})};target=ref(edge);
          plan.operations.push({kind:'create-edge',edge});plan.newEdges.set(edgeKey(edge),edge);
          cycle.push({...target,reverse:false});retained.add(edgeKey(target));
        }
      }
    }
    plan.operations.push({kind:'replace-room-cycle',room,edges:cycle});
  }
  for(const room of removeRooms)if(!rooms.includes(room)){plan.operations.push({kind:'delete-face',room});plan.removedRooms.add(room);}
  // A drawn interval may overlap another named source. After selecting its
  // room carrier, consume only explicitly accepted, identical unhosted pieces
  // represented by that carrier; preserve tails and independent material.
  for(const id of consumedSet)for(const{edge}of pieces.get('partition:'+id)||[]){
    if(promoted.has(edgeKey(edge))||(before.openings||[]).some((o:any)=>o.host?.kind==='partition'&&o.host.id===id))continue;
    const covered=[...retained].map(key=>plan.newEdges.get(key)!).some(wall=>wall&&wall.cm===edge.cm
      &&JSON.stringify(wall.props||null)===JSON.stringify(edge.props||null)
      &&(Q.pointEq(plan.nodePoints.get(wall.from)!,plan.nodePoints.get(edge.from)!)&&Q.pointEq(plan.nodePoints.get(wall.to)!,plan.nodePoints.get(edge.to)!)
        ||Q.pointEq(plan.nodePoints.get(wall.from)!,plan.nodePoints.get(edge.to)!)&&Q.pointEq(plan.nodePoints.get(wall.to)!,plan.nodePoints.get(edge.from)!)));
    if(covered){plan.operations.push({kind:'delete-edge',edge:ref(edge)});plan.newEdges.delete(edgeKey(edge));}
  }
  return retained;
}
function openingTargets(before:any,draft:any,intent:GraphEditIntent,sourceBefore:any,graph:PlanGraph,
  variants:Map<string,GraphEdgeRef[]>,mapping:GraphMapping,operations:GraphOperation[]):void{
  const index=graphIndex(graph),explicit=new Set(intent.kind==='openings'?intent.ids:[]),oldOpenings=new Map<string,any>((before.openings||[]).map((o:any)=>[o.id,o]));
  for(const opening of draft.openings||[]){
    const old=oldOpenings.get(opening.id),oldHost=old?.host;
    if(explicit.has(opening.id)){
      if(!opening.host){mapping.hosts[opening.id]=null;continue;}
      const candidate=opening.host,changedQ=candidate.tq&&JSON.stringify(candidate.tq)!==JSON.stringify(oldHost?.tq);
      const t=changedQ||candidate.tq&&candidate.t===Q.toNumber(Q.decodeRational(candidate.tq))
        ?Q.decodeRational(candidate.tq):Q.parseDecimal(candidate.t);
      const edge=index.edges.get(edgeKey(candidate));
      let target=t;
      if(edge&&!changedQ&&(!oldHost||edgeKey(oldHost)!==edgeKey(candidate)||candidate.t!==oldHost.t||!sameNumbers([opening.x,opening.y],[old.x,old.y]))&&Number.isFinite(opening.x)&&Number.isFinite(opening.y)){
        const explicitPoint=authoredPoint([opening.x,opening.y]);
        const point=Q.pointAt(index.points.get(edge.from)!,index.points.get(edge.to)!,t);
        target=Q.projectParameter(explicitPoint,index.points.get(edge.from)!,index.points.get(edge.to)!);
        void point;
      }
      const host=canonicalHost(candidate,target);
      if(!index.edges.has(edgeKey(host)))failure('host',opening.id);
      mapping.hosts[opening.id]=host;operations.push({kind:'rehost-opening',opening:opening.id,host:{kind:host.kind,id:host.id,t:host.tq}});continue;
    }
    if(!oldHost)continue;
    const currentHost=mapping.hosts[opening.id]??oldHost;
    if(intent.kind==='resize'){
      const oldIndex=graphIndex(before.plan_graph),oldEdge=oldIndex.edges.get(edgeKey(oldHost))!;
      const oldPoint=Q.pointAt(oldIndex.points.get(oldEdge.from)!,oldIndex.points.get(oldEdge.to)!,rational(oldHost));
      const original=(sourceBefore?.openings||[]).find((o:any)=>o.id===opening.id);
      const input=[Number(opening.x),Number(opening.y)];
      const p=unchanged(input,oldPoint,original&&[original.x,original.y])?oldPoint:authoredPoint(input);
      const candidates=[...new Map([ref(currentHost),...(mapping.edges[edgeKey(oldHost)]||[]).map(range=>range.ref),...(variants.get(edgeKey(oldHost))||[])].map(r=>[edgeKey(r),r])).values()].map(r=>index.edges.get(edgeKey(r))).filter((e):e is GraphEdge=>!!e);
      const choices=candidates.map(edge=>({edge,t:Q.projectParameter(p,index.points.get(edge.from)!,index.points.get(edge.to)!)}))
        .filter(({edge,t})=>Q.cmp(t,Q.ZERO)>=0&&Q.cmp(t,Q.ONE)<=0&&numericNear(input,Q.pointToNumbers(Q.pointAt(index.points.get(edge.from)!,index.points.get(edge.to)!,t))))
        .sort((a,b)=>Q.cmp(Q.squaredDistance(p,Q.pointAt(index.points.get(a.edge.from)!,index.points.get(a.edge.to)!,a.t)),
          Q.squaredDistance(p,Q.pointAt(index.points.get(b.edge.from)!,index.points.get(b.edge.to)!,b.t)))
          ||Number(edgeKey(b.edge)===edgeKey(oldHost))-Number(edgeKey(a.edge)===edgeKey(oldHost))||codepoint(edgeKey(a.edge),edgeKey(b.edge)));
      const selected=choices[0];if(!selected)failure('opening-target',opening.id);
      const host=canonicalHost({...oldHost,...ref(selected.edge)},selected.t);
      mapping.hosts[opening.id]=host;operations.push({kind:'rehost-opening',opening:opening.id,host:{...ref(selected.edge),t:host.tq}});
    }else if(mapping.hosts[opening.id]===undefined)mapping.hosts[opening.id]=clone(oldHost);
  }
}
function metadataStructure(space:any):unknown {
  const graph=space.plan_graph as PlanGraph|undefined;
  const sorted=(entries:any[],key:(entry:any)=>string)=>(entries||[]).slice().sort((a,b)=>codepoint(key(a),key(b)));
  return {
    rooms:sorted(space.rooms,r=>r.id).map(r=>[r.id,sourcePoly(r),r.wall_ids,r.open_to||[]]),
    wall_segments:sorted(space.wall_segments,e=>e.id).map(e=>[e.id,e.a,e.b,e.cm]),
    partitions:sorted(space.partitions,e=>e.id).map(e=>[e.id,e.a,e.b,e.cm]),
    walls:sorted(space.walls,e=>e.key).map(e=>[e.key,e.a,e.b,e.cm]),
    open_spans:space.open_spans||[],
    openings:sorted(space.openings,o=>o.id).map(o=>[o.id,o.host,o.x,o.y,o.angle,o.length]),
    graph:graph&&{...graph,edges:graph.edges.map(({props:_props,...edge})=>edge)},
  };
}
function guardMetadata(before:any,draft:any,sourceBefore?:Record<string,any>):void {
  const actual=contentFingerprint(metadataStructure(draft));
  if(actual!==contentFingerprint(metadataStructure(before))
      &&(!sourceBefore||actual!==contentFingerprint(metadataStructure(sourceBefore))))
    throw new PlanGraphError('projection-only-write');
}
function mergeEdgeMetadata(graph:PlanGraph,before:any,draft:any):PlanGraph {
  const result=clone(graph);
  for(const kind of ['wall','partition'] as const){
    const field=kind==='wall'?'wall_segments':'partitions';
    const old=new Map<string,any>((before[field]||[]).map((e:any)=>[e.id,e]));
    const entries=new Map<string,any>((draft[field]||[]).map((e:any)=>[e.id,e]));
    const proposedGraph=new Map<string,GraphEdge>((draft.plan_graph?.edges||[]).map((e:GraphEdge)=>[edgeKey(e),e]));
    for(const edge of result.edges)if(edge.kind===kind){
      const entry=entries.get(edge.id),previous=old.get(edge.id);
      const props=entry&&opaque(entry,['id','a','b','cm']);
      const previousProps=previous&&opaque(previous,['id','a','b','cm']);
      if(entry&&contentFingerprint(props)!==contentFingerprint(previousProps)){
        if(props)edge.props=props;else delete edge.props;
      }else{
        const proposed=proposedGraph.get(edgeKey(edge));
        if(proposed){if(proposed.props)edge.props=clone(proposed.props);else delete edge.props;}
      }
    }
  }
  return result;
}
/** Compact only seams exposed by this command, without aligning any coordinates.
 * A graph read/save is never permission to sweep another component's old seams. */
function compactEditSeams(graph:PlanGraph,seeds:ReadonlySet<string>,openings:readonly any[],named:ReadonlySet<string>):GraphOperation[]{
  const operations:GraphOperation[]=[],hosts=clone(openings) as any[];
  const pending=[...seeds].sort(codepoint);
  let current=graph,progress=true;
  while(progress){
    progress=false;
    const index=graphIndex(current);
    for(const node of pending){
      const incident=index.incident.get(node);
      if(incident?.length!==2)continue;
      // Properties and physical-selection save guards still name this ID.
      // Retain the explicitly edited carrier before applying a stable tie-break.
      const [a,b]=incident.slice().sort((a,b)=>Number(named.has(edgeKey(b)))-Number(named.has(edgeKey(a)))
        ||codepoint(edgeKey(a),edgeKey(b)));
      if(a.kind!==b.kind||a.cm!==b.cm||!jsonValueEqual(a.props||null,b.props||null))continue;
      if(current.dependencies.some(d=>d.node!==node&&d.refs.some(r=>r.from===node||r.to===node)))continue;
      const owners=(edge:GraphEdge)=>(index.owners.get(edgeKey(edge))||[]).slice().sort(codepoint);
      if(!jsonValueEqual(owners(a),owners(b)))continue;
      const p=index.points.get(node)!,left=index.points.get(a.from===node?a.to:a.from)!,right=index.points.get(b.from===node?b.to:b.from)!;
      if(Q.pointEq(left,right)||Q.orientation(left,p,right).n)continue;
      const t=Q.projectParameter(p,left,right);
      if(Q.cmp(t,Q.ZERO)<=0||Q.cmp(t,Q.ONE)>=0)continue;
      // Distinct node identities can deliberately meet the same physical
      // point. Do not erase a knot that makes another carrier's contact valid.
      if(current.edges.some(edge=>{
        if(edge===a||edge===b)return false;
        const from=index.points.get(edge.from)!,to=index.points.get(edge.to)!;
        if(Q.orientation(from,p,to).n)return false;
        const t=Q.projectParameter(p,from,to);return Q.cmp(t,Q.ZERO)>=0&&Q.cmp(t,Q.ONE)<=0;
      }))continue;
      // A seam inside an opening remains meaningful: its continuous host may
      // span several atoms, so the opening's centre alone is not a safe test.
      if(graphSeamCrossedByOpening(node,[a,b],index,hosts))continue;
      const operation:GraphOperation={kind:'collapse-node',node,retained:ref(a),removed:ref(b)};
      const result=applyGraphOperation(current,operation,{hosts});
      current=result.graph;
      for(const opening of hosts)if(Object.prototype.hasOwnProperty.call(result.mapping.hosts,opening.id)){
        const host=result.mapping.hosts[opening.id];if(host)opening.host=clone(host);else delete opening.host;
      }
      operations.push(operation);progress=true;break;
    }
  }
  return operations;
}
export function commitGraphEditResult<T extends Record<string,any>>(beforeNormalizedSpace:T,draftSpace:T,intent:GraphEditIntent,
  sourceBefore?:Record<string,any>):GraphEditResult<T>{
  assertFiniteColumnInputs(draftSpace);
  const prepared=prepareGraph(beforeNormalizedSpace.plan_graph as PlanGraph),graph=prepared.graph,index=prepared.index;
  const before:any=projectGraphSpace(beforeNormalizedSpace,graph).space,draft:any=clone(draftSpace);
  const allocation=new Allocation(graph),plan=newPlan(graph);
  switch(intent.kind){
    case'metadata':guardMetadata(before,draft,sourceBefore);break;
    case'openings':break;
    case'partitions':{const expanded=legacyPartitionTargets(before,draft,intent,sourceBefore);partitionPlan(before,expanded.draft,expanded.intent,undefined,graph,index,allocation,plan);break;}
    case'segments':{
      for(const namespace of['wall','partition']as const){
        const edges=intent.edges.filter(e=>e.kind===namespace);if(!edges.length)continue;
        const refs=intent.endpointRefs&&Object.fromEntries(edges.map(e=>[e.id,intent.endpointRefs?.[edgeKey(e)]||([undefined,undefined]as const)]));
        const simple:Extract<GraphEditIntent,{kind:'partitions'}>={kind:'partitions',ids:edges.map(e=>e.id),endpointRefs:refs};
        const expanded=legacyPartitionTargets(before,draft,simple,sourceBefore,namespace);
        partitionPlan(before,expanded.draft,expanded.intent,undefined,graph,index,allocation,plan,namespace);
      }
      break;
    }
    case'resize':resizePlan(before,draft,intent,sourceBefore,graph,index,allocation,plan);settleResizePlan(graph,index,intent.rooms,allocation,plan);break;
    case'thickness':{
      const selected=new Map((intent.edges||[]).map(e=>[edgeKey(e),e]));
      for(const room of graph.rooms)if(intent.rooms?.includes(room.room))for(const e of room.edges)selected.set(edgeKey(e),e);
      if(intent.selection){
        const selection=intent.selection,cycle=graph.rooms.find(room=>room.room===selection.room);
        if(!cycle)failure('thickness-room',selection.room);
        const a=Q.readSourcePoint(selection.a),b=Q.readSourcePoint(selection.b),radius=Q.microRadius(Number(before.cell_cm)||5);
        const covered=(point:Q.ExactPoint):boolean=>{
          const t=Q.projectParameter(point,a,b),bounded=Q.cmp(t,Q.ZERO)<0?Q.ZERO:Q.cmp(t,Q.ONE)>0?Q.ONE:t;
          return Q.withinRadius(point,Q.pointAt(a,b,bounded),radius);
        };
        for(const reference of cycle.edges){
          const edge=index.edges.get(edgeKey(reference))!;
          if(covered(index.points.get(edge.from)!)&&covered(index.points.get(edge.to)!))selected.set(edgeKey(edge),ref(edge));
        }
      }
      if(!selected.size)failure('thickness-target');
      plan.operations.push({kind:'set-thickness',edges:[...selected.values()],cm:intent.cm});break;
    }
    case'faces':facePlan(before,draft,intent.rooms,intent.removeRooms||[],intent.consumedPartitionIds||[],intent.sourceEdges,
      sourceBefore,graph,index,allocation,plan);break;
    case'delete-room':deleteRoomsPlan(graph,index,[intent.room],intent.keepWalls,new Set(),allocation,plan,before);break;
    case'merge-rooms':{
      const drop=typeof intent.drop==='string'?[intent.drop]:[...intent.drop];
      const retained=facePlan(before,draft,[intent.keep],drop,[],intent.sourceEdges,sourceBefore,graph,index,allocation,plan);
      // The explicit Merge removes the old internal divider. Keep outer edges
      // and every owner outside this merged set.
      const affected=new Set([intent.keep,...drop]);
      const candidates=new Map(graph.rooms.filter(r=>affected.has(r.room)).flatMap(r=>r.edges).map(e=>[edgeKey(e),index.edges.get(edgeKey(e))!]));
      for(const[key,e]of candidates)if(!retained.has(key)&&!(index.owners.get(key)||[]).some(r=>!affected.has(r))){
        plan.operations.push({kind:'delete-edge',edge:ref(e),removeHosts:(before.openings||[]).filter((o:any)=>o.host&&edgeKey(o.host)===key).map((o:any)=>o.id)});
      }
      break;
    }
    default:{const exhaustive:never=intent;failure('intent',String(exhaustive));}
  }
  if(intent.kind==='partitions'||intent.kind==='segments')planarizeSegmentTargets(graph,allocation,plan);
  let result=plan.operations.length?applyGraphOperation(graph,{kind:'batch',operations:plan.operations},{hosts:before.openings||[]})
    :{graph,mapping:emptyMapping()};
  // A live Draw chain still names the last created endpoint for its next click;
  // its own finish already compacts creation seams. Detach/delete are complete
  // edits and can compact their abandoned incidence immediately.
  const compact=intent.kind==='partitions'||intent.kind==='segments'
    ?plan.operations.some(op=>op.kind==='retarget-edge'||op.kind==='delete-edge')
    :['resize','faces','delete-room','merge-rooms','thickness'].includes(intent.kind);
  if(compact&&plan.operations.length){
    const nextIndex=graphIndex(result.graph),seeds=new Set<string>();
    for(const operation of plan.operations){
      if(operation.kind==='create-node')seeds.add(operation.node.id);
      if(operation.kind==='move-node')seeds.add(operation.node);
      if('edge'in operation){
        for(const model of[index,nextIndex]){
          const edge=model.edges.get(edgeKey(operation.edge));if(edge){seeds.add(edge.from);seeds.add(edge.to);}
        }
      }
      if(operation.kind==='set-thickness')for(const ref of operation.edges){
        const edge=nextIndex.edges.get(edgeKey(ref));if(edge){seeds.add(edge.from);seeds.add(edge.to);}
      }
      if(operation.kind==='replace-room-cycle'||operation.kind==='delete-face'){
        for(const model of[graph,result.graph])for(const cycle of model.rooms)if(cycle.room===operation.room)
          for(const ref of cycle.edges){const edge=(model===graph?index:nextIndex).edges.get(edgeKey(ref))!;seeds.add(edge.from);seeds.add(edge.to);}
      }
    }
    const hosts=(before.openings||[]).flatMap((opening:any)=>{
      const host=Object.prototype.hasOwnProperty.call(result.mapping.hosts,opening.id)?result.mapping.hosts[opening.id]:opening.host;
      return host?[{...opening,host}]:[];
    });
    const named=new Set<string>(intent.kind==='partitions'?intent.ids.map(id=>'partition:'+id)
      :intent.kind==='segments'?intent.edges.map(edgeKey):intent.kind==='thickness'?(intent.edges||[]).map(edgeKey):[]);
    const cleanup=compactEditSeams(result.graph,seeds,hosts,named);
    if(cleanup.length){
      plan.operations.push(...cleanup);
      result=applyGraphOperation(graph,{kind:'batch',operations:plan.operations},{hosts:before.openings||[]});
    }
  }
  if(intent.kind==='metadata')result.graph=mergeEdgeMetadata(result.graph,before,draft);
  const operations=plan.operations.slice(),mapping=result.mapping;
  openingTargets(before,draft,intent,sourceBefore,result.graph,plan.variants,mapping,operations);
  const metadata=new Map<string,any>((before.rooms||[]).map((r:any)=>[r.id,r]));
  for(const room of draft.rooms||[])metadata.set(room.id,{...(metadata.get(room.id)||{}),...room});
  draft.rooms=[...metadata.values()];
  for(const opening of draft.openings||[])if(Object.prototype.hasOwnProperty.call(mapping.hosts,opening.id)){
    const host=mapping.hosts[opening.id];if(host)opening.host=clone(host);else delete opening.host;
  }
  const projected=projectGraphSpace(draft,result.graph);
  if(intent.kind!=='metadata'){
    const previousOpenings=new Map<string,any>((before.openings||[]).map((o:any)=>[o.id,o]));
    const current=prepareGraph(result.graph).index;
    for(const opening of (projected.space as any).openings||[]){
      if(!opening.host)continue;
      const edge=current.edges.get(edgeKey(opening.host));if(!edge)continue;
      const previous=previousOpenings.get(opening.id),old=previous?.host&&index.edges.get(edgeKey(previous.host));
      const explicit=intent.kind==='openings'&&intent.ids.includes(opening.id);
      if(!previous||explicit||!old||edgeKey(old)!==edgeKey(edge)
          ||!Q.pointEq(index.points.get(old.from)!,current.points.get(edge.from)!)
          ||!Q.pointEq(index.points.get(old.to)!,current.points.get(edge.to)!))
        opening.angle=Q.projectedAxisAngle(current.points.get(edge.from)!,current.points.get(edge.to)!);
    }
  }
  let resizeWallRecords:GraphWallRecordProof|undefined;
  if(intent.kind==='resize'){
    const actual=new Set(result.graph.edges.map(edgeKey)),descendants:Record<string,string[]>=Object.create(null);
    for(const edge of graph.edges){
      const key=edgeKey(edge);
      descendants[key]=[...new Set([key,...(mapping.edges[key]||[]).map(r=>edgeKey(r.ref)),
        ...(plan.variants.get(key)||[]).map(edgeKey)])].filter(key=>actual.has(key));
    }
    resizeWallRecords={before:graph.edges,after:result.graph.edges,descendants};
  }
  return{space:projected.space as T,graph:result.graph,mapping,operations,...(resizeWallRecords?{resizeWallRecords}:{})};
}
export function commitGraphEdit<T extends Record<string,any>>(beforeNormalizedSpace:T,draftSpace:T,intent:GraphEditIntent,
  sourceBefore?:Record<string,any>):T{
  return commitGraphEditResult(beforeNormalizedSpace,draftSpace,intent,sourceBefore).space;
}
