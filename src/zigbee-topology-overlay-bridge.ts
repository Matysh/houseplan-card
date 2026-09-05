import { html, nothing, type TemplateResult } from 'lit';
import { zigbeeTopologySettingsOf } from './zigbee-topology-settings';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';
import type { ZigbeeTopologyHass } from './zigbee-topology-runtime';

export function renderZigbeeTopologyOverlay(input: {
  hass: ZigbeeTopologyHass;
  settings: unknown;
  devices: readonly DevItem[];
  registry: HaRegistrySnapshot;
  currentSpace: string;
  viewKey: unknown;
  view: boolean;
  kiosk: boolean;
}): TemplateResult | typeof nothing {
  if (!input.view || input.kiosk || input.hass?.user?.is_admin !== true
      || !zigbeeTopologySettingsOf(input.settings).enabled) return nothing;
  void import('./hp-zigbee-topology-overlay');
  return html`<hp-zigbee-topology-overlay data-hp-live-layer="camera" .hass=${input.hass} .devices=${input.devices}
    .registry=${input.registry} .currentSpace=${input.currentSpace} .viewKey=${input.viewKey}></hp-zigbee-topology-overlay>`;
}
