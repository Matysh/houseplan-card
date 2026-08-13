import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.ts', import.meta.url), 'utf8');
const openings = readFileSync(new URL('../src/iso-openings.ts', import.meta.url), 'utf8');
const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const spaceCard = readFileSync(new URL('../src/space-card.ts', import.meta.url), 'utf8');
const spaceRender = readFileSync(new URL('../src/space-render.ts', import.meta.url), 'utf8');

test('Labs iso is presentation-only and absent from the secondary space card', () => {
  assert.match(card, /subscribeLabs\(CARD_VERSION/);
  assert.match(card, /data-hp="projection-toggle"/);
  assert.match(card, /this\._labsIso && this\._mode === 'view' && !this\._kiosk/);
  assert.doesNotMatch(spaceCard, /hp-labs|iso-walls|projection-toggle|view\.volumetric/);
  assert.doesNotMatch(spaceRender, /hp-labs|iso-walls|projection-toggle|view\.volumetric/);
});

test('Stage 2 uses inert shared-projection SVG geometry without a second light model', () => {
  assert.match(card, /<svg class="iso-underlay-svg"/);
  assert.match(card, /<svg class="iso-shadows-svg"/);
  assert.match(card, /<svg class="iso-walls-svg"/);
  assert.match(card, /class="iso-wall-top"/);
  assert.match(card, /class="iso-wall-side"/);
  assert.match(card, /class="iso-opening-panel iso-\$\{panel\.type\}"/);
  assert.match(card, /aria-hidden="true" pointer-events="none"/);
  assert.doesNotMatch(styles, /perspective\s*:|preserve-3d|rotateX\(|rotateZ\(/);
  assert.doesNotMatch(card, /window-light|iso-window-light|iso-glow|iso-sun/);
});

test('all current floor/live layers remain in the one main scene', () => {
  for (const renderer of [
    '_renderDecorLayer()', '_renderRoomHoverFill(roomHover)', '_renderGlowLayer(space, disp)',
    '_renderSunRays(space)', '_renderOpenings(disp)', '_renderVacuums(devs, view)',
  ]) assert.ok(card.includes(renderer), `missing ${renderer}`);
  assert.match(card, /const point = this\._scenePoint\(\[pos\.x, pos\.y\]\)/);
  assert.match(card, /const point = this\._scenePoint\(\[p\.x, p\.y\]\)/);
});

test('structural cache includes opening flips and excludes live HA amount', () => {
  assert.match(card, /flipH: !!opening\.flip_h/);
  assert.match(card, /flipV: !!opening\.flip_v/);
  assert.match(card, /floorEdgeHeight: ISO_FLOOR_EDGE_HEIGHT, algorithm: 3/);
  const source = card.slice(card.indexOf('private _isoSource()'), card.indexOf('private _isoSceneKey()'));
  assert.doesNotMatch(source, /_openingAmt|openingAmount|\.hass|matchMedia|CSS\.supports|theme|hover/);
  assert.match(card, /projectIsoOpening\(basis, this\._openingAmt\(opening\)\)/);
  assert.match(card, /isoLayers && !isoLayers\.floorSymbols/);
  assert.match(card, /if \(!this\._spaceDisplayForRender\(\)\.showBorders\)/);
  assert.match(card, /projectedFrame\(\{ rect: flat, wallHeight: ISO_WALL_HEIGHT \}\)/);
  assert.match(card, /viewBox=\$\{isoLayers\?\.structural[\s\S]*?: `\$\{floorView\.x\}/);
  assert.match(card, /preserveAspectRatio=\$\{isoLayers\?\.structural \|\| !iso \? 'xMidYMid meet' : 'none'\}/);
  assert.match(card, /transform=\$\{isoLayers\?\.structural \? isoFloorMatrixCss\(\) : nothing\}/);
});

test('Stage 2 adds no schema, dependency, storage, network or HA action surface', () => {
  assert.doesNotMatch(openings, /localStorage|fetch\(|XMLHttpRequest|WebSocket|callService|config|schema/i);
  assert.doesNotMatch(packageJson, /three|babylon|webgl/i);
  assert.doesNotMatch(card, /iso2|isometric_stage|stage2_enabled/);
});
