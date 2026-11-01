# General Settings target measurement — #1185

Original exact full candidate: [41302186631, shard1](https://github.com/Matysh/houseplan-card/actions/runs/41302186631/job/124835911721), material72d99a77030c7f8947a64b88524d38712615c123. Only smoke_general_settings_form/toggleTargetsAre44 failed; other checks in that scenario and shards2/3 passed.

An unmodified-product diagnostic observed gs-room-tooltip width44px, rect height43.99998474121094px and computed height44px while the genuine finite surface enter180ms was at116.6ms. The other two targets were44x44. After paint ended all three were exactly44x44; serialized saved config was identical. The diagnostic300ms delay was measurement only and is not the implementation. Its raw numeric receipt is retained in the author output/general-toggle-diagnostic-measured.log.

The smoke now opens the same dialog once before its main evaluate and awaits the existing waitForUiKitPaint. That helper reads actual finite animations and font/frame completion; it leaves infinite animations running, never suppresses motion and has bounded failure. Original width>=44/height>=44 assertions remain byte-for-byte unchanged. All draft/save/cancel/reset, WS revision, rollback and battery-mode checks remain.

No product, fixture, capture helper, browser pin, epsilon, threshold, budget or baseline changes. Product/capture source fingerprint remains39760e6c6f7b630d2ede693ff5378ebe59ffaa3f61f89eed567f2a1723058a36. The reviewed golden producer41302186631 remains pixel-input-equivalent; this does not turn its failed original smoke into PASS. Fresh targeted proof, normal gates, independent review and final full candidate CI are required.

## Related modal consumers found by the next full run

[41308362320](https://github.com/Matysh/houseplan-card/actions/runs/41308362320) on9abb412c retained the same pixel inputs and exposed two independent observer failures. General Settings is already fixed and is not reverted. Golden's separate active-pan raster drift is recorded in #1133 and is not modified here.

- Native View permission footer: while CSS height is44px, an enter180ms at83.404ms/opacity0.644413 produced43.99993896484375px rectangles. The host animation list is empty while its shadow surface has a running animation. The existing deep paint helper ends at opacity1/exact44px; saved configuration stays byte-identical. The full original role predicate set is unchanged; only openInfo now returns after its actual enter.
- Approved UI: its local finiteAnimations queried only the light DOM host, returning with shadow enter180ms at0ms/opacity0. The controlled original scenario, with only the existing deep helper waiting for entry, passes every original contract, including real intermediate exit frames for X/Escape/Cancel and no persistence. Replace all four uses of that incorrect local waiter with waitForUiKitPaint; retain the original exit-frame assertion and native inputs unchanged. This does not fabricate an intermediate frame, advance animations or suppress motion.

Read-only diagnostics and their unchanged-product controls are retained in view-permission-modal-diagnostic.log and approved-ui-modal-diagnostic.log outside the checkout. This material formally returns #1185 to S6 and requires a new independent CODE review; its earlier green r1 and first RED evidence remain historical facts. No retry, mask, baseline change, fixed sleep, epsilon or global harness-semantics change is introduced. Fresh full targeted executions and final exact-candidate CI remain required.
