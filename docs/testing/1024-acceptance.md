# Opening features #1024 — implementation evidence

Normative input: issue #1024, accepted specification revision5/round5, UI-059
and the owner's confirmation of volumetric top translation and unknown markers.
The original synthetic replay package is preserved byte-for-byte in
`docs/ui-lab-reference/2026-11-12-openings-1024/`; every manifest hash was checked.
Its historic SPEC is a snapshot, not an override of current issue revision5.

## Addressed checks

- Native `demo/smoke_opening_features.mjs`: nested Done/Cancel/Escape, outer
  Save, Undo/Redo, count4 limit, authoritative unavailable source, fresh read
  revoking capability, untouched implicit Save and remote parent deletion.
  No service calls; writes use the ordinary writer and outer API marker.
- `demo/smoke_settings_select.mjs`: own list scrolling, composed-shadow ancestor
  scrolling follows the trigger, complete clipping closes it; fallback, native
  popover and reduced motion retain existing behavior.
- Model/basis tests cover exact 89→90→91 and reverse transitions, real rotations
  exceeding90°, whole-record TS/Python parity, scalar cleanup, source immutability
  and type-specific slide normals. Other node/copy contracts remain in S6.
- Optical tests use actual floor/visibility control points for Sun and Glow,
  full-parent reach/depth, closed/open shade shares and effective-state cache keys.
- Real HA tests exercise the locked writer guard, complete Copy proof and
  portable v3 full/space/plan-only transfers; ZIP keeps disabled shade sources.
  Diagnostic tests check scoped leaf pseudonyms and shared entity references.

The final authoritative task S6 result is the queue report, not the sum of
these preliminary addressed runs. Paid code review and S8 require that report
and actual queue merge; this document does not claim either in advance.

## Visual comparison

An isolated reconstruction of dev@3f89c4132e2f1e9243df350f26aae849d275bc65
with the accepted replay runs at8892; the product at8893. Both use the same
synthetic UI Lab fixture, pinned HA frontend/Roboto, viewport and theme.
The owner's private HA and Lab8890 are not accessed or modified.

Matched captures cover two-leaf list/nested settings, top opening with closed
shade,800px layout, mixed plan symbol, counts1/3/4 and selected-leaf previews,
sliding door/gate forms and plan symbols. Light/dark comparison uses the same
script; captures/logs remain in task artifacts. Volumetric materials and the
20cm top translation have a separate geometric oracle, because the old lab
does not contain the accepted volumetric implementation.

Intentional text-contract differences: independent unknown `?`, correct legacy
outer hinges, full-motion fit bounds, shared shade glyphs in the preview and
additional contextual help. Do not reproduce the prototype's short solar
windows, physical shade blockers, global hooks or localStorage architecture.

The owner authorized accepting #1024's changed visual baselines and requested
the next beta after completion on2026-11-13. That permission does not turn an
unexplained unrelated golden difference into an accepted product change.

## First queue S6 and addressed repairs

Run `20261112T215325491-d6cea10f` completed730 files:616 passed,103 reused,
11 failed. It did not reach code review or merge. The failures exposed a real
damaged-import adapter exception, plus current-field lifecycle metadata,
additional untyped boundaries, old source-text/translation/UI expectations,
six stale mutation anchors and the dependent converter runtime/envelope check.
The adapter now leaves malformed records to the existing validation/repair;
this does not authorize accepting malformed v1 extensions. Type boundaries
use unknown/explicit persisted shapes rather than growing the any budget.

Addressed rechecks passed137 Node tests,98 repair/basis backend tests,21
converter backend tests,4 converter-page tests and native opening entity,
Static symbol and nested-form scenarios. Static retains the assigned source's
accent independently of state/availability, with the same neutral body as the
full plan. The 2.5D synthetic capture shows four independently posed leaves,
parallel top translation, shade/unknown glyphs and no Flat arcs or handles.
Companion HA journey: `Matysh/houseplan-e2e#45`, impact record#44; actual
execution on the immutable beta candidate remains pending.
