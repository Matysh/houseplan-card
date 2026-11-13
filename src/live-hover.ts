import { lqiColor } from './logic';
import { effectiveShowLqi } from './signal-visibility';
import type { I18nKey } from './i18n';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { DevItem, ValueBadgeSource } from './types';
import { placeDeviceTooltip } from './live-tip-placement';
import { floatingViewport } from './floating-surface';
import { roomCo2Text } from './room-co2';
import { ControlSurfacePresentation } from './control-surface-presentation';
import {
  createDeviceBatteryContext, deviceBatteryReading,
  type DeviceBatteryContext, type DeviceBatteryDevice, type DeviceBatteryHass,
} from './device-battery';

export interface LiveTip {
  x: number;
  y: number;
  title: string;
  meta: string;
  status?: string;
  battery?: string;
  lqi?: number | null;
  temp?: number | null;
  hum?: number | null;
  co2?: number | null;
  room?: boolean;
  source?: 'pointer' | 'focus';
  deviceId?: string;
}

interface HoverState {
  room: unknown;
  space: string;
  planPaths?: { fillD: string; outlineD: string } | null;
}

interface LiveHoverHost {
  _mode: string;
  renderRoot: ParentNode;
  _tip: LiveTip | null;
  _t: (key: 'tip.temp_avg' | 'tip.hum_avg' | 'tip.lqi' | 'space.label_co2') => string;
  _hoverRoom: { space: string; room: unknown } | null;
  _spaceModel: () => unknown;
  _roomHoverPaths: (model: unknown) => { fillD: string; outlineD: string } | null;
}

interface DeviceTipHost extends LiveHoverHost {
  readonly isConnected?: boolean;
  _space?: string;
  _devices: readonly DevItem[];
  _mode: string;
  _drag: unknown;
  _deviceDrag: unknown;
  _config: { show_signal?: boolean } | null;
  _settings: { show_lqi?: unknown };
  _pointerModality: { hoverEnabled: boolean };
  _deviceHits: { hover: (root: ParentNode, id: string | null) => void };
  _spaceDisplayForRender: () => { showLqi?: import('./signal-visibility').SignalVisibility | null };
  _devicePresentation: (device: DevItem, showLqi: import('./signal-visibility').SignalVisibility) => ResolvedDevicePresentation;
  _notePointer: (event: PointerEvent) => void;
  _t: LiveHoverHost['_t'] & ((key: I18nKey, vars?: Record<string, string | number>) => string);
  /** Same active states and registry as the plan battery; never unfiltered `hass`. */
  _renderPlanHass: DeviceBatteryHass | null | undefined;
  _fullRegistryHass: DeviceBatteryHass | null | undefined;
}

type BatteryTipKey = 'tip.battery_percent' | 'tip.battery_normal' | 'tip.battery_low';

/**
 * #817: the tooltip's own charge line. Owner's decision: it ignores the plan
 * indicator settings (All / Low only / None, per-device hiding); only the
 * #792 source and its current value decide. No reading — no line. A value
 * badge already showing that very sensor in the meta row is not repeated in a
 * second format, as `lqiText` yields to an LQI badge.
 */
export function deviceBatteryTipText(
  device: DeviceBatteryDevice,
  context: DeviceBatteryContext,
  t: (key: BatteryTipKey, vars?: Record<string, number>) => string,
  badge?: ValueBadgeSource | null,
): string {
  const reading = deviceBatteryReading(device, context);
  if (!reading) return '';
  if (badge?.kind === 'entity_state' && badge.entity_id === reading.sourceEntityId) return '';
  if (reading.kind === 'percent') return t('tip.battery_percent', { value: Math.round(reading.value) });
  return t(reading.low ? 'tip.battery_low' : 'tip.battery_normal');
}

const states = new WeakMap<object, HoverState>();
const focusTips = new WeakMap<object, LiveTip>();

interface PendingDeviceTip {
  id: string;
  binding: string;
  mode: string;
  space: string | undefined;
  x: number;
  y: number;
  timer: ReturnType<typeof setTimeout>;
}
const pointerTips = new WeakMap<object, PendingDeviceTip>();
const pointerTipDelay = 150;
const tipBinding = (device: DevItem): string => JSON.stringify([
  device.bindingKind, device.bindingRef, device.marker?.binding,
]);
const cancelPointerTip = (host: object): void => {
  const pending = pointerTips.get(host);
  if (pending) clearTimeout(pending.timer);
  pointerTips.delete(host);
};

// Wrap between metrics, keeping each label/value/unit together within a row.
const metricText = (text: string): string => text.replace(/ /g, '\u00a0');

const deviceTipContent = (
  host: DeviceTipHost, device: DevItem,
): { title: string; meta: string; battery: string; status: string } => {
  const showLqi = effectiveShowLqi(host._settings, host._spaceDisplayForRender().showLqi, host._config?.show_signal);
  const presentation = host._devicePresentation(device, showLqi);
  const ghostLabel = presentation.haDisabled
    ? host._t((`marker.ha_disabled_${presentation.disabledReason}`) as I18nKey)
    : device.hidden && device.userHidden ? host._t('marker.hidden_ghost') : device.name;
  const metrics = [
    device.model,
    metricText(presentation.valueBadge?.fullText || ''),
    presentation.lqiTipText != null ? metricText(`LQI ${presentation.lqiTipText}`) : '',
    presentation.lqiSource?.stale ? host._t('tip.signal_last_known') : '',
  ].filter(Boolean).join(' · ');
  const battery = deviceBatteryTipText(device,
    createDeviceBatteryContext(host._renderPlanHass, host._fullRegistryHass), (key, vars) => host._t(key, vars),
    presentation.valueBadge?.source);
  const status = presentation.offline ? host._t('device.presentation_unavailable')
    : presentation.powerOff ? host._t('device.power_off') : '';
  return { title: device.name, meta: presentation.haDisabled ? ghostLabel : metrics,
    battery: metricText(battery), status };
};

export function showDevicePointerTip(value: object, event: PointerEvent, device: DevItem): void {
  const host = value as DeviceTipHost;
  host._notePointer(event);
  if (!host._pointerModality.hoverEnabled) {
    cancelPointerTip(host);
    host._deviceHits.hover(host.renderRoot, null);
    return;
  }
  if (host._drag || host._deviceDrag
      || !['view', 'devices'].includes(host._mode)) {
    resetHouseplanHover(host);
    host._deviceHits.hover(host.renderRoot, null);
    return;
  }
  host._deviceHits.hover(host.renderRoot, device.id);
  // Once shown, only a real layout/content change can move this surface.
  if (host._tip?.source === 'pointer' && host._tip.deviceId === device.id) return;
  const pending = pointerTips.get(host);
  const binding = tipBinding(device);
  if (pending?.id === device.id && pending.binding === binding
      && pending.mode === host._mode && pending.space === host._space) {
    pending.x = event.clientX; pending.y = event.clientY;
    return;
  }
  cancelPointerTip(host);
  if (host._tip?.source === 'pointer') {
    host._tip = focusTips.get(host) || null;
    syncHouseplanHover(host);
  }
  const next: PendingDeviceTip = { id: device.id, binding, mode: host._mode, space: host._space,
    x: event.clientX, y: event.clientY, timer: setTimeout(() => {
      if (pointerTips.get(host) !== next) return;
      pointerTips.delete(host);
      if (host.isConnected === false || !host._pointerModality.hoverEnabled
          || host._drag || host._deviceDrag || host._mode !== next.mode || host._space !== next.space
          || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      const current = host._devices.find(item => item.id === next.id);
      if (!current || tipBinding(current) !== next.binding) return;
      host._tip = { x: next.x, y: next.y, ...deviceTipContent(host, current),
        room: false, source: 'pointer', deviceId: current.id };
      syncHouseplanHover(host);
    }, pointerTipDelay) };
  pointerTips.set(host, next);
}

export function showDeviceFocusTip(value: object, target: HTMLElement | null, device: DevItem): void {
  const host = value as DeviceTipHost;
  if (host._mode !== 'view' || host._drag || host._deviceDrag
      || !target?.matches(':focus-visible')) return;
  cancelPointerTip(host);
  const rect = target.getBoundingClientRect();
  const tip: LiveTip = {
    x: rect.right, y: rect.top, ...deviceTipContent(host, device),
    source: 'focus', deviceId: device.id,
  };
  focusTips.set(value, tip);
  host._tip = tip;
  syncHouseplanHover(host);
}

export function hideDeviceFocusTip(value: object, deviceId: string): void {
  const host = value as DeviceTipHost;
  if (focusTips.get(value)?.deviceId !== deviceId) return;
  focusTips.delete(value);
  if (host._tip?.source === 'focus') host._tip = null;
  syncHouseplanHover(host);
}

export function clearPointerHover(value: object): void {
  const host = value as DeviceTipHost;
  cancelPointerTip(host);
  host._deviceHits.hover(host.renderRoot, null);
  host._tip = focusTips.get(value) || null;
  host._hoverRoom = null;
  refreshDeviceTip(value);
  syncHouseplanHover(host);
}

/** An already-visible tip consumes the same current presentation as its face. */
export function refreshDeviceTip(value: object): void {
  const host = value as DeviceTipHost, tip = host._tip;
  if (!tip?.deviceId || tip.room) return;
  const device = host._devices.find(device => device.id === tip.deviceId);
  if (!device) {
    host._tip = null;
    if (tip.source === 'focus') focusTips.delete(value);
    return;
  }
  const current = { ...tip, ...deviceTipContent(host, device) };
  host._tip = current;
  if (tip.source === 'focus') focusTips.set(value, current);
}

export function reconcileDeviceFocusTip(value: object): void {
  const host = value as DeviceTipHost;
  const tip = focusTips.get(value);
  if (!tip) return;
  const marker = [...host.renderRoot.querySelectorAll<HTMLElement>('[data-hp="device"]')]
    .find((node) => node.dataset.id === tip.deviceId);
  if (marker?.matches(':focus-visible')) return;
  focusTips.delete(value);
  if (host._tip?.source === 'focus') host._tip = null;
}

export const deviceFocusTipActive = (value: object): boolean => focusTips.has(value);
export const clearDeviceFocusTip = (value: object): void => { focusTips.delete(value); };

const appendMeta = (tip: HTMLElement, label: string, value?: string, color?: string): void => {
  if (!value) return;
  const row = document.createElement('span');
  row.className = 'm';
  if (!label) row.textContent = value;
  else {
    row.append(`${label} `);
    const strong = document.createElement('b');
    strong.textContent = value;
    if (color) strong.style.color = color;
    row.append(strong);
  }
  tip.append(row);
};

const tipPresentations = new WeakMap<object, {
  element: HTMLElement; motion: ControlSurfacePresentation; fade: boolean; content?: string;
  stopLayout?: () => void;
}>();

const syncTip = (host: LiveHoverHost, root: ParentNode): void => {
  const element = root.querySelector<HTMLElement>('[data-hp-live-tip]');
  if (!element) return;
  let state = tipPresentations.get(host);
  const tip = host._tip as LiveTip | null;
  const fade = tip ? !!tip.deviceId : state?.fade ?? false;
  if (state?.element !== element || state.fade !== fade) {
    state?.stopLayout?.();
    state?.motion.reset();
    const motion = new ControlSurfacePresentation(() => {
      if (!motion.mounted) {
        element.hidden = true; element.replaceChildren(); state!.content = undefined;
      }
    }, fade ? 'fade' : 'slide');
    state = { element, motion, fade }; tipPresentations.set(host, state);
  }
  if (!tip) {
    state.stopLayout?.(); state.stopLayout = undefined;
    element.setAttribute('aria-hidden', 'true');
    state.motion.sync(false, 'bottom'); state.motion.updated(element);
    if (!state.motion.mounted) { element.hidden = true; element.replaceChildren(); state.content = undefined; }
    return;
  }
  if (fade && !state.stopLayout) {
    const view = element.ownerDocument.defaultView;
    let frame: number | undefined;
    const layout = () => {
      if (!view || frame !== undefined) return;
      frame = view.requestAnimationFrame(() => { frame = undefined; syncHouseplanHover(host); });
    };
    view?.addEventListener('resize', layout);
    state.stopLayout = () => {
      view?.removeEventListener('resize', layout);
      if (frame !== undefined) view?.cancelAnimationFrame(frame);
    };
  }
  const gap = 12;
  const margin = 8;
  element.style.left = `${tip.x + gap}px`;
  element.style.top = `${tip.y + gap}px`;
  const content = JSON.stringify([tip.title, tip.meta, tip.status, tip.battery, tip.temp, tip.hum, tip.co2, tip.lqi]);
  if (!fade || state.content !== content) {
    element.replaceChildren();
    const title = document.createElement('b');
    title.textContent = tip.title;
    element.append(title);
    appendMeta(element, '', tip.meta);
    appendMeta(element, '', tip.status);
    appendMeta(element, '', tip.battery);
    appendMeta(element, host._t('tip.temp_avg'), tip.temp == null ? '' : `${tip.temp}°`);
    appendMeta(element, host._t('tip.hum_avg'), tip.hum == null ? '' : `${tip.hum}%`);
    appendMeta(element, host._t('space.label_co2'), tip.co2 == null ? '' : roomCo2Text(tip.co2));
    appendMeta(element, host._t('tip.lqi'), tip.lqi == null ? '' : String(tip.lqi),
      tip.lqi == null ? undefined : lqiColor(tip.lqi));
    state.content = content;
  }
  element.hidden = false;
  element.removeAttribute('aria-hidden');
  const box = element.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - box.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - box.height - margin);
  element.style.left = `${Math.min(maxLeft, Math.max(margin, tip.x + gap))}px`;
  element.style.top = `${Math.min(maxTop, Math.max(margin, tip.y + gap))}px`;
  avoidTopologyCaptions(root, element, tip);
  state.motion.sync(!element.hidden, 'bottom'); state.motion.updated(element);
};

/** Both layers are measured after paint in screen coordinates, including 2.5D. */
const avoidTopologyCaptions = (root: ParentNode, element: HTMLElement, tip: LiveTip): void => {
  if (tip.source !== 'pointer' || tip.room || !tip.deviceId) return;
  const overlay = root.querySelector<HTMLElement>('hp-zigbee-topology-overlay');
  if (overlay?.getAttribute('data-tooltip-owner') !== tip.deviceId) return;
  const stage = root.querySelector<HTMLElement>('.stage');
  if (!stage || !overlay.shadowRoot) return;
  const viewport = floatingViewport(window);
  const area = stage.getBoundingClientRect();
  const left = Math.max(viewport.left, area.left);
  const top = Math.max(viewport.top, area.top);
  const right = Math.min(viewport.left + viewport.width, area.right);
  const bottom = Math.min(viewport.top + viewport.height, area.bottom);
  const captions = [...overlay.shadowRoot.querySelectorAll<HTMLElement>(
    '.parent-bubble,.remote,.route-status',
  )].map((node) => node.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0
    && rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom);
  if (!captions.length) return;
  const marker = [...root.querySelectorAll<HTMLElement>('[data-hp="device"]')]
    .find((node) => node.dataset.id === tip.deviceId);
  const blockers = marker ? [...captions, marker.getBoundingClientRect()] : captions;
  const box = element.getBoundingClientRect();
  const position = placeDeviceTooltip({
    preferred: { x: tip.x + 12, y: tip.y + 12 },
    size: { width: box.width, height: box.height },
    bounds: { left, top, right, bottom, width: right - left, height: bottom - top },
    blockers,
  });
  if (!position) { element.hidden = true; return; }
  // A fixed tooltip may still have a transformed containing block in a HA card.
  // Correct from its measured position rather than treating CSS left as clientX.
  const scaleX = element.offsetWidth ? box.width / element.offsetWidth : 1;
  const scaleY = element.offsetHeight ? box.height / element.offsetHeight : 1;
  element.style.left = `${parseFloat(element.style.left) + (position.left - box.left) / scaleX}px`;
  element.style.top = `${parseFloat(element.style.top) + (position.top - box.top) / scaleY}px`;
};

const setRoomPath = (root: ParentNode, selector: string, d: string): void => {
  const path = root.querySelector<SVGPathElement>(selector);
  if (!path) return;
  path.setAttribute('d', d);
  path.toggleAttribute('hidden', !d);
};

/** Update the ordinary mouse hover without scheduling a full card render. */
export function syncHouseplanHover(value: object): void {
  const host = value as LiveHoverHost;
  const root = host.renderRoot;
  if (!root) return;
  syncTip(host, root);
  const hover = host._hoverRoom;
  const previous = states.get(value);
  const space = hover?.space || '';
  const room = hover?.room || null;
  // Plan candidates share these SVG painters, but deliberately own no Room.
  // Memoize their cached paths as well, so a live patch cannot erase a Lit frame.
  const planModel = host._mode === 'plan' ? host._spaceModel() : null;
  const planPaths = host._mode === 'plan'
    ? (planModel ? host._roomHoverPaths(planModel) : null) : undefined;
  if (previous?.room === room && previous?.space === space && previous?.planPaths === planPaths) return;
  states.set(value, { room, space, planPaths });
  const model = hover && host._spaceModel();
  const paths = planPaths !== undefined ? planPaths : model ? host._roomHoverPaths(model) : null;
  setRoomPath(root, '[data-hp-live-room-hover="fill"]', paths?.fillD || '');
  setRoomPath(root, '[data-hp-live-room-hover="halo"]', paths?.outlineD || '');
  setRoomPath(root, '[data-hp-live-room-hover="outline"]', paths?.outlineD || '');
}

const resetTipPresentation = (host: object): void => {
  const tip = tipPresentations.get(host);
  tip?.stopLayout?.();
  tip?.motion.reset();
  if (tip) { tip.element.hidden = true; tip.element.replaceChildren(); }
  tipPresentations.delete(host);
};

export function resetHouseplanHover(host: object): void {
  cancelPointerTip(host);
  focusTips.delete(host);
  (host as LiveHoverHost)._tip = null;
  states.delete(host);
  resetTipPresentation(host);
}

/** Keep device motion across commits; retain the existing room-tip retirement. */
export function invalidateHouseplanHover(host: object): void {
  states.delete(host);
  if (!tipPresentations.get(host)?.fade) resetTipPresentation(host);
}
