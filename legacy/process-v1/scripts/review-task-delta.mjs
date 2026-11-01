// #1068: compare the reviewed task delta, never erase upstream runtime inputs.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { STATUS_COUNTER_PATH, validateStatusCounters } from './status-counter-equivalence.mjs';

export const REVIEW_DELTA_EXCLUDES = Object.freeze([
  ':!docs/reviews', ':!legacy/reviews',
]);
const hash = text => createHash('sha256').update(text).digest('hex');
const INVENTORY_PATH = 'scripts/ci-registry-inventory.json';
const INVENTORY_JOBS = ['frontend', 'backend', 'geometry_parity', 'smoke', 'golden', 'performance_smoke'];
const git = (root, args, options = {}) => execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', ...args], {
  encoding: 'utf8', timeout: 15000, maxBuffer: 16 * 1024 * 1024,
  env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '', GIT_TERMINAL_PROMPT: '0' }, ...options,
});

// This weaker identity is ONLY a raw-counter-change signal, never authority
// for equivalence. Ignore upstream STATUS blob/position drift so that an
// unchanged counter edit cannot gain the narrow exception on its own.
function counterChangeDiff(diff) {
  return String(diff).split(/(?=^diff --git )/m).map(section => {
    const binary = /^Binary files |^GIT binary patch/m.test(section);
    return section.split('\n').filter(line => !(!binary && /^index [0-9a-f]+\.\.[0-9a-f]+(?: \d+)?$/.test(line)))
      .map(line => /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line) ? '@@' : line).join('\n');
  }).join('');
}

function regularTextBlob(root, ref, path) {
  const row = git(root, ['ls-tree', '-z', ref, '--', path]);
  if (!row) return null;
  const match = /^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/.exec(row);
  if (!match || match[3] !== path) throw Error('Review delta requires a regular blob: ' + path);
  const bytes = git(root, ['cat-file', 'blob', match[2]], { encoding: null }), text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw Error('Review delta requires valid UTF-8: ' + path);
  return { mode: match[1], text };
}

/** The one structured data exception binds path edits to their exact job key.
 * Array offsets are not identity in this schema; the path sets are sorted and
 * unique. No inventory field is ignored, and CI still fingerprints raw blobs. */
export function registryInventoryReviewDelta(before, after) {
  if (!before && !after) return '';
  const parse = blob => {
    if (!blob || !['100644', '100755'].includes(blob.mode)) throw Error('Unsupported registry inventory presence/mode');
    const value = JSON.parse(blob.text);
    if (!value || Object.keys(value).join(',') !== 'schema,jobs,protocol' || value.schema !== 1
      || !value.jobs || Object.keys(value.jobs).join(',') !== INVENTORY_JOBS.join(',')
      || blob.text !== JSON.stringify(value, null, 2) + '\n') throw Error('Unsupported canonical registry inventory');
    const groups = { ...Object.fromEntries(INVENTORY_JOBS.map(job => ['jobs.' + job, value.jobs[job]])), protocol: value.protocol };
    for (const paths of Object.values(groups)) {
      if (!Array.isArray(paths) || paths.some(path => typeof path !== 'string' || /[\\\0\r\n]/.test(path)
        || path.split('/').some(part => !part || part === '.' || part === '..'))
        || new Set(paths).size !== paths.length || paths.some((path, index) => index && paths[index - 1] >= path))
        throw Error('Registry inventory requires sorted unique relative paths');
    }
    return groups;
  };
  const left = parse(before), right = parse(after), changes = [];
  for (const group of Object.keys(left)) {
    const a = new Set(left[group]), b = new Set(right[group]);
    const removed = left[group].filter(path => !b.has(path)), added = right[group].filter(path => !a.has(path));
    if (removed.length || added.length) changes.push({ group, removed, added });
  }
  return changes.length || before.mode !== after.mode
    ? JSON.stringify({ path: INVENTORY_PATH, beforeMode: before.mode, afterMode: after.mode, changes }) + '\n' : '';
}

function normalizedFileDiff(root, base, material, path, normalize) {
  const before = regularTextBlob(root, base, path), after = regularTextBlob(root, material, path);
  if (!before && !after) return '';
  const work = mkdtempSync(join(tmpdir(), 'hp-review-delta-'));
  if (!resolve(work).startsWith(resolve(tmpdir()) + sep)) throw Error('Unexpected temporary delta directory');
  try {
    for (const [side, value] of [['left', before], ['right', after]]) {
      mkdirSync(join(work, side), { recursive: true });
      if (!value) continue;
      const target = join(work, side, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, normalize(value.text)); chmodSync(target, value.mode === '100755' ? 0o755 : 0o644);
    }
    let diff;
    const args = ['diff', '--no-index', '--no-color', '--no-ext-diff', '--no-textconv',
      '--full-index', '--unified=0', '--src-prefix=a/', '--dst-prefix=b/', '--', 'left', 'right'];
    try { diff = git(work, args); } catch (error) {
      if (error.status !== 1 || typeof error.stdout !== 'string') throw error;
      diff = error.stdout;
    }
    const modes = before?.mode !== after?.mode ? `mode ${path}: ${before?.mode ?? 'absent'} -> ${after?.mode ?? 'absent'}\n` : '';
    return modes + diff.split('\n').map(line => /^(?:diff --git |--- |\+\+\+ )/.test(line)
      ? line.replace(/\b([ab])\/(?:left|right)\//g, '$1/') : line).join('\n');
  } finally { rmSync(work, { recursive: true, force: true }); }
}

/** Both sides must contain the supported generator and correct immutable counts. */
export function reviewTaskDelta({ root = process.cwd(), base, material }) {
  const before = validateStatusCounters({ root, ref: base });
  const after = validateStatusCounters({ root, ref: material });
  if (!before.ok || !after.ok) throw Error('Unverified STATUS counters: ' + (before.reason || after.reason));
  if (before.policy !== after.policy) throw Error('STATUS generator policy changed in the task');
  const ordinary = git(root, ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames',
    '--full-index', '--unified=0', base, material, '--', '.', ...REVIEW_DELTA_EXCLUDES,
    `:!${STATUS_COUNTER_PATH}`, `:!${INVENTORY_PATH}`]);
  const inventory = registryInventoryReviewDelta(regularTextBlob(root, base, INVENTORY_PATH), regularTextBlob(root, material, INVENTORY_PATH));
  const rawStatus = normalizedFileDiff(root, base, material, STATUS_COUNTER_PATH, text => text);
  const normalizedStatus = normalizedFileDiff(root, base, material, STATUS_COUNTER_PATH,
    text => text === before.text ? before.normalized : text === after.text ? after.normalized : (() => { throw Error('STATUS snapshot changed'); })());
  return {
    base: git(root, ['rev-parse', `${base}^{commit}`]).trim(),
    material: git(root, ['rev-parse', `${material}^{commit}`]).trim(),
    tree: git(root, ['rev-parse', `${material}^{tree}`]).trim(),
    raw_delta: hash(ordinary + inventory + counterChangeDiff(rawStatus)),
    // Full blob identities and hunk locations are intentional. Equal +/-
    // lines can edit different functions or duplicate blocks in one function.
    // Upstream touching a task-edited ordinary file therefore requires a
    // fresh review. STATUS uses full identities of its normalized blobs too:
    // handwritten changes there cannot relocate behind equal counter digits.
    normalized_delta: hash(ordinary + inventory + normalizedStatus),
    policy: before.policy,
  };
}

export function counterOnlyTaskRebase(previous, current) {
  return Boolean(previous && current && previous.base !== current.base
    && previous.policy === current.policy && previous.normalized_delta === current.normalized_delta
    && previous.raw_delta !== current.raw_delta);
}
