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
const markerFor = (receipt, part) => part === 0 ? `<!-- process-next-review:${receipt.requestId} -->`
  : `<!-- process-next-review:${receipt.requestId}:part:${part + 1} -->`;

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
    kind: receipt.kind, verdict: receipt.verdict, model: receipt.model };
  const comments = await pages(api, `issues/${receipt.issue}/comments`), published = [];
  for (const [index, chunk] of chunks.entries()) {
    const marker = markerFor(receipt, index);
    const heading = index === 0 ? `\n\n\`\`\`json\n${JSON.stringify(identity)}\n\`\`\`` : '';
    const body = `${marker}${heading}\n\nОтчёт ревью — часть ${index + 1}/${chunks.length}.\n\n${chunk}`
      + (index === chunks.length - 1 && reportUrl ? `\n\nЗапуск: ${reportUrl}. Полный текст сохранён в комментариях этой задачи.` : '');
    const owner = api.owner ?? api.root.split('/')[2];
    const existing = comments.find(comment => ['github-actions[bot]', owner].includes(author(comment)) && comment.body.startsWith(marker));
    const result = existing?.body === body ? existing : existing
      ? await api.request('PATCH', `${api.root}/issues/comments/${existing.id}`, { body }) : await api.comment(receipt.issue, body);
    published.push(result?.id ?? existing?.id ?? null);
  }
  const outsideIssues = await publishOutsideFindings({ api, receipt });
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
