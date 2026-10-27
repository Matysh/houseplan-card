/** Comparator and editor operand parser: optional View/editor feature only. */
import { ALERT_TEXT_LIMIT, type MarkerThresholdAlert, type AlertOperator } from './marker-alert-config';
export * from './marker-alert-config';
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && [...value].length <= ALERT_TEXT_LIMIT && !/[\r\n]/.test(value);
const NUMBER = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
/** Full finite parse, never a numeric prefix or a unit/thousands conversion. */
export function alertNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !NUMBER.test(value.trim())) return null;
  const result = Number(value.trim().replace(',', '.'));
  return Number.isFinite(result) ? result : null;
}

/** UI parsing is explicit: enumerated HA states always remain literal strings. */
export function alertOperand(raw: string, operator: AlertOperator, enumerated = false): number | string | null {
  if (enumerated) return (operator === 'eq' || operator === 'ne') && text(raw) ? raw : null;
  const number = alertNumber(raw);
  if (number !== null) return number;
  return (operator === 'eq' || operator === 'ne') && text(raw) ? raw : null;
}

/** Null is incomparable; in particular, ne never turns missing data into alarm. */
export function evaluateMarkerAlert(rule: MarkerThresholdAlert, raw: unknown): boolean | null {
  let actual: number | string;
  if (typeof rule.value === 'number') {
    const number = alertNumber(raw);
    if (number === null) return null;
    actual = number;
  } else {
    if (typeof raw !== 'string' || raw === '') return null;
    actual = raw;
  }
  if (rule.operator === 'eq') return actual === rule.value;
  if (rule.operator === 'ne') return actual !== rule.value;
  if (typeof actual !== 'number' || typeof rule.value !== 'number') return null;
  switch (rule.operator) {
    case 'gt': return actual > rule.value;
    case 'lt': return actual < rule.value;
    case 'ge': return actual >= rule.value;
    case 'le': return actual <= rule.value;
  }
}
