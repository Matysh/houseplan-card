import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import {
  FALLBACK_LANGUAGE_CODE,
  LANGUAGE_REGISTRY,
  buildLanguageLookup,
  dictionaryFor,
  ensureLanguage,
  languageEntry,
  languageOptions,
  normalizeLanguageTag,
  resolveLanguageCode,
} from '../test-build/i18n/registry.js';
import { langOf } from '../test-build/i18n.js';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

await Promise.all(LANGUAGE_REGISTRY.map(({ code }) => ensureLanguage(code)));
const dictionaries = new Map(LANGUAGE_REGISTRY.map(({ code }) => [code, dictionaryFor(code)]));
const en = dictionaries.get('en');
const ru = dictionaries.get('ru');
const de = dictionaries.get('de');
const fr = dictionaries.get('fr');
const cardSource = readHouseplanProductionSource();

test('i18n: registry codes and English fallback are valid', () => {
  const codes = LANGUAGE_REGISTRY.map(({ code }) => code);
  const normalizedCodes = codes.map(normalizeLanguageTag);
  assert.equal(FALLBACK_LANGUAGE_CODE, 'en');
  assert.ok(dictionaries.has(FALLBACK_LANGUAGE_CODE));
  assert.equal(new Set(codes).size, codes.length, 'registry codes must be unique');
  assert.equal(
    new Set(normalizedCodes).size,
    normalizedCodes.length,
    'registry codes must be unique after locale normalization',
  );
  for (const { code, nativeLabel, dictionary, loadDictionary } of LANGUAGE_REGISTRY) {
    assert.equal(code, code.trim(), `${code} has surrounding whitespace`);
    assert.doesNotMatch(code, /_/u, `${code} must use BCP 47 hyphens`);
    assert.match(code, /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u);
    assert.ok(nativeLabel.trim(), `${code} has no native label`);
    assert.ok(
      (dictionary && typeof dictionary === 'object') || typeof loadDictionary === 'function',
      `${code} has neither an eager dictionary nor a lazy loader`,
    );
  }
});

test('i18n: canonical regional codes use normalized lookup keys', () => {
  const regional = { code: 'pt-BR', nativeLabel: 'Português (Brasil)', dictionary: {} };
  const lookup = buildLanguageLookup([regional]);
  assert.equal(lookup.get('pt-br'), regional);
  assert.equal(lookup.get(normalizeLanguageTag('PT_br')), regional);
  for (const entry of LANGUAGE_REGISTRY) {
    assert.equal(languageEntry(entry.code.toUpperCase()), entry);
  }
});

test('i18n: registry matches frontend and backend locale files', () => {
  const registryCodes = LANGUAGE_REGISTRY.map(({ code }) => code).sort();
  const localeCodes = (url) => readdirSync(url)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
  assert.deepEqual(
    localeCodes(new URL('../src/i18n/', import.meta.url)),
    registryCodes,
    'frontend locale files and registry differ',
  );
  assert.deepEqual(
    localeCodes(new URL('../custom_components/houseplan/translations/', import.meta.url)),
    registryCodes,
    'backend locale files and registry differ',
  );
});

test('i18n: backend dictionaries preserve the English structure and placeholders', () => {
  const flatten = (value, prefix = '', result = new Map()) => {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, result);
      else result.set(path, child);
    }
    return result;
  };
  const placeholders = (value) => (String(value).match(/\{\w+\}/gu) || []).sort();
  const backend = new Map(LANGUAGE_REGISTRY.map(({ code }) => [
    code,
    flatten(JSON.parse(readFileSync(
      new URL(`../custom_components/houseplan/translations/${code}.json`, import.meta.url),
      'utf8',
    ))),
  ]));
  const english = backend.get('en');
  for (const { code } of LANGUAGE_REGISTRY) {
    const dictionary = backend.get(code);
    assert.deepEqual([...dictionary.keys()].sort(), [...english.keys()].sort(), `${code} backend key set differs`);
    for (const [key, value] of english) {
      assert.deepEqual(
        placeholders(dictionary.get(key)),
        placeholders(value),
        `${code} backend placeholder mismatch at ${key}`,
      );
    }
  }
});

test('i18n: every registered dictionary carries the English key set', () => {
  const enKeys = Object.keys(en).sort();
  for (const { code } of LANGUAGE_REGISTRY) {
    const dictionary = dictionaries.get(code);
    assert.deepEqual(Object.keys(dictionary).sort(), enKeys, `${code} key set differs`);
  }
});

test('i18n: no empty values', () => {
  for (const { code } of LANGUAGE_REGISTRY) {
    const dictionary = dictionaries.get(code);
    for (const [k, v] of Object.entries(dictionary)) {
      assert.ok(typeof v === 'string' && v.length > 0, `${code}:${k} is empty`);
    }
  }
});

test('i18n: placeholders match between languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of Object.keys(en)) {
    for (const { code } of LANGUAGE_REGISTRY) {
      const dictionary = dictionaries.get(code);
      assert.equal(ph(en[k]), ph(dictionary[k]), `placeholder mismatch in ${code}:${k}`);
    }
  }
});

test('i18n: resolver supports exact, primary, explicit and fallback paths', () => {
  const supported = ['en', 'ru', 'de', 'fr', 'pt-BR'];
  const cases = [
    { explicit: 'RU', ha: 'en-US', expected: 'ru' },
    { explicit: 'pt_BR', ha: 'ru-RU', expected: 'pt-BR' },
    { explicit: 'unknown', ha: 'ru_RU', expected: 'ru' },
    { explicit: '', ha: 'pt-br', expected: 'pt-BR' },
    { explicit: null, ha: 'ru-RU', expected: 'ru' },
    { explicit: 'ru-RU', ha: 'en-GB', expected: 'en' },
    { explicit: undefined, ha: 'pt-PT', expected: 'en' },
    { explicit: undefined, ha: 'de-DE', expected: 'de' },
    { explicit: undefined, ha: 'de-AT', expected: 'de' },
    { explicit: undefined, ha: 'de-CH', expected: 'de' },
    { explicit: undefined, ha: 'fr-FR', expected: 'fr' },
    { explicit: undefined, ha: 'fr-CA', expected: 'fr' },
    { explicit: undefined, ha: 'fr_BE', expected: 'fr' },
    { explicit: undefined, ha: 'fr-CH', expected: 'fr' },
  ];
  for (const { explicit, ha, expected } of cases) {
    assert.equal(resolveLanguageCode(explicit, ha, supported, 'en'), expected);
  }
});

test('i18n: langOf wires card config and both HA locale shapes to the registry', () => {
  assert.equal(langOf({ locale: { language: 'ru_RU' }, language: 'en' }), 'ru');
  assert.equal(langOf({ locale: { language: 'en-GB' }, language: 'ru' }, 'RU'), 'ru');
  assert.equal(langOf({ language: 'ru-RU' }, 'unknown'), 'ru');
  assert.equal(langOf({ locale: { language: 'de-DE' } }, 'unknown'), 'de');
  assert.equal(langOf({ locale: { language: 'fr-CA' } }, 'unknown'), 'fr');
});

test('i18n: editor options follow registry order and preserve unknown raw values', () => {
  assert.deepEqual(languageOptions('Auto'), [
    { value: '', label: 'Auto' },
    ...LANGUAGE_REGISTRY.map(({ code, nativeLabel }) => ({ value: code, label: nativeLabel })),
  ]);
  assert.deepEqual(languageOptions('Auto', 'ru'), languageOptions('Auto'));
  assert.deepEqual(languageOptions('Auto', 'de'), languageOptions('Auto'));
  assert.deepEqual(
    languageOptions('Auto', ' RU ').at(-1),
    { value: ' RU ', label: 'Русский' },
  );
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
    for (const { code } of LANGUAGE_REGISTRY) {
      const dictionary = dictionaries.get(code);
      assert.ok(dictionary[key]?.trim(), `${code}:${key} is missing or empty`);
      assert.ok(dictionary[`${key}.aria`]?.trim(), `${code}:${key}.aria is missing or empty`);
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
  for (const { code: lang } of LANGUAGE_REGISTRY) {
    const d = dictionaries.get(lang);
    for (const k of ['vac.autocal_no_rooms', 'vac.autocal_no_match', 'vac.residual_message']) {
      assert.ok(!/point|точк/i.test(d[k]), `${lang}:${k} still points at point calibration`);
    }
  }
});

test('i18n: German catalog keeps the product glossary and has no translation sentinels', () => {
  assert.equal(de['btn.save'], 'Speichern');
  assert.equal(de['btn.cancel'], 'Abbrechen');
  assert.equal(de['btn.delete'], 'Löschen');
  assert.equal(de['space.header'], 'Bereich');
  assert.equal(de['physical.partition_properties'], 'Eigenschaften der Trennwand');
  assert.equal(de['opening.passage'], 'Offener Durchgang');
  for (const [key, value] of Object.entries(de)) {
    assert.doesNotMatch(value, /ZXQPH|QXZ|⟦HP/u, `de:${key} contains a translator sentinel`);
    assert.doesNotMatch(value, /[А-Яа-яЁё]/u, `de:${key} contains Cyrillic text`);
  }
});

test('i18n: German values equal to English are explicitly reviewed', () => {
  const allowed = new Set([
    'editor.palette',
    'confirm.delete_partition_openings_item',
    'marker.name_ph',
    'marker.pulse_a11y_alarm',
    'marker.state_a11y_alarm',
    'marker.link_label',
    'rules.icon_ph',
    'decor.ellipse',
    'decor.text',
    'decor.text_label',
    'gs.unit_m',
    'gs.unit_ft',
    'wallthick.unit_cm',
    'wallthick.unit_in',
    'marker.value_badge_position',
    'marker.value_badge_attr_current_position',
    'gs.north_letter',
    'gs.optimize_live_names',
    'gs.optimize_details',
    'furn.symbol',
    'furn.cat_sofa',
    'furn.cat_bidet',
    'vac.diag_platform',
    'vac.diag_status',
    'vac.diag_position',
  ]);
  const equalKeys = Object.keys(en).filter((key) => en[key] === de[key]);
  assert.deepEqual(new Set(equalKeys), allowed);
});


test('i18n: French catalog keeps the product glossary and has no translation sentinels (#371)', () => {
  assert.equal(fr['btn.save'], 'Enregistrer');
  assert.equal(fr['btn.cancel'], 'Annuler');
  assert.equal(fr['btn.delete'], 'Supprimer');
  assert.equal(fr['space.header'], 'Espace');
  assert.equal(fr['opening.passage'], 'Passage ouvert');
  for (const [key, value] of Object.entries(fr)) {
    assert.doesNotMatch(value, /ZXQPH|QXZ|⟦HP/u, `fr:${key} contains a translator sentinel`);
    assert.doesNotMatch(value, /[А-Яа-яЁё]/u, `fr:${key} contains Cyrillic text`);
  }
});

test('i18n: French values equal to English are explicitly reviewed (#371)', () => {
  // Every entry here is a legitimate French/English homograph or a unit,
  // template or brand token — reviewed with the contributed dictionary.
  const allowed = new Set([
    'color_picker.saturation',
    'confirm.delete_partition_openings_item',
    'decor.rect',
    'err.code',
    'furn.cat_bidet',
    'gs.about_version',
    'gs.north_letter',
    'gs.unit_m',
    'marker.desc_label',
    'marker.preview.multiple_sources',
    'marker.value_badge_attr_current_position',
    'marker.value_badge_attr_volume_level',
    'marker.value_badge_position',
    'opening.type_label',
    'rules.icon_ph',
    'run.script',
    'space.plan_alt',
    'vac.cap_position',
    'vac.diag_position',
    'vac.diag_source',
    'vac.documentation',
    'wallthick.unit_cm',
  ]);
  const equalKeys = Object.keys(en).filter((key) => en[key] === fr[key]);
  assert.deepEqual(new Set(equalKeys), allowed);
});
