/** #803: serialize with existing writers without optimistic geometry adoption. */
import type { ConfigAdoption } from './config-adoption';
import type { ServerConfig } from './types';
import type { NodeMoveHistory } from './wall-node-editor';

export interface WallNodeWriteHost {
  hass: { callWS<T>(message: Record<string, unknown>): Promise<T> };
  readonly _serverCfg: ServerConfig | null;
  readonly _cfgRev: number;
  readonly _adoption: ConfigAdoption;
  _writeChain: Promise<void>;
  _saveConfigDebounced: { pending(): boolean; flush(): void };
  _cfgEpoch: number;
  _cacheSnapshot(): void;
  _reloadRejectedPhysicalWrite(): Promise<void>;
  requestUpdate(): void;
}
export async function writeWallNode(
  host: WallNodeWriteHost, history: NodeMoveHistory, expectedRevision: number,
): Promise<ServerConfig> {
  if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
  const identity = JSON.stringify(host._serverCfg);
  let accepted: ServerConfig | null = null;
  const work = host._writeChain.then(async () => {
    if (host._cfgRev !== expectedRevision || JSON.stringify(host._serverCfg) !== identity)
      throw new Error('stale-node-snapshot');
    const response = await host.hass.callWS<{ config: ServerConfig; rev: number }>({
      type: 'houseplan/wall/node_move', space_id: history.beforeSpace.id,
      expected_rev: expectedRevision, intent: history.intent, direction: history.direction,
      ...(history.direction === 'undo' ? { before_space: history.beforeSpace } : {}),
    });
    if (!response.config || !Number.isSafeInteger(response.rev)) throw new Error('invalid-node-response');
    // A newer adoption always wins. Our own echo is safe but an unrelated local
    // edit must never be overwritten by a response to this frozen operation.
    if (host._cfgRev > response.rev || (JSON.stringify(host._serverCfg) !== identity
        && JSON.stringify(host._serverCfg) !== JSON.stringify(response.config)))
      throw new Error('superseded-node-response');
    host._adoption.stageConfigCandidate(response.config);
    host._adoption.acceptConfigWrite(response.config, response);
    host._cfgEpoch++; host._cacheSnapshot(); host.requestUpdate();
    accepted = response.config;
  });
  host._writeChain = work.catch(() => {});
  try { await work; }
  catch (error) {
    // Nothing provisional ever entered config. Reload still advances a stale
    // revision after a refused request, before the next independent writer.
    await host._reloadRejectedPhysicalWrite();
    throw error;
  }
  if (!accepted) throw new Error('missing-node-result');
  return accepted;
}
