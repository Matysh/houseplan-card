/** #803: serialize with existing writers without optimistic geometry adoption.
 * #843: the expected revision is read after this tab's own write queue. */
import type { ConfigAdoption } from './config-adoption';
import type { ServerConfig } from './types';
import type { NodeMoveHistory } from './wall-node-editor';
import { contentFingerprint } from './visual-continuity';

export interface WallNodeWriteHost {
  hass: { callWS<T>(message: Record<string, unknown>): Promise<T> };
  readonly _serverCfg: ServerConfig | null;
  readonly _cfgRev: number;
  readonly _adoption: ConfigAdoption;
  _writeChain: Promise<void>;
  _saveConfigDebounced: { (): void; pending(): boolean; flush(): void };
  _cfgEpoch: number;
  _cacheSnapshot(): void;
  _reloadRejectedPhysicalWrite(): Promise<void>;
  requestUpdate(): void;
}

/** What a node command starts from: the adoption epoch and its exact target floor. */
export interface NodeWriteBasis { epoch: number; space: string; floor: string }

/** Target floor content, key-order independent like the server's own comparison. */
export const nodeFloorFingerprint = (space: unknown): string =>
  space ? contentFingerprint(JSON.parse(JSON.stringify(space))) : '';

const floorOf = (config: ServerConfig | null, id: string): string =>
  nodeFloorFingerprint(config?.spaces.find(space => space.id === id));

/** Moves on any identity change but our own accepted write (`ConfigAdoption.adoptionEpoch`). */
export const nodeAdoptionEpoch = (host: WallNodeWriteHost): number => host._adoption.adoptionEpoch;

export const nodeWriteBasis = (host: WallNodeWriteHost, space: string): NodeWriteBasis =>
  ({ epoch: nodeAdoptionEpoch(host), space, floor: floorOf(host._serverCfg, space) });

/** Only own accepted writes moved the revision since `basis`, and the target floor is that floor. */
export const nodeBasisHolds = (host: WallNodeWriteHost, basis: NodeWriteBasis): boolean => {
  const now = nodeWriteBasis(host, basis.space);
  return now.epoch === basis.epoch && now.floor === basis.floor;
};

const failedQueues = new WeakSet<Promise<void>>();
/**
 * #843: everything this tab still has to say is written first. A failed own
 * write is never overtaken by the node request: this attempt is refused and
 * the next one sends the live config again before it.
 */
async function settleOwnQueue(host: WallNodeWriteHost): Promise<void> {
  const deferred = host._saveConfigDebounced, chain = () => host._writeChain;
  if (failedQueues.has(chain())) deferred();
  for (let turn = 0; turn < 8; turn++) {
    if (deferred.pending()) deferred.flush();
    const queue = chain();
    try { await queue; } catch (cause) {
      failedQueues.add(queue);
      throw Object.assign(new Error('node-own-queue'), { cause });
    }
    if (queue === chain() && !deferred.pending()) return;
  }
  throw new Error('node-own-queue');
}

export async function writeWallNode(
  host: WallNodeWriteHost, history: NodeMoveHistory, basis: NodeWriteBasis,
): Promise<ServerConfig> {
  // Nothing is sent and nothing reloaded when the own queue fails: the local
  // edit and the history stay as they are.
  await settleOwnQueue(host);
  const live = () => JSON.stringify(host._serverCfg);
  let accepted: ServerConfig | null = null;
  const work = host._writeChain.then(async () => {
    // Own accepted writes may have advanced the revision. A foreign adoption or
    // another target floor never lets the frozen operation through.
    if (!nodeBasisHolds(host, basis)) throw new Error('stale-node-snapshot');
    const revision = host._cfgRev, identity = live();
    const response = await host.hass.callWS<{ config: ServerConfig; rev: number }>({
      type: 'houseplan/wall/node_move', space_id: history.beforeSpace.id,
      expected_rev: revision, intent: history.intent, direction: history.direction,
      ...(history.direction === 'undo' ? { before_space: history.beforeSpace } : {}),
    });
    if (!response.config || !Number.isSafeInteger(response.rev)) throw new Error('invalid-node-response');
    // A newer adoption always wins. Our own echo is safe but an unrelated local
    // edit must never be overwritten by a response to this frozen operation.
    const current = live();
    if (host._cfgRev > response.rev || (current !== identity && current !== JSON.stringify(response.config)))
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
