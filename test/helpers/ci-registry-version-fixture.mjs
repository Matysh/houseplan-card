// Write synthetic release mirrors inside the caller's temporary Git repository.
// No real product source is read or asserted through text anchors.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const put = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
export function fixtureVersions(root, version) {
  put(root, 'package.json', JSON.stringify({ name: 'fixture', version, dependencies: { preserved: '1.0.0' } }, null, 2) + '\n');
  put(root, 'package-lock.json', JSON.stringify({ version, packages: { '': { name: 'fixture', version }, 'node_modules/preserved': { version: '1.0.0' } } }, null, 2) + '\n');
  put(root, 'custom_components/houseplan/manifest.json', JSON.stringify({ version, domain: 'houseplan' }) + '\n');
  put(root, 'custom_components/houseplan/const.py', 'VERSION = "' + version + '"\nPRESERVED = 42\n');
  put(root, 'src/houseplan-card.ts', 'export const CARD_VERSION = "' + version + '";\nexport const value = 1;\n');
  put(root, 'src/houseplan-editor-runtime.ts', 'const CARD_VERSION = "' + version + '";\nexport { CARD_VERSION };\n');
}
