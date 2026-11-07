import { subst } from '../logic';
import type { Lang } from './registry';
import en from './topology/en.json' with { type: 'json' };
import { namespaceLanguageRuntime } from './namespace-language';

export type TopologyI18nKey = keyof typeof en;

let retrySeq = 0;
const retryUrl = (asset: string, fresh = false): string => new URL(`${asset}?retry${fresh ? '=' + (++retrySeq) : ''}`, import.meta.url).href;

/**
 * #627: English is static (the synchronous fallback); ru/de/fr are separate
 * lazy chunks. The View overlay and the editor runtime both wait for this
 * runtime before they paint topology copy.
 */
export const TOPOLOGY_LANGUAGE_RUNTIME = namespaceLanguageRuntime(en, {
  ru: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./topology/topology-ru')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_TOPOLOGY_RU_RETRY_ASSET__', fresh))),
  de: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./topology/topology-de')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_TOPOLOGY_DE_RETRY_ASSET__', fresh))),
  fr: (attempt, fresh = false) => (attempt === 0 && !fresh ? import('./topology/topology-fr')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_TOPOLOGY_FR_RETRY_ASSET__', fresh))),
});

/**
 * Whether the namespace really carries this string (#459).
 *
 * `topologyT` never fails: a missing key comes back as the key itself, so a
 * caller that only looks at the resolved value cannot tell «no translation»
 * from «translated to the word help». Affordances that must fail closed —
 * the contextual help circle is one — ask this instead. English is the
 * fallback layer exactly as in `topologyT`, so a key present in English and
 * missing in one locale still counts as available.
 */
export function hasTopologyTranslation(lang: Lang, key: TopologyI18nKey): boolean {
  const value = TOPOLOGY_LANGUAGE_RUNTIME.dictionary(lang)?.[key] ?? en[key];
  return typeof value === 'string' && value.trim().length > 0;
}

export function topologyT(
  lang: Lang, key: TopologyI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(TOPOLOGY_LANGUAGE_RUNTIME.dictionary(lang)?.[key] ?? en[key] ?? key, vars);
}
