// #706: исход rereview возвращает задачу в ту же метку `S7-code-review`, и
// одним вызовом `gh` она добавлялась и тут же снималась — задача оставалась без
// статуса, новый заход не стартовал.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { moveStatusLabel } from '../scripts/status-label.mjs';

const REPO = 'Matysh/houseplan-card';
const recorder = (fail = () => false) => {
  const calls = [];
  const execute = (args, opts = {}) => {
    calls.push(args.slice(5).join(' '));
    const status = fail(args, calls.length) ? 1 : 0;
    if (status && !opts.allowFailure) throw new Error(`gh ${args.join(' ')} → boom`);
    return { status, stderr: status ? 'boom' : '' };
  };
  return { calls, execute };
};

test('#706 rereview: та же метка снимается и ставится заново отдельными вызовами', () => {
  const { calls, execute } = recorder();
  const how = moveStatusLabel({ repo: REPO, issue: 699, from: 'S7-code-review', to: 'S7-code-review', execute });
  assert.equal(how, 'relabeled');
  assert.deepEqual(calls, ['--remove-label S7-code-review', '--add-label S7-code-review'],
    'снятие, затем постановка — событие labeled запускает новый заход');
});

test('#706 обычный исход — одна правка: новая метка ставится, прежняя снимается', () => {
  const { calls, execute } = recorder();
  assert.equal(moveStatusLabel({ repo: REPO, issue: 700, from: 'S7-code-review', to: 'S8-merged', execute }), 'moved');
  assert.deepEqual(calls, ['--add-label S8-merged --remove-label S7-code-review']);
  const none = recorder();
  moveStatusLabel({ repo: REPO, issue: 700, from: '', to: 'S6-in-progress', execute: none.execute });
  assert.deepEqual(none.calls, ['--add-label S6-in-progress'], 'без исходной метки снимать нечего');
});

test('#706 сбой повторной постановки роняет шаг, а не оставляет задачу без статуса молча', () => {
  const once = recorder((args, n) => n === 2);
  moveStatusLabel({ repo: REPO, issue: 699, from: 'S7-code-review', to: 'S7-code-review', execute: once.execute });
  assert.deepEqual(once.calls, ['--remove-label S7-code-review', '--add-label S7-code-review', '--add-label S7-code-review'],
    'одна попытка восстановления, как в автосверке (#555)');
  const always = recorder((args) => args.includes('--add-label'));
  assert.throws(() => moveStatusLabel({ repo: REPO, issue: 699, from: 'S7-code-review', to: 'S7-code-review', execute: always.execute }),
    /could not restore S7-code-review/);
  assert.throws(() => moveStatusLabel({ repo: REPO, issue: 699, from: 'S7-code-review', to: '', execute: always.execute }), /usage/);
});

test('#706 шаг конвейера переставляет метку через скрипт, а не одним вызовом gh', () => {
  const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/_process.yml', import.meta.url)), 'utf8');
  const step = workflow.slice(workflow.indexOf('- name: Переставить метку'), workflow.indexOf('- name: Сводка длительности стадий'));
  assert.ok(step.length > 0, 'шаг найден');
  assert.match(step, /node scripts\/status-label\.mjs --repo="\$\{\{ github\.repository \}\}" \\\n\s+--issue="\$NUM" --from="\$FROM" --to="\$TO"/);
  assert.doesNotMatch(step, /gh issue edit/, 'совмещённый вызов снимал ту же метку, которую ставил');
});
