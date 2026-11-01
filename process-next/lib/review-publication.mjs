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

function presentationText(receipt) {
  const p = receipt.presentation ?? {}, lines = [];
  if (p.delayed) {
    const occurred = timeText(p.occurredAt ?? receipt.finishedAt);
    lines.push(`Отчёт доставлен с задержкой${occurred ? `; ревью завершилось ${occurred}` : ''}. Текущий статус задачи не изменён.`);
    if (p.currentStatus) lines.push(`Сейчас задача: **${statusName(p.currentStatus)}**.`);
  } else if (p.transition?.confirmed) {
    const { from, to } = p.transition;
    if (from && to && from !== to) lines.push(`Переведена **${statusName(from)} → ${statusName(to)}**: снята \`${from}\`, установлена \`${to}\`.`);
    else if (to) lines.push(`Статус остаётся **${statusName(to)}**.`);
  } else if (p.currentStatus) lines.push(`Статус остаётся **${statusName(p.currentStatus)}**.`);
  if (p.detail) lines.push(p.detail);
  if (p.next && !p.delayed) lines.push(`Следующий шаг: ${p.next}`);
  if (normalizedVerdict(receipt.verdict) === 'incomplete') lines.push('Это незавершённый анализ, а не отрицательное содержательное ревью. Уже полученный отчёт сохранён.');
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
export async function publishReviewReceipt({ api, receipt, reportUrl = receipt?.reportUrl }) {
  if (!receipt || !Number.isSafeInteger(receipt.issue) || receipt.issue < 1
    || !/^[A-Za-z0-9:_.-]{1,200}$/.test(receipt.requestId ?? '') || !receipt.markdown?.trim()) throw Error('Saved review receipt required');
  const chunks = [];
  for (let offset = 0; offset < receipt.markdown.length;) {
    let end = Math.min(offset + 50_000, receipt.markdown.length);
    if (end < receipt.markdown.length && /[\uD800-\uDBFF]/.test(receipt.markdown[end - 1])) end--;
    chunks.push(receipt.markdown.slice(offset, end)); offset = end;
  }
  const identity = { requestId: receipt.requestId, materialSha: receipt.materialSha, base: receipt.base,
    kind: receipt.kind, verdict: receipt.verdict, model: receipt.model,
    runId: receipt.runId, runAttempt: receipt.runAttempt, result: resultIdentity(receipt) };
  const comments = await pages(api, `issues/${receipt.issue}/comments`), published = [];
  const owner = api.owner ?? api.root.split('/')[2];
  const trusted = comment => ['github-actions[bot]', owner].includes(author(comment));
  const legacy = comments.find(comment => trusted(comment) && comment.body?.startsWith(markerFor(receipt, 0, true)) && legacyResultMatches(comment, receipt));
  const p = receipt.presentation ?? {}, title = `${receipt.kind === 'spec' ? 'Ревью ТЗ' : 'Код-ревью'} задачи №${receipt.issue} — ${verdictText(receipt.verdict)}`
    + (p.round ? `, раунд ${p.round}` : '') + (p.attempt > 1 ? `, техническая попытка ${p.attempt}` : '');
  for (const [index, chunk] of chunks.entries()) {
    const marker = markerFor(receipt, index);
    const legacyPart = legacy && comments.find(comment => trusted(comment) && comment.body?.startsWith(markerFor(receipt, index, true)));
    const first = comments.find(comment => comment.id === published[0]);
    const firstUrl = first?.html_url ?? first?.url ?? (first?.id ? `https://github.com/${api.owner ?? owner}/${api.repo ?? api.root.split('/')[3]}/issues/${receipt.issue}#issuecomment-${first.id}` : null);
    const heading = `## ${title}${chunks.length > 1 ? ` — часть ${index + 1} из ${chunks.length}` : ''}`;
    const context = index === 0 ? presentationText(receipt) : firstUrl ? `[Первая часть отчёта](${firstUrl}).` : '';
    const metadata = index === 0 ? `\n\n<details>\n<summary>Материал и идентификаторы ревью</summary>\n\n\`\`\`json\n${JSON.stringify(identity)}\n\`\`\`\n\n</details>` : '';
    const body = `${marker}\n\n${heading}\n\n${context ? context + '\n\n' : ''}${chunk}${metadata}`
      + (index === chunks.length - 1 && reportUrl ? `\n\n[Запуск ревью](${reportUrl}). Полный текст сохранён в комментариях этой задачи.` : '');
    // An old event stays unchanged even if wording or current status differs.
    const result = legacyPart ?? await appendOnce(api, receipt.issue, marker, body, comments.filter(trusted));
    if (result && !comments.some(comment => comment.id === result.id)) comments.push(result);
    published.push(result?.id ?? null);
  }
  const outsideIssues = await publishOutsideFindings({ api, receipt });
  if (outsideIssues.length) {
    const marker = `<!-- process-next-review-outside:${receipt.requestId}:${resultIdentity(receipt)} -->`;
    const repository = api.root.replace(/^\/repos\//, '');
    const body = `${marker}\n\n**Отдельные дефекты из ${receipt.kind === 'spec' ? 'ревью ТЗ' : 'код-ревью'} задачи №${receipt.issue}**\n\n`
      + outsideIssues.map(number => `- [Задача №${number}](https://github.com/${repository}/issues/${number})`).join('\n')
      + '\n\nЭто самостоятельные дефекты вне объёма текущей задачи. Их регистрация сама по себе не блокирует её и не расширяет её скоуп.';
    await appendOnce(api, receipt.issue, marker, body, comments.filter(trusted));
  }
  return { published: true, comments: published, outsideIssues };
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
