/**
 * Диалог «Устройство на плане» (#592: вынесен из houseplan-editor-runtime.ts как есть).
 *
 * Тело перенесено побайтово: тип `this` объявлен параметром, поэтому ни одна
 * строка разметки, ни один обработчик и ни один якорь мутанта не переписаны.
 * Состояние остаётся на хосте — модуль только рисует (#592, К2).
 */
import { html, nothing, type TemplateResult } from 'lit';

import { ensureFormKitStyles, formCard } from './form-kit';

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


export function renderMarkerDialog(this: HouseplanEditorRuntime): TemplateResult {
  ensureFormKitStyles(this.host);
    const d = this.host._markerDialog!;
    const isVirtual = d.bindingMode === 'virtual';
    const cands = this._bindingCandidates();
    const ownEntities = this.host._bindingEntities(d.binding);
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
      ? this.host._t('marker.glow_disabled_never')
      : d.lightRole === 'auto' && !autoHasSpatialSource
        ? this.host._t('marker.glow_disabled_auto')
        : passiveSource ? this.host._t('marker.glow_passive_hint')
          : this.host._t('marker.glow_disabled_no_entity');
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
    return html`<hp-dialog id="marker-dialog" .hass=${this.host.hass} data-kind="marker" form-shell
      .title=${d.devId ? this.host._t('info.device_header') : this.host._t('marker.new_device')}
      icon="mdi:shape-plus" wide @hp-close=${() => this._closeMarkerDialog()}>
        <div class="body hpf-form">
          ${formCard({
            title: this.host._t('marker.card_basics'),
            body: html`
          ${bindingStatus?.kind === 'ha_disabled'
            ? html`<div class="habindingbanner" role="status">
                <ha-icon icon="mdi:power-plug-off-outline"></ha-icon>
                <span>${this.host._t(`marker.ha_disabled_${bindingStatus.reason}` as I18nKey)}</span>
                ${canOpenBindingInHa
                  ? html`<button class="btn ghost" type="button" @click=${() => this.host._openBindingInHa(d.binding)}>
                      <ha-icon icon="mdi:open-in-new"></ha-icon>${this.host._t('btn.open_in_ha')}
                    </button>`
                  : nothing}
              </div>`
            : bindingStatus?.kind === 'unverified' && !!d.binding
              ? html`<div class="habindingbanner limited" role="status">
                  <ha-icon icon="mdi:shield-alert-outline"></ha-icon>
                  <span>${this.host._t('marker.ha_registry_limited')}</span>
                </div>`
              : nothing}
          <label>${this.host._t('marker.name_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('marker.name_ph')}
            .value=${d.name}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, name: (e.target as HTMLInputElement).value })} />

          <label>${this.host._t('marker.binding_label')}</label>
          <div class="bindsel">
            <label class="srcrow">
              <input type="radio" name="bmode" .checked=${d.bindingMode === 'virtual'}
                @change=${() => {
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
                }} />
              <span>${this.host._t('marker.virtual_option')}</span>
            </label>
            <div class="bindharow">
              <label class="srcrow">
                <input type="radio" name="bmode" .checked=${d.bindingMode === 'ha'}
                  @change=${() => (this.host._markerDialog = this._announceToggleDraft({
                    ...d, bindingMode: 'ha',
                    binding: d.binding === 'virtual' ? '' : d.binding,
                    bindingOpen: d.binding === 'virtual' || !d.binding,
                  }))} />
                <span>${this.host._t('marker.from_ha_option')}</span>
              </label>
              <label class="srcrow inline entcheck" title=${this.host._t('marker.show_entities_tip')}>
                ${this._boolInput(d.showEntities, (v) => (this.host._markerDialog = { ...d, showEntities: v }),
                  d.bindingMode !== 'ha')}
                <span>${this.host._t('marker.show_entities')}</span>
              </label>
            </div>
            ${d.bindingMode === 'ha'
              ? html`<button class="dropbtn ${d.bindingOpen ? 'open' : ''}"
                    @click=${() => (this.host._markerDialog = { ...d, bindingOpen: !d.bindingOpen })}>
                    ${curLabel
                      ? html`<b>${curLabel}</b><span class="ref">${d.binding}${bindingStatus?.kind === 'ha_disabled'
                          ? ` · ${this.host._t('marker.binding_disabled')}` : ''}</span>`
                      : html`<span class="muted">${this.host._t('marker.pick_ph')}</span>`}
                    <ha-icon icon=${d.bindingOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
                  </button>
                  ${d.bindingOpen
                    ? html`<div class="droppanel">
                        <input class="namein" type="text" placeholder=${this.host._t('marker.search_ph')}
                          .value=${d.bindingFilter}
                          @input=${(e: Event) => (this.host._markerDialog = { ...d, bindingFilter: (e.target as HTMLInputElement).value })} />
                        <div class="candlist">
                          ${cands.map(
                            (c) => html`<div class="cand ${c.value === d.binding ? 'sel' : ''}"
                              @click=${() => {
                                // #385(а): same-binding click is a no-op —
                                // only an actual change resets value source
                                // and badge (spec #378 §1.6).
                                if (c.value === d.binding) {
                                  this.host._markerDialog = { ...d, bindingOpen: false };
                                  return;
                                }
                                const next = {
                                  ...d, binding: c.value, bindingOpen: false,
                                  controls: persistedExternalControls(
                                    c.value, d.controls, this.host._bindingEntities(c.value),
                                  ),
                                  autoIcon: this.host._autoIconForBinding(c.value),
                                  ...radarAfterBindingChange(d.radar, d.radarTouched, d.radarRemove),
                                };
                                this.host._markerDialog = this._announceToggleDraft({
                                  ...next, ...this._valueBadgeForBinding(next, c.value),
                                  valueSource: null, valueSourceTouched: true,
                                });
                              }}>
                              <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                            </div>`,
                          )}
                          ${!cands.length ? html`<div class="cand muted">${this.host._t('marker.nothing_found')}</div>` : nothing}
                        </div>
                      </div>`
                    : nothing}`
              : nothing}
          </div>

          <label for="marker-room">${this.host._t('marker.room_label')}${isVirtual ? '' : this.host._t('marker.room_override')}</label>
          <select id="marker-room" class="areasel"
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
              ${isVirtual ? this.host._t('marker.room_choose') : this.host._t('marker.room_auto')}
            </option>
            ${this.host._allRoomsFlat().map(
              (r) => html`<option value=${r.value} ?selected=${r.value === d.room}>${r.label}</option>`,
            )}
          </select>

          ${this._renderRadarSection(d, previewDevice)}
          ${this._renderVacSection(d)}`,
          })}
          ${formCard({
            title: this.host._t('marker.card_tap'),
            body: html`

          <label>${this.host._t('marker.tap_label')}</label>
          <select id="marker-tap-action" class="areasel"
            aria-describedby=${effectiveTapAction === 'toggle' ? 'marker-toggle-hint' : nothing}
            @change=${(e: Event) => {
              const next = {
                ...d,
                tapAction: (e.target as HTMLSelectElement).value,
                tapActionTouched: true,
              };
              this.host._markerDialog = this._announceToggleDraft(next);
            }}>
            ${TAP_ACTIONS.map((v) => [v, 'tap.' + v.replace('-', '_')] as const).map(
              ([v, k]) => html`<option value=${v} ?selected=${v === effectiveTapAction}>
                ${this.host._t(k as any)}
              </option>`,
            )}
          </select>
          ${effectiveTapAction === 'toggle'
            && (toggleEntities.length > 1 || staleToggleEntity)
            ? html`<div class="markerhelpfield markertoggleentity">
                <div class="markerhelplabel">
                  <label for="marker-toggle-entity">${this.host._t('marker.toggle_entity_label')}</label>
                  ${this._help('marker.toggle_entity.help')}
                </div>
                <select id="marker-toggle-entity" class="areasel"
                  @change=${(e: Event) => {
                    const next = {
                      ...d,
                      toggleEntity: (e.target as HTMLSelectElement).value,
                      toggleEntityTouched: true,
                    };
                    this.host._markerDialog = this._announceToggleDraft(next);
                  }}>
                  <option value="" ?selected=${staleToggleEntity || !d.toggleEntity}>
                    ${this.host._t('marker.toggle_entity_auto', {
                      entity: automaticToggleTarget || this.host._t('marker.toggle_entity_none'),
                    })}
                  </option>
                  ${toggleEntities.map((eid) => html`<option value=${eid}
                    ?selected=${!staleToggleEntity && eid === d.toggleEntity}>
                    ${this.host.hass.states[eid]?.attributes?.friendly_name
                      || this.host._fullRegistryHass.entities[eid]?.name || eid} · ${eid}
                  </option>`)}
                </select>
                ${staleToggleEntity ? html`<p class="muted markerlightwarning" role="status">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  ${this.host._t('marker.toggle_entity_missing', {
                    entity: d.toggleEntity,
                    fallback: automaticToggleTarget || this.host._t('marker.toggle_entity_none'),
                  })}
                </p>` : nothing}
              </div>`
            : nothing}
          ${effectiveTapAction === 'toggle'
            ? html`<div id="marker-toggle-hint" class="rhint togglehint">
                ${toggleHintLines.map((line) => html`<div>${line}</div>`)}
              </div>
              <div class="sr-only" role="status" aria-live="polite">${d.tapHintAnnouncement}</div>`
            : nothing}
          ${effectiveTapAction === 'run'
            ? (() => {
                const q = d.runFilter.trim().toLowerCase();
                const cands = this._runCandidates().filter(
                  (c) => !q || c.label.toLowerCase().includes(q) || c.value.includes(q),
                );
                const cur = d.tapTarget ? this._runCandidates().find((c) => c.value === d.tapTarget) : null;
                return html`
                  <label>${this.host._t('marker.run_target_label')}</label>
                  ${d.tapTarget && !cur
                    ? html`<div class="rhint">${this.host._t('marker.run_target_gone', { id: d.tapTarget })}</div>`
                    : nothing}
                  <input class="namein" type="text" placeholder=${this.host._t('marker.run_search_ph')}
                    .value=${cur ? cur.label : d.runFilter}
                    @focus=${(e: Event) => { (e.target as HTMLInputElement).select(); }}
                    @input=${(e: Event) => (this.host._markerDialog = { ...d, runFilter: (e.target as HTMLInputElement).value, tapTarget: '' })} />
                  ${!cur
                    ? html`<div class="candlist">
                        ${cands.slice(0, 40).map(
                          (c) => html`<div class="cand ${c.value === d.tapTarget ? 'sel' : ''}"
                            @click=${() => (this.host._markerDialog = { ...d, tapTarget: c.value, runFilter: '' })}>
                            <span class="cl">${c.label}</span><span class="cs">${c.sub}</span>
                          </div>`,
                        )}
                        ${!cands.length ? html`<div class="cand muted">${this.host._t('marker.nothing_found')}</div>` : nothing}
                      </div>`
                    : nothing}`;
              })()
            : nothing}
          ${effectiveTapAction === 'run' || effectiveTapAction === 'toggle'
            ? html`<label class="srcrow" title=${this.host._t('marker.tap_confirm_tip')}>
                ${this._boolInput(d.tapConfirm, (v) => (this.host._markerDialog = { ...d, tapConfirm: v }))}
                <span>${this.host._t('marker.tap_confirm')}</span>
              </label>`
            : nothing}

          <div class="helpfieldlabel">
            <label for="marker-controls-filter">${this.host._t('marker.controls_label')}</label>
            ${this._help('marker.controls.help')}
          </div>
          ${d.controls.length
            ? html`<div class="ctrlchips">
                ${d.controls.map((eid) => {
                  const info = this._controlRefInfo(eid);
                  return html`<span class="ctrlchip ${info.warning ? 'warning' : ''}" title=${info.sub}>
                  <ha-icon icon=${info.icon}></ha-icon>${info.label}
                  <ha-icon icon="mdi:close" @click=${() =>
                    (this.host._markerDialog = this._announceToggleDraft({
                      ...d, controls: d.controls.filter((x) => x !== eid),
                    }))}></ha-icon>
                </span>`;
                })}
              </div>`
            : nothing}
          <input id="marker-controls-filter" class="namein" type="text" placeholder=${this.host._t('marker.controls_filter')}
            .value=${d.controlsFilter}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, controlsFilter: (e.target as HTMLInputElement).value })} />
          ${d.controlsFilter.trim()
            ? html`<div class="ctrllist">
                ${this._controlCandidates(d).map((candidate) => html`<button class="ctrlopt"
                    @click=${() => this._addControlRef(d, candidate.value)}>
                    <ha-icon icon=${candidate.icon}></ha-icon>
                    ${candidate.label}
                    <span class="sub">${candidate.sub}</span>
                  </button>`)}
              </div>`
            : nothing}
`,
          })}
          ${formCard({
            title: this.host._t('marker.card_light'),
            body: html`
          ${this.host._bindingHasClimate(d.binding)
            ? html`<label class="srcrow climrow" title=${this.host._t('marker.use_climate_temp_tip')}>
                ${this._boolInput(d.useClimateTemp, (v) => (this.host._markerDialog = { ...d, useClimateTemp: v }))}
                <span>${this.host._t('marker.use_climate_temp')}</span>
              </label>`
            : nothing}
          <fieldset class="markerlightgroup">
            <legend><span>${this.host._t('marker.light_role_label')}</span>${this._help('marker.light_role.help')}</legend>
            <div class="markerradios" role="radiogroup" aria-label=${this.host._t('marker.light_role_label')}>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="auto"
                .checked=${d.lightRole === 'auto'} @change=${() => this._setMarkerLightRole('auto')} />
                <span>${this.host._t(autoHasSpatialSource ? 'marker.light_role_auto_yes' : 'marker.light_role_auto_no')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="always"
                .checked=${d.lightRole === 'always'} @change=${() => this._setMarkerLightRole('always')} />
                <span>${this.host._t('marker.light_role_always')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-light-role" value="never"
                .checked=${d.lightRole === 'never'} @change=${() => this._setMarkerLightRole('never')} />
                <span>${this.host._t('marker.light_role_never')}</span></label>
            </div>
          </fieldset>

          ${d.lightRole === 'always' && (leadingEntities.length > 1 || staleLeading)
            ? html`<div class="markerhelpfield markerleadingentity">
                <div class="markerhelplabel">
                  <label for="marker-light-entity">${this.host._t('marker.light_entity_label')}</label>
                  ${this._help('marker.light_entity.help')}
                </div>
                <select id="marker-light-entity" class="areasel"
                  @change=${(e: Event) => (this.host._markerDialog = {
                    ...d,
                    lightEntity: (e.target as HTMLSelectElement).value,
                    lightEntityTouched: true,
                  })}>
                  <option value="" ?selected=${staleLeading || !d.lightEntity}>
                    ${this.host._t('marker.light_entity_auto', {
                      entity: effectiveLeading || this.host._t('marker.light_entity_none'),
                    })}
                  </option>
                  ${leadingEntities.map((eid) => html`<option value=${eid}
                    ?selected=${!staleLeading && eid === d.lightEntity}>
                    ${this.host.hass.states[eid]?.attributes?.friendly_name
                      || this.host._fullRegistryHass.entities[eid]?.name || eid} · ${eid}
                  </option>`)}
                </select>
                ${staleLeading ? html`<p class="muted markerlightwarning" role="status">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  ${this.host._t('marker.light_entity_missing', {
                    entity: d.lightEntity, fallback: effectiveLeading || '—',
                  })}
                </p>` : nothing}
              </div>`
            : nothing}

          <fieldset class="markerlightgroup" ?disabled=${glowSourceDisabled}>
            <legend><span>${this.host._t('marker.glow_color_label')}</span>${this._help('marker.glow_mode.help')}</legend>
            <div class="markerradios" role="radiogroup" aria-label=${this.host._t('marker.glow_color_label')}>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="auto"
                .checked=${displayedGlowMode === 'auto'} ?disabled=${liveGlowDisabled}
                aria-describedby=${liveGlowDisabled ? 'marker-glow-disabled-hint' : nothing}
                @change=${() => this._setMarkerGlowMode('auto')} />
                <span>${this.host._t('marker.glow_mode_auto')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="color"
                .checked=${displayedGlowMode === 'color'} ?disabled=${glowSourceDisabled}
                aria-describedby=${glowSourceDisabled ? 'marker-glow-disabled-hint' : nothing}
                @change=${() => this._setMarkerGlowMode('color')} />
                <span>${this.host._t('marker.glow_mode_color')}</span></label>
              <label class="srcrow"><input type="radio" name="marker-glow-mode" value="fixed"
                .checked=${displayedGlowMode === 'fixed'} ?disabled=${glowSourceDisabled}
                aria-describedby=${glowSourceDisabled ? 'marker-glow-disabled-hint' : nothing}
                @change=${() => this._setMarkerGlowMode('fixed')} />
                <span>${this.host._t('marker.glow_mode_fixed')}</span></label>
            </div>
            ${displayedGlowMode !== 'auto' ? html`<div class="colorrow markerglowvalue">
              <hp-color-opacity .label=${this.host._t('marker.glow_color')}
                .color=${d.glowColor} .opacity=${1} .showOpacity=${false}
                .pickerLabels=${this.host._colorPickerLabels}
                .disabled=${glowSourceDisabled}
                @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                  this.host._markerDialog = {
                    ...d, glowMode: displayedGlowMode,
                    glowColor: e.detail.color, glowColorDrafted: true, glowTouched: true,
                  };
                }}></hp-color-opacity>
              ${displayedGlowMode === 'fixed' ? html`
                <span class="opl">${this.host._t('marker.glow_brightness')}</span>
                ${this._rangeInput(1, 100, 1, d.glowBrightness, (n) => {
                  this.host._markerDialog = {
                    ...d, glowMode: displayedGlowMode,
                    glowBrightness: n, glowBrightnessDrafted: true, glowTouched: true,
                  };
                }, glowSourceDisabled, this.host._t('marker.glow_brightness'))}
                <span class="opv">${Math.round(d.glowBrightness)}%</span>` : nothing}
            </div>` : nothing}
          </fieldset>
          <div class="markerhelpfield">
            <div class="markerhelplabel">
              <label for="marker-glow-radius">${this.host._t('marker.glow_radius_label')}</label>
              ${this._help('marker.glow_radius.help')}
            </div>
            <div class="colorrow">
              <input id="marker-glow-radius" class="tempin" type="number" min="0.5" step="0.5"
                placeholder=${this.host._glowRadiusPlaceholder} ?disabled=${glowSourceDisabled}
                aria-describedby=${glowSourceDisabled || passiveSource ? 'marker-glow-disabled-hint' : nothing}
                .value=${d.glowRadius}
                @input=${(e: Event) => (this.host._markerDialog = { ...d, glowRadius: (e.target as HTMLInputElement).value })} />
              <span class="opl">${this.host._imperial ? this.host._t('gs.unit_ft') : this.host._t('gs.unit_m')}</span>
            </div>
          </div>
          ${glowSourceDisabled || passiveSource
            ? html`<p id="marker-glow-disabled-hint" class="muted markerlightdisabled" role="note">
                <ha-icon icon="mdi:information-outline"></ha-icon>${glowDisabledHint}
              </p>`
            : nothing}
`,
          })}
          ${formCard({
            title: this.host._t('marker.card_appearance'),
            body: html`
          <label>${this.host._t('marker.icon_label')}</label>
          ${customElements.get('ha-icon-picker')
            // Feed the effective icon to HA's picker so its field renders both
            // the glyph and the mdi:* label. autoIcon is presentation-only:
            // untouched dialogs still save d.icon as an empty auto override.
            ? html`<ha-icon-picker .hass=${this.host.hass} .value=${d.icon || d.autoIcon}
                .placeholder=${d.autoIcon || undefined}
                .fallbackPath=${undefined}
                @value-changed=${(e: any) => {
                  const icon = e.detail.value || '';
                  // Some picker versions announce an assigned value. Do not
                  // let that turn the display-only auto icon into an override.
                  if (!d.icon && icon === d.autoIcon) return;
                  this.host._markerDialog = { ...d, icon };
                }}></ha-icon-picker>`
            : html`<input class="namein" type="text"
                placeholder=${d.autoIcon || this.host._t('marker.icon_ph')}
                .value=${d.icon}
                @input=${(e: Event) => (this.host._markerDialog = { ...d, icon: (e.target as HTMLInputElement).value })} />`}
          ${!d.icon && d.autoIcon
            ? html`<p class="muted iconauto"><ha-icon icon=${d.autoIcon}></ha-icon>
                <span>${this.host._t('marker.icon_auto', { icon: d.autoIcon })}</span>
                <button class="btn ghost" type="button"
                  @click=${() => (this.host._markerDialog = { ...d, icon: d.autoIcon })}>
                  ${this.host._t('marker.icon_pin_auto')}
                </button></p>`
            : nothing}

          <label for="marker-display">${this.host._t('marker.display_label')}</label>
          <select id="marker-display" class="areasel"
            @change=${(e: Event) => (this.host._markerDialog = {
              ...d,
              display: normalizeDeviceDisplay((e.target as HTMLSelectElement).value),
            })}>
            ${DISPLAY_MODES.map((v) => html`<option value=${v} ?selected=${v === d.display}>
              ${this.host._t(DISPLAY_LABEL_KEYS[v])}
            </option>`)}
          </select>
          <p class="muted">${this.host._t(DISPLAY_HINT_KEYS[d.display])}</p>
          ${displayWantsValue(d.display) ? html`<div class="markerhelpfield markervaluesource">
            <div class="markerhelplabel">
              <label for="marker-value-source">${this.host._t('marker.value_source')}</label>
              ${this._help('marker.value_source.help')}
            </div>
            <select id="marker-value-source" class="areasel" ?disabled=${isVirtual}
              @change=${(e: Event) => (this.host._markerDialog = {
                ...d,
                valueSource: valueBadgeSourceFromKey((e.target as HTMLSelectElement).value),
                valueSourceTouched: true,
              })}>
              <option value="" ?selected=${!d.valueSource}>
                ${this.host._t('marker.value_source_auto')}
              </option>
              ${valueSourceMissing ? html`<option value=${valueSourceKey || '__missing__'} selected>
                ${this.host._t('marker.value_badge_missing')}
              </option>` : nothing}
              ${badgeCandidates.map((candidate) => html`<option value=${candidate.key}
                ?selected=${candidate.key === valueSourceKey}
                title=${candidate.technical}>
                ${this._valueBadgeCandidateLabel(candidate)} · ${candidate.value}
              </option>`)}
            </select>
            ${selectedValueSourceCandidate
              ? html`<p class="muted markerbadgetechnical"><code>${selectedValueSourceCandidate.technical}</code></p>`
              : nothing}
            ${isVirtual ? html`<p class="muted markerlightdisabled" role="note">
              <ha-icon icon="mdi:information-outline"></ha-icon>
              ${this.host._t('marker.preview.reason.value_virtual')}
            </p>` : valueSourceMissing ? html`<p class="muted markerlightwarning" role="status">
              <ha-icon icon="mdi:alert-outline"></ha-icon>${this.host._t('marker.value_source_missing_hint')}
            </p>` : nothing}
          </div>` : nothing}
          ${displayIsNeutral(d.display) && this.host._bindingHasAlarm(d.binding)
            ? html`<div class="habindingbanner" role="note">
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                <span>${this.host._t('marker.static_alarm_warning')}</span>
              </div>`
            : nothing}
          <fieldset class="markerlightgroup markerbadgegroup">
            <legend><span>${this.host._t('marker.value_badge_title')}</span>${this._help('marker.value_badge.help')}</legend>
            <label class="srcrow">
              ${this._boolInput(effectiveBadgeEnabled, (enabled) => {
                const source = effectiveBadgeSource || badgeRecommendation;
                this.host._markerDialog = {
                  ...d,
                  valueBadgeEnabled: enabled && !!source,
                  valueBadgeSource: source,
                  valueBadgeTouched: true,
                };
              }, displayIsNeutral(d.display) || (!badgeCandidates.length && !d.valueBadgeSource))}
              <span>${this.host._t('marker.value_badge_enabled')}</span>
            </label>
            ${displayIsNeutral(d.display)
              ? html`<p class="muted markerlightdisabled" role="note">
                  <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t('marker.value_badge_static')}
                </p>`
              : !badgeCandidates.length && !d.valueBadgeSource
                ? html`<p class="muted markerlightdisabled" role="note">
                    <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t('marker.value_badge_empty')}
                  </p>`
                : nothing}
            ${effectiveBadgeEnabled ? html`
              <div class="markerhelplabel">
                <label for="marker-value-badge-source">${this.host._t('marker.value_badge_source')}</label>
                ${this._help('marker.value_badge_source.help')}
              </div>
          <select id="marker-value-badge-source" class="areasel"
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  valueBadgeSource: valueBadgeSourceFromKey((e.target as HTMLSelectElement).value),
                  valueBadgeEnabled: true,
                  valueBadgeTouched: true,
                })}>
                ${badgeSourceMissing ? html`<option value=${badgeSourceKey} selected>
                  ${this.host._t('marker.value_badge_missing')}
                </option>` : nothing}
                ${badgeCandidates.map((candidate) => html`<option value=${candidate.key}
                  ?selected=${candidate.key === badgeSourceKey}
                  title=${candidate.technical}>
                  ${this._valueBadgeCandidateLabel(candidate)} · ${candidate.value}
                </option>`)}
              </select>
              ${selectedBadgeCandidate
                ? html`<p class="muted markerbadgetechnical"><code>${selectedBadgeCandidate.technical}</code></p>`
                : nothing}
              ${badgeSourceMissing ? html`<p class="muted markerlightwarning" role="status">
                <ha-icon icon="mdi:alert-outline"></ha-icon>${this.host._t('marker.value_badge_missing_hint')}
              </p>` : nothing}
              ${displayWantsValue(d.display) && badgeSourceKey === innerValueSourceKey
                ? html`<p class="muted markerlightwarning" role="note">
                    <ha-icon icon="mdi:information-outline"></ha-icon>${this.host._t('marker.value_badge_duplicate')}
                  </p>` : nothing}
              <div class="markerhelplabel">
                <label for="marker-value-badge-position">${this.host._t('marker.value_badge_position')}</label>
                ${this._help('marker.value_badge_position.help')}
              </div>
          <select id="marker-value-badge-position" class="areasel"
                @change=${(e: Event) => (this.host._markerDialog = {
                  ...d,
                  valueBadgeEnabled: effectiveBadgeEnabled,
                  valueBadgeSource: effectiveBadgeSource,
                  valueBadgePosition: (e.target as HTMLSelectElement).value as ValueBadgePosition,
                  valueBadgeTouched: true,
                })}>
                ${(['right', 'bottom', 'left', 'top'] as const).map((position) => html`
                  <option value=${position} ?selected=${position === effectiveBadgePosition}>
                    ${this.host._t(`marker.value_badge_${position}` as I18nKey)}
                  </option>`)}
              </select>
            ` : nothing}
          </fieldset>
          ${previewPresentation
            ? html`<hp-device-preview
                .hass=${this.host.hass}
                .presentation=${previewPresentation}
                .registry=${this.host._haRegistry}
                .deviceName=${d.name.trim() || previewDevice?.name || curLabel || ''}>
              </hp-device-preview>`
            : html`<div class="devicepreview-empty">
                <ha-icon icon="mdi:eye-outline"></ha-icon>
                <span>${this.host._t('marker.preview.select_source')}</span>
              </div>`}
          ${d.display === 'icon_ripple'
            ? html`<div class="colorrow ripple-colorrow">
                <hp-color-opacity .label=${this.host._t('marker.activity_color')}
                  .pickerLabels=${this.host._colorPickerLabels}
                  .color=${d.rippleColor || '#3ea6ff'} .opacity=${1} .showOpacity=${false}
                  @hp-color-opacity-change=${(e: CustomEvent<{ color: string }>) => {
                    this.host._markerDialog = { ...d, rippleColor: e.detail.color };
                  }}></hp-color-opacity>
              </div>
              <div class="colorrow ripple-sizerow">
                <span class="opl">${this.host._t('marker.ripple_size')}</span>
                ${this._rangeInput(1, 8, 0.5, d.rippleSize, (n) => (this.host._markerDialog = { ...d, rippleSize: n }))}
                <span class="opv">×${d.rippleSize}</span>
              </div>
              <p class="muted" role="note">${this.host._t('marker.activity_alarm_note')}</p>`
            : nothing}

          <label>${this.host._t('marker.size_label')}</label>
          <div class="colorrow">
            ${this._rangeInput(0.5, 3, 0.1, d.size, (n) => (this.host._markerDialog = { ...d, size: n }))}
            <span class="opv">×${d.size.toFixed(1)}</span>
            <span class="opl">${this.host._t('marker.angle_label')}</span>
            ${''/* 5 degrees, not 10 (owner 2026-08-03): a marker often has to
                   line up with a wall that is not on a 10-degree grid. */}
            ${this._rangeInput(0, 355, 5, d.angle, (n) => (this.host._markerDialog = { ...d, angle: n }))}
            <span class="opv">${d.angle}°</span>
          </div>`,
          })}
          ${formCard({
            title: this.host._t('marker.card_details'),
            body: html`

          <label>${this.host._t('marker.model_label')}</label>
          <input class="namein" type="text" placeholder=${this.host._t('marker.model_ph')}
            .value=${d.model}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, model: (e.target as HTMLInputElement).value })} />

          <label>${this.host._t('marker.link_label')}</label>
          <input class="namein" type="url" placeholder="https://…"
            .value=${d.link}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, link: (e.target as HTMLInputElement).value })} />

          <label>${this.host._t('marker.desc_label')}</label>
          <textarea class="descin" rows="4" placeholder=${this.host._t('marker.desc_ph')}
            .value=${d.description}
            @input=${(e: Event) => (this.host._markerDialog = { ...d, description: (e.target as HTMLTextAreaElement).value })}></textarea>

          <label>${this.host._t('marker.manuals_label')}</label>
          <div class="pdfedit">
            ${d.pdfs.map(
              (p) => html`<span class="pdftag"><ha-icon icon="mdi:file-pdf-box"></ha-icon>
                <a href="${safeUrl(this.host._display(p.url)) || '#'}" target="_blank" rel="noreferrer noopener">${p.name}</a>
                <ha-icon class="x" icon="mdi:close" @click=${() => this._removeMarkerPdf(p.url)}></ha-icon></span>`,
            )}
            <span class="fileupload">
              <button class="btn filebtn" type="button" @click=${(e: Event) =>
                ((e.currentTarget as HTMLElement).nextElementSibling as HTMLInputElement | null)?.click()}>
                <ha-icon icon="mdi:paperclip"></ha-icon>${this.host._t('btn.attach')}
              </button>
              <input type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf"
                @change=${(e: Event) => this._pickMarkerFiles(e)} />
            </span>
          </div>
          ${this._renderRadarSection(d, previewDevice, 'additional')}`,
          })}
        </div>
        <div class="row markerfooter" slot="footer">
          <div class="markeractions">
            ${d.devId
              ? html`<button class="btn" type="button"
                  ?disabled=${d.busy || this._radarSetup.isActive()}
                  aria-pressed=${d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'true' : 'false'}
                  title=${this.host._t(d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'marker.show_tip' : 'marker.hide_tip')}
                  @click=${this.host._toggleMarkerDialogVisibility}>
                  <ha-icon icon=${d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'mdi:eye-outline' : 'mdi:eye-off-outline'}></ha-icon>
                  ${this.host._t(d.hideFromPlan || bindingStatus?.kind === 'ha_disabled' ? 'marker.show' : 'marker.hide')}
                </button>`
              : nothing}
            ${d.devId
              ? html`<button class="btn danger" type="button" ?disabled=${d.busy || this._radarSetup.isActive()}
                  title=${this.host._t('marker.delete_tip')} @click=${() => this._deleteMarker()}>
                  <ha-icon icon="mdi:delete-outline"></ha-icon>${this.host._t('btn.delete')}
                </button>`
              : nothing}
          </div>
          <div class="markersaveactions">
            <button class="btn ghost" data-hp="dialog-cancel" ?disabled=${d.busy}
              @click=${() => this._closeMarkerDialog()}>${this.host._t('btn.cancel')}</button>
            <button class="btn on" data-hp="dialog-confirm" @click=${() => this._saveMarker()}
              ?disabled=${d.busy || this._radarSetup.isActive() || (d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual'
                || (!d.devId && bindingStatus?.kind !== 'active')))}
              title=${d.bindingMode === 'ha' && (!d.binding || d.binding === 'virtual') ? this.host._t('marker.pick_ph') : ''}>
              <ha-icon icon="mdi:check"></ha-icon>${d.busy ? '…' : this.host._t('btn.save')}
            </button>
          </div>
        </div>
    </hp-dialog>`;
  }
