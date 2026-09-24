#!/usr/bin/env node
/**
 * Все сторонние Actions закреплены полным immutable SHA (#556).
 *
 * Перемещаемая ссылка в `uses:` — это доверие чужому владельцу тега здесь и
 * сейчас, а не коду, который читали. До этой правки конвейер брал
 * `home-assistant/actions/hassfest@master` и `hacs/action@main` — то есть
 * произвольный будущий коммит чужой ветки, — а ревьюера с Read/Write/Bash
 * запускал `anthropics/claude-code-action@v1`, перемещаемый major.
 *
 * Проверка механическая и потому не врёт: `uses:` обязан быть либо локальным
 * (`./.github/…`), либо `<owner>/<repo>[/<path>]@<40 hex>` с комментарием, где
 * записана человекочитаемая версия — то, что при обновлении сверяет человек.
 *
 * Одно исключение (#623): тело workflow этого же репозитория из ветки `dev` —
 * `Matysh/houseplan-card/.github/workflows/_<имя>.yml@dev`. Для событий
 * `issues`/`schedule`/`workflow_run` GitHub исполняет файл из `main`, а локальный
 * `./…` взял бы тело из того же коммита `main` — и правку конвейера снова
 * пришлось бы зеркалить. Это не чужой код: `dev` — наша ветка, её коммиты
 * проходят тот же процессный гейт и ревью, что и всё остальное. Исключение
 * узкое: только этот репозиторий, только `_*.yml` в `.github/workflows`, только
 * ссылка `@dev` и только с комментарием о причине. Любой другой ref или
 * репозиторий — прежняя находка.
 *
 *   node scripts/action-pins.mjs            # проверить
 *   node scripts/action-pins.mjs --list     # что и к чему закреплено
 *
 * Обновление пина: посмотреть, что сейчас стоит за тегом
 * `gh api repos/<owner>/<repo>/commits/<tag> -q .sha`, прочитать дельту от
 * закреплённого SHA и заменить обе части — SHA и комментарий — одним коммитом.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WORKFLOW_DIR = '.github/workflows';
const USES = /^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/;

/** Локальная переиспользуемая workflow — не сторонний код, пина не требует. */
export const isLocal = (spec) => spec.startsWith('./');
/** #623: тело workflow этого репозитория из `dev` — наш код, а не сторонний. */
export const OWN_DEV_REUSABLE = /^Matysh\/houseplan-card\/\.github\/workflows\/_[\w.-]+\.ya?ml@dev$/;
export const isOwnDevReusable = (spec) => OWN_DEV_REUSABLE.test(spec);
export const isPinned = (spec) => /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(spec);
/** Комментарий обязателен: без него человек не знает, какую версию он закрепил. */
export const hasVersionNote = (tail) => /#\s*\S/.test(tail);

export function auditWorkflowSource(file, source) {
  const problems = [];
  source.split('\n').forEach((line, index) => {
    const match = USES.exec(line);
    if (!match) return;
    const [, spec, tail] = match;
    const at = `${file}:${index + 1}`;
    if (isLocal(spec)) return;
    if (isOwnDevReusable(spec)) {
      if (!hasVersionNote(tail)) problems.push(`${at}: «${spec}» без комментария с причиной ссылки на dev`);
      return;
    }
    if (!isPinned(spec)) {
      problems.push(`${at}: «${spec}» не закреплён полным SHA`);
      return;
    }
    if (!hasVersionNote(tail)) {
      problems.push(`${at}: «${spec}» без комментария с версией`);
    }
  });
  return problems;
}

export function listWorkflows(root = ROOT) {
  return readdirSync(resolve(root, WORKFLOW_DIR))
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();
}

export function auditRepository(root = ROOT) {
  const problems = [];
  for (const name of listWorkflows(root)) {
    const file = `${WORKFLOW_DIR}/${name}`;
    problems.push(...auditWorkflowSource(file, readFileSync(resolve(root, file), 'utf8')));
  }
  return problems;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  if (process.argv.includes('--list')) {
    for (const name of listWorkflows()) {
      const file = `${WORKFLOW_DIR}/${name}`;
      for (const line of readFileSync(resolve(ROOT, file), 'utf8').split('\n')) {
        const match = USES.exec(line);
        if (match && !isLocal(match[1])) console.log(`${file}: ${match[1]}${match[2]}`);
      }
    }
    process.exit(0);
  }
  const problems = auditRepository();
  if (problems.length) {
    for (const problem of problems) console.error(`::error::${problem}`);
    console.error(`не закреплено: ${problems.length}`);
    process.exit(1);
  }
  console.log('все сторонние Actions закреплены полным SHA');
}
