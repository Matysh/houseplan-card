/**
 * Lazy dictionary of the settings dialogs (#600). Приём #423/#459: строки
 * инструмента администратора живут в ленивом графе, а не в первом кадре, и в
 * своём словаре, а не в `support` — иначе онбординг тянул бы весь словарь
 * редактора ради подписей одной формы.
 *
 * #627: статически здесь только английский — слой отката; ru/de/fr — отдельные
 * ленивые чанки, по одному на язык, и грузится только язык на экране. Готовность
 * до отрисовки обеспечивают загрузчики рантаймов и составной гейт хоста.
 */
import { subst } from '../logic';
import type { Lang } from './registry';
import en from './settings/en.json' with { type: 'json' };
import { namespaceLanguageRuntime } from './namespace-language';

export type SettingsI18nKey = keyof typeof en;

const retryUrl = (asset: string): string => new URL(`${asset}?retry`, import.meta.url).href;

export const SETTINGS_LANGUAGE_RUNTIME = namespaceLanguageRuntime(en, {
  ru: (attempt) => (attempt === 0 ? import('./settings/settings-ru')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_SETTINGS_RU_RETRY_ASSET__'))),
  de: (attempt) => (attempt === 0 ? import('./settings/settings-de')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_SETTINGS_DE_RETRY_ASSET__'))),
  fr: (attempt) => (attempt === 0 ? import('./settings/settings-fr')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_SETTINGS_FR_RETRY_ASSET__'))),
});

const entryOf = (lang: Lang, key: SettingsI18nKey): string | undefined =>
  SETTINGS_LANGUAGE_RUNTIME.dictionary(lang)?.[key] ?? en[key];

/** Есть ли у ключа непустой текст (английский — слой отката, как у `topologyT`). */
export function hasSettingsTranslation(lang: Lang, key: string): key is SettingsI18nKey {
  const value = entryOf(lang, key as SettingsI18nKey);
  return typeof value === 'string' && value.trim().length > 0;
}

export function settingsT(
  lang: Lang, key: SettingsI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(entryOf(lang, key) ?? key, vars);
}
