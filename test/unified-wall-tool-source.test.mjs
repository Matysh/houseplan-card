import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const cardSource = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8'));
const ru = JSON.parse(readFileSync(new URL('../src/i18n/ru.json', import.meta.url), 'utf8'));
const de = JSON.parse(readFileSync(new URL('../src/i18n/de.json', import.meta.url), 'utf8'));

test('runtime exposes only the unified Walls tool state', () => {
  const toolType = cardSource.match(/type MarkupTool = ([^;]+);/)?.[1] || '';
  const toolSet = cardSource.match(/const MARKUP_TOOLS = new Set<MarkupTool>\(\[([\s\S]*?)\]\);/)?.[1] || '';

  assert.doesNotMatch(toolType, /['"]partition['"]/);
  assert.doesNotMatch(toolSet, /['"]partition['"]/);
  assert.doesNotMatch(cardSource, /\b_partitionClick\b/);
  assert.doesNotMatch(cardSource, /this\._tool\s*(?:===|!==)\s*['"]partition['"]/);
  assert.doesNotMatch(cardSource, /['"]partition['"]\s*(?:===|!==)\s*this\._tool/);
});

test('only old tool copy is removed while persisted partition copy remains', () => {
  for (const locale of [en, ru, de]) {
    for (const key of [
      'title.markup_partition',
      'markup.hint_partition',
      'physical.partition_size_title',
    ]) assert.equal(key in locale, false, key);

    for (const key of [
      'markup.partition',
      'physical.partition_properties',
      'history.partition_add',
    ]) assert.equal(typeof locale[key], 'string', key);
  }
});
