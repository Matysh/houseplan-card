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
