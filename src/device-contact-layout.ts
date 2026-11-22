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

export function resizeContactMarker(marker: ContactMarker, diameter: number): ContactMarker {
  if (diameter === marker.diameter) return marker;
  const ratio = diameter / marker.diameter;
  const { left, right, top, bottom } = marker.box;
  return { ...marker, diameter, box: { left: left * ratio, right: right * ratio,
    top: top * ratio, bottom: bottom * ratio } };
}

export type LegacyContactDiameters = ReadonlyMap<string, readonly [number, number]>;

function legacyReferences(
  markers: readonly ContactMarker[], fixed: ReadonlyMap<string, ContactMarker>,
  sizes: LegacyContactDiameters, walls: readonly ContactWall[], masonry: ContactMasonry,
): Map<string, ContactMarker> {
  const candidate = (index: 0 | 1) => markers.map(marker => fixed.get(marker.id) ??
    resizeContactMarker(marker, sizes.get(marker.id)?.[index] ?? marker.diameter));
  const own = candidate(0), neutral = candidate(1);
  if (own.every((marker, index) => unchanged(marker, neutral[index]))) return new Map(neutral.map(m => [m.id, m]));
  const ownScene = new DeviceContactScene(own, walls, masonry, true);
  const standardScene = new DeviceContactScene(neutral, walls, masonry, true);
  const ownProof = ownScene.contactedIds(), standardProof = standardScene.contactedIds();
  const signatures = (scene: DeviceContactScene, ids: readonly string[]) => JSON.stringify(ids.map(id => [
    Object.values(scene.shapes.get(id)?.walls ?? {}).sort(), [...(scene.edges.get(id) ?? [])].sort(),
  ]));
  const selected = new Map<string, ContactMarker>();
  for (const start of neutral) {
    if (selected.has(start.id)) continue;
    const ids = [start.id], seen = new Set(ids);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      for (const neighbours of [ownScene.edges.get(id), standardScene.edges.get(id)]) {
        for (const next of neighbours ?? []) {
          if (!seen.has(next)) { seen.add(next); ids.push(next); }
        }
      }
    }
    const ownHasContacts = ids.some(id => ownProof.has(id));
    const standardHasContacts = ids.some(id => standardProof.has(id));
    // With no proof, remember the unscaled authored size. This does not create
    // any contacts, and lets a later authored move establish a real neighbour.
    const useOwn = !standardHasContacts || ownHasContacts
      && signatures(ownScene, ids) !== signatures(standardScene, ids);
    const source = useOwn ? ownScene : standardScene;
    for (const id of ids) {
      const marker = source.shapes.get(id)?.marker;
      if (marker) selected.set(id, marker);
    }
  }
  return selected;
}
function template(marker:ContactMarker,reference:ContactShape):ContactShape {
  const angle=reference.angle, wall=Object.keys(reference.walls).length>0;
  const box=rotatedContactCapsule(marker.box,angle,wall?marker.diameter*.009375:0);
  return {marker,angle,box,walls:{...reference.walls},
    radius:Math.min(marker.diameter*(wall?.64375:.634375),(box.right-box.left)/2,(box.bottom-box.top)/2)};
}
function anchorOrder(a: ContactShape, b: ContactShape): number {
  return a.marker.y - b.marker.y || a.marker.x - b.marker.x || a.marker.id.localeCompare(b.marker.id);
}

function resizeAnchor(group: readonly ContactShape[]): ContactShape {
  return [...group].sort((a, b) =>
    Object.keys(b.walls).length - Object.keys(a.walls).length || anchorOrder(a, b))[0];
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
  public resizeLimited = false;
  public resizeBaselineLost = false;
  private previousInputs=new Map<string,ContactMarker>();
  private readonly groupResults=new Map<string,{key:string;markers:ContactMarker[]}>();
  public readonly work={referenceBuilds:0,occupancyBuilds:0,components:0,fallbackProbes:0};
  public clear():void {
    this.references.clear();this.sources.clear();this.graph=null;this.wallKey='';this.inputKey='';this.result=[];
    this.occupancy=null;this.previousInputs.clear();this.groupResults.clear();
    this.resizeLimited = false; this.resizeBaselineLost = false;
  }
  public reference(id:string):ContactMarker|undefined {return this.references.get(id);}
  public referenceMembers(id: string): string[] {
    const graph = this.graph, shape = graph?.shapes.get(id);
    if (!graph || !shape) return [];
    const members = graph.component(id);
    return members.length > 1 || Object.keys(shape.walls).length ? members : [];
  }
  public resolve(markers:readonly ContactMarker[],walls:readonly ContactWall[],masonry:ContactMasonry,
    bases:ReadonlyMap<string,ContactMarker>,wallKey:string, legacy?: LegacyContactDiameters):ContactMarker[] {
    // Text can change while its fitted face stays identical. Such an HA tick
    // must not rebuild either index or run the component solver.
    const inputKey=JSON.stringify([wallKey,markers,[...bases],legacy ? [...legacy] : null]);
    if(this.inputKey===inputKey)return this.result;
    const ids=new Set(markers.map(m=>m.id));
    let rebuild=this.wallKey!==wallKey;
    const changed:ContactMarker[]=[];
    for(const id of this.references.keys()) if(!ids.has(id)){this.references.delete(id);this.sources.delete(id);rebuild=true;}
    const updated = markers.filter(m => {
      const source = this.sources.get(m.id);
      return !source || source.x !== m.x || source.y !== m.y
        || JSON.stringify(source.basis) !== JSON.stringify(bases.get(m.id));
    });
    const fixed = new Map(bases);
    const changedIds = new Set(updated.map(m => m.id));
    for (const [id, reference] of this.references) if (!changedIds.has(id)) fixed.set(id, reference);
    const inferred = updated.length && legacy?.size ? legacyReferences(markers, fixed, legacy, walls, masonry) : null;
    for (const m of updated) {
      const basis = bases.get(m.id), reference = basis ?? inferred?.get(m.id) ?? m;
      this.references.set(m.id, reference);
      this.sources.set(m.id, { x: m.x, y: m.y, basis });
      if (!this.graph?.shapes.has(m.id)) rebuild = true;
      else changed.push(reference);
    }
    if(rebuild || !this.graph) {
      this.graph=new DeviceContactScene([...this.references.values()],walls,masonry,true);
      this.wallKey=wallKey;this.work.referenceBuilds++;
      this.occupancy=null;this.groupResults.clear();
    } else for(const m of changed)this.graph.replace(m);
    const current=new Map(markers.map(m=>[m.id,m]));
    this.resizeLimited = false;
    this.resizeBaselineLost = false;
    const groups = this.graph.components();
    if (legacy && groups.some(group => group.some(shape =>
        !near(shape.marker.diameter, current.get(shape.marker.id)!.diameter)))) {
      this.occupancy = null;
      this.groupResults.clear();
      const output = this.resolveResize(groups, current, walls, masonry);
      this.inputKey = inputKey;
      this.result = markers.map(marker => output.get(marker.id)!);
      return this.result;
    }
    if(!this.occupancy){this.occupancy=new DeviceContactScene(markers,walls,masonry,true);this.work.occupancyBuilds++;}
    else for(const m of markers)if(JSON.stringify(m)!==JSON.stringify(this.previousInputs.get(m.id)))this.occupancy.replace(m);
    this.previousInputs=current;
    const occupied=this.occupancy;
    const output=new Map(current);
    const activeGroups=new Set<string>();
    for(const group of groups) {
      const groupId=group[0].marker.id;
      activeGroups.add(groupId);
      const groupKey=JSON.stringify([group,group.map(s=>current.get(s.marker.id))]);
      const cached=this.groupResults.get(groupId);
      if(cached?.key===groupKey){for(const m of cached.markers)output.set(m.id,m);continue;}
      const members=new Set(group.map(s=>s.marker.id));
      if(group.every(s=>unchanged(s.marker,current.get(s.marker.id)!))
          && (group.length<2 || contactContourShapes(group).every(s=>this.safe(s,occupied,members)))) continue;
      this.work.components++;
      const { placed, queue, valid } = this.place(group, current, occupied, walls, masonry);
      if(valid) for(const [id,s] of placed){output.set(id,s.marker);occupied.replace(s.marker);}
      else this.releaseContacts(queue, members, current, occupied, walls, output);
      this.groupResults.set(groupId,{key:groupKey,markers:group.map(s=>output.get(s.marker.id)!)});
    }
    for(const id of this.groupResults.keys())if(!activeGroups.has(id))this.groupResults.delete(id);
    this.inputKey=inputKey;this.result=markers.map(m=>output.get(m.id)!);
    return this.result;
  }
  private resolveResize(
    groups: readonly ContactShape[][], requested: ReadonlyMap<string, ContactMarker>,
    walls: readonly ContactWall[], masonry: ContactMasonry,
  ): Map<string, ContactMarker> {
    const constrained = groups.filter(group => group.length > 1 || Object.keys(group[0].walls).length > 0);
    const contactIds = new Set(constrained.flatMap(group => group.map(shape => shape.marker.id)));
    const output = new Map(requested);
    const growingFree = new Map<string, ContactMarker>();
    for (const group of groups) if (!contactIds.has(group[0].marker.id)) {
      const original = group[0].marker;
      const marker = requested.get(original.id)!;
      if (marker.diameter > original.diameter + CONTACT_EPS) {
        growingFree.set(marker.id, original);
        output.set(marker.id, resizeContactMarker(marker, original.diameter));
      }
    }
    const interpolate = (group: readonly ContactShape[], fraction: number) => new Map(group.map(({marker: base}) => {
      const marker = requested.get(base.id)!;
      return [marker.id, resizeContactMarker(marker, base.diameter + fraction * (marker.diameter - base.diameter))];
    }));
    const store = (placed: ReadonlyMap<string, ContactShape>, occupied?: DeviceContactScene) => {
      for (const [id, shape] of placed) {
        output.set(id, shape.marker);
        occupied?.replace(shape.marker);
      }
    };
    // Compute each component's baseline before testing requested growth. An
    // unprocessed component occupies its feasible baseline, not its request
    // at stale centres. Later components see committed positions and sizes.
    const planned = constrained.map(group => {
      const active = group.some(({marker}) => !near(marker.diameter, requested.get(marker.id)!.diameter));
      const baseline = interpolate(group, active ? 0 : 1);
      const placed = this.place(group, baseline, null, walls, masonry, active);
      if (placed.valid) store(placed.placed);
      else for (const [id, marker] of baseline) output.set(id, marker);
      return { anchor: resizeAnchor(group), group, baseline, active, placed };
    }).sort((a, b) => anchorOrder(a.anchor, b.anchor));
    const occupied = new DeviceContactScene([...output.values()], walls, masonry, true);
    this.work.occupancyBuilds++;
    for (const { group, baseline, active, placed } of planned) {
      const members = new Set(group.map(shape => shape.marker.id));
      this.work.components++;
      if (!active) {
        const stable = this.place(group, baseline, occupied, walls, masonry);
        if (stable.valid) store(stable.placed, occupied);
        else this.releaseContacts(stable.queue, members, baseline, occupied, walls, output);
        continue;
      }
      const fit = (fraction: number) => this.place(group, interpolate(group, fraction), occupied, walls, masonry, true);
      const full = fit(1);
      if (full.valid) { store(full.placed, occupied); continue; }

      this.resizeLimited = true;
      const base = this.place(group, baseline, occupied, walls, masonry, true);
      if (!base.valid) {
        this.resizeBaselineLost = true;
        this.releaseContacts(placed.queue, members, baseline, occupied, walls, output);
        continue;
      }
      let best = base.placed;
      let low = 0, high = 1;
      for (let step = 0; step < 12; step++) {
        const fraction = (low + high) / 2;
        const result = fit(fraction);
        if (result.valid) { best = result.placed; low = fraction; }
        else high = fraction;
      }
      store(best, occupied);
    }
    // Only proven contacts can cap growth of a free marker. Nearby free
    // markers do not form a component or displace each other.
    if (growingFree.size && contactIds.size) {
      const contacts = new DeviceContactScene([...contactIds].map(id => output.get(id)!), walls);
      for (const [id, base] of growingFree) {
        const desired = requested.get(id)!;
        const fits = (marker: ContactMarker) => this.safe(deriveContactShape(marker, []), contacts, new Set(), true);
        if (fits(desired)) { output.set(id, desired); continue; }
        this.resizeLimited = true;
        let low = base.diameter, high = desired.diameter;
        let best = output.get(id)!;
        if (fits(best)) for (let step = 0; step < 12; step++) {
          const middle = (low + high) / 2;
          const marker = resizeContactMarker(desired, middle);
          if (fits(marker)) { best = marker; low = middle; }
          else high = middle;
        }
        output.set(id, best);
      }
    } else for (const id of growingFree.keys()) output.set(id, requested.get(id)!);
    return output;
  }

  private releaseContacts(
    queue: readonly string[], members: ReadonlySet<string>, current: ReadonlyMap<string, ContactMarker>,
    occupied: DeviceContactScene, walls: readonly ContactWall[], output: Map<string, ContactMarker>,
  ): void {
    const remaining=new Set(members);
    const settled=new Map<string,ContactShape>();
    for(const id of queue) {
      const ref=this.graph!.shapes.get(id)!;
      const m=current.get(ref.marker.id)!,candidate=anchored(template(m,ref),walls);
      remaining.delete(m.id);
      const ignore=new Set([...remaining,m.id]);
      const linked=[...(this.graph!.edges.get(id)??[])].flatMap(other=>{
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

  private place(
    group: readonly ContactShape[], current: ReadonlyMap<string, ContactMarker>, occupied: DeviceContactScene | null,
    walls: readonly ContactWall[], masonry: ContactMasonry, resize = false,
  ): { placed: Map<string, ContactShape>; queue: string[]; valid: boolean } {
    const graph = this.graph!;
    const root = resize ? resizeAnchor(group) : [...group].sort((a,b) =>
      Object.keys(b.walls).length - Object.keys(a.walls).length || a.marker.id.localeCompare(b.marker.id))[0];
    const queue = [root.marker.id];
    const placed = new Map<string, ContactShape>();
    placed.set(root.marker.id, anchored(template(current.get(root.marker.id)!, root), walls));
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      const a = placed.get(id)!;
      const ra = graph.shapes.get(id)!;
      for (const next of graph.edges.get(id) ?? []) {
        if (placed.has(next)) continue;
        const rb = graph.shapes.get(next)!;
        placed.set(next, follow(a, template(current.get(next)!, rb), ra, rb));
        queue.push(next);
      }
    }

    // Validate closure edges and walls in addition to the edges used by the traversal.
    const projected = contactContourShapes([...placed.values()]);
    const candidateScene = new DeviceContactScene(projected.map(shape => shape.marker), walls, masonry);
    const members = new Set(placed.keys());
    const valid = projected.every(shape => (!occupied || this.safe(shape, occupied, members))
      && this.safe(shape, candidateScene, new Set([shape.marker.id])))
      && [...placed].every(([id, shape]) => {
        if (occupied && !this.safe(shape, occupied, members)) return false;
        const reference = graph.shapes.get(id)!;
        const final = deriveContactShape(shape.marker, walls);
        if (!Object.values(reference.walls).every(wall => Object.values(final.walls).includes(wall))) return false;
        return [...(graph.edges.get(id) ?? [])].every(other => {
          const neighbour = placed.get(other);
          if (!neighbour || !joinedContactSide(shape, neighbour) || contactCoresOverlap(shape.marker, neighbour.marker)) return false;
          if (!resize) return true;
          const next = graph.shapes.get(other)!;
          const expected = follow(shape, template(current.get(other)!, next), reference, next).marker;
          return near(expected.x, neighbour.marker.x) && near(expected.y, neighbour.marker.y);
        });
      });
    return { placed, queue, valid };
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
