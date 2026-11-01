// #1068: merge only the four verified Tests counters, preserving all other text.
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import {
  STATUS_COUNTER_PATH, normalizeStatusCounters, validateStatusCounters, refreshStatusCounterText,
} from './status-counter-equivalence.mjs';

const lf = text => text.replace(/\r\n/g, '\n');

function fileState({ git, cwd }) {
  const entries = git(['ls-files', '--stage', '-z', '--', STATUS_COUNTER_PATH], { trim: false }).stdout.split('\0').filter(Boolean);
  if (!entries.length) return { ok: true, tracked: false };
  const modes = entries.map(entry => /^(100644|100755) [a-f0-9]+ [0-3]\t/.exec(entry)?.[1]);
  if (modes.some(mode => !mode) || new Set(modes).size !== 1)
    return { ok: false, error: 'STATUS counters require identical regular modes in every Git stage' };
  try {
    const parts = STATUS_COUNTER_PATH.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const stat = lstatSync(join(cwd, ...parts.slice(0, i)));
      if (stat.isSymbolicLink() || (i === parts.length ? !stat.isFile() : !stat.isDirectory()))
        throw Error('non-regular STATUS path');
    }
  } catch (error) { return { ok: false, error: error.message }; }
  return { ok: true, tracked: true };
}

/** Eligibility does not impose snapshot freshness on ordinary unrelated rebases. */
export function statusCounterRebaseEligible({ git, cwd, onto }) {
  const state = fileState({ git, cwd });
  if (!state.ok || !state.tracked) return false;
  const snapshots = ['HEAD', onto].map(ref => {
    const sha = git(['rev-parse', '--verify', `${ref}^{commit}`], { allowFailure: true }).stdout;
    return /^[a-f0-9]{40}$/.test(sha) ? validateStatusCounters({ root: cwd, ref: sha }) : null;
  });
  return snapshots.every(snapshot => snapshot?.ok) && snapshots[0].policy === snapshots[1].policy;
}

export function resolveStatusCounterConflict({ git, cwd, env = process.env }) {
  const state = fileState({ git, cwd });
  if (!state.ok || !state.tracked) return { ok: false, error: state.error || 'STATUS add/delete conflict needs the author' };
  const parts = [2, 1, 3].map(stage => git(['show', `:${stage}:${STATUS_COUNTER_PATH}`], { allowFailure: true, trim: false }));
  if (parts.some(part => !part.ok)) return { ok: false, error: 'STATUS add/delete conflict needs the author' };
  // Rebase stages are the current upstream, the replayed commit's parent, and
  // the replayed commit. Check their contents, not a task-supplied assertion.
  let policy;
  for (const [index, ref] of ['HEAD', 'REBASE_HEAD^', 'REBASE_HEAD'].entries()) {
    const sha = git(['rev-parse', '--verify', `${ref}^{commit}`], { allowFailure: true }).stdout;
    const checked = /^[a-f0-9]{40}$/.test(sha) ? validateStatusCounters({ root: cwd, ref: sha }) : null;
    if (!checked?.ok || lf(checked.text) !== lf(parts[index].stdout) || (policy && policy !== checked.policy))
      return { ok: false, error: `STATUS stage ${[2, 1, 3][index]} has no verified counter snapshot: ${checked?.reason || 'missing material'}` };
    policy = checked.policy;
  }
  const parent = resolve(tmpdir()), temp = mkdtempSync(join(parent, 'hp-status-counter-merge-'));
  try {
    const paths = parts.map((part, index) => {
      const path = join(temp, `${index}.md`);
      writeFileSync(path, normalizeStatusCounters(part.stdout));
      return path;
    });
    const merged = spawnSync('git', ['merge-file', '-p', '--', ...paths], {
      cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000, maxBuffer: 2 * 1024 * 1024,
    });
    if (merged.error || merged.status !== 0)
      return { ok: false, error: 'STATUS has a non-counter conflict after normalization' };
    const refreshed = refreshStatusCounterText({ root: cwd, text: merged.stdout });
    writeFileSync(join(cwd, STATUS_COUNTER_PATH), refreshed.text);
    git(['add', '--', STATUS_COUNTER_PATH]);
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
  finally {
    if (!resolve(temp).startsWith(parent + sep)) throw Error('unexpected temporary merge path');
    rmSync(temp, { recursive: true, force: true });
  }
}

/** Equal branch increments can merge cleanly but leave the combined count stale. */
export function refreshStatusCounters({ git, cwd }) {
  const state = fileState({ git, cwd });
  if (!state.ok || !state.tracked) return { ...state, changed: false };
  try {
    const text = readFileSync(join(cwd, STATUS_COUNTER_PATH), 'utf8');
    const refreshed = refreshStatusCounterText({ root: cwd, text });
    if (!refreshed.changed) return { ok: true, changed: false };
    writeFileSync(join(cwd, STATUS_COUNTER_PATH), refreshed.text);
    git(['add', '--', STATUS_COUNTER_PATH]);
    git(['commit', '-m', 'docs(status): recalculate verified test counters after rebase\n\nUser-Visible: no\n', '--', STATUS_COUNTER_PATH]);
    return { ok: true, changed: true };
  } catch (error) { return { ok: false, error: error.message, changed: false }; }
}
