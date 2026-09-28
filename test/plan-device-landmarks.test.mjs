// #687: the Plan editor shows device markers as landmarks exactly as the
// Background editor does (#362). The behaviour is proven in a real browser by
// demo/smoke_plan_device_landmarks.mjs; this suite pins the cascade contract
// without Chromium so the mutants that guard it stay off the capped browser
// inventory (#659). Parity of the 35% with the Background editor is a
// computed-style fact and stays with the smoke (#624: no text reads of the
// monolith).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planStyles } from '../test-build/styles.js';

/** Top-level and @media rules of one stylesheet as [selectors[], decls{}]. */
const rulesOf = (cssText) => {
  const text = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const walk = (chunk) => {
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
      const body = chunk.slice(open + 1, j - 1);
      if (header.startsWith('@media') || header.startsWith('@supports')) walk(body);
      else if (!header.startsWith('@')) {
        const decls = {};
        for (const part of body.split(';')) {
          const colon = part.indexOf(':');
          if (colon > 0) decls[part.slice(0, colon).trim()] = part.slice(colon + 1).trim();
        }
        out.push([header.split(',').map((s) => s.trim()), decls]);
      }
      i = j;
    }
  };
  walk(text);
  return out;
};

const RULES = rulesOf(planStyles.cssText);
const declsFor = (selector) => RULES.filter(([sels]) => sels.includes(selector)).map(([, d]) => d);
const MARKER = '.stage.markup .devlayer .dev';

test('#687 the Plan editor no longer hides device markers', () => {
  const hiding = RULES.filter(([sels, d]) => d.display === 'none'
    && sels.some((s) => s.includes('.stage.markup') && /\.dev\b/.test(s) && !s.includes('.devlayer .dev ')));
  assert.deepEqual(hiding.map(([sels]) => sels.join(', ')), []);
});

test('#687 the Plan fade multiplies the marker\'s own opacity instead of replacing it', () => {
  const decls = declsFor(MARKER);
  assert.ok(decls.some((d) => d.filter === 'opacity(0.35)'), `${MARKER} must fade with filter: opacity(0.35)`);
  // .dev.unavail and .dev.ghost carry their own opacity; the Background layer
  // multiplies it, so the Plan editor must not override the property.
  assert.ok(decls.every((d) => !('opacity' in d)), `${MARKER} must not set opacity`);
});

test('#687 the whole marker subtree is pointer-inert in the Plan editor, as in Background', () => {
  for (const [plan, background] of [
    [MARKER, '.stage.mode-decor .devlayer'],
    [`${MARKER} *`, '.stage.mode-decor .devlayer *'],
    [`${MARKER}::before`, '.stage.mode-decor .dev::before'],
  ]) {
    assert.ok(declsFor(plan).some((d) => d['pointer-events'] === 'none'), `${plan} must be pointer-inert`);
    assert.ok(declsFor(background).some((d) => d['pointer-events'] === 'none'), `${background} must stay pointer-inert`);
  }
});

test('#687 the landmark fade is scoped to the Plan editor stage', () => {
  // View, the Device editor and the kiosk keep their markers untouched.
  const fades = RULES.filter(([sels, d]) => d.filter === 'opacity(0.35)' && sels.some((s) => /\.dev\b/.test(s)));
  assert.ok(fades.length > 0);
  for (const [sels] of fades) {
    assert.ok(sels.every((s) => s.startsWith('.stage.markup ')), `unscoped fade: ${sels.join(', ')}`);
  }
});
