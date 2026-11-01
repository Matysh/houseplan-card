import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReleaseMembership, issueTrailers, validateReleaseMembership,
} from '../scripts/release-membership.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const BASE = '0'.repeat(40);

test('#547: S8 is only a hint; candidate trailers are the membership proof', () => {
  const result = buildReleaseMembership({
    tag: 'v1.76.0-beta.1',
    candidate: A,
    base: { tag: 'v1.75.0', sha: BASE },
    commits: [{ sha: A, message: 'feat: included\n\nIssue: #10\nUser-Visible: yes' }],
    issueNumbers: [10, 11],
    allowUnmatched: true,
  });
  assert.deepEqual(result.manifest.issues, [{ number: 10, commits: [A] }]);
  assert.deepEqual(result.unmatched, [11], 'B merged after candidate A remains outside the release');
  assert.throws(() => buildReleaseMembership({
    tag: 'v1.76.0-beta.1', candidate: A, commits: [], issueNumbers: [11],
  }), /#11/);
});

test('#547: accepted external issues use the exact same proof and no author field', () => {
  const { manifest } = buildReleaseMembership({
    tag: 'v1.76.0-beta.1',
    candidate: B,
    commits: [{ sha: B, message: 'fix: contributor work\n\nIssue: #73\nUser-Visible: no' }],
    issueNumbers: [73],
  });
  assert.deepEqual(manifest.issues, [{ number: 73, commits: [B] }]);
  assert.equal('author' in manifest.issues[0], false);
});

test('#547: manifests are deterministic and reject candidate or evidence drift', () => {
  assert.deepEqual(issueTrailers('x\nIssue: #2\nIssue: #2\nIssue: #7'), [2, 7]);
  const { manifest } = buildReleaseMembership({
    tag: 'v1.76.0-beta.1', candidate: A,
    commits: [
      { sha: B, message: 'Issue: #7' },
      { sha: A, message: 'Issue: #7\nIssue: #2' },
    ],
    issueNumbers: [7, 2],
  });
  assert.deepEqual(manifest.issues, [
    { number: 2, commits: [A] },
    { number: 7, commits: [A, B] },
  ]);
  assert.throws(() => validateReleaseMembership(manifest, { candidate: B }), /expected/);
  assert.throws(() => validateReleaseMembership({
    ...manifest, issues: [{ number: 7, commits: [] }],
  }), /no valid commit evidence/);
});
