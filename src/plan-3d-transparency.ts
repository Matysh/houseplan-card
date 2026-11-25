import { Box3, BufferAttribute, BufferGeometry, Camera, DynamicDrawUsage, Frustum, FrontSide, Matrix4,
  Mesh, MeshBasicMaterial, OrthographicCamera, Vector3 } from 'three';

type Point = readonly [number, number, number];
type Plane = Readonly<{ normal: Point; constant: number }>;
type Face = Readonly<{ points: readonly Point[]; plane: Plane; paint: number; source: number }>;
type Run = { start: number; end: number; paint: number; plane?: Plane; source: number };
type Node = Readonly<{ plane?: Plane; bounds: Box3; faces: readonly Run[]; low?: Node; high?: Node }>;
type Surface = Mesh<BufferGeometry, MeshBasicMaterial>;

const EPSILON = 1e-6;
const distance = ({ normal: [x, y, z], constant }: Plane, [a, b, c]: Point) => x * a + y * b + z * c + constant;
function sideOf(plane: Plane, points: readonly Point[]): number {
  let side = 0;
  for (const point of points) {
    const d = distance(plane, point);
    side |= d < -EPSILON ? 1 : d > EPSILON ? 2 : 0;
    if (side === 3) break;
  }
  return side;
}

function divide(plane: Plane, original: Face): [Face, Face] {
  const low: Point[] = [], high: Point[] = [];
  const { points } = original;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = distance(plane, a), db = distance(plane, b);
    if (da <= EPSILON) low.push(a);
    if (da >= -EPSILON) high.push(a);
    if ((da < -EPSILON && db > EPSILON) || (da > EPSILON && db < -EPSILON)) {
      const t = da / (da - db);
      const cut: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      low.push(cut);
      high.push(cut);
    }
  }
  return [{ ...original, points: low }, { ...original, points: high }];
}

function collect(surfaces: readonly Surface[]) {
  const paints: MeshBasicMaterial[] = [], faces: Face[] = [];
  const palette = new Map<string | MeshBasicMaterial, number>();
  for (const [source, surface] of surfaces.entries()) {
    const { geometry, material } = surface;
    const key = (material.userData.plan3dSurfaceKey as string | undefined) ?? material;
    let paint = palette.get(key);
    if (paint === undefined) {
      paint = paints.length;
      paints.push(material);
      palette.set(key, paint);
    }
    const vertex = geometry.getAttribute('position'), index = geometry.getIndex();
    const at = (i: number): Point => {
      const j = index?.getX(i) ?? i;
      return [vertex.getX(j), vertex.getY(j), vertex.getZ(j)];
    };
    for (let i = 0; i + 2 < (index?.count ?? vertex.count); i += 3) {
      const a = at(i), b = at(i + 1), c = at(i + 2);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      const scale = Math.hypot(x, y, z);
      if (scale <= EPSILON * EPSILON) continue;
      const normal: Point = [x / scale, y / scale, z / scale];
      faces.push({ points: [a, b, c], plane: { normal, constant: -distance({ normal, constant: 0 }, a) }, paint, source });
    }
  }
  return { faces, paints };
}

function partition(faces: readonly Face[], structuralCount: number) {
  const position: number[] = [], normal: number[] = [];
  // Guard against pathological authored geometry and never show a partially
  // built world. Typical plans are far below these worst-case work bounds.
  let work = 3_000_000;
  let fragments = Math.min(220_000, Math.max(4_096, faces.length * 4));
  const build = (pool: readonly Face[], depth: number): Node | undefined => {
    if (!pool.length) return undefined;
    const architecture = pool.filter(face => face.source < structuralCount);
    const samples = Math.min(8, architecture.length);
    work -= samples * architecture.length + pool.length;
    if (work < 0 || fragments < 0 || depth >= 96) throw new RangeError('3D transparency partition budget');
    let plane: Plane | undefined, best = Infinity;
    for (let i = 0; i < samples; i++) {
      const candidate = architecture[Math.floor(i * architecture.length / samples)].plane;
      let one = 0, two = 0, split = 0;
      for (const face of architecture) {
        const side = sideOf(candidate, face.points);
        if (side === 3) split++;
        else if (side === 1) one++;
        else if (side === 2) two++;
      }
      const score = 12 * split + Math.abs(one - two);
      if (score < best) {
        best = score;
        plane = candidate;
        if (best === 0) break;
      }
    }
    const low: Face[] = [], high: Face[] = [], runs: Run[] = [];
    const bounds = new Box3(), point = new Vector3();
    for (const face of pool) {
      switch (plane ? sideOf(plane, face.points) : 0) {
        case 1: low.push(face); break;
        case 2: high.push(face); break;
        case 3: {
          fragments--;
          const [a, b] = divide(plane!, face);
          low.push(a);
          high.push(b);
          break;
        }
        default: {
          const start = position.length / 3;
          const { points } = face;
          for (let i = 1; i + 1 < points.length; i++) {
            for (const v of [points[0], points[i], points[i + 1]]) {
              position.push(...v);
              normal.push(...face.plane.normal);
              bounds.expandByPoint(point.set(...v));
            }
          }
          const end = position.length / 3;
          const previous = runs[runs.length - 1];
          if (!plane && previous?.source === face.source) previous.end = end;
          else if (end > start) runs.push({ start, end, paint: face.paint, plane: plane ? face.plane : undefined, source: face.source });
        }
      }
    }
    const a = build(low, depth + 1), b = build(high, depth + 1);
    if (a) bounds.union(a.bounds);
    if (b) bounds.union(b.bounds);
    return { plane, bounds, faces: runs, low: a, high: b };
  };
  return { root: build(faces, 0), position, normal };
}

/** Classify translucent surfaces against architecture, splitting at actual
 * intersections. Each cell contains no wall plane, so its furniture can keep
 * the former mesh order without confusing a near wall with a far one. */
export class Plan3dTransparency {
  private sources: readonly Surface[] = [];
  private mesh?: Mesh<BufferGeometry, MeshBasicMaterial[]>;
  private root?: Node;
  private structuralCount = 0;
  private centers: Vector3[] = [];
  private readonly eye = new Vector3();
  private readonly center = new Vector3();
  private sourceDepths = new Float64Array(0);
  private sourceLayers: number[] = [];
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly lastProjection = new Matrix4();
  private prepared = false;

  setSources(surfaces: readonly Surface[], structuralCount: number): Mesh | undefined {
    if (structuralCount === this.structuralCount && surfaces.length === this.sources.length
      && surfaces.every((mesh, index) => mesh === this.sources[index])) return this.mesh;
    this.clear();
    this.sources = surfaces;
    this.structuralCount = structuralCount;
    if (!structuralCount || structuralCount === surfaces.length) return undefined;
    const { faces, paints } = collect(surfaces);
    let data;
    try {
      data = partition(faces, structuralCount);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return undefined;
    }
    this.root = data.root;
    if (!this.root) return undefined;
    this.centers = surfaces.map(({ geometry }) => {
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      return geometry.boundingSphere?.center.clone() ?? new Vector3();
    });
    this.sourceDepths = new Float64Array(surfaces.length);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from(data.position), 3));
    geometry.setAttribute('normal', new BufferAttribute(Float32Array.from(data.normal), 3));
    geometry.setIndex(new BufferAttribute(new Uint32Array(data.position.length / 3), 1).setUsage(DynamicDrawUsage));
    geometry.boundingBox = this.root.bounds;
    const mesh = this.mesh = new Mesh(geometry, paints);
    mesh.userData.plan3dPick = { occludes: false };
    mesh.frustumCulled = false;
    // Keep original objects in the pick traversal, with their original
    // geometry and material policy. Only the color camera excludes them.
    this.sourceLayers = surfaces.map(surface => {
      const mask = surface.layers.mask;
      surface.layers.mask = 0;
      return mask;
    });
    return mesh;
  }

  prepare(camera: Camera): void {
    const mesh = this.mesh, root = this.root;
    if (!mesh || !root) return;
    const projection = this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (this.prepared && projection.equals(this.lastProjection)) return;
    this.prepared = true;
    this.lastProjection.copy(projection);
    this.frustum.setFromProjectionMatrix(projection);
    const ortho = camera instanceof OrthographicCamera;
    if (ortho) camera.getWorldDirection(this.eye).negate();
    else this.eye.setFromMatrixPosition(camera.matrixWorld);
    const eye: Point = [this.eye.x, this.eye.y, this.eye.z];
    const depth = (plane: Plane) => distance(plane, eye) - (ortho ? plane.constant : 0);
    const { geometry, material } = mesh;
    const index = geometry.getIndex()!;
    const order = index.array as Uint32Array;
    const sortCenter = this.sourceDepths;
    for (const [i, center] of this.centers.entries()) sortCenter[i] = this.center.copy(center).applyMatrix4(projection).z;
    geometry.clearGroups();
    let cursor = 0, dirty = false;
    const visit = (node: Node | undefined) => {
      if (!node || !this.frustum.intersectsBox(node.bounds)) return;
      const positive = node.plane ? depth(node.plane) >= 0 : true;
      visit(positive ? node.low : node.high);
      const runs = node.plane ? node.faces : [...node.faces].sort((a, b) => sortCenter[b.source] - sortCenter[a.source]);
      for (const { start, end, paint, plane } of runs) {
        if (plane && material[paint].side === FrontSide && depth(plane) < 0) continue;
        const previous = geometry.groups[geometry.groups.length - 1];
        if (previous?.materialIndex === paint) previous.count += end - start;
        else geometry.addGroup(cursor, end - start, paint);
        for (let i = start; i < end; i++, cursor++) {
          if (order[cursor] !== i) {
            order[cursor] = i;
            dirty = true;
          }
        }
      }
      visit(positive ? node.high : node.low);
    };
    visit(root);
    if (dirty) index.needsUpdate = true;
  }

  clear(): void {
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh.geometry.dispose();
      this.sources.forEach((source, i) => { source.layers.mask = this.sourceLayers[i]; });
    }
    this.sources = [];
    this.structuralCount = 0;
    this.centers = [];
    this.sourceLayers = [];
    this.mesh = undefined;
    this.root = undefined;
    this.prepared = false;
  }
}
