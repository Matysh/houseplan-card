// #508: hp-dialog forwards `flex-content` to ha-dialog; the summary settings dialog asks for it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8');

test('#508 AC1: both ha-dialog renders forward flexcontent from the flex-content attribute', () => {
  const source = read('hp-dialog.ts');
  assert.match(source, /flexContent: \{ type: Boolean, reflect: true, attribute: 'flex-content' \}/);
  const renders = source.match(/<ha-dialog[\s\S]*?>/g) || [];
  assert.equal(renders.length, 2, 'two ha-dialog renders (with and without described-by)');
  for (const render of renders) assert.match(render, /\?flexcontent=\$\{this\.flexContent\}/, render);
});

test('#508 AC1: the summary settings dialog declares flex-content', () => {
  const source = read('summary-panel-editor.ts');
  const open = source.match(/<hp-dialog[\s\S]*?data-kind="summary"[\s\S]*?>/)?.[0] || '';
  assert.match(open, /\bflex-content\b/, open);
});

test('#508 AC4: no other dialog opts in — flex-content stays a summary-dialog contract', () => {
  const files = ['space-copy-runtime.ts', 'houseplan-editor-runtime.ts', 'backdrop-pick.ts', 'decor-image-editor.ts',
    'summary-panel-editor.ts', 'houseplan-card.ts', 'hp-confirm.ts', 'pdf/hp-pdf-dialog.ts', 'houseplan-onboarding-runtime.ts'];
  const optIns = files.flatMap((rel) => (read(rel).match(/<hp-dialog[\s\S]*?>/g) || []).filter((tag) => /\bflex-content\b/.test(tag)));
  assert.equal(optIns.length, 1, optIns.join('\n'));
});
