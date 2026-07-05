# Contributing to House Plan

Thanks for your interest! The project is one HACS package: a storage **integration**
(`custom_components/houseplan/`, Python) and a **Lovelace card** (`src/`, TypeScript + Lit).

## Five-minute setup

```bash
git clone https://github.com/Matysh/houseplan-card && cd houseplan-card
npm ci                    # frontend toolchain
npm run typecheck         # tsc --noEmit (strict)
npm test                  # node:test — pure logic, i18n parity, tap-action security
npm run build             # tsc + rollup → dist/houseplan-card.js
pip install pytest voluptuous && python -m pytest tests_backend -q   # pure backend tests
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
  see `resolveTapAction` in `src/logic.ts`; don't weaken it.
- Follow the Integration Quality Scale where applicable —
  `custom_components/houseplan/quality_scale.yaml` tracks the self-assessment.

## Architecture

Start with `docs/ARCHITECTURE.md` (data model, WS API, coordinate system) and
`docs/STATUS.md` (current state). Release: bump the version in `package.json`,
`manifest.json`, `const.py`, `CARD_VERSION`, tag `vX.Y.Z`, publish a GitHub release —
the workflow attaches the card bundle.
