/**
 * Диалог «Настройки комнаты».
 *
 * #592: тело вынесено из `houseplan-editor-runtime.ts` побайтово.
 * #594: форма собрана в карточки-группы общим набором контролов
 * (`./form-kit`); записи остались прежними — те же ключи черновика на хосте,
 * те же условия сохранения, тот же `hp-color-opacity`.
 */
import { html, nothing, type TemplateResult } from 'lit';

import type { I18nKey } from '../i18n';
import { ROOM_FILL_MODES, spaceDisplayOf } from '../logic';
import { roomTemperatureControls } from '../room-temperature-controls';
import { roomTempThresholdDraft } from '../space-dialog';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import { colorRow, ensureFormKitStyles, formCard, formRow, segmented } from './form-kit';

/**
 * Варианты заливки комнаты: «как у пространства» плюс режимы пространства.
 *
 * #594: раньше пара «значение, ключ» собиралась кортежами, и ключ приходилось
 * приводить к `any` — ключ получался из конкатенации и терял литеральный тип.
 * Явная форма сохраняет и то и другое: режим остаётся значением `_roomFill`, а
 * ключ — настоящим `I18nKey`, который проверяет компилятор.
 */
type RoomFillChoice = { value: '' | typeof ROOM_FILL_MODES[number]; key: I18nKey };
const FILL_CHOICES: readonly RoomFillChoice[] = [
  { value: '', key: 'fill.inherit' },
  ...ROOM_FILL_MODES.map((value) => ({ value, key: `fill.${value}` as const })),
];

/**
 * Источник измерения: среднее по комнате или выбранный датчик.
 *
 * #594: два радиоряда заменены сегментированным переключателем — той же группой
 * радиокнопок под капотом. Список кандидатов и запись не изменились.
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
  return html`${formRow({
    label,
    control: segmented<'avg' | 'pick'>({
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
    }),
  })}
    ${val || open
      ? html`<button class="dropbtn ${open ? 'open' : ''}"
            @click=${() => { host._roomSrcOpen = open ? null : kind; host._roomSrcFilter = ''; }}>
            ${val
              ? html`<b>${runtime._roomSrcLabel(val)}</b><span class="ref">${val}</span>`
              : html`<span class="muted">${host._t('room.src_ph')}</span>`}
            <ha-icon icon=${open ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
          </button>
          ${open
            ? html`<div class="droppanel">
                <input class="namein" type="text" placeholder=${host._t('marker.search_ph')}
                  .value=${host._roomSrcFilter}
                  @input=${(e: Event) => { host._roomSrcFilter = (e.target as HTMLInputElement).value; host.requestUpdate(); }} />
                <div class="candlist">
                  ${runtime._roomSrcCandidates().map(
                    (c) => html`<div class="cand ${c.value === val ? 'sel' : ''}"
                      @click=${() => { setVal(c.value); host._roomSrcOpen = null; }}>
                      <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                    </div>`,
                  )}
                </div>
              </div>`
            : nothing}`
      : nothing}`;
}

export function renderRoomSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureFormKitStyles(this.host);
  const edit = !!this.host._roomEditId;
  const faceBatch = !edit ? this.host._wallFaceBatch : null;
  const batchProgress = faceBatch && faceBatch.candidates.length > 1
    ? this.host._t('room.queue_progress', {
        current: faceBatch.index + 1, total: faceBatch.candidates.length,
      })
    : '';
  const spaceDisplay = spaceDisplayOf(this.host._curSpaceCfg);
  const effectiveFill = this.host._roomFill || spaceDisplay.fill;
  const customFill = this.host._roomCustomFill || spaceDisplay.customFill;
  const tempValid = roomTempThresholdDraft(this.host._roomTempMin, this.host._roomTempMax).valid;
  const canSaveNew = (!!this.host._areaSel || !!this.host._nameSel.trim()) && tempValid;
  // the free-areas list must include the edited room's CURRENT area
  const areas = [...this.host._freeAreas];
  if (edit && this.host._areaSel && !areas.some((a) => a.area_id === this.host._areaSel)) {
    const cur = this.host.hass.areas[this.host._areaSel];
    if (cur) areas.unshift(cur);
  }
  return html`<hp-dialog class="roomdialog" .hass=${this.host.hass} data-kind="room" form-shell wide
    .title=${edit ? this.host._t('room.settings_title')
      : batchProgress || this.host._t('room.new')}
    icon=${edit ? 'mdi:cog-outline' : 'mdi:floor-plan'} @hp-close=${() => this._roomDialogCancel()}>
      <div class="body hpf-form">
        ${batchProgress ? html`<p class="muted" role="status" aria-live="polite">
          ${batchProgress}
        </p>` : nothing}
        ${formCard({
          title: this.host._t('room.group_basics'),
          help: this._help('room.group_basics.help'),
          body: html`
            <label>${this.host._t('room.name_label')}</label>
            <input class="namein" type="text" placeholder=${this.host._t('room.name_ph')}
              .value=${this.host._nameSel}
              @input=${(e: Event) => (this.host._nameSel = (e.target as HTMLInputElement).value)} />
            <label>${this.host._t('room.area_label')}</label>
            <select class="areasel"
              @change=${(e: Event) => {
                this.host._areaSel = (e.target as HTMLSelectElement).value;
                if (!this.host._nameSel && this.host._areaSel)
                  this.host._nameSel = this.host.hass.areas[this.host._areaSel]?.name || '';
                this.host.requestUpdate();
              }}>
              <option value="">${this.host._t('room.no_area_option')}</option>
              ${areas.map(
                (a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.host._areaSel}>${a.name}</option>`,
              )}
            </select>`,
        })}
        ${formCard({
          title: this.host._t('room.group_fill'),
          help: this._help('room.group_fill.help'),
          body: html`
            <label>${this.host._t('room.fill_label')}</label>
            ${FILL_CHOICES.map(
              ({ value, key }) => html`<label class="srcrow inline">
                <input type="radio" name="rfill" .checked=${this.host._roomFill === value}
                  @change=${() => { this.host._roomFill = value; if (value !== 'custom') this.host._roomCustomFill = null; this.host.requestUpdate(); }} />
                <span>${this.host._t(key)}</span>
              </label>`,
            )}
            ${this.host._roomFill === 'custom'
              ? colorRow({
                  label: this.host._roomCustomFill
                    ? this.host._t('room.custom_fill_own') : this.host._t('room.custom_fill_space'),
                  picker: html`<hp-color-opacity
                    .label=${this.host._roomCustomFill
                      ? this.host._t('room.custom_fill_own') : this.host._t('room.custom_fill_space')}
                    .opacityLabel=${this.host._t('space.opacity')}
                    .pickerLabels=${this.host._colorPickerLabels}
                    .color=${customFill.c}
                    .opacity=${customFill.a}
                    @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                      this.host._roomCustomFill = { c: e.detail.color, a: e.detail.opacity };
                    }}></hp-color-opacity>`,
                  action: this.host._roomCustomFill
                    ? html`<button class="btn ghost" type="button" @click=${() => {
                        this.host._roomCustomFill = null;
                      }}>${this.host._t('btn.reset')}</button>`
                    : nothing,
                })
              : nothing}
            <div class="roomtemprange-host">${roomTemperatureControls(this.host, effectiveFill, spaceDisplay.tempMin, spaceDisplay.tempMax, this._help('room.temp_range.help')).template}</div>`,
        })}
        ${formCard({
          title: this.host._t('room.group_sources'),
          help: this._help('room.group_sources.help'),
          body: html`
            ${renderRoomSource(this, 'temp')}
            ${renderRoomSource(this, 'hum')}`,
        })}
        ${formCard({
          title: this.host._t('room.sizes_section'),
          help: this._help('room.sizes_section.help'),
          body: html`
            ${formRow({
              label: this.host._t('room.name_scale'),
              control: html`<span class="hpf-scale">${this._rangeInput(50, 300, 5, Math.round(this.host._roomNameScale * 100), (n) => { this.host._roomNameScale = n / 100; this.host.requestUpdate(); })}
                <span class="opv">${Math.round(this.host._roomNameScale * 100)}%</span></span>`,
            })}
            ${formRow({
              label: this.host._t('room.label_scale'),
              control: html`<span class="hpf-scale">${this._rangeInput(50, 300, 5, Math.round(this.host._roomLabelScale * 100), (n) => { this.host._roomLabelScale = n / 100; this.host.requestUpdate(); })}
                <span class="opv">${Math.round(this.host._roomLabelScale * 100)}%</span></span>`,
            })}
            ${this.host._renderCardPreview(
              spaceDisplayOf(this.host._curSpaceCfg).cardFontScale,
              this.host._roomNameScale,
              this.host._roomLabelScale,
            )}`,
        })}
      </div>
      <div class="row roomfooter" slot="footer">
        <button class="btn ghost" data-hp="dialog-cancel" @click=${() => this._roomDialogCancel()}>${this.host._t('btn.cancel')}</button>
        <span class="spacer"></span>
        ${edit
          ? html`<button class="btn on" data-hp="dialog-confirm" @click=${() => this._saveRoomEdit()} ?disabled=${!this.host._nameSel.trim() || !tempValid}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
            </button>`
          : html`${!this.host._pendingSplit ? html`<button class="btn ghost" data-hp="dialog-confirm"
              @click=${() => this._keepClosedAsPartitions()}>
              <ha-icon icon="mdi:wall"></ha-icon>${this.host._t('btn.keep_as_walls')}
            </button>` : nothing}
            <button class="btn on room-save" data-hp="dialog-confirm" @click=${() => this._saveRoom()} ?disabled=${!canSaveNew}>
              <ha-icon icon="mdi:check"></ha-icon>${this.host._t('btn.save')}
            </button>`}
      </div>
  </hp-dialog>`;
}
