/**
 * #33: the machine-readable list of LEGITIMISED enum divergences between the
 * backend schema manifest (scripts/config-schema-manifest.json) and the
 * frontend const declarations.
 *
 * The parity test fails on any divergence that is not listed here — and on
 * any entry here that no longer corresponds to a real divergence, so the
 * list cannot rot. Every entry names the owning side, the value, the reason
 * and the issue that owns the decision.
 */
export const SCHEMA_COMPAT_ALLOWLIST = Object.freeze([
  {
    pair: 'space.fill_mode',
    side: 'backend-only',
    value: 'glow',
    reason: 'legacy stored value from the pre-#20 glow era; the space editor '
      + 'projects it and never writes it back',
    issue: '#33',
  },
  {
    pair: 'room.fill_mode',
    side: 'backend-only',
    value: 'glow',
    reason: 'same read-compatibility as the space level',
    issue: '#33',
  },
  {
    pair: 'marker.display',
    side: 'backend-only',
    value: 'ripple',
    reason: 'read-compatibility value; normalizeDeviceDisplay canonicalises '
      + 'it to icon_ripple and the editor rewrites it on every write',
    issue: '#33',
  },
  {
    pair: 'marker.tap_action',
    side: 'backend-only',
    value: 'cover',
    reason: 'read/backend compatibility token; the editor no longer offers it',
    issue: '#33',
  },
]);
