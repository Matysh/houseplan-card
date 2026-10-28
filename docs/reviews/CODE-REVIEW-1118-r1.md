# CODE-REVIEW-1118-r1

Issue: #1118 · Трек: show · Этап: code · Заход: r1 · Блокирующих циклов: 0/2
Материал: `8c93d211e5c5e3bf792b2a5918d2262739471e5c` (слияние `origin/dev`
в `issue/1118-golden-determinism`, рабочая копия на этом SHA)

## Скоуп

Чисто инфраструктурная правка golden-капчи (класс B/C, без `src/**`):
`demo/golden/scene-repaint.mjs` получает ещё один opt-in в уже существующий
(с #881) механизм «временно перекрасить `--hp-golden-page-bg`, подождать два
кадра, восстановить исходное inline-значение/priority/отсутствие свойства,
подождать ещё два кадра, затем сделать обычный screenshot» — теперь список
включает `geometry-plan-editor-dark`. Остальные пять ранее опт-инутых сцен,
Chromium launch-аргументы, keyboard/geometry/semantic-контролы и допуски
сравнения не меняются. Сопутствующие правки: тест
`test/golden-scene-repaint.test.mjs` (добавлена сцена в `optedIds`),
`scripts/mutation-registry.mjs` (find/replace существующей мутации
`golden-repaint-leaks-to-other-scenes` подогнан под новый текст массива),
`scripts/ci-registry-inventory.json` (два вхождения `docs/release-ledger/
v1.82.0/1118.json` добавлены в существующие инвентарные списки), новый
`docs/release-ledger/v1.82.0/1118.json` (category: `infra`, `visual.golden`
с явным `expectation: "change"` и причиной), правки `demo/golden/README.md`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`, и новый каталог `docs/evidence/1118/`
с диагностическими `.mjs`-скриптами и сырыми JSON-отчётами прогонов на
рабочей станции автора (before/after сравнение).

Category `infra` в ledger — изменение не входит в пользовательский milestone
релиза; это ожидаемо для правки тестовой инфраструктуры и не является
находкой. Коммиты класса B не несут `User-Visible`-правки CHANGELOG — в диффе
их и нет, что согласовано с `category: infra`.

## Как проверялось

Статический разбор: прочитан полный `read:diff` и `read:log` для материала,
сравнены текстовые формы правок в `demo/golden/scene-repaint.mjs`,
`test/golden-scene-repaint.test.mjs` и `scripts/mutation-registry.mjs` —
все три синхронизированы символ-в-символ (один и тот же расширенный список
сцен). Проверены оба вхождения `docs/release-ledger/v1.82.0/1118.json` в
`scripts/ci-registry-inventory.json`. Прочитаны `demo/golden/README.md`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/evidence/1118/*` целиком.

Независимо проверены вызывающие пути: `captureGoldenFrame` вызывается из
`demo/golden/run.mjs` (capture/verify) с теми же `screenshotOptions`, что и до
правки; изменение затрагивает только условие `includes(scenario.id)`, логика
restore-в-`finally` (защита от утечки temp-цвета при ошибке кадра/screenshot)
не тронута этим диффом — следовательно унаследованный инвариант #881 не мог
регрессировать в этой правке.

### Гейты

| Гейт | Результат | Источник |
|---|---|---|
| `unit:test/golden-scene-repaint.test.mjs` | PASS (4/4) | выполнено в этом ревью (`run_check`), материал не изменился |
| `static:mutation-registry` | PASS | выполнено в этом ревью; подтверждает, что find-строка мутации `golden-repaint-leaks-to-other-scenes` совпадает с текущим кодом |
| `static:ci-registry-inventory` | PASS | выполнено в этом ревью; оба вхождения `1118.json` согласованы |
| `read:diff`, `read:log` | выполнено | полный дифф/лог материала прочитаны в этом ревью |
| `build:bundle:sync` | PASS (не переисполнялось) | переиспользовано из хендоффа + validate-gate `40780948510`/`40780948446` SUCCESS на точном SHA |
| нормальный protected push | GREEN 261с/0failed | переиспользовано из хендоффа; удалённый readback совпадает с `8c93d211e` |
| validate-gate (целевые golden-проверки) | green, "review-light-golden proof is complete" | переиспользовано — ссылка на `actions/runs/40780948421` из промпта ревью |
| смоки/полная golden-матрица/HA pytest | не прогонялись | изменение не затрагивает `src/**`, DOM-поведение или Python; нет совпадающего риска из §8, адресного пробела не нашёл |

Полная матрица и HA-харнесс — предрелизный гейт, здесь не требовались: правка
не трогает ни одного файла, который они бы упражняли отдельно от уже
покрытого `golden-scene-repaint.test.mjs` и validate-gate.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Сцена `geometry-plan-editor-dark` опт-инится в существующий scoped-repaint и получает полностью перерисованный, детерминированный кадр | `test/golden-scene-repaint.test.mjs` → `each proven opted-in scene restores the original paint before the unchanged capture` (сцена в `optedIds`), PASS, переисполнено в этом ревью; подкреплено `docs/evidence/1118/candidate-report.json` — 30/30 захватов из 10 независимых Chromium дают один и тот же SHA `243de7d0…` (прочитано как свидетельство, не исполнено ревьюером) | Обычный отрицательный случай внутри того же теста: если бы `geometry-plan-editor-dark` остался вне массива в `scene-repaint.mjs` при неизменном `optedIds` теста, `frames` остался бы пустым вместо 4-кадровой последовательности — тест упал бы. Отдельного id в `mutation-registry.mjs` под этот конкретный AC нет |
| Сцены вне явного allowlist не получают repaint (защитный инвариант области действия) | `test/golden-scene-repaint.test.mjs` → `every other matrix scene keeps the original screenshot path without evaluate or repaint`, PASS, переисполнено в этом ревью | id зарегистрированного свидетеля `golden-repaint-leaks-to-other-scenes` (`scripts/mutation-registry.mjs`, guard — тот же тестовый файл, патч заменяет условие на `|| true`) — **не исполнялся** в этом ревью (мутанты вне ночного workflow не запускаются, #905); статическая проверка `static:ci-registry-inventory`/`static:mutation-registry` подтвердила только актуальность find-строки, не поимку |

Восстановление inline value/priority/отсутствия свойства при ошибке кадра или
screenshot (тесты 3 и 4 того же файла) — унаследованный инвариант #881,
логика `finally` этим диффом не изменена, поэтому отдельной строки не
заводил; обе проверки также PASS при переисполнении.

## Находки

Находок нет. Диапазон изменений узкий, тесты синхронизированы с реализацией
символ-в-символ, мутация и инвентарь обновлены согласованно в обоих местах,
документация (`README`, `DEVELOPMENT.md`, `STATUS.md`, release-ledger)
описывает именно то поведение, которое меняет код, и ничего больше.

Побочных находок нет (`outside_findings` пуст; политика — `mode: issues`).

## Что проверено и корректно

- `demo/golden/scene-repaint.mjs`: единственное изменение — расширение
  списка `includes(scenario.id)` плюс обновление комментария; остальной код
  функции, включая `finally`-восстановление и порядок кадров, не изменён.
- `test/golden-scene-repaint.test.mjs`: `optedIds` расширен тем же текстом,
  что и в реализации; все 4 теста упражняют реальный `captureGoldenFrame` на
  фейковом DOM/`requestAnimationFrame`, а не на regex по исходнику.
- `scripts/mutation-registry.mjs`: find/replace мутации
  `golden-repaint-leaks-to-other-scenes` подогнан под новый текст массива;
  соседняя мутация `golden-overlap-forgets-scene-repaint` не требует правки,
  так как её find-подстрока не содержит изменённый хвост списка — проверено
  чтением.
- `scripts/ci-registry-inventory.json`: оба вхождения `docs/release-ledger/
  v1.82.0/1118.json` добавлены в алфавитном месте существующих списков.
- `docs/release-ledger/v1.82.0/1118.json`: `category: infra`, явная причина,
  `visual.golden` с `expectation: "change"` и описанием единственного
  AA-пикселя — соответствует требованиям DEVELOPMENT.md по формату визуального
  намерения; глобальный baseline/bundle в задаче отсутствует, что совпадает с
  правилом «полную матрицу принимает бета».
- `docs/evidence/1118/*`: сырые отчёты (`candidate-report.json`,
  `unchanged-history-report.json`, `candidate-index-exact-delta.json`)
  внутренне согласованы с текстом `README.md` (одинаковые SHA
  `243de7d0…`/`4e93c435…`/`2221172916…`, одинаковый build fingerprint,
  одинаковая разница `(54,63)`/maxDelta 1). Скрипты `*.mjs` содержат
  абсолютные локальные пути рабочей станции автора; это явно продекларировано
  в `README.md` как «точные исполненные источники», без секретов — не
  являются риском сопровождения, учитывая их статус неисполняемой
  документации (не часть `test/`, `demo/`, `scripts/` исполняемых путей).
- Трейлеры: в предоставленном материале (issue body, комментарии, `read:log`
  oneline) трейлеры `Issue:`/`User-Visible:` не просматривались отдельным
  гейтом — полный текст тела коммитов вне доступных инструментов; `category:
  infra` и отсутствие CHANGELOG-правок в диффе взаимно непротиворечивы.

## Чего не проверял

- Не пересчитывал `baselineIndex` в `docs/release-ledger/v1.82.0/1118.json`
  самостоятельно (нет отдельного declared check для
  `scripts/task-visual-intent.mjs --baseline-index` в манифесте этого
  ревью) — полагаюсь на `process-gate`/validate-gate зелёный на точном SHA
  (переиспользованное доказательство, не отменённое сменой SHA на
  review/docs).
- Не запускал полную golden-матрицу, смоки или `pytest tests_backend`:
  правка не трогает `src/**`, DOM-видимое поведение карты или Python-бэкенд;
  адресного непокрытого риска, который оправдал бы такой прогон, не нашёл.
- Мутант `golden-repaint-leaks-to-other-scenes` не исполнялся (политика
  запрещает это вне ночного workflow) — честно отмечено как «не исполнялся»,
  не как «caught».
- Полное содержимое тел коммитов (на предмет трейлеров `Issue:`/
  `User-Visible:`) не читал отдельным инструментом вне `read:log`
  (oneline); при доступных источниках расхождений с `category: infra` не
  нашёл.

## Маршрут

`route: fix`. Проверка по §5: сложность и риск ≤3 (точечное расширение
существующего условия), одна поверхность (`demo/golden/scene-repaint.mjs` и
его тест/реестр), миграции конфига нет, нового UX-контракта нет (правка не
видна пользователю продукта — это тестовая инфраструктура), влияния на
производительность/touch нет, ожидаемое поведение уже зафиксировано в
`demo/golden/README.md`, `docs/DEVELOPMENT.md` и release-ledger. Задача —
инфраструктурная (класс B, без единого файла класса A), что по AGENTS.md
корректно входит в пайплайн сразу на `S7-code-review` без ТЗ/спека.

## Вердикт

Зелёный. High: 0, Medium: 0.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImQ1YzllMjJhOTE5MTcwZTNjYzc4ODY3NDZkNTEzMjExMjU5NTE1Yjk4ZDM1YWE3YWM3ODEyNGM2ZDIxZTUzNGUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3ZWYzNmNiOGVlYmZlZTFhYWVmYzk2OWNmZDFkMWEyYTZlOWZhOTZlODRkMmQzNTY0YTNkM2ZmM2ZiYTA4OWQ3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE4LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4YzkzZDIxMWU1YzVlM2JmNzkyYjJhNTkxOGQyMjYyNzM5NDcxZTVjIiwidHJlZSI6ImMxYmFiOGMzZjM1MmY1ZThiY2M4OWExOTA5NmMzNzJiZGEzZDUzOTMiLCJib2R5RGlnZXN0IjoiMGY4Y2FmZTg5NWMwNmEzMjgzN2EzYjZlYmEyMTE4OGMwYWRkMGVhNmM2MjIyYmJmYjc5NGJiMmZmMmY0ZmRiMCIsInByb2R1Y2VyUnVuIjoiNDA3ODE3NjU4NjUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImZjMzYyZTQzMTM1N2NlNWZmOWFiNzkyM2I2MmNiMmRmMzE1NzJjMWE5ZTMwZmU3NzViYTJiMThhNzc5YzA5ZDkiLCJ2ZXJkaWN0RGlnZXN0IjoiYjgwZTM1OTY5NDg0NjA4NTA2NWZiYWRmYWI1MDY0NTljNWIxZjcyZmYzMDI0YTUyNTBjZDljZjFlOTM2YTFiZSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5NjMzNTVlNTFhZGRmOWNiZTAwODE5MGZlODFmODNiNjZiNmQ4ZmU3NmI4YzAzOTc4M2JkNDIwNDZhNWY4ZTA5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgyNjg5Nzg5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE4I2lzc3VlY29tbWVudC02NDgyNjg5Nzg5IiwiYm9keURpZ2VzdCI6IjkyZjc3YWJhM2RiZTJiNjAxNDdhYThmZTY3NDBkMzUzZDk1NGY2NmU0NGIyOWViNGY4OGVmMTAxZjg1ZWM5NmQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1118-golden-determinism`, коммит `8c93d211e5c5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c1bab8c3f352f5e8bcc89a19096c372bda3d5393`
  ```
  git log --all --format='%H %T' | grep c1bab8c3f352
  ```
- Тело issue: `0f8cafe895c06a32837a3b6eba21188c0add0ea6c6222bbfb794bb2ff2f4fdb0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40781765865,"run_attempt":1,"digest":"3c2ae3312500d1604da9117768a26164399e9b4c95b8344c2effd750a13a2997"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTQsIm91dHB1dF90b2tlbnMiOjI0NDkyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MjkzOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIzNDcxMjYsImNvc3RVc2RFc3RpbWF0ZSI6MS4yODYyMDUyMDAwMDAwMDAyfV0sInR1cm5zIjo0MywiZHVyYXRpb25NcyI6MzE0NDkwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yODYyMDUyMDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=54 output_tokens=24492 cache_creation_input_tokens=142938 cache_read_input_tokens=2347126 num_turns=43 -->
