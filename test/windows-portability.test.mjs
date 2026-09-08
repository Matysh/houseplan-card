import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isMainModule, portableCommand } from '../scripts/spawn-portable.mjs';

// #496: на машине владельца (Windows) три инфраструктурных теста падали при
// зелёном Linux CI. Причины — не логика, а переносимость: разбор argv[1] через
// `file://`, запуск команд через оболочку, CRLF из глобального git config.
// Здесь закреплены правила, чтобы они не вернулись с очередным скриптом.

const SCRIPTS = fileURLToPath(new URL('../scripts/', import.meta.url));
const scriptSources = () => readdirSync(SCRIPTS)
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => ({ name, text: readFileSync(new URL(name, `file://${SCRIPTS}`), 'utf8') }));

test('скрипты не собирают file-URL конкатенацией с argv (#496)', () => {
  const offenders = scriptSources()
    .filter(({ text }) => /new URL\(`file:\/\/\$\{process\.argv/.test(text))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], 'на Windows это даёт file:///C:/C:/… и CLI молчит; использовать isMainModule');
});

test('скрипты не включают оболочку по платформе — только portableCommand (#496)', () => {
  const offenders = scriptSources()
    .filter(({ name, text }) => name !== 'spawn-portable.mjs' && /shell:\s*process\.platform\s*===\s*'win32'/.test(text))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], 'оболочка нужна только npm.cmd; node/git через shell теряют кавычки');
});

test('portableCommand: оболочка только для npm/npx/.cmd на Windows (#496)', () => {
  assert.deepEqual(portableCommand('npm', 'win32'), { cmd: 'npm.cmd', shell: true });
  assert.deepEqual(portableCommand('npx', 'win32'), { cmd: 'npx.cmd', shell: true });
  assert.deepEqual(portableCommand('tool.CMD', 'win32'), { cmd: 'tool.CMD', shell: true });
  assert.deepEqual(portableCommand(process.execPath, 'win32'), { cmd: process.execPath, shell: false });
  assert.deepEqual(portableCommand('git', 'win32'), { cmd: 'git', shell: false });
  assert.deepEqual(portableCommand('npm', 'linux'), { cmd: 'npm', shell: false });
  assert.deepEqual(portableCommand('npm', 'darwin'), { cmd: 'npm', shell: false });
});

test('isMainModule сравнивает через pathToFileURL и терпит мусор в argv (#496)', () => {
  const here = fileURLToPath(import.meta.url);
  assert.equal(isMainModule(import.meta.url, here), true);
  assert.equal(isMainModule(pathToFileURL(here).href, here), true);
  assert.equal(isMainModule(import.meta.url, `${here}.other`), false);
  assert.equal(isMainModule(import.meta.url, null), false);
  assert.equal(isMainModule(import.meta.url, ''), false);
});

test('тесты с временным git-репозиторием изолируют переводы строк от глобального конфига (#496)', () => {
  const text = readFileSync(new URL('./rebase-on-dev.test.mjs', import.meta.url), 'utf8');
  assert.match(text, /GIT_CONFIG_KEY_0: 'core\.autocrlf', GIT_CONFIG_VALUE_0: 'false'/);
});
