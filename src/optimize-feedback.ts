/** Optimize-only presentation evidence. Never infer persistence from an error message. */
import type { ServerConfig } from './types';
import type { DeviceLayout } from './device-position-history';
import type { OptimizeSource } from './optimize-source';

export type OptimizeWriteStage = 'before-dispatch' | 'dispatched' | 'acknowledged';
export interface OptimizeReceipt {
  config: ServerConfig;
  layout: DeviceLayout;
  configRev: number;
  layoutRev: number;
  canUndo: boolean;
  /** Older compatible servers confirm revisions without echoing canonical bodies. */
  canonical: boolean;
}
export type OptimizeFailureKind = 'geometry' | 'rights' | 'version' | 'resource'
  | 'changed' | 'load' | 'prepare' | 'unknown';
const codes = new Set([
  'conflict', 'unauthorized', 'wall_model_client_outdated', 'model-version', 'resource',
  'too_large', 'missing_plan', 'invalid_format', 'optimize_preview_changed', 'context-changed',
  'optimize_ack_unconfirmed', 'commit_failed', 'not_ready', 'upload_unavailable', 'upload_failed',
  'invalid_upload', 'upload_expired', 'invalid_payload', 'storage_read', 'storage_clear',
  'format', 'range', 'graph-missing', 'zero-length', 'third-owner', 'duplicate-id',
  'invalid-room', 'thickness-conflict', 'opening-host', 'optimize-target',
  'optimize-target-conflict', 'optimize-cycle', 'dependency-intersection',
  'optimize-seam-cycle', 'optimize-thickness-conflict', 'node-id', 'edge-id', 'thickness',
  'props', 'room', 'room-edge', 'open-cycle', 'room-area', 'self-intersection',
  'unsplit-crossing', 'dependency', 'dependency-support', 'dependency-parameter',
  'dependency-value', 'dependency-cycle', 'dependency-node', 'host', 'host-projection',
  'host-parameter', 'projection',
]);
const serverRefusals = new Set(['conflict', 'unauthorized', 'wall_model_client_outdated',
  'invalid_format', 'too_large', 'missing_plan']);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function optimizeErrorCode(error: unknown): string {
  const item = record(error) ? error : {};
  const code = item.code ?? item.reason;
  return typeof code === 'string' && codes.has(code) ? code : 'unknown';
}

/** Carries dispatch evidence out of the narrow writer; unrelated writers stay unchanged. */
export class OptimizeWriteFailure extends Error {
  readonly code: string;
  readonly serverRefusal: boolean;
  constructor(error: unknown, public readonly stage: OptimizeWriteStage,
    public readonly receipt?: OptimizeReceipt) {
    super('Optimize did not complete locally');
    this.name = 'OptimizeWriteFailure';
    this.code = optimizeErrorCode(error);
    this.serverRefusal = stage === 'dispatched' && serverRefusals.has(this.code);
  }
}

export interface OptimizeFailure {
  kind: OptimizeFailureKind;
  code: string;
  stage: 'loading' | 'checking' | 'refreshing' | OptimizeWriteStage;
  spaceId?: string;
  spaceName?: string;
  roomName?: string;
  subject?: string;
}

/** Only a unique match in the actual source can name an affected place. */
export function optimizeFailure(error: unknown, config: ServerConfig | null,
  stage: OptimizeFailure['stage']): OptimizeFailure {
  const code = optimizeErrorCode(error);
  const sent = error instanceof OptimizeWriteFailure;
  const unknownWrite = stage === 'dispatched' && (!sent || !error.serverRefusal);
  const item = record(error) ? error : {};
  const kind: OptimizeFailureKind = unknownWrite ? 'unknown'
    : code === 'unauthorized' ? 'rights'
    : code === 'wall_model_client_outdated' || code === 'model-version' ? 'version'
    : ['resource', 'too_large', 'missing_plan'].includes(code) ? 'resource'
    : ['conflict', 'optimize_preview_changed', 'context-changed'].includes(code) ? 'changed'
    : stage === 'loading' ? 'load'
    : ['PlanGraphError', 'PlanExactError', 'WallSegmentModelError'].includes(String(item.name))
      ? 'geometry' : 'prepare';
  const result: OptimizeFailure = { kind, code, stage };
  // Arbitrary exception strings are not location evidence (nor diagnostic data).
  if (!['PlanGraphError', 'WallSegmentModelError'].includes(String(item.name))
    || typeof item.subject !== 'string' || !item.subject) return result;
  const subject = item.subject;
  const matches = (config?.spaces || []).filter(space => space.id === subject
    || space.rooms?.some(room => room.id === subject)
    || space.openings?.some(opening => opening.id === subject)
    || space.plan_graph?.nodes.some(node => node.id === subject)
    || space.plan_graph?.edges.some(edge => edge.id === subject || `${edge.kind}:${edge.id}` === subject));
  if (matches.length !== 1) return result;
  const space = matches[0];
  result.spaceId = space.id;
  result.spaceName = space.title || undefined;
  result.roomName = space.rooms?.find(room => room.id === subject)?.name || undefined;
  result.subject = subject;
  return result;
}

/** Small memory-only shell; renders even before the optimizer chunk has arrived. */
export interface OptimizeStatusState {
  phase: 'loading' | 'checking' | 'refreshing' | 'failure' | 'unknown';
  config: ServerConfig | null;
  source: OptimizeSource;
  busy: boolean;
  failure?: OptimizeFailure;
  refreshFailed?: boolean;
}

export function optimizeFailureDiagnostics(failure: OptimizeFailure, source: OptimizeSource,
  versions: { card: string; integration: string | null }): object {
  return {
    kind: 'houseplan-optimize', stage: failure.stage, reason: failure.code,
    outcome: failure.kind, versions, configRev: source.configRev, layoutRev: source.layoutRev,
    configFingerprint: source.configFingerprint, layoutFingerprint: source.layoutFingerprint,
    ...(failure.spaceId && failure.spaceId.length <= 256 ? { spaceId: failure.spaceId } : {}),
    ...(failure.subject && failure.subject.length <= 256 ? { subject: failure.subject } : {}),
  };
}

const revision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export function optimizeReceipt(response: unknown, config: ServerConfig, layout: DeviceLayout,
  expectedConfig: number, expectedLayout: number): OptimizeReceipt {
  if (!record(response) || response.ok !== true || !revision(response.config_rev)
    || !revision(response.layout_rev) || response.config_rev <= expectedConfig
    || response.layout_rev <= expectedLayout || typeof response.can_undo !== 'boolean')
    throw Object.assign(new Error('Optimize ACK incomplete'), { code: 'optimize_ack_unconfirmed' });
  const echoed = response.config !== undefined || response.layout !== undefined;
  if (echoed && (!record(response.config) || !Array.isArray(response.config.spaces) || !record(response.layout)))
    throw Object.assign(new Error('Optimize pair incomplete'), { code: 'optimize_ack_unconfirmed' });
  return { config: echoed ? response.config as unknown as ServerConfig : config,
    layout: echoed ? response.layout as DeviceLayout : layout, canonical: echoed,
    configRev: response.config_rev, layoutRev: response.layout_rev, canUndo: response.can_undo };
}
