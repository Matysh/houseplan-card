# #1234 — camera after late structural revalidation

Base: dev `a52e6cb44514c55826400c7f3b12623fe76081bf`. Node 22.23.2,
pinned Playwright 1.62.0 / Chromium headless-shell 151.0.7922.34 rev 1234,
Ubuntu WSL. Synthetic demo authority, real production bundle.

## Reproduction and cause

The issue-linked `codex/1226` `repros/warm-camera.mjs` was copied to local
output with only its relative imports adjusted. The original readiness guard
failed on the fresh build: final Plan stage 780×704, recorded stage and camera
780×793, no pending refit or mode request. `--fast` and `--same` controls passed.
Instrumentation that measures intermediate layout can hide this race, so the
uninstrumented script remains the before/after witness.

Warm mode requests previously held refit only if the current camera still
equalled the memo. When late geometry or a newer camera changed that equality,
`resumeWarmMode` released before the final editor render. A temporary View size
could become the camera baseline, then ResizeObserver could coalesce the return
to a Plan size it had already seen. No later observer callback repaired it.

Every warm adoption now owns the existing refit hold until the editor render
barrier. The unchanged applicable camera is restored as before. A changed
camera stays current, its obsolete draft is retired, and the same render
barrier releases the hold so `_releaseWarmRefit` reconciles its aspect with the
actual final stage. Rejected/superseded mode requests retain ownership checks.
No timer was added; the existing update-complete/two-frame layout barrier was
reused. No geometry, history, transport guard, or camera fit formula changed.

## Addressed evidence

- Fresh product build and demo sync: pass.
- Original unmodified readiness scenario: fail before / pass after.
- `node --test test/warm-mode-adoption.test.mjs`: 3/3. Changed camera waits for
  editor paint without memo rollback; applicable camera/return address survive;
  refused modes and stale completion cannot release a newer owner.
- `node demo/smoke_warm_geometry_camera.mjs`: 12/12 checks across delayed changed,
  delayed unchanged and fast changed snapshots. The original subpixel aspect
  and painted-SVG guards are retained, alongside the actual stage baseline.
  Changed-snapshot cases capture an exposed node with one native press and
  cancel using Escape without changing the fixture server snapshot. The
  unchanged case changes zoom using native wheel input before remount and
  proves exact camera preservation. It intentionally crops diagonal endpoints;
  node capture is tested on the exposed changed-snapshot nodes instead.
- `node demo/smoke_warm_remount.mjs`: pass.
- `node demo/smoke_nav_persist.mjs`: pass.

The registered native regression derives from the original reproducer, removes
its unsupported initial-revision fixture option, and adds the two controls.
It never assigns the camera, forces a refit, retries missed input, or lowers
readiness tolerances. The 900 ms delay is the input transport fault, not a fix
or a post-action settling sleep. Browser results do not prove HA install or
network durability. No golden/crop baseline was accepted; unrelated visual
audit differences still need their own diagnosis.

Companion E2E impact: same-placement editor remount, delayed authoritative
geometry change, final stage/camera alignment and one native node capture;
unchanged late response must preserve a user zoom/pan, and explicit navigation
must supersede a pending editor restore. Parent maintains the companion entry.
