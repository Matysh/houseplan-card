# Browser guards mutation registry (#659)

This is the reviewed classification of every mutation witness that still needs a browser.
The guideline is `200` (#699: a guideline, not a wall); `mutation-gate --check`,
`npm run inventory` and the unit contract all read this same inventory. A new browser guard
must be added deliberately under one reason below, and its mutant `because` must explain
the concrete browser-only invariant.

`test/mutation-gate.test.mjs` checks each category count against its listed IDs,
the total against the browser guards in `MUTANTS`, and both guideline numbers
against `BROWSER_GUARD_LIMIT` (#767). Category names must agree between the table
and inventory; each current browser guard ID must occur exactly once.

Converted witnesses are not listed here: their registry guard names an explicit `node --test`
suite. The original #659 conversions also use `test/mutation-browser-offload.test.mjs`;
new behavioral witnesses execute the consumer directly where possible. Catching the mutant
is verified by the nightly run under PROCESS §2.7, not by a development-time mutation run.

Witness repair #1012 preserves the two historical IDs. After #976, compact
catalogue Help is deliberately 22px; `settings-help-size-leaks-into-catalogue-948`
now additionally measures the public unscoped 32px target that still depends on
the default. After #1007, `zigbee-incomplete-heading-enlarged-1005` needs a local
override strong enough to beat the shared compact-disclosure cascade. The same
mounted typography guard still requires 12px in both themes. No browser guard
is added/removed; local static/ordinary success is not nightly caught evidence.

`led-unbound-in-view` moved to `test/led-strip-runtime.test.mjs` in #791: its guard
requires a non-null marker absent from runtime devices, whereas the browser's
`marker: null` fixture exits before the mutated guard. The Node witness checks the
exact surviving strip/owner and its live light; the browser smoke still covers
unbound-strip visibility and cold loading.

`glow-static-led-release-skipped` moved to `test/space-card-led-disconnect.test.mjs`
in #794: the real static-card callback must release populated LED state
synchronously, before a detached render can hide missing teardown. A
connection-only negative case suppresses late updates but retains its old
lifecycle; the browser smoke retains visible fade coverage without claiming
that transition events alone prove disposal.

| Category | Count | Why a browser is still required |
| --- | ---: | --- |
| Performance threshold | 7 | The witness measures real browser wall-time or frame work; a pure assertion cannot prove the budget. |
| Browser harness integrity | 4 | The mutation breaks page-error, round-trip or page-registration observation in the browser harness itself. |
| Paint, cascade and layer composition | 75 | The invariant depends on computed CSS, SVG paint, clipping, stacking or pixels produced by Chromium. |
| Pointer geometry and trusted interaction | 88 | The invariant depends on hit testing, pointer capture, touch/keyboard dispatch or live DOM geometry. |
| Responsive DOM layout | 55 | The invariant depends on measured element boxes, responsive breakpoints, native/HA dialog shells or focusable target size. |
| Custom-element and HA browser lifecycle | 223 | The invariant crosses Lit/custom-element lifecycle, browser storage/events, lazy loading or a complete HA-card state transition. |
| **Total** | **452 / 200** | Above the guideline `mutation-gate --check` warns rather than fails (#699); each guard above it is held by its own reason in this inventory and its `because`. |

## Measured effect

#991 adds `state-source-picker-escape-does-not-close-991` to custom-element and
HA browser lifecycle: the real mounted picker must consume trusted Escape,
close its panel and refocus the trigger without retiring the settings form.

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

- `device-contact-measures-cold-faces-separately`
- `device-contact-rebuilds-identical-value-geometry`

The witness measures real browser wall-time or frame work; a pure assertion cannot prove the budget.

- `junction-limit-p3-quadratic-again`
- `junction-limit-p4-bruteforce-again`
- `resize-render-snapshot-per-handle`
- `wall-draw-full-preflight-again`
- `wall-draw-wall-artifact-discarded`

### Browser harness integrity

The mutation breaks page-error, round-trip or page-registration observation in the browser harness itself.

- `benchmark-page-verdict-unwatched`
- `png-comparison-reads-closed-bitmap-size-1007`
- `report-page-errors-skips-round-trip`
- `smoke-guard-forgets-to-register-pages`

`smoke-guard-blind-to-tail` moved to `test/smoke-harness-lifecycle.test.mjs`
in #776: controlled delivery during awaited close deterministically rejects a
premature counter snapshot. The unchanged Chromium probes still check the
real Playwright page-error channel.

### Paint, cascade and layer composition

- `moon-runtime-always-waning-1006`
- `moon-art-mirrored-1006`

The moon witnesses compare Chromium SVG pixels and fixed surface details in
mounted production hosts. Pure path strings cannot prove the lazy Lit binding
or detect a mirrored painted use. They are registered, not executed in development.

- `dialog-kit-help-inside-disclosure-1007`
- `marker-glow-fields-lose-section-composition-1007`
- `room-font-controls-lose-section-composition-1007`
- `dialog-kit-palette-divider-restored-1007`

#1007: trusted Help hover must leave the adjacent summary paint unchanged;
CSS ancestor hover and nested conditional Glow section geometry are browser effects.
- `vacuum-trail-scaling-stroke-1002`

SVG non-scaling ink under Flat/2.5D camera transforms requires the browser cascade and viewport.

- `zigbee-incomplete-heading-enlarged-1005`
- `discard-confirm-initial-focus-ring-990`
- `discard-confirm-ignores-reduced-motion-990`

The actual unsaved-confirmation entrance, initial-versus-Tab focus paint and
reduced-motion cascade require mounted Chromium; pure decision tests cannot
observe these pixels or transforms. These witnesses are declared, not executed
during development.

- `icon-picker-wrapper-restores-second-border-988`

#988 observes the computed border paint around a genuine-picker host; CSS
matching alone cannot tell whether the wrapper and HA paint two contours.

- `dialog-return-focus-ring-flashes-976`

- `device-issue-warning-intercepts-pointer-972`

- `ecovacs-raster-invisible-939`

The #939 witness counts actual blue floor-image pixels in a Chromium screenshot.
Pure bounds/transform tests cannot distinguish an invisible raster from a
usable manual fit whose handles and image element are otherwise present.

- `modal-toast-below-top-layer-956`

#956 needs genuine modal top-layer paint: DOM visibility alone passed while the
letters were hidden. Its oracle compares independently rendered foreground ink.

- `background-stairs-stay-opaque-963`

The #931 theme witness checks actual panel background and text colours for both
browser schemes, absent HA mode and explicit HA overrides in either direction.
A data-theme attribute alone cannot prove the effective palette.

- `properties-theme-ignores-css-fallback`
- `properties-swatch-restores-conflicting-cover`

The #951 witnesses require the browser's inline line-box layout and effective
CSS border/SVG stroke widths while the actual camera is moving. A source-string
or pure geometry assertion cannot prove their screen-space alignment.

- `device-contact-inline-zoom-drift-951`
- `device-contact-fixed-stroke-951`

- `device-contact-retains-individual-frame-seams`

#861: actual held door/window ink and settled-copy suppression are properties
of the mounted live renderer, not only resolved coordinates or pure owners.

- `partition-held-openings-never-paint`
- `partition-held-openings-keep-stale-copy`

#849: successful dispatch feedback belongs to the painted marker shell, not modal entry.

- `info-card-confirmation-imitates-dispatch-feedback`

#871: native camera frames expose the nested SVG/HTML double projection.

- `vacuum-trail-double-camera-owner`

#828: Chromium raster after real pointer capture must replace the settled old
affected masonry with one frozen .35 source layer above candidate paper/fills,
while the new position stays translucent. A template cannot prove compositing.

- `node-preview-retains-original-body`
- `node-source-ghost-opaque`

- `battery-icon-collapses-glyph`
- `battery-zigbee-captions-under-endpoint`
- `zigbee-route-copy-under-battery`
- `zigbee-iso-neighbour-endpoint-under-routes`
- `zigbee-route-copy-under-value-badge`

The invariant depends on computed CSS, SVG paint, clipping, stacking or pixels produced by Chromium.

The #798 Zigbee witnesses exercise the mounted SVG for local and parent-bubble
routes in both themes and at minimum/default/maximum plan zoom. Unknown-LQI
outlines must scale with the plan, including live CSS projection; known-LQI
parent routes must retain the same line/arrow color as local routes.

`editor-styles-adoption-dropped-from-runtime` (#805) observes, from a MutationObserver
on the card's shadow root, the computed style of each editor surface's control element
in the very first frame it exists; without the adoption in the runtime constructor the
cold View is unchanged and no source-level check sees the unstyled editor.

- `daycycle-outline-not-promoted`
- `daycycle-outline-promoted-on-inner-paper`
- `daycycle-static-outline-promoted-on-inner-paper`
- `decor-restored-below-room-fills`
- `device-keyboard-bypasses-click-path`
- `device-long-value-ellipsis-restored`
- `device-unavailable-hover-restored`
- `editor-styles-adoption-dropped-from-runtime`
- `glow-entry-initial-opacity-skipped`
- `golden-filled-tunnel-removed`
- `golden-lamp-out-of-reach`
- `hatch-static-renderer-untouched`
- `hatch-stroke-not-scaled`
- `hatch-zoom-compensation-back`
- `iso-first-frame-reveals-flat-during-lazy-load`
- `iso-focus-outranks-zigbee-endpoint`
- `iso-focus-under-neighbour`
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
- `zigbee-topology-parent-lqi-discarded`
- `zigbee-topology-unknown-arrow-outline-removed`
- `zigbee-topology-unknown-outline-ignores-plan-zoom`

### Pointer geometry and trusted interaction

- `device-issue-opens-wrong-source-972`

- `editor-tooltip-arms-after-touch-focus-963`
- `column-rotation-target-shrunk-963`

- `settings-help-needs-host-hover-955`
- `settings-ray-preview-is-passive-955`

- `hidden-display-resets-current-camera`

- `copy-context-arms-right-button-drag`

- `device-contact-rounds-exact-drop-to-grid`

#911: public opening, live/settled SVG ownership during held input, and the real
toolbar lifecycle require the mounted Lit consumer. Pure target/width guards
stay in Node.

- `wall-selection-hidden-with-dialog`
- `wall-selection-not-live-owned`

`wall-selection-ignores-tool-boundary` moved to the actual renderer unit in
`test/wall-thickness-selection.test.mjs` (#917). Normal toolbar navigation
already clears the dialog, masking omission of the independent renderer guard.
The Node witness retains a valid dialog and populated cache with the wrong tool;
the browser witnesses above still own mounted paint and live-layer behavior.

#908: trusted cancellation/capture and Lit's retained class binding need the
mounted cursor/badge and immediate-next-drag oracles.

- `backdrop-cancel-retains-grabbing-cursor`
- `backdrop-next-begin-forgets-grabbing-cursor`
- `backdrop-capture-loss-retains-owner`

#900: native selection, capture, composed-path routing and intermediate camera
projection require the mounted browser consumer.

- `surface-stage-pointer-guard-removed`
- `surface-contact-enters-view-pinch`
- `wall-dialog-handle-includes-input-and-buttons`
- `wall-dialog-wheel-changes-number`
- `wall-dialog-back-inside-camera-layer`

#847: trusted marker target edges, real held input and Chromium's implicit
post-up capture loss require the mounted browser consumer, not just its owner unit.

- `view-hold-terminal-only-marker`
- `view-hold-context-tail-unowned`
- `view-pan-context-tail-unowned`
- `view-implicit-loss-cancels-accepted-room`

#849: real Tab/Enter/Space dispatch reaches the information-only lock badge.

- `lock-information-badge-loses-keyboard-entry`

#893: actual painted icon eligibility and the one winning wall guide cross the
lazy editor and real SVG/marker DOM. Native pinch reaches 50%/200%; endpoint,
axis, closure and ambiguous owners cannot leave a stale independent line.

- `editor-guides-use-invisible-discovery-roster`
- `wall-winning-guide-disconnected`
- `wall-winning-guide-survives-other-owner`

#871: animated puck centres and SVG endpoints share the real composed screen
matrix during trusted pan/pinch.

- `vacuum-tip-runtime-skips-current-matrix`

`node-capture-jumps-to-camera-target` checks that native wheel-to-node capture
preserves the browser-presented SVG CTM rather than jumping to the animation
target; a port unit cannot observe that frame.

- `node-capture-jumps-to-camera-target`

- `battery-passive-frame-intercepts-pointer`

#873: the equal-spacing resolver itself is judged by `node --test`; these three
cover what only a real gesture through the card and the lazy editor runtime
shows — the magnet dies with `DeviceDragState`, release writes the previewed
point, and View pointer routing never reaches the device drag.

- `spacing-magnet-outlives-the-gesture`
- `spacing-target-search-before-the-mode-check`
- `spacing-write-differs-from-the-shown-point`

The invariant depends on hit testing, pointer capture, touch/keyboard dispatch or live DOM geometry.

`led-pinch-calls-action` specifically observes two trusted contacts on the
painted LED target and the unchanged service ledger through release/cancel and
explicit compatibility tails. A final light state alone could hide two unsafe
toggles; ordinary fresh-click and fade/lifecycle controls remain in the smoke.

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
- `kiosk-hold-leaves-stage-gesture-under-modal`
- `kiosk-modal-tail-barrier-not-transferred`
- `kiosk-hold-survives-cancelled-touch`
- `kiosk-hold-survives-recognized-pan`
- `kiosk-hold-survives-lost-capture`
- `led-pan-adds-point`
- `led-pinch-calls-action`
- `led-zoom-quality-never-coarse`
- `led-zoom-noop-clears-lease`
- `led-zoom-noop-renews-lease`
- `live-pinch-compositor-demoted-on-active-lit-commit`
- `opening-dimension-overlay-hidden`
- `opening-search-hides-none`
- `opening-search-select-not-wired`
- `placement-accepts-any-mouse-button`
- `reorder-skips-materialization`
- `resize-history-boundary-repair-removed`
- `resize-label-uses-old-room-gear-centre`
- `resize-labels-hide-narrow-area`
- `resize-live-preflight-skipped`
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

- `properties-reserves-empty-height-963`

- `settings-opacity-caption-cropped-955`

- `settings-led-actions-inherit-footer-border-955`

- `settings-save-lettering-sits-low-955`
- `settings-help-orphans-last-line-955`

- `settings-height-follows-scrollbar-955`
- `settings-opacity-crops-100-955`

- `native-radar-select-overflows-ha-body-947`
- `properties-compact-swatch-leaks-to-color-plates`

- `settings-toggle-track-box-model-603`

- `settings-help-size-leaks-into-catalogue-948`
- `device-preview-follows-marker-size-947`

- `room-area-icon-keeps-block-baseline`
- `room-area-button-loses-touch-floor`
- `zigbee-tooltip-collision-bypass`

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
- `space-delete-block-stays-out-of-view`
- `space-delete-block-leaves-focus-behind`

### Custom-element and HA browser lifecycle

- `vacuum-legacy-map-diagnostics-1002`

- `zigbee-incomplete-details-start-open-1005`
- `zigbee-incomplete-mixes-provider-groups-1005`
- `source-picker-escape-keeps-list-open`
- `dialog-picker-hide-closes-owner-988`
- `dialog-picker-escape-closes-owner-988`

#988 distinguishes slotted picker events from the physical modal's own events,
and open popover Escape from ordinary parent Escape. Actual DOM retargeting and
capture order require the mounted Lit shell; the official-HA diagnostic separately
checks selection and draft preservation. No mutation executes during development.
- `state-source-picker-escape-does-not-close-991`

- `warm-remount-blesses-mismatched-camera-976`

The #976 witness changes the real host width, waits for its asynchronous refit,
then remounts a legacy plan in the same placement. The painted SVG camera and
the native node hit-test must agree before the single mouse press; a pure
rectangle assertion cannot prove warm ownership or the browser's resize order.

- `dialog-exit-keeps-native-authority-976`
- `dialog-invalidated-confirmation-retains-paint-976`

- `editor-tooltip-opens-without-delay-963`
- `editor-tooltip-survives-context-963`

- `vacuum-dock-toggle-shows-unaccepted-value-940`

- `inherited-glow-radius-materialized-by-render-947`
- `saved-manual-radar-entry-hidden-947`

The #947 witnesses use the mounted input/projection and the actual saved-profile
entry. They retain the ordinary draft, independent setup matrix and save-boundary
oracles; static readiness does not claim execution or caught results.

- `room-co2-loses-explicit-snapshot-source`
- `room-co2-tooltip-keeps-old-state`
- `room-co2-source-not-saved`

The #920 witnesses cross native source selection/save and the held Lit/HA
snapshot: a source outside every area must remain live in the row and in a
stationary tooltip. Unit parsing cannot prove those complete transitions.

- `plan-entry-ignores-existing-geometry`
- `plan-entry-replaces-delayed-warm-tool`

The #928 witnesses enter through native editor/tool actions and real HA config
delivery. They observe first-click safety and permission-delayed warm ownership;
pure geometry classification cannot prove either card lifecycle boundary.

- `vacuum-server-event-keeps-old-render-snapshot`
- `hidden-display-rewrites-saved-visibility`
- `hidden-display-toggle-uses-hidden-source-roster`

#942: the mounted form must retain its consented package version through a
public HA config/capability adoption. Refresh stays on v1 until the actual
checkbox is turned off and on; a helper-only test cannot prove that wiring.

- `support-v2-refresh-expands-consent`
- `support-v2-close-discards-stale-snapshot`

Preview completion also crosses the mounted close-confirmation boundary; pure
parser tests cannot prove that the latest owned token is discarded rather than
the pre-confirmation snapshot.

- `plan-converter-forgets-input-generation`

- `device-contact-window-blur-keeps-preview`

#907: the mounted marker form passes its effective locale to a nested Lit
preview, and a real registry-Area queue must supply a human error code at the
early refused write site. Parent-only locale readiness and complete wire/toast
observations stay separate from the child/message oracles. The owner-name
own-string matrix uses a cheaper Node guard. Declarations only; caught is nightly.

- `device-preview-ignores-effective-card-locale`
- `placement-early-refusal-loses-human-context-code`

#849: a secondary row crosses the actual info/modal/HA-update boundary while
preserving its exact entity target and fresh card membership.

- `info-card-row-bypasses-visible-confirmation`
- `info-card-row-trusts-retired-membership`
- `info-card-row-crosses-ha-authority`
- `info-card-row-dispatches-controls-neighbour`
- `signal-visibility-old-save-closes-new-dialog`

#893: a trusted marker move queues work before explicitly delivered lifecycle
retirement. Compare the complete layout, actual painted rollback, capture,
history/services/writes and old-tail/fresh-input controls; a released pending
write is a separate negative control. Pure retirement/DOM positioning helpers
retain cheaper unit guards.

- `hidden-device-drag-not-retired`
- `space-device-drag-survives-navigation`
- `retired-device-tail-opens-settings`

#890 pre-release AC6: the public old-server push crosses an already mounted
subscription while a new connection's paired load is pending. A pure context
unit cannot prove that this callback is actually fenced before its read.

- `config-old-subscription-interrupts-new-paired-load`
- `config-return-retains-inert-subscription`

#847 M1-r2: navigation observes the real pending owner before the floor change,
its immediate teardown afterwards, and trusted mouse still down beyond the
timer deadline. Mouse has no implicit capture or independent terminal; touch
and immediate next-tap controls remain. Current navigation cancels through both
explicit cancel and unconditional closeInfoCard→interrupt. The scoped compound
mutation disables both paths for a pending no-card press, not either redundant
line alone; source applicability is static and catching is nightly-only (#709).

- `view-space-change-keeps-pending-hold`

#846: these guards cross mounted floor arrival/browser-storage camera, shadow
dialog event capture, hash/tab navigation and retained action closures after an
HA model adoption. Pure policy/target units prove the leaves but not these DOM
consumers. Deadline/hold/disposal policy instead has cheap injected-clock guards.

- `kiosk-carousel-arrival-restores-old-zoom`
- `kiosk-dialog-input-does-not-pause`
- `kiosk-space-change-retains-old-door`
- `kiosk-door-dispatch-trusts-stale-dom`
- `kiosk-marker-dispatch-trusts-old-floor`
- `kiosk-retired-confirmation-accepts-new-intent`

#847: actual blur and mounted hidden/pagehide consumers retain an inert old tail;
the real custom element also disposes the live-HA sun layer fade.

- `view-blur-keeps-activation-tail`
- `view-hidden-keeps-contacts`
- `view-hidden-reset-allows-old-tail`
- `view-sun-fade-outlives-detach`

#867: an empty provider still crosses real Lit/ResizeObserver/RAF ownership;
the browser guard observes that the mounted overlay settles without a render loop.

- `signal-empty-overlay-repeats-size-render`

#894: accepted popup config adoption, a renderer-delayed genuine View draft and
an actual document reload need Lit/DOM/storage witnesses, not private fields.

- `opening-popup-keeps-retained-config-object`
- `warm-view-marker-publishes-without-renderer`
- `kiosk-document-recovery-drops-camera`

#848's root retry needs Chromium's failed-URL module map and an actual fresh
request; foreign Zigbee rejection must precede global custom-element registration.
Other owner/retry/discard/notice invariants execute pure Node boundaries.

- `view-summary-retry-reuses-failed-root`
- `view-zigbee-installs-foreign-root`

#890: public setConfig meets real browser localStorage and Lit floor adoption;
a delayed write crosses the actual HA-intake lifecycle before another connection
is authorized. Pure context tests cannot prove those consumers remain wired.
Vacuum-attempt and New-ack rollback guards instead execute their Node consumers.

- `config-live-setconfig-restores-stale-cache`
- `config-foreign-write-reply-revives-authority`
- `config-foreign-context-keeps-old-write-queue`
- `config-foreign-reply-decrements-new-context-count`

#892 checks the actual settings/cleanup/Apply controls in the mounted lazy
dialog, the unchanged stores before Apply, the exact paired request, and the
rebuilt report after adoption. A helper-only witness cannot prove this DOM/HA
transaction wiring; no production test facade or private draft mutation is used.

- `optimize-892-loses-cleanup-opt-in`
- `optimize-892-preview-forgets-ha-claim`

The #844 predicates and independent runtime port guard have cheap Node
witnesses. These eleven guards instead cross the actual footer/direct caller,
manifest-named dynamic import, disconnect/latest generation, warm memo/paint,
browser navigation or automatic registry lifecycle in the mounted card.
Only the selected smoke section runs per mutant; execution remains nightly.

- `view-edit-footer-forgets-permission`
- `view-edit-permission-hides-more-info`
- `view-edit-direct-entry-forgets-permission`
- `view-edit-late-import-forgets-recheck`
- `view-edit-import-forgets-latest-owner`
- `view-edit-import-forgets-connected-owner`
- `view-edit-ack-forgets-permission`
- `view-edit-warm-forgets-permission`
- `view-edit-retained-paint-forgets-permission`
- `room-area-direct-navigation-forgets-permission`
- `kiosk-writer-lifecycle-incorrectly-blocked`

`#850` adds two witnesses of a complete HA tick through the card: the LED frame
key without its source state, and the field painting the remembered frame. Each
needs the real stripe and field after one `hass` assignment and one Lit update;
the Node frame tests cover every key input, not the painted pair.

- `backup-import-runtime-skips-ownership`
- `backup-import-double-apply`
- `backup-import-blocks-populated-space-create`

`#832` keeps atom lineage, conflicting-owner and immutable-corner witnesses in
Node. Only the actual editor-to-inactive-consumer handoff through final
materialization, junction proof and persisted history needs the browser.

- `resize-atom-fixed-consumer-handoff-skipped`

The #824 guards use the real elements, public HA inputs, placement tombstones
and the real bounded paint barrier. Config/layout ownership and transient door
projection cannot be proved by testing a helper instead of its mounted caller.
Controller-only timeout state/retry policy has separate cheap Node witnesses.

- `space-reattach-skips-authoritative-read`
- `full-resume-forgets-late-hass`
- `full-timeout-drops-matching-projection`
- `space-timeout-drops-matching-projection`
- `full-read-ignores-lifecycle-owner`
- `space-read-ignores-lifecycle-owner`

`zigbee-hover-incomplete-uses-global-partial` (#816) checks the mounted lazy
overlay consuming the per-device warning under live provider state. Pure
resolver negatives cover role/route classification, not its rendered wiring.

- `zigbee-hover-incomplete-uses-global-partial`

`wall-face-lineage-skips-post-reconcile-settlement` (#804) needs the production room
dialog, post-reconciliation runtime wiring, history, asynchronous `config/set` and
reload. Pure lineage-helper tests cannot prove that the editor actually settles
residual-owned IDs before the strict wall-model barrier or rolls rejected writes back.

The five #874 witnesses below reuse one native room-closure smoke. Pure clipping
tests cannot prove the runtime applies Split rather than nesting, restores each
shared carrier's actual cm, closes a form whose draft reload discarded, or
checks the proposal's space/geometry stamp before writing. The last witness is
an explicitly labelled negative race injection, distinct from the real HA
config-update scenario; ordinary success paths use native drawing/Save/Undo.
The carrier-scope witness places unrelated coincident legacy debt on another
parent edge and checks that the runtime does not silently Optimize it away.

`room-placement-capture-disconnected` (#879) crosses native room Save,
the lazy editor and Lit registry rebuild before new-device detection. Pure
placement-ledger tests cannot prove either room-creation path actually supplies
its finite placement intent; the browser observes the device dot, catalog and
durable baseline. Atomic-payload wiring is guarded separately by a Node test
executing the actual serialized editor writer.

`floor-cache-counter-skips-evicting-miss` (#769) needs the real card cycling floors
through its tabs with a full union pool: only the rendered floor switch reaches the
miss branch that evicts, and the witness compares the build counter with the whole
size snapshot of the same card. `resize-bodies-rekey-format-diverges` and
`wall-union-fingerprint-from-stored-record` (#769 AC8) need a held real Resize drag with
host renders mid-drag (a Home Assistant state change): the bodies re-keyed on every
accepted frame and the union drawn for the preview record are compared with a fresh card
built from that record.

`editor-styles-adopted-once-per-page` (#805) needs two real `houseplan-card` elements
and a warm remount on one page: per-root accounting of the editor sheets shows only as
the second root's adoptedStyleSheets and computed styles. The fake-root unit test pins
the same accounting; the smoke proves it on Lit's own roots.

`opening-wall-index-key-global-epoch` and `sun-key-global-epoch` (#814 AC1) need the
real card adopting a pushed config through its server event (a new epoch with the shown
floor's record unchanged) and rendering the shown floor in View with a lit sun: only the
card's build counters across that adoption show the index and the wedges rebuilt.
`physical-bodies-pool-bypassed` and `opening-tunnel-evicting-miss-uncounted` (#814 AC2)
need the real tab cycle over three warm floors and a full pool: only the rendered floor
switch reaches the miss branches, judged by the #735 guard with `pooled`.
`resize-union-kept-after-reset` (#814 AC3) needs a held real Resize drag ended by a config
event, the only path that resets the session outside pointer up and cancel.

The invariant crosses Lit/custom-element lifecycle, browser storage/events, lazy loading or a complete HA-card state transition.

- `node-invalid-warning-settled-copy`
- `node-guide-settled-copy`
- `node-axis-prompt-settled-copy`

These #828 guards hold a real captured pointer across unrelated hass snapshots
and full Lit frames: the warning, guide and X prompt must each have one live
owner, with no settled copy surviving the next presented frame.

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
- `editor-styles-adopted-once-per-page`
- `empty-space-cleanup-disabled`
- `fixed-floor-transition-guard-bypassed`
- `floor-cache-counter-skips-evicting-miss`
- `floor-geometry-key-global-epoch`
- `floor-geometry-key-ignores-content`
- `french-locale-wrong-dictionary`
- `glow-barrier-render-pass-wiring-skipped`
- `glow-static-ready-after-disconnect`
- `household-enter-stops-acting`
- `household-marker-drops-keyboard-reach`
- `hp-dialog-escape-does-not-close`
- `junction-limit-baseline-cache-stale`
- `junction-limit-candidate-fail-open`
- `junction-limit-write-gate-removed`
- `kiosk-hold-survives-window-blur`
- `kiosk-pointer-survives-reattach`
- `kiosk-scale-dialog-loads-editor-runtime`
- `led-auto-slot-reserved`
- `led-field-paints-previous-frame`
- `led-frame-key-without-source-state`
- `led-hidden-marker-loads-chunk`
- `locale-failure-toast-dropped`
- `main-card-snapshot-without-geometry`
- `marker-reject-keeps-optimistic-candidate`
- `marker-rollback-keeps-enqueue-time-revision`
- `moon-static-clock-tick-off`
- `namespace-loader-returns-english`
- `near-axis-authoring-snap-bypassed`
- `onboarding-loader-skips-namespace-ensure`
- `opening-tunnel-evicting-miss-uncounted`
- `opening-wall-index-key-global-epoch`
- `openings-rendered-without-keys`
- `physical-bodies-pool-bypassed`
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
- `resize-bodies-rekey-format-diverges`
- `resize-union-kept-after-reset`
- `room-accept-leaves-coincident-partitions`
- `room-placement-capture-disconnected`
- `room-gear-second-touch-keeps-drag`
- `room-settings-click-does-not-open`
- `room-tooltip-off-skips-pointer-modality`
- `rooms-rendered-without-keys`
- `rooms-rendered-without-space-key`
- `same-space-room-change-recenters`
- `space-card-markers-rendered-without-keys`
- `space-card-openings-rendered-without-keys`
- `space-card-openings-rendered-without-space-key`
- `space-card-rooms-rendered-without-keys`
- `space-card-snapshot-without-geometry`
- `space-create-hidden-display-override`
- `stairs-view-pan-opens-target-floor`
- `stairs-view-tread-lines`
- `sun-key-global-epoch`
- `support-invalid-response-leaks-issued-token`
- `support-stale-preview-response-revives-consent`
- `support-timeout-claims-success`
- `vacuum-overlay-back-to-the-dock-space-filter`
- `view-current-space-aria-removed`
- `volumetric-kiosk-ignores-setting`
- `wall-face-apply-skips-overlap-guard`
- `wall-face-lineage-skips-post-reconcile-settlement`
- `wall-face-composite-falls-back-to-island`
- `wall-face-shared-cut-loses-own-carrier-cm`
- `wall-face-reload-keeps-form-after-draft-loss`
- `wall-face-apply-overwrites-changed-geometry`
- `wall-face-acceptance-sweeps-unrelated-carriers`
- `wall-union-fingerprint-from-stored-record`
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
- `zigbee-topology-solid-route-dashed`
- `zigbee-topology-unknown-casing-removed`
- `zigbee-topology-unrelated-markers-raised`
- `space-delete-with-devices-drops-the-flag`
- `space-delete-with-devices-ignores-a-moved-plan`
- `inbox-delete-stale-placement-930`
- `inbox-delete-rollback-930`
- `inbox-virtual-id-930`
- `properties-resize-forgets-internal-hex-draft`
- `properties-decor-dialog-skips-draft-gate`

The #931 witness crosses responsive unmount/remount of the real colour picker,
its uncommitted internal HEX input and the card-local draft owner. A pure field
controller cannot prove that the mounted custom element retains this input.

The #940 witness crosses the native checkbox checked property, trusted Space,
Lit property-part caching and a held/refused HA ACK. Pure writer units cover
transport ownership but cannot prove that the mounted checkbox still displays
the accepted value while its unchanged model awaits or rejects that write.

The #930 witnesses cross native catalog selection, the stacked confirmation,
authoritative HA config replacement and Lit/adoption rollback. The pure units
separately exercise the candidate and identity predicates; they cannot prove
that the mounted UI passes the newly filtered exact targets, retains selection
after a refused write and never merges neighbours with binding `virtual`.
