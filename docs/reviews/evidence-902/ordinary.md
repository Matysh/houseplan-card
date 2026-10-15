# #902 — ordinary pageshow / layout ACK evidence

Material before the product fix: `origin/dev@4e5d877af204b63e5745f237b170cfc952b8b5b6`.
An independent `npm ci` / build and `bundle-sync` supplied the native witness.
`node demo/smoke_pageshow_layout_ack.mjs` exited 1 (~6.5s): only
`ack-before-pair: accepted move remains undoable` failed. The reversed order
and fully-settled ACK were positive already; the existing fingerprint echo
barrier protects them, so this evidence does not pretend both orders were red.

The same command on the fix passed all three native sequences (~6.8s, exit 0).
It uses a real Playwright mouse drag/release, public HA `callWS` interception
solely to defer the original synthetic server operation/response, public
pagehide/pageshow events, native Undo click and keyboard Redo. No ACK is
invented, no private history is installed, and no product source or compiled
file is mutated. The server's saved canonical point, accepted card body and
actual marker left/top all match, with one wire write per drag/Undo/Redo.
Pinned headless Chromium is not owner field or real-GPU acceptance.

Risky neighbour: the first implementation additionally cleared already
accepted history on same-element detach. The unchanged
`node demo/smoke_editor_guides_lifecycle.mjs` correctly failed (history deltas
expected 0/+1, observed -4/-3). Removing only that excessive clear restored its
native PASS; the pending old-completion fence remains. This preserves #893's
existing accepted same-instance history, rather than broadening #902 into a
history reset policy. Foreign connection/user still clears as before, and no
history transfers to a different card instance. A positive compiled test pins
short detach, authoritative reread and the next deliberate accepted move.

`test/layout-write-reload.test.mjs` executes the compiled exported card's
`_loadFromServer`, `_persistDevicePlacement`, released `_pointerUp` and
history methods against ordinary controlled host/transport ports. It uses the
real `ConfigAdoption`, gated backdrop adopter, history stack and authority
owners. It covers both ACK orders, a write starting during the read/backdrop
await, current reject, newer external revision, connection/user/A→B→A/detach
with old success/error/finally, unchanged passive View/kiosk read counts, held
drag cancellation and settlement/retirement without residual receipts.
`npx tsc -p tsconfig.test.json`, `node scripts/fix-test-build.mjs`, then
`node --test test/layout-write-reload.test.mjs`: 36/36 PASS, raw exit 0.

| AC | Witness | What makes the oracle red |
|---|---|---|
| AC1 | Native `ack-before-pair` + exported full-read tests | Baseline loses accepted Undo. Ordinary negative schedules would adopt an exact older point or clear its real command; backdrop overlap likewise must preserve the accepted command. |
| AC2 | Native Undo/keyboard Redo and exported history methods | Each step must restore the exact saved canonical point with exactly one additional real write. Fully-settled baseline remains positive. |
| AC3 | Controlled authority/reject/external/passive matrix | Old callbacks must preserve the exact fresh config/layout/revision/history/busy/events/pending map; a true newer external body must replace it and clear conflicting history. Passive clients get one config/layout/trail read, and old settlement cannot release fresh waiters. |

Three declarations in `scripts/mutation-registry.mjs` name the overlap,
backdrop and retirement guards with the cheaper compiled Node witness.
Only `node scripts/mutation-gate.mjs --check` is allowed here: static readiness
is not caught proof. No mutants, including manual compiled mutations, are
executed in implementation or review (PROCESS §2.7 and the direct batch order).

Risk selection: async order/lifecycle, server rejection and HA ownership are
executed. Geometry/gesture classification/render algorithms, server protocol,
CAS/ACL and persisted schemas are unchanged. Bookkeeping holds only active
write tokens/current waiters; no pointermove work, permanent receipt, scan,
new timer or polling is introduced. Each load has at most two reads; a further
actual write re-arms once after that load finishes. External edits stay visible.

Direct owner instruction for this batch: do not create new issues for findings.
Fix in-scope findings in #902; send out-of-scope symptom/material/evidence/risk/
links to root for `batch-findings-2026-10-15.json`. This does not permit gate,
budget, review or GPU acceptance substitutions.
