# Browser geometry fixture ports (#1226)

Product material: dev `cb1431ea`; Node 22.23.2, Playwright 1.62.0,
Chromium 151.0.7922.34 / revision 1234. Fresh generated bundles passed the
ordinary freshness guard. No product implementation, budgets, goldens, or
finish/page-error guards are changed.

These ten original failed smokes now exit 0 with their complete assertions:

| Smoke | Fixture correction | Evidence under `output/issue1226/geometry/` |
| --- | --- | --- |
| geometry_history_refusal | Wire advertises the real graph capability; ordinary draws and Undo remain real input | `history-current.log` |
| resize_labels | New second raw fixture retires the first graph/catalogue; await animated zoom and use SVG screen transform | `labels-current.log` |
| room_contact_grid | Existing-face creation uses Select after #1176; graph capability survives authoritative re-reads | `contact-current.log` |
| room_face_select | Start with normalized current fixture, so full Undo equality compares the same identity model; choose a real in-viewport node; convert normalized wall midpoint to plan units | `face-select-current.log` |
| room_resize | Explicit new legacy fixture removes all previous `plan_graph` values before declaring model 8 | `resize-current.log` |
| wall_guide_ownership | Graph capability; native pinch ratio starts from the measured camera; CDP setup scale bound 1e-5 with printed deltas | `guide-current.log` |
| wall_node_connected | Graph capability; all original proof/work/performance bounds and acknowledged writes remain | `node-connected-current.log`, `node-connected.json` |
| wall_node_delete | Explicit current graph fixtures and independent exact expected graph topology; native narrow camera readiness replaces a deliberately hidden Fit button | `node-delete-current.log` |
| wall_node_reliability | Shared-corner thickness is authored via a real thickness GraphEditResult | Tool run: 8 positive/zero/light/dark raster cases, exact cancel cleanup, writes=0, exit 0 |
| wallthick_standalone | A real wide Fit command precedes restoration of the tested narrow viewport with camera readiness; overlapping fixture authored by explicit partitions intent | `wallthick-current.log` |

`demo/helpers/graph-fixture.mjs` only re-exports the common kernel-test fixture
helper from the Node port. It supplies no writer permission, fake receipt, CAS
exception, or product-state interceptor. Node-delete's expected graph is built
independently by retaining the original A/C identities and deleting B; the
node-delete kernel is never called to generate that oracle.

The pinch comparison is the only numerical test-bound adjustment. Chromium's
native CDP touch coordinates quantize a requested 0.5 setup scale to
0.4999996532093395; the bound concerns only setup zoom. All world-coordinate,
identity, ownership, single-guide and painted-geometry checks remain unchanged.

Other originally failed geometry smokes are still being classified. A missing
test fixture capability is not evidence that a remaining geometry failure is
safe to ignore, and no aggregate all-green claim is made here.
