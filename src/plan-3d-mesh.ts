import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three';
import type { PlanPoint } from './iso-projection';

type PlanPolygon = readonly (readonly PlanPoint[])[];
export type Plan3dVertex = readonly [x: number, y: number, height: number];

/** Triangulate surfaces in their own dominant plane. Vertices never pass
 * through the view camera, so the same mesh works from either side. */
export function planFaceMesh(faces: readonly (readonly (readonly Plan3dVertex[])[])[]): BufferGeometry {
  const positions: number[] = [];
  for (const loops of faces) {
    const [outer, ...holes] = loops.filter(loop => loop.length >= 3);
    if (!outer) continue;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < outer.length; i++) {
      const a = outer[i], b = outer[(i + 1) % outer.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    if (Math.max(ax, ay, az) < 1e-10) continue;
    const project = ([x, y, z]: Plan3dVertex) =>
      az >= ax && az >= ay ? new Vector2(x, y) : ax >= ay ? new Vector2(y, z) : new Vector2(z, x);
    const points = [outer, ...holes].map(ring =>
      ring.length && ring[0].every((value, i) => value === ring[ring.length - 1][i]) ? ring.slice(0, -1) : ring);
    const vertices = points.flat();
    const [contour, ...cutouts] = points.map(ring => ring.map(project));
    const normal = az >= ax && az >= ay ? nz : ax >= ay ? nx : ny;
    const flat = [contour, ...cutouts].flat();
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, cutouts)) {
      const a = flat[i], b = flat[j], c = flat[k];
      const forward = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) * normal > 0;
      // World XZ uses the plan's XY. This swap reverses handedness.
      for (const index of forward ? [i, k, j] : [i, j, k]) {
        const [x, y, z] = vertices[index];
        positions.push(x, z, y);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function openRing(points: readonly PlanPoint[]): Vector2[] {
  const ring: Vector2[] = [];
  for (const [x, y] of points) {
    const last = ring[ring.length - 1];
    if (last?.x === x && last.y === y) continue;
    ring.push(new Vector2(x, y));
  }
  if (ring.length > 1 && ring[0].equals(ring[ring.length - 1])) ring.pop();
  return ring;
}

/** Extrude a union of plan polygons (outer ring followed by holes). The
 * result has separate material groups for the top, sides and underside.
 * Coordinates, normals and cutouts are independent of the view camera. */
export function planPrismMesh(polygons: readonly PlanPolygon[], bottom: number, top: number): BufferGeometry {
  const upper: number[] = [];
  const lower: number[] = [];
  const sides: number[] = [];
  const vertex = (out: number[], point: Vector2, height: number) => out.push(point.x, height, point.y);

  for (const polygon of polygons) {
    const outer = openRing(polygon[0] ?? []);
    if (outer.length < 3 || ShapeUtils.area(outer) === 0) continue;
    if (ShapeUtils.isClockWise(outer)) outer.reverse();

    const holes = polygon.slice(1).map(openRing).filter(ring => ring.length >= 3 && ShapeUtils.area(ring) !== 0);
    for (const hole of holes) if (!ShapeUtils.isClockWise(hole)) hole.reverse();

    const rings = [outer, ...holes];
    const vertices = rings.flat();
    for (const [i, j, k] of ShapeUtils.triangulateShape(outer, holes)) {
      const [a, b, c] = [vertices[i], vertices[j], vertices[k]];
      // Plan XY maps to world XZ; reversing positive plan winding faces up.
      const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const upperTriangle = area > 0 ? [a, c, b] : [a, b, c];
      for (const point of upperTriangle) vertex(upper, point, top);
      for (const point of [...upperTriangle].reverse()) vertex(lower, point, bottom);
    }

    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        vertex(sides, a, bottom);
        vertex(sides, b, top);
        vertex(sides, b, bottom);
        vertex(sides, a, bottom);
        vertex(sides, a, top);
        vertex(sides, b, top);
      }
    }
  }

  const positions = new Float32Array(upper.length + sides.length + lower.length);
  const geometry = new BufferGeometry();
  let offset = 0;
  for (const [material, vertices] of [upper, sides, lower].entries()) {
    if (vertices.length) geometry.addGroup(offset / 3, vertices.length / 3, material);
    positions.set(vertices, offset);
    offset += vertices.length;
  }
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
