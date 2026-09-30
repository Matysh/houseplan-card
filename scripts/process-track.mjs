#!/usr/bin/env node
/**
 * Трек задачи, его основание, лимит циклов и рамки `ship` (PROCESS.md §5,
 * #695/#696/#707) — одно правило на конвейер и пакет задачи.
 *
 *   node scripts/process-track.mjs stage --stage=code|spec --labels="a,b" --branch=<имя> \
 *        --base=origin/dev --head=HEAD --comments=<json> --owner=<login> --out=<dir> [--run-url=<url>]
 *   node scripts/process-track.mjs limit --labels="a,b" [--files=<список путей>]
 *   node scripts/process-track.mjs resolve --labels="a,b" --base=<ref> --head=<ref>
 *   node scripts/process-track.mjs ship-limits --base=<ref> --head=<ref>
 *
 * `stage` — шаг «Трек задачи и рамки ship» конвейера: ОДИН вызов решает трек,
 * его основание, рамки ship, риск по изменённым участкам (#707), повышение
 * ship → show, заметку риска для промпта ревью и строку риска для комментария
 * слияния ship. Печатает `track=`, `mutants=`, `full=`, `ship=`, `raise=`,
 * `basis=`, `risk=`; те же поля и многострочные `risk_note`/`ship_risk` пишет в
 * `$GITHUB_OUTPUT`; при `raise=true` кладёт тело комментария в `<out>/raise.md`.
 * Bash шага только исполняет: логики трека в нём нет.
 *
 * `limit` — job `guard`: трек и лимит циклов по меткам и списку файлов из
 * compare API; ответ на 300 файлов и больше инфраструктуру не доказывает.
 *
 * Мутантов в разработке нет ни на одном треке (#709) — `mutants` всегда
 * `false`. Полный набор (смоки, golden, perf) на ветке задачи — только меткам
 * `ci:full` и `ci:golden` (#697): риск, включая `visual`, его не заказывает.
 * Рамки ship механические намеренно: по ним конвейер сливает задачу без ревью
 * модели, и решать их «на глаз» некому.
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { classify } from './change-classes.mjs';
import { classifyRisk, emptyRisk, riskClassLine, RISK_CLASSES, RAISING_CLASSES } from './change-risk.mjs';

// Классификатор риска живёт рядом (ТЗ #707 §10 п.5); пакет и конвейер берут его отсюда.
export { classifyRisk, emptyRisk, riskClassLine, RISK_CLASSES, RAISING_CLASSES };

export const SHIP_SRC_LINE_LIMIT = 30;
/** Потолок ответа compare API: полный список файлов при нём не доказан. */
export const COMPARE_FILES_CAP = 300;
/** Не больше стольких строк заметки риска в промпте ревью. */
export const RISK_NOTE_LINE_LIMIT = 25;

/** Трековые метки от строжайшей к мягкой. */
const STRICTEST_FIRST = ['ask', 'show', 'ship'];

/** Явные трековые метки задачи, строжайшая первой. */
export const explicitTracks = (labels = []) => STRICTEST_FIRST.filter((track) => labels.includes(`track:${track}`));

/**
 * Трек по меткам: `track:*` главнее прежних меток, из нескольких `track:*`
 * действует строжайшая (`ask` > `show` > `ship`) — это дефект разметки, и
 * решать его в пользу дешёвого трека нельзя (#707). `trivial` и `small`
 * читаются как `show` (§5.1); задача без трековой метки — `ask`. Метки трека не
 * доказывают продуктовый поток: инфраструктурной задаче владелец тоже может
 * поставить `track:*`, чтобы задать цену конвейера.
 */
export function trackFromLabels(labels = []) {
  const [strictest] = explicitTracks(labels);
  if (strictest) return strictest;
  if (labels.includes('trivial') || labels.includes('small')) return 'show';
  return 'ask';
}

/** Есть ли у задачи трековая метка вообще — новая или прежняя. */
export const hasTrackLabel = (labels = []) => ['track:ship', 'track:show', 'track:ask', 'trivial', 'small']
  .some((label) => labels.includes(label));

/**
 * Трек по меткам и признаку инфраструктуры: явная метка решает всё; без неё
 * инфраструктурная задача (§1) — `show`, прочие — `ask` (§5.1). Одна функция на
 * guard, шаг трека и пакет задачи.
 */
export const labelTrack = ({ labels = [], infrastructure = false } = {}) => (hasTrackLabel(labels) ? trackFromLabels(labels) : (infrastructure ? 'show' : 'ask'));

/**
 * Трек, по которому конвейер оценивает заход. Признак инфраструктуры
 * механический, как в §1: в диффе ни одного файла класса A; обрезанный список
 * (`filesCapped`) его не доказывает. Мутанты проверяют тесты, а не продукт: в
 * разработке их не гоняют ни локально, ни в CI (#709, решение владельца
 * 2026-09-29) — только ночной полный реестр (`mutation-gate.yml`, #513). Поле
 * остаётся для совместимости выхода. Полный набор — по меткам `ci:full` и
 * `ci:golden` на любом треке (#697).
 */
export function resolveTrack({ labels = [], files = [], filesCapped = false } = {}) {
  const infrastructure = !filesCapped && files.length > 0 && files.every((file) => classify(file) !== 'A');
  const track = labelTrack({ labels, infrastructure });
  const mutants = false;
  const full = labels.includes('ci:full') || labels.includes('ci:golden');
  return { track, mutants, full, infrastructure };
}

/** Лимит циклов код-ревью (§4, §5): `ask` — 4, `show`/`ship` — 2. */
export const cycleLimit = (track) => (track === 'ask' ? 4 : 2);

/**
 * Трек и лимит для job `guard`: пути — из compare API, у которого потолок
 * ответа 300 файлов; такой ответ инфраструктуру не доказывает — остаётся `ask`/4.
 */
export function guardLimit({ labels = [], files = [] } = {}) {
  const { track, infrastructure } = resolveTrack({ labels, files, filesCapped: files.length >= COMPARE_FILES_CAP });
  return { track, limit: cycleLimit(track), infrastructure };
}

/**
 * Ребейз до ревью (§10.4, #257, #696): `ask` приводится к `dev` всегда;
 * `show`/`ship` — только если слияние с `dev` не чистое (`mergeClean !== true`:
 * неизвестная чистота — тоже ребейз, как у шага «Привести ветку к dev»).
 */
export const rebaseBeforeReview = (track, mergeClean) => track === 'ask' || mergeClean !== true;

/**
 * Строка подтверждения трека владельцем (§5, #707): в начале строки
 * комментария, тире любое из «—», «–», «-», слова без учёта регистра. Агент её не
 * пишет никогда: агенты и конвейер действуют от учётной записи владельца, и по
 * автору события их не отличить (ТЗ #707 §10 п.1).
 */
export const OWNER_TRACK_LINE = /^[ \t]*трек:[ \t]*(ship|show|ask)[ \t]*[—–-][ \t]*решение владельца/gimu;

/** Комментарии из `gh issue view --json comments` (или массива) в общий вид. */
export function normalizeComments(data) {
  const list = Array.isArray(data) ? data : data?.comments;
  if (!Array.isArray(list)) return null;
  return list.map((c) => ({
    author: typeof c?.author === 'string' ? c.author : (c?.author?.login ?? null),
    body: String(c?.body ?? ''),
    createdAt: c?.createdAt ?? null,
    url: c?.url ?? null,
  }));
}

/** Самая поздняя строка владельца `Трек: <x> — решение владельца` по времени комментария. */
export function ownerTrackLine(comments, owner) {
  if (!Array.isArray(comments) || !owner) return null;
  const who = String(owner).toLowerCase();
  const sorted = comments.map((c, i) => ({ c, i })).sort((a, b) => {
    const x = String(a.c?.createdAt ?? ''); const y = String(b.c?.createdAt ?? '');
    return x < y ? -1 : x > y ? 1 : a.i - b.i;
  });
  let latest = null;
  for (const { c } of sorted) {
    const author = typeof c?.author === 'string' ? c.author : c?.author?.login;
    if (String(author ?? '').toLowerCase() !== who) continue;
    for (const m of String(c?.body ?? '').matchAll(OWNER_TRACK_LINE)) {
      latest = { track: m[1].toLowerCase(), at: c.createdAt ?? null, url: c.url ?? null };
    }
  }
  return latest;
}

/**
 * Трек и его основание (К2 #707). Метка без строки владельца — предложение
 * (аналитика, агента, конвейера); подтверждает самая поздняя строка владельца,
 * и только если её трек равен текущему. Комментарии недоступны (`null`) —
 * «происхождение не установлено», подтверждения нет. Несколько трековых меток —
 * строжайшая и предупреждение в основании.
 */
export function trackOrigin({ labels = [], comments = [], owner = '', infrastructure = false } = {}) {
  const explicit = explicitTracks(labels);
  const track = labelTrack({ labels, infrastructure });
  const warning = explicit.length > 1
    ? `несколько трековых меток (${explicit.map((t) => `track:${t}`).join(', ')}) — дефект разметки, действует строжайшая track:${track}`
    : null;
  let origin; let basis; let confirmed = false; let confirmedAt = null;
  if (explicit.length) {
    if (!Array.isArray(comments) || !owner) {
      origin = 'unknown'; basis = 'метка, происхождение не установлено (комментарии недоступны)';
    } else {
      const line = ownerTrackLine(comments, owner);
      if (line && line.track === track) {
        origin = 'owner'; confirmed = true; confirmedAt = line.at;
        basis = `метка, подтверждённая владельцем (${String(line.at ?? '').slice(0, 10) || 'дата не записана'})`;
      } else {
        origin = 'proposal'; basis = 'метка без подтверждения — предложение';
      }
    }
  } else if (labels.includes('small') || labels.includes('trivial')) {
    origin = 'legacy'; basis = `прежняя метка ${labels.includes('small') ? 'small' : 'trivial'} → show (§5.1)`;
  } else {
    origin = 'default'; basis = infrastructure ? 'метки нет: инфраструктура → show' : 'метки нет: продукт → ask';
  }
  return { track, basis, origin, confirmed, confirmedAt, warning, explicit };
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

/**
 * Заметка риска для промпта ревью `show`/`ask` (К3 #707), не длиннее
 * `RISK_NOTE_LINE_LIMIT` строк; пустой риск — пустая строка. Риск — вопрос
 * ревьюеру, маршрут не меняется: автоматического show → ask нет.
 */
export function riskNote({ track, confirmed = false, risk, labels = [] } = {}) {
  if (!risk?.classes?.length) return '';
  const lines = [];
  const raising = risk.raising || [];
  if (raising.length && (track === 'show' || track === 'ask')) {
    if (track === 'show' && !confirmed) {
      lines.push('**Риск по изменённым участкам (#707).** Трек show держится на «решать нечего» (PROCESS.md §5). По каждому классу ниже назови документ или AC, где поведение уже зафиксировано; не нашёл — Medium «решать есть что — нужен track:ask» с названным критерием §5.');
    } else if (track === 'show') {
      lines.push('**Риск по изменённым участкам (#707).** Трек show подтверждён владельцем. По каждому классу ниже назови документ или AC, где поведение уже зафиксировано; трек не повышать: не нашёл — вопрос владельцу в комментарии, вариант по умолчанию «повысить до ask».');
    } else {
      lines.push('**Риск по изменённым участкам (#707).** Трек ask: сверь, что каждый класс ниже покрыт AC ТЗ.');
    }
    for (const cls of raising) lines.push(`- ${riskClassLine(risk, cls)}`);
  }
  if (risk.visual?.render && !labels.includes('ci:golden')) {
    lines.push('Визуальный риск в пути отрисовки плана без ci:golden — если задача меняет вид, нужен ci:golden (PROCESS.md §8); иначе запиши в «чего не проверял».');
    lines.push(`- ${riskClassLine(risk, 'visual')}`);
  }
  return lines.slice(0, RISK_NOTE_LINE_LIMIT).join('\n');
}

/**
 * Строка риска для комментария слияния ship (`hp:ship-merge`): человеку и
 * машинная `<!-- hp:ship-risk classes=… -->` для пакетного ревью (§11.7).
 * Без риска — пустая строка.
 */
export function shipRiskText({ risk, confirmed = false } = {}) {
  if (!risk?.classes?.length) return '';
  const head = confirmed && risk.raising?.length
    ? 'Риск по участкам (трек подтверждён владельцем, не повышен)'
    : 'Риск по участкам (visual ship не повышает)';
  return `${head}: ${risk.classes.map((cls) => riskClassLine(risk, cls)).join(' · ')}\n<!-- hp:ship-risk classes=${risk.classes.join(',')} -->`;
}

/** Комментарий повышения ship → show: рамки и риск одним комментарием. */
export function raiseComment({ violations = [], risk = null, runUrl = '' } = {}) {
  const parts = ['**Трек повышен: `track:ship` → `track:show`.**'];
  if (violations.length) parts.push(`Правка выходит за механические рамки ship (PROCESS.md §5): ${violations.join('; ')}.`);
  if (risk?.raising?.length) {
    parts.push([
      'Изменённые участки несут риск, который ship без ревью не пропускает (PROCESS.md §5, #707):',
      ...risk.raising.map((cls) => `- ${riskClassLine(risk, cls)}`),
    ].join('\n'));
  }
  parts.push('Слияние без ревью модели для неё закрыто. Этот заход идёт по треку show: лёгкий Validate и ревью модели «корректность и AC».');
  parts.push(violations.length
    ? 'Понизить трек обратно может только владелец.'
    : 'Понизить трек может только владелец; подтвердить ship — строкой `Трек: ship — решение владельца` в комментарии и снова `S7-code-review`.');
  if (runUrl) parts.push(`[Прогон](${runUrl}).`);
  return `${parts.join('\n\n')}\n`;
}

/**
 * Решение шага трека на S7 (К3 #707) — чистая функция над метками, диффом и
 * комментариями. Этап `spec`, отсутствие ветки и инфраструктурный дифф дают
 * пустой риск и прежнее поведение.
 */
export function decideTrack({
  stage = 'code', branch = '', labels = [], files = [], numstat = [], nameStatus = [], diff = '',
  comments = [], owner = '', runUrl = '',
} = {}) {
  const base = resolveTrack({ labels, files });
  const code = stage === 'code' && Boolean(branch);
  const risk = code ? classifyRisk(diff) : emptyRisk();
  const origin = trackOrigin({ labels, comments, owner, infrastructure: base.infrastructure });
  let { track } = base;
  let ship = false; let raise = false; let comment = ''; let violations = [];
  if (track === 'ship' && code) {
    violations = shipLimitViolations({ numstat, nameStatus });
    const riskRaises = risk.raising.length > 0 && !origin.confirmed;
    if (violations.length || riskRaises) {
      raise = true; track = 'show';
      comment = raiseComment({ violations, risk, runUrl });
    } else {
      ship = true;
    }
  }
  const confirmed = origin.confirmed && track === origin.track;
  const reasons = [violations.length && 'рамки ship', raise && risk.raising.length && `риск ${risk.raising.join(', ')}`].filter(Boolean);
  const basis = raise ? `повышен конвейером с ship (${reasons.join(' и ')}); было: ${origin.basis}` : origin.basis;
  return {
    track, mutants: base.mutants, full: base.full, infrastructure: base.infrastructure, ship, raise, comment, violations,
    risk, confirmed, basis, warning: origin.warning,
    note: code && !ship ? riskNote({ track, confirmed, risk, labels }) : '',
    shipRisk: ship ? shipRiskText({ risk, confirmed: origin.confirmed }) : '',
  };
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

/** Комментарии из файла `gh issue view --json comments`; пустой или битый файл — недоступны. */
export function readComments(path) {
  if (!path || !existsSync(path)) return null;
  const text = readFileSync(path, 'utf8').trim();
  if (!text) return null;
  try { return normalizeComments(JSON.parse(text)); } catch { return null; }
}

if (isMainModule(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const value = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
  const labels = value('labels').split(',').map((s) => s.trim()).filter(Boolean);
  const emit = (lines) => {
    for (const line of lines) console.log(line);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  };
  try {
    const base = value('base');
    const head = value('head') || 'HEAD';
    const range = base ? `${base}...${head}` : null;
    if (command === 'stage') {
      const branch = value('branch');
      const stage = value('stage') || 'code';
      const out = value('out');
      if (!out) throw new Error('--out is required');
      const diffRange = branch ? `${base || 'origin/dev'}...${head}` : null;
      const code = stage === 'code' && diffRange;
      const decision = decideTrack({
        stage, branch, labels,
        files: diffRange ? git(['diff', '--name-only', diffRange]).split('\n').filter(Boolean) : [],
        numstat: code ? parseNumstat(git(['diff', '--numstat', diffRange])) : [],
        nameStatus: code ? parseNameStatus(git(['diff', '--name-status', diffRange])) : [],
        diff: code ? git(['-c', 'core.quotePath=false', 'diff', '--unified=0', '-M', '--no-color', '--no-ext-diff', '--no-textconv', diffRange]) : '',
        comments: readComments(value('comments')),
        owner: value('owner'),
        runUrl: value('run-url'),
      });
      mkdirSync(out, { recursive: true });
      if (decision.raise) writeFileSync(join(out, 'raise.md'), decision.comment);
      const basis = `${decision.basis}${decision.warning ? ` · внимание: ${decision.warning}` : ''}`;
      const lines = [
        `track=${decision.track}`, `mutants=${decision.mutants}`, `full=${decision.full}`, `ship=${decision.ship}`,
        `raise=${decision.raise}`, `basis=${basis}`, `risk=${decision.risk.classes.join(',')}`,
      ];
      for (const line of lines) console.log(line);
      if (decision.violations.length) console.log(`violations=${decision.violations.join('; ')}`);
      if (decision.note) console.log(`risk_note:\n${decision.note}`);
      if (process.env.GITHUB_OUTPUT) {
        const block = (name, text) => {
          if (!text) return '';
          const delimiter = `HP_TRACK_${randomUUID()}`;
          return `${name}<<${delimiter}\n${text}\n${delimiter}\n`;
        };
        appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n${block('risk_note', decision.note)}${block('ship_risk', decision.shipRisk)}`);
      }
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- трек **${decision.track}** · основание: ${basis} · риск по участкам: ${decision.risk.classes.join(', ') || 'нет'} · полный набор: ${decision.full} · слияние без модели: ${decision.ship}${decision.raise ? ' · повышен ship → show' : ''}\n`);
      }
    } else if (command === 'limit') {
      const path = value('files');
      const files = path && existsSync(path) ? readFileSync(path, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : [];
      const { track, limit, infrastructure } = guardLimit({ labels, files });
      for (const line of [`track=${track}`, `limit=${limit}`, `infrastructure=${infrastructure}`]) console.log(line);
    } else if (command === 'resolve') {
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
      throw new Error('usage: process-track.mjs stage --stage=code|spec --labels=a,b --branch=<b> --base=<ref> --out=<dir> [--head --comments --owner --run-url] | limit --labels=a,b [--files=<file>] | resolve --labels=a,b [--base=<ref> --head=<ref>] | ship-limits --base=<ref> [--head=<ref>]');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
