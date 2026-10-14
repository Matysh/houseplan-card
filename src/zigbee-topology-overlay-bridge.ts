import { html, nothing, type TemplateResult } from 'lit';
import { zigbeeTopologySettingsOf } from './zigbee-topology-settings';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';
import type { ZigbeeTopologyHass } from './zigbee-topology-runtime';

export interface ZigbeeOverlayEligibility {
  hass: ZigbeeTopologyHass;
  settings: unknown;
  view: boolean;
  kiosk: boolean;
}
export function zigbeeTopologyOverlayRequested(input: ZigbeeOverlayEligibility): boolean {
  return input.view && !input.kiosk && input.hass?.user?.is_admin === true
    && zigbeeTopologySettingsOf(input.settings).enabled;
}

export function renderZigbeeTopologyOverlay(input: ZigbeeOverlayEligibility & {
  devices: readonly DevItem[];
  registry: HaRegistrySnapshot;
  currentSpace: string;
  spaces?: readonly { id?: unknown; title?: unknown }[];
  viewKey: unknown;
  zoom: number;
  onLayout?: () => void;
  ready: boolean;
}): TemplateResult | typeof nothing {
  if (!input.ready || !zigbeeTopologyOverlayRequested(input)) return nothing;
  return html`<hp-zigbee-topology-overlay aria-hidden="true" .hass=${input.hass} .devices=${input.devices}
    .registry=${input.registry} .currentSpace=${input.currentSpace} .spaces=${input.spaces}
    .viewKey=${input.viewKey} .zoom=${input.zoom} .onLayout=${input.onLayout}></hp-zigbee-topology-overlay>`;
}
