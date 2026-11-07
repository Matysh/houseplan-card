/**
 * Lazy dictionary of the plan editors' tools (#780): the furniture library and
 * the LED strip tool and Device-only profile help. Приём #627: строки инструментов администратора живут в
 * ленивом графе редактора, а не в первом кадре View — их перенос из основных
 * словарей освобождает стартовый граф под LED-ленты (ТЗ #780 §13.1).
 *
 * English is static (the synchronous fallback); ru/de/fr are separate lazy
 * chunks. The editor runtime waits for this runtime before it paints.
 */
import { subst } from '../logic';
import type { Lang } from './registry';
import en from './tools/en.json' with { type: 'json' };
import { namespaceLanguageRuntime } from './namespace-language';

export type ToolsI18nKey = keyof typeof en;

let retrySeq = 0;
const retryUrl = (asset: string, fresh = false): string => new URL(`${asset}?retry${fresh ? '=' + (++retrySeq) : ''}`, import.meta.url).href;

export const TOOLS_LANGUAGE_RUNTIME = namespaceLanguageRuntime(en, {
  ru: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./tools/tools-ru')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_TOOLS_RU_RETRY_ASSET__', fresh))),
  de: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./tools/tools-de')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_TOOLS_DE_RETRY_ASSET__', fresh))),
  fr: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./tools/tools-fr')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_TOOLS_FR_RETRY_ASSET__', fresh))),
});

export function toolsT(
  lang: Lang, key: ToolsI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(TOOLS_LANGUAGE_RUNTIME.dictionary(lang)?.[key] ?? en[key] ?? key, vars);
}
