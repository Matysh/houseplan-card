# SPEC-REVIEW-1098-r1

Issue: #1098 · Этап: spec (ревью ТЗ) · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: тело issue #1098 (bodyDigest зафиксирован в REVIEW_CONTEXT), версия ТЗ
«Редакция 1 · 28.10.2026 · основа: dev `09bda8dbe`» (после слияния #1093).
Рабочее дерево ревью совпадает с этой же основой (SHA `09bda8dbee8b50577bfc4affc332b8cda914f5b4`).

## Скоуп ревью

Проверялось ТЗ в теле issue #1098: обязательные разделы §7.1, однозначность AC1–AC8 и
способ их доказательства, техническая осуществимость заявленного подхода (проекция
ключа этажа «по потребителю» через `nonStructural` у `physicalSpaceRecord`, live-маршрут
жестов лестницы/LED) — чтением текущего состояния исходников на зафиксированной основе.
Кодовый Validate не требовался и не запускался (этап spec, `ciEvidence.contextOnly=true`).

## Как проверялось

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md`, затем тело issue #1098 (раздел `## ТЗ`).
2. Прочитаны все разделы ТЗ на предмет §7.1 (сценарий · что человек увидит · проблема ·
   скоуп/не-скоуп · контракт поведения · UX · модель данных и миграция · i18n · AC1–ACn ·
   план автотестов · риски · откат · release-артефакты) — все присутствуют.
3. Технические утверждения ТЗ сверены построчно с текущим кодом (Read/Grep, без
   исполнения): `live-editor.ts`, `stairs-editor.ts`, `led-strip-editor.ts`,
   `floor-geometry-key.ts`, `structural-space-record.ts`, `clean-floor.ts`,
   `demand-space-models.ts`, `space-geometry.ts`, `physical-geometry.ts`,
   `device-contact-card.ts`, `houseplan-card.ts`, `glow-scene.ts`.
4. Адресная проверка осуществимости (не исполнение, не мутант): прослежена полная
   цепочка вызовов для утверждения Контракта п.4 «демand-space-models исключается из
   инвалидации по `led_strips`/`stairs`/`plan_*`, как union/bodies/contours/contacts» —
   единственный конкретный непокрытый технический вопрос, найденный в материале.
   Run_check не вызывался: вопрос решается чтением источников на зафиксированной
   основе, исполнимый оракул здесь не нужен и не заменяет чтение при отсутствии диффа.

## Что проверено и корректно

- Обязательные разделы §7.1 присутствуют и заполнены по существу; оба продуктовых
  раздела («Сценарий», «Что человек увидит до и после») называют персону (admin,
  J4/J6 из `docs/SCOPE.md`), поверхность (desktop) и наблюдаемый эффект без терминов
  реализации.
- Ровно один явный блок открытых вопросов — «Принято предположительно, поменять
  свободно при ревью» (3 пункта) — соответствует правилу «не бывает сложной задачи
  без открытого вопроса»; все три отмечены как предположения, не как факты.
- Фактическая база проблемы подтверждена чтением: `activeEditorGesture`
  (`src/live-editor.ts:112-117`) действительно не перечисляет жесты лестницы/LED;
  `stairs-editor.ts` `pointerMove` → `replace()` → `write()` (`:157-167`, `:396-428`)
  действительно вызывает `this.owner._cfgEpoch++` и `requestUpdate()` на **каждый**
  pointermove, а не только на коммит; `led-strip-editor.ts` `handleMove` (`:697-710`)
  действительно зовёт только `host.requestUpdate()` без rAF-коалесции и без
  маршрутизации через `routeHouseplanEditorUpdate`.
- `physicalSpaceRecord(record, ...nonStructural)` (`structural-space-record.ts:39`)
  уже параметризована списком исключаемых полей и уже используется так свет
  (`glow-scene.ts:254`: `physicalSpaceRecord(rawSpaceConfig, 'led_strips')`) — принятое
  предположение «та же функция без нового механизма» подтверждено сигнатурой, не
  придумано.
- `physicalFloorFingerprint` (`floor-geometry-key.ts:82-84`) сегодня действительно
  вызывает `physicalSpaceRecord(record)` без дополнительных исключений, и этим же
  читателем (`floorGeometryKeyReader`, default fingerprint) пользуются
  `houseplan-card.ts:1952` (`_floorKey` → union `:9183`, bodies `:9837`, clean floor
  `:9861`) и `device-contact-card.ts:61` (`floorGeometryKeyReader(host)`) — подтверждает
  заявленный охват «потребителей одного ключа».
- `physicalBodyParts`/`physical-geometry.ts` не читает ни `stairs`, ни `plan_*` —
  исключение этих полей для union/physicalBodies/innerContour действительно безопасно,
  как заявлено в Скоупе и AC3/AC4.
- `clean-floor.ts:53` (`const stairs = space.stairs`) подтверждает, что лестницы нужны
  только clean floor среди группы union/bodies/contours — обоснование «лестница читается
  только clean floor» верно.
- `plan_x/plan_y/plan_scale*/plan_angle/plan_opacity` вне `space-geometry.ts`/
  `backdrop-frame-gesture.ts`/редактора подложки не используются геометрией стен/тел
  (проверено по списку файлов, читающих эти поля — 13 файлов, все редакторские/
  трансформационные, не физика стен) — риск «неизвестный потребитель plan_*» в разделе
  «Риски» ТЗ назван и достаточен на уровне ТЗ (адресуется корпусом AC3/AC4 при коде).
- Все файлы тестов и smoke, перечисленные в «План автотестов» и в столбце
  «Доказательство», реально существуют на этой основе: `test/live-editor.test.mjs`,
  `test/stairs.test.mjs`, `test/led-strip-editor.test.mjs`,
  `test/floor-geometry-key.test.mjs`, `demo/smoke_stairs.mjs`,
  `demo/smoke_led_strip_draw.mjs`, `demo/smoke_floor_geometry_cache.mjs`,
  `demo/smoke_geometry_history_refusal.mjs`, `demo/benchmark_led_strips.mjs` —
  план не ссылается на несуществующую инфраструктуру.
- `_floorCacheBuilds.{wallUnion,physicalBodies,innerContour,cleanFloor,lightBarrier}`
  (`houseplan-card.ts:1912` и далее `physicalBodies++`/`cleanFloor++`) — счётчики,
  на которые опирается AC1/AC3, реально существуют и уже инструментированы.
- Классификация release-ledger «предположительно stable-fix» обоснована: #663 и #780
  действительно присутствуют в уже выпущенных записях `docs/CHANGELOG.md`
  (строки 1133/1213/1295/1391) — не выдумана.

## Находки

### F-SPEC-1 (High, в скоупе) — Контракт п.4 исключает `demand-space-models` из
инвалидации по `stairs`/`plan_*`, но эта проекция ломает два реальных, уже
существующих потребителя её же кэша: `clean-floor` (через `space.stairs`) и
рендер подложки (через `space.bg`) — именно тот сценарий, который задача призвана
исправить.

**Воспроизведение (чтением, не исполнением).**

`demand-space-models.ts` держит ОДИН общий кэш `SpaceModel` на этаж (`this.floors`,
ключ — `physicalFloorFingerprint(raw)`, `:19`). У возвращаемой обёртки:

```
get stairs() { return full().stairs; }      // demand-space-models.ts:42
bg: s.plan_url ? { href, ...planRect(s, NORM_W) } : null   // space-geometry.ts:169
```

— т.е. и `.stairs`, и геометрия `.bg` (x/y/w/h/angle из `plan_x/plan_y/plan_scale*/
plan_angle`, см. комментарий `space-geometry.ts:70-75`) вычисляются ВНУТРИ того же
дорогого `full()`-билда, который Контракт п.4 предлагает не перестраивать при
изменении только `stairs`/`plan_*`. В отличие от `led_strips` (`led_strips: raw.led_strips`,
прямой проброс из сырого конфига, кэш не участвует), `stairs`/`bg` сегодня **не**
забайпашены мимо `full()`.

Эта же модель — единственный источник `space.stairs` для `clean-floor.ts:53`
(`_cleanFloor` вызывается с `space = this._spaceModel()`, `houseplan-card.ts:9857-9867`)
и единственный источник `space.bg` для рендера подложки
(`houseplan-card.ts:11362-11367`: `<image … x=${space.bg.x} y=${space.bg.y} …
transform=rotate(${space.bg.angle} …)`, и `_spaceModel()?.bg` в ряде мест рендера).

Если `physicalFloorFingerprint`, передаваемый в `DemandSpaceModels`, исключит
`stairs`/`plan_*` (как предписывает п.4 для этого потребителя), то после коммита
переноса лестницы или подложки ключ `this.floors` для этажа не изменится →
`previous?.key === key` → `resolved = previous.model` — **старая** модель с
**старыми** `stairs`/`bg`. Результат:

- после `pointerup` переноса подложки изображение на плане визуально не сдвинется
  (или не довернётся по `angle`) до любого другого триггера, который случайно
  заставит `DemandSpaceModels` пересобраться — прямая регрессия ровно того сценария,
  который ТЗ называет в «Сценарий»/«Что человек увидит» («...позже... переносит
  подложку этажа», «после: ... коммит ... подложки не остужает ...»);
- после коммита переноса лестницы `clean-floor` при следующем обращении пересчитает
  результат (его **собственный** ключ в `floor-geometry-key.ts` по-прежнему содержит
  `stairs`, как и предписано), но входом для вычитания возьмёт **старые** координаты
  лестницы из того же устаревшего `space.stairs` — AC3 («правка stairs даёт ровно
  одну сборку clean floor») при этом формально выполнится (счётчик `cleanFloor++`
  увеличится ровно на 1), но вычисленная площадь будет неверной. Контрпример
  показывает, что сам способ доказательства AC3 (счётчик сборок) не ловит эту ошибку:
  «зелёный» прогон AC3 по его буквальному тексту не исключает тихо неверное значение.

Существующий код уже один раз платил за этот же класс ошибки: внешний кэш модели
карты (`_cfgFingerprint`, `houseplan-card.ts:4164-4188`) намеренно включает
`plan_x/plan_y/plan_scale*/plan_angle/plan_opacity` с комментарием «without it in the
key a drag of the picture would leave the memoized model … showing the old rectangle»
(`:4169-4171`) — то есть именно эта ловушка уже один раз обнаруживалась и чинилась на
внешнем уровне кэша. Внутренний кэш `DemandSpaceModels.floors` — отдельная структура с
отдельным ключом, и предложение п.4 воспроизводит ту же ошибку на внутреннем уровне,
если его реализовать буквально (просто расширив список `nonStructural` у вызова для
этого потребителя).

**Почему не Medium.** Последствие — не стоимость сопровождения, а видимый пользователю
регресс именно того действия, которое это ТЗ явно обещает чинить («перенос подложки
этажа» из «Сценарий»), и собственный способ доказательства AC3 не способен его поймать
(ложно-зелёный тест). Это делает ТЗ в текущей редакции невыполнимым в части Контракта
п.4/AC3/AC4 для `demand-space-models` без исправления, поэтому — блокирующая находка.

**Что нужно изменить в ТЗ перед `S5-ready`** (на выбор автора, оба технически
осуществимы при текущей сигнатуре `physicalSpaceRecord`):
- (a) не включать `demand-space-models` в группу консьюмеров, исключающих `stairs` и
  `plan_*` (только `led_strips` остаётся безопасным для него, т.к. нигде не читается
  через `full()`), и явно развести её ключ от union/bodies/contours; либо
  - (b) явно потребовать в Скоупе/Контракте, чтобы `demand-space-models.ts` перестал
  читать `stairs`/`bg` через `full()` и пробрасывал их из `raw` напрямую — так, как уже
  сделано для `led_strips` (`led_strips: raw.led_strips`), — и тогда действительно
  безопасно исключать оба поля из его ключа.
Любой выбранный вариант нужно явно отразить в Контракте п.4 и добавить в AC3 проверку
**значения**, а не только счётчика сборки, для clean floor и для `space.bg` после
коммита лестницы/подложки (например: координаты/площадь после коммита равны ожидаемым
новым, не старым).

## Чего не проверял

- Исполнение (unit/smoke/gate:small) — не требуется на этапе spec и не запускалось;
  `run_check` не вызывался, т.к. единственный найденный непокрытый вопрос разрешился
  чтением источников без диффа для исполнения.
- Полноту списка «неизвестных» потребителей `plan_*` за пределами `src/` (Python-бэкенд,
  PDF-экспорт, summary-panel) — ТЗ сама называет это риском с проверкой через корпус
  AC3/AC4 при коде; дополнительно не углублялся, т.к. это адресуется на этапе code
  названным в самом ТЗ механизмом (corpus test по потребителю).
- Доли и формулировки AC2/AC5 относительно явного «чем краснеет» для каждой строки по
  отдельности — раздел «План автотестов» закрывает это общей фразой «До правки:
  AC1–AC3 красные на неизменённой базе», этого достаточно для спецификации; отдельно
  не считал это находкой.

## Гейты

Этап spec: кодовый Validate (tsc/build/npm test/gate:small) не требуется и не
запускался — согласовано с `ciEvidence.contextOnly=true` в материале ревью. Выполнена
только адресная проверка осуществимости чтением исходников (см. «Как проверялось»,
п.4) для единственного найденного конкретного непокрытого технического вопроса
(корректность Контракта п.4 для `demand-space-models`); `run_check` не вызывался —
в нём не было нужды для разрешения этого вопроса.

## Маршрут

`route: fix` — Medium/High найдены в скоупе самой задачи (#1098), не вне его;
новых issue не заводится. `outside_findings` — пусто: побочных находок вне скоупа
этой задачи не обнаружено.

## Вердикт

High: 1 · Medium: 0 → в задаче.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI2MmQ2ODA2NGM3MzQ5NDM1OGU5YmQ4NDJjNGUxYjk0YTE4NTExNjhkYzY3MTk1NzE5MTA2Njc0ZjEzZGFjNzEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJmOGY5ZDBkMTU0OTRmNDcyZDU5NTZmOTg1MGFiN2MxMjI1YWM3MDNlMmE3ODdmNDg5YWVjMjJkYWM4YWFiZDUyIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk4LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwOWJkYThkYmVlOGI1MDU3N2JmYzRhZmZjMzMyYjhjZGE5MTRmNWI0IiwidHJlZSI6ImE2NWQ4YmU5M2I2ZTY0NGZhNmYzZGUzZTQxMmJlOTRmZDYwNTdjZTkiLCJib2R5RGlnZXN0IjoiNzViYmFmNDk0OTViODRlZmNjMDFiMTRkMWExYWJkZGRkOGVlNGY0M2JkMWFkYjc3OWQ5NTBlMGZiNTNlNWFmNiIsInByb2R1Y2VyUnVuIjoiNDA2NTA3MTY2NzEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjVkMTExYzY3OTg0YTg5MDg0NDAzMGY4NDE0YTVlMzRlZmEzMzM4YjViODAyZWM2ZTUzMzIyZWY1NmVjMzQ2NzAiLCJ2ZXJkaWN0RGlnZXN0IjoiMDNmYzY5MzNjYWEyYTRkMWVkNmZkMzYyOTk1ZmE0MjVjNWI2MzhlYmFiZjg2ODc5ZjhkNjE0ZjM2NzRhZmM4MCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlMjUxMDllNjk5YzdhNDRkZTU0Y2EyMTcyZTlmZDMxYjZjYzkyOTFlN2ZmODllYTdjMTBhOWQ4NzE4NzFhYjQwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzNTcwNjg3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk4I2lzc3VlY29tbWVudC02NDYzNTcwNjg3IiwiYm9keURpZ2VzdCI6ImYxZGUxODc2ODJkMTdiYTJiYTcxNTY1OGNiMGVkN2YwN2I5NDI2NTc2ZTA5MGMzZDgwMzhjYTE5MzYzNmIyOTUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `09bda8dbee8b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a65d8be93b6e644fa6f3de3e412be94fd6057ce9`
  ```
  git log --all --format='%H %T' | grep a65d8be93b6e
  ```
- Тело issue: `75bbaf49495b84efcc01b14d1a1abdddd8ee4f43bd1adb779d950e0fb53e5af6`
- Вердикт конвейера: `red` · High 1 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTAsIm91dHB1dF90b2tlbnMiOjU5MjYzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1MDg4MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQ4MzczNzQsImNvc3RVc2RFc3RpbWF0ZSI6Mi4xNjM4MTY4fV0sInR1cm5zIjo3MCwiZHVyYXRpb25NcyI6NzEzNTE4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4xNjM4MTY4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=90 output_tokens=59263 cache_creation_input_tokens=150883 cache_read_input_tokens=4837374 num_turns=70 -->
