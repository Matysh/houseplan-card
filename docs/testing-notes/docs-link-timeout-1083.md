# Documentation-link timeout investigation — #1083

The original four failures remain failures: docs run40213660423 attempts1/2
and tooling run40213660403 attempts1/2 on98baf6d77. Only the final8s timeout
message was retained, not client DNS/TCP/TLS/redirect spans.

Read-only Caddy access records in that window contain three matching-UA HEAD
requests to `/convert`, at2026-10-25T16:51:34.610655Z,
16:58:51.651565Z and16:58:56.868952Z. Their308 responses to `/convert/` took
1.49/0.281/0.228ms on the server, with no following request from those peers.
This does not prove that the client received the headers. Kernel records in
16:35–17:05UTC contain no matching-peer/443 UFW block. No server settings changed.

## Comparable Actions observation

Diagnostic material0a01c4c29, docs run40283073245/job121440469408 and tooling
run40283073242 passed. Source/checker HEAD, follow, UA and8s deadline were
unchanged. The converter trace was308→302→200 in1941.55ms, with request
IDs1/2/3 and three separate DNS/TCP/TLS setups. All17 links succeeded. These
are fresh observations, not a reconstruction of the old timeout's lower layer.

## Narrow mitigation and preserved checks

The English guide points directly to `/en/convert/`; the Russian guide uses
`/convert/`, retaining existing browser language negotiation. This removes the
unnecessary slash redirect and, for English, the language redirect as well.
Direct EN returned200 without redirects; RU with Accept-Language:ru returned
200 at `/convert/`. `/ru/convert/` returned404 and is not a valid replacement.

The real local HTTP fixture proves308→302→200 takes three HEAD requests and
the canonical target one. It checks unchanged UA, no credential/query/header
disclosure and request identity. A silent real peer still fails at the original
8s deadline. Ordinary404 and typed network/TLS-like error inputs retain their
status/error. Observer faults and clipped metadata do not alter the result.
`node --test test/doc-link-observation.test.mjs test/docs-freshness.test.mjs`
passed8/8. Final exact-material CI links belong to the issue handoff.

Witnesses `docs-link-deadline-extended-1083` and
`docs-link-observation-exposes-url-secrets-1083` are registered only. Static
readiness passed; no mutants executed during authoring.

The historical network-layer cause remains unknown. No HEAD defect, global
outage, firewall fault or causality from #1082 is claimed. The mitigation reduces
avoidable connection setup; the observer makes a future failure distinguishable.
