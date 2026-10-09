#!/usr/bin/env node
/** Agent-authored release accounting. Never classifies tasks or generates prose. */
import { execFileSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { previousStableTag } from './release-notes.mjs';
import { issueTrailers } from './release-membership.mjs';

export const LEDGER = 'docs/release-ledger';
export const CATEGORIES = Object.freeze(['major', 'infra', 'stable-fix', 'line-fix']);
export const isUserReleaseEntry = (entry) => ['major', 'stable-fix'].includes(entry.category);
const stable = (tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag || '');
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const nonempty = (value) => typeof value === 'string' && !!value.trim();

export function validateCycle(cycle) {
  if (cycle?.schema !== 1 || !stable(cycle.baseStable) || !stable(cycle.targetStable)
    || previousStableTag(cycle.targetStable, [cycle.baseStable]) !== cycle.baseStable
    || !positive(cycle.milestone?.number) || !nonempty(cycle.milestone?.title)
    || /["\r\n]/.test(cycle.milestone.title))
    throw new Error('Invalid release cycle: schema, previous/target stable and explicit milestone required');
  return cycle;
}

export function validateEntry(entry, { issue, baseStable } = {}) {
  if (entry?.schema !== 1 || !positive(entry.issue) || !stable(entry.baseStable)
    || !CATEGORIES.includes(entry.category) || !nonempty(entry.rationale))
    throw new Error('Invalid release classification: schema, issue, baseStable, category and rationale required');
  if ((issue !== undefined && entry.issue !== Number(issue))
    || (baseStable && entry.baseStable !== baseStable))
    throw new Error(`Stale/mismatched release classification for #${issue ?? entry.issue}; base ${baseStable}`);
  if (isUserReleaseEntry(entry) && (!nonempty(entry.summary?.ru) || !nonempty(entry.summary?.en)))
    throw new Error(`#${entry.issue}: eligible classification needs user-facing RU/EN facts`);
  if (entry.category === 'line-fix' && !positive(entry.introducedBy))
    throw new Error(`#${entry.issue}: line-fix needs introducedBy issue (absent from previous stable)`);
  return entry;
}

export function milestoneQuery(repo, cycle) {
  validateCycle(cycle);
  return `https://github.com/${repo}/issues?q=${encodeURIComponent(`is:issue milestone:"${cycle.milestone.title}"`)}`;
}

export const git = (args) => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
}).trim();

export function readMergeEntry(candidate, issue, gitRunner = git) {
  const cycle = validateCycle(JSON.parse(gitRunner(['show', `${candidate}:${LEDGER}/cycle.json`])));
  const tags = gitRunner(['tag', '--merged', candidate, '--list', 'v*']).split('\n');
  if (tags.includes(cycle.targetStable)) throw new Error('This stable cycle has shipped; open the next cycle before merging tasks');
  if (previousStableTag(cycle.targetStable, tags) !== cycle.baseStable)
    throw new Error('Release cycle is stale: reclassify against the latest reachable previous stable');
  const path = `${LEDGER}/${cycle.baseStable}/${Number(issue)}.json`;
  const entry = validateEntry(JSON.parse(gitRunner(['show', `${candidate}:${path}`])), {
    issue, baseStable: cycle.baseStable,
  });
  return { cycle, entry };
}

export function catalogueFromCommits({ cycle, entries, commits }) {
  validateCycle(cycle);
  const byIssue = new Map();
  for (const commit of commits) {
    // A release promotion repeats issue trailers, but is not task delivery.
    if (/^Release:\s*/m.test(commit.message)) continue;
    for (const issue of issueTrailers(commit.message)) {
      if (!byIssue.has(issue)) byIssue.set(issue, []);
      byIssue.get(issue).push(commit.sha);
    }
  }
  const rows = [...byIssue].sort(([a], [b]) => a - b).map(([issue, evidence]) => {
    const entry = validateEntry(entries.get(issue), { issue, baseStable: cycle.baseStable });
    return { ...entry, commits: [...new Set(evidence)].sort() };
  });
  return { cycle, entries: rows, userIssues: rows.filter(isUserReleaseEntry).map((entry) => entry.issue) };
}

export function readCatalogue({ candidate = 'HEAD', tag, gitRunner = git } = {}) {
  const cycle = validateCycle(JSON.parse(gitRunner(['show', `${candidate}:${LEDGER}/cycle.json`])));
  if (tag && tag !== cycle.targetStable) throw new Error(`Cycle target ${cycle.targetStable} != ${tag}; curate a new cycle explicitly`);
  const tags = gitRunner(['tag', '--merged', candidate, '--list', 'v*']).split('\n');
  if (previousStableTag(cycle.targetStable, tags) !== cycle.baseStable)
    throw new Error('Release cycle base does not match the latest reachable previous stable');
  const candidateSha = gitRunner(['rev-parse', `${candidate}^{commit}`]);
  const raw = gitRunner(['log', '--first-parent', '--format=%H%x1f%B%x1e', `${cycle.baseStable}..${candidateSha}`]);
  const commits = raw.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const [sha, ...message] = record.split('\x1f');
    return { sha, message: message.join('\x1f') };
  });
  const entries = new Map();
  for (const commit of commits) {
    if (/^Release:\s*/m.test(commit.message)) continue;
    for (const issue of issueTrailers(commit.message)) {
      if (entries.has(issue)) continue;
      try {
        entries.set(issue, JSON.parse(gitRunner(['show', `${candidateSha}:${LEDGER}/${cycle.baseStable}/${issue}.json`])));
      } catch { throw new Error(`Missing classification for #${issue} against ${cycle.baseStable}; agent must classify it`); }
    }
  }
  return { ...catalogueFromCommits({ cycle, entries, commits }), candidate: candidateSha };
}

export function reconcileEntry({ cycle, entry, api, repo }) {
  validateCycle(cycle);
  validateEntry(entry, { baseStable: cycle.baseStable });
  const milestone = api('GET', `repos/${repo}/milestones/${cycle.milestone.number}`);
  if (milestone.title !== cycle.milestone.title || milestone.state !== 'open')
    throw new Error('Configured milestone was renamed or closed; update the release cycle explicitly');
  const current = api('GET', `repos/${repo}/issues/${entry.issue}`);
  const desired = isUserReleaseEntry(entry) ? cycle.milestone.number : null;
  if ((current.milestone?.number ?? null) === desired) return { changed: false, milestone: desired };
  // Never silently steal a task from an unrelated planning/historical milestone.
  if (current.milestone && current.milestone.number !== cycle.milestone.number)
    throw new Error(`#${entry.issue} belongs to another milestone; curator must resolve the conflict`);
  api('PATCH', `repos/${repo}/issues/${entry.issue}`, { milestone: desired });
  const after = api('GET', `repos/${repo}/issues/${entry.issue}`);
  if ((after.milestone?.number ?? null) !== desired) throw new Error(`Milestone write for #${entry.issue} not confirmed`);
  return { changed: true, milestone: desired };
}

export const ghApi = (method, endpoint, body) => JSON.parse(execFileSync('gh', [
  'api', '--method', method, endpoint, ...(body ? ['--input', '-'] : []),
], { encoding: 'utf8', ...(body ? { input: JSON.stringify(body) } : {}) }));

export function verifyMilestone({ catalogue, repo, api = ghApi }) {
  const { cycle, userIssues } = catalogue;
  const milestone = api('GET', `repos/${repo}/milestones/${cycle.milestone.number}`);
  if (milestone.title !== cycle.milestone.title) throw new Error('Milestone title no longer matches the authored collection link');
  const actual = [];
  for (let page = 1; ; page++) {
    const rows = api('GET', `repos/${repo}/issues?milestone=${cycle.milestone.number}&state=all&per_page=100&page=${page}`);
    actual.push(...rows.filter((row) => !row.pull_request).map((row) => row.number));
    if (rows.length < 100) break;
  }
  if ([...new Set(actual)].sort((a, b) => a - b).join(',') !== userIssues.join(','))
    throw new Error(`Milestone must contain exactly candidate user issues: expected [${userIssues}], actual [${actual.sort((a,b) => a-b)}]`);
}

if (isMainModule(import.meta.url)) {
  try {
    const arg = (key) => process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3);
    const candidate = arg('candidate') || 'HEAD';
    const repo = arg('repo') || process.env.GITHUB_REPOSITORY || 'Matysh/houseplan-card';
    const command = process.argv[2];
    if (command === 'reconcile') {
      const issue = Number(arg('issue'));
      if (!positive(issue)) throw new Error('--issue=<number> required');
      // Recovery changes GitHub bookkeeping only, and only for already merged material.
      git(['merge-base', '--is-ancestor', candidate, 'origin/dev']);
      const { cycle, entry } = readMergeEntry(candidate, issue);
      console.log(JSON.stringify(reconcileEntry({ cycle, entry, repo, api: ghApi })));
    } else if (command === 'catalogue' || command === 'verify-milestone') {
      const catalogue = readCatalogue({ candidate, tag: arg('tag') });
      if (command === 'verify-milestone') verifyMilestone({ catalogue, repo });
      console.log(JSON.stringify(catalogue, null, 2));
    } else throw new Error('usage: release-ledger.mjs catalogue|verify-milestone|reconcile --candidate=<ref> [--tag=<stable>] [--issue=N]');
  } catch (error) {
    console.error(`release ledger: ${error.message}`);
    process.exitCode = 1;
  }
}
