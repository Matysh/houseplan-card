/** One bounded, aperture-free view of canonical material domains. All gesture
 * adapters enter here; no room insets or independent length formulas. */
import {directStructure} from './direct-wall-geometry';
import * as A from './wall-arrangement';
import {columnBody} from './physical-geometry';
import {GRID_PITCH,GRID_STEP_N,NORM_W} from './canvas-constants';
import {roomPoly} from './logic';
import {thicknessCmAt} from './wall-thickness';
import type {NodeMoveSpace} from './wall-node-move';
import type {WallColumnCfg} from './types';
import {decodePoint,pointToNumbers} from './plan-exact';
import type {PlanGraph} from './plan-graph';
import {resolveWallSideDimensions,type DimensionCarrier,type DimensionGeometry,type DimensionInterval} from './wall-side-dimensions';

export interface WallDimensionModel {
  intervals: readonly DimensionInterval[]; epsilonCm: number;
  carriers: readonly DimensionCarrier[];
}
type Box=readonly [number,number,number,number];
const overlaps=(a:Box,b:Box):boolean=>a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3];
const wallBox=(w:DimensionCarrier,pad=0):Box=>[Math.min(w.a[0],w.b[0])-pad,Math.min(w.a[1],w.b[1])-pad,
  Math.max(w.a[0],w.b[0])+pad,Math.max(w.a[1],w.b[1])+pad];
export const dimensionWallId=(wall:{kind:string;id:string}):string=>`${wall.kind}:${wall.id}`;
const graphCarriers=new WeakMap<PlanGraph,DimensionCarrier[]>();

/** Complete nearby room cycles preserve facade ownership/tapers. One finite
 * incidence halo preserves their end joints; it does not flood-fill connected
 * rooms/walls. Remote records never enter the exact material producer. */
function localDimensionGraph(graph:PlanGraph,supports:readonly DimensionCarrier[],boxes:readonly Box[]):PlanGraph {
  const byId=new Map(supports.map(w=>[w.id,w]));
  const ids=new Set(supports.filter(w=>boxes.some(box=>overlaps(box,wallBox(w)))).map(w=>w.id));
  const rooms=graph.rooms.filter(room=>{
    const walls=room.edges.map(ref=>byId.get(dimensionWallId(ref))).filter((w):w is DimensionCarrier=>!!w);
    if(!walls.length)return false;
    const bounds:Box=[Math.min(...walls.flatMap(w=>[w.a[0],w.b[0]])),Math.min(...walls.flatMap(w=>[w.a[1],w.b[1]])),
      Math.max(...walls.flatMap(w=>[w.a[0],w.b[0]])),Math.max(...walls.flatMap(w=>[w.a[1],w.b[1]]))];
    return boxes.some(box=>overlaps(box,bounds));
  });
  for(const room of rooms)for(const ref of room.edges)ids.add(dimensionWallId(ref));
  const ends=new Set(graph.edges.filter(edge=>ids.has(dimensionWallId(edge))).flatMap(edge=>[edge.from,edge.to]));
  const edges=graph.edges.filter(edge=>ids.has(dimensionWallId(edge))||ends.has(edge.from)||ends.has(edge.to));
  const nodes=new Set(edges.flatMap(edge=>[edge.from,edge.to]));
  return {...graph,edges,rooms,nodes:graph.nodes.filter(node=>nodes.has(node.id)),
    dependencies:graph.dependencies.filter(d=>nodes.has(d.node)&&d.refs.every(ref=>nodes.has(ref.from)&&nodes.has(ref.to)))};
}

export function dimensionCarriers(space:NodeMoveSpace):DimensionCarrier[] {
  // Read accepted records directly. Importing the Select command subsystem
  // here would invert its lazy boundary and change the editor retry facade.
  if(space.plan_graph) {
    const graph=space.plan_graph,old=graphCarriers.get(graph);if(old)return old;
    const points=new Map(graph.nodes.map(node=>[node.id,pointToNumbers(decodePoint(node.p))]));
    const carriers:DimensionCarrier[]=graph.edges.map(edge=>{
      const a=points.get(edge.from),b=points.get(edge.to);
      return{id:dimensionWallId(edge),cm:edge.cm,ends:[edge.from,edge.to],a:a?[a[0]*NORM_W,a[1]*NORM_W]:[NaN,NaN],
        b:b?[b[0]*NORM_W,b[1]*NORM_W]:[NaN,NaN]};
    });
    graphCarriers.set(graph,carriers);return carriers;
  }
  const records=[...(space.wall_segments||[]).map(w=>({...w,kind:'wall'})),
    ...(space.partitions||[]).map(w=>({...w,kind:'partition'}))];
  const carriers:DimensionCarrier[]=records.map(wall=>({id:dimensionWallId(wall),cm:wall.cm,
    a:[wall.a[0]*NORM_W,wall.a[1]*NORM_W],b:[wall.b[0]*NORM_W,wall.b[1]*NORM_W]}));
  // Existing pre-catalogue rooms remain readable without invoking migration
  // or manufacturing saved identities. Their axis fallback is explicit.
  if(!space.wall_segments?.length&&!space.plan_graph) {
    const seen=new Set<string>();
    for(const room of [...space.rooms].sort((a,b)=>String(a.id||'').localeCompare(String(b.id||'')))) {
      const poly=roomPoly(room);
      if(!room.id||!poly)continue;
      for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length];
        if(Math.hypot(b[0]-a[0],b[1]-a[1])<=1e-9)continue;
        const key=JSON.stringify([a,b].sort((p,q)=>p[0]-q[0]||p[1]-q[1]));
        if(seen.has(key))continue;seen.add(key);
        carriers.push({id:`legacy:${room.id}:${i}`,cm:thicknessCmAt(space.walls,a,b,GRID_STEP_N),
          a:[a[0]*NORM_W,a[1]*NORM_W],b:[b[0]*NORM_W,b[1]*NORM_W]});
      }
    }
  }
  return carriers;
}

/** Candidate membership, not rounded values. Far unchanged carriers never
 * enter the measurement arrangement just because their room owns a moved wall. */
export function affectedDimensionCarriers(before:NodeMoveSpace,candidate:NodeMoveSpace):string[] {
  const a=dimensionCarriers(before),b=dimensionCarriers(candidate),previous=new Map(a.map(w=>[w.id,w]));
  const changed=b.filter(w=>{
    const old=previous.get(w.id);
    return !old || old.cm!==w.cm || old.a.some((x,i)=>x!==w.a[i]) || old.b.some((x,i)=>x!==w.b[i]);
  });
  const nextIds=new Set(b.map(w=>w.id));
  const removed=a.filter(w=>!nextIds.has(w.id));
  const cm=Number(candidate.cell_cm)||5,perUnitCm=cm/GRID_PITCH;
  const pad=Math.max(0,...a.map(w=>w.cm),...b.map(w=>w.cm))/perUnitCm*4;
  const boxes=[...changed,...removed,...a.filter(w=>changed.some(c=>c.id===w.id))].map(w=>wallBox(w,pad));
  return [...new Set([...a,...b].filter(w=>boxes.some(box=>overlaps(box,wallBox(w)))).map(w=>w.id))].sort();
}

/** Geometry cache is owned by one editor and one immutable graph identity.
 * Pan/zoom, translations of labels, language and HA state are not inputs. */
export class WallDimensionGeometry {
  private cache=new WeakMap<object,Map<string,WallDimensionModel>>();
  private localCache=new Map<string,WallDimensionModel>();
  public builds=0;
  constructor(private readonly structure:typeof directStructure=directStructure) {}
  read(space:NodeMoveSpace,ids:readonly string[]):WallDimensionModel {
    const perUnitCm=(Number(space.cell_cm)||5)/GRID_PITCH;
    const supports=dimensionCarriers(space);
    const key=JSON.stringify([perUnitCm,[...ids].sort(),space.wall_columns||[],space.plan_graph?null:supports]);
    const identity=space.plan_graph||space;
    let entries=this.cache.get(identity);
    if(!entries){entries=new Map();this.cache.set(identity,entries);}
    const cached=entries.get(key);if(cached)return cached;
    const wanted=new Set(ids),carriers=supports.filter(w=>wanted.has(w.id));
    const pad=Math.max(0,...supports.map(w=>w.cm))/perUnitCm*4;
    const boxes=carriers.map(w=>wallBox(w,pad));
    const graph=space.plan_graph&&localDimensionGraph(space.plan_graph,supports,boxes);
    const columns=((Array.isArray(space.wall_columns)?space.wall_columns:[]) as WallColumnCfg[]).filter(column=>{
      const [x,y]=column.center.map(value=>value*NORM_W),radius=column.cm/perUnitCm;
      return boxes.some(box=>overlaps(box,[x-radius,y-radius,x+radius,y+radius]));
    });
    const localKey=JSON.stringify([perUnitCm,[...ids].sort(),graph||carriers,columns]);
    let result=this.localCache.get(localKey);
    if(result){entries.set(key,result);return result;}
    this.builds++;
    let geometry:DimensionGeometry['geometry']=[],materials:DimensionGeometry['materials']=[],epsilon=1e-9;
    if(graph && carriers.length) {
      try {
        const structure=this.structure({graph,scale:NORM_W},Number(space.cell_cm)||5,GRID_PITCH);
        epsilon=Math.max(structure.nodes.epsilon,1e-9);
        const local=structure.materials.filter(m=>boxes.some(box=>overlaps(box,A.bounds(m.poly))));
        const columnMaterials=columns.flatMap(column=>{
          const body=columnBody({...column,center:[column.center[0]*NORM_W,column.center[1]*NORM_W]},
            Number(space.cell_cm)||5,GRID_PITCH);
          const poly=A.polygon(body);
          return boxes.some(box=>overlaps(box,A.bounds(poly)))?[{owners:[`column:${column.id}`],poly}]:[];
        });
        // Same finite, trimmed production domains, before ALL aperture cuts.
        // This is a bounded neighborhood, never a second full-floor union.
        const arranged=A.arrangeComponents([...local.map(m=>m.poly),...columnMaterials.map(m=>m.poly)],structure.componentCache);
        if(!arranged.failures){
          geometry=arranged.geom;
          materials=[...local,...columnMaterials].map(m=>({owners:m.owners,poly:m.poly.map(A.pointNumbers)}));
        }
      }catch { /* Unsupported legacy/failed proof remains an explicit axis fallback. */ }
    }
    const localIds=graph&&new Set(graph.edges.map(dimensionWallId));
    result={carriers,epsilonCm:epsilon*perUnitCm,
      intervals:resolveWallSideDimensions({carriers,supports:localIds?supports.filter(w=>localIds.has(w.id)):supports,
        geometry,materials,perUnitCm,epsilon})};
    entries.set(key,result);
    if(entries.size>8)entries.delete(entries.keys().next().value!);
    this.localCache.set(localKey,result);
    if(this.localCache.size>16)this.localCache.delete(this.localCache.keys().next().value!);
    return result;
  }
  clear():void {this.cache=new WeakMap();this.localCache.clear();}
}
