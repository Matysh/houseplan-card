# Код-ревью #1161 — заход r1

**Материал:** `88d5eb62856e8c167bf0549070620f7bc4fb97fa` (база диапазона — `73f34e9509da4c6082381c2cb29d239e790763be`)
**Трек:** ask · **Этап:** code · **Маршрут вердикта (зафиксирован):** `fix`

## Скоуп

Диапазон состоит из двух коммитов (`6aa30f51d perf: ...`, `88d5eb628 test: ...`), изменяющих:

- `src/render-snapshot-reuse.ts` — единственный продуктовый файл: новый тонкий владелец
  `RenderSnapshotReuseWindow` (до 8 независимых floor-слотов, LRU) оборачивает прежний
  алгоритм, перенесённый без изменений в приватный `RenderSnapshotReuseSlot`;
- `test/render-snapshot-floor-reuse.test.mjs` (новый, 7 кейсов) и адаптация
  `test/presentation-light-frame.test.mjs` под новую структуру (`reuse.floors`);
- `demo/smoke_floor_snapshot_reuse.mjs` (новый production-bundle smoke);
- документация (`ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`, оба `CHANGELOG`), `STATUS.md`
  (счётчики тестов), `scripts/ci-registry-inventory.json`, `docs/release-ledger/v1.82.0/1161.json`.

Это line-fix к #1093 (narrowed per-floor snapshot ошибочно терял reuse предыдущего этажа).
Соответствует Core user job «Просмотр»: актуальность плана при возврате к ранее открытому
этажу без лишнего пересчёта.

## Как проверялось

1. Независимый разбор `read:diff` (полный патч от общего предка) построчно: логика
   `begin/present/end/reset` окна-владельца, LRU-вытеснение, агрегация счётчиков,
   поведение при незавершённом/упавшем `begin`.
2. Сверка с телом issue (контракт п.1–5, не-скоуп, AC1–AC5) и с хендоффом — после
   самостоятельного разбора, не как план.
3. Чтение обоих тестовых файлов и demo-smoke целиком (`fullHunkReads`).
4. Исполнение через `run_check`: `build:test` (PASS), `unit:test/render-snapshot-floor-reuse.test.mjs`
   → 7/7 PASS, `unit:test/presentation-light-frame.test.mjs` → 3/3 PASS, `read:log`.
5. Переиспользование принятого `validate-gate` (run 41124410145, green) как доказательства
   для product/tooling/docs CI, 14 browser smokes и 3 неизменных Golden — не повторялось,
   т.к. материал/входы не менялись после публикации этого прогона.

## Независимый разбор кода

`RenderSnapshotReuseWindow.begin` ключует слот по `host._space` (включая `undefined` —
единственный слот для legacy/test-вызовов), двигает его в конец `Map` (LRU) и вытесняет
самый старый слот при превышении 8 (`while (floors.size > 8)`), вызывая `reset()` на
вытесняемом слоте до удаления — освобождает все его Map/WeakMap. Делегирование
`present`/`end` идёт через `this.active`, установленный в `begin`. Счётчики `full/
refreshed/incremental` накапливаются в момент самого `begin()` слота (дельта считается
сразу после возврата), поэтому вытеснение слота не теряет уже засчитанную работу —
совпадает с требованием п.5 ТЗ.

Повторный `begin()` при `this.open === true` (предыдущий `begin` не завершился `end()`)
сбрасывает **весь** window целиком (все слоты), а не только активный — то же поведение,
что было у прежнего единственного окна, применённое к обёртке. Это соответствует п.4 ТЗ
(«незавершённый capture не оставляет пригодного reuse») и явно проверено тестом
`reset and an unfinished capture forget every floor...`. В обычном синхронном цикле
переключения этажей (без исключений) этот путь не задействуется, поэтому не портит
горячий сценарий AC1.

Сам алгоритм source/presentation/row/light guards (строки внутри `RenderSnapshotReuseSlot`)
идентичен редакции до правки — изменился только перенос в приватный класс и
множественность экземпляров по этажам. Узкий scope capture (#1093, фильтрация `spaces`
по `host._space`) не тронут.

### Таблица AC · чем доказано · чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 (тёплый цикл, без full) | `test/render-snapshot-floor-reuse.test.mjs` тест 1 (PASS, проверено исполнением) + production-bundle smoke `smoke_floor_snapshot_reuse.mjs` (`noFullCaptureInTwelveWarmSwitches`, `noUnchangedFaceResolutions`, зафиксировано зелёным CI-run 41124410145) | Обычный тест: `assert.equal(reuse.stats.full, before.full)` упадёт, если возврат на прогретый этаж пересчитывает полный capture (регрессия к единственному общему окну #1093) |
| AC2 (актуальность/дифференциальный оракул) | Каждый вызов `capture()` в обоих тестовых файлах сравнивает `plain(actual)` с `plain(captureRenderDeviceSnapshot(host, null))` — полным rebuild без reuse (PASS, исполнено) | Обычный тест: `assert.deepEqual` упадёт структурно, если reuse вернёт устаревшее представление при изменении locale/themes/connection/user/registry/config/marker/layout/epoch/room source/settings/manual light/activity/alert |
| AC3 (границы/lifecycle: LRU, reset, упавший begin, независимость карточек) | `test/render-snapshot-floor-reuse.test.mjs` тесты 4–7 (PASS, исполнено) | Обычный тест: `LRU keeps eight floor owners...` красит `assert.equal(reuse.stats.full, before + 1/+2)`, если вытесняется не тот слот или вытеснение не происходит на 9-м этаже; `a failed begin cannot lend stale slots...` красит `assert.equal(reuse.stats.full, before + 1)`, если упавший `begin` оставляет пригодный для переиспользования слот |
| AC4 (производительность) | Парные before/after (7 samples + 1 warmup) приложены в хендоффе, task-scoped CI green на точном SHA (validate-gate 41124410145) | Не отдельный защитный AC в этом смысле; финальный Full Performance против v1.82.0 — гейт перед stable-тегом (после S8), явно не предмет code-review по собственному разделу ТЗ «Release-артефакты» |
| AC5 (кадры/golden) | ledger `golden: []`, `goldenChecks` с обоснованием на 3 неизменных сценах; CI job 124300280764 подтвердил 3/3 Golden без различий (из хендоффа, в составе зелёного validate-gate) | — (не защитный AC; пустой план неизменных golden) |

## Проверено и корректно

- `src/render-snapshot-reuse.ts`: LRU-логика, агрегация счётчиков, изоляция по карточкам,
  поведение при `undefined`-floor — прослежено построчно и подтверждено независимым
  исполнением тестов (не только чтением).
- `test/render-snapshot-floor-reuse.test.mjs` — 7/7 PASS при независимом запуске
  (`unit:test/render-snapshot-floor-reuse.test.mjs`), включает настоящий дифференциальный
  оракул на каждый вызов, не только в целевых кейсах.
- Адаптация `test/presentation-light-frame.test.mjs` под `reuse.floors` — 3/3 PASS при
  независимом запуске; прежние memory/disposal-проверки (`built.size`, `lightDeps.size`,
  `lightFrame === null` после `reset()`) сохранены на каждом удержанном слоте.
- Документация (`ARCHITECTURE.md`, `DEVICE-PRESENTATION.md`, оба `CHANGELOG`) точно
  описывает новое поведение (8 слотов, LRU, reset очищает всё, узкий capture сохранён).
- `docs/release-ledger/v1.82.0/1161.json`: `category: line-fix`, `introducedBy: 1093`,
  `baseStable: v1.82.0` — соответствует требованию ТЗ дословно; `golden: []` и пустой
  visual-план соответствуют AC5.
- `docs/STATUS.md`: Node unit 5901→5908 (+7, ровно число новых тестов), browser smokes
  486→487 (+1, новый smoke) — единственный источник (`npm run inventory`), число не
  расходится между местами.
- Не-скоуп соблюдён: альтернативная реализация capture не введена, #1159/#1160 не
  примешаны, public API (`begin/present/end/reset`) не расширен.

## Чего не проверял / честные границы

- Полный предрелизный Full Performance против v1.82.0 на финальном SHA — по собственному
  разделу ТЗ («Release-артефакты») выполняется после S8, перед stable-тегом; не предмет
  этого code-review. Приложенные парные before/after измерения (7+1) и зелёный task-scoped
  CI на точном SHA 88d5eb62 расцениваю как достаточное доказательство для этой стадии,
  не как замену финального гейта.
- Полные `gate:small`, browser smokes и 3 Golden-сцены не перезапускал повторно — переиспользован
  принятый `validate-gate` (run 41124410145, green, «review-light-golden proof is complete»);
  материал/входы с момента этого прогона не менялись.
- Текст коммит-трейлеров (`Issue:`, `User-Visible:`) не удалось проверить дословно:
  доступный `read:log` отдаёт только oneline-подписи коммитов (`perf: ...`, `test: ...`),
  инструмента для чтения полного тела/trailers коммита в наборе check'ов нет. Содержательно
  видимое пользователю изменение задокументировано в обоих `CHANGELOG` в составе
  проверяемого диапазона — считаю это достаточным по существу, но дословную trailer-строку
  не подтверждаю.
- Не проверял отдельно golden-скриншоты визуально (не гейт задачи, #697) — доверился
  описанию ledger и зелёному CI job со сверкой пикселей (differingPixels=0).

## Гейты: прогнано / не прогнано

**Прогнано в этом ревью:**
- `read:diff`, `read:log` — чтение материала.
- `build:test` — PASS, подготовка `test-build`.
- `unit:test/render-snapshot-floor-reuse.test.mjs` — 7/7 PASS.
- `unit:test/presentation-light-frame.test.mjs` — 3/3 PASS.

**Не прогнано (причина):**
- `build:build`, `build:bundle:sync`, `build:typecheck`, полный `gate:small`, benchmark-наборы,
  browser smokes, Golden — переиспользована пригодная зелёная evidence (`validate-gate`
  run 41124410145) на точном материале; материал/входы/oracle не менялись, адресных
  непокрытых рисков, требующих отдельного прогона этих общих гейтов, не найдено.
- Полный Full Performance против v1.82.0 на финальном релиз-кандидате — не гейт
  code-review по собственному разделу ТЗ (выполняется после S8).

## Вердикт

Находок нет (High: 0, Medium: 0). Реализация соответствует контракту ТЗ п.1–5,
не-скоупу соблюдена, защитные AC (LRU, reset, упавший begin, независимость карточек)
имеют работающие обычные тесты с понятной красной границей, дифференциальный оракул
реально исполняется на каждом вызове в обоих тестовых файлах. Документация и
release-ledger согласованы с кодом и друг с другом.

**verdict: green**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImIwNGU2M2YzMjI5NzQ1M2NmNDZhNTdmNGE2MDM0YWYyZThkZWRjMTZmODJiNThmZGYzNzMwZDc4ZWUxZTVlNTciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2OThlOTYzNjY5NTkwMDMyYjdmZTNmNmQxMjMxZjQ0MmQ3YWJjN2VhOTgwMjNhNTQwNDMxNzU3MmU3MjI4Y2QxIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTYxLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4OGQ1ZWI2Mjg1NmU4YzE2N2JmMDU0OTA3MDYyMGY3YmM0ZmI5N2ZhIiwidHJlZSI6ImZlYmVmYjFiZTgyMDMzMmRmMjUzODNlMWNiMTIzYTM0MzczNjUxM2EiLCJib2R5RGlnZXN0IjoiNzU4MDQzM2VjNGE3OGQ1NzI5ODJmZjIyMTE2MDQyMGM2NmI1NjM4ZTVjYzNlZDA3NDZjZjFlYzE1MTAwOTZlYiIsInByb2R1Y2VyUnVuIjoiNDExMjYwMDc5MzUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImJkNTg4NGY5ZDk0YjIwZjA2MzNkNjdlMGU4ZTRmMTE4NDhmZjk0YjNmMGFhNTEwNjhmM2I0M2JiOTIzNDYyMzQiLCJ2ZXJkaWN0RGlnZXN0IjoiMWQzYjU3ZTQwMmFmODJkMWIwNmUyN2Q2NTk3YzBkOTcwMGUxYzE1MDMyNTc1M2UzY2E5MTNiMjg1N2FjNWU1YSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI2ODk2NTE4NjRmYzE1ZTVhNzgwNjkzYzY0ZTkxYzRhMzgyNWUyYzY4MDY2ZjFhYzRhN2MzMzQ1NzI3NWQyYmVkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTMzMjkwMjg0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTYxI2lzc3VlY29tbWVudC02NTMzMjkwMjg0IiwiYm9keURpZ2VzdCI6IjQwODRmMGQ1MjJiNzBiYjExODc4YmY5ODk0YTE3MDFhNDI0OGQ5MDQxOTc0MjBiNGEyN2FjYjM3ZWY1M2E1YzgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1161-floor-snapshot-reuse`, коммит `88d5eb62856e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `febefb1be820332df25383e1cb123a343736513a`
  ```
  git log --all --format='%H %T' | grep febefb1be820
  ```
- Тело issue: `7580433ec4a78d572982ff221160420c66b5638e5cc3ed0746cf1ec1510096eb`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41126007935,"run_attempt":1,"digest":"98345817c7f2a0483267b225c9f74b7f2508b185512b94c643615231ec1a1c5f"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzAsIm91dHB1dF90b2tlbnMiOjI3ODkxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk2ODM0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTA2MTA1NiwiY29zdFVzZEVzdGltYXRlIjowLjg3ODUxNzJ9XSwidHVybnMiOjIyLCJkdXJhdGlvbk1zIjozNTAzMzQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjg3ODUxNzIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=30 output_tokens=27891 cache_creation_input_tokens=96834 cache_read_input_tokens=1061056 num_turns=22 -->
