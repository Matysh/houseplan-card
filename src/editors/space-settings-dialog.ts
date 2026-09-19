/**
 * Диалог «Пространство» (#592: вынесен из houseplan-editor-runtime.ts как есть).
 *
 * Тело перенесено побайтово: тип `this` объявлен параметром, поэтому ни одна
 * строка разметки, ни один обработчик и ни один якорь мутанта не переписаны.
 * Состояние остаётся на хосте — модуль только рисует (#592, К2).
 */
import { html, nothing, type TemplateResult } from 'lit';

import { formCard, segmented } from './form-kit';

import { gridCellFieldToCm, gridCellFieldValue } from '../grid-scale';
import { DEFAULT_CUSTOM_FILL, SPACE_FILL_UI_MODES, stageBgOf } from '../logic';
import { openSpaceCopyDialog, renderSpaceCopyDialog } from '../space-copy-runtime';
import { strictNumber, switchSpacePlanSource, touchSpaceDisplay } from '../space-dialog';
import { bgModeOf, northDegOf } from '../sun';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
/* #592: границы шага сетки живут рядом с полем, которое их показывает; кламп
 * записи в редакторском рантайме импортирует их отсюда — одно число, один
 * источник, и направление импорта то же, что у самой функции рисования. */
export const CELL_CM_MIN = 0.1;
export const CELL_CM_MAX = 1000;


export function renderSpaceSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
    const d = this.host._spaceDialog!;
    if (d.copy) return renderSpaceCopyDialog(this.host, () => { void this._saveSpaceCopy(); });
    const progress = this.host._importTotal > 0 && d.mode === 'create'
      ? this.host._t('import.progress', {
          i: this.host._importTotal - this.host._importQueue.length,
          n: this.host._importTotal,
        })
      : '';
    const close = () => {
      this.host._spaceDialog = null;
      this.host._importQueue = [];
      this.host._importTotal = 0;
    };
    return html`<hp-dialog .hass=${this.host.hass} data-kind="space"
      .title=${`${d.mode === 'create' ? this.host._t('space.new') : this.host._t('space.header')}${progress ? ` · ${progress}` : ''}`}
      icon="mdi:floor-plan" wide @hp-close=${close}>
        <div class="body hpf-form">
          ${formCard({
            title: this.host._t('space.card_basics'),
            body: html`
          <label>${this.host._t('space.title_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('space.title_ph')}
            .value=${d.title}
            @input=${(e: Event) => (this.host._spaceDialog = { ...d, title: (e.target as HTMLInputElement).value })} />
          <label>${this.host._t('space.plan_label')}</label>
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'file'}
              @change=${() => (this.host._spaceDialog = switchSpacePlanSource(d, 'file'))} />
            <span>${this.host._t('space.source_file')}</span>
          </label>
          ${d.source === 'file'
            ? html`<div class="planrow">
                ${d.planFile
                  ? html`<span class="planname">${d.planFile.name}</span>`
                  : d.planUrl
                    ? html`<img class="planprev" src=${this.host._display(d.planUrl)} alt=${this.host._t('space.plan_alt')} />`
                    : html`<span class="planname muted">${this.host._t('space.no_plan')}</span>`}
                <span class="fileupload">
                  <button class="btn filebtn" type="button" @click=${(e: Event) =>
                    ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                    <ha-icon icon="mdi:upload"></ha-icon>${d.planUrl || d.planFile ? this.host._t('btn.replace') : this.host._t('btn.upload')}
                  </button>
                  <input type="file" hidden accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                    @change=${(e: Event) => this._pickPlanFile(e)} />
                </span>
                <button class="btn ghost" @click=${() => this._toggleServerPlans()}
                  title=${this.host._t('space.pick_saved_hint')}>
                  <ha-icon icon="mdi:folder-image"></ha-icon>${this.host._t('space.pick_saved')}
                </button>
              </div>
              ${d.pickSaved ? this._renderServerPlans(d) : nothing}`
            : nothing}
          <label class="srcrow">
            <input type="radio" name="plansrc" .checked=${d.source === 'draw'}
              @change=${() => (this.host._spaceDialog = switchSpacePlanSource(d, 'draw'))} />
            <span>${this.host._t('space.source_draw')}</span>
          </label>

          <div class="helpfieldlabel">
            <label for="space-cell-cm">${this.host._t('space.scale_label')}</label>
            ${this._help('space.cell_cm.help')}
          </div>
          <div class="colorrow">
            <input id="space-cell-cm" class="namein tempin" type="number"
              min=${gridCellFieldValue(CELL_CM_MIN, this.host._imperial)}
              max=${gridCellFieldValue(CELL_CM_MAX, this.host._imperial)}
              step="0.1" .value=${d.cellCmInput ?? gridCellFieldValue(d.cellCm, this.host._imperial)}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value;
                const n = strictNumber(raw);
                const canonical = n == null ? null : gridCellFieldToCm(n, this.host._imperial);
                this.host._spaceDialog = {
                  ...d,
                  cellCmInput: raw,
                  cellCmTouched: true,
                  cellCm: canonical != null && canonical > 0
                    ? Math.max(CELL_CM_MIN, Math.min(CELL_CM_MAX, canonical)) : d.cellCm,
                };
              }} />
            <span class="opl">${this.host._t(
              this.host._imperial ? 'space.scale_unit_imperial' : 'space.scale_unit',
            )}</span>
          </div>`,
          })}
          ${formCard({
            title: this.host._t('space.display_section'),
            body: html`
          <label class="srcrow">
            ${this._boolInput(d.showBorders, (v) => (this.host._spaceDialog = touchSpaceDisplay(d, 'showBorders', v)))}
            <span>${this.host._t('space.show_borders')}</span>
          </label>
          <div class="helpfieldlabel">
            <label for="space-zero-wall-style">${this.host._t('space.zero_wall_style')}</label>
            ${this._help('space.zero_wall_style.help')}
          </div>
          <select id="space-zero-wall-style" class="areasel"
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              this.host._spaceDialog = {
                ...d, zeroWallStyle: value === 'solid' ? 'solid' : 'dashed',
              };
            }}>
            <option value="dashed" ?selected=${d.zeroWallStyle === 'dashed'}>
              ${this.host._t('space.zero_wall_dashed')}
            </option>
            <option value="solid" ?selected=${d.zeroWallStyle === 'solid'}>
              ${this.host._t('space.zero_wall_solid')}
            </option>
          </select>
          <label class="srcrow">
            ${this._boolInput(d.showNames, (v) => (this.host._spaceDialog = touchSpaceDisplay(d, 'showNames', v)))}
            <span>${this.host._t('space.show_names')}</span>
          </label>
          <label class="srcrow">
            ${this._boolInput(d.showLqi, (v) => (this.host._spaceDialog = { ...d, showLqi: v }))}
            <span>${this.host._t('space.show_lqi')}</span>
          </label>
          ${''/* the two "draw less" switches (owner 2026-08-05). They only
                 hide: the shapes and the openings stay in the config and
                 stay visible in the editor that owns them, so nothing is
                 lost and nothing becomes uneditable. */}
          <label class="srcrow">
            ${this._boolInput(d.hideDecor, (v) => (this.host._spaceDialog = { ...d, hideDecor: v }))}
            <span>${this.host._t('space.hide_decor')}</span>
            ${this._help('space.hide_decor.help')}
          </label>

          <label class="srcrow">
            ${this._boolInput(d.hideOpenings, (v) => (this.host._spaceDialog = { ...d, hideOpenings: v }))}
            <span>${this.host._t('space.hide_openings')}</span>
            ${this._help('space.hide_openings.help')}
          </label>

          <div class="colorrow">
            <hp-color-opacity .label=${this.host._t('space.room_color')}
              .opacityLabel=${this.host._t('space.opacity')}
              .pickerLabels=${this.host._colorPickerLabels}
              .color=${d.roomColor} .opacity=${d.roomOpacity} .showOpacity=${true}
              @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                this.host._spaceDialog = {
                  ...d, roomColor: e.detail.color, roomOpacity: e.detail.opacity,
                };
              }}></hp-color-opacity>
          </div>
          <div class="helpfieldlabel">
            <span>${this.host._t('space.fill_label')}</span>
            ${this._help('space.fill_mode.help')}
          </div>
          ${SPACE_FILL_UI_MODES.map((v) => [v, 'fill.' + v] as const).map(
            ([v, k]) => html`<label class="srcrow">
              <input type="radio" name="fillmode" .checked=${d.fillMode === v}
                @change=${() => (this.host._spaceDialog = { ...d, fillMode: v as any })} />
              <span>${this.host._t(k as any)}</span>
              ${v === 'temp' && d.fillMode === 'temp'
                ? html`<span class="temprange">
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMin)}
                      @input=${(e: Event) => {
                        const n = strictNumber((e.target as HTMLInputElement).value);
                        if (n != null) this.host._spaceDialog = { ...d, tempMin: n };
                      }} />
                    –
                    <input class="namein tempin" type="number" step="0.5" .value=${String(d.tempMax)}
                      @input=${(e: Event) => {
                        const n = strictNumber((e.target as HTMLInputElement).value);
                        if (n != null) this.host._spaceDialog = { ...d, tempMax: n };
                      }} />
                    °C
                  </span>`
                : nothing}
            </label>
              ${v === 'custom' && d.fillMode === 'custom'
                ? html`<div class="colorrow gsrow">
                    <span class="gsl">${this.host._t('space.custom_fill')}</span>
                    <hp-color-opacity
                      .label=${this.host._t('space.custom_fill')}
                      .opacityLabel=${this.host._t('space.opacity')}
                      .pickerLabels=${this.host._colorPickerLabels}
                      .color=${(d.customFill || DEFAULT_CUSTOM_FILL).c}
                      .opacity=${(d.customFill || DEFAULT_CUSTOM_FILL).a}
                      @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                        this.host._spaceDialog = { ...d, customFill: { c: e.detail.color, a: e.detail.opacity } };
                      }}></hp-color-opacity>
                    ${d.customFill
                      ? html`<button class="btn ghost" type="button"
                          @click=${() => (this.host._spaceDialog = { ...d, customFill: null })}>
                          ${this.host._t('btn.reset')}</button>`
                      : nothing}
                  </div>`
                : nothing}`,
          )}`,
          })}
          ${formCard({
            title: this.host._t('space.roomcard_section'),
            body: html`
          ${([['labelTemp', 'space.label_temp'], ['labelHum', 'space.label_hum'],
              ['labelLqi', 'space.label_lqi'], ['labelLight', 'space.label_light']] as const).map(
            ([f, k]) => html`<label class="srcrow">
              ${this._boolInput(d[f], (v) => (this.host._spaceDialog = { ...d, [f]: v }))}
              <span>${this.host._t(k)}</span>
            </label>`,
          )}
          <label>${this.host._t('space.card_font')}</label>
          <div class="colorrow gsrow">
            ${this._rangeInput(50, 300, 5, Math.round(d.cardFontScale * 100), (n) => (this.host._spaceDialog = { ...d, cardFontScale: n / 100 }))}
            <span class="opv">${Math.round(d.cardFontScale * 100)}%</span>
          </div>
          ${this.host._renderCardPreview(d.cardFontScale, 1, 1)}`,
          })}
          ${formCard({
            title: this.host._t('space.card_sun'),
            body: html`
          <div class="helpfieldlabel">
            <label for="space-bg-mode">${this.host._t('space.bg_mode')}</label>
            ${this._help('space.bg_mode.help')}
          </div>
          <select id="space-bg-mode" class="areasel"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this.host._spaceDialog = { ...d, bgMode: v === 'static' || v === 'daynight' ? (v as any) : null };
            }}>
            <option value="" ?selected=${d.bgMode === null}>${this.host._t('space.sun_inherit')}</option>
            <option value="static" ?selected=${d.bgMode === 'static'}>${this.host._t('gs.bg_static')}</option>
            <option value="daynight" ?selected=${d.bgMode === 'daynight'}>${this.host._t('gs.bg_daynight')}</option>
          </select>
          ${(d.bgMode ?? bgModeOf(this.host._settings, {})) === 'static'
            ? html`<div class="colorrow">
                <hp-color-opacity .label=${this.host._t('space.bg_color')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${d.bgColor || stageBgOf(this.host._settings, { bgColor: null }) || this.host._stageBgHex()}
                  .opacity=${1} .showOpacity=${false}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                    this.host._spaceDialog = { ...d, bgColor: e.detail.color };
                  }}></hp-color-opacity>
                ${d.bgColor
                  ? html`<button class="btn ghost" @click=${() => (this.host._spaceDialog = { ...d, bgColor: null })}>
                      ${this.host._t('space.bg_inherit')}</button>`
                  : html`<span class="opl">${this.host._t('space.bg_inherited')}</span>`}
              </div>`
            : nothing}
          <div class="helpfieldlabel">
            <label for="space-north">${this.host._t('space.north')}</label>
            ${this._help('space.north.help')}
          </div>
          <div class="colorrow">
            <input id="space-north" class="namein tempin" type="number" min="0" max="359" step="1"
              placeholder=${this.host._t('space.sun_inherit')}
              .value=${d.northDeg === null ? '' : String(d.northDeg)}
              @input=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value.trim();
                const n = raw === '' ? null : Math.round(Number(raw));
                this.host._spaceDialog = { ...d, northDeg: n !== null && Number.isFinite(n) ? Math.min(359, Math.max(0, n)) : null };
              }} />
            <span class="opl">${d.northDeg === null
              ? this.host._t('space.north_inherited', {
                  v: northDegOf(this.host._settings, {}) === null ? '—' : String(northDegOf(this.host._settings, {})) + '°',
                })
              : '°'}</span>
          </div>
          <label>${this.host._t('space.sun_rays')}</label>
          <select class="areasel"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              this.host._spaceDialog = { ...d, sunRays: v === '' ? null : v === '1' };
            }}>
            <option value="" ?selected=${d.sunRays === null}>${this.host._t('space.sun_inherit')}</option>
            <option value="1" ?selected=${d.sunRays === true}>${this.host._t('space.sun_on')}</option>
            <option value="0" ?selected=${d.sunRays === false}>${this.host._t('space.sun_off')}</option>
          </select>
          <label class="srcrow">
            ${this._boolInput(d.glowEnabled, (checked) => {
              this.host._spaceDialog = { ...d, glowEnabled: checked };
            })}
            <span>${this.host._t('space.glow_enabled')}</span>
          </label>`,
          })}
          ${d.deleteBlockers
            ? html`<div class="backuperror" role="alert">${this.host._t('space.delete_blocked', {
                n: String(d.deleteBlockers),
              })}</div>`
            : nothing}
        </div>
        <div class="row dialog-action-footer" slot="footer">
          ${d.mode === 'edit'
            ? html`<div class="dialog-action-group">
                <button class="btn ghost" @click=${() => openSpaceCopyDialog(this.host)} ?disabled=${d.busy}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>${this.host._t('btn.copy')}
                </button>
              </div>`
            : nothing}
          ${d.mode === 'edit'
            ? html`<div class="dialog-action-group dialog-action-danger">
                <button class="btn danger" @click=${() => this._deleteSpace()} ?disabled=${d.busy}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
                </button>
              </div>`
            : nothing}
          <div class="dialog-action-group dialog-action-commit">
            ${this.host._importTotal > 0 && d.mode === 'create'
              ? html`<button class="btn ghost" @click=${() => this._skipImport()}>${this.host._t('btn.skip')}</button>`
              : nothing}
            <button class="btn ghost" data-hp="dialog-cancel" @click=${close}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" data-hp="dialog-confirm" @click=${() => this._saveSpaceDialog()}
              ?disabled=${!d.title.trim() || (d.source === 'file' && !(d.planFile || d.planUrl)) || d.busy}
              title=${d.source === 'file' && !(d.planFile || d.planUrl) ? this.host._t('title.need_plan') : ''}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }
