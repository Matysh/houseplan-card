/**
 * Lazy dictionary of the LED strip tool (#780). English is static in the LED
 * editor chunk (the synchronous fallback), ru/de/fr are separate lazy chunks;
 * the LED editor waits for this runtime before it paints its copy. Nothing
 * of it reaches the initial View graph or the editor runtime graph.
 */
import { subst } from '../logic';
import type { Lang } from './registry';
import en from './led/en.json' with { type: 'json' };
import { namespaceLanguageRuntime } from './namespace-language';

export type LedI18nKey = keyof typeof en;

let retrySeq = 0;
const retryUrl = (asset: string, fresh = false): string => new URL(`${asset}?retry${fresh ? '=' + (++retrySeq) : ''}`, import.meta.url).href;

export const LED_LANGUAGE_RUNTIME = namespaceLanguageRuntime(en, {
  ru: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./led/led-ru')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_LED_RU_RETRY_ASSET__', fresh))),
  de: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./led/led-de')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_LED_DE_RETRY_ASSET__', fresh))),
  fr: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./led/led-fr')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_LED_FR_RETRY_ASSET__', fresh))),
});

export function ledT(
  lang: Lang, key: LedI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(LED_LANGUAGE_RUNTIME.dictionary(lang)?.[key] ?? en[key] ?? key, vars);
}
