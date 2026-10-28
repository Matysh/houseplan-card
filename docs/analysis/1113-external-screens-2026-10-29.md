# External screens #1113 — acceptance evidence, 29 October 2026

Authority: issue #1113 SPEC r1 (GREEN comment6468121860), and
[approved UI-002r3, immutable c0a4fa9278e0](https://github.com/Matysh/houseplan-card/tree/c0a4fa9278e0d5f1b0924e38bcb3e8eb959d1636/docs/design/1113-external-screens/2026-10-28).
Owner [#1120](https://github.com/Matysh/houseplan-card/issues/1120) supersedes
#1103's menu-in-kiosk expectation. Header changes belong to #1120; #1113 adds no
header setting or implementation.

## Protective acceptance: what turns RED

| AC | Executable witness | Negative input / registered witness |
| --- | --- | --- |
| 1 draft/session | Native create/cancel/Escape/delete/nonreuse, refused Save and accepted animated exit; controller unit | Actual stale session, changed authority, disconnected/read-only/busy host reject; `screen-constructor-accepts-retired-session-1113` (not executed) |
| 2 persisted compatibility | Backend v1/max20/ID/old writer/future namespace/restore/import/projection | Actual duplicate/decreasing/reused ID or changed broken-space rejects; `screen-retired-number-reissued-1113`, `screen-old-writer-erases-namespace-1113`, `screen-changed-broken-space-accepted-1113` (not executed) |
| 3–4 URL precedence | Native cold query/path; external-screens unit matrix | Malformed fields fall back independently; original accepted502 parser RED for profile kiosk/rotation, original compiled local readers split aliases; `screen-url-loses-field-priority-1113` (not executed) |
| 5 rotation | Resolver unit, plan-rotation/panel-route smokes and profile90 Golden | Invalid rotation ignored; positional path conflicts covered; ordinary View/Lovelace keep their original rotation paths |
| 6 cycle/idle | Carousel fake-clock deadlines/disposal and kiosk-cycle-context smoke | Pointer/modal holds prevent fit, one space cannot cycle, idle fits once then rearms; `screen-idle-fits-under-pointer-1113` (not executed) |
| 7 presentation | Live native readback, trusted three-second hold, locked sliders/reset/explanation; summary/hidden/scale smokes; profile Golden | Local preference bytes unchanged; false/zero remain effective; old backend explains without write controls; readonly has no settings |
| 8 live adoption | Two native consumers on synthetic HA wire: kiosk config/get, setConfig and real geometry counters unchanged; actual common adoption owner unit retains virtual-light snapshot/ACL/capabilities/body identities | Actual stale/gap/replay/mixed/body-reference inputs reject or reload; `screen-mixed-event-claims-patch-1113`, `screen-event-ignores-exact-base-1113`, `screen-only-candidate-allows-geometry-1113` (not executed); HA ticks reuse resolver object |
| 9 local identity | Path/slot/user unit matrix; summary/hidden runtime tests | Panel aliases share root; other users/panels remain separate; Lovelace paths/slots stay distinct |
| 10 neighbors | Named legacy smokes in ledger; route/adoption/carousel/summary units; normal protected gate | Native refused Save/read-only/old-backend; only the approved seventh settings section updates the old form-order oracle |

## Visual proof and its limits

Matched reference/candidate: HA frontend20260930.4 wheel
`05c207fb6ce6720d1782766b54a67acdf4bab83f133a562204b972d062862fc8`,
1280x720/dark/ru, dataset `synthetic-f2f801104e8d4a28dbd70b2e`, loopback only.
Reference is immutable r3 replay on beta3 `09bda8dbee8b50577bfc4affc332b8cda914f5b4`;
candidate is native product code without DOM replay injection.

Nine labels/field rectangles/fonts match; padding20px, no inner card. Both live
sides compute shared UI Kit grid gap16px (prototype declaration20/24px). Escape
keeps outer dialog. Clipboard contains the full installation URL. Same-session
Save ACK keeps the inert outer dialog during animated exit; at least two actual
RAF frames are required independently of PNG captures.

Before hover settlement the constructor had619 outline pixels different by one
channel level, bbox[648,359,924,402]; empty/list were byte-identical. This was
recorded as a difference. The final matched recipe uses the same180ms shared hover
settlement on both sides: all three PNG pairs are byte-identical, constructor0 differing pixels/maxdelta0. Both live ACK exits retained14 inert frames,0pageerrors/external calls. Static PNGs do not
prove animation. Golden has a synthetic font environment; it is not the HA pixel
comparison. Its missing monitor icons are installed from pinned @mdi fixture
paths with a positive ink assertion; no global baseline is accepted here.

## Recorded local results before rebase

Build fingerprint `4d8fc64ea2eb272c1257d18bd6cd765f6a231fcad50974813a4742af0699ab88`:
build22.6s,92 focused unit PASS, native26 assertions PASS/pageerrors0.
Addressed backend `python -m pytest tests_backend -q -k 'external_screens or summary_panel or support_config'`:
47PASS/2586deselected/1.52s. Direct pytest launcher first omitted repository root
from sys.path and failed collection; only invocation was corrected.
Mutation static check:2020definitions/eight inherited warnings/**execution0, caught unknown**.
Old #660/#780 declaration anchors retain the same omission/oracle after retarget.
Resource own-cost/donor equivalence and preserved bands are in DEVELOPMENT.
Exact post-rebase protected push/CI/CODE evidence belongs to the handoff.

E2E verdict **надо**: real HA admin/mobile/viewer kiosk journeys and independent
profile clients belong in the companion repository before beta. This native
fixture is synthetic; a skipped installed-version gate cannot establish PASS.

## First protected push refusal and addressed correction

The first normal push of be145ca5 was refused after266s: core line ceilings,
two matrix-version inventories, the closed new dialog kind, the Golden input
corpus, a panel-root local-preference fixture and provenance fixture assuming
that the matrix's first scene already has a baseline. No branch was published.
The old presentation/authority/negative assertions are retained; their saved
main-panel preference now uses the registered root. New Golden entries append
after existing entries; no accepted first scene is replaced. Closed inventories
are extended to the actual new kind/helper; matrix oracles use105. The core
ceilings carry only measured own35/7 lines, retaining inherited28/46 gaps and
the50-line band (see DEVELOPMENT). All131 focused tests across the seven
affected suites PASS/0skip in3.21s.

Moving the new matrix entries changes the frontend/build fingerprint. The4d8f
local visual captures above remain prior-input evidence; final normal build and
exact-source CI must prove the new material before acceptance. No source
behavior, visual content, negative oracle or guard was weakened.

Final normal protected push of8578b0e8 passed262s/0failed and published the branch.
Build fingerprint31510e3814f4b7ee74e25387e44577427874bcd25e0c7ab98e45150a661f153f;
raw3685856/initialgzip359702/editorgzip382259. The unchanged carried references
leave1441/1421/1025B gaps inside the original2000B bands; no further ceiling
change was made for fingerprint/chunk-hash compression variation. Product and
tooling groups, type/build, no-new-any/private-writes, CSS, bundle policy/budget
and unused/core connectivity all passed. Remote exact-source CI remains separate.

## Revision2: authenticated non-admin delivery

The author withdrew S7 (finding6482427355) when real-HA seam research proved
that generic subscribe_events rejects custom Houseplan events for non-admin
users. This is confirmed in official HA2026.10.4 commands.py179–208 and
permissions/events.py27–47. The earlier synthetic native cases were admin-only;
they never proved the viewer boundary. No code was pushed while S7 was active.
After S6→S3, SPEC r2 was reviewed GREEN H0/M0 (6482666148), then implementation
resumed in S6 (6482683896). Previous sourceee816580 and its normal GREEN gates
remain historical, not approval of the corrected transport.

The new fixed own authenticated command, runtime capability and subscribeMessage
replace the main panel's single config subscription under the same lifecycle
owner. Initial ready/resync carries revision only: it cannot claim a full config
candidate. A complete patch still requires exact base/successor and persisted
namespace equality. Mixed/gap/unknown/pending-writer retains full authoritative
reload. The endpoint never accepts arbitrary event_type, changes HA core
permissions, grants write rights or delivers other integrations' events.
Per-delivery active-user/runtime identity and ordinary unsubscribe/disconnect
remove the own listener; late frontend subscription completion retires once.

Actual local HA is2026.8.3, not2026.10.4. Five own HA test functions/six collected
cases PASS without skip or teardown error; with namespace/projection tests the
addressed result is40PASS/1.89s. They exercise real USER/READ_ONLY subscriptions,
complete patch, initial race/resync, mixed changes, forbidden generic/arbitrary
events and forged own-bus payload, active-user negative input, real unsubscribe
and disconnect with listener count restored, bounded subscriptions/strict bases.
The first attempt expected an own closed frame after the full HA AuthManager
revocation API; HA instead closes the whole socket first. Own per-delivery
revocation uses the ordinary inactive-user input, matching the existing LQI
subscription test, and actual ordinary close still proves connection cleanup.

A separately introduced broad HA-core AuthManager regression had passing body
assertions but a WebSocketResponse._send_heartbeat teardown error. Public owning
TestClient/server drain did not remove it. A bounded isolated HA-only baseline,
without loading Houseplan or adding this listener, reproduces the same result:
1assertionPASS plus1teardownERROR in1.20s. Its initial wrong -c pyproject invocation
failed fixture setup; only the corrected -c pytest.ini run is baseline evidence.
The diagnostic remains outside the product suite and is not counted as PASS.
Only that additional broad-core test was excluded; no existing guard, ignore,
expected-lingering marker, core policy or timer cancellation was changed. Real
HA2026.10.4 browser/profile acceptance remains the companion exact-beta4 CI task.

Frontend typecheck and24 focused unit tests PASS. Ruff for the entire integration
PASS. Four new protective declarations (own revocation, forged namespace,
initial projection authority, late subscribe cleanup) are registered; static
readiness2027definitions/eight inherited warnings, execution0/caughtunknown.
The existing #890 old-subscription declaration was retargeted to the same
ownsContext omission after extraction; its native oracle remains unchanged.
No mutant was executed. General-settings legacy section order and all new de/fr
settings translations address the actual prior CI failures without weakening
locale or form semantics. New Rollup/native/exact-source CI evidence is required
for this r2 delta; prior31510/4d8f bundles are not its build proof.
