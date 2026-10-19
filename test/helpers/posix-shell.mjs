// Execute POSIX fixtures on the host, including native Windows (#960).
// Windows' system32/bash.exe is a WSL launcher, not the shell of this checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

let tools;
function gitTools() {
  if (!tools) {
    const execPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
    const root = resolve(execPath, '../../..');
    tools = [join(root, 'usr/bin'), resolve(execPath, '../../bin')];
    if (!existsSync(join(tools[0], 'bash.exe'))) throw Error('POSIX fixtures require Git for Windows with Git Bash');
  }
  return tools;
}

// C:/... works in both MSYS utilities and native Node; do not rewrite script bodies.
export const shellPath = path => process.platform === 'win32' ? String(path).replaceAll('\\', '/') : String(path);

export function posixCommand(command) {
  return process.platform === 'win32' && ['bash', 'sh'].includes(command)
    ? join(gitTools()[0], `${command}.exe`) : command;
}

export function runPosix(command, args, options = {}) {
  const { prependPath = [], env = process.env, ...rest } = options;
  const clean = { ...env };
  if (process.platform === 'win32' || prependPath.length) {
    const pathKey = Object.keys(clean).find(k => process.platform === 'win32' ? k.toLowerCase() === 'path' : k === 'PATH');
    const paths = [...prependPath, ...(process.platform === 'win32' ? gitTools() : []), clean[pathKey]];
    if (pathKey) delete clean[pathKey];
    clean.PATH = paths.filter(Boolean).join(delimiter);
  }
  return spawnSync(posixCommand(command), args, { encoding: 'utf8', ...rest, env: clean });
}
