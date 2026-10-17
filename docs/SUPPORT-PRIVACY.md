# House Plan private support reports

Updated: 2026-10-17, issues #43 and #942.

House Plan keeps normal configuration, layout and uploaded content inside the
user's Home Assistant. The support relay is contacted only after the user
presses **Send** in **Help & feedback**. Opening the dialog and building or
downloading a preview do not make an external request.

## What is sent

Every report contains the user's plain-text message, optional contact, bounded
software versions and an idempotency key. The diagnostic JSON is optional and
off by default. If selected, the integration sends the exact canonical bytes
shown in the preview together with their size and SHA-256.

The selected package version is bound to that consent. An integration update
while the dialog is open cannot expand a v1 attachment to v2 on Refresh;
disable and enable the checkbox again to agree to the extended contents.

The package is constructed field by field. It contains plan geometry and
dimensions, safe display settings (the fill palette only by the eleven slot
names the card defines; any other key is dropped), structural counts,
validation/repair families and bounded browser/registry capability enums. Space, room, wall,
opening, marker and binding references receive random package-local names.

Package **v2** also includes allowlisted configuration links (areas, badges,
actions, panel structure, radar configuration and robot calibration/routes),
normalized current diagnostic statuses and value **shapes**, effective display
decisions, and a bounded sample of robot position, room anchors and paths.
Robot input/current/previous/local paths remain separate; calibration and
coordinates retain their exact relationship. They can reveal the layout of a
home, even without names. The preview lists four coverage categories and fixed
reasons for incomplete data. A snapshot is not a history or proof of every
transient problem. Older integrations produce explicitly limited **v1** reports
without these additions; v1's policy remains unchanged.

Neither version includes original names or free text, HA installation/location,
raw device/entity/area IDs, arbitrary sensor readings or raw attributes, IP
addresses, hostnames, URLs, file paths/names/bytes, backup history, message or
contact. V2 allows only fixed state enums (such as on/off/open), presence/shape
of selected data, and declared geometry—not arbitrary state/attribute values.
Radar targets, tracking IDs, presence history and heatmaps are excluded.
Unknown config fields are dropped rather than copied and redacted later;
unknown diagnostic input fields are rejected.

The Zigbee topology snapshot is never offered to this package: raw provider
payloads, IEEE addresses, neighbor links, base topics, timestamps and provider
errors stay out of support preview/download/submission and out of browser
storage and logs.

## Preview and authorization

Only a Home Assistant user allowed to write House Plan can build or send a
report. V2 additionally checks entity **read** permission before capturing facts
and again before publishing the preview and sending it. Denied facts and client
claims are omitted with an incomplete-coverage reason. A private, bounded list
of entity IDs exists only in preview memory for those rechecks; it is never
included in JSON, logs, transport or spool. Editing House Plan is not permission
to export every HA entity. Preview bytes live in integration memory for at most ten minutes and
are bound to that HA user and one dialog draft. Closing the dialog, disabling
the attachment or a successful submit removes the token; process exit also
removes it. Download uses the same preview text. The backend never rebuilds an
attachment during submit.

A valid 48-character token in a response that the card cannot adopt is also
discarded best-effort exactly once—even if the rest of the response is invalid,
the dialog changed meanwhile, or the local state update was refused. Cleanup
does not depend on whether that request is still current and never replaces the
original UI error. Malformed token strings are not sent back; backend TTL
remains the final guard if a discard transport itself fails.

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
