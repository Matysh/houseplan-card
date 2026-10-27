# Final combined #1000 evidence on accepted #1070

Accepted base: `455535be9da51e0eef11ceccd1b9545a39875425`, actual #1070 S8.
Task source after rebase: `d345c1b47ebc83ff9adbff63a2cab8ff2811a56d`.
Production fingerprint: `06fc68c0edb07b8500a62236ea75611718d018e85162ed4d6a376735ed3f9dad`.
The following rolling-reference/documentation commits do not change this source.
All incoming scenes and translations are retained; the combined matrix is102.
This is executed task evidence, not a global baseline acceptance or CODE verdict.

## Executed checks

- Linux pinned Node22.23.2 `npm run build`: PASS. The exact built tree was
  copied to the native offline HA lab; no native rebuild is claimed.
- `node scripts/browser-selected.mjs` with the task ledger's five smoke IDs
  and twenty Golden intents: **5/5 smokes and20/20 Golden PASS**. The runner
  preserves semantic assertions and allows only the declared new/changed pixel
  frames. [Report](raw/browser.json), [log](raw/browser.txt), [frames](golden/).
  All20 retained frames were visually inspected. Their SHA-256 values match
  the report. No global baseline was changed.
- The controls smoke includes final-rule deletion followed by the real outer
  Save: the outgoing request and stored marker both omit `alert_sources`.
- `python -m pytest tests_backend/test_marker_alerts.py
  tests_backend/test_ha_marker_alerts.py tests_backend/test_ha_import_export.py
  tests_backend/test_ha_backup_archive.py -q`: **347 passed in12.58s** using the
  pinned Home Assistant harness. [Log](raw/backend.txt). This is synthetic
  authenticated WebSocket/Store testing, not a production HA installation.
- Immutable approved9db1e66f UI replay: native HA20260930.4, pinned Chromium,
  light/dark ×1440/390. All four table comparisons have **0 differing pixels**;
  common constructor metrics match and no overflow/page/external-request errors
  occur. [Raw comparison](raw/native-paired.json), [constructors](screenshots/).
  The approved level selector and three-second wording are present; the old
  prototype's room/summary counters remain excluded by the owner's decision.
- Cold readonly/kiosk View uses no editor/settings/onboarding graph or HA
  writes; ordinary View makes no threshold request. Attribute-only updates,
  static/unsupported input, retirement and reattachment pass on the final
  source. [Actual requested paths and observations](raw/cold-view.json).
- All five task witnesses pass `mutation-gate --check --id=<id>` after the
  final rebase. [Static log](raw/static-witnesses.txt). Browser inventory546;
  execution0 and caught unknown. No mutant was executed.

The first selected launch used a stale demo mirror and failed freshness before
its assertions. That local setup failure is retained under the execution tree's
`output/1000-before-demo-sync*`. `node scripts/bundle-sync.mjs` synchronized the
already-built tree, `bundle-policy --clean` retained the committed frontend
snapshot, and the unchanged selected plan then passed in full. This was not a
product fix or a review failure.

## Actual matched cost

The accepted #1070 frozen tree has fingerprint
`658770cde5b5baf862438f3e39ce7e2e5bb19ce58f7c168dcbb528c4700f5ef9`.
Its exact accepted-source receipt, both source fingerprints, complete bundle
topology and every asset SHA were verified before comparison. No baseline
rebuild or sum of hypothetical task deltas is used.
[Machine record](raw/matched-price.json).

| Metric | Accepted base | Candidate | Own delta | Carried reference |
| --- | ---: | ---: | ---: | ---: |
| Initial View gzip |351632|352159|527|352447|
| Lazy editor gzip |364380|371955|7575|371975|
| Onboarding gzip |40339|40912|573|39412, unchanged within band|
| All production assets raw |3571911|3611204|39293|3613462|
| Host references |6380|6463|83|6441|

Inherited gaps are retained, including accepted savings. Other monolith
references and all2000-byte bands are unchanged. The absolute initial387200
and core14660+50 limits are inherited from the owner-approved #1070; this task
does not increase them again. This records a feature cost, not acceleration.

The full ordinary pre-push gate and subsequent CI/CODE results are recorded in
the final issue handoff after execution. No result is inferred here in advance.
