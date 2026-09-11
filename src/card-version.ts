/**
 * The version the card SHOWS, as opposed to the version it IS (#512).
 *
 * `CARD_VERSION` stays a literal in `houseplan-card.ts` and
 * `houseplan-editor-runtime.ts` — the release contract reads those literals.
 * Everything that puts the version into the DOM or into a request the stand
 * echoes back (about dialog, version-recovery banner, support preview, backup
 * export, PDF footer) goes through this seam, so a visual harness can pin the
 * displayed version and stop every beta bump from invalidating golden frames
 * whose only change was the digits.
 *
 * `globalThis.__HP_VERSION_OVERRIDE__` is a test seam: harnesses only. The
 * product never sets it, and anything but a non-empty string is ignored.
 */
export function displayVersion(fallback: string): string {
  const override = (globalThis as { __HP_VERSION_OVERRIDE__?: unknown }).__HP_VERSION_OVERRIDE__;
  return typeof override === 'string' && override.length > 0 ? override : fallback;
}
