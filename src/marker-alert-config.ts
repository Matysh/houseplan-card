/** Persisted #1000 conditions. Runtime state and HA authority never live here. */
export type AlertLevel = 'attention' | 'alarm';
export type AlertOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le';
export interface MarkerThresholdAlert {
  id: string;
  type: 'threshold';
  level: AlertLevel;
  entity_id: string;
  attribute?: string;
  operator: AlertOperator;
  value: number | string;
}

export const MAX_MARKER_ALERTS = 3;
export const ALERT_TEXT_LIMIT = 255;
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
const ENTITY = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const OPERATORS: ReadonlySet<unknown> = new Set(['eq', 'ne', 'gt', 'lt', 'ge', 'le']);
const KEYS = new Set(['id', 'type', 'level', 'entity_id', 'attribute', 'operator', 'value']);
const text = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && [...value].length <= ALERT_TEXT_LIMIT && !/[\r\n]/.test(value);

/** Closed shape for new edits. Callers preserve unchanged opaque future data. */
export function normalizeMarkerAlert(raw: unknown): MarkerThresholdAlert | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const own = (key: string) => Object.prototype.hasOwnProperty.call(item, key);
  const attribute = own('attribute') ? item.attribute : undefined;
  if (Object.keys(item).some(key => !KEYS.has(key))
    || !['id', 'type', 'level', 'entity_id', 'operator', 'value'].every(own)
    || typeof item.id !== 'string' || !ID.test(item.id) || item.type !== 'threshold'
    || item.level !== 'attention' && item.level !== 'alarm'
    || typeof item.entity_id !== 'string' || [...item.entity_id].length > ALERT_TEXT_LIMIT || !ENTITY.test(item.entity_id)
    || own('attribute') && (!text(attribute) || !attribute.trim())
    || !OPERATORS.has(item.operator)) return null;
  const value = item.value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) return null; }
  else if (!text(value)) return null;
  if (typeof value === 'string' && item.operator !== 'eq' && item.operator !== 'ne') return null;
  return { id: item.id, type: 'threshold', level: item.level, entity_id: item.entity_id,
    ...(typeof attribute === 'string' ? { attribute } : {}),
    operator: item.operator as AlertOperator, value };
}

export function normalizeMarkerAlerts(raw: unknown): MarkerThresholdAlert[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MARKER_ALERTS) return null;
  const result: MarkerThresholdAlert[] = [], ids = new Set<string>();
  for (const value of raw) {
    const item = normalizeMarkerAlert(value);
    if (!item || ids.has(item.id)) return null;
    ids.add(item.id); result.push(item);
  }
  return result;
}

