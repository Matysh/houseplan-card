# Changelog

## v1.46.4 — 2026-07-28 (data loss: detached plans were collected as garbage)
- **A plan you detach is no longer deleted an hour later.** Switching a space to
  "draw" clears the reference and, as the editor has always said, leaves the
  image on disk so you can put it back. The collection added in v1.46.0 did not
  make that distinction: it treated "nothing points at this right now" as
  abandoned and applied a one-hour rule. On the author's own instance the
  scheduled pass then removed two floor plans that had been detached weeks
  earlier, with no way to get them back. If you have detached a plan since
  v1.46.0 and your instance restarted or ran for a day, check
  `config/houseplan/plans/` before updating anything else — and please report it
  in the Telegram chat if a file is missing.
  The rule now: **a commit still removes exactly what it replaced**, because
  that it knows for certain. Everything else is only *unreferenced*, which is a
  reversible state — a file belonging to a space or a device that still exists
  is never collected, and anything else waits thirty days instead of an hour.
  The one unambiguous case keeps the short rule: a per-dialog staging folder
  only ever holds an upload from a dialog that was never saved.

## v1.46.3 — 2026-07-28 (re-check of v1.46.2: HP-1462-01)
- **The cleanup at startup now actually cleans up.** It looked its own runtime
  data up by domain, and during startup Home Assistant does not yet consider
  the integration loaded — so the lookup came back empty and the pass quietly
  degraded to removing half-finished transfers, leaving the real work to a timer
  24 hours away. Restart more often than that and it never ran at all. It uses
  the object it was given at startup now.
- **The test that was supposed to prove this was passing for the wrong
  reason.** It created the stray files *before* saving the configuration — and
  saving collects too, so everything was already gone by the time the restart
  happened. Rewritten to seed after the save, plus a second test that fires the
  scheduled timer on its own, and a third that runs a restart and a save at the
  same time and asserts the accepted configuration never points at a file the
  cleanup removed.

## v1.46.2 — 2026-07-28 (re-check of v1.46.1: HP-1461-01, -02)
- **A file nobody ended up using is now cleaned up even if nothing is ever
  saved again (HP-1461-01).** Collection is tied to a configuration write,
  which is right for what a write supersedes but leaves a gap: cancel a dialog
  after the file has already uploaded, lose the connection just after, or call
  the upload API directly, and nothing references the file and no future write
  notices it. The daily sweep added in v1.46.1 only removed half-finished
  transfers, so the promise that a cancelled attachment disappears after an hour
  did not hold on an instance nobody edits. The sweep now compares against the
  stored configuration — under the same lock a write uses — and collects aged
  unreferenced attachments and plans as well.
- **A drag is no longer undone by someone else's move (HP-1461-02).** When the
  full card learned to follow position changes in v1.46.1, it protected the
  positions you had moved but not yet sent — except it read that list *after*
  flushing the pending write, and flushing empties it first. In a real drag,
  where a write is already scheduled, the list was therefore empty and the
  server's older position was painted over your move. The card now takes the
  snapshot before flushing and also holds on to positions that are sent but not
  yet acknowledged: until the server confirms a position, the card that moved it
  is the authority on it.
- Two tests grew up to their docstrings: the upload test now actually cancels
  the request task instead of only exercising error paths, and the position-sync
  smoke schedules a real debounced write and delays it, which is the ordering
  that lost the drag.

## v1.46.1 — 2026-07-28 (re-check of v1.46.0: HP-1460-01 … -03)
- **Two uploads of the same file name can no longer collide (HP-1460-01).**
  v1.46.0 stopped overwriting attachments, but choosing a free name and taking
  it were two steps: two uploads racing between them agreed on the same name,
  both reported success, and one set of bytes replaced the other. The name is
  now claimed atomically as it is chosen — twenty simultaneous uploads of
  `manual.pdf` produce twenty files. The same helper is used when rebinding
  moves files, which had the same gap.
  Also fixed there: a name at the length limit lost its extension, and the
  collision suffix pushed it past the limit, so the attachment was stored under
  a name the server would not serve back — a permanent 404 on a file the UI
  reported as attached.
- **An interrupted upload no longer leaves a temporary file forever
  (HP-1460-02).** Cleanup ran in an `except Exception`, which a cancelled
  request walks straight past, and the collector only ever looks inside marker
  folders — so an aborted transfer left a `.upload-*` in place with nothing able
  to remove it. Every exit path now cleans up, a request carrying two files is
  refused outright, and abandoned temporaries are swept at startup and daily.
  Uploads also write in 1 MB batches instead of one disk task per 64 KB.
- **Two full cards side by side keep the same positions (HP-1460-03).** v1.46.0
  taught the static card to follow position changes and left the full one
  behind, so dragging an icon in one window did not move it in another until a
  reload. It follows now, without disturbing a drag of its own: a revision
  arriving mid-drag is merged rather than applied over the top, and a card does
  not re-read what it just wrote itself.

## v1.46.0 — 2026-07-28 (full external audit of v1.45.4: HP-1454-01 … -10)

**Security**

- **An uploaded SVG plan is no longer a live document of your Home Assistant
  origin (HP-1454-01, high — release blocker).** Inside the card a plan is
  referenced by `<image>`, where scripts never run; but the same url opened
  directly became a top-level document of HA's own origin, and a `<script>` in
  it could read the session's `localStorage` and call the API. Uploading needs
  write access, which by default every authenticated user has, and a signed url
  is easy to hand to an administrator. Plan responses for SVG now carry a
  `sandbox` Content-Security-Policy, which drops the document into an opaque
  origin. Only SVG gets it — a CSP on a PDF can break the browser's built-in
  viewer, and a raster image cannot execute anything. Nothing changes for
  existing plans: the card renders them exactly as before.

**Data integrity**

- **A manual attached to a device no longer overwrites the previous one
  (HP-1454-02).** The upload wrote straight to `<marker>/<filename>`, outside
  the configuration transaction: cancelling the dialog, or a rejected save, left
  the stored url serving the new bytes. And every new icon uploaded into one
  shared folder, so two of them attaching `manual.pdf` ended up pointing at the
  same physical file. Uploads now take a free name and never overwrite, a new
  icon gets its own staging folder whose files move to the real icon when the
  save is accepted, and an upload nobody saved is collected an hour later. The
  name a collision falls back to changed from `manual (2).pdf` to `manual-2.pdf`
  — the old one was sanitised on the way back in, so a renamed attachment was
  written and then never served (found by the new test, and it applied to
  rebind collisions before this release too).
- **Two quick edits can no longer lose the second one (HP-1454-03).** The
  debounce spaced out the starts of a save, not the saves themselves. If one
  took longer than half a second — a busy instance, a slow link — the next edit
  went out with the same revision, the server accepted the first and rejected
  the second, and the conflict handler reloaded the server copy over the local
  one. The edit was gone, with a message blaming another window when there was
  none. Writes are now serialized: one at a time, each carrying the revision the
  previous one returned.

**Correctness and limits**

- **Open boundaries follow the geometry again (HP-1454-04).** Their cache was
  keyed on room ids and links only, so changing a space's aspect ratio or
  dragging a vertex left the open boundaries — and the light spilling through
  them — at their old coordinates until a reload. The cache is now keyed on the
  rendered model itself, which is exactly what it is computed from.
- **The configuration can no longer be made arbitrarily heavy (HP-1454-05).**
  The outer collections were capped; the ones inside them were not. A polygon
  with 150 000 points, or a list of 100 000 device ids, validated fine and then
  made every render walk it. There are now limits on polygon vertices, open-to
  links, controls, attachments, text and url lengths, plus a cap on the whole
  serialized configuration. The obsolete `segments` field is dropped by the
  server instead of trusting the card to strip it.
- **Large files stream instead of being held in memory (HP-1454-06).** A 50 MB
  manual was read whole into memory on the way in and again on the way out; a
  couple of parallel downloads were real pressure on a small Home Assistant
  host. Uploads stream to a temporary file, downloads stream from disk.

**Consistency**

- **The static space card honours per-room fill settings (HP-1454-07).** It
  builds its model with a different function, and room settings were not carried
  into it, so a room you had set to "no fill" was still painted.
- **Moving an icon updates the static card immediately (HP-1454-08).** Layout is
  separate state with no revision and no event: a drag on the full card left a
  static card next to it showing the old position until the configuration
  changed or the page was reloaded. Layout writes now keep a revision, return
  it, and announce themselves — which also makes the optimistic locking on a
  wholesale layout write mean something, since a point-wise write used to reset
  the counter.
- **A repair warning about a missing plan disappears with its space
  (HP-1454-09).** The cleanup only looked at spaces that still exist, so
  deleting or renaming one left its warning in Repairs with nothing able to
  clear it.
- Build chain: `serialize-javascript` pinned past two advisories (HP-1454-10).
  Not reachable at runtime and production dependencies were already clean, but
  it is one line.

## v1.45.4 — 2026-07-28 (review of v1.45.3: R5-1, R5-2)
- **A partly successful signing answer no longer skips the backoff (R5-1).**
  The backend signs each path independently: one it cannot sign is logged,
  skipped, and the call still succeeds with the remaining urls. The card took
  any successful call as "the whole batch is done", cleared the backoff for
  every path in it, and then wrote only the urls that came back — so a path the
  backend kept skipping was requested again on every single render, which is
  exactly the amplification v1.45.2 added the backoff to prevent. A path is now
  counted as signed only if the answer actually carries a url for it; the rest
  back off individually, keys nobody asked for are ignored, and a re-render is
  only triggered when at least one new signature arrived.
- **The status snapshot no longer contradicts the repository (R5-2).** It still
  described `main` as carrying releases up to v1.40.1 and quoted test counts
  from several releases back, while the version line right beside them was kept
  current — a maintainer or an agent reading it for handoff got a wrong branch
  model and a smaller picture of the coverage than exists. The branch roles are
  described accurately, and the counts are gone: `npm run inventory` prints them
  from the tree, so there is nothing left to go stale.

## v1.45.3 — 2026-07-27
- **"Value instead of an icon" could not be saved (issue #3).** The option was
  added to the device editor in v1.26.0, but the server-side schema only ever
  accepted `badge`, `ripple` and `icon_ripple`. Choosing it produced
  `not a valid value for dictionary value @ data['config']['markers'][n]['display']`
  — and because a single rejected marker fails the whole configuration write,
  the plan could not be saved at all until the setting was undone. Thanks to
  @RemyRoux for the report and the exact error text.
- **The option lists now live in one place and are checked across languages.**
  `DISPLAY_MODES`, `TAP_ACTIONS`, `SPACE_FILL_MODES` and `ROOM_FILL_MODES` are
  exported from the card and read by a backend test that asserts the schema
  accepts every value a user can actually pick. Adding an option to an editor
  and forgetting the schema now fails the test suite instead of surfacing
  through somebody's error message.

## v1.45.2 — 2026-07-27 (hardening from the v1.45.1 review: R4-1, R4-2)
- **A failed cleanup no longer reports an accepted save as an error (R4-1).**
  Collecting superseded plan files runs after the configuration is already
  stored, but an error while listing the directory — it can vanish or turn
  unreadable between the check and the walk — propagated out of `config/set`.
  The client then saw a failure for a revision the server had committed, and its
  retry came back as a conflict. The collector now reports "nothing collected"
  instead of raising, and `config/set` logs and proceeds: the event fires and
  the new revision is returned.
- **One signing request per url instead of one per render (R4-2).** The pending
  set was cleared when the batch went out rather than when it came back, so
  while a `content/sign` call was in flight every re-render queued another one —
  six calls where one was needed, and far worse on a socket that is slow rather
  than merely busy. Queued and in-flight are now separate states, a failure
  backs off (2 s doubling to 60 s) instead of retrying on the next frame, and a
  request that never settles stops blocking retries after 15 s. A late answer
  arriving after the card was torn down no longer triggers a render.
- Tests: eight unit tests for the signer with hand-settled promises (four fail
  on v1.45.1), a backend test asserting a broken collector still yields a
  successful save with a usable revision, and the pure-collector test extended
  to a disappearing directory.

## v1.45.1 — 2026-07-27 (follow-up review of v1.45.0: R3-1, R3-2)
- **Collecting old plan files moved into the config transaction (R3-1, high).**
  v1.45.0 made the upload safe but handed the deletion to the client: after a
  successful save the card asked the backend to remove everything except the
  file it had just committed. Two open editors could not be ordered — a delayed
  request from one client deleted the plan the other had just saved, and the
  accepted configuration was left pointing at nothing, which is the exact damage
  copy-on-write was added to prevent. The `houseplan/plan/cleanup` command is
  gone. `config/set` now collects inside its own write lock, comparing the
  configuration it replaced with the one it accepted: a file the old revision
  referenced and the new one does not is removed, and any other unreferenced
  upload is left alone until it is an hour old, because a fresh one may belong
  to a transaction that has not committed yet.
- **The static space card shows its plan background again (R3-2).** It signed
  the url and then threw the result away — `getCardSize()` mutated a throwaway
  model while `render()` rebuilt its own from the config — so the `<image>` kept
  requesting the protected path and got a 401 on every render. Both cards now
  share one signer, which also gives the static card the batching, the
  expiry handling and the periodic re-signing the main card already had. Its
  pending set is released in `finally`, so a single failed request no longer
  wedges a url for the life of the page.
- New tests: five backend cases for the two-client interleavings from the report
  (late commit, uncommitted upload, aged orphan, foreign files, rejected save),
  the collector extracted to a pure module and unit-tested, and
  `smoke_space_card_bg` for the signed background — it fails on v1.45.0 with the
  raw url in the DOM.

## v1.45.0 — 2026-07-27 (external review of v1.44.8: R2-1, R2-2, R2-3)
- **A rejected save can no longer damage a working plan (R2-1, high).** The
  plan file was written to its final name — deleting the previous extension on
  the way — *before* the revision-checked config write. If that write was then
  rejected (revision conflict, validation, lost connection), the live plan had
  already been replaced, or the stored config was left pointing at a file that
  no longer existed. Uploads now go to a versioned name
  (`<space>.<token>.<ext>`) and nothing is deleted; the card asks the backend to
  drop the superseded files only after the config write is accepted. A crash in
  between leaves one orphan, which the next successful upload collects.
- **Signed urls no longer expire for good on long-lived screens (R2-2).** The
  backend signs at most 200 paths per request and silently ignores the rest,
  while the card sent its whole cache in one call and treated any cached entry
  as valid forever. Past 200 attachments the later ones stopped being refreshed
  and, 24 hours in, quietly broke. Requests are now batched to the shared limit,
  entries carry their age (aging urls keep working while a replacement is
  fetched, expired ones are never served), and the cache is pruned to the urls
  the current config still references.
- **Room climate is computed once per update instead of once per room (R2-3).**
  Each room asked for temperature and humidity separately, and every ask
  rescanned the entire entity registry: with 60 rooms and 2000 entities that is
  ~120 traversals per render, enough to spend a whole frame on metadata that had
  not changed. One pass now builds a map for all areas, keyed on the Home
  Assistant snapshot, so fresh states are always observed while unrelated
  re-renders cost nothing. Measured in the smoke: 133 registry scans per update
  before, 2 after — and no longer growing with the number of rooms.
- `smoke_ux_fixes` wrote its screenshot to a hard-coded `/tmp` path and could
  not run on Windows; it uses the OS temp directory now.
- New tests: `smoke_plan_upload_reject` (cleanup happens only after an accepted
  save), `smoke_sign_cap` (201 urls, batching, pruning, expiry),
  `smoke_climate_once` (scan count does not grow with rooms), plus backend
  coverage for the versioned plan names and unit tests for the new helpers.

## v1.44.8 — 2026-07-27
- **An uploaded plan is actually attached to the space.** `_saveSpaceDialog`
  held a reference to the space object across the `await` that uploads the
  image. Every `houseplan_config_updated` event runs `_reloadConfigOnly()`,
  which *replaces* `_serverCfg` — so the reference became an orphan and
  `plan_url`, `aspect`, the title and all display settings were written into a
  detached object while the save shipped the untouched config. The file landed
  on disk, the plan never appeared, and re-saving could not help. Creating a
  space in that window lost the space entirely.
  The upload now happens *before* the config is touched, and nothing is held
  across an await.
- **`_saveConfigNow` marks the write in flight** (`_cfgWriting`), like the
  debounced writer already did, so a remote revision arriving mid-save defers
  its reload instead of replacing the config underneath it (audit L2 extended
  to this path).
- Regression test `demo/smoke_plan_upload_race.mjs` fails on v1.44.7 and passes
  here.

## v1.44.7 — 2026-07-27
- **Plan backgrounds are visible again (regression from v1.44.5).** Since the
  content endpoint requires authentication, the card asks the backend to sign
  the plan's url — but the signing happened inside the *memoized* space model,
  which is cached on the config fingerprint. The unsigned url froze in that
  cache, so the signature never reached the `<image>` element and the plan never
  loaded. The url is now resolved at render time, outside the cache. (PDF links
  were unaffected — they already resolved at render time.)
- **No more "failed login attempt" from your own IP.** While the plan was
  broken the browser kept requesting the unsigned path, which returns 401 and
  makes Home Assistant raise a login-attempt warning for the viewer's own
  address. The card now renders nothing until the signature is in hand, so an
  unsigned request is never made.
- **Long-lived screens no longer blink.** The 12-hour re-signing used to drop
  every signature and wait for new ones; it now keeps the current urls until the
  replacements arrive, so a wall tablet never shows an empty plan.
- Regression test `demo/smoke_plan_signed.mjs` fails on v1.44.6 and passes here.

## v1.44.6 — 2026-07-27
- **Only room *air* counts as room climate.** After v1.44.5 started reading the
  area registry instead of the visible icons, every hidden temperature entity in
  the area became a candidate — including ones that measure something other than
  the air. Three guards now run before averaging: entities marked
  diagnostic/config are skipped, entities from curated-out integrations are
  skipped, and entity ids naming a non-air medium are skipped
  (`water`, `coolant`, `flow_temp`, `return_temp`, `target`, `setpoint`, `chip`,
  `cpu`, `processor`, `board`, `device_temp`, `batter`, `freezer`, `fridge`,
  `oven`, `kettle`, `boiler`).
  On a live 60-area install this removed four real false positives: a NAS
  processor temperature, the water in a smart kettle, a 90 °C sauna heater and a
  virtual `better_thermostat` duplicating the real sensor.
- **New icon rules:** kettles/thermopots get `mdi:kettle`, saunas
  (`sauna`, `harvia`, `парная`) get `mdi:hot-tub` — previously both fell through
  to the generic thermometer rule, which is also what made them count as room
  climate.

## v1.44.5 — 2026-07-27
- **Room climate now counts every sensor in the area**, including devices that
  are not placed on the plan (hidden by curation or by you). Previously the
  average was taken over the visible icons only, so hiding a thermometer
  silently removed it from the room card, the tooltip and the temperature fill.
  Curation still applies (fridges, TRVs and chip-temperature plugs stay out),
  and an explicit per-room source still wins.
- The room tooltip no longer says "open the area" — clicking a room stopped
  navigating in v1.40.1; the link icon on the room card does that.


## v1.44.4 — 2026-07-27 (audit follow-up: B2, B5, L4)
- **One authorization policy (B2).** The HTTP upload view still failed **open**
  when the config entry was unavailable while the WebSocket path failed closed —
  the two had drifted apart. Both now call the same `may_write` helper, which
  denies non-admins whenever the policy cannot be read.
- **NaN/Infinity refused on every coordinate (B5).** The finite-number check
  guarded only layout positions; room rects, polygon vertices, `view_box` and
  opening coordinates accepted `"NaN"`, which serializes to `null` and corrupts
  the stored geometry permanently. The `MAX_OPENINGS` cap was defined but never
  wired in — the openings list was unbounded.
- **Drag hardening (L4 sub-item).** The tolerant `setPointerCapture` wrapper is
  now used by every drag pipeline (device, label, resize), not just openings —
  an inactive pointer id could kill a drag outright. Decor shapes gained a
  bounds clamp: they can no longer be dragged far outside the plan and saved
  there.

## v1.44.3 — 2026-07-27 (fix: plans and manuals load again)
- **The authenticated content endpoint had no working browser path.** v1.43.0
  closed the security hole correctly, but Home Assistant authenticates HTTP
  requests by a Bearer header or an `authSig` signed path — and an SVG
  `<image href>` or a plain `<a href>` sends neither. Plan backgrounds and PDF
  links returned **401** on a real dashboard (reproduced live before the fix).
  The card now asks the backend to sign what it displays
  (`houseplan/content/sign`, 24 h, bound to the session's refresh token, only
  for our own endpoint), re-renders when signatures arrive, and refreshes them
  every 12 hours so wall tablets keep working. A backend test fetches a signed
  url **without** an Authorization header and asserts 200, and 401 without the
  signature.


> 🇷🇺 Русская версия: [CHANGELOG.ru.md](CHANGELOG.ru.md) (записи с v1.42.0).

## v1.44.2 — 2026-07-27 (external code review: CR-1…CR-3)

A second, adversarial review (of v1.44.0) produced three findings; all are
addressed.

- **The lock invariant is now precise and enforced (CR-1).** The reviewer was
  right that "locks can never be actuated from the plan" was too absolute a
  claim: the door card's Unlock button does call the service. That button is a
  deliberate product decision, so the invariant is restated where it belongs
  ("never by an accidental tap; exactly one labeled surface"), unlocking now
  **asks for confirmation**, and a new smoke exercises all five actuation paths
  to prove icons, `controls[]` and the device card still refuse locks outright.
- **Attachment migration became transactional (CR-2).** Rebinding a marker used
  to MOVE its files before the revision-checked config save — if that save was
  rejected, the stored config kept the old urls while the files had already
  left. Now the server **copies**, the config is committed, and only then the
  old folder is removed (`houseplan/files/cleanup`).
- **Failed or partial migrations no longer rewrite urls (CR-3).** The copy
  reports an exact `{source: written}` mapping; only confirmed copies are
  rewritten, name collisions get a unique name instead of silently linking a
  pre-existing file, and a failed migration surfaces as a toast with the links
  left pointing at the still-existing originals.

## v1.44.1 — 2026-07-27
- Added the community chat everywhere users look: **https://t.me/ha_houseplan**
  (badge and header line in both READMEs, a "Getting help" section, the issue
  template contact links, CONTRIBUTING, STATUS and SCOPE).

## v1.44.0 — 2026-07-27 (user feedback: control first)

- **The device card is now a control surface.** It opens with the device's
  controllable entities: lights, switches and fans toggle straight from the
  card with finger-sized buttons, covers/locks/climate open Home Assistant's
  own more-info. Model, links and PDF manuals moved below — on a wall tablet
  this card is for running the home, not for reading documentation (field
  report). Config and diagnostic entities are not listed; locks still never
  toggle from a card tap.
- **"This device is a light source"** — a new per-device flag. A smart switch
  driving ordinary (dumb) fixtures now casts a glow in the "Light sources"
  fill without inventing a light-group helper: the glow follows the switch, or
  the lights bound under "Controls light sources" when they are set.

## v1.43.3 — 2026-07-27 (user feedback: discoverability and touch)

- **Room settings were unfindable.** The gear added in v1.42.0 lived inside the
  room label at 0.9em of its font and 60% opacity — a few pale pixels on a
  normal plan. It is now a pill button "⚙ Room" of a fixed, readable size that
  does not shrink with the card font, and it appears on **unnamed rooms too**
  (that is where you name them). This also unblocks the font-size sliders,
  which nobody could reach.
- **Metrics line enlarged** from 0.62 to 0.75 of the room name — the reporter
  could scale the name but the sensor line stayed unreadable on a tablet. The
  per-room and per-space multipliers still apply on top.
- **Touch tooltips, take two.** The `(hover: none)` guard was not enough: some
  devices, skins, styluses and paired mice report `hover: hover`, so tips still
  stuck under the finger. The card now also latches on the first touch/pen
  pointer event and drops any open tooltip on touch.

## v1.43.2 — 2026-07-27 (external audit: the test layer)

- **The smoke suite can finally fail (T1).** All 48 headless-browser smokes used
  to print booleans and exit 0 — a regression was visible in their own output
  and still reported success. `demo/serve.mjs` now exports `check`/`checkAll`/
  `finish`: every fact is asserted by name, mismatches and uncaught exceptions
  inside the card set a non-zero exit code. Verified by deliberately breaking
  the kiosk editor guard: the matching smoke went red.
- **The suite runs in CI (T2)** as a `smoke` job gated on `frontend`, against a
  freshly built bundle (the committed `demo/srv/assets` copy is a snapshot and
  would have tested stale code), uploading per-file logs on failure.
- **`docs/TESTING.md` reconciled (T3).** `[auto]` now means "a named check
  exists that fails when this breaks", and each such line names it; 72 lines
  whose automation was aspirational are honestly marked `[manual]`. Two
  long-standing contradictions fixed: the "ZERO edit buttons in View" line
  (wrong since v1.30.1) and the opening-click line (true again since v1.43.1).
- Three smokes carried expectations that predate v1.39.0/v1.25 and quietly
  described old behaviour; they now test the current contract.

## v1.43.1 — 2026-07-27 (external audit: P1 fixes)

- **Render cost (L1).** Home Assistant replaces `hass` on every state change in
  the home, and each of those renders recomputed the whole plan geometry —
  `_openPairs()` ran once per room (O(rooms³) collinear-overlap math) and the
  space model was rebuilt twice. Both are now memoized on the config's
  structural fingerprint and hoisted out of the per-room loop; cache
  invalidation happens synchronously at mutation time, not inside the debounce.
- **Opening tap vs drag (L4).** Dragging a door/window had no movement
  threshold, so any pointer jitter counted as a drag: the properties dialog
  never opened and an unchanged config was written (which then fed the L2 race).
  Now the same 3 px threshold as every other drag pipeline, and the write only
  happens when the geometry actually changed.
- **Concave rooms (G2).** Containment used the arithmetic mean of the vertices
  as an "interior point" — which lies OUTSIDE U- and L-shaped rooms, so island
  rooms in them were rejected as overlaps and their holes never rendered. A
  real interior point is computed instead (`interiorPoint`).
- **Wall dedup (G3).** `segKey` ordered endpoints by raw floats but printed
  rounded ones, so one shared wall could produce two keys and be drawn twice.
  Rounds first, then orders.
- **Backend hardening (B2–B5).** The write-authorization check now fails
  **closed** when the config entry is unavailable (it used to allow writes
  during a reload); `layout/set` supports `expected_rev` and conflicts like the
  config store; a `config/set` without `expected_rev` over a non-empty store
  logs a warning; coordinates reject NaN/Infinity, and spaces/rooms/markers/
  decor/layout have generous size caps.

## v1.43.0 — 2026-07-27 (external audit: P0 fixes)

An external code audit of v1.41.1 found four critical issues. All four are fixed
and covered by regression tests.

- **Silent data loss on save (L2).** A debounced config write read the config at
  fire time, so a `houseplan_config_updated` event arriving in between replaced
  it and the user's edit vanished with no error — reproducible in a single tab.
  The debounce now supports `flush()`/`pending()`, a reload flushes the pending
  write first and defers while a write is in flight, and a failed reload finally
  reports instead of staying silent.
- **Split corrupted room geometry (G1).** A cut starting and ending on the SAME
  wall (carving a niche — a natural action) produced two overlapping,
  self-intersecting rooms whose areas summed to twice the original, and the
  overlap guard did not catch it. Same-edge cuts now carve the niche correctly,
  and a partition invariant (parts must sum to the original) rejects anything
  else.
- **Plans and uploaded files were served without authentication (B1).** Anyone
  who could reach the HA endpoint could fetch floor plans and attached manuals
  without logging in. They are now served by an authenticated view; stored
  legacy URLs are rewritten on read, so nothing breaks. **The old public paths
  disappear after a Home Assistant restart.**
- **Dialogs could resurrect and blank the card (L3).** Closing a dialog while
  its save was in flight, on a failed save, spread `null` into a truthy husk;
  the renderer then threw and the card went blank until reload. Guarded in all
  four save routines; the error toast still fires.

## v1.42.2 — 2026-07-26
- Touch devices no longer pop hover tooltips on every tap (field feedback:
  "extra labels appear and get in the way on a tablet"). Hover tooltips are
  desktop-only now; on touch the same data lives in room cards and the
  long-press device card.

## v1.42.1 — 2026-07-26 (room-card font sizes)
- Closing the "can't change the font size" feedback: **three sliders**.
  Space settings gained a base room-card font size for the whole space;
  Room settings gained independent sizes for the room NAME and the METRICS
  line (50–300% each). Effects multiply — and stack with the card's corner
  resize and the kiosk per-screen multiplier as before.
- Both dialogs show a **live sample card** that follows the sliders as you
  drag them.

## v1.42.0 — 2026-07-26 (room settings — the third tier)
- **Settings now have four tiers**: global → space → room → device; the more
  specific tier overrides the more general one (owner's principle, fixed in
  ARCHITECTURE). This release adds the ROOM tier.
- Every room card in the Plan editor gained a **gear**: rename the room,
  change its HA area, override the **fill type** for this room only (works
  in glow spaces too — 'none' pulls the room out of the darkness), and pick
  an explicit **temperature / humidity source** — any HA device or entity —
  instead of the default room average. The source feeds the room card, the
  tooltip and the temperature fill, and works for rooms without an HA area
  (the user-feedback case: a custom template sensor bound to a room).
- The same settings section appears in the room dialog right after closing a
  contour.

## v1.41.2 — 2026-07-26
- Fixed attached PDF manuals breaking after a marker is rebound to another
  device: the id changes, but the uploaded files stayed in the OLD id's
  folder — orphaned and eventually lost (that is exactly how the sauna
  heater's manuals died). Rebinding now moves the files server-side
  (`houseplan/files/migrate`) and rewrites the attached urls.

## v1.41.1 — 2026-07-24 (docs)
- README (en/ru) reworked for discoverability: keyword-rich hero ("interactive
  floor plan card for Home Assistant"), badges, a feature-highlights list
  covering glow, controls, kiosk, virtual walls and room cards; the kiosk
  recipe moved next to Installation. Demo GIF slot ready for the new capture.

## v1.41.0 — 2026-07-24 (kiosk mode for wall devices)
- New card option **`kiosk: true`** (also in the GUI editor): the full View
  experience — live states, glow, lamp taps, info cards, locks — with no
  header and no editors at all, sized for a wall tablet or TV.
- **Swipe** left/right switches spaces at 1:1 zoom (wrap-around, dots
  indicator); while zoomed the gesture pans as usual; **double tap** resets
  zoom. **`cycle: N`** auto-advances spaces every N seconds (pauses for a
  minute after any touch) — for TVs and against OLED burn-in.
- **Per-screen sizes**: long-press an empty spot (3 s) to open a popover with
  icon and room-card-font multipliers, stored in this device's localStorage —
  every tablet/TV tunes itself once.
- Recipe for a full-screen wall dashboard (panel view + kiosk-mode/companion
  settings) added to the README.

## v1.40.2 — 2026-07-24
- Default icon rules: smart speakers (Yandex/Alice stations, «колонка»,
  generic speakers) now get **mdi:speaker**; mdi:soundbar stays for actual
  soundbars. Applies where the icon rules haven't been customized.

## v1.40.1 — 2026-07-23
- Rooms are no longer clickable in View (default cursor, empty space does
  nothing). Instead the room card shows a small **open-in-new icon** after
  the name — clicking it opens the HA area. Rooms without an area (and all
  editors) have no icon.

## v1.40.0 — 2026-07-23 (smart guides)
- **Alignment helper in every editor**: while drawing an outline, a cut or a
  decor shape, and while dragging icons, room cards or decor, thin dashed
  guides appear from the nearest object sharing your X and/or Y (one per
  axis, with a marker dot at the source) — lamps line up, lines end exactly
  above the end of a parallel line. Candidates follow the context: room
  vertices and path points in the Plan editor, other icons in the Device
  editor, decor endpoints/corners plus room vertices in the Background
  editor, other room cards while dragging one.
- The cursor badge now shows **length · angle** and turns green when the
  segment's angle is a multiple of 45°. Guides are pure indication — the
  grid keeps owning the actual position.

## v1.39.0 — 2026-07-23 (lights toggle by default)
- Pure light sources — devices whose primary entity is a `light` (bulbs,
  chandeliers, night lights, light groups) — now **toggle on click by
  default**, right from auto-placement, no per-device setting needed.
  Devices where light is a side function (a kettle's backlight: its primary
  is a sensor) keep the Device-card default. An explicit per-device choice
  always wins. The device dialog shows the effective default.

## v1.38.4 — 2026-07-23
- Plan editor: the DERIVED wall segments (the markup layer's solid lines)
  are now trimmed under open boundaries as well — v1.38.3 only trimmed the
  room outlines, so the virtual wall still looked solid in the editor.
  (`cutSegments` extracted as the shared workhorse; outlineWithout reuses it.)

## v1.38.3 — 2026-07-23
- The Plan editor now shows open boundaries as a true dash as well: the blue
  markup outlines are trimmed under the open stretches (rooms picked for
  merge/split keep their full amber highlight).

## v1.38.2 — 2026-07-23
- The card now **remembers where you were**: the selected space and the active
  editor survive navigation and closing the tab (localStorage; edit modes are
  restored for admins only). A `#space=` deep link still wins over the saved
  space. This reverses the earlier "always start in View" rule — the owner's
  call.

## v1.38.1 — 2026-07-23 (tap action cleanup, right-click more-info)
- The per-device action is now one of three: **Device card** (renamed from
  "Info card", the default), HA more-info, Toggle. The confusing "As the card
  default" option is gone — along with the card editor's global tap setting
  (it is ignored if present in old configs). Explicit per-device choices are
  untouched. RU wording: «по нажатию» instead of «по тапу».
- **Right click** on a device icon in View mode always opens HA's more-info
  dialog (editors keep the native browser menu; a virtual marker without an
  entity opens its device card).

## v1.38.0 — 2026-07-23 (binding section redesign)
- The device dialog's binding section is compact now: two radio buttons —
  **Virtual device** and **Pick from the HA list** — with a **Show entities**
  checkbox (adds every entity of the devices to the list; groups and helpers
  are always listed). The searchable dropdown appears only in HA mode and
  collapses once you pick. Save is disabled until a binding is chosen.
  The binding logic itself is unchanged.

## v1.37.3 — 2026-07-23
- Open boundaries now render as a **true dash**: the rooms' solid outlines are
  trimmed under the open stretch (outlineWithout) instead of dashes being
  painted over a solid line, and the dashed layer moved **above the glow
  pools** so light never covers it.

## v1.37.2 — 2026-07-23
- Glow falloff tuned: full brightness for the inner 70% of the radius,
  gradient on the outer 30% (was 80/20).

## v1.37.1 — 2026-07-23
- Open-boundary tool polish: the cursor stays default and only turns into a
  pointer near a wall shared by two rooms; hovering previews the exact
  stretch that would become open (amber dashed) — or red solid when the
  boundary is already open and the click would close it.

## v1.37.0 — 2026-07-23 (open boundaries — virtual walls)
- Rooms divided only by zoning can now share an **open boundary**: the new
  "Open boundary" tool in the Plan editor toggles it with a click on the wall
  two rooms share. The stretch renders dashed; while the tool is active open
  boundaries highlight amber. Stored as `room.open_to` links by room id, so
  redrawing/merging neighbours doesn't break them.
- In the light-sources fill, light flows through open boundaries freely —
  transitively across the whole connected zone (kitchen ↔ living ↔ hall as
  one open space), still limited by the glow radius. Door sectors now work
  from any outer wall of the zone.

## v1.36.4 — 2026-07-23
- Glow: sharper light edge — the pool is fully lit for the inner 80% of the
  radius, the gradient falloff lives only in the outer 20%.

## v1.36.3 — 2026-07-23
- Glow: fixed dark wedges appearing INSIDE a lit room near some doorways.
  The room outline and the door sectors were subpaths of a single clip path;
  with opposite winding directions the nonzero fill rule cancelled their
  overlap. Each contour is now its own clipPath child (children always
  union), so sectors only ever ADD light.

## v1.36.2 — 2026-07-23
- **Glow radius is now per source**: every device dialog gained a "Glow
  radius" field (in your HA units; empty = the global default from general
  settings, shown as the placeholder). A kettle's night light can glow half
  a meter while the ceiling lamp floods the room. Door sectors use the same
  per-source radius.

## v1.36.1 — 2026-07-23
- Fixed tap-toggle "doing nothing" on lamps whose individual `light.*` entity
  is **hidden in the registry** (the usual setup when lamps are folded into a
  light group): the primary entity fell through to a visible config switch
  (do-not-disturb) or an identify button, and the click toggled THAT.
  Primary selection now works in tiers — domain priority beats hiddenness,
  so a hidden light still wins over a visible config switch, while visible
  entities of the same domain keep winning over hidden ones.

## v1.36.0 — 2026-07-23 (wall switches that really switch)
- Markers gained **"Controls light sources"**: bind any set of `light.*` /
  `switch.*` entities to an icon. With tap action **Toggle**, a click flips
  them all with HA-group semantics — any on → all off, all off → all on — in
  one service call. Covers stateless remotes, one-switch-many-lights and
  dumb wall switches (place a virtual marker; no HA entity needed).
- The icon mirrors its targets: on when any target is on, tinted by the first
  lit RGB light. The info card lists every target with its state. Controls
  fire only on the explicit per-marker Toggle (owner's decision); locks and
  other domains can never be group-controlled.

## v1.35.0 — 2026-07-23 (glow fill: dark house, glowing lamps)
- New fill mode **"Light sources"**: the whole house is painted with a single
  configurable darkness color, and every lit lamp casts a radial pool of light
  around itself. The pool color comes from the lamp's `rgb_color`, else its
  color temperature (blackbody conversion), else a configurable default;
  brightness scales the intensity.
- Pools are clipped by the source's room — **plus the sector through each
  doorway** (rays from the source to the door edges, out to the glow radius),
  so light spills into neighbouring rooms through doors. Entrance doors (no
  room behind) spill nothing; windows don't spill. No shadow casting: islands
  and furniture do not block light (deliberate limitation).
- The glow radius is configured in General settings in your HA unit system
  (meters or feet; stored in cm, default 3 m). The palette gained a "glow"
  group: house darkness + default light color/intensity.

## v1.34.0 — 2026-07-22 (island rooms)
- **Nested rooms are now legal**: draw a contour fully inside an existing room
  (or around one) — a column in a ring-shaped room, an inner room, a wardrobe
  island. The parent room's fill is rendered with an evenodd hole, so a ring
  paints as a ring; the island itself stays clickable and can carry its own
  area, fill and devices. Partial overlaps and duplicate outlines are still
  rejected (`roomsOverlap` reworked; `polyContainsPoly`/`islandsOf` helpers,
  unit-tested). The per-click "point inside a room" rejection is gone —
  validation happens once, when the outline closes.

## v1.33.5 — 2026-07-22
- Editor tabs got extended tooltips explaining what each editor is for (plan
  geometry vs device icons vs visual decor).

## v1.33.4 — 2026-07-22
- Editing a device no longer makes its icon jump. Changing the HA binding
  (which changes the marker id) migrates the saved position to the new id;
  changing the room within the same space keeps the icon exactly where it
  stands (previously it re-centered in the new room). Only a brand-new icon,
  or a move to a room in a different space, is centered.

## v1.33.3 — 2026-07-22
- Device dialog: when no icon is set explicitly, the icon picker no longer
  looks empty — it shows the **auto-derived icon** (from the icon rules /
  device class) as a placeholder, with an "Auto: mdi:…" hint line underneath.
  Picking an explicit icon replaces it as before; clearing returns to auto.

## v1.33.2 — 2026-07-22
- Removed the **Reset** button from the Device editor. It wiped the entire
  layout — positions of all devices, room cards and their scales across every
  space — behind a single confirm. Low value, high blast radius.

## v1.33.1 — 2026-07-22
- The dot grid is now shown in **every editor** (Plan, Devices, Background),
  not just Plan — an instant visual cue that you are editing.
- In the Background editor, rooms, devices, openings and labels fade to 35%
  opacity so the decor you are drawing stands out; decor itself stays fully
  opaque. Other modes are unaffected.

## v1.33.0 — 2026-07-22 (background editor)
- New third mode: **Background editor**. Draw purely visual decor on the plan —
  lines, rectangles, ovals and text labels that never interact with rooms,
  devices or fills. Shapes are drag-drawn with grid snap and a live preview;
  text is placed via a small dialog (size S/M/L, color; double-click to edit).
  Toolbar: Select (move, Delete key), Erase, color, three line widths and an
  optional 25% fill for rects/ovals. Esc walks back: draft → selection →
  Select tool → View.
- The decor layer renders **under rooms** (a true underlay), is visible in all
  modes and completely click-transparent outside the editor. Stored per space
  in the server config (`space.decor`, validated on the backend, shared across
  clients with the usual rev/optimistic locking).

## v1.32.1 — 2026-07-22
- Opening tool: hovering near a wall now shows a **dashed preview** of where
  the opening would land — snapped onto the wall, default door length (90 cm),
  with a center dot. No preview far from walls or over an existing opening
  (a click there edits it instead).

## v1.32.0 — 2026-07-22 (split polyline, tool cursors, Esc)
- **Split can now cut along a polyline**, not just a straight chord: start on
  a wall, click intermediate points inside the room, finish on another wall.
  The path is validated (no wall crossings, no self-intersection) and drawn
  live with vertices and a preview segment. Two clicks still work as before.
- **Tool cursors**: Merge and delete-room show a pointer; Split shows a
  pointer while picking the room, then a crosshair while cutting.
- **Esc walks back out of Merge/Split** step by step: last cut point → first
  point → room selection → back to the Draw tool. Merge: selection → tool.

## v1.31.2 — 2026-07-22
- Plan editor: the room picked with the **Merge** tool (and the room selected
  for **Split**) is highlighted amber again. The `.outlined` markup style,
  added later in the stylesheet, was silently overriding the `.picked`
  highlight at equal specificity (source-order gotcha #4 — rule order fixed
  and documented in the stylesheet).

## v1.31.1 — 2026-07-22
- Plan editor: interacting with a room card (drag, corner-resize or a plain
  click) no longer leaks into the active markup tool — previously the click
  after a resize could add an outline point, pick a merge/split room or even
  prompt to delete the room under the card.

## v1.31.0 — 2026-07-22 (room cards)
- Room labels grew into **room cards**: the name on top, and an optional
  smaller metrics line below — temperature, humidity, average Zigbee signal
  and lights, each behind its own checkbox in the space settings (all off by
  default). Lights show On/Off, or **"1 of 3"** when only part of the room is
  lit. Rooms without an HA area keep showing just the name.
- Cards are **resizable** in the Plan editor: hovering shows corner handles;
  dragging one scales the whole card uniformly (0.5×–3×). The scale is stored
  in the layout next to the card position, and dragging keeps it.
- Fixed a latent v1.25 regression: room labels were not rendered as draggable
  HTML in the Plan editor at all (only a static SVG name), so moving them was
  impossible. The Plan editor now renders real cards (name only) that can be
  dragged and resized.
- Two markup smokes (merge/split) still called a method removed in v1.25 —
  repaired.

## v1.30.4 — 2026-07-22
- **Escape now closes every dialog** (general settings, icon rules, device
  editor, space dialog, opening editor, info cards), topmost first when
  stacked. Closing the space dialog with Esc abandons a floor-import queue,
  same as its Cancel button. Esc while drawing an outline still undoes the
  last point (dialogs take priority).

## v1.30.3 — 2026-07-22
- The **General settings** (fill palette) gear in the header is now visible in
  every mode for users who can edit, not just in the Plan editor.

## v1.30.2 — 2026-07-22 (editor tabs redesign)
- Mode tabs renamed and reduced to two: **"Plan editor"** and **"Device
  editor"**. View is no longer a tab — it is the implicit default state.
- The Device editor now has its own bottom toolbar (add / show all / reset
  layout / icon rules moved out of the header), mirroring the Plan toolbar.
- Both toolbars and the active tab itself got an **X** button that closes the
  editor and returns to View. Re-clicking the active tab does nothing;
  switching Plan↔Devices is direct.

## v1.30.1 — 2026-07-22 (space gear polish)
- The gear icon next to the space name is now visible in **every mode** (not
  just Plan) for users who can edit, so space settings are always one click
  away. The "+" (add space) tab remains Plan-only.
- Fixed the gear's vertical alignment — it sat noticeably lower than the space
  name (baseline-aligned web component); tabs are now flex-centered.

## v1.30.0 — 2026-07-22 (lock action in the opening info card)
- The door/window info card (View mode) now offers an explicit **Unlock/Lock
  button** when a lock entity is bound and available. Unlock is styled red as a
  security-sensitive action; the button is disabled during locking/unlocking and
  hidden when the lock is unavailable.
- The security rule is untouched: **tapping a lock icon on the plan still never
  toggles it** — the action lives only behind a deliberate, clearly labeled
  button, same interaction contract as HA's more-info dialog.

## v1.29.0 — 2026-07-22 (the "new device" flag)
- **Devices that appear in HA after installation no longer show up silently**:
  an auto-placed device (or light group) gets a big red dot at the top-right of
  its icon. The flag is stored server-side (`settings.new_device_ids`), so every
  client sees it — and it disappears everywhere the first time someone opens
  that device's editor.
- The baseline of known devices is seeded silently on the first run after the
  update, so **existing devices never flood the plan with dots**. Hand-made
  markers (virtual/rebindings) are never flagged — the user just created them.
  (Pure `diffNewDevices`, unit-tested; backend schema for the two new settings.)

## v1.28.1 — 2026-07-22 (View-mode polish: cursors and inert openings)
- **Device icons in View no longer show the grab cursor** (drag lives in the
  Devices mode); they show a pointer — clicking still works exactly as before.
- **Doors and windows in View are pure drawings**: no grab cursor, no hover
  outline, no hit target, no click — regardless of what is bound to them.
- **The lock badge is the one exception**: when a lock is bound, the badge is
  shown and clickable in View (pointer cursor, click opens the door/lock info
  card). It stays inert in Plan so it does not fight editing.
- In Plan an opening remains fully interactive: grab cursor + hover outline,
  dragging along walls, and a click with ANY tool opens its properties dialog.

## v1.28.0 — 2026-07-21 (sub-area rooms: manual placement without an HA area; issue #3)
- **Devices can now be placed into rooms that have no Home Assistant area.**
  The marker dialog's room list includes area-less rooms (marked "no area,
  manual"); pick one and the device/virtual marker lands at its centre. The
  marker stores `room_id`, so the choice survives edits and re-opens. The
  laundry-cupboard case from issue #3: a decorative room inside a larger area
  can now hold its own door sensor and light.
- Room reference parsing extracted as pure `parseRoomRef` (`space#area` /
  `space#@roomId`), unit-tested; backend schema for `room_id`.

## v1.27.0 — 2026-07-21 (RGB light colors + alarm pulse; issue #3)
- **RGB lights show their actual color**: an "on" light with a color tints its
  bulb icon, glow and — unless a custom ripple color is set — its presence ripple.
  Brightness is deliberately ignored (a dim red bulb still reads red); off,
  white-only and unavailable lights look as before. (Pure `lightColorOf`.)
- **Emergencies pulse red**: leak / smoke / gas / CO / safety / tamper / problem
  binary sensors and sirens in `on` get a red pulsing ring over any display mode.
  `unavailable`/`unknown` never alarm — an outage is not a fire. Honours
  `prefers-reduced-motion`. (Pure `isAlarmState`.)

## v1.26.0 — 2026-07-21 (state-reflecting icons + value display; issue #3)
- **Auto icons now reflect live state**, like core HA: door/window/garage sensors
  swap open↔closed variants, locks show locked/unlocked, a bulb lights up as
  `lightbulb-on`. Conservative by design: only well-known pairs, never when the
  user picked a custom icon, and `unavailable`/`unknown` keep the base icon.
  Gated by the existing "live states" card option. (Pure `stateIcon`, unit-tested.)
- **New marker display mode "Value instead of an icon"**: the measurement itself
  (temperature °, humidity %, or any numeric state with its unit) becomes the
  marker body — the small corner badges disappear for such markers. Direct
  request from issue #3. Non-numeric entities fall back to the icon.

## v1.25.0 — 2026-07-21 (three interaction modes: View / Plan / Devices)
The approved UX redesign (docs/UX-MODES.md), confirmed by user feedback (#3):

- **View** (default, and the only mode after every load): display and device
  interaction only — tap/long-press/tooltips/pan/zoom. Nothing can be dragged or
  edited; panning may start on top of an icon and never displaces it. The header
  carries only space tabs, the counter, zoom and the mode switcher.
- **Plan**: everything about geometry and appearance — room outline/delete/merge/
  split tools, openings (placement, drag along walls, click-to-edit), room-label
  dragging, per-space gear dialog, add space, the ⚙ fill palette. Orange stage frame.
- **Devices**: marker work — icon dragging lives ONLY here, a click opens the
  editor directly; add device, show-all curation, reset layout, icon rules. Accent frame.
- The mode switcher is a segmented control shown to administrators; the standalone
  markup toggle button is gone, "drag anywhere" (v1.9) is consciously reversed,
  and the v1.23.1 view-mode opening drag/double-click moved into Plan.

## v1.24.2 — 2026-07-16 (lights fill: a color for rooms with no light sources)
- The "Fill: lights" group in General settings gained a third color — **"No light
  sources"**. Its default opacity is 0, so rooms without any lights stay unfilled
  exactly as before; give it an opacity and such rooms get their own tint,
  distinguishable from "all lights off".

## v1.24.1 — 2026-07-16 (space tab: gear instead of pencil)
- The small icon next to a space name in the tabs is now a gear (was a pencil) —
  the dialog it opens is space *settings* (plan, display, scale), not just renaming.

## v1.24.0 — 2026-07-16 (general settings: fill palette; per-space LQI toggle)
- **New "General settings" dialog** (⚙ in the header): the fill colors used by every
  space, grouped by mode — lights (on / all off), temperature (cold / comfortable /
  hot) and zigbee signal (weak / strong endpoints of the gradient). Every color has
  its **own opacity slider**; the zigbee fill interpolates between the two configured
  endpoint colors. Stored server-side in `settings.fill_colors` (defaults are not
  persisted); the static `houseplan-space-card` uses the same palette.
- **Per-space "Show zigbee signal (LQI)" toggle** in the space dialog: hides or shows
  the LQI badges next to zigbee devices (and the signal line in room tooltips) for
  that space; when never touched, the card-level `show_signal` option applies as before.
- Fill opacity is now governed by the per-color setting; the space "Opacity" slider
  keeps controlling borders and names.
- New pure helpers `fillColorsOf` / `lerpColor` / `roomFillStyle` (+4 tests: 77 → 81);
  backend schema for `fill_colors` and `show_lqi`; smoke `smoke_general_settings`.

## v1.23.2 — 2026-07-16 (manual upload limit raised to 50 MB)
- The per-file limit for attached manuals (PDF etc.) is now **50 MB** (was 25).
  The limit is still enforced while the multipart body streams in, so an oversized
  upload is cut off early rather than buffered whole; the error toast reads the
  actual limit from the server response.

## v1.23.1 — 2026-07-17 (openings: hover, drag along walls, double-click properties)
- **Hover affordance**: an accent outline hugs the opening's wall strip on hover, with a
  grab cursor — placed openings now look grabbable.
- **Drag along walls** (view mode): an opening re-snaps continuously to the nearest derived
  wall while dragged; too far from any wall → it stays put. `snapToWall` now normalizes the
  angle to [-90, 90) — two rooms share a wall with OPPOSITE edge directions, and without this
  a drag across segment boundaries flipped the hinge side back and forth. Saved on release.
- **Click / double click**: a single click still opens the status card (now via a 250 ms
  timer); a **double click opens the properties dialog** right from view mode. The markup
  "Opening" tool behaves as before. Hit zone made slightly thicker and is now a strip along
  the wall (previously it covered the whole swing square, causing accidental hovers).
- (+1 test: 76 → 77.)

## v1.23.0 — 2026-07-17 (doors & windows with live open/lock state)
Visual language after easy-floorplan (MIT); the placement model is ours.
- **New markup tool "Opening"**: click next to a wall → the opening snaps onto the nearest
  DERIVED room wall (walls have no independent existence — v1.19.0) and takes its angle, then a
  dialog asks for type (door/window), **length in real cm** (defaults: door 90, window 120 —
  the per-space scale makes this honest), an open/close sensor (door/window-class
  `binary_sensor`/`cover`, invertible) and, for doors, a **lock entity**. The opening keeps
  absolute coordinates, so editing/merging/deleting rooms never breaks it. Click an existing
  opening with the tool to edit or delete it.
- **Live rendering**: a door is a leaf hinged at the jamb with a quarter-circle swing arc that
  "draws on" (stroke-dashoffset) as it opens; a window is two casement leaves meeting in the
  middle. Открыто → the moving parts take the accent colour and animate (CSS transitions,
  `prefers-reduced-motion` honoured). No sensor → the classic static plan: doors drawn open,
  windows closed. `unavailable`/`unknown` freeze that default — an outage must not fake motion
  (pure `openingAmount`, unit-tested). Hinge side / swing side via flip toggles.
- **Locks**: a padlock badge beside the door — green closed when `locked`, orange open when
  unlocked, grey question when unknown. The lock is NEVER toggled from the plan (the card's
  standing security rule); clicking the opening or the badge shows an **info card** with both
  states.
- New pure helpers `snapToWall` (projection + wall angle over derived edges) and
  `openingAmount`; `space.openings[]` validated server-side. (+2 tests: 74 → 76.)

## v1.22.0 — 2026-07-17 (presence ripples, per-device icon size/rotation, one-click install)
Ideas borrowed from [easy-floorplan](https://github.com/nicosandller/easy-floorplan) — the visuals,
not the model.
- **Presence ripples**: `display: badge | ripple | icon_ripple` per marker, with `ripple_color`
  and `ripple_size`. Active → pulsing rings; idle → a faint dot. Gated by the pure
  `isActiveState` — independent of the card-wide live_states toggle, and `unavailable`/`unknown`
  count as idle so an outage never leaves a ring pulsing. Honours `prefers-reduced-motion`.
- **Per-device icon `size` (×0.5–3) and `angle`** — sizing now hangs off `--dev-size`, so value
  badges scale with the device.
- **One-click install badge** (My Home Assistant → HACS) in both READMEs.
- (+1 test.)

## v1.21.3 — 2026-07-16 (room labels: no text shadow)
- Room name labels no longer carry a text shadow — crisper look on both the white
  hand-drawn canvas and plan images.

## v1.21.2 — 2026-07-16 (space-dialog polish)
- The **"Scale (cm per cell)" input is compact** again — a generic `width:100%`
  dialog rule was stretching it across the row.
- **A space with no background image now gets a white "paper" canvas** instead of
  the dark stage, so hand-drawn rooms read like a floor plan on paper.

## v1.21.1 — 2026-07-16 (audit: split snaps to the wall, docs for merge/split)
- **Fix (found in audit):** Split required each click to land on a grid node, so it
  silently refused rooms whose walls are not grid-aligned (imported or older polygons)
  — the "pick a wall" toast fired no matter where you clicked. The click now snaps to
  the room's nearest wall (`closestPointOnBoundary`) instead of the grid, with the pull
  capped at ~6 grid cells so an accidental click in the middle of a room stays a miss
  rather than becoming a wall point the user never meant; `splitRoom()` still rejects
  a cut that is not a clean wall-to-wall chord. Also makes aiming easier on the fine
  (240-cell) grid.
- **Docs:** README (en + ru) now documents room Merge, Split, the drawing ruler and the
  per-space scale — these v1.18–v1.21 features were shipped without user-facing docs.
  `docs/TESTING.md` gained merge/split rows and a fresh self-run record.
- New smokes `demo/smoke_merge_split.mjs` and `smoke_split_nonsnap.mjs`;
  `closestPointOnBoundary` unit-tested. (+1 test: 72 → 73.)

## v1.21.0 — 2026-07-16 (merge and split rooms)
- **Merge** (toolbar "Merge"): click a room, then a neighbour. Only rooms that **share a wall**
  can merge — and that is decided by the result rather than a heuristic: `mergeRooms` unions the
  outlines and accepts the pair only when they collapse into ONE hole-free outline. A corner
  touch, rooms apart, or a union enclosing a hole are refused. A dialog picks which name and
  area survive; the kept room keeps its id, so its label position and devices stay put. The
  dialog warns that the other area is released.
- **Split** (toolbar "Split"): click the room, then two points on its walls — the chord cuts it
  in two, with the live ruler on the cut. **The bigger part stays the room it was** (name, area,
  devices); the smaller becomes a new room and its dialog asks for name/area. Cancelling the
  dialog leaves the room whole — the cut is applied only on confirm. Cuts that do not run
  wall-to-wall inside the room (ends off the wall, chord leaving a concave room, a chord along a
  wall) are refused.
- Boolean geometry via **polyclip-ts** (proper ESM + native types; `polygon-clipping` ships named
  types but a default-only ESM build, which breaks either tsc or the runtime). Verified against
  the real plan, where neighbouring walls overlap collinearly instead of matching exactly —
  the case a hand-rolled union gets wrong. Bundle: 151 KB → 202 KB.
- New pure helpers: `polygonArea`, `mergeRooms`, `splitRoom`. (+5 tests: 67 → 72.)

## v1.20.0 — 2026-07-16 (rooms may not overlap)
- **A click strictly inside an existing room is refused** while drawing (toast names the room).
  Being *on* a wall stays legal — neighbouring rooms share walls, and real walls overlap
  collinearly rather than match exactly, so new vertices land on existing outlines mid-span
  all the time. `pointStrictlyInside` excludes the boundary explicitly (ray casting alone is
  unreliable exactly on an edge).
- **Closing an outline that overlaps an existing room is refused** — vertex checks alone are not
  enough: an outline drawn *around* a room has every vertex outside it. The outline stays open
  so it can be corrected. Nesting one room inside another counts as an overlap.
- New pure geometry in logic.ts: `roomPoly`, `pointOnBoundary`, `pointStrictlyInside`,
  `segmentsProperlyCross` (touching/collinear is deliberately not a crossing), `roomsOverlap`
  (edge crossings + containment probe, which also catches duplicate outlines). (+4 tests: 63 → 67.)

## v1.19.0 — 2026-07-16 (a line is never a thing of its own)
**Model change.** A wall can only exist as an edge of a closed room. Consequences:
- **Walls are derived from room outlines** (`roomEdges` in logic.ts), not stored. A wall
  shared by two rooms is emitted once, so **deleting a room keeps the borders its neighbours
  still contribute** — and drops the walls nobody else uses. This falls out of the model
  instead of needing bookkeeping.
- **An abandoned outline leaves nothing behind.** Previously every click pair was written to
  `space.segments` immediately, so a contour you never closed left orphan lines on the plan.
  Now nothing is persisted until the room is saved.
- **The "Erase line" tool is gone** — there is no standalone line to erase. Mis-clicks are
  undone with Esc / Ctrl+Z as before.
- **`space.segments` is dropped on every save** (legacy configs shed it on first write).
  Validation still tolerates the field so a stale browser tab cannot fail a save; diagnostics
  no longer reports it. Lines that belonged to no room disappear on upgrade — by design.
- Dead code removed: `_addSegment`, `_removeSegmentByKey`, `_distToSeg`, `_pathSegs`, `_segKey`.
  `segKey(a, b, prec)` gained a precision argument (normalized coords need more than render
  units). (+2 tests: 61 → 63.)

## v1.18.1 — 2026-07-16 (fix: the drawing ruler was invisible)
- Fix on top of v1.18.0: the length badge never showed up while drawing. It was rendered
  inside `.devlayer`, and `.stage.markup .devlayer { display: none }` hides that whole layer
  in markup mode (so icons do not get in the way) — the badge was in the DOM but invisible.
  It now lives in its own `.measurelayer` (absolute, `pointer-events: none`), which markup
  mode does not hide. Verified visually on a real drawn segment ("3.60 m" on screen).
- Testing lesson (see docs/TESTING.md): asserting on `textContent` is not enough — a DOM
  query passes on elements hidden by an ancestor. Check `offsetParent`/rect or look at a
  screenshot.

## v1.18.0 — 2026-07-14 (live measurements while drawing rooms + per-space scale)
- **Ruler while drawing.** In room-markup "draw" mode, a badge follows the cursor showing the
  length of the current segment (last placed vertex → cursor). Units come from the HA unit
  system: metric → metres ("1.25 m"), imperial → feet+inches ("4′ 1″").
- **Per-space scale.** New "Scale (grid cell size)" field in the space dialog — cm represented
  by one grid cell (default **5 cm**, i.e. 240 cells ≈ 12 m). Stored as `space.cell_cm`; each
  plan can have its own real-world size.
- Pure helpers `segmentCm` / `formatLength` in logic.ts (unit-tested); `_fmtLen` +
  `_renderMeasureLabel` in the card; `.measurelabel` style; i18n `space.scale_label`/`scale_unit`.
  (+3 tests: 58 → 61 frontend.)

## v1.17.2 — 2026-07-11 (humidity badge: gate on the sensor, not the icon)
- Fix on top of v1.17.1: the humidity `%` badge is now shown whenever the marker's primary
  entity is a humidity sensor (`device_class: humidity`), regardless of the resolved icon.
  Previously it required the `mdi:water-percent` icon, so a humidity sensor whose name matched
  another icon rule (e.g. a "Myheat Влажность …" sensor → boiler icon) showed no value.
  Verified live (45.2 → 45%). (+1 test: 57 → 58.)

## v1.17.1 — 2026-07-11 (humidity value next to the icon, like temperature)
- **Humidity sensors now show their value (%) next to the icon**, mirroring the temperature
  badge. Any marker resolved to the humidity icon (`mdi:water-percent`) — a humidity device or a
  humidity entity placed on its own (v1.17.0) — gets an integer `%` badge and the value in its
  tooltip. New `isHumEntity`/`humFor` (diagnostic entities excluded), `DevItem.hum`, `.hval`
  badge, gated by the same "sensor values" option as temperature. (+2 tests: 55 → 57.)

## v1.17.0 — 2026-07-11 (place individual entities, not just whole devices — issue #1)
- **You can now put a single entity on the plan as its own icon** — e.g. a climate sensor
  exposes temperature AND humidity; add the device (shows temperature) and separately add the
  humidity entity as a second icon. In the "add device" dialog, start typing in the binding
  search and individual entities now appear alongside devices/helpers (surfaced only while
  searching, so the default list stays clean); the sub-label shows the domain and parent device.
- Entity markers now get a **sensible auto icon** (name rules → `device_class` → chip) instead of
  the generic shape, and a **temperature value** when the entity is a thermometer/air-monitor.
  The `entity:<eid>` binding already existed (used by helpers/light groups); this exposes it for
  any entity. (+1 test: 54 → 55.)

## v1.16.2 — 2026-07-11 (docs+log: correct card resource URL — fixes "Custom element doesn't exist")
- **Support issue #2**: users adding a Lovelace resource that points at the on-disk path
  `/custom_components/houseplan/frontend/houseplan-card.js` get a `text/plain` MIME error and
  "Custom element doesn't exist: houseplan-card" — HA does not serve `custom_components/` over
  HTTP. The integration serves the card at **`/houseplan_files/houseplan-card.js`** (verified:
  `200 text/javascript`) and auto-registers it as a Lovelace resource in storage mode.
- README (en+ru) now documents the correct URL and the common mistake, incl. a YAML-mode
  `resources:` snippet.
- On setup the integration logs (INFO) the exact served URL and, when Lovelace resources are
  YAML-managed, how to add it manually — so the fix is discoverable from the logs.

## v1.16.1 — 2026-07-08 (space-card shows room fills as configured)
- **The static `houseplan-space-card` now renders room fills exactly as configured on the
  full card** (temperature / signal / lights coloring), as a snapshot of the states passed
  in via `hass` — reverting the v1.16.0 omission. The card still does not subscribe to state
  changes itself and stays non-interactive (`pointer-events:none`); fills refresh when HA
  hands the card an updated `hass`. Added shared `areaLqi()` in devices.ts.

## v1.16.0 — 2026-07-08 (new: houseplan-space-card + deep-link)
- **New second card `custom:houseplan-space-card`** — a READ-ONLY, static schematic of a
  single space, embeddable on any dashboard. Draws the configured plan + room borders/names +
  device markers at their saved positions, with **no interactivity** (the schematic layer is
  `pointer-events:none` — no clicks/hover/tooltips/drag/more-info) and **no live states**
  (no state subscription, no status/temperature fills). A footer button opens the space in the
  full component via a **deep-link** (`#space=<id>`). Config: `space` (required), `title`,
  `show_button`, `button_label`, `button_target`, `aspect_ratio`, `icon_size`; unknown space → a
  tidy error card. GUI editor with a space dropdown from the integration config.
- **Deep-link in the full card**: on load it reads `#space=<id>` (valid id wins over
  `default_floor`) and listens to `hashchange`, without blocking manual space switching.
- **Shared rendering**: pure geometry in `space-geometry.ts` (unit-tested), the static drawer in
  `space-render.ts`, and a **module-level config cache** (`config-store.ts`, rev-keyed, seeded from
  the full card's localStorage snapshot, invalidated on `houseplan_config_updated`) so N embedded
  cards on one board share a single WS request. Both cards ship in the one bundle.
- Tests: 48 → 54 frontend (space geometry) + demo smokes `smoke_space_card` and `smoke_deeplink`.
- Note: status/temperature fills are intentionally omitted from the static card (they are live);
  it shows configured room borders/names + neutral icons. Marker/position edits reflect after the
  config event or a reload.

## v1.15.6 — 2026-07-08 (room hover also reveals the border)
- Hovering a room now **shows its outline** even when borders are turned off. The stroke
  colour (`--room-stroke`) is now always set to the room colour and only hidden via
  `--room-stroke-op` — so the existing `stroke-opacity: 1` on hover reveals a crisp border
  (previously the stroke was `transparent` when borders were off, so hover showed nothing).

## v1.15.5 — 2026-07-08 (fix: room hover was always grey even when filled)
- Room hover now **darkens the current fill** for filled rooms and only greys **unfilled**
  ones (as intended since v1.15.1). The legacy `.room.overlay:hover` / `.room.yard:hover`
  grey rules were still matching styled rooms and, being applied to `fill` directly, beat
  the `--room-fill` variable — so a temperature/light/zigbee-filled room turned grey on
  hover. Scoped those legacy rules with `:not(.styled)`; styled rooms are now governed only
  by `.styled.filled:hover` (brightness 0.78) and `.styled:not(.filled):hover` (grey).

## v1.15.4 — 2026-07-08 (fix: device icon vertical centering — proper root cause)
- **Root cause of the off-centre icon, found in the live app** (the demo stub hid it):
  HA's real `<ha-icon>` host is `display:block` with a large inherited `line-height`
  (~22 px for a ~12 px glyph), so the SVG sat ~1.8 px **below** the badge centre.
  Fix: `.dev ha-icon` is now a zero-line-height flex box — the glyph centres exactly.
- Reverted the v1.15.3 `box-sizing: border-box` (it shrank the badge by 2 px and made the
  vertical offset *more* visible — "worse"). The 1 px anchor drift is instead corrected by
  the centering margin (`-(size/2 + 1px)`), keeping the original badge size.
- Verified in the real dashboard: anchor offset 0, glyph offset 0, badge size unchanged.
- Demo `ha-icon` stub made faithful to HA (block + line-height) so `smoke_icon_center`
  now actually reproduces and guards this; the smoke also asserts glyph-in-badge centering.

## v1.15.3 — 2026-07-08 (fix: device icon 1px off its anchor point)
- Device icon badges were sitting **1 px down-and-right of their true point**: `.dev`
  used the default `content-box`, so the 1 px border made the rendered square 2 px
  wider than the width the centering margin assumed. Added `box-sizing: border-box` —
  the badge centre now lands exactly on the device coordinate (verified in the demo:
  anchor offset 1 px → 0). The glyph itself was already centred within the square.

## v1.15.2 — 2026-07-08 (fix: room average temperature counted non-thermometers)
- **Average room temperature now uses only devices the card treats as thermometers**
  (`mdi:thermometer` / `mdi:air-filter`). Previously `areaTemp` swept every device in the
  area through `tempFor`, so fridges, TRV heads and smart plugs leaked their readings into
  the average (e.g. a 8.3 °C valve/appliance temperature dragging a room down).
- **`isTempEntity` now excludes chip/diagnostic temperatures**: `*_device_temperature`
  sensors and any entity in the `config`/`diagnostic` category are no longer treated as a
  room temperature — so even a genuine thermometer no longer reports its chip temperature.
- Affects the temperature room fill and the room tooltip average. (+3 frontend tests: 46 → 48.)

## v1.15.1 — 2026-07-06 (display-settings UX round from live usage)
- **Comfort-bounds input hardening**: clearing a temperature field can no longer
  collapse a bound to 0 (`Number('') === 0` — this silently turned "comfort from
  25" into a 0–25 range after the auto-swap, showing green at 24°). Inputs now
  parse with `parseFloat` + `isFinite` guard and the save path falls back to the
  defaults for non-finite values.
- Room tooltip now shows the **average room temperature** (what the temperature
  fill actually uses — averages every thermometer in the area, including TRVs).
- **Hover no longer recolors rooms blue**: filled rooms darken their current fill
  (`brightness(0.78)`), unfilled rooms get a light grey tint.
- Fill mode selector is a **radio group** with short labels (no color legend);
  the comfort bounds sit compactly inline on the temperature row (56 px inputs).
- The space dialog is wider (500 px) — the settings no longer feel cramped.

## v1.15.0 — 2026-07-06 (temperature room fill)
- New room fill mode **"Temperature"**: light blue below the comfort range, green
  inside it, warm yellow above. The comfort bounds (default 20–25 °C) are editable
  right in the space dialog and appear only when the mode is selected; bounds
  entered in the wrong order are swapped automatically. A room's temperature is
  the average of its devices' temperature readings; rooms without a reading stay
  unfilled. (+`areaTemp` helper, 3 new frontend tests, backend schema fields.)

## v1.14.0 — 2026-07-06 (per-space display settings, hand-drawn spaces, testing checklist)
- **Per-space "Display" settings** (space dialog): always-visible room borders,
  room name labels, a border/name color picker with an opacity slider, and a room
  fill mode — none / by zigbee signal (red→green) / by lights (yellow = something
  is on, grey = all lights off; rooms without lights stay unfilled).
- **Room name labels are draggable** like device icons; positions persist server-side
  (layout keys `rl_<roomId>`), defaults to the room centre; hidden in markup mode.
- **Hand-drawn spaces**: the space dialog got a "No image — I'll outline rooms by
  hand" option with a canvas orientation choice (landscape/portrait/square). Such
  spaces default to visible borders and names; switching an existing space to this
  mode detaches its background image. The plan image is no longer mandatory.
- Backend: explicit validation schema for the new per-space settings (+test).
- **`demo/` harness moved into the repository** (synthetic home, host page, capture
  and smoke scripts, icon-map generator) — public materials and smoke tests no
  longer depend on a perishable sandbox.
- **`docs/TESTING.md`**: a comprehensive manual-testing checklist (environments
  matrix, every feature, edge cases); policy — updated in the same commit as any
  functional change. The first self-run found and fixed two bugs:
  `plan_url` not detached on image→draw switch, and a `_stateClass` crash on
  state objects without `entity_id`.
- Tests: 43 frontend + 11 pure backend; new smokes `smoke_space_settings` and
  `smoke_edge_cases` (empty install, XSS names, legacy layout entries, 150-device perf).

## v1.13.3 — 2026-07-06 (privacy: drop legacy real-house plan sources)
- Removed the legacy `assets/` directory (real floor-plan sources from the pre-v1.3
  bundled-data era). Nothing in the build referenced it; instance data lives in
  server-side config. Note: the files remain in old git history and release archives.

## v1.13.2 — 2026-07-05 (audit round 3: fixes + buildDevices test suite)
- **buildDevices finally has a direct unit-test suite** (12 tests on a fake hass):
  area filtering, curation incl. show-all, duplicate numbering, light-group folding
  and its `group_lights=false` inverse, marker claim/metadata/hidden/virtual/entity
  paths, custom icon rules + the deliberate lock override, device_class fallback,
  primary-entity priority, LQI/temperature extraction. Frontend tests: 28 → 41.
- Fix: `t()` now substitutes **every** occurrence of a placeholder (extracted as the
  pure `subst()` helper with a regression test).
- Fix: `_saveConfigNow` refreshes the local config on a rev conflict before
  rethrowing — a retry no longer hits the same conflict (the debounced path already
  did this; the immediate path did not).
- Fix: `pointercancel` on a device icon clears the long-press timer — no phantom
  info card after an aborted touch gesture.
- Repairs check moved to `repairs.py` and now **re-runs after every config save**,
  so a missing/restored plan file is reflected in the Repairs UI without a restart.
- Documented the deliberate `mdi:lock` override in `devices.ts` (wins over custom
  rules — a mislabeled lock icon is safety-relevant confusion).
- Test infra: `tsconfig.test.json` also compiles `devices.ts`/`types.ts`;
  `scripts/fix-test-build.mjs` appends `.js` to tsc's extensionless ESM imports.

## v1.13.1 — 2026-07-05 (distribution materials)
- **Demo GIF** in the README — recorded on a fully synthetic demo home (no real
  floor plans): live states, tap-to-toggle, drag, zoom, info card, space tabs.
- GitHub issue templates (bug report with diagnostics hint, feature request),
  `CONTRIBUTING.md` (5-minute setup, ground rules, architecture pointers),
  Discussions enabled.

## v1.13.0 — 2026-07-05 (universality: floors import, icon rules, tap actions)
- **Floors import wizard**: on first run, if the HA registry has floors, the card
  offers to create a space per floor — names prefilled, the (mandatory) plan image is
  requested step by step, any floor can be skipped; after the last one the room-markup
  mode opens automatically. No floors / old HA → the old single-dialog onboarding.
- **Editable icon rules**: the built-in "name pattern → MDI icon" rules are now data
  (`settings.icon_rules`) with an in-card editor (⬡ in the header): reorder, delete,
  add, live test field, invalid-regex highlighting, one-click reset to the bilingual
  (EN/RU) defaults. Fallback chain: rules → entity `device_class` → generic chip.
  Invalid user regexes are skipped safely.
- **Tap actions**: `tap_action` card option (`info` default | `more-info` | `toggle`)
  plus a per-device override in the device dialog. Safety model: a card-wide toggle
  only affects lights/switches/fans/humidifiers; covers/valves need a conscious
  per-device toggle; locks and alarm panels never toggle from the plan. A long press
  (600 ms) always opens the info card.
- **i18n dictionaries moved to JSON** (`src/i18n/{en,ru}.json`) — new languages can be
  contributed without touching TypeScript; tests enforce key and placeholder parity.
- Light-theme pass: hardcoded dark badge backgrounds replaced with theme variables.
- Tests: 28 frontend (was 15) — tap-action resolver incl. security cases, icon-rule
  compilation/overrides/device-class fallback, floors sorting, i18n parity.

## v1.12.0 — 2026-07-05 (Quality Scale: Bronze + selected Silver/Gold)
Backend brought to Integration Quality Scale patterns (custom integrations are not
formally graded; progress is tracked in `custom_components/houseplan/quality_scale.yaml`):

- **`entry.runtime_data`** (typed `HouseplanData`: both stores + the write lock) replaces
  `hass.data[DOMAIN]` for entry data; WS handlers resolve it per call and answer
  `not_ready` while no entry is loaded. New `store.py` common module.
- **test-before-setup**: storage readability is verified in `async_setup_entry`
  (`ConfigEntryNotReady` on failure). **Unloading** is supported; WS commands and
  static paths are global by design (documented).
- **`single_config_entry: true`** in the manifest replaces the manual flow check.
- **Store versioning**: stores now carry `minor_version` and a migration hook
  (`HouseplanStore._async_migrate_func`) — schema changes get a single upgrade path.
- **Diagnostics** (`diagnostics.py`): redacted dump (options, rev, per-space stats,
  markers with personal fields redacted, layout size).
- **Repairs**: a missing plan file raises a repair issue (`broken_plan`) with
  en/ru translations; issues clear automatically when resolved.
- **System health** (`system_health.py`): rev, spaces/rooms/markers/layout counters.
- **Uninstall cleanup**: `async_remove_entry` deletes our Lovelace resource entry.
- **Tests**: config flow, WS API (layout ops, rev conflict, not_ready, plan upload
  validation), HTTP upload (ok/bad ext/traversal) on `pytest-homeassistant-custom-component`
  — run in CI on Python 3.13; pure validation tests still run anywhere.
- `strings.json` added; translations updated.

## v1.11.2 — 2026-07-05 (device dialog: usable Description height)
- The Description textarea in the device edit dialog was squeezed to ~2 lines by
  the dialog body's flex column. Now `min-height: 92px`, `flex-shrink: 0`, `rows=4`;
  still resizable vertically.

## v1.11.1 — 2026-07-05 (brand images shipped inside the integration)
- Brand icon and logo (256/512, transparent background) now live in
  `custom_components/houseplan/brand/` — the native mechanism for custom
  integrations since Home Assistant 2026.3 (served via `/api/brands/...`,
  local images take priority over the brands CDN). The former root `brand/`
  directory is gone, and no home-assistant/brands PR is needed (theirs bot
  closes such PRs as obsolete).

## v1.11.0 — 2026-07-05 (full English translation + UI localization)
- **UI localization (en/ru)**: every card string moved to `src/i18n.ts` dictionaries.
  The language follows the HA user profile (`hass.locale`) automatically; a new
  `language: en|ru` card option forces it. The GUI editor got the option and its own
  localized labels. Generated device names (light group, unnamed, virtual device)
  are localized via a `loc` callback in `BuildCtx`.
- **English-only codebase**: all comments, docstrings, section banners, JSDoc, test
  names, backend WS/HTTP error messages and log lines translated to English.
  Russian remains only where it is functional or content: the `ru` i18n dictionary,
  `translations/ru.json` (config flow), `iconFor` regex patterns matching Russian
  device names (with their test fixtures), and the Russian documentation copy.
- **Docs**: README is now English-first with a full Russian copy in `README.ru.md`;
  `docs/ARCHITECTURE.md`, `DEVELOPMENT.md`, `ROADMAP.md` and the entire CHANGELOG
  history translated to English. `translations/en.json` had Russian strings — fixed.
- Removed obsolete `RELEASE_NOTES_v1.9.3.md` and `scripts_publish.sh` (publication
  is done; the repo lives at github.com/Matysh/houseplan-card).

## v1.10.0 — 2026-07-05 (audit: write races, XSS, modularity)
**Backend**
- **Write race eliminated**: all load→modify→save cycles (`layout/set|update|delete`,
  `config/set`) are serialized by a shared `asyncio.Lock` — concurrent WS calls no longer lose
  changes, and the `expected_rev` check became atomic.
- New WS command `houseplan/layout/delete` — cleans up a position when a marker is deleted
  (previously orphans accumulated in `.storage/houseplan.layout`).
- Removed the dead WS command `houseplan/file/set` — files are uploaded over HTTP only
  (`/api/houseplan/upload`), as the card already did.
- HTTP upload: the 25 MB limit is enforced WHILE reading the multipart stream (abort at the limit),
  not after reading the whole file into memory; file `stat()` moved into the executor.
- `request.app[KEY_HASS]` instead of the deprecated `request.app["hass"]` (with a fallback for older HA).

**Frontend**
- **The god-component was broken up**: `houseplan-card.ts` 3023 → ~1990 lines.
  Styles → `styles.ts`; types → `types.ts`; building devices from the HA registries
  (curation, light groups, markers, LQI/temperature) → `devices.ts` (pure functions).
- **Last-writer-wins in the layout eliminated**: `_saveMarker` writes the position pointwise
  (`layout/update`), not the whole layout (`layout/set`) — it no longer wipes positions from other
  windows (the regression class of the v1.4.4 incident). Rebinding/deletion clean up the old position.
- **XSS closed**: marker `link` and `pdfs[].url` go through `safeUrl()` (only http(s)
  and relative paths; `javascript:`/`data:` are rejected). +12 tests.
- File uploads via `hass.fetchWithAuth` (auto-refresh of an expired token),
  fallback to the raw token.
- **The dacha hardcode removed from the GUI editor**: the "default space" list is built
  from the server config (WS `config/get`), not the baked-in f1/f2/yard.
- `rules.ts`: removed the dead export `GROUP_TITLES`; the `iconFor` regexes are precompiled.
- A single `_errText()` in all error handlers (never "[object Object]").

## v1.9.3 — 2026-07-05 (audit + refactoring + tests)
- The pure functions `fitView` (viewport contain rectangle) and `declump` (icon push-apart)
  were extracted from the card into `logic.ts` — covered by unit tests (was 9 → now 14 tests).
- `_lqiFor` and `_roomLqi` now use the shared `averageLqi` (duplicate averaging removed).
- Removed dead code left after dropping the separate edit mode: the `_edit` field (written but
  never read), the methods `_renderEditbar` and `_applyXY` (never called).
- No behavior change — only structure and test coverage. Verified: tsc, build,
  14 frontend tests + 10 backend tests green, headless smoke test (render/zoom/devices/declump) clean.

## v1.9.2 — 2026-07-05 (grid twice as fine)
- The markup/snapping grid step was halved: `GRID_N` 120 → 240. Device positions and room
  outlines are NOT recomputed and do not shift: coordinates are stored as normalized fractions and snap
  to grid nodes, and the old nodes (multiples of 1/120) are an exact subset of the new ones (multiples of 1/240).
  Verified on the live layout (65 positions — all already on the new grid). Dragging now
  allows more precise positioning.

## v1.9.1 — 2026-07-05 (Zigbee signal: reading from the attribute + ZHA)
- The signal level is now taken not only from the dedicated `*_linkquality` sensor (Z2M), but also:
  from `*_lqi` sensors (ZHA), and from the `linkquality`/`lqi` ATTRIBUTE on any entity of the device.
  This covers devices whose dedicated signal sensor is disabled but the value is available in an attribute.
- NOTE: if a device's `*_linkquality` sensor is disabled (disabled_by=integration) AND the value
  is not published anywhere as an attribute — the signal cannot be shown; enable the sensor in the HA registry.

## v1.9.0 — 2026-07-05 (UX: always-on dragging, declumping, show all, responsive)
- **Icon dragging is available at all times** — the separate "edit mode" is gone (the ✥ button removed).
  Clicking an icon opens the device card (metadata editing — via the "Edit" button
  inside it), dragging works at any moment. `_pointerDown` no longer requires `_edit`.
- **Icons no longer clump together** (`_declump`): after the automatic grid layout a push-apart pass
  runs within the room so that icons do not overlap each other.
- **Positions are pinned when a room is saved**: the auto-positions of the area's devices are written
  into the layout once, so icons do not get reshuffled when the order in the HA registry changes.
- **Duplicates are numbered instead of hidden**: devices with the same "name|area" get a suffix
  (" 2", " 3"…) instead of silently disappearing.
- **The 👁 "Show all devices" button** in the header: temporarily disables curation and shows
  all devices of the area (bridges, service records, duplicates) — in case a needed one is hidden. The `show_all`
  flag in the config settings.
- **Markup continuation hint**: after saving a room a toast shows the room counter and
  suggests outlining the next one or leaving markup mode.
- **Responsive header**: the toolbar wraps and shrinks on narrow screens (media query ≤620px).

## v1.8.4 — 2026-07-04 (onboarding: required fields + user guidance)
- Initial setup brought to the target scenario: install → space dialog →
  rooms → auto device icons.
- **The background is mandatory** when creating a space: "Save" stays disabled without an uploaded
  plan (previously only the name was required — an empty space could be created).
- **The room area is mandatory**, with an explicit escape hatch: the main "Save" requires binding to an HA area;
  for decorative rooms without devices (hall, sauna) there is a separate "No area" button
  (only a name is needed). Previously saving was possible with "name OR area".
- **User guidance:** with an empty server config the space dialog opens
  automatically; after the first space is added the card enters room markup mode
  by itself with an "outline the rooms" hint. 
- When a room with an area is saved, the icons of that area's devices are auto-placed inside the outline
  (the curated set: without bridges/service records/duplicates/individual lamps from groups), and a toast shows
  how many devices were added.

## v1.8.3 — 2026-07-04 (instant start: config cache, data in the background)
- Icons and the plan appeared with a delay — the card waited for the server response (WS `config/get`
  + connection warm-up retries), and until then the space model was empty.
- A "stale-while-revalidate" cache was introduced: a snapshot of the server config + rev + layout
  is saved in `localStorage['houseplan_card_cfg_v1']`. In `setConfig` (synchronously, before
  hass arrives) it is restored — the plan and icons are drawn immediately from the cache (verified: setConfig
  populates the model in 0.2 ms without the server), while fresh data loads in the background and updates the
  card. Live states/temperatures/signal come in as hass warms up.
- The cache is refreshed after every successful load, live resync and icon position save,
  so on the next open the current snapshot is visible. When the server is unavailable the
  last known plan is shown instead of the empty onboarding.

## v1.8.2 — 2026-07-04 (vector-crisp zoom via viewBox + full-width stage)
- Zoom moved from CSS `transform: scale()` to manipulating the SVG `viewBox`. Previously the layer
  was rasterized and then scaled — everything "blurred" when zooming in. Now the browser
  redraws the vector at the target resolution: icons, room labels, lines, hatching and the
  vector background remain crisp at any scale (verified at 274%).
- The icon layer (HTML) is positioned and scaled by the same `view`, not a global
  transform — the icons are crisp and grow together with the plan.
- The stage now occupies the full viewport width (a "contain" model by the stage aspect): when
  zoomed in the content fills the width without black bars on the sides. Fully zoomed out the
  whole plan is visible (both width and height), the margins around it are filled with the card
  background, not black.
- All coordinate math (markup click `_svgPoint`, icon drag, pan, pinch) was rewritten
  in unified `view` coordinates — editing is correct at any zoom. A ResizeObserver on the stage
  recomputes the `view` when dimensions change (sidebar, rotation). Pan/zoom are constrained to `fit`.

## v1.8.1 — 2026-07-04 (fit-to-viewport + per-space zoom persistence)
- Zooming out to the full view: the lower zoom limit = 100% coincides with the fully
  visible plan. `.stage` is now constrained by the viewport height
  (`width:min(100%, calc((100dvh − 118px) × aspect))`, `max-width:100%`, centering),
  so on reset/zoom-out the whole layout is visible both in width and height without clipping.
- The zoom level is remembered per space and locally per device
  (`localStorage['houseplan_card_zoom_v1']`, `_zoomBySpace`): switching floors
  restores each floor's zoom; on return the pan is centered and constrained.
- Verified on live HA: f1→196%, f2→140%, the yard untouched — after switching around the
  values are restored; reset gives 100% and the full plan (874≤992 px in height).


## v1.8.0 — 2026-07-04 (plan zooming)
- Zoom and pan of the layout: mouse wheel (towards the cursor), two-finger pinch on a touch screen,
  one-finger background drag when zoomed in, −/reset/+ buttons in the toolbar, a zoom badge.
- Implemented via a CSS transform on `.zoomwrap` (translate+scale); the coordinate math
  (markup clicks, icon drag, tooltips) was recomputed with zoom/pan in mind — editing
  works when zoomed in too. Pan is constrained so the content always covers the stage. Zoom 100–800%.
- `.stage`: overflow hidden + touch-action none (custom gestures instead of the browser's).

## v1.7.4 — 2026-07-04 (PDF over HTTP instead of WebSocket)
- THE ROOT CAUSE of being unable to upload a PDF: the file was sent as base64 in a single WebSocket
  message, and WS has a message-size limit — a real manual (>2–3 MB) exceeded it, the connection dropped
  ("Connection lost"), which both failed the upload and closed the dialog (WS drop → reconnect
  → re-render). Confirmed by test: 1 MB over WS is fine, 3 MB → Connection lost.
- Manual files are now uploaded through the HTTP endpoint `POST /api/houseplan/upload` (multipart,
  HomeAssistantView, requires_auth, admin_only check) — like media in HA itself. Verified:
  3 MB (182 ms) and 10 MB (446 ms) upload without a hitch.
- Readable errors everywhere (`_errText`): no more "[object Object]"; clear texts for
  too_large / bad_ext / unauthorized.
- The WS command houseplan/file/set is kept for compatibility, but the frontend uses HTTP.


## v1.7.3 — 2026-07-04 (device dialog fixes)
- PDF manuals failed to upload: the manual base64 (`btoa(String.fromCharCode(...subarray))`) crashed
  on real files (RangeError when spreading large arrays), and when the dialog was closed during an
  await it threw a null access. Replaced with `FileReader.readAsDataURL` (reliable for any size);
  the results are accumulated and added only if the dialog is still open (no exceptions).
- The device/space/room edit dialog closed on an outside click and "by itself"
  (an accidental click on the background overlay, including after closing the system file picker). Removed
  background-click closing for editor dialogs — only explicit Cancel/Save/Esc.
  The info card (read-only) still closes on an outside click.
- Verified on live HA: PDFs attach; a background click and dialog data refresh do not close the dialog.

## v1.7.2 — 2026-07-04 (fix for the mobile "configuration error")
- THE CAUSE: the card was hooked up only via `add_extra_js_url` (extra_module_url), whose loading the
  frontend does NOT wait for — on a cold start of the mobile app the dashboard was drawn
  before the element was registered → "configuration error". (All working HACS cards are Lovelace resources.)
- FIX 1: the integration registers the card as a **Lovelace resource** (module) — the frontend waits for
  those before rendering. Idempotent (updates the URL on a version change, no duplicates); a fallback to
  extra_module_url for Lovelace YAML mode. `_register_lovelace_resource` in __init__.py.
- FIX 2: `_loadFromServer` retries (up to 8 attempts on hass updates) — if hass arrived before
  WS readiness, the card does not get stuck on the onboarding but waits for the config.
- Verified: the houseplan-card.js resource is registered, extra_module_url is empty (a single clean
  module), the card renders the plan on a fresh tab without the error.

## v1.7.0 — 2026-07-04 (audit + refactoring + tests)
- Removed the sample house baked into the bundle (the dacha, ~245 KB of base64 plans + ROOMS/FLOOR_*): the bundle
  went 293 KB → 83 KB. A fresh install shows the "Add a space" onboarding, not someone else's house.
- Removed the legacy→server migration code (the dacha is already on the server config) and the dead
  device_overrides/virtual_devices paths (replaced by markers[]).
- Pure logic extracted into src/logic.ts (lqiColor, snapToGrid, segKey, pointInPolygon,
  markerIdForBinding, averageLqi) — covered by unit tests (node:test, 9 tests + iconFor).
- Backend: validation/sanitizers extracted into validation.py (no HA imports) — pytest, 10 tests.
- SECURITY: a test revealed that the file/marker name sanitizer preserved leading dots
  (a directory traversal risk via ".."); leading-dot stripping added, empty → misc/file.
- Fixed real bugs previously masked by the truncated rules.ts: DOMAIN_PRIORITY was
  cut short (breaking the more-info entity selection); _defaultPositions crashed on polygon rooms
  (now bbox). tsc --noEmit added to the build and CI — strict typing passes.
- Removed the junk duplicates src/data/{editor,rules}.ts; versions synchronized (the manifest was stuck at 1.4.0).
- CI: added typecheck, frontend and backend unit tests.

## v1.6.2 — 2026-07-04
- The "Room" field in the device dialog is now for ALL icons (not only virtual ones):
  for bound ones it "overrides the placement" (by default, the device's area); changing the
  room moves the icon to its center. Stored in marker.space/area and wins over the HA area.
- An "Edit" button was added to the info card — it opens the device edit dialog.

## v1.6.0 — 2026-07-04 (Phase 3: device editor)
- The "markers" model (config.markers[]): a hybrid — auto-discovered HA devices appear by themselves, markers
  edit/rebind/augment them and describe manual/virtual icons. The marker id
  preserves the position (device→device_id, entity→lg_<eid>, virtual→v_<rand>).
- Clicking an icon: normal mode → the info card (name, model, state, link, description,
  PDF manuals, an "Open in HA" button); edit mode → the edit dialog.
- The device dialog: name, binding (a picker of all HA+Z2M devices/groups+helpers with a text
  filter, minus already-placed ones and duplicates by name|area, plus "Virtual device"), MDI icon
  (ha-icon-picker), model, link, description, manual file attachment (PDF to the server),
  room (for virtual ones), Remove/Cancel/Save.
- Toolbar: a "+" button (tooltip "Add device") — an empty dialog.
- Backend: MARKER_SCHEMA in the config; WS houseplan/file/set (files in /config/houseplan/files/,
  ≤25 MB, served from /houseplan_files/files/); the files static path registered.
- Virtual icons are now draggable and positioned like normal ones (layout by id).

## v1.6.1 — 2026-07-04
- The binding picker hides device duplicates by "name|area" (Tuya/LocalTuya), same as the dedup on the plan.

## v1.5.1 — 2026-07-04 (space management)
- A pencil icon to the right of each space name in the top toolbar + a "+" button
  (only with a server config).
- The space dialog: a "Name" field, a preview of the current background + "Upload/Replace…"
  (SVG/PNG/JPG/WebP, base64 → houseplan/plan/set, the aspect ratio is detected from the file),
  Delete / Cancel / Save buttons. Creating an empty space and deletion (together with all its
  rooms and markup, with a confirmation). Saved via config/set with a revision.

## v1.5.0 — 2026-07-04 (light groups = entities)
- Lamps replaced by group entities: HA light groups (platform=group, area from the entity registry)
  and Z2M groups (device model=Group) are rendered with the mdi:lightbulb-group icon; a click → the group's
  more-info (controlling the whole group and its members natively in HA).
- Individual lamps are hidden in rooms that have a light group (settings.group_lights=false
  brings back the per-lamp mode).
- The old visual grouping and the custom member menu were removed (code simplification).
- The positions of the old groups (grp_<area>) were migrated to the new ids (lg_<entity_id>) in the dacha layout.

## v1.4.4 — 2026-07-04 (CRITICAL fix: configuration race)
- INCIDENT: the config was saved wholesale on a last-writer-wins basis — an open client with a
  stale copy wiped other clients' edits (the first iteration of the user's markup was lost).
- Fix: optimistic locking — the config carries a `rev`; `config/set` accepts `expected_rev`
  and returns a `conflict` error on mismatch; the client re-reads the config.
- Live synchronization: `config/set` broadcasts a `houseplan_config_updated` event; all open
  cards are subscribed and re-read the config automatically (windows no longer diverge).
- Positions during drag are saved pointwise via `layout/update` (dirty set), not a full
  `layout/set` — the layout is also no longer wiped between windows.
- A config backup before deployment: .storage/houseplan.config.bak-*.

## v1.4.3 — 2026-07-04
- Device icons snap to the same grid as the markup (the icon center = a node, snapping
  on drag and on X/Y input). The existing 57 positions in the dacha DB were snapped to the nodes.

## v1.4.2 — 2026-07-04 (markup grid)
- The grid step was halved: GRID_N 60 → 120 (step 8.33 render units ≈ 0.83% of the plan width).
- Grid points are rendered ON TOP of the plan and rooms (the grid-rect was moved from below the plan
  into the top markup layer); the points are higher-contrast (r=0.14g, outline).
- Dacha data: the boundaries of all 13 rooms were snapped to grid nodes (edge snapping, shifts ≤ half a step;
  only the instance config was edited via houseplan/config/set, the code was untouched).
- Card cache: the module URL ?v= is taken from const.VERSION — when updating the frontend, bump
  const.py and restart HA, otherwise browsers keep the old module in memory cache.

## v1.4.1 — 2026-07-04 (markup UX)
- Esc / Ctrl+Z while drawing remove the last point (and its line, if it was added
  by that step; reused walls belonging to others are untouched).
- The editing panel (markup and layout editing) was moved to the top under the card header
  and pinned together with it (a shared sticky container .hdr).
- Closing the outline automatically opens the "New room" modal dialog: the display
  name, a dropdown of ONLY the free HA areas (not assigned to any room of the config),
  Save/Cancel. Cancel (or Esc) removes the closing point — the outline can be continued.
  Choosing an area with an empty name fills in the area's name.

## v1.4.0 — 2026-07-04 (Phase 2: room markup editor)
- The "Markup" mode in the card (the mdi:vector-square-edit button, only with a server config):
  a grid of points (60 nodes across the width), lines drawn by pairs of clicks with node snapping, a polyline preview.
- A closed outline (a click on the first point) activates "Save": choosing an HA area from a
  dropdown + a name; the room is saved as a polygon (poly, normalized vertices).
- Tools: Add (drawing), Erase line (a click on a line), Delete room
  (a click inside + confirm). The "wall" lines are stored in space.segments and reused by
  neighboring rooms (shared walls — via clicks on existing nodes).
- Room rendering: polygons on par with rectangles (hover, click into the area, LQI tooltip,
  the label at the centroid); in markup mode the outlines and names of all rooms are visible.
- Backend: ROOM_SCHEMA accepts poly (≥3 vertices) or x/y/w/h; SPACE_SCHEMA — segments.

## v1.3.0 — 2026-07-04 (Phase 1: server-side configuration)
- The `houseplan.config` Store: spaces (plan, aspect, view_box, rooms), device_overrides
  (hidden/icon/name), virtual_devices, settings (exclude_integrations, group_lights).
- WS: `houseplan/config/get|set`, `houseplan/plan/set` (plan file upload as base64 →
  `<config>/houseplan/plans/`, served through /houseplan_files/plans/).
- The card: a resolve model — the server config (coordinates NORMALIZED 0..1, render 1000×1000/aspect)
  or the legacy bundle (canvas 1489×1053). Layout v2: {device_id: {s, x, y}} normalized.
- The "To server" button in edit mode — a one-click migration of the legacy config (plans, rooms,
  view_box, layout). Performed at the dacha: .storage/houseplan.config + plans/f1.svg,f2.svg.
- Read-side support for device overrides and virtual devices (the management UI — phases 3–4).

## v1.2.2 — 2026-07-04
- The card toolbar (floor tabs) pins under the HA header while scrolling
  (`position: sticky; top: var(--header-height)`; ha-card overflow: visible).
- Incident: an intermediate build on the unstable mount produced a broken bundle that crashed the
  dashboard rendering; the rule "build only in /tmp + md5 control" was locked into DEVELOPMENT.md.

## v1.2.1 — 2026-07-04
- Icons no longer enlarge on hover/drag (transform: scale removed).

## v1.2.0 — 2026-07-03
- Room boundaries snapped to the walls of the vector plan.
- Zigbee LQI: the value under the icon, the room average in the tooltip, a red→green gradient,
  the show_signal option.
- `mdi:lock` for any devices with a lock.* entity (TTLock).
- The hallway switch: the device's area in the HA registry was fixed (it was in detskaia_elina).

## v1.1.0 — 2026-07-03
- Vector backgrounds (SVG from REMPLANNER), automatic scale/offset alignment via raster correlation.
- Icon size as a % of the plan width (container queries, default 2.5%).

## v1.0.1 — 2026-07-03
- fix: nested SVG fragments via lit svg`` (the background/rooms were not rendered).
- fix: the version taken from const instead of a blocking manifest.json read in the event loop.

## v1.0.0 — 2026-07-03
- First release: the Lovelace card (TS+Lit, no token, driven by hass) + the houseplan integration
  (WS layout storage, JS serving). The prototype's model carried over: curation, lamp groups,
  iconFor, temperature, more-info, area navigation, drag layout.
