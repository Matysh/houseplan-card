// Ключ переиспользования результата тяжёлой job (issue #208).
//
// Тяжёлые job Validate — smoke, golden, performance_smoke, backend — прогонялись
// на каждый push в dev, включая коммиты в документацию, workflows и процессные
// скрипты, где бандл и оснастка побайтово те же. Ключ здесь отвечает на один
// вопрос: «менялось ли хоть что-то, от чего результат этой job зависит».
//
// Ключ = sourceFingerprint (входы поведения: src/**, demo/fixtures,
// demo/golden/*.mjs, package.json, lock, rollup, tsconfig) ПЛЮС хеш собственной
// оснастки job. Совпал ключ с прогоном, который завершился успешно, — повторять
// нечего; не совпал — гоняем.
//
// Почему это не фильтры путей из job `changes` (на dev они намеренно
// отключены): там объём прогона угадывается по путям, и «зелёный» начинает
// значить разное. Здесь эквивалентность входов ДОКАЗАНА хешем, а маркер успеха
// пишет только успешный прогон с тем же ключом.
//
// Свойство, которое стоит знать: релизный кандидат (бета или стабильный релиз)
// бампает версию, а `CARD_VERSION` и `package.json` входят в sourceFingerprint.
// Значит ключ кандидата заведомо новый и полный набор гейтов прогоняется всегда.
// Переиспользование физически не может ослабить релизный гейт.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { sourceFingerprint } from './source-fingerprint.mjs';

/**
 * Оснастка каждой job: файлы, от которых её результат зависит помимо входов
 * поведения. `scripts/**` целиком сюда не берётся намеренно — он меняется
 * часто и почти всегда не в той части, которую job исполняет; берутся только
 * фактически исполняемые файлы (см. package.json).
 */
export const HARNESS = {
  smoke: {
    roots: ['demo'],
    keep: (rel) => /^demo\/smoke_[^/]+\.mjs$/.test(rel),
  },
  golden: {
    // demo/golden/** целиком: и сценарии, и эталоны — эталон тоже вход
    // сравнения, его подмена обязана менять ключ.
    roots: ['demo/golden'],
    keep: () => true,
  },
  performance_smoke: {
    roots: ['demo'],
    keep: (rel) => /^demo\/performance\//.test(rel)
      || /^demo\/benchmark_(glow|large_house)\.mjs$/.test(rel),
  },
  backend: {
    roots: ['tests_backend', 'custom_components', 'pytest.ini'],
    // Внутри custom_components/** значим только Python: собранный фронтенд
    // лежит там же и меняется от любой сборки, а backend его не исполняет.
    keep: (rel) => !rel.startsWith('custom_components/') || rel.endsWith('.py'),
  },
};

export const JOBS = Object.keys(HARNESS);

/** Все файлы под путём (файл — сам путь), относительными путями через «/». */
const walk = (root, entry) => {
  const abs = resolve(root, entry);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [relative(root, abs).replaceAll('\\', '/')];
  return readdirSync(abs).sort().flatMap((name) =>
    walk(root, relative(root, resolve(abs, name)).replaceAll('\\', '/')));
};

/** Файлы оснастки job в порядке, не зависящем от файловой системы. */
export function harnessFiles(root, job) {
  const spec = HARNESS[job];
  if (!spec) throw new Error(`неизвестная job: ${job}. Известны: ${JOBS.join(', ')}`);
  const seen = new Set();
  for (const entry of spec.roots) {
    for (const rel of walk(root, entry)) if (spec.keep(rel)) seen.add(rel);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Ключ переиспользования. Пустая оснастка не молчит: она означала бы, что job
 * зависит только от входов поведения, и такую подмену лучше заметить.
 */
export function reuseKey(root, job) {
  const files = harnessFiles(root, job);
  if (!files.length) throw new Error(`оснастка job ${job} пуста — проверьте HARNESS`);
  const hash = createHash('sha256');
  hash.update(`job:${job}\0`);
  hash.update(`source:${sourceFingerprint(root)}\0`);
  for (const rel of files) {
    hash.update(rel);
    hash.update('\0');
    // Текст канонизируется по переводам строк, бинарное берётся как есть:
    // иначе Windows и Linux дали бы разные ключи на одном дереве.
    const raw = readFileSync(resolve(root, rel));
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
