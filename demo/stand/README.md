# Demo-stand extras

Things that live on the public stand (demo.houseplan.tech) but are not part
of the shipped integration.

- `demo_robot/` — the scripted robot vacuum (docs/VACUUM.md, "demo stand gets
  a scripted synthetic robot"). Deployed with `./install.sh <ha-config-dir>`
  into both stand seeds, plus `demo_robot:` in configuration.yaml; the dev
  stand picks it up automatically from this path
  (`/opt/hp/bin/hp-update-dev.sh`, which calls the same script). The rest of the stand-only config
  (template LQI sensors, alarm helpers, the smoke automation) lives in the
  seeds on the stand host; the demo home itself is described below.

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

- `update-dev-bundle.sh` — the dev stand's card bundle (#657). Since #657 the
  committed bundle changes only in a beta/release candidate, so the `dev` tree
  between betas carries the last beta's bundle. Validate publishes the bundle
  it built for the head of `dev` into the orphan branch `dev-build` (one commit,
  force-pushed, `DEV-BUILD.json` names the source SHA; `scripts/dev-build.mjs`).
  The host deploy script must overlay it after `git pull`:

  ```sh
  demo/stand/update-dev-bundle.sh --reset <checkout>   # before git pull: restore the tracked copy
  git -C <checkout> pull --ff-only
  demo/stand/update-dev-bundle.sh <checkout>           # after: frontend ← origin/dev-build
  ```

  Until `/opt/hp/bin/hp-update-dev.sh` does this, the dev stand shows the last
  beta's bundle instead of the head of `dev`.

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

## The demo home

**https://demo.houseplan.tech** — public, login `demo` / `demo` (an
administrator). **https://dev.houseplan.tech** — the closed stand behind basic
auth (access with the owner), auto-deploys `dev`. The public stand **resets
every hour** to a pristine synthetic home — break it freely, delete rooms,
upload plans, an hour later everything is back (the countdown is printed to the
DevTools console). Long-lived checks («the file is gone a day later», «survived
a restart») therefore cannot live on the stand, and restarting HA from inside is
blocked by `demo_guard`.

Demo home v2 is an anonymised layout of a real country house: dashboard
«House plan» (`/house-plan/0`; views Plan / Kiosk / Schema) and three spaces —
**Ground Floor** (Kitchen & Living, Hallway, Guest Bedroom, Guest WC, Boiler
Room, Sauna, Under-Stairs Closet, Outdoor Storage — hand-drawn, thick hatched
walls), **First Floor** (Kids Room A, Kids Room B, Upstairs Hall, Kids
Bathroom, Master Bathroom, Bedroom, Study — with a plan image backdrop) and
**Yard** (the Yard room plus a decor outline of the garage). 97 markers in
total: ~51 on Ground Floor, 23 on First Floor, 2 in the yard. Key demo devices:
the robot vacuum `vacuum.demo_robot` (dock in Under-Stairs Closet), leak
sensors (toggled by the helper `input_boolean.demo_leak`), smoke sensors (fire
by themselves every 10 minutes), the boiler and the water tank in Boiler Room
(value markers plus live text labels), the Front Door and Terrace locks,
curtains in Study, the garage gate in Yard, a TV with speakers, the kitchen
hood, the air conditioner in Bedroom, the composite Smart Plug, the
permanently unavailable Pantry Light, and the weather
`weather.demo_weather_south` (sun in the windows and the day/night cycle).
Everything is in English; the demo user's language is Auto, so the interface
follows the browser. **Smart Plug 2** is deactivated in the HA registry on
purpose — it is the ready-made example for the disabled-devices behaviour.

The public demo user is an administrator, so the full registry scenario can be
checked on the stand; a limited/read-only user needs the local harness or a
separate unprivileged user.

## What the stand cannot show

- Real Zigbee/Z-Wave hardware, real robots (Dreame/Xiaomi/Valetudo), a real
  wall tablet.
- The HACS install/update path, YAML-mode Lovelace, reinstalling the
  integration while keeping its config.
- Restarting HA from inside — blocked by `demo_guard` (the hourly container
  reset is the only «restart»).
- Anything that needs the stand's file system: broken stores, `kill -9`
  between writes, unreadable folders, watching process memory.
- Long-lived scenarios (a day-long sweep, «an hour later») — the reset comes
  first.
- A non-admin user (`admin_only`, hidden tabs) — the stand has the single
  admin `demo`.
