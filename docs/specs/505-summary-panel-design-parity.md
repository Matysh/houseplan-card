# #505 — сводная панель: дизайнерский прототип и UX-исправления

Issue: https://github.com/Matysh/houseplan-card/issues/505
Task branch: `issue/505-summary-panel-polish`
Baseline: `dev@abbca50ce732a87b59c8675d394f691738ea0961` (1.73.0-beta.7).
Status: specification; implementation requires independent S4 green verdict.
Owner decision: 2026-09-09, resume after scope extension with designer archive.

## 1. Problem, value and scope

The working #437 panel differs materially from the supplied Dashboard 5 design.
This task fixes the whole visual composition, not just individual CSS defects:
header controls, floating panel and settings dialog. Original four requests remain
mandatory: animated exit, genuinely wide dialog, removal of screen-size controls,
and disabling the mobile option while local show is off.

Value: user 8/10 (readability, predictable layout and consistency with accepted
design); product/maintenance 7/10 (one scoped implementation instead of competing
UI conventions). Complexity 6/10, risk 5/10, P2, bug/polish.
Full track: fails small's complexity/risk <=3 and introduces coordinated contracts
on three surfaces including supported touch; not trivial.

The summary remains read-only current information, per SCOPE's #437 exception.
No arbitrary dashboard/cards/actions, new data source types, config migrations,
camera/layout changes, new panel-placement setting or modification of HA chrome.

## 2. Design authority and reproducible reference

[Designer reference](../design/505-summary-panel/README.md), including original
[index.html](../design/505-summary-panel/reference/index.html), CSS, JS and SVG.
Archive received from owner: `макет.zip`, SHA-256
`bc754c16c9d9fc79dbbf093fcf8e14b96f8826fa01d1f0c8eccf68ab95357e15`.
Open index.html in a browser; press the last header button, then its adjacent gear.
The final Dashboard 5 CSS rules override older demo rules in the same files.

Priority: explicit owner requirements here > current House Plan data/safety/
accessibility contracts > prototype visual and interaction reference > demo
implementation details. Reference JS is not product code or process instructions.
Do not copy demo HA chrome, hardcoded entities/states, demo storage or external
navigation into House Plan.

The intended visual structure is binding; it is not satisfied by retaining the
old generic settings form and changing its width. Permitted adaptations are:
HA theme colours, current font family, readable font sizes, 44px touch targets,
mobile wrapping and existing hp-dialog close/focus/fullscreen conventions.
No global component restyling. Save remains visible (disabled when unchanged),
even if demo accidentally conceals it. Missing-source/loading/conflict messages
use existing product semantics, not invented demo stale-time rules.

### Visual target map (CSS px at normal text scale)

| Surface | Reference | Product target / bounded adaptation |
|---|---|---|
| Header pair | Gear left, sidebar-right right; divider, radius 8; last group | Same icons, order and far-right placement after other View actions; touch area >=44x44, glyphs 18–22; no new buttons outside this pair |
| Selected state | Only show/hide half filled accent | HA primary colour, theme-appropriate foreground; gear remains neutral; hover/focus/disabled unambiguous |
| Floating shell | Inset 12; radius 12; shadow 0 8px 26px at ~16% | Same silhouette, border/shadow hierarchy; safe-area/kiosk control insets take precedence |
| Panel width | Right intrinsic 280–420; bottom intrinsic min 360 | Right min(280, available) to min(420, available); bottom min(360, available), max available; never stretch merely to fill stage |
| Panel header | Separate full-width surface, >=48 height, padding14 | Same; 14–16 text, can wrap long title rather than hide meaning |
| Block area | Muted container padding10, gap9; white cards radius11 | Same two-level surfaces, header divider, rows with last divider removed; adapt colours for dark HA theme |
| Values | Label left, stronger value right | Distinct columns, right alignment, min-width:0; readable 12–14 text, wrapping instead of horizontal overflow |
| Settings shell | 780 wide, radius15, pale body, white header/footer | Target 920, capped by viewport; increased for >=44 controls/readable 14px fields; native and HA shell both sized, not inner min-width |
| Settings body | General-settings card, then Blocks card; padding14–18 | Same cards and hierarchy, block count, nested editor blocks; no detached legacy size section |
| Block header | Grip, square up/down, name, eye; scope beneath | Same order and grouping; scope all/one plus space selector; narrow rows wrap |
| Value row | Grip, square up/down, label, source, remove | Same desktop reading order, aligned row; narrow stacks label/source without hiding controls |
| Add/delete | Dashed add row; outlined delete-block footer | Plus icon, full-row add-value; add-block below list; delete-block separated from reorder |
| Dialog footer | Separate surface/border, right-aligned Cancel/Save | Existing hp-dialog action slots, wraps within available width, no edge clipping |

Use theme-scoped semantic variables backed by HA card/primary/secondary text,
divider and accent colours. Do not bake the prototype cyan into an orange HA theme.
Scope all selectors under summary classes or `hp-dialog[data-kind="summary"]`.
No changes to other editor toolbars, panels or dialogs.

## 3. Controls and panel behaviour

The compound control is the last item in the normal View header action group.
Settings (left) opens the existing shared/local-only dialog; show/hide (right)
uses the designer sidebar-right outline SVG and changes only local show intent.
It stays available for household users, independently of admin edit controls.
Use matching designer gear, eye/eye-off, plus and chevron; semantic arrow/remove
icons share stroke weight. SVG uses currentColor, aria-hidden, explicit viewBox,
width/height; every button has a localized accessible name and focus indication.

In kiosk the pair stays in the existing floating-controls container; the panel
starts below the measured controls. Neither controls nor panel are in zoomwrap.
No refit, camera updates, stage size changes or document scroll on show/hide.

The existing resolver is authoritative: stage width >= height => right, otherwise
bottom. This is not viewport orientation. Preserve safe insets, minimum usable
height, max60% stage height for bottom and mobile/narrow visibility policy.
A panel that cannot fit remains temporarily hidden without changing stored intent.
Probe/minimum-height measurements must reflect the new title/block/row styles.

All blocks are expanded. Shared visibility and all/one-space filters are unchanged.
Separate panel heading remains outside vertically scrolling blocks. Values update
live through existing lifecycle/cache/clock logic. Scroll position is not reset by
unrelated HA state updates. Empty configured panel/space has an explanatory empty
state within the same shell. Long titles/values/units/IDs and 10x20 rows stay bounded.

## 4. Animation lifecycle

Reference motion: opacity + 18px from/to the anchored edge, 190ms ease, both right
and bottom. Bottom retains horizontal centering throughout; no camera animation.
Separate effective visibility/local intent from transient DOM presentation.

Presentation states: hidden -> entering -> visible -> exiting -> hidden.
Normal local off starts exit from current visual progress, immediately inert and
aria-hidden; removal only after opacity exit completion. Local on during exit
reverses from current rendered progress; never rebuild at full opacity first.
Last intent wins and only one panel DOM subtree exists.

A completion callback is generation-scoped and cannot remove a newer panel.
Use filtered transition completion plus a bounded safety cleanup (<=300ms after
normal exit start) so cancelled transition events cannot leave a ghost.
No timers/listeners survive disconnect, identity/config-host change or route exit.

Special cases:
- Reduced motion: no movement or delayed removal; changes to media preference
  during a transition settle to the latest intent.
- Editor entry, route leave/disconnect, unsupported config, or identity change:
  synchronously remove presentation and cancel pending work; no stale private data.
- Document hidden: settle latest intent without replaying a transition on return.
- Resize/narrow/fits makes visible panel ineligible: settle hidden immediately
  (do not draw beyond available bounds); eligible again may enter normally.
- Right/bottom changes mid-transition: cancel old direction/completion and settle
  latest effective state at new anchor; no stale transform or sudden old-location flash.
- Config/space change while remaining eligible updates content in place, no full
  panel exit/enter and no exposure of filtered-out blocks.
- No animation modifies or persists `local.show` by itself.

## 5. Settings interactions and persistence

Keep existing shared draft/revision validation and atomic save/recovery contracts
of #437/#490/#493. Name, block CRUD, value CRUD/source picker, reorder, visibility,
scope, confirmations and errors must remain functional after markup changes.
General settings appear before Blocks. Full editor shows panel name plus local
show and mobile controls as caption/helper/switch rows. Show/mobile retain their
current shared/local ownership (mobile is shared; show is per-user/per-card).

Mobile checkbox has native disabled when `!dialog.localShow` (and while saving).
Its value is not cleared. Reenable restores exact draft value. Master off/on,
Save, Cancel/X/Escape, reopen and reload behave consistently for all four pairs.
Do not optimistically persist either draft toggle while editing.
Non-admin/kiosk/unsupported-config local-only view shows the explanatory hint and
local show only; it must not reveal or mutate shared editor fields.

Remove only the summary dialog's Sizes on this screen header, sliders and reset,
in every locale and local-only mode. Do not remove independent View/kiosk scale
settings elsewhere, normalized storage values or scale application. Retain the
storage-unavailable warning where relevant to local show. Opening/unchanged Save,
title-only edit, show/mobile edit and Cancel never rewrite unrelated scale values.

Block visibility is an eye/eye-off button with aria-pressed and localized action
name. Reordering keeps both drag handles and square up/down alternatives; touch
and keyboard need not drag. First/last buttons disabled. Stable block/value IDs
remain authoritative for picker ownership; deleting/reordering a block cannot
retarget an open picker accidentally. Delete nonempty block confirmation remains.

Picker stays lazy, searchable and bounded to existing 100 matches; one active
picker only. Show friendly label and secondary entity ID (or system-source
caption) in the source button with chevron. Do not regress list keyboard/Escape,
focus return, missing old refs, 10k source indexing, validation or broken-space
warnings. Native and HA modal keyboard trap/close/save-busy semantics remain.

## 6. Responsiveness, a11y and localization

Settings shell: native fallback `wide` plus scoped --hp-dialog-wide-width:920px;
real HA width=medium plus scoped --ha-dialog-width-md:920px (verify actual pinned
HA frontend contract). Avoid changing generic hp-dialog widths. Real HA's native
fullscreen policy at <=450px width or <=500px height is permitted and retained.

At <=800 available dialog width stack general grid and source row fields; at
<=480 stack block header fields/scope, keep action groups usable, preserve DOM
reading order. Use shrinkable grid/flex children and border-box; no min-width
forcing content wider than shell. Vertical body scroll, fixed reachable footer.
320px and 390px, landscape short-height, 200% text, long RU/DE/FR content must work.
All interactive targets >=44x44. Functional visual clipping is not an acceptable
substitute for wrapping; horizontal overflow hidden must not mask inaccessible
fields/buttons. Input labels/accessible names remain associated after regrouping.

Use existing summary, btn and kiosk keys where semantics match; new en+ru+de+fr:
`summary.general_settings`, `summary.blocks`, `summary.blocks_hint`,
`summary.show_local_hint`, `summary.show_mobile_hint`,
`summary.hide_block`, `summary.show_block`, `summary.system_source`.
Reuse localized summary.count if available, otherwise add `summary.block_count`
with count/limit formatting. Remove `summary.sizes_title` only if no remaining
consumer. No data IDs, raw labels or untranslated new user-facing UI.

## 7. Implementation boundaries and performance

Expected files: src/summary-panel-style.ts, summary-panel-editor.ts,
summary-panel-runtime-loaded.ts; small icon/presentation helper(s) if needed;
src/houseplan-card.ts only control order; locale dictionaries; summary tests/
runtime tests; demo/smoke_summary_panel.mjs or focused companion smoke.
No backend/schema/type-model changes required. Config namespace stays version1;
compatibility registry/storage shapes do not change.
Keep summary/editor lazily loaded. No framework, remote icon request or permanent
animation RAF loop. Animate compositor opacity/transform, never dimensions.
No baseline increases, new large eager chunks or broad style recalculation.
Normal gate:small, unit, typecheck, bundle parity/budget, no-new-any and docs gates.
Full release/golden/performance capture is not required for this scoped task.

## 8. Acceptance and evidence

| AC | Required result | Evidence |
|---|---|---|
| AC1 | Compound icons/order/placement/states match §2–3 in View and kiosk | smoke DOM/order/geometry + paired reference/product visual review |
| AC2 | Shell/title/cards/rows/right values match design; right/bottom fit and live/empty states | smoke bounds/content updates + visual review |
| AC3 | Show/hide at190ms, retained inert exit then removal, reversals, one subtree | real-browser smoke sampling opacity/transform and DOM over time |
| AC4 | Reduced motion, resize/anchor change, narrow/fits, editor, hidden document, route/identity/disconnect cannot leave callbacks/ghosts | runtime tests + focused lifecycle browser smoke |
| AC5 | Desktop modal genuinely wide in native and real HA, mobile/200% text no horizontal clipping, reachable footer | native smoke geometry + authentic HA-dialog visual/bounds evidence (stub alone insufficient) |
| AC6 | General/Blocks cards, headers, source rows, eye/reorder/add/delete follow reference | paired visual review + smoke CRUD/reorder/visibility/source/confirm |
| AC7 | Size controls absent; old scale values preserved for admin and local-only paths | runtime + smoke persisted storage comparison |
| AC8 | Mobile disabled under master off, preserved values, four combinations save/cancel/reopen/reload | smoke actual controls/focus and persisted config/local intent |
| AC9 | Permissions, unavailable/future schema, conflict/lost ACK, broken refs, stable picker and 100-row cap remain | existing runtime/unit/summary smoke including 10k entities |
| AC10 | Themes/locales/44px targets/long content/keyboard and camera independence | smoke RU/EN/DE/FR + light/dark + 320/390/desktop, review |
| AC11 | Docs/changelogs current, scoped CSS/lazy budgets/build parity preserved | docs gate, code review, gate:small |

Visual evidence is mandatory: matched 1600x1000 reference and product captures of
control+open right panel and settings, dark desktop, bottom portrait, kiosk; plus
narrow native/real HA settings screenshots. Use equivalent default three values
and one custom-source row. Inspect geometry, hierarchy, glyphs, columns and
allowed adaptations separately from irrelevant background-plan pixels.
Record dimensions and accepted differences; no claim of pixel-identical UI.

These are task diagnostic images, not updates of accepted golden/docs baselines.
Keep portable captures/evidence instructions and reference in task docs; if raster
artifact publishing is needed use the existing Linux CI artifact path. Never
accept Windows screenshots as new canonical baselines. Review must be able to
reproduce the paired UI; automation passing alone is not visual acceptance.

At least one targeted negative witness for expensive smoke: demonstrate
AC3 fails if exit DOM retention is removed and AC5 fails if shell-wide sizing is
removed. Run mutation-gate for the relevant smoke if classed costly; do not
weaken gate assertions or update unrelated golden files to make it pass.

## 9. Risks, rollback, release artifacts

Main risks: fake parity from outer-only styling; real HA vs fallback sizing;
stale animation callback; loss of local/shared ownership; unavailable references
or picker retargeting; touch inaccessible controls after density adaptation.
Sections4–8 provide explicit prevention/evidence. No unresolved product question;
any deviation beyond §2's bounded adaptations returns to owner.

Rollback is revert of task commits plus bundle rebuild/sync; data remains fully
compatible with pre-task client because no format or ownership changes.
Release artifacts: both changelogs with #505; USER-GUIDE.ru.md and .md summary
section update control placement, layout, mobile dependency, removed size controls;
spec index and visual acceptance report. No release/tag/public announcement in
this task; stop at pipeline S8 (merged, waiting for next beta).

