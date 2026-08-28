# Project status & session context

> **Purpose of this file.** Cowork/AI sessions lose context (overflow, new session).
> This file is the **first thing to read** when resuming work. It captures the current
> state, where everything lives, and how to continue safely.
>
> **Documentation policy (mandatory):** every change is documented *in the same
> commit* — a CHANGELOG entry for anything user-visible **in BOTH
> `docs/CHANGELOG.md` (English) and `docs/CHANGELOG.ru.md` (Russian, since
> v1.42.0 — the user base is largely Russian-speaking, see the Telegram chat)**, STATUS.md for state changes
> (versions, publication, infrastructure), DEVELOPMENT.md for new gotchas,
> ARCHITECTURE.md for design changes. Work scope and status live in GitHub
> Issues and their labels, not in a parallel backlog document.

**Promotion rule (2026-08-08):** every new feature or material behaviour
change must pass through a published beta/RC before stable. Stable release
commits are promotion-only (versions, generated bundles and release/changelog
metadata). Only an explicit owner-approved emergency hotfix may skip this gate.

## Snapshot (2026-08-29)

| Item | State |
|---|---|
| Version | **v1.69.0-beta.3 candidate** everywhere (manifest, const.py, package.json, CARD_VERSION) |
| Current local cycle | v1.68.1 is the current stable release. v1.69.0-beta.3 packages the reviewed `S8-merged` work since beta.2: door-state-aware Glow (#20), smoothed vacuum trails (#209), reliable cold-View device actions and vacuum rendering (#357, #358), and furniture placement preview (#359). Publication remains gated by exact-SHA Validate. |
| Hidden Labs Stage | #89 Stage 1 ships in v1.63.0-beta.1. #122 Stage 2 ships in v1.64.0 and evolves the same hidden, expiring `iso` experiment with matte walls, a low exterior floor edge, restrained shared shadows and live vertical door/window/gate panels. Flat remains default; editors and `houseplan-space-card` remain flat; live floor effects and HA actions remain unchanged. Public activation remains a separate task. |
| Workflow | Superseded 2026-08-12: the pre-1.62 rule of "local edits without tests or commits" is **dead** — since release 1.62 every product change follows `PROCESS.md` (issue in `S5-ready`+, branch `issue/<NN>-slug`, trailers on every commit, review pipeline; `AGENTS.md` is the summary). Release mechanics below remain current. A requested pre-release gets a production build plus the smallest targeted unit/smoke set covering the changed surfaces, one tested `dev` commit/tag and a GitHub Release with `prerelease=true`; `main` stays untouched. The complete local frontend/backend/smoke gate runs only before a stable release, after which `main` is fast-forwarded to the exact tested `dev` SHA and the GitHub Release uses `prerelease=false`. Release bodies are short and bilingual (Russian first); every bullet links its GitHub issue (#NN) so the #328 rules stay machine-checkable. A STABLE body aggregates the changelog since the PREVIOUS STABLE release (never since the last beta): features/fixes described across the line's beta changelogs must appear, while bugs that were introduced and fixed strictly inside the beta line (never shipped in any stable) are excluded — draft with `npm run release:notes -- <tag>`, curate by hand, then `npm run release:notes -- <tag> --verify` must pass. `Мелкие исправления и улучшения` / `Small fixes and improvements` is allowed only when the range really contains user-visible work not itemised in the body; a single-issue hotfix ships without it (the verifier enforces this). Every body ends with separate links to the Russian and English changelogs. Open or partially delivered issues are never presented as shipped. Telegram announcements are sent only for stable releases; beta and RC publication is silent. `docs/RELEASE-NOTES.md` is the current canonical body instance; `npm run release:prerelease -- <tag> --issues=… --yes` is the primary local publication path and the manual `Publish prerelease` workflow is its GitHub-only equivalent once present on `main`. Nothing is copied to the home instance by hand |
| GitHub | https://github.com/Matysh/houseplan-card — [Issues](https://github.com/Matysh/houseplan-card/issues) are the canonical task records; their labels carry priority and workflow status (`PROCESS.md` §9). GitHub Projects is no longer used. `main` carries stable releases; pre-release tags may point directly at `dev`. Work lands on `dev` and is merged into `main` for a stable release, so `dev` is normally equal to or ahead of `main`, never behind. Push via SSH key `ha_jb` (remote git@github.com:…); API releases via the fine-grained PAT in `~/.git-credentials` (Contents R/W, issued 2026-07-23) |
| CI | Prerelease publication requires a green exact-SHA Validate: frontend/backend, smoke (including the #73 rAF frame sampler), golden, HACS/Hassfest and a short absolute-ceiling performance smoke. Obsolete same-ref Validate runs are cancelled. Full seven-sample base/candidate performance moved to `performance.yml` (`main` push, weekly, manual); stable release assets fail closed unless Validate and Full Performance are green for the exact tagged SHA and the stable-only CDP compositor screencast finds no empty/black presented frame. |
| HACS | **In the default catalog since 2026-08-25** (hacs/default#9004 merged). Install = plain HACS search. Post-merge checklist: run the manual zip workflow on the next stable tag after merging to main; forum/4pda announcement |
| Home instance | ha.jbstudio.pro (SSH port **22222**, key `ha_jb`; HA config root is `/mnt/data/supervisor/homeassistant` — `/config` does NOT exist in this SSH environment), last direct copy was **v1.57.0**; from v1.58.0 on it updates itself through HACS by tag (no scp) |
| Localization | UI en/ru/de (src/i18n/*.json), everything user-visible localized incl. kiosk popover; German is loaded lazily through the registry introduced by #62 |
| Furniture | #159 replaces the flat ~30-item picker with a two-level category/variant palette and 56 top-view symbols. The reviewed 77-SVG MIT source pack is vendored under `assets/furniture/houseplan-0.3.0`; plan art stays in the initial View graph, front-view category art stays in the lazy editor graph, and existing saved geometry is unchanged. |
| Tests | Four layers: Node unit (`npm test`: frontend pure modules + tooling policy), pure backend (`pytest tests_backend`, runs anywhere), HA-harness backend (same folder, CI only — needs py3.13 + pytest-homeassistant-custom-component), and browser smokes (`demo/smoke_*.mjs`, headless chromium). **Counts are not written down here** — they went stale within two releases while the version line beside them was kept current, which reads as less coverage than exists (review R5-2). Run `npm run inventory` for the current numbers, or read them off the last CI run |
| Input support | Owner's rule since 2026-08-08: View and kiosk are fully supported and release-blocking on touch. All three editors are desktop-first; touch editing is best effort and may be awkward, reduced or absent when parity is expensive. `docs/TOUCH-SUPPORT.md` defines the non-negotiable safety floor and documentation/test rules |
| Vacuums | Live puck, server-side trails and fit calibration are shipped. The local v1.61 Stage 1 contract in docs/VACUUM.md adds explicit Dreame/XCME/Valetudo coverage, registry-less source selection, capability diagnostics, path-gap preservation and source-health warnings; #205 resumes one ended same-map run through an inclusive 30-minute station/pause grace. #209 renders current and previous trails through the same bounded 17.5 cm rounded-corner curve without changing stored points or gaps. Roomba remains Stage 2 |
| Demo stand | **https://demo.houseplan.tech** — public, login `demo`/`demo`, resets to a pristine synthetic home every hour. **https://dev.houseplan.tech** — closed (basic auth), auto-deploys the `dev` branch every 10 min. Host: `ssh -i ~/.ssh/hp_stand hp@135.106.166.146`; layout, seeds and gotchas in the memory note `houseplan-demo-stand`. Since 2026-07-31 the stand covers most of the manual checklist: a scripted robot vacuum (`demo/stand/demo_robot` — Tasshack-shaped map sensor, serpentine run, pre-solved calibration, seeded server trail), Zigbee-style LQI template sensors, hand/auto-triggered leak+smoke alarms, an hvac_action climate marker and working script/scene/automation targets for tap-run. The stand-specific how-to-check guide is **docs/TESTING-DEMO.md** |
| Community | **Telegram chat: https://t.me/ha_houseplan** (created 2026-07-27) — the primary user-facing support channel; GitHub issues stay for bugs/features. Link it from any new release notes and posts |
| Product scope | `docs/SCOPE.md` is the feature guard rail; `docs/TOUCH-SUPPORT.md` is the input-support contract — check both before accepting interaction work |

## Current feature surface (since the 2026-07-17 snapshot)

- **Three editors + View**: Plan / Devices / Background (decor layer v1.33) as
  tabs with an X to close; View is the default; only the last space persists,
  while reload/return from another HA route always starts in View (#93).
  **Kiosk mode** (v1.41.0): `kiosk: true` — no
  header/editors, swipe between spaces, double-tap zoom reset, `cycle: N`
  carousel, per-screen size multipliers in localStorage.
- **Independent Glow overlay** (#55/#19, refined locally by #61/#65–#67): dark-room
  base is used only when the effective fill resolver returns `null`, including
  dynamic modes without usable data; resolved LQI/light/temp/custom colors keep
  their exact alpha while per-source pools remain visible. Pools use
  additive screen blending only after a cached real-pixel browser probe and
  otherwise fall back to normal composition; legacy `fill_mode: glow` remains
  losslessly readable/migratable. Marker roles are Auto/Always/Never; colour
  can remain live, be overridden with live brightness, or be fixed together
  with brightness. One perceptual alpha resolver gives every source the alpha at
  the centre of its pool; `GLOW_FALLOFF` then spends it over the whole radius.
  Per-source radius, doorway sight lines and transitive open boundaries remain —
  all three now fall out of the visibility region instead of separate layers.
- **Custom room fill** (#56, space UX refined locally by #64): the space dialog
  uses persistent user color/opacity as its ordinary first/default fill instead
  of a redundant None option; a room keeps None as an explicit inherited-fill
  suppression. Effective inheritance is room → space → safe documented default;
  room reset restores space inheritance, and full/static renderers share the
  same projection.
- **Universal device toggle** (#94, v1.62.0-beta.3): one `Toggle state` option is visible
  for every marker and resolves the exact binding, functional device role or
  explicitly configured controls. Hint, click, confirmation and cover
  presentation share one result; partial groups call only the shown available
  subset, stale controls never fall back, secure targets are no-op, and legacy
  `cover`/absent light defaults round-trip losslessly. **Lights toggle by
  default** (v1.39); other devices still default to the House Plan card.
- **Plan geometry**: polyline split (v1.32), island rooms w/ evenodd holes
  (v1.34), smart guides + 45° angle badge (v1.40), opening hover preview.
  Openings support doors, windows and compact wide gates; gates retain door
  contact/lock/Glow semantics but use two leaves opening only 10° outwards.
- **Canonical zero-thickness walls** (#306, current dev): Walls and Thickness
  accept `0..100 cm` for contour, draft and independent segments. Model v9
  migrates legacy virtual spans into stable `cm:0` atoms; a per-space
  dashed/solid selector controls both line style and Glow/sun transmission.
  Zero walls have no body, area or opening host, and there is no Boundary tool.
- **Rooms**: room cards with metrics (temp/hum/lqi/light "1 of 3") and
  proportional resize (v1.31); link icon to the HA area (v1.40.1, room taps
  removed). **New-device red dot** (v1.29), lock action button (v1.30).
- **Dialog UX**: binding radios + entities checkbox + search dropdown
  (v1.38.0); tap actions simplified to Device card / more-info / Toggle,
  right-click → more-info (v1.38.1); Esc closes every dialog (v1.30.4).
- **Room settings, tier 3** (v1.42.0): per-room fill/temp-source/label sizes;
  the settings button sits at the room's VISUAL centre (inscribed circle +
  centroid pull), icon-derived size, zooms with the plan (v1.51.0).
- **Files & plans** (v1.44–v1.50): signed content urls with sandbox CSP,
  copy-on-write plan files, "already uploaded" picker + explicit delete
  (v1.47.0), store quotas instead of any age-based deletion (v1.49.0),
  nothing is ever deleted on an inference (docs/SCOPE.md rule).
- **Square canvas** (v1.48.0) with a crash-safe two-store migration
  (geom_pending, v1.50.0) and an explicit geometry/repair command (v1.50.1);
  content-fit default zoom with devices as content, zoom out to 0.4×,
  measured stage height (v1.49–v1.50.2).
- **Explicit hide flags** (v1.51.0, docs/FILTERING.md): per-device
  `marker.hidden` seeded once from the old filter and controlled by the
  bottom-left "Hide" / "Show" action in the device dialog; local
  "Show hidden" ghosts; hidden counts toward room LQI on both cards, casts
  no light (v1.51.1).
- **True plan deletion** (v1.60.0-beta.1, 2026-08-07): confirmed Delete beside Hide/Show;
  a minimal `marker.removed` tombstone prevents auto-rediscovery but exposes
  the binding to Add. Deleted devices are absent from every plan aggregate and
  linked marker presentation; layout/files/trails are cleaned and stale layout
  writes are rejected. Exact contact/lock references owned by architectural
  openings remain active without restoring the standalone marker; live text
  and other marker controls retain the older re-add-to-reactivate contract.
- **Yellow = working right now** (v1.51.0): climate uses `hvac_action` when
  available and falls back to a current advertised non-off HVAC mode only when
  the integration omits the action; service switches can no longer become
  primary, and glow pool and icon share one condition. Editor gestures on touch
  (pinch/pan) landed the same release.
- **Unified device status/activity** (v1.59.0-beta.10; pulse pipeline #98 local): four display
  modes (Icon + state / Icon + state and activity / Value + state / Always static icon),
  one semantic resolver for yellow
  actual work, orange open/unlocked, unavailable and always-red alarms;
  activity projects to three finite waves for a short event or one continuous
  pulse for presence, mechanical travel and running. Always-static deliberately suppresses every state-driven visual,
  satellite badge and live vacuum overlay while leaving hover, actions, Glow and
  controls intact. Legacy Ripple-only migrates to Icon + activity on the next save.
- **Passive media lifecycle** (v1.60.0-beta.1): every `media_player`,
  regardless of model, stays neutral while powered or playing and fades to
  the existing unavailable appearance on explicit `off`; transport playback
  is no longer classified as yellow actual work and no new visual state is
  introduced.
- **Unified Background editor** (v1.60.0-beta.1): typed decor model,
  physical cm/in strokes and text size, independent contour/fill opacity, decor+room smart
  magnet, common selection/resize/rotate frame for every decor kind, numeric
  geometry properties, and shared 50-command Undo/Redo. The plan image now has
  an exclusive tool, 0.5 editor de-emphasis elsewhere, independent axes,
  rotation, numeric properties and rotated content bounds. Legacy `width` and
  `plan_scale` remain read-compatible and migrate only through explicit plan
  optimisation. Furniture properties also expose the symbol itself. See
  `DECOR-EDITOR.md`.
- **v1.59.0-rc.1** (2026-08-06): whole-plan lossless optimization with an
  atomic config+layout commit and safe undo; the yellow actual-work plate is
  retained alongside source glow; all Background objects have Select-mode
  double-click properties; View hover highlights every room and reports its
  clean-floor area. Audit fixes add eager activity baselines/source resets,
  lossless legacy live-text editing, exact wall-fragment endpoints/compaction,
  editor-visible virtual walls and prerelease-discovery reporting in CI.
- **v1.59.0-rc.2** (2026-08-06): Plan actions have one meaning each; Room
  outline names the closed-contour tool; one named 50-command Undo/Redo stack
  covers committed plan geometry; positional placement is always grid-bound.
  Glow and toast overlays no longer steal room/tool pointers, View hover covers
  shared thick walls, device Hide/Show is explicit, the static no-op aspect
  field is gone, and the new user guide/product audit replaces archived docs.
- **v1.59.0** (2026-08-06): The stable 1.59 line includes all beta/RC work.
  Room hover follows clean-floor wall faces, including nested contours and
  projected opening gaps. Thick-wall rendering unions each room's own wall
  ring, so one room's floor cannot erase another room's wall or leave white
  slivers at complex crossings.
- **v1.59.1** (2026-08-06): device markers resolve a semantic entity role
  instead of trusting registry order; one light-source resolver now drives
  Glow, Light fill, room statistics, marker feedback and controls. Glow uses
  0.7 opacity. Current dev keeps external `controls` non-spatial: they still
  drive group state, but only a real lamp marker or explicit `is_light` marker
  can place a Glow pool. Compacted real walls retain their correct inner face
  and body at real/virtual T-junctions.
- **v1.59.2** (2026-08-07): every modal uses the shared `hp-dialog` shell,
  backed by Home Assistant's `ha-dialog` with a native demo fallback. Titles,
  modal semantics, initial focus, focus trapping, Escape and restore focus are
  consistent across all editors, nested dialogs and dialog replacement flows.

## Recent milestones (details in CHANGELOG.md)

- **v1.10.0** — audit & refactor: asyncio.Lock around all store writes (race fix, atomic
  `expected_rev`), point `layout/update` instead of full `layout/set` (anti last-writer-wins),
  new `layout/delete`, `safeUrl()` XSS guard, `fetchWithAuth`, KEY_HASS, streaming upload cap,
  card split into modules (`styles.ts` / `types.ts` / `devices.ts`), dynamic spaces in the GUI
  editor, dead code removed.
- **v1.11.0** — full English translation + en/ru UI localization.
- **v1.11.1** — brand images inside the integration; CI fully green for the first time.
- **v1.11.2** — Description textarea fix in the device dialog.
- **v1.12.0** — Quality Scale conformance: runtime_data, test-before-setup, unloading,
  single_config_entry, Store migrations hook, diagnostics, repairs, system health,
  uninstall cleanup, HA-harness tests in CI, quality_scale.yaml.
- **v1.13.0** — universality: floors-import wizard, editable icon rules (+device_class
  fallback), tap actions with a security model, i18n dictionaries in JSON, light-theme pass.
- **v1.13.1** — distribution: synthetic-home demo GIF in the README, issue templates,
  CONTRIBUTING.md, Discussions. Forum/Reddit drafts are in the user folder
  (`posts_drafts.md`) awaiting manual posting.
- **v1.13.2** — audit round 3: buildDevices unit-test suite, multi-placeholder t(),
  conflict resync in _saveConfigNow, pointercancel long-press fix, repairs re-check
  on config save (repairs.py).
- **v1.13.3** — privacy: legacy real-house assets/ removed; README screenshots synthetic.
- **v1.14.0** — per-space display settings (borders/names/color/opacity/fills),
  draggable room labels, hand-drawn spaces (no image required), demo/ harness in-repo,
  docs/TESTING.md manual checklist (update with every functional change!).
- **v1.15.0** — temperature room fill (blue/green/yellow) with editable comfort bounds.
- **v1.15.1** — display-settings UX: radio fill selector, inline compact bounds
  (with the Number('')→0 bound-collapse bug fixed), avg room temp in the tooltip,
  darken-on-hover, wider space dialog.
- **v1.15.2** — fix: average room temperature (fill + tooltip) counted non-thermometers
  (fridges/TRVs/chip `*_device_temperature`/diagnostic); now thermometer/air-monitor only.
- **v1.15.3** — fix: device icon badge sat 1 px off its anchor (content-box + 1 px
  border); `box-sizing: border-box` centres it exactly on the device point.
- **v1.15.4** — fix: real `ha-icon` (block + big line-height) put the glyph ~1.8 px low;
  `.dev ha-icon` is now a zero-line-height flex box. Reverted v1.15.3 border-box (shrank the
  badge). Verified live. Demo stub made faithful so the smoke guards it.
- **v1.15.5** — fix: room hover was always grey; legacy overlay/yard hover rules scoped
  with `:not(.styled)` so filled rooms darken their fill, unfilled ones grey.
- **v1.15.6** — room hover also reveals the border (stroke colour kept, hidden via
  opacity) even when borders are off.
- **v1.16.0** — NEW read-only `houseplan-space-card` (static single-space schematic,
  pointer-events:none, deep-link button) + `#space=<id>` deep-link in the full card; shared
  space-geometry/space-render + module-level config cache (config-store).
- **v1.16.1** — space-card renders room fills as configured on the full card (snapshot),
  no longer omitted; +shared areaLqi().
- **v1.17.x** — entity markers get auto icon/temp (issue #1); correct resource URL documented
  (issue #2); humidity badge (gated on device_class, not the icon).
- **v1.18.x** — live ruler while drawing rooms (metres / feet+inches) + per-space scale
  `cell_cm`; visibility fix (the badge lived in the markup-hidden devlayer).
- **v1.19.0** — a line is never an entity of its own: walls derived from room outlines
  (`roomEdges`), unfinished contours persist nothing, Erase tool removed, `space.segments`
  stripped on save.
- **v1.20.0** — rooms may not overlap (strictly-inside clicks refused, overlapping contours
  refused at close; shared walls stay legal).
- **v1.21.x** — merge & split rooms (boolean geometry via polyclip-ts; merge = union collapses
  to one hole-free outline; split = wall-to-wall chord, bigger part keeps identity) + UX fixes.
- **v1.22.0** — presence ripples (badge/ripple/icon_ripple + colour/size, `isActiveState`),
  per-device icon size/rotation (`--dev-size`), one-click HACS badge. NOTE: sources were lost
  in a sandbox reset after deploy and restored from conversation patches — push immediately
  after building, never wait for verification.
- **v1.23.0** — doors & windows: "Opening" markup tool (snap onto derived walls, absolute
  coords), length in real cm, contact sensor + lock, animated leaf/arc, padlock badge, status
  card; lock never toggled from the plan.
- **v1.23.1** — openings UX: hover outline + grab cursor, drag along walls (angle normalized
  to [-90,90) so the hinge never flips), click=status / double-click=properties, thicker hit
  strip. Release v1.23.1 published on GitHub (covers v1.22.0–v1.23.1).

## Where things live

- **Source of truth:** the git repo (GitHub `main`). In a sandbox session: clone from GitHub or
  from `houseplan-card.git.bundle` (kept fresh in the user folder root *and* in `houseplan-card/`).
- **User folder** `houseplan/houseplan-card/` — a file mirror of the repo (synced after every
  commit; the mount cannot delete files, so a few stale artifacts linger — git is authoritative).
- **Production config:** server-side on the HA instance, `.storage/houseplan.config` +
  `.storage/houseplan.layout` (backups `.bak-v1100` exist on the box).

## Open items / watchlist

0. **Canonical backlog** — [GitHub Issues](https://github.com/Matysh/houseplan-card/issues)
   contain task scope and acceptance criteria; their **labels** carry priority
   and workflow status (`PROCESS.md` §9). GitHub Projects is no longer used.
   The former local product plan is preserved only as a snapshot at
   [`legacy/docs/PRODUCT-IMPROVEMENT-PLAN.ru.md`](../legacy/docs/PRODUCT-IMPROVEMENT-PLAN.ru.md)
   and must not be updated or used as a backlog.
1. **hacs/default PR #9004** — accepted by the bot into the review queue ('New default
   repository' label). Minor issues ⇒ the bot drafts the PR (fix and re-ready).
2. GitHub auth: fine-grained PAT (Contents R/W, issued 2026-07-23) in the sandbox
   `~/.git-credentials`; pushes go over SSH with the `ha_jb` key. The old classic PAT
   expired and is gone.
3. Privacy: legacy real-house plan sources (`assets/`) and screenshots were
removed from the current tree. Public documentation images are generated
   from synthetic fixtures by the `Docs screenshots` workflow, accepted with `npm run docs:accept -- --reviewed`, and indexed in
   `docs/images/screenshots.json`. Old images persist in git history and release
   archives; history rewrite is deliberately not done because it would break
   release tags and HACS installs.
4. Stale files on the mount that cannot be deleted from the sandbox: `src/data/` leftovers,
   `brand_preview.png`, old nested bundle copies — ignore, git is authoritative.
5. Roadmap: phases 7–10 are DONE (v1.12.0 quality scale, v1.13.0 universality,
   v1.13.1 distribution). Next candidates: measure backend coverage (>95% goal);
   mypy strict.
6. The public-doc screenshot harness is versioned in `demo/docs/capture.mjs` and
   reuses the production component plus deterministic golden fixtures.

## How to resume work in a fresh session (checklist)

1. Read this file, then CHANGELOG.md (top entries), DEVELOPMENT.md (environment gotchas).
2. Restore the repo: `git clone <user-folder>/houseplan-card.git.bundle hpcN` in `/tmp`
   (files from *previous* sandbox sessions in `/tmp` belong to `nobody` and are unreadable —
   always clone into a fresh directory; `npm ci` again).
3. Deployment needs the `ha_jb` SSH key — it lives in the user folder at
   `houseplan/.secrets/ha_jb` (outside git) and often survives in the sandbox home
   `~/.ssh/ha_jb`; copy with chmod 600. Only ask the user if both are gone.
4. Build only in `/tmp` (never on the mount), `npm run build` (starts with `tsc --noEmit`),
   md5-verify after every deploy, restart HA via
   `nohup ha core restart >/dev/null 2>&1 </dev/null &` (otherwise the SSH session hangs).
5. GitHub pushes: SSH remote with the `ha_jb` key; API releases with the fine-grained
   PAT from `~/.git-credentials` (see the watchlist).

## Product scope

docs/SCOPE.md (fixed 2026-07-22) is the guard rail for all feature work: mission,
personas, jobs J1–J7, partial/out-of-scope lists, excess audit. Check it before
accepting or proposing any feature.
