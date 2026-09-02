import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  REVIEW_DOC_ALLOWLIST, citedMaterialShas, danglingMaterialRefusal, pathsOutsideAllowlist, reviewDocPushRefusal,
} from '../scripts/review-doc-guard.mjs';

// #365. 28.08 шаг публикации ревью-дока запушил в dev коммит bb2919f с тридцатью
// файлами вместо одного markdown: откатил отревьюженную реализацию #359, вернул
// старые чанки, оставил в dist/ двойной набор. dev держал откаченное дерево три
// часа. Сообщение коммита было невинным — «docs: review document for #359», — и
// от рутины инцидент отличался только диффом. Релиз собирается из dev.

test('чистая публикация проходит (#365 AC1)', () => {
  assert.equal(reviewDocPushRefusal(['docs/reviews/CODE-REVIEW-359-r1.md']), null);
  assert.equal(reviewDocPushRefusal([
    'docs/reviews/SPEC-REVIEW-1-r1.md', 'docs/reviews/SPEC-REVIEW-1-r2.md',
  ]), null);
});

test('посторонний путь отменяет пуш и называет файлы (#365 AC2)', () => {
  const refusal = reviewDocPushRefusal([
    'docs/reviews/CODE-REVIEW-359-r1.md',
    'src/houseplan-card.ts',
    'dist/houseplan-card.js',
  ]);
  assert.match(refusal, /задевает 2 путь\(ей\)/);
  assert.match(refusal, /dist\/houseplan-card\.js/);
  assert.match(refusal, /src\/houseplan-card\.ts/);
  // Причина названа, а не только факт: без неё следующий читатель решит, что
  // проверка придирается, и снимет её.
  assert.match(refusal, /bb2919f/);
});

test('пустой дифф — тоже отказ, а не тихий успех (#365)', () => {
  // Публиковать нечего означает, что что-то пошло не так раньше. Прежняя
  // редакция шага в таком случае выходила с нулём, и вердикт ревью оставался
  // без артефакта (#171).
  assert.match(reviewDocPushRefusal([]), /публиковать нечего/);
  assert.match(reviewDocPushRefusal(['', '   ']), /публиковать нечего/);
});

test('соседний каталог с похожим именем не считается разрешённым (#365)', () => {
  // Сравнение по префиксу каталога со слэшем: docs/reviews-old подстрокой не
  // притворяется.
  assert.deepEqual(
    pathsOutsideAllowlist(['docs/reviews-old/x.md', 'docs/reviews/y.md']),
    ['docs/reviews-old/x.md'],
  );
  assert.deepEqual(pathsOutsideAllowlist(['docs/reviewsx.md']), ['docs/reviewsx.md']);
});

test('allowlist задаётся снаружи и по умолчанию только docs/reviews (#365)', () => {
  assert.deepEqual(REVIEW_DOC_ALLOWLIST, ['docs/reviews/']);
  assert.equal(reviewDocPushRefusal(['docs/specs/1.md'], ['docs/specs']), null);
  assert.match(reviewDocPushRefusal(['docs/specs/1.md']), /docs\/specs\/1\.md/);
});

test('шаг публикации в конвейере проверяет и индекс, и то, что уедет (#365 AC4)', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/process.yml', import.meta.url), 'utf8',
  );
  const step = workflow.slice(
    workflow.indexOf('- name: Опубликовать документ ревью'),
    workflow.indexOf('- name: Решение по вердикту'),
  );
  assert.ok(step.length > 500, 'шаг публикации не найден');
  // Два рубежа: что проиндексировано и что пуш добавит в ветку. Расходились они
  // именно тогда, когда база оказывалась не той.
  assert.equal(
    (step.match(/git diff --cached --name-only \| node scripts\/review-doc-guard\.mjs/g) || []).length,
    1, 'индекс проверяется один раз, перед коммитом',
  );
  // Дважды: push делается из двух мест — сразу и после ребейза при гонке. Одна
  // проверка на два пути означала бы, что второй путь не проверен вовсе, а
  // именно он срабатывает, когда dev ушёл вперёд — то есть в тех самых
  // условиях, при которых случился bb2919f.
  assert.equal(
    (step.match(/git diff --name-only "origin\/\$target\.\.\.HEAD" \| node scripts\/review-doc-guard\.mjs/g) || []).length,
    2, 'диапазон проверяется перед каждым push',
  );
  // Свежая база вместо той, что лежала здесь сорок минут назад.
  assert.match(step, /git reset -q --hard "origin\/\$target"/);
  // Форс-пуш запрещён: ветка двигается только вперёд.
  assert.equal(/--force/.test(step), false, 'в публикации ревью-дока не должно быть force-push');
  // Индексируется один путь, а не каталог.
  assert.match(step, /git add -- "\$doc"/);
});

// --- материал раунда обязан быть достижим (#413) ----------------------------

test('SHA из шапки извлекаются, а из прозы — нет (#413)', () => {
  const doc = [
    '# SPEC-REVIEW-403-r2',
    '',
    '## Скоуп',
    '',
    '- Материал: спец-файл на `HEAD = 83005c3c` (ветка `issue/403-x`,',
    '  коммит «docs: revise area relocation safety spec»)',
    '- Ревизия: 2',
  ].join('\n') + '\n'.repeat(30) + 'Так коммит bb2919f7 откатил dev на три часа.\n';
  const cited = citedMaterialShas(doc);
  assert.deepEqual(cited.map((item) => item.sha), ['83005c3c']);
  assert.equal(cited[0].line, 5);
});

test('не-SHA в шапку не попадают: цвета, sha256, номера (#413)', () => {
  const doc = [
    '- Материал: коммит `cbf5cc1b`, цвет #607d8bff, прогон 20260901,',
    '  imageSha256 `9119ab87502038f787529f621c39e1e0d01f3bc3b0289051c3791a1886e97a6b`,',
    '  ссылка sha256-abc1234def',
  ].join('\n');
  assert.deepEqual(citedMaterialShas(doc).map((item) => item.sha), ['cbf5cc1b']);
});

test('недостижимый SHA останавливает раунд и объясняет, почему (#413)', () => {
  const doc = '- Материал: спец-файл на `HEAD = 83005c3c`\n';
  const refusal = danglingMaterialRefusal(doc, () => new Map([['83005c3c', null]]));
  assert.match(refusal, /83005c3c/);
  assert.match(refusal, /не достижим ни из одной ссылки origin/);
  // Отказ обязан называть и команду из канона, и способ не повторить:
  // на #403 ревьюер снял HEAD до ребейза и не сверился перед выводом.
  assert.match(refusal, /git diff/);
  assert.match(refusal, /git rev-parse HEAD/);
});

test('достижимый SHA раунд не задерживает (#413)', () => {
  const doc = '- Материал: коммит `cbf5cc1b`\n';
  const resolve = () => new Map([['cbf5cc1b', 'refs/remotes/origin/dev']]);
  assert.equal(danglingMaterialRefusal(doc, resolve), null);
});

test('шапка без объявления материала не судится (#413)', () => {
  // Часть документов материал не объявляет вовсе — по корпусу таких 146 из 555.
  // Требовать объявление — отдельное решение о каноне, а не дело гейта.
  assert.equal(danglingMaterialRefusal('# CODE-REVIEW-1-r1\n\nтекст\n', () => new Map()), null);
  assert.deepEqual(citedMaterialShas('# CODE-REVIEW-1-r1\n\nтекст\n'), []);
});
