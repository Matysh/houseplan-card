import type { DevicePlacement } from './device-position-history';
import type { OpeningDimension } from './opening-dimensions';
import type { OpeningPlacementCore } from './opening-placement';
import type { OpeningFaceOffset } from './opening-symbol-placement';
import type { ResolvedPartitionOpening, PartitionOpeningOrphanReason } from './partition-openings';
import type { OpeningCfg } from './types';

/** Opening rulers shared by the card shell and lazy editor runtime. */
export interface OpMeasure {
  labels: Array<{ x: number; y: number; text: string; dimension?: OpeningDimension }>;
  guide: { x: number; y: number; angle: number } | null;
}

export type OpeningPlacementCandidate = Omit<OpeningPlacementCore, 'measure'> & {
  face: OpeningFaceOffset;
  measure: OpMeasure;
};

export type RenderOpening = OpeningCfg & {
  rx: number; ry: number; rlen: number;
  partitionHost?: ResolvedPartitionOpening;
  orphanReason?: PartitionOpeningOrphanReason;
};

export interface DeviceDragState {
  id: string;
  spaceId: string;
  displayName: string;
  pointerId: number;
  source: Element | null;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
  before: DevicePlacement | null;
  start: DevicePlacement;
}
