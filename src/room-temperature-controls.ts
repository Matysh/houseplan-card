import { html, nothing, type TemplateResult } from 'lit';
import { roomTempThresholdDraft, strictNumber } from './space-dialog';

interface RoomTemperatureControlsHost {
  _roomTempMin: string;
  _roomTempMax: string;
  _t: (key: any) => string;
  requestUpdate: () => unknown;
}

export interface RoomTemperatureControls {
  valid: boolean;
  template: TemplateResult | typeof nothing;
}

/** Lazy-editor UI for the optional per-room comfort bounds. */
export function roomTemperatureControls(
  host: RoomTemperatureControlsHost,
  effectiveFill: string,
  spaceMin: number,
  spaceMax: number,
  help: TemplateResult | typeof nothing,
): RoomTemperatureControls {
  const draft = roomTempThresholdDraft(host._roomTempMin, host._roomTempMax);
  if (effectiveFill !== 'temp') return { valid: draft.valid, template: nothing };
  const minInvalid = host._roomTempMin.trim() !== '' && strictNumber(host._roomTempMin) === null;
  const maxInvalid = host._roomTempMax.trim() !== '' && strictNumber(host._roomTempMax) === null;
  return {
    valid: draft.valid,
    template: html`<div class="roomtemprange">
      <div class="roomtemprange-head">
        <label>${host._t('room.temp_range_label')}</label>
        ${help}
      </div>
      <div class="roomtemprange-fields">
        <input class="namein" type="number" step="0.5"
          aria-label=${host._t('room.temp_range_min')}
          aria-invalid=${minInvalid ? 'true' : 'false'}
          placeholder=${String(spaceMin)} .value=${host._roomTempMin}
          @input=${(e: Event) => {
            host._roomTempMin = (e.target as HTMLInputElement).value;
            host.requestUpdate();
          }} />
        <span aria-hidden="true">—</span>
        <input class="namein" type="number" step="0.5"
          aria-label=${host._t('room.temp_range_max')}
          aria-invalid=${maxInvalid ? 'true' : 'false'}
          placeholder=${String(spaceMax)} .value=${host._roomTempMax}
          @input=${(e: Event) => {
            host._roomTempMax = (e.target as HTMLInputElement).value;
            host.requestUpdate();
          }} />
        <span>°C</span>
        ${host._roomTempMin.trim() || host._roomTempMax.trim()
          ? html`<button class="btn ghost" type="button" @click=${() => {
              host._roomTempMin = '';
              host._roomTempMax = '';
              host.requestUpdate();
            }}>${host._t('room.temp_range_reset')}</button>`
          : nothing}
      </div>
    </div>`,
  };
}
