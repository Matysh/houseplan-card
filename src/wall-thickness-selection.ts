import type { SpaceModel, WallEntry } from './types';
import { drawWallPreviewD, roomWallProfile } from './wall-thickness';
import { wallThickHoverHalfUnits } from './grid-scale';

export interface WallThicknessTarget {
  a: number[];
  b: number[];
  roomId: string | null;
  source: { kind: 'room' } | { kind: 'partition'; id: string };
}

/** Session presentation only: resolve the current owner, never a pointer hit or field draft. */
export function wallThicknessSelection(
  space: SpaceModel, spaceId: string | null, target: WallThicknessTarget,
  walls: WallEntry[], cuts: number[][], pitch: number, cellCm: number, gridPitch: number,
): { d: string; open: boolean } | null {
  if (space.id !== spaceId) return null;
  let a: number[], b: number[], cm: number, open = false;
  if (target.source.kind === 'partition') {
    const id = target.source.id;
    const partition = space.partitions.find(item => item.id === id);
    if (!partition) return null;
    ({ a, b, cm } = partition);
  } else {
    if (!target.roomId) return null;
    const profile = roomWallProfile(space.rooms, target.roomId, walls, cuts, pitch, cellCm, gridPitch, 1000);
    if (!profile) return null;
    const eps = Math.max(gridPitch * 1e-6, 1e-9);
    const same = (p: number[], q: number[]): boolean =>
      Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
    const indices = profile.poly.flatMap((p, index) => {
      const q = profile.poly[(index + 1) % profile.poly.length];
      return (same(p, target.a) && same(q, target.b)) || (same(p, target.b) && same(q, target.a))
        ? [index] : [];
    });
    if (indices.length !== 1) return null;
    const index = indices[0];
    a = profile.poly[index]; b = profile.poly[(index + 1) % profile.poly.length];
    open = profile.kinds[index] === null;
    cm = open ? 0 : profile.cms[index];
  }
  if (![...a, ...b, cm].every(Number.isFinite) || cm < 0 || cm > 100
      || Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-9) return null;
  return { d: drawWallPreviewD([a, b], wallThickHoverHalfUnits(cm, cellCm, gridPitch), false), open };
}
