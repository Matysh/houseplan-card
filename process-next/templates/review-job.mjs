// Executed only by the future review workflow, never imported by the local test runner.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildReviewContext, runReview } from '../lib/review.mjs';
import { GitHubClient } from '../lib/github.mjs';
import { writeJson } from '../lib/storage.mjs';

if (process.env.PROCESS_NEXT_ENABLED !== 'true') throw Error('New process is not activated');
const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const issueNumber = Number(process.env.HP_ISSUE), requestId = process.env.HP_REQUEST_ID;
if (!Number.isSafeInteger(issueNumber) || issueNumber < 1 || !/^[A-Za-z0-9:_.-]{1,200}$/.test(requestId ?? '')) throw Error('Review request identity required');
if (![process.env.HP_BASE, process.env.HP_HEAD].every(value => /^[a-f0-9]{40}$/.test(value ?? ''))) throw Error('Resolved base/head SHAs required');
const api = new GitHubClient({ owner, repo, token: process.env.GITHUB_TOKEN, activated: true });
const marker = `<!-- process-next-review:${requestId} -->`;
let prior;
for (let page = 1; ; page++) {
  const comments = await api.request('GET', `${api.root}/issues/${issueNumber}/comments?per_page=100&page=${page}`);
  prior = comments.find(comment => comment.body?.startsWith(marker) && comment.user?.login === 'github-actions[bot]');
  if (prior || comments.length < 100) break;
}
if (prior) {
  const receipt = JSON.parse(prior.body.match(/```json\s*([^]*?)```/)?.[1] ?? 'null');
  if (receipt?.requestId !== requestId || receipt.materialSha !== process.env.HP_HEAD) throw Error('Existing review request identifies different material');
  console.log(JSON.stringify({ ...receipt, reused: true }));
  process.exit(['accepted','not-required'].includes(receipt.verdict) ? 0 : 1);
}
const issue = await api.getIssue(issueNumber);
const context = buildReviewContext({ repoRoot: resolve(process.env.HP_CANDIDATE_ROOT || '.'), base: process.env.HP_BASE, head: process.env.HP_HEAD,
  task: { issue: issueNumber, body: issue.body }, kind: process.env.HP_KIND ?? 'code', track: process.env.HP_TRACK,
  ownerAssigned: process.env.HP_OWNER_ASSIGNED === 'true', receipts: JSON.parse(process.env.HP_RECEIPTS || '[]') });
const result = await runReview({ context, reportDir: resolve('process-next/.state/reviews'), onProgress: value => console.log(JSON.stringify({ name: context.name, ...value })) });
const receipt = { requestId, materialSha: context.head, base: context.base, verdict: result.status === 'accept' ? 'accepted' : result.status, model: result.model };
writeJson('process-next/.state/reviews/result.json', receipt);
const report = result.file ? readFileSync(result.file, 'utf8') : result.reason;
// A repeated delivery keeps one report; the model itself has no issue-editing tool.
const body = `${marker}\n\n\`\`\`json\n${JSON.stringify(receipt)}\n\`\`\`\n\n${report}`;
await api.comment(issueNumber, body);
console.log(JSON.stringify(receipt));
if (!['accepted','not-required'].includes(receipt.verdict)) process.exitCode = 1;
