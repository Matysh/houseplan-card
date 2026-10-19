/** #903: shared, content-checked delivery phase; never a release category. */
import { anchorIssueBodyFrom, anchorTreeFrom, anchorVerdictFrom } from './review-doc-guard.mjs';
import { terminalTrailers } from './validate-commit-provenance.mjs';
import { isMainModule } from './spawn-portable.mjs';
import { findingsHeader, findingsLinkForBlob, findingsTextProblems } from './review-findings-policy.mjs';
import { reviewMaterialTreeType } from './review-material.mjs';

export const SPEC_DELIVERY_PHASE = 'spec-review/v1';
const PUBLISHER = '209825114+claude[bot]@users.noreply.github.com';

export function issueTrailers(message = '') {
  return [...new Set(String(message).split(/\r?\n/).flatMap(line => {
    const match = /^Issue:\s*#([1-9]\d*)\s*$/.exec(line.trim());
    return match ? [Number(match[1])] : [];
  }))];
}

export function reviewPublicationMessage(issue, stage) {
  if (!Number.isSafeInteger(Number(issue)) || Number(issue) <= 0 || !['spec', 'code'].includes(stage))
    throw Error('review publication needs a positive issue and spec/code stage');
  return `docs: review document for #${issue}\n\nIssue: #${issue}\nUser-Visible: no\n`
    + (stage === 'spec' ? `Delivery-Phase: ${SPEC_DELIVERY_PHASE}\n` : '');
}

// #926: the sole optional SPEC sidecar is ancillary, content-bound machine
// evidence from the same publisher. This does not allow arbitrary C paths.
function provenSpecFindings(commit, doc, issue) {
  const round = /^docs\/reviews\/SPEC-REVIEW-\d+-r([1-9]\d*)\.md$/.exec(doc || '')?.[1];
  if (!round || !Number.isSafeInteger(Number(round)) || typeof commit.specDocument !== 'string') return null;
  const policy = { issue, stage: 'spec', round: Number(round), path: `docs/reviews/findings/${issue}-spec-r${round}.md` };
  if (!commit.files.includes(policy.path)) return null;
  const text = commit.specFindingsDocument;
  const header = findingsHeader(policy);
  if (typeof text !== 'string' || !text.startsWith(header) || commit.specFindingsStatus !== 'A'
    || !/^[a-f0-9]{40}$/.test(commit.specFindingsBlob || '')
    || !Number.isSafeInteger(commit.specFindingsSize) || commit.specFindingsSize <= Buffer.byteLength(header)
    || commit.specFindingsSize > Buffer.byteLength(header) + 262144
    || findingsTextProblems(text.slice(header.length)).length) return null;
  const link = findingsLinkForBlob(policy, commit.specFindingsBlob);
  return commit.specDocument.includes(link)
    && commit.specDocument.split('<!-- hp:outside-findings-blob ').length === 2 ? policy.path : null;
}

export function taskDelivery(commit) {
  const phases = [...String(commit.message).matchAll(/^Delivery-Phase:[ \t]*(.*)$/gm)].map(m => m[1].trim());
  if (phases.length > 1 || (phases.length && phases[0] !== SPEC_DELIVERY_PHASE))
    throw Error(`Unknown/malformed delivery phase at ${commit.sha}`);
  const subject = String(commit.message).split(/\r?\n/)[0];
  const publisherSubject = /^docs: review document for #([1-9]\d*)$/.exec(subject);
  // Compatibility is deliberately bounded to the old publisher, not all C paths.
  if (!phases.length && !publisherSubject) return 'implementation';
  const issues = issueTrailers(commit.message);
  const trailers = terminalTrailers(commit.message);
  const issue = issues[0];
  const docs = (commit.files || []).filter(f => new RegExp(`^docs/reviews/SPEC-REVIEW-${issue}-r[1-9]\\d*\\.md$`).test(f));
  const round = /-r([1-9]\d*)\.md$/.exec(docs[0] || '')?.[1];
  // #950: the publisher has emitted both headings; neither may name another round.
  const heading = new RegExp(`^# (?:SPEC-REVIEW-${issue}-r${round}|SPEC-REVIEW — issue #${issue}, заход r${round})\\s*$`, 'm');
  const findings = provenSpecFindings(commit, docs[0], issue);
  // CODE-REVIEW publication is ordinary evidence attached to implementation.
  if (!phases.length && !docs.length && (commit.files || []).some(f => /\/CODE-REVIEW-/.test(f))) return 'implementation';
  const visible = [...String(commit.message).matchAll(/^User-Visible:[ \t]*(.*)$/gm)].map(m => m[1].trim());
  if (!publisherSubject || Number(publisherSubject[1]) !== issue || issues.length !== 1
    || trailers.get('Issue')?.length !== 1 || trailers.get('Issue')[0] !== `#${issue}`
    || (phases.length && trailers.get('Delivery-Phase')?.[0] !== SPEC_DELIVERY_PHASE)
    || commit.author !== PUBLISHER || visible.length !== 1 || visible[0] !== 'no'
    || docs.length !== 1 || !commit.files.length
    || commit.files.some(f => f !== docs[0] && f !== 'docs/reviews/INDEX.md' && f !== findings)
    || !heading.test(commit.specDocument || '')
    || !anchorIssueBodyFrom(commit.specDocument) || !anchorTreeFrom(commit.specDocument)
    || !anchorVerdictFrom(commit.specDocument) || commit.specTreeType !== 'tree'
    || commit.specStatus !== 'A')
    throw Error(`Unproven spec-only delivery at ${commit.sha}; publisher, exact SPEC/index/digest-bound findings delta and machine anchors required`);
  return 'spec-review';
}

export function readTaskCommit(commit, gitRunner) {
  const files = gitRunner(['diff-tree', '--first-parent', '-m', '--root', '--no-commit-id', '-r', '--name-only', commit.sha])
    .split('\n').map(file => file.trim()).filter(Boolean);
  const result = { ...commit, files };
  if (/^Delivery-Phase:/m.test(commit.message) || /^docs: review document for #\d+\s*$/m.test(commit.message.split('\n')[0])) {
    result.author = gitRunner(['show', '-s', '--format=%ae', commit.sha]).trim();
    const doc = files.find(f => /^docs\/reviews\/SPEC-REVIEW-\d+-r\d+\.md$/.test(f));
    if (doc) {
      result.specDocument = gitRunner(['show', `${commit.sha}:${doc}`]);
      const tree = anchorTreeFrom(result.specDocument);
      result.specTreeType = tree ? reviewMaterialTreeType(tree, gitRunner) : null;
      result.specStatus = gitRunner(['diff-tree', '--first-parent', '-m', '--root', '--no-commit-id', '-r', '--name-status', commit.sha, '--', doc]).trim().split('\t')[0];
      const match = /SPEC-REVIEW-([1-9]\d*)-r([1-9]\d*)\.md$/.exec(doc);
      const findings = `docs/reviews/findings/${match[1]}-spec-r${match[2]}.md`;
      if (files.includes(findings)) {
        result.specFindingsDocument = gitRunner(['show', `${commit.sha}:${findings}`]);
        result.specFindingsBlob = gitRunner(['rev-parse', `${commit.sha}:${findings}`]).trim();
        result.specFindingsSize = Number(gitRunner(['cat-file', '-s', `${commit.sha}:${findings}`]).trim());
        result.specFindingsStatus = gitRunner(['diff-tree', '--first-parent', '-m', '--root', '--no-commit-id', '-r', '--name-status', commit.sha, '--', findings]).trim().split('\t')[0];
      }
    }
  }
  taskDelivery(result);
  return result;
}

if (isMainModule(import.meta.url)) {
  try {
    const value = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
    if (process.argv[2] !== 'review-message') throw Error('usage: task-delivery.mjs review-message --issue=N --stage=spec|code');
    process.stdout.write(reviewPublicationMessage(value('issue'), value('stage')));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
