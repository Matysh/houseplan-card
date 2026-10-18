/** Shared settings layout; existing general draft and operations (#948). */
import { html, nothing, type TemplateResult } from 'lit';

import {
  callout, colorField, colorRow, colorTile, colorTiles, field, footerStatus,
  formCard, selectControl, subsection, textLink, toggleRow, unitInput,
} from './form-kit';
import { settingsSections, revealSettingsField, selectedSettingsSection } from './settings-sections';
import { ensureSettingsDialogStyles } from './settings-styles';
import { settingsNorth } from './settings-north';
import { settingsBackgroundPreviews } from './settings-background-previews';
import { forgetGeneralBaseline, generalDirty, generalProblems, type GeneralSettingsDraft } from './general-form-state';
import { moonStatusOf, moonStatusText } from './moon-status';
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
import type { DeviceBatteryMode } from '../device-battery-settings';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import { signalVisibilityModeOf, type SignalSpaceSettings } from '../signal-visibility';

export function renderGeneralSettingsDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureSettingsDialogStyles(this.host);
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
  const leaveFor = async (action: () => void | Promise<void>) => {
    if (d.busy) return;
    if (dirty && !await host._confirmDanger({
      key: 'discard-settings-dialog', kind: 'warning',
      title: st('dialog.discard_title'), message: st('dialog.discard_message'),
      confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
      icon: 'mdi:content-save-off-outline', confirmIcon: 'mdi:content-save-off-outline',
    })) return;
    close();
    await action();
  };
  const reviewFirst = () => {
    const first = problems[0];
    if (!first) return;
    const node = (host.renderRoot as ParentNode).querySelector<HTMLElement>(`#${first.field}`);
    if (node) revealSettingsField(host, node);
  };
  /** Плитка цвета палитры: свотч — trigger пикера с той же атомарной записью. */
  const tile = (key: keyof FillColors, labelKey: I18nKey) => {
    const v = d.colors[key];
    const label = t(labelKey);
    return colorTile({
      label, hex: v.c, opacity: v.a, opacityLabel: st('gs.opacity_of', { name: label }),
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
  const lqiOverrides = (host._serverCfg?.spaces || [])
    .filter((space: { settings?: SignalSpaceSettings }) => signalVisibilityModeOf(space.settings) !== 'inherit')
    .map((space: { title?: string; id: string }) => space.title || space.id);
  // #718 K7: the second caption line, once the moon chunk judged this opening.
  const moonStatus = moonStatusOf(host);
  const zigbeeHelp = hasTopologyTranslation(lang, 'help') && hasTopologyTranslation(lang, 'help_aria')
    ? html`<hp-help instant data-help-key="topology.help" .text=${topologyT(lang, 'help')} .ariaLabel=${topologyT(lang, 'help_aria')}></hp-help>`
    : nothing;

  return html`<hp-dialog .hass=${host.hass} data-kind="settings" form-shell settings-layout wide
      .title=${st('gs.title')} .subtitle=${st('gs.scope')} icon="mdi:cog-outline" @hp-close=${requestClose}>
    <div class="body hpf-form hpf-settings-form">
      ${settingsSections(host, 'general', [
        { id: 'display', title: st('gs.section_info'), body: html`${formCard({
        id: 'display',
        title: st('gs.section_info'),
        body: html`
          ${toggleRow({
            id: 'gs-room-tooltip', icon: 'mdi:tooltip-text-outline',
            title: supportT(lang, 'gs.show_room_tooltip'), caption: st('gs.show_room_tooltip_hint'),
            checked: d.showRoomTooltip, onChange: (v) => set({ showRoomTooltip: v }),
          })}
          ${toggleRow({
            id: 'gs-radar-live', icon: 'mdi:radar',
            title: st('gs.radar_show_live'), caption: st('gs.radar_show_live_hint'),
            checked: d.radarShowLive, onChange: (v) => set({ radarShowLive: v }),
          })}
          ${toggleRow({
            id: 'gs-volumetric-view', icon: 'mdi:cube-outline',
            title: t('gs.volumetric_view'), caption: st('gs.volumetric_view_hint'),
            checked: d.volumetricView, onChange: (v) => set({ volumetricView: v }),
          })}
          ${field({
            label: st('gs.show_device_battery'),
            control: selectControl<DeviceBatteryMode>({
              name: 'gs-device-battery',
              value: d.deviceBattery,
              ariaLabel: st('gs.show_device_battery'),
              options: [
                { value: 'all', label: st('gs.device_battery_all') },
                { value: 'low', label: st('gs.device_battery_low') },
                { value: 'off', label: st('gs.device_battery_off') },
              ],
              onChange: (deviceBattery) => set({ deviceBattery }),
            }),

          })}
          ${toggleRow({
            id: 'gs-show-lqi', icon: 'mdi:zigbee',
            title: st('gs.show_lqi'),
            checked: d.showLqi, onChange: (showLqi) => set({ showLqi }),
          })}
          ${lqiOverrides.length ? callout({ text: st('gs.space_overrides', { names: lqiOverrides.join(', ') }) }) : nothing}`,
      })}` },
        { id: 'plan', title: st('gs.section_appearance'), body: html`${formCard({
        id: 'plan',
        title: st('gs.section_appearance'),
        body: html`
          ${colorRow({
            label: st('gs.wall_fill'),
            picker: colorField({
              hex: d.colors.wall_fill.c, opacity: d.colors.wall_fill.a, opacityLabel: t('space.opacity'),

              picker: html`<hp-color-opacity .label=${st('gs.wall_fill')} hide-label flat-swatch
                .opacityLabel=${t('space.opacity')} .pickerLabels=${host._colorPickerLabels}
                .color=${d.colors.wall_fill.c} .opacity=${d.colors.wall_fill.a} .showOpacity=${true}
                @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) => {
                  this._setFillColor('wall_fill', { c: e.detail.color, a: e.detail.opacity });
                }}></hp-color-opacity>`,
            }),
          })}
          ${field({
            label: st('gs.bg_mode'), help: this._help('gs.bg_mode.help'),
            control: selectControl({
              name: 'gs-bg-mode',
              value: d.bgMode === 'daynight' ? 'daynight' : 'static',
              ariaLabel: st('gs.bg_mode'),
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

                control: html`<div class="hpf-color-with-action">${colorField({
                  hex: d.bgColor || host._stageBgHex(),
                  picker: html`<hp-color-opacity .label=${t('gs.bg_color')} hide-label flat-swatch
                    .pickerLabels=${host._colorPickerLabels}
                    .color=${d.bgColor || host._stageBgHex()} .opacity=${1} .showOpacity=${false}
                    @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => set({ bgColor: e.detail.color })}></hp-color-opacity>`,
                })}<button class="btn ghost" type="button" @click=${() => set({ bgColor: null })}>${t('gs.bg_default')}</button></div>`,
              })
            : settingsBackgroundPreviews([st('gs.phase_day'), st('gs.phase_dawn'), st('gs.phase_dusk'), st('gs.phase_night')], st('gs.daynight_rules'))}`,
      })}` },
        { id: 'fills', title: st('gs.section_fills'), body: html`${formCard({
        id: 'fills',
        title: st('gs.section_fills'),
        help: nothing,
        body: html`<p class="hpf-hint">${st('gs.palette_shared')}</p>
          ${subsection({ title: st('gs.light_group') })}
          ${colorTiles([tile('light_on', 'gs.light_on'), tile('light_off', 'gs.light_off'), tile('light_none', 'gs.light_none')])}
          ${subsection({ title: st('gs.temp_group') })}
          ${colorTiles([tile('temp_cold', 'gs.temp_cold'), tile('temp_ok', 'gs.temp_ok'), tile('temp_hot', 'gs.temp_hot')])}
          ${subsection({ title: st('gs.lqi_group') })}
          ${colorTiles([tile('lqi_low', 'gs.lqi_low'), tile('lqi_high', 'gs.lqi_high')])}`,
      })}` },
        { id: 'sun', title: st('gs.section_light'), body: html`${formCard({ id: 'sun', title: st('gs.section_light'), body: html`
          ${colorRow({ label: st('gs.default_light'), help:html`<hp-help instant .text=${st('gs.default_light_help')} .ariaLabel=${st('gs.default_light_help.aria')}></hp-help>`, picker: colorField({
            hex: d.colors.glow_light.c, opacity: d.colors.glow_light.a, opacityLabel: t('space.opacity'),
            picker: html`<hp-color-opacity .label=${t('gs.glow_light')} hide-label flat-swatch
              .opacityLabel=${t('space.opacity')} .pickerLabels=${host._colorPickerLabels}
              .color=${d.colors.glow_light.c} .opacity=${d.colors.glow_light.a} .showOpacity=${true}
              @hp-color-opacity-change=${(e: CustomEvent<{ color: string; opacity: number }>) =>
                this._setFillColor('glow_light', { c: e.detail.color, a: e.detail.opacity })}></hp-color-opacity>`,
          }) })}
          ${field({
            label: st('gs.glow_radius'), htmlFor: 'gs-glow-radius', help: this._help('gs.glow_radius.help'),
            error: glowProblem ? st(glowProblem.message) : undefined,
            control: html`${unitInput({
              id: 'gs-glow-radius', value: d.glowRadiusInput, wide:true, min: 0.5, step: 0.5, invalid: !!glowProblem,
              unit: host._imperial ? t('gs.unit_ft') : t('gs.unit_m'),
              onInput: (raw) => {
                const v = strictNumber(raw);
                set({ glowRadiusInput: raw, ...(v != null && v > 0 ? { glowRadius: v } : {}) });
              },
            })}${callout({text:st('gs.glow_radius_hint')})}`,
          })}
          ${!sunStateOf(host.hass)
            ? callout({ kind: 'warning', role: 'status', text: t('gs.sun_missing') })
            : nothing}
          ${field({ label: t('gs.north'), htmlFor: 'gs-north', help: this._help('gs.north.help'),
            control: html`${settingsNorth({ id: 'gs-north', value: d.northDeg, raw: d.northDegInput,
              label: t('gs.north'), invalid: !!northProblem, angleHint:st('gs.north_angle_hint'),
              onInput: (raw) => {
                const trimmed = raw.trim(), n = trimmed === '' ? null : strictNumber(trimmed);
                set({ northDegInput: raw, ...(trimmed === '' ? { northDeg: null } : n !== null && Number.isInteger(n) && n >= 0 && n <= 359 ? { northDeg: n } : {}) });
              }, onChange: (v) => set({ northDeg: v, northDegInput: String(v) }),
            })}${callout({text:st('gs.north_description')})}`,
          })}
          ${northProblem ? html`<p class="hpf-error" role="alert">${st(northProblem.message)}</p>` : nothing}
          ${toggleRow({
            id: 'gs-sun-rays', icon: 'mdi:weather-sunny',
            title: st('gs.sun_rays'), caption: st(d.sunRays ? 'gs.sun_rays_override' : 'gs.sun_rays_override_off'),
            checked: d.sunRays, onChange: (v) => set({ sunRays: v }),
          })}
          ${renderSunRayOriginSegment(d.sunRayOrigin, (key) => t(key), (sunRayOrigin) => set({ sunRayOrigin }))}
          ${toggleRow({ id: 'gs-moon', icon: 'mdi:moon-waning-crescent', title: st('gs.moon'),
            describedBy: 'gs-moon-status',
            checked: d.moon, onChange: (v) => set({ moon: v }),
          })}
          ${callout({ id: 'gs-moon-status', text: moonStatus
            ? html`<span data-moon-status=${moonStatus.reason}>${moonStatusText(moonStatus, st)}</span>`
            : st('gs.moon_hint') })}`, })}` },
        { id: 'zigbee', title: st('gs.section_zigbee'), body: html`${formCard({
        id: 'zigbee',
        title: st('gs.section_zigbee'),
        help: zigbeeHelp,
        body: html`<hp-zigbee-topology-settings embedded .active=${selectedSettingsSection(host, 'general') === 'zigbee'} .hass=${host.hass} .value=${d.zigbeeTopology}
          .savedEnabled=${zigbeeTopologySettingsOf(host._settings).enabled} .devices=${host._devices} .registry=${host._haRegistry}
          @hp-topology-settings-change=${(event: CustomEvent<ZigbeeTopologySettings>) => set({ zigbeeTopology: event.detail })}></hp-zigbee-topology-settings>`,
      })}` },
        { id: 'data', title: st('gs.section_maintenance'), body: html`${formCard({
        id: 'data',
        title: st('gs.section_maintenance'),
        body: html`
          ${host._canEdit ? html`

            <div class="hpf-actions">
              <button class="btn" @click=${() => leaveFor(() => this._openBackupExport())}>
                <ha-icon icon="mdi:download"></ha-icon>${st('backup.export_open')}
              </button>
              <span class="backupupload">
                <button class="btn" type="button" @click=${(e: Event) =>
                  ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                  <ha-icon icon="mdi:upload"></ha-icon>${st('backup.import_open')}
                </button>
                <input type="file" accept="application/json,.json,application/zip,.zip" @change=${(event: Event) => {
                  const input = event.target as HTMLInputElement;
                  const file = input.files?.[0]; input.value = '';
                  if (file && host._canImportBackup) void leaveFor(() => this._importBackupFile(file));
                }} />
              </span>
              ${host._canOptimizeUndo && host._undoKind === 'import' ? html`
                <button class="btn" @click=${() => this._undoPlanOptimization()} ?disabled=${host._optimizeUndoBusy}>
                  <ha-icon icon="mdi:undo-variant"></ha-icon>${st('backup.undo_import')}
                </button>` : nothing}
            </div>` : nothing}

          <div class="hpf-actions">
            <button class="btn" @click=${() => this.optimizePlans.open()} ?disabled=${!host._canEdit || host._kiosk}>
              <ha-icon icon="mdi:broom"></ha-icon>${t('gs.align_all')}
            </button>
            ${html`
              <button class="btn" @click=${() => this._undoPlanOptimization()} ?disabled=${!host._canOptimizeUndo || host._undoKind === 'import' || host._optimizeUndoBusy || !host._canEdit || host._kiosk}>
                <ha-icon icon="mdi:undo-variant"></ha-icon>${st('gs.optimize_undo')}
              </button>`}
          </div>
          ${callout({ text: html`${st('gs.converter_description')} <a href="https://houseplan.tech/convert" target="_blank" rel="noopener noreferrer">${st('gs.converter_link')}</a><br />${st('gs.converter_result')}` })}
          ${!host._canEdit || host._kiosk ? html`<p class="rhint">${st('gs.optimize_write_required')}</p>` : nothing}`,
      })}` },
      ], st('dialog.section'))}
    </div>
    <div class="row dialog-action-footer hpf-footer" slot="footer">
      ${footerStatus(problems.length
        ? { action: textLink(st('dialog.review_fields', { n: String(problems.length) }), reviewFirst) }
        : {text:st(dirty ? 'dialog.dirty' : 'dialog.saved')})}
      <div class="dialog-action-group">
        <button class="btn ghost" @click=${() => set({
          colors: JSON.parse(JSON.stringify(DEFAULT_FILL_COLORS)), glowRadius: host._imperial ? 9.8 : 3,
          glowRadiusInput: String(host._imperial ? 9.8 : 3),
          bgColor: null, northDeg: null, northDegInput: '', bgMode: 'daynight', sunRays: false, sunRayOrigin: 'inner',
          showRoomTooltip: true, showLqi: true, deviceBattery: 'all', radarShowLive: true, volumetricView: false, moon: true, zigbeeTopology: { enabled: false, z2mBaseTopics: [] },
        })}>${t('gs.reset')}</button>
      </div>
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
