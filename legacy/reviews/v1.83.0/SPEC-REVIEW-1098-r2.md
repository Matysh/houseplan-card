# SPEC-REVIEW-1098-r2

Issue: #1098 · Этап: spec (ревью ТЗ) · Трек: ask · Заход: r2 · Блокирующих циклов: 1/4

Материал: тело issue #1098 (`bodyDigest` зафиксирован в REVIEW_CONTEXT), версия ТЗ
«Редакция 2 · 28.10.2026 · основа: dev `09bda8dbe`» (после слияния #1093). Рабочее
дерево для чтения источников — SHA `f10c65bdb56377c76c5593628fea46aaeb20fd31`
(дерево `579ee7690f331a13f03b0fd3a114187638a7d446`), содержит ту же основу кода, на
которую ссылается ТЗ (строки `src/*` совпадают с цитатами ТЗ, см. «Как проверялось»).

## Скоуп ревью

Повторный раунд по дельте (PROCESS.md §2.10): r2 правит ровно то, что требовало
исправления по единственной находке r1 (F-SPEC-1, High) — «Проблема» (последний
абзац), «Скоуп» (новый пункт «Источник `stairs`/`bg`»), «Контракт» п.4 и новый п.5,
AC3 (добавлена проверка значений), новый AC9, «План автотестов», «Риски»,
«Принято предположительно». Остальные разделы — без изменений по существу
(подтверждено построчным сравнением тела issue с текстом, который разбирал r1).
Проверялись: закрытие F-SPEC-1 по существу (не декларативно), техническая
осуществимость нового пункта Скоупа и его согласованность с Контрактом п.4/п.5,
однозначность и доказуемость AC3/AC9 в новой редакции. AC1/AC2/AC4–AC8, разделы
UX/модель данных/i18n/откат/release-артефакты дельта не задевает — унаследованы
из r1 без повторной проверки (раздел ниже). Кодовый Validate не требовался и не
запускался (`ciEvidence.contextOnly=true`).

## Как проверялось

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md` (переинициализация ролевого ревью — static-first,
   #857); затем тело issue #1098 (раздел `## ТЗ`, редакция 2 целиком) и документ
   предыдущего раунда `docs/reviews/SPEC-REVIEW-1098-r1.md`.
2. Единственный конкретный непокрытый технический вопрос этого раунда —
   действительно ли выбранный вариант (b) («обёртка `DemandSpaceModels` вычисляет
   `stairs`/`bg` из сырой записи, минуя `full()`, и только после этого исключает
   поля из ключа `this.floors`») технически реализуем на текущей сигнатуре функций
   и закрывает дефект, найденный в r1, а не просто декларирует это текстом.
   Прослежено чтением (без исполнения, без диффа для него):
   - `src/demand-space-models.ts:17-43` — текущая реализация: `stairs`/`bg`
     действительно читаются через замыкание `full()` (общий кэш `this.floors`),
     `led_strips` уже пробрасывается из `raw` напрямую — подтверждает диагноз r1
     и показывает, что `led_strips`-путь уже служит образцом для `stairs`/`bg`.
   - `src/space-geometry.ts:83-107` (`planRect`) — чистая функция от
     `space.plan_aspect/plan_scale*/plan_x/plan_y/plan_angle/plan_opacity`, не
     использует ничего, что строится только внутри `full()`/`spaceModels`
     (масштаб комнат, `vb` и т.п.) — вызов `planRect(raw, NORM_W)` на сырой записи
     даёт тот же результат, что `planRect(s, NORM_W)` внутри `spaceModels`
     (`space-geometry.ts:169`), для одной и той же записи.
   - `src/space-geometry.ts:169` (`bg: s.plan_url ? { href: contentUrl(s.plan_url),
     ...planRect(s, NORM_W) } : null`) против текущего
     `demand-space-models.ts:38` (`bg && raw.plan_url ? { ...bg, href: raw.plan_url
     } : bg`) — поскольку `full()` строится из `{ ...config, spaces: [raw] }`, `s
     === raw`, и `bg` из `full()` уже `null` ровно тогда же, когда `raw.plan_url`
     ложно; то есть текущий геттер эквивалентен предложенному в ТЗ
     `raw.plan_url ? { href: raw.plan_url, ...planRect(raw, NORM_W) } : null` —
     «href — сырой `plan_url`, как сегодня» подтверждено, а не выдумано.
   - `src/stairs.ts:202-204` (`stairList`) — чистая функция от `value` (сырого
     `raw.stairs`), используется в `spaceModels` как `stairs: stairList(s.stairs)`
     (`space-geometry.ts:191`) — `stairList(raw.stairs)` в обёртке даёт тот же
     результат и тот же тип (`Stair[]`), что ожидает `clean-floor.ts:15,53`
     (`SpaceModel['stairs']`).
   - `src/structural-space-record.ts:39` (`physicalSpaceRecord(record,
     ...nonStructural)`) — сигнатура уже принимает произвольный список
     исключаемых полей (уже используется так в `glow-scene.ts:254` для
     `led_strips`), поэтому формулировка Контракта п.4 «из ключа этого кэша не
     исключается ничего, что обёртка отдаёт из `full()`» реализуема без нового
     механизма: после перевода источника на `raw`, `stairs`/`bg` перестают быть
     полями, «отдаваемыми из `full()`», и могут быть безопасно исключены из ключа
     одновременно.
   - Итог: вариант (b) из «Принято предположительно» не декларативен — каждая
     его часть (функция, тип, место чтения) существует на этой основе и ведёт
     себя так, как ТЗ утверждает.
3. Сверены тексты AC3 (новая часть про значения) и AC9 (новый) на однозначность
   и достижимость существующей инфраструктурой: `test/demand-space-models.test.mjs`
   уже сравнивает `DemandSpaceModels` с `spaceModels` по `work.builds` и
   `deepEqual` на тех же входах (`:9-16`) — ровно тот шаблон, который требует
   AC9; `test/clean-floor.test.mjs`, `demo/smoke_floor_geometry_cache.mjs`
   существуют на этой основе — план автотестов не ссылается на несуществующую
   инфраструктуру.
4. `run_check` не вызывался: единственный непокрытый вопрос раунда разрешился
   чтением источников без диффа для исполнения, как и в r1 — исполнимый оракул
   здесь не требуется и не подменяет чтение при отсутствии изменений кода на
   этапе spec.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| **F-SPEC-1 (High)**: Контракт п.4 предписывал исключить `stairs`/`plan_*` из ключа кэша `DemandSpaceModels.floors`, но обёртка этого кэша отдавала `stairs`/`bg` из того же дорогого `full()`-билда, который Контракт предлагал не перестраивать — после коммита переноса лестницы/подложки читатели получали бы устаревшие значения, а собственный способ доказательства AC3 (только счётчик сборок) эту ошибку не ловил (ложно-зелёный тест) | Выбран вариант (b) из двух, предложенных r1: обёртка `DemandSpaceModels` больше не читает `stairs`/`bg` через `full()`, а вычисляет их напрямую из сырой записи этажа (`stairList(raw.stairs)`, `raw.plan_url ? { href: raw.plan_url, ...planRect(raw, NORM_W) } : null` — те же функции, что использует `spaceModels`) и мемоизирует оба значения на время одного `read`; только после этого перевода ключ `this.floors` исключает `led_strips`/`stairs`/`plan_*`. Добавлено общее защитное правило в Контракт п.4: «ни одно поле, которое обёртка отдаёт из `full()`, не исключается из ключа этого кэша» — ловит тот же класс ошибки для любого будущего поля, не только для этого случая. AC3 и новый AC9 теперь проверяют **значения** (площадь clean floor комнаты до/после переноса лестницы, атрибуты `<image data-hp="backdrop">` после переноса/масштаба/поворота подложки, глубокое равенство `stairs`/`bg`/`led_strips` обёртки со значениями `spaceModels` по новой записи), а не только счётчики сборок. План автотестов называет явный мутант для этого класса ошибки («ключ `DemandSpaceModels` без `stairs`/`plan_*`, источник всё ещё через `full()`») и требует, чтобы именно проверка значений на нём краснела | Тело issue #1098: «Уточнение после слияния #1093» (абзац про редакцию 2), «Скоуп» (пункт «Источник `stairs`/`bg` в `DemandSpaceModels`»), «Контракт поведения» п.4–5, AC3/AC9, «План автотестов» (абзац «Мутант для AC3/AC9»), «Риски» (пункт про F-SPEC-1), «Принято предположительно» (выбор (b) с явным обоснованием и названной альтернативой (a)) |

Независимая проверка этого раунда (раздел «Как проверялось», п.2) подтверждает, что
закрытие не декларативно: `planRect`/`stairList` — чистые функции сырой записи,
эквивалентность нового `bg`-геттера сегодняшнему прослежена построчно, тип
`stairs` совпадает с ожиданиями `clean-floor.ts`, и `physicalSpaceRecord` уже
поддерживает произвольный список исключаемых полей.

## Унаследовано из r1

Принято без повторной проверки в этом раунде — дельта r2 эти участки не
затрагивает, и материал кода на которых они основаны не менялся (документ
`docs/reviews/SPEC-REVIEW-1098-r1.md`, основа dev `09bda8dbee8b50577bfc4affc332b8cda914f5b4`):

- Обязательные разделы §7.1 присутствуют и заполнены по существу; ровно один
  явный блок открытых вопросов.
- Фактическая база «Проблемы» (жесты лестницы/LED вне `activeEditorGesture`,
  `stairs-editor.ts` пишет `_cfgEpoch`/`_modelCache` на каждый pointermove,
  `led-strip-editor.ts` без rAF-коалесции) — подтверждена чтением `live-editor.ts`,
  `stairs-editor.ts`, `led-strip-editor.ts`.
- `physicalSpaceRecord(record, ...nonStructural)` уже параметризована и уже
  используется так светом (`glow-scene.ts:254`).
- `physicalBodyParts`/`physical-geometry.ts` не читает `stairs`/`plan_*` —
  исключение этих полей для union/physicalBodies/innerContour безопасно.
- `clean-floor.ts:53` — единственный потребитель группы union/bodies/contours,
  которому нужны `stairs`.
- `plan_*` вне `space-geometry.ts`/`backdrop-frame-gesture.ts`/редактора подложки
  не используется геометрией стен/тел (13 файлов, все редакторские).
- Файлы тестов/smoke из «Плана автотестов» существуют на основе; счётчики
  `_floorCacheBuilds.*` реально существуют и уже инструментированы.
- Классификация release-ledger «предположительно stable-fix» обоснована (#663,
  #780 уже в выпущенных записях CHANGELOG).

## Что проверено и корректно (этот раунд)

- Текст r2 действительно меняет только заявленные разделы; остальной текст
  ТЗ побайтно совпадает с тем, что разбирал r1 (построчное сравнение тела issue).
- Технический выбор (b) реализуем на текущей сигнатуре функций без нового
  механизма: `planRect`, `stairList`, `physicalSpaceRecord` — все уже существующие
  чистые функции, пригодные для прямого вызова на сырой записи этажа (см. «Как
  проверялось», п.2).
- Эквивалентность нового `bg`-геттера сегодняшнему поведению `demand-space-models.ts:38`
  прослежена построчно и подтверждена, а не принята на слово автора.
- AC9 сформулирован однозначно (счётчик `work.builds`, глубокое равенство с
  `spaceModels`, референциальное равенство в пределах одного `read`) и
  достижим существующей инфраструктурой теста (`test/demand-space-models.test.mjs`
  уже сравнивает с `spaceModels` по тому же шаблону).
- AC3 теперь проверяет значения (площадь clean floor, атрибуты backdrop), что
  закрывает продемонстрированный r1 сценарий ложно-зелёного теста; «чем
  краснеет» для этой проверки назван явно — мутант «ключ без `stairs`/`plan_*`,
  источник через `full()`» в «Плане автотестов».
- Новое правило Контракта п.4 («из ключа этого кэша не исключается ничего, что
  обёртка отдаёт из `full()`») — общий инвариант, защищающий не только текущий
  случай, но и любое будущее поле с той же природой ошибки.
- «Принято предположительно» явно называет выбор (b) как предположение с
  обоснованием и сохраняет (a) как явную, тоже допустимую альтернативу —
  соответствует правилу «не бывает сложной задачи без открытого вопроса»,
  без утверждений-догадок, выданных за факт.

## Чего не проверял

- Исполнение (unit/smoke/gate:small) — не требуется на этапе spec и не
  запускалось; `run_check` не вызывался, единственный непокрытый вопрос раунда
  разрешился чтением.
- Повторный разбор AC1/AC2/AC4–AC8 и разделов UX/модель данных/i18n/откат —
  дельта r2 их не касается, они унаследованы из r1 (раздел выше).
- Полноту списка «неизвестных» потребителей `plan_*`/`stairs` за пределами
  `src/` (Python-бэкенд, PDF-экспорт) — как и в r1, это явный риск самого ТЗ,
  адресуемый корпусом AC3/AC4 на этапе code, не предмет повторной проверки здесь.
- Будущую корректность самой реализации (код ещё не написан) — ревью ТЗ
  оценивает осуществимость и доказуемость, не код.

## Гейты

Этап spec: кодовый Validate (tsc/build/npm test/gate:small) не требуется и не
запускался — согласовано с `ciEvidence.contextOnly=true`. Выполнена только
адресная проверка осуществимости чтением исходников (см. «Как проверялось»,
пп. 2–3) для единственного конкретного непокрытого технического вопроса этого
раунда (закрытие F-SPEC-1 вариантом (b)); `run_check` не вызывался — в нём не
было нужды для разрешения этого вопроса. Негативный/смежный случай отдельно не
запускался: вопрос раунда — осуществимость подхода, а не поведение
существующего кода на отрицательном входе.

## Маршрут

`route: fix` — трек `ask`, этап spec; `reclassify` неприменим (только код-ревью
`show`). High/Medium в этом раунде не найдены — outside-findings-policy
(`mode=issues`) не задействуется: `outside_findings` пуст, побочных находок вне
скоупа задачи не обнаружено.

## Вердикт

High: 0 · Medium: 0.

Находка F-SPEC-1 (High, r1) закрыта по существу и независимо подтверждена
чтением; новых находок в дельте r2 не найдено. ТЗ в редакции 2 осуществимо и
доказуемо в части Контракта п.4/п.5, AC3, AC9.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjVlNWNjMjNhNWYyYjI1MmZmZmJmNTFkYTcyNDc3YTBmZTlmNjgyNWRkNjE1MDNlNzgwNzlhOWY1ODRlN2Q3NTIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0NDNiNWM3YzY3ZGJjZTg0OTE5MDUwNWFiNGI5M2U4NDU2MzJmZjc1OTc2Y2QyNzczNzVlY2UwZjE4ZjdkY2Y3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk4LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJmMTBjNjViZGI1NjM3N2M3NmM1NTkzNjI4ZmVhNDZhYWViMjBmZDMxIiwidHJlZSI6IjU3OWVlNzY5MGYzMzFhMTNmMDNiMGZkM2ExMTQxODc2MzhhN2Q0NDYiLCJib2R5RGlnZXN0IjoiZTQ0ZjRjMDMyZGM2NmE4YTVlYWM5ZjJjNDdmMjk5MTA5MWYwYTI4MjRmMWJlMzlmY2Y0OTNlMWExY2U3MzZlYyIsInByb2R1Y2VyUnVuIjoiNDA2NTM0NDQyNTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjUyNjFiN2EwNmI5ODNkMjVkYWRjMTljMDk5NDZhY2UzMzM5NTExNzUyYmE3NzBjMGY2ZjViYzgwZmI0MTU3MDgiLCJ2ZXJkaWN0RGlnZXN0IjoiNzBmODkwMTRhOWFlYTYxNzY0YjAyMjVmZjU0NGYyOTliYzdmMWQ1YTc3MjkyMjY5MGEwNTAzZGE3MTczY2QxMiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1NTRmNGE2OTZkNTFiODMzNTIyZTlhZWJlNWZkMzIxMGNlMWEzZWRmN2ZiNDcyNDY1MzAzODM4NjNjY2ViMWExIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzODkwNDY1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk4I2lzc3VlY29tbWVudC02NDYzODkwNDY1IiwiYm9keURpZ2VzdCI6IjAzMDk0NzhlNTg4MWM1Y2ZmOTU3ZmZmMTk1NWZiMTRmZGNjODlhODVjNGQzYmUzYWFjYWZjY2Y5MWZlMDBkZTgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `f10c65bdb563` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `579ee7690f331a13f03b0fd3a114187638a7d446`
  ```
  git log --all --format='%H %T' | grep 579ee7690f33
  ```
- Тело issue: `e44f4c032dc66a8a5eac9f2c47f2991091f0a2824f1be39fcf493e1a1ce736ec`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzIsIm91dHB1dF90b2tlbnMiOjIzNTUxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjgzMDE4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6OTc5MTMwLCJjb3N0VXNkRXN0aW1hdGUiOjAuNzYzNDcyfV0sInR1cm5zIjoyOSwiZHVyYXRpb25NcyI6MjgzMjE0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC43NjM0NzIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=32 output_tokens=23551 cache_creation_input_tokens=83018 cache_read_input_tokens=979130 num_turns=29 -->
