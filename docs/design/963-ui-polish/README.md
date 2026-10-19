# #963 — immutable approved prototype sources

`approved-2026-10-19/app.mjs` and `houseplan-card.css` are the two generic,
non-private sources identified in issue #963. Their SHA-256 values are checked
by `demo/helpers/ui-polish-963-reference.mjs` against the published frozen
reference. Do not update them to make a product comparison pass.

The test extracts only the approved prototype block, mounts it on the original
public product bundle at `33a364d82e83963c8dc5bc961ea8f8025cb0a067`, and supplies
the same synthetic fixture as the current product. The exact approved HA
Frontend 20260930.4 is independently pinned for both pages. The ordinary CI HA
pin is unchanged. This is a comparison fixture, not the UI Lab tool in #964.

No owner config, layout, registry, states, images, session export or captures are
included. The private ZIP remains on the owner's machine. The prototype's
observers/proxies are used only in the reference page; product changes use
normal component render/command/lifecycle paths.

Run `demo/smoke_ui_polish_963_reference.mjs` after a fresh build. It rejects a
stale product bundle and writes paired PNGs and geometry/paint measurements to
ignored `artifacts/ui-polish-963/`. `HP_UI_963_VIDEO=1` records object switches;
`HP_QA_SEGOE_DIR` supplies read-only installed Segoe UI, otherwise both pages
use pinned HA Roboto. A shallow clone acquires the exact original public Git
commit from `origin` when absent; no branch or mutable tag supplies the reference.
Execution results belong in issue #963; derived captures and
receipts stay outside the committed source tree.
