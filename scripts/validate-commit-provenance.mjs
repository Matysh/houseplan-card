#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TRAILER = /^([A-Za-z][A-Za-z0-9-]*):\s*(.*?)\s*$/;

export function terminalTrailers(message) {
  const lines = String(message).replace(/\r/g, '').split('\n');
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

function assertHookMode() {
  const row = git(['ls-files', '-s', '.githooks/commit-msg']);
  if (!row.startsWith('100755 ')) {
    throw new Error('.githooks/commit-msg must be tracked as executable (100755)');
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
  if (rangeAt >= 0) {
    const range = argv[rangeAt + 1];
    if (!range) throw new Error('--range requires a git revision range');
    const commits = git(['rev-list', '--reverse', range]).split('\n').filter(Boolean);
    for (const commit of commits) {
      // PROCESS.md explicitly forbids rewriting published history. The commit
      // that introduces this validator is the enforcement boundary; older PR
      // ancestry without the script remains auditable but cannot block a
      // future release branch forever.
      try { git(['cat-file', '-e', `${commit}:scripts/validate-commit-provenance.mjs`]); }
      catch { continue; }
      const parentCount = Number(git(['rev-list', '--parents', '-n', '1', commit]).split(/\s+/).length) - 1;
      if (parentCount > 1) continue;
      validateOne(
        commit,
        git(['show', '-s', '--format=%B', commit]),
        git(['diff-tree', '--no-commit-id', '--name-only', '-r', commit]).split('\n').filter(Boolean),
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
