import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('#565 View keeps native space buttons and exposes one current page', () => {
  const card = source('src/houseplan-card.ts');
  assert.match(card, /<nav class="tabs" aria-label=\$\{this\._t\('nav\.spaces'\)\}/);
  assert.match(card, /aria-current=\$\{this\._space === s\.id \? 'page' : nothing\}/);
  assert.doesNotMatch(card, /role="tablist"|role="tab"/);
});

test('#565 keyboard tooltip has explicit focus ownership and room labels stay untouched', () => {
  const card = source('src/houseplan-card.ts');
  const hover = source('src/live-hover.ts');
  const staticCard = source('src/space-render.ts');
  assert.match(card, /@focus=\$\{\(e: FocusEvent\) => this\._showDeviceFocusTip\(e, d\)\}/);
  assert.match(card, /@focusout=\$\{\(\) => this\._hideDeviceFocusTip\(d\.id\)\}/);
  assert.match(hover, /!target\?\.matches\(':focus-visible'\)/);
  assert.match(hover, /marker\?\.matches\(':focus-visible'\)/);
  assert.match(card, /style="left:\$\{left\}%;top:\$\{top\}%;color:\$\{disp\.color\};opacity:\$\{op\};--rl-scale:/);
  assert.match(staticCard, /style="left:\$\{left\}%;top:\$\{top\}%;color:\$\{disp\.color\};opacity:\$\{op\}"/);
  assert.doesNotMatch(staticCard, /_showDeviceFocusTip|@focus=/);
});
