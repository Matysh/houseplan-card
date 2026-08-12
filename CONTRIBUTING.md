# Contributing to House Plan

Thanks for your interest! The project is one HACS package: a storage **integration**
(`custom_components/houseplan/`, Python) and a **Lovelace card** (`src/`, TypeScript + Lit).

## Changelog

User-visible changes go into **both** changelogs in the same commit:
`docs/CHANGELOG.md` (English) and `docs/CHANGELOG.ru.md` (Russian). Entries
older than v1.42.0 exist only in the English file — no need to backfill them.

## Where to ask

Not sure whether something is a bug, or just want to discuss an idea before
writing code? The **[Telegram chat @ha_houseplan](https://t.me/ha_houseplan)**
is the quickest route to the author and other users. Bugs and concrete feature
requests still belong in [issues](https://github.com/Matysh/houseplan-card/issues).

## Backlog and work status

[GitHub Issues](https://github.com/Matysh/houseplan-card/issues) and the linked
[GitHub Project v2](https://github.com/users/Matysh/projects/1) are the
only active project backlog. Issues own scope and acceptance criteria; Project
v2 owns prioritization and workflow status. Before starting planned work, link
it to an existing issue or create one, add it to the Project, and keep both
surfaces current until the verified result is closed. Design specs and ADRs may
support an issue, but they do not replace it or maintain a separate checklist.

## Five-minute setup

```bash
git clone https://github.com/Matysh/houseplan-card && cd houseplan-card
npm ci                    # frontend toolchain
npm run typecheck         # tsc --noEmit (strict)
npm test                  # node:test — pure logic, i18n parity, tap-action security
npm run build             # tsc + rollup → dist/houseplan-card.js
pip install pytest voluptuous && python -m pytest tests_backend -q   # pure backend tests
git config core.hooksPath .githooks  # issue/release provenance trailers
```

The HA-harness backend tests (`tests_backend/test_ha_*.py`) need Python ≥3.13 and
`pytest-homeassistant-custom-component home-assistant-frontend`; CI runs them on
every push — locally they are skipped when `homeassistant` is not importable.

## Ground rules

- **Docs in the same commit**: CHANGELOG entry for user-visible changes;
  `docs/STATUS.md` for state changes; `docs/DEVELOPMENT.md` for new gotchas.
- Every UI string goes through `src/i18n/<lang>.json` (tests enforce en/ru key parity).
  Adding a language = adding one JSON file + registering it in `src/i18n.ts`.
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
