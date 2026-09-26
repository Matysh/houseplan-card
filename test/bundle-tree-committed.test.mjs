import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { compareBundleTrees, readBundleManifest, verifyBundleTree } from '../scripts/bundle-tree.mjs';

// #349. Логика проверки дерева бандла существовала и была написана правильно —
// но применялась только к синтетической фикстуре в tmpdir(). Поэтому манифест,
// ссылающийся на пять несуществующих файлов, прожил в dev незамеченным: 1444
// зелёных теста, зелёный check-docs, и установка через HACS получила бы 404 на
// каждом ленивом импорте.
//
// Здесь те же функции спрашиваются о НАСТОЯЩЕМ дереве репозитория.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const COPIES = ['dist', 'custom_components/houseplan/frontend'];

// #657: судится ЗАКОММИЧЕННЫЙ снимок, а не диск. С #657 бандл в дереве меняет
// только кандидат, и после обычного `npm run build` отслеживаемый `dist/` на
// диске законно новее `custom_components/houseplan/frontend` — сравнение диска
// красило бы любую сборку. Снимок HEAD обязан быть цел и равен себе в обеих
// копиях всегда: его ставит HACS и его публикует бета.
function committedCopies() {
  const listed = spawnSync('git', ['-C', ROOT, 'ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...COPIES], { encoding: 'utf8' });
  if (listed.status !== 0) return null;
  const root = mkdtempSync(resolve(tmpdir(), 'hp-committed-bundle-'));
  for (const path of listed.stdout.split('\0').filter(Boolean)) {
    const blob = spawnSync('git', ['-C', ROOT, 'show', `HEAD:${path}`], { maxBuffer: 64 * 1024 * 1024 });
    assert.equal(blob.status, 0, `git show HEAD:${path}`);
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), blob.stdout);
  }
  return root;
}

test('манифест бандла не ссылается в никуда, обе копии целы и равны (#349)', () => {
  const committed = committedCopies();
  // Без git (распакованный архив) — проверяется то, что лежит на диске, громко.
  if (!committed) console.log('ПРОПУЩЕНО: git недоступен, судится диск вместо закоммиченного снимка');
  const base = committed ?? ROOT;
  try {
    for (const copy of COPIES) {
      // verifyBundleTree отвечает сразу на три вопроса: файл существует, его
      // sha256 совпадает с манифестом, путь не выходит за корень копии.
      assert.doesNotThrow(() => verifyBundleTree(resolve(base, copy)), `${copy}: дерево бандла битое`);
    }
    assert.doesNotThrow(
      () => compareBundleTrees(resolve(base, COPIES[0]), resolve(base, COPIES[1])),
      'копии бандла разошлись: HACS ставит вторую, а сверяется первая',
    );
  } finally {
    if (committed) rmSync(committed, { recursive: true, force: true });
  }
});

test('каждый файл манифеста отслеживается git, а не только лежит на диске (#349)', () => {
  // Дефект #349 родился именно здесь. Пересборка дала чанки с новыми хешами
  // содержимого; `git commit -a --amend` удалил старые (они отслеживались) и
  // НЕ добавил новые (они не отслеживались). Проверка файловой системы на
  // машине автора прошла бы: файлы там были. Отличить «собрано» от
  // «закоммичено» умеет только git.
  const listed = spawnSync('git', ['-C', ROOT, 'ls-files', '-z', ...COPIES], { encoding: 'utf8' });
  if (listed.status !== 0) {
    // Громко, а не молча: тихий пропуск проверки — тот самый класс, из-за
    // которого эта задача и появилась.
    console.log('ПРОПУЩЕНО: git ls-files недоступен, отслеживаемость не проверена'
      + ` (${(listed.stderr || '').trim() || 'нет вывода'})`);
    return;
  }
  const tracked = new Set(listed.stdout.split('\0').filter(Boolean));
  assert.ok(tracked.size, 'git ls-files не вернул ни одного файла — проверьте вызов');
  const missing = [];
  // Манифест — закоммиченный (#657): на диске после сборки лежит новый, с
  // хешами, которых в индексе законно нет.
  const committed = committedCopies();
  try {
    for (const copy of COPIES) {
      const manifest = readBundleManifest(resolve(committed ?? ROOT, copy));
      assert.ok(manifest.files.length, `${copy}: манифест без файлов`);
      for (const file of manifest.files) {
        const relative = `${copy}/${file.path}`;
        if (!tracked.has(relative)) missing.push(relative);
      }
    }
  } finally {
    if (committed) rmSync(committed, { recursive: true, force: true });
  }
  assert.deepEqual(missing, [],
    'манифест ссылается на файлы, которых нет в индексе git: собрано, но не закоммичено');
});
