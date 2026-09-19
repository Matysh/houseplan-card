import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Граница вынесенных диалогов (#592).
 *
 * Разметка четырёх диалогов настроек уехала из ядра редактора в отдельные
 * модули, и ценность этого шага держится ровно на одном: модуль **рисует**, а
 * состояние остаётся на хосте. Стоит одному черновику переехать в модуль — и
 * следующий шаг эпика #591 будет переписывать не разметку, а владение
 * состоянием, то есть окажется совсем другой задачей, чем заявлено.
 *
 * Тест смотрит на исходники, а не на поведение, потому что нарушение здесь
 * невидимо в рантайме: диалог продолжит работать и с собственным состоянием —
 * ровно до первого второго потребителя.
 */

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MODULES = [
  'src/editors/marker-dialog.ts',
  'src/editors/space-settings-dialog.ts',
  'src/editors/general-settings-dialog.ts',
  'src/editors/room-settings-dialog.ts',
];
const DRAFTS = ['_markerDialog', '_spaceDialog', '_settingsDialog', '_roomDialog'];

const source = (file) => readFileSync(resolve(ROOT, file), 'utf8');

test('#592 вынесенные диалоги не заводят собственного состояния', () => {
  for (const file of MODULES) {
    const text = source(file);
    assert.ok(!/@state\(/.test(text), `${file}: реактивное состояние в модуле разметки`);
    assert.ok(!/\bclass\s+[A-Za-z]/.test(text), `${file}: модуль разметки завёл класс`);
    for (const draft of DRAFTS) {
      const own = new RegExp(`(let|const|var)\\s+${draft}\\b|^\\s*${draft}\\s*[:=]`, 'm');
      assert.ok(!own.test(text), `${file}: черновик ${draft} объявлен в модуле, а не на хосте`);
    }
  }
});

test('#592 диалоги остаются в ленивом редакторском графе', () => {
  const runtime = source('src/houseplan-editor-runtime.ts');
  for (const file of MODULES) {
    const name = file.replace('src/', './').replace('.ts', '');
    assert.ok(runtime.includes(`from '${name}'`), `${file}: не импортирован редакторским рантаймом`);
  }
  const card = source('src/houseplan-card.ts');
  for (const file of MODULES) {
    const name = file.replace('src/', './').replace('.ts', '');
    assert.ok(!card.includes(name), `${file}: попал в синхронный граф карточки`);
  }
});
