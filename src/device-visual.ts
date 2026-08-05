/**
 * One semantic visual-state vocabulary for device markers.
 *
 * The renderer must never decide the yellow plate, the orange plate and the
 * activity ring from unrelated entities. This module classifies individual HA
 * entities and combines them; transition timing stays in the card because it
 * needs the previous hass snapshot and repaint timers.
 */
import { isAlarmState } from './logic';

export type DeviceAvailability = 'available' | 'unavailable';
export type DeviceStatus = 'neutral' | 'open' | 'working' | 'alarm';
export type DeviceActivity = 'none' | 'event' | 'presence' | 'transition' | 'running';
export type ActivityEdge = 'none' | 'rising' | 'change' | 'terminal_transition';

export interface EntityVisualSample {
  eid: string;
  state: string;
  availability: DeviceAvailability;
  status: DeviceStatus;
  activity: DeviceActivity;
  edge: ActivityEdge;
}

export interface DeviceVisualState {
  availability: DeviceAvailability;
  status: DeviceStatus;
  activity: DeviceActivity;
}

const ALARM_STATUS: DeviceVisualState = {
  availability: 'available', status: 'alarm', activity: 'none',
};

const EVENT_BINARY_CLASSES = new Set(['motion', 'vibration', 'sound']);
const PRESENCE_BINARY_CLASSES = new Set(['occupancy', 'presence']);
const CONTACT_BINARY_CLASSES = new Set(['door', 'window', 'garage_door', 'opening']);
const RUNNING_BINARY_CLASSES = new Set(['running', 'power']);

/** States that describe real work, not a selected mode or mere availability. */
const WORKING_STATES = new Set([
  'running', 'working', 'washing', 'rinsing', 'spinning', 'drying', 'heating',
  'cooling', 'cleaning', 'cooking', 'playing', 'recording', 'pumping',
  'irrigating', 'humidifying', 'dehumidifying', 'fan',
]);

const IDLE_STATES = new Set([
  'off', 'idle', 'paused', 'standby', 'docked', 'finished', 'complete',
  'completed', 'stopped', 'ready', 'sleeping',
]);

const unavailable = (state: string): boolean =>
  state === '' || state === 'unknown' || state === 'unavailable' || state === '__missing__';

const lower = (v: unknown): string => String(v ?? '').trim().toLowerCase();

/** Best actual-work attribute exposed by climate/appliance integrations. */
function workAction(attrs: any): string {
  for (const key of ['hvac_action', 'action', 'current_operation', 'run_state', 'job_state', 'operation', 'activity']) {
    const v = lower(attrs?.[key]);
    if (v) return v;
  }
  return '';
}

/** Classify one entity without looking at previous state. */
export function entityVisualSample(hass: any, eid: string): EntityVisualSample {
  const st = hass?.states?.[eid];
  const state = st ? lower(st.state) : '__missing__';
  const domain = String(eid || '').split('.')[0];
  const dc = lower(st?.attributes?.device_class);
  const base: EntityVisualSample = {
    eid, state,
    availability: unavailable(state) ? 'unavailable' : 'available',
    status: 'neutral', activity: 'none', edge: 'none',
  };
  if (base.availability === 'unavailable') return base;

  if (isAlarmState(domain, dc, state)) {
    return { ...base, status: 'alarm' };
  }

  if (domain === 'binary_sensor') {
    if (EVENT_BINARY_CLASSES.has(dc)) return { ...base, edge: 'rising' };
    if (PRESENCE_BINARY_CLASSES.has(dc))
      return { ...base, activity: state === 'on' ? 'presence' : 'none' };
    if (CONTACT_BINARY_CLASSES.has(dc))
      return { ...base, status: state === 'on' ? 'open' : 'neutral', edge: 'rising' };
    if (dc === 'moving')
      return { ...base, activity: state === 'on' ? 'transition' : 'none' };
    if (RUNNING_BINARY_CLASSES.has(dc))
      return state === 'on'
        ? { ...base, status: 'working', activity: 'running' }
        : base;
    return base;
  }

  if (domain === 'cover') {
    return {
      ...base,
      // Covers deliberately stay neutral: open/closed is the icon morph's job.
      activity: state === 'opening' || state === 'closing' ? 'transition' : 'none',
      edge: 'terminal_transition',
    };
  }

  if (domain === 'lock') {
    return {
      ...base,
      status: state === 'unlocked' || state === 'open' ? 'open' : 'neutral',
      activity: state === 'locking' || state === 'unlocking' ? 'transition' : 'none',
      edge: 'terminal_transition',
    };
  }

  if (domain === 'valve') {
    return {
      ...base,
      status: ['open', 'opening', 'closing'].includes(state) ? 'open' : 'neutral',
      activity: state === 'opening' || state === 'closing' ? 'transition' : 'none',
      edge: 'terminal_transition',
    };
  }

  if (domain === 'climate') {
    const action = workAction(st.attributes);
    return WORKING_STATES.has(action)
      ? { ...base, status: 'working', activity: 'running' }
      : base;
  }

  if (['light', 'switch', 'fan', 'humidifier'].includes(domain)) {
    return state === 'on'
      ? { ...base, status: 'working', activity: 'running' }
      : base;
  }

  if (domain === 'media_player') {
    return state === 'playing'
      ? { ...base, status: 'working', activity: 'running' }
      : base;
  }

  if (domain === 'vacuum') {
    if (state === 'cleaning') return { ...base, status: 'working', activity: 'running' };
    if (state === 'returning') return { ...base, status: 'working', activity: 'transition' };
    return base;
  }

  // A script stays `on` while it is executing. An automation's `on` means
  // enabled, not running, so it must remain neutral (a witnessed manual run is
  // surfaced as a short event by the card's service-call path instead).
  if (domain === 'script') {
    return state === 'on'
      ? { ...base, status: 'working', activity: 'running' }
      : base;
  }

  if (domain === 'automation') return base;

  if (domain === 'button' || domain === 'event') return { ...base, edge: 'change' };

  const action = workAction(st.attributes);
  if (WORKING_STATES.has(action) || (WORKING_STATES.has(state) && !IDLE_STATES.has(state))) {
    return { ...base, status: 'working', activity: 'running' };
  }
  return base;
}

/** Combine the entities that jointly describe one marker. */
export function combineVisualSamples(samples: EntityVisualSample[]): DeviceVisualState {
  if (!samples.length) return { availability: 'available', status: 'neutral', activity: 'none' };
  const available = samples.filter((s) => s.availability === 'available');
  if (!available.length) return { availability: 'unavailable', status: 'neutral', activity: 'none' };
  if (available.some((s) => s.status === 'alarm')) return ALARM_STATUS;

  const status: DeviceStatus = available.some((s) => s.status === 'working')
    ? 'working'
    : available.some((s) => s.status === 'open') ? 'open' : 'neutral';
  const activity: DeviceActivity = available.some((s) => s.activity === 'transition')
    ? 'transition'
    : available.some((s) => s.activity === 'presence')
      ? 'presence'
      : available.some((s) => s.activity === 'running') ? 'running' : 'none';
  return { availability: 'available', status, activity };
}

const validEdgeState = (s: string | undefined): boolean =>
  !!s && !unavailable(s);

/** Translate a witnessed state edge into the short-lived activity it starts. */
export function edgeActivity(
  previous: string | undefined,
  current: EntityVisualSample,
): 'event' | 'transition' | null {
  if (!validEdgeState(previous) || current.availability === 'unavailable' || previous === current.state) return null;
  if (current.edge === 'rising') return previous === 'off' && current.state === 'on' ? 'event' : null;
  if (current.edge === 'change') return 'event';
  if (current.edge === 'terminal_transition') {
    const pair = new Set([previous, current.state]);
    if ((pair.has('closed') && pair.has('open')) || (pair.has('locked') && pair.has('unlocked')))
      return 'transition';
  }
  return null;
}
