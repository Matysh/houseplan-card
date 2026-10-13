import type { HouseplanEditorHostPort, HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import type { RoomCfg, ServerConfig } from '../types';
import { isGeometryCleanupRefusal, supersedeDeferredWrite } from '../config-adoption';
import { applyRoomTempThresholdDraft } from '../space-dialog';
import { dialogSession } from './dialog-baseline';
import { forgetRoomBaseline, roomDraftKey } from './room-form-state';

const saving = new WeakMap<object, object | undefined>();
export function roomSaveBusy(host: object): boolean {
  return saving.has(host) && saving.get(host) === dialogSession(host, 'room');
}

/** Keep the form until its own accepted response; rollback remains #842's. */
export async function saveRoomEdit(runtime: HouseplanEditorRuntime): Promise<void> {
  const host: HouseplanEditorHostPort = runtime.host;
  if (roomSaveBusy(host)) return;
  const cfg = host._serverCfg;
  if (!cfg) return;
  const owner = dialogSession(host, 'room'), savedDraft = roomDraftKey(host);
  const spaceId = host._space, roomId = host._roomEditId;
  const candidate = JSON.parse(JSON.stringify(cfg)) as ServerConfig;
  const room = candidate.spaces.find(space => space.id === spaceId)?.rooms.find(room => room.id === roomId);
  if (!room) { host._showToast(host._t('toast.conflict')); return; }
  room.name = host._nameSel.trim() || room.name;
  room.area = host._areaSel || null;
  // #581: preserve unknown/future settings and materialize legacy Glow, but
  // keep a custom colour only with the room's explicit custom fill mode.
  const previous = room.settings || {};
  const next: NonNullable<RoomCfg['settings']> = { ...previous };
  if (!applyRoomTempThresholdDraft(next, host._roomTempMin, host._roomTempMax)) return;
  if (host._roomFill) next.fill_mode = host._roomFill as typeof next.fill_mode;
  else delete next.fill_mode;
  if (host._roomFill === 'custom' && host._roomCustomFill) next.custom_fill = host._roomCustomFill;
  else delete next.custom_fill;
  if (previous.fill_mode === 'glow' && typeof previous.glow !== 'boolean') next.glow = true;
  if (host._roomTempSrc) next.temp_source = host._roomTempSrc;
  else delete next.temp_source;
  if (host._roomHumSrc) next.hum_source = host._roomHumSrc;
  else delete next.hum_source;
  if (host._roomNameScale !== 1) next.name_scale = host._roomNameScale;
  else delete next.name_scale;
  if (host._roomLabelScale !== 1) next.label_scale = host._roomLabelScale;
  else delete next.label_scale;
  if (Object.keys(next).length) room.settings = next;
  else delete room.settings;
  const attempt = runtime._stageOptimisticConfig(cfg, candidate);
  saving.set(host, owner);
  host._regSignature = '';
  host._maybeRebuildDevices();
  host.requestUpdate();
  const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
  try {
    await runtime._saveConfigNow(attempt);
    if (host.isConnected && host._roomDialog && dialogSession(host, 'room') === owner
      && host._space === spaceId && host._roomEditId === roomId && roomDraftKey(host) === savedDraft) {
      forgetRoomBaseline(host);
      host._roomDialog = false;
      host._roomEditId = null;
      host._nameSel = '';
      host._areaSel = '';
    }
    host._showToast(host._t('toast.room_updated'));
  } catch (error) {
    restoreDeferred(host._rollbackOptimistic(attempt));
    host._regSignature = '';
    host._maybeRebuildDevices();
    if (!isGeometryCleanupRefusal(error)) host._showToast(host._t('toast.error', { err: host._errText(error) }));
  } finally {
    if (saving.get(host) === owner) saving.delete(host);
    host.requestUpdate();
  }
}
