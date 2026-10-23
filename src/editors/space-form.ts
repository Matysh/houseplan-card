/** Shared space form for editor and onboarding (#945).
 * Persistence remains in their existing writers. Optional navigation and north
 * controls are injected by the editor, keeping its graph out of onboarding. */
import { html, nothing, type TemplateResult } from 'lit';

import type { settingsNorth } from './settings-north';
import { deviceBatteryModeOf, type SpaceDeviceBatteryMode } from '../device-battery-settings';
import { roomCardPreview } from './room-card-preview';
import {
  callout, choiceCards, colorField, colorRow, compass, ensureFormKitStyles, field,
  fieldGrid, footerStatus, formCard, rangeLine, subsection,
  textLink, toggleRow, unitInput, selectControl, formSections, type FormSectionContent,
} from './form-kit';

import {
  GRID_CELL_CM_MAX, GRID_CELL_CM_MIN, gridCellFieldToCm, gridCellFieldValue,
} from '../grid-scale';
import {
  DEFAULT_CUSTOM_FILL, SPACE_FILL_UI_MODES, stageBgOf,
} from '../logic';
import { forgetSpaceDialogBaseline, spaceDialogDirty, spaceDialogProblems } from './space-form-state';
import {
  strictNumber, switchSpacePlanSource, touchSpaceDisplay, type SpaceDialogState,
} from '../space-dialog';
import { bgModeOf, northDegOf, sunRaysOn } from '../sun';
import type { I18nKey } from '../i18n';
import type { SettingsI18nKey } from '../i18n/settings';
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { settingsCopy } from './settings-copy';
import { globalSignalVisibleOf, type SignalVisibilityMode } from '../signal-visibility';
import { spaceDraftAppearanceOf } from '../room-appearance';
/* #592: границы шага сетки живут рядом с полем, которое их показывает; кламп
 * записи в редакторском рантайме импортирует их отсюда — одно число, один
 * источник, и направление импорта то же, что у самой функции рисования. */
export const CELL_CM_MIN = GRID_CELL_CM_MIN;
export const CELL_CM_MAX = GRID_CELL_CM_MAX;

/**
 * Что форме нужно от рантайма. Всё, что у двух рантаймов одинаково, берётся с
 * хоста напрямую; сюда попало только различающееся.
 */
export interface SpaceFormPort {
  host: HouseplanEditorHostPort;
  /** Префикс `id` контролов — два рантайма не должны выдавать одинаковые `id`. */
  idPrefix: string;
  help(key: Extract<I18nKey, `${string}.help`>): TemplateResult | typeof nothing;
  rangeInput(
    min: number, max: number, step: number, value: number,
    onInput: (v: number) => void, disabled?: boolean, ariaLabel?: string, fieldId?: string,
  ): TemplateResult;
  pickPlanFile(event: Event): void | Promise<void>;
  toggleServerPlans(): void | Promise<void>;
  renderServerPlans(d: SpaceDialogState): TemplateResult;
  save(): void | Promise<void>;
  skipImport(): void;
  /** Только редактор: онбординг создаёт, а не правит. `withDevices` — #819. */
  deleteSpace?(withDevices?: boolean): void | Promise<void>;
  copySpace?(): void;
  northControl?: typeof settingsNorth;
  openGeneral?(section: string): void;
  revealField?(field: HTMLElement): void;
}

const set = (port: SpaceFormPort, next: SpaceDialogState): void => { port.host._spaceDialog = next; };

/**
 * #819: «Удалить» ended blocked — the first time, again after the body was
 * scrolled away, or after the server's `space_in_use`. The warning is the last
 * thing in a long body, so bring it fully into view and put focus on it. One
 * helper for both runtimes; the scroll is instant, so nothing animates.
 */
export async function revealSpaceDeleteBlocker(
  host: Pick<HouseplanEditorHostPort, 'renderRoot' | 'updateComplete'>,
): Promise<void> {
  await host.updateComplete;
  // Either runtime's form may be on screen; only one space dialog ever is.
  const warning = (host.renderRoot as ParentNode).querySelector<HTMLElement>('[id$="-delete-blocked"]');
  warning?.scrollIntoView({ block: 'nearest' });
  warning?.focus({ preventScroll: true });
}

/**
 * Новые строки диалогов живут в ленивом словаре `i18n/settings` (приём
 * #423/#459), а не в основном каталоге: диалоги — инструмент администратора,
 * и их подписи не должны ехать в первый кадр (К8). Прежние ключи `space.*`
 * остаются в основном каталоге и читаются через `_t`, как раньше.
 */
/** Части формы: заголовок и бейдж оболочки, тело из четырёх карточек, футер, закрытие. */
export interface SpaceFormParts {
  title: string;
  badge: string;
  body: TemplateResult;
  sections: Array<{ id: string; title: string; body: TemplateResult }>;
  notices: TemplateResult | typeof nothing;
  footer: TemplateResult;
  /** Обработчик `@hp-close`: с изменениями спрашивает (К10), без — закрывает. */
  requestClose: (event: Event) => Promise<void>;
}

/**
 * Форма пространства без оболочки: тег hp-dialog с литеральным `data-kind`
 * рисует каждый рантайм сам — этого требует контракт #489.
 */
export function renderSpaceForm(port: SpaceFormPort): SpaceFormParts {
  ensureFormKitStyles(port.host);
  const { host } = port;
  const d = host._spaceDialog!;
  const t = host._t.bind(host);
  const { st } = settingsCopy(host);
  const id = (name: string) => `${port.idPrefix}-${name}`;
  const problems = spaceDialogProblems(d, port.idPrefix, host._imperial);
  const problemFor = (fieldId: string) => problems.find((p) => p.field === fieldId);
  const dirty = spaceDialogDirty(host, d);
  const canSave = dirty && problems.length === 0 && !d.busy;
  const progress = host._importTotal > 0 && d.mode === 'create'
    ? t('import.progress', { i: host._importTotal - host._importQueue.length, n: host._importTotal })
    : '';
  const close = () => {
    forgetSpaceDialogBaseline(host);
    host._spaceDialog = null;
    host._importQueue = [];
    host._importTotal = 0;
  };
  /* К10: закрытие с несохранёнными изменениями спрашивает; без изменений
   * закрывает сразу. `rejectClose` возвращает оболочку в открытое состояние. */
  const requestClose = async (event: Event) => {
    if (!dirty || d.busy) { close(); return; }
    const dialog = (event.currentTarget as HTMLElement | null)?.closest<HTMLElement & { rejectClose(): void }>('hp-dialog');
    const discard = await host._confirmDanger({
      key: 'discard-space-dialog', kind: 'warning',
      title: st('dialog.discard_title'), message: st('dialog.discard_message'),
      objectName: d.title.trim() || undefined,
      confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
      icon: 'mdi:content-save-off-outline', confirmIcon: 'mdi:content-save-off-outline',
    });
    if (discard) close(); else dialog?.rejectClose?.();
  };
  const reviewFirst = () => {
    const first = problems[0];
    if (!first) return;
    const root = host.renderRoot as ParentNode;
    const node = root.querySelector<HTMLElement>(`#${first.field}`);
    if (node && port.revealField) port.revealField(node);
    else { node?.scrollIntoView({ block: 'center' }); node?.focus(); }
  };

  const sections = [
    { id: 'basics', title: st('space.section_plan'), body: renderBasics(port, d, id, problemFor) },
    { id: 'appearance', title: st('space.section_rooms'), body: renderAppearance(port, d, id, problemFor) },
    { id: 'room-cards', title: st('space.section_metrics'), body: renderRoomCards(port, d, id) },
    { id: 'sun', title: st('space.section_background'), body: renderSunAndLight(port, d, id, problemFor) },
  ];
  const notices = d.deleteBlockers
    ? callout({ kind:'warning', role:'alert', id:id('delete-blocked'), focusable:true,
        text:t('space.delete_blocked', {n:String(d.deleteBlockers)}),
        action:port.deleteSpace ? html`<button data-hp="action" data-action="space-delete-devices" class="btn danger" ?disabled=${d.busy} @click=${() => port.deleteSpace!(true)}>${st('space.delete_with_devices')}</button>` : nothing })
    : nothing;
  return {
    sections, notices,
    title: `${d.mode === 'create' ? t('space.new') : t('space.header')}${progress ? ` · ${progress}` : ''}`,
    badge: d.mode === 'edit' ? d.title.trim() : '',
    requestClose,
    body: html`<div class="body hpf-form">${sections.map(section => section.body)}${notices}</div>`,
    footer: html`<div class="row dialog-action-footer hpf-footer hpf-footer-space ${port.northControl ? 'hpf-footer-object' : ''}" slot="footer">
      ${footerStatus(problems.length
        ? { action: textLink(st('dialog.review_fields', { n: String(problems.length) }), reviewFirst, {action:'review-fields'}) }
        : port.northControl ? {text:st(dirty ? 'dialog.dirty' : 'dialog.saved')} : {})}
      ${d.mode === 'edit' && port.copySpace
        ? html`<div class="dialog-action-group dialog-action-copy">
            <button data-hp="action" data-action="space-copy" class="btn ghost hpf-mobile-icon" aria-label=${t('btn.copy')} title=${t('btn.copy')}
              @click=${() => port.copySpace!()} ?disabled=${d.busy}>
              <ha-icon icon="mdi:content-copy"></ha-icon><span class="hpf-action-label">${t('btn.copy')}</span>
            </button>
          </div>`
        : nothing}
      ${d.mode === 'edit' && port.deleteSpace
        ? html`<div class="dialog-action-group dialog-action-danger">
            <button data-hp="space-delete" class="btn danger hpf-mobile-icon" aria-label=${t('btn.delete')} title=${t('btn.delete')}
              @click=${() => port.deleteSpace!()} ?disabled=${d.busy}>
              <ha-icon icon="mdi:delete-outline"></ha-icon><span class="hpf-action-label">${t('btn.delete')}</span>
            </button>
          </div>`
        : nothing}
      <div class="dialog-action-group dialog-action-commit">
        ${host._importTotal > 0 && d.mode === 'create'
          ? html`<button data-hp="action" data-action="import-skip" class="btn ghost" @click=${() => port.skipImport()}>${t('btn.skip')}</button>`
          : nothing}
        <button class="btn ghost" data-hp="dialog-cancel" @click=${requestClose}>${t('btn.cancel')}</button>
        <button class="btn on" data-hp="dialog-confirm" @click=${() => port.save()} ?disabled=${!canSave}
          title=${problems[0] ? st(problems[0].message) : ''}>
          <ha-icon icon="mdi:check"></ha-icon><span class="hpf-save-label">${d.busy ? '…' : t('btn.save')}</span>
        </button>
      </div>
    </div>`,
  };
}

type ProblemFor = (fieldId: string) => { message: SettingsI18nKey } | undefined;

/** §4.2 карточка 1: Basics — имя и масштаб в сетке 1fr/175, подложка. */
function renderBasics(port: SpaceFormPort, d: SpaceDialogState, id: (n: string) => string, problemFor: ProblemFor): TemplateResult {
  const { host } = port;
  const t = host._t.bind(host);
  const { st, shelp } = settingsCopy(host);
  const saved = d.mode === 'edit' && d.spaceId
    ? host._serverCfg?.spaces.find((x) => x.id === d.spaceId) : undefined;
  const savedCellCm = saved && Number(saved.cell_cm) > 0 ? Number(saved.cell_cm) : null;
  const scaleChanged = savedCellCm !== null && Math.abs(d.cellCm - savedCellCm) > 1e-9;
  const titleProblem = problemFor(id('title'));
  const scaleProblem = problemFor(id('cell-cm'));
  const planProblem = problemFor(id('plan'));
  return formCard({
    id: 'basics',
    title: st('space.section_plan'),
    body: spaceFormSections(port, [
          fieldGrid([
        field({
          label: t('space.title_label'), htmlFor: id('title'),
          error: titleProblem ? st(titleProblem.message) : undefined,
          control: html`<input data-hp="field" data-field=${id('title')} id=${id('title')} class="hpf-input" type="text" maxlength="80"
            placeholder=${t('space.title_ph')} .value=${d.title}
            aria-invalid=${titleProblem ? 'true' : nothing}
            @input=${(e: Event) => set(port, { ...d, title: (e.target as HTMLInputElement).value })} />`,
        }),
        field({
          label: t('space.scale_label'), htmlFor: id('cell-cm'), help: port.help('space.cell_cm.help'),
          error: scaleProblem ? st(scaleProblem.message) : undefined,
          control: unitInput({
            id: id('cell-cm'), wide: true,
            value: d.cellCmInput ?? gridCellFieldValue(d.cellCm, host._imperial),
            unit: t(host._imperial ? 'space.scale_unit_imperial' : 'space.scale_unit'),
            min: Number(gridCellFieldValue(CELL_CM_MIN, host._imperial)),
            max: Number(gridCellFieldValue(CELL_CM_MAX, host._imperial)),
            step: 0.1,
            invalid: !!scaleProblem,
            onInput: (raw) => {
              const n = strictNumber(raw);
              const canonical = n == null ? null : gridCellFieldToCm(n, host._imperial);
              set(port, {
                ...d, cellCmInput: raw, cellCmTouched: true,
                cellCm: canonical != null && canonical >= CELL_CM_MIN && canonical <= CELL_CM_MAX
                  ? canonical : d.cellCm,
              });
            },
          }),
        }),
      ], { narrow: true, stacked:!!port.northControl }),
          scaleChanged ? callout({ kind: 'warning', text: st('space.scale_changed') }) : nothing,
          port.northControl ? field({label:st('space.plan_source'),help:shelp('space.plan.help'),control:html`
        <div id=${id('plan')} tabindex="-1" aria-invalid=${planProblem ? 'true' : nothing}>
          ${selectControl({name:id('plan-source'),value:d.source,ariaLabel:st('space.plan_source'),
            options:[{value:'file',label:t('space.source_file')},{value:'draw',label:t('space.source_draw')}],
            onChange:v=>set(port,switchSpacePlanSource(d,v))})}
        </div>`}) : html`${subsection({ title: st('space.plan_source'), help: shelp('space.plan.help') })}
      <div id=${id('plan')} tabindex="-1" aria-invalid=${planProblem ? 'true' : nothing}>
        ${choiceCards('plansrc', d.source, [
          { value: 'draw', title: t('space.source_draw'), caption: st('space.source_draw_hint') },
          { value: 'file', title: t('space.source_file'), caption: st('space.source_file_hint') },
        ], (value) => set(port, switchSpacePlanSource(d, value)), st('space.plan_source'))}
      </div>`,
          d.source === 'file' ? port.northControl
        ? field({label:st('space.image_label'),help:shelp('space.image.help'),control:renderPlanUpload(port,d)})
        : renderPlanUpload(port,d) : nothing,
          d.source === 'draw' && d.planUrl ? callout({ text: st('space.plan_kept') }) : nothing,
          planProblem ? html`<p class="hpf-error" role="alert">${st(planProblem.message)}</p>` : nothing,
          toggleRow({id:id('layer-decor'), title:st('space.layer_decor'), help:shelp('space.decor.help'),checked:!d.hideDecor, onChange:v => set(port,{...d,hideDecor:!v})}),
        ]),
  });
}

/** Панель загрузки подложки: существующий пикер файлов и серверный список. */
function renderPlanUpload(port: SpaceFormPort, d: SpaceDialogState): TemplateResult {
  const { host } = port;
  const t = host._t.bind(host);
  const {st} = settingsCopy(host);
  const image = d.planFile
        ? html`<span class="planname">${d.planFile.name}</span>`
        : d.planUrl
          ? html`<img class="planprev" src=${host._display(d.planUrl)} alt=${t('space.plan_alt')} />`
          : html`<span class="planname muted">${t('space.no_plan')}</span>`;
  const actions = html`
      <span class="fileupload">
        <button data-hp="action" data-action="backdrop-upload-open" class="btn filebtn" type="button" @click=${(e: Event) =>
          ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
          <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? port.northControl ? st('space.replace_image') : t('btn.replace') : t('btn.upload')}
        </button>
        <input data-hp="image-upload" data-kind="backdrop" type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
          @change=${(e: Event) => port.pickPlanFile(e)} />
      </span>
      <button data-hp="action" data-action="backdrop-server-plans" class="btn ghost" type="button" @click=${() => port.toggleServerPlans()}
        title=${t('space.pick_saved_hint')}>
        <ha-icon icon="mdi:folder-image"></ha-icon>${t('space.pick_saved')}
      </button>`;
  let filename = d.planFile?.name || d.planUrl?.split(/[?#]/)[0].split('/').pop() || t('space.no_plan');
  try { filename = decodeURIComponent(filename); } catch { /* Keep a readable legacy URL even with malformed escaping. */ }
  return html`${port.northControl
    ? html`<div class="hpf-plan-image">${image}${!d.planFile && d.planUrl ? html`<span class="hpf-plan-filename">${filename}</span>` : nothing}</div>
        <div class="hpf-plan-actions">${actions}</div>`
    : html`<div class="planrow hpf-plan-upload">${image}${actions}</div>`}
    ${d.pickSaved ? port.renderServerPlans(d) : nothing}`;
}

function renderAppearance(port: SpaceFormPort, d: SpaceDialogState, id: (n: string) => string, problemFor: ProblemFor): TemplateResult {
  const { host } = port, t = host._t.bind(host), { st,shelp } = settingsCopy(host);
  const appearance = spaceDraftAppearanceOf(d, d.mode === 'edit' ? host._curSpaceCfg : undefined, host._settings);
  const color = (kind: 'border' | 'fill' | 'name' | 'wall-fill') => {
    const value = kind === 'border' ? {c:d.roomColor,a:d.roomOpacity} : kind === 'name' ? appearance.nameColor
      : kind === 'wall-fill' ? appearance.wallFill : d.customFill || DEFAULT_CUSTOM_FILL;
    const label = kind === 'border' ? t('space.room_color') : kind === 'name' ? st('space.name_color')
      : kind === 'wall-fill' ? st('space.wall_fill') : t('space.custom_fill');
    const fieldId = id(kind === 'wall-fill' ? 'wall-fill' : `${kind}-color`);
    return colorRow({label, help:shelp(kind === 'border' ? 'space.border_color.help' : kind === 'name' ? 'space.name_color.help'
      : kind === 'wall-fill' ? 'space.wall_fill.help' : 'space.fill_color.help'),picker:colorField({hex:value.c,
      opacity:value.a,
      picker:html`<hp-color-opacity data-hp="field" data-field=${fieldId} .label=${label} hide-label flat-swatch .opacityLabel=${t('space.opacity')}
        .pickerLabels=${host._colorPickerLabels} .color=${value.c}
        .opacity=${value.a}
        @hp-color-opacity-change=${(e: CustomEvent<{color:string;opacity:number}>) => set(port, kind === 'border'
          ? {...d,roomColor:e.detail.color,roomOpacity:e.detail.opacity}
          : {...d,[kind === 'name' ? 'nameColor' : kind === 'wall-fill' ? 'wallFill' : 'customFill']:
            {...value,c:e.detail.color,a:e.detail.opacity}})}></hp-color-opacity>`})});
  };
  const temperature = (side: 'min' | 'max') => {
    const fieldId = id(`temp-${side}`), problem = problemFor(fieldId);
    return field({label:st(side === 'min' ? 'space.range_from' : 'space.range_to'), htmlFor:fieldId,
      error:problem ? st(problem.message) : undefined,
      control:unitInput({id:fieldId,wide:true,step:0.5,unit:'°C', invalid:!!problem,
        value:side === 'min' ? d.tempMinInput ?? String(d.tempMin) : d.tempMaxInput ?? String(d.tempMax),
        onInput:raw => {
          const n = strictNumber(raw);
          set(port,side === 'min' ? {...d,tempMinInput:raw,...(n !== null ? {tempMin:n} : {})}
            : {...d,tempMaxInput:raw,...(n !== null ? {tempMax:n} : {})});
        }})});
  };
  return formCard({id:'appearance',title:st('space.section_rooms'),body:spaceFormSections(port, [
          toggleRow({id:id('show-borders'),title:st('space.borders_openings'),help:shelp('space.borders_openings_hint'),
      checked:d.showBorders,onChange:v => set(port,{...touchSpaceDisplay(d,'showBorders',v),hideOpenings:!v})}),
          field({label:st('space.virtual_walls'),help:port.help('space.zero_wall_style.help'),control:selectControl({
      name:id('zero-wall-style'),value:d.zeroWallStyle,ariaLabel:st('space.virtual_walls'),
      options:[{value:'dashed',label:st('space.virtual_dashed')},{value:'solid',label:st('space.virtual_solid')}],
      onChange:v => set(port,{...d,zeroWallStyle:v})})}),
          color('border'),
          color('name'),
          field({label:t('space.fill_label'),help:port.help('space.fill_mode.help'),control:selectControl({
      name:id('fill-mode'),value:d.fillMode === 'none' ? 'custom' : d.fillMode,ariaLabel:t('space.fill_label'),
      options:SPACE_FILL_UI_MODES.map(value => ({value,label:st(`space.fill_${value}`)})),
      onChange:v => set(port,{...d,fillMode:v})})}),
          d.fillMode === 'custom' || d.fillMode === 'none' ? color('fill') : nothing,
          color('wall-fill'),
          d.fillMode === 'temp' ? html`<div class="hpf-field">
      <span class="hpf-label hpf-labelrow">${st('space.temp_range')}${shelp('space.comfort.help')}</span>
      <div class="hpf-temperature-range">${temperature('min')}${temperature('max')}</div>
    </div>` : nothing,
        ])});
}

function renderRoomCards(port: SpaceFormPort, d: SpaceDialogState, id: (n:string) => string): TemplateResult {
  const {host} = port, t = host._t.bind(host), {st,shelp} = settingsCopy(host);
  const sizes = (['cardNameScale','cardLabelScale'] as const).map((key,index) => {
    const label = st(index === 0 ? 'space.name_size' : 'space.metrics_size'), value = Math.round(d[key]*100);
    const change = (n:number) => set(port,{...d,[key]:n/100});
    return field({label,help:shelp(index === 0 ? 'space.name_size.help' : 'space.metrics_size.help'),htmlFor:id(index === 0 ? 'name-font' : 'label-font'),control:rangeLine({
      id:id(index === 0 ? 'name-font' : 'label-font'),min:50,max:300,step:5,value,unit:'%',ariaLabel:label,
      slider:port.rangeInput(50,300,5,value,change,false,label,id(index === 0 ? 'name-font-slider' : 'label-font-slider')),onInput:change})});
  });
  const tiles = ([
    ['labelTemp',t('space.label_temp'),'space.metric_temp.help'],['labelHum',t('space.label_hum'),'space.metric_hum.help'],
    ['labelCo2',st('space.metric_co2'),'space.metric_co2.help'],['labelLqi',st('space.metric_lqi'),'space.metric_lqi.help'],['labelLight',t('space.label_light'),'space.metric_light.help'],
  ] as const).map(([key,label,helpKey]) => ({id:id(`tile-${key}`),label,helpKey,checked:d[key],
    onChange:(v:boolean) => set(port,{...d,[key]:v})}));
  const inheritedBattery = deviceBatteryModeOf(host._settings);
  const batteryLabel = (mode: 'all'|'low'|'off') => st(`space.battery_${mode}`);
  const sourceLink = (section:string) => port.openGeneral ? textLink(st('space.open_general'),() => port.openGeneral!(section),{action:'open-general-settings',value:section}) : nothing;
  return formCard({id:'room-cards',title:st('space.section_metrics'),body:spaceFormSections(port, [
          toggleRow({id:id('show-names'),title:t('space.show_names'),help:shelp('space.names.help'),checked:d.showNames,
      onChange:v => set(port,touchSpaceDisplay(d,'showNames',v))}),
          html`<div class="hpf-field">${subsection({title:st('space.room_metrics')})}
      <p class="hpf-hint">${st('space.metrics_source_hint')}</p>
      <div class="hpf-room-metrics">${tiles.map(tile => toggleRow({id:tile.id,title:tile.label,help:shelp(tile.helpKey),checked:tile.checked,disabled:!d.showNames,onChange:tile.onChange}))}</div></div>`,
          html`${subsection({title:st('space.font_sizes')})}${sizes}`,
          html`<div class="hpf-tint hpf-preview">${roomCardPreview(t,st('preview.room_name'),d.cardNameScale,1,1,
      d.labelCo2 ? 820 : undefined,d.cardLabelScale,{temp:d.labelTemp,hum:d.labelHum,lqi:d.labelLqi,light:d.labelLight,showName:d.showNames},
      spaceDraftAppearanceOf(d,d.mode === 'edit' ? host._curSpaceCfg : undefined,host._settings).nameColor)}</div>`,
          html`${subsection({title:st('space.device_metrics')})}${field({label:st('space.device_battery'),control:selectControl<SpaceDeviceBatteryMode>({
      name:id('battery-mode'),value:d.deviceBatteryMode,ariaLabel:st('space.device_battery'),
      options:[{value:'inherit',label:st('space.inherited_value',{v:batteryLabel(inheritedBattery)})},
        ...(['all','low','off'] as const).map(value => ({value,label:batteryLabel(value)}))],
      onChange:deviceBatteryMode => set(port,{...d,deviceBatteryMode})})})}`,
          html`${field({label:t('space.show_lqi'),help:shelp('gs.signal_help'),control:selectControl<SignalVisibilityMode>({
      name:id('show-lqi'),value:d.showLqiMode,ariaLabel:t('space.show_lqi'),
      options:[{value:'inherit',label:st('space.inherited_value',{v:st(globalSignalVisibleOf(host._settings) ? 'space.lqi_on' : 'space.lqi_off')})},
        {value:'on',label:st('space.lqi_on')},{value:'off',label:st('space.lqi_off')}],
      onChange:showLqiMode => set(port,{...d,showLqiMode})})})}
          ${port.openGeneral ? html`<div class="hpf-context-links">${sourceLink('display')}</div>` : nothing}`,
        ])});
}

function renderSunAndLight(port: SpaceFormPort, d: SpaceDialogState, id:(n:string) => string, problemFor:ProblemFor): TemplateResult {
  const {host} = port, t = host._t.bind(host), {st} = settingsCopy(host);
  const inheritedNorth = northDegOf(host._settings,{}), inheritedColor = stageBgOf(host._settings,{bgColor:null}) || host._stageBgHex();
  const northProblem = problemFor(id('north-deg'));
  const northInput = (raw:string) => {
    const n = strictNumber(raw);
    set(port,{...d,northDegInput:raw,...(n !== null && Number.isInteger(n) && n >= 0 && n <= 359 ? {northDeg:n} : {})});
  };
  return formCard({id:'sun',title:st('space.section_background'),body:spaceFormSections(port, [
          html`${spaceFormSections(port,[field({label:st('space.background_label'),help:port.help('space.bg_mode.help'),control:html`${selectControl({
      name:id('bg-mode'),value:d.bgMode ?? '',ariaLabel:st('space.background_label'),
      options:[{value:'',label:st('space.inherited_value',{v:t(bgModeOf(host._settings,{}) === 'static' ? 'gs.bg_static' : 'gs.bg_daynight')})},
        {value:'static',label:t('gs.bg_static')},{value:'daynight',label:t('gs.bg_daynight')}],
      onChange:v => set(port,{...d,bgMode:v === 'static' || v === 'daynight' ? v : null,...(v === '' ? {bgColor:null} : {})})})}
      ${d.bgMode === null && bgModeOf(host._settings,{}) === 'static' ? html`<div class="hpf-inherited-color">
        <span class="hpf-inherited-swatch" style=${`background:${inheritedColor}`} aria-hidden="true"></span>
        <span>${st('space.inherited_color',{v:inheritedColor})}</span></div>` : nothing}`}),
          d.bgMode === 'static' ? colorRow({label:t('space.bg_color'),picker:colorField({hex:d.bgColor || inheritedColor,
      picker:html`<hp-color-opacity data-hp="field" data-field="space-bg-color" .label=${t('space.bg_color')} hide-label flat-swatch .pickerLabels=${host._colorPickerLabels}
        .color=${d.bgColor || inheritedColor} .opacity=${1} .showOpacity=${false}
        @hp-color-opacity-change=${(e:CustomEvent<{color:string}>) => set(port,{...d,bgColor:e.detail.color})}></hp-color-opacity>`})})
      : nothing])}
          ${port.openGeneral ? html`<div class="hpf-context-links">${textLink(st('space.open_general'),() => port.openGeneral!('plan'),{action:'open-general-settings',value:'plan'})}</div>` : nothing}`,
          field({label:t('space.sun_rays'),control:selectControl({name:id('sun-rays'),value:d.sunRays === null ? '' : d.sunRays ? '1' : '0',ariaLabel:t('space.sun_rays'),
      options:[{value:'',label:st('space.inherited_value',{v:t(sunRaysOn(host._settings,{}) ? 'space.sun_on' : 'space.sun_off')})},{value:'1',label:t('space.sun_on')},{value:'0',label:t('space.sun_off')}],
      onChange:v => set(port,{...d,sunRays:v === '' ? null : v === '1'})})}),
          html`${spaceFormSections(port,[field({label:t('space.north'),help:port.help('space.north.help'),control:selectControl({name:id('north-mode'),value:d.northDeg === null ? 'inherit' : 'custom',ariaLabel:t('space.north'),
      options:[{value:'inherit',label:st('space.north_general',{v:inheritedNorth === null ? '—' : `${inheritedNorth}°`})},{value:'custom',label:st('space.north_custom')}],
      onChange:v => {const northDeg = v === 'custom' ? inheritedNorth ?? 0 : null;set(port,{...d,northDeg,northDegInput:northDeg === null ? '' : String(northDeg)});}})}),
          d.northDeg !== null ? html`<div class="hpf-field">
      ${port.northControl ? port.northControl({id:id('north-deg'),value:d.northDeg,raw:d.northDegInput ?? String(d.northDeg),label:t('space.north'),angleHint:st('gs.north_angle_hint'),invalid:!!northProblem,
        onInput:northInput,onChange:n => set(port,{...d,northDeg:n,northDegInput:String(n)})})
        : html`${compass(d.northDeg,t('space.north'))}${unitInput({id:id('north-deg'),value:d.northDegInput ?? String(d.northDeg),unit:'°',min:0,max:359,step:1,onInput:northInput})}`}
      ${port.northControl ? callout({text:st('gs.north_description')}) : nothing}
      ${northProblem ? html`<p class="hpf-error" role="alert">${st(northProblem.message)}</p>` : nothing}
    </div>` : nothing])}
          ${port.openGeneral ? html`<div class="hpf-context-links">${textLink(st('space.open_general'),() => port.openGeneral!('sun'),{action:'open-general-settings',value:'sun'})}</div>` : nothing}`,
        ])});
}

/** Onboarding keeps its original unsectioned layout. */
function spaceFormSections(port: SpaceFormPort, rows: readonly FormSectionContent[]): TemplateResult {
  return port.northControl ? formSections(rows) : html`${rows}`;
}
