/**
 * Card UI localization. Shipped languages live in the typed registry; see the
 * translation contribution flow in CONTRIBUTING.md. The language is resolved
 * from the card config or, by default, from the HA user profile. Unknown
 * languages fall back to English synchronously.
 */
import { subst } from './logic';
import {
  FALLBACK_DICTIONARY,
  FALLBACK_LANGUAGE_CODE,
  LANGUAGE_REGISTRY,
  dictionaryFor,
  resolveLanguageCode,
  type Lang,
} from './i18n/registry';

type Key = keyof typeof FALLBACK_DICTIONARY;

export type { Lang } from './i18n/registry';

/** Resolve the UI language: explicit config option wins, then the HA profile. */
export function langOf(hass: any, configLang?: string | null): Lang {
  return resolveLanguageCode(
    configLang,
    hass?.locale?.language || hass?.language,
    LANGUAGE_REGISTRY.map(({ code }) => code),
    FALLBACK_LANGUAGE_CODE,
  );
}

/** Translate a key with optional {placeholder} substitution. */
export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const dictionary = dictionaryFor(lang);
  return subst(dictionary[key] ?? FALLBACK_DICTIONARY[key] ?? key, vars);
}

/** Whether a localized value exists and contains useful text after fallback. */
export function hasTranslation(lang: Lang, key: string): boolean {
  const value = dictionaryFor(lang)[key] ?? FALLBACK_DICTIONARY[key];
  return typeof value === 'string' && value.trim().length > 0;
}

export type { Key as I18nKey };
