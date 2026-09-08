import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareToolchain, pinsFromSources } from '../scripts/toolchain-pins.mjs';

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
