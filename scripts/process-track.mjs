#!/usr/bin/env node
/**
 * Трек задачи, его основание, лимит циклов и рамки `ship` (PROCESS.md §5,
 * #695/#696/#707) — одно правило на конвейер и пакет задачи.
 *
 *   node scripts/process-track.mjs stage --stage=code|spec --labels="a,b" --branch=<имя> \
 *        --base=origin/dev --head=HEAD --comments=<json> --owner=<login> --out=<dir> [--run-url=<url>]
 *   node scripts/process-track.mjs route --stage=code|spec --track=<t> --confirmed=true|false --labels="a,b" \
 *        --verdict=<verdict.json> --spent=N --limit=N --num=NN --cycle=N --branch=<имя> --out=<dir> [--ref=HEAD --run-url=<url>]
 *   node scripts/process-track.mjs limit --labels="a,b" [--files=<список путей>]
 *   node scripts/process-track.mjs resolve --labels="a,b" --base=<ref> --head=<ref>
 *   node scripts/process-track.mjs ship-limits --base=<ref> --head=<ref>
 *
 * `stage` — шаг «Трек задачи и рамки ship» конвейера: ОДИН вызов решает трек,
 * его основание, рамки ship, риск по изменённым участкам (#707), повышение
 * ship → show, заметку риска для промпта ревью и строку риска для комментария
 * слияния ship. Печатает `track=`, `mutants=`, `full=`, `ship=`, `raise=`,
 * `golden=`, `basis=`, `risk=`; те же поля и многострочные `risk_note`/`ship_risk`
 * пишет в `$GITHUB_OUTPUT`; при `raise=true` кладёт тело комментария в
 * `<out>/raise.md`, при `golden=add` (#827) — в `<out>/golden.md`.
 * Bash шага только исполняет: логики трека в нём нет. С #726 там же
 * `confirmed=` и многострочная `route_note` — заметка маршрута для промпта.
 *
 * `route` — шаг «Решение по вердикту» (#726): ОДИН вызов на заход модели решает
 * статус, метки трека, `blocked` и `review-4` по вердикту, треку, подтверждению
 * владельца и бюджету guard. Печатает `kind=`, `green=`, `from=`, `to=`,
 * `add_labels=`, `remove_labels=`, `exhausted=`, `spent_after=`, `limit_after=`;
 * тело комментария кладёт в `<out>/comment.md`, строку сводки — в
 * `$GITHUB_STEP_SUMMARY`. Bash шага меняет метки только по этому выходу.
 *
 * `limit` — job `guard`: трек и лимит циклов по меткам и списку файлов из
 * compare API; ответ на 300 файлов и больше инфраструктуру не доказывает.
 *
 * Мутантов в разработке нет ни на одном треке (#709) — `mutants` всегда
 * `false`. Полный набор (смоки, golden, perf) на ветке задачи — только меткам
 * `ci:full` и `ci:golden` (#697). Метку `ci:golden` при визуальном риске в пути
 * отрисовки плана (`visual`, область `render`) ставит сам шаг трека на S7 — до
 * выбора Validate на материале (#827, F48); прочий риск, включая `visual` без
 * `render`, полного набора не заказывает.
 * Рамки ship механические намеренно: по ним конвейер сливает задачу без ревью
 * модели, и решать их «на глаз» некому.
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';
import { classify } from './change-classes.mjs';
import { classifyRisk, emptyRisk, riskClassLine, RISK_CLASSES, RAISING_CLASSES } from './change-risk.mjs';
import { verdictProblems, verdictRoute } from './review-result-gate.mjs';
import { blockingFromDocs } from './review-doc-guard.mjs';

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
 * Критерии §5 («Подсказка аналитику») для `show` — идентификатор поля
 * `criterion` вердикта → пункт канона дословно (К1 #726). Порядок — как в §5.
 */
export const SHOW_CRITERIA = Object.freeze({
  complexity: 'сложность и риск ≤ 3',
  surfaces: 'одна поверхность (один диалог, один модуль, один эндпоинт)',
  migration: 'нет миграции конфига и новых compatibility-полей',
  'ux-contract': 'нет нового UX-контракта — меняется поведение в рамках уже описанного',
  'perf-touch': 'нет влияния на производительность и на touch-контракт',
  undocumented: 'ожидаемое поведение уже зафиксировано — в `docs/USER-GUIDE.ru.md`, в каноническом документе подсистемы либо однозначно в самом отчёте',
});

/** Критерий из таблицы §5 — только строкой и только своим ключом. */
export const isShowCriterion = (criterion) => typeof criterion === 'string' && Object.hasOwn(SHOW_CRITERIA, criterion);

/**
 * Значение модели в тексте конвейера: только `[A-Za-z0-9_-]`, не длиннее 40 — без
 * разметки, обратных кавычек и `-->`. Поле недоверенное, его смысл судит таблица.
 */
export const safeToken = (value) => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '?').slice(0, 40);

/**
 * Заметка маршрута для промпта ревью (К4 #726). Код-ревью `show` — поля
 * `route`/`criterion` и список критериев §5; любой другой этап и трек —
 * `route: fix`. Одна строка в промпте (`route_note`), текст — здесь, под тестом.
 */
export function routeNote({ stage = 'code', track = 'ask', confirmed = false } = {}) {
  if (stage !== 'code' || track !== 'show') return '**Маршрут вердикта (#726):** `route: fix`.';
  const after = confirmed
    ? 'трек show подтверждён владельцем — конвейер его не повысит, а поставит `blocked` и задаст владельцу вопрос'
    : 'конвейер сам переведёт задачу в `track:ask` и `S3-spec`, код останется в ветке';
  return [
    `**Маршрут вердикта (#726).** \`route: reclassify\` и \`criterion\` — если задача не проходит критерий §5 из списка ниже; иначе \`route: fix\`. \`reclassify\` — не зелёный вердикт: ${after}.`,
    ...Object.entries(SHOW_CRITERIA).map(([id, text]) => `- \`${id}\` — ${text}`),
  ].join('\n');
}

/**
 * Заметка риска для промпта ревью `show`/`ask` (К3 #707), не длиннее
 * `RISK_NOTE_LINE_LIMIT` строк; пустой риск — пустая строка. Риск — вопрос
 * ревьюеру: трек по риску не меняется, а по вердикту ревьюера — да
 * (`route: reclassify`, #726).
 */
export function riskNote({ track, confirmed = false, risk, labels = [] } = {}) {
  if (!risk?.classes?.length) return '';
  const lines = [];
  const raising = risk.raising || [];
  if (raising.length && (track === 'show' || track === 'ask')) {
    if (track === 'show' && !confirmed) {
      lines.push('**Риск по изменённым участкам (#707).** Трек show держится на «решать нечего» (PROCESS.md §5). По каждому классу ниже назови документ или AC, где поведение уже зафиксировано; не нашёл — `route: reclassify` с названным критерием §5 (#726).');
    } else if (track === 'show') {
      lines.push('**Риск по изменённым участкам (#707).** Трек show подтверждён владельцем. По каждому классу ниже назови документ или AC, где поведение уже зафиксировано; трек не повышать: не нашёл — `route: reclassify` с критерием, и конвейер задаст вопрос владельцу, вариант по умолчанию «повысить до ask» (#726).');
    } else {
      lines.push('**Риск по изменённым участкам (#707).** Трек ask: сверь, что каждый класс ниже покрыт AC ТЗ.');
    }
    for (const cls of raising) lines.push(`- ${riskClassLine(risk, cls)}`);
  }
  if (risk.visual?.render && !labels.includes('ci:golden')) {
    // #827: метку в этом случае ставит конвейер до выбора Validate — ревью
    // начинается уже после golden на этом материале.
    lines.push('Визуальный риск в пути отрисовки плана: конвейер поставил ci:golden (#827), и Validate на этом материале прогнал golden. Сверь: сдвига кадров нет либо он намерен и принят в задаче (PROCESS.md §3 п.13, §5.1).');
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

/**
 * Комментарий шага трека, поставившего `ci:golden` (#827): причина — классом
 * и путями, последствие — какой Validate теперь доказательство. Машинная
 * строка `hp:golden-added` — последней.
 */
export function goldenComment({ risk = null, runUrl = '' } = {}) {
  const parts = [
    '**Конвейер поставил `ci:golden` (#827).** Изменённые участки — путь отрисовки плана (класс `visual`, область `render`, PROCESS.md §5.1):',
    `- ${riskClassLine(risk, 'visual')}`,
    'Ревью и слияние этого захода — только после Validate с golden на этом материале (`full=true`): лёгкий Validate без golden доказательством не считается. Совместимое полное доказательство на том же материале переиспользуется, а не повторяется.',
    'Сдвиг кадров, если он намерен, задача принимает сама (PROCESS.md §3 п.13); ненамеренный покажет красный golden до ревью. Прочие метки не меняются.',
  ];
  if (runUrl) parts.push(`[Прогон](${runUrl}).`);
  parts.push('<!-- hp:golden-added -->');
  return `${parts.join('\n\n')}\n`;
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
  // #827 (F48): визуальный риск в пути отрисовки без `ci:golden` — метку ставит
  // конвейер, и полный набор выбирается уже по ней. Стоящая метка — не повод
  // для второго комментария: повтор события ничего не добавляет.
  const goldenAdd = code && Boolean(risk.visual?.render) && !labels.includes('ci:golden');
  const golden = goldenAdd ? 'add' : (labels.includes('ci:golden') ? 'present' : 'none');
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
    track, mutants: base.mutants, full: base.full || goldenAdd, infrastructure: base.infrastructure, ship, raise, comment, violations,
    golden, goldenComment: goldenAdd ? goldenComment({ risk, runUrl }) : '',
    risk, confirmed, basis, warning: origin.warning,
    note: code && !ship ? riskNote({ track, confirmed, risk, labels }) : '',
    // #726: на ship модель не зовётся — заметка маршрута не нужна.
    routeNote: ship ? '' : routeNote({ stage, track, confirmed }),
    shipRisk: ship ? shipRiskText({ risk, confirmed: origin.confirmed }) : '',
  };
}

const STATUS_FROM = { spec: 'S4-spec-review', code: 'S7-code-review' };
const STATUS_GREEN = { spec: 'S5-ready', code: 'S8-merged' };
const STATUS_BACK = { spec: 'S3-spec', code: 'S6-in-progress' };
const nonNegative = (value, fallback) => {
  const n = Number(value);
  return value !== '' && value !== null && value !== undefined && Number.isInteger(n) && n >= 0 ? n : fallback;
};

/**
 * Решение по вердикту модели (К2 #726) — чистая функция; метки меняет только
 * bash шага «Решение по вердикту», по этому выходу.
 *
 * Вперёд двигает только зелёный вердикт с High 0 (§7.2). Не зелёный — цикл
 * (§4): возврат автору, `fix`. Маршрут `reclassify` применяется только на
 * код-ревью `show` с критерием из `SHOW_CRITERIA`: без подтверждения
 * владельца — `track:ask` и `S3-spec`, с подтверждением — `blocked` и вопрос
 * владельцу (трек не меняется). Иначе — `fix` с `note`.
 *
 * Исчерпание (К3): `spentAfter = spent + 1`, лимит — трека после маршрута
 * (`cycleLimit('ask')` у `reclassify`, иначе `limit` guard). Вердикт,
 * исчерпавший бюджет, сам ставит `review-4`; статус двигается по таблице.
 * Бюджет этапа один на все треки: счёт не обнуляется, меняется только лимит.
 *
 * `labels` — текущие метки issue, если известны: тогда уже стоящие метки не
 * добавляются, а снимается только то, что стоит.
 */
export function reviewRoute({
  stage = 'code', track = 'ask', confirmed = false, verdict = '', high = 0, route = 'fix', criterion = '',
  spent = 0, limit, labels = null,
} = {}) {
  const st = stage === 'spec' ? 'spec' : 'code';
  const spentBefore = nonNegative(spent, 0);
  const limitBefore = nonNegative(limit, cycleLimit(track));
  const known = Array.isArray(labels);
  const base = {
    from: STATUS_FROM[st], route: route === 'reclassify' ? 'reclassify' : 'fix',
    criterion: isShowCriterion(criterion) ? criterion : '',
  };
  if (verdict === 'green' && Number(high) === 0) {
    return {
      ...base, green: true, to: STATUS_GREEN[st], addLabels: [], removeLabels: [], exhausted: false, kind: 'green',
      note: '', track, spentAfter: spentBefore, limitAfter: limitBefore,
    };
  }
  let kind = 'fix'; let to = STATUS_BACK[st]; let note = ''; let trackAfter = track;
  const add = []; const remove = [];
  if (route === 'reclassify') {
    let why = '';
    if (st !== 'code') why = 'этап `spec` — трек по вердикту меняется только на код-ревью';
    else if (track !== 'show') why = `трек \`${safeToken(track)}\` — повышение по вердикту только с \`show\``;
    else if (!isShowCriterion(criterion)) {
      why = criterion === '' || criterion == null
        ? 'критерий §5 не назван'
        : `критерий \`${safeToken(typeof criterion === 'string' ? criterion : JSON.stringify(criterion))}\` не из списка §5 (${Object.keys(SHOW_CRITERIA).join(', ')})`;
    }
    if (why) {
      note = `маршрут reclassify не применён: ${why}`;
    } else if (confirmed) {
      kind = 'owner-question';
      add.push('blocked');
    } else {
      kind = 'reclassify'; to = 'S3-spec'; trackAfter = 'ask';
      add.push('track:ask');
      if (!known || labels.includes('track:show')) remove.push('track:show');
    }
  }
  const spentAfter = spentBefore + 1;
  const limitAfter = kind === 'reclassify' ? cycleLimit('ask') : limitBefore;
  const exhausted = spentAfter >= limitAfter;
  if (exhausted) add.push('review-4');
  return {
    ...base, green: false, to, addLabels: known ? add.filter((label) => !labels.includes(label)) : add, removeLabels: remove,
    exhausted, kind, note, track: trackAfter, spentAfter, limitAfter,
  };
}

const reviewDocPath = (name) => `docs/reviews/${name}`;
const roundOf = (name) => Number((String(name).match(/-r(\d+)\.md$/) || [])[1]);

/**
 * Комментарий шага решения по вердикту (К3 #726); пустая строка — писать
 * нечего (зелёный, обычный `fix`). Один комментарий на заход: исчерпание
 * первым (по префиксу его узнаёт `wait-verdict.mjs`), затем маршрут, затем
 * `note`. Машинная строка `hp:route` — последней.
 *
 * `docs` — документы этапа ЭТОЙ задачи из ветки материала `[{ name, text }]`
 * (документ этого захода уже опубликован); `blocking` — имена прежних
 * документов с блокирующим вердиктом.
 */
export function routeComment({
  decision, stage = 'code', num = '', cycle = '', branch = '', spent = 0, docs = [], blocking = [], runUrl = '',
} = {}) {
  if (!decision || decision.kind === 'green') return '';
  const st = stage === 'spec' ? 'spec' : 'code';
  const marker = st === 'spec' ? 'SPEC-REVIEW' : 'CODE-REVIEW';
  const current = `${marker}-${num}-r${cycle}.md`;
  const own = docs.map((doc) => doc.name).filter((name) => Number.isFinite(roundOf(name)))
    .sort((a, b) => roundOf(a) - roundOf(b));
  if (!own.includes(current)) own.push(current);
  const where = branch ? `ветки \`${branch}\`` : '`dev`';
  const id = decision.criterion;
  const text = id ? SHOW_CRITERIA[id] : '';
  const parts = [];
  if (decision.exhausted) {
    const previous = blocking.filter((name) => name !== current).sort((a, b) => roundOf(a) - roundOf(b));
    const rest = nonNegative(spent, 0) - previous.length;
    const options = [
      '1. **разделить** — issue закрывается как «заменён», вместо него 2–3 меньших с ясным скоупом;',
      '2. **отклонить** — цена решения оказалась выше ценности;',
      '3. **арбитраж владельца** — решение фиксируется в issue и принимается как есть.',
    ];
    if (decision.track === 'show' && decision.kind !== 'reclassify') {
      options[2] = options[2].replace(/\.$/, ';');
      options.push('4. **повысить до `ask`**: лимит станет 4, `review-4` снимает владелец.');
    }
    parts.push(
      `Лимит циклов ревью исчерпан: блокирующих циклов ${decision.spentAfter} из ${decision.limitAfter} на этапе \`${st}\` — последний израсходовал этот вердикт (заход r${cycle}). Задача возвращена в \`${decision.to}\` и получила \`review-4\`: следующего захода нет, решение владельца (PROCESS.md §4).`,
      [
        'Учтены вердикты с блокирующими находками — зелёные бюджет не тратят:',
        ...previous.map((name) => `- \`${reviewDocPath(name)}\``),
        ...(rest > 0 ? [`- ещё ${rest} — по комментариям с вердиктом (страховка счёта, #454)`] : []),
        `- \`${reviewDocPath(current)}\` — этот заход`,
      ].join('\n'),
      ['Варианты решения (§4):', ...options].join('\n'),
    );
  }
  if (decision.kind === 'reclassify') {
    parts.push(
      '**Ревью show: решать есть что — трек повышен до `track:ask`.**',
      `Задача не проходит критерий §5: **${text}** (\`${id}\`). Трек \`show\` держится на «решать нечего», а ревью нашло, что решать есть что (PROCESS.md §5).`,
      [`Документы код-ревью ${where}:`, ...own.map((name) => `- \`${reviewDocPath(name)}\``)].join('\n'),
      'Задача переведена в `S3-spec`: код остаётся в ветке; полное ТЗ по §7.1 — в теле issue под `## ТЗ`; коммиты класса A — после `S5`. Дальше — ревью ТЗ (`S4-spec-review`) со своим бюджетом этапа `spec`.',
      `Бюджет код-ревью: ${decision.spentAfter}/${decision.limitAfter} — блокирующие вердикты прежних заходов остаются в счёте, у \`ask\` лимит ${cycleLimit('ask')} (PROCESS.md §4).`,
    );
  } else if (decision.kind === 'owner-question') {
    parts.push(
      '**Ревью show: решать есть что — вопрос владельцу.**',
      `Трек \`show\` подтверждён владельцем, и конвейер его не повышает (PROCESS.md §5): задача в \`${decision.to}\` с \`blocked\`.`,
      [
        `- **Что неясно:** выполнен ли критерий §5 «${text}» (\`${id}\`). Ревью считает, что нет: вердикт — \`${reviewDocPath(current)}\` ${where} и комментарий ревьюера.`,
        `- **Что изменится от ответа:** \`ask\` — полное ТЗ по §7.1 и ревью ТЗ до новой правки кода, лимит код-ревью ${cycleLimit('ask')}; \`show\` — автор чинит по вердикту, лимит ${decision.limitAfter}.`,
        '- **Вариант по умолчанию:** повысить до `track:ask`.',
      ].join('\n'),
      'Как ответить: повысить — метка `track:ask` (и строка `Трек: ask — решение владельца`) и снять `blocked`, задача уходит в `S3-spec` на полное ТЗ; оставить `show` — снять `blocked`, автор чинит по вердикту.',
      `Бюджет код-ревью: ${decision.spentAfter}/${decision.limitAfter}.`,
    );
  }
  if (decision.note) {
    const [first, ...tail] = decision.note;
    parts.push(`${first.toUpperCase()}${tail.join('')}. Вердикт возвращает задачу автору как \`fix\`: \`${decision.to}\`.`);
  }
  if (!parts.length) return '';
  if (runUrl) parts.push(`[Прогон](${runUrl}).`);
  if (decision.kind === 'reclassify' || decision.kind === 'owner-question') {
    parts.push(`<!-- hp:route ${decision.kind} criterion=${id} -->`);
  }
  return `${parts.join('\n\n')}\n`;
}

/** Строка сводки прогона: маршрут и бюджет после вердикта (К4 #726). */
export function routeSummary({ decision, stage = 'code' } = {}) {
  const criterion = decision.criterion ? ` (критерий \`${decision.criterion}\`)` : '';
  return `- маршрут вердикта **${decision.kind}**${criterion} → \`${decision.to}\` · блокирующих циклов этапа ${stage === 'spec' ? 'spec' : 'code'}: ${decision.spentAfter}/${decision.limitAfter}${decision.exhausted ? ' · `review-4`' : ''}${decision.note ? ` · ${decision.note}` : ''}\n`;
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
      // #827: тело комментария о поставленной ci:golden — только когда шаг её ставит.
      rmSync(join(out, 'golden.md'), { force: true });
      if (decision.golden === 'add') writeFileSync(join(out, 'golden.md'), decision.goldenComment);
      const basis = `${decision.basis}${decision.warning ? ` · внимание: ${decision.warning}` : ''}`;
      // #726: `confirmed` — для шага решения по вердикту (owner-question).
      const lines = [
        `track=${decision.track}`, `mutants=${decision.mutants}`, `full=${decision.full}`, `ship=${decision.ship}`,
        `raise=${decision.raise}`, `confirmed=${decision.confirmed}`, `golden=${decision.golden}`, `basis=${basis}`,
        `risk=${decision.risk.classes.join(',')}`,
      ];
      for (const line of lines) console.log(line);
      if (decision.violations.length) console.log(`violations=${decision.violations.join('; ')}`);
      if (decision.note) console.log(`risk_note:\n${decision.note}`);
      if (decision.routeNote) console.log(`route_note:\n${decision.routeNote}`);
      if (process.env.GITHUB_OUTPUT) {
        const block = (name, text) => {
          if (!text) return '';
          const delimiter = `HP_TRACK_${randomUUID()}`;
          return `${name}<<${delimiter}\n${text}\n${delimiter}\n`;
        };
        appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n${block('risk_note', decision.note)}${block('route_note', decision.routeNote)}${block('ship_risk', decision.shipRisk)}`);
      }
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- трек **${decision.track}** · основание: ${basis} · риск по участкам: ${decision.risk.classes.join(', ') || 'нет'} · полный набор: ${decision.full} · слияние без модели: ${decision.ship}${decision.raise ? ' · повышен ship → show' : ''}${decision.golden === 'add' ? ' · ci:golden поставлен конвейером (visual/render)' : ''}\n`);
      }
    } else if (command === 'route') {
      // #726: шаг «Решение по вердикту» — один вызов на заход модели.
      const out = value('out');
      if (!out) throw new Error('--out is required');
      const stage = value('stage') === 'spec' ? 'spec' : 'code';
      const verdictPath = value('verdict');
      if (!verdictPath || !existsSync(verdictPath)) throw new Error(`verdict.json не найден: ${verdictPath || '(путь не задан)'}`);
      const verdict = JSON.parse(readFileSync(verdictPath, 'utf8'));
      // Граница доверия уже судила этот файл (#556); повтор — защита от сбоя шага.
      const problems = verdictProblems(verdict);
      if (problems.length) throw new Error(`вердикт отвергнут: ${problems.join('; ')}`);
      for (const [name, fallback] of [['spent', '0'], ['limit', '4']]) {
        if (nonNegative(value(name), null) === null) console.log(`::warning::--${name}=«${value(name)}» не число — берётся ${fallback}, как в guard`);
      }
      const num = value('num');
      const cycle = value('cycle');
      const decision = reviewRoute({
        stage, track: value('track') || 'ask', confirmed: value('confirmed') === 'true',
        verdict: verdict.verdict, high: verdict.high, route: verdictRoute(verdict), criterion: verdict.criterion ?? '',
        spent: value('spent'), limit: nonNegative(value('limit'), 4), labels: rest.some((a) => a.startsWith('--labels=')) ? labels : null,
      });
      // Документы этапа этой задачи — из ветки материала (рабочая копия после публикации).
      const marker = stage === 'spec' ? 'SPEC-REVIEW' : 'CODE-REVIEW';
      const ref = value('ref') || 'HEAD';
      const listed = spawnSync('git', ['ls-tree', '--name-only', `${ref}:docs/reviews`], { encoding: 'utf8' });
      const own = new RegExp(`^${marker}-${/^\d+$/.test(num) ? num : 'x'}-r\\d+\\.md$`);
      const docs = (listed.status === 0 ? listed.stdout : '').split('\n').filter((name) => own.test(name)).map((name) => {
        const shown = spawnSync('git', ['show', `${ref}:docs/reviews/${name}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        return { name, text: shown.status === 0 ? shown.stdout : '' };
      });
      const comment = routeComment({
        decision, stage, num, cycle, branch: value('branch'), spent: nonNegative(value('spent'), 0), docs,
        blocking: blockingFromDocs(docs).blocking, runUrl: value('run-url'),
      });
      mkdirSync(out, { recursive: true });
      const commentPath = join(out, 'comment.md');
      rmSync(commentPath, { force: true });
      if (comment) writeFileSync(commentPath, comment);
      for (const line of [
        `kind=${decision.kind}`, `green=${decision.green}`, `verdict=${verdict.verdict}`, `high=${verdict.high}`,
        `from=${decision.from}`, `to=${decision.to}`,
        `add_labels=${decision.addLabels.join(',')}`, `remove_labels=${decision.removeLabels.join(',')}`,
        `exhausted=${decision.exhausted}`, `spent_after=${decision.spentAfter}`, `limit_after=${decision.limitAfter}`,
        `track=${decision.track}`, `criterion=${decision.criterion}`, `note=${decision.note}`,
        `comment=${comment ? commentPath : ''}`,
      ]) console.log(line);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, routeSummary({ decision, stage }));
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
      throw new Error('usage: process-track.mjs stage --stage=code|spec --labels=a,b --branch=<b> --base=<ref> --out=<dir> [--head --comments --owner --run-url] | route --stage=code|spec --track=<t> --confirmed=true|false --verdict=<verdict.json> --spent=N --limit=N --num=NN --cycle=N --out=<dir> [--labels --branch --ref --run-url] | limit --labels=a,b [--files=<file>] | resolve --labels=a,b [--base=<ref> --head=<ref>] | ship-limits --base=<ref> [--head=<ref>]');
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
