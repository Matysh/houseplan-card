import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildBundleManifest, buildFingerprintPlugin, editorRuntimeRetryUrlPlugin,
  entryFallbackPlugin, NAMESPACE_LOCALE_CHUNKS,
} from '../scripts/bundle-manifest.mjs';
import {
  INITIAL_PANEL_ONLY_GZIP_BUDGET, INITIAL_VIEW_CEILING_BAND,
  INITIAL_VIEW_GZIP_BUDGET, INITIAL_VIEW_GZIP_CEILING,
  LAZY_EDITOR_GZIP_CEILING, LAZY_FURNITURE_ART_GZIP_CEILING, LAZY_GRAPH_CEILING_BAND,
  LAZY_ONBOARDING_GZIP_CEILING, lazyGraphCeilingViolation,
  assertNamespaceLocaleOwnership, namespaceLocaleMarkers,
  LOW_HEADROOM_ACKNOWLEDGED_CEILING, LOW_HEADROOM_WARNING_BYTES,
  SUPPORT_LAZY_MARKERS,
  assertBundleBudget, assertSupportBundleOwnership, initialViewCeilingViolation,
  lowHeadroomWarning,
} from '../scripts/bundle-budget.mjs';
import {
  assertBundleManifest, assertOwnBundleTopology, compareBundleTrees,
  orderedBundlePayload, sha256Bytes, verifyBundleTree,
} from '../scripts/bundle-tree.mjs';
import {
  cssTemplateMinifier, minifyCssText, minifyStaticCssTemplates,
} from '../scripts/css-template-minifier.mjs';

/** #627: the nine namespace × language chunks, each a dynamic import of a lazy chunk. */
const namespaceLocaleChunkPath = (entry) => `houseplan-assets/${entry.namespace}-${entry.language}-HASH.js`;
const namespaceLocaleBundleChunks = (code = (entry) => `${entry.namespace} ${entry.language}`) => Object.fromEntries(
  NAMESPACE_LOCALE_CHUNKS.map((entry) => [namespaceLocaleChunkPath(entry), {
    type: 'chunk', fileName: namespaceLocaleChunkPath(entry), code: code(entry), isEntry: false,
    imports: [], dynamicImports: [], modules: { [`/repo${entry.module}`]: {} },
  }]),
);

const minimalTwoEntryBundle = () => ({
  'houseplan-panel.js': {
    type: 'chunk', fileName: 'houseplan-panel.js', code: 'panel', isEntry: true,
    facadeModuleId: '/repo/src/houseplan-panel.ts',
    imports: ['houseplan-assets/card-HASH.js'],
    dynamicImports: [], modules: { '/repo/src/houseplan-panel.ts': {} },
  },
  'houseplan-card.js': {
    type: 'chunk', fileName: 'houseplan-card.js', code: 'card', isEntry: true,
    facadeModuleId: '/repo/src/houseplan-card.ts', imports: ['houseplan-assets/card-HASH.js'],
    dynamicImports: [], modules: { '/repo/src/houseplan-card.ts': {} },
  },
  'houseplan-assets/card-HASH.js': {
    type: 'chunk', fileName: 'houseplan-assets/card-HASH.js', code: 'implementation',
    isEntry: false, imports: [], dynamicImports: [], modules: {},
  },
});

const minimalTwoEntryManifest = () => ({
  schema: 1,
  fingerprint: 'f'.repeat(64),
  entry: 'houseplan-card.js',
  panelEntry: 'houseplan-panel.js',
  initialViewFiles: ['houseplan-assets/card-HASH.js', 'houseplan-card.js'],
  initialViewGzipBytes: 11,
  initialPanelFiles: [
    'houseplan-assets/card-HASH.js', 'houseplan-panel.js',
  ],
  initialPanelGzipBytes: 9,
  initialPanelOnlyFiles: ['houseplan-panel.js'],
  initialPanelOnlyGzipBytes: 3,
  files: [
    { path: 'houseplan-assets/card-HASH.js', gzipBytes: 6, isEntry: false },
    { path: 'houseplan-card.js', gzipBytes: 5, isEntry: true },
    { path: 'houseplan-panel.js', gzipBytes: 3, isEntry: true },
  ],
});

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

// #526. Плагин видит ВЫВОД TypeScript, а не исходник, и принтер TS ставит
// пробел между тегом и шаблоном: `css \``. Отсев по строгому `css\`` не
// срабатывал никогда — минификация не выполнялась ни для одного файла стилей,
// и 23 КБ пояснительных комментариев ехали в браузер каждому пользователю.

test('#526 AC1: тег распознаётся с любым пробельным промежутком и только как отдельное слово', () => {
  for (const gap of [' ', '\n', '\t', '  \n  ']) {
    assert.equal(
      minifyStaticCssTemplates(`const s = css${gap}\` .a { color: red; } \`;`, 'fixture.ts'),
      'const s = css`.a{color:red;}`;',
      `промежуток ${JSON.stringify(gap)} обязан распознаваться`,
    );
  }
  // Хвост чужого идентификатора тегом не является.
  for (const source of ['const s = mycss` .a { color: red; } `;',
    'const s = lit.css` .a { color: red; } `;',
    'const s = styles$css` .a { color: red; } `;']) {
    assert.equal(minifyStaticCssTemplates(source, 'fixture.ts'), null, source);
  }
});

test('#526 AC2: хук плагина и сканер согласованы — вывод TypeScript обрабатывается', () => {
  const plugin = cssTemplateMinifier();
  const compiled = 'export const devicesStyles = css `\n  /* note */\n  .dev { color: red; }\n`;';
  const result = plugin.transform(compiled, '/repo/src/styles/devices.styles.ts');
  assert.ok(result && typeof result.code === 'string', 'отсев не должен отбрасывать вывод TypeScript');
  assert.ok(!result.code.includes('note'), 'комментарий обязан исчезнуть');
  assert.equal(plugin.transform(compiled, '/repo/src/styles/devices.styles.js'), null, 'не .ts — не наше дело');
  assert.equal(plugin.transform('const a = 1;', '/repo/src/x.ts'), null, 'без тега — нечего делать');
});

test('#526 AC4: в собранном бандле нет комментариев из таблиц стилей', () => {
  const styleFiles = readdirSync(new URL('../src/styles/', import.meta.url))
    .filter((name) => name.endsWith('.ts'));
  assert.ok(styleFiles.length >= 4, 'таблицы стилей на месте');
  const phrases = [];
  for (const name of styleFiles) {
    const source = readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/\/\*([\s\S]*?)\*\//g)) {
      const words = match[1].replace(/\s+/g, ' ').trim();
      // Достаточно длинный кусок, чтобы совпадение случайным не было.
      if (words.length >= 40) phrases.push(words.slice(0, 40));
    }
  }
  assert.ok(phrases.length >= 20, `нашлось ${phrases.length} комментариев — ожидались десятки`);
  const bundleDir = new URL('../dist/houseplan-assets/', import.meta.url);
  const bundles = readdirSync(bundleDir).filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(new URL(name, bundleDir), 'utf8'));
  bundles.push(readFileSync(new URL('../dist/houseplan-card.js', import.meta.url), 'utf8'));
  const leaked = phrases.filter((phrase) => bundles.some((code) => code.includes(phrase)));
  assert.deepEqual(leaked, [], 'эти комментарии уехали пользователю');
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
    'houseplan-panel.js': {
      type: 'chunk', fileName: 'houseplan-panel.js', code: 'panel', isEntry: true,
      facadeModuleId: '/repo/src/houseplan-panel.ts',
      // #535: панель импортирует реализацию, а не фасад без версии.
      imports: ['shared.js'], dynamicImports: [],
    },
    'houseplan-card.js': {
      type: 'chunk', fileName: 'houseplan-card.js', code: 'entry', isEntry: true,
      facadeModuleId: '/repo/src/houseplan-card.ts',
      imports: ['shared.js'], dynamicImports: [
        'houseplan-assets/editor.js', 'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
        'houseplan-assets/de-HASH.js', 'houseplan-assets/iso-scene-render-HASH.js',
        'houseplan-assets/furniture-plan-art.generated-HASH.js',
        'houseplan-assets/pdf-export-HASH.js',
      ],
    },
    'shared.js': {
      type: 'chunk', fileName: 'shared.js', code: 'shared', isEntry: false,
      imports: [], dynamicImports: [],
    },
    'houseplan-assets/editor.js': {
      type: 'chunk', fileName: 'houseplan-assets/editor.js', code: 'editor', isEntry: false,
      // #474: the editor imports the furniture artwork statically; the View
      // reaches the same chunk only dynamically, so it stays out of initial.
      imports: ['shared.js', 'houseplan-assets/furniture-plan-art.generated-HASH.js'],
      // #627: namespace dictionaries are dynamic imports of a LAZY chunk.
      dynamicImports: NAMESPACE_LOCALE_CHUNKS.map(namespaceLocaleChunkPath),
    },
    ...namespaceLocaleBundleChunks(),
    'houseplan-assets/furniture-plan-art.generated-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/furniture-plan-art.generated-HASH.js',
      code: 'furniture artwork', isEntry: false, imports: [], dynamicImports: [],
      modules: { '/repo/src/furniture-plan-art.generated.ts': {} },
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
    'houseplan-assets/iso-scene-render-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/iso-scene-render-HASH.js',
      code: 'isometric runtime', isEntry: false, imports: ['shared.js'], dynamicImports: [],
      modules: { '/repo/src/iso-scene-render.ts': {} },
    },
    'houseplan-assets/pdf-export-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/pdf-export-HASH.js',
      code: 'PDF export runtime', isEntry: false, imports: ['shared.js'], dynamicImports: [],
      modules: { '/repo/src/pdf/pdf-export.ts': {} },
    },
  }, 'fingerprint');
  assert.equal(manifest.entry, 'houseplan-card.js');
  assert.equal(manifest.panelEntry, 'houseplan-panel.js');
  assert.deepEqual(manifest.initialViewFiles, ['houseplan-card.js', 'shared.js']);
  assert.deepEqual(
    manifest.initialPanelFiles,
    ['houseplan-panel.js', 'shared.js'],
  );
  assert.deepEqual(manifest.initialPanelOnlyFiles, ['houseplan-panel.js']);
  assert.equal(
    manifest.initialPanelOnlyGzipBytes,
    manifest.files.find((file) => file.path === 'houseplan-panel.js').gzipBytes,
  );
  assert.deepEqual(manifest.lazyOnboardingFiles, [
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
  ]);
  assert.deepEqual(manifest.lazyLocaleFiles, ['houseplan-assets/de-HASH.js']);
  assert.deepEqual(manifest.lazyIsometricFiles, ['houseplan-assets/iso-scene-render-HASH.js']);
  assert.deepEqual(manifest.lazyFurnitureArtFiles, ['houseplan-assets/furniture-plan-art.generated-HASH.js']);
  assert.deepEqual(manifest.lazyPdfFiles, ['houseplan-assets/pdf-export-HASH.js']);
  assert.deepEqual(manifest.lazyEditorFiles, ['houseplan-assets/editor.js', 'houseplan-assets/furniture-plan-art.generated-HASH.js']);
  // #627: found by module, not as a root of the initial graph; own graph.
  assert.deepEqual(manifest.lazyNamespaceLocaleFiles, NAMESPACE_LOCALE_CHUNKS.map(namespaceLocaleChunkPath).sort());
  assert.equal(manifest.lazyNamespaceLocaleGzipBytes, manifest.files
    .filter((file) => manifest.lazyNamespaceLocaleFiles.includes(file.path))
    .reduce((total, file) => total + file.gzipBytes, 0));
  assert.deepEqual(manifest.lazyFiles, [
    'houseplan-assets/de-HASH.js', 'houseplan-assets/editor.js',
    'houseplan-assets/furniture-plan-art.generated-HASH.js',
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
    'houseplan-assets/iso-scene-render-HASH.js',
    'houseplan-assets/pdf-export-HASH.js',
  ]);
  // Этот тест про РАЗДЕЛЕНИЕ графов, а не про их размеры: потолки ленивых
  // графов (#593) задаются по самой фикстуре, чтобы она не проверяла лишнего.
  const lazyCeilings = [
    manifest.lazyFurnitureArtGzipBytes, manifest.lazyEditorGzipBytes, manifest.lazyOnboardingGzipBytes,
  ];
  assert.doesNotThrow(() => assertBundleBudget(manifest, 1_000_000, undefined, ...lazyCeilings));
  assert.throws(() => assertBundleBudget(manifest, 1, undefined, ...lazyCeilings), /exceeds/);
  assert.throws(
    () => assertBundleBudget(manifest, 1_000_000, manifest.initialPanelOnlyGzipBytes - 1, ...lazyCeilings),
    /panel-only graph.*exceeds/,
  );
  // #627 AC3: a namespace chunk pulled into a static graph is refused by name.
  // A chunk reached from the initial graph never enters the namespace graph
  // at all (the builder subtracts initial), so that leak surfaces as the
  // count refusal below; the static editor graphs are checked by name.
  for (const [graph, label] of [
    ['lazyEditorFiles', 'lazy editor graph'],
    ['lazyOnboardingFiles', 'lazy onboarding graph'],
  ]) {
    const leaked = { ...manifest, [graph]: [...manifest[graph], manifest.lazyNamespaceLocaleFiles[0]] };
    assert.throws(() => assertBundleBudget(leaked, 1_000_000, undefined, ...lazyCeilings),
      new RegExp(`${label} overlaps lazy namespace locale graph`));
  }
  assert.throws(() => assertBundleBudget({
    ...manifest, lazyNamespaceLocaleFiles: manifest.lazyNamespaceLocaleFiles.slice(1),
  }, 1_000_000, undefined, ...lazyCeilings), /lazy namespace locale graph has 8 files, expected 9/);
});

test('#486 Rollup names both stable entries explicitly', async () => {
  const { default: config } = await import('../rollup.config.mjs');
  assert.deepEqual(config.input, {
    'houseplan-card': 'src/houseplan-card.ts',
    'houseplan-panel': 'src/houseplan-panel.ts',
  });
  assert.equal(config.output.entryFileNames, '[name].js');
});

test('#486 manifest root selection is exact and independent of entry enumeration order', () => {
  const bundle = minimalTwoEntryBundle();
  const reversed = Object.fromEntries(Object.entries(bundle).reverse());
  const manifest = buildBundleManifest(reversed, 'fingerprint');
  assert.equal(manifest.entry, 'houseplan-card.js');
  assert.equal(manifest.panelEntry, 'houseplan-panel.js');
  assert.deepEqual(manifest.initialViewFiles, [
    'houseplan-assets/card-HASH.js', 'houseplan-card.js',
  ]);
  // #535: панель тянет реализацию по хешированному имени, фасада в её графе нет.
  assert.deepEqual(manifest.initialPanelFiles, [
    'houseplan-assets/card-HASH.js', 'houseplan-panel.js',
  ]);

  const wrongFacade = minimalTwoEntryBundle();
  wrongFacade['houseplan-panel.js'].facadeModuleId = '/repo/src/not-the-panel.ts';
  assert.throws(
    () => buildBundleManifest(wrongFacade, 'fingerprint'),
    /houseplan-panel\.js facade.*expected src\/houseplan-panel\.ts/,
  );
  const extraEntry = minimalTwoEntryBundle();
  extraEntry['unexpected.js'] = {
    type: 'chunk', fileName: 'unexpected.js', code: '', isEntry: true,
    facadeModuleId: '/repo/src/unexpected.ts', imports: [], dynamicImports: [], modules: {},
  };
  assert.throws(() => buildBundleManifest(extraEntry, 'fingerprint'), /entry count is 3/);
});

test('#486 manifest graph validator rejects missing panel roots and duplicated card graphs', () => {
  const valid = minimalTwoEntryManifest();
  assert.equal(assertBundleManifest(valid), valid);

  const missingPanel = structuredClone(valid);
  delete missingPanel.panelEntry;
  assert.throws(() => assertBundleManifest(missingPanel), /expected entries/);

  const wrongEntryFlags = structuredClone(valid);
  wrongEntryFlags.files.find((file) => file.path === 'houseplan-panel.js').isEntry = false;
  assert.throws(() => assertBundleManifest(wrongEntryFlags), /isEntry inventory/);

  const duplicateGraph = structuredClone(valid);
  duplicateGraph.files.push({
    path: 'houseplan-assets/card-copy-HASH.js', gzipBytes: 6, isEntry: false,
  });
  duplicateGraph.initialPanelFiles = [
    'houseplan-assets/card-copy-HASH.js', 'houseplan-panel.js',
  ];
  duplicateGraph.initialPanelGzipBytes = 9;
  duplicateGraph.initialPanelOnlyFiles = [
    'houseplan-assets/card-copy-HASH.js', 'houseplan-panel.js',
  ];
  duplicateGraph.initialPanelOnlyGzipBytes = 9;
  // #535: панель обязана переиспользовать ту же реализацию, а не свою копию.
  assert.throws(
    () => assertBundleManifest(duplicateGraph),
    /initial panel graph must contain its own stable entry|not a subset/,
  );
});

test('#537 loader-side validation accepts a pre-#535 manifest; topology does not', () => {
  // Манифест той топологии, что была до #535: фасад карточки входит в граф
  // панели. Ровно такой лежит в каждой базе сравнения старше #535, и
  // производительный харнесс читает его валидатором КАНДИДАТА — поэтому
  // «можно ли это загрузить» обязано отвечать «да».
  const legacy = minimalTwoEntryManifest();
  legacy.initialPanelFiles = [
    'houseplan-assets/card-HASH.js', 'houseplan-card.js', 'houseplan-panel.js',
  ];
  legacy.initialPanelGzipBytes = 14;
  assert.equal(assertBundleManifest(legacy), legacy,
    'валидатор загрузки обязан принимать манифест базы прежней топологии');

  // А «так ли устроена ТЕКУЩАЯ сборка» — отдельный вопрос и отдельная функция.
  assert.throws(
    () => assertOwnBundleTopology(legacy),
    /initial panel graph must not contain the card facade/,
  );
  const current = minimalTwoEntryManifest();
  assert.equal(assertOwnBundleTopology(current), current);
});

test('#486 sync payload orders dependencies before both stable entries', () => {
  assert.deepEqual(orderedBundlePayload(minimalTwoEntryManifest()), [
    'houseplan-assets/card-HASH.js', 'houseplan-card.js', 'houseplan-panel.js',
  ]);
});

test('#486 both stable entries install a visible stale-load fallback', async () => {
  const bundle = minimalTwoEntryBundle();
  bundle['houseplan-card.js'].code =
    'export{x}from"./houseplan-assets/card-HASH.js";';
  bundle['houseplan-panel.js'].code =
    'import"./houseplan-assets/card-HASH.js";customElements.define("real-panel",class{});';
  entryFallbackPlugin().generateBundle({}, bundle);

  const card = bundle['houseplan-card.js'].code;
  const panel = bundle['houseplan-panel.js'].code;
  assert.match(card, /try\{await import\("\.\/houseplan-assets\/card-HASH\.js"\)\}catch/);
  assert.match(card, /customElements\.define\("houseplan-card"/);
  assert.doesNotMatch(card, /export\{/);
  // #535 переворачивает это утверждение: панель импортирует РЕАЛИЗАЦИЮ по
  // content-hashed адресу, а не стабильный фасад. Фасад — единственный адрес
  // дистрибутива без версии, и на нём панель молча работала на прошлой карточке.
  assert.match(panel, /try\{await import\("\.\/houseplan-assets\/card-HASH\.js"\)\}catch/);
  assert.doesNotMatch(panel, /houseplan-card\.js/,
    'у панели не остаётся ни одной ссылки на карточку по адресу без версии');
  assert.match(panel, /customElements\.define\("houseplan-panel"/);
  assert.doesNotMatch(panel, /(?:^|;)import["']/);
  assert.deepEqual(bundle['houseplan-panel.js'].imports, ['houseplan-assets/card-HASH.js']);

  const priorCustomElements = Object.getOwnPropertyDescriptor(globalThis, 'customElements');
  const priorHTMLElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const priorConsoleError = console.error;
  const registry = new Map();
  Object.defineProperty(globalThis, 'customElements', {
    configurable: true,
    value: { get: (name) => registry.get(name), define: (name, ctor) => registry.set(name, ctor) },
  });
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    value: class { constructor() { this.style = {}; } },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { language: 'en' },
  });
  console.error = () => {};
  try {
    await import(`data:text/javascript;base64,${Buffer.from(card).toString('base64')}`);
    assert.ok(registry.has('houseplan-card'));
    const staleCard = new (registry.get('houseplan-card'))();
    staleCard.connectedCallback();
    assert.match(staleCard.textContent, /reload the page/);
    await import(`data:text/javascript;base64,${Buffer.from(panel).toString('base64')}`);
    assert.ok(registry.has('houseplan-panel'));
    const stalePanel = new (registry.get('houseplan-panel'))();
    stalePanel.connectedCallback();
    assert.match(stalePanel.textContent, /reload the page/);
  } finally {
    console.error = priorConsoleError;
    for (const [name, descriptor] of [
      ['customElements', priorCustomElements],
      ['HTMLElement', priorHTMLElement],
      ['navigator', priorNavigator],
    ]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('#423 support form copy belongs only to the lazy editor graph', () => {
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-support-graph-'));
  try {
    writeFileSync(join(temp, 'initial.js'), 'header only');
    writeFileSync(join(temp, 'editor.js'), 'lazy English marker');
    writeFileSync(join(temp, 'support-ru.js'), 'lazy Russian marker');
    const manifest = {
      initialViewFiles: ['initial.js'],
      lazyEditorFiles: ['editor.js'],
      lazyNamespaceLocaleFiles: ['support-ru.js'],
    };
    const markers = [
      { text: 'lazy English marker', graph: 'lazyEditorFiles' },
      { text: 'lazy Russian marker', graph: 'lazyNamespaceLocaleFiles' },
    ];
    assert.doesNotThrow(() => assertSupportBundleOwnership(manifest, temp, markers));
    // #627: the Russian copy statically in the editor again is the ×4 regression.
    writeFileSync(join(temp, 'editor.js'), 'lazy English marker · lazy Russian marker');
    assert.throws(
      () => assertSupportBundleOwnership(manifest, temp, markers),
      /lazy locale leaked into lazy editor graph/,
    );
    writeFileSync(join(temp, 'editor.js'), 'lazy English marker');
    assert.throws(
      () => assertSupportBundleOwnership({ ...manifest, lazyNamespaceLocaleFiles: [] }, temp, markers),
      /missing from lazy namespace locale graph/,
    );
    writeFileSync(join(temp, 'initial.js'), 'lazy English marker');
    assert.throws(
      () => assertSupportBundleOwnership(manifest, temp, markers),
      /leaked into initial View graph/,
    );
    writeFileSync(join(temp, 'initial.js'), 'header only');
    assert.throws(
      () => assertSupportBundleOwnership(
        { ...manifest, lazyEditorFiles: [] }, temp, markers,
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
        + 'new URL("__HOUSEPLAN_ISO_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_DE_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_FR_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_FURNITURE_ART_RETRY_ASSET__", import.meta.url);'
        + 'new URL("__HOUSEPLAN_PDF_RETRY_ASSET__", import.meta.url)', modules: {},
    },
    // #627: the lazy namespace chunk that owns the nine second-attempt tokens.
    'houseplan-assets/backdrop-pick-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/backdrop-pick-HASH.js', modules: {},
      code: NAMESPACE_LOCALE_CHUNKS.map((entry) => `import("${entry.token}?retry")`).join(';'),
    },
    ...namespaceLocaleBundleChunks(() => ''),
    'houseplan-assets/houseplan-editor-runtime-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/houseplan-editor-runtime-HASH.js', code: '',
      modules: { '/repo/src/houseplan-editor-runtime.ts': {} },
    },
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/houseplan-onboarding-runtime-HASH.js', code: '',
      modules: { '/repo/src/houseplan-onboarding-runtime.ts': {} },
    },
    'houseplan-assets/iso-scene-render-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/iso-scene-render-HASH.js', code: '',
      modules: { '/repo/src/iso-scene-render.ts': {} },
    },
    'houseplan-assets/de-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/de-HASH.js', code: '',
      modules: { '/repo/src/i18n/de.ts': {} },
    },
    'houseplan-assets/fr-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/fr-HASH.js', code: '',
      modules: { '/repo/src/i18n/fr.ts': {} },
    },
    'houseplan-assets/furniture-plan-art.generated-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/furniture-plan-art.generated-HASH.js', code: '',
      modules: { '/repo/src/furniture-plan-art.generated.ts': {} },
    },
    'houseplan-assets/pdf-export-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/pdf-export-HASH.js', code: '',
      modules: { '/repo/src/pdf/pdf-export.ts': {} },
    },
  };
  plugin.generateBundle({}, bundle);
  assert.equal(
    bundle['houseplan-assets/houseplan-card.js'].code,
    'new URL("./houseplan-editor-runtime-HASH.js", import.meta.url);'
      + 'new URL("./houseplan-onboarding-runtime-HASH.js", import.meta.url);'
      + 'new URL("./iso-scene-render-HASH.js", import.meta.url);'
      + 'new URL("./de-HASH.js", import.meta.url);'
      + 'new URL("./fr-HASH.js", import.meta.url);'
      + 'new URL("./furniture-plan-art.generated-HASH.js", import.meta.url);'
      + 'new URL("./pdf-export-HASH.js", import.meta.url)',
  );
  assert.equal(
    bundle['houseplan-assets/backdrop-pick-HASH.js'].code,
    NAMESPACE_LOCALE_CHUNKS.map((entry) => `import("./${entry.namespace}-${entry.language}-HASH.js?retry")`).join(';'),
  );
});

test('#627 namespace retry tokens stay strict: exactly one each, every chunk emitted', () => {
  const run = (mutate) => {
    const bundle = {
      'houseplan-assets/houseplan-card.js': {
        type: 'chunk', fileName: 'houseplan-assets/houseplan-card.js', modules: {},
        code: ['EDITOR', 'ONBOARDING', 'ISO', 'DE', 'FR', 'FURNITURE_ART', 'PDF']
          .map((name) => `"__HOUSEPLAN_${name}_RETRY_ASSET__"`).join(';'),
      },
      ...Object.fromEntries([
        ['houseplan-editor-runtime', '/src/houseplan-editor-runtime.ts'],
        ['houseplan-onboarding-runtime', '/src/houseplan-onboarding-runtime.ts'],
        ['iso-scene-render', '/src/iso-scene-render.ts'], ['de', '/src/i18n/de.ts'],
        ['fr', '/src/i18n/fr.ts'], ['furniture-plan-art.generated', '/src/furniture-plan-art.generated.ts'],
        ['pdf-export', '/src/pdf/pdf-export.ts'],
      ].map(([name, module]) => [`houseplan-assets/${name}-HASH.js`, {
        type: 'chunk', fileName: `houseplan-assets/${name}-HASH.js`, code: '', modules: { [`/repo${module}`]: {} },
      }])),
      'houseplan-assets/lazy-HASH.js': {
        type: 'chunk', fileName: 'houseplan-assets/lazy-HASH.js', modules: {},
        code: NAMESPACE_LOCALE_CHUNKS.map((entry) => `"${entry.token}"`).join(';'),
      },
      ...namespaceLocaleBundleChunks(() => ''),
    };
    mutate(bundle);
    editorRuntimeRetryUrlPlugin().generateBundle({}, bundle);
    return bundle;
  };
  assert.doesNotThrow(() => run(() => {}));
  const token = NAMESPACE_LOCALE_CHUNKS[4].token;
  assert.throws(() => run((bundle) => {
    bundle['houseplan-assets/lazy-HASH.js'].code = bundle['houseplan-assets/lazy-HASH.js'].code.replace(`"${token}"`, '""');
  }), /namespace locale retry URL placeholder counts are support-de=0, expected exactly 1 each/);
  assert.throws(() => run((bundle) => {
    bundle['houseplan-assets/lazy-HASH.js'].code += `;"${token}"`;
  }), /support-de=2/);
  assert.throws(() => run((bundle) => {
    delete bundle[namespaceLocaleChunkPath(NAMESPACE_LOCALE_CHUNKS[8])];
  }), /topology fr locale chunk was not emitted/);
});

test('bundle tree verification fails for a missing or tampered manifest asset', () => {
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-bundle-tree-'));
  const source = join(temp, 'source');
  const target = join(temp, 'target');
  try {
    for (const root of [source, target]) {
      mkdirSync(join(root, 'houseplan-assets'), { recursive: true });
      writeFileSync(join(root, 'houseplan-card.js'), 'entry');
      writeFileSync(join(root, 'houseplan-panel.js'), 'panel');
      writeFileSync(join(root, 'houseplan-assets', 'editor-hash.js'), 'editor');
      const files = [
        'houseplan-card.js', 'houseplan-panel.js', 'houseplan-assets/editor-hash.js',
      ].map((path) => ({
        path,
        sha256: sha256Bytes(readFileSync(join(root, path))),
        gzipBytes: path === 'houseplan-panel.js' ? 2 : 3,
        isEntry: path === 'houseplan-card.js' || path === 'houseplan-panel.js',
      }));
      writeFileSync(join(root, 'houseplan-assets.json'), `${JSON.stringify({
        schema: 1,
        fingerprint: 'fixture',
        entry: 'houseplan-card.js',
        panelEntry: 'houseplan-panel.js',
        initialViewFiles: ['houseplan-assets/editor-hash.js', 'houseplan-card.js'],
        initialViewGzipBytes: 6,
        initialPanelFiles: [
          'houseplan-assets/editor-hash.js', 'houseplan-panel.js',
        ],
        initialPanelGzipBytes: 5,
        initialPanelOnlyFiles: ['houseplan-panel.js'],
        initialPanelOnlyGzipBytes: 2,
        files,
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

test('#535 panel entry reaches the card implementation by its hashed name', () => {
  const panel = readFileSync(new URL('../dist/houseplan-panel.js', import.meta.url), 'utf8');
  assert.match(
    panel,
    /^globalThis\.__HOUSEPLAN_BUILD_FINGERPRINT__="[0-9a-f]{64}";/,
  );
  // До #535 здесь стоял фасад `./houseplan-card.js` — единственный адрес
  // дистрибутива без версии. Входные файлы отдаются без Cache-Control, поэтому
  // браузер вправе держать копию часами, и устаревшая панель молча работала на
  // прошлой карточке против текущего бэкенда. Хешированное имя это исключает.
  assert.match(panel, /try\{await import\("\.\/houseplan-assets\/houseplan-card-[^"']+\.js"\)\}catch\(/);
  assert.match(panel, /customElements\.define\("houseplan-panel",/);
  assert.match(panel, /reload the page/);
  assert.doesNotMatch(
    panel,
    /(?:^|;)import[\s{"']/m,
    'the panel must not keep a static edge that can abort before its fallback runs',
  );

  const manifest = JSON.parse(
    readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'),
  );
  assert.ok(!manifest.initialViewFiles.includes(manifest.panelEntry));
  // «Панель переиспользует точный граф карточки» после #535 проверяется по
  // РЕАЛИЗАЦИИ: фасад в начальный граф панели больше не входит, всё остальное
  // обязано совпадать файл в файл.
  assert.ok(
    manifest.initialViewFiles
      .filter((path) => path !== manifest.entry)
      .every((path) => manifest.initialPanelFiles.includes(path)),
    'the panel must reuse the exact card implementation graph',
  );
  assert.ok(!manifest.initialPanelFiles.includes(manifest.entry),
    'the un-versioned card facade is no longer part of what the panel loads');
  assert.ok(manifest.initialPanelOnlyGzipBytes <= INITIAL_PANEL_ONLY_GZIP_BUDGET);
});

test('#535 no built entry reaches the card by an address without a version', () => {
  // Инвариант на весь дистрибутив, а не на код плагина: `?v=` ставит бэкенд
  // при регистрации, и относительный спецификатор его не наследует. Любая
  // будущая правка, вернувшая ссылку на фасад из другого входа, красит это.
  const dist = new URL('../dist/', import.meta.url);
  const entries = ['houseplan-panel.js'];
  for (const name of entries) {
    const code = readFileSync(new URL(name, dist), 'utf8');
    assert.doesNotMatch(code, /houseplan-card\.js/,
      `${name}: ссылка на карточку по адресу без версии`);
  }
  const card = readFileSync(new URL('houseplan-card.js', dist), 'utf8');
  assert.match(card, /try\{await import\("\.\/houseplan-assets\/houseplan-card-[^"']+\.js"\)\}catch\(/,
    'сам фасад остаётся стабильным входом Lovelace-ресурса и тянет хешированный чанк');
});

test('bundle tree verification rejects orphan chunks (#353 AC4)', async (t) => {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { verifyBundleTree, sha256Bytes } = await import('../scripts/bundle-tree.mjs');
  const root = mkdtempSync(join(tmpdir(), 'hp-tree-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'houseplan-assets'));
  const entryCode = 'try{await import("./houseplan-assets/main-abc.js")}catch(e){}';
  const panelCode = 'try{await import("./houseplan-card.js")}catch(e){}';
  const chunkCode = 'export const x = 1;';
  writeFileSync(join(root, 'houseplan-card.js'), entryCode);
  writeFileSync(join(root, 'houseplan-panel.js'), panelCode);
  writeFileSync(join(root, 'houseplan-assets', 'main-abc.js'), chunkCode);
  writeFileSync(join(root, 'houseplan-assets.json'), JSON.stringify({
    schema: 1,
    fingerprint: 'f'.repeat(64),
    entry: 'houseplan-card.js',
    panelEntry: 'houseplan-panel.js',
    initialViewFiles: ['houseplan-assets/main-abc.js', 'houseplan-card.js'],
    initialViewGzipBytes: 12,
    initialPanelFiles: [
      'houseplan-assets/main-abc.js', 'houseplan-panel.js',
    ],
    initialPanelGzipBytes: 9,
    initialPanelOnlyFiles: ['houseplan-panel.js'],
    initialPanelOnlyGzipBytes: 2,
    files: [
      {
        path: 'houseplan-card.js', sha256: sha256Bytes(Buffer.from(entryCode)),
        gzipBytes: 5, isEntry: true,
      },
      {
        path: 'houseplan-panel.js', sha256: sha256Bytes(Buffer.from(panelCode)),
        gzipBytes: 2, isEntry: true,
      },
      {
        path: 'houseplan-assets/main-abc.js', sha256: sha256Bytes(Buffer.from(chunkCode)),
        gzipBytes: 7, isEntry: false,
      },
    ],
  }));
  assert.equal(verifyBundleTree(root).files.length, 3, 'a clean tree verifies');
  writeFileSync(join(root, 'houseplan-assets', 'junk-old.js'), 'stale');
  assert.throws(
    () => verifyBundleTree(root),
    /orphan bundle asset: houseplan-assets\/junk-old\.js/,
  );
  rmSync(join(root, 'houseplan-assets', 'junk-old.js'));
  writeFileSync(join(root, 'houseplan-obsolete.js'), 'stale root entry');
  assert.throws(
    () => verifyBundleTree(root),
    /orphan bundle asset: houseplan-obsolete\.js/,
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
    writeFileSync(join(temp, 'editor.js'), 'lazy English marker');
    writeFileSync(join(temp, 'support-ru.js'), 'lazy Russian marker');
    const markers = [
      { text: 'lazy English marker', graph: 'lazyEditorFiles' },
      { text: 'lazy Russian marker', graph: 'lazyNamespaceLocaleFiles' },
    ];
    const base = {
      initialViewFiles: ['initial.js'], lazyEditorFiles: ['editor.js'],
      lazyNamespaceLocaleFiles: ['support-ru.js'],
    };
    for (const initialViewGzipBytes of [0, 291_046, 10_000_000, undefined]) {
      assert.doesNotThrow(
        () => assertSupportBundleOwnership({ ...base, initialViewGzipBytes }, temp, markers),
        `размер ${initialViewGzipBytes} не должен влиять на проверку владения`,
      );
    }
    // Размер по-прежнему охраняется — но потолком и бюджетом, а не чужим
    // номером. Число берётся из поставляемого манифеста: захардкоженный запас
    // в тесте выглядел бы измерением, не будучи им (#438).
    const shipped = JSON.parse(
      readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'),
    ).initialViewGzipBytes;
    assert.match(
      lowHeadroomWarning(INITIAL_VIEW_GZIP_BUDGET - shipped) || '',
      new RegExp(`запас бюджета ${INITIAL_VIEW_GZIP_BUDGET - shipped} Б`),
      'предупреждение о запасе остаётся честным сигналом о размере',
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});


// --- #438: потолок графа с полосой ------------------------------------------

test('#438 поставляемый граф лежит внутри полосы потолка', () => {
  // Гейт живёт и здесь, а не только в `npm run bundle:budget`: манифест
  // закоммичен, значит проверка стоит ровно там, где её увидит любой прогон
  // тестов. Рост, который не заметили в бете.2, краснел бы на этом тесте.
  const manifest = JSON.parse(
    readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'),
  );
  const violation = initialViewCeilingViolation(manifest.initialViewGzipBytes);
  assert.equal(violation, null, violation?.text);
});

test('#438 рост выше потолка — отказ с числом и с указанием, что делать', () => {
  const grew = initialViewCeilingViolation(292_400, { ceiling: 292_000, band: 2_000 });
  assert.equal(grew.kind, 'grew');
  assert.equal(grew.over, 400);
  assert.match(grew.text, /выше потолка 292000 B на 400 B/);
  assert.match(grew.text, /Поднимите потолок в этом же коммите/);
  assert.match(grew.text, /#367/, 'у отказа обязан быть выход, а не только запрет');
  // Ровно на потолке — ещё не рост: граница включительная, иначе гейт краснеет
  // на равенстве и разбираться идут не с графом, а с гейтом.
  assert.equal(initialViewCeilingViolation(292_000, { ceiling: 292_000 }), null);
});

test('#438 падение ниже полосы требует опустить потолок', () => {
  // Вторая половина храповика, без которой он не храповик: выигрыш, который не
  // зафиксировали, отыгрывается обратно молча. Так запас бюджета ушёл с 26 КБ
  // до 8.3 КБ за сутки — каждая отдельная строка выглядела нормально.
  const shrank = initialViewCeilingViolation(289_500, { ceiling: 292_000, band: 2_000 });
  assert.equal(shrank.kind, 'shrank');
  assert.equal(shrank.under, 2_500);
  assert.match(shrank.text, /Опустите потолок/);
  assert.equal(initialViewCeilingViolation(290_000, { ceiling: 292_000, band: 2_000 }), null,
    'нижняя граница полосы тоже включительная');
  assert.equal(initialViewCeilingViolation(NaN).kind, 'missing');
  assert.equal(initialViewCeilingViolation(undefined).kind, 'missing');
});

test('#438 полоса шире наблюдаемого шума метрики', () => {
  // gzip не монотонен по исходнику: на beta.2 initial-чанк стал меньше на 344
  // сырых байта и на 40 байт больше в сжатом виде. Полоса обязана быть заметно
  // шире таких колебаний, иначе гейт краснеет на коммитах, сокращающих код, —
  // и красным станет последний пушнувший, а не тот, кто вырастил граф.
  assert.ok(INITIAL_VIEW_CEILING_BAND >= 1_000,
    'полоса меньше килобайта превращает потолок в лотерею');
  // И потолок обязан оставаться под общим бюджетом: иначе он ничего не значит.
  assert.ok(INITIAL_VIEW_GZIP_CEILING < INITIAL_VIEW_GZIP_BUDGET);
  // Факт лежит не у края полосы: до отказа есть место в обе стороны.
  const shipped = JSON.parse(
    readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'),
  ).initialViewGzipBytes;
  assert.ok(INITIAL_VIEW_GZIP_CEILING - shipped > 500, 'сверху меньше 500 Б — это шум');
  assert.ok(shipped - (INITIAL_VIEW_GZIP_CEILING - INITIAL_VIEW_CEILING_BAND) > 500,
    'снизу меньше 500 Б — гейт потребует опустить потолок из-за шума');
});

test('#438 предупреждение о запасе можно погасить, и повышение потолка его возвращает', () => {
  const headroom = LOW_HEADROOM_WARNING_BYTES - 1;
  // Не погашено — горит и говорит, чем гасится. Это текущее состояние.
  assert.equal(LOW_HEADROOM_ACKNOWLEDGED_CEILING, null,
    'долг #367 пока не признан — состояние честное, а не забытое');
  assert.match(lowHeadroomWarning(headroom, { acknowledgedCeiling: null }),
    /Погасить можно решением владельца/);
  // Признано ровно для этого потолка — молчит.
  assert.equal(
    lowHeadroomWarning(headroom, { ceiling: 292_000, acknowledgedCeiling: 292_000 }), null,
  );
  // Потолок подняли — признание перестало покрывать, вопрос вернулся.
  assert.match(
    lowHeadroomWarning(headroom, { ceiling: 294_000, acknowledgedCeiling: 292_000 }),
    /покрывает потолок до 292000 Б, а он уже 294000 Б/,
  );
  // Превышение бюджета признанием не гасится: там уже отказ, а не тревога.
  assert.match(
    lowHeadroomWarning(-10, { ceiling: 292_000, acknowledgedCeiling: 292_000 }),
    /бюджет превышен на 10 Б/,
  );
});

/**
 * Прогон настоящего CLI бюджета в подставном дереве (#438).
 *
 * Статическая проверка «в main вызывается initialViewCeilingViolation» была бы
 * тем самым циклическим доказательством, за которое #430 снял циклический тест
 * гарда benchmark. Поэтому здесь запуск: манифест кладётся на диск, скрипт
 * исполняется процессом, читается код возврата. Снятый из main вызов потолка
 * при этом краснеет — проверено (без этого теста мутация проходила молча).
 */
const runBudgetCli = (initialViewGzipBytes) => {
  const dir = mkdtempSync(join(tmpdir(), 'houseplan-budget-cli-'));
  try {
    mkdirSync(join(dir, 'dist'));
    writeFileSync(join(dir, 'dist/houseplan-card.js'), 'view graph without support copy');
    writeFileSync(join(dir, 'dist/houseplan-panel.js'), 'panel shell');
    // #627: the CLI judges ownership by content — each marker in its own graph.
    const namespaceMarkers = namespaceLocaleMarkers();
    const english = (namespace) => namespaceMarkers
      .find((marker) => marker.namespace === namespace && marker.language === 'en').text;
    writeFileSync(join(dir, 'dist/editor.js'), [
      ...SUPPORT_LAZY_MARKERS.filter((marker) => marker.graph === 'lazyEditorFiles').map((marker) => marker.text),
      english('settings'), english('support'), english('topology'),
    ].join('\n'));
    writeFileSync(join(dir, 'dist/onboarding.js'), english('settings'));
    for (const entry of NAMESPACE_LOCALE_CHUNKS) {
      const marker = namespaceMarkers.find((candidate) => candidate.namespace === entry.namespace
        && candidate.language === entry.language).text;
      const support = entry.namespace === 'support' && entry.language === 'ru'
        ? SUPPORT_LAZY_MARKERS.filter((candidate) => candidate.graph === 'lazyNamespaceLocaleFiles')
          .map((candidate) => candidate.text) : [];
      writeFileSync(join(dir, `dist/${entry.namespace}-${entry.language}.js`), [marker, ...support].join('\n'));
    }
    writeFileSync(join(dir, 'dist/locale.js'), 'lazy locale dictionary');
    writeFileSync(join(dir, 'dist/isometric.js'), 'lazy isometric runtime');
    writeFileSync(join(dir, 'dist/furniture-art.js'), 'lazy furniture artwork');
    writeFileSync(join(dir, 'dist/pdf.js'), 'lazy pdf writer');
    writeFileSync(join(dir, 'dist/houseplan-assets.json'), JSON.stringify({
      schema: 1,
      fingerprint: 'f'.repeat(64),
      entry: 'houseplan-card.js',
      panelEntry: 'houseplan-panel.js',
      files: [
        {
          path: 'houseplan-card.js', gzipBytes: initialViewGzipBytes, isEntry: true,
        },
        { path: 'houseplan-panel.js', gzipBytes: 1, isEntry: true },
      ],
      initialViewFiles: ['houseplan-card.js'],
      initialViewGzipBytes,
      initialPanelFiles: ['houseplan-panel.js'],
      initialPanelGzipBytes: 1,
      initialPanelOnlyFiles: ['houseplan-panel.js'],
      initialPanelOnlyGzipBytes: 1,
      lazyEditorFiles: ['editor.js'],
      // #593: у ленивых графов теперь свои потолки, и фикстура обязана лежать
      // внутри полосы — иначе CLI краснеет не на том, что проверяет тест.
      lazyEditorGzipBytes: LAZY_EDITOR_GZIP_CEILING - 1_000,
      lazyLocaleFiles: ['locale.js'],
      lazyLocaleGzipBytes: 100,
      lazyIsometricFiles: ['isometric.js'],
      lazyIsometricGzipBytes: 100,
      lazyFurnitureArtFiles: ['furniture-art.js'],
      lazyFurnitureArtGzipBytes: LAZY_FURNITURE_ART_GZIP_CEILING - 1_000,
      lazyPdfFiles: ['pdf.js'],
      lazyPdfGzipBytes: 100,
      lazyOnboardingFiles: ['onboarding.js'],
      lazyOnboardingGzipBytes: LAZY_ONBOARDING_GZIP_CEILING - 1_000,
      lazyNamespaceLocaleFiles: NAMESPACE_LOCALE_CHUNKS
        .map((entry) => `${entry.namespace}-${entry.language}.js`),
      lazyNamespaceLocaleGzipBytes: 900,
    }));
    const script = fileURLToPath(new URL('../scripts/bundle-budget.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
    return { status: run.status, output: `${run.stdout || ''}${run.stderr || ''}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('#438 CLI действительно применяет потолок, а не только объявляет его', () => {
  const inside = runBudgetCli(INITIAL_VIEW_GZIP_CEILING - 500);
  assert.equal(inside.status, 0, inside.output);
  // #627 AC1: the onboarding graph is printed with its ceiling and band.
  assert.match(inside.output, new RegExp(`lazy onboarding: ${LAZY_ONBOARDING_GZIP_CEILING - 1_000} B gzip`
    + ` \\(потолок ${LAZY_ONBOARDING_GZIP_CEILING} B ±${LAZY_GRAPH_CEILING_BAND}\\)`));

  const grew = runBudgetCli(INITIAL_VIEW_GZIP_CEILING + 1);
  assert.equal(grew.status, 1, grew.output);
  assert.match(grew.output, /выше потолка/);

  const shrank = runBudgetCli(INITIAL_VIEW_GZIP_CEILING - INITIAL_VIEW_CEILING_BAND - 1);
  assert.equal(shrank.status, 1, shrank.output);
  assert.match(shrank.output, /Опустите потолок/);

  // И общий бюджет остаётся внешней стеной: он выше потолка, значит красным
  // становится потолок, а не бюджет — но и бюджет обязан уметь падать.
  const overBudget = runBudgetCli(INITIAL_VIEW_GZIP_BUDGET + 1);
  assert.equal(overBudget.status, 1, overBudget.output);
  assert.match(overBudget.output,
    new RegExp(`exceeds ${INITIAL_VIEW_GZIP_BUDGET} B budget`));
});

// #593: до этой задачи размеры ленивых графов только печатались в отчёт. Тогда
// «бюджет ленивого графа защищён» было заявлением без гейта — сравнения не
// существовало ни одного, и рост уезжал молча.
test('#593 потолки ленивых графов — гейт, а не строка отчёта', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'),
  );
  for (const [bytes, ceiling, label] of [
    [manifest.lazyFurnitureArtGzipBytes, LAZY_FURNITURE_ART_GZIP_CEILING, 'lazy furniture art graph'],
    [manifest.lazyEditorGzipBytes, LAZY_EDITOR_GZIP_CEILING, 'lazy editor graph'],
    // #627 AC1: the first-run graph is the third gated lazy graph.
    [manifest.lazyOnboardingGzipBytes, LAZY_ONBOARDING_GZIP_CEILING, 'lazy onboarding graph'],
  ]) {
    const violation = lazyGraphCeilingViolation(bytes, { ceiling, label });
    assert.equal(violation, null, violation?.text);
    // Факт лежит не у края полосы — с тем же запасом, что у стартового графа.
    assert.ok(ceiling - bytes > 500, `${label}: сверху меньше 500 Б — это шум`);
    assert.ok(bytes - (ceiling - LAZY_GRAPH_CEILING_BAND) > 500,
      `${label}: снизу меньше 500 Б — гейт потребует опустить потолок из-за шума`);
  }
  // Гейт обязан быть исполняемым и на синтетике, обе стороны.
  const grew = lazyGraphCeilingViolation(20_000, { ceiling: 17_900, label: 'lazy furniture art graph' });
  assert.equal(grew.kind, 'grew');
  assert.equal(grew.over, 2_100);
  assert.match(grew.text, /lazy furniture art graph 20000 B gzip выше потолка 17900 B на 2100 B/);
  const shrank = lazyGraphCeilingViolation(15_000, { ceiling: 17_900, label: 'lazy furniture art graph' });
  assert.equal(shrank.kind, 'shrank');
  assert.match(shrank.text, /Опустите потолок/);
  // Границы полосы включительные — иначе гейт краснеет на равенстве.
  assert.equal(lazyGraphCeilingViolation(17_900, { ceiling: 17_900, label: 'x' }), null);
  assert.equal(lazyGraphCeilingViolation(15_900, { ceiling: 17_900, label: 'x' }), null);
  assert.equal(lazyGraphCeilingViolation(NaN, { ceiling: 17_900, label: 'x' }).kind, 'missing');
  // Текст обязан называть граф: «graph выше потолка» не говорит, куда смотреть.
  assert.match(lazyGraphCeilingViolation(NaN, { ceiling: 1, label: 'lazy editor graph' }).text,
    /lazy editor graph/);
});

const shippedManifest = () => JSON.parse(
  readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'),
);
const shippedDist = fileURLToPath(new URL('../dist/', import.meta.url));

test('#627 AC1 граф онбординга гейтится тем же потолком с полосой, что editor и furniture art', () => {
  const manifest = shippedManifest();
  const ceilings = (onboarding) => [
    manifest.lazyFurnitureArtGzipBytes, manifest.lazyEditorGzipBytes, onboarding,
  ];
  const bytes = manifest.lazyOnboardingGzipBytes;
  assert.ok(Number.isFinite(bytes) && bytes > 0, 'манифест обязан измерять граф онбординга');
  assert.doesNotThrow(() => assertBundleBudget(manifest, 1_000_000, undefined, ...ceilings(bytes)));
  assert.throws(
    () => assertBundleBudget(manifest, 1_000_000, undefined, ...ceilings(bytes - 1)),
    new RegExp(`lazy onboarding graph ${bytes} B gzip выше потолка ${bytes - 1} B на 1 B`),
  );
  assert.throws(
    () => assertBundleBudget(manifest, 1_000_000, undefined, ...ceilings(bytes + LAZY_GRAPH_CEILING_BAND + 1)),
    /lazy onboarding graph \d+ B gzip ниже потолка .*Опустите потолок/,
  );
  // Потолок по умолчанию — поставляемый, и поставляемый граф в его полосе.
  assert.doesNotThrow(() => assertBundleBudget(manifest));
});

test('#627 AC3 словари пространств: девять ленивых чанков, английский — у потребителя', () => {
  const manifest = shippedManifest();
  assert.equal(manifest.lazyNamespaceLocaleFiles.length, NAMESPACE_LOCALE_CHUNKS.length);
  for (const entry of NAMESPACE_LOCALE_CHUNKS) {
    const own = manifest.lazyNamespaceLocaleFiles
      .filter((path) => path.startsWith(`houseplan-assets/${entry.namespace}-${entry.language}-`));
    assert.equal(own.length, 1, `${entry.namespace}-${entry.language}: ровно один отдельный чанк`);
  }
  for (const graph of ['initialViewFiles', 'lazyEditorFiles', 'lazyOnboardingFiles']) {
    assert.deepEqual(manifest.lazyNamespaceLocaleFiles.filter((path) => manifest[graph].includes(path)), [],
      `${graph} не содержит ни одного чанка словаря пространства`);
  }
  // По содержимому: en — статически у каждого потребителя и не в первом кадре;
  // ru/de/fr — только в своём чанке.
  assert.doesNotThrow(() => assertNamespaceLocaleOwnership(manifest, shippedDist));
  assert.doesNotThrow(() => assertSupportBundleOwnership(manifest, shippedDist));
});

test('#627 AC3 проверка владения краснеет на каждом нарушении', () => {
  const temp = mkdtempSync(join(tmpdir(), 'houseplan-namespace-owner-'));
  const marker = (namespace, language) => ({ namespace, language, text: `${namespace} ${language} marker` });
  const markers = [marker('settings', 'en'), marker('settings', 'ru'), marker('topology', 'en')];
  const manifest = {
    initialViewFiles: ['initial.js'], lazyEditorFiles: ['editor.js'],
    lazyOnboardingFiles: ['onboarding.js'], lazyNamespaceLocaleFiles: ['settings-ru.js'],
  };
  const write = (files) => {
    for (const [name, text] of Object.entries({
      'initial.js': 'view', 'editor.js': 'settings en marker topology en marker',
      'onboarding.js': 'settings en marker', 'settings-ru.js': 'settings ru marker', ...files,
    })) writeFileSync(join(temp, name), text);
  };
  try {
    write({});
    assert.doesNotThrow(() => assertNamespaceLocaleOwnership(manifest, temp, markers));
    write({ 'editor.js': 'settings en marker topology en marker settings ru marker' });
    assert.throws(() => assertNamespaceLocaleOwnership(manifest, temp, markers),
      /settings\/ru dictionary is static in lazy editor graph/);
    write({ 'onboarding.js': 'settings en marker settings ru marker' });
    assert.throws(() => assertNamespaceLocaleOwnership(manifest, temp, markers),
      /settings\/ru dictionary is static in lazy onboarding graph/);
    write({ 'initial.js': 'topology en marker' });
    assert.throws(() => assertNamespaceLocaleOwnership(manifest, temp, markers),
      /topology\/en dictionary leaked into initial View graph/);
    write({ 'onboarding.js': 'form only' });
    assert.throws(() => assertNamespaceLocaleOwnership(manifest, temp, markers),
      /settings\/en dictionary missing from lazy onboarding graph/);
    write({ 'settings-ru.js': 'empty' });
    assert.throws(() => assertNamespaceLocaleOwnership(manifest, temp, markers),
      /settings\/ru dictionary missing from lazy namespace locale graph/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  // Маркеры реальных словарей не совпадают ни с одной строкой основного каталога.
  const real = namespaceLocaleMarkers();
  assert.equal(real.length, 12);
  assert.equal(new Set(real.map((entry) => entry.text)).size, 12);
});
