/** Data-only computation protocol. The worker never receives a host, HA
 * object, credential, service or DOM reference. */
import type { FloorGeometryInput, FloorGeometryFrame } from './floor-geometry-frame';
import type { GeometryWire } from './floor-cache-codec';
import type { LightBarrierRevision } from './glow-scene';
import type { CachePayload } from './floor-cache-store';
import { sha256 } from './sha256';
export const cacheTextChecksum = (text: string): string => Array.from(sha256(text), byte => byte.toString(16).padStart(2, '0')).join('');
export type FloorJob = { kind: 'geometry'; input: FloorGeometryInput; disk?: CachePayload | null; memory?: GeometryWire;
  light?: LightBarrierRevision } | { kind: 'area'; raw: FloorGeometryInput['raw'] }
  | { kind: 'light'; input: FloorGeometryInput; memory: GeometryWire; light: LightBarrierRevision };
export interface FloorJobResult {
  producer?: { owner: 'main' | 'worker'; counts: Record<string, number> };
  wire?: GeometryWire; payload?: CachePayload; light?: GeometryWire; area?: number | null;
  hit?: boolean; work?: FloorGeometryFrame['work']; ms: number;
}
