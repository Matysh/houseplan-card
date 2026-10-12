#!/usr/bin/env node
// Pure preparation: only GETs, local reads and an optional stdout report.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { candidateInputs, buildCandidate } from './candidate-readiness.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { candidateExpectations, probeGreenWorkflow } from './release-gate.mjs';
import { isMainModule } from './spawn-portable.mjs';
const get = path => JSON.parse(execFileSync('gh', ['api', '--method', 'GET', path], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
export async function prepareCandidate({ repo, candidate = 'HEAD', root = process.cwd(), input,
  request = get, probe = probeGreenWorkflow, token = process.env.GH_TOKEN } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw Error('repo=owner/name required');
  input ||= candidateInputs({ candidate, root });
  token ||= execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const issues = input.catalogue.entries.map(entry => {
    const issue = request(`repos/${repo}/issues/${entry.issue}`);
    const comments = [];
    // Bounded but explicit: overflow refuses instead of silently missing a revocation.
    for (let page = 1; page <= 10; page++) {
      const rows = request(`repos/${repo}/issues/${entry.issue}/comments?per_page=100&page=${page}`);
      comments.push(...rows);
      if (rows.length < 100) return { ...issue, comments };
    }
    throw Error(`#${entry.issue}: more than 1000 comments; curate/archive explicitly`);
  });
  const proof = await probe({ repo, sha: input.sha, tree: input.tree, root, token,
    expected: candidateExpectations({ sha: input.sha, root, log: () => {} }) });
  return buildCandidate({ input, issues, proof, owner: repo.split('/')[0] });
}
export async function assertCandidateAcceptance(options) {
  const record = await prepareCandidate(options);
  if (!record.ready) throw Error(`Candidate ${record.material} not ready:\n${record.blockers.join('\n')}\n${record.next}`);
  return record;
}
if (isMainModule(import.meta.url)) {
  const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
  try {
    if (process.argv.includes('--list-scenes')) {
      console.log(JSON.stringify(GOLDEN_SCENARIOS.map(s => ({ id: s.id, mode: s.mode, theme: s.theme,
        projection: s.projection || 'flat', viewport: s.viewport })), null, 2));
    } else {
    const record = await prepareCandidate({ repo: arg('repo') || process.env.GITHUB_REPOSITORY || 'Matysh/houseplan-card', candidate: arg('candidate') || 'HEAD' });
    console.log(JSON.stringify(record, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n### Candidate ${record.identity}\n\n${record.ready ? 'Prepared, not published.' : record.blockers.map(b => `- ${b}`).join('\n')}\n`);
    if (!record.ready) process.exitCode = 1;
    }
  } catch (error) { console.error(String(error?.message || error)); process.exitCode = 1; }
}
