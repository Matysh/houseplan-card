import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertGoldenInvocation,
  GOLDEN_BASELINE_MANIFEST,
  goldenRunFailed,
  goldenScenarioSetsMatch,
} from '../demo/golden/policy.mjs';
import {
  goldenAcceptanceRefusal, goldenSilentDeclarations,
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
  assert.doesNotThrow(() => assertGoldenInvocation('capture', 'one-scenario'));
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
