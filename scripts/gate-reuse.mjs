// Ключ переиспользования результата тяжёлой job (issue #208).
//
// Reusable job Validate — smoke, golden, performance_smoke, geometry_parity,
// backend — прогонялись
// на каждый push в dev, включая коммиты в документацию, workflows и процессные
// скрипты, где бандл и оснастка побайтово те же. Ключ здесь отвечает на один
// вопрос: «менялось ли хоть что-то, от чего результат этой job зависит».
//
// Ключ = хеш содержимого ВСЕХ входов job по единому manifest (#492,
// scripts/check-inputs.mjs): исходники, которые job собирает, тесты и их
// обёртки, фикстуры, конфиги инструментов, toolchain и протокол харнеса.
// Совпал ключ с прогоном, который завершился успешно, — повторять нечего;
// не совпал — гоняем.
//
// Почему это не фильтры путей из job `changes` (на dev они намеренно
// отключены): там объём прогона угадывается по путям, и «зелёный» начинает
// значить разное. Здесь эквивалентность входов ДОКАЗАНА хешем, а маркер успеха
// пишет только успешный прогон с тем же ключом.
//
// Свойство, которое стоит знать: релизный кандидат (бета или стабильный релиз)
// бампает версию — `package.json`/`CARD_VERSION` у браузерных job,
// `package.json` у geometry_parity и `custom_components/houseplan/manifest.json`
// у backend входят в manifest.
// Значит ключ кандидата заведомо новый и полный набор гейтов прогоняется всегда.
// Переиспользование физически не может ослабить релизный гейт.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { REUSE_JOBS, inputsOf } from './check-inputs.mjs';

/**
 * Входы каждой job — из единого manifest (#492 §5.3). Прежний `HARNESS`
 * перечислял оснастку руками и молчал о том, чего не знал: relay, converter,
 * schema у backend; `serve.mjs`, `demo.html`, compat-хелперы у golden/perf.
 * Теперь список ВЫЧИСЛЯЕТСЯ: корни проверки плюс замыкание её точек входа по
 * импортам и путям (см. check-inputs.mjs). `src/**` входит только туда, где
 * бандл собирается и исполняется, — backend от UI больше не зависит.
 */
export const JOBS = REUSE_JOBS;

/** Файлы, от которых зависит результат job, в порядке, не зависящем от ФС. */
export function harnessFiles(root, job) {
  if (!JOBS.includes(job)) throw new Error(`неизвестная job: ${job}. Известны: ${JOBS.join(', ')}`);
  return inputsOf(job, root);
}

/**
 * Ключ переиспользования: имя job + содержимое всех её входов. Пустой список
 * не молчит: он означал бы job без входов, и такую подмену лучше заметить.
 */
export function reuseKey(root, job) {
  const files = harnessFiles(root, job);
  if (!files.length) throw new Error(`входы job ${job} пусты — проверьте CHECKS в check-inputs.mjs`);
  const hash = createHash('sha256');
  hash.update(`job:${job}\0`);
  for (const rel of files) {
    const abs = resolve(root, rel);
    if (!existsSync(abs)) continue;
    hash.update(rel);
    hash.update('\0');
    // Текст канонизируется по переводам строк, бинарное берётся как есть:
    // иначе Windows и Linux дали бы разные ключи на одном дереве.
    const raw = readFileSync(abs);
    const text = raw.includes(0) ? raw : Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'));
    hash.update(text);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * Маркер падения (issue #386). Маркер успеха отвечает на вопрос «прогонять ли
 * снова», этот — на другой: «с какого коммита эта job красная».
 *
 * Разница видна в почте. Упавший прогон маркера успеха не пишет, поэтому
 * следующий коммит гонит job заново и падает так же — и письмо «Run failed»
 * называет того, кто пушнул следующим. 29 августа так был назван `0f7b6f5`,
 * документ ревью, который не мог изменить ни одного пикселя: сцену без эталона
 * добавил `dbbe94ae` четырьмя коммитами раньше.
 *
 * Ключ здесь тот же, что у маркера успеха, а значит совпадение ключа доказывает
 * равенство входов. Само падение при этом не кэшируется: job прогоняется всегда,
 * иначе починка осталась бы незамеченной. Меняется только формулировка.
 */
export function parseFailureMarker(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const field = (name) => text.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim() || '';
  const sha = field('SHA');
  return { sha, runUrl: field('прогон') };
}

const short = (sha) => (typeof sha === 'string' && /^[0-9a-f]{7,}$/i.test(sha) ? sha.slice(0, 8) : '');

/**
 * Формулировка для упавшей job. `prior` — разобранный маркер предыдущего
 * падения с тем же ключом либо null.
 */
export function inheritedFailureNote({ job, sha, runUrl, prior }) {
  const here = short(sha);
  if (!prior) {
    return {
      first: true,
      notice: `${job} упала впервые на этих входах — причина в этом коммите${here ? ` (${here})` : ''}`,
      summary: [
        `### ${job}: падение на новых входах`,
        `Предыдущего падения с тем же ключом переиспользования не было — изменения этого коммита${here ? ` (\`${here}\`)` : ''} и есть причина.`,
      ],
    };
  }
  const first = short(prior.sha);
  const since = first ? `с \`${first}\`` : 'с более раннего прогона (SHA в маркере не записан)';
  const link = prior.runUrl ? ` Первый такой прогон: ${prior.runUrl}` : '';
  return {
    first: false,
    notice: `${job} красная на тех же входах ${first ? `с ${first}` : '(SHA первого падения не записан)'}`
      + ` — этот коммит её не ронял`,
    summary: [
      `### ${job}: унаследованное падение`,
      `Входы этой job побайтово те же, что в первом падении ${since}: этот коммит её не ронял.`,
      'Красноту снимает либо приёмка эталонов, либо правка того, что job проверяет —'
        + ' и то и другое меняет ключ переиспользования.' + link,
    ],
  };
}

function main(argv) {
  const job = (argv.find((a) => a.startsWith('--job=')) || '').slice('--job='.length);
  const root = (argv.find((a) => a.startsWith('--repo=')) || '').slice('--repo='.length) || process.cwd();
  if (!job) {
    process.stderr.write(`usage: gate-reuse.mjs --job=<${JOBS.join('|')}> [--note --marker=<path>] [--repo=<path>]\n`);
    process.exit(2);
  }
  // Режим объяснения падения (#386): ключ уже посчитан job `reuse`, считать его
  // здесь заново нельзя — дерево то же, но лишний проход по эталонам стоит
  // секунд, а расхождение с ключом кэша было бы незаметным и вредным.
  if (argv.includes('--note')) {
    const marker = (argv.find((a) => a.startsWith('--marker=')) || '').slice('--marker='.length)
      || '.fail-marker';
    const prior = existsSync(marker) ? parseFailureMarker(readFileSync(marker, 'utf8')) : null;
    const sha = process.env.GITHUB_SHA || '';
    const runUrl = process.env.RUN_URL || '';
    const note = inheritedFailureNote({ job, sha, runUrl, prior });
    process.stdout.write(`::notice::${note.notice} (#386)\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${note.summary.join('\n\n')}\n`);
    }
    // Первое падение оставляет маркер следующим прогонам; унаследованное не
    // трогает файл, чтобы SHA первопричины не съехал на свидетеля.
    if (note.first) {
      writeFileSync(marker, `${job} упала\nSHA: ${sha}\nпрогон: ${runUrl}\n`);
    }
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `first=${note.first}\n`);
    }
    return;
  }
  const key = reuseKey(root, job);
  process.stdout.write(`${key}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `key=${key}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('gate-reuse.mjs')) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`gate-reuse: ${err.message}\n`);
    process.exit(1);
  }
}
