import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  resolveSpaceCardFit,
} from '../test-build/space-geometry.js';

test('space-card public config normalises and projects the framing policy once', () => {
  const card = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
  assert.match(card, /fit\?: SpaceCardFit/);
  assert.match(card, /fit: resolveSpaceCardFit\(config\.fit\)/);
  assert.match(card, /fit: this\._config\.fit/);
  assert.equal(resolveSpaceCardFit(undefined), 'content');
  assert.equal(resolveSpaceCardFit('content'), 'content');
  assert.equal(resolveSpaceCardFit('house'), 'house');
  assert.equal(resolveSpaceCardFit('cover'), 'content');
});

test('space-card visual editor offers only localised content and house choices', () => {
  const editor = readFileSync(new URL('../src/space-editor.ts', import.meta.url), 'utf8');
  assert.match(editor, /name: 'fit'/);
  assert.match(editor, /value: 'content', label: t\(this\._lang, 'editor\.fit_content'\)/);
  assert.match(editor, /value: 'house', label: t\(this\._lang, 'editor\.fit_house'\)/);
  assert.match(editor, /fit: t\(L, 'editor\.framing'\)/);
  assert.match(editor, /fit: resolveSpaceCardFit\(this\._config\.fit\)/);
  assert.doesNotMatch(editor, /value: 'cover'/);
});
