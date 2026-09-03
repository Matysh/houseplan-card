import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildBundleManifest, buildFingerprintPlugin, editorRuntimeRetryUrlPlugin,
} from '../scripts/bundle-manifest.mjs';
import {
  INITIAL_VIEW_GZIP_BUDGET, LOW_HEADROOM_WARNING_BYTES,
  assertBundleBudget, assertSupportBundleOwnership, lowHeadroomWarning,
} from '../scripts/bundle-budget.mjs';
import { compareBundleTrees, sha256Bytes, verifyBundleTree } from '../scripts/bundle-tree.mjs';
import {
  minifyCssText, minifyStaticCssTemplates,
} from '../scripts/css-template-minifier.mjs';

test('CSS template minifier preserves semantic whitespace, strings and functions', () => {
  const css = `
    /* owner note */
    .a .b, .c > .d { --pair: 1  2; width: calc(100% - 2px); }
    .quoted { content: "a  b /* text */"; background: url("a b.png"); }
    .joined/**/.state { color: red; }
  `;
  assert.equal(
    minifyCssText(css),
    '.a .b,.c>.d{--pair:1 2;width:calc(100% - 2px);}.quoted{content:"a  b /* text */";background:url("a b.png");}.joined.state{color:red;}',
  );
  assert.equal(
    minifyStaticCssTemplates('const s = css` .a { content: "\\`"; } `;', 'fixture.ts'),
    'const s = css`.a{content:"\\`";}`;',
  );
});

test('CSS template minifier fails closed on interpolation and malformed input', () => {
  assert.throws(
    () => minifyStaticCssTemplates('const s = css`color:${value}`;', 'fixture.ts'),
    /interpolated css template/,
  );
  assert.throws(() => minifyCssText('.a{/* nope'), /unclosed CSS comment/);
  assert.throws(() => minifyCssText('.a{content:"nope}'), /unclosed CSS string/);
});

test('bundle manifest separates static initial graph from dynamic editor graph', () => {
  const manifest = buildBundleManifest({
    'houseplan-card.js': {
      type: 'chunk', fileName: 'houseplan-card.js', code: 'entry', isEntry: true,
      imports: ['shared.js'], dynamicImports: [
        'houseplan-assets/editor.js', 'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
        'houseplan-assets/de-HASH.js',
      ],
    },
    'shared.js': {
      type: 'chunk', fileName: 'shared.js', code: 'shared', isEntry: false,
      imports: [], dynamicImports: [],
    },
    'houseplan-assets/editor.js': {
      type: 'chunk', fileName: 'houseplan-assets/editor.js', code: 'editor', isEntry: false,
      imports: ['shared.js'], dynamicImports: [],
    },
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
      code: 'onboarding', isEntry: false,
      imports: ['shared.js'], dynamicImports: [],
    },
    'houseplan-assets/de-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/de-HASH.js',
      code: 'German locale', isEntry: false, imports: [], dynamicImports: [],
      modules: { '/repo/src/i18n/de.ts': {} },
    },
  }, 'fingerprint');
  assert.deepEqual(manifest.initialViewFiles, ['houseplan-card.js', 'shared.js']);
  assert.deepEqual(manifest.lazyEditorFiles, ['houseplan-assets/editor.js']);
  assert.deepEqual(manifest.lazyOnboardingFiles, [
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
  ]);
  assert.deepEqual(manifest.lazyLocaleFiles, ['houseplan-assets/de-HASH.js']);
  assert.deepEqual(manifest.lazyFiles, [
    'houseplan-assets/de-HASH.js', 'houseplan-assets/editor.js',
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
  ]);
  assert.doesNotThrow(() => assertBundleBudget(manifest, 1_000_000));
  assert.throws(() => assertBundleBudget(manifest, 1), /exceeds/);
});

test('#423 support form copy belongs only to the lazy editor graph', () => {
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-support-graph-'));
  try {
    writeFileSync(join(temp, 'initial.js'), 'header only');
    writeFileSync(join(temp, 'editor.js'), 'lazy English marker · lazy Russian marker');
    const manifest = {
      initialViewFiles: ['initial.js'],
      lazyEditorFiles: ['editor.js'],
    };
    const markers = ['lazy English marker', 'lazy Russian marker'];
    assert.doesNotThrow(() => assertSupportBundleOwnership(manifest, temp, markers));
    writeFileSync(join(temp, 'initial.js'), 'lazy English marker');
    assert.throws(
      () => assertSupportBundleOwnership(manifest, temp, markers),
      /leaked into initial View graph/,
    );
    writeFileSync(join(temp, 'initial.js'), 'header only');
    assert.throws(
      () => assertSupportBundleOwnership(
        { initialViewFiles: ['initial.js'], lazyEditorFiles: [] }, temp, markers,
      ),
      /missing from lazy editor graph/,
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('build fingerprint is embedded for Windows and POSIX source ids', () => {
  const plugin = buildFingerprintPlugin('exact-build');
  for (const id of ['C:\\repo\\src\\houseplan-card.ts', '/repo/src/houseplan-editor-runtime.ts']) {
    const transformed = plugin.transform(
      'export const fingerprint = "__HOUSEPLAN_SOURCE_FINGERPRINT__";', id,
    );
    assert.match(transformed.code, /"exact-build"/);
  }
});

test('retry URL points at the content-hashed runtime chunk after naming', () => {
  const plugin = editorRuntimeRetryUrlPlugin();
  const bundle = {
    'houseplan-assets/houseplan-card.js': {
      type: 'chunk', fileName: 'houseplan-assets/houseplan-card.js',
      code: 'new URL("__HOUSEPLAN_EDITOR_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_ONBOARDING_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_DE_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_FR_RETRY_ASSET__", import.meta.url)', modules: {},
    },
    'houseplan-assets/houseplan-editor-runtime-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/houseplan-editor-runtime-HASH.js', code: '',
      modules: { '/repo/src/houseplan-editor-runtime.ts': {} },
    },
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/houseplan-onboarding-runtime-HASH.js', code: '',
      modules: { '/repo/src/houseplan-onboarding-runtime.ts': {} },
    },
    'houseplan-assets/de-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/de-HASH.js', code: '',
      modules: { '/repo/src/i18n/de.ts': {} },
    },
    'houseplan-assets/fr-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/fr-HASH.js', code: '',
      modules: { '/repo/src/i18n/fr.ts': {} },
    },
  };
  plugin.generateBundle({}, bundle);
  assert.equal(
    bundle['houseplan-assets/houseplan-card.js'].code,
    'new URL("./houseplan-editor-runtime-HASH.js", import.meta.url);'
      + 'new URL("./houseplan-onboarding-runtime-HASH.js", import.meta.url);'
      + 'new URL("./de-HASH.js", import.meta.url);'
      + 'new URL("./fr-HASH.js", import.meta.url)',
  );
});

test('bundle tree verification fails for a missing or tampered manifest asset', () => {
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-bundle-tree-'));
  const source = join(temp, 'source');
  const target = join(temp, 'target');
  try {
    for (const root of [source, target]) {
      mkdirSync(join(root, 'houseplan-assets'), { recursive: true });
      writeFileSync(join(root, 'houseplan-card.js'), 'entry');
      writeFileSync(join(root, 'houseplan-assets', 'editor-hash.js'), 'editor');
      const files = ['houseplan-card.js', 'houseplan-assets/editor-hash.js'].map((path) => ({
        path, sha256: sha256Bytes(readFileSync(join(root, path))),
      }));
      writeFileSync(join(root, 'houseplan-assets.json'), `${JSON.stringify({
        schema: 1, fingerprint: 'fixture', entry: 'houseplan-card.js', files,
      })}\n`);
    }
    assert.doesNotThrow(() => compareBundleTrees(source, target));
    writeFileSync(join(target, 'houseplan-assets', 'editor-hash.js'), 'tampered');
    assert.throws(() => verifyBundleTree(target), /manifest hash mismatch/);
    rmSync(join(target, 'houseplan-assets', 'editor-hash.js'));
    assert.throws(() => verifyBundleTree(target), /manifest asset is missing/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('entry facade fails loudly when the main chunk is unavailable (#353 AC3a)', () => {
  const entry = readFileSync(new URL('../dist/houseplan-card.js', import.meta.url), 'utf8');
  assert.match(
    entry,
    /^globalThis\.__HOUSEPLAN_BUILD_FINGERPRINT__="[0-9a-f]{64}";/,
    'the fail-closed fingerprint intro must survive the rewrite',
  );
  assert.match(
    entry,
    /try\{await import\("\.\/houseplan-assets\/[^"]+\.js"\)\}catch\(/,
    'the entry must await the main chunk so importers keep the happy-path guarantee',
  );
  assert.match(entry, /customElements\.define\("houseplan-card",/);
  assert.match(entry, /reload the page/);
  assert.doesNotMatch(
    entry,
    /(?:^|;)(?:export|import)[\s{"']/m,
    'no static import/export may remain — a static edge aborts the module before any code runs',
  );
});

test('bundle tree verification rejects orphan chunks (#353 AC4)', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { verifyBundleTree, sha256Bytes } = await import('../scripts/bundle-tree.mjs');
  const root = mkdtempSync(join(tmpdir(), 'hp-tree-'));
  mkdirSync(join(root, 'houseplan-assets'));
  const entryCode = 'try{await import("./houseplan-assets/main-abc.js")}catch(e){}';
  const chunkCode = 'export const x = 1;';
  writeFileSync(join(root, 'houseplan-card.js'), entryCode);
  writeFileSync(join(root, 'houseplan-assets', 'main-abc.js'), chunkCode);
  writeFileSync(join(root, 'houseplan-assets.json'), JSON.stringify({
    schema: 1,
    fingerprint: 'f'.repeat(64),
    entry: 'houseplan-card.js',
    files: [
      { path: 'houseplan-card.js', sha256: sha256Bytes(Buffer.from(entryCode)) },
      { path: 'houseplan-assets/main-abc.js', sha256: sha256Bytes(Buffer.from(chunkCode)) },
    ],
  }));
  assert.equal(verifyBundleTree(root).files.length, 2, 'a clean tree verifies');
  writeFileSync(join(root, 'houseplan-assets', 'junk-old.js'), 'stale');
  assert.throws(
    () => verifyBundleTree(root),
    /orphan bundle asset: houseplan-assets\/junk-old\.js/,
  );
});

// #367. Рекалибровка после того, как запас ушёл с 26 КБ до 8.3 КБ за сутки.
// Она ничего не ускоряет — она фиксирует новую норму и возвращает рабочий
// запас, чтобы гейт красил того, кто вырастил бандл, а не того, кто пушнул
// последним. Настоящий рычаг — ленивые графы, и о нём напоминает сам текст
// предупреждения.

test('потолок держится внутри правила ~10% над измеренным фактом (#352, #367)', () => {
  // Факт на момент рекалибровки — 273 697 Б gzip (dev @ 360).
  const fact = 273_697;
  assert.ok(INITIAL_VIEW_GZIP_BUDGET > fact, 'потолок ниже факта сделал бы гейт вечно красным');
  const allowance = (INITIAL_VIEW_GZIP_BUDGET - fact) / fact;
  assert.ok(allowance <= 0.10 + 1e-9, `надбавка ${(allowance * 100).toFixed(1)}% больше правила 10%`);
  assert.ok(allowance > 0.05, 'надбавка меньше 5% возвращает лотерею «красит последний коммит»');
});

test('тревога о запасе срабатывает до стены, а не после (#367)', () => {
  // Порог выбран так, чтобы предупреждение приходило примерно за две средние
  // фичи до потолка: обычный прирост — около килобайта за задачу.
  assert.equal(lowHeadroomWarning(LOW_HEADROOM_WARNING_BYTES), null);
  assert.equal(lowHeadroomWarning(LOW_HEADROOM_WARNING_BYTES + 1), null);
  const warning = lowHeadroomWarning(LOW_HEADROOM_WARNING_BYTES - 1);
  assert.match(warning, /меньше порога/);
  // Предупреждение обязано называть лечение: без этого следующий читатель
  // поднимет потолок ещё раз и назовёт это решением.
  assert.match(warning, /Рекалибровка это не лечит/);
  assert.match(warning, /#367/);
});

test('превышенный бюджет описывается как превышение, а не как малый запас (#367)', () => {
  assert.match(lowHeadroomWarning(-42), /превышен на 42 Б/);
  assert.equal(lowHeadroomWarning(Number.NaN), null);
});

test('запас на момент рекалибровки выше порога тревоги (#367)', () => {
  // Иначе рекалибровка была бы бессмысленной: гейт сразу же начал бы кричать.
  assert.ok(INITIAL_VIEW_GZIP_BUDGET - 273_697 > LOW_HEADROOM_WARNING_BYTES);
});

test('#429 проверка владения не судит размер графа', () => {
  // Числовой храповик #423 оставлял пятнадцать байт запаса и покрасил бы
  // первый же посторонний коммит сообщением про копирайт формы поддержки.
  // Гейт, обвиняющий не ту задачу, выключают не разбираясь — вместе с
  // долговечной проверкой владения. Здесь закреплено, что размер вернуться в
  // эту функцию не может: любое значение проходит, пока владение соблюдено.
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-support-size-'));
  try {
    writeFileSync(join(temp, 'initial.js'), 'header only');
    writeFileSync(join(temp, 'editor.js'), 'lazy English marker · lazy Russian marker');
    const markers = ['lazy English marker', 'lazy Russian marker'];
    const base = { initialViewFiles: ['initial.js'], lazyEditorFiles: ['editor.js'] };
    for (const initialViewGzipBytes of [0, 291_046, 10_000_000, undefined]) {
      assert.doesNotThrow(
        () => assertSupportBundleOwnership({ ...base, initialViewGzipBytes }, temp, markers),
        `размер ${initialViewGzipBytes} не должен влиять на проверку владения`,
      );
    }
    // Размер по-прежнему охраняется — но общим бюджетом, а не чужим номером.
    assert.match(
      lowHeadroomWarning(9058) || '',
      /запас бюджета 9058 Б/,
      'предупреждение о запасе остаётся единственным честным сигналом о размере',
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
