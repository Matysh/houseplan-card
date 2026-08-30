import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Гигиена backend-тестов (#393): тест не имеет права оставлять после себя
// изменённую импорт-машину. В #389 это
// стоило пяти часов красного dev: пустышка в sys.modules пережила свой тест,
// Home Assistant перестал видеть у интеграции async_setup, и 85 тестов
// харнесса падали с голым `assert False`, не намекая на причину.
//
// Проверка статическая — по исходникам, без запуска. Это намеренно: рантайм
// ловит последствие и только на том порядке тестов, который сегодня сложился,
// а исходник ловит намерение.

const BACKEND = fileURLToPath(new URL('../tests_backend/', import.meta.url));
const files = () => readdirSync(BACKEND).filter((name) => name.endsWith('.py'));
const read = (name) => readFileSync(new URL(name, `file://${BACKEND}`), 'utf8');

test('backend-тесты не правят sys.path (#393)', () => {
  const offenders = files().filter((name) => /^\s*sys\.path\b/m.test(read(name)));
  assert.deepEqual(offenders, [],
    'sys.path, изменённый при коллекции, действует на всю сессию: модули пакета'
    + ' становятся импортируемыми ещё и как модули верхнего уровня, и один файл'
    + ' может оказаться в sys.modules дважды с разными объектами классов.'
    + ' Читать модуль без Home Assistant можно и без этого — см. test_trails.py:'
    + ' текст файла и exec нужного среза.');
});
