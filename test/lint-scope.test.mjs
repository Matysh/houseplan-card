import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// #399: конфиг обещал линт по трём деревьям, CI проверял одно. Расхождение
// само по себе не ломает сборку — оно ломает доверие к зелёному значку, а
// следом и к выводу «раз зелено, значит проверено». Ровно так в tests_backend
// проехали F401/F811, которых на v1.69.0 не было.

const root = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const read = (name) => readFileSync(root(name), 'utf8');

/** Деревья из `[tool.ruff] include`, приведённые к каталогу. */
const declaredTrees = () => {
  const pyproject = read('pyproject.toml');
  const section = pyproject.slice(pyproject.indexOf('[tool.ruff]'));
  const include = /include\s*=\s*\[([^\]]*)\]/.exec(section);
  assert.ok(include, '[tool.ruff] include обязан существовать');
  return [...include[1].matchAll(/"([^"]+)"/g)]
    .map((match) => match[1].replace(/\/\*\*\/\*\.py$|\/\*\.py$/, ''))
    .sort();
};

/** Деревья, которые реально проверяет шаг линта в CI. */
const lintedTrees = () => {
  const workflow = read('.github/workflows/validate.yml');
  const step = /python -m ruff check ([^\n]*)/.exec(workflow);
  assert.ok(step, 'шаг «Линт бэкенда» обязан существовать в validate.yml');
  return step[1].trim().split(/\s+/).filter(Boolean).sort();
};

test('#399 AC2: объявленный скоуп линта равен проверяемому', () => {
  assert.deepEqual(declaredTrees(), lintedTrees(),
    'include в pyproject.toml и аргументы ruff в validate.yml разошлись:'
    + ' конфиг обещает одно, CI проверяет другое. Расширять список можно'
    + ' только вместе — иначе объявленное покрытие снова станет фикцией.');
});

test('#399 AC2: расхождение действительно ловится', () => {
  // Проверка, которая не умеет краснеть, ничего не гарантирует.
  const declared = ['custom_components/houseplan', 'tests_backend'];
  const linted = ['custom_components/houseplan'];
  assert.throws(() => assert.deepEqual(declared, linted));
});
