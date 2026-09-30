/**
 * #718 K7: the «Now: …» line under the moon switch in General settings.
 *
 * One snapshot per opening — `now`, `hass.config`, `sun.sun` — judged by the
 * lazy moon chunk as if the switch were on: the moon no longer depends on the
 * background, so one status serves the whole installation, whatever the
 * switch, the background segment or the spaces say. It lives beside the
 * draft, never in it (`generalDraftKey` does not see it), so the line arriving
 * does not make the dialog dirty. The result of an opening that was closed in
 * the meantime is dropped; until the chunk is here, or when it failed, there
 * is no line and the hint alone stays.
 */
import { withMoon } from '../moon-gate';
import { resolveDayCycle, sunStateOf } from '../sun';
import type { MoonStatus, MoonStatusReason } from '../moon';
import type { SettingsI18nKey } from '../i18n/settings';

interface MoonStatusHost {
  hass?: unknown;
  _settingsDialog: unknown;
  requestUpdate(): void;
}

interface Opening { status?: MoonStatus }

const openings = new WeakMap<object, Opening>();

/** Called by `_openSettingsDialog` once the draft exists: asks for this opening's status. */
export function openMoonStatus(host: MoonStatusHost, now: Date = new Date()): void {
  const opening: Opening = {};
  openings.set(host, opening);
  const hass = host.hass as { config?: unknown } | undefined;
  const state = resolveDayCycle(hass, now);
  // With `source === 'sun'` this is the very elevation `dayCycleSunOf` read.
  const sun = sunStateOf(hass)?.elevation ?? null;
  withMoon((moon) => {
    if (openings.get(host) !== opening || !host._settingsDialog) return;
    opening.status = moon.moonStatus(hass?.config, state, sun, now);
    host.requestUpdate();
  });
}

/** The status of the current opening, once the chunk has judged it. */
export function moonStatusOf(host: object): MoonStatus | undefined {
  return openings.get(host)?.status;
}

/** Literal keys (#502): the dead-key gate does not read a key glued from the reason. */
const MOON_STATUS_KEYS: Readonly<Record<MoonStatusReason, SettingsI18nKey>> = {
  shown: 'gs.moon_status_shown',
  no_home: 'gs.moon_status_no_home',
  day_sun: 'gs.moon_status_day_sun',
  day_clock: 'gs.moon_status_day_clock',
  low: 'gs.moon_status_low',
  new: 'gs.moon_status_new',
};

/** A signed whole number: the minus is U+2212, no plus; −0 reads as 0. */
const signed = (value = 0): string => (value < 0 ? `−${-value}` : String(Math.abs(value)));

/** The line's text; `st` is the dialog's `settingsT` for its language. */
export function moonStatusText(
  status: MoonStatus, st: (key: SettingsI18nKey, vars: Record<string, string>) => string,
): string {
  return st(MOON_STATUS_KEYS[status.reason], {
    alt: signed(status.alt), pct: signed(status.pct), sun: signed(status.sun),
  });
}
