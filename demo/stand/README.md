# Demo-stand extras

Things that live on the public stand (demo.houseplan.tech) but are not part
of the shipped integration.

- `demo_robot/` — the scripted robot vacuum (docs/VACUUM.md, "demo stand gets
  a scripted synthetic robot"). Deployed by copying the folder to
  `custom_components/demo_robot` in both stand seeds and adding `demo_robot:`
  to configuration.yaml; the dev stand picks it up automatically from this
  path (`/opt/hp/bin/hp-update-dev.sh`). The rest of the stand-only config
  (template LQI sensors, alarm helpers, the smoke automation) lives in the
  seeds on the stand host — see `docs/TESTING-DEMO.md` and the memory note
  `houseplan-demo-stand`.

- `demo_guard/` — stand-only guard (2026-07-31). Visitors log in as an
  administrator (the card editor is gated on `is_admin`) and kept restarting
  HA from the UI, which looked like the stand crashing between hourly resets.
  The component re-registers `homeassistant.restart`/`homeassistant.stop` as
  no-ops after startup. Deployed to `custom_components/demo_guard` in
  seed-demo only (the dev stand sits behind basic auth) + `demo_guard:` in
  configuration.yaml.

- `www/stand-reset-timer.js` — console-only countdown to the next hourly
  reset (`hp-reset.timer`, every hour at :00). Served as
  `/local/stand-reset-timer.js` from `seed-demo/www/`, wired through
  `frontend: extra_module_url`. Logs a styled `console.info` every minute,
  switching to `console.warn` for the last 5 minutes. `www/stand-dev-info.js`
  is the dev-stand counterpart: a single `console.info` saying the dev stand
  only resets on deploy.
