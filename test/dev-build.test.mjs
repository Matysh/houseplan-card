// #657 (2б): стенд dev берёт бандл из артефакта Validate через ветку dev-build,
// а не из дерева dev, где бандл меняет только кандидат.
// #835: ветка несёт всю интеграцию того же SHA, а scripts/ha-track-dev.sh
// ставит её на свою инсталляцию HA.
// #836: опубликованная интеграция помечена как dev-сборка (BUILD.json и
// `+dev.<sha8>` в version манифеста), а integrationTree считается без метки.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  DEV_BUILD_INTEGRATION, DEV_BUILD_LABEL, DEV_BUILD_MANIFEST, DEV_BUILD_MARKER, DEV_BUILD_TARGET,
  integrationIndexEntries, labelManifestText, parseArgs, publishDevBuild,
} from '../scripts/dev-build.mjs';

const STAND = fileURLToPath(new URL('../demo/stand/update-dev-bundle.sh', import.meta.url));
// Путь от корня — чтобы check-inputs видел скрипт входом job frontend (#492):
// его правка перезапускает этот тест, а не переиспользует старый зелёный.
const TRACK_PATH = 'scripts/ha-track-dev.sh';
const TRACK = fileURLToPath(new URL(`../${TRACK_PATH}`, import.meta.url));
const ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...ENV },
}).trim();
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
// Байты файла как есть: git() выше обрезает перевод строки в конце.
const blob = (cwd, spec) => execFileSync('git', ['show', spec], { cwd, encoding: 'utf8' });
// Манифест дерева с нестандартными пробелами и вложенной `version`: метка
// обязана заменить только верхнеуровневое значение и не тронуть остальное.
const SOURCE_MANIFEST = '{\n  "domain": "houseplan",\n  "requirements": [],\n'
  + '  "extra": {"version": "nested"},\n  "version" :  "1.80.1-beta.1"\n}\n';

function writeDist(root, card) {
  const dir = join(root, 'dist');
  mkdirSync(join(dir, 'houseplan-assets'), { recursive: true });
  const entries = [['houseplan-card.js', card], ['houseplan-panel.js', 'panel'], ['houseplan-assets/c-HASH.js', `chunk ${card}`]];
  for (const [name, value] of entries) writeFileSync(join(dir, name), value);
  const files = entries.map(([path, value]) => ({
    path, sha256: sha256(value), rawBytes: value.length, gzipBytes: 1,
    isEntry: !path.includes('/'), imports: [], dynamicImports: [],
  }));
  writeFileSync(join(dir, 'houseplan-assets.json'), `${JSON.stringify({
    schema: 1, fingerprint: 'a'.repeat(64), entry: 'houseplan-card.js', panelEntry: 'houseplan-panel.js',
    initialViewFiles: ['houseplan-card.js'], initialViewGzipBytes: 1,
    initialPanelFiles: ['houseplan-panel.js'], initialPanelGzipBytes: 1,
    initialPanelOnlyFiles: ['houseplan-panel.js'], initialPanelOnlyGzipBytes: 1, files,
  })}\n`);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hp-dev-build-test-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  git(root, 'init', '--bare', '-q', '-b', 'dev', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  mkdirSync(join(work, DEV_BUILD_TARGET, 'houseplan-assets'), { recursive: true });
  writeFileSync(join(work, DEV_BUILD_TARGET, 'houseplan-card.js'), 'card of the last beta');
  writeFileSync(join(work, DEV_BUILD_TARGET, 'houseplan-assets.json'), '{}\n');
  writeFileSync(join(work, DEV_BUILD_TARGET, 'houseplan-assets', 'beta-OLD.js'), 'chunk of the last beta');
  mkdirSync(join(work, DEV_BUILD_INTEGRATION, 'translations'), { recursive: true });
  writeFileSync(join(work, DEV_BUILD_INTEGRATION, 'manifest.json'), SOURCE_MANIFEST);
  writeFileSync(join(work, DEV_BUILD_INTEGRATION, '__init__.py'), 'VERSION = 1\n');
  writeFileSync(join(work, DEV_BUILD_INTEGRATION, 'translations', 'ru.json'), '{}\n');
  writeFileSync(join(work, 'src.ts'), 'v1');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'base');
  git(work, 'push', '-q', '-u', 'origin', 'dev');
  return { root, origin, work, head: git(work, 'rev-parse', 'HEAD') };
}

test('#657 parseArgs: значения по умолчанию и обе формы флагов', () => {
  assert.deepEqual(parseArgs(['--sha', 'x']), {
    sha: 'x', dist: 'dist', remote: 'origin', branch: 'dev-build', expectRef: 'refs/heads/dev', dryRun: false,
  });
  assert.equal(parseArgs(['--sha=y', '--dry-run']).dryRun, true);
  assert.equal(parseArgs(['--sha=y']).sha, 'y');
});

test('#657 dev-build: одна ветка без истории с бандлом головы dev и SHA источника', () => {
  const { root, origin, work, head } = fixture();
  try {
    writeDist(work, 'fresh card');
    const first = publishDevBuild({ cwd: work, sha: head, log: () => {} });
    assert.equal(first.published, true);
    const branchTip = git(origin, 'rev-parse', 'refs/heads/dev-build');
    assert.equal(git(origin, 'rev-list', '--count', branchTip), '1', 'коммит без родителей');
    assert.equal(git(origin, 'show', `${branchTip}:${DEV_BUILD_TARGET}/houseplan-card.js`), 'fresh card');
    const marker = JSON.parse(git(origin, 'show', `${branchTip}:${DEV_BUILD_MARKER}`));
    assert.equal(marker.source, head);
    assert.equal(marker.files, 3);
    assert.equal(git(work, 'status', '--porcelain', '--', DEV_BUILD_TARGET), '',
      'рабочее дерево и индекс источника не тронуты');
    assert.equal(git(origin, 'rev-parse', 'refs/heads/dev'), head, 'dev не тронут');

    // Второй прогон заменяет ветку целиком — истории не копится.
    writeDist(work, 'fresher card');
    publishDevBuild({ cwd: work, sha: head, log: () => {} });
    const second = git(origin, 'rev-parse', 'refs/heads/dev-build');
    assert.notEqual(second, branchTip);
    assert.equal(git(origin, 'rev-list', '--count', second), '1');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#657 dev-build: dev ушёл вперёд — прогон не пушит устаревшую сборку', () => {
  const { root, origin, work, head } = fixture();
  try {
    writeFileSync(join(work, 'src.ts'), 'v2');
    git(work, 'commit', '-qam', 'next');
    git(work, 'push', '-q', 'origin', 'dev');
    writeDist(work, 'card of the older head');
    const lines = [];
    const result = publishDevBuild({ cwd: work, sha: head, log: (l) => lines.push(l) });
    assert.deepEqual({ published: result.published, reason: result.reason }, { published: false, reason: 'stale' });
    assert.equal(git(origin, 'for-each-ref', 'refs/heads/dev-build'), '', 'ветка не создана');
    assert.match(lines.join('\n'), /публикует следующий прогон/);
    assert.throws(() => publishDevBuild({ cwd: work, sha: 'HEAD', log: () => {} }), /full commit SHA/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#657 стенд: update-dev-bundle.sh ставит бандл dev-build поверх рабочей копии и умеет вернуть её до pull', () => {
  const { root, origin, work, head } = fixture();
  try {
    writeDist(work, 'fresh card');
    publishDevBuild({ cwd: work, sha: head, log: () => {} });
    const stand = join(root, 'stand');
    git(root, 'clone', '-q', '-b', 'dev', origin, stand);
    writeFileSync(join(stand, DEV_BUILD_TARGET, 'stale-orphan.js'), 'left over');
    const run = spawnSync('bash', [STAND, stand], { encoding: 'utf8', env: { ...process.env, ...ENV } });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(readFileSync(join(stand, DEV_BUILD_TARGET, 'houseplan-card.js'), 'utf8'), 'fresh card');
    assert.equal(existsSync(join(stand, DEV_BUILD_TARGET, 'houseplan-assets/c-HASH.js')), true);
    assert.equal(existsSync(join(stand, DEV_BUILD_TARGET, 'stale-orphan.js')), false, 'каталог заменён целиком');
    assert.match(run.stdout, new RegExp(head.slice(0, 8)));

    const reset = spawnSync('bash', [STAND, '--reset', stand], { encoding: 'utf8', env: { ...process.env, ...ENV } });
    assert.equal(reset.status, 0, reset.stderr);
    assert.equal(git(stand, 'status', '--porcelain'), '', 'до pull рабочая копия чистая');
    assert.equal(readFileSync(join(stand, DEV_BUILD_TARGET, 'houseplan-card.js'), 'utf8'), 'card of the last beta');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const backendOf = (repo, rev) => git(repo, 'ls-tree', '-r', '--name-only', rev, '--', DEV_BUILD_INTEGRATION)
  .split('\n').filter((path) => path && !path.startsWith(`${DEV_BUILD_TARGET}/`)).sort();

test('#835 dev-build: вся интеграция источника, фронтенд — только из dist', () => {
  const { root, origin, work, head } = fixture();
  try {
    writeDist(work, 'fresh card');
    publishDevBuild({ cwd: work, sha: head, log: () => {} });
    const tip = git(origin, 'rev-parse', 'refs/heads/dev-build');
    assert.deepEqual(backendOf(origin, tip), [
      `${DEV_BUILD_INTEGRATION}/BUILD.json`,
      `${DEV_BUILD_INTEGRATION}/__init__.py`,
      `${DEV_BUILD_INTEGRATION}/manifest.json`,
      `${DEV_BUILD_INTEGRATION}/translations/ru.json`,
    ], 'файлы бэкенда — из дерева коммита-источника и метка #836');
    assert.equal(git(origin, 'show', `${tip}:${DEV_BUILD_INTEGRATION}/__init__.py`), 'VERSION = 1');
    assert.equal(git(origin, 'show', `${tip}:${DEV_BUILD_TARGET}/houseplan-card.js`), 'fresh card');
    assert.equal(git(origin, 'ls-tree', '--name-only', `${tip}:${DEV_BUILD_TARGET}/houseplan-assets`), 'c-HASH.js',
      'закоммиченный бандл последней беты в ветку не попадает');
    const marker = JSON.parse(git(origin, 'show', `${tip}:${DEV_BUILD_MARKER}`));
    assert.equal(marker.schema, 2);
    assert.equal(marker.source, head);
    assert.equal(marker.backendFiles, 3);
    assert.equal(marker.integrationTree, unlabelledIntegrationTree(origin, tip, head),
      'integrationTree — хеш дерева интеграции в самой ветке без метки #836');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * Хеш дерева интеграции опубликованного коммита, из которого убрана метка
 * #836: без BUILD.json и с манифестом дерева источника. Ровно это обязан
 * назвать `integrationTree`.
 */
function unlabelledIntegrationTree(repo, tip, source) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-dev-build-index-'));
  const index = join(dir, 'index');
  const run = (...args) => execFileSync('git', args, {
    cwd: repo, encoding: 'utf8', env: { ...process.env, ...ENV, GIT_INDEX_FILE: index },
  }).trim();
  try {
    run('read-tree', tip);
    run('rm', '-q', '--cached', DEV_BUILD_LABEL);
    run('update-index', '--cacheinfo', `100644,${run('rev-parse', `${source}:${DEV_BUILD_MANIFEST}`)},${DEV_BUILD_MANIFEST}`);
    return run('rev-parse', `${run('write-tree')}:${DEV_BUILD_INTEGRATION}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('#836 dev-build: метка BUILD.json и +dev в манифесте, integrationTree без неё, источник не тронут', () => {
  const { root, origin, work, head } = fixture();
  try {
    writeDist(work, 'fresh card');
    const result = publishDevBuild({ cwd: work, sha: head, log: () => {} });
    const tip = git(origin, 'rev-parse', 'refs/heads/dev-build');
    assert.deepEqual(JSON.parse(blob(origin, `${tip}:${DEV_BUILD_LABEL}`)),
      { schema: 1, channel: 'dev', source: head }, 'BUILD.json по К1, полный SHA источника');
    const published = blob(origin, `${tip}:${DEV_BUILD_MANIFEST}`);
    const version = `1.80.1-beta.1+dev.${head.slice(0, 8)}`;
    assert.equal(published, SOURCE_MANIFEST.replace('"1.80.1-beta.1"', JSON.stringify(version)),
      'в манифесте меняется только значение version, остальные байты те же');
    assert.equal(JSON.parse(published).version, version);
    assert.equal(JSON.parse(published).extra.version, 'nested', 'вложенная version не тронута');
    assert.equal(result.version, version);

    const marker = JSON.parse(blob(origin, `${tip}:${DEV_BUILD_MARKER}`));
    assert.equal(marker.integrationTree, unlabelledIntegrationTree(origin, tip, head),
      'integrationTree считается по интеграции без метки');
    assert.notEqual(marker.integrationTree, git(origin, 'rev-parse', `${tip}:${DEV_BUILD_INTEGRATION}`),
      'метка лежит в опубликованной интеграции, но вне integrationTree');

    assert.equal(git(work, 'ls-tree', '--name-only', head, '--', DEV_BUILD_LABEL), '', 'в дереве источника BUILD.json нет');
    assert.equal(blob(work, `${head}:${DEV_BUILD_MANIFEST}`), SOURCE_MANIFEST, 'манифест источника не тронут');
    assert.equal(readFileSync(join(work, DEV_BUILD_MANIFEST), 'utf8'), SOURCE_MANIFEST);
    assert.equal(existsSync(join(work, DEV_BUILD_LABEL)), false);
    assert.equal(git(work, 'status', '--porcelain'), '?? dist/', 'рабочее дерево и индекс источника не тронуты');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#836 dev-build: два источника с одной интеграцией и разными SHA — один integrationTree', () => {
  const { root, origin, work, head } = fixture();
  try {
    writeDist(work, 'fresh card');
    const first = publishDevBuild({ cwd: work, sha: head, log: () => {} });
    writeFileSync(join(work, 'README.md'), 'docs only');
    git(work, 'add', 'README.md');
    git(work, 'commit', '-q', '-m', 'docs');
    git(work, 'push', '-q', 'origin', 'dev');
    const next = git(work, 'rev-parse', 'HEAD');
    const second = publishDevBuild({ cwd: work, sha: next, log: () => {} });
    assert.notEqual(next, head);
    assert.equal(second.marker.integrationTree, first.marker.integrationTree,
      'одинаковая интеграция — одинаковый integrationTree при разных SHA и метках');
    assert.equal(second.changed, false, 'установка такой коммит не переставляет');
    const tip = git(origin, 'rev-parse', 'refs/heads/dev-build');
    assert.equal(JSON.parse(blob(origin, `${tip}:${DEV_BUILD_LABEL}`)).source, next, 'метка называет новый SHA');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#836 dev-build: битый манифест или манифест без строковой version — отказ без push', () => {
  for (const [manifest, error] of [
    ['{"domain": "houseplan",\n', /manifest\.json не разбирается/],
    ['{"domain": "houseplan"}\n', /нет строковой version/],
    ['{"domain": "houseplan", "version": 180}\n', /нет строковой version/],
    ['["houseplan"]\n', /нет строковой version/],
  ]) {
    const { root, origin, work } = fixture();
    try {
      writeFileSync(join(work, DEV_BUILD_MANIFEST), manifest);
      git(work, 'commit', '-qam', 'broken manifest');
      git(work, 'push', '-q', 'origin', 'dev');
      writeDist(work, 'fresh card');
      assert.throws(() => publishDevBuild({ cwd: work, sha: git(work, 'rev-parse', 'HEAD'), log: () => {} }), error);
      assert.equal(git(origin, 'for-each-ref', 'refs/heads/dev-build'), '', 'ветка не создана');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('#836 labelManifestText: только верхнеуровневая version, суффикс не удваивается', () => {
  const sha = '024b6595'.padEnd(40, '0');
  assert.equal(labelManifestText('{"version":"1.80.1","x":"\\"version\\": \\"y\\""}', sha).text,
    '{"version":"1.80.1+dev.024b6595","x":"\\"version\\": \\"y\\""}');
  assert.equal(labelManifestText('{"a":{"version":"1"},\n"version": "2"}\n', sha).text,
    '{"a":{"version":"1"},\n"version": "2+dev.024b6595"}\n');
  assert.throws(() => labelManifestText('{"version": "1.0.0+dev.11111111"}', sha), /не принимает суффикс/);
  assert.throws(() => labelManifestText('{"version": ""}', sha), /не принимает суффикс/);
});

test('#835 dev-build: changed — только когда меняется то, что попадает в HA', () => {
  const { root, origin, work, head } = fixture();
  const outFile = join(root, 'github-output');
  const saved = process.env.GITHUB_OUTPUT;
  process.env.GITHUB_OUTPUT = outFile;
  const publishHead = () => {
    git(work, 'push', '-q', 'origin', 'dev');
    writeFileSync(outFile, '');
    const result = publishDevBuild({ cwd: work, sha: git(work, 'rev-parse', 'HEAD'), log: () => {} });
    return { changed: result.changed, output: readFileSync(outFile, 'utf8'), tree: result.marker.integrationTree };
  };
  try {
    writeDist(work, 'fresh card');
    const first = publishHead();
    assert.deepEqual([first.changed, first.output], [true, 'changed=true\n'], 'первая публикация');
    writeFileSync(join(work, 'README.md'), 'docs only');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'docs');
    const docs = publishHead();
    assert.deepEqual([docs.changed, docs.output, docs.tree], [false, 'changed=false\n', first.tree],
      'коммит без изменений интеграции не меняет хеш');
    assert.notEqual(JSON.parse(git(origin, 'show', `dev-build:${DEV_BUILD_MARKER}`)).source, head,
      'маркер всё равно называет новую голову');
    writeFileSync(join(work, DEV_BUILD_INTEGRATION, '__init__.py'), 'VERSION = 2\n');
    git(work, 'commit', '-qam', 'backend');
    assert.equal(publishHead().changed, true, 'правка Python');
    writeDist(work, 'newer card');
    assert.equal(publishHead().changed, true, 'новый фронтенд при том же дереве источника');
  } finally {
    if (saved === undefined) delete process.env.GITHUB_OUTPUT; else process.env.GITHUB_OUTPUT = saved;
    rmSync(root, { recursive: true, force: true });
  }
});

test('#835 dev-build: без интеграции в дереве источника публикации нет', () => {
  const { root, work } = fixture();
  try {
    git(work, 'rm', '-q', '-r', DEV_BUILD_INTEGRATION);
    git(work, 'commit', '-q', '-m', 'no integration');
    const sha = git(work, 'rev-parse', 'HEAD');
    assert.throws(() => integrationIndexEntries(
      (args) => ({ ok: true, out: git(work, ...args) }), sha,
    ), /нет custom_components\/houseplan\/manifest\.json/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// --- scripts/ha-track-dev.sh: POSIX sh в контейнере HA (curl, tar) ---------
const NO_SH = process.platform === 'win32'
  ? 'скрипт для контейнера HA: POSIX sh и curl, на Windows не исполняется' : false;

// Обвязка поверх fixture(): каталог конфигурации HA, архив как у codeload,
// запуск скрипта. Каталог fixture() убирает вызывающий тест.
function track(base) {
  const config = join(base.root, 'config');
  mkdirSync(config);
  const archive = join(base.root, 'dev-build.tar.gz');
  const marker = join(base.root, 'DEV-BUILD.json');
  // Как codeload: один каталог верхнего уровня с содержимым ветки.
  const pack = () => {
    const tip = git(base.origin, 'rev-parse', 'refs/heads/dev-build');
    const tar = execFileSync('git', ['archive', '--format=tar', '--prefix=houseplan-card-dev-build/', tip],
      { cwd: base.origin, maxBuffer: 1 << 26 });
    writeFileSync(archive, gzipSync(tar));
    writeFileSync(marker, git(base.origin, 'show', `${tip}:${DEV_BUILD_MARKER}`));
  };
  const run = (args = [], env = {}) => spawnSync('sh', [TRACK, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env, HP_CONFIG_DIR: config,
      HP_DEV_BUILD_URL: `file://${archive}`, HP_DEV_BUILD_MARKER_URL: `file://${marker}`, ...env,
    },
  });
  const installed = join(config, DEV_BUILD_INTEGRATION);
  return { ...base, config, archive, pack, run, installed };
}

test('#835 ha-track-dev.sh: первая установка, повтор без изменений, новая сборка с прежней копией', { skip: NO_SH }, () => {
  const { root, origin, work, head } = fixture();
  const t = track({ root, origin, work, head });
  try {
    writeDist(t.work, 'fresh card');
    publishDevBuild({ cwd: t.work, sha: t.head, log: () => {} });
    t.pack();
    const first = t.run();
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, new RegExp(`^updated ${t.head} [0-9a-f]{40}\\n$`));
    assert.equal(readFileSync(join(t.installed, '__init__.py'), 'utf8'), 'VERSION = 1\n');
    assert.equal(readFileSync(join(t.installed, 'frontend', 'houseplan-card.js'), 'utf8'), 'fresh card');

    // Повтор: каталог не переставлялся — посторонний файл в нём жив.
    writeFileSync(join(t.installed, 'sentinel'), 'kept');
    const again = t.run();
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /^unchanged /);
    assert.equal(existsSync(join(t.installed, 'sentinel')), true);

    // Опрос сверяет маркер и не качает архив, если сборка та же.
    const polled = t.run(['--poll'], { HP_DEV_BUILD_URL: `file://${join(t.root, 'missing.tar.gz')}` });
    assert.equal(polled.status, 0, polled.stderr);
    assert.match(polled.stdout, /^unchanged /);

    // Новая сборка: ставится, прежняя копия — в houseplan-dev-prev.
    writeFileSync(join(t.work, DEV_BUILD_INTEGRATION, '__init__.py'), 'VERSION = 2\n');
    git(t.work, 'commit', '-qam', 'backend');
    git(t.work, 'push', '-q', 'origin', 'dev');
    publishDevBuild({ cwd: t.work, sha: git(t.work, 'rev-parse', 'HEAD'), log: () => {} });
    t.pack();
    const next = t.run(['--poll']);
    assert.equal(next.status, 0, next.stderr);
    assert.match(next.stdout, /^updated /);
    assert.equal(readFileSync(join(t.installed, '__init__.py'), 'utf8'), 'VERSION = 2\n');
    assert.equal(existsSync(join(t.installed, 'sentinel')), false, 'каталог заменён целиком');
    assert.equal(readFileSync(join(t.config, 'houseplan-dev-prev', 'sentinel'), 'utf8'), 'kept');
    assert.equal(existsSync(join(t.config, '.houseplan-dev-next')), false, 'промежуточный каталог убран');

    // Откат переносом каталога: отметка едет с копией, следующий запуск
    // снова ставит голову, а не считает её уже стоящей.
    rmSync(t.installed, { recursive: true, force: true });
    execFileSync('mv', [join(t.config, 'houseplan-dev-prev'), t.installed]);
    assert.equal(readFileSync(join(t.installed, '__init__.py'), 'utf8'), 'VERSION = 1\n');
    const back = t.run(['--poll']);
    assert.equal(back.status, 0, back.stderr);
    assert.match(back.stdout, /^updated /);
    assert.equal(readFileSync(join(t.installed, '__init__.py'), 'utf8'), 'VERSION = 2\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#836 ha-track-dev.sh: метка едет с установленной копией; та же интеграция с новым SHA — unchanged и прежний SHA', { skip: NO_SH }, () => {
  const { root, origin, work, head } = fixture();
  const t = track({ root, origin, work, head });
  try {
    writeDist(t.work, 'fresh card');
    publishDevBuild({ cwd: t.work, sha: t.head, log: () => {} });
    t.pack();
    const first = t.run();
    assert.equal(first.status, 0, first.stderr);
    const tree = first.stdout.trim().split(' ')[2];
    const label = () => JSON.parse(readFileSync(join(t.installed, 'BUILD.json'), 'utf8'));
    assert.deepEqual(label(), { schema: 1, channel: 'dev', source: t.head });
    assert.equal(JSON.parse(readFileSync(join(t.installed, 'manifest.json'), 'utf8')).version,
      `1.80.1-beta.1+dev.${t.head.slice(0, 8)}`);

    writeFileSync(join(t.work, 'README.md'), 'docs only');
    git(t.work, 'add', 'README.md');
    git(t.work, 'commit', '-q', '-m', 'docs');
    git(t.work, 'push', '-q', 'origin', 'dev');
    const next = git(t.work, 'rev-parse', 'HEAD');
    publishDevBuild({ cwd: t.work, sha: next, log: () => {} });
    t.pack();
    for (const args of [['--poll'], []]) {
      const again = t.run(args);
      assert.equal(again.status, 0, again.stderr);
      assert.equal(again.stdout, `unchanged ${next} ${tree}\n`, 'та же интеграция — та же сборка');
      assert.equal(label().source, t.head, 'установленная копия хранит SHA, с которого её ставили');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('#835 ha-track-dev.sh: битый архив и сборка старого формата не трогают установку', { skip: NO_SH }, () => {
  const { root, origin, work, head } = fixture();
  const t = track({ root, origin, work, head });
  try {
    writeDist(t.work, 'fresh card');
    publishDevBuild({ cwd: t.work, sha: t.head, log: () => {} });
    t.pack();
    assert.equal(t.run().status, 0);
    const before = readFileSync(join(t.installed, '__init__.py'), 'utf8');

    writeFileSync(t.archive, 'not a gzip');
    const broken = t.run();
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /не распаковался/);

    // Ветка до #835: только frontend/ и маркер без integrationTree.
    const legacy = join(t.root, 'legacy');
    mkdirSync(join(legacy, 'houseplan-card-dev-build', DEV_BUILD_TARGET), { recursive: true });
    writeFileSync(join(legacy, 'houseplan-card-dev-build', DEV_BUILD_TARGET, 'houseplan-card.js'), 'old');
    writeFileSync(join(legacy, 'houseplan-card-dev-build', DEV_BUILD_MARKER), `{"schema": 1, "source": "${t.head}"}\n`);
    execFileSync('tar', ['-czf', t.archive, '-C', legacy, 'houseplan-card-dev-build']);
    const old = t.run();
    assert.notEqual(old.status, 0);
    assert.match(old.stderr, /старого формата/);

    assert.equal(readFileSync(join(t.installed, '__init__.py'), 'utf8'), before, 'установка не тронута');
    assert.equal(existsSync(join(t.config, '.houseplan-dev-next')), false);
    assert.equal(t.run(['--bogus']).status, 2, 'неизвестный аргумент');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
