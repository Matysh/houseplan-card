import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateTags, templateAttributeValues, toolVocabularyFromSources, resolveToolExpression, missingControlHooks, missingPrimitiveIdentities } from '../scripts/data-hp-source.mjs';

const root = new URL('../', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('docs/data-hp-contract.json', root), 'utf8'));

const sourceFiles = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? sourceFiles(join(dir, entry.name))
    : extname(entry.name) === '.ts' ? [join(dir, entry.name)] : []);

const srcDir = fileURLToPath(new URL('src/', root));
const sources = sourceFiles(srcDir).map((path) => ({
  path,
  relative: relative(srcDir, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));

const sourceValues = new Set(sources.flatMap(({ text, relative: file }) =>
  [...templateAttributeValues(text, 'data-hp', file)]));
const toolVocabulary = toolVocabularyFromSources(new Map(sources.map(s => [s.relative, s.text])));
const sourceTools = new Set(sources.flatMap(({ text, relative: file }) =>
  [...templateAttributeValues(text, 'data-tool', file, (expression, name) => resolveToolExpression(expression, name, toolVocabulary))]));

const publicValues = new Set(Object.keys(contract.hooks));
const internalValue = (value) => contract.internalExactValues.includes(value)
  || contract.internalPrefixes.some((prefix) => value.startsWith(prefix));

function validateValues(values) {
  const undeclared = [...values].filter((value) => !publicValues.has(value) && !internalValue(value));
  assert.deepEqual(undeclared, [], `undeclared data-hp values: ${undeclared.join(', ')}`);
  const missing = [...publicValues].filter((value) => !values.has(value));
  assert.deepEqual(missing, [], `declared data-hp values missing from src: ${missing.join(', ')}`);
}

test('#489 inventory has a versioned, machine-readable shape', () => {
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.attribute, 'data-hp');
  assert.equal(contract.stability.removalPolicy, 'changelog-and-one-stable-version-transition');
  assert.equal(contract.stability.additionsAreCompatible, true);
  assert.ok(Object.keys(contract.hooks).length > 20);
  for (const [value, entry] of Object.entries(contract.hooks)) {
    assert.match(value, /^[a-z][a-z0-9-]*$/);
    assert.ok(Array.isArray(entry.elements) && entry.elements.length > 0, `${value}: elements`);
    assert.ok(typeof entry.since === 'string' && entry.since.length > 0, `${value}: since`);
    assert.ok(Array.isArray(entry.audience) && entry.audience.length > 0, `${value}: audience`);
    assert.ok(entry.audience.every((audience) => ['styling', 'test'].includes(audience)),
      `${value}: unknown audience`);
  }
  for (const [attribute, entry] of Object.entries(contract.rootAttributes)) {
    assert.match(attribute, /^data-hp-/);
    assert.equal(entry.element, 'ha-card');
    assert.ok(Array.isArray(entry.values) && entry.values.length > 0, `${attribute}: values`);
    assert.ok(typeof entry.since === 'string' && entry.since.length > 0, `${attribute}: since`);
  }
});

test('#489 every source data-hp value is public or explicitly internal, and every public hook exists', () => {
  validateValues(sourceValues);
});

test('#489 a renamed public hook is rejected by the same validator', () => {
  const mutant = new Set([...sourceValues].map((value) => value === 'settings' ? 'settings-renamed' : value));
  assert.throws(() => validateValues(mutant), /undeclared data-hp values: settings-renamed/);
});

test('#489 every hp-dialog call site declares a documented broad kind', () => {
  const allowed = new Set(contract.hooks.dialog.attributes['data-kind']);
  let count = 0;
  for (const { text, relative: file } of sources) {
    for (const match of text.matchAll(/<hp-dialog\b[\s\S]*?>/g)) {
      count += 1;
      const kind = match[0].match(/\bdata-kind=["']([^"']+)["']/)?.[1];
      assert.ok(kind, `${file}: hp-dialog without data-kind`);
      assert.ok(allowed.has(kind), `${file}: undocumented dialog kind ${kind}`);
    }
  }
  assert.ok(count >= 30, `expected the complete dialog surface, found ${count}`);
});

test('#489 root readiness and mode attributes cover every full-card ha-card branch', () => {
  const card = sources.find((entry) => entry.relative === 'houseplan-card.ts')?.text || '';
  const cards = [...card.matchAll(/<ha-card\b/g)].length;
  assert.equal(cards, 4, 'new root render branches must extend this contract test');
  assert.equal([...card.matchAll(/\bdata-hp-state=/g)].length, cards);
  assert.equal([...card.matchAll(/\bdata-hp-mode=/g)].length, cards);
  assert.deepEqual(contract.rootAttributes['data-hp-state'].values, ['booting', 'ready']);
  assert.deepEqual(contract.rootAttributes['data-hp-mode'].values, ['view', 'plan', 'devices', 'decor']);
  assert.match(card, /_mode:\s*'view'\s*\|\s*'plan'\s*\|\s*'devices'\s*\|\s*'decor'\s*=\s*'view'/);
});

test('#489 dialog actions, editor tool vocabulary and panel hooks remain represented', () => {
  const all = sources.map((entry) => entry.text).join('\n');
  assert.ok([...all.matchAll(/data-hp="dialog-confirm"/g)].length >= 30);
  assert.ok([...all.matchAll(/data-hp="dialog-cancel"/g)].length >= 30);
  const dialog = sources.find((entry) => entry.relative === 'hp-dialog.ts')?.text || '';
  assert.match(dialog, /connectedCallback\(\): void \{[\s\S]*this\.setAttribute\('data-hp', 'dialog'\);[\s\S]*super\.connectedCallback\(\);/);
  assert.match(dialog, /<button class="close" type="button"[\s\S]*data-hp="dialog-cancel"/);

  const toolValues = new Set(contract.hooks.tool.attributes['data-tool']);
  for (const required of [
    'select', 'draw', 'column', 'merge', 'split', 'resize', 'wall-thickness',
    'delete-room', 'opening', 'add-device', 'device-inbox', 'icon-rules',
    'backdrop', 'line', 'rect', 'ellipse', 'text', 'furniture', 'image', 'erase',
  ]) assert.ok(toolValues.has(required), `missing data-tool ${required}`);

  const panel = sources.find((entry) => entry.relative === 'houseplan-panel.ts')?.text || '';
  assert.match(panel, /menu\.dataset\.hp = 'panel-menu'/);
  assert.match(panel, /title\.dataset\.hp = 'panel-title'/);
});

// Ordinary negative input strings exercise the parser; no source, build or guard
// is replaced for a run. Mutant execution remains the scheduled suite's job.
test('#1011 data-tool inventory is symmetric and rejects unknown dynamic writers', () => {
  const declared = new Set(contract.hooks.tool.attributes['data-tool']);
  assert.deepEqual([...sourceTools].filter(v => !declared.has(v)), [], 'undeclared data-tool values');
  assert.deepEqual([...declared].filter(v => !sourceTools.has(v)), [], 'missing data-tool values');
  assert.throws(() => templateAttributeValues('html`<button data-tool=${arbitrary()}>x</button>`', 'data-tool'), /Unsupported dynamic/);
});

test('#1011 Lit reader keeps JS comparisons and nested templates out of tag parsing', () => {
  const source = 'html`<input data-hp="field" data-field=${id} @input=${e => e.value > 0}><div>${html`<button data-tool="draw"></button>`}</div>`';
  assert.deepEqual([...templateAttributeValues(source, 'data-hp')], ['field']);
  assert.deepEqual([...templateAttributeValues(source, 'data-tool')], ['draw']);
  const tags = templateTags(source);
  assert.deepEqual(tags.map(t => t.name), ['input', 'div', 'button']);
  assert.ok(tags.every(t => source.slice(t.start).startsWith('<' + t.name)));
});

const formSources = new Set([
  'decor-image-editor.ts', 'editors/form-kit.ts', 'editors/general-settings-dialog.ts',
  'editors/marker-dialog.ts', 'editors/marker-state-source.ts', 'editors/properties/editor.ts',
  'editors/properties/surface.ts', 'editors/radar-section.ts', 'editors/room-settings-dialog.ts',
  'editors/settings-north.ts', 'editors/settings-sections.ts', 'editors/space-form.ts',
  'editors/vacuum-maps-section.ts', 'editors/vacuum-settings-section.ts',
  'houseplan-editor-runtime.ts', 'houseplan-onboarding-runtime.ts', 'hp-color-opacity.ts',
  'led-strip-card.ts', 'led-strip-editor.ts',
  'hp-zigbee-topology-settings.ts', 'pdf/hp-pdf-dialog.ts', 'sun-settings-view.ts',
]);
test('#1011 critical form sources expose a stable hook on every real control', () => {
  const errors = sources.filter(s => formSources.has(s.relative)).flatMap(s => [
    ...missingControlHooks(s.text, s.relative), ...missingPrimitiveIdentities(s.text, s.relative),
  ]);
  assert.deepEqual(errors, []);
  assert.equal(sources.filter(s => formSources.has(s.relative)).length, formSources.size);
});

test('#1011 shared primitive callers supply identities, not only their templates', () => {
  for (const source of [
    'toggleRow({title:"Swap",checked:true,onChange:fn});',
    'sourcePicker({open:true});', 'unitInput(options);', 'rangeLine({id:""});',
    'selectControl({name:undefined});', 'segmented({name:nothing});', 'radioRow({name:null});',
    'toggleRow({id:"valid",fieldId:nothing});', 'sourcePicker({id:"valid",...options});',
    'import {toggleRow as toggle} from "./form-kit"; toggle({});',
    'import * as kit from "./form-kit"; kit.sourcePicker({});',
  ]) assert.equal(missingPrimitiveIdentities(source, 'form.ts').length, 1, source);
  assert.deepEqual(missingPrimitiveIdentities(
    'toggleRow({fieldId:"radar-swap-axes",fieldSlot:index}); sourcePicker({fieldId:"properties-variable-entity"}); unitInput({id}); rangeLine({id:"range"});',
  ), []);
});
test('#1011 control coverage rejects ordinary malformed markup inputs', () => {
  assert.equal(missingControlHooks('html`<input .value=${draft.name}>`', 'form.ts').length, 1);
  assert.equal(missingControlHooks('html`<input data-hp="field" data-field="">`', 'form.ts').length, 1);
  assert.equal(missingControlHooks('html`<input data-hp="field" data-field="marker-name">`', 'form.ts').length, 0);
  assert.equal(missingControlHooks('html`<button @click=${submit}>Insert</button>`', 'form.ts').length, 1);
  assert.equal(missingControlHooks('html`<button data-hp="dialog-confirm">Insert</button>`', 'form.ts').length, 0);
  for (const source of ["node.setAttribute('data-tool', choose());", 'node.dataset.tool = choose();', "node.dataset['tool'] = choose();"])
    assert.throws(() => templateAttributeValues(source, 'data-tool'), /Unsupported dynamic/);
  assert.deepEqual([...templateAttributeValues('node.innerHTML = \'<button data-tool="draw"></button>\';', 'data-tool')], ['draw']);
});
