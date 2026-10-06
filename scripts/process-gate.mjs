#!/usr/bin/env node
// Гейт процесса houseplan-card. Проверяет диапазон коммитов по PROCESS.md §10.2.
// Node, без зависимостей. Ничего не изменяет — только читает git, файлы и issue.
//
//   node scripts/process-gate.mjs --range <base>..<head>
//   node scripts/process-gate.mjs --github-range        # диапазон из события CI
//   node scripts/process-gate.mjs --issues              # + проверки 8 и 10 через gh
//   node scripts/process-gate.mjs --json                # машинный вывод
//   node scripts/process-gate.mjs --report              # печатать, но не краснеть
//
// Код выхода: 0 — чисто, 1 — есть нарушения, 2 — не смог проверить.
//
// Зачем гейт нужен: коммиты идут прямо в dev, без PR, и GitHub на своей стороне
// не блокирует ничего (§10). Это единственное место, где нарушение правила №1
// может быть поймано машиной, а не добросовестностью агента.
//
// Решения, принятые при реализации. Продуктового поведения не касаются, поэтому
// приняты здесь, а не у владельца; ревьюер вправе оспорить любое.
//
// 1. «Release vX.Y.Z-beta.N candidate» — НЕ релизный коммит. Promotion-only
//    (`PROCESS.md` §3 п.16, `docs/DEVELOPMENT.md` › Release) — это стабильный релиз; кандидат беты несёт саму работу и живёт
//    по общим правилам, включая трейлер Issue.
// 2. Классы дополнены: package.json, package-lock.json, pytest.ini, .gitignore,
//    .gitattributes, .githooks/** — класс B (конфигурация сборки и гейтов).
//    CONTRIBUTING.md, PROCESS*.md, CODE-REVIEW-*.md, SPEC-REVIEW-*.md — класс C.
//    §1 их не перечисляет вовсе; без этого они попадали в «путь вне классов».
// 3. Документы ревью ищутся и в docs/reviews/, и в корне: три штуки закоммичены
//    в корень до того, как появилась договорённость о каталоге.
// 4. `S8-merged` входит в множество допустимых статусов, хотя issue #105
//    предлагал обратное. Причина выяснилась при реализации: конвейер сначала
//    сливает ветку в dev, а метку ставит после — Validate успевает прочитать
//    issue уже в `S8-merged`, и строгое множество красило бы каждую принятую
//    задачу. Локально строгость возвращается флагом `--no-merged`.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPEC_DRAFT_VALUE, resolveValidationRange, specDraftValues } from './validate-commit-provenance.mjs';

// Классы изменений (PROCESS.md §1) живут в change-classes.mjs (#701): их
// читает и хук commit-msg, который судит, нужен ли коммиту трейлер.
import { classify } from './change-classes.mjs';
// #729: черновик `track:ask` судится теми же функциями, что конвейер: зелёный
// документ и «Тело issue» — по якорям review-doc-guard, трек — по меткам
// process-track. Ни один из модулей process-gate.mjs не импортирует.
import { anchorIssueBodyFrom, anchorVerdictFrom } from './review-doc-guard.mjs';
import { hasTrackLabel, trackFromLabels } from './process-track.mjs';

export { classify };

const CHANGELOGS = ['docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md'];


export const ALLOWED_STATUS = ['S5-ready', 'S6-in-progress', 'S7-code-review', 'S8-merged'];
export const STRICT_STATUS = ['S5-ready', 'S6-in-progress', 'S7-code-review'];

// Номер — пункт PROCESS.md §10.2 (0 — служебный). Пункт из «Не реализовано»
// ключа не имеет (§10.2 п.9); соответствие держит test/process-gate.test.mjs (#748).
export const RULES = {
  0: 'классификация путей',
  1: 'трейлер Issue',
  2: 'имя ветки',
  3: 'ТЗ для класса A',
  4: 'User-Visible и changelog',
  5: 'класс D без основания',
  6: 'релизный коммит',
  7: 'лимит документов ревью',
  8: 'статус issue',
  10: 'DoR по моменту коммита',
};


// --- разбор коммитов ---
// Тело коммита многострочное, поэтому поля режутся не по переводам строк:
// %x1f разделяет поля, %x1e — записи. Разбор по строкам ломался на первом же
// коммите с абзацем в теле.
export const FS = '\x1f';
export const RS = '\x1e';
export const LOG_FORMAT = `%H${FS}%s${FS}%aI${FS}%b${RS}`;

/**
 * #385(в): THE release predicate — the whole expression, both disjuncts.
 * The second one (a `Release:` trailer) makes ordinary beta acceptance
 * commits release-classified too; a narrowed copy would hand them
 * `releaseSourceViolations: null` while `isRelease` stays true, and the
 * evaluator would then treat every touched src file as a violation.
 * Exported so parseRecords gates the expensive diff proof on the exact same
 * classification makeCommit uses.
 */
export function isReleaseCommit(subject, one) {
  return (/^Release v\d/.test(subject) && !/-(beta|rc|alpha)\.|candidate/i.test(subject))
    || Boolean(one('Release'));
}

export function makeCommit({
  sha = '', subject = '', body = '', files = [], authorDate = '',
  releaseSourceViolations = null, addedFiles = null,
}) {
  const text = `${subject}\n${body}`;
  const all = (name) =>
    [...text.matchAll(new RegExp(`^${name}:\\s*(.+)$`, 'gmi'))].map((m) => m[1].trim());
  const one = (name) => all(name)[0] ?? null;
  return {
    sha,
    short: sha.slice(0, 8),
    subject,
    authorDate,
    files,
    // Добавленные файлы (`--diff-filter=A`) нужны одной проверке — заморозке
    // docs/specs (#517). Не доказаны вызывающим — null, и проверка молчит.
    addedFiles,
    classes: new Set(files.map(classify)),
    issues: all('Issue'),
    userVisible: one('User-Visible'),
    release: one('Release'),
    baselineReviewed: one('Baseline-Reviewed'),
    baselineReviewedLocal: one('Baseline-Reviewed-Local'),
    // #729: все значения, а не первое — «ровно один» судит правило 10. Разбор
    // общий с хуком commit-msg (#766): тот же формат он отвергает раньше.
    specDrafts: specDraftValues(text),
    // null = вызывающий не доказал содержимое diff. Для stable release это
    // намеренно fail-closed: одного имени разрешённого version source мало.
    releaseSourceViolations,
    // Кандидат беты несёт работу и живёт по общим правилам — решение 1.
    isRelease: isReleaseCommit(subject, one),
  };
}

export function parseRecords(
  raw, filesOf = () => [], releaseSourceViolationsOf = () => null, addedFilesOf = null,
) {
  if (!raw.trim()) return [];
  return raw
    .split(RS)
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.trim())
    .map((rec) => {
      const [sha, subject, authorDate = '', body = ''] = rec.split(FS);
      const files = filesOf(sha);
      // #385(в): the diff proof costs 2 git-show per src file — compute it
      // only for commits the SAME predicate classifies as release, so
      // isRelease and the proof can never disagree.
      const text = `${subject}\n${body}`;
      const one = (name) => text.match(new RegExp(`^${name}:\\s*(.+)$`, 'mi'))?.[1].trim() ?? null;
      return makeCommit({
        sha, subject, body, files, authorDate,
        addedFiles: addedFilesOf ? addedFilesOf(sha) : null,
        releaseSourceViolations: isReleaseCommit(subject, one)
          ? releaseSourceViolationsOf(sha, files) : null,
      });
    });
}

const RELEASE_VERSION_DECLARATIONS = new Map([
  ['src/houseplan-card.ts', /^const CARD_VERSION = '[^'\r\n]+';$/gm],
  ['src/houseplan-editor-runtime.ts', /^const CARD_VERSION = '[^'\r\n]+';$/gm],
  ['custom_components/houseplan/const.py', /^VERSION = "[^"\r\n]+"$/gm],
]);

// Stable promotion действительно обязан менять эти три строки: они входят в
// шесть канонических version sources (§9.3). Сравнение целого blob до/после с
// нормализованной декларацией доказывает, что под видом bump не проехало ни
// одного другого изменения продукта. Ровно одно совпадение с обеих сторон —
// часть доказательства; неоднозначный или недоступный diff остаётся fail-closed.
export function isReleaseVersionOnlyChange(path, before, after) {
  const pattern = RELEASE_VERSION_DECLARATIONS.get(path);
  if (!pattern || typeof before !== 'string' || typeof after !== 'string') return false;
  const normalize = (source) => {
    let count = 0;
    pattern.lastIndex = 0;
    const normalized = source.replace(pattern, () => {
      count += 1;
      return '__HOUSEPLAN_RELEASE_VERSION__';
    });
    return { count, normalized };
  };
  const left = normalize(before);
  const right = normalize(after);
  return left.count === 1 && right.count === 1 && left.normalized === right.normalized;
}

// --- проверки по одному коммиту: 1, 4, 5, 6, 9 ---
export function evaluateCommit(c) {
  const out = [];
  const fail = (rule, msg) => out.push({ level: 'fail', rule, sha: c.short, msg });
  const warn = (rule, msg) => out.push({ level: 'warn', rule, sha: c.short, msg });
  const has = (k) => c.classes.has(k);
  const onlyD = c.classes.size === 1 && has('D');
  const sources = c.files.filter(
    (f) => /^src\//.test(f) || /^custom_components\/houseplan\/.*\.py$/.test(f),
  );

  if (c.isRelease) {
    // Релизный коммит: §10.2 п.5 и п.6. Трейлер Issue от него не требуется —
    // публикация версии не продуктовое изменение.
    if (!c.release) {
      fail(5, `релизный коммит «${c.subject.slice(0, 50)}» без трейлера «Release: vX.Y.Z»`);
    }
    const violations = Array.isArray(c.releaseSourceViolations)
      ? c.releaseSourceViolations
      : sources;
    if (violations.length) {
      fail(6, `релизный коммит содержит не-версионное изменение продукта: ${violations.slice(0, 3).join(', ')}`);
    }
    return out;
  }

  if ((has('A') || has('B')) && !c.issues.length) {
    fail(1, `класс ${has('A') ? 'A' : 'B'} без трейлера «Issue: #NN» — ${c.subject.slice(0, 60)}`);
  }
  for (const t of c.issues) {
    if (!/^#\d+$/.test(t)) fail(1, `трейлер Issue должен быть вида «#NN», получено «${t}»`);
  }

  if ((c.userVisible ?? '').toLowerCase() === 'yes') {
    const missing = CHANGELOGS.filter((f) => !c.files.includes(f));
    if (missing.length) fail(4, `User-Visible: yes, но не тронуты: ${missing.join(', ')}`);
  }
  if ((has('A') || has('B')) && !c.userVisible) {
    warn(4, 'класс A/B без трейлера «User-Visible: yes|no»');
  }

  if (onlyD && !c.release && !c.baselineReviewed && !c.baselineReviewedLocal) {
    fail(5, 'изменена только генерируемая часть (класс D) без «Release: vX.Y.Z», «Baseline-Reviewed: <ссылка>» либо «Baseline-Reviewed-Local: sha256:<хеш>»');
  }

  const unknown = c.files.filter((f) => classify(f) === '?');
  if (unknown.length) warn(0, `путь вне классов A/B/C/D: ${unknown.slice(0, 3).join(', ')}`);

  return out;
}

// 2. имя ветки issue/NN-slug соответствует трейлерам.
//
// Судить можно только коммиты САМОЙ ветки. Диапазон, который приходит из события
// CI, шире: после ребейза `before` указывает на снесённый коммит, merge-base
// уезжает назад, и в диапазон попадают коммиты `dev` с чужими номерами issue —
// каждый из них выглядел бы нарушением. Проверено на реальной истории: сидя на
// issue/89 с диапазоном по dev, гейт дал 26 ложных отказов из 26 коммитов.
// Документ ревью, доказанно созданный конвейером (#305): точный subject
// «docs: review document for #NN» и дифф ТОЛЬКО в docs/reviews/. Такой коммит
// попадает в чужую issue-ветку легитимно — шаг «Привести ветку к dev»
// вносит свежую историю dev, где конвейер только что опубликовал документ
// соседней задачи, а локальный origin/dev автора мог отстать и не вычесть его
// из диапазона. Кода в таком коммите нет по построению (files-критерий), и
// судить им правило 2 — ложный отказ, чинимый только --no-verify.
export function isPipelineReviewDocCommit(c) {
  return /^docs: review document for #\d+$/.test(c.subject ?? '')
    && (c.files?.length ?? 0) > 0
    && c.files.every((f) => f.startsWith('docs/reviews/'));
}

export function checkBranchRule(branch, commits) {
  const m = (branch ?? '').match(/^issue\/(\d+)-/);
  if (!m) return [];
  const want = `#${m[1]}`;
  const out = [];
  for (const c of commits) {
    if (isPipelineReviewDocCommit(c)) continue;
    for (const t of c.issues) {
      if (t !== want) {
        out.push({
          level: 'fail', rule: 2, sha: c.short,
          msg: `ветка ${branch} про ${want}, а трейлер указывает ${t}`,
        });
      }
    }
  }
  return out;
}

// 3. у класса A есть ТЗ — в теле issue (#517) либо в архивном файле
// docs/specs/NN-*.md у задач до 2026-09-10.
//
// Что изменилось. Прежняя редакция требовала ФАЙЛА и отличала «ТЗ в теле» от
// «ТЗ нет» только по меткам `small`/`trivial`. С переходом на ТЗ в теле issue
// (#517) файла нет ни у одной новой задачи, и проверка по файлу требовала бы
// того, чего процесс больше не создаёт. Судится текст: тело с заголовком
// `## ТЗ` или хотя бы одним `AC1` — это ТЗ; тело без обоих признаков — код без
// ТЗ. Офлайн (без `--issues`) тела нет, и проверка честно молчит: угадывать по
// меткам больше нечего.
//
// Уровень — предупреждение, а не отказ: признак текстовый, и ложный красный
// здесь дороже пропуска. Настоящий рубеж — ревью ТЗ, оно без ТЗ не бывает
// зелёным.
export function checkSpecs(commits, specFiles, bodyOf = null) {
  const out = [];
  const seen = new Set();
  // `\b` в JS считает границей только латиницу с цифрами, поэтому после
  // кириллического «ТЗ» её нет — признак ищется явным концом слова.
  const hasSpecText = (body) => /^[ \t]*#{1,6}[ \t]*ТЗ(?![\p{L}\p{N}])/mu.test(String(body ?? ''))
    || /(?<![\p{L}\p{N}])AC1(?![\p{L}\p{N}])/u.test(String(body ?? ''));
  for (const c of commits) {
    if (!c.classes.has('A') || c.isRelease) continue;
    for (const t of c.issues) {
      const nn = t.slice(1);
      if (seen.has(nn)) continue;
      seen.add(nn);
      // Архивный файл ТЗ у старой задачи — по-прежнему ТЗ.
      if (specFiles && specFiles.some((f) => new RegExp(`^0*${nn}[-_]`).test(f))) continue;

      const body = bodyOf ? bodyOf(nn) : null;
      if (body === null) continue; // офлайн: тела нет, судить нечем
      if (hasSpecText(body)) continue;
      out.push({
        level: 'warn', rule: 3, sha: c.short,
        msg: `класс A по ${t}: в теле issue нет ни раздела «## ТЗ», ни AC1, архивного ТЗ docs/specs/${nn}-*.md тоже нет — код без ТЗ`,
      });
    }
  }
  return out;
}

/**
 * Новые файлы в `docs/specs/**` — предупреждение: каталог заморожен (#517).
 *
 * Старые ТЗ остаются и редактируются владельцем свободно; добавление нового
 * файла означает, что кто-то пишет ТЗ по отменённой схеме.
 */
export function checkFrozenSpecs(commits) {
  const out = [];
  for (const c of commits) {
    const added = (c.addedFiles || []).filter((f) => /^docs\/specs\/[^/]+\.md$/.test(f)
      && !/README\.md$/.test(f));
    if (!added.length) continue;
    out.push({
      level: 'warn', rule: 3, sha: c.short,
      msg: `новый файл ТЗ ${added.join(', ')} — docs/specs/ заморожен с 2026-09-10 (#517), ТЗ живёт в теле issue`,
    });
  }
  return out;
}

// 7. документов ревью на issue не больше шести.
//
// Порог НЕ равен лимиту циклов (§4), и это не небрежность. Документ нумеруется
// по ЗАХОДУ ревью, а бюджет §4 тратят только вердикты с блокирующими находками
// (#227): зелёное ревью, слияние которого не удалось, требует повторного захода
// после ребейза — это другой код (§2.10) — но цикла не образует. Значит заходов
// законно бывает больше, чем циклов, и порог, равный лимиту, превращал бы
// разрешённый ребейз в отказ гейта. Ровно этот класс противоречия — правило
// против собственной проверки — и разбирался в #227.
//
// Шесть = четыре цикла плюс два ребейза. Не бесконечность: пятнадцать
// документов на одном issue означают, что что-то пошло не так, и это стоит
// увидеть.
export const REVIEW_DOC_LIMIT = 6;


export function checkReviewDocLimit(files) {
  if (!files.length) {
    return [{ level: 'warn', rule: 7, sha: '-', msg: 'документов ревью не найдено — проверка 7 пропущена' }];
  }
  // Счётчик ведётся ОТДЕЛЬНО по виду ревью (#395). Порог описывает бюджет
  // заходов одного этапа: «четыре цикла плюс два ребейза» — а ревью ТЗ и
  // ревью кода это два разных этапа со своими бюджетами (§4). Общая корзина
  // наказывала задачу за то, что она честно прошла оба: у #42 набралось
  // 4 spec + 3 code = 7 документов при 4 и 3 заходах по видам, и зелёный
  // вердикт r5 три прогона подряд не мог опубликовать свой артефакт.
  const byKindAndIssue = new Map();
  for (const f of files) {
    const m = f.match(/(CODE|SPEC)-REVIEW-(\d+)-r(\d+)\.md$/)
      || f.match(/-(\d+)-r(\d+)\.md$/)
      || f.match(/(\d+).*-r(\d+)\.md$/);
    if (!m) continue;
    const [kind, nn, round] = m.length === 4 ? [m[1], m[2], m[3]] : ['?', m[1], m[2]];
    const key = `${kind}\u0000${nn}`;
    const arr = byKindAndIssue.get(key) ?? [];
    arr.push(Number(round));
    byKindAndIssue.set(key, arr);
  }
  const out = [];
  for (const [key, rounds] of byKindAndIssue) {
    if (Math.max(...rounds) > REVIEW_DOC_LIMIT || rounds.length > REVIEW_DOC_LIMIT) {
      const [kind, nn] = key.split('\u0000');
      const label = kind === '?' ? 'ревью' : `${kind}-REVIEW`;
      out.push({
        level: 'fail', rule: 7, sha: '-',
        msg: `issue #${nn}: документов ${label} ${rounds.length}, максимум r${Math.max(...rounds)} — больше ${REVIEW_DOC_LIMIT} заходов одного вида на один issue`,
      });
    }
  }
  return out;
}

// Правило №1 говорит о продуктовом коде и инструментах, а не о документации.
// Поэтому статус issue спрашивается только у коммитов класса A/B. Иначе краснел
// бы каждый документ ревью: он ложится в ветку, пока issue в S4-spec-review или
// S7-code-review, и рабочего статуса у задачи в этот момент нет.
export function commitsUnderRuleOne(commits) {
  return commits.filter(
    (c) => !c.isRelease && (c.classes.has('A') || c.classes.has('B')),
  );
}

// Инфраструктурная работа по решению владельца #562: признак механический —
// в диапазоне НЕТ ни одного файла класса A. Такая задача реализуется до первого
// S-статуса и входит в общий флоу готовой веткой через S7-code-review. Поэтому
// первоначальный push без статуса допустим; требовать S-метку на нём означало бы
// сделать предписанный маршрут технически невозможным (#207).
//
// Исключение опирается на diff, а не на метку-разрешение: метку `infra` можно
// поставить продуктовой задаче и увести продуктовый коммит от проверки статуса,
// а перестать трогать класс A, не перестав быть инфраструктурной задачей,
// нельзя. Существование issue, его открытость и `blocked` проверяются всё равно.
//
// Признак диапазона не знает, где задача. Задача в маршруте ТЗ (`S3-spec`,
// `S4-spec-review`: `track:ask`, повышенный show после `reclassify` #726, ручной
// возврат) уже не «до первого S-статуса»: её ветка до `S5` не пушится вовсе
// (§11.8), иначе ревью ТЗ получает её материалом. Поэтому исключение снимается
// по каждому issue в `checkIssueStatuses`, а не по диапазону (#753).
export function isInfrastructureRange(commits) {
  if (!commits.length) return false;
  return !commits.some((c) => c.classes.has('A'));
}

export function isStableTarget(targetRef) {
  return /^(?:refs\/heads\/)?main$/.test(targetRef ?? '');
}

export function isDevTarget(targetRef) {
  return /^(?:refs\/heads\/)?dev$/.test(targetRef ?? '');
}

// A main-only infrastructure commit is already published and already passed
// the process gate. When main is merged back into dev, `old-dev..merge` walks
// that second parent as if it were fresh issue-branch work. Requiring its
// closed issue to become active again makes the mandatory main -> dev
// reconciliation impossible. Exclude only commits proven reachable from the
// remote main ref, and only while the destination itself is dev. The merge
// commit and every genuinely new commit remain in the checked set.
export function commitsNeedingTargetValidation(
  commits, { targetRef = '', isCommitOnMain = () => false } = {},
) {
  if (!isDevTarget(targetRef)) return commits;
  return commits.filter((commit) => !isCommitOnMain(commit.sha));
}

// При stable promotion диапазон main..candidate закономерно содержит коммиты,
// уже выпущенные prerelease-тегом. Их issue к этому моменту обязаны быть закрыты
// (§2.8), поэтому повторная online-проверка статуса дала бы ложный отказ. Новые
// post-beta коммиты остаются в выборке и проверяются fail-closed как обычно.
export function commitsNeedingIssueStatus(
  commits, { targetRef = '', isPublishedPrereleaseCommit = () => false } = {},
) {
  const underRuleOne = commitsUnderRuleOne(commits);
  if (!isStableTarget(targetRef)) return underRuleOne;
  return underRuleOne.filter((commit) => !isPublishedPrereleaseCommit(commit.sha));
}

// Статусы маршрута ТЗ, для которых инфраструктурный вход #562 не действует
// (#753). `S1-new` и `S2-analysis` в него не входят: инфраструктурные issue,
// заведённые ревьюером, приходят с `S1-new`, а ветка до `S4` материалом ревью
// ТЗ не становится.
export const SPEC_ROUTE_STATUS = ['S3-spec', 'S4-spec-review'];

// 8. статус issue. Fail closed: недоступный или закрытый issue — отказ, а не
// пропуск. Гейт, который молчит при недоступном источнике правды, бесполезен.
export function checkIssueStatuses(
  numbers, runner, { allowed = ALLOWED_STATUS, statusOptional = false } = {},
) {
  const out = [];
  for (const nn of numbers) {
    const r = runner(nn);
    if (!r || r.ok !== true) {
      const why = (r && r.error ? String(r.error) : 'нет ответа').split('\n')[0];
      out.push({
        level: 'fail', rule: 8, sha: '-',
        msg: `issue #${nn}: не удалось прочитать — отказ (fail closed). ${why}`,
      });
      continue;
    }
    let issue;
    try {
      issue = typeof r.json === 'string' ? JSON.parse(r.json) : r.json;
    } catch (e) {
      out.push({
        level: 'fail', rule: 8, sha: '-',
        msg: `issue #${nn}: ответ не разобран — отказ (fail closed). ${e.message}`,
      });
      continue;
    }
    if (String(issue.state).toUpperCase() !== 'OPEN') {
      out.push({
        level: 'fail', rule: 8, sha: '-',
        msg: `issue #${nn} закрыт — коммит по закрытой задаче отклоняется`,
      });
      continue;
    }
    const names = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
    const specRoute = names.filter((n) => SPEC_ROUTE_STATUS.includes(n));
    const optional = statusOptional && specRoute.length === 0;
    if (!optional && !names.some((n) => allowed.includes(n))) {
      const status = names.filter((n) => /^S\d-/.test(n));
      out.push({
        level: 'fail', rule: 8, sha: '-',
        msg: statusOptional
          ? `issue #${nn} в ${specRoute.join(',')}: ветка задачи до «Готово к разработке» не пушится (§11.8); инфраструктурный вход (#562) — не для задачи в маршруте ТЗ`
          : `issue #${nn}: статус ${status.length ? status.join(',') : 'не проставлен'}, а нужен один из ${allowed.join(' / ')}`,
      });
    }
    if (names.includes('blocked')) {
      out.push({
        level: 'fail', rule: 8, sha: '-',
        msg: `issue #${nn} помечен blocked — задача ждёт владельца`,
      });
    }
  }
  return out;
}

// Метки статуса до готовности (#738): каждая закрывает эпоху «можно трогать
// код», которую открывает метка из множества проверки 8. Прочие метки
// (`blocked`, `track:*`, `review-4`, при `--no-merged` и `S8-merged`) эпоху не
// меняют. Неизвестные метки вида `S\d-…` — тоже.
export const PRE_READY_STATUS = ['S1-new', 'S2-analysis', 'S3-spec', 'S4-spec-review'];

// #738: шкала статуса задачи — только статусные события, по времени. Сортировка
// устойчивая: при равном времени остаётся порядок timeline.
function statusEvents(events, allowed) {
  return events
    .filter((e) => e && e.at && (allowed.includes(e.label) || PRE_READY_STATUS.includes(e.label)))
    .map((e) => ({ label: e.label, at: Date.parse(e.at), ready: allowed.includes(e.label) }))
    .filter((e) => Number.isFinite(e.at))
    .sort((a, b) => a.at - b.at);
}

// Индекс статуса на момент `w` — последнее событие с `at ≤ w`; -1, если
// статусных событий до `w` нет.
function statusIndexAt(events, w) {
  let idx = -1;
  for (let i = 0; i < events.length && events[i].at <= w; i += 1) idx = i;
  return idx;
}

const iso = (ms) => new Date(ms).toISOString();

// #729: черновик кода во время ревью ТЗ (PROCESS.md §11.8). Статус, в котором
// он пишется, трейлер и его значение — `issueBodyDigest` тела issue, тот же
// хеш, что конвейер пишет в «Тело issue:» документа ревью. Формат значения
// (SPEC_DRAFT_VALUE) — общий с хуком commit-msg (#766).
export const DRAFT_STATUS = 'S4-spec-review';
export { SPEC_DRAFT_VALUE };

// Трек на момент `w`: последнее событие трековой метки (`track:*`, прежние
// `small`/`trivial`) с `at ≤ w`, трек — по одной этой метке. Событий нет —
// `ask`: продуктовая задача без метки (§5.1).
function trackAt(rawEvents, w) {
  const marks = rawEvents
    .filter((e) => e && e.at && hasTrackLabel([e.label]))
    .map((e) => ({ label: e.label, at: Date.parse(e.at) }))
    .filter((e) => Number.isFinite(e.at) && e.at <= w)
    .sort((a, b) => a.at - b.at);
  const last = marks.at(-1);
  return last
    ? { track: trackFromLabels([last.label]), label: last.label, at: last.at }
    : { track: 'ask', label: null, at: null };
}

// Эпоха `S4` вокруг события `at`: начало — первое `S4` непрерывной серии
// (повторная постановка, reconcile #555, эпоху заново не начинает), конец —
// первое следующее статусное событие с другой меткой, либо `null`.
function draftEpoch(events, at) {
  let first = at;
  while (first > 0 && events[first - 1].label === DRAFT_STATUS) first -= 1;
  const close = events.slice(at + 1).find((e) => e.label !== DRAFT_STATUS) ?? null;
  return { start: events[first].at, close };
}

/**
 * Зелёный SPEC-REVIEW эпохи `[start, end]` (#729): запись конвейера `green` с
 * High 0, есть «Тело issue:», документ добавлен (`addedAt`, дата автора
 * добавившего коммита) внутри окна. Из подходящих — наибольший заход.
 */
export function greenSpecReviewOf(docs, nn, start, end) {
  const name = new RegExp(`^SPEC-REVIEW-${nn}-r(\\d+)\\.md$`);
  let best = null;
  for (const doc of docs || []) {
    const m = name.exec(String(doc?.name ?? ''));
    if (!m) continue;
    const recorded = anchorVerdictFrom(doc.text);
    if (!recorded || recorded.verdict !== 'green' || recorded.high !== 0) continue;
    const body = anchorIssueBodyFrom(doc.text);
    if (!body) continue;
    const added = Date.parse(doc.addedAt);
    if (!Number.isFinite(added) || added < start || added > end) continue;
    const round = Number(m[1]);
    if (!best || round > best.round) best = { name: doc.name, round, body, addedAt: added };
  }
  return best;
}

// Проверки чернового коммита по порядку (К3 п.2 #729); находка одна — по первой
// невыполненной. `null` — коммит принят как написанный в разрешённой эпохе.
function judgeDraft({ c, nn, events, at, rawEvents, rangeHead, docsOf }) {
  const wrote = Date.parse(c.authorDate);
  const fail = (msg) => ({ level: 'fail', rule: 10, sha: c.short, msg });
  const lead = `issue #${nn}: коммит класса A написан ${c.authorDate} в ${DRAFT_STATUS}`;
  const drafts = c.specDrafts ?? [];
  if (drafts.length !== 1 || !SPEC_DRAFT_VALUE.test(drafts[0])) {
    return fail(`${lead}: трейлер \`Spec-Draft\` должен быть ровно один, вида \`sha256:<64 hex>\` `
      + `(трейлеров ${drafts.length}) (§11.8)`);
  }
  const track = trackAt(rawEvents, wrote);
  if (track.track !== 'ask') {
    return fail(`${lead} на треке ${track.track} (${track.label} с ${iso(track.at)}): `
      + 'черновик разрешён только на `track:ask` (§11.8)');
  }
  const epoch = draftEpoch(events, at);
  if (!epoch.close || epoch.close.label !== 'S5-ready') {
    const closed = epoch.close ? `закрыта ${epoch.close.label} ${iso(epoch.close.at)}` : 'ещё не закрыта';
    return fail(`${lead}: эпоха ${DRAFT_STATUS} с ${iso(epoch.start)} ${closed} — `
      + 'черновик принимается только из эпохи, которую закрыл `S5-ready` (§11.8)');
  }
  const green = greenSpecReviewOf(docsOf(), nn, epoch.start, epoch.close.at);
  if (!green) {
    return fail(`${lead}: эпоха ${iso(epoch.start)}…${iso(epoch.close.at)} — зелёный \`SPEC-REVIEW-${nn}-r*\` `
      + `этой эпохи не найден ни в ${rangeHead}, ни в origin/dev — \`git fetch origin dev\` и повторить (§11.8)`);
  }
  const draft = drafts[0].slice('sha256:'.length);
  if (draft !== green.body) {
    return fail(`${lead}: трейлер \`Spec-Draft\` sha256:${draft.slice(0, 12)} не равен «Тело issue» `
      + `sha256:${green.body.slice(0, 12)} из ${green.name} — ТЗ правилось — работа переделывается после S5, `
      + 'дата автора не переписывается (§12)');
  }
  return null;
}

// 10. DoR по моменту коммита (#311, #738). Правило 8 читает ТЕКУЩУЮ метку
// issue: нарушение «код написан вне статуса разработки» становится невидимым,
// как только статус штатно продвигается. Здесь статус задачи сверяется с
// моментом НАПИСАНИЯ кода: на authorDate коммита класса A задача должна быть в
// эпохе из `allowed`. Эпохи строятся по labeled-событиям timeline: `allowed`
// открывает, PRE_READY_STATUS закрывает. Так ловится и код до первого
// «Готово к разработке», и код, написанный после возврата `S5+ → S3/S4`
// (`reclassify` #726, ручной возврат) и запушенный после нового `S5`; коммиты,
// написанные до возврата, остаются законными.
// authorDate переживает ребейзы конвейера — окно нарушения не закрывается.
// Проверка вторичная к правилу 8, поэтому недоступный timeline — warn, а не
// fail: основная fail-closed проверка статуса остаётся за правилом 8.
//
// #729: одно исключение поверх эпох — черновик `track:ask` (§11.8). Коммит,
// написанный в `S4-spec-review` с трейлером `Spec-Draft`, принимается, если
// эпоху `S4` закрыл `S5-ready`, трек на момент написания — `ask`, а трейлер
// равен «Тело issue» зелёного SPEC-REVIEW этой эпохи. Документы читает
// `specReviews` (`{ head, read(nn) }`, см. gitSpecReviewReader); не передан —
// исключение выключено, и находки с текстами равны #738.
export function checkCommitEraStatuses(
  commits, timelineRunner, { allowed = ALLOWED_STATUS, specReviews = null } = {},
) {
  const out = [];
  const byIssue = new Map();
  for (const c of commits) {
    if (!c.classes.has('A') || c.isRelease) continue;
    if (!c.authorDate) continue;
    for (const t of c.issues) {
      const nn = t.slice(1);
      const list = byIssue.get(nn) ?? [];
      list.push(c);
      byIssue.set(nn, list);
    }
  }
  for (const [nn, list] of byIssue) {
    const r = timelineRunner(nn);
    if (!r || r.ok !== true || !Array.isArray(r.events)) {
      out.push({
        level: 'warn', rule: 10, sha: '-',
        msg: `issue #${nn}: timeline недоступен — проверка DoR по моменту коммита пропущена`,
      });
      continue;
    }
    const events = statusEvents(r.events, allowed);
    const firstReady = events.find((e) => e.ready);
    if (firstReady === undefined) {
      // Правило 8 уже требует текущий разрешённый статус; отсутствие событий
      // при живом статусе — неполный timeline, честный warn.
      out.push({
        level: 'warn', rule: 10, sha: '-',
        msg: `issue #${nn}: в timeline нет событий ${allowed.join('/')} — проверка DoR по моменту коммита пропущена`,
      });
      continue;
    }
    // #729: документы issue читаются один раз и только для чернового коммита.
    let issueDocs = null;
    const docsOf = () => {
      if (issueDocs === null) issueDocs = specReviews.read(nn) ?? [];
      return issueDocs;
    };
    for (const c of list) {
      const wrote = Date.parse(c.authorDate);
      if (!Number.isFinite(wrote)) continue;
      const at = statusIndexAt(events, wrote);
      const drafts = c.specDrafts ?? [];
      if (at >= 0 && events[at].ready) {
        // #729: коммит законен по #738, трейлер — шум; вероятно, он переехал
        // вместе с кодом при переносе черновика.
        if (specReviews && drafts.length) {
          out.push({
            level: 'warn', rule: 10, sha: c.short,
            msg: `issue #${nn}: трейлер \`Spec-Draft\` на коммите, написанном в ${events[at].label}: `
              + `черновиком считается только коммит из \`${DRAFT_STATUS}\` (§11.8)`,
          });
        }
        continue;
      }
      const inDraftStatus = Boolean(specReviews) && at >= 0 && events[at].label === DRAFT_STATUS;
      if (inDraftStatus && drafts.length) {
        const finding = judgeDraft({
          c, nn, events, at, rawEvents: r.events, rangeHead: specReviews.head ?? '<head>', docsOf,
        });
        if (finding) out.push(finding);
        continue;
      }
      const tail = inDraftStatus
        ? `; написан в \`${DRAFT_STATUS}\` — черновик \`track:ask\` принимается только с трейлером \`Spec-Draft\` (§11.8)`
        : '';
      let lastReady = -1;
      for (let i = 0; i < at; i += 1) if (events[i].ready) lastReady = i;
      if (lastReady < 0) {
        out.push({
          level: 'fail', rule: 10, sha: c.short,
          msg: `issue #${nn}: коммит класса A написан ${c.authorDate}, `
            + `до первого достижения задачей статуса из ${allowed.join('/')} `
            + `(${iso(firstReady.at)}) — код раньше «Готово к разработке» (§12)${tail}`,
        });
        continue;
      }
      // Возврат — первое закрывающее событие после последней готовности;
      // повторная готовность — первое событие `allowed` после написания.
      const returned = events[lastReady + 1];
      const nextReady = events.slice(at + 1).find((e) => e.ready);
      out.push({
        level: 'fail', rule: 10, sha: c.short,
        msg: `issue #${nn}: коммит класса A написан ${c.authorDate} в ${events[at].label} — `
          + `после возврата ${iso(returned.at)} и до повторного «Готово к разработке» `
          + `(${nextReady ? iso(nextReady.at) : 'ещё не достигнут'}) — код вне статуса разработки (§12)${tail}`,
      });
    }
  }
  return out;
}

export function buildReport({ range, branch, commits, findings }) {
  const fails = findings.filter((f) => f.level === 'fail');
  return {
    range,
    branch,
    commits,
    ok: fails.length === 0,
    fails: fails.length,
    warns: findings.length - fails.length,
    findings,
  };
}

// --- CLI ---
function git(args, repo) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(`git ${args.join(' ')} → ${(r.stderr || '').trim()}\n`);
    process.exit(2);
  }
  return r.stdout;
}

function ghTimelineRunner(nwo, bin) {
  return (nn) => {
    const r = spawnSync(bin, ['api', `repos/${nwo}/issues/${nn}/timeline`, '--paginate',
      '-q', '[.[] | select(.event == "labeled") | {label: .label.name, at: .created_at}]'],
      { encoding: 'utf8' });
    if (r.status !== 0) {
      return { ok: false, error: (r.stderr || 'gh api завершился с ошибкой').trim() };
    }
    try {
      // --paginate печатает по массиву на страницу — склеиваем все.
      const events = r.stdout.trim().split('\n').filter(Boolean)
        .flatMap((line) => JSON.parse(line));
      return { ok: true, events };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
}

/**
 * Документы SPEC-REVIEW из git для исключения #729 (§11.8): вершина
 * проверяемого диапазона и `refs/remotes/origin/dev`, если она есть. На issue
 * SPEC-REVIEW лежит либо в ветке задачи, либо прямо в `dev` (ветки до `S5` у
 * `ask` обычно нет), поэтому нужны обе ссылки. `addedAt` — дата автора
 * коммита, добавившего путь на той ссылке, где документ найден: она переживает
 * ребейзы конвейера. Одно имя на обеих ссылках — одна запись. Чтение ленивое:
 * ни одной команды git, пока правило 10 не спросило документы issue, и один
 * раз на issue.
 */
export function gitSpecReviewReader({ repo = process.cwd(), head = 'HEAD', run = spawnSync } = {}) {
  const git = (args) => {
    const r = run('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return r && r.status === 0 ? r.stdout : null;
  };
  let refs = null;
  const cache = new Map();
  return {
    head,
    read(nn) {
      if (cache.has(nn)) return cache.get(nn);
      if (!refs) {
        refs = [head];
        if (git(['rev-parse', '--verify', '-q', 'refs/remotes/origin/dev']) !== null) refs.push('refs/remotes/origin/dev');
      }
      const name = new RegExp(`^docs/reviews/(SPEC-REVIEW-${nn}-r\\d+\\.md)$`);
      const byName = new Map();
      for (const ref of refs) {
        const listing = git(['ls-tree', '--name-only', ref, 'docs/reviews/']);
        if (listing === null) continue;
        for (const path of listing.split('\n').map((s) => s.trim())) {
          const m = name.exec(path);
          if (!m || byName.has(m[1])) continue;
          byName.set(m[1], {
            name: m[1],
            ref,
            text: git(['show', `${ref}:${path}`]) ?? '',
            addedAt: (git(['log', '-1', '--diff-filter=A', '--format=%aI', ref, '--', path]) ?? '').trim(),
          });
        }
      }
      const docs = [...byName.values()];
      cache.set(nn, docs);
      return docs;
    },
  };
}

function ghRunner(nwo, bin) {
  return (nn) => {
    const r = spawnSync(bin, ['issue', 'view', String(nn), '--repo', nwo, '--json', 'number,state,labels,body'],
      { encoding: 'utf8' });
    return r.status === 0
      ? { ok: true, json: r.stdout }
      : { ok: false, error: (r.stderr || r.stdout || 'gh завершился с ошибкой').trim() };
  };
}

// Диапазон issue-ветки приводится к её собственным коммитам (#190).
//
// pre-push передаёт remote_old..local_new. Для fast-forward это ровно новые
// коммиты, но после обязательного ребейза issue-ветки (возврат из конфликтного
// слияния, §10.4) remote_old перестаёт быть предком local_new, и git log
// показывает всё, что недостижимо из старой вершины, — включая ушедшую вперёд
// историю dev. На #117 это дало 84 чужих коммита и 20 ложных отказов п.8 по
// уже закрытым issue, а единственным выходом оставался `--no-verify`.
//
// Правится здесь, а не в самом хуке: `.githooks/pre-push` несёт бит исполнения,
// который публикация через MCP сбрасывает (прецедент commit-msg), — правка хука
// потребовала бы локального коммита владельца. Заодно это второй страховочный
// слой для любого вызывающего с широким диапазоном, включая CI.
//
// Fail-closed сохраняется: собственные коммиты ветки относительно origin/dev
// проверяются все до одного, сужается только чужая история.
export function clampIssueBranchRange(range, { targetRef = '', isAncestor, mergeBaseWithDev } = {}) {
  if (!/^(?:refs\/heads\/)?issue\/\d+-/.test(targetRef ?? '')) return range;
  const m = /^([^.\s]+)\.\.([^.\s]+)$/.exec(range ?? '');
  if (!m) return range;
  const [, base, head] = m;
  if (isAncestor(base, head)) return range;
  const mergeBase = mergeBaseWithDev(head);
  if (!mergeBase) return range;
  return `${mergeBase}..${head}`;
}

function main(argv) {
  const flag = (name) => argv.includes(`--${name}`);
  const value = (name, dflt = null) => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return dflt;
    const next = argv[i + 1];
    return !next || next.startsWith('--') ? true : next;
  };

  const repo = value('repo', process.cwd());
  const allowed = flag('no-merged') ? STRICT_STATUS : ALLOWED_STATUS;
  const targetRef = value('target-ref', process.env.TARGET_REF ?? '');

  let range = value('range');
  if (!range && flag('github-range')) {
    // gitObjectExists ловит исключение, чтобы подменить осиротевший после
    // force-push BEFORE_SHA на origin/dev (#315). Раннер обязан бросать,
    // а не завершать процесс, как это делает git() ниже.
    range = resolveValidationRange({
      eventName: process.env.EVENT_NAME,
      beforeSha: process.env.BEFORE_SHA,
      baseSha: process.env.BASE_SHA,
      headSha: process.env.HEAD_SHA,
      developmentBranch: process.env.DEVELOPMENT_BRANCH,
    }, (args) => {
      const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(`git ${args.join(' ')} → ${(r.stderr || '').trim()}`);
      return r.stdout.trim();
    });
  }
  if (!range) {
    const hasDev = spawnSync('git', ['-C', repo, 'rev-parse', '--verify', 'origin/dev'],
      { encoding: 'utf8' }).status === 0;
    range = hasDev ? 'origin/dev..HEAD' : 'HEAD~20..HEAD';
  }
  range = clampIssueBranchRange(range, {
    targetRef,
    isAncestor: (base, head) => spawnSync(
      'git', ['-C', repo, 'merge-base', '--is-ancestor', base, head], { encoding: 'utf8' },
    ).status === 0,
    mergeBaseWithDev: (head) => {
      const r = spawnSync('git', ['-C', repo, 'merge-base', head, 'refs/remotes/origin/dev'],
        { encoding: 'utf8' });
      return r.status === 0 ? r.stdout.trim() : null;
    },
  });

  const filesOf = (sha) =>
    git(['show', '--name-only', '--pretty=format:', sha], repo)
      .split('\n').map((s) => s.trim()).filter(Boolean);
  const blobOf = (revision, path) => {
    const r = spawnSync('git', ['-C', repo, 'show', `${revision}:${path}`], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    return r.status === 0 ? r.stdout : null;
  };
  const releaseSourceViolationsOf = (sha, files) => files
    .filter((file) => /^src\//.test(file) || /^custom_components\/houseplan\/.*\.py$/.test(file))
    .filter((file) => !isReleaseVersionOnlyChange(
      file, blobOf(`${sha}^`, file), blobOf(sha, file),
    ));
  const addedFilesOf = (sha) =>
    git(['show', '--name-only', '--diff-filter=A', '--pretty=format:', sha], repo)
      .split('\n').map((s) => s.trim()).filter(Boolean);
  const commits = parseRecords(
    git(['log', '--reverse', `--pretty=format:${LOG_FORMAT}`, range], repo),
    filesOf,
    releaseSourceViolationsOf,
    addedFilesOf,
  );
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], repo).trim();

  const hasOriginMain = spawnSync(
    'git', ['-C', repo, 'rev-parse', '--verify', 'refs/remotes/origin/main'],
    { encoding: 'utf8' },
  ).status === 0;
  const mainCache = new Map();
  const isCommitOnMain = (sha) => {
    if (!hasOriginMain) return false;
    if (!mainCache.has(sha)) {
      mainCache.set(sha, spawnSync(
        'git', ['-C', repo, 'merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main'],
        { encoding: 'utf8' },
      ).status === 0);
    }
    return mainCache.get(sha);
  };
  const checkedCommits = commitsNeedingTargetValidation(
    commits, { targetRef, isCommitOnMain },
  );

  const findings = [];
  for (const c of checkedCommits) findings.push(...evaluateCommit(c));

  // Проверке 2 отдаются только коммиты самой ветки: origin/dev..HEAD, а не
  // диапазон события. См. комментарий у checkBranchRule.
  const ownCommits = /^issue\/\d+-/.test(branch)
    ? (() => {
      const hasDev = spawnSync('git', ['-C', repo, 'rev-parse', '--verify', 'origin/dev'],
        { encoding: 'utf8' }).status === 0;
      if (!hasDev) return checkedCommits;
      // filesOf обязателен: исключение #305 доказывается диффом коммита
      // (только docs/reviews/), а без файлов оно не срабатывает fail-closed.
      const own = parseRecords(
        git(['log', '--reverse', `--pretty=format:${LOG_FORMAT}`, 'origin/dev..HEAD'], repo),
        filesOf,
        releaseSourceViolationsOf,
      );
      return commitsNeedingTargetValidation(own, { targetRef, isCommitOnMain });
    })()
    : checkedCommits;
  findings.push(...checkBranchRule(branch, ownCommits));

  // Метки читаются один раз и используются дважды: проверкой 8 и escalation
  // проверки 3. Второй запрос по тому же issue — лишний сетевой вызов.
  let labelsOf = null;
  let bodyOf = null;
  if (flag('issues')) {
    const prereleaseTags = isStableTarget(targetRef)
      ? git(['tag', '--list'], repo).split('\n').map((s) => s.trim()).filter((tag) =>
        /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-[0-9A-Za-z.-]+$/.test(tag))
      : [];
    const publishedCache = new Map();
    const isPublishedPrereleaseCommit = (sha) => {
      if (!publishedCache.has(sha)) {
        publishedCache.set(sha, prereleaseTags.some((tag) =>
          spawnSync('git', ['-C', repo, 'merge-base', '--is-ancestor', sha, `${tag}^{commit}`],
            { encoding: 'utf8' }).status === 0));
      }
      return publishedCache.get(sha);
    };
    const statusCommits = commitsNeedingIssueStatus(checkedCommits, {
      targetRef, isPublishedPrereleaseCommit,
    });
    const numbers = [...new Set(statusCommits.flatMap((c) => c.issues).map((t) => t.slice(1)))];
    const runner = ghRunner(process.env.HP_REPO ?? 'Matysh/houseplan-card', process.env.GH_BIN ?? 'gh');
    const cache = new Map();
    const cached = (nn) => {
      if (!cache.has(nn)) cache.set(nn, runner(nn));
      return cache.get(nn);
    };
    const statusOptional = isInfrastructureRange(checkedCommits);
    if (statusOptional && numbers.length) {
      // Пропуск обязан быть виден: иначе исключение однажды скроет настоящее
      // нарушение и никто не узнает, что проверка не выполнялась.
      findings.push({
        level: 'warn', rule: 8, sha: '-',
        msg: `инфраструктурный диапазон (#562): файлов класса A нет, статусная метка не требуется до S7-code-review`,
      });
    }
    findings.push(...checkIssueStatuses(numbers, cached, { allowed, statusOptional }));
    if (!statusOptional) {
      const timelineRunner = ghTimelineRunner(
        process.env.HP_REPO ?? 'Matysh/houseplan-card', process.env.GH_BIN ?? 'gh',
      );
      const timelineCache = new Map();
      // #729: читатель SPEC-REVIEW передаётся всегда; git он трогает, только
      // когда в диапазоне есть черновой коммит. Вершина — правая часть --range.
      const rangeHead = /^(.*?)\.\.\.?(.+)$/.exec(range)?.[2] ?? range;
      findings.push(...checkCommitEraStatuses(statusCommits, (nn) => {
        if (!timelineCache.has(nn)) timelineCache.set(nn, timelineRunner(nn));
        return timelineCache.get(nn);
      }, { allowed, specReviews: gitSpecReviewReader({ repo, head: rangeHead }) }));
    }
    labelsOf = (nn) => {
      const r = cached(nn);
      if (!r || r.ok !== true) return null;
      try {
        const issue = typeof r.json === 'string' ? JSON.parse(r.json) : r.json;
        return (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : l.name));
      } catch {
        return null;
      }
    };
    // Тело issue — материал ТЗ с #517; по нему судит проверка 3.
    bodyOf = (nn) => {
      const r = cached(nn);
      if (!r || r.ok !== true) return null;
      try {
        const issue = typeof r.json === 'string' ? JSON.parse(r.json) : r.json;
        return typeof issue.body === 'string' ? issue.body : null;
      } catch {
        return null;
      }
    };
  }

  const specsDir = join(repo, 'docs', 'specs');
  findings.push(...checkSpecs(
    checkedCommits, existsSync(specsDir) ? readdirSync(specsDir) : null, bodyOf,
  ));
  findings.push(...checkFrozenSpecs(checkedCommits));

  const reviewDir = join(repo, 'docs', 'reviews');
  const reviewFiles = [
    ...(existsSync(reviewDir) ? readdirSync(reviewDir) : []),
    ...readdirSync(repo).filter((f) => /^(CODE|SPEC)-REVIEW-.*\.md$/.test(f)),
  ];
  findings.push(...checkReviewDocLimit(reviewFiles));

  const report = buildReport({ range, branch, commits: commits.length, findings });

  if (flag('json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`process-gate: диапазон ${range}, коммитов ${commits.length}\n`);
    for (const f of findings.filter((x) => x.level === 'fail')) {
      process.stdout.write(`FAIL п.${f.rule} ${RULES[f.rule]} ${f.sha}  ${f.msg}\n`);
    }
    for (const f of findings.filter((x) => x.level === 'warn')) {
      process.stdout.write(`WARN п.${f.rule} ${RULES[f.rule]} ${f.sha}  ${f.msg}\n`);
    }
    process.stdout.write(report.ok
      ? `гейт пройден, предупреждений ${report.warns}\n`
      : `нарушений ${report.fails}, предупреждений ${report.warns}\n`);
    if (!flag('issues')) {
      process.stdout.write('проверка 8 (статус issue) не выполнялась — добавьте --issues\n');
    }
  }

  // --report печатает находки, но не краснеет: нужен для догоняющего прогона по
  // исторической части, где нарушения известны и чиниться не будут.
  return flag('report') ? 0 : (report.ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
