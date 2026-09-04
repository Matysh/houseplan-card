import { subst } from '../logic';
import type { Lang } from './registry';
import de from './topology/de.json' with { type: 'json' };
import en from './topology/en.json' with { type: 'json' };
import fr from './topology/fr.json' with { type: 'json' };
import ru from './topology/ru.json' with { type: 'json' };

export type TopologyI18nKey = keyof typeof en;

const DICTIONARIES: Record<Lang, Record<TopologyI18nKey, string>> = { en, ru, de, fr };

export function topologyT(
  lang: Lang, key: TopologyI18nKey, vars?: Record<string, string | number>,
): string {
  return subst(DICTIONARIES[lang]?.[key] ?? en[key] ?? key, vars);
}
