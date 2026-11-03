import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('process-next/catalog/cutover.json', root), 'utf8'));

test('reinstalling workflow templates preserves the deployed workflows byte for byte', async t => {
  assert.ok(catalog.installTemplates.length > 0, 'the installation selection must not be empty');
  for (const { source, target } of catalog.installTemplates) {
    await t.test(`${source} → ${target}`, async () => {
      const [template, deployed] = await Promise.all([
        readFile(new URL(source, root)), readFile(new URL(target, root)),
      ]);
      assert.ok(template.equals(deployed), `${source} differs from ${target}; reinstalling would change the deployed workflow`);
    });
  }
});
