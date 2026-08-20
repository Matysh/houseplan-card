import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)));
const ru = JSON.parse(readFileSync(new URL('../src/i18n/ru.json', import.meta.url)));
const cardSource = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');

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

test('Optimize distinguishes updated spaces from cleaned coordinate noise', () => {
  assert.equal(
    en['gs.optimize_changes'],
    'Model migrations: {m}; spaces updated: {c}; noisy coordinate values removed: {p}; merged real-wall fragments: {w}; virtual fragments: {s}.',
  );
  assert.equal(
    ru['gs.optimize_changes'],
    'Миграций модели: {m}; обновлено пространств: {c}; устранён шум координат: {p}; объединено отрезков реальных стен: {w}; виртуальных: {s}.',
  );
  assert.match(cardSource, /p: String\(r\.coordsCanonicalized\)/);
  assert.match(cardSource, /d\.report\.coordsCanonicalized \+ d\.report\.wallsMerged/);
});

test('i18n: every literal help call has body and full aria keys in both languages', () => {
  const allCalls = cardSource.match(/this\._help\(/g) || [];
  const helpKeys = [...cardSource.matchAll(/this\._help\('([^']+\.help)'\)/g)].map((match) => match[1]);
  assert.equal(helpKeys.length, allCalls.length, 'every _help call must use one string literal ending in .help');
  assert.ok(helpKeys.length > 0, 'the help affordance pilot disappeared');
  for (const key of helpKeys) {
    for (const [lang, dictionary] of [['en', en], ['ru', ru]]) {
      assert.ok(dictionary[key]?.trim(), `${lang}:${key} is missing or empty`);
      assert.ok(dictionary[`${key}.aria`]?.trim(), `${lang}:${key}.aria is missing or empty`);
    }
  }
});

test('light pilot has no duplicate legacy hint copy', () => {
  for (const key of [
    'marker.light_role_tip', 'marker.glow_color_tip',
    'marker.glow_brightness_hint', 'marker.glow_radius_hint',
  ]) {
    assert.equal(en[key], undefined, `en:${key} should be removed`);
    assert.equal(ru[key], undefined, `ru:${key} should be removed`);
    assert.ok(!cardSource.includes(`'${key}'`), `${key} is still rendered`);
  }
});

test('help hosts do not duplicate their explanation in a title attribute', () => {
  const calls = [...cardSource.matchAll(/this\._help\('([^']+\.help)'\)/g)];
  assert.ok(calls.length > 0, 'the help affordance pilot disappeared');
  for (const call of calls) {
    const prefix = cardSource.slice(Math.max(0, call.index - 700), call.index);
    const hosts = [...prefix.matchAll(/<(legend|label|div)\b([^>]*)>/g)];
    const host = hosts.at(-1);
    assert.ok(host, `no host element found for ${call[1]}`);
    assert.doesNotMatch(host[2], /\btitle\s*=/i, `${call[1]} duplicates help in title=`);
  }
  assert.ok(!cardSource.includes('markerlighttip'), 'legacy help copy is still rendered');
});

test('vac toasts never mention the removed point calibration (HP-1540-06)', () => {
  for (const [lang, d] of [['en', en], ['ru', ru]]) {
    for (const k of ['vac.autocal_no_rooms', 'vac.autocal_no_match', 'vac.residual_message']) {
      assert.ok(!/point|точк/i.test(d[k]), `${lang}:${k} still points at point calibration`);
    }
  }
});
