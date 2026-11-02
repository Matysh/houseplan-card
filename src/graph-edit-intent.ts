/** Client-only bridge from an explicitly named editor intent to exact graph commands. */
import {
  type PlanGraph, type GraphEdgeRef, type GraphEdge, type GraphOperation, type GraphMapping,
  type TargetPointRef, type GraphPoint, graphIndex, edgeKey, validateGraph, prepareGraph,
  applyGraphOperation, projectGraphSpace, PlanGraphError,
} from './plan-graph';
import * as Q from './plan-exact';
import { wallKey, thicknessCmAt } from './wall-thickness';
import { compareCodePoints } from './codepoint-order';
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
export interface GraphEditResult<T> { space: T; graph: PlanGraph; mapping: GraphMapping; operations: GraphOperation[] }
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const ref=(edge:GraphEdgeRef):GraphEdgeRef=>({kind:edge.kind,id:edge.id});
const sameNumbers=(a:readonly number[]|undefined,b:readonly number[]|undefined):boolean=>
  !!a&&!!b&&a.length===2&&b.length===2&&a[0]===b[0]&&a[1]===b[1];
function failure(code:string,subject=''):never{throw new PlanGraphError('edit-'+code,subject);}
const codepoint=compareCodePoints;
const rational=(host:any):Q.Exact=>host.tq?Q.decodeRational(host.tq):Q.parseDecimal(host.t);
const canonicalHost=(host:any,t:Q.Exact):any=>({...host,tq:Q.encodeRational(t),t:Q.toNumber(t)});
const emptyMapping=():GraphMapping=>({nodes:Object.create(null),edges:Object.create(null),hosts:Object.create(null)});
/** Decode a UI lattice projection only when it is the identical IEEE754 value. */
function authoredPoint(input:readonly number[]):Q.ExactPoint {
  const p=Q.readSourcePoint(input);
  const decodeAxis=(q:Q.Exact,n:number):Q.Exact=>{
    const grid=Q.exact(Q.nearestInteger(Q.mul(q,Q.exact(240n))),240n);
    return Q.toNumber(grid)===n?grid:q;
  };
  return[decodeAxis(p[0],input[0]),decodeAxis(p[1],input[1])];
}
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
function roomTargets(before:any,draft:any,raw:any,index:ReturnType<typeof graphIndex>,room:string):Map<string,Q.ExactPoint>{
  const cycle=before.plan_graph.rooms.find((r:any)=>r.room===room);if(!cycle)failure('room',room);
  const old=cycle.edges.map((r:any)=>{const e=index.edges.get(edgeKey(r))!;return r.reverse?e.to:e.from;});
  const points=old.map((id:string)=>index.points.get(id)!);
  const target=sourcePoly((draft.rooms||[]).find((r:any)=>r.id===room));
  if(target.length<3)failure('resize-target',room);
  const source=sourcePoly((raw?.rooms||[]).find((r:any)=>r.id===room));
  const result=new Map<string,Q.ExactPoint>();
  if(target.length===old.length){
    old.forEach((id:string,i:number)=>result.set(id,unchanged(target[i],points[i],source.length===old.length?source[i]:undefined)?points[i]:authoredPoint(target[i])));
    return result;
  }
  // Fixed-topology Resize can expose only its real corners; stored run atoms
  // still belong to their exact node IDs and are expanded through this binding.
  const corners=points.flatMap((p:Q.ExactPoint,i:number)=>Q.orientation(points[(i+points.length-1)%points.length],p,points[(i+1)%points.length]).n?[i]:[]);
  const targetExact=target.map(authoredPoint);
  const targetCorners=targetExact.flatMap((p,i)=>Q.orientation(targetExact[(i+target.length-1)%target.length],p,targetExact[(i+1)%target.length]).n?[i]:[]);
  if(corners.length!==targetCorners.length)failure('resize-topology',room);
  for(let run=0;run<corners.length;run++){
    const start=corners[run],end=corners[(run+1)%corners.length],a=targetExact[targetCorners[run]],b=targetExact[targetCorners[(run+1)%corners.length]];
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
    for(const group of groups){
      const keep=Q.pointEq(group.p,old)||groups.length===1&&(!outside||moveShared);
      group.id=keep?id:allocation.id('node',['resize',id,group.rooms.slice().sort(codepoint)]);
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
  const refByRoomEdge=new Map<string,GraphEdgeRef>();
  for(const[key,uses]of edgeUses){
    const old=index.edges.get(key)!,outside=(index.owners.get(key)||[]).some(room=>!selected.has(room));
    const groups:Array<{from:string;to:string;uses:typeof uses}>=[];
    for(const use of uses){let group=groups.find(g=>g.from===use.from&&g.to===use.to);if(!group){group={from:use.from,to:use.to,uses:[]};groups.push(group);}group.uses.push(use);}
    for(const group of groups){
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
    edges:cycle.edges.map(e=>({...refByRoomEdge.get(JSON.stringify([cycle.room,edgeKey(e)]))!,reverse:e.reverse}))});
  plan.operations.push(...cloneDeps.values());
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
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const a=edges[i],b=edges[j];if(!selected.has(edgeKey(a))&&!selected.has(edgeKey(b)))continue;
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
  const numericOn=(p:number[],s:FaceSupport):boolean=>{
    const a=s.rawA,b=s.rawB,dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy;
    if(!n)return false;
    const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/n;
    return t>=-1e-9&&t<=1+1e-9&&numericNear(p,[a[0]+dx*t,a[1]+dy*t]);
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
    if(hit){add(a.cuts,hit.t,hit.p);add(b.cuts,hit.u,hit.p);}
  }
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
    for(let i=cuts.length-2;i>0;i--)plan.operations.push({kind:'insert-on-edge',edge:ref(support.edge!),node:cuts[i].id!,
      t:Q.encodeRational(Q.div(cuts[i].t,cuts[i+1].t)),newEdgeId:refs[i].id});
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
        const candidates=[...pieces.values()].flat().map(p=>p.edge).filter(e=>
          Q.pointEq(plan.nodePoints.get(e.from)!,a.p)&&Q.pointEq(plan.nodePoints.get(e.to)!,b.p)
          ||Q.pointEq(plan.nodePoints.get(e.from)!,b.p)&&Q.pointEq(plan.nodePoints.get(e.to)!,a.p))
          .sort((a,b)=>Number(a.kind==='partition')-Number(b.kind==='partition')||codepoint(edgeKey(a),edgeKey(b)));
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
  // Consumed named partitions are promoted exactly where the new cycles use
  // them; unrelated branches remain ordinary independent physical walls.
  void consumedSet;return retained;
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
      const candidates=(variants.get(edgeKey(oldHost))||[ref(currentHost)]).map(r=>index.edges.get(edgeKey(r))).filter((e):e is GraphEdge=>!!e);
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
export function commitGraphEditResult<T extends Record<string,any>>(beforeNormalizedSpace:T,draftSpace:T,intent:GraphEditIntent,
  sourceBefore?:Record<string,any>):GraphEditResult<T>{
  const prepared=prepareGraph(beforeNormalizedSpace.plan_graph as PlanGraph),graph=prepared.graph,index=prepared.index;
  const before:any=projectGraphSpace(beforeNormalizedSpace,graph).space,draft:any=clone(draftSpace);
  const allocation=new Allocation(graph),plan=newPlan(graph);
  switch(intent.kind){
    case'metadata':case'openings':break;
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
    case'resize':resizePlan(before,draft,intent,sourceBefore,graph,index,allocation,plan);break;
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
  const result=plan.operations.length?applyGraphOperation(graph,{kind:'batch',operations:plan.operations},{hosts:before.openings||[]})
    :{graph,mapping:emptyMapping()};
  const operations=plan.operations.slice(),mapping=result.mapping;
  openingTargets(before,draft,intent,sourceBefore,result.graph,plan.variants,mapping,operations);
  const metadata=new Map<string,any>((before.rooms||[]).map((r:any)=>[r.id,r]));
  for(const room of draft.rooms||[])metadata.set(room.id,{...(metadata.get(room.id)||{}),...room});
  draft.rooms=[...metadata.values()];
  for(const opening of draft.openings||[])if(Object.prototype.hasOwnProperty.call(mapping.hosts,opening.id)){
    const host=mapping.hosts[opening.id];if(host)opening.host=clone(host);else delete opening.host;
  }
  const projected=projectGraphSpace(draft,result.graph);
  return{space:projected.space as T,graph:result.graph,mapping,operations};
}
export function commitGraphEdit<T extends Record<string,any>>(beforeNormalizedSpace:T,draftSpace:T,intent:GraphEditIntent,
  sourceBefore?:Record<string,any>):T{
  return commitGraphEditResult(beforeNormalizedSpace,draftSpace,intent,sourceBefore).space;
}
