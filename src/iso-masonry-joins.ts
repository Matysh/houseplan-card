import { GRID_PITCH } from './canvas-constants';
import { isoOpeningMasonry, projectIsoOpeningMasonry } from './iso-openings';
import { projectPlanPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import type { IsoOpeningRenderSurface, IsoRenderScene } from './iso-scene-geometry';
import type { IsoWallFace } from './iso-walls';

// The host cut pads its ends by up to twice its GRID_PITCH * .0002 epsilon.
// Match the actual cut edge within that error, then make the new face overlap
// by just enough for the Boolean union to remove the seam.
const edgeTolerance = GRID_PITCH * .0005;
const overlap = GRID_PITCH * .00005;

type Jamb = {
  point: PlanPoint;
  tangent: PlanPoint;
  normal: PlanPoint;
  halfDepth: number;
  low: number;
  high: number;
};
type Edge = readonly [PlanPoint, PlanPoint];
type Span = {from: number; to: number; offset: number};
type OpeningMasonry = {
  sidesWithPanels: readonly IsoWallFace[];
  sidesWithoutPanels: readonly IsoWallFace[];
  surfaces: readonly IsoOpeningRenderSurface[];
};
const cached = new WeakMap<object,OpeningMasonry>();
const relative = (p: PlanPoint, origin: PlanPoint, axis: PlanPoint) =>
  (p[0] - origin[0]) * axis[0] + (p[1] - origin[1]) * axis[1];

function jambSpan(edge: Edge, jamb: Jamb): Span | null {
  const [a,b] = edge;
  const alongA = relative(a,jamb.point,jamb.tangent);
  const alongB = relative(b,jamb.point,jamb.tangent);
  if (Math.max(Math.abs(alongA),Math.abs(alongB)) > edgeTolerance) return null;
  const acrossA = relative(a,jamb.point,jamb.normal);
  const acrossB = relative(b,jamb.point,jamb.normal);
  const width = acrossB - acrossA;
  if (Math.abs(width) <= edgeTolerance) return null;
  const left = (-jamb.halfDepth - acrossA) / width;
  const right = (jamb.halfDepth - acrossA) / width;
  const from = Math.max(0,Math.min(left,right));
  const to = Math.min(1,Math.max(left,right));
  return (to-from)*Math.abs(width) > edgeTolerance ? {from,to,offset:(alongA+alongB)/2} : null;
}

function sliceWallFace(face: IsoWallFace, edge: Edge, from: number, to: number,
  low: number, high: number, camera: IsoCamera): IsoWallFace[] {
  if (!(to-from > 1e-9 && high-low > 1e-9)) return [];
  const at = (position: number): PlanPoint => [edge[0][0]+position*(edge[1][0]-edge[0][0]),
    edge[0][1]+position*(edge[1][1]-edge[0][1])];
  const a = at(from), b = at(to);
  const points = [projectPlanPoint(a,low,camera),projectPlanPoint(b,low,camera),
    projectPlanPoint(b,high,camera),projectPlanPoint(a,high,camera)];
  return [{...face,points,planEdge:[a,b],baseHeight:low,height:high,
    d:`M ${points.map(p=>p.join(' ')).join(' L ')} Z`}];
}

function trimJambs(face: IsoWallFace, jambs: readonly Jamb[], camera: IsoCamera, panels: boolean): IsoWallFace[] {
  const edge = face.planEdge;
  const height = face.height;
  if (!edge || height === undefined || face.roundColumn !== undefined) return [face];
  const exposed = jambs.flatMap(jamb => {
    const span = jambSpan(edge,jamb);
    return span ? [{...span,low:jamb.low,high:jamb.high}] : [];
  }).sort((a,b)=>a.from-b.from);
  if (!exposed.length) return [face];
  const result: IsoWallFace[] = [];
  let left = 0;
  for (const {from,to,low,high} of exposed) {
    result.push(...sliceWallFace(face,edge,left,from,0,height,camera));
    // With panels on, the independent aperture reveal occupies this part.
    // Without panels keep the exposed masonry above the sill/below the lintel.
    if (!panels) result.push(...sliceWallFace(face,edge,Math.max(left,from),to,low,Math.min(high,height),camera));
    left = Math.max(left,to);
  }
  result.push(...sliceWallFace(face,edge,left,1,0,height,camera));
  return result;
}

/** Presentation-only joins. Physical obstacle, lighting and opening geometry
 * still use the same canonical scene. */
export function connectTranslucentOpeningMasonry(scene: IsoRenderScene): OpeningMasonry {
  const existing = cached.get(scene.geometry);
  if (existing) return existing;
  const edges: Edge[] = scene.geometry.topFaces.flatMap(face => (face.planRings ?? []).flatMap(ring =>
    ring.map((a,i) => [a,ring[(i+1)%ring.length]] as const)));
  const jambs: Jamb[] = [];
  const surfaces: IsoOpeningRenderSurface[] = [];
  for (const basis of scene.openings) {
    if (!isoOpeningMasonry(basis)) continue;
    const {start,end,tangent,normal} = basis.axis;
    const jamb = (point: PlanPoint): Jamb => ({point,tangent,normal,halfDepth:basis.face.depth/2,
      low:basis.windowProfile?.frameBottom ?? 0,
      high:basis.windowProfile?.frameTop ?? basis.apertureTop});
    const startJamb = jamb(start), endJamb = jamb(end);
    jambs.push(startJamb,endJamb);
    const limit = (jamb: Jamb, direction: number) => {
      const offsets = edges.flatMap(edge => {
        const span = jambSpan(edge,jamb);
        return span ? [span.offset*direction] : [];
      });
      return offsets.length ? direction*(Math.max(0,...offsets)+overlap) : 0;
    };
    const faces = projectIsoOpeningMasonry(basis,scene.camera,[limit(startJamb,-1),limit(endJamb,1)]);
    surfaces.push(...faces.filter(face=>!face.hiddenInTranslucentMasonry).map(face=>({
      ...face,id:basis.id,type:basis.type,sourceIndex:basis.sourceIndex,
    })));
  }
  const result = {
    surfaces,
    sidesWithPanels: scene.geometry.sides.flatMap(face=>trimJambs(face,jambs,scene.camera,true)),
    sidesWithoutPanels: scene.geometry.sides.flatMap(face=>trimJambs(face,jambs,scene.camera,false)),
  };
  cached.set(scene.geometry,result);
  return result;
}
