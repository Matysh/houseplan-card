/** Read-only aperture slices AFTER the canonical host/room eligibility proof. */
import type { GeometryOpeningProjection } from './plan-geometry-preflight';
import { motionOpeningFeatures, openingSlideDirection, type OpeningInterval } from './opening-features';
import type { SpaceModel } from './types';

/** Shared optical host proof. Explicit identity wins; legacy unhosted
 * openings still require physical room-side coverage at the caller. */
export function physicalOpeningHostRange(
  opening: GeometryOpeningProjection, space: SpaceModel, ux: number, uy: number, eps: number,
): [number, number] | null {
  const half = opening.rlen / 2;
  if (!opening.host) return [-half, half];
  const host = opening.host;
  if (host.kind !== 'wall' && host.kind !== 'partition') return null;
  if (!Number.isFinite(host.t) || host.t < 0 || host.t > 1) return null;
  const carriers = (host.kind === 'partition' ? space.partitions : space.wall_segments || [])
    .filter(carrier => carrier.id === host.id);
  if (carriers.length !== 1) return null;
  const carrier = carriers[0];
  if (!(carrier.cm > 0) || ![...carrier.a, ...carrier.b].every(Number.isFinite)) return null;
  if (host.kind === 'partition' && (!opening.partitionHost
      || opening.partitionHost.partition.id !== host.id)) return null;
  const [ax, ay] = carrier.a, [bx, by] = carrier.b;
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy);
  if (!(length > eps) || Math.abs(dx * uy - dy * ux) > length * 1e-6) return null;
  if (Math.hypot(ax + dx * host.t - opening.rx, ay + dy * host.t - opening.ry) > eps) return null;
  const a = (ax - opening.rx) * ux + (ay - opening.ry) * uy;
  const b = (bx - opening.rx) * ux + (by - opening.ry) * uy;
  return [Math.max(-half, Math.min(a, b)), Math.min(half, Math.max(a, b))];
}

export function offsetOpeningProjection<T extends GeometryOpeningProjection>(opening: T, offset: number, length = opening.rlen): T {
  const rad = opening.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
  const rx = opening.rx + ux * offset, ry = opening.ry + uy * offset;
  return { ...opening, rx, ry, rlen: length,
    ...(opening.partitionHost ? { partitionHost: { ...opening.partitionHost,
      center: [rx, ry] as [number, number], length,
      t: opening.partitionHost.t + offset * (ux * opening.partitionHost.axis.ux
        + uy * opening.partitionHost.axis.uy) / opening.partitionHost.axis.length,
    } } : {}),
  };
}

export function maskProvenWindowPassages(
  parent: GeometryOpeningProjection, proven: readonly GeometryOpeningProjection[], mask: readonly OpeningInterval[],
): GeometryOpeningProjection[] {
  const rad = parent.angle * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad), half = parent.rlen / 2;
  return proven.flatMap(slice => {
    const center = (slice.rx - parent.rx) * ux + (slice.ry - parent.ry) * uy;
    const lower = center - slice.rlen / 2, upper = center + slice.rlen / 2;
    return mask.flatMap(([a, b]) => {
      const lo = Math.max(lower, a * parent.rlen - half), hi = Math.min(upper, b * parent.rlen - half);
      return hi > lo ? [offsetOpeningProjection(slice, (lo + hi) / 2 - center, hi - lo)] : [];
    });
  });
}

/** Slide exposes the opposite end first. Swing retains the historical centred aperture. */
export function opticalOpeningPosition(opening: GeometryOpeningProjection, amount: number): GeometryOpeningProjection {
  const motion = motionOpeningFeatures(opening);
  if (motion?.mechanism !== 'slide') return opening;
  const offset = (openingSlideDirection(motion) === 'end' ? -1 : 1) * opening.rlen * (1 - amount) / 2;
  return offsetOpeningProjection(opening, offset);
}
