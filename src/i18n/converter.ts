/** Tiny informational namespace, loaded with its component, including all locales. */
import en from './converter/en.json' with { type: 'json' };
import ru from './converter/ru.json' with { type: 'json' };
import de from './converter/de.json' with { type: 'json' };
import fr from './converter/fr.json' with { type: 'json' };
import { subst } from '../logic';
import type { Lang } from './registry';

export type ConverterI18nKey = keyof typeof en;
export const CONVERTER_DICTIONARIES: Readonly<Record<Lang, typeof en>> = { en, ru, de, fr };
export function converterT(lang: Lang, key: ConverterI18nKey, vars?: Record<string, string | number>): string {
  return subst((CONVERTER_DICTIONARIES[lang] || en)[key], vars);
}
