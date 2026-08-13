import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.ts', import.meta.url), 'utf8');
const spaceCard = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
const spaceRender = readFileSync(new URL('../src/space-render.ts', import.meta.url), 'utf8');

test('Labs iso is presentation-only and absent from the secondary space card', () => {
  assert.match(card, /subscribeLabs\(CARD_VERSION/);
  assert.match(card, /data-hp="projection-toggle"/);
  assert.match(card, /this\._labsIso && this\._mode === 'view' && !this\._kiosk/);
  assert.doesNotMatch(spaceCard, /hp-labs|iso-walls|projection-toggle|view\.volumetric/);
  assert.doesNotMatch(spaceRender, /hp-labs|iso-walls|projection-toggle|view\.volumetric/);
});

test('renderer uses SVG geometry without a CSS 3D context or new window light', () => {
  assert.match(card, /<svg class="iso-walls-svg"/);
  assert.match(card, /class="iso-wall-top"/);
  assert.match(card, /class="iso-wall-side"/);
  assert.doesNotMatch(styles, /perspective\s*:|preserve-3d|rotateX\(|rotateZ\(/);
  assert.doesNotMatch(card, /iso-window|window-light|vertical-door/);
});

test('all current floor/live layers remain in the one main scene', () => {
  for (const renderer of [
    '_renderDecorLayer()', '_renderRoomHoverFill(roomHover)', '_renderGlowLayer(space, disp)',
    '_renderSunRays(space)', '_renderOpenings(disp)', '_renderVacuums(devs, view)',
  ]) assert.ok(card.includes(renderer), `missing ${renderer}`);
  assert.match(card, /const point = this\._scenePoint\(\[pos\.x, pos\.y\]\)/);
  assert.match(card, /const point = this\._scenePoint\(\[p\.x, p\.y\]\)/);
});
