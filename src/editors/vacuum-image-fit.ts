/** The image read owns the editor context; only the existing config writer saves. */
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import type { DevItem } from '../types';
import { vacuumMapPreview, type VacuumMapPreview } from '../vacuum-ecovacs-client';

function sameSource(runtime: HouseplanEditorRuntime, marker: string, source: string, mapId: string): boolean {
  const device = runtime.host._devices.find(item => item.id === marker);
  return !!device && runtime.host._vacSource(device) === source
    && runtime.host._vacObservedMapId(device, source) === mapId;
}

export async function loadVacuumImageFit(
  runtime: HouseplanEditorRuntime, device: DevItem, source: string, mapId: string,
): Promise<VacuumMapPreview | null> {
  const host = runtime.host, dialog = host._markerDialog, hass = host.hass;
  if (!dialog || dialog.busy) return null;
  dialog.busy = true;
  host.requestUpdate();
  try {
    const value: unknown = await hass.callWS({ type: 'houseplan/vacuum/map_preview',
      marker_id: device.id, source, map_id: mapId });
    if (host._markerDialog !== dialog) return null;
    if (host.hass?.connection !== hass.connection || host.hass?.user?.id !== hass.user?.id
      || !sameSource(runtime, device.id, source, mapId)) {
      host._showToast(host._t('vac.ecovacs_map_changed'));
      return null;
    }
    const preview = vacuumMapPreview(value, source, mapId);
    if (!preview) host._showToast(host._t('vac.ecovacs_preview_error'));
    return preview;
  } catch {
    if (host._markerDialog === dialog) host._showToast(host._t('vac.ecovacs_preview_error'));
    return null;
  } finally {
    if (host._markerDialog === dialog) {
      dialog.busy = false;
      host.requestUpdate();
    }
  }
}

export function vacuumImageFitCurrent(runtime: HouseplanEditorRuntime): boolean {
  const fit = runtime.host._vacFit;
  if (!fit?.preview || sameSource(runtime, fit.markerId, fit.source, fit.mapId)) return true;
  runtime.host._showToast(runtime.host._t('vac.ecovacs_map_changed'));
  return false;
}
