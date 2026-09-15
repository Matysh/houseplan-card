import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('#582 day-cycle shadow uses one shared stage-bounded paper scene', () => {
  const helper = source('src/render/paper-scene.ts');
  const card = source('src/houseplan-card.ts');
  const staticRender = source('src/space-render.ts');
  const styles = source('src/styles/plan.styles.ts');

  assert.match(helper, /function renderPaperShapes/);
  assert.match(helper, /pointer-events="none"/);
  assert.match(card, /dayCycle && paperShapes\.length \? svg`<svg class="hp-paper-outline-svg"/);
  assert.match(card, /data-hp-live-viewbox=\$\{iso \? 'camera' : 'floor'\}/);
  assert.match(staticRender, /dayCycle && paperShapes\.length \? svg`<svg class="hp-paper-outline-svg"/);
  assert.match(card, /renderPaperShapes\(paperShapes\)/);
  assert.match(staticRender, /renderPaperShapes\(paperShapes\)/);
  assert.match(styles, /\.stage\.daycycle \.hp-paper-outline-svg/);
  assert.doesNotMatch(styles, /\.stage\.daycycle \.hp-paperg[\s\S]{0,300}will-change:\s*filter/);
});

test('#582 flat plan root is explicitly above the outline scene', () => {
  const card = source('src/houseplan-card.ts');
  const styles = source('src/styles/plan.styles.ts');
  const staticCard = source('src/space-card.ts');

  assert.match(card, /<svg class="plan-svg"/);
  assert.match(styles, /\.plan-svg \{ z-index: 1; \}/);
  assert.match(styles, /\.hp-paper-outline-svg \{[\s\S]*?z-index: 0;/);
  assert.match(staticCard, /\.hp-static-stage \.hp-paper-outline-svg \{[\s\S]*?z-index: 0;/);
});
