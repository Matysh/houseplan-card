# Код-ревью #1088 — заход r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Маршрут: fix
Материал: `33100c783b2b4dc2c4af6d632c4f36b5c13e10c9` (единственный коммит
поверх `e5849080cc01e10349be1c5ec922f8bb4a428094`: `test: repair nightly guards
and strengthen surviving witnesses`).

## Скоуп

Issue #1088 — ремонт девяти ночных guard-тестов, ложно покрасневших на
неизменённом продуктовом коде `e5849080cc01` (нагнали их уже слитые задачи
#1081/#997/#976/#1012), плюс усиление двух сбежавших мутационных свидетелей
(`first-space-converter-writer-only`, `vacuum-live-future-prefix-consumed-1049`).
Задача инфраструктурная: `git diff` не затрагивает ни одного файла в `src/`
или `custom_components/` — весь дифф лежит в `demo/`, `tests_backend/`,
`scripts/mutation-registry.mjs`, `scripts/ci-registry-inventory.json` и
документации (`docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/analysis/1088-nightly-guard-repair-2026-10-27.md`,
`docs/release-ledger/v1.82.0/1088.json`). Продуктовое поведение, пороги,
RGB-допуски и политика отказа не менялись — это подтверждено прямым чтением
`read:diff`, а не декларацией автора.

Поскольку видимое для пользователя поведение продукта не меняется (правятся
только тесты/фикстуры/документация), классы §5 (`migration`, `ux-contract`,
`perf-touch`, `undocumented`) не применимы — новых контрактов, миграций,
влияния на производительность/touch и недокументированного поведения дифф не
вводит. `complexity` ≤3 — исправления локальны и объяснены по каждому файлу
в `docs/analysis/1088-nightly-guard-repair-2026-10-27.md`. `surfaces` — задача
не вводит продуктовую фичу на нескольких экранах; это один сквозной трек
обслуживания тестовой инфраструктуры — ремонт одного и того же ночного
прогона, явно поставленный владельцем как одна задача. **Маршрут: `fix`.**

## Как проверялось

Статически (#857): прочитаны `review-context.json`, `sources.json/md`,
`read:diff`, `read:log` — дифф состоит из одного коммита, список
изменённых файлов совпадает с `changedFiles`.

Независимый разбор (до сопоставления с хендоффом):

- **`vacuum-live-future-prefix-consumed-1049`** (защитный AC). Прочитан
  `custom_components/houseplan/vacuum_live_tail.py` (`acknowledge_live`) и
  новый тест `tests_backend/test_vacuum_live_tail.py::test_only_unique_covered_prefix_ignores_a_future_revisit_when_proving_the_join`.
  Руками прослежен проход по текущей (неизменённой) реализации: кандидатом
  становится ровно одна точка `(10,0)@t=1000` (вторая `(10,0)@t=3000` отсеяна
  условием `sample[2] <= read_started`), префикс до неё (только `x=0@t=0`)
  обрезается, хвост `[10,20,10,30]@[1000,2000,3000,4000]` сохраняется — совпадает
  с assert'ами теста. Затем руками применён заявленный мутант (`find:'sample[2]
  <= read_started and len(sample) == 5', replace:'len(sample) == 5'`): фильтр по
  времени исчезает, кандидатов становится два (`j=1` и `j=3`), `acknowledge_live`
  по правилу `len(candidates) != 1: return` ничего не делает, хвост остаётся из 5
  точек — assert `[sample[0] ...] == [10,20,10,30]` (4 элемента) ломается.
  Оракула `pytest` в фиксированном наборе проверок нет (в манифесте `smoke:`/`unit:`/
  `static:`/`build:` нет ни одного `pytest`-чекера для `tests_backend`), поэтому
  это **проверено чтением, не исполнением** — честная граница, не «тест упал».
  Таблица AC для этого защитного пути:

  | AC/сценарий | Чем доказан | Чем краснеет |
  |---|---|---|
  | Watermark не делает уникальный старый endpoint неоднозначным из-за будущего повторного визита | Новый `pytest`-кейс + ручная трассировка `acknowledge_live` по коду (чтение, не исполнение — нет pytest-оракула в фиксированном наборе) | `vacuum-live-future-prefix-consumed-1049` — не исполнялся на этом материале (ночной прогон — единственное разрешённое исполнение); логически прослежено, что мутант даёт 2 кандидата вместо 1 и `acknowledge_live` отказывается от записи |

- **`first-space-converter-writer-only`** (защитный AC). Прочитаны
  `src/view-runtimes.ts`, `src/view-runtime-boundary.ts`,
  `src/config-write-context.ts`, `demo/smoke_first_space_converter.mjs`,
  `demo/helpers/first-space.mjs`. Подтверждено: `port(() => {}, true)` в
  текущем коде делает `converter`-границу «informational» — `owner()`
  возвращает `host`, `current()` требует только `host.isConnected`, без
  обращения к `hass.callWS`. Новый сценарий ставит `transport: false`
  (`delete hass.callWS`) и реальный 404 на модуль конвертера: граница обязана
  загрузиться, показать уведомление, восстановиться по Retry и не писать
  конфиг/layout — всё при отсутствующем `hass.callWS`. При заявленном мутанте
  (`port(() => {})` без `true`) `owner()`/`current()` переходят на
  `host._configWriteContext.{claim,current}`, а `ConfigWriteContext.current()`
  (`src/config-write-context.ts:35-38`) требует `typeof hass.callWS ===
  'function'` — без транспорта он всегда `false`, и `ViewRuntimeBoundary.ensure()`
  (`src/view-runtime-boundary.ts:86`) немедленно возвращает `false`, не делая
  запрос к `hp-plan-converter-info-*.js` вовсе: `attempts.length` остался бы `0`
  вместо `2`, а клик по Retry не нашёл бы `[data-hp="view-runtime-notice"]`.
  Проверено чтением, не исполнением (по общей политике — ручной патч `src/`
  с прогоном запрещён вне ночного workflow).

  | AC/сценарий | Чем доказан | Чем краснеет |
  |---|---|---|
  | Информационная граница конвертера восстанавливается без write-транспорта | `smoke_first_space_converter.mjs` (воспроизведён ниже, PASS) + трассировка `ViewRuntimeBoundary.ensure/current` и `ConfigWriteContext.current` по коду | `first-space-converter-writer-only` — не исполнялся; логически прослежено, что мутант переводит границу на `_configWriteContext`, который без `hass.callWS` блокирует `ensure()` и делает `attempts.length===0` вместо `2` |

- **9 ordinary-guard фиксов** — для каждого прочитан сам диф и первопричина
  проверена по продуктовому коду, а не принята со слов хендоффа:
  - `smoke_color_picker_presentation.mjs` — ожидание `getAnimations(...).finished`
    использует существующий приватный `_surface()` (`src/hp-color-opacity.ts:717`,
    read-only, не патч продукта); допуски RGB и селекторы пикселей не менялись.
  - `smoke_decor.mjs` / `smoke_furniture_polish.mjs` — дописаны недостающие
    `pointerup` после `pointerdown`, плюс новые строгие ассерты «down сам по себе
    не ставит» (`furnitureDownThroughDeviceCoreDoesNotPlace`,
    `leftDownDoesNotPlace`) — это усиление, а не ослабление guard'а.
  - `smoke_device_inbox_batch.mjs` / `smoke_settings_mock_match_948.mjs` —
    сверено с реальной вёрсткой `src/houseplan-editor-runtime.ts:11303-11321`:
    в `on_plan`-вкладке единственный чекбокс в `.device-inbox-filters` —
    `data-field="device-catalog-new"`, обёрнутый в `<label>`; старой обёртки
    `.device-inbox-filter-help` в разметке для этого поля больше нет. Новые
    селекторы `[data-field="device-catalog-new"]` соответствуют продукту, а не
    подогнаны под тест.
  - `smoke_space_delete_with_devices.mjs` — добавленные `hp.switchSpace('f1'
    |'attic')` перед `hp.openSpaceDialog('edit', …)` необходимы, потому что
    `__hpTest.openSpaceDialog('edit', id)` ищет реальную кнопку
    `[data-hp="space-settings"][data-id="{id}"]` (`demo/helpers/hp-test.mjs:272-284`)
    — после компактной навигации (#997) эта кнопка рендерится только для
    активного пространства. Это настоящий публичный путь пользователя
    (клик по вкладке/селектору), а не приватный обход.
  - `smoke_view_runtime_recovery.mjs` — ожидание `customElements.get('hp-settings-select')`
    и один `updateComplete` у `__retiredCard` до начала подсчёта
    `window.__retiredUpdates` корректно выносит независимый импорт компактного
    селектора заголовка (#997) за границу измерения; assert `retired.updates
    === 0` не ослаблен — по-прежнему требует ровно ноль обновлений после этой
    точки.
  - `smoke_wall_guide_ownership.mjs` — новый `assert.equal(anchor.length, 1, …)`
    фиксирует инвариант после первого клика; поиск сохранённой стены теперь
    ведётся по реально принятому `window.__card._path`-якорю вместо сырых
    координат клика (адаптивная сетка на 50%-зуме снэпает иначе — это была
    ошибка оракула теста, а не мутация продукта), и проверка записи ужесточена
    с «writes.length > 0» (абсолютно) на «writes.length > beforeWrites»
    (именно по этому клику).
  - `smoke_wallthick_standalone.mjs` (= `demo/wallthick-selection-scenario.mjs`)
    — переключение пространства теперь идёт через `window.__hpTest.switchSpace(...)`
    вместо клика по убранной компактной навигацией широкой вкладке — тот же
    публичный facade, что и везде в проекте.

## Проверено исполнением (адресно, этот материал)

Валидный существующий proof уже подтверждён `validate-gate`
(https://github.com/Matysh/houseplan-card/actions/runs/40470627512,
«review-light proof is complete»); разницы между SHA ревью и SHA гейта нет.
Дополнительно к этому proof я выполнил через `mcp__houseplan_review__run_check`
прицельные проверки для рисков, не покрытых одним только static-чтением
(повторное исполнение всех десяти изменённых browser-guard'ов и статических
проверок реестра — именно то, что отличает «автор сказал PASS» от «я это
увидел»):

- `build:build`, `build:bundle:sync`, `build:typecheck`, `build:test` — PASS
  (свежая сборка нужна была: первый прогон смоков упал на отсутствующем
  `dist/houseplan-assets.json`/устаревшем бандле — это артефакт среды ревью,
  не дефект диффа).
- `smoke:demo/smoke_color_picker_presentation.mjs` — PASS.
- `smoke:demo/smoke_decor.mjs` — PASS.
- `smoke:demo/smoke_device_inbox_batch.mjs` — PASS.
- `smoke:demo/smoke_first_space_converter.mjs` — PASS (включая новый
  `informationalRecoveryWithoutWriteTransport`).
- `smoke:demo/smoke_furniture_polish.mjs` — PASS.
- `smoke:demo/smoke_settings_mock_match_948.mjs` — PASS.
- `smoke:demo/smoke_space_delete_with_devices.mjs` — PASS.
- `smoke:demo/smoke_view_runtime_recovery.mjs` — PASS.
- `smoke:demo/smoke_wall_guide_ownership.mjs` — PASS.
- `smoke:demo/smoke_wallthick_standalone.mjs` — PASS.
- `static:mutation-registry`, `static:ci-registry-inventory`,
  `static:ci-profiles`, `static:status-snapshot` — PASS.
- `unit:test/mutation-gate-report.test.mjs`,
  `unit:test/backend-test-hygiene.test.mjs`,
  `unit:test/ci-registry-inputs.test.mjs`,
  `unit:test/ci-proof-registry.test.mjs`,
  `unit:test/release-ledger.test.mjs`,
  `unit:test/process-gate.test.mjs` — все PASS.

Это ordinary PASS на неизменённом входе — не «caught» и не замена ночного
мутационного прогона; трактуется строго как регрессионная проверка самих
фиксов guard'ов, согласно общей политике.

## Чего не проверял / честные границы

- `unit:test/mutation-gate.test.mjs` — исполнение превысило отведённые 120с
  (`status: timeout`) в этой ревью-среде; это не PASS и не FAIL. Из показанных
  26 поднаборов (весь объём реестра в 1938 определений) ни один не упал;
  изменённые в этом диффе два определения (`because`-тексты) не являются
  структурными и не меняют проверяемые инварианты (`guard`, `patches`, `id`),
  которые уже отдельно подтверждены `static:mutation-registry` (PASS). Это
  ограничение среды, не находка по диффу.
- `tests_backend/test_vacuum_live_tail.py` — в фиксированном наборе проверок
  нет `pytest`-оракула для backend-тестов (только browser `smoke:`, `unit:`
  Node-тесты и статические чекеры). Корректность нового теста подтверждена
  построчной трассировкой кода `acknowledge_live`/`append_live` (см. выше), не
  исполнением — это заявлено явно, не выдаётся за «тест упал».
- Полный ночной мутационный прогон (поимка двух survivor'ов) не запускался
  и не может запускаться вне `mutation.yml` — это ожидаемо и явно описано
  автором как «не сделано»; следующий scheduled-прогон должен подтвердить
  фактическую поимку.
- Трейлеры `Issue:`/`User-Visible:` на коммите не проверены напрямую
  (фиксированный набор не даёт доступа к полному телу коммита, только
  `--oneline`); для правок этого типа (`User-Visible: no`, `category: infra`)
  это самосогласовано с диффом — продуктового поведения для пользователя
  нет, changelog не требуется (§11.9).
- Golden-сцены и полный `npm run inventory`/`gate:small` не прогонялись
  повторно — задача не вводит визуальных изменений (`"golden": []` в
  `docs/release-ledger/v1.82.0/1088.json`, подтверждено диффом: ни один `.ts`
  в `src/` не тронут), а существующий `validate-gate`/pre-push proof уже
  покрывает сборку/typecheck/юниты для этого материала.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Качество: исправления локальны, причины расхождений с продуктом объяснены
по каждому файлу и подтверждены независимым чтением продуктового кода (не
только текстом хендоффа). Ни один guard не ослаблен — в трёх случаях
(`smoke_decor`, `smoke_furniture_polish`, `smoke_wall_guide_ownership`)
проверки по факту ужесточены (добавлены down-no-op/якорные/relative-write
ассерты). Замены пути нет — это ремонт тестовой фикстуры и формулировок,
никакой legacy-путь не оставлен без удаления.

## Маршрут

`route: fix`. Все критерии §5 (`complexity`, `surfaces`, `migration`,
`ux-contract`, `perf-touch`, `undocumented`) пройдены — продукт не меняется,
новых контрактов и миграций нет, задача — целостный ремонт тестовой
инфраструктуры, явно скоуп-нутый самим issue.

## Побочные находки (outside_findings)

Побочных находок Medium вне скоупа нет. Попутно проверены смежные тесты
`demo/smoke_hidden_device_toggle.mjs` и `demo/smoke_help_affordance.mjs`
(утверждают отсутствие удалённого #1081 `.device-inbox-filter-help` для
show-hidden-поля) — они не конфликтуют с правками этого диффа и не задеты
им.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImY0ZTdhZTMyYzU5MzUzNDdlODI3YjE0MTcyNTA3ZTMzMGFiZjBkYzJkOWIyMTM4ZjFiZWMwOTBhMjg5MTY5ZDciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlNTkzMTY3ZWI4ZDQxZDQ2MDRjYjUxYWY4OWIwNmNlZTg1MWQyYzE3OTk3NDgzZGMwNzdhY2UxOTk0ZmUyMjY3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIzMzEwMGM3ODNiMmI0ZGMyYzRhZjZkNjMyYzRmMzZiNWMxM2UxMGM5IiwidHJlZSI6IjRhMTY2YzM3MzVhNDRkMTRkY2JkMDBmNTFjYWVhMzU2N2Y2NmExZTkiLCJib2R5RGlnZXN0IjoiMzc1MjUwN2Y2MTZjZjk4NjMwZjU2NDE3ZDhiMWNiNmRjODZkNGU5YWY4N2EyMjY2MWRlMjNjNjFhOGUzYTg5OSIsInByb2R1Y2VyUnVuIjoiNDA0NzE0ODM0NDUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjBkYTdiYTVmZWY4MjYyZGNkM2VkNTg0M2Y5NGFkMzYwMWJiMTMwOTg0ZmZhNTIyZTBiNGJhZDhjM2Y4ZmYzOWEiLCJ2ZXJkaWN0RGlnZXN0IjoiYzA0ODNlNmU4NDc1ZDRkMDBhMjA2N2EzMzg5NDkwOGQ2MDM4YjQ0OWZkZDU2M2MzNDYwMzdkNGZhN2NlN2ZhYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkMmZiODRjYzQxN2Q2MmI2YTc0Zjc5NmViM2MwMmU1MzdmMWYxNWY3MmEwZWFkYzQ1M2UwOTQ2YTc1OTk3ZDQ3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDM3MTgxMzcwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg4I2lzc3VlY29tbWVudC02NDM3MTgxMzcwIiwiYm9keURpZ2VzdCI6IjRiMjk1YzUzYzBiZDNhYTFhODlhYzRiMDg5N2Y2MDA1Y2E1OTZhODdhZjAzZTQ5ZjY1YjQxNTZkOWZhZGExY2MifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1088-nightly-guard-repair`, коммит `33100c783b2b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4a166c3735a44d14dcbd00f51caea3567f66a1e9`
  ```
  git log --all --format='%H %T' | grep 4a166c3735a4
  ```
- Тело issue: `3752507f616cf98630f56417d8b1cb6dc86d4e9af87a22661de23c61a8e3a899`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40471483445,"run_attempt":1,"digest":"9a9ecefd7c64ab2a20098c98ce94e553d061bc641c4e1c0fae7b9941cf19b362"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTM0LCJvdXRwdXRfdG9rZW5zIjo0NjI4NSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMjUxNzksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4OTM3MzQ0LCJjb3N0VXNkRXN0aW1hdGUiOjMuMTUxMzAyODAwMDAwMDAwN31dLCJ0dXJucyI6MTA0LCJkdXJhdGlvbk1zIjoxMDc5NzY0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4xNTEzMDI4MDAwMDAwMDA3LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=134 output_tokens=46285 cache_creation_input_tokens=225179 cache_read_input_tokens=8937344 num_turns=104 -->
