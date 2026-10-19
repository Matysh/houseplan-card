/** The image read owns the editor context; only the existing config writer saves. */
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import type { DevItem } from '../types';
import { vacuumMapPreview, type VacuumMapPreview } from '../vacuum-ecovacs-client';

type Owner = { connection: unknown; user: unknown; marker: string };
const owners = new WeakMap<VacuumMapPreview, Owner>();

function markerIdentity(runtime: HouseplanEditorRuntime, id: string): string {
  const device = runtime.host._devices.find(item => item.id === id);
  return JSON.stringify([device?.bindingKind, device?.bindingRef, device?.space,
    device?.marker?.vacuum?.source, device?.marker?.vacuum?.map_routes,
    device?.marker?.vacuum?.calibration]);
}

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
  const marker = markerIdentity(runtime, device.id);
  dialog.busy = true;
  host.requestUpdate();
  try {
    const value: unknown = await hass.callWS({ type: 'houseplan/vacuum/map_preview',
      marker_id: device.id, source, map_id: mapId });
    if (host._markerDialog !== dialog) return null;
    if (host.hass?.connection !== hass.connection || host.hass?.user?.id !== hass.user?.id
      || !sameSource(runtime, device.id, source, mapId) || markerIdentity(runtime, device.id) !== marker) {
      host._showToast(host._t('vac.ecovacs_map_changed'));
      return null;
    }
    const preview = vacuumMapPreview(value, source, mapId);
    if (!preview) host._showToast(host._t('vac.ecovacs_preview_error'));
    else owners.set(preview, { connection: hass.connection, user: hass.user?.id, marker });
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
  if (!fit?.preview) return true;
  const owner = owners.get(fit.preview), hass = runtime.host.hass;
  if (owner && owner.connection === hass?.connection && owner.user === hass?.user?.id
    && owner.marker === markerIdentity(runtime, fit.markerId)
    && sameSource(runtime, fit.markerId, fit.source, fit.mapId)) return true;
  runtime.host._showToast(runtime.host._t('vac.ecovacs_map_changed'));
  return false;
}
