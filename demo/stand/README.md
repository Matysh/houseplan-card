# Demo-stand extras

Things that live on the public stand (demo.houseplan.tech) but are not part
of the shipped integration.

- `demo_robot/` — the scripted robot vacuum (docs/VACUUM.md, "demo stand gets
  a scripted synthetic robot"). Deployed with `./install.sh <ha-config-dir>`
  into both stand seeds, plus `demo_robot:` in configuration.yaml; the dev
  stand picks it up automatically from this path
  (`/opt/hp/bin/hp-update-dev.sh`, which calls the same script). The rest of the stand-only config
  (template LQI sensors, alarm helpers, the smoke automation) lives in the
  seeds on the stand host — see `docs/TESTING-DEMO.md` and the memory note
  `houseplan-demo-stand`.

- `demo_guard/` — stand-only guard (2026-07-31). Visitors log in as an
  administrator (the card editor is gated on `is_admin`) and kept restarting
  HA from the UI, which looked like the stand crashing between hourly resets.
  The component re-registers `homeassistant.restart`/`homeassistant.stop` as
  no-ops after startup. Deployed by the same `install.sh` into seed-demo only
  (the dev stand sits behind basic auth) + `demo_guard:` in
  configuration.yaml.

- `www/stand-reset-timer.js` — console-only countdown to the next hourly
  reset (`hp-reset.timer`, every hour at :00). Served as
  `/local/stand-reset-timer.js` from `seed-demo/www/`, wired through
  `frontend: extra_module_url`. Logs a styled `console.info` every minute,
  switching to `console.warn` for the last 5 minutes. `www/stand-dev-info.js`
  is the dev-stand counterpart: a single `console.info` saying the dev stand
  only resets on deploy.

## Why the manifests are templates

Both components ship their manifest as `manifest.template.json`, and
`install.sh` renames it to `manifest.json` on the stand.

The reason is the HACS submission check: `hacs/default` validates a repository
by globbing `*manifest.json` over the whole clone of the DEFAULT branch and
refuses anything that does not have exactly one
(`scripts/helpers/integration_path.py` — "No manifest", exit 1). Two stand-only
manifests turned the Hassfest job of PR #9004 red on 2026-08-11, five weeks into
the review queue. `test/repo-hygiene.test.mjs` now fails if a second one
appears, so this cannot be rediscovered by a reviewer again.
