/** Runtime-only identity fence: card options and same-connection reconnects are not a new HA (#890). */
interface WriteHass {
  connection?: unknown;
  callWS?: unknown;
  user?: { id?: string };
}

/** Save context differs from export/import; all other errors keep their own mapping. */
export const configWriteErrorKey = (error: unknown): 'err.config_write_unauthorized' | null =>
  (error as { code?: unknown } | null)?.code === 'unauthorized' ? 'err.config_write_unauthorized' : null;

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
