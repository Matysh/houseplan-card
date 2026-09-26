// #657 (2б): стенд dev берёт бандл из артефакта Validate через ветку dev-build,
// а не из дерева dev, где бандл меняет только кандидат.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import {
  DEV_BUILD_MARKER, DEV_BUILD_TARGET, parseArgs, publishDevBuild,
} from '../scripts/dev-build.mjs';

const STAND = fileURLToPath(new URL('../demo/stand/update-dev-bundle.sh', import.meta.url));
const ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...ENV },
}).trim();
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

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
  mkdirSync(join(work, DEV_BUILD_TARGET), { recursive: true });
  writeFileSync(join(work, DEV_BUILD_TARGET, 'houseplan-card.js'), 'card of the last beta');
  writeFileSync(join(work, DEV_BUILD_TARGET, 'houseplan-assets.json'), '{}\n');
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
