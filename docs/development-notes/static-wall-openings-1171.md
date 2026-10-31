# Static wall openings #1171 — executed evidence

Implementation: `26c78835fb1350d956a4fc80fafb87183cd5e983` and
`7dfb2d02466a8e93d6e3a65ae2cd1528def1edb3`, based on dev
`33707db7a8a9a6dc48d7445b3a0fb1fdf66e6e2e`. SPEC r2 is green, H0/M0.
The source plan is independently authored in
`demo/fixtures/static-wall-openings.mjs`; no private support geometry is used.

## Executed results

All browser evidence uses pinned WSL Ubuntu, Node22.23.2, Playwright1.62.0 and
Chromium151.0.7922.34 rev1234 (launched-browser attestation, not a directory guess).
Build and bundle-sync finished before the final captures. Headless evidence does
not claim a physical touch device, GPU or live Home Assistant installation.

- Accepted-code BEFORE (`96a4343b9`, before product edits): build/bundle-sync,
  then `node demo/smoke_static_wall_openings.mjs --before` → exit1 with four
  expected failures: visible completeness, full/Static symbol parity, masonry
  cuts and shared-window tunnel. Passage remains symbol-free. Full/Static PNGs
  were saved and inspected locally. The raw initial log survives in the tool
  transcript; it is not claimed as a retained repository artifact.
- An ordinary missing-contact input on `26c78835f` → exit1, exactly
  `missingContactHasFullPlanNeutralTone`. Shared projected-state availability
  fixes that mismatch without changing the full renderer's availability policy.
- `node demo/smoke_static_wall_openings.mjs` → exit0, 23 named assertions.
- Targeted `node --test` run → 124/124 PASS across static-wall-openings,
  space-render-caches, space-card-fit, opening-symbol-placement,
  partition-openings, room-opening-host, golden-matrix, source-fingerprint,
  wall-identity-corpus, space-geometry and open-passage-contract. The final
  product/tooling gate executes the required groups again on `7dfb2d024`.
- `npm run gate:small -- --base=origin/dev --smokes` on `7dfb2d024` → exit0,
  341s, failed0: build/typecheck, product/tooling units, budgets, CSS/unused,
  process-independent source guards and all24 required native smokes. The first
  gate's six stale derived-inventory failures were repaired; none was waived.
- `node scripts/model-invariants.mjs --config <public synthetic JSON> --json`
  → exit0, `violations:[]`, `notes:[]`.
- Corpus passport: all228 previous documents and existing inventory entries
  preserved exactly; one new synthetic fixture accepted and added.
- Mutation static readiness only: definitions/anchors/inventory checked. No
  mutation was executed; caught remains unknown until the nightly owner.

## AC and failure witnesses

| AC | Observed proof | Failure witness / negative input |
| --- | --- | --- |
| AC1 | Production full/space cards render each of five visible symbols once with equal transforms and shared symbol geometry; passage has no standalone symbol | Accepted BEFORE fails; `static-room-opening-symbols-omitted-1171` declared, not executed |
| AC2 | Actual point-in-masonry cut and solid controls, unequal-wall junction, shared/exterior/diagonal geometry, all flip pairs, tunnel fill and all supported neighboring types | Missing cuts/tunnel on BEFORE; invalid partition host is an ordinary pure negative input |
| AC3 | Closed/partial/open/unavailable/missing contact, invert, common leaf geometry/paint, stable viewBox and masonry; existing borders switch hides symbols together with architecture | Missing-contact ordinary RED; `static-opening-missing-contact-looks-active-1171` declared, not executed |
| AC4 | Measured content/house bounds360/780px, diagonal/quarter-turn, three actual Static Golden captures; two full-plan controls have0pixel difference | `static-frame-omits-opening-envelope-1171` declared, not executed |
| AC5 | Public config events move/resize/delete/recreate/rehost; setConfig and full navigation use equal IDs across spaces without node reuse; actual mouse/touch produce no service, popup or revision change | Same-config-object pure render changes actual masonry paths; `static-wall-cut-cache-ignores-opening-geometry-1171` declared, not executed |
| AC6 | Cache build/identity/namespace tests, repeated contact paths/frame unchanged, partition/legacy/passage neighbors and existing Static identity/config smoke | Ordinary absent-host negative; existing #764 identity definitions updated to the replacement list, not executed as mutants |
| AC7 | RU/EN guide/changelog, architecture/wall contract, release-ledger visual intents, derived source/CI inventories and E2E assessment | Normal gate, source provenance and independent CODE review own delivery; no manual S8 or baseline acceptance |

The shared projection replaces the partition-only symbol list, separately
materialized raw list and passage-only cut/tunnel reader. The obsolete
passage-only door-cut prohibition and its unit/mutation expectation are retired.
Current and legacy readers remain in the common projection; no compatibility
representation, saved host or ID is removed or migrated.

## Visual evidence

Final captures on `7dfb2d024` are recorded in the adjacent JSON receipt. Three
new Static scenes report `missing-baseline` with declared `expectation:new`;
they were visually inspected, including the360px leaf extent. Global baselines
are not accepted in this task. Both explicit unchanged full-plan checks report
`diff=0px ratio=0.000000 maxDelta=0`. These final five captures ran after the
gate's build completed; earlier diagnostic captures are not the final receipt.

## Post-task E2E

**Не надо**: no new HA transport, persistence, role or dashboard-mount contract.
The existing companion static-sync and dashboard journeys own those seams;
product native/pure/Golden tests own this geometry and paint correction.
Assessment published and read back at
[houseplan-e2e@0445c1c](https://github.com/Matysh/houseplan-e2e/blob/0445c1c570d055ef44a48b4ab5872cbf0d667195/task-impact/houseplan-card-1171.md).
That assessment covers the main implementation; the missing-contact follow-up
also changes only read-side paint. Functional E2E edits0; no live HA E2E PASS is
claimed. No beta, tag, frontend snapshot or release publication is part of #1171.
