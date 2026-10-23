import { normalizeVacPath, resolveCurrentVacPath, trimVacPathTarget, type Affine, type VacPath } from './vacuum';
import { ownVacuumPathInput, vacuumPathLimited, type VacuumPathGeometryCache } from './vacuum-path-geometry';
import { vacuumTrailSvg, type VacuumSvgFrame } from './vacuum-trail-render';
import { liveLast, ownVacuumLiveTail, vacuumLiveGeometry, type VacuumLiveTail, type VacuumLivePending } from './vacuum-live-tail';
import { freezeVacuumPath } from './vacuum-path-geometry';

export interface VacuumServerRun {
  points?: unknown;
  paths?: unknown;
  path_format?: number;
  quality?: { source?: string; reason?: string; raw_points?: number; stored_points?: number };
  received_at?: number;
  final_status?: string;
  route_id?: string;
  map_id?: string;
  revision?: string;
  live_tail?: VacuumLiveTail;
}
export type VacuumServerBook = Record<string, { current?: VacuumServerRun; previous?: VacuumServerRun }>;

export function vacuumTrailMaterial(raw: unknown): VacuumServerBook {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const book: VacuumServerBook = {};
  for (const [id, pair] of Object.entries(raw)) {
    if (!pair || typeof pair !== 'object') continue;
    const record: { current?: VacuumServerRun; previous?: VacuumServerRun } = {};
    for (const key of ['current', 'previous'] as const) {
      const run = (pair as Record<string, unknown>)[key];
      if (!run || typeof run !== 'object' || Array.isArray(run)) continue;
      const value = run as VacuumServerRun;
      if (value.path_format != null && value.path_format !== 1 && value.path_format !== 2) continue;
      record[key] = { ...value, points: ownVacuumPathInput(value.points), paths: ownVacuumPathInput(value.paths),
        live_tail: ownVacuumLiveTail(value.live_tail) };
    }
    book[id] = record;
  }
  return book;
}

export function selectVacuumTrail(
  telemetry: { path?: unknown } | null, server: VacuumServerRun | null,
  local: unknown, serverFormat: number,
): { path: VacPath; native: boolean; allowTip: boolean; reason: string; source: string; hybrid?: boolean } {
  if (serverFormat >= 2) {
    const path = normalizeVacPath(server?.paths);
    const fragments = server?.paths;
    const tail = Array.isArray(fragments) ? fragments[fragments.length - 1] : null;
    const limited = vacuumPathLimited(fragments) || server?.quality?.reason === 'limited';
    return { path, native: server?.quality?.source === 'native',
      allowTip: !limited && server?.quality?.source !== 'native' && Array.isArray(tail) && tail.length >= 2,
      reason: limited ? 'limited' : server?.quality?.reason ?? (path.length ? 'sampled' : 'none'),
      source: path.length || server?.quality?.source === 'native' ? server?.quality?.source ?? 'positions' : 'none' };
  }
  // An old/missing backend retains its documented compatible scenario, but
  // cannot become a format-2 authoritative writer through the browser.
  const legacy = resolveCurrentVacPath(telemetry, server, local);
  const limited = [telemetry?.path, server?.points, local].some(vacuumPathLimited);
  const localTail = Array.isArray(local) && Array.isArray(local[0]?.[0]) ? local[local.length - 1] : local;
  return { path: legacy.path, native: legacy.source === 'integration',
    allowTip: !limited && legacy.source !== 'integration' && (legacy.source !== 'local' || (Array.isArray(localTail) && localTail.length >= 2)),
    reason: limited ? 'limited' : legacy.source === 'none' ? 'none' : 'sampled', source: legacy.source };
}

/** View and its diagnostic counter consume the same arbitration, trim and quota. */
export function currentVacuumTrailFrame(input: {
  telemetry: { path?: unknown } | null;
  server: VacuumServerRun | null;
  local: unknown;
  livePending?: VacuumLivePending;
  serverFormat: number;
  moving: boolean;
  matrix: Affine;
  cache: VacuumPathGeometryCache;
  cmPerUnit: number;
  budget: number;
}): { current: ReturnType<typeof selectVacuumTrail>; path: VacPath; frame: VacuumSvgFrame;
  provisional?: number; liveReceivedAt?: number; waiting?: boolean } {
  const current = selectVacuumTrail(input.telemetry, input.server, input.local, input.serverFormat);
  const live = input.server?.live_tail;
  if (input.serverFormat >= 2 && current.native && live) {
    const fresh = vacuumLiveGeometry(live, input.livePending);
    const end = liveLast(liveLast(fresh.path));
    const target = (input.telemetry as { pos?: { x: number; y: number } } | null)?.pos;
    const tip = input.moving && !!end && !!target && end[0] === target.x && end[1] === target.y
      && (liveLast(fresh.path)?.length ?? 0) >= 2 && input.budget >= 2;
    const path = tip ? freezeVacuumPath(fresh.path.map((p, i) => i === fresh.path.length - 1 ? p.slice(0, -1) : p)) : fresh.path;
    const tail = vacuumTrailSvg(input.cache, path, input.matrix, input.cmPerUnit, Math.max(0, input.budget - (tip ? 1 : 0)));
    const count = tail.count + (tip && !tail.limited ? 1 : 0);
    const native = vacuumTrailSvg(input.cache, live.waiting ? [] : current.path, input.matrix, input.cmPerUnit,
      Math.max(0, input.budget - count));
    return { current: { ...current, hybrid: true, allowTip: tip && !tail.limited }, path: path.length ? path : current.path,
      frame: { d: `${native.d} ${tail.d}`.trim(), count: native.count + count,
        rawPoints: native.rawPoints + fresh.count, limited: native.limited || tail.limited || fresh.limited },
      provisional: fresh.count, liveReceivedAt: fresh.receivedAt, waiting: live.waiting };
  }
  const path = input.moving && !current.native && current.allowTip && current.source !== 'local'
    ? trimVacPathTarget(current.path) : current.path;
  const frame = vacuumTrailSvg(input.cache, path, input.matrix, input.cmPerUnit, input.budget);
  return { current, path, frame };
}
