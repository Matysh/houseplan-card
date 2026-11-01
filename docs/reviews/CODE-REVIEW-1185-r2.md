# Код-ревью — issue #1185, заход r2

Материал: `84f00b45c1a1aa1ce18d1756b2541b42ab8c32af` (единственный коммит
`test: await shadow-root modal paint before native UI assertions` на общем
предке `9abb412c3226260ee82bb5cd98452763e2721836` = текущий `dev`). Трек:
`show`. Класс изменения: инфраструктура (B/C, без A).

## Скоуп

Issue #1185 возвращена в S6 после того, как следующий полный CI
(https://github.com/Matysh/houseplan-card/actions/runs/41308362320) на том же
pixel-input материале `9abb412c` нашёл ещё два родственных наблюдателя с той
же причиной (измерение геометрии/кадра диалога до завершения его настоящего
`180ms` shadow-root enter): `smoke_view_edit_permissions.mjs` /
`nonwriter:touch-targets` (job `124854174223`) и `smoke_approved_ui.mjs` /
Escape intermediate exit frame (job `124854174238`). Первая правка General
Settings (`f89106fcc`, CODE r1, зелёный, уже в `dev`) не трогается и не
переоткрывается.

Изменённые файлы (все 4 прочитаны целиком через `read:diff`/`read:base:*`,
дифф сверен построчно):

- `demo/smoke_approved_ui.mjs` — класс B;
- `demo/smoke_view_edit_permissions.mjs` — класс B;
- `docs/design/ui-kit-general-toggle-observer-1185.md` — класс C, дополнение
  существующего файла;
- `docs/release-ledger/v1.83.0/1185.json` — класс C, правка `rationale`.

Дифф: `+18/-10` строк, 4 файла; ни одного файла `src/**`, fixtures, browser
pins, epsilon/tolerance, baseline PNG или `scripts/ci-registry-inventory.json`
(trusted D-инвентарь не получил новых путей — новых файлов в этом раунде нет).

## Независимый разбор

`demo/smoke_approved_ui.mjs` (`read:diff` построчно):

1. Добавлен импорт `waitForUiKitPaint` из неизменённого
   `demo/helpers/ui-kit-paint.mjs` (тот же общий хелпер, что и в r1 для
   General Settings; не входит в `changedFiles`, использование подтверждено
   отсутствием файла в дифф-листе).
2. Удалена локальная функция `finiteAnimations` (5 строк): она вызывала
   `node.getAnimations({ subtree: true })` только на переданном light-DOM
   узле диалога (`info`/`summary`), без явного обхода его собственного
   `shadowRoot`. Реальный rect/кадр диалога рисуется внутри `.surface` в
   shadow DOM — отсюда задокументированный в
   `docs/design/ui-kit-general-toggle-observer-1185.md` диагноз: при входе
   `180ms` light-DOM-запрос возвращался на `0ms/opacity 0`, то есть до начала
   настоящей анимации входа.
3. Все 4 места вызова (`info` × 2, `summary` × 2) заменены побайтно на
   `await waitForUiKitPaint(page)` — тот же паттерн, что в General Settings:
   `document.fonts.ready` → до 5 раундов по 2 `rAF` с явным рекурсивным
   обходом `element.shadowRoot` на каждый узел (`demo/helpers/ui-kit-paint.mjs:9-19`),
   бюджет 4с на раунд, бесконечные анимации не трогает.
4. Ассерт на реальный промежуточный кадр выхода не ослаблен —
   `assert.ok(after.frames.some(opacity => Number(opacity) > 0 &&
   Number(opacity) < 1), …)` (строка не в диффе, байт-в-байт). Native-ввод
   (X/Escape/Cancel), трассировка `.summary-control`/`[data-hp="dialog-cancel"]`
   и persistence-проверка `assert.deepEqual(after.state, before, …)` не
   тронуты.

`demo/smoke_view_edit_permissions.mjs` (`read:diff` построчно):

1. Добавлен тот же импорт `waitForUiKitPaint`.
2. Внутри `openInfo(f)` после `await f.page.locator('hp-dialog[data-kind="info"]').waitFor();`
   добавлена ровно одна строка `await waitForUiKitPaint(f.page);` с коротким
   комментарием о причине (host-видимость не ждёт shadow-enter). Остальная
   функция, включая выбор `tap()`/`hover()+mouse.down/up` по `f.touch`, не
   тронута.
3. `openInfo` — общая точка входа для всех `role`/`unknown-write`/`late`/
   `warm`/`area`/`lifecycle` сценариев; дубликатов открытия нет (вызывается
   один раз на сценарий до каждого `pressEdit`/снапшота, как и раньше).
   Authority/race-предикаты (`_serverCanWrite`, `_ackNewDevice`,
   `_openMarkerDialog`, revoke-ветки `late`) не изменены — единственная
   дельта в самой функции `openInfo`, которая выполняется **до** любых этих
   манипуляций.

`docs/design/ui-kit-general-toggle-observer-1185.md`: дополнение (не
перезапись) существующего файла — новый раздел «Related modal consumers
found by the next full run» с диагностикой обоих наблюдателей и явным
указанием, что активный раскат Golden из #1133 не трогается. Согласуется с
диффом кода 1:1 (описывает именно удаление `finiteAnimations` и замену на
`waitForUiKitPaint` в 4 местах).

`docs/release-ledger/v1.83.0/1185.json`: только поле `rationale` расширено
(перечисляет все три сейчас исправленных наблюдателя); `category: "infra"`,
`baseStable: "v1.83.0"` не менялись и остаются корректными относительно
текущего предыдущего stable.

## Чем доказаны AC1/AC2 и чем они краснеют

**Чем краснеет** (негативные свидетели, зарегистрированные отдельно от этого
ревью): исходный невидоизменённый продукт на том же pixel-input материале дал
реальный RED в полном кандидате —
https://github.com/Matysh/houseplan-card/actions/runs/41308362320/job/124854174223
(`nonwriter:touch-targets`, шард с `smoke_view_edit_permissions.mjs`) и
.../job/124854174238 (Escape intermediate exit frame, `smoke_approved_ui.mjs`).
Оба зафиксированы и в теле issue, и в дополненном design-доке — это обычные
зарегистрированные отрицательные случаи с командой/результатом, а не мутация
реализации.

**Чем доказано** — я не положился на цитируемый CI или на хендофф: выполнил
независимое исполнение заново через `run_check`.

- Первая попытка обоих смоуков упала на этом материале по причине
  окружения: `smoke_approved_ui` — `Failed to fetch dynamically imported
  module .../houseplan-card.js` (стейл `demo/srv/assets`); `smoke_view_edit_permissions`
  — `ENOENT dist/houseplan-assets.json` (сборка отсутствует). Это тот же
  класс проблемы окружения, что в r1, не относится к правке.
- После `build:build` (PASS) и `build:bundle:sync` (PASS) оба смоука
  перезапущены: `smoke:demo/smoke_approved_ui.mjs` → `exitCode 0`, финальная
  строка `OK`, в JSON-наблюдениях все 3 массива `summary-close-*`
  (x/escape/cancel) содержат реальные промежуточные значения `opacity`
  строго между 0 и 1 (например `0.873624`, `0.618901`, …), подтверждая
  фактический intermediate exit frame; `load-order-summary-first/editor-first`,
  `quarterTurns`, `rotatedNativeDragCancel`, `orderedQueueAndModeRetirement` —
  все присутствуют без ошибки. `check('approved-ui-seven-contracts-completed', true)`
  подтверждён итоговым `OK` без поля `error` в `observations`.
- `smoke:demo/smoke_view_edit_permissions.mjs` → `exitCode 0`, финальная
  строка `OK`; в итоговом JSON все ключи `true`, включая ранее краснившую
  `"nonwriter:touch-targets": true`, а также
  `"admin-nonwriter:touch-targets"`, `"kiosk-*:touch-targets"`,
  `"touch-*:touch-targets"`, весь блок `late:*:old-intent-refused`/
  `fresh-intent-works`, `warm:*:forbidden-dialog-not-revived`,
  `unknown-write:*:fallback`, полный блок `area:*` и
  `kiosk-writer:lifecycle-new-device-preserved`.

Это новое фактическое исполнение на материале `84f00b45c`, не переиспользованный
PASS из хендоффа.

`smoke_general_settings_form.mjs` в этот раунд не входит (не в `changedFiles`,
не затронут диффом) — доказательство унаследовано из r1 (см. раздел ниже), не
повторялось согласно политике «пригодный неизменившийся check не повторять».

## AC3 (код/процесс/CI)

- Diff строго ограничен классами B/C: подтверждено полным `read:diff` (4
  файла, `+18/-10`), без `src/**`, fixtures, browser pins, epsilon/tolerance,
  анимаций продукта, baseline PNG или нового `scripts/ci-registry-inventory.json`.
- `waitForUiKitPaint` переиспользован без изменений (файл вне `changedFiles`,
  содержимое читано напрямую — обход `shadowRoot` явный и рекурсивный,
  бесконечные анимации не трогает, не глушит motion).
- `docs/release-ledger/v1.83.0/1185.json`: классификация `infra` относительно
  предыдущего stable `v1.83.0` остаётся корректной, `rationale` расширен по
  факту — без `introducedBy` (задача не внутри ещё не выпущенной
  бета-фичи) и без поля `visual` (никаких намеренных визуальных изменений).
- Трейлеры коммита (`Issue:`/`User-Visible:`): точный текст тела коммита не
  прочитан напрямую — нет доступного примитива для полного тела коммита
  (тот же, что в r1, зафиксированный как граница, а не находка). Косвенно
  согласуется: `git log --oneline` даёт один коммит на диапазоне
  (`84f00b45c`), diff не содержит правок `docs/CHANGELOG.md`/
  `docs/CHANGELOG.ru.md`, что соответствует ожидаемому `User-Visible: no`
  для чисто инфраструктурной правки тестов; CI «docs»-профиль (объявлен
  зелёным в хендоффе) и `process-gate`/`.githooks` физически блокируют
  коммит без трейлеров при пуше. Прямого чтения строки нет — честно
  зафиксировано как «не проверено», не как находка.

## Трек show — критерии §5

complexity (2/10, риск 2/10 по авторской оценке, подтверждено размером и
характером диффа) — проходит; surfaces — одна измерительная поверхность
(завершение paint настоящих модальных диалогов), тот же паттерн, что в r1,
применённый к двум дополнительным существующим потребителям того же общего
хелпера, а не новая поверхность — проходит; migration — нет; ux-contract —
поведение продукта не меняется, новых UX-ключей нет; perf-touch — продукт и
touch-контракт не затронуты (правка только в demo-тестах); undocumented —
ожидаемое поведение полностью зафиксировано в теле issue (`## ТЗ`) и в
дополненном `docs/design/ui-kit-general-toggle-observer-1185.md`. Все
критерии §5 пройдены → `route: fix`.

## Гейты: что прогнал и что нет

| Гейт | Результат | Основание |
|---|---|---|
| `read:diff`, `read:base:*`, `read:log` | выполнено | статический разбор материала, этот документ |
| `build:build` | PASS | требовалось для адресного запуска смоуков — первая попытка упала по стейл-бандлу окружения |
| `build:bundle:sync` | PASS | синхронизация `demo/srv/assets` для свежего прогона |
| `smoke:demo/smoke_approved_ui.mjs` | PASS (после сборки), `exitCode 0`, `OK`, все 7 контрактов, реальные intermediate-кадры 0<opacity<1 | адресная проверка AC2, единственный смоук, названный в AC2 |
| `smoke:demo/smoke_view_edit_permissions.mjs` | PASS (после сборки), `exitCode 0`, `OK`, все ключи `true` включая `nonwriter:touch-targets` | адресная проверка AC1 (permission-часть) |
| `smoke:demo/smoke_general_settings_form.mjs` | не прогонял повторно | файл и хелпер не входят в дифф этого раунда; доказательство унаследовано из r1 (см. ниже) |
| `static:smoke-select` | недоступен в среде ревью (usage-ошибка, exitCode 2, аргументы модель не задаёт) | честно зафиксировано как гэп инструмента, не как находка; закрыто прямым адресным прогоном двух смоуков, названных в AC |
| Validate-gate материала `84f00b45c` (product/docs) | green, переиспользовано | https://github.com/Matysh/houseplan-card/actions/runs/41312824470 — покрывает typecheck/build/обычный gate:small, не повторял |
| `build:typecheck`, полный `npm run gate:small`, golden, `invariants`, `pytest tests_backend`, performance, HA-harness | не прогонял | дифф не трогает `src/**`, Python, геометрию модели или performance-контракт; соразмерный гейт — именно два адресных смоука (docs/process/REVIEWER.md «Объём гейтов») |
| Трейлеры коммита (точный текст) | не прочитан напрямую | нет доступного примитива для полного тела коммита; граница, не находка (см. AC3) |

## Находки

High: 0. Medium в скоупе: 0. Побочных находок вне скоупа не обнаружено —
диапазон диффа узкий (2 demo-файла + 2 doc-файла), независимый разбор не
выявил ничего вне заявленного AC. Маршрут `mode=issues` по
`REVIEW_FINDINGS_POLICY`: `outside_findings` пуст.

## Что проверено и корректно

- `finiteAnimations` (light-DOM-only, без обхода `shadowRoot`) полностью
  заменён на явно рекурсивный `waitForUiKitPaint` во всех 4 местах
  `smoke_approved_ui.mjs`; реальный intermediate exit frame (0<opacity<1)
  подтверждён фактическим прогоном, а не чтением.
- `openInfo()` в `smoke_view_edit_permissions.mjs` получил ровно одну
  дополнительную строку ожидания до любых authority/race-манипуляций;
  дублирования открытия нет, все role/kiosk/admin/unknown-write/late-revoke/
  lazy-import/warm/area/lifecycle предикаты подтверждены `true` свежим
  прогоном, включая ранее красневший `nonwriter:touch-targets`.
- Общий хелпер `waitForUiKitPaint` не изменён, не глушит motion, оставляет
  бесконечные анимации сцены как есть.
- `docs/release-ledger/v1.83.0/1185.json`: классификация `infra` относительно
  `v1.83.0` остаётся корректной и обоснованной.
- Diff не содержит правок `src/**`, fixtures, browser pins, baselines или
  генерируемого `ci-registry-inventory.json`.

## Чего не проверял

- Полный текст коммитных трейлеров (`Issue:`/`User-Visible:`) — нет
  доступного примитива для чтения тела коммита; граница та же, что в r1, не
  считаю находкой ввиду согласованности остального материала и зелёного
  docs/product CI.
- Полные `gate:small`/golden/performance/pytest/invariants/`build:typecheck`
  — не относятся к диффу (см. таблицу гейтов), предрелизный объём.
- `static:smoke-select` — инструмент в среде ревью вернул usage-ошибку;
  закрыл адресным прогоном двух названных в AC смоуков напрямую.
- Содержимое упомянутых в design-доке файлов
  `view-permission-modal-diagnostic.log`/`approved-ui-modal-diagnostic.log` —
  diagnostic-вывод автора вне продукта/тестов, не часть материала ревью.

## Закрытие раунда r1

r1 (материал `f89106fcca13`, докс `docs/reviews/CODE-REVIEW-1185-r1.md`) был
зелёным без находок (High 0, Medium 0) — закрывать нечего, таблица пуста.

## Унаследовано из r1

- Правка General Settings (`demo/smoke_general_settings_form.mjs`,
  `toggleTargetsAre44` после `waitForUiKitPaint`) — материал `f89106fcca13`,
  документ `docs/reviews/CODE-REVIEW-1185-r1.md`, сейчас часть `dev` на
  `9abb412c3226260ee82bb5cd98452763e2721836`. Файл и хелпер не входят в дифф
  этого раунда — принято без повторного исполнения.
- Общий хелпер `demo/helpers/ui-kit-paint.mjs` — read-only, уже проверен в
  r1 (12+ потребителей, включая `smoke_card_controls.mjs`); в этом раунде
  только расширено число потребителей, сам хелпер не менялся.

## Маршрут

`route: fix` — задача проходит все критерии §5 трека show.

Вердикт: зелёный · заход r2 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче | — · Документ: docs/reviews/CODE-REVIEW-1185-r2.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImMwNjkyMzhjZGVjZmVkMzJmZmE1YzAxOWUwOTA0NjA1MzQxZDNkZTVkYTVjMmIwZTI2NDczMTE0ZGVkYzU1YTIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4MjA2ODYyNWZlMGUzOTUzYjNiY2FlNmRmZGQzMTVhODgxMjY3NGZjZTAzNTY5ZGMzNWMxNzk1YzAwNWE1NGM5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTg1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI4NGYwMGI0NWMxYTFhYTFjZTE4ZDE3NTZiMjU0MWI0MmFiOGMzMmFmIiwidHJlZSI6ImQ1YTEwZWYxODNiMThkNmU4MTJmNzA0ZDY1YjViYWJlMzRiZWFhNGYiLCJib2R5RGlnZXN0IjoiMzU1NmE0NDg3ZmYxMWRhZmYwMjViYTk4NTVmMDI4NTllNDAyMDQxZDMwZGE1OWE5MmEyNjI2Yzk3M2FkMjRhOSIsInByb2R1Y2VyUnVuIjoiNDEzMTM0MjgwMDAiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjUxOTE1ZDJjOTg5MTRiMjMyYjdhYjlhMjg1MmE4NjVlNTI3OGRiMDRkNThhNjc0NjAyZmNiMjZjOGI0MDA1YjciLCJ2ZXJkaWN0RGlnZXN0IjoiNzFjNDQyMzVmODRmM2NmMmE5NDUwNzEzNDVkYmFkZGQyNmQxZTZmMTc2NDMxOTdiNDkyMTI5MGU3ZDRmMmE3OCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzMzBiMDYzN2JmZDU4MWQyNWZmYmIyNWE4MWZlYzk0ZDEzYTlhN2Q3NDkxZmY1MDVkNDg4YmYzMzhkMmY2NjgxIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU5MDE1Nzk3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTg1I2lzc3VlY29tbWVudC02NTU5MDE1Nzk3IiwiYm9keURpZ2VzdCI6IjljMzhlMmVjZDAxY2E1OTllZmE3OTBmYjhhN2RiZDc4MDhhM2NlOTg2NDNjOGI3NzUzNTgyNTg1NWJlMTJhZmYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1185-modal-paint-neighbors`, коммит `84f00b45c1a1` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d5a10ef183b18d6e812f704d65b5babe34beaa4f`
  ```
  git log --all --format='%H %T' | grep d5a10ef183b1
  ```
- Тело issue: `3556a4487ff11daff025ba9855f02859e402041d30da59a92a2626c973ad24a9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41313428000,"run_attempt":1,"digest":"60ed0d75c9f36858aef51116d1e8084b480552c7b59c485e6c549a4b49586943"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTIsIm91dHB1dF90b2tlbnMiOjI2NjEwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE3MTI3OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1OTM4ODgsImNvc3RVc2RFc3RpbWF0ZSI6MS40NzAwOTM1OTk5OTk5OTk4fV0sInR1cm5zIjozOSwiZHVyYXRpb25NcyI6NTU5NzI2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40NzAwOTM1OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=52 output_tokens=26610 cache_creation_input_tokens=171278 cache_read_input_tokens=2593888 num_turns=39 -->
