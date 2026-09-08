import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #492 §7: ночной workflow обязан ждать дочерний Validate и наследовать его
// исход — успешный dispatch не равен успешной проверке.

const read = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

test('nightly ждёт запущенный Validate и падает вместе с ним (#492 §7)', () => {
  const nightly = read('nightly.yml');
  assert.match(nightly, /gh workflow run validate\.yml --repo "\$REPO" --ref dev -f full=true/);
  // найти именно свой прогон: dispatch на dev, созданный не раньше запуска
  assert.match(nightly, /gh run list --repo "\$REPO" --workflow validate\.yml --branch dev/);
  assert.match(nightly, /--event workflow_dispatch/);
  assert.match(nightly, /createdAt >= /);
  // отсутствие прогона — ошибка, не тихий успех
  assert.match(nightly, /прогон Validate не появился[^\n]*\n\s+exit 1/);
  // ждать с наследованием кода возврата
  assert.match(nightly, /gh run watch "\$run_id" --repo "\$REPO" --exit-status/);
  assert.match(nightly, /timeout-minutes: 90/);
  assert.match(nightly, /set -euo pipefail/);
});

test('ночная job носит русское имя и не выдаёт очередь за результат (#327, #492)', () => {
  const nightly = read('nightly.yml');
  assert.match(nightly, /name: "Запустить Validate на dev с полным набором и дождаться результата"/);
  assert.ok(!/поставлен в очередь[^\n]*\n\s*$/.test(nightly), 'echo про очередь не может быть последним шагом');
});
