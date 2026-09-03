/** Lazy editor-only dictionaries owned by the editor runtime (#423). */
import { subst } from '../logic';
import type { Lang } from './registry';
import de from './support/de.json' with { type: 'json' };
import en from './support/en.json' with { type: 'json' };
import fr from './support/fr.json' with { type: 'json' };
import ru from './support/ru.json' with { type: 'json' };

export type SupportI18nKey = keyof typeof en;

const SUPPORT_DICTIONARIES: Record<Lang, Record<SupportI18nKey, string>> = {
  en,
  ru,
  de,
  fr,
};

/** Translate editor-only copy with the same synchronous English fallback. */
export function supportT(
  lang: Lang,
  key: SupportI18nKey,
  vars?: Record<string, string | number>,
): string {
  return subst(SUPPORT_DICTIONARIES[lang]?.[key] ?? en[key] ?? key, vars);
}
