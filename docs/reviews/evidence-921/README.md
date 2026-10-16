# Author evidence for #921

Base: `1bdc5a1a0828bf7bc01b291136e4d3bd61a25b8e`. This is implementation
evidence, not an independent review or authority to publish a release.

## Observed failure and bounded repair

The original publisher's EPIPE is recorded in the issue's historical receipts.
Idle keepalive reuse after blocking catalogue reads remains a hypothesis.
An ordinary failing transport provider on the unchanged release gate reproduced
the observable failure: `readiness-before` exited 1 at `probeGreenWorkflow`
with `TypeError: fetch failed`, cause `write EPIPE`, before its available second
GET. No implementation replacement or mutant was executed.

The release gate now uses a bodyless-GET boundary, three total attempts at most,
100/400 ms pauses, only for EPIPE/ECONNRESET/UND_ERR_SOCKET. Candidate/proof
interpretation remains unchanged. No publication operation uses this wrapper.

## Executed witnesses and protective inputs

`node --test test/release-read-retry.test.mjs test/release-gate.test.mjs
test/ci-proof.test.mjs` — 42 passed, zero failed/skipped, 20:28:12–20:28:15 UTC,
receipt `artifacts/921/targeted-final.{log,json}`. This includes existing proof
and latest-compatible-run guards, not only retry tests.

| Contract | Positive execution | Ordinary rejecting input |
|---|---|---|
| Transient recovery | EPIPE then exact-SHA green; actual loopback server closes its first socket, second GET succeeds | Three consecutive socket failures throw the original last error, exactly three calls and pauses 100/400 |
| Admission unchanged | Exact-SHA readiness stays green after transport recovery | New red run stays failed; foreign SHA stays missing; absent proof stays missing after successful candidate/context reads |
| Narrow retry | All three known transport codes; candidate-tree and proof-context reads also recover | ENOTFOUND, invalid URL, AbortError, TimeoutError, aborted signal: one call; HTTP 401/403/429/500/503 and malformed JSON: no retry |
| No repeated writes | Loopback methods exactly GET/GET; workflow URL/token/headers identical between attempts | POST/PATCH/DELETE/body and POST Request are refused before the provider is invoked |

The loopback server is an ordinary input/service fixture with no public writes.
It proves recovery of a real UND_ERR_SOCKET, not the historical keepalive cause.
No release/tag/upload, HA state/configuration, budget, mutant run or model verdict
was produced by these checks. Full local gate results belong in the handoff.
