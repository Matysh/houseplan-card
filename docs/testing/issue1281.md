# Stable-profile test repairs (#1281)

Full local stable run `20261104T151051293-af986f0c` tested dev
`c8216bb11a0a46477bfebf3c2c2154033f19294c`: all549 steps without reuse.
Three Node cases and two browser files failed. Golden326/326, HA77/77,
backend2916 cases and all three converter formats passed. Addressed repairs
here do not replace those original full-run results.

## Independently derive the Split passport change

The #1099/#1100 passports predate #1279's shared physical divider fix.
`issue1281-split-before-1279.json` preserves full old outputs, captured with an
isolated module-loader substitution of only #1279's new-divider lookup with
its old expression. Product/build files were not changed. The original exact
passport hashes authenticate the complete old configs:

- #1099: `cf110a0f2a0ae870f4dd3e09052f0e0b7a03d397a72115005feef6c079ec9aa9`.
- #1100 edit/Redo: `d8062de0ac5876e4f3e7498a29af2fcdf7e26f8f881199943f53a5a5ea63e84c`.

The permanent provenance test constructs the expected current bytes without a
graph writer: delete duplicate `ge-7e267159770eedb9`, reuse
`ge-6449b68f5f0c8a9e` in room`right`, and reverse that cycle reference. History
uses the same bounded substitution of `ge-a02016f0df5f15a0` with
`ge-2755a2d6e28827ff` in room`split-b`, in edit and Redo only. Each pair must
have opposite endpoints and equal material. Array order, all other fields,
floors, metadata, markers, dependencies, history/writes/toasts and exact Undo
remain unchanged. The resulting entire serialized documents equal current
outputs. Only the three affected expected hash occurrences change.

## Two new full current corpus inputs

`room-host-promotion.json/previous` and `/message/config` were added by #1265
after passport preparation. Both are complete canonical model11 documents:
the entire committed output deep-equals the persisted source, which is immutable.
Their expected identities/full-config hashes are derived directly from source,
independently of decoder output. Permanent tests require that whole equality.

- `previous`: complete-config hash `a3f44ac1a3432615418ca5e96ccfbc04a260bde74cf1a2e92793f0f1e25fe4db`.
- `message/config`: `463a1b416e1dc1476b7dbfa581789d2293e24fdaa1be398929648659ffd2b394`.

Only object keys are canonicalized by the existing hash. All573 old rows and
their order remain unchanged; there are now575 full documents from92 files.
Historical inputs, source membership, immutability, byte idempotence, atom/room
multisets, oriented cycles, opaque metadata and negative controls remain.

## Native drag Escape

The rotated native drag in `smoke_approved_ui` now follows #1263: first Escape
retires the drag and immediately restores exact layout, history and write count
while retaining selection. Next Escape clears idle selection. Mouse-up still
cannot change that state. Native pointer input and actual rotated movement stay.

## Measure the current painted summary form

The original44px failure logged only a boolean. Diagnostic measurements of1284
targets and11 finite-animation frames did not reproduce it. Its exact element
and phase cannot be recovered; a persistent product sizing defect is unconfirmed.

The test captured controls/Cancel before23 asynchronous reopens, then measured
after only the parent's `updateComplete`. That does not promise nested UI-kit
readiness or completed finite presentation. It now obtains fresh references
from the current connected form after existing read-only `waitForUiKitPaint`.
Open/input timings stay before that wait, with unchanged250ms/50ms budgets.
The complete nonempty inventory must equal the original count. Native hidden
selects still map to actual shared-picker buttons. Both dimensions must remain
at least44px, without epsilon or omitted targets.

A negative control narrows one actual drag target to43px, requires rejection
by the same reader, restores its complete style attribute and requires success.
Failure evidence includes count, minima and invalid IDs/classes/connection state.
No product sizing, animation suppression, timeout increase or retry is introduced.
