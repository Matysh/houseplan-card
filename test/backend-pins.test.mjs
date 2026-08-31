import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #399: пин фронтенда не выводился ниоткуда — его однажды назначили руками, и
// получился набор, которого нет ни в одном релизе Home Assistant. Отказа это
// не вызывало (пакет — статика), но обещание #392 «по SHA видно, чем
// проверяли» переставало быть правдой ровно там, где его труднее всего
// заметить.

const read = (name) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8');

// Ожидание живёт рядом с пином, а не в сети: тест обязан работать без
// GitHub. Источник — homeassistant/package_constraints.txt тега 2026.8.3.
// Поднимая HA, обновлять обе строки из того же файла.
const EXPECTED = { homeassistant: '2026.8.3', frontend: '20260729.7' };

const pinned = (name) => {
  const line = read('tests_backend/requirements.txt')
    .split('\n')
    .find((row) => row.trimStart().startsWith(`${name}==`));
  assert.ok(line, `${name} обязан быть закреплён в tests_backend/requirements.txt`);
  return line.trim().split('==')[1].split('#')[0].trim();
};

test('#399 AC1: фронтенд закреплён так, как требует закреплённый Home Assistant', () => {
  assert.equal(pinned('homeassistant'), EXPECTED.homeassistant,
    'версия HA изменилась — ожидание фронтенда ниже больше не действует,'
    + ' возьмите новое из package_constraints.txt соответствующего тега');
  assert.equal(pinned('home-assistant-frontend'), EXPECTED.frontend,
    'пин фронтенда разошёлся с констрейнтами закреплённого HA:'
    + ' проверяется набор, которого не существует');
});

test('#399 AC1: источник версии назван в самом файле', () => {
  const requirements = read('tests_backend/requirements.txt');
  assert.match(requirements, /package_constraints\.txt/,
    'следующий подъём HA не должен превращаться в угадывание: откуда взялась'
    + ' версия фронтенда, сказано рядом с ней');
});
