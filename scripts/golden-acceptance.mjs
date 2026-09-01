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

/**
 * Floor сцен-свидетелей (#355).
 *
 * Смысл непереименованных прошедших сцен — быть СВИДЕТЕЛЯМИ среды: если бы
 * растеризация или окружение съёмки отличались от эталонных, они бы разошлись.
 * Перечислив ВСЮ матрицу в `--expect-change`, можно принять полностью чужую
 * съёмку — свидетелей не останется, а след останется только в истории команды.
 * Практический сценарий — не злой умысел, а усталость: массовая framing-правка,
 * автор перечисляет «всё, что покраснело», захватывая и сцены, разошедшиеся по
 * причине среды.
 *
 * Свидетель — необъявленная сцена, чей кандидат совпал с принятым эталоном
 * БАЙТ-В-БАЙТ: `passed` означает лишь «в пределах порога» (#351), а среду
 * доказывает только точное совпадение. Floor — 10 свидетелей или 10% сцен
 * МАТРИЦЫ, что меньше.
 *
 * Именно матрицы, а не уцелевших на диске эталонов (#408). Прежняя редакция
 * считала floor от числа сцен со статусом не `missing-baseline`, и у неё был
 * обход в одну команду: `git rm demo/golden/baselines/*.png` — все сцены
 * становятся `missing-baseline`, floor обращается в ноль, свидетелей никто не
 * требует, и чужая съёмка всей матрицы принимается без единого следа причины.
 * Отказ `goldenAcceptanceRefusal` этого не ловит: он требует, чтобы каждая
 * новая сцена была объявлена в `--expect-new`, а объявить их все ничто не
 * мешает. Прежняя редакция объясняла ноль тем, что первичная съёмка свидетелей
 * иметь не может — верно по факту и неверно по выводу: невозможность
 * доказательства не отменяет требования, она требует признать это вслух.
 *
 * Осознанный обход для действительно тотальных перерисовок и для первичной
 * съёмки — `--no-witnesses` с обязательной причиной: она уезжает в манифест
 * эталонов, то есть в артефакт и его git-историю, а не только в историю shell.
 */
/**
 * Порог по размеру МАТРИЦЫ сцен. Формула та же, что у `docsWitnessFloor`
 * (комментарий `docs-acceptance.mjs` требует, чтобы они совпадали); менялся
 * в #408 только источник счётчика.
 */
export const goldenWitnessFloor = (sceneCount) => (sceneCount > 0
  ? Math.min(10, Math.ceil(sceneCount * 0.1))
  : 0);

export const goldenWitnessRefusal = ({
  results, declared = [], declaredNew = [], previousHashes = {},
  skipWitnesses = false, skipReason = '', sceneCount,
}) => {
  if (skipWitnesses) {
    if (typeof skipReason !== 'string' || !skipReason.trim()) {
      return { refusal: '--no-witnesses требует --reason="…": причина обхода'
        + ' обязана остаться в отчёте приёмки', witnesses: [], floor: 0 };
    }
    return { refusal: null, witnesses: [], floor: 0 };
  }
  // Размер матрицы обязателен и не выводится из отчёта: `results.length` у
  // частичного прогона (`run.mjs --only=…`) меньше матрицы, и floor молча
  // просел бы — тот же дефект #408 в другой одежде. Отсутствие параметра —
  // отказ, а не догадка.
  if (!Number.isInteger(sceneCount) || sceneCount < 0) {
    return {
      refusal: 'приёмка не знает размера матрицы сцен: floor свидетелей считать не от чего.'
        + ' Передайте sceneCount (GOLDEN_SCENARIOS.length) — от числа уцелевших на диске'
        + ' эталонов его считать нельзя, это обходится удалением эталонов (#408)',
      witnesses: [],
      floor: 0,
    };
  }
  const accepted = new Set([...declared, ...declaredNew].filter(Boolean));
  // Свидетелем может быть только сцена с эталоном: сравнивать не с чем. Но
  // ПОРОГ от этого не зависит — иначе удаление эталонов снижало бы планку.
  const withBaseline = results.filter((result) => result.status !== 'missing-baseline');
  const floor = goldenWitnessFloor(sceneCount);
  const witnesses = withBaseline
    .filter((result) => !accepted.has(result.id)
      && result.status === 'passed'
      && typeof result.actualSha256 === 'string'
      && result.actualSha256 === previousHashes[result.id])
    .map((result) => result.id)
    .sort();
  if (witnesses.length < floor) {
    return {
      refusal: 'сцен-свидетелей среды недостаточно:'
        + ` ${witnesses.length} из необходимых ${floor}`
        + ` (сцен в матрице ${sceneCount}, с эталонами ${withBaseline.length},`
        + ` объявлено ${accepted.size}).`
        + ' Свидетель — необъявленная сцена, совпавшая с эталоном байт-в-байт;'
        + ' именно они доказывают, что среда съёмки та же, что у принятого'
        + ' эталона. Если перерисовка действительно тотальная и осознанная —'
        + ' --no-witnesses --reason="…" оставит причину в манифесте эталонов',
      witnesses,
      floor,
    };
  }
  return { refusal: null, witnesses, floor };
};
