// #634: таблица Snapshot в docs/STATUS.md генерируется из дерева и git.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  BEGIN, END, VERSION_FILES, blockDate, collectSnapshot, latestTags, renderSnapshot, replaceBlock, summarizeVersions,
} from '../scripts/status-snapshot.mjs';

const put = (root, rel, text) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const git = (root, args, date) => {
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', env });
  assert.equal(run.status, 0, run.stderr);
};
// Фикстура кладёт каждый источник версии по пути из VERSION_FILES — того же
// списка, по которому читает генератор.
const writeVersions = (root, version) => {
  const content = {
    packageJson: JSON.stringify({ name: 'x', version }),
    packageLock: JSON.stringify({ version, packages: { '': { version } } }),
    manifest: JSON.stringify({ version }),
    constSource: `DOMAIN = "houseplan"\nVERSION = "${version}"\n`,
    cardSource: `const CARD_VERSION = '${version}';\n`,
    editorRuntimeSource: `const CARD_VERSION = '${version}';\n`,
  };
  assert.deepEqual(Object.keys(content).sort(), Object.keys(VERSION_FILES).sort());
  for (const [key, rel] of Object.entries(VERSION_FILES)) put(root, rel, content[key]);
};
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hp-status-'));
  writeVersions(root, '1.2.0');
  put(root, 'test/a.test.mjs', "test('a', () => {});\ntest('b', () => {});\n");
  put(root, 'tests_backend/test_pure.py', 'def test_one():\n    pass\n');
  put(root, 'tests_backend/test_ha_x.py', 'async def test_ha():\n    pass\n');
  put(root, 'demo/smoke_one.mjs', '');
  put(root, 'demo/smoke_two.mjs', '');
  git(root, ['init', '-q']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'one'], '2026-09-01T10:00:00Z');
  git(root, ['tag', '-a', 'v1.2.0', '-m', 'stable'], '2026-09-01T10:00:00Z');
  writeVersions(root, '1.3.0-beta.1');
  git(root, ['commit', '-qam', 'two'], '2026-09-02T10:00:00Z');
  git(root, ['tag', '-a', 'v1.3.0-beta.1', '-m', 'beta'], '2026-09-02T10:00:00Z');
  put(root, 'README.md', 'x\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'three'], '2026-09-03T10:00:00Z');
  return root;
}

test('#634 status-snapshot: версии, теги и счётчики берутся из дерева и git', () => {
  const root = fixture();
  try {
    const snapshot = collectSnapshot(root, { date: '2026-09-24' });
    assert.deepEqual(snapshot.tags, { stable: 'v1.2.0', prerelease: 'v1.3.0-beta.1' });
    assert.deepEqual(snapshot.versions, { version: '1.3.0-beta.1', sources: 7, mismatches: [] });
    assert.deepEqual(snapshot.tests.map((row) => row.count), [2, 1, 1, 2]);
    const block = renderSnapshot(snapshot);
    assert.ok(block.startsWith(`${BEGIN}\n`) && block.endsWith(`\n${END}`));
    assert.match(block, /\| Version \| \*\*1\.3\.0-beta\.1\*\* in all 7 version sources/);
    assert.match(block, /\| Latest stable tag \| `v1\.2\.0` \|/);
    assert.match(block, /\| Latest prerelease tag \| `v1\.3\.0-beta\.1` \|/);
    assert.match(block, /\| Tests \| Node unit 2 · pure backend 1 · HA-harness backend 1 · browser smokes 2 /);
    assert.equal(blockDate(block), '2026-09-24');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('#634 status-snapshot: рассинхрон версий виден в таблице, а не сглажен', () => {
  const sources = { 'package.json': '1.3.0', 'custom_components/houseplan/const.py': '1.2.9', 'package-lock.json': '1.3.0' };
  const summary = summarizeVersions(sources);
  assert.deepEqual(summary, { version: '1.3.0', sources: 3, mismatches: ['custom_components/houseplan/const.py="1.2.9"'] });
  const block = renderSnapshot({ date: '2026-09-24', versions: summary, tags: { stable: null, prerelease: null }, tests: [] });
  assert.match(block, /\| Version \| \*\*1\.3\.0\*\* — NOT synchronized: custom_components\/houseplan\/const\.py="1\.2\.9" \|/);
  assert.match(block, /\| Latest stable tag \| n\/a — tags are not available/);
});

test('#634 status-snapshot: последние теги — по дате создания, стабильный отдельно от пре-релиза', () => {
  assert.deepEqual(latestTags(['v1.78.0-beta.1', 'v1.77.0', 'v1.77.0-beta.5', 'not-a-tag']),
    { stable: 'v1.77.0', prerelease: 'v1.78.0-beta.1' });
  assert.deepEqual(latestTags([]), { stable: null, prerelease: null });
});

test('#634 status-snapshot: --write заменяет только блок, без маркеров — отказ', () => {
  const block = `${BEGIN}\n| Item | State |\n${END}`;
  const text = `# S\n\n${BEGIN}\nold\n${END}\n\n## Rest\nkept\n`;
  const next = replaceBlock(text, block);
  assert.equal(next, `# S\n\n${block}\n\n## Rest\nkept\n`);
  assert.equal(replaceBlock(next, block), next, 'идемпотентно');
  assert.throws(() => replaceBlock('# S\n', block), /expected exactly one/);
  assert.throws(() => replaceBlock(`${text}${BEGIN}\n${END}\n`, block), /expected exactly one/);
});

test('#634 status-snapshot: docs/STATUS.md несёт один сгенерированный блок той же формы', () => {
  const status = readFileSync(new URL('../docs/STATUS.md', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
  const start = status.indexOf(BEGIN);
  const end = status.indexOf(END);
  assert.ok(start > 0 && end > start, 'блок на месте');
  assert.equal(status.indexOf(BEGIN, start + 1), -1, 'блок один');
  const committed = status.slice(start, end + END.length);
  const labels = (block) => block.split('\n').filter((line) => line.startsWith('| ')).map((line) => line.split('|')[1].trim());
  const fresh = renderSnapshot({ date: blockDate(committed), versions: { version: 'x', sources: 7, mismatches: [] },
    tags: { stable: null, prerelease: null }, tests: [] });
  assert.deepEqual(labels(committed), labels(fresh), 'строки блока — ровно те, что рисует генератор');
  assert.ok(blockDate(committed), 'дата генерации в блоке');
  // Статус задач живёт только в метках: генератор меток не читает и в прозе их нет.
  assert.doesNotMatch(committed, /S[1-8]-[a-z]/);
});
