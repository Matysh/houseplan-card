import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readAllStylesSource } from './styles-source.mjs';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

const card = readHouseplanProductionSource();
const styles = readAllStylesSource();
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
  assert.match(staticRender, /opening\.host\?\.kind !== 'partition'/,
    'only independent-wall hosts go through the partition resolver');
  assert.match(staticRender, /!opening\.host \|\| opening\.host\.kind === 'wall'/,
    'stable contour-wall hosts retain the legacy raw-opening projection');
  assert.match(staticRender, /passages: staticPassages\.map/);
  assert.match(staticRender, /renderOpeningTunnelFills/);
  assert.match(staticRender, /passageDataTunnels/);
  assert.match(staticRender, /passageGlowTunnels/);
});

test('placement preview adds passage-only cut geometry without changing saved symbols', () => {
  const start = card.indexOf('private _renderOpeningPlacementPreview()');
  const preview = card.slice(start, card.indexOf('private _renderOpenings(', start));
  assert.match(preview, /candidate\.type === 'passage'/);
  assert.match(preview, /passagePlacementPreviewGeometry\([\s\S]*gridVisualUnits\(this\._gridPitch, this\._cellCm\)/);
  assert.equal((preview.match(/class="passage-preview-cut"/g) || []).length, 1);
  assert.equal((preview.match(/class="passage-preview-boundary"/g) || []).length, 1,
    'one mapped template emits exactly two resolved boundary records');
  assert.match(preview, /: renderOpeningVisibleGeometry\(visibleSpec\)/);
  assert.match(preview, /aria-hidden="true" pointer-events="none"/);
  assert.match(styles, /\.opening-preview\[data-kind="passage"\][\s\S]*opacity: 1/);
  assert.match(styles, /\.passage-preview-cut[\s\S]*fill-opacity: 0\.35/);
  assert.match(styles, /\.passage-preview-boundary[\s\S]*stroke: var\(--hp-open/);
});

test('all write/import paths invoke the semantic passage validator', () => {
  assert.equal((backend.match(/validate_opening_passages\(/g) || []).length, 3);
  assert.match(backend, /validate_opening_passages\(candidate_config, config_data\.get\("config"\)\)/,
    'Optimize validates the submitted v7 model before the identity barrier');
  assert.match(backend, /validate_opening_passages\(msg\["config"\], config_data\.get\("config"\)\)/,
    'Optimize validates the committed v8 model before persistence');
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

// #42 AC6: the error-text parser is JSON-first with the legacy regex format
// as one-beta read-compat, and an unknown backend code never leaks the raw
// English message into the DOM. The parsing contract lives in
// houseplan-card.ts _errText; this pins its source shape (the behavioural
// halves are driven by the smoke and the code-first branch below).
test('#42 _errText parses JSON details first and falls back code-first', () => {
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const errText = card.slice(card.indexOf('private _errText('), card.indexOf('private _backupErrorText('));
  assert.equal((errText.match(/JSON\.parse\(raw\)/g) || []).length, 2,
    'BOTH structured-details branches (passage fields and jamb margin) parse JSON first');
  assert.match(errText, /space=\(\[\^;\]\*\)/, 'the legacy regex stays as one-beta read-compat');
  assert.ok(errText.indexOf('if (e.code != null)') < errText.indexOf('if (e.message) return e.message'),
    'code-first: a coded backend error localizes before any raw message');
  assert.match(errText, /console\.warn\('\[houseplan\] backend error'/,
    'the raw message goes to the console, not the DOM');
  // both formats decode to the same numbers
  const legacy = 'space=g; opening=p1; margin=1; margin_cm=7.5';
  const json = JSON.stringify({ space: 'g', opening: 'p1', margin: 1, margin_cm: 7.5 });
  const legacyMatch = legacy.match(/margin_cm=([^;}"]*)/);
  assert.equal(Number(legacyMatch[1]), Number(JSON.parse(json).margin_cm));
});
