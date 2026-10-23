/** Flat derived layout. Reference faces survive live values, never integrate drift. */
import {
  CONTACT_EPS, contactAtCorner, contactAtWall, contactBoxIn, contactContourShapes, contactCoresOverlap, contactRotate,
  contactShapeJoinDepth, deriveContactShape, joinedContactSide, rotatedContactCapsule,
  type ContactMarker, type ContactShape, type ContactWall,
} from './device-contact-geometry';
import {sameContactRect} from './device-contact-basis';
import {contactBounds,DeviceContactScene} from './device-contact-scene';
import {contactIntersectsMasonry} from './device-contact-collision';
import type {ContactMasonry} from './device-contact-walls';

const near=(a:number,b:number)=>Math.abs(a-b)<=CONTACT_EPS;
const unchanged=(a:ContactMarker,b:ContactMarker)=>a.diameter===b.diameter&&sameContactRect(a.box,b.box);
function template(marker:ContactMarker,reference:ContactShape):ContactShape {
  const angle=reference.angle, wall=Object.keys(reference.walls).length>0;
  const box=rotatedContactCapsule(marker.box,angle,wall?marker.diameter*.009375:0);
  return {marker,angle,box,walls:{...reference.walls},
    radius:Math.min(marker.diameter*(wall?.64375:.634375),(box.right-box.left)/2,(box.bottom-box.top)/2)};
}
function anchored(shape:ContactShape,walls:readonly ContactWall[]):ContactShape {
  const ids=Object.values(shape.walls),faces=walls.filter(w=>ids.includes(w.id));
  const candidates=[...contactAtCorner(shape.marker,faces),...faces.flatMap(w=>contactAtWall(shape.marker,w))];
  candidates.sort((a,b)=>Object.keys(b.shape.walls).length-Object.keys(a.shape.walls).length
    || Math.hypot(a.x-shape.marker.x,a.y-shape.marker.y)-Math.hypot(b.x-shape.marker.x,b.y-shape.marker.y)
    || a.key.localeCompare(b.key));
  return candidates[0]?.shape ?? {...shape,walls:{}};
}
function follow(a:ContactShape,b:ContactShape,ra:ContactShape,rb:ContactShape):ContactShape {
  const side=joinedContactSide(ra,rb,false);
  if(!side) return b;
  const ab=contactBoxIn(a),ar=contactBoxIn(ra),br=contactBoxIn(rb),box=b.box;
  const vertical=side==='top'||side==='bottom';
  const low=vertical?'left':'top',high=vertical?'right':'bottom';
  const align=near(ar[low],br[low]) ? ab[low]-box[low]
    : near(ar[high],br[high]) ? ab[high]-box[high] : (ab[low]+ab[high]-box[low]-box[high])/2;
  const depth=contactShapeJoinDepth(a,b,side);
  const distance=side==='right'?ab.right-depth-box.left:side==='left'?ab.left+depth-box.right
    : side==='bottom'?ab.bottom-depth-box.top:ab.top+depth-box.bottom;
  const [x,y]=contactRotate(vertical?[align,distance]:[distance,align],a.angle);
  return {...b,marker:{...b.marker,x,y}};
}

/** Stateful only for old documents without a durable basis: capture once at
 * their authored positions. New/materialised groups use their stored basis. */
export class DeviceContactLayout {
  private readonly references=new Map<string,ContactMarker>();
  private readonly sources=new Map<string,{x:number;y:number;basis:ContactMarker|undefined}>();
  private graph:DeviceContactScene|null=null;
  private wallKey='';
  private inputKey='';
  private result:ContactMarker[]=[];
  private occupancy:DeviceContactScene|null=null;
  private previousInputs=new Map<string,ContactMarker>();
  private readonly groupResults=new Map<string,{key:string;markers:ContactMarker[]}>();
  public readonly work={referenceBuilds:0,occupancyBuilds:0,components:0,fallbackProbes:0};
  public clear():void {
    this.references.clear();this.sources.clear();this.graph=null;this.wallKey='';this.inputKey='';this.result=[];
    this.occupancy=null;this.previousInputs.clear();this.groupResults.clear();
  }
  public reference(id:string):ContactMarker|undefined {return this.references.get(id);}
  public resolve(markers:readonly ContactMarker[],walls:readonly ContactWall[],masonry:ContactMasonry,
    bases:ReadonlyMap<string,ContactMarker>,wallKey:string):ContactMarker[] {
    // Text can change while its fitted face stays identical. Such an HA tick
    // must not rebuild either index or run the component solver.
    const inputKey=JSON.stringify([wallKey,markers,[...bases]]);
    if(this.inputKey===inputKey)return this.result;
    const ids=new Set(markers.map(m=>m.id));
    let rebuild=this.wallKey!==wallKey;
    const changed:ContactMarker[]=[];
    for(const id of this.references.keys()) if(!ids.has(id)){this.references.delete(id);this.sources.delete(id);rebuild=true;}
    for(const m of markers) {
      const source=this.sources.get(m.id),basis=bases.get(m.id);
      if(!source || source.x!==m.x || source.y!==m.y || JSON.stringify(source.basis)!==JSON.stringify(basis)) {
        this.references.set(m.id,basis??m);this.sources.set(m.id,{x:m.x,y:m.y,basis});
        if(!this.graph?.shapes.has(m.id))rebuild=true;
        else changed.push(basis??m);
      }
    }
    if(rebuild || !this.graph) {
      this.graph=new DeviceContactScene([...this.references.values()],walls,masonry,true);
      this.wallKey=wallKey;this.work.referenceBuilds++;
      this.occupancy=null;this.groupResults.clear();
    } else for(const m of changed)this.graph.replace(m);
    const current=new Map(markers.map(m=>[m.id,m]));
    if(!this.occupancy){this.occupancy=new DeviceContactScene(markers,walls,masonry,true);this.work.occupancyBuilds++;}
    else for(const m of markers)if(JSON.stringify(m)!==JSON.stringify(this.previousInputs.get(m.id)))this.occupancy.replace(m);
    this.previousInputs=current;
    const occupied=this.occupancy;
    const output=new Map(current);
    const activeGroups=new Set<string>();
    for(const group of this.graph.components()) {
      const groupId=group[0].marker.id;
      activeGroups.add(groupId);
      const groupKey=JSON.stringify([group,group.map(s=>current.get(s.marker.id))]);
      const cached=this.groupResults.get(groupId);
      if(cached?.key===groupKey){for(const m of cached.markers)output.set(m.id,m);continue;}
      const members=new Set(group.map(s=>s.marker.id));
      if(group.every(s=>unchanged(s.marker,current.get(s.marker.id)!))
          && (group.length<2 || contactContourShapes(group).every(s=>this.safe(s,occupied,members)))) continue;
      this.work.components++;
      const ordered=[...group].sort((a,b)=>Object.keys(b.walls).length-Object.keys(a.walls).length
        || a.marker.id.localeCompare(b.marker.id));
      const root=ordered[0],queue=[root.marker.id],placed=new Map<string,ContactShape>();
      placed.set(root.marker.id,anchored(template(current.get(root.marker.id)!,root),walls));
      for(let i=0;i<queue.length;i++) {
        const id=queue[i],a=placed.get(id)!,ra=this.graph.shapes.get(id)!;
        for(const next of this.graph.edges.get(id)??[]) {
          if(placed.has(next)) continue;
          const rb=this.graph.shapes.get(next)!;
          placed.set(next,follow(a,template(current.get(next)!,rb),ra,rb));queue.push(next);
        }
      }
      // Recheck all edges, including closure edges not chosen by the BFS tree.
      const projected=contactContourShapes([...placed.values()]);
      const candidateScene=new DeviceContactScene(projected.map(s=>s.marker),walls,masonry);
      const valid=projected.every(s=>this.safe(s,occupied,members)
          && this.safe(s,candidateScene,new Set([s.marker.id])))
        && [...placed].every(([id,s])=>{
        if(!this.safe(s,occupied,members)) return false;
        const final=deriveContactShape(s.marker,walls),ref=this.graph!.shapes.get(id)!;
        if(!Object.values(ref.walls).every(w=>Object.values(final.walls).includes(w)))return false;
        return [...(this.graph!.edges.get(id)??[])].every(other=>{
          const b=placed.get(other);
          return b && joinedContactSide(s,b)!==null && !contactCoresOverlap(s.marker,b.marker);
        });
      });
      if(valid) for(const [id,s] of placed){output.set(id,s.marker);occupied.replace(s.marker);}
      else {
        // Owner-approved failure mode: release only this component's constraints.
        // Latent reference is kept, so shrinking restores the original group.
        const remaining=new Set(members);
        const settled=new Map<string,ContactShape>();
        for(const id of queue) {
          const ref=this.graph.shapes.get(id)!;
          const m=current.get(ref.marker.id)!,candidate=anchored(template(m,ref),walls);
          remaining.delete(m.id);
          const ignore=new Set([...remaining,m.id]);
          const linked=[...(this.graph.edges.get(id)??[])].flatMap(other=>{
            const parent=settled.get(other);if(!parent)return [];
            const next=deriveContactShape(follow(parent,template(m,ref),this.graph!.shapes.get(other)!,ref).marker,walls);
            if(!joinedContactSide(parent,next)||!this.safe(next,occupied,ignore))return [];
            const linkedGroup=[...settled.values(),next];
            // Widening a short row's empty shell must not push the silhouette
            // into a wall or an already settled, unrelated device.
            const projectedGroup=contactContourShapes(linkedGroup);
            const projectedIgnore=new Set([...ignore,...settled.keys()]);
            return projectedGroup.every(s=>this.safe(s,occupied,projectedIgnore))?[next]:[];
          });
          const next=linked[0]??this.separate(candidate,occupied,ignore,walls);
          output.set(m.id,next.marker);occupied.replace(next.marker);
          settled.set(id,next);
        }
      }
      this.groupResults.set(groupId,{key:groupKey,markers:group.map(s=>output.get(s.marker.id)!)});
    }
    for(const id of this.groupResults.keys())if(!activeGroups.has(id))this.groupResults.delete(id);
    this.inputKey=inputKey;this.result=markers.map(m=>output.get(m.id)!);
    return this.result;
  }
  private safe(s:ContactShape,scene:DeviceContactScene,ignore:ReadonlySet<string>,noJoin=false):boolean {
    if(!Number.isFinite(s.marker.x)||!Number.isFinite(s.marker.y)||Math.abs(s.marker.x)>5e6||Math.abs(s.marker.y)>5e6
      || contactIntersectsMasonry(s,scene.masonry))return false;
    const b=contactBounds(s);
    for(const n of scene.query(b,CONTACT_EPS)) {
      if(ignore.has(n.marker.id))continue;
      if(contactCoresOverlap(s.marker,n.marker))return false;
      const a=contactBounds(n);
      if(noJoin && Math.min(a.right,b.right)-Math.max(a.left,b.left)>=-CONTACT_EPS
        && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>=-CONTACT_EPS)return false;
      if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>CONTACT_EPS
        && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>CONTACT_EPS && !joinedContactSide(s,n)) return false;
    }
    return true;
  }
  private separate(s:ContactShape,scene:DeviceContactScene,ignore:ReadonlySet<string>,walls:readonly ContactWall[]):ContactShape {
    if(this.safe(s,scene,ignore,true))return s;
    const m=s.marker,step=Math.max(m.diameter,s.box.right-s.box.left,s.box.bottom-s.box.top)+CONTACT_EPS*4;
    // Bounded increasing neighbourhood; deterministic nearest safe candidate in
    // each ring. No random jitter, accumulated offset or movement of outsiders.
    for(let ring=1;ring<=20;ring++) {
      const distance=step*2**(ring-1),candidates:ContactShape[]=[];
      for(const [x,y] of [[0,-1],[-1,0],[1,0],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const next=deriveContactShape({...m,x:m.x+x*distance,y:m.y+y*distance},walls);
        this.work.fallbackProbes++;
        if(this.safe(next,scene,ignore,true))candidates.push(next);
      }
      candidates.sort((a,b)=>Math.hypot(a.marker.x-m.x,a.marker.y-m.y)-Math.hypot(b.marker.x-m.x,b.marker.y-m.y)
        || a.marker.y-b.marker.y || a.marker.x-b.marker.x);
      if(candidates.length)return candidates[0];
    }
    // Corrupt/extreme data only: no fabricated successful wall/device contact.
    return {...s,walls:{}};
  }
}
