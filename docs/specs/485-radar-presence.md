# #485 — Presence radars on the plan: common acceptance contract

Issue: [#485](https://github.com/Matysh/houseplan-card/issues/485).
Author: Codex. Baseline: `dev` at
`ed9ee026dc08054e12038b7dbd1b8525e7706d04`, 2026-09-08.
This is a specification, not shipped behaviour. Status is exclusively the issue
label. Current owner instruction: obtain independent specification approval,
stop at **S5-ready**, and do not implement or proceed to S6.

## 1. Reading order and authority

The acceptance package consists of this common contract and all three documents:

1. [Stage 1 — source model, calibration and live presence](485-radar-presence-stage1.md).
2. [Stage 2 — zones and bounded observations](485-radar-presence-stage2.md).
3. [Stage 3 — coverage, aggregation and derived room states](485-radar-presence-stage3.md).

The stages are dependent implementation increments, **not** three ways to narrow
the issue to its easiest part. The independent S4 review covers all four files;
S5 means the complete package is ready. Later implementation/release reports
must name exactly the stages delivered. No unfinished stage disappears because
the live layer works. Creating follow-up issues, changing the agreed scope or
closing this issue before all its AC are met requires an owner decision.

Authority: `docs/SCOPE.md`, repository process, the issue's owner request,
[UX proposal](https://github.com/Matysh/houseplan-card/issues/485#issuecomment-5583682816),
[analysis](https://github.com/Matysh/houseplan-card/issues/485#issuecomment-5583878376),
and [accepted defaults](https://github.com/Matysh/houseplan-card/issues/485#issuecomment-5583909140).
The numbered specs turn those requirements into testable contracts. Old open
questions in the original issue are superseded by these explicit decisions;
the external field report is evidence, not an instruction to copy a firmware.

## 2. Product intent and boundaries

Primary job: J1, understand presence **now**, on a familiar floor plan. The home
administrator configures the connection once; household members, phones and
wall kiosks see unobtrusive current observations. J4/J6 support safe setup and
diagnostics, not a new technical console in ordinary View.

The owner explicitly requested zones, local observations, day/week heat maps
and optional derived HA entities in #485. These are a bounded exception to
SCOPE's exclusion of general historical analytics: only spatial radar setup
and occupancy analysis, local and opt-in. This does not authorize general
time-series charts, an automation editor, tracking named people or cloud upload.
Original HA entities, automations and existing light Glow/spill remain untouched.

| Accepted decision | Consequence |
|---|---|
| Q1 default | Live marks appear after explicit configuration; global and per-radar switches hide them. No hover prerequisite. |
| Q2 default | Stages 1–2 use one selected room if its polygon exists. Stage 3 permits multiple allowed rooms. No invented room rectangle. |
| Q3 default | Stage-2 raw recording starts manually, defaults to 1 h, each run <=24 h, each point expires after 24 h, works without a browser, editor-only access. |
| Q4 default | Cross-radar consolidation is Stage 3; earlier stages make no global people count or identity claim. |

The requested weekly heat map has its own explicit, default-off collection
action; it is not enabled by raw recording or live display. Each collection
authorization still lasts at most 24 h, without automatic renewal. Stage 3
retains local aggregate bins for at most seven days, not seven days of raw
trajectories; a week can contain gaps or separately authorized sessions. This
is the bounded engineering interpretation of the owner's day/week requirement,
not an assertion that Q3 authorized permanent collection.

## 3. One feature, several capabilities

There is no new editor mode or separate fleet of person/device markers. Add
configuration under the existing device/placed-entity marker in Device editor:
**Presence on plan**. Reuse the primary House Plan panel and full dashboard
card's shared editor. The compact Room View card is not a second radar editor;
this issue neither replaces its current renderer nor adds historical tools to it.

A device label/manufacturer is never proof of data availability. The backend
derives capabilities from exact bound entities and a verified profile:

| Source evidence | Honest presentation | Forbidden inference |
|---|---|---|
| Valid local X/Y or explicitly described polar pair | One dot per current target slot | Stable person identity from a slot index |
| Range without bearing | Arc of possible positions; no claimed angle | Turn two distances into X/Y or two people |
| Occupancy/count for a known zone | Zone outline/state; Stage 2 provides manual polygons | Invent coordinates or remotely editable FP2 geometry |
| Presence only | Existing presence marker and optional diagnostic coverage | A fabricated person position or occupied area from marketing range |

Reference adapters: ESPHome LD2450 (coordinate slots and separately verified
zone-number bindings), generic explicit Cartesian/polar/range/occupancy inputs,
and exact zone occupancy/count mappings (including FP2-style connections).
Named products in the initial issue are examples, not a claim that every
firmware is automatically supported. Unknown connections use manual bindings
or an unsupported explanation, never guessed axes/units/writable capabilities.

## 4. Shared architecture and authoritative state

Existing seams: `src/types.ts`, `src/config-store.ts`,
`src/space-geometry.ts`, `src/houseplan-editor-runtime.ts`,
`src/houseplan-card.ts`, `src/render-device-snapshot.ts`,
`src/houseplan-render-lifecycle.ts`, `src/live-viewport.ts`,
`custom_components/houseplan/{__init__,store,auth,validation,websocket_api}.py`.
New pure radar modules, a lazy editor and backend coordinator are specified in
the stage documents. Do not duplicate the giant card's rendering/gesture logic.

Backend coordinator owns source normalization, freshness and room/filter
classification. One coordinator per integration, not per browser. Stage 2 and
3 consume its frames, never independently infer availability or reparse HA
values. Browser projection helpers used for calibration must agree with the
backend on shared numeric fixtures. Backend sampling never relies on UI frames.

One persisted optional namespace: `marker.radar.version=1` and
`settings.radar`. Common settings start with `show_live` (absent => true);
per-radar `enabled` requires explicit setup, absence means no radar operation.
Stage 2 extends radar with `zones`/`reflectors`; Stage 3 extends it with
`allowed_room_ids`, and `settings.radar` with fusion/room-output configuration.
Capabilities `radar_stage1_api:1`, `radar_stage2_api:1`, `radar_stage3_api:1`
are additive advertised runtime features, not stored user toggles.

Server-owned runtime identities:

- `source_generation`: opaque fingerprint/version of exact source bindings,
  mount x/y, installation UUID and coordinate conventions. It changes on a
  physical move, source/unit/axis change or owner-space change, not decorative
  icon drag. Explicit Change installation creates a new installation UUID even
  if the saved position is unchanged. Heading/mirror/reference correction alone
  changes calibration revision, not source generation.
- `calibration_revision`: accepted projection correction within that same
  installation. Room/filter/zone revisions are separate evaluation epochs.
- Frame `seq` and `server_session_id`: monotonic within one coordinator session;
  clients discard older/out-of-session deliveries and clear on reconnect.

Runtime ids, consent runs, histories, command tokens and telemetry are not
portable configuration. All config writes keep the existing `expected_rev`
transaction and `may_write` policy. New endpoints do not provide a generic
service proxy. HA entity permissions are additionally respected when reading
or controlling entity data; House Plan write access is not permission elevation.

## 5. Shared lifecycle / compatibility obligations

Optional additions do not change global config version or rewrite old plans on
read. Validate new/changed known blocks; preserve untouched malformed/future
blocks and unknown siblings losslessly, but do not execute them. Never coerce
an invalid radar into a valid-looking coordinate at `(0,0)`.

New frontend/old backend: preserve config, display update-required explanation,
make no unsupported calls and hide unsupported layer/tools. Old frontend/new
backend: additive fields survive the existing unknown-field path; clients which
reconstruct whole markers are not promised safe editing after downgrade. The
documentation recommends read-only downgrade or current-version backup first.

The implementation must cover the existing full backup, config import/export,
plan-only export, space duplicate/import/remove, room removal, marker movement
between spaces and Optimize transactions, not just config/set. Stage documents
define which references survive/remap. Full restore must retain exact configured
refs but starts **no recording, device write or entity provisioning** implicitly.
Duplicate space does not bind a copied radar to live hardware by accident:
the existing duplicate virtualization policy also removes its radar bindings.

Disabled/removed/missing space or room is not permission to choose the first
remaining space/room. Invalidated observations disappear; repair UI is explicit.
Geometry-preserving Optimize keeps valid projections unchanged. A coordinate
frame/physical-scale change invalidates calibration and suspends affected live
projection until confirmed recalibration, rather than shifting observations
silently. Pure pan, zoom, theme, fit-to-room, plan wallpaper transform and moving
the decorative icon do not alter physical calibration. Room shape changes
reevaluate membership, invalidate analysis epochs and affected room outputs.

Raw observations, aggregates and radar runtime snapshots are excluded from
House Plan support packages/portable exports/logs/browser persistent storage.
Full administrator HA backups may independently capture integration storage;
the UI discloses that these copies are outside retention/deletion guarantees.
No new cloud, telemetry, CSV upload or public download URL is introduced.

## 6. UX, visual and accessibility invariants

- View is quiet: small marks, no person names, trails, debug sectors, heat maps
  or editing handles unless explicitly entering setup/analysis. No new pulsing
  background competes with light Glow. Reduced motion disables interpolation.
- Radar dots/arcs/fills are pointer-transparent. Existing device tap_action,
  full capsule hit area, room-fit, double-tap fit and pan/pinch retain priority.
- Live layers are hidden in Plan/Background editors. Device setup shows only
  the selected radar's diagnostic geometry. Stage-3 analysis is a deliberate
  contextual surface, not a fourth permanently visible editor tab.
- No rewrite of isometric projection: reuse the existing projection seam for
  floor-level live marks; never render a second unprojected floor layer. Precise
  calibration/analysis use 2D temporarily and restore the user's view on exit.
- View/kiosk fully support touch (`docs/TOUCH-SUPPORT.md`), including resume,
  orientation changes and no-hover paths. Editors remain desktop-first, with
  safe cancellation/permissions on touch. Minimum essential action targets
  44 px; long labels wrap and dialogs retain visible Close/Cancel controls.
- Keys/text are specified en+ru in each stage, escaped as text. Locale number,
  length and date formatting is reused. No coordinate speech on every frame;
  meaningful health changes are debounced polite status text.

## 7. Acceptance map and completion evidence

All stage AC are required in addition to these cross-cutting ones. Test paths
named in this package are planned deliverables, not tests claimed as run.

| AC | Required outcome | Proof / negative witness |
|---|---|---|
| C-1 | Four capability classes produce only evidence-supported output | unit/backend state matrix; remove capability gate => invented point test fails |
| C-2 | Setup opt-in; display toggle does not start/stop hidden collection | smoke + backend command spies; auto-start on View/toggle => zero-start assertion fails |
| C-3 | One normalized source authority across clients/recording/entities | backend two-client/recorder fixture; stale or duplicated frame injection changes expected set and fails |
| C-4 | All lifecycle seams in §5 preserve or explicitly invalidate refs without retargeting | backend import/duplicate/Optimize/removal + unit preservation tests; drop guard => wrong-space canary fails |
| C-5 | No regression in devices, Glow, room actions, gestures or isometry | View/kiosk smoke and reviewed golden full scenes light/dark, 2D/isometry; layer hit-test mutation => click/pan failure |
| C-6 | No raw/aggregate leakage or implicit external writes | backend permissions/support/export + browser persistence/network canary checks; include private field/skip permission => failure |
| C-7 | Optional/unknown/future fields and rolling frontend/backend matrix remain safe | unit/backend roundtrip/API trace; remove capability gate/unknown preservation => failure |
| C-8 | Full package is independently reviewed; no implementation under current instruction | review of spec links, exact branch SHA and diff restricted to documentation; S5 label, not author self-approval |

Protective AC require named negative witnesses and failing output at code review,
per PROCESS §2.7. Expensive witnesses belong in `scripts/mutation-gate.mjs`;
text-regex tests or a single happy-path screenshot cannot prove geometry,
authorization or retention. TS/Python must consume identical coordinate fixtures.

Implementation loop: typecheck, unit, build. Targeted checks may diagnose a
failure; complete golden/smoke/performance/security and full HA backend harness
are pre-beta evidence on exact SHA in Linux CI/approved WSL, not native Windows
claims. Existing initial-bundle gzip ceiling **256,000 bytes** remains binding;
lazy editors/analysis cannot enter initial View graph. Stage documents add caps.

## 8. Release, rollback and risks

Future behaviour commits include `Issue: #485`, `User-Visible: yes`, both
`docs/CHANGELOG.md` and `docs/CHANGELOG.ru.md`, user guide EN/RU, architecture,
compatibility/field registry and status updates. Review complete synthetic
golden scenes, not only crops; include compact phone, wall tablet and desktop,
light/dark and representative live/error states. Record baseline/candidate
performance and security/retention/mutation tables. A beta is issued only on
owner command; current request creates no beta, code or version bump.

Rollback: hide live layers for visual rollback; disable affected radars to stop
runtime processing; Stop/Clear private recordings/aggregates with the current
version before downgrade. Removing optional derived HA entities is explicit
and warns about downstream automations; hardware-zone rollback is another
confirmed device operation, never automatic. Keep portable config backups.

Risks: coordinate ambiguity, suppressed unchanged HA reports, optimistic device
echoes, overconfident counts, reflection false positives, source reconfiguration,
privacy/storage growth and duplicate browser work. No specification can make
an uninformative sensor report true position; degraded states are a necessary
part of the feature, not defects to conceal.

## 9. Explicit engineering assumptions

The owner resolved Q1–Q4. Module names, bounded resource/timing constants,
protocol version numbers, conservative confidence thresholds and test filenames
are reviewable engineering choices. Seven-day aggregate expiry is the minimum
window for the explicitly requested weekly view, with independent <=24 h opt-in
sessions and visible gaps, not a continuous-history product expansion. Reference
adapter firmware evidence is linked in stages; user-supplied private recordings
are not prerequisites or public fixtures without contributor permission.
