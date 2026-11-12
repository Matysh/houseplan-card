/** Read-only presentation contract shared by every editor dimension. Producers
 * retain ownership of geometry, reference choice and snapping. Units are the
 * native render plane; the only physical scalar is lengthCm. */
export type DimensionPoint = readonly [number, number];
export interface EditorDimensionRecord {
  id: string;
  role?: 'opening-gap' | 'decor-line' | 'device-spacing';
  source: 'physical' | 'boundary' | 'axis' | 'unavailable';
  from: DimensionPoint | null; to: DimensionPoint | null;
  normal: DimensionPoint; lengthCm: number | null;
  /** Defines ticks even when a legitimate gap is zero. */
  direction?: DimensionPoint;
  /** Extra clearance in render units (device shells), not moved supports. */
  clearance?: number;
  anchor?: DimensionPoint;
  carrier?: string; side?: -1 | 1;
  referenceSource?: string; roomId?: string;
}
