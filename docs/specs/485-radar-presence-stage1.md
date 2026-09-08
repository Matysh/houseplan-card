# #485 — Stage 1: sources, calibration and live presence

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485).
Read the [common contract](485-radar-presence.md) first. This is a planned
implementation, not code already shipped. The owner requested stopping at S5
after independent review; this document does not authorize starting S6 now.

## 1. Before / after, scope and integration seams

Before, an administrator can place the ordinary radar device but cannot see its
coordinate observations on the plan. They read separate HA sensors/spreadsheets.
After, they bind available sources, identify the physical installation, calibrate
and see current observations; household members need no editor or hover action.
Presence, position and source availability are separate facts.

Included: explicit source/capability model; safe discovery/manual mapping; physical
mount, orientation, mirror and known units; two-position calibration and manual
alternative; live dots/arcs/read-only known zones/presence; one-room clipping;
short diagnostic trail; health, validation, permissions and lifecycle. Excluded:
raw recording, zone writes/drawing, reflectors, multi-room fusion, heat maps and
derived HA entities (specified in stages 2–3). No stable person identification.

Existing integration points, inspected on the common baseline:

| Existing file/module | Required change |
|---|---|
| `src/types.ts`, `src/config-store.ts` | Optional marker/settings fields and revisioned save; no local authoritative parallel config |
| `src/houseplan-editor-runtime.ts` | Add section to existing marker dialog; delegate lazy setup instead of growing monolith |
| `src/editor-secondary.ts`, `src/editors/` | Reuse context surface for selected radar setup and safe exit |
| `src/houseplan-card.ts`, `render-device-snapshot.ts`, `houseplan-render-lifecycle.ts` | Subscribe selected space; render normalized live snapshots without reparsing HA values per marker |
| `src/space-geometry.ts`, `src/live-viewport.ts` | Canonical square normalized/render conversion and existing projection/viewport seams |
| `src/styles/{devices,dialogs,chrome}.styles.ts`, i18n dictionaries | Quiet live visuals, setup layout and en/ru text |
| `custom_components/houseplan/{__init__,store}.py` | Coordinator setup/reconcile/unload ownership |
| `custom_components/houseplan/{validation,websocket_api,auth}.py` | Change-aware validation, capabilities, authenticated commands and one `may_write` policy |
| `scripts/config-schema.json`, `scripts/config-field-registry.mjs` | Generated schema parity and explicit compatibility classification |

Proposed pure/client modules: `src/radar-model.ts`, `radar-geometry.ts`,
`radar-live.ts`, `radar-render.ts`, `src/editors/radar-setup.ts`. Backend:
`radar.py` (source coordinator), `radar_geometry.py`, `radar_validation.py`,
`radar_websocket.py`. Subsequent stages extend these contracts, not a second
source pipeline. Existing vacuum calibration/trails are precedents, not shared
mutable state. Names may change in review without changing the contracts.

## 2. Entry, defaults and ordinary use

Device editor → select an eligible device or placed-entity marker → **Presence
on plan**. Owner clarification of 2026-09-08: show this section **only for
suitable devices**, not every device in the editor. Without eligibility there
is no main section header, placeholder, disabled switch, unsupported teaser or
primary radar setup button. Q5's accepted secondary manual-entry action below
is the deliberate route for unknown/custom hardware, not an automatic section.
The global display preference below remains unchanged.

Section eligibility is distinct from live availability and from successful
automatic source assignment:

- A positive presence-radar device/profile match or a verified radar-specific
  source-role descriptor on the exact owning device makes it eligible. Match
  evidence is structural adapter/registry metadata, not a friendly-name search.
  It must support at least one of the four data classes in §3; no coordinate
  capability is required for a supported range/zone/presence-only radar.
- Missing/ambiguous axis bindings or unavailable/disabled source entities do
  not hide a positively identified radar: it still offers manual source
  assignment/repair under §3. Eligibility does not require a live `on` state,
  currently detected targets or a successful calibration.
- An already saved `marker.radar` configuration keeps its section accessible
  for repair, disabling or removal when sources/metadata become unavailable or
  the saved version is unsupported. Unsupported/malformed saved content remains
  inert and preserved under the existing compatibility rules; showing repair
  grants no runtime or device-write capability.
- The user's explicit **This is a presence radar** action admits an otherwise
  unrecognized real device or placed-entity marker to manual setup for the
  current draft session. No positive manufacturer/profile descriptor or owning
  HA `device_id` is required for this route. It neither preselects numeric
  sources nor grants live, calibration or hardware-write capabilities.
- A normal light, switch, temperature/humidity sensor, ordinary PIR, virtual
  marker, or a device with merely arbitrary numeric/binary entities is not a
  radar candidate automatically. Two numeric values or a generic occupancy/motion
  class alone do not prove a radar profile. A virtual marker with inherited invalid radar
  content may show cleanup-only repair, never enable live setup.
- Unresolved metadata with no saved radar configuration is not positive evidence:
  do not flash a generic section while loading. The secondary manual-entry
  action remains available without that metadata. Reevaluate the same exact
  device when registry data becomes available;
  never retarget to another device in order to make the section appear.

Use one derived eligibility result for the section entry and its child tools:
positive recognition, existing saved repair, or explicit session-local manual
entry. Do not persist a new display flag or run source subscriptions merely to
decide whether a header is visible. The resolver's concrete metadata signatures
are engineering choices with positive and negative fixtures, not a UI taxonomy.

**Manual entry (Q5).** In the marker editor's collapsed **Additional actions**
group at the end of its body, offer **This is a presence radar** for a real
device/placed-entity binding that has neither positive recognition nor a saved
radar block. The group/action is secondary, keyboard/touch operable and governed
by normal editor write access; virtual markers never get it. This explicit
escape hatch is available even if registry identity is unresolved, including
a standalone `sensor` with no `device_id`. Ordinary devices still have no main
radar section unless the administrator deliberately takes this action.

The action opens the same setup wizard at manual profile/source selection,
with no auto-picked profile/entities and no extra confirmation dialog. The
user chooses one of the generic profiles in §3 and exact sources, then follows
the existing setup/Save flow. Persist only the complete normal `marker.radar`
block on successful atomic Save, not an `is_radar` flag or a provisional block.
Cancel/Esc, leaving setup, closing the editor or page hide discards this
session-local declaration with the draft and releases any setup listeners. If
there was no eligibility beforehand, the main section stays hidden on return
or reopening. Saving makes subsequent access use the saved-configuration path,
including while disabled/offline. Removing that saved configuration restores
automatic-only eligibility and the secondary entry if still unrecognized.
Changing the marker binding clears an unsaved manual declaration; it must not
silently transfer consent or draft sources to another device/virtual marker.

Resolve an `entity:` marker's owning device through the existing registry
snapshot's entity `device_id` and `src/ha-binding-status.ts` authority. Inspect
full available registry metadata, not only the enabled-state `dev.entities`
projection: filtering out disabled diagnostic entities must not hide a known
radar. Proposed `radar-model.ts` owns the pure section predicate; the existing
conditional vacuum section in `houseplan-editor-runtime.ts` is a UI integration
precedent, not radar detection logic. Completely unidentifiable hardware cannot
be automatically distinguished from an ordinary PIR; Q5's explicit manual
entry resolves this without making the section universal. An entity without an
owning device cannot auto-discover sibling sources but remains eligible for
explicit generic mapping. This does not remove manual role assignment from an
identified radar.

For eligible, not-yet-configured radars the section is collapsed/off. No automatic
enabling on upgrade, placement or source discovery. A virtual marker cannot own
a live radar binding. Source entities need not be separately placed on the plan.

The first section has: configure switch; connection/profile; capability summary;
selected room; **Configure on plan**; **Show live presence**. On an eligible
radar or its saved repair path, unsupported/missing data
gets a short explanation and manual source selection, not dozens of disabled
advanced controls. Advanced displays exact source ids, values, units and report
ages so an administrator can correct a connection without editing YAML.

General Settings → Display adds **Show presence on the plan**, default true.
It remains present even when no eligible radar is discovered/configured: the
owner requested conditional visibility only for the device-editor section.
Both global and per-radar `show_live` must be true, and the radar must be enabled
and valid. Hiding this layer does not alter HA presence, calibration, or later
recording consent. The global switch hides all live radar layers for shared
configuration; an unsaved diagnostic overlay remains local to its setup session.

Ordinary View shows configured current marks automatically. No diagnostic trails,
sensor sectors, raw counts, point labels or setup handles. Device actions retain
the selected `tap_action`; no extra action is forced onto the icon. Radar health
appears in the existing device information surface when opened by the supported
action/hold path, and in setup. Dot overlays never become independent devices.
Presence-only sources keep the existing marker state; do not add a floor fill
which competes with existing light effects. Known occupied zones use a thin
outline/very low-opacity presence overlay distinct from light Glow.

## 3. Source resolution and capabilities

Persist exact entity ids only. Discovery can propose candidates from the owning
HA device and a verified adapter signature; accepting the summary is explicit.
Do not infer axes/units from translated friendly names, or select an unrelated
global entity with a similar name. A placed entity resolves its current registry
device for discovery; on an eligible radar or existing saved repair path,
missing/limited role metadata offers manual selection without claiming deleted
or disabled. With neither positive radar evidence nor saved configuration, §2
keeps the main section hidden until explicit manual entry. Existing binding-status
authority remains in use.

Manual generic mapping does not require an owning HA device, known firmware or
radar-specific `device_class`. It accepts exact, explicitly selected `sensor.*`
and `binary_sensor.*` roles required by the chosen profile, even when their
`device_id` is absent or differs. List only sources readable by the current
user; present their exact ids and device attribution (when known), with no
cross-device auto-binding or fuzzy-name fallback. Numeric profiles still require
their complete unit/axis/range conventions and finite values per this section.
For example, a custom numeric distance sensor may use `range_v1` without an
occupancy source or manufacturer signature; it yields an arc, not an invented
target point. Marker/space ownership and per-source read ACL remain mandatory.
Manual declaration never supplies a verified hardware adapter signature.

For LD2450 automatic role mapping, require the same ESPHome device, recognized
LD2450 descriptor and a complete unique role set exposed by registry metadata.
If metadata cannot prove a unique x/y pairing/slot, preselect nothing: show the
candidate list grouped by that device for manual confirmation. No entity registry
enablement, ESPHome reflash, HA restart or `force_update` edit occurs here.

Profiles and capability inputs:

| Profile | Required sources / conventions | Output |
|---|---|---|
| `esphome_ld2450_v1` | 1–3 explicitly matched X/Y slots, units mm; canonical x right, y forward; optional per-slot presence/speed and global occupancy/count | Cartesian targets; optional known hardware-zone read capability |
| `cartesian_v1` | 1–8 slots of exact numeric x/y sources, declared unit and axis mapping; optional gates | Cartesian targets |
| `polar_v1` | 1–8 slots with distance and bearing, declared length/angle units and angle origin/direction | Convert to canonical Cartesian targets; no inferred bearing |
| `range_v1` | One or two named distance channels, explicit length unit, optional occupancy gate | Arc(s), not two people; direction/FOV must be known or explicitly entered |
| `zones_v1` | Existing exact occupancy/count entities; known adapter geometry if available | Read-only zone outlines; unknown geometry awaits Stage-2 manual mapping |
| `presence_v1` | Exact `binary_sensor` occupancy, optional known diagnostic range/FOV | Presence state only; no position or count |

Known units mm/cm/m/in/ft convert by exact factors 0.1/1/100/2.54/30.48 to cm.
Absent/unrecognized units require explicit user confirmation of the declared
unit; conflicting present units are rejected with the source identified. Never
guess from values. Cartesian axis mapping is a permutation of x/y and signs
±1, no arbitrary formula. Polar input declares radians/degrees, zero-forward
or zero-right and clockwise/counterclockwise; distance is nonnegative. Source
strings `unknown`, `unavailable`, empty, NaN/Infinity are not numeric zero.
Cartesian x=0, negative x and valid origin observations remain legal.

Global occupancy `off` suppresses all targets immediately; `unknown/unavailable`
gate suppresses gated geometry without becoming `off`. Per-slot gates affect
their own slots. `on` allows coordinates but never manufactures them. Optional
count is a consistency/diagnostic input, not a stable assignment of slot numbers
or permission to keep unknown slots visible. A contradictory fresh zero count
with valid coordinates is `inconsistent`, not a silently chosen truth.

Backend capabilities are runtime facts: `coordinates`, `range`, `zone_state`,
`known_zone_geometry`, `reported_presence`, `coherent_frames`, `hardware_zones`.
Stage-1 hardware zones are read-only and require the complete same-device
descriptor later specified in Stage 2; optimistic HA values are marked as HA
reported geometry, not device-verified configuration. FP2 branding alone never
grants coordinates or hardware writes.

## 4. Measurement health, pairing and delivery

Source freshness is **HA report freshness**, not proof that a UART/radio produced
a new physical measurement. HA 2024.6.0 (the current minimum) already contains
`state_reported` and `State.last_reported`. Subscribe with an event filter to
the exact configured entity ids; never listen to all state reports or use
`last_changed` as sample time. The backend timestamp is authoritative.

For independent numeric entities, `pair_quality:'bounded_latest'` means both
values were reported within 3 seconds and their report times differ by <=1.5
seconds. Coalesce reports for 100 ms before publishing a pair. This tolerates
independent ~1 Hz channels but **does not claim an atomic sensor frame**. If a
future verified adapter exposes a common sample sequence/timestamp in its
defined payload, use it to establish `coherent`; generic arbitrary attribute
expressions are not part of this implementation. Stages 2–3 may not upgrade
`bounded_latest` to coherent merely because values are numerically close.

The standard LD2450 connection suppresses repeated coordinate values and its
timeout filter repeats the last value only once. A stationary target, or a
target with an unchanged axis, can therefore lose usable current coordinates.
After either axis expires, hide its dot and show **Presence reported; current
position unavailable** if occupancy remains on. Setup explains this telemetry
limitation and shows which axis has no recent report; no silent firmware edits
or guessed movement repair it. A profile that legitimately republishes values
may keep them visible while fresh: UI calls these reported coordinates, never
guaranteed physical freshness. An integration that continuously republishes
incorrect data cannot be detected from HA state alone.

Range channels use the same <=3 s report lease. Binary presence/zone entities
use HA's current on/off/unknown/unavailable contract, not the coordinate lease:
a still person legitimately produces no binary transitions for a long time.
Their last change is labelled as a state change, not “last measured”. Losing a
bound entity or configured availability gate yields unknown/unavailable. Never
equate HA node connectivity with proof of fresh radar coordinates.

On coordinator startup/reconnect, initial values keep their actual report ages;
loading a snapshot does not renew them. After a failed/incomplete source epoch,
require a complete eligible pair before showing a dot again. Invalid slot
coordinates clear that slot immediately, even during a presence hold timeout.
No guessed zero-target frame from an empty list of expired slots.

For LD2450, `unknown` X/Y by itself is not explicit absence: the driver also
uses missing values when a slot is unused. Global occupancy `off` is explicit
negative evidence under that source's current HA state semantics; an eligible
fresh global target count of zero with no conflicting valid target is also
explicit negative. Otherwise an unknown slot keeps coordinate completeness
false unless the verified profile has an explicit per-slot absence signal.
Do not silently deduce missing slots from a nonzero count or assume that target
indices are packed. Generic profiles use exact per-slot/global gates for the
same purpose. A complete negative produces an empty frame, not an error.

Normalized frame contains `server_session_id,marker_id,source_generation,
calibration_revision,seq,reported_at,expires_at,health,reported_presence,
complete,targets[],ranges[],zones[]`. A target includes `slot`, canonical cm
`x,y`, report times, `pair_quality`, projected plan position, `included` and
exclusion reason. `complete` means every configured slot is either a valid
current observation or explicitly absent in a supported source report; stale
missing data makes the frame incomplete. Source slot ids are ephemeral labels.

Live subscription is authenticated, selected by exact space id, maximum 32
radars/space response, <=256 targets total. Read-only View receives only allowed
live projected output/health, no raw coordinates, source ids or historical
buffers. Require HA read permission for every bound entity contributing to a
delivered radar; otherwise withhold that radar's values as restricted. Setup
detail requires `may_write` plus the same source read checks. Revoked permissions
are rechecked on publish and at most each minute even without source events;
clear the affected connection's output. Do not publish coordinates on broad HA
events. Use connection-scoped WS delivery.

Publish at most 4 geometry frames/s/radar, latest-wins within a bounded slot;
health/clear transitions are immediate and cannot be dropped by rate limiting.
Maximum one active subscription per card instance; server deduplicates source
listeners. On space/mode change, page hidden, disconnect or unmount, unsubscribe
and clear local arrays/trails; resume uses a new snapshot, never interpolation
from the previous session. Browser uses remaining lease measured monotonically
from receipt, reduced by transport age; expiration hides output even if WS dies
without a clean close. Invalid or late session/sequence/revision messages are
discarded. A slow consumer receives latest state, not an unbounded frame queue.

## 5. Geometry and calibration

### 5.1 Canonical space

Use actual current `src/space-geometry.ts`, not the legacy bitmap coordinate
section of ARCHITECTURE: persisted coordinates are square normalized units;
render space is `NORM_W=1000` square; `GRID_N=240`; `GRID_PITCH=1000/240`.
One normalized unit represents `240 * cell_cm` physical centimetres. Stored
spaces without `cell_cm` retain the existing 5 cm compatibility default; new
space defaults are not changed by this issue.

Physical mount `m=(mx,my)` is stored in normalized plan units independently of
the marker's decorative layout position. For local centimetres `(x,y)` with
x right and y forward, heading θ clockwise from plan-up and mirror `s=-1`
or nonmirror `s=1`, projection is:

`p = m + (s*x*cosθ + y*sinθ, s*x*sinθ - y*cosθ) / (240*cell_cm)`.

Inverse uses the transpose orthogonal matrix and the same known scale. No
independent x/y stretch, fit-to-room rectangle, north/compass substitution or
wallpaper transform. Plan up is not geographic north. Validate finite results
within `CANVAS_LIMIT=5000` normalized; a physically impossible numerical input
(absolute local distance >100 m) is invalid rather than clamped onto the plan.
Shared TS/Python fixtures cover ±x, y=0, headings 0/90/180/270, mirror, imperial
conversion, non-origin mount and 1/5 cm spaces representing the same room.

### 5.2 Wizard, no premature persistence

**Touch editor: best effort / intentionally degraded.** The calibration wizard,
including mount/reference placement, uses the desktop Device editor as its
reference environment. This is deliberate, not a missing mobile implementation
promise: mark the reference on the computer first, start the 10-second countdown,
walk to the marked physical position without carrying the computer, remain still
during capture, then return to inspect the result. The existing countdown makes
that single-person desktop workflow possible; a phone/second controller is not
required. If the user cannot complete the timed exercise comfortably, Retry or
manual direction/mirror setup remains available rather than accepting a bad fit.

A phone/tablet may run the same wizard best-effort, but precise point placement
and full mobile parity are not promised. Show the desktop recommendation before
setup and describe the limitation in both guides and release notes. Cancel/Back,
lost permission, page hide, pinch, a second pointer or `pointercancel` must never
commit a reference, complete a capture or save configuration accidentally. Page
hide interrupts capture and clears transient samples; returning offers Retry,
not a fabricated successful measurement. Essential safe exit/confirmation
controls remain reachable. View/kiosk retain full touch support; S1-10/S1-18
and touch safety smoke cover this floor, not unsupported precision parity.

**Step 1: Installation.** Select the existing room; place the real sensor mount
on the plan and drag its direction arrow. If decorative marker placement is
available, offer it as a starting suggestion only, with text distinguishing it
from physical installation. Show known/entered sector as an approximate guide;
unknown FOV stays absent. The room must belong to the exact marker's owner
space. A room without contour warns “No room boundary: points are not clipped”.

**Step 2: Two reference positions.** Place reference A on the plan → Start
measurement → 10-second countdown to walk there → 5-second capture while alone
and still. Collect at least three eligible coordinate pairs spanning >=2 s,
with exactly one valid target throughout capture and no competing slot/gate
failure. Median X/Y is the sample; reject if any sample is >15 cm from the
median. Then do B. Missing/insufficient/ambiguous data offers Retry, never an
arbitrary slot selection. All measurements remain browser memory only.

Mount and units are known. Each reference must be >=50 cm from mount; vectors
to A and B must form an angle between 20° and 160° (nearly collinear vectors
cannot determine mirror). For both mirror hypotheses, solve the best rigid
rotation about the mount by least squares using both vectors, with unit scale
fixed. Require each radial-distance mismatch <=max(20 cm,15% of reference
distance), RMS projected error <=20 cm and individual error <=30 cm. If both
mirror candidates pass with RMS difference <10 cm, report ambiguous rather
than choose. These are explicit engineering tolerances, not accuracy promises.

Manual alternative exposes direction and mirror with live preview; it does
not fit fake translation/scale or mark an unmeasured setup as auto-verified.
Range-only requires mount/direction/known FOV, not a two-point position fit;
zone/presence-only skips coordinate calibration. If range FOV is unknown,
retain numeric range in setup and presence only in View until supplied.

**Step 3: Check.** Show live output and optional local 8-second diagnostic trail;
offer a third independent marked position and display observed distance error
without adjusting the fitted parameters. Failed data remains an explicit error.
The third check is recommended, not a hidden Save prerequisite. Summary states
auto-fit/manual, room, source class, unit and whether clipping is available.
Save commits one revisioned radar block after server validation. Cancel/Esc,
source/space removal, leaving the editor or lost permission disposes the draft,
restores the previous view and makes no config/service write. Closing a dirty
wizard asks to discard; losing a source does not silently save partial setup.

Two clients: Save with stale `expected_rev` returns conflict; keep draft for
inspection, offer Reload, do not overwrite or rebase physical calibration
silently. Changing source/unit/axis/installation during a draft resets captures.
An incoming accepted change to that radar invalidates the draft save token.

### 5.3 Live membership and rendering

If selected room has a valid real polygon, use its existing physical room
boundary authority, including concavity. Do not derive a rectangle from label
coordinates. Points inside/on the boundary (physical tolerance 0.1 cm) remain;
outside-room observations are excluded from display, not diagnosed as ghosts.
Missing/invalid/deleted room ref suspends the radar; existing room with no
usable contour allows unclipped calibrated output with the stated warning.

Membership uses raw projected points before interpolation. Arcs are clipped
geometrically to the allowed polygon, not tested solely at their midpoint;
known zone geometry intersects that polygon. If clipping removes all geometry,
do not replace it with a point on the wall or mark the room empty on this basis.

Dots: 8 CSS px diameter, contrast rim 2 px and theme-aware presence accent;
never depend on color alone. Render within a dedicated pointer-transparent
floor-level overlay using existing pan/zoom/isometry transforms, compensating
screen radius to avoid enormous dots at high zoom. Multiple independent radar
observations may overlap; do not claim one-to-one people correspondence. Arcs
use 2 CSS px stroke and explicit range uncertainty in the radar info surface.
Known occupied zones use 2 px outline and <=0.08 fill opacity; unknown state
does not show occupied fill. Ordinary presence-only markers retain existing
visuals. No per-frame spoken announcements.

Visual smoothing lasts <=250 ms, no extrapolation, follows valid included
endpoints from one slot/session/generation only. Disable for reduced motion,
gaps, availability loss, room/filter changes or jumps >1 m; snap to the new
observation instead of drawing a continuous travel claim. Never interpolate
through an excluded area: clip the rendered segment/output to allowed geometry.
Slots are not identities. Diagnostic trail retains at most 8 seconds/32 samples
per slot, is segmented on the same gaps, and is deleted on setup exit/page hide.
No Stage-1 persistent history or server raw trail exists.

## 6. Saved fields, validity and lifecycle

| Path | Type / semantics |
|---|---|
| `settings.radar` | Optional object; `show_live?:boolean`, absent true; Stage-3 extensions preserved |
| `marker.radar` | Optional object; `version:1`, `enabled:boolean`, `show_live?:boolean` absent true; maximum 32 configured blocks per integration |
| `radar.profile` | One of the six profile identifiers in §3 |
| `radar.sources` | `{slots?:Slot[],ranges?:Range[],zones?:ZoneSource[],occupancy_entity?:string,count_entity?:string,availability_entity?:string}`; only applicable subsets accepted |
| `Slot` | `{id,x_entity,y_entity,unit,swap_xy?,x_sign?,y_sign?,presence_entity?}` for Cartesian; polar instead `{id,distance_entity,angle_entity,unit,angle_unit,angle_zero,angle_clockwise,presence_entity?}`; max8, LD2450 max3; distinct bounded slot ids |
| `Range` | `{id,entity_id,unit,presence_entity?}`; max2; moving/still labels are descriptive, not identities |
| `ZoneSource` | `{id,kind:'occupancy'\|'count',entity_id}`; max32; Stage1 geometry only from verified adapter descriptor |
| `radar.mount` | `{installation_id,x,y,heading_deg,range_cm?,fov_deg?}` installation UUID, normalized finite coordinates, heading [0,360), optional range (0,10000] cm/FOV (0,360]; physical install, not marker layout |
| `radar.room_id` | Required exact existing room id in owner space; may be a room without a contour; no nearest-room fallback |
| `radar.calibration` | `{method:'manual'\|'two_point'\|'not_required',mirror:boolean,cell_cm:number,refs?:[{plan:{x,y},local_cm:{x,y}}],rms_cm?:number}`; two_point exactly2 refs and valid §5 fit; no timestamps or raw captures |

Coordinate/length sources are exact `sensor.*`; gates `binary_sensor.*`; count
integer >=0; supported bools strict. Existing entity-id maximum255 applies;
slot/zone ids 1–64 `[A-Za-z0-9_-]`; no wildcards/templates/JS/attribute expressions.
Expected source/entity data can be missing at runtime without deleting config;
Save requires structurally valid mappings and confirmed units, not perpetual
network availability. Invalid payload/new unknown version is rejected; untouched
future version remains lossless/inert on unrelated writes.

Known-only field validation does not strip Stage-2/3 extensions or unknown
siblings. Geometry follows existing normalized coordinate envelope and 2 MiB
total config ceiling. Source generations are computed server-side from accepted
configuration; a client cannot fake generation to reuse stale setup/history.
Stored calibration's `cell_cm` detects a changed physical scale. Source schema
permits missing calibration only when disabled; enabling requires a valid method.

The initial setup and explicit Change installation generate a fresh UUID in
the saved mount. That UUID, mount x/y, bindings/conventions and owner space form
the server generation fingerprint; heading/mirror/reference corrections alone
form a calibration revision. A client-supplied UUID is only a change marker,
never an authorization token or a way to preserve generation across changed
physical coordinates. Moving a physical sensor away and back must use Change
installation even when final x/y happen to be identical. There is no automatic
way to detect an unreported physical move from HA coordinates.

Moving the marker's decorative icon is unrelated to `mount`. Explicit **Change
installation** enters setup, suspends accepted projection only upon Save and
creates a new source generation; Cancel keeps old calibration. Changing the
owner space through existing marker relocation preserves original block inert
as needing setup, never projects it onto another floor. Room reassignment is
explicit and rechecks membership without silently moving physical mount.

Space import/duplicate/removal and full/plan-only exports follow the common
contract. Extend `_space_marker_dependencies` and copy/remap/cleanup authorities
to include radar owner/room refs. Shared wall optimization that preserves room
coordinate geometry does not reset calibration. Geometry edits refresh clipping;
room deletion stops output, preserved invalid ref requires repair. Physical
scale change suspends projection until calibration is acknowledged anew. Empty
spaces do not create dummy models or surviving subscriptions. Rename entity:
follow existing positive registry-id evidence only if its binding resolver
already supports it; never invent cross-name fallback. Otherwise show repair.

## 7. WebSocket contract and authorization

`config/get` advertises `radar_stage1_api:1` only after coordinator setup. Absent
capability disables radar operations with an update message; fields still survive.
Use exact space/marker ids, not arbitrary source arrays in ordinary subscribe.

| Command | Request | Authority/result |
|---|---|---|
| `houseplan/radar/subscribe` | `{space_id}` | Authenticated live subscription; per-source read permission; safe projected frames + health only |
| `houseplan/radar/setup/inspect` | `{marker_id,draft_sources?}` | `may_write` + source read permission; bounded capability/source-value snapshot; no persistence/services |
| `houseplan/radar/setup/subscribe` | `{marker_id,draft_sources?,expected_config_rev}` | Same guards; ephemeral setup values, <=1 draft subscription/user/marker, <=8 globally |

Draft sources use the same strict schema/size caps and owner checks: the
existing marker belongs to the requested space/configuration and is writable
under `may_write`; every explicitly selected source is independently readable.
Generic profiles do not require shared/non-null HA `device_id`. Same-device
checks remain mandatory for verified hardware adapter roles, not generic input.
Neither manual-entry consent nor frontend eligibility is authorization; the
server validates the draft profile/source graph itself. Setup
does not gain permission to query arbitrary HA state using an unvalidated
attribute path. Server rejects disabled/removed markers, stale revisions or
invalid source graph before allocating listeners. Subscription ids use HA's
normal unsubscribe protocol; no custom unauthenticated stream endpoint.
Saving is ordinary `houseplan/config/set` with `expected_rev`, validated via
the same source/geometry authority. Stage1 has no device-control command.

New stable errors: `invalid_radar`, `unsupported_capability`, `not_ready`,
`source_unavailable`, `source_restricted`, `invalid_selection`, `conflict`,
`rate_limited`. Each maps to localized text; no raw exception/source payload
in UI/logs. Inspect <=10requests/min/user; subscribe max4 card streams/user
plus the separate bounded setup stream; response <=256KiB. Limits do not extend
sample leases. Teardown checks after awaits prevent resurrection on unload.

## 8. i18n EN/RU

Keys prefixed `radar.` in the existing dictionaries; reuse common Save/Cancel/
Retry/Close and device/room/entity selection keys. Existing locale formatters
handle values; every new dynamic error is mapped to a translated key.

| Key | English | Русский |
|---|---|---|
| `title` | Presence on plan | Присутствие на плане |
| `additional_actions` | Additional actions | Дополнительные действия |
| `declare_radar` | This is a presence radar | Это радар присутствия |
| `show_global` | Show presence on the plan | Показывать присутствие на плане |
| `enable` | Configure presence on plan | Настроить присутствие на плане |
| `show_live` | Show live presence | Показывать текущее присутствие |
| `configure` | Configure on plan | Настроить на плане |
| `profile` | Connection type | Тип подключения |
| `sources` | Data sources | Источники данных |
| `manual_sources` | Select sources manually | Выбрать источники вручную |
| `ambiguous_sources` | Check the source assignments | Проверьте назначение источников |
| `unsupported` | This connection has no supported position data | Подключение не передаёт поддерживаемые данные о положении |
| `room` | Observed room | Наблюдаемая комната |
| `mount` | Physical sensor position | Физическое положение датчика |
| `mount_hint` | Moving the device icon does not move this installation | Перемещение иконки не меняет физическую установку |
| `change_installation` | Change installation | Изменить установку |
| `heading` | Direction from plan up | Направление относительно верха плана |
| `mirror` | Mirror the horizontal axis | Отразить горизонтальную ось |
| `unit` | Coordinate unit | Единица координат |
| `unit_required` | Confirm the source unit before continuing | Подтвердите единицу источника для продолжения |
| `unit_conflict` | The source unit does not match the selected unit | Единица источника не совпадает с выбранной |
| `step_install` | Installation | Установка |
| `step_measure` | Reference positions | Контрольные положения |
| `step_check` | Check and save | Проверить и сохранить |
| `mark_reference` | Mark reference {point} on the plan | Укажите положение {point} на плане |
| `start_measure` | Start measurement | Начать измерение |
| `countdown` | Stand at the mark in {seconds} seconds | Встаньте в отмеченное место через {seconds} с |
| `stay_still` | Stand still and alone while measuring | Во время измерения стойте неподвижно и в одиночестве |
| `insufficient_samples` | Not enough current coordinates. Retry or use manual setup. | Недостаточно актуальных координат. Повторите или настройте вручную. |
| `ambiguous_target` | More than one target: repeat alone | Несколько целей: повторите измерение в одиночестве |
| `bad_references` | Choose separated references in different directions from the sensor | Выберите разнесённые положения в разных направлениях от датчика |
| `bad_fit` | Measurements do not match. Check units, mount and references. | Измерения не совпадают. Проверьте единицы, установку и контрольные положения. |
| `manual_calibration` | Set direction and mirror manually | Задать направление и отражение вручную |
| `check_third` | Check at another position | Проверить в другом положении |
| `error_distance` | Position difference: {distance} | Расхождение положения: {distance} |
| `discard_setup` | Discard the unsaved radar setup? | Отменить несохранённую настройку радара? |
| `no_contour` | No room boundary: points are not clipped | Нет контура комнаты: точки не ограничены её границами |
| `needs_setup` | Installation needs setup | Требуется настройка установки |
| `live` | Current reported positions | Текущие положения по данным датчика |
| `clear` | No targets detected | Цели не обнаружены |
| `position_missing` | Presence reported; current position unavailable | Датчик сообщает присутствие; актуальное положение недоступно |
| `incomplete` | Some position data is unavailable | Часть данных о положении недоступна |
| `offline` | Sensor data unavailable | Данные датчика недоступны |
| `restricted` | No access to the selected sources | Нет доступа к выбранным источникам |
| `inconsistent` | The source reports conflicting values | Источник передаёт противоречивые значения |
| `report_age` | Last report: {age} ago | Последнее сообщение: {age} назад |
| `report_only` | Report time does not verify a new physical measurement | Время сообщения не подтверждает новое физическое измерение |
| `unchanged_axis` | This source may stop reporting an unchanged coordinate; presence can remain available without a position | Источник может не повторять неизменившуюся координату; присутствие может быть доступно без положения |
| `range_uncertain` | Distance is known; direction within the arc is unknown | Дальность известна; направление внутри дуги неизвестно |
| `coverage_estimate` | Approximate coverage, not a detection guarantee | Примерная область обзора, не гарантия обнаружения |
| `trail` | Show the last 8 seconds while checking | Показывать последние 8 секунд при проверке |
| `update_backend` | Update the House Plan integration to use presence on plan | Обновите интеграцию House Plan для присутствия на плане |
| `desktop_hint` | Use a computer for precise setup | Для точной настройки используйте компьютер |
| `profile_cartesian` | Coordinates X/Y | Координаты X/Y |
| `profile_polar` | Distance and bearing | Дальность и угол |
| `profile_range` | Distance only | Только дальность |
| `profile_zones` | Zone states | Состояния зон |
| `profile_presence` | Presence only | Только присутствие |
| `invalid_radar` | Check the radar settings | Проверьте настройки радара |
| `not_ready` | Radar processing is not ready | Обработка данных радара не готова |
| `invalid_selection` | Select an existing room and valid sources | Выберите существующую комнату и допустимые источники |
| `conflict` | Settings changed. Reload before saving. | Настройки изменились. Перечитайте их перед сохранением. |
| `rate_limited` | Too many requests. Try again shortly. | Слишком много запросов. Повторите чуть позже. |

## 9. Acceptance criteria and protective witnesses

Every `S1-*` is required. Proposed test names are not claims of completed tests.

| AC | Contract | Evidence / how it must fail |
|---|---|---|
| S1-1 | Existing marker entry, explicit enable, global/per-radar switches; no new editor | setup smoke, en/ru light/dark golden; auto-enable on discover => no-write assertion fails |
| S1-2 | Exact bindings, deterministic discovery or manual ambiguity, four classes without fabricated capabilities | unit/backend profile fixtures; wrong-name auto-binding or inferred bearing => output differs |
| S1-3 | Units, axis/sign/polar conversion are explicit; zero valid, nonfinite rejected | shared TS/Python fixtures; replace invalid with0 or inches factor => numeric/rejection tests fail |
| S1-4 | Current independent pairs meet report age/skew; no atomic-frame claim; missing-axis degradation is explained | fake-clock backend + setup smoke; last_changed/renew-on-snapshot/stale-axis mutant => hidden-point assertion fails |
| S1-5 | Off/unknown/stale/partial/inconsistent/occupied-without-position distinct; invalid slot clears immediately | backend state table and UI golden; unknown=>clear or held invalid slot => state/set assertion fails |
| S1-6 | One coordinator; bounded subscriptions/rate/size; teardown/reconnect never resurrects old data | backend multi-client/unload races; remove queue/session/cap guard => count/old-canary assertions fail |
| S1-7 | Physical mount independent of decorative icon; projection uses actual normalized physical scale | unit shared fixtures + editor smoke; use wallpaper/viewbox/north or icon position => projected coordinate fails |
| S1-8 | Two reference solve rejects collinear/noisy/ambiguous/multi-target data, no stretch | pure solver tests + source replay wizard; remove each guard => invalid-fit acceptance fails |
| S1-9 | Manual/range/zone/presence paths honest; third check independent and optional | setup smoke state fixtures; silently alter fit on third check => parameter equality fails |
| S1-10 | Save atomic/revisioned, Cancel/source deletion/revoked permission never persists partial setup | two-client smoke/backend writes; skip revision/cancel guard => config/service trace fails |
| S1-11 | Real room polygon clips dots/arcs/zones; missing contour warns, missing room never retargets | concave/shared-boundary fixtures + smoke; replace with bbox/defaultroom => excluded-point canary fails |
| S1-12 | 8s trail/smoothing are session-local, bounded, gap-safe and reduced-motion aware | unit clock + browser resume/rate smoke; bridge gap/persist trail => path/storage assertion fails |
| S1-13 | Live pointer transparency, themes, kiosk/touch, room/device actions and floor projection remain correct | ordinary View/golden/gesture smoke; overlay hitbox or unprojected layer => interaction/geometry fail |
| S1-14 | Live source read ACL and setup may_write; no source/raw/history leak in read-only delivery | HA user matrix, support/export/storage canary; remove ACL/filter => canary leak fails |
| S1-15 | Optional/future/unknown fields safe; exact refs covered by import/copy/Optimize/removal/scale change | backend lifecycle + config roundtrip; retarget/drop sibling/keep invalidcalibration => invariant fails |
| S1-16 | New/old frontend/backend safe; unsupported commands absent; original vacuum/Glow unaffected | rolling-matrix smoke, existing vacuum/light unit/golden; API capability bypass => unsupported-call assertion fails |
| S1-17 | Editor lazy, active load bounded and no idle animation/subscriptions when disabled | bundle graph + baseline/candidate perf + backend timer count; eager editor or runaway listener => budget fails |
| S1-18 | Text, status announcements and safe desktop/touch exit meet §2/5/8 | i18n parity, keyboard/touch smoke, reviewed screenshots; ordinary expected-vs-actual witnesses |
| S1-19 | Main section appears only for recognized radars, an existing saved repair path or explicit session-local manual entry; unavailable/no-target/manual-binding cases retain access, ordinary devices have no automatic section/teaser; global preference remains visible without radars | unit eligibility matrix + device-editor smoke/golden for coordinate/range/zone/presence radars, light/switch/temperature/PIR/virtual/unknown devices and saved broken/future config; remove eligibility guard => ordinary-device header assertion fails; gate by on/valid coordinates => offline/range/manual repair assertion fails; hide global switch until first radar => empty-installation settings assertion fails |
| S1-20 | Secondary manual entry supports unknown/custom radars and standalone sources without device_id; only validated atomic Save persists eligibility, Cancel/exit/binding change does not; declaration grants no source or hardware privileges | device-editor smoke for unrecognized custom range sensor (no device_id or occupancy), explicit multi-device Cartesian bindings, save/reopen/disable/repair/remove and Cancel/reload; unit/backend ACL, invalid-unit and hardware-adapter negative fixtures. Require auto identity => generic-setup witness fails; persist declaration early => cancel-config comparison fails; bypass ACL or adapter proof => restricted-source/service canary fails |

Implementation artifacts: `test/radar-geometry.test.mjs`, `test/radar-model.test.mjs`,
`tests_backend/test_ha_radar.py`, shared JSON coordinate/source fixtures,
`demo/smoke_radar_setup.mjs`, `demo/smoke_radar_live.mjs`, full-scene golden
fixtures. Register protective backend/browser mutations per PROCESS. Include
axis-aligned motion with one suppressed axis, true stationary presence, delayed
HA delivery, unexpected unknown coordinates, concave room, duplicate slots,
disconnected client, scale change and private-source canaries — not only moving
ideal points. Consented field CSV is supplementary, not a blocking dependency.

## 10. Performance, release and rollback

Baseline/candidate workload: 32 configured radars, eight slots each, four output
frames/s, three View clients including 360px phone and wall tablet; repeat with
all disabled and with only one selected setup stream. No full config/layout
rebuild per source frame; listener count depends on unique sources, not clients.
Pure normalization/projection callback p95 <=10ms; browser incremental overlay
update p95 <=8ms on the project's standard perf runner; no introduced >50ms
long task from radar work. Report sample count/hardware/variance with results,
not a generic speed claim. Existing suite budgets and initial gzip256000B remain.
No continuous RAF when output unchanged/hidden; reduced-motion interpolation off.

Implementation loop typecheck/unit/build; Linux CI full HA harness and required
smoke/golden/performance precede beta. Release artifacts follow common §8:
both changelogs, guide/setup/data-quality caveat, architecture, compatibility,
field registry, reviewed full-scene screenshots light/dark/2D/isometry/mobile,
permission and mutation evidence. Current docs-only work runs no implementation
gates and claims no shipped changes.

`docs/SCOPE.md` already records the owner-approved narrow #485 exception as part
of this spec revision. Verify the implementation/release against that boundary;
do not silently broaden it. The guides and release notes explicitly carry the
desktop-first/best-effort-touch calibration limitation from §5.2.

Rollback: hide live to remove visuals; disable radar to detach sources; restore
saved config if needed. No Stage1 external write or raw store to reverse. Older
frontend editing is discouraged; unsupported fields remain inert. Risks include
unknown source conventions, independent coordinate reports, noisy calibration,
loss of fresh stationary coordinates and potentially misleading coverage.
The explicit degraded states and conservative solver handle uncertainty without
pretending the sensor provides data it does not have.

## 11. Sources and engineering assumptions

Primary constraints: [HA 2024.6.0 state model](https://github.com/home-assistant/core/blob/2024.6.0/homeassistant/core.py),
[HA report event](https://developers.home-assistant.io/blog/2024/03/20/state_reported_timestamp/),
[ESPHome LD2450](https://esphome.io/components/sensor/ld2450/),
[LD24xx duplicate suppression](https://github.com/esphome/esphome/blob/2026.8.2/esphome/components/ld24xx/ld24xx.h),
[ESPHome filter behaviour](https://github.com/esphome/esphome/blob/2026.8.2/esphome/components/sensor/filter.cpp),
[LD2410 distance-only data](https://esphome.io/components/sensor/ld2410/).

Timing/solver tolerances, screen sizes, module names and bounded query/resource
limits are explicit engineering choices for independent review, not extra
owner questions. Atomic frames are not assumed for separate HA sensors. A
backend reporting API is deliberately required for uniform normalization and
future browser-independent recording. Exact shared coordinate fixtures, not
historical ARCHITECTURE pixel dimensions, are the mathematical acceptance truth.
For Q5, session-local declaration state and the collapsed additional-actions
group are implementation choices for the accepted secondary-entry behaviour;
no extra persisted classification flag is necessary. Generic source ownership
means marker/space ownership plus per-entity authorization, not device-registry
membership. Hardware adapter identity is a separate verified capability.
