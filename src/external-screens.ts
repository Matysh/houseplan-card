/** Persisted profiles and runtime-only per-space resolution (#1113/#1165). */
export interface ExternalScreenView extends Record<string, unknown> {
  rotation: 0 | 90 | 180 | 270; zoom: number;
  summary: 'local' | 'show' | 'hide'; center_summary: boolean;
  icon_scale: number | null; font_scale: number | null;
}
export interface ExternalScreen extends Record<string, unknown> {
  id: number; space: string | null; cycle: number; idle: number;
  default_view: ExternalScreenView; space_views: Record<string, ExternalScreenView>;
}
interface LegacyScreen extends Record<string, unknown> {
  id: number; space: string | null; rotation: ExternalScreenView['rotation'];
  cycle: number; idle: number; summary: ExternalScreenView['summary'];
  hidden_devices: 'local' | 'show' | 'hide'; icon_scale: number | null;
  font_scale: number | null; controls: boolean;
}
export interface ExternalScreens extends Record<string, unknown> {
  version: 2; next_id: number; screens: ExternalScreen[];
}
export interface LegacyExternalScreens extends Record<string, unknown> {
  version: 1; next_id: number; screens: LegacyScreen[];
}
export type StoredExternalScreens = ExternalScreens | LegacyExternalScreens;
export type ScreenOverrides = Partial<Pick<ExternalScreenView, 'rotation' | 'icon_scale' | 'font_scale'>> & {
  cycle?: number; idle?: number; summary?: boolean;
};
export interface ResolvedScreen extends ScreenOverrides {
  space?: string | null; profile?: number; zoom?: number; center_summary?: boolean;
}
export const emptyExternalScreens = (): ExternalScreens => ({ version: 2, next_id: 1, screens: [] });
export const defaultExternalScreenView = (): ExternalScreenView => ({
  rotation: 0, zoom: 1, summary: 'local', center_summary: false, icon_scale: null, font_scale: null,
});
const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
export const validScreenZoom = (n: unknown): n is number => typeof n === 'number'
  && Number.isFinite(n) && n >= .1 && n <= 10 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-8;
const scale = (n: unknown): boolean => n === null || typeof n === 'number'
  && Number.isFinite(n) && n >= .5 && n <= 3 && Math.abs(n * 20 - Math.round(n * 20)) < 1e-8;
const viewOf = (value: unknown): value is ExternalScreenView => record(value)
  && [0, 90, 180, 270].includes(value.rotation as number) && validScreenZoom(value.zoom)
  && ['local', 'show', 'hide'].includes(value.summary as string) && typeof value.center_summary === 'boolean'
  && scale(value.icon_scale) && scale(value.font_scale);
const bounded = (value: unknown): boolean => {
  try { return new TextEncoder().encode(JSON.stringify(value)).length <= 128 * 1024; } catch { return false; }
};
/** Validation never rewrites a config object, including legacy namespaces. */
export function externalScreensOf(raw: unknown): StoredExternalScreens | null {
  if (!record(raw)) return null;
  const value = raw;
  if (![1, 2].includes(value.version as number) || !integer(value.next_id, 1) || !Array.isArray(value.screens)
    || value.screens.length > 20) return null;
  if (value.version === 2 && !bounded(value)) return null;
  const ids = new Set<number>();
  for (const row of value.screens) {
    if (!record(row) || !integer(row.id, 1) || row.id >= value.next_id || ids.has(row.id)
      || !(row.space === null || typeof row.space === 'string' && row.space.trim().length > 0)
      || !integer(row.cycle, 0, 3600) || !integer(row.idle, 0, 3600)) return null;
    if (value.version === 1) {
      if (![0, 90, 180, 270].includes(row.rotation as number)
        || !['local', 'show', 'hide'].includes(row.summary as string)
        || !['local', 'show', 'hide'].includes(row.hidden_devices as string)
        || !scale(row.icon_scale) || !scale(row.font_scale) || typeof row.controls !== 'boolean') return null;
    } else if (!viewOf(row.default_view) || !record(row.space_views)
      || Object.entries(row.space_views).some(([id, view]) => !id.trim() || !viewOf(view))) return null;
    ids.add(row.id);
  }
  return raw as unknown as StoredExternalScreens;
}
/** Read-only conversion; callers publish it only after the nested editor's OK. */
const migrated = new WeakMap<LegacyExternalScreens, ExternalScreens>();
export function externalScreensForEdit(raw: unknown): ExternalScreens | null {
  const value = externalScreensOf(raw);
  if (!value || value.version === 2) return value;
  let result = migrated.get(value);
  if (!result) {
    result = { ...value, version: 2, screens: value.screens.map(row => {
      const { rotation, summary, icon_scale, font_scale, hidden_devices: _hidden, controls: _controls, ...rest } = row;
      return { ...rest, default_view: { ...defaultExternalScreenView(), rotation, summary, icon_scale, font_scale }, space_views: {} };
    }) };
    migrated.set(value, result);
  }
  return result;
}
export function externalScreenView(row: ExternalScreen, space: string | null): ExternalScreenView {
  return space && own(row.space_views, space) ? row.space_views[space] : row.default_view;
}
export function defaultExternalScreen(id: number): ExternalScreen {
  return { id, space: null, cycle: 0, idle: 0, default_view: defaultExternalScreenView(), space_views: {} };
}
/** A nested editor changes a detached outer draft only; numbers survive deletion. */
export function upsertExternalScreen(draft: ExternalScreens, row: ExternalScreen): ExternalScreens {
  const exists = draft.screens.some(item => item.id === row.id);
  if (!exists && (draft.screens.length >= 20 || row.id !== draft.next_id || draft.next_id === Number.MAX_SAFE_INTEGER)) return draft;
  return { ...draft, next_id: exists ? draft.next_id : draft.next_id + 1,
    screens: exists ? draft.screens.map(item => item.id === row.id ? { ...row } : item) : [...draft.screens, { ...row }] };
}
export class ExternalScreenResolver {
  private raw: unknown; private route: object | null = null; private space = ''; private result: ResolvedScreen = {};
  /** Config namespace identity and normalized URL intent change only at adoption. */
  read(raw: unknown, route: { enabled: boolean; profile?: number | null; overrides?: ScreenOverrides } | null, space = ''): ResolvedScreen {
    if (raw === this.raw && route === this.route && space === this.space) return this.result;
    this.raw = raw; this.route = route; this.space = space;
    if (!route?.enabled) return this.result = {};
    const profile = externalScreensForEdit(raw)?.screens.find(row => row.id === route.profile);
    const view = profile ? externalScreenView(profile, space) : null;
    const result: ResolvedScreen = profile ? {
      profile: profile.id, space: profile.space, cycle: profile.cycle, idle: profile.idle,
      rotation: view!.rotation, zoom: view!.zoom, center_summary: view!.center_summary,
      ...(view!.summary === 'local' ? {} : { summary: view!.summary === 'show' }),
      ...(view!.icon_scale === null ? {} : { icon_scale: view!.icon_scale }),
      ...(view!.font_scale === null ? {} : { font_scale: view!.font_scale }),
    } : {};
    // Only supported URL fields survive; stale hidden/controls intent is inert.
    const { rotation, cycle, idle, summary, icon_scale, font_scale } = route.overrides ?? {};
    const overrides = { rotation, cycle, idle, summary, icon_scale, font_scale };
    for (const [key, value] of Object.entries(overrides)) if (value !== undefined) Object.assign(result, { [key]: value });
    return this.result = result;
  }
}

/** Complete only against the exact authoritative base; never patches missed revisions. */
export function externalScreenEventCandidate<T extends { settings?: object }>(
  current: T | null, currentRev: number, data: unknown,
): { config: T; rev: number } | null {
  if (!current || !data || typeof data !== 'object') return null;
  const event = data as { rev?: unknown; external_screens_update?: { version?: unknown; base_rev?: unknown; value?: unknown } };
  const update = event.external_screens_update;
  if (!integer(event.rev, 1) || !update || update.version !== 1
    || update.base_rev !== currentRev || event.rev !== currentRev + 1) return null;
  const value = update.value;
  if (!externalScreensOf(value)) {
    if (!record(value) || !integer(value.version, 3) || !bounded(value)) return null;
  }
  return { config: { ...current, settings: { ...current.settings, external_screens: value } }, rev: event.rev };
}
/** The narrow event profile retains every other top-level/settings field by identity. */
export function externalScreenOnlyCandidate(previous: object | null, next: object | null): boolean {
  if (!previous || !next) return false;
  const a = previous as Record<string, unknown>, b = next as Record<string, unknown>;
  const equal = (a: Record<string, unknown>, b: Record<string, unknown>, omit: string) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]); keys.delete(omit);
    return [...keys].every(key => Object.prototype.hasOwnProperty.call(a, key) === Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key]);
  };
  const sa = a.settings, sb = b.settings;
  return equal(a,b,'settings') && !!sa && typeof sa === 'object' && !!sb && typeof sb === 'object'
    && equal(sa as Record<string, unknown>, sb as Record<string, unknown>, 'external_screens');
}
