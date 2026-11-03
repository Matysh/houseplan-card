/** Runtime-only identity fence: card options and same-connection reconnects are not a new HA (#890). */
interface WriteHass {
  connection?: unknown;
  callWS?: unknown;
  user?: { id?: string };
}

/** Capture the existing authority generation, never a replaceable HA state snapshot.
 * Small standalone writer ports may omit the card's generation owner; their
 * fallback still fences the captured connection/user (or connection-less WS).
 */
export function captureWriteAuthority(host: {
  readonly hass: WriteHass;
  _configWriteGuard?: () => () => boolean;
}): () => boolean {
  const generationCurrent = host._configWriteGuard?.();
  const authority = host.hass?.connection ?? host.hass?.callWS;
  const user = host.hass?.user?.id;
  return () => {
    const hass = host.hass;
    return generationCurrent?.() !== false && !!hass && typeof hass.callWS === 'function'
      && (hass.connection ?? hass.callWS) === authority && hass.user?.id === user;
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
  private authority: unknown;
  private user: string | undefined;
  private generation = {};

  observe(hass: WriteHass | null | undefined): boolean {
    if (!hass || typeof hass.callWS !== 'function') return false;
    const authority = hass.connection ?? hass.callWS;
    if (this.authority === undefined) { this.authority = authority; this.user = hass.user?.id; return false; }
    if (this.authority === authority && this.user === hass.user?.id) return false;
    this.authority = authority; this.user = hass.user?.id; this.generation = {};
    return true;
  }

  claim(): object { return this.generation; }
  /** Pending bookkeeping survives a temporary disconnect, but not a foreign HA. */
  owns(claim: object): boolean { return claim === this.generation; }
  current(claim: object, hass: WriteHass | null | undefined): boolean {
    return !!hass && typeof hass.callWS === 'function' && this.owns(claim)
      && (hass.connection ?? hass.callWS) === this.authority && hass.user?.id === this.user;
  }
}
