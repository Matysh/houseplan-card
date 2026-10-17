/** Catalog-only strings belong to the already-loaded editor namespace, not View. */
import { langOf } from './i18n';
import { toolsT, type ToolsI18nKey } from './i18n/tools';
export interface InboxLanguageHost { hass?: unknown; _config?: { language?: string } }
export const inboxT = (host: InboxLanguageHost, key: ToolsI18nKey, vars?: Record<string, string | number>): string =>
  toolsT(langOf(host.hass, host._config?.language), key, vars);
