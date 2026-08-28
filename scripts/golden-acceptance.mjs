/**
 * Правило допустимости съёмки golden-кандидатов (#334).
 *
 * Прежде эталон принимался только из артефакта CI: растеризация шрифтов на
 * другой машине может отличаться, а доказать обратное было нечем. Цена —
 * двойной roundtrip на каждый визуальный фикс: пуш, семь минут CI, скачивание
 * артефакта, приёмка, второй пуш, второй полный прогон. При версии матрицы 48
 * это платится регулярно.
 *
 * Доказательство есть, и оно эмпирическое: среда съёмки равна раннеру, если
 * КАЖДАЯ сцена, которую менять не собирались, совпала со своим принятым
 * эталоном. Расхождение растеризации нельзя спрятать — оно задевает все сцены
 * с текстом, а не только правленные. Поэтому ревьюер объявляет намерение
 * списком `--expect-change`, и всё, что разошлось помимо списка, приёмку
 * запрещает: либо это регрессия рендера, либо среда не та.
 *
 * То же правило ловит другое, независимо от среды: «принять всё, чтобы CI
 * позеленел». Именно так эталон перестаёт быть эталоном — молча, одной
 * командой, без единого названного намерения.
 *
 * Новая сцена объявляется отдельно, флагом `--expect-new` (#350). Прежде она
 * проходила молча, и три кадра каталога устройств стали контрактом без единого
 * взгляда. Половина прежнего обоснования верна и остаётся: расхождение
 * растеризации новая сцена выявить не может, для доказательства параллельности
 * среды годятся только сцены с эталонами. Но правило отвечало лишь на вопрос
 * «та ли это среда» и молчало про второй — «правильный ли это кадр». Пустой,
 * обрезанный или снятый в неверном состоянии кадр новая сцена закрепляет ровно
 * так же надёжно, как испорченный старый.
 *
 * Поэтому два флага утверждают разное и не заменяют друг друга:
 * `--expect-change` — «я знаю, почему старый кадр изменился», `--expect-new` —
 * «я посмотрел на новый кадр». Путаница между ними тоже запрещена: имя в чужом
 * флаге останавливает приёмку.
 * она могла бы противоречить.
 *
 * Почему это лежит в `scripts/`, а не рядом с `accept.mjs`. Отпечаток
 * `sourceFingerprint` включает ВСЕ `.mjs` из `demo/golden`, включая
 * `accept.mjs` и `policy.mjs`, которые исполняются после того, как картинка уже
 * снята, и ни одного пикселя изменить не могут. Правка любого из них объявляет
 * устаревшими и закоммиченный бандл, и манифест скриншотов документации, и
 * манифест эталонов — то есть требует ровно того двойного цикла, который эта
 * задача убирает. Сужение корпуса отпечатка — отдельная задача: оно неизбежно
 * требует пересборки бандла, потому что сам `source-fingerprint.mjs` в корпусе.
 */

export const goldenAcceptanceRefusal = (results, declared = [], declaredNew = []) => {
  if (!Array.isArray(results)) return 'отчёт кандидатов не содержит результатов сцен';
  const expected = new Set(declared.filter(Boolean));
  const expectedNew = new Set(declaredNew.filter(Boolean));
  const statusById = new Map(results.map((result) => [result.id, result.status]));

  const unknown = [...expected, ...expectedNew].filter((id) => !statusById.has(id));
  if (unknown.length) {
    return 'названы сцены, которых нет в отчёте:'
      + ` ${[...new Set(unknown)].sort().join(', ')}`;
  }
  // Путаница между флагами — не мелочь: она означает, что ревьюер думал об
  // одной сцене, а утверждал про другую.
  const newInWrongFlag = [...expected]
    .filter((id) => statusById.get(id) === 'missing-baseline').sort();
  if (newInWrongFlag.length) {
    return `у этих сцен эталона ещё нет, их место в --expect-new: ${newInWrongFlag.join(', ')}`;
  }
  const oldInWrongFlag = [...expectedNew]
    .filter((id) => statusById.get(id) !== 'missing-baseline').sort();
  if (oldInWrongFlag.length) {
    return 'у этих сцен эталон уже есть, их место в --expect-change:'
      + ` ${oldInWrongFlag.join(', ')}`;
  }

  const undeclared = results
    .filter((result) => result.status === 'different' && !expected.has(result.id))
    .map((result) => result.id)
    .sort();
  if (undeclared.length) {
    return 'съёмка разошлась с принятыми эталонами в сценах, которые менять не собирались:'
      + ` ${undeclared.join(', ')}.`
      + ' Либо это регрессия рендера, либо среда съёмки не совпадает с раннером —'
      + ' в обоих случаях приёмка запрещена. Намеренные сцены перечисляются в'
      + ' --expect-change=<id,id>';
  }

  const undeclaredNew = results
    .filter((result) => result.status === 'missing-baseline' && !expectedNew.has(result.id))
    .map((result) => result.id)
    .sort();
  if (undeclaredNew.length) {
    return 'у этих сцен эталона ещё нет, и они станут контрактом:'
      + ` ${undeclaredNew.join(', ')}.`
      + ' Посмотрите кадры в artifacts/golden/actual — пустой или обрезанный кадр'
      + ' закрепляется так же надёжно, как испорченный старый, — и перечислите их'
      + ' в --expect-new=<id,id>';
  }
  return null;
};

/** Сцены, объявленные изменёнными, но совпавшие с эталоном: не ошибка, но и не молчание. */
export const goldenSilentDeclarations = (results, declared = []) => declared
  .filter((id) => results.find((result) => result.id === id)?.status === 'passed')
  .sort();

/**
 * План замены: что переписать, что оставить как было (#351).
 *
 * Чистая функция, потому что решение здесь одно и ошибка в нём дорога:
 * `passed` означает «в пределах порога», а не «байт в байт». Прежняя приёмка
 * копировала кандидата поверх КАЖДОГО эталона, поэтому подпороговый дрейф уезжал
 * в контракт молча и накапливался: каждая приёмка подтягивала эталон к последней
 * среде, порог не пересекался никогда, а эталон уходил. Так `1e341c60` заменил
 * 22 картинки, объявив четыре.
 *
 * Необъявленная сцена сохраняет и файл, и свой хеш из прежнего индекса. Хеша нет
 * только у сцены без эталона, а такая обязана быть названа в `--expect-new` —
 * поэтому его отсутствие здесь ошибка, а не повод взять кандидата.
 */
export const goldenAcceptancePlan = ({
  scenarioIds, results, previousHashes = {}, declared = [], declaredNew = [],
}) => {
  const accepted = new Set([...declared, ...declaredNew].filter(Boolean));
  const byId = new Map((results || []).map((result) => [result.id, result]));
  const replace = [];
  const keep = [];
  const hashes = {};
  for (const id of scenarioIds) {
    if (accepted.has(id)) {
      const digest = byId.get(id)?.actualSha256;
      if (typeof digest !== 'string' || !digest) {
        throw new Error(`объявленная сцена без хеша кандидата: ${id}`);
      }
      replace.push(id);
      hashes[id] = digest;
      continue;
    }
    const existing = previousHashes[id];
    if (typeof existing !== 'string' || !existing) {
      throw new Error(`необъявленная сцена без прежнего эталона: ${id};`
        + ' назовите её в --expect-new');
    }
    hashes[id] = existing;
    keep.push(id);
  }
  return { replace, keep, hashes };
};
