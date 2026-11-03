# Stable test repair #1226

All 796 original unsuccessful entries from [audit41598951489](https://github.com/Matysh/houseplan-card/actions/runs/41598951489) have an individually preserved classification and addressed evidence. This task repairs obsolete tests and runner accounting; it does not claim a green stable release or fix all newly diagnosed product behavior.

| Original population | Latest addressed classification |
|---|---|
| 230 Node failures |209 fixed;21 classified retained RED|
| 177 backend failures |177 addressed|
| 122 browser failures/timeouts |95 complete successes;27 classified retained RED|
| 267 golden failures/differences |all nine missing captures repaired; no baseline accepted|

See node-classification.json, backend-classification.json, browser-all-classification.json and golden-classification.json for exact original names, failure history, source pins and evidence. Later local and common-run outcomes are separate; overlapping selections are never summed into a fictitious total. Remaining confirmed and unresolved behavior is recorded in [resume-findings.md](resume-findings.md). No new issues are created under the owner's file-only instruction.

## Actual common stable profile

[41679296259](https://github.com/Matysh/houseplan-card/actions/runs/41679296259) ran on product material1f3a0f343f881ef59446c664baace3df8e72a635 and companion827fb417858e10e2362092e26960f7c8ae4c5ac0. Product geometry/backend source is accepted dev0c030e700; subsequent fixture-only ports have their own addressed proof and are not attributed to the earlier audit SHA.

-539 plan steps:504 passed,33 failed,two not-required,zero blocked;74m13.695s,zero reused.
-Node4427:4405 passed,21 failed,one skipped across11 groups.
-Backend2907:2906 passed,zero failed,one skipped. Coverage90.5% versus87.2%;threshold PASS.
-Real HA77/77 business and10/10 setup PASS;zero skipped/unexecuted. Preparation/accounting and companion changes are completed separately in #1225.
-Browser512 with30 failures. Golden326 actual images:59 passed,267 unapproved differences,zero capture errors. Measurements pass.

These immutable receipts are diagnostic RED, not a release certificate. Three real CI measurement/performance failures remain visible despite earlier local successes: daycycle paired-measurement validity, history0 long-task203ms against200ms, and connected-node #834 threshold. No thresholds were raised and no rerun was used to relabel them noise.

[Reuse diagnosis](reuse-scope-diagnosis.json) shows identical environment keys and expected conservative dependency closures: a demo script edit invalidates512 browser steps plus golden/metrics/assets, and a fixture edit invalidates all11 Node groups. Build/ZIP outputs are deliberately not restored. No cache mechanism was changed.

## Final addressed ports after the shared audit

-[Browser fixture ports](ac1-two-fixture-ports.md): wall thickness36/36 PASS through actual graph intents/accepted static graph; Unified Walls17/18 PASS with full semantic rollback/history/session guarantees, retaining foreign-overlap RED.
-[Node ports](node-author-leftovers.md): independently derived complete #281 current target PASS; #273 expected table order follows the canonical contract while its original count failure remains RED. Actual arrays and ordered room cycles are never sorted to force success.
-[Cold setup ports](final-two-setup-ports.md): Zigbee native settings readiness44/44 PASS; converter cold-panel lifecycle6/6 PASS. Converter is outside the original122 browser failures and does not inflate their success denominator.
-[Current corpus oracle](current-corpus-oracle-proof.md): all573 full inputs from91 files preserved, including every original229 full input. Independent exact source/owner/host/width/opaque-field evidence supports the571 accepted full-config hashes. Separate frozen229 oracle/archive stay byte-identical. #842 damaged input has a justified typed refusal; valid #478 remains positive in the current oracle and its actual refusal remains RED.

Final integrated comparator check on author a192a5783: six tests in4.08s, five PASS and one expected current-migration FAIL (#478),zero skipped. All573 source immutability,571 byte-idempotence/re-read,230 atom-ID multisets,230 complete room-ID multisets and473 ordered room cycles execute before the aggregate comparison with zero invariant failures. Full-config hashing ignores only object key insertion order; negative controls detect opaque loss, array reordering, numeric changes, identity changes and incomplete inventory. No full product suite/build/HA was repeated for this final comparator port.

The existing runner's pytest parser now counts the final complete summary including failures/errors. Its22 addressed behavior tests pass; the five new regression cases produced four failures against the old parser. TAP precedence, nonzero exits and nonempty-result protection remain intact.

## Evidence and boundaries

[Corpus preservation](corpus-preservation.md), [resumed controls](resumed-controls.md), [UI follow-up](ui-five-followup.md), [title contract](header-title-contract.md), [source-ledger proof](current-corpus-oracle-proof.md) and per-case JSON retain source provenance. The full profile was downloaded once under output/issue1225-audit-41679296259. Earlier diagnostic runs41632300999,41646456489 and41662157218 remain historical receipts, not final-current claims.

No product fix, new workflow, waiver, accepted visual baseline or release is introduced. AC1–AC3 are submitted for ordinary independent review with explicit remaining RED; unchanged unapproved goldens and classified real/unresolved behavior are not silently accepted or converted into an invented all-green task gate.

## Official review correction M1

[Review41705603244](https://github.com/Matysh/houseplan-card/actions/runs/41705603244) correctly identified one falsely accepted refusal. The original Optimize ambiguous-partitions test again requires successful preservation of both original partition IDs/cm and the opening host, including model11 identity and source immutability. The actual thickness-conflict stays RED, as in #478. The original230-row population remains unchanged; latest209fixed/21retainedRED corrects the earlier210/20classification. See [response](review-m1-response.md). No full audit/build/HA is repeated for this positive-oracle correction.
