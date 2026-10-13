/**
 * One geometry history step of the plan editor (#843). The card and the editor
 * runtime used to declare this shape twice; both now share this declaration.
 */
import type { CommandStack } from './command-stack';
import type { DecorShape } from './editors/decor/types';
import type { OpenSpanEntry } from './open-spans';
import type { MarkerRoomReferenceSnapshot } from './room-reference-transaction';
import type { Stair } from './stairs';
import type { OpeningCfg, PartitionCfg, WallColumnCfg } from './types';
import type { NodeMoveHistory } from './wall-node-editor';
import type { WallEntry } from './wall-thickness';

/** Everything whose topology or wall association changes in the plan editor. */
export interface SpaceGeometryState {
  /** #843: a server-applied node command; never restored as local state. */
  nodeMove?: NodeMoveHistory;
  spaceId: string;
  rooms: any[];
  openings?: OpeningCfg[];
  walls?: WallEntry[];
  wall_segments?: any[];
  open_spans?: OpenSpanEntry[];
  partitions?: PartitionCfg[];
  wall_columns?: WallColumnCfg[];
  decor?: DecorShape[];
  stairs?: Stair[];
  plan_transform: {
    plan_x?: number; plan_y?: number; plan_scale?: number;
    plan_scale_x?: number; plan_scale_y?: number; plan_angle?: number;
  };
  /** Session-only: current-writer normalisation scope for wall-chain history. */
  wallChainSeedIds?: string[];
  /** Session-only: exact room fields touched by Delete/Merge room. */
  roomReferences?: MarkerRoomReferenceSnapshot[];
}

/** #843: the next history step is a node command, applied by its server transaction. */
export const nodeHistoryNext = (
  stack: Pick<CommandStack<SpaceGeometryState>, 'peekUndo' | 'peekRedo'>, direction: 'undo' | 'redo',
): boolean => !!(direction === 'undo' ? stack.peekUndo()?.before : stack.peekRedo()?.after)?.nodeMove;
