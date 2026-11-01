# Agent entry point

Read [docs/SCOPE.md](docs/SCOPE.md), then [PROCESS.md](PROCESS.md). The root
PROCESS is the single description of task, review, testing and release rules.
GitHub issue bodies and the owner's explicit decisions define the task.

**This branch prepares #1105; the new process is not activated.** Editing these
instructions does not enable workflows or authorize push, merge, publication,
paid model calls or changes to the running beta. The remaining old workflows,
hooks and npm wrappers are implementation scheduled for replacement, not
instructions to follow. The separate cutover plan is
[process-next/CUTOVER.md](process-next/CUTOVER.md).

## Repository map

House Plan is one HACS package:

- `src/`: TypeScript + Lit frontend, including the panel and Lovelace card.
- `custom_components/houseplan/`: Python storage integration.
- `dist/`: ignored local build output. The tracked frontend snapshot is
  `custom_components/houseplan/frontend/`; ordinary work does not rewrite it.
- `demo/`: synthetic browser harness. `demo/serve.mjs` starts it;
  `demo/golden/`, `demo/performance/`, `demo/guard/` and `demo/stand/`
  contain their fixtures and operating notes.
- `process-next/`: the prepared commands, test selections, review prompt,
  queue and release mechanisms for #1105.

View is the product for household members and guests. Editors are admin tools.
For visible changes, read [docs/USER-GUIDE.ru.md](docs/USER-GUIDE.ru.md) for the
existing vocabulary and [docs/TOUCH-SUPPORT.md](docs/TOUCH-SUPPORT.md) for input
contracts. Do not weaken product behavior to make a check pass.

## Read what the task needs

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) maps product subsystems. Read the
relevant canonical document when changing one: `SUN.md`, `LIGHT.md`,
`CANVAS.md`, `WALL-THICKNESS.md`, `UX-MODES.md`,
`CONFIG-COMPATIBILITY.md`, `TOUCH-SUPPORT.md`, `ISOMETRIC.md`,
`VACUUM.md`, `DECOR-EDITOR.md`, `DEVICE-PRESENTATION.md`, `FILTERING.md`,
`STAIRS.md`, `RADAR.md`, `PDF-EXPORT.md` or `STYLING-HOOKS.md`, all under
`docs/`. Historical specs in `docs/specs/` and `legacy/` are context,
not new process requirements.

Role notes provide entry links, not another rulebook:
[author](docs/process/AUTHOR.md), [reviewer](docs/process/REVIEWER.md).
Environment details live in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md);
test purposes and prerequisites in [docs/TESTING.md](docs/TESTING.md).
Read [docs/STATUS.md](docs/STATUS.md) for the preparation status and entry links;
live task and release state comes from GitHub.
Old task-packet and entry-measurement generators are not required entry steps.

## Working boundaries

- Work on the task's stated scope in an isolated branch/worktree. One checkout
  has one HEAD; preserve other agents' changes and never reset an unfamiliar
  working tree.
- An installed track is binding. Initial selection when no track exists follows
  the four ship criteria in PROCESS; no agent promotes or lowers an existing
  track.
- The executor owns mechanical preparation on S6. S7 means waiting for or
  performing substantive code review. Pure documentation changes have **no
  test, build, lint, link-check or hidden-hook runs**.
- Report actual commands and outcomes when checks are required. Missing
  prerequisites and unexecuted checks are not passing results.
- Use synthetic data for screenshots and labs. Do not change the owner's HA
  instance or accept visual baselines without the relevant instruction.
- Until cutover is explicitly authorized, continue preparation only. Do not
  install old hooks as part of setup or use their gates to drive this branch.
  The prepared remote commands default to a plan; keep activation disabled.

Do not repair old tests that assert removed instruction wording. Their retirement
belongs to cutover. Changes to the prepared implementation use its addressed
behavioral tests; this does not add runs to pure documentation tasks.
