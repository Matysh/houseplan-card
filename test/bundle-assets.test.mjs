import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildBundleManifest, buildFingerprintPlugin, editorRuntimeRetryUrlPlugin,
} from '../scripts/bundle-manifest.mjs';
import {
  INITIAL_VIEW_CEILING_BAND, INITIAL_VIEW_GZIP_BUDGET, INITIAL_VIEW_GZIP_CEILING,
  LOW_HEADROOM_ACKNOWLEDGED_CEILING, LOW_HEADROOM_WARNING_BYTES,
  SUPPORT_LAZY_MARKERS,
  assertBundleBudget, assertSupportBundleOwnership, initialViewCeilingViolation,
  lowHeadroomWarning,
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
        'houseplan-assets/de-HASH.js', 'houseplan-assets/iso-scene-render-HASH.js',
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
    'houseplan-assets/iso-scene-render-HASH.js': {
      type: 'chunk', fileName: 'houseplan-assets/iso-scene-render-HASH.js',
      code: 'isometric runtime', isEntry: false, imports: ['shared.js'], dynamicImports: [],
      modules: { '/repo/src/iso-scene-render.ts': {} },
    },
  }, 'fingerprint');
  assert.deepEqual(manifest.initialViewFiles, ['houseplan-card.js', 'shared.js']);
  assert.deepEqual(manifest.lazyEditorFiles, ['houseplan-assets/editor.js']);
  assert.deepEqual(manifest.lazyOnboardingFiles, [
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
  ]);
  assert.deepEqual(manifest.lazyLocaleFiles, ['houseplan-assets/de-HASH.js']);
  assert.deepEqual(manifest.lazyIsometricFiles, ['houseplan-assets/iso-scene-render-HASH.js']);
  assert.deepEqual(manifest.lazyFiles, [
    'houseplan-assets/de-HASH.js', 'houseplan-assets/editor.js',
    'houseplan-assets/houseplan-onboarding-runtime-HASH.js',
    'houseplan-assets/iso-scene-render-HASH.js',
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
        + 'new URL("__HOUSEPLAN_ISO_RETRY_ASSET__", import.meta.url);'
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
  };
  plugin.generateBundle({}, bundle);
  assert.equal(
    bundle['houseplan-assets/houseplan-card.js'].code,
    'new URL("./houseplan-editor-runtime-HASH.js", import.meta.url);'
      + 'new URL("./houseplan-onboarding-runtime-HASH.js", import.meta.url);'
      + 'new URL("./iso-scene-render-HASH.js", import.meta.url);'
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
    writeFileSync(join(dir, 'dist/initial.js'), 'view graph without support copy');
    writeFileSync(join(dir, 'dist/editor.js'), SUPPORT_LAZY_MARKERS.join('\n'));
    writeFileSync(join(dir, 'dist/locale.js'), 'lazy locale dictionary');
    writeFileSync(join(dir, 'dist/isometric.js'), 'lazy isometric runtime');
    writeFileSync(join(dir, 'dist/houseplan-assets.json'), JSON.stringify({
      schema: 1,
      files: [],
      initialViewFiles: ['initial.js'],
      initialViewGzipBytes,
      lazyEditorFiles: ['editor.js'],
      lazyEditorGzipBytes: 1000,
      lazyLocaleFiles: ['locale.js'],
      lazyLocaleGzipBytes: 100,
      lazyIsometricFiles: ['isometric.js'],
      lazyIsometricGzipBytes: 100,
      lazyOnboardingFiles: [],
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
