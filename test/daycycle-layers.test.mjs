// #689: day/night composition must not freeze the plan raster nor grow with
// zoom². The browser proof lives in demo/smoke_static_zoom_sharpness.mjs and
// demo/smoke_daycycle_layer_budget.mjs; this suite pins the cascade without
// Chromium so the mutants that guard it stay off the capped browser
// inventory (#659).
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
const touching = (predicate) => RULES.filter(([sels]) => sels.some(predicate));

test('#689 K1: no plan-svg rule carries a will-change: transform hint', () => {
  const hinted = touching((s) => /\.plan-svg\b/.test(s))
    .filter(([, d]) => /\btransform\b/.test(d['will-change'] || ''));
  assert.deepEqual(hinted.map(([sels]) => sels.join(', ')), []);
});

test('#689 K1: the safe day/night scene keeps an explicit layer via an opacity hint', () => {
  const decls = RULES.filter(([sels]) => sels.includes('.stage.daycycle.hp-safe-daycycle-outline .plan-svg'))
    .map(([, d]) => d);
  assert.ok(decls.some((d) => d['will-change'] === 'opacity'), 'the #582 explicit layer must stay');
});

test('#689 K3: the full card clips its filtered outline to its own box', () => {
  const clip = RULES.filter(([sels]) => sels.includes('.stage .hp-paper-outline-svg')).map(([, d]) => d);
  assert.ok(clip.some((d) => d.overflow === 'hidden'), '.stage .hp-paper-outline-svg must be overflow: hidden');
  const opened = touching((s) => /^\.stage\b/.test(s) && /\.hp-paper-outline-svg\b/.test(s))
    .filter(([, d]) => d.overflow === 'visible');
  assert.deepEqual(opened.map(([sels]) => sels.join(', ')), []);
});
