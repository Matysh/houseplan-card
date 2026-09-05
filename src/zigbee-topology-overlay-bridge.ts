import { html, nothing, type TemplateResult } from 'lit';
import { zigbeeTopologySettingsOf } from './zigbee-topology-settings';
import type { HaRegistrySnapshot } from './ha-binding-status';
import type { DevItem } from './types';
import type { ZigbeeTopologyHass } from './zigbee-topology-runtime';

const spaceTitleMemo = new WeakMap<object, { signature: string; titles: Readonly<Record<string, string>> }>();

function spaceTitlesOf(spaces: readonly { id?: unknown; title?: unknown }[]): Readonly<Record<string, string>> {
  const signature = spaces.map((space) => `${String(space.id)}\u0000${String(space.title)}`).join('\u0001');
  const cached = spaceTitleMemo.get(spaces);
  if (cached?.signature === signature) return cached.titles;
  const projected = Object.fromEntries(spaces.flatMap((space) => (
    typeof space.id === 'string' && typeof space.title === 'string'
      ? [[space.id, space.title] as const] : []
  )));
  spaceTitleMemo.set(spaces, { signature, titles: projected });
  return projected;
}

export function renderZigbeeTopologyOverlay(input: {
  hass: ZigbeeTopologyHass;
  settings: unknown;
  devices: readonly DevItem[];
  registry: HaRegistrySnapshot;
  currentSpace: string;
  spaces: readonly { id?: unknown; title?: unknown }[];
  viewKey: unknown;
  view: boolean;
  kiosk: boolean;
}): TemplateResult | typeof nothing {
  if (!input.view || input.kiosk || input.hass?.user?.is_admin !== true
      || !zigbeeTopologySettingsOf(input.settings).enabled) return nothing;
  const spaceTitles = spaceTitlesOf(input.spaces);
  void import('./hp-zigbee-topology-overlay');
  return html`<hp-zigbee-topology-overlay data-hp-live-layer="camera" .hass=${input.hass} .devices=${input.devices}
    .registry=${input.registry} .currentSpace=${input.currentSpace} .spaceTitles=${spaceTitles}
    .viewKey=${input.viewKey}></hp-zigbee-topology-overlay>`;
}
