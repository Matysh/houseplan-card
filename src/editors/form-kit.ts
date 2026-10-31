/**
 * Разметка общего набора контролов формы (#594, шаг 1 эпика #591; расширен в
 * #600 до полного набора референса `docs/design/600-settings-dialogs/`).
 *
 * Контролы ничего не знают о конкретном диалоге: на вход подпись, значение,
 * обработчик и опции — на выход `TemplateResult`. Состояние остаётся на хосте,
 * как и у вынесенных диалогов (#592 К2).
 *
 * Стили — в `src/styles/form-kit.styles.ts`; имена классов там и здесь связаны
 * префиксом `hpf`. Каждый примитив соответствует поверхности из §3.1 `SPEC.md`
 * референса; расхождение с ним — находка, а не вкус.
 */
import { html, nothing, type TemplateResult } from 'lit';

import { colorTileInk } from './color-tile-ink';
import { sourcePickerOverlay } from './source-picker-overlay';
import { disclosureMotion } from './disclosure-motion';

export { ensureFormKitStyles, type FormKitStyleHost } from '../form-kit-styles';

export interface FormCardOptions {
  /** Заголовок группы. Пустой заголовок — карточка без шапки. */
  title?: string;
  /** Кнопка «?» — уже готовый `hp-help` от вызывающего. */
  help?: TemplateResult | typeof nothing;
  /** Содержимое карточки. */
  body: TemplateResult | readonly (TemplateResult | typeof nothing)[];
  /** Машинное имя карточки для смоков и парных кадров (`data-card`). */
  id?: string;
}

export type FormSectionContent = TemplateResult | typeof nothing | null | undefined | false | readonly FormSectionContent[];

function sectionHasContent(content: FormSectionContent): boolean {
  return Array.isArray(content) ? content.some(sectionHasContent)
    : content !== nothing && content != null && content !== false;
}

/** Keep the original identity while omitting empty conditional groups. */
export function formSectionEntries(sections: readonly FormSectionContent[]): { content: FormSectionContent; index: number }[] {
  return sections.map<{ content: FormSectionContent; index: number }>((content, index) => ({ content, index }))
    .filter(({ content }) => sectionHasContent(content));
}

/** Explicit sections: omission never leaves an empty separator. Stable indexes
 * keep sibling controls mounted when a conditional section disappears. Group
 * a heading and its fields in one template; do not style their outer margins.
 */
export function formSections(sections: readonly FormSectionContent[], { dividers = true }: { dividers?: boolean } = {}): TemplateResult {
  // Preserve one Lit child part per source position. Omitting a section clears
  // that part instead of shifting the following controls to another identity.
  const content: (TemplateResult | typeof nothing)[] = Array(sections.length).fill(nothing);
  for (const entry of formSectionEntries(sections)) content[entry.index] = html`<div class="hpf-section">${entry.content}</div>`;
  return html`<div class=${dividers ? 'hpf-sections' : 'hpf-sections hpf-sections-plain'}>${content}</div>`;
}

/** Sibling Help has its own hover and activation zone. */
export function actionHelp(action: TemplateResult, help?: TemplateResult | typeof nothing): TemplateResult {
  return html`<span class="hpf-action-help">${action}${help ?? nothing}</span>`;
}

export interface DisclosureOptions {
  title: string;
  content: TemplateResult;
  id?: string;
  className?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  help?: TemplateResult | typeof nothing;
  /** A picker trigger may use the existing action paint; information does not. */
  triggerClass?: string;
  action?: string;
}

/** Informational disclosure, distinct from an action button. */
export function disclosure({ title, content, id, className = '', open, onToggle, help, triggerClass = '', action }: DisclosureOptions): TemplateResult {
  const details = html`<details class="hpf-disclosure ${className}" id=${id ?? nothing} ${disclosureMotion(open, onToggle)}>
    <summary class=${triggerClass} data-hp=${action ? 'action' : nothing} data-action=${action ?? nothing}>${title}</summary><div class="hpf-disclosure-content"><div class="hpf-disclosure-inner">${content}</div></div>
  </details>`;
  return help && help !== nothing
    ? html`<div class="hpf-disclosure-with-help">${details}${help}</div>` : details;
}

/**
 * Карточка-группа: подложка, заголовок и справка рядом с ним (§3.1 «Тело»).
 * Заголовок — `h3`, подзаголовки внутри — `h4` (`subsection`): уровни
 * вложены, как и в референсе (h2 → h3), только на ступень ниже, потому что
 * заголовок диалога уже занимает верхний.
 */
export function formCard({ title, help, body, id }: FormCardOptions): TemplateResult {
  return html`<section class="hpf-card" data-card=${id ?? nothing}>
    ${title
      ? html`<div class="hpf-head"><h3>${title}</h3>${help ?? nothing}</div>`
      : nothing}
    <div class="hpf-body">${body}</div>
  </section>`;
}

/** Подзаголовок группы внутри карточки (§3.1 «Подзаголовки»): 16/600 + «?». */
export function subsection({ title, help }: { title: string; help?: TemplateResult | typeof nothing }): TemplateResult {
  return html`<div class="hpf-sub"><h4>${title}</h4>${help ?? nothing}</div>`;
}

export interface FieldOptions {
  label: string;
  /** `id` контрола — подпись становится `<label for>`. */
  htmlFor?: string;
  help?: TemplateResult | typeof nothing;
  control: TemplateResult | typeof nothing;
  /** Подсказка под контролом (§3.1 «Поля»: 14 px, приглушённая). */
  hint?: string | TemplateResult | typeof nothing;
  /** Текст ошибки; при наличии подпись и контрол помечаются. */
  error?: string | typeof nothing;
}

/** Поле: подпись сверху, контрол, подсказка или ошибка снизу. */
export function field({ label, htmlFor, help, control, hint, error }: FieldOptions): TemplateResult {
  return html`<div class="hpf-field">
    <span class="hpf-label hpf-labelrow ${!htmlFor && help ? 'hpf-inline-help' : ''}">${htmlFor ? html`<label for=${htmlFor}>${label}</label>` : helpLabel(label, help)}${htmlFor ? help ?? nothing : nothing}</span>
    ${control}
    ${error ? html`<p class="hpf-error" role="alert">${error}</p>` : hint ? html`<p class="hpf-hint">${hint}</p>` : nothing}
  </div>`;
}

/** Сетка полей: две равные колонки или `1fr / 175px` (`narrow`). */
export function fieldGrid(
  children: readonly (TemplateResult | typeof nothing)[], { narrow = false, stacked = false }: { narrow?: boolean; stacked?: boolean } = {},
): TemplateResult {
  return html`<div class="hpf-grid ${narrow ? 'hpf-grid-narrow' : ''}${stacked ? ' hpf-grid-stacked' : ''}">${stacked ? formSections(children) : children}</div>`;
}

export interface ToggleRowOptions {
  /** mdi-иконка слева (§3.2 «Иконки строк»); без неё строка узкая. */
  icon?: string;
  title: string;
  caption?: string | TemplateResult;
  help?: TemplateResult | typeof nothing;
  checked: boolean;
  disabled?: boolean;
  /** Компактная строка для однотипных списков (§3.1 «Компактная строка»). */
  compact?: boolean;
  /** Event lets an ACK-only owner restore the accepted native input value. */
  onChange: (checked: boolean, event?: Event) => void;
  /** `id` чекбокса — для смоков и `aria-describedby`. */
  id?: string;
  /** An always-visible status may describe a switch without becoming its caption. */
  describedBy?: string;
  /** Test metadata must not create a new DOM id or label association. */
  fieldId?: string;
  fieldSlot?: number;
}

/** Keep contextual help on the final text line, never on an empty line. */
export function helpLabel(label: string, help?: TemplateResult | typeof nothing): TemplateResult {
  if (!help || help === nothing) return html`<span>${label}</span>`;
  const tail = label.lastIndexOf(' ') + 1;
  return html`<span>${label.slice(0, tail)}</span><span class="hpf-label-tail"><span>${label.slice(tail)}</span>${help}</span>`;
}

/**
 * Полная строка настройки (§3.1): иконка · название + «?» · подпись · тумблер
 * справа. Тумблер — нативный чекбокс, нарисованный CSS, как у редактора
 * панели: один и тот же вид в HA, на стенде и в golden, и `input[type=checkbox]`
 * остаётся тем, что смоки умеют переключать.
 */
export function toggleRow({
  icon, title, caption, help, checked, disabled = false, compact = false, onChange, id, describedBy, fieldId = id, fieldSlot,
}: ToggleRowOptions): TemplateResult {
  const captionId = id && caption ? `${id}-caption` : undefined;
  return html`<label class="hpf-toggle ${icon ? '' : 'hpf-noicon'} ${compact ? 'hpf-compact' : ''}">
    ${icon ? html`<span class="hpf-toggle-icon" aria-hidden="true"><ha-icon icon=${icon}></ha-icon></span>` : nothing}
    <span class="hpf-toggle-title">${helpLabel(title, help)}</span>
    ${caption && !compact ? html`<span class="hpf-toggle-caption" id=${captionId ?? nothing}>${caption}</span>` : nothing}
    <input data-hp="field" data-field=${fieldId ?? nothing} data-slot=${fieldSlot ?? nothing} type="checkbox" id=${id ?? nothing} .checked=${checked} ?disabled=${disabled}
      aria-label=${title} aria-describedby=${describedBy ?? captionId ?? nothing}
      @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked, e)} />
  </label>`;
}

/** Список компактных строк без разделителей. */
export function compactList(rows: readonly TemplateResult[]): TemplateResult {
  return html`<div class="hpf-compact-list">${rows}</div>`;
}

export interface FormRowOptions {
  label: string;
  control: TemplateResult | typeof nothing;
  /** Действие справа от контрола — например «Сбросить». */
  action?: TemplateResult | typeof nothing;
}

/** Однострочный ряд: подпись слева, контрол справа. */
export function formRow({ label, control, action }: FormRowOptions): TemplateResult {
  return html`<div class="hpf-row">
    <span class="hpf-label">${label}</span>
    ${control}${action ?? nothing}
  </div>`;
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Образец линии слева от подписи (стиль нулевых стен). */
  sample?: 'dashed' | 'solid';
  /** mdi-иконка слева от подписи. */
  icon?: string;
  /** Отключённый вариант при живой группе (режим свечения без источника). */
  disabled?: boolean;
  /** `aria-describedby` варианта — ссылка на объяснение, почему он отключён. */
  describedBy?: string;
}

export interface SegmentedOptions<T extends string> {
  /** Имя группы радиокнопок — общее для всех вариантов. */
  name: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Доступное имя группы для скринридера. */
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Сегментированный переключатель.
 *
 * Под капотом — обычная группа радиокнопок, и это не деталь реализации, а
 * требование: стрелки, Tab и объявление скринридером обязаны работать так же,
 * как в списке, который сегмент заменил (#594 К7). Визуальная форма живёт в
 * CSS, семантика — в разметке.
 */
export function segmented<T extends string>({
  name, value, options, onChange, ariaLabel, disabled = false,
}: SegmentedOptions<T>): TemplateResult {
  return html`<div class="hpf-seg" role="radiogroup" aria-label=${ariaLabel ?? nothing}
      aria-disabled=${disabled ? 'true' : nothing}>
    ${options.map((option) => html`<label>
      <input data-hp="field" data-field=${name} data-value=${option.value} type="radio" name=${name} value=${option.value} .checked=${option.value === value}
        ?disabled=${disabled || !!option.disabled} aria-describedby=${option.describedBy ?? nothing}
        @change=${() => onChange(option.value)} />
      ${option.sample ? html`<span class="hpf-line ${option.sample === 'dashed' ? 'hpf-line-dashed' : ''}" aria-hidden="true"></span>` : nothing}
      ${option.icon ? html`<ha-icon icon=${option.icon} aria-hidden="true"></ha-icon>` : nothing}
      <span>${option.label}</span>
    </label>`)}
  </div>`;
}

export { selectControl } from '../settings-select-control';

export interface ValueTile {
  label: string;
  icon: string;
  checked: boolean;
  disabled?: boolean;
  /** Полное имя для `title` и `aria-label`, если подпись сокращена. */
  title?: string;
  onChange: (checked: boolean) => void;
  id?: string;
}

/**
 * Плитки значений (§3.1): четыре колонки, иконка сверху, подпись снизу;
 * каждая — `label` со скрытым чекбоксом, так что клавиатура и скринридер
 * работают как у списка чекбоксов, который плитки заменили.
 */
export function valueTiles(tiles: readonly ValueTile[], ariaLabel?: string): TemplateResult {
  return html`<div class="hpf-tiles" role="group" aria-label=${ariaLabel ?? nothing}>
    ${tiles.map((tile) => html`<label class="hpf-tile" title=${tile.title ?? nothing}>
      <input data-hp="field" data-field=${tile.id ?? nothing} type="checkbox" id=${tile.id ?? nothing} .checked=${tile.checked} ?disabled=${tile.disabled}
        aria-label=${tile.title ?? tile.label}
        @change=${(e: Event) => tile.onChange((e.target as HTMLInputElement).checked)} />
      <ha-icon icon=${tile.icon} aria-hidden="true"></ha-icon>
      <span>${tile.label}</span>
    </label>`)}
  </div>`;
}

export interface ColorFieldOptions {
  /** Готовый `hp-color-opacity` от вызывающего: компонент не подменяется (Q5). */
  picker: TemplateResult;
  /** Текущий цвет `#rrggbb` — печатается рядом со свотчем. */
  hex: string;
  /** Semantic colour token such as “No fill”, without changing the stored HEX. */
  valueLabel?: string;
  /** Прозрачность 0–1; `undefined` — поле без прозрачности. */
  opacity?: number;
  opacityLabel?: string;
  /** An image group has alpha but no common colour channel. */
  alphaOnly?: boolean;
  inputs?: {
    name: string; hex: string; opacity: string; hexLabel: string;
    placeholder?: string;
    hexInvalid: boolean; opacityInvalid: boolean;
    onHex(raw: string): void; onOpacity(raw: string): void;
  };
  /** Текстовая ссылка «Сбросить»; `undefined` — без сброса. */
  resetLabel?: string;
  onReset?: () => void;
  disabled?: boolean;
}

/**
 * Компактная плашка цвета (§3.1 «Поле цвета», решение владельца Q5): свотч —
 * это trigger существующего `hp-color-opacity` и открывает его панель; рядом
 * hex, число прозрачности и Reset. Нативного `input[type=color]` здесь нет и
 * не будет: `nativeColors() === 0` — контракт со свидетелем.
 */
export function colorField({
  picker, hex, valueLabel, opacity, opacityLabel, alphaOnly = false, inputs, resetLabel, onReset, disabled = false,
}: ColorFieldOptions): TemplateResult {
  const pct = opacity === undefined ? null : Math.round(Math.min(1, Math.max(0, opacity)) * 100);
  return html`<div class="hpf-colorfield">
    ${picker}
    ${alphaOnly ? nothing : inputs ? html`<input class="hpf-inline-hex" data-hp="field" data-field=${`${inputs.name}-hex`} id=${`hp-property-${inputs.name}-hex`} type="text" spellcheck="false" autocomplete="off" maxlength="7" placeholder=${inputs.placeholder ?? nothing}
      .value=${inputs.hex} ?disabled=${disabled} aria-label=${inputs.hexLabel} aria-invalid=${String(inputs.hexInvalid)}
      @input=${(event: Event) => inputs.onHex((event.target as HTMLInputElement).value)} />`
      : html`<code class="hpf-hex">${valueLabel ?? hex.toUpperCase()}</code>`}
    ${pct === null ? nothing : inputs ? html`<span class="hpf-opacity hpf-inline-opacity">
      <span class="hpf-unit"><input data-hp="field" data-field=${`${inputs.name}-opacity`} type="number" inputmode="numeric" min="0" max="100" step="1"
        class="hpf-inline-alpha" .value=${inputs.opacity} placeholder=${inputs.placeholder ?? nothing} ?disabled=${disabled} aria-label=${opacityLabel ?? 'Opacity'}
        aria-invalid=${String(inputs.opacityInvalid)}
        @input=${(e: Event) => inputs.onOpacity((e.target as HTMLInputElement).value)} /><span>%</span></span></span>` : html`<span class="hpf-opacity" aria-label=${opacityLabel ?? nothing}>${pct}%</span>`}
    ${resetLabel && onReset ? html`<button data-hp="action" data-action="colour-reset" class="hpf-link" type="button" ?disabled=${disabled} @click=${onReset}>${resetLabel}</button>` : nothing}
  </div>`;
}

export interface ColorTileOptions {
  label: string;
  /** Settings v10: a separate heading keeps labels readable at every alpha. */
  heading?: TemplateResult;
  /** Текущий цвет `#rrggbb` — фон плитки и печать hex. */
  hex: string;
  opacity: number;
  opacityLabel: string;
  /** Готовый `hp-color-opacity` (Q5): свотч открывает существующую панель. */
  picker: TemplateResult;
}

export { isLightHex } from './color-tile-ink';

/**
 * Плитка цвета (§3.1 «Плитки цвета»): название поверх свотча на всю ширину,
 * ниже hex и число прозрачности. Свотч — trigger существующего пикера.
 *
 * #615: поверхность рисует сам trigger (`cover-swatch`) — шахматка и цвет
 * поверх неё с непрозрачностью α, поэтому у обёртки своего фона нет. Подпись
 * выбирается по видимому цвету (`colorTileInk`), а не по одному `hex`.
 */
export function colorTile({ label, heading, hex, opacity, opacityLabel, picker }: ColorTileOptions): TemplateResult {
  const pct = Math.round(Math.min(1, Math.max(0, opacity)) * 100);
  return html`<div class="hpf-colortile ${heading ? 'hpf-colortile-labelled' : ''}">
    ${heading ? html`<div class="hpf-colortile-heading">${heading}</div>` : nothing}
    <div class="hpf-colortile-swatch" style=${`color:${colorTileInk(hex, opacity)}`}>
      ${picker}${heading ? nothing : html`<span>${label}</span>`}
    </div>
    <div class="hpf-colortile-meta">
      <code class="hpf-hex">${hex.toUpperCase()}</code>
      <span class="hpf-opacity" aria-label=${opacityLabel}>${pct}%</span>
    </div>
  </div>`;
}

/** Ряд плиток цвета: три колонки, на узком экране две. */
export function colorTiles(tiles: readonly TemplateResult[]): TemplateResult {
  return html`<div class="hpf-colortiles">${tiles}</div>`;
}

export interface ColorRowOptions {
  label: string;
  help?: TemplateResult | typeof nothing;
  /** Готовая плашка `colorField` (или сам `hp-color-opacity`). */
  picker: TemplateResult;
  action?: TemplateResult | typeof nothing;
}

/** Строка цвета (§3.1 «gs-color-row»): подпись слева, плашка справа. */
export function colorRow({ label, help, picker, action }: ColorRowOptions): TemplateResult {
  return html`<div class="hpf-colorrow">
    <span class="hpf-labelrow">${label}${help ?? nothing}</span>
    ${picker}${action ?? nothing}
  </div>`;
}

export interface RadioRowOptions<T extends string> {
  label: string;
  help?: TemplateResult | typeof nothing;
  name: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** Радио в строку (§3.1): подпись слева, варианты справа. */
export function radioRow<T extends string>({ label, help, name, value, options, onChange }: RadioRowOptions<T>): TemplateResult {
  return html`<div class="hpf-inline hpf-wrap">
    <span class="hpf-labelrow">${label}${help ?? nothing}</span>
    <div class="hpf-radios" role="radiogroup" aria-label=${label}>
      ${options.map((o) => html`<label><input data-hp="field" data-field=${name} type="radio" name=${name} data-value=${o.value} .checked=${o.value === value}
        @change=${() => onChange(o.value)} /><span>${o.label}</span></label>`)}
    </div>
  </div>`;
}

export interface CalloutOptions {
  text?: string | TemplateResult;
  /** Structured content is a div, never an invalid block tree inside a p. */
  body?: FormSectionContent;
  kind?: 'info' | 'warning' | 'danger';
  icon?: string;
  /** Ссылка-действие в конце текста. */
  action?: TemplateResult | typeof nothing;
  role?: 'status' | 'alert' | 'note';
  id?: string;
  /** Может принять фокус программно (`tabindex="-1"`), вне порядка Tab. */
  focusable?: boolean;
}

/**
 * Сообщение о состоянии (§3.1 «callout», К5): остаётся на виду, под «?» не
 * уезжает. Это не пояснение к настройке, а сигнал, что прямо сейчас что-то
 * сломано или изменится при сохранении.
 */
export function callout({ text, body, kind = 'info', icon, action, role, id, focusable }: CalloutOptions): TemplateResult {
  return html`<div id=${id ?? nothing} class="hpf-callout ${kind === 'info' ? '' : `hpf-${kind}`}" role=${role ?? nothing}
    tabindex=${focusable ? '-1' : nothing}>
    <ha-icon icon=${icon ?? (kind === 'info' ? 'mdi:information-outline' : 'mdi:alert-outline')}></ha-icon>
    ${body !== undefined ? html`<div class="hpf-callout-body">${body}</div>`
      : html`<p>${text}${action ? html` ${action}` : nothing}</p>`}
  </div>`;
}

export interface UnitInputOptions {
  /** Stable test identity when it differs from the existing label target. */
  fieldId?: string;
  id?: string;
  /** `aria-describedby` — объяснение состояния поля (например, почему оно отключено). */
  describedBy?: string;
  value: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number | 'any';
  placeholder?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Растянуть на всю ширину контейнера. */
  wide?: boolean;
  /** Computed numeric value, distinct from an inapplicable/disabled field. */
  readonly?: boolean;
  onInput: (raw: string) => void;
  /** Необязательный атомарный commit для полей с промежуточным текстовым вводом. */
  onChange?: (raw: string, input: HTMLInputElement) => void;
}

/** Числовое поле с единицей внутри рамки (§3.1 «unit-inside»). */
export function unitInput({
  id, fieldId = id, describedBy, value, unit, min, max, step, placeholder, ariaLabel, invalid, disabled, wide, readonly,
  onInput, onChange,
}: UnitInputOptions): TemplateResult {
  return html`<span class="hpf-unit ${wide ? 'hpf-unit-wide' : ''}">
    <input data-hp="field" data-field=${fieldId ?? nothing} id=${id ?? nothing} type="number" inputmode="decimal" .value=${value}
      aria-describedby=${describedBy ?? nothing}
      min=${min ?? nothing} max=${max ?? nothing} step=${step ?? nothing}
      placeholder=${placeholder ?? nothing} aria-label=${ariaLabel ?? nothing}
      aria-invalid=${invalid ? 'true' : nothing} ?disabled=${disabled}
      ?readonly=${readonly}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)}
      @change=${onChange
        ? (e: Event) => onChange((e.target as HTMLInputElement).value, e.target as HTMLInputElement)
        : nothing} />
    <span>${unit}</span>
  </span>`;
}

export interface RangeLineOptions {
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  ariaLabel: string;
  disabled?: boolean;
  /** Слайдер от вызывающего (`_rangeInput`: ha-slider или range) — компонент не подменяется. */
  slider: TemplateResult;
  onInput: (value: number) => void;
  /** `id` числового поля — цель `<label for>` строки. */
  id?: string;
  /** Display-only value, preserving slider-only editing on existing surfaces. */
  readOnlyValue?: boolean;
}

function stepPrecision(step: number): number {
  const text = String(step).toLowerCase();
  if (!text.includes('e')) return (text.split('.')[1] || '').length;
  const [coefficient, exponentText] = text.split('e');
  const fraction = (coefficient.split('.')[1] || '').length;
  return Math.max(0, fraction - Number(exponentText));
}

/** Convert a committed range-line draft into the exact value its slider can represent. */
export function committedRangeLineValue(
  raw: string, min: number, max: number, step: number,
): number | null {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isFinite(step) || step <= 0) return null;
  const clamped = Math.min(max, Math.max(min, parsed));
  const snapped = min + Math.round((clamped - min) / step) * step;
  const precision = stepPrecision(step);
  return Math.min(max, Math.max(min, Number(snapped.toFixed(precision))));
}

/** Слайдер + числовое поле с единицей в одну строку (§3.1 «range-line»). */
export function rangeLine({ min, max, step, value, unit, ariaLabel, disabled, slider, onInput, id, readOnlyValue }: RangeLineOptions): TemplateResult {
  return html`<div class="hpf-range">
    ${slider}
    ${readOnlyValue ? html`<output class="hpf-range-output">${value}${unit}</output>` : unitInput({
      id, value: String(value), unit, min, max, step, ariaLabel, disabled,
      // A partial string is not product state. Commit it atomically on change;
      // Lit preserves it across renders while the confirmed value is stable,
      // but an intervening slider change produces a new value and wins.
      onInput: () => undefined,
      onChange: (raw, input) => {
        const next = committedRangeLineValue(raw, min, max, step);
        if (next === null) {
          input.value = String(value);
          return;
        }
        input.value = String(next);
        onInput(next);
      },
    })}
  </div>`;
}

/** Подписи концов шкалы под слайдером. */
export function rangeEnds(from: string, to: string): TemplateResult {
  return html`<div class="hpf-range-ends" aria-hidden="true">
    <span class="hpf-range-ends-track"><span>${from}</span><span>${to}</span></span>
  </div>`;
}

/**
 * Компас 44 px (§3.1): «N» на уровне подписи, стрелка поворачивается на
 * итоговый угол; `null` — направление не задано, стрелка приглушена.
 */
export function compass(deg: number | null, label: string): TemplateResult {
  const angle = deg === null ? 0 : ((deg % 360) + 360) % 360;
  return html`<span class="hpf-compass ${deg === null ? 'hpf-unset' : ''}" role="img" aria-label=${label}>
    <svg viewBox="0 0 24 24" style=${`transform: rotate(${angle}deg)`} aria-hidden="true">
      <path d="M12 3v18M12 3l-4 7h8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>`;
}

/** Текстовая ссылка-действие (Reset, Clear, «Use general settings»). */
export function textLink(label: string, onClick: () => void, { action, value, disabled = false }: { action: string; value?: string; disabled?: boolean }): TemplateResult {
  return html`<button data-hp="action" data-action=${action} data-value=${value ?? nothing} class="hpf-link" type="button" ?disabled=${disabled} @click=${onClick}>${label}</button>`;
}

export interface FooterStatusOptions {
  /** Необязательный текст статуса; не дублирует состояние кнопки Save. */
  text?: string;
  /** Ссылка «Review N fields» — ведёт к первому ошибочному полю. */
  action?: TemplateResult | typeof nothing;
}

/** Статус в футере (§3.3): между группами действий, `aria-live`. */
export function footerStatus({ text, action }: FooterStatusOptions): TemplateResult {
  return html`<span class="hpf-status" role="status" aria-live="polite">${text ?? ''}${action ?? nothing}</span>`;
}

export interface ChipOptions {
  value: string;
  icon?: string;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

/** Чип выбранного элемента с кнопкой удаления (§3.1 «Чипы»). */
export function chip({ value, icon, label, removeLabel, onRemove }: ChipOptions): TemplateResult {
  return html`<span class="hpf-chip">
    ${icon ? html`<ha-icon icon=${icon} aria-hidden="true"></ha-icon>` : nothing}
    <span>${label}</span>
    <button data-hp="action" data-action="chip-remove" data-value=${value} type="button" aria-label=${removeLabel} title=${removeLabel} @click=${onRemove}><ha-icon icon="mdi:close"></ha-icon></button>
  </span>`;
}

export interface ChoiceCard<T extends string> {
  value: T;
  title: string;
  caption: string;
}

/** Две choice-карточки в ряд (§4.2 «Floor plan»): радио с заголовком и подписью. */
export function choiceCards<T extends string>(
  name: string, value: T, options: readonly ChoiceCard<T>[], onChange: (value: T) => void, ariaLabel?: string,
): TemplateResult {
  return html`<div class="hpf-choices" role="radiogroup" aria-label=${ariaLabel ?? nothing}>
    ${options.map((o) => html`<label class="hpf-choice">
      <input data-hp="field" data-field=${name} type="radio" name=${name} data-value=${o.value} .checked=${o.value === value} @change=${() => onChange(o.value)} />
      <strong>${o.title}</strong><small>${o.caption}</small>
    </label>`)}
  </div>`;
}

/** Блок на тинте с заголовком и тегом (Display preview). */
export function tintBlock({ title, tag, body }: { title: string; tag?: string; body: TemplateResult | typeof nothing }): TemplateResult {
  return html`<div class="hpf-tint">
    <div class="hpf-tint-head"><h4>${title}</h4>${tag ? html`<span class="hpf-tag">${tag}</span>` : nothing}</div>
    ${body}
  </div>`;
}

/** Единственный разрешённый разделитель внутри карточки (§3.2). */
export const divider = (): TemplateResult => html`<hr class="hpf-divider" />`;

export interface SourceCandidate {
  value: string;
  label: string;
  sub: string;
}

export interface SourcePickerOptions {
  /** Optional source glyph; existing pickers keep their markup and layout. */
  leading?: TemplateResult;
  /** Панель раскрыта. */
  open: boolean;
  /** Выбранный кандидат (подпись + идентификатор) или `null` — плейсхолдер. */
  current: { label: string; sub: string } | null;
  placeholder: string;
  ariaLabel: string;
  filter: string;
  filterPlaceholder: string;
  candidates: readonly SourceCandidate[];
  /** Значение, отмеченное в списке. */
  selected: string;
  emptyText: string;
  onToggle: () => void;
  /** Opt into the existing dialog Escape stack; must only close, never toggle. */
  onClose?: () => void;
  onFilter: (value: string) => void;
  onPick: (value: string) => void;
  /** `id` кнопки — для `<label for>` и смоков. */
  id?: string;
  /** Stable test identity when the existing control has no DOM id. */
  fieldId?: string;
  /** Дополнение к строке поиска в панели (например, чекбокс «Show entities»). */
  toolbar?: TemplateResult | typeof nothing;
  /** Отключённая кнопка: панель не открывается. */
  disabled?: boolean;
}

/**
 * Кнопка выбора источника с панелью в потоке (§3.1 «Кнопка выбора источника»):
 * кнопка в стиле селекта, под ней поиск и список кандидатов. Панель не
 * всплывает поверх — раздвигает карточку, скроллер диалога один (К3).
 */
export function sourcePicker({
  open, current, placeholder, ariaLabel, filter, filterPlaceholder, candidates, selected, emptyText,
  onToggle, onClose, onFilter, onPick, id, fieldId = id, toolbar, disabled = false, leading,
}: SourcePickerOptions): TemplateResult {
  return html`<div class="hpf-picker ${open ? 'open' : ''}" ${sourcePickerOverlay(open, onClose)}>
    <button data-hp="field" data-field=${fieldId ?? nothing} id=${id ?? nothing} type="button" class="hpf-select hpf-pick" aria-haspopup="listbox"
      aria-expanded=${open ? 'true' : 'false'} aria-label=${ariaLabel} ?disabled=${disabled} @click=${onToggle}>
      ${leading ?? nothing}
      ${current
        ? html`<b>${current.label}</b>${current.sub ? html`<span class="hpf-pick-ref">${current.sub}</span>` : nothing}`
        : html`<span class="hpf-pick-ph">${placeholder}</span>`}
    </button>
    ${open
      ? html`<div class="hpf-panel">
          <div class="hpf-toolbar">
            <input data-hp="field" data-field=${fieldId ? `${fieldId}-filter` : 'source-filter'} class="hpf-input" type="text" autocomplete="off" placeholder=${filterPlaceholder}
              aria-label=${filterPlaceholder} .value=${filter}
              @input=${(e: Event) => onFilter((e.target as HTMLInputElement).value)} />
            ${toolbar ?? nothing}
          </div>
          <div class="hpf-list" role="listbox" aria-label=${ariaLabel}>
            ${candidates.length
              ? candidates.map((c) => html`<button data-hp="field-option" data-field=${fieldId ?? nothing} data-value=${c.value} type="button" role="option" class="hpf-cand ${c.value === selected ? 'sel' : ''}"
                  aria-selected=${c.value === selected ? 'true' : 'false'} @click=${() => onPick(c.value)}>
                  <span>${c.label}</span><small>${c.sub}</small>
                </button>`)
              : html`<p class="hpf-hint">${emptyText}</p>`}
          </div>
        </div>`
      : nothing}
  </div>`;
}
