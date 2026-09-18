/**
 * Разметка общего набора контролов формы (#594, шаг 1 эпика #591).
 *
 * Контролы ничего не знают о конкретном диалоге: на вход подпись, значение,
 * обработчик и опции — на выход `TemplateResult`. Состояние остаётся на хосте,
 * как и у вынесенных диалогов (#592 К2).
 *
 * Стили — в `src/styles/form-kit.styles.ts`; имена классов там и здесь связаны
 * префиксом `hpf`.
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
}

/** Карточка-группа: белая подложка, заголовок и справка рядом с ним. */
export function formCard({ title, help, body }: FormCardOptions): TemplateResult {
  return html`<section class="hpf-card">
    ${title
      ? html`<div class="hpf-head"><h3>${title}</h3>${help ?? nothing}</div>`
      : nothing}
    ${body}
  </section>`;
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
}

export interface SegmentedOptions<T extends string> {
  /** Имя группы радиокнопок — общее для всех вариантов. */
  name: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  /** Доступное имя группы для скринридера. */
  ariaLabel?: string;
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
  name, value, options, onChange, ariaLabel,
}: SegmentedOptions<T>): TemplateResult {
  return html`<div class="hpf-seg" role="radiogroup" aria-label=${ariaLabel ?? nothing}>
    ${options.map((option) => html`<label>
      <input type="radio" name=${name} .checked=${option.value === value}
        @change=${() => onChange(option.value)} />
      <span>${option.label}</span>
    </label>`)}
  </div>`;
}

export interface ColorRowOptions {
  label: string;
  /** Готовый `hp-color-opacity` от вызывающего: компонент не подменяется. */
  picker: TemplateResult;
  action?: TemplateResult | typeof nothing;
}

/** Строка цвета: подпись, плашка пикера и необязательное действие рядом. */
export function colorRow({ label, picker, action }: ColorRowOptions): TemplateResult {
  return html`<div class="hpf-row hpf-color">
    <span class="hpf-label">${label}</span>
    ${picker}${action ?? nothing}
  </div>`;
}
