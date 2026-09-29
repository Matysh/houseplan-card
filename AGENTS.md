# AGENTS.md

House Plan is one HACS package with two parts plus a demo harness:

- **Lovelace card** (`src/`, TypeScript + Lit) — the primary product, bundled to
  the entry, manifest and hashed chunks under `dist/`.
- **Storage integration** (`custom_components/houseplan/`, Python) — the Home
  Assistant backend.
- **Demo harness** (`demo/`) — a Playwright page (`demo/srv/demo.html`) that
  renders the card against a fake `hass` for screenshots and the `smoke_*.mjs`
  suite. The home is fully synthetic. Launcher `demo/serve.mjs`; golden scenes
  `demo/golden/`, performance `demo/performance/`, guard suite `demo/guard/`,
  live stand seed `demo/stand/` — each with its own README.

This file is the map and the few rules every session needs before its first
command. `PROCESS.md` is the only complete canon and wins any disagreement;
the sections below link to it instead of retelling it.

## Read this first

**`docs/SCOPE.md` before anything else.** It was fixed with the owner and states
its own authority: features are built, improved and accepted **only** if they
serve a job listed there. Its central consequence: **View mode is the product
for two of the three personas.** Editors are admin-only tools and must never
leak interactions into View. For work that changes visible behaviour, also read
`docs/USER-GUIDE.ru.md` — interface wording comes from there and is not invented.

**Reading order by role** (#634). `node scripts/entry-cost.mjs` measures each
route and `test/entry-cost.test.mjs` keeps this list equal to its routes:

- author (analysis, spec, implementation, infrastructure): `docs/SCOPE.md` →
  `AGENTS.md` → `docs/process/AUTHOR.md`, then the task packet
  (`node scripts/task-packet.mjs --issue NN`); the status snapshot
  (docs/STATUS.md) only when resuming a session or preparing a release;
- reviewer (spec or code): `docs/SCOPE.md` → `AGENTS.md` →
  `docs/process/REVIEWER.md`, then the issue body and its comments;
- changing the pipeline, the gates or the process itself: `docs/SCOPE.md` →
  `AGENTS.md` → `PROCESS.md` → `docs/STATUS.md`.

The two digests quote and link `PROCESS.md` section by section; open the linked
section whenever a digest line governs your current step. For non-trivial
changes add `docs/ARCHITECTURE.md` plus the canonical document of the subsystem
you touch (one list, the same one the reviewer prompt in `_process.yml` reads):
`SUN.md`, `LIGHT.md`, `CANVAS.md`, `WALL-THICKNESS.md`, `UX-MODES.md`,
`CONFIG-COMPATIBILITY.md`, `TOUCH-SUPPORT.md`, `ISOMETRIC.md`, `VACUUM.md`,
`DECOR-EDITOR.md`, `DEVICE-PRESENTATION.md`, `FILTERING.md`, `STAIRS.md`,
`RADAR.md`, `PDF-EXPORT.md`, `STYLING-HOOKS.md`.

Where the rest lives: commands — `package.json` scripts, `CONTRIBUTING.md`,
`docs/DEVELOPMENT.md` (toolchain, build, release — its Release section is the
only home of release mechanics); tests and gates — `docs/TESTING.md`.

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

GitHub Issues are the canonical task records and the **labels** are the status
(`PROCESS.md` §9); when repository documentation disagrees with an issue, the
issue wins. Change classes (`PROCESS.md` §1): **A** product (`src/**`,
integration Python, manifests, i18n), **B** gates and tooling (tests, `demo/**`,
`scripts/**`, `.github/**`, build and package configuration), **C**
documentation, **D** generated (bundle, golden baselines) — D beats A where paths
overlap. The committed bundle changes only in a commit with a `Release:` trailer
(#657); an ordinary task restores it with `npm run bundle:clean` before
committing.

**Tracks** (`PROCESS.md` §5, §5.1): the label `track:ship`, `track:show` or
`track:ask` sets the route, and the owner's label beats the criteria. `show` is the
default: up to three AC in the issue body, no spec review, `S2` → `S5`. `ship` is a
one-sentence change within fixed limits, `S1` → `S5`. `ask` is the full route with
a spec review. Any agent may raise a track with a reason; only the owner lowers it.
`small` and `trivial` read as `show`. An **infrastructure** task — not a single
class A file — skips analysis and spec and enters at `S7-code-review`
(`PROCESS.md` §1). Every change is code-reviewed; on `ship` the review moves to a
batch review of the beta range before the tag (`ship-review.yml`, `PROCESS.md`
§11.7). The review pipeline prices each round by track (§10.4): no mutants run
during development on any track — the whole registry runs nightly (#709); a
rebase before review only on `ask` or when
the branch does not merge cleanly into `dev`. Review checks scope, risks and the
evidence from executed tests, but does not replace executing them.

## Specs

The spec lives in the **issue body**, under a `## ТЗ` heading (owner decision
2026-09-10, #517); `docs/specs/` is an archive of specs written before that date
and takes no new files. Required sections and the rule for questions are
`PROCESS.md` §7.1: only **product** ambiguity goes to the owner — what a person
sees or does, and how much user-visible change belongs in this issue — in one
batched comment with a proposed default for each question and `blocked` on top of
`S3-spec`. Everything a user cannot observe is yours to decide and record.

## Commits and branches

Hooks install themselves on `npm ci` (`prepare` → `scripts/install-hooks.mjs`);
`git config core.hooksPath` must print `.githooks`. Every non-merge commit that
touches anything outside class C (docs) carries **terminal** trailers; a
docs-only commit needs none (`PROCESS.md` §3 п.10, #701):

```text
Issue: #123
User-Visible: yes
```

One `Issue:` line per issue. `User-Visible: yes` requires edits to **both**
`docs/CHANGELOG.md` and `docs/CHANGELOG.ru.md` in the same commit. A commit
touching `demo/golden/baselines/**` also needs `Release:` plus exactly one of
`Baseline-Reviewed: <GitHub run URL>` or `Baseline-Reviewed-Local: sha256:<WSL
attestation>` (`PROCESS.md` §10.1). Never invent a review link and never rewrite
published history to satisfy trailers.

Branch `issue/<NN>-slug`; direct commits to `dev`, no PR (owner's decision); a
violation is fixed with a follow-up commit, never a force-push.

- **Push after every task, not before a beta** — while work sits unpushed there
  is nothing to review.
- **Standing permission: push `issue/<NN>-slug` without asking.** The reviewer
  runs in CI and reads only the remote; a task branch publishes nothing to users.
  Push the material **before** applying the review label.
- **Do not merge into `dev` by hand.** On a green review the pipeline rebases,
  pushes and only then sets `S8-merged`. A conflicting rebase returns the task to
  `S6-in-progress` with the verdict intact; `node scripts/rebase-on-dev.mjs`
  resolves conflicts in generated files only (`PROCESS.md` §2.10), then push and
  re-apply `S7-code-review`.
- Everything else needs the owner's explicit command: pushing `main`, tags,
  publishing betas and releases, closing issues.

## Working trees (#115)

One checkout, one `HEAD`: two agents sharing a directory inherit each other's
branch. `houseplan-card-src/houseplan-card` is the author's tree — task branches
live there, and unfamiliar local changes belong to the author or the owner,
never reset or clean them away. `houseplan-card-src/hp-dev` is the owner's
worktree, permanently on `dev`. The reviewer owns no tree: it runs in CI on a
fresh checkout. A worktree works only on the machine that created it — its
`.git` file records an absolute path in that machine's format.

## Handoff and the verdict

Start a task from its packet: `node scripts/task-packet.mjs --issue NN` (status,
track, what the status permits, the branch against `dev`, the previous verdict
and the unwitnessed AC; it writes nothing). The local gate is
`npm run gate:small` (`docs/TESTING.md` › Локальный набор перед пушем); run the
smokes named in the AC before `S7-code-review`. **"Verified" without a named
command and its result is not evidence.** Comment formats — claim, handoff,
verdict — are `PROCESS.md` §7.2.

**One handoff, one push** (`PROCESS.md` §10.4). Run
`node scripts/process-gate.mjs --issues` before pushing; after
`S7-code-review` do not push to the branch until the verdict or the return
arrives — a push on top of a running review cancels it.

**Having applied `S4-spec-review` or `S7-code-review`, wait for the result
instead of ending the session.** The label starts the pipeline by itself. Poll
with `node scripts/wait-verdict.mjs --issue NN [--sha <tip>]` (#496): it watches
the label and the pipeline's comments every 90 s, at most 110 times, prints only
on a change and exits 0 on a new label, 3 on an event that needs a hand, 4 on
timeout. Watch the **label**, not the comment. Do not wait while `blocked` is
set.

| Now reads | What happened | What you do |
|---|---|---|
| `S5-ready` | the spec is accepted | write the code |
| `S3-spec` | the spec came back | read the verdict, revise, re-apply `S4-spec-review` |
| `S6-in-progress` | the code came back | revise, re-apply `S7-code-review` — **or**, if the verdict was green and only the merge conflicted, just rebase and re-apply. The comment says which |
| `S8-merged` | accepted and already in `dev` | nothing |
| `review-4` | the cycle limit is spent | stop, the owner decides |

**After a review run the label always changes.** If it did not, the run itself
failed rather than the work — say so to the owner instead of polling on. The
bounded queue reconciler (#555) re-wakes a review whose event was lost; it is a
safety net, not permission to stop waiting for the review you started.

A failed pre-release gate (golden, full smokes, performance, HA harness) does not
send the issue back to review: fix, re-run what failed, record the exact command
and result in the issue (`PROCESS.md` §11.4 — and its limits).

## Environments

The owner's Windows machine: `.\scripts\windows-toolchain.ps1 setup|check` owns
the pinned Node and Python; WSL works from an ext4 clone with
`bash scripts/wsl-setup.sh --verify` (`docs/DEVELOPMENT.md` › Local Windows
workstation). `npm run toolchain:check` compares any machine with the pins CI
uses. The full Home Assistant harness cannot run on native Windows; without an
importable `homeassistant` pytest does not collect `test_ha_*.py` at all, so a
green pure run proves nothing about the harness (`docs/TESTING.md`). Cloud
agents have the harness at `.venv-backend/bin/python`.
