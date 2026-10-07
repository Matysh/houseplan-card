// #811: only inventory count digits are derived. Three-way merge the remaining
// Markdown with Git; an unresolved reason, category or ID stays the author's job.
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BROWSER_GUARD_INVENTORY } from './mutation-browser-policy.mjs';
import { normalizeBrowserGuardCounts, regenerateBrowserGuardCounts } from './mutation-browser-inventory.mjs';

function inventoryFileState({ git, cwd }) {
  const entries = git(['ls-files', '--stage', '-z', '--', BROWSER_GUARD_INVENTORY]).stdout.split('\0').filter(Boolean);
  if (!entries.length) return { ok: true, tracked: false };
  // Check Git modes as well as the worktree: core.symlinks=false can materialize
  // a tracked link as a regular file. A link must never be read or rewritten.
  if (entries.some((entry) => !/^100(?:644|755) [a-f0-9]+ [0-3]\t/.test(entry))) {
    return { ok: false, error: 'browser inventory must be a regular file in every Git stage' };
  }
  try {
    if (!lstatSync(join(cwd, BROWSER_GUARD_INVENTORY)).isFile()) {
      return { ok: false, error: 'browser inventory must be a regular file in the worktree' };
    }
  } catch (error) { return { ok: false, error: `browser inventory regular file is unavailable: ${error.message}` }; }
  return { ok: true, tracked: true };
}

export function validateBrowserInventory({ git, cwd }) {
  const state = inventoryFileState({ git, cwd });
  if (!state.ok) return state;
  if (!state.tracked) return { ok: true, text: null };
  const text = readFileSync(join(cwd, BROWSER_GUARD_INVENTORY), 'utf8');
  try { return { ok: true, text, regenerated: regenerateBrowserGuardCounts(text) }; }
  catch (error) { return { ok: false, error: error.message }; }
}

export function resolveBrowserInventoryConflict({ git, cwd, env }) {
  const state = inventoryFileState({ git, cwd });
  if (!state.ok) return state;
  const parts = [2, 1, 3].map((stage) => git(['show', `:${stage}:${BROWSER_GUARD_INVENTORY}`], {
    allowFailure: true, trim: false,
  }));
  if (parts.some((part) => !part.ok)) return { ok: false, error: 'browser inventory add/delete conflict needs the author' };
  let normalized;
  try { normalized = parts.map((part) => normalizeBrowserGuardCounts(part.stdout)); }
  catch (error) { return { ok: false, error: error.message }; }
  const temp = mkdtempSync(join(tmpdir(), 'hp-inventory-merge-'));
  try {
    const paths = normalized.map((text, i) => {
      const path = join(temp, `${i}.md`);
      writeFileSync(path, text);
      return path;
    });
    const merged = spawnSync('git', ['merge-file', '-p', '--', ...paths], {
      cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (merged.error) throw merged.error;
    if (merged.status !== 0) return { ok: false, error: 'browser inventory has a handwritten conflict after count normalization' };
    let text;
    try { text = regenerateBrowserGuardCounts(merged.stdout); }
    catch (error) { return { ok: false, error: error.message }; }
    writeFileSync(join(cwd, BROWSER_GUARD_INVENTORY), text);
    git(['add', '--', BROWSER_GUARD_INVENTORY]);
    return { ok: true };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

/** A clean textual merge can silently retain equal, now stale totals (#811). */
export function refreshBrowserInventory({ git, cwd }) {
  const result = validateBrowserInventory({ git, cwd });
  if (!result.ok || result.text === null || result.text === result.regenerated) return { ...result, changed: false };
  writeFileSync(join(cwd, BROWSER_GUARD_INVENTORY), result.regenerated);
  git(['add', '--', BROWSER_GUARD_INVENTORY]);
  // A separate docs-only commit preserves every author's original commit.
  // Identity and hooks are exactly the caller's makeGit/env/gitPrefix policy.
  git(['commit', '-m', 'docs(testing): recalculate browser inventory counts\n\nUser-Visible: no\n', '--', BROWSER_GUARD_INVENTORY]);
  return { ok: true, changed: true };
}
