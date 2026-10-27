# Lightweight B preflight, before the final accepted #1070 integration

B material: `eeca80d16` on accepted base
`51fde59deaf24eebf823d9b5977edfea1315c38c`. Product A source tree remains
`52815d5c616d8837c2545ba105bf45cbed126098`; native HEAD and the pinned Linux
`c8d53565a` checkout have that exact same source tree. The latter's full test
compilation is recorded in the earlier copy/HA-target proof. Only the new B
presentation test was copied there for this focused execution.

- Linux Node22.23.2 `node --test test/marker-alert-presentation.test.mjs`:
  [4/4 PASS](presentation.txt). The added typed external cause is inert input to
  the real common presentation consumer; it proves shared identity/priority and
  no service/WS call or source mutation. No external producer was implemented.
- Native pinned Node22.23.4, each of the five #1000 IDs with
  `node scripts/mutation-gate.mjs --check --id=<ID>`:
  [static readiness PASS](static-witnesses.txt), execution0/caught unknown.
  Browser guard count539 exceeds the existing200 guideline and remains a warning;
  no guideline or guard was weakened.
- `node --test --test-name-pattern="#659/#699/#767" test/mutation-gate.test.mjs`:
  [browser inventory membership/count 1/1 PASS](browser-inventory.txt).
- `node --check demo/smoke_marker_alerts.mjs` and `git diff --check`: PASS.

The controls smoke now includes outer Save after removing the final rule and
checks absence of `alert_sources` in both the real outgoing payload and stored
marker. This new browser assertion has **not** run at this checkpoint. Browser,
HA, native paired replay, matched actual price and the ordinary full gate await
the final accepted #1070 joint source. No mutation was executed.
