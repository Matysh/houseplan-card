import { normalizeVacPath, resolveCurrentVacPath, type VacPath } from './vacuum';
import { ownVacuumPathInput } from './vacuum-path-geometry';

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
      record[key] = { ...value, points: ownVacuumPathInput(value.points), paths: ownVacuumPathInput(value.paths) };
    }
    book[id] = record;
  }
  return book;
}

export function selectVacuumTrail(
  telemetry: { path?: unknown } | null, server: VacuumServerRun | null,
  local: unknown, serverFormat: number,
): { path: VacPath; native: boolean; allowTip: boolean; reason: string; source: string } {
  if (serverFormat >= 2) {
    const path = normalizeVacPath(server?.paths);
    const fragments = server?.paths;
    const tail = Array.isArray(fragments) ? fragments[fragments.length - 1] : null;
    return { path, native: server?.quality?.source === 'native',
      allowTip: server?.quality?.source !== 'native' && Array.isArray(tail) && tail.length >= 2,
      reason: server?.quality?.reason ?? (path.length ? 'sampled' : 'none'),
      source: path.length ? server?.quality?.source ?? 'positions' : 'none' };
  }
  // An old/missing backend retains its documented compatible scenario, but
  // cannot become a format-2 authoritative writer through the browser.
  const legacy = resolveCurrentVacPath(telemetry, server, local);
  const localTail = Array.isArray(local) && Array.isArray(local[0]?.[0]) ? local[local.length - 1] : local;
  return { path: legacy.path, native: legacy.source === 'integration',
    allowTip: legacy.source !== 'integration' && (legacy.source !== 'local' || (Array.isArray(localTail) && localTail.length >= 2)),
    reason: legacy.source === 'none' ? 'none' : 'sampled', source: legacy.source };
}
