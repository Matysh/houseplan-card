/** #930: one candidate and post-commit cleanup for single and catalog Delete. */
import { deletePlanMarkerRecords, removeMarkerControlReferences } from './devices';
import { removeMarkerAreaSnapshots } from './device-area-relocation';
import { isGeometryCleanupRefusal, supersedeDeferredWrite } from './config-adoption';
import { dialogSession } from './editors/dialog-baseline';
import type { HouseplanEditorRuntime } from './houseplan-editor-runtime';
import type { ServerConfig } from './types';
import type { DeviceInboxRow } from './device-inbox';
import { inboxT } from './device-inbox-i18n';
import { langOf } from './i18n';
import { toolsT } from './i18n/tools';

export interface MarkerDeletionTarget { id: string; binding: string }

export function markerDeletionCandidate(config: ServerConfig, targets: readonly MarkerDeletionTarget[]) {
  const candidate: ServerConfig = structuredClone(config);
  const cleanupIds = new Set<string>();
  for (const target of targets) {
    const deletion = deletePlanMarkerRecords(candidate.markers || [], target.id, target.binding, target.binding === 'virtual');
    candidate.markers = deletion.markers;
    for (const id of deletion.cleanupIds) cleanupIds.add(id);
  }
  candidate.markers = removeMarkerControlReferences(candidate.markers || [], cleanupIds);
  for (const space of candidate.spaces) for (const strip of space.led_strips || []) {
    if (strip.marker && cleanupIds.has(strip.marker)) Object.assign(strip, { marker: null, active: true });
  }
  if (candidate.settings?.marker_area_snapshot) candidate.settings.marker_area_snapshot =
    removeMarkerAreaSnapshots(candidate.settings.marker_area_snapshot, cleanupIds);
  return { candidate, cleanupIds };
}

/** Throws on config refusal; housekeeping is best effort only after durable success. */
async function commitDeletion(runtime: HouseplanEditorRuntime, targets: readonly MarkerDeletionTarget[], candidateCurrent?: () => boolean): Promise<void> {
  const host = runtime.host;
  const cfg = host._serverCfg;
  if (!cfg || !host._canEdit || host._kiosk || !host.isConnected) throw new Error('Delete unavailable');
  const claim = host._configWriteContext.claim();
  const current = () => host.isConnected && host._configWriteContext.current(claim, host.hass);
  if (host._mode === 'devices' && runtime.deviceStructure.available) {
    if (host._devicePositionBusy) return;
    const space = host._space;
    const applicable = () => current() && host._mode === 'devices' && host._space === space && host._canEdit && !host._kiosk;
    host._devicePositionBusy = true;
    const t = (key: 'history.device_delete' | 'history.device_delete_many', vars: Record<string, string | number>) =>
      toolsT(langOf(host.hass, host._config?.language), key, vars);
    const name = targets.length === 1 ? t('history.device_delete', { name: host._devices.find(d => d.id === targets[0].id)?.name || host._t('device.fallback') })
      : t('history.device_delete_many', { count: targets.length });
    runtime.deviceStructure.status('device.delete_pending');
    try {
      await runtime.deviceStructure.settle();
      if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
      await host._writeChain;
      if (!applicable() || host._dirtyPos.size || host._sentPos.size) throw new Error('Delete unavailable');
      await runtime.deviceStructure.request({ type: 'houseplan/marker/history', ...runtime.deviceStructure.fields(true), action: 'delete',
        targets, expected_config_rev: host._cfgRev, expected_layout_rev: host._layoutRev }, async reply => {
        if (!applicable()) return;
        await runtime.deviceStructure.adopt(reply);
        if (!applicable()) return;
        runtime.deviceStructure.record(reply, name, targets[0].id, space);
        const removed = new Set(targets.map(target => target.id));
        if (host._selId && removed.has(host._selId)) host._selId = null;
        if (host._infoCard && removed.has(host._infoCard.id)) host._closeInfoCard();
        for (const id of removed) {
          delete host._defPos[id]; host._dirtyPos.delete(id); host._sentPos.delete(id);
          const activity = host._activityRt.get(id);
          if (activity) clearTimeout(activity.timer);
          host._activityRt.delete(id); host._vacRt.delete(id); delete host._vacSrvTrails[id];
        }
      });
    } finally {
      if (current()) {
        host._devicePositionBusy = runtime.deviceStructure.needsResolution;
        if (!runtime.deviceStructure.needsResolution) runtime.deviceStructure.status(null);
        else host.requestUpdate();
      }
    }
    return;
  }
  const { candidate, cleanupIds } = markerDeletionCandidate(cfg, targets);
  const attempt = runtime._stageOptimisticConfig(cfg, runtime._prepareConfigCandidate(candidate));
  const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
  try {
    await runtime._saveConfigNow(attempt, candidateCurrent);
  } catch (error) {
    restoreDeferred(host._rollbackOptimistic(attempt));
    if (current()) { host._regSignature = ''; host._deviceInboxMemo = null; host._maybeRebuildDevices(); }
    throw error;
  }
  if (!current()) return;
  host._cancelDeviceDrag();
  host._devicePositionHistory.clear();
  if (host._infoCard && cleanupIds.has(host._infoCard.id)) host._closeInfoCard();
  if (host._selId && cleanupIds.has(host._selId)) host._selId = null;
  for (const id of cleanupIds) {
    delete host._layout[id]; delete host._defPos[id];
    host._dirtyPos.delete(id); host._sentPos.delete(id);
    const activity = host._activityRt.get(id);
    if (activity) clearTimeout(activity.timer);
    host._activityRt.delete(id); host._vacRt.delete(id); delete host._vacSrvTrails[id];
  }
  host._regSignature = ''; host._deviceInboxMemo = null; host._maybeRebuildDevices();
  // Bounded work: at most three independent cleanup requests in flight.
  const ids = cleanupIds.values();
  const ws = host.hass.callWS.bind(host.hass);
  await Promise.all(Array.from({ length: Math.min(3, cleanupIds.size) }, async () => {
    for (const id of ids) {
      for (const [type, field] of [
        ['houseplan/layout/delete', 'device_id'], ['houseplan/files/cleanup', 'marker_id'],
        ['houseplan/trail/delete', 'marker_id'],
      ]) {
        if (!current()) return;
        // A concurrent explicit re-add owns its fresh attachments and position.
        if (host._serverCfg?.markers.some((marker) => marker.id === id && !marker.removed)) break;
        try {
          const response = await ws({ type, [field]: id });
          if (current() && field === 'device_id') host._noteLayoutRev(response);
        } catch { /* already deleted: do not restore a durable tombstone */ }
      }
    }
  }));
}

const targetForId = (runtime: HouseplanEditorRuntime, id: string): MarkerDeletionTarget | null => {
  const host = runtime.host;
  const device = host._devices.find((item) => item.id === id);
  const marker = host._markers.find((item) => item.id === id && !item.removed);
  const binding = device ? device.bindingKind === 'virtual' ? 'virtual'
    : device.bindingKind && device.bindingRef ? `${device.bindingKind}:${device.bindingRef}` : '' : marker?.binding;
  return binding ? { id, binding } : null;
};

/** Panel Delete enters the same durable cleanup command without a fabricated dialog draft. */
export async function deletePlanDevice(runtime: HouseplanEditorRuntime, id: string, binding: string, candidateCurrent?: () => boolean): Promise<void> {
  const host = runtime.host;
  if (host._devicePositionBusy) return;
  const claim = host._configWriteContext.claim();
  const current = () => (!candidateCurrent || candidateCurrent()) && host.isConnected && host._canEdit && !host._kiosk
    && host._configWriteContext.current(claim, host.hass) && targetForId(runtime, id)?.binding === binding;
  if (!current()) return;
  const device = host._devices.find(d => d.id === id);
  const accepted = await host._confirmDanger({
    key: 'remove-marker', kind: 'destructive', title: host._t('confirm.remove_marker_title'),
    message: host._t('confirm.remove_marker_body'), objectName: device?.name || host._t('device.fallback'),
    confirmLabel: host._t('btn.delete'), cancelLabel: host._t('btn.cancel'),
  });
  if (!accepted || !current()) return;
  try {
    await commitDeletion(runtime, [{ id, binding }], candidateCurrent);
    if (host._configWriteContext.current(claim, host.hass)) host._showToast(host._t('toast.marker_removed'), 'toast.marker_removed');
  } catch (error) {
    if (current() && !runtime.deviceStructure?.needsResolution && !isGeometryCleanupRefusal(error)) host._showToast(host._t('toast.error', { err: host._errText(error) }), 'toast.error');
  }
}

export async function deleteMarker(runtime: HouseplanEditorRuntime): Promise<void> {
  const host = runtime.host;
  const dialog = host._markerDialog;
  if (!dialog?.devId || dialog.busy || host._devicePositionBusy || !host._canEdit || host._kiosk) return;
  const target = targetForId(runtime, dialog.devId);
  if (!target) return;
  const session = dialogSession(host, 'marker');
  const claim = host._configWriteContext.claim();
  const current = () => host.isConnected && host._configWriteContext.current(claim, host.hass);
  const accepted = await host._confirmDanger({
    key: 'remove-marker', kind: 'destructive', title: host._t('confirm.remove_marker_title'),
    message: host._t('confirm.remove_marker_body'), objectName: dialog.name || host._t('device.fallback'),
    confirmLabel: host._t('btn.delete'), cancelLabel: host._t('btn.cancel'),
  });
  const live = host._markerDialog;
  if (!accepted || !current() || !host._canEdit || host._kiosk || dialogSession(host, 'marker') !== session
      || !live || live.busy || live.devId !== target.id || targetForId(runtime, target.id)?.binding !== target.binding) return;
  const pending = { ...live, busy: true };
  host._markerDialog = pending;
  try {
    await commitDeletion(runtime, [target]);
    if (!current()) return;
    if (host._markerDialog === pending) {
      if (host._deviceInboxReturn) host._deviceInboxReturn = {
        ...host._deviceInboxReturn, ...(target.binding === 'virtual' ? {} : { tab: 'readd' }), anchor: target.binding,
      };
      runtime._closeMarkerDialog();
    }
    host._showToast(host._t('toast.marker_removed'), 'toast.marker_removed');
  } catch (error) {
    if (!current()) return;
    if (host._markerDialog === pending) host._markerDialog = { ...pending, busy: false };
    if (!runtime.deviceStructure?.needsResolution && !isGeometryCleanupRefusal(error)) host._showToast(host._t('toast.error', { err: host._errText(error) }), 'toast.error');
  }
}

/** Signature deliberately includes placement/category, not just checked bindings. */
export const inboxDeletionSignature = (rows: readonly DeviceInboxRow[]): string => JSON.stringify(
  rows.map((row) => [row.key, row.binding, row.deviceId || row.markerId, row.category, row.spaceId]).sort(),
);

export async function deleteInboxSelection(
  runtime: HouseplanEditorRuntime, selectedRows: () => DeviceInboxRow[], scope: string,
): Promise<void> {
  const host = runtime.host;
  const dialog = host._deviceInbox;
  if (!dialog || dialog.busy || host._devicePositionBusy || !host._canEdit || host._kiosk) return;
  const rows = selectedRows();
  if (!rows.length || rows.some((row) => !row.canDelete || !(row.deviceId || row.markerId))) return;
  const signature = inboxDeletionSignature(rows);
  const claim = host._configWriteContext.claim();
  const navigation = runtime.navigationIntent;
  const current = () => host.isConnected && host._configWriteContext.current(claim, host.hass);
  const pending = { ...dialog, busy: '__delete__' };
  host._deviceInbox = pending;
  const accepted = await host._confirmDanger({
    key: 'remove-markers', kind: 'destructive', title: inboxT(host, 'confirm.remove_markers_title'),
    message: inboxT(host, 'confirm.remove_markers_body', { count: rows.length, scope }),
    objectName: rows.map((row) => `${row.name} · ${row.spaceName || inboxT(host, 'device_inbox.no_space')} · ${row.key}`).join('\n'),
    confirmLabel: inboxT(host, 'device_inbox.delete_selected', { count: rows.length }), cancelLabel: host._t('btn.cancel'),
  });
  if (!current() || host._deviceInbox !== pending) return;
  if (!accepted) { host._deviceInbox = { ...pending, busy: undefined }; return; }
  if (!host._canEdit || host._kiosk || navigation !== runtime.navigationIntent
      || signature !== inboxDeletionSignature(selectedRows())) {
    host._deviceInbox = { ...pending, busy: undefined, selected: [] };
    host._showToast(inboxT(host, 'device_inbox.selection_changed'), 'device_inbox.selection_changed'); return;
  }
  try {
    await commitDeletion(runtime, rows.map((row) => ({ id: (row.deviceId || row.markerId)!, binding: row.binding })));
    if (!current()) return;
    if (host._deviceInbox === pending) host._deviceInbox = { ...pending, busy: undefined, selected: [] };
    host._showToast(inboxT(host, 'device_inbox.batch_deleted', { count: rows.length }), 'device_inbox.batch_deleted');
  } catch (error) {
    if (!current()) return;
    if (host._deviceInbox === pending) host._deviceInbox = { ...pending, busy: undefined };
    if (!runtime.deviceStructure?.needsResolution && !isGeometryCleanupRefusal(error)) host._showToast(host._t('toast.error', { err: host._errText(error) }), 'toast.error');
  }
}
