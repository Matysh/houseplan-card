import type { HpConfirmRequest } from './danger-confirm';
import type { HouseplanEditorRuntime } from './houseplan-editor-runtime';
import { dialogSession } from './editors/dialog-baseline';

/** One navigation intent; a later gesture/lifecycle retires its answer. */
export class EditorChainExit {
  private sequence = 0;
  private pending = false;

  constructor(
    private readonly confirm: (request: HpConfirmRequest) => Promise<boolean>,
    private readonly cancel: () => void,
  ) {}

  invalidate(): void {
    this.sequence++;
    if (this.pending) { this.pending = false; this.cancel(); }
  }

  request(options: {
    request: HpConfirmRequest;
    current: () => boolean;
    leave: () => void;
    navigate: () => void;
  }): void {
    this.invalidate();
    const sequence = this.sequence;
    this.pending = true;
    void this.confirm(options.request).then(accepted => {
      if (sequence !== this.sequence) return;
      this.pending = false;
      if (!accepted || !options.current()) return;
      options.leave();
      options.navigate();
    });
  }
}

/** Failed finalization never authorizes deleting or rewriting saved walls. */
export function finishWallChainForNavigation(
  runtime: HouseplanEditorRuntime, navigate: () => void, interactive = true,
): boolean {
  runtime.chainExit.invalidate();
  if (runtime._finishWallChain()) return true;
  if (!interactive) { runtime._cancelPath(); return true; }
  const host = runtime.host;
  const space = host._space, mode = host._mode, tool = host._tool;
  const revision = host._cfgRev, epoch = host._cfgEpoch;
  const chain = host._activeWallChainId;
  const session = () => JSON.stringify([host._path, host._activeWallChainPartitionIds, host._wallChainSegmentCms]);
  const snapshot = session();
  const room = dialogSession(host, 'room'), marker = dialogSession(host, 'marker');
  const saved = !host._pendingPhysicalWrites.has(space) && !host._writesPending
    && host._activeWallChainPartitionIds.length > 0;
  runtime.chainExit.request({
    request: {
      key: 'leave-unfinished-wall-chain', kind: 'warning',
      title: host._t('editor.chain_finish_failed_title'),
      message: host._t(saved ? 'editor.chain_finish_failed_message' : 'editor.chain_finish_pending_message'),
      confirmLabel: host._t('editor.leave_unfinished'), cancelLabel: host._t('editor.keep_editing'),
    },
    current: () => host.isConnected && host._canEdit && !host._kiosk
      && host._space === space && host._mode === mode && host._tool === tool
      && host._cfgRev === revision && host._cfgEpoch === epoch
      && host._activeWallChainId === chain && session() === snapshot
      && dialogSession(host, 'room') === room && dialogSession(host, 'marker') === marker,
    leave: () => { runtime._cancelPath(); host.requestUpdate(); }, navigate,
  });
  return false;
}
