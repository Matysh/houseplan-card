# Device threshold alarms — implementation evidence (#1000)

The accepted contract is issue #1000 SPEC r3, body digest
`88dc3d01d42b45c83ebb8029055c1d1509a2cf41e1e3c3fe425b1640a8f70d5d`.
This directory records task evidence, not global Golden baseline acceptance.

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

## Cold boundary and interim matched price

The [selected Linux run](raw/selected-browser.json) is GREEN: 5 required smokes
and all 20 declared Golden intents. Its ten new frames are in [golden/](golden/);
their frame hashes and source identity are in the selected report. These task
artifacts are separate from accepted global baselines. [Cold network evidence](raw/cold-view.json)
records the actual requested paths and six observations. The ordinary readonly
View requests no threshold runtime. Rule-enabled readonly/kiosk View adds two
feature chunks, 10535 raw / 4357 gzip bytes in total, without editor, settings
or onboarding graphs. Accepted #997's small common header select is allowed;
the actual header element is checked separately. Attribute-only HA updates reach
the accepted confirmed frame while the entity's state and saved config remain
unchanged. Static/unsupported input creates no cause, reattachment confirms
afresh and a removed rule does not resurrect.

[Matched price](raw/matched997-price.json) compares the frozen accepted #997
Linux tree with candidate fingerprint
`ee6347de0795348808df3725b46f38b569f0817de2c8718d6023faa25d37a758`:

| Metric | Accepted #997 | Candidate | Own delta | Reference after task |
| --- | ---: | ---: | ---: | ---: |
| Initial View gzip | 349257 | 349788 | +531 | 348079 |
| Lazy editor gzip | 362639 | 370352 | +7713 | 368504 |
| Lazy onboarding gzip | 39938 | 40611 | +673 | 39412 (unchanged, within band) |
| All production assets raw | 3550135 | 3589413 | +39278 | 3589138 |
| Host references | 6359 | 6442 | +83 | 6441 |

Only measured task deltas raise references that need it. Inherited gaps stay
1709/1848/275/1 respectively. Delegates, ports, private members and all other
references keep their incoming values. The editor cost is the new typed local
constructor, shared controls/styles and cause preview; it stays lazy. The
View producer/codec/clock/wording are an optional feature graph. This is a cost
record, not a performance improvement. It does not substitute for the final
combined/latest-dev measurement.

## Final material still to record

Final combined/latest-dev budget, full pinned Linux gate/pre-push receipts
and final material SHA will be recorded
before S7. New scenes have explicit task ledger intents; source work does not
accept generated global baselines or change the 352000-byte absolute wall or
2000-byte rolling bands.
