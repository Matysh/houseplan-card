import en from './en.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };
import {
  LanguageRuntime,
  type LanguageRuntimeContract,
  type LazyLanguageModule,
  type LocaleDictionary,
} from './language-runtime';

const BUILD_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
const GERMAN_RETRY_ASSET = '__HOUSEPLAN_DE_RETRY_ASSET__';

export interface LanguageEntry {
  code: string;
  nativeLabel: string;
  dictionary?: LocaleDictionary;
  loadDictionary?: (attempt: 0 | 1) => Promise<LazyLanguageModule>;
}

async function loadGerman(attempt: 0 | 1): Promise<LazyLanguageModule> {
  const module = attempt === 0
    ? await import('./de')
    : await import(/* @vite-ignore */ new URL(`${GERMAN_RETRY_ASSET}?retry`, import.meta.url).href);
  return { dictionary: module.dictionary, fingerprint: module.fingerprint };
}

/**
 * The single runtime registry of shipped UI languages.
 *
 * Keep English first: it is the synchronous fallback. Adding a locale means
 * adding its frontend/backend JSON files and one static entry in this module.
 */
export const LANGUAGE_REGISTRY = [
  { code: 'en', nativeLabel: 'English', dictionary: en },
  { code: 'ru', nativeLabel: 'Русский', dictionary: ru },
  { code: 'de', nativeLabel: 'Deutsch', loadDictionary: loadGerman },
] as const satisfies readonly LanguageEntry[];

export type Lang = (typeof LANGUAGE_REGISTRY)[number]['code'];

export const FALLBACK_LANGUAGE_CODE: Lang = 'en';
export const FALLBACK_DICTIONARY = en;

/**
 * #354: locale-load failures surface once through this page-scoped listener
 * list. Only the View card subscribes and toasts; every other runtime surface
 * (space card, both GUI editors) stays with the console warning below.
 */
const languageLoadFailureListeners = new Set<(code: string) => void>();

export function subscribeLanguageLoadFailures(
  listener: (code: string) => void,
): () => void {
  languageLoadFailureListeners.add(listener);
  return () => languageLoadFailureListeners.delete(listener);
}

/**
 * Deliver one settled failure to every subscriber. Exported so a unit can
 * prove the delivery itself (#354 r1-M1) — the runtime below wires its
 * `loadFailed` hook straight to this function.
 */
export function notifyLanguageLoadFailures(code: string): void {
  for (const listener of languageLoadFailureListeners) listener(code);
}

/**
 * The production runtime IS the tested class (#354): the previous handwritten
 * object duplicated its logic, so the whole i18n-runtime test suite proved
 * properties of code the card never ran. One page-scoped instance is shared
 * by every card and editor; the warn hook keeps the console line and fans the
 * failure out to subscribers.
 */
export const LANGUAGE_RUNTIME: LanguageRuntimeContract = new LanguageRuntime(
  LANGUAGE_REGISTRY,
  BUILD_FINGERPRINT,
  console.warn,
  notifyLanguageLoadFailures,
);

/** Return a loaded dictionary, falling back synchronously to English. */
export function dictionaryFor(value: unknown): LocaleDictionary {
  const code = languageEntry(value)?.code ?? FALLBACK_LANGUAGE_CODE;
  return LANGUAGE_RUNTIME.dictionary(code) ?? FALLBACK_DICTIONARY;
}

/** Ensure a lazy locale has settled (success or bounded English fallback). */
export function ensureLanguage(value: unknown): Promise<void> {
  const code = languageEntry(value)?.code ?? FALLBACK_LANGUAGE_CODE;
  return LANGUAGE_RUNTIME.ensure(code);
}

/** Normalize HA locale tags for registry lookup. */
export function normalizeLanguageTag(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replaceAll('_', '-').toLowerCase()
    : '';
}

/** Build a case-insensitive BCP 47 lookup while retaining canonical codes. */
export function buildLanguageLookup<T extends { code: string }>(
  entries: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(entries.map((entry) => [normalizeLanguageTag(entry.code), entry]));
}

const LANGUAGE_BY_CODE = buildLanguageLookup(LANGUAGE_REGISTRY);

/** Return the canonical registry entry for a locale code, if it is shipped. */
export function languageEntry(value: unknown): LanguageEntry | undefined {
  return LANGUAGE_BY_CODE.get(normalizeLanguageTag(value));
}

/**
 * Resolve an explicit setting and HA locale against any registry-shaped code
 * list. The generic form keeps the fallback rules testable with future-locale
 * fixtures without registering a fake production dictionary.
 */
export function resolveLanguageCode<T extends string>(
  explicitLanguage: unknown,
  haLanguage: unknown,
  supportedCodes: readonly T[],
  fallback: T,
): T {
  const supported = new Map<string, T>(
    supportedCodes.map((code) => [normalizeLanguageTag(code), code]),
  );
  const explicit = supported.get(normalizeLanguageTag(explicitLanguage));
  if (explicit) return explicit;

  const locale = normalizeLanguageTag(haLanguage);
  const exact = supported.get(locale);
  if (exact) return exact;
  const primary = supported.get(locale.split('-')[0] || '');
  return primary ?? fallback;
}

export interface LanguageOption {
  value: string;
  label: string;
}

/** Build visual-editor options and preserve an unknown persisted raw value. */
export function languageOptions(
  autoLabel: string,
  currentLanguage?: unknown,
): LanguageOption[] {
  const options: LanguageOption[] = [
    { value: '', label: autoLabel },
    ...LANGUAGE_REGISTRY.map(({ code, nativeLabel }) => ({
      value: code,
      label: nativeLabel,
    })),
  ];
  const raw = typeof currentLanguage === 'string' ? currentLanguage : '';
  if (raw && !options.some((option) => option.value === raw)) {
    options.push({ value: raw, label: languageEntry(raw)?.nativeLabel ?? raw });
  }
  return options;
}
