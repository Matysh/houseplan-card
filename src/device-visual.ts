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
const ALARM_BINARY_CLASSES = new Set([
  'smoke', 'gas', 'carbon_monoxide', 'moisture', 'safety', 'tamper', 'problem',
]);

/**
 * A binary entity whose state is a real device signal, not an arbitrary
 * vendor option. The device-level source resolver uses the same vocabulary as
 * entityVisualSample, so selection and rendering cannot drift apart.
 */
export function isSemanticBinaryEntity(hass: any, eid: string): boolean {
  if (!eid.startsWith('binary_sensor.')) return false;
  const dc = lower(
    hass?.states?.[eid]?.attributes?.device_class
    || hass?.entities?.[eid]?.device_class
    || hass?.entities?.[eid]?.original_device_class,
  );
  return EVENT_BINARY_CLASSES.has(dc)
    || PRESENCE_BINARY_CLASSES.has(dc)
    || CONTACT_BINARY_CLASSES.has(dc)
    || RUNNING_BINARY_CLASSES.has(dc)
    || dc === 'moving'
    || ALARM_BINARY_CLASSES.has(dc);
}

/** States that describe real work, not a selected mode or mere availability. */
const WORKING_STATES = new Set([
  'running', 'working', 'washing', 'rinsing', 'spinning', 'drying', 'heating',
  'cooling', 'cleaning', 'cooking', 'playing', 'recording', 'pumping',
  'irrigating', 'humidifying', 'dehumidifying', 'fan', 'preheating', 'defrosting',
]);

const IDLE_STATES = new Set([
  'off', 'idle', 'paused', 'standby', 'docked', 'finished', 'complete',
  'completed', 'stopped', 'ready', 'sleeping',
]);

/** Standard HA HVAC modes which mean the climate entity is enabled. The
 * entity's own `hvac_modes` attribute extends this set for integrations with
 * custom modes; `off`/idle states are always excluded. */
const CLIMATE_ENABLED_MODES = new Set([
  'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only',
]);

const unavailable = (state: string): boolean =>
  state === '' || state === 'unknown' || state === 'unavailable' || state === '__missing__';

const lower = (v: unknown): string => String(v ?? '').trim().toLowerCase();

/**
 * A dedicated whole-device power switch, as opposed to a relay whose `on`
 * state is the useful work itself. This uses generic HA registry/state
 * metadata only; no integration, model or device-name exception is involved.
 */
export function isDevicePowerSwitch(hass: any, eid: string): boolean {
  if (!eid.startsWith('switch.')) return false;
  const reg = hass?.entities?.[eid] || {};
  const st = hass?.states?.[eid];
  const objectId = eid.slice('switch.'.length).toLowerCase();
  if (/(?:^|_)(?:main_)?power$/.test(objectId)) return true;
  const exact = [reg.translation_key, reg.original_name, reg.name]
    .map(lower)
    .some((value) => ['power', 'main power', 'power switch', 'питание'].includes(value));
  if (exact) return true;
  const friendly = lower(st?.attributes?.friendly_name);
  return /(?:^|[\s._-])(?:main[\s._-]+)?power$/.test(friendly)
    || /(?:^|[\s._-])питание$/.test(friendly);
}

/** Best recognised actual-work attribute exposed by integrations. Vendor
 * mode/options such as `current_operation: eco` are not action signals and
 * must not suppress a climate entity's enabled-mode fallback. */
function workAction(attrs: any): string {
  for (const key of ['hvac_action', 'action', 'current_operation', 'run_state', 'job_state', 'operation', 'activity']) {
    const v = lower(attrs?.[key]);
    if (WORKING_STATES.has(v) || IDLE_STATES.has(v)) return v;
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
    // `hvac_action` (or an equivalent action attribute) is the precise answer
    // when an integration exposes it: a thermostat may be in heat mode while
    // currently idle. Some valid climate integrations expose only the entity
    // state/HVAC mode, though. In that case use HA's own `hvac_modes` contract
    // as the best available enabled-state fallback instead of leaving every
    // non-off air conditioner permanently neutral.
    const advertisedModes = Array.isArray(st.attributes?.hvac_modes)
      ? st.attributes.hvac_modes.map(lower) : [];
    const enabledMode = !IDLE_STATES.has(state) && (
      CLIMATE_ENABLED_MODES.has(state)
      || WORKING_STATES.has(state)
      || advertisedModes.includes(state)
    );
    return (action ? WORKING_STATES.has(action) : enabledMode)
      ? { ...base, status: 'working', activity: 'running' }
      : base;
  }

  if (['light', 'switch', 'fan', 'humidifier'].includes(domain)) {
    return state === 'on'
      ? { ...base, status: 'working', activity: 'running' }
      : base;
  }

  if (domain === 'media_player') {
    // A media-player state describes its power/transport lifecycle, not an
    // actuator doing work.  In particular, `playing` must not turn every TV,
    // receiver or soundbar into a permanent yellow "working" marker.  Keep
    // every powered/transport state neutral. An explicit `off` uses the same
    // existing faded presentation as unknown/unavailable: this is a visual
    // availability flag, not another status in the marker state machine.
    return state === 'off' ? { ...base, availability: 'unavailable' } : base;
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

/**
 * Classify a resolved device role with the small amount of topology that an
 * entity alone cannot provide. A switch-only controller with several peer
 * switches and a dedicated Power entity is a powered appliance: its feature
 * toggles do not define device activity, Power=on is neutral, and Power=off
 * reuses the existing unavailable/faded presentation. A lone relay remains a
 * normal working switch.
 */
export function entityVisualSamplesForDevice(
  hass: any,
  resolvedEids: readonly string[],
  allEids: readonly string[],
): EntityVisualSample[] {
  const samples = resolvedEids.map((eid) => entityVisualSample(hass, eid));
  const uncategorisedSwitches = allEids.filter((eid) =>
    eid.startsWith('switch.') && !hass?.entities?.[eid]?.entity_category,
  );
  const lifecycle = resolvedEids.length === 1
    && uncategorisedSwitches.length > 1
    && isDevicePowerSwitch(hass, resolvedEids[0]);
  if (!lifecycle) return samples;
  return samples.map((sample) => {
    if (sample.availability === 'unavailable') return sample;
    return sample.state === 'off'
      ? { ...sample, availability: 'unavailable', status: 'neutral', activity: 'none', edge: 'none' }
      : { ...sample, status: 'neutral', activity: 'none', edge: 'none' };
  });
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
