/** Shared persisted screen codec and runtime-only resolution (#1113). */
export interface ExternalScreen extends Record<string, unknown> {
  id: number; space: string | null; rotation: 0 | 90 | 180 | 270;
  cycle: number; idle: number; summary: 'local' | 'show' | 'hide';
  hidden_devices: 'local' | 'show' | 'hide'; icon_scale: number | null;
  font_scale: number | null; controls: boolean;
}
export interface ExternalScreens extends Record<string, unknown> {
  version: 1; next_id: number; screens: ExternalScreen[];
}
export type ScreenOverrides = Partial<Pick<ExternalScreen,
  'rotation' | 'cycle' | 'idle' | 'icon_scale' | 'font_scale' | 'controls'>> & {
  summary?: boolean; hidden_devices?: boolean;
};
export interface ResolvedScreen extends ScreenOverrides { space?: string | null }
export const emptyExternalScreens = (): ExternalScreens => ({ version: 1, next_id: 1, screens: [] });
const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const scale = (n: unknown): boolean => n === null || typeof n === 'number'
  && Number.isFinite(n) && n >= .5 && n <= 3 && Math.abs(n * 20 - Math.round(n * 20)) < 1e-8;
export function externalScreensOf(raw: unknown): ExternalScreens | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ExternalScreens>;
  if (value.version !== 1 || !integer(value.next_id, 1) || !Array.isArray(value.screens)
    || value.screens.length > 20) return null;
  const ids = new Set<number>();
  for (const row of value.screens) {
    if (!row || !integer(row.id, 1) || row.id >= value.next_id || ids.has(row.id)
      || !(row.space === null || typeof row.space === 'string' && row.space.trim().length > 0)
      || ![0, 90, 180, 270].includes(row.rotation) || !integer(row.cycle, 0, 3600)
      || !integer(row.idle, 0, 3600) || !['local', 'show', 'hide'].includes(row.summary)
      || !['local', 'show', 'hide'].includes(row.hidden_devices)
      || !scale(row.icon_scale) || !scale(row.font_scale) || typeof row.controls !== 'boolean') return null;
    ids.add(row.id);
  }
  return value as ExternalScreens;
}
export function defaultExternalScreen(id: number): ExternalScreen {
  return { id, space: null, rotation: 0, cycle: 0, idle: 0, summary: 'local',
    hidden_devices: 'local', icon_scale: null, font_scale: null, controls: true };
}
/** A nested editor changes a detached outer draft only; numbers survive deletion. */
export function upsertExternalScreen(draft: ExternalScreens, row: ExternalScreen): ExternalScreens {
  const exists = draft.screens.some(item => item.id === row.id);
  if (!exists && (draft.screens.length >= 20 || row.id !== draft.next_id || draft.next_id === Number.MAX_SAFE_INTEGER)) return draft;
  return { ...draft, next_id: exists ? draft.next_id : draft.next_id + 1,
    screens: exists ? draft.screens.map(item => item.id === row.id ? { ...row } : item) : [...draft.screens, { ...row }] };
}
export class ExternalScreenResolver {
  private raw: unknown; private route: object | null = null; private result: ResolvedScreen = {};
  /** Config namespace identity and normalized URL intent change only at adoption. */
  read(raw: unknown, route: { enabled: boolean; profile?: number | null; overrides?: ScreenOverrides } | null): ResolvedScreen {
    if (raw === this.raw && route === this.route) return this.result;
    this.raw = raw; this.route = route;
    if (!route?.enabled) return this.result = {};
    const profile = externalScreensOf(raw)?.screens.find(row => row.id === route.profile);
    const result: ResolvedScreen = profile ? {
      space: profile.space, rotation: profile.rotation, cycle: profile.cycle, idle: profile.idle,
      controls: profile.controls, ...(profile.summary === 'local' ? {} : { summary: profile.summary === 'show' }),
      ...(profile.hidden_devices === 'local' ? {} : { hidden_devices: profile.hidden_devices === 'show' }),
      ...(profile.icon_scale === null ? {} : { icon_scale: profile.icon_scale }),
      ...(profile.font_scale === null ? {} : { font_scale: profile.font_scale }),
    } : {};
    return this.result = { ...result, ...route.overrides };
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
    if (!value || typeof value !== 'object' || !integer((value as { version?: unknown }).version, 2)
      || JSON.stringify(value).length > 128 * 1024) return null;
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
