/**
 * Диалог «Общие настройки» по референсу `docs/design/600-settings-dialogs/`
 * (#600, серия 2; §5 SPEC.md).
 *
 * Семь карточек #598 остались на месте — менялось содержимое, не состав:
 * строки-тумблеры с иконкой и подписью, плитки цвета по три в ряд, компактный
 * компас, сегмент источника лучей, футер со статусом. Каждый контрол пишет в
 * тот же ключ `_settingsDialog`, что и раньше (К1); сообщение о состоянии
 * `gs.sun_missing` остаётся callout'ом (К5).
 */
import { html, nothing, type TemplateResult } from 'lit';

import {
  callout, colorField, colorRow, colorTile, colorTiles, ensureFormKitStyles, field, footerStatus,
  formCard, segmented, subsection, textLink, toggleRow, unitInput,
} from './form-kit';
import { forgetGeneralBaseline, generalDirty, generalProblems, type GeneralSettingsDraft } from './general-form-state';
import { langOf, type I18nKey } from '../i18n';
import { settingsT, type SettingsI18nKey } from '../i18n/settings';
import { supportT } from '../i18n/support';
import { hasTopologyTranslation, topologyT } from '../i18n/topology';
import { DEFAULT_FILL_COLORS, type FillColors } from '../logic';
import { strictNumber } from '../space-dialog';
import { sunStateOf } from '../sun';
import { renderSunRayOriginSegment } from '../sun-settings-view';
import { zigbeeTopologySettingsOf } from '../zigbee-topology-settings';
import type { ZigbeeTopologySettings } from '../zigbee-topology-settings';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';

export function renderGeneralSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureFormKitStyles(this.host);
  const host = this.host;
  const d = host._settingsDialog!;
  const t = host._t.bind(host);
  const lang = langOf(host.hass, host._config?.language);
  const st = (key: SettingsI18nKey, vars?: Record<string, string | number>) => settingsT(lang, key, vars);
  const set = (patch: Partial<GeneralSettingsDraft>) => { host._settingsDialog = { ...host._settingsDialog!, ...patch }; };
  const problems = generalProblems(d);
  const problemFor = (fieldId: string) => problems.find((p) => p.field === fieldId);
  const dirty = generalDirty(host, d);
  const canSave = dirty && problems.length === 0 && !d.busy;
  const close = () => { forgetGeneralBaseline(host); host._settingsDialog = null; };
  const requestClose = async (event: Event) => {
    if (!dirty || d.busy) { close(); return; }
    const dialog = event.currentTarget as { rejectClose?: () => void } | null;
    const discard = await host._confirmDanger({
      key: 'discard-settings-dialog', kind: 'warning',
      title: st('dialog.discard_title'), message: st('dialog.discard_message'),
      confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
      icon: 'mdi:content-save-off-outline', confirmIcon: 'mdi:content-save-off-outline',
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
  /** Плитка цвета палитры: свотч — trigger пикера с той же атомарной записью. */
  const tile = (key: keyof FillColors, labelKey: I18nKey) => {
    const v = d.colors[key];
    const label = t(labelKey);
    return colorTile({
      label, hex: v.c, opacity: v.a, opacityLabel: st('gs.opacity_of', { name: label }),
      onOpacity: (a) => this._setFillColor(key, { c: v.c, a }),
      picker: html`<hp-color-opacity .label=${label} hide-label flat-swatch cover-swatch
        .opacityLabel=${t('space.opacity')}
        .pickerLabels=${host._colorPickerLabels}
        .color=${v.c} .opacity=${v.a} .showOpacity=${true}
        @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
          this._setFillColor(key, { c: e.detail.color, a: e.detail.opacity });
        }}></hp-color-opacity>`,
    });
  };
  const glowProblem = problemFor('gs-glow-radius');
  const northProblem = problemFor('gs-north');
  const zigbeeHelp = hasTopologyTranslation(lang, 'help') && hasTopologyTranslation(lang, 'help_aria')
    ? html`<hp-help data-help-key="topology.help" .text=${topologyT(lang, 'help')} .ariaLabel=${topologyT(lang, 'help_aria')}></hp-help>`
    : nothing;

  return html`<hp-dialog .hass=${host.hass} data-kind="settings" form-shell wide
      .title=${t('gs.title')} icon="mdi:cog-outline" @hp-close=${requestClose}>
    <div class="body hpf-form">
      ${formCard({
        id: 'display',
        title: t('gs.card_display'),
        body: html`
          ${toggleRow({
            id: 'gs-room-tooltip', icon: 'mdi:tooltip-text-outline',
            title: supportT(lang, 'gs.show_room_tooltip'), caption: st('gs.show_room_tooltip_hint'),
            checked: d.showRoomTooltip, onChange: (v) => set({ showRoomTooltip: v }),
          })}
          ${toggleRow({
            id: 'gs-radar-live', icon: 'mdi:radar',
            title: t('gs.radar_show_live'), caption: st('gs.radar_show_live_hint'),
            checked: d.radarShowLive, onChange: (v) => set({ radarShowLive: v }),
          })}`,
      })}
      ${formCard({
        id: 'zigbee',
        title: t('gs.card_zigbee'),
        help: zigbeeHelp,
        body: html`<hp-zigbee-topology-settings embedded .hass=${host.hass} .value=${d.zigbeeTopology}
          .savedEnabled=${zigbeeTopologySettingsOf(host._settings).enabled} .devices=${host._devices} .registry=${host._haRegistry}
          @hp-topology-settings-change=${(event: CustomEvent<ZigbeeTopologySettings>) => set({ zigbeeTopology: event.detail })}></hp-zigbee-topology-settings>`,
      })}
      ${formCard({
        id: 'fills',
        title: t('gs.card_fills'),
        help: this._help('gs.card_fills.help'),
        body: html`
          ${subsection({ title: t('gs.light_group') })}
          ${colorTiles([tile('light_on', 'gs.light_on'), tile('light_off', 'gs.light_off'), tile('light_none', 'gs.light_none')])}
          ${subsection({ title: t('gs.temp_group') })}
          ${colorTiles([tile('temp_cold', 'gs.temp_cold'), tile('temp_ok', 'gs.temp_ok'), tile('temp_hot', 'gs.temp_hot')])}
          ${subsection({ title: t('gs.lqi_group') })}
          ${colorTiles([tile('lqi_low', 'gs.lqi_low'), tile('lqi_high', 'gs.lqi_high')])}`,
      })}
      ${formCard({
        id: 'glow',
        title: t('gs.glow_group'),
        body: html`
          ${colorTiles([tile('glow_base', 'gs.glow_base'), tile('glow_light', 'gs.glow_light')])}
          ${field({
            label: t('gs.glow_radius'), htmlFor: 'gs-glow-radius', help: this._help('gs.glow_radius.help'),
            error: glowProblem ? st(glowProblem.message) : undefined,
            control: unitInput({
              id: 'gs-glow-radius', value: String(d.glowRadius), min: 0.5, step: 0.5, invalid: !!glowProblem,
              unit: host._imperial ? t('gs.unit_ft') : t('gs.unit_m'),
              onInput: (raw) => {
                const v = strictNumber(raw);
                if (v != null && v > 0) set({ glowRadius: v });
              },
            }),
          })}`,
      })}
      ${formCard({
        id: 'plan',
        title: t('gs.card_plan'),
        body: html`
          ${colorRow({
            label: t('gs.wall_fill'),
            picker: colorField({
              hex: d.colors.wall_fill.c, opacity: d.colors.wall_fill.a, opacityLabel: t('space.opacity'),
              onOpacity: (a) => this._setFillColor('wall_fill', { c: d.colors.wall_fill.c, a }),
              resetLabel: t('btn.reset'),
              onReset: () => this._setFillColor('wall_fill', { ...DEFAULT_FILL_COLORS.wall_fill }),
              picker: html`<hp-color-opacity .label=${t('gs.wall_fill')} hide-label flat-swatch
                .opacityLabel=${t('space.opacity')} .pickerLabels=${host._colorPickerLabels}
                .color=${d.colors.wall_fill.c} .opacity=${d.colors.wall_fill.a} .showOpacity=${true}
                @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                  this._setFillColor('wall_fill', { c: e.detail.color, a: e.detail.opacity });
                }}></hp-color-opacity>`,
            }),
          })}
          ${field({
            label: t('gs.bg_mode'), help: this._help('gs.bg_mode.help'),
            control: segmented({
              name: 'gs-bg-mode',
              value: d.bgMode === 'daynight' ? 'daynight' : 'static',
              ariaLabel: t('gs.bg_mode'),
              options: [
                { value: 'static', label: t('gs.bg_static') },
                { value: 'daynight', label: t('gs.bg_daynight') },
              ],
              onChange: (value) => set({ bgMode: value === 'daynight' ? 'daynight' : 'static' }),
            }),
          })}
          ${d.bgMode === 'static'
            ? field({
                label: t('gs.bg_color'),
                hint: st(d.bgColor ? 'gs.bg_custom_hint' : 'gs.bg_theme_hint'),
                control: colorField({
                  hex: d.bgColor || host._stageBgHex(),
                  resetLabel: d.bgColor ? t('gs.bg_default') : undefined,
                  onReset: () => set({ bgColor: null }),
                  picker: html`<hp-color-opacity .label=${t('gs.bg_color')} hide-label flat-swatch
                    .pickerLabels=${host._colorPickerLabels}
                    .color=${d.bgColor || host._stageBgHex()} .opacity=${1} .showOpacity=${false}
                    @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => set({ bgColor: e.detail.color })}></hp-color-opacity>`,
                }),
              })
            : nothing}`,
      })}
      ${formCard({
        id: 'sun',
        title: t('gs.sun_group'),
        body: html`
          ${!sunStateOf(host.hass)
            ? callout({ kind: 'warning', role: 'status', text: t('gs.sun_missing') })
            : nothing}
          <div class="hpf-north">
            <span class="hpf-labelrow"><label for="gs-north">${t('gs.north')}</label>${this._help('gs.north.help')}</span>
            <div class="hpf-inline hpf-wrap">
              ${unitInput({
                id: 'gs-north', value: d.northDeg === null ? '' : String(d.northDeg), unit: '°',
                min: 0, max: 359, step: 1, placeholder: t('gs.north_ph'), invalid: !!northProblem,
                onInput: (raw) => {
                  const trimmed = raw.trim();
                  const n = trimmed === '' ? null : Math.round(Number(trimmed));
                  set({ northDeg: n !== null && Number.isFinite(n) ? n : null });
                },
              })}
              ${d.northDeg !== null ? textLink(t('gs.north_clear'), () => set({ northDeg: null })) : nothing}
            </div>
            <span class="hpf-north-n" aria-hidden="true">${t('gs.north_letter')}</span>
            ${host._renderCompass()}
          </div>
          ${northProblem ? html`<p class="hpf-error" role="alert">${st(northProblem.message)}</p>` : nothing}
          ${toggleRow({
            id: 'gs-sun-rays', icon: 'mdi:weather-sunny',
            title: t('gs.sun_rays'), caption: st('gs.sun_rays_hint'),
            checked: d.sunRays, onChange: (v) => set({ sunRays: v }),
          })}
          ${renderSunRayOriginSegment(d.sunRayOrigin, (key) => t(key), (sunRayOrigin) => set({ sunRayOrigin }))}`,
      })}
      ${formCard({
        id: 'data',
        title: t('gs.card_data'),
        body: html`
          ${host._canEdit ? html`
            ${subsection({ title: t('gs.backup_group'), help: this._help('gs.backup_group.help') })}
            <div class="hpf-actions">
              <button class="btn" @click=${() => this._openBackupExport()}>
                <ha-icon icon="mdi:download"></ha-icon>${t('backup.export_open')}
              </button>
              <span class="backupupload">
                <button class="btn" type="button" @click=${(e: Event) =>
                  ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                  <ha-icon icon="mdi:upload"></ha-icon>${t('backup.import_open')}
                </button>
                <input type="file" accept="application/json,.json" @change=${(event: Event) => this._pickBackupImport(event)} />
              </span>
              ${host._canOptimizeUndo && host._undoKind === 'import' ? html`
                <button class="btn" @click=${() => this._undoPlanOptimization()} ?disabled=${host._optimizeUndoBusy}>
                  <ha-icon icon="mdi:undo-variant"></ha-icon>${t('backup.undo_import')}
                </button>` : nothing}
            </div>` : nothing}
          ${subsection({ title: t('gs.grid_group'), help: this._help('gs.grid_group.help') })}
          <div class="hpf-actions">
            <button class="btn" @click=${() => this._openAlignDialog()}>
              <ha-icon icon="mdi:broom"></ha-icon>${t('gs.align_all')}
            </button>
            ${host._canOptimizeUndo && host._undoKind !== 'import' ? html`
              <button class="btn" @click=${() => this._undoPlanOptimization()} ?disabled=${host._optimizeUndoBusy}>
                <ha-icon icon="mdi:undo-variant"></ha-icon>${t('gs.optimize_undo')}
              </button>` : nothing}
          </div>`,
      })}
    </div>
    <div class="row dialog-action-footer hpf-footer" slot="footer">
      <div class="dialog-action-group">
        <button class="btn ghost" @click=${() => set({
          colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: host._imperial ? 9.8 : 3,
          bgColor: null, northDeg: null, bgMode: 'daynight', sunRays: false, sunRayOrigin: 'inner',
          showRoomTooltip: true, radarShowLive: true, zigbeeTopology: { enabled: false, z2mBaseTopics: [] },
        })}>${t('gs.reset')}</button>
      </div>
      ${footerStatus(problems.length
        ? { action: textLink(st('dialog.review_fields', { n: String(problems.length) }), reviewFirst) }
        : {})}
      <div class="dialog-action-group dialog-action-commit">
        <button class="btn ghost" data-hp="dialog-cancel" @click=${requestClose}>${t('btn.cancel')}</button>
        <button class="btn on" data-hp="dialog-confirm" @click=${() => this._saveSettingsDialog()} ?disabled=${!canSave}
          title=${problems[0] ? st(problems[0].message) : ''}>
          <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : t('btn.save')}
        </button>
      </div>
    </div>
  </hp-dialog>`;
}
