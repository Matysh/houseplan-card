/** Optional editor adapters; none belongs to the initial View graph. */
import { svg, type TemplateResult } from 'lit';
import { langOf } from './i18n';
import { toolsT } from './i18n/tools';
import { contactBounds } from './device-contact-scene';
import { positionableIconMarkers } from './device-icon-roster';
import { ledStripsByMarker } from './led-strip-gate';
import { effectiveDeviceBaseSize } from './device-marker-geometry';
import type { DeviceContactRenderer } from './device-contact-render';
import type { DeviceContactFaceEvidence } from './device-contact-maintenance';
import type { DeviceDragState } from './interaction-types';
import type { DeviceLayout } from './device-position-history';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { DevItem, SpaceModel } from './types';

interface ContactEditor {
  renderRoot: ParentNode; hass: { language?: string; locale?: { language?: string } };
  _config?: { icon_size?: number; language?: string };
  _devices: DevItem[]; _model: SpaceModel[]; _layout: DeviceLayout; _mode: string;
  _deviceDrag: DeviceDragState | null; _deviceContacts?: DeviceContactRenderer;
  _devicePresentation(d: DevItem): ResolvedDevicePresentation;
  _pointerMoveNow(e: PointerEvent, d: DevItem): void;
}
export function deviceContactAlt(value: object, e: KeyboardEvent, flush: () => void): void {
  const host = value as ContactEditor, drag = host._deviceDrag;
  if (e.key !== 'Alt' || !drag?.moved || host._mode !== 'devices') return;
  const target = e.composedPath()[0] as HTMLElement | undefined;
  if (target?.isContentEditable || target?.closest?.('input,textarea,select')) return;
  flush(); // queued old-modifier moves may not repaint after this transition
  const d = host._devices.find((item) => item.id === drag.id);
  if (d && drag.lastPointer) host._pointerMoveNow(new PointerEvent('pointermove', {
    ...drag.lastPointer, pointerId: drag.pointerId, altKey: e.type === 'keydown',
  }), d);
}
export function deviceContactMaintenanceFaces(value: object): DeviceContactFaceEvidence[] {
  const host = value as ContactEditor, parent = host.renderRoot.querySelector<HTMLElement>('.devlayer');
  if (!parent || !host._deviceContacts) return [];
  const size = host._config?.icon_size ?? 2.5, base = effectiveDeviceBaseSize(size > 8 ? 2.5 : size) / 100;
  const out: DeviceContactFaceEvidence[] = [];
  for (const space of host._model) for (const d of positionableIconMarkers(host._devices, space.id, ledStripsByMarker(space))) {
    if (!host._layout[d.id]) continue;
    const p = host._devicePresentation(d), box = host._deviceContacts.faceMetric(parent,p);
    if (box) out.push({id:d.id,space:d.space,diameterRatio:base*p.scale,box});
  }
  return out;
}
export function renderDeviceContactGuide(value: object, units: (px: number) => number): TemplateResult | null {
  const host = value as ContactEditor, contact = host._deviceDrag?.contact?.hint;
  if (!contact) return null;
  const shape = host._deviceContacts?.scene?.shapes.get(host._deviceDrag!.id);
  const box = shape ? contactBounds(shape) : null;
  const x = box ? box.right + units(8) : contact.line[2], y = box ? box.top - units(8) : contact.line[3];
  return svg`<g class="device-contact-guide" pointer-events="none" aria-hidden="true">
    <line class="alignline" x1=${contact.line[0]} y1=${contact.line[1]} x2=${contact.line[2]} y2=${contact.line[3]}></line>
    <text class="spacinglabel" data-device-snap=${contact.kind} x=${x} y=${y} font-size=${units(12)}>${
      toolsT(langOf(host.hass,host._config?.language),contact.kind==='wall'?'editor.device_snap_wall':'editor.device_snap_join')}</text>
  </g>` as unknown as TemplateResult;
}
