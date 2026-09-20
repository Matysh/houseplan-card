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

import { CARD_DIALOG_FORM_KIT, cardDialogFormKitTokens, formKitCss } from '../styles/form-kit.styles';

/**
 * Лист набора живёт в ленивом редакторском графе, а не в `cardStyles` (#594 AC8).
 *
 * Замер был однозначным: в синхронном графе набор дал +1459 Б gzip и пробил
 * потолок initial View на 415 Б. Диалоги — инструмент администратора, во View их
 * не открывают никогда, поэтому лист приезжает вместе с редактором тем же
 * способом, которым это делает боковая панель: `adoptedStyleSheets` с откатом
 * на `<style>` там, где конструируемых листов нет.
 */
const FORM_KIT_CSS = cardDialogFormKitTokens
  + formKitCss(CARD_DIALOG_FORM_KIT, { withSwitch: false });
const adopted = new WeakSet<ShadowRoot>();
let sheet: CSSStyleSheet | null = null;

export interface FormKitStyleHost {
  renderRoot: DocumentFragment | HTMLElement;
}

/**
 * Идемпотентно вносит лист набора в теневой корень карточки.
 *
 * Документ берётся у самого корня, а не у хоста: тип хоста редактора его не
 * обещает, а `ShadowRoot` всегда знает свой документ.
 */
export function ensureFormKitStyles(host: FormKitStyleHost): void {
  const root = host.renderRoot as ShadowRoot;
  if (!root || adopted.has(root)) return;
  const doc = root.ownerDocument ?? globalThis.document;
  const Sheet = doc?.defaultView?.CSSStyleSheet;
  if (Sheet && 'adoptedStyleSheets' in root) {
    if (!sheet) { sheet = new Sheet(); sheet.replaceSync(FORM_KIT_CSS); }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    adopted.add(root);
    return;
  }
  if (root.querySelector('style[data-hp-form-kit]')) { adopted.add(root); return; }
  const style = doc.createElement('style');
  style.dataset.hpFormKit = 'true';
  style.textContent = FORM_KIT_CSS;
  root.appendChild(style);
  adopted.add(root);
}

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
    <span class="hpf-label hpf-labelrow">${htmlFor ? html`<label for=${htmlFor}>${label}</label>` : label}${help ?? nothing}</span>
    ${control}
    ${error ? html`<p class="hpf-error" role="alert">${error}</p>` : hint ? html`<p class="hpf-hint">${hint}</p>` : nothing}
  </div>`;
}

/** Сетка полей: две равные колонки или `1fr / 175px` (`narrow`). */
export function fieldGrid(
  children: readonly (TemplateResult | typeof nothing)[], { narrow = false }: { narrow?: boolean } = {},
): TemplateResult {
  return html`<div class="hpf-grid ${narrow ? 'hpf-grid-narrow' : ''}">${children}</div>`;
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
  onChange: (checked: boolean) => void;
  /** `id` чекбокса — для смоков и `aria-describedby`. */
  id?: string;
}

/**
 * Полная строка настройки (§3.1): иконка · название + «?» · подпись · тумблер
 * справа. Тумблер — нативный чекбокс, нарисованный CSS, как у редактора
 * панели: один и тот же вид в HA, на стенде и в golden, и `input[type=checkbox]`
 * остаётся тем, что смоки умеют переключать.
 */
export function toggleRow({
  icon, title, caption, help, checked, disabled = false, compact = false, onChange, id,
}: ToggleRowOptions): TemplateResult {
  const captionId = id && caption ? `${id}-caption` : undefined;
  return html`<label class="hpf-toggle ${icon ? '' : 'hpf-noicon'} ${compact ? 'hpf-compact' : ''}">
    ${icon ? html`<span class="hpf-toggle-icon" aria-hidden="true"><ha-icon icon=${icon}></ha-icon></span>` : nothing}
    <span class="hpf-toggle-title"><span>${title}</span>${help ?? nothing}</span>
    ${caption && !compact ? html`<span class="hpf-toggle-caption" id=${captionId ?? nothing}>${caption}</span>` : nothing}
    <input type="checkbox" id=${id ?? nothing} .checked=${checked} ?disabled=${disabled}
      aria-label=${title} aria-describedby=${captionId ?? nothing}
      @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)} />
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
      <input type="radio" name=${name} .checked=${option.value === value} ?disabled=${disabled}
        @change=${() => onChange(option.value)} />
      ${option.sample ? html`<span class="hpf-line ${option.sample === 'dashed' ? 'hpf-line-dashed' : ''}" aria-hidden="true"></span>` : nothing}
      ${option.icon ? html`<ha-icon icon=${option.icon} aria-hidden="true"></ha-icon>` : nothing}
      <span>${option.label}</span>
    </label>`)}
  </div>`;
}

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
      <input type="checkbox" id=${tile.id ?? nothing} .checked=${tile.checked} ?disabled=${tile.disabled}
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
  /** Прозрачность 0–1; `undefined` — поле без прозрачности. */
  opacity?: number;
  opacityLabel?: string;
  onOpacity?: (opacity: number) => void;
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
  picker, hex, opacity, opacityLabel, onOpacity, resetLabel, onReset, disabled = false,
}: ColorFieldOptions): TemplateResult {
  const pct = opacity === undefined ? null : Math.round(Math.min(1, Math.max(0, opacity)) * 100);
  return html`<div class="hpf-colorfield">
    ${picker}
    <code class="hpf-hex">${hex}</code>
    ${pct === null ? nothing : html`<span class="hpf-opacity">${opacityLabel ?? ''}
      <span class="hpf-unit"><input type="number" inputmode="numeric" min="0" max="100" step="1"
        .value=${String(pct)} ?disabled=${disabled} aria-label=${opacityLabel ?? 'Opacity'}
        @input=${(e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(n) && onOpacity) onOpacity(Math.min(1, Math.max(0, n / 100)));
        }} /><span>%</span></span></span>`}
    ${resetLabel && onReset ? html`<button class="hpf-link" type="button" ?disabled=${disabled} @click=${onReset}>${resetLabel}</button>` : nothing}
  </div>`;
}

export interface ColorTileOptions {
  label: string;
  /** Текущий цвет `#rrggbb` — фон плитки и печать hex. */
  hex: string;
  opacity: number;
  opacityLabel: string;
  /** Готовый `hp-color-opacity` (Q5): свотч открывает существующую панель. */
  picker: TemplateResult;
  onOpacity: (opacity: number) => void;
}

/** Светлый ли цвет — для контраста подписи поверх свотча плитки. */
export function isLightHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Плитка цвета (§3.1 «Плитки цвета»): название поверх свотча на всю ширину,
 * ниже hex и число прозрачности. Свотч — trigger существующего пикера.
 */
export function colorTile({ label, hex, opacity, opacityLabel, picker, onOpacity }: ColorTileOptions): TemplateResult {
  const pct = Math.round(Math.min(1, Math.max(0, opacity)) * 100);
  return html`<div class="hpf-colortile">
    <div class="hpf-colortile-swatch" style=${`background:${hex};color:${isLightHex(hex) ? '#1f2a30' : '#fff'}`}>
      ${picker}<span>${label}</span>
    </div>
    <div class="hpf-colortile-meta">
      <code class="hpf-hex">${hex}</code>
      <span class="hpf-unit" title=${opacityLabel}><input type="number" inputmode="numeric" min="0" max="100" step="1"
        .value=${String(pct)} aria-label=${opacityLabel}
        @input=${(e: Event) => {
          const n = Number((e.target as HTMLInputElement).value);
          if (Number.isFinite(n)) onOpacity(Math.min(1, Math.max(0, n / 100)));
        }} /><span>%</span></span>
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
      ${options.map((o) => html`<label><input type="radio" name=${name} .checked=${o.value === value}
        @change=${() => onChange(o.value)} /><span>${o.label}</span></label>`)}
    </div>
  </div>`;
}

export interface CalloutOptions {
  text: string | TemplateResult;
  kind?: 'info' | 'warning';
  icon?: string;
  /** Ссылка-действие в конце текста. */
  action?: TemplateResult | typeof nothing;
  role?: 'status' | 'alert';
}

/**
 * Сообщение о состоянии (§3.1 «callout», К5): остаётся на виду, под «?» не
 * уезжает. Это не пояснение к настройке, а сигнал, что прямо сейчас что-то
 * сломано или изменится при сохранении.
 */
export function callout({ text, kind = 'info', icon, action, role }: CalloutOptions): TemplateResult {
  return html`<div class="hpf-callout ${kind === 'warning' ? 'hpf-warning' : ''}" role=${role ?? nothing}>
    <ha-icon icon=${icon ?? (kind === 'warning' ? 'mdi:alert-outline' : 'mdi:information-outline')}></ha-icon>
    <p>${text}${action ? html` ${action}` : nothing}</p>
  </div>`;
}

export interface UnitInputOptions {
  id?: string;
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
  onInput: (raw: string) => void;
}

/** Числовое поле с единицей внутри рамки (§3.1 «unit-inside»). */
export function unitInput({
  id, value, unit, min, max, step, placeholder, ariaLabel, invalid, disabled, wide, onInput,
}: UnitInputOptions): TemplateResult {
  return html`<span class="hpf-unit ${wide ? 'hpf-unit-wide' : ''}">
    <input id=${id ?? nothing} type="number" inputmode="decimal" .value=${value}
      min=${min ?? nothing} max=${max ?? nothing} step=${step ?? nothing}
      placeholder=${placeholder ?? nothing} aria-label=${ariaLabel ?? nothing}
      aria-invalid=${invalid ? 'true' : nothing} ?disabled=${disabled}
      @input=${(e: Event) => onInput((e.target as HTMLInputElement).value)} />
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
}

/** Слайдер + числовое поле с единицей в одну строку (§3.1 «range-line»). */
export function rangeLine({ min, max, value, unit, ariaLabel, disabled, slider, onInput }: RangeLineOptions): TemplateResult {
  return html`<div class="hpf-range">
    ${slider}
    ${unitInput({
      value: String(value), unit, min, max, step: 1, ariaLabel, disabled,
      onInput: (raw) => {
        const n = Number(raw);
        if (Number.isFinite(n)) onInput(Math.min(max, Math.max(min, n)));
      },
    })}
  </div>`;
}

/** Подписи концов шкалы под слайдером. */
export function rangeEnds(from: string, to: string): TemplateResult {
  return html`<div class="hpf-range-ends" aria-hidden="true"><span>${from}</span><span>${to}</span></div>`;
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
export function textLink(label: string, onClick: () => void, { disabled = false }: { disabled?: boolean } = {}): TemplateResult {
  return html`<button class="hpf-link" type="button" ?disabled=${disabled} @click=${onClick}>${label}</button>`;
}

export interface FooterStatusOptions {
  /** Текст статуса: «Unsaved changes» или пусто. */
  text?: string;
  /** Ссылка «Review N fields» — ведёт к первому ошибочному полю. */
  action?: TemplateResult | typeof nothing;
}

/** Статус в футере (§3.3): между группами действий, `aria-live`. */
export function footerStatus({ text, action }: FooterStatusOptions): TemplateResult {
  return html`<span class="hpf-status" role="status" aria-live="polite">${text ?? ''}${action ?? nothing}</span>`;
}

export interface ChipOptions {
  icon?: string;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

/** Чип выбранного элемента с кнопкой удаления (§3.1 «Чипы»). */
export function chip({ icon, label, removeLabel, onRemove }: ChipOptions): TemplateResult {
  return html`<span class="hpf-chip">
    ${icon ? html`<ha-icon icon=${icon} aria-hidden="true"></ha-icon>` : nothing}
    <span>${label}</span>
    <button type="button" aria-label=${removeLabel} title=${removeLabel} @click=${onRemove}><ha-icon icon="mdi:close"></ha-icon></button>
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
      <input type="radio" name=${name} .checked=${o.value === value} @change=${() => onChange(o.value)} />
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
