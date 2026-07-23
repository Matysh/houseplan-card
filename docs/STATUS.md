# Project status & session context

> **Purpose of this file.** Cowork/AI sessions lose context (overflow, new session).
> This file is the **first thing to read** when resuming work. It captures the current
> state, where everything lives, and how to continue safely.
>
> **Documentation policy (mandatory):** every change is documented *in the same
> commit* — CHANGELOG entry for anything user-visible, STATUS.md for state changes
> (versions, publication, infrastructure), DEVELOPMENT.md for new gotchas,
> ARCHITECTURE.md for design changes, ROADMAP.md when plans move.

## Snapshot (2026-07-24)

| Item | State |
|---|---|
| Version | **v1.41.0** everywhere (manifest, const.py, package.json, CARD_VERSION); deployed to the home instance |
| Workflow | Since 2026-07-22: minor changes go to branch **`dev`** (build + smokes → deploy home → commit → push, NO release); releases are batched on the owner's command (merge dev→main, one tag, one release with a summary changelog, CI checked on dev beforehand) |
| GitHub | https://github.com/Matysh/houseplan-card — `main` = releases up to **v1.40.1**; `dev` ahead with v1.40.2+ (speaker icons, kiosk). Push via SSH key `ha_jb` (remote git@github.com:…); API releases via the fine-grained PAT in `~/.git-credentials` (Contents R/W, issued 2026-07-23) |
| CI | validate.yml (hacs + hassfest + frontend + backend) green; release.yml attaches the bundle on release publish |
| HACS | Custom repository works. **Inclusion PR: hacs/default#9004** — open, valid, labeled; ~864 older open PRs but merge rate ≈180/mo; realistic ETA 1–3 months (checked 2026-07-24) |
| Home instance | ha.jbstudio.pro (SSH port 323, key `ha_jb`), deployed **v1.41.0** via direct copy (HACS custom repo also installed) |
| Localization | UI en/ru (src/i18n/*.json), everything user-visible localized incl. kiosk popover |
| Tests | 111 frontend (node:test) + 12 pure backend + 12 HA-harness (CI, py3.13); ~30 demo smoke suites (headless chromium) |
| Product scope | docs/SCOPE.md (2026-07-22) is the feature guard rail — check before accepting any feature |

## Current feature surface (since the 2026-07-17 snapshot)

- **Three editors + View**: Plan / Devices / Background (decor layer v1.33) as
  tabs with an X to close; View is the default; nav (space+mode) persists
  across reloads (v1.38.2). **Kiosk mode** (v1.41.0): `kiosk: true` — no
  header/editors, swipe between spaces, double-tap zoom reset, `cycle: N`
  carousel, per-screen size multipliers in localStorage.
- **Glow fill** (v1.35–v1.37): dark house + per-source light pools (rgb/color
  temp/default; per-source radius), door sectors, open boundaries
  (`room.open_to`, virtual walls, dashed, transitive light zones).
- **Real switches** (v1.36): `marker.controls[]` group-toggle with HA-group
  semantics; icon mirrors targets; hidden grouped lamps fixed (tiered
  primaryEntity). **Lights toggle by default** (v1.39): primary domain light
  → tap toggles, kettle-style devices keep the card default.
- **Plan geometry**: polyline split (v1.32), island rooms w/ evenodd holes
  (v1.34), smart guides + 45° angle badge (v1.40), opening hover preview.
- **Rooms**: room cards with metrics (temp/hum/lqi/light "1 of 3") and
  proportional resize (v1.31); link icon to the HA area (v1.40.1, room taps
  removed). **New-device red dot** (v1.29), lock action button (v1.30).
- **Dialog UX**: binding radios + entities checkbox + search dropdown
  (v1.38.0); tap actions simplified to Device card / more-info / Toggle,
  right-click → more-info (v1.38.1); Esc closes every dialog (v1.30.4).

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

1. **hacs/default PR #9004** — accepted by the bot into the review queue ('New default
   repository' label). Minor issues ⇒ the bot drafts the PR (fix and re-ready).
2. GitHub PAT `houseplan-card-publish` (repo+workflow) expires ~2026-07-12; in sandbox
   `~/.git-credentials`. Revoke after the HACS queue clears, or re-issue when needed.
3. Privacy: legacy real-house plan sources (`assets/`) removed from the tree in
   v1.13.3, but they persist in git history and old release archives; 8 README
   screenshots in docs/images are still from the real house (replacement with
   synthetic ones is a standing watchlist item). History rewrite deliberately NOT
   done — it would break existing release tags/HACS installs.
4. Stale files on the mount that cannot be deleted from the sandbox: `src/data/` leftovers,
   `brand_preview.png`, old nested bundle copies — ignore, git is authoritative.
4. Roadmap: phases 7–10 are DONE (v1.12.0 quality scale, v1.13.0 universality,
   v1.13.1 distribution). Next candidates: replace the remaining real-house README
   screenshots with synthetic ones; measure backend coverage (>95% goal); mypy strict.
5. The demo harness lives in /tmp/demo (synthetic home: demo.html + capture.mjs) —
   rebuildable from this repo + docs/DEVELOPMENT.md notes; frames → PIL → GIF.

## How to resume work in a fresh session (checklist)

1. Read this file, then CHANGELOG.md (top entries), DEVELOPMENT.md (environment gotchas).
2. Restore the repo: `git clone <user-folder>/houseplan-card.git.bundle hpcN` in `/tmp`
   (files from *previous* sandbox sessions in `/tmp` belong to `nobody` and are unreadable —
   always clone into a fresh directory; `npm ci` again).
3. Deployment needs the `ha_jb` SSH key — ask the user to upload it (uploads are readable
   only in the session they were uploaded in).
4. Build only in `/tmp` (never on the mount), `npm run build` (starts with `tsc --noEmit`),
   md5-verify after every deploy, restart HA via
   `nohup ha core restart >/dev/null 2>&1 </dev/null &` (otherwise the SSH session hangs).
5. GitHub pushes need a PAT (create via the user's Chrome: settings/tokens, repo+workflow scope).

## Product scope

docs/SCOPE.md (fixed 2026-07-22) is the guard rail for all feature work: mission,
personas, jobs J1–J7, partial/out-of-scope lists, excess audit. Check it before
accepting or proposing any feature.
