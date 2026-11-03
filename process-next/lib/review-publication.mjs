import { createHash } from 'node:crypto';

async function pages(api, path) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api.request('GET', `${api.root}/${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw Error('Invalid GitHub inventory');
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw Error('GitHub inventory incomplete; do not create a duplicate on an unknown result');
}

const author = comment => comment.user?.login ?? comment.author;
const normalizedVerdict = verdict => verdict === 'accept' ? 'accepted' : verdict;
const verdictText = verdict => ({ accepted: 'принято', changes_requested: 'нужны исправления', incomplete: 'анализ не завершён' })[normalizedVerdict(verdict)] ?? 'результат сохранён';
const resultIdentity = receipt => [normalizedVerdict(receipt.verdict),
  ...(receipt.runId ? [`run:${receipt.runId}`, `attempt:${receipt.runAttempt ?? 1}`] : [])].join(':');
const markerFor = (receipt, part, legacy = false) => {
  const key = `${receipt.requestId}${legacy ? '' : `:result:${resultIdentity(receipt)}`}`;
  return `<!-- process-next-review:${key}${part === 0 ? '' : `:part:${part + 1}`} -->`;
};
const statusName = label => ({ 'S3-spec': 'S3 «Подготовка ТЗ»', 'S4-spec-review': 'S4 «Ревью ТЗ»',
  'S5-ready': 'S5 «Готова»', 'S6-in-progress': 'S6 «Реализация и проверки»',
  'S7-code-review': 'S7 «Код-ревью»', 'S8-merged': 'S8 «Слито в dev»' })[label] ?? label;
const timeText = value => {
  if (value === undefined || value === null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().replace('T', ' ').replace('.000Z', ' UTC') : null;
};
const DETAILS_LAYOUT = '<!-- process-next-review-layout:details-v1 -->';
const MERGED_LAYOUT = '<!-- process-next-review-layout:merge-details-v1 -->';
export const escapeHtml = text => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);

function plainChunks(markdown) {
  const chunks = []; let text = '', size = 0;
  // Escaped HTML, not source length, owns the comment budget. Iteration keeps
  // surrogate pairs together even when one oversized block needs several parts.
  for (const char of markdown) {
    const escaped = escapeHtml(char);
    if (size + escaped.length > 50_000) { chunks.push({ text, plain: true }); text = ''; size = 0; }
    text += char; size += escaped.length;
  }
  if (text) chunks.push({ text, plain: true });
  return chunks;
}

export function reviewChunks(markdown) {
  const boundaries = []; let offset = 0, fence = null, details = 0;
  for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const token = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)/);
    if (fence) {
      if (token && token[1][0] === fence[0] && token[1].length >= fence.length && !token[2].trim()) fence = null;
    } else if (token) fence = token[1];
    else {
      const prose = line.replace(/(`+).*?\1/g, '');
      for (const tag of prose.matchAll(/<\/?details\b[^>]*>/gi)) {
        if (tag[0][1] === '/' && !details) return plainChunks(markdown);
        details += tag[0][1] === '/' ? -1 : 1;
      }
    }
    offset += line.length;
    if (!fence && !details && !line.trim()) boundaries.push(offset);
  }
  if (fence || details) return plainChunks(markdown);
  boundaries.push(markdown.length);
  const chunks = []; offset = 0;
  while (offset < markdown.length) {
    const end = boundaries.findLast(value => value > offset && value <= offset + 50_000);
    // A giant indivisible code/HTML block is shown as source Markdown rather
    // than emitting a broken fence/details tag that exposes or hides the rest.
    if (!end) return plainChunks(markdown);
    chunks.push({ text: markdown.slice(offset, end), plain: false }); offset = end;
  }
  return chunks;
}

function legacyChunks(markdown) {
  const chunks = [];
  for (let offset = 0; offset < markdown.length;) {
    let end = Math.min(offset + 50_000, markdown.length);
    if (end < markdown.length && /[\uD800-\uDBFF]/.test(markdown[end - 1])) end--;
    chunks.push({ text: markdown.slice(offset, end), plain: false }); offset = end;
  }
  return chunks;
}

function presentationText(receipt) {
  const p = receipt.presentation ?? {}, lines = [];
  const verdict = normalizedVerdict(receipt.verdict);
  if (p.mergedAfterReview && verdict === 'accepted') {
    lines.push('Код-ревью принято; после этого изменение уже слито в dev. Сейчас задача: **S8 «Слито в dev»**.');
  } else if (p.delayed) {
    const occurred = timeText(p.occurredAt ?? receipt.finishedAt);
    lines.push(`Отчёт доставлен с задержкой${occurred ? `; ревью завершилось ${occurred}` : ''}. Текущий статус задачи не изменён.`);
    if (p.currentStatus) lines.push(`Сейчас задача: **${statusName(p.currentStatus)}**.`);
  } else if (p.transition?.confirmed) {
    const { from, to } = p.transition;
    if (from && to && from !== to) lines.push(`Переведена **${statusName(from)} → ${statusName(to)}**: снята \`${from}\`, установлена \`${to}\`.`);
    else if (to) lines.push(`Статус остаётся **${statusName(to)}**.`);
  } else if (p.currentStatus) lines.push(`Статус остаётся **${statusName(p.currentStatus)}**.`);
  if (p.detail) lines.push(p.detail);
  const status = p.currentStatus ?? (p.transition?.confirmed ? p.transition.to : null);
  let next = p.next;
  if (!next && verdict === 'changes_requested') {
    if (status === 'S3-spec' && receipt.kind === 'spec') next = 'Исполнитель исправляет ТЗ на S3; описание «замечание → исправление» публикуется вместе с повторной передачей новой редакции на ревью.';
    if (status === 'S6-in-progress' && receipt.kind === 'code') next = 'Исполнитель исправляет код на S6 и выполняет адресные проверки; описание «замечание → исправление» публикуется вместе с повторной передачей на код-ревью.';
  }
  if (!next && verdict === 'accepted') {
    if (status === 'S5-ready' && receipt.kind === 'spec') next = 'Исполнитель начинает реализацию на S6.';
    if (status === 'S7-code-review' && receipt.kind === 'code') next = 'Очередь выполняет слияние принятого изменения в dev.';
  }
  if (next && !p.delayed && !p.mergedAfterReview) lines.push(`Следующий шаг: ${next}`);
  if (verdict === 'incomplete') lines.push('Это незавершённый анализ, а не отрицательное содержательное ревью. Уже полученный отчёт сохранён.');
  return lines.join('\n\n');
}

function legacyResultMatches(comment, receipt) {
  const json = comment?.body?.match(/```json\s*\n([^]*?)\n```/)?.[1];
  try {
    const old = JSON.parse(json);
    return old.requestId === receipt.requestId && old.materialSha === receipt.materialSha
      && normalizedVerdict(old.verdict) === normalizedVerdict(receipt.verdict);
  } catch { return false; }
}

async function appendOnce(api, issue, marker, body, comments) {
  const allowedAuthors = ['github-actions[bot]', api.owner ?? api.root.split('/')[2]];
  const existing = comments.find(comment => comment.body?.startsWith(marker));
  if (existing) return existing;
  if (api.upsertComment) return api.upsertComment(issue, { marker, body, allowedAuthors });
  try { return await api.comment(issue, body); }
  catch (error) {
    const delivered = (await pages(api, `issues/${issue}/comments`)).find(comment => allowedAuthors.includes(author(comment)) && comment.body?.startsWith(marker));
    if (delivered) return delivered;
    throw error;
  }
}

/** Issue comments are the durable human report. Multipart preserves the complete text.
 * Repeating publication reads markers, never calls the model, and never edits product code.
 */
export async function publishReviewReceipt({ api, receipt, reportUrl = receipt?.reportUrl, merge }) {
  if (!receipt || !Number.isSafeInteger(receipt.issue) || receipt.issue < 1
    || !/^[A-Za-z0-9:_.-]{1,200}$/.test(receipt.requestId ?? '') || !receipt.markdown?.trim()) throw Error('Saved review receipt required');
  const identity = { requestId: receipt.requestId, materialSha: receipt.materialSha, base: receipt.base,
    kind: receipt.kind, verdict: receipt.verdict, model: receipt.model,
    runId: receipt.runId, runAttempt: receipt.runAttempt, result: resultIdentity(receipt) };
  const comments = await pages(api, `issues/${receipt.issue}/comments`), published = [];
  const owner = api.owner ?? api.root.split('/')[2];
  const trusted = comment => ['github-actions[bot]', owner].includes(author(comment));
  const legacy = comments.find(comment => trusted(comment) && comment.body?.startsWith(markerFor(receipt, 0, true)) && legacyResultMatches(comment, receipt));
  const existingFirst = comments.find(comment => trusted(comment) && comment.body?.startsWith(markerFor(receipt, 0))) ?? legacy;
  // Register separate defects before rendering their links in this same verdict.
  // A retry recognizes their source markers without making another issue.
  let outsideIssues = [], outsideError;
  try { outsideIssues = await publishOutsideFindings({ api, receipt }); }
  catch (error) { outsideError = error; }
  const repository = api.root.replace(/^\/repos\//, '');
  const outsideText = outsideIssues.length ? '\n\n**Отдельные дефекты вне объёма задачи:**\n\n'
    + outsideIssues.map(number => `- [Задача №${number}](https://github.com/${repository}/issues/${number})`).join('\n')
    + '\n\nИх регистрация сама по себе не блокирует текущую задачу и не расширяет её объём.' : '';
  const mergedIdentity = `${markerFor(receipt, 0)}\n${MERGED_LAYOUT}`;
  const existingMerged = comments.find(comment => trusted(comment) && comment.body?.includes(mergedIdentity));
  const finish = async (merged, ids) => {
    // The paid report remains visible even when filing a separate finding fails.
    // Only that optional bookkeeping is retried; published text stays unchanged.
    if (outsideError) return { published: false, pending: true, merged, comments: ids, outsideIssues, reason: outsideError.message };
    if (outsideIssues.length && !outsideIssues.every(number => comments.some(comment => trusted(comment)
      && ids.includes(comment.id) && comment.body?.includes(`/issues/${number})`)))) {
      const marker = `<!-- process-next-review-outside:${receipt.requestId}:${resultIdentity(receipt)} -->`;
      const body = `${marker}\n\nСсылки к ранее опубликованному ${receipt.kind === 'spec' ? 'ревью ТЗ' : 'код-ревью'} задачи №${receipt.issue}.${outsideText}`;
      await appendOnce(api, receipt.issue, marker, body, comments.filter(trusted));
    }
    return { published: true, merged, comments: ids, outsideIssues };
  };
  if (existingMerged) return finish(true, [existingMerged.id]);
  // Resume an old multipart report at its original offsets; a formatting change
  // must not create gaps or duplicates after an already delivered first part.
  const oldLayout = existingFirst && !existingFirst.body.startsWith(`${markerFor(receipt, 0)}\n${DETAILS_LAYOUT}`);
  const chunks = oldLayout ? legacyChunks(receipt.markdown) : reviewChunks(receipt.markdown);
  const p = receipt.presentation ?? {}, title = `${receipt.kind === 'spec' ? 'Ревью ТЗ' : 'Код-ревью'} задачи №${receipt.issue} — ${verdictText(receipt.verdict)}`
    + (p.round ? `, раунд ${p.round}` : '') + (p.attempt > 1 ? `, техническая попытка ${p.attempt}` : '');
  const metadata = `\n\n<details>\n<summary>Материал и идентификаторы ревью</summary>\n\n\`\`\`json\n${JSON.stringify(identity)}\n\`\`\`\n\n</details>`;
  const reportLink = reportUrl ? `\n\n[Запуск ревью](${reportUrl}). Полный текст сохранён в комментариях этой задачи.` : '';
  const collapsed = chunk => `<details>\n<summary>Подробный разбор${chunk.plain ? ' — исходный Markdown' : ''}</summary>\n\n`
    + `${chunk.plain ? `<pre>${escapeHtml(chunk.text)}</pre>` : chunk.text}\n\n</details>`;
  // Only a new accepted report joins the actual merge. A previously published
  // standalone/multipart report finishes in place; its history is never rewritten.
  if (merge && !existingFirst && !comments.some(comment => trusted(comment) && comment.body?.startsWith(merge.marker))) {
    if (receipt.kind !== 'code' || normalizedVerdict(receipt.verdict) !== 'accepted'
      || !merge.marker?.startsWith('<!-- process-next-task-merged:') || !merge.body?.trim()) throw Error('Actual merge and accepted code review required');
    const partLinks = [];
    for (const [index, chunk] of chunks.entries()) {
      const last = index === chunks.length - 1;
      const marker = last ? merge.marker : `<!-- process-next-review:${receipt.requestId}:result:${resultIdentity(receipt)}:merged-part:${index + 1} -->`;
      const heading = `## ${title}${chunks.length > 1 ? ` — часть ${index + 1} из ${chunks.length}` : ''}`;
      const body = last
        ? `${marker}\n${mergedIdentity}\n\n${merge.body}\n\n${heading}\n\n`
          + (partLinks.length ? `${partLinks.join(' · ')}\n\n` : '') + collapsed(chunk) + metadata + outsideText + reportLink
        : `${marker}\n${DETAILS_LAYOUT}\n\n${heading}\n\n${collapsed(chunk)}`;
      const row = await appendOnce(api, receipt.issue, marker, body, comments.filter(trusted));
      if (row && !comments.some(comment => comment.id === row.id)) comments.push(row);
      published.push(row?.id ?? null);
      if (!last && row?.id) partLinks.push(`[Часть ${index + 1}](https://github.com/${repository}/issues/${receipt.issue}#issuecomment-${row.id})`);
    }
    return finish(true, published);
  }
  for (const [index, chunk] of chunks.entries()) {
    const marker = markerFor(receipt, index);
    const legacyPart = legacy && comments.find(comment => trusted(comment) && comment.body?.startsWith(markerFor(receipt, index, true)));
    const first = comments.find(comment => comment.id === published[0]);
    const firstUrl = first?.html_url ?? first?.url ?? (first?.id ? `https://github.com/${api.owner ?? owner}/${api.repo ?? api.root.split('/')[3]}/issues/${receipt.issue}#issuecomment-${first.id}` : null);
    const heading = `## ${title}${chunks.length > 1 ? ` — часть ${index + 1} из ${chunks.length}` : ''}`;
    const context = index === 0 ? presentationText(receipt) : firstUrl ? `[Первая часть отчёта](${firstUrl}).` : '';
    // A partially delivered old report retains its original raw layout as well
    // as offsets; only newly started reports use independently closed spoilers.
    const body = `${marker}${oldLayout ? '' : '\n' + DETAILS_LAYOUT}\n\n${heading}\n\n${context ? context + '\n\n' : ''}${oldLayout ? chunk.text : collapsed(chunk)}`
      + (index === 0 ? metadata : '') + (index === chunks.length - 1 ? outsideText + reportLink : '');
    // An old event stays unchanged even if wording or current status differs.
    const result = legacyPart ?? await appendOnce(api, receipt.issue, marker, body, comments.filter(trusted));
    if (result && !comments.some(comment => comment.id === result.id)) comments.push(result);
    published.push(result?.id ?? null);
  }
  return finish(false, published);
}

/** Only explicitly separated, evidenced defects are filed. Improvements are never filed implicitly. */
export async function publishOutsideFindings({ api, receipt }) {
  if (receipt.verdict === 'incomplete') return [];
  const findings = receipt.report?.outsideFindings ?? [];
  if (!findings.length) return [];
  const inventory = await pages(api, 'issues?state=all'), created = [];
  for (const finding of findings) {
    if (['title', 'problem', 'evidence', 'suggestedFix'].some(key => typeof finding?.[key] !== 'string' || !finding[key].trim()))
      throw Error('Outside finding requires a concrete problem, evidence and direction');
    const digest = createHash('sha256').update(JSON.stringify([receipt.issue, finding.title.trim().toLowerCase(), finding.problem.trim()])).digest('hex').slice(0, 24);
    const marker = `<!-- process-next-outside:${digest} -->`;
    const existing = inventory.find(issue => !issue.pull_request && (issue.body ?? '').includes(marker));
    if (existing) { created.push(existing.number); continue; }
    const repository = api.root.replace(/^\/repos\//, '');
    const body = `${marker}\n\nНайдено при ${receipt.kind === 'spec' ? 'ревью ТЗ' : 'код-ревью'} [#${receipt.issue}](https://github.com/${repository}/issues/${receipt.issue}).`
      + ` Материал: \`${receipt.materialSha}\`; запрос: \`${receipt.requestId}\`.\n\n`
      + `## Проблема\n\n${finding.problem}\n\n## Основание\n\n${finding.evidence}\n\n## Направление исправления\n\n${finding.suggestedFix}\n\n`
      + 'Это отдельный дефект вне текущей задачи; создание этой записи не расширяет её объём и не меняет её трек.';
    const kind = finding.kind ?? 'bug';
    if (!['bug', 'infra', 'tech-debt', 'docs'].includes(kind)) throw Error('Unknown outside defect kind');
    const issue = await api.request('POST', `${api.root}/issues`, { title: finding.title.slice(0, 240), body, labels: [kind, 'P2', 'S1-new'] });
    if (!Number.isSafeInteger(issue?.number)) throw Error('Outside issue creation was not confirmed');
    inventory.push(issue); created.push(issue.number);
  }
  return created;
}
