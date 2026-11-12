/** Read-only aperture slices AFTER the canonical host/room eligibility proof. */
import type { GeometryOpeningProjection } from './plan-geometry-preflight';
import { motionOpeningFeatures, openingSlideDirection, type OpeningInterval } from './opening-features';

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
