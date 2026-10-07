/** Lazy subsystem port: keeps node transactions out of the View/card core. */
import { NORM_W } from './canvas-constants';
import { langOf, type I18nKey } from './i18n';
import { toolsT, type ToolsI18nKey } from './i18n/tools';
import { WallNodeEditor, type NodeMoveHistory } from './wall-node-editor';
import { writeWallNode, type WallNodeWriteHost } from './wall-node-write';
import type { NodeMoveSpace } from './wall-node-move';
import type { ServerConfig } from './types';
import { buildNodePreview, nodeMoveLocalSpaces, nodePreviewScene, type NodePreviewGeometry } from './wall-node-preview';
import { spaceDisplayOf } from './logic';
import type { OpeningCfg } from './types';
import { commitHouseplanEditor } from './live-editor';

interface NodeCardHost<TState> extends WallNodeWriteHost {
  readonly _mode: string; readonly _tool: string;
  readonly _space: string; readonly _canEdit: boolean; readonly _kiosk: boolean;
  readonly _haWallNodeMoveApi: number | null;
  readonly _stageEl: HTMLElement | null;
  readonly _config: { language?: string | null } | undefined;
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly updateComplete: Promise<boolean>;
  readonly isConnected: boolean;
  _baseVb(): number[];
  _viewOr(vb: number[]): { w: number };
  _t(key: I18nKey, params?: Record<string, string | number>): string;
  _showToast(text: string): void;
  _geometryHistory: { push(command: { name: string; before: TState; after: TState }): void; clear(): void };
  readonly _fillColors: { wall_fill: { c: string; a: number } };
  _openingAmt(opening: OpeningCfg): number;
}
export function createWallNodeEditor<TState extends { nodeMove?: NodeMoveHistory }>(
  host: NodeCardHost<TState>, callbacks: {
    point(event: PointerEvent): number[];
    snapshot(space: NodeMoveSpace): TState | null;
    introduced(candidate: ServerConfig, baseline: ServerConfig, spaceId: string): readonly unknown[];
  },
): WallNodeEditor {
  const language = () => langOf(host.hass, host._config?.language);
  let geometry: { source: NodeMoveSpace; candidate: NodeMoveSpace; before: NodePreviewGeometry; next: NodePreviewGeometry } | null = null;
  const editor = new WallNodeEditor({
    document: host.renderRoot.ownerDocument,
    context: () => ({ enabled: host._mode === 'plan' && host._tool === 'select'
      && host._canEdit && !host._kiosk && host.isConnected,
      space: host._space, revision: host._cfgRev, api: host._haWallNodeMoveApi === 1 }),
    config: () => host._serverCfg,
    screenPoint: ev => { const p = callbacks.point(ev); return [p[0] / NORM_W, p[1] / NORM_W]; },
    unitsPerPixel: () => host._viewOr(host._baseVb()).w / Math.max(1, host._stageEl?.clientWidth || 1) / NORM_W,
    stage: () => host._stageEl, root: () => host.renderRoot,
    text: (key, params) => key.startsWith('node_move_')
      ? toolsT(language(), key as ToolsI18nKey, params || { reason: host._t('toast.geometry_unsafe') })
      : host._t(key as I18nKey, params),
    toast: text => host._showToast(text),
    changed: () => { if (editor.dragging) { commitHouseplanEditor(host); editor.paint(); }
      else { geometry = null; host.requestUpdate(); } },
    validate: (space, before) => {
      if (!host._serverCfg) return false;
      if (geometry?.candidate === space && geometry.source === before) return geometry.next.safe;
      try {
        const [localBefore, localNext] = nodeMoveLocalSpaces(before, space);
        const config = { ...host._serverCfg, spaces: [localNext] };
        const baseline = { ...host._serverCfg, spaces: [localBefore] };
        const old = buildNodePreview(localBefore), next = buildNodePreview(localNext);
        next.safe &&= !callbacks.introduced(config, baseline, space.id).length;
        geometry = { source: before, candidate: space, before: old, next };
        return next.safe;
      }
      catch { return false; }
    },
    scene: (space, before) => {
      if (!geometry || geometry.candidate !== space || geometry.source !== before) return null;
      if (geometry.next.geometry.status === 'failed-core' || geometry.next.geometry.status === 'degraded-extra') return null;
      const display = spaceDisplayOf(before);
      return nodePreviewScene(geometry.before, geometry.next, { px: 1 / (editor.unitsPerPixel * NORM_W),
        color: display.color, fill: host._fillColors.wall_fill.c, opacity: host._fillColors.wall_fill.a,
        amount: opening => host._openingAmt(opening) });
    },
    paintOpportunity: async () => { await host.updateComplete;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); },
    write: (history, revision) => writeWallNode(host, history, revision),
    record: (beforeSpace, afterSpace, intent) => {
      const before = callbacks.snapshot(beforeSpace), after = callbacks.snapshot(afterSpace);
      if (!before || !after) return;
      before.nodeMove = { beforeSpace, intent, direction: 'undo' };
      after.nodeMove = { beforeSpace, intent, direction: 'apply' };
      host._geometryHistory.push({ name: toolsT(language(), 'node_move_history'), before, after });
    },
    historyFailed: () => host._geometryHistory.clear(),
  });
  return editor;
}
