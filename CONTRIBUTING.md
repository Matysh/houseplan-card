# Contributing to House Plan

House Plan is one HACS package: a storage integration
(`custom_components/houseplan/`, Python) and a frontend
(`src/`, TypeScript + Lit).

The development process has one home: [PROCESS.md](PROCESS.md). It defines
tracks, statuses, checks, independent review, merge and releases. Agents start
with [AGENTS.md](AGENTS.md).

**This branch prepares #1105; activation has not happened.** The documentation
describes the agreed process, while old workflows/hooks still await the separate
[cutover](process-next/CUTOVER.md). Do not run them as an additional acceptance
route, enable the prepared workflows or publish from this branch without the
owner's cutover instruction.

## Starting work

[GitHub Issues](https://github.com/Matysh/houseplan-card/issues) are the task
records; their labels hold status and track. Keep the scope and expected result
in the issue. An installed track is binding; initial ship selection follows
the four criteria in PROCESS.

Work in an isolated branch/worktree. Preserve other people's local changes.
The final synchronization, selected S6 checks, review when required and merge
belong to the queue described in PROCESS. Pure documentation changes have no
test, build, lint or link-check runs.

## Environment and checks

Use the pinned Node/Python versions and a prepared Ubuntu WSL checkout for the
local sets. Environment setup is described in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md); test purposes and prerequisites in
[docs/TESTING.md](docs/TESTING.md). During preparation, dependency installation
uses `npm ci --ignore-scripts` so the old `prepare` hook installer is not
reactivated. No installation or test run is required merely to edit docs.

Use `node process-next/cli.mjs plan --event task --issue 9999 --track show --layer product`
to inspect the prepared product task profile, replacing 9999 with the actual issue number. Supply the changed-area selection
for the actual task. `plan` executes nothing; commands for running profiles
and finishing tasks are in PROCESS. Remote execution remains disabled here.

A blobless clone (`git clone --filter=blob:none`) retains commit history and
tags while fetching old file contents on demand. Use a normal full clone when
working offline with history. Final synchronization needs real ancestry and
merge bases; a shallow clone may need its history fetched first.

HA backend scenarios need the pinned Python and an importable Home Assistant
harness on Linux/WSL. A pure backend run without that harness does not prove
the HA scenarios passed. Native Windows does not replace that environment.

## Documentation and release notes

Update product documentation when behavior changes and record user-visible
changes for both [English](docs/CHANGELOG.md) and
[Russian](docs/CHANGELOG.ru.md) release notes. Release preparation follows
PROCESS; there is no separate per-commit changelog gate. Historical entries
older than v1.42.0 remain in English without a backfill requirement.

Update architectural documentation when changing data, WebSocket contracts or
coordinates. Keep status notes factual. Do not inflate a small task with
unrelated document rewrites.

## Translations

A shipped UI language has three matching parts:

1. `src/i18n/<code>.json` for the card;
2. `custom_components/houseplan/translations/<code>.json` for the Home Assistant
   integration;
3. one registry entry (code, native label and eager dictionary or lazy loader)
   in `src/i18n/registry.ts`.

Use the canonical Home Assistant/BCP 47 language tag as `<code>` (for example,
`fr` or `pt-BR`) and use that exact spelling for both JSON filenames. Lookup is
case-insensitive and also accepts `_` from legacy locale sources.

The registry drives language resolution, the visual-editor selector and parity
tests. The tests reject missing or extra locale files; frontend dictionaries
also fail on mismatched keys, empty values and changed placeholders.
Placeholders such as `{name}` and `{n}` are a contract: do not translate, add
or remove them.

English and Russian are synchronous fallback/legacy locales. German is the
reference lazy third-locale implementation: its module carries the same build
fingerprint as the entry bundle, has one content-hashed retry URL and is listed
under `lazyLocaleFiles` in `houseplan-assets.json`. New sizeable locales should
follow that lazy-loading path to keep initial loading small. Extend the runtime,
manifest, file/key/placeholder parity and
regional-locale tests together; never bypass the registry by importing a locale
directly in a component.

Administrator-only copy lives in three lazy namespace dictionaries —
`src/i18n/settings/`, `src/i18n/support/` and `src/i18n/topology/` (#627). Their
English file is static (the synchronous fallback); every other language is one
lazy chunk per namespace × language: a two-line loader module
`src/i18n/<namespace>/<namespace>-<code>.ts`, one `import()` with a
content-hashed retry token in `src/i18n/<namespace>.ts`, and one entry in
`NAMESPACE_LOCALE_CHUNKS` in `scripts/bundle-manifest.mjs`. The lazy surfaces
(onboarding, editor runtime, Zigbee overlay) wait for their dictionaries before
painting; keep non-English namespace JSON behind those lazy imports. The
related locale tests document this product contract.

The current `subst()` helper does not implement plural rules. Phrase strings so
their grammar does not depend on the numeric value (for example, use a neutral
label followed by `{n}` rather than an English singular/plural pair).

Adding a UI locale does not automatically create another full documentation
set; maintain the existing English and Russian documentation according to the
project's normal rules. Right-to-left layout is a separate product project,
because the plan canvas and editors cannot be mirrored by translations alone.

## Screenshots and visual references

Use synthetic data and the prepared browser environment. Documentation images
under `docs/images/` and golden references under `demo/golden/` serve
different purposes. Neither is refreshed automatically merely because a task
changes text or visuals.

Task checks target the affected view when needed; beta/stable selections and
reference acceptance are specified in PROCESS. Reference changes are reviewed
and accepted explicitly by scene, using the prepared `golden-accept` command.
Unexplained differences remain failures; a successful screenshot capture does
not by itself approve a new reference.

The independent documentation screenshot workflow remains an optional tool.
Its index records scene/source/image provenance. It is not a mandatory stage of
a documentation task or a substitute for product acceptance.

## Product contracts

- UI strings use the locale registry and dictionaries described above.
- Tap actions preserve the safeguards in `src/device-toggle.ts`; changing
  labels or process rules does not change the product's permission model.
- Ordinary tasks do not rewrite the tracked frontend release snapshot.
  Release packaging is described in PROCESS.
- The integration's self-assessment is in
  `custom_components/houseplan/quality_scale.yaml`.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) maps the product; read the
  relevant subsystem document for the change.

## Where to ask

The [Telegram chat @ha_houseplan](https://t.me/ha_houseplan) is available for
questions and discussion. Bugs and concrete feature requests belong in
[GitHub Issues](https://github.com/Matysh/houseplan-card/issues).
