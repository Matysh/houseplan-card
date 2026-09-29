#!/usr/bin/env node
/**
 * Трек задачи и рамки `ship` (PROCESS.md §5, #695/#696).
 *
 *   node scripts/process-track.mjs resolve --labels="a,b" --base=<ref> --head=<ref>
 *   node scripts/process-track.mjs ship-limits --base=<ref> --head=<ref>
 *
 * `resolve` печатает `track=ship|show|ask`, `mutants=true|false` и
 * `full=true|false` — то, что конвейер ревью читает, решая, сколько стоит
 * заход: мутантов в разработке нет ни на одном треке (#709) — `mutants`
 * всегда `false`, весь реестр проверяет только ночной прогон; полный
 * набор (смоки, golden, perf) на ветке задачи — только меткам `ci:full` и
 * `ci:golden` (#697). Инфраструктурная задача без трековой
 * метки — `show` (§5.1); признак инфраструктуры механический, как в §1: в
 * диффе ни одного файла класса A.
 *
 * `ship-limits` печатает `ship=true|false` и по строке `violation=…` на каждое
 * нарушение рамок: дифф `src/**` не больше 30 строк, без новых файлов в
 * `src/**`, без i18n, без полей конфига и без Python. Рамки механические
 * намеренно: по ним конвейер сливает задачу без ревью модели, и решать их
 * «на глаз» некому.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { isMainModule } from './spawn-portable.mjs';
import { classify } from './process-gate.mjs';

export const SHIP_SRC_LINE_LIMIT = 30;

/**
 * Трек по меткам: `track:*` главнее прежних меток; `trivial` и `small`
 * читаются как `show` (§5.1); задача без трековой метки — `ask`. Метки трека
 * не доказывают продуктовый поток: инфраструктурной задаче владелец тоже может
 * поставить `track:*`, чтобы задать цену конвейера.
 */
export function trackFromLabels(labels = []) {
  if (labels.includes('track:ship')) return 'ship';
  if (labels.includes('track:show')) return 'show';
  if (labels.includes('track:ask')) return 'ask';
  if (labels.includes('trivial') || labels.includes('small')) return 'show';
  return 'ask';
}

/** Есть ли у задачи трековая метка вообще — новая или прежняя. */
export const hasTrackLabel = (labels = []) => ['track:ship', 'track:show', 'track:ask', 'trivial', 'small']
  .some((label) => labels.includes(label));

/**
 * Трек, по которому конвейер оценивает заход. Явная метка решает всё; без неё
 * инфраструктурная задача (ни одного файла класса A в диффе) — `show`, прочие —
 * `ask`. Мутанты проверяют тесты, а не продукт: в разработке их не гоняют ни
 * локально, ни в CI (#709, решение владельца 2026-09-29) — только ночной полный
 * реестр (`mutation-gate.yml`, #513). Поле остаётся для совместимости выхода.
 * Полный набор — по меткам `ci:full` и `ci:golden` на любом треке (#697).
 */
export function resolveTrack({ labels = [], files = [] } = {}) {
  const infrastructure = files.length > 0 && files.every((file) => classify(file) !== 'A');
  const track = hasTrackLabel(labels) ? trackFromLabels(labels) : (infrastructure ? 'show' : 'ask');
  const mutants = false;
  const full = labels.includes('ci:full') || labels.includes('ci:golden');
  return { track, mutants, full, infrastructure };
}

const I18N = [/^src\/i18n\//, /^custom_components\/[^/]+\/translations\//];
const CONFIG = [/^src\/types\.ts$/, /^src\/config-[^/]+\.ts$/];
const PYTHON = /\.py$/;

/**
 * Нарушения рамок `ship` по `git diff --numstat` и `--name-status` базы и
 * вершины. Пустой список — задача укладывается в рамки.
 *
 * @param {{added:number|null, deleted:number|null, path:string}[]} numstat
 * @param {{status:string, path:string}[]} nameStatus
 */
export function shipLimitViolations({ numstat = [], nameStatus = [] } = {}) {
  const out = [];
  const src = numstat.filter((row) => row.path.startsWith('src/'));
  const binary = src.filter((row) => row.added === null || row.deleted === null);
  const lines = src.reduce((sum, row) => sum + (row.added ?? 0) + (row.deleted ?? 0), 0);
  if (lines > SHIP_SRC_LINE_LIMIT) out.push(`дифф src/** — ${lines} строк при рамке ${SHIP_SRC_LINE_LIMIT}`);
  if (binary.length) out.push(`двоичные файлы в src/**: ${binary.map((row) => row.path).join(', ')}`);
  const added = nameStatus.filter((row) => row.status.startsWith('A') && row.path.startsWith('src/'));
  if (added.length) out.push(`новые файлы в src/**: ${added.map((row) => row.path).join(', ')}`);
  const paths = [...new Set([...numstat, ...nameStatus].map((row) => row.path))];
  const i18n = paths.filter((path) => I18N.some((re) => re.test(path)));
  if (i18n.length) out.push(`ключи i18n: ${i18n.join(', ')}`);
  const config = paths.filter((path) => CONFIG.some((re) => re.test(path)));
  if (config.length) out.push(`поля конфига: ${config.join(', ')}`);
  const python = paths.filter((path) => PYTHON.test(path));
  if (python.length) out.push(`Python: ${python.join(', ')}`);
  return out;
}

/** `git diff --numstat` → строки; двоичный файл даёт `-\t-`. */
export function parseNumstat(text = '') {
  return String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [added, deleted, ...rest] = line.split('\t');
    return { added: added === '-' ? null : Number(added), deleted: deleted === '-' ? null : Number(deleted), path: rest.at(-1) };
  });
}

/** `git diff --name-status` → строки; у переименования путь — новый. */
export function parseNameStatus(text = '') {
  return String(text).split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [status, ...paths] = line.split('\t');
    return { status, path: paths.at(-1) };
  });
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

if (isMainModule(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const value = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
  const emit = (lines) => {
    for (const line of lines) console.log(line);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  };
  try {
    const base = value('base');
    const head = value('head') || 'HEAD';
    const range = base ? `${base}...${head}` : null;
    if (command === 'resolve') {
      const labels = value('labels').split(',').map((s) => s.trim()).filter(Boolean);
      const files = range ? git(['diff', '--name-only', range]).split('\n').filter(Boolean) : [];
      const { track, mutants, full } = resolveTrack({ labels, files });
      emit([`track=${track}`, `mutants=${mutants}`, `full=${full}`]);
    } else if (command === 'ship-limits') {
      if (!range) throw new Error('--base is required');
      const violations = shipLimitViolations({
        numstat: parseNumstat(git(['diff', '--numstat', range])),
        nameStatus: parseNameStatus(git(['diff', '--name-status', range])),
      });
      emit([`ship=${violations.length === 0}`, `violations=${violations.join('; ')}`]);
    } else {
      throw new Error('usage: process-track.mjs resolve --labels=a,b [--base=<ref> --head=<ref>] | ship-limits --base=<ref> [--head=<ref>]');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
