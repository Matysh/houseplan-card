/** Memory-only identity of the exact source pair a person confirmed. */
export interface OptimizeSource {
  configRev: number;
  layoutRev: number;
  configFingerprint: string;
  layoutFingerprint: string;
  ownersFingerprint: string;
  connection: unknown;
  /** Existing ConfigWriteContext claim, captured with this memory-only preview. */
  authorityCurrent?: () => boolean;
}

export function sameOptimizeSource(a: OptimizeSource, b: OptimizeSource): boolean {
  return a.authorityCurrent?.() !== false && b.authorityCurrent?.() !== false
    && a.configRev === b.configRev && a.layoutRev === b.layoutRev
    && a.configFingerprint === b.configFingerprint && a.layoutFingerprint === b.layoutFingerprint
    && a.ownersFingerprint === b.ownersFingerprint && a.connection === b.connection;
}

export class OptimizePreviewChangedError extends Error {
  readonly code = 'optimize_preview_changed';
  constructor() { super('The optimization preview source changed'); }
}

/** Rechecked after a queued writer finished and immediately before sending. */
export interface OptimizeWriteGuard {
  source: OptimizeSource;
  current(): OptimizeSource;
  canWrite(): boolean;
}
