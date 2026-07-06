/**
 * Card UI localization. Dictionaries live in src/i18n/<lang>.json so that new
 * languages can be contributed without touching TypeScript. The language is
 * resolved from the card config (`language: en|ru`) or, by default, from the
 * HA user profile (hass.locale.language); anything that is not a known
 * language falls back to English.
 */
import { subst } from './logic';
import en from './i18n/en.json';
import ru from './i18n/ru.json';

export type Lang = 'en' | 'ru';
type Key = keyof typeof en;

const DICTS: Record<Lang, Record<string, string>> = { en, ru };

/** Resolve the UI language: explicit config option wins, then the HA profile. */
export function langOf(hass: any, configLang?: string | null): Lang {
  if (configLang && configLang in DICTS) return configLang as Lang;
  const l = (hass?.locale?.language || hass?.language || 'en').toLowerCase();
  return l.startsWith('ru') ? 'ru' : 'en';
}

/** Translate a key with optional {placeholder} substitution. */
export function t(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  return subst(DICTS[lang][key] ?? en[key] ?? key, vars);
}

export type { Key as I18nKey };
