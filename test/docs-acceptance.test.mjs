import test from 'node:test';
import assert from 'node:assert/strict';

import {
  docsAcceptancePlan, docsSilentDeclarations, docsUnknownDeclarations, docsWitnessFloor,
} from '../scripts/docs-acceptance.mjs';

// #401. Правило приёмки скриншотов перестало быть про место съёмки и стало про
// доказательство: среда доказана, если каждый кадр, который менять не
// собирались, совпал с закоммиченным байт-в-байт. Здесь закреплён каждый отказ
// и каждый путь приёмки — иначе правило живёт только в комментарии, как жило
// предыдущее.

const IDS = ['alpha', 'beta', 'gamma'];
const same = { alpha: 'a', beta: 'b', gamma: 'c' };

test('ничего не объявлено и всё совпало — принимается один манифест (#401)', () => {
  // Частый случай: правка исходников, которая не может сдвинуть пиксель.
  // Раньше он требовал прогона workflow и правки манифеста руками (#390).
  const plan = docsAcceptancePlan({ ids: IDS, committed: same, candidate: { ...same } });
  assert.equal(plan.refusal, null);
  assert.deepEqual(plan.replace, []);
  assert.deepEqual(plan.keep, IDS);
  assert.equal(plan.witnesses.length, 3);
});

test('объявленный кадр заменяется, остальные не трогаются (#401)', () => {
  const plan = docsAcceptancePlan({
    ids: IDS, committed: same, candidate: { ...same, beta: 'иное' }, declared: ['beta'],
  });
  assert.equal(plan.refusal, null);
  assert.deepEqual(plan.replace, ['beta']);
  // Половина принятого набора хуже непринятого: рядом окажется кадр от одного
  // дерева и манифест от другого.
  assert.deepEqual(plan.keep, ['alpha', 'gamma']);
  assert.deepEqual(plan.witnesses, ['alpha', 'gamma']);
});

test('расхождение без декларации останавливает приёмку (#401)', () => {
  const plan = docsAcceptancePlan({ ids: IDS, committed: same, candidate: { ...same, gamma: 'иное' } });
  assert.match(plan.refusal, /разошлись, но не объявлены: gamma/);
  // Отказ обязан называть оба объяснения: автор не знает, какое из них его.
  assert.match(plan.refusal, /изменение продукта/);
  assert.match(plan.refusal, /другой среде/);
  assert.deepEqual(plan.replace, []);
});

test('молчаливая декларация — тоже отказ (#401)', () => {
  const plan = docsAcceptancePlan({
    ids: IDS, committed: same, candidate: { ...same, beta: 'иное' }, declared: ['beta', 'alpha'],
  });
  assert.match(plan.refusal, /не изменились: alpha/);
});

test('объявленного имени нет в наборе — отказ до всякой проверки (#401)', () => {
  const plan = docsAcceptancePlan({
    ids: IDS, committed: same, candidate: { ...same }, declared: ['опечатка'],
  });
  assert.match(plan.refusal, /которых нет в наборе: опечатка/);
});

test('тотальная перерисовка требует явного обхода с причиной (#401)', () => {
  const all = { alpha: 'x', beta: 'y', gamma: 'z' };
  const declared = [...IDS];
  const refused = docsAcceptancePlan({ ids: IDS, committed: same, candidate: all, declared });
  assert.match(refused.refusal, /свидетелей недостаточно: 0 из необходимых 1/);

  const noReason = docsAcceptancePlan({
    ids: IDS, committed: same, candidate: all, declared, skipWitnesses: true,
  });
  assert.match(noReason.refusal, /требует --reason/);

  const bypassed = docsAcceptancePlan({
    ids: IDS, committed: same, candidate: all, declared,
    skipWitnesses: true, skipReason: 'сменился шрифтовый стек',
  });
  assert.equal(bypassed.refusal, null);
  assert.deepEqual(bypassed.replace, IDS);
});

test('порог свидетелей считается так же, как в golden (#401)', () => {
  // Два набора картинок в одном репозитории не должны требовать от человека
  // помнить два разных правила.
  assert.equal(docsWitnessFloor(0), 0);
  assert.equal(docsWitnessFloor(10), 1);
  assert.equal(docsWitnessFloor(143), 10);
});

test('вспомогательные проверки называют виновников по именам (#401)', () => {
  assert.deepEqual(docsUnknownDeclarations(IDS, ['gamma', 'нет-такого']), ['нет-такого']);
  assert.deepEqual(
    docsSilentDeclarations({ committed: same, candidate: { ...same }, declared: ['beta', 'alpha'] }),
    ['alpha', 'beta'],
  );
});

test('кадр без закоммиченной пары не может быть свидетелем (#401)', () => {
  // Первичная съёмка ничего не доказывает про среду: сравнивать не с чем.
  const plan = docsAcceptancePlan({
    ids: IDS,
    committed: { alpha: 'a' },
    candidate: { alpha: 'a', beta: 'новое', gamma: 'новое' },
    declared: ['beta', 'gamma'],
  });
  assert.equal(plan.refusal, null);
  assert.deepEqual(plan.witnesses, ['alpha']);
  assert.equal(plan.floor, 1);
});

// --- порог считается от набора, а не от уцелевших кадров (#409) -------------

test('удаление всех кадров не снижает порог (#409)', () => {
  // Воспроизведение обхода целиком: rm docs/images/*.png, объявить все десять.
  // Первая редакция (#401) считала порог от уцелевших — ноль уцелевших давал
  // ноль порога, и чужая съёмка проходила без единого слова о причине.
  const ids = Array.from({ length: 10 }, (_, index) => `scene-${index}`);
  const candidate = Object.fromEntries(ids.map((id) => [id, `foreign-${id}`]));
  const plan = docsAcceptancePlan({ ids, committed: {}, candidate, declared: ids });
  assert.equal(plan.floor, 1, 'порог от набора сценариев, а не от нуля уцелевших');
  assert.equal(plan.witnesses.length, 0);
  assert.match(plan.refusal, /0 из необходимых 1/);
  assert.match(plan.refusal, /сцен в наборе 10, с закоммиченным кадром 0/);

  const named = docsAcceptancePlan({
    ids, committed: {}, candidate, declared: ids,
    skipWitnesses: true, skipReason: 'первичная съёмка набора',
  });
  assert.equal(named.refusal, null, 'законный путь — назвать причину');
});

test('порог держится и при частичной потере кадров (#409)', () => {
  // Случай, где старая и новая формулы расходятся: 20 сцен в наборе, три кадра
  // на диске. Было бы 1, стало 2 — и три свидетеля этого уже не хватает.
  const ids = Array.from({ length: 20 }, (_, index) => `scene-${index}`);
  const committed = Object.fromEntries(ids.slice(0, 3).map((id) => [id, `same-${id}`]));
  const candidate = Object.fromEntries(ids.map((id) => [id,
    committed[id] || `new-${id}`]));
  const plan = docsAcceptancePlan({
    ids, committed, candidate, declared: ids.slice(3),
  });
  assert.equal(plan.floor, 2);
  assert.equal(plan.witnesses.length, 3, 'свидетелем может быть только кадр с парой');
  assert.equal(plan.refusal, null, 'три свидетеля при пороге два — достаточно');

  const stricter = docsAcceptancePlan({
    ids, committed: { [ids[0]]: 'same-scene-0' },
    candidate: Object.fromEntries(ids.map((id) => [id,
      id === ids[0] ? 'same-scene-0' : `new-${id}`])),
    declared: ids.slice(1),
  });
  assert.match(stricter.refusal, /1 из необходимых 2/,
    'один уцелевший кадр планку не опускает');
});

test('пустой набор сценариев — отказ, а не ноль (#409)', () => {
  const plan = docsAcceptancePlan({ ids: [], committed: {}, candidate: {} });
  assert.match(plan.refusal, /набор сценариев пуст/);
});

test('порог совпадает с golden при равном размере набора (#409)', async () => {
  const { goldenWitnessFloor } = await import('../scripts/golden-acceptance.mjs');
  // Формулы обязаны совпадать: два набора картинок в одном репозитории не
  // должны требовать помнить два разных правила.
  for (const size of [0, 1, 10, 20, 143, 1000]) {
    assert.equal(docsWitnessFloor(size), goldenWitnessFloor(size), `размер ${size}`);
  }
});
