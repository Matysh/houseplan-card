/** Position-only browser reserve. Never authoritative over a format-2 server. */
import { freezeVacuumPath, VAC_RAW_MAX_POINTS, VAC_RAW_MAX_SEGMENTS } from './vacuum-path-geometry';
import type { Pt, VacPath } from './vacuum';

export interface LocalVacuumPath {
  trail: Pt[]; paths: VacPath; material: VacPath; version: number;
  gap: boolean; lastPos: Pt | null; sampleCm?: Pt; sampleAt?: number;
}

/** Lag one sample behind the animated puck, but never bridge an unknown period
 * or teleport. A new empty/singleton fragment also disables the live tip. */
export function recordLocalVacuumPosition(
  state: LocalVacuumPath, point: Pt | null, now: number, physicalCm?: Pt,
): void {
  const total = (): number => state.paths.reduce((sum, p) => sum + p.length, 0);
  const append = (p: Pt): void => {
    if (total() >= VAC_RAW_MAX_POINTS) return;
    const last = state.trail[state.trail.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) state.trail.push([...p]);
  };
  if (!state.paths.length) state.paths.push(state.trail);
  const dt = state.sampleAt == null ? 0 : (now - state.sampleAt) / 1000;
  const jump = physicalCm && state.sampleCm && (!(dt > 0) || Math.hypot(
    physicalCm[0] - state.sampleCm[0], physicalCm[1] - state.sampleCm[1],
  ) > Math.max(100, 200 * dt));
  if (point && (state.gap || jump)) {
    // Finish the trustworthy old fragment; the new coordinate belongs only
    // to the new one, never to a connector from the old endpoint.
    if (state.lastPos) append(state.lastPos);
    if (state.trail.length && state.paths.length < VAC_RAW_MAX_SEGMENTS) {
      state.trail = []; state.paths.push(state.trail);
    } else if (state.paths.length >= VAC_RAW_MAX_SEGMENTS) {
      state.lastPos = null;
      return;
    }
    state.lastPos = null;
  }
  if (state.lastPos) append(state.lastPos);
  state.lastPos = point;
  state.gap = false;
  state.sampleCm = physicalCm;
  state.sampleAt = now;
  const revision = total() + state.paths.length;
  if (revision !== state.version) {
    state.version = revision;
    state.material = freezeVacuumPath(state.paths.map((p) => p.map((v) => [...v] as Pt)));
  }
}
