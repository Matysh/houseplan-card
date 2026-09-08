# #485 — Radar presence, stage 2: zones and bounded observations

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485). Companion:
[stage 1](485-radar-presence-stage1.md). This is an implementation contract,
not a report that the feature exists. The issue labels remain the sole status.
Owner-approved UX defaults Q1–Q4 apply: configured live display is on, the
allowed area is one selected room, collection is explicit and limited, and
cross-radar merging belongs to stage 3. This document changes no product code.

## 1. Scenario, persona, before and after

The home administrator, in the desktop Device editor of the main House Plan
panel or full dashboard card, has calibrated a radar and now asks: “Does the
sofa zone actually cover the detections from my sofa?” Household members and
kiosk users continue seeing the quiet current-presence layer.

Before: the administrator compares millimetres and a separate spreadsheet.
After: they outline a zone on their plan, collect a limited observation sample,
and see whether observations land inside it before explicitly changing a device.

This serves J1/J4/J6 in `docs/SCOPE.md`. The approved exception to its generic
history exclusion is a local, bounded spatial-calibration sample; this is not
a history dashboard or a general replacement for HA Recorder. Raw movement
collection and device writes are separately opt-in operations.

## 2. Scope and non-scope

Included: local polygon zones; mapping exact existing occupancy/count entities
to those zones (including FP2-style zone-only connections); supported LD2450
device-zone read/edit/apply; bounded server recording; cloud inspection and
sample fractions; manually drawn reflection filters with preview; permissions,
revision conflicts, interruption, retention and rolling compatibility.

Excluded: continuous multi-day collection, heat maps, CSV import/export, cloud
upload, support attachment of observations, personal identities, trajectory
fusion, multi-room routing, automatic zone/mirror discovery, HA automation
creation and derived HA occupancy/count entities. Stage 3 must specify these
separately. No new editor tab, always-visible radar console or polling loop
that runs only because a View client is open. No generic arbitrary HA service
proxy and no firmware installation or entity-registry administration.

Stage 1 is a prerequisite: exact source bindings, normalized live frames,
physical installation, calibration, room filtering and source-health semantics
are consumed, not independently reimplemented. Device-zone support is a
capability of a verified connection, never inferred from a brand name.

## 3. Existing integration seams and proposed files

The existing files below were inspected on the issue branch; `radar*` modules
are proposed additions, not existing implementations.

| Surface | Existing authority | Stage-2 work |
|---|---|---|
| Configuration types | `src/types.ts` (`Marker`, `ServerConfig`) | Add optional zones/reflectors beneath the stage-1 radar object |
| Configuration transactions | `src/config-store.ts`; `custom_components/houseplan/websocket_api.py` (`houseplan/config/set`) | Preserve `expected_rev`, server acceptance and multi-client invalidation |
| Strict/change-aware validation | `custom_components/houseplan/validation.py` | Delegate new/changed radar fields to proposed `radar_validation.py`; retain unknown siblings |
| Authorization | `custom_components/houseplan/auth.py:may_write` | Use the same policy for raw reads, recording and hardware writes |
| Runtime ownership | `custom_components/houseplan/__init__.py`, `store.py:HouseplanData` | Wire setup/unload/reconciliation; separate recorder locks and storage |
| Existing bounded-recorder precedent | `custom_components/houseplan/trails.py:TrailRecorder` | Reuse lifecycle lessons, not vacuum-run semantics or its unrestricted read endpoint |
| Privacy boundary | `custom_components/houseplan/support_package.py`; existing export/import APIs | Exclude operational history and raw telemetry; preserve safe config transfer |
| Presentation | `src/render-device-snapshot.ts`, `houseplan-render-lifecycle.ts`, `src/editors/` | Feed one selected-radar lazy editor; keep View free of history/editor dependencies |

Proposed additions: `src/radar-zones.ts` (pure geometry/membership),
`src/radar-observations.ts` (typed client), `src/editors/radar-zones-section.ts`,
`src/editors/radar-observations-section.ts`; backend `radar_zones.py`,
`radar_recording.py`, `radar_recording_store.py`, `radar_validation.py` and
`radar_websocket.py`. Stage-1 modules remain the normalized-frame authority.
Names are technical choices, not separate scope. Do not alter `trails.py`'s
vacuum behaviour to fit radar data.

## 4. UX contract

### 4.1 One selected source and two kinds of zone

Entry: Device editor → selected device → Presence on plan → Configure on plan.
The same contextual surface gains **Zones** and **Observation recording**.
Only the selected radar's draft, cloud, sector, filters and short live trail
are visible here. Closing configuration returns to the same device; returning
from another route starts in View. Temporary layers are session-local.

**House Plan zones**: Add zone → outline a rectangle or polygon → name →
choose its state source → preview → Save. State source is either this radar's
normalized coordinate targets or one exact existing occupancy/count entity.
Zone-only sources show entity selection and polygon drawing, no coordinate
calibration or point recording. FP2 mapping does not write to Aqara and is not
labelled “synchronized”. Deleting the mapping never deletes the HA entity.

For a coordinate zone, a valid current target inside its polygon means occupied;
zero eligible targets means “no targets detected” only if the source has a
fresh frame with stage-1 `complete:true`. An incomplete frame may establish
positive occupancy from its usable slots, but cannot establish absence from
the remaining slots. Missing/stale coordinates are unknown, never clear. A
mapped binary sensor uses exact `on`/`off`; mapped count uses a finite integer
`>=0`. Unknown/unavailable/invalid values produce unknown. There is no fallback
from a missing selected entity to a similarly named sensor. Overlapping zones
may both be occupied; their counts are never summed as people.

**Device zones**: a separate section with connection capabilities, one mode
selector above the list, and at most three LD2450 slots. Drawing starts in the
radar's local axes. A sensor-axis rectangle appears rotated on a rotated plan;
no arbitrary polygon is silently converted to a bounding rectangle. Handle
preview, numeric fields, transmitted values and reloaded outline use the same
unit conversion and quantization. An unsupported connection may display known
geometry read-only; the Apply button is absent with an explanation.

The one LD2450 mode is **Unrestricted / Detect inside / Ignore inside**,
mapping to `Disabled / Detection / Filter`. It applies to the whole set, not
to each zone independently. Unrestricted retains coordinates for later use.
An unused slot is four zeros; this sentinel is not an active zero-area zone.
Every active slot must have `x1<x2` and `y1<y2`. Mode and all slot values are
shown in the confirmation, including unchanged slots affected by a full-set
device write. Clearing all slots requires Unrestricted; do not install an
empty Detection set by accident.

Saving House Plan polygons/reflectors changes shared plan configuration only.
Applying hardware zones is a separate command with a warning that the radar's
detection and existing HA automations may change. Saving a name, moving the
decorative device icon or importing config never sends device commands.

### 4.2 Reflection filters

Advanced → False reflections → Add reflecting surface. The user draws a
segment, names it, and sees the opposite half-plane relative to the physical
sensor mount highlighted. The complete line through the two endpoints is the
filter boundary; the endpoints are handles defining that line, not a promise
that the effect stops at a mirror's visible ends. Text explicitly states that
real targets behind the line may also be hidden. The line is a House Plan
filter, not furniture, a wall, or a claim about electromagnetic propagation.

The same canonical membership predicate drives live preview, cloud exclusions
and saved filtering. Points strictly on the opposite side are excluded; points
on the line within 0.1 cm are retained. A sensor on/within 1 cm of the line,
or coincident endpoints, is invalid. Multiple enabled lines use OR exclusion.
Room clipping remains the stage-1 single-room filter. Outside-room points are
out of the chosen display area, not declared physically false. Missing room
geometry never produces a guessed boundary.

Preview is reversible and has zero HA side effects. Apply saves only local
filters; the original HA presence entity and upstream automations are unchanged.
Raw observations are retained before filtering. “Show excluded points” uses
grey crosses and reasons `outside_room` / `reflector:<id>`; it is off in View.

### 4.3 Observation recording and inspection

No recording starts from opening View, configuring/calibrating a source,
opening this section or enabling live display. The form offers 5 minutes,
15 minutes, 1 hour (default), 24 hours; it explains local storage, browser-close
continuation, automatic stop and rolling 24-hour raw retention before Start.
The server's response, not the click, starts the visible countdown.

The section shows the shared run state, start/end, retained sample count, source
gaps, recording limits and Stop. Another authorized client sees the same run;
opening it does not create another recorder. Hiding live overlays does not stop
recording. Disabling the radar explicitly stops its run after confirmation;
turning it on again never restarts recording.

After a run, or during it, choose one retained run/epoch and an interval. The
cloud is a distinct historical layer, without interpolated lines; live targets
stay visually distinct. Switching selected radar disposes the old cloud and
request. Never superimpose history from another source generation by default.
Clear recording confirms permanent deletion of **all retained observations
for this selected radar**, stops its active run, and updates every client.
It leaves calibration, local zones, reflectors and hardware untouched.

Zone score is “{inside} of {total} recorded points ({percent}%) fall in this
zone”, with interval, excluded-points policy and any sampling/loss disclaimer.
Default denominator includes every valid retained point in the selected epoch,
including points outside the selected room and excluded by filters; the user
may explicitly choose “included points only”. Both numerator and denominator
then use that same predicate. Zero denominator shows “No usable observations”,
not 0%. Overlapping zones score independently. This is neither time occupied,
probability, accuracy nor a pass/fail judgement of zone correctness.

Desktop is the reference editor. Touch editor: best effort / intentionally
degraded; complex geometry may recommend desktop, but Cancel/exit, permission
guards and destructive confirmation always work safely. View and kiosk retain
full touch support, normal pan/zoom and actions. No point/zone history overlay
intercepts a device tap; kiosk exposes neither recording nor configuration.

## 5. Persisted models and compatibility

Stage 1 owns `marker.radar={version:1,enabled,show_live,profile,sources,mount,
room_id,calibration}` and `settings.radar.show_live` (default true). Add optional
`zones` and `reflectors`; absence is equivalent to empty and triggers no write.
No global model/store-version bump and no read migration are required.

| Path | Contract |
|---|---|
| `radar.zones.local[]` | Maximum 32; `{id,name,poly,state}`; id 1–64 ASCII `[A-Za-z0-9_-]`, unique; name trimmed 1–80 characters |
| `local[].poly` | 3–64 finite `{x,y}` points in the same canonical plan coordinate system as room polygons; simple polygon, no holes, nonzero area; no duplicate adjacent points or repeated closing point |
| `local[].state` | `{kind:'targets'}` or `{kind:'occupancy',entity_id}` or `{kind:'count',entity_id}`; targets requires coordinate capability, others require exact `binary_sensor.*` / `sensor.*` references |
| `radar.zones.hardware` | Optional `{adapter:'esphome_ld2450_numbers_v1',mode_entity,slots[]}`; contains bindings/labels, never an assumed applied configuration |
| `hardware.slots[]` | Exactly three ordered entries `{slot:1\|2\|3,name,x1_entity,y1_entity,x2_entity,y2_entity}`; one complete descriptor is required for writes |
| `hardware.mode_entity` | Exact `select.*`; required options are the adapter's literal three modes |
| `hardware.*_entity` | Exact `number.*`, no templates, wildcard ids, service names or arbitrary attribute paths; globally distinct inside this binding set |
| `radar.reflectors[]` | Maximum 8; `{id,name,a:{x,y},b:{x,y},enabled}`; same plan units, id/name bounds as zones, strict boolean |

Entity ids use the existing bounded entity-id validation (maximum 255). Physical
conversion uses the stage-1 canonical scale and calibration; neither renderer
nor writer invents a second scale. Geometry is finite, within the space's
existing accepted coordinate envelope, and subject to the total 2 MiB config
limit. New/changed malformed radar records are rejected atomically with
`invalid_radar_zones`; untouched malformed/future records remain lossless and
inert on unrelated writes, as with existing change-aware compatibility fields.
Unknown sibling fields round-trip. Invalid known members never reach rendering
or services. No recursive rounding of unknown future numeric fields.

Full export/import preserves configuration and exact entity ids; it never
starts a recorder or applies device settings. Space transfer remaps the owner
space/room with the existing reference seam and keeps local geometry with its
owner; HA ids remain literal. If duplicate policy virtualizes a marker, remove
the complete HA-dependent radar block and report one dropped radar binding,
instead of leaving device-write capabilities on a virtual copy. Plan-only
transfer contains no radar marker data. Removing a room preserves the radar
config as needing repair, stops its recording, and does not select another room.

Runtime snapshots, operation ids, confirmation tokens, applied/draft numbers,
recordings and telemetry do not enter ServerConfig, layout, portable exports,
support packages, localStorage or frontend crash reports. Support projection
may expose capability booleans and bounded counts only, no source ids, names,
coordinates, run times, geometry, raw samples or device command payloads.

New frontend + old backend: absent `radar_stage2_api:1` hides stage-2 operations
with an update explanation, preserves fields, and makes zero attempted stage-2
commands. Old frontend + new backend: fields survive unknown-field handling;
ordinary unrelated saves must not strip them. Older clients that reconstruct
markers may erase unknown fields: downgrade is read-only recommended, not
promised lossless editing. Raw storage is independently versioned and ignored
by old backends. Register fields in `scripts/config-field-registry.mjs` and
document this matrix in `docs/CONFIG-COMPATIBILITY.md` during implementation.

## 6. Device read, draft, conflict and write protocol

### 6.1 Capability and snapshot

`config/get` advertises exact `radar_stage2_api:1` after runtime setup. The
server resolves all entity ids from saved config, validates device membership
for the LD2450 adapter (one ESPHome device), current state availability, number
units, min/max/step and the mode options. A manual coordinate profile remains
eligible for local zones/recording but does not gain hardware-write capability.

LD2450 adapter accepts millimetre number entities and converts local cm ×10;
it rejects missing/unsupported units. Effective numeric bounds are those of the
actual entities, not constants copied from marketing. Documentation and the
ESPHome 2026.8.2 number schema have differed, so numeric fields carry authoritative
limits in the snapshot. Quantize to `min+k*step` nearest, ties away from zero;
the resulting rectangle, including quantization changes, is the confirmed draft.
Out-of-range points are rejected, never silently clamped.

A snapshot contains all three slots, global mode, exact binding fingerprint,
`config_rev`, `source_generation`, time, `snapshot_hash`, and
`read_proof:'ha_state'|'device_readback'`. HA cached equality and state changes
after `number.set_value` are **not** device-readback proof. The default
`esphome_ld2450_numbers_v1` adapter can offer `ha_state` only; it must advertise
`verified_apply:false` and cannot emit a green device-confirmed result.
This restriction does not stop an explicitly warned, unverified write.

### 6.2 Draft and explicit confirmation

Opening reads a baseline; edits stay browser-memory-only. Cancel, leaving the
source, or closing the page asks to discard dirty geometry and sends no command.
Reload loses an unsaved draft; accepted shared polygons are unaffected. If a
configuration update changes this radar's binding/generation, disable Apply,
retain the draft for inspection, and require a fresh baseline.

Prepare compares the complete current set against the baseline snapshot under
a per-device operation lock. Any observable external change returns conflict
with no write; the UI offers Reload device settings, not silent merge. Changes
made elsewhere but not exposed by HA cannot be detected: the confirmation says
so for `ha_state` proof, and never claims universal conflict detection.

The server generates a user-bound, single-use confirmation token valid for 60
seconds, tied to marker, full quantized candidate, baseline hash, config rev,
source generation and exact binding set. Maximum two outstanding tokens per
user and 32 globally; evict oldest unused tokens, not active operations. Apply
accepts this token only, not arbitrary entity ids, services or changed values.

### 6.3 Apply and outcomes

Immediately before the first call recheck permission, token, exact ownership,
source generation, config rev and complete available baseline. Changed/unknown
baseline is conflict/unavailable and makes zero calls. Per-device lock prevents
simultaneous writes through two marker bindings to the same hardware. It does
not lock ordinary unrelated config saves for the duration of UART traffic.
Binding/generation mutation during an operation is refused as `radar_busy`;
unrelated config changes do not cancel an already accepted operation.

Immediately before attempting the first service call, stop any active raw
recording for this physical device as `configuration_changed` and invalidate
its evaluation epoch. When Stage 3 exists, the same signal stops affected
heatmap runs and invalidates fusion/count commissioning. Include this effect
in Prepare/confirmation. Neither partial/unverified completion nor a retry
automatically restarts collection or restores count eligibility; the user
checks the resulting detection and explicitly starts/recommissions. Prepare,
Cancel, or a refusal before an operation is accepted does not stop collection.
This prevents intermediate hardware filters from silently entering an old
observation selection. Independently observed hardware configuration changes
raise the same invalidation; unreported physical changes remain unknowable.

For the numbers adapter, write all twelve coordinate numbers in slot order
`x1,y1,x2,y2`, then the final mode, sequentially. Send the final mode even when
unchanged so the last command carries the final complete set. Use only
`number.set_value` / `select.select_option`, blocking calls with the requesting
HA user's context and normal HA service authorization; `may_write` is not an
elevation above HA entity control permissions. Timeout is 5 seconds per call,
whole operation 75 seconds. The confirmation warns that separate writes can
expose intermediate detection configurations to existing HA automations; there
is no implicit temporary disable, retry loop or atomicity claim.

First error, revoked permission or timeout stops remaining calls. Never replay
a timed-out call automatically. Return counts of accepted/failed/not-sent
calls and the affected complete slot/mode set, without asserting which values
the hardware applied. The UI retains the draft and baseline; Retry or Restore
previous values requires a new read/prepare/confirmation. Restore is another
bounded write with the same risks, not atomic rollback.

Outcomes: `confirmed` only with independent device readback matching the full
candidate; `sent_unverified` when all calls were accepted but proof is absent;
`partial_unverified` after some calls with no proven final state; `failed`
before any accepted call; `partial_confirmed` only when independent complete
readback proves a differing applied set. For the default numbers adapter only
the unverified/failed outcomes are reachable. “Refresh” rereads HA and retains
its proof grade; it cannot upgrade an optimistic snapshot to hardware proof.

Runtime operation records survive disconnect in memory for 10 minutes (maximum
32 terminal records); repeated Apply using the same token returns the same
operation instead of resending. HA restart loses these records: UI reports
“Result unknown after restart” and requires a fresh read before another write.
There is no startup resend or automatic restoration of hardware settings.

## 7. Recording model, retention and lifecycle

### 7.1 Runtime record

Proposed `RadarRecordingStore` owns separate version-1 HA storage keys beneath
`houseplan.radar_recordings`; only supported storage APIs write them. A small
manifest owns runs and minute-sized sample chunks. Client requests never choose
paths. File I/O and bounded aggregation run off the HA event loop. Raw data is
never placed in the config/layout Store, HA entities or HA Recorder.

Run header: `{run_id,marker_id,source_generation,started_at,ends_at,stopped_at?,
status,stop_reason?,collection_policy,epochs[],retained_points,lost_samples}`.
The private manifest additionally stores `initiator_user_id` for permission
rechecks; query/status responses do not expose that identifier.
Server UTC timestamps are authority; runtime duration/expiry deadlines use a
monotonic clock so wall-clock corrections do not extend authorized collection.
The source generation and normalized physical centimetre coordinates are taken
from the stage-1 frame before room/reflector filtering. Every accepted sample
records server sequence/time, source `server_session_id`/frame `seq`, slot key,
local x/y, both coordinate-component report times and the inherited
`pair_quality`. Polar samples retain their distance/bearing component report
times after conversion. `bounded_latest` remains bounded HA-report pairing,
never an atomic hardware frame or proof of a new physical measurement.
Slot keys are not identities. No speed/trajectory/person inference is required.

An observation key is `(source_generation,server_session_id,slot,
component_1_report_time,component_2_report_time)`. A new output `seq`, filter
revision, browser event or elapsed second alone does not make a new observation.
The recorder retains the last accepted key per configured slot and does not
sample it twice, including when a frame is republished for another slot or for
health changes. A verified coherent adapter uses its stage-1 sample key instead;
the recorder cannot infer or upgrade that capability. Newly reported equal
values are allowed only under stage-1 eligibility and remain labelled reports,
not independently verified stationary measurements.

Epoch header stores `source_generation`, `calibration_revision`, projection
snapshot, room/reflector predicate snapshots and filter/zone revision
fingerprints. Its private storage also holds an immutable `source_entity_ids`
set derived by the backend from the exact bindings contributing to that epoch's
observations and evaluation: coordinate components, gates, availability/count
inputs and any mapped-zone inputs used. This is not reconstructed from the
marker's current bindings after reconfiguration. Exact references are private
authorization metadata, not returned in run/epoch/query/status responses or
portable/support exports, and expire with the epoch under the same raw/metadata
TTL rules; they do not become a permanent source registry.
Historical included-only scoring uses that epoch's predicate;
explicit current recalculation uses the current predicate and labels both
revisions. Zone scores always refer to the currently selected saved zone outline,
whose revision is returned; no score is labelled as an old zone's statistic.
Physical move, source/unit/axis
change, owner-space change, new `installation_id` (including a reinstallation
at the same coordinates) or deleted selected room stops the current run as
`configuration_changed`; restart requires explicit Start. A calibration-only
heading/mirror/reference correction closes the epoch and opens the next within
the same bounded run and source generation, per the common identity contract.
Filter/zone edits likewise delimit evaluation epochs without destroying raw
samples. Historical default view uses its saved epoch projection. Explicit
“Recalculate with current calibration” is permitted only within the same
source generation and explains the changed projection; it never mixes epochs
silently. A physically moved sensor cannot reuse the old generation.

Collection accepts only stage-1 eligible coordinate observations, checked at
collection time with the same component ages, skew and source-generation rules.
For `bounded_latest`, each component age is at most 3 seconds and report skew
at most 1.5 seconds; storage does not renew this eligibility. Usable slots from
an incomplete frame may be recorded with `complete:false` and explicit missing
slot/gap metadata; missing slots never become zero observations. Coordinate-
unknown, stale, unavailable, source-gap and interrupted intervals produce gaps/
counters, not fabricated zeros, duplicated observation keys or interpolated
points. A fresh `complete:true` zero-target frame records availability but no
target samples; an empty incomplete frame is a gap, not absence. Occupancy-only,
range-only and zone-only profiles cannot start point recording.

### 7.2 Hard bounds and durability

| Bound | Required value/policy |
|---|---|
| Duration | `duration_s ∈ {300,900,3600,86400}`, default 3600; max 86400 per explicit run; no extension/resume endpoint |
| Concurrency | One active run per marker, maximum 8 across the integration; a duplicate Start returns `already_recording`, never extends the deadline |
| Collection rate | At most one eligible frame per server-monotonic second per radar, all usable slots up to the stage-1 slot cap; retain the first frame with new eligible observation keys in each second, skip already accepted keys; no duplicate-counting on output/client events |
| Samples | Maximum 700,000 retained target samples per marker, including all unexpired runs |
| Metadata | Maximum 64 retained runs per marker, 128 epochs per run and 4 MiB manifest data per marker; further Start is refused, or a recording is stopped before opening an excess epoch; ordinary config edits still succeed |
| Storage | Maximum 32 MiB encoded recording data per marker and 128 MiB total, including manifests and pending chunks; stop the affected run as `quota_reached`, never evict another user's unexpired observations |
| Memory | At most one minute of unflushed samples per active run; a global 8 MiB buffer ceiling; overflow stops affected run with `storage_error` |
| Raw TTL | 24 hours from each server sample time, not 24 hours from run completion; exact cutoff enforced on every read/score, plus deletion sweep at startup and at least once per minute |
| Metadata TTL | Empty run headers and operation/sample metadata removed no later than 24 hours after stop; no permanent audit of movement/recording times |
| Browser result | Page size ≤2,000 samples, response ≤512 KiB; opaque cursor ≤256 chars; cloud preview ≤10,000 points by deterministic reservoir selection |
| Requests | Query/score ≤1 in flight per user/marker; start/prepare ≤10 per minute per user; operation payload ≤64 KiB; excess returns `rate_limited`/`too_large` |

The score uses all retained eligible samples, not the downsampled preview. UI
states capture cadence and “preview sampled” separately; point fraction is not
time fraction. Counts, numerator/denominator and preview derive from one query
selection including the epoch and exclusion policy.

Persist Start metadata before acknowledging Start. Flush chunks no less often
than every 60 seconds and on Stop/unload; an interrupted write is replaced
atomically by the storage implementation, never appended as an unvalidated
partial record. A crash can lose at most the acknowledged buffer interval,
which is reported as an interruption/loss, not falsely reconstructed. Storage
failure stops recording, preserves prior durable chunks and shows failure.

Browser close/network loss does not stop a server-authorized run. HA restart,
integration unload/reload, deleted/tombstoned marker, disabled radar or revoked
initiator permission ends collection; on startup retained runs marked recording
become `interrupted`, are swept for TTL, and are never silently resumed. Check
the initiator's existence, current `may_write` and HA read permission for every
exact source entity in the active epoch at least once per minute and before
accepting a new chunk. Revocation stops collection, discards the not-yet-accepted
pending chunk and records `permission_changed`; it does not disclose restricted
data through status. Opening a new epoch performs the same source-set checks
before accepting observations. Config changes reconcile by stable marker id under a
recorder lock; the teardown-closed flag is checked after awaited loads so a
late refresh cannot resubscribe after unload.

Clear takes the recorder lock, invalidates the active run generation, detaches
collection and cancels pending saves before deleting chunks and metadata. Do
not acknowledge until the deletion is durable; a write failure returns an
error and never says “cleared”. Delayed saves cannot recreate cleared chunks.
Deleting a marker explicitly cascades its recordings (stated in deletion
confirmation); merely hiding/moving its decorative icon does not delete them.

TTL deletion is the disclosed consent of Start, not orphan-inference file GC.
Expired data remains inaccessible if disk deletion fails; retry and report a
bounded storage incident without logging coordinates. HA backups or copies
made by the administrator are outside the component's deletion guarantee; the
recording warning links this limitation. Downgrade/disabled integration cannot
run the sweep: before downgrade, Stop and Clear with the current version.

## 8. Commands, errors and authorization

All commands are authenticated WebSocket commands in proposed
`radar_websocket.py`; no public/signed content URL for raw samples. Every command
below, including status/read/score, requires current `may_write(hass,user)` plus
HA read permission for every exact source entity contributing to its result.
For recording Start and the active run this is the backend-derived epoch source
set. Historical query/score uses the selected epoch's saved source set, not only
the current marker bindings; a current-projection score additionally checks
any current inputs it uses. Status checks the source sets of all retained epochs
whose metadata would be returned. If any required permission is denied or
cannot be resolved, reject the complete response as `source_restricted`; do not
return private run existence, counts, times or a partial cloud. Stop/Clear still
require current `may_write` but may delete/stop without source read access; their
minimal acknowledgement reveals no retained source values or run metadata.
When `admin_only=false`, this intentionally grants the same rights to all
signed-in editors; the settings explanation must say recording visibility
follows this existing policy and the underlying entity read permissions. Do not
substitute a hard-coded `is_admin` check. Device-zone read/prepare/operation
results likewise check the exact hardware binding set; Apply additionally
retains ordinary HA entity control authorization. No global unfiltered source
snapshot is made available merely because `may_write` is true.

| Command after `houseplan/radar/` | Request | Result |
|---|---|---|
| `zones/read` | `marker_id` | Complete capability/snapshot/proof record from §6 |
| `zones/prepare` | `marker_id,baseline_hash,expected_config_rev,source_generation,candidate` | Quantized full candidate, warning/proof grade, confirmation token/expiry; no service calls |
| `zones/apply` | `token` | `operation_id,status`; progress/result fetched by operation id |
| `zones/operation` | `operation_id` | Bounded outcome and call statuses, without unapproved retargeting |
| `recording/start` | `marker_id,duration_s,expected_config_rev,source_generation` | Persisted run header; exact original end time |
| `recording/status` | `marker_id` | Current state and retained run/epoch headers, no unbounded sample payload |
| `recording/stop` | `marker_id,run_id` | Idempotent stopped header after durable flush; after source-read revocation, minimal stopped acknowledgement without private metadata; does not clear observations |
| `recording/clear` | `marker_id,expected_recording_rev,confirm:true` | Durable deletion result + new recording revision |
| `recording/query` | `marker_id,run_id,epoch_id,from,to,cursor?,limit?` | Bounded samples/preview, effective range, counts, gaps, truncation, recording revision |
| `recording/score` | Same selection + `zone_ids[],included_only,projection:'recorded'\|'current'` | Numerator/denominator/fraction per zone, calibration/filter revision, no new persistent analytics |

`from/to` are server UTC milliseconds in the retained run, ordered, at most
24 hours apart; maximum 32 requested zone ids. Query cursors bind user, marker,
run, epoch, selection and recording revision. Clear/expiry invalidates them
with `stale_cursor`, not a silently changed page. Query/score reread both
`may_write` and the applicable exact-source permissions before delivery; no
shared unfiltered cross-user cache. Progress subscriptions
are scoped to authorized connections; permission loss closes them and clears
the client buffer. Broad HA bus events contain only invalidation signals,
never sample coordinates, source references or history metadata.

Stable domain errors: `unauthorized`, `not_ready`, `unsupported_capability`,
`source_unavailable`, `source_restricted`, `permission_changed`,
`invalid_radar_zones`, `invalid_selection`, `conflict`,
`radar_busy`, `invalid_token`, `token_expired`, `already_recording`,
`quota_reached`, `rate_limited`, `too_large`, `stale_cursor`, `storage_error`,
`operation_unknown`. Error text is localized from codes; backend exception
strings and arbitrary entity attribute contents are never displayed or logged
as raw data. Rejected commands leave config, recording deadline and hardware
unchanged unless the returned outcome explicitly records an already-started
partial hardware operation.

## 9. i18n contract (English + Russian)

Use the existing i18n registry, lazy editor graph and HA duration/number
formatters. Keys below live under `radar.` in en/ru; other languages retain the
existing fallback policy. Dynamic names are text, never HTML. Existing shared
Save/Cancel/Retry/Close and common error keys are reused, not duplicated.

| Key | English | Русский |
|---|---|---|
| `zones.title` | Zones | Зоны |
| `zones.local` | House Plan zones | Зоны в House Plan |
| `zones.device` | Device zones | Зоны датчика |
| `zones.add` | Add zone | Добавить зону |
| `zones.state_source` | Zone state source | Источник состояния зоны |
| `zones.targets` | This radar's targets | Цели этого радара |
| `zones.occupancy` | Presence sensor | Датчик присутствия |
| `zones.count` | Target count sensor | Счётчик целей |
| `zones.map_only` | This outline is stored only in House Plan | Этот контур хранится только в House Plan |
| `zones.unrestricted` | Unrestricted | Не ограничивать |
| `zones.detect_inside` | Detect inside | Обнаруживать внутри |
| `zones.ignore_inside` | Ignore inside | Игнорировать внутри |
| `zones.apply` | Apply to device | Применить к датчику |
| `zones.apply_warning` | This changes device detection and may affect existing automations. Separate commands can temporarily apply intermediate values. | Изменится обнаружение датчика; это может повлиять на автоматизации. Отдельные команды могут временно применить промежуточные значения. |
| `zones.collection_stop` | Applying stops active observations/heatmap collection for this device and requires checking combined counts again | Применение остановит активный сбор наблюдений/тепловой карты этого датчика; объединённый подсчёт потребуется проверить заново |
| `zones.external_change` | Device settings changed. Reload before applying. | Настройки датчика изменились. Перечитайте их перед применением. |
| `zones.cached_warning` | Only Home Assistant values are available. Device application and unreported external changes cannot be verified. | Доступны только значения Home Assistant. Нельзя проверить применение датчиком и неотражённые внешние изменения. |
| `zones.confirmed` | Application confirmed by device | Применение подтверждено устройством |
| `zones.unverified` | Commands sent; device application is unconfirmed | Команды отправлены; применение устройством не подтверждено |
| `zones.partial_unverified` | Some commands were sent; the device result is unknown | Отправлена часть команд; результат на устройстве неизвестен |
| `zones.partial_confirmed` | Device readback confirms a different applied set | Датчик подтвердил применение отличающегося набора |
| `zones.restore` | Restore previous values | Восстановить предыдущие значения |
| `zones.unknown_after_restart` | Result unknown after restart. Read settings again. | После перезапуска результат неизвестен. Перечитайте настройки. |
| `recording.title` | Observation recording | Запись наблюдений |
| `recording.duration` | Collect for | Собирать точки |
| `recording.start` | Start recording | Начать запись |
| `recording.stop` | Stop | Остановить |
| `recording.clear` | Clear recording | Очистить запись |
| `recording.clear_confirm` | Stop recording and permanently delete all retained observations for this radar on every client? Zones and calibration stay unchanged. | Остановить запись и навсегда удалить все сохранённые наблюдения этого радара у всех клиентов? Зоны и калибровка останутся. |
| `recording.privacy` | Stored locally. Continues after closing this page. Each point expires after 24 hours; administrator backups are outside this deletion guarantee. | Хранится локально. Запись продолжится после закрытия страницы. Каждая точка удаляется через 24 часа; гарантия удаления не относится к резервным копиям администратора. |
| `recording.editors_only` | Recording requires House Plan editing and source read permissions | Для доступа к записи нужны права редактирования House Plan и чтения источников |
| `recording.ends_at` | Recording ends: {time} | Запись закончится: {time} |
| `recording.interrupted` | Recording interrupted; start a new run to continue | Запись прервана; для продолжения запустите новую |
| `recording.gap` | No valid coordinate data during this interval | В этом интервале нет достоверных координат |
| `recording.no_points` | No usable observations | Нет пригодных наблюдений |
| `recording.score` | {inside} of {total} recorded points ({percent}%) fall in this zone | {inside} из {total} записанных точек ({percent}%) попали в эту зону |
| `recording.not_time` | This is a fraction of samples, not occupied time | Это доля отсчётов, а не время занятости |
| `recording.included_only` | Included points only | Только учитываемые точки |
| `recording.sampled` | Preview sampled; score uses the full retained selection | Превью прорежено; оценка использует всю сохранённую выборку |
| `recording.cadence` | Up to one eligible reported frame per second | Не более одного пригодного кадра по сообщениям источника в секунду |
| `recording.quota` | Recording stopped at the storage limit | Запись остановлена по лимиту хранения |
| `recording.storage_error` | Recording stopped because storage failed | Запись остановлена из-за ошибки хранения |
| `recording.epoch` | Installation/calibration period | Период установки/калибровки |
| `recording.recalculate` | Recalculate with current calibration | Пересчитать с текущей калибровкой |
| `recording.configuration_changed` | Configuration changed; start a new recording | Настройка изменилась; начните новую запись |
| `reflectors.title` | False reflections | Ложные отражения |
| `reflectors.add` | Add reflecting surface | Указать отражающую поверхность |
| `reflectors.warning` | Hides the opposite side of the entire line, possibly including real targets. Does not change the original Home Assistant sensor. | Скрывает противоположную сторону всей линии, включая возможные настоящие цели. Исходный датчик Home Assistant не изменяется. |
| `reflectors.excluded` | Show excluded points | Показать исключённые точки |
| `reflectors.invalid` | Move the line away from the sensor and give it two distinct endpoints | Отодвиньте линию от датчика и задайте разные конечные точки |
| `errors.unsupported_capability` | This connection does not support this operation | Это подключение не поддерживает операцию |
| `errors.update_backend` | Update the House Plan integration to use zones and recordings | Обновите интеграцию House Plan для зон и записи |
| `errors.permission_changed` | Permissions changed; recording access is closed | Права доступа изменились; доступ к записи закрыт |
| `errors.source_restricted` | No access to all sources used by this observation period | Нет доступа ко всем источникам этого периода наблюдений |
| `errors.invalid_geometry` | Check the zone outline and device limits | Проверьте контур зоны и пределы датчика |
| `errors.busy` | This radar is already being updated | Этот радар уже обновляется |

## 10. Acceptance criteria and negative witnesses

Each `S2-*` criterion is mandatory. Test names/files below are planned artifacts,
not claims that tests already ran. A protective criterion needs an explicit
negative probe/mutation and its failing output in code review; expensive
backend/browser guards receive a registered mutation-gate witness.

| AC | Observable contract | Proof | What makes the protection fail visibly |
|---|---|---|---|
| S2-1 | Only selected-radar configuration exposes zones/cloud; View/kiosk remain quiet and pointer-transparent | `smoke_radar_zones.mjs`; golden en/ru light/dark; existing kiosk smoke | Render history or hit areas in View: tap/pan assertions fail |
| S2-2 | Polygon CRUD is revisioned, cancellation has no effect, unknown siblings survive reload/import | unit `radar-zones`; backend config roundtrip; smoke two clients | Remove expected revision check or reconstruct known keys only: stale writer/unknown sentinel tests fail |
| S2-3 | FP2-style occupancy/count mapping uses exact entity; coordinate-zone clear requires complete:true; unknown never means clear, no fabricated coordinates | unit state table including one usable outside-zone slot plus one unknown slot; backend exact-ref fixture; smoke missing selected entity | Enable name fallback, cast unknown to zero or treat an incomplete frame as clear: wrong-state and zero-service-call assertions fail |
| S2-4 | LD2450 uses max three sensor-axis rectangles and one mode; preview equals transmitted quantized values | shared TS/Python geometry fixtures; device-write harness | Add fourth slot, mixed per-zone modes or plan-axis bounding box: strict rejection/projection assertions fail |
| S2-5 | Invalid domains, ownership, units, limits, degenerate geometry and empty Detection sets cause zero service calls | `test_ha_radar_zones.py` table | Remove each guard; invalid candidate reaches captured HA service spy |
| S2-6 | Draft preparation is non-mutating; stale baseline/config/token refuses before writing | backend concurrency/token tests; two-client smoke | Accept consumed/other-user/expired token or changed binding: forbidden service-count assertion fails |
| S2-7 | Default numbers adapter never calls optimistic equality device confirmation | backend optimistic-state fake; smoke unverified label | Treat HA state echo as device proof: expected amber/unverified outcome fails |
| S2-8 | Partial send/timeout stops further calls; retry/restore requires new confirmation; no automatic restart replay | injected nth-call failures and restart; smoke recovery | Retry timed-out call or continue after failed call: service trace differs; false green label fails |
| S2-9 | Recording starts explicitly, duration options/default/caps exact; duplicate start preserves deadline | backend fake-clock tests; smoke Start/Stop | Auto-start on subscription, accept 86401 s or extend duplicate deadline: start-count/deadline assertions fail |
| S2-10 | Browser close leaves run collecting; HA restart interrupts without resume; Stop durably flushes | `test_ha_radar_recording.py`; disconnect/restart harness | Tie recording to WS lifetime or resume at startup: expected sample count/state fails |
| S2-11 | Stage-1 pair quality/ages and unique observation keys survive recording; incomplete slots create explicit gaps, legitimate axis zero survives, no interpolation | shared normalized-frame fixture including bounded_latest, reused output seq and partial slots; backend fake clock | Upgrade quality, renew report age, count a repeated pair under a new seq, fill missing slots or drop `x=0,y>0`: exact samples/quality/gaps differ |
| S2-12 | Raw TTL is per sample; expired samples inaccessible after clock jump/startup, disk failure does not expose them | backend fake clock + storage failure | Remove read-time cutoff while sweep fails: expired canary returns and test fails |
| S2-13 | Concurrent runs/bytes/samples/buffers/query sizes are bounded without fresh-data eviction | backend quota/concurrency tables | Remove each limit or count only flushed bytes: 9th recorder/oversize request is accepted and test fails |
| S2-14 | Raw/status/score require may_write plus exact historical epoch-source ACL; collection rechecks initiator write/read rights; HA writes retain control authorization; Stop/Clear can safely remove data after source-read revocation | HA users with admin_only true/false, rebound marker with restricted old source, revoked source/read/write access before chunk, minimal Stop/Clear response | Check only current bindings, omit metadata/source/chunk ACL, expose private source ids or bypass service authorization: historical canary/metadata/service spy appears |
| S2-15 | Clear stops and durably erases selected radar across clients; delayed callbacks cannot resurrect data | backend racing clear/save/reload; two-client smoke | Permit late flush after generation invalidation: cleared canary reappears |
| S2-16 | Different source generations never mix; changed calibration is explicit epoch/reprojection | backend epoch fixtures; cloud smoke | Join epochs or apply new mount to old generation: known geometry/selection assertion fails |
| S2-17 | Score uses full retained selection with matching numerator/denominator, not preview or elapsed time | unit/backend 100-point fixture: 31 inside; empty, overlaps, exclusions | Use preview size/time weights or filter one side only: exact 31/100 and empty-state assertions fail |
| S2-18 | Reflection/room preview and saved filter agree; no upstream sensor write or history deletion | shared geometry fixture; smoke Apply/Cancel; service spy | Flip side, treat segment as finite without label, or call service: point set/zero-call assertions fail |
| S2-19 | Exports/support/logs/cache carry no recording canary; imports never start/write hardware | backend export/support test; browser storage/network inspection | Add raw data to config/event/support/localStorage: canary scanner fails |
| S2-20 | Missing stage-2 capability, malformed/future fields and downgrade remain inert without data erasure | rolling client/backend matrix; unit preservation tests | Call unsupported command or drop future siblings on unrelated save: trace/roundtrip differs |
| S2-21 | Desktop polygon/line gestures cancel safely; touch pinch/cancel sends no geometry or device writes; View still works | targeted desktop and touch safety smoke | Turn cancelled pointer into commit: config rev/service trace unexpectedly changes |
| S2-22 | Collection/preview stay within §7 budgets and do not load the editor graph in View | backend load test, selected-radar browser perf, bundle budget | Unbounded response or editor import in initial graph exceeds cap; baseline/candidate artifact exposes regression |

## 11. Test execution and performance/security evidence

Implement shared fixtures for local centimetres → calibrated plan coordinates,
rectangle quantization, polygon edges, exclusion line side and generations.
Include real-data-shaped ghosts, off-room valid targets, count-only zones and
deliberately malformed snapshots. A contributed CSV may become a test fixture
only after contributor consent and removal of identifying metadata; synthetic
fixtures are sufficient for mandatory automated contracts.

Planned commands: `npm run typecheck`, `npm test`, `npm run build`,
`npm run bundle:sync`, `npm run bundle:budget`,
`node demo/smoke_radar_zones.mjs`, `node demo/smoke_radar_recording.mjs`,
`node scripts/check-docs.mjs`, and `python -m pytest tests_backend -q` in the
supported Linux/WSL HA harness. Native Windows pure tests do not prove the HA
authorization/storage harness. Register the new protective backend/smoke
witnesses in `scripts/mutation-gate.mjs` during implementation.

Capture a baseline/candidate artifact using eight synthetic active recorders,
one 10,000-point selected cloud, and a normal large-house View client. UI
updates cloud at most once per second; no full config rebuild per sample, no
per-point SVG nodes and no continuous polling in View. Storage/score work must
yield or run in an executor; HA event-loop callback p95 budget is 10 ms for
accepted frames. Query/score cancels stale client work; at most one request
per selected source. Report actual elapsed times, encoded bytes, buffer peaks,
and frame/callback counts, not a generic “fast”. Initial View dependency graph
must remain within the existing 256,000-byte gzip budget. Existing selected
render/interaction/performance gates still apply to touched modules.

Security artifact: table of authenticated editor/read-only/disabled-integration
and revoked users, each command exercised, raw canary leakage checks, service
authorization outcomes, quotas and negative witnesses. No public screenshot
or release artifact contains a real home's raw cloud without separate consent.

## 12. Risks, rollback and release artifacts

Risks: optimistic HA numbers cannot confirm UART persistence; intermediate
device states can affect automation; room/reflection filters can hide real
targets; biased/throttled sampling cannot measure occupied time; source
reconfiguration can invalidate old geometry; rights changes and late callbacks
can leak/revive raw data; big recordings can block I/O or exhaust storage.
The explicit proof grades, epoch boundaries, server guards and caps above are
required mitigations, not optional improvements.

Operational rollback: Stop recording, Clear observations with the current
version, disable local reflectors/zone display or set `radar.enabled:false`.
This does not revert device settings: use explicit Restore previous values
with fresh confirmation, or the vendor's own editor. A code rollback preserves
optional config fields and makes unsupported operations inert; recommend no
marker editing with older frontends. There is no migration that silently
deletes user configuration and no automatic hardware rollback. Merely disabling
`settings.radar.show_live` hides output but is not a privacy Stop control.

Implementation release must include both `docs/CHANGELOG.md` and
`docs/CHANGELOG.ru.md`, issue links, updated `docs/USER-GUIDE.ru.md` (desktop
recommendation, permissions, hardware warnings, retention/backups), English
user-facing documentation, `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
field registry and `docs/DEVELOPMENT.md` for HA harness/device proof caveats.
`docs/SCOPE.md` records the narrow #485 exception in this specification revision;
verify at implementation/release that local recording and its limits stay within
that approved boundary, without silently broadening it.
Golden/screenshots: selected local/device zones, rotated LD2450 rectangle,
FP2 mapping, cloud/score, partial/unverified outcome, ordinary unchanged
View/kiosk in light/dark en/ru. Capture/accept only through the repository's
Linux CI/WSL policy and reviewed complete artifacts, never by accepting a
partial baseline merely to make a gate green. Include the performance/security
artifacts from §11. Update status/version/release notes only for the actually
delivered stage, never claim heat maps/fusion shipped with this stage.

Exact-SHA Validate and required heavy gates precede a beta/RC; stable is later
promotion-only. This specification commit needs no product build, new tests,
screenshots, changelog claiming shipped behaviour, or product version bump.
Reaching S5 authorizes future development through the process; it does not
start implementation under the current user's documentation-only request.

## 13. Technical assumptions — accepted provisionally, change freely in review

The owner has settled visible defaults; no unanswered product choice remains
here. Module names, WS suffixes, HA Store shard format, resource caps, token
lifetime, quantization tie rule and test filenames are concrete engineering
choices for review, not owner questions. They may change with equivalent
boundedness, privacy, UX and acceptance witnesses. Runtime storage must remain
separate from portable configuration regardless of implementation format.

Primary constraints checked for this task: [ESPHome LD2450](https://esphome.io/components/sensor/ld2450/),
[number bounds in ESPHome 2026.8.2](https://github.com/esphome/esphome/blob/2026.8.2/esphome/components/ld2450/number/__init__.py),
[optimistic number publication](https://github.com/esphome/esphome/blob/2026.8.2/esphome/components/ld2450/number/zone_coordinate_number.cpp),
[Aqara FP2 connection capabilities](https://www.aqara.com/en/product/presence-sensor-fp2/).
The skill Home Assistant Best Practices influenced the use of exact entity
references, native authorization/storage boundaries and zero implicit HA
automation/entity administration; it does not add a separate product dependency.
