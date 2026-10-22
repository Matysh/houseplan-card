/** ACK-only, serialized vacuum policy edit. No speculative plan/robot mutation. */
import type { HouseplanEditorRuntime, HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { Marker, ServerConfig } from './types';
import { enqueueSerializedWrite } from './serialized-write-queue';
import { findGeometryRemoval } from './geometry-cleanup';

type Host = Pick<HouseplanEditorHostPort, '_serverCfg' | '_devices' | '_canEdit' | '_kiosk'
  | '_haVacuumDockRestartApi' | '_configWriteGuard' | '_writeChain' | '_writesPending'
  | '_sendConfigCandidate' | '_adoption' | '_regSignature' | '_maybeRebuildDevices'
  | '_isVacDev' | '_showToast' | '_t' | '_errText' | 'requestUpdate'>;
type Runtime = Pick<HouseplanEditorRuntime, '_prepareConfigCandidate'> & { host: Host };
type Pending = { current: () => boolean };
const pending = new WeakMap<Host, Map<string, Pending>>();

export function vacuumDockRestartPending(host: Host, markerId: string): boolean {
  return pending.get(host)?.get(markerId)?.current() === true;
}

export async function saveVacuumDockRestart(runtime: Runtime, markerId: string, enabled: boolean): Promise<boolean> {
  const { host } = runtime;
  const device = host._devices.find(item => item.id === markerId);
  if (!device || !host._isVacDev(device) || !host._serverCfg || vacuumDockRestartPending(host, markerId)) return false;
  const binding = `${device.bindingKind}:${device.bindingRef}`;
  if ((device.bindingKind !== 'entity' && device.bindingKind !== 'device') || !device.bindingRef) return false;
  const authority = host._configWriteGuard();
  const ownsPending = host._configWriteGuard(true);
  const current = (): boolean => {
    const live = host._devices.find(item => item.id === markerId);
    const marker = host._serverCfg?.markers?.find(item => item.id === markerId);
    return authority() && host._canEdit && !host._kiosk && host._haVacuumDockRestartApi === 1
      && !!live && host._isVacDev(live) && `${live.bindingKind}:${live.bindingRef}` === binding
      && (!marker || marker.removed !== true && marker.binding === binding);
  };
  if (!current()) return false;
  const token = { current };
  const writes = pending.get(host) ?? new Map<string, Pending>();
  pending.set(host, writes);
  writes.set(markerId, token);
  host._writesPending++;
  host.requestUpdate();
  const write = enqueueSerializedWrite(host._writeChain, async () => {
    if (!current() || !host._serverCfg) throw Object.assign(new Error('config authority changed'), { code: 'context-changed' });
    if (findGeometryRemoval(host._serverCfg)) throw new Error(host._t('toast.geometry_unsafe'));
    let candidate = structuredClone(host._serverCfg) as ServerConfig;
    candidate.markers ??= [];
    let marker = candidate.markers.find(item => item.id === markerId);
    if (!marker) {
      marker = { id: markerId, binding, space: device.space || null,
        area: device.area || null, hidden: device.hidden ? true : false } as Marker;
      candidate.markers.push(marker);
    }
    marker.vacuum = { ...marker.vacuum, new_run_after_dock: enabled };
    candidate = runtime._prepareConfigCandidate(candidate);
    await host._sendConfigCandidate(candidate);
    if (!current() || !host._serverCfg) return;
    // Preserve unrelated edits made while awaiting this ACK. The accepted
    // cache/revision belongs to the exact candidate sent by the sole transport.
    const live = host._serverCfg;
    const markers = [...live.markers ?? []];
    const index = markers.findIndex(item => item.id === markerId);
    const accepted = candidate.markers?.find(item => item.id === markerId);
    if (!accepted) return;
    if (index < 0) markers.push(accepted);
    else markers[index] = { ...markers[index], vacuum: { ...markers[index].vacuum, new_run_after_dock: enabled } };
    host._adoption.stageLocalConfig({ ...live, markers });
    host._regSignature = '';
    host._maybeRebuildDevices();
    host.requestUpdate();
  });
  host._writeChain = write;
  try {
    await write;
    return current();
  } catch (error) {
    if (current()) host._showToast(host._t('toast.cfg_save_failed', { err: host._errText(error) }), 'toast.cfg_save_failed');
    return false;
  } finally {
    if (ownsPending()) host._writesPending--;
    if (writes.get(markerId) === token) writes.delete(markerId);
    host.requestUpdate();
  }
}
