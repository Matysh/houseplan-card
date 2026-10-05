import { lqiColor } from './logic';
import type { I18nKey } from './i18n';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { DevItem } from './types';
import { placeDeviceTooltip } from './live-tip-placement';
import { floatingViewport } from './floating-surface';

export interface LiveTip {
  x: number;
  y: number;
  title: string;
  meta: string;
  lqi?: number | null;
  temp?: number | null;
  hum?: number | null;
  room?: boolean;
  source?: 'pointer' | 'focus';
  deviceId?: string;
}

interface HoverState {
  room: unknown;
  space: string;
}

interface LiveHoverHost {
  renderRoot: ParentNode;
  _tip: LiveTip | null;
  _t: (key: 'tip.temp_avg' | 'tip.hum_avg' | 'tip.lqi') => string;
  _hoverRoom: { space: string; room: unknown } | null;
  _spaceModel: () => unknown;
  _roomHoverPaths: (model: unknown) => { fillD: string; outlineD: string } | null;
}

interface DeviceTipHost extends LiveHoverHost {
  _mode: string;
  _drag: unknown;
  _deviceDrag: unknown;
  _config: { show_signal?: boolean } | null;
  _pointerModality: { hoverEnabled: boolean };
  _deviceHits: { hover: (root: ParentNode, id: string | null) => void };
  _spaceDisplayForRender: () => { showLqi?: boolean };
  _devicePresentation: (device: DevItem, showLqi: boolean) => ResolvedDevicePresentation;
  _notePointer: (event: PointerEvent) => void;
  _t: LiveHoverHost['_t'] & ((key: I18nKey) => string);
}

const states = new WeakMap<object, HoverState>();
const focusTips = new WeakMap<object, LiveTip>();

const deviceTipContent = (host: DeviceTipHost, device: DevItem): { title: string; meta: string } => {
  const showLqi = host._spaceDisplayForRender().showLqi ?? host._config?.show_signal ?? true;
  const presentation = host._devicePresentation(device, showLqi);
  const ghostLabel = presentation.haDisabled
    ? host._t((`marker.ha_disabled_${presentation.disabledReason}`) as I18nKey)
    : device.userHidden ? host._t('marker.hidden_ghost') : device.name;
  const metrics = [
    device.model,
    presentation.valueBadge?.fullText || '',
    presentation.lqiText != null ? `LQI ${presentation.lqiText}` : '',
  ].filter(Boolean).join(' · ');
  return { title: device.name, meta: presentation.haDisabled ? ghostLabel : metrics };
};

export function showDevicePointerTip(value: object, event: PointerEvent, device: DevItem): void {
  const host = value as DeviceTipHost;
  host._notePointer(event);
  if (!host._pointerModality.hoverEnabled || host._drag || host._deviceDrag) {
    host._deviceHits.hover(host.renderRoot, null);
    return;
  }
  const tip = deviceTipContent(host, device);
  host._deviceHits.hover(host.renderRoot, device.id);
  host._tip = { x: event.clientX, y: event.clientY, ...tip, room: false, source: 'pointer', deviceId: device.id };
  syncHouseplanHover(host);
}

export function showDeviceFocusTip(value: object, target: HTMLElement | null, device: DevItem): void {
  const host = value as DeviceTipHost;
  if (host._mode !== 'view' || host._drag || host._deviceDrag
      || !target?.matches(':focus-visible')) return;
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
  host._deviceHits.hover(host.renderRoot, null);
  host._tip = focusTips.get(value) || null;
  host._hoverRoom = null;
  syncHouseplanHover(host);
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

const syncTip = (host: LiveHoverHost, root: ParentNode): void => {
  const element = root.querySelector<HTMLElement>('[data-hp-live-tip]');
  if (!element) return;
  const tip = host._tip as LiveTip | null;
  if (!tip) {
    element.hidden = true;
    element.replaceChildren();
    return;
  }
  const gap = 12;
  const margin = 8;
  element.style.left = `${tip.x + gap}px`;
  element.style.top = `${tip.y + gap}px`;
  element.replaceChildren();
  const title = document.createElement('b');
  title.textContent = tip.title;
  element.append(title);
  appendMeta(element, '', tip.meta);
  appendMeta(element, host._t('tip.temp_avg'), tip.temp == null ? '' : `${tip.temp}°`);
  appendMeta(element, host._t('tip.hum_avg'), tip.hum == null ? '' : `${tip.hum}%`);
  appendMeta(element, host._t('tip.lqi'), tip.lqi == null ? '' : String(tip.lqi),
    tip.lqi == null ? undefined : lqiColor(tip.lqi));
  element.hidden = false;
  const box = element.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - box.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - box.height - margin);
  element.style.left = `${Math.min(maxLeft, Math.max(margin, tip.x + gap))}px`;
  element.style.top = `${Math.min(maxTop, Math.max(margin, tip.y + gap))}px`;
  avoidTopologyCaptions(root, element, tip);
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
  if (previous?.room === room && previous?.space === space) return;
  states.set(value, { room, space });
  const model = hover && host._spaceModel();
  const paths = model ? host._roomHoverPaths(model) : null;
  setRoomPath(root, '[data-hp-live-room-hover="fill"]', paths?.fillD || '');
  setRoomPath(root, '[data-hp-live-room-hover="halo"]', paths?.outlineD || '');
  setRoomPath(root, '[data-hp-live-room-hover="outline"]', paths?.outlineD || '');
}

export function resetHouseplanHover(host: object): void {
  states.delete(host);
}
