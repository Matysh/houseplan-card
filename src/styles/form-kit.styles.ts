/**
 * Общий набор контролов формы (#594, шаг 1 эпика #591).
 *
 * Правила ряда-переключателя, карточки-группы, фокуса и выключенного состояния
 * взяты из редактора боковой панели (`summary-panel-editor-style.ts`): он сделан
 * по макетам дизайнера и уже живёт в продукте. Чтобы «общий» не оказался общим
 * на словах, набор параметризован именами — контейнер формы, префикс классов,
 * карточки, футер и токены цвета, — и обязан воспроизводить текст панели
 * дословно (проверяется замороженной фикстурой в `test/form-kit.test.mjs`).
 *
 * Возвращается строка, а не тег `css`: лист панели вклеивается в ленивый sheet
 * строкой, а карточка вносит тот же текст через `unsafeCSS`. Один источник —
 * два потребителя.
 */

export interface FormKitCssOptions {
  /** Класс контейнера формы: `.summary-editor` у панели, `.hpf-form` у диалогов. */
  form: string;
  /** Префикс частей: `summary` даёт `.summary-switch`, `hpf` — `.hpf-switch`. */
  prefix: string;
  /** Селекторы карточек-групп: у панели их два, у диалогов один. */
  cards: readonly string[];
  /** Класс футера — его кнопки получают ту же обводку фокуса. */
  footer: string;
  /** Имена переменных темы: поверхность, линия, акцент. */
  tokens: { surface: string; line: string; accent: string };
}

/** Параметры панели: с ними генератор обязан вернуть её нынешние правила. */
export const SUMMARY_PANEL_FORM_KIT: FormKitCssOptions = {
  form: '.summary-editor',
  prefix: 'summary',
  cards: ['.summary-general', '.summary-blocks-card'],
  footer: '.summary-editor-footer',
  tokens: {
    surface: '--summary-editor-surface',
    line: '--summary-editor-line',
    accent: '--summary-editor-accent',
  },
};

/** Параметры диалогов карточки. */
export const CARD_DIALOG_FORM_KIT: FormKitCssOptions = {
  form: '.hpf-form',
  prefix: 'hpf',
  cards: ['.hpf-card'],
  footer: '.hpf-footer',
  tokens: {
    surface: '--hpf-surface',
    line: '--hpf-line',
    accent: '--hpf-accent',
  },
};

/**
 * Правила, общие с панелью, — по одному фрагменту на правило (#597).
 *
 * Разрезано не ради красоты: в листе панели эти правила НЕ идут подряд, между
 * ними стоят её собственные (`button { font: inherit }`, `svg { … }`). Пока
 * генератор отдавал их одним куском, переезд панели на общий источник требовал
 * бы переставить её объявления — то есть переписать каскад под инструмент.
 * Отдельные фрагменты позволяют подставить каждый ровно туда, где он стоит
 * сейчас, и собранный лист совпадает с прежним побайтово.
 */
export function formKitCardsCss({ cards, tokens }: FormKitCssOptions): string {
  return `  ${cards.join(',\n  ')} {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(${tokens.line});
    border-radius: 11px;
    background: var(${tokens.surface});
  }`;
}

/** Обводка фокуса формы и её футера. */
export function formKitFocusCss({ form, footer, tokens }: FormKitCssOptions): string {
  return `  ${form} input:focus-visible,
  ${form} select:focus-visible,
  ${form} button:focus-visible,
  ${footer} button:focus-visible {
    outline: 2px solid var(${tokens.accent});
    outline-offset: 2px;
  }`;
}

/** Выключенные контролы. */
export function formKitDisabledCss({ form }: FormKitCssOptions): string {
  return `  ${form} button:disabled,
  ${form} input:disabled,
  ${form} select:disabled { opacity: .4; cursor: default; }`;
}

/** Ряд-переключатель: подпись слева, переключатель справа. */
export function formKitSwitchRowCss({ form, prefix }: FormKitCssOptions): string {
  return `  ${form} .${prefix}-switch {
    display: flex;
    min-width: 0;
    min-height: 54px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
    color: var(--primary-text-color);
    cursor: pointer;
  }`;
}

/** Подпись ряда-переключателя: заголовок и пояснение мелким шрифтом. */
export function formKitSwitchCaptionCss({ prefix }: FormKitCssOptions): string {
  return `  .${prefix}-switch-caption { display: grid; min-width: 0; gap: 3px; }
  .${prefix}-switch-caption strong { font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
  .${prefix}-switch-caption small { font-size: .8125rem; color: var(--secondary-text-color); overflow-wrap: anywhere; }`;
}

/** Все общие правила подряд — так их берут диалоги карточки. */
function sharedCss(options: FormKitCssOptions, withSwitch: boolean): string {
  const switchRules = !withSwitch ? '' : `\n${formKitSwitchRowCss(options)}\n${formKitSwitchCaptionCss(options)}`;
  return `${formKitCardsCss(options)}\n${formKitFocusCss(options)}\n${formKitDisabledCss(options)}${switchRules}`;
}

/**
 * Контролы, которых у панели нет: заголовок группы со справкой, сегментированный
 * переключатель и строка цвета. Сегмент — настоящая группа радиокнопок: стрелки
 * и Tab обязаны работать так же, как в списке, который он заменил (#594 К7).
 */
function extrasCss(options: FormKitCssOptions): string {
  const { form, prefix, tokens } = options;
  return `  ${form} { display: grid; gap: 12px; }
  .${prefix}-head {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 0 0 10px;
  }
  .${prefix}-head h3 { margin: 0; font-size: 1rem; line-height: 1.3; font-weight: 600; }
  .${prefix}-row {
    display: flex;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .${prefix}-row > .${prefix}-label { min-width: 0; overflow-wrap: anywhere; }
  .${prefix}-seg {
    display: flex;
    min-width: 0;
    border: 1px solid var(${tokens.line});
    border-radius: 9px;
    overflow: hidden;
  }
  .${prefix}-seg label {
    display: flex;
    min-width: 0;
    min-height: 44px;
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 12px;
    cursor: pointer;
    text-align: center;
  }
  .${prefix}-seg label + label { border-left: 1px solid var(${tokens.line}); }
  .${prefix}-seg input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .${prefix}-seg label:has(input:checked) {
    background: var(${tokens.accent});
    color: var(--text-primary-color, #fff);
  }
  .${prefix}-seg label:has(input:focus-visible) {
    outline: 2px solid var(${tokens.accent});
    outline-offset: -2px;
  }
  .${prefix}-color { display: flex; min-width: 0; align-items: center; gap: 12px; }
  .${prefix}-color hp-color-opacity { flex: 0 0 auto; }`;
}

/**
 * Лист набора для заданных имён.
 *
 * `withSwitch` выключается там, где рядов-переключателей ещё нет: диалог комнаты
 * их не содержит, а мёртвые правила в синхронном графе стоят байтов. Панель
 * получает их всегда — её ряд и есть образец, с которым сверяется фикстура.
 */
export function formKitCss(
  options: FormKitCssOptions, { withSwitch = true }: { withSwitch?: boolean } = {},
): string {
  return `${sharedCss(options, withSwitch)}\n${extrasCss(options)}\n`;
}

/** Токены темы для диалогов карточки: у панели свои, у карточки — эти. */
export const cardDialogFormKitTokens = `  hp-dialog .hpf-form {
    --hpf-surface: var(--card-background-color, #fff);
    --hpf-line: var(--hp-line, var(--divider-color, #dce5e7));
    --hpf-accent: var(--hp-accent, var(--primary-color));
  }
`;
