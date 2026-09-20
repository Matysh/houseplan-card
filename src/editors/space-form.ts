/**
 * Форма «Пространство» по референсу `docs/design/600-settings-dialogs/`
 * (#600, серия 1; §4 SPEC.md).
 *
 * Один рендерер на двух потребителей: редакторский рантайм (edit/create,
 * `space-settings-dialog.ts`) и онбординг (первое пространство, импорт). До
 * #600 у онбординга была своя копия разметки на 300 строк — теперь обе стороны
 * подают узкий порт с тем, что у них различается (кто открывает файлы, кто
 * сохраняет, кто удаляет), а форму рисует одно место. Состояние остаётся на
 * хосте (#592 К2); `SpaceDialogState` не получил ни одного нового ключа.
 *
 * Модуль намеренно не импортирует ничего редакторского (копирование
 * пространства, рантайм): онбординг — отдельный ленивый граф первого запуска,
 * и тянуть в него редактор ради общей формы нельзя (К8).
 *
 * Расхождение с референсом здесь — находка, а не вкус: каждый блок назван
 * пунктом §4.2, чтобы ревью сверяло по документу, а не на глаз.
 */
import { html, nothing, type TemplateResult } from 'lit';

import {
  callout, choiceCards, colorField, colorRow, compass, divider, ensureFormKitStyles, field,
  fieldGrid, footerStatus, formCard, radioRow, rangeEnds, rangeLine, segmented, subsection,
  textLink, toggleRow, compactList, unitInput, valueTiles,
} from './form-kit';

import { gridCellFieldToCm, gridCellFieldValue } from '../grid-scale';
import {
  DEFAULT_CUSTOM_FILL, DEFAULT_ROOM_COLOR, DEFAULT_ROOM_OPACITY, SPACE_FILL_UI_MODES, stageBgOf,
} from '../logic';
import { forgetSpaceDialogBaseline, spaceDialogDirty, spaceDialogProblems } from './space-form-state';
import {
  strictNumber, switchSpacePlanSource, touchSpaceDisplay, type SpaceDialogState,
} from '../space-dialog';
import { bgModeOf, northDegOf } from '../sun';
import { langOf, type I18nKey } from '../i18n';
import { hasSettingsTranslation, settingsT, type SettingsI18nKey } from '../i18n/settings';
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
/* #592: границы шага сетки живут рядом с полем, которое их показывает; кламп
 * записи в редакторском рантайме импортирует их отсюда — одно число, один
 * источник, и направление импорта то же, что у самой функции рисования. */
export const CELL_CM_MIN = 0.1;
export const CELL_CM_MAX = 1000;

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
    onInput: (v: number) => void, disabled?: boolean, ariaLabel?: string,
  ): TemplateResult;
  pickPlanFile(event: Event): void | Promise<void>;
  toggleServerPlans(): void | Promise<void>;
  renderServerPlans(d: SpaceDialogState): TemplateResult;
  save(): void | Promise<void>;
  skipImport(): void;
  /** Только редактор: онбординг создаёт, а не правит. */
  deleteSpace?(): void | Promise<void>;
  copySpace?(): void;
}

const set = (port: SpaceFormPort, next: SpaceDialogState): void => { port.host._spaceDialog = next; };

/**
 * Новые строки диалогов живут в ленивом словаре `i18n/settings` (приём
 * #423/#459), а не в основном каталоге: диалоги — инструмент администратора,
 * и их подписи не должны ехать в первый кадр (К8). Прежние ключи `space.*`
 * остаются в основном каталоге и читаются через `_t`, как раньше.
 */
interface SettingsCopy {
  st(key: SettingsI18nKey, vars?: Record<string, string | number>): string;
  /** «?» из ленивого словаря: текст и aria-подпись обязаны быть оба. */
  shelp(key: SettingsI18nKey): TemplateResult | typeof nothing;
}
function settingsCopy(host: HouseplanEditorHostPort): SettingsCopy {
  const lang = langOf(host.hass, host._config?.language);
  return {
    st: (key, vars) => settingsT(lang, key, vars),
    shelp: (key) => {
      const ariaKey = `${key}.aria`;
      if (!hasSettingsTranslation(lang, key) || !hasSettingsTranslation(lang, ariaKey)) return nothing;
      return html`<hp-help data-help-key=${key} .text=${settingsT(lang, key)} .ariaLabel=${settingsT(lang, ariaKey)}></hp-help>`;
    },
  };
}

/** Части формы: заголовок и бейдж оболочки, тело из четырёх карточек, футер, закрытие. */
export interface SpaceFormParts {
  title: string;
  badge: string;
  body: TemplateResult;
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
  const problems = spaceDialogProblems(d, port.idPrefix);
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
    const dialog = event.currentTarget as { rejectClose?: () => void } | null;
    const discard = await host._confirmDanger({
      key: 'discard-space-dialog', kind: 'warning',
      title: st('dialog.discard_title'), message: st('dialog.discard_message'),
      objectName: d.title.trim() || undefined,
      confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
    });
    if (discard) close(); else dialog?.rejectClose?.();
  };
  const reviewFirst = () => {
    const first = problems[0];
    if (!first) return;
    const root = host.renderRoot as ParentNode;
    const node = root.querySelector<HTMLElement>(`#${first.field}`);
    node?.scrollIntoView({ block: 'center' });
    node?.focus();
  };

  return {
    title: `${d.mode === 'create' ? t('space.new') : t('space.header')}${progress ? ` · ${progress}` : ''}`,
    badge: d.mode === 'edit' ? d.title.trim() : '',
    requestClose,
    body: html`<div class="body hpf-form">
      ${renderBasics(port, d, id, problemFor)}
      ${renderAppearance(port, d, id, problemFor)}
      ${renderRoomCards(port, d, id)}
      ${renderSunAndLight(port, d, id, problemFor)}
      ${d.deleteBlockers
        ? callout({ kind: 'warning', role: 'alert', text: t('space.delete_blocked', { n: String(d.deleteBlockers) }) })
        : nothing}
    </div>`,
    footer: html`<div class="row dialog-action-footer hpf-footer" slot="footer">
      ${d.mode === 'edit' && port.copySpace
        ? html`<div class="dialog-action-group">
            <button class="btn ghost" @click=${() => port.copySpace!()} ?disabled=${d.busy}>
              <ha-icon icon="mdi:content-copy"></ha-icon>${t('btn.copy')}
            </button>
          </div>`
        : nothing}
      ${d.mode === 'edit' && port.deleteSpace
        ? html`<div class="dialog-action-group dialog-action-danger">
            <button class="btn danger" @click=${() => port.deleteSpace!()} ?disabled=${d.busy}>
              <ha-icon icon="mdi:delete-outline"></ha-icon>${t('btn.delete')}
            </button>
          </div>`
        : nothing}
      ${footerStatus(problems.length
        ? { action: textLink(st('dialog.review_fields', { n: String(problems.length) }), reviewFirst) }
        : { text: dirty ? st('dialog.unsaved') : '' })}
      <div class="dialog-action-group dialog-action-commit">
        ${host._importTotal > 0 && d.mode === 'create'
          ? html`<button class="btn ghost" @click=${() => port.skipImport()}>${t('btn.skip')}</button>`
          : nothing}
        <button class="btn ghost" data-hp="dialog-cancel" @click=${requestClose}>${t('btn.cancel')}</button>
        <button class="btn on" data-hp="dialog-confirm" @click=${() => port.save()} ?disabled=${!canSave}
          title=${problems[0] ? st(problems[0].message) : ''}>
          <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : t('btn.save')}
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
  const planProblem = problemFor(id('plan'));
  return formCard({
    id: 'basics',
    title: t('space.card_basics'),
    body: html`
      ${fieldGrid([
        field({
          label: t('space.title_label'), htmlFor: id('title'), hint: st('space.title_hint'),
          error: titleProblem ? st(titleProblem.message) : undefined,
          control: html`<input id=${id('title')} class="hpf-input" type="text" maxlength="80"
            placeholder=${t('space.title_ph')} .value=${d.title}
            aria-invalid=${titleProblem ? 'true' : nothing}
            @input=${(e: Event) => set(port, { ...d, title: (e.target as HTMLInputElement).value })} />`,
        }),
        field({
          label: t('space.scale_label'), htmlFor: id('cell-cm'), help: port.help('space.cell_cm.help'),
          hint: st('space.scale_hint'),
          control: unitInput({
            id: id('cell-cm'), wide: true,
            value: d.cellCmInput ?? gridCellFieldValue(d.cellCm, host._imperial),
            unit: t(host._imperial ? 'space.scale_unit_imperial' : 'space.scale_unit'),
            min: Number(gridCellFieldValue(CELL_CM_MIN, host._imperial)),
            max: Number(gridCellFieldValue(CELL_CM_MAX, host._imperial)),
            step: 0.1,
            onInput: (raw) => {
              const n = strictNumber(raw);
              const canonical = n == null ? null : gridCellFieldToCm(n, host._imperial);
              set(port, {
                ...d, cellCmInput: raw, cellCmTouched: true,
                cellCm: canonical != null && canonical > 0
                  ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, canonical)) : d.cellCm,
              });
            },
          }),
        }),
      ], { narrow: true })}
      ${scaleChanged ? callout({ kind: 'warning', text: st('space.scale_changed') }) : nothing}
      ${subsection({ title: t('space.plan_label'), help: shelp('space.plan.help') })}
      <div id=${id('plan')} tabindex="-1" aria-invalid=${planProblem ? 'true' : nothing}>
        ${choiceCards('plansrc', d.source, [
          { value: 'draw', title: t('space.source_draw'), caption: st('space.source_draw_hint') },
          { value: 'file', title: t('space.source_file'), caption: st('space.source_file_hint') },
        ], (value) => set(port, switchSpacePlanSource(d, value)), t('space.plan_label'))}
      </div>
      ${d.source === 'file' ? renderPlanUpload(port, d) : nothing}
      ${d.source === 'draw' && d.planUrl ? callout({ text: st('space.plan_kept') }) : nothing}
      ${planProblem ? html`<p class="hpf-error" role="alert">${st(planProblem.message)}</p>` : nothing}`,
  });
}

/** Панель загрузки подложки: существующий пикер файлов и серверный список. */
function renderPlanUpload(port: SpaceFormPort, d: SpaceDialogState): TemplateResult {
  const { host } = port;
  const t = host._t.bind(host);
  return html`<div class="planrow">
      ${d.planFile
        ? html`<span class="planname">${d.planFile.name}</span>`
        : d.planUrl
          ? html`<img class="planprev" src=${host._display(d.planUrl)} alt=${t('space.plan_alt')} />`
          : html`<span class="planname muted">${t('space.no_plan')}</span>`}
      <span class="fileupload">
        <button class="btn filebtn" type="button" @click=${(e: Event) =>
          ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
          <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? t('btn.replace') : t('btn.upload')}
        </button>
        <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
          @change=${(e: Event) => port.pickPlanFile(e)} />
      </span>
      <button class="btn ghost" type="button" @click=${() => port.toggleServerPlans()}
        title=${t('space.pick_saved_hint')}>
        <ha-icon icon="mdi:folder-image"></ha-icon>${t('space.pick_saved')}
      </button>
    </div>
    ${d.pickSaved ? port.renderServerPlans(d) : nothing}`;
}

/** §4.2 карточка 2: Appearance — границы, стены, цвет, заливка, слои. */
function renderAppearance(port: SpaceFormPort, d: SpaceDialogState, id: (n: string) => string, problemFor: ProblemFor): TemplateResult {
  const { host } = port;
  const t = host._t.bind(host);
  const { st, shelp } = settingsCopy(host);
  const tempProblem = problemFor(id('temp-max'));
  const fillDetail = d.fillMode === 'custom'
    ? colorRow({
        label: t('space.custom_fill'),
        picker: colorField({
          hex: (d.customFill || DEFAULT_CUSTOM_FILL).c,
          opacity: (d.customFill || DEFAULT_CUSTOM_FILL).a,
          opacityLabel: t('space.opacity'),
          onOpacity: (a) => set(port, { ...d, customFill: { c: (d.customFill || DEFAULT_CUSTOM_FILL).c, a } }),
          resetLabel: d.customFill ? t('btn.reset') : undefined,
          onReset: () => set(port, { ...d, customFill: null }),
          picker: html`<hp-color-opacity .label=${t('space.custom_fill')} hide-label .opacityLabel=${t('space.opacity')}
            .pickerLabels=${host._colorPickerLabels}
            .color=${(d.customFill || DEFAULT_CUSTOM_FILL).c} .opacity=${(d.customFill || DEFAULT_CUSTOM_FILL).a}
            @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
              set(port, { ...d, customFill: { c: e.detail.color, a: e.detail.opacity } });
            }}></hp-color-opacity>`,
        }),
      })
    : d.fillMode === 'temp'
      ? html`<div class="hpf-field">
          <span class="hpf-label hpf-labelrow">${st('space.temp_range')}</span>
          ${fieldGrid([
            field({
              label: st('space.temp_min'), htmlFor: id('temp-min'),
              control: unitInput({
                id: id('temp-min'), wide: true, value: String(d.tempMin), unit: '°C', step: 0.5,
                onInput: (raw) => { const n = strictNumber(raw); if (n != null) set(port, { ...d, tempMin: n }); },
              }),
            }),
            field({
              label: st('space.temp_max'), htmlFor: id('temp-max'),
              error: tempProblem ? st(tempProblem.message) : undefined,
              control: unitInput({
                id: id('temp-max'), wide: true, value: String(d.tempMax), unit: '°C', step: 0.5, invalid: !!tempProblem,
                onInput: (raw) => { const n = strictNumber(raw); if (n != null) set(port, { ...d, tempMax: n }); },
              }),
            }),
          ])}
          <div class="hpf-templegend" aria-hidden="true">
            <span>${t('gs.temp_cold')}</span><span>${t('gs.temp_ok')}</span><span>${t('gs.temp_hot')}</span>
          </div>
          <p class="hpf-hint">${st('space.temp_range_hint')}</p>
        </div>`
      : html`<p class="hpf-hint">${st(d.fillMode === 'lqi' ? 'space.fill_lqi_hint' : 'space.fill_light_hint')}</p>`;

  return formCard({
    id: 'appearance',
    title: t('space.display_section'),
    body: html`
      ${toggleRow({
        id: id('show-borders'), icon: 'mdi:border-none-variant',
        title: t('space.show_borders'), caption: st('space.show_borders_hint'),
        help: shelp('space.show_borders.help'),
        checked: d.showBorders, onChange: (v) => set(port, touchSpaceDisplay(d, 'showBorders', v)),
      })}
      ${field({
        label: t('space.zero_wall_style'), help: port.help('space.zero_wall_style.help'),
        control: segmented({
          name: `${port.idPrefix}-zero-wall-style`,
          value: d.zeroWallStyle === 'solid' ? 'solid' : 'dashed',
          ariaLabel: t('space.zero_wall_style'),
          options: [
            { value: 'dashed', label: t('space.zero_wall_dashed'), sample: 'dashed' },
            { value: 'solid', label: t('space.zero_wall_solid'), sample: 'solid' },
          ],
          onChange: (value) => set(port, { ...d, zeroWallStyle: value === 'solid' ? 'solid' : 'dashed' }),
        }),
      })}
      ${colorRow({
        label: t('space.room_color'),
        picker: colorField({
          hex: d.roomColor, opacity: d.roomOpacity, opacityLabel: t('space.opacity'),
          onOpacity: (a) => set(port, { ...d, roomOpacity: a }),
          resetLabel: d.roomColor !== DEFAULT_ROOM_COLOR || d.roomOpacity !== DEFAULT_ROOM_OPACITY ? t('btn.reset') : undefined,
          onReset: () => set(port, { ...d, roomColor: DEFAULT_ROOM_COLOR, roomOpacity: DEFAULT_ROOM_OPACITY }),
          picker: html`<hp-color-opacity .label=${t('space.room_color')} hide-label .opacityLabel=${t('space.opacity')}
            .pickerLabels=${host._colorPickerLabels}
            .color=${d.roomColor} .opacity=${d.roomOpacity} .showOpacity=${true}
            @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
              set(port, { ...d, roomColor: e.detail.color, roomOpacity: e.detail.opacity });
            }}></hp-color-opacity>`,
        }),
      })}
      ${subsection({ title: t('space.fill_label'), help: port.help('space.fill_mode.help') })}
      ${segmented({
        name: `${port.idPrefix}-fill-mode`,
        value: d.fillMode === 'none' ? 'custom' : d.fillMode,
        ariaLabel: t('space.fill_label'),
        options: SPACE_FILL_UI_MODES.map((v) => ({ value: v, label: t(`fill.${v}` as I18nKey) })),
        onChange: (v) => set(port, { ...d, fillMode: v }),
      })}
      ${fillDetail}
      ${subsection({ title: st('space.layers_label'), help: shelp('space.layers.help') })}
      ${compactList([
        toggleRow({
          id: id('layer-decor'), compact: true, icon: 'mdi:sofa-outline', title: st('space.layer_decor'),
          checked: !d.hideDecor, onChange: (v) => set(port, { ...d, hideDecor: !v }),
        }),
        toggleRow({
          id: id('layer-openings'), compact: true, icon: 'mdi:door', title: st('space.layer_openings'),
          checked: !d.hideOpenings, onChange: (v) => set(port, { ...d, hideOpenings: !v }),
        }),
        toggleRow({
          id: id('show-lqi'), compact: true, icon: 'mdi:zigbee', title: t('space.show_lqi'),
          checked: d.showLqi, onChange: (v) => set(port, { ...d, showLqi: v }),
        }),
      ])}`,
  });
}

/** §4.2 карточка 3: Room cards — названия, плитки значений, размер шрифта, образец (Q2). */
function renderRoomCards(port: SpaceFormPort, d: SpaceDialogState, id: (n: string) => string): TemplateResult {
  const { host } = port;
  const t = host._t.bind(host);
  const { st, shelp } = settingsCopy(host);
  const pct = Math.round(d.cardFontScale * 100);
  const tiles = ([
    ['labelTemp', 'space.label_temp', 'mdi:thermometer', undefined],
    ['labelHum', 'space.label_hum', 'mdi:water-outline', undefined],
    ['labelLqi', 'space.label_lqi_short', 'mdi:zigbee', 'space.label_lqi'],
    ['labelLight', 'space.label_light', 'mdi:lightbulb-outline', undefined],
  ] as const).map(([key, label, icon, full]) => ({
    id: id(`tile-${key}`),
    label: label === 'space.label_lqi_short' ? st(label) : t(label),
    icon, title: full ? t(full) : undefined,
    checked: d[key], disabled: !d.showNames,
    onChange: (v: boolean) => set(port, { ...d, [key]: v }),
  }));
  return formCard({
    id: 'room-cards',
    title: t('space.roomcard_section'),
    body: html`
      ${toggleRow({
        id: id('show-names'), icon: 'mdi:format-text',
        title: t('space.show_names'), caption: st('space.show_names_hint'),
        help: shelp('space.show_names.help'),
        checked: d.showNames, onChange: (v) => set(port, touchSpaceDisplay(d, 'showNames', v)),
      })}
      <div class="hpf-field">
        <span class="hpf-label hpf-labelrow">${st('space.card_values')}</span>
        ${valueTiles(tiles, st('space.card_values'))}
        ${!d.showNames
          ? callout({
              icon: 'mdi:eye-off-outline', text: st('space.values_hidden'),
              action: textLink(st('space.values_hidden_action'), () => set(port, touchSpaceDisplay(d, 'showNames', true))),
            })
          : nothing}
      </div>
      <div class="hpf-field">
        <div class="hpf-headline">
          <span class="hpf-label hpf-labelrow"><label for=${id('card-font')}>${t('space.card_font')}</label>${shelp('space.card_font.help')}</span>
          ${textLink(st('btn.reset_100'), () => set(port, { ...d, cardFontScale: 1 }), { disabled: pct === 100 })}
        </div>
        ${rangeLine({
          min: 50, max: 300, step: 5, value: pct, unit: '%', ariaLabel: t('space.card_font'),
          slider: port.rangeInput(50, 300, 5, pct, (n) => set(port, { ...d, cardFontScale: n / 100 }), false, t('space.card_font')),
          onInput: (n) => set(port, { ...d, cardFontScale: n / 100 }),
        })}
        ${rangeEnds('50%', '300%')}
        <p class="hpf-hint">${st('space.card_font_hint')}</p>
      </div>
      <div class="hpf-tint hpf-preview">${host._renderCardPreview(d.cardFontScale, 1, 1)}</div>`,
  });
}

/** §4.2 карточка 4: Sun & light — фон, лучи, север с компасом, свечение. */
function renderSunAndLight(port: SpaceFormPort, d: SpaceDialogState, id: (n: string) => string, problemFor: ProblemFor): TemplateResult {
  const { host } = port;
  const t = host._t.bind(host);
  const { st, shelp } = settingsCopy(host);
  const inheritedNorth = northDegOf(host._settings, {});
  const effectiveNorth = d.northDeg ?? inheritedNorth;
  const northProblem = problemFor(id('north-deg'));
  const inheritedLabel = inheritedNorth === null ? '—' : `${inheritedNorth}°`;
  return formCard({
    id: 'sun',
    title: t('space.card_sun'),
    body: html`
      ${field({
        label: t('space.bg_mode'), help: port.help('space.bg_mode.help'),
        control: segmented({
          name: `${port.idPrefix}-bg-mode`,
          value: d.bgMode ?? '',
          ariaLabel: t('space.bg_mode'),
          options: [
            { value: '', label: t('space.sun_inherit') },
            { value: 'static', label: t('gs.bg_static') },
            { value: 'daynight', label: t('gs.bg_daynight') },
          ],
          onChange: (v) => set(port, { ...d, bgMode: v === 'static' || v === 'daynight' ? v : null }),
        }),
      })}
      ${(d.bgMode ?? bgModeOf(host._settings, {})) === 'static'
        ? colorRow({
            label: t('space.bg_color'),
            picker: colorField({
              hex: d.bgColor || stageBgOf(host._settings, { bgColor: null }) || host._stageBgHex(),
              resetLabel: d.bgColor ? t('space.bg_inherit') : undefined,
              onReset: () => set(port, { ...d, bgColor: null }),
              picker: html`<hp-color-opacity .label=${t('space.bg_color')} hide-label .pickerLabels=${host._colorPickerLabels}
                .color=${d.bgColor || stageBgOf(host._settings, { bgColor: null }) || host._stageBgHex()}
                .opacity=${1} .showOpacity=${false}
                @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => set(port, { ...d, bgColor: e.detail.color })}></hp-color-opacity>`,
            }),
          })
        : nothing}
      ${radioRow({
        label: t('space.sun_rays'), name: `${port.idPrefix}-sun-rays`,
        value: d.sunRays === null ? '' : d.sunRays ? '1' : '0',
        options: [
          { value: '', label: st('space.sun_inherit_short') },
          { value: '1', label: t('space.sun_on') },
          { value: '0', label: t('space.sun_off') },
        ],
        onChange: (v) => set(port, { ...d, sunRays: v === '' ? null : v === '1' }),
      })}
      ${divider()}
      <div class="hpf-north">
        <span class="hpf-labelrow"><label for=${id('north-mode')}>${t('space.north')}</label>${port.help('space.north.help')}</span>
        <select id=${id('north-mode')} class="hpf-select"
          @change=${(e: Event) => {
            const custom = (e.target as HTMLSelectElement).value === 'custom';
            set(port, { ...d, northDeg: custom ? (inheritedNorth ?? 0) : null });
          }}>
          <option value="inherit" ?selected=${d.northDeg === null}>${st('space.north_general', { v: inheritedLabel })}</option>
          <option value="custom" ?selected=${d.northDeg !== null}>${st('space.north_custom')}</option>
        </select>
        <span class="hpf-north-n" aria-hidden="true">N</span>
        ${compass(effectiveNorth, st('space.compass_aria', { v: effectiveNorth === null ? '—' : `${effectiveNorth}°` }))}
      </div>
      ${d.northDeg !== null
        ? field({
            label: st('space.north_deg'), htmlFor: id('north-deg'),
            error: northProblem ? st(northProblem.message) : undefined,
            control: html`<div class="hpf-inline hpf-wrap">
              ${unitInput({
                id: id('north-deg'), value: String(d.northDeg), unit: '°', min: 0, max: 359, step: 1, invalid: !!northProblem,
                onInput: (raw) => {
                  const n = raw.trim() === '' ? NaN : Number(raw);
                  set(port, { ...d, northDeg: Number.isFinite(n) ? Math.round(n) : d.northDeg });
                },
              })}
              ${textLink(st('space.sun_inherit_short'), () => set(port, { ...d, northDeg: null }))}
            </div>`,
          })
        : nothing}
      ${toggleRow({
        id: id('glow'), icon: 'mdi:lightbulb-outline',
        title: t('space.glow_enabled'), caption: st('space.glow_enabled_hint'),
        help: shelp('space.glow_enabled.help'),
        checked: d.glowEnabled, onChange: (v) => set(port, { ...d, glowEnabled: v }),
      })}`,
  });
}

