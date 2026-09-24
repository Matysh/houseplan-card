// #623: workflow, которые GitHub исполняет из ветки по умолчанию.
//
// Для `issues`, `schedule`, `workflow_run` и ещё ряда событий GitHub берёт файл
// workflow только из `main`. До #623 тела конвейера лежали в этих файлах
// целиком, и каждая правка требовала зеркального коммита в `main`: 26 mirror-
// коммитов и 13 merge-back за месяц, а preflight сверял 3 файла из 6.
//
// Теперь в `main` живут тонкие вызывающие файлы — триггеры, run-name, права,
// concurrency, — а тело `_<имя>.yml` они вызывают по ссылке `@dev`. Этот тест
// держит проводку: каждый такой файл тонкий, вызывает своё тело из dev, передаёт
// секреты и входы, не расширяет права, а preflight сверяет ровно их.
//
// Полноценного YAML-парсера в зависимостях нет (см. scripts/workflow-jobs.mjs):
// разбирается ровно та блочная структура, которую пишут эти файлы; всё
// неожиданное — громкая ошибка разбора, а не догадка.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DIR = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const read = (name) => readFileSync(join(DIR, name), 'utf8');
const OWN_REPO = 'Matysh/houseplan-card';

// События, для которых GitHub берёт workflow из ветки по умолчанию (или из базы
// PR — `pull_request_target`), а не из коммита, который их породил.
const DEFAULT_BRANCH_EVENTS = new Set([
  'branch_protection_rule', 'check_run', 'check_suite', 'delete', 'discussion',
  'discussion_comment', 'fork', 'gollum', 'issue_comment', 'issues', 'label',
  'milestone', 'page_build', 'project', 'project_card', 'project_column', 'public',
  'pull_request_target', 'registry_package', 'repository_dispatch', 'schedule',
  'status', 'watch', 'workflow_run',
]);

// performance.yml по расписанию судит `main` собственным телом из `main`:
// исполняемая копия и есть та, что лежит рядом с проверяемым кодом.
const SELF_CONSISTENT = new Set(['performance.yml']);

const isComment = (line) => !line.trim() || line.trimStart().startsWith('#');
const indentOf = (line) => line.length - line.trimStart().length;

/** Верхнеуровневые блоки: ключ → строки блока без строки-заголовка. */
function topBlocks(text) {
  const blocks = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    if (isComment(line) && indentOf(line) === 0) { if (current && !line.trim()) current.push(line); continue; }
    const key = /^([\w-]+):(.*)$/.exec(line);
    if (key && indentOf(line) === 0) {
      current = [];
      blocks.set(key[1], current);
      if (key[2].trim() && !/^\s*#/.test(key[2])) current.push(`  ${key[2].trim()}`);
      continue;
    }
    if (current) current.push(line);
  }
  return blocks;
}

/** Ключи на заданном отступе внутри блока: ключ → строки под ним. */
function children(lines, indent) {
  const out = new Map();
  let current = null;
  for (const line of lines) {
    if (isComment(line)) continue;
    const at = indentOf(line);
    if (at < indent) break;
    if (at === indent) {
      const key = /^\s*([\w-]+):\s*(.*?)\s*(?:#.*)?$/.exec(line);
      assert.ok(key, `не разобрана строка ${JSON.stringify(line)}`);
      current = [];
      out.set(key[1], current);
      if (key[2]) current.value = key[2];
      continue;
    }
    if (current) current.push(line);
  }
  return out;
}

/** Плоская карта `scope: level` на заданном отступе. */
function permissionMap(lines, indent) {
  const map = {};
  for (const [scope, rest] of children(lines, indent)) {
    assert.equal(rest.length, 0, `права ${scope}: вложенность не ожидается`);
    map[scope] = rest.value;
  }
  return map;
}

const LEVEL = { none: 0, read: 1, write: 2 };
function unionPermissions(maps) {
  const out = {};
  for (const map of maps) {
    for (const [scope, level] of Object.entries(map)) {
      assert.ok(level in LEVEL, `уровень ${scope}: ${level}`);
      if (!(scope in out) || LEVEL[level] > LEVEL[out[scope]]) out[scope] = level;
    }
  }
  return out;
}
const sorted = (map) => Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));

function triggers(name) {
  const on = topBlocks(read(name)).get('on');
  assert.ok(on, `${name}: нет блока on:`);
  assert.ok(!on.some((line) => /^\s{2}\[/.test(line)), `${name}: on: в строку не поддерживается`);
  return [...children(on, 2).keys()];
}

const workflows = readdirSync(DIR).filter((name) => /\.ya?ml$/.test(name)).sort();
const bodies = workflows.filter((name) => name.startsWith('_'));
const fromDefaultBranch = workflows
  .filter((name) => !name.startsWith('_') && triggers(name).some((event) => DEFAULT_BRANCH_EVENTS.has(event)));
const THIN = fromDefaultBranch.filter((name) => !SELF_CONSISTENT.has(name));

function syncList() {
  const validate = read('validate.yml');
  const step = validate.slice(validate.indexOf('id: workflow_sync'));
  const loop = /for file in ([^;\n]+); do/.exec(step);
  assert.ok(loop, 'preflight workflow_sync перебирает список файлов');
  return loop[1].trim().split(/\s+/);
}

test('#623: исполняемые из main файлы найдены по триггерам, а не по памяти', () => {
  assert.deepEqual(THIN, [
    'mutation-gate.yml', 'nightly.yml', 'process-metrics.yml', 'process-reconcile.yml',
    'process-resume.yml', 'process.yml',
  ]);
  for (const name of SELF_CONSISTENT) assert.ok(fromDefaultBranch.includes(name), `${name}: исключение без причины`);
});

test('#623: preflight сверяет в main и dev ровно тонкие вызывающие файлы', () => {
  const list = syncList();
  assert.equal(new Set(list).size, list.length, 'в списке сверки нет повторов');
  assert.deepEqual([...list].sort(), THIN, 'список сверки = файлы, исполняемые из main');
});

test('#623: performance.yml из main судит main — сверка ему не нужна', () => {
  const name = 'performance.yml';
  const events = triggers(name).filter((event) => DEFAULT_BRANCH_EVENTS.has(event));
  assert.deepEqual(events, ['schedule'], 'из ветки по умолчанию — только расписание');
  const text = read(name);
  assert.match(text, /push:\n\s+branches:\n\s+- main\n/);
  assert.ok(!/ref: dev\b/.test(text), 'кандидат — коммит самого прогона, а не голова dev');
});

for (const name of THIN) {
  const body = `_${name}`;

  test(`#623: ${name} — тонкий файл, вызывающий ${body} из dev`, () => {
    const caller = topBlocks(read(name));
    for (const key of caller.keys()) {
      assert.ok(['name', 'run-name', 'on', 'permissions', 'concurrency', 'jobs'].includes(key), `${name}: лишний ключ ${key}`);
    }
    const jobs = children(caller.get('jobs'), 2);
    assert.equal(jobs.size, 1, `${name}: ровно одна вызывающая job`);
    const [job] = jobs.values();
    const keys = children(job, 4);
    for (const key of keys.keys()) {
      assert.ok(['name', 'if', 'permissions', 'uses', 'with', 'secrets'].includes(key), `${name}: у вызывающей job лишний ключ ${key}`);
    }
    assert.equal(keys.get('uses')?.value, `${OWN_REPO}/.github/workflows/${body}@dev`, `${name}: тело берётся из dev`);
    assert.equal(keys.get('secrets')?.value, 'inherit', `${name}: секреты тела наследуются`);
    assert.ok(existsSync(join(DIR, body)), `${body} существует`);
  });

  test(`#623: ${body} — только workflow_call, без run-name и concurrency уровня workflow`, () => {
    const blocks = topBlocks(read(body));
    assert.deepEqual(triggers(body), ['workflow_call'], `${body}: не запускается сам по себе`);
    assert.ok(!blocks.has('run-name'), `${body}: run-name живёт у вызывающего`);
    assert.ok(!blocks.has('concurrency'), `${body}: concurrency уровня workflow живёт у вызывающего`);
    assert.ok(!/\$\{\{[^}]*\bgithub\.workflow_sha\b/.test(read(body)),
      `${body}: в вызываемом workflow github.workflow_sha — SHA вызывающего из main, не тела`);
  });

  test(`#623: ${name} не расширяет права тела и не сужает их`, () => {
    const caller = topBlocks(read(name));
    const callee = topBlocks(read(body));
    const callerTop = permissionMap(caller.get('permissions'), 2);
    const calleeTop = permissionMap(callee.get('permissions'), 2);
    assert.deepEqual(sorted(callerTop), sorted(calleeTop), 'права уровня workflow совпадают');
    const effective = [...children(callee.get('jobs'), 2).values()].map((job) => {
      const own = children(job, 4).get('permissions');
      return own ? permissionMap(own, 6) : calleeTop;
    });
    const [callerJob] = children(caller.get('jobs'), 2).values();
    const granted = permissionMap(children(callerJob, 4).get('permissions') || [], 6);
    assert.deepEqual(sorted(granted), sorted(unionPermissions(effective)),
      'потолок вызывающей job = объединение прав job тела: шире — лишнее, уже — отказ GitHub на старте');
  });

  test(`#623: ${name} передаёт телу каждый вход ручного запуска`, () => {
    const caller = topBlocks(read(name));
    const dispatch = children(caller.get('on'), 2).get('workflow_dispatch') || [];
    const dispatchInputs = [...(children(dispatch, 4).get('inputs') ? children(children(dispatch, 4).get('inputs'), 6).keys() : [])];
    const call = children(topBlocks(read(body)).get('on'), 2).get('workflow_call') || [];
    const callInputs = [...(children(call, 4).get('inputs') ? children(children(call, 4).get('inputs'), 6).keys() : [])];
    assert.deepEqual(callInputs.sort(), [...dispatchInputs].sort(), `${body}: те же входы, что у ручного запуска`);
    const [callerJob] = children(caller.get('jobs'), 2).values();
    const withBlock = children(callerJob, 4).get('with') || [];
    const forwarded = children(withBlock, 6);
    assert.deepEqual([...forwarded.keys()].sort(), [...dispatchInputs].sort(), `${name}: передаётся каждый вход`);
    for (const [input, rest] of forwarded) {
      assert.match(rest.value, new RegExp(`^\\$\\{\\{ inputs\\.${input}\\b`), `${name}: ${input} берётся из входа запуска`);
    }
  });

  test(`#623: фильтр вызывающей job ${name} совпадает с фильтром тела`, () => {
    const [callerJob] = children(topBlocks(read(name)).get('jobs'), 2).values();
    const condition = children(callerJob, 4).get('if')?.value;
    if (!condition) return;
    const [first] = children(topBlocks(read(body)).get('jobs'), 2).values();
    assert.equal(children(first, 4).get('if')?.value, condition,
      `${name}: if повторяет стража тела — иначе посторонние события либо поднимут тело, либо потеряют запуск`);
  });
}

test('#623: у каждого тела есть свой тонкий вызывающий, других вызовов нет', () => {
  assert.deepEqual(bodies, THIN.map((name) => `_${name}`).sort());
  for (const name of workflows) {
    const calls = [...read(name).matchAll(/uses:\s*(\S*\/\.github\/workflows\/_[\w.-]+\.ya?ml@\S+|\.\/\.github\/workflows\/_[\w.-]+\.ya?ml)/g)]
      .map((match) => match[1]);
    const expected = THIN.includes(name) ? [`${OWN_REPO}/.github/workflows/_${name}@dev`] : [];
    assert.deepEqual(calls, expected, `${name}: тела вызываются только своими тонкими файлами`);
  }
});
