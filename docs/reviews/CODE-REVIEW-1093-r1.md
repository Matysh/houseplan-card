# Code review — issue #1093, заход r1

Материал: `90188495d9d38cd39ac7c1ea63918c2d408574ec` (merge: integrate accepted
color-picker witness repair, #1093). Трек: ask. Этап: code (PROCESS.md §2.7).

## Скоуп

Избыточная работа во всей цепочке config/layout/HA → производные данные →
потребители: физические ключи (`structural-space-record.ts`,
`floor-geometry-key.ts`), ленивая геометрия (`demand-space-models.ts`),
метаданные ростера устройств (`device-roster-state-key.ts`), спрос снапшота
(`render-snapshot-consumers.ts`, `render-snapshot-demand.ts`,
`render-snapshot-capture.ts`, `render-snapshot-reuse.ts`), поведение скрытого
документа/ушедшего route (`houseplan-render-lifecycle.ts`,
`houseplan-card.ts` shouldUpdate/requestUpdate, `view-runtimes.ts`,
`view-runtime-boundary.ts`), подтверждение/закрытие формы после ACK
(`danger-confirm.ts`, `device-structure-history.ts`, `marker-deletion.ts`,
`prior-config-write.ts`, `editors/room-save.ts`,
`houseplan-editor-runtime.ts` Save Space/General), обязательный временной
гейт (`demo/benchmark_selective_invalidation.mjs` + четыре core wrapper'а).
131 изменённый файл, диапазон `read:log`: 7 коммитов (90188495d, 9ddaf1651,
68508c8dc, eb6c59eed, 6ed1b2f38, d414f419e, e1c200232).

Core user jobs: J1 (живой обзор дома), J4/J6 (сохранение плана, Copy/Delete/
Undo/Redo, многоклиентная синхронизация) — задача ускоряет обслуживающий их
путь записи/перерасчёта, не меняя сами job'ы.

## Как проверялось

Static-first: прочитан `docs/SCOPE.md`, `AGENTS.md`, тело issue #1093 (ТЗ
целиком из REVIEW_CONTEXT), `docs/analysis/1093-selective-invalidation-2026-10-28.md`
(авторский аудит с разделом «Acceptance matrix» AC→witness→failure, с
исходными RED и post-CI RED/GREEN), затем независимый построчный разбор
диффа (`read:diff`, 7.1 МБ) по рискованным файлам:

- `src/structural-space-record.ts` — новая `DISPLAY_SETTINGS`/`physicalRecord`
  проекция вместо старого `structuralFingerprint`; сверено построчно со
  списком полей §2 ТЗ (bg_mode/bg_color, room/name/wall colours, show_names/
  label_*, card_*_scale, north_deg/sun_rays/sun_transparent, title) —
  совпадает; `settings`/`decor`/неизвестные поля остаются значимыми;
  нормализация пустых `walls`/`partitions`/`plan_url`/`plan_aspect`/
  `zero_wall_style` ограничена явно перечисленными canonical-эквивалентами
  отсутствия, не трогает nonstructural неизвестные ключи.
- `src/demand-space-models.ts` + `test/demand-space-models.test.mjs` — ленивые
  геттеры на `SpaceModel`/`RoomCfg`, LRU на 8 этажей по `physicalFloorFingerprint`;
  тест проверяет нулевые builds до первого реального чтения геометрии и что
  изменение paint-полей не трогает кеш другого этажа (`builds` остаётся 1).
- `src/device-roster-state-key.ts` + тест — Proxy-перехват `hass.states`/
  `attributes` (get/has/ownKeys) для точного journal зависимостей; проверено,
  что `buildDevices` (src/devices.ts) нигде не делает `Object.keys(hass.states)`/
  `for..in` по всем состояниям (только точечные `hass.states[eid]`), то есть
  перехватчик не теряет скрытые зависимости enumeration-а.
- `src/prior-config-write.ts` + `test/prior-config-write.test.mjs` — ключевая
  гонка «исторический отказ не должен отравлять новую независимую команду, но
  текущий отказ обязан её заблокировать»; тесты покрывают ровно этот race
  (счётчик `_writesPending` обнуляется до того, как промис реально
  rejects — результат всё равно пробрасывается, т.к. `pending` фиксируется
  **до** await).
- `src/danger-confirm.ts`, `src/device-structure-history.ts`,
  `src/marker-deletion.ts` — порядок «очистить authority синхронно → затем
  один accepted-кадр с уже применённым UI-изменением» (пост-CI правка:
  раньше успевал прорисоваться один лишний кадр до закрытия формы при
  Delete). Проверены все 4 ветки в
  `test/device-structure-history.test.mjs` (`accepted/refused/replacement/
  foreign-owner`) — закрытие формы происходит только в ветке `accepted`,
  остальные три не закрывают и не теряют состояние busy/replacement.
- `src/houseplan-card.ts` `shouldUpdate`/`requestUpdate`/`_pageVisibility`
  — подавление рендера при `hidden`/`_routeDepartureHandled` с накоплением
  изменённых property-имён в `Map` (коллапс нескольких правок к одной при
  реванше, что соответствует п.6 ТЗ — «без replay каждой правки»); intake
  hass и `_alerts.reconcile()` продолжают работать при скрытом документе.
  Проверена симметрия: `_maybeRebuildDevices`/`_syncActivityRuntime`/
  `_activityTick`/`_stampActivity` все явно отказываются от работы при
  hidden/departed, `_regSignature=''` форсирует пересчёт при следующем show.
- `src/view-runtimes.ts`/`view-runtime-boundary.ts` — `port().current()`
  теперь требует `this.active && visibilityState !== 'hidden' && demanded()`;
  `abandoned()` сбрасывает `value`/`pending` в `'idle'` вместо зависания в
  `'loading'`, когда владелец сменился во время догрузки ленивого runtime —
  корректно для AC5 (late import старого owner не блокирует новый).
- `src/render-snapshot-{capture,consumers,demand,reuse}.ts` — зависимость
  снапшота от активного режима/floor/showAll, транзитивное замыкание
  контроллер↔цель (`snapshotDeviceDemand`) для скрытых источников видимого
  маркера; реюз-окно теперь также ключуется по `changedDevices`
  (точечная инвалидация одной presentation-строки, не всего снапшота).
- `scripts/mutation-registry.mjs` — зарегистрированы 8 новых static-readiness
  guard'ов ровно на те инварианты, что я независимо выделил как
  рискованные (порядок confirm/resolve, порядок paired adoption, retired
  summary owner, resize-observer ownership, dialog exit animation,
  demand-space-models reuse, prior-config-write pending-suppression,
  late room-save foreign-owner). Регистрация статическая (`execution=0`),
  что соответствует правилу «мутанты не исполняются на треке в разработке,
  полный реестр — ночью» (AGENTS.md «Tracks»).
- Changelog/release-ledger: `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  содержат согласованный по смыслу пункт (#1093) в обоих файлах; `docs/
  release-ledger/v1.82.0/1093.json` — `category: stable-fix`, обоснование
  прямо ссылается на то, что stable `physicalFloorFingerprint` уже хешировал
  весь record с visual settings — соответствует формулировке §8 ТЗ (решение
  владельца, не вывод из User-Visible).
- Канонические документы подсистем — `ARCHITECTURE.md`, `CANVAS.md`,
  `DEVICE-PRESENTATION.md`, `SUN.md`, `WALL-THICKNESS.md`, `TESTING.md`,
  `DEVELOPMENT.md`, `STATUS.md` — все получили релевантные разделы по
  #1093; тестовый счётчик в STATUS.md обновлён (5762 unit / 476 smokes).

Проверены ещё: `test/render-snapshot-consumers.test.mjs`,
`test/render-snapshot-demand.test.mjs`, `test/marker-alert-runtime.test.mjs`,
`test/marker-alert-view-runtime.test.mjs`, `test/view-runtime-boundary.test.mjs`,
`test/floor-geometry-key.test.mjs`, `test/dialog-baseline.test.mjs`,
`test/room-save-946.test.mjs` — имена и тела тестов соответствуют заявленным
в авторской acceptance-matrix виткам.

## Переиспользованное доказательство (не повторялось)

- Validate-gate на точном материале `90188495d9d38cd39ac7c1ea63918c2d408574ec`:
  https://github.com/Matysh/houseplan-card/actions/runs/40616592238 (green;
  «review-light-golden proof is complete» — покрывает выбранный визуальный
  proof и стандартный пакет build/typecheck/unit/product gate на этом SHA).
- Авторский AC-матрица `docs/analysis/1093-selective-invalidation-2026-10-28.md`
  §«Acceptance matrix» — каждый AC1–AC11 имеет колонку «Concrete witness /
  command» и «What makes it fail» (защитные AC3–AC9 имеют отрицательный вход
  или явный «не исполнялся» статус мутанта).
- AC10 (временной гейт) — задокументированный raw RED на неизменной базе
  (`docs/analysis/1093-evidence/baseline-visible-bg.json`, ACK-to-paint p95
  245.2/239.6 мс) и отдельный CI RED (`post-ci/ci-40610878036-history0-red.json`,
  185.4 мс) до правки порядка кадров в Delete, затем GREEN на этом материале
  (846 замеров, exit 0, `post-ci/full-timing.json`).

Эти доказательства не перезапускались — они относятся к ровно этому
материалу и не инвалидированы ревью (смена SHA только за счёт
review/docs-коммитов не отменяет пригодность, PROCESS.md §2.10).

## Что НЕ проверялось (и почему это не пробел)

Полный build/typecheck/unit/smoke набор не перезапускался через
`run_check` поверх уже зелёного validate-gate на этом точном SHA — повтор
был бы дублирующим прогоном без нового риска (политика: «общие tsc/build/
npm test/gate:small не являются запасным сценарием ревью»). Независимый
построчный разбор (см. выше) не выявил ни одного AC или защитного
инварианта без пригодного witness, поэтому адресного дополнительного
исполнения не потребовалось. Полная бета-матрица (DPR2, cold-save,
nightly mutation execution) остаётся задачей пред-релизного гейта
(PROCESS.md §8), не код-ревью этого масштаба.

## Находки

Не обнаружено находок High или Medium в скоупе. Малые находки:

- Косметика: в нескольких канонических доках (`ARCHITECTURE.md`,
  `DEVELOPMENT.md`, `DEVICE-PRESENTATION.md`, `SUN.md`, `WALL-THICKNESS.md`)
  добавлены лишние пустые строки вокруг новых разделов — не влияет на
  содержание, не поднимаю до Medium (class C, чисто форматирование).

Побочных находок вне скоупа #1093 нет.

## Вывод

Реализация независимо проверена построчно по ключевым рискованным файлам
(физические ключи, ленивая геометрия, Proxy-основанный roster-state key,
гонка prior-config-write, порядок кадров confirm/adopt, hidden-render
deferral/replay, view-runtime demand-gating, snapshot reuse). Логика
согласована с §4 (контракт инвалидации) и §5 (матрица) ТЗ, два найденных на
CI регрессионных дефекта (лишний кадр при Delete, устаревший resize-observer
после замены stage) исправлены с адресными тестами и зарегистрированными
mutation-guard'ами. Документация, changelog (оба языка) и release-ledger
соответствуют требованиям §8. Вердикт: **green**.

Маршрут: `route: fix` (задан пакетом ревью, #726).

## Гейты: что прогнано, что нет

- Прогнано в рамках этого ревью: `read:diff`, `read:log` (ориентация по
  материалу); прямое чтение диффа/файлов/тестов (Read/Grep) — не run_check,
  т.к. предмет — статический разбор кода, не исполнение.
- Переиспользовано без повтора: validate-gate run 40616592238 (build/
  typecheck/unit/product gate + review-light-golden) на точном SHA
  `90188495d9d38cd39ac7c1ea63918c2d408574ec`; авторские raw-отчёты AC10
  (RED→GREEN) и post-CI RED→GREEN для history0 Delete.
- Не прогнано и не требуется: полный `gate:small`/`npm test`/бета-матрица
  (DPR2, cold-save, nightly mutation execution) — дублировали бы уже
  пригодное доказательство на неизменном материале/входах/oracle без
  нового риска для покрытия.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijk3ODA3OWIzNWRiOTI1MDcxY2I2M2ZkZTI0NmUxYTk5ZDY3NGQ4NTgzMmM1Yzg3NTg2ZTJmNzg4ZjAwZmE3MWYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0Yjg3ZThkNTE3YTZhYjBkZjQyM2RmMWRiNjgwYjk5NzMwZjJjN2ExMWE5NjM1NWFiNDAwNTY1ZWZiZDBkNGM2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDkzLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI5MDE4ODQ5NWQ5ZDM4Y2QzOWFjN2MxZWE2MzkxOGMyZDQwODU3NGVjIiwidHJlZSI6IjVmMjVhYzQzZDBmNmU4YTliMzc1ZGFjMjUyNTM2M2NmOGJkNTUwMWIiLCJib2R5RGlnZXN0IjoiNDRhMTk3NTc1ZTNhOTljZmNmNjFlM2QyYjRlY2U4Y2QzYzA1Y2NlYmJiOGFlNTEyZGFiMTg3ZjQ3NDA1MDkwMCIsInByb2R1Y2VyUnVuIjoiNDA2MTc5Njk5OTAiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjMzY2YwYThkMGZjZTk5MTBhZmY2Mjg1ZTMwMDRkNGQzMzljMzlhZmQxNjE4ZGFmNmE2ZTFlNTNmNzNmZjA3OWIiLCJ2ZXJkaWN0RGlnZXN0IjoiNzk5MWU2MjNiODIxZDBhMzNiMDY2OTc0YzNmNTU1OGFhOGRmNzdjNzZlZGRkOTJjZWFmN2QxM2MwNDUyYjUwNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiYzVhYmY5YjQ0OTEyODEzOGMxOGUwZTM0Yjk2NzlmNTE4ZTFkYjRhMDYyZjI4NDBiNDAyNjAwYTQ5MDhiYWQwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDU4Njg5ODcyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDkzI2lzc3VlY29tbWVudC02NDU4Njg5ODcyIiwiYm9keURpZ2VzdCI6IjA0Y2ExNTM4MWU5OTZkMjliMmVlYTI1OTEzOTI2ODdlMjk5Zjk5ZjE3OWUwMGVmMDBkM2E0MTJiODRmNTAxYWYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1093-selective-invalidation`, коммит `90188495d9d3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5f25ac43d0f6e8a9b375dac2525363cf8bd5501b`
  ```
  git log --all --format='%H %T' | grep 5f25ac43d0f6
  ```
- Тело issue: `44a197575e3a99cfcf61e3d2b4ece8cd3c05ccebbb8ae512dab187f474050900`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40617969990,"run_attempt":1,"digest":"27e6005ee8d2f419f690170e4e02eee84c86c7fb0a80481b1855b700bd9453fd"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTIsIm91dHB1dF90b2tlbnMiOjI2OTAyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4MTQyMCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMwMTg5MzUsImNvc3RVc2RFc3RpbWF0ZSI6MS41OTg1OTF9XSwidHVybnMiOjMyLCJkdXJhdGlvbk1zIjozNjM1ODMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjU5ODU5MSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=52 output_tokens=26902 cache_creation_input_tokens=181420 cache_read_input_tokens=3018935 num_turns=32 -->
