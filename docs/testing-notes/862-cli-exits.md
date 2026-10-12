# CLI output completion — #862

The eight affected entry points now set `process.exitCode` and return naturally.
Node drains pending writes; no flush timer or output schema change was added.
All eight use the same finite-report policy: `cli-output.mjs` latches write errors
on either channel and prevents Console's default ignoreErrors from claiming
success (POSIX EPIPE). Existing nonzero codes are retained; otherwise write failure
sets 1, including errors preceding async main completion. Importing these modules
as a library installs no listeners. This is not a guarantee for a reader that
never resumes reading.

| Entry point | Output / exit branches | Owned resources and cleanup | Witness |
|---|---|---|---|
| smoke-select | JSON/text stdout; usage stderr, 2; exceptions remain errors | sync file reads and completed spawnSync | large/small JSON, finite slow reader, EPIPE |
| process-gate | report stdout; failed git stderr, 2 | spawnSync completed; private GitCliFailure aborts main without another report | bad range, existing gate unit suite |
| model-invariants | JSON/report stdout, 0/1; usage stderr, 2 | sync filesystem only | usage, existing invariants suite |
| docs-accept | stdout acceptance; refusal stderr, 1/2 | awaited main; identical-image comparison closes browser, backup finally restored/removed | incompatible flags, existing acceptance suite |
| capture-determinism | stdout equal runs, 0; drift stderr, 1; child failure retains its code | completed synchronous child; attestation browser closed in finally; failure returns before hashes/next capture | missing browser CLI, first/second child failure unit |
| mutation-nightly-reuse | key=value stdout; diagnostics stderr, 0/2 | sync files only, no policy/registry change | usage, existing reuse suite |
| no-new-any | summary stdout, violations stderr, 0/1/2 | completed spawnSync and sync files | bad git ref, existing unit suite |
| no-new-private-writes | summary stdout, violations stderr, 0/1/2 | completed spawnSync and sync files | bad git ref, existing unit suite |

`node --test test/cli-stream-drain-862.test.mjs test/capture-determinism-gate.test.mjs`
executes real CLI entry points. Expected smoke-select bytes are independently
built with its exported selector, not copied from another CLI run. The reader
resumes after 750 ms regardless of child exit; exit and both stream EOFs are
observed independently. A bounded test deadline kills a deliberately leaking
child in a negative control. No test timeout truncates production output.

The original POSIX implementation failed the large-output witness with only
146176 bytes and reported success on a closed pipe. Native Windows can prove
ordinary/error formatting but does not replace this POSIX witness; its pipe-close
case is explicitly skipped because anonymous handle semantics differ.
