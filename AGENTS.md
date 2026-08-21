# AGENTS.md

House Plan is one HACS package with two parts plus a demo harness:

- **Lovelace card** (`src/`, TypeScript + Lit) — the primary product, bundled to `dist/houseplan-card.js`.
- **Storage integration** (`custom_components/houseplan/`, Python) — the Home Assistant backend.
- **Demo harness** (`demo/`) — a self-contained Playwright page (`demo/srv/demo.html`) that renders the card against a fake `hass`, used for screenshots and the `smoke_*.mjs` end-to-end suite.

## Read this first

**`docs/SCOPE.md` before anything else.** It was fixed with the owner and states
its own authority: features are built, improved and accepted **only** if they
serve a job listed there. It carries the mission, the three personas, the core
user jobs and the out-of-scope list.

Its central consequence: **View mode is the product for two of the three
personas.** Editors are admin-only tools and must never leak interactions into
View.

For work that changes visible behaviour, also read `docs/USER-GUIDE.ru.md` —
interface wording comes from there and is not invented, or the UI starts speaking
developer.

Then `PROCESS.md` (the full process), `docs/STATUS.md` (where the release line
is), and for non-trivial changes `docs/ARCHITECTURE.md` plus the canonical
document of the subsystem you touch: `SUN.md`, `LIGHT.md`, `CANVAS.md`,
`WALL-THICKNESS.md`, `UX-MODES.md`, `CONFIG-COMPATIBILITY.md`,
`TOUCH-SUPPORT.md`.

Standard commands live in `package.json` scripts, `CONTRIBUTING.md` and
`docs/DEVELOPMENT.md`.

## Canonical backlog and status

[GitHub Issues](https://github.com/Matysh/houseplan-card/issues) are the canonical
task records: problem, scope, acceptance criteria and discussion.

**Status lives in labels:** `S1-new`, `S2-analysis`, `S3-spec`, `S4-spec-review`,
`S5-ready`, `S6-in-progress`, `S7-code-review`, `S8-merged`, plus `blocked` on top
of a status and `rejected` on a closed issue. Exactly one `S*` label per open
issue. Labels are the whole of it: GitHub Projects is no longer used.

Two shortcuts exist for small work. `small` — the light track: the spec lives in
the issue body and its review is a comment. `trivial` — the short track: no spec
stage at all, `S2-analysis` straight to `S5-ready`, with the AC written into the
issue body first. `trivial` requires a bug confined to one surface with no new UX
contract, no migration, no i18n, no perf or touch impact, at most three checkable
AC, **and expected behaviour already on record** — nothing left to decide. Code
review is never skipped on either track; it is what stands in for testing.
`PROCESS.md` §5 and §5.1 hold the criteria.

An issue filed by an outsider is worked exactly like one of the owner's own, once
the owner has decided to take it. The check sits **at the entrance**, not on every
step: while an issue carries no status label it is outside the process and the
invariants do not apply to it; once a label is on, the task is in flight and **who
filed it stops mattering**.

Applying that first label *is* the owner's explicit decision, and the platform
already guarantees it — only someone with write access can label. The earlier rule
made outside reports be refiled as the owner's own issues, which turned out to be
work for nothing: on #123 the spec was already written by the time the guard
refused.

Specs, audits and ADRs may live under `docs/`, but must link to their issue and
must not become a parallel task list. When repository documentation disagrees with
Issues, the issue wins.

## Rule #1

> Changing product code without an issue is forbidden. Code changes only when the
> issue exists and sits in "Ready for development" or later.

Check before touching product code:

```
gh issue view <NN> --repo Matysh/houseplan-card --json number,state,labels
```

The label must be one of `S5-ready`, `S6-in-progress`, `S7-code-review`. Anything
else — refuse and say why. "Issue #83 is in `S2-analysis`, code is off limits.
Start with the spec?" is the correct answer, not a smaller patch.

## Change classes

| Class | Paths | Issue required |
|---|---|---|
| **A — product** | `src/**`, `custom_components/houseplan/**/*.py`, `manifest.json`, `hacs.json`, i18n, `custom_components/**/translations/**` | yes |
| **B — gates and tooling** | `test/**`, `tests_backend/**`, `demo/**`, `scripts/**`, `.github/workflows/**`, `rollup.config.mjs`, `tsconfig*.json` | yes; may reuse the issue it covers |
| **C — documentation** | `docs/**`, `README*`, `CHANGELOG*`, `AGENTS.md` | not if it is part of its issue's DoD |
| **D — generated** | `dist/**`, `custom_components/houseplan/frontend/**`, `demo/srv/assets/houseplan-card.js`, `demo/golden/baselines/**` | never changes on its own |

The table above is a summary; `PROCESS.md` §1 is the authority and now covers the
configuration files this one omits — `package.json`, `package-lock.json`,
`pytest.ini`, `.gitignore`, `.gitattributes`, `.githooks/**` and the rest of
`.github/**` are class B. Where paths overlap, **D beats A**: the built bundle
lives inside `custom_components/houseplan/frontend/` and would otherwise read as
product source.

## Commits

Hooks install themselves: `package.json` runs `"prepare": "node
scripts/install-hooks.mjs"`, so `npm ci` sets `core.hooksPath` in every fresh
clone. Verify with `git config core.hooksPath` — expect `.githooks`.

Every non-merge commit carries **terminal** trailers:

```text
Issue: #123
User-Visible: yes
```

One `Issue:` line per issue if a commit closes several. `User-Visible: no` for
tests, refactors, tooling and documentation that does not change the product.
`User-Visible: yes` requires edits to **both** changelogs — `docs/CHANGELOG.md`
and `docs/CHANGELOG.ru.md` — in the same commit.

A commit touching `demo/golden/baselines/**` additionally requires:

```text
Release: v1.62.0-beta.9
Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/<run-id>
```

Never invent a review link and never rewrite published history to satisfy
trailers. `.githooks/commit-msg` and the `provenance` CI job both run
`scripts/validate-commit-provenance.mjs`.

Branch: `issue/<NN>-slug`. Direct commits to `dev`, no PR — the owner's decision;
CI checks after the fact, and a violation is fixed with a follow-up commit, never
a force-push.

**Push after every task, not before a beta.** While work sits unpushed there is
nothing to review, and reviewing twenty tasks at once is not review. `dev` may hold
unreviewed code while a task is in flight; what matters is its state when the
reviewer says it is accepted.

**Standing permission: push `issue/<NN>-slug` without asking.** The reviewer runs
in CI and can only read what is on the remote — an unpushed spec or commit means
the review either stalls or judges the wrong tree. Pushing a task branch publishes
nothing to users and does not touch the integration branch, so it needs no command.

**Do not merge into `dev` by hand.** On a green code review the pipeline rebases
the task branch onto `dev`, pushes it, and only then sets `S8-merged` — the label
asserts the code is in `dev`, so the merge has to happen first or the label lies
in between.

If the rebase conflicts the pipeline says so in the issue and sends the task back
to `S6-in-progress`. The verdict still stands: nothing needs reviewing again, the
remaining work is the rebase. Resolve it, push the branch, re-apply
`S7-code-review`. The second review run is not a formality — after a rebase onto a
moved `dev` this is different code, and accepting it unchecked is how regressions
arrive. Cycles are counted per stage, so a code review spends its own budget.

Everything else still requires the owner's explicit command: pushing `main`,
creating tags, publishing betas and releases, closing issues.

## Working trees (#115)

One checkout, one `HEAD`: two agents sharing a directory inherit each other's
branch, and twice in one hour a commit landed on someone else's task branch that
way. The layout is therefore fixed:

- **`houseplan-card-src/houseplan-card`** — the author's tree. Task branches live
  here; nobody else commits in it. Unfamiliar local changes belong to the author
  or the owner — never reset or clean them away.
- **`houseplan-card-src/hp-dev`** — the owner's worktree, permanently on `dev`. For owner-side operations that must not disturb the
  author's tree: pushing `dev`, restoring a hook's executable bit, emergencies.
- **The reviewer and the infrastructure agent own no local tree.** The reviewer
  runs in CI on a fresh checkout. The infrastructure agent reads via `git show`
  and publishes through the GitHub API; it makes no local commits at all, so it
  needs no `HEAD` of its own. Its scratch worktrees live outside the repo and are
  pruned after use.

A worktree is only usable on the machine that created it: the `.git` file records
an absolute path in that machine's format. One created from a Linux sandbox is
dead on Windows and vice versa — create worktrees on the machine that will use
them, which for `hp-dev` means the owner's.

## Two-agent workflow

**Codex** writes analysis, specs and all product code. **Claude** reviews specs and
code and owns infrastructure and distribution. The owner rules on disputes, closes
issues and commands releases.

Author and reviewer are different models, which is what "a fresh session without
implementation context" means in practice. The reviewer never edits product code;
the author never grades their own work.

**Infrastructure-only work runs outside this flow.** CI, scripts, labels, demo
stands, the landing page and distribution are Claude's alone, and running them
through spec-writing and review buys nothing: the spec would restate what is
already unambiguous, and author and reviewer would be the same role. So no spec
file, no spec review, no code review, no walk through `S1`…`S8`.

The test for "infrastructure only" is mechanical: **not a single class A file** —
nothing under `src/**`, no `custom_components/**/*.py`, no manifests, no i18n. A
task that touches class A even once is not infrastructure and takes the full flow;
there is no such thing as "mostly infrastructure". The strictness is deliberate:
a loose reading would turn this into the route by which product changes skip
review.

What stays mandatory either way: an issue exists, both trailers are on every
commit, `typecheck`, `test` and `build` are green, and any non-obvious decision is
written down in the code or the issue rather than kept in someone's head.

**Review starts by itself.** Applying `S4-spec-review` or `S7-code-review` fires the
pipeline, which reviews without anyone asking and takes ten to forty-five minutes.

**Having applied one of those labels, wait for the result instead of ending the
session.** Reporting "handed over for review" stops a conveyor that could have kept
moving on its own. An agent has no clock — it exists only during its own turn — so
waiting means polling: every 90 seconds, at most 30 times. A single long sleep hits
the command timeout. Watch the **label**, not the comment: the label is the state,
the comment only explains it. Do not wait at all while `blocked` is set — the task
is waiting on the owner, not on the reviewer. On exhausting the attempts, stop and
tell the owner: a failed run leaves the label where it was, forever.

What the new label means:

| Now reads | What happened | What you do |
|---|---|---|
| `S5-ready` | the spec is accepted | write the code |
| `S3-spec` | the spec came back | read the verdict, revise, re-apply `S4-spec-review` |
| `S6-in-progress` | the code came back | revise, re-apply `S7-code-review` — **or**, if the verdict was green and only the merge conflicted, just rebase and re-apply. The comment says which |
| `S8-merged` | accepted and already in `dev` | nothing |
| `review-4` | the cycle limit is spent | stop, the owner decides |

**After a review run the label always changes.** If it did not, the run itself
failed rather than the work — say so to the owner instead of polling on.

**A failed pre-release gate does not send the issue back to review.** The
implementation loop runs only typecheck, unit and build; golden, browser smokes,
performance and the full HA harness run before a beta, which is after the code
review has passed and the issue sits in `S8-merged`. Some defects cannot surface
any earlier.

Fix it, re-run what failed, and a green run is enough for the release to continue.
The issue stays in `S8-merged`. Record the **exact command and its result** in the
issue — "verified" without a command proves nothing. Trailers as usual, and
`User-Visible: yes` still means both changelogs in the same commit.

The exception covers repairing the defect the gate named, not carrying on
development under the name of a repair. It goes through the normal flow — a new
issue, or back to `S6-in-progress` — if the fix changes a behaviour contract, gives
the user something new, reaches a subsystem the task never touched, or is
comparable in size to the task itself. And editing the gate so it stops failing is
concealment, not repair; the exception is a defect proven to be **in the fixture**,
as on #89, where the sun sat at azimuth 180° and the only window faced north, so no
ray was ever built.

Baselines are still accepted only via `npm run golden:accept -- --reviewed` on a
complete Linux CI artefact. "So the gate goes green" is not a reason.

The exchange happens in **issue comments** — there is no local message bus. Verdict
format:

```text
Verdict: green/yellow/red · cycle r<N>/4 · High: N · Medium: N → in-task | #… · Document: …
```

High blocks. A Medium finding INSIDE the task's scope is fixed within the task:
with no High findings the verdict is yellow, the author fixes it and the fix
passes another review cycle — no separate issue (owner's decision 2026-08-19,
#202: filing and servicing an issue costs far more than fixing in place). Only
a Medium finding OUTSIDE the scope becomes its own issue — foreign scope is
never patched from this branch. Low is fixed or waived with a note
in the review document. A yellow verdict is legitimate even when every acceptance
criterion passes, if the change does not solve the stated scenario or degrades a
neighbouring one.

**Four review cycles** (two on the light track). The counter lives in the document
name, `-r1`…`-r4`; the fourth adds the `review-4` label. There is no fifth attempt:
the owner splits the task, rejects it, or arbitrates.

On the light track (`small`: complexity ≤3, one surface, no config migration, no
new UX contract, no perf or touch impact — all at once) the spec lives in the issue
body and the spec review is a comment. Code review is never skipped.

## Specs

`docs/specs/<NN>-<slug>.md`, linked to its issue in both directions. Required
sections are in `PROCESS.md` §7.1, plus two product ones: which persona meets this,
on which surface, at what moment; and what the person sees before and after, in one
sentence without implementation terms.

**Ambiguity is asked, not guessed — but only product ambiguity.** A guess written as
fact is the worst kind of defect: it passes review because it looks like a decision.

The owner answers exactly two kinds of question: **what a person sees or does**, and
**how much user-visible change belongs in this issue**. Behaviour in a boundary case,
which persona wins when two conflict, what counts as acceptable degradation, whether
a neighbouring behaviour is in scope here or becomes its own issue.

Everything a user cannot observe is yours to settle: where state is stored, which
module carries the guard, naming, file layout, test strategy, migration mechanics,
development policy. Decide it, record it in an explicit "assumed, change freely"
block, and let the reviewer challenge it. A technical disagreement between author and
reviewer is settled by the verdict, not by the owner; it reaches him only when the
cycle limit is exhausted.

Split a mixed question instead of escalating all of it. "Where does this state live"
is technical. "Does it survive a page reload and follow the plan across screens" is
product. Ask the second, decide the first.

Ask in one batched issue comment, each question carrying a proposed default, and put
`blocked` on top of `S3-spec` while waiting. A question with a default costs the
owner seconds; one without costs him minutes.

## Gates

```
npm run typecheck
npm test
npm run build
npm run inventory        # the only correct way to get test counts
```

Never copy test counts into documents by hand; they go stale in days.

After building, keep all three bundle snapshots in sync — CI compares them
byte-for-byte:

```
cp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js
cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js
```

During the implementation cycle the fast gates always run. Since 2026-08-14 the
owner's machine also carries Playwright with Chromium (Windows) and a full WSL
environment, which changes one thing (#151): **before moving an issue to
`S7-code-review`, run the smokes named in its AC locally** — `node
demo/smoke_<name>.mjs`. A red smoke that reaches the review costs a cycle; run
locally it costs a minute. Precedent: on #89 a fixture error lived through a
whole review round that a local run would have caught immediately.

The full smoke set, `golden` and `performance_smoke` still belong to the
pre-beta run — which is then mandatory and complete. WSL runs of the full HA
harness (`~/houseplan-card`, venv) and `golden:verify` are advisory; **the canon
does not move**: the beta gate is CI at the exact SHA, and baselines are accepted
only via `npm run golden:accept -- --reviewed` on a complete Linux CI artefact.

**Backend.** A full Home Assistant harness cannot run on native Windows at all:
Home Assistant imports the Unix-only `fcntl` module. Its canon is Linux CI or WSL.
Locally only the pure subset runs; `python -m pytest tests_backend/ -q` without
Home Assistant **silently skips** `test_ha_*.py` (`conftest.py` ignores them when
`homeassistant` is not importable), so a green result proves nothing. Say so in the
report instead of claiming the backend was verified. Cloud agents have the harness
at `.venv-backend/bin/python`.

**Running the app / smoke suite**: build a fresh bundle and copy it into the demo
assets first, then run `node demo/smoke_*.mjs`. No real Home Assistant server is
required: `demo/srv/demo.html` stubs `hass`, registries and `callService`.

**Golden images**: `npm run golden:capture` and `npm run golden:verify` refuse a
stale demo bundle. Build and copy first, then review `artifacts/golden/actual/` and
`diff/`. Update baselines only with `npm run golden:accept -- --reviewed`, using the
complete Linux CI artifact; never accept a partial scenario or images merely to make
CI green. See `demo/golden/README.md`.

**Freshness contract**: the embedded fingerprint covers `src/` plus Rollup,
TypeScript and package-lock build inputs. Every browser check must verify it
before trusting a result — benchmarks, golden runs and documentation captures
call `assertFreshDemoBundle` themselves, and smokes get it from `launch()` in
`demo/serve.mjs` (#236). A missing or mismatched fingerprint is a hard failure,
not a warning; `HP_ALLOW_STALE_BUNDLE=1` skips the check for debugging and says
so out loud. A smoke against a stale bundle does not fail cleanly: part of its
assertions go red and part stay green, which reads as a logic defect.

**CI is pinned to an exact SHA.** The release gate accepts only a `completed
success` run for the candidate's SHA, not "the last green one"; a new push cancels
an unfinished Validate for the same branch. Gate jobs, matching the actual
`validate.yml` (#191): `docs`, `provenance`, `process-gate`, `hacs`, `hassfest`,
`frontend`, `smoke`, `golden`, `performance_smoke`, `backend`. The `changes` job
is a service path-filter, not a gate. `docs` is a real blocker: it checks the
screenshots `sourceFingerprint` against current `src/**`, which is exactly what
went red after the #113 merge.

**"Verified" without a named command and its result is not evidence.**

## Environments

**Local Windows checkout** is the day-to-day environment: Node 22 as in CI, Python
3.13 in a venv, `gh` authenticated. `.venv-backend` does **not** exist there — it is
provisioned only by cloud agent startup scripts, which also run `npm ci` and install
Playwright Chromium.

Known environment-sensitive smoke: `demo/smoke_opening_measure.mjs` fails two
sub-checks (`place_dialog_x_magnetised`, `place_committed_x_center`) under the pinned
Chromium — a `1e-6`-tolerance magnet-snap on the opening-*placement* path. It
reproduces against the pristine committed bundle, so treat it as
pre-existing/pixel-precision, not a regression you introduced.

## Labs flags

`src/labs.ts` is the single registry and resolver for hidden presentation
experiments. Activate a live flag through `?hp-labs=<id>` or the shared hash
grammar, remove it with `-<id>`, and use `off` to clear the set. Do not add a
YAML/config switch for a Labs-only experiment. A new entry needs a unique
lowercase id, issue, numeric-core `since`, numeric-core `expires`, summary and
unit/browser coverage. Invalid or duplicate registry entries fail closed.

Expiry is exclusive and ignores prerelease suffixes: an entry expiring at
`1.65.0` is unavailable in `1.65.0-beta.1`. Before that cycle, either remove the
experiment or graduate it through its own reviewed issue; never extend expiry as
an incidental change. Labs may alter presentation only and must not gate data,
migrations, stores, HA actions or network calls. Current renderer details are in
`docs/ISOMETRIC.md`.

Demo harness render quirk: the fake `hass` in `demo.html` is set once, so opening the
page directly in a browser renders the floor plan but **device icons only appear
after a re-render** (an F5 refresh, or nudging `card.hass = {...card.hass}`). The
smoke launcher `demo/serve.mjs` already does this nudge; a plain browser session does
not. This is a harness limitation, not a card bug.

## Promotion rule

Every new feature or material behaviour change must be published as a beta/RC
before it can enter a stable release, even when its local audit is clean. The
stable release commit is promotion-only: version fields, generated bundle
snapshots and changelog/release metadata. Do not add feature source code in
that commit. An explicit owner-requested emergency hotfix is the only exception
and must be called out in the release handoff.

A `Release vX.Y.Z-beta.N candidate` commit is **not** promotion-only: it carries
the work itself and follows the ordinary rules, trailers included.

Issues are closed in a batch when a beta ships, not when implementation ends: that
way a bug found in the beta returns to the same task, and the beta announcement can
list what went in. Status labels are stripped as the issues close.
