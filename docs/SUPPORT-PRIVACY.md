# House Plan private support reports

Updated: 2026-09-02, issue #43.

House Plan keeps normal configuration, layout and uploaded content inside the
user's Home Assistant. The support relay is contacted only after the user
presses **Send** in **Help & feedback**. Opening the dialog and building or
downloading a preview do not make an external request.

## What is sent

Every report contains the user's plain-text message, optional contact, bounded
software versions and an idempotency key. The diagnostic JSON is optional and
off by default. If selected, the integration sends the exact canonical bytes
shown in the preview together with their size and SHA-256.

The package is constructed field by field. It contains plan geometry and
dimensions, safe display settings, structural counts, validation/repair
families and bounded browser/registry capability enums. Space, room, wall,
opening, marker and binding references receive random package-local names.

It excludes original names and text, Home Assistant installation/location,
device/entity/area IDs, current states and attributes, IP addresses, hostnames,
URLs, paths, filenames, plan/backdrop/manual bytes, vacuum calibration and
trails, backup history, message and contact. Unknown fields are dropped rather
than copied and redacted later.

## Preview and authorization

Only a Home Assistant user allowed to write House Plan can build or send a
report. Preview bytes live in integration memory for at most ten minutes and
are bound to that HA user and one dialog draft. Closing the dialog, disabling
the attachment or a successful submit removes the token; process exit also
removes it. Download uses the same preview text. The backend never rebuilds an
attachment during submit.

## Transport and retention

The integration can contact only `https://support.houseplan.tech/v1/reports`.
The HTTPS host is compiled into the backend; redirects and user-configured
destinations are refused. Provider response bodies and submitted content are
not written to Home Assistant logs.

The relay writes an accepted report to its private spool before delivery to a
private maintainer channel. Delivered reports, including message, contact and
optional JSON, are retained for no more than **30 days**. Rate-limit and
idempotency records are retained for no more than **24 hours**. A daily purge
enforces both limits. No public GitHub issue or public Telegram post is created.

To request early deletion, contact the maintainer through the project's
[Telegram chat](https://t.me/ha_houseplan) and provide the report ID shown after
submission. The report ID is also the reference for follow-up; do not publish
the downloaded support package unless you deliberately choose to do so.
