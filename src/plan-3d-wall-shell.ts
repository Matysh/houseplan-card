import { union, type Geom } from 'polyclip-ts';
import { isoOpeningMasonry, type IsoOpeningBasis } from './iso-openings';
import type { Plan3dVertex } from './plan-3d-mesh';
import type { PlanPoint } from './iso-projection';

type Polygon = readonly (readonly PlanPoint[])[];
type Band = Readonly<{ polygons: readonly Polygon[]; low: number; high: number }>;
type Side = { a: PlanPoint; b: PlanPoint; low: number; high: number };
const signedArea = (ring: readonly PlanPoint[]) => ring.reduce((area, [x, y], i) => {
  const [bx, by] = ring[(i + 1) % ring.length];
  return area + x * by - bx * y;
}, 0);

/** A slab sees only the masonry present at its height. Its boundary never
 * contains the hidden interface where an opening's apron or header meets
 * the rest of the wall. No camera-dependent geometry or pixels enter here. */
export function plan3dWallShell(walls: readonly Polygon[], openings: readonly IsoOpeningBasis[], height: number) {
  const masonry = openings.flatMap(opening => {
    const body = isoOpeningMasonry(opening);
    return body && body.top > body.bottom ? [body] : [];
  });
  const base: Band = { polygons: walls, low: 0, high: height };
  const levels = [...new Set([0, height, ...masonry.flatMap(body => [body.bottom, body.top])])]
    .filter(level => level >= 0 && level <= height).sort((a, b) => a - b);
  const bands: Band[] = [];
  try {
    for (let i = 1; i < levels.length; i++) {
      const low = levels[i - 1], high = levels[i];
      const cores = masonry.filter(body => body.bottom <= low && body.top >= high)
        .map(body => [[...body.ring, body.ring[0]]] as Geom);
      const geometry = cores.length ? union(cores[0], ...cores.slice(1), ...walls as readonly Geom[]) : walls;
      bands.push({ polygons: geometry, low, high });
    }
    return { bands, joined: masonry.length > 0 };
  } catch {
    // Keep the original host and separate opening solids on unusual invalid
    // geometry; this is not a reason to fail the 3D view.
    return { bands: [base], joined: false };
  }
}

function rings(polygons: readonly Polygon[]) {
  return polygons.flatMap(polygon => polygon.flatMap((raw, i) => {
    const ring = raw.filter((point, j) => !j || point.some((n, k) => n !== raw[j - 1][k]));
    if (ring.length > 1 && ring[0].every((n, k) => n === ring[ring.length - 1][k])) ring.pop();
    if (ring.length < 3) return [];
    // Always keep material on the left of the directed exterior/inner edge.
    if ((signedArea(ring) > 0) !== (i === 0)) ring.reverse();
    return [ring];
  }));
}

export function plan3dWallSideFaces(bands: readonly Band[]): Plan3dVertex[][] {
  const runs = new Map<string, Side>();
  const faces: Plan3dVertex[][] = [];
  const push = ({ a: [ax, ay], b: [bx, by], low, high }: Side) =>
    faces.push([[ax, ay, low], [bx, by, low], [bx, by, high], [ax, ay, high]]);
  for (const { polygons, low, high } of bands) for (const ring of rings(polygons)) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const key = a + '>' + b;
      const last = runs.get(key);
      if (last?.high === low) last.high = high;
      else {
        if (last) push(last);
        runs.set(key, { a, b, low, high });
      }
    }
  }
  for (const run of runs.values()) push(run);
  return faces;
}

export function plan3dWallInk(bands: readonly Band[]) {
  const contour = (band: Band | undefined, height: number): number[] => band ? rings(band.polygons).flatMap(ring =>
    ring.flatMap(([x, y], i) => {
      const [bx, by] = ring[(i + 1) % ring.length];
      return [x, height, y, bx, height, by];
    })) : [];
  const vertical: number[] = [];
  const corners = new Map<string, { x: number; y: number; low: number; high: number }>();
  const push = ({ x, y, low, high }: { x: number; y: number; low: number; high: number }) =>
    vertical.push(x, low, y, x, high, y);
  for (const { polygons, low, high } of bands) for (const ring of rings(polygons)) {
    ring.forEach(([x, y], i) => {
      const [ax, ay] = ring[(i + ring.length - 1) % ring.length], [bx, by] = ring[(i + 1) % ring.length];
      const ux = x - ax, uy = y - ay, vx = bx - x, vy = by - y;
      const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      if (!(length > 0) || (ux * vx + uy * vy) / length >= .95) return;
      const key = x + ',' + y, run = corners.get(key);
      if (run?.high === low) run.high = high;
      else {
        if (run) push(run);
        corners.set(key, { x, y, low, high });
      }
    });
  }
  for (const run of corners.values()) push(run);
  const top = bands[bands.length - 1];
  return { cap: contour(top, top?.high ?? 0), base: contour(bands[0], 0), vertical };
}
