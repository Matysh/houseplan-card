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
issue. [GitHub Projects (v2)](https://github.com/users/Matysh/projects/1) is a
human-facing view synchronised from the labels, not the source of truth.

Only issues **created by the owner** enter the process. The repository is public;
outside reports may be malformed or invalid, carry no status labels, and are not
picked up until the owner converts them into his own issue.

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

`PROCESS.md` §1 is the authority; it does not yet list `package.json`,
`package-lock.json`, `.githooks/**`, the rest of `.github/**`, `.gitignore` or
`pytest.ini`. Treat them as class B and tell the owner §1 needs the addition.

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

Everything else still requires the owner's explicit command: pushing `dev` or
`main`, merging a task branch, creating tags, publishing betas and releases.

## Two-agent workflow

**Codex** writes analysis, specs and all product code. **Claude** reviews specs and
code and owns infrastructure and distribution. The owner rules on disputes, closes
issues and commands releases.

Author and reviewer are different models, which is what "a fresh session without
implementation context" means in practice. The reviewer never edits product code;
the author never grades their own work.

The exchange happens in **issue comments** — there is no local message bus. Verdict
format:

```text
Verdict: green/yellow/red · cycle r<N>/4 · High: N · Medium: N → #… · Document: …
```

High blocks. Medium must become its own issue. Low is fixed or waived with a note
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

**Ambiguity is asked, not guessed.** A guess written as fact is the worst kind of
defect: it passes review because it looks like a decision. Ask the owner in one
batched issue comment, each question carrying a proposed default, and put `blocked`
on top of `S3-spec` while waiting. Small or cheap calls are decided and recorded in
an explicit "assumed, change freely" block at the end of the spec.

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

During the implementation cycle only the fast gates run. `smoke`, `golden` and
`performance_smoke` spin up Chromium and belong to the pre-beta run — which is then
mandatory and complete.

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
TypeScript and package-lock build inputs. Benchmark and golden tooling must call
`assertFreshDemoBundle` before recording any result; a missing or mismatched
fingerprint is a hard failure, not a warning.

**CI is pinned to an exact SHA.** The release gate accepts only a `completed
success` run for the candidate's SHA, not "the last green one"; a new push cancels
an unfinished Validate for the same branch. Jobs: `provenance`, `hacs`, `hassfest`,
`frontend`, `smoke`, `golden`, `performance_smoke`, `backend`.

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
