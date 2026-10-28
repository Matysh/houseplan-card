# Continuation discovery read witness (#1116)

Accepted baseline: dev 502247fa09d848683261e61ae6cde5b7358c9839.
Candidate: current task source; the unchanged baseline CLI was invoked from an
immutable accepted checkout, never patched. The HTTP fixtures are ordinary
loopback GET responses. No public API, model, Git/label/write command or mutant
execution participated. Current gh 2.101.0, Node 22.23.2, Linux/WSL. The historical
job used Node 22.23.4; no exact historical gh version/status/endpoint is claimed.

| Ordinary HTTP input | Unchanged accepted CLI | Candidate CLI |
|---|---|---|
| event GET HTTP 500 with malformed error JSON | exit 1, exact lowercase `unexpected end of JSON input`, generic discovery error, artifact absent | exit 1, artifact `event-run`, exact relative endpoint, `http-500`, authority=false |
| valid event then artifact-list HTTP 502 with empty error body | exit 1, same lowercase Go error, artifact absent | exit 1, artifact `artifact-list`, relative endpoint, `http-502`, authority=false |
| event response interrupted after a partial declared-length body, then valid retry and empty artifact list | exit 1 `unexpected EOF`, 1 GET, artifact absent |2 event GETs + 1 artifact GET, complete authenticated metadata read, honest empty outcomes, exit 0 |

Both old and new sources receive the same ordinary input per case; fail-closed
HTTP refusal is preserved, and only socket transport can recover. The new CLI
unit also supplies malformed HTTP 200 JSON and proves exit 1 plus a named
artifact before any gh/git/dispatch command. The tests reject an attempt to
substitute an empty/malformed artifact list for successful discovery.

Historical observation: job 122872614664 / run 40704378338 logged the lowercase Go
error before the generic catch and before the upload directory existed. Only
the initial event-run/global artifact-list reads precede that catch boundary.
The existing log cannot identify which one or which HTTP status failed. Do not
retroactively assign the loopback fixture as that unknown historical cause.
