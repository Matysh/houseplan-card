/** Local #1451 paint envelope. Native contact layout and hit ownership stay Flat. */
import { intersection, union, type Geom } from 'polyclip-ts';
import { contactOutline, contactRotate, freeContactShape,
  type ContactPoint as Point, type ContactShape, type ContactSide } from './device-contact-geometry';

/** Flatten only the closed M/L/circular-A/Z paths emitted by contactOutline.
 * 128 segments per circle keep the silhouette smooth even at close-up zoom. */
function rings(path: string, open = false): Point[][] {
  const tokens=path.match(/[MLAZ]|[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out:Point[][]=[]; let ring:Point[]=[],cursor:Point=[0,0],i=0;
  const point=():Point=>[Number(tokens[i++]),Number(tokens[i++])];
  while(i<tokens.length) {
    const command=tokens[i++];
    if(command==='M') { if(open && ring.length>1)out.push(ring); ring=[cursor=point()]; }
    else if(command==='L') { ring.push(cursor=point()); }
    else if(command==='A') {
      const radius=Number(tokens[i++]); i+=4; // equal ry, rotation=0, large=0, sweep=1
      const end=point(),dx=end[0]-cursor[0],dy=end[1]-cursor[1],length=Math.hypot(dx,dy);
      const k=Math.sqrt(Math.max(0,radius*radius-length*length/4))/length;
      const center:Point=[(cursor[0]+end[0])/2-dy*k,(cursor[1]+end[1])/2+dx*k];
      const start=Math.atan2(cursor[1]-center[1],cursor[0]-center[0]);
      let delta=Math.atan2(end[1]-center[1],end[0]-center[0])-start;
      if(delta<0)delta+=Math.PI*2;
      const count=Math.max(1,Math.ceil(delta/(Math.PI/64)));
      for(let step=1;step<count;step++) { const a=start+delta*step/count;
        ring.push([center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a)]); }
      ring.push(cursor=end);
    } else if(command==='Z') { ring.push(ring[0]);out.push(ring);ring=[]; }
  }
  if(open && ring.length>1)out.push(ring);
  return out;
}
const cross=(a:Point,b:Point)=>a[0]*b[1]-a[1]*b[0];
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
const add=(p:Point,v:Point,k:number):Point=>[p[0]+v[0]*k,p[1]+v[1]*k];
const area=(r:Point[])=>r.slice(1).reduce((sum,p,i)=>sum+cross(r[i],p),0);
function convexHull(points:Point[]):Point[] {
  const sorted=points.sort((p,q)=>p[0]-q[0]||p[1]-q[1]);
  const half=(list:Point[])=>{const chain:Point[]=[];for(const p of list){
    while(chain.length>1&&cross(sub(chain[chain.length-1],chain[chain.length-2]),sub(p,chain[chain.length-1]))<=1e-10)chain.pop();
    chain.push(p);
  }return chain.slice(0,-1);};
  const hull=[...half(sorted),...half([...sorted].reverse())];return [...hull,hull[0]];
}

/** Sweep the ordinary outline through the same vertical segment as the body.
 * This is a union, not a bounding box: L-shaped groups and holes stay shaped.
 * Return source-plane coordinates so the common floor projection applies once. */
export function isoMarkerBodyOutline(shapes:readonly ContactShape[],plane:readonly number[]):string {
  if(!shapes.length)return '';
  const [a,b,c,d]=plane,det=a*d-b*c;
  if(!Number.isFinite(det)||Math.abs(det)<1e-8)return contactOutline(shapes,true);
  const half=Math.max(...shapes.map(s=>s.marker.diameter))*.12;
  const v:Point=[-c/det*half,a/det*half], source=rings(contactOutline(shapes));
  const polygons:Point[][][]=[];
  for(const ring of source) {
    if(area(ring)>0)polygons.push([ring]);else polygons[polygons.length-1]?.push(ring);
  }
  const shifted=(k:number):Geom=>polygons.map(poly=>poly.map(r=>r.map(p=>add(p,v,k))));
  let envelope:ReturnType<typeof union>;
  if(shapes.length===1&&source.length===1) {
    // An individual rounded contact face is convex; its swept hull avoids a
    // polygon boolean on every ordinary marker during the first paint.
    envelope=[[convexHull(source[0].flatMap(p=>[add(p,v,-1),add(p,v,1)]))]];
  } else {
    const pieces:Geom[]=[shifted(-1),shifted(1)];
    for(const ring of source)for(let i=1;i<ring.length;i++) {
      const p=ring[i-1],q=ring[i];if(Math.abs(cross(sub(q,p),v))<1e-10)continue;
      const quad=[add(p,v,-1),add(q,v,-1),add(q,v,1),add(p,v,1)];
      pieces.push([[...quad,quad[0]]]);
    }
    envelope=union(pieces[0],...pieces.slice(1));
  }
  const walls: [Point,Point,Point][]=[];
  for(const s of shapes) {
    const {left:l,right:r,top:t,bottom:bt}=s.box;
    const edges:Record<ContactSide,[Point,Point]>={top:[[l,t],[r,t]],bottom:[[l,bt],[r,bt]],left:[[l,t],[l,bt]],right:[[r,t],[r,bt]]};
    for(const side of Object.keys(s.walls) as ContactSide[]) {
      const [start,end]=edges[side].map(p=>{
      const q=contactRotate(p,s.angle);return [q[0]+s.marker.x,q[1]+s.marker.y];
      }) as [Point,Point];
      const u=sub(end,start),length=Math.hypot(...u);
      const sign=cross(u,sub([s.marker.x,s.marker.y],start))>=0?1:-1;
      walls.push([start,end,[-u[1]/length*sign,u[0]/length*sign]]);
    }
  }
  // Cut the swept envelope at the ORIGINAL wall face. Removing the swept wall
  // strip would leave one end short and the other behind the wall after yaw.
  for(const [start,end,normal] of walls) {
    const u=sub(end,start),length=Math.hypot(...u),tangent:Point=[u[0]/length,u[1]/length];
    const reach=Math.max(1,...envelope.flatMap(poly=>poly.flatMap(r=>r.map(p=>Math.hypot(p[0]-start[0],p[1]-start[1])))))*4;
    const p=add(start,tangent,-reach),q=add(start,tangent,reach);
    envelope=intersection(envelope,[[p,q,add(q,normal,reach),add(p,normal,reach),p]]);
  }
  const wallOwned=(p:Point)=>walls.some(([start,end])=>{
    const u=sub(end,start);return Math.abs(cross(u,sub(p,start)))/Math.hypot(...u)<1e-6;
  });
  const smoothWallJoin=(points:Point[]):Point[]=>{
    for(const [start,end,normal] of walls) {
      if(Math.abs(cross(sub(end,start),sub(points[0],start)))/Math.hypot(...sub(end,start))>1e-6)continue;
      // The swept square wall corner creates a short vertical spur. Continue
      // the existing straight contact side to the wall instead of retaining it.
      for(let i=0;i<Math.min(3,points.length-1);i++) {
        const direction=sub(points[i+1],points[i]),length=Math.hypot(...direction);
        if(length<1e-7||Math.abs(cross(direction,normal))>length*1e-6
          ||direction[0]*normal[0]+direction[1]*normal[1]<=0)continue;
        const delta=sub(points[i],start),distance=delta[0]*normal[0]+delta[1]*normal[1];
        return [add(points[i],normal,-distance),...points.slice(i+1)];
      }
    }
    return points;
  };
  const fmt=(p:number[])=>p.map(n=>+n.toFixed(7)).join(' ');
  return envelope.flatMap(poly=>poly.map(ring=>{
    const chains:Point[][]=[];let chain:Point[]=[];const count=ring.length-1;
    const hidden=ring.slice(0,-1).map((p,i)=>{const q=ring[i+1];return wallOwned([(p[0]+q[0])/2,(p[1]+q[1])/2]);});
    const start=(hidden.findIndex(Boolean)+1)%count;
    for(let step=0;step<count;step++) {
      const i=(start+step)%count,p=ring[i] as Point,q=ring[(i+1)%count] as Point;
      if(hidden[i]){if(chain.length)chains.push(chain);chain=[];continue;}
      if(!chain.length)chain.push(p);chain.push(q);
    }
    if(chain.length)chains.push(chain);
    return chains.map(points=>{
      const joined=smoothWallJoin(smoothWallJoin(points).reverse()).reverse();
      return joined.map((p,i)=>`${i?'L':'M'}${fmt(p)}`).join(' ');
    }).join(' ');
  })).join(' ');
}

const lockPaths=new Map<string,string>();
export function isoLockBodyOutline(plane:readonly number[]):string {
  const key=plane.slice(0,4).join(',');let path=lockPaths.get(key);
  if(path===undefined){path=isoMarkerBodyOutline([freeContactShape({id:'lock',x:0,y:0,diameter:80,
    box:{left:-50.75,right:50.75,top:-50.75,bottom:50.75}})],plane);
    if(lockPaths.size>=16)lockPaths.clear();lockPaths.set(key,path);}
  return path;
}

export interface IsoMarkerGlass { front: string; back: string; top: string; bottom: string }
/** Extrude the native open contact boundary, not its already swept silhouette.
 * Front and rear surfaces are separate paint layers around the unchanged face.
 * Wall-owned edges stay open and grouped contours retain their concavities. */
export function isoMarkerGlass(shapes:readonly ContactShape[],plane:readonly number[]):IsoMarkerGlass {
  const result:IsoMarkerGlass={front:'',back:'',top:'',bottom:''};
  if(!shapes.length)return result;
  const [a,b,c,d]=plane,det=a*d-b*c;
  if(!Number.isFinite(det)||Math.abs(det)<1e-8)return result;
  const half=Math.max(...shapes.map(s=>s.marker.diameter))*.12;
  const v:Point=[-c/det*half,a/det*half];
  // Keep the base at the body's underside, raise only the lip by 0.08 D.
  const lip=-5/3;
  const path=(points:Point[])=>points.map((p,i)=>`${i?'L':'M'}${p.map(n=>+n.toFixed(7)).join(' ')}`).join(' ');
  for(const chain of rings(contactOutline(shapes,true),true)) {
    result.top+=path(chain.map(p=>add(p,v,lip)))+' ';
    result.bottom+=path(chain.map(p=>add(p,v,1)))+' ';
    let run:Point[]=[];let front=false;
    const flush=()=>{
      if(run.length<2)return;
      result[front?'front':'back']+=path([...run.map(p=>add(p,v,lip)),...[...run].reverse().map(p=>add(p,v,1))])+' Z ';
    };
    for(let i=1;i<chain.length;i++) {
      const p=chain[i-1],q=chain[i],dx=a*(q[0]-p[0])+c*(q[1]-p[1]);
      const next=dx<0;
      if(run.length && next!==front){flush();run=[];}
      front=next;if(!run.length)run.push(p);run.push(q);
    }
    flush();
  }
  return result;
}

const lockGlass=new Map<string,IsoMarkerGlass>();
export function isoLockGlass(plane:readonly number[]):IsoMarkerGlass {
  const key=plane.slice(0,4).join(',');let glass=lockGlass.get(key);
  if(!glass){glass=isoMarkerGlass([freeContactShape({id:'lock',x:0,y:0,diameter:80,
    box:{left:-50.75,right:50.75,top:-50.75,bottom:50.75}})],plane);
    if(lockGlass.size>=16)lockGlass.clear();lockGlass.set(key,glass);}
  return glass;
}
