/** Pure state/validation helpers for the lazy Help & Feedback dialog (#43). */

export const SUPPORT_MESSAGE_LIMIT = 10_000;
export const SUPPORT_CONTACT_LIMIT = 320;
export const SUPPORT_API_VERSION = 1;

/** Exact protocol capability gate; product release versions are diagnostic only. */
export function supportApiCompatible(value: unknown): boolean {
  return value === SUPPORT_API_VERSION;
}

export function supportPackageVersion(versions: unknown): 1 | 2 {
  return Array.isArray(versions) && versions.includes(2) ? 2 : 1;
}

export const SUPPORT_COVERAGE_CATEGORIES = ['config', 'devices', 'vacuums', 'environment'] as const;
export const SUPPORT_COVERAGE_STATUSES = ['complete', 'partial', 'unavailable', 'not_applicable', 'unsupported_version'] as const;
export const SUPPORT_COVERAGE_REASONS = ['runtime_not_loaded', 'revision_mismatch', 'missing_client', 'access_denied',
  'collection_limit', 'geometry_limit', 'input_limit', 'unknown_reference', 'unsupported_version',
  'resource_unobserved', 'registry_unavailable', 'not_configured'] as const;
export interface SupportCoverage {
  category: typeof SUPPORT_COVERAGE_CATEGORIES[number];
  status: typeof SUPPORT_COVERAGE_STATUSES[number];
  reasons: Array<typeof SUPPORT_COVERAGE_REASONS[number]>;
  observed: number; total: number;
}

export function parseSupportCoverage(value: unknown): SupportCoverage[] {
  if (!Array.isArray(value) || value.length !== 4) throw { code: 'support_rejected' };
  const rows: SupportCoverage[] = [];
  for (const raw of value) {
    const row = raw as SupportCoverage;
    if (!row || typeof row !== 'object' || Array.isArray(row)
        || Object.keys(row).some(key => !['category', 'status', 'reasons', 'observed', 'total'].includes(key))
        || !SUPPORT_COVERAGE_CATEGORIES.includes(row.category) || !SUPPORT_COVERAGE_STATUSES.includes(row.status)
        || !Array.isArray(row.reasons) || row.reasons.length > 16 || row.reasons.some(r => !SUPPORT_COVERAGE_REASONS.includes(r))
        || !Number.isSafeInteger(row.observed) || !Number.isSafeInteger(row.total)
        || row.observed < 0 || row.total < row.observed) throw { code: 'support_rejected' };
    rows.push({ category: row.category, status: row.status, reasons: [...row.reasons], observed: row.observed, total: row.total });
  }
  if (new Set(rows.map(row => row.category)).size !== 4) throw { code: 'support_rejected' };
  return rows;
}

export interface SupportPreview {
  token: string;
  expiresAt: number;
  size: number;
  sha256: string;
  spaces: number;
  format: string;
  version: number;
  text: string;
  preparedAt: number;
  coverage?: SupportCoverage[];
}

export function supportResponseToken(response: unknown): string {
  const token = response && typeof response === 'object' && 'token' in response ? response.token : null;
  return typeof token === 'string' && /^[0-9a-f]{48}$/.test(token) ? token : '';
}

export function parseSupportPreview(response: unknown, requestedVersion: 1 | 2, now = Date.now()): SupportPreview {
  const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const text = typeof payload.text === 'string' ? payload.text : '';
  const size = Number(payload.size), spaces = Number(payload.spaces), expiresIn = Number(payload.expires_in);
  const token = supportResponseToken(payload), sha256 = String(payload.sha256 || '');
  if (!token || !/^[0-9a-f]{64}$/.test(sha256) || payload.format !== 'houseplan-support-package'
      || payload.version !== requestedVersion || !Number.isInteger(size) || size !== new TextEncoder().encode(text).byteLength
      || !Number.isInteger(spaces) || spaces < 0 || size > 8 * 1024 * 1024
      || !Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 600 || !text.endsWith('\n')) {
    throw { code: 'support_rejected' };
  }
  const coverage = requestedVersion === 2 ? parseSupportCoverage(payload.coverage) : undefined;
  if (coverage) {
    const body: unknown = JSON.parse(text);
    const row = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    const diagnostics = row.diagnostics as { coverage?: unknown } | undefined;
    if (row.format !== payload.format || row.version !== requestedVersion
        || JSON.stringify(parseSupportCoverage(diagnostics?.coverage)) !== JSON.stringify(coverage)) throw { code: 'support_rejected' };
  }
  return { token, sha256, size, spaces, format: payload.format, version: requestedVersion, text,
    expiresAt: now + expiresIn * 1000, preparedAt: now, ...(coverage ? { coverage } : {}) };
}

export type SupportDialogStatus =
  | 'idle'
  | 'building'
  | 'ready'
  | 'sending'
  | 'success'
  | 'error';

export interface SupportDialogState {
  draftId: string;
  idempotencyKey: string;
  submissionFingerprint: string;
  contact: string;
  message: string;
  attach: boolean;
  status: SupportDialogStatus;
  preview: SupportPreview | null;
  rawOpen: boolean;
  errorCode: string;
  reportId: string;
}

export interface SupportRuntimeFacts {
  browser_family: 'chromium' | 'firefox' | 'webkit' | 'unknown';
  browser_major: number;
  language: 'en' | 'ru' | 'de' | 'fr';
  coarse_pointer: boolean;
  hover_capable: boolean;
  registry_access: 'full' | 'partial' | 'unavailable';
  registry_age_bucket: 'fresh' | 'stale' | 'unknown';
}

function randomId(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function supportSubmissionFingerprint(state: SupportDialogState): string {
  return JSON.stringify({
    message: state.message.trim(),
    contact: state.contact.trim(),
    previewToken: state.attach && state.preview ? state.preview.token : '',
  });
}

export function supportSubmissionIdentity(
  state: SupportDialogState,
): { idempotencyKey: string; fingerprint: string } {
  const fingerprint = supportSubmissionFingerprint(state);
  return {
    idempotencyKey: state.submissionFingerprint
      && state.submissionFingerprint !== fingerprint
      ? randomId('report')
      : state.idempotencyKey,
    fingerprint,
  };
}

export function newSupportDialogState(): SupportDialogState {
  return {
    draftId: randomId('draft'),
    idempotencyKey: randomId('report'),
    submissionFingerprint: '',
    contact: '',
    message: '',
    attach: false,
    status: 'idle',
    preview: null,
    rawOpen: false,
    errorCode: '',
    reportId: '',
  };
}

export function codePointLength(value: string): number {
  return [...value].length;
}

export type SupportDraftError =
  | 'message_required'
  | 'message_too_long'
  | 'contact_too_long'
  | 'preview_missing'
  | 'preview_expired'
  | null;

export function supportDraftError(state: SupportDialogState, now = Date.now()): SupportDraftError {
  const message = state.message.trim();
  if (!message) return 'message_required';
  if (codePointLength(message) > SUPPORT_MESSAGE_LIMIT) return 'message_too_long';
  if (codePointLength(state.contact.trim()) > SUPPORT_CONTACT_LIMIT) return 'contact_too_long';
  if (state.attach && !state.preview) return 'preview_missing';
  if (state.attach && state.preview!.expiresAt <= now) return 'preview_expired';
  return null;
}

export function supportCanSubmit(state: SupportDialogState, now = Date.now()): boolean {
  return state.status !== 'building'
    && state.status !== 'sending'
    && state.status !== 'success'
    && supportDraftError(state, now) === null;
}

function browserOf(userAgent: string): { family: SupportRuntimeFacts['browser_family']; major: number } {
  const firefox = /Firefox\/(\d+)/i.exec(userAgent);
  if (firefox) return { family: 'firefox', major: Number(firefox[1]) || 0 };
  const chromium = /(?:Chrome|Chromium|Edg)\/(\d+)/i.exec(userAgent);
  if (chromium) return { family: 'chromium', major: Number(chromium[1]) || 0 };
  const webkit = /Version\/(\d+).+Safari\//i.exec(userAgent);
  if (webkit) return { family: 'webkit', major: Number(webkit[1]) || 0 };
  return { family: 'unknown', major: 0 };
}

export function supportRuntimeFacts(
  options: {
    userAgent?: string;
    language: string;
    coarsePointer?: boolean;
    hoverCapable?: boolean;
    registryAccess: 'pending' | 'full' | 'limited';
    registryLastSuccess?: number;
    now?: number;
  },
): SupportRuntimeFacts {
  const browser = browserOf(options.userAgent ?? globalThis.navigator?.userAgent ?? '');
  const now = options.now ?? Date.now();
  const last = Number(options.registryLastSuccess || 0);
  const age = last <= 0 ? 'unknown' : now - last <= 10 * 60_000 ? 'fresh' : 'stale';
  const languages: readonly string[] = ['en', 'ru', 'de', 'fr'];
  const language = languages.includes(options.language)
    ? options.language as SupportRuntimeFacts['language'] : 'en';
  const media = globalThis.matchMedia?.bind(globalThis);
  return {
    browser_family: browser.family,
    browser_major: Math.max(0, Math.min(999, browser.major)),
    language,
    coarse_pointer: options.coarsePointer ?? !!media?.('(pointer: coarse)').matches,
    hover_capable: options.hoverCapable ?? !!media?.('(hover: hover)').matches,
    registry_access: options.registryAccess === 'full'
      ? 'full' : options.registryAccess === 'limited' ? 'partial' : 'unavailable',
    registry_age_bucket: age,
  };
}

export function supportErrorCode(value: unknown): string {
  const code = value && typeof value === 'object' && 'code' in value
    ? String((value as { code?: unknown }).code || '') : '';
  return new Set([
    'support_invalid_message', 'support_preview_expired', 'support_package_too_large',
    'support_rate_limited', 'support_unavailable', 'support_rejected', 'unauthorized',
  ]).has(code) ? code : 'support_unavailable';
}

export function supportSizeKiB(size: number): string {
  return (Math.max(0, size) / 1024).toFixed(size < 10 * 1024 ? 1 : 0);
}
