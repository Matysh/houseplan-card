import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { READS, SELECTORS } from '../demo/helpers/hp-test.mjs';
import { privateWriteSites } from '../scripts/no-new-private-writes.mjs';

// #629 AC7. Фасад харнесса входит в карточку только через публичный контракт
// #489: каждый его селектор объявлен в docs/data-hp-contract.json с аудиторией
// `test`, а из приватных членов карточки он читает ровно те, что читает и сам
// продукт. Иначе фасад стал бы тем самым приватным входом, от которого уводит.

const root = new URL('../', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('docs/data-hp-contract.json', root), 'utf8'));
const facadeText = readFileSync(new URL('demo/helpers/hp-test.mjs', root), 'utf8');

/** Нарушения контракта в таблице селекторов; пусто — таблица чиста. */
function contractViolations(selectors) {
  const problems = [];
  for (const [name, selector] of Object.entries(selectors)) {
    let hooks = 0;
    for (const match of selector.matchAll(/\[data-hp="([^"]+)"\]((?:\[[a-z-]+="[^"]*"\])*)/g)) {
      hooks += 1;
      const entry = contract.hooks[match[1]];
      if (!entry) { problems.push(`${name}: data-hp="${match[1]}" не объявлен`); continue; }
      if (!entry.audience.includes('test')) problems.push(`${name}: data-hp="${match[1]}" без аудитории test`);
      for (const attr of match[2].matchAll(/\[([a-z-]+)="([^"]*)"\]/g)) {
        const [, key, value] = attr;
        if (key === 'data-id' || key === 'data-room') continue; // идентификаторы плана, не словарь
        const allowed = entry.attributes?.[key];
        if (!allowed) { problems.push(`${name}: ${key} не объявлен у ${match[1]}`); continue; }
        if (!/^\{\w+\}$/.test(value) && !allowed.includes(value)) {
          problems.push(`${name}: ${key}="${value}" вне словаря ${match[1]}`);
        }
      }
    }
    for (const match of selector.matchAll(/(?:^|[\s,])(ha-card)\[(data-hp-[a-z-]+)[=\]]/g)) {
      hooks += 1;
      if (contract.rootAttributes[match[2]]?.element !== match[1]) problems.push(`${name}: ${match[2]} не объявлен на ha-card`);
    }
    // Селектор без контрактного хука — это привязка к вёрстке (классу, тегу).
    if (!hooks) problems.push(`${name}: нет ни одного контрактного хука`);
    const stripped = selector
      .replace(/\[data-hp(?:-[a-z-]+)?(?:="[^"]*")?\]/g, '')
      .replace(/\[data-(?:id|room|mode|tool|kind)="[^"]*"\]/g, '')
      .replace(/\bha-card\b/g, '');
    if (/[.#a-z]/i.test(stripped)) problems.push(`${name}: лишнее в селекторе — «${stripped.trim()}»`);
  }
  return problems;
}

test('#629 AC7: каждый селектор фасада — контрактный хук с аудиторией test', () => {
  assert.ok(Object.keys(SELECTORS).length >= 10, 'таблица фасада должна покрывать все операции');
  assert.deepEqual(contractViolations(SELECTORS), []);
});

test('#629 AC7: чужой селектор в таблице фасада отвергается тем же валидатором', () => {
  assert.match(contractViolations({ ...SELECTORS, gear: '.rlgearbtn' }).join('\n'), /gear: нет ни одного контрактного хука/);
  assert.match(contractViolations({ ...SELECTORS, x: '[data-hp="not-a-hook"]' }).join('\n'), /не объявлен/);
  assert.match(contractViolations({ ...SELECTORS, y: '[data-hp="tool"][data-tool="lasso"]' }).join('\n'), /вне словаря/);
  assert.match(contractViolations({ ...SELECTORS, z: '[data-hp="dialog"] .body' }).join('\n'), /лишнее в селекторе/);
});

test('#629 AC7, F3: фасад читает только разрешённые члены карточки и ничего не пишет', () => {
  const members = new Set([...facadeText.matchAll(/\.(_[A-Za-z$][\w$]*)/g)].map((m) => m[1]));
  assert.deepEqual([...members].filter((name) => !READS.includes(name)), [],
    'новый приватный член в фасаде — это новый приватный вход; добавьте DOM-хук вместо него');
  assert.deepEqual(privateWriteSites('demo/helpers/hp-test.mjs', facadeText), []);
  // отрицательный случай — тем же разбором
  const mutant = `${facadeText}\nwindow.__card._tool = 'draw';`;
  assert.equal(privateWriteSites('demo/helpers/hp-test.mjs', mutant).length, 1);
});

test('#629 P1: хук вкладки режима объявлен со словарём режимов редакторов', () => {
  assert.deepEqual(contract.hooks['mode-tab'].attributes['data-mode'], ['plan', 'devices', 'decor']);
  assert.deepEqual(contract.hooks['mode-tab'].audience, ['test']);
  assert.ok(SELECTORS.modeTab.includes('[data-hp="mode-tab"]'));
});
