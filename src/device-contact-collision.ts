/** Narrow-phase safety of a proposed shell against the canonical masonry. */
import { intersection, type Geom } from 'polyclip-ts';
import { CONTACT_EPS, contactRotate, type ContactPoint, type ContactShape } from './device-contact-geometry';
import type { ContactMasonry } from './device-contact-walls';

export function contactShellPolygon(s: ContactShape): ContactPoint[] {
  const b = s.box, r = s.radius, points: ContactPoint[] = [];
  const corners = [[b.right-r,b.top+r, 'right','top', -Math.PI/2],
    [b.right-r,b.bottom-r,'right','bottom',0], [b.left+r,b.bottom-r,'left','bottom',Math.PI/2],
    [b.left+r,b.top+r,'left','top',Math.PI]] as const;
  for (const [x,y,h,v,start] of corners) {
    if (s.walls[h] || s.walls[v]) {
      points.push([h === 'left' ? b.left : b.right, v === 'top' ? b.top : b.bottom]);
    } else for (let i = 0; i <= 16; i++) points.push([x+r*Math.cos(start+i*Math.PI/32), y+r*Math.sin(start+i*Math.PI/32)]);
  }
  return points.map((p) => {
    const q = contactRotate(p, s.angle); return [q[0] + s.marker.x, q[1] + s.marker.y];
  });
}
export function contactIntersectsMasonry(shape: ContactShape, solids: ContactMasonry): boolean {
  if (!solids.length) return false;
  const ring = contactShellPolygon(shape); ring.push([...ring[0]]);
  const crossed = intersection([ring], solids as Geom);
  // Existing lattice noise is unobservable; contact edges can straddle that
  // strip after the canonical point writer, but not enter a physical corner.
  const area = crossed.reduce((total, polygon) => total + polygon.reduce((sum, r, i) => {
    const twice = Math.abs(r.slice(0,-1).reduce((a,p,j) => { const q=r[(j+1)%(r.length-1)]; return a+p[0]*q[1]-q[0]*p[1]; },0));
    return sum + (i ? -1 : 1) * twice/2;
  },0),0);
  const perimeter = 2 * (shape.box.right - shape.box.left + shape.box.bottom - shape.box.top);
  return area > CONTACT_EPS * perimeter;
}
