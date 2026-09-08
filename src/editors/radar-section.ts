/** Lazy Device-editor surface for Stage-1 presence radars (#485). */
import { html, nothing, type TemplateResult } from 'lit';

import type { I18nKey } from '../i18n';
import {
  radarConfigFromDraft, radarDraft, radarSourceCandidates, recognizeRadar,
  type RadarEditorDraft, type RadarHassLike,
} from '../radar-editor';
import type { RadarSetupController } from '../radar-setup';
import type { DevItem, SpaceModel } from '../types';

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
  position(device: DevItem): { x: number; y: number };
  updateDialog(patch: Partial<{
    radar: RadarEditorDraft | null;
    radarEligible: boolean;
    radarTouched: boolean;
    radarRemove: boolean;
  }>): void;
  dialogDeviceId(): string | undefined;
  t(key: I18nKey, vars?: Record<string, string | number>): string;
  help(key: 'radar.help'): TemplateResult | typeof nothing;
  boolInput(value: boolean, change: (value: boolean) => void): TemplateResult;
  toast(message: string): void;
  setup: RadarSetupController;
  configRev: number;
}

/** Rendered from the lazy editor chunk; ordinary View never loads this file. */
export function renderRadarSection(options: RadarSectionOptions): TemplateResult {
  const { dialog: d, device } = options;
  if (!device) return html``;
  options.setup.syncMarker(device.marker?.id || device.id);
  const recognition = recognizeRadar(device, options.registryHass);
  const savedUnsupported = recognition.reason === 'saved_unsupported';
  const remove = () => options.updateDialog({
    radar: null, radarTouched: true, radarRemove: true,
  });
  if ((!d.radar || d.radarRemove) && options.setup.isActive()) options.setup.reset();
  if (savedUnsupported || d.bindingMode === 'virtual' && !!device.marker?.radar) {
    return html`<fieldset class="markerlightgroup radargroup">
      <legend>${options.t('radar.title')}</legend>
      <p class="muted">${options.t('radar.saved_unsupported')}</p>
      <div class="row">
        <button class="btn danger" type="button" @click=${remove}>
          <ha-icon icon="mdi:radar-off"></ha-icon>${options.t('radar.remove')}
        </button>
      </div>
    </fieldset>`;
  }
  if (d.bindingMode === 'virtual') return html``;
  const begin = () => {
    const space = options.spaceModelById(device.space) || options.currentSpace();
    if (!space) return;
    const point = options.position(device);
    const radar = radarDraft(device, space, [point.x, point.y], options.registryHass, true);
    if (!radar) return;
    options.updateDialog({
      radar, radarEligible: true, radarTouched: true, radarRemove: false,
    });
  };
  if (!d.radar || d.radarRemove) {
    if (recognition.eligible) {
      return html`<fieldset class="markerlightgroup radargroup">
        <legend>${options.t('radar.title')}</legend>
        <p class="muted">${options.t(recognition.reason === 'ld2450'
          ? 'radar.detected_ld2450' : 'radar.detected')}</p>
        <button class="btn" type="button" @click=${begin}>
          <ha-icon icon="mdi:radar"></ha-icon>${options.t('radar.configure')}
        </button>
      </fieldset>`;
    }
    return html`<details class="markerlightgroup radaradditional">
      <summary>${options.t('radar.additional_actions')}</summary>
      <button class="btn ghost" type="button" @click=${begin}>
        <ha-icon icon="mdi:radar"></ha-icon>${options.t('radar.declare')}
      </button>
    </details>`;
  }

  const radar = d.radar;
  const candidates = radarSourceCandidates(device, options.planHass);
  const entitySelect = (
    value: string,
    values: readonly string[],
    update: (value: string) => void,
    emptyKey: I18nKey = 'radar.source_choose',
  ) => html`<select class="areasel" @change=${(event: Event) =>
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
  </select>`;
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
  const configureOnPlan = () => {
    const room = roomOptions.find((candidate) => candidate.id === radar.roomId);
    if (!space || !room || !Array.isArray(room.poly) || room.poly.length < 3
        || !radarConfigFromDraft(radar, space.cellCm || 5)) {
      options.toast(options.t('radar.invalid'));
      return;
    }
    if (!options.setup.begin(
      device.marker?.id || device.id, radar, room, space.cellCm || 5, options.configRev,
    )) options.toast(options.t('radar.invalid'));
  };
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

  return html`<fieldset class="markerlightgroup radargroup">
    <legend><span>${options.t('radar.title')}</span>${options.help('radar.help')}</legend>
    <label class="srcrow">
      ${options.boolInput(radar.enabled, (enabled) => change({ enabled }, false))}
      <span>${options.t('radar.enabled')}</span>
    </label>
    <label class="srcrow">
      ${options.boolInput(radar.showLive, (showLive) => change({ showLive }, false))}
      <span>${options.t('radar.show_live')}</span>
    </label>
    <label for="radar-profile">${options.t('radar.profile')}</label>
    <select id="radar-profile" class="areasel" @change=${(event: Event) => change({
      profile: (event.target as HTMLSelectElement).value as RadarEditorDraft['profile'],
    })}>
      ${(['esphome_ld2450_v1', 'cartesian_v1', 'polar_v1', 'range_v1', 'zones_v1', 'presence_v1'] as const)
        .map((profile) => html`<option value=${profile} ?selected=${profile === radar.profile}>
          ${options.t(`radar.profile_${profile}` as I18nKey)}
        </option>`)}
    </select>
    <label for="radar-room">${options.t('radar.room')}</label>
    <select id="radar-room" class="areasel" @change=${(event: Event) => change({
      roomId: (event.target as HTMLSelectElement).value,
    })}>
      <option value="" ?selected=${!radar.roomId}>${options.t('radar.room_choose')}</option>
      ${roomOptions.map((room) => html`<option value=${room.id || ''}
        ?selected=${room.id === radar.roomId}>${room.name}</option>`)}
    </select>

    ${coordinateProfile ? radar.xEntities.map((xEntity, index) => html`
      <div class="radartargetheading">
        <strong>${options.t('radar.target', { n: index + 1 })}</strong>
        ${radar.profile === 'cartesian_v1' && radar.xEntities.length > 1
          ? html`<button class="iconbtn" type="button" title=${options.t('btn.delete')}
              @click=${() => removeTarget(index)}><ha-icon icon="mdi:close"></ha-icon></button>`
          : nothing}
      </div>
      <label>${options.t('radar.axis_x')}</label>
      ${entitySelect(xEntity, candidates.numeric, (value) => setAxis('xEntities', index, value))}
      <label>${options.t('radar.axis_y')}</label>
      ${entitySelect(radar.yEntities[index] || '', candidates.numeric,
        (value) => setAxis('yEntities', index, value))}
      ${radar.profile === 'cartesian_v1' ? html`
        <label class="srcrow">
          ${options.boolInput(radar.swapXY[index] === true,
            (value) => setBoolAt('swapXY', index, value))}
          <span>${options.t('radar.swap_axes')}</span>
        </label>
        <div class="colorrow radarcoordinates">
          <label>${options.t('radar.axis_x_sign')}<select class="areasel"
            @change=${(event: Event) => setSignAt('xSigns', index,
              Number((event.target as HTMLSelectElement).value) === -1 ? -1 : 1)}>
            <option value="1" ?selected=${radar.xSigns[index] !== -1}>+1</option>
            <option value="-1" ?selected=${radar.xSigns[index] === -1}>−1</option>
          </select></label>
          <label>${options.t('radar.axis_y_sign')}<select class="areasel"
            @change=${(event: Event) => setSignAt('ySigns', index,
              Number((event.target as HTMLSelectElement).value) === -1 ? -1 : 1)}>
            <option value="1" ?selected=${radar.ySigns[index] !== -1}>+1</option>
            <option value="-1" ?selected=${radar.ySigns[index] === -1}>−1</option>
          </select></label>
        </div>
      ` : nothing}
      <label>${options.t('radar.presence_gate')}</label>
      ${entitySelect(radar.slotPresenceEntities[index] || '', candidates.binary,
        (value) => setStringAt('slotPresenceEntities', index, value), 'radar.source_optional')}
    `) : nothing}
    ${radar.profile === 'cartesian_v1' && radar.xEntities.length < 8
      ? html`<button class="btn ghost" type="button" @click=${addTarget}>
          <ha-icon icon="mdi:plus"></ha-icon>${options.t('radar.add_target')}
        </button>` : nothing}
    ${radar.profile === 'polar_v1' ? html`
      ${radar.distanceEntities.map((distanceEntity, index) => html`
        <div class="radartargetheading">
          <strong>${options.t('radar.target', { n: index + 1 })}</strong>
          ${radar.distanceEntities.length > 1 ? html`<button class="iconbtn" type="button"
            title=${options.t('btn.delete')} @click=${() => removeTarget(index)}>
            <ha-icon icon="mdi:close"></ha-icon></button>` : nothing}
        </div>
        <label>${options.t('radar.distance_source')}</label>
        ${entitySelect(distanceEntity, candidates.numeric,
          (value) => setStringAt('distanceEntities', index, value))}
        <label>${options.t('radar.angle_source')}</label>
        ${entitySelect(radar.angleEntities[index] || '', candidates.numeric,
          (value) => setStringAt('angleEntities', index, value))}
        <label>${options.t('radar.presence_gate')}</label>
        ${entitySelect(radar.slotPresenceEntities[index] || '', candidates.binary,
          (value) => setStringAt('slotPresenceEntities', index, value), 'radar.source_optional')}
      `)}
      ${radar.distanceEntities.length < 8 ? html`<button class="btn ghost" type="button"
        @click=${addTarget}><ha-icon icon="mdi:plus"></ha-icon>${options.t('radar.add_target')}</button>` : nothing}
      <label>${options.t('radar.angle_unit')}</label>
      <select class="areasel" @change=${(event: Event) => change({
        angleUnit: (event.target as HTMLSelectElement).value as RadarEditorDraft['angleUnit'],
      })}>
        <option value="degrees" ?selected=${radar.angleUnit === 'degrees'}>${options.t('radar.degrees')}</option>
        <option value="radians" ?selected=${radar.angleUnit === 'radians'}>${options.t('radar.radians')}</option>
      </select>
      <label>${options.t('radar.angle_zero')}</label>
      <select class="areasel" @change=${(event: Event) => change({
        angleZero: (event.target as HTMLSelectElement).value as RadarEditorDraft['angleZero'],
      })}>
        <option value="forward" ?selected=${radar.angleZero === 'forward'}>${options.t('radar.angle_forward')}</option>
        <option value="right" ?selected=${radar.angleZero === 'right'}>${options.t('radar.angle_right')}</option>
      </select>
      <label class="srcrow">
        ${options.boolInput(radar.angleClockwise, (angleClockwise) => change({ angleClockwise }))}
        <span>${options.t('radar.angle_clockwise')}</span>
      </label>
    ` : nothing}
    ${radar.profile === 'range_v1' ? html`
      ${radar.rangeEntities.map((entityId, index) => html`
        <div class="radartargetheading">
          <strong>${options.t('radar.range_channel', { n: index + 1 })}</strong>
          ${radar.rangeEntities.length > 1 ? html`<button class="iconbtn" type="button"
            title=${options.t('btn.delete')} @click=${() => removeRange(index)}>
            <ha-icon icon="mdi:close"></ha-icon></button>` : nothing}
        </div>
        <label>${options.t('radar.distance_source')}</label>
        ${entitySelect(entityId, candidates.numeric,
          (value) => setStringAt('rangeEntities', index, value))}
        <label>${options.t('radar.presence_gate')}</label>
        ${entitySelect(radar.rangePresenceEntities[index] || '', candidates.binary,
          (value) => setStringAt('rangePresenceEntities', index, value), 'radar.source_optional')}
      `)}
      ${radar.rangeEntities.length < 2 ? html`<button class="btn ghost" type="button"
        @click=${addRange}><ha-icon icon="mdi:plus"></ha-icon>${options.t('radar.add_range')}</button>` : nothing}
    ` : nothing}
    ${radar.profile === 'zones_v1' ? html`
      <label>${options.t('radar.zone_source')}</label>
      ${entitySelect(radar.zoneEntity,
        radar.zoneKind === 'occupancy' ? candidates.binary : candidates.numeric,
        (zoneEntity) => change({ zoneEntity }))}
      <select class="areasel" @change=${(event: Event) => change({
        zoneKind: (event.target as HTMLSelectElement).value as 'occupancy' | 'count',
        zoneEntity: '',
      })}>
        <option value="occupancy" ?selected=${radar.zoneKind === 'occupancy'}>${options.t('radar.occupancy')}</option>
        <option value="count" ?selected=${radar.zoneKind === 'count'}>${options.t('radar.count')}</option>
      </select>
    ` : nothing}
    <label>${options.t('radar.occupancy_source')}</label>
    ${entitySelect(radar.occupancyEntity, candidates.binary,
      (occupancyEntity) => change({ occupancyEntity }), 'radar.source_optional')}
    <label>${options.t('radar.count_source')}</label>
    ${entitySelect(radar.countEntity, candidates.numeric,
      (countEntity) => change({ countEntity }), 'radar.source_optional')}
    <label>${options.t('radar.availability_source')}</label>
    ${entitySelect(radar.availabilityEntity, candidates.binary,
      (availabilityEntity) => change({ availabilityEntity }), 'radar.source_optional')}

    <label class="dispsection">${options.t('radar.mount')}</label>
    <p class="muted">${options.t('radar.mount_hint')}</p>
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
      <label>${options.t('radar.unit')}</label>
      <select class="areasel" @change=${(event: Event) => change({
        unit: (event.target as HTMLSelectElement).value as RadarEditorDraft['unit'],
      })}>${(['mm', 'cm', 'm', 'in', 'ft'] as const).map((unit) => html`
        <option value=${unit} ?selected=${unit === radar.unit}>${unit}</option>`)}</select>
    ` : nothing}
    <label class="srcrow">
      ${options.boolInput(radar.mirror, (mirror) => change({ mirror }))}
      <span>${options.t('radar.mirror')}</span>
    </label>
    <div class="row">
      <button class="btn" type="button" @click=${configureOnPlan}>
        <ha-icon icon="mdi:map-marker-radius"></ha-icon>${options.t('radar.configure_on_plan')}
      </button>
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
      ${(radar.inspection.sources || []).map((source) => html`<code>
        ${source.entity_id}: ${source.state ?? '—'}
      </code>`)}
    </div>` : nothing}
    ${options.setup.render()}
    <div class="row">
      <button class="btn danger" type="button" @click=${remove}>
        <ha-icon icon="mdi:radar-off"></ha-icon>${options.t('radar.remove')}
      </button>
    </div>
  </fieldset>`;
}
