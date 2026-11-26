/** Loaded only with configured alert runtime or Device settings. */
import type { Lang } from './registry';
const dictionaries = {
  en: { attention: 'Attention', alarm: 'Alarm', unavailable: 'Current value unavailable', external: 'Signal from Home Assistant' },
  ru: { attention: 'Внимание', alarm: 'Тревога', unavailable: 'Текущее значение недоступно', external: 'Сигнал из Home Assistant' },
  de: { attention: 'Achtung', alarm: 'Alarm', unavailable: 'Aktueller Wert nicht verfügbar', external: 'Signal aus Home Assistant' },
  fr: { attention: 'Attention', alarm: 'Alarme', unavailable: 'Valeur actuelle indisponible', external: 'Signal de Home Assistant' },
};
export function alertT(lang: Lang, key: keyof typeof dictionaries.en): string {
  return (dictionaries[lang] || dictionaries.en)[key];
}
