/** UI Lab: sample the existing floor field at a wall's foot, then extrude
 * that one-dimensional lighting profile vertically. No second light sweep. */
import { nothing, svg } from 'lit';
import { GLOW_FALLOFF } from './glow-scene';
import { gridVisualUnits } from './grid-scale';
import { isoRotationBasis, projectPlanPoint, type IsoCamera, type PlanPoint } from './iso-projection';
import type { IsoWallDepthQueueEntry } from './iso-scene-geometry';
import type { IsoWallGeometry } from './iso-walls';

export interface IsoWallLightSource {
  key: string;
  color: string;
  alpha: number;
  radius: number;
  /** One point for a lamp; a continuous polyline for an LED strip. */
  points: readonly (readonly number[])[];
  visible: readonly string[];
  rule?: CanvasFillRule;
  floorClip?: readonly string[] | null;
  entering: boolean;
  leaving: boolean;
}

const paths = new Map<string, Path2D>();
let context: CanvasRenderingContext2D | null = null;
const pathOf = (d: string): Path2D => {
  let path = paths.get(d);
  if (!path) {
    path = new Path2D(d);
    if (paths.size >= 128) paths.delete(paths.keys().next().value!);
    paths.set(d, path);
  }
  return path;
};
type Profile = number[][];
type Profiles = { key: string; byEdge: Map<string, Profile | null> };
const profiles = new WeakMap<IsoWallGeometry, Profiles>();

function floorEdge(entry: IsoWallDepthQueueEntry): readonly [PlanPoint, PlanPoint] | null {
  if (entry.layer === 'wall-side') return entry.face.planEdge ?? null;
  if (entry.layer !== 'opening' || entry.surface.material !== 'wall-side') return null;
  const points = entry.surface.points;
  if (!points?.length || Math.max(...points.map(p => p.z)) - Math.min(...points.map(p => p.z)) < 1e-5) return null;
  const unique: PlanPoint[] = [];
  for (const { point } of points) if (!unique.some(p => Math.hypot(p[0] - point[0], p[1] - point[1]) < 1e-5)) unique.push(point);
  // Vertical masonry faces have precisely two plan-space ends. Horizontal
  // sills, lintel undersides and the wall cut are outside this experiment.
  return unique.length === 2 ? [unique[0], unique[1]] : null;
}

function distance(points: IsoWallLightSource['points'], x: number, y: number): number {
  if (!points.length) return Infinity;
  let best = Math.hypot(x - points[0][0], y - points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / length)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
  }
  return best;
}

function falloff(fraction: number): number {
  const value = Math.max(0, fraction) * 100;
  for (let i = 1; i < GLOW_FALLOFF.length; i++) {
    const [a, av] = GLOW_FALLOFF[i - 1], [b, bv] = GLOW_FALLOFF[i];
    if (value <= b) return av + (bv - av) * (value - a) / (b - a);
  }
  return 0;
}

/** One world-space sample per furniture part, sharing the wall optical field. */
export function isoFurnitureLightSampler(sources: readonly IsoWallLightSource[]) {
  if (typeof Path2D === 'undefined' || !sources.length) return undefined;
  context ??= document.createElement('canvas').getContext('2d');
  const ctx = context;
  if (!ctx) return undefined;
  const field = sources.map(source => ({
    source, visible: pathOf(source.visible.join(' ')), floor: source.floorClip?.map(pathOf),
  }));
  return ([x, y]: PlanPoint) => field.flatMap(({ source, visible, floor }) => {
    const alpha = source.alpha * falloff(distance(source.points, x, y) / source.radius);
    return alpha > .0001 && ctx.isPointInPath(visible, x, y, source.rule ?? 'evenodd')
      && (!floor || floor.some(path => ctx.isPointInPath(path, x, y, 'evenodd'))) ? [{ source, alpha }] : [];
  });
}

export function isoWallLightPainter(
  sources: readonly IsoWallLightSource[], camera: IsoCamera, cellCm: number, geometry: IsoWallGeometry,
) {
  if (!sources.length || typeof Path2D === 'undefined') return () => nothing;
  context ??= document.createElement('canvas').getContext('2d');
  const ctx = context;
  if (!ctx) return () => nothing;
  // Depth-queue entries are transient, even for the same physical floor.
  // Attach the optical cache to its stable wall geometry, then key by edge.
  const key = JSON.stringify([camera.rotDeg, cellCm, sources.map(s =>
    [s.points, s.radius, s.alpha, s.visible, s.rule, s.floorClip])]);
  let cached = profiles.get(geometry);
  if (!cached || cached.key !== key) {
    cached = { key, byEdge: new Map() };
    profiles.set(geometry, cached);
  }
  const { byEdge } = cached;
  const projectField = () => sources.map(source => ({
    source, visible: pathOf(source.visible.join(' ')), floor: source.floorClip?.map(pathOf) ?? null,
  }));
  let field: ReturnType<typeof projectField> | undefined;
  const [cos, sin] = isoRotationBasis(camera);
  const epsilon = gridVisualUnits(.05, cellCm);
  return (entry: IsoWallDepthQueueEntry, faceIndex: number) => {
    const edge = floorEdge(entry);
    if (!edge) return nothing;
    const [start, end] = edge;
    const edgeKey = [start[0], start[1], end[0], end[1]].join(',');
    let profile = byEdge.get(edgeKey);
    if (profile === undefined) {
      const dx = end[0] - start[0], dy = end[1] - start[1];
      const length = Math.hypot(dx, dy);
      if (length <= 1e-5) return nothing;
      // Sample just outside the masonry on the visible side of the face.
      const sign = dy * sin - dx * cos >= 0 ? 1 : -1;
      const nx = sign * dy / length * epsilon, ny = -sign * dx / length * epsilon;
      const steps = Math.min(128, Math.max(2, Math.ceil(length / gridVisualUnits(10, cellCm))));
      field ??= projectField();
      const values = field.map(({ source, visible, floor }) => Array.from({ length: steps + 1 }, (_, i) => {
        const t = Math.max(1e-6, Math.min(1 - 1e-6, i / steps));
        const x = start[0] + t * dx + nx, y = start[1] + t * dy + ny;
        if (!ctx.isPointInPath(visible, x, y, source.rule ?? 'evenodd')
            || floor && !floor.some(path => ctx.isPointInPath(path, x, y, 'evenodd'))) return 0;
        return source.alpha * falloff(distance(source.points, x, y) / source.radius);
      }));
      profile = values.some(row => row.some(value => value > .0001)) ? values : null;
      byEdge.set(edgeKey, profile);
    }
    if (!profile) return nothing;
    const a = projectPlanPoint(start, 0, camera), b = projectPlanPoint(end, 0, camera);
    if (Math.abs(b[0] - a[0]) < 1e-6) return nothing;
    const d = entry.layer === 'opening' ? entry.surface.d : entry.face.d;
    // A sheared gradient keeps each iso-vertical line at one intensity: its
    // local x follows the floor edge, local y follows world height.
    const transform = `matrix(${b[0] - a[0]} ${b[1] - a[1]} 0 -1 ${a[0]} ${a[1]})`;
    return svg`<g class="iso-wall-light" data-wall-light-face=${faceIndex} pointer-events="none" aria-hidden="true">
      ${profile.map((values, index) => {
        if (!values.some(value => value > .0001)) return nothing;
        const source = sources[index], id = `hp-wall-light-${faceIndex}-${index}`;
        return svg`<defs><linearGradient id=${id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0" gradientTransform=${transform}>
          ${values.map((alpha, i) => svg`<stop offset=${i / (values.length - 1)} stop-color=${source.color} stop-opacity=${alpha}></stop>`)}
        </linearGradient></defs><path class="glow-spot ${source.entering ? 'is-entering' : ''} ${source.leaving ? 'is-leaving' : ''}"
          data-wall-light-source=${source.key} d=${d} fill=${`url(#${id})`} fill-rule="evenodd" style="mix-blend-mode:screen"></path>`;
      })}
    </g>`;
  };
}
