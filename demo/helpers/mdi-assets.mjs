/** Same-origin MDI fixtures for demos without a genuine HA frontend. */
import { readFileSync } from 'node:fs';

const ROOT = '/static/mdi/';
const FIRST = '1'.repeat(40);
const SECOND = '2'.repeat(40);
const BOUNDARY = 'map-marker';
const FILES = new Set(['iconList.json', 'iconMetadata.json', FIRST + '.json', SECOND + '.json']);
let assets;

export function mdiFixtureAsset(pathname) {
  if (!pathname.startsWith(ROOT)) return undefined;
  const file = pathname.slice(ROOT.length);
  if (!FILES.has(file)) return undefined;
  if (!assets) {
    const icons = Object.entries(JSON.parse(readFileSync(new URL('../../src/mdi-icon-data.json', import.meta.url))))
      .map(([name, glyph]) => [name.slice('mdi:'.length), glyph]);
    assets = {
      'iconList.json': JSON.stringify(icons.map(([name]) => ({name, keywords: []}))),
      'iconMetadata.json': JSON.stringify({version: '7.4.47', parts: [{file: FIRST}, {start: BOUNDARY, file: SECOND}]}),
      [FIRST + '.json']: JSON.stringify(Object.fromEntries(icons.filter(([name]) => name < BOUNDARY))),
      [SECOND + '.json']: JSON.stringify(Object.fromEntries(icons.filter(([name]) => name >= BOUNDARY))),
    };
  }
  return assets[file];
}
