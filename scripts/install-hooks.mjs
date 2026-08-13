#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = ['commit-msg', 'pre-push'];

// Git skips a hook that is not executable, and says nothing about it. A hook that
// silently does not run is worse than no hook: the gate reports success by being
// absent. The bit cannot be set through the GitHub API either — a file pushed
// that way arrives as 100644 — so it is restored here, on every install.
function makeHooksExecutable(hooksDir) {
  if (!existsSync(hooksDir)) return;
  for (const name of readdirSync(hooksDir)) {
    if (!HOOKS.includes(name)) continue;
    const file = join(hooksDir, name);
    try {
      const mode = statSync(file).mode & 0o777;
      if ((mode & 0o111) !== 0o111) chmodSync(file, mode | 0o111);
    } catch {
      // Windows reports modes it cannot change; git there runs hooks regardless.
    }
  }
}

const packageRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)));

try {
  // A git dependency can run `prepare` from node_modules inside the consuming
  // project's checkout. Never walk up and rewrite that unrelated repository.
  const gitRoot = realpathSync(execFileSync(
    'git', ['rev-parse', '--show-toplevel'],
    { cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim());
  if (gitRoot.toLowerCase() !== packageRoot.toLowerCase()
      || !existsSync(fileURLToPath(new URL('../.githooks/commit-msg', import.meta.url)))) {
    throw new Error('not the House Plan checkout root');
  }
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: packageRoot, stdio: 'ignore',
  });
  makeHooksExecutable(join(packageRoot, '.githooks'));
  console.log('House Plan: installed repository hooks from .githooks');
} catch {
  // npm also runs prepare for source archives and dependency installs where
  // there is no matching writable checkout. That is not an install failure.
  console.log('House Plan: no matching Git checkout; hooks were not installed');
}
