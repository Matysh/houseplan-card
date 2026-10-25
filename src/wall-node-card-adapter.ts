/** Lazy subsystem port: keeps node transactions out of the View/card core. */
import { NORM_W } from './canvas-constants';
import { langOf, type I18nKey } from './i18n';
import { toolsT, type ToolsI18nKey } from './i18n/tools';
import { WallNodeEditor, type NodeCommandHistory } from './wall-node-editor';
import { nodeAdoptionEpoch, nodeBasisHolds, nodeFloorFingerprint, nodeWriteBasis, writeWallNode,
  type NodeWriteBasis, type WallNodeWriteHost } from './wall-node-write';
import { runNodeHistory, type NodeHistoryStack } from './wall-node-history';
import type { NodeMoveSpace } from './wall-node-move';
import type { ServerConfig } from './types';
import { buildNodePreview, nodeMoveLocalSpaces, nodePreviewScene, nodePreviewJunctionGeometry, type NodePreviewGeometry } from './wall-node-preview';
import { spaceDisplayOf } from './logic';
import type { OpeningCfg } from './types';
import { commitHouseplanEditor } from './live-editor';
import type { JunctionSharedGeometry } from './junction-limits';
import { withWallBooleanBaseline } from './wall-boolean-cache';
import { WallBooleanBaseline } from './wall-boolean-baseline';

interface NodeCardHost<TState> extends WallNodeWriteHost {
  readonly _mode: string; readonly _tool: string;
  readonly _space: string; readonly _canEdit: boolean; readonly _kiosk: boolean;
  readonly _haWallNodeMoveApi: number | null;
  readonly _haWallNodeDeleteApi: number | null;
  readonly _stageEl: HTMLElement | null;
  readonly _config: { language?: string | null } | undefined;
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly updateComplete: Promise<boolean>;
  readonly isConnected: boolean;
  _baseVb(): number[];
  _viewOr(vb: number[]): { w: number };
  _t(key: I18nKey, params?: Record<string, string | number>): string;
  _showToast(text: string, id?: string): void;
  _cancelCameraTransition(commitTarget?: boolean, keepPresented?: boolean): void;
  _geometryHistory: NodeHistoryStack<TState> & { push(command: { name: string; before: TState; after: TState }): void };
  readonly _fillColors: { wall_fill: { c: string; a: number } };
  _openingAmt(opening: OpeningCfg): number;
  _configWriteGuard(): () => boolean;
}
export function createWallNodeEditor<TState extends { nodeMove?: NodeCommandHistory }>(
  host: NodeCardHost<TState>, callbacks: {
    point(event: PointerEvent): number[];
    snapshot(space: NodeMoveSpace): TState | null;
    introduced(candidate: ServerConfig, baseline: ServerConfig, spaceId: string,
      candidateGeometry?: JunctionSharedGeometry, baselineGeometry?: JunctionSharedGeometry): readonly unknown[];
    /** #843: the floor of a node history result can be shown / is shown like ordinary history. */
    canShow(space: string): boolean;
    show(space: string): void;
    delete?: { beforeIntent(retry: () => void): boolean; navigation(): number; blocked(): boolean };
  },
): WallNodeEditor {
  const language = () => langOf(host.hass, host._config?.language);
  let geometry: { source: NodeMoveSpace; candidate: NodeMoveSpace; before: NodePreviewGeometry; next: NodePreviewGeometry } | null = null;
  let ownsLiveLayer = false;
  let baselineGeometry: { authority: ServerConfig; revision: number; space: string; signature: string; value: NodePreviewGeometry;
    proof: JunctionSharedGeometry | undefined; config: ServerConfig; booleans: WallBooleanBaseline } | null = null;
  const retire = (): void => { geometry = null; baselineGeometry = null; };
  // #843: a writer may apply node history in Plan/Background with any tool;
  // capture and handles additionally require Plan/Select.
  const writer = () => host._canEdit && !host._kiosk && host.isConnected;
  const planWriter = () => host._mode === 'plan' && writer();
  const deleteEnabled = () => planWriter() && host.hass.connection?.connected !== false && !callbacks.delete?.blocked();
  const api = () => host._haWallNodeMoveApi === 1;
  const context = () => {
    const result = { enabled: host._mode === 'plan' && host._tool === 'select' && writer(),
      space: host._space, revision: host._cfgRev, api: api() };
    if (!result.enabled || !result.api || (baselineGeometry && (baselineGeometry.authority !== host._serverCfg
        || baselineGeometry.revision !== result.revision || baselineGeometry.space !== result.space))) retire();
    return result;
  };
  const text = (key: string, params?: Record<string, string>): string => key.startsWith('node_move_') || key.startsWith('node_delete')
    ? toolsT(language(), key as ToolsI18nKey, params || { reason: host._t('toast.geometry_unsafe') })
    : host._t(key as I18nKey, params);
  const toast = (message: string, id?: string): void => host._showToast(message, id);
  const write = (history: NodeCommandHistory, basis: NodeWriteBasis | null,
    current: () => boolean = () => true): Promise<ServerConfig> => {
    retire();
    const claim = history.kind === 'delete' ? host._configWriteGuard() : null;
    const authority = () => host.isConnected && host.hass.connection?.connected !== false && !!claim?.();
    return writeWallNode(host, history, basis ?? nodeWriteBasis(host, history.beforeSpace.id), claim ? {
      send: () => authority() && writer() && ['plan', 'decor'].includes(host._mode)
        && host._haWallNodeDeleteApi === 1 && current(),
      accept: authority,
    } : null);
  };
  const validate = (space: NodeMoveSpace, before: NodeMoveSpace, supported: boolean, deleting = false): boolean => {
    const ctx = context(), authority = host._serverCfg;
    if (!(deleting ? deleteEnabled() : ctx.enabled) || !supported || !authority) { retire(); return false; }
    try {
      const [localBefore, localNext] = nodeMoveLocalSpaces(before, space);
      const config = { ...authority, spaces: [localNext] };
      // One bounded immutable baseline may survive an Esc retry. Snapshot
      // identity changes on every capture; the full selected config covers
      // geometry AND proof inputs, including in-place settings mutations.
      const signature = JSON.stringify({ ...authority, spaces: [localBefore] });
      if (baselineGeometry?.signature !== signature) retire();
      if (geometry?.candidate === space && geometry.source === before) return geometry.next.safe;
      let baseline = baselineGeometry;
      if (!baseline) {
        const booleans = new WallBooleanBaseline();
        const snapshot = JSON.parse(signature) as ServerConfig;
        const value = withWallBooleanBaseline(booleans, true, () => buildNodePreview(snapshot.spaces[0] as NodeMoveSpace));
        baseline = { authority, revision: ctx.revision, space: ctx.space, signature, value,
          proof: nodePreviewJunctionGeometry(value, false), config: snapshot, booleans };
        // A failed baseline is never carried into another independent retry.
        if (value.safe) baselineGeometry = baseline;
      }
      const old = baseline.value;
      const next = withWallBooleanBaseline(baseline.booleans, false, () => buildNodePreview(localNext));
      next.safe &&= !callbacks.introduced(config, baseline.config, space.id,
        nodePreviewJunctionGeometry(next), baseline.proof).length;
      geometry = { source: before, candidate: space, before: old, next };
      return next.safe;
    }
    catch { retire(); return false; }
  };
  const recordCommand = (history: NodeCommandHistory, afterSpace: NodeMoveSpace): void => {
    const before = callbacks.snapshot(history.beforeSpace), after = callbacks.snapshot(afterSpace);
    if (!before || !after) return;
    // The same stack and exact accepted floor serve Move and Delete.
    before.nodeMove = { ...history, direction: 'undo', floor: nodeFloorFingerprint(afterSpace) };
    after.nodeMove = { ...history, direction: 'apply' };
    host._geometryHistory.push({ name: toolsT(language(), history.kind === 'delete' ? 'node_delete_history' : 'node_move_history'), before, after });
  };
  const editor = new WallNodeEditor({
    document: host.renderRoot.ownerDocument,
    context,
    dispose: retire,
    config: () => host._serverCfg,
    screenPoint: ev => { const p = callbacks.point(ev); return [p[0] / NORM_W, p[1] / NORM_W]; },
    unitsPerPixel: () => host._viewOr(host._baseVb()).w / Math.max(1, host._stageEl?.clientWidth || 1) / NORM_W,
    stage: () => host._stageEl, root: () => host.renderRoot,
    text, toast,
    freezeViewport: () => host._cancelCameraTransition(false, true),
    changed: () => { if (editor.dragging) {
      // Capture hands the generic editor layer over once. Subsequent moves
      // paint only the node-owned groups; a full host update already commits
      // the generic layer through _commitLiveEditor before repainting nodes.
      if (!ownsLiveLayer) { commitHouseplanEditor(host); ownsLiveLayer = true; }
      editor.paint();
    } else { ownsLiveLayer = false; geometry = null; context(); host.requestUpdate(); } },
    validate: (space, before) => validate(space, before, api()),
    scene: (space, before) => {
      if (!geometry || geometry.candidate !== space || geometry.source !== before) return null;
      if (geometry.next.geometry.status === 'failed-core' || geometry.next.geometry.status === 'degraded-extra') return null;
      const display = spaceDisplayOf(before, host._serverCfg?.settings);
      return nodePreviewScene(geometry.before, geometry.next, { px: 1 / (editor.unitsPerPixel * NORM_W),
        color: display.color, fill: display.wallFill.c, opacity: display.wallFill.a,
        amount: opening => host._openingAmt(opening) });
    },
    paintOpportunity: async () => { await host.updateComplete;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); },
    write,
    basis: space => nodeWriteBasis(host, space),
    holds: basis => nodeBasisHolds(host, basis),
    record: (beforeSpace, afterSpace, intent) => recordCommand({ beforeSpace, intent, direction: 'apply' }, afterSpace),
    delete: callbacks.delete ? {
      context: () => ({ ...context(), enabled: deleteEnabled(),
        api: host._haWallNodeDeleteApi === 1 }),
      navigation: callbacks.delete.navigation, beforeIntent: callbacks.delete.beforeIntent,
      claim: () => host._configWriteGuard(), epoch: () => nodeAdoptionEpoch(host),
      basis: space => nodeWriteBasis(host, space),
      validate: (space, before) => validate(space, before, host._haWallNodeDeleteApi === 1, true),
      write, record: recordCommand,
    } : undefined,
    history: direction => runNodeHistory<TState>({
      enabled: () => ['plan', 'decor'].includes(host._mode) && writer(),
      api: history => history.kind === 'delete' ? host._haWallNodeDeleteApi === 1 : api(),
      epoch: () => nodeAdoptionEpoch(host), stack: () => host._geometryHistory,
      canShow: callbacks.canShow, show: callbacks.show, write, text, toast,
    }, direction),
  });
  return editor;
}
