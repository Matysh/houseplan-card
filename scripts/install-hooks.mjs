#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  console.log('House Plan: installed repository hooks from .githooks');
} catch {
  // npm also runs prepare for source archives and dependency installs where
  // there is no matching writable checkout. That is not an install failure.
  console.log('House Plan: no matching Git checkout; hooks were not installed');
}
