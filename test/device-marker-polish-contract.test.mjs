import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { readAllStylesSource } from './styles-source.mjs';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

// #266: styles.ts is being split into surface files — style greps must
// see the whole sheet, other sources keep the direct read.
const source = (name) => name === 'styles.ts'
  ? readAllStylesSource()
  : name === 'houseplan-card.ts'
    ? readHouseplanProductionSource()
  : readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('issue 213 resolves the effective base before the face without a late visual factor', () => {
  const styles = source('styles.ts');
  assert.doesNotMatch(styles, /--device-visual-factor/);
  assert.match(
    styles,
    /--dev-size:\s*calc\(\s*var\(--device-base-size,\s*2\.25cqw\)\s*\*\s*var\(--dev-scale,\s*1\)\s*\)/,
  );
  assert.match(styles, /width:\s*max\(44px,\s*var\(--device-shell-size\)\)/);
  assert.match(
    styles,
    /--puck-size:\s*calc\(\s*var\(--device-base-size,\s*2\.25cqw\)\s*\*\s*0\.8\s*\)/,
  );
  assert.match(styles, /--mdc-icon-size:\s*calc\([^;]*var\(--dev-size[^;]*\*\s*0\.55\)/);
});

test('issue 213 gives the visual shell a shared-centre frame that owns capsule input', () => {
  const styles = source('styles.ts');
  const face = source('device-face.ts');
  assert.match(face, /class="device-shell-frame"/);
  assert.match(styles, /\.device-shell-frame\s*\{[\s\S]*inset:\s*calc\(var\(--device-shell-inset\)\s*\/\s*-1\)/);
  assert.match(styles, /\.device-shell-frame\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(styles, /\.device-shell\s*\{[\s\S]*padding:\s*0/);
});

test('issue 213 projects opening locks through the compact package layers', () => {
  const styles = source('styles.ts');
  const card = source('houseplan-card.ts');
  assert.match(styles, /--oplock-size:\s*calc\(var\(--icon-size,\s*2\.5cqw\)\s*\*\s*0\.62\)/);
  assert.match(styles, /--oplock-core-size:\s*calc\(var\(--oplock-size\)\s*\/\s*1\.26875\)/);
  assert.match(styles, /\.oplock ha-icon\s*\{[\s\S]*--mdc-icon-size:[^;]*\*\s*0\.55/);
  assert.match(card, /class="oplock \$\{deviceThemeClass\(this\._renderPlanHass\)\}/);
  assert.match(card, /class="oplock-shell"[\s\S]*class="oplock-core"/);
});

test('issue 219 gives locks red-open green-closed and themes every colored glyph', () => {
  const styles = source('styles.ts');
  const card = source('houseplan-card.ts');
  for (const [selector, background] of [
    ['oplock\\.locked', '#66D17A'],
    ['oplock\\.unlocked', '#F0410C'],
    ['dev\\.lock-locked', '#66D17A'],
    ['dev\\.lock-unlocked', '#F0410C'],
  ]) {
    const block = styles.match(new RegExp(`\\.${selector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] || '';
    assert.match(block, new RegExp(`(?:core|face)-bg:\\s*${background}`));
    assert.match(block, new RegExp(`shell-stroke:\\s*${background}`));
    assert.match(block, /(?:core|face)-fg:\s*light-dark\(#fff, #252525\)/);
  }

  const open = styles.match(/\.dev\.open\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(open, /--device-face-bg:\s*var\(--hp-open\)/);
  assert.match(open, /--device-face-fg:\s*light-dark\(#fff, #252525\)/);
  assert.doesNotMatch(open, /#4a2800/i);

  for (const state of ['on', 'open', 'lock-locked', 'lock-unlocked']) {
    assert.match(styles, new RegExp(`\\.dev\\.theme-light\\.${state.replace('-', '\\-')}[^}]*#fff`));
    assert.match(styles, new RegExp(`\\.dev\\.theme-dark\\.${state.replace('-', '\\-')}[\\s\\S]*?--device-face-fg:\\s*#252525`));
  }
  for (const state of ['locked', 'unlocked']) {
    assert.match(styles, new RegExp(`\\.oplock\\.theme-light\\.${state}[^}]*#fff`));
    assert.match(styles, new RegExp(`\\.oplock\\.theme-dark\\.${state}[\\s\\S]*?--oplock-core-fg:\\s*#252525`));
  }

  assert.match(card, /locked \? 'mdi:lock' : known \? 'mdi:lock-open-variant'/);
  for (const name of ['houseplan-card.ts', 'hp-device-preview.ts', 'space-card.ts']) {
    assert.match(source(name), /cardStyles/, `${name} must keep the shared state palette`);
  }
});

test('issue 212 Text value uses a stadium radius based on height', () => {
  const styles = source('styles.ts');
  const rule = styles.match(/\.dev\.valonly \.device-core\s*\{([\s\S]*?)\}/)?.[1] || '';
  assert.match(rule, /border-radius:\s*calc\(var\(--dev-size[^;]*\/\s*2\)/);
  assert.doesNotMatch(rule, /border-radius:\s*50%/);
});

test('issue 217 keeps the Text shell stadium while icon-only stays circular', () => {
  const styles = source('styles.ts');
  const frame = styles.match(/\.device-shell-frame\s*\{([\s\S]*?)\}/)?.[1] || '';
  const circle = styles.match(
    /\.device-shell:not\(\.with-values\):not\(\.text-shell\) \.device-shell-frame\s*\{([\s\S]*?)\}/,
  )?.[1] || '';

  assert.match(frame, /border-radius:\s*9999px/);
  assert.match(circle, /border-radius:\s*50%/);
  assert.doesNotMatch(
    styles,
    /\.device-shell:not\(\.with-values\) \.device-shell-frame\s*\{[\s\S]*?border-radius:\s*50%/,
    'the circular override must not capture a wide Text shell',
  );
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
  assert.match(
    card,
    /POINTER_HOVER_TARGET_SELECTOR\s*=\s*'[^']*hp-device-preview[^']*'/,
    'device preview must receive the card-owned pointer hover gate',
  );

  for (const name of [
    'styles.ts',
    'hp-dialog.ts',
    'hp-help.ts',
    'hp-color-opacity.ts',
    'hp-device-preview.ts',
    'space-card.ts',
  ]) {
    const text = source(name);
    const selectors = [...text.matchAll(/(^|\})([^{}]+)\{/gm)].map((match) => match[2]);
    const naked = selectors.flatMap((selector) => selector.split(','))
      .map((selector) => selector.trim())
      .filter((selector) => selector.includes(':hover'))
      .filter((selector) => !selector.includes(':host([data-pointer-hover])'));
    assert.deepEqual(naked, [], `${name} has ungated hover selectors: ${naked.join(' | ')}`);
  }
});
