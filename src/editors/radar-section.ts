/** Lazy Device-editor surface for Stage-1 presence radars (#485). */
import { html, nothing, type TemplateResult } from 'lit';

import type { I18nKey } from '../i18n';
import type { SettingsI18nKey } from '../i18n/settings';
import type { ToolsI18nKey } from '../i18n/tools';
import {
  freshRadarInstallationId, radarConfigFromDraft, radarDraft, radarSourceCandidates,
  recognizeRadar, recognizeRadarBinding,
  type RadarEditorDraft, type RadarHassLike,
} from '../radar-editor';
import { radarSetupFrame, type RadarSetupController } from '../radar-setup';
import type { ContentItem } from '../space-geometry';
import type { DevItem, SpaceModel } from '../types';
import { callout, field, formCard, subsection, toggleRow } from './form-kit';

interface RadarDialogSlice {
  devId?: string;
  bindingMode: 'virtual' | 'ha';
  radar: RadarEditorDraft | null;
  radarRemove: boolean;
}

interface RadarState {
  attributes?: { friendly_name?: string };
}

interface RadarHass {
  states?: Record<string, RadarState>;
  callWS<T = unknown>(message: Record<string, unknown>): Promise<T>;
}

export interface RadarSectionOptions {
  dialog: RadarDialogSlice;
  device: DevItem | null;
  registryHass: RadarHassLike;
  planHass: RadarHass;
  hass: RadarHass;
  spaceModelById(id: string | null | undefined): SpaceModel | null | undefined;
  currentSpace(): SpaceModel | null | undefined;
  /** The main card's content-frame items of a space (docs/CANVAS.md §4): the
   * on-plan setup frames the same plan, without drawing those layers (#774). */
  contentItems(space: SpaceModel): ReadonlyArray<ContentItem>;
  position(device: DevItem): { x: number; y: number };
  updateDialog(patch: Partial<{
    radar: RadarEditorDraft | null;
    radarEligible: boolean;
    radarTouched: boolean;
    radarRemove: boolean;
  }>): void;
  dialogDeviceId(): string | undefined;
  t(key: I18nKey, vars?: Record<string, string | number>): string;
  st(key: SettingsI18nKey, vars?: Record<string, string | number>): string;
  toolsT(key:ToolsI18nKey): string;
  help(key: 'radar.help'): TemplateResult | typeof nothing;
  boolInput(value: boolean, change: (value: boolean) => void): TemplateResult;
  toast(message: string): void;
  setup: RadarSetupController;
  configRev: number;
}

/** Rendered from the lazy editor chunk; ordinary View never loads this file. */
export function renderRadarSection(
  options: RadarSectionOptions,
  placement: 'main' | 'additional' = 'main',
): TemplateResult {
  const { dialog: d, device } = options;
  const help=(key:ToolsI18nKey,label:string)=>html`<hp-help instant .text=${options.toolsT(key)} .ariaLabel=${options.st('dialog.help_for',{name:label})}></hp-help>`;
  if (!device) return html``;
  options.setup.syncMarker(device.marker?.id || device.id);
  const recognition = recognizeRadar(device, options.registryHass);
  const automatic = d.bindingMode !== 'virtual' && recognizeRadarBinding(device, options.registryHass).eligible;
  if (placement === 'main' && !automatic) return html``;
  if (placement === 'additional' && !device.marker?.radar) return html``;
  const savedUnsupported = recognition.reason === 'saved_unsupported';
  const remove = () => options.updateDialog({
    // Keep the draft in memory until Save/close.  Turning the switch back on
    // in the same session must restore every entered source/calibration value.
    radar: d.radar, radarTouched: true, radarRemove: true,
  });
  const begin = () => {
    const space = options.spaceModelById(device.space) || options.currentSpace();
    if (!space) return;
    const point = options.position(device);
    const radar = radarDraft(device, space, [point.x, point.y], options.registryHass, true);
    if (!radar) return;
    options.updateDialog({
      radar: {...radar,enabled:true}, radarEligible: true, radarTouched: true, radarRemove: false,
    });
  };
  const restoreOrBegin = () => {
    if (d.radar) {
      options.updateDialog({
        radar: {...d.radar,enabled:true}, radarEligible: true, radarTouched: true, radarRemove: false,
      });
      return;
    }
    begin();
  };
  const active = !!d.radar && !d.radarRemove;
  if (!active && options.setup.isActive()) options.setup.reset();
  const radarToggle = automatic ? toggleRow({
    id: 'marker-radar-presence',
    icon: 'mdi:radar',
    title: options.t('radar.enabled'),
    caption: recognition.reason === 'ld2450' ? options.t('radar.detected_ld2450')
      : recognition.reason === 'radar_metadata' ? options.t('radar.detected') : undefined,
    checked: active || savedUnsupported,
    disabled: savedUnsupported || d.bindingMode === 'virtual',
    onChange: (checked) => { if (checked) restoreOrBegin(); else remove(); },
  }) : nothing;
  if (savedUnsupported || d.bindingMode === 'virtual' && !!device.marker?.radar) {
    return html`<div class="radaradditional">
      ${radarToggle}
      <fieldset class="markerlightgroup radargroup">
        <legend>${options.t('radar.title')}</legend>
        <p class="muted">${options.t('radar.saved_unsupported')}</p>
        <div class="row">
          <button class="btn danger" type="button" @click=${remove}>
            <ha-icon icon="mdi:radar-off"></ha-icon>${options.t('radar.remove')}
          </button>
        </div>
      </fieldset>
    </div>`;
  }
  if (d.bindingMode === 'virtual') return html``;
  if (!active) return automatic ? formCard({id:'radar',title:options.st('marker.section_radar'),body:html`${subsection({title:options.st('marker.radar_data'),help:options.help('radar.help')})}${radarToggle}`}) : html``;

  const radar = d.radar!;
  const candidates = radarSourceCandidates(device, options.planHass);
  const entitySelect = (
    value: string,
    values: readonly string[],
    update: (value: string) => void,
    emptyKey: I18nKey = 'radar.source_choose',
  ) => html`<hp-settings-select><select class="areasel" @change=${(event: Event) =>
    update((event.target as HTMLSelectElement).value)}>
    <option value="" ?selected=${!value}>${options.t(emptyKey)}</option>
    ${value && !values.includes(value)
      ? html`<option value=${value} selected>${value} · ${options.t('radar.source_missing')}</option>`
      : nothing}
    ${values.map((entityId) => {
      const registryEntity = options.registryHass.entities?.[entityId];
      const registryDevice = registryEntity?.device_id
        ? options.registryHass.devices?.[registryEntity.device_id] : undefined;
      const deviceName = registryDevice?.name_by_user || registryDevice?.name || '';
      const sourceName = options.planHass.states?.[entityId]?.attributes?.friendly_name || entityId;
      return html`<option value=${entityId} ?selected=${entityId === value}>
        ${sourceName} · ${entityId}${deviceName ? ` · ${deviceName}` : ''}
      </option>`;
    })}
  </select></hp-settings-select>`;
  const change = (patch: Partial<RadarEditorDraft>, resetCalibration = true) => {
    options.setup.reset();
    options.updateDialog({
      radar: { ...radar, ...patch,
        calibrationOverride: resetCalibration ? undefined : radar.calibrationOverride,
        inspection: undefined, inspectError: undefined },
      radarTouched: true,
      radarRemove: false,
    });
  };
  const space = options.spaceModelById(device.space) || options.currentSpace();
  const roomOptions = space?.rooms || [];
  const coordinateProfile = radar.profile === 'esphome_ld2450_v1'
    || radar.profile === 'cartesian_v1';
  const inspect = async () => {
    if (radar.inspectBusy || !space) return;
    const config = radarConfigFromDraft(radar, space.cellCm || 5);
    if (!config) {
      options.toast(options.t('radar.invalid'));
      return;
    }
    options.updateDialog({ radar: { ...radar, inspectBusy: true, inspectError: undefined } });
    try {
      const inspection = await options.hass.callWS<RadarEditorDraft['inspection']>({
        type: 'houseplan/radar/setup/inspect',
        marker_id: device.marker?.id || device.id,
        draft_sources: { radar: config },
      });
      if (options.dialogDeviceId() !== d.devId) return;
      options.updateDialog({
        radar: { ...radar, inspectBusy: false, inspection },
      });
    } catch (error: unknown) {
      if (options.dialogDeviceId() !== d.devId) return;
      const code = String(error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code || 'invalid_radar' : 'invalid_radar');
      const key = `radar.error_${code}` as I18nKey;
      const translated = options.t(key);
      options.updateDialog({
        radar: {
          ...radar,
          inspectBusy: false,
          inspectError: translated === key ? options.t('radar.error_invalid_radar') : translated,
        },
      });
    }
  };
  const configureOnPlan = (draft = radar) => {
    const room = roomOptions.find((candidate) => candidate.id === draft.roomId);
    if (!space || !room || !radarConfigFromDraft(draft, space.cellCm || 5)) {
      options.toast(options.t('radar.invalid'));
      return;
    }
    if (!Array.isArray(room.poly) || room.poly.length < 3) {
      options.toast(options.t('radar.no_contour'));
    }
    if (!options.setup.begin(
      device.marker?.id || device.id, draft, room, space.cellCm || 5, options.configRev,
      radarSetupFrame(space, room, options.contentItems(space)),
    )) options.toast(options.t('radar.invalid'));
  };
  const changeInstallation = () => configureOnPlan({
    ...radar,
    installationId: freshRadarInstallationId(),
    calibrationOverride: undefined,
    inspection: undefined,
    inspectError: undefined,
  });
  const setAxis = (axis: 'xEntities' | 'yEntities', index: number, value: string) => {
    const next = [...radar[axis]];
    next[index] = value;
    change({ [axis]: next });
  };
  const setStringAt = (
    axis: 'distanceEntities' | 'angleEntities' | 'rangeEntities'
      | 'slotPresenceEntities' | 'rangePresenceEntities',
    index: number,
    value: string,
  ) => {
    const next = [...radar[axis]];
    next[index] = value;
    change({ [axis]: next });
  };
  const setBoolAt = (axis: 'swapXY', index: number, value: boolean) => {
    const next = [...radar[axis]];
    next[index] = value;
    change({ [axis]: next });
  };
  const setSignAt = (axis: 'xSigns' | 'ySigns', index: number, value: 1 | -1) => {
    const next = [...radar[axis]];
    next[index] = value;
    change({ [axis]: next });
  };
  const addTarget = () => {
    if (radar.xEntities.length >= 8) return;
    change({
      xEntities: [...radar.xEntities, ''], yEntities: [...radar.yEntities, ''],
      distanceEntities: [...radar.distanceEntities, ''],
      angleEntities: [...radar.angleEntities, ''],
      slotPresenceEntities: [...radar.slotPresenceEntities, ''],
      swapXY: [...radar.swapXY, false], xSigns: [...radar.xSigns, 1],
      ySigns: [...radar.ySigns, 1],
    });
  };
  const removeTarget = (index: number) => change({
    xEntities: radar.xEntities.filter((_value, candidate) => candidate !== index),
    yEntities: radar.yEntities.filter((_value, candidate) => candidate !== index),
    distanceEntities: radar.distanceEntities.filter((_value, candidate) => candidate !== index),
    angleEntities: radar.angleEntities.filter((_value, candidate) => candidate !== index),
    slotPresenceEntities: radar.slotPresenceEntities.filter((_value, candidate) => candidate !== index),
    swapXY: radar.swapXY.filter((_value, candidate) => candidate !== index),
    xSigns: radar.xSigns.filter((_value, candidate) => candidate !== index),
    ySigns: radar.ySigns.filter((_value, candidate) => candidate !== index),
  });
  const addRange = () => {
    if (radar.rangeEntities.length >= 2) return;
    change({ rangeEntities: [...radar.rangeEntities, ''],
      rangePresenceEntities: [...radar.rangePresenceEntities, ''] });
  };
  const removeRange = (index: number) => change({
    rangeEntities: radar.rangeEntities.filter((_value, candidate) => candidate !== index),
    rangePresenceEntities: radar.rangePresenceEntities
      .filter((_value, candidate) => candidate !== index),
  });

  return html`<div class="radaradditional">
    <fieldset class="markerlightgroup radargroup hpf-card" data-card="radar">
    <legend class="hpf-head"><h3>${options.st('marker.section_radar')}</h3></legend>
    <div class="hpf-body">
    ${subsection({title:options.st('marker.radar_data'),help:options.help('radar.help')})}
    ${toggleRow({id:'marker-radar-presence',title:options.t('radar.enabled'),checked:radar.enabled,onChange:(enabled)=>change({enabled},false)})}
    ${toggleRow({id:'marker-radar-show-live',title:options.t('radar.show_live'),checked:radar.showLive,onChange:(showLive)=>change({showLive},false)})}
    ${field({label:options.t('radar.profile'),help:help('marker.radar_profile_help',options.t('radar.profile')),htmlFor:'radar-profile',control:html`<hp-settings-select><select id="radar-profile" class="areasel" @change=${(event: Event) => change({
      profile: (event.target as HTMLSelectElement).value as RadarEditorDraft['profile'],
    })}>
      ${(['esphome_ld2450_v1', 'cartesian_v1', 'polar_v1', 'range_v1', 'zones_v1', 'presence_v1'] as const)
        .map((profile) => html`<option value=${profile} ?selected=${profile === radar.profile}>
          ${options.t(`radar.profile_${profile}` as I18nKey)}
        </option>`)}
    </select></hp-settings-select>`})}
    ${field({label:options.t('radar.room'),help:help('marker.radar_room_help',options.t('radar.room')),htmlFor:'radar-room',control:html`<hp-settings-select><select id="radar-room" class="areasel" @change=${(event: Event) => change({
      roomId: (event.target as HTMLSelectElement).value,
    })}>
      <option value="" ?selected=${!radar.roomId}>${options.t('radar.room_choose')}</option>
      ${roomOptions.map((room) => html`<option value=${room.id || ''}
        ?selected=${room.id === radar.roomId}>${room.name}</option>`)}
    </select></hp-settings-select>`})}

    ${coordinateProfile ? radar.xEntities.map((xEntity, index) => html`
      <section class="hpf-profile-target">
      <div class="radartargetheading hpf-profile-target-heading">
        <strong>${options.t('radar.target', { n: index + 1 })}</strong>
        ${radar.profile === 'cartesian_v1' && radar.xEntities.length > 1
          ? html`<span class="hpf-button-help"><button class="btn ghost danger" type="button" title=${options.t('btn.delete')}
              @click=${() => removeTarget(index)}>${options.st('marker.radar_remove_target',{n:index+1})}</button>${help('marker.radar_remove_target_help',options.st('marker.radar_remove_target',{n:index+1}))}</span>`
          : nothing}
      </div>
      ${field({label:options.t('radar.axis_x'),control:entitySelect(xEntity, candidates.numeric, (value) => setAxis('xEntities', index, value))})}
      ${field({label:options.t('radar.axis_y'),control:entitySelect(radar.yEntities[index] || '', candidates.numeric,
        (value) => setAxis('yEntities', index, value))})}
      ${radar.profile === 'cartesian_v1' ? html`
        ${toggleRow({title:options.t('radar.swap_axes'),checked:radar.swapXY[index]===true,onChange:value=>setBoolAt('swapXY',index,value)})}
        <div class="colorrow radarcoordinates">
          <label>${options.t('radar.axis_x_sign')}<hp-settings-select><select class="areasel"
            @change=${(event: Event) => setSignAt('xSigns', index,
              Number((event.target as HTMLSelectElement).value) === -1 ? -1 : 1)}>
            <option value="1" ?selected=${radar.xSigns[index] !== -1}>+1</option>
            <option value="-1" ?selected=${radar.xSigns[index] === -1}>−1</option>
          </select></hp-settings-select></label>
          <label>${options.t('radar.axis_y_sign')}<hp-settings-select><select class="areasel"
            @change=${(event: Event) => setSignAt('ySigns', index,
              Number((event.target as HTMLSelectElement).value) === -1 ? -1 : 1)}>
            <option value="1" ?selected=${radar.ySigns[index] !== -1}>+1</option>
            <option value="-1" ?selected=${radar.ySigns[index] === -1}>−1</option>
          </select></hp-settings-select></label>
        </div>
      ` : nothing}
      ${field({label:options.t('radar.presence_gate'),control:entitySelect(radar.slotPresenceEntities[index] || '', candidates.binary,
        (value) => setStringAt('slotPresenceEntities', index, value), 'radar.source_optional')})}
      </section>
    `) : nothing}
    ${radar.profile === 'cartesian_v1' && radar.xEntities.length < 8
      ? html`<button class="btn ghost" type="button" @click=${addTarget}>
          <ha-icon icon="mdi:plus"></ha-icon>${options.t('radar.add_target')}
        </button>` : nothing}
    ${radar.profile === 'polar_v1' ? html`
      ${radar.distanceEntities.map((distanceEntity, index) => html`
        <section class="hpf-profile-target">
        <div class="radartargetheading hpf-profile-target-heading">
          <strong>${options.t('radar.target', { n: index + 1 })}</strong>
          ${radar.distanceEntities.length > 1 ? html`<button class="btn ghost danger" type="button"
            title=${options.t('btn.delete')} @click=${() => removeTarget(index)}>
            ${options.st('marker.radar_remove_target',{n:index+1})}</button>` : nothing}
        </div>
        ${field({label:options.t('radar.distance_source'),control:entitySelect(distanceEntity, candidates.numeric,
          (value) => setStringAt('distanceEntities', index, value))})}
        ${field({label:options.t('radar.angle_source'),control:entitySelect(radar.angleEntities[index] || '', candidates.numeric,
          (value) => setStringAt('angleEntities', index, value))})}
        ${field({label:options.t('radar.presence_gate'),control:entitySelect(radar.slotPresenceEntities[index] || '', candidates.binary,
          (value) => setStringAt('slotPresenceEntities', index, value), 'radar.source_optional')})}
        </section>
      `)}
      ${radar.distanceEntities.length < 8 ? html`<button class="btn ghost" type="button"
        @click=${addTarget}><ha-icon icon="mdi:plus"></ha-icon>${options.t('radar.add_target')}</button>` : nothing}
      ${field({label:options.t('radar.angle_unit'),control:html`<hp-settings-select><select class="areasel" @change=${(event: Event) => change({
        angleUnit: (event.target as HTMLSelectElement).value as RadarEditorDraft['angleUnit'],
      })}>
        <option value="degrees" ?selected=${radar.angleUnit === 'degrees'}>${options.t('radar.degrees')}</option>
        <option value="radians" ?selected=${radar.angleUnit === 'radians'}>${options.t('radar.radians')}</option>
      </select></hp-settings-select>`})}
      ${field({label:options.t('radar.angle_zero'),control:html`<hp-settings-select><select class="areasel" @change=${(event: Event) => change({
        angleZero: (event.target as HTMLSelectElement).value as RadarEditorDraft['angleZero'],
      })}>
        <option value="forward" ?selected=${radar.angleZero === 'forward'}>${options.t('radar.angle_forward')}</option>
        <option value="right" ?selected=${radar.angleZero === 'right'}>${options.t('radar.angle_right')}</option>
      </select></hp-settings-select>`})}
      ${toggleRow({title:options.t('radar.angle_clockwise'),checked:radar.angleClockwise,onChange:angleClockwise=>change({angleClockwise})})}
    ` : nothing}
    ${radar.profile === 'range_v1' ? html`
      ${radar.rangeEntities.map((entityId, index) => html`
        <section class="hpf-profile-target">
        <div class="radartargetheading hpf-profile-target-heading">
          <strong>${options.t('radar.range_channel', { n: index + 1 })}</strong>
          ${radar.rangeEntities.length > 1 ? html`<button class="btn ghost danger" type="button"
            title=${options.t('btn.delete')} @click=${() => removeRange(index)}>
            ${options.st('marker.radar_remove_target',{n:index+1})}</button>` : nothing}
        </div>
        ${field({label:options.t('radar.distance_source'),control:entitySelect(entityId, candidates.numeric,
          (value) => setStringAt('rangeEntities', index, value))})}
        ${field({label:options.t('radar.presence_gate'),control:entitySelect(radar.rangePresenceEntities[index] || '', candidates.binary,
          (value) => setStringAt('rangePresenceEntities', index, value), 'radar.source_optional')})}
        </section>
      `)}
      ${radar.rangeEntities.length < 2 ? html`<button class="btn ghost" type="button"
        @click=${addRange}><ha-icon icon="mdi:plus"></ha-icon>${options.t('radar.add_range')}</button>` : nothing}
    ` : nothing}
    ${radar.profile === 'zones_v1' ? html`
      ${field({label:options.t('radar.zone_source'),control:entitySelect(radar.zoneEntity,
        radar.zoneKind === 'occupancy' ? candidates.binary : candidates.numeric,
        (zoneEntity) => change({ zoneEntity }))})}
      ${field({label:options.t('radar.profile'),control:html`<hp-settings-select><select class="areasel" @change=${(event: Event) => change({
        zoneKind: (event.target as HTMLSelectElement).value as 'occupancy' | 'count',
        zoneEntity: '',
      })}>
        <option value="occupancy" ?selected=${radar.zoneKind === 'occupancy'}>${options.t('radar.occupancy')}</option>
        <option value="count" ?selected=${radar.zoneKind === 'count'}>${options.t('radar.count')}</option>
      </select></hp-settings-select>`})}
    ` : nothing}
    ${subsection({title:options.st('marker.radar_sources')})}
    ${field({label:options.t('radar.occupancy_source'),control:entitySelect(radar.occupancyEntity, candidates.binary,
      (occupancyEntity) => change({ occupancyEntity }), 'radar.source_optional')})}
    ${field({label:options.t('radar.count_source'),control:entitySelect(radar.countEntity, candidates.numeric,
      (countEntity) => change({ countEntity }), 'radar.source_optional')})}
    ${field({label:options.t('radar.availability_source'),control:entitySelect(radar.availabilityEntity, candidates.binary,
      (availabilityEntity) => change({ availabilityEntity }), 'radar.source_optional')})}

    ${subsection({title:options.t('radar.mount')})}
    ${callout({text:options.t('radar.mount_hint')})}
    <div class="colorrow radarcoordinates">
      <label>X <input class="tempin" inputmode="decimal" .value=${radar.mountX}
        @input=${(event: Event) => change({ mountX: (event.target as HTMLInputElement).value })}></label>
      <label>Y <input class="tempin" inputmode="decimal" .value=${radar.mountY}
        @input=${(event: Event) => change({ mountY: (event.target as HTMLInputElement).value })}></label>
      <label>${options.t('radar.heading')} <input class="tempin" type="number" min="0" max="359.999" step="1"
        .value=${radar.heading} @input=${(event: Event) => change({ heading: (event.target as HTMLInputElement).value })}></label>
    </div>
    <div class="colorrow radarcoordinates">
      <label>${options.t('radar.range_cm')} <input class="tempin" type="number" min="1" max="10000"
        .value=${radar.rangeCm} @input=${(event: Event) => change({ rangeCm: (event.target as HTMLInputElement).value })}></label>
      <label>${options.t('radar.fov_deg')} <input class="tempin" type="number" min="1" max="360"
        .value=${radar.fovDeg} @input=${(event: Event) => change({ fovDeg: (event.target as HTMLInputElement).value })}></label>
    </div>
    ${radar.profile !== 'esphome_ld2450_v1' && radar.profile !== 'zones_v1'
      && radar.profile !== 'presence_v1' ? html`
      ${field({label:options.t('radar.unit'),control:html`<hp-settings-select><select class="areasel" @change=${(event: Event) => change({
        unit: (event.target as HTMLSelectElement).value as RadarEditorDraft['unit'],
      })}>${(['mm', 'cm', 'm', 'in', 'ft'] as const).map((unit) => html`
        <option value=${unit} ?selected=${unit === radar.unit}>${unit}</option>`)}</select></hp-settings-select>`})}
    ` : nothing}
    ${toggleRow({id:'marker-radar-mirror',title:options.t('radar.mirror'),checked:radar.mirror,onChange:(mirror)=>change({mirror})})}
    ${subsection({title:options.st('marker.radar_service')})}
    <div class="row hpf-actions">
      <button class="btn" type="button" @click=${() => configureOnPlan()}>
        <ha-icon icon="mdi:map-marker-radius"></ha-icon>${options.t('radar.configure_on_plan')}
      </button>
      ${radar.original ? html`<button class="btn ghost" type="button" @click=${changeInstallation}>
        <ha-icon icon="mdi:restart"></ha-icon>${options.t('radar.change_installation')}
      </button>` : nothing}
      <button class="btn" type="button" ?disabled=${radar.inspectBusy} @click=${inspect}>
        <ha-icon icon="mdi:radar"></ha-icon>
        ${radar.inspectBusy ? options.t('radar.checking') : options.t('radar.check_sources')}
      </button>
    </div>
    ${radar.inspectError ? html`<p class="error" role="alert">${radar.inspectError}</p>` : nothing}
    ${radar.inspection?.frame ? html`<div class="radarinspection" aria-live="polite">
      <strong>${options.t('radar.health')}</strong>
      <span>${options.t(`radar.health_${radar.inspection.frame.health || 'unknown'}` as I18nKey)}</span>
      <span>${options.t('radar.live_summary', {
        targets: radar.inspection.frame.targets?.length || 0,
        ranges: radar.inspection.frame.ranges?.length || 0,
      })}</span>
      ${(radar.inspection.sources || []).map((source) => {
        const age = typeof source.reported_at === 'number' && Number.isFinite(source.reported_at)
          ? Math.max(0, Math.round(Date.now() / 1000 - source.reported_at)) : null;
        return html`<code>${source.entity_id}: ${source.state ?? '—'}${age == null ? ''
          : ` · ${options.t('radar.report_age', { seconds: age })}`}</code>`;
      })}
    </div>` : nothing}
    ${options.setup.render()}
    <div class="row">
      <button class="btn danger" type="button" @click=${remove}>
        <ha-icon icon="mdi:radar-off"></ha-icon>${options.t('radar.remove')}
      </button>
    </div>
    </div>
    </fieldset>
  </div>`;
}
