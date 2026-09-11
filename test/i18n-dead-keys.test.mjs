import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  collectConsumers,
  expressionPattern,
  familyProblems,
  isKeyShapedPattern,
  narrowingReport,
  parseExpression,
  unusedKeys,
} from './helpers/i18n-consumers.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dictionary = {
  ...JSON.parse(readFileSync(join(repoRoot, 'src/i18n/en.json'), 'utf8')),
  ...JSON.parse(readFileSync(join(repoRoot, 'src/i18n/support/en.json'), 'utf8')),
};
const dictionaryKeys = Object.keys(dictionary);

/**
 * Явные динамические семьи ключей (#502, контракт п.3): ключи, которые
 * читаются по данным, а не по литералу или похожему на ключ выражению в
 * `src/**`. Одна запись — одна семья, `because` называет потребителя (файл)
 * и причину. Запись без покрытых ключей или с пустой причиной — красный тест.
 * Мёртвый ключ сюда не добавляется ради зелёного гейта — он уходит отдельным
 * issue (класс A: словари).
 *
 * После сужения на реальном дереве семей не осталось: каждый ключ имеет
 * литерального, похожего на ключ динамического или производного потребителя.
 */
const DYNAMIC_KEY_FAMILIES = [];

const sourceFiles = [];
const visitDirectory = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visitDirectory(path);
    else if (entry.isFile() && entry.name.endsWith('.ts')) sourceFiles.push(path);
  }
};
visitDirectory(join(repoRoot, 'src'));

const consumers = collectConsumers(sourceFiles.map((path) => ({ path, text: readFileSync(path, 'utf8') })));

test('every i18n key has a literal, dynamic-family or derived help consumer', (t) => {
  const report = narrowingReport(dictionaryKeys, consumers, DYNAMIC_KEY_FAMILIES);
  t.diagnostic(`i18n-dead-keys narrowing (#502): discarded ${report.discarded} dynamic patterns; `
    + `keys covered only by discarded patterns: ${report.onlyDiscarded.length ? report.onlyDiscarded.join(', ') : 'none'}`);
  const unused = unusedKeys(dictionaryKeys, consumers, DYNAMIC_KEY_FAMILIES);
  assert.deepEqual(unused, [], unused.length
    ? `Unused i18n keys: ${unused.join(', ')}. Use each key from src/ or delete it from every locale.`
    : undefined);
});

test('every declared dynamic key family covers a dictionary key and names its reason (#502 AC4)', () => {
  assert.deepEqual(familyProblems(DYNAMIC_KEY_FAMILIES, dictionaryKeys), []);
});

test('help accessibility copy is derived from every literal help consumer', () => {
  assert.equal(consumers.derivedHelpAria.size, 20, 'the current settings surface has 20 statically derived help descriptions');
  for (const key of consumers.derivedHelpAria) {
    assert.equal(typeof dictionary[key], 'string', `${key} must accompany its .help consumer`);
  }
});

// --- #502: сужение динамических потребителей, юниты на синтетическом AST ---

const patternOf = (code) => expressionPattern(parseExpression(code));
const regExpOf = (code) => new RegExp(`^${patternOf(code).source}$`);

test('a literal without a namespace dot joined to an expression is not a key consumer (#502 AC1)', () => {
  for (const code of [
    "'r' + Date.now().toString(36)",
    '`${a}b`',
    "'x' + id",
    "'' + id",
    'prefix + suffix',
  ]) {
    const pattern = patternOf(code);
    assert.equal(pattern?.dynamic ?? true, true, `${code} must still be recognised as dynamic`);
    assert.equal(isKeyShapedPattern(pattern), false, `${code} must not consume a key family`);
  }
});

test('a single dot without letters would match every key and is not a family (#502)', () => {
  for (const code of ['`${a}.${b}`', "a + '.' + b"]) {
    assert.equal(isKeyShapedPattern(patternOf(code)), false, code);
  }
});

test('key-shaped joins keep consuming their families (#502 AC2)', () => {
  const cases = [
    ['`radar.${code}`', 'radar.bad_fit'],
    ["prefix + '.title'", 'x.title'],
    ['`${ns}.aria`', 'help.aria'],
    ["('radar.' + code)", 'radar.ambiguous_sources'],
  ];
  for (const [code, key] of cases) {
    assert.equal(isKeyShapedPattern(patternOf(code)), true, `${code} must consume a key family`);
    assert.match(key, regExpOf(code), `${code} must match ${key}`);
  }
  assert.doesNotMatch('room.name', regExpOf('`radar.${code}`'));
  assert.doesNotMatch('x.titles', regExpOf("prefix + '.title'"));
});

test('static joins and non-string expressions produce no dynamic pattern', () => {
  assert.equal(patternOf("'a.b' + 'c'").dynamic, false);
  assert.equal(patternOf('a + b'), null);
  assert.equal(patternOf('42'), null);
});

test('a dead key is reported even when an id generator shares its first letter (#502 AC3)', () => {
  const synthetic = collectConsumers([{
    path: 'synthetic/probe.ts',
    text: [
      "const draftId = 'p' + Date.now().toString(36);",
      'const label = t(`radar.${code}`);',
      "const aria = this._help('space.cell_cm.help');",
    ].join('\n'),
  }]);
  const keys = ['probe.dead', 'radar.bad_fit', 'space.cell_cm.help.aria'];
  assert.deepEqual(unusedKeys(keys, synthetic), ['probe.dead']);
  assert.equal(synthetic.discarded.length, 1, 'the id generator is the one discarded pattern');
  assert.deepEqual(narrowingReport(keys, synthetic), { discarded: 1, onlyDiscarded: ['probe.dead'] });
});

test('an explicit family rescues a data-driven key, but only with a reason and coverage (#502 AC4)', () => {
  const synthetic = collectConsumers([{ path: 'synthetic/empty.ts', text: 'export const x = 1;' }]);
  const keys = ['feed.alpha', 'feed.beta'];
  const family = { pattern: /^feed\./, because: 'synthetic/feed.ts reads feed.* by record type' };
  assert.deepEqual(unusedKeys(keys, synthetic, [family]), []);
  assert.deepEqual(familyProblems([family], keys), []);
  assert.deepEqual(familyProblems([{ pattern: /^feed\./, because: '  ' }], keys).length, 1);
  assert.deepEqual(familyProblems([{ pattern: /^nothing\./, because: 'orphan' }], keys).length, 1);
  assert.deepEqual(familyProblems([{ pattern: '^feed\\.', because: 'string, not RegExp' }], keys).length, 1);
});
