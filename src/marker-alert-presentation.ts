/** Optional producer adapter. Native, threshold and future external causes share levels. */
import type { ConfirmedMarkerAlert } from './marker-alert-runtime';
import type { ResolvedDeviceIssue } from './device-issues';
import { alertT } from './i18n/alerts';
import type { Lang } from './i18n';

export const ALERT_OPERATOR_LABELS = { eq: '=', ne: '≠', gt: '>', lt: '<', ge: '≥', le: '≤' } as const;
export const alertOperandText = (value: string | number): string => typeof value === 'string' ? JSON.stringify(value) : String(value);
export function thresholdIssues(rows: readonly ConfirmedMarkerAlert[], lang: Lang): ResolvedDeviceIssue[] {
  return rows.map(row => {
    const rule = row.rule;
    const operand = alertOperandText(rule.value);
    return { eid: rule.entity_id, name: row.name, state: row.value == null ? '' : String(row.value),
      stateText: row.comparable ? `${row.value}${typeof rule.value === 'number' && row.unit ? ` ${row.unit}` : ''}` : alertT(lang, 'unavailable'),
      deviceClass: '', integrationDomain: null, severity: rule.level, reason: 'threshold',
      cause: { type: 'threshold', id: row.key, level: rule.level },
      groupTitle: alertT(lang, rule.level),
      explanation: `${rule.attribute ? `${rule.attribute} ` : ''}${ALERT_OPERATOR_LABELS[rule.operator]} ${operand}${typeof rule.value === 'number' && row.unit ? ` ${row.unit}` : ''}`,
    };
  });
}
