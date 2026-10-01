#!/usr/bin/env node
// Пакет задачи — производное представление, а не новый источник статуса (#496).
//
// Агент, берущий задачу, сегодня собирает одно и то же руками из четырёх мест:
// метки и комментарии issue, ветку и её положение относительно dev, документы
// ревью с их якорями, состояние Validate на вершине. Каждый раз — свои ходы,
// свои ошибки («метка встала раньше push'а», «ревьюер читал не тот SHA»).
// Скрипт делает эту сборку детерминированно и печатает один markdown-пакет:
//
//   issue · статус и трек · трек: основание, лимит, ребейз (#707) · что можно
//   делать в этом статусе · черновик во время ревью ТЗ (#729) · решения
//   владельца · материал (ветка, SHA, база, Validate) · следующий шаг по
//   ветке · риск по участкам · обязательные проверки · changelog и визуальное
//   свидетельство · предыдущий вердикт · AC → свидетель · непроверенное
//
// Источник правды остаётся GitHub и git: пакет ничего не пишет и ничего не
// решает. Все чтения инъектируемы — `buildPacket(inputs)` чист и покрыт тестами.
//
//   node scripts/task-packet.mjs --issue 437 [--repo Matysh/houseplan-card] [--json]

import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import {
  anchorIssueBodyFrom, anchorTreeFrom, anchorVerdictFrom, issueBodyDigest, verdictDeclaration,
} from './review-doc-guard.mjs';
import { classify } from './process-gate.mjs';
import {
  classifyRisk, cycleLimit, hasTrackLabel, rebaseBeforeReview, riskClassLine, trackFromLabels, trackOrigin,
} from './process-track.mjs';
import { CALL_CONTEXT_LINES, selectSmokes } from './smoke-select.mjs';

export const STATUS_LABELS = ['S1-new', 'S2-analysis', 'S3-spec', 'S4-spec-review', 'S5-ready', 'S6-in-progress', 'S7-code-review', 'S8-merged'];

/** Что разрешено в статусе — по PROCESS.md, без домыслов. */
export function rightsFor(status, labels = [], { infrastructure = false, infrastructureHint = false, track = null } = {}) {
  const blocked = labels.includes('blocked');
  const exhausted = labels.includes('review-4');
  const code = !infrastructure && ['S5-ready', 'S6-in-progress', 'S7-code-review'].includes(status);
  // #729: на `track:ask` в `S4-spec-review` локальный черновик разрешён (§11.8),
  // в ветку код по-прежнему только после `S5`; под blocked/review-4 — нет.
  const specReview = !infrastructure && status === 'S4-spec-review' && track === 'ask';
  const draft = specReview && !blocked && !exhausted;
  const lines = [];
  if (exhausted) lines.push('review-4: лимит циклов исчерпан — решение владельца (разделить, отклонить, арбитраж); дальше не двигать');
  if (blocked) lines.push('blocked: работа стоит, ждём внешнего решения — коммиты по задаче гейт не пропустит');
  if (draft) {
    lines.push('продуктовый код в ветку — НЕЛЬЗЯ до `S5` (правило №1)');
    lines.push('черновик локально — МОЖНО (§11.8): ветка `issue/NN-slug` не пушится, трейлер — в разделе «Черновик»');
  } else {
    lines.push(code
      ? 'продуктовый код трогать МОЖНО (правило №1)'
      : infrastructure
        ? 'файлы класса A трогать НЕЛЬЗЯ; инфраструктурную реализацию МОЖНО вести сразу по issue (#562)'
        : 'продуктовый код трогать НЕЛЬЗЯ: статус не S5/S6/S7 (правило №1)');
  }
  if (specReview && !draft) lines.push(`черновик не ведётся (§11.8): ${exhausted ? 'review-4' : 'blocked'}`);
  if (infrastructureHint) {
    lines.push('метка infra — только подсказка, не доказательство и не право: до ветки проверь предполагаемые пути; без class A начинай сразу, при любом class A нужен продуктовый S-flow (#562)');
  }
  switch (status) {
    case 'S1-new': lines.push('следующий шаг: аналитика (S2) — оценки и трек метками (по умолчанию track:show); на track:ship — строка «что меняется и чем проверить» под «## ТЗ», затем S5'); break;
    case 'S2-analysis': lines.push('следующий шаг: track:show — до трёх AC под «## ТЗ», затем S5; track:ask — ТЗ (S3) с названным критерием §5'); break;
    case 'S3-spec': lines.push('следующий шаг: ТЗ готово → push ветки → метка S4-spec-review (метку после push)'); break;
    case 'S4-spec-review': lines.push('идёт ревью ТЗ: ждать вердикт (scripts/wait-verdict.mjs), не править материал'); break;
    case 'S5-ready': lines.push('следующий шаг: ветка issue/NN-slug от dev, код по ТЗ, метка S6-in-progress'); break;
    case 'S6-in-progress': lines.push('следующий шаг: gate:small + смоки по AC → push ветки → метка S7-code-review (метку после push)'); break;
    case 'S7-code-review': lines.push('идёт код-ревью: ждать вердикт, ничего не пушить в ветку — вердикт привязан к SHA (#312)'); break;
    case 'S8-merged': lines.push('код в dev, ждёт беты; ничего не делать; issue закроет владелец при выпуске'); break;
    default:
      lines.push(infrastructure
        ? 'инфраструктурный вход: реализовать и проверить → push ветки → S7-code-review; ТЗ и S1–S6 не нужны (#562)'
        : infrastructureHint
          ? 'предварительный инфраструктурный вход: после проверки отсутствия class A реализовать → push ветки → S7-code-review; diff станет окончательным доказательством'
          : 'статусной метки нет — продуктовая задача вне процесса; вход — первая S*-метка владельца');
  }
  return lines;
}

/** AC из текста ТЗ или тела issue: строки таблицы `| ACn |` и маркеры `ACn` в начале. */
export function extractAcceptanceCriteria(text) {
  const out = new Map();
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    let m = line.match(/^\|\s*\**(AC\d+)\**\s*\|\s*([^|]*)\|/);
    if (!m) m = line.match(/^(?:[-*]\s*)?\**(AC\d+)\**[.:)\s-]+(.*)$/);
    if (!m) continue;
    if (!out.has(m[1])) out.set(m[1], m[2].trim().slice(0, 160));
  }
  return [...out.entries()].map(([id, text]) => ({ id, text }));
}

/** Где в документе ревью упомянут AC: «проверен» или «без записи». */
export function evidenceFor(acs, reviewDocText) {
  const text = String(reviewDocText ?? '');
  return acs.map((ac) => {
    const re = new RegExp(`(^|[^A-Z0-9])(${ac.id})(?![0-9])`, 'm');
    const m = re.exec(text);
    if (!m) return { ...ac, evidence: 'без записи в последнем документе ревью' };
    const start = m.index + m[1].length;
    const line = text.slice(start).split('\n')[0].replace(/^\W+/, '').slice(0, 140);
    return { ...ac, evidence: line };
  });
}

/** Решения владельца: его комментарии с заголовками/словами решения, свежие первыми. */
export function ownerDecisions(comments, owner) {
  return (comments || [])
    .filter((c) => c.author === owner && /решени|ответ|принима|утвержда|делаем|не делаем|owner|decision/i.test(String(c.body)))
    .slice(-5)
    .map((c) => ({ at: c.createdAt, head: String(c.body).trim().split('\n')[0].replace(/^#+\s*/, '').slice(0, 140), url: c.url }));
}

/** Последний вердикт этапа по комментариям (страховка) и по документу (запись конвейера). */
export function lastVerdict(comments, docs, stage) {
  const marker = stage === 'spec' ? 'SPEC-REVIEW' : 'CODE-REVIEW';
  const fromComments = (comments || []).map((c) => ({ ...c, line: verdictDeclaration(c.body) }))
    .filter((c) => c.line && new RegExp(`${marker}|заход r\\d+`).test(c.body));
  const latestComment = fromComments.at(-1) || null;
  const numbered = (docs || [])
    .map((d) => ({ ...d, round: Number((d.name.match(/-r(\d+)\.md$/) || [])[1]) }))
    .filter((d) => d.name.startsWith(`${marker}-`) && Number.isFinite(d.round))
    .sort((a, b) => b.round - a.round);
  const latestDoc = numbered[0] || null;
  return {
    comment: latestComment ? { at: latestComment.createdAt, line: latestComment.line.trim(), url: latestComment.url } : null,
    doc: latestDoc ? {
      name: latestDoc.name, round: latestDoc.round,
      tree: anchorTreeFrom(latestDoc.text), recorded: anchorVerdictFrom(latestDoc.text),
    } : null,
  };
}

/**
 * Дифф ветки как доказательство ускоренного инфраструктурного трека (#562).
 * Документы ревью (`docs/reviews/**`, класс C) пишет конвейер и сама ветка
 * ревью ТЗ — они не материал задачи и классификацию не двигают (#632): ветка
 * продуктовой S6-задачи до первого кодового коммита содержит только
 * SPEC-REVIEW и не должна выглядеть инфраструктурной.
 */
export function branchIsInfrastructure(changedFiles = []) {
  const material = changedFiles.filter((name) => !name.startsWith('docs/reviews/'));
  return material.length > 0 && !material.some((name) => classify(name) === 'A');
}

/**
 * Последний зелёный SPEC-REVIEW задачи (#729): запись конвейера `green` с
 * High 0 и строкой «Тело issue:» — те же якоря, что читает гейт. Из
 * подходящих — наибольший заход; нет — `null`.
 */
export function latestGreenSpecReview(specDocs = [], number = null) {
  const name = new RegExp(`^SPEC-REVIEW-${number ?? '\\d+'}-r(\\d+)\\.md$`);
  let best = null;
  for (const doc of specDocs) {
    const m = name.exec(String(doc?.name ?? ''));
    if (!m) continue;
    const recorded = anchorVerdictFrom(doc.text);
    if (!recorded || recorded.verdict !== 'green' || recorded.high !== 0) continue;
    const body = anchorIssueBodyFrom(doc.text);
    if (!body) continue;
    const round = Number(m[1]);
    if (!best || round > best.round) best = { doc: doc.name, round, body };
  }
  return best;
}

/**
 * Черновик кода во время ревью ТЗ (#729, PROCESS.md §11.8): можно ли вести его
 * сейчас, строка трейлера и зелёное ревью ТЗ, с которым гейт сверит черновые
 * коммиты. Хеш — `issueBodyDigest`, та же функция, что пишет «Тело issue:» в
 * якорь документа ревью.
 */
export function specDraftState({ status = null, labels = [], track = null, body = '', specDocs = [], number = null } = {}) {
  const bodyNow = issueBodyDigest(body ?? '');
  const stop = labels.includes('review-4') ? 'review-4' : labels.includes('blocked') ? 'blocked' : null;
  let allowed = false;
  let reason;
  if (status !== 'S4-spec-review') reason = `статус ${status || 'без S-метки'}: черновик ведётся только в S4-spec-review (§11.8)`;
  else if (track !== 'ask') reason = `трек ${track}: черновик только на track:ask (§11.8)`;
  else if (stop) reason = `${stop}: черновик не ведётся (§11.8)`;
  else {
    allowed = true;
    reason = 'track:ask в S4-spec-review: черновик можно вести локально (§11.8)';
  }
  const green = latestGreenSpecReview(specDocs, number);
  return {
    allowed,
    reason,
    trailer: allowed ? `Spec-Draft: sha256:${bodyNow}` : null,
    green,
    bodyNow,
    bodyChanged: green ? green.body !== bodyNow : null,
  };
}

const PRE_CODE_STATUSES = ['S1-new', 'S2-analysis', 'S3-spec', 'S4-spec-review', 'S5-ready'];

// Трек по меткам — одна функция на конвейер и пакет (#696): process-track.mjs.
// С #707 оттуда же основание трека, лимит циклов, политика ребейза и риск по
// изменённым участкам: пакет не держит своей копии правила.
export { classifyRisk, cycleLimit, hasTrackLabel, rebaseBeforeReview, trackFromLabels, trackOrigin };
// Хеш тела issue — одна функция с конвейером и гейтом (#729): review-doc-guard.mjs.
export { issueBodyDigest };

/** Зеркала junction limits: правка любого требует parity (§8, #548). */
export const JUNCTION_MIRRORS = Object.freeze([
  'src/junction-limits.ts', 'custom_components/houseplan/junction_limits.py', 'test/fixtures/junction-limits-parity.json',
]);
const CHANGELOGS = ['docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md'];
const JUNCTION_PARITY = 'npx tsc -p tsconfig.junction-parity.json && node scripts/fix-test-build.mjs && python tests_backend/junction_parity.py --build-dir=test-build/junction-parity';

/**
 * Чистота слияния ветки с `dev` без касания рабочей копии:
 * `git merge-tree --write-tree` (git 2.38+). `clean: null` — проверить нельзя
 * (старый git или сбой), и это не «конфликта нет».
 */
export function readMergeState({ cwd, onto = 'origin/dev', ref, run = spawnSync } = {}) {
  const r = run('git', ['merge-tree', '--write-tree', '--name-only', '--no-messages', onto, ref], { cwd, encoding: 'utf8' });
  if (r?.error || (r?.status !== 0 && r?.status !== 1)) return { clean: null, conflicts: [] };
  if (r.status === 0) return { clean: true, conflicts: [] };
  const conflicts = [];
  for (const line of String(r.stdout || '').split('\n').slice(1)) {
    if (!line.trim()) break;
    if (!conflicts.includes(line.trim())) conflicts.push(line.trim());
  }
  return { clean: false, conflicts };
}

/** Следующий шаг по положению ветки относительно `dev` (#707): без лишнего ребейза. */
export function nextStepLines({ branch = null, track = 'ask' } = {}) {
  if (!branch || !(branch.behind > 0)) return [];
  const behind = `позади dev на ${branch.behind}`;
  if (branch.mergeClean === true) {
    return [track === 'ask'
      ? `${behind}, слияние чистое — конвейер сам приведёт ветку к dev до ревью`
      : `${behind}, слияние чистое — ребейз не нужен: один раз при слиянии`];
  }
  if (branch.mergeClean === false) {
    const files = branch.conflicts?.length ? branch.conflicts.join(', ') : 'git не назвал файлы';
    return [`слияние с dev конфликтует: ${files} — ребейз до S7 (\`node scripts/rebase-on-dev.mjs\`)`];
  }
  return [`${behind}: чистота слияния не проверена (\`git merge-tree --write-tree\` недоступен, нужен git 2.38+)`];
}

/** Следствие риска по треку (#707): что сделает конвейер или ревьюер. */
export function riskConsequence({ track, confirmed = false, risk } = {}) {
  if (!risk?.raising?.length) return 'справочно: visual трек не повышает (§5)';
  if (track === 'ship') return confirmed ? 'не повысит; риск прочтёт пакетное ревью' : 'конвейер повысит до show при S7';
  if (track === 'show') return 'ревьюер спросит, где поведение зафиксировано; нет ссылки — повысить до ask до S7 (§5)';
  return 'справочно';
}

/**
 * Обязательные проверки «команда · основание» (#707, §8). `ci:golden` — только
 * при визуальном риске в пути отрисовки: CSS интерфейса, комментарии и тесты
 * кадров плана не двигают.
 */
export function requiredChecks({ risk = null, changedFiles = [], smokes = null, labels = [] } = {}) {
  const out = [{ command: '`npm run gate:small`', reason: 'всегда (§8)' }];
  for (const entry of smokes?.direct || []) {
    out.push({ command: `\`node demo/${entry.smoke}\``, reason: `smoke-select: прямое совпадение (${entry.symbols.slice(0, 4).join(', ')})` });
  }
  for (const entry of smokes?.registered || []) {
    out.push({ command: `\`node demo/${entry.smoke}\``, reason: `smoke-select: зарегистрированная связь (${entry.symbols.slice(0, 4).join(', ')})` });
  }
  if (smokes?.visualMinimum?.length) {
    out.push({ command: '`npm run gate:small -- --smokes`', reason: `smoke-select: визуальный минимум — связь диффа со смоками не доказана (#690): ${smokes.visualMinimum.map((s) => s.replace(/\.mjs$/, '')).join(', ')}` });
  }
  if (risk?.classes?.includes('geometry')) {
    out.push({ command: '`npm run invariants -- --config <экспорт>`', reason: 'риск geometry (§8, #254)' });
  }
  const python = changedFiles.filter((file) => /^custom_components\/.+\.py$/.test(file));
  if (python.length) {
    out.push({ command: '`python -m pytest tests_backend -q`', reason: `изменён Python: ${python.slice(0, 3).join(', ')}${python.length > 3 ? ` и ещё ${python.length - 3}` : ''}` });
  }
  const mirrors = changedFiles.filter((file) => JUNCTION_MIRRORS.includes(file));
  if (mirrors.length) out.push({ command: `\`${JUNCTION_PARITY}\``, reason: `junction parity: изменено зеркало ${mirrors.join(', ')} (§8)` });
  if (risk?.visual?.render) {
    out.push({ command: 'метка `ci:golden`', reason: labels.includes('ci:golden')
      ? 'стоит: golden на ветке и приёмка сдвинутых кадров в задаче (§5.1)'
      : 'рекомендовано, если сдвиг кадров намерен: визуальный риск в пути отрисовки (§5.1, §8)' });
  }
  return out;
}

/** Трейлеры `User-Visible` коммитов ветки и changelog в её диффе (§3 п.10, §7.1). */
export function changelogState({ commits = [], changedFiles = [], risk = null } = {}) {
  const yes = commits.filter((c) => /^User-Visible:\s*yes\s*$/im.test(String(c.message ?? ''))).length;
  const no = commits.filter((c) => /^User-Visible:\s*no\s*$/im.test(String(c.message ?? ''))).length;
  return {
    yes, no,
    missing: yes ? CHANGELOGS.filter((file) => !changedFiles.includes(file)) : [],
    visualEvidence: Boolean(risk?.visual?.render),
  };
}

/**
 * Признаки продуктового S-flow (#632). Инфраструктурная задача входит в поток
 * сразу на S7 и никогда не несёт S1–S5, ТЗ и ревью ТЗ; поэтому любой из этих
 * признаков делает эвристику «дифф без класса A» неприменимой. S6/S7/S8 сами по
 * себе признаком не являются: их носит и инфраструктурная задача после ревью.
 * Прежняя метка `trivial` — признак сама по себе (r1 #632): такие задачи шли
 * S2 → S5 без ТЗ и без ревью ТЗ, и в S6/S7 никакого другого следа потока у них
 * нет. С #695 `trivial` читается как `track:show` (PROCESS §5.1), новым задачам
 * не ставится, но на старых остаётся. Инфраструктурный вход её не несёт; `infra`
 * рядом с ней — тематическая метка.
 */
export function productFlowEvidence({ status = null, labels = [], issue = {}, specs = [], reviewDocs = [], comments = [] } = {}) {
  const reasons = [];
  if (PRE_CODE_STATUSES.includes(status)) reasons.push(`статус ${status}`);
  if (labels.includes('trivial')) reasons.push('прежняя метка trivial — продуктовый поток, читается как track:show (§5.1)');
  if (/^#{1,3}\s*ТЗ(?![\p{L}\p{N}_])/mu.test(String(issue?.body ?? ''))) reasons.push('раздел «## ТЗ» в теле issue');
  if (specs.length) reasons.push('файл ТЗ в docs/specs');
  if (reviewDocs.some((d) => String(d.name).startsWith('SPEC-REVIEW-'))) reasons.push('документ ревью ТЗ');
  else if (comments.some((c) => verdictDeclaration(c.body) && /SPEC-REVIEW-\d+/.test(String(c.body)))) reasons.push('вердикт ревью ТЗ в комментариях');
  return reasons;
}

export function buildPacket(inputs) {
  const {
    issue, labels = [], comments = [], owner = 'Matysh', branch = null, specs = [], reviewDocs = [], validate = null,
    specDocs = [],
  } = inputs;
  const status = STATUS_LABELS.find((l) => labels.includes(l)) || null;
  // Трек сначала определяется статусом и историей issue (#632): прошедшая
  // S3/S4/S5 или несущая ТЗ задача — продуктовая, и её право на класс A в
  // S5–S7 не отнимается пустым пока диффом.
  const productFlow = productFlowEvidence({ status, labels, issue, specs, reviewDocs, comments });
  // `infra` — тематическая метка и не даёт процессных прав. Ускоренный трек
  // доказывается тем же механическим признаком, что process-gate: в реальном
  // diff опубликованной ветки нет ни одного файла класса A — и только вне
  // продуктового потока.
  const infrastructure = branch?.infrastructure === true && productFlow.length === 0;
  const infrastructureHint = branch == null && status == null && labels.includes('infra') && productFlow.length === 0;
  // §5.1 (r1 #695): инфраструктурная задача без трековой метки идёт как
  // `show`; явная метка главнее. Маршрут при этом остаётся инфраструктурным —
  // вход сразу на S7, без S1–S5. Трек, основание и лимит — те же функции, что
  // у конвейера (#707).
  const origin = trackOrigin({ labels, comments, owner, infrastructure: infrastructure || infrastructureHint });
  const track = infrastructure
    ? `инфраструктурный · ${origin.track}`
    : infrastructureHint ? `инфраструктурный · ${origin.track} (предварительно; подтвердить путями/diff)`
    : origin.track;
  const mergeClean = branch ? (branch.behind > 0 ? (branch.mergeClean ?? null) : true) : null;
  const trackDetail = {
    track: origin.track, basis: origin.basis, warning: origin.warning, confirmed: origin.confirmed,
    limit: cycleLimit(origin.track),
    // null — политика зависит от чистоты слияния, а её здесь не проверить.
    rebaseBeforeReview: origin.track !== 'ask' && mergeClean === null ? null : rebaseBeforeReview(origin.track, mergeClean),
  };
  const risk = !branch ? { computed: false, reason: 'не посчитан: ветки нет' }
    : typeof branch.diff !== 'string' ? { computed: false, reason: 'не посчитан: дифф ветки не прочитан' }
    : { computed: true, ...classifyRisk(branch.diff) };
  if (risk.computed && risk.classes.length) risk.consequence = riskConsequence({ track: origin.track, confirmed: origin.confirmed, risk });
  const changedFiles = branch?.changedFiles || [];
  const stage = status === 'S4-spec-review' || status === 'S3-spec' || status === 'S5-ready' ? 'spec' : 'code';
  const verdict = lastVerdict(comments, reviewDocs, stage);
  // ТЗ живёт в теле issue (#517); архивный файл — источник только у задач до
  // перехода, у которых в теле AC нет. Порядок именно такой: тело правится и
  // после создания файла, и тогда файл описывает не тот текст, что читает
  // ревьюер.
  const fromBody = extractAcceptanceCriteria(issue.body);
  const acSource = fromBody.length || !specs.length
    ? issue.body : specs.map((s) => s.text).join('\n');
  const acs = evidenceFor(extractAcceptanceCriteria(acSource), reviewDocs.length ? reviewDocs.at(-1).text : '');
  const unverified = acs.filter((a) => a.evidence.startsWith('без записи'));
  const packet = {
    issue: { number: issue.number, title: issue.title, state: issue.state, url: issue.url },
    status, track, trackDetail, labels, productFlow,
    rights: rightsFor(status, labels, { infrastructure, infrastructureHint, track: infrastructure ? null : origin.track }),
    // #729: свой вход `specDocs` — lastVerdict, AC → свидетель и признаки
    // продуктового потока по-прежнему читают только reviewDocs.
    specDraft: specDraftState({
      status, labels, track: infrastructure ? null : origin.track, body: issue.body, specDocs, number: issue.number,
    }),
    decisions: ownerDecisions(comments, owner),
    material: branch ? {
      branch: branch.name, tip: branch.tip, base: branch.base, ahead: branch.ahead, behind: branch.behind,
      treeMatchesVerdict: verdict.doc?.tree ? branch.treeWithoutReviews === verdict.doc.tree : null,
      validate: validate || { status: 'неизвестно' },
    } : null,
    nextStep: nextStepLines({ branch: branch ? { ...branch, mergeClean } : null, track: origin.track }),
    risk,
    checks: requiredChecks({ risk: risk.computed ? risk : null, changedFiles, smokes: branch?.smokes ?? null, labels }),
    changelog: branch ? changelogState({ commits: branch.commits || [], changedFiles, risk: risk.computed ? risk : null }) : null,
    verdict,
    acceptance: acs,
    unverified: unverified.map((a) => a.id),
  };
  return packet;
}

export function renderPacket(p) {
  const L = [];
  L.push(`# Пакет задачи #${p.issue.number} — ${p.issue.title}`);
  L.push('');
  L.push(`Статус: **${p.status || 'без S-метки'}** · трек: ${p.track} · метки: ${p.labels.join(', ') || '—'} · issue ${p.issue.state}`);
  if (p.productFlow?.length) L.push(`Продуктовый поток: ${p.productFlow.join(', ')} — дифф без класса A трек не меняет (#632)`);
  L.push('');
  if (p.trackDetail) {
    const t = p.trackDetail;
    const rebase = t.rebaseBeforeReview === true ? 'да' : t.rebaseBeforeReview === false ? 'нет' : 'только при конфликте с dev (чистота слияния не проверена)';
    L.push('## Трек');
    L.push(`- ${t.track} · основание: ${t.basis}`);
    if (t.warning) L.push(`- внимание: ${t.warning}`);
    L.push(`- лимит циклов код-ревью: ${t.limit} · ребейз до ревью: ${rebase}`);
    L.push('');
  }
  L.push('## Права и следующий шаг');
  for (const r of p.rights) L.push(`- ${r}`);
  L.push('');
  const draft = p.specDraft;
  const askTrack = p.trackDetail?.track === 'ask';
  if (draft && askTrack && p.status === 'S4-spec-review') {
    L.push('## Черновик (#729)');
    if (draft.allowed) {
      L.push(`- трейлер каждого чернового коммита: \`${draft.trailer}\``);
      L.push('- ветку не пушить до `S5`; `S6` — после зелёного ревью ТЗ; комментарий «Черновик:» (§7.2); черновик занимает слот WIP');
      L.push('- жёлтый или красный вердикт — черновик остановить: коммиты по прежнему тексту гейт не примет');
    } else L.push(`- ${draft.reason}`);
    L.push('');
  }
  if (draft?.green && askTrack && (p.status === 'S5-ready' || p.status === 'S6-in-progress')) {
    L.push('## Черновик (#729)');
    L.push(`- зелёное ревью ТЗ: \`${draft.green.doc}\` · тело \`sha256:${draft.green.body.slice(0, 12)}\` — черновые коммиты принимаются с этим хешем`);
    L.push(draft.bodyChanged
      ? '- тело issue сейчас: изменилось после зелёного ревью ТЗ (ревьюер кода получит находку, #517)'
      : '- тело issue сейчас: совпадает');
    L.push('- проверка до push: `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report`');
    L.push('');
  }
  L.push('## Решения владельца (свежие)');
  if (!p.decisions.length) L.push('- не найдены (комментарии владельца со словами решения отсутствуют)');
  for (const d of p.decisions) L.push(`- ${d.at?.slice(0, 16) || ''} — ${d.head}${d.url ? ` (${d.url})` : ''}`);
  L.push('');
  L.push('## Материал');
  if (!p.material) L.push('- ветки issue/NN-* на origin нет — материал не запушен');
  else {
    const m = p.material;
    L.push(`- ветка \`${m.branch}\`, вершина \`${m.tip.slice(0, 12)}\`, база dev \`${m.base.slice(0, 12)}\`: впереди ${m.ahead}, позади ${m.behind}`);
    L.push(`- Validate на вершине: ${m.validate.status}${m.validate.url ? ` (${m.validate.url})` : ''}`);
    if (m.treeMatchesVerdict === true) L.push('- дерево вне docs/reviews совпадает с материалом последнего вердикта — повторный S7 применит его без модели (#499)');
    if (m.treeMatchesVerdict === false) L.push('- дерево изменилось с последнего вердикта — будет полный разбор');
  }
  L.push('');
  if (p.nextStep?.length) {
    L.push('## Следующий шаг');
    for (const line of p.nextStep) L.push(`- ${line}`);
    L.push('');
  }
  if (p.risk && (!p.risk.computed ? p.risk.reason === 'не посчитан: ветки нет' : p.risk.classes.length)) {
    L.push('## Риск по участкам');
    if (!p.risk.computed) L.push(`- ${p.risk.reason}`);
    else {
      for (const cls of p.risk.classes) L.push(`- ${riskClassLine(p.risk, cls)}`);
      L.push(`- следствие: ${p.risk.consequence}`);
    }
    L.push('');
  }
  if (p.checks?.length) {
    L.push('## Обязательные проверки');
    for (const check of p.checks) L.push(`- ${check.command} · ${check.reason}`);
    L.push('');
  }
  const c = p.changelog;
  if (c && (c.yes || c.no || c.visualEvidence)) {
    L.push('## Changelog и визуальное свидетельство');
    if (c.yes || c.no) L.push(`- коммитов ветки: \`User-Visible: yes\` — ${c.yes}, \`User-Visible: no\` — ${c.no}`);
    for (const file of c.missing) L.push(`- не хватает ${file}: \`User-Visible: yes\` требует правок в обоих changelog (§3 п.10)`);
    if (c.visualEvidence) L.push('- визуальный риск в пути отрисовки: дефект растра или резкости требует свидетеля, красного на старом коде, и подтверждения владельца в GPU-браузере (§7.1)');
    L.push('');
  }
  L.push('## Предыдущий вердикт');
  if (p.verdict.comment) L.push(`- комментарий: ${p.verdict.comment.line}${p.verdict.comment.url ? ` (${p.verdict.comment.url})` : ''}`);
  if (p.verdict.doc) L.push(`- документ: \`${p.verdict.doc.name}\`, дерево \`${p.verdict.doc.tree?.slice(0, 12) || '—'}\`, запись конвейера: ${p.verdict.doc.recorded ? `${p.verdict.doc.recorded.verdict} · High ${p.verdict.doc.recorded.high}` : 'нет (документ до #499)'}`);
  if (!p.verdict.comment && !p.verdict.doc) L.push('- вердиктов этапа ещё не было');
  L.push('');
  L.push('## AC → свидетель (по последнему документу ревью)');
  if (!p.acceptance.length) L.push('- AC не распознаны: ни таблицы `| ACn |`, ни строк `ACn:` в ТЗ/теле issue');
  for (const a of p.acceptance) L.push(`- **${a.id}** ${a.text} → ${a.evidence}`);
  L.push('');
  L.push('## Непроверенное');
  L.push(p.unverified.length ? `- ${p.unverified.join(', ')}: нет записи в последнем документе ревью — свидетель нужен до S7` : '- по документу ревью все распознанные AC имеют запись');
  return `${L.join('\n')}\n`;
}

// ---- сбор входов: gh + git -------------------------------------------------

function sh(cmd, args, { cwd } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} → ${(r.stderr || '').trim()}`);
  return (r.stdout || '').trim();
}

export function collectInputs({ number, repo = 'Matysh/houseplan-card', cwd = process.cwd() }) {
  const view = JSON.parse(sh('gh', ['issue', 'view', String(number), '--repo', repo, '--json', 'number,title,body,state,url,labels,comments']));
  const labels = (view.labels || []).map((l) => l.name);
  const comments = (view.comments || []).map((c) => ({ author: c.author?.login, body: c.body, createdAt: c.createdAt, url: c.url }));
  const owner = repo.split('/')[0];
  try { sh('git', ['fetch', '-q', 'origin', 'dev', `+refs/heads/issue/${number}-*:refs/remotes/origin/issue/${number}-*`], { cwd }); } catch { /* офлайн — читаем что есть */ }
  const refs = sh('git', ['for-each-ref', '--sort=-committerdate', '--format=%(refname:lstrip=3)', `refs/remotes/origin/issue/${number}-*`], { cwd }).split('\n').filter(Boolean);
  let branch = null; let reviewDocs = []; let specs = [];
  if (refs[0]) {
    const name = refs[0]; const ref = `origin/${name}`;
    const tip = sh('git', ['rev-parse', ref], { cwd });
    const base = sh('git', ['merge-base', 'origin/dev', ref], { cwd });
    const ahead = Number(sh('git', ['rev-list', '--count', `origin/dev..${ref}`], { cwd }));
    const behind = Number(sh('git', ['rev-list', '--count', `${ref}..origin/dev`], { cwd }));
    const changedFiles = sh('git', ['diff', '--name-only', `${base}..${ref}`], { cwd }).split('\n').filter(Boolean);
    const infrastructure = branchIsInfrastructure(changedFiles);
    // #707: риск по изменённым участкам, смоки и трейлеры — по тому же диффу от
    // merge-base, что судит конвейер на S7.
    const diff = sh('git', ['-c', 'core.quotePath=false', 'diff', '--unified=0', '-M', '--no-color', '--no-ext-diff', '--no-textconv', `${base}..${ref}`], { cwd });
    const commits = sh('git', ['log', '--format=%B%x1e', `${base}..${ref}`], { cwd })
      .split('\x1e').map((message) => message.trim()).filter(Boolean).map((message) => ({ message }));
    const merge = behind > 0 ? readMergeState({ cwd, onto: 'origin/dev', ref }) : { clean: true, conflicts: [] };
    let smokes = null;
    try {
      // #754: выборке нужен контекст, чтобы приписать правку аргументов вызову;
      // риск по участкам (`diff`) остаётся на `--unified=0`.
      const selection = selectSmokes(sh('git', ['-c', 'core.quotePath=false', 'diff', `--unified=${CALL_CONTEXT_LINES}`, '-M', '--no-color', '--no-ext-diff', '--no-textconv', `${base}..${ref}`], { cwd }));
      smokes = {
        direct: selection.direct.filter((entry) => entry.strong).map(({ smoke, symbols }) => ({ smoke, symbols })),
        registered: selection.registered.map(({ smoke, symbols }) => ({ smoke, symbols })),
        visualMinimum: selection.visualMinimum,
      };
    } catch { smokes = null; }
    // Дерево без docs/reviews — для сравнения с якорем вердикта: git сам его не даёт,
    // поэтому сравнение делается diff'ом при известном якоре (см. ниже).
    const names = sh('git', ['ls-tree', '--name-only', `${ref}:docs/reviews`], { cwd }).split('\n').filter((n) => new RegExp(`-${number}-r\\d+\\.md$`).test(n));
    reviewDocs = names.sort().map((n) => ({ name: n, text: sh('git', ['show', `${ref}:docs/reviews/${n}`], { cwd }) }));
    const specNames = sh('git', ['ls-tree', '--name-only', `${ref}:docs/specs`], { cwd }).split('\n').filter((n) => new RegExp(`^${number}-.*\\.md$`).test(n));
    specs = specNames.map((n) => ({ name: n, text: sh('git', ['show', `${ref}:docs/specs/${n}`], { cwd }) }));
    const anchorTree = reviewDocs.length ? anchorTreeFrom(reviewDocs.at(-1).text) : null;
    let treeWithoutReviews = null;
    if (anchorTree) {
      const same = spawnSync('git', ['diff', '--quiet', anchorTree, tip, '--', '.', ':!docs/reviews', ':!legacy/reviews'], { cwd });
      treeWithoutReviews = same.status === 0 ? anchorTree : `differs-from-${anchorTree}`;
    }
    branch = {
      name, tip, base, ahead, behind, treeWithoutReviews, infrastructure,
      changedFiles, diff, commits, smokes, mergeClean: merge.clean, conflicts: merge.conflicts,
    };
  }
  // #729: SPEC-REVIEW — отдельный вход `specDocs` из ветки на origin и из
  // `origin/dev`: на ask документ ревью ТЗ обычно ложится прямо в dev. Источник
  // reviewDocs (lastVerdict, AC → свидетель) не меняется.
  const specByName = new Map();
  for (const ref of [...(refs[0] ? [`origin/${refs[0]}`] : []), 'origin/dev']) {
    let names = [];
    try {
      names = sh('git', ['ls-tree', '--name-only', `${ref}:docs/reviews`], { cwd }).split('\n')
        .filter((n) => new RegExp(`^SPEC-REVIEW-${number}-r\\d+\\.md$`).test(n));
    } catch { continue; }
    for (const n of names) {
      if (!specByName.has(n)) specByName.set(n, { name: n, text: sh('git', ['show', `${ref}:docs/reviews/${n}`], { cwd }) });
    }
  }
  const specDocs = [...specByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  let validate = null;
  if (branch) {
    try {
      const runs = JSON.parse(sh('gh', ['run', 'list', '--repo', repo, '--workflow', 'validate.yml', '--commit', branch.tip, '--limit', '5', '--json', 'status,conclusion,url']));
      const green = runs.find((r) => r.status === 'completed' && r.conclusion === 'success');
      const running = runs.find((r) => r.status !== 'completed');
      validate = green ? { status: 'зелёный', url: green.url } : running ? { status: 'идёт', url: running.url }
        : runs[0] ? { status: `красный (${runs[0].conclusion})`, url: runs[0].url } : { status: 'прогона нет' };
    } catch { validate = { status: 'неизвестно (gh run list недоступен)' }; }
  }
  return { issue: view, labels, comments, owner, branch, specs, reviewDocs, specDocs, validate };
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const value = (name) => {
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.slice(name.length + 3);
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? (argv[at + 1] || '') : '';
  };
  const number = Number(value('issue'));
  if (!Number.isInteger(number) || number <= 0) { console.error('нужен --issue <номер>'); process.exit(2); }
  const repo = value('repo') || 'Matysh/houseplan-card';
  const packet = buildPacket(collectInputs({ number, repo }));
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(packet, null, 2)}\n` : renderPacket(packet));
}
