#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// #352: the budget guards the CLASS of regression — tens of kilobytes from
// an accidentally imported dependency or an eagerly bundled dictionary —
// not every byte. v1.69.0-beta.1 shipped at 255 993 B gzip against a
// 256 000 B ceiling: seven bytes of headroom turned the gate into a
// lottery where the unlucky LAST commit goes red, not the one that grew
// the bundle (5740324b was exactly that). The ceiling therefore keeps a
// deliberate ~10% allowance over the measured fact; the fact and headroom
// are printed on every run so the trend is visible long before the wall.
//
// #367, рекалибровка 29.08. Запас съеден с 26 КБ до 8.3 КБ, и это не диффузное
// расползание, а один шаг плюс обычная работа. Факт по документам код-ревью:
//
//   #317 256 127 · #318 256 091 · #341 256 046 · #354 257 212 · #159 256 828
//   #357 271 143  ← +14 КБ за один заход
//   #20  271 455 · #361 272 848 · #359 272 469 · #360 273 697  ← текущий факт
//
// Шаг на #357 — plan-art мебели: 44 top-view символа в eager-графе, которые
// платит КАЖДЫЙ план, включая планы без единого предмета мебели. Остальные
// приросты по килобайту и относятся к обычным фичам.
//
// Поэтому запись честная: рекалибровка НИЧЕГО не ускоряет и ничего не чинит.
// Она фиксирует, что 273 697 Б — новая норма, и возвращает рабочий запас, чтобы
// гейт снова красил того, кто вырастил бандл, а не того, кто пушнул последним.
// Настоящий рычаг остаётся прежним и описан в #367: вынести plan-art мебели в
// ленивый чанк (−13.6 КБ, вариант 1) либо русский словарь (вариант 2).
//
// Measured fact at recalibration (dev @ 360, 29.08.2026): 273 697 B gzip.
// 273 697 × 1.10 = 301 067 — потолок 300 000 держится внутри правила ~10%.
export const INITIAL_VIEW_GZIP_BUDGET = 300_000;

/**
 * Порог, ниже которого запас перестаёт быть запасом (#367).
 *
 * Прежняя редакция полагалась на то, что человек заметит тренд в выводе. За
 * сутки запас ушёл с 26 КБ до 8.3 КБ, и не заметил никто — потому что каждая
 * отдельная строка выглядела нормально. Предупреждение срабатывает за две
 * средние фичи до стены, а не после неё.
 */
export const LOW_HEADROOM_WARNING_BYTES = 15_000;

/**
 * Потолок графа с полосой — работающий храповик (#438), не разовый (#429).
 *
 * История в двух шагах. #429 снял `SUPPORT_LAZY_INITIAL_BASELINE_BYTES = 291046`
 * — порог, привязанный к критерию приёмки #423, с пятнадцатью байтами запаса и
 * сообщением про копирайт формы поддержки. Снять было правильно: он обвинял бы
 * не ту задачу. Но снят он оказался ровно на том релизе, где сработал бы:
 *
 *   v1.71.0-beta.1  291 031      снятый порог  291 046      beta.2  291 069
 *
 * То есть рост произошёл внутри той же беты, уже после снятия, и заметить его
 * стало нечем: единственным оставшимся сигналом был `lowHeadroomWarning`, а он
 * горит постоянно — третий аудит подряд, и третий раз без реакции.
 *
 * Почему полоса, а не точное число. Метрика — gzip, и она не монотонна по
 * исходнику: на beta.2 initial-чанк стал МЕНЬШЕ на 344 сырых байта и при этом
 * на 40 байт больше в сжатом виде (переименования минификатора и контекст
 * сжатия). Точный храповик по gzip краснел бы на коммитах, которые код
 * сокращают, — та же лотерея, о которой предупреждает комментарий к бюджету
 * выше: красным станет последний пушнувший, а не тот, кто вырастил граф.
 *
 * Поэтому правило двустороннее и с полосой, как у ядер (#425): значение обязано
 * лежать в `[ceiling - band, ceiling]`. Рост выше потолка — отказ с числом:
 * поднимайте потолок в том же коммите с объяснением либо выносите код в
 * ленивый граф (#367). Падение ниже полосы — тоже отказ: незафиксированный
 * выигрыш отыгрывается обратно молча, и это ровно то, что случилось с запасом
 * бюджета (26 КБ → 8.3 КБ за сутки).
 *
 * Полоса 2 000 Б — примерно одна средняя фича в initial-графе и заметно больше
 * колебаний метрики от переименований (наблюдаемые единицы-десятки байт). До
 * стены 300 000 остаётся четыре явных шага вместо двухсот незаметных.
 *
 * Потолок поставлен так, чтобы измеренный факт лежал ближе к середине полосы:
 * 291 069 при потолке 292 000 — это 931 Б до отказа сверху и 1 069 Б снизу.
 * Иначе одна из сторон срабатывает на десятках байт, то есть на шуме: правило
 * должно требовать решения от РЕАЛЬНОГО изменения, а не от переименования.
 *
 * 2026-09-03, #162: потолок поднят 292 000 → 294 000. Причина — маршрутизация
 * карт робота по пространствам: `src/vacuum-routes.ts` обязан быть в
 * initial-графе, потому что решение «какая карта на каком этаже» принимает
 * View, а не редактор. Замеренная цена 1 075 Б gzip (291 203 → 292 278).
 * Редакторская половина при этом в initial-граф НЕ попала: правки маршрутов
 * вынесены в `src/vacuum-route-edit.ts`, редакторский UI — в
 * `src/editors/vacuum-maps-section.ts`, а тексты блока — в ленивый словарь
 * `src/i18n/support/*.json` (приём #423). Эти три выноса дали −1 326 Б от
 * первой редакции правки (293 604 → 292 278); без них рост был бы вдвое
 * больше. Вторая часть роста — предупреждение у дока: четыре локализованных
 * причины обязаны быть во View-словаре, потому что текст читает пользователь
 * карточки, а не редактора (+581 Б). Итог 292 859: 1 141 Б до потолка сверху и
 * 859 Б до нижней границы полосы — обе стороны дальше шума метрики.
 *
 * 2026-09-04, #152: потолок поднят 294 000 → 296 000. Room fit является
 * действием основного View: канонический owner жеста, точные Flat/Iso bounds и
 * camera target нужны до открытия любого редактора и не могут жить в его
 * ленивом графе. Измеренный initial-граф вырос 293 220 → 294 864 Б gzip
 * (+1 644 Б); после шага остаётся 1 136 Б сверху и 864 Б до нижней границы
 * полосы, то есть обе стороны дальше наблюдаемого шума. Общий бюджет 300 000 Б
 * не меняется; его запас после функции — 5 136 Б, а долг ленивого выноса #367
 * остаётся видимым через LOW_HEADROOM_WARNING.
 *
 * 2026-09-04, #449: потолок поднят 296 000 → 297 000. Единый распознаватель
 * double-click/double-tap для свободного фона View входит в initial-граф;
 * после реализации он занимает 295 743 Б gzip. Запас до потолка — 1 257 Б,
 * до нижней границы полосы — 743 Б, то есть обе стороны остаются дальше
 * наблюдаемого шума. Общий бюджет 300 000 Б и долг #367 не меняются.
 *
 * 2026-09-04, #451: потолок поднят 297 000 → 298 000. Терминальная доставка
 * последнего HA-снимка и явное управление кадром редактора принадлежат
 * основному View: без них пропущенный полный render оставлял бы устаревшее
 * состояние после pan/resize. После исправления initial-граф занимает
 * 296 717 Б gzip: 1 283 Б сверху и 717 Б до нижней границы полосы. Общий
 * бюджет 300 000 Б не меняется; долг ленивого выноса #367 остаётся видимым.
 */
export const INITIAL_VIEW_GZIP_CEILING = 298_000;
export const INITIAL_VIEW_CEILING_BAND = 2_000;

/**
 * До какого потолка предупреждение о запасе погашено владельцем.
 *
 * `null` — не погашено, и это текущее состояние: запас 8 931 Б при пороге
 * 15 000, долг живёт в #367. Предупреждение, которое нельзя погасить, читается
 * как выключенное, поэтому его можно погасить — одной строкой здесь, со
 * ссылкой на решение. Признание привязано к ЗНАЧЕНИЮ потолка: как только
 * потолок поднимут, оно перестаёт покрывать, и вопрос возвращается ровно
 * тогда, когда граф снова вырос.
 */
export const LOW_HEADROOM_ACKNOWLEDGED_CEILING = null;

export const SUPPORT_LAZY_MARKERS = [
  'Contact details (email/tg/WhatsApp), optional.',
  'Контакт для связи (email/tg/WhatsApp), необязательно.',
];

/**
 * Форма поддержки живёт только в ленивом графе редактора (#423).
 *
 * Функция судит ВЛАДЕНИЕ, а не размер: маркеры формы обязаны отсутствовать в
 * `initialViewFiles` и присутствовать в `lazyEditorFiles`. Размер охраняют
 * `assertBundleBudget` и `lowHeadroomWarning` — им для этого не нужен чужой
 * номер issue (#429).
 */
export function assertSupportBundleOwnership(
  manifest,
  root = 'dist',
  markers = SUPPORT_LAZY_MARKERS,
) {
  const graphText = (paths) => paths
    .map((path) => readFileSync(resolve(root, path), 'utf8'))
    .join('\n');
  const initial = graphText(manifest.initialViewFiles || []);
  const editor = graphText(manifest.lazyEditorFiles || []);
  for (const marker of markers) {
    if (initial.includes(marker)) {
      throw new Error(`support form copy leaked into initial View graph: ${marker}`);
    }
    if (!editor.includes(marker)) {
      throw new Error(`support form copy missing from lazy editor graph: ${marker}`);
    }
  }
}

/**
 * Потолок графа: `null`, пока значение внутри полосы.
 *
 * Возвращает находку, а не бросает: вызывающий решает, что с ней делать, и
 * тест может проверить обе стороны, не ловя исключение.
 */
export function initialViewCeilingViolation(bytes, {
  ceiling = INITIAL_VIEW_GZIP_CEILING,
  band = INITIAL_VIEW_CEILING_BAND,
} = {}) {
  if (!Number.isFinite(bytes)) {
    return { kind: 'missing', text: 'initial View graph не измерен — потолок проверить нечем' };
  }
  if (bytes > ceiling) {
    return {
      kind: 'grew',
      over: bytes - ceiling,
      text: `initial View graph ${bytes} B gzip выше потолка ${ceiling} B на ${bytes - ceiling} B.`
        + ' Поднимите потолок в этом же коммите, объяснив рост, либо вынесите код в ленивый'
        + ' граф (#367). Молча расти этому графу больше нечем.',
    };
  }
  if (bytes < ceiling - band) {
    return {
      kind: 'shrank',
      under: ceiling - bytes,
      text: `initial View graph ${bytes} B gzip ниже потолка ${ceiling} B на ${ceiling - bytes} B`
        + ` — больше полосы ${band} B. Опустите потолок: незафиксированный выигрыш граф`
        + ' отыграет обратно, и это уже происходило (#367).',
    };
  }
  return null;
}

/** Тревога о запасе: `null`, пока его хватает или пока долг признан. */
export function lowHeadroomWarning(headroom, {
  threshold = LOW_HEADROOM_WARNING_BYTES,
  ceiling = INITIAL_VIEW_GZIP_CEILING,
  acknowledgedCeiling = LOW_HEADROOM_ACKNOWLEDGED_CEILING,
} = {}) {
  if (!Number.isFinite(headroom) || headroom >= threshold) return null;
  if (headroom < 0) {
    return `бюджет превышен на ${-headroom} Б — гейт уже красный`;
  }
  // Превышение бюджета не гасится признанием: там уже отказ, а не тревога.
  if (Number.isFinite(acknowledgedCeiling) && ceiling <= acknowledgedCeiling) return null;
  const stale = Number.isFinite(acknowledgedCeiling)
    ? ` Признание долга покрывает потолок до ${acknowledgedCeiling} Б, а он уже ${ceiling} Б —`
      + ' граф вырос с тех пор, вопрос вернулся.'
    : ' Погасить можно решением владельца: LOW_HEADROOM_ACKNOWLEDGED_CEILING в'
      + ' scripts/bundle-budget.mjs. Пока не погашено — это долг (#367).';
  return `запас бюджета ${headroom} Б, меньше порога ${threshold} Б:`
    + ' следующая средняя фича упрётся в стену. Рекалибровка это не лечит —'
    + ' смотрите ленивые графы (#367).' + stale;
}

export function assertBundleBudget(manifest, budget = INITIAL_VIEW_GZIP_BUDGET) {
  if (manifest?.schema !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('invalid houseplan-assets.json');
  }
  if (!manifest.lazyEditorFiles?.length) {
    throw new Error('bundle has no lazy editor graph');
  }
  if (!manifest.lazyLocaleFiles?.length) {
    throw new Error('bundle has no lazy locale graph');
  }
  if (manifest.initialViewFiles.some((path) => manifest.lazyEditorFiles.includes(path))) {
    throw new Error('initial View graph overlaps lazy editor graph');
  }
  if (manifest.initialViewFiles.some((path) => manifest.lazyLocaleFiles.includes(path))) {
    throw new Error('initial View graph overlaps lazy locale graph');
  }
  if (manifest.lazyLocaleFiles.some((path) => manifest.lazyEditorFiles.includes(path)
      || manifest.lazyOnboardingFiles?.includes(path))) {
    throw new Error('lazy locale graph overlaps an editor graph');
  }
  if (manifest.initialViewGzipBytes > budget) {
    throw new Error(
      `initial View graph ${manifest.initialViewGzipBytes} B gzip exceeds ${budget} B budget`,
    );
  }
  return {
    initialViewGzipBytes: manifest.initialViewGzipBytes,
    lazyEditorGzipBytes: manifest.lazyEditorGzipBytes,
    lazyLocaleGzipBytes: manifest.lazyLocaleGzipBytes,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const manifest = JSON.parse(readFileSync(resolve('dist/houseplan-assets.json'), 'utf8'));
    const result = assertBundleBudget(manifest);
    assertSupportBundleOwnership(manifest);
    const ceiling = initialViewCeilingViolation(result.initialViewGzipBytes);
    if (ceiling) throw new Error(ceiling.text);
    const headroom = INITIAL_VIEW_GZIP_BUDGET - result.initialViewGzipBytes;
    const lines = [
      `initial View: ${result.initialViewGzipBytes} B gzip`
        + ` (потолок ${INITIAL_VIEW_GZIP_CEILING} B ±${INITIAL_VIEW_CEILING_BAND},`
        + ` budget ${INITIAL_VIEW_GZIP_BUDGET} B, headroom ${headroom} B)`,
      `lazy editor: ${result.lazyEditorGzipBytes} B gzip`,
      `lazy locale: ${result.lazyLocaleGzipBytes} B gzip`,
    ];
    for (const line of lines) console.log(line);
    const warning = lowHeadroomWarning(headroom);
    if (warning) console.log(`::warning::${warning}`);
    // #352: the trend belongs where humans look — the run summary.
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
        '### Бюджет бандла',
        `| граф | gzip | бюджет | запас |`,
        `|---|---|---|---|`,
        `| initial View | ${result.initialViewGzipBytes} B | ${INITIAL_VIEW_GZIP_BUDGET} B | ${headroom} B |`,
        `| потолок (#438) | ${INITIAL_VIEW_GZIP_CEILING} B | полоса ${INITIAL_VIEW_CEILING_BAND} B |`
          + ` ${INITIAL_VIEW_GZIP_CEILING - result.initialViewGzipBytes} B до потолка |`,
        ...(warning ? ['', `> ${warning}`] : []),
        '',
      ].join('\n'));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
