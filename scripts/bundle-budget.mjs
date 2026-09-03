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
 * Числового храповика здесь больше нет, и это решение, а не упущение (#429).
 *
 * До #429 функция бросала при `initialViewGzipBytes >= 291 046` — «граф не стал
 * больше, чем был на момент закрытия #423». На бете 1.71.0 запас до этого
 * порога составлял пятнадцать байт, на момент правки — сто четыре. Пятнадцать
 * байт gzip меньше одной строки локали: первый же посторонний коммит получил бы
 * красный CI с сообщением про копирайт формы поддержки, к которому не имеет
 * отношения.
 *
 * Гейт, обвиняющий не ту задачу, — худший вид гейта: его выключают, не
 * разбираясь, и вместе с ним выключают проверку владения графом, которая как
 * раз долговечна. Поэтому число снято, а проверка владения осталась.
 *
 * Что именно было снято по существу: «граф не вырос» — это критерий приёмки на
 * момент задачи, а не свойство продукта. Свойство продукта охраняет общий
 * бюджет (`INITIAL_VIEW_GZIP_BUDGET`) и предупреждение о запасе; они судят
 * размер целиком и не привязаны к чужому issue.
 */
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

/** Тревога о запасе: `null`, пока его хватает. */
export function lowHeadroomWarning(headroom, threshold = LOW_HEADROOM_WARNING_BYTES) {
  if (!Number.isFinite(headroom) || headroom >= threshold) return null;
  if (headroom < 0) {
    return `бюджет превышен на ${-headroom} Б — гейт уже красный`;
  }
  return `запас бюджета ${headroom} Б, меньше порога ${threshold} Б:`
    + ' следующая средняя фича упрётся в стену. Рекалибровка это не лечит —'
    + ' смотрите ленивые графы (#367)';
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
    const headroom = INITIAL_VIEW_GZIP_BUDGET - result.initialViewGzipBytes;
    const lines = [
      `initial View: ${result.initialViewGzipBytes} B gzip`
        + ` (budget ${INITIAL_VIEW_GZIP_BUDGET} B, headroom ${headroom} B)`,
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
        ...(warning ? ['', `> ${warning}`] : []),
        '',
      ].join('\n'));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
