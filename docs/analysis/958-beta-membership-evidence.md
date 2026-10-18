# #958 — beta membership across a merge's second parent

Infrastructure B/C only. On unchanged accepted dev
`510bab19d90aa45b5b254cc12df16beafd71b77b`, ordinary membership creation for
#931 refused despite the implementation being reachable through #947's second
parent. The added real-Git scenario reproduced the original reader's loss:
`own second-parent delivery is reachable`, expected true, observed false.
See [original output](958-ordinary-original-red.txt).

The reader changes only `git log --first-parent` to `--topo-order` for the
already pinned previous-release..candidate range. Previous tag selection remains
first-parent. Shared delivery classification, schema, public asset checks and
publication permissions are unchanged.

`node --test test/task-delivery-903.test.mjs test/release-membership.test.mjs
test/release-ledger.test.mjs` — 32 PASS, 0 fail. The extended existing merge
scenario checks its own second-parent issue/SHA, foreign merge attribution,
an unmerged branch, pre-base delivery, a side-branch beta tag, SPEC-only and
Release-only exclusions, forged evidence refusal, unchanged worktree and
immutable verification after HEAD moves. Other existing negative contracts
remain green. No mutation execution or temporary product replacement occurred.

On the same accepted dev510 candidate, the fixed reader creates and verifies
#931 with its own eleven delivery SHAs and excludes the #947 merge SHA:
[actual output](958-real-931-green.json).

The existing #957 object-retention problem remains open. Original historical
materials are retained by `review-material/931-spec-r3` and
`review-material/946-spec-r3-original`; no document anchor, trusted validator or
public history was rewritten to make absent material pass.
