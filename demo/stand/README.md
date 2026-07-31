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
