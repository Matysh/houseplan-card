/** #266: invariants of the styles split. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cssOfSource } from '../scripts/css-source.mjs';
import { parseRules } from '../scripts/css-lex.mjs';
import { cardStyles, baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles }
  from '../test-build/styles.js';
import { CARD_DIALOG_FORM_KIT, formKitCss } from '../test-build/styles/form-kit.styles.js';
import { panelHeaderStyles } from '../test-build/styles/panel-header.styles.js';
import { isoTilesStyles } from '../test-build/styles/iso-tiles.styles.js';
import { compactDialogCss } from '../test-build/compact-dialog-styles.js';

test('#1148 common compact dialog keeps its opaque Kit body', () => {
  const body = parseRules(compactDialogCss).find(rule =>
    rule.selectors.includes('hp-dialog.ui-dialog *:is(.body,.device-inbox)'));
  assert.ok(body, 'the composed cold/HA body owner must exist');
  const values = new Map(body.declarations.map(declaration => {
    const colon = declaration.indexOf(':');
    return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
  }));
  assert.equal(values.get('background'), 'var(--hpf-surface)');
  assert.equal(values.get('box-sizing'), 'border-box');
});

const FILES = ['base', 'plan', 'devices', 'chrome', 'dialogs', 'panel-header'];
const sourceOf = (name) =>
  readFileSync(new URL(`../src/styles/${name}.styles.ts`, import.meta.url), 'utf8');

const selectorsOf = tsSource => new Set(parseRules(cssOfSource(tsSource))
  .filter(rule => rule.kind === 'rule')
  .flatMap(rule => rule.selectors.map(selector => rule.scope.map(scope => scope + ' :: ').join('') + selector)));

test('issue 266 the aggregator is exactly the five surface files in the cascade order', () => {
  // 2026-09-18, #594: набор контролов формы в этот массив НЕ входит — он живёт
  // в ленивом редакторском графе и вносится в теневой корень при открытии
  // диалога. Пятёрка и её порядок неприкосновенны.
  // #649: the 2.5D tile sheet follows the five and is scoped to the 2.5D View
  // only (next test), so no accepted Flat frame can change through it.
  assert.deepEqual(cardStyles, [baseStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles, isoTilesStyles, panelHeaderStyles],
    'the cascade order is a contract — the golden set was accepted against it');
});

test('#649 every 2.5D tile rule is scoped to the 2.5D View stage', () => {
  const rules = parseRules(isoTilesStyles.map(sheet => sheet.cssText).join('\n')).filter(rule => rule.kind === 'rule');
  assert.ok(rules.length > 40, `expected the generated tables, got ${rules.length} rules`);
  for (const rule of rules) for (const selector of rule.selectors) {
    assert.match(selector, /\.stage\.projection-iso\.mode-view /, `unscoped 2.5D rule: ${selector}`);
  }
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

test('issue 266 surface files do not compete for selector declarations', () => {
  const sets = FILES.map((name) => ({ name, set: selectorsOf(sourceOf(name)) }));
  const clashes = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      for (const sel of sets[i].set) {
        if (!sets[j].set.has(sel)) continue;
        // #1216's room-paint defaults and the base palette intentionally share
        // :host. Independent custom-property definitions do not override paint;
        // a repeated property or any ordinary property still violates ownership.
        const declarations = name => parseRules(cssOfSource(sourceOf(name)))
          .filter(rule => rule.kind === 'rule' && rule.selectors.includes(sel) && !rule.scope.length)
          .flatMap(rule => rule.declarations.map(value => value.slice(0, value.indexOf(':')).trim()));
        if (sel === ':host') {
          const a = declarations(sets[i].name), b = declarations(sets[j].name);
          if (a.length && b.length && [...a, ...b].every(key => key.startsWith('--'))
              && !a.some(key => b.includes(key))) continue;
        }
        clashes.push(`${sel} (${sets[i].name} ∩ ${sets[j].name})`);
      }
    }
  }
  // A leading :host(...) gate is not permission to override another surface.
  assert.deepEqual(clashes, []);
});

test('issue 266 the media wrappers survived the move', () => {
  const all = FILES.map((name) => sourceOf(name)).join('\n');
  assert.equal((all.match(/@media \(forced-colors: active\)/g) || []).length, 2,
    'both forced-colors blocks must survive — golden never emulates them');
  // 10 historical source wrappers; two were MIXED-zone and split into
  // per-zone copies by the generator. #437's overlay stylesheet is loaded
  // with its lazy runtime and has its own source contract, so the five eager
  // surface owners retain 12 wrappers; #1120 adds one panel-menu-only wrapper.
  // #1132 adds the panel editor/group transition wrapper.
  // #1147 replaces local copies with the common policy; test its emitted
  // consumers rather than requiring the historical number of source copies.
  const reduced = parseRules(cardStyles.flat(Infinity).map(sheet => sheet.cssText).join('\n'))
    .filter(rule => rule.kind === 'rule' && rule.scope.some(scope => scope.includes('prefers-reduced-motion: reduce')))
    .flatMap(rule => rule.selectors);
  for (const selector of ['.hpf-boot > svg', '.hpf-loading-pill', 'button.hpf-icon-action', '.hpf-navigation > .hpf-nav-item'])
    assert.ok(reduced.includes(selector), `${selector}: missing common reduced-motion rule`);
});

test('#1184 the appended header sheet owns shared intrinsic-flow roots and its native metrics', () => {
  const rules = parseRules(panelHeaderStyles.cssText).filter(rule => rule.kind === 'rule');
  assert.ok(rules.length > 20);
  for (const rule of rules) for (const selector of rule.selectors)
    assert.ok(selector.startsWith('.hdr[data-panel-flow]')
      || /^\.hdr\[data-panel-flow=['"][0-4]['"]\]/.test(selector)
      || selector === '.panel-menu'
      || selector === '.panel-header-metrics .panel-icon-metric', `unscoped shared-header rule: ${selector}`);
});
