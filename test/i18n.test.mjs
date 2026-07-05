import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)));
const ru = JSON.parse(readFileSync(new URL('../src/i18n/ru.json', import.meta.url)));

test('i18n: en and ru dictionaries carry the same key set', () => {
  const enKeys = Object.keys(en).sort();
  const ruKeys = Object.keys(ru).sort();
  assert.deepEqual(enKeys, ruKeys);
});

test('i18n: no empty values', () => {
  for (const [lang, d] of [['en', en], ['ru', ru]]) {
    for (const [k, v] of Object.entries(d)) {
      assert.ok(typeof v === 'string' && v.length > 0, `${lang}:${k} is empty`);
    }
  }
});

test('i18n: placeholders match between languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of Object.keys(en)) {
    assert.equal(ph(en[k]), ph(ru[k]), `placeholder mismatch in ${k}`);
  }
});
