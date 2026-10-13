import { smoothVacPath, VAC_TRAIL_SMOOTH_RADIUS_CM, type Affine, type VacPath, type VacPathCommand } from './vacuum';
import { VacuumPathGeometryCache, VAC_SIMPLIFY_CM, type VacuumRenderGeometry } from './vacuum-path-geometry';

export interface VacuumSvgFrame { d: string; count: number; rawPoints: number; limited: boolean }
const serialized = new WeakMap<VacuumRenderGeometry, VacuumSvgFrame>();

export function vacuumTrailSvg(
  cache: VacuumPathGeometryCache, path: VacPath, matrix: Affine,
  cmPerUnit: number, budget: number,
): VacuumSvgFrame {
  const geometry = cache.resolve(path, matrix, cmPerUnit, budget);
  const cached = serialized.get(geometry);
  if (cached) return cached;
  // The complete 17.5 cm bound includes simplification and serialization;
  // shortest-roundtrip numeric text introduces no extra decimal quantization.
  const radius = geometry.physicalVerified
    ? (VAC_TRAIL_SMOOTH_RADIUS_CM - VAC_SIMPLIFY_CM) / cmPerUnit : 0;
  const commands: VacPathCommand[][] = geometry.path.filter((p) => p.length).flatMap((p) => {
    // A round-capped zero-length subpath visibly marks the real endpoint;
    // never join it to the budget-cut prefix or fabricate a tip to the puck.
    if (p.length === 1) return [[{ kind: 'move', point: p[0] }, { kind: 'line', point: p[0] }]];
    return radius > 0 ? smoothVacPath([p], radius)
      : [p.map((point, i) => ({ kind: i ? 'line' : 'move', point }))];
  });
  const text = (point: readonly [number, number]): string => `${point[0]} ${point[1]}`;
  const d = commands.map((segment) => segment.map((command) => {
    if (command.kind === 'move') return `M ${text(command.point)}`;
    if (command.kind === 'quadratic') return `Q ${text(command.control)} ${text(command.point)}`;
    return `L ${text(command.point)}`;
  }).join(' ')).join(' ');
  const result = { d, count: geometry.renderedPoints, rawPoints: geometry.rawPoints, limited: geometry.limited };
  serialized.set(geometry, result);
  return result;
}
