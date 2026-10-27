# Device threshold alarms — implementation evidence (#1000)

The accepted contract is issue #1000 SPEC r3, body digest
`88dc3d01d42b45c83ebb8029055c1d1509a2cf41e1e3c3fe425b1640a8f70d5d`.
This directory records task evidence, not global Golden baseline acceptance.

On 27 October the owner explicitly authorized calibrated initial/core limit
increases and stopped byte-saving work: [#1000 decision](https://github.com/Matysh/houseplan-card/issues/1000#issuecomment-6440488743),
[#1070 decision](https://github.com/Matysh/houseplan-card/issues/1070#issuecomment-6440488253).
The approved values are initial absolute387200/calibration352000 and manual core
reference14660 plus the unchanged50-line band. They will be inherited from
accepted #1070; rolling2000-byte bands, performance and safety remain unchanged.
Price snapshots below retain their original historical limits and source identities.

## Accepted UI and paired replay

The immutable visual package is
[`9db1e66f34dd95df6d28cabe0f69acfee015d5cd`](https://github.com/Matysh/houseplan-card/tree/9db1e66f34dd95df6d28cabe0f69acfee015d5cd/docs/design/1000-device-alarms/2026-10-26).
All 24 package files were checked against their Git objects;
[immutable-package.json](raw/immutable-package.json) records blob IDs and SHA-256.
Windows text checkout line endings are recorded separately; binary files match exactly.
The replay uses the package's synthetic fixture on its actual product base
`ebecea6db23aea0531de64d996b68a9b4c7df8ca`, HA frontend `20260930.4`
(wheel SHA-256 `05c207fb6ce6720d1782766b54a67acdf4bab83f133a562204b972d062862fc8`).

The candidate uses the same fixture and pinned native HA controls, without the
reference prototype, DOM injection, localStorage row adapter or replacement product CSS.
The replay-only HA dialog scrim token/override is shared with the reference.
Both servers report synthetic dataset `f2f801104e8d4a28dbd70b2e`.
The [paired raw report](raw/native-paired.json) includes both provenances and measured
styles for light/dark themes at 1440/390 px, DPR 1, Chromium `151.0.7922.34`,
Playwright `1.62.0`. Candidate production source fingerprint:
`63a74bf687eeef5c8bc087e5d365fb50da01784af937ebb6a005cc4c2c8c4bfa`.

| Theme / width | Table differing pixels | Constructor contract |
| --- | ---: | --- |
| Light / 1440 | 0 / 118404 | Common body/card width, font, padding, radius; source and footer match |
| Light / 390 | 0 / 103532 | Same; narrow common body padding is 18 px 14 px |
| Dark / 1440 | 0 / 118404 | Same |
| Dark / 390 | 0 / 103532 | Same |

All four cases have a real `ha-dialog`, common help control, no horizontal overflow,
no page errors and no external requests. Reference and candidate constructor images
are in [screenshots/](screenshots/); light desktop empty tables are also included.
The candidate adds the explicitly approved Attention/Alarm selector and accurate
three-second/cause wording, so the whole constructor is taller. The historical
prototype text mentioning room/summary counters is superseded by owner decision
[6420546189](https://github.com/Matysh/houseplan-card/issues/1000#issuecomment-6420546189).
No room/summary surface was added.

## Contract to observable checks

| Acceptance | Executable witness |
| --- | --- |
| AC1 — local constructor, own sources, typed controls, max three, nested/outer draft | `smoke_marker_alerts.mjs` actual clicks and persisted payload; `marker-alert-editor.test.mjs` actual rendered callbacks for retired form/table/session ownership; backend writer rejection |
| AC2 — comparisons, raw enum types, unknown data, direct scalar attribute | Shared TS/Python fixture `test/fixtures/marker-alerts.json`; codec/source tests; localized binary label with raw `on`, numeric-looking enum raw `"123"`, disappeared option visible and invalid in the controls smoke |
| AC3 — continuous 3000 ms on and off, noise, no stale deadline | `marker-alert-runtime.test.mjs` monotonic controlled clock at 2999/3000 ms, cancelled candidates, current deadline read, rule/authority/dispose retirement; View runtime owner and reconnection tests |
| AC4 — marker, actual preview, grouped reasons, priority | `marker-alert-presentation.test.mjs`, `device-issues.test.mjs`; controls smoke confirms three distinct causes, actual attribute wording, immediate unchanged preview; six Flat/2.5D plus reasons Golden task scenes |
| AC5 — retired rule/owner, missing/disabled source, rights and lifecycle | Runtime deadline/owner tests, selected reader rejects foreign/disabled/missing before state access; actual form callbacks reject retired owners; cold View checks readonly/kiosk, static mode, reattachment and deleted-rule non-resurrection |
| AC6 — optional lossless definitions, TS/Python parity, JSON/ZIP/copy/rebind | Shared codec fixture, `test_marker_alerts.py`, actual HA `test_ha_marker_alerts.py`, full/space JSON and ZIP round-trip additions; codec rejects duplicate IDs/fourth rule, no runtime state fields are written; existing device-copy neighbor |
| AC7 — common cause model, native critical/maintenance policy, no external producer | `marker-alert-presentation.test.mjs` and `device-issues.test.mjs`; future/external data is inert and rejected for a new write; existing native RGB/state-source neighbors |
| AC8 — selected-field work, optional View graph and lifecycle | `marker-alert-view-runtime.test.mjs` selected read/retired callback tests; `smoke_marker_alert_view.mjs` cold network requests, readonly/kiosk, static/unsupported input, reconnect/removal; volume counter below |

Current native checks: [controls smoke](raw/native-controls.txt) passes all 23
observations; [focused Node run](raw/node-focused.txt) passes 100/100 tests.
The [native](raw/native-build.txt) and [Linux](raw/linux-build.txt) production builds
pass with matching source fingerprint. These files do not claim completion of
the final selected browser plan, full gate or independent CODE review.

The volume unit uses 200 configured devices, 600 rules and 15000 unrelated HA
states. An instrumented `states` proxy rejects enumeration and reads outside the
selected entities. Across 100 unrelated ticks it observes exactly 600 selected
reads/tick, zero enumerations and zero extra schedules. The descriptive native
sample is p50 9.69 ms / p95 15.55 ms; no timing threshold or performance improvement
is claimed. The scheduler's current-authority read at the deadline remains active.

Four native safety scenes (`device-issues-{maintenance,alarm}-{plan,card}`)
were additionally captured on an isolated immutable accepted #997 source
`e5849080cc01e10349be1c5ec922f8bb4a428094` using its frozen production tree
(fingerprint `c0565792f0afbdb78700f5fa21f440fa463c2dc0e1a41e84b39d84c7585e19cc`).
Each candidate PNG is byte-for-byte identical to the corresponding accepted-source
capture; [native-neighbors.json](raw/native-neighbors.json) records the hashes.
The older global baselines already differ on that accepted source. This matched
comparison does not accept those baselines or claim their inherited difference
as a #1000 visual change. The declared task subset and native RGB/state-source/copy
smokes retain their ordinary checks.

## Cold boundary and earlier matched price

The [selected Linux run](raw/selected-browser.json) is GREEN: 5 required smokes
and all 20 declared Golden intents. Its ten new frames are in [golden/](golden/);
their frame hashes and source identity are in the selected report, except the
three forms refreshed on accepted #1015 after the canonical demo icon-map update:
[final-forms.json](raw/final-forms.json) records their replacement frame hashes.
The header/callout bell is now genuinely painted in those synthetic captures,
matching the native HA reference comparison. The generator added four current
references, removed five unreferenced entries and changed no existing icon paths.
These task
artifacts are separate from accepted global baselines. [Cold network evidence](raw/cold-view.json)
records the actual requested paths and six observations. The ordinary readonly
View requests no threshold runtime. Rule-enabled readonly/kiosk View adds two
feature chunks, 10535 raw / 4357 gzip bytes in total, without editor, settings
or onboarding graphs. Accepted #997's small common header select is allowed;
the actual header element is checked separately. Attribute-only HA updates reach
the accepted confirmed frame while the entity's state and saved config remain
unchanged. Static/unsupported input creates no cause, reattachment confirms
afresh and a removed rule does not resurrect.

[Recorded matched price](raw/matched-latest-price.json) uses then-accepted dev
`fd62d98eee72b4bdc14d36d80dade7bfe0f48afb`. Its frontend source equals accepted
#1015 `e2541d6c`; #1090 changes the backend only. The untouched frozen Linux base
has fingerprint `370afdc52956487de9842dedc19929acc25468c7e18b067f9107b04521f5afbd`;
the candidate has fingerprint
`96c4994776476422588abd65856ed2f0ece379c591b438752bd006d23d7f5b51`.
Both source fingerprints and complete asset topology/SHA checks pass. The earlier
[accepted #997 comparison](raw/matched997-price.json) remains as history.
These snapshots precede incoming #1087 and the later copy integration fix.

| Metric | Accepted base | Candidate | Own delta | Reference after task |
| --- | ---: | ---: | ---: | ---: |
| Initial View gzip | 349257 | 349791 | +534 | 348082 |
| Lazy editor gzip | 362610 | 370329 | +7719 | 368510 |
| Lazy onboarding gzip | 39950 | 40619 | +669 | 39412 (unchanged, within band) |
| All production assets raw | 3550038 | 3589301 | +39263 | 3589123 |
| Host references | 6359 | 6442 | +83 | 6441 |

Only measured task deltas raise references that need it. Inherited gaps stay
1709/1819/178/1 respectively, retaining #1015's 29-byte editor and 97-byte raw
savings inside the incoming gaps. Delegates, ports, private members and all other
references keep their incoming values. The editor cost is the new typed local
constructor, shared controls/styles and cause preview; it stays lazy. The
View producer/codec/clock/wording are an optional feature graph. This is a cost
record, not a performance improvement. This measures the actual accepted graph;
it makes no claim about unaccepted #1070/#1087 material. Whichever feature merges
next must measure its actual combined dev graph.

## Final material still to record

Full pinned Linux gate/pre-push receipts and final material SHA will be recorded
before S7. New scenes have explicit task ledger intents; source work does not
accept generated global baselines. The task will inherit the owner-approved
initial/core limits from actual #1070 S8 and retain the rolling bands.

## Functional integration with accepted #1087

The [separate narrow copy proof](raw/copy-ha-target/README.md) records the actual
helper and local synthetic HA WebSocket/Store/CAS results. A virtual copy clears
the source's HA-only dialog target; the source, threshold definitions and strict
backend guard are preserved. This correction is independent of the limit change
and makes no byte-saving claim.
