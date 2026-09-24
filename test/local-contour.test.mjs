import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #633. Локальный контур: bootstrap песочницы и хук pre-push. Сам bootstrap
// проверяется прогоном на песочнице (docs/DEVELOPMENT.md); здесь — то, что
// ломается молча: синтаксис, утечка путей владельца или учётных данных в
// публичный репозиторий и бит исполнения, без которого git пропускает хук.

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BOOTSTRAP = 'scripts/sandbox-bootstrap.sh';
const source = readFileSync(new URL(`../${BOOTSTRAP}`, import.meta.url), 'utf8');

test('sandbox-bootstrap не знает путей владельца и учётных данных (#633)', () => {
  for (const pattern of [/\/sessions\//, /\bMatysh\b/, /gh_pat/, /\.secrets/, /ghp_/, /credential/i, /[A-Z]:\\Users/, /\/home\/[a-z]/]) {
    assert.doesNotMatch(source, pattern, String(pattern));
  }
});

test('sandbox-bootstrap: шаги названы, Chromium — из npm, шим узнаётся по маркеру (#633)', () => {
  for (const step of ['worktree', 'deps', 'chromium', 'bundle', 'check', 'all']) {
    assert.match(source, new RegExp(`^  ${step}\\)`, 'm'), step);
  }
  assert.match(source, /@sparticuz\/chromium@152\.0\.0/);
  assert.match(source, /ms-playwright|executablePath\(\)/);
  assert.match(source, /npm run --silent bundle:sync/);
  assert.match(source, /SHIM_MARK=/);
  assert.match(source, /set -euo pipefail/);
});

test('sandbox-bootstrap.sh синтаксически корректен (#633)', (t) => {
  if (process.platform === 'win32' || spawnSync('bash', ['--version']).status !== 0) {
    t.skip('bash недоступен'); return;
  }
  const checked = spawnSync('bash', ['-n', BOOTSTRAP], { cwd: REPO, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  const help = spawnSync('bash', [BOOTSTRAP, 'help'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /HP_WORKTREE/);
  const unknown = spawnSync('bash', [BOOTSTRAP, 'nope'], { cwd: REPO, encoding: 'utf8' });
  assert.notEqual(unknown.status, 0);
});

test('хук pre-push и bootstrap исполняемы в индексе git (#633)', (t) => {
  const listed = spawnSync('git', ['-C', REPO, 'ls-files', '-s', '.githooks/pre-push', BOOTSTRAP], { encoding: 'utf8' });
  if (listed.status !== 0 || !listed.stdout.trim()) { t.skip('нет индекса git'); return; }
  const modes = Object.fromEntries(listed.stdout.trim().split('\n').map((row) => {
    const [meta, path] = row.split('\t');
    return [path, meta.split(' ')[0]];
  }));
  assert.equal(modes['.githooks/pre-push'], '100755');
  assert.equal(modes[BOOTSTRAP], '100755');
});
