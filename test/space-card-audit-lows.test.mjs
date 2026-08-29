import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');

// #376(а): YAML `title:` with no value parses as null. The owner decided null
// and '' mean the same thing — no header AND the compact frame. The behaviour
// is proven end-to-end by demo/smoke_space_card.mjs (nullTitleFrame); this
// contract keeps the condition from silently narrowing back to '' only.
test('#376(а) the compact frame accepts both the empty string and null title', () => {
  assert.match(card,
    /compactTopFrame: this\._config\.title === '' \|\| this\._config\.title === null,/);
});

// #376(е): the render gate is strict `=== true`; the dispose gate must be its
// exact mirror, so a truthy-but-not-true value (light_pools: 1) neither draws
// pools nor keeps a glow runtime and a blend probe alive.
test('#376(е) light_pools gates are symmetric: anything but true disposes', () => {
  assert.match(card, /lightPools: this\._config\.light_pools === true,/);
  assert.match(card,
    /if \(this\._config\.light_pools !== true\) \{\s*\n\s*disposeGlowRuntime\(/);
  assert.ok(!/if \(!this\._config\.light_pools\) \{\s*\n\s*disposeGlowRuntime\(/.test(card),
    'the old truthy dispose gate must not return');
});
