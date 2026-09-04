export interface ZigbeeTopologySettings {
  enabled: boolean;
  z2mBaseTopics: string[];
}

const EMPTY_SETTINGS: ZigbeeTopologySettings = Object.freeze({
  enabled: false,
  z2mBaseTopics: Object.freeze([]) as unknown as string[],
});

/** MQTT topic names are exact paths. Wildcards/control characters are unsafe here. */
export function normalizeZ2mBaseTopic(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const topic = value.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
  if (!topic || topic.length > 180 || /[#+\u0000-\u001f\u007f]/.test(topic)) return null;
  return topic;
}

export function zigbeeTopologySettingsOf(settings: unknown): ZigbeeTopologySettings {
  const raw = (settings as { zigbee_topology?: unknown } | null | undefined)?.zigbee_topology;
  if (!raw || typeof raw !== 'object') return EMPTY_SETTINGS;
  const source = raw as { enabled?: unknown; z2m_base_topics?: unknown; z2mBaseTopics?: unknown };
  const values = Array.isArray(source.z2m_base_topics)
    ? source.z2m_base_topics : Array.isArray(source.z2mBaseTopics) ? source.z2mBaseTopics : [];
  const seen = new Set<string>();
  const z2mBaseTopics: string[] = [];
  for (const value of values) {
    const topic = normalizeZ2mBaseTopic(value);
    if (!topic || seen.has(topic)) continue;
    seen.add(topic);
    z2mBaseTopics.push(topic);
    if (z2mBaseTopics.length === 8) break;
  }
  return { enabled: source.enabled === true, z2mBaseTopics };
}

export function writeZigbeeTopologySettings(
  settings: Record<string, unknown>, value: ZigbeeTopologySettings,
): Record<string, unknown> {
  const next = { ...settings };
  const topics = value.z2mBaseTopics.map(normalizeZ2mBaseTopic).filter(Boolean) as string[];
  if (!value.enabled && !topics.length) delete next.zigbee_topology;
  else next.zigbee_topology = { enabled: value.enabled === true, z2m_base_topics: [...new Set(topics)].slice(0, 8) };
  return next;
}
