# Contributing to House Plan

Thanks for your interest! The project is one HACS package: a storage **integration**
(`custom_components/houseplan/`, Python) and a **Lovelace card** (`src/`, TypeScript + Lit).

## Changelog

User-visible changes go into **both** changelogs in the same commit:
`docs/CHANGELOG.md` (English) and `docs/CHANGELOG.ru.md` (Russian). Entries
older than v1.42.0 exist only in the English file — no need to backfill them.

## Translations

A shipped UI language has three matching parts:

1. `src/i18n/<code>.json` for the card;
2. `custom_components/houseplan/translations/<code>.json` for the Home Assistant
   integration;
3. one static entry (dictionary import, code and native label) in
   `src/i18n/registry.ts`.

Use the canonical Home Assistant/BCP 47 language tag as `<code>` (for example,
`fr` or `pt-BR`) and use that exact spelling for both JSON filenames. Lookup is
case-insensitive and also accepts `_` from legacy locale sources.

The registry drives language resolution, the visual-editor selector and parity
tests. The tests reject missing or extra locale files; frontend dictionaries
also fail on mismatched keys, empty values and changed placeholders.
Placeholders such as `{name}` and `{n}` are a contract: do not translate, add
or remove them.

The current `subst()` helper does not implement plural rules. Phrase strings so
their grammar does not depend on the numeric value (for example, use a neutral
label followed by `{n}` rather than an English singular/plural pair).

Adding a UI locale does not automatically create another full documentation
set; maintain the existing English and Russian documentation according to the
project's normal rules. Right-to-left layout is a separate product project,
because the plan canvas and editors cannot be mirrored by translations alone.

## Where to ask

Not sure whether something is a bug, or just want to discuss an idea before
writing code? The **[Telegram chat @ha_houseplan](https://t.me/ha_houseplan)**
is the quickest route to the author and other users. Bugs and concrete feature
requests still belong in [issues](https://github.com/Matysh/houseplan-card/issues).

## Backlog and work status

[GitHub Issues](https://github.com/Matysh/houseplan-card/issues) are the only
active backlog. An issue owns scope and acceptance criteria; its **labels** own
priority and workflow status — `PROCESS.md` §9 holds the vocabulary. Before
starting planned work, link it to an existing issue or create one, and keep it
current until the verified result is closed. Design specs and ADRs may support an
issue, but they do not replace it or maintain a separate checklist.

## Five-minute setup

```bash
git clone --filter=blob:none https://github.com/Matysh/houseplan-card && cd houseplan-card
npm ci                    # frontend toolchain
npm run typecheck         # tsc --noEmit (strict)
npm test                  # node:test — pure logic, i18n parity, tap-action security
npm run build             # tsc + rollup → dist/houseplan-card.js
pip install pytest voluptuous && python -m pytest tests_backend -q   # pure backend tests
npm install                # also installs .githooks through the prepare script
```

### Why `--filter=blob:none` (#345)

A full clone is **215 MB of `.git`**; a blobless one is **26 MB** — measured, not
estimated. Both carry all 1611 commits and all 182 tags, so ranges, `merge-base`
and `git diff` across history work identically; `git diff origin/dev~3..origin/dev`
in a blobless clone takes about a second and grows `.git` by one megabyte.

The difference is that historical *file contents* are fetched only if something
actually asks for them. That matters here because 32% of the pack is documentation
screenshots — ten PNGs re-captured 196 times — and another sizeable share is the
committed bundle, one 1.16 MB file per product change. Almost nobody ever reads an
old revision of either.

Drop the flag if you work offline with history, or need `git log -p` over the whole
tree repeatedly. Do **not** replace it with `--depth=1`: a shallow clone is about
the same size but has no `merge-base`, so the process gate, `smoke-select` and
every `origin/dev..HEAD` range stop working.

The HA-harness backend tests (`tests_backend/test_ha_*.py`) need Python ≥3.13 and
`pytest-homeassistant-custom-component home-assistant-frontend`; CI runs them on
every push — locally they are skipped when `homeassistant` is not importable.

## Ground rules

- **Docs in the same commit**: CHANGELOG entry for user-visible changes;
  `docs/STATUS.md` for state changes; `docs/DEVELOPMENT.md` for new gotchas.
- Every UI string goes through `src/i18n/<lang>.json`; follow the
  [Translations](#translations) flow for registry and backend parity.
- The built card must be committed in sync: `cp dist/houseplan-card.js
  custom_components/houseplan/frontend/` (CI compares them byte-for-byte).
- Tap actions have a security model (locks/alarms never toggle from the plan) —
  see `resolveToggleIntent` in `src/device-toggle.ts`; don't weaken it.
- Every commit follows the issue and trailer contract in `PROCESS.md`.
- Follow the Integration Quality Scale where applicable —
  `custom_components/houseplan/quality_scale.yaml` tracks the self-assessment.

## Architecture

Start with `docs/ARCHITECTURE.md` (data model, WS API, coordinate system) and
`docs/STATUS.md` (current state). Release: bump the version in `package.json`,
`manifest.json`, `const.py`, `CARD_VERSION`, tag `vX.Y.Z`, publish a GitHub release —
the workflow attaches the card bundle.
