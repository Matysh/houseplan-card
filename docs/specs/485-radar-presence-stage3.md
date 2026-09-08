# #485 — Radar presence, stage 3: coverage and use of room results

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485).
Prerequisites: [stage 1](485-radar-presence-stage1.md) and
[stage 2](485-radar-presence-stage2.md). This is a proposed implementation
contract, not a claim of implementation or an independent review. Issue labels
remain authoritative. Read the [common contract](485-radar-presence.md) first.
Owner defaults Q1–Q4 are accepted; §8 specifies the bounded engineering
interpretation of the separately requested weekly heatmap, not permanent
collection permission attributed to Q3. Current instruction stops at S5-ready.

## 1. Scenario, persona, before and after

The home administrator opens the existing Device editor on a desktop after
calibrating individual radars. They want to find gaps between rooms, remove
duplicate observations in overlaps and deliberately expose a useful room result
to HA. Household members and guests continue using the quiet touch-first View.

Before: two radar marks can be mistaken for two people, and each integration's
numbers must be interpreted separately. After: the administrator checks the
selected coverage and sources on the plan; household members see a conservative
current result, with uncertainty shown instead of an invented count.

J1/J4/J6 in `docs/SCOPE.md` are the relevant jobs. This is the issue-specific
spatial-presence exception, not a general analytics dashboard, device manager
or automation builder. The full track is required: new UX and public WS/native
HA contracts, persisted optional fields, several surfaces and performance and
privacy effects all fail the `small` criteria.

## 2. Scope, non-scope and delivery boundaries

Included:

- analysis of selected calibrated radars and explicitly hypothetical sectors;
- an explicit per-radar allowed-room list, extending the single-room default;
- conservative association of overlapping Cartesian observations and short
  room handoff; no personal identity or persistent tracking;
- explicitly created integration-owned room `binary_sensor` and optional
  estimated-count `sensor` entities, independent of browser lifetime;
- optional day/week spatial aggregate heatmap with §8's separate opt-in;
- assisted reflection-line proposal from explicit correspondences, with manual
  acceptance through stage 2's existing filter preview/save contract.

Excluded: RF propagation or purchase recommendations, walls/material attenuation
simulation, floor/3D tracking, general statistics, automatic hardware changes,
HA automation/scene/script creation, management of source entities, person IDs,
cross-day trajectories, raw retention longer than 24 hours, automatic continuous
multi-day recording, CSV transfer, cloud upload, history in default View and
silently inferred room/zone/reflector geometry.

Stage 3 does not weaken stage 1/2 source freshness, exclusions, raw permissions,
single-source diagnostics or device-command confirmation. An unavailable
stage-3 capability leaves stage 1/2 working. Coverage, fusion and derived
entities do not require heatmap collection or access to saved observations.

## 3. Inspected seams and proposed implementation modules

These existing authorities were read on `issue/485-radar-presence`; names in
the proposed column are additions, not assertions that implementations exist.

| Existing seam | Stage-3 responsibility / proposed additions |
|---|---|
| `src/types.ts`, `src/config-store.ts` | Optional radar room-list/settings types and lossless revisioned writes |
| `src/houseplan-editor-runtime.ts`, `src/hp-dialog.ts`, `src/hp-confirm.ts` | Existing editor/dialog ownership; lazy `src/radar-analysis.ts` and `src/radar-analysis-view.ts` |
| `src/houseplan-card.ts`, `src/render-device-snapshot.ts` | Consume backend result without association calculations in the render loop |
| `custom_components/houseplan/websocket_api.py` (`async_register`, `_check_write`, `_runtime`) | Register bounded authenticated analysis/lifecycle commands |
| `custom_components/houseplan/auth.py` (`may_write`) | Existing write policy; no separate radar ACL |
| `custom_components/houseplan/store.py` (`HouseplanData`, `create_data`) | Separate versioned operational/aggregate stores and conflict protection |
| `custom_components/houseplan/__init__.py` (`async_setup_entry`) | Set up/unload authoritative coordinator and new native entity platforms |
| `custom_components/houseplan/validation.py`, `import_export.py`, `projection.py`, `support_package.py`, `diagnostics.py` | Delta validation, transfer policy, privacy projections |
| `custom_components/houseplan/virtual_lights.py`, `trails.py` | Existing operational-lifecycle precedents only; do not reuse vacuum records for people |
| New backend modules | `radar_fusion.py`, `radar_analysis.py`, `radar_heatmap.py`, `radar_room_outputs.py`, `binary_sensor.py`, `sensor.py` |
| `src/i18n/en.json`, `src/i18n/ru.json`; backend `strings.json`, `translations/en.json`, `translations/ru.json` | Keys listed in §12, translated native names/errors |

Currently this integration initializes storage and a trail recorder; it does
not already expose the proposed room entity platforms. Their config-entry
platform lifecycle is new work. Do not implement derived entities by writing
arbitrary state through REST, editing `.storage` directly, generating templates
or creating YAML automations. Native entity values are memory-backed and
subscription-driven; stable unique IDs register them normally. See
[HA entity contract](https://developers.home-assistant.io/docs/core/entity/) and
[HA entity registry](https://developers.home-assistant.io/docs/entity_registry_index/).

## 4. UX and permissions

Entry: **Device editor → Presence on plan → Additional tools → Coverage and
room results**. The primary House Plan panel and full dashboard card share it.
No fourth editor, permanent console, automatic dialog on upgrade or extra View
toolbar. The compact Room View renderer is not extended by this stage. The
selected workspace replaces the device properties with a large
plan and one compact contextual panel; Back returns to the same device.

1. **Coverage:** select actual sources; only those sources' sectors and their
   physical installation anchors appear. **Add trial sector** creates a dashed,
   explicitly hypothetical in-session shape, not a Marker, HA entity or device.
2. **Allowed rooms:** a named multiselect, initially the stage-1 room. Save
   previews newly included/excluded observed points and affected room outputs.
3. **Combine observations:** select a group, inspect separate/associated marks,
   run the short commissioning check and explicitly enable its result. Details
   explain ambiguity without exposing tuning coefficients to the ordinary user.
4. **Create room sensors:** choose rooms and exact sources, preview names,
   signal types, uncertainty and external retention warning, then confirm.
5. **Heatmap:** a separate opt-in collection action and day/week selector; never
   implied by opening analysis, viewing coverage or starting a stage-2 raw run.
6. **Reflection suggestion:** explicitly choose pairs, inspect a proposed line,
   then use the existing stage-2 excluded-side preview and Save. Nothing applies
   while merely selecting pairs or asking for a suggestion.

View remains current-only. Association changes marks, not source-marker tap
actions. The full card/panel's room information may show **Presence detected**, **No presence detected**,
**Estimated people: 2**, or **Estimate unavailable**; it never says the home is
definitively empty. No global house count is introduced. When association is
ambiguous, keep independent source marks and say **Observations cannot be
combined reliably** in details, not a confident sum. Optional counts always
retain the word **Estimated**; source slots are not named people.

All analysis, raw witnesses, aggregate history, settings and start/stop/clear
commands require `may_write` on the server. Ordinary authenticated users retain
only the stage-1 safe live projection and current room summaries. Existing HA
permission policy controls access to explicitly created native entities; House
Plan does not promise its private-history ACL can hide HA entity state.
Source reads and preview/create validation also enforce the calling user's HA
entity-read permissions; `may_write` alone cannot authorize another entity.
Persisted derived-output authorization does not relax source access controls.

Native entity creation/removal additionally requires HA admin permission because
it changes integration-owned registry lifecycle. A House Plan editor who is not
an HA admin may prepare the plan result but sees a clear **Ask an HA
administrator to create entities** message. No inferred grant from client UI.

Touch editor: **best effort / intentionally degraded** for precise geometry and
pair selection, with desktop recommendation. View/kiosk remain fully supported:
44 px effective actions, no hover dependency, no hit interception by marks,
room/device actions and pan/pinch preserved. At 360 px the analysis controls and
room information stack vertically. Escape/Back and canceled/multi-touch
gestures cannot accept settings, create entities or start collection.

## 5. Coverage and allowed-room contract

Geometry uses the existing canonical plan/centimetre conversion and physical
`radar.mount`, never the decorative marker layout. Coverage is the union of
selected geometric sectors clipped to the union of explicitly allowed room
polygons. The label is always **Indicative geometric coverage — not a guarantee
of detection**. Wall/furniture geometry is context only: no ray-through-wall
claim, RF shadow, attenuation or confidence score.

- Use verified angle/range only when actually provided; otherwise require an
  explicit administrator estimate labeled **Manually estimated**. Missing
  parameters mean **Coverage unknown**, not a filled default sector.
- Trial sectors have an explicit manual origin/direction/range/angle. At most
  8 per analysis session, discarded on exit/reload; no purchase or connection
  implication. Actual and trial coverage totals are separate and never combined
  under the word **Installed**.
- Optional uncovered area is the geometric difference inside the selected
  valid polygons, in the same measured units as the plan. It says nothing about
  detection probability. Exclude rooms without valid contours from the numeric
  denominator and list them as unknown; never invent a raster-room boundary.
- `marker.radar.allowed_room_ids` absent means the stage-1 `room_id` singleton;
  an explicit empty array means no rooms, not inheritance. Maximum 32 unique
  existing room IDs, all in the radar's space. Known polygon boundaries are
  authoritative. Unknown/missing room IDs survive unrelated writes but are
  inert and visibly require repair; they are not retargeted by name or HA Area.
- With the list absent, preserve the complete stage-1 single-room behaviour:
  an existing room without a contour still allows calibrated unclipped live
  observations with its warning; a missing room reference suspends output.
  Stage 3 does not turn the former into the latter. For an explicit multi-room
  list, a contourless room contributes no invented boundary or assignment:
  coverage and point-derived room attribution/count remain unknown where the
  required real polygons are absent. Exact room-mapped binary evidence remains
  usable under its own contract; it does not invent coordinate membership.
- At a point within 10 cm of more than one allowed room boundary, retain its
  visible observation but mark room assignment uncertain. Do not count it in
  two rooms. This boundary band is measured in centimetres, not screen pixels.
- Room-only/zone-only presence is attributed only to an explicit exact room
  mapping. A single broad occupancy signal allowed across several rooms does
  not turn every room on; room attribution is unknown. Range-only data likewise
  cannot become Cartesian points or room counts.

Editing allowed rooms invalidates the affected fusion/output revision and any
active analysis preview. It does not change source HA states or hardware zones.
Any newly allowed room requires explicit Save; room split/merge, Area changes,
imports or discovery never expand the list silently.

## 6. Conservative association, count and room handoff

### 6.1 Input and bounds

One backend coordinator consumes the normalized stage-1 frame: source identity,
`source_generation`, `calibration_revision`, `server_session_id`, `seq`, report
times, `pair_quality`, availability and raw/projected centimetre targets. Apply stage-2 room/reflector exclusions
through the same authoritative projection before fusion. A frontend must not
merge another time, retain stale coordinates or supply its own accepted frame.

At most 4 enabled groups per installation, 2–8 radars per group and at most 8
slots per radar under the common 32-radar ceiling. A radar belongs to one enabled
group only. Group sources must share one space and calibrated metric frame;
cross-floor groups are invalid. Only valid Cartesian observations participate;
range, raw count, occupancy and zone-only sources are not point substitutes.

Evaluate at most 4 Hz. Preserve the source's `pair_quality`; geometric agreement
does not upgrade `bounded_latest` to `coherent`. There are two explicit branches:

- **Coherent:** only a verified adapter-provided sample sequence/time establishes
  atomic pairs. Use shared-time normalized sample skew ≤250 ms when the adapter
  can prove comparable clocks, candidate distance ≤60 cm and at least 3 distinct
  accepted sample witnesses from each participating radar spanning ≥500 ms.
  Coherent local pairs without comparable cross-source clocks use the bounded
  estimate branch below; do not invent clock synchronization.
- **Bounded-latest estimate:** the normal independent-HA-entity path, including
  `esphome_ld2450_v1`, is eligible for conservative estimated association after
  commissioning. Every axis retains Stage 1's ≤3 s report age and ≤1.5 s
  within-pair report skew. Compare the report interval from oldest to newest
  axis; intervals must overlap or be separated by ≤250 ms, and their latest
  report times must differ by ≤1.5 s. Candidate distance is ≤40 cm, with at
  least 3 distinct accepted pair witnesses from each participating radar
  spanning ≥2 s and mutually unique candidates throughout. These are report-
  time estimates, not atomic measurements or a physical-freshness claim.

A distinct witness requires a new source report/sample tuple and frame sequence
in the same server session/epoch; reevaluating one cached frame three times is
one witness. For independent X/Y the tuple includes both axis report times.
Health-only frames and reordered/duplicate delivery cannot add witnesses. No
branch extends Stage 1's leases or synthesizes an unchanged axis: stationary
suppressed reports, expired axes, inadequate new samples or temporal ambiguity
retain separate valid observations and an unknown affected count. Mixed-quality
groups use the bounded estimate branch and expose that quality in details.

Build a 60 cm spatial grid per selected group and examine local neighbours.
At most 8 candidate neighbours per observation. Exceeding that cap marks the
local component ambiguous; do not truncate candidates and choose whichever
arrived first. No all-installation Cartesian pair matrix or unbounded assignment
search. Compute at most 64 active observations/group, at most 512 directed
candidate edges/group/evaluation.

### 6.2 Association rule

Merge only mutually unique candidates from different radars after the temporal
witness above. Each resulting component contains at most one observation per
source, and every pair of its members must satisfy the candidate rule: A–B and
B–C never imply A–C without evidence. Use the deterministic median projected
position, keeping provenance internally; neither nearest-source tie-breaking
nor a slot number is evidence of identity.

Near-equal alternatives, two close real people, crossing paths, duplicated slots
from one radar, excessive report/sample skew, missing required report metadata, saturation, stale frame
or source/config epoch change immediately invalidate the affected association.
Fallback is separate valid observations and unknown affected count. Never
silently choose the lower count, the higher count or a fractional person.

Commissioning is explicit per group: one-person traversal of each intended
overlap followed by two simultaneously detected separated targets. It combines
an explicit user's attestation about this physical exercise with backend proof
that the required distinct frames, source epochs, pair quality, uniqueness and
separated-target observations actually occurred. A client boolean alone cannot
commission a group, and backend samples cannot prove the user's physical claim.

The commissioning inspect API in §11 starts a user-requested ephemeral capture
for one selected saved group, at most 8 radars and 30 seconds per single-target
or separated-target phase. At most one capture/user and four globally. Each
phase requires the branch-specific distinct-frame proof for every participant;
the separated phase must show two simultaneous targets at least 120 cm apart,
without merging them. Every intended overlap must have a witnessed comparison;
otherwise return an incomplete proof and keep count ineligible. Allow explicit
repeat of the missing phase; never silently continue a capture beyond 30 s.
Keep only bounded proof summaries after a phase, not a retained path; summaries
expire after 10 minutes, at most two/group and four groups/user. Detailed
in-memory capture is discarded on completion/cancel, disconnect or epoch change.
It starts neither a stage-2 raw run nor heatmap collection.

Accept takes the user-bound proof token and explicit attestation, rechecks
source read/write permissions and config revision, and computes the accepted
fingerprint from server-owned group/source/calibration/filter/room epochs and
algorithm version. Save a server-issued receipt and summary in config through
the existing revisioned config transaction, not coordinates or the person's
path. Generic config/set cannot mint/alter that receipt; unchanged server-issued
metadata round-trips, and changed/imported group metadata loses eligibility.
Any changed fingerprint input suspends count until a repeated check. Passing
commissioning permits only the corresponding coherent/bounded estimate branch,
never promotes source quality or certifies future identity; live guards remain.

### 6.3 Room state and count

Presence is three-valued per room:

| Evidence | Current room presence |
|---|---|
| Any valid positive Cartesian target strictly assigned to this room, or exact room-mapped positive occupancy/zone source | `on`, even if another selected source is unavailable; detail says partial if appropriate |
| Every configured evidence source provides an explicit negative under its own Stage-1 health contract | `off` = no presence detected, not proof of emptiness |
| No valid positive, and any required source is stale, missing, partial, unmappable or unable to assert a negative | `unknown`; never convert missing to `off` |

Binary occupancy/zone inputs use the current HA on/off/unknown/unavailable and
bound-availability semantics from Stage 1; they do not receive a 3-second report
lease or a requirement for recurring state transitions. Coordinate `complete`
and report leases apply only to coordinate evidence/count. Thus a long-unchanged
but available exact room-mapped binary off can be valid negative evidence,
while an expired coordinate slot cannot. Raw zone counts remain diagnostic
inputs, not permission to infer a person count or fabricate complete geometry.

Estimated count is an integer only when every configured count-contributing
source is eligible, complete and fresh, commissioning matches the epochs, no
unresolved candidate/boundary/handoff exists, and no source is at its maximum
reported target capacity. Then count the independent/confirmed-associated
observations assigned strictly to that room. Zero requires the same complete
negative evidence. Unsupported or uncertain count is `null`, not zero, and is
never inferred from occupancy or a distance. Count and presence have separate
availability: presence can validly be on while count is unknown.

### 6.4 Handoff without identity

A short-lived association token is an implementation detail, never a user or
person ID. It exists only in backend memory, expires after 2 seconds without
valid support and is reset at restart, gap or epoch change; it is never stored
in config, raw history, aggregates, HA attributes or exported diagnostics.

Across adjacent allowed room polygons in the same space, a unique continuation
may keep the visual mark continuous only when the gap is ≤1 second, speed is
≤250 cm/s and the crossing passes a known door/passage or zero-thickness shared
boundary. No through-solid-wall or cross-floor handoff. A nonexistent opening
or unknown room topology means separate observations, not inferred movement.
Room count becomes unknown during a boundary-band or ambiguous handoff; do not
add one to both rooms or animate a line over a gap. A valid fresh positive
already inside the destination may establish its presence independently. No
long path joins and no promise that a reappearing mark is the same person.

## 7. Optional native Home Assistant room outputs

### 7.1 Explicit lifecycle

**Create room sensors** previews each exact room, sources, proposed friendly
names, occupancy/estimated-count selection and these warnings: outputs are
derived/estimated, may become unknown, HA Recorder and external consumers may
retain their states independently, and no automations are created or changed.
The estimated-count checkbox is available only for an eligible commissioned
Cartesian group. Occupancy-only creation remains useful independently.

Use integration-owned `BinarySensorEntity` with presence device class and
`SensorEntity` with integer native value, no invented device class, no
`total_increasing`/measurement statistics contract and no personal attributes.
They are push-updated only on semantic result changes, at most 1 state write/s
per entity. Unchanging coordinates do not force HA writes. Names use native
translation keys and the room label as a placeholder, not hardcoded English.

Assign a random persistent output UUID at confirmed creation. Unique IDs are
`houseplan_<config_entry_id>_radar_room_<output_uuid>_presence` and `_count`;
they never contain a mutable room name, source entity ID or array position.
Registry-chosen `entity_id` is returned after creation rather than promised
from a suggested slug. HA-owned user customizations are preserved.

- Creation requires an unexpired user-bound preview plus current config/output
  revisions, server revalidation and HA admin + `may_write`. At most 32 room
  definitions / 64 native entities. Repeating the same operation ID is
  idempotent; conflicting content with the same operation ID is rejected.
- Persist desired integration-owned outputs before registry reconciliation;
  report `active`, `pending` or `failed`, not atomic success for a partial
  platform error. Reconciliation only retries already explicitly authorized
  definitions. Reconnect/retry/restart cannot create duplicate unique IDs.
- HA restart/unload starts values unknown/unavailable until current source
  evidence arrives. Never restore last night's count as a current state. Normal
  setup recreates runtime entity objects for authorized registry entries, not
  new entities. Unload removes subscriptions/tasks; disabling a native entity
  in HA is respected and House Plan never re-enables it.
- Changing a room name, decorative icon or source order preserves output UUID,
  native entity ID and HA custom name. Changing input sources or room geometry
  preserves identity but invalidates proof and temporarily suspends count.
- Deleting a source/room or losing a binding suspends the affected output and
  shows Repair; do not retarget it or delete its HA registry entry implicitly.
  Generic config writes/imports cannot grant or recreate output authorization.
- **Remove created entities** is a separate confirmed preview with exact owned
  entity IDs and warning about dependent automations/dashboards. Known
  references are shown when inspectable, never claimed exhaustive. Only the
  entries matching this integration, config entry and recorded UUID are
  removable. Source entities and unrelated same-name entities are untouchable.
  Persist tombstones first; on partial failure retain a retryable pending
  removal. A restart cannot resurrect a tombstoned definition.
- Turning off live display does not stop outputs. **Disable room processing**
  stops computation and makes outputs unavailable, retaining identities. To
  delete entities the administrator must use explicit Remove. Removing the
  integration uses the normal HA config-entry lifecycle, never a custom sweep
  of the user's registry or automations.

### 7.2 Unknown versus unavailable

Connected and functioning computation with insufficient/ambiguous evidence:
binary value `None` or sensor native value `None` with `available=True`, shown
by HA as `unknown`. Integration disabled/unloaded, coordinator failure or no
reachable configured input at all: `available=False`, hence `unavailable`.
Partial input loss with no positive gives unknown; a valid positive can keep
presence on, but cannot rescue an ineligible count. Keep only a short bounded
reason-code attribute; no coordinates, history, source slot IDs or timestamps
updated every frame. The native state must match the backend room snapshot.

## 8. Optional heatmap: separate opt-in and bounded retention

The issue explicitly requests local opt-in day/week heatmaps. Retaining coarse
aggregate cells for at most seven days is the bounded engineering interpretation
of that weekly mode. It is not an assertion that Q3 authorized seven-day raw
history or continuous collection: Q3's stage-2 raw TTL ≤24 hours and run ≤24
hours remain unchanged. Coverage, fusion, reflection assistance and room outputs
do not depend on heatmap collection.

Default: **off**, editor-only (`may_write`) manual opt-in for each bounded
session; default 1 hour, choices 5/15/60/1440 minutes, no run over 24 hours, no
automatic repetition, no resumed run after HA restart. Closing a browser does
not stop a consented server run. Starting a new session always requires the
visible retention notice and explicit action, even if an earlier session exists.

The notice states: **Only aggregate cells, stored locally for up to 7 days. No
personal IDs or paths. Collection continues with this page closed until {end}.**
Provide current end time, Stop and separately confirmed **Delete heatmap data**.
Turning the display layer off does not stop collection; that difference is
stated beside Stop. Revoking an initiating user's current write privilege or
disabling the integration interrupts that run; it does not grant another
client ownership or auto-resume later.

Minimal data contract:

- Consume accepted current projected observations directly. A heatmap session
  does **not** start or extend a stage-2 raw recording. Raw points, if separately
  requested under stage 2, remain on their ≤24-hour TTL and separate controls.
  No expired raw data is kept to permit later reaggregation.
- Grid: fixed 50 cm square cells anchored in canonical centimetre space; sparse
  HA-local calendar-day buckets with explicit UTC start/end and timezone.
  Persist only cell presence-observation seconds, collection
  seconds, source-coverage completeness seconds, bucket date and a non-personal
  geometry/source/filter epoch fingerprint. No target/track IDs, per-observation
  timestamps, slot IDs or ordered paths. Multiple valid marks in one cell in
  one sampling second increment presence by one, not by the number of marks.
- At most one sample per second; cap credit for any interval at 1 second.
  Missing/invalid data contributes to missing coverage, never a continuation
  of the last point. A cell outside known selected geometric coverage has no
  denominator. Value is **Seconds with an observation / seconds with usable
  coverage**, not percentage of time a named person spent there.
- UTC boundaries distinguish 23/25-hour local days without duplicate buckets;
  day/week UI uses the saved HA timezone and explains actual included dates.
  A timezone change closes the active session and starts no replacement; old
  buckets remain under their recorded timezone. Buckets are deleted at age 7×24 hours based
  on bucket start (conservative early expiry, never late). Sweep before every
  read and on startup plus hourly; expired data is immediately unqueryable.
- Maximum 4 concurrent aggregate sessions, 32 radars total, 20,000 occupied
  cell/bucket records per space and 32 MiB physical aggregate store total.
  Bound admission before allocation. At quota stop affected collection with a
  visible reason; do not silently evict nonexpired records or reduce resolution.
- Same cell contributions from selected overlapping sources are unioned per
  second, not summed. A failed fusion does not justify a people heatmap: keep
  the observation-based label. Calibration/source-generation/room/filter changes
  close the current epoch; old epochs are separately selectable and never
  silently reprojected or stitched. Require a new explicit session after such
  a change. A changed plan scale cannot move historical bins without raw data.
- A week aggregates only actually consented sessions. Show recorded hours,
  unavailable hours, calendar span and **Incomplete coverage**; no smoothing
  across gaps, false seven-day completeness or conversion of calibration
  samples into an automatically collected week. Restart truncates only the
  active partial aggregation interval; completed saved buckets remain.
- Raw/aggregate stores are excluded from House Plan full/space/plan-only export,
  support bundles, logs, diagnostics, telemetry and native HA attributes. No
  cloud transport. Aggregate read APIs require `may_write`, as do raw APIs.
- Clear is revisioned, bounded and installation-wide for the explicitly selected
  scope; cancel does nothing. Its confirmation explicitly says that matching
  active aggregate sessions will stop. Persist that stop and a clear tombstone
  in the same operation before deleting buckets. It deletes the matching aggregate buckets only,
  not raw samples, calibration, zones, fusion or native entities. Stop is not
  Clear. A tombstone prevents late flush/reconnect from recreating cleared data.

House Plan TTL is not a claim about copies in operator-managed HA filesystem
backups or independent HA Recorder history of created entities. This limitation
must appear in the privacy help. House Plan backup/export never embeds these
stores; document how to exclude operational data from backup integrations that
offer such a hook, and never advertise deletion of external backup copies.

## 9. Reflection-plane assistance: proposal, never automatic filtering

This extends stage 2's manual reflector workflow, not firmware processing.
In one selected radar/epoch, an administrator marks at least 3 correspondence
pairs: a believed direct observation and its believed reflected observation.
Pairs must come from at least 3 spatial clusters separated by ≥75 cm, not three
samples of one stationary pair. At most 20 pairs; at least one pair is reserved
as a hold-out witness and does not fit the line. Thus acceptance requires at
least 4 pairs when exactly 3 fitting clusters are used.

For the 2D mirror-line hypothesis, each pair's midpoint must lie on the proposed
line and its connecting vector be perpendicular. Fit the unit-normal line to
the fitting pairs; require reflected-point residual ≤20 cm for every fit and
hold-out pair, no degenerate <30 cm pair separation, and a common line direction
within 10°. Show residual and pair count, not a made-up confidence percentage.
The hypothesis is unsupported if these conditions do not hold. A successful
fit is still not proof of a physical mirror or that a removed point is false.

An optional **Find candidate pairs** action may offer mutually time-matched
pairs (≤250 ms) from the selected retained stage-2 sample, with the same witness
rules. It is user-invoked, editor-only and bounded to 2,000 sampled observations,
20 proposed pairs, 100 tested line hypotheses and 2 seconds of work; on limit
return **Insufficient evidence** rather than taking the best weak candidate.
Never initiate recording or extend raw TTL. The administrator confirms each
correspondence; candidates are not applied automatically.

Multiple real people, symmetric furniture, moving objects and multipath can
produce false positives. The result screen says so and shows both kept and
excluded sample points with the stage-2 side-of-line warning. **Use this line**
creates an unsaved stage-2 reflector draft; the separate stage-2 Save, current
config revision and exclusion preview remain mandatory. Cancel, expiry,
insufficient witnesses or changed epoch changes nothing. No unattended
background mirror search, hidden filter or HA source-state mutation.

## 10. Persisted model, operational state and compatibility

The stage-1 marker object stays `radar:{version:1,enabled,show_live,profile,
sources,mount,room_id,calibration}`; stage 2 adds `zones`/`reflectors`. Stage 3
adds optional `allowed_room_ids` without renaming or repurposing those keys.
No personal tracking key is added to Marker or layout.

Proposed additive global settings object:

```text
settings.radar = {
  version?: 1,
  show_live: true, // existing common display preference, preserved unchanged
  fusion_groups: [{id, enabled, space_id, marker_ids, commissioning}],
  room_outputs: [{id, space_id, room_id, marker_ids, fusion_group_id?, presence, estimated_count}]
}
commissioning = {receipt_id, attested:true, algorithm_version, pair_quality,
  checked_source_epochs, checked_config_fingerprint, distinct_frame_proof_summary}
```

Only newly created fusion-group and output IDs are immutable nonempty UUIDs;
existing space/room/marker references retain their exact current identifiers,
not a new UUID syntax requirement. An output's room must exist in its explicit
space, and all its selected markers/groups must belong to that same space.
Array ordering is presentation only. Optional `settings.radar.version` is an
additive stage-3 extension: absence remains valid, preserves the stage-1
`show_live` behaviour and needs no load migration. A future unsupported extension
version makes only its stage-3 fields inert, not the independent stage-1 display
preference. The backend computes commissioning epochs/fingerprint/proof and
issues the receipt through §11; accepting arbitrary client-written proof is
forbidden. `attested` records the user's explicit exercise confirmation, not
sensor proof that a known number of real people were present.
`room_outputs` are definitions, **not authority to create HA entities**. A
separate versioned `houseplan.radar_outputs` Store retains explicitly granted
local output UUIDs, relevant config fingerprints, lifecycle revisions and
create/remove tombstones. Generic config edits/imports cannot manufacture that
grant. Do not persist live results as current truth across restart.

Separate `houseplan.radar_heatmap` storage holds the opt-in run metadata,
coarse aggregates, revision and clear tombstones, with the bounds in §8. Raw
history remains solely the stage-2 bounded store. Analysis trial sectors,
pair-selection witnesses and fusion tokens are session/runtime memory only;
no `settings` autosave per frame.

Register every new persisted path in `scripts/config-field-registry.mjs` with
absent/off defaults, consumer, delta-validation and transfer rule. Reads are
lossless and side-effect free. New/changed known values validate strictly and
atomically with `expected_rev`; untouched unknown/future fields survive
unrelated writes. Unsupported version is inert with a capability explanation,
not coerced to version 1. Do not bump the plan geometry model or rewrite old
files just to add optional radar state; new independent stores start at v1.

Full same-instance config transfer retains definitions and stable IDs, but
never active collection or raw/aggregate contents. Restoring changed definitions
suspends mismatched output grants for explicit reconciliation. Foreign/full or
space import remaps internal marker/room/group references, drops out-of-scope
links with a preview count, invalidates commissioning and imports outputs as
inactive drafts with new local UUIDs. No automatic native-entity creation,
recording, resume or cross-instance authorization. Plan-only transfer includes
none of these source-dependent fields.

Room/source deletion never maps by display name. Reconciliation suspends
affected outputs and prunes only runtime references; durable user definitions
remain repairable until explicit removal. Source-generation, calibration,
filter or room-boundary revision changes invalidate previews and epoch proof.
Merely moving the decorative icon or changing the theme does neither.
Use the common source-identity boundary: binding/unit/axis/owner-space changes,
physical mount x/y and the physical `installation_id` affect source generation.
Accepted heading/mirror corrections affect calibration revision. Explicit
**Change installation** creates a new installation UUID even at identical saved
coordinates. Stage 3 consumes these server-owned epochs rather than recomputing
them from a wider/narrower client field set.

| Frontend/backend | Required behaviour |
|---|---|
| Old frontend + new backend | Ordinary stage-1/2 data survives; absent stage-3 controls do not enable anything; unauthorized config loss cannot erase active grants silently |
| New frontend + old backend | Absent fresh capability = no stage-3 writes or fake local-success fallback; stage-1/2 usable |
| New frontend + new backend | Backend revisions/epochs authoritative; identical results across clients and native entities |

Before permanent downgrade, Stop/Clear optional collection and Disable/Remove
native outputs in a capable version. Older backend ignores new operational
stores but cannot enforce their expiry while absent: do not downgrade with
retained privacy data and promise continuing TTL. Re-upgrade purges expired
data before any read and never resumes collection. An older editor may drop
unknown fields if it reconstructs their parent; document this limitation and
preserve read-only backup before such editing.

## 11. New WebSocket contract, consistency and budgets

Proposed names are explicit new APIs, not existing endpoints. Advertise the
common fresh `radar_stage3_api:1` capability in `houseplan/config/get`, in addition
to the stage-1/2 capabilities. Cached/local config never grants a capability. Reconnect,
missing field or downgraded backend revokes it and stops requests.

| Proposed command | Request / response and authorization |
|---|---|
| `houseplan/radar/analysis/preview` | `expected_config_rev`, selected marker/room IDs, ≤8 trial sectors → bounded coverage and proof/unknown reasons; `may_write`, memory-only user-bound token, TTL 60 s |
| `houseplan/radar/analysis/reflection_candidate` | Selected radar/epoch and bounded explicit witness IDs → line/residual/excluded preview; `may_write`, no mutation |
| `houseplan/radar/commissioning/inspect` | saved group ID, phase `single`/`separated_pair`, `expected_config_rev`, explicit capture request ≤30 s → bounded server-computed phase proof and user-bound token; `may_write` + every source read permission, no persisted recording |
| `houseplan/radar/commissioning/accept` | group ID, matching unexpired phase-proof tokens, explicit `attested:true`, current config revision → server-issued commissioning receipt via revisioned config transaction; same permissions rechecked; no client-supplied epochs accepted |
| `houseplan/radar/rooms/subscribe` | ≤32 exact `{space_id,room_id}` references → safe current `{server_session_id,seq,revision,config_rev,space_id,room_id,presence,estimated_count,reason,expires_at}`; authenticated plus all contributing-source read ACLs, no raw payload |
| `houseplan/radar/derived_entities/preview` | Explicit create/remove definitions + config/output revisions → exact owned IDs, operation diff and user-bound token; admin + `may_write` |
| `houseplan/radar/derived_entities/apply` | token, operation UUID and revisions → durable lifecycle revision plus per-output active/pending/failed states; same authorization rechecked |
| `houseplan/radar/heatmap/start` | exact source/room selection, duration, consent version, config/store revisions → run ID/end time; `may_write`; separate from raw recording |
| `houseplan/radar/heatmap/stop` | exact run ID and revision → stopped/interrupted metadata; `may_write`; idempotent |
| `houseplan/radar/heatmap/get` | bounded space/epoch/date range ≤7 days and cursor → ≤2,000 cells/page plus gaps/denominator; `may_write` |
| `houseplan/radar/heatmap/clear/preview` | exact space/epoch/date scope and store revision → matched bucket/run counts plus user-bound token; `may_write`, read-only |
| `houseplan/radar/heatmap/clear` | preview token, exact scope, expected revision, operation UUID → deleted scope/new revision; `may_write`, explicit confirmation |

Room subscriptions inherit Stage 1's per-source ACL checks on every publish and
at least once per minute even without source events. If any contributing source
is restricted, withhold the entire room result as restricted; never silently
recalculate a different result from the visible subset or expose restricted
source IDs. Native entities retain the separately disclosed HA entity ACL.
Use the same server-session/monotonic-sequence and revision validation, clear on
disconnect/reconnect, bounded latest-wins delivery and immediate health/clear
transitions as Stage 1. Coordinate-derived room output expires no later than
its contributing coordinate leases, including transport age; browser expiry
clears that result if WS dies. Binary-only results use their native state health,
not coordinate leases, but still clear on connection loss or access revocation.

Use existing config writes for saved lists/groups/reflector drafts, not a
second unrevisioned config path. Commissioning accept is a server-validated
operation using that same transaction helper and `expected_config_rev` barrier;
it is the sole writer of accepted proof metadata. Collection APIs use their independent store
revisions. Serialize config/operational lifecycle reconciliation; avoid a
half-written grant or clear-then-late-flush resurrection. A transaction fails
before mutation on stale preview, wrong user, lost privilege, revision/epoch
change, unavailable capability or quota. Return stable localizable reason codes
without raw points in errors. Exact retry is idempotent; reused operation ID
with different content fails `operation_conflict`.

Analysis request ≤128 KiB; read/preview response ≤512 KiB; max 4 live preview
tokens/user and 16/installation, expiry 60 s. No auto-enlarged request to bypass
limits. Subscriptions coalesce to current snapshot, max 4 Hz and bounded one
pending snapshot/connection; slow clients receive current state instead of an
unbounded backlog. Unsubscribe, disconnect, page hidden and editor exit release
unneeded UI consumers; explicitly authorized backend outputs/runs continue.

Performance witnesses use maximum accepted configuration (32 radars, four
groups, 256 live slots) and pathological concentrated points. Association
candidate work must remain inside §6 bounds; ≥60 seconds synthetic playback
must show bounded memory/queues. No analysis/heatmap module joins the initial
View graph; preserve `npm run bundle:budget`. On overload skip obsolete frames,
publish unknown with a reason, and recover without inventing intermediate data.

## 12. i18n inventory (EN/RU)

Frontend keys beneath `radar.stage3`; backend reasons use stable codes and
translated strings. Use the existing locale formatter for date/time, area,
distance and counts. These are new keys, not a claim they already exist.

| Suffix | English | Русский |
|---|---|---|
| `tools` | Coverage and room results | Покрытие и результаты по комнатам |
| `coverage` | Indicative geometric coverage | Ориентировочное геометрическое покрытие |
| `coverage_hint` | Not a guarantee of detection | Не гарантия обнаружения |
| `coverage_unknown` | Coverage unknown | Покрытие неизвестно |
| `manual_estimate` | Manually estimated | Задано приблизительно вручную |
| `trial_add` | Add trial sector | Добавить пробный сектор |
| `trial` | Trial sector — not a connected device | Пробный сектор — не подключённый датчик |
| `allowed_rooms` | Allowed rooms | Разрешённые комнаты |
| `combine` | Combine observations | Объединять наблюдения |
| `ambiguous` | Observations cannot be combined reliably | Наблюдения нельзя надёжно объединить |
| `check_required` | Check this group again | Повторите проверку группы |
| `presence_on` | Presence detected | Присутствие обнаружено |
| `presence_off` | No presence detected | Присутствие не обнаружено |
| `count` | Estimated people: {count} | Оценка числа людей: {count} |
| `count_unknown` | Estimate unavailable | Оценка недоступна |
| `create_outputs` | Create room sensors | Создать датчики комнат |
| `remove_outputs` | Remove created entities | Удалить созданные сущности |
| `external_retention` | HA and other consumers may retain these states separately | HA и другие потребители могут хранить эти состояния отдельно |
| `admin_required` | Ask an HA administrator to create entities | Попросите администратора HA создать сущности |
| `pending` | Application pending | Применение ожидается |
| `repair` | Review the room and sources | Проверьте комнату и источники |
| `heatmap` | Heatmap | Тепловая карта |
| `heatmap_start` | Start aggregate collection | Начать сбор агрегированных данных |
| `heatmap_notice` | Aggregate cells only, up to 7 days; collection ends {end} | Только агрегаты по ячейкам, до 7 дней; сбор до {end} |
| `heatmap_incomplete` | Incomplete coverage | Неполные данные |
| `heatmap_clear` | Delete heatmap data | Удалить данные тепловой карты |
| `observed_seconds` | Seconds with an observation | Секунды с наблюдением |
| `usable_seconds` | Seconds with usable coverage | Секунды с доступными данными покрытия |
| `reflection_suggest` | Suggest a reflecting line | Предложить отражающую линию |
| `insufficient` | Insufficient evidence | Недостаточно наблюдений |
| `reflection_warning` | This can also exclude real targets | Это может исключить и настоящие цели |
| `reflection_use` | Use this line | Использовать эту линию |
| `quota` | Collection stopped: storage limit | Сбор остановлен: лимит хранения |
| `interrupted` | Interrupted; restart manually | Прервано; запустите вручную |
| `conflict` | Settings changed; refresh the preview | Настройки изменились; обновите предпросмотр |

Add backend `entity.binary_sensor.radar_room_presence.name` / RU
`Присутствие — {room}` / EN `Presence — {room}`, and
`entity.sensor.radar_room_estimated_people.name` / RU `Оценка числа людей — {room}`
/ EN `Estimated people — {room}`. Translate `unknown`, `unavailable` through HA
native state semantics; do not output the English literal as a numeric value.

## 13. Acceptance criteria and negative witnesses

The named test files below are proposed implementation deliverables. No test
run is claimed by this docs-only task. Each protective AC requires the named
negative mutation/input to fail; a passing happy path alone is insufficient.

| AC | Observable contract | Proof required | What must make the proof red |
|---|---|---|---|
| S3-1 | Opening/closing coverage does not change config, hardware or View; trial sectors are marked hypothetical | unit `radar-analysis`; smoke `radar_stage3` | Persist trial sector or invoke service from preview |
| S3-2 | Coverage distinguishes known/manual/unknown and never treats walls as RF simulation | unit geometry fixtures + golden | Fill unknown sector or include unknown room in area denominator |
| S3-3 | Explicit allowed list, empty list, missing/deleted room and boundary assignment follow §5 | backend + unit cross-language fixtures | Fallback from empty list; expand list after split/rename; assign boundary to two rooms |
| S3-4 | Coherent and bounded-latest branches retain source quality and combine only mutually unique candidates supported by distinct accepted frame/report witnesses | unit `radar-fusion` + backend independent-X/Y LD2450 replay | Remove time gate, count one frame three times, promote bounded_latest to coherent, reject all valid LD2450 estimates, or permit transitive/tied merge |
| S3-5 | Crossing/close people and missing/saturated sources preserve separate marks and unknown count | backend replay with labeled synthetic truth | Replace null with zero/sum or suppress ambiguous mark |
| S3-6 | Short handoff cannot create personal identity, gap path, cross-wall/floor link or double room count | unit + smoke source switch | Persist token; join through wall; count boundary twice |
| S3-7 | Native binary/count values match room snapshot, including partial input and unknown/unavailable; binary inputs keep Stage-1 state semantics | `test_ha_radar_room_outputs.py` | Treat missing as negative; expire unchanged binary on a coordinate lease; restore stale count; let UI count differ |
| S3-8 | Create/retry/restart creates exactly requested owned entities with stable IDs; rename preserves HA customization | HA harness lifecycle tests | Derive ID from room name; duplicate on retry; re-enable HA-disabled entity |
| S3-9 | Unauthorized/stale/replayed-different create/remove cannot mutate outputs or foreign entities; restricted sources cannot leak through room subscribe | HA WS permission tests + mutation | Remove admin/write/token/revision/ownership/source-ACL recheck; assert forbidden side effect or private canary |
| S3-10 | Room/source removal suspends; confirmed owned removal is retryable and never resurrects | HA crash/restart tests | Delete unrelated registry row; late reconciliation re-adds tombstone |
| S3-11 | Every heatmap run is separately consented, ≤24h, off by default, no restart resume or implicit raw collection | HA fake-clock + browser-close smoke | Auto-start on View/load/raw run; resume after restart; omit expiry |
| S3-12 | Raw ≤24h and aggregate ≤7d; quota, clear, epoch isolation and no history in exports/attributes enforced | backend storage/negative payload tests | Expired response, raw/ID in bin, post-clear flush, foreign epoch sum, support leak |
| S3-13 | Day/week exposes actual duration/gaps and observation-based metric without invented occupancy time | unit bucket/DST fixtures + golden | Fill gaps, multiply one cell by duplicate targets, show full week from 1h |
| S3-14 | Reflection proposal needs separated fit/hold-out evidence and explicit final Save; bad/symmetric data is not auto-filtered | unit geometry + smoke | Remove witness/residual guard or apply proposal automatically |
| S3-15 | Bounds hold at max config and dense adversarial targets; queues stay bounded and View remains responsive | backend perf replay + `radar_stage3` stress smoke | Remove candidate/page/quota cap; grow pending queue |
| S3-16 | Capability downgrade and import preserve stage-1/2 behaviour, never create entities/restart collection or mint commissioning from client claims | backend round-trip + mixed-version/commissioning smoke | Trust cached capability; import active grant/run/proof; accept forged/duplicate-frame proof; erase unrelated siblings or reject inherited non-UUID room IDs |
| S3-17 | View/kiosk gestures and safe actions work on desktop/touch; no history/editor leakage or diagnostic hit interception | targeted smoke + golden light/dark 360/736/1024 | Overlay intercepts pointer; hidden privileged controls dispatch writes |
| S3-18 | EN/RU labels preserve estimated/unknown/hypothetical meaning and entity names remain translated | i18n parity + browser/native registry assertions | Raw key, hardcoded English name, unqualified “people” count |

## 14. Test plan, risks and release evidence

Unit fixtures: disjoint/missing room polygons; exact boundary band; rotated
calibration; zero coordinates; timestamp skew; 2/3-source clique versus chain;
two real close targets; crossing; slot reuse/saturation; source epoch churn;
handoff at door, solid wall and different floor; reflection fit/hold-out failures;
cell union, midnight/DST, TTL, quota and clear tombstones. Share normalized
fixture data between frontend projection and backend, but independently assert
expected values so two copies of the same wrong formula cannot agree unnoticed.

HA tests require the real Linux/WSL harness: platform setup/unload, registry
rename/customization, disabled entity, auth downgrade, restart mid-create/remove,
store failure, source loss and recovery, config conflict, import, quota,
expiry-before-read and pending-flush-after-clear. Pure native-Windows tests do
not prove HA lifecycle. No household CSV is committed or used without explicit
permission; use synthetic fixtures plus separately consented, local-only field
validation of count eligibility before enabling it for a connection profile.

Proposed commands after implementation: `npm run typecheck`, `npm test`,
`npm run build`, `npm run bundle:sync`, `npm run bundle:budget`,
`node scripts/no-new-any.mjs --base origin/dev --head HEAD`,
`node scripts/smoke-select.mjs --base origin/dev --head HEAD`,
`node demo/smoke_radar_stage3.mjs`, `python -m pytest tests_backend -q` in
the real HA harness. Add backend targeted files to the relevant selector and
required mutation witnesses to `scripts/mutation-gate.mjs` for protective AC
covered by expensive gates. Exact command/output and skipped checks accompany
handoff; do not report proposed commands as passed.

Risks: false duplicate suppression/undercount, multipath mistaken for a mirror,
unequal source clocks, geometric calibration drift, gaps hidden by aggregation,
native registry partial failures and private-data copies outside House Plan.
Mitigations are respectively conservative fallback, manual acceptance, temporal
ineligibility, epoch invalidation, explicit denominators, durable reconciliation
and honest retention boundaries. Count is informational, never a safety/security
occupancy guarantee. No automation action is bundled with it.

Release artifacts for actual implementation: `docs/CHANGELOG.md` and
`docs/CHANGELOG.ru.md`; `docs/USER-GUIDE.md` and `docs/USER-GUIDE.ru.md`;
update `docs/ARCHITECTURE.md`,
`docs/CONFIG-COMPATIBILITY.md`, field registry and privacy/support projection
documentation. `docs/SCOPE.md` records the narrow #485 exception in this spec
revision; verify that aggregates and owned HA outputs stay within that approved
boundary at implementation/release, without silently broadening it.
Capture representative actual coverage, ambiguous overlap,
unknown native output and incomplete heatmap, light/dark
and narrow/touch View. Use approved complete Linux CI documentation/golden
artifacts and reviewed acceptance, not the conceptual UX sketch as a screenshot.
Attach bounded-performance, permission/leak, native lifecycle and protective
mutation results. Beta/RC at an exact green CI SHA precedes stable promotion.
No version, shipped changelog, generated artifact or release is changed by this
specification-only task.

## 15. Rollback and assumptions

Operational rollback: disable fusion groups to return to independent stage-1/2
marks; restore single allowed room explicitly if desired; disable a saved
reflector through stage 2; Stop/Clear aggregates; Disable or explicitly Remove
native outputs. Hiding live display alone is not rollback of background work.
No rollback sends source services or edits existing HA automations. Preserve
config definitions for repair unless the user explicitly removes them. For
binary/code downgrade follow §10's privacy purge and entity suspension steps;
do not use a browser Labs flag to gate backend data, storage or permissions.

**Technical choices assumed, change freely in review:** module/API names,
independent Store layout, sparse grid representation, UUID spelling, preview
TTL, operation-journal implementation, candidate thresholds and quotas. Reviewer
may change these with equivalent bounded tests and conservative semantics.
They are not additional questions for the owner.

**Bounded weekly-mode assumption:** §8's local seven-day aggregates implement
the explicitly requested weekly view, while every manual session remains ≤24h.
Neither the weekly selector nor a prior consent authorizes continuous multi-day
runs, raw retention changes or automatic renewal. This is recorded as an
engineering interpretation, not an additional claim about the wording of Q3.
No open owner question remains in this stage; independent review still decides
readiness of the complete specification package.
