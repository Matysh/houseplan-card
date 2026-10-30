# Space-copy dialog retirement — #1154

## Reproduction and release boundary

The owner and an authenticated in-app-browser observation reproduced the copy
name dialog flashing and disappearing on 1.83.0-beta.4 / HA 2026.10.4, before
name submission. No live configuration or device state was changed.

An offline comparison served each tag's actual committed frontend bundle and
matching synthetic demo, with the same pinned genuine HA dialog 20260729.7.
Bundle manifests were verified before use; no current product source was
substituted into the historical releases.

| Tag | Commit | Copy state / name field after retirement |
| --- | --- | --- |
| v1.81.0 | deee605cb8c88584c14e2e1fe15360e073acd5c6 | retained / present |
| v1.82.0-beta.3 | 41148d89fb50e3fdcac6f8e6536b74e7c0b6ca8c | retained / present |
| v1.82.0-beta.4 | b4815c509ac85522da13555687ab34f64316820c | cleared / absent |

The first affected release is v1.82.0-beta.4, published 2026-10-20 21:48:15 UTC
(2026-10-21 00:48:15 Moscow). Stable v1.82.0, published 2026-10-21 13:52:19 UTC,
contains the same path. The intervening hp-dialog changes belong to #976
(99d390975 and c93671700). This comparison establishes the release boundary;
it is not an arbitrary-device/browser matrix or an exact-commit bisect.

## Cause and correction

Switching from Space settings to Copy replaces the hp-dialog template. After
disconnect, HA's nested WebAwesome modal emits wa-hide. The retired hp-dialog
used to convert it to hp-close; the old clean-form handler cleared the shared
space-dialog state, closing its successor. The observed trace was:

1. wa-hide on a disconnected original shell, while copy state is present;
2. hp-close on that disconnected Space settings shell;
3. copy state cleared, followed by the new Copy shell's hide/closed events.

In a diagnostic-only control, suppressing just the disconnected hp-close kept
the copy state and input. Production now rejects disconnected requests centrally
and ignores detached HA hide/closed events before touching event/exit state.
Connected requests, reconnect and accepted exit behavior remain unchanged.

## Evidence

`node demo/verify_space_copy.mjs` failed on unmodified e56afbf79 source with
`copy:false` and `retiredCloses:1` versus required `copy:true` / zero orphan
closes. After the fix it passed all five checks: two name/cancel routes, zero
pre-confirmation writes, dirty-draft Keep, accepted Discard. It uses the authentic
HA fixture, whose provenance is printed by the command, with zero page errors,
external requests or WebSockets. It is not a full HA server harness.

`node demo/smoke_dialog_modal_recovery.mjs` also covers detached HA hide and
closed events, then reconnects the same shell and proves normal close still
works. `retired-dialog-closes-successor-1154` registers the corresponding
negative witness for nightly mutation execution; registration is not a caught
result. Ordinary smoke coverage also exercises the existing full space-copy
flow and Escape behavior.

An initial run of the old all-form `verify_ha_dialog_discard_recovery.mjs` stopped
before reaching this scenario: its pre-#976 expectation that the parent HA
open property becomes false while dirty confirmation is shown is obsolete.
That failure was not counted as this regression's red witness; the dedicated
copy diagnostic above supplies the actual before/after evidence.
