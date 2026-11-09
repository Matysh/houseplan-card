/** Lazy, local MDI 7.4 catalog. Never imported by View or HA internals. */
import * as paths from '@mdi/js';
import names from './mdi-icon-names.json' with { type: 'json' };
export const mdiCatalog: ReadonlyMap<string, string> = new Map(names.map(name => {
  // Use canonical names: guessing kebab-case from exports loses digit separators.
  const key = 'mdi' + name.replace(/(^|-)(\w)/g, (_all, _dash, c: string) => c.toUpperCase());
  const path = (paths as Record<string, string>)[key];
  if (!path) throw Error('Missing local MDI path: ' + name);
  return ['mdi:' + name, path];
}));
