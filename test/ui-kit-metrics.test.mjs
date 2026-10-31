import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { templates, collectUiKitReport, isStyleModule, registryMetrics, uiKitViolations, UI_KIT_METRICS, validateCapturePlans } from '../scripts/ui-kit-metrics.mjs';

test('style module ownership is the same for Windows and POSIX paths', () => {
  assert.equal(isStyleModule('C:\\work\\src\\styles\\tokens.ts'), true);
  assert.equal(isStyleModule('/work/src/styles/tokens.ts'), true);
  assert.equal(isStyleModule('src/styles/tokens.ts'), true);
  assert.equal(isStyleModule('src/ordinary.ts'), false);
});

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'houseplan-ui-kit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    const target = join(root, 'src', file);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, text);
  }
  return root;
}

test('capture evidence requires an existing frame or an existing runnable entry', t => {
  const root = fixture(t, { 'frame.png': 'synthetic fixture', 'capture.mjs': '' });
  const surface = { id: 'sample', frames: ['src/frame.png'] };
  const registry = { surfaces: [surface] };
  assert.doesNotThrow(() => validateCapturePlans(root, registry));
  surface.frames = ['src/missing.png'];
  assert.throws(() => validateCapturePlans(root, registry), /missing frame/);
  surface.frames = []; surface.captureScenario = 'sample';
  assert.throws(() => validateCapturePlans(root, registry), /missing runnable/);
  registry.capturePlans = { sample: { entry: 'src/capture.mjs', command: 'node src/capture.mjs' } };
  assert.doesNotThrow(() => validateCapturePlans(root, registry));
  registry.capturePlans.sample.entry = 'src/missing.mjs';
  assert.throws(() => validateCapturePlans(root, registry), /missing runnable/);
});

test('embedded style uses physical lines after expressions and quoted tag attributes; HTML comments are not styles', t => {
  const source = ['const view=html`<div>', '${long(' + JSON.stringify('x'.repeat(200)) + ', css`',
    '.b {', ' color:blue;', '}', '`)}', '<!-- <style>.fake { color:red; }</style> -->',
    '<style', ' data-test=">">', '.a {', ' color:red;', '}', '</style></div>`;'].join('\n');
  const report = collectUiKitReport(fixture(t, { 'embedded.ts': source }));
  assert.equal(report.totals.cssLinesElsewhere, 6, 'three source lines in each CSS body, counted once');
  assert.equal(report.styleTags, 1);
});

test('template parser keeps nested literal ownership; JS comments and regex backticks are not templates', () => {
  const source = [
    '// css`fake`',
    'const regex = /`[{}]/;',
    'const view = html`<div>${(() => { const close = /}/; return html`<b>${"quoted }"}</b>`; })()}</div>`;',
    'const escaped = css`a { content: "\\`"; }`;',
  ].join('\n');
  const literals = templates(source).filter(t => t.tag !== '#str');
  assert.deepEqual(literals.map(t => t.tag), ['html', 'html', 'css']);
  assert.equal(literals[0].text, '<div>${}</div>');
  assert.equal(literals[1].text, '<b>${}</b>');
  assert.match(literals[2].text, /content/);
  assert.throws(() => templates('const broken = css`'), /invalid TypeScript/);
});

test('CSS census counts physical lines across multiline interpolations and nested CSS once', t => {
  const root = fixture(t, { 'styles/example.styles.ts': [
    'const style = css`',
    '.outer {',
    '  ${(() => {',
    '    const ignored = true;',
    '    return css`color: red;`;',
    '  })()}',
    '  background: blue;',
    '}',
    '`;',
  ].join('\n') });
  const report = collectUiKitReport(root);
  assert.equal(report.totals.cssLinesStylesDir, 5);
  assert.equal(report.totals.cssLinesElsewhere, 0);
});

test('dialog inventory follows real literal tags and class attributes, including quoted greater-than and dynamic bindings', t => {
  const root = fixture(t, { 'view.ts': [
    '// <hp-dialog class="ui-dialog">',
    'const view = html`<!-- <hp-dialog> -->',
    '<hp-dialog title="a > b" class="ui-dialog settings-layout" .open=${left > right}></hp-dialog>',
    '<hp-dialog data-label="ui-dialog" class=${conditional}></hp-dialog>',
    '`;',
  ].join('\n') });
  const report = collectUiKitReport(root);
  assert.equal(report.totals.hpDialogSites, 2);
  assert.equal(report.totals.hpDialogWithoutUiDialog, 1);
  assert.equal(report.dialogs[0].settingsLayout, true);
});

test('census includes CSS fragments, embedded style and non-kit button rules without executing source', t => {
  const root = fixture(t, {
    'styles/example.styles.ts': 'const sheet = css`.btn { transition: color 160ms ease; } @keyframes spin { to { rotate: 1turn; } }`;',
    'styles/settings-action.styles.ts': 'const kit = css`.btn { color: red; }`;',
    'view.ts': 'throw Error("source must not execute"); const view = html`<style>.badge { color: red; }</style><b style="color:red"></b>`;',
  });
  const report = collectUiKitReport(root);
  assert.equal(report.totals.keyframes, 1);
  assert.equal(report.totals.transitionsInCss, 1);
  assert.equal(report.totals.btnRulesOutsideKit, 1);
  assert.equal(report.totals.inlineDecorative, 1);
  assert.equal(report.styleTags, 1);
});

test('motion and legacy selectors in CSS comments or quoted content are not declarations', t => {
  const root = fixture(t, { 'styles/example.styles.ts': [
    '// transition: fake;',
    'const styles = css`',
    '/* @keyframes fake { } .btn { transition: fake; } */',
    '.label { content: ".btn { transition: fake; @keyframes fake }"; }',
    '@keyframes "actual" { to { opacity: 1; } }',
    '`;',
  ].join('\n') });
  const report = collectUiKitReport(root);
  assert.equal(report.totals.keyframes, 1);
  assert.equal(report.keyframes[0].name, 'actual');
  assert.equal(report.totals.transitionsInCss, 0);
  assert.equal(report.totals.strayTransitions, 0);
  assert.equal(report.totals.btnRulesOutsideKit, 0);
});

test('registry counts cells, not surfaces; unsupported/unknown cells and duplicate identities refuse', () => {
  const registry = { schema: 'houseplan-ui-kit-inventory/v1', surfaces: [
    { id: 'one', cells: { button: ['K|src/button.ts:1', 'L|src/button.ts:2'], field: ['M|src/field.ts:1'] } },
    { id: 'two', cells: { native: ['N|native HA control'] } },
  ] };
  assert.deepEqual(registryMetrics(registry), { surfaces: 2, cells: 4, buckets: { K: 1, L: 1, M: 1, N: 1 }, registryOffKit: 2 });
  for (const value of ['?|uncertain', 'K|', 'M', 'Z|unknown', null]) {
    const invalid = structuredClone(registry); invalid.surfaces[0].cells.button[0] = value;
    assert.throws(() => registryMetrics(invalid), /unknown bucket|missing evidence/);
  }
  assert.throws(() => registryMetrics({ ...registry, surfaces: [...registry.surfaces, registry.surfaces[0]] }), /duplicate/);
});

test('UI Kit guard permits reductions and the CSS band; growth and missing facts fail closed', () => {
  const base = Object.fromEntries(UI_KIT_METRICS.map(name => [name, 100]));
  assert.deepEqual(uiKitViolations({ ...base, cssLines: 120, transitions: 99 }, base), []);
  assert.deepEqual(uiKitViolations({ ...base, cssLines: 121 }, base), [{ name: 'cssLines', now: 121, base: 100, band: 20 }]);
  for (const name of UI_KIT_METRICS.filter(n => n !== 'cssLines'))
    assert.equal(uiKitViolations({ ...base, [name]: 101 }, base)[0].name, name);
  assert.equal(uiKitViolations({ ...base, keyframes: undefined }, base)[0].name, 'keyframes');
  assert.equal(uiKitViolations(base, { ...base, transitions: null })[0].name, 'transitions');
});
