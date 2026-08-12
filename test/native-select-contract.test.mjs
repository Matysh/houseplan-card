import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');

test('native selects never rely on value assignment before dynamic options mount', () => {
  const blocks = [...source.matchAll(/<select\b[\s\S]*?<\/select>/g)].map((match) => match[0]);
  const valueBoundIds = blocks
    .filter((block) => /\.value\s*=\s*\$\{/.test(block))
    .map((block) => block.match(/\bid="([^"]+)"/)?.[1] || '(missing id)');

  // This is a command menu, not persisted state: it intentionally resets to
  // its empty first row after inserting an HA variable into decorative text.
  assert.deepEqual(valueBoundIds, ['decor-live-attribute']);
});
