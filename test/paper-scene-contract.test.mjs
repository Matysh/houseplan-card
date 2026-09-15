import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('#582 camera movement switches the day-cycle shadow to a stage-bounded scene', () => {
  const helper = source('src/render/paper-scene.ts');
  const card = source('src/houseplan-card.ts');
  const staticRender = source('src/space-render.ts');
  const styles = source('src/styles/plan.styles.ts');

  assert.match(helper, /function renderPaperShapes/);
  assert.match(helper, /pointer-events="none"/);
  assert.match(card, /dayCycle && paperShapes\.length \? svg`<svg class="hp-paper-outline-svg"/);
  assert.match(card, /data-hp-live-viewbox=\$\{iso \? 'camera' : 'floor'\}/);
  assert.doesNotMatch(staticRender, /class="hp-paper-outline-svg"/);
  assert.match(card, /renderPaperShapes\(paperShapes\)/);
  assert.match(staticRender, /renderPaperShapes\(paperShapes\)/);
  assert.match(card, /private _activateSafeDayCycleOutline\(\)/);
  assert.match(card, /hp-safe-daycycle-outline/);
  assert.match(styles, /\.stage\.daycycle \.hp-paperg/);
  assert.match(styles, /\.stage\.daycycle\.hp-safe-daycycle-outline \.hp-paper-outline-svg/);
  assert.match(styles, /\.stage\.daycycle\.hp-safe-daycycle-outline \.hp-paperg \{[\s\S]*?filter:\s*none;[\s\S]*?will-change:\s*auto;/);
});

test('#582 safe camera scene uses explicit bounded plan and outline layers', () => {
  const card = source('src/houseplan-card.ts');
  const styles = source('src/styles/plan.styles.ts');
  const staticCard = source('src/space-card.ts');

  assert.match(card, /<svg class="plan-svg"/);
  assert.match(styles, /\.plan-svg \{ z-index: 1; \}/);
  assert.match(styles, /\.hp-paper-outline-svg \{[\s\S]*?z-index: 0;/);
  assert.match(styles, /\.stage\.daycycle\.hp-safe-daycycle-outline \.plan-svg \{[\s\S]*?will-change:\s*transform;/);
  assert.doesNotMatch(staticCard, /\.hp-static-stage \.hp-paper-outline-svg/);
});
