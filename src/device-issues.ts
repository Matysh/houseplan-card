/** Current device signals. Metadata identifies semantics; names never do. */
import { isAlarmState } from './logic';

export type DeviceIssueReason = 'machine_care' | 'machine_care_filter' | 'filter_cleaning'
  | 'problem' | 'smoke' | 'gas' | 'carbon_monoxide' | 'moisture' | 'safety' | 'tamper'
  | 'siren' | 'alarm_panel' | 'threshold';
/** Producer identity is independent from HA entity identity. No external producer yet. */
export interface DeviceIssueCause { type: 'native' | 'threshold' | 'external'; id: string; level: 'attention' | 'alarm' | 'maintenance' }
export interface DeviceIssueSignal {
  severity: 'alarm' | 'attention' | 'maintenance';
  reason: DeviceIssueReason;
}
export interface ResolvedDeviceIssue extends DeviceIssueSignal {
  cause?: DeviceIssueCause;
  explanation?: string;
  groupTitle?: string;
  eid: string;
  name: string;
  state: string;
  stateText: string;
  deviceClass: string;
  integrationDomain: string | null;
}
interface IssueRegistry {
  platform?: unknown;
  translation_key?: unknown;
  unique_id?: unknown;
}

// Home Connect Local 1.12.5, dishcare.py. These event descriptions are service
// reminders even though HA calls them problem. AquaStop/pump faults are not here.
const MAINTENANCE: Readonly<Record<string, DeviceIssueReason>> = {
  binary_sensor_machinecarereminder: 'machine_care',
  binary_sensor_machinecareandfiltercleaningreminder: 'machine_care_filter',
  binary_sensor_smartfiltercleaningreminder: 'filter_cleaning',
};
const ALARMS: Readonly<Record<string, DeviceIssueReason>> = {
  problem: 'problem', smoke: 'smoke', gas: 'gas', carbon_monoxide: 'carbon_monoxide',
  moisture: 'moisture', safety: 'safety', tamper: 'tamper',
};
const lower = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function classifyDeviceIssue(
  eid: string, rawState: unknown, rawClass: unknown, registry?: IssueRegistry,
): DeviceIssueSignal | null {
  const domain = eid.split('.')[0], state = lower(rawState), dc = lower(rawClass);
  if (!isAlarmState(domain, dc, state)) return null;
  if (domain === 'binary_sensor' && dc === 'problem' && registry?.platform === 'homeconnect_ws') {
    const key = registry.translation_key;
    const uniqueId = registry.unique_id;
    const reason = typeof key === 'string' && key
      ? Object.prototype.hasOwnProperty.call(MAINTENANCE, key) ? MAINTENANCE[key] : null
      : typeof uniqueId === 'string'
        ? Object.entries(MAINTENANCE).find(([suffix]) =>
            uniqueId.length > suffix.length + 1 && uniqueId.endsWith(`-${suffix}`))?.[1]
        : null;
    if (reason) return { severity: 'maintenance', reason };
  }
  return { severity: 'alarm', reason: domain === 'siren' ? 'siren'
    : domain === 'alarm_control_panel' ? 'alarm_panel' : ALARMS[dc] || 'problem' };
}
