/**
 * Lazy dictionary of the settings dialogs (#600). Приём #423/#459: строки
 * инструмента администратора живут в ленивом графе, а не в первом кадре, и в
 * своём словаре, а не в `support` — иначе онбординг тянул бы весь словарь
 * редактора ради подписей одной формы.
 */
import { subst } from '../logic';
import type { Lang } from './registry';
import de from './settings/de.json' with { type: 'json' };
import en from './settings/en.json' with { type: 'json' };
import fr from './settings/fr.json' with { type: 'json' };
import ru from './settings/ru.json' with { type: 'json' };

export type SettingsI18nKey = keyof typeof en;

const DICTIONARIES: Record<Lang, Record<SettingsI18nKey, string>> = { en, ru, de, fr };

/** Есть ли у ключа непустой текст (английский — слой отката, как у `topologyT`). */
export function hasSettingsTranslation(lang: Lang, key: string): key is SettingsI18nKey {
  const value = DICTIONARIES[lang]?.[key as SettingsI18nKey] ?? en[key as SettingsI18nKey];
  return typeof value === 'string' && value.trim().length > 0;
}

export function settingsT(
  lang: Lang, key: SettingsI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(DICTIONARIES[lang]?.[key] ?? en[key] ?? key, vars);
}
