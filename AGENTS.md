# AGENTS.md

House Plan is one HACS package with two parts plus a demo harness:

- **Lovelace card** (`src/`, TypeScript + Lit) — the primary product, bundled to
  the entry, manifest and hashed chunks under `dist/`.
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
of a status and `rejected` on a closed issue. A product issue in flight carries
exactly one `S*` label. An infrastructure-only issue is the deliberate exception:
it may carry no `S*` label while being implemented, enters the common flow at
`S7-code-review`, and from then on carries exactly one. Labels are the whole of
it: GitHub Projects is no longer used.

**The light track is the default, not a shortcut** (owner's decision 2026-08-27,
issue #338). `small` — the spec lives in the issue body and its review is a
comment. Analysis names the `small` criterion the task *fails* when it takes the
full track; "ordinary track" without a named criterion is not a justification.
The threshold itself did not move — only which side carries the proof. The full
track stays what it was for geometry, config migrations and public contracts,
where a criterion is broken plainly and saying which one is easy.

`trivial` — the short track: no spec stage at all, `S2-analysis` straight to
`S5-ready`, with the AC written into the issue body first. `trivial` requires a bug confined to one surface with no new UX
contract, no migration, no i18n, no perf or touch impact, at most three checkable
AC, **and expected behaviour already on record** — nothing left to decide. Code
review is never skipped on either track; it is what stands in for testing.
`PROCESS.md` §5 and §5.1 hold the criteria.

An issue filed by an outsider is worked exactly like one of the owner's own, once
the owner has decided to take it. For product work the check sits **at the
entrance**, not on every step: the first status label admits it to the flow. For
infrastructure work an explicit assignment by the owner is the entrance, and the
issue may remain without an `S*` label until its first `S7-code-review`. In either
case, **who filed it stops mattering** once the owner has admitted it.

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
| **D — generated** | `dist/**`, `custom_components/houseplan/frontend/**`, `demo/golden/baselines/**` | never changes on its own. The stand copy `demo/srv/assets/**` is no longer committed (#255): build the complete tree with `npm run bundle:sync` |

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
remaining work is the rebase. When the conflict is only in the committed bundle
(`dist/**`, `custom_components/houseplan/frontend/**` — the usual case when two
tasks built it in parallel), run `node scripts/rebase-on-dev.mjs` (#479): it takes
`dev`'s copy through the rebase, rebuilds with `npm run bundle:sync` and amends
the result into your last commit; a conflict anywhere else aborts and leaves the
tree as it was. Then push the branch and re-apply `S7-code-review`. When the
only difference from the reviewed material is the pipeline's own review-document
commit, the next run re-applies the green verdict without calling the model
(#499); any other change to the tree — a rebase included — gets a full review.

The pipeline is an idempotent controller (#499): only `S4-spec-review` and
`S7-code-review` start it, it reads the issue's *current* labels rather than the
event snapshot, and a label removed before the run starts is treated as a
withdrawn request. Push the material **before** applying the label — the reviewer
is pinned to the SHA the pipeline captured and must not fetch newer commits. The second review run is not a formality — after a rebase onto a
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
- **The reviewer owns no author tree.** It runs in CI on a fresh checkout. The
  agent implementing an infrastructure task is an ordinary task author and uses
  the same author-tree rules as product work; task branches must not share a
  mutable checkout concurrently.

A worktree is only usable on the machine that created it: the `.git` file records
an absolute path in that machine's format. One created from a Linux sandbox is
dead on Windows and vice versa — create worktrees on the machine that will use
them, which for `hp-dev` means the owner's.

## Agent-neutral workflow

No task type is reserved for Codex, Claude or any other named model. **Any agent
may take any task**: analysis, spec, product implementation, infrastructure or a
release explicitly commanded by the owner. Roles describe the current artifact,
not the agent brand. The owner rules on product disputes, closes issues and
commands releases.

Author and reviewer are independent agents/sessions. They need not use different
model families, but the reviewer must start without implementation context and
must not be the author grading their own work. The reviewer does not edit the
material under review.

**Infrastructure-only work uses an accelerated entry into the common flow.** It
is implemented immediately by any agent, without analysis, spec, spec review or
the statuses `S1`…`S6`. Once the branch is ready and pushed, apply
`S7-code-review`. From there the ordinary controller applies: green review rebases
and merges the checked material into `dev` and then sets `S8-merged`; findings or
a failed merge return the issue to `S6-in-progress`, and after correction it is
submitted to `S7-code-review` again.

The test for "infrastructure only" is mechanical: **not a single class A file** —
nothing under `src/**`, no `custom_components/**/*.py`, no manifests, no i18n. A
task that touches class A even once is not infrastructure and takes the full flow;
there is no such thing as "mostly infrastructure". The strictness is deliberate:
a loose reading would turn this into the route by which product changes skip
review.

What stays mandatory either way: an issue exists, both trailers are on every
commit, proportionate local gates are green (normally `typecheck`, `test` and
`build`), and any non-obvious decision is written down in the code or the issue
rather than kept in someone's head. Infrastructure work skips specification, not
code review.

**Review starts by itself.** Applying `S4-spec-review` or `S7-code-review` fires the
pipeline, which reviews without anyone asking and takes ten to forty-five minutes.

**Having applied one of those labels, wait for the result instead of ending the
session.** Reporting "handed over for review" stops a conveyor that could have kept
moving on its own. An agent has no clock — it exists only during its own turn — so
waiting means polling: every 90 seconds, at most 30 times. A single long sleep hits
the command timeout. Do the polling with `node scripts/wait-verdict.mjs --issue NN
[--sha <tip>]` (#496): it watches the label, the pipeline's own comments (conflict,
cancelled merge, failed run) and optionally Validate on the SHA, prints only when
the state changes and exits 0 on a new label, 3 on an event that needs a hand,
4 on timeout — the same 90 s × 30 without a model turn per tick. It writes
nothing. Watch the **label**, not the comment: the label is the state,
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
body and the spec review is a comment. Code review is never skipped. This track is
the default: taking the full one means naming the criterion above that the task
does not meet.

## Specs

The spec lives in the **issue body**, under a `## ТЗ` heading (owner decision
2026-09-10, #517); `docs/specs/` is an archive of specs written before that date
and takes no new files. Required sections are in `PROCESS.md` §7.1, plus two
product ones: which persona meets this, on which surface, at what moment; and what
the person sees before and after, in one sentence without implementation terms.
Proof that a verdict was passed on a given text is the pipeline's job: it writes
the `sha256` of the normalised body into the review document's anchor block, and
an edit made after a green spec review reaches the code reviewer as a finding.

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

After building, keep the complete manifest-driven bundle trees in sync — CI
verifies every listed file byte-for-byte:

```
npm run bundle:sync   # dist → custom_components + demo/srv/assets (#255)
npm run bundle:budget # initial View graph <= 256000 B gzip (#337)
```

`npm run gate:small` runs the mandatory part of PROCESS §8 in one go (#479):
unit tests, build with typecheck, `no-new-any` and `smoke-select` in parallel,
then the bundle-tree comparison and the bundle budget. It prints the smokes the
diff selects but does not run them by default — `npm run gate:small -- --smokes`
(#496) adds the browser phase after the artefact preparation: `bundle-sync`, then
the directly matched and registered smokes two at a time; "broad" matches stay
the reviewer's call. `golden`, `pytest` and `check-docs --screenshots=strict`
remain the author's call by diff and AC.

**Start a task from its packet** (#496): `node scripts/task-packet.mjs --issue NN`
prints one derived view — status and track, what the status permits, the owner's
recent decisions, the branch against `dev` and Validate on its tip, the previous
verdict with its recorded tree, AC → evidence from the last review document and
what is still unwitnessed. It reads GitHub and git and writes nothing; the labels
remain the only source of status.

**Heavy CI gates run on the beta candidate, nightly and on demand — not on every
push (#479).** `smoke`, `golden` and `performance_smoke` in Validate are gated
on the `heavy` output: true for a head commit carrying a `Release:` trailer, for
`workflow_dispatch full=true` (which `nightly.yml` issues on `dev` every night)
and for pull requests. A plain push to `dev` runs preflight, frontend (types,
units, build, bundle sync, no-new-any), backend, hacs and hassfest. Screenshot
freshness in `check-docs` is likewise a warning on a plain push and an error on
the candidate; `publish-prerelease.yml` and `release.yml` refuse a candidate
without the `Release:` trailer, so a green Validate without the heavy jobs can
never pass for a release.

During the implementation cycle the fast gates always run. Since 2026-08-14 the
owner's machine also carries Playwright with Chromium (Windows) and a full WSL
environment, which changes one thing (#151): **before moving an issue to
`S7-code-review`, run the smokes named in its AC locally** — `node
demo/smoke_<name>.mjs`. A red smoke that reaches the review costs a cycle; run
locally it costs a minute. Precedent: on #89 a fixture error lived through a
whole review round that a local run would have caught immediately.

**One handoff, one push (#510).** Run `node scripts/process-gate.mjs --issues`
locally with `gh` available before pushing (without `gh` the hook cannot check the
issue status and stays silent). After `S7-code-review` do not push to the branch
until the verdict or the return arrives: a push on top of a running review cancels
it (10–20 runner minutes) and, after the material is fixed, also the merge (#312).
Set `S7` once per round, not after every CI fix: the pipeline now runs Validate
with the diff mutants on the material itself and returns a red one to `S6` without
spending a review cycle. Mutants by diff no longer run on ordinary pushes — only
on the review candidate, the merge candidate, the beta candidate, PRs and the
nightly run — so a routine push costs ~3 minutes; 08–09.09 they cost 48 of 56
Validate job-hours and were mostly cancelled by the next push.

The full smoke set, `golden` and `performance_smoke` still belong to the
pre-beta run — which is then mandatory and complete. WSL runs of the full HA
harness (`~/houseplan-card`, venv) are advisory; **the canon does not move**:
the beta gate is CI at the exact SHA.

**Verifying and capturing are different things (#455).** `golden:verify` is
advisory and legal anywhere, Windows included: it reports differences and
accepts nothing. **Capturing** frames is refused outside Linux
before the browser even starts — `golden:capture` through
`demo/golden/policy.mjs`, documentation screenshots through
`npm run docs:capture` (use that script, not a bare `node
demo/docs/capture.mjs`: the gate sits one step earlier because editing the
capture script invalidates the committed screenshot index). The refusal prints
the WSL command. The reason is not policy but physics: Windows
rasterizes text through DirectWrite with different subpixel and DPI behaviour,
so no frame ever matches an accepted baseline byte for byte, no environment
witness can exist, and acceptance would refuse anyway (#401 accepts any
environment that proves itself with byte-identical undeclared frames — Linux is
simply the only one we have). The deliberate override is
`HP_ALLOW_FOREIGN_CAPTURE="reason"`; the reason travels into the output and the
manifest. Baselines are still accepted only via
`npm run golden:accept -- --reviewed` on a complete artefact, and the accepted
index records the platform next to the Chromium build. The one local
shortcut is `npm run docs:accept -- --identical` (#512): it re-captures on this
machine, compares decoded pixels with the committed frames and, only when every
frame is identical, refreshes the manifest fingerprints — frames that differ go
through the artefact as before. The displayed card version reaches the DOM
through `displayVersion()` (`src/card-version.ts`); the global
`__HP_VERSION_OVERRIDE__` behind it is for harnesses only and the product never
sets it.

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
went red after the #113 merge. A stable release additionally waits for Full
Performance and for a green E2E run on a real Home Assistant (`houseplan-e2e`,
dispatched on the candidate SHA by `release.yml`, #514/#540); betas and the
development cycle never run E2E. Installable assets (`houseplan.zip`,
`houseplan-card.js`, `SHA256SUMS`) reach the public release only from
`release.yml` after those gates; a release published by hand is turned back into
a draft first (#540).

**"Verified" without a named command and its result is not evidence.**

## Environments

**Local Windows checkout** is the day-to-day environment: Node 22 and Python 3.14
as in CI (`npm run toolchain:check` compares the machine with the pins CI actually
uses — `.nvmrc` and `.python-version` are derived from the same sources, #496),
`gh` authenticated. On the owner's machine do not trust the ambient PATH:
`.\scripts\windows-toolchain.ps1 setup|check` owns a verified portable Node and
dedicated `.venv-ci`, and its `npm`/`node`/`python`/`playwright` actions are the
explicit pinned entrypoints (#557). It changes no persistent PATH and never
deletes a mismatched venv. In WSL, work from an ext4 clone and use
`bash scripts/wsl-setup.sh --verify` for the real HA subset plus one Linux visual
capture; exact-SHA Linux CI remains authoritative. `.venv-backend` does **not**
exist there — it is provisioned only by cloud agent startup scripts, which also
run `npm ci` and install Playwright Chromium.

Known environment-sensitive smoke: `demo/smoke_opening_measure.mjs` fails two
sub-checks (`place_dialog_x_magnetised`, `place_committed_x_center`) under the pinned
Chromium — a `1e-6`-tolerance magnet-snap on the opening-*placement* path. It
reproduces against the pristine committed bundle, so treat it as
pre-existing/pixel-precision, not a regression you introduced.

## Alpha experiments

`src/labs.ts` is the single registry and resolver for hidden presentation
experiments. One browser-local switch controls the complete set known to the
installed build: `hp_alpha=1` in query or the shared hash grammar enables and
persists it, while `hp_alpha=0` disables and persists it. Do not add per-feature
URL/storage keys or a YAML/config switch. The legacy `hp-labs` grammar and
`houseplan_card_labs_v1` storage are ignored and never migrated.

A new registry entry needs a unique lowercase id, issue, summary and
unit/browser coverage; it does not get `since` or `expires`. Invalid or duplicate
entries fail closed. Alpha capabilities may alter presentation only and must not
gate data, migrations, stores, HA actions or network calls. Current renderer
details are in `docs/ISOMETRIC.md`.

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
