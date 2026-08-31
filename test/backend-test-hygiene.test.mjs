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

/** Файлы, которым запись в `sys.modules` разрешена поимённо (#398 AC3).
 *
 *  Список короткий не случайно. `conftest.py` ставит пустышки родительских
 *  пакетов, когда Home Assistant недоступен, — по условию и осознанно (#394).
 *  `pure_imports.py` регистрирует загружаемый модуль ровно на время
 *  `exec_module` и снимает регистрацию в `finally`; статический разбор этого
 *  знать не может, поэтому файл назван здесь, а то, что он действительно
 *  убирает за собой, доказывает исполняемая проверка ниже. */
const SYS_MODULES_WRITERS = ['conftest.py', 'pure_imports.py'];

const files = () => readdirSync(BACKEND).filter((name) => name.endsWith('.py'));
const read = (name) => readFileSync(new URL(name, `file://${BACKEND}`), 'utf8');

/** Записи в `sys.modules`, про которые нельзя доказать, что пакет интеграции
 *  они не трогают (#398).
 *
 *  Прежняя проверка искала строковый литерал `sys.modules['custom_components`
 *  и не видела `sys.modules[name] = module` — так третий заход класса #389
 *  проехал мимо гварда, заведённого ради него. Здесь разбирается сам факт
 *  записи, а решение принимается по ключу:
 *
 *  - ключ — литерал или f-строка с литеральным началом: безопасно, если это
 *    начало не `custom_components` (так тесты ставят `homeassistant.*`,
 *    `hp_pure.*`, `houseplan.trails` — свои имена, к пакету не относящиеся);
 *  - ключ — выражение, либо это `setdefault`/`update`: судить о содержимом
 *    статически нельзя, поэтому запись считается нарушением, КОГДА файл вообще
 *    способен назвать пакет интеграции — то есть содержит литерал вида
 *    `custom_components.` (с точкой: это имя модуля, а не кусок пути).
 *
 *  Последнее и есть fail-closed в осмысленной форме: файл, который нигде не
 *  упоминает имя пакета, отравить его переменной не может, а файл, который
 *  упоминает, обязан делать это разрешённым способом. */
function sysModulesWrites(source) {
  const code = source.replace(/#[^\n]*/g, '');
  const namesThePackage = /(['"])custom_components\./.test(code);
  // Начало ключа, если оно доказуемо литеральное: целая строка либо f-строка
  // до первой подстановки. Всё прочее (конкатенация, вызов, переменная) — не
  // литерал: доказать по нему ничего нельзя.
  const literalStart = (key) => {
    const whole = /^(['"])((?:[^'"\\]|\\.)*)\1$/.exec(key.trim());
    if (whole) return whole[2];
    const fstring = /^f(['"])((?:[^'"\\{]|\\.)*)/.exec(key.trim());
    return fstring ? fstring[2] : null;
  };
  const hits = [];
  for (const match of code.matchAll(/sys\.modules\s*\[([^\]]*)\]\s*=/g)) {
    const start = literalStart(match[1]);
    if (start === null) { if (namesThePackage) hits.push(match[0]); continue; }
    if (start.startsWith('custom_components')) hits.push(match[0]);
  }
  for (const match of code.matchAll(/sys\.modules\.(?:setdefault|update)\s*\(/g)) {
    if (namesThePackage) hits.push(match[0]);
  }
  return hits;
}

test('backend-тесты не правят sys.path (#393)', () => {
  const offenders = files().filter((name) => /^\s*sys\.path\b/m.test(read(name)));
  assert.deepEqual(offenders, [],
    'sys.path, изменённый при коллекции, действует на всю сессию: модули пакета'
    + ' становятся импортируемыми ещё и как модули верхнего уровня, и один файл'
    + ' может оказаться в sys.modules дважды с разными объектами классов.'
    + ' Читать модуль без Home Assistant можно и без этого — см. test_trails.py:'
    + ' текст файла и exec нужного среза.');
});

test('пакет интеграции подменяет только conftest и только без HA (#394)', () => {
  // Пустышка вместо `custom_components.houseplan` — единственный способ читать
  // подмодули без Home Assistant, и запретить её нельзя. Но место у неё одно:
  // conftest, где решение принимается по честному признаку «есть ли HA».
  //
  // Когда её ставили сами тесты под условием «если ещё не импортирован», в CI
  // она не срабатывала лишь потому, что настоящий пакет успевал импортироваться
  // из файла, который идёт раньше по алфавиту. Корректность харнесса держалась
  // на именах файлов; чем это кончается, показал #389.
  // #398: проверка смотрит на ФАКТ записи в `sys.modules`, а не на её запись
  // строковым литералом. Прежняя регулярка искала `sys.modules['custom_...`
  // и не видела `sys.modules[name] = module` в pure_imports.py — третий заход
  // того же класса проехал мимо гварда, заведённого ради него.
  //
  // Разбор грубый и fail-closed: ключ, про который нельзя доказать, что он не
  // из `custom_components`, считается нарушением. Догонять формы записи
  // регуляркой — бесконечная гонка, отказывать на непонятном — нет.
  const offenders = files()
    .filter((name) => !SYS_MODULES_WRITERS.includes(name))
    .filter((name) => sysModulesWrites(read(name)).length > 0);
  assert.deepEqual(offenders, [],
    'запись в sys.modules живёт только в tests_backend/conftest.py (условная'
    + ' подмена пакета) и tests_backend/pure_imports.py (регистрация, снимаемая'
    + ' тем же вызовом). В остальных файлах она переживает свой тест и'
    + ' достаётся всей сессии (#389, #394, #398).');

  const conftest = read('conftest.py');
  assert.match(conftest, /if not HAS_HA:/,
    'подмена в conftest обязана быть под условием отсутствия Home Assistant');
  const stub = conftest.slice(conftest.indexOf('if not HAS_HA:'));
  assert.match(stub, /sys\.modules\[_name\] = _module/);
});

// --- #398: сам гвард обязан ловить свой класс ----------------------------
// Проверка, которая не умеет краснеть, — это не проверка. Формы записи
// перечислены поимённо, потому что каждая из них уже встречалась в проекте
// или на расстоянии одной правки от встречавшейся.

const guardSees = (code) => sysModulesWrites(code).length > 0;
// Файл, который где-то называет пакет интеграции как модуль — именно то
// условие, при котором запись «неизвестно чем» становится опасной.
const PACKAGE_NAMED = 'PKG = "custom_components.houseplan"\n';

test('#398 AC1: запись через переменную не проходит мимо гварда', () => {
  assert.equal(guardSees(`${PACKAGE_NAMED}sys.modules[name] = module\n`), true,
    'ключ-переменная — ровно та форма, которую прежняя регулярка не видела');
});

test('#398 AC2: остальные формы записи тоже ловятся или отклоняются', () => {
  for (const line of [
    'sys.modules[f"custom_components.{name}"] = module',
    'sys.modules["custom_" + "components.houseplan"] = module',
    'sys.modules.setdefault("custom_components.houseplan", module)',
    'sys.modules.update({"custom_components.houseplan": module})',
    'sys.modules[  key  ] = module',
  ]) {
    assert.equal(guardSees(`${PACKAGE_NAMED}${line}\n`), true, `не поймана форма: ${line}`);
  }
});

test('#398 AC2: безопасное не объявляется нарушением', () => {
  for (const line of [
    'sys.modules["homeassistant.core"] = core',
    'sys.modules[f"hp_pure.{dep}"] = mod',
    'sys.modules["houseplan.trails"] = mod',
    '# sys.modules["custom_components.houseplan"] = stub  # так писать нельзя',
  ]) {
    assert.equal(guardSees(`${line}\n`), false, `ложное срабатывание на: ${line}`);
  }
  // Файл, который нигде не называет пакет интеграции, отравить его
  // переменной не может — восстановление снимка остаётся законным.
  assert.equal(guardSees('sys.modules.update(saved)\n'), false);
});

test('#398 AC3: список файлов с правом записи закрыт', () => {
  assert.deepEqual(SYS_MODULES_WRITERS, ['conftest.py', 'pure_imports.py'],
    'третий файл в списке — это новое исключение, а не правка: оно требует'
    + ' своего обоснования и отдельного решения, а не молчаливого добавления');
});

test('#398 AC8: pure_imports снимает регистрацию, а не обещает', () => {
  // Файл в списке исключений не потому, что ему доверяют, а потому, что
  // статический разбор не видит очистки. Значит очистку проверяет этот тест —
  // иначе исключение стало бы дырой ровно того размера, что #389.
  const source = read('pure_imports.py');
  assert.match(source, /before = frozenset\(sys\.modules\)/,
    'снимок берётся до загрузки');
  assert.match(source, /finally:[\s\S]*del sys\.modules\[key\]/,
    'разница снимается в finally — даже если exec_module бросил');
  assert.match(source, /key\.startswith\(PACKAGE_ROOT\.name\)/,
    'снимается вся разница под префиксом пакета, а не одно собственное имя:'
    + ' относительные импорты подтягивают соседей');
});
