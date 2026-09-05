import { subst } from '../logic';
import type { Lang } from './registry';
import de from './topology/de.json' with { type: 'json' };
import en from './topology/en.json' with { type: 'json' };
import fr from './topology/fr.json' with { type: 'json' };
import ru from './topology/ru.json' with { type: 'json' };

export type TopologyI18nKey = keyof typeof en;

const DICTIONARIES: Record<Lang, Record<TopologyI18nKey, string>> = { en, ru, de, fr };

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
  const value = DICTIONARIES[lang]?.[key] ?? en[key];
  return typeof value === 'string' && value.trim().length > 0;
}

export function topologyT(
  lang: Lang, key: TopologyI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(DICTIONARIES[lang]?.[key] ?? en[key] ?? key, vars);
}
