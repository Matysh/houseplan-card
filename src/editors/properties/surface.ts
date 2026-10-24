import { html, nothing, svg, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { ref } from 'lit/directives/ref.js';
import { unitInput, colorField } from '../form-kit';
import type { ColorPickerLabels, HpColorOpacity } from '../../hp-color-opacity';
import type { PropertiesFieldController } from './controller';
import type { PropertiesString } from './strings';
import { propertiesColorDraft, editPropertiesColor } from './color-draft';
import { groupColorDraft, readGroupColorDraft, editGroupColor, pickerGroupColor, parseGroupColor } from './group-color-draft';
import type { DecorGroupColorState } from '../decor/group-edit';

export interface PropertiesField {
  key: string; label: PropertiesString;
  value: number | string | boolean | { color: string; opacity: number; noFill?: boolean } | DecorGroupColorState | null;
  mode?: 'readonly' | 'disabled'; unit?: 'cm' | '%' | '°' | '';
  min?: number; max?: number; step?: number;
  control?: 'color' | 'group-color' | 'select' | 'text' | 'toggle' | 'action' | 'choices';
  wide?: boolean; action?: string; icon?: string;
  options?: { value: string; label: string }[];
  reason?: PropertiesString;
  section?: PropertiesString;
}
export interface PropertiesGroup {
  key: string; title?: PropertiesString; icon?: string; fields: PropertiesField[]; hint?: PropertiesString;
}
export interface PropertiesAction {
  key: string; label: PropertiesString; icon: string; disabled?: PropertiesString;
  wide?: boolean;
}
export interface PropertiesSurface {
  title: string; meta: string; groups: PropertiesGroup[]; actions: PropertiesAction[];
}
export interface PropertiesSurfacePort {
  t(key: PropertiesString, vars?: Record<string, string | number>): string;
  imperial: boolean; dark?: boolean; inlineColors: boolean; controller: PropertiesFieldController; pickerLabels: ColorPickerLabels;
  decorShortcuts?: boolean;
  action(key: string): void;
  edit(field: PropertiesField, raw: string, finish?: boolean): void;
  number(field: PropertiesField, value: number): string;
  textSelection(input: HTMLTextAreaElement): void;
  insertVariable(): void;
  mayFinish(): boolean;
  enterField(key: string): void;
  attachColor(key: string, picker: HpColorOpacity): void;
}

/** Small outline icons follow the approved panel artwork, not the device icon theme. */
const paths: Record<string, string> = {
  position: 'M5 3v16h16M5 3 2 6M5 3l3 3m13 13-3-3m3 3-3 3',
  geometry: 'M3 3h6M3 3v6m18 12h-6m6 0v-6M3 3l7 7m11 11-7-7',
  appearance: 'M21 12h-5a3 3 0 0 0-3 3v6',
  close: 'm6 6 12 12M6 18 18 6', lock: 'M8 10V7a4 4 0 1 1 8 0v3',
  copy: 'M16 8V3H3v13h5', delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  settings: 'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  reset: 'M3 8h11a7 7 0 0 1 0 14M3 8l5-5M3 8l5 5',
  link: 'm8 15-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m5 3 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0M8 16l8-8',
  image: 'M3 18l6-6 4 4 3-4 5 5', variable: 'M8 3H6a2 2 0 0 0-2 2v4l-2 3 2 3v4a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v4l2 3-2 3v4a2 2 0 0 1-2 2h-2M10 9l4 6m0-6-4 6',
  swap: 'M4 7h15l-4-4m4 4-4 4M20 17H5l4-4m-4 4 4 4',
  plus: 'M12 4v16M4 12h16', temperature: 'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0ZM12 8v10',
  text: 'M4 5V3h16v2M12 3v18M8 21h8', door: 'M5 21V3h14v18M8 21V6l8-2v17ZM13 13h.1',
  flip_h: 'M12 2v20M3 6v12l6-6Zm18 0v12l-6-6Z', flip_v: 'M2 12h20M6 3h12l-6 6Zm0 18h12l-6-6Z',
  front: 'M3 3h12v12H3ZM9 15v6h12V9h-6', back: 'M9 9h12v12H9ZM3 15V3h12v6',
};
export function propertiesIcon(kind: string): TemplateResult {
  return svg`<svg class="hp-prop-icon" viewBox="0 0 24 24" aria-hidden="true"><path d=${paths[kind] ?? paths.geometry}></path>
    ${kind === 'lock' ? svg`<rect x="5" y="10" width="14" height="11" rx="2"></rect>` : nothing}
    ${kind === 'copy' ? svg`<rect x="8" y="8" width="13" height="13" rx="2"></rect>` : nothing}
    ${kind === 'appearance' ? svg`<circle cx="12" cy="12" r="9"></circle><circle cx="8" cy="8" r="1"></circle><circle cx="15" cy="7" r="1"></circle><circle cx="7" cy="14" r="1"></circle>` : nothing}
    ${kind === 'settings' ? svg`<circle cx="12" cy="12" r="4"></circle>` : nothing}
    ${kind === 'image' ? svg`<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8" cy="8" r="1.5"></circle>` : nothing}
  </svg>`;
}

function fieldView(field: PropertiesField, port: PropertiesSurfacePort): TemplateResult {
  const { controller, t } = port;
  const draft = controller.draft?.field === field.key ? controller.draft : null;
  const label = t(field.label), id = `hp-property-${field.key}`;
  const disabled = field.mode === 'disabled', readonly = field.mode === 'readonly';
  const pending = !!controller.draft?.pending;
  const keydown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (!port.mayFinish()) return;
    if (event.key === 'Escape') { event.preventDefault(); controller.cancel(); }
    else if (event.key === 'Enter' && (field.control !== 'text' || event.ctrlKey || event.metaKey)) {
      event.preventDefault(); void controller.finish();
    }
  };
  const blur = (event: FocusEvent) => {
    const control = event.currentTarget as HTMLElement;
    if (!port.mayFinish() || control.contains(event.relatedTarget as Node | null)
      || (field.control === 'color' || field.control === 'group-color') && (!port.inlineColors || control.querySelector<HpColorOpacity>('hp-color-opacity')?.pickerOpen)) return;
    void controller.finish();
  };
  const value = draft?.raw ?? (typeof field.value === 'number' ? port.number(field, field.value) : String(field.value ?? ''));
  let control: TemplateResult;
  if (field.control === 'group-color') {
    const initial = field.value as DecorGroupColorState;
    const state = readGroupColorDraft(draft?.raw ?? '') ?? groupColorDraft(initial);
    const color = state.touchedColor ? state.hex : initial.color;
    const opacity = state.touchedOpacity ? Number(state.alpha) / 100 : initial.opacity;
    const parsed = parseGroupColor(JSON.stringify(state), field.key === 'fill' ? 'fill' : 'stroke');
    const pickerChange = (e: CustomEvent, finish = false) => port.edit(field, pickerGroupColor(state, e.detail), finish);
    control = colorField({ hex: state.hex, opacity: opacity ?? 1, opacityLabel: t('opacity'), alphaOnly: initial.alphaOnly,
      disabled: pending, inputs: { name: field.key, hex: state.hex, opacity: state.alpha,
        hexLabel: `${label}: ${port.pickerLabels.hex}`, placeholder: t('mixed_values'),
        hexInvalid: state.touchedColor && !parsed.ok, opacityInvalid: state.touchedOpacity && !parsed.ok,
        onHex: raw => port.edit(field, editGroupColor(state, 'hex', raw)),
        onOpacity: raw => port.edit(field, editGroupColor(state, 'opacity', raw)) },
      picker: html`<hp-color-opacity data-hp="field" data-field=${`properties-${field.key}`} ${ref(el=>{if(el)port.attachColor(field.key,el as HpColorOpacity);})}
        .label=${label} .color=${color ?? ''} .opacity=${opacity ?? 1} .mixedColor=${color === null} .mixedOpacity=${opacity === null}
        .mixedLabel=${t('mixed_values')} .alphaOnly=${initial.alphaOnly} .reportTouched=${true}
        .pickerLabels=${port.pickerLabels} .disabled=${pending} hide-label flat-swatch compact-swatch
        @hp-color-opacity-open=${() => port.edit(field, JSON.stringify(state))}
        @hp-color-opacity-change=${(e: CustomEvent) => pickerChange(e)}
        @hp-color-opacity-commit=${(e: CustomEvent) => pickerChange(e, true)}
        @hp-color-opacity-close=${() => { if (port.mayFinish() && controller.draft?.field === field.key) controller.cancel(); }}></hp-color-opacity>` });
  } else if (field.control === 'color') {
    const state = propertiesColorDraft(draft?.raw ?? JSON.stringify(field.value));
    const color = state?.value;
    control = disabled || !color ? html`<div class="hp-prop-control hp-prop-color"><span class="hp-prop-swatch hp-prop-swatch-empty"></span><span>—</span></div>`
      : colorField({ hex: color.color.toUpperCase(), valueLabel: color.noFill ? t('no_fill') : undefined, opacity: color.opacity,
        opacityLabel: t('opacity'), disabled: pending,
        inputs: port.inlineColors && state ? { name: field.key, hex: state.hex, opacity: state.opacity,
          hexLabel: `${label}: ${port.pickerLabels.hex}`, hexInvalid: state.hexInvalid, opacityInvalid: state.opacityInvalid,
          onHex: raw => port.edit(field, editPropertiesColor(state, 'hex', raw)),
          onOpacity: raw => port.edit(field, editPropertiesColor(state, 'opacity', raw)) } : undefined,
        picker: html`<hp-color-opacity data-hp="field" data-field=${`properties-${field.key}`} ${ref(el=>{if(el)port.attachColor(field.key,el as HpColorOpacity);})} .label=${label} .color=${color.color} .opacity=${color.opacity}
          .allowNoFill=${color.noFill !== undefined} .noFill=${color.noFill ?? false} .noFillLabel=${t('no_fill')}
          .pickerLabels=${port.pickerLabels} .disabled=${pending} hide-label flat-swatch compact-swatch
          @hp-color-opacity-open=${() => port.edit(field, JSON.stringify(color))}
          @hp-color-opacity-change=${(e: CustomEvent) => port.edit(field, JSON.stringify(e.detail))}
          @hp-color-opacity-commit=${(e: CustomEvent) => port.edit(field, JSON.stringify(e.detail), true)}
          @hp-color-opacity-close=${() => { if (port.mayFinish() && controller.draft?.field === field.key) controller.cancel(); }}></hp-color-opacity>` });
  } else if (field.control === 'action') control = html`<button data-hp="field" data-field=${`properties-${field.key}`} id=${id} type="button" class="hp-prop-settings" ?disabled=${disabled}
      @click=${() => port.action(field.action ?? field.key)}>${propertiesIcon(field.icon ?? 'settings')}${label}</button>`;
  else if (field.control === 'choices') control = html`<div class="hp-prop-choices" role="group" aria-label=${label}>
      ${field.options?.map(option => html`<button data-hp="field" data-field=${`properties-${field.key}`} data-value=${option.value} type="button" class="hp-prop-choice ${value === option.value ? 'active' : ''}"
        aria-pressed=${String(value === option.value)} ?disabled=${disabled || readonly || pending}
        @click=${() => port.edit(field, option.value, true)}>${option.label}</button>`)}</div>`;
  else if (field.control === 'select') control = html`<select data-hp="field" data-field=${`properties-${field.key}`} id=${id} class="hp-prop-control" aria-label=${label} ?disabled=${disabled || readonly || pending}
      .value=${value} @change=${(e: Event) => port.edit(field, (e.target as HTMLSelectElement).value, true)}>
      ${field.options?.map(option => html`<option value=${option.value} ?selected=${value===option.value}>${option.label}</option>`)}</select>`;
  else if (field.control === 'toggle') control = html`<button data-hp="field" data-field=${`properties-${field.key}`} id=${id} type="button" class="hp-prop-choice ${field.value === true ? 'active' : ''}"
      aria-label=${label} aria-pressed=${String(field.value === true)} ?disabled=${disabled || readonly || pending}
      @click=${() => port.edit(field, String(field.value !== true), true)}>${field.icon ? propertiesIcon(field.icon) : nothing}${label}</button>`;
  else if (field.control === 'text') control = html`<textarea data-hp="field" data-field=${`properties-${field.key}`} id=${id} class="hp-prop-text" rows="2" maxlength="200" aria-label=${label} ?disabled=${pending || disabled || readonly}
      .value=${value} @input=${(e: Event) => port.edit(field, (e.target as HTMLTextAreaElement).value)}
      @select=${(e: Event) => port.textSelection(e.target as HTMLTextAreaElement)}
      @keyup=${(e: Event) => port.textSelection(e.target as HTMLTextAreaElement)}
      @click=${(e: Event) => port.textSelection(e.target as HTMLTextAreaElement)}></textarea>`;
  else control = disabled || field.value === null ? html`<div class="hp-prop-control"><span>—</span><span class="hp-prop-unit">${field.unit === 'cm' ? t(port.imperial ? 'inch' : 'cm') : field.unit}</span></div>`
    : unitInput({ id, fieldId: `properties-${field.key}`, value, unit: field.unit === 'cm' ? t(port.imperial ? 'inch' : 'cm') : field.unit ?? '',
      min: field.min === undefined ? undefined : field.min / (port.imperial && field.unit === 'cm' ? 2.54 : 1),
      max: field.max === undefined ? undefined : field.max / (port.imperial && field.unit === 'cm' ? 2.54 : 1),
      step: field.step === undefined ? 'any' : field.step / (port.imperial && field.unit === 'cm' ? 2.54 : 1), ariaLabel: label,
      readonly, invalid: !!draft?.error, disabled: pending,
      onInput: raw => port.edit(field, raw) });
  return html`${field.section ? html`<div class="hp-prop-feature-label">${t(field.section)}</div>` : nothing}<div class="hp-prop-field ${field.mode ?? ''} ${field.control === 'text' || field.wide ? 'wide' : ''}" data-property=${field.key}
      @keydown=${keydown} @focusout=${blur} @focusin=${() => port.enterField(field.key)} title=${field.reason ? t(field.reason) : nothing}>
    ${field.control === 'text' || field.control === 'toggle' || field.control === 'action' ? nothing : html`<label for=${id}>${label}${readonly ? propertiesIcon('lock') : nothing}</label>`}
    ${control}
    ${field.control === 'text' ? html`<button data-hp="action" data-action="properties-insert-variable" type="button" class="hp-prop-variable" ?disabled=${disabled || readonly || pending} @pointerdown=${(e: Event) => e.preventDefault()}
      @click=${() => port.insertVariable()}>${propertiesIcon('variable')}${t('insert_variable')}</button>` : nothing}
    ${draft?.error ? html`<div class="hp-prop-error" role="alert">${t(draft.error.key as PropertiesString, draft.error.values)}</div>` : nothing}
  </div>`;
}

export function renderPropertiesSurface(model: PropertiesSurface, port: PropertiesSurfacePort, inert: boolean): TemplateResult {
  const { t, controller } = port;
  /* css-uses {"owner":"renderPropertiesSurface","kind":"class","values":["position","geometry","appearance","features","copy","delete","replace","display_device","decor-front","decor-back"],"reason":"Finite group and footer action keys emitted by the Properties catalog"} */
  return html`<aside class="hp-properties" data-theme=${port.dark == null ? 'auto' : port.dark ? 'dark' : 'light'} data-hp="properties-panel" aria-label=${t('title')} ?inert=${inert}
    aria-busy=${String(!!controller.draft?.pending)} @pointerdown=${(e: Event) => e.stopPropagation()}
    @click=${(e: Event) => e.stopPropagation()} @wheel=${(e: Event) => e.stopPropagation()}>
    <header class="hp-prop-head"><div class="hp-prop-title" title=${model.title}>${model.title}</div><div class="hp-prop-meta" title=${model.meta}>${model.meta}</div></header>
    <div class="hp-prop-scroll">
      ${repeat(model.groups, group => group.key, group => html`<section class="hp-prop-group ${group.key}">
        ${group.title ? html`<h3 class="hp-prop-group-title">${propertiesIcon(group.icon ?? group.key)}${t(group.title)}</h3>` : nothing}
        <div class="hp-prop-fields">${repeat(group.fields, field => field.key, field => fieldView(field, port))}</div>
        ${group.hint ? html`<p class="hp-prop-hint">${t(group.hint)}</p>` : nothing}
      </section>`)}
    </div>
    <footer class="hp-prop-foot"><div class="hp-prop-actions ${model.actions.length === 1 ? 'solo' : ''}">
      ${model.actions.map(action => html`<div class="hp-prop-action-wrap ${action.wide ? 'wide' : ''}"><button data-hp="action" data-action=${`properties-${action.key}`} type="button" class="hp-prop-action ${action.key}"
          aria-disabled=${String(!!action.disabled)} data-hp-tooltip=${action.disabled ? t(action.disabled) : nothing}
          @click=${() => { if (!action.disabled) port.action(action.key); }}>
          ${propertiesIcon(action.icon)}<span>${t(action.label)}</span></button></div>`)}
      </div><div class="hp-prop-help">${port.decorShortcuts
        ? html`<div><kbd>Ctrl A</kbd>${t('select_all')}</div><div><kbd>Ctrl M</kbd>${t('select_furniture')}</div>`
        : html`<div><kbd>${model.groups.some(group=>group.fields.some(field=>field.control==='text')) ? 'Ctrl Enter' : 'Enter'}</kbd>${t('apply')}</div><div><kbd>Esc</kbd>${t('cancel_input')}</div>`}<div><kbd>Ctrl Z</kbd>${t('undo')}</div></div>
      ${controller.draft?.pending ? html`<span class="hp-prop-pending" role="status">${t('pending')}</span>` : nothing}
    </footer>
  </aside>`;
}
