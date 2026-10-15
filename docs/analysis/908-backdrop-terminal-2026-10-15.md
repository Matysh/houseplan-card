# Backdrop terminal evidence (#908, 2026-10-15)

Author verification notes, not the independent code-review verdict.
Touch editor: best effort / intentionally degraded.

Accepted-current base: `eda7fabd` (the implementation checkout started from
`origin/dev`; only test witnesses were changed before the first red run).
`node demo/smoke_grid_scale_invariance.mjs` failed solely at
`backgroundPointerCancelIsMutationFree`: the 5 cm and 1 cm probes delivered
trusted touchCancel to their started pointer, retained `cursor: grabbing` and
`dragEnded: false`, while both reported `configSame: true`, `changedKeys: []`.
The strengthened same witness passes after the implementation.

The existing `smoke_backdrop.mjs` scenario now exercises move, corner scale and
rotation against all three terminals: trusted CDP touchCancel, native Escape,
and Chromium's trusted lostpointercapture after actual capture release and the
next native mouse move. Observation is after two completed RAFs, without an HA
state tick. It reads the actual stage class/computed cursor, size badge, owner,
complete config/layout, revisions, history size and wire write count. The next
native drag and its cancellation are observed in the same editor session.
Normal release remains one save/one history step; native Undo restores the six
backdrop transform fields and the history cursor. The existing per-move render
counters stay unchanged: only the live paint advances during the six moves.

| AC | Executed witness | Negative witness / declared mutation |
|---|---|---|
| AC1 | `node demo/smoke_grid_scale_invariance.mjs`; `node demo/smoke_backdrop.mjs`, terminal cases | Accepted-current red cursor described above; `backdrop-cancel-retains-grabbing-cursor`, `backdrop-capture-loss-retains-owner` |
| AC2 | `smoke_backdrop`, terminal ledger, late release, immediate next drag and normal release/Undo | A live move changes config before cancellation; `backdrop-next-begin-forgets-grabbing-cursor` |
| AC3 | `node --test test/backdrop-frame-gesture.test.mjs test/live-editor.test.mjs test/geometry-history-refusal.test.mjs` (47 passed); six-move counters in the browser | Existing live-vs-full-render counters; source diff leaves move scheduling and transforms intact |

Mutation declarations are statically checked only. No mutant was executed or
claimed caught; nightly execution owns that evidence.

Verification on this material: `npm run gate:small` passed (135 s), including
the full unit suite, typecheck, bundle policy/budgets and source guards;
`npm run toolchain:check` passed. The final backdrop witness passed in 25.5 s,
and the strengthened grid witness in 13.1 s. The actual dirty source diff was
fed to `smoke-select --diff`: all ten direct matches were run, with additional
`smoke_decor` and `smoke_backdrop_guard` for neighbouring owner/picker behavior.
The selector's broad `_editorRuntime` matches (61 weak/registered matches) are
not a claim that the entire associated matrix was run: this change only adds
an owner-ID-gated terminal and backdrop begin/cancel presentation, without
altering those other flows. All ten direct matches and the adjacent Decor and
backdrop guard scenarios were selected for execution. Raw logs and true exit
records are kept separately
in `/home/matysh/hp908-evidence`; no generated product bundle is committed.
No size ceiling changed: raw bundle 2,925,438 to 2,925,700 bytes (+262);
host references 5,347 to 5,349 (+2), other source metrics unchanged.

The first pre-push gate correctly rejected this author's evidence note in
`docs/testing-notes/`: that directory admits only the browser-guard registry
(#681). A file-backed full unit retry reproduced that single placement error;
the note was moved here, without weakening the directory contract.

Risk cases: async capture loss and late mouseup are exercised with owner IDs;
data/history/wire state is compared before and after cancellation; geometry
is restored and existing transform tests remain; terminal cursor and immediate
next begin are observed in actual DOM; no per-move full render is added;
mouse/keyboard/trusted browser touch cancellation are exercised. New permissions,
bulk-data work, saved schema and View/kiosk behavior are not introduced.

Stable classification was checked by reading
`v1.80.1` (`89b09f41a732ceeddd9327656aa392e5201fbedb`): its editor-runtime
cancel already cleared `_bdDrag` then selected `_terminalFrame = 1` after
restoring the transform. This is source evidence of the same retained path,
not a claimed stable browser run. Current Chromium is pinned headless shell
151.0.7922.34, Playwright 1.62.0. No real-device, HA-shell, GPU or owner
acceptance is inferred from these checks.
