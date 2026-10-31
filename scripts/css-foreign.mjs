/** Foreign classes are scoped provenance, never local/global class producers.
 * The corresponding genuine-component smoke witnesses the declared vocabulary.
 * A dependency upgrade or an unused declaration fails closed until rechecked. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FOREIGN_CSS_FILE = 'scripts/css-foreign.json';
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => record(value)
  && Object.keys(value).sort().join(',') === [...expected].sort().join(',');
const requireThat = (condition, message) => { if (!condition) throw Error(message); };

export function loadForeignCss(root = process.cwd()) {
  const path = resolve(root, FOREIGN_CSS_FILE);
  if (!existsSync(path)) return { entries: [], provider: null };
  const contract = JSON.parse(readFileSync(path, 'utf8'));
  requireThat(keys(contract, ['schema', 'provider', 'consumers']) && contract.schema === 1, 'Invalid foreign CSS schema');
  const provider = contract.provider;
  requireThat(keys(provider, ['name', 'lock', 'version', 'sha256'])
    && provider.name === 'home-assistant-frontend' && provider.lock === 'demo/ui-lab/ha-lock.json'
    && typeof provider.version === 'string' && /^[a-f0-9]{64}$/.test(provider.sha256), 'Invalid foreign CSS provider');
  const pin = JSON.parse(readFileSync(resolve(root, provider.lock), 'utf8'));
  requireThat(pin.version === provider.version && pin.sha256 === provider.sha256, 'Foreign CSS provider pin changed; revalidate genuine component vocabulary');
  requireThat(Array.isArray(contract.consumers) && contract.consumers.length > 0, 'Empty foreign CSS consumers');
  const entries = [], files = new Set();
  for (const consumer of contract.consumers) {
    requireThat(keys(consumer, ['file', 'components']) && typeof consumer.file === 'string'
      && /^src\/(?:[\w-]+\/)*[\w.-]+\.tsx?$/.test(consumer.file)
      && !files.has(consumer.file) && existsSync(resolve(root, consumer.file)), 'Invalid, duplicate or missing foreign CSS consumer file');
    files.add(consumer.file);
    requireThat(record(consumer.components) && Object.keys(consumer.components).length > 0, 'Empty foreign CSS components');
    const names = new Set();
    for (const [component, classes] of Object.entries(consumer.components)) {
      requireThat(/^(?:ha|wa)-[a-z][a-z0-9-]*$/.test(component) && Array.isArray(classes) && classes.length > 0, 'Invalid foreign component vocabulary');
      for (const name of classes) {
        requireThat(typeof name === 'string' && /^[a-zA-Z_][\w-]*$/.test(name) && !names.has(name), 'Invalid or duplicate foreign class');
        names.add(name); entries.push({ file: consumer.file, component, name });
      }
    }
  }
  return { entries, provider };
}

export function foreignCssScope(root = process.cwd()) {
  const diagnostics = [], used = new Set();
  let contract = { entries: [], provider: null };
  const diagnostic = message => ({ file: FOREIGN_CSS_FILE, line: 1, kind: 'foreign-css', name: '', message });
  try { contract = loadForeignCss(root); } catch (error) { diagnostics.push(diagnostic(error.message)); }
  const byKey = new Map(contract.entries.map(row => [row.file + ':' + row.name, row]));
  return {
    diagnostics,
    accept(file, name) {
      const key = file + ':' + name, entry = byKey.get(key);
      if (entry) used.add(key);
      return entry;
    },
    finish() {
      for (const [key, row] of byKey) if (!used.has(key)) diagnostics.push(diagnostic(`Unused foreign class ${row.file}:${row.name}; remove stale declaration`));
      return { provider: contract.provider, consumers: [...used].map(key => byKey.get(key)) };
    },
  };
}

/** Shared by the genuine HA browser witness and negative unit fixtures. */
export function assertForeignCssWitness(contract, provenance, observed) {
  requireThat(contract.provider && contract.entries.length > 0, 'Foreign CSS witness has no contract');
  requireThat(provenance.frontendVersion === contract.provider.version
    && provenance.frontendWheelSha256 === contract.provider.sha256, 'Foreign CSS witness provider differs from pinned contract');
  const found = new Set(observed.map(row => row.component + ':' + row.name));
  const missing = contract.entries.filter(row => !found.has(row.component + ':' + row.name));
  requireThat(!missing.length, 'Missing genuine HA class witnesses: ' + missing.map(row => row.component + ':' + row.name).join(', '));
}
