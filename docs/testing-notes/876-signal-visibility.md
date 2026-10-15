# Shared Zigbee signal visibility — #876

Accepted contract: issue body `3d96630687985be3d66bf526839fc91917f2af1b17d8e2379958e1655ca9944d`,
GREEN SPEC r2, owner answers 1A/2A/3A. Base: accepted dev `a7bd08bf`.
This is implementation evidence, not a formal review, release or real-GPU acceptance.

## AC witnesses and negative controls

| AC | Executable observation | How it fails |
| --- | --- | --- |
| 1 | `node --test test/signal-visibility.test.mjs`: complete global × new mode × YAML and legacy matrix, including exact-false-only invalid-data handling | `signal-visibility-card-default-masks-global`, `signal-visibility-legacy-true-becomes-explicit`; contrary matrix rows |
| 2 | `node demo/smoke_signal_visibility.mjs`: real control order, old true/unrelated Save, old false, on/inherit round-trip, reject; `node demo/smoke_signal_visibility_lifecycle.mjs`: held write, reopened native form, real conflict reload, readonly and late lazy kiosk opening | `signal-visibility-inherit-retains-old-false`, `signal-visibility-old-save-closes-new-dialog`; offline/conflict/readonly/kiosk probes |
| 3 | Same functional native: actual fixture `config_updated` reaches independent full/static/kiosk cards, Flat/Iso, tooltip and preview; unit explicit derived LQI and battery remain | Actual off/on count contrast; explicit-value/room-label independence rows. #867 integration is verified only after its accepted rebase, not by copying a draft |
| 4 | `python -m pytest tests_backend/test_settings_signal_visibility.py tests_backend/test_config_schema_manifest.py -q`; `python -m pytest tests_backend/test_ha_import_export.py -k issue_876 -q`; `test/space-copy.test.mjs` and schema parity | `signal-visibility-global-write-coerced`, `signal-visibility-plan-only-drops-mode`; invalid bool/enum and exact target-global equality |
| 5 | Functional native executes both actual config editors: absent selector and unrelated config-change event preserves YAML false/unknown keys; real card true/invalid/false and explicit On renders | Exact emitted config/visible-number comparisons |
| 6 | `node demo/smoke_signal_visibility_ui.mjs`: RU/EN × 360/1280 × light/dark, native Space/Tab/radio arrows, measured 44px labels/targets, no clipping/raw key; lifecycle read-only/kiosk probes | Native target-height/readability/focus/checked-state measurements, not a source regex |
| 7 | Pure bounded 50-space × 200-device × 100-frame policy; `node demo/smoke_signal_visibility_work.mjs` mounts 50 spaces/200 devices and observes four actual accepted global toggles | Getter traps, independent `label_lqi` matrix, required nonzero visible contrast; exact floor-cache counters and registry/service call counts |

Mutation definitions are statically checked only; execution/caught evidence belongs
to the nightly runner. No mutation was executed in development. No threshold,
scene ID, geometry limit or accepted PNG is changed to make a check pass.

## Risk review

- Async: delayed loader denied after kiosk change; old queued Save cannot close a
  reopened form. Existing config-adoption/serialized-write ownership remains the
  only write path; reject/conflict restore accepted settings, not a new cache.
- Data/permissions: strict optional bool/enum; unknown unrelated fields preserved;
  global default-on reads never write. Writer and kiosk checked at entry and Save.
- Geometry: no geometric setting or predicate changes. Work counters remain
  byte-for-byte equal through global switches on a 50-space/200-marker plan.
- Visual: intentional new shared row and local three-way control. Existing
  system/static/live/lifecycle gates and independent room metrics remain.
- Volume: resolver is O(1), no registry access/fetch/subscription. Mounted counter
  witness records zero registry fetches and zero service calls; no wall-time
  performance result or real-GPU acceptance is inferred from it.
- Host/input: public setConfig/hass and actual form controls/event transport;
  desktop editing reference, coarse-pointer safety and native keyboard witnesses.

## Pre-integration observations

- TypeScript PASS; targeted initial resolver/logic/schema units 144 PASS.
- Full initial `npm test`: 4,694 passed, 1 skipped, 0 failed (115 seconds), before
  final lazy-owner/44px additions. Final all-unit proof is the mandatory pre-push
  hook, not this earlier run.
- New strict settings/schema backend 29 PASS; actual transfer 9 PASS.
- Functional native 31 PASS; lifecycle 6 PASS; localized UI 80 PASS.
- Work native 5 PASS: visible counts `[0,4,0,4]`, registry fetches 0, service
  calls 0, all floor-geometry build counters unchanged.
- Related existing space form/save, general form, post-write adoption and danger
  smokes PASS with the new inherited draft shape. Exact whole-config Save oracle
  retains equality rather than dropping its assertion.
- Bundle budgets PASS without increases. Final golden/CI proofs are bound to
  the integrated candidate and recorded in the handoff, not claimed here.

Release classification: `major` against stable `v1.80.1`, milestone `1.81`.
User-facing stable prose is authored only during stable release preparation.
