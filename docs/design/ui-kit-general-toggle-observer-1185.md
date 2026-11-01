# General Settings target measurement — #1185

Original exact full candidate: [41302186631, shard1](https://github.com/Matysh/houseplan-card/actions/runs/41302186631/job/124835911721), material72d99a77030c7f8947a64b88524d38712615c123. Only smoke_general_settings_form/toggleTargetsAre44 failed; other checks in that scenario and shards2/3 passed.

An unmodified-product diagnostic observed gs-room-tooltip width44px, rect height43.99998474121094px and computed height44px while the genuine finite surface enter180ms was at116.6ms. The other two targets were44x44. After paint ended all three were exactly44x44; serialized saved config was identical. The diagnostic300ms delay was measurement only and is not the implementation. Its raw numeric receipt is retained in the author output/general-toggle-diagnostic-measured.log.

The smoke now opens the same dialog once before its main evaluate and awaits the existing waitForUiKitPaint. That helper reads actual finite animations and font/frame completion; it leaves infinite animations running, never suppresses motion and has bounded failure. Original width>=44/height>=44 assertions remain byte-for-byte unchanged. All draft/save/cancel/reset, WS revision, rollback and battery-mode checks remain.

No product, fixture, capture helper, browser pin, epsilon, threshold, budget or baseline changes. Product/capture source fingerprint remains39760e6c6f7b630d2ede693ff5378ebe59ffaa3f61f89eed567f2a1723058a36. The reviewed golden producer41302186631 remains pixel-input-equivalent; this does not turn its failed original smoke into PASS. Fresh targeted proof, normal gates, independent review and final full candidate CI are required.
