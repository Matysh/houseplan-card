# Dialog CSS ownership (#1019)

Source audit starts at accepted `98e7d8d09ce44742ce6bdd290b487960c76b4b71`
(#1051 and #1054 included). This is the migration record for the existing
[dialog kit](../DIALOG-UI-KIT.md), not a second style system. A matching class
name in a different ShadowRoot is not a consumer. Computed-style and image
evidence belongs to the issue handoff; the source table alone is not visual proof.

## Consumers

`E` below means `src/styles/editor-dialogs.styles.ts`, `S` means
`src/styles/settings-dialogs.styles.ts`, and `A` means the factories in
`src/styles/settings-action.styles.ts`. Settings styles are installed after the
legacy sheet by `src/editors/settings-styles.ts`. More-specific common selectors
win in both constructed-sheet and style-element adoption paths.

| Consumer | Current template and common owner | Local rules and disposition |
| --- | --- | --- |
| General | `src/editors/general-settings-dialog.ts` calls `ensureSettingsDialogStyles`; `.body.hpf-form.hpf-settings-form`, shared navigation and form kit | KEEP north dial, ray/background previews, data actions and subject layout. The shared form already owns control paint. Generic `.namein`/`.areasel` still serve other dialogs. |
| Space | `src/editors/space-settings-dialog.ts`, same adopted form/navigation sheets | KEEP `.hpf-footer-space`, `.hpf-footer-object`, `.hpf-plan-*`, temperature and north geometry. The four-column footer has real consumers without the object/north variant. Uploaded-image preview geometry is not generic form paint. |
| Room | `src/editors/room-settings-dialog.ts`, same shared settings root | KEEP `.hpf-room-metrics`, room grid, `.cardpreview/.cpmeta`, validation and footer geometry. Preview visibility/width is subject-specific; preview classes have other live consumers too. |
| Device | `src/editors/marker-dialog.ts` installs settings sheets before the profile panes | KEEP `.srcrow`, `.dispsection`, profile notes/actions, native `.areasel` and numeric-field widths. The generic `.colorrow .tempin` 72px width still participates in the cascade; the stronger Radar width override must remain. |
| Vacuum | `src/editors/vacuum-settings-section.ts`, `vacuum-maps-section.ts`, shared `formSections`/`disclosure`, `vacuum-settings.styles.ts` | KEEP `.vacbox`, `.vacdiag`, source/map diagnostics, native camera details, missing-route groups and calibration layout. #1051 already removed picker-summary paint and the stale direct-child diagnostics selector; they are not #1019 deletions. |
| Radar | Two `renderRadarSection` calls in `marker-dialog.ts`; both are under `.hpf-settings-pane`. `radar-section.ts` emits active and saved-unsupported fieldsets; `radar-setup.ts` emits the wizard | REMOVE only properties listed below whose actual owner is the stronger S selector. KEEP unsupported-fieldset radius, legend layout, coordinates alignment, numeric width override, calibration SVG/phase/error/trail paint and disabled opacity. |
| Help | `_renderSupportDialog` in `src/houseplan-editor-runtime.ts` installs settings sheets and emits `hp-dialog.ui-dialog` | REMOVE overridden common paint listed below. KEEP link/layout/icon geometry, outcome borders/colours, wrapping and privacy margin. |
| PDF | `src/pdf/hp-pdf-dialog.ts`, its own Lit ShadowRoot; local sheet followed by `settingsActionsCss('button', '.primary')` | KEEP private body/row/checkbox/option geometry and the 360px grid. Shared actions are already composed here. Card-root form selectors cannot style this private root. |
| Device inbox | `_renderDeviceInbox` in editor runtime installs S before `.ui-dialog.device-inbox-dialog`; `device-inbox-batch.ts` returns light-DOM children | REMOVE defeated paint below. KEEP tab scrolling/button flex/counts, subject grids/background/border width/style and mobile placement. `CatalogContextMenu` delegates to `EditorContextMenu`; #1051 already removed the old inline menu, so no second removal is claimed. |
| Icon rules | `_renderRulesDialog` in editor runtime installs S before `.ui-dialog.rules-dialog`; actual actions are `button.btn.ract` | REMOVE only defeated properties below. KEEP invalid resting border, destructive hover, alignment, flex values and bounded icon variable. |
| Confirmations | `src/hp-confirm.ts` renders light DOM into the card; eager `dialogs.styles.ts` serves View too. Raw room/partition confirmations lack `.ui-dialog` | KEEP `.danger-confirm-footer`, `.dialog-action-*`, `.tapconfirm-*` and 480px grid. Settings style adoption cannot be assumed on these View paths. |

## Properties now owned by the common sheet

Each row identifies the exact legacy property removed and its current consumer.
Unlisted properties of these selectors remain local.

| Legacy selector in E | Removed properties | Winning common selector / reason |
| --- | --- | --- |
| `.markerlightgroup` | min-width, margin, padding, border | S `.hpf-settings-pane .radargroup`, on both actual fieldsets; border-radius remains for the unsupported fieldset without `.hpf-card`. |
| `.markerlightgroup legend` | padding | S `.hpf-settings-pane .radargroup > legend`; keep flex/wrap/gap/colour/weight. |
| `.radargroup` | display | S `.hpf-settings-pane .radargroup` sets block; keep gap, even though currently inert in block layout. |
| `.radaradditional > .markerlightgroup` | margin-top (whole rule) | S `.hpf-settings-pane .radargroup` has equal specificity and later order. |
| `.radarcoordinates` | flex-wrap | S `.hpf-settings-pane .radarcoordinates`; local `align-items:flex-end` remains. |
| `.radarcoordinates > label` | flex, min-width, margin | S coordinates label owns flex/min-width; shared form-kit label owns margin. Keep grid/gap. |
| `.radarsetup-head` | align-items | S `.hpf-settings-pane .radarsetup-head` sets start. Keep flex display/gap and strong child's flex. |
| `.aboutver` | font-size, colour, margin (whole rule) | S `.ui-dialog *:is(.aboutver,.rhint)` and `.ui-dialog .aboutver`. |
| `.aboutlink` | gap, colour, text-decoration, font-size, padding | S `hp-dialog.ui-dialog .aboutlink`; keep flex/alignment/fit-content width and the 18px child icon. |
| `.aboutver .aboutlink` | font-size, padding | S same descendant under `hp-dialog.ui-dialog`; keep inline display. |
| `hp-dialog .supportbody` | min-width, overflow (whole rule) | S `hp-dialog.ui-dialog *:is(.body,.device-inbox)` owns both on actual `.body.supportbody`. |
| `.supportsection` | gap | S `hp-dialog.ui-dialog .supportsection`; keep grid and min-width. |
| `.supportsection + .supportsection` | padding-top, border-top (whole rule) | S same descendant under `hp-dialog.ui-dialog`. |
| `.supportsection h3` | margin, font-size | S same descendant under `hp-dialog.ui-dialog`; keep heading colour. |
| `.supportlinks`, `.supportactions` | gap | S `hp-dialog.ui-dialog *:is(.supportlinks,.supportactions)`; keep flex/wrap/alignment/min-width. |
| `.supportform > label:not(.srcrow)` | margin-top, colour, font-size (whole rule) | S same descendant under `hp-dialog.ui-dialog`. |
| `.supportmessage`, `.supportraw` | min-width, box-sizing, border, radius, padding, colour, background, font | S `hp-dialog.ui-dialog *:is(input[type=text],input[type=search],.supportmessage,.supportraw)`; keep width/resize. |
| `.supportmessage` | min-height, background (whole rule) | Same common input rule plus S `textarea.supportmessage`. |
| `.supportraw` | min-height, font-family, font-size | Common input rule plus S `textarea.supportraw` owns the 220px/monospace result; keep margin, whitespace/overflow and resize:none. |
| `.supportattach` | align-items, margin!important | More-specific S `.supportattach` owns both, including its important margin; keep min-width. |
| `.supportwarning`, `.supportstatus`, `.supportupdate` | margin, padding, radius, background, font-size, line-height | S same `:is` group and `.supportupdate` override; keep flex/alignment/gap/min-width/wrapping. |
| Their `ha-icon` descendants | colour, --mdc-icon-size | S same group/descendant; keep flex:none. |
| `.supportpreview`, `.supportmanual`, `.supporterror`, `.supportsuccess` | gap, padding, radius | S same `:is` group; keep grid/min-width/border width+style and outcome border/background colours. |
| `.supportpreview summary` | cursor | S calls `settingsInteractiveCss` on this actual summary; keep resting accent colour. |
| `.supportprivacy` | line-height | Actual `<p class="rhint supportprivacy">` matches S `hp-dialog.ui-dialog *:is(.aboutver,.rhint)` at 1.45; keep margin:0!important. |
| `.supportfooter` | flex-wrap (whole rule) | S `.row[slot=footer]` owns this on the actual footer. |
| max-width:520px `.supportactions .btn,.supportactions .aboutlink` | max-width (whole rule) | A common button base and S common link own 100% at every width. |
| `.rtest` | gap, margin-bottom | S `hp-dialog.ui-dialog .rtest`; keep flex/alignment. |
| `.rtest .namein` | flex (whole rule) | S same descendant, now 1 1 280px. |
| `.rrow` | display, gap, margin | S `.rrow`, last-of-type and mobile rules; keep align-items and child flex values. |
| `.rrow .rprev` | --mdc-icon-size | S `.rprev` directly owns actual `ha-icon` at 22px; keep colour/min-width. |
| `.rrow .ract` | colour, cursor | S `.ract.btn` and A enabled/disabled action cursors own all actual buttons. Keep the button's own 16px variable and hover rules. |
| `.device-inbox` | gap, padding, min-width | S body plus `.device-inbox` and mobile body rules; keep column flex layout. |
| `.device-inbox-dialog` | --hp-dialog-wide-width (whole rule) | S `hp-dialog.ui-dialog.device-inbox-dialog` owns 920px. |
| `.device-inbox-search` | min-width, box-sizing, border, radius, background, colour, font, padding | Actual `input[type=search]` matches stronger S common input selector; keep width:100%. |
| `.device-inbox-tabs` | gap, padding-bottom | S `.device-inbox-tabs`; keep display, overflow, scrollbar and child flex/count paint. |
| `.device-inbox-discovery` | padding, radius | S same descendant; keep details margin and border (the summary is a different element). |
| `.device-inbox-discovery summary` | cursor | S/A interactive factory; keep font-weight. |
| `.device-inbox-chips .chip button` | border, padding, cursor | S child button plus interactive factory; keep resting background/colour and parent capsule. |
| `.device-inbox-excluded input[type=text]` | min-width, padding, border, radius, background, colour | S common input selector `(0,2,2)` beats old `(0,2,1)`; keep flex:1 1 140px. |
| `.device-inbox-filters label` | gap | S same descendant under `hp-dialog.ui-dialog`; keep display/alignment/cursor. |
| `.device-inbox-batch-actions`, `.device-inbox-actions` | gap | S exact `:is` group; keep all other flex/wrap/alignment/min-width. |
| `.device-inbox-row` | gap, padding, border-colour, radius | S same descendant; retain border-width/style separately, subject grid/alignment/min-width/background and selected/mobile variants. |
| `.device-inbox-actions .btn` | min-height, padding (whole rule) | A `hp-dialog.ui-dialog .btn` is stronger than old two-class rule. |
| max-width:680px `.device-inbox` | padding (whole rule) | S body rules win on both sides of the common breakpoint; retain other legacy mobile geometry. |

Important retained cascade: `hp-dialog .body .radarcoordinates .tempin`
has specificity `(0,3,1)` and preserves 100% width/box-sizing against the old
72px colour-field rule. The weaker common `.hpf-settings-pane .radarcoordinates
input` cannot replace it. `.rrow .rpat.bad` still wins resting invalid colour;
the host-qualified destructive hover is also stronger than the common hover.
An inert declaration or an inherited value overridden on a child is not, by
itself, proof of identical computed properties on the original owner.

## Originally reported orphan candidates

| Candidate | History/current consumer | Disposition |
| --- | --- | --- |
| Card `.menuwrap`, `.menu`, `.menu .hd/.it` subtree | `6a9122f41` replaced the old card menu with `hp-dialog`; current `.menu` in `hp-settings-select`/panel has its own ShadowRoot/sheet | REMOVE exact chrome subtree and its hover rule, not component menus. |
| `.decorbar .dcolor/.dwidth` | `29fb9deb4` retired those controls; current controls use form kit/Properties | REMOVE exact chrome rules. |
| `.editbar .sname` | `3baf3c8be` retired the old editbar markup | REMOVE exact chrome rule. |
| `.rlgear` and hover | `a841d1754` replaced it with `.rlgearbtn/.rlgeartext` | REMOVE exact old class; KEEP button/text and neighboring `.rlgo`. |
| `.slide-left/.slide-right`, `hp-slide` keyframes | `_slide` still emits the finite classes and applies their animation | KEEP both classes/keyframes; record the producer, not every TS string. |
| `.drop-before/.drop-after` | Current tab drag emits `drop-${placement}` only for moved target with before/after placement | KEEP both finite values. |
| `.kind-palette/.kind-group` | `EditorSecondaryKind` and the secondary controller emit `kind-${kind}` on the real host/panel | KEEP both values; absence of literal complete markup is not orphan evidence. |

Additional finite definitions discovered by the scanner in the extras factory
`src/styles/form-kit.styles.ts` have no remaining product producer. The factory
spells them as `.${p}-suffix`, with `CARD_DIALOG_FORM_KIT` emitting `hpf`.

| Retired family | Last producer/history | Disposition |
| --- | --- | --- |
| `hpf-signal-visibility` | `acd2e6685` replaced the space radio wrapper with the current segmented form | REMOVE the label-size rule; current signal controls retain their form-kit targets. |
| `hpf-headline` | `f50bc224c` removed the old Room heading/reset row | REMOVE its flex rule; current field headings/reset links are separate shared primitives. |
| `hpf-north`, `hpf-north-n` | `acd2e6685` removed the old space compass grid; current `settings-north.ts` emits `hpf-north-control/dial/values` | REMOVE four exact old grid/child rules. KEEP the distinct live `hpf-compass`, `hpf-unset` and new north-control rules. |
| `hpf-templegend` | `5f93e1b23` retired the Room temperature legend | REMOVE its flex/typography rule; current comfort fields and range-end labels remain. |
| `hpf-actionrow` | `bf6602bbd` added the extras rule; no product markup/helper ever emits this exact class | REMOVE the unused generic row; actual `hpf-actions` and `hpf-action-help` are distinct live consumers. |
| `hpf-iconclear` | `0b5db4c2a` replaced the old separate Device icon-reset button | REMOVE the unused button rule; the current icon picker/control owns its reset. |
| `.habindingbanner.limited` and its icon descendant | `bf6602bbd` removed the old unverified-registry banner variant | REMOVE both exact rules. KEEP the current ordinary `.habindingbanner` for orphan/jamb warnings; `ha-binding-status` data value `limited` is not a DOM class producer. |
| `.iso-shadows` selector branch | `5cae93501` retired the old `<g class="iso-shadows">` renderer | REMOVE only this branch of pointer-events:none. KEEP `.iso-shadows-svg` and all other current layer classes. |
| `.stage.edit .room` | `c6826af74` removed `_edit` and the stage `edit` class; current modes are explicitly named | REMOVE the unreachable old room rule. This does not change current Plan/Devices/Decor selection policy. |
| `.physical-chrome .stem` selector branch | `164d70cb2` renamed the actual column rotation line to `dtstem` | REMOVE only the old branch; retain `.physical-chrome .frame` paint and the current rotation stem's existing owner. |
| `.stage.markup.tool-partition` selector branch | `normalizeMarkupTool` runs `normalizeUnifiedWallTool`, which converts legacy `partition` to `draw` before current stage rendering | REMOVE this old branch; KEEP `.tool-column` and current unified wall-tool classes. No persisted token migration changes. |

The historical `test/fixtures/form-kit-card-dialog*.css` files are retained.
Their byte-comparison test projects out only these nine named retired rules;
every other byte is still checked against that frozen source. The actual
summary-panel sheet retains its existing byte-for-byte comparison unchanged.

Finite source annotations for irreducible class/keyframe production follow the
schema documented by `scripts/css-source.mjs`. They name the actual producer,
exact emitted values and a reason. Query-only references, import paths, comments,
CSS selectors, IDs and arbitrary string constants are not consumers. The scanner
is a development check; it makes no claim about cascade or visual equivalence.

The annotations live at seven actual render statements: Properties catalog
groups/actions (`renderPropertiesSurface`), the three presentation faces
(`HouseplanCard._renderDevice`, `HpDevicePreview.render`, `renderSpaceStatic`),
the two-call-site shadow twin (`renderIsoTileShadow`), door/window opening
surfaces (`renderIsoWalls`), and the local mount/reference/pending wizard glyphs
(`RadarSetupController.render`). Each list is finite and attached to its named
producer; changed prefixes/owners, unused annotations and wildcards fail the
check. Renderer comments add no runtime classifier or configuration field.
