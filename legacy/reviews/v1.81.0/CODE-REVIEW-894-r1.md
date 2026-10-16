# CODE-REVIEW-894-r1

Материал: ветка `issue/894-view-recovery`, точный SHA
`7cdf0d768b8eeb6f55f2aeb4f2c74e559f13a28b`, база `origin/dev` на момент диффа.
Трек: `ask`. Заход r1 (бюджет циклов этапа code: 0/4 израсходовано).
ТЗ: тело issue #894, принятое SPEC-REVIEW-894-r2 (зелёное), body sha256
`eb60331838f9fa72190cfa4af820675a1970ee9ff5d60b37d4401736fb7d9739`.

## Скоуп

Диапазон `origin/dev..HEAD` — 6 коммитов, 47 файлов, +1098/-58:

- `src/opening-context.ts` (новый) — стабильная идентичность opening-попапа по
  `(spaceId, openingId)`, имена lock/contact/room, eligibility.
- `src/warm-marker-restore.ts` (новый) — контроллер тёплого View-драфта маркера:
  черновик не публикуется без готового ленивого рантайма редактора.
- `src/kiosk-viewport-recovery.ts` (новый) — one-shot memo камеры киоска
  (sessionStorage, scoped по DOM-размещению/route/config/account, TTL 10 мин).
- `src/houseplan-card.ts`, `src/version-recovery-card.ts`,
  `src/device-editor-access.ts`, `src/devices.ts`, `src/room-fit.ts`,
  `src/styles/plan.styles.ts` — точки интеграции: `_syncOpeningInfo`,
  `_warmMarker`, `_reloadDocument(automatic)`, `cardVersionReloadSafetySnapshot`
  (обход `baseZoom` только для non-carousel kiosk), `roomAreaAffordance` (View-only
  интерактивность), `isLightGroupDevice`, native 44px `.rlarea` кнопка.
- i18n (`de/en/fr/ru`): `opening.info_named`, `opening.contact_named`,
  `opening.lock_named`, `room.open_area_named`.
- Тесты: 5 новых/расширенных unit-файлов, 2 новых смока
  (`smoke_kiosk_viewport_recovery.mjs`, `smoke_view_entry_recovery.mjs`,
  `smoke_warm_view_marker.mjs` — 3 новых), правки в 6 существующих смоках,
  записи в `scripts/smoke-links.mjs` и `scripts/mutation-registry.mjs`.
- Документация: ARCHITECTURE/DEVICE-PRESENTATION/UX-MODES/WARM-REMOUNT/STATUS/
  DEVELOPMENT/USER-GUIDE(ru+en)/CHANGELOG(ru+en)/data-hp-contract.json/
  release-ledger.

Покрываемые Core user jobs (docs/SCOPE.md): J1/J2/J3 (View) — достоверная
идентификация проёма, безопасный доступ к HA Area, узнаваемая иконка группы;
не расширяет скоуп за заявленные J1/J2/J3/дубликаты (#846/#844/#878/#462
проверены границы — пересечений не найдено).

## Как проверялось

Полное чтение диффа по файлам (не только патч-контекст): `opening-context.ts`,
`warm-marker-restore.ts`, `kiosk-viewport-recovery.ts`,
`version-recovery-card.ts`, `device-editor-access.ts`, `devices.ts`,
интеграционные хуки в `houseplan-card.ts` (willUpdate/`_reloadDocument`/
`_syncOpeningInfo`/`_warmMarker`/`_renderOpeningInfoCard`/`_renderRoomLabel`),
`room-fit.ts` (`planGestureOwnerFromPath`), `plan.styles.ts` (`.rlarea`).
Для каждого из 7 AC — сопоставление контракта из тела issue с реализацией и
тестом, который его доказывает (unit и/или нативный смок), включая чтение
самого смок-сценария, а не только его имени. Проверено, что узкая
интерактивность Area (`view`-флаг) и соответствующая правка
`smoke_view_edit_permissions.mjs` (`mode === 'view'` вместо `mode !== 'plan'`)
согласованы и означают намеренное сужение, требуемое AC3.
Отдельно проверено отсутствие визуального риска: golden-сцены не кодируют ни
opening-info popup, ни device:-Z2M-group сценарий (`grep` по `demo/golden/*.mjs`
не нашёл совпадений) — баз в диффе не меняли (`git diff --stat` не содержит
`demo/golden/baselines/**`), риск точечной pixel-регрессии от 44px-кнопки
снят отдельным фокусным CSS-фиксом (`.rlarea > ha-icon { display: inline-flex }`)
и измерен `smoke_room_link`'s новым `painted-area-icon-parity` oracle по
shadow-SVG, а не по внешнему боксу.
Трейлеры всех 6 коммитов проверены (`git log` + `git show`): `Issue: #894` на
каждом, `User-Visible: yes` на 5 из 6, оба CHANGELOG правлены в этих же
коммитах; единственный `User-Visible: no` — тестовый коммит без изменений
продукта и без правки changelog (корректно).
Классификация ledger (`docs/release-ledger/v1.80.1/894.json`) — `stable-fix`
с обоснованием по истории поведения (opening/warm/Area/device-группы и
baseZoom существовали до v1.80.1), не `line-fix` по дате документации — ровно
то, что требовал M1/Low SPEC-REVIEW-894-r1→r2.
Golden-гейт на точном SHA материала проверен напрямую через GitHub API
(`gh run view 38695234175`), а не только со слов автора: job «Golden-кадры
против принятых эталонов» → `success`.

### Гейты

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонялся | зелёный Validate на точном SHA `7cdf0d76`, run 38695234175 — подтверждён инструкцией ревью (#343), дополнительно проверено через `gh run view`, все предполётные/фронтенд/бэкенд джобы `success` |
| `golden:verify` (метка `ci:golden`) | не перегонялся локально | та же CI-сборка, job «Golden-кадры против принятых эталонов» → `success` (проверено напрямую API, не только по комментарию автора); `demo/golden/baselines/**` в диффе отсутствует — PNG не менялись |
| Смоки по диффу (`smoke-select`) | не перегонял `smoke-select.mjs` сам; прочитаны тексты всех названных автором и добавленных в `scripts/smoke-links.mjs` смоков (`smoke_view_entry_recovery`, `smoke_warm_view_marker`, `smoke_kiosk_viewport_recovery`, плюс правки в `smoke_room_fit/room_link/esc_dialogs/device_preview_parity/kiosk_cycle_context/view_edit_permissions`) и подтверждено их исполнение в CI 38695234175 (3 browser-шарда → `success`) | CI + построчное чтение сценариев |
| `pytest tests_backend` | не применимо | диф не трогает Python/`custom_components/**` |
| Инварианты модели (`npm run invariants`) | не прогонял | `opening-context.ts` — геометрически классифицирован «risky hunk», но по факту это резолвер идентичности `(spaceId, openingId)` без координатной/полигональной математики; геометрия плана (`src/geometry/**`, стены, точки) не тронута. Автор прогнал `model-invariants.mjs` на реальном пользовательском экспорте 2-го этажа (`violations[]/notes[]`) сверх требуемого — не обязательный для этого диффа гейт, но не противоречит |
| Мутанты (реестр) | не исполнял | политика #709: в разработке не гоняются ни на каком треке; 5 новых мутантов (`opening-popup-keeps-retained-config-object`, `warm-view-marker-publishes-without-renderer`, `room-area-button-loses-touch-floor`, `room-area-icon-keeps-block-baseline`, `kiosk-document-recovery-drops-camera`) зарегистрированы с `guard`, который существует и указывает на реальный нативный смок; поимку проверит ночь |
| Performance-смок | не перегонял | AC по производительности защищены не числовым бюджетом, а архитектурными негативами (bounded-load/concurrent-completion assertions внутри `smoke_warm_view_marker` и `smoke_kiosk_viewport_recovery`); явного количественного AC по perf в ТЗ нет, perf-джоб в CI 38695234175 (`Перф-смок: бюджет времени кадра`) — `success` |

Условие честности: npm-гейты и golden не перегонялись мной лично — я свёл их
к зафиксированному зелёному CI-прогону на точном материале ревью и проверил
этот прогон инструментом (`gh run view`), а не поверил тексту комментария.
Смоки и мутанты по диффу разобраны чтением исходного кода сценариев и реестра,
исполнение — через тот же CI.

## AC × доказательство (защитные — с «чем краснеет»)

| AC | Тип | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 (retained object, re-resolve by id, rebind retires unlock) | защитный | `test/opening-context.test.mjs` (4 теста, включая «тот же id в другом пространстве — не цель»), нативный `smoke_view_entry_recovery.mjs` (`accepted-rebind-retires-unlock`, `accepted-delete-closes-popup`, `queued-old-target-refused`, `exact-door-names` на RU/EN 360/1280) | мутант реестра `opening-popup-keeps-retained-config-object` (guard `smoke_view_entry_recovery.mjs`) + unit-негативы (чужое пространство, удалённый opening) |
| AC2 (warm draft не публикуется без рантайма; fail/retry/close/permission/disconnect/newer не дают скрытого ack) | защитный | `test/warm-marker-restore.test.mjs` (3 теста: once-after-ready, 3 инвалидации, denied/failed), нативный `smoke_warm_view_marker.mjs` (7 режимов: success/close/permission/identity/disconnect/failure/newer, включая DOM-проверку, а не только приватные поля) | мутант `warm-view-marker-publishes-without-renderer` (guard `smoke_warm_view_marker.mjs`) |
| AC3 (отдельная 44px keyboard/touch Area-кнопка без fit/drag/double-tap fallthrough; View-only) | защитный | `test/device-editor-access.test.mjs` (полный перебор 5 булевых флагов), `test/room-fit.test.mjs` (`.rlfit`/`.rlarea` в path), нативный `smoke_view_entry_recovery.mjs` (Tab/Enter/Space, двойной tap, aria-label, 44px rect, focus-ring), `smoke_view_edit_permissions.mjs` (`mode==='view'` навигация) | мутанты `room-area-button-loses-touch-floor`, `room-area-icon-keeps-block-baseline` (guards `smoke_view_entry_recovery.mjs`/`smoke_room_link.mjs`) + мутанты #844, обновлённые под новую сигнатуру |
| AC4 (registry-certified device/entity light-group → единая иконка на всех поверхностях; custom выше; похожие/несветовые не триггерят) | защитный | `test/light-group-icon-878.test.mjs` (2 новых теста с явными негативами: похожая модель/имя, non-light entity, другой владелец), нативный `smoke_device_preview_parity.mjs` (`deviceGroup894SharedIcon/…TargetsUnchanged`) | отрицательный случай встроен в сам unit-тест (не мутант реестра) — соответствует правилу «мутант ИЛИ негатив в тесте» |
| AC5/AC6 (non-carousel kiosk обходит только `baseZoom`; прочие предикаты блокируют; one-shot camera memo; deleted-floor fallback) | защитный | `test/version-recovery-card.test.mjs` (новый тест явно проверяет, что обход — только `baseZoom`, 8 прочих предикатов продолжают блокировать), `test/kiosk-viewport-recovery.test.mjs` (malformed/expired/future/blocked-storage негативы), нативный `smoke_kiosk_viewport_recovery.mjs` (6 сценариев: ordinary/fixed/single/deleted/carousel/same-version, включая `interaction-pause-blocks`, `one-real-reload-no-modal`, `ownMemos===0`) | мутант `kiosk-document-recovery-drops-camera` (guard `smoke_kiosk_viewport_recovery.mjs`) |
| AC7 (golden: заявленные намеренные изменения, остальное без сдвига) | не защитный, визуальный | Golden job зелёный на точном SHA (проверено `gh run view`), `demo/golden/baselines/**` не менялся в диффе, golden-сцены не кодируют ни opening-popup, ни device-group сценарий (точечный риск отсутствует) | — |

Пустых третьих столбцов по защитным AC нет.

## Находки

Находок нет (High: 0, Medium: 0, Low: 0).

## Что проверено и корректно

- **Идентичность, не объект.** `currentOpeningContext` резолвит по
  `(spaceId, openingId)` из актуального `_curSpaceCfg`, никогда не держит
  ссылку на старый конфиг; `_syncOpeningInfo()` вызывается в `willUpdate` при
  смене `_serverCfg`/`_space`/`_openingInfo` и присваивает тот же объект при
  отсутствии изменений (без петли реактивности, т.к. `.find()` по тому же
  массиву возвращает ту же ссылку).
- **Отмена устаревшей unlock-confirmation** — `_syncOpeningInfo` вызывает
  `_cancelDangerConfirm()` именно при смене биндингов/исчезновении,
  до `_lockAction` всё равно повторяется `currentTarget()` — двойная защита.
- **Warm draft** публикуется ровно один раз после `ensure()` (ленивый рантайм),
  и только если `allowed()` остаётся истинным на момент резолва промиса
  (serial-based race guard против поздних completion); `reconcile()` в
  `willUpdate` закрывает черновик при потере права/смене контекста без
  ожидания следующего события.
- **Area-кнопка** — `e.stopPropagation()` на `pointerdown`/`dblclick`/`keydown`/
  `keyup` реально прерывает всплытие до `_stagePointerDown` (а не полагается
  только на `composedPath`-фильтрацию), поэтому room-fit/drag не срабатывают
  структурно, а не по удаче; имя комнаты (`.rlfit`) сохраняет pointer-fit через
  расширенный селектор в `planGestureOwnerFromPath`.
  `roomAreaAffordance` корректно сужает `interactive` именно до View
  (`!plan && view`), `visible` не регрессирует для Plan/Devices/Decor.
- **Иконка группы** — `isLightGroupDevice` использует уже построенный
  индекс `allEntityIds` устройства (не новый скан реестра на тик), применяется
  во всех трёх путях сборки (`buildDevices` auto-roster, saved device-marker,
  saved entity-marker уже имел его через #878) и в `autoIconForBinding`
  (Auto-поле/preview); `applyMarker` сохраняет приоритет явной `m.icon`.
- **Kiosk recovery** — `nonCarouselKiosk` корректно исключает `cycle>0` без
  `fixed`/`single`; `_reloadDocument(automatic)` бросает исключение, если
  автоматический (не ручной) reload не смог сохранить memo — не «молча»
  теряет камеру; `takeKioskViewport` удаляет ключ при первом чтении (one-shot)
  и не трогает прочие ключи sessionStorage; TTL 10 минут и строгая валидация
  числовых полей (`Number.isFinite`, диапазон zoom) защищают от повреждённого
  JSON.
- **i18n** — все 4 словаря (`de/en/fr/ru`) синхронно получили 4 новых ключа;
  `test/i18n.test.mjs` осознанно допускает совпадение DE==EN для двух из них
  с явным обоснованием в комментарии.
- **Changelog/ledger/trailers** — согласованы между собой; не нашёл числа,
  видимого пользователю дважды с разными источниками (44px/60s/10 мин не
  дублируются в CHANGELOG, только в технической документации).

## Чего не проверял

- Не запускал `npx tsc --noEmit`, `npm test`, `npm run build`,
  `golden:wsl:capture`, `smoke-select.mjs`, мутанты реестра и
  `model-invariants.mjs` локально — опирался на подтверждённый зелёный Validate
  на точном SHA (проверен инструментом `gh run view`, не только по тексту
  комментария) и на чтение кода/сценариев тестов. Ручного тестирования в
  браузере (вне CI) не проводил.
- Не проверял реальным ручным кликом в браузере фокус-кольцо, 44px-зону и
  double-tap — это сделано нативными Playwright-смоками в CI; я прочитал их
  код и убедился, что ассерты не тавтологичны (измеряют реальные `getComputedStyle`/
  `getBoundingClientRect`/`activeElement`, а не приватные поля).
- Не пересчитывал вручную CSS-математику `.rlarea` (`margin-inline-end: calc(0.85em - 44px)`)
  — визуальная идентичность подтверждена фокусными golden-замерами автора
  (504→34px, 287→191px, 1416→0px в пределах существующих порогов) и отдельным
  `painted-area-icon-parity` oracle в `smoke_room_link`, оба исполнены в CI.
- Не проверял нагрузочное/конкурентное поведение `_warmMarker` за пределами
  сценариев, явно заданных в `smoke_warm_view_marker.mjs` (7 режимов из ТЗ) —
  более широкий fuzz не требуется ни одним AC.
- Не читал полную историю batch-координации и промежуточных SHA в комментариях
  issue (их десятки) — материал ревью зафиксирован ровно на `7cdf0d76`, более
  ранние промежуточные SHA не являются предметом разбора.

## Риск по изменённым участкам (#707/#726)

Трек `ask`: все три поднятых класса покрыты AC ТЗ явно (см. таблицу AC выше):
`geometry` (`opening-context.ts`, на деле резолвер идентичности, не координатная
геометрия) → AC1/AC2; `touch` (`.rlarea` pointerdown/dblclick stopPropagation) →
AC3; `ux` (новые i18n-ключи) → AC1/AC3. Класс `geometry` помечен эвристикой по
имени файла (`opening-*`); по факту кода геометрических вычислений в
`opening-context.ts` нет — инварианты модели не требуются для этого файла,
что отражено в таблице гейтов.

Маршрут: `fix` (трек `ask`, `reclassify` не применяется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/894-view-recovery`, коммит `7cdf0d768b8e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `716024e5636a38aef02302b1e69229d5f07b80ec`
  ```
  git log --all --format='%H %T' | grep 716024e5636a
  ```
- Тело issue: `eb60331838f9fa72190cfa4af820675a1970ee9ff5d60b37d4401736fb7d9739`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MzEsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzIwOTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTM2LCJvdXRwdXRfdG9rZW5zIjozNTc0OSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxNjAyMTYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3ODM5MzI5LCJjb3N0VXNkRXN0aW1hdGUiOjIuNTY2NDkxODAwMDAwMDAxfV0sInR1cm5zIjo3OSwiZHVyYXRpb25NcyI6NDk5OTcxLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi41NzEyMTI4MDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4767 output_tokens=35767 cache_creation_input_tokens=160216 cache_read_input_tokens=7839329 num_turns=79 -->
