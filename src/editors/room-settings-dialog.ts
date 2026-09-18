/**
 * Диалог «Настройки комнаты» (#592: вынесен из houseplan-editor-runtime.ts как есть).
 *
 * Тело перенесено побайтово: тип `this` объявлен параметром, поэтому ни одна
 * строка разметки, ни один обработчик и ни один якорь мутанта не переписаны.
 * Состояние остаётся на хосте — модуль только рисует (#592, К2).
 */
import { html, nothing, type TemplateResult } from 'lit';

import { ROOM_FILL_MODES, spaceDisplayOf } from '../logic';
import { roomTemperatureControls } from '../room-temperature-controls';
import { roomTempThresholdDraft } from '../space-dialog';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';

export function renderRoomSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
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
    return html`<hp-dialog class="roomdialog" .hass=${this.host.hass} data-kind="room" wide
      .title=${edit ? this.host._t('room.settings_title')
        : batchProgress || this.host._t('room.new')}
      icon=${edit ? 'mdi:cog-outline' : 'mdi:floor-plan'} @hp-close=${() => this._roomDialogCancel()}>
        <div class="body">
          ${batchProgress ? html`<p class="muted" role="status" aria-live="polite">
            ${batchProgress}
          </p>` : nothing}
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
          </select>

          <label class="dispsection">${this.host._t('room.settings_section')}</label>
          <label>${this.host._t('room.fill_label')}</label>
          ${([['', 'fill.inherit'], ...ROOM_FILL_MODES.map((v) => [v, 'fill.' + v])] as const).map(
            ([v, k]) => html`<label class="srcrow inline">
              <input type="radio" name="rfill" .checked=${this.host._roomFill === v}
                @change=${() => { this.host._roomFill = v as typeof this.host._roomFill; if (v !== 'custom') this.host._roomCustomFill = null; this.host.requestUpdate(); }} />
              <span>${this.host._t(k as any)}</span>
            </label>`,
          )}
          ${this.host._roomFill === 'custom'
            ? html`<div class="colorrow gsrow">
                <span class="gsl">${this.host._roomCustomFill
                  ? this.host._t('room.custom_fill_own') : this.host._t('room.custom_fill_space')}</span>
                <hp-color-opacity
                  .label=${this.host._roomCustomFill
                    ? this.host._t('room.custom_fill_own') : this.host._t('room.custom_fill_space')}
                  .opacityLabel=${this.host._t('space.opacity')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${customFill.c}
                  .opacity=${customFill.a}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                    this.host._roomCustomFill = { c: e.detail.color, a: e.detail.opacity };
                  }}></hp-color-opacity>
                ${this.host._roomCustomFill
                  ? html`<button class="btn ghost" type="button" @click=${() => {
                      this.host._roomCustomFill = null;
                    }}>${this.host._t('btn.reset')}</button>`
                  : nothing}
              </div>`
            : nothing}
          <div class="roomtemprange-host">${roomTemperatureControls(this.host, effectiveFill, spaceDisplay.tempMin, spaceDisplay.tempMax, this._help('room.temp_range.help')).template}</div>
          ${this._renderRoomSource('temp')}
          ${this._renderRoomSource('hum')}
          <label class="dispsection">${this.host._t('room.sizes_section')}</label>
          <label>${this.host._t('room.name_scale')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(this.host._roomNameScale * 100), (n) => { this.host._roomNameScale = n / 100; this.host.requestUpdate(); })}
            <span class="opv">${Math.round(this.host._roomNameScale * 100)}%</span>
          </div>
          <label>${this.host._t('room.label_scale')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(this.host._roomLabelScale * 100), (n) => { this.host._roomLabelScale = n / 100; this.host.requestUpdate(); })}
            <span class="opv">${Math.round(this.host._roomLabelScale * 100)}%</span>
          </div>
          ${this.host._renderCardPreview(
            spaceDisplayOf(this.host._curSpaceCfg).cardFontScale,
            this.host._roomNameScale,
            this.host._roomLabelScale,
          )}
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
