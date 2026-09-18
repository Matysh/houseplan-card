/** #266: invariants of the styles split. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardStyles, baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles }
  from '../test-build/styles.js';
import { CARD_DIALOG_FORM_KIT, formKitCss } from '../test-build/styles/form-kit.styles.js';

const FILES = ['base', 'plan', 'devices', 'chrome', 'dialogs'];
const sourceOf = (name) =>
  readFileSync(new URL(`../src/styles/${name}.styles.ts`, import.meta.url), 'utf8');

const selectorsOf = (tsSource) => {
  // Only the css`` payload: the TS import/export scaffolding is not CSS.
  const css = [...tsSource.matchAll(/css`([\s\S]*?)`/g)].map((m) => m[1]).join('\n');
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Set();
  const walk = (chunk, scope) => {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf('{', i);
      if (open === -1) break;
      const header = chunk.slice(i, open).replace(/\s+/g, ' ').trim();
      let depth = 1, j = open + 1;
      while (j < chunk.length && depth > 0) {
        if (chunk[j] === '{') depth++;
        else if (chunk[j] === '}') depth--;
        j++;
      }
      if (header.startsWith('@media') || header.startsWith('@supports')) {
        walk(chunk.slice(open + 1, j - 1), `${scope}${header} :: `);
      } else if (!header.startsWith('@')) {
        // The key includes the media scope: the SAME selector inside and
        // outside a wrapper are different cascade entries by construction
        // (a multi-zone @media block lands in base as a whole).
        for (const sel of header.split(',')) out.add(`${scope}${sel.trim()}`);
      }
      i = j;
    }
  };
  walk(text, '');
  return out;
};

test('issue 266 the aggregator is exactly the five surface files in the cascade order', () => {
  // 2026-09-18, #594: набор контролов формы в этот массив НЕ входит — он живёт
  // в ленивом редакторском графе и вносится в теневой корень при открытии
  // диалога. Пятёрка и её порядок неприкосновенны.
  assert.deepEqual(cardStyles, [baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles],
    'the cascade order is a contract — the golden set was accepted against it');
});

test('#594 the form kit adds selectors instead of overriding existing ones', () => {
  // Набор вносится последним листом в тот же теневой корень, поэтому его правила
  // обязаны только добавлять: совпавший селектор молча переопределил бы принятый
  // кадр и не покраснел бы нигде, кроме глаз.
  const existing = new Set();
  for (const name of FILES) for (const sel of selectorsOf(sourceOf(name))) existing.add(sel);
  const kit = selectorsOf(`css\`${formKitCss(CARD_DIALOG_FORM_KIT)}\``);
  assert.ok(kit.size > 0, 'the form kit emits no selectors at all');
  const clashes = [...kit].filter((sel) => existing.has(sel));
  assert.deepEqual(clashes, [],
    'a kit rule lands on a selector that already exists: the last position in the cascade '
    + 'would then silently change accepted frames');
});

test('issue 266 surface files do not share a single selector', () => {
  const sets = FILES.map((name) => ({ name, set: selectorsOf(sourceOf(name)) }));
  const clashes = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      for (const sel of sets[i].set) {
        if (sets[j].set.has(sel)) clashes.push(`${sel} (${sets[i].name} ∩ ${sets[j].name})`);
      }
    }
  }
  // Spec §1.3.2: the exception list is empty — a leading :host(...) gate is
  // not ownership, so gated device groups live with their surface and no
  // selector is shared between files.
  assert.deepEqual(clashes, []);
});

test('issue 266 the media wrappers survived the move', () => {
  const all = FILES.map((name) => sourceOf(name)).join('\n');
  assert.equal((all.match(/@media \(forced-colors: active\)/g) || []).length, 2,
    'both forced-colors blocks must survive — golden never emulates them');
  // 10 historical source wrappers; two were MIXED-zone and split into
  // per-zone copies by the generator. #437's overlay stylesheet is loaded
  // with its lazy runtime and has its own source contract, so the five eager
  // surface owners remain at the historical 12 wrappers.
  assert.equal((all.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length, 12,
    'reduced-motion wrappers must survive — golden always shoots reduced');
});
