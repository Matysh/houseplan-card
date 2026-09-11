// #512: the displayed version is a seam; the product never sets the override.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { displayVersion } from '../test-build/card-version.js';

test('#512 AC2: without an override the displayed version is the real one', () => {
  delete globalThis.__HP_VERSION_OVERRIDE__;
  assert.equal(displayVersion('1.73.0'), '1.73.0');
});

test('#512 AC1: a non-empty string override replaces the displayed version; anything else is ignored', () => {
  try {
    globalThis.__HP_VERSION_OVERRIDE__ = '0.0.0-golden';
    assert.equal(displayVersion('1.73.0'), '0.0.0-golden');
    for (const junk of ['', 7, null, {}, true]) {
      globalThis.__HP_VERSION_OVERRIDE__ = junk;
      assert.equal(displayVersion('1.73.0'), '1.73.0', `override ${JSON.stringify(junk)} must be ignored`);
    }
  } finally {
    delete globalThis.__HP_VERSION_OVERRIDE__;
  }
});

test('#512: every DOM/request use of the version goes through the seam; cache-busting and the console banner keep the literal', () => {
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
  const bare = (text) => text.split('\n').filter((line) => line.includes('CARD_VERSION') && !line.includes('displayVersion(CARD_VERSION)'));
  const cardBare = bare(card);
  assert.equal(cardBare.filter((line) => /const CARD_VERSION = '/.test(line)).length, 1);
  for (const line of cardBare) {
    assert.match(line, /const CARD_VERSION = '|hp_retry|console\.info/, `card: bare CARD_VERSION outside the seam: ${line.trim()}`);
  }
  const editorBare = bare(editor);
  assert.deepEqual(editorBare.map((line) => line.trim()), [`const CARD_VERSION = '${/const CARD_VERSION = '([^']+)'/.exec(editor)[1]}';`]);
  assert.match(card, /version: displayVersion\(CARD_VERSION\),/, 'PDF footer');
  assert.match(card, /frontendVersion: displayVersion\(CARD_VERSION\),/, 'version-recovery banner');
  assert.match(editor, /gs\.about_version', \{ v: displayVersion\(CARD_VERSION\) \}/, 'about dialog');
  assert.equal((editor.match(/card_version: displayVersion\(CARD_VERSION\)/g) || []).length, 2, 'support preview + backup export');
  const harness = readFileSync(new URL('../demo/golden/harness.mjs', import.meta.url), 'utf8');
  assert.match(harness, /const cardVersion = '0\.0\.0-golden';/);
  assert.match(harness, /window\.__HP_VERSION_OVERRIDE__ = cardVersion;/);
  assert.doesNotMatch(harness, /package\.json/, 'golden no longer reads the package version');
});
