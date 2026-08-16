#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TRAILER = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*?)\s*$/;
export const ENFORCEMENT_BOUNDARY = '8e2973fa7a7cb1a80204ff95ecf3f2d7c36ed2ce';

/** Git invokes commit-msg before it removes the editor template. Ignore the
 * standard comment/scissors suffix exactly as Git will when it records the
 * commit, while leaving ordinary prose after trailers invalid. */
export function cleanedCommitMessage(message) {
  const lines = String(message).replace(/\r/g, '').split('\n');
  const scissors = lines.findIndex((line) => /^\s*#\s*-+\s*>8\s*-+\s*$/.test(line));
  const visible = scissors >= 0 ? lines.slice(0, scissors) : lines;
  return visible.filter((line) => !/^\s*#/.test(line)).join('\n');
}

export function terminalTrailers(message) {
  const lines = cleanedCommitMessage(message).split('\n');
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const out = new Map();
  for (let index = lines.length - 1; index >= 0; index--) {
    const match = lines[index].match(TRAILER);
    if (!match) break;
    const values = out.get(match[1]) || [];
    values.unshift(match[2]);
    out.set(match[1], values);
  }
  return out;
}

export function validateCommitMessage(message, changedFiles = []) {
  const trailers = terminalTrailers(message);
  const errors = [];
  const issues = trailers.get('Issue') || [];
  if (!issues.length || issues.some((value) => !/^#[1-9][0-9]*$/.test(value))) {
    errors.push("missing or invalid terminal 'Issue: #<positive number>' trailer");
  }
  const visible = trailers.get('User-Visible') || [];
  if (visible.length !== 1 || !/^(yes|no)$/.test(visible[0])) {
    errors.push("expected exactly one terminal 'User-Visible: yes|no' trailer");
  }
  const normalizedFiles = changedFiles.map((file) => file.replaceAll('\\', '/'));
  if (visible.length === 1 && visible[0] === 'yes') {
    for (const changelog of ['docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md']) {
      if (!normalizedFiles.includes(changelog)) {
        errors.push(`user-visible commit must update ${changelog}`);
      }
    }
  }
  const changesGolden = changedFiles.some((file) =>
    /^demo\/golden\/baselines\/.*\.(png|json)$/.test(file.replaceAll('\\', '/')));
  if (changesGolden) {
    const release = trailers.get('Release') || [];
    const reviewed = trailers.get('Baseline-Reviewed') || [];
    if (release.length !== 1 || !release[0]) errors.push('golden baseline commit requires one Release trailer');
    if (reviewed.length !== 1 || !reviewed[0]) {
      errors.push('golden baseline commit requires one Baseline-Reviewed trailer');
    }
  }
  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function assertHookMode(row = git(['ls-files', '-s', '.githooks/commit-msg'])) {
  if (!row.startsWith('100755 ')) {
    throw new Error('.githooks/commit-msg must be tracked as executable (100755)');
  }
}

function gitObjectExists(revision, runner = git) {
  try { runner(['cat-file', '-e', `${revision}^{commit}`]); return true; }
  catch { return false; }
}

export function resolveValidationRange({
  eventName, beforeSha, baseSha, headSha, developmentBranch = 'dev',
}, runner = git) {
  if (!headSha) throw new Error('HEAD_SHA is required');
  if (eventName === 'pull_request') {
    if (!baseSha) throw new Error('BASE_SHA is required for a pull request');
    return `${runner(['merge-base', baseSha, headSha])}..${headSha}`;
  }
  const hasBefore = !!beforeSha && !/^0+$/.test(beforeSha)
    && gitObjectExists(beforeSha, runner);
  const comparison = hasBefore
    ? beforeSha
    // A first push has an all-zero `before`. Issue branches are cut from the
    // integration branch, not GitHub's default branch (`main`), so comparing
    // with main would pull already-landed dev commits into the validation
    // range and judge unrelated/closed issues again (#165).
    : `refs/remotes/origin/${developmentBranch || 'dev'}`;
  return `${runner(['merge-base', comparison, headSha])}..${headSha}`;
}

function assertDescendsFromBoundary(commit) {
  try { git(['merge-base', '--is-ancestor', ENFORCEMENT_BOUNDARY, commit]); }
  catch {
    throw new Error(
      `${commit} does not descend from provenance boundary ${ENFORCEMENT_BOUNDARY}`,
    );
  }
}

function validateOne(label, message, files) {
  const errors = validateCommitMessage(message, files);
  if (errors.length) throw new Error(`${label}:\n- ${errors.join('\n- ')}`);
}

function main(argv) {
  if (argv.includes('--check-hook-mode')) assertHookMode();
  const fileAt = argv.indexOf('--message-file');
  if (fileAt >= 0) {
    const messageFile = argv[fileAt + 1];
    if (!messageFile) throw new Error('--message-file requires a path');
    if (basename(messageFile) === 'MERGE_MSG') return;
    const files = argv.includes('--staged')
      ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean)
      : [];
    validateOne('commit message', readFileSync(messageFile, 'utf8'), files);
  }
  const rangeAt = argv.indexOf('--range');
  const githubRange = argv.includes('--github-range');
  if (rangeAt >= 0 || githubRange) {
    const range = githubRange
      ? resolveValidationRange({
          eventName: process.env.EVENT_NAME,
          beforeSha: process.env.BEFORE_SHA,
          baseSha: process.env.BASE_SHA,
          headSha: process.env.HEAD_SHA,
          developmentBranch: process.env.DEVELOPMENT_BRANCH,
        })
      : argv[rangeAt + 1];
    if (!range) throw new Error('--range requires a git revision range');
    const head = range.split('..').at(-1);
    assertDescendsFromBoundary(head);
    const commits = git(['rev-list', '--reverse', range]).split('\n').filter(Boolean);
    for (const commit of commits) {
      // The immutable introducing commit is the boundary. File presence is
      // intentionally irrelevant: deleting the validator inside the range
      // must not create a two-commit bypass.
      try { git(['merge-base', '--is-ancestor', ENFORCEMENT_BOUNDARY, commit]); }
      catch { continue; }
      const parentCount = Number(git(['rev-list', '--parents', '-n', '1', commit]).split(/\s+/).length) - 1;
      if (parentCount > 1) continue;
      validateOne(
        commit,
        git(['show', '-s', '--format=%B', commit]),
        git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', commit]).split('\n').filter(Boolean),
      );
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(`House Plan provenance: ${error.message}`);
    process.exitCode = 1;
  }
}
