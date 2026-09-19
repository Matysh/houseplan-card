/**
 * Диалог «Общие настройки».
 *
 * #592 вынес его сюда побайтово; #598 собрал девять подписей-заголовков в семь
 * карточек общего набора. Состояние по-прежнему живёт на хосте — модуль только
 * рисует, и каждый контрол пишет в тот же ключ черновика, что и раньше (#598 К1).
 *
 * Классы `.srcrow`, `.dispsection`, `.gsrow`, `.colorrow`, `.namein`, `.areasel`,
 * `.tempin` сохранены намеренно: за них держатся одиннадцать смоков, и потеря
 * любого превратила бы ревью в чтение переписанных свидетелей (#598 К6).
 */
import { html, nothing, type TemplateResult } from 'lit';

import { ensureFormKitStyles, formCard, segmented } from './form-kit';
import { langOf } from '../i18n';
import { supportT } from '../i18n/support';
import { DEFAULT_FILL_COLORS } from '../logic';
import { strictNumber } from '../space-dialog';
import { sunStateOf } from '../sun';
import { renderSunRayOriginSelect } from '../sun-settings-view';
import { zigbeeTopologySettingsOf } from '../zigbee-topology-settings';
import type { ZigbeeTopologySettings } from '../zigbee-topology-settings';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';

export function renderGeneralSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureFormKitStyles(this.host);
    return html`<hp-dialog .hass=${this.host.hass} data-kind="settings" .title=${this.host._t('gs.title')} icon="mdi:cog-outline" wide
      @hp-close=${() => (this.host._settingsDialog = null)}>
        <div class="body hpf-form">
          ${formCard({
            title: this.host._t('gs.card_display'),
            body: html`
              <label class="srcrow">
                ${this._boolInput(this.host._settingsDialog!.showRoomTooltip, (v) =>
                  (this.host._settingsDialog = { ...this.host._settingsDialog!, showRoomTooltip: v }))}
                <span>${supportT(
                  langOf(this.host.hass, this.host._config?.language), 'gs.show_room_tooltip',
                )}</span>
              </label>
              <label class="srcrow">
                ${this._boolInput(this.host._settingsDialog!.radarShowLive, (v) =>
                  (this.host._settingsDialog = { ...this.host._settingsDialog!, radarShowLive: v }))}
                <span>${this.host._t('gs.radar_show_live')}</span>
                ${this._help('gs.radar_show_live.help')}
              </label>`,
          })}
          ${formCard({
            title: this.host._t('gs.card_zigbee'),
            body: html`<hp-zigbee-topology-settings .hass=${this.host.hass} .value=${this.host._settingsDialog!.zigbeeTopology} .savedEnabled=${zigbeeTopologySettingsOf(this.host._settings).enabled} .devices=${this.host._devices} .registry=${this.host._haRegistry} @hp-topology-settings-change=${(event: CustomEvent<ZigbeeTopologySettings>) => (this.host._settingsDialog = { ...this.host._settingsDialog!, zigbeeTopology: event.detail })}></hp-zigbee-topology-settings>`,
          })}
          ${formCard({
            title: this.host._t('gs.card_fills'),
            help: this._help('gs.card_fills.help'),
            body: html`
              <label class="dispsection">${this.host._t('gs.light_group')}</label>
              ${this._renderColorRow('light_on', 'gs.light_on')}
              ${this._renderColorRow('light_off', 'gs.light_off')}
              ${this._renderColorRow('light_none', 'gs.light_none')}
              <label class="dispsection">${this.host._t('gs.temp_group')}</label>
              ${this._renderColorRow('temp_cold', 'gs.temp_cold')}
              ${this._renderColorRow('temp_ok', 'gs.temp_ok')}
              ${this._renderColorRow('temp_hot', 'gs.temp_hot')}
              <label class="dispsection">${this.host._t('gs.lqi_group')}</label>
              ${this._renderColorRow('lqi_low', 'gs.lqi_low')}
              ${this._renderColorRow('lqi_high', 'gs.lqi_high')}`,
          })}
          ${formCard({
            title: this.host._t('gs.glow_group'),
            body: html`
              ${this._renderColorRow('glow_base', 'gs.glow_base')}
              ${this._renderColorRow('glow_light', 'gs.glow_light')}
              <div class="colorrow gsrow">
                <span class="gsl help-inline-label"><label for="gs-glow-radius">${this.host._t('gs.glow_radius')}</label>
                  ${this._help('gs.glow_radius.help')}</span>
                <input id="gs-glow-radius" type="number" class="tempin" min="0.5" step="0.5"
                  .value=${String(this.host._settingsDialog!.glowRadius)}
                  @input=${(e: Event) => {
                    const v = strictNumber((e.target as HTMLInputElement).value);
                    if (v != null && v > 0)
                      this.host._settingsDialog = { ...this.host._settingsDialog!, glowRadius: v };
                  }} />
                <span class="opl">${this.host._imperial ? this.host._t('gs.unit_ft') : this.host._t('gs.unit_m')}</span>
              </div>`,
          })}
          ${formCard({
            title: this.host._t('gs.card_plan'),
            body: html`
              <label class="dispsection">${this.host._t('gs.wall_group')}</label>
              ${this._renderColorRow('wall_fill', 'gs.wall_fill')}
              <label class="dispsection">${this.host._t('gs.bg_group')}</label>
              <div class="colorrow gsrow">
                <span class="gsl help-inline-label"><label for="gs-bg-mode">${this.host._t('gs.bg_mode')}</label>
                  ${this._help('gs.bg_mode.help')}</span>
                ${segmented({
                  name: 'gs-bg-mode',
                  value: this.host._settingsDialog!.bgMode === 'daynight' ? 'daynight' : 'static',
                  ariaLabel: this.host._t('gs.bg_mode'),
                  options: [
                    { value: 'static', label: this.host._t('gs.bg_static') },
                    { value: 'daynight', label: this.host._t('gs.bg_daynight') },
                  ],
                  onChange: (value) =>
                    (this.host._settingsDialog = { ...this.host._settingsDialog!, bgMode: value === 'daynight' ? 'daynight' : 'static' }),
                })}
              </div>
              ${this.host._settingsDialog!.bgMode === 'static'
                ? html`<div class="colorrow gsrow">
                    <hp-color-opacity .label=${this.host._t('gs.bg_color')}
                      .pickerLabels=${this.host._colorPickerLabels}
                      .color=${this.host._settingsDialog!.bgColor || this.host._stageBgHex()}
                      .opacity=${1} .showOpacity=${false}
                      @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                        this.host._settingsDialog = { ...this.host._settingsDialog!, bgColor: e.detail.color };
                      }}></hp-color-opacity>
                    ${this.host._settingsDialog!.bgColor
                      ? html`<button class="btn ghost" @click=${() =>
                          (this.host._settingsDialog = { ...this.host._settingsDialog!, bgColor: null })}>${this.host._t('gs.bg_default')}</button>`
                      : html`<span class="opl">${this.host._t('gs.bg_theme')}</span>`}
                  </div>`
                : nothing}`,
          })}
          ${formCard({
            title: this.host._t('gs.sun_group'),
            body: html`
              ${!sunStateOf(this.host.hass)
                ? html`<div class="rhint">${this.host._t('gs.sun_missing')}</div>`
                : nothing}
              <div class="sunrow">
                ${this.host._renderCompass()}
                <div class="suncol">
                  <div class="helpfieldlabel compact">
                    <label for="gs-north">${this.host._t('gs.north')}</label>
                    ${this._help('gs.north.help')}
                  </div>
                  <div class="colorrow">
                    <input id="gs-north" class="namein tempin" type="number" min="0" max="359" step="1"
                      placeholder=${this.host._t('gs.north_ph')}
                      .value=${this.host._settingsDialog!.northDeg === null ? '' : String(this.host._settingsDialog!.northDeg)}
                      @input=${(e: Event) => {
                        const raw = (e.target as HTMLInputElement).value.trim();
                        const n = raw === '' ? null : Math.round(Number(raw));
                        this.host._settingsDialog = {
                          ...this.host._settingsDialog!,
                          northDeg: n !== null && Number.isFinite(n) ? Math.min(359, Math.max(0, n)) : null,
                        };
                      }} />
                    ${this.host._settingsDialog!.northDeg !== null
                      ? html`<button class="btn ghost" @click=${() =>
                          (this.host._settingsDialog = { ...this.host._settingsDialog!, northDeg: null })}>${this.host._t('gs.north_clear')}</button>`
                      : nothing}
                  </div>
                </div>
              </div>
              <label class="srcrow">
                ${this._boolInput(this.host._settingsDialog!.sunRays, (v) =>
                  (this.host._settingsDialog = { ...this.host._settingsDialog!, sunRays: v }))}
                <span>${this.host._t('gs.sun_rays')}</span>
              </label>
              ${renderSunRayOriginSelect(this.host._settingsDialog!.sunRayOrigin, (key) => this.host._t(key), (sunRayOrigin) => (this.host._settingsDialog = { ...this.host._settingsDialog!, sunRayOrigin }))}`,
          })}
          ${formCard({
            title: this.host._t('gs.card_data'),
            body: html`
              ${this.host._canEdit ? html`
                <label class="dispsection">${this.host._t('gs.backup_group')}${this._help('gs.backup_group.help')}</label>
                <div class="backupactions">
                  <button class="btn ghost" @click=${() => this._openBackupExport()}>
                    <ha-icon icon="mdi:download"></ha-icon>${this.host._t('backup.export_open')}
                  </button>
                  <span class="backupupload">
                    <button class="btn ghost" type="button" @click=${(e: Event) =>
                      ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                      <ha-icon icon="mdi:upload"></ha-icon>${this.host._t('backup.import_open')}
                    </button>
                    <input type="file" accept="application/json,.json" @change=${(event: Event) => this._pickBackupImport(event)} />
                  </span>
                  ${this.host._canOptimizeUndo && this.host._undoKind === 'import' ? html`
                    <button class="btn ghost" @click=${() => this._undoPlanOptimization()}
                      ?disabled=${this.host._optimizeUndoBusy}>
                      <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t('backup.undo_import')}
                    </button>` : nothing}
                </div>` : nothing}
              <label class="dispsection">${this.host._t('gs.grid_group')}${this._help('gs.grid_group.help')}</label>
              <div class="colorrow gsrow">
                <button class="btn ghost alignall" @click=${() => this._openAlignDialog()}>
                  <ha-icon icon="mdi:broom"></ha-icon>${this.host._t('gs.align_all')}
                </button>
              </div>
              ${this.host._canOptimizeUndo && this.host._undoKind !== 'import' ? html`<div class="colorrow gsrow">
                <button class="btn ghost alignall" @click=${() => this._undoPlanOptimization()}
                  ?disabled=${this.host._optimizeUndoBusy}>
                  <ha-icon icon="mdi:undo-variant"></ha-icon>${this.host._t('gs.optimize_undo')}
                </button>
              </div>` : nothing}`,
          })}
        </div>
        <div class="row" slot="footer">
          <button class="btn ghost" @click=${() =>
            (this.host._settingsDialog = { ...this.host._settingsDialog!, colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: this.host._imperial ? 9.8 : 3, bgColor: null, northDeg: null, bgMode: 'daynight', sunRays: false, sunRayOrigin: 'inner', showRoomTooltip: true, radarShowLive: true, zigbeeTopology: { enabled: false, z2mBaseTopics: [] } })}>
            ${this.host._t('gs.reset')}
          </button>
          <span class="spacer"></span>
          <button class="btn ghost" data-hp="dialog-cancel" @click=${() => (this.host._settingsDialog = null)}>${this.host._t('btn.cancel')}</button>
          <button class="btn on" data-hp="dialog-confirm" @click=${() => this._saveSettingsDialog()} ?disabled=${this.host._settingsDialog!.busy}>
            <ha-icon icon="mdi:check"></ha-icon>${this.host._settingsDialog!.busy ? '…' : this.host._t('btn.save')}
          </button>
        </div>
    </hp-dialog>`;
  }
