// База для классификации изменённых файлов (issue #387).
//
// Job `changes` решает, запускать ли тяжёлые гейты, по списку файлов в
// диапазоне. Раньше диапазон брался от `github.event.before` — головы ветки на
// момент ПРЕДЫДУЩЕГО push. Это молчаливое допущение: «то, что было до, уже
// проверено». Допущение неверно ровно тогда, когда прогон предыдущего пуша не
// завершился, — а он не завершается штатно, потому что concurrency отменяет
// его следующим пушем.
//
// Так вышло на #86 (r5): push `04da7eb1` тронул dist/** и frontend/**, его
// прогон отменили через три минуты; следующий push `fa146fb1` тронул только
// docs/images/**, классификация сравнила эти два коммита, выставила
// frontend=false — и job «Фронтенд», а за ней golden, smoke и backend оказались
// skipped. Прогон при этом success. Зелёный статус ветки не подтверждался
// исполнением ни одного тяжёлого гейта.
//
// Здесь допущение заменяется проверяемым фактом: база — самый новый предок
// HEAD, для которого Validate ДЕЙСТВИТЕЛЬНО завершился успешно; если такого
// нет — merge-base с dev, то есть весь вклад ветки.
//
// Почему этого достаточно — индукция. Если каждое звено цепочки
// «предыдущий зелёный → текущий» классифицировано от зелёного предка, то
// объединение диффов покрывает всё, что ветка изменила с последней настоящей
// проверки. Одно незавершённое звено рвёт цепочку — и именно оно теперь
// заставляет расширить диапазон, а не сузить.
//
// `github.event.before` больше не читается вовсе. Отдельная ветка про
// force-push (#347) поэтому не нужна: кандидаты берутся из `rev-list
// <merge-base>..HEAD`, то есть предки HEAD по построению, а переписанная
// история просто не даёт зелёных совпадений и опускает базу до merge-base.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

/**
 * Ограничение обхода: на застоявшейся ветке rev-list бывает длинным, а ответ
 * при этом всё равно один — merge-base.
 */
export const MAX_CANDIDATES = 300;

/**
 * SHA прогонов, завершившихся успешно. Вход — тело ответа
 * `/actions/workflows/validate.yml/runs`; всё, что не массив прогонов,
 * считается пустым списком: недоступность API обязана вести к более широкому
 * диапазону, а не к падению job.
 */
export function greenShas(payload) {
  const runs = payload && Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
  return new Set(
    runs
      .filter((run) => run && run.conclusion === 'success' && typeof run.head_sha === 'string')
      .map((run) => run.head_sha),
  );
}

/**
 * Выбор базы.
 *
 * @param candidates SHA предков HEAD от новых к старым, БЕЗ самого HEAD:
 *                   у текущего пуша зелёного прогона быть не может — он идёт.
 * @param green      множество SHA с успешным Validate.
 * @param mergeBase  merge-base с dev: пол, ниже которого опускаться незачем.
 */
export function pickBase({ candidates, green, mergeBase }) {
  const list = Array.isArray(candidates) ? candidates.slice(0, MAX_CANDIDATES) : [];
  const proven = green instanceof Set ? green : new Set();
  for (let i = 0; i < list.length; i += 1) {
    if (proven.has(list[i])) {
      return { base: list[i], reason: 'green-ancestor', proven: true, skipped: i };
    }
  }
  return { base: mergeBase, reason: 'merge-base', proven: false, skipped: list.length };
}

const short = (sha) => (typeof sha === 'string' ? sha.slice(0, 8) : '?');

/** Строки для summary: почему диапазон именно такой. */
export function baseSummary(choice, { head, mergeBase }) {
  if (choice.reason === 'green-ancestor') {
    const skipped = choice.skipped
      ? ` Пропущено коммитов без завершённого прогона: ${choice.skipped}.`
      : '';
    return [
      '### База классификации (#387)',
      `Диапазон \`${short(choice.base)}..${short(head)}\`: это самый новый предок,`
        + ` для которого Validate завершился успешно.${skipped}`,
    ];
  }
  return [
    '### База классификации (#387)',
    'Ни у одного предка до merge-base с dev нет завершённого зелёного Validate,'
      + ` поэтому диапазон расширен до \`${short(mergeBase)}..${short(head)}\` —`
      + ' весь вклад ветки. Узкий диапазон здесь означал бы «проверено» про то,'
      + ' чего никто не проверял.',
  ];
}

const arg = (argv, name, fallback = '') =>
  (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || fallback;

function main(argv) {
  const head = arg(argv, 'head');
  const mergeBase = arg(argv, 'merge-base');
  const runsFile = arg(argv, 'runs');
  if (!head || !mergeBase) {
    process.stderr.write('usage: classify-base.mjs --head=<sha> --merge-base=<sha> [--runs=<file>]\n');
    process.exit(2);
  }
  let payload = null;
  if (runsFile) {
    try {
      payload = JSON.parse(readFileSync(runsFile, 'utf8'));
    } catch {
      // Пустой или битый ответ — сознательно не ошибка: см. greenShas.
      payload = null;
    }
  }
  // `--skip=1` убирает сам HEAD: его прогон — это текущий, зелёным он быть не
  // может по определению.
  const candidates = execFileSync('git', [
    'rev-list', `--max-count=${MAX_CANDIDATES}`, '--skip=1', `${mergeBase}..${head}`,
  ], { encoding: 'utf8' }).split('\n').map((line) => line.trim()).filter(Boolean);

  const choice = pickBase({ candidates, green: greenShas(payload), mergeBase });
  const summary = baseSummary(choice, { head, mergeBase });
  process.stdout.write(`${summary.join('\n')}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `base=${choice.base}\nproven=${choice.proven}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n\n')}\n`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('classify-base.mjs')) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`classify-base: ${err.message}\n`);
    process.exit(1);
  }
}
