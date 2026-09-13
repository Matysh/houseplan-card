// #556: перемещаемая ссылка в `uses:` — это доверие чужому владельцу тега здесь
// и сейчас, а не коду, который читали. До правки конвейер брал
// `home-assistant/actions/hassfest@master` и `hacs/action@main`, то есть
// произвольный будущий коммит чужой ветки, а ревьюера с Read/Write/Bash
// запускал перемещаемый major `anthropics/claude-code-action@v1`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  auditRepository, auditWorkflowSource, isLocal, isPinned, hasVersionNote, listWorkflows,
} from '../scripts/action-pins.mjs';

test('#556: в репозитории не осталось незакреплённых Actions', () => {
  assert.deepEqual(auditRepository(), []);
});

test('#556: проверка смотрит на все воркфлоу, а не на один', () => {
  const files = listWorkflows();
  assert.ok(files.length >= 9, `воркфлоу найдено ${files.length}`);
  assert.ok(files.includes('process.yml') && files.includes('validate.yml'));
});

test('#556: локальная переиспользуемая workflow пина не требует', () => {
  assert.equal(isLocal('./.github/workflows/announce.yml'), true);
  assert.deepEqual(auditWorkflowSource('x.yml', '    uses: ./.github/workflows/announce.yml\n'), []);
});

test('#556: перемещаемая ссылка — находка, в какой бы форме ни пришла', () => {
  for (const spec of [
    'actions/checkout@v7', 'hacs/action@main', 'home-assistant/actions/hassfest@master',
    'anthropics/claude-code-action@v1', 'owner/repo@abc1234',
  ]) {
    assert.equal(isPinned(spec), false, spec);
    const found = auditWorkflowSource('x.yml', `      - uses: ${spec}\n`);
    assert.equal(found.length, 1, spec);
    assert.match(found[0], /не закреплён полным SHA/);
  }
});

test('#556: SHA без комментария с версией — тоже находка', () => {
  const sha = 'a'.repeat(40);
  assert.equal(isPinned(`owner/repo@${sha}`), true);
  assert.equal(hasVersionNote(' # v7'), true);
  assert.equal(hasVersionNote(''), false);
  const bare = auditWorkflowSource('x.yml', `      - uses: owner/repo@${sha}\n`);
  assert.equal(bare.length, 1);
  assert.match(bare[0], /без комментария с версией/);
  assert.deepEqual(auditWorkflowSource('x.yml', `      - uses: owner/repo@${sha} # v7\n`), []);
});

test('#556: находка называет файл и строку', () => {
  const source = ['jobs:', '  a:', '    steps:', '      - uses: hacs/action@main'].join('\n');
  assert.match(auditWorkflowSource('.github/workflows/x.yml', source)[0],
    /^\.github\/workflows\/x\.yml:4: /);
});

// Проверка обязана стоять в предполётном вердикте Validate, иначе она есть, но
// не сработает ни на одном пуше.
test('#556: preflight Validate считает пины частью вердикта', () => {
  const workflow = readFileSync(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const preflight = workflow.slice(0, workflow.indexOf('\n  changes:'));
  assert.match(preflight, /^\s+run: node scripts\/action-pins\.mjs$/m, 'шаг запускает проверку');
  assert.match(preflight, /ACTION_PINS: \$\{\{ steps\.action_pins\.outcome \}\}/);
  assert.match(preflight, /^\s+check "пины сторонних Actions" "\$ACTION_PINS"$/m,
    'исход попадает в вердикт, а не теряется в continue-on-error');
});
