# #1120 — main-panel header evidence

Scope is the main /houseplan panel and its existing card header. The immutable
r6 package at 9a74db073c1b87902de11bdf029505e8bf3a6b3c is preserved byte-for-byte
under docs/design/1120-panel-header-overflow/2026-10-29. Its prototypes remain
visual references; no prototype method replacement, cloned custom elements or
HA sidebar mock enters the product.

The existing outer appbar/title/56px reserve is removed. Ordered intrinsic
measurement replaces fixed panel thresholds; existing Lovelace adaptation is
retained because the owner explicitly excludes it. Properties retains 1024 px,
and its allocated head width is measured independently from the full card.
All policy changes use the existing header observer, coalesced frame and lazy
space picker. Disconnect/kiosk/DOM ownership retires old work and popup/focus
leases. No persisted model, backend, migration or new HA subscription is added.

## Observable and negative evidence

| AC / protection | Executed ordinary oracle | Negative input / registered witness |
| --- | --- | --- |
| AC1: ordinary menu and full panel | smoke_houseplan_panel.mjs: cold pre-definition inputs, menu first 44 px, native pointer/Enter events, empty/read-only and height chain. panel-header-menu.test.mjs: public modern/minimum HA and localized name. Actual HA drawer is a separate exact-published-candidate companion preflight before S7. | Unchanged public negative inputs: wide auto, native kiosk, external sidebar true, own kiosk. panel-menu-external-sidebar-1120 / panel-menu-requires-modern-field-1120 / panel-menu-public-event-not-composed-1120 are registered, not executed. |
| AC2: kiosk, ACL, Lovelace | smoke_panel_route_kiosk.mjs plus existing unchanged Lovelace header/mobile smokes; selected path/query/profile kiosk frames retain floor/rotation/Summary authority without an outer bar. | panel-route-kiosk-ignored and panel-menu-own-kiosk-leaks-1120 registered, not executed; ordinary non-writer empty panel exposes no create/editor action. |
| AC3: actual content order/reverse | smoke_panel_header_overflow.mjs changes actual host width at a fixed viewport, observes all five stages and reverses them; same 1200 px long/short roster changes the result, RU/EN captions update, tab/picker and hidden-control focus remain usable. panel-header-flow.test.mjs covers exact fractions, nonmonotone candidates and owner/content invalidation. | panel-header-order-skips-full-1120 / panel-header-cache-ignores-content-1120 registered, not executed; pure tests include nonfitting/invalid candidate widths and owner/content changes. |
| AC4: approved visual | Matched live r6 replay uses identical synthetic fixture/theme/RU/container sizes. All 9 visible-control rect/icon/radius compositions matched; 6 header crops were pixel-identical, 3 had 16/8/2 pixels of at most 1 channel difference and are NOT byte-identical. Selected task captures cover 8 panel frames and 4 strict known Lovelace neighbors; no global baseline accepted. | Original accepted1119 outer bar 56 px is preserved as natural RED. Missing compact inline-flex produced 27 vs 28.0625 px native button metrics and was fixed in the scoped composition; original residuals remain. |
| AC5: actions and actual fit | New native smoke operates all 3 phone editors/close 24 px, phone gear 44 px items, dirty resize/Keep/Discard and all 3 wide editors. Every visible wide-editor control must fit the allocated 920 px head and pass real centre hit-testing while Properties owns 360 px. Camera aspect, View camera restore and full panel height are checked. | panel-phone-nav-selector-loses-specificity-1120 / panel-header-measures-outer-owner-1120 registered, not executed. Natural REDs: 320 px third row 173 px; later successful capture execution exposed genuine Properties clipping from a 1280 px fit budget. Neither was accepted. |
| AC6: gestures and adjacent UI | smoke_panel_header_touch.mjs uses genuine Chromium native pan/pinch with all 3 zoom buttons hidden; unchanged numeric world-anchor/scale bounds apply. smoke_mode_transition.mjs, smoke_plan_rotation.mjs, smoke_external_screens.mjs and smoke_properties_panel.mjs cover motion/profile/Properties compatibility. | Existing geometry/input guards remain unchanged; ordinary UI inputs include hidden zoom, narrow Properties and profile authority changes. No timing, touch, geometry or screenshot threshold was raised. |
| AC7: no measurement/I/O loop | New native smoke observes 0 native metric probes across 12 unchanged HA ticks, checks no config/layout reads/writes from resize/policy changes, and detaches/remounts with the old popup retired and the same card. Existing cold panel proves no editor/onboarding graph for read-only View. | Owner/content/fractional-width/font memo tests invalidate only changed inputs; panel-header-cache-ignores-content-1120 registered, not executed. Ten new declarations pass static readiness; development executes zero mutants. |
| AC8: delivery | Current RU/EN guides, UX/Touch/architecture, both changelogs, STATUS/DEVELOPMENT and release ledger are updated. panel-title is explicitly retired from 1.83.0-beta.4 for issue #1120; panel-menu stays active inside the nested card. | Existing data-hp inventory rejects undeclared or missing public hooks. The former outer-DOM source assumption was replaced by AST menu presence + explicit title retirement/absence; no hidden dummy or validator exception. |

## Provenance and limits

Prior source fingerprints remain separate: 5006759c has the nine original fresh
adjacent smokes and full live r6 composition evidence;9849928e has the first
selected12capture, whose wide Plan frame is a semantic RED despite runtime
exit0. Source c8cd3878 corrects the allocated-head budget and passed the new
all-three-wide-editor native oracle. Its fresh selected 12 completed as 3 declared
differences, 5 new/unindexed frames and 4 raw-SHA/zero-pixel identical neighbors.
The public-hook metadata update and final caption type assertion do not
change runtime behavior; final task CI still verifies the exact published
source/material. Historical successful renders are not relabelled as fresh.

The measured own-cost record compares frozen accepted1119 b2bd/FP88 to c8:
generated JS +13078 B, initial View +3863 B gzip, host references +2 and card +144
lines. Only the four exhausted rolling references carry those exact own costs,
retaining previous headroom/bands. Port +1 and runtime +3 remain within existing
bands; delegates/private counts and the actual unused scan stay 145/105/101/[].
Absolute resource walls and functional/timing/geometry/pixel tolerances stay.

Synthetic native/replay evidence does not prove the HA drawer. Companion
preflight on the exact published product SHA must observe real HA narrow and
hidden-sidebar activation, kiosk/Back and installed-contract capability before
S7. This task does not bump a version, publish a beta or accept global baselines.
The release matrix remains 320 scenes and is outside this task run.

External author receipts preserve all setup/runtime/semantic REDs, immutable
source/bundle identities, paired PNGs, selected reports and actual command exits.
The complete exact-candidate CI/HA URLs belong to the final issue handoff.

### Owner correction after the first task gate

The owner reported: «там крестик у кнопки редактора съехал на картинке, которую ты смотрел только что, обрати внимание».
The immutable r6 package remains unchanged. This direct correction requires the active editor close SVG, its existing24px target and the active pill to share a centre, retaining the existing #666 active highlight. On local9f the native SVG path centre was6px below its own target and4.5px below the pill; the24px slot was1.5px above the pill. Panel-only flex alignment removes both offsets without translations or altered touch targets. The permanent three-editor native guard measures the actual SVG path through its screen CTM, target and pill centres; the original RED and native before/after screenshots are preserved outside the repository.

The first whole gate also found seven stale/source-contract assumptions and two open class producers. The repair retains exact style cascade/ownership, fixed-floor refusal, the full-height outer shell plus real card-owned menu and empty-state linkage. `Plan` is explicitly reviewed as a DE/FR cognate. Hover remains pointer-hover gated. The native metrics boundary now admits only the actual finite header icon/select class variants; it does not declare arbitrary classes or suppress CSS auditing.


Pre-upstream native/visual proof after that correction uses ready FP2050285a.
All ten affected native smokes passed, including the actual3editor SVG centre guard, phone actions/reverse phases, unchanged Lovelace/rotation/profile/Properties oracles. Selected12 completed as3 declared indexed changes,5 new/unindexed frames and4 strict SHA/zero-pixel identical neighbors. Eleven current PNG hashes equal the prior c8 set; only the active Plan header changes to correct the close glyph. The current whole Plan image and direct native mode-group crop were inspected. No baseline is accepted and no full-matrix result is claimed.

Pre-upstream actual cost against the same frozen accepted1119 donor: raw+13508B, initial View+3937Bgzip, hostrefs+2, portmembers+1, corecard+144lines/runtime+3; zero unused violations. Relative to the prior c8 carry only raw430B and initial74B are added to the references. All bands, absolute walls, other resource guards and functional/timing/geometry/image thresholds remain unchanged. No byte-golf was performed. RealHA proof remains pending on the exact published SHA before S7; current native tests are not a substitute.


After accepted1121 d91b, both unpublished1120 commits were rebased. Manual
conflicts were only current DEVELOPMENT prose and generated STATUS/inventory;
both current sections and the canonical regenerated inventories survive.
The incoming minifier changes a build input, so one fresh build produced
FP84b458a5727d200b95022163615e7aa7335b78faaf029f365fa9acdcb186454e.
Fresh actual all-sheet CSS-minifier semantics, all ten affected native smokes,
close SVG centres0/0/0 and selected12 pass their declared contracts. Every
selected actual PNG equals its prior2050 counterpart, including the inspected
corrected Plan frame; four neighbors remain strict index-SHA/pixel0 equal.
No old receipt is renamed to the new source identity.

Current own-cost uses the verified GREEN1121 original CI artifact and accepted
source donor, without rebuilding it: raw3701323→3714801 (+13478), initial
361029→364973 (+3944 gzip), refs+2/port+1/corecard+144/runtime+3; actual unused
violations[]. Incoming1121 raw+21/initial+4 is explicitly excluded. The earlier
references are adjusted only by -30raw/+7initial after this more precise base
attribution. All bands and functional/timing/geometry/image thresholds stay.
