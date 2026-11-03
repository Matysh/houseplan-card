# UI/browser migration evidence for #1226

The classified population is exactly78 original failed browser cases from run41598951489, candidate`cb1431ea65055b5d327e574c4fe2d567ba0a0d52`. The32 geometry cases and12 root/dependency cases are excluded. `browser-ui-classification.json` preserves each original status/log/error and the latest targeted result.

Targeted runs use product base`9515c5fef`, Playwright1.62.0 and pinned Chromium151.0.7922.34/revision1234. They precede the final integrated candidate containing the accepted #1220–#1224 product fixes. An original failure that was not rerun is not a PASS. Product-dependent witnesses must be evaluated on that candidate in the shared full stable audit.

Targeted result:36 full-smoke PASS;9 still failed after native setup;33 untouched original failures retain their primary evidence (no duplicate runs). These counts are not a full stable verdict.

## Repairs

- Explicit desktop phases now use an actual wide embedding container and visible zoom controls. The helper never reveals hidden buttons, force-clicks or mutates the product camera. Later compact phases can override the initial stylesheet.
- Responsive View scenarios use the public background double-click Fit shortcut and Ctrl+wheel zoom when desktop buttons are absent. The helper verifies an unoccupied rendered hit target and refuses editor-mode double-fit.
- Device settings are reached through the current properties action; compact dialog callers keep their own native path. Exact copy/history/persistence checks remain.
- Signal controls use the current on/low/off select and inherited four-option local setting. Discard/focus witnesses dirty the independent existing room-tooltip checkbox.
- Mode consumers wait for terminal transition paint before checking Flat/no-light. The history timing witnesses keep their original request/ACK/paint clocks, samples and bounds.
- The summary scroll negative witness disables both public HA flexcontent owners, including settings-layout, to actually recreate the old failure. Positive wheel/touch/bounds checks stay unchanged.
- The explicit copy-category fixture starts at the current coordinate authority via the exact shared `currentGraphFixture`; the product migration is not bypassed or relabeled.
- Native tooltips use data-hp-tooltip. CSS44px hit targets are compared at0.001px rectangle precision. The hidden-device camera assertion ignores object insertion order and only sub-picounit round-trip error (absolute1e-9 model units), retaining the no-visible-motion guarantee.

## Remaining evidence, not accepted as green

- `smoke_mobile_view_header`: resolved by accepted #1207 UI-018, which omits the heading of every full dashboard card and retains its PDF setting. Full addressed smoke now passes with native PDF verification; the static card title remains valid. See `header-title-contract.md`. The old owner question was withdrawn with the canonical-contract explanation.
- Shared decor-history exact redo failures are linked to #1222. This task was subsequently accepted on dev; the current local product base predates it.
- Device-contact cancellation/restoration and furniture next-click assertions remain red after reaching native desktop input. They are not weakened or yet claimed to be confirmed product defects.
- More Info's narrow translated layout: hp-help intercepts the intended field centre click. Keep native input and collect actual hit geometry; no force click or removed layout oracle.
- Summary runtime retry remains terminal with the retained minified-export diagnostic. Keep retry and fingerprint expectations until its loader/fixture contract is resolved.
- Geometry/projection, discovery/persistence, visual-help, lazy-sheet order and Zigbee diagnostics cases retain original invariant failures; see their individual classification rows. No bulk golden acceptance, performance-budget change, `serve.mjs`/hp-test mutation or test skipping was done.

This subtask does not run finish, publish a release, approve new baselines or claim either #1225 or #1226 reached S8. The parent integrates the commits and performs the single common full stable audit, including the77 real HA business scenarios.
