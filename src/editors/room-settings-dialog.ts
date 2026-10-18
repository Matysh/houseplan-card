/** Compact room settings (#946), sharing controls and save ownership with the existing editor. */
import { html, nothing, type TemplateResult } from 'lit';

import { type I18nKey } from '../i18n';
import { settingsCopy } from './settings-copy';
import { ROOM_FILL_MODES, spaceDisplayOf } from '../logic';
import { roomTempThresholdDraft, strictNumber } from '../space-dialog';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import {
  colorField, colorRow, callout, selectControl, field, fieldGrid, footerStatus, formCard, rangeEnds,
  rangeLine, segmented, sourcePicker, subsection, textLink, unitInput,
} from './form-kit';
import { roomDirty, roomProblems } from './room-form-state';
import { ensureSettingsDialogStyles } from './settings-styles';
import { settingsSections, revealSettingsField } from './settings-sections';
import { roomCardPreview } from './room-card-preview';

type RoomFillMode = typeof ROOM_FILL_MODES[number];

/**
 * Источник измерения: сегмент «среднее / конкретный датчик»; при выборе
 * конкретного — кнопка выбора и панель с поиском в потоке карточки. Кандидаты
 * (`_roomSrcCandidates`) и запись (`_roomTempSrc` / `_roomHumSrc`) прежние.
 */
function renderRoomSource(runtime: HouseplanEditorRuntime, kind: 'temp' | 'hum' | 'co2'): TemplateResult {
  const host = runtime.host;
  const { st } = settingsCopy(host);
  const val = kind === 'temp' ? host._roomTempSrc : kind === 'hum' ? host._roomHumSrc : host._roomCo2Src;
  const setVal = (v: string) => {
    if (kind === 'temp') host._roomTempSrc = v;
    else if (kind === 'hum') host._roomHumSrc = v;
    else host._roomCo2Src = v;
    host.requestUpdate();
  };
  const open = host._roomSrcOpen === kind;
  const label = st(kind === 'temp' ? 'room.temp_src_label' : kind === 'hum' ? 'room.hum_src_label' : 'room.co2_src_label');
  return html`${subsection({ title: label })}
    ${segmented<'avg' | 'pick'>({
      name: `rsrc-${kind}`,
      value: val ? 'pick' : 'avg',
      ariaLabel: label,
      options: [
        { value: 'avg', label: st('room.src_average') },
        { value: 'pick', label: st('room.src_pick') },
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
          placeholder: st('room.src_ph'),
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
  ensureSettingsDialogStyles(this.host);
  const host = this.host;
  const t = host._t.bind(host);
  const { st, shelp } = settingsCopy(host);
  const edit = !!host._roomEditId;
  const faceBatch = !edit ? host._wallFaceBatch : null;
  const batchProgress = faceBatch && faceBatch.candidates.length > 1
    ? t('room.queue_progress', { current: faceBatch.index + 1, total: faceBatch.candidates.length })
    : '';
  const spaceDisplay = spaceDisplayOf(host._curSpaceCfg);
  const effectiveFill = host._roomFill || spaceDisplay.fill;
  const customFill = host._roomCustomFill || spaceDisplay.customFill;
  const tempValid = roomTempThresholdDraft(host._roomTempMin, host._roomTempMax).valid;
  const problems = roomProblems(host);
  const problemFor = (fieldId: string) => problems.find((p) => p.field === fieldId);
  const dirty = roomDirty(host);
  /* К10 (Q1): в edit «Сохранить» активен только при изменениях; в create черновик
   * новой комнаты сохранять есть всегда — условие прежнее (имя или зона, границы). */
  const canSave = !this.roomSaveBusy && problems.length === 0 && tempValid && (edit ? dirty : true);
  // the free-areas list must include the edited room's CURRENT area
  const areas = [...host._freeAreas];
  if (edit && host._areaSel && !areas.some((a) => a.area_id === host._areaSel)) {
    const cur = host.hass.areas[host._areaSel];
    if (cur) areas.unshift(cur);
  }
  const requestClose = () => { void this._requestRoomDialogClose(); };
  const reviewFirst = () => {
    const first = problems[0];
    if (!first) return;
    const node = (host.renderRoot as ParentNode).querySelector<HTMLElement>(`#${first.field}`);
    if (node) revealSettingsField(host, node);
  };
  const nameProblem = problemFor('room-name');
  const tempProblem = problemFor('room-temp-min');
  // #581: уход со «Своего цвета» забывает цвет комнаты
  const setFill = (value: '' | RoomFillMode) => {
    host._roomFill = value;
    if (value !== 'custom') host._roomCustomFill = null;
    host.requestUpdate();
  };
  const pct = (v: number) => Math.round(v * 100);
  const customLabel = t('room.custom_fill_own');
  const fillLabel = (mode: string): string => mode === 'none' ? st('room.fill_none') : st(`space.fill_${mode}` as 'space.fill_custom' | 'space.fill_lqi' | 'space.fill_light' | 'space.fill_temp');
  const sizeRows: readonly [key: 'name' | 'label', labelKey: I18nKey, value: number, write: (v: number) => void][] = [
    ['name', 'room.name_scale', host._roomNameScale, (v) => { host._roomNameScale = v; }],
    ['label', 'room.label_scale', host._roomLabelScale, (v) => { host._roomLabelScale = v; }],
  ];

  return html`<hp-dialog class="roomdialog" .hass=${host.hass} data-kind="room" form-shell settings-layout wide
    .title=${edit ? st('room.title', {name:host._nameSel || t('room.settings_title')}) : batchProgress || t('room.new')}
    .subtitle=${st('room.context', {space:host._spaceModel()?.title ?? ''})}
    icon="mdi:cog-outline" icon-badge="mdi:door-open" @hp-close=${requestClose}>
      <div class="body hpf-form hpf-settings-form" ?inert=${this.roomSaveBusy}>
        ${settingsSections(host, 'room', [{id:'all',title:t('room.settings_title'),body:html`
        ${batchProgress ? html`<p class="hpf-hint" role="status" aria-live="polite">${batchProgress}</p>` : nothing}
        ${formCard({
          id: 'basics',
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
              label: st('room.area_optional'), htmlFor: 'room-area', help: shelp('room.group_basics.help'),
              control: html`<hp-settings-select><select id="room-area" class="hpf-select" aria-label=${t('room.area_label')}
                @change=${(e: Event) => {
                  host._areaSel = (e.target as HTMLSelectElement).value;
                  if (!host._nameSel && host._areaSel) host._nameSel = host.hass.areas[host._areaSel]?.name || '';
                  host.requestUpdate();
                }}>
                <option value="">${t('room.no_area_option')}</option>
                ${areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === host._areaSel}>${a.name}</option>`)}
              </select></hp-settings-select>`,
            }),
          ], {stacked:true}),
        })}
        ${formCard({
          id: 'fill',
          title: t('room.group_fill'),
          body: html`
            ${field({
              label: st('room.fill_mode_label'), help: shelp('room.group_fill.help'),
              control: selectControl<'' | RoomFillMode>({
                name:'rfill',value:host._roomFill as '' | RoomFillMode,ariaLabel:t('room.fill_label'),
                options:[{value:'',label:st('room.fill_inherited',{mode:fillLabel(spaceDisplay.fill)})},
                  ...(['none','custom','lqi','light','temp'] as const).map(value=>({value,label:fillLabel(value)}))],
                onChange:setFill,
              }),
            })}
            ${host._roomFill === 'custom'
              ? colorRow({
                  label: customLabel,
                  picker: colorField({
                    hex: customFill.c, opacity: customFill.a, opacityLabel: t('space.opacity'),
                    picker: html`<hp-color-opacity .label=${customLabel} hide-label flat-swatch
                      .opacityLabel=${t('space.opacity')}
                      .pickerLabels=${host._colorPickerLabels}
                      .color=${customFill.c}
                      .opacity=${customFill.a}
                      @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                        host._roomCustomFill = { c: e.detail.color, a: e.detail.opacity };
                        host.requestUpdate();
                      }}></hp-color-opacity>`,
                  }),
                })
              : nothing}
            ${effectiveFill === 'temp'
              ? html`<div class="hpf-field hpf-temprange">
                  <span class="hpf-label hpf-labelrow">${t('room.temp_range_label')}${shelp('room.temp_range.help')}</span>
                  <div class="hpf-temperature-range hpf-range-compact">${[
                    field({
                      label: st('space.range_from'), htmlFor: 'room-temp-min',
                      control: unitInput({
                        id: 'room-temp-min', wide: true, unit: '°C', step: 0.5, value: host._roomTempMin,
                        placeholder: String(spaceDisplay.tempMin), ariaLabel: t('room.temp_range_min'),
                        invalid: host._roomTempMin.trim() !== '' && strictNumber(host._roomTempMin) === null,
                        onInput: (raw) => { host._roomTempMin = raw; host.requestUpdate(); },
                      }),
                    }),
                    field({
                      label: st('space.range_to'), htmlFor: 'room-temp-max',
                      control: unitInput({
                        id: 'room-temp-max', wide: true, unit: '°C', step: 0.5, value: host._roomTempMax,
                        placeholder: String(spaceDisplay.tempMax), ariaLabel: t('room.temp_range_max'),
                        invalid: host._roomTempMax.trim() !== '' && strictNumber(host._roomTempMax) === null,
                        onInput: (raw) => { host._roomTempMax = raw; host.requestUpdate(); },
                      }),
                    }),
                  ]}</div>
                  ${tempProblem ? html`<p class="hpf-error" role="alert">${st(tempProblem.message)}</p>` : nothing}
                  ${callout({text:`${t('gs.temp_cold')} · ${t('gs.temp_ok')} · ${t('gs.temp_hot')}`})}
                  ${host._roomTempMin.trim() || host._roomTempMax.trim()
                    ? html`<div class="hpf-actions"><button class="btn ghost" data-room-range-reset
                        @click=${() => {host._roomTempMin='';host._roomTempMax='';host.requestUpdate();}}>${t('room.temp_range_reset')}</button>${shelp('room.temp_range.help')}</div>`
                    : nothing}
                </div>`
              : nothing}`,
        })}
        ${formCard({
          id: 'sources',
          title: st('room.group_sources'),
          help: shelp('room.group_sources.help'),
          body: html`${renderRoomSource(this, 'temp')}${renderRoomSource(this, 'hum')}${renderRoomSource(this, 'co2')}`,
        })}
        ${formCard({
          id: 'sizes',
          title: t('room.sizes_section'),
          help: shelp('room.sizes_section.help'),
          body: html`
            ${sizeRows.map(([key, labelKey, value, write]) => html`<div class="hpf-field">
                <span class="hpf-label hpf-labelrow"><label for=${`room-${key}-scale`}>${t(labelKey)}</label></span>
                ${rangeLine({
                  id: `room-${key}-scale`, min: 50, max: 300, step: 5, value: pct(value), unit: '%', ariaLabel: t(labelKey),
                  slider: this._rangeInput(50, 300, 5, pct(value), (n) => { write(n / 100); host.requestUpdate(); }, false, t(labelKey)),
                  onInput: (n) => { write(n / 100); host.requestUpdate(); },
                })}
                ${rangeEnds('50%', '300%')}
              </div>`)}
            ${callout({text:st('room.sizes_hint',{name:pct(spaceDisplay.cardNameScale),metrics:pct(spaceDisplay.cardLabelScale)})})}
            <div class="hpf-tint hpf-preview">${roomCardPreview(t, st('preview.room_name'), spaceDisplay.cardNameScale, host._roomNameScale, host._roomLabelScale, 820, spaceDisplay.cardLabelScale, {temp:true,hum:true,lqi:false,light:true,showName:true})}</div>`,
        })}
        `}], st('dialog.section'))}
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
          : {text:st(dirty ? 'dialog.dirty' : 'dialog.saved')})}
        <div class="dialog-action-group dialog-action-commit">
          <button class="btn ghost" data-hp="dialog-cancel" @click=${requestClose}>${t('btn.cancel')}</button>
          ${edit
            ? html`<button class="btn on" data-hp="dialog-confirm" ?disabled=${!canSave}
                title=${problems[0] ? st(problems[0].message) : nothing}
                @click=${() => { void this._saveRoomEdit(); }}>
                <ha-icon icon="mdi:check"></ha-icon>${st('room.save')}
              </button>`
            : html`<button class="btn on room-save" data-hp="dialog-confirm" ?disabled=${!canSave}
                title=${problems[0] ? st(problems[0].message) : nothing}
                @click=${() => { this._saveRoom(); }}>
                <ha-icon icon="mdi:check"></ha-icon>${st('room.save')}
              </button>`}
        </div>
      </div>
  </hp-dialog>`;
}
