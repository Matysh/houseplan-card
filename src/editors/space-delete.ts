/** #819: one post-confirmation deletion path for editor and onboarding. */
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import { collectSpaceMarkerDependencies, type SpaceDeletionDependencyReport } from '../space-deletion';
import { revealSpaceDeleteBlocker } from './space-form';

/** Call only after an accepted confirmation; re-resolve its target before writing. */
export async function completeSpaceDeletion(
  host: HouseplanEditorHostPort,
  spaceId: string,
  dependencies: SpaceDeletionDependencyReport,
  removeMarkers = false,
): Promise<void> {
  const currentDialog = host._spaceDialog;
  const currentConfig = host._serverCfg;
  if (!currentDialog || currentDialog.mode !== 'edit'
    || currentDialog.busy || currentDialog.spaceId !== spaceId || !currentConfig) return;
  if (!currentConfig.spaces.some((space) => space.id === spaceId)) return;
  const currentDependencies = collectSpaceMarkerDependencies(
    currentConfig, host._layout || {}, spaceId,
  );
  const currentlyDeletingLastSpace = currentConfig.spaces.length === 1
    && currentConfig.spaces[0]?.id === spaceId;
  // #819 AC4: the plan moved under the confirmation — nothing is deleted.
  if (removeMarkers ? `${currentDependencies.markerIds}` !== `${dependencies.markerIds}`
    : currentDependencies.count && !currentlyDeletingLastSpace) {
    host._spaceDialog = { ...currentDialog, deleteBlockers: currentDependencies.count };
    void revealSpaceDeleteBlocker(host);
    return;
  }
  host._spaceDialog = { ...currentDialog, deleteBlockers: 0, busy: true };
  try {
    if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
    if (host._persistLayout.pending()) host._persistLayout.flush();
    await host._writeChain;
    await host.hass.callWS({
      type: 'houseplan/space/delete',
      space_id: spaceId,
      expected_config_rev: host._cfgRev,
      expected_layout_rev: host._layoutRev,
      // Only when asked: an older integration refuses an unknown key.
      ...(removeMarkers ? { remove_markers: true } : {}),
    });
    const [configResponse, layoutResponse] = await Promise.all([
      host._getAuthoritativeConfig(),
      host.hass.callWS({ type: 'houseplan/layout/get' }),
    ]);
    // #500: revisions come with re-read bodies, never from the delete reply.
    const adopted = await host._adoptAuthoritative({
      cfgResp: configResponse, layResp: layoutResponse, reason: 'space-delete', profile: 'post-write',
    });
    // Asset wait: the scheduled reload owns the tail; nothing has been adopted.
    if (adopted.status !== 'adopted') {
      host._spaceDialog = { ...currentDialog, busy: false };
      host.requestUpdate();
      return;
    }
    host._spaceDialog = null;
    if (host._space === spaceId) host._commitSpace(host._serverCfg!.spaces[0]?.id || '');
    host._regSignature = '';
    host._maybeRebuildDevices();
    host._showToast(host._t('toast.space_deleted'));
  } catch (error: unknown) {
    const failure = error as { code?: string };
    if (failure?.code === 'conflict' || failure?.code === 'space_in_use') {
      await Promise.all([host._reloadConfigOnly(true), host._reloadLayoutOnly()]);
    }
    const refreshedConfig = host._serverCfg;
    if (host._spaceDialog && refreshedConfig) {
      const refreshed = collectSpaceMarkerDependencies(refreshedConfig, host._layout || {}, spaceId);
      const stillLastSpace = refreshedConfig.spaces.length === 1
        && refreshedConfig.spaces[0]?.id === spaceId;
      host._spaceDialog = {
        ...host._spaceDialog, busy: false, deleteBlockers: stillLastSpace ? 0 : refreshed.count,
      };
      if (!stillLastSpace && refreshed.count) void revealSpaceDeleteBlocker(host);
    }
    host._showToast(host._t('toast.delete_failed', { err: host._errText(error) }));
  }
}
