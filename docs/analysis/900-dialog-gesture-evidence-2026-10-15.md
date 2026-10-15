# #900 dialog gesture evidence — 2026-10-15

Author implementation evidence, not an independent code-review verdict.
Touch editor: best effort / intentionally degraded.

The initial implementation was frozen on base
`f819e489d9394a09588a5db4a93f393a07fd911d` while the owner decided the raw
bundle ratchet. Before resuming, all 25 checkpoint file hashes were identical.
The owner authority is [issue comment 6193307612](https://github.com/Matysh/houseplan-card/issues/900#issuecomment-6193307612):
the authorised `bundleBytes` baseline is exactly **2931171**, not the frozen
measured 2931183. The existing 2000-byte band and every other limit remain
unchanged. The frozen measurement is 12 bytes into that unchanged band.
Any later rebased measurement is reported separately, not labelled this older
result. No blanket permission for future size growth is inferred.

Before the pause, the new ordinary browser witness
`demo/smoke_canvas_surface_gestures.mjs` passed all 58 observable checks in
28.4 s on pinned Playwright1.62.0 / Chromium headless-shell151.0.7922.34 rev1234.
It uses native mouse/text selection/wheel/keyboard and synthetic touch/pen
contacts for the specified best-effort cohort. Config, wire calls and history
are observed, not replaced by event-handler counters. Camera and dialog
rectangles are read during held input as well as after release.

| AC | Ordinary witness / oracle | Negative boundary |
|---|---|---|
| AC1 | Native selection then typing 9, held and released camera/rectangle unchanged | Input/buttons excluded from drag handle; declared handle mutation |
| AC2 | Background/label/unit movement 1:1, subthreshold press, cancel/capture loss | Config/history/draft/camera/writes unchanged; terminal owner retired |
| AC3 | Extreme drags and stage resize stay within 8px; pure clamp tests | Oversize top-left fallback; declared clamp mutation |
| AC4 | Held empty-stage pan, wheel and zoom controls move camera but not screen dialog | Declared camera-layer mutation; intermediate rectangle oracle |
| AC5 | Focused input and dialog wheel leave value12.5 and camera unchanged | Declared wheel-default mutation |
| AC6 | Focus, button-drag, Escape, Enter/checkmark/apply-room and centimetre wire payload | Exactly one history/write on apply, none on dismissal |
| AC7 | LED title/list/footer drag and wheel retain camera | Modal stays non-draggable and owns its input |
| AC8 | Touch/pen contacts on fields/LED never navigate/write; scene pinch still zooms; View surface contact cannot seed second scene finger | Declared contact-routing mutation; physical contacts remain registered for stale activation safety |
| AC9 | Pure composed-path cases, future native input with no local stopper, room/device/settings dialogs and Plan/Background trays | Declared stage pointer guard mutation; background/room paths remain admitted |

The issue's analytical execution on older dev/stable is historical diagnosis,
not current pinned-browser or real-device acceptance. Mutation declarations
are statically checked only; no product mutant is executed or claimed caught.
Before the pause, 55 scoped units and the 11 named regression smokes passed.
The first full gate was red on four then-fixed scoped units and the raw budget;
it is not a current green full-gate claim. Fresh gates on the rebased committed
material belong in the final issue handoff. Raw outputs and true exit records
are separate in `/home/matysh/hp900-evidence`.

Risk boundaries: the dialog owns only session DOM position/capture/resize and
disposes its RAF/observer/listeners at each keyed opening; it does not render
the host per move or change persisted fields. The common scene predicate owns
the composed-path decision, not physical contact lifetime. Config/history
transactions remain in their original apply handlers. No heavy eager dependency,
permission, HA protocol or migration is added. #911 wall highlighting is not
part of this change. Headless proof is not owner field/HA-shell/real-GPU proof.

Per the owner's explicit 2026-10-15 batch instruction, new out-of-scope findings
must not create issues: symptom/material/reproduction/risk/links go to root's
single `batch-findings-2026-10-15.json`. In-scope defects stay here.

Resumed verification on `5bb47899`, rebased onto merged #901/#903
`4e5d877a`: the full `gate:small` passed (146.5 s), and the 58-check AC smoke
passed again (28.5 s). Raw bundle was 2931609, 438 bytes above the authorised
2931171 base and inside its unchanged 2000-byte band. Gzip initial View321638
and lazy editor265664 passed their existing limits. The new merge-entry reader
and actual-history catalogue accepted the renewed stable-fix record separately
from the SPEC trace; mutation static readiness passed with execution=0.

The actual diff selected 49 browser smokes; four additional AC regressions made
53 executed scenarios (two browser lanes). The first pass had 51 PASS and two
honestly retained RED results. `smoke_editor_gestures` used old direct event
objects without `composedPath`; its seven fixtures now supply the actual stage
path that native PointerEvents carry, as the pan fixture already does. Its
targeted retry passed all 18 checks, without a product fallback or weaker oracle.
`smoke_wall_node_connected` refused a 1.425917ms clock-calibration uncertainty
against its existing 1ms floor under the concurrent browser workload. With that
queue stopped, an isolated retry passed (13.1 s), with no clock, geometry or
performance threshold change. That transient diagnostic and both raw runs go
to root; the earlier RED is not relabelled GREEN. The final handoff names the
published SHA and its subsequent mandatory pre-push gate separately.
