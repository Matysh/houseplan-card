#!/usr/bin/env node
/** Idempotent issue bookkeeping driven only by a verified release manifest. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { MEMBERSHIP_FILE, verifyReleaseMembershipAgainstGit } from './release-membership.mjs';

export const releaseCommentMarker = (tag) => `<!-- houseplan-release:${tag} -->`;

export function planIssueBookkeeping({ state, labels = [], comments = [] }, tag) {
  const marker = releaseCommentMarker(tag);
  return {
    comment: !comments.some((body) => String(body).includes(marker)),
    removeLabels: labels.filter((name) => /^S\d+-/.test(name)).sort(),
    close: state === 'OPEN',
  };
}

export function finishManifestIssues({ manifest, tag, url, ops }) {
  const marker = releaseCommentMarker(tag);
  const body = `Выпущено в \`${tag}\` · [релиз](${url})\n\n${marker}`;
  for (const { number } of manifest.issues) {
    const action = planIssueBookkeeping(ops.load(number), tag);
    if (action.comment) ops.comment(number, body);
    for (const label of action.removeLabels) ops.removeLabel(number, label);
    if (action.close) ops.close(number);
    const final = ops.load(number);
    if (final.state !== 'CLOSED'
      || final.labels.some((label) => /^S\d+-/.test(label))
      || !final.comments.some((comment) => comment.includes(marker))) {
      throw new Error(`bookkeeping for #${number} is incomplete after the attempted repair`);
    }
  }
}

const parseArgs = (args) => {
  const values = new Map();
  for (const arg of args) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match) throw new Error(`unexpected argument: ${arg}`);
    values.set(match[1], match[2]);
  }
  return values;
};

if (isMainModule(import.meta.url)) {
  try {
    const values = parseArgs(process.argv.slice(2));
    const repo = values.get('repo');
    const tag = values.get('tag');
    const candidate = values.get('candidate');
    const url = values.get('url');
    const membershipPath = values.get('membership') || MEMBERSHIP_FILE;
    if (!repo || !tag || !candidate || !url) {
      throw new Error('usage: release-bookkeeping.mjs --repo=... --tag=... --candidate=... --url=... [--membership=...]');
    }
    const run = (args) => {
      const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(`gh ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
      }
      return String(result.stdout || '').trim();
    };
    const manifest = verifyReleaseMembershipAgainstGit(
      JSON.parse(readFileSync(membershipPath, 'utf8')),
      { tag, candidate },
    );
    const load = (number) => {
      const issue = JSON.parse(run([
        'issue', 'view', String(number), '--repo', repo, '--json', 'state,labels',
      ]));
      const pages = JSON.parse(run([
        'api', '--paginate', '--slurp', `repos/${repo}/issues/${number}/comments?per_page=100`,
      ]) || '[]');
      return {
        state: issue.state,
        labels: (issue.labels || []).map((label) => label.name),
        comments: pages.flat().map((comment) => comment.body || ''),
      };
    };
    finishManifestIssues({
      manifest, tag, url,
      ops: {
        load,
        comment: (number, body) => run([
          'issue', 'comment', String(number), '--repo', repo, '--body', body,
        ]),
        removeLabel: (number, label) => run([
          'issue', 'edit', String(number), '--repo', repo, '--remove-label', label,
        ]),
        close: (number) => run([
          'issue', 'close', String(number), '--repo', repo, '--reason', 'completed',
        ]),
      },
    });
    for (const { number } of manifest.issues) console.log(`bookkeeping complete for #${number}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
