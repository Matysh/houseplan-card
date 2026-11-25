import { Color, DoubleSide, Group, Mesh, MeshBasicMaterial, Scene, type BufferGeometry } from 'three';
import { gridVisualUnits } from './grid-scale';
import { isoOpeningMaterialVars, isoWallMaterial } from './iso-materials';
import { FURNITURE_HEIGHT_SCALE, furnitureParts, furniturePlanPoint, furnitureVolumeFaces } from './iso-lab-furniture';
import { workstationParts } from './iso-lab-workstation';
import { ISO_FLOOR_EDGE_HEIGHT, isoDisplayWallHeight, type PlanPoint } from './iso-projection';
import type { IsoOpeningPanel, IsoOpeningSurface } from './iso-openings';
import type { IsoRenderScene } from './iso-scene-geometry';
import type { DecorFurniture } from './editors/decor/types';
import type { SpaceDisplay } from './logic';
import { Plan3dLightField, type Plan3dLight } from './plan-3d-light-field';
import { planFaceMesh, planPrismMesh, type Plan3dVertex } from './plan-3d-mesh';

type Polygon = readonly (readonly PlanPoint[])[];
type Paint = Readonly<{ color: string; opacity: number; lit?: boolean }>;
type Face = readonly (readonly Plan3dVertex[])[];

export interface Plan3dFurniture {
  record: DecorFurniture;
  shape: DecorFurniture;
  cabinet?: DecorFurniture;
  liftCm: number;
  color: string;
  opacity: number;
}

export interface Plan3dRoom {
  id: string;
  geometry: unknown;
  color: string;
  opacity: number;
}

export interface Plan3dWorldInput {
  physical: IsoRenderScene['physical'];
  display: SpaceDisplay;
  paper: string;
  panels: readonly IsoOpeningPanel[];
  rooms: readonly Plan3dRoom[];
  furniture: readonly Plan3dFurniture[];
  cellCm: number;
  visualScale: number;
  decorWidth: number;
  decorHeight: number;
  lights: readonly Plan3dLight[];
}

function polygons(value: unknown): readonly Polygon[] {
  if (!Array.isArray(value) || value.some(polygon => !Array.isArray(polygon)
    || polygon.some(ring => !Array.isArray(ring)
      || ring.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))))) {
    throw new Error('Invalid world geometry');
  }
  return value;
}

function openingPaint(surface: IsoOpeningSurface, palette: Record<string, string>, top: Paint, side: Paint): Paint {
  const paint = (name: string, color: string, opacity = 1): Paint => ({ color: palette['--iso-opening-' + name] ?? color, opacity, lit: true });
  if (surface.kind === 'door-frame') return paint('door-frame', '#e9ece8');
  if (surface.kind === 'window-sill') return paint('sill-top', '#fffefa');
  if (surface.kind === 'leaf-edge' || surface.kind === 'leaf-top') return paint('edge', '#bec5c5');
  switch (surface.material) {
    case 'wall-top': return top;
    case 'wall-side': return side;
    case 'reveal': return paint('reveal', '#8b8d8c');
    case 'matte-leaf': return paint('leaf', '#f1f2ef');
    case 'light-frame': return paint(surface.kind.startsWith('window-') ? 'window-frame' : 'frame', '#c2cfd2');
    case 'light-sill': return paint('sill-side', '#e6e8e3');
    case 'glass-side': return paint('glass', '#b5d9e8', .48);
    case 'glass-over-fabric': return paint('glass', '#cde4ee', .16);
    case 'glass-top': return paint('sill-top', '#e3f2fa', .96);
    case 'light-window': return paint('glass', '#c9e4f3', .68);
    case 'blind-fabric': return paint('fabric', '#c8bdb0');
    case 'blind-hem': return paint('hem', '#958b7e');
    case 'hardware': return paint('hardware', '#657078');
    case 'gate-panel': return paint('gate', '#aab6b9');
    case 'gate-metal': return paint('metal', '#858b8d');
  }
}

const colorString = (color: Color) => '#' + color.getHexString();
const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Owns resident physical meshes and material state for one plan. Only the
 * changed group is replaced on a topology, opening or furniture update. */
export class Plan3dWorld {
  readonly scene = new Scene();
  private readonly structure = new Group();
  private readonly openings = new Group();
  private readonly furniture = new Group();
  private readonly rooms = new Group();
  private readonly roomMeshes = new Map<string, { geometry: unknown; mesh: Mesh<BufferGeometry, MeshBasicMaterial> }>();
  private readonly light: Plan3dLightField;
  private structureKey: readonly unknown[] = [];
  private openingKey: readonly unknown[] = [];
  private furnitureKey: readonly unknown[] = [];

  constructor(document: Document, normalOffset: number) {
    this.light = new Plan3dLightField(document, normalOffset);
    this.scene.add(this.structure, this.openings, this.furniture, this.rooms);
  }

  private material(paint: Paint): MeshBasicMaterial {
    const options = { color: paint.color, opacity: paint.opacity, transparent: paint.opacity < 1,
      depthWrite: paint.opacity >= 1, side: DoubleSide, toneMapped: false, visible: paint.opacity > 0 };
    return paint.lit ? this.light.material(options) : new MeshBasicMaterial(options);
  }

  private mesh(geometry: BufferGeometry, paints: readonly Paint[]): Mesh {
    const materials = paints.map(paint => this.material(paint));
    const mesh = new Mesh(geometry, materials.length === 1 ? materials[0] : materials);
    return mesh;
  }

  private replace(target: Group, meshes: Mesh[]): void {
    for (const child of [...target.children]) {
      if (!(child instanceof Mesh)) continue;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
    target.clear();
    if (meshes.length) target.add(...meshes);
  }

  private openingMeshes(surfaces: readonly IsoOpeningSurface[], palette: Record<string, string>, top: Paint, side: Paint): Mesh[] {
    const batches = new Map<string, { paint: Paint; faces: Face[] }>();
    for (const surface of surfaces) {
      if (!surface.points?.length) continue;
      if (top.opacity < 1 && surface.hiddenInTranslucentMasonry) continue;
      const paint = openingPaint(surface, palette, top, side);
      const key = JSON.stringify(paint);
      let batch = batches.get(key);
      if (!batch) batches.set(key, batch = { paint, faces: [] });
      batch.faces.push([surface.points.map(({ point: [x, y], z }) => [x, y, z])]);
    }
    return [...batches.values()].map(({ paint, faces }) => this.mesh(planFaceMesh(faces), [paint]));
  }

  private furnitureMeshes(item: Plan3dFurniture, width: number, depth: number, visualScale: number): Mesh[] {
    const { shape, liftCm, color, opacity } = item;
    const base = furnitureParts(shape.symbol);
    if (!base) return [];
    const parts = shape.workstation ? workstationParts(shape, base, furnitureParts('computer') ?? []) : base;
    const heightScale = FURNITURE_HEIGHT_SCALE * visualScale;
    const map = ([x, y, z]: Plan3dVertex): Plan3dVertex => {
      const [tx, ty] = furniturePlanPoint(shape, [x, y], width, depth);
      return [tx, ty, (z + liftCm) * heightScale];
    };
    return parts.flatMap(part => {
      const faces = furnitureVolumeFaces(part, shape.w * width, shape.h * depth, heightScale);
      const split = (cap: boolean) => faces.filter(face => face.cap === cap).map(face => face.loops.map(loop => loop.map(map)));
      const pigment = new Color(color);
      const top = colorString(pigment.clone().lerp(new Color('#fff'), .2));
      const side = colorString(pigment.clone().multiplyScalar(.8));
      return [this.mesh(planFaceMesh(split(true)), [{ color: top, opacity, lit: true }]),
        this.mesh(planFaceMesh(split(false)), [{ color: side, opacity, lit: true }])];
    });
  }

  private updateRooms(rooms: readonly Plan3dRoom[]): void {
    const live = new Set<string>();
    for (const { id, geometry, color, opacity } of rooms) {
      const previous = this.roomMeshes.get(id);
      live.add(id);
      if (previous && previous.geometry === geometry) {
        previous.mesh.material.color.set(color);
        previous.mesh.material.opacity = opacity;
        previous.mesh.material.visible = opacity > 0;
        continue;
      }
      if (previous) this.disposeRoom(previous.mesh);
      const faces = polygons(geometry).map(polygon =>
        polygon.map(ring => [...ring].reverse().map(([x, y]): Plan3dVertex => [x, y, 0])));
      const material = this.light.material({ color, opacity, visible: opacity > 0, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const mesh = new Mesh(planFaceMesh(faces), material);
      mesh.userData.plan3dPick = { occludes: false };
      this.roomMeshes.set(id, { geometry, mesh });
      this.rooms.add(mesh);
    }
    for (const [id, { mesh }] of this.roomMeshes) {
      if (live.has(id)) continue;
      this.roomMeshes.delete(id);
      this.disposeRoom(mesh);
    }
  }

  private disposeRoom(mesh: Mesh<BufferGeometry, MeshBasicMaterial>): void {
    this.rooms.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  present(input: Plan3dWorldInput): void {
    const { physical, display, cellCm, panels, furniture, paper, visualScale, decorWidth, decorHeight } = input;
    this.light.set(input.lights);
    this.updateRooms(input.rooms);
    const style = isoWallMaterial(display.color, display.wallFill.c, display.opacity);
    const top: Paint = { color: display.transparentWalls3d ? display.color : style.topHi,
      opacity: display.transparentWalls3d ? display.opacity : 1 };
    const wallOnPaper = new Color('#fff').lerp(new Color(display.wallFill.c), display.wallFill.a);
    const side: Paint = { color: display.transparentWalls3d ? display.wallFill.c : colorString(wallOnPaper),
      opacity: display.transparentWalls3d ? display.wallFill.a : 1, lit: true };
    const palette = isoOpeningMaterialVars(display.openingAccent3d?.c, display.openingAccent3d?.a);
    const styleKey = [cellCm, top.color, side.color, top.opacity, side.opacity, display.hideOpenings,
      display.openingAccent3d?.c, display.openingAccent3d?.a];
    const structureKey = [physical, paper, ...styleKey];
    if (!same(this.structureKey, structureKey)) {
      const floorDepth = gridVisualUnits(ISO_FLOOR_EDGE_HEIGHT, cellCm);
      const wallHeight = gridVisualUnits(isoDisplayWallHeight(), cellCm);
      const floor: Paint = { color: paper, opacity: 1, lit: true };
      const edge: Paint = { color: '#858b8d', opacity: 1 };
      const meshes = [
        this.mesh(planPrismMesh(polygons(physical.floor), -floorDepth, 0), [floor, edge, edge]),
        this.mesh(planPrismMesh(polygons(physical.walls), 0, wallHeight), [top, side, side]),
        ...this.openingMeshes(physical.openingSurfaces.filter(surface => !display.hideOpenings
          || surface.material === 'wall-top' || surface.material === 'wall-side' || surface.material === 'reveal'), palette, top, side),
      ];
      this.replace(this.structure, meshes);
      this.structureKey = structureKey;
    }

    const openingKey = [physical, ...styleKey, ...panels.map(panel => JSON.stringify(
      panel.surfaces.map(surface => [surface.kind, surface.material, surface.points])))];
    if (!same(this.openingKey, openingKey)) {
      this.replace(this.openings, display.hideOpenings ? [] :
        this.openingMeshes(panels.flatMap(panel => panel.surfaces), palette, top, side));
      this.openingKey = openingKey;
    }
    const furnitureKey = [decorWidth, decorHeight, visualScale,
      ...furniture.flatMap(item => [item.record, item.cabinet, item.liftCm, item.color, item.opacity])];
    if (!same(this.furnitureKey, furnitureKey)) {
      this.replace(this.furniture, furniture.flatMap(item => this.furnitureMeshes(item, decorWidth, decorHeight, visualScale)));
      this.furnitureKey = furnitureKey;
    }
  }

  dispose(): void {
    this.replace(this.structure, []);
    this.replace(this.openings, []);
    this.replace(this.furniture, []);
    this.updateRooms([]);
    this.light.dispose();
  }
}
