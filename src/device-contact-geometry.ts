/** Flat device shells (#866). Coordinates are plan units, never screen pixels. */
import { union, type Geom } from 'polyclip-ts';
import { LATTICE_GRID_N, LATTICE_NOISE_STEPS } from './coordinate-canonicalization';

export type ContactPoint = [number, number];
export interface ContactRect { left: number; top: number; right: number; bottom: number }
export interface ContactMarker {
  id: string; x: number; y: number; diameter: number;
  virtual?: boolean;
  /** Materialised/new placement uses exact pitch; old layouts retain recognition. */
  precise?: boolean;
  /** Whole contact face, relative to the stored core centre; no satellites.
   * Standalone DOM uses the existing free face until a true contact exists. */
  box: ContactRect;
}
export interface ContactWall {
  id: string; a: ContactPoint; b: ContactPoint;
  /** From masonry towards usable floor; null for a visible zero-width wall. */
  normal: ContactPoint | null;
}
export type ContactSide = 'top' | 'right' | 'bottom' | 'left';
export interface ContactShape {
  marker: ContactMarker; angle: number; box: ContactRect;
  radius: number; walls: Partial<Record<ContactSide, string>>;
}
export interface WallContact {
  shape: ContactShape; x: number; y: number; key: string;
  line: [number, number, number, number];
}
/** Includes the existing 1e-4-step near-node canonicalizer and nine-place tails.
 * This is a fixed storage tolerance, never a screen-space capture zone. */
export const CONTACT_EPS = 1000 / LATTICE_GRID_N * LATTICE_NOISE_STEPS + 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) <= CONTACT_EPS;
const dot = (a: ContactPoint, b: ContactPoint) => a[0] * b[0] + a[1] * b[1];
const finite = (n: number) => Number.isFinite(n);
export const validContactMarker = (m: ContactMarker): boolean => [m.x,m.y,m.diameter,...Object.values(m.box)].every(finite)
  && m.diameter>0 && m.box.right>m.box.left && m.box.bottom>m.box.top;
export const contactRotate = (p: ContactPoint, angle: number): ContactPoint => [
  p[0] * Math.cos(angle) - p[1] * Math.sin(angle),
  p[0] * Math.sin(angle) + p[1] * Math.cos(angle),
];
export function freeContactShape(marker: ContactMarker): ContactShape {
  return { marker, angle: 0, box: marker.box,
    radius: Math.min(marker.box.right - marker.box.left, marker.box.bottom - marker.box.top) / 2,
    walls: {} };
}
/** Support of the actual free capsule, not its rectangular empty corners. */
export function rotatedContactCapsule(box: ContactRect, angle: number, padding = 0): ContactRect {
  const w = box.right - box.left, h = box.bottom - box.top, r = Math.min(w, h) / 2;
  const c = contactRotate([(box.left + box.right) / 2, (box.top + box.bottom) / 2], -angle);
  const u = contactRotate(w >= h ? [1, 0] : [0, 1], -angle);
  const half = Math.abs(w - h) / 2;
  const x = r + half * Math.abs(u[0]) + padding, y = r + half * Math.abs(u[1]) + padding;
  return { left: c[0] - x, right: c[0] + x, top: c[1] - y, bottom: c[1] + y };
}
/** One finite physical face must accommodate the entire contact edge. */
export function contactAtWall(marker: ContactMarker, wall: ContactWall): WallContact[] {
  const dx = wall.b[0] - wall.a[0], dy = wall.b[1] - wall.a[1], length = Math.hypot(dx, dy);
  if (!(length > CONTACT_EPS) || !validContactMarker(marker) || ![...wall.a,...wall.b].every(finite)
    || wall.normal && (!wall.normal.every(finite) || Math.abs(Math.hypot(...wall.normal)-1)>1e-7
      || Math.abs(dx*wall.normal[0]+dy*wall.normal[1])>length*1e-7)) return [];
  // Canonical tangent makes geometry independent of segment endpoint order.
  const sign = dx < -CONTACT_EPS || (near(dx, 0) && dy < 0) ? -1 : 1;
  const t: ContactPoint = [dx / length * sign, dy / length * sign];
  const n: ContactPoint = [-t[1], t[0]], angle = Math.atan2(t[1], t[0]);
  const origin = sign > 0 ? wall.a : wall.b;
  // The free shell remains 101.5/80. A contact's empty field is calibrated to
  // the frozen 103/80 outline, so a flush face does not accumulate 1.5/80 of
  // error at its opposite edge. This never changes the existing core/badge.
  const box = rotatedContactCapsule(marker.box, angle, marker.diameter * .009375);
  const p: ContactPoint = [marker.x - origin[0], marker.y - origin[1]];
  const along = dot(p, t);
  if (along + box.left < -CONTACT_EPS || along + box.right > length + CONTACT_EPS) return [];
  const normals = wall.normal ? [dot(wall.normal, n) >= 0 ? 1 : -1] : [1, -1];
  return normals.map((side) => {
    const edge = side > 0 ? box.top : box.bottom;
    const correction = -dot(p, n) - edge;
    const x = marker.x + n[0] * correction, y = marker.y + n[1] * correction;
    const shape: ContactShape = { marker: { ...marker, x, y }, angle, box,
      radius: Math.min(marker.diameter * 0.64375, (box.right - box.left) / 2, (box.bottom - box.top) / 2),
      walls: { [side > 0 ? 'top' : 'bottom']: wall.id } };
    const a = contactRotate([box.left, edge], angle), b = contactRotate([box.right, edge], angle);
    // H/V contacts share the ordinary global basis, so a free neighbour can
    // join the outward side of a vertical wall marker without a fake turn.
    if (Math.abs(Math.cos(angle)) < 1e-9) {
      const points = [[box.left,box.top],[box.right,box.top],[box.right,box.bottom],[box.left,box.bottom]]
        .map((p)=>contactRotate(p as ContactPoint,angle));
      shape.box={left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
        top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
      shape.angle=0;
      const direction=contactRotate([0,side>0?-1:1],angle);
      shape.walls={ [direction[0]<0?'left':'right']:wall.id };
    }
    // Perpendicular faces share one canonical basis. The face contents stay
    // upright; only the empty contact field turns with an inclined wall.
    const quarter = Math.round(shape.angle / (Math.PI / 2)) * Math.PI / 2;
    if (Math.abs(quarter) > 1e-9) {
      const points = [[shape.box.left,shape.box.top],[shape.box.right,shape.box.top],
        [shape.box.right,shape.box.bottom],[shape.box.left,shape.box.bottom]]
        .map(p => contactRotate(p as ContactPoint, quarter));
      const directions: Record<ContactSide, ContactPoint> = {top:[0,-1],right:[1,0],bottom:[0,1],left:[-1,0]};
      const edges: ContactShape['walls'] = {};
      for (const side of Object.keys(shape.walls) as ContactSide[]) {
        const v = contactRotate(directions[side], quarter);
        edges[Math.abs(v[0]) > .5 ? v[0] < 0 ? 'left' : 'right' : v[1] < 0 ? 'top' : 'bottom'] = shape.walls[side];
      }
      shape.box = {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
        top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
      shape.angle -= quarter; shape.walls = edges;
    }
    return { shape, x, y, key: `wall:${wall.id}:${side}`,
      line: [x + a[0], y + a[1], x + b[0], y + b[1]] as [number, number, number, number] };
  });
}
/** Conservative world-space broad phase. The circumscribed free box covers
 * every rotated capsule, including an off-centre badge and contact padding.
 * Exact face length/normal/contact checks still belong to contactAtWall. */
export function contactWallsNear(marker: ContactMarker, walls: readonly ContactWall[], padding = 0): readonly ContactWall[] {
  if (!validContactMarker(marker) || !finite(padding) || padding < 0) return [];
  const reach = Math.hypot(Math.max(Math.abs(marker.box.left),Math.abs(marker.box.right)),
    Math.max(Math.abs(marker.box.top),Math.abs(marker.box.bottom))) + marker.diameter*.009375 + CONTACT_EPS + padding;
  return walls.filter((wall) => Math.min(wall.a[0],wall.b[0]) <= marker.x+reach
    && Math.max(wall.a[0],wall.b[0]) >= marker.x-reach && Math.min(wall.a[1],wall.b[1]) <= marker.y+reach
    && Math.max(wall.a[1],wall.b[1]) >= marker.y-reach);
}
/** Saved contacts are recognised independently of zoom/capture radii. */
export function deriveContactShape(marker: ContactMarker, walls: readonly ContactWall[]): ContactShape {
  const found = contactWallsNear(marker, walls).flatMap((wall) => contactAtWall(marker, wall))
    .filter((p) => near(p.x, marker.x) && near(p.y, marker.y))
    .sort((a, b) => a.key.localeCompare(b.key));
  if (!found.length) return freeContactShape(marker);
  const shape = found[0].shape;
  // Compatible coincident faces can square more than one side; no arbitrary turn.
  for (const p of found.slice(1)) if (near(p.shape.angle, shape.angle)) Object.assign(shape.walls, p.shape.walls);
  return { ...shape, marker };
}
/** Intersections are proposals only: both finite original faces must accept. */
export function contactAtCorner(marker: ContactMarker, walls: readonly ContactWall[]): WallContact[] {
  const planes=walls.flatMap(wall=>{
    const dx=wall.b[0]-wall.a[0],dy=wall.b[1]-wall.a[1],length=Math.hypot(dx,dy);
    if(length<=CONTACT_EPS) return [];
    const reach=Math.hypot(marker.box.right-marker.box.left,marker.box.bottom-marker.box.top)*2;
    const tx=dx/length,ty=dy/length;
    return contactAtWall(marker,{...wall,a:[wall.a[0]-tx*reach,wall.a[1]-ty*reach],
      b:[wall.b[0]+tx*reach,wall.b[1]+ty*reach]}).map(p=>({wall,p,n:[-ty,tx]}));
  });
  const out: WallContact[]=[];
  for(let i=0;i<planes.length;i++) for(let j=i+1;j<planes.length;j++) {
    const a=planes[i],b=planes[j],det=a.n[0]*b.n[1]-a.n[1]*b.n[0];
    if(a.wall.id===b.wall.id||Math.abs(det)<.1) continue;
    const u=a.n[0]*a.p.x+a.n[1]*a.p.y,v=b.n[0]*b.p.x+b.n[1]*b.p.y;
    const x=(u*b.n[1]-a.n[1]*v)/det,y=(a.n[0]*v-u*b.n[0])/det;
    const shape=deriveContactShape({...marker,x,y},walls),ids=Object.values(shape.walls);
    if(ids.includes(a.wall.id)&&ids.includes(b.wall.id)) out.push({x,y,shape,
      key:`corner:${[a.p.key,b.p.key].sort().join('|')}`,line:a.p.line});
  }
  return out;
}
export function contactBoxIn(shape: ContactShape, angle = shape.angle): ContactRect {
  const p = contactRotate([shape.marker.x, shape.marker.y], -angle);
  return { left: p[0] + shape.box.left, right: p[0] + shape.box.right,
    top: p[1] + shape.box.top, bottom: p[1] + shape.box.bottom };
}
/** Calibrated to the frozen 103/80 reference, keeping production's 101.5/80 shell. */
export const contactJoinDepth = (a: ContactMarker, b: ContactMarker): number => Math.max(0,
  Math.min(a.diameter, b.diameter) * 13 / 80 - (a.diameter + b.diameter) * 0.009375);
export function contactShapeJoinDepth(a: ContactShape, b: ContactShape, side: ContactSide): number {
  const x = rotatedContactCapsule(a.marker.box,a.angle), y = rotatedContactCapsule(b.marker.box,b.angle);
  const extra = side === 'right' ? a.box.right-x.right+y.left-b.box.left
    : side === 'left' ? x.left-a.box.left+b.box.right-y.right
    : side === 'bottom' ? a.box.bottom-x.bottom+y.top-b.box.top
    : x.top-a.box.top+b.box.bottom-y.bottom;
  return contactJoinDepth(a.marker,b.marker)+extra;
}
export function joinedContactSide(a: ContactShape, b: ContactShape, exact = true): ContactSide | null {
  if (!near(a.angle, b.angle)) return null;
  const x = contactBoxIn(a), y = contactBoxIn(b);
  const depth = Math.max(contactShapeJoinDepth(a,b,'right'),contactShapeJoinDepth(a,b,'left'),
    contactShapeJoinDepth(a,b,'top'),contactShapeJoinDepth(a,b,'bottom'));
  const overlap = (lo: number, hi: number, lo2: number, hi2: number) => Math.min(hi, hi2) - Math.max(lo, lo2);
  const close = (d: number, side: ContactSide) => exact
    ? near(d, contactShapeJoinDepth(a,b,side))
    : d >= -CONTACT_EPS && d <= contactShapeJoinDepth(a,b,side) + CONTACT_EPS;
  const align = (lo: number, hi: number, lo2: number, hi2: number) => near(lo, lo2) || near(hi, hi2) || near(lo + hi, lo2 + hi2);
  if (overlap(x.top, x.bottom, y.top, y.bottom) > depth + CONTACT_EPS && align(x.top, x.bottom, y.top, y.bottom)) {
    if (x.left < y.left && close(x.right - y.left,'right')) return 'right';
    if (x.left > y.left && close(y.right - x.left,'left')) return 'left';
  }
  if (overlap(x.left, x.right, y.left, y.right) > depth + CONTACT_EPS && align(x.left, x.right, y.left, y.right)) {
    if (x.top < y.top && close(x.bottom - y.top,'bottom')) return 'bottom';
    if (x.top > y.top && close(y.bottom - x.top,'top')) return 'top';
  }
  return null;
}
/** Inner cores never overlap, even when their empty shell padding joins. */
export function contactCoresOverlap(a: ContactMarker, b: ContactMarker): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < (a.diameter + b.diameter) / 2 - CONTACT_EPS;
}
export const oppositeContactSide: Record<ContactSide, ContactSide> = {
  top: 'bottom', right: 'left', bottom: 'top', left: 'right',
};
export function contactContains(shape: ContactShape, point: ContactPoint,
  sides: Partial<Record<ContactSide, unknown>> = shape.walls): boolean {
  const p = contactRotate([point[0] - shape.marker.x, point[1] - shape.marker.y], -shape.angle);
  const b = shape.box, r = shape.radius;
  if (p[0] < b.left - CONTACT_EPS || p[0] > b.right + CONTACT_EPS || p[1] < b.top - CONTACT_EPS || p[1] > b.bottom + CONTACT_EPS) return false;
  for (const [x, y, h, v] of [[b.left + r, b.top + r, 'left', 'top'], [b.right - r, b.top + r, 'right', 'top'],
    [b.right - r, b.bottom - r, 'right', 'bottom'], [b.left + r, b.bottom - r, 'left', 'bottom']] as const) {
    if (sides[h] || sides[v]) continue;
    if ((h === 'left' ? p[0] < x : p[0] > x) && (v === 'top' ? p[1] < y : p[1] > y)
        && Math.hypot(p[0] - x, p[1] - y) > r + CONTACT_EPS) return false;
  }
  return true;
}
/** Normalise empty contact padding, never core centres or actual contents.
 * The returned shapes are also the individual hit geometry, not SVG-only ink. */
export function contactContourShapes(shapes: readonly ContactShape[]): ContactShape[] {
  if (!shapes.length) return [];
  const angle = shapes[0].angle;
  const boxes = shapes.map(s => contactBoxIn(s, angle));
  for (const edge of ['top','bottom','left','right'] as const) {
    const sorted = boxes.map((b,i)=>({value:b[edge],i})).sort((a,b)=>a.value-b.value || a.i-b.i);
    for (let start=0; start<sorted.length;) {
      let end=start+1;
      const first=sorted[start], minD=shapes[first.i].marker.diameter;
      while(end<sorted.length && sorted[end].value-first.value<=Math.min(minD,shapes[sorted[end].i].marker.diameter)*.02) end++;
      const indices=sorted.slice(start,end).map(v=>v.i);
      const locked=indices.filter(i=>shapes[i].walls[edge]).map(i=>boxes[i][edge]);
      if (indices.length>1 && (!locked.length || Math.max(...locked)-Math.min(...locked)<=CONTACT_EPS)) {
        const target=locked[0] ?? (edge==='top'||edge==='left' ? first.value : sorted[end-1].value);
        for (const i of indices) boxes[i][edge]=target;
      }
      start=end;
    }
  }
  // A compact column of equal-diameter icon+value rows shares its free outer
  // edge. Do not turn an L or genuinely different-size group into a bbox.
  const corePoints=shapes.map(s=>contactRotate([s.marker.x,s.marker.y],-angle));
  if (shapes.length>1 && shapes.every((s,i)=>near(s.marker.diameter,shapes[0].marker.diameter)
      && near(corePoints[i][0],corePoints[0][0]))) {
    const left=Math.min(...boxes.map(b=>b.left)), right=Math.max(...boxes.map(b=>b.right));
    for(let i=0;i<boxes.length;i++) {
      if(!shapes[i].walls.left) boxes[i].left=left;
      if(!shapes[i].walls.right) boxes[i].right=right;
    }
  }
  const radii=shapes.map(s=>s.radius), low=Math.min(...radii), high=Math.max(...radii);
  const radius=high-low<=Math.min(...shapes.map(s=>s.marker.diameter))*.02 ? high : low;
  return shapes.map((s,i)=>{
    const p=contactRotate([s.marker.x,s.marker.y],-angle), b=boxes[i];
    return {...s, box:{left:b.left-p[0],right:b.right-p[0],top:b.top-p[1],bottom:b.bottom-p[1]}, radius};
  });
}

/** Visible portions of a straight boundary, excluding finite wall contacts. */
function freeBoundary(a: ContactPoint, b: ContactPoint, shapes: readonly ContactShape[]): ContactPoint[][] {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<=1e-9) return [];
  const intervals: [number,number][]=[];
  for(const s of shapes) {
    const box=contactBoxIn(s,shapes[0].angle);
    const edges: Record<ContactSide,[ContactPoint,ContactPoint]>={
      top:[[box.left,box.top],[box.right,box.top]],bottom:[[box.left,box.bottom],[box.right,box.bottom]],
      left:[[box.left,box.top],[box.left,box.bottom]],right:[[box.right,box.top],[box.right,box.bottom]]};
    for(const side of Object.keys(s.walls) as ContactSide[]) {
      const [p,q]=edges[side];
      if(Math.abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)>CONTACT_EPS*length
          || Math.abs((q[0]-a[0])*dy-(q[1]-a[1])*dx)>CONTACT_EPS*length) continue;
      const u=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length**2;
      const v=((q[0]-a[0])*dx+(q[1]-a[1])*dy)/length**2;
      const lo=Math.max(0,Math.min(u,v)),hi=Math.min(1,Math.max(u,v));
      if(hi>lo) intervals.push([lo,hi]);
    }
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  const point=(t:number):ContactPoint=>[a[0]+dx*t,a[1]+dy*t],out:ContactPoint[][]=[];
  let end=0;
  for(const [lo,hi] of intervals) { if(lo>end+1e-9) out.push([point(end),point(lo)]); end=Math.max(end,hi); }
  if(end<1-1e-9) out.push([point(end),b]);
  return out;
}
/** Rounded convex corners, square concave/wall corners. Never a group bbox.
 * Stroke is deliberately open where a wall owns the boundary; hit remains closed. */
export function contactOutline(shapes: readonly ContactShape[], stroke = false): string {
  if (!shapes.length) return '';
  const angle = shapes[0].angle;
  const boxes = shapes.map((s) => contactBoxIn(s, angle));
  const rects: Geom[] = boxes.map((b) => [[[b.left, b.top], [b.right, b.top], [b.right, b.bottom], [b.left, b.bottom], [b.left, b.top]]]);
  const polygons = union(rects[0], ...rects.slice(1));
  const radius = Math.min(...shapes.map((s) => s.radius));
  const wallCorner = (p: number[]) => shapes.some((s, index) => {
    const b = boxes[index];
    return (s.walls.left && near(p[0], b.left)) || (s.walls.right && near(p[0], b.right))
      || (s.walls.top && near(p[1], b.top)) || (s.walls.bottom && near(p[1], b.bottom));
  });
  const fmt = (p: ContactPoint) => contactRotate(p, angle).map((v) => +v.toFixed(7)).join(' ');
  return polygons.flatMap((poly) => poly.map((closed, ringIndex) => {
    // polyclip exterior is counterclockwise in Cartesian axes, clockwise on screen.
    const points = closed.slice(0, -1);
    const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
    if ((area > 0) !== (ringIndex === 0)) points.reverse();
    const corners = points.map((p, i) => {
      const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      const u: ContactPoint = [p[0] - prev[0], p[1] - prev[1]], v: ContactPoint = [next[0] - p[0], next[1] - p[1]];
      const lu = Math.hypot(...u), lv = Math.hypot(...v);
      const r = u[0] * v[1] - u[1] * v[0] > 0 && !wallCorner(p) ? Math.min(radius, lu / 2, lv / 2) : 0;
      const entry: ContactPoint = [p[0] - u[0] * r / lu, p[1] - u[1] * r / lu];
      const exit: ContactPoint = [p[0] + v[0] * r / lv, p[1] + v[1] * r / lv];
      return {entry,exit,r};
    });
    if(!stroke) return corners.map(({entry,exit,r},i)=>`${i?'L':'M'}${fmt(entry)} ${r?`A${r} ${r} 0 0 1 ${fmt(exit)}`:`L${fmt(exit)}`}`).join(' ')+' Z';
    let cursor:ContactPoint|null=null;
    const start=(p:ContactPoint):string=>{
      if(cursor&&near(cursor[0],p[0])&&near(cursor[1],p[1]))return '';
      cursor=p;return `M${fmt(p)} `;
    };
    return corners.map(({entry,exit,r},i)=>{
      const prev=corners[(i+corners.length-1)%corners.length].exit;
      const lines=freeBoundary(prev,entry,shapes).map(([a,b])=>{
        const segment=`${start(a)}L${fmt(b)}`;cursor=b;return segment;
      }).join(' ');
      const arc=r?`${start(entry)}A${r} ${r} 0 0 1 ${fmt(exit)}`:'';
      if(r)cursor=exit;
      return `${lines} ${arc}`;
    }).join(' ');
  })).join(' ');
}
