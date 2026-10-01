/**
 * #725: the card's config fingerprint is built at most once per update pass.
 *
 * `_model` keys its memo on the config epoch plus a structural fingerprint that
 * walks every space and room. One render reads `_model` dozens of times, and
 * each read used to walk the whole house again. Inside one pass — from the
 * start of `willUpdate()` to the end of `render()` — the first read builds the
 * key with its fingerprint and the rest reuse that very string while the epoch,
 * the config object and its `spaces` array stay the same. Remembering only the
 * fingerprint and gluing the key anew on each read was tried first: on the large
 * house in 2.5D it measured slower than no memo at all (more GC on load and on a
 * first floor visit), while one remembered key is faster.
 *
 * Outside a pass (handlers, `updated()`, timers, async continuations) every
 * read builds the fingerprint, exactly as before: that is where an in-place
 * mutation without an epoch bump can happen, and the fingerprint is the belt
 * that still sees it (HP-1454-04).
 */
export class ConfigFingerprintPass {
  private serial = 0;
  private open = false;
  private memo: { epoch: number; config: object | null; spaces: unknown; value: string } | null = null;

  /**
   * Opens a pass and forgets the previous one. A pass that never reaches
   * `end()` — `willUpdate()` threw, so Lit never rendered — closes itself in a
   * microtask, before any handler or timer could read a remembered fingerprint.
   */
  public begin(): void {
    const serial = ++this.serial;
    this.open = true;
    this.memo = null;
    queueMicrotask(() => { if (this.serial === serial) this.end(); });
  }

  public end(): void {
    this.open = false;
    this.memo = null;
  }

  /**
   * What `build` returns for these inputs — the card passes its whole `_model`
   * key, epoch and fingerprint — remembered inside a pass, built outside.
   */
  public read(epoch: number, config: { spaces?: unknown } | null, build: () => string): string {
    if (!this.open) return build();
    const spaces = config?.spaces;
    const memo = this.memo;
    if (memo && memo.epoch === epoch && memo.config === config && memo.spaces === spaces) return memo.value;
    const value = build();
    this.memo = { epoch, config, spaces, value };
    return value;
  }
}
