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

test('issue 251 unavailable controls toast has exact singular and plural copy', () => {
  assert.equal(
    en['toast.toggle_target_unavailable'],
    'Target “{name}” is unavailable — no action was performed',
  );
  assert.equal(
    ru['toast.toggle_target_unavailable'],
    'Цель «{name}» недоступна — действие не выполнено',
  );
  assert.equal(
    en['toast.toggle_targets_unavailable'],
    'Targets are unavailable: {names}. No action was performed',
  );
  assert.equal(
    ru['toast.toggle_targets_unavailable'],
    'Цели недоступны: {names}. Действие не выполнено',
  );
  assert.match(cardSource, /toast\.toggle_target_unavailable/);
  assert.match(cardSource, /toast\.toggle_targets_unavailable/);
});

test('Optimize distinguishes updated spaces from cleaned coordinate noise', () => {
  assert.equal(
    en['gs.optimize_changes'],
    'Model migrations: {m}; spaces updated: {c}; noisy coordinate values removed: {p}; merged real-wall fragments: {w}; merged zero-thickness wall fragments: {s}; independent walls: {i}.',
  );
  assert.equal(
    ru['gs.optimize_changes'],
    'Миграций модели: {m}; обновлено пространств: {c}; устранён шум координат: {p}; объединено отрезков реальных стен: {w}; объединено отрезков стен нулевой толщины: {s}; независимых: {i}.',
  );
  assert.equal(en['gs.zero_walls_migrated'], 'Virtual wall spans converted: {n}.');
  assert.equal(ru['gs.zero_walls_migrated'], 'Преобразовано виртуальных участков: {n}.');
  assert.match(cardSource, /gs\.zero_walls_migrated/);
  assert.match(cardSource, /p: String\(r\.coordsCanonicalized\)/);
  // #229: the independent-wall counter is reported, not silently accumulated
  assert.match(cardSource, /i: String\(r\.partitionsMerged\)/);
  assert.match(cardSource, /gs\.optimize_coincident_partitions/);
  assert.match(cardSource, /gs\.optimize_openings_rehosted/);
  assert.match(cardSource,
    /d\.report\.coordsCanonicalized \+ d\.report\.latticeCoordinatesCanonicalized/);
});

test('issue 306 zero-wall failures have dedicated symmetric copy', () => {
  const expected = {
    'toast.zero_wall_opening_conflict': [
      'Remove the opening on this wall segment first.',
      'Сначала удалите проём на этом участке стены.',
    ],
    'toast.zero_wall_ambiguous': [
      'The wall segment is ambiguous. Simplify or adjust the junction.',
      'Не удалось однозначно выбрать участок стены. Уточните геометрию узла.',
    ],
    'toast.zero_wall_migration_blocked': [
      'The space was not converted: {reason}. No data was changed.',
      'Пространство не преобразовано: {reason}. Данные не изменены.',
    ],
  };
  for (const [key, [english, russian]] of Object.entries(expected)) {
    assert.equal(en[key], english);
    assert.equal(ru[key], russian);
    assert.match(cardSource, new RegExp(key.replaceAll('.', '\\.')));
  }
});

test('issue 291 Optimize reports lattice cleanup separately in both languages', () => {
  assert.equal(
    en['gs.optimize_lattice_summary'],
    'Noisy coordinate values canonicalized: {n}; maximum movement: {cm} cm.',
  );
  assert.equal(
    ru['gs.optimize_lattice_summary'],
    'Канонизировано шумовых значений координат: {n}; максимальный сдвиг: {cm} см.',
  );
  assert.equal(
    en['gs.optimize_lattice_space'],
    '{space}: coordinate values canonicalized: {n}; off-grid values left unchanged: {far}.',
  );
  assert.equal(
    ru['gs.optimize_lattice_space'],
    '{space}: канонизировано значений координат: {n}; оставлено значений вне сетки: {far}.',
  );
  assert.match(cardSource, /formatLatticeShiftCm\(r\.latticeMaxShiftCm\)/);
  assert.match(cardSource, /r\.latticeSpaces\.map/);
});

test('issue 252 Optimize keeps internal ids out of the main orphan report', () => {
  assert.equal(
    en['gs.optimize_orphans_removed'],
    'Forgotten records removed: {total} — room labels: {rooms}; devices: {devices}; group markers: {groups}. They belonged to spaces deleted earlier.',
  );
  assert.equal(
    ru['gs.optimize_orphans_removed'],
    'Убрано забытых записей: {total} — подписи комнат: {rooms}; устройства: {devices}; групповые метки: {groups}. Все они принадлежали пространствам, удалённым ранее.',
  );
  assert.match(cardSource, /gs\.optimize_orphans_removed/);
  assert.match(cardSource, /<details class="optimize-details">/);
  assert.doesNotMatch(cardSource, /this\._t\('gs\.optimize_reference_warning'/);
  for (const key of [
    'gs.optimize_orphans_removed', 'gs.optimize_live_positions',
    'gs.optimize_unverified', 'gs.optimize_vacuum_warning',
  ]) {
    assert.doesNotMatch(en[key], /\b(?:layout|owner|nested mapping|space id|marker id)\b/i);
    assert.doesNotMatch(ru[key], /\b(?:layout|owner|id|вложенн)/i);
  }
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
