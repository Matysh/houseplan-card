import { Color, ShapeUtils, Vector2 } from 'three';
import { gridVisualUnits } from './grid-scale';
import { architecturalWallTone } from './iso-architectural-tone';
import { furniturePartsFor, furniturePlanPoint, furnitureVolumeFaces, FURNITURE_HEIGHT_SCALE } from './iso-lab-furniture';
import { isoOpeningMaterialVars, isoWallMaterial, parseCssColor } from './iso-materials';
import type { IsoOpeningPanel, IsoOpeningSurface, IsoSpatialPoint } from './iso-openings';
import {
  ISO_FLOOR_EDGE_HEIGHT, isoCameraDepth, isoPlaneMatrix, isoRotationBasis, projectPlanPoint, unprojectFloorPoint,
  type IsoCamera, type PlanPoint,
} from './iso-projection';
import type { IsoRenderScene } from './iso-scene-geometry';
import type { DecorFurniture } from './editors/decor/types';

type Paint = readonly [color: string, opacity: number];
export type IsoGlFace = { readonly loops: readonly (readonly IsoSpatialPoint[])[]; readonly paint: Paint };
type Appearance = {
  roomColor: string;
  roomOpacity: number;
  wallColor: string;
  wallOpacity: number;
  openingColor?: string;
  openingOpacity?: number;
};

const point = (xy: PlanPoint, z: number): IsoSpatialPoint => ({ point: xy, z });
const samePoint = (a: IsoSpatialPoint, b: IsoSpatialPoint) =>
  Math.hypot(a.point[0] - b.point[0], a.point[1] - b.point[1], a.z - b.z) < 1e-8;

/** Triangulate a physical face on its dominant plane; preserve holes. */
export function triangulateIsoGlFace(loops: IsoGlFace['loops']): number[] {
  const rings = loops.map(loop => loop.filter((p, i) => !samePoint(p, loop[(i + loop.length - 1) % loop.length])));
  const outer = rings[0];
  if (!outer || outer.length < 3) return [];
  const [nx, ny, nz] = outer.reduce(([x, y, z], a, i) => {
    const b = outer[(i + 1) % outer.length];
    return [
      x + (a.point[1] - b.point[1]) * (a.z + b.z),
      y + (a.z - b.z) * (a.point[0] + b.point[0]),
      z + (a.point[0] - b.point[0]) * (a.point[1] + b.point[1]),
    ];
  }, [0, 0, 0]);
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (Math.max(ax, ay, az) < 1e-10) return [];
  const project = ({ point: [x, y], z }: IsoSpatialPoint) =>
    az >= ax && az >= ay ? new Vector2(x, y) : ax >= ay ? new Vector2(y, z) : new Vector2(x, z);
  const holes = rings.slice(1).filter(ring => ring.length >= 3);
  const vertices = [outer, ...holes].flat();
  return ShapeUtils.triangulateShape(outer.map(project), holes.map(ring => ring.map(project)))
    .flatMap(triangle => triangle.flatMap(i => [...vertices[i].point, vertices[i].z]));
}

function wallSideColor(edge: readonly [PlanPoint, PlanPoint], camera: IsoCamera, color: string, opacity: number): string {
  const [a, b] = edge, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const [cos, sin] = isoRotationBasis(camera), rgb = parseCssColor(color) ?? [255, 255, 255];
  let light = .5;
  if (length > 1e-8) {
    let nx = (b[1] - a[1]) / length, ny = -(b[0] - a[0]) / length;
    if (nx * sin + ny * cos < 0) { nx = -nx; ny = -ny; }
    light = (1 - .8 * (nx * cos - ny * sin) + .6 * (nx * sin + ny * cos)) / 2;
  }
  const toned = parseCssColor(architecturalWallTone(rgb, light)) ?? rgb;
  return '#' + toned.map(c => Math.round(255 + (c - 255) * opacity).toString(16).padStart(2, '0')).join('');
}

function openingPaint(surface: IsoOpeningSurface, vars: Record<string, string>, top: string, side: string): Paint {
  const pick = (key: string, fallback: string) => vars['--iso-opening-' + key] ?? fallback;
  switch (surface.kind) {
    case 'door-frame': return [pick('door-frame', '#e9ece8'), 1];
    case 'door-glass': return ['#78b5c8', .43];
    case 'window-sill': return [pick('sill-top', '#fffefa'), 1];
    case 'leaf-edge': case 'leaf-top': return [pick('edge', '#bec5c5'), 1];
  }
  switch (surface.material) {
    case 'wall-top': return [top, 1];
    case 'wall-side': return [side, 1];
    case 'reveal': return [pick('reveal', '#8b8d8c'), 1];
    case 'matte-leaf': return [pick('leaf', '#f1f2ef'), 1];
    case 'light-frame': return surface.kind.startsWith('window-')
      ? [pick('window-frame', '#f3f4f0'), 1] : [pick('frame', '#c2cfd2'), 1];
    case 'light-sill': return [pick('sill-side', '#e6e8e3'), 1];
    case 'glass-side': return ['#cde4ee', .74];
    case 'glass-over-fabric': return ['#cde4ee', .16];
    case 'glass-top': return ['#e3f2fa', .96];
    case 'light-window': return ['#c9e4f3', .88];
    case 'blind-fabric': return ['#c8bdb0', 1];
    case 'blind-hem': return ['#958b7e', 1];
    case 'hardware': return ['#657078', 1];
    case 'gate-panel': return ['#aab6b9', 1];
    case 'gate-metal': return ['#7e8d92', 1];
  }
}

export function isoGlArchitecture(scene: IsoRenderScene, appearance: Appearance, cellCm: number, showOpenings: boolean): IsoGlFace[] {
  const result: IsoGlFace[] = [], camera = scene.camera;
  const materials = isoWallMaterial(appearance.roomColor, appearance.wallColor, appearance.roomOpacity);
  const addSide = (edge: readonly [PlanPoint, PlanPoint], bottom: number, top: number, color: string) => {
    const [a, b] = edge;
    result.push({ loops: [[point(a, bottom), point(b, bottom), point(b, top), point(a, top)]], paint: [color, 1] });
  };
  for (const face of scene.floor.sides) addSide(face.planEdge, -gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, cellCm), 0, '#858b8d');
  for (const face of scene.geometry.sides) {
    if (!face.planEdge || !face.height) continue;
    addSide(face.planEdge, 0, face.height, wallSideColor(face.planEdge, camera, appearance.wallColor, appearance.wallOpacity));
  }
  const baseY = isoPlaneMatrix(0, camera)[5];
  for (const face of scene.geometry.topFaces) {
    const height = face.height ?? 0, lift = baseY - isoPlaneMatrix(height, camera)[5];
    if (!face.projectedRings) continue;
    result.push({
      loops: face.projectedRings.map(ring => ring.map(([x, y]) => point(unprojectFloorPoint([x, y + lift], camera), height))),
      paint: [materials.topHi, 1],
    });
  }
  result.push(...isoGlOpeningFaces(scene, appearance, showOpenings
    ? scene.openingSurfaces : scene.openingSurfaces.filter(surface => /^wall-/.test(surface.material))));
  return result;
}

function isoGlOpeningFaces(scene: IsoRenderScene, appearance: Appearance, surfaces: readonly IsoOpeningSurface[]): IsoGlFace[] {
  const vars = isoOpeningMaterialVars(appearance.openingColor, appearance.openingOpacity);
  const top = isoWallMaterial(appearance.roomColor, appearance.wallColor, appearance.roomOpacity).topHi;
  return surfaces.flatMap(surface => {
    const vertices = surface.points;
    if (!vertices || vertices.length < 3) return [];
    const [a, b] = [vertices[0], vertices.find(p => Math.hypot(
      p.point[0] - vertices[0].point[0], p.point[1] - vertices[0].point[1]) > 1e-8) ?? vertices[1]];
    const side = surface.material === 'wall-side'
      ? wallSideColor([a.point, b.point], scene.camera, appearance.wallColor, appearance.wallOpacity) : '';
    return [{ loops: [vertices], paint: openingPaint(surface, vars, top, side) }];
  });
}

export function isoGlOpeningPanels(scene: IsoRenderScene, appearance: Appearance, panels: readonly IsoOpeningPanel[]): IsoGlFace[] {
  return isoGlOpeningFaces(scene, appearance, panels.flatMap(panel => panel.surfaces));
}

export function isoGlFurniture(
  shape: DecorFurniture, canvasW: number, canvasH: number, visualScale: number, camera: IsoCamera,
  liftCm = 0,
): IsoGlFace[] {
  const parts = furniturePartsFor(shape);
  if (!parts || shape.w <= 0 || shape.h <= 0) return [];
  const scale = FURNITURE_HEIGHT_SCALE * visualScale;
  return parts.flatMap(part => furnitureVolumeFaces(part, shape.w * canvasW, shape.h * canvasH, scale).flatMap(face => {
    const loops = face.loops.map(loop => loop.map(([x, y, z]) => point(
      furniturePlanPoint(shape, [x, y], canvasW, canvasH), (z + liftCm) * scale,
    )));
    // Use the original projected outward-face rule for translucent pieces.
    // Backfaces of closed parts must not add another coat of transparency.
    const projected = loops[0].map(p => projectPlanPoint(p.point, p.z, camera));
    const area = projected.reduce((sum, p, i) => {
      const q = projected[(i + 1) % projected.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    if (area * (!!shape.flip_h !== !!shape.flip_v ? -1 : 1) <= 1e-8) return [];
    return [{ loops, paint: face.cap ? ['#f7fbfc', .72 * .65] as const : ['#e4edf0', .52 * .65] as const }];
  }));
}

const triangles = new WeakMap<IsoGlFace, number[]>();
export function buildIsoGlBatch(faces: readonly IsoGlFace[], camera: IsoCamera) {
  const staged = faces.map(face => {
    let vertices = triangles.get(face);
    if (!vertices) { vertices = triangulateIsoGlFace(face.loops); triangles.set(face, vertices); }
    return { face, vertices, depth: face.loops[0].reduce((sum, p) => sum + isoCameraDepth(p.point, p.z, camera), 0)
      / face.loops[0].length };
  });
  const opaque = { positions: [] as number[], colors: [] as number[] };
  const blended = { positions: [] as number[], colors: [] as number[] };
  const color = new Color();
  let minDepth = Infinity, maxDepth = -Infinity;
  for (const { face, vertices } of staged.sort((a, b) => a.depth - b.depth)) {
    const [css, alpha] = face.paint;
    const batch = alpha < 1 ? blended : opaque;
    color.set(css);
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
      const depth = isoCameraDepth([x, y], z, camera);
      minDepth = Math.min(depth, minDepth); maxDepth = Math.max(depth, maxDepth);
      batch.positions.push(x, y, z);
      batch.colors.push(color.r, color.g, color.b, alpha);
    }
  }
  return { opaque, blended, minDepth: Number.isFinite(minDepth) ? minDepth - 1 : -1,
    maxDepth: Number.isFinite(maxDepth) ? maxDepth + 1 : 1 };
}
