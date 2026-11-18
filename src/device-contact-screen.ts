/** A screen-facing contact view, independent of authored placement/layout. */
import { DeviceContactScene } from './device-contact-scene';
import type { ContactMarker } from './device-contact-geometry';
import { turnPoint, turnVector, type PlanRotation } from './view-frame';
import type { ContactRect } from './device-contact-geometry';
import type { DeviceHitCandidate } from './device-hit-owner';

/** Apply the same floor basis to a member's hit contour; never make the whole
 * joined component or its empty bounding-box corners a clickable device. */
export function projectedContactHit(candidate: DeviceHitCandidate,
  contact: {bounds: ContactRect; contains: (x:number,y:number)=>boolean},
  width:number,height:number,plane:readonly number[]):void {
  const [a,b,c,d]=plane,det=a*d-b*c;
  const sx=width/(Math.abs(a)+Math.abs(c)),sy=height/(Math.abs(b)+Math.abs(d));
  const {x,y}=candidate.center,r=contact.bounds;
  const points=[[r.left,r.top],[r.right,r.top],[r.right,r.bottom],[r.left,r.bottom]]
    .map(([u,v])=>[x+(a*u+c*v)*sx,y+(b*u+d*v)*sy]);
  candidate.painted={left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
    top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};
  candidate.contains=p=>{const u=(p.x-x)/sx,v=(p.y-y)/sy;
    return contact.contains((d*u-c*v)/det,(-b*u+a*v)/det);};
}

export function screenContactMarker(marker: ContactMarker, rotation: PlanRotation): ContactMarker {
  const [x, y] = turnPoint([marker.x, marker.y], rotation);
  // Boxes describe the actual upright face. Only the core anchor turns.
  return { ...marker, x, y };
}

export function screenContactScene(source: DeviceContactScene, rotation: PlanRotation): DeviceContactScene {
  if (!rotation) return source;
  return new DeviceContactScene([...source.shapes.values()].map(shape => screenContactMarker(shape.marker, rotation)),
    source.walls.map(wall => ({ ...wall, a: turnPoint(wall.a, rotation), b: turnPoint(wall.b, rotation),
      normal: wall.normal ? turnVector(wall.normal, rotation) : null })),
    source.masonry.map(polygon => polygon.map(ring => ring.map(point => turnPoint([point[0], point[1]], rotation)))), true);
}
