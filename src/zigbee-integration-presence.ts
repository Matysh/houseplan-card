import type { IntegrationMetadataSnapshot } from './integration-provider';
import type { HaRegistrySnapshot } from './ha-binding-status';

export type IntegrationPresence = 'present' | 'absent' | 'unknown';
/** MQTT alone does not prove Zigbee2MQTT; failed discovery never proves absence. */
export function zigbeeIntegrationPresence(
  metadata: IntegrationMetadataSnapshot, registry?: HaRegistrySnapshot,
): { zha: IntegrationPresence; z2m: IntegrationPresence } {
  const ignored = new Set(Object.entries(metadata.configEntries).filter(([,entry]) => entry.source === 'ignore').map(([id]) => id));
  const entries = (Object.values(metadata.configEntries) as Record<string, unknown>[]).filter(entry => entry.source !== 'ignore');
  const entities = (Object.values(registry?.entities || {}) as Record<string, unknown>[])
    .filter(entity => !ignored.has(String(entity.config_entry_id || '')));
  const devices = (Object.values(registry?.devices || {}) as Record<string, unknown>[])
    .filter(device => !Array.isArray(device.config_entries) || !device.config_entries.length || !device.config_entries.every(id => ignored.has(String(id))));
  const zha = entries.some(entry => entry.domain === 'zha') || entities.some(entity => entity.platform === 'zha');
  const bridge = devices.some(device => /zigbee2mqtt/i.test([
    device.name, device.name_by_user, device.model, device.manufacturer, JSON.stringify(device.identifiers || []),
  ].join(' ')));
  const mqtt = entries.some(entry => entry.domain === 'mqtt') || entities.some(entity => entity.platform === 'mqtt');
  return {
    zha: zha ? 'present' : metadata.entriesAvailable ? 'absent' : 'unknown',
    z2m: bridge ? 'present' : metadata.entriesAvailable && registry?.authoritative && !mqtt ? 'absent' : 'unknown',
  };
}
