#!/usr/bin/env node
/**
 * Candidate-bound issue membership for prereleases (#547).
 *
 * The manifest is deliberately deterministic and contains git evidence for
 * every issue. An S8 label is only an input hint; it is never proof that an
 * issue belongs to the pinned candidate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';

export const MEMBERSHIP_FILE = 'RELEASE-MEMBERSHIP.json';
export const MEMBERSHIP_SCHEMA = 1;

const SHA_RE = /^[0-9a-f]{40,64}$/;
const TAG_RE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function parseMembershipIssueList(value = '') {
  if (!String(value).trim()) return [];
  const parts = String(value).split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.some((part) => !/^[1-9]\d*$/.test(part))) {
    throw new Error(`issues must be comma-separated positive numbers: ${value}`);
  }
  return [...new Set(parts.map(Number))].sort((a, b) => a - b);
}

export function issueTrailers(message = '') {
  const found = [];
  for (const line of String(message).split(/\r?\n/)) {
    const match = /^Issue:\s*#([1-9]\d*)\s*$/.exec(line.trim());
    if (match) found.push(Number(match[1]));
  }
  return [...new Set(found)];
}

export function buildReleaseMembership({
  tag, candidate, base = null, commits = [], issueNumbers = [], allowUnmatched = false,
}) {
  const requested = [...new Set(issueNumbers.map(Number))].sort((a, b) => a - b);
  const evidence = new Map(requested.map((number) => [number, []]));
  for (const commit of commits) {
    if (!SHA_RE.test(commit.sha)) throw new Error(`invalid commit SHA: ${commit.sha}`);
    for (const number of issueTrailers(commit.message)) {
      if (evidence.has(number)) evidence.get(number).push(commit.sha);
    }
  }
  const unmatched = requested.filter((number) => evidence.get(number).length === 0);
  if (unmatched.length && !allowUnmatched) {
    throw new Error(
      `issues are not proven in candidate ${candidate}: ${unmatched.map((n) => `#${n}`).join(', ')}`,
    );
  }
  const manifest = {
    schema: MEMBERSHIP_SCHEMA,
    tag,
    candidate,
    base,
    issues: requested
      .filter((number) => evidence.get(number).length > 0)
      .map((number) => ({ number, commits: [...new Set(evidence.get(number))].sort() })),
  };
  validateReleaseMembership(manifest, { tag, candidate });
  return { manifest, unmatched };
}

export function validateReleaseMembership(manifest, expected = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('release membership must be a JSON object');
  }
  if (manifest.schema !== MEMBERSHIP_SCHEMA) {
    throw new Error(`unsupported release membership schema: ${manifest.schema}`);
  }
  if (!TAG_RE.test(manifest.tag || '')) throw new Error(`invalid membership tag: ${manifest.tag}`);
  if (!SHA_RE.test(manifest.candidate || '')) {
    throw new Error(`invalid membership candidate: ${manifest.candidate}`);
  }
  if (expected.tag && manifest.tag !== expected.tag) {
    throw new Error(`membership tag ${manifest.tag} != expected ${expected.tag}`);
  }
  if (expected.candidate && manifest.candidate !== expected.candidate) {
    throw new Error(`membership candidate ${manifest.candidate} != expected ${expected.candidate}`);
  }
  if (manifest.base !== null) {
    if (!manifest.base || typeof manifest.base !== 'object'
      || !TAG_RE.test(manifest.base.tag || '') || !SHA_RE.test(manifest.base.sha || '')) {
      throw new Error('membership base must be null or { tag, sha }');
    }
  }
  if (!Array.isArray(manifest.issues)) throw new Error('membership issues must be an array');
  let previous = 0;
  for (const issue of manifest.issues) {
    if (!Number.isInteger(issue?.number) || issue.number <= previous) {
      throw new Error('membership issues must be unique positive numbers in ascending order');
    }
    if (!Array.isArray(issue.commits) || issue.commits.length === 0
      || issue.commits.some((sha) => !SHA_RE.test(sha))) {
      throw new Error(`membership issue #${issue.number} has no valid commit evidence`);
    }
    if ([...new Set(issue.commits)].sort().join(',') !== issue.commits.join(',')) {
      throw new Error(`membership issue #${issue.number} commit evidence must be unique and sorted`);
    }
    previous = issue.number;
  }
  return manifest;
}

const git = (args, { allowFailure = false } = {}) => {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return { ok: result.status === 0, stdout: String(result.stdout || '').trim() };
};

export function readCandidateHistory(candidate) {
  if (!SHA_RE.test(candidate)) throw new Error(`invalid candidate SHA: ${candidate}`);
  const previous = git([
    'describe', '--tags', '--abbrev=0', '--first-parent', '--match=v*', `${candidate}^`,
  ], { allowFailure: true });
  const base = previous.ok && previous.stdout
    ? { tag: previous.stdout, sha: git(['rev-list', '-n', '1', previous.stdout]).stdout }
    : null;
  const range = base ? `${base.sha}..${candidate}` : candidate;
  const raw = git(['log', '--first-parent', '--format=%H%x1f%B%x1e', range]).stdout;
  const commits = raw.split('\x1e').map((record) => record.trim()).filter(Boolean).map((record) => {
    const separator = record.indexOf('\x1f');
    if (separator < 0) throw new Error('cannot parse candidate git history');
    return { sha: record.slice(0, separator).trim(), message: record.slice(separator + 1) };
  });
  return { base, commits };
}

export function verifyReleaseMembershipAgainstGit(manifest, expected = {}) {
  validateReleaseMembership(manifest, expected);
  const history = readCandidateHistory(manifest.candidate);
  if (JSON.stringify(history.base) !== JSON.stringify(manifest.base)) {
    throw new Error('membership base does not match the candidate history');
  }
  const all = new Set(history.commits.map((commit) => commit.sha));
  const byIssue = new Map();
  for (const commit of history.commits) {
    for (const number of issueTrailers(commit.message)) {
      if (!byIssue.has(number)) byIssue.set(number, new Set());
      byIssue.get(number).add(commit.sha);
    }
  }
  for (const issue of manifest.issues) {
    for (const sha of issue.commits) {
      if (!all.has(sha) || !byIssue.get(issue.number)?.has(sha)) {
        throw new Error(`membership evidence ${sha} does not prove issue #${issue.number}`);
      }
    }
  }
  return manifest;
}

const parseArgs = (args) => {
  const [command, ...rest] = args;
  const values = new Map();
  const switches = new Set();
  for (const arg of rest) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) throw new Error(`unexpected argument: ${arg}`);
    if (match[2] === undefined) switches.add(match[1]);
    else values.set(match[1], match[2]);
  }
  return { command, values, switches };
};

if (isMainModule(import.meta.url)) {
  try {
    const { command, values, switches } = parseArgs(process.argv.slice(2));
    const tag = values.get('tag');
    const candidate = values.get('candidate');
    const input = resolve(values.get('input') || MEMBERSHIP_FILE);
    if (command === 'create') {
      const { base, commits } = readCandidateHistory(candidate);
      const { manifest, unmatched } = buildReleaseMembership({
        tag,
        candidate,
        base,
        commits,
        issueNumbers: parseMembershipIssueList(values.get('issues')),
        allowUnmatched: switches.has('allow-unmatched'),
      });
      const output = resolve(values.get('output') || MEMBERSHIP_FILE);
      writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
      if (unmatched.length) {
        console.log(`Excluded without candidate proof: ${unmatched.map((n) => `#${n}`).join(', ')}`);
      }
      console.log(`Membership: ${manifest.issues.map((row) => `#${row.number}`).join(', ') || '(empty)'}`);
    } else if (command === 'verify' || command === 'list') {
      const manifest = JSON.parse(readFileSync(input, 'utf8'));
      verifyReleaseMembershipAgainstGit(manifest, { tag, candidate });
      if (command === 'list') console.log(manifest.issues.map((row) => row.number).join(','));
      else console.log(`Verified ${input}: ${manifest.issues.length} issue(s)`);
    } else {
      throw new Error('usage: release-membership.mjs create|verify|list --tag=... --candidate=...');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
