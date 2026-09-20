/**
 * Диалог «Устройство на плане» по референсу `docs/design/600-settings-dialogs/`
 * (#600, серия 4; §7 SPEC.md).
 *
 * #592 вынес тело, #598 разложил его на пять карточек, #600 переложил
 * содержимое контролами набора: привязка — сегмент и кнопка выбора с панелью
 * в потоке (чекбокс «Show entities» внутри панели, Q8), роль источника и режим
 * свечения — сегменты, цвета — плашки вокруг прежнего `hp-color-opacity` (Q5),
 * тумблеры — строки набора, чипы, поля с единицами, «Display preview» —
 * прежний `hp-device-preview` целиком в блоке на тинте (Q3). Все ключи
 * `_markerDialog` и все записи в них прежние (§7.2); секции радара и пылесоса
 * рисуются своими модулями без изменений.
 */
import { html, nothing, type TemplateResult } from 'lit';

import {
  callout, chip, colorField, ensureFormKitStyles, field, fieldGrid, footerStatus, formCard, rangeEnds, rangeLine,
  segmented, sourcePicker, subsection, textLink, tintBlock, toggleRow, unitInput,
} from './form-kit';
import { forgetMarkerBaseline, markerDirty, markerProblems } from './marker-form-state';
import { settingsCopy } from './settings-copy';

import { resolveDevicePresentation } from '../device-presentation';
import { toggleEntityCandidates } from '../device-toggle';
import { recommendedValueBadgeSource, valueBadgeCandidates, valueBadgeSourceFromKey, valueBadgeSourceKey } from '../device-value-badge';
import { forcedLightEntityOf, hasOwnStatefulLightSource, ownControllableEntities, persistedExternalControls, resolveDeviceLightSettings } from '../devices';
import type { I18nKey } from '../i18n';
import {
  DISPLAY_MODES, TAP_ACTIONS, displayIsNeutral, displayWantsValue, normalizeDeviceDisplay,
  parseRoomRef, safeUrl, spaceDisplayOf, type DeviceDisplayMode,
} from '../logic';
import { radarAfterBindingChange } from '../radar-editor';
import type { ValueBadgePosition } from '../types';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
/* #592: словари ярлыков и подсказок режима переехали вместе со своим
 * единственным потребителем — диалогом устройства. */
const DISPLAY_LABEL_KEYS: Record<DeviceDisplayMode, I18nKey> = {
  badge: 'display.badge', icon_ripple: 'display.icon_ripple', value: 'display.value',
  static_icon: 'display.static_icon', value_static_icon: 'display.value_static_icon',
};
const DISPLAY_HINT_KEYS: Record<DeviceDisplayMode, I18nKey> = {
  badge: 'marker.display_hint_badge', icon_ripple: 'marker.display_hint_icon_ripple',
  value: 'marker.display_hint_value', static_icon: 'marker.display_hint_static_icon',
  value_static_icon: 'marker.display_hint_value_static_icon',
};
/** Порядок сторон бейджа по референсу: сверху, справа, снизу, слева. */
const BADGE_POSITIONS: readonly ValueBadgePosition[] = ['top', 'right', 'bottom', 'left'];

/** Сообщение о состоянии рядом с полем: предупреждение или заметка с иконкой. */
function note(text: string, kind: 'warning' | 'info', id?: string): TemplateResult {
  return html`<span id=${id ?? nothing} class="hpf-note ${kind === 'warning' ? 'hpf-note-warning' : ''}"
    role=${kind === 'warning' ? 'status' : 'note'}>
    <ha-icon icon=${kind === 'warning' ? 'mdi:alert-outline' : 'mdi:information-outline'}></ha-icon><span>${text}</span>
  </span>`;
}

export function renderMarkerDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureFormKitStyles(this.host);
    const d = this.host._markerDialog!;
    const t = this.host._t.bind(this.host);
    const { st, shelp } = settingsCopy(this.host);
    const isVirtual = d.bindingMode === 'virtual';
    const cands = this._bindingCandidates();
    const bindingStatus = isVirtual ? null : this.host._bindingStatus(d.binding);
    const canOpenBindingInHa = !isVirtual && this.host._bindingHasHaPage(d.binding);
    const previewDevice = this._markerPreviewDevice(d);
    // Untouched defaults are projections, not stored values. Re-resolve the
    // select from the current preview on every render: HA may reveal a more
    // meaningful leading entity (most visibly `light.*`) after the dialog was
    // opened. Runtime already uses that current primary, so keeping the stale
    // draft value here made the select say "Device card" while a tap toggled
    // the lamp. An explicit user choice remains authoritative and stable.
    const effectiveTapAction = this._effectiveMarkerTapAction(d, previewDevice);
    const previewSpaceDisplay = previewDevice
      ? spaceDisplayOf(this.host._serverCfg?.spaces.find((space) => space.id === previewDevice.space))
      : null;
    const previewLightDevices = previewDevice
      ? this._markerPreviewDevices(previewDevice)
      : this.host._devices;
    const toggleIntent = effectiveTapAction === 'toggle' && previewDevice
      ? this._toggleIntent(previewDevice, previewLightDevices) : null;
    const toggleHintLines = this._toggleHintLines(toggleIntent);
    const previewPresentation = previewDevice
      ? resolveDevicePresentation(this.host._planHass, previewDevice, {
          liveStates: this.host._config?.live_states !== false,
          showTemperature: this.host._config?.show_temperature !== false,
          showSignal: previewSpaceDisplay?.showLqi ?? (this.host._config?.show_signal !== false),
          designPreview: true,
          activityRuntime: this.host._activityRt.get(previewDevice.id),
          lightDevices: previewLightDevices,
          registryHass: this.host._fullRegistryHass,
          reducedMotion: this.host._reducedMotion,
        })
      : null;
    const badgeCandidates = previewDevice
      ? valueBadgeCandidates(this.host._planHass, previewDevice, previewLightDevices) : [];
    const badgeRecommendation = previewDevice
      ? recommendedValueBadgeSource(this.host._planHass, previewDevice, badgeCandidates) : null;
    const effectiveBadgeEnabled = d.valueBadgeTouched
      ? d.valueBadgeEnabled : !!previewPresentation?.valueBadge;
    const effectiveBadgeSource = d.valueBadgeTouched
      ? d.valueBadgeSource : previewPresentation?.valueBadge?.source || d.valueBadgeSource;
    const effectiveBadgePosition = d.valueBadgeTouched
      ? d.valueBadgePosition : previewPresentation?.valueBadge?.position || d.valueBadgePosition;
    const badgeSourceKey = valueBadgeSourceKey(effectiveBadgeSource);
    const badgeSourceMissing = !!effectiveBadgeSource
      && !badgeCandidates.some((item) => item.key === badgeSourceKey);
    const selectedBadgeCandidate = badgeCandidates.find((item) => item.key === badgeSourceKey);
    const valueSourceKey = valueBadgeSourceKey(d.valueSource);
    const valueSourceMissing = !!d.valueSource && (!valueSourceKey
      || !badgeCandidates.some((item) => item.key === valueSourceKey));
    const selectedValueSourceCandidate = badgeCandidates.find((item) => item.key === valueSourceKey);
    const innerValueSourceKey = previewPresentation?.valueSource?.sourceKey || '';
    const autoHasSpatialSource = this._markerAutoHasSpatialSource(d);
    const statefulSource = !!previewDevice
      && hasOwnStatefulLightSource(this.host._planHass, { ...previewDevice, hidden: false });
    const lightSettings = resolveDeviceLightSettings(
      d.lightRole, autoHasSpatialSource, statefulSource, d.glowMode,
    );
    const glowSourceDisabled = !lightSettings.sourceExists;
    const liveGlowDisabled = !lightSettings.fromSourceEnabled;
    const passiveSource = lightSettings.passive;
    const displayedGlowMode = lightSettings.effectiveMode;
    const glowDisabledHint = d.lightRole === 'never'
      ? t('marker.glow_disabled_never')
      : d.lightRole === 'auto' && !autoHasSpatialSource
        ? t('marker.glow_disabled_auto')
        : passiveSource ? t('marker.glow_passive_hint')
          : t('marker.glow_disabled_no_entity');
    const leadingEntities = previewDevice ? ownControllableEntities(previewDevice) : [];
    // Keep the fallback text aligned with the production resolver. In
    // particular, an entity binding or the resolved primary may precede the
    // registry order used for the remaining candidates.
    const effectiveLeading = previewDevice ? forcedLightEntityOf(previewDevice) || '' : '';
    const staleLeading = !!d.lightEntity && !leadingEntities.includes(d.lightEntity);
    const toggleEntities = previewDevice ? toggleEntityCandidates(previewDevice) : [];
    const staleToggleEntity = !!d.toggleEntity && !toggleEntities.includes(d.toggleEntity);
    const automaticToggleIntent = effectiveTapAction === 'toggle'
      ? this._toggleIntentForDialog({ ...d, toggleEntity: '', toggleEntityTouched: true })
      : null;
    const automaticToggleTarget = automaticToggleIntent
      ? [...automaticToggleIntent.targets, ...automaticToggleIntent.skippedTargets]
        .map((target) => target.entityId || ('ref' in target ? target.ref : ''))
        .filter(Boolean)
        .join(', ')
      : '';
    const curLabel = (() => {
      if (isVirtual) return null;
      const found = cands.find((c) => c.value === d.binding);
      if (found) return found.label;
      const [k, ref] = d.binding.split(':');
      if (k === 'device') return this.host._fullRegistryHass.devices[ref]?.name_by_user || this.host._fullRegistryHass.devices[ref]?.name || ref;
      return this.host._fullRegistryHass.entities[ref]?.name || this.host.hass.states[ref]?.attributes?.friendly_name || ref;
    })();
    const entityName = (eid: string) => this.host.hass.states[eid]?.attributes?.friendly_name
      || this.host._fullRegistryHass.entities[eid]?.name || eid;
    const unit = this.host._imperial ? t('gs.unit_ft') : t('gs.unit_m');
    /* К10 (Q1): в edit Save только при изменениях; в create черновик нового
     * устройства сохранять есть всегда. Прежние запреты Save (занято, идёт
     * калибровка радара, привязка не выбрана или не подтверждена реестром)
     * остаются; привязка и радиус теперь ещё и названы словами под полем. */
    const edit = !!d.devId;
    const problems = markerProblems(d);
    const problemFor = (fieldId: string) => problems.find((p) => p.field === fieldId);
    const dirty = markerDirty(this.host, d);
    const bindingUnverified = d.bindingMode === 'ha' && !d.devId && bindingStatus?.kind !== 'active';
    const canSave = !d.busy && !this._radarSetup.isActive() && problems.length === 0 && !bindingUnverified
      && (edit ? dirty : true);
    const saveTitle = problems[0] ? st(problems[0].message)
      : bindingUnverified && !!d.binding && d.binding !== 'virtual' ? t('marker.ha_registry_limited') : '';
    const requestClose = async (event: Event) => {
      if (!edit || !dirty) { forgetMarkerBaseline(this.host); this._closeMarkerDialog(); return; }
      const dialog = event.currentTarget as { rejectClose?: () => void } | null;
      const discard = await this.host._confirmDanger({
        key: 'discard-marker-dialog', kind: 'warning',
        title: st('dialog.discard_title'), message: st('dialog.discard_message'),
        objectName: d.name.trim() || previewDevice?.name || undefined,
        confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
      });
      if (discard) { forgetMarkerBaseline(this.host); this._closeMarkerDialog(); } else dialog?.rejectClose?.();
    };
    const reviewFirst = () => {
      const first = problems[0];
      if (!first) return;
      const node = (this.host.renderRoot as ParentNode).querySelector<HTMLElement>(`#${first.field}`);
      node?.scrollIntoView({ block: 'center' });
      node?.focus();
    };
    const bindingProblem = problemFor('marker-binding');

    // ------------------------------------------------------------ Basics
    const bindingBanner = bindingStatus?.kind === 'ha_disabled'
      ? callout({
          kind: 'warning', role: 'status', icon: 'mdi:power-plug-off-outline',
          text: t(`marker.ha_disabled_${bindingStatus.reason}` as I18nKey),
          action: canOpenBindingInHa
            ? textLink(t('btn.open_in_ha'), () => this.host._openBindingInHa(d.binding))
            : undefined,
        })
      : bindingStatus?.kind === 'unverified' && !!d.binding
        ? callout({ kind: 'warning', role: 'status', icon: 'mdi:shield-alert-outline', text: t('marker.ha_registry_limited') })
        : nothing;
    const bindingPicker = d.bindingMode === 'ha'
      ? sourcePicker({
          id: 'marker-binding',
          open: d.bindingOpen,
          current: curLabel
            ? { label: curLabel, sub: `${d.binding}${bindingStatus?.kind === 'ha_disabled' ? ` · ${t('marker.binding_disabled')}` : ''}` }
            : null,
          placeholder: t('marker.pick_ph'),
          ariaLabel: t('marker.binding_label'),
          filter: d.bindingFilter,
          filterPlaceholder: t('marker.search_ph'),
          candidates: cands,
          selected: d.binding,
          emptyText: t('marker.nothing_found'),
          onToggle: () => (this.host._markerDialog = { ...d, bindingOpen: !d.bindingOpen }),
          onFilter: (v) => (this.host._markerDialog = { ...d, bindingFilter: v }),
          onPick: (value) => {
            // #385(а): same-binding click is a no-op —
            // only an actual change resets value source
            // and badge (spec #378 §1.6).
            if (value === d.binding) {
              this.host._markerDialog = { ...d, bindingOpen: false };
              return;
            }
            const next = {
              ...d, binding: value, bindingOpen: false,
              controls: persistedExternalControls(
                value, d.controls, this.host._bindingEntities(value),
              ),
              autoIcon: this.host._autoIconForBinding(value),
              ...radarAfterBindingChange(d.radar, d.radarTouched, d.radarRemove),
            };
            this.host._markerDialog = this._announceToggleDraft({
              ...next, ...this._valueBadgeForBinding(next, value),
              valueSource: null, valueSourceTouched: true,
            });
          },
          // Q8: «Show entities» — внутри панели выбора, рядом с поиском.
          toolbar: html`<label class="hpf-check" title=${t('marker.show_entities_tip')}>
            <input id="marker-show-entities" type="checkbox" .checked=${d.showEntities}
              @change=${(e: Event) => (this.host._markerDialog = { ...d, showEntities: (e.target as HTMLInputElement).checked })} />
            <span>${t('marker.show_entities')}</span>
          </label>`,
        })
      : nothing;
    const basics = formCard({
      id: 'basics',
      title: t('marker.card_basics'),
      body: html`
        ${bindingBanner}
        ${field({
          label: t('marker.name_label'), htmlFor: 'marker-name',
          control: html`<input id="marker-name" class="hpf-input" type="text" placeholder=${t('marker.name_ph')}
            .value=${d.name}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, name: (e.target as HTMLInputElement).value })} />`,
        })}
        ${field({
          label: t('marker.binding_label'), help: shelp('marker.binding.help'),
          error: bindingProblem ? st(bindingProblem.message) : undefined,
          hint: isVirtual ? st('marker.binding_virtual_hint') : undefined,
          control: html`${segmented<'virtual' | 'ha'>({
            name: 'bmode',
            value: d.bindingMode,
            ariaLabel: t('marker.binding_label'),
            options: [
              { value: 'virtual', label: t('marker.virtual_option') },
              { value: 'ha', label: t('marker.from_ha_option') },
            ],
            onChange: (mode) => {
              if (mode === 'virtual') {
                // #385(а) r2-M1: no same-binding guard here on purpose — a
                // radio input fires no change event when it is already
                // checked, so this branch runs only on an actual switch to
                // virtual; the reset below is therefore always legitimate.
                const next = {
                  ...d, bindingMode: 'virtual' as const, binding: 'virtual', bindingOpen: false,
                  controls: persistedExternalControls('virtual', d.controls),
                  autoIcon: this.host._autoIconForBinding('virtual'),
                  ...radarAfterBindingChange(d.radar, d.radarTouched, d.radarRemove),
                };
                this.host._markerDialog = this._announceToggleDraft({
                  ...next, ...this._valueBadgeForBinding(next, 'virtual'),
                  valueSource: null, valueSourceTouched: true,
                });
                return;
              }
              this.host._markerDialog = this._announceToggleDraft({
                ...d, bindingMode: 'ha',
                binding: d.binding === 'virtual' ? '' : d.binding,
                bindingOpen: d.binding === 'virtual' || !d.binding,
              });
            },
          })}${bindingPicker}`,
        })}
        ${field({
          label: t('marker.room_label'), htmlFor: 'marker-room',
          hint: d.room ? st('marker.room_hint_override') : isVirtual ? undefined : st('marker.room_hint_auto'),
          control: html`<select id="marker-room" class="hpf-select"
            @change=${(e: Event) => {
              const room = (e.target as HTMLSelectElement).value;
              const ref = parseRoomRef(room);
              this.host._markerDialog = {
                ...d, room, roomTouched: true,
                radar: d.radar && ref?.space === (previewDevice?.space || '') && ref.roomId
                  ? { ...d.radar, roomId: ref.roomId } : d.radar,
                radarTouched: d.radar && ref?.roomId ? true : d.radarTouched,
              };
            }}>
            <option value="" ?selected=${!d.room}>
              ${isVirtual ? t('marker.room_choose') : t('marker.room_auto')}
            </option>
            ${this.host._allRoomsFlat().map(
              (r) => html`<option value=${r.value} ?selected=${r.value === d.room}>${r.label}</option>`,
            )}
          </select>`,
        })}
        ${this._renderVacSection(d)}`,
    });

    // --------------------------------------------------------- Tap action
    const toggleEntityField = effectiveTapAction === 'toggle' && (toggleEntities.length > 1 || staleToggleEntity)
      ? html`<div class="markertoggleentity">${field({
          label: t('marker.toggle_entity_label'), htmlFor: 'marker-toggle-entity', help: this._help('marker.toggle_entity.help'),
          control: html`<select id="marker-toggle-entity" class="hpf-select"
            @change=${(e: Event) => {
              const next = {
                ...d,
                toggleEntity: (e.target as HTMLSelectElement).value,
                toggleEntityTouched: true,
              };
              this.host._markerDialog = this._announceToggleDraft(next);
            }}>
            <option value="" ?selected=${staleToggleEntity || !d.toggleEntity}>
              ${t('marker.toggle_entity_auto', {
                entity: automaticToggleTarget || t('marker.toggle_entity_none'),
              })}
            </option>
            ${toggleEntities.map((eid) => html`<option value=${eid}
              ?selected=${!staleToggleEntity && eid === d.toggleEntity}>
              ${entityName(eid)} · ${eid}
            </option>`)}
          </select>`,
          hint: staleToggleEntity
            ? note(t('marker.toggle_entity_missing', {
                entity: d.toggleEntity,
                fallback: automaticToggleTarget || t('marker.toggle_entity_none'),
              }), 'warning')
            : undefined,
        })}</div>`
      : nothing;
    const runTargetField = effectiveTapAction === 'run'
      ? (() => {
          const q = d.runFilter.trim().toLowerCase();
          const runCands = this._runCandidates().filter(
            (c) => !q || c.label.toLowerCase().includes(q) || c.value.includes(q),
          );
          const cur = d.tapTarget ? this._runCandidates().find((c) => c.value === d.tapTarget) : null;
          return field({
            label: t('marker.run_target_label'), htmlFor: 'marker-run-target',
            control: html`
              ${d.tapTarget && !cur
                ? callout({ kind: 'warning', role: 'status', text: t('marker.run_target_gone', { id: d.tapTarget }) })
                : nothing}
              <input id="marker-run-target" class="hpf-input" type="text" placeholder=${t('marker.run_search_ph')}
                .value=${cur ? cur.label : d.runFilter}
                @focus=${(e: Event) => { (e.target as HTMLInputElement).select(); }}
                @input=${(e: Event) => (this.host._markerDialog = { ...d, runFilter: (e.target as HTMLInputElement).value, tapTarget: '' })} />
              ${!cur
                ? html`<div class="hpf-panel"><div class="hpf-list" role="listbox" aria-label=${t('marker.run_target_label')}>
                    ${runCands.slice(0, 40).map(
                      (c) => html`<button type="button" role="option" class="hpf-cand ${c.value === d.tapTarget ? 'sel' : ''}"
                        aria-selected=${c.value === d.tapTarget ? 'true' : 'false'}
                        @click=${() => (this.host._markerDialog = { ...d, tapTarget: c.value, runFilter: '' })}>
                        <span>${c.label}</span><small>${c.sub}</small>
                      </button>`,
                    )}
                    ${!runCands.length ? html`<p class="hpf-hint">${t('marker.nothing_found')}</p>` : nothing}
                  </div></div>`
                : nothing}`,
          });
        })()
      : nothing;
    const controlCands = d.controlsFilter.trim() ? this._controlCandidates(d) : [];
    const tap = formCard({
      id: 'tap',
      body: html`
        ${field({
          label: t('marker.tap_label'), htmlFor: 'marker-tap-action',
          control: html`<select id="marker-tap-action" class="hpf-select"
            aria-describedby=${effectiveTapAction === 'toggle' ? 'marker-toggle-hint' : nothing}
            @change=${(e: Event) => {
              const next = {
                ...d,
                tapAction: (e.target as HTMLSelectElement).value,
                tapActionTouched: true,
              };
              this.host._markerDialog = this._announceToggleDraft(next);
            }}>
            ${TAP_ACTIONS.map((v) => html`<option value=${v} ?selected=${v === effectiveTapAction}>
                ${t(`tap.${v.replace('-', '_')}` as I18nKey)}
              </option>`)}
          </select>`,
          hint: effectiveTapAction === 'toggle'
            ? html`<span id="marker-toggle-hint">${toggleHintLines.map((line) => html`<span class="hpf-hint-line">${line}</span>`)}</span>
              <span class="sr-only" role="status" aria-live="polite">${d.tapHintAnnouncement}</span>`
            : undefined,
        })}
        ${toggleEntityField}
        ${runTargetField}
        ${effectiveTapAction === 'run' || effectiveTapAction === 'toggle'
          ? toggleRow({
              id: 'marker-tap-confirm', icon: 'mdi:check-decagram-outline',
              title: t('marker.tap_confirm'), caption: t('marker.tap_confirm_tip'),
              checked: d.tapConfirm,
              onChange: (v) => (this.host._markerDialog = { ...d, tapConfirm: v }),
            })
          : nothing}
        ${field({
          label: t('marker.controls_label'), htmlFor: 'marker-controls-filter', help: this._help('marker.controls.help'),
          control: html`
            ${d.controls.length
              ? html`<div class="hpf-chips">
                  ${d.controls.map((eid) => {
                    const info = this._controlRefInfo(eid);
                    return html`<span class="hpf-chip ${info.warning ? 'hpf-chip-warning' : ''}" title=${info.sub}>
                      <ha-icon icon=${info.icon} aria-hidden="true"></ha-icon><span>${info.label}</span>
                      <button type="button" aria-label=${`${t('btn.delete')}: ${info.label}`} title=${t('btn.delete')}
                        @click=${() => (this.host._markerDialog = this._announceToggleDraft({
                          ...d, controls: d.controls.filter((x) => x !== eid),
                        }))}><ha-icon icon="mdi:close"></ha-icon></button>
                    </span>`;
                  })}
                </div>`
              : nothing}
            <div class="hpf-picker ${controlCands.length || d.controlsFilter.trim() ? 'open' : ''}">
              <input id="marker-controls-filter" class="hpf-input" type="text" autocomplete="off" placeholder=${t('marker.controls_filter')}
                .value=${d.controlsFilter}
                @input=${(e: Event) => (this.host._markerDialog = { ...d, controlsFilter: (e.target as HTMLInputElement).value })} />
              ${d.controlsFilter.trim()
                ? html`<div class="hpf-panel"><div class="hpf-list" role="listbox" aria-label=${t('marker.controls_label')}>
                    ${controlCands.map((candidate) => html`<button type="button" role="option" class="hpf-cand" aria-selected="false"
                        @click=${() => this._addControlRef(d, candidate.value)}>
                        <span><ha-icon icon=${candidate.icon} aria-hidden="true"></ha-icon> ${candidate.label}</span>
                        <small>${candidate.sub}</small>
                      </button>`)}
                    ${!controlCands.length ? html`<p class="hpf-hint">${t('marker.nothing_found')}</p>` : nothing}
                  </div></div>`
                : nothing}
            </div>`,
        })}`,
    });

    // ----------------------------------------------------- Light and glow
    const glowValue = displayedGlowMode !== 'auto'
      ? html`<div class="markerglowvalue">${field({
          label: t('marker.glow_color'),
          control: colorField({
            hex: d.glowColor, disabled: glowSourceDisabled,
            picker: html`<hp-color-opacity .label=${t('marker.glow_color')} hide-label
              .color=${d.glowColor} .opacity=${1} .showOpacity=${false}
              .pickerLabels=${this.host._colorPickerLabels}
              .disabled=${glowSourceDisabled}
              @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                this.host._markerDialog = {
                  ...d, glowMode: displayedGlowMode,
                  glowColor: e.detail.color, glowColorDrafted: true, glowTouched: true,
                };
              }}></hp-color-opacity>`,
          }),
        })}
        ${displayedGlowMode === 'fixed'
          ? html`<div class="hpf-field">
              <span class="hpf-label hpf-labelrow"><label for="marker-glow-brightness">${t('marker.glow_brightness')}</label></span>
              ${rangeLine({
                id: 'marker-glow-brightness', min: 1, max: 100, step: 1, value: Math.round(d.glowBrightness), unit: '%',
                ariaLabel: t('marker.glow_brightness'), disabled: glowSourceDisabled,
                slider: this._rangeInput(1, 100, 1, d.glowBrightness, (n) => {
                  this.host._markerDialog = {
                    ...d, glowMode: displayedGlowMode,
                    glowBrightness: n, glowBrightnessDrafted: true, glowTouched: true,
                  };
                }, glowSourceDisabled, t('marker.glow_brightness')),
                onInput: (n) => {
                  this.host._markerDialog = {
                    ...d, glowMode: displayedGlowMode,
                    glowBrightness: n, glowBrightnessDrafted: true, glowTouched: true,
                  };
                },
              })}
            </div>`
          : nothing}</div>`
      : nothing;
    const light = formCard({
      id: 'light',
      title: t('marker.card_light'),
      body: html`
        ${field({
          label: t('marker.light_role_label'), help: this._help('marker.light_role.help'),
          control: segmented<'auto' | 'always' | 'never'>({
            name: 'marker-light-role',
            value: d.lightRole,
            ariaLabel: t('marker.light_role_label'),
            options: [
              { value: 'auto', label: st('marker.light_role_seg_auto') },
              { value: 'always', label: st('marker.light_role_seg_always') },
              { value: 'never', label: st('marker.light_role_seg_never') },
            ],
            onChange: (role) => this._setMarkerLightRole(role),
          }),
          hint: d.lightRole === 'auto' ? t(autoHasSpatialSource ? 'marker.light_role_auto_yes' : 'marker.light_role_auto_no') : undefined,
        })}
        ${d.lightRole === 'always' && (leadingEntities.length > 1 || staleLeading)
          ? html`<div class="markerleadingentity">${field({
              label: t('marker.light_entity_label'), htmlFor: 'marker-light-entity', help: this._help('marker.light_entity.help'),
              control: html`<select id="marker-light-entity" class="hpf-select"
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  lightEntity: (e.target as HTMLSelectElement).value,
                  lightEntityTouched: true,
                })}>
                <option value="" ?selected=${staleLeading || !d.lightEntity}>
                  ${t('marker.light_entity_auto', {
                    entity: effectiveLeading || t('marker.light_entity_none'),
                  })}
                </option>
                ${leadingEntities.map((eid) => html`<option value=${eid}
                  ?selected=${!staleLeading && eid === d.lightEntity}>
                  ${entityName(eid)} · ${eid}
                </option>`)}
              </select>`,
              hint: staleLeading
                ? note(t('marker.light_entity_missing', { entity: d.lightEntity, fallback: effectiveLeading || '—' }), 'warning')
                : undefined,
            })}</div>`
          : nothing}
        <div class="hpf-block markerglowblock ${glowSourceDisabled ? 'hpf-disabled' : ''}" aria-disabled=${glowSourceDisabled ? 'true' : 'false'}>
          ${subsection({ title: t('marker.glow_color_label'), help: this._help('marker.glow_mode.help') })}
          ${segmented<'auto' | 'color' | 'fixed'>({
            name: 'marker-glow-mode',
            value: displayedGlowMode,
            ariaLabel: t('marker.glow_color_label'),
            options: [
              { value: 'auto', label: t('marker.glow_mode_auto'), disabled: liveGlowDisabled,
                describedBy: liveGlowDisabled ? 'marker-glow-disabled-hint' : undefined },
              { value: 'color', label: t('marker.glow_mode_color'), disabled: glowSourceDisabled,
                describedBy: glowSourceDisabled ? 'marker-glow-disabled-hint' : undefined },
              { value: 'fixed', label: t('marker.glow_mode_fixed'), disabled: glowSourceDisabled,
                describedBy: glowSourceDisabled ? 'marker-glow-disabled-hint' : undefined },
            ],
            onChange: (mode) => this._setMarkerGlowMode(mode),
          })}
          ${glowValue}
          ${field({
            label: t('marker.glow_radius_label'), htmlFor: 'marker-glow-radius', help: this._help('marker.glow_radius.help'),
            hint: d.glowRadius.trim() ? undefined : st('marker.glow_radius_empty_hint', { v: `${this.host._glowRadiusPlaceholder} ${unit}` }),
            control: unitInput({
              id: 'marker-glow-radius', unit, min: 0.5, step: 0.5, value: d.glowRadius,
              placeholder: this.host._glowRadiusPlaceholder, ariaLabel: t('marker.glow_radius_label'),
              disabled: glowSourceDisabled,
              describedBy: glowSourceDisabled || passiveSource ? 'marker-glow-disabled-hint' : undefined,
              onInput: (raw) => (this.host._markerDialog = { ...d, glowRadius: raw }),
            }),
          })}
          ${glowSourceDisabled || passiveSource
            ? callout({ id: 'marker-glow-disabled-hint', kind: 'info', role: 'note', icon: 'mdi:information-outline', text: glowDisabledHint })
            : nothing}
        </div>`,
    });

    // --------------------------------------------------------- Appearance
    const iconControl = customElements.get('ha-icon-picker')
      // Feed the effective icon to HA's picker so its field renders both
      // the glyph and the mdi:* label. autoIcon is presentation-only:
      // untouched dialogs still save d.icon as an empty auto override.
      ? html`<ha-icon-picker id="marker-icon" .hass=${this.host.hass} .value=${d.icon || d.autoIcon}
          .placeholder=${d.autoIcon || undefined}
          .fallbackPath=${undefined}
          @value-changed=${(e: CustomEvent<{ value?: string }>) => {
            const icon = e.detail.value || '';
            // Some picker versions announce an assigned value. Do not
            // let that turn the display-only auto icon into an override.
            if (!d.icon && icon === d.autoIcon) return;
            this.host._markerDialog = { ...d, icon };
          }}></ha-icon-picker>`
      : html`<input id="marker-icon" class="hpf-input" type="text"
          placeholder=${d.autoIcon || t('marker.icon_ph')}
          .value=${d.icon}
          @input=${(e: Event) => (this.host._markerDialog = { ...d, icon: (e.target as HTMLInputElement).value })} />`;
    const badgeToggleDisabled = displayIsNeutral(d.display) || (!badgeCandidates.length && !d.valueBadgeSource);
    const appearance = formCard({
      id: 'appearance',
      title: t('marker.card_appearance'),
      body: html`
        ${field({
          label: t('marker.icon_label'), htmlFor: 'marker-icon', help: shelp('marker.icon.help'),
          control: html`<div class="hpf-iconfield">
            <span class="hpf-iconpreview" aria-hidden="true"><ha-icon icon=${d.icon || d.autoIcon || 'mdi:shape-outline'}></ha-icon></span>
            ${iconControl}
            ${d.icon
              ? html`<button class="btn ghost hpf-iconclear" type="button" aria-label=${t('btn.reset')} title=${t('btn.reset')}
                  @click=${() => (this.host._markerDialog = { ...d, icon: '' })}><ha-icon icon="mdi:close"></ha-icon></button>`
              : nothing}
          </div>`,
          hint: !d.icon && d.autoIcon
            ? html`<span class="iconauto"><ha-icon icon=${d.autoIcon} aria-hidden="true"></ha-icon> ${t('marker.icon_auto', { icon: d.autoIcon })}
                ${textLink(t('marker.icon_pin_auto'), () => (this.host._markerDialog = { ...d, icon: d.autoIcon }))}</span>`
            : d.icon ? st('marker.icon_custom_hint') : undefined,
        })}
        ${field({
          label: t('marker.display_label'), htmlFor: 'marker-display', help: shelp('marker.display.help'),
          control: html`<select id="marker-display" class="hpf-select"
            @change=${(e: Event) => (this.host._markerDialog = {
              ...d,
              display: normalizeDeviceDisplay((e.target as HTMLSelectElement).value),
            })}>
            ${DISPLAY_MODES.map((v) => html`<option value=${v} ?selected=${v === d.display}>
              ${t(DISPLAY_LABEL_KEYS[v])}
            </option>`)}
          </select>`,
          hint: t(DISPLAY_HINT_KEYS[d.display]),
        })}
        ${d.display === 'icon_ripple'
          ? html`${field({
              label: t('marker.activity_color'),
              control: html`<div class="ripple-colorrow">${colorField({
                hex: d.rippleColor || '#3ea6ff',
                picker: html`<hp-color-opacity .label=${t('marker.activity_color')} hide-label
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${d.rippleColor || '#3ea6ff'} .opacity=${1} .showOpacity=${false}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                    this.host._markerDialog = { ...d, rippleColor: e.detail.color };
                  }}></hp-color-opacity>`,
              })}</div>`,
            })}
            <div class="hpf-field ripple-sizerow">
              <span class="hpf-label hpf-labelrow"><label for="marker-ripple-size">${t('marker.ripple_size')}</label></span>
              ${rangeLine({
                id: 'marker-ripple-size', min: 1, max: 8, step: 0.5, value: d.rippleSize, unit: '×', ariaLabel: t('marker.ripple_size'),
                slider: this._rangeInput(1, 8, 0.5, d.rippleSize, (n) => (this.host._markerDialog = { ...d, rippleSize: n }), false, t('marker.ripple_size')),
                onInput: (n) => (this.host._markerDialog = { ...d, rippleSize: n }),
              })}
              <p class="hpf-hint" role="note">${t('marker.activity_alarm_note')}</p>
            </div>`
          : nothing}
        ${displayWantsValue(d.display)
          ? html`<div class="markervaluesource">${field({
              label: t('marker.value_source'), htmlFor: 'marker-value-source', help: this._help('marker.value_source.help'),
              control: html`<select id="marker-value-source" class="hpf-select" ?disabled=${isVirtual}
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  valueSource: valueBadgeSourceFromKey((e.target as HTMLSelectElement).value),
                  valueSourceTouched: true,
                })}>
                <option value="" ?selected=${!d.valueSource}>
                  ${t('marker.value_source_auto')}
                </option>
                ${valueSourceMissing ? html`<option value=${valueSourceKey || '__missing__'} selected>
                  ${t('marker.value_badge_missing')}
                </option>` : nothing}
                ${badgeCandidates.map((candidate) => html`<option value=${candidate.key}
                  ?selected=${candidate.key === valueSourceKey}
                  title=${candidate.technical}>
                  ${this._valueBadgeCandidateLabel(candidate)} · ${candidate.value}
                </option>`)}
              </select>`,
              hint: isVirtual
                ? note(t('marker.preview.reason.value_virtual'), 'info')
                : valueSourceMissing
                  ? note(t('marker.value_source_missing_hint'), 'warning')
                  : selectedValueSourceCandidate
                    ? html`<code class="hpf-mono">${selectedValueSourceCandidate.technical}</code>`
                    : undefined,
            })}</div>`
          : nothing}
        ${displayIsNeutral(d.display) && this.host._bindingHasAlarm(d.binding)
          ? callout({ kind: 'warning', role: 'note', icon: 'mdi:alert-outline', text: t('marker.static_alarm_warning') })
          : nothing}
        <div class="hpf-block markerbadgegroup">
          ${subsection({ title: t('marker.value_badge_title'), help: this._help('marker.value_badge.help') })}
          ${toggleRow({
            id: 'marker-value-badge', compact: true, icon: displayIsNeutral(d.display) ? 'mdi:eye-off-outline' : 'mdi:card-text-outline',
            title: t('marker.value_badge_enabled'),
            checked: effectiveBadgeEnabled, disabled: badgeToggleDisabled,
            onChange: (enabled) => {
              const source = effectiveBadgeSource || badgeRecommendation;
              this.host._markerDialog = {
                ...d,
                valueBadgeEnabled: enabled && !!source,
                valueBadgeSource: source,
                valueBadgeTouched: true,
              };
            },
          })}
          ${displayIsNeutral(d.display)
            ? callout({ kind: 'info', role: 'note', icon: 'mdi:information-outline', text: t('marker.value_badge_static') })
            : !badgeCandidates.length && !d.valueBadgeSource
              ? callout({ kind: 'info', role: 'note', icon: 'mdi:information-outline', text: t('marker.value_badge_empty') })
              : nothing}
          ${effectiveBadgeEnabled ? html`
            ${field({
              label: t('marker.value_badge_source'), htmlFor: 'marker-value-badge-source', help: this._help('marker.value_badge_source.help'),
              control: html`<select id="marker-value-badge-source" class="hpf-select"
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  valueBadgeSource: valueBadgeSourceFromKey((e.target as HTMLSelectElement).value),
                  valueBadgeEnabled: true,
                  valueBadgeTouched: true,
                })}>
                ${badgeSourceMissing ? html`<option value=${badgeSourceKey} selected>
                  ${t('marker.value_badge_missing')}
                </option>` : nothing}
                ${badgeCandidates.map((candidate) => html`<option value=${candidate.key}
                  ?selected=${candidate.key === badgeSourceKey}
                  title=${candidate.technical}>
                  ${this._valueBadgeCandidateLabel(candidate)} · ${candidate.value}
                </option>`)}
              </select>`,
              hint: badgeSourceMissing
                ? note(t('marker.value_badge_missing_hint'), 'warning')
                : displayWantsValue(d.display) && badgeSourceKey === innerValueSourceKey
                  ? note(t('marker.value_badge_duplicate'), 'info')
                  : selectedBadgeCandidate
                    ? html`<code class="hpf-mono">${selectedBadgeCandidate.technical}</code>`
                    : undefined,
            })}
            ${field({
              label: t('marker.value_badge_position'), help: this._help('marker.value_badge_position.help'),
              control: segmented<ValueBadgePosition>({
                name: 'marker-value-badge-position',
                value: effectiveBadgePosition,
                ariaLabel: t('marker.value_badge_position'),
                options: BADGE_POSITIONS.map((position) => ({ value: position, label: t(`marker.value_badge_${position}` as I18nKey) })),
                onChange: (position) => (this.host._markerDialog = {
                  ...d,
                  valueBadgeEnabled: effectiveBadgeEnabled,
                  valueBadgeSource: effectiveBadgeSource,
                  valueBadgePosition: position,
                  valueBadgeTouched: true,
                }),
              }),
            })}
          ` : nothing}
        </div>
        ${previewPresentation
          // Q3 (решение владельца): hp-device-preview целиком — у него свой
          // заголовок «Display preview · Now» и свой блок на тинте, обёртка не нужна.
          ? html`<hp-device-preview
              .hass=${this.host.hass}
              .presentation=${previewPresentation}
              .registry=${this.host._haRegistry}
              .deviceName=${d.name.trim() || previewDevice?.name || curLabel || ''}>
            </hp-device-preview>`
          : tintBlock({
              title: t('marker.preview.title'),
              body: html`<div class="devicepreview-empty">
                <ha-icon icon="mdi:eye-outline"></ha-icon>
                <span>${t('marker.preview.select_source')}</span>
              </div>`,
            })}
        ${subsection({ title: t('marker.size_label'), help: shelp('marker.size.help') })}
        ${fieldGrid([
          html`<div class="hpf-field markersize">
            <span class="hpf-label hpf-labelrow"><label for="marker-size">${st('marker.size_short')}</label></span>
            ${rangeLine({
              id: 'marker-size', min: 0.5, max: 3, step: 0.1, value: Number(d.size.toFixed(1)), unit: '×', ariaLabel: st('marker.size_short'),
              slider: this._rangeInput(0.5, 3, 0.1, d.size, (n) => (this.host._markerDialog = { ...d, size: n }), false, st('marker.size_short')),
              onInput: (n) => (this.host._markerDialog = { ...d, size: n }),
            })}
            ${rangeEnds('×0.5', '×3')}
          </div>`,
          html`<div class="hpf-field markerangle">
            <span class="hpf-label hpf-labelrow"><label for="marker-angle">${t('marker.angle_label')}</label></span>
            ${''/* 5 degrees, not 10 (owner 2026-08-03): a marker often has to
                   line up with a wall that is not on a 10-degree grid. */}
            ${rangeLine({
              id: 'marker-angle', min: 0, max: 355, step: 5, value: d.angle, unit: '°', ariaLabel: t('marker.angle_label'),
              slider: this._rangeInput(0, 355, 5, d.angle, (n) => (this.host._markerDialog = { ...d, angle: n }), false, t('marker.angle_label')),
              onInput: (n) => (this.host._markerDialog = { ...d, angle: n }),
            })}
            ${rangeEnds('0°', '355°')}
          </div>`,
        ])}`,
    });

    // ------------------------------------------------------------ Details
    const details = formCard({
      id: 'details',
      title: t('marker.card_details'),
      body: html`
        ${fieldGrid([
          field({
            label: t('marker.model_label'), htmlFor: 'marker-model',
            control: html`<input id="marker-model" class="hpf-input" type="text" placeholder=${t('marker.model_ph')}
              .value=${d.model}
              @input=${(e: Event) => (this.host._markerDialog = { ...d, model: (e.target as HTMLInputElement).value })} />`,
          }),
          field({
            label: t('marker.link_label'), htmlFor: 'marker-link',
            control: html`<input id="marker-link" class="hpf-input" type="url" placeholder="https://…"
              .value=${d.link}
              @input=${(e: Event) => (this.host._markerDialog = { ...d, link: (e.target as HTMLInputElement).value })} />`,
          }),
        ])}
        ${field({
          label: t('marker.desc_label'), htmlFor: 'marker-description',
          control: html`<textarea id="marker-description" class="hpf-input" rows="4" placeholder=${t('marker.desc_ph')}
            .value=${d.description}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, description: (e.target as HTMLTextAreaElement).value })}></textarea>`,
        })}
        ${field({
          label: t('marker.manuals_label'),
          control: html`
            ${d.pdfs.length
              ? html`<div class="hpf-chips">
                  ${d.pdfs.map((p) => html`<span class="hpf-chip"><ha-icon icon="mdi:file-pdf-box" aria-hidden="true"></ha-icon>
                    <a href="${safeUrl(this.host._display(p.url)) || '#'}" target="_blank" rel="noreferrer noopener">${p.name}</a>
                    <button type="button" aria-label=${`${t('btn.delete')}: ${p.name}`} title=${t('btn.delete')}
                      @click=${() => this._removeMarkerPdf(p.url)}><ha-icon icon="mdi:close"></ha-icon></button></span>`)}
                </div>`
              : nothing}
            <div class="hpf-actions">
              <button class="btn ghost filebtn" type="button" @click=${(e: Event) =>
                ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                <ha-icon icon="mdi:paperclip"></ha-icon>${t('btn.attach')}
              </button>
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${(e: Event) => this._pickMarkerFiles(e)} />
            </div>`,
        })}
        ${!isVirtual ? subsection({ title: t('radar.additional_actions') }) : nothing}
        ${this._renderRadarSection(d, previewDevice, 'additional')}
        ${this.host._bindingHasClimate(d.binding)
          ? toggleRow({
              id: 'marker-use-climate-temp', icon: 'mdi:thermometer',
              title: t('marker.use_climate_temp'), caption: t('marker.use_climate_temp_tip'),
              checked: d.useClimateTemp,
              onChange: (v) => (this.host._markerDialog = { ...d, useClimateTemp: v }),
            })
          : nothing}`,
    });

    const hidden = d.hideFromPlan || bindingStatus?.kind === 'ha_disabled';
    return html`<hp-dialog id="marker-dialog" .hass=${this.host.hass} data-kind="marker" form-shell
      .title=${d.devId ? t('info.device_header') : t('marker.new_device')}
      .badge=${previewDevice ? this.host._spaceModelById(previewDevice.space)?.title ?? '' : this.host._spaceModel()?.title ?? ''}
      icon="mdi:shape-plus" wide @hp-close=${requestClose}>
        <div class="body hpf-form">
          ${basics}${tap}${light}${appearance}${details}
        </div>
        <div class="row dialog-action-footer hpf-footer" slot="footer">
          <div class="dialog-action-group markeractions">
            ${d.devId
              ? html`<button class="btn ghost" type="button"
                  ?disabled=${d.busy || this._radarSetup.isActive()}
                  aria-pressed=${hidden ? 'true' : 'false'}
                  title=${t(hidden ? 'marker.show_tip' : 'marker.hide_tip')}
                  @click=${this.host._toggleMarkerDialogVisibility}>
                  <ha-icon icon=${hidden ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}></ha-icon>
                  ${t(hidden ? 'marker.show' : 'marker.hide')}
                </button>`
              : nothing}
            ${d.devId
              ? html`<button class="btn ghost danger" type="button" ?disabled=${d.busy || this._radarSetup.isActive()}
                  title=${t('marker.delete_tip')} @click=${() => this._deleteMarker()}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${t('btn.delete')}
                </button>`
              : nothing}
          </div>
          ${footerStatus(problems.length
            ? { action: textLink(st('dialog.review_fields', { n: String(problems.length) }), reviewFirst) }
            : {})}
          <div class="dialog-action-group dialog-action-commit">
            <button class="btn ghost" data-hp="dialog-cancel" ?disabled=${d.busy} @click=${requestClose}>${t('btn.cancel')}</button>
            <button class="btn on" data-hp="dialog-confirm" @click=${() => { forgetMarkerBaseline(this.host); void this._saveMarker(); }}
              ?disabled=${!canSave} title=${saveTitle}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }
