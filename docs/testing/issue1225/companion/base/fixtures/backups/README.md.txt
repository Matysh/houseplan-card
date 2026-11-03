# Backup fixtures

The export and import journeys (`tests/transfer-export.admin.spec.mjs`,
`tests/transfer-import.admin.spec.mjs`, houseplan-card#1010 rows 21–22) build
their backups from code in `tests/lib/backup-fixtures.mjs`. There are no
opaque binaries in git. You can read what is in each file and what is broken
in it. Every file a journey used is attached to the Playwright report, so you
can download and open exactly what was imported.

The base is the seed house as the product under test exports it (a full
export over the integration's websocket). Every fixture is therefore a plan
this product could have written itself, plus the changes listed below. The
ZIPs follow the integration's archive format (`backup_archive.py`):

- `images/<sha256>.<ext>` blobs
- `document.json`
- `zigbee.json`
- `manifest.json`, written last

Missing and external images are listed in the manifest with a reason.

## «Сложный чистый план» — `complexPlan()`, full ZIP

The seed's three spaces, the seed robot vacuum with its calibration, plus:

- stairs between the floors: one straight, one spiral
- a presence radar mounted in Kitchen & Living
- a decor picture (`fixtures/images/e2e-tile.png`), packed by its hash
- a lamp that switches another lamp (`marker:` control link)
- a Zigbee2MQTT network snapshot (coordinator and one router), with Zigbee
  links switched on
- the first floor's backdrop (the seed SVG with its room labels; see below
  for older products), under its own file name so an import never overwrites
  the seed's file

Nothing is broken, so the import preview should report nothing:

- `recovery.total` is 0
- `bindings.missing` is 0
- all content is `available`
- `confirmation_required` is false
- the archive is `complete`

Exporting it gives back the same plan, backdrop, picture and snapshot.
Restoring that export and exporting again gives the same content: the
export is idempotent.

Backdrop labels: since houseplan-card#1033 a full ZIP packs backdrops under
the backdrop upload rule, so the seed SVG travels with its `<text>` labels,
byte for byte. Older products checked backdrops against the decor-picture
SVG whitelist, which has no `<text>`, and left the seed's backdrop out as
«invalid» (findings F125); against them the fixture uses the same SVG without
its labels. The installed product's contract decides: it lists the action id
`backup-openings-details` since #1033.

## «Грязный план» — `dirtyPlan()`, full ZIP

This is the complex plan with stale references and awkward geometry.
`expected` holds what the preview must name and what the import must keep.

| Broken on purpose | The preview must name it as | After the import |
|---|---|---|
| marker bound to `entity:light.e2e_gone_lamp`, marker bound to a non-existent device | `bindings.missing: 2` («missing: 2») | both markers kept with their bindings |
| Yard room bound to area `e2e_gone_area` | `missing_areas` («Areas missing on the target») | area kept |
| radar `e2e_radar_lost` in room `e2e_gone_room` | recovery `radar` («Radars needing setup: 1») | `enabled: false`; everything else in the radar unchanged |
| robot map routed to space `e2e_gone_space` | recovery `vacuum` («Vacuums with a missing floor: 1») | `live: false`; routes and calibration unchanged |
| control link `marker:e2e_gone_marker` | recovery `controls` («Removed control links: 1») | only the dead link is removed |
| value badge derived from `marker:e2e_gone_marker` | recovery `value` («Disabled dependent values: 1») | badge `enabled: false`, `source: null` |
| decor picture whose file is not in the archive | content `missing_preserved`, archive `missing` | kept as a placeholder to repair; the import needs the confirmation box |
| Yard backdrop on `https://e2e-yard-backdrop.invalid/…` (a host that never resolves) | content `external`, archive `external` | kept as a link |
| a partition lying exactly on another one, a partition with nodes off the 1/240 grid, a room whose outline crosses itself (with matching walls) | nothing (findings F127) | kept byte for byte: nothing is «optimized» without being asked |
| a door moved far off its wall (`e2e-off-wall`, #1033 products only) | `opening_repairs.detached: 1` with the door in `examples` («Openings kept off walls: 1», under **Show openings**); the confirmation box names it | kept where it was without a wall; every other field unchanged |

«Undo last full import» must then return the previous plan exactly
(spaces, markers, layout).

Exporting the dirty plan after the import reports what is still switched
off: the radar and the vacuum (controls and values were repaired by the
import). It also reports the two images that are not included. The download
is `…-incomplete.zip` with those two images listed by reason.

## «Прежний JSON» — `oldJsonPlan()`, House Plan 1.62

This is what House Plan 1.62 wrote, the first export format:

- `export_version: 1`
- `content_manifest`
- stamped with the stored model of the plan

Inside it is the seed exactly as it is stored on disk (data model 5, before
the wall-segment model), from another Home Assistant. Two references went
stale since:

- a lamp that is no longer in Home Assistant
- a room whose area was deleted

The preview must show:

- `model_version: 5`
- «Created on another Home Assistant instance»
- `bindings.missing: 1`
- the missing area
- the first floor backdrop as «will be detached», because a JSON carries no
  files

The import migrates the plan: rooms get their wall segments, legacy spans
go away.

## Space JSON round trip

The Ground Floor is exported as a space JSON from this Home Assistant and
imported back. The preview counts the devices already on the plan
(`duplicates`), and «Skip duplicate devices» is preselected. The space is
added as a new one, with no second marker for a binding that is already on
the plan.

## Refused files

Each of these is refused with the dialog's own words, and the integration's
revisions stay unchanged:

| File | Code | The dialog says |
|---|---|---|
| a full ZIP cut at 60 % | `zip_invalid` | The ZIP backup is damaged or unsupported… |
| a PNG named `.zip` | `zip_invalid` | (same) |
| a PNG named `.json` | `invalid_json` | The selected file is not valid JSON. |
| JSON that is not a House Plan export | `invalid_format` | The selected file is not a House Plan backup. |
| JSON over 8 MiB | `too_large` | The backup exceeds the 8 MiB limit. |
| a full ZIP with a rectangle of zero width | `invalid_config` | The backup contains an invalid House Plan configuration. |
| a JSON with a door moved off its wall (products before #1033; newer ones repair it, see the dirty plan) | `invalid_config` | (same) |
