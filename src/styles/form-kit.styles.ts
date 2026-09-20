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
  /** Имена переменных темы: поверхность, линия, акцент, а для диалогов ещё
   *  канва, приглушённый текст, тинт активного состояния и опасность. */
  tokens: {
    surface: string; line: string; accent: string;
    canvas: string; muted: string; tint: string; tintLine: string; danger: string;
  };
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
    // Панель дополнительных токенов не использует: её лист собирается из общих
    // фрагментов, а extras она не получает. Имена стоят, чтобы тип был полным.
    canvas: '--summary-editor-surface',
    muted: '--secondary-text-color',
    tint: '--summary-editor-surface',
    tintLine: '--summary-editor-line',
    danger: '--error-color',
  },
};

/** Параметры диалогов карточки. */
export const CARD_DIALOG_FORM_KIT: FormKitCssOptions = {
  // `hp-dialog .hpf-form`, а не `.hpf-form`: generic-правила диалогов
  // (`hp-dialog .body { display: flex }`, `hp-dialog .body label { … }`) имеют
  // ту же специфичность, и без тега набор проигрывал бы им на display и подписях.
  form: 'hp-dialog .hpf-form',
  prefix: 'hpf',
  cards: ['.hpf-card'],
  footer: '.hpf-footer',
  tokens: {
    surface: '--hpf-surface',
    line: '--hpf-line',
    accent: '--hpf-accent',
    canvas: '--hpf-canvas',
    muted: '--hpf-muted',
    tint: '--hpf-tint',
    tintLine: '--hpf-tint-line',
    danger: '--hpf-danger',
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
 * Контролы, которых у панели нет (#594, расширено в #600 по референсу
 * `docs/design/600-settings-dialogs/reference/styles.css`).
 *
 * Числа — из §3.1 `SPEC.md` референса; цвета — через переменные темы HA, а не
 * hex прототипа: тёмная тема обязательна. Всё здесь видит только ленивый
 * редакторский граф — панель эти правила не получает (#597 К9).
 */
function extrasCss(options: FormKitCssOptions): string {
  const { form, prefix, tokens } = options;
  const p = prefix;
  return `  ${form} { display: grid; gap: 16px; }
  ${form} label { margin: 0; font-size: inherit; color: inherit; }
  ${form} .${p}-card { padding: 0; overflow: hidden; }
  .${p}-head {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 16px 16px 12px;
  }
  .${p}-head h3 { margin: 0; font-size: 1.25rem; line-height: 1.3; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
  .${p}-body { display: grid; gap: 15px; padding: 0 16px 16px; }
  .${p}-body:first-child { padding-top: 16px; }
  .${p}-sub { display: flex; align-items: center; gap: 4px; min-height: 28px; margin: 7px 0 -3px; }
  .${p}-sub h4 { margin: 0; font-size: 1rem; line-height: 1.4; font-weight: 600; }
  .${p}-field { display: grid; gap: 7px; min-width: 0; }
  .${p}-field > .${p}-label,
  .${p}-labelrow { display: flex; align-items: center; gap: 4px; min-height: 28px; font-size: .875rem; font-weight: 600; color: var(${tokens.muted}); }
  .${p}-labelrow > label { cursor: pointer; }
  .${p}-hint { margin: 0; font-size: .875rem; line-height: 1.5; color: var(${tokens.muted}); }
  .${p}-error { margin: 0; font-size: .875rem; line-height: 1.5; color: var(${tokens.danger}); }
  .${p}-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .${p}-grid.${p}-grid-narrow { grid-template-columns: minmax(0, 1fr) 175px; }
  ${form} .${p}-input,
  ${form} .${p}-select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 8px 10px;
    border: 1px solid var(${tokens.line});
    border-radius: 7px;
    background: var(${tokens.surface});
    color: var(--primary-text-color);
    font: inherit;
    font-size: .875rem;
    line-height: 1.4;
  }
  ${form} .${p}-select {
    appearance: none;
    padding-right: 32px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23888' stroke-width='1.7' stroke-linecap='round'/%3E%3C/svg%3E");
    background-position: right 10px center;
    background-repeat: no-repeat;
    background-size: 12px 7px;
    cursor: pointer;
  }
  ${form} .${p}-input:hover, ${form} .${p}-select:hover { border-color: var(${tokens.muted}); }
  ${form} .${p}-input:focus, ${form} .${p}-select:focus { border-color: var(${tokens.accent}); outline: none; }
  ${form} [aria-invalid="true"] { border-color: var(${tokens.danger}) !important; }
  .${p}-unit { display: inline-flex; align-items: center; height: 44px; border: 1px solid var(${tokens.line}); border-radius: 7px; background: var(${tokens.surface}); }
  .${p}-unit > input { box-sizing: border-box; width: 5.5em; min-width: 5.5em; height: 100%; padding: 8px 9px; border: 0; border-radius: 7px; background: none; color: var(--primary-text-color); font: inherit; font-size: .875rem; font-variant-numeric: tabular-nums; }
  .${p}-unit > input:focus { outline: 0; }
  .${p}-unit > span { padding: 0 11px 0 3px; white-space: nowrap; color: var(${tokens.muted}); font-size: .875rem; }
  .${p}-unit:focus-within { outline: 2px solid var(${tokens.accent}); outline-offset: 2px; }
  .${p}-unit.${p}-unit-wide, .${p}-unit.${p}-unit-wide > input { width: 100%; min-width: 0; }
  .${p}-row {
    display: flex;
    min-width: 0;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .${p}-row > .${p}-label { min-width: 0; overflow-wrap: anywhere; }
  .${p}-toggle {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 44px;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 10px;
    row-gap: 4px;
    min-height: 58px;
    margin: 0;
    padding: 11px 0;
    color: var(--primary-text-color);
    cursor: pointer;
  }
  .${p}-toggle.${p}-noicon { grid-template-columns: minmax(0, 1fr) 44px; }
  .${p}-toggle > .${p}-toggle-icon { grid-column: 1; grid-row: 1; display: flex; align-items: center; justify-content: center; width: 28px; color: var(${tokens.muted}); --mdc-icon-size: 19px; }
  .${p}-toggle > .${p}-toggle-title { grid-row: 1; display: flex; align-items: center; gap: 4px; min-width: 0; min-height: 28px; font-size: .875rem; font-weight: 600; line-height: 1.4; }
  .${p}-toggle > .${p}-toggle-title > span { min-width: 0; overflow-wrap: anywhere; }
  .${p}-toggle > .${p}-toggle-caption { grid-row: 2; margin: 0; font-size: .875rem; line-height: 1.5; color: var(${tokens.muted}); overflow-wrap: anywhere; }
  .${p}-toggle:not(.${p}-noicon) > .${p}-toggle-title, .${p}-toggle:not(.${p}-noicon) > .${p}-toggle-caption { grid-column: 2; }
  .${p}-toggle.${p}-noicon > .${p}-toggle-title, .${p}-toggle.${p}-noicon > .${p}-toggle-caption { grid-column: 1; }
  .${p}-toggle > input { grid-column: -2; grid-row: 1 / 3; align-self: center; }
  .${p}-toggle.${p}-compact { grid-template-rows: auto; min-height: 40px; padding: 2px 0; }
  .${p}-toggle.${p}-compact > .${p}-toggle-title { font-weight: 500; min-height: 24px; }
  .${p}-toggle.${p}-compact > .${p}-toggle-icon { --mdc-icon-size: 18px; }
  .${p}-toggle:has(input:disabled) { cursor: default; }
  .${p}-toggle:has(input:disabled) > .${p}-toggle-title, .${p}-toggle:has(input:disabled) > .${p}-toggle-caption { opacity: .65; }
  .${p}-compact-list { display: grid; gap: 2px; }
  .${p}-toggle > input {
    appearance: none;
    position: relative;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .${p}-toggle > input::before {
    content: '';
    position: absolute;
    width: 36px;
    height: 22px;
    inset: 11px 4px;
    border: 1px solid var(${tokens.line});
    border-radius: 12px;
    background: color-mix(in srgb, var(${tokens.surface}) 65%, var(${tokens.muted}));
  }
  .${p}-toggle > input::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    top: 14px;
    left: 7px;
    border-radius: 50%;
    background: var(--text-primary-color, #fff);
    box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
    transition: left .15s;
  }
  .${p}-toggle > input:checked::before { background: var(${tokens.accent}); border-color: var(${tokens.accent}); }
  .${p}-toggle > input:checked::after { left: 21px; }
  .${p}-toggle > input:disabled { cursor: default; }
  .${p}-toggle > input:disabled::before { opacity: .4; }
  .${p}-seg {
    display: flex;
    min-width: 0;
    gap: 3px;
    padding: 3px;
    border: 1px solid var(${tokens.line});
    border-radius: 7px;
    background: var(${tokens.canvas});
  }
  .${p}-seg label {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 38px;
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 4px 5px;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(${tokens.muted});
    font-size: .875rem;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    overflow-wrap: anywhere;
  }
  .${p}-seg input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; pointer-events: none; }
  .${p}-seg label:has(input:checked) {
    background: var(${tokens.tint});
    border-color: var(${tokens.tintLine});
    color: var(${tokens.accent});
  }
  .${p}-seg label:has(input:focus-visible) {
    outline: 2px solid var(${tokens.accent});
    outline-offset: 1px;
  }
  .${p}-seg[aria-disabled="true"] { opacity: .5; }
  .${p}-seg .${p}-line { width: 25px; border-top: 2px solid currentColor; }
  .${p}-seg .${p}-line-dashed { border-top-style: dashed; }
  .${p}-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .${p}-tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 72px;
    padding: 10px 6px 9px;
    border: 1px solid var(${tokens.line});
    border-radius: 8px;
    background: var(${tokens.surface});
    color: var(${tokens.muted});
    cursor: pointer;
    text-align: center;
    user-select: none;
    --mdc-icon-size: 22px;
  }
  .${p}-tile input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
  .${p}-tile > span { font-size: .875rem; font-weight: 500; line-height: 1.25; }
  .${p}-tile:has(input:checked) { background: var(${tokens.tint}); border-color: var(${tokens.tintLine}); color: var(${tokens.accent}); }
  .${p}-tile:has(input:focus-visible) { outline: 2px solid var(${tokens.accent}); outline-offset: 2px; }
  .${p}-tile:has(input:disabled) { opacity: .45; cursor: default; }
  .${p}-tile:has(input:disabled) input { cursor: default; }
  .${p}-colortiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .${p}-colortile { display: grid; gap: 6px; min-width: 0; padding: 6px 6px 7px; border: 1px solid var(${tokens.line}); border-radius: 8px; background: var(${tokens.surface}); }
  .${p}-colortile > .${p}-colortile-swatch { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 3px 8px 3px 3px; border: 1px solid var(${tokens.line}); border-radius: 6px; font-size: .875rem; font-weight: 500; line-height: 1.25; }
  .${p}-colortile > .${p}-colortile-swatch > span { min-width: 0; overflow-wrap: anywhere; }
  .${p}-colortile > .${p}-colortile-swatch > hp-color-opacity { flex: none; }
  .${p}-colortile-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .${p}-colortile-meta .${p}-hex { font-size: .8125rem; }
  .${p}-colortile-meta .${p}-unit { height: 32px; }
  .${p}-colortile-meta .${p}-unit > input { width: 3.2em; min-width: 3em; padding: 4px 4px 4px 7px; font-size: .8125rem; }
  .${p}-colortile-meta .${p}-unit > span { padding: 0 7px 0 0; font-size: .8125rem; }
  .${p}-colorfield {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    width: fit-content;
    max-width: 100%;
    min-height: 44px;
    padding: 3px 10px 3px 3px;
    border: 1px solid var(${tokens.line});
    border-radius: 9px;
    background: var(${tokens.canvas});
  }
  .${p}-colorfield > hp-color-opacity { flex: 0 0 auto; }
  .${p}-hex { font-size: .875rem; color: var(${tokens.muted}); font-variant-numeric: tabular-nums; }
  .${p}-colorfield > .${p}-opacity { display: flex; align-items: center; gap: 8px; font-size: .875rem; color: var(${tokens.muted}); }
  .${p}-colorfield > .${p}-opacity > .${p}-unit { height: 38px; }
  .${p}-colorfield > .${p}-opacity > .${p}-unit > input { width: 4em; min-width: 4em; }
  .${p}-colorrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 16px; min-height: 56px; }
  .${p}-colorrow > .${p}-colorfield { justify-self: end; }
  .${p}-colorrow > .${p}-labelrow { min-height: 0; }
  .${p}-link { padding: 5px 0; border: 0; background: none; color: var(${tokens.accent}); font: inherit; font-size: .875rem; font-weight: 500; cursor: pointer; }
  .${p}-link:disabled { opacity: .5; cursor: default; }
  .${p}-inline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .${p}-inline > .${p}-labelrow { flex: 1 1 auto; }
  .${p}-inline > .${p}-select { width: auto; flex: 0 0 auto; min-width: 200px; }
  .${p}-inline.${p}-wrap { flex-wrap: wrap; row-gap: 6px; }
  .${p}-radios { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-left: auto; }
  .${p}-radios label { display: inline-flex; align-items: center; gap: 7px; min-height: 28px; font-size: .875rem; cursor: pointer; white-space: nowrap; }
  .${p}-radios input { width: 16px; height: 16px; margin: 0; accent-color: var(${tokens.accent}); cursor: pointer; }
  .${p}-radios label:has(input:checked) { color: var(${tokens.accent}); }
  .${p}-callout {
    display: flex;
    gap: 8px;
    margin: 0;
    padding: 11px 12px;
    border-radius: 8px;
    background: var(${tokens.tint});
    color: var(--primary-text-color);
    font-size: .875rem;
    line-height: 1.6;
  }
  .${p}-callout > ha-icon { flex: none; margin-top: 2px; --mdc-icon-size: 16px; color: var(${tokens.accent}); }
  .${p}-callout > p, .${p}-callout > span { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .${p}-callout.${p}-warning { background: color-mix(in srgb, var(--warning-color, #ff9800) 14%, var(${tokens.surface})); }
  .${p}-callout.${p}-warning > ha-icon { color: var(--warning-color, #ff9800); }
  .${p}-callout .${p}-link { padding: 0; font-weight: 600; }
  .${p}-range { display: flex; align-items: center; gap: 15px; }
  .${p}-range > input[type="range"], .${p}-range > ha-slider { flex: 1 1 auto; min-width: 0; accent-color: var(${tokens.accent}); }
  .${p}-range > .${p}-unit { flex: 0 0 auto; }
  .${p}-range > .${p}-unit > input { width: 5.8em; min-width: 5.8em; }
  .${p}-range-ends { display: flex; justify-content: space-between; padding-right: 122px; margin-top: -8px; font-size: .875rem; color: var(${tokens.muted}); }
  .${p}-headline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .${p}-north { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 7px 16px; align-items: center; }
  .${p}-north > .${p}-labelrow { grid-area: 1 / 1; min-height: 28px; }
  .${p}-north > .${p}-select, .${p}-north > .${p}-unit, .${p}-north > .${p}-input { grid-area: 2 / 1; }
  .${p}-north > .${p}-north-n { grid-area: 1 / 2; text-align: center; font-size: .875rem; line-height: 28px; color: var(${tokens.muted}); }
  .${p}-compass { grid-area: 2 / 2; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid var(${tokens.line}); border-radius: 50%; background: var(${tokens.canvas}); color: var(${tokens.accent}); }
  .${p}-compass svg { width: 24px; height: 24px; transform-origin: 50% 50%; transform-box: view-box; }
  .${p}-compass.${p}-unset { color: var(${tokens.muted}); }
  .${p}-tint { padding: 14px; border: 1px solid var(${tokens.tintLine}); border-radius: 9px; background: var(${tokens.tint}); }
  .${p}-tint-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
  .${p}-tint-head h4 { margin: 0; font-size: 1rem; font-weight: 600; }
  .${p}-tag { padding: 3px 10px; border-radius: 12px; background: color-mix(in srgb, var(${tokens.accent}) 18%, var(${tokens.surface})); color: var(${tokens.muted}); font-size: .8125rem; }
  .${p}-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .${p}-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 4px 0 10px; border: 1px solid var(${tokens.tintLine}); border-radius: 18px; background: var(${tokens.tint}); color: var(${tokens.accent}); font-size: .875rem; font-weight: 500; }
  .${p}-chip > ha-icon { --mdc-icon-size: 16px; }
  .${p}-chip > button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; --mdc-icon-size: 14px; }
  .${p}-chip > button:hover { background: color-mix(in srgb, var(${tokens.accent}) 15%, transparent); }
  .${p}-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .${p}-choice { position: relative; display: flex; flex-direction: column; justify-content: center; gap: 5px; min-width: 0; min-height: 80px; padding: 13px 35px 13px 12px; border: 1px solid var(${tokens.line}); border-radius: 8px; cursor: pointer; }
  .${p}-choice input { position: absolute; right: 12px; top: 16px; width: 16px; height: 16px; margin: 0; accent-color: var(${tokens.accent}); }
  .${p}-choice:has(input:checked) { background: var(${tokens.tint}); border-color: var(${tokens.tintLine}); }
  .${p}-choice strong { font-size: .875rem; font-weight: 600; }
  .${p}-choice small { font-size: .875rem; line-height: 1.5; color: var(${tokens.muted}); }
  .${p}-status { display: flex; align-items: center; gap: 6px; min-width: 0; margin-left: 8px; font-size: .875rem; color: var(${tokens.muted}); }
  .${p}-status > .${p}-link { color: var(--warning-color, #b87940); }
  .${p}-divider { border: 0; border-top: 1px solid var(${tokens.line}); margin: 4px 0; }
  @media (max-width: 480px) {
    .${p}-body { padding: 0 14px 14px; }
    .${p}-head { padding: 14px 14px 12px; }
    .${p}-grid, .${p}-grid.${p}-grid-narrow, .${p}-choices { grid-template-columns: minmax(0, 1fr); }
    .${p}-tiles, .${p}-colortiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .${p}-colorrow { grid-template-columns: minmax(0, 1fr); }
    .${p}-colorrow > .${p}-colorfield { justify-self: start; }
    .${p}-inline { flex-direction: column; align-items: stretch; gap: 7px; }
    .${p}-inline > .${p}-select { width: 100%; }
    .${p}-radios { margin-left: 0; }
    .${p}-seg { flex-wrap: wrap; }
    .${p}-seg label { flex-basis: 42%; }
    .${p}-range-ends { padding-right: 125px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .${p}-toggle > input::after { transition: none; }
  }
  @media (forced-colors: active) {
    ${form} .${p}-select { appearance: auto; background-image: none; padding-right: 10px; }
  }`;
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
    /* Канва без темы: на 10 % ближе к тексту, чем карточка, — светлая тема
       даёт серый, тёмная — чуть светлее карточки. HA всегда задаёт свою. */
    --hpf-canvas: var(--secondary-background-color, color-mix(in srgb, var(--hpf-surface) 90%, var(--primary-text-color, #000)));
    --hpf-muted: var(--secondary-text-color, #777);
    --hpf-tint: color-mix(in srgb, var(--hpf-accent) 10%, var(--hpf-surface));
    --hpf-tint-line: color-mix(in srgb, var(--hpf-accent) 38%, var(--hpf-surface));
    --hpf-danger: var(--error-color, #db543d);
  }
`;
