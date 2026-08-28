import en from './en.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };
import type {
  LanguageRuntimeContract,
  LazyLanguageModule,
  LocaleDictionary,
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

/** One page-scoped cache: multiple cards share the same locale request. */
let germanDictionary: LocaleDictionary | undefined;
let germanPending: Promise<void> | undefined;
let germanFailed = false;

async function settleGerman(): Promise<void> {
  let lastError: unknown;
  for (const attempt of [0, 1] as const) {
    try {
      const loaded = await loadGerman(attempt);
      if (loaded.fingerprint !== BUILD_FINGERPRINT) throw new Error('locale fingerprint mismatch');
      germanDictionary = loaded.dictionary;
      return;
    } catch (error) {
      lastError = error;
    }
  }
  germanFailed = true;
  console.warn('[houseplan] unable to load de locale; using English', lastError);
}

export const LANGUAGE_RUNTIME: LanguageRuntimeContract = {
  state: (code) => code !== 'de' || germanDictionary
    ? 'ready' : germanFailed ? 'fallback' : 'pending',
  dictionary: (code) => code === 'de'
    ? germanDictionary : code === 'ru' ? ru : code === 'en' ? en : undefined,
  ensure: (code) => {
    if (code !== 'de' || germanDictionary || germanFailed) return Promise.resolve();
    return germanPending ??= settleGerman().finally(() => { germanPending = undefined; });
  },
};

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
