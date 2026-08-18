import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const staticRender = readFileSync(new URL('../src/space-render.ts', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../custom_components/houseplan/websocket_api.py', import.meta.url), 'utf8');
const importer = readFileSync(new URL('../custom_components/houseplan/import_export.py', import.meta.url), 'utf8');
const en = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url)));
const ru = JSON.parse(readFileSync(new URL('../src/i18n/ru.json', import.meta.url)));

test('passage is exposed in the agreed toolbar and dialog order', () => {
  const toolbar = card.slice(card.indexOf("id: 'opening'"), card.indexOf('private _renderEditorGroupLauncher'));
  const order = ['window', 'door', 'passage', 'gate'].map((id) => toolbar.indexOf(`id: '${id}'`));
  assert.equal(order.every((offset) => offset >= 0), true);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(toolbar, /id: 'passage'.*mdi:arch/s);

  const dialogStart = card.indexOf('private _renderOpeningDialog()');
  const dialog = card.slice(dialogStart, card.indexOf('private _gridLevels()', dialogStart));
  const radioOrder = ['window', 'door', 'passage', 'gate']
    .map((type) => dialog.indexOf(`.checked=\${d.type === '${type}'}`));
  assert.equal(radioOrder.every((offset) => offset >= 0), true);
  assert.deepEqual([...radioOrder].sort((a, b) => a - b), radioOrder);
  assert.match(dialog, /role="status" aria-live="polite"/);
  assert.match(dialog, /d\.type !== 'passage'[\s\S]*opening\.contact_label/);
  assert.match(dialog, /d\.type === 'door' \|\| d\.type === 'gate'/);
});

test('saving passage deletes every inapplicable known field', () => {
  const save = card.slice(card.indexOf('private _saveOpening()'), card.indexOf('private _deleteOpening()'));
  for (const field of ['contact', 'lock', 'invert', 'flip_h', 'flip_v']) {
    assert.match(save, new RegExp(`delete o\\.${field};`));
  }
  assert.match(save, /\.\.\.\(previous \|\| \{\}\)/, 'unknown sibling fields are retained');
});

test('passage bindings cannot reach subscriptions, locks or the info card', () => {
  assert.match(card, /openingEntityReferences\(opening\)/);
  assert.match(card, /\(o\.type === 'door' \|\| o\.type === 'gate'\)[\s\S]*o\.lock/);
  const info = card.slice(card.indexOf('private _renderOpeningInfoCard()'), card.indexOf('private _renderOpeningDialog()'));
  assert.match(info, /o\.type !== 'passage' && o\.contact/);
  assert.match(info, /\(o\.type === 'door' \|\| o\.type === 'gate'\) && o\.lock/);
});

test('static passage cuts and tunnels are passage-only additions', () => {
  assert.match(staticRender, /staticPassageOpenings\(resolvedRawOpenings, NORM_W\)/);
  assert.match(staticRender, /passages: staticPassages\.map/);
  assert.match(staticRender, /renderOpeningTunnelFills/);
  assert.match(staticRender, /passageDataTunnels/);
  assert.match(staticRender, /passageGlowTunnels/);
});

test('all write/import paths invoke the semantic passage validator', () => {
  assert.equal((backend.match(/validate_opening_passages\(/g) || []).length, 2);
  assert.match(importer, /validate_opening_passages\(merged_config, current_config\)/);
  assert.match(importer, /validate_opening_passages\(incoming_config, validate_all=True\)/);
});

test('passage UI copy is bilingual and carries matching placeholders', () => {
  assert.equal(en['opening.passage'], 'Open passage');
  assert.equal(ru['opening.passage'], 'Открытый проём');
  assert.match(en['opening.passage_binding_warning'], /sensor and lock/i);
  assert.match(ru['opening.passage_binding_warning'], /датчик.*замок/i);
  assert.deepEqual(
    en['opening.invalid_passage_fields'].match(/\{\w+\}/g)?.sort(),
    ru['opening.invalid_passage_fields'].match(/\{\w+\}/g)?.sort(),
  );
});
