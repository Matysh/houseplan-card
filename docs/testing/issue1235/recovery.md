# #1235 — production Summary Retry ABI

Base: dev `d3ad645ca`. Node 22.23.2; pinned Playwright 1.62.0 / Chromium
headless-shell 151.0.7922.34 revision 1234 on Ubuntu WSL.

## Before / after

Fresh `node process-next/catalog/prepare.mjs build`, then
`node scripts/bundle-sync.mjs` and
`node demo/smoke_view_runtime_recovery.mjs` reproduced the native failure.
After the first root request's controlled 404, the normal Retry fetched the
real content-hashed module with `hp_retry=view-1`. Its exports were `a,s,w`;
the fingerprint was undefined and the boundary became terminal. No fake
module was used to heal this request.

The nested summary editor imports `weatherSources` and `weatherText`, also
used by `hp-summary-weather` in the View root. Rollup had placed these shared
leaves in the root, then hid its expected public exports in a namespace
wrapper used only by the literal dynamic import. The raw-URL retry bypasses
that wrapper. Put both weather leaves in the existing `summary-shared` chunk,
alongside the picker and icons; leave all loader state and retry policy intact.

The fresh fixed build exports `SUMMARY_RUNTIME_FINGERPRINT` and
`LoadedSummaryPanelRuntime` directly. The existing URL-injection plugin now
checks the two consumed exports for each of the six optional View roots,
just as it already checks the editor root. This is part of bundle generation,
not a new test stage. The focused plugin regression removes every consumed
export in turn and proves that generation rejects it.

## Addressed verification

- `node --test test/bundle-assets.test.mjs`: 49/49.
- Fresh production build and demo sync: pass, including all six raw-URL ABI checks.
- `node demo/smoke_view_runtime_recovery.mjs`: pass. Native Retry on real live,
  summary and Zigbee assets at en/1280 and ru/360; temporary root failure,
  one explicit nonce request, readable/touch-safe notices, saved preferences,
  terminal foreign fingerprint, shared dependency failure, distinct card
  instances and detached/warm lifecycle assertions remain intact.

Related nonce roots were audited against the actual generated ES module
export declarations: six View roots, editor/onboarding/isometric, de/fr,
15 namespace locales, furniture artwork, PDF, moon, LED runtime/field/editor
(32 modules). Their consumed named exports are preserved. The 32-root audit
also compared source value exports with generated names; no other missing
names were found. The six View roots now have the same permanent ABI
protection as the editor. Other loaders and their retry policies are unchanged.

The browser uses the synthetic demo backend and real production asset graph.
It does not prove Home Assistant installation/network persistence. Companion
E2E impact: replay a first-summary-root 404, heal the asset, press native Retry
and verify the real panel and saved visibility return; retain reload-only
behavior for a failed shared dependency or foreign fingerprint. No visual
baseline change is needed.
