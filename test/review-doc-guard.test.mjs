import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ANCHOR_MARKER, REVIEW_DOC_ALLOWLIST, anchorLiveness, REVIEW_HEADER_LINES, citedMaterialShas, danglingMaterialRefusal, materialAnchorBlock, materialAnchorsFrom, parseSpecList, pathsOutsideAllowlist, reviewDocPushRefusal, withMaterialAnchors,
  attemptFromRounds, blockingFromDocs, isBlockingVerdict, reviewCounters, reviewRoundsFromFiles, verdictDeclaration,
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

// --- якоря, переживающие ребейз (#414) -------------------------------------

test('блок якорей содержит исполнимые команды, а не описание (#414)', () => {
  const block = materialAnchorBlock({
    sha: '94502d3d67cacf85bdb9f69cd511b342989891fd',
    tree: '3fc651fcb868eefa28755d01ec2b9377598dcb27',
    branch: 'issue/403-area-relocation-safety',
    specs: [{
      blob: '56a92e12dedc8fa541537ae5908dc6f1dfab43e8',
      path: 'docs/specs/403-area-relocation-safety.md',
    }],
  });
  // Отчёт обязан быть исполняемым: на #403 канонная команда не работала, и
  // следующий раунд восстанавливал коммит по содержимому диффа руками.
  assert.match(block, /git log --all --find-object=56a92e12dedc8fa541537ae5908dc6f1dfab43e8/);
  assert.match(block, /git log --all --format='%H %T' \| grep 3fc651fcb868/);
  assert.match(block, /ребейз его осиротит/, 'блок обязан объяснять, зачем он нужен');
  assert.match(block, /material-anchors: сгенерировано конвейером/);
});

test('без ветки задачи блок честно говорит, что якорей нет (#414)', () => {
  const block = materialAnchorBlock({ branch: '', sha: '', tree: '', specs: [] });
  assert.match(block, /Якоря снять не удалось/);
});

test('повторная приписка заменяет блок, а не копит его (#414)', () => {
  const anchors = { sha: 'a'.repeat(40), tree: 'b'.repeat(40), branch: 'dev', specs: [] };
  const once = withMaterialAnchors('# отчёт\n\nтекст\n', anchors);
  const twice = withMaterialAnchors(once, anchors);
  assert.equal(twice.split(ANCHOR_MARKER).length - 1, 1, 'маркер обязан быть один');
  assert.match(twice, /# отчёт/);
});

test('список ТЗ разбирается и отсекает мусор (#414)', () => {
  const parsed = parseSpecList(
    `${'a'.repeat(40)} docs/specs/403-x.md;короткий docs/specs/y.md;${'b'.repeat(40)} ;`,
  );
  assert.deepEqual(parsed, [{ blob: 'a'.repeat(40), path: 'docs/specs/403-x.md' }]);
});

test('осиротевший SHA при живых якорях — предупреждение, не отказ (#414)', () => {
  const doc = withMaterialAnchors(
    '- Материал: спец-файл на `HEAD = 83005c3c`\n',
    { sha: 'c'.repeat(40), tree: 'd'.repeat(40), branch: 'issue/403-x', specs: [] },
  );
  const verdict = danglingMaterialRefusal(
    doc, () => new Map([['83005c3c', null]]), REVIEW_HEADER_LINES, () => true,
  );
  assert.ok(verdict.warning, 'раунд воспроизводим — ронять его нечего');
  assert.match(verdict.warning, /83005c3c/);
  assert.match(verdict.warning, /по якорям/);
});

test('осиротевший SHA и мёртвые якоря — по-прежнему отказ (#414)', () => {
  const doc = withMaterialAnchors(
    '- Материал: спец-файл на `HEAD = 83005c3c`\n',
    { sha: 'c'.repeat(40), tree: 'd'.repeat(40), branch: 'issue/403-x', specs: [] },
  );
  const verdict = danglingMaterialRefusal(
    doc, () => new Map([['83005c3c', null]]), REVIEW_HEADER_LINES, () => false,
  );
  assert.equal(typeof verdict, 'string');
  assert.match(verdict, /не достижим ни из одной ссылки origin/);
});

// --- #422: живость якоря — достижимость, а не наличие объекта -------------

/** Подставная проба git: описывает мир, а не запускает его. */
const gitProbe = ({ type, reachableTrees = [], blobFound = false, refFound = false }) => (args) => {
  if (args[0] === 'cat-file') return { status: type ? 0 : 1, stdout: type || '' };
  if (args[0] === 'log' && args.includes('--format=%T')) {
    return { status: 0, stdout: `${reachableTrees.join('\n')}\n` };
  }
  if (args[0] === 'log') return { status: 0, stdout: blobFound ? 'c0ffee\n' : '' };
  if (args[0] === 'for-each-ref') return { status: 0, stdout: refFound ? 'refs/remotes/origin/dev\n' : '' };
  return { status: 1, stdout: '' };
};

test('якорь-дерево, существующий локально, но недостижимый, живым не считается', () => {
  const object = 'a'.repeat(40);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'tree', reachableTrees: ['b'.repeat(40)] })), false);
});

test('якорь-дерево, достижимый из origin, считается живым', () => {
  const object = 'a'.repeat(40);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'tree', reachableTrees: [object] })), true);
});

test('якорь-блоб проверяется поиском по достижимым коммитам', () => {
  const object = 'c'.repeat(40);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'blob', blobFound: false })), false);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'blob', blobFound: true })), true);
});

test('якорь-коммит проверяется тем же способом, что и SHA раунда', () => {
  const object = 'd'.repeat(40);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'commit', refFound: false })), false);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'commit', refFound: true })), true);
});

test('неизвестный тип объекта и отсутствующий объект живыми не считаются', () => {
  const object = 'e'.repeat(40);
  assert.equal(anchorLiveness(object, gitProbe({ type: 'tag' })), false);
  assert.equal(anchorLiveness(object, gitProbe({ type: '' })), false);
});

test('областью поиска служат origin и теги, а не --all', () => {
  const seen = [];
  const probe = (args) => {
    seen.push(args.join(' '));
    return args[0] === 'cat-file' ? { status: 0, stdout: 'blob' } : { status: 0, stdout: '' };
  };
  anchorLiveness('f'.repeat(40), probe);
  const search = seen.find((line) => line.startsWith('log'));
  assert.ok(search.includes('--remotes=origin'), search);
  assert.ok(search.includes('--tags'), search);
  assert.ok(!search.includes('--all'), 'локальные ветки автора не считаются доказательством');
});

test('недостижимый якорь не смягчает отказ на осиротевшем SHA раунда (#422)', () => {
  const anchor = 'd'.repeat(40);
  const document = withMaterialAnchors(
    '- Материал: спец-файл на `HEAD = 83005c3c`\n',
    { sha: 'c'.repeat(40), tree: anchor, branch: 'issue/422-x', specs: [] },
  );
  const orphaned = () => new Map([['83005c3c', null]]);
  const dead = (object) => anchorLiveness(object, gitProbe({ type: 'tree', reachableTrees: [] }));
  const alive = (object) => anchorLiveness(object, gitProbe({ type: 'tree', reachableTrees: [anchor] }));

  const refusal = danglingMaterialRefusal(document, orphaned, REVIEW_HEADER_LINES, dead);
  assert.equal(typeof refusal, 'string', 'мёртвый якорь обязан оставить жёсткий отказ');
  assert.match(refusal, /не достижим ни из одной ссылки origin/);

  const softened = danglingMaterialRefusal(document, orphaned, REVIEW_HEADER_LINES, alive);
  assert.ok(softened && softened.warning, 'живой якорь по-прежнему смягчает отказ (#414)');
});

// #454. Счёт раундов по опубликованным артефактам вместо прозы вердикта.
//
// Дефект стоил артефакта: на #449 первый спек-вердикт не назвал имени файла,
// заход r2 получил номер r1, и документ второго раунда лёг поверх документа
// первого. Жёлтый вердикт первого раунда утрачен безвозвратно — этого не
// восстановит ни один источник, и фикстуры ниже это честно фиксируют.

const D = (name, verdict) => ({ name, text: `# ${name}\n\n## Вердикт\n\n${verdict}\n` });

test('заход берётся от максимума номеров, а не от количества (#454 AC1)', () => {
  assert.deepEqual(
    reviewRoundsFromFiles(['SPEC-REVIEW-449-r1.md', 'SPEC-REVIEW-449-r2.md'], 'SPEC-REVIEW', '449').rounds,
    [1, 2],
  );
  assert.equal(attemptFromRounds([1, 2]), 3);
  // Дыра в нумерации оставлена прошлой коллизией: счёт по количеству выдал бы
  // r3 — занятое имя, и следующий документ затёр бы существующий (AC3).
  assert.equal(attemptFromRounds([1, 3]), 4);
  assert.equal(attemptFromRounds([]), 1);
});

test('чужой этап и чужая задача в счёт не идут (#454 AC5, #89)', () => {
  const names = [
    'SPEC-REVIEW-449-r1.md', 'SPEC-REVIEW-449-r2.md',
    'CODE-REVIEW-449-r1.md', 'CODE-REVIEW-449-r2.md',
    'SPEC-REVIEW-44-r9.md', 'SPEC-REVIEW-4490-r7.md',
  ];
  assert.deepEqual(reviewRoundsFromFiles(names, 'SPEC-REVIEW', '449').rounds, [1, 2]);
  assert.deepEqual(reviewRoundsFromFiles(names, 'CODE-REVIEW', '449').rounds, [1, 2]);
});

test('нечисловой суффикс не проглатывается молча (#454)', () => {
  const { rounds, skipped } = reviewRoundsFromFiles(
    ['SPEC-REVIEW-449-r1.md', 'SPEC-REVIEW-449-rX.md'], 'SPEC-REVIEW', '449',
  );
  assert.deepEqual(rounds, [1]);
  assert.deepEqual(skipped, ['SPEC-REVIEW-449-rX.md']);
});

test('строка вердикта опознаётся, а упоминание — нет (#454 AC2)', () => {
  assert.ok(isBlockingVerdict(verdictDeclaration('Вердикт: жёлтый · заход r1')));
  assert.ok(isBlockingVerdict(verdictDeclaration('**Вердикт: красный** · заход r2')));
  assert.ok(isBlockingVerdict(verdictDeclaration('- **Вердикт:** жёлтый')));
  assert.equal(isBlockingVerdict(verdictDeclaration('Вердикт: зелёный · заход r3')), false);
  // Цитата чужого вердикта внутри прозы — CODE-REVIEW-230-r2.md цитирует
  // жёлтый вердикт ПРОШЛОГО раунда. Свободный поиск засчитал бы лишний цикл.
  assert.equal(
    verdictDeclaration('Комментарий с вердиктом r1 («Вердикт: жёлтый · заход r1») учтён.'),
    null,
  );
  // Блок под заголовком раздела — объявление (CODE-REVIEW-292-r1.md).
  assert.ok(isBlockingVerdict(verdictDeclaration(
    '## Вердикт\n\n```\nВердикт: красный · заход r1\n```\n',
  )));
  // Тот же блок вне раздела — цитата, а не объявление.
  assert.equal(verdictDeclaration('## Скоуп\n\n```\nВердикт: красный\n```\n'), null);
});

test('документ без строки вердикта виден как непрочитанный, а не как зелёный (#454)', () => {
  const { blocking, unread } = blockingFromDocs([
    { name: 'SPEC-REVIEW-449-r1.md', text: 'Без High это жёлтый вердикт: ТЗ возвращается автору.' },
    D('SPEC-REVIEW-449-r2.md', 'Вердикт: зелёный · заход r3'),
  ]);
  assert.deepEqual(blocking, []);
  assert.deepEqual(unread, ['SPEC-REVIEW-449-r1.md']);
});

test('#449 как есть: заход 3, циклов 1 (#454 AC2)', () => {
  // Буквальный слепок сегодняшнего состояния: файла два (в r1 лежит тело
  // ВТОРОГО раунда), комментариев три, но маркер несут только два — первый
  // вердикт не назвал файла, и это тот самый дефект.
  const rounds = reviewRoundsFromFiles(
    ['SPEC-REVIEW-449-r1.md', 'SPEC-REVIEW-449-r2.md'], 'SPEC-REVIEW', '449',
  ).rounds;
  const docs = [
    { name: 'SPEC-REVIEW-449-r1.md', text: '# SPEC-REVIEW — issue #449 · заход r2\n\n## Вердикт\n\nБез High это жёлтый вердикт (PROCESS.md §2.4).\n' },
    { name: 'SPEC-REVIEW-449-r2.md', text: '# SPEC-REVIEW — issue #449 · заход r3\n\n## Вердикт\n\nHigh: 0 · Medium: 0 — зелёное.\n' },
  ];
  const counters = reviewCounters({ rounds, docs, comments: { attempt: 3, spent: 1 } });
  assert.equal(counters.attempt, 3);
  assert.equal(counters.spent, 1);
  // Жёлтый вердикт ПЕРВОГО раунда невосстановим: его файл перезаписан, его
  // комментарий маркера не содержит. Ни один источник его не воскрешает.
  assert.equal(counters.spentFiles, 0);
  assert.equal(counters.spentComments, 1);
});

test('#449, прожитая уже с исправлением: заход 4, циклов 2 (#454 AC2b)', () => {
  const names = ['SPEC-REVIEW-449-r1.md', 'SPEC-REVIEW-449-r2.md', 'SPEC-REVIEW-449-r3.md'];
  const { rounds } = reviewRoundsFromFiles(names, 'SPEC-REVIEW', '449');
  const docs = [
    D('SPEC-REVIEW-449-r1.md', 'Вердикт: жёлтый · заход r1'),
    D('SPEC-REVIEW-449-r2.md', 'Вердикт: жёлтый · заход r2'),
    D('SPEC-REVIEW-449-r3.md', 'Вердикт: зелёный · заход r3'),
  ];
  // Комментарии те же, что в реальности: первый вердикт маркера не несёт.
  const counters = reviewCounters({ rounds, docs, comments: { attempt: 3, spent: 1 } });
  assert.equal(counters.attempt, 4);
  assert.equal(counters.spent, 2);
});

test('зелёный вердикт цикла не тратит (#454 AC4, #227)', () => {
  const docs = [
    D('SPEC-REVIEW-1-r1.md', 'Вердикт: жёлтый · заход r1'),
    D('SPEC-REVIEW-1-r2.md', 'Вердикт: зелёный · заход r2'),
    D('SPEC-REVIEW-1-r3.md', 'Вердикт: зелёный · заход r3'),
  ];
  const counters = reviewCounters({ rounds: [1, 2, 3], docs, comments: { attempt: 4, spent: 1 } });
  assert.equal(counters.attempt, 4);
  assert.equal(counters.spent, 1);
});

test('отказ публикации не занижает счёт: работает максимум (#454 AC6)', () => {
  // Вердикт опубликован комментарием, документ не лёг. Файлов меньше, чем
  // раундов, — и именно поэтому берётся максимум, а не счёт по файлам.
  const counters = reviewCounters({
    rounds: [1],
    docs: [D('SPEC-REVIEW-1-r1.md', 'Вердикт: жёлтый · заход r1')],
    comments: { attempt: 3, spent: 2 },
  });
  assert.equal(counters.attempt, 3);
  assert.equal(counters.spent, 2);
});

test('ветки нет: счёт по файлам ноль, поведение прежнее (#454 AC7)', () => {
  const counters = reviewCounters({ rounds: [], docs: [], comments: { attempt: 2, spent: 1 } });
  assert.equal(counters.attempt, 2);
  assert.equal(counters.spent, 1);
  // И наоборот: недоступны комментарии — счёт живёт на файлах.
  const onlyFiles = reviewCounters({
    rounds: [1, 2],
    docs: [
      D('SPEC-REVIEW-1-r1.md', 'Вердикт: жёлтый · заход r1'),
      D('SPEC-REVIEW-1-r2.md', 'Вердикт: красный · заход r2'),
    ],
    comments: {},
  });
  assert.equal(onlyFiles.attempt, 3);
  assert.equal(onlyFiles.spent, 2);
});

test('мусор на входе не роняет счёт (#454 AC7)', () => {
  assert.deepEqual(reviewRoundsFromFiles(null, 'SPEC-REVIEW', '449').rounds, []);
  assert.deepEqual(reviewRoundsFromFiles(['x'], '', '449').rounds, []);
  assert.deepEqual(reviewRoundsFromFiles(['x'], 'SPEC-REVIEW', '').rounds, []);
  assert.deepEqual(reviewRoundsFromFiles(['SPEC-REVIEW-449-r1.md'], 'SPEC-REVIEW', '4.9').rounds, []);
  const counters = reviewCounters();
  assert.equal(counters.attempt, 1);
  assert.equal(counters.spent, 0);
});

test('момент коллизии на #449: файлы дали бы свободное имя, проза — занятое (#454)', () => {
  // Состояние 14:56, когда заход r2 только начинался. Комментарий первого
  // вердикта маркера не нёс, поэтому прежний счёт видел ноль вердиктов этапа и
  // выдавал заход r1 — имя, которое уже занято. Документ первого раунда был
  // перезаписан ровно здесь.
  const beforeFix = { attempt: 1, spent: 0 };
  const counters = reviewCounters({
    rounds: reviewRoundsFromFiles(['SPEC-REVIEW-449-r1.md'], 'SPEC-REVIEW', '449').rounds,
    docs: [D('SPEC-REVIEW-449-r1.md', 'Вердикт: жёлтый · заход r1')],
    comments: beforeFix,
  });
  assert.equal(counters.attemptComments, 1, 'проза видела ноль вердиктов — это и был дефект');
  assert.equal(counters.attempt, 2, 'файл раунда r1 существует, значит следующий заход r2');
  assert.equal(counters.spent, 1, 'жёлтый вердикт цикла израсходован, хотя проза его не назвала');
});

test('guard считает раунды скриптом, а не inline-shell (#454 AC9)', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/process.yml', import.meta.url), 'utf8',
  );
  const step = workflow.slice(
    workflow.indexOf('      - id: decide'),
    workflow.indexOf('  review:'),
  );
  assert.ok(step.length > 500, 'шаг decide не найден');
  // Решение принимает модуль под тестами. Пока счёт жил строкой jq внутри
  // workflow, у него не было ни одного теста — и дефект #454 прожил месяцы.
  assert.match(step, /node scripts\/review-doc-guard\.mjs --counters/);
  // Оба счётчика читаются из вывода скрипта, а не досчитываются в shell.
  assert.match(step, /attempt=\$\(printf '%s\\n' "\$counters"/);
  assert.match(step, /spent=\$\(printf '%s\\n' "\$counters"/);
  // Скрипт лежит в репозитории, значит guard обязан его выкачать.
  assert.match(workflow.slice(0, workflow.indexOf('      - id: decide')), /actions\/checkout/);
});

test('описание чужого раунда не объявляет вердикт (#454, находка на корпусе)', () => {
  // CODE-REVIEW-441-r1.md: документ зелёного второго раунда описывает жёлтый
  // ПЕРВЫЙ раунд строкой-буллитом. Правило, допускавшее слово между «Вердикт»
  // и двоеточием, добавляло зелёному раунду блокирующий цикл.
  assert.equal(
    verdictDeclaration('- Вердикт r1: жёлтый, High 0, Medium 1 в скоупе — красный `check-docs.mjs`'),
    null,
  );
  assert.equal(verdictDeclaration('- Вердикт предыдущего раунда: красный'), null);
  // Штатные формы объявления при этом обязаны читаться по-прежнему.
  assert.ok(verdictDeclaration('Вердикт: жёлтый · заход r1'));
  assert.ok(verdictDeclaration('**Вердикт: красный** · заход r2'));
  assert.ok(verdictDeclaration('- **Вердикт:** жёлтый'));
  assert.ok(verdictDeclaration('- Вердикт: зелёный'));
});
