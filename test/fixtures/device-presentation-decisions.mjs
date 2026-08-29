/**
 * Executable index for docs/DEVICE-PRESENTATION.md.
 *
 * `expectedDecision` is a stable production trace fragment. `mutation` names
 * the focused guard that must turn red if the owning rule is weakened.
 */
const ROWS = [
  ['L01', 'pre.lifecycle.removed', 'presentation-row-contract'],
  ['L02', 'lifecycle.ha_disabled_hidden', 'device-presentation-policy-lifecycle'],
  ['L03', 'lifecycle.ha_disabled_hidden', 'device-presentation-policy-lifecycle'],
  ['L04', 'lifecycle.user_hidden', 'device-presentation-policy-user-hidden'],
  ['L05', 'lifecycle.user_hidden_preview', 'device-presentation-policy-user-hidden-preview'],
  ['L06', 'lifecycle.orphaned_diagnostic', 'device-presentation-policy-orphaned'],
  ['S01', 'source.cover', 'presentation-source-decision-trace'],
  ['S02', 'source.cover_capability_bypassed', 'presentation-source-decision-trace'],
  ['S03', 'source.controls', 'controller-availability-follows-target'],
  ['S04', 'availability.controller_available', 'controller-diagnostics-do-not-prove-online'],
  ['S05', 'availability.controller_unavailable', 'controller-availability-follows-target'],
  ['S06', 'source.virtual_controller', 'presentation-source-decision-trace'],
  ['S07', 'source.filtered_saved_controls', 'wireless-controller-loses-filtered-target-role'],
  ['S08', 'source.manual_virtual_light', 'presentation-source-decision-trace'],
  ['S09', 'source.owned_light', 'presentation-source-decision-trace'],
  ['S10', 'source.device_role', 'presentation-source-decision-trace'],
  ['S11', 'source.primary_fallback', 'presentation-source-decision-trace'],
  ['S12', 'source.none', 'presentation-source-decision-trace'],
  ['S13', 'source.critical_sibling', 'device-presentation-policy-alarm'],
  ['S14', 'source.skipped_static_fast_path', 'presentation-static-source-fast-path'],
  ['S15', 'availability.controller_available', 'entityless-active-controller-stays-available'],
  ['F01', 'status.alarm', 'device-presentation-policy-alarm'],
  ['F02', 'status.unavailable', 'device-presentation-policy-unavailable'],
  ['F03', 'source.device_role', 'presentation-source-decision-trace'],
  ['F04', 'status.working', 'device-presentation-policy-status'],
  ['F05', 'status.open', 'device-presentation-policy-status'],
  ['F06', 'status.neutral', 'device-presentation-policy-status'],
  ['F07', 'face.live_states_disabled', 'device-presentation-policy-live-gate'],
  ['F08', 'face.static', 'device-presentation-policy-static'],
  ['F09', 'content.value', 'device-presentation-policy-value'],
  ['F10', 'content.value_no_state', 'device-presentation-policy-value'],
  ['F11', 'content.value_ambiguous_sources', 'device-presentation-policy-value'],
  ['F12', 'content.value_virtual', 'device-presentation-policy-value'],
  ['F13', 'diagnostics.dynamic_icon', 'device-presentation-policy-diagnostics'],
  ['F14', 'diagnostics.value_badge', 'device-presentation-policy-diagnostics'],
  ['F15', 'diagnostics.metrics_enabled', 'device-presentation-policy-diagnostics'],
  ['F16', 'diagnostics.lqi_low', 'device-marker-lqi-low-boundary-shifted'],
  ['F17', 'diagnostics.vacuum_live', 'device-presentation-policy-diagnostics'],
  ['F18', 'content.value', 'device-presentation-policy-value'],
  ['A01', 'pulse.alarm_alarm', 'device-presentation-policy-alarm'],
  ['A02', 'activity.pulse_suppressed', 'device-presentation-policy-pulse-gate'],
  ['A03', 'pulse.short_event', 'device-presentation-policy-pulse-gate'],
  ['A04', 'pulse.continuous_presence', 'device-presentation-policy-pulse-gate'],
  ['A05', 'pulse.continuous_transition', 'device-presentation-policy-pulse-gate'],
  ['A06', 'pulse.continuous_running', 'device-presentation-policy-pulse-gate'],
  ['A07', 'pulse.none_none', 'device-presentation-policy-pulse-gate'],
  ['A08', 'pulse.continuous_presence', 'device-presentation-policy-pulse-gate'],
];

/**
 * The input scenario and observable projection are implemented by
 * runDecisionFixture() in device-presentation-policy.test.mjs. Keeping them on
 * the fixture row makes the document contract executable: a row cannot be
 * added as decision-ID metadata without also adding a production call and an
 * observable assertion.
 */
export const DEVICE_PRESENTATION_DECISIONS = ROWS.map(([id, expectedDecision, mutation]) => ({
  id,
  scenario: `row-${id.toLowerCase()}`,
  expectedDecision,
  mutation,
}));
