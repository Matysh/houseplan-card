import {
  ISO_CAMERA, ISO_WALL_HEIGHT, projectPlanPoint,
  type IsoCamera, type PlanPoint, type ScenePoint,
} from './iso-projection';

export interface IsoWallFace {
  d: string;
  depth: number;
  polygon: number;
  ring: number;
  edge: number;
}

export interface IsoWallGeometry {
  topPath: string;
  sides: readonly IsoWallFace[];
  contactPath: string;
  edgeCount: number;
}

export interface IsoFloorFace {
  d: string;
  depth: number;
  component: number;
  edge: number;
  planEdge: readonly [PlanPoint, PlanPoint];
}

export interface IsoFloorGeometry {
  footprintPath: string;
  sides: readonly IsoFloorFace[];
  componentCount: number;
  edgeCount: number;
}

export function isoEffectiveView(
  desired: 'flat' | 'iso', fingerprint: string, failed: ReadonlySet<string>,
): 'flat' | 'iso' {
  return desired === 'iso' && fingerprint && !failed.has(fingerprint) ? 'iso' : 'flat';
}

const pointText = (point: ScenePoint): string =>
  `${Number(point[0].toFixed(4))} ${Number(point[1].toFixed(4))}`;

function openRing(raw: any): PlanPoint[] {
  const points = (Array.isArray(raw) ? raw : [])
    .filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    .map((point) => [Number(point[0]), Number(point[1])] as PlanPoint);
  const last = points[points.length - 1];
  if (points.length > 1 && points[0][0] === last[0] && points[0][1] === last[1])
    points.pop();
  return points;
}

function signedArea(points: readonly PlanPoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const point = points[index], next = points[(index + 1) % points.length];
    area += point[0] * next[1] - next[0] * point[1];
  }
  return area / 2;
}

/** Outer rings become positive, holes negative; solid always stays to the left. */
function normalizedRing(raw: any, hole: boolean): PlanPoint[] {
  const points = openRing(raw);
  if (points.length < 3) return [];
  const wantPositive = !hole;
  return (signedArea(points) > 0) === wantPositive ? points : [...points].reverse();
}

function canonicalRing(raw: any, hole: boolean): PlanPoint[] {
  const points = normalizedRing(raw, hole);
  if (!points.length) return points;
  let start = 0;
  for (let index = 1; index < points.length; index++) {
    if (points[index][0] < points[start][0]
        || (points[index][0] === points[start][0] && points[index][1] < points[start][1])) {
      start = index;
    }
  }
  return [...points.slice(start), ...points.slice(0, start)];
}

function topRingPath(points: readonly PlanPoint[], camera: IsoCamera, height: number): string {
  return points.length
    ? `M ${points.map((point) => pointText(projectPlanPoint(point, height, camera))).join(' L ')} Z`
    : '';
}

function visibleNormalY(a: PlanPoint, b: PlanPoint, camera: IsoCamera): number {
  // Normal points to the right of a normalized edge, away from the solid.
  const nx = b[1] - a[1], ny = -(b[0] - a[0]);
  const rot = camera.rotDeg * Math.PI / 180;
  return nx * Math.sin(rot) + ny * Math.cos(rot);
}

/** Build one top surface and at most one side per canonical ring edge: O(E). */
export function buildIsoWallGeometry(
  geometry: any,
  camera: IsoCamera = ISO_CAMERA,
  height = ISO_WALL_HEIGHT,
): IsoWallGeometry {
  if (!Number.isFinite(height) || height < 0) throw new Error('invalid wall height');
  const tops: string[] = [];
  const sides: IsoWallFace[] = [];
  const contacts: string[] = [];
  let edgeCount = 0;
  for (let polygon = 0; polygon < (geometry || []).length; polygon++) {
    const source = geometry[polygon];
    for (let ring = 0; ring < (source || []).length; ring++) {
      const points = normalizedRing(source[ring], ring > 0);
      if (points.length < 3 || Math.abs(signedArea(points)) < 1e-9) continue;
      tops.push(topRingPath(points, camera, height));
      edgeCount += points.length;
      for (let edge = 0; edge < points.length; edge++) {
        const a = points[edge], b = points[(edge + 1) % points.length];
        const floorA = projectPlanPoint(a, 0, camera);
        const floorB = projectPlanPoint(b, 0, camera);
        contacts.push(`M ${pointText(floorA)} L ${pointText(floorB)}`);
        if (visibleNormalY(a, b, camera) <= 1e-9) continue;
        const topB = projectPlanPoint(b, height, camera);
        const topA = projectPlanPoint(a, height, camera);
        sides.push({
          d: `M ${pointText(floorA)} L ${pointText(floorB)} L ${pointText(topB)} L ${pointText(topA)} Z`,
          depth: Math.max(floorA[1], floorB[1]), polygon, ring, edge,
        });
      }
    }
  }
  sides.sort((a, b) => a.depth - b.depth || a.polygon - b.polygon
    || a.ring - b.ring || a.edge - b.edge);
  return { topPath: tops.join(' '), sides, contactPath: contacts.join(' '), edgeCount };
}

/**
 * Project the already-unioned canonical room/exterior footprint. Only outer
 * rings receive a low edge; holes and nested rooms therefore cannot become
 * decorative steps. Polygon order and ring start points are canonicalised.
 */
export function buildIsoFloorGeometry(
  geometry: any,
  edgeHeight: number,
  camera: IsoCamera = ISO_CAMERA,
): IsoFloorGeometry {
  if (!Number.isFinite(edgeHeight) || edgeHeight < 0) throw new Error('invalid floor edge height');
  const components = (geometry || []).map((source: any) => {
    const rings = (source || []).map((ring: any, index: number) => canonicalRing(ring, index > 0))
      .filter((ring: PlanPoint[]) => ring.length >= 3 && Math.abs(signedArea(ring)) >= 1e-9);
    return rings;
  }).filter((rings: PlanPoint[][]) => rings.length && signedArea(rings[0]) > 0);
  components.sort((a: PlanPoint[][], b: PlanPoint[][]) => {
    const aa = a[0][0], bb = b[0][0];
    return aa[0] - bb[0] || aa[1] - bb[1]
      || Math.abs(signedArea(b[0])) - Math.abs(signedArea(a[0]));
  });

  const footprints: string[] = [];
  const sides: IsoFloorFace[] = [];
  let edgeCount = 0;
  for (let component = 0; component < components.length; component++) {
    const rings = components[component];
    for (const ring of rings) footprints.push(topRingPath(ring, camera, 0));
    const outer = rings[0];
    edgeCount += outer.length;
    for (let edge = 0; edge < outer.length; edge++) {
      const a = outer[edge], b = outer[(edge + 1) % outer.length];
      if (visibleNormalY(a, b, camera) <= 1e-9) continue;
      const floorA = projectPlanPoint(a, 0, camera);
      const floorB = projectPlanPoint(b, 0, camera);
      const lowB = projectPlanPoint(b, -edgeHeight, camera);
      const lowA = projectPlanPoint(a, -edgeHeight, camera);
      sides.push({
        d: `M ${pointText(floorA)} L ${pointText(floorB)} L ${pointText(lowB)} L ${pointText(lowA)} Z`,
        depth: Math.max(lowA[1], lowB[1]),
        component,
        edge,
        planEdge: [a, b],
      });
    }
  }
  sides.sort((a, b) => a.depth - b.depth || a.component - b.component || a.edge - b.edge);
  return {
    footprintPath: footprints.join(' '),
    sides,
    componentCount: components.length,
    edgeCount,
  };
}

function mixHash(hash: number, value: number): number {
  hash ^= Math.round((Number.isFinite(value) ? value : 0) * 64);
  return Math.imul(hash, 0x01000193) >>> 0;
}

/** Content fingerprint: intentionally independent of config epochs and HA state. */
export function isoGeometryFingerprint(value: unknown): string {
  let hash = 0x811c9dc5;
  const visit = (item: unknown): void => {
    if (typeof item === 'number') { hash = mixHash(hash, item); return; }
    if (typeof item === 'string') {
      for (const char of item) hash = mixHash(hash, char.codePointAt(0) || 0);
      return;
    }
    if (typeof item === 'boolean') { hash = mixHash(hash, item ? 1 : 0); return; }
    if (Array.isArray(item)) {
      hash = mixHash(hash, item.length);
      for (const child of item) visit(child);
      return;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      for (const key of Object.keys(record).sort()) { visit(key); visit(record[key]); }
      return;
    }
    hash = mixHash(hash, -1);
  };
  visit(value);
  return hash.toString(36);
}
