import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CARD_DIALOG_FORM_KIT, SUMMARY_PANEL_FORM_KIT, formKitCss,
} from '../test-build/styles/form-kit.styles.js';
import { summaryPanelEditorCss } from '../test-build/summary-panel-editor-style.js';

/**
 * #594. Набор контролов поднят из редактора боковой панели, и главный вопрос к
 * нему один: общий ли он на самом деле. Ответ обязан быть машинным — с
 * параметрами панели генератор должен выдавать её нынешние правила ДОСЛОВНО.
 *
 * #597 довёл это до конца: панель больше не описывает эти правила у себя, она
 * подставляет фрагменты набора. Поэтому доказательство переехало с «фрагмент
 * есть в исходнике панели» на «СОБРАННЫЙ лист панели совпадает с замороженным
 * побайтово» — оно сильнее и ловит в том числе перестановку правил.
 */
const FROZEN_PANEL_CSS = readFileSync(
  new URL('./fixtures/summary-panel-editor.css', import.meta.url), 'utf8',
);
/**
 * #597 M2 ревью ТЗ. К3 обещает, что разрез генератора на фрагменты не меняет
 * ни байта в листе диалогов, а сослаться было не на что: существующие тесты
 * набора проверяют подстроки и счётчики, но не полный текст. Лишний пробел на
 * стыке фрагментов прошёл бы незамеченным — в CSS он безвреден, но обещание
 * «байт в байт» без свидетеля остаётся обещанием.
 */
const FROZEN_CARD_KIT_CSS = readFileSync(
  new URL('./fixtures/form-kit-card-dialog.css', import.meta.url), 'utf8',
);
const FROZEN_CARD_KIT_WITH_SWITCH_CSS = readFileSync(
  new URL('./fixtures/form-kit-card-dialog-with-switch.css', import.meta.url), 'utf8',
);

const PANEL_FRAGMENTS = {
  'карточка-группа': `  .summary-general,
  .summary-blocks-card {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--summary-editor-line);
    border-radius: 11px;
    background: var(--summary-editor-surface);
  }`,
  'обводка фокуса': `  .summary-editor input:focus-visible,
  .summary-editor select:focus-visible,
  .summary-editor button:focus-visible,
  .summary-editor-footer button:focus-visible {
    outline: 2px solid var(--summary-editor-accent);
    outline-offset: 2px;
  }`,
  'выключенное состояние': `  .summary-editor button:disabled,
  .summary-editor input:disabled,
  .summary-editor select:disabled { opacity: .4; cursor: default; }`,
  'ряд-переключатель': `  .summary-editor .summary-switch {
    display: flex;
    min-width: 0;
    min-height: 54px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    color: var(--primary-text-color);
    cursor: pointer;
  }`,
  'подпись ряда': `  .summary-switch-caption { display: grid; min-width: 0; gap: 3px; }
  .summary-switch-caption strong { font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .summary-switch-caption small { font-size: .8125rem; color: var(--secondary-text-color); overflow-wrap: anywhere; }`,
};

test('#594 AC11 генератор воспроизводит правила панели дословно', () => {
  const generated = formKitCss(SUMMARY_PANEL_FORM_KIT);
  for (const [name, fragment] of Object.entries(PANEL_FRAGMENTS)) {
    assert.ok(FROZEN_PANEL_CSS.includes(fragment),
      `${name}: фикстура разошлась с замороженным листом панели`);
    assert.ok(generated.includes(fragment),
      `${name}: генератор с параметрами панели больше не выдаёт её правило дословно`);
  }
});

/**
 * #597. Главное доказательство шага и единственное, которое ловит перестановку
 * правил: у настроек панели нет ни одного golden-кадра (в матрице нет сцены
 * `dialog: 'summary'`), поэтому «панель не изменилась» нельзя показать
 * пикселями. Сравнение собранного листа с замороженным — замена эталону.
 *
 * Фикстура `test/fixtures/summary-panel-editor.css` снята с `origin/dev` до
 * правки. Она живёт ровно до того шага эпика #591, который законно меняет вид
 * панели: там её обновляют вместе с кадрами и объясняют расхождение.
 */
test('#597 собранный лист панели совпадает с замороженным побайтово', () => {
  assert.equal(summaryPanelEditorCss.length, FROZEN_PANEL_CSS.length,
    'длина листа панели изменилась — значит изменился и он сам');
  assert.equal(summaryPanelEditorCss, FROZEN_PANEL_CSS);
  // И фрагменты действительно пришли из набора, а не остались литералами:
  // иначе тест выше сравнивал бы панель сама с собой.
  const source = readFileSync(
    new URL('../src/summary-panel-editor-style.ts', import.meta.url), 'utf8',
  );
  for (const fn of ['formKitCardsCss', 'formKitFocusCss', 'formKitDisabledCss',
    'formKitSwitchRowCss', 'formKitSwitchCaptionCss']) {
    assert.ok(source.includes(`\${${fn}(SUMMARY_PANEL_FORM_KIT)}`),
      `${fn}: панель не подставляет фрагмент набора`);
  }
  // #597 M1 ревью ТЗ: проверять надо отсутствие ВСЕХ пяти фрагментов, а не одной
  // характерной подстроки. `min-height: 54px` встречается только в ряду-
  // переключателе, поэтому литерал, оставленный «на всякий случай» для любого из
  // четырёх остальных, прошёл бы и это правило, и побайтовое сравнение выше:
  // на собранный вывод лишний литерал не влияет, он просто вторая копия.
  for (const [name, fragment] of Object.entries(PANEL_FRAGMENTS)) {
    assert.ok(!source.includes(fragment),
      `${name}: правило осталось литералом в листе панели — копия не устранена`);
  }
});

/**
 * #597 M2. Разрез `sharedCss` на пять функций обязан быть механическим: лист
 * диалогов карточки собирается из тех же фрагментов и не имеет права измениться
 * ни на байт. Фикстуры сняты с `origin/dev` до правки.
 *
 * #600 расширил extras набора до полного референса (ряд-тумблер, плитки, плашка
 * цвета, компас, футер со статусом) — фикстуры пересняты **намеренно** этим же
 * коммитом. Смысл проверки прежний: лист диалогов меняется только тогда, когда
 * это объявлено в issue, а не заодно с правкой панели (К9/AC11 — тест выше).
 */
test('#597/#600 лист диалогов карточки совпадает с объявленным', () => {
  assert.equal(formKitCss(CARD_DIALOG_FORM_KIT, { withSwitch: false }), FROZEN_CARD_KIT_CSS);
  assert.equal(formKitCss(CARD_DIALOG_FORM_KIT), FROZEN_CARD_KIT_WITH_SWITCH_CSS);
});

test('#594 имена параметризованы, а не зашиты', () => {
  const card = formKitCss(CARD_DIALOG_FORM_KIT, { withSwitch: false });
  assert.ok(card.includes('.hpf-card {'), 'карточка набора не переименовалась под префикс карточки');
  assert.ok(card.includes('.hpf-form input:focus-visible'), 'фокус не привязался к форме карточки');
  assert.ok(!card.includes('summary'), 'в лист карточки протекли имена панели');
  assert.ok(!card.includes('-switch'), 'ряды-переключатели попали в граф, где их некому рисовать');
  assert.ok(formKitCss(CARD_DIALOG_FORM_KIT).includes('.hpf-switch'),
    'с включённым флагом ряд-переключатель обязан появляться');
});

test('#594 сегментированный переключатель остаётся радиогруппой', () => {
  const kit = readFileSync(new URL('../src/editors/form-kit.ts', import.meta.url), 'utf8');
  // Только тело `segmented`: дальше в файле есть другие радиогруппы (radioRow,
  // choiceCards), и срез «до конца файла» находил бы `type="radio"` у них,
  // пропуская подмену внутри самого сегмента (мутант
  // form-kit-segment-drops-radio-semantics выживал именно так).
  const from = kit.indexOf('export function segmented');
  const to = kit.indexOf('\nexport ', from + 1);
  const segment = kit.slice(from, to > from ? to : undefined);
  // Доступность здесь не украшение: сегмент заменил радиосписок, и стрелки со
  // скринридером обязаны работать как раньше. Радиокнопка под капотом — это и
  // есть механизм, а не пожелание.
  assert.match(segment, /type="radio"/, 'сегмент перестал быть группой радиокнопок');
  assert.match(segment, /role="radiogroup"/, 'группа потеряла роль для скринридера');
  assert.match(segment, /name=\$\{name\}/, 'радиокнопки перестали делить имя группы');
  const css = formKitCss(CARD_DIALOG_FORM_KIT, { withSwitch: false });
  assert.match(css, /\.hpf-seg label \{[\s\S]*?min-height: 44px;/,
    'цель нажатия сегмента опустилась ниже 44 px');
  assert.match(css, /\.hpf-seg input \{[\s\S]*?opacity: 0;/,
    'радиокнопка перестала быть скрытой — сегмент нарисуется дважды');
});
