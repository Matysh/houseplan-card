/** Small server telemetry frames; HA state objects themselves are never changed. */
type Row = { state?: string; last_updated?: string; attributes?: Record<string, unknown> };
type Context = { connection?: unknown; user?: { id?: unknown } };
type PlanHass = Context & {
  states?: Record<string, Row>;
  entities?: Record<string, { platform?: string; device_id?: unknown; disabled_by?: unknown }>;
};
export type VacuumMapBounds = [number, number, number, number];
export interface EcovacsSourceFrame {
  vacuum: string;
  map_id: string | null;
  state_revision: string | null;
  position: { x: number; y: number } | null;
  bounds: VacuumMapBounds | null;
  native_path: boolean;
  reason: string | null;
}
type State = { connection: unknown; user: unknown; supported: boolean;
  frames: Readonly<Record<string, EcovacsSourceFrame>> };
const states = new WeakMap<object, State>();
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9;

export function vacuumMapBounds(value: unknown): VacuumMapBounds | null {
  return Array.isArray(value) && value.length === 4 && value.every(finite)
    && value[2] > 0 && value[3] > 0 ? [...value] as VacuumMapBounds : null;
}

/** The ordinary subscription/load claim is checked by the owner before this call. */
export function adoptEcovacsSources(owner: object, packet: unknown, context: Context): void {
  const response = record(packet);
  const supported = response?.vacuum_source_format === 1 && response.trail_format === 2;
  const frames: Record<string, EcovacsSourceFrame> = Object.create(null);
  const entries = Object.entries(record(response?.vacuum_sources) || {});
  if (supported && entries.length <= 256) for (const [source, raw] of entries) {
    if (!/^image\.[a-z0-9_]+$/.test(source) || source.length > 256) continue;
    const value = record(raw);
    if (!value || typeof value.vacuum !== 'string' || !/^vacuum\.[a-z0-9_]+$/.test(value.vacuum)
      || !(value.map_id === null || typeof value.map_id === 'string' && value.map_id.length <= 256)
      || !(value.state_revision === null || typeof value.state_revision === 'string'
        && Number.isFinite(Date.parse(value.state_revision)))
      || !(value.reason === null || ['unsupported', 'unavailable', 'stale', 'limited', 'coordinates_unverified'].includes(String(value.reason)))
      || typeof value.native_path !== 'boolean') continue;
    const position = record(value.position);
    if (value.position !== null && (!position || !finite(position.x) || !finite(position.y))) continue;
    const bounds = vacuumMapBounds(value.bounds);
    if (value.bounds !== null && !bounds) continue;
    frames[source] = { vacuum: value.vacuum, map_id: value.map_id as string | null,
      state_revision: value.state_revision as string | null,
      position: position ? { x: position.x as number, y: position.y as number } : null,
      bounds, native_path: value.native_path, reason: value.reason as string | null };
  }
  states.set(owner, { connection: context.connection, user: context.user?.id, supported, frames });
}

function current(owner: object, context: Context): State | undefined {
  const value = states.get(owner);
  return value && value.connection === context.connection && value.user === context.user?.id ? value : undefined;
}

export function ecovacsSourceState(owner: object, context: Context, source: string): {
  supported: boolean; frame?: EcovacsSourceFrame;
} {
  const value = current(owner, context);
  return { supported: value?.supported === true, frame: value?.frames[source] };
}

/** Unlike generic cameras, an Ecovacs image belongs to exactly one HA robot. */
export function ecovacsSourceAllowed(base: PlanHass | null | undefined, source: string, vacuum: string | null): boolean {
  const image = base?.entities?.[source];
  if (!source.startsWith('image.') || image?.platform !== 'ecovacs') return true;
  const robot = vacuum ? base?.entities?.[vacuum] : null;
  return !!robot && robot.platform === 'ecovacs' && image.disabled_by == null && robot.disabled_by == null
    && typeof image.device_id === 'string' && !!image.device_id && image.device_id === robot.device_id;
}

/** Only registry-proven current Ecovacs rows receive the server projection. */
export function projectEcovacsSources<T extends PlanHass>(owner: object, base: T, context: Context): T {
  const value = current(owner, context);
  if (!value?.supported || !base.states || !base.entities) return base;
  let projected: Record<string, Row> | null = null;
  for (const [source, frame] of Object.entries(value.frames)) {
    const entry = base.entities[source], row = base.states[source];
    if (entry?.platform !== 'ecovacs' || entry.disabled_by != null || !row
      || row.state === 'unknown' || row.state === 'unavailable' || frame.reason
      || frame.state_revision !== row.last_updated
      || frame.map_id !== String(row.attributes?.map_name ?? base.states[frame.vacuum]?.attributes?.selected_map ?? 'default')) continue;
    projected ??= { ...base.states };
    projected[source] = { ...row, attributes: { ...row.attributes,
      vacuum_position: frame.position, houseplan_map_bounds: frame.bounds,
      map_name: frame.map_id, houseplan_native_path: frame.native_path } };
  }
  return projected ? { ...base, states: projected } : base;
}

export interface VacuumMapPreview {
  source: string; map_id: string; revision: string;
  bounds: VacuumMapBounds; image: string;
}

export function vacuumMapPreview(value: unknown, source: string, mapId: string): VacuumMapPreview | null {
  const raw = record(value), bounds = vacuumMapBounds(raw?.bounds);
  if (!raw || raw.source !== source || raw.map_id !== mapId || !bounds
    || typeof raw.revision !== 'string' || !/^[a-f0-9]{64}$/.test(raw.revision)
    || typeof raw.image !== 'string' || raw.image.length > 2_796_230
    || !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(raw.image)) return null;
  return { source, map_id: mapId, revision: raw.revision, bounds, image: raw.image };
}
