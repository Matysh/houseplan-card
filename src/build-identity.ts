/**
 * Build identity of the running frontend and of the backend (#836).
 *
 * Two consecutive dev builds share one version number, so the version cannot
 * say which JavaScript a browser runs. The frontend fingerprint can, and the
 * owner's dev installation additionally labels its build with the source SHA.
 *
 * The card's code lives in a content-hashed chunk whose `import.meta.url` has
 * no query. The stable entry wrapper (`entryFallbackPlugin` in
 * scripts/bundle-manifest.mjs) therefore records ITS url — the one the backend
 * registered, `?v=…&b=…&dev=…` — in a global seam before any chunk loads; the
 * first wrapper loaded in a document wins.
 *
 * No DOM, Lit or Home Assistant dependency: tests read it directly.
 */
export const ENTRY_URL_SEAM = '__HOUSEPLAN_ENTRY_URL__';

export interface DevBuildLabel {
  readonly channel: 'dev';
  /** Full 40-hex source SHA; the screen shows the first eight. */
  readonly source: string;
}

const SOURCE = /^[0-9a-f]{40}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;

const label = (source: unknown): DevBuildLabel | null =>
  typeof source === 'string' && SOURCE.test(source) ? { channel: 'dev', source } : null;

/** A 64-hex build fingerprint, or null: placeholders and old backends are unknown. */
export function knownFingerprint(value: unknown): string | null {
  return typeof value === 'string' && FINGERPRINT.test(value) ? value : null;
}

/** The backend's `build` from houseplan/config/get, or null. */
export function devBuildLabel(value: unknown): DevBuildLabel | null {
  const build = value && typeof value === 'object' ? value as { channel?: unknown; source?: unknown } : null;
  return build?.channel === 'dev' ? label(build.source) : null;
}

/** The running frontend's label: `dev=<40 hex>` in its entry URL, otherwise null. */
export function entryBuildLabel(
  url: unknown = (globalThis as Record<string, unknown>)[ENTRY_URL_SEAM],
): DevBuildLabel | null {
  try {
    return typeof url === 'string' ? label(new URL(url).searchParams.get('dev')) : null;
  } catch {
    return null;
  }
}

/**
 * `<version> · dev <sha8>` for a dev build; `<version> · <fingerprint8>` when
 * only the fingerprint tells two builds of one version apart; otherwise the
 * version exactly as before.
 */
export function formatBuild(
  version: string,
  label: DevBuildLabel | null,
  fingerprint: string | null = null,
): string {
  if (label) return `${version} · dev ${label.source.slice(0, 8)}`;
  if (fingerprint) return `${version} · ${fingerprint.slice(0, 8)}`;
  return version;
}
