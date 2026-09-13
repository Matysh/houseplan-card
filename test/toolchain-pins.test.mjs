import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareToolchain, localToolchain, pinsFromSources } from '../scripts/toolchain-pins.mjs';

// #496: пины toolchain читаются из файлов CI, а не объявляются вторым словарём.
// .nvmrc/.python-version — производные и обязаны совпадать.

test('пины читаются из workflow, requirements и lockfile; .nvmrc/.python-version совпадают (#496)', () => {
  const pins = pinsFromSources();
  assert.match(pins.node, /^\d+$/);
  assert.match(pins.python, /^\d+\.\d+$/);
  assert.match(pins.homeassistant, /^\d{4}\.\d+\.\d+$/);
  assert.match(pins.playwright, /^\d+\.\d+\.\d+$/);
  assert.equal(readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim(), pins.node);
  assert.equal(readFileSync(new URL('../.python-version', import.meta.url), 'utf8').trim(), pins.python);
  assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts['toolchain:check'],
    'node scripts/toolchain-pins.mjs --check');
});

test('разнобой пинов в источниках — ошибка, а не «первое попавшееся» (#496)', () => {
  assert.throws(() => pinsFromSources({
    validateYml: 'node-version: 22\nnode-version: 24\npython-version: "3.14"',
  }), /node-version: ожидался один пин, найдено 2/);
  assert.throws(() => pinsFromSources({
    validateYml: 'node-version: 22\n',
  }), /python-version/);
});

test('сравнение: мажор Node, minor Python, HA-стек точно и только если установлен (#496)', () => {
  const pins = { node: '22', python: '3.14', homeassistant: '2026.8.3', pytestHomeAssistant: '0.13.357', playwright: '1.62.0' };
  const good = compareToolchain(pins, { node: '22.19.0', python: '3.14.2', homeassistant: null, pytestHomeAssistant: null, playwright: '1.62.0' });
  assert.equal(good.ok, true);
  assert.ok(good.lines.some((l) => l.startsWith('warn') && l.includes('homeassistant')));
  const bad = compareToolchain(pins, { node: '24.1.0', python: '3.13.1', homeassistant: '2026.2.3', pytestHomeAssistant: '0.13.357', playwright: '1.62.0' });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.failures, ['node', 'python', 'homeassistant']);
});

test('#557 explicit Python owns both version and package probes; paths are visible', () => {
  const python = 'C:\\tools\\houseplan\\python.exe';
  const chromium = 'C:\\browser\\chrome.exe';
  const calls = [];
  const exec = (command, args) => {
    calls.push([command, args]);
    if (command === python && args.includes('-c')) return `3.14.7\n${python}`;
    if (command === python && args.at(-1) === 'homeassistant') return 'Name: homeassistant\nVersion: 2026.8.3';
    if (command === python && args.at(-1) === 'pytest-homeassistant-custom-component') {
      return 'Name: pytest-homeassistant-custom-component\nVersion: 0.13.357';
    }
    if (command === process.execPath) return chromium;
    return null;
  };

  const local = localToolchain({ exec, pythonCommand: python });
  assert.equal(local.python, '3.14.7');
  assert.equal(local.pythonPath, python);
  assert.equal(local.homeassistant, '2026.8.3');
  assert.equal(local.pytestHomeAssistant, '0.13.357');
  assert.ok(calls.filter(([command]) => command === python).every(([, args]) => !args.includes('--version')));
  assert.equal(calls.some(([command]) => ['python', 'python3', 'py'].includes(command)), false,
    'an explicit venv must never fall back to an accidental PATH Python');

  const pins = {
    node: process.versions.node.split('.')[0], python: '3.14',
    homeassistant: '2026.8.3', pytestHomeAssistant: '0.13.357', playwright: local.playwright,
    chromium: { version: '140.0.0.0', revision: '1234' },
  };
  const compared = compareToolchain(pins, { ...local, chromiumExists: true });
  assert.equal(compared.ok, true);
  assert.ok(compared.lines.some((line) => line.includes(process.execPath)));
  assert.ok(compared.lines.some((line) => line.includes(python)));
  assert.ok(compared.lines.some((line) => line.includes(local.playwrightPath)));
  assert.ok(compared.lines.some((line) => line.includes(chromium)));
});

test('#557 setup entrypoints are pinned, non-destructive and exercise Linux HA plus capture', () => {
  const windows = readFileSync(new URL('../scripts/windows-toolchain.ps1', import.meta.url), 'utf8');
  const linux = readFileSync(new URL('../scripts/wsl-setup.sh', import.meta.url), 'utf8');

  assert.match(windows, /Get-Content[^\n]+[.]nvmrc/);
  assert.match(windows, /Get-Content[^\n]+[.]python-version/);
  assert.match(windows, /Get-FileHash[^\n]+SHA256/);
  assert.match(windows, /\$env:PATH = "\$\(\$runtime[.]NodeDirectory\);\$oldPath"/);
  assert.doesNotMatch(windows, /setx|SetEnvironmentVariable|Remove-Item[^\n]+ResolvedVenv/i);
  assert.match(linux, /HOUSEPLAN_VENV:-[.]venv-ci/);
  assert.match(linux, /PY_PIN=.*[.]python-version/);
  assert.match(linux, /PROFILE=\/dev\/null bash/);
  assert.match(linux, /UV_NO_MODIFY_PATH=1 sh/);
  assert.doesNotMatch(linux, /export PATH=.*[.]local\/bin/);
  assert.match(linux, /toolchain-pins[.]mjs --check --python/);
  assert.match(linux, /tests_backend\/test_ha_setup[.]py/);
  assert.match(linux, /--scenario=panel-wide-view-light-en/);
  assert.doesNotMatch(linux, /NODE_PIN=22|PY_PIN=3[.]14/);
});
