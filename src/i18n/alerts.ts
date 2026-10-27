/** Loaded only with configured alert runtime or Device settings. */
import type { Lang } from './registry';
const dictionaries = {
  en: { attention: 'Attention', alarm: 'Alarm', unavailable: 'Current value unavailable' },
  ru: { attention: 'Внимание', alarm: 'Тревога', unavailable: 'Текущее значение недоступно' },
  de: { attention: 'Achtung', alarm: 'Alarm', unavailable: 'Aktueller Wert nicht verfügbar' },
  fr: { attention: 'Attention', alarm: 'Alarme', unavailable: 'Valeur actuelle indisponible' },
};
export function alertT(lang: Lang, key: keyof typeof dictionaries.en): string {
  return (dictionaries[lang] || dictionaries.en)[key];
}
