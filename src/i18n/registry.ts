import en from './en.json' with { type: 'json' };
import ru from './ru.json' with { type: 'json' };

export interface LanguageEntry {
  code: string;
  nativeLabel: string;
  dictionary: Record<string, string>;
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
] as const satisfies readonly LanguageEntry[];

export type Lang = (typeof LANGUAGE_REGISTRY)[number]['code'];

export const FALLBACK_LANGUAGE_CODE: Lang = 'en';
export const FALLBACK_DICTIONARY = en;

const LANGUAGE_BY_CODE = new Map<string, LanguageEntry>(
  LANGUAGE_REGISTRY.map((entry) => [entry.code, entry]),
);

/** Normalize HA locale tags for registry lookup. */
export function normalizeLanguageTag(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replaceAll('_', '-').toLowerCase()
    : '';
}

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
