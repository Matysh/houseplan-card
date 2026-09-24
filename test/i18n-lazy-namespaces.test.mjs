// #627 AC3: словари пространств `settings`, `support`, `topology` — английский
// статически (синхронный слой отката), ru/de/fr — отдельные ленивые чанки, по
// одному на пару «пространство × язык», у каждого загрузчик с двумя попытками.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { NAMESPACE_LOCALE_CHUNKS } from '../scripts/bundle-manifest.mjs';

const NAMESPACES = ['settings', 'support', 'topology'];
const LAZY_LANGUAGES = ['ru', 'de', 'fr'];
const source = (path) => readFileSync(new URL(`../src/i18n/${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(source(path));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

test('#627 AC3 ни один ru/de/fr словарь пространства не импортируется статически', () => {
  for (const namespace of NAMESPACES) {
    const text = source(`${namespace}.ts`);
    const staticImports = [...text.matchAll(/^import\s[^;]*?from\s+['"]([^'"]+)['"]/gm)]
      .map((match) => match[1]);
    assert.ok(staticImports.includes(`./${namespace}/en.json`),
      `${namespace}: английский слой отката обязан быть статическим`);
    for (const language of LAZY_LANGUAGES) {
      const lazy = new RegExp(`^\\./${namespace}/(?:${language}\\.json|${namespace}-${language})$`);
      assert.deepEqual(staticImports.filter((path) => lazy.test(path)), [],
        `${namespace}/${language}: статический импорт вернул бы словарь в граф редактора ×4`);
    }
    // Ни одного JSON, кроме английского, в модуле пространства вообще.
    assert.deepEqual(staticImports.filter((path) => path.endsWith('.json') && path !== `./${namespace}/en.json`), []);
  }
});

test('#627 AC3 у каждого из девяти чанков — загрузчик с двумя попытками и свой retry-токен', () => {
  assert.equal(NAMESPACE_LOCALE_CHUNKS.length, NAMESPACES.length * LAZY_LANGUAGES.length);
  for (const namespace of NAMESPACES) {
    const text = source(`${namespace}.ts`);
    for (const language of LAZY_LANGUAGES) {
      const entry = NAMESPACE_LOCALE_CHUNKS.find((candidate) => candidate.namespace === namespace
        && candidate.language === language);
      assert.ok(entry, `${namespace}-${language}: запись манифеста`);
      assert.equal(entry.module, `/src/i18n/${namespace}/${namespace}-${language}.ts`);
      assert.match(text, new RegExp(
        `${language}: \\(attempt\\) => \\(attempt === 0 \\? import\\('${escape(`./${namespace}/${namespace}-${language}`)}'\\)\\n`
          + `\\s+: import\\(/\\* @vite-ignore \\*/ retryUrl\\('${entry.token}'\\)\\)\\)`,
      ), `${namespace}-${language}: первая попытка — ребро rollup, вторая — точный hashed-адрес`);
      assert.equal(text.split(entry.token).length - 1, 1, `${entry.token}: ровно одно вхождение`);
      // Чанк несёт свой язык и отпечаток сборки.
      const loader = new URL(`../src/i18n/${namespace}/${namespace}-${language}.ts`, import.meta.url);
      assert.ok(existsSync(loader), `${namespace}-${language}.ts существует`);
      const loaderText = readFileSync(loader, 'utf8');
      assert.match(loaderText, new RegExp(`^import dictionary from '\\./${language}\\.json' with \\{ type: 'json' \\};`, 'm'));
      assert.match(loaderText, /export const fingerprint = '__HOUSEPLAN_SOURCE_FINGERPRINT__';/);
    }
  }
});

test('#627 рантайм пространства: en готов сразу, ru/de/fr — после ensure и ровно своим словарём', async () => {
  const modules = {
    settings: await import('../test-build/i18n/settings.js'),
    support: await import('../test-build/i18n/support.js'),
    topology: await import('../test-build/i18n/topology.js'),
  };
  const runtimes = {
    settings: modules.settings.SETTINGS_LANGUAGE_RUNTIME,
    support: modules.support.SUPPORT_LANGUAGE_RUNTIME,
    topology: modules.topology.TOPOLOGY_LANGUAGE_RUNTIME,
  };
  const translate = {
    settings: modules.settings.settingsT,
    support: modules.support.supportT,
    topology: modules.topology.topologyT,
  };
  for (const namespace of NAMESPACES) {
    const runtime = runtimes[namespace];
    const english = json(`${namespace}/en.json`);
    assert.equal(runtime.state('en'), 'ready', `${namespace}: английский статический`);
    for (const language of LAZY_LANGUAGES) {
      const expected = json(`${namespace}/${language}.json`);
      const key = Object.keys(expected).find((candidate) => expected[candidate] !== english[candidate]
        && !/\{/.test(expected[candidate]));
      assert.ok(key, `${namespace}/${language}: есть переведённый ключ без плейсхолдеров`);
      assert.equal(runtime.state(language), 'pending', `${namespace}/${language}: не загружен до ensure`);
      assert.equal(translate[namespace](language, key), english[key],
        `${namespace}/${language}: до загрузки — синхронный английский откат, не сырой ключ`);
      await runtime.ensure(language);
      assert.equal(runtime.state(language), 'ready');
      assert.deepEqual(runtime.dictionary(language), expected,
        `${namespace}/${language}: загружен словарь своего языка`);
      assert.equal(translate[namespace](language, key), expected[key]);
    }
  }
});

test('#627 рантайм пространства — тот же проверенный класс и тот же слушатель отказа', async () => {
  const { LanguageRuntime } = await import('../test-build/i18n/language-runtime.js');
  const namespaceSource = source('namespace-language.ts');
  assert.match(namespaceSource,
    /\], BUILD_FINGERPRINT, console\.warn, notifyLanguageLoadFailures\);/,
    'отказ словаря пространства идёт тем же тостом, что и основного каталога');
  for (const [path, name] of [
    ['settings.js', 'SETTINGS_LANGUAGE_RUNTIME'], ['support.js', 'SUPPORT_LANGUAGE_RUNTIME'],
    ['topology.js', 'TOPOLOGY_LANGUAGE_RUNTIME'],
  ]) {
    const module = await import(`../test-build/i18n/${path}`);
    assert.ok(module[name] instanceof LanguageRuntime, `${name}: LanguageRuntime, а не двойник`);
  }
});
