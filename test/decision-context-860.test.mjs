import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decisionContext, DOCUMENT_LIMIT, HISTORY_LIMIT } from '../scripts/decision-context.mjs';
import { roleEntry, ROUTES, measureRoute } from '../scripts/entry-cost.mjs';
import { weightReport } from '../scripts/repo-weight.mjs';
import { classify } from '../scripts/change-classes.mjs';
import { buildPacket } from '../scripts/task-packet.mjs';

const sha = 'a'.repeat(40);
function fixture() {
  const calls = [];
  const names = ['docs/reviews/CODE-REVIEW-101-r1.md', 'legacy/reviews/v1.0.0/CODE-REVIEW-89-r2.md'];
  const git = args => {
    calls.push(args);
    if (args[0] === 'rev-parse' || args[1] === '-1') return sha;
    if (args[0] === 'log') return 'work\n\nIssue: #101\nUser-Visible: no\0';
    if (args[0] === 'ls-tree') return names.filter(n => !n.startsWith('legacy/') || args.includes('legacy/reviews')).join('\n');
    if (args[0] === 'show') return '# Review\n\n## Решения\n\n`src/x.ts` unchanged\n\n## Вердикт\n\nзелёный\n';
    throw Error('unexpected git read');
  };
  return { git, calls, names };
}
test('#860 bounded lookup preserves explicit historical sources and immutable anchors', () => {
  const f = fixture();
  assert.equal(decisionContext({ issue: 89, git: f.git }).documents.length, 0);
  const old = decisionContext({ issue: 89, historical: true, at: '2026-10-10', git: f.git });
  assert.equal(old.documents[0].path, f.names[1]);
  assert.equal(old.documents[0].sources[0].line, 3);
  assert.ok(old.documents[0].sources[0].url.includes(`/blob/${sha}/legacy/`));
  const byFile = decisionContext({ file: 'src/x.ts', git: f.git });
  assert.equal(byFile.documents[0].issue, 101);
  assert.ok(f.calls.some(a => a.includes(`-${HISTORY_LIMIT}`)));
  f.names.push(...Array.from({ length: 30 }, (_, i) => `docs/reviews/CODE-REVIEW-101-r${i + 2}.md`));
  const many = decisionContext({ issue: 101, limit: DOCUMENT_LIMIT, git: f.git });
  assert.ok(many.reads <= 12); assert.equal(many.truncated, true);
  for (const bad of [{}, { issue: 0 }, { issue: 1, limit: 13 }, { file: '../secret' },
    { file: '/src/x' }, { file: '.' }, { issue: 1, at: '--all' }, { issue: 1, at: '2026-02-30' }])
    assert.throws(() => decisionContext({ ...bad, git: f.git }));
  assert.throws(() => decisionContext({ issue: 1, git: () => '' }), /immutable/);
  assert.throws(() => decisionContext({ issue: 1, git: () => { throw Error('unavailable'); } }));
});

test('#860 role entry never cuts required pipeline rules and counts distinct bytes/reads', () => {
  assert.deepEqual(roleEntry('author').files, ROUTES.author.files);
  assert.deepEqual(roleEntry('reviewer', ['scripts/process-resume.mjs']).files, ROUTES.canon.files);
  assert.deepEqual(roleEntry('author', ['AGENTS.md']).files, ROUTES.canon.files);
  assert.throws(() => roleEntry('unknown'));
  let reads = 0;
  const r = measureRoute({ files: ['a', 'a'], budget: 3 }, () => { reads++; return 'один два'; });
  assert.equal(reads, 1); assert.equal(r.reads, 1); assert.equal(r.bytes, Buffer.byteLength('один два'));
  const body = '## ТЗ\nДобровольный рабочий контракт инфраструктурной задачи';
  const inputs = { issue: { number: 1, body, state: 'OPEN' }, labels: ['infra', 'track:show'],
    branch: { infrastructure: true, behind: 0, changedFiles: ['scripts/x.mjs'] } };
  assert.deepEqual(buildPacket(inputs).productFlow, []);
  assert.ok(buildPacket({ ...inputs, branch: { ...inputs.branch, infrastructure: false } }).productFlow.length);
  assert.ok(buildPacket({ ...inputs, labels: [...inputs.labels, 'S3-spec'] }).productFlow.length);
  assert.ok(buildPacket({ ...inputs, specs: [{ name: '1.md' }] }).productFlow.length);
  const ignored = readFileSync(new URL('../.ignore', import.meta.url), 'utf8').split('\n').filter(l => l && !l.startsWith('#'));
  assert.deepEqual(ignored, ['/legacy/**']); assert.equal(classify('.ignore'), 'B');
});

test('#860 checkpoint reports raw host/phase metrics, never pretends cross-clone acceptance', () => {
  const calls = [];
  const report = weightReport({ now: '2026-10-12', host: 'fixture', os: 'linux', git: args => {
    calls.push(args);
    if (args[0] === 'rev-parse') return sha;
    if (args[0] === 'count-objects') return 'count: 2\nsize: 4\npacks: 1\nsize-pack: 20\n';
    return `100644 blob ${sha}     10\tdemo/a.png\n100644 blob ${sha}     20\tdist/a.js\n`;
  } });
  assert.equal(report.objectStoreKiB, 24); assert.equal(report.trackedBlobs.png.bytes, 10);
  assert.equal(report.checkpoint.comparable, false); assert.equal(report.phase, 'without-gc');
  assert.ok(calls.every(a => ['rev-parse', 'count-objects', 'ls-tree'].includes(a[0])));
  assert.throws(() => weightReport({ git: () => sha }), /incomplete/);
});
