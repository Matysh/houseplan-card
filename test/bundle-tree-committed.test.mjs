import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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

test('манифест бандла не ссылается в никуда, обе копии целы и равны (#349)', () => {
  for (const copy of COPIES) {
    // verifyBundleTree отвечает сразу на три вопроса: файл существует, его
    // sha256 совпадает с манифестом, путь не выходит за корень копии.
    assert.doesNotThrow(() => verifyBundleTree(resolve(ROOT, copy)), `${copy}: дерево бандла битое`);
  }
  assert.doesNotThrow(
    () => compareBundleTrees(resolve(ROOT, COPIES[0]), resolve(ROOT, COPIES[1])),
    'копии бандла разошлись: HACS ставит вторую, а сверяется первая',
  );
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
  for (const copy of COPIES) {
    const manifest = readBundleManifest(resolve(ROOT, copy));
    assert.ok(manifest.files.length, `${copy}: манифест без файлов`);
    for (const file of manifest.files) {
      const relative = `${copy}/${file.path}`;
      if (!tracked.has(relative)) missing.push(relative);
    }
  }
  assert.deepEqual(missing, [],
    'манифест ссылается на файлы, которых нет в индексе git: собрано, но не закоммичено');
});
