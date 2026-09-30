// База диапазона: до какого коммита назад считать, что «уже проверено»
// (issue #387 — классификация файлов, issue #388 — гейты диапазона).
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
// Два режима, и разница между ними только в фолбэке — см. `pickBase` и
// `pickRangeBase`. Классификация (#387) может опуститься до merge-base с dev;
// гейтам диапазона (#388) на пуше прямо в dev опускаться некуда, и там фолбэк
// остаётся прежним `before`, но с явной пометкой «недоказуемо».

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

/**
 * Ограничение обхода: на застоявшейся ветке rev-list бывает длинным, а ответ
 * при этом всё равно один — merge-base.
 */
export const MAX_CANDIDATES = 300;

/**
 * SHA прогонов, которые ДОШЛИ ДО КОНЦА — успешно или нет, но не отменённые.
 *
 * Разница с `greenShas` — суть issue #388, и я её сначала перепутал, чем уронил
 * dev. Классификация (#387) спрашивает «доказано ли, что тяжёлые гейты на этом
 * дереве прошли» — там нужен именно `success`. Гейты диапазона спрашивают
 * другое: «судил ли этот коммит хоть кто-нибудь». Упавший прогон коммит СУДИЛ,
 * просто вынес обвинительный вердикт, и переоткрывать его диапазоном не надо.
 *
 * Цена ошибки была наглядной: backend на dev красный несколько дней по своей
 * причине, поэтому «зелёных» прогонов не было вовсе, база уезжала на десятки
 * коммитов назад, и `no-new-any` начал предъявлять текущему пушу чужой долг.
 */
export function judgedShas(payload) {
  const runs = payload && Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
  return new Set(
    runs
      .filter((run) => run && run.status === 'completed' && run.conclusion !== 'cancelled'
        && typeof run.head_sha === 'string')
      .map((run) => run.head_sha),
  );
}

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
 * #703: коммиты, на которых стоит опубликованный тег релиза. Тег ставится
 * только на SHA с зелёным Validate на точном SHA (PROCESS.md §8), поэтому он —
 * такое же доказательство «этот материал судили», как прогон в списке API, и
 * при этом не зависит от окна в сто прогонов. Вход — строки
 * `git for-each-ref --format='%(refname:short) %(objectname) %(*objectname)' refs/tags`:
 * у аннотированного тега коммит — третье поле, у лёгкого — второе.
 */
export const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:-(?:beta|rc)\.[1-9]\d*)?$/;

export function releaseTaggedShas(forEachRefOutput) {
  const shas = new Set();
  for (const line of String(forEachRefOutput || '').split('\n')) {
    const [name, object, peeled] = line.trim().split(/\s+/);
    if (!name || !RELEASE_TAG.test(name)) continue;
    const commit = peeled || object;
    if (/^[0-9a-f]{40}$/.test(commit || '')) shas.add(commit);
  }
  return shas;
}

/**
 * #703: прогоны обеих интеграционных веток — одно множество. `main` получает
 * только SHA, уже прошедшие `dev` (PROCESS.md §2.8, §11), поэтому пуш в `main`
 * обязан видеть, что судилось на `dev`: иначе ближайший судимый предок —
 * прошлый stable, и вся бета-линия судится заново по сегодняшним правилам.
 */
export function mergeRunPayloads(payloads) {
  const runs = [];
  for (const payload of Array.isArray(payloads) ? payloads : []) {
    if (payload && Array.isArray(payload.workflow_runs)) runs.push(...payload.workflow_runs);
  }
  return { workflow_runs: runs };
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
  const found = firstGreen(candidates, green);
  if (found) return { ...found, reason: 'green-ancestor', proven: true };
  return {
    base: mergeBase,
    reason: 'merge-base',
    proven: false,
    skipped: capped(candidates).length,
  };
}

/** Кандидаты в пределах обхода. */
const capped = (candidates) =>
  (Array.isArray(candidates) ? candidates : []).slice(0, MAX_CANDIDATES);

/** Самый новый зелёный предок либо null. */
function firstGreen(candidates, green) {
  const list = capped(candidates);
  const proven = green instanceof Set ? green : new Set();
  for (let i = 0; i < list.length; i += 1) {
    if (proven.has(list[i])) return { base: list[i], skipped: i };
  }
  return null;
}

/**
 * База для гейтов, судящих САМ диапазон коммитов, — провенанс, процессный гейт,
 * `no-new-any` (issue #388). Отличие от классификации принципиальное, и оно в
 * фолбэке.
 *
 * У классификации есть естественный пол — merge-base с dev. У пуша прямо в dev
 * пола нет: merge-base совпадает с HEAD, и такой фолбэк дал бы ПУСТОЙ диапазон,
 * то есть молча проходящий гейт. Поэтому здесь фолбэк — `before` события, как
 * было до #388, но с явной пометкой «диапазон недоказуем».
 *
 * Почему не расширять диапазон, когда зелёного предка не нашлось. Расширение
 * кажется строже, но у него два своих провала: процессный гейт начал бы судить
 * старые коммиты по сегодняшним правилам, а главное — гейт, который сам красит
 * прогон, лишает следующий пуш зелёного предка и запирает dev в красноте
 * навсегда. Фолбэк обязан не зависеть от собственного успеха этого гейта.
 *
 * Дыра при этом не остаётся прежней: она сужается с «всегда, когда прогон
 * предыдущего пуша отменён» до «когда во всём окне обхода нет ни одного
 * успешного прогона». Первое случается ежедневно, второе — при сломанном CI,
 * где красный Validate и так уместен.
 */
export function pickRangeBase({
  candidates, green, fallback, head = '', headGreen = new Set(), tagged = new Set(),
}) {
  // #703: сам HEAD — граница, только если его уже оправдали: успешный Validate
  // на другом прогоне (промоушен в `main` SHA, проверенного на `dev`) или
  // опубликованный тег. Упавший прогон HEAD не в счёт: повтор обязан судить
  // тот же диапазон заново, иначе перезапуск красного SHA давал бы зелёный.
  if (head && (headGreen.has(head) || tagged.has(head))) {
    return { base: head, reason: 'head-proven', proven: true, skipped: 0 };
  }
  const judged = green instanceof Set ? green : new Set();
  const found = firstGreen(candidates, new Set([...judged, ...tagged]));
  if (found) {
    const reason = judged.has(found.base) ? 'green-ancestor' : 'release-tag';
    return { ...found, reason, proven: true };
  }
  return {
    base: fallback || '',
    reason: 'fallback',
    proven: false,
    skipped: capped(candidates).length,
  };
}

const short = (sha) => (typeof sha === 'string' ? sha.slice(0, 8) : '?');

/** Строки для summary: почему диапазон именно такой. */
export function baseSummary(choice, { head, mergeBase, mode = 'classify' }) {
  // Заголовок называет ЗАДАЧУ, а не режим кода: два потребителя задают разные
  // вопросы, и общий заголовок отправил бы читателя не в тот issue. На живом
  // прогоне #2157 это уже случилось — база диапазона представилась
  // классификацией.
  const heading = mode === 'range'
    ? '### База диапазона (#388)'
    : '### База классификации (#387)';
  if (choice.reason === 'green-ancestor') {
    const skipped = choice.skipped
      ? ` Пропущено коммитов без завершённого прогона: ${choice.skipped}.`
      : '';
    return [
      heading,
      `Диапазон \`${short(choice.base)}..${short(head)}\`: это самый новый предок,`
        + ` для которого Validate завершился успешно.${skipped}`,
    ];
  }
  if (choice.reason === 'head-proven') {
    return [
      heading,
      `Этот SHA \`${short(head)}\` уже оправдан успешным Validate или опубликованным`
        + ' тегом (#703): диапазон пуст, судить заново нечего. Так промоушен `dev → main`'
        + ' получает тот же вердикт, что и дерево на `dev`.',
    ];
  }
  if (choice.reason === 'release-tag') {
    const skipped = choice.skipped
      ? ` Пропущено коммитов без завершённого прогона: ${choice.skipped}.`
      : '';
    return [
      heading,
      `Диапазон \`${short(choice.base)}..${short(head)}\`: на \`${short(choice.base)}\``
        + ` стоит опубликованный тег релиза (#703), его материал уже судили.${skipped}`,
    ];
  }
  if (choice.reason === 'fallback') {
    return [
      heading,
      `Ни один из ${choice.skipped} предков не был судим завершённым Validate.`
        + ` Диапазон взят от \`${short(choice.base)}\` — головы предыдущего пуша,`
        + ' и это НЕ доказательство проверенности: прогон того пуша мог быть отменён.'
        + ' Коммиты в этом окне могли не пройти ни одного гейта.',
    ];
  }
  return [
    heading,
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
  const mode = arg(argv, 'mode', 'classify');
  const mergeBase = arg(argv, 'merge-base', mode === 'range' ? head : '');
  // `--runs=` можно повторить (#703): на интеграционных ветках — dev и main.
  const runsFiles = argv.filter((a) => a.startsWith('--runs=')).map((a) => a.slice(7)).filter(Boolean);
  if (!head || !mergeBase) {
    process.stderr.write('usage: classify-base.mjs --head=<sha>'
      + ' [--mode=classify|range] [--merge-base=<sha>] [--fallback=<sha>]'
      + ' [--name=<output>] [--runs=<file>]\n');
    process.exit(2);
  }
  const payload = mergeRunPayloads(runsFiles.map((file) => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      // Пустой или битый ответ — сознательно не ошибка: см. greenShas.
      return null;
    }
  }));
  // `--skip=1` убирает сам HEAD из предков: текущий прогон ещё идёт. В режиме
  // `range` у HEAD есть свой, более строгий вход — `headGreen` (#703): его
  // засчитывает только УСПЕШНЫЙ прогон того же SHA, например на `dev` перед
  // промоушеном в `main`.
  //
  // В режиме `range` (пуш прямо в dev или main) пола нет: обход идёт по истории до
  // предела MAX_CANDIDATES, потому что merge-base с dev здесь совпал бы с HEAD.
  const span = mode === 'range' ? head : `${mergeBase}..${head}`;
  const candidates = execFileSync('git', [
    'rev-list', `--max-count=${MAX_CANDIDATES}`, '--skip=1', span,
  ], { encoding: 'utf8' }).split('\n').map((line) => line.trim()).filter(Boolean);

  const choice = mode === 'range'
    ? pickRangeBase({
      candidates,
      green: judgedShas(payload),
      fallback: arg(argv, 'fallback'),
      head,
      headGreen: greenShas(payload),
      tagged: releaseTaggedShas(execFileSync('git', [
        'for-each-ref', '--format=%(refname:short) %(objectname) %(*objectname)', 'refs/tags',
      ], { encoding: 'utf8' })),
    })
    : pickBase({ candidates, green: greenShas(payload), mergeBase });
  const summary = baseSummary(choice, { head, mergeBase, mode });
  process.stdout.write(`${summary.join('\n')}\n`);
  // Имя выхода задаётся явно: одна и та же job считает базу для двух разных
  // потребителей, и общее имя `base` для обоих было бы ловушкой — потребитель
  // молча взял бы чужую базу, а разницу между режимами видно только здесь.
  const name = arg(argv, 'name', 'base');
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      `${name}=${choice.base}\n${name}_proven=${choice.proven}\n`);
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
