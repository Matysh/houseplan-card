import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderHeaderSpaceNavigation } from '../test-build/header-space-select.js';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('#565 View keeps native space buttons and exposes one current page', () => {
  const noop = () => {};
  const rendered = renderHeaderSpaceNavigation({
    spaces: [{ id: 'first', title: 'First' }, { id: 'second', title: 'Second' }], current: 'second',
    mode: 'view', compact: false, labels: { spaces: 'Floors', configure: 'Configure', add: 'Add' },
    reorderable: false, drag: null, pick: noop, tabClick: noop, pointerMove: noop,
    pointerDown: noop, pointerUp: noop, cancelDrag: noop, configure: null, create: null,
  });
  const templates = value => Array.isArray(value) ? value.flatMap(templates)
    : value?.strings ? [value, ...value.values.flatMap(templates)] : [];
  const binding = (template, attribute) => template.values[
    template.strings.findIndex(chunk => chunk.endsWith(`${attribute}=`))];
  assert.match(rendered.strings[0], /<nav class=/);
  assert.match(binding(rendered, 'class'), /\btabs\b/);
  assert.equal(binding(rendered, 'aria-label'), 'Floors');
  const output = templates(rendered);
  const buttons = output.filter(template => template.strings.join('').includes('data-hp="space-tab"'));
  assert.equal(buttons.length, 2);
  for (const button of buttons) assert.match(button.strings[0], /<button/);
  assert.deepEqual(buttons.map(button => [binding(button, 'data-space'), binding(button, 'aria-current')]),
    [['first', Symbol.for('lit-nothing')], ['second', 'page']]);
  assert.doesNotMatch(output.map(template => template.strings.join('')).join(''), /role="tablist"|role="tab"/);
});

test('#565 keyboard tooltip has explicit focus ownership and room labels stay untouched', () => {
  const card = source('src/houseplan-card.ts');
  const hover = source('src/live-hover.ts');
  const staticCard = source('src/space-render.ts');
  assert.match(card, /@focus=\$\{\(e: FocusEvent\) => this\._showDeviceFocusTip\(e, d\)\}/);
  assert.match(card, /@focusout=\$\{\(\) => this\._hideDeviceFocusTip\(d\.id\)\}/);
  assert.match(hover, /!target\?\.matches\(':focus-visible'\)/);
  assert.match(hover, /marker\?\.matches\(':focus-visible'\)/);
  assert.match(card, /style="left:\$\{left\}%;top:\$\{top\}%;color:\$\{nameColor\.c\};opacity:\$\{op\};--rl-scale:/);
  assert.match(staticCard, /style="left:\$\{left\}%;top:\$\{top\}%;color:\$\{nameColor\.c\};opacity:\$\{op\}"/);
  assert.doesNotMatch(staticCard, /_showDeviceFocusTip|@focus=/);
});
