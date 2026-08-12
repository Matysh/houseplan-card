import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/hp-help.ts', import.meta.url), 'utf8');

test('empty help renders no trigger and cannot create dialog overflow geometry', () => {
  assert.match(source, /if \(!this\._hasContent\(\)\) return nothing/);
  assert.match(source, /\.sr-only\s*\{[\s\S]*?position:\s*fixed/);
  assert.doesNotMatch(source, /class="sr-only"[^>]*\?hidden/);
});

test('help owns global listeners only while its surface is open', () => {
  assert.match(source, /private _subscribeOpenListeners\(\)[\s\S]*?ownerDocument\.addEventListener\('keydown'/);
  assert.match(source, /private _unsubscribeOpenListeners\(\)[\s\S]*?ownerDocument\.removeEventListener\('keydown'/);
  assert.match(source, /this\._open = true;\s*this\._subscribeOpenListeners\(\)/);
  assert.match(source, /this\._open = false;\s*this\._unsubscribeOpenListeners\(\)/);
});

test('help surface is keyboard focusable and its own scroll does not dismiss it', () => {
  assert.match(source, /role="tooltip" aria-hidden="true" tabindex="0"/);
  assert.match(source, /if \(this\._floating\.containsPath\(event\.composedPath\(\)\)\) return/);
});
