/** Pure state/validation helpers for the lazy Help & Feedback dialog (#43). */

export const SUPPORT_MESSAGE_LIMIT = 10_000;
export const SUPPORT_CONTACT_LIMIT = 320;

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

export function newSupportDialogState(): SupportDialogState {
  return {
    draftId: randomId('draft'),
    idempotencyKey: randomId('report'),
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
