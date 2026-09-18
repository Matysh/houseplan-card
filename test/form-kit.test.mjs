import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CARD_DIALOG_FORM_KIT, SUMMARY_PANEL_FORM_KIT, formKitCss,
} from '../test-build/styles/form-kit.styles.js';

/**
 * #594. Набор контролов поднят из редактора боковой панели, и главный вопрос к
 * нему один: общий ли он на самом деле. Ответ обязан быть машинным — с
 * параметрами панели генератор должен выдавать её нынешние правила ДОСЛОВНО.
 * Тогда переезд панели на общий источник (следующий шаг эпика #591) окажется
 * подстановкой, а не редизайном, и её пиксели не дрогнут.
 *
 * Фрагменты ниже скопированы из `src/summary-panel-editor-style.ts` как есть.
 * Тест читает тот же файл и проверяет, что фрагмент всё ещё в нём: иначе
 * «замороженная» фикстура тихо разошлась бы с панелью и сравнивала генератор
 * сама с собой.
 */
const PANEL_STYLE = readFileSync(
  new URL('../src/summary-panel-editor-style.ts', import.meta.url), 'utf8',
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
    assert.ok(PANEL_STYLE.includes(fragment),
      `${name}: фикстура разошлась с листом панели — сверьте src/summary-panel-editor-style.ts`);
    assert.ok(generated.includes(fragment),
      `${name}: генератор с параметрами панели больше не выдаёт её правило дословно`);
  }
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
  const segment = kit.slice(kit.indexOf('export function segmented'));
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
