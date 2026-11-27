/** Standalone alone ships the full MDI database as a lazy, retryable chunk. */
import type { IconCatalog } from './icon-catalog';

let retry = 0;
let catalog: Promise<IconCatalog> | undefined;

export function loadStandaloneIconCatalog(): Promise<IconCatalog> {
  if (catalog) return catalog;
  const attempt = retry++;
  return catalog = (attempt === 0 ? import('./mdi-icon-catalog')
    : import(new URL('__HOUSEPLAN_MDI_CATALOG_RETRY_ASSET__?retry=' + attempt, import.meta.url).href))
    .then(module => module.mdiCatalog).catch(error => {
      catalog = undefined;
      throw error;
    });
}
