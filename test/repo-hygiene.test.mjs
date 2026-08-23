import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The HACS submission check does not read hacs.json to find the integration: it
// globs `*manifest.json` over the whole clone of the DEFAULT branch and exits 1
// unless there is exactly one (hacs/default, scripts/helpers/integration_path.py
// -> "No manifest"). Two stand-only manifests under demo/stand turned the
// Hassfest job of PR #9004 red on 2026-08-11, five weeks into the review queue,
// and the failure said nothing about which file was to blame. Anything that
// needs a second manifest ships it as `manifest.template.json` and renames it at
// install time — see demo/stand/install.sh.
test('the tree carries exactly one *manifest.json: HACS rejects a repository with two', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
    .toString('utf8').split('\0').filter(Boolean);
  const found = tracked.filter((path) => path.split('/').pop().endsWith('manifest.json'));
  assert.deepEqual(found, ['custom_components/houseplan/manifest.json']);
});

// #255. Копия бандла для стенда весит 1.16 МБ и переписывается почти каждым
// продуктовым коммитом: 364 версии за семь недель — примерно четверть всего
// репозитория. Она нужна только браузерным прогонам, которые собирают её сами
// (`npm run bundle:sync`), поэтому в дереве её быть не должно. Проверка стоит
// здесь, а не в глазах ревьюера: вернуть файл обратно проще всего случайно,
// одним `git add -A` после локальной сборки.
test('копия бандла для стенда не коммитится (#255)', () => {
  const tracked = execFileSync('git', ['ls-files', '-z', 'demo/srv/assets'], { cwd: ROOT })
    .toString('utf8').split('\0').filter(Boolean);
  assert.ok(!tracked.includes('demo/srv/assets/houseplan-card.js'),
    'demo/srv/assets/houseplan-card.js снова в индексе: соберите его `npm run bundle:sync`, '
    + 'а из коммита уберите');
  // Остальное содержимое стенда (иконки, страницы) коммитится и должно остаться.
  assert.ok(tracked.length > 0, 'каталог стенда пуст: проверьте, что убрали только бандл');
});
