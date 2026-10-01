#!/usr/bin/env node
/**
 * Архив документов ревью выпущенных линий (#682, PROCESS.md §2.10, #635).
 *
 *   node scripts/reviews-archive.mjs --through=v1.77.0            # план, ничего не пишет
 *   node scripts/reviews-archive.mjs --through=v1.77.0 --apply    # git mv + пересборка INDEX.md
 *
 * В `docs/reviews/` живут документы задач текущей линии: следующие раунды
 * ссылаются на предыдущие («Унаследовано из r<N−1>», якоря материала #413,
 * #416), поэтому документы не удаляются и история не переписывается — после
 * стабильного релиза они переезжают в `legacy/reviews/<тег>/` одним коммитом
 * класса C. Кому куда, решает не метка и не память, а тот же довод, что у
 * `RELEASE-MEMBERSHIP.json` (#547) и ревью линии (#638): трейлеры
 * `Issue: #NN` в диапазоне линии «прошлый стабильный тег..тег».
 *
 * Правила (все — в `archivePlan`, чистой функции):
 *  - линия задачи — ПОСЛЕДНЯЯ стабильная линия ≤ `--through`, где у неё есть
 *    трейлер: документы одной задачи не разъезжаются по двум каталогам;
 *  - задача с трейлером в открытой линии (`--through..HEAD`) остаётся целиком:
 *    её раунды ещё продолжаются, а ссылки на прошлые раунды ведут в
 *    `docs/reviews/`. Это и есть граница, которую нельзя пересечь;
 *  - закрытая без выпуска задача (#522) переезжает с линией, в которой лёг её
 *    документ: коммит документа несёт тот же трейлер;
 *  - `RELEASE-REVIEW-vX.Y.Z.md` уходит в каталог своего тега, поэтому перенос
 *    линии делается после публикации её ревью;
 *  - документ задачи без трейлера ни в одной линии (работа до правила
 *    трейлеров, документ подшит позже) переезжает с линией, в которой лёг
 *    сам документ — первым стабильным тегом, содержащим его добавление;
 *  - имя вне схемы и документ, не попавший ни в одну линию, остаются на месте
 *    и печатаются — решает человек.
 *
 * Перенос добавляет документу уровень вложенности (`docs/reviews/X.md` →
 * `legacy/reviews/<тег>/X.md`), поэтому `--apply` переписывает относительные
 * Markdown-ссылки — и внутри перенесённых файлов, и в соседях, которые на них
 * ссылаются (`repairLinks`, ревью #682 r1). `--repair-links=<rev>` делает то же
 * для всех переименований `<rev>..HEAD`, `--check-links` печатает битые
 * относительные ссылки архива и живых каталогов.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './spawn-portable.mjs';
import { issueTrailers } from './release-membership.mjs';
import { INDEX_FILE, parseDocName } from './reviews-index.mjs';
import { STABLE_TAG_RE } from './release-review.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LIVE_DIR = 'docs/reviews';
export const ARCHIVE_DIR = 'legacy/reviews';

const parts = (tag) => STABLE_TAG_RE.exec(tag).slice(1, 4).map(Number);
export function compareStable(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Стабильные теги ≤ `through` по возрастанию; беты и чужие имена отброшены. */
export function stableTagsThrough(tags, through) {
  if (!STABLE_TAG_RE.test(String(through))) throw new Error(`not a stable release tag: ${through}`);
  return [...new Set(tags)].filter((tag) => STABLE_TAG_RE.test(tag) && compareStable(tag, through) <= 0)
    .sort(compareStable);
}

/**
 * План переноса.
 *
 * @param names   имена файлов в `docs/reviews/`
 * @param lines   [{ tag, issues: Iterable<number> }] — стабильные линии ≤ through
 * @param open    Iterable<number> — задачи с трейлером в открытой линии
 * @param through последний архивируемый стабильный тег
 * @param addedIn Map<имя, тег> — линия, в которой документ добавлен (для задач без трейлера)
 * @returns {{ moves: {name, from, to, tag, issue}[], kept: {name, reason, issue?}[] }}
 */
export function archivePlan({ names, lines, open, through, addedIn = new Map() }) {
  const openSet = new Set([...open].map(Number));
  const lineOf = new Map();
  const ordered = [...lines].sort((a, b) => compareStable(a.tag, b.tag));
  for (const line of ordered) {
    if (compareStable(line.tag, through) > 0) throw new Error(`line ${line.tag} is newer than ${through}`);
    for (const issue of line.issues) lineOf.set(Number(issue), line.tag); // последняя линия выигрывает
  }
  const tags = new Set(ordered.map((line) => line.tag));
  const moves = [];
  const kept = [];
  for (const name of [...names].sort()) {
    if (name === INDEX_FILE) continue;
    const doc = parseDocName(name);
    if (!doc) { kept.push({ name, reason: 'вне схемы имён' }); continue; }
    if (doc.nightly && STABLE_TAG_RE.test(doc.tag)) {
      // #727: ночной документ со стабильной базой читал код следующей линии —
      // ближайшей архивируемой строго новее базы, а не самой базы (она выпущена).
      const next = ordered.find((line) => compareStable(line.tag, doc.tag) > 0);
      if (next) moves.push({ name, from: `${LIVE_DIR}/${name}`, to: `${ARCHIVE_DIR}/${next.tag}/${name}`, tag: next.tag, issue: null });
      else kept.push({ name, reason: `ночное ревью после ${doc.tag}: архивируемой линии новее базы нет` });
      continue;
    }
    if (doc.stage === 'release' || doc.stage === 'ship') {
      // #696: пакетное ревью беты уходит в каталог своей стабильной линии;
      // #727: ночной документ с базой-бетой — туда же, куда документ этой беты.
      const line = doc.tag.replace(/-beta\.\d+$/, '');
      if (tags.has(line)) moves.push({ name, from: `${LIVE_DIR}/${name}`, to: `${ARCHIVE_DIR}/${line}/${name}`, tag: line, issue: null });
      else kept.push({ name, reason: `ревью линии ${line} не входит в архивируемые линии` });
      continue;
    }
    if (openSet.has(doc.issue)) { kept.push({ name, issue: doc.issue, reason: 'задача есть в открытой линии' }); continue; }
    const tag = lineOf.get(doc.issue) ?? (tags.has(addedIn.get(name)) ? addedIn.get(name) : null);
    if (!tag) { kept.push({ name, issue: doc.issue, reason: 'нет трейлера ни в одной линии' }); continue; }
    moves.push({ name, from: `${LIVE_DIR}/${name}`, to: `${ARCHIVE_DIR}/${tag}/${name}`, tag, issue: doc.issue });
  }
  return { moves, kept };
}

export function renderPlan({ moves, kept, through }) {
  const byTag = new Map();
  for (const move of moves) byTag.set(move.tag, (byTag.get(move.tag) || 0) + 1);
  const reasons = new Map();
  for (const item of kept) reasons.set(item.reason, (reasons.get(item.reason) || 0) + 1);
  const issues = new Set(moves.map((move) => move.issue).filter((issue) => issue != null));
  const lines = [
    `Архив документов ревью по ${through}: переносится ${moves.length} (задач ${issues.size}), остаётся ${kept.length}.`,
    ...[...byTag].sort(([a], [b]) => compareStable(a, b)).map(([tag, count]) => `  ${ARCHIVE_DIR}/${tag}/: ${count}`),
    ...[...reasons].map(([reason, count]) => `  остаётся — ${reason}: ${count}`),
  ];
  const notable = kept.filter((item) => item.reason !== 'задача есть в открытой линии');
  if (notable.length) lines.push('Остаются на месте, решает человек:', ...notable.map((item) => `  ${item.name} — ${item.reason}`));
  return lines.join('\n');
}

function git(args, cwd = ROOT) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr.trim()}`);
  return run.stdout;
}

/** Задачи с трейлером в диапазоне `range` (`a..b` или один ref — вся история до него). */
export function trailerIssues(range, cwd = ROOT) {
  const log = git(['log', '--format=%B%x1e', range], cwd);
  return new Set(log.split('\x1e').flatMap((message) => issueTrailers(message)));
}

export function readInputs({ through, head = 'HEAD', cwd = ROOT }) {
  const reachable = git(['tag', '--merged', through, '-l', 'v*'], cwd).split('\n').filter(Boolean);
  const stable = stableTagsThrough([...reachable, through], through);
  const lines = stable.map((tag, index) => ({
    tag,
    issues: trailerIssues(index === 0 ? tag : `${stable[index - 1]}..${tag}`, cwd),
  }));
  const open = trailerIssues(`${through}..${head}`, cwd);
  const names = git(['ls-tree', '--name-only', `${head}:${LIVE_DIR}`], cwd).split('\n').filter(Boolean);
  return { names, lines, open };
}

/**
 * Линия добавления документа: первый стабильный тег ≤ through, содержащий
 * коммит, который добавил файл. Спрашивается только для документов, у задачи
 * которых нет трейлера ни в одной линии — их единицы.
 */
export function addedLines({ names, through, head = 'HEAD', cwd = ROOT }) {
  const result = new Map();
  for (const name of names) {
    const sha = git(['log', '--diff-filter=A', '--format=%H', '-1', head, '--', `${LIVE_DIR}/${name}`], cwd).trim();
    if (!sha) continue;
    const containing = stableTagsThrough(git(['tag', '--contains', sha, '-l', 'v*'], cwd).split('\n').filter(Boolean), through);
    if (containing.length) result.set(name, containing[0]);
  }
  return result;
}

const LINK_RE = /(\]\()([^)\s]+)(\))/g;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i;

/**
 * Переписать относительные ссылки одного Markdown-файла после переносов.
 *
 * `path` — где файл лежит сейчас, `oldPath` — где лежал до переноса (для
 * неперенесённого совпадает). Ссылка, которая и так резолвится от `path`,
 * не трогается. Иначе цель ищется от `path` и от `oldPath`, проводится через
 * `moved` (старый путь → новый), и если так найден существующий файл — ссылка
 * пересчитывается от нового места. Ссылка, битая и до переноса, остаётся как
 * была: чинить чужую историю — не дело архива.
 *
 * @returns {{ text: string, fixed: number }}
 */
export function repairLinks({ text, path, oldPath = path, moved, exists }) {
  let fixed = 0;
  const out = String(text).replace(LINK_RE, (whole, open, target, close) => {
    if (EXTERNAL.test(target)) return whole;
    const hash = target.indexOf('#');
    const file = hash >= 0 ? target.slice(0, hash) : target;
    const anchor = hash >= 0 ? target.slice(hash) : '';
    if (!file) return whole;
    let decoded;
    try { decoded = decodeURI(file); } catch { decoded = file; }
    const here = posix.normalize(posix.join(posix.dirname(path), decoded));
    if (exists(here)) return whole;
    for (const base of [path, oldPath]) {
      const candidate = posix.normalize(posix.join(posix.dirname(base), decoded));
      const now = moved.get(candidate) ?? candidate;
      if (now !== here && exists(now)) {
        fixed += 1;
        let rel = posix.relative(posix.dirname(path), now);
        if (!rel.startsWith('.')) rel = rel || posix.basename(now);
        return `${open}${rel}${anchor}${close}`;
      }
    }
    return whole;
  });
  return { text: out, fixed };
}

/** Все отслеживаемые Markdown-файлы: ссылаться на перенесённый документ может любой. */
function trackedMarkdown(cwd) {
  return git(['ls-files', '-z', '--', '*.md'], cwd).split('\0').filter(Boolean);
}

/**
 * Прогнать `repairLinks` по всем Markdown-файлам дерева.
 * @param moved Map<старый путь, новый путь>
 */
export function repairTreeLinks({ moved, cwd = ROOT }) {
  const inverse = new Map([...moved].map(([from, to]) => [to, from]));
  const exists = (rel) => existsSync(join(cwd, rel));
  let files = 0; let links = 0;
  for (const path of trackedMarkdown(cwd)) {
    const full = join(cwd, path);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    const result = repairLinks({ text, path, oldPath: inverse.get(path) ?? path, moved, exists });
    if (result.fixed) {
      writeFileSync(full, result.text);
      files += 1; links += result.fixed;
    }
  }
  return { files, links };
}

/** Переименования `rev..HEAD` (`git diff -M`): карта старый путь → новый. */
export function renamesSince(rev, cwd = ROOT) {
  const out = git(['diff', '-M', '--name-status', '--diff-filter=R', '-z', rev, 'HEAD'], cwd).split('\0').filter(Boolean);
  const moved = new Map();
  for (let i = 0; i < out.length; i += 3) moved.set(out[i + 1], out[i + 2]);
  return moved;
}

/** Битые относительные ссылки в архиве и живых каталогах документов ревью и ТЗ. */
export function brokenLinks({ cwd = ROOT, roots = [LIVE_DIR, ARCHIVE_DIR, 'docs/specs', 'legacy/specs'] } = {}) {
  const broken = [];
  for (const path of trackedMarkdown(cwd).filter((p) => roots.some((root) => p.startsWith(`${root}/`)))) {
    const text = readFileSync(join(cwd, path), 'utf8');
    for (const [, , target] of text.matchAll(LINK_RE)) {
      if (EXTERNAL.test(target)) continue;
      const file = target.split('#')[0];
      if (!file) continue;
      let decoded;
      try { decoded = decodeURI(file); } catch { decoded = file; }
      const resolved = posix.normalize(posix.join(posix.dirname(path), decoded));
      if (!existsSync(join(cwd, resolved))) broken.push({ path, target });
    }
  }
  return broken;
}

export function applyPlan({ moves, cwd = ROOT }) {
  const dirty = git(['status', '--porcelain', '--', LIVE_DIR, ARCHIVE_DIR], cwd).trim();
  if (dirty) throw new Error(`рабочее дерево ${LIVE_DIR}/${ARCHIVE_DIR} не чистое:\n${dirty}`);
  for (const move of moves) {
    if (existsSync(join(cwd, move.to))) throw new Error(`${move.to} уже существует`);
    mkdirSync(join(cwd, dirname(move.to)), { recursive: true });
    git(['mv', move.from, move.to], cwd);
  }
  const repaired = repairTreeLinks({ moved: new Map(moves.map((move) => [move.from, move.to])), cwd });
  if (repaired.files) git(['add', '-u', '--', '.'], cwd);
  const index = spawnSync(process.execPath, [join(ROOT, 'scripts/reviews-index.mjs'), `--dir=${LIVE_DIR}`], { cwd, encoding: 'utf8' });
  if (index.status !== 0) throw new Error(`reviews-index: ${index.stderr || index.stdout}`);
  git(['add', '--', join(LIVE_DIR, INDEX_FILE)], cwd);
  return repaired;
}

if (isMainModule(import.meta.url)) {
  const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (arg('repair-links')) {
    const result = repairTreeLinks({ moved: renamesSince(arg('repair-links')) });
    console.log(`ссылок переписано ${result.links} в ${result.files} файл(ах)`);
    process.exit(0);
  }
  if (process.argv.includes('--check-links')) {
    const broken = brokenLinks();
    for (const item of broken) console.log(`${item.path}: ${item.target}`);
    console.log(`битых относительных ссылок: ${broken.length}`);
    process.exit(broken.length ? 1 : 0);
  }
  const through = arg('through');
  if (!through || !STABLE_TAG_RE.test(through)) {
    console.error('usage: node scripts/reviews-archive.mjs --through=vX.Y.Z [--head=HEAD] [--apply] | --repair-links=<rev> | --check-links');
    process.exit(2);
  }
  const head = arg('head') || 'HEAD';
  const inputs = readInputs({ through, head });
  const first = archivePlan({ ...inputs, through });
  const stragglers = first.kept.filter((item) => item.reason === 'нет трейлера ни в одной линии').map((item) => item.name);
  const plan = stragglers.length
    ? archivePlan({ ...inputs, through, addedIn: addedLines({ names: stragglers, through, head }) })
    : first;
  console.log(renderPlan({ ...plan, through }));
  if (process.argv.includes('--apply')) {
    const repaired = applyPlan({ moves: plan.moves });
    console.log(`перенесено ${plan.moves.length}; ссылок переписано ${repaired.links} в ${repaired.files} файл(ах); ${LIVE_DIR}/${INDEX_FILE} пересобран. Коммит — класс C, с трейлером задачи.`);
  } else {
    console.log('план (--apply выполнит git mv и пересоберёт индекс)');
  }
}
