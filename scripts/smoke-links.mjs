/**
 * Явные связи «символ или файл продуктового кода → browser-smoke» (#241, #772).
 *
 * Зачем реестр вообще нужен. Смоки не импортируют исходники: они грузят
 * собранный бандл и работают через DOM и приватные поля в `page.evaluate`.
 * Поэтому граф импортов их не свяжет, а совпадение идентификаторов находит
 * только те смоки, которые называют затронутый символ своим именем. Смок,
 * проверяющий тот же контракт через другое поле, не найдётся никаким поиском —
 * и ровно на таком смоке #234 потерял регресс.
 *
 * Что сюда попадает. Связь, которую нельзя доказать текстом: смок проверяет
 * следствие контракта, не называя ни одного изменённого символа. Каждая запись
 * обязана объяснять, ЧТО именно проверяет смок — иначе реестр превращается в
 * список суеверий, который никто не решается почистить.
 *
 * Чего сюда писать НЕ надо. Связи, которые и так находятся по имени: запись
 * рядом с прямым совпадением делает вывод selector'а неотличимым от «нашли
 * потому что записали», и тест начинает проходить по неверной причине.
 */

/**
 * @typedef {object} SmokeLink
 * @property {string[]} [symbols] Изменённые символы, включающие связь.
 * @property {string[]} [files] Точные пути файлов без символов (CSS). Дополняют
 * выборку, но сами по себе не отменяют визуальный минимум: файл шире контракта.
 * @property {string[]} smokes  Файлы в `demo/`, без пути.
 * @property {string}   because Что смок проверяет и почему поиском не найдётся.
 */

/** @type {SmokeLink[]} */
export const SMOKE_LINKS = [
  {
    files: ['src/zigbee-topology-endpoint.ts', 'src/hp-zigbee-topology-overlay.ts',
      'src/device-hit-owner.ts', 'src/led-strip-runtime.ts'],
    smokes: ['smoke_zigbee_led_topology.mjs'],
    because: '#1004 native SVG hover, live-camera coordinates, real LED shape/alpha and a fixed screen halo are observable through painted endpoints and public pointer/config input, not helper names.',
  },
  {
    files: ['src/device-signal-runtime.ts'],
    smokes: ['smoke_direct_signal_lifecycle.mjs', 'smoke_direct_zigbee_lqi.mjs', 'smoke_view_recovery.mjs'],
    because: '#1053: public full/space lifecycle and actual direct-reading DOM must retain one shared feed, reject late detached HA assignment and reconnect. Generic recovery separately preserves exact mandatory transports and held canonical authority; its metadata distinction is observable only at the transport boundary.',
  },
  {
    files: ['src/houseplan-card.ts', 'src/card-read-lifecycle.ts'],
    smokes: ['smoke_detached_authority.mjs', 'smoke_view_recovery.mjs'],
    because: '#1054: public remove/hass/append must preserve the current mandatory read intent after foreign authority retirement, including a reused HA object and coalesced ABA; existing recovery protects same-context no-reload and stale read fencing.',
  },
  {
    files: ['src/editors/form-kit.ts','src/styles/form-kit.styles.ts'],
    smokes: ['smoke_ui_1051.mjs'],
    because: '#1018: the real Properties consumer retains nested raw HEX/alpha input, invalid draft, Escape, atomic save and Undo after removing the unrelated top-level legacy opacity callback.',
  },
  {
    files: ['src/editor-context-menu.ts','src/editor-context-menu.styles.ts','src/catalog-context-menu.ts','src/editors/properties/color-draft.ts',
      'src/editor-secondary.styles.ts','src/editors/properties/surface.ts','src/editors/properties/selection.ts'],
    smokes: ['smoke_ui_1051.mjs','smoke_ui_1051_native.mjs','smoke_properties_panel.mjs','smoke_decor_order.mjs','smoke_device_copy.mjs','smoke_ui_polish_976.mjs'],
    because: '#1051: real selected surfaces exercise atomic inline colour preview/commit/Undo, hit cursor and common menu input retirement; existing command smokes retain persisted command and stale-authority coverage.',
  },
  {
    files: ['src/editors/disclosure-motion.ts','src/styles/dialog-composition.styles.ts','src/styles/form-kit.styles.ts'],
    smokes: ['smoke_zigbee_incomplete_reasons.mjs','smoke_dialog_ui_kit.mjs','smoke_ui_polish_976.mjs'],
    because: '#1051: common disclosure keyboard/retarget/reduced motion and typography, link hover and dialog body bounds require mounted computed style and real scroll ownership.',
  },
  {
    symbols: ['syncNative', 'selectedTextId', 'measureHouseplanDecorText'],
    smokes: ['smoke_decor_creation_selection.mjs', 'smoke_properties_panel.mjs'],
    because: '#1047: real creation gestures compare the newest native ID, Properties owner, painted frame and subsequent property write; existing Properties smoke protects field completion, width transitions and the other editors.',
  },
  {
    files: ['src/editors/decor/line-drawing.ts'],
    smokes: ['smoke_decor_line_click.mjs'],
    because: '#1046: real stage pointer/click and keyboard delivery must preserve one persisted segment per clean click, exact Shift preview, active history anchor and safety across navigation/field/context cancellation.',
  },
  {
    files: ['src/pdf/svg-snapshot.ts'],
    smokes: ['smoke_room_metrics_alignment.mjs'],
    because: '#1039: compare text/readings centres in real offline SVG downloads after chrome removal, while preserving live captions with an Area action; computed source styles alone cannot prove the exported layout.',
  },
  {
    files: ['src/decor-order-editor.ts', 'src/editors/decor/order.ts'],
    smokes: ['smoke_decor_order.mjs'],
    because: '#1035: real panel/menu actions must change visible overlap, selection and persisted order, preserve one-step history, share image assets and reject retired callbacks without entering a drawing gesture.',
  },
  {
    files: ['src/pdf/svg-snapshot.ts', 'src/pdf/export-options.ts', 'src/pdf/hp-pdf-dialog.ts', 'src/pdf/pdf-export.ts'],
    smokes: ['smoke_svg_export.mjs', 'smoke_pdf_export.mjs'],
    because: '#1036: real format selection/download must retain PDF and produce the standalone View SVG; offline screenshot comparison and options/errors cannot be inferred from helper names.',
  },
  {
    files: ['src/room-appearance.ts','src/editors/space-dialog-draft.ts','src/editors/space-form.ts',
      'src/editors/room-settings-dialog.ts','src/editors/room-save.ts'],
    smokes: ['smoke_room_appearance.mjs','smoke_e2e_hooks.mjs'],
    because: '#1037: semantic colour hosts must drive actual draft/accepted caption and wall paint; the smoke observes computed CSS, real shared picker inputs, local/room inheritance and transfer-neutral unrelated floors.',
  },
  {
    symbols: ['_renderWallThickDialog', '_renderDrawWallControl', '_renderOpeningDialog', '_renderDiscoveryFilters'],
    smokes: ['smoke_wallthick_standalone.mjs', 'smoke_e2e_primitive_fields.mjs', 'smoke_opening_entity_search.mjs', 'smoke_discovery_filters.mjs'],
    because: '#1011 r3: semantic field ids must identify the bound physical dimension, opening picker or discovery setting; real inputs and existing wire/Undo/Cancel checks prove more than the presence of a field hook.',
  },
  {
    files: ['src/editors/form-kit.ts', 'src/editors/settings-sections.ts', 'src/hp-color-opacity.ts',
      'src/device-contact-render.ts', 'src/wall-node-editor.ts', 'src/glow-scene.ts',
      'src/summary-panel-runtime-loaded.ts', 'src/pdf/hp-pdf-dialog.ts', 'src/toast-presentation.ts'],
    smokes: ['smoke_e2e_hooks.mjs', 'smoke_e2e_primitive_fields.mjs'],
    because: '#1011: the declared hooks must identify real mounted controls, geometry and live owner results, including nested custom-element roots and modal toast routing.',
  },
  {
    files: ['src/marker-deletion.ts', 'src/geometry-history-step.ts', 'src/wall-node-history.ts',
      'src/wall-node-card-adapter.ts', 'src/toast-presentation.ts'],
    smokes: ['smoke_device_inbox_delete.mjs', 'smoke_node_history_context.mjs'],
    because: '#1011 AC4: known keys must reach the mounted toast after a real deletion/refusal or history operation, across forwarding ports; presenter-only units cannot prove the caller boundary.',
  },
  {
    files: ['src/vacuum-trail-style.ts', 'src/styles/vacuum-settings.styles.ts'],
    smokes: ['smoke_vacuum_style_1002.mjs', 'smoke_vacuum.mjs'],
    because: '#1002: mounted SVG ink, previous-run fading and camera invariants are observed without importing the style model. Authentic HA dialog acceptance additionally runs demo/ui-lab/verify-vacuum-1002.mjs.',
  },
  {
    files: ['src/hp-zigbee-topology-settings.ts', 'src/zigbee-topology-diagnostics.ts', 'src/zigbee-provider-routes.ts', 'src/zigbee-topology.ts'],
    smokes: ['smoke_zigbee_incomplete_reasons.mjs'],
    because: '#1005: public provider events and settings controls prove source-scoped reasons and their native footer presentation without importing the model.',
  },
  {
    files: ['src/editors/form-kit.ts', 'src/styles/dialog-composition.styles.ts', 'src/styles/settings-dialogs.styles.ts', 'src/hp-help.ts'],
    smokes: ['smoke_dialog_ui_kit.mjs'],
    because: '#1007: rendered section geometry, conditional omission, preserved draft, independent Help hover/click and disclosures across themes and narrow viewports; a string-level import match does not prove these outcomes.',
  },
  {
    files: ['src/dialog-presence.ts', 'src/dialog-exit.ts', 'src/dialog-return-focus.ts', 'src/hp-dialog.ts', 'src/editor-secondary.ts', 'src/styles/settings-dialogs.styles.ts', 'src/device-inbox-menu.ts'],
    smokes: ['smoke_ui_polish_976.mjs'],
    because: '#976: native public controls execute accepted-close/focus paint, tool intention and keyboard rule actions; the browser consumer does not import those product helpers.',
  },
  {
    files: ['src/toast-presentation.ts', 'src/styles/toast.styles.ts'],
    symbols: ['ToastPresentation', 'setToastOwner'],
    smokes: ['smoke_modal_toast_956.mjs'],
    because: '#956: public rejected Save must paint above the actual modal; the consumer uses DOM/HA controls rather than calling the presentation controller.',
  },
  {
    files: ['src/backup-archive-client.ts', 'src/backup-archive-lazy.ts'],
    symbols: ['BackupArchiveClient', 'prepareArchive', '_backupErrorText'],
    smokes: ['smoke_backup_archive.mjs', 'smoke_backup_transfer.mjs', 'smoke_empty_backup_import.mjs', 'smoke_config_authority.mjs'],
    because: '#954: native ZIP export/import/consent, legacy JSON, empty input and writer authority; common _config/editor ownership is not proof of every browser contract.',
  },
  {
    files: ['src/device-battery-settings.ts','src/render-snapshot-capture.ts','src/render-snapshot-reuse.ts','src/space-card.ts'],
    smokes: ['smoke_space_battery_policy.mjs'],
    because: '#945: accepted global/local/marker policy changes must reach full, static, kiosk, isometric and marker preview consumers without a new HA state.',
  },
  {
    files: ['src/hp-settings-select.ts', 'src/editors/settings-styles.ts', 'src/editors/form-kit.ts'],
    smokes: ['smoke_settings_select.mjs'],
    because: '#948: actual native/capability-fallback popup, keyboard, focus, closing animation, live themes and reduced motion are observable only through rendered controls.',
  },
  {
    symbols: ['_roomCo2', 'co2Value', 'co2For', 'co2DeviceValue', 'isCo2Entity', 'renderRoomSource',
      'renderRoomSettingsDialog', 'renderRoomCards', 'roomClimateMap', 'sourceValue'],
    files: ['src/room-co2.ts', 'src/styles/dialogs.styles.ts'],
    smokes: ['smoke_room_co2.mjs'],
    because: '#920: native settings, source picker, write refusal, live row/tooltip, preview, Flat/2.5D/kiosk and unchanged static surface. The CO2 resolver is reached through rendered DOM, not called by the smoke.',
  },
  {
    files: ['src/styles/settings-dialogs.styles.ts', 'src/editors/settings-sections.ts', 'src/editors/settings-north.ts'],
    smokes: ['smoke_settings_navigation.mjs'],
    because: '#948: native form navigation observes draft nodes, compass values, live theme changes and mobile geometry without importing the layout helpers.',
  },
  {
    files: ['src/device-contact.styles.ts'],
    smokes: ['smoke_device_contact_zoom.mjs'],
    because: '#951: native zoom observes the actual SVG screen matrix and the ordinary shell border, not stylesheet text; covers small cores, DPR, themes and static cards.',
  },
  {
    files: ['src/device-inbox.ts', 'src/device-inbox-batch.ts', 'src/marker-deletion.ts'],
    smokes: ['smoke_device_inbox_delete.mjs'],
    because: '#930: native catalog filters, virtual selection, confirmation and accepted wire pair prove exact deletion and refusal without calling the shared helpers.',
  },
  {
    symbols: ['planEntryTool'],
    smokes: ['smoke_plan_entry_tool.mjs'],
    because: '#928: native mode/tool actions and server-delivered geometry observe entry, first-click safety and warm tool ownership without naming the helper.',
  },
  {
    symbols: ['HiddenDeviceRoster', 'HiddenDevicePreference', 'hiddenDevicePreferenceKey', 'canRevealUserHidden', '_setShowHidden'],
    smokes: ['smoke_hidden_device_toggle.mjs'],
    because: '#919: native header/catalog actions prove ordinary reveal, no config writes, lifecycle safety and isolated reloadable preferences.',
  },
  {
    files: ['src/support-diagnostics.ts', 'src/support-feedback.ts', 'src/version-recovery-card.ts'],
    smokes: ['smoke_support_diagnostics.mjs', 'smoke_support_feedback.mjs'],
    because: '#942: public cold mount, capability negotiation and actual form/WS bytes exercise the lazy collector without calling or naming it.',
  },
  {
    symbols: ['DeviceCopyEditor', 'virtualDeviceCopy', 'deviceCopyIncoming', 'deviceCopyPosition'],
    smokes: ['smoke_device_copy.mjs'],
    because: '#935: native context-menu action, saved pair and cold reader cover the copy command without naming its internal helpers.',
  },
  {
    files: ['src/device-contact-geometry.ts','src/device-contact-snap.ts','src/device-contact-render.ts',
      'src/device-contact-card.ts','src/device-contact.styles.ts','src/device-contact-scene.ts',
      'src/device-contact-walls.ts','src/device-contact-floor.ts','src/device-contact-collision.ts',
      'src/device-contact-editor.ts','src/device-contact-maintenance.ts'],
    smokes: ['smoke_device_contacts.mjs','smoke_device_contact_walls.mjs','smoke_device_contact_designer.mjs','smoke_device_contact_work.mjs',
      'smoke_device_equal_spacing.mjs','smoke_device_hit_capsules.mjs','smoke_device_position_history.mjs',
      'smoke_pageshow_layout_ack.mjs','smoke_optimize_context.mjs'],
    because: '#866: mounted native input observes independent actions, one-point history/cancellation, '
      + 'unchanged spacing, real wall-face hysteresis and frozen-designer contour comparison; '
      + 'existing writer/context consumers observe external guards without naming these new adapters.',
  },
  {
    symbols: ['LayoutWriteReload'],
    smokes: ['smoke_pageshow_layout_ack.mjs'],
    because: '#902: native released marker drag and public pagehide/pageshow cross '
      + 'a held real fixture ACK and old paired response, then use actual Undo/Redo. '
      + 'The witness observes accepted wire positions, history controls and painted '
      + 'coordinates rather than naming the reconciliation owner.',
  },
  {
    files: ['src/physical-body-gesture.ts', 'src/backdrop-frame-gesture.ts', 'src/live-editor.ts'],
    smokes: ['smoke_physical_body_characterization.mjs', 'smoke_partition_openings_preview.mjs',
      'smoke_backdrop.mjs', 'smoke_free_walls.mjs', 'smoke_partition_openings.mjs',
      'smoke_backdrop_guard.mjs', 'smoke_decor.mjs', 'smoke_hide_layers.mjs',
      'smoke_grid_scale_invariance.mjs', 'smoke_render_invalidation.mjs', 'smoke_lazy_editor_chunk.mjs'],
    because: '#861: ordinary input observes owned body/backdrop gestures, queued terminal/history '
      + 'boundaries, frozen camera, editor-lazy loading and actual held hosted-opening ink. '
      + 'The consumers do not call or name the extracted purpose owners.',
  },
  {
    symbols: ['_cardToggle', 'infoCardRowContextKey'],
    smokes: ['smoke_info_card_context.mjs'],
    because: '#849: actual information-row entry and a retained DOM listener in the '
      + 'same public HA replacement frame prove dispatch ownership across connection/user '
      + 'changes; fresh native acceptance and an unchanged explicit entity with a new '
      + 'registry parent remain permitted. The smoke observes the wire, not these symbols.',
  },
  {
    symbols: ['commitPlanOptimization', 'sameOptimizeSource', 'authorityCurrent'],
    files: ['src/optimize-source.ts'],
    smokes: ['smoke_optimize_context.mjs'],
    because: '#892: actual settings Save/Apply crosses the real pending writer; '
      + 'public HA registry events revoke cleanup consent, and a held response '
      + 'must preserve a different user authority at the same connection. '
      + 'The smoke observes exact accepted pairs, not these helper names.',
  },
  {
    symbols: ['ViewHoldGesture', '_viewHold', '_onWindowBlur', '_onViewPointerTerminal',
      '_abandonViewInput', '_pageVisibility', '_sunFadeReset'],
    files: ['src/view-hold.ts', 'src/touch-gesture-click-guard.ts'],
    smokes: ['smoke_view_hold_lifecycle.mjs'],
    because: '#847: native marker holds, stage releases, iframe blur, implicit capture loss '
      + 'and trusted room-name taps exercise mounted View wiring; explicit hidden/pagehide '
      + 'emulation proves inert old tails and first fresh touch; live HA sun samples prove '
      + 'fade disposal. Pure owner units cannot observe these consumers.',
  },
  {
    files: ['src/device-signal.ts', 'src/zigbee-topology.ts'],
    smokes: ['smoke_device_signal.mjs', 'smoke_device_signal_settings.mjs', 'smoke_device_signal_topology.mjs', 'smoke_zigbee_tooltip_layout.mjs'],
    because: '#867: public HA sibling updates, real marker settings and mouse hover prove inherited diagnostics, local hide and canonical radio anchors through the production bundle; SVG screen-space resize endpoints need the existing native layout matrix.',
  },
  {
    files: ['src/device-icon-roster.ts', 'src/device-drag-retirement.ts'],
    smokes: ['smoke_editor_guides_lifecycle.mjs', 'smoke_align_guides.mjs', 'smoke_device_equal_spacing.mjs'],
    because: '#893: the mounted lazy editor shares actual painted references with spacing/alignment; '
      + 'native queued and painted drag retirement must restore DOM and preserve the released writer.',
  },
  {
    files: ['src/wall-end-align.ts'],
    smokes: ['smoke_wall_guide_ownership.mjs'],
    because: '#893: the callback from the existing exact snap winner is consumed by real Walls '
      + 'preview, one guide layer, native zoom and accepted config write, not only the pure result.',
  },
  {
    files: ['src/signal-visibility.ts'],
    smokes: ['smoke_signal_visibility.mjs', 'smoke_signal_visibility_lifecycle.mjs',
      'smoke_signal_visibility_ui.mjs', 'smoke_signal_visibility_work.mjs',
      'smoke_signal_visibility_device_policy.mjs'],
    because: '#876: public form saves and HA pushes exercise global/local/YAML precedence through the production bundle, independent full/static consumers, retained diagnostic siblings, explicit values and topology; helper names do not occur in the DOM-driven witnesses.',
  },
  {
    files: ['src/opening-context.ts', 'src/styles/plan.styles.ts'],
    smokes: ['smoke_view_entry_recovery.mjs'],
    because: '#894: accepted config events update the real opening popup; trusted keyboard/touch '
      + 'exercise the separate Area control, its 44px computed box, focus and no room-fit/service fallthrough.',
  },
  {
    files: ['src/warm-marker-restore.ts'],
    smokes: ['smoke_warm_view_marker.mjs'],
    because: '#894: real View draft remounts wait for a fresh renderer and retire late loading '
      + 'after Close, permission loss, disconnect or a newer intent, with visible failure/retry.',
  },
  {
    files: ['src/kiosk-viewport-recovery.ts'],
    smokes: ['smoke_kiosk_viewport_recovery.mjs'],
    because: '#894: production document reload consumes its own floor/zoom/pan address; '
      + 'fixed/single/deleted floors and carousel/same-version negative controls cross browser storage and cold boot.',
  },
  {
    files: ['src/view-runtime-boundary.ts', 'src/view-runtime-code.ts', 'src/view-runtime-retry.ts',
      'src/view-runtimes.ts', 'src/summary-panel-runtime-entry.ts'],
    smokes: ['smoke_view_runtime_recovery.mjs', 'smoke_view_runtime_dirty_reload.mjs',
      'smoke_view_runtime_kiosk_recovery.mjs'],
    because: '#848: real root/dependency404, nonce requests and immutable module-map refusal '
      + 'are judged via production imports and visible recovery controls; dirty form decisions and '
      + 'the enlarged-kiosk shared reload claim cross real document navigation, not helper-name references.',
  },
  {
    files: ['src/device-editor-access.ts'],
    smokes: ['smoke_view_edit_permissions.mjs'],
    because: '#844: real footer/direct/lazy/warm entries and Area-icon navigation/drag '
      + 'exercise the shared permission predicates through the production bundle.',
  },
  {
    symbols: ['retryRegistry', 'renderUnverified', 'fallbackBlock', 'reloadHaRegistriesBounded',
      'unverifiedDiagnostics', 'unverifiedGroup', 'unverifiedName', 'legacyGroupAreaName',
      'LazyOptimizePlansDialog'],
    files: ['src/optimize-unverified.ts', 'src/optimize-plans-loader.ts'],
    smokes: ['smoke_optimize_unverified.mjs', 'smoke_orphan_space_references.mjs',
      'smoke_preflight_diagnostics.mjs'],
    because: '#869: the production Optimize dialog explains unmatched position records — groups by '
      + 'cause with the exact HA Area name, Copy/Close, a bounded registry re-check against the demo '
      + 'registry fixture, a late answer after Close, 360 px in both themes — and writes nothing; '
      + 'the dialog chunk is fetched only on the first open; the preflight smoke owns the shared '
      + 'clipboard fallback.',
  },
  {
    files: ['src/vacuum-dock-restart-write.ts'],
    smokes: ['smoke_vacuum_dock_restart.mjs'],
    because: '#940: native keyboard input and held/refused HA ACKs prove the accepted-only policy, '
      + 'capability fallback and both-client Flat/2.5D empty-path contract without calling the writer.',
  },
  {
    files: ['src/vacuum-routes.ts', 'src/vacuum-runtime-source.ts', 'src/vacuum-trail-diagnostics.ts',
      'src/editors/vacuum-path-diagnostics.ts', 'src/vacuum-trail-material.ts'],
    symbols: ['planVacuumOverlay', '_vacTrailDiagnostics', '_vacSource', '_vacObservedMapId'],
    smokes: ['smoke_vacuum_route_recovery.mjs'],
    because: '#918: real recorder public payload loads in cold View; exact route source drives '
      + 'Flat/2.5D path, tip and puck on desktop/mobile; foreign root events, map ambiguity, '
      + 'other floors and format-2 rejected runs cannot borrow local or foreign coordinates.',
  },
  {
    files: ['src/vacuum-path-geometry.ts', 'src/vacuum-trail-material.ts',
      'src/vacuum-trail-render.ts', 'src/vacuum-local-trail.ts', 'src/vacuum-trail-diagnostics.ts'],
    smokes: ['smoke_vacuum_path_fidelity.mjs', 'smoke_vacuum_camera.mjs',
      'smoke_isometric_live_touch.mjs'],
    because: '#872: real HA transport, native endpoint/gap DOM and bounded render/cache '
      + 'witnesses exercise the complete path pipeline; held camera frames preserve #871; '
      + 'the legacy-backend touch scene checks complete native casing/endpoint in Flat and 2.5D.',
  },
  {
    symbols: ['syncVacuumTips', 'inheritedSceneClip', '_vacRafLoop', '_renderVacuums'],
    files: ['src/vacuum-view.ts'],
    smokes: ['smoke_vacuum_camera.mjs', 'smoke_vacuum_multifloor.mjs',
      'smoke_live_pan_viewbox.mjs', 'smoke_live_pan_coverage.mjs'],
    because: '#871: native held pan/pinch/zoom frames align trails and animated tips '
      + 'through real composed DOM matrices, bounded clipping and HA updates; floor/source '
      + 'routing and incoming-edge coverage are separate runtime witnesses.',
  },
  {
    symbols: ['requestDraftClose', 'dialogSession', 'EditorChainExit', 'requestRoomClose', 'requestMarkerClose', '_finishWallChainForNavigation'],
    files: ['src/editors/draft-actions.ts', 'src/editors/draft-close.ts', 'src/editor-chain-exit.ts'],
    smokes: ['smoke_editor_draft_exit.mjs'],
    because: '#851: real create/edit controls prove dirty close, focus recovery, save refusal/retry, '
      + 'late Save ownership and the requested exit destination without a geometry write.',
  },
  {
    symbols: ['RoomDeviceDiscovery', '_syncNewDevices'],
    files: ['src/room-device-discovery.ts'],
    smokes: ['smoke_room_device_discovery.mjs', 'smoke_new_device.mjs',
      'smoke_area_relocation.mjs', 'smoke_area_relocation_safety.mjs'],
    because: '#879: native room Save and durable config prove the capture/discovery/writer wiring; '
      + 'late discovery and real HA Area relocation must keep their original attention behaviour.',
  },
  {
    symbols: ['BackupImportIntent', 'backupImportAllowed', '_canImportEmptyBackup', '_pickEmptyBackupImport',
      '_importBackupFile', '_ownsBackupImport', '_closeBackupImport'],
    smokes: ['smoke_empty_backup_import.mjs', 'smoke_backup_transfer.mjs', 'smoke_lazy_editor_chunk.mjs'],
    because: '#875: native empty-screen file chooser, preview/apply, cancellation, lazy chunk and '
      + 'ACL probes observe UI and transport, not private import methods; existing settings/onboarding remain covered.',
  },
  {
    symbols: ['classifyWallFaceRoom', 'classifyWallFaceCandidates', 'selectWallFacePromotionIds', '_classifyWallFaces',
      '_dismissWallFaceBatch', 'sourceIntervals'],
    files: ['src/wall-face-room-split.ts'],
    smokes: ['smoke_wall_face_room_split.mjs', 'smoke_wall_face_lineage.mjs', 'smoke_wall_face_overlap.mjs'],
    because: '#874: the native room dialog/config writer proves composite Split, inherited carrier '
      + 'thickness, stale-proposal refusal and closed failure forms; unit clipping alone cannot witness the runtime wiring.',
  },
  {
    files: ['src/wall-node-delete-menu.ts', 'src/wall-node-delete.ts', 'src/wall-node-card-adapter.ts',
      'src/wall-node-write.ts', 'src/wall-node-history.ts'],
    smokes: ['smoke_wall_node_delete.mjs'],
    because: '#1045: native node contextmenu, authoritative Delete acknowledgement, rendered geometry, common Undo/Redo '
      + 'and retired Properties/menu callbacks are visible through the UI and wire, not through pure helper names.',
  },
  {
    files: ['src/wall-node-editor.ts', 'src/wall-node-card-adapter.ts', 'src/wall-node-preview.ts',
      'src/wall-thickness.ts', 'src/wall-shell-union.ts', 'src/wall-operand-topology.ts',
      'src/wall-boolean-baseline.ts', 'src/wall-boolean-incremental.ts', 'src/wall-boundary-splice.ts',
      'src/wall-intersection-signature.ts'],
    smokes: ['smoke_wall_node_connected.mjs'],
    because: '#834: native connected-floor drags prove neighbouring positions, atomic last-input release '
      + 'and warm end-to-end input/geometry/paint budgets, which disconnected-room benchmarks cannot observe',
  },
  {
    files: ['src/wall-segment-model.ts'],
    smokes: ['smoke_wall_adoption_alias.mjs'],
    because: '#826: two native Resize commits and Undo/Redo must preserve an aliased untouched '
      + 'floor and opening hosts; the smoke observes saved config/IDs rather than calling the adopter',
  },
  {
    symbols: ['alignWallEnd', 'alignDrawnWallEnd', 'planWalls'],
    files: ['src/wall-end-align.ts'],
    smokes: ['smoke_wall_end_align.mjs'],
    because: '#885: a real mouse proves that the Walls rubber-band, length label and click, and the '
      + 'node drag preview, guide and release, land on the same aligned (off-grid) point; the smoke '
      + 'observes the painted layer and the saved walls, never naming the pure magnet helpers',
  },
  {
    files: ['src/wall-node-editor.ts', 'src/wall-node-move.ts'],
    smokes: ['smoke_wall_node_reliability.mjs'],
    because: '#828: a captured real pointer survives full hass/Lit frames with one current '
      + 'warning/guide/X prompt and a pixel-proven frozen .35 source above candidate fills; '
      + 'the smoke observes SVG and pixels rather than naming the private ownership/coverage helpers',
  },
  {
    symbols: ['selectWallFaceLineage', 'settleWallFaceLineage'],
    smokes: ['smoke_wall_face_lineage.mjs'],
    because: '#804: a partial partition carrier is promoted through the production room dialog, '
      + 'actual config/set, history and reload; the smoke observes persisted IDs and atomic '
      + 'rollback rather than importing or naming the lineage helper.',
  },
  {
    files: ['src/zigbee-topology-runtime.ts', 'src/hp-zigbee-topology-settings.ts'],
    smokes: ['smoke_zigbee_topology_job.mjs'],
    because: '#800: background-job restore across a real page reload, elapsed/cancel boundary, '
      + 'mounted UI lifecycle and mobile keyboard target are observed through the production '
      + 'settings DOM and fake WS server outside the page, not by importing runtime helpers',
  },
  {
    files: ['src/styles/plan.styles.ts'],
    smokes: ['smoke_room_fill_transitions.mjs'],
    because: '#772 / #746: переход заливки комнаты зависит от CSS .room, а не только '
      + 'от TS-резолвера; имён функций в правке CSS нет. Связь со всей таблицей '
      + 'стилей намеренно шире селектора и сохраняет страховочный визуальный минимум',
  },
  {
    symbols: [
      'isoPlaneMatrix', 'unprojectFloorPoint', '_convertProjectionView', '_rezoom',
      '_warmAdoptViewport', '_logicalViewCenter', '_floorView', 'resolveIsoOverlayFitEnvelope',
      'buildIsoOverlayRenderScene',
    ],
    smokes: ['smoke_iso_flat_parity.mjs', 'smoke_isometric_contract.mjs'],
    because: '#713: the Flat-plane floor, the one straight-up tile rise and the kept camera are '
      + 'observed only as CSS pixels of rooms, decor, labels and tile anchors across a setting '
      + 'switch, an editor entry and a warm remount; no smoke names these helpers',
  },
  {
    symbols: [
      'moonLayer', 'renderMoon', 'moonTick', 'moonView', 'moonShownAt', 'moonPhasePath',
      'moonPosition', 'moonIllumination', 'moonFingerprint', 'renderDayCycleEnvironment',
      'withMoon', 'moonSkyState', 'dayCycleClock', 'renderMoonSky', '_moonSkyState', '_dayCycleClock',
      'moonStatus', 'moonStatusOf', 'openMoonStatus', 'moonStatusText', '_reviveMoonStatus', '_openMoonStatus',
    ],
    smokes: ['smoke_moon.mjs', 'smoke_moon_static.mjs', 'smoke_moon_status.mjs', 'smoke_daycycle_layer_budget.mjs'],
    because: '#661: the moon is observed only as `.hp-moon` in the production bundle — the lazy '
      + 'chunk arriving at night, the 30 s ticker and state updates carrying it through 3° with the '
      + '2 s fade, the plan painting over it pixel for pixel, and no extra composited layer (CDP); '
      + '#718: the same over a static background as `.hp-moon-sky` (the clock ticker at 08:00 and '
      + '18:00, tab and background switches, the #101 View weight, houseplan-space-card) and the '
      + 'General settings line as `[data-moon-status]` (delayed, refused and preloaded chunk); '
      + '#731: that line in a dialog revived after a warm remount (View, plan editor, chunk loading); '
      + 'no smoke names the functions',
  },
  {
    symbols: ['memoIsoLightFloorRooms', 'IsoFirstFrameState', 'isoPaperContext', 'commitPaper', 'themePaper'],
    smokes: ['smoke_iso_first_frame.mjs'],
    because: '#654: the production-bundle witness delays and rejects the lazy 2.5D chunk, then '
      + 'samples every animation frame in normal, kiosk and Flat views; no pure import can prove '
      + 'that the loading veil hides the transient Flat render or that the first visible marker '
      + 'already uses the settled paper-dependent floor class',
  },
  {
    symbols: ['IsoFirstFrameState', 'isoPaperContext', 'commitPaper', 'themePaper'],
    smokes: ['smoke_iso_floor_switch.mjs'],
    because: '#739: a warm floor switch between backdrop floors in 2.5D is observed only in the '
      + 'production bundle — one card update, no computed-colour probe and no veil insertion in '
      + 'the click task, the light floors of the first show; no smoke names the paper state',
  },
  {
    symbols: ['baseStyles', '_containerOwnedHeight', 'measuredCardHeaderHeight',
      'settleSoftStageLayout'],
    smokes: ['smoke_sections_resize.mjs'],
    because: '#648: the production-bundle witness measures the HA Sections slot, card, header '
      + 'and stage through repeated row resizes and every editor transition; the CSS height chain '
      + 'and helper boolean do not otherwise share a runtime symbol with those DOM measurements',
  },
  {
    symbols: ['chromeStyles', 'dialogsStyles'],
    smokes: ['smoke_toolbar_stable_width.mjs', 'smoke_editor_tabs.mjs', 'smoke_mobile_view_header.mjs'],
    because: '#647: the header X slot (.editor-close-slot) and the removed .head .count rule are '
      + 'CSS in these sheets; the smokes measure the rendered header width, tab offsets, the X '
      + 'hit target and its visibility at 1400/1000/768/390 px — no TS symbol names that layout; '
      + '#616: the phone one-row header rules live in chromeStyles too',
  },
  {
    symbols: ['HeaderMenu', 'headerMenuItems', 'renderHeaderActions'],
    smokes: ['smoke_mobile_view_header.mjs', 'smoke_support_feedback.mjs', 'smoke_gear_tabs.mjs'],
    because: '#616: the one-row phone header (<= 480 px) and its gear menu are a media query plus '
      + 'these symbols; the smokes tap the real gear and items at 320/390 px and prove >480 px is unchanged',
  },
  {
    symbols: ['confirmIcon', 'HpConfirmRequest'],
    smokes: ['smoke_discard_copy.mjs', 'smoke_dialog_polish_603.mjs'],
    because: '#610: the production-bundle witnesses open all four unsaved-settings '
      + 'confirmations, verify both rendered glyphs and actions, then prove an unrelated warning '
      + 'still uses the fallback lock glyphs; source imports cannot prove the rendered dialog',
  },
  {
    symbols: ['prepareDialogReturnFocus'],
    files: ['src/hp-confirm.ts'],
    smokes: ['smoke_discard_dialog_polish.mjs'],
    because: '#990: the unsaved-confirmation consumer observes actual entrance/initial-ring paint, real Tab focus, close hover and reduced motion through public dialog controls, not a direct call to the automatic-focus helper.',
  },
  {
    symbols: ['rangeLine', 'committedRangeLineValue'],
    smokes: ['smoke_range_line_draft.mjs', 'smoke_dialog_config_parity.mjs'],
    because: '#608: the production-bundle witnesses type partial numeric text into real settings '
      + 'dialogs, observe that host drafts stay unchanged until commit, and verify field/slider '
      + 'synchronisation; neither browser smoke imports the form-kit helper',
  },
  {
    symbols: ['rangeLine', 'unitInput'],
    smokes: ['smoke_room_settings_form.mjs', 'smoke_device_settings_form.mjs', 'smoke_space_settings_form.mjs'],
    because: '#639: the three settings-form smokes drive range-line numbers (room name/label scale, '
      + 'device brightness/size/angle, space card font) through the DOM and assert the host draft; '
      + 'they never name the form-kit helper, so #608 changed the commit event and only the nightly '
      + 'registry saw them turn red',
  },
  {
    symbols: ['canonicalFurnitureId'],
    smokes: ['smoke_furniture.mjs'],
    because: '#606: the bundled furniture palette and saved cactus object are checked through '
      + 'the browser DOM; the smoke cannot import the read-only alias resolver by name',
  },
  {
    symbols: ['formKitCss', 'renderRoomSettingsDialog'],
    smokes: ['smoke_dialog_polish_603.mjs'],
    because: '#603: the bundled form-kit track/knob box model, localized discard confirmation '
      + 'and headingless room card are measured in a browser; source imports cannot prove '
      + 'the rendered geometry or that both actions fit the real modal footer',
  },
  {
    symbols: ['displayIsNeutral', 'displayWantsValue'],
    smokes: ['smoke_static_icon.mjs', 'smoke_device_preview_parity.mjs'],
    because: '#588: два предиката режима наблюдаются как следствия — текст значения внутри '
      + 'маркера, отсутствие классов состояния и пульсации, подавленный живой слой пылесоса, '
      + 'поля и предупреждения диалога устройства. Ни один смок не называет предикаты: они '
      + 'живут внутри бандла, а смок работает через DOM',
  },
  {
    symbols: ['roomCustomFillOf'],
    smokes: ['smoke_space_settings.mjs', 'smoke_room_settings.mjs'],
    because: '#581: the room-colour projection (own custom mode carries the colour, an orphan paints '
      + 'the space) is observed through `.room` style variables in View and through the room-dialog '
      + 'draft; neither smoke calls the pure function by name',
  },
  {
    symbols: ['renderPaperShapes'],
    smokes: [
      'smoke_daycycle_layer_budget.mjs', 'smoke_daycycle_raster.mjs',
      'smoke_live_pan_coverage.mjs', 'smoke_bg_color.mjs', 'smoke_smooth_zoom.mjs',
    ],
    because: '#582: production-bundle witnesses prove that camera movement activates the '
      + 'stage-bounded day-cycle silhouette for direct and animated camera paths at 1 cm/point, '
      + 'keeps the #532 raster budget and '
      + 'follows the same #579 live viewport as the visible plan; source imports cannot expose '
      + 'CDP layers',
  },
  {
    symbols: [
      'commitHouseplanViewport', 'isIdentityLiveLayerProjection', 'paintLiveViewport',
    ],
    smokes: ['smoke_live_pan_coverage.mjs'],
    because: '#579: the production-bundle witness observes promotion through budgeted viewBox '
      + 'refreshes and active Lit commits via scene style attributes; it intentionally does not '
      + 'call the viewport helpers whose compositor lifecycle it guards',
  },
  {
    symbols: ['_renderDevice', '_renderOpenings'],
    smokes: ['smoke_space_switch_transitions.mjs'],
    because: '#525: the smoke never names these renderers — it switches spaces the ordinary way '
      + 'and reads running transitions off the nodes they produced. The contract it guards is '
      + 'list identity: a keyless list reuses a node by position, and the leaf of the next space '
      + 'then animates from the previous door\'s angle. Any edit to either renderer can drop the '
      + 'key without a single identifier of the smoke changing',
  },
  {
    symbols: ['renderSpaceStatic'],
    files: ['src/space-render.ts'],
    smokes: ['smoke_space_card.mjs', 'smoke_space_card_identity.mjs'],
    because: '#812: static-render changes need the baseline space-card contract as well as '
      + '#764 list identity on the read-only space card. The identity smoke '
      + 'drives a real houseplan-space-card through setConfig and a server config push and reads '
      + 'transitions and per-frame computed styles off marker and opening nodes; it names no '
      + 'symbol of the static renderer, whose marker and opening lists are local variables',
  },
  {
    symbols: ['LoadedSummaryPanelRuntime', 'SummaryPanelPresentation', 'renderSummaryPanelEditor',
      'summaryPanelCss', 'summaryPanelEditorCss', 'summaryPanelDialogCss', 'summaryIcon'],
    smokes: ['smoke_summary_panel_polish.mjs'],
    because: 'the #505 browser witness samples retained exit DOM and actual opacity/translation, '
      + 'reversal and lifecycle boundaries, then measures the native modal shell and drives '
      + 'dependent draft toggles without rewriting unrelated per-card scale preferences',
  },
  {
    symbols: [
      'confirmedSummaryPanelWriteRecovery', 'summaryPanelEntityIds',
      'adoptAuthoritativeGated', 'LoadedSummaryPanelRuntime',
    ],
    smokes: ['smoke_summary_panel.mjs'],
    because: 'the #490 production-bundle sequence proves that a lost config/set ACK adopts the '
      + 'whole authoritative document and revision before a second write, and that a summary-only '
      + 'HA state row drives the real panel without rendering unrelated ticks or rebuilding geometry',
  },
  {
    symbols: [
      'roomTempRangeOf', 'roomTempRangeFromDraft', 'roomTempThresholdDraft',
      'applyRoomTempThresholdDraft', 'renderRoomSettingsDialog',
    ],
    smokes: ['smoke_room_temperature_thresholds.mjs', 'smoke_room_settings_form.mjs'],
    because: 'the #487 production-bundle scenario proves partial inheritance, zero/invalid input, '
      + 'hidden draft retention, reset and narrow-dialog overflow through the real room editor',
  },
  {
    symbols: [
      'PdfExportRuntime', 'buildPdfPage', 'writePdf', 'stableDimensionEdges',
      'pdfSegmentTouchesGeometry', 'SegmentIntersection', 'segmentIntersection',
      'COORDINATE_EPSILON', 'PdfCollisionPoint', 'forEachRingSegment',
      'pointOnSegment', 'segmentParameter', '_openPdfDialog', '_renderPdfDialog',
    ],
    smokes: ['smoke_pdf_export.mjs'],
    because: 'the #53 production-bundle scenario proves the administrator button, cold-View '
      + 'lazy boundary, real modal, remembered options, browser download and parseable A4 output; '
      + 'its #484 stepped-facade pass additionally proves the complete external dimension chain '
      + 'through the shipped collision helper; those browser and network effects are outside '
      + 'the pure PDF scene and writer tests',
  },
  {
    symbols: [
      'DEFAULT_LABELS', '_closePicker', '_commitHex', '_confirm',
      '_hexInvalid', '_hexNeedsValidInput', '_surface',
    ],
    smokes: [
      'smoke_color_picker.mjs', 'smoke_color_picker_consumers.mjs', 'smoke_help_affordance.mjs',
    ],
    because: 'the #476 production-bundle scenarios prove the full-width localized confirmation, '
      + 'live-event count, invalid-HEX latch, focus and click containment in both the native '
      + 'popover and the picker surface inside a general-settings dialog; those browser '
      + 'lifecycle effects are not visible to source or pure color conversion tests',
  },
  {
    symbols: ['HpDialog', '_ensureNativeModal', '_useHaDialog', '_usesHaDialog', 'dialogsStyles'],
    smokes: ['smoke_dialog_modal_recovery.mjs', 'smoke_ha_form_shell_parity.mjs'],
    because: 'the #463 production-bundle scenario observes native top-layer state, geometric '
      + 'centring, ::backdrop, update/reconnect recovery and late ha-dialog registration; none '
      + 'of those browser lifecycle effects can be proved from the Lit source alone. The #609 '
      + 'scenario separately exercises the public HA sizing tokens, one HA body scroller, form '
      + 'canvas and responsive fullscreen geometry used by all five form-shell consumers',
  },
  {
    symbols: [
      'commitDraftSegmentGeometry', 'draftLiveCandidateSpace', 'draftLiveSeed',
      'isSingleDraftAppend', 'DraftLiveProjection', 'DraftLiveCommitRuntime',
    ],
    smokes: ['smoke_wall_draw_click.mjs'],
    because: 'the #461 production-bundle scenario proves local rejection rollback and exact '
      + 'Undo/Redo identity through the real Walls click handler; those browser effects are '
      + 'outside the pure projector and transaction source contracts',
  },
  {
    symbols: [
      'commitWallChainFinishGeometry', 'finalizeWallChainSpace',
      '_finalizeWallChainPartitions', '_canonicalWallChainHistoryState',
      'rewriteMarkerRoomReferences', 'restoreMarkerRoomReferences',
    ],
    smokes: ['smoke_writer_fixed_point.mjs'],
    because: 'the #477 production-bundle scenario proves that a finished chain and its later '
      + 'Undo/Redo states remain Optimize no-ops, and that Delete room updates and restores '
      + 'direct and cross-space vacuum references through the real editor history transaction',
  },
  {
    symbols: [
      'VersionRecoveryController', 'VersionReloadSafetySnapshot',
      'isVersionReloadSafe', 'compareRuntimeVersions', 'normalizeRuntimeVersion',
      'fetchAuthoritativeConfig', 'getAuthoritativeCardConfig', '_getAuthoritativeConfig',
      'adoptCardConfigCapabilities',
      'cardVersionReloadSafetySnapshot', '_versionReloadSafetySnapshot',
      'renderVersionBanner', '_renderVersionBanner',
    ],
    smokes: ['smoke_version_recovery.mjs'],
    because: 'the #462 production-bundle scenario proves the card-level overlay, trusted '
      + 'keyboard/touch reload seam, exact session target, concrete card dialog/write/gesture '
      + 'guards, config capability adoption before sibling failures, more-info pause and the '
      + 'full-card/space-card boundary; pure controller tests '
      + 'cannot observe those DOM and Home Assistant lifecycle effects',
  },
  {
    symbols: ['entryBuildLabel', 'formatBuild', 'devBuildLabel', 'knownFingerprint', 'runningBuild'],
    smokes: ['smoke_build_identity.mjs', 'smoke_version_recovery.mjs'],
    because: 'the #836 production-bundle scenarios load both entry wrappers by the URL the backend '
      + 'registers (`dev=`), read the console banner and the About link, and reconcile equal '
      + 'versions by fingerprint; neither smoke names the parsing or formatting helpers',
  },
  {
    symbols: [
      'LiveEditorState', 'finishRevision', 'hoverProperties',
      'routeHouseplanEditorUpdate', 'whenHouseplanEditorSettled',
    ],
    smokes: ['smoke_furniture.mjs', 'smoke_decor.mjs', 'smoke_decor_text.mjs'],
    because: 'the #460 production-bundle scenarios consume the internal settlement contract '
      + 'through the lazy editor runtime and prove that furniture hover cleanup, preview/commit '
      + 'parity and decor gestures observe the latest coalesced live-editor frame',
  },
  {
    symbols: [
      'renderZigbeeTopologyOverlay', 'resolveTopologyHover', 'mapTopologyNodes',
      'readZhaTopology', 'refreshZ2mTopology', 'zigbeeTopologySettingsOf',
    ],
    smokes: ['smoke_zigbee_topology_hover.mjs'],
    because: 'the #54 production-bundle scenario proves default-off lazy loading, explicit provider '
      + 'refresh, incident-only mouse hover, cross-space counting, pointer transparency and immediate '
      + 'cleanup across leave, touch, editor and non-admin boundaries',
  },
  {
    symbols: ['_clipRouteCopies'],
    smokes: ['smoke_device_battery_zigbee.mjs'],
    because: 'the #808/#829 raster probes prove, against routes-hidden controls, that the clipped '
      + 'route copy paints its lines and arrowheads over endpoint battery ink and value badges '
      + 'while the endpoint core stays above, in Flat and 2.5D; the smoke never names the private clip method',
  },
  {
    symbols: [
      'beginVacuumRouteDraft', 'chooseVacuumRouteSpace', 'commitVacuumRouteDraft',
      'VacuumRouteDraft', 'VacuumMapsHost', 'VacuumMapsCardHost',
    ],
    smokes: ['smoke_vacuum_route_draft.mjs'],
    because: 'the #441 production-bundle scenario drives both add-map controls, first-route '
      + 'defaulting, required floor selection, cancel, a rejected config write with rollback and '
      + 'a successful retry; those UI and transport effects are outside the pure draft helpers',
  },
  {
    symbols: ['deviceBatteryTipText', 'deviceBatteryReading', 'deviceTipContent'],
    smokes: ['smoke_device_battery_tooltip.mjs'],
    because: '#817: the charge row is read from the visible device tooltip after a real mouse '
      + 'hover and keyboard focus, in Flat and 2.5D, with the plan indicator off, low-only and '
      + 'hidden per device; the smoke observes tooltip text and never names these helpers',
  },
  {
    symbols: ['showRoomTooltipOf'],
    smokes: ['smoke_room_tooltip_toggle.mjs'],
    because: 'the production-bundle scenario proves the global-settings draft and persistence, '
      + 'room-only suppression before area work, immediate stale-room-tip cleanup, preserved room '
      + 'highlight/device tooltip and default-on restoration (#426)',
  },
  {
    symbols: [
      'applyDevicePlacement', 'devicePlacement', 'sameDevicePlacement',
      'DevicePlacement', 'DevicePositionState',
    ],
    smokes: ['smoke_device_position_history.mjs'],
    because: 'the #74 production-bundle scenario drives real Device editor pointer events and '
      + 'observes transaction boundaries, point-wise update/delete, toolbar history, native field '
      + 'shortcuts, cancellation and revision invalidation; none of those browser effects can be '
      + 'proved by the pure placement helpers alone',
  },
  {
    symbols: [
      'resolveValueSource', 'valueSourceWriteFields', 'valueBadgeCandidates',
      'valueBadgeSourceKey', 'resolveDevicePresentation',
    ],
    smokes: ['smoke_value_face_source.mjs'],
    because: 'the #378 production-bundle scenario observes the shared source resolver through '
      + 'the real Device dialog, draft preview, persistence, both plan renderers, unavailable '
      + 'recovery, action dispatch and binding reset; those DOM effects do not call the pure '
      + 'source helpers by name',
  },
  {
    symbols: ['roomClimateKey', 'roomClimateMap'],
    smokes: ['smoke_room_climate_placement.mjs'],
    because: 'the #317 production-bundle scenario proves one manually placed sensor through '
      + 'room label, tooltip, temperature fill and hosted Static; those DOM surfaces cannot call '
      + 'the pure room-target helpers directly',
  },
  {
    symbols: [
      'LanguageRuntime', 'LanguageRuntimeContract', 'languageRenderGate',
      'dictionaryFor', 'ensureLanguage',
    ],
    smokes: ['smoke_german_locale.mjs', 'smoke_french_locale.mjs'],
    because: 'the production-bundle scenario observes the lazy German chunk through network '
      + 'requests and four root render gates: neutral cold frame, atomic German commit, page-cache '
      + 'reuse and the bounded retry-to-English path cannot be proven from pure registry tests (#348)',
  },
  {
    symbols: [
      'namespaceLanguageRuntime', 'composeLanguageRuntimes', 'surfaceLanguageRuntime',
      'SETTINGS_LANGUAGE_RUNTIME', 'SUPPORT_LANGUAGE_RUNTIME', 'TOPOLOGY_LANGUAGE_RUNTIME',
      'TOOLS_LANGUAGE_RUNTIME', 'EDITOR_LANGUAGE_RUNTIME', 'ONBOARDING_LANGUAGE_RUNTIME',
      'settingsT', 'supportT', 'topologyT', 'toolsT',
    ],
    smokes: ['smoke_lazy_admin_locale.mjs', 'smoke_dialog_segments_i18n.mjs'],
    because: 'the ru/de/fr namespace dictionaries are separate lazy chunks: only the production '
      + 'bundle shows the per-frame dialog text on a cold open, the held frame on a live switch, '
      + 'the bounded retry-to-English path and the exact chunk requests of each surface (#627)',
  },
  {
    symbols: [
      'probeBackdrop', 'classifyPlanFile', 'downscaleBackdrop', 'renderBackdropGuard',
      'WARN_DECODED_BYTES', 'HARD_DIMENSION', 'DOWNSCALE_TARGET_PX',
    ],
    smokes: ['smoke_backdrop_guard.mjs'],
    because: 'the production-bundle scenario proves the guard end to end: header-only warning '
      + 'with zero decode calls, byte-identical keep-original path, a real 6200px reduce to 4096 '
      + 'with alpha preserved, the cancel-only hard dialog, the honest phase-2 failure (toast, '
      + 'clean staging, no silent original upload) and the SVG bypass (#39)',
  },
  {
    symbols: [
      'stagePlanFile', 'uploadPlanFile', 'renderPlanBackdropGuard',
      'MAX_PLAN_BYTES', 'MAX_PLAN_MB', 'PLAN_UPLOAD_PATH',
    ],
    smokes: [
      'smoke_plan_upload_limit.mjs', 'smoke_plan_upload_race.mjs',
      'smoke_plan_upload_reject.mjs', 'smoke_backdrop_guard.mjs',
    ],
    because: '#617: the smokes drive _pickPlanFile/_saveSpaceDialog of both runtimes on the '
      + 'production bundle and observe the transport (one multipart POST, zero plan/set), the '
      + 'pre-send limit toast, the reduced-copy-only guard and the 413 text; none of them names '
      + 'the shared helpers, so a name search cannot find them',
  },
  {
    symbols: ['vacMapIdWithFallback', 'vacMapIdFromAttrs', 'readVacTelemetry'],
    smokes: ['smoke_cold_view_vacuum.mjs'],
    because: 'the telemetry-bearing cold scenario proves the vacuum render path (willUpdate '
      + 'snapshot, map-id fallback with selected_map: 0, live position frames) survives without '
      + 'the lazy editor runtime — the demo mower has no position attributes, so every other '
      + 'smoke skips this branch (#358)',
  },
  {
    symbols: ['TAP_ACTIONS', 'DeviceTapAction'],
    smokes: ['smoke_tap_ctx.mjs'],
    because: 'the Device editor exposes the canonical ordered action list and the same scenario '
      + 'proves explicit none consumes pointer and keyboard activation without UI, feedback or '
      + 'HA side effects (#381)',
  },
  {
    symbols: [
      'resolveToggleIntent', 'toggleOperation', 'projectedTapAction',
      'toggleOriginOf', 'resolvedLightSources',
    ],
    smokes: ['smoke_cold_view_toggle.mjs'],
    because: 'the cold-view scenario proves a plain tap resolves and executes WITHOUT the lazy '
      + 'editor runtime: a wall switch drives three passive virtual lamps, a controlled lamp '
      + 'drives its switch, tap_confirm renders and confirms, and no editor chunk is requested '
      + '(#357 — every warm smoke preloads the runtime and cannot see this class)',
  },
  {
    symbols: ['quantizeKeyCoord', 'INCIDENT_EPS', 'KEY_FACTOR'],
    smokes: ['smoke_junction_limits.mjs'],
    because: 'the smoke proves the write barrier verdicts (refusal toasts, resize stop, '
      + 'fail-closed candidate) through the rendered card, never naming the key-quantisation '
      + 'internals that decide which nodes are one node (#331 §2.1)',
  },
  {
    symbols: [
      'EditorRuntimeLoader', 'EditorRuntimeLoaderState', 'EditorRuntimeModule',
      'EditorRuntimeLoaderFailure', 'lazyLoadFailureMessage',
      'EDITOR_RUNTIME_FINGERPRINT', 'createHouseplanEditorRuntime',
    ],
    smokes: ['smoke_lazy_editor_chunk.mjs', 'smoke_entry_stale.mjs'],
    because: 'the production-bundle scenarios prove that the content-hashed editor chunk stays '
      + 'off the View network path, is shared by all three editors, retries once per cycle, '
      + 're-arms after a network failure so the next press heals (#353), refuses an incompatible '
      + 'build before editor state is installed (#337), and that a stale cached entry shows a '
      + 'localized reload panel instead of dying silently (#353)',
  },
  {
    symbols: ['adoptEditorStyles', 'editorDialogsStyles', 'editorSecondaryStyles'],
    files: [
      'src/styles/editor-dialogs.styles.ts', 'src/editor-style-adoption.ts',
      'src/editor-secondary.styles.ts', 'src/styles/dialogs.styles.ts',
    ],
    smokes: ['smoke_editor_styles_lazy.mjs'],
    because: '#805: the cold View, kiosk, space card and onboarding roots must hold no editor-only '
      + 'rule while every editor surface is styled in the first frame it appears in, in the '
      + 'canonical cascade slots, once per root (two cards, warm remount, disconnect, retry, '
      + 'foreign build); the smoke reads adoptedStyleSheets and computed styles of the production '
      + 'bundle and names neither the adoption function nor the sheets',
  },
  {
    symbols: ['_kioskDialog', '_renderKioskDialog', '_saveKioskScale', 'saveScale', '_kioskHold', 'interruptForModal'],
    files: ['src/touch-gesture-click-guard.ts'],
    smokes: ['smoke_kiosk_scale_no_editor.mjs'],
    because: '#763: a cold kiosk opens the per-screen size dialog with a real 3 s touch hold and '
      + 'drives its sliders, Reset, Close and reopen through the DOM, while the network log proves '
      + 'the editor chunk is never requested, also when the network refuses it; the smoke names '
      + 'none of these members; #831 also proves trusted 5 px jitter takeover, inert old tail '
      + 'and fresh mouse/touch/keyboard dialog input without changing gesture thresholds',
  },
  {
    symbols: [
      'ROOM_GEAR_DRAG_THRESHOLD_PX', 'roomGearPointAllowed', 'roomGearAutoCenter',
      'resolveRoomGearCenter', 'roomGearDragMoved', 'clampRoomGearPointAlongPath',
      'RoomGearDragController', '_cancelRoomGearForMultitouch',
    ],
    smokes: ['smoke_room_gear_drag.mjs', 'smoke_resize_labels.mjs'],
    because: 'the #645 production gestures prove temporary room-button movement, click/drag '
      + 'arbitration, room-boundary clamping, cancel/multitouch rollback and session reset; the '
      + 'Resize smoke proves its live area labels avoid the actually rendered room button',
  },
  {
    symbols: [
      'placeResizeAreaLabel', 'resizeInwardNormal', 'resizeMeasuredEdges',
      'ResizeAreaPlacement', 'ResizeAreaPlacementInput', 'ResizeLabelView',
    ],
    smokes: ['smoke_resize_labels.mjs'],
    because: 'the #300 production gesture observes the pure projection only through the '
      + 'rendered side-wall highlights, area/leader DOM and actual gear rectangles at current zoom',
  },
  {
    symbols: [
      'classifyNearAxisSegment', 'snapNearAxisEndpoint', 'repairNearAxisRoomWalls',
      'NEAR_AXIS_MAX_DEGREES', 'NEAR_AXIS_MAX_SLOPE',
    ],
    smokes: ['smoke_plan_drawing_repairs.mjs', 'smoke_near_axis_optimize.mjs'],
    because: 'the production bundle must make the Walls hover/click candidate exact-axis, then '
      + 'preview one deduplicated real shared wall, pass production geometry preflight, apply one '
      + 'atomic Optimize write, reload idempotently and restore the original through one Undo (#290)',
  },
  {
    // #297: обход не проверяет снимок — он расшатывает план продуктовыми жестами
    // и спрашивает инварианты после каждого. Поиском по тексту связь между этим
    // смоком и кодом ресайза, удаления комнаты и «Оптимизировать» не находится.
    symbols: [
      'resolveSafeResize', 'applySafeResize', 'clampSafeResize', 'validateSafeResize',
      'planRoomDeletion', 'materializeWallIntervals', 'optimizePlans',
      'reconcileCoincidentPartitions',
    ],
    smokes: ['smoke_edit_walk.mjs'],
    because: 'дефекты геометрии рождаются в редактировании, а не в хранении: #289, #296 и '
      + '#298 прошли все снимковые гейты — обход находит их на первом-втором жесте',
  },
  {
    // #285: смок не произносит ни одного имени продуктового кода — он подставляет
    // геометрию реального этажа и спрашивает сам продукт через isPointInFill,
    // есть ли кладка там, где модель её обещает. Поиском по тексту такая связь
    // не находится никогда.
    symbols: [
      'wallBodiesGeometry', 'wallEdgeBodies', 'buildMultiWallNodeMap',
      'multiWallBevelTriangles', 'virtualJunctionPatches', 'linearWallJoinPatches',
      'MITRE_LIMIT', 'MULTI_WALL_JOIN_LIMIT', 'insetContour', 'atomicPolyForRoom',
    ],
    smokes: ['smoke_real_plan_masonry.mjs'],
    because: 'на реальном плане кладка рвётся там, где синтетические фикстуры целы: '
      + 'восемь закрытых задач по стыкам вошли в beta.9, а разрыв в 45 шагов остался — '
      + 'пиксельные пороги golden такую долю кадра не видят',
  },
  {
    symbols: [
      'WallGeometryStatus', 'WallGeometryComponent', 'WallBodiesGeometryResult',
      'checkSpacePhysicalGeometry', 'spacePhysicalGeometryFingerprint',
    ],
    smokes: ['smoke_wall_union_isolation.mjs'],
    because: 'the #278/#834 production bundle must retain the independently specified historical masonry in Plan, '
      + 'View, Static, hidden Iso and light barriers after its numerical repair, reject a genuinely unbuildable '
      + 'physical candidate with zero WS/Undo, and still allow a non-geometry edit; deterministic retained-component '
      + 'failure isolation is additionally exercised through the existing boolean fault seam in unit tests',
  },
  {
    symbols: [
      'prepareResizeAtomProjection', 'applyResizeAtomProjection', 'projectResizeAtomCatalogue',
      'projectResizeAtomConsumers', 'projectResizeStoredAtoms', 'prepareResizeAtomContext', 'ResizeAtomContext',
      'ResizeAtomProjection', 'ResizeAtomContour', 'ResizeAtomSegment',
    ],
    smokes: ['smoke_resize_pointer_real_plan.mjs', 'smoke_wall_adoption_alias.mjs', 'smoke_floor_cache_reuse.mjs'],
    because: '#832 native repeated Resize crosses coalesced runs, stored IDs, final materialization '
      + 'and precise persisted Undo/Redo; #826 also protects compact repeated/adopted JSON. '
      + '#814 covers a genuine side-wall split at a fixed third-room corner after a server rollback. '
      + 'The bundle does not expose these pure projection helpers to the browser fixture.',
  },
  {
    symbols: [
      'resolveSafeResize', 'applySafeResize', 'validateSafeResize', 'clampSafeResize',
      'safeResizePointerDisplacement', 'SafeResizePlan', 'SafeResizeResolution',
      'SafeResizeReason', 'SafeResizeObstacle',
    ],
    smokes: ['smoke_room_resize.mjs', 'smoke_resize_pointer_real_plan.mjs'],
    because: 'the #277 synthetic scenario covers fixed topology, first-corner clamp and disabled '
      + 'accessibility, while #293 recreates the card from config/get and drives real browser mouse '
      + 'events on the tracked second-floor plan; pure helpers are hidden behind both controllers',
  },
  {
    symbols: ['reconcileCoincidentPartitions', 'CoincidentPartitionResult'],
    smokes: ['smoke_optimize_coincident_partition.mjs'],
    because: 'the production-bundle scenario observes the Optimize report, atomic Apply, reload, '
      + 'one-shot Undo and the resulting Boundary/Thickness targets, while the pure reconciliation '
      + 'helper is not exposed on the card instance (#276)',
  },
  {
    // #263: пикер называет себя (`_bindingCandidates`) и потому находится
    // прямым совпадением. Регистрируются только чистые помощники надгробий:
    // смок не произносит ни одного их имени — он видит лишь список, который
    // они отфильтровали. Проверено зондом: правка одного `src/devices.ts` без
    // этой записи не выбирает ни одного смока.
    symbols: ['removedPlanBindings', 'isRemovedPlanEntity', 'deletePlanMarkerRecords'],
    smokes: ['smoke_binding_picker.mjs'],
    because: 'смок проверяет, что удалённая привязка снова предлагается в списке «Добавить», '
      + 'что отдельные сущности устройств живут за галкой и что надгробие устройства '
      + 'по-прежнему прячет его дочерние сущности (#262) — всё это следствия фильтров '
      + 'надгробий, чьи имена в браузерный сценарий не попадают',
  },
  {
    // #261: the browser observes the canonical wall/paper paths and downstream
    // geometries, while the pure bevel helpers remain internal to the bundle.
    symbols: [
      'multiWallBevelTriangles', 'multiWallBevelTrianglesAt',
      'buildMultiWallNodeMap', 'MultiWallNodeRay', 'MultiWallNodeRaySupport',
      'multiWallProtectedRayIndexes', 'multiWallProtectedStripGeometry',
      'multiWallProtectedMapGeometry', 'multiWallEffectiveCutGeometry',
    ],
    smokes: [
      'smoke_junction_patch_resilience.mjs', 'smoke_multiwall_junction.mjs',
      'smoke_multiwall_strip_containment.mjs',
    ],
    because: 'the #197 smoke probes the repaired exterior wedge across Plan, View, kiosk, '
      + 'Static, hidden Iso and light barriers, while the #249 smoke proves the old excessive '
      + 'wedge stays empty, #271 also proves finite ray endpoints, and #275 densely samples every '
      + 'protected orthogonal strip across Plan, Static, hidden Iso and light barriers; the browser '
      + 'scenarios call none of the pure helpers by name',
  },
  {
    // #258: the browser sees only the resulting path/caches; it cannot call
    // the pure identity helpers by name through the production bundle.
    symbols: ['wallKey', 'lookupWall', 'canonicalKeyCoordinate', 'keyEpsilon'],
    smokes: ['smoke_wall_key_roundtrip.mjs'],
    because: 'the affected and canonical midpoint keys must produce the same T-junction in '
      + 'Plan, View, kiosk, Static, hidden Iso, clean-floor and light-barrier consumers',
  },
  {
    // #253: the pure interval transformer is invoked inside the resize preview;
    // the smoke can observe only the resulting wall records and rendered body.
    symbols: [
      'rekeyWallsAfterMove', 'WallEntry', 'angleClose', 'clampWallCm',
      'closePoint', 'distToSeg', 'keyOf', 'pointAt', 'segAngle', 'wallDir', 'wallEntry',
    ],
    smokes: ['smoke_resize_wall_thickness.mjs', 'smoke_resize_pointer_real_plan.mjs'],
    because: 'the real pointer-handler smoke proves that a partial overlap is split losslessly '
      + 'through live preview, commit, opening movement and Undo, but the browser bundle does '
      + 'not expose the pure transformer name to the scenario',
  },
  {
    // #244: pure repair/validation helpers are bundled behind editor actions;
    // the smoke observes their persisted candidate and rendered explanations.
    symbols: [
      'repairSpaceReferences', 'collectSpaceMarkerDependencies',
      'createSpaceDeletionCandidate', 'invalidDefaultFloor',
      'ImportLineageRoot', 'canonicalImportRoot', 'reversibleStem', 'addCandidate',
    ],
    smokes: ['smoke_orphan_space_references.mjs'],
    because: 'the production-bundle smoke proves the Optimize candidate, live marker rebuild, '
      + 'nested import-lineage collapse, delete blocker and card-editor warning, while those UI '
      + 'surfaces do not expose the pure helper names at runtime',
  },
  {
    // #819: the smoke presses the dialog's buttons; it never names the
    // runtime method or the helpers behind them.
    symbols: ['_deleteSpace', 'revealSpaceDeleteBlocker', 'hiddenDependencyCount'],
    smokes: ['smoke_space_delete_with_devices.mjs'],
    because: 'the smoke clicks Delete and «Delete space with devices» and observes the warning '
      + 'scrolled into view and focused at two viewports, the confirmation text with N and K, '
      + 'and the one space/delete request with remove_markers',
  },
  {
    // #242: pure placement is called inside shared SVG/Iso renderers, while
    // browser smokes can only inspect the resulting transforms and bases.
    symbols: ['openingSymbolOffset'],
    smokes: ['smoke_isometric_contract.mjs', 'smoke_wall_thickness.mjs'],
    because: 'wall-thickness smoke proves the default and saved-flip SVG translations; '
      + 'isometric smoke inspects door/window/gate bases from the same helper, but neither '
      + 'browser bundle exposes the helper name in its test steps',
  },
  {
    files: ['src/zoom-scale-activity.ts', 'src/led-strip-field.ts'],
    symbols: ['_applyCameraTransitionFrame', '_startCameraTransition', '_cancelCameraTransition', '_zoomAt'],
    smokes: ['smoke_led_zoom_quality.mjs'],
    because: '#789: actual wheel/pinch and camera lifecycle must select retained48/coarse24 '
      + 'before viewport paint and restore full48 without changing LED geometry or ordinary Glow; '
      + 'the helper unit cannot observe custom-element CSS, HA updates or real input wiring',
  },
  {
    // #780: the LED chunks are lazy modules reached only through the bundle;
    // the smokes drive the Devices editor, the View and the static card by
    // DOM (`data-led-*`) and never name a helper of these files.
    files: [
      'src/led-strip-gate.ts', 'src/led-strip-card.ts', 'src/led-strip-geometry.ts',
      'src/led-strip-runtime.ts', 'src/led-strip-field.ts', 'src/led-strip-editor.ts',
    ],
    smokes: ['smoke_led_strip_draw.mjs', 'smoke_led_strip_bind.mjs', 'smoke_led_strip_glow.mjs',
      'smoke_led_strip_field.mjs', 'smoke_led_strip_tube.mjs'],
    because: '#780: drawing, placement against walls, binding, the icon ↔ strip switch, the LED '
      + 'history, the View target, the field states and the static card are observed only as '
      + 'rendered strips and saved configs; no smoke names the lazy modules’ functions',
  },
  {
    symbols: ['cachedStairMarkup', 'stairTreadPath', 'StairMarkup'],
    smokes: ['smoke_stairs.mjs'],
    because: '#740: the strings of the stair symbol are observed only as the production markup of '
      + 'the View and plan-editor layers — one `path.hp-stair-tread` whose `M` subpaths count the '
      + 'physical treads, the outline and hit polygons, navigation and the editor gestures on them; '
      + 'no smoke names the helpers',
  },
  {
    // #234: единый резолвер толщины отрезка цепочки. Смок перехода между
    // толщинами не называет ни `chainSegmentCms`, ни `_wallChainSegmentCms` — он
    // рисует стены инструментом и проверяет, что кладка на стыке толщин
    // остаётся связной. Общих с диффом символов у него ровно два, `_cellCm` и
    // `_gridPitch`, и оба слишком широкие, чтобы что-то доказывать.
    symbols: ['chainSegmentCms', 'wallChainSegments', '_wallChainSegmentCms', '_closingWallCm'],
    smokes: ['smoke_wall_thickness_transition.mjs'],
    because: 'переход между двумя толщинами в одной цепочке: резолвер толщины '
      + 'отрезка решает, где кладка меняет глубину, а смок проверяет кладку, '
      + 'а не толщину, и ни одного имени из резолвера не называет',
  },
  {
    // #756: хвост тёплой адопции редактора. Смоки видят его только как
    // воскрешённый черновик и покадрово неизменный `_view` после ре-маунта.
    symbols: ['finishWarmModeAdoption', 'resumeWarmMode', '_holdWarmRefit', '_releaseWarmRefit', '_cancelPendingWarmMode', 'warmCameraUnchanged'],
    smokes: ['smoke_warm_dialogs.mjs', 'smoke_warm_remount.mjs', 'smoke_nav_persist.mjs', 'smoke_warm_mode_adoption.mjs'],
    because: '#756: the warm editor tail — draft revival once the mode is committed and the '
      + 'refit hold on the adopted camera — is observed only as the revived draft, the '
      + 'frame-by-frame viewport after a remount (immediate or after can_write) and the '
      + 'pending mode entering through _setMode; no smoke names these helpers',
  },
];

/** Смоки, связанные с изменёнными символами или точными путями через реестр. */
export function registeredSmokes(changedSymbols, changedFiles = []) {
  const changed = new Set(changedSymbols);
  const files = new Set(changedFiles);
  const out = new Map();
  for (const link of SMOKE_LINKS) {
    const hit = (link.symbols || []).filter((symbol) => changed.has(symbol)).sort();
    const fileHit = (link.files || []).filter((file) => files.has(file)).sort();
    if (!hit.length && !fileHit.length) continue;
    for (const smoke of link.smokes) {
      const entry = out.get(smoke) || { smoke, symbols: [], because: [] };
      entry.symbols = [...new Set([...entry.symbols, ...hit])].sort();
      if (fileHit.length) entry.files = [...new Set([...(entry.files || []), ...fileHit])].sort();
      if (!entry.because.includes(link.because)) entry.because.push(link.because);
      out.set(smoke, entry);
    }
  }
  return [...out.values()].sort((a, b) => a.smoke.localeCompare(b.smoke));
}
