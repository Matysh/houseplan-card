#!/usr/bin/env node
// Пакет задачи — производное представление, а не новый источник статуса (#496).
//
// Агент, берущий задачу, сегодня собирает одно и то же руками из четырёх мест:
// метки и комментарии issue, ветку и её положение относительно dev, документы
// ревью с их якорями, состояние Validate на вершине. Каждый раз — свои ходы,
// свои ошибки («метка встала раньше push'а», «ревьюер читал не тот SHA»).
// Скрипт делает эту сборку детерминированно и печатает один markdown-пакет:
//
//   issue · статус и трек · что можно делать в этом статусе · решения владельца ·
//   материал (ветка, SHA, база, Validate) · предыдущий вердикт · AC → свидетель ·
//   непроверенное / следующий шаг
//
// Источник правды остаётся GitHub и git: пакет ничего не пишет и ничего не
// решает. Все чтения инъектируемы — `buildPacket(inputs)` чист и покрыт тестами.
//
//   node scripts/task-packet.mjs --issue 437 [--repo Matysh/houseplan-card] [--json]

import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { anchorTreeFrom, anchorVerdictFrom, verdictDeclaration } from './review-doc-guard.mjs';

export const STATUS_LABELS = ['S1-new', 'S2-analysis', 'S3-spec', 'S4-spec-review', 'S5-ready', 'S6-in-progress', 'S7-code-review', 'S8-merged'];

/** Что разрешено в статусе — по PROCESS.md, без домыслов. */
export function rightsFor(status, labels = []) {
  const blocked = labels.includes('blocked');
  const exhausted = labels.includes('review-4');
  const infrastructure = labels.includes('infra');
  const code = !infrastructure && ['S5-ready', 'S6-in-progress', 'S7-code-review'].includes(status);
  const lines = [];
  if (exhausted) lines.push('review-4: лимит циклов исчерпан — решение владельца (разделить, отклонить, арбитраж); дальше не двигать');
  if (blocked) lines.push('blocked: работа стоит, ждём внешнего решения — коммиты по задаче гейт не пропустит');
  lines.push(code
    ? 'продуктовый код трогать МОЖНО (правило №1)'
    : infrastructure
      ? 'файлы класса A трогать НЕЛЬЗЯ; инфраструктурную реализацию МОЖНО вести сразу по issue (#562)'
      : 'продуктовый код трогать НЕЛЬЗЯ: статус не S5/S6/S7 (правило №1)');
  switch (status) {
    case 'S1-new': lines.push('следующий шаг: аналитика (S2) — оценки метками, критерий лёгкого трека, затем ТЗ'); break;
    case 'S2-analysis': lines.push('следующий шаг: ТЗ (S3); трек по умолчанию small — отказ от него обосновать названным критерием §5'); break;
    case 'S3-spec': lines.push('следующий шаг: ТЗ готово → push ветки → метка S4-spec-review (метку после push)'); break;
    case 'S4-spec-review': lines.push('идёт ревью ТЗ: ждать вердикт (scripts/wait-verdict.mjs), не править материал'); break;
    case 'S5-ready': lines.push('следующий шаг: ветка issue/NN-slug от dev, код по ТЗ, метка S6-in-progress'); break;
    case 'S6-in-progress': lines.push('следующий шаг: gate:small + смоки по AC → push ветки → метка S7-code-review (метку после push)'); break;
    case 'S7-code-review': lines.push('идёт код-ревью: ждать вердикт, ничего не пушить в ветку — вердикт привязан к SHA (#312)'); break;
    case 'S8-merged': lines.push('код в dev, ждёт беты; ничего не делать; issue закроет владелец при выпуске'); break;
    default:
      lines.push(infrastructure
        ? 'инфраструктурный вход: реализовать и проверить → push ветки → S7-code-review; ТЗ и S1–S6 не нужны (#562)'
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

export function buildPacket(inputs) {
  const {
    issue, labels = [], comments = [], owner = 'Matysh', branch = null, specs = [], reviewDocs = [], validate = null,
  } = inputs;
  const status = STATUS_LABELS.find((l) => labels.includes(l)) || null;
  const track = labels.includes('infra')
    ? 'инфраструктурный'
    : labels.includes('trivial') ? 'trivial' : labels.includes('small') ? 'small' : 'полный';
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
    status, track, labels, rights: rightsFor(status, labels),
    decisions: ownerDecisions(comments, owner),
    material: branch ? {
      branch: branch.name, tip: branch.tip, base: branch.base, ahead: branch.ahead, behind: branch.behind,
      treeMatchesVerdict: verdict.doc?.tree ? branch.treeWithoutReviews === verdict.doc.tree : null,
      validate: validate || { status: 'неизвестно' },
    } : null,
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
  L.push('');
  L.push('## Права и следующий шаг');
  for (const r of p.rights) L.push(`- ${r}`);
  L.push('');
  L.push('## Решения владельца (свежие)');
  if (!p.decisions.length) L.push('- не найдены (комментарии владельца со словами решения отсутствуют)');
  for (const d of p.decisions) L.push(`- ${d.at?.slice(0, 16) || ''} — ${d.head}${d.url ? ` (${d.url})` : ''}`);
  L.push('');
  L.push('## Материал');
  if (!p.material) L.push('- ветки issue/NN-* на origin нет — материал не запушен');
  else {
    const m = p.material;
    L.push(`- ветка \`${m.branch}\`, вершина \`${m.tip.slice(0, 12)}\`, база dev \`${m.base.slice(0, 12)}\`: впереди ${m.ahead}, позади ${m.behind}${m.behind ? ' — перед S7 ребейз (rebase-on-dev.mjs при конфликте в бандле)' : ''}`);
    L.push(`- Validate на вершине: ${m.validate.status}${m.validate.url ? ` (${m.validate.url})` : ''}`);
    if (m.treeMatchesVerdict === true) L.push('- дерево вне docs/reviews совпадает с материалом последнего вердикта — повторный S7 применит его без модели (#499)');
    if (m.treeMatchesVerdict === false) L.push('- дерево изменилось с последнего вердикта — будет полный разбор');
  }
  L.push('');
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
    // Дерево без docs/reviews — для сравнения с якорем вердикта: git сам его не даёт,
    // поэтому сравнение делается diff'ом при известном якоре (см. ниже).
    const names = sh('git', ['ls-tree', '--name-only', `${ref}:docs/reviews`], { cwd }).split('\n').filter((n) => new RegExp(`-${number}-r\\d+\\.md$`).test(n));
    reviewDocs = names.sort().map((n) => ({ name: n, text: sh('git', ['show', `${ref}:docs/reviews/${n}`], { cwd }) }));
    const specNames = sh('git', ['ls-tree', '--name-only', `${ref}:docs/specs`], { cwd }).split('\n').filter((n) => new RegExp(`^${number}-.*\\.md$`).test(n));
    specs = specNames.map((n) => ({ name: n, text: sh('git', ['show', `${ref}:docs/specs/${n}`], { cwd }) }));
    const anchorTree = reviewDocs.length ? anchorTreeFrom(reviewDocs.at(-1).text) : null;
    let treeWithoutReviews = null;
    if (anchorTree) {
      const same = spawnSync('git', ['diff', '--quiet', anchorTree, tip, '--', '.', ':!docs/reviews'], { cwd });
      treeWithoutReviews = same.status === 0 ? anchorTree : `differs-from-${anchorTree}`;
    }
    branch = { name, tip, base, ahead, behind, treeWithoutReviews };
  }
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
  return { issue: view, labels, comments, owner, branch, specs, reviewDocs, validate };
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
