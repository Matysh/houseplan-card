# Stable test repair #1226

The796original unsuccessful entries from audit41598951489 are individually classified:230Node,177backend,122browser launches,267golden frames. These files are evidence and an explicit remaining-work inventory, not a green stable result.

- node-classification.json:209fixed,21red/pending in the latest addressed classification.
- backend-classification.json:177 original cases addressed; the two remaining cases now have a successful ambiguous-host control and separate successful legacy/current cross-runtime target controls.
- browser-all-classification.json joins root12, geometry32 and UI78 with exact original IDs:97addressed full-script successes;25retained failures;0not rerun. Every UI remainder has addressed evidence; actual failures retain their original guarantees. Status spelling is preserved from each sub-report.
- golden-classification.json: all9no-frame preparation errors repaired;258visual differences remain unapproved (139crop dimensions,119same-size pixels). Capture success never counts as baseline acceptance.

These are per-case latest addressed proofs with their recorded source versions, not a claim that every case passed one new full profile. The resumed integration uses accepted product dev `0c030e700`; no product fix is authored by #1226. Permission/CAS guards, skips, thresholds and visual baselines were not weakened. Complete history/host/identity/privacy oracles remain. Only valid current graph fixtures, official frozen legacy decoders and actual native accessible controls replace obsolete setup assumptions.

## Blockers and further work

All #1228–#1238 are now accepted in S8 and integrated from dev. Remaining confirmed and unresolved behavior is recorded in [resume-findings.md](resume-findings.md), including the current unhosted-opening edit refusal and native device Escape persistence. These are not waived by the accepted earlier fixes. Other retained cases require diagnosis, not automatic rebaselining. The title question was resolved by accepted #1207 UI-018: all full cards omit it, retaining the PDF setting; the separate static card keeps its title. The addressed full header smoke passes; see [header-title-contract.md](header-title-contract.md). Task remains S6+blocked on remaining behavior, corpus review and visual acceptance; no finish/review/S8 or release is claimed.

The complete #845corpus passport is still red: inventory84→90files and229→479documents after accepted Stage4 and these fixture changes. Current model11 canonical catalogue ordering and newly discovered graph corpus require a separate full identity review; output/issue1226/corpus-passport-current.json is review material only. The existing passport has not been blindly replaced.

All 229 original full inputs have now been recovered with exact original fingerprints and preserved as an immutable evidence archive, including inputs replaced by compressed hash receipts. See [corpus-preservation.md](corpus-preservation.md). This does not accept the current passport: 31 semantic mapping changes and two changed outcomes remain unresolved, and five protocol receipts were identified as extractor false positives.

Addressed Python integration:10passed/1failed (schema freshness and relay parity now pass). The initial addressed backend group was239passed/1failed. These overlapping selections must not be summed into a fictitious total.

The common fallback audit [41632300999](https://github.com/Matysh/houseplan-card/actions/runs/41632300999) completed on material `a07f4a10309c7b187ab122cf3227002f04c2e81d`, companion `6103fce2223768f7419192cdfa791ca51d232a49`. This material includes the first test ports and #1225 runner, before the later addressed ports on this branch; it is not the final AC3 candidate. Actual HA accounting is 77 business cases executed: 66 passed, 11 failed, zero skipped/unexecuted; all 10 setup cases passed. Failures are being separated into stale companion fixtures and product blockers in #1225.

The audit's 326 golden frames are **59 passed, 267 different, zero capture errors**. All nine historical no-frame cases now have actual images and remain unapproved differences. Reports identify material a07f4a103 and this run; they are not stale restored reports. This current count differs deliberately from the original 258 different + nine no-frame classification above. No baseline was accepted.

Backend raw output is **2844 passed, two failed, one skipped**. Its summary currently omits the failed-count key; the exit status remains failed. The two failures are coordinate-canonicalization's cross-runtime Optimize packet and #1228's ambiguous legacy opening. Missing summary fields do not imply zero failures. The final AC3 stable result waits for known product blockers and agreed visual intent; this diagnostic run is no release publication or completed AC3.

The omission is now fixed in the existing runner: only the last complete pytest summary is counted, including failed/errors. The same recorded line yields 2847 tests = 2844 passed + two failed + one skipped. TAP precedence, structured results, nonzero exits and nonempty guards remain intact. Addressed checks: `node --check` for runner and its test, then `node --test process-next/test/runner.test.mjs` — 22 passed, zero failed; the five new regression cases first produced four failures against the old parser. Evidence is in `output/issue1226/pytest-counts-{before,after}.log` in the author's analysis checkout. No backend or HA suite was rerun to validate this parser-only correction.

The later HA-fixture diagnostic [41646456489](https://github.com/Matysh/houseplan-card/actions/runs/41646456489) retained product material a07f4a103 and tested companion `afa1724d91205babbe6790804f2944450f7cf6fa`. All 77 business cases executed: **72 passed, five failed, zero skipped/unexecuted**; all ten setup cases passed. Six of seven addressed stale-fixture cases passed; the profile case advanced to its outer-Cancel behavior and remains under diagnosis. Other remaining cases are first-space exact lattice, the old Copy Optimize preflight and the two combined dirty transfer inputs. This does not certify later unexecuted companion edits or complete #1226 AC3. Actual common-run statuses are 459 reused, ten passed, 64 failed, two not-required and one blocked; elapsed 29m56s. Reuse is measured here, not inferred from unchanged SHA alone.

The separate current #280rehost packet is independently proved through real HA WebSocket acceptance, full stored-config equality and Undo (3/3addressed backend cases; original legacy targets retained). This is an added cross-runtime witness, not an increase of the original177-failure count.

The resumed shared audit is [41662157218](https://github.com/Matysh/houseplan-card/actions/runs/41662157218), material `0bda944e3` and companion `a5ba81a`. It is actual HA proof for #1225 and a diagnostic for #1226; later test-only ports on this branch are not retroactively covered by that SHA. Source build/test-build was prepared once and shared into the analysis checkouts. Addressed results and exact boundaries are in [resumed-controls.md](resumed-controls.md) and [ui-five-followup.md](ui-five-followup.md). No final AC3 or pending HA result is declared passed.

## Completed resumed shared audit (41662157218)

The existing common audit completed on clean material
`0bda944e3244a142449c30c5f802c14833af8c66` with companion
`a5ba81afb2b624e6b84d9b3605c63e97322efb25`. Runner execution lasted
70m26s (15:18:31–16:28:57 UTC); the surrounding Actions job also includes
preparation/upload. Its 539 plan entries are 492 passed, 44 failed, two
not-required and one blocked; none was reported reused in this run.

Actual HA accounting is **77 executed: 73 passed, three failed, one timed out,
zero skipped/unexecuted**. All ten setup cases passed. First-space lattice,
current dirty export/import and native profile cases now pass. The remaining
four cases are negative-import response-body capture, roomless Copy rendering,
legacy import Undo, and stored vacuum trail; their primary failures are being
diagnosed separately. A failed/timed-out case is not accepted as a pass.

Node geometry reports 1268 passed, 23 failed and one skipped. Backend reports
2904 passed, one failed and one skipped. Golden capture produced all 326 frames:
59 passed and 267 unapproved differences, with zero missing frames. These
numbers describe this immutable earlier candidate only. Later addressed fixture
ports and cross-runtime target controls are recorded separately above; no
later change is retroactively certified by this audit. The original 796-entry
classification remains intact, and no visual baseline was accepted.

The downloaded primary result lives in the author's workspace at
`output/issue1225-audit-41662157218`; it was downloaded once. No new run is
started by documenting this result. #1226 remains S6 + blocked; neither its
final AC3 nor a release is claimed.
