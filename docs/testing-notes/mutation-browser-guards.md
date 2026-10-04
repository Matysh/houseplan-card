# Browser guards mutation registry (#659)

This is the reviewed classification of every mutation witness that still needs a browser.
The guideline is `200` (#699: a guideline, not a wall); `mutation-gate --check`,
`npm run inventory` and the unit contract all read this same inventory. A new browser guard
must be added deliberately under one reason below, and its mutant `because` must explain
the concrete browser-only invariant.

Converted witnesses are not listed here: their registry guard names an explicit `node --test`
suite. The original #659 conversions also use `test/mutation-browser-offload.test.mjs`;
new behavioral witnesses execute the consumer directly where possible. Catching the mutant
is verified by the nightly run under PROCESS §2.7, not by a development-time mutation run.

`led-unbound-in-view` moved to `test/led-strip-runtime.test.mjs` in #791: its guard
requires a non-null marker absent from runtime devices, whereas the browser's
`marker: null` fixture exits before the mutated guard. The Node witness checks the
exact surviving strip/owner and its live light; the browser smoke still covers
unbound-strip visibility and cold loading.

| Category | Count | Why a browser is still required |
| --- | ---: | --- |
| Performance threshold | 4 | The witness measures real browser wall-time or frame work; a pure assertion cannot prove the budget. |
| Browser harness integrity | 4 | The mutation breaks page-error, round-trip or page-registration observation in the browser harness itself. |
| Paint, cascade and layer composition | 37 | The invariant depends on computed CSS, SVG paint, clipping, stacking or pixels produced by Chromium. |
| Pointer geometry and trusted interaction | 49 | The invariant depends on hit testing, pointer capture, touch/keyboard dispatch or live DOM geometry. |
| Responsive DOM layout | 38 | The invariant depends on measured element boxes, responsive breakpoints, native/HA dialog shells or focusable target size. |
| Custom-element and HA browser lifecycle | 104 | The invariant crosses Lit/custom-element lifecycle, browser storage/events, lazy loading or a complete HA-card state transition. |
| **Total** | **236 / 200** | Above the guideline `mutation-gate --check` warns rather than fails (#699); each guard above it is held by its own reason in this inventory and its `because`. |

## Measured effect

The measurements below are GitHub-hosted Linux runs from 2026-09-27. They are
recorded separately from the policy limit: the limit proves that browser guards
cannot grow unnoticed, while timings show the effect actually observed on the
shared runners.

| Measurement | Before | After | Observed change |
| --- | ---: | ---: | ---: |
| Full-registry wall time | [54:18](https://github.com/Matysh/houseplan-card/actions/runs/36298676826) (1,017 mutants) | [48:08](https://github.com/Matysh/houseplan-card/actions/runs/36316263355) (1,028 mutants) | **-6:10 (-11.4%)**, despite 11 additional mutants |
| Sum of the six `Each test catches its breakage` steps | 4:17:19 | 4:12:32 | **-4:47 (-1.9%)** |
| Longest full-registry shard step | 50:45 | 45:13 | **-5:32 (-10.9%)** |
| Same converted-witness slice, aggregate time | 33:43.9 | 12:07.7 | **-21:36.2 (-64.0%)** |
| Same converted-witness slice, critical shard | 8:05.1 | 2:19.3 | **-5:45.8 (-71.3%)** |

The candidate slice compares the same 83 converted mutant ids in the baseline
full-registry log and in the S7 candidate Validate
[36316464432](https://github.com/Matysh/houseplan-card/actions/runs/36316464432).
It sums the interval between consecutive per-mutant completion timestamps on
each of the six shards. One of the 84 converted ids, `active-tab-not-revealed`,
was the first completed mutant in its shard, so the log cannot isolate its time
from clean-guard setup and it is excluded from both sides. The complete candidate
run, which also selected registry/tooling mutants outside this converted slice,
finished in 10:03.

The original estimate of three to four hours saved on a full-registry run is not
supported by this A/B evidence. The directly converted slice is materially
faster, but registry growth and shared-runner variance consume most of that gain
in the end-to-end total; only the measured reductions above are claimed.

## Reviewed per-mutant inventory

### Performance threshold

The witness measures real browser wall-time or frame work; a pure assertion cannot prove the budget.

- `junction-limit-p3-quadratic-again`
- `junction-limit-p4-bruteforce-again`
- `wall-draw-full-preflight-again`
- `wall-draw-wall-artifact-discarded`

### Browser harness integrity

The mutation breaks page-error, round-trip or page-registration observation in the browser harness itself.

- `benchmark-page-verdict-unwatched`
- `report-page-errors-skips-round-trip`
- `smoke-guard-blind-to-tail`
- `smoke-guard-forgets-to-register-pages`

### Paint, cascade and layer composition

The invariant depends on computed CSS, SVG paint, clipping, stacking or pixels produced by Chromium.

- `daycycle-outline-not-promoted`
- `daycycle-outline-promoted-on-inner-paper`
- `daycycle-static-outline-promoted-on-inner-paper`
- `decor-restored-below-room-fills`
- `device-keyboard-bypasses-click-path`
- `device-long-value-ellipsis-restored`
- `device-unavailable-hover-restored`
- `glow-entry-initial-opacity-skipped`
- `golden-filled-tunnel-removed`
- `golden-lamp-out-of-reach`
- `hatch-static-renderer-untouched`
- `hatch-stroke-not-scaled`
- `hatch-zoom-compensation-back`
- `iso-first-frame-reveals-flat-during-lazy-load`
- `iso-room-label-44-box-centres-name`
- `iso-sun-card-drops-occluders`
- `iso-sun-flat-wedges-remain`
- `iso-theme-dark-wall-rule-returns`
- `led-badge-dropped`
- `led-core-white-under-glow`
- `led-zoom-coarse-midpoint-wrong`
- `led-field-endpoint-dropped`
- `led-field-disc-cancels-fan`
- `led-field-compound-clip-children`
- `led-field-circle-events-missing`
- `led-icon-not-suppressed`
- `led-source-stays-round-at-anchor`
- `led-static-live-ignored`
- `stage3-w4-device-target-loses-44px-floor`
- `stage3-w5-runtime-nudge-writes-storage`
- `stage3-w6-no-borders-keeps-raised-plates`
- `stage3-w7-sun-state-enters-structural-key`
- `sun-ray-origin-cache-ignored`
- `sun-ray-origin-save-forced-inner`
- `value-static-icon-keeps-live-vacuum`
- `value-static-icon-keeps-route-warning`
- `value-static-icon-keeps-vacuum-overlay`

### Pointer geometry and trusted interaction

The invariant depends on hit testing, pointer capture, touch/keyboard dispatch or live DOM geometry.

- `align-guides-exclude-dead-source`
- `align-point-reads-frozen-snapshot`
- `decor-default-style-debounce-cut`
- `decor-default-style-seed-cut`
- `decor-keyboard-nudge-drops-focus-dialog-guards`
- `decor-keyboard-nudge-reruns-magnet`
- `dense-device-hit-browser-skips-painted-priority`
- `double-fit-bypasses-canonical-fit-all`
- `furniture-art-editor-adopt-skipped`
- `furniture-edge-handles-steal-the-corner`
- `furniture-exterior-surface-removed`
- `furniture-shift-listeners-not-attached`
- `furniture-wall-runtime-drops-drag-side`
- `furniture-wall-runtime-drops-raw-intent`
- `led-pan-adds-point`
- `led-pinch-calls-action`
- `led-zoom-quality-never-coarse`
- `led-zoom-noop-clears-lease`
- `live-pinch-compositor-demoted-on-active-lit-commit`
- `opening-dimension-overlay-hidden`
- `opening-search-hides-none`
- `opening-search-select-not-wired`
- `placement-accepts-any-mouse-button`
- `reorder-skips-materialization`
- `resize-history-boundary-repair-removed`
- `resize-label-uses-old-room-gear-centre`
- `resize-labels-hide-narrow-area`
- `resize-pointer-capture-removed`
- `resize-preview-reject-silent`
- `room-fit-html-overlay-jumps-ahead`
- `room-fit-pan-release-reaccepted`
- `room-fit-persists-zoom`
- `safe-resize-commit-preflight-bypassed`
- `sections-editor-transition-uses-window-height`
- `sections-grid-drops-stage-flex-chain`
- `sections-grid-falls-back-to-viewport-height`
- `sections-resize-drops-stage-refit-observer`
- `space-card-decor-capability-change-not-adopted`
- `space-card-decor-capability-downgrade-does-not-clear-assets`
- `tab-drag-outlives-the-card`
- `tab-drag-survives-release-outside`
- `tab-drag-target-follows-captured-source`
- `tab-drop-indicator-always-before`
- `tab-drop-outside-commits-last-target`
- `tab-reorder-not-persisted`
- `touch-pinch-marker-hold-rearmed`
- `touch-pinch-zoom-persists-per-frame`
- `unavailable-toggle-stays-silent`
- `wall-draw-rejection-rollback-skipped`

### Responsive DOM layout

The invariant depends on measured element boxes, responsive breakpoints, native/HA dialog shells or focusable target size.

- `dialog-ha-disconnected-reject-reopen-enabled`
- `dialog-ha-rejected-close-reopen-disabled`
- `dialog-native-reconnect-recovery-disabled`
- `dialog-native-surface-stretches-to-viewport`
- `dialog-native-update-recovery-disabled`
- `fit-house-hidden-walls-vote`
- `grid-scale-imperial-roundtrip-drift`
- `grid-scale-opening-hit-unscaled`
- `grid-scale-opening-symbol-unscaled`
- `grid-scale-plan-chrome-unscaled`
- `grid-scale-static-factor-missing`
- `header-menu-item-below-44`
- `header-menu-outside-tap-reaches-plan`
- `hidden-room-names-compact-svg-fallback`
- `hidden-room-names-full-svg-fallback`
- `hidden-room-names-iso-override`
- `hp-dialog-ignores-flex-content`
- `panel-readonly-empty-bypasses-write-capability`
- `phone-editor-close-hidden-with-mode-buttons`
- `phone-header-at-tablet-width`
- `phone-header-shows-title`
- `phone-header-wraps`
- `static-card-descendants-hit-testable`
- `summary-dialog-drops-flex-content`
- `summary-picker-hot-add-stays-filtered`
- `tab-editing-without-write-access`
- `toolbar-active-highlight-stops-at-tab`
- `toolbar-close-back-inside-tab`
- `toolbar-close-hidden-at-medium-width`
- `toolbar-close-slot-collapses-outside-editor`
- `toolbar-close-slot-idle-focusable`
- `toolbar-close-slot-leaves-mode-group`
- `toolbar-close-target-below-24`
- `toolbar-device-count-returns`
- `toolbar-mode-zoom-gap-regresses`
- `warm-dialog-drops-transferred-baseline`
- `warm-resume-collapses-pending-header`
- `warm-memo-publishes-torn-header-stage-pair`

### Custom-element and HA browser lifecycle

The invariant crosses Lit/custom-element lifecycle, browser storage/events, lazy loading or a complete HA-card state transition.

- `accepted-marker-rolled-back-by-layout-failure`
- `area-relocation-clears-whole-history`
- `area-relocation-loses-position-on-refusal`
- `backdrop-busy-dismiss-races-decision`
- `backdrop-downscale-drops-alpha`
- `backdrop-phase2-falls-back-to-original`
- `backdrop-probe-always-safe`
- `barrier-cache-never-invalidated`
- `camera-anchor-from-presented`
- `camera-cancel-loses-zoom`
- `child-readd-clears-parent-tombstone`
- `cold-view-toggle-delegated-to-runtime`
- `cold-view-vacuum-mapid-delegated`
- `color-picker-confirm-click-through`
- `color-picker-invalid-confirm-latch-removed`
- `config-updated-event-ignored`
- `confirm-dialog-loses-alertdialog`
- `current-rejected-physical-write-keeps-optimistic-wall`
- `danger-confirm-back-into-the-branch`
- `danger-confirm-lost-space-request-guard-removed`
- `danger-confirm-lost-space-transition-cancel-removed`
- `danger-confirm-uses-last-rendered-language-gate`
- `danger-confirm-warm-language-guard-removed`
- `danger-confirm-warm-transition-cancel-removed`
- `daycycle-programmatic-camera-skips-safe-outline`
- `device-echo-keeps-local-noncanonical`
- `device-focus-tooltip-blur-cleanup-removed`
- `device-focus-tooltip-handler-removed`
- `device-focus-tooltip-room-hover-overwrites`
- `device-inbox-batch-rollback`
- `device-markers-rendered-without-keys`
- `device-pointer-leave-clears-focus-fallback`
- `device-position-cancel-routed-to-commit`
- `discovery-reset-writes-a-copy`
- `editor-neutral-escape-does-not-exit`
- `empty-space-cleanup-disabled`
- `fixed-floor-transition-guard-bypassed`
- `floor-geometry-key-global-epoch`
- `floor-geometry-key-ignores-content`
- `french-locale-wrong-dictionary`
- `glow-barrier-render-pass-wiring-skipped`
- `glow-static-led-release-skipped`
- `glow-static-ready-after-disconnect`
- `household-enter-stops-acting`
- `household-marker-drops-keyboard-reach`
- `hp-dialog-escape-does-not-close`
- `junction-limit-baseline-cache-stale`
- `junction-limit-candidate-fail-open`
- `junction-limit-write-gate-removed`
- `led-auto-slot-reserved`
- `led-hidden-marker-loads-chunk`
- `locale-failure-toast-dropped`
- `marker-reject-keeps-optimistic-candidate`
- `marker-rollback-keeps-enqueue-time-revision`
- `moon-static-clock-tick-off`
- `namespace-loader-returns-english`
- `near-axis-authoring-snap-bypassed`
- `onboarding-loader-skips-namespace-ensure`
- `openings-rendered-without-keys`
- `plan-only-preview-label-hidden`
- `plan-room-area-icon-hidden`
- `plan-room-area-icon-navigates`
- `plan-upload-client-limit`
- `plan-upload-guard-original`
- `plan-upload-reduced-over-limit-staged`
- `post-write-tail-runs-on-refused-gate`
- `readonly-view-syncs-new-devices`
- `render-invalidation-renders-irrelevant-ha`
- `render-reconcile-restarts-editor-runtime-cycle`
- `reopened-room-from-registry-space`
- `room-accept-leaves-coincident-partitions`
- `room-gear-second-touch-keeps-drag`
- `room-settings-click-does-not-open`
- `room-tooltip-off-skips-pointer-modality`
- `rooms-rendered-without-keys`
- `rooms-rendered-without-space-key`
- `same-space-room-change-recenters`
- `space-card-rooms-rendered-without-keys`
- `space-create-hidden-display-override`
- `stairs-view-pan-opens-target-floor`
- `stairs-view-tread-lines`
- `support-invalid-response-leaks-issued-token`
- `support-stale-preview-response-revives-consent`
- `support-timeout-claims-success`
- `vacuum-overlay-back-to-the-dock-space-filter`
- `view-current-space-aria-removed`
- `volumetric-kiosk-ignores-setting`
- `wall-face-apply-skips-overlap-guard`
- `wallthick-hit-narrowed`
- `warm-late-resume-beats-user-mode`
- `warm-late-resume-crosses-space`
- `warm-pan-during-runtime-keeps-refit-blocked`
- `warm-pending-mode-leaves-revive-waiting`
- `warm-resume-camera-depends-on-dialog`
- `warm-resume-overwrites-view-return-camera`
- `writer-history-skips-finished-chain-normalization`
- `zigbee-topology-endpoint-cleanup-skipped`
- `zigbee-topology-endpoint-elevation-removed`
- `zigbee-topology-hovered-endpoint-elevation-removed`
- `zigbee-topology-overlay-double-live-projection`
- `zigbee-topology-overlay-layer-lowered`
- `zigbee-topology-unknown-casing-gaps-filled`
- `zigbee-topology-unknown-casing-removed`
- `zigbee-topology-unrelated-markers-raised`
