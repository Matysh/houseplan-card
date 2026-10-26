# House Plan architecture

Decor preview handoff (#1080) remains in `live-editor.ts`: after the synchronous
live render produces a transient kind, only that kind's settled copy is hidden.
The existing host-update commit restores settled paint before clearing live
paint. Saved decor, image readiness and geometry/history owners are untouched.
Frame identity prevents cancelled/disposed callbacks from painting a new action.
Rectangle/ellipse capture loss delegates to the existing draft cancellation,
matching Line/backdrop terminal handling without committing geometry.

Accepted editor UI (#1081) keeps one owner per interaction. Colour-picker
motion retains an inert native/portal surface only through its 120ms exit,
and retires it on reopen/disable/disconnect. Group frames call the singleton
Properties painter with measured per-text bounds. New-space defaults are
created before the dirty baseline; a session-owned plan-list reader updates
availability without resetting the draft. Device menu commands retain the
existing config/revision/binding guards and shared visibility/delete writers.
Furniture mouse placement extends the existing delayed press and stage camera;
live grid bounds refresh only on that camera's existing viewBox budget.

Device structural history (#1073) uses the existing Devices `CommandStack`.
Copy and Delete add one server-confirmed command; their Undo/Redo confirms its
cursor after the paired write, while placement, visual and LED history retain
their optimistic preview/rollback. A mixed stack retains its independent
commands across structural echoes; each command revalidates its source before
applying. Position-only histories retain the prior foreign-baseline reset.

`marker_history.py` owns keyed per-field deltas, individual control edges,
related marker/space/strip identities, attachment digests and bounded leases.
The canonical Store boundary observes identity/ABA changes for every writer,
including import, restore and Optimize; a successful own paired command excludes
its own session, and incomplete/rolled-back pairs do not publish an identity
transition. Connection ownership holds the actual connection identity rather
than a reusable Python object ID. The existing recoverable pair writer remains
the only persistence mechanism; no old complete configuration is restored.

Retained command IDs accompany creation, so replacing a full history or its
Redo branch releases resources only after durable success and never retains a
51st command. Delta payloads are limited to 8 MiB per session and 16 MiB in all
sessions, with at most 128 sessions. The 256 bounded outcome receipts per
session contain only digest/token/revisions: replay reads a fresh coherent
pair. Attachments remain in place under hash-checked pins, honored by legacy
cleanup paths; releasing the last pin checks current references and unchanged
bytes before deletion. Idle leases expire after 24 hours; active Devices
heartbeats renew them every five minutes. Robot runtime trails are never part
of a command. A twice-lost response leaves the same action unresolved with an
explicit Check result control, rather than admitting another structural action.

Internal window light (#1079) uses room-side candidates from the canonical
opening-wall index. `interior-window-light.ts` validates host authority and
intersects proven opposite floor intervals before the shared Glow/LED barrier
builder cuts any masonry. Window contact is excluded from aperture state;
no solar room flag, emitter, persisted field or camera-time classifier is added.
Static retained masonry borrows that proof index when its drawing had no
permanent passage index. Symbol-side preference ordering remains unchanged.

Zigbee placement (#1077) reports positive user-hidden placement intent separately
from provider/registry/route failures. General Settings consumes the same accepted
display roster as the overlay; original user-hidden provenance remains on each
row. Mapping does not invent coordinates for concealed markers or revive invalid
bindings, and informational visibility details do not mark provider data partial.

Wall paint projection (#1076) omits numerically collinear boolean rings before
SVG/PDF strokes. `polygon-paint.ts` uses translation-local area and a floating
roundoff bound, without changing canonical bodies, caches, hit testing or saved
coordinates. Real holes and disconnected components remain separate. The iso
projector's existing degeneracy guard already rejects the reported tail.

Editor command latency (#1075) separates node-menu authority (every idle Plan
tool) from Select-only capture/handles. One immutable opening proof serves the
chosen command; revision, adoption epoch, writer authority and queued floor
basis still gate dispatch. Python `prepare_node_delete` shares one canonical
source with its host proof, materializes only the target of an already-current
document and retains the complete legacy fallback. Full schema/host/junction
validation remains; junction baselines require the exact stored revision and
are published only after durable save.

`decor-history-restore.ts` admits only an actual decor-only history delta on the
current model, without node/chain/room-reference effects or pending physical
writes. It retains structural record identities and caches, updates config
epoch/model/scene, and uses the existing full-config writer. Unknown non-decor
changes, stairs, transforms and legacy/mixed steps retain strict materialization.

Sun-only room access (#1078) is resolved by `sun-access.ts` against the complete
room geometry before any exclusion. Positive common boundary spans connect
flagged rooms; actual exterior spans seed the flood. Innermost ownership handles
nested islands independently of room order. Flat and 2.5D share that access fact,
receiver exclusion and contour-only zero-wall filtering. Independent physical
obstacles retain their shadows. Canonical masonry, paper, fills and artificial
lighting are not filtered. A separate room-setting input moves the sunlight key;
physical and artificial-light projections omit that flag while durable history
retains it. A first saved/foreign change rebuilds sunlight without cooling walls
or floors; unrelated HA ticks perform no topology work.

Historical vacuum preview (#999) has one memory-only `VacuumHistory` owner per
card. Selection, pending Show and immutable shown material are separate; closing
the settings popup does not retire Show. The lazy settings section uses the
shared select/actions, while the eager View banner and existing trail renderer
consume the same local owner. Preview never replaces `_vacSrvTrails`, changes
configuration, pauses collection or adds a camera/RAF/writer.

The writer-only history WebSocket bridge resolves the saved marker and unique
registry-proven Dreame robot/camera. Public catalog machine fields and numeric
history geometry pass separate closed decoders. Exact current/previous native
coordinate metadata is only a map witness, never historical content. The
existing camera physical lease is factored into `vacuum_camera_read.py` and
shared with live collection; timeouts retain unfinished physical operations.
Only the existing confirmed task boundary rotates a transient history epoch,
delivered additively with trails. Store schema and recording policy stay intact.

## Device settings from View (#1050)

`_clickDevice` and View `_ctxDevice` share the existing `_openMarkerDialog`
request owner; keyboard and LED hits retain their current dispatch. The local
`settings` action branches before service eligibility/confirmation/feedback.
The marker request reuses loaded writer/kiosk authority, ConfigWriteContext,
adoption/layout revisions, card options and existing navigation counters.
After lazy loading it resolves a fresh visible marker with the captured stable
binding key. The same resolver passes through the runtime's Properties
`beforeIntent` retry, before selection, New acknowledgement or draft creation.
No second loader, poller, read claim, writer or async controller is added.

Decor multi-selection (#1038) lives in the existing lazy `PropertiesEditor` as
volatile paint-ordered IDs. `_decorSel` projects only a singleton. Pure decor
selection/group-edit helpers resolve all members, one rigid delta and independent
touched style channels; no group model or writer endpoint is persisted.
The existing move pointer owner, command lane, config-adoption optimistic attempt,
serialized Save and geometry history provide one accepted command. Handoff receipts
are owner-specific so a retired queued operation cannot unlock a newer authority.
Individual contours reuse Properties paint and the existing live-editor/text
measurement hook; all moving selected shapes share its live presentation.

Editor keyboard translations (#1025) enter through the existing card key
dispatcher and lazy `KeyboardNudge`, using the Properties command lane.
`nudgePlan` computes a whole-wall or same-host opening candidate; the existing
physical geometry/identity barrier and config writer remain authoritative.
Devices start from their effective contact point, preserve other contact
anchors and use the existing full-read layout CAS and position history.
Each queued step fences selection/navigation, authority and config/layout
revisions again before apply/send. Retirement cancels pending steps; late
receipts cannot replace newer placements or append retired history. Exact
preview rollback is restricted to its unchanged revision and targeted fields.
The existing Devices pointer owner explicitly transfers focus to its canvas
marker after suppressing the browser default; form/control arrows stay native.

Own availability (#1026) is one three-state fact from `DevItem.entities`, resolved
before source selection and reused by source eligibility and presentation policy.
It never expands the roster through controls, values or physical siblings.
The existing sample-quality gate still suppresses invented work/activity; only
confirmed own unavailable produces the policy's eligible offline content paint.
The shared face owns one inner badge span, including the geometry-only shadow
twin. LED source loss uses the ordinary inactive path; its badge consumes the
same presentation fact. Snapshot row tracking captures the own reads without
adding a registry scan, listener, polling owner or writer.

The config-authority browser witness (#1052) isolates late foreign-event reads
from already-started mandatory and optional capability reads. It observes the
transport boundary without changing the production subscription or writer.
The read-only cold-start witness uses the same separation for optional failure
and active-tab no-op checks, retaining exactly one mandatory layout read.

Approved editor UI #1051 shares `EditorContextMenu` presentation across device
(including LED), decor and catalog actions. Callers retain command authority,
revision, navigation and object identity; `retire()` makes retained exit paint
inert before caller state disappears. Catalog has one `CatalogContextMenu`
owner, not independent native-details menus. Styles arrive with the lazy editor.
The replaced menu markup, inline paint and old catalog positioning are removed.
The LED editor's existing select-hit listener takes the context-menu press
before scene pan; the menu adds no camera or command authority.
Inline Properties colour controls own their opacity wrapper's grid layout;
the generic form-kit flex layout remains for non-inline consumers.

`disclosure()` owns native details through `disclosureMotion`: one 220 ms
retargetable content animation, local composed-ancestor scrolling and immediate
reduced-motion completion. Its content stays mounted through closing without
retaining interaction. Provider reason groups use the same primitive.
Decor Properties keeps raw inline HEX/opacity strings and the last valid pair
in the existing field session. Rendering resolves an owned preview without
changing config; completion crosses the existing guarded writer/history once.
Plan hover and contour selection share the same winning hit resolver.

Decor creation (#1047) keeps native selection authoritative for the current
Properties target even when the previous object still exists. Field completion
continues to fence selection changes; other editors retain their explicit owner.
Text measurement can use the wide Properties text owner while its drawing tool
remains active. Only the measured box of that exact text may paint its frame.
Properties yields Escape to an active native decor draft before clearing selection.

Direct LQI (#1029) is a separate entry-owned volatile coordinator with passive
exact-topic MQTT subscriptions and one 30-second cached-memory ZHA read cycle.
The ZHA adapter supports the HA 2024.6 gateway and current gateway proxy without
importing ZHA/zigpy or invoking radio APIs. Registry/config-entry plus exact IEEE
identify a device; friendly names only address confirmed MQTT inventory entries.
Ambiguity fails closed, source generations retire old addresses, and observers
receive coalesced immutable session/revision snapshots of represented devices.
No inventory, credentials or topology crosses the read-only feed. The shared
frontend connection/user subscription supplies `device-signal.ts`, frozen
presentations, room aggregates, preview and value candidates. Existing HA
diagnostics remain the fallback; optional providers cannot prevent plan loading.
The frontend controller acquires only between Lit hostConnected/hostDisconnected
(#1053), with internal identity release separate from the real lifecycle fence.
Its config/get fields:['model_version'] probe reads capability metadata outside
the single model-tag body field (which it ignores); old projection
refusals retain HA fallback without repeated full-document requests. Generic
recovery holds only mandatory canonical replies, never this metadata response.

Default-branch service events (#1040) use the eight mirrored ingress recipes
from `scripts/service-workflows.mjs`. `_service-event.yml` has a main sender
with Actions-dispatch permission and a separate dev receiver with native-token
ref-write/read-artifact permission; operational jobs retain their old ceilings.
The sender stores only bounded routing identity. The receiver verifies the
immutable source attempt/artifact and claims the delivery/current review epoch
once before passing context into the existing reusable bodies. Native-token
claim refs do not trigger push workflows. A dispatch acknowledgement is not a
model/test verdict, and ambiguous writes are not retried. Legacy native calls
remain compatible for staged activation; historical review runs remain readable.

SVG caption alignment (#1039) is a detached presentation correction after the
HA Area affordance is filtered out. The remaining name centres in the frozen
row width; live room-label CSS, geometry, actions and layout storage are untouched.

Decor order (#1035) uses the existing `spaces[].decor` array, not a second
z-index. Pure reorder/copy helpers retain no-op identity and deep-copy instance
values while keeping image asset references. The lazy `DecorOrderEditor` owns
the shared commands and menu lifecycle; Properties and secondary actions call
the same lane through field completion, current writer/space/revision and
gesture fences. Context hit testing reads actual SVG geometry in reverse paint
order only on a right-click, including under pointer-inert drawing tools.
Commands use the current geometry history/config writer; View has no menu
listener or commands. No asset/file API, backend change or schema migration.

Wall-node deletion (#1045) is a lazy structural operation with pure TS/Python
proof kernels. The narrow endpoint derives the two-section delta and independent
opening lineage under the existing config lock/atomic writer. The client sends
point intent rather than candidate geometry and adopts only the accepted result.
Its discriminated node command joins the existing serialized writer and common
50-command history. Refused Delete inverse commands keep their cursor/identity;
Move keeps its existing refusal policy. Capability is transport-only, with no
new View import, polling, persisted selection or model change.
The existing node editor owns the cancellable opening/action intent and uses
the accepted shared context-menu presentation. Pending Properties completion
cannot outlive outside/navigation/authority retirement; normal chosen-action
close does not revoke an already accepted response. The pure polygon helper is
shared with Resize rather than imported through the editor runtime facade.
Processing failures remain fail-closed; the fixed unavailable code belongs to
the shared backend error registry and the lazy editor dictionary.

Decor Line (#1046) is a lazy-editor `DecorLineDrawing` session. Clean stage
pointer pairs authorise one native click; navigation/cancel tails have no such
token. Preview and commit use the same endpoint calculation, with exact Shift
rays and compatible decor magnets. Accepted segments use the existing geometry
writer and common command stack; only command snapshots carry a session token
and anchor. History restores it only while the same chain was active, and
authoritative adoption/context teardown clears it. No config schema or View
dependency changes; Shift listeners exist only for an unfinished chain.

Print export (#1036) keeps the PDF scene/writer independent from a lazy SVG View
snapshot. The card supplies a read-only stage/context fence, not export geometry.
The exporter freezes computed styles and flattened icon shadows synchronously,
then embeds local assets in the detached frame with a streamed budget. Native
scene SVGs retain their layers and HTML overlays use foreignObject. Completion
rechecks the original config/space/writer context before creating a download;
neither renderer state nor config/layout is mutated. Shared select, colour picker
and settings shell own the export form presentation.

The E2E DOM contract (#1011) projects existing scene/form state into test
attributes. The JSON inventory stays outside the runtime graph. Form primitives
pass stable identities to controls; the contact renderer identifies its existing
contour owner. Camera metadata uses the actual SVG viewBox/CTM and base grid
pitch. Toast identity travels alongside text through its existing presentation
owner. No new listeners, observers, calculations or stored fields are introduced.


`hp-color-opacity` owns the shared HSV presentation (#1008 / UI-016). Its Lit
template derives a single resulting colour and S/V gradient endpoints from
unrounded HSV; one class styles the three native ranges in both popover and
portal roots. Colour properties belong to the inputs: Lit must not replace the
surface's inline style owned by the placement controller. Opacity keeps its native range; consumers, events and persistence
are unchanged. No observers or per-dialog picker overrides are introduced.
Forced-colors focus matches the gated hover specificity and overrides it.

Moon phase direction (#1006) travels from the existing astronomy calculation
through `MoonView` and its fingerprint into the shared runtime's mask sweeps.
Waxing lights the right half and waning the left; the north-up designer art is
unchanged. Rounded empty/full discs normalize direction in the fingerprint.
All background and host variants retain the same runtime and lifecycle.

Unit execution (#982) uses a computed import/source-read partition rather than
test filename lists. Product consumers own the build dependency; tooling jobs
run independently. The complete frontend CI proof binds both unit job results,
so moving work into a separate job cannot turn a missing/red unit set green.
The local gate selects the required union from changed input domains and uses
both sets for unknown inputs; full and nightly execution retain the full union.

Optional marker `state_source` (#977) changes ordinary presentation samples,
not the binding/action/value/light graph. Shared resolution checks exact own
registry identity before reading a state. Presentation metadata explains the
same result in preview; snapshot row tracking and source signatures handle
sibling/attribute/registry changes and retire stale short activity. Marker
save uses the existing accepted-config/CAS/context boundary.
Form options also check canonical candidate authority before looking up an
entity, including stale or disabled choices (#978). UI polish (#979) removes
the extra filter/current-state hint and writes a single manual state through
the same accepted-save path. Preview has one column, with a bounded-height
image above readable explanations; the resolver and stored schema are unchanged.
The owner refinement #991 restores search only inside the expanded shared
source picker (#989), not as another form row. Its open/filter values are
transient; choosing the same source retains manual conditions and future keys.
The owner checks draft identity before accepting delayed overlay callbacks.

Shared dialog presence (#976) separates a close request from an accepted terminal.
Owners retain their existing dirty/busy/Save decisions; only accepted state
retirement asks the local Lit `dialogPresence` part to keep inert presentation
until `HpDialog.beginExit()` finishes. No retained model/write authority, global
DOM-removal interception or polling is involved. Permission invalidation bypasses
the presentation phase; warming locale/lost-space confirmation invalidation
also removes the decision surface immediately. HA supplies its own reverse entrance; native fallback
uses a180ms exit. A400ms deadline, cancellation, disconnect and reduced-motion
complete safely; late callbacks belong only to their original exit run.
Automatic return-focus styling is scoped to the actual opener until its next
input/blur, not a global keyboard-focus policy. Shared secondary forms reuse
the settings action tokens; PDF imports those tokens across its shadow boundary.

### Unsaved-confirmation presentation (#990)

`hp-confirm` marks only existing `discard-*` requests for native entrance and
settings-style close-button motion. The safe cancel autofocus is unchanged;
the existing automatic-focus helper temporarily suppresses its ring until real
keyboard/pointer input or blur. Motion is presentation-only and respects reduced
motion. Dialog presence, decisions, dirty checks and saved state keep their owners.

The offline UI Lab (#964) lives separately in `demo/ui-lab/`. It serves the
checkout's built product and pinned official HA components against the existing
synthetic fixture store, not a second product renderer or a Home Assistant
server. Optional private fixtures/assets/theme/overrides are explicit local
inputs; local session import/export owns only its dataset-scoped browser state.
Runtime acquisition is an explicit preparation step with pinned archive/cache
integrity. The loopback static server never proxies HA or accepts writes.
The regular demo, screenshots/golden harness and release bundles do not depend
on this tool. Usage and limits: [UI Lab](../demo/ui-lab/README.md).

Editor polish (#963) adds a panel-owned intrinsic-height motion controller:
child ResizeObserver notifications coalesce into one frame; a new measurement
retargets from the currently painted height. Disposal and reduced motion cancel
animations. Static section headings carry no collapse state. Rooms/Shapes and
history call the original commands through editor-secondary's context fence.
The initial card contains a small tooltip event bridge; presentation loads on
first use. One shadow-owned manual popover shares hp-help's surface tokens,
retains substantive device-catalog and icon-rule hints in each locale,
preserves accessible names/descriptions and retires delayed work on context,
focus, pointer, visibility and mount changes. No observers or UI Lab proxies
are installed in product model/command paths.

Editor Properties (#931) lives in lazy `src/editors/properties/`: a capability
catalog and surface, targeted transform/physical adapters, card-local selection,
field controller and one ordered command lane. Stable floor/editor/object/binding
identity plus config-write authority retire stale callbacks. Drafts compare only
their own field, so sibling updates survive and same-field conflicts block.
All commits use existing config/layout/LED writers and histories; visual device
history stores changed-key presence/null, not whole markers. Full dialog entry
finishes the panel writer before reading a fresh target. The card owns the width
observer; no panel DOM or styles enter the initial View dependency graph.
`selection.ts` paints cues only: native handles and hit-priority still own gestures.

Development evidence (#954) separates material identity from content identity.
Only closed pure product units/build cross a Git commit; metadata/FS/process/
dynamic consumers remain fresh. Local receipts are private, byte-verified and
never CI authority. CI schema2 producers independently verify source objects,
successful run/attempt/jobs, environment and artifact inventory. Heavy transfer
bridges branch-scoped caches only with direct executed ancestor proof and exact
profile coverage. Push demand includes labels/render risk up front; golden and
the full smoke matrix are independent, with release/night coverage unchanged.

Portable full backup (#936) is editor/admin-only and lazy on first use.
`backup_archive.py` validates a closed ZIP manifest, bounded directory/streams,
image bytes and SHA-256; it never fetches external URLs or extracts paths from
the archive. `backup_files.py` prepares server-chosen copy-on-write destinations
in private marked staging, publishes exclusive hardlinks and rolls back only
proven-owned links. Existing files are never overwritten or inferred unused.
`backup_service.py` owns expiring per-user sessions and disk/worker limits;
`backup_http.py` authenticates chunked upload/download. WS export opts in with
`archive:true`; cancel, revalidate, Apply and Undo recheck ownership/HA-admin.

ZIP import cancellation (#971) also accepts a client-known opaque operation id
before a preview token exists. HTTP carries `X-Houseplan-Operation`; WS cancel
uses exactly one of `operation_id` or legacy `token`. Cancellation is scoped to
the HA user and exact import, waits for its own executor workers before private
staging cleanup, and leaves a durable journal untouched. Bounded ten-minute
tombstones reject a late upload, never a different tab's request. The client
drains acknowledged cancellation before ZIP retry and retries a lost cancel ACK.
Failed admin-only ZIP cleanup does not gate an otherwise permitted JSON import.

`backup_transaction.py` extends the existing durable pair journal, not a
parallel state engine: write → upload → coordinator lifecycle locks precede
intent. Config/layout/files/cache converge before success/events; startup
resolves that intent before new writers. One-deep Undo retains previous cache
and file references; revisions and cache generation reject stale use. A cache
fence invalidates late scan jobs only on accepted convergence. OFF/Update keep
their central writer contracts. Missing/OFF snapshot replaces with empty cache.
The frontend transfers opaque candidates/raw files; it never parses imported
JSON or trusts browser-produced file paths. Legacy JSON and Help stay separate.

Portable reference recovery (#973) lives in the pure `portable_recovery.py` seam,
shared by export and materialized import candidates. Only known stale spatial
references disable radar/vacuum live features; invalid control edges and dependent
marker values are neutralized with a bounded report. Structural validation, ZIP
security and ordinary Save/setup stay strict. Export works on a copied snapshot,
then dry-runs the actual document through parser/materialization without a token
or write. JSON/ZIP repair consent retains that snapshot. Import report and target
share one digest; unchanged revalidation reuses the allocated space-copy IDs.
Neither path invokes the geometric optimizer or changes source files/live stores.

Approved settings presentation (#948) is scoped by `settings-layout`: its
responsive shell, white/theme-derived controls and colour-plate delegation do
not alter ordinary dialogs or onboarding. A colour plate activates the existing
`hp-color-opacity` trigger/overlay owner, so keyboard focus, draft ownership and
close behavior remain in one component. Compass guidance is display-only.
Integration presence excludes `source:ignore` entries and registry rows explicitly
owned only by those entries; disabled or failed configured entries remain present.
`settingsUndoVisibility` projects the single existing history owner into visible
operations; it neither creates history nor changes undo availability or writes.

Catalog operations (#930) keep space filtering and virtual-ID identity in the
pure `device-inbox` projection. The same full filtered result drives rendering,
Select all and post-confirmation revalidation. `marker-deletion.ts` owns a deep
independent candidate and bounded post-commit housekeeping for single and batch
Delete; the existing optimistic/adoption queue owns rollback and revisions.
Confirmation is dialog-, placement-, navigation- and HA-generation-bound.
Tombstones retain exact HA binding semantics; virtual rows never share identity.
No backend endpoint, stored filter or HA service action is introduced.
The deletion command is a second lazy boundary; its caller revalidates the
origin dialog and HA generation after import. Catalog-only strings use the
existing tools namespace and editor styles; View pays for neither. The shared
translation leaf is explicitly chunked to preserve the runtime raw-URL retry ABI.

Plan entry (#928) reads the current `SpaceModel` geometry and that space's raw
opening list through pure `planEntryTool`; images/decor/devices/LED do not count.
Only successful ordinary mode entry applies the result. Same-mode no-op, warm
adoption and explicit onboarding/copy tool ownership remain independent; no
config/layout writer, geometry preflight or persistent preference is involved.
The node handle projection caches known `WallSegmentModelError` refusals as
no topology: legacy-invalid data cannot crash the default Select render, and
an updated valid snapshot restores handles. Unknown errors remain visible;
the authoritative data and strict write validation remain untouched.

The Flat device-contact wall cache (#935 performance correction) uses the
existing floor-record reader with one narrow fingerprint projection: omit only
the top-level `decor` field from each model/current record. Decor cannot alter
masonry. All other fields, including unknown compatible ones, epoch/identity
refresh, mismatched preview records and border visibility remain authoritative.
The general floor caches keep their original keys. A decor transform/cancel
therefore does not cold-build the contact wall union or its spatial graph.

Device copying (#935) is an editor-only `DeviceCopyEditor` command backed by
pure template/name/reverse-link/placement helpers in `device-copy.ts`. It creates
a new virtual Marker, never rebinds the source or moves LED geometry. Effective
HA icon and own light appearance are materialised; own light/toggle selectors
are removed, operational state is not cloned. Existing explicit external sources
and unknown compatible settings remain deep-independent.

`houseplan/marker/copy` accepts source identity/binding, one new marker/position
and both expected revisions. The server reconstructs the narrow delta from the
locked stored pair, derives incoming additions from marker refs and the source's
own HA entities, validates the new graph/settings and commits via `_commit_pair`.
Source availability and writer permission are checked again after executor work.
No Optimize/migration or full-layout client overwrite is involved. The response
contains both accepted bodies/revisions. Capability-aware clients resolve a lost
reply through the same operation ID; older integrations retain readback-only
compatibility. Foreign HA replies cannot adopt or retire a
newer command. Uploaded attachments are COPY-prepared with exact name mappings;
original folders are never cleaned by this command. Failed preparations may
leave unreferenced staged files under the new ID, not partial visible markers.
File COPY and uploads share `upload_lock` and the same existing store quotas,
so concurrent duplication cannot spend the same remaining slot twice.

External plan migration (#937) is isolated in `scripts/sh3d-convert/`, not a
Lovelace runtime dependency. Both readers emit the current space envelope through
a generated tool-only bundle of the canonical wall writer. SH3D retains physical
units and plan-only privacy; Easy Floorplan carries explicit compatible content
and manifests, with an automatic estimated common scale. The bounded YAML parser
and wall runtime are bundled into the offline page. No source actions are executed,
images are references only, and the existing authenticated HA import remains the
only writer. See [converter boundaries and deployment](../scripts/sh3d-convert/README.md).

The empty screen and HA floor wizard share a passive `hp-plan-converter-info`
component (#1020). Its four-language informational namespace loads through a
fingerprinted View boundary, independent of writer
permission and storage. It neither imports the settings/editor graph nor writes
configuration. Compact styles load with the existing onboarding owner so a
failed informational import cannot block floor selection or manual creation.
Both import renderers delegate to `floor-import-dialog.ts`; the
existing owners retain selection, cancellation and import guards. Compact body,
checkbox, action/footer and hint rules have one style owner; General settings
continues its existing layout while using the same URL and format data.

Converter target limits are generated from the real Python numeric declarations;
they are independent of the more generous source-reader budget. Consumer tests
exercise the actual space-display/sun/backdrop helpers, not just an extra-key
tolerant schema, so stored `space.settings` remains effective in the runtime.

Backdrop references (#941) accept only bounded image-selector query parameters;
unknown names, duplicates and fragments are omitted with the existing loss report.
This avoids an unbounded credential-name denylist or stripping a required signature.

Nightly witness maintenance (#917) changes no product owner or runtime. The
gesture-entry witness calls the live-update router; the tool-boundary witness
calls the actual lazy renderer with a retained dialog/cache, independently of
toolbar cleanup. The stale-door mutation spans both redundant protections.
Two preparation definitions retain TypeScript's original broad JSON typing
and reachable callback narrowing instead of failing before their oracle.
An explicit read-only published-stable metadata check may use the reachable
previous stable tag's catalogue after the next cycle opens. It requires the
unchanged tagged notes and current authored RU/EN sections. Publication stays
HEAD-bound and rejects this historical-verification option.

Stable field decisions (#916) are release metadata, not product state or native
receipts. A reviewed tag/SHA binding plus the latest authenticated owner comment
can authorize promotion of an owner-tested public beta with unchanged product,
dependencies and capture/build inputs except exact version fields. The reader
now treats manual owner dev/GPU observations as optional on every channel
(#929), never fabricates GPU proof, and cannot override explicit vetoes,
supplied invalid scene plans or automatic gates. The historical #916 scene-plan
waiver remains scoped to its exact promotion; future field receipts need no waiver.
Release accounting reads all reachable parents, retaining each task's original
implementation provenance instead of borrowing a merge's unrelated issue.
Documentation capture (#959) follows the device dialog's existing Appearance
navigation before revealing its real preview. This is fixture presentation only:
no product renderer, scroll owner, viewport or visibility guard changes.

Beta membership creation and immutable verification share that all-parent range
(#958); the previous release anchor still follows the first-parent tag line.
Existing SPEC-only and promotion exclusions retain their content-bound proof.

Presentation seams (#907) have no new data or write authority. The marker form
passes its effective locale to the reactive read-only preview, which retains
HA fallback when standalone. The existing write-error mapper recognises the
known context code, supplied by the unchanged early placement refusal. Optimize
reads own string roster names only; owner classification and cleanup stay intact.

Thickness selection (#911) is lazy editor presentation, not a new hit target.
`wall-thickness-selection.ts` resolves the current room span or partition from
the dialog target and opening floor, and reuses the physical hover shape policy.
The runtime caches one result by opening array identity, model and config epoch;
field edits and camera movement do not rebuild it. Its editor-only class hands
paint ownership to the existing live layer. The original hover getter remains
cursor-only and still owns wallhot; no host port, schema or writer is added.

Release delivery phases (#903) share `scripts/task-delivery.mjs` between the
SPEC publisher, release catalogue and membership create/verify. Versioned
spec-review trailers require the exact publisher/delta and the document's own
machine material anchors; old publisher commits receive equivalent checks.
Both published heading forms bind their issue/round to the added SPEC filename
(#950); neither title alone nor a historical filename confers delivery status.
Spec trace remains separate from implemented entries. The schema-1 authored
classification must be renewed when an earlier doc-only blob meets its first
A/B delivery; the same immutable history check guards merge and catalogue.
No runtime state, owner acceptance or release authority is introduced.

Review instruction consistency (#905) places negative-evidence policy in the
common reviewer entry and actual workflow prompt, before track-specific text.
Ordinary inputs exercise unchanged code; temporary source, compiled-artifact,
guard or budget substitutions are mutation execution and remain nightly-only.
Existing static readiness and outcome classifiers keep their formats/owners;
no command sandbox, permission change or retrospective verdict rewrite is added.

Evidence accuracy (#910) adds no runtime or evidence-executor owner. A pure
uniform-dirty receipt test isolates the existing signature refusal; a bounded
DEVELOPMENT checklist linked from TESTING separates execution, reused proof,
content equivalence and unknown. Historical corrections are additive dated prose with primary links,
not edits to original review anchors, raw or verdicts. Text/link checks do not
claim semantic fact-checking.

Backdrop cancellation (#908) reconciles only its stage `bdgrabbing` class at
cancel and explicit begin, since a retained terminal can leave Lit's cached
class value unchanged. The stage routes capture loss only for the active
backdrop pointer; normal release has already retired that owner. No per-move
publication, frame policy, transform builder or history/persistence owner changes.

Stage surface ownership (#900) is one pure composed-path predicate in
`canvas-surface-gestures.ts`, shared by scene pointer, click, wheel and touch
contact admission. Physical contacts still reach the activation-tail guard;
surface contacts never enter the scene pinch. `wall-thickness-dialog-gesture.ts`
is an editor-only DOM owner: keyed dialog lifetime, pointer capture, threshold,
bounded screen coordinates and a resize observer. It performs no host render,
camera update, config write or history operation. The dialog is a stage sibling
of the camera wrapper; editor-only styles remain lazy. LED's modal shell also
consumes pointer/click events while retaining native list scrolling.

System LQI visibility (#876) has one bounded policy in `signal-visibility.ts`.
`spaceDisplayOf` projects explicit new modes and historical false; every full,
static, hover and preview consumer feeds that local override, the exact card
option and accepted installation setting into `effectiveShowLqi`. A card's
default true cannot hide the global setting. The policy performs no HA reads,
registry indexing, geometry work or persistence; snapshot boolean variants stay
reusable. The independent room-card `label_lqi`, explicit LQI value sources,
battery diagnostics and topology ownership do not consume this policy.

The synthetic QA boundary (#896) is outside both product bundles and persisted
HA schemas. Its cloned in-memory config/layout pairs implement the real write
message shapes and independent revisions, while a session-stable service
recorder survives synthetic state events. Static capture alone owns recursive
shadow stability and restores it in `finally`; dynamic transition evidence uses
ordinary CSS. Capture/source identity includes browser argument modules, with
launched-browser attestation remaining a separate proof of the executable.

View marker holds (#847) have one pointer-owned `ViewHoldGesture`, one 600 ms
timer and a generation fence. Marker/stage/window terminals cancel only that
owner. Blur interrupts activation without discarding physical contacts; shared
hidden/pagehide and disconnect abandon contacts but keep old click/contextmenu
tails inert until deliberate pointer/keyboard intent. Capture loss is not a
physical release, and implicit loss after accepted up cannot cancel room fit.
`subscribePageVisibility` owns one pagehide listener per Document, normalizes it
to the existing hidden signal and deduplicates hidden+pagehide. Sun fade teardown
resets its two-second keep-alive before detach; reconnect reads current HA sun.

View entry recovery (#894) resolves opening-info against the canonical exact
space/stable opening ID, never a retained display object. Binding changes retire
the old unlock decision. Exact lock/contact friendly names are presentation-only.
`WarmMarkerRestore` owns an unpublished View draft until the lazy renderer is
ready; its visible loading/error surface can be closed or retried, and stale
permissions/identity/intent cannot publish or acknowledge it. The Area action is
a native sibling of the room-fit keyboard target, not a nested button.
The named fit sibling carries the same stable room ID through the shared plan
pointer owner, so its keyboard role does not swallow the existing room tap.
Its 44px native Area hit box extends away from the text while retaining the
passive icon's inline footprint and View/Plan name-anchor parity.
`isLightGroupDevice` certifies model Group using the existing indexed HA children;
the shared Auto/roster/preview/static resolver leaves custom icons first.
`kiosk-viewport-recovery.ts` keeps only a ten-minute, consume-once camera address
in sessionStorage, scoped by DOM/shadow placement, route, options and HA account.
Only non-carousel kiosks bypass the old base-zoom version gate; all other guards
remain. A failed memo write refuses automatic navigation rather than discarding
the camera; deleted exact floors never transfer coordinates to the fallback.
Delayed restoration rechecks the captured write-context generation and the
unchanged placement key before it can publish a draft or camera.

Optional View boundaries (#848) share immutable factory/pending code only.
`ViewRuntimeBoundary` owns each card's loading/error, single explicit retry and
HA-context generation. A retired pending result cannot construct or install a
runtime or update its old host. Every module checks its own compiled fingerprint;
Zigbee custom-element registration is an installation side effect after that
check. Summary keeps synchronous page-warm adoption and rejected-promise cleanup;
its named entry facade survives Rollup's internal shared-namespace export aliases.
Nonce retry points to the same immutable hashed root, not a guessed new bundle.
The permanent notice remains during retry and disappears only on success or a
disabled function. Summary preference identity has one shared reader. Terminal
failures feed the existing `VersionRecoveryController` safety timer/session claim,
without inventing a version mismatch or another reload budget.

Composite form focus (#870) belongs either to the native form-kit wrapper or
the authentic HA picker, never both. The picker is styled through its public
host contract; its private shadow DOM and event handlers remain untouched.
The settings sheet adds no outer icon-row focus ring (#995). HA owns its themed
fill/contour; the text fallback retains the form-kit wrapper's border and focus.

Stable release prose (#840) has separate authored RU/EN histories in
`docs/changelog_user_stable_{ru,en}.md`. `user-stable-changelog.mjs` extracts a
tag/base-bound section without summarizing it. Release preparation copies both
languages into RELEASE-NOTES for GitHub/HACS; the contract proves exact equality.
Telegram reads only the same RU section and renders the heading/bold/links,
retaining emoji and blank lines. Technical/beta changelogs and product runtime
are unchanged. The shared `stableHeading` fixes the locale-specific short title
(#841); extraction and validation use that same contract. Canon: `PROCESS.md`
§11.9; mechanics: `DEVELOPMENT.md` › Release.

Kiosk hold-to-modal input (#831) transfers stage suppression to an instance-local
`TouchGestureClickGuard` modal-tail barrier before interrupting the stage. Its
owning pointer survives implicit capture loss until actual release/cancel; an
unrelated terminal cannot re-arm it. A fresh pointerdown after that boundary or
Enter/Space permits native dialog activation without a timeout. The existing
multi-touch post-gesture barrier remains independent and cannot be re-armed by
modal keyboard intent. No pointermove work or editor runtime is added.

Resize atom projection (#832) prepares frozen oriented run/vertex correspondence
in `resize-atom-projection.ts`. Solver handles remain coalesced; preview restores
the original ordered structural vertices before updating catalogue IDs. The
gesture owns one catalogue/consumer closure: only owners of changed IDs resync
their compatibility polygon. An inactive owner's same-thickness collinear
identity vertex may move on its unchanged run, never a corner or physical
thickness boundary. Both incident atoms must agree. Metadata, full physical and
junction barriers still run before paint/commit; terminal/reset drops the map.
If an enabled side-wall length change separates shared ownership at a fixed
third-room corner, a proven same-carrier split uses the existing structural
barrier on the frozen changed-ID owner closure before proof/paint. It never
drags that corner or rebuilds remote rooms. An indirectly shared atom with an
external consumer must remain byte-identical or the local candidate refuses.
The already-checked compatibility rekey ledger stays intact; final writes
derive the canonical wall projection through the ordinary barrier.

One HACS repository (category **Integration**) ships the backend
(`custom_components/houseplan`), both Lovelace cards and the `/houseplan` panel
(`src/` → `dist/`). This document is the map: each subsystem gets a short
description and a link to its canonical document, which owns the details.

## Wall-node editing (#803)

#834 separates cheap input arbitration from expensive frame work. Native
events retain the first unambiguous X axis while only the newest pending target
builds/proves/paints in an animation frame. Release flushes synchronously before
the existing paint/write barrier; cancellation retires the callback. Identical
snapped target/axis reuses its exact accepted or refused candidate, while a
guide-only change still paints.

`wall-shell-union.ts` keeps the ordinary exact union first. Only its exception
gets a retry with computed operands at the existing canonical coordinate
precision; collapsed rings, disappearing holes and changed operand topology
remain failures. This does not rewrite stored coordinates or relax junction
limits. Junction reuse explicitly scales the pre-opening room masonry to
config units; structural open-spans and incompatible/failed artifacts retain
the canonical independent proof. Visible opening-cut geometry is never used
as that proof.

The frozen Select baseline owns `WallBooleanBaseline`: exact operation/operand keys,
defensive result copies, and a bounded baseline-only recording phase (512
entries / 2 million serialized characters). Moving candidates never add result
records; they may refresh the separately bounded canonical-value certificate
FIFO described in WALL-THICKNESS.md. The synchronous scope is
restored even on exceptions and does not alter ordinary View/Resize calls.
Local boundary replacement proves every added/retained and added/added edge
pair free of crossings, overlaps and interior contacts before reconstructing
the output rings; only ordinary shared endpoints are allowed.
The reconstructed rings reuse that same exact coordinate scale for their area
sign; this avoids reparsing decimals without approximating the shoelace sum.
Corner unions and opening cuts batch exact associative boolean operations,
with the historical sequential path on failure. A wall strip is omitted only
when a conservative convex-containment proof shows it already lies entirely
in masonry; ambiguous predicates, holes and concave bays take normal clipping.
This coverage predicate is supplied only by lazy Select through `WallGeometryOperations`; ordinary View retains the canonical edge boolean path without loading that helper.
Ordered local junction replacements are composed before the final whole-body
difference/union; later cuts still remove earlier additions. Failed composition
replays the historical sequential path, including its per-node isolation and
protected strips. The junction guard computes and judges room contours itself;
an optional observer then copies them into the candidate's render-only cache
in render units. The proof never consumes that cache. Incompatible previews
retain the original independent contour calculation.

Select also groups corner fans before clipping their shared facade bound. Any
failed grouped stage, including the final body union, replays the complete
historical per-fan path; ordinary View keeps that path directly. The guard's
lazy subtraction operation omits only canonical masonry holes whose bounding
boxes are strictly disjoint from every subject ring. Outer boundaries and
touching/enclosing holes stay intact; ambiguous rings use the complete old
operand. This exact locality reduction never skips the room-floor subtraction
or its clearance checks, and both helper implementations stay outside View.

Node movement (#803) is a lazy subsystem whose capture is Select-only (#843:
its history is not): `wall-node-move.ts`
freezes the structural graph, `wall-node-editor.ts` owns capture/cancel and
the isolated live roots, `wall-node-preview.ts` renders the local complete-body
closure through production masonry/inner-contour/opening functions, and
`wall-node-write.ts` serializes the dedicated server operation with existing
writers. Remote paper, fills and masonry stay in the settled DOM. #828 gives
every transient warning, guide, X prompt and active handle one live owner;
the full Lit scene owns only stationary handles. At pointerdown the already
presented production masonry/axes/zero lines are frozen once (without room
fills, opening symbols or snap handles). One .35 source layer above candidate
paper/fills and below candidate masonry clips that snapshot to changed old
arms, retaining opening cuts and ordinary unchanged neighbours. Its coverage
is gesture-local and reused while the target moves; even an unbuildable
candidate can show the source. Cancel/commit/context retirement releases it.
Old settled local geometry remains masked out so it cannot duplicate either
source or candidate. These masks do not rebuild full-floor geometry per pointer.
Preview never replaces
the authoritative config, model cache or recovery snapshot. The backend mirror
`wall_node_move.py` derives the delta and independently proves an inverse before
Undo; a separate original-interval/midpoint ledger proves the only allowed
host-ID changes before strict partition-jamb validation, without copying
authority from the candidate. `config/set` keeps its existing host protection.
The ledger read-normalises a copy of the durable legacy input before deriving
structural identities, just as the first proof does; it never migrates on hover.
Details: CANVAS.md, UX-MODES.md, WALL-THICKNESS.md and CONFIG-COMPATIBILITY.md.
`wall-node-history.ts` (#843) applies a node command of the shared geometry
stack from any Plan/Background tool; a node step in the stack makes the runtime
load the adapter on demand, View never does. `writeWallNode` first settles this
tab's own write queue (a failed own write is re-sent before, never overtaken)
and may then advance the expected revision only through own accepted writes:
`ConfigAdoption.adoptionEpoch` moves on every other identity change, and the
target floor must equal the command's expectation (Undo: the accepted move,
Redo: the accepted Undo — the server proves only Undo; a gesture: its start).
`CommandStack.confirmUndo/confirmRedo` move the cursor only after acceptance.
`wall-node-edges.ts` (#864) groups only uncovered edge strips, clips their
union to the common centre and merges it into the unchanged room body. Any
grouped failure replays the complete old per-edge phase; ordinary View retains
its original sequential consumer, and no geometry certificate/cache is added.
Every live paint rechecks its frozen context before constructing SVG groups;
mode/floor/revision adoption retires capture and masks before the settled render.
`editor-shared` isolates shared lazy helpers so the editor entry retains its
named API on both its normal import and its opaque immutable-URL retry.
Both stable entry facades hoist any extra eager chunk imports into the same
awaited fallback boundary, before the implementation. A deleted extra chunk
therefore cannot abort the entry before its stale-update message is installed;
the manifest retains every eager dependency.
The write terminal refreshes history controls even when its own revision
adoption already retired the live preview before the command was recorded.
One successful local baseline can survive cancellation while the authoritative
config object, revision, space and exact selected-config value remain unchanged.
The retained config is private; every new candidate still builds and receives
its physical proof. Context exits, writes/history, pagehide and disposal retire
it. Candidate geometry, structural snapshots and live layers remain gesture-only.
Persistent source-style overrides are diffed and restored only on departure;
full host renders rebind their elements and changed authoritative inline styles.
Live handle templates read the current viewport scale before committing the
paper/room SVG layers, avoiding a read-after-write layout flush within paint.
`wall-local-boolean` keeps disconnected canonical components out of
repeated clipping sweeps; touching bounds still invoke the original boolean
library. These are exact broad-phase exclusions, not relaxed wall limits.
Snap arbitration keeps its winning axis guide but preserves an exact compatible
non-parallel H/V point instead of moving it with longitudinal quantisation.
Retired click-tail suppression checks stage ancestry and permits keyboard
clicks (`detail=0`); it cannot immobilise header/toolbar controls after a drag.

## Styles (#266)

The [eleven-consumer migration record](development-notes/dialog-style-migration.md)
names common owners and retained subject properties (#1019). Removed legacy
paint was already defeated in the actual shared root; genuine obsolete classes
are recorded separately with their retired producers. Composition order and
ShadowRoot boundaries remain part of the cascade contract.
Finite `css-uses` comments belong to actual render statements whose string
vocabularies cannot be resolved statically; executable renderer code is unchanged.

Dialog composition extends the existing form kit (#1007), documented in
[DIALOG-UI-KIT.md](DIALOG-UI-KIT.md). Explicit sections own separators and outer
spacing; fields own only their internal layout. Actions and independent Help
reuse shared generators across shadow roots. Composition CSS is adopted with
the lazy form kit and does not enter the eager View styles.

The lazy `hp-settings-select` enhances a light-DOM select while retaining its
value/change and option contract. It owns one accessible animated listbox;
`FloatingSurfaceController` places it in the native top layer or the dialog's
portal fallback. Transient overlay registration keeps Escape, outside click,
section navigation and focus restoration with the existing dialog owner.
The component is registered by settings styles, not imported into form-kit or
the separate first-run onboarding graph.

Space settings (#945) share the same form with onboarding/import through
`SpaceFormPort`; only the editor injects section navigation, the shared north
dial and links to General. Those links retain the mounted Space draft. Two
space font bases resolve separately from `card_font_scale`; room multipliers
remain independent. Battery policy is resolved from each device's own space in
View, static cards, preview and captured snapshots; snapshot reuse includes
that space-policy content. No UI navigation state is persisted. Validated config
copies align `hide_openings` with resolved `show_borders` without touching wall
geometry, opening sources or light calculations. Legacy active background colour
becomes explicit static; choosing inheritance clears both local mode and colour.

Settings redesign (#944/#948) extends the lazy form-kit with
`settings-dialogs.styles.ts`, `settings-sections.ts`, a shared north control
and background previews. Section selection is per host/dialog runtime state;
panes remain mounted while hidden, so navigation preserves input nodes and the
existing draft/dirty baseline. The shared shell consumes theme variables live.
Topology discovery distinguishes absent from unknown and never scans during
discovery. Saved maps/configured topics remain reachable when the integration
cannot be detected. UI navigation state never enters persisted config.

`src/styles.ts` composes `cardStyles = [base, plan, devices, chrome, dialogs,
isoTiles]` from `src/styles/*.styles.ts`; the order is a cascade contract (the
golden set is accepted against it; `isoTiles` last so 2.5D tiles beat
equal-weight Flat marker rules, #649). `base` holds host, variables and rules
shared by two surfaces; `plan` stage ink, `devices` markers, `chrome`
toolbars/tabs/menus, `dialogs` dialogs/forms/pickers. `form-kit.styles.ts`
(#594), `editor-secondary.styles.ts` and the summary-panel sheets live outside
that aggregator. `test/styles-split.test.mjs` pins composition, no cross-file
duplicate selectors and `@media` wrappers; `scripts/dev/styles-diff.mjs` compares
the normalized rule multiset, not cascade or visual equivalence. Public selectors:
`STYLING-HOOKS.md`. CSS only the
editor renders is not in the first frame (#805): `editor-dialogs.styles.ts` (the
editor-only rules of `dialogs`) and `editor-secondary.styles.ts` (the tray) are
adopted by the lazy editor runtime's constructor (`editor-style-adoption.ts`) into
their old cascade slots — after `dialogs` and after `cardStyles`; ownership and the
reverse ratchet live in `test/editor-dialog-styles.test.mjs`.

## Layout

```
houseplan-card/
├─ src/                                  # card sources (TypeScript + Lit 3)
│  ├─ houseplan-card.ts                  # eager full card: View shell, HA lifecycle, lazy-runtime hosts
│  ├─ houseplan-panel.ts                 # /houseplan sidebar host around one full card (#486)
│  ├─ space-card.ts · space-render.ts    # read-only houseplan-space-card and its static renderer
│  ├─ houseplan-editor-runtime.ts        # lazy Plan/Devices/Background composition root
│  ├─ physical-body-gesture.ts           # editor-only body/column gesture owner (13-purpose port)
│  ├─ backdrop-frame-gesture.ts          # editor-only backdrop gesture/frame owner (14-purpose port)
│  ├─ houseplan-onboarding-runtime.ts    # lazy first-space/import dialogs, independent of the editor
│  ├─ iso-*.ts · pdf/ · stairs*.ts · furniture*.ts  # 2.5D, PDF export, stairs, furniture (own docs)
│  ├─ devices.ts · rules.ts              # device list from registries; icon rules and exclusions
│  ├─ ha-binding-status.ts · device-presentation*.ts  # binding authority; marker face decisions
│  ├─ space-geometry.ts · wall-*.ts · physical-geometry.ts · logic.ts · types.ts  # pure, no Lit/DOM
│  ├─ config-store.ts · config-adoption.ts · command-stack.ts  # config cache, #500 boundary, Undo
│  ├─ sun.ts · day-cycle-render.ts       # window rays, four-phase background (SUN.md)
│  ├─ vacuum*.ts · radar-*.ts · zigbee-topology*.ts · summary-panel*.ts  # live subsystems
│  ├─ hp-dialog.ts · hp-confirm.ts · danger-confirm.ts · hp-help.ts · floating-surface*.ts
│  ├─ editor-runtime-loader.ts · version-recovery*.ts · build-identity.ts · editor-secondary.ts  # lazy loader; #462/#836; tray
│  ├─ editor.ts · space-editor.ts        # Lovelace GUI config editors of both cards
│  └─ editors/ · render/ · styles/ · i18n/  # settings dialogs, SVG projections, sheets, locales
├─ dist/                                 # ignored Rollup output: entries, manifest, hashed chunks
├─ demo/                                 # demo rig and smokes; golden/ (HP-QA-01), performance/
├─ scripts/ · .github/workflows/         # build/bundle gates, release-*.mjs; CI and release
├─ custom_components/houseplan/          # the HA integration
│  ├─ __init__.py · store.py             # setup/unload; versioned stores and per-entry runtime data
│  ├─ websocket_api.py · http_api.py · auth.py  # WS commands, uploads, the one may_write policy
│  ├─ validation.py · coordinate_canonicalization.py  # pure schema validation, write canonicalisation
│  ├─ frontend_registration.py · frontend_assets.py · panel_registration.py · build_identity.py  # resource, chunks, panel, build
│  ├─ import_export.py · decor_assets.py · plans.py  # backup/import, decor images, plan blobs
│  ├─ trails.py · vacuum_routes.py · radar*.py · virtual_lights.py  # live-subsystem backends
│  ├─ config_flow.py · const.py · system_health.py · diagnostics.py · repairs.py · support_*.py
│  └─ frontend/                          # only tracked bundle; release-only snapshot (#657/#1016)
└─ docs/                                 # this documentation
```

Rollup emits two stable roots, `houseplan-card.js` and `houseplan-panel.js`,
plus hashed chunks and `dist/houseplan-assets.json` (graph, sizes, SHA-256).
Only `custom_components/houseplan/frontend/` is committed and installed by HACS;
`dist/` and the demo copy remain build artifacts. Release verification compares
fresh output with that one snapshot; budgets still judge the fresh build.
The panel imports the card chunk by its hashed name, never through the card's
unversioned facade: entries are served without `Cache-Control`, and a stale
facade once ran an old card against the current backend (#535). Both roots keep
the fail-loud stale-load wrapper. View loads only the initial graph; editor,
onboarding, 2.5D (#649), PDF, locale and furniture-art graphs are lazy, each
passing the exact-build fingerprint handshake (one cache-busted retry, atomic
install), and `scripts/bundle-budget.mjs` fails a build whose lazy graph is
missing or leaks into the initial graph. The backend serves only manifest-listed
chunks. Commands and gates: `DEVELOPMENT.md` › Build, › Tests, › Release.

## Key decisions

1. **One repository — integration + panel + cards.** The integration serves
   its own JS; the exact build-specific module URL is the resource identity
   (`?v=<version>&b=<fingerprint8>`, plus `&dev=<sha>` on a dev build, #836), a
   writable Lovelace resource registry is authoritative and `add_extra_js_url`
   the truthful fallback. A build is identified by its frontend fingerprint, not
   by the version number, which consecutive dev builds share. Each
   `houseplan/config/get` carries the authoritative `integration_version`,
   `frontend_fingerprint` and dev `build`: View offers a manual reload, kiosk reloads once per
   backend target in a safe idle state, the space card has no version controller
   (`DEVELOPMENT.md` › Resource registration and version recovery (#462)). After
   migrations succeed, setup registers the public `/houseplan` panel
   (`require_admin=False`, #486): a thin app-bar host around one ordinary full
   card, fail-soft, removed on unload only by the exact owner and setup
   generation (`UX-MODES.md` › Principle; `TESTING.md` › Installation / upgrade /
   removal). In a Sections `layout="grid"` slot HA owns the height: `.stage` is
   the shrinking flex child and transitions use the measured card height, never
   `window.innerHeight`; `getGridOptions()` is full width, 10 rows, min 6 (#648).
2. **Server-side storage, no token.** `store.py` keeps `.storage/houseplan.config`,
   `houseplan.layout` (marker positions) and `houseplan.virtual_lights`;
   `trails.py` keeps `houseplan.trails`. All traffic uses the frontend `hass`
   connection (Integration WS API below); House Plan opens no socket and holds no
   token. localStorage keeps a start-up snapshot and, only if no backend ever
   answered, a local layout. Registries come from one `ha-binding-status` fetch
   and subscription pair per HA connection, shared by every card on the page;
   live rows augment an older snapshot at once and a debounced full reload
   reconciles `disabled_by` even without registry events (`FILTERING.md` ›
   Behaviour).
   Reinstallation (#820) is an admin-only HA config-flow choice, not a runtime
   cleanup action. `previous_data.py` inventories these four fixed Store files
   and `houseplan/{plans,files,assets}` read-only in the executor; only the config
   JSON and, when it has no spaces, the layout JSON (its `optimize_pending` key
   only) are read, without calling Store or triggering migrations. A safe set
   whose config is absent or has `spaces: []` and whose layout holds no pending
   paired write skips the menu and takes the Fresh path (#877); unreadable,
   unsafe or pending data keeps the menu. Restore uses the unchanged setup
   path. Fresh, on final `user` confirmation only, renames
   the complete set to `houseplan/archive/<unique UTC timestamp>/storage/` and
   its three sibling data directories. Archives are outside active discovery,
   quotas and housekeeping and have no automatic retention cleanup. Unsafe
   links/cross-filesystem moves abort before transfer; handled errors reverse
   completed renames, without overwriting files. A failed rollback preserves
   the partial archive and logs its path; this is not a crash-atomic transaction.
   Single-entry/in-progress fences prevent moving an active installation's data.
3. **Reactivity.** Every `hass` update re-renders. Registry rebuilds also run the
   pure `device-area-relocation` resolver: pending ids override stale layout in
   full and static cards at once; the writer deletes those points before
   advancing Area provenance and restores them if the config write is rejected
   (a failed restore leaves the attention marker); only the moved device's
   Undo/Redo is invalidated; limited snapshots never infer movement
   (`CONFIG-COMPATIBILITY.md` › Marker Area provenance (#126)).
4. **One modal contract.** Card modals render through `hp-dialog`: `ha-dialog`
   if registered when the instance connects, otherwise a first-class native
   `<dialog>` for its lifetime (top layer, backdrop, reopened once if `:modal`
   was lost); a late registration never swaps an open surface, and alert
   confirmations stay native for real `alertdialog` semantics. The wrapper owns
   title, initial focus, Escape and a shadow-root-scoped restore-focus session
   (nested dialogs return to their trigger, a replacement to the first opener).
   `flex-content` forwards `flexcontent` so an inner scroller is height-bound
   (#508); the footer stays a full-width slot item; titles wrap; destructive
   actions stay left while Cancel/Save wrap right together. Dangerous actions
   use one eager `HpConfirmController` on `HouseplanCard` plus stateless
   `hp-confirm` (#32): replace-not-queue, every dismissal cancels, a token
   rejects stale decisions, callers re-resolve targets after `await`. Native
   `confirm()` is not a supported surface.
   One card-owned `ToastPresentation` moves a single notice node between the
   root placeholder and the active `hp-dialog` footer, inside the actual modal
   flat tree (#956). A shadow-root-scoped owner stack follows connect, ready,
   close/reject and detach; nested component roots resolve to the same card.
   The absolute footer notice does not change form geometry or cover actions.
   New messages announce once; rerouting retains ordinary accessible text with
   live announcements disabled. Only `_showToast` owns the replace-not-queue
   3500ms deadline; routing does not restart it. Detach cancels pending paint.
5. **Open passages are negative architecture (#157).** `type=passage` shares
   placement, wall cut and tunnels with other openings but has no leaf, binding
   or 2.5D panel; static wall fingerprints add only passage cuts, so door/window/
   gate output is unchanged (`CONFIG-COMPATIBILITY.md` › Open-passage opening
   type).
6. **One transient-surface contract (#68, #57).** `hp-dialog` keeps a scoped
   LIFO registry for help and colour-picker surfaces: Escape/toast close the top
   one first; a new one replaces the previous only inside the same dialog.
   Slotted HA picker popovers retain their own Escape lifecycle (#988); their
   bubbling hide does not become a request to close the surrounding form.
   `hp-help` and `hp-color-opacity` share `floating-surface.ts` placement and
   `floating-surface-controller.ts` (Popover top layer, dialog-owned portal
   fallback). Help is localized by the owning card and exists only when body and
   accessible label are both non-empty. Page-wide lazy runtimes — locales
   (#62, #400) and furniture artwork (#474, #593) — settle after two failed
   attempts into English / no artwork with one toast, never an inert card.

   The device binding's inline `sourcePicker` (#989) opts into this same stack
   through `onClose?: () => void`. Its lifecycle-only directive retains the latest
   callback, releases registration when closed/detached and returns Escape focus
   to the existing trigger. Owners must identity-check their current dialog before
   closing so a retired form cannot be revived. Search and candidate rendering
   remain inline; no new floating component or saved field is introduced.
7. **One four-phase environment resolver.** `resolveDayCycle()` (`src/sun.ts`)
   and `src/day-cycle-render.ts` serve View, kiosk and the space card; plan
   content is never phase-filtered (`SUN.md` › Current four-phase background).
   The stage-sized outline root owns the triple drop-shadow and
   `will-change: filter`; its child is only the exact paper alpha silhouette,
   and the plan root gets an explicit stage-sized transform layer so Chromium
   never rediscovers it as an implicit overlap layer (#532, #582).

## Coordinate system

Plan geometry and marker positions are stored normalised on an unbounded canvas:
`0..1` = `NORM_W` (1000) render units, `±5000` validation, `1/240` lattice
(`src/canvas-constants.ts`). Source of truth: `CANVAS.md` › Principle, › Model,
› Grid precision and visual units, › Persisted coordinate canonicalisation.

## Card data model (runtime)

**Optional space model (#113).** Without authoritative spaces there is no
`SpaceModel`: `_spaceModel()` returns `undefined` and never invents one. Its
active-or-first choice serves rendering and navigation only; commands carrying a
stable space id use the exact `_spaceModelById()` and abort on a stale id before
any config, layout, file or service effect (`space-model-selection.ts`). The
first update that sees an authoritative empty `spaces` runs one cleanup (pointer
capture, gestures, draft/history, space dialogs, pending config write, back to
View); recreating a space re-arms it. Pure helpers may return empty results;
mutation entry points guard explicitly.

**`DevItem`** (`src/types.ts`) is rebuilt by `buildDevices()` (`src/devices.ts`)
from the active registry projection plus config markers: id, name, model, area,
space, icon, `entities[]` (active runtime entities only), `allEntities[]`
(metadata only), `primary` (first resolved state entity for single-target
actions; marker faces use the resolved role, `DEVICE-PRESENTATION.md`),
temp/hum, marker metadata and effective `controls`. `bindingStatus` (`active`,
`ha_disabled`, `orphaned`, `unverified`) comes only from
`resolveHaBindingStatus()`, never mutates markers, and gates every plan-level
consumer (Glow, climate, LQI, live text, openings, controls, vacuum).
Auto-discovery takes non-service devices whose HA Area is bound to a space. The
base icon is the first matching icon rule (`"<name> <model>"`) → entity
`device_class` → `mdi:chip`; a device with a `lock.*` entity is always
`mdi:lock`. Duplicate `name|area` pairs are numbered; HA light groups and Z2M
group devices become `lg_<entity>` items that fold their lamps. Hiding is
`FILTERING.md`.
The lazy editor owns `RoomDeviceDiscovery` (#879), a finite Save-scoped
placement ledger. Both room-creation paths capture eligible first placements
before new-device detection. The serialized writer includes their existing
`known_devices` baseline atomically with the room, acknowledging live settings
only after success. It never clears historical attention or exempts later
arrivals; room identity/unique Area validation drops stale intents.

## Live data

State, values, LQI and activity are resolved once per frame into one
`ResolvedDevicePresentation` (see Device markers); explicit `marker.value_source`
and `marker.value_badge` go through `src/device-value-badge.ts`. Decision table,
plate colours and LQI scale: [`DEVICE-PRESENTATION.md`](DEVICE-PRESENTATION.md).

### Presence radars (#485 Stage 1)

`marker.radar` is an optional versioned namespace saved only by the ordinary
config transaction. One backend `RadarCoordinator` per entry alone reads raw HA
states and streams clipped, ACL-filtered frames over `houseplan/radar/subscribe`;
observations, calibration samples and trails never reach config, uploads,
support reports or browser storage. Contract and code map: [`RADAR.md`](RADAR.md);
normative limits: [`specs/485-radar-presence-stage1.md`](specs/485-radar-presence-stage1.md).

### Robot vacuums

Native recovery (#1048) separates the pinned ordinary Dreame camera's saved
coordinate floor/slot from its volatile transport map/frame fields.
`vacuum_paths.py` compares existing private tuples without a Store migration;
`trails.py` trusts current full values ordered by the serialized collector's
context/attempt/generation fences, not a lifetime Dreame frame counter. Foreign
coordinate maps and other passports remain fail-closed. Retained-error display
is derived by the shared diagnostics consumer, without another path or timer.

Official Ecovacs images (#939) add a separate bounded SVG decoder
`vacuum_ecovacs.py` and HA reader `vacuum_ecovacs_reader.py`. The reader proves
same-device registry identity, owns one HA-lifetime physical read per source,
and projects coordinates/path privately into TrailRecorder; it never writes
HA entity states. Existing native snapshot authority, route selection and Store
remain unchanged. `vacuum-ecovacs-client.ts` receives small schema-1 source
frames alongside format-2 trails and projects only exact current HA revisions.
The writer-only map-preview websocket returns a sanitized embedded PNG, not
the source SVG; lazy `editors/vacuum-image-fit.ts` fences async preview ownership
and `vacuum-fit-overlay.ts` paints it in the existing affine/ACK transaction.

`src/vacuum-routes.ts` is the only map-to-space authority (six fail-closed
results, #162; mirrored byte-for-byte by `vacuum_routes.py`), `src/vacuum.ts`
owns telemetry normalization, path arbitration and smoothing, and `trails.py`
records runs server-side. Contract and code map: [`VACUUM.md`](VACUUM.md).
`src/vacuum-view.ts` alone synchronizes tip endpoints against the actual
composed SVG screen matrix; it reads all geometry before DOM writes and keeps
robot identity. The passive path SVG inherits the HTML device-layer camera
once (#871); calibration and trail-source arbitration remain separate.

Full paths (#872) use a single backend `vacuum_path_collector.py` per saved
source/robot with a HA-lifetime physical read lease, not one poll per card.
`vacuum_paths.py` owns bounded ordinary JSON/attribute decoding and the public
allowlist. #940 makes complete native snapshots (including explicit empty)
authoritative without a locally observed reset/job. Native/session boundaries
outrank dock/grace; only positional fallback uses the optional shared
`new_run_after_dock` policy. Private per-marker dock proof survives Store v1;
retired robot/route owners cannot inherit it. Run generation plus a distinct
collector attempt fence reject late responses, including same-generation Off.
Empty is published as empty geometry/revision, never as hidden stale paths
requiring a new frontend. `vacuum-dock-restart-write.ts` uses the ordinary
serialized transport but stages its isolated field only after ACK; capability
is bound to the current HA, not warm cache. Frontend `vacuum-path-geometry.ts` owns immutable revision
material and finite/ordered physical certification; `vacuum-trail-material.ts`
is the server/legacy authority and `vacuum-trail-render.ts` memoizes commands.
`vacuum-local-trail.ts` is a bounded position-only legacy reserve. Source
diagnostics are a read-only projection in `vacuum-trail-diagnostics.ts`;
their UI lives in lazy `editors/vacuum-path-diagnostics.ts`, not either monolith.
Source health, map routing, path quality and final confirmation remain distinct.
Hybrid trails (#1049) keep a bounded private shared window in
`vacuum_live_tail.py`, with a closed additive public capability. The pure
`vacuum-live-tail.ts` owns local pending observations and epoch/cursor fences;
`currentVacuumTrailFrame` composes both parts under one quota/opacity owner.
Native projection is cached independently of its changing remaining budget.
Typed pinned Dreame activity consumes a separate persisted task proof once;
request-start watermarks and unique calibrated endpoints acknowledge only an
observed prefix. Neither transport metadata nor positional timestamps become
vendor job IDs. Restart-pending raw native stays in Store, not on the plan until
the first current read. No card write or additional physical poll is introduced.
`vacuum-trail-style.ts` owns optional per-marker ink defaults and draft merging
(#1002), independently of path arbitration. The owning marker dialog previews
its current/previous/tip ink, and Save merges only touched appearance into the
latest accepted vacuum record. Vacuum-only layout lives in lazy
`styles/vacuum-settings.styles.ts`; shared formSections/disclosure/actionHelp
own section rhythm and interactions, while the native colour picker is reused.
For explicit maps (#918), `vacuum-runtime-source.ts` composes route resolution
with the same source's telemetry; both snapshot capture and live sampling use
it. Backend observation remains broad, but only the uniquely matched source
may mutate the current run. `currentVacuumTrailFrame()` shares current-path
arbitration, target trimming and SVG/quota counts between View and diagnostics.

## Sizes

`icon_size` is a percentage of the plan (default 2.5; legacy px values > 8 fall
back to 2.5), converted once at the surface boundary and rendered in `cqw` inside
`.stage { container-type: inline-size }` — [`CANVAS.md`](CANVAS.md) §6.

## Sticky header

`.head` is `position: sticky; top: var(--header-height, 56px)`, so ordinary
dashboard cards keep `ha-card { overflow: visible }` (hidden overflow breaks
sticky). The bounded `panel-host` and Sections `layout="grid"` branches own their
complete height chain and clip at the external slot instead (Key decision 1).

## Device markers

`device-issues.ts` (#972) is the shared pure severity boundary for visual samples
and the presentation’s complete current cause list. Only exact, integration-owned
Home Connect maintenance keys lower a problem signal. `device-issues-view.ts`
renders the same read-only groups in the info card and preview, while the shared
face paints a passive service wrench. Captures freeze source values and registry
metadata; static icon cards resolve detail only when opened. No persisted schema
or new HA subscription is involved.

`device-contact-{geometry,scene,snap,walls,collision,floor}` (#866) derive
opening-aware physical contacts, a spatial index, connected components and a
rounded union contour. A gesture moves one indexed marker and repaints only
affected components. `device-contact-render` measures the real shared face at a
fixed core scale and caches bounded metric variants; the lazy fingerprinted live
runtime owns it and its stylesheet. A changed value with the same fitted box and
DOM identity reuses the spatial graph. Full/static adapters share the same geometry.
The hit controller consumes each member's own rounded contact silhouette, never
the whole group's bbox. Icon/text/actions and passive diagnostics stay individual.
Contact SVGs are block boxes and reuse the normal shell border-width (#951),
including its whole-pixel used width; zoom does not require a new measurement,
graph rebuild, layout writer or camera hook to keep paths and strokes aligned.
The lazy editor resolves contact before independent spacing/grid and carries
one canonical point through preview and the existing writer/history. Optimize
receives positive all-floor face evidence and rechecks contacts against its
candidate geometry; no groups, rotations or attachments enter storage.

#1003 extends this with `device-contact-basis` (optional authored reference) and
`device-contact-layout` (stable-anchor, bounded derived reflow). The rendered
position is separate from authored storage and is shared by full/static marker
paint and individual hit/selection/overlays. No live write/Undo loop is allowed.
Unchanged geometry skips the solver; measured-face replacement updates affected
scene components. The normalised empty contour shell is also the hit geometry.
The lazy `device-contact-write` materialises relevant references during explicit
edits only. Multi-member movement is one full-layout CAS over a fresh complete
read; settings that first need references use `config/set`'s optional pair extension
and the existing durable transaction recovery. See CONFIG-COMPATIBILITY.md for
identity, unknown-extension, downgrade and transfer rules. There is no durable
group ID, constraint store, polling worker or alternate renderer.

`device-icon-roster.ts` is the pure shared eligibility boundary between painted
icons and editor alignment/equal-spacing references (#893). The editor reads
the same render-device snapshot and active LED replacement map as the canvas;
it cannot align to an invisible discovered device. `DeviceDragRetirement`
keeps a bounded retired-pointer tail journal, cleared only by fresh deliberate
pointer/keyboard intent, not a timer. Lifecycle cancellation restores only the
unfinished preview and explicitly repaints the live marker coordinates: Lit's
cached pre-drag style may otherwise skip an imperative left/top rollback.
Released serial writes and their history remain independently owned.

`config.markers[]` records are
`{id, binding: 'device:<id>'|'entity:<eid>'|'virtual', space?, area?, hidden?, removed?, name?, icon?, …}`
plus presentation, light, control, vacuum and radar fields (`validation.py` is
authoritative). Registry devices appear on their own; a `device:` marker
overrides one, `entity:` covers groups/helpers, `virtual` is a manual icon. The
id (device id, `lg_<eid>` or `v_<rand>`) keys the layout. `hidden` is the
reversible hide flag, `removed` a never-rendered binding tombstone ([`FILTERING.md`](FILTERING.md)).

View, kiosk, the static card and the dialog preview share one pipeline:
`device-visual.ts` classifies, `device-presentation.ts` resolves sources, the pure
`device-presentation-policy.ts` owns priority, `device-pulse.ts` owns activity and
`device-face.ts` only paints. `normalizeDeviceDisplay()` is the mandatory read gate
for `display` (`badge|icon_ripple|value|static_icon|value_static_icon`; legacy
`ripple` → `icon_ripple`). The saved coordinate is the icon-core centre;
overlapping 44 px targets get one screen-space owner (`device-hit-owner.ts`),
latched for the whole pointer sequence. Rules: [`DEVICE-PRESENTATION.md`](DEVICE-PRESENTATION.md);
stored fields: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md).

The full card paints from one frozen render-device snapshot per HA frame
(`render-snapshot-capture.ts`, `render-device-snapshot.ts`; the #813 rule pairs
it with its plan geometry). Once the lazy live runtime is loaded its reuse
window (`render-snapshot-reuse.ts`, #850) records which state rows each
device's presentations read and, when a tick changed nothing but such rows,
resolves again only the devices whose rows changed; unchanged rows, DevItems,
the roster and presentations keep their frozen clones. A change of any other
input — registry, roster, layout, config epoch, stored config, card config,
locale/themes, manual lights, the light graph's topology, an activity window —
rebuilds every presentation or the whole snapshot. Without the live chunk
every capture is complete (#848).

The full card's `hidden-device-visibility` owner (#919) keeps browser-local
display intent apart from saved visibility. A bounded projection of the raw
roster reveals only positively active user-hidden rows; snapshots, light,
actions, frame and icon contacts consume those display rows. Raw discovery,
metadata, catalog categories and auto-grid slots retain saved intent. Reuse
keys include the projection and preference; the static card never opts in.

The capture-local `PresentationLightFrame` (#895) indexes that resolved graph
by source key and owner once, with one lazy marker-state choice projection
only when a derived value consumes it. Reuse records the exact consumed light
keys alongside HA row reads; this includes passive sources whose `on` already
encodes incoming driver state and whose `stateEids` may be empty. A lamp tick
therefore invalidates only actual consumers, not every face because an array
identity changed. Unproved/ambiguous graph topology takes the full path. The
current frame/dependency maps are bounded by the live roster and reset with
the existing owner lifecycle; no authority or cross-floor cache is added.

`device-battery.ts` adds an independent own-device diagnostic to the same frozen
presentation. An ownership index is cached against the full HA entity registry;
values come only from active state rows. Entity-bound markers explicitly capture
their physical sensor siblings in the render snapshot, so battery-only ticks
invalidate the correct frame without changing the functional roster or actions.
The default-on shared `settings.show_device_battery` switch does not depend on
face static/live policy; exact `marker.hide_battery:true` adds a per-marker
O(1) gate before the battery resolver, while absence/false inherits the global
choice. Active LED representations omit the indicator. The
passive out-of-flow frame uses one built-in HA MDI icon at the three designer
control sizes, without separate artwork delivery. A continuously sized CSS
drop-shadow is composited on that existing icon; it adds no DOM, observer or
registry scan. Zigbee routes and captions have separate stacking levels: endpoint cores
remain above routes, captions remain above their batteries. Endpoint markers rise
above the route layer as a whole, battery included, so a route copy one level
higher is clipped to their battery frames: routes paint over batteries without
covering cores (#808). The same copy is also clipped to the value-badge frames
of the endpoints, measured in the same layout frame without padding (only the
flex gap separates a badge from its core), so lines and arrows paint over badges
too (#829). A topology snapshot is labelled stale after an hour.

Attachments are staged in `up_*`, promoted into `<config>/houseplan/files/<id>/`
on Save and served by signed `/api/houseplan/content/files/…` URLs (Integration
WS API). Custom Background images use the content-addressed
`<config>/houseplan/assets/` store (`asset_id` = SHA-256 of canonical bytes;
config never carries bytes or URLs) — [`DECOR-EDITOR.md`](DECOR-EDITOR.md) §7.

## Server-side configuration

Empty server installations expose Add space and Import backup (#875). The
file chooser opens synchronously in the user's activation; the File, not its
DOM event, crosses the editor lazy-load. `BackupImportIntent` owns each
instance-local operation through preview/revalidate/apply; close, replacement,
route departure and disconnect revoke late UI results. Writer/kiosk checks do
not require an active space and are repeated after loading and before upload
and Apply. The empty branch renders the existing backup dialog after the
editor runtime has installed its styles. On the empty screen, onboarding and
backup import never open simultaneously; this setup fence does not block the
existing Add space tab/menu on a populated plan during settings import.
Existing server ACL, CAS and paired writes are unchanged.

Optimize maintenance (#892) keeps deletion consent and its source anchor only
in the lazy dialog's memory. `optimize-source.ts` binds the config/layout
revisions and contents, owner evidence and the existing `ConfigWriteContext`
claim, including same-connection user changes; the shared paired
writer checks that anchor after pending writes have finished, before sending
the frozen revisions. A changed source rebuilds the preview without consent;
a retired-authority reply is not adopted. The unguarded Copy space caller
retains its existing contract. Current Houseplan write permission, not a new
HA-admin gate, authorizes Optimize and its paired Undo outside kiosk.

`space-reference-repair.ts` classifies proven-unused missing-space records
separately from live owners, unknown shapes/models and incomplete registry
evidence. The explicit preview option removes eligible whole records (including
unused scale); live-room scale remains a consumer even with an obsolete `s`.
Cleanup neither persists a second snapshot nor calls `layout/set`: Apply and
the existing one-deep Undo still use the server's paired storage transaction.
The report distinguishes current-space and archived-position grid shifts;
vacuum warnings name configured objects and their existing editor path without
changing routes or calibration.

`.storage/houseplan.config` holds `{model_version, spaces[], markers[], settings}`.
A space carries plan-image fields, `rooms[]` (with ordered `wall_ids`),
`wall_segments[]`, `partitions[]`, `wall_columns[]`, `openings[]`, `decor[]`,
`stairs[]` and `settings`. Coordinates keep the historical normalization
(`1.0` = `NORM_W` = 1000 render units) on an unbounded plane with a ±5000 guard
([`CANVAS.md`](CANVAS.md)); `plan_aspect` letterboxes the image and `plan_x/y`,
`plan_scale_x/y`, `plan_angle` transform it ([`DECOR-EDITOR.md`](DECOR-EDITOR.md) §3).
Layout v2 maps `device_id | rl_<roomId>` to `{s, x, y}`. Plan files are
copy-on-write `<config>/houseplan/plans/<space>.<token>.<ext>`, never deleted for
age ([`SCOPE.md`](SCOPE.md)). Migrations: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md).

### Editor gesture owners (#861)

E1 gestures have two editor-lazy owners: `PhysicalBodyGestureRuntime`
owns body drag, square-column rotation and tap/cycle state (13-purpose port);
`BackdropFrameGestureRuntime` owns backdrop drag, derived frame and transforms
(14-purpose port). Neither imports the card or its broad HostPort. Selection,
dialogs, canonical transactions and history remain in their existing owners.
Queue keys use the opaque card identity; state-only reset callers preserve
their existing asymmetry. Begin/end publish a full editor boundary; moves use
the existing live route. The live renderer paints only the moved partition's
hosted openings from the shared resolved preview, suppresses their settled
copies and omits preview hit targets. Other openings are untouched. This is
the sole visible change; E2–E7 editor extraction is not part of E1.

### Editor draft ownership (#851)

`ConfigAdoption` separates the last confirmed config/layout cache from mutable
editor bodies (#890). `restoreCached` seeds only an empty owner; repeated public
`setConfig` changes card-level floor/default options without replacing accepted
revisions, pending edits or history. Accepted writes refresh LS_CFG, while a
storage exception cannot reverse server acceptance. `ConfigWriteContext` fences
queued writes and late replies at HA connection/user replacement; a reconnect
through the same connection retains independent drafts. Foreign authority
retires structural identity/history until that context's config/layout reads
complete. Write queues and pending counters are context-owned: fast new reads
and saves never wait for old transports, whose completion cannot retire a new
counter. Optimistic attempts also lose rollback ownership across contexts even
when both installations have identical content and numeric revisions.
Already subscribed live callbacks also capture that context plus connection
and subscription generation. Retired delivery is refused before any read or
mutation, including the gap before the new paired load installs subscriptions.
The trail callback additionally owns its captured transport and latest request
through `vacuum-trail-refresh.ts` (#901); it rechecks after the read, so an old
success/rejection cannot replace the new trail or its format.
`plan-optimize-undo.ts` owns the existing shared Optimize/full-import Undo tail.
It captures write authority and transport before sending, guards config-read
capabilities and paired adoption (including the backdrop await), then guards
success/error/finally. Foreign HA assignment and detach retire its local lifecycle
and busy/capability state; a fresh operation never waits for the retired transport.
This changes no server CAS/ACL or paired-write protocol and does not touch Apply.
`new-device-ack` owns one explicit visit's attention change and restores
only that ID after rejection, without a background retry loop. Vacuum routes
pass the same optimistic attempt through write-time canonicalization.

`device-editor-access.ts` separates Houseplan writing from HA administration
(#844). The core guards the info footer, direct lazy entrance and each latest,
connected completion; disconnect invalidates the request generation. The
runtime independently guards its entrance, and the core guards acknowledgement,
View dialog paint and warm restoration. Automatic registry lifecycle updates
keep their existing writer-only gate, including kiosk writers. The Area
affordance is administrative outside Plan and passive for Plan writers; the
navigation handler independently checks its current authority.

`editors/dialog-baseline.ts` holds page-memory comparison keys and per-opening
owner tokens, transferred with warm drafts but never serialized. `draft-close.ts`
rechecks ownership after confirmation; `draft-actions.ts` composes the ordinary
form and existing Radar discard into one question and guards editor navigation.
`editors/room-save.ts` keeps a room-settings draft until its own accepted write,
staging through the same runtime/ConfigAdoption boundary as marker saves and
retaining #842's rollback/deferred-write authority. `editor-chain-exit.ts` owns
the failed-finish navigation decision; its leave path only releases session
state. Neither helper writes a schema key, deletes walls or bypasses preflight.

### Persisted colour boundary

Every stored colour is exactly `#RRGGBB`: `src/color.ts` resolves it and
`validation.py::_COLOR` guards writes. Render-time resolvers re-apply a safe
default because old, imported or hand-edited stores are not migrated on read.
HA `rgb_color` is live state: three finite channels, clamped/rounded to 0–255 and
emitted only as generated `rgb(R, G, B)`. The final inline-style sink accepts
only those two forms; arbitrary CSS colour syntax would need a separate
product/security decision and must not be added to an individual sink.

## Room and independent wall geometry

Identity ordering (#845) is a pure shared leaf, `codepoint-order.ts`: Python
Unicode code points, never locale or UTF-16. Both migration ID sets reserve
stairs. The Python materializer mirrors `atomicPolyForRoom`'s split-point
precedence and positive short-edge contract, plus `thicknessCmAt`'s final
compatibility inheritance before previous cm. Its wall key uses the already
documented storage-noise boundary. The independent node proof/Undo protocol
is unchanged. Corpus and room parity run against actual modules in the existing
`geometry_parity` job, without trusting a frontend verdict or repairing on read.

Model v10 (#282, #306, #478): `wall_segments[]` is the authoritative catalog of
atomic room-wall intervals with stable ids, `rooms[].wall_ids[]` orders each
contour, and room polygons plus `walls[]` are read-compatibility projections.
Every accepted Walls-chain edge is an ordinary `partition`; `wall_columns` are
square/circular columns; neither creates or implicitly splits a room or HA area.
`cm:0` keeps a structural axis and identity without masonry; `space.zero_wall_style`
makes it dashed (transmits light) or solid (a zero-area barrier). Reads are
projection-only: a physical-geometry mutation builds a local candidate,
canonicalizes it, materialises the catalog (`src/wall-segment-model.ts` ↔
`wall_segment_model.py`, shared parity fixture), validates references and commits
one config transaction; ambiguity fails closed with no partial config, history or
revision. Model and lineage: [`WALL-THICKNESS.md`](WALL-THICKNESS.md) §1;
migrations and stale-client guard: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md)
(model v8–v10); rationale: [`adr/282-wall-geometry-representation.md`](adr/282-wall-geometry-representation.md).

The validated candidate is adopted in place only at the commit boundary (#826).
Root and id-bearing editor records retain identity; scalar arrays receive their
own shallow copy so shared point tuples cannot overwrite another owner during
recursive adoption. Values and property order match the candidate exactly;
the candidate is never mutated. This is not a full live-model clone or new
pointermove work, and array identity without an id is not a gesture guarantee.

Room-face acceptance uses `wall-face-lineage.ts` to choose provisional carriers
and settle only new-room hints against the partitions left after reconciliation
(#804). A residual keeps its identity without colliding with the promoted room
edge. The common model barrier, host validation and atomic history remain the
authorities; this helper neither allocates IDs nor writes configuration.

`wall-face-room-split.ts` is another lazy Plan-only pure proposal helper (#874):
it proves parent-minus-face as one hole-free component and deduplicates
complementary faces without changing the model. The runtime revalidates a
space/geometry stamp, retains each original wall/partition profile and commits
the split with carrier reconciliation in one existing history/config command.
Refusal/reload closes only the discarded room-face creation form. No View,
pointermove or HA-state rendering path imports or invokes this clipping helper.

Rooms may not partially overlap (lying on a shared wall is legal, a fully nested
island is supported). Merge/Split use **polyclip-ts** (not `polygon-clipping`,
see [`DEVELOPMENT.md`](DEVELOPMENT.md)): Merge accepts a pair only when the union
is one hole-free outline; Split cuts wall-to-wall and the larger part keeps the
room identity (name, area, devices).

`wallBodiesGeometry()` is the single physical masonry for flat full/static
rendering, 2.5D, paper, clean floor and Glow/sun occlusion. Its exterior shell
comes from the union of room centrelines plus surviving `outer` atoms; junctions
follow the bounded mitre/bevel rules (#249, #271, #272, #275, #288, #302, #309,
#310); independent bodies join through `physicalBodySet()` while raw quads keep
editor identity. The result is a typed component set (`ok`, `degraded-extra`,
`failed-core`; #197, #278): rendering keeps every valid component, mutation
preflight rejects `degraded-extra`, `failed-core` fails dark. It is computed state
only — cached per structural geometry, never written back, never rebuilt by HA
state ticks. Contract: [`WALL-THICKNESS.md`](WALL-THICKNESS.md) §2–§4, §9–§11.

Floor-geometry caches are keyed by their inputs, never by the global config
epoch, and their keys and pools come from one module, `src/floor-geometry-key.ts`.
The structural reader excludes annotations through `structural-space-record.ts`
(#1071), retaining all non-decor fields and both model/current records. Contact
walls use that same reader. Light barriers use the same projection plus their
existing LED-source exclusion, so the shared masonry tag stays aligned.
The generic record memo, complete config hash and history remain decor-aware.
The wall union, physical bodies, inner contours and clean floors key by the
content of one floor record (#744, #769); the union, the bodies and the opening
tunnels keep a bounded pool of recently shown floors (eight, LRU) next to the
active entry, so a warm floor switch builds none of them (#814). The opening
wall index and the sun wedges key by every input they read (#814); an edit of
another floor or a shared setting leaves them warm. Every pool is an
instance-local memo: nothing is persisted, and a remounted card starts empty.

## Markup editor

Card state: `_mode`, `_tool` (`select|draw|column|merge|split|resize|opening|
stairs|wallthick|delroom`), session `_path` on the `GRID_N = 240` lattice
(`_snap`, `CANVAS.md` §9). Committed geometry enters the named 50-command
Undo/Redo stack shared with Background (`DECOR-EDITOR.md` §6, §9); it survives
the echo of its own writes and clears on a newer external revision. A refused
step never clears it (#883, `geometry-history-step.ts`): `_applyGeometryState`
answers `true` or a reason and the cursor moves only on success. A fixed
`floor` elsewhere (owner decision), a not yet authoritative baseline or an
exception is temporary and keeps the command; a missing exact space, an
unrestorable snapshot or an explicit physical/wall-model verdict removes only
that command object from the direction it is in (identity, never name or
floor). One press is one attempt in all four call sites (Undo, Redo,
active-chain Redo, active-segment Undo); an unfit step ends an obsolete
transient Walls chain without a write. Snapshots are not rebuilt after a
removal; node commands keep #843's server path.
Own strict-write refusals (#891) use `PhysicalWriteHistory`: the pending
baseline owns exact command objects. Rollback restores only the physical
carrier, preserves independent presentation state, and rebases presentation
snapshots that contain refused walls so their Undo/Redo cannot resurrect them.
A retired baseline never owns a fresh transaction. The pending-write journal
distinguishes new provisional commands from cursor steps over accepted
commands. A retryable deferred refusal restores accepted identity/cursor using
bounded lane anchors, without displacing a newer top; an authoritative clear
cannot be reversed. Only a proved unsafe step is disposable with its own batch.
Only presentation commands created in that pending batch have their physical
carrier rebased; older accepted Background snapshots stay byte-for-byte intact.
If a send is accepted while newer physical work is queued, that newer batch is
promoted to the exact accepted geometry/reference baseline. Its later refusal
cannot roll back the earlier accepted send or retire its accepted commands.
The active Walls redo
journal survives the transient history reset; explicit finish still retires it.
`wall-node-refusal.ts` names a finite set of proved-invalid codes; unknown or
backend-processing errors retain node commands, and incompatible clients ask
for an update. The backend sends a sanitized retryable processing code before
any write; domain and invalid-request refusals keep their existing codes.
Every
physical-geometry writer crosses one fail-closed boundary (#278,
`checkSpacePhysicalGeometry()`) before history/save, rechecked at the deferred
write; presentation edits bypass it. Contracts: Walls chain, faces, room
deletion, partitions — `WALL-THICKNESS.md` §6, §9–11, `CONFIG-COMPATIBILITY.md`
(#478, #461), `TOUCH-SUPPORT.md`; Resize (#277, #300) — `RESIZE.md`; near-axis
(#290, `src/near-axis.ts`) and the editor-only wall-end alignment magnet of
Walls drawing and node movement (#885, `src/wall-end-align.ts`, in the
`editor-shared` chunk) — `CANVAS.md` §9.3. `reconcileCoincidentPartitions`
(#276/#296/#477) and `normalizeWallIntervals` (#299) run plan-wide only in
explicit Optimize, locally in chain finish/room deletion, never in render or
ordinary saves. Saves strip the legacy root `space.segments`.

Ordinary config/set alone enables the pure same-ID partition→room-wall proof
in `partition_promotion.py` (#996). The validator indexes current room-wall IDs
and resolves both authoritative axes in the same space; no client capability or
new persisted state is trusted. Only full promotion with unchanged scale, axis,
positive depth and opening fields/geometry passes. This permits ordinary room
Undo/Redo/recreation without granting import or Optimize a new rehost path.

### Stairs (#663)

Separate Plan entity, not decor (`STAIRS.md`). Eager `StairViewRuntime`:
symbols, tooltip, guarded navigation; lazy `StairEditorRuntime`: drawing,
transforms, magnets, properties (a plan never loads the editor graph). The root
card keeps lifecycle, shared history/persistence and stage pointer terminals;
pure model, tread/trapezoid geometry and style resolution stay in `stairs.ts`.

The optional `color`/`opacity` and `fill_color`/`fill_opacity` fields are a
snapshot owned by the stair. Missing legacy fields resolve at render/dialog
time from the current decor default but are not written until the user saves
that stair. Screen renderers consume the colour fields; PDF deliberately uses
the same geometry with its existing monochrome ink palette.

## Editor chrome and contextual controls

One stable `.editbar` per editor: `.editbar-tools` (persistent tools,
Undo/Redo) and pinned `.editbar-end` (Close); transient controls never enter
this measured row. Selection actions, tool parameters, hints, palettes and the
approved groups (Opening, Stairs) come from one `EditorSecondaryModel` in the
single light-DOM `.editor-secondary-host` inside `.stage`
(`editor-secondary.ts`): outside the `_hdrH` measurement, pointer events only
on its visible surface, empty in the Device editor (future marker quick
actions go there). Mutating actions revalidate a deterministic `contextId`;
`Delete`/`Backspace` never fall through from it. Product rule: `UX-MODES.md`.

## Doors, windows, gates & passages

`space.openings[]` is plan geometry, not markers: `{id, type:
door|window|gate|passage, x, y, angle, length, host?, contact?, lock?, invert?,
flip_h?, flip_v?}`. `host` `{kind: wall|partition, id, t}` is authoritative and
`x/y/angle` its atomically refreshed projection; an absent host is the legacy
room-wall association, and no host ever falls back to a nearest wall
(`CONFIG-COMPATIBILITY.md` › #132/#157). One `OpeningWallIndex` feeds symbol,
cut, tunnel fill, Glow and the 2.5D face (`WALL-THICKNESS.md` §3–4,
`ISOMETRIC.md`, `LIGHT.md`). The Flat symbol follows easy-floorplan (MIT).
`openingAmount()` maps contact state to 0..1 — no sensor: door/gate open,
window closed; `unknown`/`unavailable` keep that default. Contact and lock are
opening-owned exact references: candidates follow HA binding status, render
reads the frozen active-registry projection (never raw `hass`), neither
consults marker tombstones. The `.oplock` badge never toggles a lock
(`resolveToggleIntent` → no-op, `SCOPE.md`); openings are edited only in Plan.
In View the badge is a named, keyboard-focusable information button; pointer,
Enter and Space open the same existing card without service dispatch (#849).
Its focus outline does not change its Flat/2.5D hit geometry. Device-card rows
share the exact-entity/security resolver in `device-toggle.ts`, with a captured
`infoCardRowContextKey` over current binding, controls and row identities;
state-only HA frames may change direction but never redirect a confirmed row.
Dispatch also consumes a captured claim from the existing `ConfigWriteContext`:
foreign connection/user adoption retires a pending action even in the public HA
frame before Lit removes the outgoing DOM. No second authority owner is added.

## Integration WS API

Space deletion from the editor uses `editors/space-delete.ts`
after confirmation (#819/#826). The caller retains its confirmation copy;
the shared path re-resolves the dialog/space and confirmed marker set, flushes
pending writes, then adopts re-read config/layout rather than the delete reply.
This lazy module imports the editor host only as a type, never the editor runtime.
The card delegates to the editor; the space-settings form port supplies Delete.
Onboarding supplies only create/import controls, not a deletion port/adapter.
The TS pure mirror clears only incoming stair targets after an actual accepted
deletion, matching Python; blocked or absent targets cause no cleanup. The WS
endpoint rejects an absent target before calling its pure candidate.

`space/delete` filters explicit vacuum map routes to the deleted space inside
`_space_delete_candidate` (#822), before the existing paired commit. It keeps
other routes, root vacuum settings and the dock intact; an emptied list stays
`[]` to retain its precedence over legacy calibration. Refusals do not mutate
either Store, and there is no extra config write or schema/WS-key change.

`auth.may_write()` is the single writer policy for WS and HTTP: administrators
always write; `admin_only` (default `true` when unset) restricts writing to
them; with `admin_only: false` other users write unless they belong to
`system-read-only`. A missing entry or incomplete group data fails closed.
Reads are deliberately broader: every authenticated user receives the complete
config/layout (no per-entity projection), trails without `source` entity ids
(#626) and may toggle virtual lights. **W** = writer-only (else
`unauthorized`); runtime-backed commands answer `not_ready` before setup.

| `houseplan/…` | Parameters | Result · domain errors |
|---|---|---|
| `config/get` | `space_id?`, `fields?`, `marker_fields?` (#256; project only the document) | `{config, rev, virtual_lights:{rev,config_rev,off[]}, can_write, can_optimize_undo, undo_kind, integration_version, support_api, decor_assets_api, summary_panel_api, radar_stage1_api?}` |
| `config/set` **W** | `config`, `expected_rev` | `{ok, rev}` · `conflict`, `too_large` (2 MiB), `invalid_format`, `missing_plan`, semantic codes below |
| `layout/get` | `space_id?` | `{layout:{id:{x,y,s?}}, rev, can_optimize_undo, undo_kind}` |
| `layout/set` **W** | `layout`, `expected_rev` | `{ok, rev}` · `conflict` (external clients; the card writes points) |
| `layout/update` **W** | `device_id`, `pos` | `{ok, rev, ignored?: removed\|missing_virtual}` — a tombstoned owner's late drag is acknowledged, not stored |
| `layout/delete` **W** | `device_id` | `{ok, rev}` (`rev: null` when nothing was stored) |
| `space/delete` **W** | `space_id`, `expected_config_rev`, `expected_layout_rev`, `remove_markers?` (#819: the blocking markers go as with the device dialog's Delete, in the same pair write; ignored for the last space) | `{ok, config_rev, layout_rev, removed_layout, removed_markers}` · `space_in_use` (without `remove_markers`), `space_not_found`, `invalid_space_id` |
| `plan/optimize` **W** | `config`, `layout`, both expected revs | `{ok, config_rev, layout_rev, can_undo}` — also the server-side wall-model migration barrier |
| `plan/optimize_undo` **W** | both expected revs | restores the one-deep Optimize/full-import backup · `no_backup` after any later edit |
| `geometry/repair` **W** | `space_id`, `aspect`, `dry_run?`, `undo?`, `expected_rev?` | manual re-transform of one space's positions (HP-1500-01) with one-deep `repair_backup` · `nothing_to_repair`, `no_backup` |
| `export/create` **W** | `kind: full\|space`, `space_id?`, `plan_only?`, `card_version` | `{document, filename}` |
| `import/revalidate` **W** | `token`, `duplicate_policy?` | refreshed preview and current revisions |
| `import/apply` **W** | `token`, both expected revs, `duplicate_policy?`, `confirm_missing_content?` | paired commit; full import gets one-deep undo · `conflict`, `preview_expired`, `content_confirmation_required`, `missing_plan`, `missing_content` |
| `virtual_light/toggle` | `marker_id` | `{marker_id, on, rev}` · `not_toggleable` |
| `trail/get` / `trail/delete` **W** | — / `marker_id` | `{trails:{marker:{current,previous}}}` / `{ok, removed}` |
| `plans/list` **W** / `plans/delete` **W** | — / `name` | newest 60 `{name,url,size,modified,used_by}` + `total` / `{ok, removed}` · `in_use`, `invalid_name` |
| `plan/set` **W** | `space_id`, `ext`, `data` (base64) | `{ok, url}` — kept only for pre-#617 cards; current cards use HTTP |
| `files/migrate` **W** | `from_id`, `to_id` | `{ok, mapping, copied}` — copies, never moves or overwrites |
| `files/cleanup` **W** | `marker_id` | `{ok, removed, kept}` — removes only files the stored config does not reference |
| `assets/list` **W** / `assets/delete` **W** | — / `asset_id` | catalog with authoritative `used_by` / `{ok, removed}` · `in_use` |
| `assets/resolve` | `asset_ids[]` (≤200) | `{assets, missing}`; non-writers resolve only ids the saved config uses |
| `content/sign` | `paths[]` | `{urls}` — 24 h `authSig`, only `/api/houseplan/content/…`, first 200 paths |
| `support/*` **W**, `radar/*` | — | `SUPPORT-PRIVACY.md`, `RADAR.md` |

Semantic write codes: `invalid_config`, `invalid_passage_fields`,
`invalid_partition_opening_host`, `invalid_partition_opening_jamb_margin`,
`wall_model_client_outdated`, `wall_model_migration_blocked` (Optimize),
`junction_limit_<rule>`, `invalid_radar`, `invalid_light_entity`,
`invalid_vacuum_map_route`, `*marker_control*`, `invalid_value_badge*`; paired
writers add `commit_failed`. Events: `houseplan_config_updated`,
`houseplan_layout_updated` (`{rev}`), `houseplan_virtual_light_updated`,
`houseplan_trail_updated`.

HTTP views (`requires_auth`, same policy): `POST /api/houseplan/upload`
(marker attachment), `/plans/upload` (#617), `/assets/upload`
(`DECOR-EDITOR.md` §7), `/import/preview` and `GET
/api/houseplan/content/{kind}/{sub}/{name}` (`nosniff`; SVG only gets a
`sandbox` CSP, HP-1454-01). Only the manifest-gated bundle under
`/houseplan_files/` is public; legacy `/houseplan_files/plans|files` URLs are
still recognised in stored config but no longer served
(`CONFIG-COMPATIBILITY.md` › Legacy content URLs).

**Invariants**

- *Optimistic locking.* Each config/layout writer takes `write_lock`, resolves
  a pending pair, then checks revisions before validation, no-op detection or
  file collection. `expected_rev` may be omitted only at `rev = 0` (#340,
  #356). External writers read `rev` via `config/get`/`layout/get`, send it as
  `expected_rev`, and on `conflict` re-read and retry (#368). A canonical no-op
  keeps revision, events and the maintenance backup.
- *Paired writes* (Optimize, Optimize Undo, full import, space delete) use the
  durable `optimize_pending` intent and one-deep `optimize_backup`
  (`kind: optimize|import`) — `CONFIG-COMPATIBILITY.md` › #491. Events fire only
  after both halves are durable; Store exceptions are resolved by reloading
  and comparing exact payloads; layout-store writes go through
  `async_save_layout_state` so unknown metadata survives.
- *Validation is the server's.* Schema/semantic checks run in the executor
  under the lock; the browser never parses an import. Frontend preflight
  (`src/plan-geometry-preflight.ts`) only avoids doomed calls.
- *Files* (`SCOPE.md` › Standing rule): uploads claim a fresh name
  (`reserve_filename`, `O_EXCL`), plans are copy-on-write
  `<space>.<token>.<ext>` (a space id cannot contain `.`), and `check_quota`
  bounds bytes/files/free disk at upload. `config/set` collects, under its
  lock, only what its own commit replaced; a daily pass runs the collectors
  with the stored config on both sides and sweeps `.upload-` temporaries. A
  newly referenced internal plan must exist (`missing_plan`; import also checks
  attachments). A usable `Content-Length` is checked before streaming, the
  staged size again under `upload_lock`, which also serialises image decoding.
  Collection classifies by **owner**, not by "is it referenced" (HP-1465-01);
  nothing is deleted for being old except `up_*` staging after
  `PLAN_ORPHAN_TTL_S` (1 h), and `plans/list`/`plans/delete` make "we never
  delete" livable:

  | Case | Rule |
  |---|---|
  | Space in both, plan A → plan B (the user picked another image) | removed immediately |
  | Space in both, plan → none (detached; one click undoes it) | **kept** |
  | Space gone (the image was imported and may be nowhere else) | **kept** |
  | Space has a plan plus another file of its own (a rejected save) | **kept** — ageing these out raced the retry |
  | Marker in both, attachment dropped from its list | removed immediately |
  | Marker gone | **kept** |
  | Attachment in `up_*` (a dialog never saved) | removed after `PLAN_ORPHAN_TTL_S` |
  | Marker there, file it never listed (a rejected upload) | **kept** |
- *Import preview* streams ≤8 MiB, rejects duplicate/prototype keys,
  non-finite numbers and future model versions, and keeps the candidate in
  memory for 10 min behind a token bound to the user, candidate digest and
  both revisions (global and per-user caps). *Export* deep-copies one coherent
  pair under the lock and builds outside it.
- *Virtual-light state* lives in its own Store (`CONFIG-COMPATIBILITY.md`);
  toggles reply immediately and coalesce into one delayed durable write,
  flushed before config transitions and unload. A cached snapshot never
  authorizes an optimistic toggle.

**Client side**

- `_writeConfig()` keeps one `config/set` in flight, each carrying the previous
  reply's revision (HP-1454-03). A rejected physical transaction restores the
  earliest server-backed snapshot of every affected space and reloads (#314).
- `src/config-adoption.ts` (#500) owns config/layout body + revision +
  fingerprint. It changes only by authoritative adoption
  (`adoptAuthoritativeGated`, profiles `reload`/`post-write`), own-write
  acceptance (`acceptConfigWrite`, `acceptPairWrite`) or warm-cache restore;
  paired writers take revisions from the re-read. Local staging is limited to
  files pinned by `test/config-adoption-ownership.test.mjs`. Ordinary debounced
  editor saves remain optimistic: a rejection that is neither a revision
  conflict (which reloads) nor a physical-geometry rollback keeps the local edit
  with a failure toast until the next authoritative reload. Writers that must
  undo on rejection capture an `OptimisticAttempt`
  (`beginOptimistic`/`rollbackOptimistic`), which restores the server-backed
  body only while that failed candidate is still current (#442, #500).
- Write preparation never deletes plan objects silently
  (`src/geometry-cleanup.ts`, #842). Every editor write first finds R — the
  `partitions`/`wall_columns` the legacy write filter would drop (bad or
  repeated id, point off the canvas, degenerate partition) and the openings a
  dropped partition hosts — on the config exactly as the operation hands it
  over, so an operation's own deletion (Delete, Optimize) is never R. A
  non-empty R refuses the write before `config/set` with the live config
  untouched (an immediate writer rolls its attempt back as usual) and, instead
  of an error toast, asks one destructive confirmation: «Delete and save»
  removes exactly R and writes the current plan once; «Cancel» sends nothing
  and the next write asks again; teardown refuses without asking. Only a
  decided write runs the normalisation that deletes nothing (columns keep
  unknown fields; the `walls` degradation stays the canonical cleanup).
- An immediate writer that cancels a pending deferred write
  (`_saveConfigDebounced`) carries its content; if the write is rejected and
  its own rollback succeeds, `supersedeDeferredWrite` re-arms that deferred
  write once — never after a conflict reload or a newer adoption. The
  re-armed write sends the live config of its moment and teardown flushes it
  like any other (#842).
- `src/config-reload-authority.ts` (#543): each reload holds a generation-scoped
  claim; a superseded one ends with no side effect.
- `src/layout-write-reload.ts` (#902) fences complete reloads against own
  point-writes, including a write settled after the read started or inside the
  backdrop await. One normal pair gets at most one post-settlement retry;
  another actual overlap re-arms once after that attempt finishes. This is
  event-driven, not polling. Accepted cache never receives an unacknowledged
  overlay; the fresh server revision/body decide external replacement and
  history invalidation. Active-write tokens and waiters retire with HA identity
  or detach. Released drag/history terminals share that generation so an old
  success/error/finally cannot roll back a new owner or release its busy flag.
- `src/card-read-lifecycle.ts` (#824) owns ephemeral full-read transport claims
  for both cards, independent of visual HA deduplication. Disconnect/context
  replacement/navigation fence every awaited adoption and optional tail.
  Context is observed per HA assignment before Lit coalesces A→B→A; transport
  restart waits for the current usable authority, including a temporary HA gap.
  A known connection/user replacement on a mounted full card also retires its
  consumed HA snapshot identity (#1056); even a reused object reaches the normal
  Lit intake once for the final authority, without an extra HA tick or read owner.
  Static attach revalidates the server; a full long return without HA defers.
  A foreign HA assigned while detached also retains a current read intent
  after retiring the accepted document (#1054). Reconnect consumes that intent
  through the same loader; loaded, idle same-context short returns have none. Visual HA
  deduplication, including a reused object or coalesced ABA, cannot erase it.
  If another detach interrupts that read, it retires the old transport claim
  while preserving demand in the same lifecycle owner for the next attach.
  The shared continuity controller owns one bounded paint attempt. A timeout
  retains matching staged data without marking a complete frame or self-retry;
  external readiness/update can recover. Canonical: `WARM-REMOUNT.md` §5.1.
- `ContentSigner` (`src/signing.ts`) is the only signer for both cards:
  `MAX_SIGN_PATHS` (200) is shared with `const.py`; the cache is age-aware and
  pruned to live URLs; queued/in-flight are distinct, failures back off and
  in-flight entries expire after `SIGN_INFLIGHT_MS`.
- Room climate is one `roomClimateMap()` pass per hass snapshot (#317) shared
  by full and static cards; exact `entity:` placement beats its parent
  `device:` (no double vote); never call the `areaClimate()` wrapper in render.
  CO₂ (#920) is an independent third result: only carbon-dioxide sensors in
  ppm, a stable valid sibling per physical device and final-only rounding.
  `room-co2.ts` owns strict parsing and formatting; the resolved number feeds
  full-plan/kiosk labels, tooltip and room-source preview. Static stays
  name-only. Explicit sources enter snapshot dependencies; unsaved choices
  use the active registry without changing that frame.
- Load, continuity and fixed-floor rules: `WARM-REMOUNT.md` § 5.
- `warm-mode-adoption.ts` completes immediate and delayed editor adoption with
  the original View return snapshot and a request-owned refit hold. Explicit
  mode/space navigation invalidates pending work before lazy-runtime awaits;
  warm header/stage dimensions are published only after the corresponding
  render, including the card-local header offset for pending chrome (#762).
  Adoption completion lives in the lazy editor graph: it only executes after
  that runtime is ready; View retains just cancellation and camera comparison.
  The room draft payload is also built by the installed editor runtime.
  This moves existing room-state reads across the already-defined editor port;
  it adds no room state. #762 records the resulting host-reference/ported-private
  counts in the monolith baseline, without widening its tolerance bands.

## Second card: houseplan-space-card (read-only)

One bundle registers `houseplan-card` (interactive) and the read-only
`houseplan-space-card` (one space; `src/houseplan-card.ts` imports
`./space-card`). User options, `fit` and the deep link: `USER-GUIDE.md` §18,
`CANVAS.md` §4.4, `LIGHT.md` › Which surfaces render pools. Shared modules keep
the two views from diverging: `space-geometry.ts` (pure model/position math),
`space-render.ts` (`renderSpaceStatic()`: plan, rooms and markers through
`buildDevices`, `ResolvedDevicePresentation` and `renderDeviceFace`, no marker
handlers), `glow-scene.ts` (opt-in `light_pools`, per-card bounded caches) and
`config-store.ts` — one module-level `{config, rev, configFingerprint, layout,
layoutRev, layoutFingerprint}` cache and one subscription for all embedded
cards, seeded from `houseplan_card_cfg_v1` and refreshed on
`houseplan_config_updated`/`houseplan_layout_updated` without first clearing
the visible snapshot. `.hp-static-stage` and every descendant
(`*, *::before, *::after`) are `pointer-events:none`, overriding the markers'
44 px opt-in (#564, #664); only the footer button is interactive, asserted by
`demo/smoke_space_card.mjs` with `elementFromPoint`. A card with `floor`
ignores `#space=`.

## Subsystems with their own canonical documents

- **Decor, plan image, furniture, custom images** — `space.decor[]` is a purely
  visual layer with one selection/transform/history pipeline; image bytes live
  only in the asset store: [DECOR-EDITOR](DECOR-EDITOR.md), [FURNITURE](FURNITURE.md).
- **Light and Glow** — one visibility region per source (#71); Glow is an overlay
  independent of the data fill (#55): [LIGHT](LIGHT.md). Shared source entry
  scheduling is owner-local; `LightBarrierPass` shares revisions only inside
  the main card's synchronous render, never across subsequent edits (#789).
  The retired uniform darkness layer and palette role are absent from full,
  static and 2.5D consumers (#943); old raw settings remain readable without
  load-time writes. Diagnostic palette projection follows the active roles.
  **Room fill** —
  `resolveEffectiveRoomFill()` is the single projection for room floors,
  clean-floor holes and opening tunnels; `room_color` styles only borders and
  names; custom colour and legacy tokens (#56, #581):
  [CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md).
- **Device state, light membership, action** — `resolvedDeviceStateEntities`,
  `resolvedLightSources` and `src/device-toggle.ts` are the only resolvers
  (#94, #251, #318, #381): [DEVICE-PRESENTATION](DEVICE-PRESENTATION.md).
- **Zero-thickness walls, nested rooms** — `resolveZeroWalls()` feeds every
  renderer, Glow and sun (#306): [WALL-THICKNESS](WALL-THICKNESS.md). **Kiosk,
  navigation** — kiosk is a card flag, not a mode; `LS_NAV` stores only the space
  (#93, #210): [UX-MODES](UX-MODES.md).

## Camera and mode transitions (#101, #82)

`KioskCarousel` (#846) owns one interval and one 60s idle deadline with injected
clocks. `cardInteractionIdleSnapshot` is shared with version recovery and reads
only transient state, not layout or geometry. Host capture observes passive
pointerdown/wheel/keydown on plan and local dialogs; pointermove never restarts
the deadline. Open surfaces and camera/gesture work hold both tick and fit.
Dialog close restarts 60s; expired pointer holds resume from a state update, not
a 0ms polling loop. Disconnect/config-disable retire both timers and their
generation. Arrival bypasses saved enlarged zoom before first paint and stores
the same floor-local base preference as Fit all; ordinary navigation still
restores its own preference. `_commitSpace` closes only space-bound View
surfaces on a different accepted id. `view-action-context.ts` resolves exact
current marker/floor and canonical opening/lock identities before service calls;
stale confirmation never becomes permission to act on another floor.

The connected-node harness clock (#952) uses one complete fixed series of 32
independent CDP RTT probes before/after each gesture. It still requires the
tightest conservative bound within 1 ms, all intervals consistent and before/
after overlap; source clocks never refit. Unavailable clocks remain a distinct
calibration failure with raw/phase evidence, not a product-performance verdict.

The kiosk smoke's setup barrier (#949) lives only in the demo harness. It waits
for native stage height transitions and accepted ResizeObserver/Lit geometry
before freezing page time: JS fake-clock jumps do not advance the CSS timeline.
It never waits for the asserted zoom or changes the product's resize/camera policy.

The existing `STAGE_TAP_DISTANCE_PX` pan/swipe classifier cancels the owning
`KioskHoldGesture` as soon as navigation is recognized (#825). Returning to
the press origin cannot re-arm it; sub-threshold jitter is still a hold.
There is no additional threshold or timer.

Two one-token/one-RAF controllers own every animated camera change and leave
no CSS timers or WAAPI animations behind. `ModeTransitionController`
(`src/mode-transition.ts`) is the only timeline for entering, leaving and
switching editors: it interpolates measured chrome height, stage geometry,
world-space camera centre, logarithmic pixels-per-unit, stage/paper colours,
day/night brightness and presentation weights together, deriving each `viewBox`
from the current stage aspect; the stage is inert meanwhile, header tabs stay
live for a retarget. `src/viewport-transition.ts` animates discrete zoom in a
settled mode with the same easing but only `{zoom, viewBox}` (no chrome,
background, layer opacity or CSS transform) and lives in the core View bundle.
The component stays the sole camera writer; ownership boundaries and timings:
[CANVAS](CANVAS.md) › View/editor camera handoff and §5.

LED zoom quality (#789) is a separate owner-local scale-activity deadline,
not another camera writer or a source transition. Actual changes to viewport
width/height set a host attribute before live paint; 160 ms of inactivity clears
it. CSS changes only the existing LED mask bands (48 retained, 24 painted),
without a geometry rebuild or a second SVG. Camera/lifecycle cancellation
clears the deadline; static cards do not participate. Ordinary Glow's pan/fade
blur policy remains independent.

## Settings tiers (owner's principle, 2026-07-26)

Four levels: **global (`config.settings`) → space (`space.settings`) → room
(`room.settings`) → device (`marker.*`)**. Duplicated options are deliberate:
the more specific tier wins and "unset" always means "inherit". Resolution
lives in pure helpers (`spaceDisplayOf`, `roomFillModeOf`, `roomGlowOf`,
`roomTempRangeOf`, `sourceValue`, `resolveToggleIntent`), never inline in render;
each tier keeps its own dialog (General settings, space, room, marker).

Explicit exception (#1037): architectural wall lines/hatching (`room_color` and
`room_opacity`), wall-body fill (`wall_fill`) and caption base (`name_color`) are
space-local, with no ongoing global inheritance. Only caption colour has a room
override; room names and readings share its colour/alpha, preserving special
state colours. `room-appearance.ts` and Python `room_appearance.py` own legacy
projection. The old global wall fill is consumed only when materialising a
legacy document, never after the local value exists. Main, static/embedded,
2.5D and live-editor paint consume the same resolved local values; PDF keeps
its separate printing palette. No geometry cache or HA entity source changes.

## Schema as the source of truth (#33)

The Voluptuous schema in `custom_components/houseplan/validation.py` is the
single owner of the persisted config/layout shape. The generated manifest
`scripts/config-schema.json`, the enum parity test with its self-checking
allow-list, the decision registry `scripts/config-field-registry.mjs` and the
lifecycle fixtures keep every other world honest against it:
[CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md) › Schema manifest and parity.

## No hidden discovery knobs (#44)

Every stored key that shapes device discovery is a visible, supported setting
or does not exist. `settings.group_lights` and `settings.exclude_integrations`
live in the device catalog's Discovery-filters section and are resolved only by
`effectiveExcludedIntegrations()`: [FILTERING](FILTERING.md) › Seeding.

## Contextual Zigbee topology (#54, #457, #464)

LED endpoints (#1004) read the current painted hit path's native half-length
point and screen CTM, then convert once into the HTML overlay camera through
`zigbee-topology-endpoint.ts`. No stored hidden-icon position, second LED frame
cache or eager runtime import is used. The existing nearest LED hit owner now
publishes its transient hover attribute for SVG targets too. The overlay
observes the common stage for SVG/HTML input and active layout changes; child
replacement rechecks that owner instead of keeping hover on a replacement icon
elsewhere. An inert local participant layer borrows only the actual LED top
strokes, preserving off-core alpha via bounded path masks. Original shadows,
edges, hit/focus and services remain owned by the LED renderer. Endpoint cleanup
restores original top paint and clears passive-badge elevation. The small
LED halo is after that layer at z8; its inverse local camera scale preserves
14 CSS pixels even over a wide tube. Ordinary icon halo/layer policy is unchanged.

#867 separates physical diagnostics (`device-signal.ts`) from functional/action
rosters. Registry-identity ownership indexing is reused across state ticks; own
sibling reads are tracked by the presentation reuse window and included in the
frozen render snapshot even with battery indicators off. `areaLqi` and the card's
room projection share one physical-radio-per-room aggregation. The optional
`hide_signal` flag affects only the system plan line, not sources or controls.
Embedded floor captures pass that same full-registry-owned context to both
presentations and snapshot projection; a newly allocated active projection is
not the ownership key of the diagnostic index.
Topology mapping records all eligible hover aliases while preserving one device
or configuration-ordered entity representative. Cross-floor representatives use
existing named remote bubbles, without routing through the hovered alias. An
actual overlay resize re-renders only that overlay's viewBox/centres before its
DOM-only caption/clip fitting; camera-only fitting does not re-render the card or
start provider work.

The initial View graph holds only the fail-closed settings reader and a dynamic
overlay bridge; the overlay chunk loads only for a saved
`settings.zigbee_topology.enabled === true`, a real HA admin, full-card View and
a non-kiosk surface. General Settings loads provider transport only when an
enabled setting needs status or the admin presses a provider action.
When only the draft enables links (#1031), provider actions explicitly save all
General Settings through the owner's validated CAS writer before loading. A
keep-open save advances the accepted draft baseline without replacing its dialog
session or discarding later edits. `zigbee-topology-action.ts` coalesces clicks
and retires the continuation on section, session, identity or connection changes;
provider/backend authorization and already-enabled read-only refresh stay intact.
Detached settings components cannot request late renders or reacquire a metadata
lease when that save finishes; metadata ownership also checks connectivity.
`zigbee-topology.ts` normalises ZHA and Zigbee2MQTT into directional observations
and provider evidence (#798): Parent/reverse Child for end devices, active
destination-zero routes for routers. NWK addresses are provider-scoped; exact
registry ownership maps nodes to markers. Only unique evidence becomes an
arrow. Conflicts, cycles and unknown roles fail closed, including merged
providers; no BFS or strongest-LQI fallback remains. A known next hop need not
prove the complete chain. Mapping/resolution are memoized outside hover.
The overlay's one-entry mapping memo (#906) compares registry material, not the
fresh `haRegistrySnapshot` wrapper: device/entity record identities, revision,
authority/access and freshness/error scalars, plus immutable marker/topology
collections, provider revision, connection and admin identity. Scalar metadata
is captured by value; revision0 limited registries still invalidate on changed
records. Post-render `updated` does not discard a result merely because the
wrapper changed; detach and provider/owner retirement clear the entry. No
deep hash, global cache, TTL or provider request is added to render.
`zigbee-topology-runtime.ts` keeps a per-connection, admin-identity-scoped cache:
ZHA still reads `zha/devices` without a scan. Z2M uses the integration-owned
`zigbee_topology.py` coordinator through admin-only
`houseplan/zigbee/{subscribe,start,cancel}` WebSocket commands (#800). The
coordinator reserves one job per normalized topic before starting background
work, checks retained bridge-info and sends one correlated raw `routes:true`
MQTT request. Closing all frontend clients releases their observers, not the job.
An initial reset and per-topic state events restore running jobs and last-good
maps; session/revision and job identifiers isolate stale replies and cancels.
Map payloads are limited to 2 MiB; at most eight topic slots are held. Only empty
terminal slots may be reclaimed; successful maps are never capacity-evicted.
MQTT is an optional dependency.

There is no overall scan deadline. Transport setup/publishing have 10-second
limits and retained bridge-info a 4-second limit. At 600 seconds an exact-job
cancel becomes available; it cancels HP's wait, not Z2M radio work. Matching
provider errors, invalid maps and MQTT disconnect terminate the job and release
listeners. #912 durably removes the old topic map before an accepted replacement
request, so errors/cancel cannot roll it back. Successful raw maps/original times
alone enter a dedicated entry-owned atomic HA Store; reload restores them stale
without MQTT. Jobs/session/elapsed timers stay volatile. A serialized cache lock
orders success writes, explicit refresh clear and all saved-config OFF writers;
late callbacks/writes cannot resurrect retired maps. OFF clear failure refuses
the config save, and new-result persistence failure is visible, not silently
reported as durable. Topic removal only hides routes. Neither reconnect nor
reopening settings republishes. Integration unload flushes accepted result writes
and clears runtime jobs, preserving only successful durable maps.
Before unload, a `closed` session event invalidates observers even when their HA
WebSocket stays connected; the next explicit scan reattaches to the new coordinator.
The frontend derives elapsed time from server elapsed plus local monotonic time,
without per-second map events or invented progress percentages. Mounted visible
settings alone tick their timer; ordinary hass updates do not resubscribe.
ZHA cache retrieval is never described as a fresh radio scan.
Settings diagnostics (#1005) use the pure `zigbee-topology-diagnostics.ts`
projection for both the short partial status and its native collapsed details.
It combines current normalized warnings, exact registry/placement outcomes and
resolved unknown-route reasons once per visible provider, deduplicating by
reason and provider-scoped node identity. Optional warning metadata preserves
bounded Z2M `failed` stage names and the three unmatched-device situations;
route evidence, partial rules, raw Store payloads and saved settings are unchanged.
Plain Lit text keeps provider labels inert. Each source footer belongs to its
current connection/admin identity; Z2M topics stay separately named, and a
failed ZHA refresh describes the retained snapshot separately from its error.
The pointer-transparent overlay is a child of the `.devlayer` camera, projected
once with the markers by `live-viewport.ts`; only the source and drawable
neighbour markers are promoted above it, through transient attributes the
overlay owns and clears. All routes are solid; `zigbee-topology-style.ts` owns
the independent RGB 0/red–128/yellow–255/green palette. Unknown-LQI links have
a black casing under a 2 px grey core and an outer arrow outline. The outline
is 1 px at zoom=1 and scales with the plan, including temporary camera CSS
projection, per the owner's #798 clarification. Local and remote/unplaced routes share one renderer.
Unknown/partial/stale captions never trigger network work; one expiry timer
updates age without requiring another HA event. The resolver's transient
`showIncomplete` distinguishes an unknown per-device uplink from global snapshot
`partial`: known uplinks and every matched coordinator suppress only that caption,
even if cross-provider reconciliation makes a coordinator's route unknown (#816).
Persistence and privacy:
[CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md).

Zigbee caption layout (#802) notifies the lazy live-hover runtime after the
overlay's DOM update and coalesced active-hover resize/scroll/camera changes.
Only the matching pointer device tooltip avoids actual text-caption rectangles
and its source marker, in screen coordinates inside stage∩viewport. A pure
candidate search finds the closest feasible full rectangle or hides the tooltip
until space returns. It does not move markers, start scans or render the card.
Keyboard tooltips retain their own path. Pointer departure/disconnect disposes
the active layout observer/frame; remote caption wrapping updates its short
arrow endpoint in the same post-render pass.

## Live viewport: a transform per frame, a `viewBox` on a budget (#531, #579)

Rewriting the SVG `viewBox` re-rasterises the whole scene, so per-frame writes
made panning crawl. `paintLiveViewport` keeps an anchor (the `viewBox` in the DOM
and when it was written) and moves scene nodes each frame with the HTML layers'
projective transform (`liveLayerProjection`, `transform-origin: 0 0`);
`needsViewBoxRefresh` rewrites the anchor only after `LIVE_VIEWBOX_REFRESH_MS`
(100 ms) or a `LIVE_VIEWBOX_REFRESH_SHIFT` (15 %) shift/scale change — module
constants, not settings. Scene nodes project from the anchor, HTML layers from
the last settled Lit frame; both land on the current view, keeping #451's
one-CSS-pixel marker contract on every frame. `.stage` stays the outer clip, but
a transformed scene SVG gets inline `overflow: visible` so rasterised content
covers the incoming edge, even with the pointer held still (#544); HTML layers
never do. The exposure is bounded by an inline `clip-path: inset(-25%)`
(`LIVE_SCENE_EXPOSURE_CLIP`) set and removed with it — beyond the 15 % refresh
threshold, but never the whole plan: unbounded, a promoted scene grew with
zoom² and at 800 % × DPR 2 exhausted GPU memory (white frames, #689). A scene
marked `data-hp-live-overflow="clip"` — the filtered day-cycle outline — is
projected but never exposed. From the first live paint to the terminal commit a scene SVG stays in
one compositor lifecycle: a refresh or Lit frame may replace its anchor but never
demote/re-promote it — HA Companion WebView shows that as a blank frame (#579).
The day-cycle paper outline joins these roots before the first camera move; the
static card uses its stage-sized form from the first frame (#582, Key decision 7).
Unchanged values are never rewritten, so idle frames stay byte-identical;
`commitHouseplanViewport` removes the transforms and forces the final `viewBox`.

The vacuum SVG is a passive exception inside a live HTML layer (#871):
`data-hp-live-inherited-scene="camera"` rebases only its bounded paint window
via `inheritedSceneClip`, around the same anchor and with the same exposure.
Its `viewBox` and camera transform are not written by this pass. Giving it
`data-hp-live-viewbox="camera"` as well would double-project the trail. This
layout preserves the device/hover/lock/Zigbee stacking context unchanged.

## English and Russian ship whole (#400)

`en` and `ru` are synchronous dictionaries in the initial chunk; `de` and `fr`
load lazily (`src/i18n/registry.ts`), editor-only strings included. At the
decision the 38 settings-help entries of #86 cost 2 654 B gzip (0.9 % of the
initial-View budget); splitting would need a second dictionary half, a runtime
merge, an extra request and a second source for the `en.json` key type (#391).
Budget planning assumes whole dictionaries; revisit only if editor text grows by
tens of kilobytes.

## Backend quality gates (#42)

`tests_backend/requirements.txt` is the single source of backend CI dependencies;
ruff, strict mypy, the `sys.modules` guard, the coverage baseline and the
`geometry_parity` job: [TESTING](TESTING.md) › Backend quality gates.
`const.ERROR_CODES` / `ERROR_CODE_FAMILIES` are THE stable error contract: every
emitted code is registered and localized (scanner test); `invalid_passage_fields`
and `invalid_partition_opening_jamb_margin` carry structured JSON details; the
frontend renders unknown codes localized, code first, raw messages to the console.

## Summary panel boundary (#437)

`settings.summary_panel` is the only shared persistence of this read-only overlay;
`prepare_ordinary_summary_candidate()` is the common backend boundary of
`config/set` and `plan/optimize` (full import bypasses it), and
`config/get.summary_panel_api`, never cached config, grants editing. Persistence
and local keys: [CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md) › Summary panel namespace.
`summary-panel.ts` owns defaults, stable ids, fit predicates and local-key
encoding; `summary-panel-picker.ts` a non-DOM `entity_id + friendly_name` index
reused across state changes; `summary-panel-runtime-loaded.ts` the lazy View
controller — a screen-space, non-SVG sibling of the camera layer outside content
bounds, with one minute-aligned timer and a lifecycle generation binding dialog,
draft, picker and async work to one route/user/permission/kiosk identity.
`summary-runtime-loader.ts` shares code, never state, and provides synchronous
warm `create()` before the first render ([#506](specs/506-startup-performance.md)).
Only `ViewRuntimeBoundary` owns per-host installation/retirement; the unused
legacy attachment/slot API is removed (#909). Factory/pending caches,
fingerprint validation and retry URLs stay on their existing paths.
`summary-panel-editor.ts` loads on the settings button; its revision-checked
shared write precedes the local show choice. #505 styles and the 190 ms phases
stay lazy and never move the camera; editors and the space card never load the
panel. Device totals need an authoritative registry snapshot and dedupe parent
device ids before visual filters; clean area unions canonical room floors per
space with that space's `cell_cm`.

## Private support boundary (#43, #942)

Help & feedback is rendered by the lazy editor runtime even in View; form state
is component memory only. Report controls appear only when
`config/get.support_api` equals `SUPPORT_API_VERSION` (1); release versions are
diagnostic. `houseplan/support/preview` (`may_write`, bounded capability enums,
dialog-scoped id) loads one coherent config/layout pair under the shared write
lock and passes disposable validated copies to `support_package.py`, a strict
projection boundary: a new allowlisted object with package-local pseudonyms and
canonical sorted JSON, never raw storage redacted afterwards. Bytes, SHA-256 and
expiry stay in `HouseplanData` memory, bound to user and draft for ten minutes;
preview, download and submit use those bytes; `preview/discard` (idempotent) or a
confirmed submit consumes the token. `houseplan/support/submit` re-validates text,
resolves only an owned live token and calls `support_transport.py`: one
compile-time HTTPS URL, no redirects, bounded timeouts and response size, stable
local failure codes that never reflect the response. The relay
(`scripts/support-relay/`) deploys separately and is excluded from the HACS
artifact. Content and retention: [SUPPORT-PRIVACY](SUPPORT-PRIVACY.md).

API 1 negotiates package versions independently: config/get advertises
`support_package_versions:[1,2]`; omitted `package_version` still requests the
frozen v1. V2 adds closed diagnostic schema 1, never a persisted model change.
The lazy browser collector reads accepted presentation/overlay decisions only
on opt-in. `support_preview.py` owns coherent capture, the HA-lifetime physical
build pool and final authorization; `support_snapshot.py` captures bounded,
read-authorized state/registry/recorder facts before yielding. Projection and
JSON run in the executor. Timeout/cancellation retain the physical lease until
completion (four globally, one per user/draft); a late result cannot publish.
`support_diagnostic_values.py` owns shared pseudonyms and contiguous samples;
`support_config_projection.py` and `support_diagnostics.py` project typed fields.
`support_wire_schema.py` is stdlib-only and copied byte-for-byte into the relay,
with actual validator/HTTP parity tests. Read ACLs are rechecked before preview
publication and submit. Client claims never overwrite server facts; mismatched
revisions are partial, not a fabricated current renderer snapshot.
Inventory, budgets and witnesses: [SUPPORT-DIAGNOSTICS](SUPPORT-DIAGNOSTICS.md).

## Mutation tooling boundaries (#558)

`scripts/mutation-gate.mjs` stays the stable CLI but is only an orchestrator and
compatibility export surface over `mutation-registry.mjs` (declarations),
`mutation-selection.mjs` (diff/guard-input selection), `mutation-evidence.mjs`
(witness fingerprints, caught ledger) and `mutation-execution.mjs` (worktree
runs); dependencies never point back to the CLI. Guard-input caching is
invocation-scoped (one resolver, one tracked-file snapshot); persisted success
exists only in the explicit caught-witness ledger. Usage: [TESTING](TESTING.md).

Static readiness (#854) is shared by the normal unit gate and CLI; preparation
policy is a leaf module shared with the nightly runner. Changed input identities
are read-only helpers; static success never writes caught proof. Development CI
keeps only a retired compatibility interface, while nightly explicitly opts in
to applying mutations. Two witnesses of removed development setup code retired
with that code; the nightly environment and outcome contracts are unchanged.

Nightly capacity (#899) uses twenty deterministic modulo partitions of the
unchanged registry, with the same hour-long interruption boundary. Evidence
still binds every shard to one immutable material/workflow/run attempt and
requires successful terminal outcomes before reuse. Ordinary witness repairs
and static declaration checks do not produce caught ledger entries.

Node-drag browser guards declare compilation of their `test-build/` model
fixtures before the browser oracle (#830). The existing runner still separates
setup from assertion evidence; a missing compiled module is never a caught
mutant. The cheap registry test checks all `.mjs` entry files for this readiness,
including browser smokes, rather than assuming that every smoke needs only a
bundle. Product code and nightly-only mutation execution policy are unchanged.

## LED strips: lazy boundaries (#780)

The shared stripe renderer gives the off core 0.7 stroke opacity (#1043).
A bounded SVG mask removes the dark body beneath that core, so it reveals the
actual plan background, including in 2.5D; the rim stays opaque. On/unavailable
appearance is unchanged on live, static and exported plans. No persisted
setting or resolution input is added.

The #863 smoke helper coordinates HA delivery and contemporaneous quality
observations in the browser after a native wheel. It changes no product timer
or renderer. The paired daycycle report is a separate test-only oracle over raw
RasterTask/phase/readiness/environment evidence; no sample is silently removed.

The #1066 daycycle observation is test-only: passive native pointer events,
attribute-only geometry snapshots in the existing two-rAF wait, MutationObserver
delivery records, a trace/page clock marker, LayerTree backend-node identities
and GPU/resource provenance. The offline analysis never changes the paired
measurement verdict. Missing historical telemetry and missing thread CPU clocks
stay unknown; elapsed raster durations and notification delivery times are not
relabelled as CPU time or frame boundaries.

`space.led_strips` belongs to the space; the link is one-way strip → marker
and the device model stays the only owner of state and services. Four modules:

| Module | Graph | Holds |
|---|---|---|
| `led-strip-gate.ts` | initial | which markers a space shows as a strip, the anchor, the page-wide loaders of both chunks |
| `led-strip-card.ts` | initial | delegation only: the Devices toolbar button, the device-dialog section, notes, the LED branch of the device history |
| `led-strip-runtime.ts` (+ `led-strip-geometry.ts`) | lazy `led` | frame, stripe, hit/focus, 2.5D, static card |
| `led-strip-field.ts` | lazy `led-field` | the linear field, loaded by the runtime only for an on strip in a Glow room |
| `led-strip-editor.ts` (+ `i18n/led`) | lazy `led-editor` | the Devices tool, tray, picker, representation switch, LED history commands |

A View without a displayed active strip, and the Devices editor without the
tool or an editable strip, load none of them. «Displayed» is decided before
`import()` (`ledVisible`): an active strip bound to a live device of the
space that is neither hidden nor HA-disabled — the stored marker is checked as
well as the built device list (r1 M4). Each chunk checks the entry
build fingerprint; a failed load is fail-dark for the strips only and retried
on the next explicit entry. Budgets: `LAZY_LED_GZIP_CEILING` and
`LAZY_LED_EDITOR_GZIP_CEILING` in `scripts/bundle-budget.mjs`.

## Outside-findings routing (#926)

Trusted Actions configuration selects only explicit issue IDs; prepare freezes a typed
identity/mode/deterministic path, bound to its output and artifact passport.
The actual Review prompt embeds prepare's server-side snapshot; an external
JSON copy is refreshed immediately before Review and is not the authority.
Integration independently
checks the trusted snapshot, exact companion set/hash/text, and publishes only
the derived reviews/findings path beside the report. Legacy in-flight results
can use only their old no-companion protocol. No arbitrary instructions, new
model capabilities, severity waivers or merge authority are introduced.
Publication normalizes line endings before sealing/writing and binds the exact
Git blob in the report before its machine anchors. SPEC delivery accounting
allows only that added same-issue/stage/round companion, expected header, blob,
size and publisher proof; it remains spec-only trace, not implementation or
release/close membership. The existing SPEC/index and foreign-path checks stay.

## Explicit local amend (#923)

`commit-amend.mjs` owns the narrow npm invocation, pins HEAD/parent/index and
launches Git with fixed `commit --amend --no-edit` arguments. The existing
provenance validator consumes its one-use local context only in staged-message
mode and selects the parent/empty-tree diff. It keeps the same message,
changelog, bundle and golden checks. Native Git's ambiguous hook metadata is
not guessed; ordinary staged commits and historical ranges remain separate.
This is a local workflow contract, not a new CI or author-identity authority.

## Review handoff provenance (#904)

Counter rebase equivalence (#1068) is a task-delta comparison across the old
and accepted new base. `status-counter-equivalence.mjs` validates four Tests
values against immutable Git blobs with bounded, no-lazy-fetch reads; it never
loads a task's generator. `review-task-delta.mjs` binds changed files to their
complete before/after blob identities, hunk positions and modes, normalizing
only those four validated values before the STATUS blob identities are computed.
An identical edit moved elsewhere is different; upstream edits to a task-touched
file conservatively require ordinary review. The sole structured case is the
canonical CI registry inventory: additions/removals are bound to their complete
job/protocol key and unique sorted path values, so a shifted array index is
harmless but moving a path to another job changes the delta. CI fingerprints
still include the raw inventory. The trusted publisher certifies a green report and its base/material,
body and delta identities in a durable artifact. Reentry authenticates that
artifact before retaining green. It requires final candidate Validate even
on fast-forward; ordinary proof consumers still invalidate changed inputs.

Review policy (#1063) separates independent code judgement from evidence
reuse: task and ship batch reviewers trace callers, state, side effects and
failure paths before comparing author explanations and tests. A valid proof
authenticates executed coverage, not semantic correctness or completeness.
Explicit Sonnet 5/high settings in all three model review workflows fix the
requested reviewer configuration without changing verdict publication authority.

`review-handoff.mjs` owns a bounded syntactic parser and edited-comment selector
shared by collection and format validation. API order and author identity are
not authority; updated timestamp and numeric id select one candidate, including
an incomplete one. The preflight v2 material identity adds that comment's
id/URL/timestamps and exact-text digest. Its canonical snapshot is carried by
the existing sealed prepare artifact and rechecked against fresh API reads at
the model boundary. Scalar material guards, verdict schema, permissions and
merge authority keep their existing owners.

The separate format check (#922) identifies an acceptance row by its first AC
token, so later cross-references cannot replace that row's number. It retains
the existing section, contiguous-number, evidence and track-limit checks; it
does not interpret or approve the meaning of an acceptance criterion.

## Read-only release transport (#921)

`release-gate.mjs` wraps its workflow, candidate-tree and proof-context GETs in
`read-only-fetch.mjs`. That boundary refuses request bodies and non-GET methods;
only EPIPE, ECONNRESET and UND_ERR_SOCKET transport failures get two bounded
retries. It returns HTTP responses unchanged, preserves the final transport
error, and does not interpret candidate evidence. Publication writes and other
consumers of `ci-proof.mjs` are not wrapped or retried by this policy.


Room settings (#946) use the shared settings shell in its single-section mode. The single fill select maps directly to the existing empty inherited value or own mode. Source pickers and optimistic save ownership are unchanged. The size sample uses independent Space bases and Room multipliers; sample values never enter persistence.


Device settings (#947) reuse shared settings sections/controls. Hardware-only `recognizeRadarBinding` owns new-tab eligibility; `recognizeRadar` retains saved-profile runtime compatibility. A transient Details entry exposes persisted legacy profiles without reintroducing manual declaration. Preview uses the canonical presentation at scale=1; an unscaled scrollable canvas contains long faces/rings. Radius input editing state is UI-only and does not materialize inherited defaults. Radar setup reserves instruction height so phase changes do not move the measured map.

## Selected browser progress (#983)

Task-push browser evidence (#983) has an explicit selected scope independent
of the complete CI-matrix receipt. Its plan follows a proven diff boundary,
source/capture inputs and declared scene links. All task tracks share the same
bounded selector (#1060): explicit links survive, weak lexical candidates are
deferred, and an oversized inferred union retains the visual minimum plus
authoritative checks. The complete matrix belongs to night/beta validation. A
selected worker cannot emit a reusable full receipt or satisfy full review/
release policy, and its actual job outcome must match proof metadata.

## CI path profiles (#980)

One generated path manifest binds GitHub ingress to computed test ownership.
The canonical full job recipe stays in `validate.yml`; generated product jobs
omit tooling, and the tooling/docs profiles omit product producers. Unknown
paths remain product-conservative. Push ranges use the event's complete two-dot
diff, preserving deletes and both sides of renames; unknown bases fail closed.

Consumers select the registered workflow family by exact path. Product proofs
require every companion profile in the candidate's coverage plan. Fast profile
proofs remain progress; missing product evidence never becomes green. The
existing main workflow_run trigger receives all profiles through their shared
display name, while its dev body checks actual workflow identity. Canonical full
dispatch remains the fallback and the night/release authority.


## Authenticated content proof index (#981)

The orphan ci-proofs index maps a job/content address to an immutable source
execution. Product identity excludes documentation/tooling/output domains;
job identity additionally covers exact test/harness inputs, transitive trust
code, actual tools/pins, the executing workflow recipe and performance set.
The source artifact and actual direct producer jobs authenticate every mutable
entry. Branch ancestry and commit SHA are provenance fields, not reuse keys.
A beta-only normalized identity masks synchronized canonical version scalars;
assembly and one real bundle smoke remain fresh. Night/stable deny reuse.
The v1 proof extension is additive: trusted old controllers can consume fresh
migration evidence, while new controllers also require actual fresh bundle/
product guards and independently authenticate every inherited source.

Scoped tooling/selected-browser receipts (#1060) use the same index with distinct
job addresses and `houseplan-task-check/v1` records. Their conservative identity
covers all non-documentation inputs, exact selected IDs/visual intent, actual
runtime and job recipe. A direct successful source attempt and its immutable
artifact must authenticate the record; a reused result cannot produce another
source. Current Git/range/process/packaging checks remain fresh. A selected
receipt never proves full-matrix coverage, and a controller without the scoped
validator forces fresh execution. Integration classification uses verified
green coverage separately from the judged range used by process guards.

Same-run retained jobs (#1067) preserve their original immutable execution
record and separate original/current-clone job identities. Independent source
artifact, Git inputs and exact authenticated job stamps/steps bind the clone;
overall run success is not evidence. Producer sealing can observe its own
in-progress proof job, while a consumer still requires the completed current
attempt. Retention neither creates a new registry producer nor waives a changed
full/fresh request or an originally reused execution.

Sparse registry lookup (#1062) hydrates missing immutable blobs in bounded
batches. Git reads disable implicit lazy fetch and share the probe deadline,
so an unavailable object or remote produces fresh execution rather than a
blocked lookup job. The independent policy and source checks remain mandatory.

Python-producing jobs (#1032) install the exact patch selected by the reuse
bootstrap, not an independently resolved minor from their runner cache. The
bootstrap exports its actual setup-python version even when the registry probe
falls back to fresh execution. Producer stamps still compare the actual Python
runtime with that plan. Node remains an actual-runtime stamp; a different Node
or Python stamp cannot mint a reusable record. No trust or proof schema changes.

Room-face persistence (#1061) separates canonical topology keys from incident
source coordinates inside `wall-face-graph.ts`. Source constraints belong to
atomization; ambiguous representatives cannot create a writable face. The room
writer still owns materialization, lineage and off-grid/physical non-growth.
The backend's existing Optimize validation separately proves the exact known
retained-carrier Align/storage result; it does not add a writer or bypass the
opening-host and full structural-removal validators.

Review execution policy (#1065) is prepared from accepted-dev tools outside
the material checkout. All three model entrypoints use the pinned direct native
launcher, explicit isolated settings and a positive tool catalogue. PreToolUse
validates a fixed `run_check(check_id)` or an external report Write; the manifest
owns executable/argv/env/cwd. Generic Bash/Edit/Agent and business MCP are absent;
arbitrary shell programs and
canonical implementation/guard/limit replacement are not review inputs.
The private journal stores tool IDs, policy-binding digests and decisions, with optional
bounded fixed-vocabulary diagnostic shape metadata (#1082). The SDK's
nonexecuting StructuredOutput channel is bound to the final structured result;
it does not gain a shell/file capability when its internal call has no hook.
Sealing requires a complete SDK result, a matching decision for executable tool calls, no
forbidden request, unchanged tracked material and a report/summary without the
known patch/run/restore-as-ordinary claim. Historical review files remain intact.
This is an accidental-action tool boundary, not OS isolation of reviewed child
programs or authentication against a hostile same-user process. It does not
turn static checks or denied requests into execution evidence or mutant caught.

Current startup/hook/audit use `sha256/hp-review-policy-v2` (#1086). Read, Grep,
Glob and builtin ToolSearch bind the exact tool name: their admission policy
does not depend on their arguments. This removes argument-normalization failures
from read-only authorization without treating those arguments as equal evidence.
All other tools bind the name and complete canonical JSON input, retaining
values/types/strings/arrays and signed zero; unsupported JSON values refuse.
Tool IDs, journal cardinality, decisions and results remain checked for every
call. Each discovered actual tool still passes its own guard independently.
Raw shape metadata remains order-sensitive diagnostic evidence, not admission.
The historical `sha256/hp-json-keys-v1` and native Grep alias algorithm (#1084)
remain only for diagnostics under their original semantics, never new admission.

Trusted context supplies complete bounded source discussions and Git/CI facts;
release review keeps its independent line scope. The model does not publish
outside its report. After valid audit/seal, the trusted publisher preserves
the configured issues/file route, uses stable finding IDs and completion
receipts, and never rewrites sealed report/verdict bytes. Pending or ambiguous
publication blocks forwarding/reuse; retry uses the same authenticated producer
rather than another model call. Retained producer attempts remain bound to the
same run/material and exact sealed manifest, never a cross-run waiver.

Failure diagnostics (#1082) are a separate trusted read-only projection of the
existing execution trace and private journal. A model/audit failure collects a
bounded fixed-schema certificate before success-only sealing; an always-run
failure uploader retains only that exact newly generated file for one day.
Tool IDs and unknown names/keys are pseudonymized, argv is represented only by
finite semantic categories, and payloads/credentials are never copied. Missing,
malformed and oversized evidence stays explicit. Metadata channels are observed
without gaining an admission exemption. The diagnostic has no verdict authority.
Legacy digest comparisons remain labelled and use their original wire algorithm;
new ToolSearch policy is never applied to old decisions. Unknown/mixed algorithms
have unavailable comparison, and bound old refusals are retained honestly.
