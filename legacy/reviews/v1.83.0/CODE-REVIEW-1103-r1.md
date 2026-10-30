# Code review — issue #1103, round r1

Материал: `07e955757a1176b77a642d13ab61c279deb270f9` (ветка issue/1103-route-kiosk).
Трек: ask. Этап: code (PROCESS.md §2.7).

## Скоуп

URL-вход в существующий киоск House Plan прямо на основной sidebar-странице
`/houseplan`: две равнозначные (с приоритетом path) формы — `/houseplan/kiosk[/N]`
и `?hpkiosk=1[&hpspace=N]`. Новое runtime-свойство `card.routeKiosk = { enabled,
position }` передаёт намерение от тонкого host (`houseplan-panel`) карточке;
карточка сама разрешает позицию против собственной авторитетной упорядоченной
модели (host ростер не читает). Изменённые файлы: `src/route-kiosk.ts`,
`src/panel-route-kiosk.ts` (новые), `src/houseplan-panel.ts`,
`src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
`src/config-reload-authority.ts`, `src/editors/draft-actions.ts`,
`src/version-recovery-card.ts`, тесты, golden-сцены, документация,
release-ledger, реестры.

Обслуживаемая строка Core user jobs (docs/SCOPE.md): J1/J3 — домочадец на
настенном планшете получает план/киоск без отдельного дашборда; администратор
настраивает фиксированное пространство по ссылке.

## Как проверялось

1. Прочитан `read:diff`/`read:log` (манифест материала) — полный дифф (30
   файлов) прочитан целиком, не выжимкой.
2. Независимый разбор кода до сопоставления с хендоффом:
   - `src/route-kiosk.ts`, `src/panel-route-kiosk.ts` — грамматика path/query,
     нормализация позиции, `resolveRouteFloor`/`resolvePresentationFloor`,
     `presentationRouteOwner`. Прослежено вручную против `src/initial-load.ts`
     (`resolveFixedFloor`) построчно для всех классов вход-значений из таблицы
     примеров ТЗ (0, отрицательное, дробное, текст, ведущие нули, overflow,
     2^53, `%zz`, двойной `//`, `/kiosk/2/extra`).
   - `src/houseplan-card.ts`: `routeKiosk` setter/getter (generation-counter,
     `hass.connection/user` guard, `_retireRouteDialogs`, `_adoptInitialSpace`),
     `_kiosk`/`_hasFixedFloor`/`_fixedFloorState` — сверено, что **все** прямые
     чтения `config?.kiosk` в этом файле и во всех потребителях
     (`houseplan-editor-runtime.ts`, `view-runtimes.ts`, `version-recovery.ts`,
     `version-recovery-card.ts`, `backup-import-intent.ts`,
     `device-editor-access.ts`, `space-order.ts`, `zigbee-topology-overlay-bridge.ts`
     и др. — полный grep по `\.kiosk\b` в `src/**/*.ts`) мигрированы на единый
     `_kiosk` getter; расхождений не найдено (требование п.5 ТЗ выполнено).
   - Разбор извлечения `_retireRouteDialogs()` из `_leaveCardRoute()`: отдельно
     проверено, что поля, перенесённые в `houseplan-editor-runtime.ts`-часть
     (`_markerDialog`, `_settingsDialog`, `_rulesDialog`, `_openingDialog`,
     `_backdropDialog`, `_decorShapeDialog/_decorTextDialog`, `_mergeDialog`,
     `_roomDialog`, `_wallDialog`, `_physicalDialog`, `_deviceInbox*`,
     `_supportDialog`, `_backupImportDialog/_backupExportDialog`,
     `_backupImportIntent`) **никогда** не устанавливаются без уже загруженного
     `_editorRuntime` (подтверждено построчно: `_openMarkerDialog`,
     warm-revive-путь на `d.kind === 'marker'`, `_pickEmptyBackupImport` и
     рендер `_backupImportDialog && this._editorRuntime`), поэтому
     `this._editorRuntime?._retireRouteDialogs()` не теряет сброс ни одного из
     них — поведение эквивалентно прежнему безусловному списку. `_kioskDialog`
     (View-уровневый, не editor-gated) и `_spaceDialog`/`_importDialog`
     корректно остались на уровне карточки, не перенесены.
   - `src/houseplan-panel.ts`: порядок `PRE_UPGRADE_PROPERTIES`
     (`panel, hass, narrow, route`), `_applyRouteKiosk()` до `setConfig`,
     `_onRouteApplied`/`_onLocationChanged` (bounded listener), откат URL при
     отложенном (dirty-guard) применении — прослежено, что intent передаётся
     карточке до первого кадра и что host не делает WS-вызовов.
   - `src/config-reload-authority.ts`: `presentationRouteOwner` сворачивает
     путь панели к первому сегменту только для `panelHost`, не трогая обычные
     dashboard-карточки — проверено по `sameReloadContext` и соответствующему
     unit-тесту.
3. Сопоставление с зелёным proof: `validate-gate`
   https://github.com/Matysh/houseplan-card/actions/runs/40656135755 —
   «review-light-golden proof is complete». Browser job reused (26 smoke + 2
   golden, включая `smoke_panel_route_kiosk.mjs` и обе новые golden-сцены
   `panel-wide-kiosk-all`/`panel-narrow-kiosk-fixed`), `gate:small` PASS
   (0 failed), `process-gate.mjs --range origin/dev..HEAD --issues` PASS (0
   предупреждений — трейлеры Issue/User-Visible подтверждены этим гейтом),
   `mutation-gate.mjs --check` PASS (статическая регистрация, 2 новых
   свидетеля `panel-route-kiosk-ignored` и `route-kiosk-empty-admin-onboards`
   зарегистрированы, не исполнялись — согласовано с policy #905).
4. Проверены релиз-артефакты: CHANGELOG.md/.ru.md оба правлены тем же коммитом
   (User-Visible: yes), `docs/release-ledger/v1.82.0/1103.json` (category
   `major`, обоснование — функции не было в v1.82.0 stable), единственный
   источник числа `bundleBytes` (`scripts/monolith-baseline.json` ↔
   `docs/DEVELOPMENT.md` prose) — оба указывают 3649075 B, расхождения нет.
   `docs/STATUS.md` Tests-строка (+7 unit, +1 smoke) арифметически совпадает с
   добавленными файлами (`route-kiosk.test.mjs` — 6 `test()`,
   `version-recovery-card.test.mjs` — +1).

## Что НЕ перепроверялось заново (переиспользовано)

- Полный `npm run gate:small` / `npm test` / browser-смоки — не повторялись:
  зелёный proof на этом же SHA уже покрывает путь/query парсинг, authority
  pending→valid/absent, live reorder/delete/add, Back/Forward, dirty
  Keep/Discard, read-only/admin empty kiosk, DOM-bounds/touch-swipe и
  WS-счётчики (AC1–AC8). Независимый разбор кода не выявил ни одного
  расхождения с этим proof, которое требовало бы адресного перезапуска.
- `build:typecheck`/`build:build` — не запускались отдельно: `gate:small`
  уже включает `tsc --noEmit && rollup -c` на этом SHA (шаг «сборка +
  typecheck»), и тот же PASS зафиксирован в хендоффе; материал с тех пор не
  менялся.
- Мутационное исполнение — не запускалось и не запускалось бы: политика
  запрещает исполнение мутантов вне ночного workflow; оба новых свидетеля
  честно отмечены «не исполнялся» в хендоффе и покрывают ровно то, что не
  может иначе покраснеть (host игнорирует intent; пустой admin получает
  wizard) — соответствует требованию §2.7/#435 для defensive AC.

## Находки

Находок уровня High или Medium в скоупе не обнаружено.

Разобранная гипотеза регрессии (не подтвердилась): перенос сброса
editor-диалогов (`_backupImportIntent.cancel`, `_markerDialog` и т. д.) в
`this._editorRuntime?._retireRouteDialogs()` выглядел потенциально опасным,
если бы эти поля могли быть установлены без загруженного `_editorRuntime`.
Построчная проверка всех точек присваивания показала, что это невозможно:
каждый такой диалог уже требует `_ensureEditorRuntime()` на пути открытия, а
асинхронные продолжения (`_pickEmptyBackupImport`, `_openMarkerDialog`)
перепроверяют `this._kiosk`/`_canImportEmptyBackup`/`deviceEditorAllowed`
непосредственно перед действием — так что даже гонка «routeKiosk применился
раньше, чем резолвился лениво загружаемый editor runtime» не приводит к
потере данных или пропуску сброса. Отдельного запуска не потребовалось:
вывод получен чтением, не исполнением.

## Риск по изменённым участкам (#707)

`src/config-reload-authority.ts:1,194,204` (класс migration) — импорт и два
изменённых места (`configReloadContext` сигнатура host/`route`) покрыты
`test/route-kiosk.test.mjs` («panel internal paths retain read authority; other
panels/users/connections and dashboard routes remain separate») и
независимо прослежены против `sameReloadContext`/AC7. Покрытие подтверждено.

## Проверено чтением, не исполнением

- Гонка `_ensureEditorRuntime()` vs routeKiosk-переход (см. «Находки» выше).
- Повторная (двойная) смена routeKiosk до разрешения первого dirty-guard —
  прослежен generation-counter и `_cancelDangerConfirm`/`keep()`-колбэк;
  устаревший `keep()` не перезаписывает более новый `_routeKioskPending`
  благодаря сравнению generation. Поведение согласовано с контрактом
  («Discard сохраняет ровно запрошенный URL», «late reply не действует»).
- Порядок `PRE_UPGRADE_PROPERTIES` и двойной вызов `_applyRouteKiosk()` до
  первого кадра (внутри `_ensureShell()` с fallback-данными и повторно из
  setter `route` с финальными) — не создаёт видимого мерцания, так как оба
  вызова происходят синхронно до первого `setConfig`/рендера.

## Вердикт

**green.** Контракт ТЗ (путь/query, приоритет path, 1-based позиция с мягким
fallback, authority pending→valid/absent, runtime-граница host/card без
ростера на host, draft-guard, release-артефакты) выполнен и подтверждён
существующим зелёным proof плюс независимым построчным разбором без найденных
расхождений.

Гейты: прогнаны — `read:diff`, `read:log` (данный заход). Переиспользованы без
повторного запуска — `validate-gate` (40656135755, browser-смоки+golden reused),
`gate:small`, `process-gate --issues`, `mutation-gate --check` (все с этого же
SHA, см. «Что НЕ перепроверялось заново»). Не запускались и не требовались —
полный ночной/E2E набор (вне объёма code-review при наличии валидного
S7-доказательства; E2E для этой задачи по хендоффу идёт перед бетой по #1091).

Маршрут: `fix` согласно заданному маршруту вердикта (#726); находок, которые
требовали бы отдельного issue, не обнаружено. Побочных находок вне скоупа
нет — `outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImJhYTE0Mzc4YWE4NWE2MzdkNjEyMDQwY2UxNzI2MWZmNDZjYjBjZjMyYWUzNDYzODdkZGEzNjFlNjRkYjk1MDMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxYjg1NDdhOWFlNDQzYjA0N2FlNTU4N2U4YzJhMDk1MDJjMzU0YTllYTRlNWZhMjJlZTA4NThlMGVkYjAyNWU3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwN2U5NTU3NTdhMTE3NmI3N2E2NDJkMTNhYjYxYzI3OWRlYjI3MGY5IiwidHJlZSI6IjU2YmU5YzMyMWZiODdkNzZmN2JjNTA3MzEyMjQyY2FjNWI5ODMxMGMiLCJib2R5RGlnZXN0IjoiMWJhYjQzMDcwM2U2Nzk0OTg1ZWVhMTQwNTRlZmM2OWI2MWY4Zjk4YzdjYWE4N2Q4NDA5ODkzMTk0NjE3NjM3MiIsInByb2R1Y2VyUnVuIjoiNDA2NTkyMzQ1NzgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImQ3YzdhNTljM2E2MDJmNjA5ZmZiYzFjY2YzYzhkMTE5NmI0ZTczZjBjOTBmZjU3ZjBiYmQwNTg4ZThlZTQzOTAiLCJ2ZXJkaWN0RGlnZXN0IjoiMzgyNzZkOGY0MzM5YTY1ZjJmODM3OWI4ZWFmYTVjZmQ0Y2UzOTNmYTRhYjI0YjI0OTU1ODRkNTI5NzJiYWM2OCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1YzM3MjY5YjliZDhmMDQzM2JiOGUwYTk1YWEyMjcwODBmNTIzODc0NTdkOWMxYWNkOTM3NmZjMDYwMzliYjBkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDY0ODc0OTg1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAzI2lzc3VlY29tbWVudC02NDY0ODc0OTg1IiwiYm9keURpZ2VzdCI6IjhmMmI0NjM0M2Q1ZGIzMmQ0MzE2MTc1OGZhOGQ0YThiMGViYmE3ODU4ZjM0ZTJjY2Q3MzI2ZTE4MzAxODljNGEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1103-route-kiosk`, коммит `07e955757a11` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `56be9c321fb87d76f7bc507312242cac5b98310c`
  ```
  git log --all --format='%H %T' | grep 56be9c321fb8
  ```
- Тело issue: `1bab430703e6794985eea14054efc69b61f8f98c7caa87d84098931946176372`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40659234578,"run_attempt":1,"digest":"d17654f080dd0bd56512c6765ed06d57c14c47f3f2adc813c4904e90c01d4eee"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTEyLCJvdXRwdXRfdG9rZW5zIjo1ODY3NywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMDg5NDMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4MzE1Njg2LCJjb3N0VXNkRXN0aW1hdGUiOjMuMDg1OTAzMTk5OTk5OTk5N31dLCJ0dXJucyI6NjEsImR1cmF0aW9uTXMiOjY2ODU5NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuMDg1OTAzMTk5OTk5OTk5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=112 output_tokens=58677 cache_creation_input_tokens=208943 cache_read_input_tokens=8315686 num_turns=61 -->
