import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('issue 212 applies one visual 0.9 factor without shrinking the hit target', () => {
  const styles = source('styles.ts');
  assert.match(styles, /--device-visual-factor:\s*0\.9\s*;/);
  assert.match(
    styles,
    /--dev-size:\s*calc\([^;]*var\(--device-visual-factor,\s*0\.9\)[^;]*\);/,
  );
  assert.match(styles, /width:\s*max\(44px,\s*var\(--device-shell-size\)\)/);
  assert.match(
    styles,
    /--puck-size:\s*calc\([^;]*var\(--device-visual-factor,\s*0\.9\)[^;]*\);/,
  );
});

test('issue 212 Text value uses a stadium radius based on height', () => {
  const styles = source('styles.ts');
  const rule = styles.match(/\.dev\.valonly \.device-core\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(rule, /border-radius:\s*calc\(var\(--dev-size[^;]*\/\s*2\)/);
  assert.doesNotMatch(rule, /border-radius:\s*50%/);
});

test('issue 212 feedback is owned by actual dispatch and lasts 200 ms', () => {
  const card = source('houseplan-card.ts');
  assert.match(card, /private _startDevicePressFeedback\(/);
  assert.match(card, /duration:\s*200/);
  assert.ok(
    card.match(/_startDevicePressFeedback\(actionDevice\.id\)/g)?.length >= 2,
    'HA and virtual/run dispatch paths must all opt into the same feedback owner',
  );
  assert.match(card, /private _cancelDevicePressFeedback\(/);
});

test('issue 212 removes the global touch latch and gates every shared hover selector', () => {
  const card = source('houseplan-card.ts');
  assert.doesNotMatch(card, /private static _touchSeen/);
  assert.match(card, /PointerModalityController/);
  assert.match(card, /_clearTransientHover/);

  for (const name of ['styles.ts', 'hp-dialog.ts', 'hp-help.ts', 'hp-color-opacity.ts', 'space-card.ts']) {
    const text = source(name);
    const selectors = [...text.matchAll(/(^|\})([^{}]+)\{/gm)].map((match) => match[2]);
    const naked = selectors.flatMap((selector) => selector.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => selector.includes(':hover'))
      .filter((selector) => !selector.includes(':host([data-pointer-hover])'));
    assert.deepEqual(naked, [], `${name} has ungated hover selectors: ${naked.join(' | ')}`);
  }
});
