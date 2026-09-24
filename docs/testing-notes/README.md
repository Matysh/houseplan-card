# Приложения к TESTING.md — индекс

Ручные чек-листы по поверхностям и приложения по отдельным issue, перенесённые
из [`docs/TESTING.md`](../TESTING.md) дословно (#634). Действующие правила и
гейты — в самом `TESTING.md`. Искать по номеру issue или теме:
`grep -n "#293" docs/testing-notes/README.md`. Полноту индекса и каждую ссылку
сверяет `test/testing-notes-index.test.mjs`: раздел без строки здесь — красный
тест.

## [Ручной чек-лист по поверхностям](core-checklist.md)

- [Modes (v1.25.0) ★](core-checklist.md#modes-v1250-)
- [Onboarding ★](core-checklist.md#onboarding-)
- [Spaces ★](core-checklist.md#spaces-)
- [Room markup editor ★](core-checklist.md#room-markup-editor-)
- [Devices on the plan ★](core-checklist.md#devices-on-the-plan-)
- [Device dialog (markers) ★](core-checklist.md#device-dialog-markers-)
- [Icon rules ★](core-checklist.md#icon-rules-)
- [Tap actions & gestures ★](core-checklist.md#tap-actions--gestures-)
- [Zoom / pan / labels](core-checklist.md#zoom--pan--labels)
- [Multi-client & concurrency ★](core-checklist.md#multi-client--concurrency-)
- [houseplan-space-card (read-only embedded)](core-checklist.md#houseplan-space-card-read-only-embedded)
- [Doors, windows & gates (v1.23.0+)](core-checklist.md#doors-windows--gates-v1230)

## [Диалоги, формы и сводная панель](dialogs-and-forms.md)

- [Вопрос о несохранённых настройках (#610)](dialogs-and-forms.md#вопрос-о-несохранённых-настройках-610)
- [Числовые поля со слайдером (#608)](dialogs-and-forms.md#числовые-поля-со-слайдером-608)
- [Toggle confirmation state (#103)](dialogs-and-forms.md#toggle-confirmation-state-103)
- [Unified color and opacity picker (#57)](dialogs-and-forms.md#unified-color-and-opacity-picker-57)
- [Unified picker coverage for every color field (#180)](dialogs-and-forms.md#unified-picker-coverage-for-every-color-field-180)
- [Contextual help (issues #68 and #86)](dialogs-and-forms.md#contextual-help-issues-68-and-86)
- [Help & private feedback (#43)](dialogs-and-forms.md#help--private-feedback-43)
- [v1.71 audit polish (#434)](dialogs-and-forms.md#v171-audit-polish-434)
- [Надёжность сводной панели (#493)](dialogs-and-forms.md#надёжность-сводной-панели-493)
- [Идентичность сводной панели в Masonry (#561)](dialogs-and-forms.md#идентичность-сводной-панели-в-masonry-561)
- [Доступность основного View (#565)](dialogs-and-forms.md#доступность-основного-view-565)

## [Устройства и маркеры](devices.md)

- [Device icon design package (#179)](devices.md#device-icon-design-package-179)
- [Dense device-marker hit ownership (#564)](devices.md#dense-device-marker-hit-ownership-564)
- [Device marker polish and pointer modality (#212)](devices.md#device-marker-polish-and-pointer-modality-212)
- [Device value badge (#90)](devices.md#device-value-badge-90)
- [HA-disabled binding gate](devices.md#ha-disabled-binding-gate)
- [HA Area marker relocation (#126)](devices.md#ha-area-marker-relocation-126)
- [Device display preview and face parity](devices.md#device-display-preview-and-face-parity)
- [Device icon package parity (#211)](devices.md#device-icon-package-parity-211)
- [Device marker geometry and input polish (#213)](devices.md#device-marker-geometry-and-input-polish-213)
- [Text marker shell shape (#217)](devices.md#text-marker-shell-shape-217)
- [Device lock and orange foreground palette (#219)](devices.md#device-lock-and-orange-foreground-palette-219)
- [Unified device status and pulse activity (#98)](devices.md#unified-device-status-and-pulse-activity-98)
- [Climate temperature opt-in (dev)](devices.md#climate-temperature-opt-in-dev)
- [Styling hooks and HA-formatted values (docs/STYLING-HOOKS.md, dev, unreleased)](devices.md#styling-hooks-and-ha-formatted-values-docsstyling-hooksmd-dev-unreleased)

## [Геометрия: стены, проёмы, комнаты, холст](geometry.md)

- [Stable wall-segment identity (#282)](geometry.md#stable-wall-segment-identity-282)
- [Legacy draft migration and atomic wall-chain writes (#314, #478)](geometry.md#legacy-draft-migration-and-atomic-wall-chain-writes-314-478)
- [Current-writer fixed point (#477)](geometry.md#current-writer-fixed-point-477)
- [Resize: реальный pointer pipeline (#293)](geometry.md#resize-реальный-pointer-pipeline-293)
- [Opening symbol centreline (#242, #250)](geometry.md#opening-symbol-centreline-242-250)
- [Empty-space lifecycle (#113)](geometry.md#empty-space-lifecycle-113)
- [Fixed card space (#210)](geometry.md#fixed-card-space-210)
- [Open passage (#157)](geometry.md#open-passage-157)
- [Independent-wall openings and structural axes (#132, #185)](geometry.md#independent-wall-openings-and-structural-axes-132-185)
- [Independent-wall opening jamb margin (#186)](geometry.md#independent-wall-opening-jamb-margin-186)
- [Room resize (docs/RESIZE.md)](geometry.md#room-resize-docsresizemd)
- [Infinite canvas (docs/CANVAS.md, dev)](geometry.md#infinite-canvas-docscanvasmd-dev)
- [«+» adds a space from anywhere (dev, unreleased)](geometry.md#-adds-a-space-from-anywhere-dev-unreleased)
- [Honest new-space display defaults (#204, dev, unreleased)](geometry.md#honest-new-space-display-defaults-204-dev-unreleased)
- [Wall thickness (docs/WALL-THICKNESS.md, Unreleased)](geometry.md#wall-thickness-docswall-thicknessmd-unreleased)
- [Wall chains, partitions and columns](geometry.md#wall-chains-partitions-and-columns)
- [Вписывание выбранной комнаты (#152)](geometry.md#вписывание-выбранной-комнаты-152)

## [Декор, подложка, мебель, слои](decor-and-backdrop.md)

- [Decor composition order (#231)](decor-and-backdrop.md#decor-composition-order-231)
- [Custom decor images (#51)](decor-and-backdrop.md#custom-decor-images-51)
- [Backdrop picture: move & scale (docs/BACKDROP.md, dev)](decor-and-backdrop.md#backdrop-picture-move--scale-docsbackdropmd-dev)
- [«Already uploaded» plan picker (dev, unreleased)](decor-and-backdrop.md#already-uploaded-plan-picker-dev-unreleased)
- [The furniture library (docs/FURNITURE.md, dev, unreleased)](decor-and-backdrop.md#the-furniture-library-docsfurnituremd-dev-unreleased)
- [The furniture library (docs/FURNITURE.md, dev, unreleased)](decor-and-backdrop.md#the-furniture-library-docsfurnituremd-dev-unreleased-1)
- [Large backdrops (#39, docs/specs/039-large-backdrops.md)](decor-and-backdrop.md#large-backdrops-39-docsspecs039-large-backdropsmd)
- [Plan upload over HTTP and the 8 MB limit (#617)](decor-and-backdrop.md#plan-upload-over-http-and-the-8-mb-limit-617)
- [Hiding layers: decor, openings, zero-thickness walls (docs/UX-MODES.md)](decor-and-backdrop.md#hiding-layers-decor-openings-zero-thickness-walls-docsux-modesmd)

## [Живые слои и интеграции](live-and-integrations.md)

- [PDF export polish (#482)](live-and-integrations.md#pdf-export-polish-482)
- [Многоэтажный робот: карты и пространства (#162)](live-and-integrations.md#многоэтажный-робот-карты-и-пространства-162)
- [Vacuum trail smoothing (#209)](live-and-integrations.md#vacuum-trail-smoothing-209)
- [Live vacuums (docs/VACUUM.md)](live-and-integrations.md#live-vacuums-docsvacuummd)
- [Sun on the plan (docs/SUN.md)](live-and-integrations.md#sun-on-the-plan-docssunmd)
- [The text block on the plan (docs/LIVE-TEXT.md, dev, unreleased)](live-and-integrations.md#the-text-block-on-the-plan-docslive-textmd-dev-unreleased)
- [Sun ray rim (docs/SUN.md «The rim», dev, unreleased)](live-and-integrations.md#sun-ray-rim-docssunmd-the-rim-dev-unreleased)
- [Coming back to the tab (docs/WARM-REMOUNT.md, dev, unreleased)](live-and-integrations.md#coming-back-to-the-tab-docswarm-remountmd-dev-unreleased)
- [Реальная raw-карта Zigbee2MQTT (#450)](live-and-integrations.md#реальная-raw-карта-zigbee2mqtt-450)
- [Порядок слоя Zigbee-топологии (#464)](live-and-integrations.md#порядок-слоя-zigbee-топологии-464)
- [Полнота источников радара (#545)](live-and-integrations.md#полнота-источников-радара-545)

## [Инфраструктура тестов и съёмки](infrastructure.md)

  - [Issue #73 baseline and implementation (2026-08-11)](infrastructure.md#issue-73-baseline-and-implementation-2026-08-11)
- [Lazy editor runtime and frontend asset tree (#337)](infrastructure.md#lazy-editor-runtime-and-frontend-asset-tree-337)
- [Съёмка документации запускается с флагами детерминизма (#424)](infrastructure.md#съёмка-документации-запускается-с-флагами-детерминизма-424)
- [Воспроизводимость съёмки документации (#410, #422)](infrastructure.md#воспроизводимость-съёмки-документации-410-422)

## [История прогонов и партий](history.md)

- [Last self-run](history.md#last-self-run)
- [Batch 2026-08-04 (dev, unreleased)](history.md#batch-2026-08-04-dev-unreleased)
