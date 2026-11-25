import { BufferGeometry, CanvasTexture, Color, DoubleSide, EdgesGeometry, Float32BufferAttribute,
  FrontSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, SRGBColorSpace, Texture } from 'three';
import { union, type Geom } from 'polyclip-ts';
import { gridVisualUnits } from './grid-scale';
import { colorLuma, isoOpeningMaterialVars, isoWallMaterial, parseCssColor } from './iso-materials';
import { FURNITURE_HEIGHT_SCALE, furnitureParts, furniturePlanPoint, furnitureVolumeFaces } from './iso-lab-furniture';
import { workstationParts } from './iso-lab-workstation';
import { isoDisplayWallHeight, type PlanPoint, type ViewRect } from './iso-projection';
import type { IsoOpeningPanel, IsoOpeningSurface } from './iso-openings';
import type { IsoRenderScene } from './iso-scene-geometry';
import type { DecorFurniture } from './editors/decor/types';
import type { SpaceDisplay } from './logic';
import type { PhysicalStairVolume } from './stairs-volume';
import { Plan3dLightField, type Plan3dLight } from './plan-3d-light-field';
import { planFaceMesh, planPrismMesh, type Plan3dVertex } from './plan-3d-mesh';
import { plan3dCladWallSides, plan3dWallInk, plan3dWallShell } from './plan-3d-wall-shell';
import { Plan3dTransparency } from './plan-3d-transparency';
import { Plan3dMarkerLayer, type MarkerRaster, type Plan3dMarker } from './plan-3d-markers';
import { markerContactChains } from './iso-marker-outline';

type Polygon = readonly (readonly PlanPoint[])[];
type Paint = Readonly<{ color: string; opacity: number; lit?: boolean; shadeSides?: boolean; front?: boolean }>;
type Face = readonly (readonly Plan3dVertex[])[];
type DrawObject = Mesh | LineSegments;

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

export interface Plan3dImage {
  url: string;
  x: number; y: number; w: number; h: number;
  angle: number;
  opacity: number;
}

export interface Plan3dLedRibbon {
  id: string;
  owner: string;
  path: { points: readonly PlanPoint[]; closed: boolean };
  width: number;
  depth: number;
  outline: string;
  color: string;
  opacity: number;
}

export interface Plan3dFloorInk {
  scope: string;
  key: readonly unknown[];
  bounds: ViewRect;
  capture(signal: AbortSignal): Promise<Blob | null>;
}

export type Plan3dContactShadow = readonly [x: number, y: number, w: number, h: number, alpha: number];

export interface Plan3dOutline {
  id: string;
  members: readonly string[];
  outline: string;
  diameter: number;
  virtual: boolean;
}

export interface Plan3dWorldInput {
  physical: IsoRenderScene['physical'];
  display: SpaceDisplay;
  paper: string;
  backdrop?: Plan3dImage;
  floorInk?: Plan3dFloorInk;
  panels: readonly IsoOpeningPanel[];
  rooms: readonly Plan3dRoom[];
  furniture: readonly Plan3dFurniture[];
  stairs?: readonly { id: string; volume: PhysicalStairVolume; color: string }[];
  ribbons?: readonly Plan3dLedRibbon[];
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
const signedArea = (ring: readonly PlanPoint[]) => ring.reduce((area, [x, y], index) => {
  const [nextX, nextY] = ring[(index + 1) % ring.length];
  return area + x * nextY - nextX * y;
}, 0);
const horizontal = (polygon: Polygon, height: number): Face => polygon.map((ring, index) =>
  ((signedArea(ring) > 0) === (index === 0) ? ring : [...ring].reverse()).map(([x, y]): Plan3dVertex => [x, y, height]));

const edgeTone = (color: string) => colorLuma(parseCssColor(color) ?? [255, 255, 255]) < .5 ? '#e8f0f2' : '#536770';

function lineInk(geometry: BufferGeometry, color: string, opacity: number): LineSegments {
  const material = new LineBasicMaterial({ color, opacity, transparent: true, depthWrite: false, toneMapped: false });
  // Keep the stroke visible on its own face without lifting it off the
  // world-space edge or letting it cross surfaces materially in front.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\ngl_Position.z -= 0.000001 * gl_Position.w;');
  };
  const mesh = new LineSegments(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

function faceInk(faces: readonly Face[], color: string, opacity: number): LineSegments {
  const topology = planFaceMesh(faces);
  const edges = new EdgesGeometry(topology, 19);
  topology.dispose();
  return lineInk(edges, color, opacity);
}

function wallInk(shell: ReturnType<typeof plan3dWallShell>, top: Paint, side: Paint): LineSegments[] {
  const positions = (points: number[]) => new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
  const { cap, base, vertical } = plan3dWallInk(shell.bands);
  const inks: LineSegments[] = [];
  if (top.opacity > 0 && cap.length) inks.push(lineInk(positions(cap), edgeTone(top.color), .54 * top.opacity));
  if (side.opacity > 0 && (base.length || vertical.length))
    inks.push(lineInk(positions([...base, ...vertical]), edgeTone(side.color), .4 * side.opacity));
  return inks;
}

function ribbonFloor({ points, closed }: Plan3dLedRibbon['path'], width: number): Polygon[] {
  const n = points.length;
  const radius = width / 2;
  const parts: Geom[] = [];
  for (let i = 0; i < n - (closed ? 0 : 1); i++) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
    const length = Math.hypot(bx - ax, by - ay);
    if (!length) continue;
    const dx = (by - ay) / length * radius, dy = (ax - bx) / length * radius;
    parts.push([[[ax + dx, ay + dy], [bx + dx, by + dy], [bx - dx, by - dy], [ax - dx, ay - dy]]]);
  }
  for (const [x, y] of points) {
    parts.push([Array.from({ length: 16 }, (_, i): [number, number] => {
      const angle = i * Math.PI / 8;
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
    })]);
  }
  return parts.length ? union(parts[0], ...parts.slice(1)) : [];
}

function dashedRim(points: readonly PlanPoint[], diameter: number): PlanPoint[][] {
  // Device outlines use the same 6:5 rhythm at every device size. Carry the
  // phase through the little segments of a rounded corner and across joins.
  const unit = Math.max(diameter / 45, .0001);
  const dash = 6 * unit, gap = 5 * unit;
  const pieces: PlanPoint[][] = [];
  let piece: PlanPoint[] | undefined, ink = true, remaining = dash;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const length = Math.hypot(bx - ax, by - ay);
    const at = (along: number): PlanPoint => [ax + (bx - ax) * along / length, ay + (by - ay) * along / length];
    let position = 0;
    while (position < length) {
      const step = Math.min(remaining, length - position);
      if (ink) {
        if (!piece) { piece = [at(position)]; pieces.push(piece); }
        piece.push(at(position + step));
      }
      position += step;
      remaining -= step;
      if (remaining <= 0) {
        ink = !ink;
        remaining = ink ? dash : gap;
        piece = undefined;
      }
    }
  }
  return pieces;
}

/** Extrude the rim from the boundary itself. Adjacent quads share the same
 * joins, so thin, rounded contours do not need a polygon union per device. */
function rimFaces(source: readonly PlanPoint[], width: number, top: number, low: number): Face[] {
  const points = source.filter((point, i) => !i || Math.hypot(point[0] - source[i - 1][0], point[1] - source[i - 1][1]) > 1e-7);
  const first = points[0], last = points[points.length - 1];
  if (!first || !last || points.length < 2) return [];
  const closed = points.length > 2 && Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-7;
  if (closed) points.pop();
  const count = points.length, edges = count - (closed ? 0 : 1);
  const normals = Array.from({ length: edges }, (_, i): PlanPoint => {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % count];
    const length = Math.hypot(bx - ax, by - ay);
    return [(by - ay) / length, (ax - bx) / length];
  });
  const offsets = points.map(([x, y], i): readonly [PlanPoint, PlanPoint] => {
    const before = normals[i - 1] ?? (closed ? normals[edges - 1] : normals[0]);
    const after = normals[i] ?? normals[edges - 1];
    const scale = width / (2 * Math.max(.5, 1 + before[0] * after[0] + before[1] * after[1]));
    const dx = (before[0] + after[0]) * scale, dy = (before[1] + after[1]) * scale;
    return [[x + dx, y + dy], [x - dx, y - dy]];
  });
  return normals.flatMap((_normal, i) => {
    const [a, b] = offsets[i], [c, d] = offsets[(i + 1) % count];
    const polygon = [[a, c, d, b]];
    return [horizontal(polygon, top), horizontal(polygon, low)];
  });
}

/** Owns resident physical meshes and material state for one plan. Only the
 * changed group is replaced on a topology, opening or furniture update. */
export class Plan3dWorld {
  readonly scene = new Scene();
  private readonly markers: Plan3dMarkerLayer;
  private readonly structure = new Group();
  private readonly architecture = new Group();
  private readonly ground = new Group();
  private groundTexture?: CanvasTexture;
  private groundKey: readonly unknown[] = [];
  private readonly contacts = new Group();
  private contactTexture?: CanvasTexture;
  private contactKey: readonly unknown[] = [];
  private readonly openings = new Group();
  private readonly furniture = new Group();
  private readonly stairs = new Group();
  private readonly ribbons = new Group();
  private readonly markerGlass = new Group();
  private readonly glassMeshes = new Map<string, { key: string; meshes: Mesh[] }>();
  private readonly rooms = new Group();
  private readonly roomMeshes = new Map<string, { geometry: unknown; mesh: Mesh<BufferGeometry, MeshBasicMaterial> }>();
  private readonly backdrop = new Group();
  private readonly floorInk = new Group();
  private backdropKey: string | undefined;
  private backdropTexture: Texture | undefined;
  private backdropReady: Promise<void> | undefined;
  private backdropFailed = false;
  private backdropLoading = false;
  private imageGeneration = 0;
  private floorInkKey: readonly unknown[] = [];
  private floorInkScope?: string;
  private floorInkTexture?: Texture;
  private floorInkLoading = false;
  private floorInkWork?: { controller: AbortController; ready: Promise<boolean> };
  private readonly light: Plan3dLightField;
  private readonly transparency = new Plan3dTransparency();
  private transparencyEnabled = false;
  private transparencyDirty = true;
  private structureKey: readonly unknown[] = [];
  private openingKey: readonly unknown[] = [];
  private furnitureKey: readonly unknown[] = [];
  private stairKey: readonly unknown[] = [];
  private readonly ribbonMeshes = new Map<string, { geometry: readonly unknown[]; body: Mesh; core: Mesh<BufferGeometry, MeshBasicMaterial> }>();

  constructor(private readonly document: Document, normalOffset: number, private readonly changed?: () => void) {
    this.light = new Plan3dLightField(document, normalOffset);
    this.markers = new Plan3dMarkerLayer(document);
    this.scene.add(this.ground, this.structure, this.architecture, this.backdrop, this.openings, this.furniture, this.stairs, this.rooms, this.contacts,
      this.floorInk, this.ribbons, this.markers.group, this.markerGlass);
    this.scene.onBeforeRender = (_renderer, _scene, camera) => {
      this.syncTransparency();
      this.transparency.prepare(camera);
    };
  }

  presentMarkers(markers: readonly Plan3dMarker[], density: number, raster?: MarkerRaster): void {
    this.markers.present(markers, density, raster);
  }

  /** One bounded floor texture, not one transparent GPU object per badge.
   * It changes with world positions, not with the view or light intensity. */
  presentContacts(floor: unknown, box: ViewRect, markers: readonly Plan3dMarker[], labels: readonly Plan3dContactShadow[]): void {
    const dots: Plan3dContactShadow[] = [...labels];
    for (const { center, diameter, faces } of markers) {
      for (const face of faces) {
        const angle = face.angle ?? 0, c = Math.cos(angle), s = Math.sin(angle);
        const dx = (face.left + face.right) * diameter / 2, dy = (face.top + face.bottom) * diameter / 2;
        dots.push([center[0] + c * dx - s * dy, center[1] + s * dx + c * dy,
          (face.right - face.left + .42) * diameter, (face.bottom - face.top + .42) * diameter, .28]);
      }
    }
    const { x, y, w, h } = box;
    const key = [floor, x, y, w, h, ...dots.flat()];
    if (same(key, this.contactKey)) return;
    this.contactKey = key;
    this.replace(this.contacts, []);
    this.contactTexture?.dispose();
    this.contactTexture = undefined;
    if (!dots.length || !(w > 0 && h > 0 && Number.isFinite(w + h))) return;
    const density = Math.min(2, 1024 / Math.max(w, h));
    const canvas = this.document.createElement('canvas');
    canvas.width = Math.ceil(w * density);
    canvas.height = Math.ceil(h * density);
    const context = canvas.getContext('2d');
    if (!context) return;
    const clip = new Path2D();
    for (const poly of polygons(floor)) for (const ring of poly) {
      ring.forEach(([px, py], i) => i ? clip.lineTo(px, py) : clip.moveTo(px, py));
      clip.closePath();
    }
    context.setTransform(canvas.width / w, 0, 0, canvas.height / h, -x * canvas.width / w, -y * canvas.height / h);
    context.clip(clip, 'evenodd');
    for (const [px, py, width, height, opacity] of dots) {
      if (!(width > 0 && height > 0 && opacity > 0) || !Number.isFinite(px + py + width + height + opacity)) continue;
      context.save();
      context.translate(px, py);
      context.scale(width / 2, height / 2);
      const brush = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      brush.addColorStop(0, `rgba(28,32,38,${opacity})`);
      brush.addColorStop(.43, `rgba(28,32,38,${opacity * .83})`);
      brush.addColorStop(.71, `rgba(28,32,38,${opacity * .33})`);
      brush.addColorStop(1, 'rgba(28,32,38,0)');
      context.fillStyle = brush;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    }
    this.contactTexture = new CanvasTexture(canvas);
    this.contactTexture.colorSpace = SRGBColorSpace;
    const geometry = new PlaneGeometry(w, h);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(x + w / 2, 0, y + h / 2);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: this.contactTexture, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetUnits: -4, polygonOffsetFactor: -4, toneMapped: false }));
    mesh.renderOrder = -.5;
    mesh.userData.plan3dPick = { occludes: false };
    this.replace(this.contacts, [mesh]);
  }

  presentOutlines(outlines: readonly Plan3dOutline[], height: number): void {
    const live = new Set<string>();
    for (const { id, outline, diameter, virtual } of outlines) {
      if (!outline || !Number.isFinite(diameter) || diameter <= 0) continue;
      const key = [height, diameter, virtual, outline].join('|');
      live.add(id);
      const previous = this.glassMeshes.get(id);
      if (previous?.key === key) continue;
      if (previous) this.disposeGlass(previous.meshes);
      // The wall top owns its depth exactly where a rim touches the cut.
      const top = height - diameter * .0001, low = top - diameter * .24;
      const chains = markerContactChains(outline);
      const faces: Face[] = [], rims: Face[] = [];
      for (const chain of chains) {
        for (let i = 1; i < chain.length; i++) {
          const [a, b] = [chain[i - 1], chain[i]];
          faces.push([[[...a, low], [...a, top], [...b, top], [...b, low]]]);
        }
        const strokes = virtual ? dashedRim(chain, diameter) : [chain];
        for (const points of strokes) rims.push(...rimFaces(points, diameter * (virtual ? .021 : .016), top, low));
      }
      const meshes = [this.mesh(planFaceMesh(faces), [{ color: '#f5fbff', opacity: .14 }]),
        this.mesh(planFaceMesh(rims), [{ color: virtual ? '#92a9b7' : '#e6edf1', opacity: virtual ? .72 : .52 }])];
      for (const mesh of meshes) mesh.userData.plan3dPick = { occludes: false };
      this.markerGlass.add(...meshes);
      this.transparencyDirty = true;
      this.glassMeshes.set(id, { key, meshes });
    }
    for (const [id, entry] of this.glassMeshes) if (!live.has(id)) {
      this.disposeGlass(entry.meshes);
      this.glassMeshes.delete(id);
    }
  }

  private disposeGlass(meshes: readonly Mesh[]): void {
    this.transparencyDirty = true;
    for (const mesh of meshes) {
      this.markerGlass.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
  }

  presentLights(lights: readonly Plan3dLight[]): void { this.light.set(lights); }

  get loading(): boolean { return this.backdropLoading || this.floorInkLoading; }

  private material(paint: Paint): MeshBasicMaterial {
    const options = { color: paint.color, opacity: paint.opacity, transparent: paint.opacity < 1,
      depthWrite: paint.opacity >= 1, side: paint.front ? FrontSide : DoubleSide,
      forceSinglePass: true, toneMapped: false, visible: paint.opacity > 0 };
    const material = paint.lit ? this.light.material(options, paint.shadeSides) : new MeshBasicMaterial(options);
    if (material.transparent) material.userData.plan3dSurfaceKey = JSON.stringify(paint);
    return material;
  }

  private mesh(geometry: BufferGeometry, paints: readonly Paint[]): Mesh {
    const materials = paints.map(paint => this.material(paint));
    const mesh = new Mesh(geometry, materials.length === 1 ? materials[0] : materials);
    return mesh;
  }

  private replace(target: Group, meshes: DrawObject[]): void {
    if (target === this.structure || target === this.openings || target === this.furniture || target === this.stairs)
      this.transparencyDirty = true;
    for (const child of [...target.children]) {
      if (!(child instanceof Mesh) && !(child instanceof LineSegments)) continue;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    }
    target.clear();
    if (meshes.length) target.add(...meshes);
  }

  private openingMeshes(surfaces: readonly IsoOpeningSurface[], palette: Record<string, string>, top: Paint, side: Paint): Mesh[] {
    const batches = new Map<string, { paint: Paint; faces: Face[] }>();
    const translucent: Mesh[] = [];
    const translucentMasonry = top.opacity < 1 || side.opacity < 1;
    for (const surface of surfaces) {
      if (!surface.points?.length) continue;
      const useFacing = translucentMasonry && surface.masonrySide !== undefined;
      if (translucentMasonry && (surface.masonrySide === 'join'
        || (!useFacing && surface.hiddenInTranslucentMasonry))) continue;
      const color = openingPaint(surface, palette, top, side);
      const paint = useFacing ? { ...color, front: true } : color;
      const points = surface.points.map(({ point: [x, y], z }): Plan3dVertex => [x, y, z]);
      const face: Face = [useFacing && surface.masonrySide === 'reverse' ? points.reverse() : points];
      // A glass or fabric face has its own sortable location. Batching all
      // translucent panes under one material loses their relative order.
      if (paint.opacity < 1) {
        if (paint.opacity > 0) translucent.push(this.mesh(planFaceMesh([face]), [paint]));
        continue;
      }
      const key = JSON.stringify(paint);
      let batch = batches.get(key);
      if (!batch) batches.set(key, batch = { paint, faces: [] });
      batch.faces.push(face);
    }
    return [...batches.values()].map(({ paint, faces }) => this.mesh(planFaceMesh(faces), [paint])).concat(translucent);
  }

  private wallMeshes(walls: readonly Polygon[], shell: ReturnType<typeof plan3dWallShell>, height: number,
    surfaces: readonly IsoOpeningSurface[], top: Paint, side: Paint): Mesh[] {
    // Do not split plain opaque walls into separate cap and side batches.
    // A gate has no joined masonry but still needs the shared jamb clipping.
    if (top.opacity >= 1 && side.opacity >= 1 && !shell.joined
      && !surfaces.some(surface => surface.kind === 'jamb-reveal')) {
      return [this.mesh(planPrismMesh(walls, 0, height), [top, side, side])];
    }
    const meshes: Mesh[] = [];
    const append = (faces: Face[], paint: Paint) => {
      if (!faces.length || paint.opacity <= 0) return;
      if (paint.opacity >= 1) meshes.push(this.mesh(planFaceMesh(faces), [paint]));
      else for (const face of faces) meshes.push(this.mesh(planFaceMesh([face]), [paint]));
    };
    append(walls.map(wall => horizontal(wall, height)), top);
    append(plan3dCladWallSides(shell.bands, surfaces).map(face => [face]), side);
    return meshes;
  }

  private groundShadow(floor: readonly Polygon[], scale: number): void {
    const key = [floor, scale];
    if (same(this.groundKey, key)) return;
    this.groundKey = key;
    this.replace(this.ground, []);
    this.groundTexture?.dispose();
    this.groundTexture = undefined;
    if (!floor.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const path = new Path2D();
    for (const polygon of floor) for (const ring of polygon) {
      ring.forEach(([x, y], index) => {
        if (index) path.lineTo(x, y); else path.moveTo(x, y);
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      });
      path.closePath();
    }
    const margin = scale * 20;
    const x = minX - margin, y = minY - margin, w = maxX - minX + margin * 2, h = maxY - minY + margin * 2;
    if (!(w > 0 && h > 0 && Number.isFinite(w + h))) return;
    const density = Math.min(2, 1024 / Math.max(w, h));
    const canvas = this.document.createElement('canvas');
    canvas.width = Math.ceil(w * density); canvas.height = Math.ceil(h * density);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(canvas.width / w, 0, 0, canvas.height / h, -x * canvas.width / w, -y * canvas.height / h);
    context.filter = `blur(${Math.max(1, 5 * scale * density)}px)`;
    context.fillStyle = 'rgba(25,40,51,.24)';
    context.fill(path, 'evenodd');
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const geometry = new PlaneGeometry(w, h);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(x + w / 2, -scale * .3, y + h / 2);
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.userData.plan3dPick = { occludes: false };
    mesh.renderOrder = -4;
    this.groundTexture = texture;
    this.replace(this.ground, [mesh]);
  }

  private furnitureMeshes(item: Plan3dFurniture, width: number, depth: number, visualScale: number): Mesh[] {
    const { shape, liftCm, color, opacity } = item;
    const base = furnitureParts(shape.symbol);
    if (!base) return [];
    const parts = shape.workstation ? workstationParts(shape, base, furnitureParts('computer') ?? []) : base;
    const heightScale = FURNITURE_HEIGHT_SCALE * visualScale;
    const mirrored = Boolean(shape.flip_h) !== Boolean(shape.flip_v);
    const pigment = new Color(color);
    const top = colorString(new Color('#f7fbfc').lerp(pigment, .12));
    const side = colorString(new Color('#e4edf0').lerp(pigment, .16));
    const map = ([x, y, z]: Plan3dVertex): Plan3dVertex => {
      const [tx, ty] = furniturePlanPoint(shape, [x, y], width, depth);
      return [tx, ty, (z + liftCm) * heightScale];
    };
    return parts.flatMap(part => {
      const faces = furnitureVolumeFaces(part, shape.w * width, shape.h * depth, heightScale);
      const split = (cap: boolean) => faces.filter(face => face.cap === cap).map(face =>
        face.loops.map(loop => mirrored ? loop.map(map).reverse() : loop.map(map)));
      // Treat the recipes as closed volumes, as the 2.5D visible-face pass
      // does. Back-facing surfaces and a late wireframe would turn these
      // intentionally light materials into x-rays (including through walls).
      return [this.mesh(planFaceMesh(split(true)), [{ color: top, opacity: opacity * .72, lit: true, front: true }]),
        this.mesh(planFaceMesh(split(false)), [{ color: side, opacity: opacity * .52, lit: true, front: true }])];
    });
  }

  private updateStairs(stairs: NonNullable<Plan3dWorldInput['stairs']>): void {
    const key = stairs.flatMap(({ id, volume, color }) => [id, volume, color]);
    if (same(key, this.stairKey)) return;
    const meshes = stairs.flatMap(({ id, volume, color }) => {
      const pigment = new Color(color);
      const top = colorString(new Color('#f7fbfc').lerp(pigment, .12));
      const side = colorString(new Color('#e4edf0').lerp(pigment, .16));
      const faces = [true, false].map(cap => volume.faces.filter(face => face.cap === cap).map(face => [face.vertices]));
      const solid = faces.map((surfaces, index) => {
        const mesh = this.mesh(planFaceMesh(surfaces), [{ color: index ? side : top, opacity: index ? .34 : .47, lit: true }]);
        mesh.userData.plan3dPick = { id: `stair:${id}` };
        return mesh;
      });
      return [...solid, faceInk(faces.flat(), color, .3)];
    });
    this.replace(this.stairs, meshes);
    this.stairKey = key;
  }

  private updateRibbons(ribbons: readonly Plan3dLedRibbon[], height: number): void {
    const live = new Set<string>();
    for (const ribbon of ribbons) {
      const { id, owner, path, width, depth, outline, color, opacity } = ribbon;
      live.add(id);
      const key = [owner, path, width, height, depth, outline];
      let paint = this.ribbonMeshes.get(id);
      if (!paint || !same(paint.geometry, key)) {
        if (paint) this.disposeRibbon(paint);
        const edge = { color: '#808080', opacity: 1 };
        const body = this.mesh(planPrismMesh(ribbonFloor(path, width), height - depth, height),
          [{ color: outline, opacity: 1 }, edge, edge]);
        body.userData.plan3dPick = { id: owner };
        const core = new Mesh(planFaceMesh(ribbonFloor(path, width / 2).map(polygon => horizontal(polygon, height))),
          new MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true,
            polygonOffsetFactor: -1, polygonOffsetUnits: -1, toneMapped: false }));
        core.userData.plan3dPick = { occludes: false };
        this.ribbons.add(body, core);
        this.transparencyDirty = true;
        this.ribbonMeshes.set(id, paint = { geometry: key, body, core });
      }
      paint.core.material.color.set(color);
      paint.core.material.opacity = opacity;
    }
    for (const [id, paint] of this.ribbonMeshes) if (!live.has(id)) {
      this.disposeRibbon(paint);
      this.ribbonMeshes.delete(id);
    }
  }

  private disposeRibbon({ body, core }: { body: Mesh; core: Mesh<BufferGeometry, MeshBasicMaterial> }): void {
    this.ribbons.remove(body, core);
    this.transparencyDirty = true;
    body.geometry.dispose(); core.geometry.dispose(); core.material.dispose();
    const materials = Array.isArray(body.material) ? body.material : [body.material];
    for (const material of materials) material.dispose();
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
      const faces = polygons(geometry).map(polygon => horizontal(polygon, 0));
      const material = this.light.material({ color, opacity, visible: opacity > 0, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new Mesh(planFaceMesh(faces), material);
      mesh.renderOrder = -2;
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

  private updateBackdrop(input: Plan3dImage | undefined): void {
    const key = input && JSON.stringify([input.url, input.x, input.y, input.w, input.h, input.angle, input.opacity]);
    if (this.backdropKey === key) return;
    this.backdropKey = key;
    const generation = ++this.imageGeneration;
    this.replace(this.backdrop, []);
    this.backdropTexture?.dispose();
    this.backdropTexture = this.backdropReady = undefined;
    this.backdropFailed = false;
    this.backdropLoading = false;
    if (!input || !(input.w > 0 && input.h > 0 && input.opacity > 0)) return;
    if (!input.url) {
      this.backdropFailed = true;
      return;
    }
    const image = this.document.createElement('img');
    image.src = input.url;
    this.backdropLoading = true;
    this.backdropReady = image.decode().then(() => {
      if (this.imageGeneration !== generation) return;
      const texture = new Texture(image);
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      this.backdropTexture = texture;
      this.replace(this.backdrop, [this.planarInk(texture, input, input.angle, input.opacity, -3)]);
    }, () => {
      if (this.imageGeneration === generation) this.backdropFailed = true;
    }).finally(() => {
      if (this.imageGeneration === generation) {
        this.backdropLoading = false;
        this.changed?.();
      }
    });
  }

  private planarInk(texture: Texture, { x, y, w, h }: ViewRect, angle: number, opacity: number, order: number): Mesh {
    const geometry = new PlaneGeometry(w, h);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(-angle * Math.PI / 180);
    geometry.translate(x + w / 2, 0, y + h / 2);
    const material = this.light.material({ map: texture, opacity, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -(order + 4), polygonOffsetUnits: -(order + 4) });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = order;
    mesh.userData.plan3dPick = { occludes: false };
    return mesh;
  }

  private updateFloorInk(input: Plan3dFloorInk | undefined): void {
    const key = input?.key ?? [];
    if (same(key, this.floorInkKey)) return;
    this.floorInkKey = key;
    this.floorInkWork?.controller.abort();
    this.floorInkWork = undefined;
    this.floorInkLoading = false;
    if (!input || input.scope !== this.floorInkScope) {
      this.replace(this.floorInk, []);
      this.floorInkTexture?.dispose();
      this.floorInkTexture = undefined;
    }
    this.floorInkScope = input?.scope;
    if (!input) return;
    const controller = new AbortController(), { signal } = controller;
    this.floorInkLoading = true;
    const ready = input.capture(signal).then(async blob => {
      if (!blob || signal.aborted) return false;
      const image = this.document.createElement('img'), url = URL.createObjectURL(blob);
      try {
        image.src = url;
        await image.decode();
        if (signal.aborted) return false;
        const texture = new Texture(image);
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        this.replace(this.floorInk, [this.planarInk(texture, input.bounds, 0, 1, -1)]);
        this.floorInkTexture?.dispose();
        this.floorInkTexture = texture;
        return true;
      } finally { URL.revokeObjectURL(url); }
    }).catch(() => false).finally(() => {
      if (!signal.aborted) {
        this.floorInkLoading = false;
        this.changed?.();
      }
    });
    this.floorInkWork = { controller, ready };
  }

  async ready(): Promise<boolean> {
    const [, floor] = await Promise.all([this.backdropReady, this.floorInkWork?.ready]);
    return !this.backdropFailed && floor !== false;
  }

  present(input: Plan3dWorldInput): void {
    const { physical, display, cellCm, panels, furniture, paper, visualScale, decorWidth, decorHeight } = input;
    this.light.set(input.lights);
    this.updateBackdrop(input.backdrop);
    this.updateFloorInk(input.floorInk);
    this.updateRooms(input.rooms);
    this.updateStairs(input.stairs ?? []);
    this.updateRibbons(input.ribbons ?? [], gridVisualUnits(isoDisplayWallHeight(), cellCm));
    const style = isoWallMaterial(display.color, display.wallFill.c, display.opacity);
    const top: Paint = { color: display.transparentWalls3d ? display.color : style.topHi,
      opacity: display.transparentWalls3d ? display.opacity : 1 };
    const wallOnPaper = new Color('#fff').lerp(new Color(display.wallFill.c), display.wallFill.a);
    const side: Paint = { color: display.transparentWalls3d ? display.wallFill.c : colorString(wallOnPaper),
      opacity: display.transparentWalls3d ? display.wallFill.a : 1, lit: true, shadeSides: true };
    const palette = isoOpeningMaterialVars(display.openingAccent3d?.c, display.openingAccent3d?.a);
    const styleKey = [cellCm, top.color, side.color, top.opacity, side.opacity, display.hideOpenings,
      display.openingAccent3d?.c, display.openingAccent3d?.a];
    const structureKey = [physical, paper, ...styleKey];
    if (!same(this.structureKey, structureKey)) {
      const wallHeight = gridVisualUnits(isoDisplayWallHeight(), cellCm);
      const base = polygons(physical.floor);
      this.groundShadow(base, visualScale);
      const floor: Paint = { color: paper, opacity: 1, lit: true };
      const walls = polygons(physical.walls);
      const authoredMasonry = new Set(physical.openingSurfaces.filter(surface =>
        surface.kind === 'window-apron-top' || surface.kind === 'opening-lintel-top').map(surface => surface.id));
      const shell = plan3dWallShell(walls, physical.openings.filter(opening => authoredMasonry.has(opening.id)), wallHeight);
      const surfaces = physical.openingSurfaces.filter(surface =>
        !(shell.joined && (surface.kind === 'window-apron-side' || surface.kind === 'opening-lintel-side'))
        && (!display.hideOpenings || surface.material === 'wall-top'
          || surface.material === 'wall-side' || surface.material === 'reveal'));
      const meshes = [
        this.mesh(planFaceMesh(base.map(polygon => horizontal(polygon, 0))), [floor]),
        ...this.wallMeshes(walls, shell, wallHeight, surfaces, top, { ...side, front: side.opacity < 1 }),
        ...this.openingMeshes(surfaces, palette, top, side),
      ];
      this.replace(this.structure, meshes);
      this.replace(this.architecture, wallInk(shell, top, side));
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
      ...furniture.flatMap(item => [item.record, item.cabinet, item.liftCm, item.color, item.opacity,
        furnitureParts(item.shape.symbol), item.shape.workstation ? furnitureParts('computer') : null])];
    if (!same(this.furnitureKey, furnitureKey)) {
      this.replace(this.furniture, furniture.flatMap(item => this.furnitureMeshes(item, decorWidth, decorHeight, visualScale)));
      this.furnitureKey = furnitureKey;
    }
    const enabled = display.transparentWalls3d && ((top.opacity > 0 && top.opacity < 1) || (side.opacity > 0 && side.opacity < 1))
      && Array.isArray(physical.walls) && physical.walls.length > 0 && this.furniture.children.length > 0;
    if (enabled !== this.transparencyEnabled) {
      this.transparencyEnabled = enabled;
      this.transparencyDirty = true;
    }
  }

  private syncTransparency(): void {
    if (!this.transparencyDirty) return;
    this.transparencyDirty = false;
    if (!this.transparencyEnabled) {
      this.transparency.clear();
      return;
    }
    const transparentMeshes = (groups: Group[]) => groups.flatMap(group => group.children.filter(
      (object): object is Mesh<BufferGeometry, MeshBasicMaterial> => object instanceof Mesh && object.renderOrder === 0
        && object.material instanceof MeshBasicMaterial && object.material.transparent && object.material.visible
        && !object.material.map && !object.material.alphaMap,
    ));
    const shell = transparentMeshes([this.structure, this.openings]);
    // These are physical surfaces at the same priority as the masonry.
    // Floor paint/shadows and explicit late edge ink have their own strata.
    const content = transparentMeshes([this.furniture, this.stairs, this.markerGlass, this.ribbons]);
    const blended = this.transparency.setSources([...shell, ...content], shell.length);
    if (blended && !blended.parent) this.scene.add(blended);
  }

  dispose(): void {
    this.transparency.clear();
    this.replace(this.structure, []);
    this.replace(this.architecture, []);
    this.replace(this.ground, []);
    this.groundTexture?.dispose();
    this.replace(this.contacts, []);
    this.contactTexture?.dispose();
    this.replace(this.openings, []);
    this.replace(this.furniture, []);
    this.replace(this.stairs, []);
    this.updateRibbons([], 0);
    this.updateRooms([]);
    this.updateBackdrop(undefined);
    this.updateFloorInk(undefined);
    this.markers.dispose();
    this.presentOutlines([], 0);
    this.light.dispose();
  }
}
