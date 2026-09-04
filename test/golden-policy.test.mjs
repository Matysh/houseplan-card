import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertGoldenInvocation,
  GOLDEN_BASELINE_MANIFEST,
  goldenRunFailed,
  goldenScenarioSetsMatch,
} from '../demo/golden/policy.mjs';
import {
  goldenAcceptancePlan, goldenAcceptanceRefusal, goldenSilentDeclarations,
} from '../scripts/golden-acceptance.mjs';

test('golden metadata cannot be mistaken for a Home Assistant integration manifest', () => {
  assert.equal(GOLDEN_BASELINE_MANIFEST, 'baselines-index.json');
  // The old check compared against 'manifest.json' and passed while the file
  // was called 'baseline-manifest.json' — which is exactly what the HACS glob
  // `*manifest.json` matches, and what turned Hassfest red on PR #9004
  // (2026-08-11). Ending with the word is enough to break the submission.
  assert.equal(GOLDEN_BASELINE_MANIFEST.endsWith('manifest.json'), false);
});

test('golden capture fails on runtime errors but permits missing baselines', () => {
  assert.equal(goldenRunFailed('capture', false, [{ status: 'error' }]), true);
  assert.equal(goldenRunFailed('capture', false, [{ status: 'missing-baseline' }]), false);
  assert.equal(goldenRunFailed('verify', true, [{ status: 'different' }]), true);
  assert.equal(goldenRunFailed('verify', true, [{ status: 'passed' }]), false);
});

test('golden verification cannot make a partial success claim', () => {
  // #455: платформа передаётся явно — иначе юнит был бы зелёным на Linux и
  // красным на машине владельца, то есть тестом про хост, а не про правило.
  assert.doesNotThrow(() => assertGoldenInvocation('capture', 'one-scenario', { platform: 'linux' }));
  assert.doesNotThrow(() => assertGoldenInvocation('verify', ''));
  assert.throws(() => assertGoldenInvocation('verify', 'one-scenario'), /complete matrix/);
  assert.throws(() => assertGoldenInvocation('unknown', ''), /unknown golden mode/);
});

test('golden baseline inventory rejects orphan hashes and PNGs', () => {
  assert.equal(goldenScenarioSetsMatch(['a', 'b'], ['b', 'a'], ['a', 'b']), true);
  assert.equal(goldenScenarioSetsMatch(['a'], ['a', 'orphan'], ['a']), false);
  assert.equal(goldenScenarioSetsMatch(['a'], ['a'], ['a', 'orphan']), false);
  assert.equal(goldenScenarioSetsMatch(['a', 'b'], ['a'], ['a', 'b']), false);
});

// #334. Локальная съёмка допустима не по доверию, а по доказательству: среда
// равна раннеру, если всё, что менять не собирались, совпало с эталонами.
const results = (entries) => entries.map(([id, status]) => ({ id, status }));

test('приёмка отвергает расхождение в сцене, которую менять не собирались (#334)', () => {
  const refusal = goldenAcceptanceRefusal(
    results([['a', 'different'], ['b', 'different'], ['c', 'passed']]), ['a'],
  );
  assert.match(refusal, /^съёмка разошлась/);
  assert.match(refusal, / b\./);
  // Объявленная сцена в перечислении не появляется — иначе сообщение
  // указывало бы на автора вместо среды.
  assert.equal(/ a[,.]/.test(refusal), false);
});

test('приёмка проходит, когда разошлись ровно объявленные сцены (#334)', () => {
  assert.equal(goldenAcceptanceRefusal(
    results([['a', 'different'], ['b', 'passed'], ['c', 'missing-baseline']]), ['a'], ['c'],
  ), null);
});

test('новая сцена требует своего объявления, иначе станет контрактом молча (#350)', () => {
  // Прежнее правило (#334) пропускало её без вопросов: эталона, которому
  // противоречить, у неё нет. Половина обоснования верна — параллельность среды
  // новая сцена доказать не может. Но правило молчало про второй вопрос: пустой
  // или обрезанный кадр закрепляется так же надёжно, как испорченный старый.
  // Так три эталона каталога устройств уехали в контракт без единого взгляда.
  const refusal = goldenAcceptanceRefusal(results([['new', 'missing-baseline']]), []);
  assert.match(refusal, /эталона ещё нет, и они станут контрактом: new/);
  assert.match(refusal, /--expect-new/);
  assert.equal(goldenAcceptanceRefusal(results([['new', 'missing-baseline']]), [], ['new']), null);
});

test('флаги не взаимозаменяемы: имя в чужом останавливает приёмку (#350)', () => {
  // Путаница означает, что ревьюер думал об одной сцене, а утверждал про другую.
  assert.match(
    goldenAcceptanceRefusal(results([['new', 'missing-baseline']]), ['new'], []),
    /эталона ещё нет, их место в --expect-new: new/,
  );
  assert.match(
    goldenAcceptanceRefusal(results([['old', 'different']]), [], ['old']),
    /эталон уже есть, их место в --expect-change: old/,
  );
});

test('новая сцена не отменяет разбора изменившихся, и наоборот (#350)', () => {
  const list = results([['old', 'different'], ['new', 'missing-baseline'], ['same', 'passed']]);
  assert.match(goldenAcceptanceRefusal(list, [], ['new']), /^съёмка разошлась/);
  assert.match(goldenAcceptanceRefusal(list, ['old'], []), /станут контрактом/);
  assert.equal(goldenAcceptanceRefusal(list, ['old'], ['new']), null);
});

test('приёмка без объявлений запрещает «принять всё, чтобы CI позеленел» (#334)', () => {
  // Ровно то, чем эталон перестаёт быть эталоном: одна команда, три подмены,
  // ни одного названного намерения.
  const refusal = goldenAcceptanceRefusal(
    results([['a', 'different'], ['b', 'different'], ['c', 'different']]), [],
  );
  assert.match(refusal, /a, b, c/);
});

test('приёмка отвергает объявление сцены, которой нет в отчёте (#334)', () => {
  const refusal = goldenAcceptanceRefusal(results([['a', 'passed']]), ['a', 'опечатка']);
  assert.match(refusal, /которых нет в отчёте: опечатка/);
  assert.match(
    goldenAcceptanceRefusal(results([['a', 'passed']]), [], ['опечатка']),
    /которых нет в отчёте: опечатка/,
  );
});

test('приёмка отвергает отчёт без результатов сцен (#334)', () => {
  assert.match(goldenAcceptanceRefusal(null, []), /не содержит результатов/);
});

test('объявленная, но совпавшая сцена называется, а не проглатывается (#334)', () => {
  const list = results([['a', 'passed'], ['b', 'different']]);
  assert.deepEqual(goldenSilentDeclarations(list, ['a', 'b']), ['a']);
  assert.deepEqual(goldenSilentDeclarations(list, ['b']), []);
});

// #351. `passed` означает «в пределах порога», а не «байт в байт». Прежняя
// приёмка копировала кандидата поверх каждого эталона, поэтому подпороговый
// дрейф уезжал в контракт молча и накапливался. Так 1e341c60 заменил 22
// картинки, объявив четыре.

test('необъявленная сцена сохраняет свой эталон и свой хеш (#351)', () => {
  const plan = goldenAcceptancePlan({
    scenarioIds: ['declared', 'drifted', 'fresh'],
    results: [
      { id: 'declared', status: 'different', actualSha256: 'new-declared' },
      // Байты кандидата другие, но расхождение подпороговое — и именно поэтому
      // сцена не имеет права попасть в эталоны без объявления.
      { id: 'drifted', status: 'passed', actualSha256: 'new-drifted' },
      { id: 'fresh', status: 'missing-baseline', actualSha256: 'new-fresh' },
    ],
    previousHashes: { declared: 'old-declared', drifted: 'old-drifted' },
    declared: ['declared'],
    declaredNew: ['fresh'],
  });
  assert.deepEqual(plan.replace.sort(), ['declared', 'fresh']);
  assert.deepEqual(plan.keep, ['drifted']);
  assert.deepEqual(plan.hashes, {
    declared: 'new-declared',
    drifted: 'old-drifted',
    fresh: 'new-fresh',
  });
});

test('индекс перезаписывается на полный набор сцен, а не на заменённые (#351)', () => {
  // Полнота манифеста — инвариант goldenScenarioSetsMatch: сирота в индексе или
  // пропавшая запись делают весь манифест недействительным.
  const plan = goldenAcceptancePlan({
    scenarioIds: ['a', 'b', 'c'],
    results: [{ id: 'a', status: 'different', actualSha256: 'na' }],
    previousHashes: { a: 'oa', b: 'ob', c: 'oc' },
    declared: ['a'],
  });
  assert.deepEqual(Object.keys(plan.hashes).sort(), ['a', 'b', 'c']);
});

test('необъявленная сцена без прежнего эталона — ошибка, а не тихий кандидат (#351)', () => {
  assert.throws(() => goldenAcceptancePlan({
    scenarioIds: ['orphan'],
    results: [{ id: 'orphan', status: 'missing-baseline', actualSha256: 'x' }],
    previousHashes: {},
  }), /без прежнего эталона: orphan/);
});

test('объявленная сцена без хеша кандидата — ошибка (#351)', () => {
  assert.throws(() => goldenAcceptancePlan({
    scenarioIds: ['a'],
    results: [{ id: 'a', status: 'different' }],
    previousHashes: { a: 'oa' },
    declared: ['a'],
  }), /без хеша кандидата: a/);
});

// #355. Floor свидетелей: перечислив всю матрицу в --expect-change, принять
// чужую съёмку больше нельзя — среду доказывают только необъявленные сцены,
// совпавшие с эталоном байт-в-байт.
test('приёмка без свидетелей отказывает и называет дефицит (#355)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  const all = Array.from({ length: 20 }, (_, index) => ({
    id: `scene-${index}`, status: 'different', actualSha256: `new-${index}`,
  }));
  const { refusal, floor } = goldenWitnessRefusal({
    results: all,
    sceneCount: all.length,
    declared: all.map((result) => result.id),
    previousHashes: Object.fromEntries(all.map((result) => [result.id, `old-${result.id}`])),
  });
  assert.equal(floor, 2, '10% от 20 эталонных сцен');
  assert.match(refusal, /0 из необходимых 2/);
  assert.match(refusal, /--no-witnesses/);
});

test('обычная приёмка с достаточным числом свидетелей проходит (#355)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  const scenes = [
    { id: 'edited', status: 'different', actualSha256: 'changed' },
    ...Array.from({ length: 30 }, (_, index) => ({
      id: `same-${index}`, status: 'passed', actualSha256: `sha-${index}`,
    })),
  ];
  const previousHashes = Object.fromEntries(
    scenes.filter((scene) => scene.id !== 'edited')
      .map((scene) => [scene.id, scene.actualSha256]),
  );
  const { refusal, witnesses, floor } = goldenWitnessRefusal({
    results: scenes, sceneCount: scenes.length, declared: ['edited'], previousHashes,
  });
  assert.equal(refusal, null);
  assert.equal(floor, 4, '10% от 31 эталонной сцены');
  assert.equal(witnesses.length, 30);
});

test('passed в пределах порога — не свидетель: среду доказывает байт-в-байт (#355)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  const scenes = Array.from({ length: 10 }, (_, index) => ({
    id: `drifted-${index}`, status: 'passed', actualSha256: `candidate-${index}`,
  }));
  const previousHashes = Object.fromEntries(
    scenes.map((scene) => [scene.id, `baseline-${scene.id}`]),
  );
  const { refusal, witnesses } = goldenWitnessRefusal({
    results: scenes, sceneCount: scenes.length, declared: [], previousHashes,
  });
  assert.equal(witnesses.length, 0, 'подпороговый дрейф не доказывает среду');
  assert.match(refusal, /0 из необходимых 1/);
});

test('--no-witnesses требует причину и с ней пропускает floor (#355)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  const bare = goldenWitnessRefusal({ results: [], skipWitnesses: true });
  assert.match(bare.refusal, /--reason/);
  const reasoned = goldenWitnessRefusal({
    results: [], skipWitnesses: true, skipReason: 'полная перерисовка матрицы v49',
  });
  assert.equal(reasoned.refusal, null);
});

test('первичная съёмка требует названной причины, а не молчания (#408)', async () => {
  const { goldenWitnessRefusal, goldenWitnessFloor } = await import('../scripts/golden-acceptance.mjs');
  // До #408 здесь стоял отказ от требования: матрица без эталонов свидетелей
  // иметь не может, значит и floor ноль. Верно по факту, неверно по выводу —
  // именно этим ноль и обходился: `git rm baselines/*.png` превращал любую
  // приёмку в первичную съёмку.
  assert.equal(goldenWitnessFloor(0), 0, 'пустая матрица — единственный законный ноль');
  const results = [{ id: 'first', status: 'missing-baseline', actualSha256: 'x' }];
  const silent = goldenWitnessRefusal({ results, sceneCount: 1, declaredNew: ['first'] });
  assert.match(silent.refusal, /свидетелей среды недостаточно/,
    'невозможность доказать среду не отменяет требования, а требует сказать это вслух');
  const named = goldenWitnessRefusal({
    results, sceneCount: 1, declaredNew: ['first'],
    skipWitnesses: true, skipReason: 'первичная съёмка матрицы',
  });
  assert.equal(named.refusal, null);
});

test('удаление всех эталонов не снижает порог (#408)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  // Воспроизведение обхода из #408 целиком: удалить эталоны, объявить все сцены
  // новыми, принять чужую съёмку без единого следа причины.
  const wiped = Array.from({ length: 143 }, (_, index) => ({
    id: `scene-${index}`, status: 'missing-baseline', actualSha256: `foreign-${index}`,
  }));
  const { refusal, floor, witnesses } = goldenWitnessRefusal({
    results: wiped,
    sceneCount: wiped.length,
    declaredNew: wiped.map((result) => result.id),
  });
  assert.equal(floor, 10, 'порог считается от матрицы, а не от нуля уцелевших');
  assert.equal(witnesses.length, 0);
  assert.match(refusal, /0 из необходимых 10/);
  assert.match(refusal, /сцен в матрице 143, с эталонами 0/);
});

test('порог держится и при частичной потере эталонов (#408)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  // Три уцелевших эталона дают три свидетеля — но планку задаёт матрица.
  const kept = Array.from({ length: 3 }, (_, index) => ({
    id: `kept-${index}`, status: 'passed', actualSha256: `same-${index}`,
  }));
  const lost = Array.from({ length: 140 }, (_, index) => ({
    id: `lost-${index}`, status: 'missing-baseline', actualSha256: `new-${index}`,
  }));
  const { refusal, floor, witnesses } = goldenWitnessRefusal({
    results: [...kept, ...lost],
    sceneCount: 143,
    declaredNew: lost.map((result) => result.id),
    previousHashes: Object.fromEntries(kept.map((result) => [result.id, result.actualSha256])),
  });
  assert.equal(floor, 10);
  assert.equal(witnesses.length, 3, 'свидетелем может быть только сцена с эталоном');
  assert.match(refusal, /3 из необходимых 10/);
});

test('размер матрицы обязателен: догадываться о нём нельзя (#408)', async () => {
  const { goldenWitnessRefusal } = await import('../scripts/golden-acceptance.mjs');
  // Вывести его из отчёта соблазнительно и неверно: у частичного прогона
  // (`run.mjs --only=…`) results короче матрицы, и порог просел бы молча.
  const results = [{ id: 'one', status: 'different', actualSha256: 'x' }];
  for (const sceneCount of [undefined, null, -1, 1.5, '143']) {
    const { refusal, floor } = goldenWitnessRefusal({ results, sceneCount, declared: ['one'] });
    assert.match(refusal, /не знает размера матрицы/, `sceneCount=${sceneCount}`);
    assert.equal(floor, 0);
  }
});


test('#455 съёмка golden в чужой среде отказывается заранее, verify — нет', () => {
  // До этой задачи `golden:capture` на Windows отрабатывал штатно и писал PNG,
  // а стена появлялась на приёмке. Отказ переехал на первую строку прогона.
  assert.throws(() => assertGoldenInvocation('capture', '', { platform: 'win32' }),
    /съёмка отказана/);
  assert.throws(() => assertGoldenInvocation('capture', '', { platform: 'win32' }),
    /wsl -d Ubuntu/);
  // Диагностика законна и остаётся доступной в любой среде.
  assert.doesNotThrow(() => assertGoldenInvocation('verify', '', { platform: 'win32' }));
  // Осознанный обход существует и требует причину.
  assert.doesNotThrow(() => assertGoldenInvocation('capture', '', {
    platform: 'win32', allowance: 'на этой машине нет WSL',
  }));
  assert.throws(() => assertGoldenInvocation('capture', '', {
    platform: 'win32', allowance: '',
  }), /съёмка отказана/);
});
