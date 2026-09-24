/**
 * Lazy editor-only dictionaries owned by the editor runtime (#423).
 *
 * #627: English is static (the synchronous fallback); ru/de/fr are separate
 * lazy chunks, one per language, loaded only for the language on screen.
 */
import { subst } from '../logic';
import type { Lang } from './registry';
import en from './support/en.json' with { type: 'json' };
import { namespaceLanguageRuntime } from './namespace-language';

export type SupportI18nKey = keyof typeof en;

const retryUrl = (asset: string): string => new URL(`${asset}?retry`, import.meta.url).href;

export const SUPPORT_LANGUAGE_RUNTIME = namespaceLanguageRuntime(en, {
  ru: (attempt) => (attempt === 0 ? import('./support/support-ru')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_SUPPORT_RU_RETRY_ASSET__'))),
  de: (attempt) => (attempt === 0 ? import('./support/support-de')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_SUPPORT_DE_RETRY_ASSET__'))),
  fr: (attempt) => (attempt === 0 ? import('./support/support-fr')
    : import(/* @vite-ignore */ retryUrl('__HOUSEPLAN_SUPPORT_FR_RETRY_ASSET__'))),
});

/** Translate editor-only copy with the same synchronous English fallback. */
export function supportT(
  lang: Lang,
  key: SupportI18nKey,
  vars?: Record<string, string | number>,
): string {
  return subst(SUPPORT_LANGUAGE_RUNTIME.dictionary(lang)?.[key] ?? en[key] ?? key, vars);
}
