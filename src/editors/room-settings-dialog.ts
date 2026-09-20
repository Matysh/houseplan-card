/**
 * Диалог «Настройки комнаты» по референсу `docs/design/600-settings-dialogs/`
 * (#600, серия 3; §6 SPEC.md).
 *
 * #592 вынес тело, #594 собрал четыре карточки набором, #600 переложил их
 * содержимое: имя и зона в две колонки, «Как у пространства» строкой-тумблером
 * (Q4) с сегментом режимов под ней, плашка цвета вокруг прежнего пикера (Q5),
 * границы комфорта полями с единицей, источники сегментами с кнопкой выбора и
 * панелью в потоке, размеры шрифта слайдерами с числом и сбросом, образец
 * карточки сохранён (Q2). Черновик — те же поля хоста, что и раньше (К1).
 */
import { html, nothing, type TemplateResult } from 'lit';

import { langOf, type I18nKey } from '../i18n';
import { settingsT, type SettingsI18nKey } from '../i18n/settings';
import { ROOM_FILL_MODES, spaceDisplayOf } from '../logic';
import { roomTempThresholdDraft, strictNumber } from '../space-dialog';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import {
  colorField, colorRow, ensureFormKitStyles, field, fieldGrid, footerStatus, formCard, rangeEnds,
  rangeLine, segmented, sourcePicker, subsection, textLink, toggleRow, unitInput,
} from './form-kit';
import { forgetRoomBaseline, roomDirty, roomProblems } from './room-form-state';

type RoomFillMode = typeof ROOM_FILL_MODES[number];

/**
 * Источник измерения: сегмент «среднее / конкретный датчик»; при выборе
 * конкретного — кнопка выбора и панель с поиском в потоке карточки. Кандидаты
 * (`_roomSrcCandidates`) и запись (`_roomTempSrc` / `_roomHumSrc`) прежние.
 */
function renderRoomSource(runtime: HouseplanEditorRuntime, kind: 'temp' | 'hum'): TemplateResult {
  const host = runtime.host;
  const val = kind === 'temp' ? host._roomTempSrc : host._roomHumSrc;
  const setVal = (v: string) => {
    if (kind === 'temp') host._roomTempSrc = v;
    else host._roomHumSrc = v;
    host.requestUpdate();
  };
  const open = host._roomSrcOpen === kind;
  const label = host._t(kind === 'temp' ? 'room.temp_src_label' : 'room.hum_src_label');
  return html`${subsection({ title: label })}
    ${segmented<'avg' | 'pick'>({
      name: `rsrc-${kind}`,
      value: val ? 'pick' : 'avg',
      ariaLabel: label,
      options: [
        { value: 'avg', label: host._t('room.src_average') },
        { value: 'pick', label: host._t('room.src_pick') },
      ],
      onChange: (choice) => {
        if (choice === 'avg') { setVal(''); host._roomSrcOpen = null; return; }
        host._roomSrcOpen = kind;
        host._roomSrcFilter = '';
        host.requestUpdate();
      },
    })}
    ${val || open
      ? sourcePicker({
          id: `room-${kind}-source`,
          open,
          current: val ? { label: runtime._roomSrcLabel(val), sub: val } : null,
          placeholder: host._t('room.src_ph'),
          ariaLabel: label,
          filter: host._roomSrcFilter,
          filterPlaceholder: host._t('marker.search_ph'),
          candidates: open ? runtime._roomSrcCandidates() : [],
          selected: val,
          emptyText: host._t('marker.nothing_found'),
          onToggle: () => { host._roomSrcOpen = open ? null : kind; host._roomSrcFilter = ''; host.requestUpdate(); },
          onFilter: (v) => { host._roomSrcFilter = v; host.requestUpdate(); },
          onPick: (v) => { setVal(v); host._roomSrcOpen = null; },
        })
      : nothing}`;
}

export function renderRoomSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureFormKitStyles(this.host);
  const host = this.host;
  const t = host._t.bind(host);
  const lang = langOf(host.hass, host._config?.language);
  const st = (key: SettingsI18nKey, vars?: Record<string, string | number>) => settingsT(lang, key, vars);
  const edit = !!host._roomEditId;
  const faceBatch = !edit ? host._wallFaceBatch : null;
  const batchProgress = faceBatch && faceBatch.candidates.length > 1
    ? t('room.queue_progress', { current: faceBatch.index + 1, total: faceBatch.candidates.length })
    : '';
  const spaceDisplay = spaceDisplayOf(host._curSpaceCfg);
  const inherit = host._roomFill === '';
  const effectiveFill = host._roomFill || spaceDisplay.fill;
  const customFill = host._roomCustomFill || spaceDisplay.customFill;
  const tempValid = roomTempThresholdDraft(host._roomTempMin, host._roomTempMax).valid;
  const problems = roomProblems(host);
  const problemFor = (fieldId: string) => problems.find((p) => p.field === fieldId);
  const dirty = roomDirty(host);
  /* К10 (Q1): в edit «Сохранить» активен только при изменениях; в create черновик
   * новой комнаты сохранять есть всегда — условие прежнее (имя или зона, границы). */
  const canSave = problems.length === 0 && tempValid && (edit ? dirty : true);
  // the free-areas list must include the edited room's CURRENT area
  const areas = [...host._freeAreas];
  if (edit && host._areaSel && !areas.some((a) => a.area_id === host._areaSel)) {
    const cur = host.hass.areas[host._areaSel];
    if (cur) areas.unshift(cur);
  }
  const close = () => { forgetRoomBaseline(host); this._roomDialogCancel(); };
  /* К10: закрытие с изменениями в edit спрашивает. В create отмена и раньше
   * значила «не создавать» и возвращала контур на план (`_roomDialogCancel`) —
   * вопрос там мешал бы очереди «Room N of M», а терять нечего. */
  const requestClose = async (event: Event) => {
    if (!edit || !dirty) { close(); return; }
    const dialog = event.currentTarget as { rejectClose?: () => void } | null;
    const discard = await host._confirmDanger({
      key: 'discard-room-dialog', kind: 'warning',
      title: st('dialog.discard_title'), message: st('dialog.discard_message'),
      objectName: host._nameSel.trim() || undefined,
      confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
    });
    if (discard) close(); else dialog?.rejectClose?.();
  };
  const reviewFirst = () => {
    const first = problems[0];
    if (!first) return;
    const node = (host.renderRoot as ParentNode).querySelector<HTMLElement>(`#${first.field}`);
    node?.scrollIntoView({ block: 'center' });
    node?.focus();
  };
  const nameProblem = problemFor('room-name');
  const tempProblem = problemFor('room-temp-min');
  /* Q4: при выключении «Как у пространства» сегмент стартует с эффективного
   * режима пространства — человек видит то, что и так действует, и меняет дальше. */
  const startMode = (): RoomFillMode => (ROOM_FILL_MODES as readonly string[]).includes(spaceDisplay.fill)
    ? spaceDisplay.fill as RoomFillMode : 'custom';
  // #581: уход со «Своего цвета» забывает цвет комнаты
  const setFill = (value: '' | RoomFillMode) => {
    host._roomFill = value;
    if (value !== 'custom') host._roomCustomFill = null;
    host.requestUpdate();
  };
  const pct = (v: number) => Math.round(v * 100);
  const customLabel = host._roomCustomFill ? t('room.custom_fill_own') : t('room.custom_fill_space');
  const sizeRows: readonly [key: 'name' | 'label', labelKey: I18nKey, value: number, write: (v: number) => void][] = [
    ['name', 'room.name_scale', host._roomNameScale, (v) => { host._roomNameScale = v; }],
    ['label', 'room.label_scale', host._roomLabelScale, (v) => { host._roomLabelScale = v; }],
  ];

  return html`<hp-dialog class="roomdialog" .hass=${host.hass} data-kind="room" form-shell wide
    .title=${edit ? t('room.settings_title') : batchProgress || t('room.new')}
    .badge=${host._spaceModel()?.title ?? ''}
    icon=${edit ? 'mdi:cog-outline' : 'mdi:floor-plan'} @hp-close=${requestClose}>
      <div class="body hpf-form">
        ${batchProgress ? html`<p class="hpf-hint" role="status" aria-live="polite">${batchProgress}</p>` : nothing}
        ${formCard({
          id: 'basics',
          title: t('room.group_basics'),
          // §6.1: «?» стоит у зоны — пояснение про свободные зоны относится к ней, а не к карточке
          body: fieldGrid([
            field({
              label: t('room.name_label'), htmlFor: 'room-name',
              error: nameProblem ? st(nameProblem.message) : undefined,
              control: html`<input id="room-name" class="hpf-input" type="text" placeholder=${t('room.name_ph')}
                .value=${host._nameSel} aria-invalid=${nameProblem ? 'true' : nothing}
                @input=${(e: Event) => { host._nameSel = (e.target as HTMLInputElement).value; host.requestUpdate(); }} />`,
            }),
            field({
              label: t('room.area_label'), htmlFor: 'room-area', help: this._help('room.group_basics.help'),
              control: html`<select id="room-area" class="hpf-select"
                @change=${(e: Event) => {
                  host._areaSel = (e.target as HTMLSelectElement).value;
                  if (!host._nameSel && host._areaSel) host._nameSel = host.hass.areas[host._areaSel]?.name || '';
                  host.requestUpdate();
                }}>
                <option value="">${t('room.no_area_option')}</option>
                ${areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === host._areaSel}>${a.name}</option>`)}
              </select>`,
            }),
          ]),
        })}
        ${formCard({
          id: 'fill',
          title: t('room.group_fill'),
          help: this._help('room.group_fill.help'),
          body: html`
            ${toggleRow({
              id: 'room-fill-inherit', icon: 'mdi:layers-outline',
              title: t('fill.inherit'), caption: st('room.fill_inherit_hint'),
              checked: inherit,
              onChange: (v) => setFill(v ? '' : startMode()),
            })}
            ${inherit
              ? html`<p class="hpf-hint">${st('room.fill_following', { mode: t(`fill.${spaceDisplay.fill}` as I18nKey) })}</p>`
              : field({
                  label: st('room.fill_mode_label'),
                  control: segmented<RoomFillMode>({
                    name: 'rfill',
                    value: host._roomFill as RoomFillMode,
                    ariaLabel: t('room.fill_label'),
                    // Короткие подписи сегмента по референсу (§6.1: None | Zigbee | Lights | Temperature | Custom),
                    // общие с сегментом пространства (§4.2)
                    options: ROOM_FILL_MODES.map((value) => ({ value, label: st(`fill.seg_${value}`) })),
                    onChange: (value) => setFill(value),
                  }),
                })}
            ${host._roomFill === 'custom'
              ? colorRow({
                  label: customLabel,
                  picker: colorField({
                    hex: customFill.c, opacity: customFill.a, opacityLabel: t('space.opacity'),
                    onOpacity: (a) => { host._roomCustomFill = { c: customFill.c, a }; host.requestUpdate(); },
                    resetLabel: host._roomCustomFill ? t('btn.reset') : undefined,
                    onReset: () => { host._roomCustomFill = null; host.requestUpdate(); },
                    picker: html`<hp-color-opacity .label=${customLabel} hide-label
                      .opacityLabel=${t('space.opacity')}
                      .pickerLabels=${host._colorPickerLabels}
                      .color=${customFill.c}
                      .opacity=${customFill.a}
                      @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                        host._roomCustomFill = { c: e.detail.color, a: e.detail.opacity };
                      }}></hp-color-opacity>`,
                  }),
                })
              : nothing}
            ${effectiveFill === 'temp'
              ? html`<div class="hpf-field hpf-temprange">
                  <span class="hpf-label hpf-labelrow">${t('room.temp_range_label')}${this._help('room.temp_range.help')}</span>
                  ${fieldGrid([
                    field({
                      label: st('room.temp_min_label'), htmlFor: 'room-temp-min',
                      control: unitInput({
                        id: 'room-temp-min', wide: true, unit: '°C', step: 0.5, value: host._roomTempMin,
                        placeholder: String(spaceDisplay.tempMin), ariaLabel: t('room.temp_range_min'),
                        invalid: host._roomTempMin.trim() !== '' && strictNumber(host._roomTempMin) === null,
                        onInput: (raw) => { host._roomTempMin = raw; host.requestUpdate(); },
                      }),
                    }),
                    field({
                      label: st('room.temp_max_label'), htmlFor: 'room-temp-max',
                      control: unitInput({
                        id: 'room-temp-max', wide: true, unit: '°C', step: 0.5, value: host._roomTempMax,
                        placeholder: String(spaceDisplay.tempMax), ariaLabel: t('room.temp_range_max'),
                        invalid: host._roomTempMax.trim() !== '' && strictNumber(host._roomTempMax) === null,
                        onInput: (raw) => { host._roomTempMax = raw; host.requestUpdate(); },
                      }),
                    }),
                  ])}
                  ${tempProblem ? html`<p class="hpf-error" role="alert">${st(tempProblem.message)}</p>` : nothing}
                  <div class="hpf-templegend" aria-hidden="true">
                    <span>${t('gs.temp_cold')}</span><span>${t('gs.temp_ok')}</span><span>${t('gs.temp_hot')}</span>
                  </div>
                  ${host._roomTempMin.trim() || host._roomTempMax.trim()
                    ? textLink(t('room.temp_range_reset'), () => { host._roomTempMin = ''; host._roomTempMax = ''; host.requestUpdate(); })
                    : nothing}
                </div>`
              : nothing}`,
        })}
        ${formCard({
          id: 'sources',
          title: t('room.group_sources'),
          help: this._help('room.group_sources.help'),
          body: html`${renderRoomSource(this, 'temp')}${renderRoomSource(this, 'hum')}`,
        })}
        ${formCard({
          id: 'sizes',
          title: t('room.sizes_section'),
          help: this._help('room.sizes_section.help'),
          body: html`
            ${sizeRows.map(([key, labelKey, value, write]) => html`<div class="hpf-field">
                <div class="hpf-headline">
                  <span class="hpf-label hpf-labelrow"><label for=${`room-${key}-scale`}>${t(labelKey)}</label></span>
                  ${textLink(st('btn.reset_100'), () => { write(1); host.requestUpdate(); }, { disabled: pct(value) === 100 })}
                </div>
                ${rangeLine({
                  id: `room-${key}-scale`, min: 50, max: 300, step: 5, value: pct(value), unit: '%', ariaLabel: t(labelKey),
                  slider: this._rangeInput(50, 300, 5, pct(value), (n) => { write(n / 100); host.requestUpdate(); }, false, t(labelKey)),
                  onInput: (n) => { write(n / 100); host.requestUpdate(); },
                })}
                ${rangeEnds('50%', '300%')}
              </div>`)}
            <p class="hpf-hint">${st('room.sizes_hint', { v: String(pct(spaceDisplay.cardFontScale)) })}</p>
            <div class="hpf-tint hpf-preview">${host._renderCardPreview(spaceDisplay.cardFontScale, host._roomNameScale, host._roomLabelScale)}</div>`,
        })}
      </div>
      <div class="row dialog-action-footer hpf-footer" slot="footer">
        ${!edit && !host._pendingSplit
          ? html`<div class="dialog-action-group">
              <button class="btn ghost" data-hp="dialog-confirm" @click=${() => this._keepClosedAsPartitions()}>
                <ha-icon icon="mdi:wall"></ha-icon>${t('btn.keep_as_walls')}
              </button>
            </div>`
          : nothing}
        ${footerStatus(problems.length
          ? { action: textLink(st('dialog.review_fields', { n: String(problems.length) }), reviewFirst) }
          : { text: edit && dirty ? st('dialog.unsaved') : '' })}
        <div class="dialog-action-group dialog-action-commit">
          <button class="btn ghost" data-hp="dialog-cancel" @click=${requestClose}>${t('btn.cancel')}</button>
          ${edit
            ? html`<button class="btn on" data-hp="dialog-confirm" ?disabled=${!canSave}
                title=${problems[0] ? st(problems[0].message) : nothing}
                @click=${() => { forgetRoomBaseline(host); this._saveRoomEdit(); }}>
                <ha-icon icon="mdi:check"></ha-icon>${t('btn.save')}
              </button>`
            : html`<button class="btn on room-save" data-hp="dialog-confirm" ?disabled=${!canSave}
                title=${problems[0] ? st(problems[0].message) : nothing}
                @click=${() => { forgetRoomBaseline(host); this._saveRoom(); }}>
                <ha-icon icon="mdi:check"></ha-icon>${t('btn.save')}
              </button>`}
        </div>
      </div>
  </hp-dialog>`;
}
