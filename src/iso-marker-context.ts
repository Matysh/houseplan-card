/** UI Lab #1451: wall relationships are presentation-only; never move a marker. */
import type { ContactMasonry } from './device-contact-walls';
import { isoRotationBasis, type IsoCamera, type PlanPoint } from './iso-projection';

const cross = (a: readonly number[], b: readonly number[]) => a[0]*b[1]-a[1]*b[0];
function inRing(p: PlanPoint, ring: readonly (readonly number[])[]): boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
/** Ray towards the camera, limited to wall height. Test solid intervals so
 * holes, open doorways and walls behind the marker cannot act as occluders. */
export function isoMarkerBehindWall(point: PlanPoint, masonry: ContactMasonry, height: number, camera: IsoCamera, bottom = 0): boolean {
  const [cos,sin]=isoRotationBasis(camera);
  const reach=height*camera.zScale*Math.sin(camera.tiltDeg*Math.PI/180)
    / (camera.xyScale*(camera.floorScaleY??1));
  if(!(reach>0)) return false;
  const ray=[sin*reach,cos*reach];
  for(const polygon of masonry) {
    const minimum = Math.max(0, Math.min(1, bottom / height));
    const times=[minimum,1];
    for(const ring of polygon) for(let i=0;i<ring.length;i++) {
      const a=ring[i],b=ring[(i+1)%ring.length],edge=[b[0]-a[0],b[1]-a[1]],den=cross(ray,edge);
      if(Math.abs(den)<1e-10) continue;
      const from=[a[0]-point[0],a[1]-point[1]],t=cross(from,edge)/den,u=cross(from,ray)/den;
      if(t>minimum && t<1 && u>=0 && u<=1) times.push(t);
    }
    times.sort((a,b)=>a-b);
    for(let i=1;i<times.length;i++) {
      if(times[i]-times[i-1]<1e-8) continue;
      const t=(times[i]+times[i-1])/2,p:PlanPoint=[point[0]+ray[0]*t,point[1]+ray[1]*t];
      if(polygon[0] && inRing(p,polygon[0]) && !polygon.slice(1).some(hole=>inRing(p,hole))) return true;
    }
  }
  return false;
}

export function isoMarkerOccluded(point:PlanPoint,halfSize:PlanPoint,masonry:ContactMasonry,height:number,camera:IsoCamera,bottom=0):boolean {
  return [[0,0],[-halfSize[0],-halfSize[1]],[halfSize[0],-halfSize[1]],
    [halfSize[0],halfSize[1]],[-halfSize[0],halfSize[1]]].some(([x,y])=>
      isoMarkerBehindWall([point[0]+x,point[1]+y],masonry,height,camera,bottom));
}

