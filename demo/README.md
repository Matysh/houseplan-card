# Synthetic demo home

A fully fictional house (plans, devices, states) used for README screenshots,
the demo GIF and headless smoke tests — so no real home data ever appears in
public materials.

- `srv/demo.html` — self-contained host page: `<ha-icon>`/`<ha-card>` stubs and a
  fake `hass` (registries, states, `callWS`, `callService`, floors).
- `srv/assets/` — generated plan SVGs and `icons.js` (`node demo/gen_icons.mjs`,
  needs the repo's devDependencies). The card bundle is copied from `dist/`:
  `cp dist/houseplan-card.js demo/srv/assets/`.
- `serve.mjs` — playwright launcher (route interception, no web server).
- `smoke_*.mjs` — feature smoke tests; run with a Chromium installed via
  `PLAYWRIGHT_BROWSERS_PATH=<dir> npx playwright install chromium-headless-shell`.

Note for sandboxed sessions: `/tmp` does not survive; this directory is the
persistent home of the harness (docs/DEVELOPMENT.md has the LD_LIBRARY_PATH recipe).
