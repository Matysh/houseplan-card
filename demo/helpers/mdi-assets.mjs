/** Materialize HA-shaped MDI files for the synthetic demo, outside the product bundle. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function generateDemoMdiAssets(root) {
  const output = resolve(root, 'demo/srv/static/mdi');
  const icons = JSON.parse(readFileSync(resolve(root, 'src/mdi-icon-data.json'), 'utf8'));
  const names = Object.keys(icons).sort();
  const parts = [];

  mkdirSync(output, { recursive: true });
  for (let offset = 0; offset < names.length; offset += 145) {
    const entries = names.slice(offset, offset + 145).map(name => [name.slice(4), icons[name]]);
    const payload = JSON.stringify(Object.fromEntries(entries));
    const file = createHash('sha1').update(payload).digest('hex');
    writeFileSync(resolve(output, file + '.json'), payload);
    parts.push(offset ? { start: entries[0][0], file } : { file });
  }
  writeFileSync(resolve(output, 'iconList.json'),
    JSON.stringify(names.map(name => ({ name: name.slice(4), keywords: [] }))));
  writeFileSync(resolve(output, 'iconMetadata.json'), JSON.stringify({ parts }));
}
