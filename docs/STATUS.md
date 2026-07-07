# Project status & session context

> **Purpose of this file.** Cowork/AI sessions lose context (overflow, new session).
> This file is the **first thing to read** when resuming work. It captures the current
> state, where everything lives, and how to continue safely.
>
> **Documentation policy (mandatory):** every change is documented *in the same
> commit* — CHANGELOG entry for anything user-visible, STATUS.md for state changes
> (versions, publication, infrastructure), DEVELOPMENT.md for new gotchas,
> ARCHITECTURE.md for design changes, ROADMAP.md when plans move.

## Snapshot (2026-07-05)

| Item | State |
|---|---|
| Version | **v1.15.0** everywhere (manifest, const.py, package.json, CARD_VERSION) |
| GitHub | https://github.com/Matysh/houseplan-card — branch `main`, releases v1.9.3…v1.11.2 |
| CI | `.github/workflows/validate.yml` (hacs + hassfest + frontend + backend) — **fully green** since v1.11.1; `release.yml` auto-attaches the card bundle (needs `permissions: contents: write`, fixed) |
| HACS | Works as custom repository (id 1290210112 on the home instance). **Inclusion PR: https://github.com/hacs/default/pull/9004** (queue ≈2 months as of 2026-07). Lesson: #8995 was auto-closed by hacs-bot — the PR body MUST be their exact template with every checkbox ticked and all 3 links (release, HACS action run, hassfest run); a custom body gets closed without discussion |
| Brands | Ships **inside the integration**: `custom_components/houseplan/brand/{icon,icon@2x,logo,logo@2x}.png` (HA ≥2026.3 local-brands mechanism). home-assistant/brands PR #10700 was auto-closed — that repo no longer accepts custom integrations |
| Home instance | ha.jbstudio.pro (SSH port 323, key `ha_jb`), deployed v1.11.2, installed *via HACS* (custom repo) — updates flow through HACS now |
| Localization | UI en/ru (`src/i18n.ts`), auto by `hass.locale` + `language` card option; codebase and docs are English-first (`README.ru.md` is the Russian copy) |
| Tests | 41 frontend (node:test, incl. a 12-test buildDevices suite on a fake hass) + 10 pure backend (anywhere) + 12 HA-harness backend (CI only, py3.13; skipped locally — sandbox has py3.10) |

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
