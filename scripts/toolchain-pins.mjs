#!/usr/bin/env node
// Пины toolchain — один источник, тот же, что у CI (#496).
//
// Локальный контур расходился с CI молча: Node 24 против 22, Python 3.13 в
// документах против 3.14 в workflow, Home Assistant «какой поставился». Здесь
// пины НЕ объявляются — они ЧИТАЮТСЯ из файлов, которыми живёт CI:
//   Node      — `node-version` в .github/workflows/validate.yml
//   Python    — `python-version` там же
//   HA-стек   — tests_backend/requirements.txt (homeassistant==, плагин pytest)
//   Playwright — package-lock.json, Chromium — browsers.json самого Playwright
// Второго словаря версий не появляется; `.nvmrc` и `.python-version` обязаны
// совпадать с этим чтением (тест), чтобы nvm/uv/pyenv подхватывали их сами.
//
//   node scripts/toolchain-pins.mjs            # таблица пинов
//   node scripts/toolchain-pins.mjs --json     # для скриптов установки
//   node scripts/toolchain-pins.mjs --check    # локальное окружение против пинов

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './spawn-portable.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

/** Единственное значение среди совпадений; разнобой — ошибка, а не «первое». */
function single(values, what) {
  const unique = [...new Set(values)];
  if (unique.length !== 1) throw new Error(`${what}: ожидался один пин, найдено ${unique.length} (${unique.join(', ') || 'ни одного'})`);
  return unique[0];
}

export function pinsFromSources({
  validateYml = read('.github/workflows/validate.yml'),
  requirements = read('tests_backend/requirements.txt'),
  packageLock = JSON.parse(read('package-lock.json')),
  browsers = JSON.parse(read('node_modules/playwright-core/browsers.json')),
} = {}) {
  const node = single([...validateYml.matchAll(/node-version:\s*['"]?(\d+)['"]?/g)].map((m) => m[1]), 'node-version');
  const python = single([...validateYml.matchAll(/python-version:\s*['"]?([\d.]+)['"]?/g)].map((m) => m[1]), 'python-version');
  const req = (name) => single([...requirements.matchAll(new RegExp(`^${name.replace(/-/g, '\\-')}==([^\\s#]+)`, 'gm'))].map((m) => m[1]), name);
  const chromium = browsers.browsers.find((b) => b.name === 'chromium');
  return {
    node,
    python,
    homeassistant: req('homeassistant'),
    pytestHomeAssistant: req('pytest-homeassistant-custom-component'),
    playwright: packageLock.packages['node_modules/playwright'].version,
    chromium: chromium ? { revision: chromium.revision, version: chromium.browserVersion } : null,
  };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return `${r.stdout || ''}${r.stderr || ''}`.trim();
}

function pythonProbe(exec, explicitCommand = null) {
  const candidates = explicitCommand
    ? [[explicitCommand, []]]
    : [['python', []], ['python3', []], ['py', ['-3']]];
  for (const [command, prefix] of candidates) {
    const out = exec(command, [...prefix, '-c',
      'import sys; print(sys.version.split()[0]); print(sys.executable)']);
    if (!out) continue;
    const [version, executable] = out.split(/\r?\n/).map((line) => line.trim());
    if (/^\d+\.\d+(?:\.\d+)?$/.test(version) && executable) {
      return { command, prefix, version, executable };
    }
  }
  return null;
}

/** Что установлено локально; `null` — не найдено. */
export function localToolchain({ exec = run, pythonCommand = null } = {}) {
  const node = process.versions.node;
  const pythonRuntime = pythonProbe(exec, pythonCommand);
  const pipShow = (name) => {
    if (!pythonRuntime) return null;
    const out = exec(pythonRuntime.command, [...pythonRuntime.prefix, '-m', 'pip', 'show', name]);
    return out ? (out.match(/^Version:\s*(\S+)/m) || [])[1] || null : null;
  };
  let playwright = null;
  const playwrightPath = resolve(ROOT, 'node_modules/playwright/package.json');
  try { playwright = JSON.parse(readFileSync(playwrightPath, 'utf8')).version; } catch { /* нет */ }
  const chromiumPath = exec(process.execPath, ['-e',
    'const { chromium } = require("playwright"); process.stdout.write(chromium.executablePath())']);
  return {
    node,
    nodePath: process.execPath,
    python: pythonRuntime?.version || null,
    pythonPath: pythonRuntime?.executable || null,
    homeassistant: pipShow('homeassistant'),
    pytestHomeAssistant: pipShow('pytest-homeassistant-custom-component'),
    playwright,
    playwrightPath: existsSync(playwrightPath) ? playwrightPath : null,
    chromiumPath,
    chromiumExists: !!chromiumPath && existsSync(chromiumPath),
  };
}

/**
 * Сравнение: `{ ok, lines, failures }`. Node — по мажору, Python — по minor,
 * HA-стек — точно, но только если установлен (без него — предупреждение:
 * харнесс HA на Windows и так невозможен, fcntl).
 */
export function compareToolchain(pins, local) {
  const lines = []; const failures = [];
  const row = (name, want, have, ok, note = '') => {
    lines.push(`${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(14)} пин ${String(want).padEnd(12)} локально ${String(have ?? '—').padEnd(12)}${note}`);
    if (!ok) failures.push(name);
  };
  row('node', pins.node, local.node, String(local.node).split('.')[0] === String(pins.node),
    ` (major; ${local.nodePath || 'path unknown'})`);
  const pyMinor = (v) => (v ? v.split('.').slice(0, 2).join('.') : null);
  row('python', pins.python, local.python, pyMinor(local.python) === pyMinor(pins.python),
    ` (minor; ${local.pythonPath || 'path unknown'})`);
  for (const [key, name] of [['homeassistant', 'homeassistant'], ['pytestHomeAssistant', 'pytest-ha-plugin']]) {
    if (local[key] == null) {
      lines.push(`warn  ${name.padEnd(14)} пин ${String(pins[key]).padEnd(12)} локально —            `
        + `(не установлен в ${local.pythonPath || 'selected Python'}: полный HA-харнесс — Linux/WSL)`);
      continue;
    }
    row(name, pins[key], local[key], local[key] === pins[key]);
  }
  row('playwright', pins.playwright, local.playwright, local.playwright === pins.playwright,
    ` (${local.playwrightPath || 'package path unknown'})`);
  if (local.chromiumExists !== undefined || local.chromiumPath !== undefined) {
    const chromiumPin = `${pins.chromium?.version || '?'} rev ${pins.chromium?.revision || '?'}`;
    row('chromium', chromiumPin, local.chromiumExists ? 'installed' : 'missing',
      local.chromiumExists === true, ` (${local.chromiumPath || 'executable path unavailable'})`);
  }
  return { ok: failures.length === 0, lines, failures };
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const pins = pinsFromSources();
  const pythonEquals = argv.find((arg) => arg.startsWith('--python='));
  const pythonIndex = argv.indexOf('--python');
  const pythonCommand = pythonEquals?.slice('--python='.length)
    || (pythonIndex >= 0 ? argv[pythonIndex + 1] : null);
  if ((pythonEquals && !pythonEquals.slice('--python='.length))
    || (pythonIndex >= 0 && (!pythonCommand || pythonCommand.startsWith('--')))) {
    throw new Error('--python requires an executable path');
  }
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(pins, null, 2)}\n`);
  } else if (argv.includes('--check')) {
    const result = compareToolchain(pins, localToolchain({ pythonCommand }));
    for (const line of result.lines) console.log(line);
    console.log(result.ok
      ? 'toolchain совпадает с CI'
      : `toolchain расходится с CI: ${result.failures.join(', ')} — установка: docs/DEVELOPMENT.md, WSL: scripts/wsl-setup.sh`);
    process.exitCode = result.ok ? 0 : 1;
  } else {
    console.log(`Node ${pins.node} · Python ${pins.python} · homeassistant ${pins.homeassistant} · pytest-homeassistant-custom-component ${pins.pytestHomeAssistant} · Playwright ${pins.playwright} · Chromium ${pins.chromium?.version} (rev ${pins.chromium?.revision})`);
    console.log('источники: .github/workflows/validate.yml, tests_backend/requirements.txt, package-lock.json, playwright-core/browsers.json');
  }
}
