/** #1049: bounded observations, never native history or an inferred job ID. */
import { freezeVacuumPath } from './vacuum-path-geometry';
import type { Pt, VacPath } from './vacuum';

export type LiveSample = [number, number, number];
export interface VacuumLiveTail {
  version: 1; epoch: string; paths: LiveSample[][]; waiting: boolean; limited: boolean; since?: number;
}
export interface VacuumLivePending {
  owner: string; epoch: string; paths: LiveSample[][]; gap: boolean;
  limited: boolean; join: boolean; blockedEpoch?: string; physical?: Pt; at?: number;
}
export const VAC_LIVE_POINTS = 512, VAC_LIVE_FRAGMENTS = 32;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const liveLast = <T>(items: T[] | undefined): T | undefined => items?.[items.length - 1];

/** Closed, owned projection: malformed/future capabilities retain old behavior. */
export function ownVacuumLiveTail(value: unknown): VacuumLiveTail | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as VacuumLiveTail;
  if (v.version !== 1 || typeof v.epoch !== 'string' || !v.epoch.length || v.epoch.length > 128
    || !Array.isArray(v.paths) || v.paths.length > VAC_LIVE_FRAGMENTS) return;
  if (v.since != null && !finite(v.since)) return;
  let count = 0;
  const paths: LiveSample[][] = [];
  for (const fragment of v.paths) {
    if (!Array.isArray(fragment)) return;
    const path: LiveSample[] = [];
    for (const p of fragment) {
      if (++count > VAC_LIVE_POINTS || !Array.isArray(p) || p.length !== 3 || !p.every(finite)) return;
      path.push(Object.freeze([...p]) as LiveSample);
    }
    if (path.length) paths.push(Object.freeze(path) as LiveSample[]);
  }
  return Object.freeze({ version: 1, epoch: v.epoch, paths: Object.freeze(paths) as LiveSample[][],
    waiting: v.waiting === true, limited: v.limited === true,
    ...(v.since == null ? {} : {since:v.since}) });
}

export function recordVacuumLivePosition(
  old: VacuumLivePending | undefined, live: VacuumLiveTail | undefined, owner: string,
  point: Pt | null, stamp: number, gap: boolean, physical?: Pt,
): VacuumLivePending | undefined {
  if (!live) return;
  const changedOwner = !!old && old.owner !== owner;
  const state: VacuumLivePending = old && !changedOwner && old.epoch === live.epoch ? old
    : { owner, epoch: live.epoch, paths: [], gap: true, limited: false, join: false,
      blockedEpoch: changedOwner ? live.epoch : undefined };
  if (!point || !finite(stamp)) { state.gap = true; return state; }
  if (live.since != null && stamp < live.since) { state.gap = true; return state; }
  const cursor = liveLast(liveLast(live.paths))?.[2] ?? -Infinity;
  // A server ACK cannot make an already-covered local sample reappear.
  const remaining = state.paths.map(p => p.filter(v => v[2] > cursor));
  if (remaining.findIndex(p => p.length) > 0) state.join = false;
  state.paths = remaining.filter(p => p.length);
  const last = liveLast(liveLast(state.paths));
  const dt = state.at == null ? 0 : (stamp - state.at) / 1000;
  const jump = physical && state.physical && (!(dt > 0)
    || Math.hypot(physical[0] - state.physical[0], physical[1] - state.physical[1]) > Math.max(100, 200 * dt));
  if (stamp <= cursor) {
    const anchor = liveLast(liveLast(live.paths));
    if ((!old || old.epoch !== live.epoch) && !changedOwner && !state.paths.length
      && anchor && stamp === Math.floor(cursor) && anchor[0] === point[0] && anchor[1] === point[1]) {
      state.join = true; state.gap = false; state.physical = physical; state.at = stamp;
    }
    return state;
  }
  if (last && stamp <= last[2]) return state;
  if (!state.paths.length && (gap || state.gap || jump)) state.join = false;
  if (!state.paths.length || gap || state.gap || jump) state.paths.push([]);
  liveLast(state.paths)!.push([point[0], point[1], stamp]);
  state.physical = physical; state.at = stamp; state.gap = false;
  let count = state.paths.reduce((n, p) => n + p.length, 0);
  while (count > VAC_LIVE_POINTS || state.paths.length > VAC_LIVE_FRAGMENTS) {
    if (state.paths[0].length === 1 || state.paths.length > VAC_LIVE_FRAGMENTS) count -= state.paths.shift()!.length;
    else { state.paths[0].shift(); count--; }
    state.limited = true;
  }
  return state;
}

export function vacuumLiveGeometry(live: VacuumLiveTail, pending?: VacuumLivePending): {
  path: VacPath; count: number; receivedAt?: number; limited: boolean;
} {
  const paths = pending?.blockedEpoch === live.epoch ? [] : live.paths.map(p => p.map(v => [...v] as LiveSample));
  const last = liveLast(liveLast(paths));
  const cursor = last?.[2] ?? -Infinity;
  if (pending?.epoch === live.epoch && !pending.blockedEpoch) {
    let first = true;
    for (const fragment of pending.paths) {
      const next = fragment.filter(v => v[2] > cursor).map(v => [...v] as LiveSample);
      if (!next.length) continue;
      // Only the unbroken first local fragment can continue the server tail.
      if (first && pending.join && paths.length) liveLast(paths)!.push(...next);
      else paths.push(next);
      first = false;
    }
  }
  let count = paths.reduce((n, p) => n + p.length, 0), limited = live.limited || !!pending?.limited;
  while (count > VAC_LIVE_POINTS || paths.length > VAC_LIVE_FRAGMENTS) {
    if (paths[0].length === 1 || paths.length > VAC_LIVE_FRAGMENTS) count -= paths.shift()!.length;
    else { paths[0].shift(); count--; }
    limited = true;
  }
  return { path: freezeVacuumPath(paths.map(p => p.map(v => [v[0], v[1]] as Pt))), count,
    receivedAt: liveLast(liveLast(paths))?.[2], limited };
}
