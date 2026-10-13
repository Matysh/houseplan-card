import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import { finishMarkerDialogClose } from '../marker-dialog-close';
import { radarDiscardRequest } from '../radar-setup';
import { forgetMarkerBaseline, markerDirty } from './marker-form-state';
import { roomDirty } from './room-form-state';
import { closeSurface, requestDraftClose } from './draft-close';
import { settingsCopy } from './settings-copy';

function discardRequest(runtime: HouseplanEditorRuntime, kind: 'marker' | 'room', name: string) {
  const { st } = settingsCopy(runtime.host);
  return {
    key: `discard-${kind}-dialog`, kind: 'warning' as const,
    title: st('dialog.discard_title'), message: st('dialog.discard_message'),
    objectName: name.trim() || undefined,
    confirmLabel: st('dialog.discard_confirm'), cancelLabel: st('dialog.discard_keep'),
    icon: 'mdi:content-save-off-outline', confirmIcon: 'mdi:content-save-off-outline',
  };
}

export function requestMarkerClose(runtime: HouseplanEditorRuntime, after?: () => void): Promise<boolean> {
  const host = runtime.host;
  const draft = host._markerDialog;
  if (!draft) return Promise.resolve(false);
  const dirty = markerDirty(host, draft);
  const space = host._space, mode = host._mode, intent = runtime.navigationIntent;
  return requestDraftClose({
    host, kind: 'marker', dirty: dirty || runtime._radarSetup.isDirty(),
    current: () => host.isConnected && !!host._markerDialog && host._space === space && host._mode === mode
      && runtime.navigationIntent === intent,
    confirm: request => host._confirmDanger(request),
    request: dirty ? discardRequest(runtime, 'marker', draft.name)
      : radarDiscardRequest(key => host._t(key)),
    surface: closeSurface(host.renderRoot, 'marker'),
    close: () => {
      runtime._radarSetup.reset();
      forgetMarkerBaseline(host);
      finishMarkerDialogClose(host);
      host.requestUpdate();
      after?.();
    },
  });
}

export function requestRoomClose(runtime: HouseplanEditorRuntime, after?: () => void): Promise<boolean> {
  const host = runtime.host;
  if (!host._roomDialog) return Promise.resolve(false);
  const space = host._space, mode = host._mode, intent = runtime.navigationIntent;
  return requestDraftClose({
    host, kind: 'room', dirty: roomDirty(host),
    current: () => host.isConnected && host._roomDialog && host._space === space && host._mode === mode
      && runtime.navigationIntent === intent,
    confirm: request => host._confirmDanger(request),
    request: discardRequest(runtime, 'room', host._nameSel),
    surface: closeSurface(host.renderRoot, 'room'),
    close: () => { runtime._roomDialogCancel(); host.requestUpdate(); after?.(); },
  });
}

/** Resume only after the current form's own discard decision (#851). */
export function guardDraftNavigation(runtime: HouseplanEditorRuntime, navigate: () => void): boolean {
  if (runtime.host._markerDialog) { void requestMarkerClose(runtime, navigate); return false; }
  if (runtime.host._roomDialog) { void requestRoomClose(runtime, navigate); return false; }
  return true;
}
