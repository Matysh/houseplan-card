import { isPlanHost, planHostFrom, planHostOf, type PlanHostProvider } from './ha-plan-host';

/** Runtime-only identity fence: options and same-authority reconnects are not a new host (#890). */
const authority = (input: unknown) => {
  const host = planHostFrom(input);
  return {
    key: host.authorityKey,
    ready: host.environment.ready,
    // Legacy helper callers replace HA state objects. Their adapter-local
    // counter is not an epoch; the card supplies its stable PlanHost instead.
    revision: isPlanHost(input) ? host.writeAuthorityRevision : undefined,
    rights: JSON.stringify(host.environment.permissions),
  };
};

/** Capture the existing authority generation, never a replaceable HA state snapshot.
 * Small standalone writer ports may omit the card's generation owner; their
 * fallback still fences the captured connection/user (or connection-less WS).
 */
export function captureWriteAuthority(host: PlanHostProvider & {
  _configWriteGuard?: () => () => boolean;
}): () => boolean {
  const generationCurrent = host._configWriteGuard?.();
  const captured = planHostOf(host);
  const key = captured.authorityKey, revision = captured.writeAuthorityRevision;
  return () => {
    const current = planHostOf(host);
    return generationCurrent?.() !== false && current.environment.ready
      && current.authorityKey === key && current.writeAuthorityRevision === revision;
  };
}

/** Save context differs from export/import; all other errors keep their own mapping. */
export function configWriteErrorKey(error: unknown): 'err.config_write_unauthorized'
  | 'err.config_context_changed' | 'backup.error.storage_clear' | 'backup.error.storage_read' | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === 'unauthorized') return 'err.config_write_unauthorized';
  if (code === 'context-changed') return 'err.config_context_changed';
  return code === 'storage_clear' ? 'backup.error.storage_clear'
    : code === 'storage_read' ? 'backup.error.storage_read' : null;
}

export class ConfigWriteContext {
  private observed?: ReturnType<typeof authority>;
  private generation = {};

  observe(input: unknown): boolean {
    const next = authority(input);
    if (!next.ready) return false;
    const previous = this.observed;
    this.observed = next;
    if (!previous || (previous.key === next.key && previous.revision === next.revision
        && previous.rights === next.rights)) return false;
    this.generation = {};
    return true;
  }

  claim(): object { return this.generation; }
  /** Pending bookkeeping survives a temporary disconnect, but not a foreign HA. */
  owns(claim: object): boolean { return claim === this.generation; }
  current(claim: object, input: unknown): boolean {
    const next = authority(input), previous = this.observed;
    return next.ready && this.owns(claim) && previous?.key === next.key
      && (previous.revision === undefined || previous.revision === next.revision) && previous.rights === next.rights;
  }
}
